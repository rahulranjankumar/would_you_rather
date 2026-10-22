/* =====================================================================
   MAIN — composition, lights, reflective floor, 360° orbit, eyes & idle life
   ===================================================================== */
/* ---------- lights: warm key front-left, cool rim behind jelly, orange rim behind fox ---------- */
scene.add(new T.HemisphereLight(0xdfe9ff, 0x1a120c, 0.35));
const key = new T.DirectionalLight(0xffeedd, 1.7); key.position.set(-3, 5, 6); scene.add(key);
const fill = new T.DirectionalLight(0xffffff, 0.35); fill.position.set(3, 2, 6); scene.add(fill);
const rimBlue = new T.SpotLight(0x4fb6ff, 6, 12, 0.7, 0.6); rimBlue.position.set(-3.6, 2.6, -3.2); rimBlue.target.position.set(-1.6, 0.8, 0); scene.add(rimBlue, rimBlue.target);
const rimOrange = new T.SpotLight(0xff7a2a, 6, 12, 0.7, 0.6); rimOrange.position.set(3.6, 2.6, -3.2); rimOrange.target.position.set(1.4, 0.8, 0); scene.add(rimOrange, rimOrange.target);
const topLight = new T.PointLight(0xfff4e6, 0.6, 10); topLight.position.set(0, 4, 1.5); scene.add(topLight);

/* ---------- crew & composition ---------- */
const crew = [makeJelly(), makeAstronaut(), makeMuse(), makeFox()];
const layout = [ {x:0, z:0, ry:0}, {x:0, z:0, ry:0}, {x:0, z:0, ry:0}, {x:0, z:0, ry:0} ];   // positions come from the v29 motion (bridge.js)
const blobs = [[1.7,1.2,0.6],[1.1,0.9,0.8],[1.5,1.1,0.8],[1.7,1.1,0.8]];
crew.forEach((c,i)=>{ const L=layout[i]; c.position.set(L.x,0,L.z); c.rotation.y=L.ry; scene.add(c);
  c.userData.base={ry:L.ry, phase:i*1.3};
  const b=shadowBlob(...blobs[i]); b.position.x=L.x; b.position.z=L.z; scene.add(b);
  c.userData.shadow=b; c.userData.shadowX=L.x; c.userData.shadowZ=L.z; });

/* ---------- glossy black floor with coloured planar reflection, blur + distance fade ---------- */
const RT = new T.WebGLRenderTarget(1,1,{encoding:T.sRGBEncoding});
const mirrorCam = new T.PerspectiveCamera(); mirrorCam.layers.set(0);
const texMat = new T.Matrix4();
const floorMat = new T.ShaderMaterial({
  uniforms:{ tRef:{value:RT.texture}, texMat:{value:texMat} },
  vertexShader:`uniform mat4 texMat; varying vec4 vUv; varying vec3 vW;
    void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vUv=texMat*w; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader:`uniform sampler2D tRef; varying vec4 vUv; varying vec3 vW;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
    void main(){
      vec2 ripple = vec2(sin(vW.x*7.0+vW.z*3.0), cos(vW.z*9.0-vW.x*2.0))*0.002;
      vec4 uv=vUv; uv.xy += ripple*uv.w;
      vec3 r=vec3(0.0); float tot=0.0;
      for(int i=-3;i<=3;i++){ for(int j=-1;j<=1;j++){ float wgt=1.0-abs(float(i))*0.2;
        r+=texture2DProj(tRef, uv+vec4(float(j)*0.0025*uv.w, float(i)*0.0035*uv.w,0.0,0.0)).rgb*wgt; tot+=wgt; } }
      r/=tot;
      float d=length(vW.xz*vec2(0.17,0.34)); float fade=1.0-smoothstep(0.35,1.2,d);
      vec3 base=vec3(0.004,0.0045,0.006)*(1.0+0.2*h(floor(vW.xz*90.0)));
      gl_FragColor=vec4((base + r*0.62)*fade, 1.0);
    }`
});
const floor = new T.Mesh(new T.PlaneGeometry(40,40), floorMat); floor.rotation.x=-Math.PI/2; scene.add(floor);
let reflScale = 0.5;
function renderReflection(){
  RT.setSize(Math.floor(innerWidth*DPR*reflScale), Math.floor(innerHeight*DPR*reflScale));
  mirrorCam.fov=camera.fov; mirrorCam.aspect=camera.aspect; mirrorCam.near=camera.near; mirrorCam.far=camera.far; mirrorCam.updateProjectionMatrix();
  mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
  mirrorCam.up.set(0,1,0); mirrorCam.lookAt(orbit.target.x, -orbit.target.y, orbit.target.z);
  mirrorCam.updateMatrixWorld();
  texMat.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1);
  texMat.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
  floor.visible=false;
  renderer.setRenderTarget(RT); renderer.clear(); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
  floor.visible=true;
}

/* ---------- 360° orbit (drag), zoom (wheel/pinch), double-click reset ---------- */
const orbit = { target:new T.Vector3(0,0.85,0), theta:0, phi:0.1, dist:9, tTheta:0, tPhi:0.1, tDist:9, baseDist:9 };
function frameCamera(){
  const a = innerWidth/innerHeight; camera.aspect=a; camera.updateProjectionMatrix();
  orbit.baseDist = a>=1.4 ? 9.8 : 9.8*(1.55/a)*0.95; orbit.tDist = orbit.baseDist; if (!orbit.init){ orbit.dist=orbit.tDist; orbit.init=true; }
}
frameCamera();
if (P.has('az')) { orbit.theta=orbit.tTheta=+P.get('az'); }
if (P.has('el')) { orbit.phi=orbit.tPhi=+P.get('el'); }
if (P.has('zoom')) { orbit.dist=orbit.tDist=orbit.baseDist/(+P.get('zoom')); }
const ptrs = new Map(); let dragging=false, lastX=0, lastY=0, pinch0=0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e=>{ cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); dragging=true; lastX=e.clientX; lastY=e.clientY;
  if (ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0=Math.hypot(a.x-b.x,a.y-b.y); } });
cv.addEventListener('pointerup', e=>{ ptrs.delete(e.pointerId); if (!ptrs.size) dragging=false; });
cv.addEventListener('pointercancel', e=>{ ptrs.delete(e.pointerId); if (!ptrs.size) dragging=false; });
addEventListener('pointermove', e=>{
  mouse.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1);
  if (!dragging) return;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (ptrs.size===2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if (pinch0) orbit.tDist=T.MathUtils.clamp(orbit.tDist*pinch0/d, orbit.baseDist*0.45, orbit.baseDist*1.5); pinch0=d; return; }
  orbit.tTheta -= (e.clientX-lastX)*0.008;
  orbit.tPhi = T.MathUtils.clamp(orbit.tPhi + (e.clientY-lastY)*0.005, -0.02, 1.2);
  lastX=e.clientX; lastY=e.clientY;
}, {passive:true});
cv.addEventListener('wheel', e=>{ e.preventDefault(); orbit.tDist=T.MathUtils.clamp(orbit.tDist*(1+e.deltaY*0.001), orbit.baseDist*0.45, orbit.baseDist*1.5); }, {passive:false});
cv.addEventListener('dblclick', ()=>{ orbit.tTheta=Math.round(orbit.theta/(Math.PI*2))*Math.PI*2; orbit.tPhi=0.1; orbit.tDist=orbit.baseDist; });
addEventListener('resize', ()=>{ renderer.setSize(innerWidth,innerHeight); frameCamera(); });
function updateCamera(){
  orbit.theta += (orbit.tTheta-orbit.theta)*0.12; orbit.phi += (orbit.tPhi-orbit.phi)*0.12; orbit.dist += (orbit.tDist-orbit.dist)*0.12;
  const c=Math.cos(orbit.phi);
  camera.position.set(orbit.target.x+Math.sin(orbit.theta)*c*orbit.dist, orbit.target.y+Math.sin(orbit.phi)*orbit.dist+0.45, orbit.target.z+Math.cos(orbit.theta)*c*orbit.dist);
  camera.lookAt(orbit.target);
}

/* ---------- gaze target: cursor projected onto a plane facing the camera ---------- */
const mouse = new T.Vector2(0,0);
if (P.has('mx')) mouse.set(+P.get('mx'), +P.get('my'));
const ray = new T.Raycaster(), gazePlane = new T.Plane(), gaze = new T.Vector3(0,1.2,5), gazeS = new T.Vector3(0,1.2,5);
const tmp=new T.Vector3(), tmp2=new T.Vector3(), Z=new T.Vector3(0,0,1), qTmp=new T.Quaternion();
function updateGaze(){
  const n = tmp.copy(camera.position).sub(orbit.target).normalize();
  gazePlane.setFromNormalAndCoplanarPoint(n, tmp2.copy(orbit.target).addScaledVector(n, 3.5));
  ray.setFromCamera(mouse, camera); if (ray.ray.intersectPlane(gazePlane, gaze)) gazeS.lerp(gaze, 0.15);
}
function aimEye(e, t){
  const u=e.userData;
  if (t>u.nextSacc){ u.sacc.set(rnd(-0.12,0.12), rnd(-0.08,0.08), 0); u.nextSacc=t+rnd(0.5,2.2); }
  tmp.copy(gazeS).add(u.sacc); e.worldToLocal(tmp); tmp.normalize();
  const maxA=0.55, ang=Math.acos(T.MathUtils.clamp(tmp.z,-1,1));
  if (ang>maxA){ const k=Math.sin(maxA)/Math.max(1e-4,Math.hypot(tmp.x,tmp.y)); tmp.set(tmp.x*k,tmp.y*k,Math.cos(maxA)); }
  qTmp.setFromUnitVectors(Z, tmp); u.ball.quaternion.slerp(qTmp, 0.35);
}
/* blinking: shared rhythm, slight per-character offset */
const blinkNext = crew.map(()=>rnd(1,3)), blinkT = crew.map(()=>-1);
function blinkAmount(i,t){
  if (t>blinkNext[i]){ blinkT[i]=t; blinkNext[i]=t+rnd(2.2,5.0)+(Math.random()<0.2?-1.9:0); }
  const d=t-blinkT[i]; if (d<0||d>0.16) return 0; return Math.sin(d/0.16*Math.PI);
}

/* ---------- animation loop: camera + gaze here, all character motion lives in js/anim.js ---------- */
Anim.init(crew);
const clock = new T.Clock();
let frames=0, accMs=0, last=performance.now(), quality='high', tPrev=0, tAnim=0;
const GZ = { gaze:gazeS, aimEye, blinkAmount, quality:'high', skipDeform:false, dragging:false, shake:0 };
function update(t, dt){
  furTime.value = t;
  updateCamera(); updateGaze();
  GZ.quality = quality; GZ.dragging = dragging;
  if (!Anim.D.paused) Anim.update(dt, t, GZ);
  if (GZ.shake>1e-4){ camera.position.x += GZ.shake*Math.sin(t*93.0); camera.position.y += GZ.shake*Math.sin(t*71.0+1.3); }   // impact shake ≤ 0.03, off while dragging
}
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden){ last=performance.now(); tPrev=clock.getElapsedTime(); } });
function animate(){
  const now=performance.now(), dtMs=now-last; last=now;
  const TEST=P.has('t');
  if (TEST){
    // deterministic: optional forced scene, simulated at fixed 60 Hz from 0 → st (or t)
    const sid=P.get('scene'), st=P.has('st')?+P.get('st'):+P.get('t');
    if (sid && !window.Bridge) Anim.play(sid,{force:true});
    const n=Math.max(1,Math.round(st*60)); GZ.skipDeform=true;
    for (let i=1;i<=n;i++){ if (i===n) GZ.skipDeform=false; update(i/60, 1/60); }
    if (crew[0].userData.deform) crew[0].userData.deform(true);
  } else {
    const t=clock.getElapsedTime(); let dt=t-tPrev; tPrev=t; if (dt>1/20) dt=1/20;   // tab-hidden → no catch-up spike
    tAnim+=dt; update(tAnim, dt);
  }
  renderReflection();
  renderer.render(scene, camera);
  // adaptive quality: if the machine struggles, drop alternate fur shells (keeps resolution)
  if (!TEST && quality==='high'){ frames++; if (frames>30) accMs+=dtMs;
    if (frames===150){ if (accMs/120 > 24){ quality='low'; camera.layers.disable(1); reflScale=0.35; } } }
  if (!TEST) requestAnimationFrame(animate); else { window.__done=true; }
}
animate();

