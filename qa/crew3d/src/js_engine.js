/* =====================================================================
   ENGINE (Phase 0) — sockets, analytic 2-bone IK, step-planned locomotion with
   world-locked feet, pivot-correct rotation + floor clamp, deterministic ballistic
   physics (pre-integrated @120 Hz), char-to-char attach, verlet ropes, auto
   squash/stretch + smear, material looks, decals, floor clipping, timing tools.
   Zero allocations in per-frame paths (all temps preallocated).
   Made by PPA Warriors
   ===================================================================== */
const Eng = (() => {
const V3 = () => new T.Vector3();
const _a=V3(),_b=V3(),_c=V3(),_d=V3(),_e=V3(),_f=V3(),_g=V3(),_h=V3(),_p=V3(),_w=V3();
const _q=new T.Quaternion(), _q2=new T.Quaternion(), _m=new T.Matrix4(), _m2=new T.Matrix4(), _m3=new T.Matrix4(), _eu=new T.Euler();
const UP=new T.Vector3(0,1,0);
const clamp=(x,a,b)=>x<a?a:x>b?b:x, lerp=(a,b,t)=>a+(b-a)*t;
const sst=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const wrapA=a=>{ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; };
const G = 9.8*0.55;                     // cartoon gravity

/* per-character physical profile (weight drives timing, bounce, easing) */
const PROF = {
  jelly:{hw:0.50,hd:0.40,H:1.62,com:0.78, rest:0.55, style:'jwalk', ease:'outElastic', mass:0.8, crouch:0,    impact:'bloop'},
  astro:{hw:0.33,hd:0.28,H:1.74,com:0.92, rest:0.15, style:'waddle',ease:'outQuart',   mass:1.1, crouch:0.05, impact:'clank'},
  muse: {hw:0.48,hd:0.42,H:1.70,com:0.80, rest:0.25, style:'plod',  ease:'inOutSine',  mass:1.6, crouch:0.03, impact:'thud'},
  fox:  {hw:0.34,hd:0.30,H:1.45,com:0.62, rest:0.30, style:'trot',  ease:'outBack',    mass:0.6, crouch:0.035,impact:'thud'},
};
const STYLE = {
  waddle:{cad:4.5, lift:0.05, bob:0.020, sway:0.10, arm:0.40},
  trot:  {cad:5.5, lift:0.06, bob:0.030, sway:0.06, arm:0.45},
  plod:  {cad:3.2, lift:0.04, bob:0.035, sway:0.08, arm:0.30},
  scoot: {cad:3.0, lift:0.04, bob:0,     sway:0.05},
  jwalk: {cad:3.4, lift:0.06, bob:0.028, sway:0.09, arm:0.30, squash:0.075, lean:0.06},
  run:   {cad:6.5, lift:0.09, bob:0.045, sway:0.07, arm:0.75, lean:0.14, squash:0.05},
  strut: {cad:2.6, lift:0.07, bob:0.03,  sway:0.16, arm:0.35, squash:0.03},
  tiptoe:{cad:3.0, lift:0.10, bob:0.010, sway:0.03, arm:0.10, crouchAdd:0.03},
  panic: {cad:7.5, lift:0.08, bob:0.040, sway:0.12, arm:0},
};
let crew=null, S=null, CI=null, KIX=null;
const STATS={ footDrift:0, minClear:9, ikErr:0, ikN:0, frames:0, steps:0 };
const statsOn = P.has('t') || P.has('stats');

/* ---------------- init: measure rigs ---------------- */
function init(crewArr, states, channelIndex, kindIndex){
  crew=crewArr; S=states; CI=channelIndex; KIX=kindIndex;
  renderer.localClippingEnabled = true;
  const shared = new Set([eyeBallMat, corneaMat, glintMat]);
  crew.forEach((root,ci)=>{
    const u=root.userData, s=S[ci], pr=PROF[u.kind];
    s.prof=pr; s.len1=[]; s.len2=[]; s.restFoot=[V3(),V3()]; s.ikW=new Float32Array(4); s.ikT=[V3(),V3(),V3(),V3()]; s.ikPole=[V3(),V3(),V3(),V3()];
    s.pivot=V3(); s.prevW=V3(); s.velW=V3(); s.trail=[V3(),V3(),V3()]; s.att={w:0,p:V3(),v:V3(),init:false}; s.stretch=V3(1,1,1);
    s.clip=new T.Plane(new T.Vector3(0,1,0), 1000);
    // materials: floor clipping plane + soot/wet look (fur & gel have their own look uniforms)
    u.look = u.look || (u.furU ? { uSoot:u.furU.uSoot, uFrizz:u.furU.uFrizz, uWet:{value:0}, uSpike:{value:0} } : { uSoot:{value:0}, uWet:{value:0}, uFrizz:{value:0}, uSpike:{value:0} });
    const seen=new Set();
    root.traverse(o=>{ if (!o.material) return; const ms=Array.isArray(o.material)?o.material:[o.material];
      for (const m of ms){ if (seen.has(m)||shared.has(m)) continue; seen.add(m); m.clippingPlanes=[s.clip];
        const isFur = m.customProgramCacheKey && m.customProgramCacheKey()==='fur2';
        if (!isFur && (m.isMeshStandardMaterial) && m!==u.gel && m!==u.gelIn) wrapLook(m,u.look); } });
    if (u.kind==='jelly'){ for (const k of ['armL','armR','legL','legR']){ const j=u.rig[k]; s.len1.push(j.len); s.len2.push(0); }
      s.restFoot[0].set(-0.30,0.07,0.09); s.restFoot[1].set(0.24,0.07,0.07); s.maxStep=0.30; return; }
    // limb lengths + rest foot positions (root-local, body at origin, rest rotations)
    ['armL','armR','legL','legR'].forEach((k,li)=>{ const L=u.rig[k]; s.len1[li]=-L.mid.position.y; s.len2[li]=-L.end.position.y; });
    const b=u.body; b.position.set(0,0,0); b.rotation.set(0,0,0); b.scale.set(1,1,1);
    for (const k of ['armL','armR','legL','legR']){ const L=u.rig[k], r=L.rest; L.root.rotation.set(r.rx,r.ry,r.rz); L.mid.rotation.set(r.mx,0,r.mz); }
    root.updateMatrixWorld(true);
    for (let i=0;i<2;i++){ const L=u.rig[i?'legR':'legL']; L.end.getWorldPosition(_a); root.worldToLocal(_a); s.restFoot[i].copy(_a); }
    // horizontal reach of the feet while crouched → max step length
    const hip=u.rig.legL.root.position.y, fy=s.restFoot[0].y, L=s.len1[2]+s.len2[2];
    const vert=hip-fy-pr.crouch; s.maxStep=1.7*Math.sqrt(Math.max(0.0004,(0.975*L)**2-vert*vert));
  });
}
function wrapLook(m, look){
  const prev=m.onBeforeCompile, key0=m.customProgramCacheKey();
  m.onBeforeCompile=function(sh,r){ prev.call(this,sh,r); sh.uniforms.uSoot=look.uSoot; sh.uniforms.uWet=look.uWet;
    sh.fragmentShader='uniform float uSoot, uWet;\n'+sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
       float sn = fract(sin(dot(floor(vViewPosition.xy*55.0), vec2(12.9898,78.233)))*43758.5453);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb*(0.05+0.13*sn), uSoot);
       gl_FragColor.rgb += uWet*0.07;`); };
  m.customProgramCacheKey=()=>key0+'|look';
}

/* ---------------- sockets ---------------- */
const Sock=(who,name)=>crew[KIX[who]].userData.sock[name];
function sockWorld(who,name,out){ const o=Sock(who,name); o.updateWorldMatrix(true,false); return out.setFromMatrixPosition(o.matrixWorld); }

/* ---------------- IK targets ---------------- */
const IKT = {
  point:(x,y,z)=>(t,out)=>out.set(x,y,z),
  sock:(who,name,ox=0,oy=0,oz=0)=>(t,out)=>{ sockWorld(who,name,out); out.x+=ox; out.y+=oy; out.z+=oz; return out; },
  obj:(o,ox=0,oy=0,oz=0)=>(t,out)=>{ o.updateWorldMatrix(true,false); out.setFromMatrixPosition(o.matrixWorld); out.x+=ox; out.y+=oy; out.z+=oz; return out; },
  fn:(f)=>f,
};
/* clip-side IK request: weight ramps in over `a`, holds, ramps out */
function reach(c, who, limb, t0, t1, target, o={}){
  const li=['armL','armR','legL','legR'].indexOf(limb), side=limb.endsWith('L')?-1:1, isArm=li<2;
  const pole=o.pole || (isArm ? [side*0.55,-0.55,-0.6] : [side*0.15,0,1]);
  (c.iks||(c.iks=[])).push({who, li, t0, t1, a:o.a??Math.min(0.18,(t1-t0)/3), w:o.weight??1, target, pole:new T.Vector3(...pole).normalize(), ease:o.ease||'inOutCubic'});
  return c;
}

/* ---------------- analytic two-bone IK (law of cosines + pole) ---------------- */
function solveLimb(s, li, Pw, w, pole, stance){
  const u=s.u, L=u.rig[['armL','armR','legL','legR'][li]], body=u.body;
  if (s.kind==='jelly') return solveJelly(s,li,Pw,w);
  _m.copy(body.matrixWorld).invert(); _a.copy(Pw).applyMatrix4(_m);           // target in body-local
  const isArm=li<2;
  if (isArm){ _b.copy(_a).sub(L.root.position).normalize(); _a.addScaledVector(_b,-0.06); }  // aim hand socket, not wrist
  _b.copy(_a).sub(L.root.position);
  const l1=s.len1[li], l2=s.len2[li], D=clamp(_b.length(), Math.abs(l1-l2)+0.02, 0.985*(l1+l2));
  const cb=clamp((D*D-l1*l1-l2*l2)/(2*l1*l2),-1,1), bend=(isArm?-1:1)*Math.acos(cb);
  _c.set(0, -l1-l2*Math.cos(bend), -l2*Math.sin(bend));                      // hand in root-local (FK form)
  _d.copy(_c).normalize();                                                    // a1
  _e.set(0,-l1,0); _e.addScaledVector(_d,-_e.dot(_d)).normalize();             // a2: elbow side
  _f.crossVectors(_d,_e);                                                     // a3
  _m2.makeBasis(_d,_e,_f);
  _b.normalize();                                                             // b1
  _g.copy(pole); _g.addScaledVector(_b,-_g.dot(_b)); if (_g.lengthSq()<1e-6) _g.set(0,0,1).addScaledVector(_b,-_b.z); _g.normalize();
  _h.crossVectors(_b,_g);
  _m3.makeBasis(_b,_g,_h); _m.copy(_m2).transpose(); _m3.multiply(_m);
  _eu.setFromRotationMatrix(_m3,'XYZ');
  const r=L.root.rotation;
  r.set(r.x+wrapA(_eu.x-r.x)*w, r.y+wrapA(_eu.y-r.y)*w, r.z+wrapA(_eu.z-r.z)*w);
  L.mid.rotation.set(lerp(L.mid.rotation.x,bend,w), 0, L.mid.rotation.z*(1-w));
  if (statsOn && w>0.98){ ikError(s,L,Pw,isArm,D,l1+l2,stance,li); }
}
function ikError(s,L,Pw,isArm,D,Lsum,stance,li){
  if (D>=0.984*Lsum) return;                                                  // out of reach: not an IK error
  const body=s.u.body; L.root.updateMatrix(); L.root.matrixWorld.multiplyMatrices(body.matrixWorld,L.root.matrix);
  L.mid.updateMatrix(); L.mid.matrixWorld.multiplyMatrices(L.root.matrixWorld,L.mid.matrix);
  L.end.updateMatrix(); L.end.matrixWorld.multiplyMatrices(L.mid.matrixWorld,L.end.matrix);
  _w.setFromMatrixPosition(L.end.matrixWorld);
  if (isArm){ _p.setFromMatrixPosition(L.root.matrixWorld); _h.copy(Pw).sub(_p).normalize(); _p.copy(Pw).addScaledVector(_h,-0.06*body.scale.y); }
  else _p.copy(Pw);
  const err=_w.distanceTo(_p); STATS.ikErr=Math.max(STATS.ikErr,err); STATS.ikN++;
  if (stance){ STATS.footDrift=Math.max(STATS.footDrift,err); STATS.steps++; }
  if (!isArm){ const clr=_w.y-s.restFoot[li-2].y; if (clr<STATS.minClear) STATS.minClear=clr; }
}
function solveJelly(s, li, Pw, w){
  const u=s.u, j=u.rig[['armL','armR','legL','legR'][li]];
  _m.copy(u.body.matrixWorld).invert(); _a.copy(Pw).applyMatrix4(_m).sub(j.piv).normalize();
  _q.setFromUnitVectors(j.dir,_a); _eu.setFromQuaternion(_q,'XYZ');
  const r=j.root.rotation; r.x=lerp(r.x,clamp(_eu.x,-1.15,1.15),w); r.z=lerp(r.z,clamp(_eu.z,-1.15,1.15),w);
}
function jellySockets(s){                                                     // hand/foot sockets ride the virtual joints
  const u=s.u; for (const [n,k] of [['handL','armL'],['handR','armR'],['footL','legL'],['footR','legR']]){
    const j=u.rig[k], so=u.sock[n]; _eu.set(j.root.rotation.x,0,j.root.rotation.z); _q.setFromEuler(_eu);
    so.position.copy(u.sockRest[n]).sub(j.piv).applyQuaternion(_q).add(j.piv); }
}

/* =====================================================================
   LOCOMOTION — step planner. Footprints are world points, each foot is
   world-locked during stance (leg IK pins it), swing follows an arc,
   pelvis advance derives from the step plan. Jelly scoots (hops) and only
   moves while airborne, so nothing slides on the mirror floor.
   ===================================================================== */
function pathEval(pl, s, out){                       // point at arclength s along polyline
  const P=pl.pts; let acc=0;
  for (let i=1;i<P.length;i++){ const L=pl.seg[i-1]; if (s<=acc+L || i===P.length-1){ const u=L>0?clamp((s-acc)/L,0,1):0;
      out.x=P[i-1][0]+(P[i][0]-P[i-1][0])*u; out.z=P[i-1][1]+(P[i][1]-P[i-1][1])*u; out.hd=Math.atan2(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]); return out; } acc+=L; }
  out.x=P[0][0]; out.z=P[0][1]; out.hd=0; return out;
}
const trap=(u,r=0.25)=>u<=0?0:u>=1?1: u<r ? 0.5*u*u/(r*(1-r)) : u>1-r ? 1-0.5*(1-u)*(1-u)/(r*(1-r)) : (u-r/2)/(1-r);
/* build a walk plan: pts = [[x,z],...] world offsets from the layout spot */
function planWalk(who, t0, pts, o={}){
  const ci=KIX[who], s=S[ci], pr=s.prof, st=STYLE[o.style||pr.style];
  const pl={who, ci, t0, pts, seg:[], L:0, st, styleName:o.style||pr.style, lift:o.lift??st.lift, face:o.face??'travel', endYaw:o.endYaw??0, startYaw:o.startYaw??0};
  for (let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); pl.seg.push(d); pl.L+=d; }
  const jelly = (o.style||pr.style)==='scoot';
  const maxStep = jelly ? 0.32 : Math.min(s.maxStep, s.kind==='jelly'?0.2:0.22);
  const turn=Math.abs(pl.endYaw-pl.startYaw);
  let nMove=Math.max(pl.L>0.005?1:(turn>0.2?2:0), Math.ceil(pl.L*1.34/maxStep), jelly?0:Math.ceil(turn/0.7));
  if (!jelly && nMove%2) nMove++;                                           // even → both feet share the work
  let T=1/st.cad;
  if (o.dur){ const want=Math.max(nMove+1, Math.round(o.dur*st.cad)); const Tf=o.dur/want; if (Tf>=1/(st.cad*1.7) && Tf*want>=0.01){ T=Math.min(Tf,1/(st.cad*0.75)); nMove=Math.max(nMove,want-1); if(!jelly&&nMove%2)nMove++; } }
  pl.T=T; pl.nMove=nMove; pl.nS=nMove+(jelly?0:1); pl.Dmove=nMove*T; pl.dur=pl.nS*T; pl.t1=t0+pl.dur; pl.jelly=jelly;
  pl.heading = pl.L>0.25 && pl.face==='travel';
  if (jelly) return pl;
  // footprints: foot f swings on steps k%2==f; footprint = body pose at mid-stance
  pl.fp=[[],[]]; const tmp={};
  for (let f=0;f<2;f++){ pl.fp[f].push({t:-1e9, ...poseAt(pl,0,tmp,true)}); 
    for (let k=f;k<pl.nS;k+=2){ const tm=Math.min((k+1.5)*T, pl.Dmove); const ps=poseAt(pl,tm,{},true); pl.fp[f].push({t:k*T, ...ps}); } }
  return pl;
}
function yawAt(pl, t, hd){                                                   // body yaw (relative to layout) at plan time t
  const T=pl.T; let y = pl.startYaw;
  if (pl.heading){ const tgt=wrapA(hd - S[pl.ci].layoutRy); const a=sst(0,Math.min(T*1.5,pl.Dmove*0.4),t)*(1-sst(pl.Dmove-T*0.5,pl.dur,t));
    y = lerp(pl.startYaw, tgt, a) ; if (t>pl.Dmove-T*0.5) y = lerp(y, pl.endYaw, sst(pl.Dmove-T*0.5,pl.dur,t)); }
  else y = lerp(pl.startYaw, pl.endYaw, sst(0,pl.dur,t));
  return y;
}
function poseAt(pl, t, out, withYaw){
  const s = pl.L * trap(clamp(t/pl.Dmove,0,1)); pathEval(pl, pl.jelly?jellyS(pl,t):s, out);
  if (withYaw) out.yaw=yawAt(pl,t,out.hd); return out;
}
function jellyS(pl,t){ const k=Math.floor(t/pl.T), u=t/pl.T-k, air=sst(0.25,0.8,u); const hop=pl.L/Math.max(1,pl.nMove); return Math.min(pl.L,(Math.min(k,pl.nMove)+(k<pl.nMove?air:0))*hop); }
/* foot world target for foot f at plan time t → out (Vector3) */
function footAt(pl, f, t, out){
  const s=S[pl.ci], list=pl.fp[f], T=pl.T; let i=list.length-1; while (i>0 && list[i].t>t) i--;
  let x,z,yaw,lift=0; const cur=list[i];
  if (i>0 && t<cur.t+T){ const pv=list[i-1], u=(t-cur.t)/T, e=sst(0,1,u); x=lerp(pv.x,cur.x,e); z=lerp(pv.z,cur.z,e); yaw=lerp(pv.yaw,cur.yaw,e); lift=pl.lift*Math.sin(Math.PI*u); }
  else { x=cur.x; z=cur.z; yaw=cur.yaw; }
  const rf=s.restFoot[f], q=s.layoutRy+yaw, c=Math.cos(q), sn=Math.sin(q), rp=crew[pl.ci].position;
  out.set(rp.x + x + rf.x*c + rf.z*sn, rf.y + lift, rp.z + z - rf.x*sn + rf.z*c);
  return lift;
}
/* evaluate a plan into a channel array (adds) + leg IK, plan-local time tt */
const _pose={};
function evalWalk(pl, tt, a, s, setIK){
  const T=pl.T, base=pl.base, st=pl.st;
  poseAt(pl, tt, _pose, true);
  const env = sst(0, Math.min(0.15,pl.dur*0.3), tt) * (1-sst(pl.dur-Math.min(0.15,pl.dur*0.3), pl.dur, tt));
  a[CI['body.px']] += _pose.x - base[0]; a[CI['body.pz']] += _pose.z - base[1];
  a[CI['body.ry']] += _pose.yaw;
  if (pl.jelly){
    const k=Math.floor(tt/T), u=tt/T-k, inMove=k<pl.nMove;
    const hop = 0.045 + 0.25*pl.L/Math.max(1,pl.nMove);
    const air = u>0.25&&u<0.8 && inMove ? (u-0.25)/0.55 : -1;
    if (air>=0){ a[CI['body.py']] += hop*4*air*(1-air); a[CI['body.sy']] += 0.08*Math.sin(Math.PI*air); }
    else if (inMove){ const d = u<=0.25 ? u/0.25 : (1-u)/0.2; a[CI['body.sy']] += -0.14*Math.max(0,Math.min(1,u<=0.25? Math.sin(Math.PI*d*0.5):Math.exp(-(u-0.8)*14))); }
    if (pl.L>0.01){ const dx=pl.pts[pl.pts.length-1][0]-pl.pts[0][0]; a[CI['body.rz']] += -Math.sign(dx)*0.06*(air>=0?Math.sin(Math.PI*air):0); }
    return;
  }
  const k=Math.min(pl.nS-1,Math.floor(tt/T)), u=clamp(tt/T-k,0,1), side=(k%2)?1:-1;
  const crouch = (s.prof.crouch + (st.crouchAdd||0)) * env;
  // walk: pelvis rises mid-stance (inverted pendulum) but never past leg reach; run/panic: compress on each footfall
  const bb = s.kind==='jelly' ? st.bob : (pl.styleName==='run'||pl.styleName==='panic') ? -st.bob : Math.min(st.bob, (s.prof.crouch+(st.crouchAdd||0))*0.85);
  a[CI['body.py']] += -crouch + bb*Math.sin(Math.PI*u)*env;
  a[CI['body.rz']] += st.sway*side*Math.sin(Math.PI*u)*env;
  if (st.squash) a[CI['body.sy']] += -st.squash*Math.exp(-u*7)*env + 0.35*st.squash*Math.sin(Math.PI*u)*env;   // soft landing on every plant
  if (st.lean) a[CI['body.rx']] += st.lean*env*Math.min(1,pl.L/0.3);
  a[CI['head.rz']] += -0.5*st.sway*side*Math.sin(Math.PI*u)*env;
  // head leads body yaw by 0.08 s
  a[CI['head.ry']] += (yawAt(pl,Math.min(pl.dur,tt+0.08),_pose.hd)-_pose.yaw);
  if (st.arm){ const sw=st.arm*Math.sin(Math.PI*(tt/T))*env; a[CI['armL.rx']] += sw; a[CI['armR.rx']] += -sw; }
  if (setIK){ for (let f=0;f<2;f++){ const li=2+f; s.footLift[f]=footAt(pl,f,tt,s.ikT[li]); s.ikFn[li]=null; s.ikW[li]=Math.max(s.ikW[li], sst(0,0.06,tt)*(1-sst(pl.dur-0.06,pl.dur,tt))); s.ikPole[li].set(f?0.15:-0.15,0,1).normalize(); } }
}

/* =====================================================================
   PHYSICS — deterministic ballistic integration at 120 Hz, pre-baked at
   build time (scrubbable). Floor contact: restitution per character,
   impact squash ∝ |vy|, friction, spin decay. Impacts emit sfx/fx events.
   ===================================================================== */
function bake(who, o){
  const pr=PROF[who], dt=1/120, g=o.g??G, rest=o.bounce??pr.rest, fr=o.friction??0.35;
  let px=o.p?o.p[0]:0, py=o.p?o.p[1]:0, pz=o.p?o.p[2]:0, vx=o.v[0], vy=o.v[1], vz=o.v[2];
  let rx=o.r?o.r[0]:0, ry=o.r?o.r[1]:0, rz=o.r?o.r[2]:0, wx=o.spin?o.spin[0]:0, wy=o.spin?o.spin[1]:0, wz=o.spin?o.spin[2]:0;
  const n=Math.ceil((o.until??3)/dt)+1, A=new Float32Array(n*6), imp=[]; let settled=-1;
  for (let i=0;i<n;i++){
    A[i*6]=px; A[i*6+1]=py; A[i*6+2]=pz; A[i*6+3]=rx; A[i*6+4]=ry; A[i*6+5]=rz;
    if (settled>=0) continue;
    vy-=g*dt; px+=vx*dt; py+=vy*dt; pz+=vz*dt; rx+=wx*dt; ry+=wy*dt; rz+=wz*dt;
    if (o.floor!==false && py<=0 && vy<0){
      py=0; imp.push({t:(i+1)*dt, vy:-vy});
      if (-vy<0.55 || imp.length>=(o.maxBounce??4)){ vy=0; vx=vz=0; settled=i+1; if (o.upright!==false){ rx=Math.round(rx/(2*Math.PI))*2*Math.PI; rz=Math.round(rz/(2*Math.PI))*2*Math.PI; } }
      else { vy=-vy*rest; vx*=(1-fr); vz*=(1-fr); wx*=0.45; wy*=0.6; wz*=0.45; }
    }
  }
  return {A, n, dt, imp, settled: settled>=0?settled*dt:(o.until??3), end:[px,py,pz,rx,ry,rz]};
}
/* v0 that lands exactly at (x,z) offset after T seconds from height y0 to y1 */
function solveArc(dx,dz,T,dy=0,g=G){ return [dx/T, (dy+0.5*g*T*T)/T, dz/T]; }

/* ---------------- ropes (verlet, pooled, InstancedMesh segments) ---------------- */
const ROPES=[];
function makeRope(n=16, radius=0.012, color=0xff8fc8){
  const g=new T.CylinderGeometry(1,1,1,6,1,true); const m=new T.MeshStandardMaterial({color, roughness:0.6});
  const im=new T.InstancedMesh(g,m,n-1); im.visible=false; im.frustumCulled=false; scene.add(im);
  const r={n, radius, im, p:new Float32Array(n*3), o:new Float32Array(n*3), rest:0.05, pinA:null, pinB:null, on:false, snapped:false, maxLen:9, onSnap:null, stiff:1, mid:-1};
  ROPES.push(r); return r;
}
function ropeStart(r, A, B, slack=1.05){
  r.pinA=A; r.pinB=B; A(0,_a); B(0,_b); const L=_a.distanceTo(_b)*slack; r.rest=L/(r.n-1); r.on=true; r.snapped=false; r.im.visible=true;
  for (let i=0;i<r.n;i++){ const u=i/(r.n-1); r.p[i*3]=lerp(_a.x,_b.x,u); r.p[i*3+1]=lerp(_a.y,_b.y,u)-Math.sin(Math.PI*u)*0.05; r.p[i*3+2]=lerp(_a.z,_b.z,u); }
  r.o.set(r.p);
}
function ropeStop(r){ r.on=false; r.im.visible=false; r.pinA=r.pinB=null; }
function ropeStep(r, dt, t){
  if (!r.on) return; const n=r.n, p=r.p, o=r.o, sub=Math.max(1,Math.ceil(dt*120)), h=dt/sub;
  for (let s=0;s<sub;s++){
    for (let i=0;i<n;i++){ const k=i*3; const vx=(p[k]-o[k])*0.985, vy=(p[k+1]-o[k+1])*0.985, vz=(p[k+2]-o[k+2])*0.985;
      o[k]=p[k]; o[k+1]=p[k+1]; o[k+2]=p[k+2]; p[k]+=vx; p[k+1]+=vy-G*h*h; p[k+2]+=vz + Math.sin(t*3+i)*0.00002; if (p[k+1]<0.005) p[k+1]=0.005; }
    if (r.pinA && !r.snappedA){ r.pinA(t,_a); p[0]=_a.x; p[1]=_a.y; p[2]=_a.z; }
    if (r.pinB && !r.snappedB){ r.pinB(t,_b); const k=(n-1)*3; p[k]=_b.x; p[k+1]=_b.y; p[k+2]=_b.z; }
    for (let it=0;it<4;it++) for (let i=0;i<n-1;i++){ if (r.snapped && i===r.mid) continue;
      const a=i*3, b=a+3; const dx=p[b]-p[a], dy=p[b+1]-p[a+1], dz=p[b+2]-p[a+2]; const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6; const df=(d-r.rest)/d*0.5*r.stiff;
      const fa=(i===0&&!r.snappedA)?0:1, fb=(i===n-2&&!r.snappedB)?0:1, sw=fa+fb||1;
      p[a]+=dx*df*fa*2/sw; p[a+1]+=dy*df*fa*2/sw; p[a+2]+=dz*df*fa*2/sw; p[b]-=dx*df*fb*2/sw; p[b+1]-=dy*df*fb*2/sw; p[b+2]-=dz*df*fb*2/sw; }
  }
  if (!r.snapped){ let L=0; for (let i=0;i<n-1;i++){ const a=i*3; L+=Math.hypot(p[a+3]-p[a],p[a+4]-p[a+1],p[a+5]-p[a+2]); }
    if (L>r.maxLen){ r.snapped=true; r.mid=(n/2)|0; r.onSnap && r.onSnap(); } }
  for (let i=0;i<n-1;i++){ const a=i*3; _a.set(p[a],p[a+1],p[a+2]); _b.set(p[a+3],p[a+4],p[a+5]); _c.subVectors(_b,_a); const L=_c.length()||1e-6;
    _q.setFromUnitVectors(UP,_c.multiplyScalar(1/L)); _d.addVectors(_a,_b).multiplyScalar(0.5);
    const hide = r.snapped && i===r.mid; _e.set(hide?0:r.radius, hide?0:L, hide?0:r.radius); _m.compose(_d,_q,_e); r.im.setMatrixAt(i,_m); }
  r.im.instanceMatrix.needsUpdate=true;
}

/* ---------------- decals (canvas, drawn once, pooled planes) ---------------- */
function ctex(w,h,draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new T.CanvasTexture(cv); t.encoding=T.sRGBEncoding; return t; }
const DTEX = {
  cream: ctex(128,128,(g)=>{ g.fillStyle='#fffaf0'; g.beginPath(); for(let i=0;i<14;i++){ const a=i/14*Math.PI*2, r=40+((i*37)%17); g.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r); } g.fill();
    for (let i=0;i<5;i++){ g.fillRect(40+i*12,80,7,20+((i*13)%25)); g.beginPath(); g.arc(43.5+i*12,100+((i*13)%25),4,0,7); g.fill(); } }),
  mustache: ctex(128,64,(g)=>{ g.fillStyle='#2a1708'; g.beginPath(); g.moveTo(64,26); g.bezierCurveTo(40,8,14,18,8,40); g.bezierCurveTo(20,28,40,30,64,40); g.bezierCurveTo(88,30,108,28,120,40); g.bezierCurveTo(114,18,88,8,64,26); g.fill(); }),
  crack: ctex(256,256,(g)=>{ g.strokeStyle='rgba(10,10,12,.95)'; g.lineWidth=3; for (let i=0;i<9;i++){ const a=i/9*Math.PI*2; g.beginPath(); g.moveTo(128,128); let x=128,y=128; for (let k=0;k<5;k++){ x+=Math.cos(a+((k*7+i)%5-2)*0.15)*22; y+=Math.sin(a+((k*3+i)%5-2)*0.15)*22; g.lineTo(x,y);} g.stroke(); }
    g.beginPath(); g.arc(128,128,30,0,7); g.stroke(); g.fillStyle='rgba(0,0,0,.6)'; g.beginPath(); g.arc(128,128,26,0,7); g.fill(); }),
  scorch: ctex(128,128,(g)=>{ const gr=g.createRadialGradient(64,64,4,64,64,62); gr.addColorStop(0,'rgba(0,0,0,.9)'); gr.addColorStop(0.6,'rgba(20,12,8,.5)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); }),
  gum: ctex(64,64,(g)=>{ g.fillStyle='#ff7fc0'; g.beginPath(); g.ellipse(32,32,24,18,0,0,7); g.fill(); g.fillStyle='rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(25,26,7,4,-0.4,0,7); g.fill(); }),
};
const DECALS={};
function decal(id, tex, w, h, floor){
  const m=new T.Mesh(new T.PlaneGeometry(w,h), new T.MeshBasicMaterial({map:DTEX[tex], transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, toneMapped:false}));
  m.visible=false; m.renderOrder=60; if (floor) m.rotation.x=-Math.PI/2; scene.add(m); DECALS[id]=m; return m;
}
function decalOn(id, who, sockName, o={}){ const d=DECALS[id]; const so=who?Sock(who,sockName):null; if (so){ if (d.parent!==so) so.add(d); d.position.set(o.x||0,o.y||0,o.z??0.01); d.rotation.set(0,0,o.rot||0); } else { if (d.parent!==scene) scene.add(d); d.position.set(o.x||0,0.004,o.z||0); }
  d.scale.setScalar(o.s||1); d.material.opacity=o.op??1; d.visible=true; }
function decalOff(id){ const d=DECALS[id]; if (!d) return; d.visible=false; if (d.parent!==scene) scene.add(d); }
function initDecals(){ decal('cream1','cream',0.22,0.22); decal('cream2','cream',0.22,0.22); decal('cream3','cream',0.22,0.22); decal('stache1','mustache',0.2,0.1); decal('stache2','mustache',0.2,0.1); decal('stache3','mustache',0.2,0.1);
  decal('crack','crack',1.0,1.0,true); decal('scorch','scorch',1.1,1.1,true); decal('gum','gum',0.18,0.18,true); }

/* ---------------- smear (speed-line ghosts, layer 1) ---------------- */
const SMEAR=[];
function initSmear(){ const tex=ctex(64,64,(g)=>{ const gr=g.createRadialGradient(32,32,2,32,32,30); gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); });
  for (let i=0;i<12;i++){ const sp=new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthWrite:false})); sp.layers.set(1); sp.visible=false; sp.renderOrder=85; scene.add(sp); SMEAR.push(sp); } }

function crit(o, goal, hl, dt){ const y=(4*0.69314718056)/(hl+1e-5)/2, j0=o.x-goal, j1=o.v+j0*y, e=Math.exp(-y*dt); o.x=e*(j0+j1*dt)+goal; o.v=e*(o.v-j1*y*dt); return o.x; }
/* home foot world position (rest foot under the layout spot, rotated by layout yaw) + world offset */
function footHome(s, f, dx, dz, lift, out){ const rf=s.restFoot[f], q=s.layoutRy, c=Math.cos(q), sn=Math.sin(q), rp=crew[s.ci].position;
  return out.set(rp.x+dx+rf.x*c+rf.z*sn, rf.y+lift, rp.z+dz-rf.x*sn+rf.z*c); }
return { crit, footHome, PROF, STYLE, STATS, statsOn, G, init, Sock, sockWorld, IKT, reach, solveLimb, jellySockets, planWalk, evalWalk, footAt, bake, solveArc,
  makeRope, ropeStart, ropeStop, ropeStep, ROPES, DECALS, decalOn, decalOff, initDecals, SMEAR, initSmear, sst, clamp, wrapA, trap, tmp:{_a,_b,_c,_d,_e,_m} };
})();

