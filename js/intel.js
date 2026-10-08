/* =====================================================================================================
   ATLAS · Inteligencia de cartera
   PORTFOLIO → UNDERSTAND → DIAGNOSE → EXPLORE → COMPARE
   - Datos de composición (holdings) con calidad explícita: DATO REAL / APROXIMACIÓN (índice) / PARCIAL / SIN DATOS.
   - Motor de solapamiento: exposición por empresa (con mínimo y máximo posibles), sector y país; directa vs indirecta.
   - Portfolio Doctor: salud en 9 componentes explicados, diagnóstico con evidencia/fuente/fecha, alternativas.
   - Globo 2.0: ¿dónde está mi dinero? (clasificación del índice vs sedes), empresas, sectores; análisis inverso por país.
   Fuentes: data/expo.json (scripts/holdings.py: justETF por ISIN + Yahoo Finance) · data/p/*.json (precios Yahoo)
            data/rank.json · data/countries.geojson (Natural Earth). Metodología: docs/METODOLOGIA.md
   Usa funciones globales de index.html (searchEntities, priceKey, eurSeries, priceAt, buildPlan, PF, pfValue…).
   ===================================================================================================== */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const pct=(v,d=1)=>v==null||!isFinite(v)?'—':(Math.round(v*10**d)/10**d).toFixed(d).replace('.',',')+' %';
const num=(v,d=0)=>v==null||!isFinite(v)?'—':(Math.round(v*10**d)/10**d).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const XPT=()=>{try{return EXPERT()}catch(_){return false}};
const CNAME={US:'Estados Unidos',JP:'Japón',GB:'Reino Unido',CA:'Canadá',FR:'Francia',CH:'Suiza',DE:'Alemania',AU:'Australia',NL:'Países Bajos',DK:'Dinamarca',SE:'Suecia',IT:'Italia',ES:'España',HK:'Hong Kong',SG:'Singapur',FI:'Finlandia',BE:'Bélgica',IL:'Israel',NO:'Noruega',IE:'Irlanda',NZ:'Nueva Zelanda',AT:'Austria',PT:'Portugal',CN:'China',TW:'Taiwán',IN:'India',KR:'Corea del Sur',BR:'Brasil',SA:'Arabia Saudí',ZA:'Sudáfrica',MX:'México',ID:'Indonesia',TH:'Tailandia',MY:'Malasia',AE:'Emiratos Árabes',PL:'Polonia',QA:'Catar',KW:'Kuwait',TR:'Turquía',CL:'Chile',GR:'Grecia',PH:'Filipinas',PE:'Perú',HU:'Hungría',CO:'Colombia',CZ:'Chequia',EG:'Egipto',LU:'Luxemburgo',MO:'Macao',AR:'Argentina',BM:'Bermudas',KY:'Islas Caimán',JE:'Jersey',XX:'No desglosado',EU:'Unión Europea'};
const EM=new Set(['CN','TW','IN','KR','BR','SA','ZA','MX','ID','TH','MY','AE','PL','QA','KW','TR','CL','GR','PH','PE','HU','CO','CZ','EG','AR']);
const REGION=c=>c==='US'||c==='CA'?'Norteamérica':['JP','AU','NZ','HK','SG'].includes(c)?'Asia-Pacífico desarrollada':EM.has(c)?'Emergentes':c==='XX'?'No desglosado':'Europa';
const SEC_STOCK={'Tecnología':'Tecnología','Finanzas':'Finanzas','Salud':'Salud','Energía':'Energía','Consumo':'Consumo discrecional','Industria':'Industria','Telecomunicaciones':'Comunicaciones','Inmobiliario':'Inmobiliario','Materias primas':'Materiales','Automoción':'Consumo discrecional','Defensa y espacio':'Industria','Infraestructuras':'Industria','Lujo':'Consumo discrecional'};
const UNK='No desglosado';
const SEC_C={'Tecnología':'#7aa2ff','Finanzas':'#e8c66a','Salud':'#e98bb5','Industria':'#aab6d6','Consumo discrecional':'#e9a066','Consumo básico':'#9fcf7a','Comunicaciones':'#b49ae6','Energía':'#e07b66','Materiales':'#a8957a','Inmobiliario':'#6cc7a5','Servicios públicos':'#69c6d9','Liquidez':'#7f8bab','Otros':'#5a6480',[UNK]:'#2c3346'};
const SOURCES='Composición: justETF (países y sectores, por ISIN) y Yahoo Finance (10 mayores posiciones, sectores, P/E, TER). Precios: Yahoo Finance. Fronteras: Natural Earth.';
const fdate=d=>{if(!d)return '—';const x=new Date(String(d).slice(0,10)+'T12:00:00');return isNaN(x)?String(d):x.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})};
/* calidad del dato */
const QL={real:['DATO REAL','qr','Desglose completo publicado por la fuente'],proxy:['APROXIMACIÓN','qa','Tomado del ETF que replica el mismo índice'],partial:['PARCIAL','qp','Solo se conoce una parte; el resto queda como «no desglosado»'],none:['SIN DATOS','qn','La fuente no publica este desglose']};
const qb=q=>`<span class="qb ${QL[q||'none'][1]}" title="${QL[q||'none'][2]}">${QL[q||'none'][0]}</span>`;
const srcl=(src,date,type)=>`<p class="srcl"><span>Fuente: ${esc(src||'—')}</span><span>Fecha: ${fdate(date)}</span>${type?`<span>Tipo: ${esc(type)}</span>`:''}</p>`;

/* ------------------------------ 1 · DATOS DE COMPOSICIÓN ------------------------------ */
let EXPO=null,_expoP=null;
function loadExpo(){return _expoP||(_expoP=fetch('data/expo.json?d='+new Date().toISOString().slice(0,10),{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>EXPO=j).catch(()=>null))}
const ents=()=>searchEntities();
const entBy=(k,t)=>ents().find(x=>x.k===k&&x.t===t);
const CKA={'TSMC':'TAIWAN SEMICONDUCTOR','GOOGLE':'ALPHABET','FACEBOOK':'META PLATFORMS','META':'META PLATFORMS','LVMH':'LVMH MOET','LVMH MOET HENNESSY LOUIS VUITTON':'LVMH MOET'};
const ckey=(name,tk)=>{let n=String(name||'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9 ]/g,' ').replace(/\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|SA|AG|NV|SE|SPA|AB|ASA|OYJ|KK|THE|CLASS|CL|SHS|ORD|ADR|REG|HOLDINGS?|GROUP|COMMON|STOCK|[ABC])\b/g,' ').replace(/\s+/g,' ').trim();
  n=CKA[n]||n;const w=n.split(' ');return w.slice(0,2).join(' ')||String(tk||'').split('.')[0]};
const assetClass=e=>{if(e.k==='s')return 'Acciones';const g=e.obj.grp||'',n=(e.obj.n||e.name||'').toLowerCase();if(['bond','tbill','tips'].includes(g)||/bond|treasury|aggregate|renta fija|bonos/.test(n))return 'Bonos';if(g==='gold'||/gold|oro/.test(n))return 'Oro';return 'Acciones'};
function terOf(e){if(e.k==='s')return 0;const r=EXPO&&EXPO.fund[priceKey(e.k,e.obj)];const t=e.obj.ter??(r&&r.ter);return t==null?null:+t}
function qOf(r){if(r.q)return r.q;const full=r.full||{},top=r.top||r.top_j||[];
  return{country:!r.country||!Object.keys(r.country).length?'none':r.jproxy?'proxy':full.countries?'real':'partial',
    sector:r.sector&&Object.values(r.sector).reduce((a,v)=>a+v,0)>95?'real':(r.sector||r.sector_j)?'partial':'none',companies:top.length?'partial':'none'}}
/* Exposición de UN activo, con la calidad del dato por dimensión. Nunca se rellena lo que no se conoce: va a «No desglosado». */
const _expC=new Map();
function expOf(e){const pk=priceKey(e.k,e.obj);if(_expC.has(pk))return _expC.get(pk);let x;
  if(e.k==='s'){const cc=e.obj.cc||'XX',sec=SEC_STOCK[e.obj.sec]||'Otros';
    x={kind:'stock',ac:'Acciones',q:{country:'real',sector:'real',companies:'real'},country:{[cc]:100},sector:{[sec]:100},hold:[{key:ckey(e.name,e.obj.t),name:e.name,tk:e.obj.t,w:100,cc,sec}],cover:100,ccCover:100,n:1,minW:0,asof:null,src:'Ficha de la empresa'}}
  else{const r=EXPO&&EXPO.fund[pk],ac=assetClass(e);
    if(!r){x={kind:'fund',ac,q:{country:'none',sector:'none',companies:'none'},country:{XX:100},sector:{[UNK]:100},hold:[],cover:0,ccCover:0,n:null,minW:null,asof:null,src:'—'}}
    else{const q={...qOf(r)};const sector={...(r.sector&&Object.keys(r.sector).length?r.sector:(r.sector_j||{}))};const secS=Object.values(sector).reduce((a,v)=>a+v,0);
      if(!secS){sector[UNK]=100}else if(secS<99.5)sector[UNK]=+(100-secS).toFixed(2);
      const topSrc=(r.top&&r.top.length?r.top:r.top_j)||[];const jcc=new Map((r.top_j||[]).map(h=>[ckey(h[0],h[1]),h[3]]));
      const hold=topSrc.map(h=>{const key=ckey(h[0],h[1]);return{key,name:h[0],tk:h[1],w:+h[2],cc:jcc.get(key)||(/^\d+$/.test(h[1])?'XX':h[3])||'XX',sec:h[4]||null}});
      let country={...(r.country||{})};let ccS=Object.values(country).reduce((a,v)=>a+v,0);
      if(!ccS&&hold.length){hold.forEach(h=>country[h.cc]=(country[h.cc]||0)+h.w);ccS=Object.values(country).reduce((a,v)=>a+v,0);q.country='partial'}
      if(ccS<99.5)country.XX=(country.XX||0)+Math.max(0,100-ccS);
      const cover=hold.reduce((a,h)=>a+h.w,0),n=r.n||null;
      x={kind:'fund',ac,q,country,sector,hold,cover,ccCover:100-(country.XX||0),n,minW:hold.length&&(!n||hold.length<n)?Math.min(...hold.map(h=>h.w)):hold.length?0:null,
        asof:r.asof_j||r.asof,src:[r.src_j,r.src].filter(Boolean).join(' + ')||'—',srcCty:r.src_j||(q.country==='partial'?'Yahoo Finance (10 mayores posiciones)':'—'),srcComp:r.top&&r.top.length?'Yahoo Finance':r.top_j?r.src_j:'—',
        proxyIsin:r.jproxy?r.jisin:null,pe:r.pe,pb:r.pb,ter:r.ter,qTxt:`Países: ${QL[q.country][0].toLowerCase()}${r.jproxy?` (ETF UCITS del mismo índice, ${r.jisin})`:''} · empresas: ${hold.length} mayores posiciones (${pct(cover,0)} del ETF)`}}}
  _expC.set(pk,x);return x}

/* ------------------------------ 2 · MOTOR DE SOLAPAMIENTO (look-through) ------------------------------ */
/* P=[{e,w}] con w sumando 1. Para cada empresa: w = mínimo seguro (suma de lo conocido) y up = máximo posible
   (si la empresa no aparece entre las mayores posiciones de un ETF, como mucho pesa lo que su posición más pequeña conocida). */
function lookThrough(P){const C={},S={},comp=new Map(),byC={},byS={},dir={},ind={},AC={};let cover=0,ccCover=0,ter=0,terW=0;
  P.forEach(({e,w})=>{const x=expOf(e);AC[x.ac]=(AC[x.ac]||0)+w*100;
    Object.entries(x.country).forEach(([c,v])=>{const p=w*v;C[c]=(C[c]||0)+p;(byC[c]=byC[c]||[]).push({e,p});if(e.k==='s')dir[c]=(dir[c]||0)+p;else ind[c]=(ind[c]||0)+p});
    Object.entries(x.sector).forEach(([s,v])=>{const p=w*v;S[s]=(S[s]||0)+p;(byS[s]=byS[s]||[]).push({e,p})});
    x.hold.forEach(h=>{const cw=w*h.w;let c=comp.get(h.key);if(!c){c={key:h.key,name:h.name,tk:h.tk,cc:h.cc,sec:h.sec,w:0,dir:0,by:[]};comp.set(h.key,c)}
      c.w+=cw;if(e.k==='s')c.dir+=cw;const bb=c.by.find(z=>z.e===e);if(bb)bb.w+=cw;else c.by.push({e,w:cw});if(!c.sec&&h.sec)c.sec=h.sec;if(c.cc==='XX'&&h.cc)c.cc=h.cc});
    cover+=w*x.cover;ccCover+=w*x.ccCover;const t=terOf(e);if(t!=null){ter+=w*t;terW+=w}});
  const funds=P.filter(x=>x.e.k!=='s');
  comp.forEach(c=>{let up=c.w,open=false;funds.forEach(({e,w})=>{if(c.by.some(b=>b.e===e))return;const x=expOf(e);
      if(!x.hold.length){if(x.ac==='Acciones')open=true;return}if(!x.minW)return;if(x.q.country!=='none'&&!(x.country[c.cc]>0)&&!(x.country.XX>0))return;up+=w*x.minW});
    c.up=open?null:up;c.exact=!open&&Math.abs(up-c.w)<1e-6});
  const comps=[...comp.values()].sort((a,b)=>b.w-a.w);
  const ns=funds.map(x=>expOf(x.e).n),nStocks=P.filter(x=>x.e.k==='s').length;
  const uniq={lo:Math.max(comp.size,...ns.filter(Boolean),0)+0,hi:ns.every(Boolean)?ns.reduce((a,v)=>a+v,0)+nStocks:null};
  return{C,S,comps,byC,byS,dir,ind,AC,cover,ccCover,ter:terW?ter/terW:null,terW,uniq,nFunds:funds.length,nStocks}}
/* Solapamiento entre dos activos = Σ mín(peso en A, peso en B) de las empresas comunes conocidas (mínimo garantizado) */
function overlapDetail(a,b){const A=expOf(a).hold,B=expOf(b).hold;if(!A.length||!B.length)return null;const agg=H=>{const m=new Map();H.forEach(h=>{const o=m.get(h.key);if(o)o.w+=h.w;else m.set(h.key,{...h})});return m};
  const ma=agg(A),mb=agg(B),rows=[];ma.forEach((h,k)=>{if(mb.has(k))rows.push({name:h.name,a:h.w,b:mb.get(k).w,m:Math.min(h.w,mb.get(k).w)})});rows.sort((x,y)=>y.m-x.m);return{o:rows.reduce((s,r)=>s+r.m,0),rows}}
const overlap=(a,b)=>{const d=overlapDetail(a,b);return d?d.o:null};

/* ------------------------------ precios: riesgo y correlaciones ------------------------------ */
function weeklyGrid(years,endD){const out=[],end=endD?new Date(endD+'T12:00:00Z'):new Date();const d=new Date(end);d.setFullYear(d.getFullYear()-years);while(d.getDay()!==5)d.setDate(d.getDate()+1);while(d<=end){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+7)}return out}
async function retSeries(e,grid){const s=await eurSeries(e.k,e.obj);if(!s||!s.length)return null;const first=s[0][0];const px=grid.map(d=>d<first?null:priceAt(s,d).v);
  const r=[];for(let i=1;i<px.length;i++)r.push(px[i]!=null&&px[i-1]!=null?px[i]/px[i-1]-1:null);return{r,first}}
const corr=(a,b)=>{const p=[];for(let i=0;i<a.length;i++)if(a[i]!=null&&b[i]!=null)p.push([a[i],b[i]]);if(p.length<40)return null;const n=p.length,ma=p.reduce((s,x)=>s+x[0],0)/n,mb=p.reduce((s,x)=>s+x[1],0)/n;let c=0,va=0,vb=0;p.forEach(([x,y])=>{c+=(x-ma)*(y-mb);va+=(x-ma)**2;vb+=(y-mb)**2});return va&&vb?c/Math.sqrt(va*vb):null};
async function riskOf(P,years=5,end){const grid=weeklyGrid(years,end),R=await Promise.all(P.map(x=>retSeries(x.e,grid)));
  const ok=P.map((x,i)=>({...x,r:R[i]})).filter(x=>x.r);if(!ok.length)return null;const tw=ok.reduce((a,x)=>a+x.w,0);
  const pr=grid.slice(1).map((_,t)=>{let s=0,ww=0;ok.forEach(x=>{const v=x.r.r[t];if(v!=null){s+=x.w*v;ww+=x.w}});return ww>tw*.6?s/ww:null});
  const v=pr.filter(x=>x!=null);if(v.length<30)return null;const m=v.reduce((a,x)=>a+x,0)/v.length,sd=Math.sqrt(v.reduce((a,x)=>a+(x-m)**2,0)/(v.length-1));
  let idx=1,pk=1,dd=0;const path=[1];pr.forEach(x=>{if(x!=null){idx*=1+x;pk=Math.max(pk,idx);dd=Math.min(dd,idx/pk-1)}path.push(idx)});
  const r12=[];for(let i=52;i<path.length;i++)r12.push(path[i]/path[i-52]-1);r12.sort((a,b)=>a-b);
  const yrs=v.length/52,cagr=Math.pow(idx,1/yrs)-1;
  const M=ok.map(a=>ok.map(b=>a===b?1:corr(a.r.r,b.r.r)));const sig=ok.map(x=>{const v=x.r.r.filter(y=>y!=null);if(v.length<30)return null;const m=v.reduce((a,y)=>a+y,0)/v.length;return Math.sqrt(v.reduce((a,y)=>a+(y-m)**2,0)/(v.length-1)*52)});const firstData=ok.map(x=>x.r.first).sort().pop();
  return{vol:sd*Math.sqrt(52)*100,dd:dd*100,worst12:r12.length?r12[0]*100:null,p5:r12.length?r12[Math.floor(r12.length*.05)]*100:null,cagr:cagr*100,weeks:v.length,firstData,M,sig,assets:ok.map(x=>x.e),pr,grid,coverage:tw}}

/* ------------------------------ 3 · PORTFOLIO DOCTOR: puntuaciones ------------------------------ */
let DOC=(()=>{try{return {tab:'doctor',...(JSON.parse(localStorage.getItem('atlas_doc')||'null')||{src:'pf',rows:[]})}}catch(_){return{src:'pf',rows:[],tab:'doctor'}}})();
const saveDoc=()=>{try{localStorage.setItem('atlas_doc',JSON.stringify(DOC))}catch(_){}};
let _pfV=null;
async function docPortfolio(src){src=src||DOC.src;if(src==='pf'&&PF.length){const rs=await Promise.all(PF.map(pfValue)),g=new Map();let inv=0,val=0;rs.forEach(r=>{if(!r.ent||r.err||r.pending||!(r.val>0))return;inv+=r.inv;val+=r.val;const k=r.ent.k+'|'+r.ent.t;g.set(k,(g.get(k)||0)+r.val)});
    const tot=[...g.values()].reduce((a,v)=>a+v,0);_pfV={inv,val};return{name:'Mi cartera',src:'pf',val,inv,P:[...g.entries()].map(([k,v])=>{const [kk,t]=k.split('|');return{e:entBy(kk,t),w:v/tot}}).filter(x=>x.e)}}
  const rows=(DOC.rows||[]).map(r=>({e:entBy(r.k,r.t),w:+r.w||0})).filter(x=>x.e&&x.w>0),tot=rows.reduce((a,x)=>a+x.w,0);return{name:'Cartera rápida',src:'custom',P:tot?rows.map(x=>({e:x.e,w:x.w/tot})):[]}}
const isNarrow=e=>{if(e.k==='s')return true;const x=expOf(e);const s=Object.entries(x.sector).filter(([k])=>k!==UNK).sort((a,b)=>b[1]-a[1])[0];return !!(s&&s[1]>=60&&x.ac==='Acciones')};
const SCORE_DOC={
  div:['Diversificación','¿Entre cuántas empresas se reparte de verdad tu dinero?','Empresas equivalentes = 1 / Σ(peso de cada empresa)², usando solo las posiciones conocidas. Como el resto no se conoce y no se rellena, es una cota OPTIMISTA (la real puede ser menor). 200 o más → 100; 10 → 43; 1 → 0 (escala logarítmica).','Composición'],
  conc:['Concentración por producto','¿Cuánto depende de acciones sueltas y ETFs temáticos o sectoriales?','100 − 1,5 × (peso en acciones individuales + ETFs con más del 60 % en un sector − 10 pp). Hasta un 10 % → 100.','Composición'],
  comp:['Concentración por empresa','¿Pesa demasiado alguna empresa?','100 − 6 × (mayor empresa − 3 pp) − 1,2 × (10 mayores − 25 pp). Pesos mínimos garantizados (solo posiciones conocidas).','Composición'],
  geo:['Exposición geográfica','¿Depende de un solo país?','100 − 2 × (primer país − 60 pp) si supera el 60 %; −15 si hay menos de 5 países con más del 1 %. 60 % ≈ peso de EE. UU. en el índice mundial (MSCI ACWI).','Países'],
  sec:['Exposición sectorial','¿Depende de un solo sector?','100 − 2,5 × (primer sector − 25 pp) si supera el 25 %.','Sectores'],
  corr:['Correlación','¿Tus activos se mueven igual?','(1 − correlación semanal media entre tus activos, ponderada por peso) × 130. Necesita 2 o más activos con 40 semanas de precios.','Precios'],
  vol:['Volatilidad','¿Cuánto oscila su valor?','100 − 4 × (volatilidad anual − 8 pp). 8 % o menos → 100; 20 % → 52; 33 % → 0. Precios semanales en euros, 5 años.','Precios'],
  dd:['Caída máxima','¿Cuánto llegó a caer?','100 − 2,5 × (|caída máxima| − 10 pp). Mayor caída desde un máximo en los últimos 5 años, con los pesos de hoy.','Precios'],
  ovl:['Solapamiento entre ETFs','¿Tus ETFs llevan las mismas empresas?','100 − 1,5 × solapamiento medio entre pares de ETFs (ponderado por peso). Solapamiento = Σ mín(peso en A, peso en B) de las empresas comunes publicadas (mínimo garantizado).','Composición'],
  bets:['Apuestas independientes','¿Cuántas apuestas distintas haces de verdad?','Se agrupan los activos cuya correlación semanal es ≥ 0,85 (se mueven como uno solo). Apuestas = 1 / Σ(peso de cada grupo)². 1 apuesta → 25; 2 → 50; 3 → 75; 4 o más → 100.','Precios'],
  cost:['Coste','¿Cuánto pagas en comisiones?','100 − 50 × gastos anuales medios ponderados (TER, %). 0,1 % → 95; 0,5 % → 75; 1,5 % → 25.','Costes']};
/* Apuestas independientes: grupos de activos con correlación ≥ 0,85 (unión por enlace simple). Activos sin precios = grupo propio. */
function betsOf(R,P,th=.85){const parent=P.map((_,i)=>i),f=i=>parent[i]===i?i:(parent[i]=f(parent[i]));
  if(R)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c!=null&&c>=th){const ia=P.findIndex(x=>x.e===a),ib=P.findIndex(x=>x.e===b);parent[f(ia)]=f(ib)}}));
  const g=new Map();P.forEach((x,i)=>{const r=f(i);const o=g.get(r)||{w:0,m:[]};o.w+=x.w;o.m.push(x.e);g.set(r,o)});const groups=[...g.values()].sort((a,b)=>b.w-a.w);
  return{nb:1/groups.reduce((a,x)=>a+x.w*x.w,0),groups}}
/* Cifra estrella: apuestas independientes EFECTIVAS (estimación, no clasificación económica).
   N = (Σ wᵢσᵢ)² / Σᵢⱼ wᵢwⱼσᵢσⱼρ⁺ᵢⱼ  — ratio de diversificación al cuadrado (Choueifaty): con pesos por riesgo, sin umbral.
     · ρ⁺ = correlación semanal en euros con los negativos a 0 (prudente: una correlación negativa no cuenta como «más de una» apuesta).
     · Todo se mueve igual → 1. Nada se parece y mismo riesgo → nº de productos.
     · NVDA directa + NVDA dentro de QQQ/SMH: no se cuenta dos veces como apuesta, porque los precios de QQQ y SMH ya incluyen NVDA
       (su correlación lo recoge). La exposición económica consolidada se muestra aparte.
   Robustez: se recalcula con 3 años en vez de 5 (las correlaciones cambian con el tiempo). También se calculan los grupos con umbral
   0,80 / 0,85 / 0,90 solo como referencia (modo experto): ese método salta de golpe y no se usa para la cifra. */
function drSq(R,P){if(!R||!R.sig)return null;const ix=P.map(x=>R.assets.indexOf(x.e)),sg=R.sig.filter(v=>v!=null).sort((a,b)=>a-b),sMed=sg.length?sg[Math.floor(sg.length/2)]:.15;
  const s=P.map((x,i)=>ix[i]>=0&&R.sig[ix[i]]!=null?R.sig[ix[i]]:sMed);let num=0,den=0;P.forEach((a,i)=>{num+=a.w*s[i];P.forEach((b,j)=>{let c;if(i===j)c=1;else if(ix[i]<0||ix[j]<0)c=0;else{const v=R.M[ix[i]][ix[j]];c=v==null?0:Math.max(0,v)}den+=a.w*b.w*s[i]*s[j]*c})});
  return den>0?num*num/den:null}
function betsRobust(R,P,R3){if(!R||!P.length)return null;const T=[.8,.85,.9].map(th=>({th,nb:betsOf(R,P,th).nb}));const d5=drSq(R,P),d3=R3?drSq(R3,P):null;if(d5==null)return null;
  const lo=d3!=null?Math.min(d5,d3):d5,hi=d3!=null?Math.max(d5,d3):d5,sp=hi-lo,rel=sp/((lo+hi)/2);
  const cls=d3==null?'na':(sp<=.25||rel<=.15)?'robust':(sp<=.5||rel<=.3)?'moderate':'sensitive';
  const ix=P.map(x=>R.assets.indexOf(x.e)),noPx=P.filter((x,i)=>ix[i]<0).reduce((a,x)=>a+x.w,0),wk=R.weeks||0;
  const conf=(noPx>.1||wk<104)?'low':(noPx>0||wk<200||cls==='sensitive')?'medium':'high';
  const r5=v=>Math.max(1,Math.round(v*2)/2);const tl=T.map(t=>t.nb);
  return{T,d5,d3,main:d5,lo,hi,cls,conf,weeks:wk,noPx,thLo:Math.min(...tl),thHi:Math.max(...tl),disp:{main:r5(d5),lo:r5(lo),hi:r5(hi)}}}
function docScores(L,R,P,R3){const S={},ev={};const known=L.comps.reduce((a,c)=>a+c.w*c.w,0)/1e4;
  const neff=known?1/known:null;const top1=L.comps[0]?L.comps[0].w:0,top10=L.comps.slice(0,10).reduce((a,c)=>a+c.w,0);
  if(neff){S.div=clamp(100*Math.log(Math.max(1,neff))/Math.log(200));ev.div=[`Como mucho ≈ ${num(neff)} empresas equivalentes`,`Composición conocida: ${pct(L.cover,0)} de la cartera`,L.uniq.hi?`Empresas distintas: entre ${num(L.uniq.lo)} y ${num(L.uniq.hi)}`:`Empresas distintas: al menos ${num(L.uniq.lo)}`]}
  const narrow=P.filter(x=>isNarrow(x.e)).reduce((a,x)=>a+x.w*100,0);S.conc=clamp(100-1.5*Math.max(0,narrow-10));ev.conc=[`Acciones individuales y ETFs temáticos/sectoriales: ${pct(narrow,0)}`,`Mayor posición: ${P.slice().sort((a,b)=>b.w-a.w)[0].e.name} ${pct(P.slice().sort((a,b)=>b.w-a.w)[0].w*100,0)}`];
  if(L.comps.length){S.comp=clamp(100-6*Math.max(0,top1-3)-1.2*Math.max(0,top10-25));ev.comp=[`Mayor empresa: ${L.comps[0].name} ≥ ${pct(top1)}`,`10 mayores empresas: ≥ ${pct(top10)}`]}
  const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);if(cs.length){const n1=cs.filter(([,v])=>v>1).length;S.geo=clamp(100-2*Math.max(0,cs[0][1]-60)-(n1<5?15:0));ev.geo=[`${CNAME[cs[0][0]]||cs[0][0]}: ${pct(cs[0][1])}`,`${n1} países por encima del 1 %`,L.C.XX?`No desglosado: ${pct(L.C.XX,0)}`:null].filter(Boolean)}
  const ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);if(ss.length){S.sec=clamp(100-2.5*Math.max(0,ss[0][1]-25));ev.sec=[`${ss[0][0]}: ${pct(ss[0][1])}`,ss[1]?`${ss[1][0]}: ${pct(ss[1][1])}`:null].filter(Boolean)}
  let ac=null;if(R){if(R.M.length>1){let s=0,ww=0;R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c==null)return;const wi=P.find(x=>x.e===a).w*P.find(x=>x.e===b).w;s+=wi*c;ww+=wi}));if(ww){ac=s/ww;S.corr=clamp((1-ac)*130);ev.corr=[`Correlación media: ${ac.toFixed(2).replace('.',',')}`]}}
    S.vol=clamp(100-4*(R.vol-8));ev.vol=[`Volatilidad anual: ${pct(R.vol)}`];S.dd=clamp(100-2.5*(Math.abs(R.dd)-10));ev.dd=[`Caída máxima: ${pct(R.dd)}`,R.worst12!=null?`Peor año móvil: ${pct(R.worst12)}`:null].filter(Boolean)}
  const fu=P.filter(x=>x.e.k!=='s');let ovAvg=null;if(fu.length>1){let s2=0,w2=0;fu.forEach((a,i)=>fu.slice(i+1).forEach(b=>{const o=overlap(a.e,b.e);if(o==null)return;const ww=a.w*b.w;s2+=ww*o;w2+=ww}));if(w2){ovAvg=s2/w2;S.ovl=clamp(100-1.5*ovAvg);ev.ovl=[`Solapamiento medio entre tus ETFs: ≥ ${pct(ovAvg,0)}`]}}
  const B=betsOf(R,P),RB=betsRobust(R,P,R3);if(RB){B.nb=RB.main;B.rob=RB}if(R&&P.length){S.bets=clamp(25*B.nb);ev.bets=[`≈ ${num(B.nb,1)} apuestas independientes con ${P.length} producto${P.length>1?'s':''}`,...B.groups.filter(g=>g.m.length>1).slice(0,3).map(g=>`Se mueven juntos: ${g.m.map(e=>e.tk).join(' + ')} (${pct(g.w*100,0)})`)]}
  if(L.ter!=null){S.cost=clamp(100-50*L.ter);ev.cost=[`TER medio ponderado: ${pct(L.ter,2)} al año`,L.terW<.99?`Sin dato de coste en el ${pct((1-L.terW)*100,0)}`:null].filter(Boolean)}
  const miss=Object.keys(SCORE_DOC).filter(k=>S[k]==null);const vals=Object.values(S);
  return{S,ev,miss,health:vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:null,neff,top1,top10,narrow,avgCorr:ac,ovAvg,bets:B}}

/* ------------------------------ DIAGNÓSTICO ------------------------------ */
const SEV={alta:['🔴','ALTO','#ff5d6c'],media:['🟠','MEDIO','#ffa94d'],baja:['🟡','BAJO','#e8c66a'],ok:['🟢','BIEN','#3ddc84'],info:['⚪','DATOS','#8fa3bd']};
function diagnose(A){const {L,R,P,SC}=A,D=[];const asof=(P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||null,pxDate=R?R.grid[R.grid.length-1]:null;
  const add=(sev,t,exp,metric,evid,src,date,acts,meta)=>D.push({sev,t,exp,metric,evid,src,date,acts:acts||[],...(meta||{})});   // meta {kind,ref}: problema estructurado para «Explorar cambios»
  const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]),top=cs[0];
  if(top&&top[1]>70){const by=(L.byC[top[0]]||[]).sort((a,b)=>b.p-a.p).slice(0,3);add(top[1]>85?'alta':'media',`Mucha concentración en ${CNAME[top[0]]||top[0]}`,`Tu dinero depende sobre todo de un país. En el índice mundial (MSCI ACWI) EE. UU. pesa en torno al 60–65 %.`,`${pct(top[1],0)} en ${CNAME[top[0]]||top[0]}`,`Viene de: ${by.map(b=>`${b.e.name} ${pct(b.p)}`).join(' · ')}`,'justETF (reparto por países)',asof,[['🌍 Ver en el globo',()=>showExposureGlobe(P,A.name,'geo')],['¿Por qué?',()=>docTab('geo')]],{kind:'cty',ref:top[0]})}
  else if(top&&L.ccCover>60)add('ok','Exposición geográfica razonable',`Ningún país supera el 70 % de tu cartera.`,`${CNAME[top[0]]||top[0]} ${pct(top[1],0)}`,`${cs.filter(([,v])=>v>1).length} países por encima del 1 %`,'justETF (reparto por países)',asof,[['¿Por qué?',()=>docTab('geo')]]);
  const em=Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  if(em<5&&L.ccCover>60&&(L.AC.Acciones||0)>50)add('baja','Emergentes poco representados',`Los mercados emergentes son ~10 % del índice mundial; tienes bastante menos.`,`${pct(em)} en emergentes`,`Países emergentes en tu cartera: ${pct(em)} (MSCI ACWI ≈ 10 %)`,'justETF (reparto por países)',asof,[['¿Por qué?',()=>docTab('geo')]],{kind:'em',ref:null});
  const c1=L.comps[0];if(c1&&SC.top1>8)add(SC.top1>15?'alta':'media',`Mucho peso en ${c1.name}`,`Sumando lo que tienes directamente y lo que va dentro de tus ETFs, una sola empresa pesa mucho.`,`≥ ${pct(SC.top1)} en ${c1.name}`,`Llega a través de: ${c1.by.map(b=>`${b.e.name} ${pct(b.w)}`).join(' · ')}`,'Yahoo Finance / justETF (mayores posiciones)',asof,[['Ver empresas',()=>docTab('comp')]],{kind:'comp',ref:c1.key});
  const ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  if(ss[0]&&ss[0][1]>35){const by=(L.byS[ss[0][0]]||[]).sort((a,b)=>b.p-a.p).slice(0,3);add(ss[0][1]>50?'alta':'media',`Fuerte peso en ${ss[0][0]}`,`Un sector domina tu cartera: si ese sector cae, cae casi todo.`,`${pct(ss[0][1],0)} en ${ss[0][0]}`,`Viene de: ${by.map(b=>`${b.e.name} ${pct(b.p)}`).join(' · ')}`,'Yahoo Finance / justETF (sectores)',asof,[['Ver sectores',()=>docTab('sec')],['🌍 Globo',()=>showExposureGlobe(P,A.name,'sec')]],{kind:'sec',ref:ss[0][0]})}
  const funds=P.filter(x=>x.e.k!=='s');const pairs=[];funds.forEach((a,i)=>funds.slice(i+1).forEach(b=>{const o=overlap(a.e,b.e);if(o!=null&&o>20)pairs.push([a,b,o])}));pairs.sort((a,b)=>b[2]-a[2]);A.pairs=pairs;
  pairs.slice(0,2).forEach(([a,b,o])=>{const d=overlapDetail(a.e,b.e);add(o>45?'alta':'media',`Solapamiento entre ${a.e.name} y ${b.e.name}`,`Comparten muchas de las mismas empresas: tenerlos juntos diversifica menos de lo que parece.`,`≥ ${pct(o,0)} en común`,`Empresas compartidas: ${d.rows.slice(0,4).map(r=>r.name).join(', ')}${d.rows.length>4?'…':''}`,'Yahoo Finance / justETF (mayores posiciones)',asof,[['Ver solapamiento',()=>{DOC.pair=[a.e.t,b.e.t];docTab('comp')}]],{kind:'ovl',ref:[a.e.t,b.e.t]})});
  if(R&&R.M.length>1)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c!=null&&c>.92&&!pairs.some(p=>(p[0].e===a&&p[1].e===b)||(p[0].e===b&&p[1].e===a)))add('media',`${a.name} y ${b.name} se mueven casi igual`,`Su correlación semanal es muy alta: suben y bajan a la vez, así que juntos apenas reducen el riesgo.`,`Correlación ${c.toFixed(2).replace('.',',')}`,`Rentabilidades semanales en euros, ${Math.round(R.weeks/52)} años`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]],{kind:'corr',ref:[a.t,b.t]})}));
  const nb=SC.bets?SC.bets.nb:null;if(R&&nb&&P.length>=3&&nb<P.length*.6){const g=SC.bets.groups.filter(x=>x.m.length>1)[0];add('media',`${P.length} productos, ≈ ${num(nb,1)} apuestas`,`Varios de tus activos suben y bajan casi a la vez: a efectos de riesgo cuentan como uno solo.`,`≈ ${num(nb,1)} apuestas independientes`,g?`Se mueven juntos (correlación ≥ 0,85): ${g.m.map(e=>e.name).join(', ')} — ${pct(g.w*100,0)} de la cartera`:'—','Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]],{kind:'bets',ref:null})}
  const P0=PROFILES[profile];if(R&&R.vol>P0.etfVol)add('media','Más volátil que tu perfil',`Tu perfil ${P0.label} tolera hasta ~${P0.etfVol} % de volatilidad anual (Ajustes).`,`Volatilidad ${pct(R.vol)}`,`Caída máxima ${pct(R.dd)} · peor año móvil ${pct(R.worst12)}`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]],{kind:'vol',ref:null});
  if(L.ter!=null)add(L.ter>.5?'baja':'ok',L.ter>.5?'Costes altos':'Coste bajo',L.ter>.5?`Un 0,5 % anual de diferencia resta mucho a largo plazo.`:`Tus gastos anuales ponderados son bajos.`,`TER ${pct(L.ter,2)}`,`Media ponderada del TER de cada fondo/ETF${L.terW<.99?` (sin dato en el ${pct((1-L.terW)*100,0)})`:''}`,'Gestoras vía justETF / Yahoo Finance',asof,[],L.ter>.5?{kind:'cost',ref:null}:null);
  if(SC.avgCorr!=null&&SC.avgCorr<.6&&P.length>1)add('ok','Activos que se complementan',`Tus activos no se mueven igual, lo que amortigua las caídas.`,`Correlación media ${SC.avgCorr.toFixed(2).replace('.',',')}`,`Rentabilidades semanales en euros`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]]);
  if(L.ccCover<70||L.cover<20){const nd=P.filter(x=>expOf(x.e).q.country==='none').map(x=>x.e.name);add('info','Parte de la composición no está publicada',`Lo que no se conoce no se rellena: aparece como «no desglosado» y la concentración real puede ser mayor.`,`Países conocidos ${pct(L.ccCover,0)} · empresas ${pct(L.cover,0)}`,nd.length?`Sin desglose por países: ${nd.join(', ')}`:'Solo se conocen las 10 mayores posiciones de cada ETF','—',asof,[['Ver holdings',()=>docTab('hold')]])}
  const ord={alta:0,media:1,baja:2,info:3,ok:4};return D.sort((a,b)=>ord[a.sev]-ord[b.sev])}

/* ------------------------------ alternativas ------------------------------ */
async function altPortfolios(){const out=[];for(const [pk,name,ico,txt] of [['cons','Conservadora','🛡️','Menor volatilidad'],['mod','Equilibrada','⚖️','Equilibrio riesgo/rentabilidad'],['ag','Crecimiento','🚀','Más exposición a crecimiento']]){const p=buildPlan(pk,basis,'bal');
    const P=p.items.map(x=>({e:ents().find(y=>y.obj===x.e)||entBy('f',x.e.t)||entBy('e',x.e.t),w:x.w})).filter(x=>x.e);const tw=P.reduce((a,x)=>a+x.w,0);P.forEach(x=>x.w/=tw);out.push({pk,name,ico,txt,P,assume:p.st&&isFinite(p.st.g)?p.st.g:null})}return out}
function assumeOf(P){try{if(P.some(x=>x.e.k==='s'))return null;const st=stats(P.map(x=>({e:x.e.obj,w:x.w})),basis);return isFinite(st.g)?st.g:null}catch(_){return null}}
function tradeoff(cur,alt){const t=[],d=(a,b)=>a!=null&&b!=null?b-a:null;const dv=d(cur.R&&cur.R.vol,alt.R&&alt.R.vol),dr=d(cur.R&&cur.R.cagr,alt.R&&alt.R.cagr),dd=d(cur.R&&cur.R.dd,alt.R&&alt.R.dd),dus=d(cur.L.C.US||0,alt.L.C.US||0),dt=d(cur.SC.top10,alt.SC.top10);
  if(dv!=null&&Math.abs(dv)>=1)t.push(`${dv<0?'menos':'más'} volatilidad (${dv>0?'+':''}${num(dv,1)} pp)`);if(dd!=null&&Math.abs(dd)>=2)t.push(`caídas ${dd>0?'más suaves':'más fuertes'} (${num(dd,0)} pp)`);
  if(dus!=null&&Math.abs(dus)>=5)t.push(`${dus<0?'menos':'más'} EE. UU. (${dus>0?'+':''}${num(dus,0)} pp)`);if(dt!=null&&Math.abs(dt)>=3)t.push(`${dt<0?'menos':'más'} concentración en las 10 mayores`);
  const cost=dr!=null&&Math.abs(dr)>=.5?`${dr<0?'a cambio de':'y'} ${dr<0?'menos':'más'} rentabilidad histórica (${dr>0?'+':''}${num(dr,1)} pp/año)`:'';
  return t.length?`Trade-off: ${t.join(', ')} ${cost}`.trim()+'.':'Diferencias pequeñas frente a tu cartera.'}

/* ------------------------------ ANÁLISIS (cacheado por cartera) ------------------------------ */
let ANA=null;const _AC=new Map();
const sigOf=P=>P.map(x=>x.e.k+x.e.t+':'+x.w.toFixed(4)).join('|');
async function analyzeSrc(srcName){await loadExpo();const src=await docPortfolio(srcName);if(!src.P.length)return{empty:true,src};
  const sig=src.src+sigOf(src.P);if(_AC.has(sig))return _AC.get(sig);
  const p=(async()=>{const P=src.P,L=lookThrough(P),[R,R3]=await Promise.all([riskOf(P),riskOf(P,3)]),SC=docScores(L,R,P,R3);const A={P,L,R,R3,SC,name:src.name,src,asof:(P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||null};A.D=diagnose(A);return A})();
  _AC.set(sig,p);if(_AC.size>12)_AC.delete(_AC.keys().next().value);return p}
async function analyze(){const A=await analyzeSrc(DOC.src);ANA=A;window.ATLAS_DOC=A;return A}

/* ------------------------------ UI helpers ------------------------------ */
function bars(obj,n=8,fmt=k=>k,col=()=>'#7aa2ff',click){const e=Object.entries(obj).filter(([,v])=>v>.05).sort((a,b)=>(a[0]==='XX'||a[0]===UNK)-(b[0]==='XX'||b[0]===UNK)||b[1]-a[1]).slice(0,n);const mx=Math.max(...e.map(x=>x[1]),1);
  return `<div class="ix-bars">${e.map(([k,v])=>`<${click?`button data-${click}="${esc(k)}"`:'div'} class="ix-bar${k==='XX'||k===UNK?' unk':''}"><span>${esc(fmt(k))}</span><i><b style="width:${(v/mx*100).toFixed(1)}%;background:${col(k)}"></b></i><em>${pct(v)}</em></${click?'button':'div'}>`).join('')}</div>`}
const ccol=c=>c==='XX'?SEC_C[UNK]:'var(--acc)';
const scol=v=>v==null?'#3a4258':v>=75?'#3ddc84':v>=55?'#e8c66a':'#ff6b7d';
const tk=e=>esc(String(e.tk||e.t).slice(0,6));
function matrix(items,cell,note){if(items.length<2)return '';return `<div class="ix-mat" style="--n:${items.length}"><span></span>${items.map(x=>`<b title="${esc(x.name)}">${tk(x)}</b>`).join('')}${items.map((a,i)=>`<b title="${esc(a.name)}">${tk(a)}</b>`+items.map((b,j)=>cell(a,b,i,j)).join('')).join('')}</div>${note?`<p class="mp-note">${note}</p>`:''}`}

/* ------------------------------ PANEL «ANÁLISIS» (Portfolio) ------------------------------ */
/* P0 «¿Y si…?»: la pestaña Optimizar queda oculta hasta que P1 la sustituya (su código sigue intacto). */
const TABS=[['doctor','Doctor'],['explore','Explorar cambios'],['hold','Holdings'],['risk','Riesgo'],['geo','Países'],['comp','Empresas'],['sec','Sectores']];
function docTab(t){DOC.tab=t;saveDoc();if(typeof hubSec!=='undefined'&&hubSec==='doc')renderDoc();else openHub('doc')}
async function renderDoc(){const el=$('#ixdoc');if(!el)return;track('xray_open');
  el.innerHTML=`<div class="ix-top"><div class="ix-src"><button data-dsrc="pf" aria-pressed="${DOC.src==='pf'}">Mi cartera</button><button data-dsrc="custom" aria-pressed="${DOC.src==='custom'}">Cartera rápida</button></div>
    ${DOC.src==='custom'?pasteBox()+`<details class="qp-ed"><summary>Editar fila a fila</summary>${docEditor()}</details>`:''}<nav class="ix-tabs" role="tablist">${TABS.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${DOC.tab===k}">${l}</button>`).join('')}</nav></div><div id="ixdocOut"><div class="sk"><p>Analizando lo que hay dentro de cada ETF…</p><i></i><i></i><i></i><i></i></div></div>`;
  el.querySelectorAll('[data-dsrc]').forEach(b=>b.onclick=()=>{DOC.src=b.dataset.dsrc;saveDoc();renderDoc()});
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{DOC.tab=b.dataset.tab;saveDoc();el.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b));drawTab()});
  if(DOC.src==='custom'){bindEditor(el);bindPaste(el)}
  const out=$('#ixdocOut');if(DOC.src==='pf'&&!PF.length){out.innerHTML=`<div class="ix-empty"><h4>¿Cuántas apuestas reales hay en tu cartera?</h4><p>Pega tus ETFs y acciones con su peso: en 30 segundos verás qué tienes de verdad. No hace falta cuenta ni importes.</p><div class="ix-btns"><button class="btn" data-go="qp">Pegar mi cartera</button><button class="btn2" data-go="pf">Registrar con importes y fechas</button></div></div>`;
    out.querySelector('[data-go=pf]').onclick=()=>openHub('pf');out.querySelector('[data-go=qp]').onclick=()=>{DOC.src='custom';saveDoc();renderDoc().then(()=>{const t=$('#qpT');if(t)t.focus()})};return}
  const A=await analyze();if(A.empty){out.innerHTML='<p class="mp-note">Añade al menos un activo con su porcentaje.</p>';return}
  if($('#ixdocOut')!==out)return;drawTab()}
function loadExample(){const pick=t=>{const e=ents().find(x=>x.t===t);return e?{k:e.k,t:e.t}:null};DOC.src='custom';DOC.paste='VT 40\nSPY 25\nQQQ 15\nSMH 10\nEEM 10';DOC.qpMsg='';DOC.rows=[['VT',40],['SPY',25],['QQQ',15],['SMH',10],['EEM',10]].map(([t,w])=>{const p=pick(t);return p?{...p,w}:null}).filter(Boolean);saveDoc()}
function drawTab(){const out=$('#ixdocOut'),A=ANA;if(!out||!A||A.empty)return;if(DOC.tab==='opt')DOC.tab='doctor';out.innerHTML=({doctor:tabDoctor,explore:tabExplore,opt:tabOpt,hold:tabHold,risk:tabRisk,geo:tabGeo,comp:tabComp,sec:tabSec})[DOC.tab](A);
  out.querySelectorAll('[data-dx]').forEach(b=>{const [i,j]=b.dataset.dx.split(':').map(Number);b.onclick=()=>A.D[i].acts[j][1]()});
  out.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>({globe:()=>showExposureGlobe(A.P,A.name,'geo'),gcomp:()=>showExposureGlobe(A.P,A.name,'comp'),gsec:()=>showExposureGlobe(A.P,A.name,'sec'),comp:()=>docTab('comp'),why:()=>docTab('comp'),radar:()=>openRadar(),share:()=>shareXray(A),opt:()=>docTab('opt'),xc:()=>{DOC.xc=null;docTab('explore')}})[b.dataset.go]());
  out.querySelectorAll('[data-xc]').forEach(b=>b.onclick=()=>{const d=A.D[+b.dataset.xc];DOC.xc={kind:d.kind,ref:d.ref};docTab('explore')});
  out.querySelectorAll('[data-cty]').forEach(b=>b.onclick=()=>openCountry(b.dataset.cty,CNAME[b.dataset.cty]||b.dataset.cty));
  out.querySelectorAll('[data-secx]').forEach(b=>b.onclick=()=>{const d=b.nextElementSibling;if(d)d.hidden=!d.hidden});
  out.querySelectorAll('[data-pair]').forEach(s=>s.onchange=()=>{DOC.pair=[out.querySelector('[data-pair=a]').value,out.querySelector('[data-pair=b]').value];drawTab()});
  out.querySelectorAll('[data-holdx]').forEach(b=>b.onclick=()=>{const d=b.parentElement.querySelector('.ix-hd');d.hidden=!d.hidden;b.setAttribute('aria-expanded',!d.hidden)});
  out.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{FLOW=b.dataset.flow;out.querySelectorAll('[data-flow]').forEach(x=>x.setAttribute('aria-selected',x===b));const box=out.querySelector('.ix-flowbox');box.innerHTML=flowSVG(A,FLOW)});
  out.querySelectorAll('[data-dim]').forEach(g=>g.onclick=()=>{const w=out.querySelector('.ix-why');if(w)w.open=true;const d=out.querySelector(`.ix-dg[data-dg="${g.dataset.dim}"]`);if(d){d.querySelectorAll('.ix-sc').forEach(x=>x.open=true);d.scrollIntoView({block:'start',behavior:'smooth'});d.classList.add('flash');setTimeout(()=>d.classList.remove('flash'),1200)}});
  out.querySelectorAll('[data-gk]').forEach(g=>g.onclick=()=>{const w=out.querySelector('.ix-why');if(w)w.open=true;const d=out.querySelector(`.ix-sc[data-sk="${g.dataset.gk}"]`);if(d){d.open=true;d.scrollIntoView({block:'center',behavior:'smooth'});d.classList.add('flash');setTimeout(()=>d.classList.remove('flash'),1200)}});
  out.querySelectorAll('[data-comp]').forEach(b=>b.onclick=()=>focusCompany(A,b.dataset.comp));
  countUp(out);reveal(out);if(DOC.tab==='doctor')renderAlts(A);if(DOC.tab==='opt')renderOpt(A);if(DOC.tab==='explore')renderExplore(A)}
/* microinteracciones: números que cuentan una vez y secciones que aparecen al entrar en pantalla (respeta «reducir movimiento») */
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(root){if(RM())return;root.querySelectorAll('[data-count]').forEach(el=>{const to=+el.dataset.count;if(!isFinite(to)||el.dataset.done)return;el.dataset.done=1;const t0=performance.now(),d=700;const step=t=>{const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)})}
function reveal(root){const els=root.querySelectorAll('[data-reveal]');if(RM()||!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return}const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}}),{threshold:.15});els.forEach(e=>io.observe(e))}
/* --- Doctor --- */
/* frase editorial: la conclusión más importante en una línea */
function headline(A){const {L,SC,P}=A;const ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]),cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);
  const nF=L.nFunds,what=nF>1?`${nF} ETFs y fondos`:nF?'1 fondo':`${P.length} acciones`;let main=null;
  if(ss[0]&&ss[0][1]>=30)main=`el ${pct(ss[0][1],0)} de tu exposición está en ${ss[0][0].toLowerCase()}`;else if(cs[0]&&cs[0][1]>=65)main=`el ${pct(cs[0][1],0)} depende de ${CNAME[cs[0][0]]||cs[0][0]}`;else if(SC.top10>=30)main=`tus 10 mayores empresas suman al menos el ${pct(SC.top10,0)}`;
  return main?`Tu cartera está repartida en ${what}, pero ${main}.`:`Tu cartera está repartida en ${what} y sin una concentración dominante.`}
const hLabel=h=>h==null?['SIN DATOS','#8fa3bd']:h>=75?['BUENA','#3ddc84']:h>=55?['MEJORABLE','#e8c66a']:['DÉBIL','#ff6b7d'];
/* Salud: 11 componentes agrupados en 4 dimensiones (media simple de los disponibles en cada una; la salud total no cambia) */
const DIMS=[['dv','Diversificación','¿Cuántas apuestas distintas haces?',['div','bets','ovl']],['cn','Concentración','¿Depende de pocas empresas, sectores o países?',['comp','sec','geo','conc']],['rk','Riesgo','¿Cuánto oscila y cuánto llegó a caer?',['vol','dd','corr']],['co','Coste','¿Cuánto pagas en comisiones?',['cost']]];
const dimOf=(SC,keys)=>{const v=keys.map(k=>SC.S[k]).filter(x=>x!=null);return v.length?v.reduce((a,x)=>a+x,0)/v.length:null};
/* indicador de salud: un solo arco (valor 0–100), sin segmentos anónimos */
function gauge(SC,size=180){const r=size*.4,cx=size/2,cy=size*.52,a0=-210,a1=30,h=SC.health,[lab,col]=hLabel(h);
  const pt=a=>[cx+r*Math.cos(a*Math.PI/180),cy+r*Math.sin(a*Math.PI/180)];const arc=(s1,s2)=>{const [x1,y1]=pt(s1),[x2,y2]=pt(s2);return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${s2-s1>180?1:0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`};
  const e=a0+(a1-a0)*Math.max(.01,Math.min(1,(h||0)/100));
  return `<svg class="ix-gauge" viewBox="0 0 ${size} ${size*.86}" role="img" aria-label="Salud ${h==null?'sin datos':Math.round(h)} de 100"><path d="${arc(a0,a1)}" stroke="rgba(255,255,255,.08)" stroke-width="${size*.06}" fill="none" stroke-linecap="round"/>${h==null?'':`<path d="${arc(a0,e)}" stroke="${scol(h)}" stroke-width="${size*.06}" fill="none" stroke-linecap="round" style="--i:0"/>`}
    <text x="${cx}" y="${cy+size*.06}" font-size="${size*.26}" text-anchor="middle" class="g-n" data-count="${h==null?'':Math.round(h)}">${h==null?'—':Math.round(h)}</text><text x="${cx}" y="${cy+size*.2}" font-size="${Math.max(size*.075,9)}" text-anchor="middle" class="g-s" fill="${col}">${lab}</text></svg>`}
/* Flujo «Tu exposición real»: ETFs → empresas / sectores / países (cintas proporcionales, datos reales; lo no publicado = «No desglosado») */
let FLOW='comp';
function flowSVG(A,mode){const {P,L}=A,W=340,H=280,top=8,x0=8,bw=10,x1=W-150;const left=P.slice().sort((a,b)=>b.w-a.w);
  let right=[];if(mode==='comp'){const cs=L.comps.slice(0,8);right=cs.map(c=>({k:c.key,l:c.name,v:c.w,by:c.by.map(b=>({e:b.e,p:b.w}))}));const rest=Math.max(0,100-cs.reduce((a,c)=>a+c.w,0));const topS=cs.reduce((a,c)=>a+c.w,0),vv=Math.min(rest,topS*.7);right.push({k:'_r',l:`Resto ${pct(rest,0)}${vv<rest?' *':''}`,v:rest,vv,unk:true,noPct:true,by:left.map(x=>{const used=cs.reduce((a,c)=>a+(c.by.find(b=>b.e===x.e)||{w:0}).w,0);return{e:x.e,p:Math.max(0,x.w*100-used)}})})}
  else{const src=mode==='sec'?L.byS:L.byC,tot=mode==='sec'?L.S:L.C,keys=Object.keys(tot).filter(k=>k!=='XX'&&k!==UNK).sort((a,b)=>tot[b]-tot[a]),main=keys.slice(0,6),oth=keys.slice(6);
    right=main.map(k=>({k,l:mode==='sec'?k:CNAME[k]||k,v:tot[k],by:src[k]||[]}));if(oth.length){const by=new Map();oth.forEach(k=>(src[k]||[]).forEach(b=>by.set(b.e,(by.get(b.e)||0)+b.p)));right.push({k:'_o',l:`Otros ${oth.length}`,v:oth.reduce((a,k)=>a+tot[k],0),by:[...by].map(([e,p])=>({e,p}))})}
    const uk=mode==='sec'?UNK:'XX';if(tot[uk]>.3)right.push({k:uk,l:'No desglosado',v:tot[uk],unk:true,by:src[uk]||[]})}
  const sumR=right.reduce((a,x)=>a+(x.vv??x.v),0)||100,gapL=4,gapR=4,hL=H-top*2-gapL*(left.length-1),hR=H-top*2-gapR*(right.length-1);
  let y=top;const L0=left.map(x=>{const h=Math.max(2,x.w*hL);const o={e:x.e,y,h,cur:y};y+=h+gapL;return o});y=top;const R0=right.map(x=>{const h=Math.max(2,(x.vv??x.v)/sumR*hR);const o={...x,y,h,cur:y};y+=h+gapR;return o});
  const rib=[];L0.forEach((l,li)=>R0.forEach(r=>{const b=r.by.find(z=>z.e===l.e);if(!b||b.p<=.05)return;const hl=b.p/(l.e?P.find(x=>x.e===l.e).w*100:1)*l.h,hr=b.p/r.v*r.h;
    const ya=l.cur,yb=r.cur;l.cur+=hl;r.cur+=hr;const xa=x0+bw,xb=x1,mx=(xa+xb)/2;rib.push(`<path class="rb${r.unk?' unk':''}" d="M${xa} ${ya}C${mx} ${ya} ${mx} ${yb} ${xb} ${yb}L${xb} ${yb+hr}C${mx} ${yb+hr} ${mx} ${ya+hl} ${xa} ${ya+hl}Z" style="--d:${li*60}ms"><title>${esc(l.e.name)} → ${esc(r.l)}: ${pct(b.p,1)}</title></path>`)}));
  return `<svg class="ix-flow" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cómo se reparten tus productos">${rib.join('')}
    ${L0.map(l=>`<rect x="${x0}" y="${l.y}" width="${bw}" height="${l.h}" rx="2" class="nl"/>${l.h>11?`<text x="${x0+bw+5}" y="${l.y+Math.min(l.h/2+4,13)}" class="tl">${esc(String(l.e.tk))}</text>`:''}`).join('')}
    ${R0.map(r=>`<rect x="${x1}" y="${r.y}" width="${bw}" height="${r.h}" rx="2" class="nr${r.unk?' unk':''}"/>${r.h>9?`<text x="${x1+bw+6}" y="${r.y+Math.min(r.h/2+4,12)}" class="tr${r.unk?' unk':''}">${esc(r.noPct?r.l:r.l.length>18?r.l.slice(0,17)+'…':r.l)}${r.noPct?'':` <tspan>${pct(r.v,r.v<10?1:0)}</tspan>`}</text>`:''}`).join('')}</svg>${right.some(r=>r.vv!=null&&r.vv<r.v)?'<p class="mp-note">* La barra «Resto» (empresas no publicadas o más pequeñas) está acortada para que se lean las mayores.</p>':''}`}
/* «Apuestas reales»: grupos que salen de betsOf (correlación semanal ≥ 0,85, 5 años). Solo se afirma lo que dicen los datos. */
function betGroups(A){const {R,P,SC}=A;if(!R||!SC.bets)return null;const idx=e=>R.assets.indexOf(e),cc=(a,b)=>{const i=idx(a),j=idx(b);return i<0||j<0?null:R.M[Math.max(i,j)]&&R.M[i][j]!=null?R.M[i][j]:(R.M[j]?R.M[j][i]:null)};
  return SC.bets.groups.map((g,gi)=>{const GP=g.m.map(e=>({e,w:P.find(x=>x.e===e).w/g.w})),Lg=lookThrough(GP);
    const c=Object.entries(Lg.C).filter(([k])=>k!=='XX').sort((a,b)=>b[1]-a[1])[0],s=Object.entries(Lg.S).filter(([k])=>k!==UNK&&k!=='Otros').sort((a,b)=>b[1]-a[1])[0],em=Object.entries(Lg.C).filter(([k])=>EM.has(k)).reduce((a,[,v])=>a+v,0);
    const parts=[];if(em>=50)parts.push('Emergentes');else if(c&&c[1]>=50)parts.push(CNAME[c[0]]||c[0]);else if(Lg.ccCover>50)parts.push('Global');if(s&&s[1]>=30)parts.push(s[0]);
    const pr=[];g.m.forEach((a,i)=>g.m.slice(i+1).forEach(b=>{const v=cc(a,b);if(v!=null)pr.push(v)}));
    const others=P.filter(x=>!g.m.includes(x.e)).map(x=>cc(g.m[0],x.e)).filter(v=>v!=null);const noPx=g.m.filter(e=>idx(e)<0);
    return{...g,label:parts.join(' · ')||'Sin desglose suficiente',avg:pr.length?pr.reduce((a,v)=>a+v,0)/pr.length:null,min:pr.length?Math.min(...pr):null,maxOut:g.m.length===1&&others.length?Math.max(...others):null,noPx}})}
const c2=v=>v.toFixed(2).replace('.',',');
const fmtB=v=>v<3?num(v,1):String(Math.round(v));
const CONF_L={high:['Confianza alta','Precios semanales de 5 años de todos tus productos.'],medium:['Confianza media','Algún producto tiene menos historial de precios o el resultado varía según el periodo.'],low:['Confianza baja','Faltan precios de una parte de la cartera: esa parte se cuenta como independiente y la cifra puede estar inflada.']};
function wowBlock(A){const {L,SC,P,R}=A,n=P.length,B=SC.bets,RB=B&&B.rob,G=betGroups(A);
  if(!RB||n<2)return `<section class="ix-wow" data-reveal><div class="wv"><div><b>${n}</b><span>producto${n>1?'s':''}</span></div><i>→</i><div class="hot"><b>${L.uniq.hi?`${num(L.uniq.lo)}–${num(L.uniq.hi)}`:`≥ ${num(L.uniq.lo)}`}</b><span>empresas por debajo</span></div></div>${n<2?'':'<p class="wv-t">Sin historial de precios suficiente para estimar cuántas apuestas independientes haces.</p>'}</section>`;
  const nb=RB.main,few=nb<n*.6,rng=RB.cls==='sensitive'&&fmtB(RB.lo)!==fmtB(RB.hi),pl=nb>=1.05;
  const big=rng?`${fmtB(RB.lo)}–${fmtB(RB.hi)}`:`≈ ${fmtB(nb)}`;
  const chips=P.slice().sort((a,b)=>b.w-a.w).map(x=>`<span class="bt-chip">${tk(x.e)}</span>`).join('');
  const multi=G.filter(g=>g.m.length>1);
  const grp=G.map((g,i)=>`<div class="bt-g${g.m.length>1?' many':''}"><div class="bt-gh"><b>Grupo ${i+1}</b><span>${esc(g.label)}</span><em>${pct(g.w*100,0)}</em></div>
      <ul>${g.m.slice().sort((a,b)=>P.find(x=>x.e===b).w-P.find(x=>x.e===a).w).map(e=>`<li><span class="bt-tk">${tk(e)}</span><span class="bt-nm">${esc(e.name)}</span><em>${pct(P.find(x=>x.e===e).w*100,0)}</em></li>`).join('')}</ul>
      <p class="bt-n">${g.m.length>1?`Suben y bajan casi a la vez: correlación semanal media ${c2(g.avg)} entre ellos${g.min!=null&&g.m.length>2?` (la pareja más distinta, ${c2(g.min)})`:''}.`:g.noPx.length?'Sin historial de precios suficiente: se cuenta aparte, aunque podría no serlo.':g.maxOut!=null?`Correlación máxima con el resto: ${c2(g.maxOut)}. ${g.maxOut>=.5?'No se mueve igual, pero se parece: cuenta solo en parte como apuesta distinta.':'Se mueve bastante por su cuenta.'}`:''}</p></div>`).join('<i class="bt-plus">+</i>');
  /* exposición consolidada: acciones que tienes directamente y además dentro de tus ETFs */
  const dup=P.filter(x=>x.e.k==='s').map(x=>{const c=L.comps.find(c=>c.by.some(b=>b.e===x.e)&&c.by.some(b=>b.e!==x.e));return c?{c,via:c.by.filter(b=>b.e!==x.e)}:null}).filter(Boolean);
  const [cl,cd]=CONF_L[RB.conf];
  return `<section class="ix-wow" data-reveal>
    <div class="wv"><div><b data-count="${n}">${n}</b><span>productos</span></div><i>→</i><div class="hot"><b>${big}</b><span>apuesta${pl?'s':''} independiente${pl?'s':''}</span></div></div>
    <p class="wv-t">${few?`Tienes ${n} productos, pero por cómo se han movido equivalen a ${rng?'entre '+fmtB(RB.lo)+' y '+fmtB(RB.hi):'unas '+fmtB(nb)} apuesta${pl?'s':''} independiente${pl?'s':''}.`:`Tienes ${n} productos y se mueven de forma bastante distinta entre sí.`}</p>
    <p class="wv-c"><span class="cf ${RB.conf}">${cl}</span>${RB.cls==='robust'?'Resultado estable: con 3 años de datos sale casi lo mismo.':RB.cls==='moderate'?`Varía algo según el periodo: ${fmtB(RB.lo)}–${fmtB(RB.hi)}.`:RB.cls==='sensitive'?'Resultado sensible al periodo analizado: por eso se muestra un rango.':''}</p>
    <div class="ix-btns"><button class="btn2 sm" data-go="share">Compartir mis rayos X</button></div>
    <div class="ix-k">¿Por qué?</div>
    <div class="bt-chips">${chips}</div><div class="bt-arrow">↓</div>
    <div class="bt-gs">${grp}</div>
    ${multi.length||G.length>1?`<p class="bt-sum">La cifra no es el número de grupos: también cuenta el parecido parcial entre grupos y cuánto oscila cada producto. Por eso sale ${big} y no ${G.length}.</p>`:''}
    ${dup.map(d=>`<p class="bt-dup"><b>${esc(d.c.name)}</b>: la tienes directamente y también dentro de ${(v=>v.length>1?v.slice(0,-1).join(', ')+' y '+v[v.length-1]:v[0])(d.via.map(b=>tk(b.e)))}. Exposición total ≥ ${pct(d.c.w,1)} de tu cartera. En la cifra de apuestas no se cuenta dos veces: los precios de esos ETFs ya la incluyen.</p>`).join('')}
    <details class="bt-meth"><summary>¿Qué significa «apuestas independientes»?</summary>
      <p>ATLAS estima cuántas apuestas <b>diferenciadas en riesgo</b> contiene tu cartera, no cuántos productos tienes. Si dos productos han subido y bajado casi a la vez, cuentan como una sola; si se parecen a medias, cuentan a medias.</p>
      <p class="bt-mh">Método</p><ul><li>Correlación de rentabilidades <b>semanales en euros</b>, últimos <b>5 años</b>${R&&R.grid?` (hasta ${fdate(R.grid[R.grid.length-1])})`:''}.</li><li>Cifra = ratio de diversificación al cuadrado: (Σ peso × volatilidad)² ÷ volatilidad de la cartera². Las correlaciones negativas cuentan como 0 (prudente).</li><li>Sin umbral elegido a mano. Comprobación de estabilidad: se repite con 3 años (${fmtB(RB.d5)} con 5 años · ${RB.d3!=null?fmtB(RB.d3):'n/d'} con 3 años).</li><li>Los grupos de arriba (correlación ≥ 0,85) solo explican de dónde viene el parecido.</li></ul>
      <p class="bt-mh">Limitaciones</p><ul><li>Las correlaciones históricas pueden cambiar, sobre todo en crisis (suelen subir).</li><li>Es una estimación estadística, no una clasificación económica: dos productos poco correlacionados no son necesariamente apuestas económicas independientes.</li><li>Usa precios, no la composición: no depende de conocer todas las posiciones de cada ETF.</li></ul></details>
    ${XPT()?`<div class="xr-rob"><div class="ix-k">X-ray robustness · modo experto</div><table><tbody>
      ${RB.T.map(t=>`<tr><th>Grupos con umbral ${String(t.th).replace('.',',')}</th><td>${num(t.nb,2)}</td></tr>`).join('')}
      <tr class="hl"><th>Sin umbral · 5 años (cifra mostrada)</th><td>${num(RB.d5,2)}</td></tr><tr><th>Sin umbral · 3 años</th><td>${RB.d3!=null?num(RB.d3,2):'n/d'}</td></tr>
      <tr><th>Estabilidad</th><td>${({robust:'Robusta',moderate:'Moderada',sensitive:'Sensible',na:'n/d'})[RB.cls]}</td></tr>
      <tr><th>Semanas de precios comunes</th><td>${RB.weeks}</td></tr><tr><th>Peso sin precios</th><td>${pct(RB.noPx*100,0)}</td></tr>
      <tr><th>Composición conocida (holdings)</th><td>${pct(L.cover,0)}</td></tr><tr><th>Confianza de la cifra</th><td>${({high:'ALTA',medium:'MEDIA',low:'BAJA'})[RB.conf]}</td></tr></tbody></table>
      <p class="mp-note">La composición conocida afecta a empresas, solapamiento y concentración; la cifra de apuestas usa solo precios.</p></div>`:''}
  </section>`}
/* ---------- Tarjeta compartible «Rayos X» (sin importes; los productos solo si el usuario lo elige) ---------- */
function xrayFacts(A){const {L,SC,P}=A,ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1])[0],cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1])[0],c1=L.comps[0];
  return [ss&&[`${ss[0]}`,`${pct(ss[1],0)} de la exposición`],cs&&[CNAME[cs[0]]||cs[0],`${pct(cs[1],0)} de la exposición`],SC.top10&&['10 mayores empresas',`≥ ${pct(SC.top10,0)}`],c1&&[c1.name.replace(/ (Corp|Inc|Ltd|Co|Corporation|Class [A-C])\b.*$/,''),`≥ ${pct(c1.w,1)}`]].filter(Boolean)}
function drawXray(A,withP){const W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),F='"Plus Jakarta Sans",Inter,system-ui,sans-serif';
  g.fillStyle='#05070c';g.fillRect(0,0,W,H);const rg=g.createRadialGradient(160,120,0,160,120,900);rg.addColorStop(0,'rgba(94,231,255,.13)');rg.addColorStop(1,'rgba(94,231,255,0)');g.fillStyle=rg;g.fillRect(0,0,W,H);
  const T=(t,x,y,sz,w,c,al)=>{g.font=`${w} ${sz}px ${F}`;g.fillStyle=c;g.textAlign=al||'left';g.fillText(t,x,y)};const n=A.P.length,nb=A.SC.bets?A.SC.bets.nb:null;
  T('ATLAS',90,140,34,800,'#5ee7ff');T('RAYOS X DE CARTERA',250,140,26,700,'#6b7a90');
  T(String(n),90,380,150,800,'#8a97ab');T(n===1?'PRODUCTO':'PRODUCTOS',95,440,30,700,'#6b7a90');
  if(nb!=null){T('→',330,350,80,500,'#3a4558');T('≈ '+fmtB(nb),450,380,190,800,'#ffffff');T(nb>=1.05?'APUESTAS INDEPENDIENTES':'APUESTA INDEPENDIENTE',462,440,28,800,'#5ee7ff')}
  let y=560;g.fillStyle='rgba(255,255,255,.07)';g.fillRect(90,y-50,W-180,2);
  y+=30;xrayFacts(A).forEach(([k,v])=>{T(k.length>24?k.slice(0,23)+'…':k,90,y+20,44,600,'#cfd8e6');T(v,W-90,y+20,48,800,'#ffffff','right');y+=118});
  if(withP){y+=10;T('Productos: '+A.P.slice().sort((a,b)=>b.w-a.w).map(x=>String(x.e.tk)).join(' · ').slice(0,60),90,y+10,30,600,'#8a97ab')}
  T('Estimación por correlación semanal (5 años, en euros) · composición publicada',90,H-188,24,500,'#55627a');T('por justETF y Yahoo Finance · '+fdate(A.asof),90,H-152,24,500,'#55627a');
  T('Análisis, no una recomendación de inversión.',90,H-116,24,500,'#55627a');T('acorchete16.github.io/ProjectATLAS',90,H-60,30,700,'#5ee7ff');return cv}
async function shareXray(A){let m=$('#xrs');if(m)m.remove();m=document.createElement('div');m.id='xrs';m.className='xrs';document.body.appendChild(m);let withP=false;
  const draw=()=>{const cv=drawXray(A,withP);const url=cv.toDataURL('image/png');m.innerHTML=`<div class="xrs-b" role="dialog" aria-label="Compartir rayos X"><div class="xrs-h"><b>Comparte tus rayos X</b><button class="x-close" data-x aria-label="Cerrar">✕</button></div><img src="${url}" alt="Tarjeta de rayos X de la cartera"><label class="xrs-c"><input type="checkbox" data-p${withP?' checked':''}> Mostrar mis productos</label><p class="xrs-n">Nunca incluye importes. Solo lo que ves en la imagen.</p><div class="xrs-a"><button class="btn" data-s>Compartir</button><button class="btn2" data-d>Descargar</button></div></div>`;
    m.querySelector('[data-x]').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};m.querySelector('[data-p]').onchange=e=>{withP=e.target.checked;draw()};
    const blob=()=>new Promise(r=>cv.toBlob(r,'image/png'));const dl=async()=>{const a=document.createElement('a');a.href=url;a.download='atlas-rayos-x.png';a.click()};
    m.querySelector('[data-d]').onclick=dl;m.querySelector('[data-s]').onclick=async()=>{try{const f=new File([await blob()],'atlas-rayos-x.png',{type:'image/png'});const txt=`Tengo ${A.P.length} productos, pero según ATLAS equivalen a ≈ ${fmtB(A.SC.bets.nb)} apuestas independientes.`;
      if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],text:txt});else{await dl();toast('Imagen descargada')}}catch(_){}}};
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;draw()}
function flowBlock(A){const {L,SC}=A,nC=Object.entries(L.C).filter(([c,v])=>c!=='XX'&&v>=.05).length;
  return `<section class="ix-flowsec" data-reveal><div class="ix-k">Dónde está tu dinero por dentro</div>
    <nav class="ix-seg2" role="tablist">${[['comp','Empresas'],['sec','Sectores'],['country','Países']].map(([k,l])=>`<button role="tab" data-flow="${k}" aria-selected="${FLOW===k}">${l}</button>`).join('')}</nav>
    <div class="ix-flowbox">${flowSVG(A,FLOW)}</div>
    <p class="w3">Expuesta a <b>${L.uniq.hi?`${num(L.uniq.lo)}–${num(L.uniq.hi)}`:`≥ ${num(L.uniq.lo)}`}</b> empresas en <b>${nC}</b> países. Las 10 mayores suman <b>≥ ${pct(SC.top10,1)}</b>.</p>
    <div class="ix-btns"><button class="btn2 sm" data-go="why">Ver solapamientos</button><button class="btn sm" data-go="globe">Explorar en el globo</button></div>
    ${srcl('justETF + Yahoo Finance',A.asof,'Países y sectores publicados · empresas: 10 mayores posiciones de cada ETF')}</section>`}
function healthBlock(A){const {SC}=A,[lab,col]=hLabel(SC.health),H=SC.health==null?'—':Math.round(SC.health);
  const blocks=v=>{const n=v==null?0:Math.max(v>0?1:0,Math.round(v/20));return Array.from({length:5},(_,i)=>`<b class="${i<n?'on':''}" style="${i<n?`background:${scol(v)}`:''}"></b>`).join('')};
  const sc=(k)=>{const [t,q,how,src]=SCORE_DOC[k],v=SC.S[k];return `<details class="ix-sc" data-sk="${k}"${XPT()?' open':''}><summary><span>${t}</span><i><b style="width:${v??0}%;background:${scol(v)}"></b></i><em>${v==null?'n/d':Math.round(v)}</em></summary><div class="ix-scd"><p class="q">${q}</p>${v==null?'<p>No calculable con los datos disponibles.</p>':`<ul>${(SC.ev[k]||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}<p class="how"><b>Cálculo:</b> ${how}</p><p class="how"><b>Datos:</b> ${src}</p></div></details>`};
  return `<div class="ix-k">Salud de la cartera</div><section class="ix-hero hx">
    <div class="hx-top"><div class="hx-n"><b data-count="${H}">${H}</b><span style="color:${col}">${lab}</span></div><p class="ix-lead">${esc(headline(A))}</p></div>
    <div class="hx-dims">${DIMS.map(([id,t,q,keys])=>{const v=dimOf(SC,keys);return `<button class="hx-d" data-dim="${id}" title="${esc(q)}"><span>${t}</span><i>${blocks(v)}</i><em>${v==null?'n/d':Math.round(v)}</em></button>`}).join('')}</div>
    <details class="ix-why"${XPT()?' open':''}><summary>¿Por qué ${H}?</summary><div class="ix-scores">${DIMS.map(([id,t,q,keys])=>{const v=dimOf(SC,keys);return `<div class="ix-dg" data-dg="${id}"><h5>${t}<em>${v==null?'n/d':Math.round(v)}</em></h5><p class="q">${q}</p>${keys.map(sc).join('')}</div>`}).join('')}</div><p class="mp-note">Salud = media simple de ${Object.keys(SC.S).length} componentes${SC.miss.length?` (${SC.miss.length} sin datos suficientes)`:''}; cada dimensión es la media de los suyos. Umbrales de ATLAS, no normas del mercado.</p></details></section>`}
function dxBlock(A){const shown=A.D.filter(d=>d.sev!=='info'),info=A.D.filter(d=>d.sev==='info');
  const card=(d)=>{const i=A.D.indexOf(d),[ico,lab,c]=SEV[d.sev];return `<article class="ix-dx" style="--c:${c}"><div class="dx-l"><span class="dx-sev">${ico} ${lab}</span><h4>${esc(d.t)}</h4><p class="dx-big">${esc(d.metric)}</p><p>${esc(d.exp)}</p><p class="dx-why"><b>¿Por qué?</b> ${esc(d.evid)}</p>${srcl(d.src,d.date)}</div>${d.acts.length||d.kind?`<div class="ix-btns">${d.acts.map((a,j)=>`<button class="lnk" data-dx="${i}:${j}">${a[0]} →</button>`).join('')}${d.kind?`<button class="lnk xc-l" data-xc="${i}">Explorar cambios →</button>`:''}</div>`:''}</article>`};
  return `<section><div class="ix-k">Lo importante</div>${shown.map(card).join('')}${info.map(card).join('')}</section>`}
function tabDoctor(A){return wowBlock(A)+flowBlock(A)+healthBlock(A)+`<section class="xc-teaser"><div><b>Explorar cambios</b><span>Explora modificaciones de tu cartera y compara su impacto métrica a métrica. ATLAS no selecciona una opción ganadora.</span></div><button class="btn sm" data-go="xc">Explorar</button></section>`+dxBlock(A)+`<section><div class="ix-k">Escenarios para comparar</div><div id="ixAlt"><div class="sk"><i></i><i></i><i></i></div></div></section><p class="ix-src2">${SOURCES} Herramienta de análisis: no es una recomendación de inversión.</p>`}
async function renderAlts(A){const box=$('#ixAlt');if(!box)return;const alts=await altPortfolios(),rows=await Promise.all(alts.map(async a=>{const L=lookThrough(a.P),R=await riskOf(a.P);return{...a,L,R,SC:docScores(L,R,a.P)}}));if(!$('#ixAlt'))return;
  const ts=L=>{const s=Object.entries(L.S).filter(([k])=>k!==UNK&&k!=='Otros').sort((a,b)=>b[1]-a[1])[0];return s?`${s[0]} ${pct(s[1],0)}`:'—'};const em=L=>Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  const met=(o)=>[['Supuesto de rentabilidad',o.assume==null?'n/d':pct(o.assume,1)+'/año'],['Volatilidad',o.R?pct(o.R.vol,0):'—'],['Caída máx.',o.R?pct(o.R.dd,0):'—'],['EE. UU.',pct(o.L.C.US||0,0)],['Emergentes',pct(em(o.L),0)],['1er sector',ts(o.L)],['10 mayores empresas',o.SC.top10?'≥ '+pct(o.SC.top10,0):'—'],['Coste (TER)',o.L.ter==null?'—':pct(o.L.ter,2)]];
  const cur={L:A.L,R:A.R,SC:A.SC,assume:assumeOf(A.P)};
  $('#ixAlt').innerHTML=`<p class="mp-note">Tres escenarios cuantitativos (conservador, equilibrado, crecimiento) para comparar con tu cartera actual. No son recomendaciones.</p>
    ${(()=>{const cols=[{name:'Tu cartera',...cur,cur:true},...rows],M=cols.map(met);return `<div class="alt-tw"><table class="alt-t"><thead><tr><th></th>${cols.map(o=>`<th class="${o.cur?'cur':''}">${esc(o.name)}</th>`).join('')}</tr></thead><tbody>${M[0].map(([k],r)=>`<tr><th>${k}</th>${M.map((m,c)=>`<td class="${c===0?'cur':''}">${m[r][1]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`})()}
    <div class="alt-x">${rows.map((o,i)=>`<details class="alt-d"><summary><b>${esc(o.name)}</b><span>${esc(o.txt)} · qué cambia</span></summary><p class="ix-to">${esc(tradeoff(cur,o))}</p><p class="ix-comp">${o.P.map(x=>`${tk(x.e)} ${Math.round(x.w*100)} %`).join(' · ')}</p><button class="btn2 sm" data-cmpalt="${i}">Comparar con la actual</button></details>`).join('')}</div>
    <p class="mp-note">«Supuesto de rentabilidad»: hipótesis del modelo de ATLAS (${basis==='hist'?'rentabilidad histórica de 10 años de cada activo':'estimación prospectiva'}; cámbiala en Ajustes), no una previsión. Volatilidad y caída: historia de 5 años en euros con los pesos de hoy. No es asesoramiento personalizado.</p>`;
  $('#ixAlt').querySelectorAll('[data-cmpalt]').forEach(b=>b.onclick=()=>{const a=rows[+b.dataset.cmpalt];openCompare({name:A.name,P:A.P},{name:a.ico+' '+a.name,P:a.P})})}
/* --- Holdings --- */
function tabHold(A){const P=A.P.slice().sort((a,b)=>b.w-a.w);const share=d=>{const s={real:0,proxy:0,partial:0,none:0};P.forEach(x=>s[expOf(x.e).q[d]]+=x.w*100);return s};
  const sum=d=>{const s=share(d);return Object.entries(s).filter(([,v])=>v>.5).map(([q,v])=>`${qb(q)} ${pct(v,0)}`).join(' ')};
  return `<section class="ix-card"><div class="ix-k">Calidad de los datos de tu cartera</div><dl class="ix-ql"><div><dt>Países</dt><dd>${sum('country')}</dd></div><div><dt>Sectores</dt><dd>${sum('sector')}</dd></div><div><dt>Empresas</dt><dd>${sum('companies')}</dd></div></dl>
    <p class="mp-note"><b>DATO REAL</b>: desglose completo publicado. <b>APROXIMACIÓN</b>: tomado del ETF europeo que replica el mismo índice. <b>PARCIAL</b>: solo una parte (p. ej. 10 mayores posiciones); el resto se muestra como «no desglosado», nunca se reparte. <b>SIN DATOS</b>: la fuente no lo publica.</p></section>
    <section>${P.map(({e,w})=>{const x=expOf(e);const und=x.kind==='fund'&&x.hold.length?Math.max(0,100-x.cover):null;return `<article class="ix-ho"><button class="ix-hh" data-holdx aria-expanded="false"><span class="ix-hw">${pct(w*100,1)}</span><span class="ix-hn"><b>${esc(e.name)}</b><small>${tk(e)} · ${e.k==='s'?'Acción':e.k==='f'?'Fondo':'ETF'}${x.n&&e.k!=='s'?` · ${num(x.n)} posiciones`:''}</small></span><span class="ix-hq"><span>Países ${qb(x.q.country)}</span><span>Empresas ${qb(x.q.companies)}</span></span></button>
      <div class="ix-hd" hidden>${e.k!=='s'?decomp(x):''}${x.hold.length&&e.k!=='s'?`<details${XPT()?' open':''}><summary class="lnk">Ver tabla de posiciones</summary><table class="ix-tbl"><thead><tr><th>Empresa</th><th>País</th><th>Peso en el ETF</th><th>En tu cartera</th></tr></thead><tbody>${x.hold.map(h=>`<tr><td>${esc(h.name)}</td><td>${esc(h.cc)}</td><td>${pct(h.w,2)}</td><td>${pct(h.w*w,2)}</td></tr>`).join('')}<tr class="unk"><td colspan="2">No desglosado / datos insuficientes</td><td>${pct(und,1)}</td><td>${pct(und*w,1)}</td></tr></tbody></table></details>`:e.k==='s'?'<p class="mp-note">Acción individual: 100 % en la propia empresa.</p>':'<p class="mp-note">La fuente no publica sus posiciones.</p>'}
        ${srcl(x.src+(x.proxyIsin?` · aproximación por índice (${x.proxyIsin})`:''),x.asof,e.k==='s'?'Acción':`Países ${QL[x.q.country][0].toLowerCase()} · sectores ${QL[x.q.sector][0].toLowerCase()} · empresas ${QL[x.q.companies][0].toLowerCase()}`)}</div></article>`}).join('')}</section>`}
/* ETF → empresas → sectores → países: tres barras apiladas con lo publicado; lo no publicado en gris */
function stack(entries,lab,unkKey){const tot=entries.reduce((a,[,v])=>a+v,0)||100;const main=entries.filter(([k])=>k!==unkKey).sort((a,b)=>b[1]-a[1]),top=main.slice(0,6),rest=main.slice(6).reduce((a,[,v])=>a+v,0),unk=entries.filter(([k])=>k===unkKey).reduce((a,[,v])=>a+v,0)+Math.max(0,100-tot);
  const segs=[...top.map(([k,v],i)=>({l:lab(k),v,o:1-i*.12})),...(rest>.3?[{l:'Otros',v:rest,o:.25}]:[]),...(unk>.3?[{l:'No desglosado',v:unk,u:1}]:[])];
  return `<div class="stk">${segs.map(s=>`<i style="flex:${s.v};${s.u?'':`opacity:${Math.max(.2,s.o)}`}" class="${s.u?'u':''}" title="${esc(s.l)} ${pct(s.v,1)}"></i>`).join('')}</div><p class="stk-l">${segs.slice(0,4).map(s=>`<span class="${s.u?'u':''}">${esc(s.l)} <b>${pct(s.v,s.v<10?1:0)}</b></span>`).join('')}</p>`}
function decomp(x){return `<div class="ix-dc"><div><h6>Empresas ${qb(x.q.companies)}</h6>${x.hold.length?stack([...x.hold.map(h=>[h.name,h.w]),['_u',Math.max(0,100-x.cover)]],k=>k,'_u'):'<p class="mp-note">No publicado.</p>'}</div>
  <div><h6>Sectores ${qb(x.q.sector)}</h6>${stack(Object.entries(x.sector),k=>k,UNK)}</div><div><h6>Países ${qb(x.q.country)}</h6>${stack(Object.entries(x.country),k=>CNAME[k]||k,'XX')}</div></div>`}
/* --- Riesgo --- */
function tabRisk(A){const R=A.R;if(!R)return '<p class="mp-note">No hay precios suficientes para calcular el riesgo.</p>';
  const hi=[];if(R.M.length>1)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j>i&&R.M[i][j]!=null)hi.push([a,b,R.M[i][j]])}));hi.sort((x,y)=>y[2]-x[2]);
  return `<section class="ix-card"><div class="ix-k">Riesgo histórico</div><div class="ix-kpi"><div><span>Volatilidad anual</span><b>${pct(R.vol)}</b></div><div><span>Caída máxima</span><b class="dn">${pct(R.dd)}</b></div><div><span>Peor año móvil</span><b class="dn">${pct(R.worst12)}</b></div><div><span>Un mal año (percentil 5)</span><b>${pct(R.p5)}</b></div></div>
    <p class="ix-msg">En los últimos ${Math.round(R.weeks/52)} años, con tu reparto de hoy, la peor caída habría sido de ${pct(Math.abs(R.dd),0)} y en el peor año habrías perdido un ${pct(Math.abs(R.worst12||0),0)}.</p>${srcl('Yahoo Finance (precios semanales en euros)',R.grid[R.grid.length-1],'Histórico, no previsión')}</section>
    <section class="ix-card"><div class="ix-k">Correlación entre tus activos</div>${R.M.length>1?`<p class="ix-lead">${A.SC.bets?`Tus ${A.P.length} productos equivalen a ≈ ${num(A.SC.bets.nb,1)} apuestas independientes.`:''}</p>`+`<details${XPT()?' open':''}><summary class="lnk">Ver matriz de correlación</summary>`+matrix(R.assets,(a,b,i,j)=>{const c=R.M[i][j];return i===j?'<i class="d">1</i>':`<i style="background:${c==null?'transparent':c>0?`rgba(255,169,77,${Math.min(.85,Math.abs(c))})`:`rgba(105,198,217,${Math.min(.85,Math.abs(c))})`}">${c==null?'?':c.toFixed(2).replace('.',',')}</i>`},'1 = se mueven exactamente igual; 0 = sin relación. Por encima de 0,9 apenas diversifican.')+`</details><h6>Pares más correlacionados</h6>${hi.slice(0,4).map(([a,b,c])=>`<p class="ix-pr"><span>${esc(a.name)} · ${esc(b.name)}</span><em class="${c>.9?'dn':''}">${c.toFixed(2).replace('.',',')}</em></p>`).join('')}`:'<p class="mp-note">Hace falta más de un activo con historial de precios.</p>'}</section>`}
/* --- Países --- */
function tabGeo(A){const L=A.L;const reg={};Object.entries(L.C).forEach(([c,v])=>reg[REGION(c)]=(reg[REGION(c)]||0)+v);
  return `<section class="ix-card"><div class="ix-k">¿Dónde está tu dinero?</div>${bars(L.C,12,c=>CNAME[c]||c,ccol,'cty')}<p class="mp-note">Toca un país para ver qué ETFs y empresas generan esa exposición.</p>
    <h6>Por regiones</h6>${bars(reg,6,r=>r,r=>r==='No desglosado'?SEC_C[UNK]:'var(--acc)')}
    <div class="ix-btns"><button class="btn" data-go="globe">🌍 Ver en el globo</button></div>
    ${srcl('justETF (reparto por países de cada ETF)',A.asof,'País de la empresa según el proveedor del índice — no es dónde factura')}</section>`}
/* --- Empresas y solapamiento --- */
function tabComp(A){const {L,P}=A,funds=P.filter(x=>x.e.k!=='s').map(x=>x.e);const cs=L.comps.slice(0,15),mx=Math.max(...cs.map(c=>c.up||c.w),1);
  let pa=null,pb=null;if(funds.length>1){const pr=DOC.pair||[];pa=funds.find(e=>e.t===pr[0])||(A.pairs&&A.pairs[0]?A.pairs[0][0].e:funds[0]);pb=funds.find(e=>e.t===pr[1]&&e!==pa)||(A.pairs&&A.pairs[0]&&A.pairs[0][0].e===pa?A.pairs[0][1].e:funds.find(e=>e!==pa))}
  const pd=pa&&pb?overlapDetail(pa,pb):null;
  return `<section class="ix-card"><div class="ix-k">¿Qué empresas tienes realmente?</div>
    <div class="ix-cl">${cs.map(c=>`<div class="ix-cr2" role="button" tabindex="0" data-comp="${esc(c.key)}" title="Ver en el globo"><div><b>${esc(c.name)}</b><small>${c.by.map(b=>`${tk(b.e)} ${pct(b.w,1)}`).join(' + ')}${c.dir&&c.dir<c.w?' · directa + indirecta':c.dir?' · directa':' · indirecta'}</small></div><div class="ix-rng"><i><b style="width:${c.w/mx*100}%"></b>${c.up&&c.up>c.w+.05?`<u style="left:${c.w/mx*100}%;width:${(c.up-c.w)/mx*100}%"></u>`:''}</i><em>${c.exact||!(c.up>c.w+.05)?pct(c.w,1):c.up==null?`≥ ${pct(c.w,1)}`:`${num(c.w,1)}–${pct(c.up,1)}`}</em></div></div>`).join('')||'<p class="mp-note">Sin datos de empresas.</p>'}</div>
    <p class="mp-note"><b>Barra sólida</b>: exposición mínima segura (suma de lo publicado). <b>Tramo claro</b>: lo que podría añadirse si la empresa también está en otros ETFs por debajo de sus 10 mayores posiciones. Aproximación: solo se conocen las mayores posiciones.</p>
    ${srcl('Yahoo Finance / justETF (mayores posiciones)',A.asof,'Parcial · exposición estimada con mínimo y máximo')}</section>
    ${funds.length>1?`<section class="ix-card"><div class="ix-k">Solapamiento entre tus ETFs</div>${matrix(funds,(a,b,i,j)=>{if(i===j)return '<i class="d">—</i>';const o=overlap(a,b);return `<i style="background:rgba(255,107,125,${o==null?0:Math.min(.8,o/60)})">${o==null?'?':Math.round(o)+'%'}</i>`},'% de la cartera de un ETF que también está en el otro (mínimo: solo empresas publicadas).')}
      <div class="ix-pair"><select data-pair="a">${funds.map(e=>`<option value="${esc(e.t)}"${e===pa?' selected':''}>${esc(e.name)}</option>`).join('')}</select><span>vs</span><select data-pair="b">${funds.map(e=>`<option value="${esc(e.t)}"${e===pb?' selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
      ${pd?`<p class="ix-msg">${pd.rows.length?`Comparten al menos <b>${pct(pd.o,0)}</b>: ${pd.rows.length} de sus mayores posiciones son las mismas empresas.`:'No comparten ninguna de sus mayores posiciones.'}</p>${pd.rows.length?`<table class="ix-tbl"><thead><tr><th>Empresa</th><th>${tk(pa)}</th><th>${tk(pb)}</th><th>Común</th></tr></thead><tbody>${pd.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${pct(r.a,1)}</td><td>${pct(r.b,1)}</td><td>${pct(r.m,1)}</td></tr>`).join('')}</tbody></table>`:''}`:'<p class="mp-note">Alguno de los dos no publica sus posiciones.</p>'}</section>`:''}
    <div class="ix-btns"><button class="btn" data-go="gcomp">🌍 Ver empresas en el globo</button></div>`}
/* --- Sectores --- */
function tabSec(A){const L=A.L;const ss=Object.entries(L.S).filter(([,v])=>v>.05).sort((a,b)=>(a[0]===UNK)-(b[0]===UNK)||b[1]-a[1]);const mx=Math.max(...ss.map(x=>x[1]),1);
  return `<section class="ix-card"><div class="ix-k">¿A qué sectores estás expuesto?</div>${ss.map(([s,v])=>`<button class="ix-bar${s===UNK?' unk':''}" data-secx><span>${esc(s)}</span><i><b style="width:${v/mx*100}%;background:${s===UNK?SEC_C[UNK]:'var(--acc)'}"></b></i><em>${pct(v)}</em></button><div class="ix-sub" hidden>${(L.byS[s]||[]).sort((a,b)=>b.p-a.p).map(b=>`<p><span>${esc(b.e.name)}</span><em>${pct(b.p,1)}</em></p>`).join('')}</div>`).join('')}
    <p class="mp-note">Toca un sector para ver qué ETFs lo generan.</p><div class="ix-btns"><button class="btn" data-go="gsec">🌍 Sectores en el globo</button></div>${srcl('Yahoo Finance / justETF (reparto sectorial de cada ETF)',A.asof,'Real cuando el ETF publica todo su reparto')}</section>`}
/* --- editor de cartera de prueba --- */
/* ---------- Cartera rápida: pegar texto («VWCE 40», «IE00B4L5Y983 6.000 €», «NVDA») ---------- */
function numOf(x){let v=String(x).replace(/[%€\s]|eur/gi,'');if(!v)return null;
  if(v.includes('.')&&v.includes(','))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');
  else if(/^\d{1,3}([.,]\d{3})+$/.test(v))v=v.replace(/[.,]/g,'');else v=v.replace(',','.');const n=parseFloat(v);return isFinite(n)&&n>0?n:null}
/* P1.1: resolución por ATLASI.assets (única fuente de verdad). Devuelve la entidad solo si la coincidencia es única; nunca elige en silencio. */
function resolveTok(raw){const r=resolveRow(raw);return r.e}
function resolveRow(raw){const AS=ATLASI.assets;const r=AS.resolve(raw,{mode:'any',kinds:AS.PRODUCT,concept:'product'});return{e:r.match?AS.entity(r.match.id):null,r}}
function parsePaste(txt){const items=String(txt||'').split(/\n|;/).flatMap(l=>l.split(/,\s*(?=[A-Za-z])|\t+(?=[A-Za-z])|\s{2,}(?=[A-Za-z])/)).map(x=>x.trim()).filter(Boolean);
  const rows=new Map(),miss=[],amb=[];items.forEach(it=>{const m=it.match(/^(.*?)[\s:=–-]*([\d][\d.,]*)\s*(%|€|eur)?\s*$/i);const name=(m?m[1]:it).trim(),w=m?numOf(m[2]):null;if(!name)return;
    const {e,r:rr}=resolveRow(name);if(!e){if(rr.ask)amb.push({name,w,question:rr.ask.question,options:rr.ask.options.map(o=>({id:o.id,label:`${o.atlasTicker||o.id} · ${o.name}`}))});else miss.push(name);return}const k=e.k+'|'+e.t;const r=rows.get(k)||{k:e.k,t:e.t,w:0,n:0};r.w+=w==null?NaN:w;r.n++;rows.set(k,r)});
  let R=[...rows.values()];if(R.some(r=>!isFinite(r.w)))R=R.map(r=>({...r,w:isFinite(r.w)?r.w:null}));
  const anyW=R.some(r=>r.w)||amb.some(a=>a.w);R=R.map(r=>({k:r.k,t:r.t,w:anyW?(r.w||0):1}));amb.forEach(a=>a.w=anyW?(a.w||0):1);return{rows:R.filter(r=>r.w>0),miss,amb,eq:!anyW}}
function qpAmbHTML(){const L=DOC.qpAmb||[];return L.length?`<div class="qp-amb">${L.map((a,i)=>`<div><p><b>Ambiguo: «${esc(a.name)}»</b>${a.w?` · ${num(a.w,1)}`:''}. ${esc(a.question)}</p><div class="xc-chips">${a.options.map(o=>`<button data-qpa="${i}" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div></div>`).join('')}</div>`:''}
function pasteBox(){const n=(DOC.rows||[]).filter(r=>r.k&&+r.w>0).length;const box=`<div class="qp"><label for="qpT"><b>Pega tu cartera</b><span>Un ETF, fondo o acción por línea, con su peso (%) o su importe (€). Ticker, ISIN o nombre.</span></label>
  <textarea id="qpT" rows="5" spellcheck="false" autocomplete="off" placeholder="VWCE 40&#10;CSPX 25&#10;EQAC 15&#10;SMH 10&#10;NVDA 10">${esc(DOC.paste||'')}</textarea>
  <div class="qp-b"><button class="btn sm" data-qp>Analizar</button><button class="lnk" data-qpex>Usar un ejemplo</button></div>${DOC.qpMsg?`<p class="qp-m">${esc(DOC.qpMsg)}</p>`:''}${qpAmbHTML()}</div>`;
  return n?`<details class="qp-c"${(DOC.qpAmb||[]).length?' open':''}><summary><span>Cartera rápida · ${n} producto${n>1?'s':''}</span><b>Editar</b></summary>${box}</details>${DOC.qpMsg?`<p class="qp-m">${esc(DOC.qpMsg)}</p>`:''}`:box}
function bindPaste(el){const b=el.querySelector('[data-qp]');if(!b)return;b.onclick=()=>{const t=el.querySelector('#qpT').value;const r=parsePaste(t);DOC.paste=t;
  DOC.qpAmb=r.amb;if(!r.rows.length){DOC.qpMsg=r.miss.length?`No encontrados: ${r.miss.join(', ')}. Prueba con el ticker exacto o el ISIN.`:r.amb.length?'':'Escribe al menos un ETF o acción.';saveDoc();renderDoc();return}
  DOC.rows=r.rows;DOC.src='custom';DOC.tab='doctor';DOC.qpMsg=[r.miss.length?`No encontrados (no se incluyen): ${r.miss.join(', ')}. Prueba con el ticker exacto o el ISIN.`:'',r.eq?'Sin pesos: se reparte a partes iguales.':''].filter(Boolean).join(' ');saveDoc();renderDoc();setTimeout(()=>{if(typeof renderOverview==='function')renderOverview()},50)};
  const ex=el.querySelector('[data-qpex]');if(ex)ex.onclick=()=>{DOC.paste='VT 40\nSPY 25\nQQQ 15\nSMH 10\nEEM 10';DOC.qpMsg='';DOC.qpAmb=[];saveDoc();renderDoc()};
  el.querySelectorAll('[data-qpa]').forEach(x=>x.onclick=()=>{const [i,id]=[+x.dataset.qpa,x.dataset.id];const a=(DOC.qpAmb||[])[i];if(!a)return;const k=id.slice(0,id.indexOf(':')),t=id.slice(id.indexOf(':')+1);
    DOC.rows=(DOC.rows||[]).filter(r=>r.k);const ex2=DOC.rows.find(r=>r.k===k&&r.t===t);if(ex2)ex2.w=(+ex2.w||0)+(+a.w||0);else DOC.rows.push({k,t,w:a.w||1});DOC.qpAmb.splice(i,1);DOC.src='custom';saveDoc();renderDoc()})}
function docEditor(){const rows=DOC.rows&&DOC.rows.length?DOC.rows:[{k:'',t:'',w:''}];const tot=rows.reduce((a,r)=>a+(+r.w||0),0);
  return `<div class="ix-ed">${rows.map((r,i)=>{const e=r.k?entBy(r.k,r.t):null;return `<div class="ix-row"><input list="ixList" data-ri="${i}" placeholder="Ticker o nombre (VWCE, SPY, QQQ…)" value="${e?esc(e.tk+' · '+e.name):''}"><input type="number" min="0" step="1" inputmode="decimal" data-rw="${i}" value="${r.w}" placeholder="%"><em>%</em><button data-rx="${i}" aria-label="Quitar">✕</button></div>`}).join('')}
    <datalist id="ixList">${ents().filter(x=>x.k!=='s').concat(ents().filter(x=>x.k==='s')).map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    <div class="ix-edb"><button class="btn2 sm" data-radd>＋ Añadir</button><button class="btn2 sm" data-rex>Ejemplo</button><span class="${Math.abs(tot-100)>.5&&tot?'bad':''}">Total ${Math.round(tot)} %${Math.abs(tot-100)>.5&&tot?' · se reescala a 100':''}</span></div></div>`}
function bindEditor(el){/* opción elegida de la lista = selección explícita; texto libre → ATLASI.assets */const find=v=>ents().find(x=>`${x.tk} · ${x.name}`===v)||resolveTok(v.split(' · ')[0].trim());
  if(!DOC.rows||!DOC.rows.length)DOC.rows=[{k:'',t:'',w:''}];
  el.querySelectorAll('[data-ri]').forEach(i=>i.onchange=()=>{const e=find(i.value);const r=DOC.rows[+i.dataset.ri];if(e){r.k=e.k;r.t=e.t}else{r.k='';r.t=''}saveDoc();renderDoc()});
  el.querySelectorAll('[data-rw]').forEach(i=>i.onchange=()=>{DOC.rows[+i.dataset.rw].w=+i.value||0;saveDoc();renderDoc()});
  el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{DOC.rows.splice(+b.dataset.rx,1);saveDoc();renderDoc()});
  el.querySelector('[data-radd]').onclick=()=>{DOC.rows.push({k:'',t:'',w:''});saveDoc();renderDoc()};
  el.querySelector('[data-rex]').onclick=()=>{loadExample();renderDoc()}}

/* ------------------------------ OPPORTUNITY RADAR ------------------------------ */
const RW_DEF={val:20,mom:20,trend:10,risk:15,div:20,grow:15};
let RW=(()=>{try{return {...RW_DEF,...JSON.parse(localStorage.getItem('atlas_rw')||'{}')}}catch(_){return{...RW_DEF}}})();
let RFL={region:'',country:'',sector:'',cat:'',risk:'',ac:'',min:0,hz:'6m',sort:'score',etf:''};
const RCOMP={val:['Valoración','P/E de la cartera del ETF (Yahoo Finance) comparado con el de los demás ETFs de acciones de ATLAS: cuanto más barato, más puntos (percentil invertido). Es una valoración RELATIVA, no frente a su propia historia.'],
  mom:['Momentum','Rentabilidad en el horizonte elegido (1 mes, 6 meses o 1 año) frente al resto de ETFs (percentil).'],
  trend:['Tendencia','Precio frente a su media de 200 sesiones y media de 50 frente a la de 200 (percentil). Por encima = tendencia alcista.'],
  risk:['Riesgo','Volatilidad de 1 año y caída máxima del último año: cuanto menores, más puntos (percentil invertido).'],
  div:['Diversificación','Cuánto aporta a TU cartera: 100 − (60 % × solapamiento de empresas + 40 % × parecido en países). Sin cartera, se usa una cartera mundial (MSCI World) como referencia.'],
  grow:['Crecimiento','Rentabilidad anual de los últimos 3 años (percentil). Es crecimiento del PRECIO, no de beneficios: no hay datos de beneficios por ETF.']};
const RCATS=['Infravalorado','Momentum','Mercado emergente','Rotación sectorial','Oportunidad defensiva','Alto crecimiento','Alto riesgo','Diversificación','Posible sobrevaloración','Riesgo de concentración'];
const CAT_ES_HELP={'Infravalorado':'Valoración ≥ 75','Momentum':'Momentum ≥ 80 y tendencia ≥ 60','Mercado emergente':'≥ 50 % en países emergentes','Rotación sectorial':'ETF sectorial que acelera: rentabilidad de 1 mes en el 20 % mejor y de 1 año por debajo de la mediana','Oportunidad defensiva':'Riesgo ≥ 75 (poca volatilidad y caídas pequeñas)','Alto crecimiento':'Crecimiento ≥ 80','Alto riesgo':'Riesgo ≤ 20','Diversificación':'Diversificación ≥ 75 respecto a tu cartera','Posible sobrevaloración':'Valoración ≤ 20 y momentum ≥ 70','Riesgo de concentración':'La mayor posición pesa más del 20 % o las 10 mayores más del 60 %'};
function pctRank(arr,v,inv){if(v==null)return null;const s=arr.filter(x=>x!=null).sort((a,b)=>a-b);if(s.length<5)return null;let lo=0;while(lo<s.length&&s[lo]<v)lo++;const p=lo/(s.length-1)*100;return clamp(inv?100-p:p)}
let _radarBase=null;
async function radarCandidates(){await loadExpo();const port=await docPortfolio();let refP=port.P;if(!refP.length){const w=ents().find(x=>x.t==='URTH'||x.t==='F_FIDW');refP=w?[{e:w,w:1}]:[]}
  const LP=lookThrough(refP),pc=new Map(LP.comps.map(c=>[c.key,c.w]));
  const list=ents().filter(x=>x.k==='e'&&RANK&&RANK[priceKey(x.k,x.obj)]).map(e=>{const r=RANK[priceKey(e.k,e.obj)],x=expOf(e);
    let ov=0;x.hold.forEach(h=>{if(pc.has(h.key))ov+=Math.min(pc.get(h.key),h.w)});
    let sim=0;Object.entries(x.country).forEach(([c,v])=>{if(c!=='XX')sim+=Math.min(v,LP.C[c]||0)});
    const div=x.hold.length||x.ccCover>0?clamp(100-(.6*Math.min(100,ov*1.5)+.4*sim)):null;
    const dom=Object.entries(x.country).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1])[0],sec=Object.entries(x.sector).filter(([s])=>!/Sin|Otros|No desglos/.test(s)).sort((a,b)=>b[1]-a[1])[0];
    const em=Object.entries(x.country).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
    return{e,r,x,ov,div,dom:dom?dom[0]:null,domW:dom?dom[1]:0,sec:sec?sec[0]:null,secW:sec?sec[1]:0,em,ac:x.ac||'Acciones',pe:x.pe&&x.pe>0&&x.pe<200?x.pe:null}});
  return{list,refName:port.P.length?port.name:'una cartera mundial de referencia (MSCI World)'}}
function scoreRadar(base){const L=base.list,hz=RFL.hz,mk=x=>hz==='1m'?x.r.r1m:hz==='1y'?x.r.r1y:x.r.r6m;
  const eq=L.filter(x=>x.ac==='Acciones');const A={pe:eq.map(x=>x.pe),mom:L.map(mk),tr:L.map(x=>x.r.tr200==null?null:x.r.tr200+(x.r.tr50||0)/2),vol:L.map(x=>x.r.vol),dd:L.map(x=>x.r.dd1y),g:L.map(x=>x.r.r3y),m1:L.map(x=>x.r.r1m),y1:L.map(x=>x.r.r1y)};
  return L.map(x=>{const c={val:x.ac==='Acciones'?pctRank(A.pe,x.pe,true):null,mom:pctRank(A.mom,mk(x)),trend:pctRank(A.tr,x.r.tr200==null?null:x.r.tr200+(x.r.tr50||0)/2),
      risk:(()=>{const a=pctRank(A.vol,x.r.vol,true),b=pctRank(A.dd,x.r.dd1y);return a==null?b:b==null?a:(a+b)/2})(),div:x.div,grow:pctRank(A.g,x.r.r3y)};
    let s=0,ws=0;Object.entries(RW).forEach(([k,w])=>{if(c[k]!=null&&w>0){s+=w*c[k];ws+=w}});const score=ws?s/ws:null;const nC=Object.values(c).filter(v=>v!=null).length;
    const cats=[];if(c.val!=null&&c.val>=75)cats.push('Infravalorado');if(c.mom!=null&&c.mom>=80&&(c.trend??0)>=60)cats.push('Momentum');if(x.em>=50)cats.push('Mercado emergente');
    const sectorETF=x.secW>=60;if(sectorETF&&pctRank(A.m1,x.r.r1m)>=80&&pctRank(A.y1,x.r.r1y)<=50)cats.push('Rotación sectorial');if(c.risk!=null&&c.risk>=75)cats.push('Oportunidad defensiva');
    if(c.grow!=null&&c.grow>=80)cats.push('Alto crecimiento');if(c.risk!=null&&c.risk<=20)cats.push('Alto riesgo');if(c.div!=null&&c.div>=75)cats.push('Diversificación');
    if(c.val!=null&&c.val<=20&&(c.mom??0)>=70)cats.push('Posible sobrevaloración');const h=x.x.hold;if(h.length&&(h[0].w>20||h.slice(0,10).reduce((a,y)=>a+y.w,0)>60))cats.push('Riesgo de concentración');
    const conf=nC>=6?'Alta':nC>=4?'Media':'Baja';return{...x,c,score,cats,conf,nC}})}
function whyText(o){const names={val:'una valoración relativamente baja',mom:'un buen momentum',trend:'una tendencia alcista',risk:'un riesgo contenido',div:'poca coincidencia con tu cartera',grow:'un crecimiento fuerte en 3 años'};
  const neg={val:'una valoración exigente',mom:'un momentum débil',trend:'una tendencia bajista',risk:'un riesgo elevado',div:'mucho solapamiento con lo que ya tienes',grow:'poco crecimiento en 3 años'};
  const e=Object.entries(o.c).filter(([,v])=>v!=null).sort((a,b)=>b[1]-a[1]);const top=e.filter(([,v])=>v>=65).slice(0,3).map(([k])=>names[k]),low=e.filter(([,v])=>v<=30).slice(-2).map(([k])=>neg[k]);
  return (top.length?`Combina ${top.join(', ').replace(/, ([^,]*)$/,' y $1')}.`:'No destaca claramente en ningún factor.')+(low.length?` A tener en cuenta: ${low.join(' y ')}.`:'')}
async function renderRadar(){const el=$('#ixradar');if(!el)return;el.innerHTML='<section><div class="ix-k">Señales para investigar</div><div class="sk"><i></i><i></i><i></i></div></section>';if(!RANK&&typeof loadRank==='function')await loadRank();
  _radarBase=await radarCandidates();el.innerHTML=`<p class="pf-lead">El Radar no dice qué comprar: detecta cosas en el mercado que <b>merecen investigarse</b>, con el dato, la fuente y el método detrás.</p><section id="ixSig"></section><section><div class="ix-k">Ranking de ETFs · ATLAS Score</div><div id="ixRank"></div></section>`;
  drawSignals();drawRadar()}
/* Señales: comparaciones relativas con datos reales (rankings diarios + composición). Nunca «compra/vende». */
function signals(){const B=_radarBase;if(!B||!RANK)return[];const list=B.list.filter(x=>x.ac==='Acciones'&&x.r&&x.r.r1y!=null&&!x.e.obj.lev&&!/2x|3x|ultra|leverag|apalanc/i.test(x.e.name+' '+(x.e.obj.n||'')));const med=a=>{const v=a.filter(x=>x!=null&&isFinite(x)).sort((p,q)=>p-q);return v.length?v[Math.floor(v.length/2)]:null};
  const wE=ents().find(x=>x.t==='URTH')||ents().find(x=>x.t==='VT'),w=wE&&RANK[priceKey(wE.k,wE.obj)],wX=wE&&expOf(wE);if(!w)return[];
  const date=RANK_U,src='Yahoo Finance (precios) · rankings diarios de ATLAS',srcV='Yahoo Finance (P/E de la cartera del ETF)',out=[];
  const seen=new Set();const card=(o)=>{if(seen.has(o.t))return;seen.add(o.t);out.push({date,...o})};const ctry=list.filter(x=>x.dom&&x.domW>=80&&x.dom!=='US'&&x.secW<60),sect=list.filter(x=>x.secW>=60);
  const by=(arr,f)=>arr.slice().sort((a,b)=>f(b)-f(a));const r1=x=>x.r.r1y-w.r1y,r6=x=>x.r.r6m-w.r6m;
  by(ctry,r1).filter((x,i,a)=>a.findIndex(y=>y.dom===x.dom)===i).slice(0,2).filter(x=>r1(x)>=5).forEach(x=>card({kind:'Geografía',tone:'info',t:`${CNAME[x.dom]||x.dom}: mejor que el mundo en 12 meses`,why:`La bolsa de ${CNAME[x.dom]||x.dom} ha subido bastante más que el índice mundial. Puede reflejar mejores beneficios, una revalorización o simplemente momentum.`,
    data:[[`${x.e.tk} 1 año`,pct(x.r.r1y,1)],['Índice mundial 1 año',pct(w.r1y,1)],['Diferencia',`+${num(r1(x),1)} pp`],['Volatilidad 1 año',pct(x.r.vol,0)],['P/E',x.pe?num(x.pe,1):'n/d']],src,
    meth:`Rentabilidad a 12 meses del ETF de ${CNAME[x.dom]||x.dom} (≥ 80 % en ese país) menos la del ETF MSCI World (${wE.tk}).`,risk:`Lo que ha subido mucho puede estar más caro; una sola economía concentra riesgo político y de divisa.`,inv:`ETFs amplios de ${CNAME[x.dom]||x.dom}, su valoración frente a su historia y el peso que ya tienes en ese país.`,e:x.e}));
  by(ctry,x=>-r1(x)).slice(0,1).filter(x=>r1(x)<=-10).forEach(x=>card({kind:'Geografía',tone:'warn',t:`${CNAME[x.dom]||x.dom}: muy por detrás del mundo`,why:`Ha quedado muy rezagada frente al índice mundial. A veces anticipa valoraciones más bajas; otras, problemas reales.`,
    data:[[`${x.e.tk} 1 año`,pct(x.r.r1y,1)],['Índice mundial 1 año',pct(w.r1y,1)],['Diferencia',`${num(r1(x),1)} pp`],['P/E',x.pe?num(x.pe,1):'n/d'],['P/E índice mundial',wX&&wX.pe?num(wX.pe,1):'n/d']],src,
    meth:`Rentabilidad a 12 meses del ETF del país menos la del MSCI World.`,risk:`Un mercado barato puede seguir barato mucho tiempo («value trap»).`,inv:`Por qué ha caído: divisa, sector dominante, política o beneficios.`,e:x.e}));
  by(sect,r6).filter((x,i,a)=>a.findIndex(y=>y.sec===x.sec)===i).slice(0,2).filter(x=>r6(x)>=4).forEach(x=>card({kind:'Sector',tone:'info',t:`${x.sec}: momentum relativo fuerte`,why:`El sector ha subido bastante más que el mercado mundial en los últimos 6 meses.`,
    data:[[`${x.e.tk} 6 meses`,pct(x.r.r6m,1)],['Mundo 6 meses',pct(w.r6m,1)],['Diferencia',`+${num(r6(x),1)} pp`],['Tendencia',x.r.tr200==null?'n/d':x.r.tr200>0?`▲ ${pct(x.r.tr200,0)} sobre media 200 sesiones`:`▼ ${pct(-x.r.tr200,0)} bajo media 200`],['P/E',x.pe?num(x.pe,1):'n/d']],src,
    meth:`ETFs con ≥ 60 % en un sector: rentabilidad a 6 meses menos la del MSCI World.`,risk:`El momentum se gira sin avisar y los sectores de moda suelen cotizar caros.`,inv:`Cuánto de ese sector ya tienes (pestaña Sectores del Análisis) antes de añadir más.`,e:x.e}));
  const val=list.filter(x=>x.pe);const grp=x=>x.secW>=60?'s:'+x.sec:x.domW>=80?'c:'+x.dom:null;const G={};val.forEach(x=>{const g=grp(x);if(g)(G[g]=G[g]||[]).push(x)});
  const cheap=[];Object.entries(G).forEach(([g,a])=>{if(a.length<3)return;const m=med(a.map(x=>x.pe));a.forEach(x=>{if(x.pe<=.8*m)cheap.push({x,m,g,n:a.length})})});cheap.sort((a,b)=>a.x.pe/a.m-b.x.pe/b.m);
  cheap.slice(0,2).forEach(({x,m,g,n})=>card({kind:'Valoración',tone:'info',t:`${x.e.tk}: P/E por debajo de ETFs comparables`,why:`Cotiza a un múltiplo de beneficios más bajo que otros ${n-1} ETFs de ${g.startsWith('s:')?'su sector':'su país'} en ATLAS. Puede deberse a una cartera distinta (más pequeñas, otro sesgo), no necesariamente a una oportunidad.`,
    data:[['P/E',num(x.pe,1)],['Mediana comparables',num(m,1)],['Descuento',pct((1-x.pe/m)*100,0)],['1 año',pct(x.r.r1y,1)]],src:srcV,meth:`P/E de la cartera de cada ETF (Yahoo Finance) frente a la mediana de los ETFs de ATLAS con el mismo sector dominante (≥ 60 %) o país (≥ 80 %).`,risk:`Un P/E bajo suele reflejar menor crecimiento esperado o más riesgo.`,inv:`En qué se diferencia su cartera de la de sus comparables.`,e:x.e}));
  const mv=med(list.map(x=>x.r.vol));list.filter(x=>(x.domW>=80||x.secW>=60)&&x.r.vol>=1.6*mv).sort((a,b)=>b.r.vol-a.r.vol).slice(0,1).forEach(x=>card({kind:'Riesgo',tone:'risk',t:`${x.domW>=80&&x.dom!=='US'?CNAME[x.dom]||x.dom:x.sec}: volatilidad inusualmente alta`,why:`Oscila mucho más que la mayoría de ETFs de acciones: movimientos fuertes en ambos sentidos.`,
    data:[[`Volatilidad ${x.e.tk}`,pct(x.r.vol,0)],['Mediana ETFs de acciones',pct(mv,0)],['Caída máx. 1 año',pct(x.r.dd1y,0)]],src,meth:`Volatilidad anualizada de 1 año frente a la mediana de los ETFs de acciones de ATLAS (umbral 1,6×).`,risk:`Pesos grandes en activos así disparan la volatilidad de la cartera.`,inv:`Si ya tienes exposición a este país o sector y cuánto representa.`,e:x.e}));
  out.push({kind:'Composición',tone:'pending',t:'Cambios en la composición de los ETFs',why:'Detectar cuándo un ETF aumenta o reduce su peso en un país o empresa necesita al menos dos fotos de su composición.',data:[['Primera foto guardada','7 oct 2026']],src:'data/holdings/ (justETF + Yahoo)',meth:'Comparación entre fotos de composición con fecha.',risk:'—',inv:'Disponible cuando haya historial suficiente.',date:null,pending:true});
  return out}
function drawSignals(){const box=$('#ixSig');if(!box)return;const S=signals();const T={info:['◆','#5ee7ff'],warn:['▲','#e8c66a'],risk:['●','#ff6b7d'],pending:['○','#8fa3bd']};
  box.innerHTML=`<div class="ix-k">Señales para investigar <span class="ix-cnt">${S.filter(x=>!x.pending).length}</span></div>${S.map((o,i)=>`<article class="ix-sig${o.pending?' pend':''}" style="--c:${T[o.tone][1]}"><div class="sg-h"><span>${T[o.tone][0]} ${esc(o.kind)}</span>${o.date?`<em>${relWhen(o.date)}</em>`:'<em>Pendiente</em>'}</div><h4>${esc(o.t)}</h4><p>${esc(o.why)}</p>
    <dl>${o.data.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <details><summary>Método, riesgo y qué investigar</summary><p><b>Qué investigar:</b> ${esc(o.inv)}</p><p><b>Riesgo:</b> ${esc(o.risk)}</p><p><b>Método:</b> ${esc(o.meth)}</p></details>
    ${srcl(o.src,o.date?String(o.date).slice(0,10):null,'Comparación relativa histórica')}${o.e?`<div class="ix-btns"><button class="lnk" data-sgf="${i}">Ver ficha →</button><button class="lnk" data-sgc="${i}">¿Cómo cambiaría mi cartera? →</button></div>`:''}</article>`).join('')||'<p class="mp-note">No hay señales con los datos de hoy.</p>'}`;
  box.querySelectorAll('[data-sgf]').forEach(b=>b.onclick=()=>{const e=S[+b.dataset.sgf].e;openDetail(e.k,e.t,e.node)});
  box.querySelectorAll('[data-sgc]').forEach(b=>b.onclick=async()=>{const e=S[+b.dataset.sgc].e;const cur=await docPortfolio();if(!cur.P.length){openCompare({name:e.name,P:[{e,w:1}]},null);return}CMP.addW=CMP.addW||.1;openCompare({name:cur.name,P:cur.P},withAdd(cur,e,CMP.addW),{cur,e})})}
function drawRadar(){const el=$('#ixRank');if(!el||!_radarBase)return;let L=scoreRadar(_radarBase);
  const opts=(k,arr,lab)=>`<label><span>${lab}</span><select data-rf="${k}"><option value="">Todos</option>${[...new Set(arr.filter(Boolean))].sort().map(v=>`<option${RFL[k]===v?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  const regions=L.map(x=>x.dom?REGION(x.dom):null);
  const F=L.filter(x=>(!RFL.region||(RFL.region==='ex-US'?x.dom&&x.dom!=='US':REGION(x.dom||'XX')===RFL.region))&&(!RFL.country||(CNAME[x.dom]||x.dom)===RFL.country)&&(!RFL.sector||x.sec===RFL.sector)&&(!RFL.cat||x.cats.includes(RFL.cat))&&(!RFL.ac||x.ac===RFL.ac)
    &&(!RFL.risk||(RFL.risk==='Bajo'?(x.c.risk??0)>=66:RFL.risk==='Medio'?(x.c.risk??0)>=33&&(x.c.risk??0)<66:(x.c.risk??100)<33))&&(x.score??0)>=RFL.min&&(!RFL.etf||(x.e.name+' '+x.e.tk).toLowerCase().includes(RFL.etf.toLowerCase())));
  const key={score:x=>x.score,perf:x=>RFL.hz==='1m'?x.r.r1m:RFL.hz==='1y'?x.r.r1y:x.r.r6m,risk:x=>x.c.risk,val:x=>x.c.val,mom:x=>x.c.mom,div:x=>x.c.div}[RFL.sort];F.sort((a,b)=>(key(b)??-1)-(key(a)??-1));
  el.innerHTML=`<p class="mp-note">${L.length} ETFs puntuados por valoración, momentum, tendencia, riesgo, diversificación y crecimiento. Una puntuación alta es un punto de partida para investigar, no una recomendación.</p>
    <details class="ix-w" id="ixFilt"${drawRadar.fo?' open':''}><summary>🔎 Filtros y orden${(()=>{const n=['region','country','sector','cat','risk','ac','etf'].filter(k=>RFL[k]).length+(RFL.min?1:0);return n?` · ${n} activo${n>1?'s':''}`:''})()} · horizonte ${({'1m':'1 mes','6m':'6 meses','1y':'1 año'})[RFL.hz]}</summary><div class="ix-filt">${opts('region',regions.concat(['ex-US']),'Región')}${opts('country',L.map(x=>x.dom?CNAME[x.dom]||x.dom:null),'País')}${opts('sector',L.map(x=>x.sec),'Sector')}${opts('cat',RCATS,'Categoría')}
      <label><span>Riesgo</span><select data-rf="risk"><option value="">Todos</option>${['Bajo','Medio','Alto'].map(v=>`<option${RFL.risk===v?' selected':''}>${v}</option>`).join('')}</select></label>${opts('ac',L.map(x=>x.ac),'Clase de activo')}
      <label><span>Horizonte</span><select data-rf="hz">${[['1m','Corto (1 mes)'],['6m','Medio (6 meses)'],['1y','Largo (1 año)']].map(([v,l])=>`<option value="${v}"${RFL.hz===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <label><span>Score mínimo</span><input type="number" min="0" max="100" step="5" data-rf="min" value="${RFL.min}"></label><label class="w2"><span>ETF</span><input data-rf="etf" placeholder="Nombre o ticker" value="${esc(RFL.etf)}"></label>
      <label class="w2"><span>Ordenar por</span><select data-rf="sort">${[['score','ATLAS Score'],['perf','Rendimiento'],['risk','Riesgo (menor primero)'],['val','Valoración'],['mom','Momentum'],['div','Diversificación']].map(([v,l])=>`<option value="${v}"${RFL.sort===v?' selected':''}>${l}</option>`).join('')}</select></label></div></details>
    <details class="ix-w"><summary>⚖️ Pesos del ATLAS Score (configurables)</summary><div class="ix-wg">${Object.entries(RW).map(([k,v])=>`<label><span>${RCOMP[k][0]}</span><input type="range" min="0" max="40" step="5" value="${v}" data-rw="${k}"><em>${v}</em></label>`).join('')}</div>
      <p class="mp-note">Por defecto: valoración 20, momentum 20, diversificación 20, riesgo 15, crecimiento 15, tendencia 10. Reparto neutro elegido para que ningún factor domine; la tendencia pesa menos porque se solapa con el momentum. El score es la media ponderada de los componentes disponibles (0–100).</p><button class="btn2" data-rwr>Restablecer</button></details>
    <div class="ix-meta">🎯 ${F.length} oportunidades · diversificación medida frente a ${esc(_radarBase.refName)} · datos ${RANK_U?relWhen(RANK_U):''}</div>
    <div class="ix-ops">${F.slice(0,40).map((o,i)=>radarCard(o,i)).join('')||'<p class="mp-note">Nada con esos filtros.</p>'}</div>
    <p class="ix-src2">${SOURCES} Rentabilidades, volatilidad, tendencia y caídas: rankings diarios de ATLAS (precios de Yahoo Finance).</p>`;
  const fd=el.querySelector('#ixFilt');if(fd)fd.ontoggle=()=>drawRadar.fo=fd.open;
  el.querySelectorAll('[data-rf]').forEach(i=>i.onchange=()=>{RFL[i.dataset.rf]=i.type==='number'?+i.value||0:i.value;drawRadar()});
  el.querySelectorAll('[data-rw]').forEach(i=>i.oninput=()=>{RW[i.dataset.rw]=+i.value;i.nextElementSibling.textContent=i.value;try{localStorage.setItem('atlas_rw',JSON.stringify(RW))}catch(_){}clearTimeout(drawRadar.t);drawRadar.t=setTimeout(drawRadar,300)});
  const rr=el.querySelector('[data-rwr]');if(rr)rr.onclick=()=>{RW={...RW_DEF};try{localStorage.removeItem('atlas_rw')}catch(_){}drawRadar()};
  el.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const card=b.closest('.ix-op');const d=card.querySelector('.ix-opd');if(!d.hidden){d.hidden=true;return}const o=F.find(x=>x.e.t===b.dataset.op);d.innerHTML=radarDetail(o);d.hidden=false;bindDetail(d,o)})}
function radarCard(o,i){const s=o.score==null?null:Math.round(o.score),c=s>=70?'#4cd8a0':s>=50?'#ffd24a':'#ff9a3c',r=RFL.hz==='1m'?o.r.r1m:RFL.hz==='1y'?o.r.r1y:o.r.r6m;
  return `<div class="ix-op"><button class="ix-oph" data-op="${esc(o.e.t)}"><span class="ix-sc2" style="--c:${c}">${s??'—'}</span><span class="ix-opn"><b>${esc(o.e.name)}</b><small>${esc(o.e.tk)} · ${o.sec?esc(o.sec):'—'} · ${o.dom?esc(CNAME[o.dom]||o.dom):'—'}</small><span class="ix-tags">${o.cats.slice(0,3).map(t=>`<em>${t}</em>`).join('')}</span></span>
    <span class="ix-opr"><b class="${(r??0)<0?'dn':'up'}">${r==null?'—':(r>0?'+':'')+pct(r,0)}</b><small>${({'1m':'1 mes','6m':'6 meses','1y':'1 año'})[RFL.hz]}</small><small>σ ${pct(o.r.vol,0)}</small></span></button><div class="ix-opd" hidden></div></div>`}
function radarDetail(o){const tr=o.r.tr200==null?'—':o.r.tr200>0?`▲ ${pct(o.r.tr200,0)} sobre su media de 200 sesiones`:`▼ ${pct(-o.r.tr200,0)} bajo su media de 200 sesiones`;
  return `<div class="ix-note"><b>Por qué ATLAS cree que merece atención</b><p>${esc(whyText(o))}${o.cats.length?' Categorías: '+o.cats.join(', ')+'.':''}</p></div>
    <div class="ix-scoreb"><div class="ix-big">${o.score==null?'—':Math.round(o.score)}<small>/100 ATLAS Score</small></div>${Object.entries(RCOMP).map(([k,[n]])=>`<div class="ix-bar"><span>${n}</span><i><b style="width:${o.c[k]??0}%;background:${o.c[k]==null?'#3a4258':'linear-gradient(90deg,#35e0ff,#4cd8a0)'}"></b></i><em>${o.c[k]==null?'n/d':Math.round(o.c[k])}</em></div>`).join('')}</div>
    <div class="ix-kpi"><div><span>Rent. 1 mes / 6 m / 1 año</span><b>${pct(o.r.r1m,0)} / ${pct(o.r.r6m,0)} / ${pct(o.r.r1y,0)}</b></div><div><span>Volatilidad 1 año</span><b>${pct(o.r.vol,0)}</b></div><div><span>P/E cartera</span><b>${o.pe?o.pe.toFixed(1).replace('.',','):'n/d'}</b></div><div><span>Tendencia</span><b>${tr}</b></div><div><span>Confianza</span><b>${o.conf} (${o.nC}/6 datos)</b></div><div><span>Solapamiento con tu cartera</span><b>${pct(o.ov,0)}</b></div></div>
    <details class="ix-how"><summary>📐 Cómo se ha calculado</summary>${Object.entries(RCOMP).map(([k,[n,how]])=>`<p><b>${n} (${o.c[k]==null?'sin dato':Math.round(o.c[k])}, peso ${RW[k]}):</b> ${how}</p>`).join('')}<p><b>Confianza:</b> Alta con los 6 componentes, Media con 4–5, Baja con 3 o menos.</p><p><b>Datos:</b> rankings de ${RANK_U?relWhen(RANK_U):'—'} · composición ${esc(o.x.asof||'—')} (${esc(o.x.qTxt)}).</p></details>
    <div class="ix-btns"><button class="btn" data-a="cmp">⚖️ Comparar con mi cartera</button><button class="btn2" data-a="globe">🌍 Ver en el globo</button><button class="btn2" data-a="fic">Ficha</button></div>`}
function bindDetail(d,o){d.querySelector('[data-a=cmp]').onclick=async()=>{const cur=await docPortfolio();if(!cur.P.length){openCompare({name:o.e.name,P:[{e:o.e,w:1}]},null);return}
    CMP.addW=CMP.addW||.1;openCompare({name:cur.name,P:cur.P},withAdd(cur,o.e,CMP.addW),{cur,e:o.e})};
  d.querySelector('[data-a=globe]').onclick=()=>showExposureGlobe([{e:o.e,w:1}],o.e.name);d.querySelector('[data-a=fic]').onclick=()=>openDetail(o.e.k,o.e.t,o.e.node)}
function openRadar(f){if(f){RFL={...RFL,region:'',country:'',sector:'',cat:'',...f}}openHub('radar')}

/* ------------------------------ COMPARAR ------------------------------ */
let CMP={A:null,B:null,add:null,addW:.1};
function withAdd(cur,e,add){const P2=cur.P.map(x=>({e:x.e,w:x.w*(1-add)}));const ex=P2.find(x=>x.e===e);if(ex)ex.w+=add;else P2.push({e,w:add});return{name:`${cur.name} + ${Math.round(add*100)} % ${e.tk}`,P:P2}}
function openCompare(A,B,add){CMP={A,B,add:add||null,addW:CMP.addW||.1};openHub('cmp')}
/* Comparar sin elegir nada: puntos de partida sacados de tu propia cartera (no son recomendaciones) */
async function cmpStart(el){const out=el.querySelector('#ixCmpOut');if(!out)return;const cur=await docPortfolio('pf');
  if(!cur.P.length){out.innerHTML=`<div class="cs"><div class="ix-k">Compara</div><p class="cs-q">¿Qué quieres investigar?</p><div class="cs-g"><button class="cs-c" data-cs="ex"><b>VWCE vs CSPX</b><span>Mundo frente a EE. UU.: ¿cuánto se parecen?</span></button></div><p class="mp-note">Añade tu cartera para comparar a partir de lo que ya tienes.</p></div>`;
    out.querySelector('[data-cs=ex]').onclick=()=>{const f=t=>ents().find(x=>String(x.tk).toUpperCase()===t&&x.k!=='s');const a=f('VWCE'),b=f('CSPX');if(a&&b){CMP.A={name:a.name,P:[{e:a,w:1}]};CMP.B={name:b.name,P:[{e:b,w:1}]};renderCompare()}};return}
  const funds=cur.P.filter(x=>x.e.k!=='s').sort((a,b)=>b.w-a.w),opts=[];const me={name:'Mi cartera',P:cur.P};
  if(funds.length>=2)opts.push({t:`${funds[0].e.tk} vs ${funds[1].e.tk}`,s:'Tus dos fondos con más peso: ¿cuánto se solapan y cuánto se parecen?',go:()=>{CMP.A={name:funds[0].e.name,P:[{e:funds[0].e,w:1}]};CMP.B={name:funds[1].e.name,P:[{e:funds[1].e,w:1}]}}});
  const bench=ents().find(x=>x.t===(typeof BENCH!=='undefined'?BENCH.t:'')&&x.k===(typeof BENCH!=='undefined'?BENCH.k:''));
  if(bench&&!cur.P.some(x=>x.e===bench))opts.push({t:`Mi cartera vs ${BENCH.name||bench.tk}`,s:'Tu cartera frente al índice mundial que usa ATLAS como referencia.',go:()=>{CMP.A=me;CMP.B={name:bench.name,P:[{e:bench,w:1}]}}});
  out.innerHTML=`<div class="cs"><div class="ix-k">Compara tu cartera</div><p class="cs-q">¿Qué quieres investigar?</p><div class="cs-g">${opts.map((o,i)=>`<button class="cs-c" data-cs="${i}"><b>${esc(o.t)}</b><span>${esc(o.s)}</span></button>`).join('')}<div class="cs-c pend" data-cs-low><b>Buscando el ETF que menos se mueve como tu cartera…</b></div></div><p class="mp-note">Son puntos de partida calculados con tu cartera, no recomendaciones. Puedes cambiar A y B arriba.</p></div>`;
  const bind=()=>out.querySelectorAll('[data-cs]').forEach(b=>b.onclick=()=>{const o=opts[+b.dataset.cs];if(o){o.go();renderCompare()}});bind();
  /* el más distinto: entre ETFs amplios de la base que no tienes, el de menor correlación semanal con tu cartera (5 años) */
  try{const R=await riskOf(cur.P);const box=out.querySelector('[data-cs-low]');if(!R||!box){if(box)box.remove();return}
    const cand=ents().filter(x=>x.k==='e'&&!cur.P.some(y=>y.e===x)&&!/apalanc|2x|3x|lever|short|inverso/i.test(x.name)).filter(x=>{const a=assetClass(x);return a!=='Acciones'||!isNarrow(x)}).slice(0,40);
    let best=null;for(const e of cand){const r=await riskOf([{e,w:1}]);if(!r)continue;const c=corr(R.pr,r.pr);if(c!=null&&(!best||c<best.c))best={e,c}}
    if(!out.isConnected)return;if(!best){box.remove();return}
    opts.push({t:`Mi cartera vs Mi cartera + 10 % ${best.e.tk}`,s:`${best.e.name}: el ETF de ATLAS que menos se ha movido como tu cartera (correlación ${best.c.toFixed(2).replace('.',',')}). Mira qué cambiaría.`,go:()=>{CMP.A=me;CMP.add={cur:me,e:best.e};CMP.addW=.1;CMP.B=withAdd(me,best.e,.1)}});
    box.outerHTML=`<button class="cs-c" data-cs="${opts.length-1}"><b>${esc(opts[opts.length-1].t)}</b><span>${esc(opts[opts.length-1].s)}</span></button>`;bind()}catch(_){const b=out.querySelector('[data-cs-low]');if(b)b.remove()}}
async function renderCompare(){const el=$('#ixcmp');if(!el)return;await loadExpo();if(!CMP.A){const cur=await docPortfolio();CMP.A=cur.P.length?{name:cur.name,P:cur.P}:null}
  const pick=(id,cur)=>`<div class="ix-pk"><span>${id}</span><input list="ixCmpList" data-pk="${id}" placeholder="Cartera, ticker (VWCE, QQQ…) o nombre" value="${cur?esc(cur.name):''}"></div>`;
  const alts=await altPortfolios();const choices=[['Mi cartera',null],['Cartera rápida',null],...alts.map(a=>[a.ico+' '+a.name,a])];
  el.innerHTML=`<p class="pf-lead">Compara dos carteras o dos ETFs: características, riesgo, exposición, concentración, correlación y costes.</p>
    <div class="ix-pks">${pick('A',CMP.A)}<b>vs</b>${pick('B',CMP.B)}</div><datalist id="ixCmpList">${choices.map(([n])=>`<option value="${esc(n)}">`).join('')}${ents().filter(x=>x.k!=='s').map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    ${CMP.add?`<label class="ix-addw">Peso de ${esc(String(CMP.add.e.tk))} en la cartera B <select data-addw>${[.05,.1,.2,.3].map(v=>`<option value="${v}"${Math.abs(v-CMP.addW)<1e-9?' selected':''}>${v*100} %</option>`).join('')}</select><small>el resto se reduce en proporción</small></label>`:''}<div id="ixCmpOut">${CMP.A&&CMP.B?'<p class="mp-note">Comparando…</p>':'<div class="sk"><i></i><i></i><i></i></div>'}</div>`;
  el.querySelectorAll('[data-pk]').forEach(i=>i.onchange=async()=>{const v=i.value;let s=null;
    if(v==='Mi cartera'){const c=(DOC.src='pf',await docPortfolio());s=c.P.length?{name:'Mi cartera',P:c.P}:null}else if(v==='Cartera rápida'){const keep=DOC.src;DOC.src='custom';const c=await docPortfolio();DOC.src=keep;s=c.P.length?{name:v,P:c.P}:null}
    else{const a=alts.find(x=>x.ico+' '+x.name===v);if(a)s={name:v,P:a.P};else{const e=ents().find(x=>`${x.tk} · ${x.name}`===v)||resolveTok(v.split(' · ')[0].trim());if(e)s={name:e.name,P:[{e,w:1}]}}}
    CMP[i.dataset.pk]=s;CMP.add=null;renderCompare()});
  const aw=el.querySelector('[data-addw]');if(aw)aw.onchange=()=>{CMP.addW=+aw.value;CMP.B=withAdd(CMP.add.cur,CMP.add.e,CMP.addW);renderCompare()};
  if(!(CMP.A&&CMP.B)){cmpStart(el);return}
  const [LA,LB]=[lookThrough(CMP.A.P),lookThrough(CMP.B.P)],[RA,RB]=await Promise.all([riskOf(CMP.A.P),riskOf(CMP.B.P)]);const SA=docScores(LA,RA,CMP.A.P),SB=docScores(LB,RB,CMP.B.P);
  let ab=null;if(RA&&RB){const pa=RA.pr,pb=RB.pr;ab=corr(pa,pb)}
  const sharpe=R=>R&&R.vol?(R.cagr-(typeof RF==='number'?RF:2))/R.vol:null,peOf=P=>{let s2=0,w2=0;P.forEach(({e,w})=>{const x=expOf(e);if(x.pe&&x.pe>0&&x.pe<200&&x.ac==='Acciones'){s2+=w*x.pe;w2+=w}});return w2>.5?s2/w2:null};
  const cov=(()=>{const mb=new Map(LB.comps.map(c=>[c.key,c.w]));let o=0;LA.comps.forEach(c=>{if(mb.has(c.key))o+=Math.min(c.w,mb.get(c.key))});return o})();
  let divBox='';const single=CMP.A.P.length===1&&CMP.B.P.length===1&&CMP.A.P[0].e.k!=='s'&&CMP.B.P[0].e.k!=='s';
  if(single&&PF.length){const cur=await docPortfolio('pf');if(cur.P.length){const Lc=lookThrough(cur.P),Rc=await riskOf(cur.P),Sc=docScores(Lc,Rc,cur.P);
    const tryAdd=async e=>{const P2=withAdd(cur,e,.1).P,L2=lookThrough(P2),R2=await riskOf(P2),S2=docScores(L2,R2,P2);return{L2,R2,S2,ovl:overlap(e,cur.P.slice().sort((a,b)=>b.w-a.w)[0].e)}};
    const [xa,xb]=await Promise.all([tryAdd(CMP.A.P[0].e),tryAdd(CMP.B.P[0].e)]);const ccor=async e=>{const r=await riskOf([{e,w:1}]);return r&&Rc?corr(r.pr,Rc.pr):null};const [ca,cb]=await Promise.all([ccor(CMP.A.P[0].e),ccor(CMP.B.P[0].e)]);
    const sc=(x,c)=>(x.S2.health||0)-(Sc.health||0)-(c==null?0:c*5);const best=sc(xa,ca)>=sc(xb,cb)?'A':'B';const bn=best==='A'?CMP.A.name:CMP.B.name;
    const line=(lab,f)=>`<tr><th>${lab}</th><td>${f(xa,ca)}</td><td>${f(xb,cb)}</td></tr>`;
    divBox=`<section class="ix-card"><div class="ix-k">¿Cuál diversifica mejor tu cartera?</div><p class="ix-lead">Añadiendo un 10 %, <b>${esc(bn)}</b> mejora más la salud de tu cartera y se parece menos a lo que ya tienes.</p>
      <table class="ix-tbl"><thead><tr><th></th><th>+10 % A</th><th>+10 % B</th></tr></thead><tbody>${line('Salud (actual '+(Sc.health==null?'—':Math.round(Sc.health))+')',x=>x.S2.health==null?'—':Math.round(x.S2.health))}${line('Correlación con tu cartera',(x,c)=>c==null?'—':c.toFixed(2).replace('.',','))}${line('EE. UU. (actual '+pct(Lc.C.US||0,0)+')',x=>pct(x.L2.C.US||0,0))}${line('10 mayores empresas (actual ≥ '+pct(Sc.top10,0)+')',x=>'≥ '+pct(x.S2.top10,0))}${line('Volatilidad (actual '+(Rc?pct(Rc.vol,1):'—')+')',x=>x.R2?pct(x.R2.vol,1):'—')}</tbody></table>
      <p class="mp-note">Criterio: mayor mejora de la salud de la cartera, penalizando la correlación con lo que ya tienes. Histórico, no previsión.</p></section>`}}
  const row=(lab,a,b,fmt,lowerBetter)=>{const va=a,vb=b;const win=va==null||vb==null||va===vb?'':(lowerBetter?va<vb:va>vb)?'A':'B';const mx=Math.max(Math.abs(va||0),Math.abs(vb||0),1e-9);
    return `<div class="ix-cr"><span>${lab}</span><div class="ix-cv ${win==='A'?'win':''}"><i style="width:${Math.abs(va||0)/mx*100}%"></i><b>${fmt(va)}</b></div><div class="ix-cv b ${win==='B'?'win':''}"><i style="width:${Math.abs(vb||0)/mx*100}%"></i><b>${fmt(vb)}</b></div></div>`};
  const em=L=>Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  const diff=(XA,XB,fmt,col)=>{const keys=[...new Set([...Object.keys(XA),...Object.keys(XB)])].filter(k=>k!=='XX'&&!/Sin desglose|No desglos/.test(k)).sort((a,b)=>Math.max(XB[b]||0,XA[b]||0)-Math.max(XB[a]||0,XA[a]||0)).slice(0,8);
    return `<div class="ix-diff">${keys.map(k=>{const a=XA[k]||0,b=XB[k]||0,d=b-a;return `<div><span>${esc(fmt(k))}</span><i><b class="a" style="width:${a}%"></b><b class="b" style="width:${b}%"></b></i><em>${pct(a,0)} → ${pct(b,0)}${Math.abs(d)>=.5?` <small>(${d>0?'+':''}${d.toFixed(1).replace('.',',')})</small>`:''}</em></div>`}).join('')}</div>`};
  const chg=[];const dl=(n,a,b,f,u='')=>{if(a!=null&&b!=null&&Math.abs(b-a)>=(u==='pp'?.5:.05*Math.max(1,Math.abs(a))))chg.push(`${n} ${f(a)} → ${f(b)}`)};
  dl('volatilidad',RA&&RA.vol,RB&&RB.vol,v=>pct(v,1),'pp');dl('EE. UU.',LA.C.US||0,LB.C.US||0,v=>pct(v,0),'pp');dl('emergentes',em(LA),em(LB),v=>pct(v,0),'pp');dl('empresas equivalentes',SA.neff,SB.neff,v=>Math.round(v));dl('10 mayores empresas',SA.top10,SB.top10,v=>pct(v,0),'pp');
  const ts=L=>Object.entries(L.S).filter(([k])=>!/Sin|Otros|No desglos/.test(k)).sort((a,b)=>b[1]-a[1])[0];const sa=ts(LA);if(sa)dl(sa[0].toLowerCase(),sa[1],LB.S[sa[0]]||0,v=>pct(v,0),'pp');
  $('#ixCmpOut').innerHTML=`${chg.length?`<div class="ix-note"><b>${CMP.add?`Si incorporas ${esc(String(CMP.add.e.tk))} (${Math.round(CMP.addW*100)} %)`:'De A a B'}</b><p>${chg.join(' · ')}</p></div>`:'<p class="mp-note">Diferencias pequeñas entre A y B.</p>'}<div class="ix-leg"><span class="a">A · ${esc(CMP.A.name)}</span><span class="b">B · ${esc(CMP.B.name)}</span></div>
    <div class="ix-cmp">${row('Salud ATLAS',SA.health,SB.health,v=>v==null?'—':Math.round(v)+'/100')}${row('Rent. anual histórica',RA&&RA.cagr,RB&&RB.cagr,v=>pct(v,1))}${row('Volatilidad',RA&&RA.vol,RB&&RB.vol,v=>pct(v,1),1)}${row('Caída máxima',RA&&RA.dd,RB&&RB.dd,v=>pct(v,0))}
      ${row('Empresas equivalentes (máx.)',SA.neff,SB.neff,v=>v==null?'—':Math.round(v))}${row('10 mayores empresas',SA.top10,SB.top10,v=>pct(v,0),1)}${row('EE. UU.',LA.C.US||0,LB.C.US||0,v=>pct(v,0),1)}${row('Emergentes',em(LA),em(LB),v=>pct(v,0))}${row('Coste (TER)',LA.ter,LB.ter,v=>v==null?'—':pct(v,2),1)}${row('Sharpe histórico',sharpe(RA),sharpe(RB),v=>v==null?'—':num(v,2))}${row('P/E (acciones)',peOf(CMP.A.P),peOf(CMP.B.P),v=>v==null?'n/d':num(v,1),1)}</div>
    <p class="pf-vs">Empresas en común entre A y B: <b>≥ ${pct(cov,0)}</b> de la cartera (mayores posiciones publicadas).</p>
    <div class="ix-2"><div><h5>Mayores empresas de A</h5>${LA.comps.slice(0,5).map(c=>`<p class="ix-pr"><span>${esc(c.name)}</span><em>${pct(c.w,1)}</em></p>`).join('')||'<p class="mp-note">Sin datos</p>'}</div><div><h5>Mayores empresas de B</h5>${LB.comps.slice(0,5).map(c=>`<p class="ix-pr"><span>${esc(c.name)}</span><em>${pct(c.w,1)}</em></p>`).join('')||'<p class="mp-note">Sin datos</p>'}</div></div>${divBox}
    ${ab!=null?`<p class="pf-vs">🔗 Correlación entre A y B: <b>${ab.toFixed(2).replace('.',',')}</b> ${ab>.9?'(se mueven casi igual)':ab>.7?'(bastante parecidas)':'(se comportan de forma distinta)'}</p>`:''}
    <h5>Cambio de exposición por país (A → B)</h5>${diff(LA.C,LB.C,c=>CNAME[c]||c)}<h5>Cambio por sector (A → B)</h5>${diff(LA.S,LB.S,s=>s)}
    <div class="ix-btns"><button class="btn2" data-g="A">🌍 Globo de A</button><button class="btn2" data-g="B">🌍 Globo de B</button></div>
    <p class="mp-note">Verde = mejor en esa fila (menor en volatilidad, concentración, EE. UU., P/E y costes; mayor en el resto). Sharpe = (rentabilidad anual − tipo sin riesgo de Ajustes) / volatilidad. Riesgo y rentabilidad: precios semanales en euros de los últimos 5 años con los pesos de hoy. Composición: mayores posiciones conocidas de cada ETF.</p>`;
  $('#ixCmpOut').querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const s=CMP[b.dataset.g];showExposureGlobe(s.P,s.name)})}


/* ------------------------------ 4 · GLOBO 2.0 ------------------------------ */
/* Modos: geo («¿Dónde está mi dinero?»: vista «idx» = país de la empresa según el índice; vista «hq» = sedes reales de las
   empresas identificadas; ingresos por país = sin datos), comp (empresas en su sede), sec (sectores). */
let GEO=null,XP=null,xpMode='geo',xpView='idx';
async function loadCountries(){if(GEO)return GEO;GEO=await (await fetch('data/countries.geojson')).json();return GEO}
const ctrOf=c=>{const f=GEO&&GEO.features.find(x=>x.properties.c===c);return f?[f.properties.lx,f.properties.ly]:null};
function hqOf(c){const e=ents().find(x=>x.k==='s'&&(x.t===c.tk||ckey(x.name,x.t)===c.key));const g=e&&entGeo(e);return g?{ll:[g[1],g[0]],exact:true,addr:g[2]}:(()=>{const p=ctrOf(c.cc);return p?{ll:p,exact:false}:null})()}
async function showExposureGlobe(P,name,mode){await loadExpo();if(typeof map==='undefined'||!map||!mapReady){toast('El mapa aún se está cargando');return}closeHub();if(typeof closePlace==='function')closePlace();
  if(mode)xpMode=mode;XP={P,name,L:lookThrough(P),sec:null};document.body.classList.add('xp-on');await loadCountries();drawExposure();renderXpBar();ovHide(true);
  if(typeof sq!=='undefined'&&sq.active){sq.active=false;updateMap()}const tc=Object.entries(XP.L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1])[0],p=tc&&ctrOf(tc[0]),ctr=p?[(p[0]+10)/2,Math.max(-10,Math.min(45,(p[1]+30)/2))]:[10,30];
  map.flyTo({center:ctr,zoom:mobile()?0.9:1.6,pitch:0,bearing:0,duration:1200})}
const inRing=(pt,r)=>{let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>pt[1])!==(yj>pt[1]))&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)ins=!ins}return ins};
const _ccAt=new Map();function ccAt(ll){const k=ll.join(',');if(_ccAt.has(k))return _ccAt.get(k);let out=null;for(const f of GEO.features){const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];if(polys.some(p=>inRing(ll,p[0]))){out=f.properties.c;break}}_ccAt.set(k,out);return out}
/* Sedes reales: país donde está la dirección de la sede (base de datos de ATLAS), no el país que asigna el índice. */
function hqShare(L){const H={};let known=0;L.comps.forEach(c=>{const h=hqOf(c);if(!h||!h.exact)return;const cc=ccAt(h.ll);if(!cc)return;H[cc]=(H[cc]||0)+c.w;known+=c.w});H._known=known;return H}
function drawExposure(){if(!XP||!GEO)return;const m=map,L=XP.L;
  const vals=xpMode==='geo'&&xpView==='hq'?hqShare(L):L.C;const mx=Math.max(...Object.entries(vals).filter(([c])=>c!=='XX'&&c!=='_known').map(([,v])=>v),1);
  const fc={type:'FeatureCollection',features:GEO.features.map(f=>({...f,properties:{...f.properties,v:vals[f.properties.c]||0,r:(vals[f.properties.c]||0)/mx}}))};
  if(!m.getSource('xp-cty')){m.addSource('xp-cty',{type:'geojson',data:fc});
    const EMI=typeof MBX!=='undefined'&&MBX?{'fill-emissive-strength':1}:{},EML=typeof MBX!=='undefined'&&MBX?{'line-emissive-strength':1}:{};
    /* rampa muy contrastada sobre el globo oscuro: violeta → magenta → coral → ámbar → amarillo */
    m.addLayer({id:'xp-fill',type:'fill',source:'xp-cty',paint:{'fill-color':['interpolate',['linear'],['get','r'],0,'rgba(0,0,0,0)',0.0001,'#5b2bd6',0.04,'#9b37e0',0.15,'#e0458f',0.35,'#ff6f4d',0.65,'#ffae34',1,'#ffe45c'],'fill-opacity':['case',['>',['get','v'],0],0.9,0],...EMI}});
    m.addLayer({id:'xp-line',type:'line',source:'xp-cty',paint:{'line-color':['case',['>',['get','v'],0],'rgba(255,255,255,0.85)','rgba(200,220,255,0.18)'],'line-width':['case',['>',['get','v'],0],1.1,0.5],...EML}});
    m.addLayer({id:'xp-hov',type:'line',source:'xp-cty',filter:['==',['get','c'],''],paint:{'line-color':'rgba(255,255,255,.95)','line-width':2.2,...EML}});
    m.addLayer({id:'xp-sel',type:'line',source:'xp-cty',filter:['==',['get','c'],''],paint:{'line-color':'#5ee7ff','line-width':3.4,'line-blur':.4,...EML}});
    m.addSource('xp-cl',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'xp-clbl',type:'symbol',source:'xp-cl',layout:{'text-field':['get','l'],'text-size':12,'text-allow-overlap':false,'text-padding':4},paint:{'text-color':'#ffffff','text-halo-color':'rgba(5,6,15,.9)','text-halo-width':1.6}});
    let hovC='';m.on('mousemove','xp-fill',ev=>{const f=ev.features&&ev.features[0];const c=f&&f.properties.v>0?f.properties.c:'';if(c!==hovC){hovC=c;m.setFilter('xp-hov',['==',['get','c'],c])}});m.on('mouseleave','xp-fill',()=>{hovC='';m.setFilter('xp-hov',['==',['get','c'],''])});
    m.addSource('xp-pts',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'xp-circ',type:'circle',source:'xp-pts',paint:{'circle-radius':['interpolate',['linear'],['get','w'],0,3,1,6,5,13,15,24],'circle-color':['get','c'],'circle-opacity':.8,'circle-stroke-color':['case',['get','x'],'#ffffff','rgba(255,255,255,.35)'],'circle-stroke-width':['case',['get','x'],1,.6]}});
    m.addLayer({id:'xp-lbl',type:'symbol',source:'xp-pts',layout:{'text-field':['get','l'],'text-size':11,'text-offset':[0,1.6],'text-allow-overlap':false},paint:{'text-color':'#e9f0ff','text-halo-color':'#05060f','text-halo-width':1.4}});
    m.on('click','xp-fill',ev=>{if(!XP||xpMode!=='geo')return;const f=ev.features&&ev.features[0];if(f)selCountry(f.properties.c);if(f)openCountry(f.properties.c,CNAME[f.properties.c]||f.properties.n)});
    m.on('click','xp-circ',ev=>{const f=ev.features&&ev.features[0];if(f&&f.properties.cc)openCountry(f.properties.cc,CNAME[f.properties.cc]||f.properties.cc)});
    m.on('mouseenter','xp-fill',()=>m.getCanvas().style.cursor='pointer');m.on('mouseleave','xp-fill',()=>m.getCanvas().style.cursor='')}
  else m.getSource('xp-cty').setData(fc);
  ['xp-fill','xp-line','xp-hov','xp-sel','xp-circ','xp-lbl','xp-clbl'].forEach(id=>m.setLayoutProperty(id,'visibility','visible'));m.setLayoutProperty('xp-fill','visibility',xpMode==='geo'?'visible':'none');m.setLayoutProperty('xp-clbl','visibility',xpMode==='geo'?'visible':'none');
  m.getSource('xp-cl').setData({type:'FeatureCollection',features:Object.entries(vals).filter(([c,v])=>c!=='XX'&&c!=='_known'&&v>=1).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([c,v])=>{const p=ctrOf(c);return p?{type:'Feature',geometry:{type:'Point',coordinates:p},properties:{l:`${CNAME[c]||c} ${pct(v,v<10?1:0)}`}}:null}).filter(Boolean)});
  const pts=[];if(xpMode!=='geo'){L.comps.slice(0,80).forEach(c=>{if(xpMode==='sec'&&XP.sec&&c.sec!==XP.sec)return;const h=hqOf(c);if(!h)return;
      pts.push({type:'Feature',geometry:{type:'Point',coordinates:h.ll},properties:{w:XP.focus===c.key?Math.max(8,c.w*1.6):c.w,l:c.name.split(' ').slice(0,2).join(' ')+' '+pct(c.w),c:XP.focus===c.key?'#5ee7ff':XP.focus?'rgba(150,160,190,.55)':(SEC_C[c.sec]||'#b49ae6'),cc:c.cc,x:h.exact}})})}
  m.getSource('xp-pts').setData({type:'FeatureCollection',features:pts})}
function renderXpBar(){let b=$('#xpbar');if(!XP){if(b)b.remove();return}if(!b){b=document.createElement('div');b.id='xpbar';document.body.appendChild(b)}
  const L=XP.L,vals=xpMode==='geo'&&xpView==='hq'?hqShare(L):L.C,top=Object.entries(vals).filter(([c,v])=>c!=='XX'&&c!=='_known'&&v>=.5).sort((a,b)=>b[1]-a[1]).slice(0,6),secs=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  const Q={geo:'¿Dónde está mi dinero?',comp:'¿Qué empresas tengo realmente?',sec:'¿A qué sectores estoy expuesto?'};
  b.innerHTML=`<div class="xp-h"><div><small>${esc(XP.name)}</small><b>${Q[xpMode]}</b></div><button data-xpx aria-label="Cerrar">✕</button></div>
    <div class="xp-seg">${[['geo','Geografía'],['comp','Empresas'],['sec','Sectores']].map(([k,l])=>`<button data-xpm="${k}" aria-pressed="${xpMode===k}">${l}</button>`).join('')}</div>
    ${xpMode==='geo'?`<div class="xp-view">${[['idx','Exposición de cartera'],['hq','Sedes de empresas']].map(([k,l])=>`<button data-xpv="${k}" aria-pressed="${xpView===k}">${l}</button>`).join('')}<button disabled title="Requiere datos de ingresos por país de cada empresa: no disponibles">Ingresos · sin datos</button></div>
      <div class="xp-top">${top.map(([c,v])=>`<button data-cty="${c}"><span>${esc(CNAME[c]||c)}</span><b>${pct(v,0)}</b></button>`).join('')}</div>
      <div class="xp-leg"><span>0 %</span><i></i><span>${pct(Math.max(...top.map(t=>t[1]),0),0)}</span></div><p class="xp-n">${xpView==='idx'?`País de cada empresa según el proveedor del índice (justETF). No es dónde factura.${L.C.XX?` ${pct(L.C.XX,0)} no desglosado.`:''}`:`País de la dirección real de la sede. Solo empresas con sede localizada en ATLAS: ${pct(vals._known,0)} de la cartera (de ${pct(L.cover,0)} identificado).`} Toca un país.</p>`:''}
    ${xpMode==='sec'?`<div class="xp-top">${secs.slice(0,8).map(([s,v])=>`<button data-sec="${esc(s)}" class="${XP.sec===s?'on':''}" style="--c:${SEC_C[s]||'#7aa2ff'}"><span>${esc(s)}</span><b>${pct(v,0)}</b></button>`).join('')}</div><p class="xp-n">${XP.sec?`Empresas de ${esc(XP.sec)} en su sede. Viene de: ${(L.byS[XP.sec]||[]).sort((a,b)=>b.p-a.p).slice(0,3).map(x=>`${tk(x.e)} ${pct(x.p,0)}`).join(' · ')}`:'Elige un sector para ver sus empresas en el mapa.'}</p>`:''}
    ${xpMode==='comp'&&XP.focus?(()=>{const c=L.comps.find(x=>x.key===XP.focus);const h=c&&hqOf(c);return c?`<div class="xp-co"><b>${esc(c.name)}</b><p class="xp-big">${c.up&&c.up>c.w+.05?`${num(c.w,1)}–${pct(c.up,1)}`:pct(c.w,1)}<small>de tu cartera</small></p><p class="xp-n">Viene de: ${c.by.map(b=>`${esc(b.e.name)} ${pct(b.w,1)}`).join(' · ')}</p><p class="xp-n">${h&&h.exact?`Sede: ${esc(h.addr||'')}`:'Sede no localizada: se muestra el centro del país'} · ${esc(c.sec||'sector sin dato')}</p><button class="lnk" data-xpf>Ver todas las empresas</button></div>`:''})():''}
    ${xpMode==='comp'&&!XP.focus?`<ol class="xp-list">${L.comps.slice(0,6).map(c=>`<li><button data-xpc="${esc(c.key)}"><span>${esc(c.name)}</span><b>${pct(c.w,1)}</b></button></li>`).join('')}</ol><p class="xp-n">Burbujas en la sede real (borde blanco) o en el centro del país si no hay dirección. Tamaño = peso mínimo en tu cartera.</p>`:''}
    <p class="xp-s">justETF + Yahoo Finance · ${fdate((XP.P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop()))}</p>`;
  b.querySelector('[data-xpx]').onclick=()=>hideExposure();const xf=b.querySelector('[data-xpf]');if(xf)xf.onclick=()=>{XP.focus=null;xpBack();drawExposure();renderXpBar()};b.querySelectorAll('[data-xpc]').forEach(x=>x.onclick=()=>{XP.focus=x.dataset.xpc;drawExposure();renderXpBar();const c=L.comps.find(z=>z.key===XP.focus),h=c&&hqOf(c);if(h)xpFly(h)});
  b.querySelectorAll('[data-xpm]').forEach(x=>x.onclick=()=>{xpMode=x.dataset.xpm;XP.sec=null;XP.focus=null;xpBack();drawExposure();renderXpBar()});
  b.querySelectorAll('[data-xpv]').forEach(x=>x.onclick=()=>{xpView=x.dataset.xpv;drawExposure();renderXpBar()});
  b.querySelectorAll('[data-cty]').forEach(x=>x.onclick=()=>openCountry(x.dataset.cty,CNAME[x.dataset.cty]||x.dataset.cty));
  b.querySelectorAll('[data-sec]').forEach(x=>x.onclick=()=>{XP.sec=XP.sec===x.dataset.sec?null:x.dataset.sec;drawExposure();renderXpBar()})}
function focusCompany(A,key){const c=A.L.comps.find(x=>x.key===key);if(!c)return;showExposureGlobe(A.P,A.name,'comp').then(()=>{if(!XP)return;XP.focus=key;drawExposure();renderXpBar();const h=hqOf(c);if(h&&map)setTimeout(()=>xpFly(h),1300)})}
/* cámara: al enfocar una empresa se guarda la vista; al cerrar su ficha se vuelve a ella */
function xpFly(h){if(!XP)return;if(!XP.cam)XP.cam={center:map.getCenter(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()};map.flyTo({center:h.ll,zoom:h.exact?4.2:3,duration:1400,essential:true})}
function xpBack(){if(XP&&XP.cam){const c=XP.cam;XP.cam=null;map.flyTo({...c,duration:1200,essential:true})}}
function hideExposure(){if(XP&&XP.cam)xpBack();XP=null;document.body.classList.remove('xp-on');const m=map;['xp-fill','xp-line','xp-hov','xp-sel','xp-circ','xp-lbl','xp-clbl'].forEach(id=>{if(m&&m.getLayer(id))m.setLayoutProperty(id,'visibility','none')});if(m&&m.getSource('xp-pts'))m.getSource('xp-pts').setData({type:'FeatureCollection',features:[]});renderXpBar();ovShow()}

/* ------------------------------ PAÍS: «¿Cómo estoy expuesto a este país?» ------------------------------ */
let CTY=null,ctyTab='etf';
const CTY_ETF={US:'SPY',JP:'EWJ',IN:'INDA',CN:'MCHI',GB:'VGK',FR:'VGK',DE:'VGK',CH:'VGK',NL:'VGK',ES:'VGK',IT:'VGK',SE:'VGK',DK:'VGK',TW:'EEM',KR:'EEM',BR:'EEM'};
function selCountry(c){try{if(map&&map.getLayer('xp-sel'))map.setFilter('xp-sel',['==',['get','c'],c||''])}catch(_){}}
function openCountry(c,n){CTY={c,n};selCountry(c);if(XP&&map&&mapReady){const p=ctrOf(c);if(p&&!mobile())map.flyTo({center:[p[0]+6,p[1]],zoom:Math.max(2.2,map.getZoom()),duration:1400,essential:true})}ctyTab='etf';openHub('cty')}
async function renderCountry(){const el=$('#ixcty');if(!el||!CTY)return;let X=XP;if(!X){const A=await analyze();X=A&&!A.empty?{P:A.P,name:A.name,L:A.L}:null}
  if(!X){el.innerHTML='<p class="mp-note">Primero crea o elige una cartera en «Análisis».</p>';return}
  const L=X.L,c=CTY.c,tot=L.C[c]||0,dir=L.dir[c]||0,ind=L.ind[c]||0,nm=CTY.n||CNAME[c]||c;
  const by=(L.byC[c]||[]).filter(b=>b.p>.005).sort((a,b)=>b.p-a.p),comps=L.comps.filter(x=>x.cc===c),secs={};comps.forEach(x=>secs[x.sec||UNK]=(secs[x.sec||UNK]||0)+x.w);
  const pe=CTY_ETF[c]?ents().find(x=>x.t===CTY_ETF[c]):null,rk=pe&&RANK?RANK[priceKey(pe.k,pe.obj)]:null;const asof=(X.P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop());
  el.innerHTML=`<div class="ix-cty"><div class="ix-k">¿Cómo estoy expuesto a ${esc(nm)}?</div><div class="ix-big">${pct(tot)}<small>de ${esc(X.name)}</small></div>
    <div class="ix-split"><div style="flex:${dir||.0001}"><span>Directa</span><b>${pct(dir)}</b></div><div style="flex:${ind||.0001}"><span>Indirecta (ETFs y fondos)</span><b>${pct(ind)}</b></div></div>
    <nav class="ix-tabs">${[['etf','ETFs'],['comp','Empresas'],['sec','Sectores']].map(([k,l])=>`<button data-ct="${k}" aria-selected="${ctyTab===k}">${l}</button>`).join('')}</nav>
    <div class="ix-ctb">${ctyTab==='etf'?(by.length?by.map(b=>`<div class="ix-bar"><span>${esc(b.e.name)}</span><i><b style="width:${tot?b.p/tot*100:0}%;background:var(--acc)"></b></i><em>${pct(b.p,2)}</em></div>`).join('')+`<p class="mp-note">Suma de (peso del activo en tu cartera × % del activo en ${esc(nm)}).</p>`:'<p class="mp-note">Ningún activo tuyo tiene exposición publicada a este país.</p>')
      :ctyTab==='comp'?(comps.length?comps.slice(0,15).map(x=>`<div class="ix-bar"><span>${esc(x.name)}</span><i><b style="width:${tot?x.w/tot*100:0}%;background:var(--acc)"></b></i><em>${pct(x.w,2)}</em></div>`).join('')+`<p class="mp-note">Solo las empresas identificadas (10 mayores posiciones de cada ETF): explican ${pct(comps.reduce((a,x)=>a+x.w,0),1)} de los ${pct(tot,1)}. El resto no está desglosado.</p>`:'<p class="mp-note">Ninguna de las empresas identificadas es de este país.</p>')
      :(comps.length?bars(secs,8,s=>s,s=>s===UNK?SEC_C[UNK]:'var(--acc)')+'<p class="mp-note">Sectores de las empresas identificadas de este país (parcial).</p>':'<p class="mp-note">Sin empresas identificadas para desglosar por sector.</p>')}</div>
    <div class="ix-k">Comportamiento del mercado</div>${rk?`<div class="ix-kpi"><div><span>1 año</span><b>${pct(rk.r1y,1)}</b></div><div><span>3 años, anual</span><b>${pct(rk.r3y,1)}</b></div><div><span>Volatilidad</span><b>${pct(rk.vol,0)}</b></div><div><span>Caída máx. 1 año</span><b>${pct(rk.dd1y,0)}</b></div></div><p class="mp-note">Referencia: ${esc(pe.name)}${['VGK','EEM'].includes(CTY_ETF[c])?' (región, no solo el país)':''}.</p>`:'<p class="mp-note">ATLAS no tiene un ETF de referencia para este país: sin datos históricos.</p>'}
    ${srcl('justETF (países) + Yahoo Finance (posiciones, precios)',asof,'País de la empresa según el índice')}</div>`;
  el.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{ctyTab=b.dataset.ct;renderCountry()});
  const h=document.querySelector('.right .phead h2 .sp');if(h)h.textContent='◍ '+nm}

/* ------------------------------ 5 · RESUMEN (Overview) sobre el globo ------------------------------ */
let OV={collapsed:(()=>{try{const v=localStorage.getItem('atlas_ov2');return v==null?true:v==='0'}catch(_){return true}})(),hidden:false};   // empieza recogida (una línea): se amplía al tocarla
function ovEl(){let b=$('#ovcard');if(!b){b=document.createElement('section');b.id='ovcard';document.body.appendChild(b)}return b}
function ovHide(soft){OV.hidden=true;const b=$('#ovcard');if(b)b.hidden=true}
function ovShow(){OV.hidden=false;if(!XP)renderOverview()}
async function renderOverview(){if(OV.hidden||XP||typeof MAPMODE==='undefined'||!MAPMODE)return;const b=ovEl();b.hidden=false;
  const brand=OV.collapsed?'':`<div class="ov-br"><b>ATLAS</b><span>Inteligencia de ETFs y carteras</span></div>`;
  const QK=!PF.length&&DOC.rows&&DOC.rows.some(r=>r.k&&+r.w>0);
  if(!PF.length&&!QK){b.className='ov empty'+(OV.collapsed?' col':'');b.innerHTML=`${brand}<div class="ov-h"><div><b class="ov-t">¿Cuántas apuestas reales hay en tu cartera?</b></div><button data-ov="col" aria-label="Plegar">${OV.collapsed?'▴':'▾'}</button></div>${OV.collapsed?'':`<p>Seis ETFs pueden ser una sola apuesta. Pega tu cartera y en 30 segundos verás:</p><ul class="ov-chk"><li>Cuántas apuestas independientes haces de verdad</li><li>Qué empresas, sectores y países tienes por debajo</li><li>Dónde se solapan tus ETFs</li><li>Qué riesgos no se ven a simple vista</li></ul><div class="ov-b"><button class="btn" data-ov="qp">Pegar mi cartera</button><button class="btn2" data-ov="ex">Ver un ejemplo</button></div><p class="ov-fine">Sin cuenta. Tus datos se quedan en este dispositivo.</p>`}`;bindOv(b);return}
  b.className='ov'+(OV.collapsed?' col':'');if(!b.querySelector('.ov-h'))b.innerHTML=`${brand}<div class="sk"><i></i><i></i><i></i></div>`;
  const SRC=PF.length?'pf':'custom',A=await analyzeSrc(SRC);if(OV.hidden||XP||!A||A.empty)return;
  const v=_pfV||{val:0,inv:0},ret=v.inv?(v.val/v.inv-1)*100:null,ins=A.D.filter(d=>d.sev!=='info').slice(0,mobile()?2:3);
  b.innerHTML=`${brand}<div class="ov-h">${SRC==='pf'?`<div class="ov-v"><small>Tu cartera</small><b data-count="${Math.round(v.val)}">${num(v.val)}</b><span class="ov-eur">€</span><em class="${(ret||0)<0?'dn':'up'}">${ret==null?'—':(ret>0?'+':'')+pct(ret,1)}</em></div>`:`<div class="ov-v"><small>Cartera rápida · por pesos</small><b class="ov-q">Rayos X</b><button class="lnk" data-ov="qp">Editar</button></div>`}<button class="ov-g" data-ov="doc" title="Ver por qué">${gauge(A.SC,OV.collapsed?58:96)}</button><button data-ov="col" class="ov-c" aria-label="${OV.collapsed?'Desplegar':'Plegar'}">${OV.collapsed?'▴':'▾'}</button></div>
    ${OV.collapsed?'':`${A.SC.bets&&A.R&&A.P.length>1?`<button class="ov-bets" data-ov="doc"><span><b>${A.P.length}</b> productos</span><i>→</i><span><b>≈ ${fmtB(A.SC.bets.nb)}</b> apuesta${A.SC.bets.nb>=1.05?'s':''} independiente${A.SC.bets.nb>=1.05?'s':''}</span><em>Ver por qué</em></button>`:''}<p class="ov-lead">${esc(headline(A))}</p><ul class="ov-i">${ins.map(d=>`<li style="--c:${SEV[d.sev][2]}"><b>${esc(d.t)}</b><em>${esc(d.metric)}</em></li>`).join('')}</ul>
    <div class="ov-b"><button class="btn" data-ov="doc">Analizar cartera</button><div class="ov-x"><span>Exposición de tu cartera</span><button data-ov="geo">Países</button><button data-ov="comp">Empresas</button><button data-ov="sec">Sectores</button></div></div>`}`;bindOv(b,A);countUpEur(b);todayInto(b,A)}
/* ---------- Inicio · «Hoy / Lo que importa ahora» ---------- */
const sgn=v=>v>0?'+':v<0?'−':'';const pctS=(v,d=2)=>sgn(v)+pct(Math.abs(v)*100,d);const eurS=v=>sgn(Math.round(v))+num(Math.abs(v))+' €';
const hhmm=t=>new Date(t).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
const dLong=d=>new Date(d+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
async function todayInto(b,A){const h=b.querySelector('.ov-h');if(!h)return;const ov=b.querySelector('.ov-v');
  let day=b.querySelector('.ov-day');if(!day&&ov){ov.insertAdjacentHTML('beforeend','<span class="ov-day" aria-live="polite">Hoy …</span>');day=b.querySelector('.ov-day')}
  let box=null;if(!OV.collapsed){h.insertAdjacentHTML('afterend','<section class="td" aria-label="Lo que importa ahora"><div class="sk"><i></i></div></section>');box=b.querySelector('.td')}
  const T=await pContribution(A);if(!b.isConnected)return;
  if(!T){if(day)day.textContent='Sin cotización disponible';if(box)box.remove();return}
  const DS=T.data.state,closed=T.status==='close',stale=DS==='stale',lbl=closed?`Último cierre (${dLong(T.session)})`:'Hoy',dn=T.R<0;
  const N0=A.P.length,IND0=T.ind.filter(o=>o.via.some(e=>e.k!=='s')),lead0=IND0.find(o=>o.share!=null&&o.share>=.25&&o.share<=1.05);
  const shortN=n=>esc(String(n).replace(/ (Corp|Inc|Ltd|Co|Corporation|Class [A-C]|Holdings?|Group|Platforms|Incorporated)\b.*$/,'').split(' ').slice(0,2).join(' '));
  const when=stale?`<span class="ov-st warn">Datos sin actualizar desde ${hhmm(Date.parse(T.data.updated))}</span>`:T.ts&&!closed?`<span class="ov-st">${hhmm(T.ts)}</span>`:'';
  const why0=lead0?`<span class="ov-ld">${shortN(lead0.name)} explica ${lead0.exact?'≈':'≥'} ${num(lead0.share*100,0)} %</span>`:'';
  if(day)day.innerHTML=`<span class="ov-dv ${dn?'dn':'up'}">${lbl} ${pctS(T.R)}${T.eur?` · ${eurS(T.eur.d)}`:''}</span>${when}${why0}`;
  if(A.src&&A.src.src==='pf'&&typeof _pfDay!=='undefined'&&T.eur){try{_pfDay={v:T.eur.now,c:T.R*100};renderTick()}catch(_){}}   // la franja usa la misma cifra (en euros)
  if(!box)return;
  const N=A.P.length,IND=T.ind.filter(o=>o.via.some(e=>e.k!=='s')),lead=IND.find(o=>o.share!=null&&o.share>=.25),top=T.items[0],quiet=Math.abs(T.R)<.0005;
  const st=stale?`<span class="td-st warn">Datos sin actualizar desde ${hhmm(Date.parse(T.data.updated))} · se muestra la última cotización recibida</span>`:T.status==='live'?`<span class="td-st live">En directo · ${hhmm(T.ts)}</span>`:T.status==='delayed'?`<span class="td-st">Actualizado ${hhmm(T.ts)}</span>`:`<span class="td-st">Mercado cerrado · último cierre disponible (${dLong(T.session)})</span>`;
  let why;if(quiet)why=`Día tranquilo: tu cartera apenas se ha movido.`;
  else if(lead&&lead.share>1.05)why=`<strong>${esc(lead.name.replace(/ (Corp|Inc|Ltd|Co|Corporation|Class [A-C])\b.*$/,''))}</strong> (${pctS(lead.r,1)}) ha pesado más que todo el movimiento neto de ${closed?'la última sesión':'hoy'}: el resto de tu cartera lo ha compensado en parte. Pesa ${lead.exact?'':'≥ '}${pct(lead.wmin*100,0)} de tu cartera. <span class="q est">Estimación</span>`;
  else if(lead)why=`<strong>${esc(lead.name.replace(/ (Corp|Inc|Ltd|Co|Corporation|Class [A-C])\b.*$/,''))}</strong> explica <strong>${lead.exact?'≈':'≥'} ${num(lead.share*100,0)} %</strong> del movimiento de ${closed?'la última sesión':'hoy'}: ${pctS(lead.r,1)}, y pesa ${lead.exact?'':'≥ '}${pct(lead.wmin*100,0)} de tu cartera (en ${lead.products} de ${N} productos). <span class="q est">Estimación</span>`;
  else why=`<strong>${tk(top.e)}</strong> es lo que más te ha movido: ${pctS(top.r,1)} → ${pctS(top.c)} de tu cartera${top.eur!=null?` (${eurS(top.eur)})`:''}. <span class="q real">Dato</span>`;
  const mx=Math.max(...T.items.map(i=>Math.abs(i.c)),1e-9);
  const bars=T.items.slice(0,4).map(i=>`<li><button class="tb-tk lnk" data-az="${esc(i.e.k+':'+i.e.t)}" title="Analizar">${tk(i.e)}</button><span class="tb-r">${i.today?pctS(i.r,1):'sin cotizar'}</span><span class="tb-bar"><i class="${i.c<0?'dn':'up'}" style="width:${(Math.abs(i.c)/mx*50).toFixed(1)}%"></i></span><span class="tb-c ${i.c<0?'dn':'up'}">${i.eur!=null?eurS(i.eur):pctS(i.c)}</span></li>`).join('');
  const inside=IND.filter(o=>Math.abs(o.est)>=.0002).slice(0,3);
  box.innerHTML=`<div class="td-h"><span class="td-t">Lo que importa ${closed?'de la última sesión':'ahora'}</span>${st}</div>
    <p class="td-why">${why}</p>
    <div class="td-k">Qué te ha movido · por producto <span class="q real">Dato</span></div><ul class="td-bars">${bars}</ul>
    ${inside.length?`<details class="td-d"${innerWidth>700?' open':''}><summary><span class="td-k">Por dentro de tus ETFs <span class="q est">Estimación</span></span></summary><ul class="td-in">${inside.map(o=>`<li><div><button class="lnk az-co" data-az="${esc(ATLASI.assets.companyId(o.key))}">${esc(o.name.replace(/ (Corp|Inc|Ltd|Co|Corporation|Class [A-C])\b.*$/,''))}</button><span>${o.exact?'':'≥ '}${pct(o.wmin*100,0)} de tu cartera · ${o.products} de ${N} productos</span></div><em>${pctS(o.r,1)}</em><strong class="${o.est<0?'dn':'up'}">≈ ${pctS(o.est)}</strong></li>`).join('')}</ul></details>`:''}
    ${(()=>{const I=lead?pImpact(A,T,lead.key):null;const imp=I?`<p class="td-imp"><strong><button class="lnk az-co" data-az="${esc(ATLASI.assets.companyId(I.key))}">${shortN(I.name)}</button> ${pctS(I.r,1)}</strong> → impacto estimado en tu cartera <strong>${I.exact?'':'al menos '}${pctS(I.est)}</strong> ${I.exact?'<span class="q real">Dato</span>':'<span class="q est">Estimación</span>'}<br><span>Afecta a ${I.products} de ${I.of} productos · ${I.exact?'exposición':'exposición mínima garantizada'} ${I.exact?'':'≥ '}${pct(I.wmin*100,1)}${I.direct>0?` (directa ${pct(I.direct*100,1)}, dentro de ETFs ${I.exact?'':'≥ '}${pct(I.indirect*100,1)})`:' (dentro de tus ETFs)'}${I.exact?'':'. Estimación basada en posiciones conocidas: el impacto real puede ser mayor.'}</span></p>`:'';
      return imp+`<div class="td-a"><button class="btn2 sm" data-tdv="${lead?esc(lead.key):''}">Ver exposición</button><button class="btn2 sm" data-tds="${lead?esc(lead.key):''}">Simular</button><button class="btn2 sm" data-tdq="1">Preguntar</button></div>`})()}
    ${T.missing.length?`<p class="td-n">${T.missing.map(i=>tk(i.e)).join(', ')}: sin cotización de esta sesión; cuenta como 0 %.</p>`:''}
    <details class="td-how"><summary>Cómo se calcula</summary><ul>
      <li><strong>Por producto (dato):</strong> rentabilidad en euros de cada producto desde el cierre anterior (precio + divisa) × su peso de ayer. La suma es el movimiento de tu cartera${T.eur?'; los euros salen de tu valor de ayer':'; sin importes, solo en %'}.</li>
      <li><strong>Por dentro (estimación):</strong> movimiento de la empresa × su peso en tu cartera, contando solo las posiciones publicadas de cada ETF (por eso «≥»). Explica parte del movimiento de tus ETFs; no se suma a él.</li>
      <li>Fuente: ${esc(T.src)}. Sesión: ${fdate(T.session)}${T.ts?`, última cotización ${hhmm(T.ts)}`:''}. Retraso habitual: hasta 15–20 min.</li></ul></details>`;
  box.querySelectorAll('[data-az]').forEach(x=>x.onclick=ev=>{ev.stopPropagation();track('today_analyze');ATLASI.analyze(x.dataset.az)});
  const bv=box.querySelector('[data-tdv]');if(bv)bv.onclick=()=>{track('exposure_click');bv.dataset.tdv?focusCompany(A,bv.dataset.tdv):showExposureGlobe(A.P,A.name,'comp')};
  const bs=box.querySelector('[data-tds]');if(bs)bs.onclick=()=>openExplore(bs.dataset.tds?{kind:'comp',ref:bs.dataset.tds,id:ATLASI.assets.companyId(bs.dataset.tds)}:null);
  const bq=box.querySelector('[data-tdq]');if(bq)bq.onclick=()=>openExplore(null,true);
  if(box.classList.contains('mini')){box.style.cursor='pointer';box.title='Ver detalle';box.onclick=()=>{const c=b.querySelector('[data-ov=col]');if(c)c.click()}}}
function countUpEur(b){const el=b.querySelector('.ov-v b[data-count]');if(!el||RM()||el.dataset.done)return;el.dataset.done=1;const to=+el.dataset.count,t0=performance.now();const st=t=>{const k=Math.min(1,(t-t0)/800),e=1-Math.pow(1-k,3);el.textContent=num(to*e);if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st)}
function bindOv(b,A){b.onclick=e=>{if(!b.classList.contains('col')||e.target.closest('button,a,input,textarea'))return;const c=b.querySelector('[data-ov=col]');if(c)c.click()};b.querySelectorAll('[data-ov]').forEach(x=>x.onclick=()=>{const k=x.dataset.ov;
  if(k==='col'){OV.collapsed=!OV.collapsed;if(!OV.collapsed)track('today_open');try{localStorage.setItem('atlas_ov2',OV.collapsed?'0':'1')}catch(_){}renderOverview();return}
  if(k==='pf')openHub('pf');else if(k==='ex'){loadExample();DOC.tab='doctor';saveDoc();openHub('doc')}else if(k==='doc'){DOC.src=PF.length?'pf':'custom';DOC.tab='doctor';saveDoc();openHub('doc')}else if(k==='qp'){DOC.src='custom';DOC.tab='doctor';saveDoc();openHub('doc');setTimeout(()=>{const t=$('#qpT');if(t)t.focus()},400)}else if(A)showExposureGlobe(A.P,A.name,k)})}

/* ------------------------------ integración ------------------------------ */
/* Globo en móvil: centrarlo en el hueco visible (entre la barra superior y la tarjeta de inicio) para que se pueda arrastrar con el dedo
   en vez de quedar escondido debajo de los paneles. */
let _padT=0;function syncMapPad(){clearTimeout(_padT);_padT=setTimeout(()=>{if(typeof map==='undefined'||!map||typeof mapReady==='undefined'||!mapReady)return;
  if(map.isMoving&&map.isMoving()){syncMapPad();return}const m=innerWidth<=700;let top=0,bottom=0;
  if(m){const mb=document.getElementById('mapBar'),ov=document.getElementById('ovcard'),bb=document.getElementById('bbar');const r=mb&&mb.getBoundingClientRect();top=r&&r.height?Math.max(0,Math.round(r.bottom-24)):90;
    const vis=el=>el&&!el.hidden&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
    bottom=vis(ov)?Math.round(innerHeight-ov.getBoundingClientRect().top+4):vis(bb)?Math.round(innerHeight-bb.getBoundingClientRect().top+4):0;
    if(innerHeight-top-bottom<180)bottom=Math.max(0,innerHeight-top-180)}
  else return;
  const c=map.getPadding?map.getPadding():{top:0,bottom:0};if(Math.abs((c.top||0)-top)<6&&Math.abs((c.bottom||0)-bottom)<6&&!(c.left||c.right))return;if(document.body.classList.contains('hub-open')||(typeof mapFocus!=='undefined'&&mapFocus))return;
  try{map.easeTo({padding:{top,bottom,left:0,right:0},duration:300,essential:true})}catch(_){}},120)}
function install(){if(typeof HUB==='undefined'||!document.getElementById('menu')||!document.querySelector('.right .pbody')){setTimeout(install,400);return}
  Object.assign(HUB,{doc:['◐','Análisis de cartera'],radar:['◇','Radar'],cmp:['⇄','Comparar'],cty:['◍','País']});
  const pb=document.querySelector('.right .pbody');[['ixdoc','doc'],['ixradar','radar'],['ixcmp','cmp'],['ixcty','cty']].forEach(([id,s])=>{if(!document.getElementById(id)){const d=document.createElement('div');d.id=id;d.className='pf ix';d.dataset.s=s;pb.prepend(d)}});
  const st=document.createElement('style');st.textContent=['doc','radar','cmp','cty'].map(s=>`body.mapmode #app .right[data-sec=${s}] .pbody>[data-s=${s}]{display:flex!important}`).join('');document.head.appendChild(st);
  document.addEventListener('click',async e=>{const b=e.target.closest('#menu [data-hub=xp],#menu [data-hub=ov],#menu [data-hub=srch]');if(!b)return;e.stopPropagation();const m=document.getElementById('menu');if(m){m.hidden=true;document.body.classList.remove('menu-open');const bm=document.querySelector('.bb-menu');if(bm)bm.setAttribute('aria-expanded','false')}
    closeHub();if(b.dataset.hub==='srch'){openSearch();return}if(b.dataset.hub==='ov'){if(XP)hideExposure();OV.collapsed=false;ovShow();return}
    const A=await analyzeSrc(PF.length?'pf':DOC.src);if(!A||A.empty){toast('Primero crea una cartera');DOC.tab='doctor';openHub('doc');return}showExposureGlobe(A.P,A.name,'geo')},true);
  const orig=window.openHub;window.openHub=function(sec){orig(sec);ovHide();if(sec==='doc')renderDoc();if(sec==='radar')renderRadar();if(sec==='cmp')renderCompare();if(sec==='cty')renderCountry()};
  const oc=window.closeHub;window.closeHub=function(p){oc(p);if(!hubSec&&!XP)setTimeout(ovShow,50)};
  watchEmoji();try{const ro=new ResizeObserver(()=>syncMapPad());const hook=()=>{const o=document.getElementById('ovcard');if(o&&!o._ro){o._ro=1;ro.observe(o)}};setInterval(hook,1500);addEventListener('resize',syncMapPad);document.addEventListener('click',()=>setTimeout(syncMapPad,400))}catch(_){}try{if(window.Chart){Chart.defaults.font.family='"Plus Jakarta Sans",Inter,system-ui,sans-serif';Chart.defaults.color='#a9b9c9'}}catch(_){}
  loadExpo().then(()=>{const go=()=>{if(typeof mapReady!=='undefined'&&mapReady)renderOverview();else setTimeout(go,600)};setTimeout(go,1200)})}
/* Lenguaje visual único: sin emojis decorativos en la interfaz (las banderas y los símbolos tipográficos ★ ✓ ↻ se mantienen;
   un emoji que es el único contenido de su elemento, como un icono, tampoco se toca). */
const EP1=/\p{Extended_Pictographic}/u,EPG=/\p{Extended_Pictographic}[️‍]*\s?/gu;
function stripEmoji(root){if(!root||!root.querySelectorAll)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;if(!p||p.closest('script,style,textarea,input,.tk,#svv,.kx-card,.mn-i'))return NodeFilter.FILTER_REJECT;return EP1.test(n.data)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
  const L=[];while(w.nextNode())L.push(w.currentNode);L.forEach(n=>{const t=n.data.replace(EPG,'');if(t.trim()&&t!==n.data)n.data=t})}
let _seq=0;const _eq=new Set();function watchEmoji(){stripEmoji(document.body);const mo=new MutationObserver(ms=>{ms.forEach(m=>{const t=m.target.nodeType===3?m.target.parentElement:m.target;if(t)_eq.add(t)});if(_seq)return;_seq=requestAnimationFrame(()=>{_seq=0;const q=[..._eq];_eq.clear();q.forEach(t=>{if(t.isConnected)stripEmoji(t)})})});mo.observe(document.body,{childList:true,subtree:true,characterData:true})}
window.ATLASI={expOf,betsOf,betsRobust,docScores,lookThrough,overlap,overlapDetail,riskOf,docPortfolio,analyze,analyzeSrc:s=>analyzeSrc(s),renderDoc,renderRadar,renderCompare,showExposureGlobe,hideExposure,openCompare,openRadar,openCountry,loadExpo,renderOverview,get DOC(){return DOC},set DOC(v){DOC=v;saveDoc()}};
/* ======================= OPTIMIZAR · motor de cambios (P0) + propuestas (P1) =======================
   Regla de oro: solo se propone un cambio si se puede demostrar, con los datos de ATLAS, que mejora algo importante de ESTA cartera.
   · No hay «cartera ideal»: se parte de los problemas detectados y de lo que falta.
   · Candidatos del universo de ATLAS elegidos por la CARENCIA que cubren (emergentes, pequeñas empresas, renta fija, regiones…),
     no por rentabilidad. Entre candidatos de la misma carencia, el de menor coste (TER).
   · Cada cambio se simula con el mismo motor (exposición, riesgo, apuestas efectivas, salud) y se puntúa:
       puntuación = Δsalud + 12·Δapuestas (+ riesgo si la prioridad es preservar) − 20·rotación − 1,5·productos nuevos
     Solo se muestra si Δsalud ≥ 2 o Δapuestas ≥ 0,15, y la puntuación ≥ 3. Si nada lo cumple: «No cambiaría nada».
   · Todo es histórico/modelo, no previsión. */
const OPT_PREF=()=>({prio:'bal',noSell:false,noBonds:false,noCommod:false,keepTop:false,...(DOC.opt||{})});
const EU_C=['GB','FR','DE','CH','NL','ES','IT','SE','DK','FI','BE','IE','NO','AT','PT'];
const LEV_RX=/2x|3x|ultra|leverag|apalanc|short|inverse|bear|daily/i;
function tagsOf(e){if(e.k==='s')return['stock'];const x=expOf(e),ac=assetClass(e),n=(e.name+' '+(e.obj.n||'')+' '+(e.obj.full||'')).toLowerCase(),C=x.country||{};
  const em=Object.entries(C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0),us=C.US||0,eu=EU_C.reduce((a,c)=>a+(C[c]||0),0),jp=C.JP||0,t=[];
  if(ac==='Bonos')t.push('bond');else if(ac==='Oro')t.push('gold');
  else{if(/small|russell 2000|smallcap|small-cap|pequeñ/.test(n))t.push('small');if(/\bvalue\b|valor\b/.test(n))t.push('value');
    if(em>=70)t.push('em');else if(eu>=70)t.push('europe');else if(jp>=70)t.push('japan');else if(us<15&&x.ccCover>50)t.push('exus');else if(us>=40&&us<=75&&Object.keys(C).length>15&&!isNarrow(e))t.push('world')}
  return t}
const GAP_TXT={em:'emergentes',small:'pequeñas empresas',bond:'renta fija',gold:'oro',europe:'Europa',japan:'Japón',exus:'fuera de EE. UU.',value:'empresas «value»'};
let _cands=null;function candidates(){if(_cands)return _cands;const E=ents().filter(e=>(e.k==='e'||e.k==='f')&&!e.obj.lev&&!LEV_RX.test(e.name+' '+(e.obj.n||'')));const by={};
  E.forEach(e=>{const tg=tagsOf(e).filter(t=>t!=='world');if(!tg.length)return;const x=expOf(e),ac=assetClass(e);if(ac==='Acciones'&&(isNarrow(e)||x.q.country==='none'))return;const ter=terOf(e);if(ter!=null&&ter>.75)return;
    tg.forEach(t=>{(by[t]=by[t]||[]).push({e,ter:ter??.5})})});
  Object.keys(by).forEach(t=>by[t]=by[t].sort((a,b)=>a.ter-b.ter||String(a.e.tk).localeCompare(String(b.e.tk))).slice(0,3).map(x=>x.e));return _cands=by}
function metOf(A){const {L,R,SC,P}=A,ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]),cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);
  const em=Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0),bond=L.AC.Bonos||0,gold=L.AC.Oro||0;
  return{health:SC.health,bets:SC.bets&&SC.bets.rob?SC.bets.rob.d5:SC.bets?SC.bets.nb:null,S:L.S,C:L.C,topSec:ss[0]||null,topCty:cs[0]||null,top10:SC.top10,top1:SC.top1,top1n:L.comps[0]?L.comps[0].name:null,
    ovl:SC.ovAvg,vol:R?R.vol:null,dd:R?R.dd:null,cagr:R?R.cagr:null,sharpe:R&&R.vol?(R.cagr-(typeof RF==='number'?RF:2))/R.vol:null,ter:L.ter,n:P.length,em,bond,gold,us:L.C.US||0,corr:SC.avgCorr}}
/* simulación rápida (sin la comprobación de 3 años) */
/* opt (opcional, lo usa ATLASI.scenarios): {r3:true} añade la comprobación de 3 años como en analyzePortfolio; {end:'AAAA-MM-DD'} fija el final de la ventana histórica */
async function simP(list,opt){const P=list.filter(x=>x.e&&x.w>1e-4).map(x=>({e:x.e,w:x.w}));const t=P.reduce((a,x)=>a+x.w,0);P.forEach(x=>x.w/=t);const L=lookThrough(P);
  if(!opt){const R=await riskOf(P);const SC=docScores(L,R,P);return{P,L,R,SC}}
  const [R,R3]=await Promise.all([riskOf(P,5,opt.end),opt.r3?riskOf(P,3,opt.end):null]);const SC=docScores(L,R,P,R3||undefined);return{P,L,R,R3,SC}}
const wmap=P=>{const m=new Map();P.forEach(x=>m.set(x.e,(m.get(x.e)||0)+x.w));return m};
function withMoves(P,fn){const m=wmap(P);fn(m);return[...m.entries()].map(([e,w])=>({e,w})).filter(x=>x.w>1e-4)}
const shiftTo=(m,from,amt,to)=>{const a=Math.min(m.get(from)||0,amt);m.set(from,(m.get(from)||0)-a);if(to)m.set(to,(m.get(to)||0)+a);else{const rest=[...m.keys()].filter(k=>k!==from),tw=rest.reduce((s,k)=>s+m.get(k),0);rest.forEach(k=>m.set(k,m.get(k)+a*m.get(k)/tw))}};
const addNew=(m,e,w)=>{for(const k of m.keys())m.set(k,m.get(k)*(1-w));m.set(e,(m.get(e)||0)+w)};
function movesOf(P0,P1){const a=wmap(P0),b=wmap(P1),ks=new Set([...a.keys(),...b.keys()]);return[...ks].map(e=>({e,from:a.get(e)||0,to:b.get(e)||0})).filter(x=>Math.abs(x.to-x.from)>.004).sort((x,y)=>Math.abs(y.to-y.from)-Math.abs(x.to-x.from))}
function scoreOf(m0,m1,P0,P1,pref){const dH=(m1.health??0)-(m0.health??0),dB=(m1.bets??0)-(m0.bets??0),mv=movesOf(P0,P1),turn=mv.reduce((s,x)=>s+Math.abs(x.to-x.from),0)/2,newP=mv.filter(x=>x.from===0).length,gone=mv.filter(x=>x.to===0).length;
  let s=dH+12*dB-20*turn-1.5*newP+.5*gone;if(pref.prio==='preserve')s+=.6*((m0.vol??0)-(m1.vol??0))+.25*((m1.dd??0)-(m0.dd??0));if(pref.prio==='growth')s+=.25*((m1.cagr??0)-(m0.cagr??0));
  return{s,dH,dB,turn,newP,gone,mv,ok:(dH>=2||dB>=.15)&&s>=3}}
/* problemas de la cartera (solo con evidencia) */
function problemsOf(A,m){const out=[],nm=e=>tk(e);
  if(m.topSec&&m.topSec[1]>=35){const by=(A.L.byS[m.topSec[0]]||[]).sort((a,b)=>b.p-a.p).slice(0,3);out.push({id:'sec',sev:m.topSec[1],t:`Concentración en ${m.topSec[0].toLowerCase()}`,ev:`${pct(m.topSec[1],0)} de tu exposición. Viene sobre todo de ${by.map(b=>`${nm(b.e)} ${pct(b.p,0)}`).join(', ')}.`,key:m.topSec[0]})}
  if(m.bets!=null&&A.P.length>=2&&(m.bets<1.3||m.bets<A.P.length*.4))out.push({id:'bets',sev:60-m.bets*10,t:`${A.P.length} productos, ≈ ${fmtB(m.bets)} apuestas independientes`,ev:'Tus productos se han movido casi a la vez: añadir más de lo mismo no diversifica.'});
  if(A.P.length===1)out.push({id:'single',sev:50,t:'Una sola apuesta',ev:`Toda la cartera depende de ${nm(A.P[0].e)}.`});
  if(m.ovl!=null&&m.ovl>=20)out.push({id:'ovl',sev:m.ovl,t:'Solapamiento entre tus ETFs',ev:`Comparten de media ≥ ${pct(m.ovl,0)} de sus empresas principales.`});
  if(m.topCty&&m.topCty[1]>=70)out.push({id:'cty',sev:m.topCty[1]-30,t:`Dependencia de ${CNAME[m.topCty[0]]||m.topCty[0]}`,ev:`${pct(m.topCty[1],0)} de tu exposición (en el índice mundial EE. UU. pesa ~60–65 %).`,key:m.topCty[0]});
  if(m.top1>=8)out.push({id:'comp',sev:m.top1*2,t:`Mucho peso en ${m.top1n}`,ev:`≥ ${pct(m.top1,1)} de tu cartera sumando lo directo y lo que va dentro de tus ETFs.`});
  if(m.ter!=null&&m.ter>.4)out.push({id:'cost',sev:m.ter*60,t:'Costes altos',ev:`TER medio ponderado ${pct(m.ter,2)} al año.`});
  return out.sort((a,b)=>b.sev-a.sev).slice(0,3)}
function gapsOf(A,m,pref){const have=new Set(A.P.flatMap(x=>tagsOf(x.e))),g=[];
  if(m.em<5)g.push({t:'em',why:`Emergentes: ${pct(m.em,0)} de tu cartera (≈ 10 % del índice mundial).`});
  if(m.us>65&&!have.has('europe'))g.push({t:'europe',why:`EE. UU. ${pct(m.us,0)}; Europa apenas está representada.`});
  if(!have.has('small'))g.push({t:'small',why:'Ningún producto de pequeñas empresas: todo son grandes compañías.'});
  if(pref.prio!=='growth'&&!pref.noBonds&&m.bond<5)g.push({t:'bond',why:`Renta fija: ${pct(m.bond,0)} de tu cartera.`});
  if(pref.prio==='preserve'&&!pref.noCommod&&m.gold<3)g.push({t:'gold',why:`Oro: ${pct(m.gold,0)} de tu cartera.`});
  if(m.us>75&&!have.has('exus'))g.push({t:'exus',why:`EE. UU. ${pct(m.us,0)} de tu exposición.`});return g}
/* contribución marginal: ¿qué aporta cada producto a ESTA cartera? (se quita y se reparte en el resto) */
async function marginalOf(A,m0){if(A.P.length<2)return[];const out=[];for(const x of A.P){const P1=withMoves(A.P,mm=>shiftTo(mm,x.e,x.w,null)),S1=await simP(P1),m1=metOf(S1);
    const mine=new Set(expOf(x.e).hold.map(h=>h.key)),others=new Set(A.P.filter(y=>y.e!==x.e).flatMap(y=>expOf(y.e).hold.map(h=>h.key)));const H=expOf(x.e).hold,hw=H.reduce((a,h)=>a+h.w,0),sh=hw?H.filter(h=>others.has(h.key)).reduce((a,h)=>a+h.w,0)/hw*100:null;
    const sec=m0.topSec?m0.topSec[0]:null,ix=A.R?A.R.assets.indexOf(x.e):-1;let cr=null;if(ix>=0){const v=A.R.M[ix].filter((c,j)=>j!==ix&&c!=null);cr=v.length?v.reduce((a,c)=>a+c,0)/v.length:null}
    out.push({e:x.e,w:x.w,bets:(m0.bets??0)-(m1.bets??0),sec:sec?(m0.S[sec]||0)-(m1.S[sec]||0):null,vol:(m0.vol??0)-(m1.vol??0),ter:(m0.ter??0)-(m1.ter??0),dH:(m1.health??0)-(m0.health??0),ovShare:sh,corr:cr,m1})}
  out.forEach(o=>{o.ineff=o.dH>=3&&o.bets<=.05&&((o.ovShare!=null&&o.ovShare>=50)||(o.corr!=null&&o.corr>=.8));o.lbl=o.ineff?'POCO EFICIENTE EN TU CARTERA':o.bets>=.15?'APORTA DIVERSIFICACIÓN':o.ovShare!=null&&o.ovShare>=50?'MUCHO SOLAPAMIENTO':'NEUTRAL'});return out}
let _OPT=new Map();
async function optimize(A){const pref=OPT_PREF(),sig=sigOf(A.P)+JSON.stringify(pref);if(_OPT.has(sig))return _OPT.get(sig);
  const pr=(async()=>{const m0=metOf(A),probs=problemsOf(A,m0),gaps=gapsOf(A,m0,pref),C=candidates();
  const pool=[];gaps.forEach(g=>(C[g.t]||[]).forEach(e=>{if(!A.P.some(x=>x.e===e)&&!pool.some(p=>p.e===e))pool.push({e,gap:g})}));const cand=pool.slice(0,8);
  const big=A.P.slice().sort((a,b)=>b.w-a.w).slice(0,2).map(x=>x.e),locked=e=>pref.keepTop&&big.includes(e);
  const mg=await marginalOf(A,m0);const weak=mg.slice().sort((a,b)=>b.dH-a.dH).filter(o=>!locked(o.e)).slice(0,3).map(o=>o.e);
  const tries=[];const T=(type,P1,meta)=>tries.push({type,P1,...meta});
  cand.forEach(c=>{T('add',withMoves(A.P,m=>addNew(m,c.e,.1)),{to:c.e,gap:c.gap})});
  if(!pref.noSell&&A.P.length>1)weak.forEach(e=>{const w=A.P.find(x=>x.e===e).w;
    T('remove',withMoves(A.P,m=>shiftTo(m,e,w,null)),{from:e});T('reduce',withMoves(A.P,m=>shiftTo(m,e,w/2,null)),{from:e});
    cand.slice(0,5).forEach(c=>{T('swap',withMoves(A.P,m=>shiftTo(m,e,w,c.e)),{from:e,to:c.e,gap:c.gap});T('shift',withMoves(A.P,m=>shiftTo(m,e,Math.min(w/2,.1),c.e)),{from:e,to:c.e,gap:c.gap})})});
  if(!pref.noSell&&A.P.length===1&&cand.length)cand.slice(0,4).forEach(c=>T('shift',withMoves(A.P,m=>shiftTo(m,A.P[0].e,.2,c.e)),{from:A.P[0].e,to:c.e,gap:c.gap}));
  for(const t of tries){const S1=await simP(t.P1);t.S=S1;t.m=metOf(S1);Object.assign(t,scoreOf(m0,t.m,A.P,S1.P,pref))}
  const ranked=tries.filter(t=>t.ok).sort((a,b)=>b.s-a.s);const seen=new Set(),top=[];ranked.forEach(t=>{const k=t.type+(t.from?t.from.t:'')+(t.to?t.to.t:'');const k2=(t.from?t.from.t:'')+'>'+(t.gap?t.gap.t:t.to?t.to.t:'');if(seen.has(k2))return;seen.add(k2);top.push(t)});
  /* opciones A/B/C sobre la mejor dirección */
  let opts=null;const best=top[0];if(best){const f=best.from,to=best.to,w=f?A.P.find(x=>x.e===f).w:0,c2=cand.find(c=>c.e!==to&&(!best.gap||c.gap.t!==best.gap.t));
    const mk=async(lbl,desc,P1)=>{const S1=await simP(P1),m=metOf(S1);return{lbl,desc,S:S1,m,...scoreOf(m0,m,A.P,S1.P,pref)}};
    const v=[],big=Math.min(w,.4);if(f&&to){v.push(await mk('A','Cambio mínimo',withMoves(A.P,m=>shiftTo(m,f,Math.min(w,.1)*.5,to))));v.push(await mk('B','Equilibrada',withMoves(A.P,m=>shiftTo(m,f,Math.min(w,.2,Math.max(.1,w/2)),to))));
        v.push(await mk('C','Transformación',withMoves(A.P,m=>{shiftTo(m,f,big*(c2?.5:1),to);if(c2)shiftTo(m,f,big*.5,c2.e)})))}
    else if(f){v.push(await mk('A','Cambio mínimo',withMoves(A.P,m=>shiftTo(m,f,w*.33,null))));v.push(await mk('B','Equilibrada',withMoves(A.P,m=>shiftTo(m,f,w*.66,null))));v.push(await mk('C','Transformación',withMoves(A.P,m=>{shiftTo(m,f,w,null);if(c2&&!pref.noSell)addNew(m,c2.e,.1)})))}
    else if(to){v.push(await mk('A','Cambio mínimo',withMoves(A.P,m=>addNew(m,to,.05))));v.push(await mk('B','Equilibrada',withMoves(A.P,m=>addNew(m,to,.1))));v.push(await mk('C','Transformación',withMoves(A.P,m=>{addNew(m,to,.1);if(c2)addNew(m,c2.e,.1)})))}
    opts=v.filter((o,i,a)=>a.findIndex(z=>JSON.stringify(z.mv.map(q=>[q.e.t,Math.round(q.to*100)]))===JSON.stringify(o.mv.map(q=>[q.e.t,Math.round(q.to*100)])))===i)}
  const adds=tries.filter(t=>t.type==='add').sort((a,b)=>b.s-a.s).slice(0,3);
  const conf=t=>{const inv=[...new Set([...(t.mv||[]).map(x=>x.e),...A.P.map(x=>x.e)])];const q=inv.map(e=>expOf(e).q);const noPx=inv.some(e=>t.S&&t.S.R&&t.S.R.assets.indexOf(e)<0);
    return noPx||q.some(x=>x.country==='none')?'low':q.some(x=>x.companies!=='real'||x.country==='proxy')?'medium':'high'};
  [...top,...(opts||[]),...adds].forEach(t=>{t.conf=conf(t)});
  return{m0,probs,gaps,cand,mg,top:top.slice(0,10),opts,adds,pref,n:tries.length}})();
  _OPT.set(sig,pr);if(_OPT.size>6)_OPT.delete(_OPT.keys().next().value);return pr}
/* ---------- UI ---------- */
const arrow=(d,good)=>Math.abs(d)<1e-9?'→':(d>0)===good?'↑':'↓';
function cmpRows(m0,m1){const r=(l,a,b,f,better,unit)=>{const d=(b??0)-(a??0),flat=a==null||b==null||Math.abs(d)<(unit||.05);return`<tr><th>${l}</th><td>${a==null?'n/d':f(a)}</td><td>${b==null?'n/d':f(b)}</td><td class="${flat?'eq':better==null?'eq':((d>0)===better?'bt':'wr')}">${flat?'→ igual':better==null?(d>0?'↑':'↓'):((d>0)===better?'↑ mejora':'↓ empeora')}</td></tr>`};
  const sec=m0.topSec?m0.topSec[0]:null,cc=m0.topCty?m0.topCty[0]:null;
  return [r('Salud',m0.health,m1.health,v=>Math.round(v),true,1),r('Apuestas independientes',m0.bets,m1.bets,v=>fmtB(v),true,.05),r('Volatilidad (hist.)',m0.vol,m1.vol,v=>pct(v,1),false,.2),r('Caída máxima (hist.)',m0.dd,m1.dd,v=>pct(v,0),true,.5),r('Sharpe (hist.)',m0.sharpe,m1.sharpe,v=>num(v,2),true,.02),
    sec?r(sec,m0.S[sec]||0,m1.S[sec]||0,v=>pct(v,0),false,.5):'',cc?r(CNAME[cc]||cc,m0.C[cc]||0,m1.C[cc]||0,v=>pct(v,0),false,.5):'',r('Emergentes',m0.em,m1.em,v=>pct(v,0),null,.5),r('Mayor empresa',m0.top1,m1.top1,v=>'≥ '+pct(v,1),false,.2),r('10 mayores empresas',m0.top10,m1.top10,v=>'≥ '+pct(v,0),false,.5),
    r('Solapamiento medio',m0.ovl,m1.ovl,v=>'≥ '+pct(v,0),false,.5),r('Coste (TER)',m0.ter,m1.ter,v=>pct(v,2),false,.005),r('Productos',m0.n,m1.n,v=>String(v),null,.5)].join('')}
function gainsLosses(m0,m1,t){const g=[],l=[],sec=m0.topSec?m0.topSec[0]:null,cc=m0.topCty?m0.topCty[0]:null;
  if((m1.bets??0)-(m0.bets??0)>=.05)g.push(`Más diversificación real: ${fmtB(m0.bets)} → ${fmtB(m1.bets)} apuestas independientes`);else if((m0.bets??0)-(m1.bets??0)>=.05)l.push(`Algo menos de diversificación real (${fmtB(m0.bets)} → ${fmtB(m1.bets)})`);
  if(sec){const d=(m1.S[sec]||0)-(m0.S[sec]||0);if(d<=-2){g.push(`Menos concentración en ${sec.toLowerCase()} (${pct(m0.S[sec],0)} → ${pct(m1.S[sec],0)})`);l.push(`Menos exposición a ${sec.toLowerCase()}: si sigue haciéndolo mejor que el mercado, la cartera lo aprovechará menos`)}}
  if(cc){const d=(m1.C[cc]||0)-(m0.C[cc]||0);if(d<=-2)g.push(`Menos dependencia de ${CNAME[cc]||cc} (${pct(m0.C[cc],0)} → ${pct(m1.C[cc],0)})`)}
  if(m0.vol!=null&&m1.vol!=null){if(m1.vol<m0.vol-.3)g.push(`Menor volatilidad histórica (${pct(m0.vol,1)} → ${pct(m1.vol,1)})`);else if(m1.vol>m0.vol+.3)l.push(`Más volatilidad histórica (${pct(m0.vol,1)} → ${pct(m1.vol,1)})`)}
  if(m0.dd!=null&&m1.dd!=null&&m1.dd>m0.dd+1)g.push(`Caída máxima histórica más suave (${pct(m0.dd,0)} → ${pct(m1.dd,0)})`);
  if(m0.cagr!=null&&m1.cagr!=null&&m1.cagr<m0.cagr-.3)l.push(`Rentabilidad histórica de 5 años algo menor (${pct(m0.cagr,1)} → ${pct(m1.cagr,1)}/año). Es pasado, no previsión`);
  if(m0.ter!=null&&m1.ter!=null){if(m1.ter<m0.ter-.005)g.push(`Coste menor (TER ${pct(m0.ter,2)} → ${pct(m1.ter,2)})`);else if(m1.ter>m0.ter+.005)l.push(`Coste algo mayor (TER ${pct(m0.ter,2)} → ${pct(m1.ter,2)})`)}
  const RISK={em:'Riesgo político y de divisa de los mercados emergentes',small:'Las pequeñas empresas oscilan más y sufren más en recesiones',bond:'Riesgo de tipos de interés: la renta fija cae cuando suben los tipos',gold:'El oro no genera rentas y puede pasar años sin subir',europe:'Más exposición al euro y a la economía europea',japan:'Riesgo de divisa (yen)',exus:'Más riesgo de divisa',value:'Puede quedarse atrás en mercados dominados por el crecimiento'};
  const nw=(t.mv||[]).filter(x=>x.from===0).map(x=>tagsOf(x.e).map(q=>RISK[q]).filter(Boolean)[0]).filter(Boolean);
  return{g,l,risk:nw}}
const CONF_O={high:['ALTA','Precios reales de 5 años y composición publicada completa por países y sectores.'],medium:['MEDIA','Algún producto solo publica sus 10 mayores posiciones o usa un índice equivalente: la exposición indirecta es parcial.'],low:['BAJA','Falta composición o historial de precios de algún producto.']};
function moveTxt(mv){return mv.map(x=>`<li><span class="om-tk">${tk(x.e)}</span><span class="om-nm">${esc(x.e.name)}</span><b>${x.from?pct(x.from*100,0):'—'} → ${x.to?pct(x.to*100,0):'fuera'}</b></li>`).join('')}
function propTitle(t){const f=t.from,to=t.to;return t.type==='add'?`Añadir ${tk(to)} (${GAP_TXT[t.gap.t]||''})`:t.type==='remove'?`Quitar ${tk(f)}`:t.type==='reduce'?`Reducir ${tk(f)}`:t.type==='swap'?`Sustituir ${tk(f)} por ${tk(to)}`:`Pasar parte de ${tk(f)} a ${tk(to)}`}
function whyOf(t,R,mg){const out=[],f=t.from?mg.find(o=>o.e===t.from):null;
  if(f){if(f.ovShare!=null)out.push(`<b>Solapamiento:</b> ${pct(f.ovShare,0)} de las principales posiciones de ${tk(f.e)} ya están en tus otros productos.`);
    if(f.corr!=null)out.push(`<b>Se mueve como el resto:</b> correlación semanal media ${f.corr.toFixed(2).replace('.',',')} con tus otros productos (5 años).`);
    out.push(`<b>Aporta poca diversificación:</b> quitándolo, tus apuestas independientes ${f.bets>=0?'bajarían':'subirían'} solo ${fmtB(Math.abs(f.bets))}.`);
    if(f.sec!=null&&f.sec>=1)out.push(`<b>Concentración:</b> sube ${pct(f.sec,0)} el peso de tu sector principal.`)}
  if(t.gap)out.push(`<b>Carencia que cubre ${tk(t.to)}:</b> ${esc(t.gap.why)}`);
  return out}
function propCard(t,A,i,mg,head){const m0=A?metOf(A):null;const gl=gainsLosses(m0,t.m,t),[cl,cd]=CONF_O[t.conf||'medium'];
  return `<article class="op-c" data-pi="${i}"><header><span class="op-n">${head||'PROPUESTA '+String(i+1).padStart(2,'0')}</span><h4>${esc(propTitle(t))}</h4><ul class="op-mv">${moveTxt(t.mv)}</ul></header>
    <div class="op-k"><div><span>Salud</span><b>${Math.round(m0.health)} → ${Math.round(t.m.health)}</b></div><div><span>Apuestas</span><b>${fmtB(m0.bets)} → ${fmtB(t.m.bets)}</b></div>${m0.topSec?`<div><span>${esc(m0.topSec[0])}</span><b>${pct(m0.S[m0.topSec[0]]||0,0)} → ${pct(t.m.S[m0.topSec[0]]||0,0)}</b></div>`:''}</div>
    <details class="op-d"><summary>Por qué, qué ganas y qué pierdes</summary>
      <p class="op-h">Por qué</p><ul>${whyOf(t,A.R,mg).map(x=>`<li>${x}</li>`).join('')||'<li>Mejora la salud y la diversificación de la cartera con el modelo actual.</li>'}</ul>
      <p class="op-h">Qué ganas</p><ul>${gl.g.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Mejoras pequeñas en varios factores.</li>'}</ul>
      <p class="op-h">Qué pierdes</p><ul>${gl.l.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nada relevante según los datos.</li>'}</ul>
      ${gl.risk.length?`<p class="op-h">Riesgo nuevo</p><ul>${gl.risk.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
      <p class="op-h">Confianza: ${cl}</p><p class="op-cf">${cd} Precios: dato · correlaciones e impacto: estimación histórica (5 años) · no es una previsión.</p></details>
    <div class="ix-btns"><button class="btn sm" data-sim="${i}">Simular cambio</button><button class="btn2 sm" data-dec="${i}:later">Lo estudiaré</button><button class="lnk" data-dec="${i}:ignore">Ignorar</button></div><div class="op-sim" hidden></div></article>`}
function logDecision(t,action){try{const L=JSON.parse(localStorage.getItem('atlas_decisions')||'[]');L.push({d:new Date().toISOString().slice(0,10),t:propTitle(t),mv:t.mv.map(x=>[x.e.k+':'+x.e.t,+x.from.toFixed(3),+x.to.toFixed(3)]),action});localStorage.setItem('atlas_decisions',JSON.stringify(L.slice(-50)))}catch(_){}}
function prefBar(p){const c=(k,l)=>`<button data-pf="${k}" aria-pressed="${!!p[k]}">${l}</button>`;
  return `<details class="op-pref"><summary>Preferencias · ${({growth:'Crecimiento',bal:'Equilibrio',preserve:'Preservación'})[p.prio]}${['noSell','noBonds','noCommod','keepTop'].filter(k=>p[k]).length?' · con restricciones':''}</summary>
    <div class="ix-seg2">${[['growth','Crecimiento'],['bal','Equilibrio'],['preserve','Preservación']].map(([k,l])=>`<button data-prio="${k}" aria-selected="${p.prio===k}">${l}</button>`).join('')}</div>
    <div class="op-tg">${c('noSell','No vender')}${c('noBonds','Sin bonos')}${c('noCommod','Sin materias primas')}${c('keepTop','Mantener mis 2 mayores posiciones')}</div>
    <p class="mp-note">Se guardan en este dispositivo. No hay campo de «horizonte»: el modelo no hace previsiones, así que no cambiaría ningún resultado.</p></details>`}
function tabOpt(){return `<div id="ixOpt"><div class="sk"><p>ATLAS está probando cambios sobre tu cartera…</p><i></i><i></i><i></i></div></div>`}
async function renderOpt(A){const box=$('#ixOpt');if(!box)return;const O=await optimize(A);if(!$('#ixOpt'))return;const m0=O.m0,pref=O.pref;
  const main=O.probs[0],N=O.top.length;
  let h=prefBar(pref);
  h+=`<section class="op-s"><div class="ix-k">Diagnóstico</div>${O.probs.length?`<p class="op-lead">El principal problema de tu cartera ${main.id==='bets'||main.id==='sec'?'no es el número de productos: es':'es'} <b>${esc(main.t.toLowerCase())}</b>. ${esc(main.ev)}</p><ul class="op-pr">${O.probs.slice(1).map(p=>`<li><b>${esc(p.t)}</b> · ${esc(p.ev)}</li>`).join('')}</ul>`:'<p class="op-lead">ATLAS no detecta problemas importantes con los umbrales actuales.</p>'}</section>`;
  if(!N){h+=`<section class="op-none"><p class="op-n">ATLAS NO RECOMIENDA CAMBIOS</p><ul>${[['bets',m0.bets>=1.5||A.P.length===1?null:'Diversificación real razonable'],['ovl',m0.ovl==null||m0.ovl<20?'Solapamiento razonable':null],['ter',m0.ter!=null&&m0.ter<=.4?'Costes bajos':null],['cty',m0.topCty&&m0.topCty[1]<70?'Exposición geográfica amplia':null],['sec',m0.topSec&&m0.topSec[1]<35?'Sin un sector dominante':null]].filter(x=>x[1]).map(x=>`<li>✓ ${x[1]}</li>`).join('')}</ul><p>Se han probado ${O.n} cambios (reducir, quitar, sustituir y añadir productos que cubren lo que falta). Ninguno mejora lo suficiente como para justificar cambiar tu cartera.</p><p class="op-best">Mejor acción: <b>mantener</b>.</p></section>`}
  else{h+=`<section class="op-s"><div class="ix-k">ATLAS ha encontrado ${N} cambio${N>1?'s':''} que mejoran tu cartera</div>`;
    if(O.opts&&O.opts.length>1)h+=`<p class="op-sub">Tres formas de resolver lo principal, de menos a más cambio:</p><div class="op-abc">${O.opts.map((o,i)=>`<button class="op-o${i===1?' on':''}" data-opt="${i}"><b>${o.lbl} · ${esc(o.desc)}</b><ul>${o.mv.slice(0,3).map(x=>`<li>${tk(x.e)} ${x.from?pct(x.from*100,0):'—'} → ${x.to?pct(x.to*100,0):'fuera'}</li>`).join('')}</ul><span>Salud ${Math.round(m0.health)} → <b>${Math.round(o.m.health)}</b> · apuestas ${fmtB(m0.bets)} → <b>${fmtB(o.m.bets)}</b></span></button>`).join('')}</div><div id="opOptSim" class="op-sim"></div>`;
    h+=O.top.slice(0,3).map((t,i)=>propCard(t,A,i,O.mg,i===0?'MEJOR OPORTUNIDAD':i===1?'ALTERNATIVA':'OTRA OPCIÓN')).join('');
    if(N>3)h+=`<details class="op-more"><summary>Mostrar ${N-3} cambio${N-3>1?'s':''} adicional${N-3>1?'es':''}</summary>${O.top.slice(3).map((t,i)=>propCard(t,A,i+3,O.mg)).join('')}</details>`;h+='</section>'}
  /* ¿qué quitaría? */
  if(O.mg.length){const w=O.mg.filter(o=>o.ineff).sort((a,b)=>b.dH-a.dH)[0];
    h+=`<section class="op-s"><div class="ix-k">¿Qué quitaría ATLAS?</div>${w?`<div class="op-q"><p><b>${tk(w.e)} · ${esc(w.e.name)}</b> es tu posición menos eficiente ahora mismo.</p><p class="op-quote">No es un mal producto. Es un producto poco eficiente dentro de esta cartera.</p><ul>${w.ovShare!=null?`<li>${pct(w.ovShare,0)} de sus principales posiciones ya están en tus otros productos.</li>`:''}<li>Aporta ${fmtB(Math.max(0,w.bets))} apuestas independientes.</li>${w.sec!=null&&w.sec>=1?`<li>Sube ${pct(w.sec,0)} el peso de ${esc(m0.topSec[0].toLowerCase())}.</li>`:''}</ul><p>Si lo quitas (y repartes en el resto): salud ${Math.round(m0.health)} → <b>${Math.round(w.m1.health)}</b> · apuestas ${fmtB(m0.bets)} → <b>${fmtB(w.m1.bets)}</b>.</p></div>`:'<p class="op-sub">Ninguna posición resta claramente: no quitaría nada.</p>'}
      <details class="op-mg"><summary>Qué aporta cada producto (contribución marginal)</summary><div class="alt-tw"><table class="alt-t"><thead><tr><th>Producto</th><th>Peso</th><th>Apuestas</th><th>${m0.topSec?esc(m0.topSec[0]):'Sector'}</th><th>Volat.</th><th>Solapa</th></tr></thead><tbody>${O.mg.map(o=>`<tr><th>${tk(o.e)}<small class="mg-l ${o.ineff?'bad':''}">${o.lbl}</small></th><td>${pct(o.w*100,0)}</td><td>${o.bets>=0?'+':'−'}${num(Math.abs(o.bets),2)}</td><td>${o.sec==null?'—':(o.sec>=0?'+':'−')+pct(Math.abs(o.sec),0)}</td><td>${o.vol>=0?'+':'−'}${pct(Math.abs(o.vol),1)}</td><td>${o.ovShare==null?'n/d':pct(o.ovShare,0)}</td></tr>`).join('')}</tbody></table></div><p class="mp-note">Cuánto cambia la cartera por tener cada producto (se compara con quitarlo y repartir su peso en el resto). «Solapa» = parte de sus principales posiciones que ya está en tus otros productos.</p></details></section>`}
  /* ¿qué añadir? */
  if(O.adds.length){h+=`<section class="op-s"><div class="ix-k">Si añadieras un 10 % nuevo, ¿qué aportaría más?</div><ol class="op-add">${O.adds.map(t=>`<li><b>${tk(t.to)} · ${esc(t.to.name)}</b><span>Cubre: ${esc(GAP_TXT[t.gap.t]||'')} · apuestas ${fmtB(m0.bets)} → ${fmtB(t.m.bets)} · salud ${Math.round(m0.health)} → ${Math.round(t.m.health)}${m0.topCty?` · ${esc(CNAME[m0.topCty[0]]||m0.topCty[0])} ${pct(m0.C[m0.topCty[0]],0)} → ${pct(t.m.C[m0.topCty[0]]||0,0)}`:''}</span></li>`).join('')}</ol><p class="mp-note">Ordenados por el problema que resuelven en tu cartera, no por rentabilidad. Dentro de cada carencia, el de menor coste.</p></section>`}
  h+=`<p class="ix-src2">Cómo funciona: ATLAS prueba ${O.n} cambios concretos sobre tu cartera con su propio motor (exposición, riesgo, apuestas efectivas y salud) y solo muestra los que mejoran algo importante de forma demostrable. Los impactos son estimaciones con datos históricos, no previsiones. Es un análisis, no una recomendación de inversión personalizada.</p>`;
  box.innerHTML=h;
  const sims=[...O.top];box.querySelectorAll('[data-sim]').forEach(b=>b.onclick=()=>{const t=sims[+b.dataset.sim],d=b.closest('.op-c').querySelector('.op-sim');d.hidden=!d.hidden;if(!d.hidden)d.innerHTML=simTable(m0,t.m)});
  box.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{const [i,a]=b.dataset.dec.split(':');logDecision(sims[+i],a);b.closest('.op-c').classList.add('op-dim');toast(a==='ignore'?'Propuesta ignorada':'Guardada para estudiarla')});
  const os=box.querySelector('#opOptSim');const showO=i=>{box.querySelectorAll('[data-opt]').forEach(x=>x.classList.toggle('on',+x.dataset.opt===i));if(os&&O.opts[i])os.innerHTML=simTable(m0,O.opts[i].m)};box.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>showO(+b.dataset.opt));if(O.opts&&O.opts.length>1)showO(1);
  box.querySelectorAll('[data-prio]').forEach(b=>b.onclick=()=>{DOC.opt={...OPT_PREF(),prio:b.dataset.prio};saveDoc();renderOptAgain(A)});
  box.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{const p=OPT_PREF();p[b.dataset.pf]=!p[b.dataset.pf];DOC.opt=p;saveDoc();renderOptAgain(A)})}
function renderOptAgain(A){const b=$('#ixOpt');if(b)b.innerHTML='<div class="sk"><p>Recalculando con tus preferencias…</p><i></i><i></i></div>';renderOpt(A).then(()=>{const d=$('#ixOpt .op-pref');if(d)d.open=true})}
function simTable(m0,m1){return `<div class="alt-tw"><table class="alt-t op-t"><thead><tr><th></th><th>Actual</th><th>Propuesta</th><th></th></tr></thead><tbody>${cmpRows(m0,m1)}</tbody></table></div><p class="mp-note">Estimación con datos históricos de 5 años y la composición publicada. No es una previsión de rentabilidad.</p>`}

/* ======================= CAPA COMPARTIDA · ATLASI.* =======================
   Nombres estables sobre los cálculos que ya existen (no los cambia). Todas las pantallas nuevas deben usar esto.
   Cada resultado lleva su estado de dato: 'real' (dato publicado/precio), 'est' (estimación), 'model' (supuesto), 'inc' (incompleto). */
const QUALITY={real:'Dato',est:'Estimación',model:'Modelo',inc:'Incompleto'};
const getPortfolio=src=>analyzeSrc(src||(PF.length?'pf':'custom'));
async function analyzePortfolio(list){await loadExpo();const P=list.map(x=>({e:x.e,w:x.w})).filter(x=>x.e&&x.w>0);const t=P.reduce((a,x)=>a+x.w,0);P.forEach(x=>x.w/=t);if(!P.length)return{empty:true};
  const L=lookThrough(P),[R,R3]=await Promise.all([riskOf(P),riskOf(P,3)]),SC=docScores(L,R,P,R3);const A={P,L,R,R3,SC,name:'Simulación',src:{src:'sim'}};A.D=diagnose(A);return A}
function getCompanyExposure(A,key){const c=A.L.comps.find(x=>x.key===key||x.tk===key||x.name===key);if(!c)return null;
  return{key:c.key,name:c.name,tk:c.tk,min:c.w,max:c.up,direct:c.dir,indirect:c.w-c.dir,exact:c.exact,quality:c.exact?'real':c.up==null?'inc':'est',
    via:c.by.map(b=>({e:b.e,w:b.w,direct:b.e.k==='s'})),products:c.by.length,of:A.P.length,sector:c.sec,country:c.cc}}
const getSectorExposure=A=>({by:A.L.S,unknown:A.L.S[UNK]||0,quality:A.L.cover>90?'real':'inc'});
const getCountryExposure=A=>({by:A.L.C,unknown:A.L.C.XX||0,quality:A.L.ccCover>90?'real':A.L.ccCover>50?'est':'inc'});
const getEffectiveBets=A=>A.SC.bets&&A.SC.bets.rob?{...A.SC.bets.rob,groups:A.SC.bets.groups,quality:'model'}:null;
const getPortfolioHealth=A=>({score:A.SC.health,label:hLabel(A.SC.health)[0],dims:DIMS.map(([id,t,q,keys])=>({id,label:t,question:q,score:dimOf(A.SC,keys),factors:keys})),factors:A.SC.S,evidence:A.SC.ev,missing:A.SC.miss,insights:A.D});

/* --- ¿Por qué se ha movido mi cartera hoy? ---
   Directo (DATO): movimiento en euros de cada producto desde el cierre anterior (precio de Yahoo cada 15 min + divisa), ponderado por su peso de ayer.
     Suma exactamente el movimiento de la cartera con esos pesos.
   Indirecto (ESTIMACIÓN): empresa × su peso conocido en tu cartera (directo + dentro de ETFs, solo posiciones publicadas → mínimo).
     Es una atribución dentro del movimiento de los ETFs, NO se suma a él. */
async function dayMove(e){try{const s=await eurSeries(e.k,e.obj);if(!s||s.length<2)return null;const n=s.length,a=s[n-1],b=s[n-2];if(!(a[1]>0&&b[1]>0))return null;
  const q=typeof LIVE!=='undefined'&&LIVE&&LIVE.d&&LIVE.d[priceKey(e.k,e.obj)],qd=q?new Date(q[2]*1000):null,live=!!(qd&&qd.toISOString().slice(0,10)===a[0]);
  return{r:a[1]/b[1]-1,date:a[0],prev:b[0],live,ts:live?qd.getTime():null}}catch(_){return null}}
const _CT=new Map();
async function getPortfolioContribution(A){const sig=(A.src&&A.src.src)+sigOf(A.P)+(typeof LIVE!=='undefined'&&LIVE?LIVE.u:'');if(_CT.has(sig))return _CT.get(sig);
  const pr=(async()=>{try{if(typeof LIVE==='undefined'||!LIVE)await ((typeof _liveP!=='undefined'&&_liveP)||loadLiveQ())}catch(_){}
  const items=await Promise.all(A.P.map(async x=>({e:x.e,w:x.w,m:await dayMove(x.e)})));
  const session=items.filter(i=>i.m).map(i=>i.m.date).sort().pop()||null;if(!session)return null;
  items.forEach(i=>{i.today=!!(i.m&&i.m.date===session);i.r=i.today?i.m.r:0});
  const w0=items.map(i=>i.w/(1+i.r)),sw=w0.reduce((a,v)=>a+v,0);items.forEach((i,k)=>{i.c=w0[k]*i.r/sw;i.quality='real'});
  const R=items.reduce((a,i)=>a+i.c,0),V=A.src&&A.src.src==='pf'&&A.src.val?A.src.val:null,eur=V?{now:V,prev:V/(1+R),d:V-V/(1+R)}:null;if(eur)items.forEach(i=>{i.eur=i.c*eur.prev});
  const covered=items.filter(i=>i.today).reduce((a,i)=>a+i.w,0),missing=items.filter(i=>!i.today);
  /* empresas por dentro: solo las de mayor peso que tienen precio propio en ATLAS */
  const E=ents(),cand=A.L.comps.slice(0,15).map(c=>({c,se:E.find(x=>x.k==='s'&&(x.t===c.tk||String(x.tk)===c.tk))})).filter(o=>o.se);
  const cm=await Promise.all(cand.map(async o=>({...o,m:await dayMove(o.se)})));
  const ind=cm.filter(o=>o.m&&o.m.date===session).map(o=>{const wmin=o.c.w/100,wmax=o.c.up!=null?o.c.up/100:null,r=o.m.r;const est=wmin*r,estMax=wmax!=null?wmax*r:null;
      return{key:o.c.key,name:o.c.name,tk:o.se.tk,r,wmin,wmax,exact:o.c.exact,est,estMax,share:Math.abs(R)>=.0005&&Math.sign(est)===Math.sign(R)?est/R:null,
        products:o.c.by.length,via:o.c.by.map(b=>b.e),direct:o.c.dir/100,quality:'est'}}).sort((a,b)=>Math.abs(b.est)-Math.abs(a.est));
  const liveTs=items.map(i=>i.m&&i.m.ts).filter(Boolean),ts=liveTs.length?Math.max(...liveTs):null,today=new Date().toISOString().slice(0,10);
  const age=ts?(Date.now()-ts)/6e4:null,status=session<today?'close':ts&&age<=40?'live':ts?'delayed':'close';
  return{session,today,status,ts,R,eur,items:items.slice().sort((a,b)=>Math.abs(b.c)-Math.abs(a.c)),ind,covered,missing,quality:'real',
    src:'Yahoo Finance (cotización cada 15 min con mercado abierto) · divisas incluidas',method:'Rentabilidad en euros desde el cierre anterior × peso de ayer'}})();
  _CT.set(sig,pr);if(_CT.size>8)_CT.delete(_CT.keys().next().value);return pr}
/* ======================= P1 · ATLASI.portfolio (Hoy) =======================
   Capa sobre getPortfolioContribution: no recalcula nada. Añade el estado de los datos (en directo / retrasado / cerrado / SIN ACTUALIZAR)
   y el impacto de una empresa con su calidad: DATO si la exposición es exacta (acción directa o ETF con cartera completa), ESTIMACIÓN con cota inferior si no. */
function dataState(T,now){now=now||Date.now();const u=typeof LIVE!=='undefined'&&LIVE&&LIVE.u?Date.parse(LIVE.u):null,age=u?(now-u)/6e4:null,d=new Date(now),wd=d.getUTCDay(),h=d.getUTCHours();
  const mkt=wd>=1&&wd<=5&&h>=8&&h<21;   // horario en que el flujo de cotizaciones (cada 15 min) debería estar actualizando
  let state=T?T.status:'none';if(T&&mkt&&age!=null&&age>120)state='stale';
  return{state,ageMin:age==null?null:Math.round(age),updated:typeof LIVE!=='undefined'&&LIVE?LIVE.u||null:null,marketHours:mkt}}
async function pContribution(A,now){if(!A||A.empty||!A.P||!A.P.length)return null;const T=await getPortfolioContribution(A);if(!T)return null;return{...T,data:dataState(T,now)}}
function pImpact(A,T,key){if(!A||!T)return null;const o=T.ind.find(x=>x.key===key),c=A.L.comps.find(x=>x.key===key);if(!c)return null;const N=A.P.length;
  const wmin=c.w/100,wmax=c.up!=null?c.up/100:null,direct=c.dir/100;
  return{key,name:c.name,r:o?o.r:null,products:c.by.length,of:N,direct,indirect:Math.max(0,wmin-direct),wmin,wmax,exact:!!c.exact,est:o?o.est:null,estMax:o?o.estMax:null,share:o?o.share:null,
    quality:c.exact?'DATA':'ESTIMATE',bound:c.exact?null:'lower',label:c.exact?'Exposición exacta':'Exposición mínima garantizada (posiciones conocidas)'}}
const TRK='atlas_ev';
/* instrumentación LOCAL: solo nombres de evento y tipo de escenario; nada de importes ni de la cartera; nunca sale del dispositivo */
function track(ev,sub){try{const o=JSON.parse(localStorage.getItem(TRK)||'{}');o.c=o.c||{};o.c[ev]=(o.c[ev]||0)+1;if(sub){o.t=o.t||{};o.t[sub]=(o.t[sub]||0)+1}
  if(ev==='today_open'&&o.ls&&Date.now()-o.ls<6*36e5)o.c.today_return=(o.c.today_return||0)+1;if(ev==='scenario_open')o.ls=Date.now();o.since=o.since||new Date().toISOString().slice(0,10);localStorage.setItem(TRK,JSON.stringify(o))}catch(_){}}
function usage(){try{return JSON.parse(localStorage.getItem(TRK)||'{}')}catch(_){return{}}}

/* ======================= P1 · EXPLORAR CAMBIOS =======================
   Doctor detecta → ATLAS muestra posibilidades (ATLASI.scenarios.ideas) → el usuario elige → simulate → compara → lectura (narrate) → explain.
   La interfaz no calcula: solo pinta lo que devuelve el motor. Sin puntuación, sin ganador, sin orden de preferencia. */
const XC={res:null,title:'',hist:[],tag:null,crit:null,list:null,alt:null,q:'',ctx:null,ctxSig:''};
const XQ={DATA:['real','Dato'],ESTIMATE:['est','Estimación'],MODEL:['model','Modelo'],INCOMPLETE:['inc','Incompleto']};
const xq=q=>{const v=XQ[q]||XQ.MODEL;return `<span class="q ${v[0]}">${v[1]}</span>`};
function xv(r,x){if(x==null)return '—';if(r.unit==='%')return (r.bound==='lower'?'≥ ':'')+pct(x,r.id==='ter'?2:1);if(r.id==='bets')return num(x,2);return num(x,0)}
function xd(r){if(r.delta==null)return '—';const d=r.delta,s=d>0?'+':d<0?'−':'',a=Math.abs(d);return s+(r.unit==='%'?num(a,r.id==='ter'?2:1)+' pp':r.id==='bets'?num(a,2):num(a,0))}
async function xcCtx(A){const sig=sigOf(A.P);if(XC.ctxSig===sig&&XC.ctx)return XC.ctx;let c={mode:'weights'};
  if(A.src&&A.src.src==='pf'){try{const x=await ATLASI.scenarios.ctxFromPortfolio();if(x&&x.mode==='amounts')c={mode:'amounts',values:x.values,inv:x.inv}}catch(_){}}XC.ctx=c;XC.ctxSig=sig;return c}
function xcGroup(g,gi){const head=`<div class="xc-gt">${esc(g.title)}</div><p class="xc-w">${esc(g.why)}</p>`;
  if(g.rows)return `<div class="xc-g">${head}<div class="xc-rows">${g.rows.map((r,ri)=>`<div class="xc-r"><span class="xc-t"><b>${esc(r.label)}</b><small>${esc(r.info)}</small></span><span class="xc-ops">${r.ops.map((o,oi)=>`<button class="xc-op" data-xs="${gi}:${ri}:${oi}">${esc(o.label)}</button>`).join('')}</span></div>`).join('')||'<p class="xc-w">Ningún producto aporta lo suficiente a esta exposición.</p>'}</div></div>`;
  if(g.alts)return `<div class="xc-g">${head}<div class="xc-rows">${g.alts.map((a,ai)=>`<div class="xc-r"><span class="xc-t"><b>${esc(a.label)}</b><small>${esc(a.info)}</small></span><span class="xc-ops"><button class="xc-op" data-xalt="${ai}" aria-pressed="${XC.alt===a.id}">Ver alternativas</button></span></div>`).join('')}</div><div id="xcAltBox"></div></div>`;
  if(g.explore)return `<div class="xc-g">${head}<div class="xc-chips">${g.explore.tags.map(t=>`<button data-xtag="${t.tag}" aria-pressed="${XC.tag===t.tag}">${esc(t.label)}</button>`).join('')}</div><div id="xcAddBox"></div></div>`;return ''}
function tabExplore(A){const S=ATLASI.scenarios,probs=S.fromDoctor(A),cur=DOC.xc||null;
  let sel=cur?probs.find(p=>p.kind===cur.kind&&JSON.stringify(p.ref)===JSON.stringify(cur.ref))||null:null;
  if(cur&&!sel&&cur.kind){/* punto de partida elegido fuera del Doctor (Analizar / Hoy): se muestra como uno más, con su entityId */sel={kind:cur.kind,ref:cur.ref,id:cur.id||null,title:cur.title||(cur.kind==='comp'?`Exposición a ${ATLASI.assets.nameOf(cur.id||ATLASI.assets.companyId(cur.ref))}`:'Punto de partida'),metric:null};probs.unshift(sel)}const I=S.ideas(A,sel);XC.I=I;XC.probs=probs;
  return `<section class="xc"><div class="xc-hd"><p>${esc(I.head)}</p></div>
    <form class="xc-q" id="xcQ" autocomplete="off"><input id="xcIn" enterkeyhint="go" placeholder="¿Qué pasa si… reduzco QQQ al 15 %?" value="${esc(XC.q)}" aria-label="¿Qué pasa si…?"><button class="btn sm" type="submit">Simular</button></form><div id="xcAsk" class="xc-ask"></div>
    <div class="xc-k">Punto de partida</div><div class="xc-pb" role="list">${[{kind:null,title:S.TXT.iAll}].concat(probs).map((p,i)=>`<button data-xp="${i}" aria-pressed="${p.kind?sel===p:!sel}">${esc(p.title)}${p.metric?`<em>${esc(p.metric)}</em>`:''}</button>`).join('')}</div>
    <div class="xc-gs">${I.groups.map((g,gi)=>xcGroup(g,gi)).join('')}
    <div class="xc-g"><div class="xc-gt">${esc(I.keep.label)}</div><p class="xc-w">${esc(I.keep.why)}</p><div class="xc-rows"><div class="xc-r"><span class="xc-t"><b>Cartera actual</b><small>Métricas sin modificar</small></span><span class="xc-ops"><button class="xc-op" data-xk="1">Ver</button></span></div></div></div></div>
    <div id="xcHist" class="xc-hist"></div><div id="xcRes" class="xc-res" aria-live="polite"></div>
    <p class="ix-src2">Escenarios calculados con los datos de ATLAS (composición publicada y precios de 5 años). Herramienta de análisis y simulación: no es una recomendación de inversión.</p></section>`}
function renderExplore(A){const S=ATLASI.scenarios,root=$('#ixdocOut');if(!root)return;track('explore_open');
  root.querySelectorAll('[data-xp]').forEach(b=>b.onclick=()=>{const i=+b.dataset.xp;const p=i?XC.probs[i-1]:null;DOC.xc=p?{kind:p.kind,ref:p.ref}:null;saveDoc();XC.tag=null;XC.alt=null;drawTab()});
  root.querySelectorAll('[data-xs]').forEach(b=>b.onclick=()=>{const [g,r,o]=b.dataset.xs.split(':').map(Number);const op=XC.I.groups[g].rows[r].ops[o];xcRun(A,op.scenario)});
  root.querySelectorAll('[data-xk]').forEach(b=>b.onclick=()=>xcRun(A,XC.I.keep.scenario));
  root.querySelectorAll('[data-xtag]').forEach(b=>b.onclick=()=>{XC.tag=XC.tag===b.dataset.xtag?null:b.dataset.xtag;XC.crit=null;root.querySelectorAll('[data-xtag]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.xtag===XC.tag));xcAdd(A)});
  const ag=XC.I.groups.find(g=>g.alts);root.querySelectorAll('[data-xalt]').forEach(b=>b.onclick=()=>{const a=ag.alts[+b.dataset.xalt];XC.alt=XC.alt===a.id?null:a.id;XC.altTag=a.tag;XC.crit=null;root.querySelectorAll('[data-xalt]').forEach(x=>x.setAttribute('aria-pressed',x===b&&XC.alt!=null));xcAlt(A)});
  const f=$('#xcQ');if(f)f.onsubmit=e=>{e.preventDefault();const t=$('#xcIn').value.trim();XC.q=t;if(t)xcAskFlow(A,S.parse(t,A.P))};
  if(XC.tag)xcAdd(A);if(XC.alt)xcAlt(A);xcHist(A);if(XC.res&&XC.sig===sigOf(A.P))xcShow(A,XC.res,XC.title);else if(XC.sig!==sigOf(A.P)){XC.res=null;XC.hist=[]}
  if(DOC.xcPending){const sp=DOC.xcPending;DOC.xcPending=null;xcRun(A,sp,XC.q||null)}
  if(DOC.xcFocus){DOC.xcFocus=false;const i=$('#xcIn');if(i)setTimeout(()=>i.focus(),250)}}
function xcAskFlow(A,r){const box=$('#xcAsk');if(!box)return;const S=ATLASI.scenarios;box.innerHTML='';
  if(r.error){box.innerHTML=`<p class="xc-err">${esc(r.error)}</p>`;return}
  if(r.explore){XC.tag=null;XC.crit=r.explore.sortKey;box.innerHTML=`<p class="xc-w">${esc(r.note||'')}</p>`;xcAddList(A,null,r.explore.sortKey);return}
  if(r.ask){box.innerHTML=`<p class="xc-aq">${esc(r.ask.question)}</p><div class="xc-chips">${r.ask.options.filter(o=>o.value!=null).map((o,i)=>`<button data-xa="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    const opts=r.ask.options.filter(o=>o.value!=null);box.querySelectorAll('[data-xa]').forEach(b=>b.onclick=()=>xcAskFlow(A,S.resolveAsk(r.ask.pending,opts[+b.dataset.xa].value)));return}
  if(r.scenario)xcRun(A,r.scenario,r.scenario.source&&r.scenario.source.text)}
async function xcRun(A,scn,txt){const S=ATLASI.scenarios,box=$('#xcRes');if(!box)return;box.innerHTML='<div class="sk"><i></i><i></i><i></i></div>';
  const t0=performance.now(),ctx=await xcCtx(A);let res;try{res=await S.simulate(A.P,scn,ctx)}catch(e){box.innerHTML=`<p class="xc-err">No se pudo simular: ${esc(e.message)}</p>`;return}
  if(!$('#xcRes'))return;const title=(txt?`«${txt}» → `:'')+S.title(scn,A.P);track('scenario_open',scn.type||'multi');XC.res=res;XC.sig=sigOf(A.P);XC.title=title;XC.ms=performance.now()-t0;
  if(!res.valid&&res.ask){xcAskTotal(A,scn,res,txt);return}
  XC.hist=[{title,key:res.key,mat:res.materiality,res}].concat(XC.hist.filter(h=>h.key!==res.key)).slice(0,5);xcHist(A);xcShow(A,res,title);
  box.scrollIntoView({block:'start',behavior:RM()?'auto':'smooth'})}
function xcAskTotal(A,scn,res,txt){const box=$('#xcRes');box.innerHTML=`<div class="xc-sc"><p class="xc-aq">${esc(res.ask.question)}</p><div class="xc-chips">${res.ask.options.filter(o=>o.value!=null).map(o=>`<button data-xt="${o.value}">${esc(o.label)}</button>`).join('')}</div></div>`;
  box.querySelectorAll('[data-xt]').forEach(b=>b.onclick=async()=>{XC.ctx={...(XC.ctx||{mode:'weights'}),total:+b.dataset.xt};xcRun(A,scn,txt)})}
function xcHist(A){const h=$('#xcHist');if(!h)return;h.innerHTML=XC.hist.length>1?`<div class="xc-k">Escenarios abiertos</div><div class="xc-chips">${XC.hist.map((x,i)=>`<button data-xh="${i}" aria-pressed="${XC.res&&XC.res.key===x.key}">${esc(x.title)}</button>`).join('')}</div>`:'';
  h.querySelectorAll('[data-xh]').forEach(b=>b.onclick=()=>{const x=XC.hist[+b.dataset.xh];XC.res=x.res;XC.title=x.title;xcHist(A);xcShow(A,x.res,x.title)})}
const MATL={none:'Sin cambio material',oneSided:'Cambios en una dirección',mixed:'Mejora unas métricas y empeora otras'};
function xcShow(A,res,title){const S=ATLASI.scenarios,box=$('#xcRes');if(!box)return;
  if(!res.valid){box.innerHTML=`<div class="xc-sc"><div class="xc-sh"><span class="xc-n">Escenario</span><h4>${esc(title)}</h4></div><p class="xc-err">${(res.violations||[]).map(v=>esc(v.text)).join('<br>')||'Escenario no válido.'}</p><button class="btn2 sm" data-xagain>Probar otro escenario</button></div>`;xcBindRes(A,res);return}
  const M=res.metrics,row=r=>`<li class="xc-m ${r.cls||''}"><span class="xl">${esc(r.label)}</span><span class="xv">${xv(r,r.before)} → ${xv(r,r.after)}</span><span class="xd">${xd(r)}</span>${xq(r.quality)}</li>`;
  const sec=(t,ids,c)=>{const rs=ids.map(id=>M.find(r=>r.id===id)).filter(Boolean);return rs.length?`<div class="xc-sec ${c}"><div class="xc-k">${t}</div><ul>${rs.map(row).join('')}</ul></div>`:''};
  const dims=M.filter(r=>r.id.startsWith('dim:'));
  const H=res.history;box.innerHTML=`<div class="xc-sc"><div class="xc-sh"><span class="xc-n">Escenario</span><h4>${esc(title)}</h4><span class="xc-mt ${res.materiality}">${MATL[res.materiality]||''}</span></div>
    ${res.moves&&res.moves.length?`<ul class="xc-mv">${res.moves.map(x=>`<li><b>${esc(S.nameOf(x.id))}</b><span>${num(x.from*100,1)} % → ${num(x.to*100,1)} %</span><em class="${x.delta<0?'dn':'up'}">${x.delta>0?'+':'−'}${num(Math.abs(x.delta)*100,1)} pp</em></li>`).join('')}</ul>`:''}
    <div class="xc-rd"><div class="xc-k">Lectura</div>${S.narrate(res).map(p=>`<p>${esc(p)}</p>`).join('')}</div>
    ${sec('Mejora',res.improves,'up')}${sec('Empeora',res.worsens,'dn')}${sec('Cambia',res.changes.filter(id=>!id.startsWith('dim:')),'eq')}
    <div class="xc-sec dims"><div class="xc-k">Salud por dimensiones <span class="xc-w">cada una por separado; riesgo solo «cambia»</span></div><ul>${dims.map(row).join('')}</ul></div>
    <details class="xc-all"><summary>Todas las métricas (${M.length}) · ¿por qué?</summary><ul>${M.map(r=>`<li class="xc-m ${r.cls||''}${r.material?'':' im'}"><details><summary><span class="xl">${esc(r.label)}</span><span class="xv">${xv(r,r.before)} → ${xv(r,r.after)}</span><span class="xd">${xd(r)}</span>${xq(r.quality)}</summary><p class="xc-why">${esc((S.explain(res,r.id)||{}).text||'')}</p></details></li>`).join('')}</ul></details>
    ${H?`<details class="xc-all"><summary>Contexto histórico · ${esc(H.label)}</summary><table class="xc-h"><tr><th></th><th>Actual</th><th>Escenario</th></tr>${[['Rentabilidad anual','cagr'],['Volatilidad','vol'],['Caída máxima','dd'],['Peor año móvil','worst12']].map(([l,k])=>`<tr><td>${l}</td><td>${H.before[k]==null?'—':pct(H.before[k],1)}</td><td>${H.after[k]==null?'—':pct(H.after[k],1)}</td></tr>`).join('')}</table><p class="xc-w">${esc(H.note)} Periodo ${fdate(H.period.from)} – ${fdate(H.period.to)}. ${esc(H.method)} ${esc(H.dividends)}</p></details>`:''}
    <details class="xc-all"><summary>Supuestos, avisos y fiscalidad</summary><ul class="xc-n2">${(res.assumptions||[]).concat(res.warnings||[]).map(t=>`<li>${esc(t)}</li>`).join('')}${res.tax?`<li>${esc(res.tax.text)}</li>`:''}<li>Datos: ${esc(res.dataVersion)} · ventana hasta ${fdate(res.asof.end)}</li></ul></details>
    <div class="ix-btns"><button class="btn2 sm" data-xagain>Probar otro escenario</button></div></div>`;xcBindRes(A,res)}
function xcBindRes(A,res){const b=$('#xcRes [data-xagain]');if(b)b.onclick=()=>{const s=$('.xc');if(s)s.scrollIntoView({block:'start',behavior:RM()?'auto':'smooth'});const i=$('#xcIn');if(i)i.focus({preventScroll:true})}}
const XSORT=[['overlap','Menor solapamiento'],['bets','Mayor diversificación (apuestas)'],['ter','Menor coste'],['vol','Menor volatilidad'],['countries','Más países']];
function critChips(cur,attr){return `<div class="xc-k">Ordenar por (elige un criterio)</div><div class="xc-chips">${XSORT.map(([k,l])=>`<button ${attr}="${k}" aria-pressed="${cur===k}">${l}</button>`).join('')}</div>`}
function xcAdd(A){const box=$('#xcAddBox');if(!box)return;if(!XC.tag){box.innerHTML='';return}box.innerHTML=critChips(XC.crit,'data-xcr')+'<div id="xcAddL"></div>';
  box.querySelectorAll('[data-xcr]').forEach(b=>b.onclick=()=>{XC.crit=b.dataset.xcr;box.querySelectorAll('[data-xcr]').forEach(x=>x.setAttribute('aria-pressed',x===b));xcAddList(A,XC.tag,XC.crit)});if(XC.crit)xcAddList(A,XC.tag,XC.crit)}
async function xcAddList(A,tag,crit){const S=ATLASI.scenarios;let box=$('#xcAddL');if(!box){const r=$('#xcRes');if(!r)return;r.insertAdjacentHTML('beforebegin','<div id="xcAddL" class="xc-g"></div>');box=$('#xcAddL')}
  box.innerHTML='<div class="sk"><i></i><i></i></div>';const ctx=await xcCtx(A);const L=await S.explore.additions(A.P,ctx,{sortKey:crit,tag,w:.10});if(!box.isConnected)return;XC.list=L;
  box.innerHTML=xcList(L,it=>`Añadir 10 %`);box.querySelectorAll('[data-xli]').forEach(b=>b.onclick=()=>{const it=L.items[+b.dataset.xli];track('scenario_open','add');XC.res=it.result;XC.sig=sigOf(A.P);XC.title=S.title(it.result.scenario,A.P);XC.hist=[{title:XC.title,key:it.result.key,mat:it.result.materiality,res:it.result}].concat(XC.hist.filter(h=>h.key!==it.result.key)).slice(0,5);xcHist(A);xcShow(A,it.result,XC.title);$('#xcRes').scrollIntoView({block:'start',behavior:RM()?'auto':'smooth'})})}
function xcList(L,btn){const val=(it,k)=>k==='overlap'?(it.overlap==null?'solapamiento —':`solapamiento ≥ ${pct(it.overlap,0)}`):k==='ter'?(it.ter==null?'TER —':`TER ${pct(it.ter,2)}`):k==='vol'?(it.vol==null?'vol. —':`vol. cartera ${pct(it.vol,1)}`):k==='bets'?(it.dBets==null?'apuestas —':`apuestas ${it.dBets>=0?'+':'−'}${num(Math.abs(it.dBets),2)}`):k==='countries'?`${it.countries} países > 1 %`:'';
  return `<p class="xc-w">${esc(L.orderLabel)}. ${esc(L.note)}</p>${L.items.length?`<div class="xc-rows">${L.items.map((it,i)=>`<div class="xc-r"><span class="xc-t"><b>${esc(ATLASI.scenarios.nameOf(it.asset))}</b><small>${esc((entBy(...it.asset.split(/:(.+)/).slice(0,2))||{}).name||'')} · ${esc(val(it,L.sortKey))}</small></span><span class="xc-ops"><button class="xc-op" data-xli="${i}">${btn(it)}</button></span></div>`).join('')}</div>`:'<p class="xc-w">No hay candidatos en esta categoría con los datos de ATLAS.</p>'}`}
function xcAlt(A){const box=$('#xcAltBox');if(!box)return;if(!XC.alt){box.innerHTML='';return}box.innerHTML=critChips(XC.crit,'data-xar')+'<div id="xcAltL"></div>';
  box.querySelectorAll('[data-xar]').forEach(b=>b.onclick=async()=>{XC.crit=b.dataset.xar;box.querySelectorAll('[data-xar]').forEach(x=>x.setAttribute('aria-pressed',x===b));const l=$('#xcAltL');l.innerHTML='<div class="sk"><i></i></div>';
    const L=await ATLASI.scenarios.explore.alternatives(A.P,await xcCtx(A),{from:XC.alt,tag:XC.altTag,sortKey:XC.crit});if(!l.isConnected)return;l.innerHTML=xcList(L,()=>'Sustituir');
    l.querySelectorAll('[data-xli]').forEach(x=>x.onclick=()=>{const it=L.items[+x.dataset.xli];track('scenario_open','replace');XC.res=it.result;XC.sig=sigOf(A.P);XC.title=ATLASI.scenarios.title(it.result.scenario,A.P);xcShow(A,it.result,XC.title);$('#xcRes').scrollIntoView({block:'start'})})})}
function openExplore(problem,focus){DOC.xc=problem||null;track('explore_from',problem&&problem.kind||'all');DOC.src=PF.length?'pf':DOC.src;if(focus)DOC.xcFocus=true;docTab('explore')}
/* Contribución de cada posición al riesgo total (MODELO): descomposición estándar de la varianza de la cartera.
   c_i = w_i·(Σw)_i / σ²_p, con Σ_ij = ρ_ij·σ_i·σ_j (correlaciones y volatilidades semanales en EUR de riskOf, 5 años). Suma el 100 %.
   No es un ranking de calidad ni una indicación de qué cambiar. */
function riskContribution(An){const R=An&&An.R;if(!R||!R.assets||!R.assets.length||!R.sig)return null;const ok=R.assets.map((e,i)=>({e,i,s:R.sig[i]})).filter(o=>o.s!=null);if(!ok.length)return null;
  const wOf=e=>(An.P.find(x=>x.e===e)||{w:0}).w,tw=ok.reduce((a,o)=>a+wOf(o.e),0);if(!(tw>0))return null;let miss=0;
  const sw=ok.map(o=>ok.reduce((a,p)=>{const c=o.i===p.i?1:R.M[o.i][p.i];if(c==null){miss++;return a}return a+c*o.s*p.s*wOf(p.e)/tw},0));
  const v=ok.reduce((a,o,k)=>a+wOf(o.e)/tw*sw[k],0);if(!(v>0))return null;
  const items=ok.map((o,k)=>({id:o.e.k+':'+o.e.t,w:wOf(o.e),vol:o.s*100,contrib:wOf(o.e)/tw*sw[k]/v})).concat(An.P.filter(x=>!R.assets.includes(x.e)).map(x=>({id:x.e.k+':'+x.e.t,w:x.w,vol:null,contrib:null})));
  items.sort((a,b)=>(b.contrib??-1)-(a.contrib??-1)||(a.id<b.id?-1:1));
  return{items,quality:'MODEL',coverage:Math.round(tw*100),incomplete:miss>0||tw<.999,sigma:Math.sqrt(v)*100,period:{from:R.grid[0],to:R.grid[R.grid.length-1]},
    method:'Descomposición de la varianza: w_i·(Σw)_i / σ²_p con correlaciones y volatilidades semanales en EUR (5 años).',meaning:'Contribución estimada de cada posición al riesgo total de la cartera según volatilidades y correlaciones históricas. Suma el 100 %.'}}
Object.assign(window.ATLASI,{portfolio:{contribution:pContribution,impact:pImpact,riskContribution,exposure:(A,k)=>getCompanyExposure(A,k),dataState},track,usage,DIMS,dimOf,openExplore});
/* ======================= P1.1 · ANALIZAR (puerta de entrada) =======================
   Una sola capa: ATLASI.assets (identidad) → ATLASI.query (intención + ejecución) → este renderizador.
   Se usa en el buscador («¿Qué quieres investigar?»), en la ficha (openDetail) y desde Hoy. Sin cálculos aquí. */
const QL2={DATA:['real','Dato'],ESTIMATE:['est','Estimación'],MODEL:['model','Modelo'],INCOMPLETE:['inc','Incompleto']};
function azVal(v){if(!v||v.value==null)return '<span class="az-na">Dato no disponible</span>';const u=v.unit||'',x=v.value,lb=v.bound==='lower'?(x<0?'al menos ':'≥ '):'';   // cota inferior de un valor negativo = «al menos −x» (en magnitud)
  const s=u==='%'||u==='pp'?`${lb}${x<0?'−':''}${num(Math.abs(x),Math.abs(x)<1&&x!==0?2:1)} ${u==='%'?'%':'pp'}`:u==='€'?`${lb}${x<0?'−':''}${num(Math.abs(x))} €`:u===''?num(x,2):`${lb}${num(x,0)} ${u}`;return s}
function azRow(r){const v=r.value,q=v?QL2[v.quality]||QL2.INCOMPLETE:QL2.INCOMPLETE,why=v&&[v.calculation?`Cálculo: ${v.calculation}`:'',v.method?`Método: ${v.method}`:'',v.source?`Fuente: ${v.source}`:'',v.date?`Fecha: ${fdate(v.date)}`:'',v.coverage!=null?`Cobertura: ${v.coverage} %`:'',v.bound==='lower'?'Cota inferior: el valor real puede ser mayor.':''].filter(Boolean);
  return `<li class="az-r"><details><summary><span class="az-l">${r.id?`<button class="lnk az-go" data-azid="${esc(r.id)}">${esc(r.label)}</button>`:esc(r.label)}${r.sub?`<small>${esc(r.sub)}</small>`:''}</span><b class="az-v">${azVal(v)}</b><span class="q ${q[0]}">${q[1]}${v&&v.bound==='lower'?' · cota inf.':''}</span></summary>${why&&why.length?`<p class="az-why">${why.map(esc).join('<br>')}</p>`:''}</details></li>`}
function azIdent(d){if(!d)return '';const pv=d.provenance||{},c=pv.composition||{},na='<span class="az-na">Dato no disponible</span>';
  const kindL={etf:'ETF',fund:'Fondo',stock:'Acción',company:'Empresa',index:'Índice',concept:'Concepto',sector:'Sector',country:'País'}[d.kind]||d.kind;
  const prod=d.kind==='etf'||d.kind==='fund'||d.kind==='stock';
  return `<div class="az-id"><div class="az-k">Identificación · ${kindL}</div><h4>${d.atlasTicker?`<b>${esc(d.atlasTicker)}</b> · `:''}${esc(d.name||'')}</h4>
    ${prod?`<dl><dt>ISIN</dt><dd>${d.isin?esc(d.isin):na}</dd>${d.usTicker?`<dt>Equivalente estadounidense</dt><dd>${esc(d.usTicker)}</dd>`:''}<dt>Precio</dt><dd>${pv.price?esc(pv.price):na}</dd>${d.kind!=='stock'?`<dt>TER</dt><dd>${pv.ter?esc(pv.ter):na}</dd><dt>Composición</dt><dd>${[c.companies?`empresas y sectores: ${c.companies}`:'',c.countries?`países: ${c.countries}`:''].filter(Boolean).map(esc).join(' · ')||na}</dd>`:''}</dl>`:''}
    ${(d.warnings||[]).map(w=>`<p class="az-warn">${esc(w)}</p>`).join('')}</div>`}
function azHTML(res,opts={}){if(!res)return '';
  if(res.unsupported)return `<div class="az"><p class="az-t">${esc(res.unsupported.text)}</p><div class="xc-chips">${res.unsupported.examples.map(x=>`<button data-azq="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
  if(res.none)return `<div class="az"><p class="az-t">${esc(res.none.text)}</p>${res.none.hint?`<p class="az-w">${esc(res.none.hint)}</p>`:''}</div>`;
  if(res.ask)return `<div class="az"><p class="az-t">${esc(res.ask.question)}</p><div class="az-opts">${res.ask.options.map((o,i)=>`<button data-azo="${i}"><b>${esc(o.atlasTicker||o.id)}</b><span>${esc(o.name||'')}</span><small>${[o.isin?'ISIN '+o.isin:'ISIN: dato no disponible',o.weight!=null?num(o.weight,1)+' % de tu cartera':''].filter(Boolean).map(esc).join(' · ')}</small></button>`).join('')}</div>${res.ask.more?`<p class="az-w">Y ${res.ask.more} más: escribe el ticker exacto o el ISIN.</p>`:''}</div>`;
  const secs=(res.sections||[]).filter(s=>!opts.only||opts.only.includes(s.id));
  return `<div class="az">${opts.noTitle?'':`<p class="az-k">${esc({asset:'Analizar',exposure:'Exposición',composition:'Composición',compare:'Comparar',sectorHoldings:'Sector',countryDependence:'País',overlapTop:'Solapamiento',riskTop:'Riesgo',today:'Hoy',explore:'Explorar'}[res.intent]||'')}</p><h3 class="az-h">${esc(res.title||'')}</h3>`}
    ${opts.noIdent?'':(res.entity?azIdent(res.entity):(res.entities||[]).map(azIdent).join(''))}
    ${(res.reading||[]).length?`<div class="az-rd">${res.reading.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}
    ${secs.map(s=>`<section class="az-s"><div class="az-k">${esc(s.title)}</div>${s.table?`<table class="az-tb"><tr><th></th>${s.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${s.table.rows.map(r=>`<tr><td>${esc(r.label)}</td>${r.cols.map(v=>`<td>${azVal(v)} <span class="q ${(QL2[v.quality]||QL2.INCOMPLETE)[0]}">${(QL2[v.quality]||QL2.INCOMPLETE)[1]}</span></td>`).join('')}</tr>`).join('')}</table>`:''}${(s.rows||[]).length?`<ul>${s.rows.map(azRow).join('')}</ul>`:''}${(s.text||[]).map(t=>`<p class="az-w">${esc(t)}</p>`).join('')}</section>`).join('')}
    ${(res.actions||[]).length&&!opts.noActions?`<div class="az-a">${res.actions.map((a,i)=>`<button class="btn2 sm" data-aza="${i}">${esc(a.label)}</button>`).join('')}</div>`:''}</div>`}
async function azPortfolio(){try{const A=await analyzeSrc(PF.length?'pf':DOC.src);if(A&&!A.empty)return A}catch(_){}return{P:[],L:lookThrough([]),R:null,SC:{},D:[],empty:true,src:{src:'none'}}}
/* ejecuta una consulta (texto o {intent,args}) y la pinta en `box` con sus acciones */
async function azRun(box,q,opts={}){if(!box)return;box.innerHTML='<div class="sk"><i></i><i></i></div>';const An=await azPortfolio();const Q=ATLASI.query;
  let p=typeof q==='string'?Q.parse(q,An):q;if(!box.isConnected)return;
  if(p.ask){box.innerHTML=azHTML({ask:p.ask});box.querySelectorAll('[data-azo]').forEach(b=>b.onclick=()=>azRun(box,Q.choose(p.ask.pending,p.ask.options[+b.dataset.azo].id),opts));return}
  if(p.none||p.unsupported){box.innerHTML=azHTML(p);box.querySelectorAll('[data-azq]').forEach(b=>b.onclick=()=>{const i=$('#sQ');if(i)i.value=b.dataset.azq;azRun(box,b.dataset.azq,opts)});return}
  if(p.intent==='scenario'){const s=p.args.parsed;if(s.scenario){azGo('scenario',{scenario:s.scenario,text:typeof q==='string'?q:''});return}
    if(s.ask){box.innerHTML=azHTML({ask:{question:s.ask.question,options:s.ask.options.filter(o=>o.value!=null).map(o=>({id:o.value,atlasTicker:o.label,name:''}))}});const opts2=s.ask.options.filter(o=>o.value!=null);
      box.querySelectorAll('[data-azo]').forEach(b=>b.onclick=()=>azRun(box,{intent:'scenario',args:{parsed:ATLASI.scenarios.resolveAsk(s.ask.pending,opts2[+b.dataset.azo].value)}},opts));return}
    if(s.explore){azGo('explore',{});return}box.innerHTML=azHTML({none:{text:s.error||'No he entendido el cambio.',hint:null}});return}
  if(p.intent==='explore'){azGo('explore',{});return}
  const t0=performance.now(),res=await Q.run(p.intent,p.args,An);if(!box.isConnected)return;AZ.last={p,res,ms:performance.now()-t0};
  track('analyze_open',p.intent);if(box.id==='sAns')box.dataset.keep='1';box.innerHTML=azHTML(res,opts);
  box.querySelectorAll('[data-aza]').forEach(b=>b.onclick=()=>{const a=res.actions[+b.dataset.aza];azGo(a.id,a.args,An)});
  box.querySelectorAll('[data-azid]').forEach(b=>b.onclick=e=>{e.preventDefault();ATLASI.analyze(b.dataset.azid)})}
const AZ={last:null};
async function azGo(act,args,An){An=An||await azPortfolio();const AS=ATLASI.assets,e=args&&args.id?AS.entity(args.id):null;
  if(act==='analyze')return ATLASI.analyze(args.id);
  if(act==='detail'&&e){if(typeof closeSearch==='function')closeSearch(true);return openDetail(e.k,e.t,e.node)}
  if(act==='exposure'){track('exposure_click');if(typeof closeSearch==='function')closeSearch(true);const key=args.key||(e&&e.k==='s'?ckey(e.name,e.t):null);
    if(key&&An.L&&An.L.comps.find(c=>c.key===key))return focusCompany(An,key);if(e&&e.k!=='s')return showExposureGlobe([{e,w:1}],e.obj.u?e.obj.u.t:e.name,'geo');if(An.P.length)return showExposureGlobe(An.P,An.name,'comp');return}
  if(act==='simulate'){if(typeof closeSearch==='function')closeSearch(true);if(args.replace){const [a,b]=args.replace;DOC.xcPending={...ATLASI.scenarios.schema.emptyScenario(),type:'replace',changes:[{op:'replace',from:a,to:b}],source:{text:'',parsedBy:'analyze@1'}};return openExplore(null)}
    if(args.key)return openExplore({kind:'comp',ref:args.key,id:args.id});if(e&&An.P.some(x=>x.e===e))return openExplore({kind:'asset',ref:args.id,title:`Cambios en ${e.tk||e.t}`});return openExplore(null)}
  if(act==='scenario'){if(typeof closeSearch==='function')closeSearch(true);DOC.xcPending=args.scenario;XC.q=args.text||'';return openExplore(null)}
  if(act==='explore'){if(typeof closeSearch==='function')closeSearch(true);return openExplore(args&&args.problem||null)}
  if(act==='compare'){if(typeof closeSearch==='function')closeSearch(true);return openCompare({name:e.name,P:[{e,w:1}]},null)}
  if(act==='compareOpen'){if(typeof closeSearch==='function')closeSearch(true);const a=AS.entity(args.a),b=AS.entity(args.b);return openCompare({name:a.name,P:[{e:a,w:1}]},{name:b.name,P:[{e:b,w:1}]})}
  if(act==='todayOpen'){if(typeof closeSearch==='function')closeSearch(true);if(typeof closeHub==='function')closeHub(true);OV.collapsed=false;OV.hidden=false;track('today_open');return renderOverview()}}
/* Analizar una entidad ya resuelta (Hoy, ficha, listas): abre el buscador con la consulta y su resultado */
function analyzeId(id){const AS=ATLASI.assets,d=AS.describe(id);if(typeof openSearch==='function')openSearch();setTimeout(()=>{const i=$('#sQ');if(i){i.value=`Analiza ${d.atlasTicker||d.name}`;if(typeof sq!=='undefined')sq.q=''}const box=$('#sAns');if(box){box.hidden=false;azRun(box,{intent:'asset',args:{id}})}},60)}
/* ficha (openDetail): identificación + «En tu cartera» arriba, con el mismo motor */
if(typeof openDetail==='function'&&!window.__azDetail){window.__azDetail=true;const _od=openDetail;window.openDetail=function(k,t,node){const r=_od.apply(this,arguments);try{
  const d=$('#detail'),host=d&&(d.querySelector('.dbody')||d.querySelector('.dbox'));if(host&&!host.querySelector('.az-d')){const id=k+':'+t;host.insertAdjacentHTML('afterbegin',`<section class="az-d" data-id="${esc(id)}">${azIdent(ATLASI.assets.describe(id))}<div class="az-mine"></div></section>`);
    azPortfolio().then(async An=>{const box=host.querySelector('.az-d .az-mine');if(!box||!An.P.length)return;const e=ATLASI.assets.entity(id),held=An.P.some(x=>x.e===e),isCo=e&&e.k==='s';if(!held&&!isCo)return;
      const res=await ATLASI.query.run(isCo?'exposure':'asset',{id},An);if(!box.isConnected)return;res.actions=(res.actions||[]).filter(a=>a.id!=='detail');box.innerHTML=azHTML(res,{only:['mine'],noIdent:true,noTitle:true});
      box.querySelectorAll('[data-aza]').forEach(b=>b.onclick=()=>{const a=res.actions[+b.dataset.aza];azGo(a.id,a.args,An)})})}}catch(_){}return r}}
/* Primitivas internas para ATLASI.scenarios (solo exportadas; sin cambios de comportamiento) */
Object.assign(window.ATLASI,{simP,wmap,withMoves,shiftTo,addNew,movesOf,candidates,tagsOf,scoreOf,entBy,sigOf,assetClass,terOf,isNarrow,diagnose,
  UNK,EM_SET:EM,resolveTok,resolveRow,parsePaste,CNAME,ckey,analyze:analyzeId,azRun,azGo});
Object.defineProperty(window.ATLASI,'EXPO',{get:()=>EXPO,configurable:true});
Object.assign(window.ATLASI,{optimize,marginalOf:A=>marginalOf(A,metOf(A)),metOf,QUALITY,getPortfolio,analyzePortfolio,getPortfolioExposure:A=>A.L,getCompanyExposure,getSectorExposure,getCountryExposure,getEffectiveBets,getPortfolioHealth,getAssetOverlap:(a,b)=>overlapDetail(a,b),getPortfolioContribution,dayMove});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
