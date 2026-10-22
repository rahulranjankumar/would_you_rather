/* =====================================================================
   BAND - v30 compositor (replaces the lab's main.js + bridge.js)
   - Every crew band on the page is a headless v29 Stage (assets/crew.js): it still
     runs the 42 scenes, game moments, eggs, pokes and speech bubbles.
   - ONE transparent full-screen canvas draws Astro, Jelly and Muse for the newest
     visible band. The camera maps metres to that band's DOM pixels, so feet land on
     the same floor line, bubbles and hit boxes stay where v29 put them.
   - Retarget: v29 pose -> our rigs, with critically damped smoothing, unwrapped yaw,
     procedural foot planting (two-bone IK), seat drop, faces, decals, fur looks.
   Made by PPA Warriors
   ===================================================================== */
{
const K_UNIT = 1.15;                                   // 1 v29 unit = 1.15 m
const FOVY = 28, TAN = Math.tan(FOVY * Math.PI / 360);
const KINDS = ['jelly', 'astro', 'muse'];             // crew order === Anim.KIND_IX
const SLOT = { jelly: 'bop', astro: 'bip', muse: 'boop' };
const HOLD_SLOTS = ['bip', 'bop', 'boop'], SLOT_CI = { bip: 1, bop: 0, boop: 2 };
const PF = window.FFAperf || null;
const tierNow = () => (PF && PF.tier ? PF.tier() : 'high');
const BIG = /^\/screen/.test(location.pathname);
const clampv = Eng.clamp, wrapA = Eng.wrapA;

/* fur shell budget (shells are the costliest draw); the TV screen gets the full coat */
FUR_Q = ({ ultra: 0.75, high: 0.55, balanced: 0.4, eco: 0.35 })[tierNow()] || 0.5;
if (BIG && (tierNow() === 'ultra' || tierNow() === 'high')) FUR_Q = 1;
if (P.has('furq')) FUR_Q = clampv(+P.get('furq') || 1, 0.2, 1);

/* ---------- renderer + lights (studio env from core; no floor: the page is the floor) ---------- */
renderer.autoClear = false;
camera.layers.enable(1);
const cv = renderer.domElement;
const rig = new T.Group(); scene.add(rig);
rig.add(new T.HemisphereLight(0xdfe9ff, 0x1a120c, 0.35));
const keyL = new T.DirectionalLight(0xffeedd, 1.7); keyL.position.set(-3, 5, 6); rig.add(keyL, keyL.target);
const fillL = new T.DirectionalLight(0xffffff, 0.35); fillL.position.set(3, 2, 6); rig.add(fillL, fillL.target);
const rimB = new T.SpotLight(0x4fb6ff, 6, 12, 0.7, 0.6); rimB.position.set(-3.6, 2.6, -3.2); rimB.target.position.set(-1.6, 0.8, 0); rig.add(rimB, rimB.target);
const rimO = new T.SpotLight(0xff7a2a, 6, 12, 0.7, 0.6); rimO.position.set(3.6, 2.6, -3.2); rimO.target.position.set(1.4, 0.8, 0); rig.add(rimO, rimO.target);
const topL = new T.PointLight(0xfff4e6, 0.6, 10); topL.position.set(0, 4, 1.5); rig.add(topL);

/* ---------- the crew: Jelly, Astro, Muse (no fox) ---------- */
const crew = [makeJelly(), makeAstronaut(), makeMuse()];
const BLOB = [[1.7, 1.2, 0.6], [1.1, 0.9, 0.8], [1.5, 1.1, 0.8]];
crew.forEach((c, i) => { c.position.set(0, 0, 0); c.rotation.y = 0; scene.add(c); const b = shadowBlob(BLOB[i][0], BLOB[i][1], BLOB[i][2]); scene.add(b); c.userData.shadow = b; });
Anim.init(crew);
const S3 = Anim.S, CI = Anim.CI, REST = Anim.REST;

/* natural model heights -> v29 heights (Astro = tall Bip, Jelly = short Bop, Muse = chubby Boop) */
const XS = crew.map((c, ci) => {
  const kind = KINDS[ci], box = new T.Box3(), v = new T.Vector3();
  c.updateMatrixWorld(true); box.setFromObject(c.userData.body); box.getSize(v);
  const H = Math.max(0.6, v.y), D = window.Crew && window.Crew.DESIGN ? window.Crew.DESIGN[SLOT[kind]] : null;
  const base = ((D ? D.h : 1.2) + 0.12) * K_UNIT / H;
  const s = S3[ci]; let seatDrop = 0.10;
  if (kind !== 'jelly') { const hipY = c.userData.rig.legL.root.position.y; seatDrop = Math.max(0.08, 0.82 * (hipY - s.restFoot[0].y)); }
  const sp = []; for (let i = 0; i < 23; i++) sp.push({ x: 0, v: 0 });
  return { ci, kind, H, base, seatDrop, sp, snap: true, hasPrev: false, px: 0, pz: 0, vx: 0, vz: 0, ryU: 0, ryPrev: 0, ryInit: false,
    hip: [0, 0], cream: false, stache: false, dizzy: false, starsAt: 0, zzzAt: 0,
    af: { w: 0, init: false, plant: [new T.Vector3(), new T.Vector3()], yaw: [0, 0], step: -1, t0: 0, dur: 0.25, from: new T.Vector3(), lift: 0, last: 0, u: 0 } };
});

/* ---------- channel indices ---------- */
const iPX = CI['body.px'], iPY = CI['body.py'], iPZ = CI['body.pz'], iRX = CI['body.rx'], iRY = CI['body.ry'], iRZ = CI['body.rz'];
const iSY = CI['body.sy'], iSX = CI['body.sx'], iSZ = CI['body.sz'], iCOM = CI['pivot.com'];
const iSOOT = CI['look.soot'], iFRZ = CI['look.frizz'], iSPK = CI['look.spike'], iPOOF = CI['look.poof'], iHRX = CI['head.rx'], iHRY = CI['head.ry'];
const LB = ['armL', 'armR', 'legL', 'legR'].map(l => CI[l + '.rz']);

/* ---------- state ---------- */
const STAGES = [];
let active = null, STICKER = false;
let PX = null, PY = null;
const camX = { x: 0, y: 0, ppm: 100, D: 20, vw: 0, vh: 0 };
const gaze = new T.Vector3(0, 1.2, 5), gazeS = new T.Vector3(0, 1.2, 5);
const tmp = new T.Vector3(), tmp2 = new T.Vector3(), ZV = new T.Vector3(0, 0, 1), qTmp = new T.Quaternion();
const HOME = [new T.Vector3(), new T.Vector3()], LAND = new T.Vector3(), FOOT = new T.Vector3();

/* ---------- eyes: aim + shared blink rhythm (from the lab) ---------- */
function aimEye(e, t) {
  const u = e.userData;
  if (t > u.nextSacc) { u.sacc.set(rnd(-0.12, 0.12), rnd(-0.08, 0.08), 0); u.nextSacc = t + rnd(0.5, 2.2); }
  tmp.copy(gazeS).add(u.sacc); e.worldToLocal(tmp); tmp.normalize();
  const maxA = 0.55, ang = Math.acos(clampv(tmp.z, -1, 1));
  if (ang > maxA) { const k = Math.sin(maxA) / Math.max(1e-4, Math.hypot(tmp.x, tmp.y)); tmp.set(tmp.x * k, tmp.y * k, Math.cos(maxA)); }
  qTmp.setFromUnitVectors(ZV, tmp); u.ball.quaternion.slerp(qTmp, STICKER ? 1 : 0.35);
}
const blinkNext = [rnd(1, 3), rnd(1, 3), rnd(1, 3)], blinkT = [-1, -1, -1];
function blinkAmount(i, t) {
  if (STICKER) return 0;
  if (t > blinkNext[i]) { blinkT[i] = t; blinkNext[i] = t + rnd(2.2, 5.0) + (Math.random() < 0.2 ? -1.9 : 0); }
  const d = t - blinkT[i]; if (d < 0 || d > 0.16) return 0; return Math.sin(d / 0.16 * Math.PI);
}
const GZ = { gaze: gazeS, aimEye, blinkAmount, quality: 'high', skipDeform: false, dragging: false, shake: 0 };

/* ---------- retarget helpers ---------- */
function sm(X, j, goal, hl, dt, snap) { const o = X.sp[j]; if (snap) { o.x = goal; o.v = 0; return goal; } return Eng.crit(o, goal, hl, dt); }
function exprOf(V) {
  if (V.eyes === 'x' || V.dizzy) return 'dizzy';
  if (V.lid != null && V.lid >= 0.6) return 'sleepy';
  if (V.cream && V.eyes === 'closed') return 'embarrassed';
  if (V.eyes === 'wide' || V.mouth === 'o') return 'shock';
  if (V.mouth === 'frown') return V.brow < 0 ? 'sad' : 'scared';
  if (V.eyes === 'happy') return (V.mouth === 'smile' && V.armLf > 0.6 && V.armRf > 0.6) ? 'love' : 'giggle';   // hearts only for the hug pose
  if (V.brow > 0) return 'smug';
  if (V.eyes === 'closed') return 'embarrassed';
  if (V.mouth === 'open' || V.mouth === 'grin') return 'giggle';
  return 'neutral';
}
const DECAL_S = { jelly: 1.35, astro: 1.2, muse: 1.1 };

/* ---------- ext.pre: tick the active v29 stage (scenes, eggs, bubbles) ---------- */
function pre(dt) { if (active && !STICKER) active.tick(performance.now(), dt); }

/* ---------- ext.pose: v29 pose -> our channels ---------- */
function pose(s, o, t, dt) {
  const st = active; if (!st) return;
  const X = XS[s.ci], ch = st.chars[SLOT[s.kind]]; if (!ch) return;
  const V = ch.P, root = crew[s.ci], jelly = s.kind === 'jelly', R = REST[s.kind];
  const snap = X.snap; X.snap = false;
  const dts = dt > 0 ? dt : 1 / 60;
  const hide = !!V.hide;
  root.visible = !hide; if (s.u.shadow) s.u.shadow.visible = !hide;
  const rs = X.base * (ch.root.s[0] || 1); root.scale.setScalar(rs);
  const k = K_UNIT / rs;                               // v29 units -> root-local model units
  const ux = ch.root.p[0], uy = ch.root.p[1], uz = ch.root.p[2];

  // velocity of the v29 root (m/s), lightly smoothed: drives foot planting + crouch
  if (!X.hasPrev || snap) { X.px = ux; X.pz = uz; X.vx = 0; X.vz = 0; X.hasPrev = true; }
  const ivx = clampv((ux - X.px) * K_UNIT / dts, -12, 12), ivz = clampv((uz - X.pz) * K_UNIT / dts, -12, 12); X.px = ux; X.pz = uz;
  const ka = 1 - Math.exp(-dts / 0.08); X.vx += (ivx - X.vx) * ka; X.vz += (ivz - X.vz) * ka;
  const speed = Math.hypot(X.vx, X.vz), moveK = sstep(0.05, 0.6, speed);

  // body: position, unwrapped + smoothed yaw (v29 snaps +-1.1 rad when a walk starts), lean/tilt, squash
  o[iPX] = ux * k; o[iPZ] = uz * k;
  const ryRaw = ch.root.r[1];
  if (snap || !X.ryInit) { X.ryU = ryRaw; X.ryPrev = ryRaw; X.ryInit = true; } else { X.ryU += wrapA(ryRaw - X.ryPrev); X.ryPrev = ryRaw; }
  o[iRY] = sm(X, 0, X.ryU, 0.06, dts, snap);
  o[iRZ] = sm(X, 1, ch.rig.r[2], 0.05, dts, snap);
  o[iRX] = sm(X, 2, ch.rig.r[0], 0.05, dts, snap);
  o[iSY] = clampv((ch.torso.s[1] - 1) * (jelly ? 1.15 : 1), -0.32, 0.3); o[iSX] = 0; o[iSZ] = 0; o[iCOM] = 1;

  // arms: v29 shoulder (raise, forward, twist) -> absolute pose minus our rest
  for (let sd = 0; sd < 2; sd++) {
    const sg = sd ? 1 : -1, node = sd ? ch.n.shR : ch.n.shL, r = sd ? R.armR : R.armL, b = LB[sd], j = 3 + sd * 5;
    const raise = sg < 0 ? -node.r[2] : node.r[2], fwd = -node.r[0], tw = node.r[1];
    if (jelly) { o[b] = sm(X, j, sg * raise * 0.42, 0.035, dts, snap); o[b + 1] = sm(X, j + 1, -fwd * 0.42, 0.035, dts, snap); o[b + 2] = 0; o[b + 3] = 0; o[b + 4] = 0; continue; }
    o[b] = sm(X, j, sg * raise - r.rz, 0.035, dts, snap);
    o[b + 1] = sm(X, j + 1, -fwd - r.rx, 0.035, dts, snap);
    o[b + 2] = sm(X, j + 2, sg * tw * 0.6, 0.035, dts, snap);
    o[b + 3] = sm(X, j + 3, sg * (0.05 + 0.15 * Math.min(1, Math.abs(raise) / 2)) - r.mz, 0.035, dts, snap);
    o[b + 4] = sm(X, j + 4, -0.1 - 0.35 * Math.min(1, Math.max(0, fwd)) - r.mx, 0.035, dts, snap);
  }
  // legs (FK base): v29 hip swing + splay, knee follows the swing. AutoFeet IK blends on top.
  for (let sd = 0; sd < 2; sd++) {
    const node = sd ? ch.n.hipR : ch.n.hipL, b = LB[2 + sd], j = 13 + sd * 5, sw = node.r[0], spl = node.r[2];
    X.hip[sd] = sw;
    o[b] = sm(X, j, spl * (jelly ? 0.6 : 1), 0.03, dts, snap);
    o[b + 1] = sm(X, j + 1, sw * (jelly ? 0.6 : 1), 0.03, dts, snap);
    o[b + 2] = 0; o[b + 3] = 0;
    o[b + 4] = jelly ? 0 : sm(X, j + 4, 0.55 * Math.max(0, -sw) + 0.25 * Math.max(0, sw), 0.03, dts, snap);
  }

  // seat: v29 drops the rig by BY*0.9; our legs are longer, so drop to the hip line
  const seat = clampv(V.seat || 0, 0, 1);
  s.extDrop = seat * X.seatDrop;

  // AutoFeet (Astro, Muse): planted feet in world space, alternating steps, leg IK
  let py = uy * k;
  const AF = X.af;
  const air = uy > 0.10, lying = Math.abs(ch.rig.r[2]) > 0.35 || Math.abs(ch.rig.r[0]) > 0.35;
  const want = (!jelly && !hide && !air && !lying && seat < 0.05 && speed < 2.2 && !STICKER) ? 1 : 0;
  AF.w = snap ? want : AF.w + (want - AF.w) * (1 - Math.exp(-dts / 0.12));
  if (AF.w < 0.002) { AF.w = 0; AF.init = false; AF.step = -1; s.ikFree = false; }
  if (AF.w > 0) { if (uy < 0.08) py *= 1 - 0.65 * moveK * AF.w; py -= s.prof.crouch * (0.4 + 0.6 * moveK) * AF.w; }
  o[iPY] = py;
  if (AF.w > 0) autoFeet(s, X, o, t, speed);

  // head follows v29 "look" during scenes; the cursor gaze steps back
  if (V.look) { o[iHRX] += clampv(V.look[0], -0.5, 0.5) * 0.7; o[iHRY] += clampv(V.look[1], -0.7, 0.7) * 0.7; s.wGT = 0.25; } else s.wGT = 1;

  // looks: soot, hair-up (Muse frizz + poof, Jelly spikes)
  o[iSOOT] = clampv(V.dark || 0, 0, 1);
  const hu = clampv(V.hairUp || 0, 0, 1);
  if (s.kind === 'muse') { o[iFRZ] = hu; o[iPOOF] = hu * 0.3; } else if (jelly) o[iSPK] = hu;

  // face + decals + FX
  const ex = exprOf(V); Anim.setExprIx(s.ci, ex);
  const cream = !!V.cream && !hide, stache = !!V.stache && !hide;
  if (cream !== X.cream) { X.cream = cream; if (cream) Eng.decalOn('cream' + (s.ci + 1), s.kind, 'face', { z: 0.03, s: DECAL_S[s.kind] }); else Eng.decalOff('cream' + (s.ci + 1)); }
  if (stache !== X.stache) { X.stache = stache; if (stache) Eng.decalOn('stache' + (s.ci + 1), s.kind, 'face', { y: -0.08, z: 0.04, s: DECAL_S[s.kind] }); else Eng.decalOff('stache' + (s.ci + 1)); }
  const dz = ex === 'dizzy' && !hide;
  if (dz && (!X.dizzy || t > X.starsAt)) { Anim.spawnFx('stars', s.kind, 1.6); X.starsAt = t + 1.5; }
  X.dizzy = dz;
  if (ex === 'sleepy' && !hide && t > X.zzzAt) { Anim.spawnFx('zzz', s.kind, 1.6); X.zzzAt = t + 1.7; }
}

/* ---------- AutoFeet: procedural foot planting (world-space plants, one foot in the air at a time) ---------- */
function autoFeet(s, X, o, t, speed) {
  const AF = X.af, rs = crew[s.ci].scale.x, ry = o[iRY] + s.layoutRy, c = Math.cos(ry), sn = Math.sin(ry);
  for (let f = 0; f < 2; f++) { const rf = s.restFoot[f];
    HOME[f].set((o[iPX] + rf.x * c + rf.z * sn) * rs, rf.y * rs, (o[iPZ] - rf.x * sn + rf.z * c) * rs); }
  if (!AF.init) { for (let f = 0; f < 2; f++) { AF.plant[f].copy(HOME[f]); AF.yaw[f] = ry; } AF.step = -1; AF.init = true; }
  const thr = 0.12 * rs;
  if (AF.step < 0 && t - AF.last > 0.03) {
    let best = -1, be = 1;
    for (let f = 0; f < 2; f++) {
      const e = Math.max(Math.hypot(HOME[f].x - AF.plant[f].x, HOME[f].z - AF.plant[f].z) / thr, Math.abs(wrapA(ry - AF.yaw[f])) / 0.45);
      if (e > be) { be = e; best = f; }
    }
    if (best >= 0) { AF.step = best; AF.t0 = t; AF.dur = clampv(0.32 - speed * 0.06, 0.13, 0.3); AF.from.copy(AF.plant[best]); AF.lift = (0.03 + 0.05 * clampv(speed / 1.5, 0, 1)) * rs; }
  }
  const w = AF.w;
  for (let f = 0; f < 2; f++) {
    const li = 2 + f; let lift = 0;
    if (AF.step === f) {
      const u = clampv((t - AF.t0) / AF.dur, 0, 1), e = u * u * (3 - 2 * u);
      LAND.set(HOME[f].x + X.vx * AF.dur * 0.6, HOME[f].y, HOME[f].z + X.vz * AF.dur * 0.6);
      FOOT.lerpVectors(AF.from, LAND, e); lift = AF.lift * Math.sin(Math.PI * u); FOOT.y = HOME[f].y + lift; AF.u = u;
      if (u >= 1) { AF.plant[f].copy(LAND); AF.yaw[f] = ry; AF.step = -1; AF.last = t; lift = 0; FOOT.copy(LAND); }
    } else FOOT.copy(AF.plant[f]);
    s.ikT[li].copy(FOOT);
    s.ikW[li] = Math.abs(X.hip[f]) > 1.05 ? 0 : w;          // a deliberately raised leg (kick, stomp) stays FK
    s.ikFn[li] = null; s.ikPole[li].set(f ? 0.15 : -0.15, 0, 1).normalize(); s.footLift[f] = lift;
  }
  s.ikFree = true;
  if (AF.step >= 0) { const b = Math.sin(Math.PI * AF.u); o[iPY] += 0.012 * b * w; o[iRZ] += (AF.step ? -1 : 1) * 0.025 * b * w; }
}

Anim.D.manual = true;
Anim.D.ext = { pre, pose };

/* ---------- v29 props + particles mirror (pooled matrices, cached geometry/materials) ---------- */
const GEOC = {}, MATC = new Map(), live = new Map(), seen = new Set(), MST = [];
let msp = 0;
const tq = new T.Quaternion(), tp = new T.Vector3(), ts = new T.Vector3(), eul = new T.Euler(), tmpL = new T.Matrix4();
const SCALE_K = new T.Matrix4().makeScale(K_UNIT, K_UNIT, K_UNIT), BASE = new T.Matrix4(), KS = new T.Vector3(K_UNIT, K_UNIT, K_UNIT);
const ap = new T.Vector3(), aq = new T.Quaternion(), as = new T.Vector3();
function geom(key) {
  if (GEOC[key]) return GEOC[key];
  const g = Toy3D.geo(key), n = g.v.length / 7, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set(g.v.subarray(i * 7, i * 7 + 3), i * 3); nor.set(g.v.subarray(i * 7 + 3, i * 7 + 6), i * 3); }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(pos, 3)); bg.setAttribute('normal', new T.BufferAttribute(nor, 3)); bg.setIndex(new T.BufferAttribute(g.i, 1));
  return (GEOC[key] = bg);
}
function mat(n) {
  if (n._m3 && n._mc === n.c && n._me === n.e && n._ma === n.a && n._ms === n.spec) return n._m3;
  const key = n.c.join(',') + '|' + n.e + '|' + (n.a < 1 ? n.a.toFixed(2) : 1) + '|' + n.spec; let m = MATC.get(key);
  if (!m) { const c = new T.Color().setRGB(n.c[0], n.c[1], n.c[2]).convertSRGBToLinear();
    m = new T.MeshStandardMaterial({ color: c, roughness: Math.max(0.15, 0.75 - n.spec * 0.55), metalness: n.spec > 0.8 ? 0.35 : 0.05, emissive: n.e ? c : new T.Color(0), emissiveIntensity: n.e ? 1.3 * n.e : 0, transparent: n.a < 1, opacity: n.a, depthWrite: n.a >= 1 });
    MATC.set(key, m); }
  n._m3 = m; n._mc = n.c; n._me = n.e; n._ma = n.a; n._ms = n.spec; return m;
}
function local(n, out) { eul.set(n.r[0], n.r[1], n.r[2], 'YXZ'); tq.setFromEuler(eul); return out.compose(tp.set(n.p[0], n.p[1], n.p[2]), tq, ts.set(n.s[0], n.s[1], n.s[2])); }
function walk(n, parentM, hidden) {
  if (!n.vis) return;
  const M = MST[msp] || (MST[msp] = new T.Matrix4()); msp++;
  M.multiplyMatrices(parentM, local(n, tmpL));
  if (n.mesh && !n.mode) {
    let m = live.get(n); if (!m) { m = new T.Mesh(geom(n.mesh), mat(n)); m.matrixAutoUpdate = false; scene.add(m); live.set(n, m); }
    const mm = mat(n); if (m.material !== mm) m.material = mm;
    m.matrix.copy(M); m.matrixWorld.copy(M); m.visible = !hidden; seen.add(n);
  }
  for (let i = 0; i < n.kids.length; i++) walk(n.kids[i], M, hidden);
  msp--;
}
function anchorFor(st, node) {
  for (let i = 0; i < 3; i++) { const sl = HOLD_SLOTS[i], ch = st.chars[sl], n = ch.n, ci = SLOT_CI[sl], so = crew[ci].userData.sock;
    if (node === n.handR) return so.handR; if (node === n.handL) return so.handL; if (node === n.top) return so.headTop;
    if (node === n.back) return so.back; if (node === n.front) return so.face; if (node === ch.torso) return crew[ci].userData.body; }
  return null;
}
function syncProps(st) {
  seen.clear(); msp = 0;
  const kids = st.props.kids;
  for (let i = 0; i < kids.length; i++) { const kid = kids[i]; if (!kid.vis) continue; walk(kid, SCALE_K, false); }
  const made = st.K && st.K.made;
  if (made && made.length) for (let i = 0; i < 3; i++) {
    const sl = HOLD_SLOTS[i], ch = st.chars[sl], hide = !!ch.P.hide, n = ch.n;
    const all = st._hn || (st._hn = {}), nodes = all[sl] || (all[sl] = [n.handR, n.handL, n.top, n.back, n.front, ch.torso]);
    for (let j = 0; j < nodes.length; j++) { const node = nodes[j]; if (!node) continue;
      for (let q = 0; q < node.kids.length; q++) { const x = node.kids[q]; if (made.indexOf(x) < 0) continue;
        const an = anchorFor(st, node); if (!an) continue;
        an.updateWorldMatrix(true, false); an.matrixWorld.decompose(ap, aq, as); BASE.compose(ap, aq, KS);
        walk(x, BASE, hide); } }
  }
  if (live.size !== seen.size) for (const [n, m] of live) if (!seen.has(n)) { scene.remove(m); live.delete(n); }
}
function clearProps() { for (const [, m] of live) scene.remove(m); live.clear(); }

/* ---------- camera: metres <-> the band's DOM pixels (the world itself never moves) ---------- */
function placeCamera(st, vw, vh) {
  const ppm = st.u / K_UNIT, Dm = (vh / 2) / TAN / ppm, near = Math.max(0.05, Dm - 8), far = Dm + 8, asp = vw / vh;
  if (camera.aspect !== asp || camera.fov !== FOVY || camera.near !== near || camera.far !== far) { camera.aspect = asp; camera.fov = FOVY; camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
  camX.ppm = ppm; camX.D = Dm; camX.vw = vw; camX.vh = vh; camX.x = (vw / 2 - st.ox) / ppm; camX.y = (st.oy - vh / 2) / ppm;
  camera.position.set(camX.x, camX.y, Dm); camera.rotation.set(0, 0, 0);
}
function updateGaze(st) {
  const track = st.opts.track !== false && PX != null && !STICKER;
  if (track) { const zg = 2.5, f = (camX.D - zg) / camX.D; gaze.set(camX.x + (PX - camX.vw / 2) / camX.ppm * f, camX.y - (PY - camX.vh / 2) / camX.ppm * f, zg); }
  else gaze.set(camX.x, camX.y, camX.D);
  if (STICKER) gazeS.copy(gaze); else gazeS.lerp(gaze, 0.15);
}
let lightX = 0;
function lightsFollow(snap) {
  let mx = 0, n = 0;
  for (let i = 0; i < 3; i++) if (crew[i].visible) { tmp2.setFromMatrixPosition(crew[i].userData.body.matrixWorld); mx += tmp2.x; n++; }
  if (n) lightX = snap ? mx / n : lightX + (mx / n - lightX) * 0.05; rig.position.x = lightX;
}

/* ---------- active band selection + handover ---------- */
function zFor(el) {
  let z = 8;
  for (let p = el; p && p !== document.body && p.nodeType === 1; p = p.parentElement) {
    const cs = getComputedStyle(p); if (cs.position === 'static') continue;
    const zi = parseInt(cs.zIndex, 10); if (zi > 0 && zi + 1 > z) z = zi + 1;
  }
  return z;
}
function pick(vw, vh) {
  for (let i = STAGES.length - 1; i >= 0; i--) { const st = STAGES[i];
    if (st.dead) { STAGES.splice(i, 1); continue; }
    if (!st.headless) continue;
    if (st.measure(vw, vh)) return st; }
  return null;
}
function handover(st) {
  const old = active;
  if (old) { old._live = false; if (old.say) old.say.classList.remove('on'); }
  active = st;
  for (let i = 0; i < 3; i++) { const X = XS[i], s = S3[i]; X.snap = true; X.hasPrev = false; X.ryInit = false; X.af.init = false; X.af.w = 0; X.af.step = -1; s.ikFree = false; s.ikW.fill(0);
    if (X.cream) { X.cream = false; Eng.decalOff('cream' + (i + 1)); } if (X.stache) { X.stache = false; Eng.decalOff('stache' + (i + 1)); } }
  clearProps(); Anim.clearFx();
  if (st) { st._live = true; const z = String(zFor(st.c)); if (cv.style.zIndex !== z) cv.style.zIndex = z; }
}

/* ---------- frame loop ---------- */
let raf = 0, last = 0, lastDraw = 0, tAnim = 0, paused = false, drawn = false, ecoOn = false, idleTimer = 0;
const PERF_ = { n: 0, k: 0, anim: 0, rnd: 0, animMax: 0, rndMax: 0, calls: 0, tris: 0, minClr: 9 };
function kick() { if (!raf && !paused && !STICKER) { last = 0; raf = requestAnimationFrame(frame); } }
function frame(now) {
  raf = 0; if (paused || document.hidden || STICKER) return;
  const eco = tierNow() === 'eco';
  if (eco && now - lastDraw < 31) { raf = requestAnimationFrame(frame); return; }
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; lastDraw = now;
  const vw = innerWidth, vh = innerHeight, st = pick(vw, vh);
  if (!st) {
    if (active) handover(null);
    if (drawn) { renderer.setScissorTest(false); renderer.clear(); drawn = false; }
    clearTimeout(idleTimer); idleTimer = setTimeout(kick, 400); return;
  }
  const t0 = performance.now();
  const fresh = st !== active; if (fresh) handover(st);
  if (eco !== ecoOn) { ecoOn = eco; if (eco) camera.layers.disable(1); else camera.layers.enable(1); GZ.quality = eco ? 'low' : 'high'; }
  tAnim += dt; furTime.value = tAnim;
  placeCamera(st, vw, vh); updateGaze(st);
  Anim.update(dt, tAnim, GZ);
  syncProps(st); lightsFollow(fresh);
  if (GZ.shake > 1e-4) { camera.position.x += GZ.shake * Math.sin(tAnim * 93.0); camera.position.y += GZ.shake * Math.sin(tAnim * 71.0 + 1.3); }
  const t1 = performance.now();
  draw(st, vw, vh);
  const t2 = performance.now();
  if (++PERF_.n > 60) { const a = t1 - t0, r = t2 - t1; PERF_.k++; PERF_.anim += a; PERF_.rnd += r; if (a > PERF_.animMax) PERF_.animMax = a; if (r > PERF_.rndMax) PERF_.rndMax = r; }
  if (Eng.statsOn) floorCheck();
  PERF_.calls = renderer.info.render.calls; PERF_.tris = renderer.info.render.triangles;
  raf = requestAnimationFrame(frame);
}
/* ?crewstats: lowest ankle vs. its ground height over every grounded frame (negative = floor penetration) */
function floorCheck() {
  for (let i = 0; i < 3; i++) { const s = S3[i], X = XS[i], c = crew[i]; if (!c.visible || s.kind === 'jelly' || X.af.w < 0.99) continue;
    for (let f = 0; f < 2; f++) { if (s.footLift[f] > 0) continue; const L = s.u.rig[f ? 'legR' : 'legL']; L.end.updateWorldMatrix(true, false);
      tmp2.setFromMatrixPosition(L.end.matrixWorld); const clr = tmp2.y - s.restFoot[f].y * c.scale.x; if (clr < PERF_.minClr) PERF_.minClr = clr; } }
}
function draw(st, vw, vh) {
  renderer.setScissorTest(false); renderer.clear();
  if (st && st._clipOn) { renderer.setScissorTest(true); renderer.setScissor(0, vh - st.oy, vw, Math.max(0, st.oy)); }
  renderer.render(scene, camera); drawn = true;
  renderer.setScissorTest(false);
}
addEventListener('pointermove', (e) => { PX = e.clientX; PY = e.clientY; }, { passive: true });
addEventListener('resize', () => { if (!STICKER) renderer.setSize(innerWidth, innerHeight, false); kick(); });
addEventListener('scroll', kick, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
if (PF && PF.register) PF.register({ pause() { paused = true; }, resume() { paused = false; kick(); } });

/* ---------- stickers (phones / Wrapped): one character, one v29 pose, transparent WebP ---------- */
let stk = null;
function sticker(slot, poseName, opts) {
  opts = opts || {};
  const w = opts.w || 400, h = opts.h || 500, C = window.Crew;
  if (!stk) { const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;visibility:hidden;pointer-events:none';
    document.body.appendChild(el); stk = C.mount(el, { eggs: false, track: false }); const i = STAGES.indexOf(stk); if (i >= 0) STAGES.splice(i, 1); }
  STICKER = true; if (raf) { cancelAnimationFrame(raf); raf = 0; }
  tAnim += 5;                                            // let FX from the previous sticker expire
  const st = stk;
  HOLD_SLOTS.forEach((k) => { const c = st.chars[k]; c.reset(0, 0, {}); c.P.hide = k === slot ? 0 : 1; c.P.blink = 0; c.apply(0, [0, 0]); });
  const ch = st.chars[slot], V = ch.P; V.turn = 0.25; V.sq = 1;
  const pz = (C.POSES && C.POSES[poseName]) || (C.POSES && C.POSES.happy) || {}; for (const key in pz) V[key] = pz[key];
  if (opts.wave) V.armR = 2.5;
  ch.kv = 0; ch.kx = 0; ch.apply(0, [0, 0]);
  st.u = h * 0.58 / (C.DESIGN.bip.h + 0.12); st.ox = w / 2; st.oy = h * 0.94; st.W = w; st.H = h; st.floor = st.oy; st._clipOn = false;
  handover(st);
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  for (let i = 0; i < 45; i++) { tAnim += 1 / 60; furTime.value = tAnim; placeCamera(st, w, h); updateGaze(st); Anim.update(1 / 60, tAnim, GZ); }
  lightsFollow(true); syncProps(st); draw(st, w, h);
  return cv.toDataURL(opts.type || 'image/webp', opts.q || 0.9);
}
function stickerDone() { STICKER = false; handover(null); renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight, false); kick(); }

window.Crew3D = {
  ok: true, version: 30,
  add(st) { if (STAGES.indexOf(st) < 0) STAGES.push(st); kick(); },
  remove(st) { const i = STAGES.indexOf(st); if (i >= 0) STAGES.splice(i, 1); if (active === st) handover(null); },
  sticker, stickerDone,
  stats() { const k = Math.max(1, PERF_.k); return { frames: PERF_.n, animMs: +(PERF_.anim / k).toFixed(3), animMax: +PERF_.animMax.toFixed(3), renderMs: +(PERF_.rnd / k).toFixed(3), renderMax: +PERF_.rndMax.toFixed(3),
    floorMin: +PERF_.minClr.toFixed(4), calls: PERF_.calls, tris: PERF_.tris, tier: tierNow(), furQ: FUR_Q,
    dpr: renderer.getPixelRatio(), active: !!active, stages: STAGES.length, props: live.size, eng: Object.assign({}, Eng.STATS), feet: XS.map(X => ({ w: +X.af.w.toFixed(2), step: X.af.step })) }; },
  debug: { crew, XS, Anim, Eng, S: S3, camera, renderer, active: () => active }
};
kick();
}
