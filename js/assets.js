/* ATLAS · Resolución universal de entidades (ATLASI.assets) — única fuente de verdad
   ─────────────────────────────────────────────────────────────────────────────
   entityId = la clave interna existente (`e:QQQ`, `f:F_FIDW`, `s:NVDA`) + entidades conceptuales nuevas sin precio:
   `co:<clave>` (empresa que solo aparece dentro de ETFs), `sec:<sector>`, `cty:<ISO>`, `idx:<índice>` y `cat:<categoría>`.
   El ticker NO es identidad: es una forma de buscar.

   Prioridad (se detiene en el primer nivel con resultado; ≥ 2 resultados en un mismo nivel → ask, nunca se elige en silencio):
     1 ISIN exacto · 2 ticker en cartera (visible · equivalente EE. UU. · clave) · 3 ticker en el universo · 4 nombre exacto
     5 alias / concepto (cartera primero) · 6 parcial: SOLO nombre y ticker (nunca la descripción libre)
   No se inventa nada: ISIN, equivalentes, cotizaciones o índices que no estén en los datos → null. */
(function(){'use strict';
const A=()=>window.ATLASI;
const nz=s=>String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9&]+/g,' ').trim();
const UP=s=>String(s==null?'':s).toUpperCase().replace(/\s+/g,'');
const ISIN_RX=/^[A-Z]{2}[A-Z0-9]{9}\d$/;
const idOf=e=>e.k+':'+e.t;
const KIND={e:'etf',f:'fund',s:'stock'};
const PRODUCT=['etf','fund','stock'];
const byId=(a,b)=>a<b?-1:a>b?1:0;

/* Conceptos (alias). Un concepto NO es un producto: en contexto de cartera puede corresponder a productos concretos (y si hay varios, se pregunta). */
const CONCEPTS=[
  {id:'idx:nasdaq100',kind:'index',name:'Nasdaq-100',rx:/^(el |la )?(nasdaq( ?100)?|nasdaq-100|ndx)$/,member:(e,n)=>/nasdaq/.test(n)},
  {id:'idx:sp500',kind:'index',name:'S&P 500',rx:/^(el |la )?(s ?& ?p( ?500)?|sp ?500|s and p 500)$/,member:(e,n,strict)=>/s&p 500|s&p500|sp 500/.test(n)&&!(strict&&(e.obj.lev||/equal|equipond|leveraged|ultra|×|\b[23]x\b/.test(n)))},
  {id:'idx:world',kind:'index',name:'Renta variable mundial (World / All-World)',rx:/^(el |la )?(world|mundo|mundial|msci world|all ?world|acwi|indice mundial)$/,member:(e,n,s,tg)=>tg.includes('world')||/\b(world|all-world|all world|acwi)\b/.test(n)},
  {id:'cat:em',kind:'concept',name:'Mercados emergentes',rx:/^(los |las )?(emergentes|mercados emergentes|emerging( markets)?|em)$/,member:(e,n,s,tg)=>tg.includes('em')},
  {id:'cat:bond',kind:'concept',name:'Renta fija (bonos)',rx:/^(los |la )?(bonos|renta fija|bond|bonds)$/,member:(e,n,s,tg)=>tg.includes('bond')},
  {id:'cat:gold',kind:'concept',name:'Oro',rx:/^(el )?(oro|gold)$/,member:(e,n,s,tg)=>tg.includes('gold')&&/\b(gold|oro)\b/.test(n)},
  {id:'cat:small',kind:'concept',name:'Pequeñas empresas (small caps)',rx:/^(las |los )?(small ?caps?|pequenas( empresas)?|empresas pequenas)$/,member:(e,n,s,tg)=>tg.includes('small')},
  {id:'cat:europe',kind:'concept',name:'Europa',rx:/^(europa|europe)$/,member:(e,n,s,tg)=>tg.includes('europe')},
  {id:'cat:japan',kind:'concept',name:'Japón',rx:/^(japon|japan)$/,member:(e,n,s,tg)=>tg.includes('japan')},
  {id:'cat:semis',kind:'concept',name:'Semiconductores',rx:/^(los )?(semis|semiconductores)$/,member:(e,n)=>/semicond/.test(n)}];
/* Sectores: los 11 nombres que usan los datos de composición. Sinónimos mínimos. */
const SECTORS=[['Tecnología',/^(la )?(tecnolog\w*|tech|tecnologica|it)$/],['Salud',/^(la )?(salud|sanidad|healthcare)$/],['Finanzas',/^(las )?(financ\w*|banca|bancos)$/],['Energía',/^(la )?energia$/],
  ['Industria',/^(la )?industri\w*$/],['Consumo básico',/^(el )?consumo basico$/],['Consumo discrecional',/^(el )?consumo( discrecional| ciclico)?$/],['Inmobiliario',/^(el )?inmobiliari\w*$/],
  ['Materiales',/^(los )?materiales$/],['Comunicaciones',/^(las )?(comunicaciones|telecomunicaciones|telecos?)$/],['Servicios públicos',/^(los )?(servicios publicos|utilities)$/]];
const CTY_SYN={US:['eeuu','ee uu','usa','eua','estados unidos','united states','us'],GB:['reino unido','uk','gran bretana'],CN:['china'],JP:['japon','japan'],DE:['alemania'],FR:['francia'],ES:['espana'],IN:['india'],TW:['taiwan'],KR:['corea','corea del sur']};

let IX=null,_ver='';
function verOf(){const ex=A()&&A().EXPO;const im=typeof _isinMap!=='undefined'&&_isinMap?Object.keys(_isinMap).length:0;return (ex&&ex.u||'-')+'|'+im+'|'+(typeof searchEntities==='function'?searchEntities().length:0)}
const push=(m,k,id)=>{if(!k)return;let s=m.get(k);if(!s)m.set(k,s=new Set());s.add(id)};
function build(){const v=verOf();if(IX&&_ver===v)return IX;_ver=v;
  const E=searchEntities(),ent=new Map(),isin=new Map(),tick=new Map(),name=new Map(),words=[];
  E.forEach(e=>{const id=idOf(e);ent.set(id,e);const is=isinOf(e);if(is)push(isin,is,id);
    const vis=String(e.tk||e.t),us=e.k==='e'&&e.obj.u&&e.t!==e.obj.u.t?e.t:null;
    [vis,e.t,us,e.k==='s'?(typeof dispT==='function'?dispT(e.obj):null):null].forEach(t=>t&&push(tick,UP(t),id));
    /* solo nombres oficiales (los títulos temáticos de ATLAS, p. ej. «Oro» o «Todo el mundo…», son etiquetas descriptivas y no identifican) */
    const nm=[e.k==='e'?null:e.name,e.obj.n,e.obj.full,e.obj.u&&e.obj.u.n].filter(Boolean);nm.forEach(n=>push(name,nz(n),id));words.push({id,kind:KIND[e.k],n:nm.map(nz).join(' | '),t:[vis,e.t,us].filter(Boolean).map(UP)})});
  /* ISIN añadidos por el usuario (data/isin_map.json) */
  const im=typeof _isinMap!=='undefined'&&_isinMap?_isinMap:{};Object.entries(im).forEach(([k,m])=>{if(!m||m.err)return;const e=E.find(x=>m.k==='f'?x.k==='f'&&isinOf(x)===(m.isin||k):x.k===m.k&&x.t===m.t);if(e)push(isin,UP(k),idOf(e))});
  /* empresas: acciones del universo + empresas que solo aparecen dentro de ETFs (clave ckey) */
  const comp=new Map(),ck=A().ckey;E.filter(e=>e.k==='s').forEach(e=>comp.set(ck(e.name,e.t),idOf(e)));
  const ex=A().EXPO;const coName=new Map();
  const alsoN=new Map();   // nombres con que aparece cada empresa dentro de los ETFs (exactos), también para acciones del universo
  if(ex&&ex.fund)Object.values(ex.fund).forEach(r=>[].concat(r.top||[],r.top_j||[]).forEach(h=>{const k=ck(h[0],h[1]);if(!comp.has(k)){comp.set(k,'co:'+k);coName.set('co:'+k,h[0])}const id=comp.get(k);push(alsoN,id,h[0])}));
  alsoN.forEach((ns,id)=>{ns.forEach(n=>push(name,nz(n),id));const w=words.find(x=>x.id===id);const txt=[...ns].map(nz).join(' | ');if(w)w.n+=' | '+txt;else words.push({id,kind:'company',n:txt,t:[]})});
  /* sectores y países */
  const sec=new Map(SECTORS.map(([s])=>['sec:'+s,s])),cty=new Map();
  SECTORS.forEach(([s])=>push(name,nz(s),'sec:'+s));
  const CN=A().CNAME||{};Object.entries(CN).forEach(([iso,n])=>{cty.set('cty:'+iso,n);push(name,nz(n),'cty:'+iso)});Object.entries(CTY_SYN).forEach(([iso,l])=>{if(!cty.has('cty:'+iso))cty.set('cty:'+iso,CN[iso]||iso);l.forEach(s=>push(name,nz(s),'cty:'+iso))});
  IX={ent,isin,tick,name,words,comp,coName,sec,cty};return IX}
function kindOf(id){const p=id.split(':')[0];if(p==='e'||p==='f'||p==='s')return KIND[p];return{co:'company',sec:'sector',cty:'country',idx:'index',cat:'concept'}[p]||'unknown'}
const kindOk=(id,kinds)=>{if(!kinds||!kinds.length)return true;const k=kindOf(id);return kinds.includes(k)||(k==='stock'&&kinds.includes('company'))};
function heldMap(P){const m=new Map();(P||[]).forEach(x=>{const id=x.id||(x.e?idOf(x.e):null);if(id)m.set(id,(m.get(id)||0)+(+x.w||0))});const t=[...m.values()].reduce((a,v)=>a+v,0);if(t>0)m.forEach((v,k)=>m.set(k,v/t));return m}
function nameOfId(id){const ix=build();const e=ix.ent.get(id);if(e)return e.name;if(ix.coName.has(id))return ix.coName.get(id);if(ix.sec.has(id))return ix.sec.get(id);if(ix.cty.has(id))return ix.cty.get(id);const c=CONCEPTS.find(c=>c.id===id);return c?c.name:id}
function opt(id,H){const d=describe(id);return{id,name:d.name,atlasTicker:d.atlasTicker,usTicker:d.usTicker,isin:d.isin,weight:H&&H.has(id)?Math.round(H.get(id)*1e4)/100:null}}
function order(ids,H){return [...ids].sort((a,b)=>((H.get(b)||0)-(H.get(a)||0))||byId(a,b))}
function askOf(ids,H,question,reason,extra){const L=order(ids,H);return{ask:{question,reason,options:L.slice(0,12).map(id=>opt(id,H)),more:Math.max(0,L.length-12),...(extra||{})}}}
function conceptMembers(c,strict){const ix=build(),out=[];ix.ent.forEach((e,id)=>{if(e.k==='s')return;const n=(e.name+' '+(e.obj.n||'')+' '+(e.obj.u&&e.obj.u.n||'')).toLowerCase(),tg=c.id.startsWith('idx:nasdaq')||c.id==='idx:sp500'||c.id==='cat:semis'?[]:A().tagsOf(e);
  if(c.member(e,n,strict,tg)&&!(strict&&(e.obj.lev||/\b[23]x\b|×|ultra|leveraged|apalanc/i.test(e.name))))out.push(id)});return out.sort(byId)}
/* resolve(input, {P, mode:'held'|'any'|'auto', kinds, concept:'entity'|'product'}) */
function resolve(input,o={}){const raw=String(input==null?'':input).trim().replace(/^[-•*·]+\s*/,'').replace(/[¿?¡!.,;:]+$/,'').trim();const ix=build(),H=heldMap(o.P),mode=o.mode||'auto',kinds=o.kinds||null,held=mode==='held';
  if(!raw)return{none:{text:'Escribe un ticker, un nombre o un ISIN.',hint:null}};
  const U=UP(raw),N=nz(raw),okK=id=>kindOk(id,kinds),inH=id=>H.has(id);
  const done=(ids,how,conf,q,reason)=>{let L=[...ids].filter(okK);if(held)L=L.filter(inH);if(!L.length)return null;if(L.length===1)return{match:{id:L[0],kind:kindOf(L[0]),how,confidence:conf}};
    return askOf(L,H,q||`He encontrado ${L.length} productos que coinciden con «${raw}». ¿Cuál?`,reason||'same-level')};
  /* 1 · ISIN */
  if(ISIN_RX.test(U)){const r=done(ix.isin.get(U)||[],'isin','exact',`El ISIN ${U} corresponde a ${(ix.isin.get(U)||[]).size} registros de ATLAS. ¿Cuál?`,'isin-dup');if(r)return r;
    return{none:{text:held?`El ISIN ${U} no está en tu cartera.`:`No encuentro el ISIN ${U} en ATLAS.`,hint:held?null:'Si es un ETF o un fondo, puedes añadirlo desde Mi cartera con su ISIN para que ATLAS lo siga.'}}}
  /* 2 · ticker en cartera  3 · ticker en universo */
  const tk=ix.tick.get(U);if(tk){const hs=[...tk].filter(inH);let r=hs.length?done(hs,'ticker-cartera','exact'):null;if(r)return r;if(!held){r=done(tk,'ticker','exact');if(r)return r}}
  /* 4 · nombre exacto */
  const nm=ix.name.get(N);if(nm){const hs=[...nm].filter(inH);let r=hs.length?done(hs,'nombre','exact'):null;if(r)return r;if(!held){r=done(nm,'nombre','exact');if(r)return r}}
  /* 5 · alias / concepto */
  const c=CONCEPTS.find(c=>c.rx.test(N));
  if(c){const members=conceptMembers(c,false),hs=members.filter(inH);
    if(o.concept==='product'||held){if(hs.length===1)return{match:{id:hs[0],kind:kindOf(hs[0]),how:'alias',confidence:'alias',concept:c.id}};
      if(hs.length>1)return askOf(hs,H,`Tienes ${hs.length} productos que podrían representar ${c.name}. ¿Cuál?`,'concept-held',{concept:c.id});
      if(held)return{none:{text:`No tienes productos de ${c.name} en la cartera.`,hint:null}};
      const U2=conceptMembers(c,true).filter(okK);if(U2.length===1)return{match:{id:U2[0],kind:kindOf(U2[0]),how:'alias',confidence:'alias',concept:c.id}};
      const ter=id=>{const t=A().terOf(ix.ent.get(id));return t==null?9:t};
      return{ask:{question:`¿Qué producto de «${c.name}»? Ordenados por TER (menor primero); el orden no es una recomendación.`,reason:'concept-universe',concept:c.id,order:'ter',
        options:U2.sort((a,b)=>ter(a)-ter(b)||byId(a,b)).slice(0,8).map(id=>opt(id,H)),more:Math.max(0,U2.length-8)}}}
    if(!kinds||kinds.includes(c.kind)||kinds.includes('concept'))return{match:{id:c.id,kind:c.kind,how:'alias',confidence:'alias',members,held:hs}}}
  const sc=SECTORS.find(([,rx])=>rx.test(N));if(sc&&!held&&okK('sec:'+sc[0]))return{match:{id:'sec:'+sc[0],kind:'sector',how:'alias',confidence:'alias'}};
  const cs=Object.entries(CTY_SYN).find(([,l])=>l.includes(N));if(cs&&!held&&okK('cty:'+cs[0]))return{match:{id:'cty:'+cs[0],kind:'country',how:'alias',confidence:'alias'}};
  /* 6 · parcial: solo nombre (inicio de palabra) y ticker (prefijo), nunca descripción */
  if(N.length>=3){const rx=new RegExp('(^|[ |])'+N.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const hit=ix.words.filter(w=>(rx.test(w.n)||(U.length>=3&&w.t.some(t=>t.startsWith(U))))).map(w=>w.id);
    const hs=hit.filter(inH);let r=hs.length?done(hs,'parcial','partial',`He encontrado ${hs.length} productos de tu cartera que coinciden con «${raw}». ¿Cuál?`):null;if(r)return r;
    if(!held){r=done(hit,'parcial','partial');if(r)return r}}
  return{none:{text:held?`«${raw}» no está en tu cartera.`:`No encuentro «${raw}» en ATLAS.`,hint:held?null:(U.length>=3&&U.length<=6&&/^[A-Z0-9]+$/.test(U)?'No está en ATLAS con ese ticker. Si es un ETF o un fondo, prueba con su ISIN.':'Puedes probar con el nombre completo, el ticker o el ISIN.')}}}

/* describe(id): identificación y procedencia. Lo que no existe en los datos → null. */
function describe(id){const ix=build(),e=ix.ent.get(id),k=kindOf(id);
  if(!e){return{entityId:id,kind:k,name:nameOfId(id),atlasTicker:null,usTicker:null,isin:null,listings:[],provenance:{price:null,ter:null,composition:null},warnings:[],
    members:k==='index'||k==='concept'?conceptMembers(CONCEPTS.find(c=>c.id===id)||{member:()=>false},false):undefined}}
  const u=e.k==='e'&&e.obj.u?e.obj.u:null,usT=u&&u.t!==e.t?e.t:null,isin=isinOf(e)||null;
  const r=A().EXPO&&A().EXPO.fund?A().EXPO.fund[e.k+':'+e.t]:null;const x=e.k!=='s'?A().expOf(e):null;
  const px=usT?`${usT} (EE. UU.) · cierres de Yahoo Finance convertidos a EUR`:`${String(e.tk||e.t)} · cierres de Yahoo Finance / EODHD convertidos a EUR`;
  const terSrc=e.k==='s'?null:A().terOf(e)==null?null:(usT?`${usT} (EE. UU.)`:String(e.tk||e.t));
  const comp=e.k==='s'?null:{companies:r&&r.top&&r.top.length?`Yahoo Finance (${usT||e.t})`:r&&r.top_j?`justETF (${r.jisin||isin||'—'})`:null,sectors:r&&r.sector&&Object.keys(r.sector).length?`Yahoo Finance (${usT||e.t})`:r&&r.sector_j?`justETF (${r.jisin||isin||'—'})`:null,
    countries:r&&r.src_j&&r.country&&Object.keys(r.country).length?`justETF (${r.jisin||isin||'—'})`:x&&x.q.country==='partial'?'Estimado con las 10 mayores posiciones':null,asof:r&&(r.asof_j||r.asof)||null};
  const warnings=[];if(usT)warnings.push(`⚠ Datos combinados de dos productos. Precio y TER corresponden a ${usT} (EE. UU.). Datos UCITS (ticker, nombre e ISIN) corresponden a ${u.t} (ISIN ${u.isin||'no disponible'}). Composición: empresas y sectores de ${comp&&comp.companies||'—'}; países de ${comp&&comp.countries||'—'}.`);
  return{entityId:id,kind:k,name:u?u.n:(e.obj.full||e.name),shortName:e.name,atlasTicker:String(e.tk||e.t),usTicker:usT,isin,listings:[],provenance:{price:px,ter:terSrc,composition:comp},warnings,
    ter:e.k==='s'?null:A().terOf(e),issuer:e.obj.iss||null}}

/* trace(): estructura común de toda cifra que llega a la interfaz */
const QUAL=['DATA','ESTIMATE','MODEL','INCOMPLETE'],BOUNDS=['exact','lower',null];
function trace(v){const o=v||{};const t={unit:o.unit==null?null:o.unit,value:o.value==null?null:o.value,quality:QUAL.includes(o.quality)?o.quality:'INCOMPLETE',bound:BOUNDS.includes(o.bound)?o.bound:null,source:o.source||null,date:o.date||null,coverage:o.coverage==null?null:o.coverage,method:o.method||null,calculation:o.calculation||null};
  if(t.value==null&&t.quality!=='INCOMPLETE')t.quality='INCOMPLETE';return t}

/* utilidades para consumidores */
function entity(id){return build().ent.get(id)||null}
function resolveEntity(input,o){const r=resolve(input,{...o,kinds:o&&o.kinds||PRODUCT,concept:'product'});return r.match?{e:entity(r.match.id),r}:{e:null,r}}
function companyId(key){const ix=build();return ix.comp.get(key)||'co:'+key}
window.ATLASI.assets={resolve,describe,trace,entity,resolveEntity,companyId,kindOf,nameOf:nameOfId,conceptMembers:id=>{const c=CONCEPTS.find(x=>x.id===id);return c?conceptMembers(c,false):[]},
  CONCEPTS:CONCEPTS.map(c=>({id:c.id,kind:c.kind,name:c.name})),SECTORS:SECTORS.map(s=>s[0]),ISIN_RX,PRODUCT,_ix:()=>build()};
})();
