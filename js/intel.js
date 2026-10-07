/* =====================================================================================================
   ATLAS · Inteligencia de inversión
   - Motor de exposición (look-through): qué empresas, países y sectores hay realmente dentro de cada ETF/fondo.
   - Portfolio Doctor: salud de la cartera, solapamientos, correlaciones, riesgo, diagnóstico y alternativas.
   - Opportunity Radar: puntuación ATLAS transparente y configurable, categorías, filtros y ranking.
   - Comparar: dos carteras / ETFs lado a lado, y "cómo cambiaría mi exposición si añado X".
   - Globo de exposición: mapa coloreado por país, sectores, empresas; panel de país con exposición directa e indirecta.
   Fuentes (todas con fecha en la interfaz):
     data/expo.json   ← scripts/holdings.py  (justETF por ISIN: países y sectores; Yahoo Finance: 10 mayores posiciones, sectores, P/E, P/B, TER)
     data/p/*.json    ← scripts/fetch_prices.py (precios diarios 1 año + semanales 5 años)
     data/rank.json   ← scripts/rankings.py (rentabilidades, volatilidad, tendencia, caída máxima 1 año)
     data/countries.geojson ← Natural Earth 1:110m (dominio público)
   Este archivo depende de funciones globales de index.html (searchEntities, priceKey, eurSeries, priceAt, buildPlan…).
   ===================================================================================================== */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const pct=(v,d=1)=>v==null||!isFinite(v)?'—':(Math.round(v*10**d)/10**d).toFixed(d).replace('.',',')+' %';
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const CNAME={US:'Estados Unidos',JP:'Japón',GB:'Reino Unido',CA:'Canadá',FR:'Francia',CH:'Suiza',DE:'Alemania',AU:'Australia',NL:'Países Bajos',DK:'Dinamarca',SE:'Suecia',IT:'Italia',ES:'España',HK:'Hong Kong',SG:'Singapur',FI:'Finlandia',BE:'Bélgica',IL:'Israel',NO:'Noruega',IE:'Irlanda',NZ:'Nueva Zelanda',AT:'Austria',PT:'Portugal',CN:'China',TW:'Taiwán',IN:'India',KR:'Corea del Sur',BR:'Brasil',SA:'Arabia Saudí',ZA:'Sudáfrica',MX:'México',ID:'Indonesia',TH:'Tailandia',MY:'Malasia',AE:'Emiratos Árabes',PL:'Polonia',QA:'Catar',KW:'Kuwait',TR:'Turquía',CL:'Chile',GR:'Grecia',PH:'Filipinas',PE:'Perú',HU:'Hungría',CO:'Colombia',CZ:'Chequia',EG:'Egipto',LU:'Luxemburgo',MO:'Macao',AR:'Argentina',BM:'Bermudas',KY:'Islas Caimán',JE:'Jersey',XX:'Sin desglose',EU:'Unión Europea'};
const EM=new Set(['CN','TW','IN','KR','BR','SA','ZA','MX','ID','TH','MY','AE','PL','QA','KW','TR','CL','GR','PH','PE','HU','CO','CZ','EG','AR']);
const REGION=c=>c==='US'||c==='CA'?'Norteamérica':['JP','AU','NZ','HK','SG'].includes(c)?'Asia-Pacífico desarrollada':EM.has(c)?'Emergentes':c==='XX'?'Sin desglose':'Europa';
const SEC_STOCK={'Tecnología':'Tecnología','Finanzas':'Finanzas','Salud':'Salud','Energía':'Energía','Consumo':'Consumo discrecional','Industria':'Industria','Telecomunicaciones':'Comunicaciones','Inmobiliario':'Inmobiliario','Materias primas':'Materiales','Automoción':'Consumo discrecional','Defensa y espacio':'Industria','Infraestructuras':'Industria','Lujo':'Consumo discrecional'};
const SEC_C={'Tecnología':'#7aa2ff','Finanzas':'#ffd24a','Salud':'#ff7ab6','Industria':'#b9c6e8','Consumo discrecional':'#ff9a3c','Consumo básico':'#9be15d','Comunicaciones':'#c084fc','Energía':'#ff6b4a','Materiales':'#a0855b','Inmobiliario':'#4cd8a0','Servicios públicos':'#35e0ff','Liquidez':'#7f8bab','Otros':'#5a6480','Sin desglose':'#3a4258'};
const SOURCES='Composición: justETF (países y sectores, por ISIN) y Yahoo Finance (10 mayores posiciones, sectores, P/E). Precios: Yahoo Finance. Fronteras: Natural Earth.';

/* ------------------------------ datos ------------------------------ */
let EXPO=null,_expoP=null;
function loadExpo(){return _expoP||(_expoP=fetch('data/expo.json?d='+new Date().toISOString().slice(0,10),{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>EXPO=j).catch(()=>null))}
const ents=()=>searchEntities();
const entBy=(k,t)=>ents().find(x=>x.k===k&&x.t===t);
const ckey=(name,tk)=>{let n=String(name||'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9 ]/g,' ').replace(/\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|SA|AG|NV|SE|SPA|AB|ASA|OYJ|KK|THE|CLASS|CL|SHS|ORD|ADR|REG|HOLDINGS?|GROUP|COMMON|STOCK|[ABC])\b/g,' ').replace(/\s+/g,' ').trim();
  n=CKA[n]||n;const w=n.split(' ');return w.slice(0,2).join(' ')||String(tk||'').split('.')[0]};
const CKA={'TSMC':'TAIWAN SEMICONDUCTOR','GOOGLE':'ALPHABET','FACEBOOK':'META PLATFORMS','META':'META PLATFORMS','LVMH':'LVMH MOET','LVMH MOET HENNESSY LOUIS VUITTON':'LVMH MOET'};
const assetClass=e=>{if(e.k==='s')return 'Acciones';const g=e.obj.grp||'',n=(e.obj.n||e.name||'').toLowerCase();if(['bond','tbill','tips'].includes(g)||/bond|treasury|aggregate|renta fija|bonos/.test(n))return 'Bonos';if(g==='gold'||/gold|oro/.test(n))return 'Oro';return 'Acciones'};
function terOf(e){if(e.k==='s')return 0;const r=EXPO&&EXPO.fund[priceKey(e.k,e.obj)];const t=e.obj.ter??(r&&r.ter);return t==null?null:+t}

/* Exposición de UN activo. Devuelve también la calidad del dato para mostrarla siempre. */
const _expC=new Map();
function expOf(e){const pk=priceKey(e.k,e.obj);if(_expC.has(pk))return _expC.get(pk);let x;
  if(e.k==='s'){const cc=e.obj.cc||'XX',sec=SEC_STOCK[e.obj.sec]||'Otros';
    x={kind:'stock',q:'directa',qTxt:'Acción: 100 % en la propia empresa',country:{[cc]:100},sector:{[sec]:100},hold:[{key:ckey(e.name,e.obj.t),name:e.name,tk:e.obj.t,w:100,cc,sec}],cover:100,ccCover:100,asof:null,src:'Ficha de la empresa'}}
  else{const r=EXPO&&EXPO.fund[pk];const ac=assetClass(e);
    if(!r){x={kind:'fund',q:'sin',qTxt:'Sin datos de composición todavía',country:{XX:100},sector:{'Sin desglose':100},hold:[],cover:0,ccCover:0,asof:null,src:'—',ac}}
    else{const sector=r.sector&&Object.keys(r.sector).length?r.sector:(r.sector_j||{});const secS=Object.values(sector).reduce((a,v)=>a+v,0);if(secS<99.5&&secS>0)sector['Sin desglose']=+(100-secS).toFixed(2);
      const country=r.country&&Object.keys(r.country).length?{...r.country}:{};let ccS=Object.values(country).reduce((a,v)=>a+v,0);
      let topSrc=(r.top&&r.top.length?r.top:r.top_j)||[];
      if(!ccS){topSrc.forEach(h=>country[h[3]||'XX']=(country[h[3]||'XX']||0)+h[2]);ccS=Object.values(country).reduce((a,v)=>a+v,0);country.XX=(country.XX||0)+Math.max(0,100-ccS)}
      const jcc=new Map((r.top_j||[]).map(h=>[ckey(h[0],h[1]),h[3]]));
      const hold=topSrc.map(h=>{const key=ckey(h[0],h[1]);return{key,name:h[0],tk:h[1],w:+h[2],cc:jcc.get(key)||(/^\d+$/.test(h[1])?'XX':h[3])||'XX',sec:h[4]||null}});
      const known=100-(country.XX||0);
      x={kind:'fund',ac,q:r.full&&r.full.countries?'completa':known>0?'parcial':'sin',
        qTxt:(r.full&&r.full.countries?'Todos los países':'Principales países + «otros»')+(r.jproxy?` · tomado del ETF UCITS que replica el mismo índice (${r.jisin})`:'')+` · ${hold.length} mayores posiciones (${pct(r.cover??hold.reduce((a,h)=>a+h.w,0),0)} del ETF)`,
        country,sector,hold,cover:hold.reduce((a,h)=>a+h.w,0),ccCover:known,asof:r.asof_j||r.asof,src:(r.src_j?r.src_j+' + ':'')+(r.src||''),pe:r.pe,pb:r.pb,ter:r.ter,n:r.n}}}
  _expC.set(pk,x);return x}

/* Look-through de una cartera P=[{e,w}] (w suma 1) */
function lookThrough(P){const C={},S={},comp=new Map(),byC={},dir={},ind={},AC={};let resid2=0,nAssumed=false,cover=0,ccCover=0,ter=0,terW=0;
  P.forEach(({e,w})=>{const x=expOf(e);AC[x.ac||'Acciones']=(AC[x.ac||'Acciones']||0)+w*100;
    Object.entries(x.country).forEach(([c,v])=>{const p=w*v;C[c]=(C[c]||0)+p;(byC[c]=byC[c]||[]).push({e,p});if(e.k==='s')dir[c]=(dir[c]||0)+p;else ind[c]=(ind[c]||0)+p});
    Object.entries(x.sector).forEach(([s,v])=>S[s]=(S[s]||0)+w*v);
    x.hold.forEach(h=>{const cw=w*h.w;let c=comp.get(h.key);if(!c){c={key:h.key,name:h.name,tk:h.tk,cc:h.cc,sec:h.sec,w:0,by:[]};comp.set(h.key,c)}c.w+=cw;const bb=c.by.find(z=>z.e===e);if(bb)bb.w+=cw;else c.by.push({e,w:cw});if(!c.sec&&h.sec)c.sec=h.sec;if(c.cc==='XX'&&h.cc)c.cc=h.cc});
    cover+=w*x.cover;ccCover+=w*x.ccCover;if(x.kind==='fund'){const rest=Math.max(0,100-x.cover)/100*w,nn=x.n&&x.n>x.hold.length?x.n:20,k=Math.max(1,nn-x.hold.length);resid2+=rest*rest/k;if(!x.n)nAssumed=true}const t=terOf(e);if(t!=null){ter+=w*t;terW+=w}});
  const comps=[...comp.values()].sort((a,b)=>b.w-a.w);
  return{C,S,comps,byC,dir,ind,AC,resid2,nAssumed,cover,ccCover,ter:terW?ter/terW:null,terW}}

/* Solapamiento entre dos activos (% común como mínimo, con las posiciones conocidas) */
function overlap(a,b){const A=expOf(a).hold,B=expOf(b).hold;if(!A.length||!B.length)return null;const m=new Map(A.map(h=>[h.key,h.w]));let o=0;B.forEach(h=>{if(m.has(h.key))o+=Math.min(m.get(h.key),h.w)});return o}

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
  const M=ok.map(a=>ok.map(b=>a===b?1:corr(a.r.r,b.r.r)));
  const firstData=ok.map(x=>x.r.first).sort().pop();
  return{vol:sd*Math.sqrt(52)*100,dd:dd*100,worst12:r12.length?r12[0]*100:null,p5:r12.length?r12[Math.floor(r12.length*.05)]*100:null,cagr:cagr*100,weeks:v.length,firstData,M,assets:ok.map(x=>x.e),pr,grid,coverage:tw}}

/* ------------------------------ PORTFOLIO DOCTOR ------------------------------ */
let DOC=(()=>{try{return JSON.parse(localStorage.getItem('atlas_doc')||'null')||{src:'pf',rows:[]}}catch(_){return{src:'pf',rows:[]}}})();
const saveDoc=()=>{try{localStorage.setItem('atlas_doc',JSON.stringify(DOC))}catch(_){}};
async function docPortfolio(){if(DOC.src==='pf'&&PF.length){const rs=await Promise.all(PF.map(pfValue)),g=new Map();rs.forEach(r=>{if(!r.ent||r.err||r.pending||!(r.val>0))return;const k=r.ent.k+'|'+r.ent.t;g.set(k,(g.get(k)||0)+r.val)});
    const tot=[...g.values()].reduce((a,v)=>a+v,0);return{name:'Mi cartera',P:[...g.entries()].map(([k,v])=>{const [kk,t]=k.split('|');return{e:entBy(kk,t),w:v/tot}}).filter(x=>x.e)}}
  const rows=(DOC.rows||[]).map(r=>({e:entBy(r.k,r.t),w:+r.w||0})).filter(x=>x.e&&x.w>0),tot=rows.reduce((a,x)=>a+x.w,0);return{name:'Cartera del análisis',P:tot?rows.map(x=>({e:x.e,w:x.w/tot})):[]}}
const SCORE_DOC={
  div:['Diversificación real','Número efectivo de empresas = 1 / Σ(peso de cada empresa)². Usa las mayores posiciones conocidas de cada ETF y reparte el resto a partes iguales entre sus demás posiciones (aproximación: no se conocen todos los pesos). 200 o más → 100; 10 → 43; 1 → 0 (escala logarítmica).'],
  conc:['Concentración','100 − 6 × (peso de la mayor empresa − 3 pp) − 1,2 × (peso de las 10 mayores − 25 pp). Penaliza depender de pocas empresas.'],
  geo:['Exposición geográfica','100 − 2 × (peso del primer país − 60 pp) si supera el 60 %; −15 si hay menos de 5 países con más del 1 %.'],
  sec:['Exposición sectorial','100 − 2,5 × (peso del primer sector − 25 pp) si supera el 25 %.'],
  corr:['Correlación','(1 − correlación media entre tus activos, ponderada por peso) × 130. Necesita al menos 2 activos con 40 semanas de precios.'],
  vol:['Volatilidad','100 − 4 × (volatilidad anual − 8 pp). 8 % o menos → 100; 20 % → 52; 33 % → 0. Semanal, 5 años.'],
  dd:['Caída máxima','100 − 2,5 × (|caída máxima| − 10 pp). La mayor caída desde un máximo en 5 años.'],
  risk:['Riesgo a la baja','100 + 2 × (peor rentabilidad en 12 meses seguidos). −20 % → 60; −50 % → 0.'],
  cost:['Coste','100 − 50 × gastos anuales medios (TER, %). 0,1 % → 95; 0,5 % → 75; 1,5 % → 25.']};
function docScores(L,R,P){const S={},ev={};const known=L.comps.reduce((a,c)=>a+c.w*c.w,0)/1e4;
  const neff=known||L.resid2?1/(known+L.resid2):null;const top1=L.comps[0]?L.comps[0].w:0,top10=L.comps.slice(0,10).reduce((a,c)=>a+c.w,0);
  if(neff){S.div=clamp(100*Math.log(Math.max(1,neff))/Math.log(200));ev.div=`≈ ${Math.round(neff)} empresas efectivas. Mayores posiciones conocidas: ${pct(L.cover,0)} de la cartera; el resto se reparte a partes iguales entre las demás posiciones de cada ETF${L.nAssumed?' (si no se conoce el nº de posiciones se asume el mínimo de 20, regla UCITS 5/10/40: estimación prudente)':''}`}
  if(L.comps.length){S.conc=clamp(100-6*Math.max(0,top1-3)-1.2*Math.max(0,top10-25));ev.conc=`Mayor empresa: ${L.comps[0].name} ${pct(top1)} · 10 mayores: ${pct(top10)}`}
  const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);if(cs.length){const n1=cs.filter(([,v])=>v>1).length;S.geo=clamp(100-2*Math.max(0,cs[0][1]-60)-(n1<5?15:0));ev.geo=`${CNAME[cs[0][0]]||cs[0][0]} ${pct(cs[0][1])} · ${n1} países por encima del 1 %${L.C.XX?` · ${pct(L.C.XX,0)} sin desglose`:''}`}
  const ss=Object.entries(L.S).filter(([s])=>s!=='Sin desglose'&&s!=='Otros').sort((a,b)=>b[1]-a[1]);if(ss.length){S.sec=clamp(100-2.5*Math.max(0,ss[0][1]-25));ev.sec=`${ss[0][0]} ${pct(ss[0][1])}`}
  if(R){if(R.M.length>1){let s=0,ww=0;R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c==null)return;const wi=P.find(x=>x.e===a).w*P.find(x=>x.e===b).w;s+=wi*c;ww+=wi}));if(ww){const ac=s/ww;S.corr=clamp((1-ac)*130);ev.corr=`Correlación media ${ac.toFixed(2).replace('.',',')}`}}
    S.vol=clamp(100-4*(R.vol-8));ev.vol=`${pct(R.vol)} al año`;S.dd=clamp(100-2.5*(Math.abs(R.dd)-10));ev.dd=`${pct(R.dd)} desde máximos`;if(R.worst12!=null){S.risk=clamp(100+2*R.worst12);ev.risk=`Peor año móvil ${pct(R.worst12)}`}}
  if(L.ter!=null){S.cost=clamp(100-50*L.ter);ev.cost=`${pct(L.ter,2)} al año de media${L.terW<.99?` (sin dato en el ${pct((1-L.terW)*100,0)})`:''}`}
  const vals=Object.values(S);return{S,ev,health:vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:null,neff,top1,top10}}
function diagnose(L,R,P,SC){const D=[];const cs=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]);
  const add=(sev,t,exp,evid,sol,act)=>D.push({sev,t,exp,evid,sol,act});
  if(cs[0]&&cs[0][1]>70)add(cs[0][1]>85?'alta':'media',`Mucha concentración en ${CNAME[cs[0][0]]||cs[0][0]}`,`Tu dinero depende sobre todo de un solo país. En el mercado mundial (MSCI ACWI) EE. UU. pesa en torno al 60–65 %.`,`${pct(cs[0][1])} de la cartera en ${CNAME[cs[0][0]]||cs[0][0]}`,'Busca ETFs de otras regiones (Europa, Japón, emergentes) para equilibrar.',{radar:{region:'ex-US'}});
  const em=Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  if(em<5&&L.ccCover>60)add('baja','Emergentes poco representados',`Los mercados emergentes son ~10 % del mercado mundial. Tienes mucho menos, lo que reduce la diversificación económica.`,`${pct(em)} en emergentes`,'Valora un ETF de mercados emergentes como complemento.',{radar:{region:'Emergentes'}});
  if(L.comps[0]&&SC.top1>8)add(SC.top1>15?'alta':'media',`Mucho peso en ${L.comps[0].name}`,`Una sola empresa pesa mucho en tu cartera, sumando lo que tienes directamente y lo que va dentro de tus ETFs.`,`${pct(SC.top1)} · llega a través de: ${L.comps[0].by.map(b=>b.e.name+' '+pct(b.w)).join(', ')}`,'Reduce aportaciones a los activos que más la llevan o añade activos sin ella.',null);
  const ss=Object.entries(L.S).filter(([s])=>s!=='Sin desglose'&&s!=='Otros').sort((a,b)=>b[1]-a[1]);
  if(ss[0]&&ss[0][1]>35)add(ss[0][1]>50?'alta':'media',`Fuerte peso en ${ss[0][0]}`,`Un sector domina tu cartera: si ese sector cae, cae casi todo.`,`${ss[0][0]} ${pct(ss[0][1])}`,'Busca sectores con poca presencia en tu cartera.',{radar:{cat:'Diversificación'}});
  const funds=P.filter(x=>x.e.k!=='s');const pairs=[];funds.forEach((a,i)=>funds.slice(i+1).forEach(b=>{const o=overlap(a.e,b.e);if(o!=null&&o>25)pairs.push([a,b,o])}));pairs.sort((a,b)=>b[2]-a[2]);
  pairs.slice(0,3).forEach(([a,b,o])=>add(o>50?'alta':'media',`Solapamiento entre ${a.e.name} y ${b.e.name}`,`Comparten muchas de las mismas empresas: tenerlos juntos diversifica menos de lo que parece.`,`Al menos ${pct(o,0)} de sus posiciones son comunes (contando sus mayores posiciones)`,'Quédate con uno de los dos o sustituye uno por algo distinto.',null));
  if(P.length>=3&&SC.neff&&(pairs.length||SC.top10>30))add('media',`${P.length} activos, pero poca diversificación real`,`Tu cartera parece diversificada por número de ETFs, pero no necesariamente por exposición subyacente.`,`Equivale a ≈ ${Math.round(SC.neff)} empresas efectivas; las 10 mayores suman ${pct(SC.top10)}`,'Mira el solapamiento y el globo de exposición antes de añadir más ETFs parecidos.',{globe:1});
  if(R&&R.M.length>1)R.assets.forEach((a,i)=>R.assets.forEach((b,j)=>{if(j<=i)return;const c=R.M[i][j];if(c!=null&&c>.9&&!pairs.some(p=>(p[0].e===a&&p[1].e===b)||(p[0].e===b&&p[1].e===a)))add('media',`${a.name} y ${b.name} se mueven casi igual`,`Su correlación semanal es muy alta: suben y bajan a la vez.`,`Correlación ${c.toFixed(2).replace('.',',')}`,'Combinar activos que no se muevan igual reduce las caídas.',null)}));
  const P0=PROFILES[profile];if(R&&R.vol>P0.etfVol)add('media','Más volátil que tu perfil',`Tu perfil ${P0.label} tolera hasta ~${P0.etfVol} % de volatilidad anual.`,`Volatilidad de tu cartera: ${pct(R.vol)}`,'Las alternativas de abajo muestran cómo bajarla.',null);
  if(L.ter!=null&&L.ter>.5)add('baja','Costes altos',`Una diferencia del 0,5 % anual en comisiones resta mucho a largo plazo.`,`TER medio ${pct(L.ter,2)}`,'Compara con fondos indexados o ETFs de bajo coste.',null);
  if(L.ccCover<60)add('info','Datos parciales',`No conocemos por dentro parte de tu cartera: los resultados pueden infravalorar la concentración.`,`Países conocidos: ${pct(L.ccCover,0)} · empresas conocidas: ${pct(L.cover,0)}`,'—',null);
  const ord={alta:0,media:1,baja:2,info:3};return D.sort((a,b)=>ord[a.sev]-ord[b.sev])}
async function altPortfolios(){const out=[];for(const [pk,name,ico] of [['cons','Conservadora','🛡️'],['mod','Equilibrada','⚖️'],['ag','Crecimiento','🚀']]){const p=buildPlan(pk,basis,'bal');
    const P=p.items.map(x=>({e:ents().find(y=>y.obj===x.e)||entBy('f',x.e.t)||entBy('e',x.e.t),w:x.w})).filter(x=>x.e);const tw=P.reduce((a,x)=>a+x.w,0);P.forEach(x=>x.w/=tw);out.push({pk,name,ico,P})}return out}
function bars(obj,n=8,fmt=k=>k,col=()=> '#7aa2ff'){const e=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);const mx=Math.max(...e.map(x=>x[1]),1);
  return `<div class="ix-bars">${e.map(([k,v])=>`<div class="ix-bar"><span>${esc(fmt(k))}</span><i><b style="width:${(v/mx*100).toFixed(1)}%;background:${col(k)}"></b></i><em>${pct(v)}</em></div>`).join('')}</div>`}
const sevC={alta:'#ff4d6d',media:'#ffb35a',baja:'#ffd24a',info:'#7aa2ff'};
let _doc=null;
async function renderDoctor(){const el=$('#ixdoc');if(!el)return;await loadExpo();const src=await docPortfolio();
  el.innerHTML=`<p class="pf-lead">ATLAS mira <b>dentro</b> de cada ETF y fondo para ver tu exposición real: empresas, países, sectores, solapamientos y riesgo.</p>
    <div class="ix-src"><button data-dsrc="pf" aria-pressed="${DOC.src==='pf'}">★ Mi cartera</button><button data-dsrc="custom" aria-pressed="${DOC.src==='custom'}">✎ Otra cartera</button></div>
    ${DOC.src==='custom'?docEditor():''}<div id="ixdocOut"><p class="mp-note">Analizando…</p></div>`;
  el.querySelectorAll('[data-dsrc]').forEach(b=>b.onclick=()=>{DOC.src=b.dataset.dsrc;saveDoc();renderDoctor()});
  if(DOC.src==='custom')bindEditor(el);
  if(DOC.src==='pf'&&!PF.length){$('#ixdocOut').innerHTML='<p class="mp-note">Tu cartera está vacía. Añade inversiones en «Mi cartera» o usa «Otra cartera».</p>';return}
  if(!src.P.length){$('#ixdocOut').innerHTML='<p class="mp-note">Añade al menos un activo con su porcentaje.</p>';return}
  const out=$('#ixdocOut'),P=src.P,L=lookThrough(P),R=await riskOf(P),SC=docScores(L,R,P),D=diagnose(L,R,P,SC);_doc={P,L,R,SC,D,name:src.name};window.ATLAS_DOC=_doc;
  const h=SC.health,hc=h>=75?'#4cd8a0':h>=55?'#ffd24a':'#ff6b8a';
  const comps=L.comps.slice(0,10),funds=P.filter(x=>x.e.k!=='s');
  const om=funds.length>1?`<div class="ix-mat" style="--n:${funds.length}"><span></span>${funds.map(x=>`<b title="${esc(x.e.name)}">${esc(String(x.e.tk).slice(0,5))}</b>`).join('')}${funds.map((a,i)=>`<b title="${esc(a.e.name)}">${esc(String(a.e.tk).slice(0,5))}</b>`+funds.map((b,j)=>{if(i===j)return '<i class="d">—</i>';const o=overlap(a.e,b.e);return `<i style="background:rgba(255,107,138,${o==null?0:Math.min(.85,o/70)})">${o==null?'?':Math.round(o)+'%'}</i>`}).join('')).join('')}</div>`:'';
  const cm=R&&R.M.length>1?`<div class="ix-mat" style="--n:${R.assets.length}"><span></span>${R.assets.map(a=>`<b title="${esc(a.name)}">${esc(String(a.tk).slice(0,5))}</b>`).join('')}${R.assets.map((a,i)=>`<b title="${esc(a.name)}">${esc(String(a.tk).slice(0,5))}</b>`+R.M[i].map((c,j)=>i===j?'<i class="d">1</i>':`<i style="background:${c==null?'transparent':c>0?`rgba(255,179,90,${Math.min(.9,Math.abs(c))})`:`rgba(53,224,255,${Math.min(.9,Math.abs(c))})`}">${c==null?'?':c.toFixed(2).replace('.',',')}</i>`).join('')).join('')}</div>`:'<p class="mp-note">Hace falta más de un activo con historial de precios.</p>';
  out.innerHTML=`<div class="ix-health"><div class="ix-ring" style="--p:${h||0};--c:${hc}"><b>${h==null?'—':Math.round(h)}</b><span>/100</span></div><div><h4>Salud de la cartera</h4><p>${esc(src.name)} · ${P.length} activo${P.length>1?'s':''} · ≈ ${SC.neff?Math.round(SC.neff):'—'} empresas efectivas</p><p class="mp-note">Media de las ${Object.keys(SC.S).length} puntuaciones de abajo (mismo peso cada una). Toca una para ver cómo se calcula.</p></div></div>
    <div class="ix-scores">${Object.entries(SCORE_DOC).map(([k,[t,how]])=>{const v=SC.S[k];return `<details class="ix-sc"><summary><span>${t}</span><i><b style="width:${v??0}%;background:${v==null?'#3a4258':v>=75?'#4cd8a0':v>=55?'#ffd24a':'#ff6b8a'}"></b></i><em>${v==null?'n/d':Math.round(v)}</em></summary><p><b>Dato:</b> ${esc(SC.ev[k]||'no calculable con los datos disponibles')}</p><p><b>Cálculo:</b> ${how}</p></details>`}).join('')}</div>
    ${P.length>=2&&SC.neff?`<div class="ix-truth"><div><span>Parece</span><b>${P.length} activos</b></div><i>→</i><div><span>En realidad</span><b>≈ ${Math.round(SC.neff)} empresas efectivas</b></div><div><span>10 mayores</span><b>${pct(SC.top10,0)}</b></div></div>`:''}
    ${D.some(d=>/poca diversificación real|Solapamiento/.test(d.t))?'<div class="ix-warn">⚠️ Tu cartera parece diversificada por número de ETFs, pero no necesariamente por exposición subyacente.</div>':''}
    <h4 class="ix-h">🩺 Diagnóstico</h4>${D.length?D.map((d,i)=>`<div class="ix-dx" style="--c:${sevC[d.sev]}"><div class="ix-dxh"><em>${d.sev.toUpperCase()}</em><b>${i+1}. ${esc(d.t)}</b></div><p>${esc(d.exp)}</p><p class="ix-ev">📊 ${esc(d.evid)}</p><p class="ix-sol">💡 ${esc(d.sol)}</p>${d.act?`<button class="btn2 ix-act" data-dx="${i}">${d.act.globe?'🌍 Verlo en el globo':'🎯 Buscar en Opportunity Radar'}</button>`:''}</div>`).join(''):'<p class="mp-note">No se detectan problemas relevantes con los datos disponibles.</p>'}
    <h4 class="ix-h">🧬 Exposición real</h4><div class="ix-2"><div><h5>Países</h5>${bars(L.C,8,c=>CNAME[c]||c,c=>c==='XX'?'#3a4258':EM.has(c)?'#9be15d':c==='US'?'#7aa2ff':'#c084fc')}</div><div><h5>Sectores</h5>${bars(L.S,8,s=>s,s=>SEC_C[s]||'#7aa2ff')}</div></div>
    <h5>Empresas (sumando todos tus activos)</h5><div class="ix-comp">${comps.map(c=>`<div><b>${esc(c.name)}</b><em>${pct(c.w)}</em><small>${c.by.map(b=>esc(String(b.e.tk))+' '+pct(b.w)).join(' · ')}</small></div>`).join('')||'<p class="mp-note">Sin datos de empresas.</p>'}</div>
    <p class="mp-note">Conocemos los países del ${pct(L.ccCover,0)} y las empresas del ${pct(L.cover,0)} de la cartera (las mayores posiciones de cada ETF). El resto no se reparte: aparece como «sin desglose».</p>
    ${om?`<h4 class="ix-h">🔁 Solapamiento entre tus ETFs</h4>${om}<p class="mp-note">% de posiciones en común (suma de los pesos mínimos de las empresas compartidas). Es un mínimo: solo cuenta las mayores posiciones conocidas.</p>`:''}
    <h4 class="ix-h">🔗 Correlación (semanal, ${R?Math.round(R.weeks/52):'—'} años)</h4>${cm}
    <h4 class="ix-h">📉 Riesgo histórico</h4>${R?`<div class="ix-kpi"><div><span>Volatilidad anual</span><b>${pct(R.vol)}</b></div><div><span>Caída máxima</span><b style="color:var(--bad)">${pct(R.dd)}</b></div><div><span>Peor año móvil</span><b style="color:var(--bad)">${pct(R.worst12)}</b></div><div><span>Mal año (percentil 5)</span><b>${pct(R.p5)}</b></div></div><p class="mp-note">Calculado con precios semanales en euros desde ${R.grid[0].split('-').reverse().join('/')}, con los pesos de hoy. Es lo que pasó, no una previsión.${R.firstData>R.grid[0]?' Algún activo tiene menos historia.':''}</p>`:'<p class="mp-note">Sin precios suficientes.</p>'}
    <h4 class="ix-h">🧭 ¿Cómo podrías mejorarla?</h4><div id="ixAlt"><p class="mp-note">Calculando alternativas…</p></div>
    <div class="ix-btns"><button class="btn" data-go="globe">🌍 Ver mi exposición en el globo</button><button class="btn2" data-go="radar">🎯 Buscar oportunidades</button></div>
    <p class="ix-src2">${SOURCES} Composición a ${esc((P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||'—')}. Herramienta de análisis: no es una recomendación de inversión.</p>`;
  out.querySelectorAll('[data-dx]').forEach(b=>b.onclick=()=>{const a=D[+b.dataset.dx].act;if(a.globe)showExposureGlobe(P,src.name);else openRadar(a.radar)});
  out.querySelector('[data-go=globe]').onclick=()=>showExposureGlobe(P,src.name);out.querySelector('[data-go=radar]').onclick=()=>openRadar();
  const alts=await altPortfolios(),rows=await Promise.all(alts.map(async a=>({...a,L:lookThrough(a.P),R:await riskOf(a.P)})));
  const m=(lab,f)=>`<span class="l">${lab}</span><b>${f(L,R)}</b>${rows.map(a=>`<em>${f(a.L,a.R)}</em>`).join('')}`;
  const us=(L)=>pct(L.C.US||0,0),top=(L)=>{const s=Object.entries(L.S).filter(([k])=>!/Sin|Otros/.test(k)).sort((a,b)=>b[1]-a[1])[0];return s?s[0].split(' ')[0].slice(0,6)+' '+pct(s[1],0):'—'};
  $('#ixAlt').innerHTML=`<p class="mp-note">Tres carteras modelo de ATLAS para distintos niveles de riesgo, comparadas con la tuya. No se compra ni vende nada.</p><div class="ix-g"><span></span><i>Actual</i>${rows.map(a=>`<i>${a.ico} ${a.name}</i>`).join('')}
    ${m('Volatilidad',(L,R)=>R?pct(R.vol,0):'—')}${m('Caída máx.',(L,R)=>R?pct(R.dd,0):'—')}${m('Rent. anual hist.',(L,R)=>R?pct(R.cagr,1):'—')}${m('EE. UU.',us)}${m('Emergentes',(L)=>pct(Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0),0))}${m('1er sector',top)}${m('Coste (TER)',(L)=>L.ter==null?'—':pct(L.ter,2))}</div>
    <div class="ix-alts">${rows.map((a,i)=>`<div class="ix-alt"><b>${a.ico} ${a.name}</b><small>${a.P.map(x=>esc(String(x.e.tk))+' '+Math.round(x.w*100)+'%').join(' · ')}</small><button class="btn2" data-cmpalt="${i}">Comparar con la actual</button></div>`).join('')}</div>
    <p class="mp-note">Conservadora: menos volatilidad. Equilibrada: equilibrio riesgo/rentabilidad. Crecimiento: más potencial y más riesgo. Rentabilidad histórica con los pesos de hoy aplicados hacia atrás: no es una previsión.</p>`;
  $('#ixAlt').querySelectorAll('[data-cmpalt]').forEach(b=>b.onclick=()=>{const a=rows[+b.dataset.cmpalt];openCompare({name:src.name,P},{name:a.ico+' '+a.name,P:a.P})})}
function docEditor(){const rows=DOC.rows&&DOC.rows.length?DOC.rows:[{k:'',t:'',w:''}];const tot=rows.reduce((a,r)=>a+(+r.w||0),0);
  return `<div class="ix-ed">${rows.map((r,i)=>{const e=r.k?entBy(r.k,r.t):null;return `<div class="ix-row"><input list="ixList" data-ri="${i}" placeholder="Ticker o nombre (VWCE, SPY, QQQ…)" value="${e?esc(e.tk+' · '+e.name):''}"><input type="number" min="0" step="1" inputmode="decimal" data-rw="${i}" value="${r.w}" placeholder="%"><em>%</em><button data-rx="${i}" aria-label="Quitar">✕</button></div>`}).join('')}
    <datalist id="ixList">${ents().filter(x=>x.k!=='s').concat(ents().filter(x=>x.k==='s')).map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    <div class="ix-edb"><button class="btn2" data-radd>＋ Añadir</button><button class="btn2" data-rex>Ejemplo</button><span class="${Math.abs(tot-100)>.5&&tot?'bad':''}">Total ${Math.round(tot)} %${Math.abs(tot-100)>.5&&tot?' (se reescala a 100)':''}</span></div></div>`}
function bindEditor(el){const find=v=>{const tk=v.split(' · ')[0].trim().toUpperCase();return ents().find(x=>`${x.tk} · ${x.name}`===v)||ents().find(x=>String(x.tk).toUpperCase()===tk&&x.k!=='s')||ents().find(x=>String(x.tk).toUpperCase()===tk)||ents().find(x=>x.t.toUpperCase()===tk)};
  if(!DOC.rows||!DOC.rows.length)DOC.rows=[{k:'',t:'',w:''}];
  el.querySelectorAll('[data-ri]').forEach(i=>i.onchange=()=>{const e=find(i.value);const r=DOC.rows[+i.dataset.ri];if(e){r.k=e.k;r.t=e.t}else{r.k='';r.t=''}saveDoc();renderDoctor()});
  el.querySelectorAll('[data-rw]').forEach(i=>i.onchange=()=>{DOC.rows[+i.dataset.rw].w=+i.value||0;saveDoc();renderDoctor()});
  el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{DOC.rows.splice(+b.dataset.rx,1);saveDoc();renderDoctor()});
  el.querySelector('[data-radd]').onclick=()=>{DOC.rows.push({k:'',t:'',w:''});saveDoc();renderDoctor()};
  el.querySelector('[data-rex]').onclick=()=>{const pick=t=>{const e=ents().find(x=>x.t===t);return e?{k:e.k,t:e.t}:null};DOC.rows=[['VT',60],['SPY',20],['QQQ',10],['EEM',10]].map(([t,w])=>{const p=pick(t);return p?{...p,w}:null}).filter(Boolean);saveDoc();renderDoctor()}}

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
    const dom=Object.entries(x.country).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1])[0],sec=Object.entries(x.sector).filter(([s])=>!/Sin|Otros/.test(s)).sort((a,b)=>b[1]-a[1])[0];
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
  return `<div class="ix-why"><b>Por qué ATLAS cree que merece atención</b><p>${esc(whyText(o))}${o.cats.length?' Categorías: '+o.cats.join(', ')+'.':''}</p></div>
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
  const alts=await altPortfolios();const choices=[['Mi cartera',null],['Cartera del análisis',null],...alts.map(a=>[a.ico+' '+a.name,a])];
  el.innerHTML=`<p class="pf-lead">Compara dos carteras o dos ETFs: características, riesgo, exposición, concentración, correlación y costes.</p>
    <div class="ix-pks">${pick('A',CMP.A)}<b>vs</b>${pick('B',CMP.B)}</div><datalist id="ixCmpList">${choices.map(([n])=>`<option value="${esc(n)}">`).join('')}${ents().filter(x=>x.k!=='s').map(x=>`<option value="${esc(x.tk)} · ${esc(x.name)}">`).join('')}</datalist>
    ${CMP.add?`<label class="ix-addw">Peso de ${esc(String(CMP.add.e.tk))} en la cartera B <select data-addw>${[.05,.1,.2,.3].map(v=>`<option value="${v}"${Math.abs(v-CMP.addW)<1e-9?' selected':''}>${v*100} %</option>`).join('')}</select><small>el resto se reduce en proporción</small></label>`:''}<div id="ixCmpOut">${CMP.A&&CMP.B?'<p class="mp-note">Comparando…</p>':'<p class="mp-note">Elige qué comparar en A y B.</p>'}</div>`;
  el.querySelectorAll('[data-pk]').forEach(i=>i.onchange=async()=>{const v=i.value;let s=null;
    if(v==='Mi cartera'){const c=(DOC.src='pf',await docPortfolio());s=c.P.length?{name:'Mi cartera',P:c.P}:null}else if(v==='Cartera del análisis'){const keep=DOC.src;DOC.src='custom';const c=await docPortfolio();DOC.src=keep;s=c.P.length?{name:v,P:c.P}:null}
    else{const a=alts.find(x=>x.ico+' '+x.name===v);if(a)s={name:v,P:a.P};else{const tk=v.split(' · ')[0].trim().toUpperCase();const e=ents().find(x=>`${x.tk} · ${x.name}`===v)||ents().find(x=>String(x.tk).toUpperCase()===tk&&x.k!=='s')||ents().find(x=>String(x.tk).toUpperCase()===tk);if(e)s={name:e.name,P:[{e,w:1}]}}}
    CMP[i.dataset.pk]=s;CMP.add=null;renderCompare()});
  const aw=el.querySelector('[data-addw]');if(aw)aw.onchange=()=>{CMP.addW=+aw.value;CMP.B=withAdd(CMP.add.cur,CMP.add.e,CMP.addW);renderCompare()};
  if(!(CMP.A&&CMP.B))return;
  const [LA,LB]=[lookThrough(CMP.A.P),lookThrough(CMP.B.P)],[RA,RB]=await Promise.all([riskOf(CMP.A.P),riskOf(CMP.B.P)]);const SA=docScores(LA,RA,CMP.A.P),SB=docScores(LB,RB,CMP.B.P);
  let ab=null;if(RA&&RB){const pa=RA.pr,pb=RB.pr;ab=corr(pa,pb)}
  const row=(lab,a,b,fmt,lowerBetter)=>{const va=a,vb=b;const win=va==null||vb==null||va===vb?'':(lowerBetter?va<vb:va>vb)?'A':'B';const mx=Math.max(Math.abs(va||0),Math.abs(vb||0),1e-9);
    return `<div class="ix-cr"><span>${lab}</span><div class="ix-cv ${win==='A'?'win':''}"><i style="width:${Math.abs(va||0)/mx*100}%"></i><b>${fmt(va)}</b></div><div class="ix-cv b ${win==='B'?'win':''}"><i style="width:${Math.abs(vb||0)/mx*100}%"></i><b>${fmt(vb)}</b></div></div>`};
  const em=L=>Object.entries(L.C).filter(([c])=>EM.has(c)).reduce((a,[,v])=>a+v,0);
  const diff=(XA,XB,fmt,col)=>{const keys=[...new Set([...Object.keys(XA),...Object.keys(XB)])].filter(k=>k!=='XX'&&!/Sin desglose/.test(k)).sort((a,b)=>Math.max(XB[b]||0,XA[b]||0)-Math.max(XB[a]||0,XA[a]||0)).slice(0,8);
    return `<div class="ix-diff">${keys.map(k=>{const a=XA[k]||0,b=XB[k]||0,d=b-a;return `<div><span>${esc(fmt(k))}</span><i><b class="a" style="width:${a}%"></b><b class="b" style="width:${b}%"></b></i><em>${pct(a,0)} → ${pct(b,0)}${Math.abs(d)>=.5?` <small>(${d>0?'+':''}${d.toFixed(1).replace('.',',')})</small>`:''}</em></div>`}).join('')}</div>`};
  const chg=[];const dl=(n,a,b,f,u='')=>{if(a!=null&&b!=null&&Math.abs(b-a)>=(u==='pp'?.5:.05*Math.max(1,Math.abs(a))))chg.push(`${n} ${f(a)} → ${f(b)}`)};
  dl('volatilidad',RA&&RA.vol,RB&&RB.vol,v=>pct(v,1),'pp');dl('EE. UU.',LA.C.US||0,LB.C.US||0,v=>pct(v,0),'pp');dl('emergentes',em(LA),em(LB),v=>pct(v,0),'pp');dl('empresas efectivas',SA.neff,SB.neff,v=>Math.round(v));dl('10 mayores empresas',SA.top10,SB.top10,v=>pct(v,0),'pp');
  const ts=L=>Object.entries(L.S).filter(([k])=>!/Sin|Otros/.test(k)).sort((a,b)=>b[1]-a[1])[0];const sa=ts(LA);if(sa)dl(sa[0].toLowerCase(),sa[1],LB.S[sa[0]]||0,v=>pct(v,0),'pp');
  $('#ixCmpOut').innerHTML=`${chg.length?`<div class="ix-why"><b>${CMP.add?`Si incorporas ${esc(String(CMP.add.e.tk))} (${Math.round(CMP.addW*100)} %)`:'De A a B'}</b><p>${chg.join(' · ')}</p></div>`:'<p class="mp-note">Diferencias pequeñas entre A y B.</p>'}<div class="ix-leg"><span class="a">A · ${esc(CMP.A.name)}</span><span class="b">B · ${esc(CMP.B.name)}</span></div>
    <div class="ix-cmp">${row('Salud ATLAS',SA.health,SB.health,v=>v==null?'—':Math.round(v)+'/100')}${row('Rent. anual histórica',RA&&RA.cagr,RB&&RB.cagr,v=>pct(v,1))}${row('Volatilidad',RA&&RA.vol,RB&&RB.vol,v=>pct(v,1),1)}${row('Caída máxima',RA&&RA.dd,RB&&RB.dd,v=>pct(v,0))}
      ${row('Empresas efectivas',SA.neff,SB.neff,v=>v==null?'—':Math.round(v))}${row('10 mayores empresas',SA.top10,SB.top10,v=>pct(v,0),1)}${row('EE. UU.',LA.C.US||0,LB.C.US||0,v=>pct(v,0),1)}${row('Emergentes',em(LA),em(LB),v=>pct(v,0))}${row('Coste (TER)',LA.ter,LB.ter,v=>v==null?'—':pct(v,2),1)}</div>
    ${ab!=null?`<p class="pf-vs">🔗 Correlación entre A y B: <b>${ab.toFixed(2).replace('.',',')}</b> ${ab>.9?'(se mueven casi igual)':ab>.7?'(bastante parecidas)':'(se comportan de forma distinta)'}</p>`:''}
    <h5>Cambio de exposición por país (A → B)</h5>${diff(LA.C,LB.C,c=>CNAME[c]||c)}<h5>Cambio por sector (A → B)</h5>${diff(LA.S,LB.S,s=>s)}
    <div class="ix-btns"><button class="btn2" data-g="A">🌍 Globo de A</button><button class="btn2" data-g="B">🌍 Globo de B</button></div>
    <p class="mp-note">Verde = mejor en esa fila (menor en volatilidad, concentración, EE. UU. y costes; mayor en el resto). Riesgo y rentabilidad: precios semanales en euros de los últimos 5 años con los pesos de hoy. Composición: mayores posiciones conocidas de cada ETF.</p>`;
  $('#ixCmpOut').querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const s=CMP[b.dataset.g];showExposureGlobe(s.P,s.name)})}

/* ------------------------------ GLOBO DE EXPOSICIÓN ------------------------------ */
let GEO=null,XP=null,xpMode='geo';
async function loadCountries(){if(GEO)return GEO;GEO=await (await fetch('data/countries.geojson')).json();return GEO}
async function showExposureGlobe(P,name){await loadExpo();if(typeof map==='undefined'||!map||!mapReady){toast('El mapa aún se está cargando');return}closeHub();if(typeof closePlace==='function')closePlace();
  XP={P,name,L:lookThrough(P)};await loadCountries();drawExposure();renderXpBar();
  if(typeof sq!=='undefined'){sq.active=false;updateMap()}const tc=Object.entries(XP.L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1])[0],tf=tc&&GEO.features.find(f=>f.properties.c===tc[0]),ctr=tf?[(tf.properties.lx+10)/2,Math.max(-10,Math.min(45,(tf.properties.ly+30)/2))]:[10,30];
  map.flyTo({center:ctr,zoom:mobile()?0.9:1.6,pitch:0,bearing:0,duration:1200})}
function drawExposure(){if(!XP||!GEO)return;const m=map,L=XP.L,mx=Math.max(...Object.entries(L.C).filter(([c])=>c!=='XX').map(([,v])=>v),1);
  const fc={type:'FeatureCollection',features:GEO.features.map(f=>({...f,properties:{...f.properties,v:L.C[f.properties.c]||0,r:(L.C[f.properties.c]||0)/mx}}))};
  if(!m.getSource('xp-cty')){m.addSource('xp-cty',{type:'geojson',data:fc});
    m.addLayer({id:'xp-fill',type:'fill',source:'xp-cty',paint:{'fill-color':['interpolate',['linear'],['get','r'],0,'rgba(40,50,90,0.05)',0.001,'#1f3b73',0.05,'#2f6fb3',0.25,'#35b8e0',0.6,'#7fe8c8',1,'#ffe27a'],'fill-opacity':['case',['>',['get','v'],0],0.62,0.08]}});
    m.addLayer({id:'xp-line',type:'line',source:'xp-cty',paint:{'line-color':'rgba(200,220,255,0.35)','line-width':0.6}});
    m.addSource('xp-pts',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'xp-circ',type:'circle',source:'xp-pts',paint:{'circle-radius':['interpolate',['linear'],['get','w'],0,3,1,6,5,14,15,26],'circle-color':['get','c'],'circle-opacity':.75,'circle-stroke-color':'#fff','circle-stroke-width':.8}});
    m.addLayer({id:'xp-lbl',type:'symbol',source:'xp-pts',layout:{'text-field':['get','l'],'text-size':11,'text-offset':[0,1.6],'text-allow-overlap':false},paint:{'text-color':'#e9f0ff','text-halo-color':'#05060f','text-halo-width':1.4}});
    m.on('click','xp-fill',ev=>{if(!XP||xpMode!=='geo')return;const f=ev.features&&ev.features[0];if(f)openCountry(f.properties.c,f.properties.n)});
    m.on('click','xp-circ',ev=>{const f=ev.features&&ev.features[0];if(!f)return;const p=f.properties;if(p.cc)openCountry(p.cc,CNAME[p.cc]||p.cc)});
    m.on('mouseenter','xp-fill',()=>m.getCanvas().style.cursor='pointer');m.on('mouseleave','xp-fill',()=>m.getCanvas().style.cursor='')}
  else m.getSource('xp-cty').setData(fc);
  const vis=v=>['xp-fill','xp-line'].forEach(id=>m.setLayoutProperty(id,'visibility',v));vis(xpMode==='geo'?'visible':'none');
  const pts=[];if(xpMode==='comp'||xpMode==='sec'){const ll=c=>{const f=GEO.features.find(x=>x.properties.c===c);return f?[f.properties.lx,f.properties.ly]:null};
    L.comps.slice(0,60).forEach(c=>{if(xpMode==='sec'&&XP.sec&&c.sec!==XP.sec)return;const e=ents().find(x=>x.k==='s'&&(x.t===c.tk||ckey(x.name,x.t)===c.key));const g=e&&entGeo(e);const p=g?[g[1],g[0]]:ll(c.cc);if(!p)return;
      pts.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{w:c.w,l:c.name.split(' ').slice(0,2).join(' ')+' '+pct(c.w),c:SEC_C[c.sec]||'#c084fc',cc:c.cc}})})}
  m.getSource('xp-pts').setData({type:'FeatureCollection',features:pts})}
function renderXpBar(){let b=$('#xpbar');if(!XP){if(b)b.remove();return}if(!b){b=document.createElement('div');b.id='xpbar';document.body.appendChild(b)}
  const L=XP.L,top=Object.entries(L.C).filter(([c])=>c!=='XX').sort((a,b)=>b[1]-a[1]).slice(0,5),secs=Object.entries(L.S).filter(([s])=>!/Sin|Otros/.test(s)).sort((a,b)=>b[1]-a[1]);
  b.innerHTML=`<div class="xp-h"><b>🌍 Exposición real · ${esc(XP.name)}</b><button data-xpx aria-label="Cerrar">✕</button></div>
    <div class="xp-seg">${[['geo','Geografía'],['sec','Sectores'],['comp','Empresas']].map(([k,l])=>`<button data-xpm="${k}" aria-pressed="${xpMode===k}">${l}</button>`).join('')}</div>
    ${xpMode==='geo'?`<div class="xp-top">${top.map(([c,v])=>`<button data-cty="${c}"><span>${esc(CNAME[c]||c)}</span><b>${pct(v,0)}</b></button>`).join('')}</div><p class="xp-n">Toca un país para ver cómo estás expuesto a él.${L.C.XX?` ${pct(L.C.XX,0)} sin desglose por país.`:''}</p>`:''}
    ${xpMode==='sec'?`<div class="xp-top">${secs.slice(0,8).map(([s,v])=>`<button data-sec="${esc(s)}" class="${XP.sec===s?'on':''}" style="--c:${SEC_C[s]||'#7aa2ff'}"><span>${esc(s)}</span><b>${pct(v,0)}</b></button>`).join('')}</div><p class="xp-n">Las burbujas son las empresas${XP.sec?' de '+esc(XP.sec):''} en su sede.</p>`:''}
    ${xpMode==='comp'?`<p class="xp-n">Burbujas: tus mayores empresas en su sede (tamaño = peso en tu cartera, color = sector). Toca una para ver su país.</p>`:''}`;
  b.querySelector('[data-xpx]').onclick=()=>{hideExposure()};
  b.querySelectorAll('[data-xpm]').forEach(x=>x.onclick=()=>{xpMode=x.dataset.xpm;XP.sec=null;drawExposure();renderXpBar()});
  b.querySelectorAll('[data-cty]').forEach(x=>x.onclick=()=>openCountry(x.dataset.cty,CNAME[x.dataset.cty]||x.dataset.cty));
  b.querySelectorAll('[data-sec]').forEach(x=>x.onclick=()=>{XP.sec=XP.sec===x.dataset.sec?null:x.dataset.sec;drawExposure();renderXpBar()})}
function hideExposure(){XP=null;const m=map;['xp-fill','xp-line','xp-circ','xp-lbl'].forEach(id=>{if(m&&m.getLayer(id))m.setLayoutProperty(id,'visibility','none')});if(m&&m.getSource('xp-pts'))m.getSource('xp-pts').setData({type:'FeatureCollection',features:[]});renderXpBar()}
let CTY=null;
const CTY_ETF={US:'SPY',JP:'EWJ',IN:'INDA',CN:'MCHI',GB:'VGK',FR:'VGK',DE:'VGK',CH:'VGK',NL:'VGK',ES:'VGK',IT:'VGK',SE:'VGK',DK:'VGK',TW:'EEM',KR:'EEM',BR:'EEM'};
function openCountry(c,n){CTY={c,n};openHub('cty')}
async function renderCountry(){const el=$('#ixcty');if(!el||!CTY)return;const X=XP||(await (async()=>{const d=await docPortfolio();return d.P.length?{P:d.P,name:d.name,L:lookThrough(d.P)}:null})());
  if(!X){el.innerHTML='<p class="mp-note">Primero elige una cartera en Portfolio Doctor.</p>';return}const L=X.L,c=CTY.c,tot=L.C[c]||0,dir=L.dir[c]||0,ind=L.ind[c]||0;
  const by=(L.byC[c]||[]).sort((a,b)=>b.p-a.p),comps=L.comps.filter(x=>x.cc===c).slice(0,12),secs={};comps.forEach(x=>secs[x.sec||'Sin desglose']=(secs[x.sec||'Sin desglose']||0)+x.w);
  const pe=CTY_ETF[c]?ents().find(x=>x.t===CTY_ETF[c]):null,rk=pe&&RANK?RANK[priceKey(pe.k,pe.obj)]:null;
  el.innerHTML=`<div class="ix-cty"><div class="ix-big">${pct(tot)}<small>de ${esc(X.name)} en ${esc(CTY.n||CNAME[c]||c)}</small></div>
    <div class="ix-kpi"><div><span>Directa (acciones)</span><b>${pct(dir)}</b></div><div><span>Indirecta (ETFs y fondos)</span><b>${pct(ind)}</b></div></div>
    <h5>Activos responsables</h5>${by.map(b=>`<div class="ix-bar"><span>${esc(b.e.name)}</span><i><b style="width:${tot?b.p/tot*100:0}%;background:#7aa2ff"></b></i><em>${pct(b.p)}</em></div>`).join('')||'<p class="mp-note">Ninguno.</p>'}
    <h5>Empresas responsables</h5>${comps.length?comps.map(x=>`<div class="ix-bar"><span>${esc(x.name)}</span><i><b style="width:${tot?x.w/tot*100:0}%;background:${SEC_C[x.sec]||'#c084fc'}"></b></i><em>${pct(x.w,2)}</em></div>`).join(''):'<p class="mp-note">No hay empresas de este país entre las mayores posiciones conocidas.</p>'}
    ${comps.length?`<h5>Sectores (de esas empresas)</h5>${bars(secs,6,s=>s,s=>SEC_C[s]||'#7aa2ff')}`:''}
    <h5>Comportamiento del país</h5>${rk?`<div class="ix-kpi"><div><span>1 año (${esc(pe.tk)})</span><b>${pct(rk.r1y,1)}</b></div><div><span>3 años, anual</span><b>${pct(rk.r3y,1)}</b></div><div><span>Volatilidad</span><b>${pct(rk.vol,0)}</b></div><div><span>Caída máx. 1 año</span><b>${pct(rk.dd1y,0)}</b></div></div><p class="mp-note">Usando ${esc(pe.name)} como referencia del país${['VGK','EEM'].includes(CTY_ETF[c])?' (región, no solo el país)':''}.</p>`:'<p class="mp-note">ATLAS no tiene un ETF de referencia para este país: sin datos históricos propios.</p>'}
    <p class="mp-note">Las empresas se identifican con las mayores posiciones de cada ETF; el % del país viene del reparto por países de cada ETF (justETF) a ${esc((X.P.map(x=>expOf(x.e).asof).filter(Boolean).sort().pop())||'—')}.</p></div>`;
  const h=document.querySelector('.right .phead h2 .sp');if(h)h.textContent='🌍 '+(CTY.n||CNAME[c]||c)}

/* ------------------------------ integración con el menú y los paneles ------------------------------ */
function install(){if(typeof HUB==='undefined'||!document.getElementById('menu')||!document.querySelector('.right .pbody')){setTimeout(install,400);return}
  Object.assign(HUB,{doc:['🩺','Portfolio Doctor'],radar:['🎯','Opportunity Radar'],cmp:['⚖️','Comparar'],cty:['🌍','Exposición por país']});
  const pb=document.querySelector('.right .pbody');[['ixdoc','doc'],['ixradar','radar'],['ixcmp','cmp'],['ixcty','cty']].forEach(([id,s])=>{if(!document.getElementById(id)){const d=document.createElement('div');d.id=id;d.className='pf ix';d.dataset.s=s;pb.prepend(d)}});
  const st=document.createElement('style');st.textContent=['doc','radar','cmp','cty'].map(s=>`body.mapmode #app.simple .right[data-sec=${s}] .pbody>[data-s=${s}]{display:flex!important}`).join('');document.head.appendChild(st);
  const grid=document.querySelector('#menu .mn-grid');if(grid&&!grid.querySelector('[data-hub=doc]')){
    const mk=(k,i,l,sub,c)=>`<button data-hub="${k}" style="--c:${c}"><span class="mn-i">${i}</span><b>${l}</b><small>${sub}</small></button>`;
    grid.insertAdjacentHTML('afterbegin',mk('doc','🩺','Portfolio Doctor','Salud, solapamientos y riesgos','#ff6b8a')+mk('radar','🎯','Opportunity Radar','Qué merece atención y por qué','#4cd8a0')+mk('cmp','⚖️','Comparar','Carteras y ETFs lado a lado','#ffb35a')+mk('xp','🌍','Globo de exposición','Tu exposición real por país','#35e0ff'))}
  document.addEventListener('click',async e=>{const b=e.target.closest('#menu [data-hub=xp]');if(!b)return;e.stopPropagation();const m=document.getElementById('menu');if(m){m.hidden=true;document.body.classList.remove('menu-open');const bm=document.querySelector('.bb-menu');if(bm)bm.setAttribute('aria-expanded','false')}
    const d=await docPortfolio();if(!d.P.length){toast('Primero crea una cartera en Portfolio Doctor');openHub('doc');return}showExposureGlobe(d.P,d.name)},true);
  const orig=window.openHub;window.openHub=function(sec){orig(sec);if(sec==='doc')renderDoctor();if(sec==='radar')renderRadar();if(sec==='cmp')renderCompare();if(sec==='cty')renderCountry()};
  loadExpo()}
window.ATLASI={expOf,lookThrough,overlap,riskOf,docPortfolio,renderDoctor,renderRadar,renderCompare,showExposureGlobe,hideExposure,openCompare,openRadar,openCountry,loadExpo,scoreRadar,radarCandidates,get DOC(){return DOC},set DOC(v){DOC=v;saveDoc()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
