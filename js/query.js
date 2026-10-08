/* ATLAS · Consultas deterministas (ATLASI.query) — la puerta de entrada «¿Qué quieres investigar?»
   ─────────────────────────────────────────────────────────────────────────────
   RESOLUCIÓN (ATLASI.assets) → INTENCIÓN (parse) → EJECUCIÓN (run). Sin IA.
   parse(text, A) → {intent, args} | {ask:{question, options, pending}} | {unsupported:{text, examples}}
   run(intent, args, A) → resultado estructurado: secciones con filas cuyo valor es SIEMPRE una traza
   {value, quality, bound, source, date, coverage, method, calculation, unit}. La interfaz solo pinta.
   Una futura capa de IA (Ask ATLAS) podrá explicar estos resultados, nunca calcularlos. */
(function(){'use strict';
const A=()=>window.ATLASI,AS=()=>window.ATLASI.assets;
const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[¿?¡!]+/g,' ').replace(/\s+/g,' ').trim();
const EXAMPLES=['Analiza QQQ','¿Cuánto tengo de NVIDIA?','¿Qué tengo dentro de VWCE?','¿Qué pasa si reduzco QQQ al 15 %?','Compara QQQ y VWCE','¿Qué me mueve hoy?'];
const UNSUP={unsupported:{text:'No puedo resolver esa consulta todavía.',examples:EXAMPLES}};
const idOf=e=>e.k+':'+e.t;
const Pids=An=>(An&&An.P||[]).map(x=>({id:idOf(x.e),w:x.w}));
const T=o=>({...AS().trace(o),unit:o.unit||null});
const f1=(x,d=1)=>x==null?'—':(Math.round(x*10**d)/10**d).toFixed(d).replace('.',',');

/* ---------------- parse ---------------- */
function needEntity(text,An,intent,slot,opts){const r=AS().resolve(text,{P:Pids(An),mode:'auto',...(opts||{})});
  if(r.match)return{id:r.match.id,kind:r.match.kind,how:r.match.how};
  if(r.ask)return{ask:{question:r.ask.question,options:r.ask.options,more:r.ask.more,pending:{intent,slot,args:{}}}};
  return{none:r.none}}
function route(id,kind){/* el tipo de entidad decide la consulta adecuada */
  if(kind==='sector')return{intent:'sectorHoldings',args:{id}};if(kind==='country')return{intent:'countryDependence',args:{id}};
  if(kind==='index'||kind==='concept')return{intent:'exposure',args:{id}};return null}
function single(text,An,intent){const x=needEntity(text,An,intent,'id');if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none,unsupported:null};
  return route(x.id,x.kind)&&intent!=='composition'?route(x.id,x.kind):{intent,args:{id:x.id}}}
function parse(text,An){const raw=String(text||'').trim();const t=nrm(raw);if(!t)return UNSUP;
  if(/\b(que podria cambiar|que puedo cambiar|explorar cambios|posibles cambios|que cambiaria)\b/.test(t))return{intent:'explore',args:{}};
  if(/\b(que me (mueve|esta moviendo|afecta|esta afectando)|movimiento de hoy|que ha pasado hoy|por que (ha )?(caido|subido|bajado) mi cartera|como va (hoy )?mi cartera)\b/.test(t))return{intent:'today',args:{}};
  if(/^(que pasa(ria)? si|que ocurre si|y si|si )/.test(t)||/^(reduc|reduz|baj[ao]|aument|sub[eo]|quit|elimin|anad|agreg|sustitu|reemplaz|muev|mover|aport|pon |los proximos|no quiero vender)/.test(t)){
    const p=A().scenarios.parse(raw,Pids(An));return{intent:'scenario',args:{parsed:p}}}
  let m;
  if((m=t.match(/^compar\w*\s+(.+?)\s+(?:y|con|vs\.?|frente a|contra)\s+(.+)$/))){const a=needEntity(m[1],An,'compare','a',{kinds:AS().PRODUCT,concept:'product'});if(a.ask)return{ask:a.ask};if(a.none)return{none:a.none};
    const b=needEntity(m[2],An,'compare','b',{kinds:AS().PRODUCT,concept:'product'});if(b.ask){b.ask.pending.args={a:a.id};return{ask:b.ask}}if(b.none)return{none:b.none};return{intent:'compare',args:{a:a.id,b:b.id}}}
  if(/solap/.test(t))return{intent:'overlapTop',args:{}};
  if(/(riesgo|volatil)/.test(t)&&/(aporta|contribu|mas|mayor|quien|que (posicion|producto))/.test(t))return{intent:'riskTop',args:{}};
  if((m=t.match(/(?:que (?:tengo|hay|lleva|contiene)(?: realmente)? (?:dentro de|en)|que contiene|composicion de|que hay dentro de|dentro de)\s+(?:el |la |mi )?(.+)$/))){const x=needEntity(m[1],An,'composition','id',{kinds:AS().PRODUCT,concept:'product'});if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none};return{intent:'composition',args:{id:x.id}}}
  if((m=t.match(/cuant[oa] depende (?:mi cartera |la cartera )?(?:de|del) (.+)$/))){const x=needEntity(m[1],An,'countryDependence','id');if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none};return route(x.id,x.kind)||{intent:'exposure',args:{id:x.id}}}
  if((m=t.match(/que (?:etfs|productos|fondos|posiciones|activos) tengo (?:de|en|con) (.+)$/))||(m=t.match(/^cuant[oa]s? (.+?) tengo$/))){const x=needEntity(m[1],An,'sectorHoldings','id');if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none};return route(x.id,x.kind)||{intent:'exposure',args:{id:x.id}}}
  if((m=t.match(/cuant[oa] (?:tengo|peso|pesa|me afecta|estoy expuesto|exposicion tengo)(?: (?:de|a|en|al))? (.+)$/))||(m=t.match(/^exposicion (?:a|al|de) (.+)$/))){const x=needEntity(m[1],An,'exposure','id');if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none};return route(x.id,x.kind)||{intent:'exposure',args:{id:x.id}}}
  if((m=t.match(/^(?:analiza(?:r|me)?|analisis de|ficha(?: de)?|ver|info(?:rmacion)?(?: de| sobre)?|que es|investiga(?:r)?)\s+(.+)$/))){const x=needEntity(m[1],An,'asset','id');if(x.ask)return{ask:x.ask};if(x.none)return{none:x.none};return route(x.id,x.kind)||{intent:'asset',args:{id:x.id}}}
  if(t.split(' ').length<=4&&!/\b(que|cual|como|por que|cuanto|deberia|mejor|recomienda|comprar|vender)\b/.test(t)){const x=needEntity(raw,An,'asset','id');if(x.ask)return{ask:x.ask};if(x.none)return /\s/.test(raw)?UNSUP:{none:x.none};return route(x.id,x.kind)||{intent:'asset',args:{id:x.id}}}
  return UNSUP}
function choose(pending,id){const a={...(pending.args||{}),[pending.slot]:id};const k=AS().kindOf(id);if(pending.intent==='asset'||pending.intent==='exposure'){const r=route(id,k);if(r)return r}
  return{intent:pending.intent,args:a}}

/* ---------------- run ---------------- */
const pctT=(v,o)=>T({unit:'%',...o,value:v});
function holdingOf(An,id){return(An&&An.P||[]).find(x=>idOf(x.e)===id)||null}
async function today(An){try{return await A().portfolio.contribution(An)}catch(_){return null}}
function asofOf(e){const d=AS().describe(idOf(e));return d.provenance&&d.provenance.composition&&d.provenance.composition.asof||null}
async function riskSingle(e,end){try{return await A().riskOf([{e,w:1}],5,end||undefined)}catch(_){return null}}

async function companyBlock(An,id){/* exposición directa + indirecta a una empresa (acción del universo o empresa dentro de ETFs) */
  const L=An.L,e=AS().entity(id),key=e?A().ckey(e.name,e.t):id.slice(3),c=L.comps.find(x=>x.key===key),N=An.P.length,dir=holdingOf(An,id);
  if(!c&&!dir)return{rows:[],text:[`No aparece en tu cartera según las posiciones conocidas. ATLAS conoce las mayores posiciones de cada ETF (cobertura ${f1(L.cover,0)} % de la cartera): podría estar en la parte no publicada.`],quality:'INCOMPLETE'};
  const rows=[];const direct=dir?dir.w*100:0;
  rows.push({label:'Directa',value:pctT(direct,{quality:'DATA',bound:'exact',source:'Tu cartera',method:'Peso de la acción en la cartera'})});
  const via=(c?c.by:[]).filter(b=>b.e.k!=='s').map(b=>{const x=A().expOf(b.e),h=x.hold.find(h=>h.key===key),pw=(An.P.find(p=>p.e===b.e)||{w:0}).w*100,exact=x.cover>=99.5;
    return{label:`vía ${String(b.e.tk||b.e.t)}`,value:pctT(b.w,{quality:exact?'DATA':'ESTIMATE',bound:exact?'exact':'lower',source:AS().describe(idOf(b.e)).provenance.composition.companies||'Composición publicada',date:asofOf(b.e),coverage:Math.round(x.cover),
      method:'Peso del producto × peso conocido de la empresa dentro del producto',calculation:`${String(b.e.tk||b.e.t)} ${f1(pw)} % × ${exact?'':'≥ '}${f1(h?h.w:0)} % = ${exact?'':'≥ '}${f1(b.w,2)} %`})}});
  const ind=via.reduce((a,v)=>a+v.value.value,0);
  rows.push({label:'Indirecta (dentro de tus ETFs)',value:pctT(ind,{quality:via.every(v=>v.value.bound==='exact')?'DATA':'ESTIMATE',bound:via.every(v=>v.value.bound==='exact')?'exact':'lower',source:'Composición publicada de tus ETFs',coverage:Math.round(L.cover),method:'Suma de producto × peso conocido',calculation:via.map(v=>v.value.calculation).join(' + ')||null})});
  rows.push(...via);
  const tot=c?c.w:direct;rows.push({label:'Total en tu cartera',value:pctT(tot,{quality:c&&c.exact?'DATA':'ESTIMATE',bound:c&&c.exact?'exact':'lower',source:'Directa + indirecta',coverage:Math.round(L.cover),method:c&&c.exact?'Exposición exacta':'Exposición mínima garantizada (posiciones conocidas)'})});
  rows.push({label:'Productos que la contienen',value:T({value:c?c.by.length:(dir?1:0),unit:`de ${N}`,quality:'DATA',bound:'exact',source:'Tu cartera'})});
  const Td=await today(An);let text=[];
  if(Td&&c){const I=A().portfolio.impact(An,Td,key);if(I&&I.est!=null){rows.push({label:`Impacto de hoy (${I.r>0?'+':''}${f1(I.r*100)} %)`,value:pctT(I.est*100,{quality:I.exact?'DATA':'ESTIMATE',bound:I.exact?'exact':'lower',source:Td.src,date:Td.session,method:'Movimiento de la empresa × su peso conocido en tu cartera',calculation:`${f1(I.r*100)} % × ${I.exact?'':'≥ '}${f1(I.wmin*100,2)} %`})});
      if(Td.eur&&Td.eur.prev)rows.push({label:'Impacto de hoy en euros',value:T({value:I.est*Td.eur.prev,unit:'€',quality:I.exact?'DATA':'ESTIMATE',bound:I.exact?'exact':'lower',source:Td.src,date:Td.session,method:'Impacto % × valor de ayer'})})}
    else text.push('No hay datos suficientes para estimar el impacto indirecto de hoy (la empresa no tiene cotización propia en ATLAS o no cotizó en esta sesión).')}
  if(c&&!c.exact)text.push('La exposición real puede ser mayor: ATLAS solo conoce las mayores posiciones publicadas de cada ETF.');
  return{rows,text,key}}

async function runAsset(An,id){const d=AS().describe(id),e=AS().entity(id),out={intent:'asset',title:d.name,entity:d,sections:[],reading:[],actions:[],warnings:d.warnings.slice()};
  if(!e){return runExposure(An,id)}
  const h=An&&holdingOf(An,id);
  if(h&&e.k!=='s'){const rows=[{label:'Peso',value:pctT(h.w*100,{quality:'DATA',bound:'exact',source:'Tu cartera'})}];
    if(An.src&&An.src.src==='pf'&&An.src.val)rows.push({label:'Valor',value:T({value:h.w*An.src.val,unit:'€',quality:'DATA',bound:'exact',source:'Tu cartera (precio de cierre más reciente)'})});
    const Td=await today(An),it=Td&&Td.items.find(i=>i.e===e);
    if(it&&it.today){rows.push({label:'Movimiento de hoy',value:pctT(it.r*100,{quality:'DATA',bound:'exact',source:Td.src,date:Td.session,method:'Rentabilidad en euros desde el cierre anterior'})});
      rows.push({label:'Contribución a tu cartera hoy',value:pctT(it.c*100,{quality:'DATA',bound:'exact',source:Td.src,date:Td.session,method:'Rentabilidad × peso de ayer (suma exacta del movimiento de la cartera)'})});
      if(it.eur!=null)rows.push({label:'Contribución en euros',value:T({value:it.eur,unit:'€',quality:'DATA',bound:'exact',source:Td.src,date:Td.session})})}
    const others=An.P.filter(x=>x.e!==e&&x.e.k!=='s').map(x=>{const o=A().overlapDetail(e,x.e);return o?{x,o:o.o,rows:o.rows}:null}).filter(o=>o&&o.o>=.5).sort((a,b)=>b.o-a.o);
    others.slice(0,4).forEach(o=>rows.push({label:`Solapamiento conocido con ${String(o.x.e.tk||o.x.e.t)}`,value:pctT(o.o,{quality:'ESTIMATE',bound:'lower',source:'Mayores posiciones publicadas',method:'Σ mín(peso en A, peso en B) de las empresas comunes conocidas',calculation:o.rows.slice(0,3).map(r=>r.name).join(', ')})}));
    const x=A().expOf(e),ind=x.hold.slice(0,4).map(hh=>({label:`${hh.name} (dentro de este producto)`,value:pctT(h.w*hh.w,{quality:x.cover>=99.5?'DATA':'ESTIMATE',bound:x.cover>=99.5?'exact':'lower',source:d.provenance.composition&&d.provenance.composition.companies,coverage:Math.round(x.cover),
      calculation:`${d.atlasTicker} ${f1(h.w*100)} % × ${x.cover>=99.5?'':'≥ '}${f1(hh.w)} % = ${x.cover>=99.5?'':'≥ '}${f1(h.w*hh.w,2)} % de tu cartera`})}));
    out.sections.push({id:'mine',title:'En tu cartera',rows:rows.concat(ind)});
    /* lectura determinista */
    const R=An.R,i=R?R.assets.indexOf(e):-1;let corrTxt='';
    if(others[0]){const j=R?R.assets.indexOf(others[0].x.e):-1,cr=i>=0&&j>=0?R.M[i][j]:null;
      out.reading.push(`${d.atlasTicker} representa el ${f1(h.w*100)} % de tu cartera y comparte al menos un ${f1(others[0].o,0)} % de sus posiciones conocidas con ${String(others[0].x.e.tk||others[0].x.e.t)}.`);
      if(cr!=null&&cr>=.8)out.reading.push(`Su correlación histórica con ${String(others[0].x.e.tk||others[0].x.e.t)} es ${f1(cr,2)}: por eso cambiar su peso modifica menos la diversificación efectiva de lo que su peso aislado podría sugerir.`)}
    else out.reading.push(`${d.atlasTicker} representa el ${f1(h.w*100)} % de tu cartera.`);
    const RC=A().portfolio.riskContribution(An),rc=RC&&RC.items.find(r=>r.id===id);if(rc&&rc.contrib!=null)rows.push({label:'Contribución estimada al riesgo total',value:pctT(rc.contrib*100,{quality:'MODEL',bound:null,source:'Precios semanales en EUR (5 años)',method:RC.method,coverage:RC.coverage})})}
  if(e.k==='s'){const cb=await companyBlock(An,id);out.sections.push({id:'mine',title:'Exposición en tu cartera',rows:cb.rows,text:cb.text});out.companyKey=cb.key}
  if(e.k!=='s'){const x=A().expOf(e);out.sections.push({id:'inside',title:'Qué contiene',rows:x.hold.slice(0,6).map(hh=>({label:hh.name,value:pctT(hh.w,{quality:x.cover>=99.5?'DATA':'ESTIMATE',bound:x.cover>=99.5?'exact':'lower',source:d.provenance.composition&&d.provenance.composition.companies,date:d.provenance.composition&&d.provenance.composition.asof,coverage:Math.round(x.cover)})})),
      text:[`Cobertura de empresas conocidas: ${f1(x.cover,0)} % del producto${x.cover<99.5?' (cota inferior: el resto de la cartera del fondo no está publicado en ATLAS)':''}.`]})}
  const RS=await riskSingle(e,null),rows=[];if(e.k!=='s'){const ter=AS().describe(id).ter;rows.push({label:'TER',value:pctT(ter,{quality:ter==null?'INCOMPLETE':'DATA',bound:ter==null?null:'exact',source:d.provenance.ter})})}
  if(RS){rows.push({label:'Volatilidad histórica anual',value:pctT(RS.vol,{quality:'MODEL',source:d.provenance.price,date:RS.grid[RS.grid.length-1],method:'Desviación típica de la rentabilidad semanal en euros × √52 (5 años)'})});
    rows.push({label:'Caída máxima histórica',value:pctT(RS.dd,{quality:'MODEL',source:d.provenance.price,date:RS.grid[RS.grid.length-1],method:'Mayor caída desde máximos (semanal, en euros, 5 años)'})});
    rows.push({label:'Rentabilidad anual histórica',value:pctT(RS.cagr,{quality:'MODEL',source:d.provenance.price,date:RS.grid[RS.grid.length-1],method:'Rentabilidad compuesta anual, 5 años. Simulación histórica: no es una previsión'})})}
  else rows.push({label:'Riesgo histórico',value:T({value:null,quality:'INCOMPLETE',source:d.provenance.price,method:'Sin historial de precios suficiente'})});
  out.sections.push({id:'risk',title:'Riesgo y coste',rows});
  out.actions=[{id:'exposure',label:'Ver exposición',args:{id,key:out.companyKey}},{id:'simulate',label:'Simular',args:{id,key:out.companyKey}},...(e.k!=='s'?[{id:'compare',label:'Comparar',args:{id}}]:[]),{id:'detail',label:'Ficha completa',args:{id}}];
  return out}

async function runExposure(An,id){const k=AS().kindOf(id),d=AS().describe(id);
  if(k==='sector')return runSector(An,id);if(k==='country')return runCountry(An,id);
  if(k==='etf'||k==='fund'){const h=holdingOf(An,id);return{intent:'exposure',title:d.name,entity:d,sections:[{id:'mine',title:'En tu cartera',rows:[{label:'Peso',value:pctT(h?h.w*100:0,{quality:'DATA',bound:'exact',source:'Tu cartera'})}]}],reading:[],actions:[{id:'analyze',label:'Analizar',args:{id}}],warnings:d.warnings}}
  if(k==='stock'||k==='company'){const cb=await companyBlock(An,id);return{intent:'exposure',title:d.name,entity:d,sections:[{id:'mine',title:'Exposición en tu cartera',rows:cb.rows,text:cb.text}],reading:[],actions:[{id:'exposure',label:'Ver exposición',args:{id,key:cb.key}},{id:'simulate',label:'Simular',args:{id,key:cb.key}}],warnings:[],companyKey:cb.key}}
  /* índice / concepto: ATLAS no lo mide directamente */
  const mem=new Set(AS().conceptMembers(id)),held=(An.P||[]).filter(x=>mem.has(idOf(x.e)));const tot=held.reduce((a,x)=>a+x.w*100,0);
  return{intent:'exposure',title:d.name,entity:d,sections:[{id:'mine',title:'Productos de tu cartera relacionados',rows:held.map(x=>({label:`${String(x.e.tk||x.e.t)} · ${x.e.obj.u?x.e.obj.u.n:x.e.name}`,value:pctT(x.w*100,{quality:'DATA',bound:'exact',source:'Tu cartera'})})).concat(held.length>1?[{label:'Suma de esos productos',value:pctT(tot,{quality:'DATA',bound:'exact',source:'Tu cartera'})}]:[]),
    text:[`ATLAS no puede medir «${d.name}» directamente con los datos disponibles: no conoce el índice que replica cada fondo. Se listan los productos de tu cartera cuyo nombre o categoría corresponden a ese concepto; no se suma la exposición que pueda llegar por otros ETFs.`,...(held.length?[]:['No tienes productos de ese tipo en la cartera.'])]}],reading:[],actions:held.length?[{id:'simulate',label:'Simular',args:{id:idOf(held[0].e)}}]:[],warnings:[]}}

function runSector(An,id){const name=AS().nameOf(id),L=An.L,tot=L.S[name]||0,cov=100-(L.S[A().UNK]||0),agg=new Map();(L.byS[name]||[]).forEach(o=>agg.set(o.e,(agg.get(o.e)||0)+o.p));
  const rows=[...agg.entries()].sort((a,b)=>b[1]-a[1]).map(([e,p])=>{const x=A().expOf(e),own=x.sector[name]||0,q=x.q.sector,w=(An.P.find(y=>y.e===e)||{w:0}).w*100;
    return{label:`${String(e.tk||e.t)} — ${f1(w)} % de tu cartera`,sub:`${name}: ${f1(own)} % del producto`,value:pctT(p,{quality:q==='real'?'DATA':'ESTIMATE',bound:q==='real'?'exact':'lower',source:'Reparto sectorial publicado',method:'Peso del producto × % del sector en el producto',calculation:`${f1(w)} % × ${f1(own)} % = ${f1(p,2)} pp`,unit:'pp'}),narrow:A().isNarrow(e)}});
  const broad=rows.filter(r=>!r.narrow).reduce((a,r)=>a+r.value.value,0),narrowL=rows.filter(r=>r.narrow);
  const text=[];if(narrowL.length&&broad>=1)text.push(`Tu exposición a ${name} no proviene solo de ${narrowL.map(r=>r.label.split(' — ')[0]).join(' y ')}: ${f1(broad)} pp proceden de productos amplios.`);
  if(cov<99.5)text.push(`Cobertura sectorial: ${f1(cov,0)} % de la cartera. La parte sin desglose podría contener más ${name}.`);
  return{intent:'sectorHoldings',title:`${name} en tu cartera`,entity:AS().describe(id),sections:[{id:'sec',title:`Exposición total a ${name}`,rows:[{label:'Total',value:pctT(tot,{quality:cov>=99.5?'DATA':cov>=60?'ESTIMATE':'INCOMPLETE',bound:cov>=99.5?'exact':'lower',coverage:Math.round(cov),source:'Reparto sectorial publicado'})}]},{id:'by',title:'Por producto',rows,text}],reading:[],actions:[{id:'explore',label:'Explorar cambios',args:{problem:{kind:'sec',ref:name}}}],warnings:[]}}
function runCountry(An,id){const iso=id.slice(4),name=AS().nameOf(id),L=An.L,tot=L.C[iso]||0,cov=L.ccCover,agg=new Map();(L.byC[iso]||[]).forEach(o=>agg.set(o.e,(agg.get(o.e)||0)+o.p));
  const rows=[...agg.entries()].sort((a,b)=>b[1]-a[1]).map(([e,p])=>{const x=A().expOf(e),w=(An.P.find(y=>y.e===e)||{w:0}).w*100;return{label:`${String(e.tk||e.t)} — ${f1(w)} % de tu cartera`,sub:`${f1(x.country[iso]||0)} % del producto`,value:pctT(p,{quality:x.q.country==='real'?'DATA':'ESTIMATE',bound:x.q.country==='real'?'exact':'lower',source:'Reparto por países publicado',calculation:`${f1(w)} % × ${f1(x.country[iso]||0)} % = ${f1(p,2)} pp`,unit:'pp'})}});
  const gaps=(An.P||[]).filter(x=>x.e.k!=='s'&&A().expOf(x.e).q.country==='none');
  const text=[];if(gaps.length)text.push(`Sin desglose por países: ${gaps.map(x=>`${String(x.e.tk||x.e.t)} (${f1(x.w*100)} %)`).join(', ')}. Esa parte no se reparte entre países.`);
  return{intent:'countryDependence',title:`${name} en tu cartera`,entity:AS().describe(id),sections:[{id:'cty',title:`Dependencia de ${name}`,rows:[{label:'Total',value:pctT(tot,{quality:cov>=99.5?'DATA':cov>=60?'ESTIMATE':'INCOMPLETE',bound:cov>=99.5?'exact':'lower',coverage:Math.round(cov),source:'Reparto por países publicado'})}]},{id:'by',title:'Por producto',rows,text}],reading:[],actions:[{id:'explore',label:'Explorar cambios',args:{problem:{kind:'cty',ref:iso}}}],warnings:[]}}

function runComposition(An,id){const d=AS().describe(id),e=AS().entity(id),x=A().expOf(e),h=holdingOf(An,id),comp=d.provenance.composition||{};
  const q2=(q)=>q==='real'?['DATA','exact']:q==='none'?['INCOMPLETE',null]:['ESTIMATE','lower'];
  const top=Object.entries(x.sector).filter(([k])=>k!==A().UNK).sort((a,b)=>b[1]-a[1]).slice(0,6),cty=Object.entries(x.country).filter(([k])=>k!=='XX').sort((a,b)=>b[1]-a[1]).slice(0,6);
  const secs=[{id:'co',title:'Empresas (mayores posiciones conocidas)',rows:x.hold.slice(0,10).map(hh=>({label:hh.name,value:pctT(hh.w,{quality:x.cover>=99.5?'DATA':'ESTIMATE',bound:x.cover>=99.5?'exact':'lower',source:comp.companies,date:comp.asof,coverage:Math.round(x.cover)})})),
      text:[`Cobertura de empresas conocidas: ${f1(x.cover,0)} % del producto.${x.cover<99.5?' Cada cifra es un mínimo: la parte no publicada puede contener más de cada empresa.':''}`]},
    {id:'sec',title:'Sectores',rows:top.map(([k,v])=>({label:k,value:pctT(v,{quality:q2(x.q.sector)[0],bound:q2(x.q.sector)[1],source:comp.sectors})}))},
    {id:'cty',title:'Países',rows:cty.map(([k,v])=>({label:(A().CNAME&&A().CNAME[k])||k,value:pctT(v,{quality:q2(x.q.country)[0],bound:q2(x.q.country)[1],source:comp.countries})})),text:x.q.country==='none'?['Este producto no publica desglose por países en ATLAS.']:[]}];
  if(h){const ov=An.P.filter(y=>y.e!==e&&y.e.k!=='s').map(y=>{const o=A().overlapDetail(e,y.e);return o?{y,o}:null}).filter(Boolean).sort((a,b)=>b.o.o-a.o.o);
    secs.push({id:'ovl',title:`En tu cartera, ${d.atlasTicker} se solapa con`,rows:ov.map(({y,o})=>({label:`${String(y.e.tk||y.e.t)}`,sub:o.rows.slice(0,3).map(r=>r.name).join(', '),value:pctT(o.o,{quality:'ESTIMATE',bound:'lower',source:'Mayores posiciones publicadas',method:'Σ mín(peso en A, peso en B) de las empresas comunes conocidas'})})),text:ov.length?[]:['No hay otros ETFs en tu cartera con posiciones conocidas en común.']})}
  return{intent:'composition',title:`Qué hay dentro de ${d.atlasTicker}`,entity:d,sections:secs,reading:[],actions:[{id:'analyze',label:'Analizar',args:{id}},{id:'exposure',label:'Ver exposición',args:{id}}],warnings:d.warnings}}
async function runCompare(An,a,b){const da=AS().describe(a),db=AS().describe(b),ea=AS().entity(a),eb=AS().entity(b);const [ra,rb,rr]=await Promise.all([riskSingle(ea),riskSingle(eb),A().riskOf([{e:ea,w:.5},{e:eb,w:.5}])]);
  const ov=A().overlapDetail(ea,eb),cr=rr&&rr.M&&rr.M.length===2?rr.M[0][1]:null,row=(l,va,vb,o)=>({label:l,cols:[va,vb].map(v=>pctT(v,o))});
  return{intent:'compare',title:`${da.atlasTicker} y ${db.atlasTicker}`,entities:[da,db],sections:[{id:'cmp',title:'Comparación (sin ganador)',table:{head:[da.atlasTicker,db.atlasTicker],rows:[
      row('TER',da.ter,db.ter,{quality:'DATA',bound:'exact'}),row('Volatilidad histórica',ra&&ra.vol,rb&&rb.vol,{quality:'MODEL'}),row('Caída máxima histórica',ra&&ra.dd,rb&&rb.dd,{quality:'MODEL'}),
      row('Peso en tu cartera',(holdingOf(An,a)||{w:0}).w*100,(holdingOf(An,b)||{w:0}).w*100,{quality:'DATA',bound:'exact'})]},
    rows:[{label:'Solapamiento conocido entre ambos',value:pctT(ov?ov.o:null,{quality:ov?'ESTIMATE':'INCOMPLETE',bound:ov?'lower':null,source:'Mayores posiciones publicadas'})},{label:'Correlación histórica',value:T({value:cr,unit:'',quality:cr==null?'INCOMPLETE':'MODEL',method:'Correlación de rentabilidades semanales en EUR'})}]}],
    reading:[],actions:[{id:'compareOpen',label:'Abrir en Comparar',args:{a,b}},{id:'simulate',label:`Simular sustituir ${da.atlasTicker} por ${db.atlasTicker}`,args:{replace:[a,b]}}],warnings:da.warnings.concat(db.warnings)}}
function runOverlap(An){const F=(An.P||[]).filter(x=>x.e.k!=='s'),pairs=[];F.forEach((a,i)=>F.slice(i+1).forEach(b=>{const o=A().overlapDetail(a.e,b.e);if(o)pairs.push({a,b,o})}));pairs.sort((x,y)=>y.o.o-x.o.o);
  return{intent:'overlapTop',title:'Solapamiento entre tus productos',sections:[{id:'ovl',title:'Pares de tu cartera, de mayor a menor solapamiento conocido',rows:pairs.slice(0,8).map(p=>({label:`${String(p.a.e.tk||p.a.e.t)} y ${String(p.b.e.tk||p.b.e.t)}`,sub:p.o.rows.slice(0,3).map(r=>r.name).join(', '),value:pctT(p.o.o,{quality:'ESTIMATE',bound:'lower',source:'Mayores posiciones publicadas',method:'Σ mín(peso en A, peso en B) de las empresas comunes conocidas'})})),
    text:pairs.length?['Cota inferior: solo se comparan las mayores posiciones publicadas de cada ETF.']:['Necesitas al menos dos ETFs con posiciones conocidas.']}],reading:[],actions:[{id:'explore',label:'Explorar cambios',args:{}}],warnings:[]}}
function runRisk(An){const RC=A().portfolio.riskContribution(An);if(!RC)return{intent:'riskTop',title:'Contribución al riesgo',sections:[{id:'rk',title:'Contribución al riesgo',rows:[],text:['No hay historial de precios suficiente para estimarla.']}],reading:[],actions:[],warnings:[]};
  return{intent:'riskTop',title:'Contribución de cada posición al riesgo',sections:[{id:'rk',title:'De mayor a menor contribución estimada',rows:RC.items.map(r=>({label:`${String(AS().entity(r.id).tk||r.id)} — ${f1(r.w*100)} % de tu cartera`,sub:r.vol==null?'sin historial de precios':`volatilidad propia ${f1(r.vol)} %`,value:pctT(r.contrib==null?null:r.contrib*100,{quality:r.contrib==null?'INCOMPLETE':'MODEL',source:'Precios semanales en EUR (5 años)',method:RC.method,coverage:RC.coverage})})),
    text:[RC.meaning,'Es un modelo estadístico sobre el pasado, no una indicación de qué cambiar.']}],reading:[],actions:[{id:'explore',label:'Explorar cambios',args:{problem:{kind:'vol',ref:null}}}],warnings:[]}}

async function run(intent,args,An){args=args||{};
  if(intent==='asset')return runAsset(An,args.id);if(intent==='exposure')return runExposure(An,args.id);if(intent==='composition')return runComposition(An,args.id);
  if(intent==='sectorHoldings')return runSector(An,args.id);if(intent==='countryDependence')return runCountry(An,args.id);
  if(intent==='compare')return runCompare(An,args.a,args.b);if(intent==='overlapTop')return runOverlap(An);if(intent==='riskTop')return runRisk(An);
  if(intent==='today'){const Td=await today(An);return{intent:'today',title:'Lo que importa hoy',today:Td,sections:Td?[{id:'td',title:'Qué te ha movido · por producto',rows:Td.items.slice(0,6).map(i=>({label:String(i.e.tk||i.e.t),id:idOf(i.e),value:pctT(i.c*100,{quality:'DATA',bound:'exact',source:Td.src,date:Td.session,method:'Rentabilidad × peso de ayer'})}))}]:[],reading:[],actions:[{id:'todayOpen',label:'Abrir «Lo que importa ahora»',args:{}}],warnings:[]}}
  if(intent==='explore')return{intent:'explore',title:'Explorar cambios',sections:[],reading:[],actions:[{id:'explore',label:'Abrir Explorar cambios',args:{}}],warnings:[]};
  if(intent==='scenario')return{intent:'scenario',parsed:args.parsed,sections:[],reading:[],actions:[],warnings:[]};
  return{intent:'unsupported',...UNSUP}}
window.ATLASI.query={parse,run,choose,EXAMPLES};
})();
