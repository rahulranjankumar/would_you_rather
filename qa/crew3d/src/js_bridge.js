/* =====================================================================
   BRIDGE — v29 trio MOTION  →  our character LOOKS
   - assets/crew.js (v29, unchanged) runs every scene exactly as before, headless:
     its pose for Bip / Bop / Boop is read each frame and retargeted onto our
     three.js characters (body, lean/tilt, squash, arms, legs, face, soot, hide, size).
   - v29 props + particles (rockets, pies, buckets, balloons …) are mirrored into
     three.js; props held in a v29 hand ride on our character's hand.
   - Speech bubbles and v29 sound effects are kept.
   Made by PPA Warriors
   ===================================================================== */
(() => {
const Pm = new URLSearchParams(location.search);
/* v29 renderer is not needed: stub it so crew.js never opens its own canvas loop */
Toy3D.Renderer = function(){ this.ok=()=>false; this.begin=()=>{}; this.draw=()=>{}; };

const K_UNIT = 1.15;                               // 1 v29 unit → metres in our scene
const KX = 1.45;                                   // horizontal spread: our characters are wider than the v29 toys
const SLOTS = ['bip','bop','boop'];
const SLOT_NAME = {bip:'Bip (tall)', bop:'Bop (short)', boop:'Boop (chubby)'};
const CAST = { bip: Pm.get('bip')||'astro', bop: Pm.get('bop')||'jelly', boop: Pm.get('boop')||'muse' };
const KIX = {jelly:0, astro:1, muse:2, fox:3};

let st=null, st2=null, band=null, inited=false, ourH=[1,1,1,1];
/* ---- 4th character. mode 'join' (default): stands with the trio and takes part in every scene —
   follows them, reacts to what happens (laughs at the pie victim, gasps at rockets, cheers, dances,
   gets knocked over when someone crashes into it, gets sooty in explosions).
   mode 'mix': plays a role from a DIFFERENT scene on a second headless v29 stage. ---- */
const LANE = 1.95, SHIFT = -0.55;           // trio steps left a little to make room; the 4th stands on the right (v29 units)
const NOMIX = ['trenchcoat','piggyback','rps','attend','stomp','panic','climb','wave','cheer','bow','dish','chillNudge','yawn'];
const EX = { mode:'join', mix:'auto', slot:'auto', cur:null, curSlot:'bop' };
const extraKind=()=>Object.keys(KIX).find(k=>!SLOTS.some(s=>CAST[s]===k));
const hash=(str)=>{ let h=7; for (const c of str) h=(h*31+c.charCodeAt(0))>>>0; return h; };
function pickMix(name){
  if (EX.mix!=='auto' && Crew.SCENES[EX.mix]) return EX.mix;
  const d=(Crew.SCENES[name]||{}).d||6, h=hash(name);
  const pool=Crew.GROUPS.gag.concat(Crew.GROUPS.dance).filter((n,i,a)=>a.indexOf(n)===i && n!==name && !NOMIX.includes(n) && Crew.SCENES[n]);
  pool.sort((a,b)=>Math.abs(Crew.SCENES[a].d-d)-Math.abs(Crew.SCENES[b].d-d) || (a<b?-1:1));
  return pool[h%Math.min(7,pool.length)];
}
const pickSlot=(name)=> EX.slot!=='auto' ? EX.slot : SLOTS[(hash(name)>>>3)%3];
const mixOn=()=>EX.mode==='mix';
const B = window.Bridge = { st:null, EX, extraKind, CAST, SLOTS, SLOT_NAME, speed:1, paused:false, loop:false, auto:false, cur:null, clock:0, onScene:null };

function init(){
  inited=true;
  band=document.createElement('div');
  band.style.cssText='position:fixed;left:0;top:0;width:100vw;height:70vh;visibility:hidden;pointer-events:none';
  document.body.appendChild(band);
  st = B.st = Crew.mount(band,{eggs:false, track:false, force3D:true, unitFn:s=>s.c.getBoundingClientRect().width/6.5/100});
  st2 = B.st2 = Crew.mount(band,{eggs:false, track:false, force3D:true, unitFn:s=>s.c.getBoundingClientRect().width/6.5/100});
  const m2=st2.measure; st2.measure=function(a,b){ const r=m2.call(this,a,b); this.rect=null; return r; };   // headless: never clickable
  // natural heights of our models (for matching v29 proportions)
  const box=new T.Box3(), v=new T.Vector3();
  crew.forEach((c,i)=>{ c.updateMatrixWorld(true); box.setFromObject(c.userData.body); box.getSize(v); ourH[i]=Math.max(0.6,v.y); });
  applyCast();
  B.bubble=document.createElement('div'); B.bubble.className='say';
  document.body.appendChild(B.bubble);
  addEventListener('pointerdown', poke);
}
function slotOf(ci){ for (const k of SLOTS) if (KIX[CAST[k]]===ci) return k; return null; }
const isX=(ci)=>KIX[extraKind()]===ci;
function applyCast(){
  crew.forEach((c,i)=>{ const sl=slotOf(i); c.visible=true; if (c.userData.shadow) c.userData.shadow.visible=true;
    const kind=sl||(mixOn()?EX.curSlot:'bop'), s=(Crew.DESIGN[kind].h+0.12)*K_UNIT/ourH[i]; c.userData.base=s; c.scale.setScalar(s); });
}
B.setCast=(slot,kind)=>{ for (const k of SLOTS) if (k!==slot && CAST[k]===kind) CAST[k]=CAST[slot]; CAST[slot]=kind; applyCast(); };

/* ---------- playback ---------- */
function startMix(name){ if (!mixOn()){ EX.cur=null; if (st2.scene) st2.end(true); applyCast(); return; }
  EX.cur=pickMix(name); EX.curSlot=pickSlot(name); applyCast(); st2.play(EX.cur); st2._seek=0; }
B.play=(name)=>{ if (!st) return; B.cur=name; B.clock=0; st.play(name); st._seek=0; startMix(name); J.ko=0; B.onScene&&B.onScene(name); };
B.stop=()=>{ if (st && st.scene) st.end(true); if (st2 && st2.scene) st2.end(true); st._seek=null; st2._seek=null; B.cur=null; EX.cur=null; };
B.seek=(t)=>{ if (!st || !B.cur) return; if (!st.scene || t<B.clock){ st.play(B.cur); if (mixOn()&&EX.cur) st2.play(EX.cur); } B.clock=t; st._seek=t; if (st2.scene) st2._seek=Math.min(t,st2.scene.d-1e-3); };
B.setMix=(m,sl)=>{ EX.mode = m==='join' ? 'join' : 'mix'; EX.mix = m==='join'||m==='mix' ? 'auto' : m; EX.slot=sl;
  if (B.cur){ const c=B.clock; startMix(B.cur); if (st2.scene) st2._seek=Math.min(c,st2.scene.d-1e-3); } else applyCast(); };
B.dur=()=> st && st.scene ? st.scene.d : 0;
B.scenes=()=> Object.keys(Crew.SCENES).filter(n=>!['attend','stomp','panic','climb'].includes(n));
B.groups=()=> Crew.GROUPS;
let nextAuto=0;

B.pre=(dt,t)=>{
  if (!inited) init();
  if (!B.paused){
    if (st.scene){ B.clock += dt*B.speed; st._seek=B.clock; if (B.clock>=st.scene.d){ st._seek=null; } if (st2.scene) st2._seek=B.clock; }
    else { st._seek=null; if (st2.scene) st2.end(true); st2._seek=null;
      if (B.cur && B.loop){ B.play(B.cur); }
      else if (B.auto && t>nextAuto){ const pool=B.scenes(); B.play(pool[(Math.random()*pool.length)|0]); }
      else if (B.cur && !st.scene){ B.cur=null; nextAuto=t+2.5; B.onScene&&B.onScene(null); } }
  }
  st.measure(innerWidth, innerHeight); st2.measure(innerWidth, innerHeight);
  const now=performance.now();
  if (!B.paused || B._dirty){ st.tick(now, B.paused?0:dt*B.speed); st2.tick(now, B.paused?0:dt*B.speed); B._dirty=false; }
  syncProps();
  bubble();
  frame();
};
/* camera rises & pulls back a little for tall stunts (ladders, balloons, rockets) */
let extra=0;
function frame(){ let top=0; for (const c of SLOTS.map(k=>st.chars[k]).concat(mixOn()?[st2.chars[EX.curSlot]]:[])){ if (!c.P.hide) top=Math.max(top,(c.root.p[1]+c.H*(c.root.s[0]||1))*K_UNIT); }
  const want=Math.min(3.5,Math.max(0,top-2.0)); const prev=extra; extra+= (want-extra)*0.05;
  if (typeof orbit!=='undefined'){ orbit.target.y=0.85+extra*0.55; orbit.tDist+= (extra-prev)*2.2; } }
B.refresh=()=>{ B._dirty=true; };

/* ---------- pose retarget: v29 nodes → our channels ---------- */
const EXPR=(P)=>{ if (P.eyes==='x'||P.dizzy) return 'dizzy'; if (P.eyes==='wide'||P.mouth==='o') return 'shock';
  if (P.mouth==='frown') return 'scared'; if (P.eyes==='happy') return P.mouth==='open'?'giggle':'love';
  if (P.brow>0) return 'smug'; if (P.eyes==='closed') return 'embarrassed'; if (P.mouth==='open'||P.mouth==='grin') return 'giggle'; return 'neutral'; };
B.pose=(s,o,t,dt)=>{
  if (!st) return; const slot=slotOf(s.ci), x4=!slot && isX(s.ci); if (!slot && !x4) return;
  if (x4 && !mixOn()) return joinPose(s,o,t,dt);
  const ch=x4 ? st2.chars[EX.curSlot] : st.chars[slot], P=ch.P, CI=Anim.CI, R=Anim.REST[s.kind], root=crew[s.ci], jelly=s.kind==='jelly';
  const xoff = x4 ? LANE - st2.hx(ch) : SHIFT;
  root.visible=!P.hide; if (root.userData.shadow) root.userData.shadow.visible=!P.hide;
  root.scale.setScalar((root.userData.base||1)*(ch.root.s[0]||1));
  const k=K_UNIT/root.scale.x;
  // body: v29 root position (incl. pop-absorber), yaw, rig lean/tilt (+drag), torso squash (+click spring)
  o[CI['body.px']]=(ch.root.p[0]+xoff)*k*KX/K_UNIT; o[CI['body.py']]=ch.root.p[1]*k; o[CI['body.pz']]=ch.root.p[2]*k;
  o[CI['body.ry']]=ch.root.r[1]; o[CI['body.rz']]=ch.rig.r[2]; o[CI['body.rx']]=ch.rig.r[0];
  o[CI['body.sy']]=(ch.torso.s[1]-1)*(jelly?1.3:1); o[CI['body.sx']]=0; o[CI['body.sz']]=0;
  o[CI['pivot.com']]=1;
  // arms: v29 shoulder rot (-fwd, twist, ±raise) → absolute pose minus our rest
  for (const [side,sg,node] of [['L',-1,ch.n.shL],['R',1,ch.n.shR]]){ const r=R['arm'+side], b=CI['arm'+side+'.rz'];
    const raise=sg<0?-node.r[2]:node.r[2], fwd=-node.r[0], tw=node.r[1];
    if (jelly){ o[b]=sg*raise*0.42; o[b+1]=-fwd*0.42; o[b+2]=0; o[b+3]=0; o[b+4]=0; continue; }
    o[b]  = sg*raise - r.rz; o[b+1]= -fwd - r.rx; o[b+2]= sg*tw*0.6;
    o[b+3]= sg*(0.05+0.15*Math.min(1,Math.abs(raise)/2)) - r.mz; o[b+4]= -0.1-0.35*Math.min(1,Math.max(0,fwd)) - r.mx; }
  // legs: v29 hip swing (x) + splay (z); knee follows the swing
  for (const [side,sg,node] of [['L',-1,ch.n.hipL],['R',1,ch.n.hipR]]){ const b=CI['leg'+side+'.rz'];
    const sw=node.r[0], spl=node.r[2];
    o[b]=spl*(jelly?0.6:1); o[b+1]=sw*(jelly?0.7:1); o[b+2]=0; o[b+3]=0; o[b+4]=jelly?0:0.55*Math.max(0,-sw)+0.25*Math.max(0,sw); }
  o[CI['look.soot']]=P.dark||0;
  Anim.setExprIx(s.ci, EXPR(P));
};
/* ---------- JOIN mode: the 4th takes part in the trio's scene ---------- */
const J={ x:null, react:'idle', rt:0, ko:0, kdir:1, kt:0, hop:-9, say:null, saidAt:-9, prevVictims:0, soot:0 };
B.J=J;
const DANCE=['danceOff','danceParty','springBoots','tickle','zoomies'];
const LINES={ laugh:['HAHA!','Ha! Got you!','Oof, that\'s cream!','LOL'], shock:['Whoa!','Yikes!','Is that safe?!','Look out!'], cheer:['Yay!','Woohoo!','Team!'], dance:['Dance break!','Ooh, my jam!'], knocked:['Ow!','Hey!!'] };
const jSfx=(n)=>{ try{ window.SFX && SFX[n] && SFX[n](); }catch(e){} };
const clampJ=(v,a,b)=>v<a?a:v>b?b:v;
function jSay(kind,t){ if (t-J.saidAt<2.6) return; J.saidAt=t; const L=LINES[kind]; J.say={t:L[(Math.random()*L.length)|0], until:performance.now()+1300}; }
function jArm(o,R,CI,side,sg,raise,fwd,jelly){ const b=CI['arm'+side+'.rz'], r=R['arm'+side];
  if (jelly){ o[b]=sg*raise*0.42; o[b+1]=-fwd*0.42; o[b+2]=0; o[b+3]=0; o[b+4]=0; return; }
  o[b]=sg*raise-r.rz; o[b+1]=-fwd-r.rx; o[b+2]=0; o[b+3]=sg*(0.05+0.15*Math.min(1,Math.abs(raise)/2))-r.mz; o[b+4]=-0.1-0.35*Math.min(1,Math.max(0,fwd))-r.mx; }
function jLeg(o,CI,side,sw,jelly){ const b=CI['leg'+side+'.rz']; o[b]=0; o[b+1]=sw*(jelly?0.7:1); o[b+2]=0; o[b+3]=0; o[b+4]=jelly?0:0.55*Math.max(0,-sw)+0.25*Math.max(0,sw); }
function joinPose(s,o,t,dt){
  const CI=Anim.CI, R=Anim.REST[s.kind], root=crew[s.ci], jelly=s.kind==='jelly';
  root.visible=true; if (root.userData.shadow) root.userData.shadow.visible=true;
  root.scale.setScalar(root.userData.base||1); const k=K_UNIT/root.scale.x;
  const T3=SLOTS.map(n=>st.chars[n]), vis=T3.filter(c=>!c.P.hide);
  // who is the centre of attention right now?
  let best=null, bs=0.9;
  for (const c of T3){ const P=c.P; let d=0; if (P.cream) d+=2; if (P.eyes==='x'||P.dizzy) d+=3; if (P.hide) d+=2; if ((P.dark||0)>0.3) d+=2;
    d+=Math.max(0,c.root.p[1])*1.5; if (P.eyes==='wide') d+=1.2; if (Math.abs(c.rig.r[2])>1) d+=1.5; if (d>bs){ bs=d; best=c; } }
  // stand at the end of the line, follow the group when it moves
  const rxM = vis.length ? Math.max(...vis.map(c=>c.root.p[0])) : (J.x??1.4);
  const target = clampJ(rxM+0.9, -2.2, (st.halfU||3.25)-0.35-SHIFT);
  if (J.x===null) J.x=target;
  const step=clampJ((target-J.x)*(1-Math.exp(-dt*5)), -2.8*dt, 2.8*dt); J.x+=step; const moving=Math.abs(target-J.x)>0.06;
  // collisions: someone crashes / falls into the 4th → it gets knocked over too
  const sct = st.scene ? B.clock : -1, inScene = sct>0.7 && st.scene && sct<st.scene.d-1.0 && !DANCE.includes(B.cur);
  if (inScene && t>J.ko+2.2) for (const c of vis){ const dx=c.root.p[0]-J.x, toward=(c._vxs||0)*(-Math.sign(dx))>3.2;
    if (Math.abs(dx)<0.6 && c.root.p[1]<0.9 && (Math.abs(c.rig.r[2])>1.0 || toward)){ J.ko=t+1.7; J.kt=t; J.kdir=Math.sign(dx)||1; J.x-= (Math.sign(dx)||1)*0.15; jSfx('bonk'); jSay('knocked',t); break; } }
  // pick a reaction (with a little hysteresis so it doesn't flicker)
  const happy=T3.filter(c=>c.P.eyes==='happy'&&!c.P.cream).length;
  const victim = best && (best.P.cream||best.P.eyes==='x'||best.P.dizzy||Math.abs(best.rig.r[2])>1.1||(best.P.dark||0)>0.5);
  let r='idle';
  if (t<J.ko) r='knocked';
  else if (B.cur && DANCE.includes(B.cur) && st.scene) r='dance';
  else if (victim) r='laugh';
  else if (best && (best.root.p[1]>0.55||best.P.hide||best.P.eyes==='wide')) r='shock';
  else if (happy>=2) r='cheer';
  if (r!==J.react && (r==='knocked' || t-J.rt>0.45)){ J.react=r; J.rt=t; if (r!=='idle') jSay(r,t); }
  r=J.react;
  // soot from nearby explosions
  let dark=0; for (const c of T3) if (Math.abs(c.root.p[0]-J.x)<1.7) dark=Math.max(dark,c.P.dark||0);
  J.soot = r==='laugh' && dark>0.3 ? Math.max(J.soot,dark) : J.soot*Math.exp(-dt*0.6); J.soot=Math.max(J.soot,dark);
  // pose
  const fx = best ? best.root.p[0] : (vis.length ? vis.reduce((a,c)=>a+c.root.p[0],0)/vis.length : 0);
  let py=0, ry=clampJ((fx-J.x)*1.4,-1.15,1.15), rz=0, rx=0, sy=Math.sin(t*2.2)*0.016, ex='neutral';
  let aL=[0.16+Math.sin(t*1.7)*0.04,0], aR=[0.16+Math.sin(t*1.6+1)*0.04,0], lL=0, lR=0;
  const ph=t-J.rt;
  if (r==='laugh'){ ex='giggle'; rz=Math.sin(t*9)*0.08; py+=Math.abs(Math.sin(t*9))*0.06; aL=[0.5,0.9]; aR=[1.25+Math.sin(t*12)*0.12,1.25]; }   // holds belly, points at the victim
  else if (r==='shock'){ ex='shock'; aL=aR=[1.9+Math.sin(t*20)*0.15,0.2]; rx=-0.12; py+=ph<0.4?4*(ph/0.4)*(1-ph/0.4)*0.18:0; sy+=ph<0.12?-0.12:0; }
  else if (r==='cheer'){ ex='love'; aL=aR=[2.5+Math.sin(t*14)*0.25,0]; py+=Math.abs(Math.sin(t*5.5))*0.25; }
  else if (r==='dance'){ const beat=t*2.5, q=Math.floor(beat)%4, f=beat%1; ex='giggle'; py+=4*f*(1-f)*0.12;
    aL=[q%2?0.4:2.4,q===3?1.1:0]; aR=[q%2?2.4:0.4,q===3?1.1:0]; rz=q%2?-0.15:0.15; ry=Math.sin(beat*Math.PI*0.5)*0.5; lL=q%2?-0.45:0; lR=q%2?0:-0.45; }
  else if (r==='knocked'){ ex='dizzy'; const e=t-J.kt, fall=Math.min(1,e/0.32), up=clampJ((e-1.25)/0.4,0,1); rz=J.kdir*1.45*fall*(1-up*up*(3-2*up)); aL=aR=[1.0,0]; if (e<0.32) py+=0.1*Math.sin(Math.PI*e/0.32); }
  else { if (vis.length<3) ex='shock'; }
  if (moving && r!=='knocked'){ const w=Math.sin(t*16); lL=w*0.7; lR=-lL; aL[1]-=w*0.5; aR[1]+=w*0.5; py+=Math.abs(w)*0.05; if (r==='idle') ry=Math.sign(target-J.x)*1.1; }
  const hp=t-J.hop; if (hp>=0&&hp<0.45){ py+=4*(hp/0.45)*(1-hp/0.45)*0.3; sy+=hp<0.08?-0.15:0; }
  o[CI['body.px']]=(J.x+SHIFT)*k*KX/K_UNIT; o[CI['body.py']]=py*k; o[CI['body.pz']]=-0.08*k;
  o[CI['body.ry']]=ry; o[CI['body.rz']]=rz; o[CI['body.rx']]=rx;
  o[CI['body.sy']]=sy*(jelly?1.3:1); o[CI['body.sx']]=0; o[CI['body.sz']]=0; o[CI['pivot.com']]=1;
  jArm(o,R,CI,'L',-1,aL[0],aL[1],jelly); jArm(o,R,CI,'R',1,aR[0],aR[1],jelly);
  jLeg(o,CI,'L',lL,jelly); jLeg(o,CI,'R',lR,jelly);
  o[CI['look.soot']]=Math.min(1,J.soot);
  Anim.setExprIx(s.ci, ex);
}
Anim.D.ext={ pre:B.pre, pose:B.pose };
Anim.D.manual=true;

/* ---------- props + particles mirror ---------- */
const GEOC={}, MATC=new Map(), live=new Map();
const tmpM=new T.Matrix4(), tmpM2=new T.Matrix4(), tq=new T.Quaternion(), tp=new T.Vector3(), ts=new T.Vector3(), eul=new T.Euler();
function geom(key){ if (GEOC[key]) return GEOC[key]; const g=Toy3D.geo(key), n=g.v.length/7, pos=new Float32Array(n*3), nor=new Float32Array(n*3);
  for (let i=0;i<n;i++){ pos.set(g.v.subarray(i*7,i*7+3),i*3); nor.set(g.v.subarray(i*7+3,i*7+6),i*3); }
  const bg=new T.BufferGeometry(); bg.setAttribute('position',new T.BufferAttribute(pos,3)); bg.setAttribute('normal',new T.BufferAttribute(nor,3)); bg.setIndex(new T.BufferAttribute(g.i,1));
  return GEOC[key]=bg; }
function mat(n){ const key=n.c.join(',')+'|'+n.e+'|'+(n.a<1?n.a.toFixed(2):1)+'|'+n.spec; let m=MATC.get(key); if (m) return m;
  const c=new T.Color().setRGB(n.c[0],n.c[1],n.c[2]).convertSRGBToLinear();
  m=new T.MeshStandardMaterial({color:c, roughness:Math.max(0.15,0.75-n.spec*0.55), metalness:n.spec>0.8?0.35:0.05, emissive:n.e?c:new T.Color(0), emissiveIntensity:n.e?1.3*n.e:0, transparent:n.a<1, opacity:n.a, depthWrite:n.a>=1});
  MATC.set(key,m); return m; }
function local(n,out){ eul.set(n.r[0],n.r[1],n.r[2],'YXZ'); tq.setFromEuler(eul); return out.compose(tp.set(n.p[0],n.p[1],n.p[2]), tq, ts.set(n.s[0],n.s[1],n.s[2])); }
const SCALE_K=new T.Matrix4();
function anchorFor(node, stg, ci0){ // v29 node → our anchor object (if it hangs off a character)
  for (const k of (stg===st2?[EX.curSlot]:SLOTS)){ const ch=stg.chars[k], n=ch.n, ci=stg===st2?ci0:KIX[CAST[k]], so=crew[ci].userData.sock;
    if (node===n.handR) return so.handR; if (node===n.handL) return so.handL; if (node===n.top) return so.headTop;
    if (node===n.back) return so.back; if (node===n.front) return so.face; if (node===ch.torso) return crew[ci].userData.body; }
  return null; }
const seen=new Set();
function walk(n, parentM, hiddenAnc){
  if (!n.vis) return;
  walkM(n, new T.Matrix4().multiplyMatrices(parentM, local(n,tmpM)), hiddenAnc);
}
function walkM(n, M, hiddenAnc){
  if (n.mesh && !n.mode){ let m=live.get(n); if (!m){ m=new T.Mesh(geom(n.mesh), mat(n)); m.matrixAutoUpdate=false; m.castShadow=false; scene.add(m); live.set(n,m); }
    m.material=mat(n); m.matrix.copy(M); m.matrixWorldNeedsUpdate=true; m.visible=!hiddenAnc; seen.add(n); }
  for (const kid of n.kids) walk(kid, M, hiddenAnc);
}
function syncProps(){
  seen.clear(); SCALE_K.makeScale(K_UNIT,K_UNIT,K_UNIT);
  for (const kid of st.props.kids){ if (!kid.vis) continue; const M0=new T.Matrix4().multiplyMatrices(SCALE_K, local(kid,tmpM)); M0.elements[12]=(M0.elements[12]+SHIFT*K_UNIT)*KX/K_UNIT; walkM(kid, M0, false); }
  // props held by characters
  const held=SLOTS.map(k=>[st,k,KIX[CAST[k]]]).concat(mixOn()?[[st2,EX.curSlot,KIX[extraKind()]]]:[]);
  for (const [stg,k,ci] of held){ const ch=stg.chars[k], hide=!!ch.P.hide;
    for (const node of [ch.n.handR,ch.n.handL,ch.n.top,ch.n.back,ch.n.front,ch.torso]){
      const extra=node.kids.filter(x=>stg.K && stg.K.made.includes(x)); if (!extra.length) continue;
      const an=anchorFor(node,stg,ci); an.updateWorldMatrix(true,false); an.matrixWorld.decompose(tp,tq,ts);
      const base=new T.Matrix4().compose(tp.clone(),tq.clone(),new T.Vector3(K_UNIT,K_UNIT,K_UNIT));
      for (const x of extra) walk(x, base, hide); } }
  for (const [n,m] of live) if (!seen.has(n)){ scene.remove(m); live.delete(n); }
}

/* ---------- speech bubble ---------- */
const pv=new T.Vector3();
function bubble(){ const now=performance.now(); let who=null, wc=null; for (const k of SLOTS){ const c=st.chars[k]; if (c._say && c._say.until>now){ who=KIX[CAST[k]]; wc=c._say; } }
  const s4 = mixOn() ? st2.chars[EX.curSlot]._say : J.say; if (!wc && s4 && s4.until>now){ who=KIX[extraKind()]; wc=s4; }
  const el=B.bubble; if (wc===null){ el.classList.remove('on'); return; }
  const ci=who; crew[ci].userData.sock.headTop.getWorldPosition(pv); pv.y+=0.25; pv.project(camera);
  if (el.textContent!==wc.t) el.textContent=wc.t;
  el.style.transform=`translate(${((pv.x+1)/2*innerWidth).toFixed(0)}px,${((1-pv.y)/2*innerHeight).toFixed(0)}px) translate(-50%,-100%)`; el.classList.add('on'); }

/* ---------- poke a character (5 pokes → pokeWar, like v29) ---------- */
const ray=new T.Raycaster(), mv=new T.Vector2();
function poke(e){ if (e.target.closest && e.target.closest('#ap,#apBtn')) return; mv.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); ray.setFromCamera(mv,camera);
  for (const k of SLOTS){ const ci=KIX[CAST[k]]; const hit=ray.intersectObject(crew[ci],true); if (hit.length){ const c=st.chars[k]; c.boing(); c.clicks++; clearTimeout(c._ct); c._ct=setTimeout(()=>c.clicks=0,2500);
      if (c.clicks>=5 && !st.scene){ c.clicks=0; B.play('pokeWar'); } return; } }
  const cx=KIX[extraKind()]; if (ray.intersectObject(crew[cx],true).length){ if (mixOn()) st2.chars[EX.curSlot].boing(); else { J.hop=Anim.D.now; jSfx('squeak'); } } }

/* deterministic screenshot mode: ?t=1&cs=sceneName&st=2.4 */
if (Pm.has('cs')){ const nm=Pm.get('cs'); let started=false; const op=B.pre; B.pre=Anim.D.ext.pre=(dt,t)=>{ if (!inited) init(); if (!started){ started=true; B.play(nm); } op(dt,t); }; }
})();

