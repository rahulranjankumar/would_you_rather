/* =====================================================================
   CORE — renderer, studio env, shared helpers, fur v2, real eyes, SDF mesher
   ===================================================================== */
const T = THREE;
const P = new URLSearchParams(location.search);
/* deterministic test mode: every Math.random() call becomes a seeded PRNG (mulberry32) */
if (P.has('t')) { let s = (+P.get('seed')||1337)>>>0; Math.random = function(){ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color(0x000000);
const camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.layers.enable(1);

/* ---------- studio environment for reflections ---------- */
(function makeEnv(){
  const env = new T.Scene();
  env.add(new T.Mesh(new T.BoxGeometry(30,30,30), new T.MeshBasicMaterial({color:0x07080b, side:T.BackSide})));
  const panel = (w,h,c,i,pos) => {
    const m = new T.Mesh(new T.PlaneGeometry(w,h), new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(i), side:T.DoubleSide}));
    m.position.set(...pos); m.lookAt(0,0,0); env.add(m);
  };
  panel(10,4,0xffffff,5,[0,12,4]);
  panel(5,8,0xfff0dc,4,[-11,4,8]);
  panel(4,8,0x58b8ff,4,[-10,3,-8]);
  panel(4,8,0xff8a3a,4,[10,3,-8]);
  panel(14,2,0xffffff,1.2,[0,2,14]);
  const pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
})();

/* ---------- small helpers ---------- */
const rnd = (a,b)=>a+Math.random()*(b-a);
const sstep = (a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
function stdMat(c, r=0.5, m=0, extra={}){ return new T.MeshStandardMaterial(Object.assign({color:c, roughness:r, metalness:m}, extra)); }
function phys(o){ return new T.MeshPhysicalMaterial(o); }
function sph(r, mat, seg=48){ return new T.Mesh(new T.SphereGeometry(r, seg, Math.round(seg*0.75)), mat); }
function at(o,x,y,z){ o.position.set(x,y,z); return o; }
function tubeArc(points, r, mat){
  const c = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return new T.Mesh(new T.TubeGeometry(c, 24, r, 8, false), mat);
}
function taperTube(points, rf, radial=28, seg=64){
  const c = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const g = new T.TubeGeometry(c, seg, 1, radial, false);
  const p = g.attributes.position, v = new T.Vector3(), ctr = new T.Vector3();
  for (let i=0;i<=seg;i++){
    const u=i/seg; c.getPointAt(u, ctr);
    const cap = u>0.88 ? Math.sqrt(Math.max(0,1-((u-0.88)/0.12)**2)) : (u<0.06 ? Math.sqrt(Math.max(0.05,1-((0.06-u)/0.06)**2)) : 1);
    const r=rf(u)*cap;
    for (let j=0;j<=radial;j++){ const k=i*(radial+1)+j; v.fromBufferAttribute(p,k).sub(ctr).multiplyScalar(r).add(ctr); p.setXYZ(k,v.x,v.y,v.z); }
  }
  g.computeVertexNormals(); return g;
}
function ellipsoidGeo(r,sx,sy,sz,seg=64){ const g=new T.SphereGeometry(r,seg,Math.round(seg*0.75)); g.scale(sx,sy,sz); g.computeVertexNormals(); return g; }
function colorize(geo, fn){
  const p=geo.attributes.position, n=geo.attributes.normal, c=new Float32Array(p.count*3), col=new T.Color();
  const v=new T.Vector3(), nn=new T.Vector3();
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); nn.fromBufferAttribute(n,i); col.setRGB(1,1,1); fn(v,nn,col,i); col.convertSRGBToLinear(); c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b; }
  geo.setAttribute('color', new T.BufferAttribute(c,3)); return geo;
}
// merge indexed/non-indexed geometries (position, normal, uv, color, flen)
function mergeGeos(list){
  let vc=0, ic=0;
  for (const g of list){ const n=g.attributes.position.count; vc+=n; ic+= g.index? g.index.count : n; }
  const pos=new Float32Array(vc*3), nor=new Float32Array(vc*3), uv=new Float32Array(vc*2), col=new Float32Array(vc*3).fill(1), fl=new Float32Array(vc).fill(1), idx=new Uint32Array(ic);
  let vo=0, io=0;
  for (const g of list){
    const n=g.attributes.position.count;
    pos.set(g.attributes.position.array, vo*3); nor.set(g.attributes.normal.array, vo*3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo*2);
    if (g.attributes.color) col.set(g.attributes.color.array, vo*3);
    if (g.attributes.flen) fl.set(g.attributes.flen.array, vo);
    if (g.index){ const a=g.index.array; for (let i=0;i<a.length;i++) idx[io+i]=a[i]+vo; io+=a.length; }
    else { for (let i=0;i<n;i++) idx[io+i]=vo+i; io+=n; }
    vo+=n;
  }
  const m=new T.BufferGeometry();
  m.setAttribute('position',new T.BufferAttribute(pos,3)); m.setAttribute('normal',new T.BufferAttribute(nor,3));
  m.setAttribute('uv',new T.BufferAttribute(uv,2)); m.setAttribute('color',new T.BufferAttribute(col,3));
  m.setAttribute('flen',new T.BufferAttribute(fl,1)); m.setIndex(new T.BufferAttribute(idx,1));
  return m;
}
function radialTex(stops, size=128){
  const cv=document.createElement('canvas'); cv.width=cv.height=size; const g=cv.getContext('2d');
  const gr=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); stops.forEach(([o,c])=>gr.addColorStop(o,c));
  g.fillStyle=gr; g.fillRect(0,0,size,size); const t=new T.CanvasTexture(cv); t.encoding=T.sRGBEncoding; return t;
}
const BLUSH = radialTex([[0,'rgba(255,92,120,.95)'],[0.55,'rgba(255,110,135,.45)'],[1,'rgba(255,120,140,0)']]);
function blush(r){ return new T.Mesh(new T.CircleGeometry(r,24), new T.MeshBasicMaterial({map:BLUSH, transparent:true, depthWrite:false, toneMapped:false})); }
function shadowBlob(w, d, o=0.75){
  const m=new T.Mesh(new T.PlaneGeometry(w,d), new T.MeshBasicMaterial({map:radialTex([[0,`rgba(0,0,0,${o})`],[1,'rgba(0,0,0,0)']]), transparent:true, depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.y=0.004; m.renderOrder=1; return m;
}

/* =====================================================================
   FUR v2 — strand-cell shell texturing (tapered strands, soft alpha-to-coverage)
   ===================================================================== */
const furTime = { value: 0 };
/* per-character fur uniforms (secondary motion): uLag = inertial strand lag, uPoof = fright puff */
const mkFurU = () => ({ uLag:{value:new THREE.Vector3()}, uPoof:{value:0}, uSoot:{value:0}, uFrizz:{value:0} });
let FUR_U = mkFurU();
function furBegin(){ FUR_U = mkFurU(); return FUR_U; }
const STRANDS = (() => {
  const S=256, h=new Float32Array(S*S), cv=new Float32Array(S*S);
  for (let k=0;k<8000;k++){
    const cx=Math.random()*S, cy=Math.random()*S, r=rnd(1.3,2.4), H=Math.random()<0.18?rnd(0.8,1.0):rnd(0.3,0.68), cc=Math.random();
    for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++){
      const px=Math.floor(cx)+dx, py=Math.floor(cy)+dy;
      const d=Math.hypot(px+0.5-cx, py+0.5-cy)/r; if (d>=1) continue;
      const x=(px+S)%S, y=(py+S)%S, i=y*S+x, v=H*(1-d);
      if (v>h[i]){ h[i]=v; cv[i]=cc; }
    }
  }
  const d=new Uint8Array(S*S*4);
  for (let i=0;i<S*S;i++){ d[i*4]=h[i]*255; d[i*4+1]=cv[i]*255; d[i*4+2]=0; d[i*4+3]=255; }
  const t=new T.DataTexture(d,S,S,T.RGBAFormat); t.wrapS=t.wrapT=T.RepeatWrapping;
  t.magFilter=T.LinearFilter; t.minFilter=T.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=4; t.needsUpdate=true;
  return t;
})();
/* opts: len, shells, density[u,v], grav, curl, rim(hex), rimK */
function furMesh(geo, o){
  const g = new T.Group();
  if (!geo.attributes.flen){ geo.setAttribute('flen', new T.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1),1)); }
  const N = o.shells || 24; const FU = FUR_U;
  const tex = STRANDS.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1,Math.round(o.density[0]*0.32)), Math.max(1,Math.round(o.density[1]*0.32)));
  const skin = new T.Mesh(geo, stdMat(0xffffff, 1, 0, {vertexColors:true})); skin.material.color.setScalar(0.38); g.add(skin);
  const rim = new T.Color(o.rim ?? 0xfff2e0);
  for (let i=1;i<=N;i++){
    const t=i/N;
    const m=stdMat(0xffffff, 0.9, 0, {vertexColors:true, alphaMap:tex, alphaToCoverage:true});
    m.color.setScalar(0.38 + 0.62*Math.pow(t,0.6));
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uLag:FU.uLag, uPoof:FU.uPoof, uSoot:FU.uSoot, uFrizz:FU.uFrizz, uOff:{value:t*o.len}, uT:{value:t}, uGrav:{value:o.grav||0}, uCurl:{value:o.curl||0}, uTime:furTime, uRim:{value:rim}, uRimK:{value:o.rimK??0.35} });
      s.vertexShader = 'uniform float uOff,uT,uGrav,uCurl,uTime,uPoof,uFrizz;\nuniform vec3 uLag;\nattribute float flen;\nvarying float vFl;\n' + s.vertexShader.replace('#include <begin_vertex>',
        `vFl = flen;
         vec3 transformed = position + normal*uOff*(1.0+uPoof+0.55*uFrizz)*flen;
         transformed -= uLag * uT*uT * flen;
         vec3 cp = position*7.0;
         vec3 cl = vec3(sin(cp.y*1.3+cp.z), sin(cp.z*1.1+cp.x*1.7), sin(cp.x*0.9+cp.y*1.2));
         transformed += cl * (uCurl + 0.07*uFrizz) * uT*uT * flen;
         transformed.y -= uGrav * uT*uT * flen;
         transformed.x += sin(uTime*1.6 + position.y*5.0 + position.z*3.0) * 0.004 * uT*uT * flen;`);
      s.fragmentShader = 'uniform float uT, uSoot;\nuniform vec3 uRim;\nuniform float uRimK;\nvarying float vFl;\n' + s.fragmentShader
        .replace('#include <alphamap_fragment>',
          `vec4 sTex = texture2D(alphaMap, vUv);
           if (vFl < 0.12) discard;
           float a = smoothstep(uT-0.045, uT+0.02, sTex.r);
           if (a < 0.03) discard;
           diffuseColor.a = a;
           diffuseColor.rgb *= 0.88 + 0.24*sTex.g;
           diffuseColor.rgb *= mix(1.0, 0.07 + 0.16*sTex.g, uSoot);`)
        .replace('#include <dithering_fragment>',
          `#include <dithering_fragment>
           float fr = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0))), 2.5);
           gl_FragColor.rgb += fr * uRimK * uRim * (0.4 + 0.6*uT) * (1.0 - 0.85*uSoot);`);
    };
    m.customProgramCacheKey = () => 'fur2';
    const sh = new T.Mesh(geo, m); sh.renderOrder = 2 + i;
    if (i % 2) { sh.layers.set(1); }   // odd shells skipped in reflection / low-quality mode
    g.add(sh);
  }
  return g;
}
const furOf=(fn,opts)=>g=>{ colorize(g,fn); return furMesh(g,opts); };

/* =====================================================================
   REAL EYES — eyeball with iris/pupil/sclera that rotates in its socket,
   fixed catch-lights (like a real wet eye), blink by lid-squash
   ===================================================================== */
const IRIS = (() => {
  const W=256, H=128, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d');
  for (let y=0;y<H;y++){
    const ang = y/H*180;
    for (let x=0;x<W;x+=2){
      let c;
      if (ang<26) c=[5,4,4];
      else if (ang<64){ const s=0.5+0.5*Math.sin(x*0.45+Math.sin(x*0.13)*3); const k=(ang-26)/38;
        c=[26+26*s*(1-k), 16+14*s*(1-k), 10+8*s]; if (ang>58) c=c.map(v=>v*0.4); }
      else c=[236,232,228];
      g.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; g.fillRect(x,y,2,1);
    }
  }
  const t=new T.CanvasTexture(cv); t.encoding=T.sRGBEncoding; return t;
})();
const eyeBallMat = phys({map:IRIS, roughness:0.12, clearcoat:1, clearcoatRoughness:0.02, envMapIntensity:1.4});
const corneaMat = phys({color:0xffffff, roughness:0.0, transparent:true, opacity:0.12, clearcoat:1, envMapIntensity:3, depthWrite:false});
const glintMat = new T.MeshBasicMaterial({color:0xffffff, toneMapped:false});
const ALL_EYES = [];
function realEye(r){
  const socket = new T.Group();
  const ballG = new T.Group(); socket.add(ballG);
  const g = new T.SphereGeometry(r, 40, 30); g.rotateX(Math.PI/2);
  ballG.add(new T.Mesh(g, eyeBallMat));
  const cor = sph(r*0.66, corneaMat, 24); cor.position.z = r*0.5; ballG.add(cor);
  socket.add(at(sph(r*0.2, glintMat, 12), -r*0.32, r*0.38, r*0.9));
  socket.add(at(sph(r*0.08, glintMat, 8), r*0.36, -r*0.3, r*0.93));
  socket.userData = { ball: ballG, r, blink: 0, sacc: new T.Vector3(), nextSacc: 0 };
  ALL_EYES.push(socket);
  return socket;
}

/* =====================================================================
   SDF + SURFACE NETS mesher (seamless merged shapes)
   ===================================================================== */
const SDF = {
  smin(a,b,k){ const h=Math.max(k-Math.abs(a-b),0)/k; return Math.min(a,b)-h*h*k*0.25; },
  ell(px,py,pz, cx,cy,cz, rx,ry,rz){ const x=(px-cx),y=(py-cy),z=(pz-cz);
    const k0=Math.hypot(x/rx,y/ry,z/rz), k1=Math.hypot(x/(rx*rx),y/(ry*ry),z/(rz*rz)); return k0*(k0-1)/Math.max(k1,1e-6); },
  cap(px,py,pz, a,b, ra,rb){ const pax=px-a[0],pay=py-a[1],paz=pz-a[2], bax=b[0]-a[0],bay=b[1]-a[1],baz=b[2]-a[2];
    const h=Math.min(1,Math.max(0,(pax*bax+pay*bay+paz*baz)/(bax*bax+bay*bay+baz*baz)));
    return Math.hypot(pax-bax*h,pay-bay*h,paz-baz*h)-(ra+(rb-ra)*h); }
};
function surfaceNets(f, mn, mx, cs){
  const nx=Math.ceil((mx[0]-mn[0])/cs)+1, ny=Math.ceil((mx[1]-mn[1])/cs)+1, nz=Math.ceil((mx[2]-mn[2])/cs)+1;
  const V=new Float32Array(nx*ny*nz), I=(i,j,k)=>i+nx*(j+ny*k);
  for (let k=0;k<nz;k++) for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) V[I(i,j,k)]=f(mn[0]+i*cs, mn[1]+j*cs, mn[2]+k*cs);
  const cx=nx-1, cy=ny-1, C=(i,j,k)=>i+cx*(j+cy*k);
  const vid=new Int32Array(cx*cy*(nz-1)).fill(-1), pos=[];
  const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const co=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const val=new Float32Array(8);
  for (let k=0;k<nz-1;k++) for (let j=0;j<cy;j++) for (let i=0;i<cx;i++){
    let neg=0; for (let c=0;c<8;c++){ val[c]=V[I(i+co[c][0],j+co[c][1],k+co[c][2])]; if (val[c]<0) neg++; }
    if (neg===0||neg===8) continue;
    let sx=0,sy=0,sz=0,n=0;
    for (const [a,b] of E){ if ((val[a]<0)!==(val[b]<0)){ const t=val[a]/(val[a]-val[b]);
      sx+=co[a][0]+(co[b][0]-co[a][0])*t; sy+=co[a][1]+(co[b][1]-co[a][1])*t; sz+=co[a][2]+(co[b][2]-co[a][2])*t; n++; } }
    vid[C(i,j,k)]=pos.length/3; pos.push(mn[0]+(i+sx/n)*cs, mn[1]+(j+sy/n)*cs, mn[2]+(k+sz/n)*cs);
  }
  const idx=[];
  const quad=(a,b,c,d)=>{ if (a<0||b<0||c<0||d<0) return; idx.push(a,b,c, a,c,d); };
  for (let k=1;k<nz-1;k++) for (let j=1;j<cy;j++) for (let i=0;i<cx;i++){ // x edges
    const a=V[I(i,j,k)], b=V[I(i+1,j,k)]; if ((a<0)===(b<0)) continue;
    quad(vid[C(i,j-1,k-1)],vid[C(i,j,k-1)],vid[C(i,j,k)],vid[C(i,j-1,k)]); }
  for (let k=1;k<nz-1;k++) for (let j=0;j<cy;j++) for (let i=1;i<cx;i++){ // y edges
    const a=V[I(i,j,k)], b=V[I(i,j+1,k)]; if ((a<0)===(b<0)) continue;
    quad(vid[C(i-1,j,k-1)],vid[C(i,j,k-1)],vid[C(i,j,k)],vid[C(i-1,j,k)]); }
  for (let k=0;k<nz-1;k++) for (let j=1;j<cy;j++) for (let i=1;i<cx;i++){ // z edges
    const a=V[I(i,j,k)], b=V[I(i,j,k+1)]; if ((a<0)===(b<0)) continue;
    quad(vid[C(i-1,j-1,k)],vid[C(i,j-1,k)],vid[C(i,j,k)],vid[C(i-1,j,k)]); }
  // normals from SDF gradient + fix winding per triangle
  const nv=pos.length/3, nor=new Float32Array(nv*3), e=cs*0.5;
  for (let v=0;v<nv;v++){ const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];
    let gx=f(x+e,y,z)-f(x-e,y,z), gy=f(x,y+e,z)-f(x,y-e,z), gz=f(x,y,z+e)-f(x,y,z-e); const l=Math.hypot(gx,gy,gz)||1;
    nor[v*3]=gx/l; nor[v*3+1]=gy/l; nor[v*3+2]=gz/l; }
  for (let t=0;t<idx.length;t+=3){
    const a=idx[t],b=idx[t+1],c=idx[t+2];
    const ux=pos[b*3]-pos[a*3],uy=pos[b*3+1]-pos[a*3+1],uz=pos[b*3+2]-pos[a*3+2];
    const wx=pos[c*3]-pos[a*3],wy=pos[c*3+1]-pos[a*3+1],wz=pos[c*3+2]-pos[a*3+2];
    const fx=uy*wz-uz*wy, fy=uz*wx-ux*wz, fz=ux*wy-uy*wx;
    if (fx*nor[a*3]+fy*nor[a*3+1]+fz*nor[a*3+2] < 0){ idx[t+1]=c; idx[t+2]=b; }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos),3));
  g.setAttribute('normal', new T.BufferAttribute(nor,3));
  g.setIndex(idx);
  return g;
}

/* ---------- rig helpers: root(shoulder/hip) → mid(elbow/knee) → end(hand/foot) ---------- */
function seg(len,r0,r1,rad=36){
  const pts=[],N=10;
  for(let i=0;i<=N;i++){const a=Math.PI-i/N*Math.PI/2; pts.push(new T.Vector2(Math.max(1e-4,r1*Math.sin(a)), -len + r1*Math.cos(a)));}
  for(let i=1;i<=N;i++){const a=Math.PI/2-i/N*Math.PI/2; pts.push(new T.Vector2(Math.max(1e-4,r0*Math.sin(a)), r0*Math.cos(a)));}
  const g=new T.LatheGeometry(pts,rad); g.computeVertexNormals(); return g;
}
function limb(parent,pos,o){
  const root=new T.Group(); root.position.set(...pos); parent.add(root);
  root.add(o.mk(seg(o.l1,o.r1[0],o.r1[1]),'upper'));
  const mid=new T.Group(); mid.position.y=-o.l1; root.add(mid);
  mid.add(o.mk(seg(o.l2,o.r2[0],o.r2[1]),'lower'));
  const end=new T.Group(); end.position.y=-o.l2; mid.add(end);
  if(o.end) o.end(end);
  return {root,mid,end,rest:{}};
}
function pose(L,rz=0,rx=0,mz=0,mx=0,ry=0){ L.root.rotation.set(rx,ry,rz); L.mid.rotation.set(mx,0,mz); L.rest={rz,rx,mz,mx,ry}; return L; }

