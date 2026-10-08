/* ATLAS · Motor de escenarios «¿Y si…?» (P0: infraestructura, sin interfaz)
   ─────────────────────────────────────────────────────────────────────────────
   Responde: «Si esta cartera cambiara de esta manera, ¿qué cambiaría cuantitativamente?».
   No responde: «¿Qué debería hacer el usuario?». No hay ganador, ni «mejor», ni recomendado.

   texto ─► parse() ─► Scenario (JSON v1) ─► build() ─► P1 ─► simulate() ─► simP(P0), simP(P1) ─► métricas + calidad + comparación + explicación
   · parse()    interpreta lenguaje (gramática española determinista, sin IA). No calcula métricas.
   · build()    función pura: aplica las operaciones en orden y devuelve pesos válidos (Σ = 1) o valid:false. No interpreta lenguaje.
   · simulate() usa el simulador existente (ATLASI.simP). No modifica pesos.
   Reproducible: misma cartera + mismo escenario + misma versión de datos = mismo JSON byte a byte
   (la ventana histórica termina en una fecha derivada de los datos de precios, nunca en la hora del navegador). */
(function(){'use strict';
const A=()=>window.ATLASI;
const V=1,PARSER='grammar@1';
const TYPES=['reduce','increase','set','remove','add','replace','redistribute','contrib','sectorTarget','countryTarget','riskTarget','overlapTarget','multi','none'];
const OPS=['set','adjust','shift','remove','add','replace','contrib'];
const CKEYS=['noSell','noNew','onlyExisting','maxProducts','maxTer','maxSector','minBonds','riskTol'];

/* ───────────── utilidades deterministas ───────────── */
const r6=x=>x==null||!isFinite(x)?null:Math.round(x*1e6)/1e6+0;      // +0 normaliza -0
const r4=x=>x==null||!isFinite(x)?null:Math.round(x*1e4)/1e4+0;
const r2=x=>x==null||!isFinite(x)?null:Math.round(x*100)/100+0;
const idOf=e=>e.k+':'+e.t;
const entOf=id=>{const i=String(id).indexOf(':');return i<0?null:A().entBy(id.slice(0,i),id.slice(i+1))||null};
const byId=(a,b)=>a<b?-1:a>b?1:0;
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{if(v[k]!==undefined)o[k]=canon(v[k])});return o}
  if(typeof v==='number')return r6(v);return v}
const cjson=v=>JSON.stringify(canon(v));
const fmt=(x,d=1)=>x==null?'—':(Math.round(x*10**d)/10**d).toFixed(d).replace('.',',').replace('-','−');
const nameOf=id=>{const e=entOf(id);if(!e)return id;const tk=String(e.tk||e.t);return tk!==e.t&&/^[A-Z0-9]{1,6}$/.test(e.t)?tk+' ('+e.t+')':tk};

/* ───────────── textos (tabla única: el test de lenguaje la escanea entera) ───────────── */
const TXT={
  none:'No se observa un cambio material en los escenarios explorados.',
  noneAdd:'Añadir {a} aumenta el número de productos, pero no produce un cambio material en la diversificación estimada{why}.',
  whyCorr:' porque su comportamiento histórico es muy similar al de activos que ya tienes',
  whyOvl:' porque su composición conocida se solapa en gran parte con la que ya tienes',
  oneSidedUp:'Los cambios materiales de este escenario van en la dirección de más diversificación, menos concentración o menos coste.',
  oneSidedDown:'Los cambios materiales de este escenario van en la dirección de menos diversificación, más concentración o más coste.',
  neutralOnly:'El escenario cambia la exposición (sectores, países, riesgo histórico), sin cambios materiales en diversificación, concentración ni coste.',
  mixed:'Este escenario mejora unas métricas y empeora otras: conviene mirar los dos lados.',
  line:'{l}: {b} → {a}',
  aProrata:'Redistribución pro-rata entre el resto de posiciones',
  aFundProrata:'El peso del nuevo producto se financia reduciendo el resto de posiciones pro-rata',
  aEqual:'Reparto a partes iguales entre los destinos indicados',
  aConst:'Precios constantes durante el periodo de aportaciones (no se proyectan rentabilidades)',
  aWeights:'Cartera definida por pesos: los importes se derivan del total indicado',
  wFrom:'El escenario fija {a} en {to} %. El peso actual detectado es {cur} %, no {exp} %.',
  wNoPx:'{a}: sin historial de precios suficiente; el contexto histórico y el riesgo no lo incluyen.',
  wCty:'{a} no publica desglose por país ({w} % de la cartera en el escenario).',
  wSec:'{a} no publica desglose por sector ({w} % de la cartera en el escenario).',
  wComp:'Exposición a empresas: cota inferior. La exposición real puede ser superior porque la base actual solo cubre las principales posiciones conocidas de cada ETF.',
  wOvl:'Solapamiento: cota inferior calculado con las principales posiciones publicadas, no con la composición completa.',
  wDiv:'Precio ajustado por dividendos según el proveedor; no verificado para todos los productos.',
  wNoDate:'No se pudo leer la fecha de los datos de precios: la ventana histórica usa la fecha actual y el resultado puede variar de un día a otro.',
  taxGain:'La venta implicaría una plusvalía estimada de {x} €, antes de considerar la fiscalidad personal.',
  taxLoss:'La venta implicaría una minusvalía estimada de {x} €, antes de considerar la fiscalidad personal.',
  taxNone:'El escenario no implica ventas.',
  taxNA:'Fiscalidad no calculable: la cartera está definida solo por pesos.',
  histLabel:'SIMULACIÓN HISTÓRICA',
  histNote:'Resultado histórico bajo este periodo y estos datos. No es una predicción ni una rentabilidad esperada.',
  histMethod:'Rentabilidad semanal en euros ponderada con pesos constantes (equivale a reequilibrar cada semana).',
  histSrc:'Cierres de Yahoo Finance / EODHD convertidos a euros (data/p)',
  /* violaciones */
  vNotHeld:'{a} no está en la cartera: no hay peso que mover.',
  vAmt:'Se piden {x} % de {a}, pero solo pesa {cur} %.',
  vShares:'Los repartos de destino deben sumar 100 % (suman {x} %).',
  vRange:'Peso fuera de rango (0–100 %).',
  vUnknown:'Producto desconocido en ATLAS: {a}.',
  vNoSell:'Restricción «sin vender»: el escenario reduce {a}.',
  vNoNew:'Restricción «sin productos nuevos»: el escenario añade {a}.',
  vMaxP:'Restricción de máximo {x} productos: el escenario tiene {n}.',
  vMaxTer:'Restricción de TER máximo {x} %: el escenario tiene {n} %.',
  vMaxSec:'Restricción de {s} máximo {x} %: el escenario tiene {n} %.',
  vMinBonds:'Restricción de bonos mínimo {x} %: el escenario tiene {n} %.',
  vRisk:'Restricción de riesgo: la volatilidad histórica sube de {b} % a {a} % (tolerancia {x} %).',
  vTotal:'Este escenario necesita importes: falta el valor actual de la cartera.',
  vGen:'Este objetivo necesita generar escenarios candidatos (fase P2). En P0 solo se simulan cambios explícitos.',
  vEmpty:'La cartera está vacía.',
  vFunding:'No hay peso suficiente en las posiciones de origen para financiar el cambio.',
  /* parser */
  qWhich:'Hay varios productos que encajan con «{p}» en tu cartera. ¿Cuál?',
  qPick:'¿Qué producto de «{p}» quieres usar en el escenario? Ordenados por TER (menor primero); el orden no es una recomendación.',
  qPickName:'Varios productos de ATLAS encajan con «{p}». ¿Cuál? Ordenados por TER (menor primero); el orden no es una recomendación.',
  qPpRel:'¿Quieres cambiar {a} en {x} puntos porcentuales ({cur} % → {pp} %) o un {x} % relativo ({cur} % → {rel} %)?',
  qTarget:'{a} pesa {cur} %. ¿Hasta qué peso quieres explorar?',
  qAddW:'¿Con qué peso quieres añadir {a}?',
  qMonths:'¿Durante cuántos meses?',
  qSector:'Tu exposición estimada a {s} es {cur} %. ¿Hasta dónde quieres explorar?',
  qSell:'¿Quieres hacerlo sin vender posiciones actuales?',
  qTotal:'¿Cuál es el valor actual total de la cartera? (necesario para simular aportaciones o ventas)',
  eVerb:'No he entendido el cambio. Prueba: «reduce QQQ al 15 %», «añade un 10 % de EEM», «quita SMH», «los próximos 300 € a VT».',
  eAsset:'No encuentro «{p}» en ATLAS. Prueba con el ticker (por ejemplo, VT, QQQ, EEM).',
  eShares:'Los porcentajes de reparto deben sumar 100 %.',
  eNum:'No he podido leer el porcentaje. Prueba: «reduce QQQ al 15 %».',
  eUnsupported:'Este tipo de escenario aún no está disponible. Prueba: «reduce QQQ al 15 %».',
  oOther:'Otro valor',oYes:'Sí, sin vender',oNo:'No, se puede vender',
  /* lectura (narrate) */
  nMoves:'Escenario: {m}.',nSpread:'El peso se reparte: {m}.',nUp:'Este escenario aumenta {l}.',nDown:'Este escenario reduce {l}.',nBoth:'Este escenario reduce {d}; a cambio, aumenta {u}.',
  nFlat:'Apenas cambia las apuestas efectivas ({b} → {a})',nMech:': el peso liberado pasa sobre todo a {to}, cuya correlación histórica con {from} es {c}',nMechO:' y que comparte al menos un {o} % de su composición conocida',
  nNone:'No se observa un cambio material en ninguna de las métricas comparadas.',nLB:'Las cifras de empresas y solapamiento son cotas inferiores.',
  /* ideas */
  iHead:'Explora modificaciones y compara su impacto. ATLAS no selecciona una opción ganadora.',
  iContrib:'Explorar reducciones de productos que contribuyen a esta exposición',iContribW:'Productos de tu cartera que aportan {x}, en orden alfabético. El orden no indica preferencia.',
  iPairs:'Explorar reducciones de los productos implicados',iPairsW:'Los dos productos señalados por el Doctor, en orden alfabético.',
  iRel:'Explorar reducciones de posiciones relevantes',iRelW:'Posiciones con al menos un 5 % de la cartera, en orden alfabético. El orden no indica preferencia.',
  iVol:'Explorar escenarios de menor volatilidad',iVolW:'Reducciones de cada posición, en orden alfabético; junto a cada una, su volatilidad histórica propia como información. No todas reducen la volatilidad de la cartera: el escenario lo muestra.',
  iAdd:'Explorar otras exposiciones (añadir un 10 %)',iAddW:'Elige una categoría y después el criterio con el que quieres ver los candidatos. Sin criterio no se muestra ninguna lista.',
  iAlt:'Explorar alternativas de la misma categoría',iAltW:'Productos de la misma categoría (no necesariamente del mismo índice). Elige el criterio de orden.',
  iKeep:'Mantener sin cambios',iKeepW:'Referencia: la cartera actual tal como está.',
  iAll:'Toda la cartera',
  cSec:'{x} pp de {s}',cCty:'{x} pp en {s}',cComp:'≥ {x} % de tu cartera en {s}',cW:'{x} % de la cartera',cVol:'volatilidad propia {x} %',cTer:'TER {x} %',
  oRed:'−10 pp',oRem:'Quitar'
};
const T=(k,o={})=>TXT[k].replace(/\{(\w+)\}/g,(_,x)=>o[x]==null?'':String(o[x]));

/* ───────────── versión de datos y fecha final de la ventana histórica ───────────── */
let _meta=null;
function loadMeta(){return _meta||(_meta=fetch('data/p/_meta.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null))}
/* Fin de ventana = último viernes con al menos 3 días de antigüedad respecto a la fecha de los precios.
   Así nunca entra la cotización intradía (data/live.json) y el resultado no depende de que el mercado esté abierto. */
function endFrom(iso){if(!iso)return null;const d=new Date(iso.slice(0,10)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-3);while(d.getUTCDay()!==5)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
async function dataVersion(){await A().loadExpo();const m=await loadMeta(),ex=A().EXPO;return 'expo:'+(ex&&ex.u||'?')+'|px:'+(m&&m.updated||'?')}
async function dataEnd(){const m=await loadMeta();return endFrom(m&&m.updated)}

/* ───────────── esquema ───────────── */
function emptyScenario(){return{v:V,type:'none',base:{sig:'',mode:'weights'},changes:[],objectives:[],constraints:{},assumptions:[],source:{text:'',parsedBy:PARSER}}}
const isId=x=>typeof x==='string'&&/^[a-z]+:.+/.test(x);
const isW=x=>typeof x==='number'&&isFinite(x)&&x>=0&&x<=1;
function validTo(to){if(to==='prorata')return true;if(!Array.isArray(to)||!to.length)return false;return to.every(t=>t&&isId(t.asset)&&isW(t.share))}
function validate(s){const err=[];if(!s||typeof s!=='object')return{ok:false,errors:['escenario vacío']};
  if(s.v!==V)err.push('v debe ser '+V);if(!TYPES.includes(s.type))err.push('type desconocido: '+s.type);
  if(!Array.isArray(s.changes))err.push('changes debe ser una lista');else s.changes.forEach((c,i)=>{const p='changes['+i+'] ';
    if(!c||!OPS.includes(c.op)){err.push(p+'op desconocida');return}
    if(c.op==='set'){if(!isId(c.asset)||!isW(c.to))err.push(p+'set necesita asset y to (0–1)');if(c.funding!=null&&!validTo(c.funding))err.push(p+'funding inválido')}
    if(c.op==='adjust'){if(!isId(c.asset)||(typeof c.pp!=='number')===(typeof c.rel!=='number'))err.push(p+'adjust necesita asset y pp o rel')}
    if(c.op==='shift'){if(!isId(c.from)||!isW(c.amt)||!validTo(c.to))err.push(p+'shift necesita from, amt (0–1) y to')}
    if(c.op==='remove'){if(!isId(c.asset)||!validTo(c.to))err.push(p+'remove necesita asset y to')}
    if(c.op==='add'){if(!isId(c.asset)||!isW(c.w)||c.w>=1)err.push(p+'add necesita asset y w (0–1)');if(!(c.funding==='prorata'||isId(c.funding)||validTo(c.funding)))err.push(p+'funding inválido')}
    if(c.op==='replace'){if(!isId(c.from)||!isId(c.to))err.push(p+'replace necesita from y to');if(c.amt!=null&&!isW(c.amt))err.push(p+'amt inválido')}
    if(c.op==='contrib'){if(!(c.monthly>0)||!(Number.isInteger(c.months)&&c.months>0)||!Array.isArray(c.alloc)||!c.alloc.length||!c.alloc.every(t=>isId(t.asset)&&isW(t.share)))err.push(p+'contrib necesita monthly, months y alloc')}});
  if(s.constraints&&typeof s.constraints==='object')Object.keys(s.constraints).forEach(k=>{if(!CKEYS.includes(k))err.push('restricción desconocida: '+k)});
  if(s.objectives&&!Array.isArray(s.objectives))err.push('objectives debe ser una lista');
  return{ok:!err.length,errors:err}}
/* forma canónica: claves ordenadas, destinos ordenados por id, números a 1e-6. Las operaciones conservan su orden (es semántico). */
function canonical(s){const c=JSON.parse(JSON.stringify(s));(c.changes||[]).forEach(x=>{['to','funding','alloc'].forEach(k=>{if(Array.isArray(x[k]))x[k]=x[k].slice().sort((a,b)=>byId(a.asset,b.asset))})});
  c.assumptions=[...new Set(c.assumptions||[])].sort();return canon(c)}
const keyOf=s=>{const c=canonical(s);delete c.source;return JSON.stringify(c)};

/* ───────────── cartera P0 normalizada ───────────── */
function normP(P){const m=new Map();(P||[]).forEach(x=>{const id=x.id||(x.e?idOf(x.e):null);const w=+x.w;if(!id||!(w>0))return;m.set(id,(m.get(id)||0)+w)});
  const t=[...m.values()].reduce((a,v)=>a+v,0);if(!t)return[];return fixSum([...m.entries()].map(([id,w])=>({id,w:w/t})))}
function fixSum(L){L=L.filter(x=>x.w>1e-7).sort((a,b)=>byId(a.id,b.id));const t=L.reduce((a,x)=>a+x.w,0);if(!t)return[];L.forEach(x=>x.w=r6(x.w/t));
  const d=r6(1-L.reduce((a,x)=>a+x.w,0));if(d){let k=0;L.forEach((x,i)=>{if(x.w>L[k].w)k=i});L[k].w=r6(L[k].w+d)}return L.filter(x=>x.w>0)}
const sigP=P=>P.map(x=>x.id+'='+x.w.toFixed(6)).join('|');

/* ───────────── build(): pura ───────────── */
function spread(m,amt,to,exclude){/* añade amt a destinos: 'prorata' (resto de posiciones) o lista explícita */
  if(to==='prorata'){const ks=[...m.keys()].filter(k=>!exclude.includes(k)&&m.get(k)>0).sort(byId),tw=ks.reduce((s,k)=>s+m.get(k),0);if(!(tw>0))return false;ks.forEach(k=>m.set(k,m.get(k)+amt*m.get(k)/tw));return true}
  to.slice().sort((a,b)=>byId(a.asset,b.asset)).forEach(t=>m.set(t.asset,(m.get(t.asset)||0)+amt*t.share));return true}
function take(m,amt,from,exclude){/* retira amt de orígenes: 'prorata' (resto), id concreto o lista */
  if(from==='prorata'){const ks=[...m.keys()].filter(k=>!exclude.includes(k)&&m.get(k)>0).sort(byId),tw=ks.reduce((s,k)=>s+m.get(k),0);if(tw+1e-9<amt)return false;ks.forEach(k=>m.set(k,m.get(k)-amt*m.get(k)/tw));return true}
  const L=typeof from==='string'?[{asset:from,share:1}]:from;for(const t of L)if((m.get(t.asset)||0)+1e-9<amt*t.share)return false;L.forEach(t=>m.set(t.asset,(m.get(t.asset)||0)-amt*t.share));return true}
function sharesOk(to){if(to==='prorata')return true;const s=to.reduce((a,t)=>a+t.share,0);return Math.abs(s-1)<1e-6?true:s}
function build(P0in,s,ctx={}){
  const out={valid:false,P1:[],assumptions:[],violations:[],warnings:[],values1:null};const v=validate(s);if(!v.ok){out.violations=v.errors.map(x=>({code:'SCHEMA',text:x}));return out}
  const P0=normP(P0in);if(!P0.length){out.violations.push({code:'EMPTY',text:T('vEmpty')});return out}
  const m=new Map(P0.map(x=>[x.id,x.w]));const asm=new Set(s.assumptions||[]),viol=[],warn=[];
  const known=id=>!!entOf(id),cur=id=>m.get(id)||0;let T0=null,vals=null;   // importes (solo si hay aportaciones)
  const needsAmounts=s.changes.some(c=>c.op==='contrib');
  if(needsAmounts){if(ctx.values&&Object.keys(ctx.values).length){T0=Object.values(ctx.values).reduce((a,x)=>a+(+x||0),0)}else if(ctx.total>0){T0=+ctx.total;asm.add(T('aWeights'))}
    if(!(T0>0)){out.violations.push({code:'NEEDS_TOTAL',text:T('vTotal')});return out}vals=new Map(P0.map(x=>[x.id,ctx.values&&ctx.values[x.id]!=null?+ctx.values[x.id]:x.w*T0]))}
  const ids=new Set();s.changes.forEach(c=>['asset','from'].forEach(k=>c[k]&&typeof c[k]==='string'&&ids.add(c[k]))||[c.to,c.funding,c.alloc].forEach(L=>{if(Array.isArray(L))L.forEach(t=>ids.add(t.asset));else if(isId(L))ids.add(L)}));
  ids.forEach(id=>{if(!known(id))viol.push({code:'UNKNOWN',text:T('vUnknown',{a:id})})});if(viol.length){out.violations=viol;return out}
  const fix=()=>{for(const [k,w] of m){if(w<0&&w>-1e-9)m.set(k,0)}};
  for(const c of s.changes){
    if(c.op==='set'||c.op==='adjust'){let to=c.to;const w=cur(c.asset);
      if(c.op==='adjust')to=c.pp!=null?w+c.pp:w*(1+c.rel);
      if(!(to>=-1e-9&&to<=1+1e-9)){viol.push({code:'RANGE',text:T('vRange')});break}to=Math.min(1,Math.max(0,to));
      if(c.expectFrom!=null&&Math.abs(c.expectFrom-w)>.005)warn.push(T('wFrom',{a:nameOf(c.asset),to:fmt(to*100,1),cur:fmt(w*100,1),exp:fmt(c.expectFrom*100,1)}));
      const d=to-w,fund=c.funding||'prorata';if(Math.abs(d)<1e-9)continue;
      if(d<0){m.set(c.asset,to);if(!spread(m,-d,fund,[c.asset])){viol.push({code:'FUNDING',text:T('vFunding')});break}if(fund==='prorata')asm.add(T('aProrata'))}
      else{if(!take(m,d,fund,[c.asset])){viol.push({code:'FUNDING',text:T('vFunding')});break}m.set(c.asset,to);if(fund==='prorata')asm.add(T('aProrata'))}}
    else if(c.op==='shift'){const w=cur(c.from);if(!(w>0)){viol.push({code:'NOT_HELD',text:T('vNotHeld',{a:nameOf(c.from)})});break}
      if(c.amt>w+1e-9){viol.push({code:'AMOUNT',text:T('vAmt',{x:fmt(c.amt*100,1),a:nameOf(c.from),cur:fmt(w*100,1)})});break}
      const sh=sharesOk(c.to);if(sh!==true){viol.push({code:'SHARES',text:T('vShares',{x:fmt(sh*100,1)})});break}
      m.set(c.from,w-c.amt);if(!spread(m,c.amt,c.to,[c.from])){viol.push({code:'FUNDING',text:T('vFunding')});break}if(c.to==='prorata')asm.add(T('aProrata'))}
    else if(c.op==='remove'){const w=cur(c.asset);if(!(w>0)){viol.push({code:'NOT_HELD',text:T('vNotHeld',{a:nameOf(c.asset)})});break}
      const sh=sharesOk(c.to);if(sh!==true){viol.push({code:'SHARES',text:T('vShares',{x:fmt(sh*100,1)})});break}
      m.set(c.asset,0);if(!spread(m,w,c.to,[c.asset])){viol.push({code:'FUNDING',text:T('vFunding')});break}if(c.to==='prorata')asm.add(T('aProrata'))}
    else if(c.op==='add'){const f=c.funding;
      if(f==='prorata'){for(const k of [...m.keys()])m.set(k,m.get(k)*(1-c.w));m.set(c.asset,(m.get(c.asset)||0)+c.w);asm.add(T('aFundProrata'))}
      else{const fl=isId(f)?[{asset:f,share:1}]:f;const sh=sharesOk(fl);if(sh!==true){viol.push({code:'SHARES',text:T('vShares',{x:fmt(sh*100,1)})});break}
        if(!take(m,c.w,fl,[])){viol.push({code:'AMOUNT',text:T('vAmt',{x:fmt(c.w*100,1),a:fl.map(t=>nameOf(t.asset)).join(' + '),cur:fmt(fl.reduce((a,t)=>a+cur(t.asset),0)*100,1)})});break}
        m.set(c.asset,(m.get(c.asset)||0)+c.w)}}
    else if(c.op==='replace'){const w=cur(c.from);if(!(w>0)){viol.push({code:'NOT_HELD',text:T('vNotHeld',{a:nameOf(c.from)})});break}
      const a=c.amt==null?w:c.amt;if(a>w+1e-9){viol.push({code:'AMOUNT',text:T('vAmt',{x:fmt(a*100,1),a:nameOf(c.from),cur:fmt(w*100,1)})});break}
      m.set(c.from,w-a);m.set(c.to,(m.get(c.to)||0)+a)}
    else if(c.op==='contrib'){const sh=sharesOk(c.alloc);if(sh!==true){viol.push({code:'SHARES',text:T('vShares',{x:fmt(sh*100,1)})});break}
      /* pesos actuales → importes, se suman las aportaciones y se vuelve a pesos. Precios constantes. */
      const Tn=[...vals.values()].reduce((a,x)=>a+x,0);const cv=new Map([...m.entries()].map(([k,w])=>[k,w*Tn]));
      const C=c.monthly*c.months;c.alloc.slice().sort((a,b)=>byId(a.asset,b.asset)).forEach(t=>cv.set(t.asset,(cv.get(t.asset)||0)+C*t.share));
      const T1=Tn+C;for(const k of new Set([...m.keys(),...cv.keys()]))m.set(k,(cv.get(k)||0)/T1);vals=cv;asm.add(T('aConst'))}
    fix()}
  if(!viol.length){for(const [k,w] of m)if(w<-1e-9){viol.push({code:'NEGATIVE',text:T('vRange')});break}}
  if(viol.length){out.violations=viol;out.warnings=warn;return out}
  const P1=fixSum([...m.entries()].map(([id,w])=>({id,w:Math.max(0,w)})));
  /* importes del escenario (para fiscalidad y «sin vender»): con aportaciones, los calculados; sin ellas, pesos × total si se conoce */
  let T1=null;if(vals){T1=[...vals.values()].reduce((a,x)=>a+x,0)}else if(ctx.values&&Object.keys(ctx.values).length){T1=Object.values(ctx.values).reduce((a,x)=>a+(+x||0),0)}else if(ctx.total>0)T1=+ctx.total;
  const values1=vals?Object.fromEntries([...vals.entries()].filter(([,v])=>v>1e-9).sort((a,b)=>byId(a[0],b[0])).map(([k,v])=>[k,r2(v)])):T1?Object.fromEntries(P1.map(x=>[x.id,r2(x.w*T1)])):null,values0=T1&&!vals?Object.fromEntries(P0.map(x=>[x.id,r2(ctx.values&&ctx.values[x.id]!=null?+ctx.values[x.id]:x.w*T1)])):T0?Object.fromEntries(P0.map(x=>[x.id,r2(ctx.values&&ctx.values[x.id]!=null?+ctx.values[x.id]:x.w*T0)])):null;
  /* restricciones */
  const cs=s.constraints||{},p0=new Map(P0.map(x=>[x.id,x.w]));
  if(cs.noSell){const fall=values0&&values1?P0.filter(x=>(values1[x.id]||0)+Math.max(.01,1e-5*T1)<values0[x.id]):P0.filter(x=>(P1.find(y=>y.id===x.id)||{w:0}).w+1e-6<x.w);fall.forEach(x=>viol.push({code:'NO_SELL',text:T('vNoSell',{a:nameOf(x.id)})}))}
  if(cs.noNew||cs.onlyExisting)P1.filter(x=>!p0.has(x.id)).forEach(x=>viol.push({code:'NO_NEW',text:T('vNoNew',{a:nameOf(x.id)})}));
  if(cs.maxProducts!=null&&P1.length>cs.maxProducts)viol.push({code:'MAX_PRODUCTS',text:T('vMaxP',{x:cs.maxProducts,n:P1.length})});
  if(cs.maxTer!=null||cs.maxSector||cs.minBonds!=null){const L=A().lookThrough(P1.map(x=>({e:entOf(x.id),w:x.w})));
    if(cs.maxTer!=null&&L.ter!=null&&L.ter>cs.maxTer+1e-9)viol.push({code:'MAX_TER',text:T('vMaxTer',{x:fmt(cs.maxTer,2),n:fmt(L.ter,2)})});
    if(cs.maxSector)Object.keys(cs.maxSector).sort().forEach(k=>{const v2=L.S[k]||0;if(v2>cs.maxSector[k]*100+1e-6)viol.push({code:'MAX_SECTOR',text:T('vMaxSec',{s:k,x:fmt(cs.maxSector[k]*100,1),n:fmt(v2,1)})})});
    if(cs.minBonds!=null&&(L.AC.Bonos||0)+1e-6<cs.minBonds*100)viol.push({code:'MIN_BONDS',text:T('vMinBonds',{x:fmt(cs.minBonds*100,1),n:fmt(L.AC.Bonos||0,1)})})}
  if(s.type==='sectorTarget'||s.type==='countryTarget'||s.type==='riskTarget'||s.type==='overlapTarget'){if(!s.changes.length)viol.push({code:'GENERATOR_P2',text:T('vGen')})}
  out.valid=!viol.length;out.P1=out.valid?P1:[];out.violations=viol;out.warnings=warn;out.assumptions=[...asm].sort();out.values0=values0;out.values1=out.valid?values1:null;return out}

/* ───────────── simulación (un único simulador: ATLASI.simP) ───────────── */
const _sim=new Map(),_res=new Map();
function simOf(P,end){const k=sigP(P)+'@'+end;if(!_sim.has(k))_sim.set(k,A().simP(P.map(x=>({e:entOf(x.id),w:x.w})),{r3:true,end:end||undefined}));return _sim.get(k)}
function clearCache(){_sim.clear();_res.clear()}

/* calidad de dato a partir de la cobertura real */
function qCov(cov,full=99.5){return cov>=full?'DATA':cov>=60?'ESTIMATE':'INCOMPLETE'}
function gapsOf(S,dim){/* productos sin desglose en esa dimensión, con su peso */
  return S.P.filter(x=>x.e.k!=='s'&&A().expOf(x.e).q[dim]==='none').map(x=>({id:idOf(x.e),w:r4(x.w*100)})).sort((a,b)=>byId(a.id,b.id))}
/* Dirección fija. P1: «Salud» (total) y «Mayor posición» pasan a ser neutras (solo «cambia»): la salud mezcla riesgo con diversificación y un ETF mundial
   grande no es concentración económica. Direccionales: diversificación, concentración en productos sueltos/sectoriales/temáticos, empresas, solapamiento y coste. */
const DIR={bets:'up',narrow:'down',topCo:'down',top10Co:'down',ovl:'down',ter:'down','dim:dv':'up','dim:cn':'up','dim:co':'up'};
const THR={bets:.15,health:2,narrow:3,dim:3,sec:3,cty:3,ac:3,em:3,ovl:3,vol:.5,dd:1,ter:.02,topPos:3,topCo:1,top10Co:3,n:1};
const thrOf=id=>THR[id]!=null?THR[id]:THR[id.split(':')[0]];
const LBL={bets:'Apuestas efectivas',health:'Salud de la cartera (total)',narrow:'Productos sueltos, sectoriales o temáticos',topPos:'Mayor posición (dependencia de un producto)',n:'Número de productos',topCo:'Mayor empresa',top10Co:'10 mayores empresas',ovl:'Solapamiento medio entre ETFs',
  ter:'TER medio ponderado',vol:'Volatilidad histórica anual',dd:'Caída máxima histórica',em:'Mercados emergentes'};
const UNIT={bets:'',health:'',n:'',ter:'%','dim:dv':'','dim:cn':'','dim:rk':'','dim:co':''};
const METH={
  bets:'Ratio de diversificación al cuadrado sobre rentabilidades semanales en euros de 5 años (correlaciones negativas a 0). Mide comportamiento de precios, no clasificación económica.',
  health:'Media de las dimensiones de salud de ATLAS (diversificación, concentración, sectores, países, correlación, riesgo, solapamiento y coste).',
  topPos:'Peso del mayor producto. Mide dependencia de un solo producto y su gestora, no concentración económica: un ETF mundial grande puede estar muy diversificado.',
  narrow:'Peso en acciones individuales y ETFs con más del 60 % en un sector (misma lógica que «Concentración por producto» del Doctor).',
  dim:'Dimensión de la salud de ATLAS (media de sus componentes, 0–100). Diversificación, concentración y coste tienen dirección; riesgo solo «cambia» porque menos volatilidad no es por sí misma una cartera mejor.',n:'Número de productos con peso.',
  topCo:'Suma del peso de la empresa en cada ETF (posiciones publicadas) más la posición directa. Cota inferior si el ETF no publica toda su cartera.',
  top10Co:'Suma de las 10 mayores empresas por dentro de la cartera (posiciones publicadas). Cota inferior.',
  ovl:'Media ponderada del solapamiento entre cada par de ETFs: Σ mín(peso en A, peso en B) de las empresas comunes publicadas. Cota inferior.',
  ter:'Coste anual medio ponderado (TER publicado).',vol:'Desviación típica anualizada de la rentabilidad semanal en euros (5 años).',dd:'Mayor caída desde máximos con rentabilidad semanal en euros (5 años).',
  sec:'Peso × reparto sectorial publicado de cada producto.',cty:'Peso × reparto por país publicado de cada producto.',ac:'Peso × clase de activo de cada producto.',em:'Suma de países emergentes (lista MSCI) por dentro de la cartera.'};
function metricsOf(S){/* vector de métricas de una cartera simulada (reutiliza metOf, docScores, lookThrough y riskOf vía simP) */
  const m=A().metOf(S),L=S.L,R=S.R,SC=S.SC,unk=L.S[A().UNK]||0,secCov=100-unk,ccCov=L.ccCover,pxCov=R?R.coverage*100:0,pxOk=R&&R.weeks>=104&&R.coverage>=.9;
  const top=S.P.slice().sort((a,b)=>b.w-a.w||byId(idOf(a.e),idOf(b.e)))[0];const c0=L.comps[0];
  const M={};
  M.bets={v:m.bets,q:pxOk?'MODEL':'INCOMPLETE',cov:r2(pxCov),conf:SC.bets&&SC.bets.rob?SC.bets.rob.conf:null,cls:SC.bets&&SC.bets.rob?SC.bets.rob.cls:null};
  M.health={v:m.health,q:SC.miss&&SC.miss.length>=3?'INCOMPLETE':'MODEL',cov:null,missing:(SC.miss||[]).slice().sort()};
  M.topPos={v:top?top.w*100:null,q:'DATA',cov:100,name:top?idOf(top.e):null};
  M.narrow={v:SC.narrow,q:'DATA',cov:100};
  (A().DIMS||[]).forEach(([id,,,keys])=>{const v=A().dimOf(SC,keys);M['dim:'+id]={v,q:v==null?'INCOMPLETE':'MODEL',cov:null}});
  M.n={v:S.P.length,q:'DATA',cov:100};
  M.topCo={v:c0?c0.w:null,q:c0&&c0.exact?'DATA':L.cover<60?'INCOMPLETE':'ESTIMATE',cov:r2(L.cover),bound:c0&&c0.exact?null:'lower',name:c0?c0.name:null};
  M.top10Co={v:SC.top10,q:L.cover<60?'INCOMPLETE':'ESTIMATE',cov:r2(L.cover),bound:'lower'};
  M.ovl={v:SC.ovAvg,q:SC.ovAvg==null?'INCOMPLETE':'ESTIMATE',cov:r2(L.cover),bound:'lower'};
  M.ter={v:L.ter,q:L.terW>=.99?'DATA':L.terW>=.6?'ESTIMATE':'INCOMPLETE',cov:r2(L.terW*100)};
  M.vol={v:R?R.vol:null,q:pxOk?'MODEL':'INCOMPLETE',cov:r2(pxCov)};M.dd={v:R?R.dd:null,q:pxOk?'MODEL':'INCOMPLETE',cov:r2(pxCov)};
  M.em={v:m.em,q:qCov(ccCov)==='DATA'?'ESTIMATE':qCov(ccCov),cov:r2(ccCov),bound:ccCov<99.5?'lower':null};
  Object.keys(L.S).filter(k=>k!==A().UNK&&k!=='Otros').forEach(k=>{M['sec:'+k]={v:L.S[k],q:qCov(secCov),cov:r2(secCov),bound:secCov<99.5?'lower':null}});
  Object.keys(L.C).filter(k=>k!=='XX').forEach(k=>{M['cty:'+k]={v:L.C[k],q:qCov(ccCov),cov:r2(ccCov),bound:ccCov<99.5?'lower':null}});
  Object.keys(L.AC).forEach(k=>{M['ac:'+k]={v:L.AC[k],q:'DATA',cov:100}});
  return M}
const DIML={dv:'Diversificación',cn:'Concentración',rk:'Riesgo',co:'Coste'};
function labelOf(id){if(LBL[id])return LBL[id];if(id.startsWith('dim:'))return 'Salud · '+DIML[id.slice(4)];const [p,k]=[id.slice(0,id.indexOf(':')),id.slice(id.indexOf(':')+1)];
  if(p==='sec')return 'Sector · '+k;if(p==='cty'){const n=(A().CNAME&&A().CNAME[k])||k;return 'País · '+n}if(p==='ac')return 'Clase de activo · '+k;return id}
const unitOf=id=>id in UNIT?UNIT[id]:'%';
const QRANK={DATA:0,ESTIMATE:1,MODEL:2,INCOMPLETE:3};
function pickIds(M0,M1){/* qué métricas se comparan: las fijas + 3 mayores sectores/países/clases de P0 ∪ P1 (orden determinista) */
  const top=(pre,M)=>Object.keys(M).filter(k=>k.startsWith(pre)).sort((a,b)=>(M[b].v-M[a].v)||byId(a,b)).slice(0,3);
  const fixed=['bets','narrow','topPos','n','topCo','top10Co','ovl','ter','vol','dd','em','dim:dv','dim:cn','dim:rk','dim:co','health'];const dyn=[];
  ['sec:','cty:','ac:'].forEach(pre=>{const s=new Set([...top(pre,M0),...top(pre,M1)]);[...s].sort((a,b)=>((M0[b]?M0[b].v:0)-(M0[a]?M0[a].v:0))||byId(a,b)).forEach(k=>dyn.push(k))});return fixed.concat(dyn)}
function compareM(M0,M1,objectives){
  const obj=new Map((objectives||[]).map(o=>[o.metric,o]));const ids=pickIds(M0,M1);const metrics=[],improves=[],changes=[],worsens=[];
  ids.forEach(id=>{const a=M0[id]||{v:0,q:M1[id]?M1[id].q:'DATA',cov:M1[id]?M1[id].cov:null},b=M1[id]||{v:0,q:a.q,cov:a.cov};
    const before=a.v==null?null:a.v,after=b.v==null?null:b.v,delta=before!=null&&after!=null?after-before:null;
    const q=QRANK[a.q]>=QRANK[b.q]?a.q:b.q,bound=a.bound==='lower'||b.bound==='lower'?'lower':null,thr=thrOf(id),material=delta!=null&&Math.abs(delta)>=thr-1e-9;
    const o=obj.get(id),dir=o?(o.dir==='min'?'down':'up'):DIR[id]||null;
    let cls=null;if(material){if(!dir)cls='changes';else cls=(delta>0)===(dir==='up')?'improves':'worsens';(cls==='improves'?improves:cls==='worsens'?worsens:changes).push(id)}
    const row={id,label:labelOf(id),unit:unitOf(id),before:id==='bets'?r4(before):r2(before),after:id==='bets'?r4(after):r2(after),delta:id==='bets'?r4(delta):r2(delta),
      quality:q,coverage:{before:a.cov==null?null:a.cov,after:b.cov==null?null:b.cov},bound,material,dir:dir||'neutral',cls,objective:!!o};
    if(a.name!==undefined||b.name!==undefined)row.names={before:a.name||null,after:b.name||null};
    row.why=whyText(row);metrics.push(row)});
  let materiality='none',direction=null;
  if(improves.length&&worsens.length){materiality='mixed';direction='both'}else if(improves.length||worsens.length){materiality='oneSided';direction=improves.length?'improves':'worsens'}
  else if(changes.length){materiality='oneSided';direction='neutral'}
  return{metrics,improves,changes,worsens,materiality,direction}}
function vtxt(row,x){if(x==null)return '—';const u=row.unit,d=row.id==='bets'?(Math.abs(row.delta||0)<.05?2:1):row.id==='ter'?2:row.id==='n'||row.id==='health'||row.id.startsWith('dim:')?0:1;return (row.bound==='lower'&&u==='%'?'≥ ':'')+fmt(x,d)+(u==='%'?' %':'')}
function whyText(row){const base=METH[row.id]||METH[row.id.split(':')[0]]||'';
  const q={DATA:'Dato publicado',ESTIMATE:'Estimación',MODEL:'Modelo estadístico',INCOMPLETE:'Información incompleta'}[row.quality];
  const cov=row.coverage&&row.coverage.after!=null&&row.coverage.after<99.5?` Cobertura del dato en el escenario: ${fmt(row.coverage.after,0)} % del peso.`:'';
  const b=row.bound==='lower'?' Es una cota inferior: el valor real puede ser superior.':'';return `${q}. ${base}${cov}${b}`}

function historyOf(S0,S1){const R0=S0.R,R1=S1.R;if(!R0||!R1)return null;
  const blk=R=>({cagr:r2(R.cagr),vol:r2(R.vol),dd:r2(R.dd),worst12:r2(R.worst12),weeks:R.weeks});
  const from=[R0.grid[0],R0.firstData,R1.firstData].filter(Boolean).sort().pop();
  return{label:T('histLabel'),quality:'MODEL',period:{from,to:R0.grid[R0.grid.length-1],years:5},before:blk(R0),after:blk(R1),source:T('histSrc'),method:T('histMethod'),dividends:T('wDiv'),note:T('histNote')}}
function taxOf(b,ctx){if(!(ctx.mode==='amounts'&&ctx.inv&&b.values0&&b.values1))return{calculable:false,quality:'MODEL',text:T('taxNA')};
  const rows=[];Object.keys(b.values0).sort().forEach(id=>{const v0=b.values0[id],v1=b.values1[id]||0,inv=ctx.inv[id];if(!(v1+.005<v0)||inv==null)return;const f=(v0-v1)/v0,g=f*(v0-inv);rows.push({id,soldValue:r2(v0-v1),gain:r2(g)})});
  const G=r2(rows.reduce((a,r)=>a+r.gain,0));return{calculable:true,quality:'MODEL',basis:'coste medio',realizedGain:rows.length?G:0,rows,text:!rows.length?T('taxNone'):G>=0?T('taxGain',{x:fmt(G,0)}):T('taxLoss',{x:fmt(-G,0)})}}

async function simulate(P0in,s,ctx={}){
  s=s||emptyScenario();await A().loadExpo();const dv=await dataVersion(),end=ctx.end||await dataEnd();
  const P0=normP(P0in),cx={mode:ctx.mode||'weights',total:ctx.total||null,values:ctx.values?canon(ctx.values):null,inv:ctx.inv?canon(ctx.inv):null};
  const key=[sigP(P0),keyOf(s),dv,end||'now',JSON.stringify(canon(cx))].join('#');if(_res.has(key))return _res.get(key);
  const pr=(async()=>{
    const head={key,v:V,dataVersion:dv,asof:{prices:(await loadMeta()||{}).updated||null,expo:(A().EXPO||{}).u||null,end:end||null},scenario:canonical(s)};
    if(!P0.length)return{...head,valid:false,empty:true,P0:[],P1:[],violations:[{code:'EMPTY',text:T('vEmpty')}],warnings:[],assumptions:[],metrics:[],improves:[],changes:[],worsens:[],materiality:'none',summary:[],history:null,tax:null};
    const b=build(P0,s,{...cx,values:ctx.values,inv:ctx.inv});
    if(!b.valid){const ask=b.violations.some(v=>v.code==='NEEDS_TOTAL')?{question:T('qTotal'),field:'ctx.total',options:[5000,10000,25000,50000,100000].map(x=>({label:fmt(x,0)+' €',value:x})).concat([{label:T('oOther'),value:null}])}:null;
      return{...head,valid:false,P0,P1:[],violations:b.violations,warnings:b.warnings,assumptions:b.assumptions,ask,metrics:[],improves:[],changes:[],worsens:[],materiality:'none',summary:[],history:null,tax:null}}
    const [S0,S1]=await Promise.all([simOf(P0,end),simOf(b.P1,end)]);
    const M0=metricsOf(S0),M1=metricsOf(S1),cmp=compareM(M0,M1,s.objectives);
    const warn=b.warnings.slice();if(!end)warn.push(T('wNoDate'));
    const pxIds=new Set(((S1.R&&S1.R.assets)||[]).map(idOf));b.P1.filter(x=>!pxIds.has(x.id)).forEach(x=>warn.push(T('wNoPx',{a:nameOf(x.id)})));
    gapsOf(S1,'country').forEach(g=>warn.push(T('wCty',{a:nameOf(g.id),w:fmt(g.w,1)})));gapsOf(S1,'sector').forEach(g=>warn.push(T('wSec',{a:nameOf(g.id),w:fmt(g.w,1)})));
    if(cmp.metrics.some(r=>(r.id==='topCo'||r.id==='top10Co')&&r.bound==='lower'))warn.push(T('wComp'));if(cmp.metrics.some(r=>r.id==='ovl'&&r.before!=null))warn.push(T('wOvl'));
    /* restricción de riesgo (necesita la simulación) */
    const viol=[];const rt=s.constraints&&s.constraints.riskTol;if(rt!=null&&S0.R&&S1.R&&S1.R.vol>S0.R.vol*(1+rt)+1e-9)viol.push({code:'RISK',text:T('vRisk',{b:fmt(S0.R.vol,1),a:fmt(S1.R.vol,1),x:fmt(rt*100,0)})});
    const summary=summaryOf(s,cmp,S0,S1,b.P1,P0);
    /* mecanismo: de dónde sale y adónde va la mayor parte del peso, con su correlación histórica y solapamiento conocido */
    const mv=movesTxt(P0,b.P1),src=mv.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta||byId(a.id,b.id))[0],dst=mv.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta||byId(a.id,b.id))[0];
    let mechanism=null;if(src&&dst){const RR=S1.R&&S1.R.assets.some(e=>idOf(e)===src.id)?S1.R:S0.R,i=RR?RR.assets.findIndex(e=>idOf(e)===src.id):-1,j=RR?RR.assets.findIndex(e=>idOf(e)===dst.id):-1;
      const RR2=(i<0||j<0)&&S1.R?S1.R:RR,i2=RR2?RR2.assets.findIndex(e=>idOf(e)===src.id):-1,j2=RR2?RR2.assets.findIndex(e=>idOf(e)===dst.id):-1;
      const c=i2>=0&&j2>=0?RR2.M[i2][j2]:null,o=A().overlap(entOf(src.id),entOf(dst.id));
      mechanism={from:src.id,to:dst.id,fromDelta:src.delta,toDelta:dst.delta,toShare:r4(dst.delta/mv.filter(x=>x.delta>0).reduce((a,x)=>a+x.delta,0)),corr:r4(c),overlap:r2(o),overlapBound:'lower'}}
    const gaps={country:gapsOf(S1,'country'),sector:gapsOf(S1,'sector'),prices:b.P1.filter(x=>!pxIds.has(x.id)).map(x=>x.id)};
    const res={...head,valid:!viol.length,P0,P1:b.P1,moves:movesTxt(P0,b.P1),violations:viol,warnings:[...new Set(warn)],assumptions:b.assumptions,
      metrics:cmp.metrics,improves:cmp.improves,changes:cmp.changes,worsens:cmp.worsens,materiality:cmp.materiality,direction:cmp.direction,summary,gaps,mechanism,
      history:historyOf(S0,S1),tax:taxOf(b,cx),values:b.values1?{before:b.values0,after:b.values1}:null};
    return JSON.parse(cjson(res))})();
  _res.set(key,pr);if(_res.size>200)_res.delete(_res.keys().next().value);return pr}
function movesTxt(P0,P1){const a=new Map(P0.map(x=>[x.id,x.w])),b=new Map(P1.map(x=>[x.id,x.w]));return [...new Set([...a.keys(),...b.keys()])].sort(byId).map(id=>({id,from:r6(a.get(id)||0),to:r6(b.get(id)||0),delta:r6((b.get(id)||0)-(a.get(id)||0))})).filter(x=>Math.abs(x.delta)>1e-6)}
function summaryOf(s,cmp,S0,S1,P1,P0){const out=[];
  if(cmp.materiality==='none'){const add=s.changes.find(c=>c.op==='add');
    if(add){let why='';const R=S1.R,i=R?R.assets.findIndex(e=>idOf(e)===add.asset):-1;
      if(i>=0){const cs=R.assets.map((e,j)=>j===i?null:R.M[i][j]).filter(x=>x!=null);const mx=cs.length?Math.max(...cs):null;if(mx!=null&&mx>=.85)why=T('whyCorr')}
      if(!why){const e=entOf(add.asset);const os=P0.filter(x=>x.id!==add.asset).map(x=>A().overlap(e,entOf(x.id))).filter(x=>x!=null);if(os.length&&Math.max(...os)>=50)why=T('whyOvl')}
      if(P0.some(x=>x.id===add.asset)&&!why)why=T('whyCorr');out.push(T('noneAdd',{a:nameOf(add.asset),why}))}else out.push(T('none'));return out}
  const pick=ids=>ids.map(id=>cmp.metrics.find(r=>r.id===id)).filter(Boolean);
  pick(cmp.improves.concat(cmp.worsens,cmp.changes)).slice(0,6).forEach(r=>out.push(T('line',{l:r.label,b:vtxt(r,r.before),a:vtxt(r,r.after)})));
  out.push(cmp.direction==='both'?T('mixed'):cmp.direction==='improves'?T('oneSidedUp'):cmp.direction==='worsens'?T('oneSidedDown'):T('neutralOnly'));return out}

/* ───────────── explain(): determinista, sin IA ───────────── */
function explain(res,id){const r=res&&res.metrics&&res.metrics.find(x=>x.id===id);if(!r)return null;
  const ch=r.delta==null?'No se puede comparar: falta el dato en una de las dos carteras.':`${r.label} pasa de ${vtxt(r,r.before)} a ${vtxt(r,r.after)}${r.material?'':' (cambio por debajo del umbral de materialidad)'}.`;
  const mv=(res.moves||[]).map(x=>`${nameOf(x.id)} ${fmt(x.from*100,1)} → ${fmt(x.to*100,1)} %`).join(' · ');
  const text=[ch,mv?`Cambio de pesos: ${mv}.`:'',r.why,res.assumptions&&res.assumptions.length?`Supuestos: ${res.assumptions.join('; ')}.`:''].filter(Boolean).join(' ');
  return{text,inputs:{before:r.before,after:r.after,delta:r.delta,quality:r.quality,coverage:r.coverage,bound:r.bound,moves:res.moves||[],dataVersion:res.dataVersion,end:res.asof&&res.asof.end},
    method:METH[id]||METH[id.split(':')[0]]||''}}

/* ───────────── aportaciones: meses hasta un peso objetivo (precios constantes) ───────────── */
function monthsTo(P0in,ctx,alloc,monthly,asset,target){const P0=normP(P0in);const Tt=ctx&&ctx.values&&Object.keys(ctx.values).length?Object.values(ctx.values).reduce((a,x)=>a+(+x||0),0):ctx&&ctx.total;
  if(!(Tt>0))return{months:null,reason:'NEEDS_TOTAL',text:T('vTotal')};const w=(P0.find(x=>x.id===asset)||{w:0}).w,V0=ctx.values&&ctx.values[asset]!=null?+ctx.values[asset]:w*Tt,sh=(alloc.find(t=>t.asset===asset)||{share:0}).share;
  const cur=V0/Tt;if(Math.abs(cur-target)<1e-9)return{months:0,assumptions:[T('aConst')]};
  const den=monthly*(target-sh);if(Math.abs(den)<1e-12)return{months:null,reason:'UNREACHABLE',assumptions:[T('aConst')]};
  const m=(V0-target*Tt)/den;if(!(m>0))return{months:null,reason:'UNREACHABLE',assumptions:[T('aConst')]};return{months:Math.ceil(m-1e-9),exact:r4(m),assumptions:[T('aConst')]}}

/* ───────────── exploración (sin orden de preferencia por defecto) ───────────── */
const SORTS={overlap:{dir:'asc',label:'Menor solapamiento con la cartera (cota inferior)'},ter:{dir:'asc',label:'Menor TER'},vol:{dir:'asc',label:'Menor volatilidad histórica de la cartera resultante'},
  bets:{dir:'desc',label:'Mayor aumento de apuestas efectivas'},countries:{dir:'desc',label:'Más países por encima del 1 % en la cartera resultante'},corr:{dir:'asc',label:'Menor correlación histórica con la cartera'},
  id:{dir:'asc',label:'Ticker (orden alfabético)'}};
const mkScn=(type,changes,base)=>({...emptyScenario(),type,changes,base:base||{sig:'',mode:'weights'},source:{text:'',parsedBy:'explore@1'}});
async function removals(P0in,ctx={}){const P0=normP(P0in);if(P0.length<2)return{order:'id',items:[]};const items=[];
  for(const x of P0)items.push(await simulate(P0,mkScn('remove',[{op:'remove',asset:x.id,to:'prorata'}]),ctx));return{order:'id',orderLabel:SORTS.id.label,items}}
async function reductions(P0in,ctx={},pp=.10){const P0=normP(P0in),items=[];for(const x of P0){if(x.w<=pp+1e-9)continue;items.push(await simulate(P0,mkScn('reduce',[{op:'shift',from:x.id,amt:pp,to:'prorata'}]),ctx))}
  if(P0.length<=6)for(let i=0;i<P0.length;i++)for(let j=i+1;j<P0.length;j++){const a=P0[i],b=P0[j];if(a.w<pp/2||b.w<pp/2)continue;
    items.push(await simulate(P0,mkScn('multi',[{op:'shift',from:a.id,amt:pp/2,to:'prorata'},{op:'shift',from:b.id,amt:pp/2,to:'prorata'}]),ctx))}
  return{order:'id',orderLabel:SORTS.id.label,items}}
function universe(tag){const E=searchEntities().filter(e=>(e.k==='e'||e.k==='f')&&!e.obj.lev&&!/\b(2x|3x|ultra|leveraged|apalanc)/i.test(e.name+' '+(e.obj.n||'')));
  if(tag)return E.filter(e=>A().tagsOf(e).includes(tag)&&!(A().assetClass(e)==='Acciones'&&A().isNarrow(e)));const c=A().candidates();return[...new Set(Object.keys(c).sort().flatMap(k=>c[k]))]}
async function additions(P0in,ctx={},opt={}){
  if(!opt||!SORTS[opt.sortKey]||opt.sortKey==='id'&&!opt.allowId)throw new Error('explore.additions necesita sortKey explícito: '+Object.keys(SORTS).filter(k=>k!=='id').join(', '));
  const P0=normP(P0in),w=opt.w||.10,held=new Set(P0.map(x=>x.id));if(!P0.length)return{sortKey:opt.sortKey,sortDir:SORTS[opt.sortKey].dir,orderLabel:SORTS[opt.sortKey].label,note:'Cartera vacía: no hay efecto marginal que calcular.',universe:opt.tag?'tag:'+opt.tag:'candidates()',w,items:[]};const U=universe(opt.tag).map(idOf).filter(id=>!held.has(id)).sort(byId);
  const items=[];for(const id of U){const r=await simulate(P0,mkScn('add',[{op:'add',asset:id,w,funding:'prorata'}]),ctx);const e=entOf(id);
    const os=P0.map(x=>({o:A().overlap(e,entOf(x.id)),w:x.w})).filter(x=>x.o!=null),ovl=os.length?os.reduce((a,x)=>a+x.o*x.w,0)/os.reduce((a,x)=>a+x.w,0):null;
    const S1=await simOf(r.P1,r.asof.end),R=S1.R;let corr=null;if(R){const i=R.assets.findIndex(a=>idOf(a)===id);if(i>=0){let s=0,ww=0;R.assets.forEach((a,j)=>{if(j===i||R.M[i][j]==null)return;const wj=(r.P0.find(x=>x.id===idOf(a))||{w:0}).w;s+=wj*R.M[i][j];ww+=wj});corr=ww?s/ww:null}}
    const ctys=Object.entries(S1.L.C).filter(([c,v])=>c!=='XX'&&v>1).length,mb=r.metrics.find(x=>x.id==='bets');
    items.push({asset:id,ter:A().terOf(e),overlap:r2(ovl),overlapQuality:'ESTIMATE',overlapBound:'lower',corr:r4(corr),dBets:mb?mb.delta:null,vol:(r.metrics.find(x=>x.id==='vol')||{}).after,countries:ctys,materiality:r.materiality,result:r})}
  const S=SORTS[opt.sortKey],val=it=>opt.sortKey==='overlap'?it.overlap:opt.sortKey==='ter'?it.ter:opt.sortKey==='vol'?it.vol:opt.sortKey==='bets'?it.dBets:opt.sortKey==='countries'?it.countries:opt.sortKey==='corr'?it.corr:null;
  items.sort((a,b)=>{const x=val(a),y=val(b);if(x==null&&y==null)return byId(a.asset,b.asset);if(x==null)return 1;if(y==null)return -1;return (S.dir==='asc'?x-y:y-x)||byId(a.asset,b.asset)});
  return{sortKey:opt.sortKey,sortDir:S.dir,orderLabel:S.label,note:'El orden refleja solo el criterio elegido; no es una recomendación.',universe:opt.tag?'tag:'+opt.tag:'candidates()',w,items}}
/* Pareto: conjunto no dominado bajo los objetivos indicados. No elige ganador. */
function pareto(results,objectives){const ok=(results||[]).filter(r=>r&&r.valid);const val=(r,o)=>{const m=r.metrics.find(x=>x.id===o.metric);return m?m.after:null};
  const better=(a,b,o)=>{const x=val(a,o),y=val(b,o);if(x==null||y==null)return 0;const d=o.dir==='min'?y-x:x-y;return d>1e-9?1:d<-1e-9?-1:0};
  const front=[],dominated=[];ok.forEach(a=>{const by=ok.find(b=>b!==a&&objectives.every(o=>better(b,a,o)>=0)&&objectives.some(o=>better(b,a,o)>0));if(by)dominated.push({key:a.key,dominatedBy:by.key});else front.push(a.key)});
  return{objectives:objectives.map(o=>({metric:o.metric,dir:o.dir})),front,dominated,note:'Los escenarios del frente representan compromisos distintos entre objetivos; ninguno se considera preferente.'}}

/* ───────────── parser (gramática española determinista) ───────────── */
const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/€/g,' eur ').replace(/%/g,' % ').replace(/[¿?¡!;:]+/g,' ').replace(/\.(?!\d)/g,' ').replace(/,(?!\d)/g,' ').replace(/\s+/g,' ').trim();
const num=s=>{const v=parseFloat(String(s).replace(/\./g,'').replace(',','.'));return isFinite(v)?v:null};
const pnum=s=>{const v=parseFloat(String(s).replace(',','.'));return isFinite(v)?v:null};
const ALIAS=[[/^(el |la |los |las )?(nasdaq( ?100)?|nasdaq-100|ndx)$/,'nasdaq'],[/^(el |la )?(s ?& ?p( ?500)?|sp ?500|s and p 500)$/,'sp'],[/^(el |la )?(world|mundo|mundial|msci world|all ?world|acwi|global|indice mundial)$/,'world'],
  [/^(los |las )?(emergentes|mercados emergentes|emerging( markets)?|em)$/,'em'],[/^(los |la )?(bonos|renta fija|bond|bonds)$/,'bond'],[/^(el )?(oro|gold)$/,'gold'],[/^(las |los )?(small ?caps?|pequenas( empresas)?|empresas pequenas)$/,'small'],
  [/^(europa|europe)$/,'europe'],[/^(japon|japan)$/,'japan'],[/^(los )?(semis|semiconductores)$/,'semis']];
const SECW=[[/tecnolog/,'Tecnología'],[/salud|sanidad/,'Salud'],[/financ|banca|bancos/,'Finanzas'],[/energia/,'Energía'],[/industria/,'Industria'],[/consumo basico/,'Consumo básico'],[/consumo/,'Consumo discrecional'],[/inmobiliar/,'Inmobiliario'],[/materiales/,'Materiales'],[/comunicacion/,'Comunicaciones'],[/servicios publicos|utilities/,'Servicios públicos']];
const ALIAS_LBL={nasdaq:'Nasdaq',sp:'S&P 500',world:'World',em:'emergentes',bond:'bonos',gold:'oro',small:'small caps',europe:'Europa',japan:'Japón',semis:'semiconductores'};
function matchKey(e,key,strict){const n=(e.name+' '+(e.obj.n||'')).toLowerCase(),tg=key==='nasdaq'||key==='sp'||key==='semis'?[]:A().tagsOf(e);
  if(key==='nasdaq')return /nasdaq/.test(n);if(key==='sp')return /s&p 500|s&p500|sp 500/.test(n)&&!(strict&&(e.obj.lev||/equal|equipond|leveraged|ultra|×|\b[23]x\b/.test(n)));if(key==='semis')return /semicond/.test(n);if(key==='gold')return tg.includes('gold')&&/\b(gold|oro)\b/.test(n);
  if(key==='world')return tg.includes('world')||/\b(world|all-world|all world|acwi)\b/.test(n);return tg.includes(key)}
function clean(p){return String(p||'').replace(/^(todo el |todo |el peso de |la exposicion a |mi |mis |el |la |los |las |un |una )+/,'').replace(/^(etf|fondo)s? (de |del |en )?/,'').replace(/\s+(etf|fondo)$/,'').trim()}
function resolveAsset(phrase,P0,mode){/* mode 'held' (debe estar en cartera) | 'any' */
  const p=clean(phrase);if(!p)return{error:T('eAsset',{p:phrase})};const held=P0.map(x=>({id:x.id,e:entOf(x.id)})).filter(x=>x.e);const P=p.toUpperCase();
  const tk=held.filter(x=>String(x.e.tk).toUpperCase()===P||x.e.t.toUpperCase()===P);if(tk.length===1)return{id:tk[0].id};
  const key=(ALIAS.find(([rx])=>rx.test(p))||[])[1];
  if(key){const h=held.filter(x=>matchKey(x.e,key));if(h.length===1)return{id:h[0].id};if(h.length>1)return{ask:{question:T('qWhich',{p:ALIAS_LBL[key]}),options:h.sort((a,b)=>byId(a.id,b.id)).map(x=>({label:nameOf(x.id)+' · '+x.e.name,value:x.id}))}}}
  const hn=held.filter(x=>p.length>=4&&nrm(x.e.name).includes(p));if(hn.length===1)return{id:hn[0].id};if(hn.length>1)return{ask:{question:T('qWhich',{p}),options:hn.sort((a,b)=>byId(a.id,b.id)).map(x=>({label:nameOf(x.id)+' · '+x.e.name,value:x.id}))}};
  if(mode==='held')return{error:T('vNotHeld',{a:/\s/.test(p)?p:p.toUpperCase()})};
  const E=searchEntities(),ex=E.filter(e=>String(e.tk).toUpperCase()===P||e.t.toUpperCase()===P);const exF=ex.filter(e=>e.k!=='s');if(exF.length===1)return{id:idOf(exF[0])};if(!exF.length&&ex.length===1)return{id:idOf(ex[0])};
  if(/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(P)){const r=A().resolveTok&&A().resolveTok(P);if(r)return{id:idOf(r)}}
  const ter=e=>{const t=A().terOf(e);return t==null?9:t};
  const pickAsk=(list,q)=>({ask:{question:q,options:list.sort((a,b)=>ter(a)-ter(b)||byId(idOf(a),idOf(b))).slice(0,8).map(e=>({label:nameOf(idOf(e))+' · '+e.name+(A().terOf(e)!=null?' · TER '+fmt(A().terOf(e),2)+' %':''),value:idOf(e)})),order:'ter'}});
  if(key){const L=searchEntities().filter(e=>(e.k==='e'||e.k==='f')&&!e.obj.lev&&matchKey(e,key,true)&&!/\b[23]x\b|×|ultra|leveraged/i.test(e.name));if(L.length===1)return{id:idOf(L[0])};if(L.length)return pickAsk(L,T('qPick',{p:ALIAS_LBL[key]}))}
  const nm=p.length>=3?E.filter(e=>nrm(e.name).includes(p)):[];if(nm.length===1)return{id:idOf(nm[0])};if(nm.length)return pickAsk(nm,T('qPickName',{p}));
  return{error:T('eAsset',{p:phrase})}}
const HOLE={$hole:true};
function finishDraft(d,queue){if(queue.length)return{ask:{...queue[0].ask,pending:{draft:d,queue}}};
  d.type=d.type||typeFor(d.changes);const v=validate(d);if(!v.ok)return{error:T('eVerb'),details:v.errors};return{scenario:canonical(d)}}
function typeFor(ch){if(!ch.length)return 'none';if(ch.length>1)return 'multi';const c=ch[0];
  if(c.op==='remove')return Array.isArray(c.to)?'redistribute':'remove';if(c.op==='shift')return 'redistribute';if(c.op==='add')return 'add';if(c.op==='replace')return 'replace';if(c.op==='contrib')return 'contrib';
  if(c.op==='set'||c.op==='adjust')return c.dirHint||'set';return 'multi'}
function resolveAsk(pending,value){if(!pending||!pending.draft)return{error:T('eVerb')};const d=JSON.parse(JSON.stringify(pending.draft)),q=pending.queue.slice(),h=q.shift();
  if(value==null)return{ask:{...h.ask,pending:{draft:pending.draft,queue:pending.queue}}};
  if(h.path==='$constraints.noSell')d.constraints.noSell=!!value;
  else if(h.path==='$objective.target'){d.objectives[0].target=value}
  else{const c=d.changes[h.ci];if(h.field==='$merge')Object.assign(c,value);else if(h.field.includes('.')){const [a,i,f]=h.field.split('.');c[a][+i][f]=value}else c[h.field]=value;
  }
  /* re-genera preguntas dependientes del activo (p. ej. peso actual) */
  q.forEach(x=>{if(x.dep)x.ask=DEPS[x.dep.k](d,x.dep)});return finishDraft(d,q)}
/* preguntas que dependen de un activo aún por elegir: declarativas (serializables) */
const DEPS={
  ppRel(d,o){const id=d.changes[0].asset,cw=isId(id)?(o.P0.find(x=>x.id===id)||{w:0}).w:null,x=o.x,dir=o.dir;
    return{question:T('qPpRel',{a:isId(id)?nameOf(id):o.p,x:fmt(x*100,0),cur:cw==null?'?':fmt(cw*100,1),pp:cw==null?'?':fmt((cw+dir*x)*100,1),rel:cw==null?'?':fmt(cw*(1+dir*x)*100,1)}),
      options:[{label:fmt(x*100,0)+' puntos porcentuales',value:{pp:dir*x}},{label:fmt(x*100,0)+' % relativo',value:{rel:dir*x}}]}},
  target(d,o){const id=d.changes[0].asset,cw=isId(id)?(o.P0.find(x=>x.id===id)||{w:0}).w:0,dir=o.dir;
    const opts=(dir<0?[cw-.05,cw-.10,cw/2]:[cw+.05,cw+.10,cw+.20]).map(v=>Math.round(Math.max(0,Math.min(1,v))*200)/200).filter((v,i,a)=>a.indexOf(v)===i&&v>=0&&v<=1&&Math.abs(v-cw)>1e-6);
    return{question:T('qTarget',{a:isId(id)?nameOf(id):o.p,cur:fmt(cw*100,1)}),options:opts.map(v=>({label:fmt(v*100,1)+' %',value:v})).concat([{label:T('oOther'),value:null}])}}};
function splitTargets(txt,P0){const parts=txt.split(/\s*,\s*|\s+y\s+|\s+e\s+/).map(x=>x.trim()).filter(Boolean);const out=[];
  for(const part of parts){const m=part.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*(?:a|al|en|para|de)?\s+(.+)$/);out.push({pct:m?pnum(m[1]):null,phrase:m?m[2]:part})}return out}
function parse(text,P0in){const s=nrm(text).replace(/^(y |que pasa si |que ocurre si |que pasaria si |y si |si |quiero |me gustaria |podria |puedo )+/,'').replace(/^(que pasa si |y si |si )/,'');const P0=normP(P0in);
  const d={...emptyScenario(),base:{sig:sigP(P0),mode:'weights'},source:{text:String(text||''),parsedBy:PARSER}},queue=[];let m;
  const wcur=id=>(P0.find(x=>x.id===id)||{w:0}).w;
  const res=(phrase,mode,ci,field)=>{const r=resolveAsset(phrase,P0,mode);if(r.error)return r;if(r.ask){queue.push({ci,field,ask:r.ask});return{id:HOLE}}return r};
  if(/\b(noticias|predic|rentara|ganara)\b/.test(s))return{error:T('eUnsupported')};
  const noSell=/no quiero vender|sin vender|no vender/.test(s);if(noSell)d.constraints.noSell=true;
  /* explorar añadidos abiertos: «añado un ETF que apenas se solape» */
  if(/(anad|agreg|mete|inclu)\w*/.test(s)&&/(apenas|poco|menos|no) (se )?solap/.test(s))return{explore:{fn:'additions',sortKey:'overlap',w:.10},note:'Petición abierta: se exploran candidatos ordenados por el criterio indicado (menor solapamiento), sin elegir uno.'};
  /* aportaciones */
  if((m=s.match(/(\d[\d.,]*)\s*eur(?:os)?\b/))&&/(aport|proxim|al mes|cada mes|mensual|\beur(os)? (a|al|en|para)\b)/.test(s)){
    const amt=num(m[1]);const monthly=/al mes|cada mes|mensual|mensuales/.test(s);let months=1;const mm=s.match(/(\d+)\s*mes(es)?/)||(s.match(/\b(un|1) ano\b/)?['','12']:s.match(/\b(\d+) anos\b/)?['',String(12*+s.match(/\b(\d+) anos\b/)[1])]:null);
    if(mm)months=+mm[1];const tgt=s.slice(m.index+m[0].length).replace(/^\s*(al mes|cada mes|mensuales?)\s*/,'').replace(/\s*(durante|en|los proximos|el proximo)?\s*(\d+\s*mes(es)?|un ano|\d+ anos)\s*$/,'').replace(/^\s*(van |iran |iria |ira )?(a|al|en|para|hacia)\s+/,'').replace(/^(todo |todos )?/,'').trim()
      ||(s.match(/(?:aport\w*|invert\w*|meter|meto)\s+(?:todo\s+)?(?:a|al|en)\s+(.+?)(?:\s+durante.*)?$/)||[])[1];
    if(!tgt)return{error:T('eVerb')};const c={op:'contrib',monthly:amt,months,alloc:[{asset:HOLE,share:1}]};d.changes.push(c);d.constraints.noSell=true;
    const r=resolveAsset(tgt,P0,'any');if(r.error)return r;if(r.ask)queue.push({ci:0,field:'alloc.0.asset',ask:r.ask});else c.alloc[0].asset=r.id;
    if(monthly&&!mm)queue.push({ci:0,field:'months',ask:{question:T('qMonths'),options:[6,12,24,36].map(x=>({label:x+' meses',value:x}))}});
    d.type='contrib';return finishDraft(d,queue)}
  /* sustituir */
  if((m=s.match(/^(?:sustitu\w*|reemplaz\w*|cambi\w*)\s+(.+?)\s+por\s+(.+)$/))){const c={op:'replace',from:HOLE,to:HOLE};d.changes.push(c);
    const a=res(m[1],'held',0,'from');if(a.error)return a;if(a.id!==HOLE)c.from=a.id;const b=res(m[2],'any',0,'to');if(b.error)return b;if(b.id!==HOLE)c.to=b.id;d.type='replace';return finishDraft(d,queue)}
  /* mover una cantidad */
  if((m=s.match(/^(?:muev\w*|mover|pas[ao]r?|traspas\w*)\s+(?:un\s+|el\s+)?(\d+(?:[.,]\d+)?)\s*(?:%|pp|puntos)?\s+(?:de|desde)\s+(.+?)\s+(?:a|al|hacia|en)\s+(.+)$/))){const amt=pnum(m[1])/100;
    const c={op:'shift',from:HOLE,amt,to:[{asset:HOLE,share:1}]};d.changes.push(c);const a=res(m[2],'held',0,'from');if(a.error)return a;if(a.id!==HOLE)c.from=a.id;
    const b=res(m[3],'any',0,'to.0.asset');if(b.error)return b;if(b.id!==HOLE)c.to[0].asset=b.id;d.type='redistribute';return finishDraft(d,queue)}
  /* quitar (+ repartir) */
  if((m=s.match(/^(?:quit\w*|elimin\w*|sac[ao]r?|saca\w*|vend\w* todo)\s+(.+?)(?:\s+y\s+(?:lo\s+|su peso\s+|el peso\s+)?(?:repart\w*|distribu\w*|redistribu\w*|mete\w*|pas\w*|llev\w*)\s+(?:su peso\s+|el peso\s+|lo\s+)?(?:(?:entre|a|en|hacia)\s+)?(.+))?$/))){
    const c={op:'remove',asset:HOLE,to:'prorata'};d.changes.push(c);const a=res(m[1],'held',0,'asset');if(a.error)return a;if(a.id!==HOLE)c.asset=a.id;
    if(m[2]){const tg=splitTargets(m[2],P0);const hasPct=tg.some(t=>t.pct!=null);if(hasPct&&(tg.some(t=>t.pct==null)||Math.abs(tg.reduce((x,t)=>x+t.pct,0)-100)>1e-6))return{error:T('eShares')};
      c.to=tg.map(t=>({asset:HOLE,share:hasPct?t.pct/100:1/tg.length}));if(!hasPct&&tg.length>1)d.assumptions.push(T('aEqual'));
      for(let i=0;i<tg.length;i++){const b=res(tg[i].phrase,'any',0,'to.'+i+'.asset');if(b.error)return b;if(b.id!==HOLE)c.to[i].asset=b.id}}
    d.type=m[2]?'redistribute':'remove';return finishDraft(d,queue)}
  /* añadir */
  if((m=s.match(/^(?:anad\w*|agreg\w*|mete\w*|meter|meto|inclu\w*)\s+(?:un\s+|una\s+)?(?:(\d+(?:[.,]\d+)?)\s*%\s+(?:de\s+|del\s+|en\s+)?)?(.+?)(?:\s+(?:al|con un|con el|con|a un|un)\s+(\d+(?:[.,]\d+)?)\s*%)?(?:\s+(?:financiad\w*|sacandolo|quitandolo)\s+(?:de|del)\s+(.+))?$/))){
    const w=m[1]?pnum(m[1])/100:m[3]?pnum(m[3])/100:null;const c={op:'add',asset:HOLE,w:w==null?HOLE:w,funding:'prorata'};d.changes.push(c);
    const a=res(m[2],'any',0,'asset');if(a.error)return a;if(a.id!==HOLE)c.asset=a.id;
    if(m[4]){const f=res(m[4],'held',0,'funding');if(f.error)return f;if(f.id!==HOLE)c.funding=f.id}
    if(w==null)queue.push({ci:0,field:'w',ask:{question:T('qAddW',{a:clean(m[2])}),options:[.05,.10,.15,.20].map(x=>({label:fmt(x*100,0)+' %',value:x})).concat([{label:T('oOther'),value:null}])}});
    d.type='add';return finishDraft(d,queue)}
  /* reducir / aumentar / fijar */
  const VR=/^(reduc\w*|reduz\w*|baj[aeo]\w*|recort\w*|disminu\w*|aument\w*|sub[eio]\w*|increment\w*|pon\w*|dej[aeo]\w*)\s+(.+)$/;
  if((m=s.match(VR))){const verb=m[1],rest=m[2],dir=/^(reduc|reduz|baj|recort|disminu)/.test(verb)?-1:/^(aument|sub|increment)/.test(verb)?1:0;let mm;
    const sec=SECW.find(([rx])=>rx.test(rest));
    const isSectorPhrase=/^(la |mi |el )?(exposicion (a|en) )?(tecnolog\w*|salud|sanidad|financ\w*|banca|bancos|energia|industria|consumo( basico)?|inmobiliario|materiales|comunicaciones|servicios publicos|utilities)\b/.test(rest);
    if(isSectorPhrase&&sec){/* objetivo sectorial: pregunta, sin asumir porcentaje */
      const L=A().lookThrough(P0.map(x=>({e:entOf(x.id),w:x.w}))),curS=L.S[sec[1]]||0;const tg=(mm=rest.match(/(?:al?|hasta el?|hasta)\s+(\d+(?:[.,]\d+)?)\s*%?/))?pnum(mm[1])/100:null;
      d.type='sectorTarget';d.objectives=[{metric:'sec:'+sec[1],dir:dir<0?'min':'max',target:tg==null?HOLE:tg}];
      if(tg==null){const opts=(dir<0?[curS-8,curS-13,curS-18]:[curS+5,curS+10,curS+15]).map(x=>Math.round(Math.max(0,Math.min(100,x))/5)*5).filter((x,i,a)=>a.indexOf(x)===i&&x>0&&x<100);
        queue.push({path:'$objective.target',ask:{question:T('qSector',{s:sec[1].toLowerCase(),cur:fmt(curS,0)}),options:opts.map(x=>({label:x+' %',value:x/100})).concat([{label:T('oOther'),value:null}])}})}
      if(!noSell)queue.push({path:'$constraints.noSell',ask:{question:T('qSell'),options:[{label:T('oYes'),value:true},{label:T('oNo'),value:false}]}});
      return finishDraft(d,queue)}
    /* fijar peso: «del 25 al 10», «al 15 %», «hasta el 15», «en el 15 %» */
    if((mm=rest.match(/^(.+?)\s+(?:(?:del?|desde el?)\s+(\d+(?:[.,]\d+)?)\s*%?\s+)?(?:al?|hasta el?|hasta|en el|en)\s+(\d+(?:[.,]\d+)?)\s*%?$/))){
      const c={op:'set',asset:HOLE,to:pnum(mm[3])/100};if(mm[2])c.expectFrom=pnum(mm[2])/100;d.changes.push(c);const a=res(mm[1],dir>0||dir===0?'any':'held',0,'asset');if(a.error)return a;if(a.id!==HOLE)c.asset=a.id;
      d.type=dir<0?'reduce':dir>0?'increase':'set';return finishDraft(d,queue)}
    /* cambiar EN una cantidad: puntos porcentuales o relativo; «un 10 %» a secas es ambiguo */
    if((mm=rest.match(/^(.+?)\s+(?:(?:un|en|en un)\s+)?(\d+(?:[.,]\d+)?)\s*(%|pp|puntos(?: porcentuales)?)\s*(relativo|del peso)?$/))){if(!dir)return{error:T('eNum')};
      const x=pnum(mm[2])/100,c={op:'adjust',asset:HOLE};d.changes.push(c);const a=res(mm[1],dir<0?'held':'any',0,'asset');if(a.error)return a;if(a.id!==HOLE)c.asset=a.id;
      if(/pp|puntos/.test(mm[3]))c.pp=dir*x;else if(mm[4])c.rel=dir*x;
      else{const dep={k:'ppRel',x,dir,p:clean(mm[1]),P0};queue.push({ci:0,field:'$merge',ask:DEPS.ppRel(d,dep),dep})}
      d.type=dir<0?'reduce':'increase';return finishDraft(d,queue)}
    /* sin cifra: preguntar hasta dónde */
    if(dir){const c={op:'set',asset:HOLE,to:HOLE};d.changes.push(c);const a=res(rest,dir<0?'held':'any',0,'asset');if(a.error)return a;if(a.id!==HOLE)c.asset=a.id;
      const dep={k:'target',dir,p:clean(rest),P0};queue.push({ci:0,field:'to',ask:DEPS.target(d,dep),dep});d.type=dir<0?'reduce':'increase';return finishDraft(d,queue)}}
  return{error:T('eVerb')}}

/* ───────────── contexto desde la cartera registrada (modo importes) ───────────── */
async function ctxFromPortfolio(){if(typeof PF==='undefined'||!PF.length||typeof pfValue!=='function')return{mode:'weights'};
  const rs=await Promise.all(PF.map(pfValue)),val={},inv={};rs.forEach(r=>{if(!r.ent||r.err||r.pending||!(r.val>0))return;const id=idOf(r.ent);val[id]=(val[id]||0)+r.val;inv[id]=(inv[id]||0)+(r.inv||0)});
  return{mode:'amounts',values:canon(val),inv:canon(inv),P:Object.keys(val).sort().map(id=>({id,w:val[id]}))}}

/* ───────────── lectura determinista de un escenario (sin IA) ───────────── */
const NL={bets:'las apuestas efectivas',narrow:'el peso en productos sueltos, sectoriales o temáticos',topPos:'la dependencia del mayor producto',topCo:'el peso de la mayor empresa (cota inferior)',
  top10Co:'el peso de las 10 mayores empresas (cota inferior)',ovl:'el solapamiento entre ETFs (cota inferior)',ter:'el coste (TER)',vol:'la volatilidad histórica',dd:'la caída máxima histórica',em:'la exposición a emergentes',
  health:'la salud total','dim:dv':'la dimensión de diversificación','dim:cn':'la dimensión de concentración (más alta = menos concentrada)','dim:rk':'la dimensión de riesgo','dim:co':'la dimensión de coste'};
function nlOf(id){if(NL[id])return NL[id];const p=id.split(':')[0],k=id.slice(p.length+1);if(p==='sec')return 'la exposición a '+k;if(p==='cty')return 'la exposición a '+((A().CNAME&&A().CNAME[k])||k);if(p==='ac')return 'el peso en '+k.toLowerCase();return id}
const joinY=L=>L.length<2?L.join(''):L.slice(0,-1).join(', ')+' y '+L[L.length-1];
function narrate(res){if(!res||!res.valid||!res.metrics)return[];const out=[],mv=res.moves||[];
  const dn=mv.filter(x=>x.delta<0),up=mv.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta||byId(a.id,b.id));
  if(mv.length)out.push(T('nMoves',{m:joinY(dn.concat(up.filter(x=>x.from===0)).map(x=>`${nameOf(x.id)} ${fmt(x.from*100,1)} % → ${fmt(x.to*100,1)} %`))||joinY(up.slice(0,3).map(x=>`${nameOf(x.id)} ${fmt(x.from*100,1)} % → ${fmt(x.to*100,1)} %`))}));
  if(dn.length&&up.length)out.push(T('nSpread',{m:joinY(up.slice(0,3).map(x=>`${nameOf(x.id)} +${fmt(x.delta*100,1)} pp`))}));
  const mat=res.metrics.filter(r=>r.material&&r.id!=='n'&&r.id!=='health'&&!r.id.startsWith('dim:')&&r.id!=='bets');
  const ph=r=>{const mag=r.id==='dd'?(Math.abs(r.after)<Math.abs(r.before)?-1:1):Math.sign(r.delta);return{mag,t:`${nlOf(r.id)} (${vtxt(r,r.before)} → ${vtxt(r,r.after)})`}};
  const P=mat.map(ph),D=P.filter(x=>x.mag<0).map(x=>x.t).slice(0,3),U=P.filter(x=>x.mag>0).map(x=>x.t).slice(0,3);
  if(D.length&&U.length)out.push(T('nBoth',{d:joinY(D),u:joinY(U)}));else if(D.length)out.push(T('nDown',{l:joinY(D)}));else if(U.length)out.push(T('nUp',{l:joinY(U)}));
  const b=res.metrics.find(r=>r.id==='bets');
  if(b&&b.delta!=null&&!b.material){let t=T('nFlat',{b:fmt(b.before,2),a:fmt(b.after,2)});const m=res.mechanism;
    if(m&&m.corr!=null&&m.corr>=.8&&mv.length){t+=T('nMech',{to:nameOf(m.to),from:nameOf(m.from),c:fmt(m.corr,2)});if(m.overlap!=null&&m.overlap>=20)t+=T('nMechO',{o:fmt(m.overlap,0)})}out.push(t+'.')}
  else if(b&&b.material)out.push((b.delta>0?T('nUp',{l:`${nlOf('bets')} (${fmt(b.before,2)} → ${fmt(b.after,2)})`}):T('nDown',{l:`${nlOf('bets')} (${fmt(b.before,2)} → ${fmt(b.after,2)})`})));
  if(!mat.length&&!(b&&b.material))out.push(T('nNone'));
  if(res.metrics.some(r=>r.material&&r.bound==='lower'&&/^(topCo|top10Co|ovl)$/.test(r.id)))out.push(T('nLB'));
  return out}

/* ───────────── ideas(): posibilidades a explorar a partir de un problema del Doctor ─────────────
   No simula, no puntúa y no elige: devuelve grupos de escenarios candidatos en orden alfabético y operaciones de tamaño fijo (−10 pp / quitar),
   más accesos a exploraciones con criterio explícito. «Mantener sin cambios» siempre está. */
const ADD_TAGS=[['em','Emergentes'],['europe','Europa'],['japan','Japón'],['exus','Fuera de EE. UU.'],['small','Pequeñas empresas'],['value','Value'],['bond','Renta fija'],['gold','Oro']];
function opsFor(id,w,n,base){const o=[];if(w>.10+1e-9)o.push({label:T('oRed'),scenario:{...emptyScenario(),type:'reduce',base,changes:[{op:'shift',from:id,amt:.10,to:'prorata'}],source:{text:'',parsedBy:'ideas@1'}}});
  if(n>1)o.push({label:T('oRem'),scenario:{...emptyScenario(),type:'remove',base,changes:[{op:'remove',asset:id,to:'prorata'}],source:{text:'',parsedBy:'ideas@1'}}});return o}
function fromDoctor(An){return((An&&An.D)||[]).filter(d=>d.kind).map(d=>({kind:d.kind,ref:d.ref==null?null:d.ref,title:d.t,metric:d.metric,sev:d.sev}))}
function ideas(An,problem){const P0=normP((An&&An.P||[]).map(x=>({e:x.e,w:x.w}))),n=P0.length,base={sig:sigP(P0),mode:'weights'},L=An&&An.L,R=An&&An.R;
  const out={problem:problem||null,head:T('iHead'),groups:[],keep:{label:T('iKeep'),why:T('iKeepW'),scenario:{...emptyScenario(),base,source:{text:'',parsedBy:'ideas@1'}}}};if(!n||!L)return out;
  const wOf=id=>(P0.find(x=>x.id===id)||{w:0}).w,alpha=(a,b)=>byId(nameOf(a.id),nameOf(b.id));
  const rows=(list,info)=>list.sort(alpha).map(x=>({id:x.id,label:nameOf(x.id),name:(entOf(x.id)||{}).name||'',weight:r4(wOf(x.id)*100),info:info(x),ops:opsFor(x.id,wOf(x.id),n,base)})).filter(r=>r.ops.length);
  const agg=(arr,key)=>{const m=new Map();(arr||[]).forEach(o=>{const id=idOf(o.e);m.set(id,(m.get(id)||0)+o[key])});return[...m.entries()].map(([id,v])=>({id,v}))};
  const k=problem&&problem.kind,ref=problem&&problem.ref;
  if(k==='sec'||k==='cty'){const by=agg((k==='sec'?L.byS:L.byC)[ref],'p').filter(x=>x.v>=1);const nm=k==='sec'?ref:((A().CNAME&&A().CNAME[ref])||ref);
    out.groups.push({id:'contrib',title:T('iContrib'),why:T('iContribW',{x:k==='sec'?ref:nm}),rows:rows(by,x=>T(k==='sec'?'cSec':'cCty',{x:fmt(x.v,1),s:nm}))})}
  else if(k==='comp'){const c=L.comps.find(x=>x.key===ref);if(c){const by=c.by.map(b=>({id:idOf(b.e),v:b.w}));out.groups.push({id:'contrib',title:T('iContrib'),why:T('iContribW',{x:c.name}),rows:rows(by,x=>T('cComp',{x:fmt(x.v,1),s:c.name}))})}}
  else if(k==='ovl'||k==='corr'){const ids=(ref||[]).map(t=>P0.find(x=>x.id.endsWith(':'+t))).filter(Boolean);out.groups.push({id:'pair',title:T('iPairs'),why:T('iPairsW'),rows:rows(ids.map(x=>({id:x.id})),x=>T('cW',{x:fmt(wOf(x.id)*100,1)}))})}
  else if(k==='vol'){const sg=id=>{if(!R)return null;const i=R.assets.findIndex(e=>idOf(e)===id);return i>=0&&R.sig?R.sig[i]:null};
    out.groups.push({id:'vol',title:T('iVol'),why:T('iVolW'),rows:rows(P0.map(x=>({id:x.id})),x=>{const v=sg(x.id);return v==null?T('cW',{x:fmt(wOf(x.id)*100,1)}):T('cVol',{x:fmt(v*100,1)})})})}
  else if(k==='cost'){out.groups.push({id:'alt',title:T('iAlt'),why:T('iAltW'),alts:P0.filter(x=>x.id[0]!=='s').sort(alpha).map(x=>{const e=entOf(x.id),tg=A().tagsOf(e)[0]||null,t=A().terOf(e);return{id:x.id,label:nameOf(x.id),tag:tg,info:t==null?'':T('cTer',{x:fmt(t,2)})}}).filter(a=>a.tag)})}
  if(!k||k==='bets'||k==='em'||k==='cost'||k==='vol')out.groups.push({id:'rel',title:T('iRel'),why:T('iRelW'),rows:rows(P0.filter(x=>x.w>=.05).map(x=>({id:x.id})),x=>T('cW',{x:fmt(wOf(x.id)*100,1)}))});
  out.groups.push({id:'add',title:T('iAdd'),why:T('iAddW'),explore:{fn:'additions',w:.10,tags:ADD_TAGS.map(([t,l])=>({tag:t,label:l}))}});
  return out}

/* título legible de un escenario (para la interfaz y los tests de lenguaje) */
function title(scn,P0in){const P0=normP(P0in||[]),w=id=>(P0.find(x=>x.id===id)||{w:0}).w,pc=x=>fmt(x*100,1)+' %';const ch=(scn&&scn.changes)||[];if(!ch.length)return T('iKeep');
  return ch.map(c=>c.op==='set'?`${nameOf(c.asset)} ${pc(w(c.asset))} → ${pc(c.to)}`:c.op==='adjust'?`${nameOf(c.asset)} ${c.pp!=null?(c.pp>0?'+':'−')+fmt(Math.abs(c.pp)*100,1)+' pp':(c.rel>0?'+':'−')+fmt(Math.abs(c.rel)*100,0)+' % relativo'}`
    :c.op==='shift'?`${nameOf(c.from)} −${fmt(c.amt*100,1)} pp${c.to==='prorata'?' (al resto, pro-rata)':' → '+c.to.map(t=>nameOf(t.asset)).join(' + ')}`:c.op==='remove'?`Quitar ${nameOf(c.asset)}${c.to==='prorata'?' (pro-rata)':' → '+c.to.map(t=>nameOf(t.asset)).join(' + ')}`
    :c.op==='add'?`Añadir ${nameOf(c.asset)} ${pc(c.w)}`:c.op==='replace'?`Sustituir ${nameOf(c.from)} por ${nameOf(c.to)}`:c.op==='contrib'?`${fmt(c.monthly,0)} €/mes × ${c.months} a ${c.alloc.map(t=>nameOf(t.asset)).join(' + ')}`:c.op).join(' · ')}
/* alternativas: sustituir un producto por otro de su misma categoría (lista ordenada solo por el criterio elegido) */
async function alternatives(P0in,ctx={},opt={}){if(!opt||!SORTS[opt.sortKey]||!opt.from)throw new Error('explore.alternatives necesita from y sortKey explícito');
  const P0=normP(P0in),held=new Set(P0.map(x=>x.id)),e0=entOf(opt.from),tag=opt.tag||(e0&&A().tagsOf(e0)[0]);const U=tag?universe(tag).map(idOf).filter(id=>!held.has(id)).sort(byId):[];
  const items=[];for(const id of U){const r=await simulate(P0,mkScn('replace',[{op:'replace',from:opt.from,to:id}]),ctx);const mb=r.metrics.find(x=>x.id==='bets');
    items.push({asset:id,ter:A().terOf(entOf(id)),overlap:r2(A().overlap(entOf(id),e0)),dBets:mb?mb.delta:null,vol:(r.metrics.find(x=>x.id==='vol')||{}).after,materiality:r.materiality,result:r})}
  const S=SORTS[opt.sortKey],val=it=>it[opt.sortKey==='bets'?'dBets':opt.sortKey];
  items.sort((a,b)=>{const x=val(a),y=val(b);if(x==null&&y==null)return byId(a.asset,b.asset);if(x==null)return 1;if(y==null)return -1;return (S.dir==='asc'?x-y:y-x)||byId(a.asset,b.asset)});
  return{from:opt.from,tag,sortKey:opt.sortKey,sortDir:S.dir,orderLabel:S.label,note:'Misma categoría, no necesariamente el mismo índice. El orden refleja solo el criterio elegido; no es una recomendación.',items}}

window.ATLASI.scenarios={v:V,TXT,TYPES,OPS,SORTS,schema:{emptyScenario,validate,canonical,keyOf},parse,resolveAsk,validate,canonical,build,simulate,
  quality:{metricsOf,qCov},compare:{compare:compareM,DIR,THR},explain,explore:{removals,reductions,additions,alternatives,pareto},ideas,fromDoctor,narrate,title,nameOf,ADD_TAGS,contrib:{monthsTo},
  cache:{clear:clearCache,size:()=>({results:_res.size,sims:_sim.size})},dataVersion,dataEnd,endFrom,normP,ctxFromPortfolio};
})();
