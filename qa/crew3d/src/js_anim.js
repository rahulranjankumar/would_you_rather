/* =====================================================================
   ANIM — comedy animation layer for the crew, running on js/engine.js
   value = rest + idle*wIdle + action*wAction + secondary ; head += gaze*wGaze
   Clip content: keys, additive fns, step-planned walks, baked physics,
   IK reaches, char attachments, holds, slow-mo ramps, events, tick.
   Every clip gets an automatic, motivated Recover tail (get up → walk home
   with planted feet → turn → settle) that ends exactly on the rest pose.
   Made by PPA Warriors
   ===================================================================== */
const Anim = (() => {
const TEST = P.has('t');
const R = () => Math.random();                 // seeded in test mode (core.js)
const rr = (a,b) => a + R()*(b-a);
const clamp = (x,a,b) => x<a?a:x>b?b:x;
const TAU = Math.PI*2;

/* ---------------- easing ---------------- */
const E = {
  linear:u=>u, inQuad:u=>u*u, outQuad:u=>1-(1-u)*(1-u),
  inOutQuad:u=>u<.5?2*u*u:1-2*(1-u)*(1-u),
  inOutCubic:u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2,
  inOutSine:u=>-(Math.cos(Math.PI*u)-1)/2,
  outCubic:u=>1-Math.pow(1-u,3), outQuart:u=>1-Math.pow(1-u,4), outExpo:u=>u>=1?1:1-Math.pow(2,-10*u),
  inCubic:u=>u*u*u,
  outBack:u=>{ const s=1.70158, c=s+1; return 1+c*Math.pow(u-1,3)+s*Math.pow(u-1,2); },
  inBack:u=>{ const s=1.70158; return (s+1)*u*u*u - s*u*u; },
  outElastic:u=>{ if(u<=0) return 0; if(u>=1) return 1; const p=0.35; return Math.pow(2,-10*u)*Math.sin((u-p/4)*TAU/p)+1; },
  outBounce:u=>{ const n=7.5625, d=2.75; if(u<1/d) return n*u*u; if(u<2/d) return n*(u-=1.5/d)*u+0.75; if(u<2.5/d) return n*(u-=2.25/d)*u+0.9375; return n*(u-=2.625/d)*u+0.984375; },
  step:u=>u<1?0:1,
};

/* ---------------- channels ---------------- */
const LIMBS=['armL','armR','legL','legR'], LCH=['rz','rx','ry','mz','mx'];
const CH=['body.px','body.py','body.pz','body.rx','body.ry','body.rz','body.sy','body.sx','body.sz',
  'head.rx','head.ry','head.rz','head.sy','head.py'];
for (const l of LIMBS) for (const c of LCH) CH.push(l+'.'+c);
CH.push('tail.ry','tail.rz','tail.sx','earL.rx','earR.rx','earL.rz','earR.rz','handL.rz','handR.rz','gaze',
  'pivot.com','body.sink','look.soot','look.wet','look.frizz','look.spike','look.tint','look.poof');
const CI={}; CH.forEach((n,i)=>CI[n]=i); const NC=CH.length;
const KIND_IX={jelly:0,astro:1,muse:2,fox:3};
const ROT_CH = new Set(CH.filter(n=>/\.(r[xyz]|m[xz])$/.test(n)||n.startsWith('tail.r')||n.startsWith('ear')));

/* ---------------- arm pose library (absolute angles, side s=-1 left / +1 right) ---------------- */
const ARM={
  down:   s=>({rz:0.14*s, rx:0.05, mz:0.05*s, mx:-0.1}),
  up:     s=>({rz:2.75*s, rx:-0.15, mz:0.15*s, mx:0}),
  wide:   s=>({rz:1.35*s, rx:-0.25, mz:0.2*s, mx:-0.2}),
  wing:   s=>({rz:1.6*s, rx:0, mz:-0.35*s, mx:0}),
  mouth:  s=>({rz:-0.45*s, rx:-1.45, mz:-0.3*s, mx:-1.55}),
  hips:   s=>({rz:0.75*s, rx:0.2, mz:-1.7*s, mx:0}),
  cross:  s=>({rz:-0.55*s, rx:-1.25, mz:-0.4*s, mx:-1.5}),
  clap:   s=>({rz:-0.35*s, rx:-1.3, mz:-0.35*s, mx:-0.45}),
  reach:  s=>({rz:0.25*s, rx:-1.45, mz:0, mx:-0.1}),
  shrug:  s=>({rz:0.55*s, rx:-0.4, mz:1.15*s, mx:-0.6}),
  face:   s=>({rz:-0.35*s, rx:-1.85, mz:-0.2*s, mx:-1.65}),
  head:   s=>({rz:2.2*s, rx:-0.4, mz:1.2*s, mx:0}),
  mic:    s=>({rz:-0.2*s, rx:-1.25, mz:-0.2*s, mx:-1.35}),
  conduct:s=>({rz:1.0*s, rx:-1.1, mz:0.3*s, mx:-0.6}),
};

/* ---------------- clip ---------------- */
function Clip(id, dur, cast, o={}){
  return { id, dur, cast:cast.slice(), keys:{}, fns:[], events:[], locos:[], iks:[], phys:[], atts:[], holds:[], slow:[], feet:[],
    tick:null, tags:o.tags||[], w:o.w||1, micro:!!o.micro, reset:o.reset??1.2, castIx:[], last:{}, pos:{}, contentEnd:0 };
}
const bump=(c,t)=>{ if (t>c.contentEnd) c.contentEnd=t; };
const B = {
  key(c, who, ch, t, v, ease='inOutCubic'){ const k=who+':'+ch; (c.keys[k]||(c.keys[k]=[])).push([t,v,ease]); c.last[k]=v; bump(c,t); return c; },
  /* move channel from its held value to v over [t0,t1]; big rotations get an automatic opposite wind-up */
  to(c, who, ch, t0, t1, v, ease='inOutCubic', o={}){
    const k=who+':'+ch, cur=c.last[k]??0, d=v-cur, dur=t1-t0;
    B.key(c,who,ch,t0,cur,'step0');
    if (!o.noAntic && !c.noAntic && ROT_CH.has(ch) && Math.abs(d)>0.6 && dur>0.12 && dur<=0.8){
      B.key(c,who,ch,t0+dur*0.3,cur-0.12*d,'inOutQuad'); }
    B.key(c,who,ch,t1,v,ease); return c; },
  pulse(c, who, ch, t0, a, hold, rel, v, eIn='outBack', eOut='inOutCubic'){ B.to(c,who,ch,t0,t0+a,v,eIn,{noAntic:1}); B.to(c,who,ch,t0+a+hold,t0+a+hold+rel,0,eOut,{noAntic:1}); return c; },
  fn(c, who, ch, t0, t1, f){ c.fns.push({who, ch, t0, t1, f}); bump(c,t1); return c; },
  ev(c, t, ...a){ c.events.push([t, ...a]); return c; },
  arm(c, who, side, t0, t1, poseName, ease){
    ease = ease || Eng.PROF[who].ease;
    const s=side==='L'?-1:1, p=ARM[poseName](s), r=REST[who]['arm'+side];
    if (who==='jelly'){ B.to(c,who,'arm'+side+'.rz',t0,t1,clamp(p.rz*0.42,-1.05,1.05),ease); B.to(c,who,'arm'+side+'.rx',t0,t1,clamp(p.rx*0.4,-0.6,0.6),ease); return c; }
    for (const k of ['rz','rx','mz','mx']) B.to(c, who, 'arm'+side+'.'+k, t0, t1, p[k]-r[k], ease);
    return c;
  },
  armRest(c, who, side, t0, t1, ease='inOutCubic'){ for (const k of ['rz','rx','mz','mx']) B.to(c, who, 'arm'+side+'.'+k, t0, t1, 0, ease, {noAntic:1}); return c; },
  arms(c, who, t0, t1, poseName, ease){ B.arm(c,who,'L',t0,t1,poseName,ease); B.arm(c,who,'R',t0,t1,poseName,ease); return c; },
  armsRest(c, who, t0, t1, ease){ B.armRest(c,who,'L',t0,t1,ease); B.armRest(c,who,'R',t0,t1,ease); return c; },
  expr(c, t, who, name){ return B.ev(c, t, 'expr', who, name); },
  sfx(c, t, name, a){ return B.ev(c, t, 'sfx', name, a); },
  say(c, t, who, n, pitch){ return B.ev(c, t, 'say', who, n, pitch||1); },
  fx(c, t, name, who, a){ return B.ev(c, t, 'fx', name, who, a); },
  shake(c, t, amp=0.02){ return B.ev(c, t, 'shake', amp); },
  /* footwork: move foot L/R to world offset (dx,dz) from its home spot during [t0,t1] on a lift arc; planted otherwise */
  foot(c, who, side, t0, t1, dx, dz, lift=0.06){ const f=side==='L'?0:1; let tr=c.feet.find(x=>x.who===who&&x.f===f);
    if (!tr){ tr={who,f,segs:[],x:0,z:0,a:t0,b:t1}; c.feet.push(tr); }
    tr.segs.push({t0,t1,x0:tr.x,z0:tr.z,x1:dx,z1:dz,lift}); tr.x=dx; tr.z=dz; tr.a=Math.min(tr.a,t0); tr.b=Math.max(tr.b,t1); bump(c,t1); return c; },
  /* lock both feet to the floor for a window (twists, bounces, squats keep feet planted) */
  plant(c, who, t0, t1){ for (const f of [0,1]){ let tr=c.feet.find(x=>x.who===who&&x.f===f); if (!tr){ tr={who,f,segs:[],x:0,z:0,a:t0,b:t1}; c.feet.push(tr); } tr.a=Math.min(tr.a,t0); tr.b=Math.max(tr.b,t1); } bump(c,t1); return c; },
  /* hips follow the feet (body = average of both foot offsets) */
  hips(c, who, t0, t1, k=0.95){ const tl=()=>c.feet.filter(x=>x.who===who); const o0={x:0,z:0,l:0}, o1={x:0,z:0,l:0};
    const avg=(t,ax)=>{ const [a,b]=tl(); footOff(a,t,o0); if (b) footOff(b,t,o1); else {o1.x=o0.x;o1.z=o0.z;} return k*(ax?o0.z+o1.z:o0.x+o1.x)/2; };
    B.fn(c,who,'body.px',t0,t1,t=>avg(t,0)); B.fn(c,who,'body.pz',t0,t1,t=>avg(t,1)); return c; },
  beat(c, t0, n, bpm=120){ const bt=60/bpm; for (let i=0;i<n;i++){ const t=t0+i*bt; B.sfx(c,t,'kick'); B.sfx(c,t+bt/2,'hat'); if (i%2) B.sfx(c,t,'clap'); } return c; },
  /* comedy beat: the clip clock stops (characters stay alive via blink + breathing) */
  hold(c, t, dur){ c.holds.push([t,dur]); return c; },
};
/* slow-motion ramp (also pitches audio); multiple ramps multiply */
const Time = { ramp(c,t0,t1,scale){ c.slow.push([t0,t1,scale]); return c; } };
function clipScale(c,t){ let k=1; for (const [a,b,sc] of c.slow){ const e=Eng.sst(a,a+0.15,t)*(1-Eng.sst(b-0.15,b,t)); k*= 1+(sc-1)*e; } return k; }

/* ---------------- IK + attach + physics + locomotion front-ends ---------------- */
const IK = {
  reach:(c,who,limb,t0,t1,target,o)=>{ Eng.reach(c,who,limb,t0,t1,target,o); bump(c,t1); return c; },
  sock:(who,name,ox,oy,oz)=>Eng.IKT.sock(who,name,ox,oy,oz), point:(x,y,z)=>Eng.IKT.point(x,y,z), obj:(o,x,y,z)=>Eng.IKT.obj(o,x,y,z),
};
const Attach = {
  /* parent `who`'s body to `toWho`'s socket with spring lag; detaches back to own channels without pops */
  char(c, t0, t1, who, toWho, sock, o={}){ c.atts.push({ci:KIND_IX[who], who, to:toWho, sock, t0, t1, off:o.offset||[0,0,0], lag:o.lag??1, a:o.a??0.12}); bump(c,t1); return c; },
};
function holdPos(c, who, dx, dz, t1){                // persist a root-motion delta after its window
  const kx=who+':body.px', kz=who+':body.pz', bx=c.last[kx]??0, bz=c.last[kz]??0;
  B.key(c,who,'body.px',t1,bx,'step0'); B.key(c,who,'body.px',t1+1e-4,bx+dx,'step0');
  B.key(c,who,'body.pz',t1,bz,'step0'); B.key(c,who,'body.pz',t1+1e-4,bz+dz,'step0');
}
const Loco = {
  /* walk along world-offset points with planted feet; returns the plan (pl.t1 = end time) */
  walk(c, who, t0, pts, o={}){
    const bx=c.last[who+':body.px']??0, bz=c.last[who+':body.pz']??0;
    const P=[[bx,bz], ...pts.map(p=>[p[0],p[1]])];
    const yawNow=c.last[who+':body.ry']??0;
    const pl=Eng.planWalk(who, t0, P, {...o, startYaw:o.startYaw??yawNow, endYaw:o.endYaw??yawNow});
    if (yawNow){ B.key(c,who,'body.ry',t0,yawNow,'step0'); B.key(c,who,'body.ry',t0+1e-4,0,'step0'); }   // loco owns yaw in its window
    pl.base=[bx,bz]; c.locos.push(pl);
    const end=P[P.length-1]; holdPos(c,who,end[0]-bx,end[1]-bz,pl.t1);
    if (o.endYaw!==undefined && o.endYaw){ B.key(c,who,'body.ry',pl.t1,0,'step0'); B.key(c,who,'body.ry',pl.t1+1e-4,o.endYaw,'step0'); }
    c.pos[who]=end; bump(c,pl.t1); return pl;
  },
};
const Phys = {
  /* ballistic launch from the current spot; v/spin in world units, baked at 120 Hz */
  launch(c, who, t, o){
    const bk=Eng.bake(who,o), ci=KIND_IX[who], pr=Eng.PROF[who];
    c.phys.push({ci, who, t0:t, bk, upright:o.upright!==false});
    const e=bk.end, tEnd=t+bk.settled;
    holdPos(c,who,e[0],e[2],tEnd);
    if (e[1]>0.001){ const k=who+':body.py', b=c.last[k]??0; B.key(c,who,'body.py',tEnd,b,'step0'); B.key(c,who,'body.py',tEnd+1e-4,b+e[1],'step0'); }
    if (o.upright===false){ for (const [ch,v] of [['body.rx',e[3]],['body.ry',e[4]],['body.rz',e[5]]]) if (Math.abs(v)>1e-4){ const k=who+':'+ch, b=c.last[k]??0; B.key(c,who,ch,tEnd,b,'step0'); B.key(c,who,ch,tEnd+1e-4,b+v,'step0'); } }
    for (const im of bk.imp){ const ti=t+im.t, sq=clamp(im.vy*0.11,0.04,0.35);
      B.fn(c,who,'body.sy',ti,ti+0.7,tt=>-sq*Math.exp(-(tt-ti)*7)*Math.cos((tt-ti)*17));
      B.sfx(c,ti,pr.impact,im.vy); if (im.vy>1.5) B.fx(c,ti,'dust',who); if (im.vy>2.5) B.shake(c,ti,Math.min(0.03,im.vy*0.006)); }
    bump(c,tEnd); return tEnd;
  },
  /* land exactly at world offset (x,z) after T seconds */
  arc(c, who, t, x, z, T, o={}){
    const bx=c.last[who+':body.px']??0, bz=c.last[who+':body.pz']??0;
    const v=Eng.solveArc(x-bx, z-bz, T); return Phys.launch(c,who,t,{v, spin:o.spin, bounce:o.bounce??0.0, maxBounce:o.maxBounce??1, until:T+1, upright:o.upright});
  },
};

/* -------- motion helpers (anticipation → action → overshoot → settle) -------- */
const H = {
  /* compatibility: walk to (x,z) offset within [t0,t1] (planner may extend if too fast for planted feet) */
  waddle(c, who, t0, t1, x, z, o={}){ return Loco.walk(c, who, t0, [[x,z]], {...o, dur:t1-t0}).t1; },
  walk(c, who, t0, x, z, o={}){ return Loco.walk(c, who, t0, [[x,z]], o).t1; },
  hop(c, who, t, h=0.15, dur=0.42, o={}){
    const ta=t-0.1;
    B.fn(c,who,'body.sy',ta,t,tt=>-0.16*E.outQuad((tt-ta)/0.1));                       // anticipation squash
    if (o.arms!==false && who!=='jelly'){ B.fn(c,who,'armL.rz',ta,t+dur,tt=>tt<t?0.25*((tt-ta)/0.1):-0.9*Math.sin(Math.PI*clamp((tt-t)/dur,0,1)));
                         B.fn(c,who,'armR.rz',ta,t+dur,tt=>tt<t?-0.25*((tt-ta)/0.1):0.9*Math.sin(Math.PI*clamp((tt-t)/dur,0,1))); }
    if (o.knees!==false && who!=='jelly'){ for (const l of ['legL','legR']) B.fn(c,who,l+'.mx',ta,t+0.1,tt=>0.5*Math.sin(Math.PI*clamp((tt-ta)/0.2,0,1))); }
    if (o.sfx!==false) B.sfx(c,t,'boing',h);
    return Phys.launch(c, who, t, {v:[o.vx||0, Math.sqrt(2*Eng.G*h), o.vz||0], maxBounce:o.bounces??1, bounce:o.bounce, until:2});
  },
  look(c, who, t0, t1, yaw, pitch=0, ease='outBack'){ B.to(c,who,'head.ry',t0,t1,yaw,ease,{noAntic:1}); if (pitch!==null) B.to(c,who,'head.rx',t0,t1,pitch,ease,{noAntic:1}); return c; },
  doubleTake(c, who, t, yaw){
    H.look(c,who,t,t+0.15,yaw,0,'outQuad'); H.look(c,who,t+0.3,t+0.45,0,0,'inOutCubic');
    B.expr(c,t+0.66,who,'shock');                                                   // face reacts 2–3 frames before the body
    H.look(c,who,t+0.7,t+0.78,yaw*1.15,-0.12,'outBack');
    H.hop(c,who,t+0.74,0.05,0.22,{arms:false,sfx:false}); B.sfx(c,t+0.72,'pop');
    return c;
  },
  giggle(c, who, t, dur=1.6, o={}){
    B.expr(c,t,who,'giggle'); B.say(c,t+0.05,who,Math.round(dur*6),1.25);
    if (who!=='jelly'){ B.arm(c,who,'R',t,t+0.2,'mouth'); if (o.both) B.arm(c,who,'L',t,t+0.2,'mouth'); }
    B.fn(c,who,'body.sy',t,t+dur,tt=>0.03*Math.sin(TAU*12*(tt-t)) * Math.min(1,(t+dur-tt)/0.2));
    B.fn(c,who,'head.rx',t,t+dur,tt=>0.12*Math.min(1,(tt-t)/0.15)*Math.min(1,(t+dur-tt)/0.2)+0.03*Math.sin(TAU*6*(tt-t)));
    if (dur>2 && !o.noFall) B.pulse(c,who,'body.rx',t+1.6,0.4,dur-2.2,0.3,-0.35,'outBack');
    if (o.back!==false){ if (who!=='jelly'){ B.armRest(c,who,'R',t+dur,t+dur+0.3); if (o.both) B.armRest(c,who,'L',t+dur,t+dur+0.3);} B.expr(c,t+dur+0.1,who,'neutral'); }
    return c;
  },
  /* panic run: arms up flailing, lean, scared face — feet planted by the step planner */
  panic(c, who, t0, t1, x, z){
    B.expr(c,t0-0.05,who,'scared'); B.say(c,t0,who,Math.round((t1-t0)*5),1.4);
    const pl=Loco.walk(c,who,t0,[[x,z]],{style:who==='jelly'?'run':'panic', dur:t1-t0});
    if (who!=='jelly'){ B.arms(c,who,t0,t0+0.12,'up','outQuad');
      B.fn(c,who,'armL.rx',t0,pl.t1,t=>0.6*Math.sin(TAU*9*(t-t0))); B.fn(c,who,'armR.rx',t0,pl.t1,t=>-0.6*Math.sin(TAU*9*(t-t0)+1));
      B.to(c,who,'body.rx',t0,t0+0.12,0.15,'outQuad',{noAntic:1}); B.to(c,who,'body.rx',pl.t1-0.1,pl.t1,0,'inOutCubic',{noAntic:1}); }
    return pl.t1;
  },
  /* faint: freeze → dizzy → topple over the outer foot edge (pivot-correct) → land squash → stars */
  faint(c, who, t, side=1, hold=1.2){
    B.expr(c,t+0.25,who,'dizzy');
    B.to(c,who,'body.rz',t+0.3,t+0.8,1.4*side,'inQuad',{noAntic:1});
    B.fn(c,who,'body.sy',t+0.8,t+1.3,tt=>-0.18*Math.exp(-(tt-t-0.8)*7)*Math.cos((tt-t-0.8)*20));
    B.sfx(c,t+0.8,Eng.PROF[who].impact,2); B.fx(c,t+0.85,'stars',who,hold+0.6); B.fx(c,t+0.8,'dust',who); B.shake(c,t+0.8,0.012);
    return c;
  },
  /* splat on the 4th wall: lunge on an arc, flatten, squeaky slide, peel off */
  splat(c, who, t, z=0.6){
    const bx=c.last[who+':body.px']??0;
    Phys.arc(c,who,t-0.15,bx,z,0.3,{bounce:0});
    B.sfx(c,t+0.15,'splat');
    B.pulse(c,who,'body.sz',t+0.15,0.04,1.45,0.25,-0.45,'outQuad');
    B.pulse(c,who,'body.sx',t+0.15,0.04,1.45,0.25,0.3,'outQuad');
    B.sfx(c,t+0.5,'squeak');
    Loco.walk(c,who,t+1.75,[[bx,z-0.35]],{dur:0.5});
    return c;
  },
  shiver(c, who, t, dur, amp=0.015){ B.fn(c,who,'body.rz',t,t+dur,tt=>amp*Math.sin(TAU*17*(tt-t))*Math.sin(Math.PI*(tt-t)/dur)); return c; },
  nod(c, who, t, n=1, a=0.18){ for (let i=0;i<n;i++) B.pulse(c,who,'head.rx',t+i*0.36,0.12,0.04,0.18,a,'outQuad'); return c; },
};


/* rest snapshot per kind (filled at init) */
const REST={};

/* ---------------- secondary springs ---------------- */
function Spring(k,c){ return {x:0,v:0,k,c}; }
function stepSpring(s, target, dt){
  const n = dt>1/60 ? Math.ceil(dt*60) : 1, h=dt/n;
  for (let i=0;i<n;i++){ const a=s.k*(target-s.x)-s.c*s.v; s.v+=a*h; s.x+=s.v*h; }
  return s.x;
}

/* ---------------- sprite textures ---------------- */
function canvasTex(w,h,draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new T.CanvasTexture(cv); t.encoding=T.sRGBEncoding; return t; }
const TEX = {
  heart: canvasTex(64,64,(g)=>{ g.fillStyle='#ff4f7b'; g.beginPath(); g.moveTo(32,56); g.bezierCurveTo(2,34,6,8,32,20); g.bezierCurveTo(58,8,62,34,32,56); g.fill();
    g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(21,23,6,4,-0.6,0,TAU); g.fill(); }),
  star: canvasTex(64,64,(g)=>{ g.fillStyle='#ffd34a'; g.beginPath(); for(let i=0;i<10;i++){ const r=i%2?11:28, a=-Math.PI/2+i*Math.PI/5; g.lineTo(32+r*Math.cos(a),32+r*Math.sin(a)); } g.fill(); }),
  zzz: canvasTex(128,64,(g)=>{ g.fillStyle='#e8f2ff'; g.font='bold 40px sans-serif'; g.fillText('z',10,56); g.font='bold 30px sans-serif'; g.fillText('z',50,38); g.font='bold 22px sans-serif'; g.fillText('z',84,22); }),
  puff: canvasTex(64,64,(g)=>{ const gr=g.createRadialGradient(32,32,2,32,32,30); gr.addColorStop(0,'rgba(235,228,220,.9)'); gr.addColorStop(1,'rgba(235,228,220,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); }),
  sweat: canvasTex(32,48,(g)=>{ g.fillStyle='#9fe4ff'; g.beginPath(); g.moveTo(16,2); g.quadraticCurveTo(30,30,16,44); g.quadraticCurveTo(2,30,16,2); g.fill(); }),
  ring: canvasTex(64,64,(g)=>{ g.strokeStyle='rgba(200,240,255,.9)'; g.lineWidth=4; g.beginPath(); g.arc(32,32,26,0,TAU); g.stroke(); }),
};
function sprite(tex, s, layer=1){ const m=new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthWrite:false})); m.scale.set(s,s,s); m.visible=false; m.renderOrder=90; if (layer) m.layers.set(layer); scene.add(m); return m; }

/* ---------------- runtime state ---------------- */
let crew=null, S=[], ctx=null;
const D = { mode:'idle', clip:null, ct:0, ending:false, stopBlend:0, stopT:0, hist:[], cbs:[], nextScene:0, nextMicro:0, now:0,
  waitIdle:0, clips:{}, scenes:[], micros:[], forceGaze:false };
const tmpV=new T.Vector3(), tmpV2=new T.Vector3();

/* ---------------- props ---------------- */
const PROPS={};
function buildProps(){
  const gold=phys({color:0xffc83d, metalness:1, roughness:0.22, clearcoat:0.6, envMapIntensity:1.6});
  const dark=stdMat(0x22252b,0.45,0.4), white=stdMat(0xf4f4f4,0.5), red=stdMat(0xff2030,0.35,0,{emissive:0xff0010, emissiveIntensity:0});
  const mk=(o)=>{ o.visible=false; o.traverse(m=>m.layers&&m.layers.set(0)); scene.add(o); return o; };
  // siren dome + the ONE extra light in the scene
  const siren=new T.Group(); siren.add(new T.Mesh(new T.SphereGeometry(0.07,24,16,0,TAU,0,Math.PI/2),red));
  const sb=new T.Mesh(new T.CylinderGeometry(0.075,0.08,0.03,24),dark); sb.position.y=-0.01; siren.add(sb);
  PROPS.siren=mk(siren); PROPS.sirenMat=red;
  PROPS.light=new T.PointLight(0xff2a2a,0,4,1.6); scene.add(PROPS.light);
  // crown
  const crown=new T.Group(); crown.add(new T.Mesh(new T.CylinderGeometry(0.11,0.1,0.07,28,1,true),gold));
  for (let i=0;i<6;i++){ const sp=new T.Mesh(new T.ConeGeometry(0.022,0.07,10),gold); const a=i/6*TAU; sp.position.set(Math.cos(a)*0.105,0.065,Math.sin(a)*0.105); crown.add(sp);
    const gem=sph(0.012,stdMat([0xff3355,0x33aaff,0x44ff88][i%3],0.1,0.2),8); gem.position.set(Math.cos(a)*0.11,0.0,Math.sin(a)*0.11); crown.add(gem); }
  PROPS.crown=mk(crown);
  // mic
  const mic=new T.Group(); const head=sph(0.04,stdMat(0x3a3f47,0.35,0.7),16); head.position.y=0.11; mic.add(head);
  const hnd=new T.Mesh(new T.CylinderGeometry(0.016,0.012,0.13,14),dark); hnd.position.y=0.04; mic.add(hnd); PROPS.mic=mk(mic);
  // megaphone (also the "decaf spray")
  const meg=new T.Group(); const cone=new T.Mesh(new T.CylinderGeometry(0.08,0.025,0.2,24,1,true),stdMat(0xff7a1a,0.4,0,{side:T.DoubleSide})); cone.rotation.x=Math.PI/2; cone.position.z=0.1; meg.add(cone);
  const grip=new T.Mesh(new T.CylinderGeometry(0.014,0.014,0.07,10),dark); grip.position.set(0,-0.04,0.02); meg.add(grip); PROPS.megaphone=mk(meg);
  // feather
  const fg=new T.SphereGeometry(1,16,12); fg.scale(0.03,0.14,0.006); const feather=new T.Group(); const fm=new T.Mesh(fg,stdMat(0xff9fd0,0.8)); fm.position.y=0.12; fm.rotation.z=0.2; feather.add(fm);
  const quill=new T.Mesh(new T.CylinderGeometry(0.003,0.003,0.28,6),white); quill.position.y=0.12; feather.add(quill); PROPS.feather=mk(feather);
  // coffee mug
  const mug=new T.Group(); mug.add(new T.Mesh(new T.CylinderGeometry(0.05,0.045,0.11,20),stdMat(0xffffff,0.3)));
  const hd=new T.Mesh(new T.TorusGeometry(0.03,0.008,8,16),stdMat(0xffffff,0.3)); hd.position.x=0.055; mug.add(hd); PROPS.mug=mk(mug);
  // pooled sprites / particles (layer 1 => skipped in reflection + low quality)
  PROPS.hearts=[...Array(8)].map(()=>sprite(TEX.heart,0.12));
  PROPS.stars=[...Array(8)].map(()=>sprite(TEX.star,0.1));
  PROPS.sweat=[...Array(4)].map(()=>sprite(TEX.sweat,0.07));
  PROPS.zzz=sprite(TEX.zzz,0.28);
  PROPS.dust=[...Array(6)].map(()=>sprite(TEX.puff,0.3));
  PROPS.ring=sprite(TEX.ring,0.25);
  // confetti: one InstancedMesh, 150 quads, ballistic (pure function of time → deterministic & scrubbable)
  const cg=new T.PlaneGeometry(0.03,0.018); const cm=new T.MeshBasicMaterial({side:T.DoubleSide, toneMapped:false});
  const conf=new T.InstancedMesh(cg,cm,150); conf.layers.set(1); conf.visible=false; conf.frustumCulled=false; scene.add(conf);
  const pal=[0xff4f7b,0xffd34a,0x4fd6ff,0x7dff8a,0xb77bff,0xff8a3d]; const col=new T.Color();
  PROPS.confData=new Float32Array(150*6);
  for (let i=0;i<150;i++){ col.setHex(pal[i%pal.length]); conf.setColorAt(i,col);
    const a=R()*TAU, sp=rr(0.6,1.8); const d=PROPS.confData; d[i*6]=Math.cos(a)*sp*0.6; d[i*6+1]=rr(2.6,4.2); d[i*6+2]=Math.sin(a)*sp*0.35; d[i*6+3]=rr(4,12); d[i*6+4]=R()*TAU; d[i*6+5]=rr(0.6,1); }
  PROPS.confetti=conf; PROPS.confMat=new T.Matrix4(); PROPS.confQ=new T.Quaternion(); PROPS.confE=new T.Euler(); PROPS.confS=new T.Vector3(1,1,1); PROPS.confP=new T.Vector3();
}
/* attach helper: parent prop to a node (no allocation besides Object3D bookkeeping) */
function attach(prop, parent, x=0,y=0,z=0, rx=0,ry=0,rz=0){ if (prop.parent!==parent) parent.add(prop); prop.position.set(x,y,z); prop.rotation.set(rx,ry,rz); prop.visible=true; prop.scale.setScalar(1); }
function detach(prop){ if (!prop) return; prop.visible=false; if (prop.parent!==scene) scene.add(prop); }
function hideAllProps(){ for (const k of ['siren','crown','mic','megaphone','feather','mug']) detach(PROPS[k]); PROPS.light.intensity=0; PROPS.sirenMat.emissiveIntensity=0; }

/* ---------------- effects (pooled, pure functions of time since spawn) ---------------- */
const FX=[]; // {name, who, t0, dur, ox,oy,oz, n}
function spawnFx(name, who, a){
  const ci=KIND_IX[who]; let f=FX.find(x=>!x.on);
  if (!f){ f={}; FX.push(f); }
  f.on=true; f.name=name; f.ci=ci; f.t0=D.now; f.a=a;
  f.dur = name==='stars'?(a||1.6) : name==='hearts'?2.2 : name==='zzz'?(a||1.6) : name==='confetti'?2.5 : name==='dust'?0.9 : name==='sweat'?1.2 : name==='ring'?0.6 : 1.5;
  if (ci!==undefined){ crew[ci].userData.head.getWorldPosition(tmpV); f.ox=tmpV.x; f.oy=tmpV.y; f.oz=tmpV.z; crew[ci].userData.body.getWorldPosition(tmpV2); f.bx=tmpV2.x; f.bz=tmpV2.z; }
  else { f.ox=a?.[0]||0; f.oy=a?.[1]||0.8; f.oz=a?.[2]||0.3; f.bx=f.ox; f.bz=f.oz; }
}
function updateFx(){
  for (const s of PROPS.hearts) s.visible=false; for (const s of PROPS.stars) s.visible=false; for (const s of PROPS.sweat) s.visible=false;
  for (const s of PROPS.dust) s.visible=false; PROPS.zzz.visible=false; PROPS.ring.visible=false;
  let hi=0, si=0, wi=0, di=0, confOn=false;
  for (const f of FX){ if (!f.on) continue; const age=D.now-f.t0; if (age>f.dur||age<0){ f.on=false; continue; }
    const u=age/f.dur;
    let hx=f.ox, hy=f.oy, hz=f.oz;
    if (f.ci!==undefined){ crew[f.ci].userData.head.getWorldPosition(tmpV); hx=tmpV.x; hy=tmpV.y; hz=tmpV.z; }
    if (f.name==='stars'){ for (let k=0;k<3&&si<8;k++,si++){ const s=PROPS.stars[si], a=age*5+k*TAU/3; s.visible=true; s.position.set(hx+Math.cos(a)*0.3, hy+0.3+Math.sin(age*7+k)*0.03, hz+Math.sin(a)*0.18); s.material.opacity=Math.min(1,(1-u)*4); s.material.rotation=age*3; } }
    else if (f.name==='hearts'){ const n=f.a||3; for (let k=0;k<n&&hi<8;k++,hi++){ const s=PROPS.hearts[hi], uu=clamp(u*1.2-k*0.12,0,1); s.visible=uu>0; s.position.set(hx+(k-(n-1)/2)*0.16+Math.sin(age*3+k)*0.04, hy+0.25+uu*0.55, hz+0.1); const sc=0.13*(0.6+0.4*Math.sin(age*9+k))*E.outBack(Math.min(1,uu*4)); s.scale.set(sc,sc,sc); s.material.opacity=Math.min(1,(1-uu)*3); } }
    else if (f.name==='zzz'){ const s=PROPS.zzz; s.visible=true; s.position.set(hx+0.3+u*0.15, hy+0.25+u*0.3, hz); s.material.opacity=Math.sin(Math.PI*u); }
    else if (f.name==='sweat'){ for (let k=0;k<2&&wi<4;k++,wi++){ const s=PROPS.sweat[wi]; s.visible=true; s.position.set(hx+(k?0.3:-0.3), hy+0.15-u*0.25, hz+0.1); s.material.opacity=1-u; } }
    else if (f.name==='dust'){ for (let k=0;k<6&&di<6;k++,di++){ const s=PROPS.dust[di], a=k/6*TAU; s.visible=true; const r=0.15+u*0.5; s.position.set(f.bx+Math.cos(a)*r, 0.06+u*0.12, f.bz+Math.sin(a)*r*0.6); const sc=0.2+u*0.35; s.scale.set(sc,sc,sc); s.material.opacity=(1-u)*0.8; } }
    else if (f.name==='ring'){ const s=PROPS.ring; s.visible=true; s.position.set(f.ox,f.oy,f.oz); const sc=0.1+u*0.4; s.scale.set(sc,sc,sc); s.material.opacity=1-u; }
    else if (f.name==='confetti'){ confOn=true; updateConfetti(age, f.ox, f.oy, f.oz); }
  }
  PROPS.confetti.visible=confOn;
}
function updateConfetti(age, ox, oy, oz){
  const d=PROPS.confData, m=PROPS.confMat, q=PROPS.confQ, e=PROPS.confE, s=PROPS.confS, p=PROPS.confP;
  const n = D.lowQ ? 75 : 150; PROPS.confetti.count=n;
  for (let i=0;i<n;i++){ const t=age; const drag=Math.min(t,1.1);
    p.set(ox+d[i*6]*t, oy+d[i*6+1]*drag-4.9*drag*drag*0.8 - Math.max(0,t-1.1)*0.45, oz+d[i*6+2]*t);
    if (p.y<0.005) p.y=0.005;
    e.set(d[i*6+4]+t*d[i*6+3], t*d[i*6+3]*0.7, 0); q.setFromEuler(e); s.setScalar(d[i*6+5]*(t<2.2?1:Math.max(0,(2.5-t)/0.3)));
    m.compose(p,q,s); PROPS.confetti.setMatrixAt(i,m); }
  PROPS.confetti.instanceMatrix.needsUpdate=true;
}

/* ---------------- audio: original WebAudio gibberish + sfx ---------------- */
const Audio_ = (() => {
  let ac=null, master=null, muted=false, noiseBuf=null;
  const PITCH={jelly:520, astro:380, muse:260, fox:450};
  const VOW=[[800,1150],[400,1600],[350,2300],[450,800],[325,700]];
  function init(){ if (ac||TEST) return; try{ ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=muted?0:0.35; master.connect(ac.destination);
    noiseBuf=ac.createBuffer(1,ac.sampleRate*0.5,ac.sampleRate); const d=noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }catch(e){ ac=null; } }
  addEventListener('pointerdown',init,{once:false}); addEventListener('keydown',e=>{ init(); if (e.key==='m'||e.key==='M') toggle(); });
  function toggle(){ muted=!muted; if (master) master.gain.value=muted?0:0.35; const b=document.getElementById('muteBtn'); if (b) b.textContent=muted?'🔇':'🔊'; return muted; }
  function env(g,t,a,d,v){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
  function syl(who,t,f,len){
    const o1=ac.createOscillator(), o2=ac.createOscillator(), g=ac.createGain(), v=VOW[(Math.random()*5)|0];
    o1.type='sawtooth'; o2.type='sine'; o1.frequency.setValueAtTime(f,t); o2.frequency.setValueAtTime(f*1.005,t);
    o1.frequency.linearRampToValueAtTime(f*(0.9+Math.random()*0.25),t+len);
    const b1=ac.createBiquadFilter(), b2=ac.createBiquadFilter(); b1.type=b2.type='bandpass'; b1.frequency.value=v[0]; b2.frequency.value=v[1]; b1.Q.value=6; b2.Q.value=8;
    const mix=ac.createGain(); mix.gain.value=0.7; o1.connect(b1); o1.connect(b2); b1.connect(mix); b2.connect(mix); o2.connect(mix);
    let out=mix; if (who==='astro'){ const ws=ac.createWaveShaper(), c=new Float32Array(256); for(let i=0;i<256;i++){ const x=i/128-1; c[i]=Math.round(x*6)/6; } ws.curve=c; mix.connect(ws); out=ws; }
    out.connect(g); g.connect(master); env(g,t,0.015,len,0.5); o1.start(t); o2.start(t); o1.stop(t+len+0.05); o2.stop(t+len+0.05);
  }
  function say(who,n,pm=1){ if (!ac||muted) return; let t=ac.currentTime+0.01; const base=PITCH[who]*pm;
    for (let i=0;i<n;i++){ const len=0.1+Math.random()*0.06; syl(who,t,base*(0.85+Math.random()*0.3),len); t+=1/7*(0.85+Math.random()*0.3); } }
  function tone(type,f0,f1,dur,v=0.4){ const o=ac.createOscillator(), g=ac.createGain(); o.type=type; const t=ac.currentTime; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); o.connect(g); g.connect(master); env(g,t,0.01,dur,v); o.start(t); o.stop(t+dur+0.05); }
  function noise(dur,fc,v=0.5){ const s=ac.createBufferSource(); s.buffer=noiseBuf; const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc; const g=ac.createGain(); s.connect(f); f.connect(g); g.connect(master); env(g,ac.currentTime,0.005,dur,v); s.start(); s.stop(ac.currentTime+dur+0.05); }
  function sfx(name,a){ if (!ac||muted) return;
    switch(name){
      case 'boing': tone('sine',180,520+(a||0)*800,0.25,0.35); break;
      case 'pop': tone('sine',900,1800,0.06,0.35); break;
      case 'squeak': tone('square',1300,1700,0.5,0.06); break;
      case 'thunk': noise(0.18,400,0.7); tone('sine',120,50,0.15,0.4); break;
      case 'splat': noise(0.12,1200,0.5); tone('sine',300,90,0.12,0.3); break;
      case 'siren': for (let i=0;i<(a||4);i++){ setTimeout(()=>tone('triangle',i%2?620:880,i%2?600:860,0.45,0.18),i*500); } break;
      case 'hiyah': say('astro',2,1.5); break;
      case 'clink': tone('triangle',2400,2200,0.2,0.2); break;
      case 'wee': tone('sine',700,1400,0.5,0.2); break;
      case 'clank': { const v=Math.min(1,(a||1)/3); tone('square',900+400*v,620,0.09,0.12*v+0.05); tone('triangle',1800,1500,0.25,0.08*v+0.03); } break;
      case 'bloop': { const v=Math.min(1,(a||1)/3); tone('sine',420+200*v,140,0.18,0.25*v+0.1); } break;
      case 'thud': { const v=Math.min(1,(a||1)/3); noise(0.12,300,0.4*v+0.15); tone('sine',110,45,0.14,0.3*v+0.1); } break;
      case 'whoosh': noise(0.35,1800,0.18); break;
      case 'drone': tone('sawtooth',55,52,1.6,0.06); break;
      case 'kick': tone('sine',150,45,0.16,0.5); break;
      case 'hat': noise(0.04,9000,0.08); break;
      case 'clap': noise(0.09,2500,0.22); break;
      case 'scratch': tone('sawtooth',300,900,0.12,0.12); setTimeout(()=>tone('sawtooth',900,250,0.12,0.12),120); break;
    } }
  return {say, sfx, toggle, init};
})();

/* ---------------- expressions ---------------- */
const EXPR=['neutral','shock','giggle','love','smug','scared','dizzy','embarrassed'];
function setExpr(ci, name){ const s=S[ci]; if (s.expr===name) return; s.expr=name; s.exprT=D.now;
  if (s.kind==='fox' && (name==='shock'||name==='scared')) s.earKick=1;
  if (name==='love') spawnFx('hearts', s.kind, s.kind==='muse'?4:3);
}
function applyExpr(ci, t){
  const s=S[ci], u=s.u, f=u.face, ex=s.expr, pop=E.outBack(clamp((D.now-s.exprT)/0.08,0,1));
  const k=s.kind;
  let eyeS=1, eyeSy=1, eyeL=1, eyeR=1, dizzy=false, poof=0;
  if (ex==='shock'){ eyeS=1+0.35*pop; poof=0.5; }
  else if (ex==='giggle'){ eyeSy=0.35; }
  else if (ex==='smug'){ eyeL=0.35; }
  else if (ex==='scared'){ eyeS=0.8; poof=0.35; }
  else if (ex==='dizzy'){ dizzy=true; }
  else if (ex==='embarrassed'){ eyeS=0.7; }
  s.poofT = k==='muse'||k==='fox' ? poof : 0;
  if (k==='jelly'){
    f.mouth.visible = ex!=='shock' && ex!=='giggle' && ex!=='scared';
    f.mouthO.visible = ex==='shock'||ex==='scared'; f.mouthO.scale.setScalar(ex==='scared'?0.6:pop);
    f.mouthWide.visible = ex==='giggle';
  }
  if (k==='astro'){
    const ie=u.innerEyes; const love=ex==='love';
    f.smile.visible = !(ex==='shock'||ex==='scared'||ex==='embarrassed'); f.smileO.visible = ex==='shock'||ex==='scared';
    for (let i=0;i<2;i++){ const d=ie[i]; const caret = ex==='giggle';
      f.carets[i].visible=caret; d.visible=!caret;
      let sc = ex==='shock'?1+0.6*pop : ex==='embarrassed'?0.6 : love?1.4+0.15*Math.sin(t*12) : 1;
      d.scale.set(sc*(ex==='smug'&&i===0?1.4:1), sc*(ex==='smug'&&i===0?0.25:1)*s.blinkMul, 0.4*sc);
      if (ex==='dizzy'){ d.position.x=(i?0.07:-0.07)+Math.cos(t*10*(i?1:-1))*0.015; d.position.y=0.025+Math.sin(t*10*(i?1:-1))*0.015; } }
    f.faceM.color.setHex(love?0xb0103a : ex==='scared'?0x2a1000 : 0x6b2a00);
    u.innerFace.position.y = -0.01 + (ex==='scared'? -0.02 : ex==='embarrassed'? -0.012 : 0);
  }
  if (k==='fox'){
    const open = ex==='shock'||ex==='scared'||ex==='dizzy'||ex==='embarrassed';
    f.arcs[0].visible = !open; f.arcs[1].visible = !open && ex!=='smug';
    f.openEyes[0].visible = open; f.openEyes[1].visible = open || ex==='smug';
    f.tongue.scale.set(1, ex==='giggle'?0.6*1.6:0.6, 0.5); f.tongue.position.y = ex==='giggle'?-0.145:-0.13;
  }
  if ((k==='muse'||k==='fox') && f.blushes){ const op = ex==='giggle'?1.6 : ex==='love'?2.2 : ex==='embarrassed'?2.0 : 1;
    for (const b of f.blushes){ b.scale.setScalar(0.85+0.15*op); b.material.opacity=Math.min(1,0.55*op); } }
  // real eyes: scale + blink, dizzy spin overrides aim
  const eyes = k==='fox' ? f.openEyes : u.eyes;
  for (let i=0;i<eyes.length;i++){ const e=eyes[i]; const side=i?eyeR:eyeL;
    e.scale.set(eyeS, eyeS*eyeSy*side*s.blinkMul, eyeS);
    if (dizzy){ e.userData.ball.rotation.set(Math.sin(t*9*(i?1:-1))*0.45, Math.cos(t*9*(i?1:-1))*0.45, 0); } }
  // jelly heart eyes in love
  if (k==='jelly' || k==='muse'){ const love=ex==='love'; for (const e of u.eyes) e.visible=!love; if (love){ s.loveEyes(t); } else s.loveOff(); }
}

/* ---------------- init ---------------- */
function init(crewArr){
  crew=crewArr; buildProps();
  crew.forEach((c,ci)=>{
    const u=c.userData, k=u.kind;
    const s={ u, kind:k, ci, act:new Float32Array(NC), idle:new Float32Array(NC), out:new Float32Array(NC), snap:new Float32Array(NC),
      wA:0, wI:1, wG:1, WA:{x:0,v:0}, WI:{x:1,v:0}, WG:{x:1,v:0}, GY:{x:0,v:0}, GP:{x:0,v:0}, wAT:0, wGT:1, expr:'neutral', exprT:-9, blinkMul:1, poofT:0, ikFn:[null,null,null,null], footLift:[0,0], attNow:null,
      sp:{ tailY:Spring(60,7), tailZ:Spring(60,7), earX:Spring(120,9), jSy:Spring(90,6), faceY:Spring(140,14), helmX:Spring(80,10), helmZ:Spring(80,10),
           lagX:Spring(50,8), lagY:Spring(50,8), lagZ:Spring(50,8), poof:Spring(70,6) },
      prev:{px:0,py:0,pz:0,ry:0,vx:0,vy:0,vz:0,vry:0}, earKick:0, layoutRy:c.rotation.y, headScale:u.head.scale.x, headY:u.head.position.y,
      earRest:(u.ears||[]).map(e=>e.rotation.z), lastDeform:0, jlast:0 };
    REST[k]={}; for (const l of LIMBS){ const L=u.rig[l]; REST[k][l]=L.rest; }
    const hs=[]; if (k==='jelly'||k==='muse'){ for (const e of u.eyes){ const h=new T.Sprite(new T.SpriteMaterial({map:TEX.heart, transparent:true, depthWrite:false})); h.visible=false; h.renderOrder=95; e.parent.add(h); h.position.copy(e.position); h.position.z+=0.02; hs.push(h); } }
    s.loveEyes=(t)=>{ for (const h of hs){ h.visible=true; const sc=(k==='jelly'?0.11:0.09)*(1+0.12*Math.sin(t*10)); h.scale.set(sc,sc,sc); } };
    s.loveOff=()=>{ for (const h of hs) h.visible=false; };
    S.push(s);
  });
  Eng.init(crew, S, CI, KIND_IX); Eng.initDecals(); Eng.initSmear();
  [0xff8fc8,0xd9c7a2,0xf2f2f2,0xffcc66].forEach(col=>Eng.makeRope(18,0.012,col));
  buildClips();
  D.nextScene = rr(9,18); D.nextMicro = rr(3,6); D.rate=1; D.holdLeft=0; D.shake=0;
  return api;
}

/* ---------------- clip compile + Recover ---------------- */
function compile(src){
  src._tr=[]; for (const key in src.keys){ const [who,ch]=key.split(':'); const ci=KIND_IX[who], chi=CI[ch]; if (ci===undefined||chi===undefined){ console.warn('bad channel',key); continue; }
    src._tr.push({ci,chi,ks:src.keys[key].slice().sort((a,b)=>a[0]-b[0])}); }
  src._fn=src.fns.map(f=>({ci:KIND_IX[f.who], chi:CI[f.ch], t0:f.t0, t1:f.t1, f:f.f})).filter(f=>f.chi!==undefined);
  src._ik=src.iks.map(k=>({...k, ci:KIND_IX[k.who]}));
}
function resolveClip(c){
  if (c._res) return c;
  const who=new Set(c.cast);
  for (const k in c.keys) who.add(k.split(':')[0]); for (const f of c.fns) who.add(f.who);
  for (const l of c.locos) who.add(l.who); for (const p of c.phys) who.add(p.who); for (const k of c.iks) who.add(k.who); for (const a of c.atts) who.add(a.who); for (const f of c.feet) who.add(f.who);
  c.cast=[...who]; c.castIx=c.cast.map(w=>KIND_IX[w]);
  compile(c);
  c.tEnd=Math.max(c.dur-c.reset, c.contentEnd);
  buildRecovery(c);
  c.events.sort((a,b)=>a[0]-b[0]);
  c._res=true; return c;
}
function evalKeys(ks, t){
  if (t<=ks[0][0]) return ks[0][1];
  for (let i=1;i<ks.length;i++){ const b=ks[i]; if (t<=b[0]){ const a=ks[i-1]; if (b[2]==='step0') return b[1]; const d=b[0]-a[0]; if (d<=1e-6) return b[1];
      const ease=E[b[2]]||E.inOutCubic; return a[1]+(b[1]-a[1])*ease((t-a[0])/d); } }
  return ks[ks.length-1][1];
}
function footOff(tr, t, o){ o.x=0; o.z=0; o.l=0; if (!tr) return o;
  for (const g of tr.segs){ if (t>=g.t1){ o.x=g.x1; o.z=g.z1; } else if (t>=g.t0){ const u=(t-g.t0)/Math.max(1e-4,g.t1-g.t0), e=Eng.sst(0,1,u); o.x=g.x0+(g.x1-g.x0)*e; o.z=g.z0+(g.z1-g.z0)*e; o.l=g.lift*Math.sin(Math.PI*u); return o; } else return o; }
  return o; }
const _fo={x:0,z:0,l:0};
function sampleRaw(src, t, dry){
  if (!dry && src.feet) for (const tr of src.feet){ if (t<tr.a-0.15 || t>tr.b+0.15) continue; const s=S[KIND_IX[tr.who]], li=2+tr.f;
    footOff(tr,t,_fo); const w=E.inOutSine(clamp(Math.min((t-tr.a+0.15)/0.15,(tr.b+0.15-t)/0.15),0,1));
    if (w>=s.ikW[li]){ Eng.footHome(s,tr.f,_fo.x,_fo.z,_fo.l,s.ikT[li]); s.ikW[li]=w; s.ikFn[li]=null; s.ikPole[li].set(tr.f?0.15:-0.15,0,1).normalize(); s.footLift[tr.f]=_fo.l; } }
  for (const tr of src._tr) S[tr.ci].act[tr.chi]+=evalKeys(tr.ks,t);
  for (const f of src._fn) if (t>=f.t0 && t<=f.t1) S[f.ci].act[f.chi]+=f.f(t);
  for (const pl of src.locos) if (t>=pl.t0 && t<=pl.t1){ const s=S[pl.ci]; Eng.evalWalk(pl, t-pl.t0, s.act, s, !dry); }
  for (const ph of src.phys){ const bk=ph.bk, tt=t-ph.t0; if (tt<0 || tt>bk.settled) continue;
    const f=Math.min(bk.n-1.001, tt/bk.dt), i=Math.floor(f), u=f-i, A=bk.A, a=S[ph.ci].act;
    const g=(j)=>A[i*6+j]+(A[(i+1)*6+j]-A[i*6+j])*u;
    a[CI['body.px']]+=g(0); a[CI['body.py']]+=g(1); a[CI['body.pz']]+=g(2); a[CI['body.rx']]+=g(3); a[CI['body.ry']]+=g(4); a[CI['body.rz']]+=g(5);
    a[CI['pivot.com']]+=clamp(g(1)/0.08,0,1); }
  if (!dry) for (const k of src._ik){ if (t<k.t0 || t>k.t1) continue; const s=S[k.ci];
    const w=k.w*Math.min(1,(t-k.t0)/Math.max(1e-3,k.a),(k.t1-t)/Math.max(1e-3,k.a));
    const e=E.inOutSine(clamp(w,0,1)); if (e>=s.ikW[k.li]){ s.ikW[k.li]=e; s.ikFn[k.li]=k.target; s.ikPole[k.li].copy(k.pole); } }
}
function buildRecovery(c){
  const rc=Clip(c.id+'#rec',0,c.cast); rc.events=c.events; rc.noAntic=true; const t0=c.tEnd; let endMax=t0+0.3;
  for (const ci of c.castIx) S[ci].act.fill(0);
  sampleRaw(c, t0, true);
  for (const ci of c.castIx){
    const s=S[ci], who=s.kind, V=s.act, g=(n)=>V[CI[n]];
    for (let i=0;i<NC;i++) if (Math.abs(V[i])>1e-5) B.key(rc,who,CH[i],t0,V[i],'linear');
    let t=t0;
    const lying=Math.abs(g('body.rz'))>0.7||Math.abs(g('body.rx'))>0.7, air=g('body.py')>0.05;
    for (let i=0;i<NC;i++){ const n=CH[i]; if (Math.abs(V[i])<1e-5 || n.startsWith('body.') || n.startsWith('look.') || n==='pivot.com') continue; B.to(rc,who,n,t0,t0+0.45,0,'inOutCubic'); }
    for (const n of ['look.soot','look.wet','look.frizz','look.spike','look.tint','look.poof']) if (Math.abs(g(n))>1e-4){        // motivated cleanup: shake/wipe while it fades
      B.to(rc,who,n,t0+0.15,t0+1.15,0,'inOutSine'); B.fn(rc,who,'body.ry',t0+0.15,t0+0.95,tt=>0.12*Math.sin(TAU*3.5*(tt-t0-0.15))); }
    for (const n of ['body.sy','body.sx','body.sz','pivot.com','body.sink']) if (Math.abs(g(n))>1e-4) B.to(rc,who,n,t0,t0+0.3,0,'outCubic');
    B.expr(rc,t0+0.05,who,'neutral');
    if (air){ const tf=Math.sqrt(2*g('body.py')/Eng.G); B.to(rc,who,'body.py',t,t+tf,0,'inQuad'); const ti=t+tf;
      B.fn(rc,who,'body.sy',ti,ti+0.6,tt=>-0.2*Math.exp(-(tt-ti)*7)*Math.cos((tt-ti)*17)); B.sfx(rc,ti,Eng.PROF[who].impact,2); t=ti+0.15; }
    else if (Math.abs(g('body.py'))>1e-4) B.to(rc,who,'body.py',t,t+0.3,0,'outCubic');
    if (lying){                                              // roll a touch further (anticipation), push up with arms, stand
      for (const n of ['body.rz','body.rx']){ const v=g(n); B.to(rc,who,n,t,t+0.14,v*1.06,'outQuad'); B.to(rc,who,n,t+0.2,t+0.75,0,'outBack'); }
      if (who!=='jelly') for (const [limb,side] of [['armL',-1],['armR',1]]) IK.reach(rc,who,limb,t,t+0.6, Eng.IKT.fn((tt,out)=>{ out.setFromMatrixPosition(s.u.body.matrixWorld); out.x+=side*0.32; out.y=0.06; out.z+=0.12; return out; }),{a:0.15});
      B.sfx(rc,t+0.3,'whoosh'); t+=0.8;
    } else for (const n of ['body.rz','body.rx']) if (Math.abs(g(n))>1e-4) B.to(rc,who,n,t,t+0.35,0,'inOutCubic');
    const dist=Math.hypot(g('body.px'),g('body.pz')), yaw=Eng.wrapA(g('body.ry'));
    if (dist>0.03 || Math.abs(yaw)>0.25){ const pl=Loco.walk(rc,who,t,[[0,0]],{startYaw:yaw,endYaw:0}); t=pl.t1; }
    else { for (const n of ['body.px','body.pz','body.ry']) if (Math.abs(g(n))>1e-5) B.to(rc,who,n,t,t+0.35,0,'inOutSine'); t+=0.35; }
    B.pulse(rc,who,'body.sy',t,0.18,0.04,0.3,-0.03,'inOutSine','inOutSine');              // settle breath
    endMax=Math.max(endMax,t+0.55);
  }
  compile(rc); c.rc=rc; c.dur=Math.max(endMax, t0+0.3); c.reset=c.dur-t0;
}
function sampleClip(c, t){
  for (const ci of c.castIx){ const s=S[ci]; s.act.fill(0); s.ikW.fill(0); s.ikFn.fill(null); s.attNow=null; }
  const src = (t>c.tEnd && c.rc) ? c.rc : c;
  sampleRaw(src, t, false);
  for (const a of c.atts){ if (t<a.t0 || t>a.t1) continue; const w=Math.min(1,(t-a.t0)/a.a,(a.t1-t)/a.a); const s=S[a.ci]; a.w=E.inOutSine(clamp(w,0,1)); s.attNow=a; }
}

/* ---------------- director ---------------- */
function play(id, o={}){
  if (id && id.startsWith('random:')){ const tag=id.slice(7); const pool=D.scenes.filter(x=>D.clips[x].tags.includes(tag)&&!D.hist.includes(x)); if (!pool.length) return false; id=pool[(R()*pool.length)|0]; }
  const c=D.clips[id]; if (!c){ console.warn('no clip',id); return false; }
  if (D.clip && !o.force) return false;
  if (D.clip) finishClip(true);
  resolveClip(c);
  D.clip=c; D.ct=o.st||0; D.evI=0; D.stopBlend=0; D.holdLeft=0;
  for (const ci of c.castIx){ S[ci].wAT=1; S[ci].wGT=c.tags.includes('gazeLock')?1:0.15; }
  for (const s of S) if (!c.castIx.includes(s.ci)){ s.wAT=0; }
  if (!c.micro){ D.hist.push(id); if (D.hist.length>6) D.hist.shift(); }
  c.onStart && c.onStart();
  return true;
}
function finishClip(silent){
  const c=D.clip; if (!c) return; c.onEnd && c.onEnd(); hideAllProps();
  for (const r of Eng.ROPES) Eng.ropeStop(r); for (const k in Eng.DECALS) Eng.decalOff(k);
  for (const ci of c.castIx){ const s=S[ci]; s.wAT=0; s.wGT=1; setExpr(ci,'neutral'); s.ikW.fill(0); s.attNow=null; }
  D.clip=null; D.forceGaze=false; D.rate=1; D.holdLeft=0;
  if (!silent) for (const cb of D.cbs) try{ cb(c.id); }catch(e){}
  if (!silent && D.loopId===c.id) D.replayAt=D.now+0.35;
  D.nextMicro = D.now + rr(3,6); if (!c.micro) D.nextScene = D.now + rr(9,18);
}
/* interrupt: jump the clip into its Recover tail (≤1.2 s) instead of fading */
function stop(o={}){ const c=D.clip; if (!c) return; if (c.rc && D.ct<c.tEnd){ D.ct=c.tEnd; D.evI=c.events.findIndex(e=>e[0]>c.tEnd); if (D.evI<0) D.evI=c.events.length; hideAllProps(); } else { D.stopBlend=o.blendOut??0.4; D.stopT=D.stopBlend; } }
function setMode(m){ if (D.mode===m) return; D.mode=m; D.waitIdle=0; if (D.clip && (m==='question'||m==='reveal')) stop(); }
function pickScene(){
  const lastTag = D.hist.length ? (D.clips[D.hist[D.hist.length-1]].tags[0]||'') : '';
  const pool=D.scenes.filter(id=>{ const c=D.clips[id]; if (D.hist.includes(id)) return false; if (c.tags.includes('long') && D.mode!=='waiting') return false; if (c.tags.includes('reveal')||c.tags.includes('forced')||c.tags.includes('move')) return false; if (lastTag && c.tags[0]===lastTag && D.scenes.length>6) return false; return true; });
  if (!pool.length) return null; let tot=0; for (const id of pool) tot+=D.clips[id].w; let x=R()*tot; for (const id of pool){ x-=D.clips[id].w; if (x<=0) return id; } return pool[pool.length-1];
}
function directorTick(dt){
  if (TEST || P.has('noauto') || D.manual) return;
  if (D.mode==='waiting'){ D.waitIdle+=dt;
    if (D.waitIdle>45 && D.clips.idolAudition && !D.clip){ D.waitIdle=26; play('idolAudition'); return; }
    if (D.waitIdle>25 && D.waitIdle<26 && D.clips.hungryStare && !D.clip){ D.waitIdle=26; play('hungryStare'); return; } }
  if (D.clip) return;
  if ((D.mode==='idle'||D.mode==='waiting') && D.now>D.nextScene){ const id=pickScene(); if (id){ play(id); return; } D.nextScene=D.now+5; }
  if ((D.mode==='idle'||D.mode==='waiting'||D.mode==='question') && D.now>D.nextMicro){ const id=D.micros[(R()*D.micros.length)|0]; play(id); D.nextMicro=D.now+rr(3,6); }
}

/* ---------------- per-frame update ---------------- */
const smooth=(x,tgt,dt,tau=0.18)=>x+(tgt-x)*(1-Math.exp(-dt/tau));
const ORDER=[];
function update(dt, t, gz){
  ctx=gz; D.now=t; dt=Math.min(dt,1/20); D.dt=dt||1/60;
  if (D.ext) D.ext.pre(dt,t);
  if (D.replayAt && D.now>=D.replayAt && !D.clip){ const id=D.loopId; D.replayAt=0; if (id) play(id,{force:true}); }
  D.lowQ = gz.quality==='low';
  directorTick(dt);
  const c=D.clip;
  if (c){
    if (D.stopBlend>0){ D.stopT-=dt; for (const ci of c.castIx) S[ci].wAT=0; if (D.stopT<=0) finishClip(false); }
    else {
      const ts = clipScale(c,D.ct) * (c.timeScale ? c.timeScale(D.ct) : 1); D.rate=ts;
      const sp=D.speed||1;
      if (D.holdLeft>0) D.holdLeft-=dt*sp;
      else { const prev=D.ct; D.ct+=dt*ts*sp;
        for (const h of c.holds) if (h[0]>prev && h[0]<=D.ct){ D.ct=h[0]; D.holdLeft=h[1]; }
        while (D.evI<c.events.length && c.events[D.evI][0]<=D.ct){ fire(c.events[D.evI++]); }
        if (D.ct>=c.dur){ sampleClip(c,c.dur); finishClip(false); } }
    }
    if (D.clip){ sampleClip(c, Math.min(D.ct,c.dur)); c.tick && c.tick(D.ct, api); }
  }
  // pass 0: layers → out
  for (const s of S){
    s.wA=clamp(Eng.crit(s.WA,s.wAT,0.11,dt),0,1); s.wG=clamp(Eng.crit(s.WG,D.forceGaze?1:s.wGT,0.14,dt),0,1);
    s.wI=clamp(Eng.crit(s.WI, s.wAT>0.5?0.35:1, 0.18, dt),0,1);
    computeIdle(s,t);
    const o=s.out, a=s.act, id=s.idle;
    for (let i=0;i<NC;i++) o[i]=id[i]*s.wI + a[i]*s.wA;
    if (D.ext) D.ext.pose(s,o,t,dt);
    if (s.wA<1e-3 && !(D.clip && D.clip.castIx.includes(s.ci))){ a.fill(0); s.ikW.fill(0); s.attNow=null; }
    gazeLayer(s,t);
    secondary(s,dt,t);
  }
  // pass 1: bodies + FK (carriers before attached characters)
  ORDER.length=0; for (const s of S) if (!s.attNow) ORDER.push(s); for (const s of S) if (s.attNow) ORDER.push(s);
  for (const s of ORDER){ applyBody(s,dt); applyFK(s,t); }
  // pass 2: IK (targets may reference any character's sockets), jelly skin, looks, shadows, smear
  for (const s of S){ applyIK(s,t); finishPose(s,t,dt); }
  for (const r of Eng.ROPES) Eng.ropeStep(r, dt, t);
  // eyes / blink / expressions
  for (const s of S){
    const bl = gz.blinkAmount(s.ci,t); s.blinkMul = 1-0.92*bl;
    const eyes = s.kind==='fox' ? s.u.face.openEyes : s.u.eyes;
    if (s.expr!=='dizzy') for (const e of eyes) if (e.visible) gz.aimEye(e,t);
    if (s.u.innerEyes && s.expr!=='dizzy'){ tmpV.copy(gz.gaze); s.u.innerFace.worldToLocal(tmpV); tmpV.normalize();
      const ox=clamp(tmpV.x*0.06,-0.035,0.035), oy=clamp(tmpV.y*0.05,-0.025,0.025);
      for (let k=0;k<2;k++){ const d=s.u.innerEyes[k]; d.position.x += ((k?0.07:-0.07)+ox - d.position.x)*0.25; d.position.y += (0.025+oy-d.position.y)*0.25; } }
    applyExpr(s.ci,t);
  }
  D.shake*=Math.exp(-dt*9); gz.shake = gz.dragging ? 0 : D.shake;
  updateFx();
  if (Eng.statsOn) Eng.STATS.frames++;
}
function computeIdle(s,t){
  const a=s.idle; a.fill(0); const ph=s.ci*1.3, k=s.kind;
  a[CI['head.rz']]=Math.sin(t*0.9+ph)*0.03;
  a[CI['body.rz']]=Math.sin(t*1.1+ph)*0.018;
  const br=Math.sin(t*2.0+ph); a[CI['body.sy']]= k==='jelly'?0:0.008*br+0.006*Math.max(0,br);
  if (k==='astro') a[CI['body.py']]=0.006*Math.sin(t*1.7);
  const sw=Math.sin(t*1.6+ph);
  a[CI['armL.rz']]=-sw*0.05; a[CI['armR.rz']]=sw*0.05; a[CI['armL.rx']]=Math.sin(t*1.3+ph-1)*0.04; a[CI['armR.rx']]=Math.sin(t*1.3+ph+1)*0.04;
  a[CI['armL.mz']]=-Math.sin(t*2.1+ph)*0.05; a[CI['armR.mz']]=Math.sin(t*2.1+ph)*0.05;
  if (k==='muse') a[CI['armR.rz']]+=Math.sin(t*2.6)*0.07;
  if (k==='fox'){ a[CI['armL.rz']]+=-Math.sin(t*2.6)*0.07; a[CI['tail.ry']]=Math.sin(t*1.8)*0.16; a[CI['tail.rz']]=Math.sin(t*1.3)*0.05;
    a[CI['earL.rx']]=-Math.max(0,Math.sin(t*0.7)*8-7)*0.25; a[CI['earR.rx']]=-Math.max(0,Math.sin(t*0.7+2)*8-7)*0.25; }
  if (k==='jelly'){ a[CI['armL.rz']]=Math.sin(t*2.4)*0.18; a[CI['armR.rz']]=-Math.sin(t*2.1+1)*0.1; a[CI['legL.rx']]=Math.sin(t*1.9)*0.08; a[CI['armL.rx']]=0; a[CI['armR.rx']]=0; }
}
function gazeLayer(s,t){
  const u=s.u, o=s.out, g=ctx.gaze;
  const hp=u.head.getWorldPosition(tmpV2);
  const dx=g.x-hp.x, dy=g.y-hp.y, dz=g.z-hp.z;
  const ry=s.layoutRy+u.body.rotation.y;
  const yaw=clamp(Math.atan2(dx,dz)-ry,-0.75,0.75), pitch=clamp(-Math.atan2(dy,Math.hypot(dx,dz)),-0.4,0.35);
  const hk = s.kind==='jelly'?0.35:0.7;
  s.gy=Eng.crit(s.GY, yaw*hk, 0.09, D.dt||1/60); s.gp=Eng.crit(s.GP, pitch*hk*0.8, 0.09, D.dt||1/60);
  o[CI['head.ry']]+=s.gy*s.wG; o[CI['head.rx']]+=s.gp*s.wG;
  o[CI['body.ry']]+=yaw*0.18*s.wG*(1-s.wA*0.8); o[CI['body.rz']]+=-yaw*0.02*s.wG;
}
function secondary(s,dt,t){
  const o=s.out, p=s.prev, sp=s.sp;
  const px=o[CI['body.px']], py=o[CI['body.py']], pz=o[CI['body.pz']], ry=o[CI['body.ry']];
  const id=dt>0?1/dt:60;
  const vx=(px-p.px)*id, vy=(py-p.py)*id, vz=(pz-p.pz)*id, vry=(ry-p.ry)*id;
  const ax=clamp((vx-p.vx)*id,-200,200), ay=clamp((vy-p.vy)*id,-200,200);
  p.px=px; p.py=py; p.pz=pz; p.ry=ry; p.vx=vx; p.vy=vy; p.vz=vz; p.vry=vry;
  const k=s.kind;
  if (k==='fox'){
    o[CI['tail.ry']]+=clamp(stepSpring(sp.tailY, clamp(-vry*0.25 - vx*0.6, -0.9,0.9), dt),-0.9,0.9);
    o[CI['tail.rz']]+=clamp(stepSpring(sp.tailZ, clamp(-vy*0.5,-0.6,0.6), dt),-0.9,0.9);
    if (s.earKick){ sp.earX.v-=12*s.earKick; s.earKick=0; }
    const e=clamp(stepSpring(sp.earX, clamp(-ay*0.004,-0.5,0.2), dt),-0.9,0.3); o[CI['earL.rx']]+=e; o[CI['earR.rx']]+=e;
    if (s.expr==='scared'){ o[CI['tail.rz']]+=-0.6; o[CI['earL.rx']]+=-0.6; o[CI['earR.rx']]+=-0.6; }
    if (s.expr==='love'){ o[CI['tail.ry']]+=0.35*Math.sin(t*TAU*6*0.5); o[CI['earL.rx']]+=-0.5; o[CI['earR.rx']]+=-0.5; }
  }
  if (k==='jelly'){
    const sy=stepSpring(sp.jSy, clamp(ay*-0.0035,-0.35,0.3), dt);
    s.jSy=clamp(sy,-0.4,0.35);
    if (s.expr==='giggle') o[CI['body.sy']]+=0.02*Math.sin(t*TAU*14);
    if (s.expr==='scared') o[CI['body.sy']]+=-0.1;
  }
  if (k==='astro'){
    o[CI['head.rz']]+=clamp(stepSpring(sp.helmZ, clamp(ax*0.004,-0.25,0.25), dt),-0.25,0.25);
    o[CI['head.rx']]+=clamp(stepSpring(sp.helmX, clamp(-ay*0.003,-0.25,0.25), dt),-0.25,0.25);
  }
  if (s.u.furU){
    const lag=s.u.furU.uLag.value, q=s.layoutRy;
    const lx=vx*Math.cos(q)-vz*Math.sin(q), lz=vx*Math.sin(q)+vz*Math.cos(q);
    const f=D.lowQ?0:0.03;
    lag.set(clamp(stepSpring(sp.lagX, lx*f, dt),-0.05,0.05), clamp(stepSpring(sp.lagY, vy*f, dt),-0.05,0.05), clamp(stepSpring(sp.lagZ, lz*f, dt),-0.05,0.05));
    s.u.furU.uPoof.value=clamp(stepSpring(sp.poof, s.poofT + (s.extraPoof||0) + o[CI['look.poof']], dt),0,0.6);
  }
}
/* body transform: pivot-correct rotation (outer foot edge / toes / heels / centre of mass),
   rotation-induced floor clamp, volume-preserving squash, auto stretch, sink, attach */
const _pv=new T.Vector3(), _vv=new T.Vector3(), _cv=new T.Vector3(), _wp=new T.Vector3(), _sv=new T.Vector3();
function applyBody(s, dt){
  const u=s.u, o=s.out, b=u.body, pr=s.prof, root=crew[s.ci];
  const rx=o[CI['body.rx']], ry=o[CI['body.ry']], rz=o[CI['body.rz']];
  const k=Math.max(-0.6,o[CI['body.sy']]), sy=1+k, inv=1/Math.sqrt(Math.max(0.3,sy));
  const sp=s.velW.length(), ks=clamp((sp-2.5)*0.12,0,0.25);
  let stx=1, sty=1; if (ks>0){ const fv=Math.abs(s.velW.y)/sp; sty=1+ks*fv; stx=1+ks*(1-fv); }
  const stz=1/Math.sqrt(stx*sty);
  b.rotation.set(rx,ry,rz); b.scale.set(inv*(1+o[CI['body.sx']])*stx, sy*sty, inv*(1+o[CI['body.sz']])*stz);
  b.position.set(0,0,0); b.updateMatrix();
  const com=clamp(o[CI['pivot.com']],0,1);
  _pv.set(-Math.sign(rz)*pr.hw*Math.min(1,Math.abs(rz)/0.15)*(1-com), pr.com*com, Math.sign(rx)*pr.hd*Math.min(1,Math.abs(rx)/0.15)*(1-com));
  _vv.copy(_pv).applyMatrix4(b.matrix);
  let minY=1e9; for (let i=0;i<8;i++){ _cv.set(i&1?pr.hw:-pr.hw, i&2?pr.H:0, i&4?pr.hd:-pr.hd).applyMatrix4(b.matrix); const y=_cv.y+_pv.y-_vv.y; if (y<minY) minY=y; }
  const q=s.layoutRy, px=o[CI['body.px']], pz=o[CI['body.pz']], sink=Math.max(0,o[CI['body.sink']]);
  const y=Math.max(-0.2,o[CI['body.py']]) + Math.max(0,-minY) - sink;
  s.clip.constant = sink>0.002 ? 0 : 1000;
  b.position.set(px*Math.cos(q)-pz*Math.sin(q)+_pv.x-_vv.x, y+_pv.y-_vv.y, px*Math.sin(q)+pz*Math.cos(q)+_pv.z-_vv.z);
  const at=s.attNow;
  if (at && at.w>0){
    Eng.sockWorld(at.to, at.sock, _wp); _wp.x+=at.off[0]; _wp.y+=at.off[1]; _wp.z+=at.off[2];
    const A=s.att; if (!A.init){ A.p.copy(_wp); A.v.set(0,0,0); A.init=true; }
    if (at.lag>0 && dt>0){ const n=Math.max(1,Math.ceil(dt*120)), h=dt/n; for (let i=0;i<n;i++){ _sv.subVectors(_wp,A.p).multiplyScalar(120); _sv.addScaledVector(A.v,-14); A.v.addScaledVector(_sv,h); A.p.addScaledVector(A.v,h); } }
    else A.p.copy(_wp);
    root.worldToLocal(_sv.copy(A.p)); b.position.lerp(_sv, at.w);
  } else s.att.init=false;
  b.updateMatrix(); b.matrixWorld.multiplyMatrices(root.matrixWorld, b.matrix); b.matrixWorldNeedsUpdate=false;
  _wp.setFromMatrixPosition(b.matrixWorld);
  if (dt>0){ s.velW.subVectors(_wp,s.prevW).multiplyScalar(1/dt); if (s.velW.lengthSq()>400) s.velW.set(0,0,0); }
  s.trail[2].copy(s.trail[1]); s.trail[1].copy(s.trail[0]); s.trail[0].copy(s.prevW); s.prevW.copy(_wp);
}
function applyFK(s,t){
  const u=s.u, o=s.out;
  if (s.kind==='jelly'){ const w=Math.sin(t*3.2), w2=Math.sin(t*5.1+1), j=s.jSy||0, bm=u.bodyMesh;
    const ys=1-0.03*w+0.008*w2+j, xs=1/Math.sqrt(Math.max(0.3,ys)); bm.scale.set((1+0.025*w)*xs, ys, (1+0.025*w)*xs); }
  const h=u.head; h.rotation.set(o[CI['head.rx']], o[CI['head.ry']], o[CI['head.rz']]);
  const hs=s.headScale*(1+o[CI['head.sy']]); h.scale.set(s.headScale, hs, s.headScale);
  if (s.kind!=='jelly') h.position.y = s.headY + o[CI['head.py']];
  const jl = s.kind==='jelly' ? 1.15 : 9;
  for (let li=0;li<4;li++){ const L=u.rig[LIMBS[li]], r=L.rest, base=CI[LIMBS[li]+'.rz'];
    L.root.rotation.set(clamp(r.rx+o[base+1],-jl,jl), r.ry+o[base+2], clamp(r.rz+o[base],-jl,jl));
    if (L.mid) L.mid.rotation.set(r.mx+o[base+4], 0, r.mz+o[base+3]); }
  if (u.rig.armL.end){ u.rig.armL.end.rotation.z=o[CI['handL.rz']]; u.rig.armR.end.rotation.z=o[CI['handR.rz']]; }
  if (u.tail){ u.tail.rotation.set(0, o[CI['tail.ry']], o[CI['tail.rz']]); const ts=1+o[CI['tail.sx']]; u.tail.scale.set(ts,1+o[CI['tail.sx']]*0.4,ts); }
  if (u.ears && u.ears.length){ u.ears[0].rotation.x=o[CI['earL.rx']]; u.ears[1].rotation.x=o[CI['earR.rx']];
    u.ears[0].rotation.z=s.earRest[0]+o[CI['earL.rz']]; u.ears[1].rotation.z=s.earRest[1]+o[CI['earR.rz']]; }
}
const _gp=new T.Vector3();
function applyIK(s,t){
  const o=s.out, w=s.wA;
  // auto-grounding: when the pelvis drops (crouch/melt) with no walk active, keep the feet planted
  if (!D.ext && s.kind!=='jelly' && s.ikW[2]===0 && s.ikW[3]===0){ const py=o[CI['body.py']], tilt=Math.max(Math.abs(o[CI['body.rx']]),Math.abs(o[CI['body.rz']]));
    const gw=Eng.sst(0.004,0.03,-py)*(1-Eng.sst(0.25,0.45,tilt));
    if (gw>0.001){ const q=s.layoutRy+o[CI['body.ry']], c=Math.cos(q), sn=Math.sin(q), rp=crew[s.ci].position;
      for (let f=0;f<2;f++){ const rf=s.restFoot[f]; s.ikT[2+f].set(rp.x+o[CI['body.px']]+rf.x*c+rf.z*sn, rf.y, rp.z+o[CI['body.pz']]-rf.x*sn+rf.z*c);
        s.ikW[2+f]=gw; s.ikFn[2+f]=null; s.ikPole[2+f].set(f?0.15:-0.15,0,1).normalize(); s.footLift[f]=0; } } }
  for (let li=0;li<4;li++){ const wi=s.ikW[li]*w;
    if (wi<0.001) continue;
    if (s.ikFn[li]) s.ikFn[li](t, s.ikT[li]);
    Eng.solveLimb(s, li, s.ikT[li], Math.min(1,wi), s.ikPole[li], li>1 && s.footLift[li-2]===0 && s.ikFn[li]===null);
  }
}
function finishPose(s,t,dt){
  const u=s.u, o=s.out;
  if (s.kind==='jelly'){ s.jframe=(s.jframe||0)+1; if (!ctx.skipDeform){ const fast = s.wA>0.05; if (fast || s.jframe%2===0) u.deform(); } Eng.jellySockets(s); }
  // material looks
  const L=u.look, soot=clamp(o[CI['look.soot']],0,1);
  L.uSoot.value=soot; L.uWet.value=clamp(o[CI['look.wet']],0,1); if (L.uFrizz) L.uFrizz.value=clamp(o[CI['look.frizz']],0,1);
  if (s.kind==='jelly'){ const k=clamp(o[CI['look.tint']],0,1); L.uSpike.value=clamp(o[CI['look.spike']],0,1);
    L.uTint.value.setRGB(0.08+0.37*k, 0.55-0.43*k, 0.78-0.03*k); L.uRimTint.value.setRGB(0.4+0.45*k, 0.92-0.42*k, 1.0); L.uInTint.value.setRGB(0.02+0.23*k, 0.3-0.25*k, 0.45-0.05*k); }
  if (s.kind==='astro' && soot>0.01) u.face.screen.material.color.setScalar(1-0.85*soot*(0.75+0.25*Math.sin(t*37)));
  // shadow follows the real body position, shrinks & fades when airborne
  if (u.shadow){ _wp.setFromMatrixPosition(u.body.matrixWorld); const hgt=Math.max(0,_wp.y);
    u.shadow.position.set(_wp.x, 0.003, _wp.z); const sc=Math.max(0.35,1-0.5*hgt*2.2)*crew[s.ci].scale.x; u.shadow.scale.set(sc,sc,sc); u.shadow.material.opacity=Math.max(0.2,1-hgt*2.2); }
  // speed-line smear (layer 1)
  const sp=s.velW.length();
  for (let i=0;i<3;i++){ const g=Eng.SMEAR[s.ci*3+i]; if (sp>3.2 && o[CI['body.py']]>0.12 && !D.lowQ){ g.visible=true; g.position.copy(s.trail[i]); g.position.y+=s.prof.H*0.45; const sc=s.prof.H*(0.75-i*0.15); g.scale.set(sc,sc,sc); g.material.opacity=Math.min(0.5,(sp-3)*0.15)*(1-i*0.3); } else g.visible=false; }
}
function fire(e){
  const [t,type,a,b,c2]=e;
  if (type==='expr'){ setExpr(KIND_IX[a], b); }
  else if (type==='sfx'){ if (!D.seeking) Audio_.sfx(a,b); }
  else if (type==='say'){ if (!D.seeking) Audio_.say(a,b,(c2||1)*Math.max(0.5,D.rate||1)); }
  else if (type==='fx'){ spawnFx(a, b, c2); }
  else if (type==='shake'){ D.shake=Math.max(D.shake||0, Math.min(0.03,a)); }
  else if (type==='call'){ a(api); }
}

/* =====================================================================
   SCENES + MICRO-GAGS (batch 1)
   ===================================================================== */
function add(c, list){ D.clips[c.id]=c; if (list) list.push(c.id); return c; }
function buildClips(){
  const K=B.key, TO=B.to, PU=B.pulse, FN=B.fn, X=B.expr, SFX=B.sfx, SAY=B.say, FXE=B.fx;
  const all=['jelly','astro','muse','fox'];
  const L=(w)=>({jelly:-1.95,astro:-0.82,muse:0.28,fox:1.45})[w];

  /* ---------- MICRO-GAGS ---------- */
  const stare=(who)=>{ const c=Clip('stare_'+who,3.6,[who],{micro:true});
    H.look(c,who,0,0.9,0,-0.05,'inOutSine'); X(c,0.7,who,'shock');
    TO(c,who,'body.pz',0.6,1.3,0.25,'inOutSine'); TO(c,who,'body.rx',0.6,1.3,-0.1,'inOutSine');
    X(c,1.5,who,'neutral'); X(c,1.75,who,'shock'); X(c,1.85,who,'neutral'); X(c,2.0,who,'shock');
    TO(c,who,'body.pz',2.2,2.4,0,'inOutSine'); TO(c,who,'body.rx',2.2,2.4,0); X(c,2.3,who,'neutral');
    D.clips[c.id]=c; return c; };
  all.forEach(stare); D.micros.push('stare_jelly','stare_astro','stare_muse','stare_fox');

  { const c=Clip('poke',3.4,['fox','muse'],{micro:true});
    X(c,0,'fox','smug'); H.look(c,'fox',0,0.25,-0.45,0); B.arm(c,'fox','L',0.25,0.5,'reach','outBack');
    TO(c,'fox','body.rz',0.25,0.5,0.12,'outBack'); SFX(c,0.55,'pop');
    c.tick=(t)=>{ S[2].extraPoof = t>0.55&&t<1.6 ? 0.3*Math.sin(Math.PI*(t-0.55)/1.05) : 0; };
    c.onEnd=()=>{ S[2].extraPoof=0; };
    H.look(c,'muse',0.6,0.8,0.5,0.05); H.giggle(c,'muse',0.65,1.1);
    B.armRest(c,'fox','L',1.4,1.7); TO(c,'fox','body.rz',1.4,1.7,0); X(c,1.6,'fox','giggle'); X(c,2.1,'fox','neutral');
    H.look(c,'fox',1.4,1.7,0,0); H.look(c,'muse',1.8,2.1,0,0);
    add(c,D.micros); }

  { const c=Clip('sneeze',3.6,['muse','jelly'],{micro:true});
    PU(c,'muse','head.rx',0,0.35,0.05,0.15,-0.25,'outQuad'); PU(c,'muse','head.rx',0.55,0.35,0.05,0.12,-0.35,'outQuad');
    TO(c,'muse','body.rx',0.4,0.85,0.12,'inOutSine'); X(c,0.3,'muse','smug');
    TO(c,'muse','head.rx',1.12,1.2,0.42,'outQuad'); TO(c,'muse','body.rx',1.12,1.2,-0.2,'outQuad'); X(c,1.12,'muse','shock');
    c.tick=(t)=>{ S[2].extraPoof = t>1.1&&t<1.9 ? 0.6*Math.exp(-(t-1.1)*4) : 0; };
    c.onEnd=()=>{ S[2].extraPoof=0; };
    SFX(c,1.12,'thunk'); FXE(c,1.14,'dust','muse'); SAY(c,1.1,'muse',2,1.6);
    TO(c,'muse','head.rx',1.6,1.9,0); TO(c,'muse','body.rx',1.6,1.9,0); X(c,1.7,'muse','embarrassed'); X(c,2.4,'muse','neutral');
    H.shiver(c,'jelly',1.2,0.6,0.04); X(c,1.2,'jelly','shock'); X(c,1.9,'jelly','neutral');
    add(c,D.micros); }

  { const c=Clip('yawn',3.6,['muse'],{micro:true});
    B.arms(c,'muse',0,0.6,'up','inOutSine'); TO(c,'muse','head.rx',0,0.6,-0.3,'inOutSine'); TO(c,'muse','body.sy',0,0.6,0.06,'inOutSine'); X(c,0.2,'muse','giggle');
    FXE(c,0.6,'zzz','muse',1.5); SAY(c,0.3,'muse',2,0.7);
    B.armsRest(c,'muse',1.6,2.2); TO(c,'muse','head.rx',1.6,2.2,0); TO(c,'muse','body.sy',1.6,2.2,0); X(c,2.2,'muse','neutral');
    add(c,D.micros); }

  { const c=Clip('helmetFog',3.8,['astro'],{micro:true});
    c.tick=(t)=>{ const v=S[1].u.face.visor.material; const f = t<0.6? t/0.6 : t<2.6 ? 1-(t-0.6)/2.0*0.8 : Math.max(0,0.2-(t-2.6)); v.opacity=0.42+0.33*f; v.color.setRGB(1, 0.65+0.35*f, 0.18+0.82*f); };
    c.onEnd=()=>{ const v=S[1].u.face.visor.material; v.opacity=0.42; v.color.setHex(0xffa52e); };
    X(c,0.5,'astro','embarrassed'); B.arm(c,'astro','R',0.6,0.9,'face');
    FN(c,'astro','armR.rz',0.9,2.6,t=>0.35*Math.sin(TAU*1.6*(t-0.9))); FN(c,'astro','armR.rx',0.9,2.6,t=>0.2*Math.cos(TAU*1.6*(t-0.9)));
    SFX(c,1.0,'squeak'); B.armRest(c,'astro','R',2.6,3.0); X(c,2.7,'astro','neutral');
    add(c,D.micros); }

  { const c=Clip('tailBonk',3.6,['fox','muse'],{micro:true});
    X(c,0,'fox','smug'); TO(c,'fox','tail.ry',0,0.25,-0.35,'outQuad'); TO(c,'fox','tail.ry',0.3,0.42,0.95,'outQuad'); TO(c,'fox','tail.rz',0.3,0.42,0.3,'outQuad');
    SFX(c,0.42,'thunk'); PU(c,'muse','head.rz',0.42,0.08,0.1,0.4,-0.3,'outQuad'); TO(c,'muse','body.rz',0.42,0.5,-0.08,'outQuad'); X(c,0.45,'muse','dizzy'); FXE(c,0.45,'stars','muse',1.2);
    TO(c,'fox','tail.ry',0.7,1.2,0); TO(c,'fox','tail.rz',0.7,1.2,0);
    FN(c,'fox','head.rz',0.8,2.6,t=>0.12*Math.sin(TAU*1.2*(t-0.8))); SAY(c,0.9,'fox',5,1.3);
    TO(c,'muse','body.rz',1.4,1.7,0); X(c,1.7,'muse','neutral'); X(c,2.6,'fox','neutral');
    add(c,D.micros); }

  { const c=Clip('bubbleChase',3.8,['jelly'],{micro:true});
    let bub=null;
    c.onStart=()=>{ const bm=S[0].u.bodyMesh; bub=bm.children.find(o=>o.geometry&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius>0.03)||bm.children[3]; c._b0=bub.position.clone(); c._bub=bub; };
    c.tick=(t)=>{ const b=c._bub; if (!b) return; const u=clamp(t/1.6,0,1); b.position.y=c._b0.y+E.inOutSine(u)*(1.72-c._b0.y); b.position.x=c._b0.x*(1-u)+Math.sin(t*5)*0.03; b.visible = t<2.0; b.scale.setScalar(t>1.9?Math.max(0,1-(t-1.9)*10):1); };
    c.onEnd=()=>{ const b=c._bub; if (b){ b.position.copy(c._b0); b.visible=true; b.scale.setScalar(1); } };
    TO(c,'jelly','head.rx',0.2,1.4,-0.3,'inOutSine'); X(c,0.4,'jelly','love');
    TO(c,'jelly','armL.rz',1.2,1.5,-2.0,'outBack'); TO(c,'jelly','armR.rz',1.2,1.5,2.0,'outBack');
    H.hop(c,'jelly',1.6,0.12,0.35,{arms:false});
    SFX(c,2.0,'pop'); X(c,2.0,'jelly','shock'); TO(c,'jelly','armL.rz',2.3,2.7,0); TO(c,'jelly','armR.rz',2.3,2.7,0); TO(c,'jelly','head.rx',2.2,2.6,0); X(c,2.8,'jelly','neutral');
    add(c,D.micros); }

  { const c=Clip('buttonPress',3.4,['astro'],{micro:true});
    B.arm(c,'astro','R',0,0.3,'clap'); TO(c,'astro','head.rx',0,0.3,0.25); SFX(c,0.35,'clink');
    c.tick=(t,api)=>{ const s=S[1]; const v=s.u.face.screen.material; if (t>0.4&&t<1.5){ v.color.setHSL(((t*1.5)%1),0.9,0.6); } else v.color.setRGB(1,1,1); };
    c.onEnd=()=>{ S[1].u.face.screen.material.color.setRGB(1,1,1); };
    TO(c,'astro','head.rx',0.4,0.6,0); X(c,0.45,'astro','love'); H.hop(c,'astro',0.9,0.12,0.4); B.armRest(c,'astro','R',0.5,0.8);
    X(c,1.6,'astro','giggle'); X(c,2.4,'astro','neutral');
    add(c,D.micros); }

  { const c=Clip('selfHug',3.2,['jelly'],{micro:true});
    TO(c,'jelly','armL.rz',0,0.4,0.9,'outBack'); TO(c,'jelly','armR.rz',0,0.4,-0.9,'outBack'); TO(c,'jelly','armL.rx',0,0.4,-0.5); TO(c,'jelly','armR.rx',0,0.4,-0.5);
    TO(c,'jelly','body.sy',0.3,0.6,0.05,'outBack'); X(c,0.35,'jelly','love'); FN(c,'jelly','body.rz',0.6,2.0,t=>0.05*Math.sin(TAU*1.2*(t-0.6)));
    TO(c,'jelly','armL.rz',2.0,2.4,0); TO(c,'jelly','armR.rz',2.0,2.4,0); TO(c,'jelly','armL.rx',2.0,2.4,0); TO(c,'jelly','armR.rx',2.0,2.4,0); TO(c,'jelly','body.sy',2.0,2.4,0); X(c,2.3,'jelly','neutral');
    add(c,D.micros); }

  { const c=Clip('tailChase',4.2,['fox'],{micro:true});
    X(c,0,'fox','smug'); H.look(c,'fox',0,0.2,-0.5,0.15);
    const p1=Loco.walk(c,'fox',0.15,[[0,0]],{startYaw:0,endYaw:TAU*1.5,dur:1.4,style:'trot'});        // spins chasing its tail, feet planted
    TO(c,'fox','tail.ry',0.15,0.4,-0.9,'outQuad'); FN(c,'fox','tail.rz',0.4,p1.t1,t=>0.25*Math.sin(TAU*3*(t-0.4)));
    const p2=Loco.walk(c,'fox',p1.t1,[[0,0]],{startYaw:TAU*1.5,endYaw:TAU*2,dur:0.45,style:'trot'});
    K(c,'fox','body.ry',p2.t1+2e-4,0,'step0'); TO(c,'fox','tail.ry',p1.t1,p1.t1+0.3,0);
    X(c,p1.t1,'fox','dizzy'); FN(c,'fox','body.rz',p2.t1,p2.t1+1.1,t=>0.12*Math.sin(TAU*1.5*(t-p2.t1))*(1-(t-p2.t1)/1.1));
    H.look(c,'fox',p1.t1,p1.t1+0.3,0,0); X(c,p2.t1+1.2,'fox','neutral');
    add(c,D.micros); }

  /* ---------- SCENES (rebuilt on the Phase-0 engine) ---------- */
  // 6.1 fireDrill — real button press (IK), planted panic runs, physical collision bounce, loop march
  { const c=Clip('fireDrill',8.9,all,{w:1.2,tags:['classic']});
    const siren=(t)=>{ const on=t>0.3&&t<6.0; const a=S[1].u.head; if (on){ attach(PROPS.siren,a,0,0.36,0); PROPS.siren.getWorldPosition(tmpV); PROPS.light.position.copy(tmpV); const p=0.5+0.5*Math.sin(t*TAU*2); PROPS.light.intensity=2.5*p; PROPS.sirenMat.emissiveIntensity=0.4+2*p; S[1].u.face.faceM.color.setHex(p>0.5?0xc00000:0x6b0000); } else { detach(PROPS.siren); PROPS.light.intensity=0; } };
    IK.reach(c,'astro','armR',0,0.42,IK.sock('astro','chest',0.05,0,0.03),{a:0.12}); SFX(c,0.24,'clink');
    B.arms(c,'astro',0.45,0.7,'mouth'); TO(c,'astro','head.rx',0.45,0.65,-0.1); SFX(c,0.5,'siren',11);
    H.doubleTake(c,'jelly',0.8,-0.6); H.walk(c,'jelly',1.62,-0.45,0.12,{dur:0.75});
    H.look(c,'muse',1.2,1.8,-0.6,0,'inOutSine');
    c.tick=(t)=>{ siren(t); S[2].extraPoof = t>1.8&&t<2.6?0.6*Math.sin(Math.PI*(t-1.8)/0.8):0; };
    c.onEnd=()=>{ S[2].extraPoof=0; };
    H.panic(c,'fox',1.4,2.45,-0.14,0.05); const tm=H.panic(c,'muse',1.9,2.45,0.07,0.05);
    // head-on collision → momentum sends both flying apart (baked physics, impact squash, dizzy)
    const tc=Math.max(2.45,tm); B.sfx(c,tc,'thud',3); B.shake(c,tc,0.02);
    for (const w of ['muse','fox']) B.pulse(c,w,'body.sx',tc,0.04,0.06,0.25,-0.2,'outQuad');
    X(c,tc+0.02,'muse','dizzy'); X(c,tc+0.02,'fox','dizzy'); B.armsRest(c,'muse',tc,tc+0.2); B.armsRest(c,'fox',tc,tc+0.2);
    const lm=Phys.launch(c,'muse',tc+0.03,{v:[-0.35,1.5,-0.9],spin:[0,0,0.8],maxBounce:2});
    const lf=Phys.launch(c,'fox', tc+0.03,{v:[0.9,2.0,0.45],spin:[0,0,-1.6],maxBounce:3});
    // astro marches a loop with the siren going (planted feet along a curved path)
    const loop=[]; for (let i=1;i<=10;i++){ const a=i/10*TAU; loop.push([0.36*Math.sin(a), 0.42-0.42*Math.cos(a)]); }
    const am=Loco.walk(c,'astro',2.7,loop,{dur:3.0});
    // jelly + muse conga in place, copying his arms 0.25 s / 0.5 s late
    for (const [w,dl] of [['jelly',0.25],['muse',Math.max(0.5,lm-2.7+0.1)]]){ const t0=2.7+dl; B.arm(c,w,'L',t0,t0+0.25,'up'); B.arm(c,w,'R',t0,t0+0.25,'up'); X(c,t0,w,'giggle');
      FN(c,w,'armL.rz',t0+0.25,am.t1,t=>0.25*Math.sin(TAU*2*(t-t0))); FN(c,w,'armR.rz',t0+0.25,am.t1,t=>0.25*Math.sin(TAU*2*(t-t0)));
      FN(c,w,'body.rz',t0+0.25,am.t1,t=>0.07*Math.sin(TAU*2.25*(t-t0))); FN(c,w,'body.sy',t0+0.25,am.t1,t=>-0.025*Math.abs(Math.sin(TAU*2.25*(t-t0)))); }
    // fox recovers, sneaks round the front and presses the button (IK to astro's chest socket)
    X(c,lf+0.1,'fox','smug'); const fw=Loco.walk(c,'fox',lf+0.2,[[-0.9,0.5],[-1.62,0.2]],{style:'tiptoe',dur:Math.max(1.4,am.t1-lf-0.6)});
    const tp=Math.max(fw.t1,am.t1)+0.05;
    IK.reach(c,'fox','armL',tp,tp+0.55,IK.sock('astro','chest',0.06,0,0.04),{a:0.15}); SFX(c,tp+0.25,'clink');
    // freeze mid-step: siren dies, everyone stares
    const tf=tp+0.3; X(c,tf,'astro','embarrassed'); B.arms(c,'astro',tf,tf+0.15,'down','outQuad'); TO(c,'astro','legL.rx',tf,tf+0.1,-0.4); TO(c,'astro','legL.mx',tf,tf+0.1,0.7); TO(c,'astro','head.rx',tf,tf+0.2,0.2);
    for (const w of ['jelly','muse']){ B.arms(c,w,tf,tf+0.2,'down'); X(c,tf+0.05,w,'neutral'); }
    H.look(c,'jelly',tf+0.1,tf+0.35,0.6,0); H.look(c,'muse',tf+0.1,tf+0.35,-0.7,0); H.look(c,'fox',tf+0.1,tf+0.35,0.5,0);
    B.hold(c,tf+0.5,0.7);
    H.giggle(c,'jelly',tf+0.9,1.0); H.giggle(c,'muse',tf+1.1,0.9); H.giggle(c,'fox',tf+1.3,0.8);
    TO(c,'astro','legL.rx',tf+0.9,tf+1.2,0); TO(c,'astro','legL.mx',tf+0.9,tf+1.2,0); TO(c,'astro','head.rx',tf+0.9,tf+1.2,0); X(c,tf+1.2,'astro','giggle');
    c.siren=siren; c.dur=tf+2.4+1.2;
    add(c,D.scenes); }

  // 6.3 coronation — crown carried in fox's hand socket, tossed on an arc onto Jelly's headTop socket; mic engulfed in Jelly's gel hand
  { const c=Clip('coronation',9.6,all,{w:1,tags:['classic']});
    X(c,0,'fox','smug'); H.walk(c,'fox',0,-0.3,0.08,{dur:0.55});
    H.walk(c,'astro',0.4,-0.38,-0.5,{face:'keep'}); H.walk(c,'muse',0.4,0.45,-0.5,{face:'keep'});
    H.look(c,'astro',0.8,1.1,0.6,0); H.look(c,'muse',0.8,1.1,-0.3,0);
    const jw=H.walk(c,'jelly',0.5,1.8,0.45,{dur:1.6});
    TO(c,'fox','body.rx',0.7,1.0,0.45,'outBack'); IK.reach(c,'fox','armL',0.65,1.95,IK.sock('fox','chest',-0.02,0.12,0.25),{a:0.2});
    const tt=Math.max(jw,1.9);                                          // toss
    TO(c,'fox','body.rx',tt-0.2,tt,0,'outQuad'); B.arm(c,'fox','L',tt-0.15,tt+0.05,'up','outQuad'); B.armRest(c,'fox','L',tt+0.3,tt+0.6); SFX(c,tt,'whoosh');
    const tl=tt+0.55;
    TO(c,'jelly','body.sy',tl+0.05,tl+0.35,0.12,'outBack'); TO(c,'jelly','armL.rz',tl+0.05,tl+0.35,-1.0,'outBack'); TO(c,'jelly','armR.rz',tl+0.05,tl+0.35,0.6,'outBack');
    X(c,tl,'jelly','smug'); SFX(c,tl,'clink');
    const ts=tl+0.5; SAY(c,ts,'jelly',7,1); SAY(c,ts+0.9,'jelly',8,0.95); SAY(c,ts+1.8,'jelly',6,1.05);
    FN(c,'jelly','armR.rz',ts,ts+2.3,t=>0.35*Math.sin(TAU*1.5*(t-ts))); H.nod(c,'jelly',ts+0.1,6,0.12);
    B.arms(c,'muse',ts+2.4,ts+2.9,'up','inOutSine'); FXE(c,ts+2.8,'zzz','muse',1.0); B.armsRest(c,'muse',ts+3.1,ts+3.4);
    const tsh=ts+3.2; SAY(c,tsh,'jelly',1,1.6); TO(c,'jelly','armL.rz',tsh,tsh+0.15,-1.1,'outBack'); TO(c,'jelly','armR.rz',tsh,tsh+0.15,1.1,'outBack');
    FXE(c,tsh+0.05,'confetti',null,[-0.15,1.3,0.6]);
    H.hop(c,'astro',tsh+0.1,0.15); H.hop(c,'fox',tsh+0.18,0.15); H.hop(c,'muse',tsh+0.26,0.12); X(c,tsh+0.08,'astro','love'); X(c,tsh+0.16,'fox','giggle'); X(c,tsh+0.24,'muse','love');
    const td=tsh+1.0; TO(c,'jelly','armR.rz',td,td+0.2,1.1,'outQuad'); X(c,td+0.15,'jelly','smug'); SFX(c,td+0.62,'thunk',2.5); FXE(c,td+0.62,'dust','jelly'); B.shake(c,td+0.62,0.01);
    c.tick=(t)=>{ const J=S[0].u;
      if (t<tt){ attach(PROPS.crown, S[3].u.sock.handL, 0,0,0.04); }
      else if (t<tl){ const u=(t-tt)/(tl-tt); detach(PROPS.crown); PROPS.crown.visible=true; S[3].u.sock.handL.getWorldPosition(tmpV); Eng.sockWorld('jelly','headTop',tmpV2);
        PROPS.crown.position.set(tmpV.x+(tmpV2.x-tmpV.x)*u, tmpV.y+(tmpV2.y-tmpV.y)*u+1.1*u*(1-u)+0.04, tmpV.z+(tmpV2.z-tmpV.z)*u); PROPS.crown.rotation.set(0,u*TAU,0); }
      else { const tilt=t>td+0.3?Math.min(1,(t-td-0.3)/0.3):0; const b=Math.max(0,1-(t-tl)/0.35); attach(PROPS.crown, J.sock.headTop, 0.05*tilt, 0.02+0.06*b*Math.abs(Math.sin((t-tl)*18)), -0.04, 0.15*tilt,0,0.4*tilt); }
      if (t>ts-0.3 && t<td+0.2){ attach(PROPS.mic, J.sock.handR, 0,0.02,0.02, -0.3,0,0.3); }       // engulfed in the gel hand
      else if (t>=td+0.2 && t<td+1.6){ detach(PROPS.mic); PROPS.mic.visible=true; const u=Math.min(1,(t-td-0.2)/0.42); Eng.sockWorld('jelly','handR',tmpV2); if (!c._m0) c._m0=tmpV2.clone();
        PROPS.mic.position.set(c._m0.x+0.08*u, Math.max(0.02,c._m0.y*(1-u*u)), c._m0.z+0.05*u); PROPS.mic.rotation.set(u*4,0,u*1.4+0.4); }
      else detach(PROPS.mic);
    };
    c.onStart=()=>{ c._m0=null; };
    add(c,D.scenes); }

  // 6.7 glassBonk — splat on the 4th wall, IK tap on the glass, planted walk into it, stumble bounce
  { const c=Clip('glassBonk',7.6,['jelly','astro','fox'],{tags:['classic']});
    X(c,0,'jelly','shock'); X(c,0.35,'jelly','love');
    H.walk(c,'jelly',0.4,0.2,0.4,{dur:0.5}); H.splat(c,'jelly',1.05,1.0);
    const aw=H.walk(c,'astro',2.1,-0.22,0.72);
    const tap=Math.max(aw,2.9); IK.reach(c,'astro','armR',tap,tap+0.6,IK.point(-0.9,1.02,1.08),{a:0.15}); SFX(c,tap+0.22,'clink'); FXE(c,tap+0.22,'ring',null,[-0.9,1.02,1.1]);
    H.nod(c,'astro',tap+0.6,2,0.15);
    const turn=Loco.walk(c,'astro',tap+1.3,[[-0.22,0.72]],{endYaw:Math.PI*0.9,dur:0.5});
    const back=Loco.walk(c,'astro',turn.t1+0.15,[[-0.22,0.72]],{startYaw:Math.PI*0.9,endYaw:0,dur:0.35});
    const bonk=Loco.walk(c,'astro',back.t1+0.05,[[-0.22,0.98]],{dur:0.25,face:'keep'}).t1;
    SFX(c,bonk,'clank',3); B.shake(c,bonk,0.02); X(c,bonk-0.03,'astro','dizzy'); FXE(c,bonk+0.05,'stars','astro',1.4);
    Phys.launch(c,'astro',bonk,{v:[0,0.9,-1.0],maxBounce:1});
    B.pulse(c,'astro','body.sz',bonk,0.04,0.12,0.25,-0.22,'outQuad');
    const ret=bonk+0.9; Loco.walk(c,'jelly',ret,[[0.2,0.3]],{face:'keep',dur:0.6});
    B.arm(c,'astro','R',ret,ret+0.3,'head'); FN(c,'astro','armR.rx',ret+0.3,ret+1.2,t=>0.15*Math.sin(TAU*3*(t-ret))); B.armRest(c,'astro','R',ret+1.2,ret+1.4);
    H.giggle(c,'fox',bonk+0.1,1.6,{both:true});
    add(c,D.scenes); }

  // 6.9 loveStruck — slow-mo ramp on Muse, tail flip, Muse hugs the tail (IK to the fox tailTip socket) and gets dragged
  { const c=Clip('loveStruck',8.4,['muse','fox'],{tags:['classic']});
    TO(c,'fox','tail.rz',0,0.5,TAU,'inOutCubic',{noAntic:1}); K(c,'fox','tail.rz',0.5001,0); X(c,0,'fox','smug'); SFX(c,0.2,'wee');
    H.look(c,'muse',0.4,1.6,0.7,0,'inOutSine'); X(c,0.95,'muse','love'); SFX(c,1.2,'boing',0.1);
    Time.ramp(c,0.4,1.6,0.35);
    TO(c,'muse','body.py',1.6,2.0,-0.07,'outQuad'); FN(c,'muse','body.rz',1.8,2.7,t=>0.08*Math.sin(TAU*1.2*(t-1.8)));   // knees buckle (auto-grounded feet)
    TO(c,'muse','body.py',2.6,3.0,0.12,'inOutSine'); TO(c,'muse','body.px',2.6,3.8,0.42,'inOutSine'); B.arms(c,'muse',2.6,3.0,'reach','inOutSine');
    FN(c,'muse','legL.rx',2.8,3.8,t=>0.3*Math.sin(TAU*4*(t-2.8))); FN(c,'muse','legR.rx',2.8,3.8,t=>-0.3*Math.sin(TAU*4*(t-2.8)));   // dreamy air-steps (feet off the floor)
    H.doubleTake(c,'fox',3.0,-0.6); TO(c,'fox','tail.ry',3.8,4.0,-1.3,'outBack'); TO(c,'fox','tail.rz',3.8,4.0,-0.15);
    TO(c,'muse','body.py',3.8,4.1,0,'outQuad'); TO(c,'muse','body.px',3.9,4.2,0.6);
    IK.reach(c,'muse','armL',3.95,6.4,IK.sock('fox','tailTip',-0.05,-0.1,0.05),{a:0.25}); IK.reach(c,'muse','armR',3.95,6.4,IK.sock('fox','tailTip',0.05,-0.18,0.08),{a:0.25});
    const fw=H.walk(c,'fox',4.4,0.32,0.0,{dur:0.9,face:'keep'}); TO(c,'muse','body.px',4.4,fw,0.88,'inOutSine'); TO(c,'muse','body.rx',4.4,4.7,0.18); TO(c,'muse','body.rx',fw,fw+0.3,0);
    X(c,fw+0.1,'fox','embarrassed'); H.look(c,'fox',fw+0.1,fw+0.4,-0.2,0); B.hold(c,fw+0.5,0.6); TO(c,'fox','tail.ry',fw+0.9,fw+1.3,0); TO(c,'fox','tail.rz',fw+0.9,fw+1.3,0);
    add(c,D.scenes); }

  // 6.11 kungFuFail — momentum domino: each topples over its outer foot edge into the next (pivot-correct)
  { const c=Clip('kungFuFail',9.0,all,{w:1.1,tags:['classic']});
    TO(c,'astro','body.rx',0,0.3,0.45,'outQuad'); TO(c,'astro','body.rx',0.5,0.75,0); SAY(c,0.1,'astro',2,1);
    const crane=(w,t,wob)=>{ B.arm(c,w,'L',t,t+0.3,'wing'); B.arm(c,w,'R',t,t+0.3,'wing');
      if (w==='jelly'){ TO(c,w,'legL.rx',t,t+0.3,-0.6,'outBack'); TO(c,w,'body.rz',t,t+0.3,0.18,'outBack'); TO(c,w,'body.sx',t,t+0.3,0.12); }
      else { TO(c,w,'legL.rx',t,t+0.3,-1.2,'outBack'); TO(c,w,'legL.mx',t,t+0.3,1.4,'outBack'); TO(c,w,'body.rz',t,t+0.3,-0.06,'outBack'); }
      if (wob) FN(c,w,'body.rz',t+0.3,4.2,tt=>Math.sin(TAU*1.7*(tt-t))*(0.05+0.18*(tt-t)/2.4)*Math.min(1,(4.2-tt)/0.1)); };
    crane('astro',0.8,false); SFX(c,1.0,'clink'); X(c,1.1,'astro','smug');
    crane('fox',1.5,false); crane('muse',1.65,true); crane('jelly',1.8,false);
    TO(c,'fox','tail.ry',1.8,2.1,0.6,'outBack'); TO(c,'fox','tail.ry',2.4,2.7,0); X(c,1.9,'fox','smug');
    TO(c,'astro','legL.rx',3.6,3.75,0); TO(c,'astro','legL.mx',3.6,3.75,0);
    TO(c,'astro','legR.rx',3.8,3.92,-1.5,'outQuad'); TO(c,'astro','legR.rx',4.1,4.3,0); SFX(c,3.85,'hiyah');
    for (const w of ['muse','jelly','fox']){ if (w==='jelly'){ TO(c,w,'legL.rx',4.1,4.2,0); TO(c,w,'legR.rx',4.2,4.32,-0.7,'outQuad'); TO(c,w,'legR.rx',4.6,4.8,0); }
      else { TO(c,w,'legL.rx',4.1,4.2,0); TO(c,w,'legL.mx',4.1,4.2,0); TO(c,w,'legR.rx',4.2,4.32,-1.4,'outQuad'); } }
    TO(c,'fox','legR.rx',4.7,5.0,-1.4);
    // topple under gravity (inQuad), contact at ~60% passes momentum to the next, impacts escalate
    const fall=(w,t,dur,amp)=>{ X(c,t-0.05,w,'scared'); TO(c,w,'body.rz',t,t+dur,1.4,'inQuad',{noAntic:1}); B.armsRest(c,w,t,t+0.25); TO(c,w,'legR.rx',t,t+0.25,0); TO(c,w,'legL.rx',t,t+0.25,0); TO(c,w,'legL.mx',t,t+0.25,0); TO(c,w,'body.sx',t,t+0.25,0);
      FN(c,w,'body.sy',t+dur,t+dur+0.5,tt=>-0.15*Math.exp(-(tt-t-dur)*8)*Math.cos((tt-t-dur)*22)); SFX(c,t+dur,Eng.PROF[w].impact,amp); B.shake(c,t+dur,0.006*amp); FXE(c,t+dur,'dust',w); X(c,t+dur+0.02,w,'dizzy'); return t+dur*0.6; };
    let tn=fall('muse',4.3,0.62,1.5); tn=fall('astro',tn,0.55,2.2); fall('jelly',tn,0.5,3);
    B.armsRest(c,'astro',4.2,4.45);
    H.look(c,'fox',5.5,5.8,0.7,0.2); H.look(c,'fox',6.2,6.5,0,0); B.hold(c,6.55,0.5); TO(c,'fox','legR.rx',6.6,7.1,0,'inOutSine'); B.armsRest(c,'fox',6.6,7.1); TO(c,'fox','tail.ry',6.6,7.1,0);
    TO(c,'fox','body.rz',7.2,7.62,1.35,'inQuad',{noAntic:1}); SFX(c,7.62,'thud',1.5); X(c,7.66,'fox','smug'); FXE(c,7.62,'dust','fox');
    for (const w of ['muse','astro','jelly']){ TO(c,w,'body.sy',7.62,7.72,-0.08,'outQuad'); TO(c,w,'body.sy',7.72,7.95,0,'outBack'); }
    c.dur=8.6+1.2;
    add(c,D.scenes); }

  /* =====================================================================
     MOVES LIBRARY — every character: walk, run, sneak, jump, wave, spin, look-around
     (planted-foot locomotion; Jelly walks on its gel legs, hop-walk kept as an option)
     ===================================================================== */
  const NAMES={jelly:'Jelly',astro:'Astro',muse:'Muse',fox:'Fox'};
  const envF=(a,b,t,r=0.22)=>Eng.sst(a,a+r,t)*(1-Eng.sst(b-r,b,t));
  const armOff=(who,side,name)=>{ const sg=side==='L'?-1:1, p=ARM[name](sg), r=REST[who]['arm'+side];
    if (who==='jelly') return {rz:clamp(p.rz*0.42,-1.05,1.05), rx:clamp(p.rx*0.4,-0.6,0.6), mz:0, mx:0};
    return {rz:p.rz-r.rz, rx:p.rx-r.rx, mz:p.mz-r.mz, mx:p.mx-r.mx}; };
  /* hold an arm pose (offset from rest) inside [t0,t1] with smooth blend in/out; optional fn adds motion on top */
  const armHold=(c,who,side,t0,t1,name,extra)=>{ const o=armOff(who,side,name);
    for (const k of ['rz','rx','mz','mx']) if (o[k]) FN(c,who,'arm'+side+'.'+k,t0,t1,t=>o[k]*envF(t0,t1,t)+(extra&&extra[k]?extra[k](t)*envF(t0,t1,t):0));
    if (extra) for (const k of ['rz','rx','mz','mx']) if (!o[k] && extra[k]) FN(c,who,'arm'+side+'.'+k,t0,t1,t=>extra[k](t)*envF(t0,t1,t)); };
  /* oscillate an arm between two poses: phase 0 = A, 0.5 = B */
  const armOsc=(c,who,side,t0,t1,A,Bp,period,ph=0)=>{ const a=armOff(who,side,A), b=armOff(who,side,Bp);
    for (const k of ['rz','rx','mz','mx']) if (a[k]||b[k]) FN(c,who,'arm'+side+'.'+k,t0,t1,t=>{ const m=0.5-0.5*Math.cos(TAU*(t-t0)/period+ph); return (a[k]+(b[k]-a[k])*m)*envF(t0,t1,t); }); };
  ARM.pump  = s=>({rz:0.35*s, rx:-0.9, mz:0, mx:-1.6});
  ARM.point = s=>({rz:2.45*s, rx:-0.45, mz:0.1*s, mx:0});
  ARM.twist = s=>({rz:0.55*s, rx:-0.35, mz:0, mx:-1.45});
  ARM.sneak = s=>({rz:0.45*s, rx:-0.95, mz:0, mx:-1.35});
  ARM.run   = s=>({rz:0.2*s, rx:0, mz:0, mx:-1.3});
  ARM.roboOut=s=>({rz:1.55*s, rx:0, mz:0, mx:0});
  ARM.roboUp =s=>({rz:1.55*s, rx:0, mz:1.5*s, mx:0});
  ARM.roboFwd=s=>({rz:0.1*s, rx:-1.55, mz:0, mx:0});
  ARM.roboBent=s=>({rz:0.25*s, rx:-0.15, mz:0, mx:-1.57});
  ARM.wave  = s=>({rz:2.35*s, rx:-0.3, mz:0.5*s, mx:0});
  ARM.brow  = s=>({rz:0.6*s, rx:-1.5, mz:-0.4*s, mx:-1.75});
  const mk=(id,cast,tags)=>Clip(id,2,cast,{tags});
  for (const who of all){
    { const c=mk('walk_'+who,[who],['move']);                                       // walk toward camera, turn, walk back
      const p1=Loco.walk(c,who,0.15,[[0,0.55]]); X(c,0.1,who,'smug');
      const p2=Loco.walk(c,who,p1.t1+0.25,[[0,0]],{endYaw:0}); X(c,p2.t1,who,'neutral'); add(c); }
    { const c=mk('run_'+who,[who],['move']);                                        // run a loop in front of the spot
      const pts=[]; for (let i=1;i<=12;i++){ const a=i/12*TAU; pts.push([0.36*Math.sin(a), 0.38-0.38*Math.cos(a)]); }
      X(c,0,who,'shock'); const pl=Loco.walk(c,who,0.2,pts,{style:'run',endYaw:0});
      if (who!=='jelly'){ armHold(c,who,'L',0.2,pl.t1,'run'); armHold(c,who,'R',0.2,pl.t1,'run'); }
      SAY(c,0.3,who,4,1.3); X(c,pl.t1-0.2,who,'giggle'); add(c); }
    { const c=mk('sneak_'+who,[who],['move']);                                      // tiptoe sideways, hunched, looking around
      const d=who==='fox'||who==='muse'?-0.35:0.35;
      const p1=Loco.walk(c,who,0.3,[[d,0.12]],{style:'tiptoe',face:'keep'}); X(c,0.2,who,'smug');
      armHold(c,who,'L',0.15,p1.t1+1.6,'sneak'); armHold(c,who,'R',0.15,p1.t1+1.6,'sneak');
      FN(c,who,'body.rx',0.2,p1.t1+1.6,t=>0.12*envF(0.2,p1.t1+1.6,t));
      H.look(c,who,0.5,0.8,-0.5,0); H.look(c,who,1.1,1.4,0.5,0); H.look(c,who,p1.t1,p1.t1+0.3,0,0);
      const p2=Loco.walk(c,who,p1.t1+0.2,[[0,0]],{style:'tiptoe',face:'keep'}); add(c); }
    { const c=mk('jump_'+who,[who],['move']);                                       // crouch, big jump, tuck, land squash
      B.plant(c,who,0.1,0.75); TO(c,who,'body.py',0.15,0.55,-0.09,'inOutSine',{noAntic:1}); TO(c,who,'body.py',0.55,0.62,0,'outQuad',{noAntic:1});
      X(c,0.5,who,'shock'); const tl=H.hop(c,who,0.62,0.42,0.6,{bounces:2});
      FN(c,who,'legL.mx',0.66,tl-0.05,t=>0.9*Math.sin(Math.PI*clamp((t-0.66)/(tl-0.71),0,1))); FN(c,who,'legR.mx',0.66,tl-0.05,t=>0.9*Math.sin(Math.PI*clamp((t-0.66)/(tl-0.71),0,1)));
      X(c,tl,who,'giggle'); add(c); }
    { const c=mk('wave_'+who,[who],['move']);                                       // friendly hello wave
      X(c,0.1,who,'giggle'); SAY(c,0.3,who,3,1.2);
      armHold(c,who,'R',0.2,2.6,'wave',{rz:t=>0.32*Math.sin(TAU*2.2*(t-0.2)), mz:t=>0.3*Math.sin(TAU*2.2*(t-0.2)+0.6)});
      FN(c,who,'head.rz',0.2,2.6,t=>0.12*envF(0.2,2.6,t)); FN(c,who,'body.rz',0.2,2.6,t=>-0.04*envF(0.2,2.6,t));
      B.plant(c,who,0.2,2.6); FN(c,who,'body.py',0.2,2.6,t=>-0.02*(0.5+0.5*Math.cos(TAU*2.2*(t-0.2)))*envF(0.2,2.6,t)); add(c); }
    { const c=mk('spin_'+who,[who],['move']);                                       // turn around on the spot, stepping
      const pl=Loco.walk(c,who,0.2,[[0,0]],{startYaw:0,endYaw:TAU}); K(c,who,'body.ry',pl.t1+2e-4,0,'step0');
      X(c,0.2,who,'giggle'); FN(c,who,'tail.ry',0.2,pl.t1,t=>0.6*envF(0.2,pl.t1,t)); add(c); }
    { const c=mk('look_'+who,[who],['move']);                                       // hand over brow, scan the horizon
      armHold(c,who,'R',0.2,3.0,'brow'); B.plant(c,who,0.2,3.0);
      H.look(c,who,0.4,1.0,-0.6,-0.1,'inOutSine'); H.look(c,who,1.3,2.1,0.6,-0.1,'inOutSine'); H.look(c,who,2.4,2.8,0,0,'inOutSine');
      FN(c,who,'body.ry',0.4,2.8,t=>0.2*Math.sin(TAU*(t-0.4)/2.4)*envF(0.4,2.8,t)); X(c,2.5,who,'shock'); add(c); }
  }
  { const c=mk('hopwalk_jelly',['jelly'],['move']);                                  // the old bouncy scoot, kept as a style
    const p1=Loco.walk(c,'jelly',0.15,[[0.45,0.2]],{style:'scoot'}); Loco.walk(c,'jelly',p1.t1+0.3,[[0,0]],{style:'scoot'}); add(c); }
  { const c=mk('strut_fox',['fox'],['move']);                                        // catwalk strut, tail swish
    const p1=Loco.walk(c,'fox',0.15,[[0,0.5]],{style:'strut'}); X(c,0.1,'fox','smug');
    armHold(c,'fox','L',0.15,p1.t1+0.6,'hips'); FN(c,'fox','tail.ry',0.15,p1.t1,t=>0.5*Math.sin(TAU*1.3*(t-0.15)));
    H.look(c,'fox',p1.t1,p1.t1+0.25,0.3,-0.1); B.hold(c,p1.t1+0.3,0.5);
    Loco.walk(c,'fox',p1.t1+0.4,[[0,0]],{style:'strut',endYaw:0}); add(c); }

  /* =====================================================================
     DANCES — 120 BPM, beat-synced, feet planted or stepping with footwork tracks
     ===================================================================== */
  const BT=0.5;
  const bounce=(c,who,t0,t1,d=0.035)=>{ const k=who==='muse'?0.8:who==='jelly'?1.3:1;
    FN(c,who,'body.py',t0,t1,t=>-d*k*(0.5+0.5*Math.cos(TAU*(t-t0)/BT))*envF(t0,t1,t));
    FN(c,who,'head.rx',t0,t1,t=>0.07*(0.5+0.5*Math.cos(TAU*(t-t0)/BT-0.6))*envF(t0,t1,t));
    if (who==='jelly') FN(c,who,'body.sy',t0,t1,t=>-0.05*(0.5+0.5*Math.cos(TAU*(t-t0)/BT))*envF(t0,t1,t));
    if (who==='fox') FN(c,who,'tail.ry',t0,t1,t=>0.35*Math.sin(TAU*(t-t0)/BT)*envF(t0,t1,t)); };
  const stepTouch=(c,who,t0,bars,w=0.12)=>{ const d=0.2;
    for (let b=0;b<bars;b++){ const tb=t0+b*4*BT, dir=b%2?-1:1, lead=dir>0?'R':'L', trail=dir>0?'L':'R';
      B.foot(c,who,lead,tb,tb+d,dir*w,0,0.05); B.foot(c,who,trail,tb+BT,tb+BT+d,dir*w,0,0.04);
      B.foot(c,who,trail,tb+2*BT,tb+2*BT+d,0,0,0.04); B.foot(c,who,lead,tb+3*BT,tb+3*BT+d,0,0,0.05);
      FN(c,who,'body.rz',tb,tb+4*BT,t=>-dir*0.06*Math.sin(Math.PI*(t-tb)/(4*BT))); }
    B.hips(c,who,t0,t0+bars*4*BT); };
  const dance=(id,cast,bars,fn,o={})=>{ const c=Clip(id,2,cast,{tags:['dance',...(o.tags||[])],w:o.w||1}); const t0=0.3, n=bars*4, t1=t0+n*BT;
    B.beat(c,t0,n); fn(c,t0,t1,n); add(c,o.solo?null:D.scenes); return c; };

  dance('danceGroove',all,4,(c,t0,t1)=>{ for (const w of all){ bounce(c,w,t0,t1); stepTouch(c,w,t0,4,w==='jelly'||w==='muse'?0.1:0.12);
      if (w!=='jelly'){ armOsc(c,w,'L',t0,t1,'down','pump',2*BT,0); armOsc(c,w,'R',t0,t1,'down','pump',2*BT,Math.PI); }
      else { FN(c,w,'armL.rz',t0,t1,t=>-0.7*Math.abs(Math.sin(TAU*(t-t0)/(4*BT)))*envF(t0,t1,t)); FN(c,w,'armR.rz',t0,t1,t=>0.7*Math.abs(Math.cos(TAU*(t-t0)/(4*BT)))*envF(t0,t1,t)); }
      X(c,t0,w,'giggle'); } SAY(c,t1-1,'astro',3,1.4); });
  dance('danceDisco',all,4,(c,t0,t1)=>{ for (const w of all){ bounce(c,w,t0,t1,0.025); stepTouch(c,w,t0,4,0.1);
      armOsc(c,w,'R',t0,t1,'hips','point',4*BT,0); armOsc(c,w,'L',t0,t1,'point','hips',4*BT,0);
      FN(c,w,'body.ry',t0,t1,t=>0.25*Math.sin(TAU*(t-t0)/(4*BT))*envF(t0,t1,t)); FN(c,w,'head.ry',t0,t1,t=>0.3*Math.sin(TAU*(t-t0)/(4*BT))*envF(t0,t1,t));
      X(c,t0,w,'smug'); } B.fx(c,t1-0.2,'confetti',null,[0,1.6,0.6]); });
  const ROBO=[['roboOut','roboOut'],['roboUp','down'],['down','roboUp'],['roboFwd','roboFwd'],['roboBent','roboUp'],['roboUp','roboBent'],['roboOut','roboUp'],['down','down']];
  const robot=(c,w,t0,n,lag=0)=>{ for (let i=0;i<n;i++){ const t=t0+i*BT+lag, P=ROBO[i%ROBO.length];
      B.arm(c,w,'L',t,t+0.07,P[0],'outQuart'); B.arm(c,w,'R',t,t+0.07,P[1],'outQuart');
      TO(c,w,'head.ry',t,t+0.06,[0,0.45,-0.45,0,0.3,-0.3,0.2,0][i%8],'outQuart',{noAntic:1});
      TO(c,w,'body.ry',t,t+0.06,[0,0.3,-0.3,0,-0.2,0.2,0,0][i%8],'outQuart',{noAntic:1});
      B.pulse(c,w,'body.py',t,0.05,0.05,0.12,-0.025,'outQuart','inOutSine'); }
    B.armsRest(c,w,t0+n*BT+lag,t0+n*BT+lag+0.15,'outQuart'); TO(c,w,'head.ry',t0+n*BT+lag,t0+n*BT+lag+0.15,0); TO(c,w,'body.ry',t0+n*BT+lag,t0+n*BT+lag+0.15,0);
    B.plant(c,w,t0,t0+n*BT+lag+0.2); X(c,t0,w,'smug'); };
  dance('danceRobot',all,4,(c,t0,t1,n)=>{ robot(c,'astro',t0,n); robot(c,'fox',t0,n,0.06); robot(c,'muse',t0,n,0.12); robot(c,'jelly',t0,n,0.25); X(c,t0+1,'jelly','embarrassed'); });
  dance('danceTwist',all,4,(c,t0,t1)=>{ for (const w of all){ B.plant(c,w,t0,t1);
      FN(c,w,'body.py',t0,t1,t=>(-0.06-0.02*Math.cos(TAU*(t-t0)/BT*2))*envF(t0,t1,t)*(w==='jelly'?0.7:1));
      FN(c,w,'body.ry',t0,t1,t=>0.42*Math.sin(TAU*(t-t0)/BT)*envF(t0,t1,t)); FN(c,w,'head.ry',t0,t1,t=>-0.3*Math.sin(TAU*(t-t0)/BT)*envF(t0,t1,t));
      armHold(c,w,'L',t0,t1,'twist',{rx:t=>0.35*Math.sin(TAU*(t-t0)/BT)}); armHold(c,w,'R',t0,t1,'twist',{rx:t=>-0.35*Math.sin(TAU*(t-t0)/BT)});
      if (w==='fox') FN(c,w,'tail.ry',t0,t1,t=>-0.5*Math.sin(TAU*(t-t0)/BT)*envF(t0,t1,t)); X(c,t0,w,'giggle'); } });
  dance('danceWave',all,4,(c,t0,t1)=>{ const order=['jelly','astro','muse','fox']; let t=t0;
    for (let k=0;k<3;k++){ const gap=0.22/(1+0.35*k); order.forEach((w,i)=>{ const ti=t+i*gap; B.arm(c,w,'L',ti,ti+0.15,'up'); B.arm(c,w,'R',ti,ti+0.15,'up');
        H.hop(c,w,ti+0.05,0.06+0.03*k,0.3,{arms:false,sfx:false}); B.armsRest(c,w,ti+0.45,ti+0.7); X(c,ti,w,'giggle'); }); t+=4*BT; }
    for (const w of order){ B.arm(c,w,'L',t,t+0.15,'up'); B.arm(c,w,'R',t,t+0.15,'up'); H.hop(c,w,t+0.1,0.14,0.42,{arms:false}); X(c,t,w,'love'); B.armsRest(c,w,t+1.1,t+1.4); }
    B.fx(c,t+0.15,'confetti',null,[0,1.6,0.6]); for (const w of order) bounce(c,w,t0,t1,0.02); });
  dance('danceBoxStep',all,3,(c,t0,t1)=>{ const a=0.1; for (const w of all){
      for (let b=0;b<2;b++){ const tb=t0+b*6*BT, d=0.22;
        B.foot(c,w,'L',tb,tb+d,0,a); B.foot(c,w,'R',tb+BT,tb+BT+d,a,a); B.foot(c,w,'L',tb+2*BT,tb+2*BT+d,a,a,0.03);
        B.foot(c,w,'R',tb+3*BT,tb+3*BT+d,a,0); B.foot(c,w,'L',tb+4*BT,tb+4*BT+d,0,0); B.foot(c,w,'R',tb+5*BT,tb+5*BT+d,0,0,0.03); }
      B.hips(c,w,t0,t1); bounce(c,w,t0,t1,0.02);
      if (w!=='jelly'){ armHold(c,w,'L',t0,t1,'wide',{rz:t=>-0.15*Math.sin(TAU*(t-t0)/(6*BT))}); armHold(c,w,'R',t0,t1,'wide',{rz:t=>0.15*Math.sin(TAU*(t-t0)/(6*BT))}); }
      FN(c,w,'body.rz',t0,t1,t=>0.08*Math.sin(TAU*(t-t0)/(3*BT))*envF(t0,t1,t)); X(c,t0,w,'love'); } });
  // ---- solos (others cheer / clap along)
  const cheer=(c,w,t0,t1)=>{ bounce(c,w,t0,t1,0.015); B.plant(c,w,t0,t1); if (w!=='jelly'){ armHold(c,w,'L',t0,t1,'clap',{rz:t=>0.25*Math.max(0,Math.sin(TAU*(t-t0)/BT))}); armHold(c,w,'R',t0,t1,'clap',{rz:t=>-0.25*Math.max(0,Math.sin(TAU*(t-t0)/BT))}); } X(c,t0,w,'giggle'); };
  dance('soloRobot_astro',all,4,(c,t0,t1,n)=>{ robot(c,'astro',t0,n); for (const w of ['jelly','muse','fox']) cheer(c,w,t0,t1); SAY(c,t1-0.6,'astro',2,1.5); },{w:0.8});
  dance('soloMoonwalk_fox',all,4,(c,t0,t1)=>{ const d=0.055; let zL=0,zR=0, t=t0;
      for (let k=0;k<12;k++){ const f=k%2?'R':'L', step=k===0?d:2*d; if (f==='L'){ zL-=step; B.foot(c,'fox','L',t,t+BT*0.9,0,zL,0.0); B.foot(c,'fox','R',t,t+BT*0.9,0,zR,0.035); }
        else { zR-=step; B.foot(c,'fox','R',t,t+BT*0.9,0,zR,0.0); B.foot(c,'fox','L',t,t+BT*0.9,0,zL,0.035); } t+=BT; }
      zR=zL; B.foot(c,'fox','R',t,t+0.25,0,zR,0.03); B.hips(c,'fox',t0,t+0.3);
      armHold(c,'fox','R',t0,t+0.3,'point',{rz:t=>0.15*Math.sin(TAU*(t-t0)/BT)}); armHold(c,'fox','L',t0,t+0.3,'hips');
      FN(c,'fox','tail.ry',t0,t+0.3,t=>0.45*Math.sin(TAU*(t-t0)/(2*BT))*envF(t0,t+0.3,t)); FN(c,'fox','head.rz',t0,t,t=>0.1*Math.sin(TAU*(t-t0)/BT)*envF(t0,t,t));
      X(c,t0,'fox','smug'); SAY(c,t-0.4,'fox',2,1.6); for (const w of ['jelly','astro','muse']) cheer(c,w,t0,t1); },{w:0.8});
  dance('soloSlowJam_muse',all,4,(c,t0,t1)=>{ B.plant(c,'muse',t0,t1);
      FN(c,'muse','body.rz',t0,t1,t=>0.13*Math.sin(TAU*(t-t0)/(4*BT))*envF(t0,t1,t)); FN(c,'muse','body.py',t0,t1,t=>-0.04*(0.5+0.5*Math.cos(TAU*(t-t0)/(2*BT)))*envF(t0,t1,t));
      armHold(c,'muse','L',t0,t1,'up',{rz:t=>0.35*Math.sin(TAU*(t-t0)/(4*BT))}); armHold(c,'muse','R',t0,t1,'up',{rz:t=>0.35*Math.sin(TAU*(t-t0)/(4*BT))});
      FN(c,'muse','head.rz',t0,t1,t=>0.15*Math.sin(TAU*(t-t0)/(4*BT)+0.5)*envF(t0,t1,t)); X(c,t0,'muse','giggle'); B.fx(c,t0+2,'hearts','muse',3);
      for (const w of ['jelly','astro','fox']){ B.plant(c,w,t0,t1); FN(c,w,'body.rz',t0,t1,t=>0.06*Math.sin(TAU*(t-t0)/(4*BT))*envF(t0,t1,t)); X(c,t0,w,'love'); } },{w:0.8});
  dance('soloWobble_jelly',all,4,(c,t0,t1,n)=>{ FN(c,'jelly','body.sy',t0,t1,t=>0.13*Math.cos(TAU*(t-t0)/BT)*envF(t0,t1,t));
      FN(c,'jelly','armL.rz',t0,t1,t=>-0.85*(0.5+0.5*Math.sin(TAU*(t-t0)/BT))*envF(t0,t1,t)); FN(c,'jelly','armR.rz',t0,t1,t=>0.85*(0.5+0.5*Math.sin(TAU*(t-t0)/BT+Math.PI))*envF(t0,t1,t));
      FN(c,'jelly','body.rz',t0,t1,t=>0.1*Math.sin(TAU*(t-t0)/(2*BT))*envF(t0,t1,t));
      for (let i=1;i<n-1;i+=2) H.hop(c,'jelly',t0+i*BT,0.05,0.24,{arms:false,sfx:false});
      X(c,t0,'jelly','giggle'); for (const w of ['astro','muse','fox']) cheer(c,w,t0,t1); },{w:0.8});

  /* ---------- reveal / game-state reactions (§7) ---------- */
  { const c=Clip('reveal_correct',4.4,all,{tags:['reveal']});
    all.forEach((w,i)=>{ H.hop(c,w,0.2+i*0.06,0.18,0.42); H.hop(c,w,0.8+i*0.06,0.14,0.38); B.arms(c,w,0.1+i*0.06,0.3+i*0.06,'up'); X(c,0.2,w,'love'); });
    FXE(c,0.25,'confetti',null,[0,1.8,0.3]);
    add(c); }
  { const c=Clip('reveal_wrong',4.0,all,{tags:['reveal']});
    for (const w of ['astro','muse','fox']){ B.arm(c,w,'R',0.1,0.35,'face'); TO(c,w,'head.rx',0.15,0.45,0.35,'outQuad'); X(c,0.3,w,'embarrassed'); }
    TO(c,'jelly','body.sy',0.1,0.6,-0.25,'outQuad'); X(c,0.2,'jelly','scared'); FXE(c,0.4,'sweat','jelly');
    add(c); }
  { const c=Clip('wyr_majority',4.0,all,{tags:['reveal']});
    for (const w of ['jelly','astro','muse']){ TO(c,w,'body.rz',0.1,0.5,-0.15,'outBack'); H.look(c,w,0.1,0.5,-0.4,0); }
    B.arms(c,'fox',0.1,0.4,'cross'); X(c,0.2,'fox','smug'); TO(c,'fox','head.rx',0.1,0.4,-0.15); TO(c,'fox','tail.ry',0.1,0.6,0.5);
    add(c); }
  { const c=Clip('clap',3.2,all,{tags:['reveal']});
    for (const w of ['astro','muse','fox']){ B.arms(c,w,0,0.2,'clap'); FN(c,w,'armL.rz',0.2,1.8,t=>0.3*Math.max(0,Math.sin(TAU*6*(t-0.2)))); FN(c,w,'armR.rz',0.2,1.8,t=>-0.3*Math.max(0,Math.sin(TAU*6*(t-0.2)))); X(c,0.2,w,'giggle'); }
    add(c); }
}


/* ---------------- public API ---------------- */
function seek(id, st){ // test helper: play scene id from 0 and simulate to st at 60 Hz (deterministic)
  D.seeking=true; play(id,{force:true}); const n=Math.round(st*60); return n; }
function seekTo(t){ const c=D.clip; if (!c) return; D.ct=clamp(t,0,c.dur-1e-3); D.holdLeft=0; let i=c.events.findIndex(e=>e[0]>D.ct); D.evI=i<0?c.events.length:i; }
const api = { setExprIx:setExpr, CI, REST, KIND_IX, refresh:()=>update(0,D.now,ctx), seekTo, init, update, play, stop, setMode, setExpr:(who,n)=>setExpr(KIND_IX[who],n), E, H, B, D, S, PROPS, spawnFx, attach, detach, Audio:Audio_, seek,
  IK, Loco, Phys, Attach, Time, Clip, CI, CH, KIND_IX, resolveClip, stats:()=>Eng.STATS, add:(c,list)=>{ D.clips[c.id]=c; if (list) (list==='micro'?D.micros:D.scenes).push(c.id); return c; },
  reveal(kind){ const m={correct:'reveal_correct', wrong:'reveal_wrong', majority:'wyr_majority', clap:'clap'}[kind]; if (m) play(m,{force:true}); },
  get list(){ return { scenes:D.scenes.slice(), micros:D.micros.slice(), all:Object.keys(D.clips) }; } };
return api;
})();

/* Director facade for the Fun Friday app */
window.CrewDirector = {
  setMode:(m)=>Anim.setMode(m), play:(id,o)=>Anim.play(id,o||{}), stop:(o)=>Anim.stop(o||{}),
  onSceneEnd:(cb)=>Anim.D.cbs.push(cb), reveal:(k)=>Anim.reveal(k), list:()=>Anim.list,
};

