"""ATLAS · tests del motor de escenarios (ATLASI.scenarios, P0).

Uso:   python tests/scenarios.py            → ejecuta todo y compara con tests/scenarios_golden.json
       python tests/scenarios.py --update   → regenera los golden (solo tras revisar un cambio intencionado)

Reutiliza el arnés de tests/regression.py (servidor local + Playwright; ATLAS_CHROMIUM y ATLAS_NM opcionales).
No toca los golden ni las tolerancias de regression.py."""
import asyncio, functools, json, os, re, socketserver, sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import regression as RG
from playwright.async_api import async_playwright

ROOT = RG.ROOT
GOLD = ROOT / 'tests' / 'scenarios_golden.json'
REF = [['e:VT', .50], ['e:QQQ', .25], ['e:EEM', .10], ['e:IWM', .10], ['e:AGG', .05]]

# ---------------- parser: (frase, tipo esperado, comprobación) ----------------
# 'S' = escenario (type, primera operación esperada como subconjunto), 'A' = pregunta, 'E' = error, 'X' = exploración
PARSE = [
 ('Reduce Nasdaq al 15 %',                       'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .15}}),
 ('reduce Nasdaq del 25 al 10',                  'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .10, 'expectFrom': .25}}),
 ('reduce QQQ al 15%',                           'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .15}}),
 ('¿Qué pasa si reduzco Nasdaq del 25% al 15%?', 'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .15}}),
 ('baja QQQ hasta el 20 %',                      'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .20}}),
 ('reduce QQQ del 30 al 10',                     'S', {'type': 'reduce', 'op': {'op': 'set', 'asset': 'e:QQQ', 'to': .10, 'expectFrom': .30}}),
 ('aumenta VT del 50 al 60',                     'S', {'type': 'increase', 'op': {'op': 'set', 'asset': 'e:VT', 'to': .60}}),
 ('sube EEM al 15 %',                            'S', {'type': 'increase', 'op': {'op': 'set', 'asset': 'e:EEM', 'to': .15}}),
 ('pon AGG al 10 %',                             'S', {'type': 'set', 'op': {'op': 'set', 'asset': 'e:AGG', 'to': .10}}),
 ('reduce QQQ 10 puntos',                        'S', {'type': 'reduce', 'op': {'op': 'adjust', 'asset': 'e:QQQ', 'pp': -.10}}),
 ('reduce QQQ en 10 pp',                         'S', {'type': 'reduce', 'op': {'op': 'adjust', 'asset': 'e:QQQ', 'pp': -.10}}),
 ('reduce QQQ un 10 % relativo',                 'S', {'type': 'reduce', 'op': {'op': 'adjust', 'asset': 'e:QQQ', 'rel': -.10}}),
 ('aumenta EEM en 5 puntos porcentuales',        'S', {'type': 'increase', 'op': {'op': 'adjust', 'asset': 'e:EEM', 'pp': .05}}),
 ('quita QQQ',                                   'S', {'type': 'remove', 'op': {'op': 'remove', 'asset': 'e:QQQ', 'to': 'prorata'}}),
 ('elimina Nasdaq',                              'S', {'type': 'remove', 'op': {'op': 'remove', 'asset': 'e:QQQ'}}),
 ('quita el Nasdaq',                             'S', {'type': 'remove', 'op': {'op': 'remove', 'asset': 'e:QQQ'}}),
 ('quita Nasdaq y reparte entre World y emergentes', 'S', {'type': 'redistribute', 'op': {'op': 'remove', 'asset': 'e:QQQ', 'to': [{'asset': 'e:EEM', 'share': .5}, {'asset': 'e:VT', 'share': .5}]}}),
 ('Quita Nasdaq y reparte su peso entre World y Emerging Markets', 'S', {'type': 'redistribute', 'op': {'op': 'remove', 'asset': 'e:QQQ', 'to': [{'asset': 'e:EEM', 'share': .5}, {'asset': 'e:VT', 'share': .5}]}}),
 ('quita QQQ y reparte 60 % a VT y 40 % a EEM',  'S', {'type': 'redistribute', 'op': {'op': 'remove', 'asset': 'e:QQQ', 'to': [{'asset': 'e:EEM', 'share': .4}, {'asset': 'e:VT', 'share': .6}]}}),
 ('añade un 10% de emergentes',                  'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:EEM', 'w': .10, 'funding': 'prorata'}}),
 ('añade EEM al 10 %',                           'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:EEM', 'w': .10}}),
 ('añade un 10 % de GLD',                        'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:GLD', 'w': .10}}),
 ('añade GLD con un 5 %',                        'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:GLD', 'w': .05}}),
 ('añade un 10 % de GLD financiado de QQQ',      'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:GLD', 'w': .10, 'funding': 'e:QQQ'}}),
 ('añade un 10 % de bonos',                      'S', {'type': 'add', 'op': {'op': 'add', 'asset': 'e:AGG', 'w': .10}}),
 ('sustituye QQQ por VT',                        'S', {'type': 'replace', 'op': {'op': 'replace', 'from': 'e:QQQ', 'to': 'e:VT'}}),
 ('cambia IWM por EEM',                          'S', {'type': 'replace', 'op': {'op': 'replace', 'from': 'e:IWM', 'to': 'e:EEM'}}),
 ('mueve 10 % de QQQ a VT',                      'S', {'type': 'redistribute', 'op': {'op': 'shift', 'from': 'e:QQQ', 'amt': .10, 'to': [{'asset': 'e:VT', 'share': 1}]}}),
 ('mueve un 5 % de VT a AGG',                    'S', {'type': 'redistribute', 'op': {'op': 'shift', 'from': 'e:VT', 'amt': .05}}),
 ('los próximos 300 € a VT',                     'S', {'type': 'contrib', 'op': {'op': 'contrib', 'monthly': 300, 'months': 1, 'alloc': [{'asset': 'e:VT', 'share': 1}]}, 'noSell': True}),
 ('no quiero vender, quiero aportar 300 € a World', 'S', {'type': 'contrib', 'op': {'op': 'contrib', 'monthly': 300, 'alloc': [{'asset': 'e:VT', 'share': 1}]}, 'noSell': True}),
 ('No quiero vender. Los próximos 300 € al mes van a World durante 12 meses', 'S', {'type': 'contrib', 'op': {'op': 'contrib', 'monthly': 300, 'months': 12, 'alloc': [{'asset': 'e:VT', 'share': 1}]}, 'noSell': True}),
 ('aporto 500 € al mes a EEM durante 2 años',    'S', {'type': 'contrib', 'op': {'op': 'contrib', 'monthly': 500, 'months': 24}}),
 # ambigüedades → pregunta (nunca se adivina)
 ('reduce QQQ un 10 %',                          'A', 'puntos porcentuales'),
 ('quiero reducir tecnología',                   'A', 'exposición estimada a tecnología'),
 ('reduce QQQ',                                  'A', 'Hasta qué peso'),
 ('añade un 5 % de oro',                         'A', 'no es una recomendación'),
 ('añade EEM',                                   'A', 'Con qué peso'),
 ('los próximos 300 € al mes a VT',              'A', 'cuántos meses'),
 ('reduce el S&P al 10 %',                       'A', 'varios productos'),   # (cartera con dos S&P 500, ver DUP)
 # exploración abierta → sin elegir candidato
 ('¿Qué pasa si añado un ETF que apenas se solape con mi cartera?', 'X', 'overlap'),
 # errores
 ('hola',                                        'E', 'No he entendido'),
 ('compra NVDA',                                 'E', 'No he entendido'),
 ('quita ZZZZ',                                  'E', 'no está en la cartera'),
 ('quita QQQ y reparte 60 % a VT y 30 % a EEM',  'E', 'sumar 100'),
 ('añade un 10 % de XYZQW',                      'E', 'No encuentro'),
]
DUP = [['e:SPY', .5], ['e:VT', .3], ['e:F_FIDW', .2]]   # cartera auxiliar para la ambigüedad de dos productos del mismo índice (se rellena en JS)

JS = r"""async ({PARSE,REF,DUPX})=>{const S=ATLASI.scenarios,E=searchEntities(),ref=REF.map(([id,w])=>({id,w})),out={};const t0=performance.now();
  const strs=[];const grab=v=>{if(v==null)return;if(typeof v==='string')strs.push(v);else if(Array.isArray(v))v.forEach(grab);else if(typeof v==='object')Object.entries(v).forEach(([k,x])=>{if(k==='source'||k==='text'&&false)return;grab(x)})};
  /* cartera con dos productos S&P 500 para probar la ambigüedad */
  const sp=E.filter(e=>(e.k==='e'||e.k==='f')&&/s&p 500/i.test(e.name)&&!e.obj.lev&&!/equal|equipond|×|2x|3x|leveraged|ultra/i.test(e.name)).slice(0,2);
  const dup=[{id:sp[0].k+':'+sp[0].t,w:.5},{id:sp[1].k+':'+sp[1].t,w:.3},{id:'e:VT',w:.2}];
  /* 1 · parser */
  out.parse=PARSE.map(([f])=>{const P0=/S&P/.test(f)?dup:ref;let r;try{r=S.parse(f,P0)}catch(e){r={threw:String(e)}}grab(r.ask);grab(r.error);return r});
  /* resolveAsk encadenado: «reduce QQQ un 10 %» → pp ; «quiero reducir tecnología» → 30 % + sin vender */
  const a1=S.parse('reduce QQQ un 10 %',ref),r1=S.resolveAsk(JSON.parse(JSON.stringify(a1.ask.pending)),a1.ask.options[0].value);
  const a2=S.parse('quiero reducir tecnología',ref),r2a=S.resolveAsk(a2.ask.pending,a2.ask.options[0].value),r2=S.resolveAsk(r2a.ask.pending,true);
  const a3=S.parse('reduce el S&P al 10 %',dup),r3=S.resolveAsk(a3.ask.pending,a3.ask.options[1].value);
  out.resolve={r1:r1.scenario,r2:r2.scenario,r3:r3.scenario,sp:dup.map(x=>x.id)};
  /* 2 · invariantes de build en 6 carteras */
  const PS={ref,div:[['e:VT',.4],['e:EEM',.2],['e:IWM',.2],['e:AGG',.2]],falsa:[['e:VT',.25],['e:SPY',.25],['e:QQQ',.25],['e:SMH',.25]],conc:[['e:QQQ',1/3],['e:SMH',1/3],['s:NVDA',1/3]],uno:[['e:VT',1]],mix:[['e:VT',.6],['e:QQQ',.3],['s:NVDA',.1]]};
  out.inv={};for(const [k,L] of Object.entries(PS)){const P0=L.map(x=>Array.isArray(x)?{id:x[0],w:x[1]}:x),f=P0[0].id,big=P0.slice().sort((a,b)=>b.w-a.w)[0].id;
    const ops=[[{op:'set',asset:f,to:P0[0].w/2}],[{op:'adjust',asset:f,rel:-.3}],[{op:'remove',asset:f,to:'prorata'}],[{op:'add',asset:'e:GLD',w:.1,funding:'prorata'}],[{op:'replace',from:f,to:'e:EEM'}],[{op:'shift',from:big,amt:.05,to:'prorata'}],[{op:'contrib',monthly:300,months:12,alloc:[{asset:'e:VT',share:1}]}]];
    out.inv[k]=ops.map(ch=>{const b=S.build(P0,{...S.schema.emptyScenario(),type:'multi',changes:ch},{total:10000});return{valid:b.valid,codes:b.violations.map(v=>v.code),sum:b.P1.reduce((a,x)=>a+x.w,0),min:b.P1.length?Math.min(...b.P1.map(x=>x.w)):null,n:b.P1.length}})}
  /* 3 · operaciones exactas sobre la cartera de referencia */
  const sc=ch=>({...S.schema.emptyScenario(),type:'multi',changes:ch}),W=b=>Object.fromEntries(b.P1.map(x=>[x.id,x.w]));
  out.ops={reduce:W(S.build(ref,sc([{op:'set',asset:'e:QQQ',to:.15}]))),increase:W(S.build(ref,sc([{op:'set',asset:'e:VT',to:.6}]))),remove:W(S.build(ref,sc([{op:'remove',asset:'e:QQQ',to:'prorata'}]))),
    redistribute:W(S.build(ref,sc([{op:'remove',asset:'e:QQQ',to:[{asset:'e:VT',share:.6},{asset:'e:EEM',share:.4}]}]))),add:W(S.build(ref,sc([{op:'add',asset:'e:GLD',w:.1,funding:'prorata'}]))),
    addFrom:W(S.build(ref,sc([{op:'add',asset:'e:GLD',w:.1,funding:'e:QQQ'}]))),replace:W(S.build(ref,sc([{op:'replace',from:'e:QQQ',to:'e:VT'}]))),shift:W(S.build(ref,sc([{op:'shift',from:'e:QQQ',amt:.1,to:[{asset:'e:VT',share:1}]}]))),
    rel:W(S.build(ref,sc([{op:'adjust',asset:'e:QQQ',rel:-.1}]))),impossible:S.build(ref,sc([{op:'shift',from:'e:AGG',amt:.2,to:'prorata'}])),notHeld:S.build(ref,sc([{op:'remove',asset:'e:SMH',to:'prorata'}])),
    fromWarn:S.build(ref,sc([{op:'set',asset:'e:QQQ',to:.1,expectFrom:.3}])).warnings};
  /* 4 · aportaciones */
  const c12={...S.schema.emptyScenario(),type:'contrib',constraints:{noSell:true},changes:[{op:'contrib',monthly:300,months:12,alloc:[{asset:'e:VT',share:1}]}]};
  const vals={'e:VT':5000,'e:QQQ':2500,'e:EEM':1000,'e:IWM':1000,'e:AGG':500},inv={'e:VT':4000,'e:QQQ':2000,'e:EEM':1100,'e:IWM':900,'e:AGG':500};
  const mt=S.contrib.monthsTo(ref,{total:10000},[{asset:'e:VT',share:1}],300,'e:QQQ',.15);
  const atM=n=>S.build(ref,{...c12,changes:[{...c12.changes[0],months:n}]},{total:10000}).P1.find(x=>x.id==='e:QQQ').w;
  const noTot=await S.simulate(ref,c12,{});grab(noTot.ask);
  const sellNo=S.build(ref,{...S.schema.emptyScenario(),type:'remove',constraints:{noSell:true},changes:[{op:'remove',asset:'e:QQQ',to:'prorata'}]});
  const taxR=await S.simulate(ref,{...S.schema.emptyScenario(),type:'remove',changes:[{op:'remove',asset:'e:QQQ',to:'prorata'}]},{mode:'amounts',values:vals,inv});
  const taxW=await S.simulate(ref,{...S.schema.emptyScenario(),type:'remove',changes:[{op:'remove',asset:'e:QQQ',to:'prorata'}]},{});
  out.contrib={w12:W(S.build(ref,c12,{total:10000})),w12amounts:W(S.build(ref,c12,{values:vals})),months:mt,at:[atM(mt.months-1),atM(mt.months)],noTotal:{valid:noTot.valid,ask:!!noTot.ask,codes:noTot.violations.map(v=>v.code)},
    noSell:sellNo.violations.map(v=>v.code),tax:taxR.tax,taxW:taxW.tax,unreach:S.contrib.monthsTo(ref,{total:10000},[{asset:'e:QQQ',share:1}],300,'e:QQQ',.15)};grab(taxR.tax);grab(taxW.tax);
  /* 5 · coherencia con Doctor (escenario vacío) */
  const A0=await ATLASI.analyzePortfolio(ref.map(x=>({e:ATLASI.entBy(...x.id.split(':')),w:x.w})));const m0=ATLASI.metOf(A0);
  const em=await S.simulate(ref,S.schema.emptyScenario());const g=id=>{const r=em.metrics.find(x=>x.id===id);return r?r.before:null};
  out.coh={doc:{bets:m0.bets,health:m0.health,vol:m0.vol,dd:m0.dd,tech:A0.L.S['Tecnología']||0,us:A0.L.C.US||0,ter:A0.L.ter,top10:A0.SC.top10,topCo:A0.SC.top1,ovl:A0.SC.ovAvg},
    scn:{bets:g('bets'),health:g('health'),vol:g('vol'),dd:g('dd'),tech:g('sec:Tecnología'),us:g('cty:US'),ter:g('ter'),top10:g('top10Co'),topCo:g('topCo'),ovl:g('ovl')},mat:em.materiality,same:JSON.stringify(em.P0)===JSON.stringify(em.P1)};
  /* 6 · materialidad: 100 % VT + VT */
  const vv=await S.simulate([{id:'e:VT',w:1}],{...S.schema.emptyScenario(),type:'add',changes:[{op:'add',asset:'e:VT',w:.1,funding:'prorata'}]});
  const sim=[];for(const f of ['Reduce Nasdaq al 15 %','Quita Nasdaq y reparte su peso entre World y Emerging Markets','No quiero vender. Los próximos 300 € al mes van a World durante 12 meses','añade un 10 % de GLD','sustituye QQQ por VT','mueve 10 % de QQQ a VT']){
    const p=S.parse(f,ref),r=await S.simulate(ref,p.scenario,{total:10000});sim.push(r);grab(r)}
  out.mat={vv:vv.materiality,vvSummary:vv.summary,mats:sim.map(r=>r.materiality)};grab(vv);
  /* 7 · datos incompletos */
  const noCty=E.find(e=>(e.k==='e'||e.k==='f')&&ATLASI.expOf(e).q.country==='none'&&ATLASI.expOf(e).ac==='Acciones');
  const nc=await S.simulate([{id:noCty.k+':'+noCty.t,w:.7},{id:'e:VT',w:.3}],{...S.schema.emptyScenario(),type:'add',changes:[{op:'add',asset:'e:EEM',w:.1,funding:'prorata'}]});grab(nc);
  /* producto sin precios: todos los de la base tienen serie, así que se simula retirando temporalmente la de IWM */
  const orig=window.eurSeries;window.eurSeries=(k,o)=>k==='e'&&o&&o.t==='IWM'?Promise.resolve(null):orig(k,o);S.cache.clear();
  const noPx=ATLASI.entBy('e','IWM'),np=await S.simulate([{id:'e:IWM',w:1}],S.schema.emptyScenario()),np2=await S.simulate([{id:'e:VT',w:.8},{id:'e:IWM',w:.2}],S.schema.emptyScenario());
  window.eurSeries=orig;S.cache.clear();grab(np);grab(np2);const npWarn=np2.warnings.some(w=>w.includes('sin historial de precios'));
  out.inc={id:noCty.k+':'+noCty.t,cty:nc.metrics.filter(m=>m.id.startsWith('cty:')).map(m=>[m.id,m.quality]),gap:nc.gaps.country,warn:nc.warnings,
    topCo:nc.metrics.find(m=>m.id==='topCo'),refTop:em.metrics.find(m=>m.id==='topCo'),noPx:{id:'e:IWM',history:np.history,valid:np.valid,bets:np.metrics.find(m=>m.id==='bets'),warn:npWarn,bets2:np2.metrics.find(m=>m.id==='bets').quality}};
  /* 8 · mercado abierto/cerrado: la ventana termina antes de cualquier cotización intradía */
  const liveDates=Object.values((typeof LIVE!=='undefined'&&LIVE&&LIVE.d)||{}).map(q=>new Date(q[2]*1000).toISOString().slice(0,10)).sort();
  const pd=new Date(em.asof.prices.slice(0,10)+'T12:00:00Z');pd.setUTCDate(pd.getUTCDate()-3);
  out.mkt={end:em.asof.end,histTo:em.history&&em.history.period.to,maxLive:liveDates[liveDates.length-1]||null,endMax:pd.toISOString().slice(0,10),prices:em.asof.prices};
  /* 9 · cartera vacía */
  const safe=async f=>{try{return await f()}catch(e){return{threw:String(e)}}};
  out.empty={sim:await safe(()=>S.simulate([],S.schema.emptyScenario())),build:await safe(()=>S.build([],S.schema.emptyScenario())),parse:await safe(()=>S.parse('quita QQQ',[])),add:await safe(()=>S.explore.additions([],{},{sortKey:'ter',tag:'gold'}))};
  out.empty={simValid:out.empty.sim.valid,simEmpty:out.empty.sim.empty,threw:Object.values(out.empty).some(v=>v&&v.threw),buildValid:out.empty.build.valid,parseErr:!!out.empty.parse.error};
  /* 10 · importes vs pesos */
  const sw=await S.simulate(ref,sim[0].scenario),sa=await S.simulate(Object.entries(vals).map(([id,w])=>({id,w})),sim[0].scenario,{mode:'amounts',values:vals});
  const struct=r=>r.metrics.filter(m=>!['vol','dd','bets','health'].includes(m.id)).map(m=>[m.id,m.before,m.after]);
  out.amt={same:JSON.stringify(struct(sw))===JSON.stringify(struct(sa)),riskSame:JSON.stringify(sw.metrics.filter(m=>['vol','dd','bets','health'].includes(m.id)))===JSON.stringify(sa.metrics.filter(m=>['vol','dd','bets','health'].includes(m.id)))};
  /* 11 · reproducibilidad */
  const runs=[];const ts=[];for(let i=0;i<3;i++){S.cache.clear();const t=performance.now();runs.push(JSON.stringify(await S.simulate(ref,sim[0].scenario)));ts.push(performance.now()-t)}
  const dv0=await S.dataVersion(),k0=JSON.parse(runs[0]).key;const ex=ATLASI.EXPO,u0=ex.u;ex.u='TEST-'+u0;const dv1=await S.dataVersion();S.cache.clear();const k1=(await S.simulate(ref,sim[0].scenario)).key;ex.u=u0;S.cache.clear();
  out.rep={identical:runs.every(x=>x===runs[0]),dv0,dv1,keyChanged:k0!==k1,ms:ts};
  /* explorar + Pareto */
  let thrown=null;try{await S.explore.additions(ref,{},{})}catch(e){thrown=String(e)}
  const t1=performance.now();const ad=await S.explore.additions(ref,{},{sortKey:'overlap'});const tAdd=performance.now()-t1;
  const ad2=await S.explore.additions(ref,{},{sortKey:'ter',tag:'em'});const t2=performance.now();const rm=await S.explore.removals(ref);const tRm=performance.now()-t2;const t3=performance.now();const rd=await S.explore.reductions(ref);const tRd=performance.now()-t3;
  const pf=S.explore.pareto(ad.items.map(x=>x.result),[{metric:'ovl',dir:'min'},{metric:'ter',dir:'min'},{metric:'vol',dir:'min'}]);
  grab(ad.note);grab(ad.orderLabel);grab(pf.note);rd.items.forEach(grab);rm.items.forEach(grab);
  const keys=new Set();const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>{keys.add(k);walk(x)})};walk(ad);walk(pf);walk(rm);walk(rd);walk(sim);
  const ovs=ad.items.map(x=>x.overlap),ters=ad2.items.map(x=>x.ter);
  out.explore={thrown,n:ad.items.length,sortedOv:ovs.filter(x=>x!=null).every((x,i,a)=>!i||a[i-1]<=x),sortedTer:ters.filter(x=>x!=null).every((x,i,a)=>!i||a[i-1]<=x),orderLabel:ad.orderLabel,
    nEm:ad2.items.length,rm:rm.items.length,rd:rd.items.length,pareto:{front:pf.front.length,dom:pf.dominated.length,keys:Object.keys(pf)},forbiddenKeys:[...keys].filter(k=>/^(best|top|winner|recommended|recomendado|ganador|mejor)$/i.test(k)),ms:{additions:tAdd,removals:tRm,reductions:tRd}};
  /* explain */
  const ex1=S.explain(sim[0],'bets'),ex2=S.explain(sim[0],'topCo');grab(ex1);grab(ex2);out.explain={ex1,ex2};
  /* golden: los 3 ejemplos de éxito + quitar */
  out.golden=Object.fromEntries(sim.slice(0,3).map((r,i)=>[['reduce_nasdaq_15','quitar_nasdaq_repartir','aportar_300_12m'][i],{P1:r.P1,m:Object.fromEntries(r.metrics.filter(m=>['bets','health','sec:Tecnología','cty:US','ovl','vol','ter','topCo'].includes(m.id)).map(m=>[m.id,[m.before,m.after,m.quality,m.bound]])),mat:r.materiality,asm:r.assumptions}]));
  out.example1=sim[0];
  out.txt=Object.values(S.TXT);out.strs=strs;out.ms=performance.now()-t0;out.simMs=ts;return out}"""

SMOKE = r"""async()=>{const r={};const t=async(n,fn)=>{try{await fn();r[n]='ok'}catch(e){r[n]='ERROR '+e.message}};
  ATLASI.DOC={...ATLASI.DOC,src:'custom',rows:[{k:'e',t:'VT',w:60},{k:'e',t:'QQQ',w:30},{k:'s',t:'NVDA',w:10}],tab:'doctor'};
  await t('doctor',async()=>{openHub('doc');await ATLASI.renderDoc()});
  await t('rayosx',async()=>{const tb=[...document.querySelectorAll('[data-tab]')].map(b=>b.dataset.tab);r.tabs=tb.join(',')});
  await t('radar',async()=>{openHub('radar')});await t('comparar',async()=>{openHub('cmp')});
  for(const h of ['watch','pf','calc','plan','term'])await t('hub_'+h,async()=>{openHub(h)});
  await t('hoy',async()=>{closeHub();await ATLASI.renderOverview();renderTick()});
  await t('globo',async()=>{const E=searchEntities();ATLASI.showExposureGlobe([{e:E.find(x=>x.t==='VT'),w:1}],'test','geo');ATLASI.hideExposure()});
  await t('experto',async()=>{const b=document.getElementById('expertBtn');b.click();b.click()});
  r.optHidden=!document.querySelector('[data-tab="opt"]')&&!document.querySelector('[data-go="opt"]')&&!document.querySelector('.op-teaser');
  return r}"""

FORBID = re.compile(r"\bdeber[ií]as\b|te recomiendo|\bmejor opci[oó]n\b|cartera ideal|lo mejor para ti|te conviene (comprar|vender)|\bhaz esto\b|pon tu dinero|"
                    r"(^|[.!¡]\s*)(compra|vende)\b|\b(compra|vende)\s+(ya|ahora|m[aá]s|un|una|el|la|los|las|\d|[A-Z]{2,})", re.I)

def near(a, b, t): return a is not None and b is not None and abs(a - b) <= t

async def main(update):
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', RG.PORT), functools.partial(RG.Q, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        kw = {'args': ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']}
        if os.environ.get('ATLAS_CHROMIUM'): kw['executable_path'] = os.environ['ATLAS_CHROMIUM']
        b = await p.chromium.launch(**kw)
        res = {}
        for vw, name in ((1280, 'escritorio'), (390, 'móvil')):
            ctx = await b.new_context(viewport={'width': vw, 'height': 820}, service_workers='block')
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:200]))
            async def route(r, _req=None):
                u = r.request.url
                if f'127.0.0.1:{RG.PORT}' in u: return await r.continue_()
                fp, ct = RG.local_for(u)
                if fp: return await r.fulfill(path=fp, content_type=ct)
                if RG.NM: return await r.abort()
                return await r.continue_()
            await pg.route('**/*', route)
            await pg.goto(f'http://127.0.0.1:{RG.PORT}/index.html')
            await pg.wait_for_function("window.ATLASI&&ATLASI.scenarios&&typeof searchEntities==='function'", timeout=60000)
            await pg.evaluate("ATLASI.loadExpo()")
            if name == 'escritorio':
                res = await pg.evaluate(JS, {'PARSE': PARSE, 'REF': REF, 'DUPX': DUP})
            res['smoke_' + name] = await pg.evaluate(SMOKE)
            await pg.wait_for_timeout(1500)
            res['errs_' + name] = errs
            await ctx.close()
        await b.close()
    srv.shutdown()
    fails = []
    def ok(cond, name):
        print(('  OK   ' if cond else '  FALLA ') + name)
        if not cond: fails.append(name)

    print('== 1 · Parser (%d frases)' % len(PARSE))
    for (f, kind, exp), r in zip(PARSE, res['parse']):
        if kind == 'S':
            s = r.get('scenario'); good = bool(s) and s['type'] == exp['type'] and s['changes'] and all(s['changes'][0].get(k) == v for k, v in exp['op'].items())
            if exp.get('noSell'): good = good and s['constraints'].get('noSell') is True
        elif kind == 'A': good = 'ask' in r and exp in r['ask']['question'] and len(r['ask']['options']) >= 2
        elif kind == 'X': good = 'explore' in r and r['explore']['sortKey'] == exp
        else: good = 'error' in r and exp in r['error']
        ok(good and 'threw' not in r, f'«{f}» → {kind}' + ('' if good else f'   obtenido: {json.dumps(r, ensure_ascii=False)[:220]}'))
    rs = res['resolve']
    ok(rs['r1'] and rs['r1']['changes'][0] == {'op': 'adjust', 'asset': 'e:QQQ', 'pp': -0.1}, 'resolveAsk: «un 10 %» → 10 puntos (pendiente serializado en JSON)')
    ok(rs['r2'] and rs['r2']['type'] == 'sectorTarget' and rs['r2']['constraints'].get('noSell') is True and rs['r2']['objectives'][0]['metric'] == 'sec:Tecnología', 'resolveAsk: tecnología → objetivo sectorial + sin vender')
    ok(rs['r3'] and rs['r3']['changes'][0]['asset'] == rs['sp'][1], 'resolveAsk: elige entre dos productos S&P 500 sin adivinar')

    print('== 2 · Invariantes de build (6 carteras × 7 operaciones)')
    bad = [(k, i, v) for k, L in res['inv'].items() for i, v in enumerate(L) if v['valid'] and not (abs(v['sum'] - 1) <= 1e-6 and v['min'] >= 0)]
    ok(not bad, 'Σ pesos = 1 ± 1e-6 y pesos ≥ 0 en todos los escenarios válidos' + (f' {bad}' if bad else ''))
    inval = [(k, i, v['codes']) for k, L in res['inv'].items() for i, v in enumerate(L) if not v['valid']]
    ok(all(c and c[0] in ('AMOUNT', 'NOT_HELD', 'FUNDING') for _, _, c in inval), f'los inválidos lo son por una causa explícita {inval}')

    print('== 3 · Operaciones exactas (VT 50 / QQQ 25 / EEM 10 / IWM 10 / AGG 5)')
    O = res['ops']; E = lambda d, **kv: all(abs(d.get(k.replace('_', ':', 1), 0) - v) <= 1e-6 for k, v in kv.items())
    ok(E(O['reduce'], e_QQQ=.15, e_VT=.566667, e_EEM=.113333, e_AGG=.056667), 'reduce QQQ → 15 % (resto pro-rata)')
    ok(E(O['increase'], e_VT=.6, e_QQQ=.2, e_EEM=.08, e_IWM=.08, e_AGG=.04), 'aumenta VT → 60 % (financiado pro-rata)')
    ok(E(O['remove'], e_VT=.666667, e_EEM=.133333, e_AGG=.066667) and 'e:QQQ' not in O['remove'], 'quita QQQ (pro-rata)')
    ok(E(O['redistribute'], e_VT=.65, e_EEM=.2, e_IWM=.1, e_AGG=.05), 'quita QQQ → 60 % VT / 40 % EEM')
    ok(E(O['add'], e_VT=.45, e_QQQ=.225, e_GLD=.1, e_AGG=.045), 'añade GLD 10 % (pro-rata)')
    ok(E(O['addFrom'], e_VT=.5, e_QQQ=.15, e_GLD=.1), 'añade GLD 10 % financiado con QQQ')
    ok(E(O['replace'], e_VT=.75) and 'e:QQQ' not in O['replace'], 'sustituye QQQ por VT')
    ok(E(O['shift'], e_VT=.6, e_QQQ=.15), 'mueve 10 % de QQQ a VT')
    ok(E(O['rel'], e_QQQ=.225), 'reduce QQQ un 10 % relativo')
    ok(not O['impossible']['valid'] and O['impossible']['violations'][0]['code'] == 'AMOUNT' and O['impossible']['P1'] == [], 'imposible (mover 20 % de AGG que pesa 5 %) → valid:false, sin inventar')
    ok(not O['notHeld']['valid'] and O['notHeld']['violations'][0]['code'] == 'NOT_HELD', 'quitar algo que no está → valid:false')
    ok(any('El peso actual detectado es 25,0 %, no 30,0 %' in w for w in O['fromWarn']), 'aviso si el peso de partida dicho no coincide')

    print('== 4 · Aportaciones')
    C = res['contrib']
    ok(E(C['w12'], e_VT=8600 / 13600, e_QQQ=2500 / 13600, e_AGG=500 / 13600), '(V + C)/(total + C) con total 10 000 € y 300 €/mes × 12 a VT')
    ok(C['w12'] == C['w12amounts'], 'mismo resultado con importes reales que con pesos + total')
    ok(C['months']['months'] == 23 and C['at'][0] > .15 >= C['at'][1], f"monthsTo: QQQ 25 % → 15 % con 300 €/mes a VT = {C['months']['months']} meses (precios constantes)")
    ok(C['unreach']['months'] is None, 'monthsTo: objetivo inalcanzable → null (no inventa)')
    ok(not C['noTotal']['valid'] and C['noTotal']['ask'] and 'NEEDS_TOTAL' in C['noTotal']['codes'], 'aportaciones sin importes → pregunta el total')
    ok('NO_SELL' in C['noSell'], '«sin vender» bloquea un escenario que reduce posiciones')
    ok(C['tax']['calculable'] and abs(C['tax']['realizedGain'] - 500) < .01 and 'antes de considerar la fiscalidad personal' in C['tax']['text'] and C['tax']['quality'] == 'MODEL', f"plusvalía estimada al quitar QQQ = {C['tax']['realizedGain']} € (MODELO)")
    ok(C['taxW']['calculable'] is False, 'con solo pesos: fiscalidad no calculable')

    print('== 5 · Coherencia con Doctor (escenario vacío)')
    d, s = res['coh']['doc'], res['coh']['scn']
    ok(all(near(d[k], s[k], .011) for k in ('tech', 'us', 'ter', 'top10', 'topCo', 'ovl')), f'composición idéntica (sector, país, TER, empresas, solapamiento) {[(k, d[k], s[k]) for k in ("tech", "us", "ter", "topCo")]}')
    ok(near(d['bets'], s['bets'], .05) and near(d['health'], s['health'], 1.5) and near(d['vol'], s['vol'], .3) and near(d['dd'], s['dd'], 1.5),
       f"riesgo coherente (ventana fija vs. hoy): apuestas {d['bets']:.3f}/{s['bets']:.3f} salud {d['health']:.1f}/{s['health']:.1f} vol {d['vol']:.2f}/{s['vol']:.2f}")
    ok(res['coh']['mat'] == 'none' and res['coh']['same'], 'escenario vacío → P1 = P0, materialidad none')

    print('== 6 · Materialidad')
    ok(res['mat']['vv'] == 'none' and 'no produce un cambio material' in res['mat']['vvSummary'][0], '100 % VT + VT → none: ' + res['mat']['vvSummary'][0])
    print('       materialidad de los ejemplos:', res['mat']['mats'])

    print('== 7 · Datos incompletos')
    I = res['inc']
    ok(I['cty'] and all(q == 'INCOMPLETE' for _, q in I['cty']), f"ETF sin desglose por país ({I['id']}, 70 %) → métricas de país INCOMPLETE")
    ok(any(g['id'] == I['id'] for g in I['gap']) and any('no publica desglose por país' in w for w in I['warn']), 'se indica qué producto provoca el hueco')
    ok(I['refTop']['bound'] == 'lower' and I['refTop']['quality'] in ('ESTIMATE', 'INCOMPLETE'), f"exposición a empresa: cota inferior ({I['refTop']['quality']}, cobertura {I['refTop']['coverage']['before']} %)")
    ok(I['noPx']['history'] is None and I['noPx']['bets']['quality'] == 'INCOMPLETE', "producto sin precios (serie retirada en el test) → history null, riesgo INCOMPLETE")
    ok(I['noPx']['warn'], 'cartera con un 20 % sin precios → aviso explícito del producto')

    print('== 8 · Mercado abierto / cerrado')
    M = res['mkt']
    ok(M['end'] and M['histTo'] == M['end'] and (M['maxLive'] is None or M['end'] < M['maxLive']) and M['end'] <= M['endMax'],
       f"ventana histórica hasta {M['end']} (precios {M['prices']}; sesión intradía más reciente {M['maxLive']}): la cotización en curso nunca entra en el cálculo")

    print('== 9 · Cartera vacía')
    X = res['empty']; ok(not X['threw'] and X['simValid'] is False and X['simEmpty'] and X['buildValid'] is False and X['parseErr'], 'sin excepciones; simulate/build devuelven estado vacío')

    print('== 10 · Importes vs pesos')
    ok(res['amt']['same'] and res['amt']['riskSame'], 'mismas proporciones → mismas métricas')

    print('== 11 · Reproducibilidad')
    R = res['rep']
    ok(R['identical'], '3 ejecuciones con caché vaciada → JSON idéntico byte a byte')
    ok(R['dv0'] != R['dv1'] and R['keyChanged'], f"cambiar la versión de datos cambia la clave ({R['dv0']} → {R['dv1'][:30]}…)")

    print('== Exploración y Pareto')
    X = res['explore']
    ok(X['thrown'] and 'sortKey' in X['thrown'], 'explore.additions sin sortKey → error explícito')
    ok(X['sortedOv'] and X['sortedTer'] and X['orderLabel'], f"orden solo por el criterio elegido: «{X['orderLabel']}» ({X['n']} candidatos; {X['nEm']} de emergentes)")
    ok(not X['forbiddenKeys'], f"sin campos best/top/winner/recommended {X['forbiddenKeys']}")
    ok(set(X['pareto']['keys']) == {'objectives', 'front', 'dominated', 'note'} and X['pareto']['front'] >= 1, f"Pareto devuelve front ({X['pareto']['front']}) y dominated ({X['pareto']['dom']}), sin ganador")
    ok(X['rm'] == 5 and X['rd'] >= 5, f"removals ({X['rm']}) y reductions ({X['rd']}) sobre la cartera de referencia")

    print('== Explicación')
    ok(res['explain']['ex1'] and res['explain']['ex1']['method'] and 'Apuestas efectivas pasa de' in res['explain']['ex1']['text'], 'explain() determinista: ' + res['explain']['ex1']['text'][:140] + '…')

    print('== Lenguaje (texto generado, sin el texto del usuario)')
    texts = res['txt'] + res['strs']
    hits = sorted({t for t in texts if isinstance(t, str) and FORBID.search(t)})
    ok(not hits, f'{len(texts)} textos escaneados; expresiones de consejo: {hits[:5]}')

    print('== Golden')
    g = res['golden']
    if update or not GOLD.exists():
        GOLD.write_text(json.dumps(g, ensure_ascii=False, indent=1)); print('  referencias escritas en', GOLD)
    else:
        ref = json.loads(GOLD.read_text()); TOLM = {'bets': .12, 'health': 5, 'vol': 2, 'ovl': 5, 'sec:Tecnología': 3, 'cty:US': 3, 'ter': .02, 'topCo': 1}
        for k, v in ref.items():
            P1 = {x['id']: x['w'] for x in g[k]['P1']}; P1r = {x['id']: x['w'] for x in v['P1']}
            ok(P1.keys() == P1r.keys() and all(abs(P1[i] - P1r[i]) <= 1e-6 for i in P1), f'{k}: P1 exacto')
            off = [(m, a, g[k]['m'].get(m)) for m, a in v['m'].items() if g[k]['m'].get(m) and any(x is not None and y is not None and abs(x - y) > TOLM[m] for x, y in zip(a[:2], g[k]['m'][m][:2]))]
            ok(not off, f'{k}: métricas dentro de tolerancia' + (f' {off}' if off else ''))
            ok(all(a[2:] == g[k]['m'][m][2:] for m, a in v['m'].items() if m in g[k]['m']), f'{k}: calidad y cotas sin cambios')

    print('== Pantallas existentes (sin errores JS)')
    for n in ('escritorio', 'móvil'):
        sm = res['smoke_' + n]; tabs = sm.pop('tabs', ''); hid = sm.pop('optHidden', None)
        ok(all(v == 'ok' for v in sm.values()) and not res['errs_' + n], f'{n}: {sm} errores JS: {res["errs_" + n][:3]}')
        ok(hid is True and 'opt' not in tabs.split(','), f'{n}: Optimizar oculto (pestañas: {tabs})')

    e1 = res['example1']
    print('\n== Ejemplo 1 · «Reduce Nasdaq al 15 %»')
    for m in e1['metrics'][:11] + [x for x in e1['metrics'] if x['id'] in ('sec:Tecnología', 'cty:US')]:
        print(f"  {m['label'][:30]:30s} {str(m['before']):>8s} → {str(m['after']):>8s}  {m['quality']:10s} {m['bound'] or '':5s} {m['cls'] or ''}")
    print('  materialidad:', e1['materiality'], '·', e1['summary'][-1])
    X = res['explore']['ms']
    print(f"\n== Tiempos: simulate (sin caché) {', '.join(f'{t:.0f}' for t in res['simMs'])} ms · additions {X['additions']:.0f} ms · removals {X['removals']:.0f} ms · reductions {X['reductions']:.0f} ms · total {res['ms']/1000:.1f} s")
    print('\nRESULTADO:', 'OK' if not fails else f'{len(fails)} FALLOS'); return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main('--update' in sys.argv)))
