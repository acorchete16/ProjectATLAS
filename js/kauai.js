/* ATLAS · globo. (Sin documentación de usuario a propósito.)
   Kauaʻi, costa de Nā Pali (valle de Kalalau, 22.17 N −159.65 E). Solo se activa con mucho zoom sobre esa zona exacta.
   - Relieve real (Mapbox Terrain DEM) e imagen satélite solo dentro de Kauaʻi y a partir de z11.
   - Capa 3D propia con three.js: carga diferida, no consume nada fuera de cámara (sin repintados si no se ve).
   - Animales modelados por secciones (columna, cuello, cola y patas con cinemática inversa), piel con textura procedural,
     sombra proyectada sobre el terreno local y luz de día coherente con la imagen satélite. */
(function(){
'use strict';
const O={lng:-159.65395,lat:22.16905};                 // valle bajo de Kalalau
const BB=[-159.83,21.84,-159.27,22.26];                 // isla de Kauaʻi
const ZMIN=15.3;
let M=null,THR=null,layer=null,state={sat:false,ter:false,lay:false},card=null;
const inKauai=c=>c.lng>BB[0]&&c.lng<BB[2]&&c.lat>BB[1]&&c.lat<BB[3];
function waitMap(){if(typeof map!=='undefined'&&map&&typeof mapReady!=='undefined'&&mapReady){M=map;M.on('moveend',check);M.on('click',onClick);return}setTimeout(waitMap,1500)}
async function check(){const c=M.getCenter(),z=M.getZoom(),k=inKauai(c);
  if(k&&z>=11){if(typeof MBX!=='undefined'&&MBX){ensureSat();ensureTer(true)}}else if(state.ter&&(!k||z<9.5))ensureTer(false);
  if(k&&z>=ZMIN-1&&!state.lay){state.lay=true;try{await ensureThree();addLayer()}catch(e){state.lay=false}}
  if(layer)M.triggerRepaint()}
function ensureSat(){if(state.sat)return;state.sat=true;try{M.addSource('kx-sat',{type:'raster',url:'mapbox://mapbox.satellite',tileSize:256,bounds:BB});
  const before=['cl-glow','pt-glow','cl','pt'].find(id=>M.getLayer(id));M.addLayer({id:'kx-sat',type:'raster',source:'kx-sat',minzoom:10.5,paint:{'raster-opacity':['interpolate',['linear'],['zoom'],10.5,0,12,1],'raster-emissive-strength':1,'raster-saturation':-.08,'raster-contrast':.06}},before)}catch(e){state.sat=false}}
function ensureTer(on){try{if(on&&!state.ter){if(!M.getSource('kx-dem'))M.addSource('kx-dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512,maxzoom:14});M.setTerrain({source:'kx-dem',exaggeration:1});state.ter=true}
  else if(!on&&state.ter){M.setTerrain(null);state.ter=false}}catch(_){}}
function ensureThree(){if(window.THREE)return Promise.resolve();return loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')}

/* ---------- utilidades ---------- */
function h2(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function vn(x,y){const i=Math.floor(x),j=Math.floor(y),f=x-i,g=y-j,u=f*f*(3-2*f),v=g*g*(3-2*g);return (h2(i,j)*(1-u)+h2(i+1,j)*u)*(1-v)+(h2(i,j+1)*(1-u)+h2(i+1,j+1)*u)*v}
function fbm(x,y){let a=0,f=1,s=.5;for(let k=0;k<5;k++){a+=s*vn(x*f,y*f);f*=2.1;s*=.5}return a}
/* piel: contra-sombreado (lomo oscuro, vientre claro), moteado y escamas finas como relieve */
function skin(c1,c2,c3,stripe){const W=256,H=128,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),im=g.createImageData(W,H),bc=document.createElement('canvas');bc.width=W;bc.height=H;const bg=bc.getContext('2d'),bm=bg.createImageData(W,H);
  const mix=(a,b,t)=>a+(b-a)*t;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,dors=(Math.sin(u*Math.PI*2)+1)/2;      // 1 = lomo
    const n=fbm(u*9,v*18),m=fbm(u*31+5,v*61+3),st=stripe?Math.max(0,Math.sin(v*stripe*Math.PI*2+n*2.2))**6*dors*.55:0;
    const t=Math.min(1,Math.max(0,dors*1.15-.1+(n-.5)*.35));const col=[0,1,2].map(i=>mix(c2[i],c1[i],t)*(1-st*.45)*(.88+m*.24)+(1-t)*.0*c3[i]);
    const o=(y*W+x)*4;im.data[o]=col[0];im.data[o+1]=col[1];im.data[o+2]=col[2];im.data[o+3]=255;
    const sc=vn(u*170,v*340)*.6+vn(u*60,v*120)*.4;bm.data[o]=bm.data[o+1]=bm.data[o+2]=sc*255;bm.data[o+3]=255}
  g.putImageData(im,0,0);bg.putImageData(bm,0,0);const t=new THREE.CanvasTexture(cv),b=new THREE.CanvasTexture(bc);t.encoding=THREE.sRGBEncoding;[t,b].forEach(x=>{x.wrapS=x.wrapT=THREE.RepeatWrapping});return{t,b}}

/* tubo con secciones elípticas a lo largo de una polilínea (se recalcula cada fotograma: pocos vértices) */
const SEG=14;
function Tube(n){const g=new THREE.BufferGeometry(),P=new Float32Array((n*SEG+2)*3),U=new Float32Array((n*SEG+2)*2),I=[];
  for(let j=0;j<n-1;j++)for(let i=0;i<SEG;i++){const a=j*SEG+i,b=j*SEG+(i+1)%SEG,c=a+SEG,d=b+SEG;I.push(a,c,b,b,c,d)}
  const s0=n*SEG,s1=s0+1;for(let i=0;i<SEG;i++){I.push(s0,i,(i+1)%SEG);I.push(s1,(n-1)*SEG+(i+1)%SEG,(n-1)*SEG+i)}
  for(let j=0;j<n;j++)for(let i=0;i<SEG;i++){U[(j*SEG+i)*2]=i/SEG;U[(j*SEG+i)*2+1]=j/(n-1)}
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();return{g,n,P}}
const _t=[0,0,0],_s=[0,0,0],_u=[0,0,0];
function setTube(T,pts,rad,roll){const {n,P}=T;for(let j=0;j<n;j++){const a=pts[Math.max(0,j-1)],b=pts[Math.min(n-1,j+1)];let tx=b[0]-a[0],ty=b[1]-a[1],tz=b[2]-a[2];const tl=Math.hypot(tx,ty,tz)||1;tx/=tl;ty/=tl;tz/=tl;
    // lado = t × arriba(0,1,0); arriba local = lado × t
    let sx=-tz,sy=0,sz=tx;const sl=Math.hypot(sx,sz)||1;sx/=sl;sz/=sl;const ux=sy*tz-sz*ty,uy=sz*tx-sx*tz,uz=sx*ty-sy*tx;const [rw,rh]=rad[j],p=pts[j];
    for(let i=0;i<SEG;i++){const an=i/SEG*Math.PI*2+(roll||0),c=Math.cos(an),s=Math.sin(an),k=(j*SEG+i)*3;
      // el vientre algo más plano y ancho: perfil «de animal», no de cilindro
      const sh=s<0?.86:1;P[k]=p[0]+sx*c*rw+ux*s*rh*sh;P[k+1]=p[1]+sy*c*rw+uy*s*rh*sh;P[k+2]=p[2]+sz*c*rw+uz*s*rh*sh}}
  const s0=n*SEG*3;for(let q=0;q<3;q++){P[s0+q]=pts[0][q]-(pts[1][q]-pts[0][q])*.25;P[s0+3+q]=pts[n-1][q]+(pts[n-1][q]-pts[n-2][q])*.25}
  T.g.attributes.position.needsUpdate=true;T.g.computeVertexNormals();T.g.computeBoundingSphere()}
/* curva suave por puntos de control (Catmull-Rom) con radios interpolados */
function sample(ctrl,n){const pts=[],rad=[];for(let j=0;j<n;j++){const t=j/(n-1)*(ctrl.length-1),i=Math.min(ctrl.length-2,Math.floor(t)),f=t-i;const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];
    const cr=(a,b,c,d)=>.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);pts.push([0,1,2].map(q=>cr(p0[q],p1[q],p2[q],p3[q])));
    const sm=f*f*(3-2*f);rad.push([p1[3]+(p2[3]-p1[3])*sm,p1[4]+(p2[4]-p1[4])*sm])}return{pts,rad}}
function ik(hx,hy,fx,fy,l1,l2,bend){const dx=fx-hx,dy=fy-hy;let d=Math.hypot(dx,dy);d=Math.min(d,l1+l2-.001);const a=Math.atan2(dy,dx),c=Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));const k=a+bend*c;return[hx+Math.cos(k)*l1,hy+Math.sin(k)*l1]}

/* ---------- especies (medidas en metros, anatomía conservadora) ---------- */
const SP={
  sauro:{len:22,speed:.9,stride:3.4,lift:.45,col:[[86,84,72],[146,140,122],[0,0,0]],stripe:0,
    spine:[[-12.5,3.6,0,.12,.12],[-9,4.3,0,.65,.72],[-5.5,5.1,0,1.25,1.4],[-2.8,5.6,0,1.55,1.75],[.2,6.3,0,1.75,1.95],[2.4,6.9,0,1.45,1.6],[3.6,7.7,0,1.05,1.15],[4.9,9.4,0,.7,.76],[6.1,11.2,0,.45,.5],[7.0,12.6,0,.36,.4],[7.6,13.1,0,.38,.36],[8.35,13.0,0,.26,.24],[8.9,12.75,0,.12,.13]],
    neckFrom:6,legs:[{x:1.6,z:.95,y:6.1,l1:2.9,l2:2.8,r:[.82,.62,.5],bend:1,front:1},{x:-3.6,z:1.1,y:5.2,l1:2.7,l2:2.3,r:[1.05,.72,.55],bend:-1}],head:10},
  hadro:{len:9.5,speed:1.15,stride:1.7,lift:.28,col:[[92,74,50],[168,146,108],[0,0,0]],stripe:9,
    spine:[[-5.6,2.05,0,.08,.08],[-4.2,2.35,0,.22,.26],[-2.4,2.75,0,.48,.56],[-.6,2.95,0,.72,.86],[.9,2.75,0,.7,.78],[2.0,2.55,0,.48,.5],[2.75,2.75,0,.27,.3],[3.3,3.05,0,.22,.27],[3.75,3.0,0,.19,.24],[4.25,2.82,0,.12,.17]],
    neckFrom:5,crest:true,legs:[{x:1.55,z:.42,y:2.2,l1:.95,l2:.95,r:[.24,.16,.11],bend:1,front:1},{x:-.6,z:.52,y:2.55,l1:1.25,l2:1.15,r:[.58,.34,.17],bend:-1}],head:8}};

function Dino(kind,x,z,heading,path){const S=SP[kind],grp=new THREE.Group(),sk=skin(...S.col,S.stripe);
  const mat=new THREE.MeshStandardMaterial({map:sk.t,bumpMap:sk.b,bumpScale:.035,roughness:.86,metalness:0});
  const body=Tube(42),parts=[body];const legs=S.legs.flatMap(L=>[1,-1].map(sd=>({...L,sd,T:Tube(10),ph:0})));legs.forEach(l=>parts.push(l.T));
  let crest=null;if(S.crest){crest=Tube(8);parts.push(crest)}
  const meshes=parts.map(p=>{const m=new THREE.Mesh(p.g,mat);m.frustumCulled=false;grp.add(m);return m});
  const shM=new THREE.MeshBasicMaterial({color:0x0b0d08,transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});const sh=new THREE.Group();parts.forEach(p=>{const m=new THREE.Mesh(p.g,shM);m.frustumCulled=false;sh.add(m)});
  const blob=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.scale.set(S.len*.32,S.len*.12,1);
  const D={kind,S,grp,sh,blob,x,z,head:heading,v:0,ph:Math.random()*6.28,look:0,lookT:0,idle:2+Math.random()*4,path,pi:0,gy:0,legs,body,crest,t:Math.random()*100};
  D.update=dt=>{D.t+=dt;// comportamiento: camina despacio entre puntos, se para, gira la cabeza
    const tgt=path[D.pi],dx=tgt[0]-D.x,dz=tgt[1]-D.z,dist=Math.hypot(dx,dz);
    if(D.idle>0){D.idle-=dt;D.v=Math.max(0,D.v-dt*.6);if(Math.random()<dt*.25)D.lookT=(Math.random()-.5)*.9}
    else{const want=Math.atan2(dx,-dz);let d=want-D.head;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;D.head+=Math.max(-.12,Math.min(.12,d))*dt;D.v=Math.min(S.speed,D.v+dt*.4)*(Math.abs(d)>1.2?.4:1);D.lookT=d*.5;
      if(dist<2){D.pi=(D.pi+1)%path.length;if(Math.random()<.55)D.idle=4+Math.random()*7}}
    D.x+=Math.sin(D.head)*D.v*dt;D.z+=-Math.cos(D.head)*D.v*dt;D.look+=(D.lookT-D.look)*Math.min(1,dt*1.2);D.ph+=D.v/S.stride*Math.PI*dt;
    // columna: balanceo de cola, cuello que se mueve con la mirada y respiración
    const sw=Math.sin(D.ph*.5)*.12*Math.min(1,D.v+.2),br=Math.sin(D.t*1.3)*.015,bob=Math.abs(Math.sin(D.ph))*S.lift*.12*D.v/S.speed;
    const ctrl=S.spine.map((p,i)=>{let [x,y,z,rw,rh]=p;const tailK=Math.max(0,(-x-2)/10);z+=Math.sin(D.t*.7+i*.4)*.06*tailK*S.len/10+sw*tailK*S.len/8;
      if(i>=S.neckFrom){const b=S.spine[S.neckFrom-1],rx=x-b[0],rz=z-b[2],a=D.look*(i-S.neckFrom+1)/(S.spine.length-S.neckFrom);x=b[0]+rx*Math.cos(a)-rz*Math.sin(a);z=b[2]+rx*Math.sin(a)+rz*Math.cos(a);
        if(kind==='sauro')y+=Math.sin(D.t*.35)*.35*(i-S.neckFrom)/6;else y+=(D.idle>0?-.35:0)*(i-S.neckFrom)/4*(Math.sin(D.t*.5)+1)/2}
      return[x,y+bob+(i>2&&i<6?br*rh*10:0),z,rw*(1+br),rh*(1+br)]});
    const sp=sample(ctrl,42);setTube(D.body,sp.pts,sp.rad);
    if(D.crest){const h=sp.pts[Math.round(41*.86)],t=sp.pts[Math.round(41*.8)];const c=[[h[0]+.05,h[1]+.18,h[2],.07,.08],[h[0]-.35,h[1]+.45,h[2],.08,.09],[h[0]-.95,h[1]+.72,h[2],.07,.08],[h[0]-1.35,h[1]+.8,h[2],.04,.05]];const cs=sample(c,8);setTube(D.crest,cs.pts,cs.rad)}
    // patas: secuencia lateral de cuadrúpedo (TI 0, DI .25, TD .5, DD .75), pie plantado en apoyo
    legs.forEach((L,i)=>{const off=(L.front?.25:0)+(L.sd<0?.5:0),ph=D.ph+off*Math.PI*2,mv=Math.min(1,D.v/S.speed*1.4);
      const fx=L.x+(-Math.cos(ph))*S.stride*.5*mv,fy=Math.max(0,Math.sin(ph))*S.lift*mv,hy=L.y+bob;const [kx,ky]=ik(L.x,hy,fx,fy+L.r[2]*.6,L.l1,L.l2,L.front?-1:1);
      const z=L.z*L.sd,c=[[L.x,hy+.3,z*.8,L.r[0]*1.15,L.r[0]*1.3],[L.x,hy,z,L.r[0],L.r[0]*1.1],[(L.x+kx)/2,(hy+ky)/2,z,L.r[0]*.8,L.r[0]*.85],[kx,ky,z,L.r[1],L.r[1]],[(kx+fx)/2,(ky+fy)/2+.05,z,L.r[1]*.85,L.r[1]*.85],[fx+.02,fy+L.r[2]*.6,z,L.r[2],L.r[2]],[fx+.12,fy+.04,z,L.r[2]*1.15,L.r[2]*.55]];
      const s=sample(c,10);setTube(L.T,s.pts,s.rad)});
    grp.position.set(D.x,D.gy,D.z);grp.rotation.y=-D.head+Math.PI/2;
    // sombra plana proyectada según el sol sobre el suelo local
    sh.position.copy(grp.position);sh.rotation.copy(grp.rotation);blob.position.set(D.x,D.gy+.05,D.z);blob.rotation.z=-D.head;};
  return D}

function addLayer(){if(layer)return;const isMbx=typeof MBX!=='undefined'&&MBX;let R,S,C,dinos=[],trees=null,last=performance.now(),lastM=null,elevT=0,O_alt=0,sunDir;
  layer={id:'kx3d',type:'custom',renderingMode:'3d',
    onAdd(m,gl){R=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});R.autoClear=false;R.outputEncoding=THREE.sRGBEncoding;
      S=new THREE.Scene();C=new THREE.Camera();
      sunDir=new THREE.Vector3(-.45,.78,.42).normalize();                                     // sol de tarde, desde el suroeste: como la imagen satélite
      const sun=new THREE.DirectionalLight(0xfff1dc,1.55);sun.position.copy(sunDir);S.add(sun);S.add(new THREE.HemisphereLight(0xbcd3ee,0x3d4a2a,.55));
      // ejemplares: un saurópodo entre los árboles y dos hadrosaurios que cruzan despacio
      dinos=[Dino('sauro',-18,-6,.9,[[-14,-4],[-8,-14],[-20,-12],[-24,-2]]),Dino('hadro',22,12,-2.2,[[14,20],[6,10],[16,2],[30,8]]),Dino('hadro',27,16,-2.0,[[18,24],[9,14],[20,6],[34,12]])];
      dinos[2].ph+=1.7;dinos.forEach(d=>{S.add(d.grp);S.add(d.blob);d.sh.renderOrder=-1});
      // sombras proyectadas (matriz de proyección plana por especie)
      dinos.forEach(d=>{const L=sunDir,mat=new THREE.Matrix4().set(1,-L.x/L.y,0,0, 0,0,0,.04, 0,-L.z/L.y,1,0, 0,0,0,1);d.sh.children.forEach(c=>{c.matrixAutoUpdate=false});d.shMat=mat;S.add(d.sh);d.sh.matrixAutoUpdate=false});
      // árboles (copas irregulares) para ocultar parcialmente a los animales
      const tg=new THREE.SphereGeometry(1,28,18);{const p=tg.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=.62+.55*fbm(x*2.3+3,y*2.3+z*1.9)+.12*vn(x*7+1,z*7+y*5);p.setXYZ(i,x*n,y*n*.78,z*n)}tg.computeVertexNormals()}
      const leaf=(()=>{const W=128,cv=document.createElement('canvas');cv.width=cv.height=W;const g=cv.getContext('2d'),im=g.createImageData(W,W);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const v=vn(x*.35,y*.35)*.55+vn(x*.11+7,y*.11)*.45,o=(y*W+x)*4;im.data[o]=im.data[o+1]=im.data[o+2]=v*255;im.data[o+3]=255}g.putImageData(im,0,0);const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,3);return t})();
      const tm=new THREE.MeshLambertMaterial({color:0xffffff});tm.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=.75+.5*texture2D(leafT,vUv2*vec2(5.,3.)).r;').replace('void main','uniform sampler2D leafT;varying vec2 vUv2;\nvoid main');sh.vertexShader=sh.vertexShader.replace('void main','varying vec2 vUv2;\nvoid main').replace('#include <begin_vertex>','#include <begin_vertex>\n vUv2=uv;');sh.uniforms.leafT={value:leaf}};const N=34;trees=new THREE.InstancedMesh(tg,tm,N*3);const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.4,1,7),new THREE.MeshLambertMaterial({color:new THREE.Color(0x3a3026).convertSRGBToLinear()}),N);
      const mm=new THREE.Matrix4(),q=new THREE.Quaternion(),col=new THREE.Color();trees.userData.pos=[];let k=0;
      for(let i=0;i<N;i++){const cl=i<16?[-17,-8]:[24,26],r=i<16?17:15,a=h2(i,1)*6.28,d=Math.sqrt(h2(i,2))*r,x=cl[0]+Math.cos(a)*d,z=cl[1]+Math.sin(a)*d,h=6.5+h2(i,3)*5,s=3.2+h2(i,4)*2.4;
        trees.userData.pos.push([x,z,h,s]);[[0,h,1],[1.6,h-1.6,.8],[1.3,h-2.6,.7]].forEach(([o,y,sc],kk)=>{q.setFromEuler(new THREE.Euler(0,h2(i,5+kk)*6,0));mm.compose(new THREE.Vector3(x+o*Math.cos(a),y,z+o*Math.sin(a)),q,new THREE.Vector3(s*sc,s*sc*.95,s*sc));trees.setMatrixAt(k,mm);
          col.setRGB(.13+h2(i*3+kk,6)*.06,.22+h2(i*3+kk,7)*.08,.09+h2(i,8)*.04).convertSRGBToLinear();trees.setColorAt(k,col);k++});
        mm.compose(new THREE.Vector3(x,h/2,z),new THREE.Quaternion(),new THREE.Vector3(1,h,1));trunks.setMatrixAt(i,mm)}
      trees.frustumCulled=trunks.frustumCulled=false;S.add(trees,trunks);trees.userData.trunks=trunks;layer.trees=trees;
      layer.dinos=dinos;layer.S=S;window.__kx=layer},
    render(gl,a,b,c){const z=M.getZoom();if(z<ZMIN||!inKauai(M.getCenter()))return;
      const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;
      if(now-elevT>700){elevT=now;try{const e0=M.queryTerrainElevation?M.queryTerrainElevation([O.lng,O.lat]):null;O_alt=e0||0;
        dinos.forEach(d=>{const ll=toLL(d.x,d.z),e=M.queryTerrainElevation?M.queryTerrainElevation(ll):null;d.gy=e!=null&&e0!=null?e-e0:0});if(e0!=null&&!layer.treesPlaced)placeTrees(layer.trees,e0)}catch(_){}}
      dinos.forEach(d=>{d.update(dt);const g=d.grp;g.updateMatrix();d.sh.matrix.multiplyMatrices(new THREE.Matrix4().makeTranslation(0,d.gy,0),d.shMat).multiply(new THREE.Matrix4().makeTranslation(0,-d.gy,0)).multiply(g.matrix);d.sh.children.forEach(ch=>ch.matrix.identity())});
      let P;if(isMbx){const mc=mapboxgl.MercatorCoordinate.fromLngLat([O.lng,O.lat],O_alt),s=mc.meterInMercatorCoordinateUnits();
          const Mm=a&&a.length===16?a:(Array.isArray(a)||a instanceof Float32Array||a instanceof Float64Array?a:null);
          const base=(c&&b&&b.name==='globe'&&c.length===16)?c:Mm;if(!base)return;
          P=new THREE.Matrix4().fromArray(base).multiply(new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z).scale(new THREE.Vector3(s,-s,s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)))}
      else{const mm=M.transform.getMatrixForModel([O.lng,O.lat],O_alt),pd=a.defaultProjectionData||a;P=new THREE.Matrix4().fromArray(pd.mainMatrix||a.modelViewProjectionMatrix).multiply(new THREE.Matrix4().fromArray(mm))}
      C.projectionMatrix=P;C.projectionMatrixInverse.copy(P).invert();lastM=P;layer.P=P;
      R.resetState();R.render(S,C);M.triggerRepaint()}};
  function placeTrees(tr,e0){const mm=new THREE.Matrix4(),q=new THREE.Quaternion(),tk=tr.userData.trunks;let k=0;tr.userData.pos.forEach(([x,z,h,s],i)=>{const e=M.queryTerrainElevation(toLL(x,z));const gy=e!=null?e-e0:0,a=h2(i,1)*6.28;
      [[0,h,1],[1.6,h-1.6,.8],[1.3,h-2.6,.7]].forEach(([o,y,sc],kk)=>{q.setFromEuler(new THREE.Euler(0,h2(i,5+kk)*6,0));mm.compose(new THREE.Vector3(x+o*Math.cos(a),gy+y,z+o*Math.sin(a)),q,new THREE.Vector3(s*sc,s*sc*.95,s*sc));tr.setMatrixAt(k++,mm)});
      mm.compose(new THREE.Vector3(x,gy+h/2,z),new THREE.Quaternion(),new THREE.Vector3(1,h,1));tk.setMatrixAt(i,mm)});tr.instanceMatrix.needsUpdate=tk.instanceMatrix.needsUpdate=true;layer.treesPlaced=true}
  function toLL(x,z){const k=111320;return[O.lng+x/(k*Math.cos(O.lat*Math.PI/180)),O.lat-z/110574]}
  M.addLayer(layer)}

/* ---------- interacción: tocar a un animal abre una ficha mínima ---------- */
function onClick(e){if(!layer||!layer.P||M.getZoom()<ZMIN)return;const cv=M.getCanvas(),w=cv.clientWidth,h=cv.clientHeight;let hit=null;
  layer.dinos.forEach(d=>{const p=new THREE.Vector3(d.x,d.gy+d.S.len*.22,d.z).applyMatrix4(layer.P);if(p.z>1)return;const sx=(p.x+1)/2*w,sy=(1-p.y)/2*h,top=new THREE.Vector3(d.x,d.gy+d.S.len*.55,d.z).applyMatrix4(layer.P),r=Math.max(16,Math.abs((1-top.y)/2*h-sy)*1.3);
    if(Math.hypot(e.point.x-sx,e.point.y-sy)<r)hit=d});
  if(!hit)return;e.preventDefault&&e.preventDefault();showCard(e.point.x,e.point.y)}
function showCard(x,y){if(card)card.remove();card=document.createElement('div');card.className='kx-card';
  card.innerHTML=`<p class="kx-h">ANOMALY DETECTED</p><dl><div><dt>Biological classification</dt><dd>██████</dd></div><div><dt>Confidence</dt><dd>99.7%</dd></div></dl><p class="kx-f">Some data is better left unexplained.</p>`;
  document.body.appendChild(card);const r=card.getBoundingClientRect();card.style.left=Math.min(innerWidth-r.width-12,Math.max(12,x+14))+'px';card.style.top=Math.min(innerHeight-r.height-12,Math.max(12,y-r.height-10))+'px';
  const off=ev=>{if(card&&!card.contains(ev.target)){card.remove();card=null;document.removeEventListener('pointerdown',off,true)}};setTimeout(()=>document.addEventListener('pointerdown',off,true),50);
  M.once('movestart',()=>{if(card){card.remove();card=null}})}
waitMap();
})();
