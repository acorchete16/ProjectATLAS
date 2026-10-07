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
function weeklyGrid(years){const out=[],end=new Date();const d=new Date(end);d.setFullYear(d.getFullYear()-years);while(d.getDay()!==5)d.setDate(d.getDate()+1);while(d<=end){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+7)}return out}
async function retSeries(e,grid){const s=await eurSeries(e.k,e.obj);if(!s||!s.length)return null;const first=s[0][0];const px=grid.map(d=>d<first?null:priceAt(s,d).v);
  const r=[];for(let i=1;i<px.length;i++)r.push(px[i]!=null&&px[i-1]!=null?px[i]/px[i-1]-1:null);return{r,first}}
const corr=(a,b)=>{const p=[];for(let i=0;i<a.length;i++)if(a[i]!=null&&b[i]!=null)p.push([a[i],b[i]]);if(p.length<40)return null;const n=p.length,ma=p.reduce((s,x)=>s+x[0],0)/n,mb=p.reduce((s,x)=>s+x[1],0)/n;let c=0,va=0,vb=0;p.forEach(([x,y])=>{c+=(x-ma)*(y-mb);va+=(x-ma)**2;vb+=(y-mb)**2});return va&&vb?c/Math.sqrt(va*vb):null};
async function riskOf(P,years=5){const grid=weeklyGrid(years),R=await Promise.all(P.map(x=>retSeries(x.e,grid)));
  const ok=P.map((x,i)=>({...x,r:R[i]})).filter(x=>x.r);if(!ok.length)return null;const tw=ok.reduce((a,x)=>a+x.w,0);
  const pr=grid.slice(1).map((_,t)=>{let s=0,ww=0;ok.forEach(x=>{const v=x.r.r[t];if(v!=null){s+=x.w*v;ww+=x.w}});return ww>tw*.6?s/ww:null});
  const v=pr.filter(x=>x!=null);if(v.length<30)return null;const m=v.reduce((a,x)=>a+x,0)/v.length,sd=Math.sqrt(v.reduce((a,x)=>a+(x-m)**2,0)/(v.length-1));
  let idx=1,pk=1,dd=0;const path=[1];pr.forEach(x=>{if(x!=null){idx*=1+x;pk=Math.max(pk,idx);dd=Math.min(dd,idx/pk-1)}path.push(idx)});
  const r12=[];for(let i=52;i<path.length;i++)r12.push(path[i]/path[i-52]-1);r12.sort((a,b)=>a-b);
  const yrs=v.length/52,cagr=Math.pow(idx,1/yrs)-1;
  const M=ok.map(a=>ok.map(b=>a===b?1:corr(a.r.r,b.r.r)));const firstData=ok.map(x=>x.r.first).sort().pop();
  return{vol:sd*Math.sqrt(52)*100,dd:dd*100,worst12:r12.length?r12[0]*100:null,p5:r12.length?r12[Math.floor(r12.length*.05)]*100:null,cagr:cagr*100,weeks:v.length,firstData,M,assets:ok.map(x=>x.e),pr,grid,coverage:tw}}

/* ------------------------------ 3 · PORTFOLIO DOCTOR: puntuaciones ------------------------------ */
let DOC=(()=>{try{return {tab:'doctor',...(JSON.parse(localStorage.getItem('atlas_doc')||'null')||{src:'pf',rows:[]})}}catch(_){return{src:'pf',rows:[],tab:'doctor'}}})();
const saveDoc=()=>{try{localStorage.setItem('atlas_doc',JSON.stringify(DOC))}catch(_){}};
let _pfV=null;
async function docPortfolio(src){src=src||DOC.src;if(src==='pf'&&PF.length){const rs=await Promise.all(PF.map(pfValue)),g=new Map();let inv=0,val=0;rs.forEach(r=>{if(!r.ent||r.err||r.pending||!(r.val>0))return;inv+=r.inv;val+=r.val;const k=r.ent.k+'|'+r.ent.t;g.set(k,(g.get(k)||0)+r.val)});
    const tot=[...g.values()].reduce((a,v)=>a+v,0);_pfV={inv,val};return{name:'Mi cartera',src:'pf',val,inv,P:[...g.entries()].map(([k,v])=>{const [kk,t]=k.split('|');return{e:entBy(kk,t),w:v/tot}}).filter(x=>x.e)}}
  const rows=(DOC.rows||[]).map(r=>({e:entBy(r.k,r.t),w:+r.w||0})).filter(x=>x.e&&x.w>0),tot=rows.reduce((a,x)=>a+x.w,0);return{name:'Cartera de prueba',src:'custom',P:tot?rows.map(x=>({e:x.e,w:x.w/tot})):[]}}
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
  cost:['Coste','¿Cuánto pagas en comisiones?','100 − 50 × gastos anuales medios ponderados (TER, %). 0,1 % → 95; 0,5 % → 75; 1,5 % → 25.','Costes']};
function docScores(L,R,P){const S={},ev={};const known=L.comps.reduce((a,c)=>a+c.w*c.w,0)/1e4;
  const neff=known?1/known:null;const top1=L.comps[0]?L.comps[0].w:0,top10=L.comps.slice(0,10).reduce((a,c)=>a+c.w,0);
  if(neff){S.div=clamp(100*Math.log(Math.max(1,neff))/Math.log(200));ev.div=[`Como mucho ≈ ${num(neff)} empresas equivalentes`,`Composición conocida: ${pct(L.cover,0)} de la cartera`,L.uniq.hi?`Empresas distintas: entre ${num(L.uniq.lo)} y ${num(L.uniq.hi)}`:`Empresas distintas: al menos ${num(L.uniq.lo)}`]}
  const narrow=P.filter(x=>isNarrow(x.e)).reduce((a,x)=>a+x.w*100,0);S.conc=clamp(100-1.5*Math.max(0,narrow-10));ev.conc=[`Acciones individuales y ETFs temáticos/sectoriales: ${pct(narrow,0)}`,`Mayor posición: ${P.slice().sort((a,b)=>b.w-a.w)[0].e.name} ${pct(P.slice().sort((a,b)=>b.w-a.w)[0].w*100,0)}`];
  if(L.comps.length){S.comp=clamp(100-6*Math.max(0,top1-3)-1.2*Math.max(0,top10-25));ev.comp=[`Mayor empresa: ${L.comps[0].name} ≥ ${pct(top1)}`,`10 mayores empresas: ≥ ${pct(top10)}`]}
  const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);if(cs.length){const n1=cs.filter(([,v])=>v>1).length;S.geo=clamp(100-2*Math.max(0,cs[0][1]-60)-(n1<5?15:0));ev.geo=[`${CNAME[cs[0][0]]||cs[0][0]}: ${pct(cs[0][1])}`,`${n1} países por encima del 1 %`,L.C.XX?`No desglosado: ${pct(L.C.XX,0)}`:null].filter(Boolean)}
  const ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);if(ss.length){S.sec=clamp(100-2.5*Math.max(0,ss[0][1]-25));ev.sec=[`${ss[0][0]}: ${pct(ss[0][1])}`,ss[1]?`${ss[1][0]}: ${pct(ss[1][1])}`:null].filter(Boolean)}
  let ac=null;if(R){if(R.M.length>1){let s=0,ww=0;R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c==null)return;const wi=P.find(x=>x.e===a).w*P.find(x=>x.e===b).w;s+=wi*c;ww+=wi}));if(ww){ac=s/ww;S.corr=clamp((1-ac)*130);ev.corr=[`Correlación media: ${ac.toFixed(2).replace('.',',')}`]}}
    S.vol=clamp(100-4*(R.vol-8));ev.vol=[`Volatilidad anual: ${pct(R.vol)}`];S.dd=clamp(100-2.5*(Math.abs(R.dd)-10));ev.dd=[`Caída máxima: ${pct(R.dd)}`,R.worst12!=null?`Peor año móvil: ${pct(R.worst12)}`:null].filter(Boolean)}
  if(L.ter!=null){S.cost=clamp(100-50*L.ter);ev.cost=[`TER medio ponderado: ${pct(L.ter,2)} al año`,L.terW<.99?`Sin dato de coste en el ${pct((1-L.terW)*100,0)}`:null].filter(Boolean)}
  const miss=Object.keys(SCORE_DOC).filter(k=>S[k]==null);const vals=Object.values(S);
  return{S,ev,miss,health:vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:null,neff,top1,top10,narrow,avgCorr:ac}}

/* ------------------------------ DIAGNÓSTICO ------------------------------ */
const SEV={alta:['🔴','ALTO','#ff5d6c'],media:['🟠','MEDIO','#ffa94d'],baja:['🟡','BAJO','#e8c66a'],ok:['🟢','BIEN','#3ddc84'],info:['⚪','DATOS','#8fa3bd']};
function diagnose(A){const {L,R,P,SC}=A,D=[];const asof=(P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||null,pxDate=R?R.grid[R.grid.length-1]:null;
  const add=(sev,t,exp,metric,evid,src,date,acts)=>D.push({sev,t,exp,metric,evid,src,date,acts:acts||[]});
  const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]),top=cs[0];
  if(top&&top[1]>70){const by=(L.byC[top[0]]||[]).sort((a,b)=>b.p-a.p).slice(0,3);add(top[1]>85?'alta':'media',`Mucha concentración en ${CNAME[top[0]]||top[0]}`,`Tu dinero depende sobre todo de un país. En el índice mundial (MSCI ACWI) EE. UU. pesa en torno al 60–65 %.`,`${pct(top[1],0)} en ${CNAME[top[0]]||top[0]}`,`Viene de: ${by.map(b=>`${b.e.name} ${pct(b.p)}`).join(' · ')}`,'justETF (reparto por países)',asof,[['🌍 Ver en el globo',()=>showExposureGlobe(P,A.name,'geo')],['¿Por qué?',()=>docTab('geo')]])}
  else if(top&&L.ccCover>60)add('ok','Exposición geográfica razonable',`Ningún país supera el 70 % de tu cartera.`,`${CNAME[top[0]]||top[0]} ${pct(top[1],0)}`,`${cs.filter(([,v])=>v>1).length} países por encima del 1 %`,'justETF (reparto por países)',asof,[['¿Por qué?',()=>docTab('geo')]]);
  const em=Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  if(em<5&&L.ccCover>60&&(L.AC.Acciones||0)>50)add('baja','Emergentes poco representados',`Los mercados emergentes son ~10 % del índice mundial; tienes bastante menos.`,`${pct(em)} en emergentes`,`Países emergentes en tu cartera: ${pct(em)} (MSCI ACWI ≈ 10 %)`,'justETF (reparto por países)',asof,[['¿Por qué?',()=>docTab('geo')]]);
  const c1=L.comps[0];if(c1&&SC.top1>8)add(SC.top1>15?'alta':'media',`Mucho peso en ${c1.name}`,`Sumando lo que tienes directamente y lo que va dentro de tus ETFs, una sola empresa pesa mucho.`,`≥ ${pct(SC.top1)} en ${c1.name}`,`Llega a través de: ${c1.by.map(b=>`${b.e.name} ${pct(b.w)}`).join(' · ')}`,'Yahoo Finance / justETF (mayores posiciones)',asof,[['Ver empresas',()=>docTab('comp')]]);
  const ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  if(ss[0]&&ss[0][1]>35){const by=(L.byS[ss[0][0]]||[]).sort((a,b)=>b.p-a.p).slice(0,3);add(ss[0][1]>50?'alta':'media',`Fuerte peso en ${ss[0][0]}`,`Un sector domina tu cartera: si ese sector cae, cae casi todo.`,`${pct(ss[0][1],0)} en ${ss[0][0]}`,`Viene de: ${by.map(b=>`${b.e.name} ${pct(b.p)}`).join(' · ')}`,'Yahoo Finance / justETF (sectores)',asof,[['Ver sectores',()=>docTab('sec')],['🌍 Globo',()=>showExposureGlobe(P,A.name,'sec')]])}
  const funds=P.filter(x=>x.e.k!=='s');const pairs=[];funds.forEach((a,i)=>funds.slice(i+1).forEach(b=>{const o=overlap(a.e,b.e);if(o!=null&&o>20)pairs.push([a,b,o])}));pairs.sort((a,b)=>b[2]-a[2]);A.pairs=pairs;
  pairs.slice(0,2).forEach(([a,b,o])=>{const d=overlapDetail(a.e,b.e);add(o>45?'alta':'media',`Solapamiento entre ${a.e.name} y ${b.e.name}`,`Comparten muchas de las mismas empresas: tenerlos juntos diversifica menos de lo que parece.`,`≥ ${pct(o,0)} en común`,`Empresas compartidas: ${d.rows.slice(0,4).map(r=>r.name).join(', ')}${d.rows.length>4?'…':''}`,'Yahoo Finance / justETF (mayores posiciones)',asof,[['Ver solapamiento',()=>{DOC.pair=[a.e.t,b.e.t];docTab('comp')}]])});
  if(R&&R.M.length>1)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c!=null&&c>.92&&!pairs.some(p=>(p[0].e===a&&p[1].e===b)||(p[0].e===b&&p[1].e===a)))add('media',`${a.name} y ${b.name} se mueven casi igual`,`Su correlación semanal es muy alta: suben y bajan a la vez, así que juntos apenas reducen el riesgo.`,`Correlación ${c.toFixed(2).replace('.',',')}`,`Rentabilidades semanales en euros, ${Math.round(R.weeks/52)} años`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]])}));
  const P0=PROFILES[profile];if(R&&R.vol>P0.etfVol)add('media','Más volátil que tu perfil',`Tu perfil ${P0.label} tolera hasta ~${P0.etfVol} % de volatilidad anual (Ajustes).`,`Volatilidad ${pct(R.vol)}`,`Caída máxima ${pct(R.dd)} · peor año móvil ${pct(R.worst12)}`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]]);
  if(L.ter!=null)add(L.ter>.5?'baja':'ok',L.ter>.5?'Costes altos':'Coste bajo',L.ter>.5?`Un 0,5 % anual de diferencia resta mucho a largo plazo.`:`Tus gastos anuales ponderados son bajos.`,`TER ${pct(L.ter,2)}`,`Media ponderada del TER de cada fondo/ETF${L.terW<.99?` (sin dato en el ${pct((1-L.terW)*100,0)})`:''}`,'Gestoras vía justETF / Yahoo Finance',asof,[]);
  if(SC.avgCorr!=null&&SC.avgCorr<.6&&P.length>1)add('ok','Activos que se complementan',`Tus activos no se mueven igual, lo que amortigua las caídas.`,`Correlación media ${SC.avgCorr.toFixed(2).replace('.',',')}`,`Rentabilidades semanales en euros`,'Yahoo Finance (precios)',pxDate,[['Ver riesgo',()=>docTab('risk')]]);
  if(L.ccCover<70||L.cover<20){const nd=P.filter(x=>expOf(x.e).q.country==='none').map(x=>x.e.name);add('info','Parte de la composición no está publicada',`Lo que no se conoce no se rellena: aparece como «no desglosado» y la concentración real puede ser mayor.`,`Países conocidos ${pct(L.ccCover,0)} · empresas ${pct(L.cover,0)}`,nd.length?`Sin desglose por países: ${nd.join(', ')}`:'Solo se conocen las 10 mayores posiciones de cada ETF','—',asof,[['Ver holdings',()=>docTab('hold')]])}
  const ord={alta:0,media:1,baja:2,info:3,ok:4};return D.sort((a,b)=>ord[a.sev]-ord[b.sev])}

/* ------------------------------ alternativas ------------------------------ */
async function altPortfolios(){const out=[];for(const [pk,name,ico,txt] of [['cons','Conservadora','🛡️','Menor volatilidad'],['mod','Equilibrada','⚖️','Equilibrio riesgo/rentabilidad'],['ag','Crecimiento','🚀','Más exposición a crecimiento']]){const p=buildPlan(pk,basis,'bal');
    const P=p.items.map(x=>({e:ents().find(y=>y.obj===x.e)||entBy('f',x.e.t)||entBy('e',x.e.t),w:x.w})).filter(x=>x.e);const tw=P.reduce((a,x)=>a+x.w,0);P.forEach(x=>x.w/=tw);out.push({pk,name,ico,txt,P})}return out}
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
  const p=(async()=>{const P=src.P,L=lookThrough(P),R=await riskOf(P),SC=docScores(L,R,P);const A={P,L,R,SC,name:src.name,src,asof:(P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||null};A.D=diagnose(A);return A})();
  _AC.set(sig,p);if(_AC.size>12)_AC.delete(_AC.keys().next().value);return p}
async function analyze(){const A=await analyzeSrc(DOC.src);ANA=A;window.ATLAS_DOC=A;return A}

/* ------------------------------ UI helpers ------------------------------ */
function bars(obj,n=8,fmt=k=>k,col=()=>'#7aa2ff',click){const e=Object.entries(obj).filter(([,v])=>v>.05).sort((a,b)=>(a[0]==='XX'||a[0]===UNK)-(b[0]==='XX'||b[0]===UNK)||b[1]-a[1]).slice(0,n);const mx=Math.max(...e.map(x=>x[1]),1);
  return `<div class="ix-bars">${e.map(([k,v])=>`<${click?`button data-${click}="${esc(k)}"`:'div'} class="ix-bar${k==='XX'||k===UNK?' unk':''}"><span>${esc(fmt(k))}</span><i><b style="width:${(v/mx*100).toFixed(1)}%;background:${col(k)}"></b></i><em>${pct(v)}</em></${click?'button':'div'}>`).join('')}</div>`}
const ccol=c=>c==='XX'?SEC_C[UNK]:EM.has(c)?'#9fcf7a':c==='US'?'#7aa2ff':'#b49ae6';
const scol=v=>v==null?'#3a4258':v>=75?'#3ddc84':v>=55?'#e8c66a':'#ff6b7d';
const tk=e=>esc(String(e.tk||e.t).slice(0,6));
function matrix(items,cell,note){if(items.length<2)return '';return `<div class="ix-mat" style="--n:${items.length}"><span></span>${items.map(x=>`<b title="${esc(x.name)}">${tk(x)}</b>`).join('')}${items.map((a,i)=>`<b title="${esc(a.name)}">${tk(a)}</b>`+items.map((b,j)=>cell(a,b,i,j)).join('')).join('')}</div>${note?`<p class="mp-note">${note}</p>`:''}`}

/* ------------------------------ PANEL «ANÁLISIS» (Portfolio) ------------------------------ */
const TABS=[['doctor','Doctor'],['hold','Holdings'],['risk','Riesgo'],['geo','Países'],['comp','Empresas'],['sec','Sectores']];
function docTab(t){DOC.tab=t;saveDoc();if(typeof hubSec!=='undefined'&&hubSec==='doc')renderDoc();else openHub('doc')}
async function renderDoc(){const el=$('#ixdoc');if(!el)return;
  el.innerHTML=`<div class="ix-top"><div class="ix-src"><button data-dsrc="pf" aria-pressed="${DOC.src==='pf'}">★ Mi cartera</button><button data-dsrc="custom" aria-pressed="${DOC.src==='custom'}">✎ Cartera de prueba</button></div>
    ${DOC.src==='custom'?docEditor():''}<nav class="ix-tabs" role="tablist">${TABS.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${DOC.tab===k}">${l}</button>`).join('')}</nav></div><div id="ixdocOut"><div class="ix-load"><i></i>Analizando lo que hay dentro de cada ETF…</div></div>`;
  el.querySelectorAll('[data-dsrc]').forEach(b=>b.onclick=()=>{DOC.src=b.dataset.dsrc;saveDoc();renderDoc()});
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{DOC.tab=b.dataset.tab;saveDoc();el.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b));drawTab()});
  if(DOC.src==='custom')bindEditor(el);
  const out=$('#ixdocOut');if(DOC.src==='pf'&&!PF.length){out.innerHTML=`<div class="ix-empty"><h4>Aún no tienes cartera</h4><p>Añade tus inversiones en «Mi cartera» o prueba el análisis con una cartera de ejemplo.</p><div class="ix-btns"><button class="btn" data-go="pf">★ Crear mi cartera</button><button class="btn2" data-go="ex">Probar con un ejemplo</button></div></div>`;
    out.querySelector('[data-go=pf]').onclick=()=>openHub('pf');out.querySelector('[data-go=ex]').onclick=()=>{loadExample();renderDoc()};return}
  const A=await analyze();if(A.empty){out.innerHTML='<p class="mp-note">Añade al menos un activo con su porcentaje.</p>';return}
  if($('#ixdocOut')!==out)return;drawTab()}
function loadExample(){const pick=t=>{const e=ents().find(x=>x.t===t);return e?{k:e.k,t:e.t}:null};DOC.src='custom';DOC.rows=[['VT',40],['SPY',25],['QQQ',15],['SMH',10],['EEM',10]].map(([t,w])=>{const p=pick(t);return p?{...p,w}:null}).filter(Boolean);saveDoc()}
function drawTab(){const out=$('#ixdocOut'),A=ANA;if(!out||!A||A.empty)return;out.innerHTML=({doctor:tabDoctor,hold:tabHold,risk:tabRisk,geo:tabGeo,comp:tabComp,sec:tabSec})[DOC.tab](A);
  out.querySelectorAll('[data-dx]').forEach(b=>{const [i,j]=b.dataset.dx.split(':').map(Number);b.onclick=()=>A.D[i].acts[j][1]()});
  out.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>({globe:()=>showExposureGlobe(A.P,A.name,'geo'),gcomp:()=>showExposureGlobe(A.P,A.name,'comp'),gsec:()=>showExposureGlobe(A.P,A.name,'sec'),comp:()=>docTab('comp'),why:()=>docTab('comp'),radar:()=>openRadar()})[b.dataset.go]());
  out.querySelectorAll('[data-cty]').forEach(b=>b.onclick=()=>openCountry(b.dataset.cty,CNAME[b.dataset.cty]||b.dataset.cty));
  out.querySelectorAll('[data-secx]').forEach(b=>b.onclick=()=>{const d=b.nextElementSibling;if(d)d.hidden=!d.hidden});
  out.querySelectorAll('[data-pair]').forEach(s=>s.onchange=()=>{DOC.pair=[out.querySelector('[data-pair=a]').value,out.querySelector('[data-pair=b]').value];drawTab()});
  out.querySelectorAll('[data-holdx]').forEach(b=>b.onclick=()=>{const d=b.parentElement.querySelector('.ix-hd');d.hidden=!d.hidden;b.setAttribute('aria-expanded',!d.hidden)});
  if(DOC.tab==='doctor')renderAlts(A)}
/* --- Doctor --- */
function wowBlock(A){const {L,SC,P}=A,nF=L.nFunds,nS=L.nStocks;const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]),ss=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  const maxPair=A.pairs&&A.pairs[0]?A.pairs[0][2]:null;const conc=(cs[0]&&cs[0][1]>65)||(ss[0]&&ss[0][1]>35)||SC.top10>25||(maxPair&&maxPair>25);
  const what=nF?`${nF} ETF${nF>1?'s o fondos':' o fondo'}${nS?` y ${nS} acci${nS>1?'ones':'ón'}`:''}`:`${nS} acci${nS>1?'ones':'ón'}`;
  const msg=P.length<2?(conc?`Tu cartera está concentrada en pocas apuestas.`:`Un solo activo, pero bien repartido por dentro.`):conc?`Tienes ${what}, pero tu cartera está bastante más concentrada de lo que sugiere el número de productos.`:`Tienes ${what} y por dentro están razonablemente repartidos.`;
  return `<section class="ix-wow"><div class="ix-k">Tu exposición real</div>
    <div class="ix-wow3">${cs[0]?`<button data-cty="${cs[0][0]}"><b>${pct(cs[0][1],0)}</b><span>${esc(CNAME[cs[0][0]]||cs[0][0])}</span></button>`:''}${ss[0]?`<button data-go="gsec"><b>${pct(ss[0][1],0)}</b><span>${esc(ss[0][0])}</span></button>`:''}<button data-go="comp"><b>${SC.top10?'≥ '+pct(SC.top10,0):'—'}</b><span>en tus 10 mayores empresas</span></button></div>
    <p class="ix-msg ${conc?'warn':''}">${msg}</p>
    <div class="ix-facts"><div><span>Productos</span><b>${P.length}</b></div><div><span>Empresas distintas</span><b>${L.uniq.hi?`${num(L.uniq.lo)}–${num(L.uniq.hi)}`:`≥ ${num(L.uniq.lo)}`}</b></div><div><span>Equivalen a</span><b>≤ ${SC.neff?num(SC.neff):'—'}</b><small>empresas del mismo peso</small></div><div><span>Mayor solapamiento</span><b>${maxPair!=null?'≥ '+pct(maxPair,0):'—'}</b><small>${maxPair!=null?`${tk(A.pairs[0][0].e)} · ${tk(A.pairs[0][1].e)}`:'entre tus ETFs'}</small></div></div>
    <div class="ix-mini"><div><h6>Top empresas</h6>${L.comps.slice(0,5).map(c=>`<p><span>${esc(c.name)}</span><em>${pct(c.w,1)}</em></p>`).join('')||'<p class="mp-note">Sin datos</p>'}</div><div><h6>Top sectores</h6>${ss.slice(0,3).map(([s,v])=>`<p><span>${esc(s)}</span><em>${pct(v,0)}</em></p>`).join('')}<h6>Top países</h6>${cs.slice(0,3).map(([c,v])=>`<p><span>${esc(CNAME[c]||c)}</span><em>${pct(v,0)}</em></p>`).join('')}</div></div>
    <div class="ix-btns"><button class="btn2" data-go="why">¿Por qué? · Ver solapamientos</button><button class="btn" data-go="globe">🌍 Explorar en el globo</button></div>
    <p class="srcl"><span>Fuente: justETF + Yahoo Finance</span><span>Fecha: ${fdate(A.asof)}</span><span>Tipo: países y sectores ${L.ccCover>95?'reales':'parciales'} · empresas: 10 mayores posiciones (mínimos)</span></p></section>`}
function healthBlock(A){const {SC}=A,h=SC.health,hc=scol(h);
  return `<section class="ix-card"><div class="ix-health"><div class="ix-ring" style="--p:${h||0};--c:${hc}"><b>${h==null?'—':Math.round(h)}</b><span>/100</span></div><div><div class="ix-k">Salud de la cartera</div><p>${h==null?'Sin datos suficientes':h>=75?'Bien construida':h>=55?'Mejorable en algunos puntos':'Tiene problemas importantes'}</p><p class="mp-note">Media simple de ${Object.keys(SC.S).length} componentes${SC.miss.length?` (${SC.miss.length} sin datos)`:''}.</p></div></div>
    <details class="ix-why"${XPT()?' open':''}><summary>¿Por qué ${h==null?'':Math.round(h)}?</summary><div class="ix-scores">${Object.entries(SCORE_DOC).map(([k,[t,q,how,src]])=>{const v=SC.S[k];return `<details class="ix-sc"${XPT()?' open':''}><summary><span>${t}</span><i><b style="width:${v??0}%;background:${scol(v)}"></b></i><em>${v==null?'n/d':Math.round(v)}</em></summary><div class="ix-scd"><p class="q">${q}</p>${v==null?'<p>No calculable con los datos disponibles.</p>':`<ul>${(SC.ev[k]||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}<p class="how"><b>Cálculo:</b> ${how}</p><p class="how"><b>Datos:</b> ${src}</p></div></details>`}).join('')}</div><p class="mp-note">Los umbrales son criterios de ATLAS, no normas del mercado. Metodología completa en docs/METODOLOGIA.md.</p></details></section>`}
function dxBlock(A){return `<section><div class="ix-k">Diagnóstico</div>${A.D.map((d,i)=>{const [ico,lab,c]=SEV[d.sev];return `<article class="ix-dx" style="--c:${c}"><header><span>${ico}</span><b>${esc(d.t)}</b><em>${lab}</em></header><p>${esc(d.exp)}</p><p class="ix-metric">${esc(d.metric)}</p><details${XPT()?' open':''}><summary>Evidencia</summary><p>${esc(d.evid)}</p>${srcl(d.src,d.date)}</details>${d.acts.length?`<div class="ix-btns">${d.acts.map((a,j)=>`<button class="btn2 sm" data-dx="${i}:${j}">${a[0]}</button>`).join('')}</div>`:''}</article>`}).join('')}</section>`}
function tabDoctor(A){return wowBlock(A)+healthBlock(A)+dxBlock(A)+`<section><div class="ix-k">¿Cómo podría mejorarse?</div><div id="ixAlt"><div class="ix-load"><i></i>Calculando alternativas…</div></div></section><p class="ix-src2">${SOURCES} Herramienta de análisis: no es una recomendación de inversión.</p>`}
async function renderAlts(A){const box=$('#ixAlt');if(!box)return;const alts=await altPortfolios(),rows=await Promise.all(alts.map(async a=>{const L=lookThrough(a.P),R=await riskOf(a.P);return{...a,L,R,SC:docScores(L,R,a.P)}}));if(!$('#ixAlt'))return;
  const ts=L=>{const s=Object.entries(L.S).filter(([k])=>k!==UNK&&k!=='Otros').sort((a,b)=>b[1]-a[1])[0];return s?`${s[0]} ${pct(s[1],0)}`:'—'};const em=L=>Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  const met=(o)=>[['Volatilidad',o.R?pct(o.R.vol,0):'—'],['Caída máx.',o.R?pct(o.R.dd,0):'—'],['EE. UU.',pct(o.L.C.US||0,0)],['Emergentes',pct(em(o.L),0)],['1er sector',ts(o.L)],['10 mayores empresas',o.SC.top10?'≥ '+pct(o.SC.top10,0):'—'],['Coste (TER)',o.L.ter==null?'—':pct(o.L.ter,2)]];
  const cur={L:A.L,R:A.R,SC:A.SC};
  $('#ixAlt').innerHTML=`<p class="mp-note">Tres posibles alternativas construidas por ATLAS para distintos niveles de riesgo. Son escenarios para analizar, no carteras que debas comprar.</p>
    <div class="ix-alts">${[{name:'Tu cartera',ico:'★',txt:'Actual',...cur,cur:true},...rows].map((o,i)=>`<article class="ix-alt${o.cur?' cur':''}"><header><b>${o.ico} ${esc(o.name)}</b><small>${esc(o.txt)}</small></header>
      <dl>${met(o).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${o.cur?'':`<p class="ix-to">${esc(tradeoff(cur,o))}</p><p class="ix-comp">${o.P.map(x=>`${tk(x.e)} ${Math.round(x.w*100)} %`).join(' · ')}</p><button class="btn2 sm" data-cmpalt="${i-1}">Comparar con la actual</button>`}</article>`).join('')}</div>
    <p class="mp-note">Rentabilidades y riesgos históricos con los pesos de hoy aplicados hacia atrás (5 años, euros): describen el pasado, no predicen.</p>`;
  $('#ixAlt').querySelectorAll('[data-cmpalt]').forEach(b=>b.onclick=()=>{const a=rows[+b.dataset.cmpalt];openCompare({name:A.name,P:A.P},{name:a.ico+' '+a.name,P:a.P})})}
/* --- Holdings --- */
function tabHold(A){const P=A.P.slice().sort((a,b)=>b.w-a.w);const share=d=>{const s={real:0,proxy:0,partial:0,none:0};P.forEach(x=>s[expOf(x.e).q[d]]+=x.w*100);return s};
  const sum=d=>{const s=share(d);return Object.entries(s).filter(([,v])=>v>.5).map(([q,v])=>`${qb(q)} ${pct(v,0)}`).join(' ')};
  return `<section class="ix-card"><div class="ix-k">Calidad de los datos de tu cartera</div><dl class="ix-ql"><div><dt>Países</dt><dd>${sum('country')}</dd></div><div><dt>Sectores</dt><dd>${sum('sector')}</dd></div><div><dt>Empresas</dt><dd>${sum('companies')}</dd></div></dl>
    <p class="mp-note"><b>DATO REAL</b>: desglose completo publicado. <b>APROXIMACIÓN</b>: tomado del ETF europeo que replica el mismo índice. <b>PARCIAL</b>: solo una parte (p. ej. 10 mayores posiciones); el resto se muestra como «no desglosado», nunca se reparte. <b>SIN DATOS</b>: la fuente no lo publica.</p></section>
    <section>${P.map(({e,w})=>{const x=expOf(e);const und=x.kind==='fund'&&x.hold.length?Math.max(0,100-x.cover):null;return `<article class="ix-ho"><button class="ix-hh" data-holdx aria-expanded="false"><span class="ix-hw">${pct(w*100,1)}</span><span class="ix-hn"><b>${esc(e.name)}</b><small>${tk(e)} · ${e.k==='s'?'Acción':e.k==='f'?'Fondo':'ETF'}${x.n&&e.k!=='s'?` · ${num(x.n)} posiciones`:''}</small></span><span class="ix-hq"><span>Países ${qb(x.q.country)}</span><span>Empresas ${qb(x.q.companies)}</span></span></button>
      <div class="ix-hd" hidden>${x.hold.length&&e.k!=='s'?`<table class="ix-tbl"><thead><tr><th>Empresa</th><th>País</th><th>Peso en el ETF</th><th>En tu cartera</th></tr></thead><tbody>${x.hold.map(h=>`<tr><td>${esc(h.name)}</td><td>${esc(h.cc)}</td><td>${pct(h.w,2)}</td><td>${pct(h.w*w,2)}</td></tr>`).join('')}<tr class="unk"><td colspan="2">No desglosado / datos insuficientes</td><td>${pct(und,1)}</td><td>${pct(und*w,1)}</td></tr></tbody></table>`:e.k==='s'?'<p class="mp-note">Acción individual: 100 % en la propia empresa.</p>':'<p class="mp-note">La fuente no publica sus posiciones.</p>'}
        ${srcl(x.src+(x.proxyIsin?` · aproximación por índice (${x.proxyIsin})`:''),x.asof,e.k==='s'?'Acción':`Países ${QL[x.q.country][0].toLowerCase()} · sectores ${QL[x.q.sector][0].toLowerCase()} · empresas ${QL[x.q.companies][0].toLowerCase()}`)}</div></article>`}).join('')}</section>`}
/* --- Riesgo --- */
function tabRisk(A){const R=A.R;if(!R)return '<p class="mp-note">No hay precios suficientes para calcular el riesgo.</p>';
  const hi=[];if(R.M.length>1)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j>i&&R.M[i][j]!=null)hi.push([a,b,R.M[i][j]])}));hi.sort((x,y)=>y[2]-x[2]);
  return `<section class="ix-card"><div class="ix-k">Riesgo histórico</div><div class="ix-kpi"><div><span>Volatilidad anual</span><b>${pct(R.vol)}</b></div><div><span>Caída máxima</span><b class="dn">${pct(R.dd)}</b></div><div><span>Peor año móvil</span><b class="dn">${pct(R.worst12)}</b></div><div><span>Un mal año (percentil 5)</span><b>${pct(R.p5)}</b></div></div>
    <p class="ix-msg">En los últimos ${Math.round(R.weeks/52)} años, con tu reparto de hoy, la peor caída habría sido de ${pct(Math.abs(R.dd),0)} y en el peor año habrías perdido un ${pct(Math.abs(R.worst12||0),0)}.</p>${srcl('Yahoo Finance (precios semanales en euros)',R.grid[R.grid.length-1],'Histórico, no previsión')}</section>
    <section class="ix-card"><div class="ix-k">Correlación entre tus activos</div>${R.M.length>1?matrix(R.assets,(a,b,i,j)=>{const c=R.M[i][j];return i===j?'<i class="d">1</i>':`<i style="background:${c==null?'transparent':c>0?`rgba(255,169,77,${Math.min(.85,Math.abs(c))})`:`rgba(105,198,217,${Math.min(.85,Math.abs(c))})`}">${c==null?'?':c.toFixed(2).replace('.',',')}</i>`},'1 = se mueven exactamente igual; 0 = sin relación. Por encima de 0,9 apenas diversifican.')+`<h6>Pares más correlacionados</h6>${hi.slice(0,4).map(([a,b,c])=>`<p class="ix-pr"><span>${esc(a.name)} · ${esc(b.name)}</span><em class="${c>.9?'dn':''}">${c.toFixed(2).replace('.',',')}</em></p>`).join('')}`:'<p class="mp-note">Hace falta más de un activo con historial de precios.</p>'}</section>`}
/* --- Países --- */
function tabGeo(A){const L=A.L;const reg={};Object.entries(L.C).forEach(([c,v])=>reg[REGION(c)]=(reg[REGION(c)]||0)+v);
  return `<section class="ix-card"><div class="ix-k">¿Dónde está tu dinero?</div>${bars(L.C,12,c=>CNAME[c]||c,ccol,'cty')}<p class="mp-note">Toca un país para ver qué ETFs y empresas generan esa exposición.</p>
    <h6>Por regiones</h6>${bars(reg,6,r=>r,r=>r==='No desglosado'?SEC_C[UNK]:r==='Emergentes'?'#9fcf7a':r==='Norteamérica'?'#7aa2ff':'#b49ae6')}
    <div class="ix-btns"><button class="btn" data-go="globe">🌍 Ver en el globo</button></div>
    ${srcl('justETF (reparto por países de cada ETF)',A.asof,'País de la empresa según el proveedor del índice — no es dónde factura')}</section>`}
/* --- Empresas y solapamiento --- */
function tabComp(A){const {L,P}=A,funds=P.filter(x=>x.e.k!=='s').map(x=>x.e);const cs=L.comps.slice(0,15),mx=Math.max(...cs.map(c=>c.up||c.w),1);
  let pa=null,pb=null;if(funds.length>1){const pr=DOC.pair||[];pa=funds.find(e=>e.t===pr[0])||(A.pairs&&A.pairs[0]?A.pairs[0][0].e:funds[0]);pb=funds.find(e=>e.t===pr[1]&&e!==pa)||(A.pairs&&A.pairs[0]&&A.pairs[0][0].e===pa?A.pairs[0][1].e:funds.find(e=>e!==pa))}
  const pd=pa&&pb?overlapDetail(pa,pb):null;
  return `<section class="ix-card"><div class="ix-k">¿Qué empresas tienes realmente?</div>
    <div class="ix-cl">${cs.map(c=>`<div class="ix-cr2"><div><b>${esc(c.name)}</b><small>${c.by.map(b=>`${tk(b.e)} ${pct(b.w,1)}`).join(' + ')}${c.dir&&c.dir<c.w?' · directa + indirecta':c.dir?' · directa':' · indirecta'}</small></div><div class="ix-rng"><i><b style="width:${c.w/mx*100}%"></b>${c.up&&c.up>c.w+.05?`<u style="left:${c.w/mx*100}%;width:${(c.up-c.w)/mx*100}%"></u>`:''}</i><em>${c.exact||!(c.up>c.w+.05)?pct(c.w,1):c.up==null?`≥ ${pct(c.w,1)}`:`${num(c.w,1)}–${pct(c.up,1)}`}</em></div></div>`).join('')||'<p class="mp-note">Sin datos de empresas.</p>'}</div>
    <p class="mp-note"><b>Barra sólida</b>: exposición mínima segura (suma de lo publicado). <b>Tramo claro</b>: lo que podría añadirse si la empresa también está en otros ETFs por debajo de sus 10 mayores posiciones. Aproximación: solo se conocen las mayores posiciones.</p>
    ${srcl('Yahoo Finance / justETF (mayores posiciones)',A.asof,'Parcial · exposición estimada con mínimo y máximo')}</section>
    ${funds.length>1?`<section class="ix-card"><div class="ix-k">Solapamiento entre tus ETFs</div>${matrix(funds,(a,b,i,j)=>{if(i===j)return '<i class="d">—</i>';const o=overlap(a,b);return `<i style="background:rgba(255,107,125,${o==null?0:Math.min(.8,o/60)})">${o==null?'?':Math.round(o)+'%'}</i>`},'% de la cartera de un ETF que también está en el otro (mínimo: solo empresas publicadas).')}
      <div class="ix-pair"><select data-pair="a">${funds.map(e=>`<option value="${esc(e.t)}"${e===pa?' selected':''}>${esc(e.name)}</option>`).join('')}</select><span>vs</span><select data-pair="b">${funds.map(e=>`<option value="${esc(e.t)}"${e===pb?' selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
      ${pd?`<p class="ix-msg">${pd.rows.length?`Comparten al menos <b>${pct(pd.o,0)}</b>: ${pd.rows.length} de sus mayores posiciones son las mismas empresas.`:'No comparten ninguna de sus mayores posiciones.'}</p>${pd.rows.length?`<table class="ix-tbl"><thead><tr><th>Empresa</th><th>${tk(pa)}</th><th>${tk(pb)}</th><th>Común</th></tr></thead><tbody>${pd.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${pct(r.a,1)}</td><td>${pct(r.b,1)}</td><td>${pct(r.m,1)}</td></tr>`).join('')}</tbody></table>`:''}`:'<p class="mp-note">Alguno de los dos no publica sus posiciones.</p>'}</section>`:''}
    <div class="ix-btns"><button class="btn" data-go="gcomp">🌍 Ver empresas en el globo</button></div>`}
/* --- Sectores --- */
function tabSec(A){const L=A.L;const ss=Object.entries(L.S).filter(([,v])=>v>.05).sort((a,b)=>(a[0]===UNK)-(b[0]===UNK)||b[1]-a[1]);const mx=Math.max(...ss.map(x=>x[1]),1);
  return `<section class="ix-card"><div class="ix-k">¿A qué sectores estás expuesto?</div>${ss.map(([s,v])=>`<button class="ix-bar${s===UNK?' unk':''}" data-secx><span>${esc(s)}</span><i><b style="width:${v/mx*100}%;background:${SEC_C[s]||'#7aa2ff'}"></b></i><em>${pct(v)}</em></button><div class="ix-sub" hidden>${(L.byS[s]||[]).sort((a,b)=>b.p-a.p).map(b=>`<p><span>${esc(b.e.name)}</span><em>${pct(b.p,1)}</em></p>`).join('')}</div>`).join('')}
    <p class="mp-note">Toca un sector para ver qué ETFs lo generan.</p><div class="ix-btns"><button class="btn" data-go="gsec">🌍 Sectores en el globo</button></div>${srcl('Yahoo Finance / justETF (reparto sectorial de cada ETF)',A.asof,'Real cuando el ETF publica todo su reparto')}</section>`}
/* --- editor de cartera de prueba --- */
function docEditor(){const rows=DOC.rows&&DOC.rows.length?DOC.rows:[{k:'',t:'',w:''}];const tot=rows.reduce((a,r)=>a+(+r.w||0),0);
  return `<div class="ix-ed">${rows.map((r,i)=>{const e=r.k?entBy(r.k,r.t):null;return `<div class="ix-row"><input list="ixList" data-ri="${i}" placeholder="Ticker o nombre (VWCE, SPY, QQQ…)" value="${e?esc(e.tk+' · '+e.name):''}"><input type="number" min="0" step="1" inputmode="decimal" data-rw="${i}" value="${r.w}" placeholder="%"><em>%</em><button data-rx="${i}" aria-label="Quitar">✕</button></div>`}).join('')}
    <datalist id="ixList">${ents().filter(x=>x.k!=='s').concat(ents().filter(x=>x.k==='s')).map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    <div class="ix-edb"><button class="btn2 sm" data-radd>＋ Añadir</button><button class="btn2 sm" data-rex>Ejemplo</button><span class="${Math.abs(tot-100)>.5&&tot?'bad':''}">Total ${Math.round(tot)} %${Math.abs(tot-100)>.5&&tot?' · se reescala a 100':''}</span></div></div>`}
function bindEditor(el){const find=v=>{const tk=v.split(' · ')[0].trim().toUpperCase();return ents().find(x=>`${x.tk} · ${x.name}`===v)||ents().find(x=>String(x.tk).toUpperCase()===tk&&x.k!=='s')||ents().find(x=>String(x.tk).toUpperCase()===tk)||ents().find(x=>x.t.toUpperCase()===tk)};
  if(!DOC.rows||!DOC.rows.length)DOC.rows=[{k:'',t:'',w:''}];
  el.querySelectorAll('[data-ri]').forEach(i=>i.onchange=()=>{const e=find(i.value);const r=DOC.rows[+i.dataset.ri];if(e){r.k=e.k;r.t=e.t}else{r.k='';r.t=''}saveDoc();renderDoc()});
  el.querySelectorAll('[data-rw]').forEach(i=>i.onchange=()=>{DOC.rows[+i.dataset.rw].w=+i.value||0;saveDoc();renderDoc()});
  el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{DOC.rows.splice(+b.dataset.rx,1);saveDoc();renderDoc()});
  el.querySelector('[data-radd]').onclick=()=>{DOC.rows.push({k:'',t:'',w:''});saveDoc();renderDoc()};
  el.querySelector('[data-rex]').onclick=()=>{loadExample();renderDoc()}}

/* ------------------------------ OPPORTUNITY RADAR ------------------------------ */
const RW_DEF={val:20,mom:20,trend:10,risk:15,div:20,grow:15};
let RW=(()=>{try{return {...RW_DEF,...JSON.parse(localStorage.getItem('atlas_rw')||'{}')}}catch(_){return{...RW_DEF}}})();
let RF={region:'',country:'',sector:'',cat:'',risk:'',ac:'',min:0,hz:'6m',sort:'score',etf:''};
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
function scoreRadar(base){const L=base.list,hz=RF.hz,mk=x=>hz==='1m'?x.r.r1m:hz==='1y'?x.r.r1y:x.r.r6m;
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
async function renderRadar(){const el=$('#ixradar');if(!el)return;el.innerHTML='<p class="mp-note">Escaneando…</p>';if(!RANK&&typeof loadRank==='function')await loadRank();
  _radarBase=await radarCandidates();drawRadar()}
function drawRadar(){const el=$('#ixradar');if(!el||!_radarBase)return;let L=scoreRadar(_radarBase);
  const opts=(k,arr,lab)=>`<label><span>${lab}</span><select data-rf="${k}"><option value="">Todos</option>${[...new Set(arr.filter(Boolean))].sort().map(v=>`<option${RF[k]===v?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  const regions=L.map(x=>x.dom?REGION(x.dom):null);
  const F=L.filter(x=>(!RF.region||(RF.region==='ex-US'?x.dom&&x.dom!=='US':REGION(x.dom||'XX')===RF.region))&&(!RF.country||(CNAME[x.dom]||x.dom)===RF.country)&&(!RF.sector||x.sec===RF.sector)&&(!RF.cat||x.cats.includes(RF.cat))&&(!RF.ac||x.ac===RF.ac)
    &&(!RF.risk||(RF.risk==='Bajo'?(x.c.risk??0)>=66:RF.risk==='Medio'?(x.c.risk??0)>=33&&(x.c.risk??0)<66:(x.c.risk??100)<33))&&(x.score??0)>=RF.min&&(!RF.etf||(x.e.name+' '+x.e.tk).toLowerCase().includes(RF.etf.toLowerCase())));
  const key={score:x=>x.score,perf:x=>RF.hz==='1m'?x.r.r1m:RF.hz==='1y'?x.r.r1y:x.r.r6m,risk:x=>x.c.risk,val:x=>x.c.val,mom:x=>x.c.mom,div:x=>x.c.div}[RF.sort];F.sort((a,b)=>(key(b)??-1)-(key(a)??-1));
  el.innerHTML=`<p class="pf-lead">ATLAS escanea ${L.length} ETFs y destaca los que merecen <b>atención</b> por valoración, momentum, tendencia, riesgo, diversificación y crecimiento. <b>Oportunidad no es recomendación</b>: es un punto de partida para investigar.</p>
    <details class="ix-w" id="ixFilt"${drawRadar.fo?' open':''}><summary>🔎 Filtros y orden${(()=>{const n=['region','country','sector','cat','risk','ac','etf'].filter(k=>RF[k]).length+(RF.min?1:0);return n?` · ${n} activo${n>1?'s':''}`:''})()} · horizonte ${({'1m':'1 mes','6m':'6 meses','1y':'1 año'})[RF.hz]}</summary><div class="ix-filt">${opts('region',regions.concat(['ex-US']),'Región')}${opts('country',L.map(x=>x.dom?CNAME[x.dom]||x.dom:null),'País')}${opts('sector',L.map(x=>x.sec),'Sector')}${opts('cat',RCATS,'Categoría')}
      <label><span>Riesgo</span><select data-rf="risk"><option value="">Todos</option>${['Bajo','Medio','Alto'].map(v=>`<option${RF.risk===v?' selected':''}>${v}</option>`).join('')}</select></label>${opts('ac',L.map(x=>x.ac),'Clase de activo')}
      <label><span>Horizonte</span><select data-rf="hz">${[['1m','Corto (1 mes)'],['6m','Medio (6 meses)'],['1y','Largo (1 año)']].map(([v,l])=>`<option value="${v}"${RF.hz===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <label><span>Score mínimo</span><input type="number" min="0" max="100" step="5" data-rf="min" value="${RF.min}"></label><label class="w2"><span>ETF</span><input data-rf="etf" placeholder="Nombre o ticker" value="${esc(RF.etf)}"></label>
      <label class="w2"><span>Ordenar por</span><select data-rf="sort">${[['score','ATLAS Score'],['perf','Rendimiento'],['risk','Riesgo (menor primero)'],['val','Valoración'],['mom','Momentum'],['div','Diversificación']].map(([v,l])=>`<option value="${v}"${RF.sort===v?' selected':''}>${l}</option>`).join('')}</select></label></div></details>
    <details class="ix-w"><summary>⚖️ Pesos del ATLAS Score (configurables)</summary><div class="ix-wg">${Object.entries(RW).map(([k,v])=>`<label><span>${RCOMP[k][0]}</span><input type="range" min="0" max="40" step="5" value="${v}" data-rw="${k}"><em>${v}</em></label>`).join('')}</div>
      <p class="mp-note">Por defecto: valoración 20, momentum 20, diversificación 20, riesgo 15, crecimiento 15, tendencia 10. Reparto neutro elegido para que ningún factor domine; la tendencia pesa menos porque se solapa con el momentum. El score es la media ponderada de los componentes disponibles (0–100).</p><button class="btn2" data-rwr>Restablecer</button></details>
    <div class="ix-meta">🎯 ${F.length} oportunidades · diversificación medida frente a ${esc(_radarBase.refName)} · datos ${RANK_U?relWhen(RANK_U):''}</div>
    <div class="ix-ops">${F.slice(0,40).map((o,i)=>radarCard(o,i)).join('')||'<p class="mp-note">Nada con esos filtros.</p>'}</div>
    <p class="ix-src2">${SOURCES} Rentabilidades, volatilidad, tendencia y caídas: rankings diarios de ATLAS (precios de Yahoo Finance).</p>`;
  const fd=el.querySelector('#ixFilt');if(fd)fd.ontoggle=()=>drawRadar.fo=fd.open;
  el.querySelectorAll('[data-rf]').forEach(i=>i.onchange=()=>{RF[i.dataset.rf]=i.type==='number'?+i.value||0:i.value;drawRadar()});
  el.querySelectorAll('[data-rw]').forEach(i=>i.oninput=()=>{RW[i.dataset.rw]=+i.value;i.nextElementSibling.textContent=i.value;try{localStorage.setItem('atlas_rw',JSON.stringify(RW))}catch(_){}clearTimeout(drawRadar.t);drawRadar.t=setTimeout(drawRadar,300)});
  const rr=el.querySelector('[data-rwr]');if(rr)rr.onclick=()=>{RW={...RW_DEF};try{localStorage.removeItem('atlas_rw')}catch(_){}drawRadar()};
  el.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const card=b.closest('.ix-op');const d=card.querySelector('.ix-opd');if(!d.hidden){d.hidden=true;return}const o=F.find(x=>x.e.t===b.dataset.op);d.innerHTML=radarDetail(o);d.hidden=false;bindDetail(d,o)})}
function radarCard(o,i){const s=o.score==null?null:Math.round(o.score),c=s>=70?'#4cd8a0':s>=50?'#ffd24a':'#ff9a3c',r=RF.hz==='1m'?o.r.r1m:RF.hz==='1y'?o.r.r1y:o.r.r6m;
  return `<div class="ix-op"><button class="ix-oph" data-op="${esc(o.e.t)}"><span class="ix-sc2" style="--c:${c}">${s??'—'}</span><span class="ix-opn"><b>${esc(o.e.name)}</b><small>${esc(o.e.tk)} · ${o.sec?esc(o.sec):'—'} · ${o.dom?esc(CNAME[o.dom]||o.dom):'—'}</small><span class="ix-tags">${o.cats.slice(0,3).map(t=>`<em>${t}</em>`).join('')}</span></span>
    <span class="ix-opr"><b class="${(r??0)<0?'dn':'up'}">${r==null?'—':(r>0?'+':'')+pct(r,0)}</b><small>${({'1m':'1 mes','6m':'6 meses','1y':'1 año'})[RF.hz]}</small><small>σ ${pct(o.r.vol,0)}</small></span></button><div class="ix-opd" hidden></div></div>`}
function radarDetail(o){const tr=o.r.tr200==null?'—':o.r.tr200>0?`▲ ${pct(o.r.tr200,0)} sobre su media de 200 sesiones`:`▼ ${pct(-o.r.tr200,0)} bajo su media de 200 sesiones`;
  return `<div class="ix-note"><b>Por qué ATLAS cree que merece atención</b><p>${esc(whyText(o))}${o.cats.length?' Categorías: '+o.cats.join(', ')+'.':''}</p></div>
    <div class="ix-scoreb"><div class="ix-big">${o.score==null?'—':Math.round(o.score)}<small>/100 ATLAS Score</small></div>${Object.entries(RCOMP).map(([k,[n]])=>`<div class="ix-bar"><span>${n}</span><i><b style="width:${o.c[k]??0}%;background:${o.c[k]==null?'#3a4258':'linear-gradient(90deg,#35e0ff,#4cd8a0)'}"></b></i><em>${o.c[k]==null?'n/d':Math.round(o.c[k])}</em></div>`).join('')}</div>
    <div class="ix-kpi"><div><span>Rent. 1 mes / 6 m / 1 año</span><b>${pct(o.r.r1m,0)} / ${pct(o.r.r6m,0)} / ${pct(o.r.r1y,0)}</b></div><div><span>Volatilidad 1 año</span><b>${pct(o.r.vol,0)}</b></div><div><span>P/E cartera</span><b>${o.pe?o.pe.toFixed(1).replace('.',','):'n/d'}</b></div><div><span>Tendencia</span><b>${tr}</b></div><div><span>Confianza</span><b>${o.conf} (${o.nC}/6 datos)</b></div><div><span>Solapamiento con tu cartera</span><b>${pct(o.ov,0)}</b></div></div>
    <details class="ix-how"><summary>📐 Cómo se ha calculado</summary>${Object.entries(RCOMP).map(([k,[n,how]])=>`<p><b>${n} (${o.c[k]==null?'sin dato':Math.round(o.c[k])}, peso ${RW[k]}):</b> ${how}</p>`).join('')}<p><b>Confianza:</b> Alta con los 6 componentes, Media con 4–5, Baja con 3 o menos.</p><p><b>Datos:</b> rankings de ${RANK_U?relWhen(RANK_U):'—'} · composición ${esc(o.x.asof||'—')} (${esc(o.x.qTxt)}).</p></details>
    <div class="ix-btns"><button class="btn" data-a="cmp">⚖️ Comparar con mi cartera</button><button class="btn2" data-a="globe">🌍 Ver en el globo</button><button class="btn2" data-a="fic">Ficha</button></div>`}
function bindDetail(d,o){d.querySelector('[data-a=cmp]').onclick=async()=>{const cur=await docPortfolio();if(!cur.P.length){openCompare({name:o.e.name,P:[{e:o.e,w:1}]},null);return}
    CMP.addW=CMP.addW||.1;openCompare({name:cur.name,P:cur.P},withAdd(cur,o.e,CMP.addW),{cur,e:o.e})};
  d.querySelector('[data-a=globe]').onclick=()=>showExposureGlobe([{e:o.e,w:1}],o.e.name);d.querySelector('[data-a=fic]').onclick=()=>openDetail(o.e.k,o.e.t,o.e.node)}
function openRadar(f){if(f){RF={...RF,region:'',country:'',sector:'',cat:'',...f}}openHub('radar')}

/* ------------------------------ COMPARAR ------------------------------ */
let CMP={A:null,B:null,add:null,addW:.1};
function withAdd(cur,e,add){const P2=cur.P.map(x=>({e:x.e,w:x.w*(1-add)}));const ex=P2.find(x=>x.e===e);if(ex)ex.w+=add;else P2.push({e,w:add});return{name:`${cur.name} + ${Math.round(add*100)} % ${e.tk}`,P:P2}}
function openCompare(A,B,add){CMP={A,B,add:add||null,addW:CMP.addW||.1};openHub('cmp')}
async function renderCompare(){const el=$('#ixcmp');if(!el)return;await loadExpo();if(!CMP.A){const cur=await docPortfolio();CMP.A=cur.P.length?{name:cur.name,P:cur.P}:null}
  const pick=(id,cur)=>`<div class="ix-pk"><span>${id}</span><input list="ixCmpList" data-pk="${id}" placeholder="Elige cartera o ETF" value="${cur?esc(cur.name):''}"></div>`;
  const alts=await altPortfolios();const choices=[['Mi cartera',null],['Cartera de prueba',null],...alts.map(a=>[a.ico+' '+a.name,a])];
  el.innerHTML=`<p class="pf-lead">Compara dos carteras o dos ETFs: características, riesgo, exposición, concentración, correlación y costes.</p>
    <div class="ix-pks">${pick('A',CMP.A)}<b>vs</b>${pick('B',CMP.B)}</div><datalist id="ixCmpList">${choices.map(([n])=>`<option value="${esc(n)}">`).join('')}${ents().filter(x=>x.k!=='s').map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    ${CMP.add?`<label class="ix-addw">Peso de ${esc(String(CMP.add.e.tk))} en la cartera B <select data-addw>${[.05,.1,.2,.3].map(v=>`<option value="${v}"${Math.abs(v-CMP.addW)<1e-9?' selected':''}>${v*100} %</option>`).join('')}</select><small>el resto se reduce en proporción</small></label>`:''}<div id="ixCmpOut">${CMP.A&&CMP.B?'<p class="mp-note">Comparando…</p>':'<p class="mp-note">Elige qué comparar en A y B.</p>'}</div>`;
  el.querySelectorAll('[data-pk]').forEach(i=>i.onchange=async()=>{const v=i.value;let s=null;
    if(v==='Mi cartera'){const c=(DOC.src='pf',await docPortfolio());s=c.P.length?{name:'Mi cartera',P:c.P}:null}else if(v==='Cartera de prueba'){const keep=DOC.src;DOC.src='custom';const c=await docPortfolio();DOC.src=keep;s=c.P.length?{name:v,P:c.P}:null}
    else{const a=alts.find(x=>x.ico+' '+x.name===v);if(a)s={name:v,P:a.P};else{const tk=v.split(' · ')[0].trim().toUpperCase();const e=ents().find(x=>`${x.tk} · ${x.name}`===v)||ents().find(x=>String(x.tk).toUpperCase()===tk&&x.k!=='s')||ents().find(x=>String(x.tk).toUpperCase()===tk);if(e)s={name:e.name,P:[{e,w:1}]}}}
    CMP[i.dataset.pk]=s;CMP.add=null;renderCompare()});
  const aw=el.querySelector('[data-addw]');if(aw)aw.onchange=()=>{CMP.addW=+aw.value;CMP.B=withAdd(CMP.add.cur,CMP.add.e,CMP.addW);renderCompare()};
  if(!(CMP.A&&CMP.B))return;
  const [LA,LB]=[lookThrough(CMP.A.P),lookThrough(CMP.B.P)],[RA,RB]=await Promise.all([riskOf(CMP.A.P),riskOf(CMP.B.P)]);const SA=docScores(LA,RA,CMP.A.P),SB=docScores(LB,RB,CMP.B.P);
  let ab=null;if(RA&&RB){const pa=RA.pr,pb=RB.pr;ab=corr(pa,pb)}
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
      ${row('Empresas equivalentes (máx.)',SA.neff,SB.neff,v=>v==null?'—':Math.round(v))}${row('10 mayores empresas',SA.top10,SB.top10,v=>pct(v,0),1)}${row('EE. UU.',LA.C.US||0,LB.C.US||0,v=>pct(v,0),1)}${row('Emergentes',em(LA),em(LB),v=>pct(v,0))}${row('Coste (TER)',LA.ter,LB.ter,v=>v==null?'—':pct(v,2),1)}</div>
    ${ab!=null?`<p class="pf-vs">🔗 Correlación entre A y B: <b>${ab.toFixed(2).replace('.',',')}</b> ${ab>.9?'(se mueven casi igual)':ab>.7?'(bastante parecidas)':'(se comportan de forma distinta)'}</p>`:''}
    <h5>Cambio de exposición por país (A → B)</h5>${diff(LA.C,LB.C,c=>CNAME[c]||c)}<h5>Cambio por sector (A → B)</h5>${diff(LA.S,LB.S,s=>s)}
    <div class="ix-btns"><button class="btn2" data-g="A">🌍 Globo de A</button><button class="btn2" data-g="B">🌍 Globo de B</button></div>
    <p class="mp-note">Verde = mejor en esa fila (menor en volatilidad, concentración, EE. UU. y costes; mayor en el resto). Riesgo y rentabilidad: precios semanales en euros de los últimos 5 años con los pesos de hoy. Composición: mayores posiciones conocidas de cada ETF.</p>`;
  $('#ixCmpOut').querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const s=CMP[b.dataset.g];showExposureGlobe(s.P,s.name)})}


/* ------------------------------ 4 · GLOBO 2.0 ------------------------------ */
/* Modos: geo («¿Dónde está mi dinero?»: vista «idx» = país de la empresa según el índice; vista «hq» = sedes reales de las
   empresas identificadas; ingresos por país = sin datos), comp (empresas en su sede), sec (sectores). */
let GEO=null,XP=null,xpMode='geo',xpView='idx';
async function loadCountries(){if(GEO)return GEO;GEO=await (await fetch('data/countries.geojson')).json();return GEO}
const ctrOf=c=>{const f=GEO&&GEO.features.find(x=>x.properties.c===c);return f?[f.properties.lx,f.properties.ly]:null};
function hqOf(c){const e=ents().find(x=>x.k==='s'&&(x.t===c.tk||ckey(x.name,x.t)===c.key));const g=e&&entGeo(e);return g?{ll:[g[1],g[0]],exact:true,addr:g[2]}:(()=>{const p=ctrOf(c.cc);return p?{ll:p,exact:false}:null})()}
async function showExposureGlobe(P,name,mode){await loadExpo();if(typeof map==='undefined'||!map||!mapReady){toast('El mapa aún se está cargando');return}closeHub();if(typeof closePlace==='function')closePlace();
  if(mode)xpMode=mode;XP={P,name,L:lookThrough(P),sec:null};await loadCountries();drawExposure();renderXpBar();ovHide(true);
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
    m.addLayer({id:'xp-fill',type:'fill',source:'xp-cty',paint:{'fill-color':['interpolate',['linear'],['get','r'],0,'rgba(40,50,90,0.05)',0.001,'#1d3566',0.05,'#2a62a3',0.25,'#3aa6cf',0.6,'#7fdcc0',1,'#f1dc84'],'fill-opacity':['case',['>',['get','v'],0],0.62,0.06]}});
    m.addLayer({id:'xp-line',type:'line',source:'xp-cty',paint:{'line-color':'rgba(200,220,255,0.3)','line-width':0.6}});
    m.addSource('xp-pts',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'xp-circ',type:'circle',source:'xp-pts',paint:{'circle-radius':['interpolate',['linear'],['get','w'],0,3,1,6,5,13,15,24],'circle-color':['get','c'],'circle-opacity':.8,'circle-stroke-color':['case',['get','x'],'#ffffff','rgba(255,255,255,.35)'],'circle-stroke-width':['case',['get','x'],1,.6]}});
    m.addLayer({id:'xp-lbl',type:'symbol',source:'xp-pts',layout:{'text-field':['get','l'],'text-size':11,'text-offset':[0,1.6],'text-allow-overlap':false},paint:{'text-color':'#e9f0ff','text-halo-color':'#05060f','text-halo-width':1.4}});
    m.on('click','xp-fill',ev=>{if(!XP||xpMode!=='geo')return;const f=ev.features&&ev.features[0];if(f)openCountry(f.properties.c,CNAME[f.properties.c]||f.properties.n)});
    m.on('click','xp-circ',ev=>{const f=ev.features&&ev.features[0];if(f&&f.properties.cc)openCountry(f.properties.cc,CNAME[f.properties.cc]||f.properties.cc)});
    m.on('mouseenter','xp-fill',()=>m.getCanvas().style.cursor='pointer');m.on('mouseleave','xp-fill',()=>m.getCanvas().style.cursor='')}
  else m.getSource('xp-cty').setData(fc);
  ['xp-fill','xp-line','xp-circ','xp-lbl'].forEach(id=>m.setLayoutProperty(id,'visibility','visible'));m.setLayoutProperty('xp-fill','visibility',xpMode==='geo'?'visible':'none');
  const pts=[];if(xpMode!=='geo'){L.comps.slice(0,80).forEach(c=>{if(xpMode==='sec'&&XP.sec&&c.sec!==XP.sec)return;const h=hqOf(c);if(!h)return;
      pts.push({type:'Feature',geometry:{type:'Point',coordinates:h.ll},properties:{w:c.w,l:c.name.split(' ').slice(0,2).join(' ')+' '+pct(c.w),c:SEC_C[c.sec]||'#b49ae6',cc:c.cc,x:h.exact}})})}
  m.getSource('xp-pts').setData({type:'FeatureCollection',features:pts})}
function renderXpBar(){let b=$('#xpbar');if(!XP){if(b)b.remove();return}if(!b){b=document.createElement('div');b.id='xpbar';document.body.appendChild(b)}
  const L=XP.L,vals=xpMode==='geo'&&xpView==='hq'?hqShare(L):L.C,top=Object.entries(vals).filter(([c,v])=>c!=='XX'&&c!=='_known'&&v>=.5).sort((a,b)=>b[1]-a[1]).slice(0,6),secs=Object.entries(L.S).filter(([s])=>s!==UNK&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  const Q={geo:'¿Dónde está mi dinero?',comp:'¿Qué empresas tengo realmente?',sec:'¿A qué sectores estoy expuesto?'};
  b.innerHTML=`<div class="xp-h"><div><small>${esc(XP.name)}</small><b>${Q[xpMode]}</b></div><button data-xpx aria-label="Cerrar">✕</button></div>
    <div class="xp-seg">${[['geo','Geografía'],['comp','Empresas'],['sec','Sectores']].map(([k,l])=>`<button data-xpm="${k}" aria-pressed="${xpMode===k}">${l}</button>`).join('')}</div>
    ${xpMode==='geo'?`<div class="xp-view">${[['idx','Exposición de cartera'],['hq','Sedes de empresas']].map(([k,l])=>`<button data-xpv="${k}" aria-pressed="${xpView===k}">${l}</button>`).join('')}<button disabled title="Requiere datos de ingresos por país de cada empresa: no disponibles">Ingresos · sin datos</button></div>
      <div class="xp-top">${top.map(([c,v])=>`<button data-cty="${c}"><span>${esc(CNAME[c]||c)}</span><b>${pct(v,0)}</b></button>`).join('')}</div>
      <p class="xp-n">${xpView==='idx'?`País de cada empresa según el proveedor del índice (justETF). No es dónde factura.${L.C.XX?` ${pct(L.C.XX,0)} no desglosado.`:''}`:`País de la dirección real de la sede. Solo empresas con sede localizada en ATLAS: ${pct(vals._known,0)} de la cartera (de ${pct(L.cover,0)} identificado).`} Toca un país.</p>`:''}
    ${xpMode==='sec'?`<div class="xp-top">${secs.slice(0,8).map(([s,v])=>`<button data-sec="${esc(s)}" class="${XP.sec===s?'on':''}" style="--c:${SEC_C[s]||'#7aa2ff'}"><span>${esc(s)}</span><b>${pct(v,0)}</b></button>`).join('')}</div><p class="xp-n">${XP.sec?`Empresas de ${esc(XP.sec)} en su sede. Viene de: ${(L.byS[XP.sec]||[]).sort((a,b)=>b.p-a.p).slice(0,3).map(x=>`${tk(x.e)} ${pct(x.p,0)}`).join(' · ')}`:'Elige un sector para ver sus empresas en el mapa.'}</p>`:''}
    ${xpMode==='comp'?`<ol class="xp-list">${L.comps.slice(0,6).map(c=>`<li><span>${esc(c.name)}</span><b>${pct(c.w,1)}</b></li>`).join('')}</ol><p class="xp-n">Burbujas en la sede real (borde blanco) o en el centro del país si no hay dirección. Tamaño = peso mínimo en tu cartera.</p>`:''}
    <p class="xp-s">justETF + Yahoo Finance · ${fdate((XP.P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop()))}</p>`;
  b.querySelector('[data-xpx]').onclick=()=>hideExposure();
  b.querySelectorAll('[data-xpm]').forEach(x=>x.onclick=()=>{xpMode=x.dataset.xpm;XP.sec=null;drawExposure();renderXpBar()});
  b.querySelectorAll('[data-xpv]').forEach(x=>x.onclick=()=>{xpView=x.dataset.xpv;drawExposure();renderXpBar()});
  b.querySelectorAll('[data-cty]').forEach(x=>x.onclick=()=>openCountry(x.dataset.cty,CNAME[x.dataset.cty]||x.dataset.cty));
  b.querySelectorAll('[data-sec]').forEach(x=>x.onclick=()=>{XP.sec=XP.sec===x.dataset.sec?null:x.dataset.sec;drawExposure();renderXpBar()})}
function hideExposure(){XP=null;const m=map;['xp-fill','xp-line','xp-circ','xp-lbl'].forEach(id=>{if(m&&m.getLayer(id))m.setLayoutProperty(id,'visibility','none')});if(m&&m.getSource('xp-pts'))m.getSource('xp-pts').setData({type:'FeatureCollection',features:[]});renderXpBar();ovShow()}

/* ------------------------------ PAÍS: «¿Cómo estoy expuesto a este país?» ------------------------------ */
let CTY=null,ctyTab='etf';
const CTY_ETF={US:'SPY',JP:'EWJ',IN:'INDA',CN:'MCHI',GB:'VGK',FR:'VGK',DE:'VGK',CH:'VGK',NL:'VGK',ES:'VGK',IT:'VGK',SE:'VGK',DK:'VGK',TW:'EEM',KR:'EEM',BR:'EEM'};
function openCountry(c,n){CTY={c,n};ctyTab='etf';openHub('cty')}
async function renderCountry(){const el=$('#ixcty');if(!el||!CTY)return;let X=XP;if(!X){const A=await analyze();X=A&&!A.empty?{P:A.P,name:A.name,L:A.L}:null}
  if(!X){el.innerHTML='<p class="mp-note">Primero crea o elige una cartera en «Análisis».</p>';return}
  const L=X.L,c=CTY.c,tot=L.C[c]||0,dir=L.dir[c]||0,ind=L.ind[c]||0,nm=CTY.n||CNAME[c]||c;
  const by=(L.byC[c]||[]).filter(b=>b.p>.005).sort((a,b)=>b.p-a.p),comps=L.comps.filter(x=>x.cc===c),secs={};comps.forEach(x=>secs[x.sec||UNK]=(secs[x.sec||UNK]||0)+x.w);
  const pe=CTY_ETF[c]?ents().find(x=>x.t===CTY_ETF[c]):null,rk=pe&&RANK?RANK[priceKey(pe.k,pe.obj)]:null;const asof=(X.P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop());
  el.innerHTML=`<div class="ix-cty"><div class="ix-k">¿Cómo estoy expuesto a ${esc(nm)}?</div><div class="ix-big">${pct(tot)}<small>de ${esc(X.name)}</small></div>
    <div class="ix-split"><div style="flex:${dir||.0001}"><span>Directa</span><b>${pct(dir)}</b></div><div style="flex:${ind||.0001}"><span>Indirecta (ETFs y fondos)</span><b>${pct(ind)}</b></div></div>
    <nav class="ix-tabs">${[['etf','ETFs'],['comp','Empresas'],['sec','Sectores']].map(([k,l])=>`<button data-ct="${k}" aria-selected="${ctyTab===k}">${l}</button>`).join('')}</nav>
    <div class="ix-ctb">${ctyTab==='etf'?(by.length?by.map(b=>`<div class="ix-bar"><span>${esc(b.e.name)}</span><i><b style="width:${tot?b.p/tot*100:0}%;background:#7aa2ff"></b></i><em>${pct(b.p,2)}</em></div>`).join('')+`<p class="mp-note">Suma de (peso del activo en tu cartera × % del activo en ${esc(nm)}).</p>`:'<p class="mp-note">Ningún activo tuyo tiene exposición publicada a este país.</p>')
      :ctyTab==='comp'?(comps.length?comps.slice(0,15).map(x=>`<div class="ix-bar"><span>${esc(x.name)}</span><i><b style="width:${tot?x.w/tot*100:0}%;background:${SEC_C[x.sec]||'#b49ae6'}"></b></i><em>${pct(x.w,2)}</em></div>`).join('')+`<p class="mp-note">Solo las empresas identificadas (10 mayores posiciones de cada ETF): explican ${pct(comps.reduce((a,x)=>a+x.w,0),1)} de los ${pct(tot,1)}. El resto no está desglosado.</p>`:'<p class="mp-note">Ninguna de las empresas identificadas es de este país.</p>')
      :(comps.length?bars(secs,8,s=>s,s=>SEC_C[s]||'#7aa2ff')+'<p class="mp-note">Sectores de las empresas identificadas de este país (parcial).</p>':'<p class="mp-note">Sin empresas identificadas para desglosar por sector.</p>')}</div>
    <div class="ix-k">Comportamiento del mercado</div>${rk?`<div class="ix-kpi"><div><span>1 año</span><b>${pct(rk.r1y,1)}</b></div><div><span>3 años, anual</span><b>${pct(rk.r3y,1)}</b></div><div><span>Volatilidad</span><b>${pct(rk.vol,0)}</b></div><div><span>Caída máx. 1 año</span><b>${pct(rk.dd1y,0)}</b></div></div><p class="mp-note">Referencia: ${esc(pe.name)}${['VGK','EEM'].includes(CTY_ETF[c])?' (región, no solo el país)':''}.</p>`:'<p class="mp-note">ATLAS no tiene un ETF de referencia para este país: sin datos históricos.</p>'}
    ${srcl('justETF (países) + Yahoo Finance (posiciones, precios)',asof,'País de la empresa según el índice')}</div>`;
  el.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{ctyTab=b.dataset.ct;renderCountry()});
  const h=document.querySelector('.right .phead h2 .sp');if(h)h.textContent='🌍 '+nm}

/* ------------------------------ 5 · RESUMEN (Overview) sobre el globo ------------------------------ */
let OV={collapsed:(()=>{try{return localStorage.getItem('atlas_ov')==='0'}catch(_){return false}})(),hidden:false};
function ovEl(){let b=$('#ovcard');if(!b){b=document.createElement('section');b.id='ovcard';document.body.appendChild(b)}return b}
function ovHide(soft){OV.hidden=true;const b=$('#ovcard');if(b)b.hidden=true}
function ovShow(){OV.hidden=false;if(!XP)renderOverview()}
async function renderOverview(){if(OV.hidden||XP||typeof MAPMODE==='undefined'||!MAPMODE)return;const b=ovEl();b.hidden=false;
  if(!PF.length){b.className='ov empty';b.innerHTML=`<div class="ov-h"><div><small>ATLAS</small><b>Entiende qué tienes realmente</b></div><button data-ov="col" aria-label="Plegar">${OV.collapsed?'▴':'▾'}</button></div>${OV.collapsed?'':`<p>Añade tu cartera y ATLAS te dirá qué empresas, países y sectores hay dentro de tus ETFs, qué riesgos asumes sin darte cuenta y qué merece investigarse.</p><div class="ov-b"><button class="btn" data-ov="pf">★ Crear mi cartera</button><button class="btn2" data-ov="ex">Probar un ejemplo</button></div>`}`;bindOv(b);return}
  b.className='ov';if(!b.innerHTML)b.innerHTML='<div class="ix-load"><i></i>Analizando tu cartera…</div>';
  const keep=DOC.src;DOC.src='pf';const A=await analyzeSrc('pf');DOC.src=keep;if(OV.hidden||XP||!A||A.empty)return;
  const v=_pfV||{val:0,inv:0},ret=v.inv?(v.val/v.inv-1)*100:null,h=A.SC.health,ins=A.D.filter(d=>d.sev!=='info').slice(0,3);
  b.innerHTML=`<div class="ov-h"><div><small>Tu cartera</small><b>${num(v.val)} €</b></div><div class="ov-k"><span>Rentabilidad</span><b class="${(ret||0)<0?'dn':'up'}">${ret==null?'—':(ret>0?'+':'')+pct(ret,1)}</b></div><div class="ov-k"><span>Volatilidad</span><b>${A.R?pct(A.R.vol,0):'—'}</b></div><div class="ov-k"><span>Salud</span><b style="color:${scol(h)}">${h==null?'—':Math.round(h)}<small>/100</small></b></div><button data-ov="col" aria-label="${OV.collapsed?'Desplegar':'Plegar'}">${OV.collapsed?'▴':'▾'}</button></div>
    ${OV.collapsed?'':`<ul class="ov-i">${ins.slice(0,mobile()?2:3).map(d=>`<li><span>${SEV[d.sev][0]}</span><b>${esc(d.t)}</b><em>${esc(d.metric)}</em></li>`).join('')}</ul>
    <div class="ov-b"><button class="btn" data-ov="doc">Analizar cartera</button><div class="ov-x"><span>🌍</span><button data-ov="geo">Países</button><button data-ov="comp">Empresas</button><button data-ov="sec">Sectores</button></div></div>`}`;bindOv(b,A)}
function bindOv(b,A){b.querySelectorAll('[data-ov]').forEach(x=>x.onclick=()=>{const k=x.dataset.ov;
  if(k==='col'){OV.collapsed=!OV.collapsed;try{localStorage.setItem('atlas_ov',OV.collapsed?'0':'1')}catch(_){}renderOverview();return}
  if(k==='pf')openHub('pf');else if(k==='ex'){loadExample();DOC.tab='doctor';openHub('doc')}else if(k==='doc'){DOC.src='pf';DOC.tab='doctor';saveDoc();openHub('doc')}else if(A)showExposureGlobe(A.P,A.name,k)})}

/* ------------------------------ integración ------------------------------ */
function install(){if(typeof HUB==='undefined'||!document.getElementById('menu')||!document.querySelector('.right .pbody')){setTimeout(install,400);return}
  Object.assign(HUB,{doc:['🩺','Análisis de cartera'],radar:['🎯','Opportunity Radar'],cmp:['⚖️','Comparar'],cty:['🌍','País']});
  const pb=document.querySelector('.right .pbody');[['ixdoc','doc'],['ixradar','radar'],['ixcmp','cmp'],['ixcty','cty']].forEach(([id,s])=>{if(!document.getElementById(id)){const d=document.createElement('div');d.id=id;d.className='pf ix';d.dataset.s=s;pb.prepend(d)}});
  const st=document.createElement('style');st.textContent=['doc','radar','cmp','cty'].map(s=>`body.mapmode #app.simple .right[data-sec=${s}] .pbody>[data-s=${s}]{display:flex!important}`).join('');document.head.appendChild(st);
  document.addEventListener('click',async e=>{const b=e.target.closest('#menu [data-hub=xp],#menu [data-hub=ov]');if(!b)return;e.stopPropagation();const m=document.getElementById('menu');if(m){m.hidden=true;document.body.classList.remove('menu-open');const bm=document.querySelector('.bb-menu');if(bm)bm.setAttribute('aria-expanded','false')}
    closeHub();if(b.dataset.hub==='ov'){if(XP)hideExposure();OV.collapsed=false;ovShow();return}
    const A=await analyzeSrc(PF.length?'pf':DOC.src);if(!A||A.empty){toast('Primero crea una cartera');DOC.tab='doctor';openHub('doc');return}showExposureGlobe(A.P,A.name,'geo')},true);
  const orig=window.openHub;window.openHub=function(sec){orig(sec);ovHide();if(sec==='doc')renderDoc();if(sec==='radar')renderRadar();if(sec==='cmp')renderCompare();if(sec==='cty')renderCountry()};
  const oc=window.closeHub;window.closeHub=function(p){oc(p);if(!hubSec&&!XP)setTimeout(ovShow,50)};
  loadExpo().then(()=>{const go=()=>{if(typeof mapReady!=='undefined'&&mapReady)renderOverview();else setTimeout(go,600)};setTimeout(go,1200)})}
window.ATLASI={expOf,lookThrough,overlap,overlapDetail,riskOf,docPortfolio,analyze,analyzeSrc:s=>analyzeSrc(s),renderDoc,renderRadar,renderCompare,showExposureGlobe,hideExposure,openCompare,openRadar,openCountry,loadExpo,renderOverview,get DOC(){return DOC},set DOC(v){DOC=v;saveDoc()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
