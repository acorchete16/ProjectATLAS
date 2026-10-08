"""ATLAS · tests de P1 (Hoy + Explorar cambios + semántica de salud + lenguaje + rendimiento).

Uso:   python tests/p1.py
Reutiliza el arnés de tests/regression.py. No modifica ningún golden.
Rendimiento: escritorio (1280 px) y móvil (390 px con la CPU 4× más lenta vía DevTools)."""
import asyncio, functools, json, os, re, socketserver, sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import regression as RG
from playwright.async_api import async_playwright

REF = [{'k': 'e', 't': 'VT', 'w': 50}, {'k': 'e', 't': 'QQQ', 'w': 25}, {'k': 'e', 't': 'EEM', 'w': 10}, {'k': 'e', 't': 'IWM', 'w': 10}, {'k': 'e', 't': 'AGG', 'w': 5}]
FORBID = re.compile(r"\bdeber[ií]as\b|te recomiendo|recomendamos|atlas recomienda|\bmejor opci[oó]n\b|mejor oportunidad|cartera ideal|lo mejor para ti|te conviene (comprar|vender)|\bhaz esto\b|pon tu dinero|"
                    r"(^|[.!¡]\s*)(compra|vende)\b|\b(compra|vende)\s+(ya|ahora|m[aá]s|un|una|el|la|los|las|\d|[A-Z]{2,})", re.I)

JS = r"""async (REF)=>{const S=ATLASI.scenarios,P=ATLASI.portfolio,E=searchEntities(),f=t=>E.find(x=>x.t===t),out={},texts=[];
 const mk=L=>ATLASI.analyzePortfolio(L.map(([t,w])=>({e:f(t),w})));
 /* ---------- HOY ---------- */
 out.empty={contrib:await P.contribution(await ATLASI.analyzePortfolio([])),state:P.dataState(null).state};
 /* series sintéticas: VT +1 %, QQQ −2 %, AGG +0,5 %, NVDA −8 % (acción), IWM sin precio */
 const orig=window.eurSeries,syn={VT:.01,QQQ:-.02,AGG:.005,NVDA:-.08,EEM:-.01,SMH:-.03};
 window.eurSeries=(k,o)=>{if(o&&o.t==='IWM')return Promise.resolve(null);const r=o&&syn[o.t];if(r==null)return orig(k,o);return Promise.resolve([['2026-10-06',100],['2026-10-07',100*(1+r)]])};
 const A1=await mk([['VT',50],['QQQ',30],['AGG',10],['IWM',10]]);
 A1.src={src:'pf',val:10000};const Tm=await P.contribution(A1);
 const A2=await mk([['VT',50],['QQQ',30],['AGG',10],['IWM',10.0001]]);A2.src={src:'custom'};const Tw=await P.contribution(A2);
 out.amounts={eur:!!Tm.eur,sumEur:Tm.eur?Math.abs(Tm.eur.d-Tm.items.reduce((a,i)=>a+i.eur,0))<1e-6:false,sumR:Math.abs(Tm.R-Tm.items.reduce((a,i)=>a+i.c,0))<1e-12,
   pos:Tm.items.filter(i=>i.c>0).map(i=>i.e.t).sort(),neg:Tm.items.filter(i=>i.c<0).map(i=>i.e.t).sort(),missing:Tm.missing.map(i=>i.e.t),q:[...new Set(Tm.items.map(i=>i.quality))]};
 out.weights={eur:Tw.eur,sumR:Math.abs(Tw.R-Tw.items.reduce((a,i)=>a+i.c,0))<1e-12};
 /* exposición completa (acción directa) vs parcial (dentro de ETFs) */
 const A3=await mk([['NVDA',100]]),T3=await P.contribution(A3),I3=P.impact(A3,T3,A3.L.comps[0].key);
 const A4=await mk([['QQQ',50],['IWM',40],['NVDA',10]]);A4.src={src:'custom'};const T4=await P.contribution(A4),nk=A4.L.comps.find(c=>/NVIDIA/i.test(c.name)).key,I4=P.impact(A4,T4,nk);
 out.impact={full:{exact:I3.exact,q:I3.quality,bound:I3.bound,wmin:I3.wmin,est:I3.est},partial:{exact:I4.exact,q:I4.quality,bound:I4.bound,products:I4.products,of:I4.of,direct:I4.direct,indirect:I4.indirect,est:I4.est,r:I4.r}};
 /* HTML de Hoy con un líder por dentro de los ETFs (NVIDIA −8 %) */
 ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:[{k:'e',t:'QQQ',w:60},{k:'e',t:'SMH',w:30},{k:'s',t:'NVDA',w:10}],tab:'doctor'};
 window.eurSeries=orig;
 /* estados de datos (inyectando LIVE y la hora) */
 const L0=LIVE,iso=t=>new Date(t).toISOString(),tue14=Date.UTC(2026,9,6,14,0),sat=Date.UTC(2026,9,10,12,0);
 LIVE={...(L0||{}),u:iso(tue14-30*6e4)};const s1=P.dataState({status:'live'},tue14).state;
 LIVE={...(L0||{}),u:iso(tue14-4*36e5)};const s2=P.dataState({status:'live'},tue14).state;
 LIVE={...(L0||{}),u:iso(sat-30*36e5)};const s3=P.dataState({status:'close'},sat).state;
 LIVE={...(L0||{}),u:iso(tue14-25*6e4)};const s4=P.dataState({status:'delayed'},tue14).state;LIVE=L0;
 out.states={open:s1,stale:s2,closedWeekend:s3,delayed:s4};
 /* ---------- EXPLORAR CAMBIOS ---------- */
 const R0=await mk([['VT',50],['QQQ',25],['EEM',10],['IWM',10],['AGG',5]]),R1=await mk([['VT',25],['SPY',25],['QQQ',25],['SMH',25]]);
 const keys=new Set(),walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>{keys.add(k);walk(x)})};
 const probs=S.fromDoctor(R0).concat(S.fromDoctor(R1)),ideasOut=[];
 for(const [A,ps] of [[R0,S.fromDoctor(R0)],[R1,S.fromDoctor(R1)]])for(const p of [null,...ps]){const I=S.ideas(A,p),I2=S.ideas(A,p);walk(I);
   ideasOut.push({kind:p&&p.kind,det:JSON.stringify(I)===JSON.stringify(I2),keep:!!(I.keep&&I.keep.scenario&&I.keep.scenario.changes.length===0),
     alpha:I.groups.filter(g=>g.rows).every(g=>g.rows.every((r,i,a)=>!i||a[i-1].label.localeCompare(r.label)<=0||a[i-1].label<=r.label)),
     fixedSizes:I.groups.filter(g=>g.rows).every(g=>g.rows.every(r=>r.ops.every(o=>{const c=o.scenario.changes[0];return(c.op==='shift'&&Math.abs(c.amt-.10)<1e-9)||c.op==='remove'}))),
     addNeedsCrit:I.groups.filter(g=>g.explore).every(g=>g.explore&&!g.explore.sortKey),groups:I.groups.map(g=>g.title)});
   texts.push(I.head,I.keep.label,I.keep.why,...I.groups.flatMap(g=>[g.title,g.why,...(g.rows||[]).map(r=>r.info+' '+r.ops.map(o=>o.label).join(' '))]))}
 out.ideas={n:ideasOut.length,kinds:[...new Set(probs.map(p=>p.kind))],all:ideasOut,forbiddenKeys:[...keys].filter(k=>/^(best|top|score|winner|recommended|rank|ranking|ganador|mejor|recomendado)$/i.test(k))};
 /* simular todas las operaciones del problema de tecnología: debe haber escenarios que empeoren algo */
 const pt=S.fromDoctor(R0).find(p=>p.kind==='sec'),It=S.ideas(R0,pt),sims=[];
 for(const g of It.groups.filter(g=>g.rows))for(const r of g.rows)for(const o of r.ops){const res=await S.simulate(R0.P,o.scenario);sims.push(res);texts.push(S.title(o.scenario,R0.P),...S.narrate(res),...res.summary)}
 out.trade={n:sims.length,someWorsen:sims.some(r=>r.worsens.length),someImprove:sims.some(r=>r.improves.length),mixedNarr:sims.some(r=>S.narrate(r).some(x=>/a cambio/.test(x)))};
 /* salud: reducir volatilidad no es «mejor» por sí mismo */
 const q15=S.parse('Reduce Nasdaq al 15 %',R0.P).scenario,r15=await S.simulate(R0.P,q15),m=id=>r15.metrics.find(x=>x.id===id);
 const ag=await S.simulate([{id:'e:VT',w:1}],{...S.schema.emptyScenario(),type:'add',changes:[{op:'add',asset:'e:AGG',w:.3,funding:'prorata'}]});const ma=id=>ag.metrics.find(x=>x.id===id);
 out.health={volCls:m('vol').cls,rkCls:m('dim:rk').cls,healthCls:m('health').cls,topPosCls:m('topPos').cls,dims:r15.metrics.filter(x=>x.id.startsWith('dim:')).map(x=>[x.id,x.dir,x.cls]),
   agVol:[ma('vol').before,ma('vol').after,ma('vol').cls],agHealth:[ma('health').before,ma('health').after,ma('health').cls],agRk:ma('dim:rk').cls,narr15:S.narrate(r15),narrAg:S.narrate(ag),narrow:!!m('narrow')};
 texts.push(...S.narrate(r15),...S.narrate(ag),...r15.summary,...ag.summary);
 /* ---------- UI: Explorar cambios ---------- */
 ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:REF,tab:'doctor'};
 ATLASI.openExplore({kind:'sec',ref:'Tecnología'});await new Promise(r=>setTimeout(r,2500));
 const ui={tab:!!document.querySelector('[data-tab="explore"][aria-selected="true"]'),head:(document.querySelector('.xc-hd')||{}).innerText,rows:document.querySelectorAll('[data-xs]').length,opt:!!document.querySelector('[data-tab="opt"]')};
 document.querySelector('[data-xtag="em"]').click();await new Promise(r=>setTimeout(r,300));ui.listBeforeCrit=document.querySelectorAll('#xcAddL [data-xli]').length;ui.critShown=document.querySelectorAll('[data-xcr]').length;
 document.querySelector('[data-xcr="ter"]').click();await new Promise(r=>setTimeout(r,2500));ui.listAfterCrit=document.querySelectorAll('#xcAddL [data-xli]').length;ui.orderLabel=(document.querySelector('#xcAddL .xc-w')||{}).innerText;
 document.querySelector('[data-xs]').click();await new Promise(r=>setTimeout(r,2500));const res=document.querySelector('#xcRes');ui.res=res.innerText.slice(0,2500);ui.hasRead=/Lectura/i.test(res.innerText);ui.chips=res.querySelectorAll('.q').length;
 const inp=document.querySelector('#xcIn');inp.value='reduce Nasdaq al 15 %';document.querySelector('#xcQ').dispatchEvent(new Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,2500));
 ui.parsed=(document.querySelector('#xcRes .xc-sh h4')||{}).innerText;
 inp.value='reduce QQQ un 10 %';document.querySelector('#xcQ').dispatchEvent(new Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,500));ui.askQ=(document.querySelector('#xcAsk .xc-aq')||{}).innerText;
 document.querySelector('#xcAsk [data-xa]').click();await new Promise(r=>setTimeout(r,2500));ui.askRes=(document.querySelector('#xcRes .xc-sh h4')||{}).innerText;ui.hist=document.querySelectorAll('[data-xh]').length;
 texts.push(document.querySelector('.xc').innerText);
 /* Doctor: enlace «Explorar cambios» desde un problema */
 ATLASI.DOC={...ATLASI.DOC,tab:'doctor'};await ATLASI.renderDoc();await new Promise(r=>setTimeout(r,1500));ui.dxLinks=document.querySelectorAll('[data-xc]').length;ui.teaser=(document.querySelector('.xc-teaser')||{}).innerText;texts.push(ui.teaser||'');
 const lk=document.querySelector('[data-xc]');if(lk){lk.click();await new Promise(r=>setTimeout(r,1500));ui.fromDx=!!document.querySelector('.xc-pb [aria-pressed="true"]:not([data-xp="0"])')}
 out.ui=ui;out.usage=ATLASI.usage();
 out.texts=texts.filter(Boolean);return out}"""

TODAY = r"""async (rows)=>{/* Hoy con líder sintético: NVIDIA −8 % dentro de QQQ y SMH */
 const orig=window.eurSeries,syn={QQQ:-.02,IWM:-.005,NVDA:-.08,VT:.001};LIVE={...(LIVE||{}),u:new Date().toISOString()};
 window.eurSeries=(k,o)=>{const r=o&&syn[o.t];if(r==null)return orig(k,o);const d=new Date().toISOString().slice(0,10),y=new Date(Date.now()-864e5).toISOString().slice(0,10);return Promise.resolve([[y,100],[d,100*(1+r)]])};
 ATLASI.DOC={...ATLASI.DOC,src:'custom',rows,tab:'doctor'};try{localStorage.setItem('atlas_ov2','1')}catch(_){}
 for(let i=0;i<100&&!(typeof MAPMODE!=='undefined'&&MAPMODE);i++)await new Promise(r=>setTimeout(r,100));closeHub();await ATLASI.renderOverview();await new Promise(r=>setTimeout(r,2500));
 const b=document.querySelector('#ovcard');if(!b)return{err:'sin tarjeta'};if(b.classList.contains('col')){b.querySelector('[data-ov=col]').click();await new Promise(r=>setTimeout(r,2500))}
 const day=(b.querySelector('.ov-day')||{}).innerText,box=b.querySelector('.td'),imp=box&&box.querySelector('.td-imp');
 const r={day,imp:imp?imp.innerText:null,acts:box?[...box.querySelectorAll('.td-a button')].map(x=>x.innerText):[],txt:box?box.innerText:'',chips:box?[...box.querySelectorAll('.q')].map(x=>x.innerText):[]};
 window.eurSeries=orig;return r}"""

SMOKE = r"""async()=>{const r={};const t=async(n,fn)=>{try{await fn();r[n]='ok'}catch(e){r[n]='ERROR '+e.message}};
  await t('doctor',async()=>{openHub('doc');ATLASI.DOC={...ATLASI.DOC,tab:'doctor'};await ATLASI.renderDoc()});
  await t('explorar',async()=>{ATLASI.openExplore(null);await new Promise(r=>setTimeout(r,1500))});
  for(const tb of ['hold','risk','geo','comp','sec'])await t('tab_'+tb,async()=>{ATLASI.DOC={...ATLASI.DOC,tab:tb};await ATLASI.renderDoc()});
  await t('radar',async()=>{openHub('radar')});await t('comparar',async()=>{openHub('cmp')});
  for(const h of ['watch','pf','calc','plan','term'])await t('hub_'+h,async()=>{openHub(h)});
  await t('hoy',async()=>{closeHub();await ATLASI.renderOverview();renderTick()});
  await t('globo',async()=>{const E=searchEntities();ATLASI.showExposureGlobe([{e:E.find(x=>x.t==='VT'),w:1}],'test','geo');ATLASI.hideExposure()});
  await t('experto',async()=>{const b=document.getElementById('expertBtn');b.click();b.click()});
  return r}"""

PERF = r"""async()=>{const S=ATLASI.scenarios,P=ATLASI.portfolio,E=searchEntities(),f=t=>E.find(x=>x.t===t),T={};const tm=async(k,fn)=>{const t=performance.now();await fn();T[k]=Math.round(performance.now()-t)};
  const L=[['VT',50],['QQQ',25],['EEM',10],['IWM',10],['AGG',5]];let A;
  await tm('analyze',async()=>{A=await ATLASI.analyzePortfolio(L.map(([t,w])=>({e:f(t),w})))});
  await tm('today',async()=>{await P.contribution(A)});
  S.cache.clear();const q=S.parse('Reduce Nasdaq al 15 %',A.P).scenario;
  await tm('simulate_frio',async()=>{await S.simulate(A.P,q)});await tm('simulate_cache',async()=>{await S.simulate(A.P,q)});
  await tm('ideas',async()=>{S.ideas(A,S.fromDoctor(A)[0])});
  await tm('additions_em',async()=>{await S.explore.additions(A.P,{},{sortKey:'ter',tag:'em'})});
  await tm('additions_todas',async()=>{await S.explore.additions(A.P,{},{sortKey:'overlap'})});
  await tm('removals',async()=>{await S.explore.removals(A.P)});
  ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:L.map(([t,w])=>({k:'e',t,w})),tab:'doctor'};
  await tm('pestaña_explorar',async()=>{ATLASI.openExplore(null);for(let i=0;i<60&&!document.querySelector('.xc');i++)await new Promise(r=>setTimeout(r,50))});
  return T}"""

async def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', RG.PORT), functools.partial(RG.Q, directory=str(RG.ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    res = {}
    async with async_playwright() as p:
        kw = {'args': ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']}
        if os.environ.get('ATLAS_CHROMIUM'): kw['executable_path'] = os.environ['ATLAS_CHROMIUM']
        b = await p.chromium.launch(**kw)
        for vw, name in ((1280, 'escritorio'), (390, 'móvil')):
            ctx = await b.new_context(viewport={'width': vw, 'height': 860}, service_workers='block', is_mobile=vw < 500, has_touch=vw < 500)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:200]))
            if vw < 500:
                cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
            async def route(r, _q=None):
                u = r.request.url
                if f'127.0.0.1:{RG.PORT}' in u: return await r.continue_()
                fp, ct = RG.local_for(u)
                if fp: return await r.fulfill(path=fp, content_type=ct)
                if RG.NM: return await r.abort()
                return await r.continue_()
            await pg.route('**/*', route)
            t0 = time.time()
            await pg.goto(f'http://127.0.0.1:{RG.PORT}/index.html')
            await pg.wait_for_function("window.ATLASI&&ATLASI.scenarios&&ATLASI.portfolio&&typeof searchEntities==='function'", timeout=90000)
            await pg.evaluate("ATLASI.loadExpo()")
            load = round((time.time() - t0) * 1000)
            r = {'load': load, 'perf': await pg.evaluate(PERF)}
            if name == 'escritorio':
                r['main'] = await pg.evaluate(JS, REF)
            r['today'] = await pg.evaluate(TODAY, [{'k': 'e', 't': 'QQQ', 'w': 50}, {'k': 'e', 't': 'IWM', 'w': 40}, {'k': 's', 't': 'NVDA', 'w': 10}])
            ATLASI_ov = await pg.evaluate("ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:%s,tab:'doctor'};ATLASI.openExplore({kind:'sec',ref:'Tecnología'});new Promise(r=>setTimeout(()=>{document.querySelector('[data-xs]').click();setTimeout(()=>r(document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('.xc *,#ovcard *')].some(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+1})),2500)},2000))" % json.dumps(REF))
            r['overflow'] = ATLASI_ov
            r['smoke'] = await pg.evaluate(SMOKE)
            await pg.wait_for_timeout(1000); r['errs'] = errs; res[name] = r
            await ctx.close()
        await b.close()
    srv.shutdown()
    fails = []
    def ok(c, n):
        print(('  OK   ' if c else '  FALLA ') + n)
        if not c: fails.append(n)
    M = res['escritorio']['main']
    print('== Hoy')
    ok(M['empty']['contrib'] is None and M['empty']['state'] == 'none', 'cartera vacía → sin contribución, sin errores')
    A = M['amounts']; ok(A['eur'] and A['sumEur'] and A['sumR'], 'con importes: euros por producto que suman exactamente el movimiento')
    ok(M['weights']['eur'] is None and M['weights']['sumR'], 'solo pesos: solo %, sin euros inventados')
    ok(A['pos'] == ['AGG', 'VT'] and A['neg'] == ['QQQ'], f"contribución positiva {A['pos']} y negativa {A['neg']}")
    ok(A['missing'] == ['IWM'], 'producto sin precio → listado aparte, cuenta como 0 %')
    ok(A['q'] == ['real'], 'contribución por producto etiquetada DATO')
    St = M['states']; ok(St == {'open': 'live', 'stale': 'stale', 'closedWeekend': 'close', 'delayed': 'delayed'}, f'estados de datos: {St}')
    I = M['impact']
    ok(I['full']['exact'] and I['full']['q'] == 'DATA' and I['full']['bound'] is None, 'exposición completa (acción directa) → DATO, sin cota')
    ok(not I['partial']['exact'] and I['partial']['q'] == 'ESTIMATE' and I['partial']['bound'] == 'lower' and I['partial']['products'] >= 2, f"exposición parcial (NVIDIA en QQQ+SMH+directa) → ESTIMACIÓN, cota inferior, {I['partial']['products']} de {I['partial']['of']} productos")
    for n in ('escritorio', 'móvil'):
        T = res[n]['today']
        ok(T.get('imp') and 'al menos' in T['imp'] and 'Estimación' in T['imp'] and 'mínima garantizada' in T['imp'] and 'puede ser mayor' in T['imp'], f'{n}: Hoy explica el impacto con cota inferior → {(T.get("imp") or "")[:150]!r}')
        ok(T.get('day') and 'explica' in T['day'] and '≥' in T['day'], f'{n}: línea plegada → {T.get("day")!r}')
        ok(T.get('acts') == ['Ver exposición', 'Simular', 'Preguntar'], f'{n}: acciones {T.get("acts")}')
    print('== Explorar cambios')
    X = M['ideas']
    ok(X['n'] >= 6 and set(X['kinds']) >= {'sec', 'ovl'}, f"ideas para {X['n']} puntos de partida; problemas del Doctor: {X['kinds']}")
    ok(all(i['det'] for i in X['all']), 'ideas() determinista')
    ok(all(i['keep'] for i in X['all']), '«Mantener sin cambios» siempre presente')
    ok(all(i['alpha'] for i in X['all']), 'productos en orden alfabético (el orden no lo decide una métrica)')
    ok(all(i['fixedSizes'] for i in X['all']), 'operaciones de tamaño fijo (−10 pp / quitar): el motor no busca un tamaño «óptimo»')
    ok(all(i['addNeedsCrit'] for i in X['all']), 'las adiciones no traen criterio por defecto')
    ok(not X['forbiddenKeys'], f"sin campos best/top/score/winner/rank {X['forbiddenKeys']}")
    Tr = M['trade']; ok(Tr['someWorsen'] and Tr['someImprove'] and Tr['mixedNarr'], f"{Tr['n']} escenarios del problema tecnológico: aparecen mejoras, empeoramientos y lecturas «a cambio»")
    U = M['ui']
    ok(U['tab'] and 'no selecciona una opción ganadora' in (U['head'] or '') and U['rows'] >= 3 and not U['opt'], 'pestaña Explorar cambios con aviso; Optimizar sigue oculto')
    ok(U['listBeforeCrit'] == 0 and U['critShown'] >= 4 and U['listAfterCrit'] >= 1, f"adiciones: sin criterio no hay lista; con «menor coste» {U['listAfterCrit']} candidatos («{U['orderLabel'][:60]}…»)")
    ok(U['hasRead'] and U['chips'] >= 5, 'escenario: lectura + métricas con su calidad')
    ok('25,0 % → 15,0 %' in (U['parsed'] or ''), f"«reduce Nasdaq al 15 %» desde la interfaz → {U['parsed']!r}")
    ok('puntos porcentuales' in (U['askQ'] or '') and '−10,0 pp' in (U['askRes'] or ''), f"pregunta de ambigüedad y respuesta → {U['askRes']!r}")
    ok(U['dxLinks'] >= 1 and U.get('fromDx'), f"{U['dxLinks']} problemas del Doctor enlazan a Explorar cambios con el problema preseleccionado")
    print('== Salud y trade-offs')
    H = M['health']
    ok(H['volCls'] == 'changes' and H['rkCls'] in ('changes', None) and H['healthCls'] in ('changes', None), f"bajar volatilidad solo «cambia» (vol {H['volCls']}, riesgo {H['rkCls']}, salud total {H['healthCls']})")
    ok(H['topPosCls'] in ('changes', None) and H['narrow'], f"mayor posición neutra ({H['topPosCls']}); métrica direccional de productos sueltos/temáticos presente")
    ok(dict((k, d) for k, d, _ in H['dims']) == {'dim:dv': 'up', 'dim:cn': 'up', 'dim:rk': 'neutral', 'dim:co': 'up'}, f"4 dimensiones independientes {H['dims']}")
    ok(H['agVol'][1] < H['agVol'][0] and H['agVol'][2] == 'changes' and H['agHealth'][2] != 'improves', f"VT + 30 % bonos: volatilidad {H['agVol'][0]:.1f} → {H['agVol'][1]:.1f} sin presentarse como «mejor»")
    print('       lectura «Reduce Nasdaq al 15 %»:', ' '.join(H['narr15']))
    print('== Lenguaje')
    texts = M['texts'] + [res[n]['today'].get('txt', '') for n in res]
    hits = sorted({t[:120] for t in texts if FORBID.search(t)})
    ok(not hits, f'{len(texts)} textos generados (ideas, títulos, lecturas, Hoy, interfaz); expresiones de recomendación: {hits[:4]}')
    print('== Pantallas, 390 px y errores')
    for n in res:
        sm = res[n]['smoke']; ok(all(v == 'ok' for v in sm.values()) and not res[n]['errs'], f'{n}: {len(sm)} pantallas sin errores JS {[k for k, v in sm.items() if v != "ok"]} {res[n]["errs"][:2]}')
        ok(res[n]['overflow'] is False, f'{n}: sin desbordamiento horizontal en Hoy y Explorar cambios')
    ok(M['usage'].get('c', {}).get('scenario_open', 0) >= 2 and 'amount' not in json.dumps(M['usage']), f"instrumentación local: {M['usage'].get('c')}")
    print('== Rendimiento (ms)')
    for n in res:
        print(f"  {n:10s} carga {res[n]['load']} · " + ' · '.join(f'{k} {v}' for k, v in res[n]['perf'].items()))
    print('\nRESULTADO:', 'OK' if not fails else f'{len(fails)} FALLOS'); return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
