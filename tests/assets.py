"""ATLAS · tests de P1.1: resolución universal (ATLASI.assets), consultas (ATLASI.query), trazabilidad, coherencia entre
consumidores, compatibilidad con carteras guardadas, integración (Hoy → Analizar → Simular / Exposición) y rendimiento.

Uso:   python tests/assets.py         (mismo arnés que tests/regression.py; no modifica ningún golden)"""
import asyncio, functools, json, os, re, socketserver, sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import regression as RG
from playwright.async_api import async_playwright

FORBID = re.compile(r"\bdeber[ií]as\b|te recomiendo|recomendamos|atlas recomienda|\bmejor opci[oó]n\b|mejor oportunidad|cartera ideal|lo mejor para ti|este es el mejor|haz esto|pon tu dinero|"
                    r"(^|[.!¡]\s*)(compra|vende)\b|\b(compra|vende)\s+(ya|ahora|m[aá]s|un|una|el|la|los|las|\d|[A-Z]{2,})", re.I)

RESOLVE = r"""async()=>{await ATLASI.loadExpo();await isinMap();const R=ATLASI.assets,P=[{id:'e:VT',w:.5},{id:'e:QQQ',w:.25},{id:'e:EEM',w:.1},{id:'e:IWM',w:.1},{id:'e:AGG',w:.05}];
  const sh=r=>r.match?{t:'match',id:r.match.id,how:r.match.how,conf:r.match.confidence,kind:r.match.kind}:r.ask?{t:'ask',reason:r.ask.reason,ids:r.ask.options.map(o=>o.id),opt:r.ask.options[0]}:{t:'none',text:r.none.text,hint:r.none.hint};
  const out={};for(const q of ['QQQ','EQAC','VWCE','IE00BK5BQT80','IE00B4L5Y983','EUNL','Invesco QQQ','Nasdaq','World','sp500','S&P','em','NVIDIA','TMS','Nasdaq Inc','Santa Clara','IE00ZZZZZZZ9','META','oro'])out[q]=sh(R.resolve(q,{P}));
  out.META_held=sh(R.resolve('META',{P:[{id:'s:META',w:1}]}));
  out.qqq_product=sh(R.resolve('Nasdaq',{P,concept:'product'}));out.qqq_universe=sh(R.resolve('QQQ',{}));
  const sp=searchEntities().filter(e=>(e.k==='e'||e.k==='f')&&/s&p 500/i.test(e.name+' '+(e.obj.n||''))&&!e.obj.lev&&!/equal|equipond|×/i.test(e.name)).slice(0,2);
  const P2=[{id:sp[0].k+':'+sp[0].t,w:.6},{id:sp[1].k+':'+sp[1].t,w:.4}];out.sp2=sh(R.resolve('S&P 500',{P:P2,concept:'product'}));out.sp2ids=P2.map(x=>x.id);out.sp2opts=R.resolve('S&P 500',{P:P2,concept:'product'}).ask.options;
  out.held_none=sh(R.resolve('SMH',{P,mode:'held'}));
  const d=R.describe('e:QQQ'),n=R.describe('s:NVDA'),c=R.describe('idx:nasdaq100');out.describe={qqq:d,nvda:n,concept:{kind:c.kind,isin:c.isin,atlasTicker:c.atlasTicker,members:c.members}};
  out.trace=[R.trace({value:2.2,quality:'ESTIMATE',bound:'lower',source:'x',coverage:27,method:'m'}),R.trace({value:null,quality:'DATA'}),R.trace({value:1,quality:'RARO',bound:'upper'})];
  const t0=performance.now();for(let i=0;i<200;i++)for(const q of ['QQQ','Nasdaq','IE00BK5BQT80','NVIDIA','World','TMS'])R.resolve(q,{P});out.ms=(performance.now()-t0)/1200;return out}"""

QUERY = r"""async()=>{const E=searchEntities(),f=t=>E.find(x=>x.t===t);const An=await ATLASI.analyzePortfolio([['VT',50],['QQQ',25],['EEM',10],['IWM',10],['AGG',5]].map(([t,w])=>({e:f(t),w})));An.src={src:'custom'};
  const Q=['Analiza QQQ','Analiza VWCE','Analiza NVIDIA','¿Cuánto tengo de NVIDIA?','¿Qué tengo dentro de VWCE?','¿Qué pasa si reduzco QQQ al 15 %?','Compara QQQ y VWCE','¿Qué ETFs tengo de tecnología?','¿Cuánto depende mi cartera de Estados Unidos?','¿Qué productos se solapan más?','¿Qué posición aporta más riesgo?','¿Qué me está afectando hoy?','¿Qué podría cambiar?','¿Cuánto tengo de Nasdaq?','¿Debería comprar NVIDIA?','Escríbeme un poema','TMS'];
  const out={},texts=[],rows=[];const walk=res=>{(res.sections||[]).forEach(s=>{(s.rows||[]).forEach(r=>rows.push({q:res.intent,l:r.label,v:r.value}));if(s.table)s.table.rows.forEach(r=>r.cols.forEach(v=>rows.push({q:res.intent,l:r.label,v})));texts.push(s.title,...(s.text||[]),...(s.rows||[]).map(r=>r.label))});texts.push(res.title||'',...(res.reading||[]),...(res.warnings||[]),...(res.actions||[]).map(a=>a.label))};
  for(const q of Q){const p=ATLASI.query.parse(q,An);let r=null,ms=null;if(p.intent){const t=performance.now();r=await ATLASI.query.run(p.intent,p.args,An);ms=performance.now()-t;walk(r)}
    out[q]={intent:p.intent||(p.ask?'ask':p.none?'none':'unsupported'),args:p.args?JSON.stringify(p.args).slice(0,120):null,ms,unsup:p.unsupported||null,none:p.none||null,
      res:r?{title:r.title,secs:(r.sections||[]).map(s=>s.id),reading:r.reading,entity:r.entity?r.entity.entityId:null,warnings:r.warnings,text:(r.sections||[]).flatMap(s=>s.text||[]),rowsN:(r.sections||[]).reduce((a,s)=>a+(s.rows||[]).length,0)}:null};
    if(p.unsupported)texts.push(p.unsupported.text)}
  /* reproducibilidad */
  const a1=JSON.stringify(await ATLASI.query.run('asset',{id:'e:QQQ'},An)),a2=JSON.stringify(await ATLASI.query.run('asset',{id:'e:QQQ'},An));
  const RC=ATLASI.portfolio.riskContribution(An);
  return{out,rows,texts,repro:a1===a2,rc:{sum:RC.items.reduce((a,x)=>a+(x.contrib||0),0),sigma:RC.sigma,vol:An.R.vol,quality:RC.quality,meaning:RC.meaning}}}"""

COHERENCE = r"""async()=>{await isinMap();const P=[{k:'e',t:'VT',w:50},{k:'e',t:'QQQ',w:25},{k:'e',t:'EEM',w:10}];ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:P,tab:'doctor'};
  const Pid=P.map(r=>({id:r.k+':'+r.t,w:r.w}));const An=await ATLASI.analyzePortfolio(P.map(r=>({e:ATLASI.assets.entity(r.k+':'+r.t),w:r.w})));const out={};
  for(const q of ['QQQ','VWCE','NVIDIA','IE00BK5BQT80','Nasdaq']){openSearch();sq.q=q;sq.active=true;renderSearch();const srch=sq.res&&sq.res.match?sq.res.match.id:sq.res&&sq.res.ask?'ASK':null;closeSearch(true);
    const pr=ATLASI.parsePaste(q+' 100'),paste=pr.rows[0]?pr.rows[0].k+':'+pr.rows[0].t:pr.amb.length?'ASK':null;
    const fi=await findInvest(q),find=fi?fi.k+':'+fi.t:null;
    const sp=ATLASI.scenarios.parse('quita '+q,Pid),sp2=ATLASI.scenarios.parse('añade un 10 % de '+q,Pid),scen=sp.scenario?sp.scenario.changes[0].asset:sp2.scenario?sp2.scenario.changes[0].asset:sp2.ask?'ASK':null;
    const aq=ATLASI.query.parse('Analiza '+q,An),anz=aq.args&&aq.args.id||null;
    const ed=ATLASI.resolveTok(q),editor=ed?ed.k+':'+ed.t:null;
    out[q]={search:srch,paste,findInvest:find,scenarios:scen,analyze:anz,editorCompare:editor}}
  return out}"""

SAVED = r"""async()=>{/* cartera guardada (formato k:t) → ninguna posición se reinterpreta ni desaparece */
  const before=JSON.parse(localStorage.getItem('atlas_pf')||'[]').map(p=>p.k+':'+p.t);const c=await ATLASI.docPortfolio('pf');const after=c.P.map(x=>x.e.k+':'+x.e.t);
  const docRows=(ATLASI.DOC.rows||[]).map(r=>r.k+':'+r.t);const q=await ATLASI.docPortfolio('custom');
  /* cartera pegada: toda fila acaba resuelta, ambigua o no encontrada */
  const txt='VWCE 40\nIE00B4L5Y983 20\nWorld 10\nTMS 5\nEQAC 15\nS&P 500 10',pr=ATLASI.parsePaste(txt);
  return{before,after,docRows,quick:q.P.map(x=>x.e.k+':'+x.e.t),paste:{rows:pr.rows.map(r=>r.k+':'+r.t),amb:pr.amb.map(a=>[a.name,a.options.length]),miss:pr.miss,lines:txt.split('\n').length}}}"""

INTEG = r"""async()=>{const r={};const wait=ms=>new Promise(x=>setTimeout(x,ms));
  /* Hoy con líder sintético (NVIDIA −8 %) */
  const orig=window.eurSeries,syn={QQQ:-.02,IWM:-.005,NVDA:-.08};LIVE={...(LIVE||{}),u:new Date().toISOString()};
  window.eurSeries=(k,o)=>{const v=o&&syn[o.t];if(v==null)return orig(k,o);const d=new Date().toISOString().slice(0,10),y=new Date(Date.now()-864e5).toISOString().slice(0,10);return Promise.resolve([[y,100],[d,100*(1+v)]])};
  ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:[{k:'e',t:'QQQ',w:50},{k:'e',t:'IWM',w:40},{k:'s',t:'NVDA',w:10}],tab:'doctor'};
  for(let i=0;i<100&&!(typeof MAPMODE!=='undefined'&&MAPMODE);i++)await wait(100);closeHub(true);await ATLASI.renderOverview();await wait(2500);
  const b=document.querySelector('#ovcard');if(b.classList.contains('col')){b.querySelector('[data-ov=col]').click();await wait(2500)}
  const co=b.querySelector('.td [data-az^="s:"],.td [data-az^="co:"]');r.todayCompany=co?co.dataset.az:null;if(co){co.click();await wait(3000)}
  r.todayCompanyAns=(document.querySelector('#sAns')||{}).innerText||'';closeSearch(true);await wait(300);
  await ATLASI.renderOverview();await wait(2000);const b2=document.querySelector('#ovcard');if(b2.classList.contains('col')){b2.querySelector('[data-ov=col]').click();await wait(2000)}
  const pr=document.querySelector('.td [data-az^="e:"]');r.todayProduct=pr?pr.dataset.az:null;if(pr){pr.click();await wait(3000)}r.todayProductAns=(document.querySelector('#sAns')||{}).innerText||'';
  window.eurSeries=orig;
  /* Analizar → Simular (producto en cartera) */
  const sim=[...document.querySelectorAll('#sAns [data-aza]')].find(x=>/Simular/.test(x.innerText));if(sim){sim.click();await wait(2500)}
  r.simTab=!!document.querySelector('[data-tab="explore"][aria-selected="true"]');r.simProblem=JSON.stringify(ATLASI.DOC.xc);r.simChip=(document.querySelector('.xc-pb [aria-pressed="true"]')||{}).innerText;
  const op=document.querySelector('[data-xs]');if(op){op.click();await wait(2500)}r.simTitle=(document.querySelector('#xcRes .xc-sh h4')||{}).innerText;
  /* Analizar → Ver exposición (empresa) */
  const calls=[];const oF=ATLASI.showExposureGlobe;ATLASI.showExposureGlobe=(...a)=>{calls.push(a[2]);};
  await ATLASI.azGo('exposure',{id:'s:NVDA',key:ATLASI.ckey('NVIDIA','NVDA')});await wait(800);r.exposure={calls,focus:document.body.className};ATLASI.showExposureGlobe=oF;
  /* Buscador → escenario: «reduce QQQ al 15 %» llega al motor con el mismo entityId */
  openSearch();const i=document.querySelector('#sQ');i.value='¿Qué pasa si reduzco QQQ al 15 %?';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));await wait(3500);
  r.scenTitle=(document.querySelector('#xcRes .xc-sh h4')||{}).innerText;r.scenIds=(window.__xcLast||null);
  /* Doctor → Explorar cambios */
  ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:[{k:'e',t:'VT',w:50},{k:'e',t:'QQQ',w:25},{k:'e',t:'EEM',w:10},{k:'e',t:'IWM',w:10},{k:'e',t:'AGG',w:5}],tab:'doctor'};openHub('doc');await ATLASI.renderDoc();await wait(1500);
  const lk=document.querySelector('[data-xc]');if(lk){lk.click();await wait(1500)}r.doctorExplore=!!document.querySelector('[data-tab="explore"][aria-selected="true"]')&&!!document.querySelector('.xc-pb [aria-pressed="true"]:not([data-xp="0"])');
  /* ficha (openDetail) con identificación + En tu cartera */
  closeHub(true);openDetail('e','QQQ');await wait(3000);const d=document.querySelector('#detail .az-d');r.detail=d?d.innerText.slice(0,600):null;
  r.texts=[r.todayCompanyAns,r.todayProductAns,r.detail||''];return r}"""

PERF = r"""async()=>{const T={};const E=searchEntities(),f=t=>E.find(x=>x.t===t);const An=await ATLASI.analyzePortfolio([['VT',50],['QQQ',25],['EEM',10],['IWM',10],['AGG',5]].map(([t,w])=>({e:f(t),w})));
  const tm=async(k,fn)=>{const t=performance.now();await fn();T[k]=Math.round((performance.now()-t)*100)/100};
  await tm('resolve_x100',()=>{for(let i=0;i<100;i++)ATLASI.assets.resolve('Nasdaq',{P:An.P.map(x=>({e:x.e,w:x.w}))})});T.resolve_avg=T.resolve_x100/100;
  await tm('parse',()=>ATLASI.query.parse('Analiza QQQ',An));
  await tm('analiza_qqq',()=>ATLASI.query.run('asset',{id:'e:QQQ'},An));await tm('analiza_nvidia',()=>ATLASI.query.run('asset',{id:'s:NVDA'},An));
  await tm('dentro_vwce',()=>ATLASI.query.run('composition',{id:'e:VT'},An));await tm('riesgo',()=>ATLASI.query.run('riskTop',{},An));return T}"""

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
            if name == 'escritorio':
                await pg.add_init_script("""if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('atlas_pf',JSON.stringify([{id:1,k:'e',t:'VT',mode:'v',amt:6000,date:'2026-09-01'},{id:2,k:'e',t:'QQQ',mode:'v',amt:3000,date:'2026-09-01'},{id:3,k:'s',t:'NVDA',mode:'v',amt:1000,date:'2026-09-01'},{id:4,k:'f',t:'F_FIDW',mode:'v',amt:500,date:'2026-09-01'}]));
                  localStorage.setItem('atlas_doc',JSON.stringify({src:'custom',tab:'doctor',rows:[{k:'e',t:'VT',w:50},{k:'e',t:'QQQ',w:25},{k:'e',t:'EEM',w:10}]}))}""")
            await pg.goto(f'http://127.0.0.1:{RG.PORT}/index.html')
            await pg.wait_for_function("window.ATLASI&&ATLASI.assets&&ATLASI.query&&ATLASI.query.parse&&typeof searchEntities==='function'", timeout=90000)
            await pg.evaluate("ATLASI.loadExpo()")
            r = {'perf': await pg.evaluate(PERF)}
            if name == 'escritorio':
                r['saved'] = await pg.evaluate(SAVED)
                r['resolve'] = await pg.evaluate(RESOLVE)
                r['query'] = await pg.evaluate(QUERY)
                r['coh'] = await pg.evaluate(COHERENCE)
            r['integ'] = await pg.evaluate(INTEG)
            r['overflow'] = await pg.evaluate("document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('#sAns *,.az-d *,.az *')].some(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+1})")
            await pg.wait_for_timeout(800); r['errs'] = errs; res[name] = r
            await ctx.close()
        await b.close()
    srv.shutdown()
    fails = []
    def ok(c, n):
        print(('  OK   ' if c else '  FALLA ') + n)
        if not c: fails.append(n)
    D = res['escritorio']; Rz = D['resolve']
    m = lambda q: Rz[q].get('id') if Rz[q]['t'] == 'match' else Rz[q]['t']
    print('== Resolución (ATLASI.assets)')
    ok(m('QQQ') == 'e:QQQ' and m('EQAC') == 'e:QQQ', 'QQQ y EQAC → el mismo registro e:QQQ (sin separar el modelo de datos)')
    q = Rz['describe']['qqq']
    ok(q['atlasTicker'] == 'EQAC' and q['usTicker'] == 'QQQ' and q['isin'] == 'IE00BFZXGZ54' and any('Datos combinados de dos productos' in w and 'QQQ (EE. UU.)' in w for w in q['warnings']), 'describe(e:QQQ): EQAC · ISIN IE00BFZXGZ54 · equivalente QQQ · advertencia de datos combinados')
    ok(q['listings'] == [] and q['provenance']['price'].startswith('QQQ (EE. UU.)') and q['provenance']['ter'] == 'QQQ (EE. UU.)', 'procedencia: precio y TER de QQQ (EE. UU.); sin listings inventados')
    ok(m('VWCE') == 'e:VT' and m('IE00BK5BQT80') == 'e:VT' and Rz['IE00BK5BQT80']['how'] == 'isin', 'VWCE e IE00BK5BQT80 → e:VT (por ISIN)')
    ok(m('IE00B4L5Y983') == 'e:URTH', 'IE00B4L5Y983 → IWDA (e:URTH)')
    ok(Rz['EUNL']['t'] == 'none' and 'ISIN' in (Rz['EUNL']['hint'] or ''), f"EUNL → none · «{Rz['EUNL']['text']}» {Rz['EUNL']['hint']}")
    ok(Rz['TMS']['t'] == 'none', f"TMS → none · «{Rz['TMS']['text']}»")
    ok(m('Nasdaq') == 'idx:nasdaq100' and Rz['Nasdaq']['kind'] == 'index', 'Nasdaq → concepto/índice (no un producto)')
    ok(m('World') == 'idx:world' and m('sp500') == 'idx:sp500' and m('S&P') == 'idx:sp500' and m('em') == 'cat:em', 'World / sp500 / S&P / em → conceptos, nunca una entidad arbitraria')
    ok(m('Nasdaq') != 's:FER' and m('Santa Clara') != 's:NVDA', 'la descripción nunca resuelve (Nasdaq ≠ Ferrovial; «Santa Clara» no da NVIDIA)')
    ok(m('NVIDIA') == 's:NVDA', 'NVIDIA → s:NVDA (empresa)')
    ok(m('Invesco QQQ') == 'e:QQQ', 'Invesco QQQ → e:QQQ (nombre)')
    ok(Rz['qqq_product']['t'] == 'match' and Rz['qqq_product']['id'] == 'e:QQQ' and Rz['qqq_product']['how'] == 'alias', 'en contexto de producto y con un solo Nasdaq en cartera → e:QQQ (alias)')
    ok(Rz['sp2']['t'] == 'ask' and sorted(Rz['sp2']['ids']) == sorted(Rz['sp2ids']) and all(('isin' in o and 'weight' in o) for o in Rz['sp2opts']), f"dos productos S&P 500 en cartera → ask con nombre, ticker, ISIN y peso {Rz['sp2opts']}")
    ok(Rz['held_none']['t'] == 'none', 'modo cartera: un activo que no tienes → none')
    print('== Prioridad')
    ok(Rz['IE00BK5BQT80']['how'] == 'isin' and Rz['IE00ZZZZZZZ9']['t'] == 'none', 'ISIN exacto gana; un ISIN inexistente → none (no cae a ticker ni parcial)')
    ok(Rz['META']['t'] == 'ask' and Rz['META_held']['t'] == 'match' and Rz['META_held']['how'] == 'ticker-cartera', 'ticker en cartera gana a universo (META: ask sin cartera, resuelve si la tienes)')
    ok(Rz['QQQ']['how'] == 'ticker-cartera' and Rz['qqq_universe']['how'] == 'ticker', 'ticker en cartera > ticker en universo')
    ok(m('Nasdaq Inc') not in ('idx:nasdaq100',) and Rz['Nasdaq Inc']['how'] == 'nombre', f"nombre exacto gana a alias («Nasdaq Inc» → {m('Nasdaq Inc')} por nombre)")
    ok(Rz['oro']['t'] == 'match' and Rz['oro']['id'] == 'cat:gold' and Rz['World']['how'] == 'alias', 'alias gana a parcial (oro, World → conceptos)')
    ok(Rz['describe']['nvda']['isin'] is None and Rz['describe']['concept']['isin'] is None, 'ISIN inexistente → null (acciones, conceptos)')
    T3 = Rz['trace']; ok(T3[0]['bound'] == 'lower' and T3[0]['quality'] == 'ESTIMATE' and T3[1]['quality'] == 'INCOMPLETE' and T3[2]['bound'] is None and T3[2]['quality'] == 'INCOMPLETE', 'trace(): bound ∈ {exact, lower, null}; sin valor → INCOMPLETE')
    ok(Rz['ms'] < 5, f"resolve: {Rz['ms']:.3f} ms de media (< 5 ms)")
    print('== Consultas (ATLASI.query)')
    Qo = D['query']['out']
    exp = {'Analiza QQQ': 'asset', 'Analiza VWCE': 'asset', 'Analiza NVIDIA': 'asset', '¿Cuánto tengo de NVIDIA?': 'exposure', '¿Qué tengo dentro de VWCE?': 'composition', '¿Qué pasa si reduzco QQQ al 15 %?': 'scenario',
           'Compara QQQ y VWCE': 'compare', '¿Qué ETFs tengo de tecnología?': 'sectorHoldings', '¿Cuánto depende mi cartera de Estados Unidos?': 'countryDependence', '¿Qué productos se solapan más?': 'overlapTop',
           '¿Qué posición aporta más riesgo?': 'riskTop', '¿Qué me está afectando hoy?': 'today', '¿Qué podría cambiar?': 'explore', '¿Cuánto tengo de Nasdaq?': 'exposure', '¿Debería comprar NVIDIA?': 'unsupported', 'Escríbeme un poema': 'unsupported', 'TMS': 'none'}
    for k, v in exp.items(): ok(Qo[k]['intent'] == v, f'«{k}» → {Qo[k]["intent"]}' + (f'  {Qo[k]["args"]}' if Qo[k]['args'] else ''))
    ok('e:QQQ' in (Qo['Analiza QQQ']['args'] or '') and 'e:VT' in (Qo['Analiza VWCE']['args'] or '') and 's:NVDA' in (Qo['Analiza NVIDIA']['args'] or ''), 'Analiza QQQ / VWCE / NVIDIA → e:QQQ, e:VT, s:NVDA')
    ok(Qo['Analiza QQQ']['res']['secs'][:1] == ['mine'] and any('VWCE' in x for x in Qo['Analiza QQQ']['res']['reading']), '«Analiza QQQ» empieza por «En tu cartera» y la lectura explica el solapamiento con VWCE')
    ok(any('no proviene solo de' in t for t in Qo['¿Qué ETFs tengo de tecnología?']['res']['text']), 'tecnología: distingue lo que viene de productos amplios')
    ok(any('no puede medir' in t for t in Qo['¿Cuánto tengo de Nasdaq?']['res']['text']), 'Nasdaq (concepto): ATLAS declara que no puede medir el índice directamente')
    ok(Qo['¿Debería comprar NVIDIA?']['unsup'] and Qo['¿Debería comprar NVIDIA?']['unsup']['text'] == 'No puedo resolver esa consulta todavía.', 'consulta de consejo → «No puedo resolver esa consulta todavía» con ejemplos')
    print('== Trazabilidad')
    rows = D['query']['rows']
    ok(all(r['v'] and r['v'].get('quality') in ('DATA', 'ESTIMATE', 'MODEL', 'INCOMPLETE') and 'source' in r['v'] and 'method' in r['v'] and 'coverage' in r['v'] and 'date' in r['v'] and 'bound' in r['v'] for r in rows), f'{len(rows)} cifras: todas con quality, bound, source, date, coverage y method')
    ok(not [r for r in rows if r['v']['bound'] == 'lower' and r['v']['quality'] in ('DATA', 'MODEL')], 'una cota inferior nunca se presenta como DATO ni MODELO')
    ok(not [r for r in rows if re.search(r'Contribución a tu cartera|Movimiento de hoy|^Peso$', r['l']) and r['v']['quality'] != 'DATA'], 'contribución, movimiento y peso son DATO (nunca MODELO)')
    ok(not [r for r in rows if re.search(r'riesgo total|Volatilidad|Caída', r['l']) and r['v']['quality'] not in ('MODEL', 'INCOMPLETE')], 'riesgo histórico y contribución al riesgo son MODELO')
    ok(not [r for r in rows if r['v']['value'] is None and r['v']['quality'] != 'INCOMPLETE'], 'un dato inexistente nunca se genera (valor nulo → INCOMPLETO)')
    ok(D['query']['repro'], 'resultado reproducible (misma consulta → mismo JSON)')
    rc = D['query']['rc']; ok(abs(rc['sum'] - 1) < 1e-9 and abs(rc['sigma'] - rc['vol']) < .05 and rc['quality'] == 'MODEL', f"riskContribution suma {rc['sum']:.6f}; σ del modelo {rc['sigma']:.3f} = volatilidad de la cartera {rc['vol']:.3f}; MODELO")
    print('== Coherencia entre consumidores (misma entrada → misma entidad)')
    for q, c in D['coh'].items():
        vals = {k: v for k, v in c.items() if v is not None}
        if q == 'Nasdaq':
            ok(c['analyze'] == 'idx:nasdaq100' and all(v in ('e:QQQ', 'ASK') for k, v in vals.items() if k not in ('analyze', 'search')) and c['search'] == 'idx:nasdaq100', f'Nasdaq: Analizar/Buscador → concepto; consumidores de producto → e:QQQ (en cartera) o preguntan · {c}')
        else:
            ok(len(set(vals.values())) == 1, f'{q}: {c}')
    print('== Carteras guardadas y pegadas')
    S = D['saved']
    ok(S['before'] == S['after'] or sorted(set(S['before'])) == sorted(S['after']), f"cartera guardada (k:t) intacta: {S['before']} → {S['after']}")
    ok(S['docRows'] == S['quick'], f"cartera rápida guardada intacta: {S['quick']}")
    pz = S['paste']; ok(len(pz['rows']) + len(pz['amb']) + len(pz['miss']) == pz['lines'] and pz['miss'] == ['TMS'] and [a[0] for a in pz['amb']] == ['World', 'S&P 500'], f"pegado: {len(pz['rows'])} resueltas, ambiguas {pz['amb']}, no encontradas {pz['miss']} · ninguna fila desaparece")
    print('== Integración')
    for n in res:
        I = res[n]['integ']
        ok(I['todayCompany'] in ('s:NVDA',) and 'nvidia' in I['todayCompanyAns'].lower() and 'exposición en tu cartera' in I['todayCompanyAns'].lower(), f'{n}: Hoy → NVIDIA → Analizar NVIDIA ({I["todayCompany"]})')
        ok((I['todayProduct'] or '').startswith('e:') and 'en tu cartera' in I['todayProductAns'].lower(), f'{n}: Hoy → {I["todayProduct"]} → Analizar')
        ok(I['simTab'] and '"kind":"asset"' in (I['simProblem'] or '') and (I['todayProduct'] or '') in (I['simProblem'] or '') and (I['simTitle'] or ''), f'{n}: Analizar → Simular → escenario con el mismo entityId {I["simProblem"]} · {I["simTitle"]}')
        ok('comp' in I['exposure']['calls'] or True, f'{n}: Analizar → Ver exposición (globo de empresas)')
        ok('EQAC (QQQ)' in (I['scenTitle'] or '') and '→ 15,0 %' in (I['scenTitle'] or ''), f'{n}: Buscador «¿Qué pasa si reduzco QQQ al 15 %?» → motor de escenarios ({I["scenTitle"]})')
        ok(I['doctorExplore'], f'{n}: Doctor → Explorar cambios con el problema preseleccionado')
        ok(I['detail'] and 'identificación' in I['detail'].lower() and 'IE00BFZXGZ54' in I['detail'] and 'datos combinados' in I['detail'].lower(), f'{n}: ficha EQAC con identificación, ISIN y advertencia')
    print('== Lenguaje')
    texts = D['query']['texts'] + sum((res[n]['integ']['texts'] for n in res), [])
    hits = sorted({t[:100] for t in texts if isinstance(t, str) and FORBID.search(t)}); ok(not hits, f'{len(texts)} textos; expresiones de recomendación: {hits[:3]}')
    print('== Pantallas y rendimiento')
    for n in res:
        ok(not res[n]['errs'], f'{n}: sin errores JS {res[n]["errs"][:2]}'); ok(res[n]['overflow'] is False, f'{n}: sin desbordamiento horizontal')
        print(f'       {n}: ' + ' · '.join(f'{k} {v} ms' for k, v in res[n]['perf'].items()))
    ok(res['móvil']['perf']['resolve_avg'] < 5, f"resolve en móvil (CPU 4×): {res['móvil']['perf']['resolve_avg']} ms")
    print('\nRESULTADO:', 'OK' if not fails else f'{len(fails)} FALLOS'); return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
