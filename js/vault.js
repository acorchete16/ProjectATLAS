/* =====================================================================================================
   ATLAS · Svalbard Global Seed Vault (Platåberget, Svalbard · 78.2357 N, 15.4911 E)
   Exterior → entrada → túnel → bóveda → ATLAS Data Core → panel.
   - Relieve REAL: Copernicus DEM GLO-30 (data/svb/dem.u16, 12 × 12 km, 15,6 m/px) + detalle fino solo cerca de la entrada.
   - Texturas PBR CC0 (Poly Haven): nieve, roca, canchal, hormigón, roca de túnel, suelo, metal (data/svb).
   - Cielo físico (Sky de three.js) con sol de medianoche de primavera (bajo, desde el NNO), niebla atmosférica.
   - Iluminación interior precalculada en vértices (sin decenas de luces dinámicas). Render solo cuando algo se mueve.
   Usa three.js r128 (cargado bajo demanda) y helpers globales de index.html (loadScript, sheetPush, sheetPop, mobile).
   ===================================================================================================== */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const SV={on:false,state:0};
const B3='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
async function libs(){if(!window.THREE)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  if(!THREE.Sky)await loadScript(B3+'objects/Sky.js');if(!THREE.Water)await loadScript(B3+'objects/Water.js').catch(()=>0)}
const LOWEND=()=>mobile()||(navigator.hardwareConcurrency||8)<=4||/[?&]svlow/.test(location.search);

/* ---------- relieve real ---------- */
let DEM=null,FAR=null;
async function loadFar(){try{const [j,b]=await Promise.all([fetch('data/svb/far.json').then(r=>r.json()),fetch('data/svb/far.u16').then(r=>r.arrayBuffer())]);const u=new Uint16Array(b),n=j.px,h=new Float32Array(n*n),k=(j.zmax-j.zmin)/65535;for(let i=0;i<n*n;i++)h[i]=u[i]*k+j.zmin;FAR={n,size:j.size_m,h}}catch(e){FAR=null}}
async function loadDEM(){if(DEM)return DEM;loadFar();const [j,b]=await Promise.all([fetch('data/svb/dem.json').then(r=>r.json()),fetch('data/svb/dem.u16').then(r=>r.arrayBuffer())]);
  const u=new Uint16Array(b),n=j.px,h=new Float32Array(n*n),k=(j.zmax-j.zmin)/65535;for(let i=0;i<n*n;i++)h[i]=u[i]*k+j.zmin;DEM={n,size:j.size_m,h,src:j.source};return DEM}
function farAt(x,z){const {n,size,h}=FAR;let px=(x/size+.5)*(n-1),pz=(z/size+.5)*(n-1);px=Math.max(0,Math.min(n-1.001,px));pz=Math.max(0,Math.min(n-1.001,pz));const i=Math.floor(px),j=Math.floor(pz),fx=px-i,fz=pz-j;return (h[j*n+i]*(1-fx)+h[j*n+i+1]*fx)*(1-fz)+(h[(j+1)*n+i]*(1-fx)+h[(j+1)*n+i+1]*fx)*fz}
function demAt(x,z){const {n,size,h}=DEM;let px=(x/size+.5)*(n-1),pz=(z/size+.5)*(n-1);px=Math.max(0,Math.min(n-1.001,px));pz=Math.max(0,Math.min(n-1.001,pz));
  const i=Math.floor(px),j=Math.floor(pz),fx=px-i,fz=pz-j,a=h[j*n+i],b=h[j*n+i+1],c=h[(j+1)*n+i],d=h[(j+1)*n+i+1];return (a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz}
/* ruido determinista para el detalle fino (no se ve «procedural» porque solo modula metros cerca de la entrada) */
function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function vnoise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v}
function fbm(x,y,o=5){let a=0,f=1,s=.5;for(let k=0;k<o;k++){a+=s*vnoise(x*f,y*f);f*=2.03;s*=.5}return a}

/* ---------- geometría del lugar ---------- */
// marco local de la entrada: el portal mira cuesta abajo (hacia el fiordo). P(x,z) local → mundo
let F={};
function frame(){const e=6,gx=(demAt(e,0)-demAt(-e,0))/(2*e),gz=(demAt(0,e)-demAt(0,-e))/(2*e);let dx=-gx,dz=-gz;const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
  F={fx:dx,fz:dz,rx:dz,rz:-dx,y0:demAt(0,0),ang:Math.atan2(dx,dz)}}
const L2W=(lx,lz)=>[lx*F.rx+lz*F.fx,lx*F.rz+lz*F.fz];                      // lx: derecha, lz: hacia fuera (cuesta abajo)
const W2L=(x,z)=>[x*F.rx+z*F.rz,x*F.fx+z*F.fz];
// medidas (m): fachada 5,6 de ancho × 9,6 de alto; cubierta inclinada que entra en la ladera 24 m
const PW=5.6,PH=9.6,PLEN=24,ROOF_BACK=3.2;
function terrainH(x,z){let y=demAt(x,z);const [lx,lz]=W2L(x,z),d=Math.hypot(x,z);
  if(d<500){const w=Math.max(0,1-d/500);y+=(fbm(x*.045,z*.045,5)-.5)*5*w+(fbm(x*.35,z*.35,3)-.5)*.7*w*w;}       // relieve fino real-ista solo cerca
  // explanada y acceso frente a la puerta + ladera que abraza el portal
  const fl=F.y0-.15,inX=Math.abs(lx),front=lz>-.5;
  if(lz>-PLEN-6&&lz<40&&inX<26){const kx=Math.max(0,Math.min(1,(inX-(lz>0?6+lz*.12:PW/2+.6))/7));
    if(front){const ky=Math.max(0,Math.min(1,(lz-26)/14));const t=Math.max(kx,ky);y=fl+(y-fl)*t*t*(3-2*t)+ (1-t)*Math.max(0,(inX-4.2))*.25;}
    else{const roof=F.y0+PH+(ROOF_BACK-PH)*Math.min(1,-lz/PLEN),e=Math.min(1,-lz/9),emb=F.y0+.6+(roof+.4-F.y0-.6)*e*e*(3-2*e);const side=Math.max(0,inX-PW/2);const fall=emb-side*.55;y=Math.max(y,fall);if(inX<PW/2+.3&&-lz<PLEN*.62)y=Math.min(y,roof-.4);}}
  return y}

/* ---------- texturas ---------- */
const TL=new (class{constructor(){this.c={}}get(n,rep=1){if(this.c[n])return this.c[n];const t=new THREE.TextureLoader().load('data/svb/'+n+'.jpg',()=>needs());t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(n.endsWith('_d'))t.encoding=THREE.sRGBEncoding;return this.c[n]=t}})();

/* ---------- escena ---------- */
let camL,ENV=null,R,S,C,sky,sun,hemi,water,needsN=0,raf=0,clock,ov,portal={},doors=[],interior={},capEl,dotsEl;
function needs(){needsN=Math.max(needsN,2);if(!raf&&SV.on)raf=requestAnimationFrame(loop)}
function loop(t){raf=0;if(!SV.on)return;const anim=stepAnim(t);R.render(S,C);if(anim||needsN-->0)raf=requestAnimationFrame(loop)}

function buildTerrain(){const G=LOWEND()?200:330,half=DEM.size/2-60,pos=[],uv=[],idx=[];
  const warp=u=>Math.sign(u)*Math.pow(Math.abs(u),2.35)*half;
  for(let j=0;j<=G;j++)for(let i=0;i<=G;i++){const x=warp(i/G*2-1),z=warp(j/G*2-1);pos.push(x,terrainH(x,z),z);uv.push(x/7,z/7)}
  for(let j=0;j<G;j++)for(let i=0;i<G;i++){const a=j*(G+1)+i,b=a+1,c=a+G+1,d=c+1;idx.push(a,c,b,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.62,metalness:0,normalMap:TL.get('snow_n'),normalScale:new THREE.Vector2(.35,.35)});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{tSnow:{value:TL.get('snow_d')},tRock:{value:TL.get('rock_d')},tScree:{value:TL.get('scree_d')},tRockN:{value:TL.get('rock_n')}});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vW;varying vec3 vWN;uniform sampler2D tSnow,tRock,tScree,tRockN;
      vec3 tri(sampler2D t,vec3 p,vec3 n,float s){vec3 b=pow(abs(n),vec3(4.));b/=b.x+b.y+b.z;return texture2D(t,p.yz/s).rgb*b.x+texture2D(t,p.xz/s).rgb*b.y+texture2D(t,p.xy/s).rgb*b.z;}`)
    .replace('#include <map_fragment>',`
      float dist=length(vW.xz);vec3 n=normalize(vWN);float slope=1.-n.y;
      float nz=texture2D(tScree,vW.xz/420.).r*.6+texture2D(tSnow,vW.xz/90.).r*.4;            // variación a gran escala (texturas reales como ruido)
      vec3 snow=texture2D(tSnow,vW.xz/5.).rgb*mix(.94,1.04,texture2D(tSnow,vW.xz/37.).r);
      snow=mix(snow,snow*vec3(.93,.96,1.04),.6);                                               // nieve fría, sombras azuladas
      vec3 rock=tri(tRock,vW,n,9.)*vec3(.62,.6,.58);
      float strata=.82+.18*sin(vW.y*.55+nz*6.);rock*=strata;                                     // estratos sedimentarios de las montañas tabulares
      vec3 scree=texture2D(tScree,vW.xz/26.).rgb*vec3(.72,.7,.68);
      float rockM=smoothstep(.16,.34,slope+(nz-.5)*.22);
      float snowM=1.-smoothstep(.20,.36,slope+(nz-.5)*.26);snowM=max(snowM,smoothstep(60.,20.,dist)*(1.-smoothstep(.3,.5,slope)));
      snowM*=1.-.45*smoothstep(.62,.8,nz)*smoothstep(150.,900.,dist);                           // zonas barridas por el viento lejos
      snowM=max(snowM,smoothstep(3.,.0,vW.y-.8)*0.);
      vec3 ground=mix(scree,rock,rockM);diffuseColor=vec4(mix(ground,snow,snowM)*diffuse,opacity);
      float sparkle=step(.9975,fract(sin(dot(floor(vW.xz*36.),vec2(12.9898,78.233)))*43758.5453))*snowM*smoothstep(80.,5.,dist);`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=mix(.88,.5,snowM)-sparkle*.45;')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(sparkle*.35);')};
  const t=new THREE.Mesh(g,m);t.receiveShadow=true;t.castShadow=false;S.add(t);
  if(FAR){const G2=LOWEND()?120:200,H2=FAR.size/2,in2=DEM.size/2-250,p2=[],u2=[],i2=[];for(let j=0;j<=G2;j++)for(let i=0;i<=G2;i++){const x=(i/G2*2-1)*H2,z=(j/G2*2-1)*H2;let y=farAt(x,z);if(Math.abs(x)<in2&&Math.abs(z)<in2)y-=40;p2.push(x,y,z);u2.push(x/7,z/7)}
    for(let j=0;j<G2;j++)for(let i=0;i<G2;i++){const a=j*(G2+1)+i,b=a+1,c=a+G2+1,d=c+1;i2.push(a,c,b,b,c,d)}
    const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(p2,3));g2.setAttribute('uv',new THREE.Float32BufferAttribute(u2,2));g2.setIndex(i2);g2.computeVertexNormals();S.add(new THREE.Mesh(g2,m))}}

function buildWater(){const g=new THREE.PlaneGeometry(42000,42000);let w;
  if(THREE.Water){const n=new THREE.TextureLoader().load('data/tex/water_n.jpg',()=>needs());n.wrapS=n.wrapT=THREE.RepeatWrapping;
    w=new THREE.Water(g,{textureWidth:LOWEND()?256:512,textureHeight:LOWEND()?256:512,waterNormals:n,sunDirection:sun.position.clone().normalize(),sunColor:0xffe2c4,waterColor:0x0d222c,distortionScale:1.6,fog:true});}
  else w=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x0d222c,roughness:.15,metalness:.4}));
  w.rotation.x=-Math.PI/2;w.position.y=.35;S.add(w);water=w}

/* portal de hormigón: perfil en cuña (fachada vertical, cubierta inclinada que se mete en la ladera) */
function portalGeo(){const pts=[[0,0],[0,PH],[-PLEN,ROOF_BACK],[-PLEN,0]];const sh=new THREE.Shape();pts.forEach(([z,y],i)=>i?sh.lineTo(z,y):sh.moveTo(z,y));
  const g=new THREE.ExtrudeGeometry(sh,{depth:PW,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1,steps:1});
  g.translate(0,0,-PW/2);g.rotateY(-Math.PI/2);                                           // x local=ancho, z local=hacia fuera
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
    uv.setXY(i,nx>.5?z/3.2:x/3.2+(ny>.5?z*.0:0),ny>.5?z/3.2:y/3.2)}return g}
function concreteMat(){const m=new THREE.MeshStandardMaterial({map:TL.get('concrete_d'),normalMap:TL.get('concrete_n'),roughnessMap:TL.get('concrete_r'),color:0x9ea2a5,roughness:1,normalScale:new THREE.Vector2(.9,.9)});
  m.onBeforeCompile=sh=>{sh.uniforms.tSnow={value:TL.get('snow_d')};sh.uniforms.tC={value:TL.get('concrete_d')};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vWN;uniform sampler2D tSnow,tC;uniform float uY0;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        float streak=texture2D(tC,vec2((vW.x+vW.z)*.37,vW.y*.018)).r;                           // churretes verticales de deshielo
        diffuseColor.rgb*=mix(.78,1.02,streak);diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.3,.5,.2))),diffuseColor.rgb,.12)*vec3(.97,.99,1.02);
        float h=vW.y-${(0).toFixed(1)};diffuseColor.rgb*=mix(.72,1.,smoothstep(0.,1.4,vW.y-YBASE));   // suciedad y humedad en la base
        float top=smoothstep(.55,.8,vWN.y);diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(tSnow,vW.xz/3.).rgb*1.02,top*.92);`
      .replace('YBASE',F.y0.toFixed(2)))
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.55,smoothstep(.55,.8,vWN.y));')};return m}
/* «Perpetual Repercussion» (Dyveke Sanne): triángulos de acero inoxidable muy reflectante, espejos y prismas en lo alto de la fachada y a lo largo de la cubierta */
function artGeo(){const tris=[],add=(a,b,c)=>tris.push(...a,...b,...c);let rnd=7;const r=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647};
  const s=.34;// fachada: banda superior
  for(let y=PH*.42;y<PH-.25;y+=s*.866)for(let x=-PW/2+.18;x<PW/2-.18-s*.5;x+=s/2){const up=Math.round((x+PW)/(s/2))%2===0,dz=.035+r()*.05,j=(r()-.5)*.08;
    const yy=y+(up?0:s*.866),x0=x,x1=x+s,xm=x+s/2,ym=up?y+s*.866:y;
    if(yy>PH-.15||ym>PH-.15)continue;add([x0,up?y:y+s*.866,dz],[x1,up?y:y+s*.866,dz+j],[xm,ym,dz+.02+j])}
  // cubierta: franja central inclinada
  const L=PLEN*.62,steps=Math.floor(L/(s*.866));for(let k=0;k<steps;k++)for(let x=-.9;x<.9-s*.5;x+=s/2){const up=Math.round((x+5)/(s/2)+k)%2===0,t0=k*s*.866/PLEN,t1=(k+1)*s*.866/PLEN;
    const P=(xx,t)=>[xx,PH+(ROOF_BACK-PH)*t+.04+r()*.03,-PLEN*t];const a=P(x,up?t0:t1),b=P(x+s,up?t0:t1),c=P(x+s/2,up?t1:t0);add(a,b,c)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(tris,3));g.computeVertexNormals();return g}
function buildPortal(){const grp=new THREE.Group();grp.position.set(0,F.y0,0);grp.rotation.y=F.ang;S.add(grp);
  const body=new THREE.Mesh(portalGeo(),concreteMat());body.castShadow=body.receiveShadow=true;grp.add(body);
  // hueco de la puerta y hojas de acero
  const metal=new THREE.MeshStandardMaterial({normalMap:TL.get('concrete_n'),color:0x454b51,metalness:.45,roughness:.55,envMapIntensity:.5,normalScale:new THREE.Vector2(.15,.15)});
  const frameM=new THREE.MeshStandardMaterial({color:0x23272b,metalness:.6,roughness:.55});const recess=new THREE.Mesh(new THREE.BoxGeometry(2.66,3.12,.06),frameM);recess.position.set(0,1.56,.03);grp.add(recess);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2.7,3.2,.12),metal);frame.position.set(0,1.6,.06);frame.scale.set(1,1,1);grp.add(frame);
  doors=[];[-1,1].forEach(sg=>{const piv=new THREE.Group();piv.position.set(sg*1.18,0,.075);const d=new THREE.Mesh(new THREE.BoxGeometry(1.16,2.92,.07),metal);d.position.set(-sg*.58,1.46,0);d.castShadow=true;piv.add(d);grp.add(piv);doors.push({piv,sg})});
  frame.material=metal;grp.remove(frame);
  // arte: acero pulido que refleja el cielo
  const ag=artGeo();{const n=ag.attributes.normal;for(let i=0;i<n.count;i+=3){const jx=(hash(i,1)-.5)*.22,jy=(hash(i,2)-.5)*.22;for(let k=0;k<3;k++)n.setXYZ(i+k,n.getX(i+k)+jx,n.getY(i+k)+jy,n.getZ(i+k))}n.needsUpdate=true}
  const art=new THREE.Mesh(ag,new THREE.MeshStandardMaterial({color:0x8d959c,metalness:1,roughness:.3,envMapIntensity:1.0,emissive:0x0b2a2a,emissiveIntensity:.12,side:THREE.DoubleSide}));
  art.castShadow=false;grp.add(art);portal={grp,body,art};
  // banda de luz fría que ilumina el arte (muy sutil)
  // pequeño murete y nieve acumulada junto a la fachada
  const snowM=new THREE.MeshStandardMaterial({map:TL.get('snow_d'),normalMap:TL.get('snow_n'),roughness:.6,color:0xf4f7fb});
}

/* ---------- interior: entrada, túnel, sala transversal, bóveda de semillas y ATLAS Data Core ---------- */
const TUN={len:70,slope:.06,w:4.4,h:4.1};
function bakeColor(g,lights,amb,tint){const p=g.attributes.position,n=g.attributes.normal,col=new Float32Array(p.count*3);const v=new THREE.Vector3(),nn=new THREE.Vector3(),d=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);nn.fromBufferAttribute(n,i);let r=amb[0],gg=amb[1],b=amb[2];
    lights.forEach(L=>{d.copy(L.p).sub(v);const dist=d.length();d.normalize();const lam=Math.max(0,nn.dot(d))*.75+.25;const a=L.i*(Math.abs(nn.dot(d))*.75+.25)/(1+dist*dist*L.k);r+=a*L.c[0];gg+=a*L.c[1];b+=a*L.c[2]});
    col[i*3]=Math.min(1.6,r*tint[0]);col[i*3+1]=Math.min(1.6,gg*tint[1]);col[i*3+2]=Math.min(1.6,b*tint[2])}g.setAttribute('color',new THREE.BufferAttribute(col,3))}
function tubeGeo(prof,len,segZ){const pos=[],uv=[],idx=[],P=prof.length;let acc=[0];for(let i=1;i<P;i++)acc.push(acc[i-1]+Math.hypot(prof[i][0]-prof[i-1][0],prof[i][1]-prof[i-1][1]));
  for(let j=0;j<=segZ;j++){const z=-j*len/segZ;for(let i=0;i<P;i++){pos.push(prof[i][0],prof[i][1],z);uv.push(acc[i]/3,z/3)}}
  for(let j=0;j<segZ;j++)for(let i=0;i<P-1;i++){const a=j*P+i,b=a+1,c=a+P,d=c+1;idx.push(a,b,c,b,d,c)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
function tunnelGeo(len,w,h,segZ){// perfil: suelo plano, hastiales y bóveda de medio punto; anillos cada 1 m
  const prof=[];const r=w/2,wall=h-r;prof.push([-r,0]);for(let k=0;k<=4;k++)prof.push([-r,wall*k/4]);for(let k=1;k<=16;k++){const a=Math.PI-k/16*Math.PI;prof.push([Math.cos(a)*r,wall+Math.sin(a)*r])}for(let k=3;k>=0;k--)prof.push([r,wall*k/4]);prof.push([r,0]);
  const pos=[],uv=[],idx=[],P=prof.length;let acc=[0];for(let i=1;i<P;i++)acc.push(acc[i-1]+Math.hypot(prof[i][0]-prof[i-1][0],prof[i][1]-prof[i-1][1]));
  for(let j=0;j<=segZ;j++){const z=-j*len/segZ;for(let i=0;i<P;i++){const [x,y]=prof[i];const bump=(i>0&&i<P-1)?(fbm(i*.7,j*.9,3)-.5)*.16:0;pos.push(x+Math.sign(x)*bump,y+(y>wall?bump:0),z);uv.push(acc[i]/2.5,z/2.5)}}
  for(let j=0;j<segZ;j++)for(let i=0;i<P-1;i++){const a=j*P+i,b=a+1,c=a+P,d=c+1;idx.push(a,b,c,b,d,c)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
function frostMat(tex){const m=new THREE.MeshStandardMaterial({map:TL.get(tex+'_d'),normalMap:TL.get(tex+'_n'),roughness:.92,vertexColors:true,color:0xd9dde2});
  m.onBeforeCompile=sh=>{sh.uniforms.tSnow={value:TL.get('snow_d')};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;uniform sampler2D tSnow;uniform float uFrost;').replace('#include <map_fragment>',`#include <map_fragment>
      float lum=dot(diffuseColor.rgb,vec3(.33));float fr=smoothstep(.22,.55,lum+texture2D(tSnow,vWp.xy/1.7+vWp.zx/2.3).r*.35)*FROST;          // escarcha en los relieves de la roca
      diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.33)))*vec3(.9,.92,.95)*1.6,vec3(.93,.96,1.),fr);`.replace('FROST',(m.userData.frost||.55).toFixed(2)))};return m}
function buildInterior(){const grp=new THREE.Group();grp.position.set(0,F.y0,0);grp.rotation.y=F.ang;S.add(grp);interior.grp=grp;
  const warm=[1,.93,.82],cold=[.85,.93,1];
  // 1) vestíbulo dentro del portal (hormigón)
  const lob=tubeGeo([[-(PW-.6)/2,0],[-(PW-.6)/2,3.6],[(PW-.6)/2,3.6],[(PW-.6)/2,0]],PLEN-1,12);lob.translate(0,0,-.3);
  const lobL=[];for(let z=-3;z>-PLEN;z-=5)lobL.push({p:new THREE.Vector3(0,3.4,z),i:2.6,k:.08,c:cold});bakeColor(lob,lobL,[.25,.27,.3],[1,1,1]);
  const lm=new THREE.MeshStandardMaterial({map:TL.get('concrete_d'),normalMap:TL.get('concrete_n'),vertexColors:true,side:THREE.DoubleSide,roughness:.95,color:0xcfcfcf});const lobby=new THREE.Mesh(lob,lm);grp.add(lobby);
  // 2) túnel: baja hacia la montaña, gunitado, con bandeja de cables, tubos y luminarias lineales
  const tg=tunnelGeo(TUN.len,TUN.w,TUN.h,TUN.len);const tl=[];for(let z=-3;z>-TUN.len;z-=7)tl.push({p:new THREE.Vector3(0,TUN.h-.35,z),i:3.2,k:.07,c:cold});bakeColor(tg,tl,[.22,.24,.27],[1,1,1]);
  const tun=new THREE.Mesh(tg,frostMat('rock'));tun.material.side=THREE.DoubleSide;tun.material.userData.frost=.5;
  const tunG=new THREE.Group();tunG.position.set(0,0,-PLEN+.5);tunG.rotation.x=-Math.atan(TUN.slope);tunG.add(tun);grp.add(tunG);interior.tun=tunG;
  const fx=new THREE.MeshStandardMaterial({color:0xe9f3ff,emissive:0xdfefff,emissiveIntensity:1.6,roughness:.4});const tray=new THREE.MeshStandardMaterial({color:0x6f757b,metalness:.8,roughness:.45});
  for(let z=-3;z>-TUN.len;z-=7){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,.05,2.2),fx);l.position.set(0,TUN.h-.12,z);tunG.add(l)}
  const tr=new THREE.Mesh(new THREE.BoxGeometry(.38,.08,TUN.len),tray);tr.position.set(-TUN.w/2+.32,2.3,-TUN.len/2);tunG.add(tr);
  [[TUN.w/2-.35,2.9,.09],[TUN.w/2-.6,3.15,.06]].forEach(([x,y,r])=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,TUN.len,10,1,true),tray);c.rotation.x=Math.PI/2;c.position.set(x,y,-TUN.len/2);tunG.add(c)});
  const flm=new THREE.MeshStandardMaterial({map:TL.get('floor_d'),normalMap:TL.get('floor_n'),roughness:.7,color:0xffffff});flm.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.33))),diffuseColor.rgb,.2)*1.55;')};
  // 3) sala transversal al final del túnel, con las tres puertas de las bóvedas
  const endZ=-PLEN+.5-TUN.len,endY=-TUN.len*TUN.slope;interior.endZ=endZ;interior.endY=endY;interior.hallZ=endZ-4.5;
  const hall=new THREE.BoxGeometry(26,5,9,12,3,4);hall.translate(0,2.5,0);const hl=[];for(let x=-10;x<=10;x+=5)hl.push({p:new THREE.Vector3(x,4.6,0),i:3,k:.07,c:cold});bakeColor(hall,hl,[.22,.24,.27],[1,1,1]);
  const hm=frostMat('rock');hm.side=THREE.BackSide;hm.userData.frost=.8;const hallM=new THREE.Mesh(hall,hm);const hallG=new THREE.Group();hallG.position.set(0,endY,endZ-4.5);hallG.add(hallM);grp.add(hallG);interior.hall=hallG;
  for(let x=-10;x<=10;x+=5){const l=new THREE.Mesh(new THREE.BoxGeometry(2.2,.05,.12),fx);l.position.set(x,4.9,0);hallG.add(l)}
  const vdoor=new THREE.MeshStandardMaterial({map:TL.get('metal_d'),normalMap:TL.get('metal_n'),color:0xc5ccd3,metalness:.6,roughness:.55});
  const frostM=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.38,roughness:1,map:TL.get('snow_d')});
  [-8.5,0,8.5].forEach((x,i)=>{const open=i!==1,piv=new THREE.Group();piv.position.set(x-1.3,0,-4.42);const d=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.2,.15),vdoor);d.position.set(1.3,1.6,0);piv.add(d);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.2,.02),frostM);fr.position.set(1.3,1.6,.09);piv.add(fr);if(open)piv.rotation.y=1.35;hallG.add(piv)});
  // 4) bóveda de semillas (27 × 9,5 × 5 m): roca escarchada, estanterías y cajas selladas
  const vault=new THREE.BoxGeometry(9.5,5,27,6,3,14);vault.translate(0,2.5,-13.5);const vl=[];for(let z=-3;z>-27;z-=6)vl.push({p:new THREE.Vector3(0,4.6,z),i:3,k:.07,c:cold});bakeColor(vault,vl,[.2,.22,.25],[1,1,1]);
  const vm=frostMat('rock');vm.side=THREE.BackSide;vm.userData.frost=1;const vG=new THREE.Group();vG.position.set(-8.5,0,-4.5);hallG.add(vG);vG.add(new THREE.Mesh(vault,vm));interior.vault=vG;
  for(let z=-3;z>-27;z-=6){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,.05,2.6),fx);l.position.set(0,4.92,z);vG.add(l)}
  const shelf=new THREE.MeshStandardMaterial({color:0x8a9097,metalness:.7,roughness:.5}),cols=[0x141516,0x1b1c1e,0x232427,0x2b2d30,0x1b2333,0x3a2a20,0x6a6e72,0x8a7350,0x141516,0x9a9fa4,0x1b1c1e,0x7d2a24];const boxG=new THREE.BoxGeometry(.6,.36,.42);
  const nRows=2,perRow=36,levels=5,ib=new THREE.InstancedMesh(boxG,new THREE.MeshStandardMaterial({roughness:.7,metalness:0}),nRows*2*perRow*levels);let k=0;const M=new THREE.Matrix4(),col=new THREE.Color();
  [-3.1,-1.1,1.1,3.1].forEach((x,ri)=>{const rack=new THREE.Mesh(new THREE.BoxGeometry(.5,2.6,24),shelf);rack.position.set(x,1.3,-14);rack.scale.set(1,1,1);rack.material=shelf;
      for(let zz=-2;zz>-26.5;zz-=2.4){const up=new THREE.Mesh(new THREE.BoxGeometry(.05,2.6,.05),shelf);up.position.set(x-.27,1.3,zz);vG.add(up);const u2=up.clone();u2.position.x=x+.27;vG.add(u2)}
      for(let lv=0;lv<5;lv++){const pl=new THREE.Mesh(new THREE.BoxGeometry(.55,.03,24),shelf);pl.position.set(x,.15+lv*.5,-14);vG.add(pl)}
      for(let lv=0;lv<levels;lv++)for(let j=0;j<perRow*.5;j++){if(k>=ib.count)break;const zz=-2.5-j*.66;if(hash(ri*31+lv,j)<.12)continue;M.makeScale(1,.85+hash(lv,j*7)*.3,1).setPosition(x+(hash(j,lv)-.5)*.04,.34+lv*.5,zz);ib.setMatrixAt(k,M);col.setHex(cols[Math.floor(hash(j*3+ri,lv*7)*cols.length)]);col.convertSRGBToLinear();ib.setColorAt(k,col);k++}});
  ib.count=k;vG.add(ib);
  // 5) ATLAS Data Core en la tercera bóveda: racks discretos + un núcleo sobrio
  const cG=new THREE.Group();cG.position.set(8.5,0,-4.5);hallG.add(cG);interior.core=cG;const cv=new THREE.BoxGeometry(9.5,5,27,6,3,14);cv.translate(0,2.5,-13.5);
  bakeColor(cv,[{p:new THREE.Vector3(0,1.4,-14),i:2.2,k:.08,c:[.55,.9,1]},{p:new THREE.Vector3(0,4.6,-4),i:2,k:.08,c:cold},{p:new THREE.Vector3(0,4.6,-24),i:2,k:.08,c:cold}],[.12,.14,.17],[1,1,1]);
  const cm=frostMat('rock');cm.side=THREE.BackSide;cm.userData.frost=.9;cG.add(new THREE.Mesh(cv,cm));
  const rackM=new THREE.MeshStandardMaterial({color:0x14171b,metalness:.5,roughness:.45});const led=new THREE.InstancedMesh(new THREE.BoxGeometry(.03,.012,.005),new THREE.MeshBasicMaterial({color:0x7ff6ff}),400);let li=0;
  [-3.4,3.4].forEach(x=>{for(let z=-4;z>-25;z-=1.25){if(Math.abs(z+14)<3.4)continue;const r=new THREE.Mesh(new THREE.BoxGeometry(.8,2.1,1.1),rackM);r.position.set(x,1.05,z);cG.add(r);
    for(let q=0;q<6&&li<400;q++){M.makeTranslation(x+(x<0?.41:-.41),.4+q*.28,z+(hash(z,q)-.5)*.6);led.setMatrixAt(li++,M)}}});led.count=li;cG.add(led);
  const glass=new THREE.MeshStandardMaterial({color:0x9aa6b1,metalness:.7,roughness:.32});const core=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,3.6,48),glass);core.position.set(0,1.8,-14);cG.add(core);
  const line=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3.4,12),new THREE.MeshBasicMaterial({color:0x8ff7ff}));line.position.set(0,1.8,-14);cG.add(line);interior.coreLine=line;
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.15,1.18,96),new THREE.MeshBasicMaterial({color:0x5ee7ff,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(0,.01,-14);cG.add(ring);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.62,.7,.18,48),rackM);base.position.set(0,.09,-14);cG.add(base);
  // suelos
  [[lobby.position,0]].forEach(()=>0);
  const fl=(w,l,x,y,z,parent)=>{const pg=new THREE.PlaneGeometry(w,l);const uvA=pg.attributes.uv;for(let i=0;i<uvA.count;i++)uvA.setXY(i,uvA.getX(i)*w/3,uvA.getY(i)*l/3);const m=new THREE.Mesh(pg,flm);m.rotation.x=-Math.PI/2;m.position.set(x,y+.01,z);parent.add(m)};
  fl(PW-.6,PLEN-1,0,0,-(PLEN-1)/2-.3,grp);fl(TUN.w-.1,TUN.len,0,0,-TUN.len/2,tunG);fl(26,9,0,0,0,hallG);fl(9.5,27,0,0,-13.5,vG);fl(9.5,27,0,0,-13.5,cG);
  grp.visible=false}

/* ---------- estados y cámara ---------- */
const STATES=[
  {t:'Svalbard',s:'Platåberget · 78°14′ N 15°29′ E · 130 m sobre el mar'},
  {t:'Svalbard Global Seed Vault',s:'La entrada: hormigón y acero, en el permafrost'},
  {t:'El túnel',s:'Más de 100 m dentro de la montaña'},
  {t:'La bóveda',s:'−18 °C · más de 1,2 millones de semillas del mundo'},
  {t:'ATLAS Data Core',s:'Composición de ETFs, empresas, geografía e historia de mercado, preservadas y estructuradas'},
  {t:'ATLAS',s:'Inteligencia global de ETFs y carteras'}];
function L(lx,y,lz){const [x,z]=L2W(lx,lz);return new THREE.Vector3(x,F.y0+y,z)}
function tunnelP(d,y){// punto a d metros dentro del túnel (desde su boca), con su pendiente
  const z=-PLEN+.5-d,yy=-d*TUN.slope;return L(0,y+yy,z)}
function hallP(x,y,z){return L(x,y+interior.endY,interior.hallZ+z)}
function camFor(i){const fd=new THREE.Vector3(F.fx,0,F.fz);switch(i){
  case 0:{const p=L(-210,-72,520);return{p,t:L(0,10,-30),fov:30}}
  case 1:{return{p:L(-9,1.7,21),t:L(0,4.2,-2),fov:40}}
  case 2:{return{p:tunnelP(6,1.7),t:tunnelP(40,1.6),fov:55}}
  case 3:{return{p:hallP(-8.5,1.65,-6),t:hallP(-8.5,1.2,-26),fov:58}}
  case 4:{return{p:hallP(8.5,1.7,-7.5),t:hallP(8.5,1.6,-18.5),fov:50}}
  default:return camFor(4)}}
let anim=null;
function go(i){i=Math.max(0,Math.min(STATES.length-1,i));if(anim)return;if(i===5){finish();return}const from=SV.state,a=camFor(from),b=camFor(i);
  // trayectorias que respetan la arquitectura: exterior→puerta→vestíbulo→túnel→sala→bóveda
  let way=[a.p];if(from<=1&&i>=2){way.push(L(0,1.7,6),L(0,1.7,-2),L(0,1.7,-PLEN+2),tunnelP(2,1.7))}
  if(from<=2&&i>=3){way.push(tunnelP(TUN.len-4,1.7),hallP(0,1.7,1.5),hallP(-8.5,1.7,-3))}
  if(from===3&&i===4){way.push(hallP(-8.5,1.7,-2),hallP(0,1.7,0),hallP(8.5,1.7,-2))}
  if(i<from){way=[a.p,b.p]}else way.push(b.p);
  const curve=new THREE.CatmullRomCurve3(way,false,'centripetal'),dur=i<from?1600:Math.min(6200,900+curve.getLength()*(from===0?1.6:55));
  anim={t0:performance.now(),dur,curve,a,b,from,to:i};if(from<=1&&i>=2)openDoors(true);setInside(i>=2||from>=2);caption(i,true);needs()}
function stepAnim(now){if(!anim)return false;const k=Math.max(0,Math.min(1,(now-anim.t0)/anim.dur)),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  const p=anim.curve.getPoint(e);C.position.copy(p);const ahead=anim.curve.getPoint(Math.min(1,e+.02)),look=new THREE.Vector3().lerpVectors(ahead.add(new THREE.Vector3(0,-.05,0)),anim.b.t,Math.pow(e,2.2));
  if(anim.to<anim.from)look.lerpVectors(anim.a.t,anim.b.t,e);C.lookAt(look);C.fov=anim.a.fov+(anim.b.fov-anim.a.fov)*e;C.updateProjectionMatrix();
  if(doorsAnim)stepDoors(now);if(interior.coreLine)interior.coreLine.material.color.setHSL(.52,.9,.62+.08*Math.sin(now/900));
  if(k>=1){SV.state=anim.to;setInside(SV.state>=2);anim=null;caption(SV.state);return !!doorsAnim}return true}
let doorsAnim=null;function openDoors(o){doorsAnim={t0:performance.now(),o}}
function stepDoors(now){const k=Math.max(0,Math.min(1,(now-doorsAnim.t0)/1400)),e=1-Math.pow(1-k,3);doors.forEach(d=>d.piv.rotation.y=d.sg*(doorsAnim.o?e:1-e)*1.45);if(k>=1)doorsAnim=null}
function setInside(v){if(interior.grp)interior.grp.visible=v||SV.state<=1;if(sky)sky.visible=true;if(water)water.visible=!v;S.fog.density=v?.018:.00005;S.environment=v?null:ENV;S.fog.color.set(v?0x0a0e13:0xc6d2df);hemi.intensity=v?.12:.38;sun.intensity=v?0:3.1;sun.castShadow=!v;R.toneMappingExposure=v?1.25:.52;camL.intensity=v?.9:0}
function caption(i,moving){if(!capEl)return;const s=STATES[i];capEl.innerHTML=`<small>${String(i+1).padStart(2,'0')} / 06</small><b>${s.t}</b><span>${s.s}</span>`;capEl.classList.toggle('mv',!!moving);
  dotsEl.querySelectorAll('i').forEach((d,k)=>d.classList.toggle('on',k===i));ov.querySelector('[data-sv=next]').textContent=i>=4?'Entrar en ATLAS →':'Siguiente →'}

/* ---------- ciclo de vida ---------- */
async function openVault(){if(SV.on)return;SV.on=true;try{closePlace()}catch(_){}
  ov=$('#svv');if(!ov){ov=document.createElement('div');ov.id='svv';document.body.appendChild(ov)}
  ov.innerHTML=`<canvas id="svvC"></canvas><div class="sv-top"><div class="sv-br"><b>ATLAS</b><span>Base de datos · Svalbard</span></div><button data-sv="x" class="sv-skip">Ir al panel ✕</button></div>
    <div class="sv-cap"></div><div class="sv-nav"><div class="sv-dots">${STATES.map(()=>'<i></i>').join('')}</div><button data-sv="prev" aria-label="Anterior">←</button><button data-sv="next" class="sv-next">Siguiente →</button></div>
    <div class="sv-load"><i></i><span>Cargando el relieve real de Svalbard…</span></div><p class="sv-cred">Relieve: Copernicus DEM GLO-30 (ESA) · Texturas: Poly Haven (CC0) · Recreación de ATLAS, no fotografía</p>`;
  ov.hidden=false;document.body.classList.add('sv-open');try{sheetPush()}catch(_){}
  capEl=ov.querySelector('.sv-cap');dotsEl=ov.querySelector('.sv-dots');
  ov.querySelector('[data-sv=x]').onclick=()=>finish();ov.querySelector('[data-sv=next]').onclick=()=>go(SV.state+1);ov.querySelector('[data-sv=prev]').onclick=()=>go(SV.state-1);
  dotsEl.querySelectorAll('i').forEach((d,k)=>d.onclick=()=>go(k));
  try{await libs();await loadDEM()}catch(e){ov.querySelector('.sv-load span').textContent='No se pudo cargar la escena 3D. Comprueba la conexión.';return}
  if(!SV.on)return;init();SV.ready=true;ov.querySelector('.sv-load').remove();SV.state=0;const c=camFor(0);C.position.copy(c.p);C.lookAt(c.t);C.fov=c.fov;C.updateProjectionMatrix();setInside(false);caption(0);needs();
  ov.addEventListener('wheel',onWheel,{passive:true});window.addEventListener('keydown',onKey);let ty=null;ov.addEventListener('touchstart',e=>ty=e.touches[0].clientY,{passive:true});ov.addEventListener('touchend',e=>{if(ty==null)return;const dy=ty-e.changedTouches[0].clientY;if(Math.abs(dy)>50)go(SV.state+(dy>0?1:-1));ty=null},{passive:true})}
let _wt=0;function onWheel(e){const n=performance.now();if(n-_wt<900||anim)return;_wt=n;go(SV.state+(e.deltaY>0?1:-1))}
function onKey(e){if(!SV.on)return;if(e.key==='Escape')finish();if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')go(SV.state+1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(SV.state-1)}
function init(){const cv=$('#svvC');frame();
  R=new THREE.WebGLRenderer({canvas:cv,antialias:!LOWEND(),powerPreference:'high-performance'});R.setPixelRatio(Math.min(devicePixelRatio||1,LOWEND()?1.25:1.75));R.setSize(innerWidth,innerHeight);
  R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=.52;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  S=new THREE.Scene();S.fog=new THREE.FogExp2(0xc6d2df,.00005);C=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,40000);
  // sol de medianoche de primavera: bajo (7°) y desde el NNO, luz cálida rasante y sombras largas y azuladas
  const elev=THREE.MathUtils.degToRad(7),az=THREE.MathUtils.degToRad(338);const sd=new THREE.Vector3(Math.sin(az)*Math.cos(elev),Math.sin(elev),-Math.cos(az)*Math.cos(elev));
  sky=new THREE.Sky();sky.scale.setScalar(30000);const u=sky.material.uniforms;u.turbidity.value=2.2;u.rayleigh.value=2.2;u.mieCoefficient.value=.003;u.mieDirectionalG.value=.86;u.sunPosition.value.copy(sd);S.add(sky);
  sun=new THREE.DirectionalLight(0xffd6ae,3.1);sun.position.copy(sd).multiplyScalar(400);sun.target.position.set(0,F.y0,0);S.add(sun,sun.target);sun.position.y+=F.y0;
  const sc=sun.shadow.camera;sc.left=-70;sc.right=70;sc.top=70;sc.bottom=-70;sc.near=10;sc.far=1200;sun.shadow.mapSize.set(LOWEND()?1024:2048,LOWEND()?1024:2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;sun.castShadow=true;
  camL=new THREE.PointLight(0xdfeeff,0,14,2);C.add(camL);S.add(C);
  hemi=new THREE.HemisphereLight(0x9db7d8,0xe9eef4,.38);S.add(hemi);
  try{const pm=new THREE.PMREMGenerator(R);ENV=pm.fromScene(sky).texture;S.environment=ENV}catch(e){console.warn('env',e)}
  buildTerrain();buildWater();buildPortal();buildInterior();
  addEventListener('resize',onResize)}
function onResize(){if(!R)return;R.setSize(innerWidth,innerHeight);C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();needs()}
function finish(){if(!SV.on)return;SV.on=false;cancelAnimationFrame(raf);raf=0;anim=null;window.removeEventListener('keydown',onKey);removeEventListener('resize',onResize);
  if(ov){ov.classList.add('out');setTimeout(()=>{ov.hidden=true;ov.innerHTML='';ov.classList.remove('out')},450)}document.body.classList.remove('sv-open');
  try{R&&R.dispose();R&&R.forceContextLoss&&R.forceContextLoss()}catch(_){}R=S=C=null;try{sheetPop()}catch(_){}
  try{window.ATLASI&&ATLASI.renderOverview&&ATLASI.renderOverview()}catch(_){}}
window.ATLAS_VAULT={open:openVault,close:finish,go,get state(){return SV.state},get ready(){return !!SV.ready},get busy(){return !!anim}};
})();
