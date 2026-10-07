"""ATLAS · tests de regresión de los cálculos y humo de pantallas.

Uso:   python tests/regression.py            → compara con tests/golden.json
       python tests/regression.py --update   → regenera las referencias (solo tras revisar un cambio intencionado)

Requiere Playwright (pip install playwright && playwright install chromium).
Variables opcionales: ATLAS_CHROMIUM (ruta a chromium), ATLAS_NM (node_modules con three/chart.js/maplibre para no usar la red).

Los datos de precios se actualizan cada día, así que las referencias se comparan con tolerancia y, sobre todo,
con INVARIANTES que no dependen del día (100 % S&P = 1 apuesta; Mundo+EM+Bonos > Mundo+S&P+Nasdaq; …)."""
import asyncio, functools, http.server, json, os, re, socketserver, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / 'tests' / 'golden.json'
NM = os.environ.get('ATLAS_NM')
PORT = 8790 + os.getpid() % 100

PROFILES = {
    'A_diversificada':  [['VT', 40], ['EEM', 20], ['IWM', 20], ['AGG', 20]],
    'B_falsa_divers':   [['VT', 25], ['SPY', 25], ['QQQ', 25], ['SMH', 25]],
    'C_concentrada':    [['QQQ', 1], ['SMH', 1], ['NVDA', 1]],
    'D_dos_apuestas':   [['SPY', 50], ['EEM', 50]],
    'E_una_apuesta':    [['SPY', 100]],
    'S1_mundo_em_bonos':[['VT', 40], ['EEM', 20], ['AGG', 40]],
    'S2_mundo_sp_nq':   [['VT', 1], ['SPY', 1], ['QQQ', 1]],
    'X_ejemplo_6':      [['VT', 36], ['SPY', 24], ['QQQ', 15], ['SMH', 9], ['EEM', 9], ['NVDA', 6]],
}
# tolerancias absolutas (los datos cambian a diario)
TOL = {'bets5': .12, 'bets3': .15, 'health': 5, 'vol': 2, 'dd': 4, 'us': 3, 'tech': 3, 'top10': 3, 'ovl': 5}
INVARIANTS = [
    ('100 % S&P 500 = 1 apuesta',               lambda r: abs(r['E_una_apuesta']['bets5'] - 1) < .05),
    ('Mundo+EM+Bonos > Mundo+S&P+Nasdaq',        lambda r: r['S1_mundo_em_bonos']['bets5'] > r['S2_mundo_sp_nq']['bets5'] + .3),
    ('Diversificada > falsa diversificación',    lambda r: r['A_diversificada']['bets5'] > r['B_falsa_divers']['bets5']),
    ('Nasdaq+Semis+NVIDIA < 1,5 apuestas',       lambda r: r['C_concentrada']['bets5'] < 1.5),
    ('Ninguna cartera supera nº de productos',   lambda r: all(v['bets5'] <= v['n'] + 1e-6 for v in r.values())),
    ('Salud dentro de 0–100',                    lambda r: all(0 <= v['health'] <= 100 for v in r.values())),
    ('Estable 3 vs 5 años (≤ 0,3)',              lambda r: all(abs(v['bets5'] - v['bets3']) <= .3 for v in r.values() if v['bets3'] is not None)),
]

JS_CALC = r"""async (profiles)=>{const E=searchEntities(),f=t=>E.find(x=>x.t===t||String(x.tk)===t);const out={};
 for(const [k,L] of Object.entries(profiles)){const tot=L.reduce((a,x)=>a+x[1],0);const P=L.map(([t,w])=>({e:f(t),w:w/tot}));if(P.some(x=>!x.e)){out[k]={error:'ticker'};continue}
  const Lt=ATLASI.lookThrough(P),R=await ATLASI.riskOf(P),R3=await ATLASI.riskOf(P,3),SC=ATLASI.docScores(Lt,R,P,R3),rb=SC.bets&&SC.bets.rob;
  const tech=Object.entries(Lt.S).find(([s])=>/tecnolog/i.test(s));
  out[k]={n:P.length,bets5:rb?rb.d5:null,bets3:rb?rb.d3:null,cls:rb?rb.cls:null,conf:rb?rb.conf:null,health:SC.health,vol:R?R.vol:null,dd:R?R.dd:null,
   us:Lt.C.US||0,tech:tech?tech[1]:0,top10:SC.top10,ovl:SC.ovAvg,weeks:R?R.weeks:null}}
 return out}"""

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def local_for(u):
    if not NM: return None, None
    if 'three.min.js' in u: return NM + '/three/build/three.min.js', 'application/javascript'
    if 'chart.umd.js' in u: return NM + '/chart.js/dist/chart.umd.js', 'application/javascript'
    if 'maplibre-gl.js' in u: return NM + '/maplibre-gl/dist/maplibre-gl.js', 'application/javascript'
    if 'maplibre-gl.css' in u: return NM + '/maplibre-gl/dist/maplibre-gl.css', 'text/css'
    return None, None

async def main(update):
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    fails = []
    async with async_playwright() as p:
        kw = {'args': ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']}
        if os.environ.get('ATLAS_CHROMIUM'): kw['executable_path'] = os.environ['ATLAS_CHROMIUM']
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={'width': 1280, 'height': 820}, service_workers='block')
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        async def route(r):
            u = r.request.url
            if f'127.0.0.1:{PORT}' in u: return await r.continue_()
            fp, ct = local_for(u)
            if fp: return await r.fulfill(path=fp, content_type=ct)
            if NM: return await r.abort()          # sin red en local: el resto (Mapbox, fuentes) no hace falta para los cálculos
            return await r.continue_()
        await pg.route('**/*', route)
        await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
        await pg.wait_for_function("window.ATLASI&&ATLASI.docScores&&typeof searchEntities==='function'", timeout=60000)
        await pg.evaluate("ATLASI.loadExpo()")
        res = await pg.evaluate(JS_CALC, PROFILES)
        # humo de pantallas: no deben lanzar errores
        smoke = await pg.evaluate("""async()=>{const r={};const t=async(n,fn)=>{try{await fn();r[n]='ok'}catch(e){r[n]='ERROR '+e.message}};
          ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:[{k:'e',t:'VT',w:60},{k:'e',t:'QQQ',w:30},{k:'s',t:'NVDA',w:10}],tab:'doctor'};
          await t('analisis',async()=>{openHub('doc');await ATLASI.renderDoc()});await t('radar',async()=>{openHub('radar')});await t('comparar',async()=>{openHub('cmp')});
          await t('resumen',async()=>{closeHub();await ATLASI.renderOverview()});return r}""")
        contrib = await pg.evaluate("""async()=>{const E=searchEntities(),f=t=>E.find(x=>x.t===t);const A=await ATLASI.analyzePortfolio([['VT',36],['SPY',24],['QQQ',15],['NVDA',25]].map(([t,w])=>({e:f(t),w})));
          A.src={src:'pf',val:10000};const T=await ATLASI.getPortfolioContribution(A);if(!T)return null;
          return{R:T.R,sum:T.items.reduce((a,i)=>a+i.c,0),eurOk:Math.abs(T.eur.d-T.items.reduce((a,i)=>a+i.eur,0))<1e-6,ind:T.ind.length,indEst:T.ind.every(o=>o.quality==='est'),dirReal:T.items.every(i=>i.quality==='real'),status:T.status,session:T.session}}""")
        optim = await pg.evaluate("""async()=>{const E=searchEntities(),f=t=>E.find(x=>x.t===t);const inc=E.find(x=>x.k!=='s'&&ATLASI.expOf(x).q.country==='none');
          const P={A:[['SPY',100]],B:[['VT',50],['QQQ',25],['SMH',15],['NVDA',10]],C:[['VT',25],['EEM',25],['AGG',25],['GLD',25]],D:[['VT',100]],E:[[inc.t,60],['VT',40]],F:[['VT',55],['EEM',10],['IWM',10],['AGG',25]]};const out={};
          for(const [k,L] of Object.entries(P)){const A=await ATLASI.analyzePortfolio(L.map(([t,w])=>({e:f(t)||E.find(x=>x.t===t),w})));A.src={src:'custom'};const O=await ATLASI.optimize(A);
            out[k]={probs:O.probs.map(p=>p.id),top:O.top.length,bestNew:O.top[0]?O.top[0].mv.filter(x=>x.from===0).length:0,ineff:O.mg.filter(o=>o.ineff).map(o=>o.e.t),adds:O.adds.length,
              conf:O.top[0]?O.top[0].conf:null,optsNew:(O.opts||[]).map(o=>o.mv.filter(x=>x.from===0).length)}}return out}""")
        await pg.wait_for_timeout(3000)
        await b.close()
    srv.shutdown()
    print('== Cálculos por perfil')
    for k, v in res.items(): print(f'  {k:20s}', {kk: (round(vv, 2) if isinstance(vv, float) else vv) for kk, vv in v.items()})
    print('== Invariantes')
    for name, fn in INVARIANTS:
        ok = False
        try: ok = bool(fn(res))
        except Exception as e: name += f' ({e})'
        print(('  OK   ' if ok else '  FALLA ') + name)
        if not ok: fails.append(name)
    print('== Pantallas', smoke, 'errores JS:', errs[:5])
    print('== Contribución diaria', contrib)
    print('== Optimizador', optim)
    OT=[('A 100 % S&P: detecta concentración / una sola apuesta', lambda o: {'single','cty'}&set(o['A']['probs'])),
        ('A: no propone 7 ETFs (máx. 2 nuevos por opción)', lambda o: max([o['A']['bestNew']]+o['A']['optsNew'])<=2),
        ('B: detecta concentración tecnológica', lambda o: 'sec' in o['B']['probs']),
        ('B: Nasdaq/Semis/NVIDIA con baja eficiencia marginal', lambda o: bool(set(o['B']['ineff'])&{'QQQ','SMH','NVDA'})),
        ('C Mundo+EM+Bonos+Oro: no cambiaría nada', lambda o: o['C']['top']==0),
        ('D un solo ETF: propone complementos', lambda o: o['D']['adds']>0 or o['D']['top']>0),
        ('E datos incompletos: confianza reducida', lambda o: o['E']['conf'] in ('low','medium')),
        ('F ya optimizada: no cambiaría nada', lambda o: o['F']['top']==0)]
    for name,fn in OT:
        ok=False
        try: ok=bool(fn(optim))
        except Exception as e: name+=f' ({e})'
        print(('  OK   ' if ok else '  FALLA ')+name)
        if not ok: fails.append('optimizador: '+name)
    if not contrib or abs(contrib['R']-contrib['sum'])>1e-9 or not contrib['eurOk'] or not contrib['indEst'] or not contrib['dirReal']: fails.append('contribución diaria: no cuadra o etiquetas de calidad')
    if any(v != 'ok' for v in smoke.values()) or errs: fails.append('pantallas/errores JS')
    if update:
        GOLD.write_text(json.dumps(res, ensure_ascii=False, indent=1)); print('Referencias actualizadas:', GOLD)
    elif GOLD.exists():
        gold = json.loads(GOLD.read_text()); print('== Referencias (tolerancia por cambio diario de precios)')
        for k, g in gold.items():
            for m, tol in TOL.items():
                a, b = g.get(m), res.get(k, {}).get(m)
                if a is None or b is None: continue
                if abs(a - b) > tol: fails.append(f'{k}.{m}: {b:.2f} vs referencia {a:.2f}'); print(f'  FALLA {k}.{m}: {b:.2f} vs {a:.2f} (±{tol})')
        if not any(f.split('.')[0] in gold for f in fails): print('  OK   todas dentro de tolerancia')
    print('\nRESULTADO:', 'OK' if not fails else f'{len(fails)} FALLOS'); return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main('--update' in sys.argv)))
