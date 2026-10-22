/* ==================================================================
   FUN FRIDAY ARENA — THE TRIO in real 3D (Bip · Bop · Boop)
   Built on assets/toy3d.js (custom WebGL, no three.js download).
   Bip  — tall, ONE big eye, blue overalls, three hair sprigs   (mint)
   Bop  — short, two eyes, red cap                               (peach)
   Boop — chubby, goofy buck teeth, green scarf                  (lilac)
   (Original designs: pastel bodies, no yellow skin, no goggles.)
   ONE shared full-screen canvas per page draws every crew band, so the
   trio can line up with real DOM elements (cards, headlines) and even
   jump outside their band. Scenes are pure functions of time -> pose,
   which makes every gag deterministic, interruptible and cheap.
   Public API is unchanged from the 2D crew (mount/play/react/attend…).
   ================================================================== */
(function (g) {
  'use strict';
  var T3 = g.Toy3D; if (!T3) return;
  var N = T3.Node, PI = Math.PI, TAU = PI * 2;
  var PERF = g.FFAperf || { DPR: Math.min(g.devicePixelRatio || 1, 2), tier: function () { return 'high'; }, register: function () {} };
  var reduced = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function SFX(n) { try { if (g.SFX && g.SFX[n]) g.SFX[n](); } catch (e) {} }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- design sheet ---------------- */
  var BY = .12; // body sits this high on its legs
  var SPEC = {
    bip:  { h: 1.36, r: .36, belly: .55, col: '#8FE8CB', hand: '#A6F0D8', shoe: '#3A2F5A', iris: '#6A4326', eyes: [[0, 1.03]], es: .2, mouthY: .77, sh: [.335, .74], hip: .13, cheekX: .25, cheekY: .86 },
    bop:  { h: .94, r: .45, belly: .6, col: '#FFB48C', hand: '#FFC6A6', shoe: '#5B3A2E', iris: '#2B6BE0', eyes: [[-.15, .47], [.15, .47]], es: .13, mouthY: .27, sh: [.42, .42], hip: .17, cheekX: .3, cheekY: .36 },
    boop: { h: 1.0, r: .56, belly: .62, col: '#C8A6FF', hand: '#D8BEFF', shoe: '#2E4A7A', iris: '#2F9E5A', eyes: [[-.18, .7], [.18, .7]], es: .14, mouthY: .5, sh: [.52, .46], hip: .22, cheekX: .36, cheekY: .56 }
  };
  var HT = {}; Object.keys(SPEC).forEach(function (k) { HT[k] = BY + SPEC[k].h; });
  function radAt(S, y) { // body radius at height y (body space)
    var rb = S.r * S.belly, rt = S.r, top = S.h - rt;
    if (y < rb) { var k = (rb - y) / rb; return S.r * Math.sqrt(Math.max(0, 1 - k * k)); }
    if (y > top) { var q = (y - top) / rt; return S.r * Math.sqrt(Math.max(0, 1 - q * q)); }
    return S.r;
  }
  function surfZ(S, x, y, inset) { var r = radAt(S, y); return Math.sqrt(Math.max(0, r * r - x * x)) - (inset || 0); }

  /* ---------------- geometry ---------------- */
  ['bip', 'bop', 'boop'].forEach(function (k) { var S = SPEC[k]; T3.geo('body_' + k, function () { return T3.lathe(T3.blobProf(S.r, S.h, S.belly), 30); }); });
  T3.geo('ovr', function () { var S = SPEC.bip, p = T3.blobProf(S.r * 1.045, S.h, S.belly).filter(function (q) { return q[1] <= .5; }); var last = p[p.length - 1]; return T3.lathe(p.concat([[last[0], .5], [last[0], .5], [0, .5]]), 30); });
  T3.geo('lash', function () { return T3.torus(1, .055, PI * 2, 36, 6); });
  T3.geo('arm', function () { return T3.lathe(T3.capsuleDown(.068, .2), 14); });
  T3.geo('leg', function () { return T3.lathe(T3.capsuleDown(.078, .05), 14); });
  T3.geo('hair', function () { return T3.lathe(T3.capsuleDown(.02, .14), 8); });
  T3.geo('coat', function () { return T3.lathe([[0, 0], [.62, 0], [.62, 0], [.52, .9], [.44, 1.8], [.38, 2.45], [.22, 2.62], [0, 2.66]], 24); });
  T3.geo('bucket', function () { return T3.lathe([[0, 0], [.2, 0], [.2, 0], [.26, .3], [.26, .3], [0, .3]], 22); });
  T3.geo('tier', function () { return T3.lathe([[0, 0], [1, 0], [1, 0], [1, .9], [.96, 1], [0, 1]], 26); });

  function M(mesh, col, o) { return new N(mesh, col, o); }
  var DARK = '#2A1B3A';

  /* ---------------- character builder ---------------- */
  function Char(kind) {
    var S = SPEC[kind]; this.kind = kind; this.S = S; this.H = HT[kind];
    var root = this.root = new N(), rig = this.rig = new N(), torso = this.torso = new N();
    root.add(rig); rig.add(torso); torso.at(0, BY, 0);
    this.shadow = root.add(M('disc', '#000', { mode: 1, a: .32 })); this.shadow.sc(S.r * 1.35, 1, S.r * 1.0).at(0, .004, 0);
    var body = torso.add(M('body_' + kind, S.col, { spec: .32, shin: 22 }));
    var n = this.n = { body: body };
    /* face anchor group (all facial features) */
    var face = n.face = torso.add(new N());
    /* eyes */
    n.eyes = []; var es = S.es;
    S.eyes.forEach(function (e) {
      var z = surfZ(S, e[0], e[1], es * .38), grp = face.add(new N()).at(e[0], e[1], z);
      var ball = grp.add(new N());
      ball.add(M('sph', '#FFFFFF', { spec: .55, shin: 60 })).sc(es);
      var iris = ball.add(M('sph', S.iris, { spec: .3 })).sc(es * .6, es * .6, es * .3).at(0, 0, es * .8);
      var pup = ball.add(M('sph', '#0E0A18', { spec: .7, shin: 80 })).sc(es * .33, es * .33, es * .2).at(0, 0, es * .93);
      var gl = ball.add(M('sphLo', '#FFFFFF', { e: 1, spec: 0 })).sc(es * .13).at(-es * .26, es * .3, es * 1.0);
      ball.add(M('sphLo', '#FFFFFF', { e: 1, spec: 0 })).sc(es * .06).at(es * .24, -es * .22, es * .99);
      /* real eyelid: a skin-coloured dome that rotates down over the eyeball (blink, sleepy, sneaky) */
      var lid = grp.add(M('hemi', S.col, { spec: .32, shin: 22 })).sc(es * 1.07); lid.r[0] = -PI / 2;
      lid.add(M('lash', '#3B2A4A', { spec: .2 })).rot(PI / 2, 0, 0);
      var x1 = grp.add(M('box', DARK)).sc(es * 1.3, es * .2, es * .12).at(0, 0, es * .95); x1.r[2] = .78;
      var x2 = grp.add(M('box', DARK)).sc(es * 1.3, es * .2, es * .12).at(0, 0, es * .95); x2.r[2] = -.78;
      var happy = grp.add(M('arc', DARK)).sc(es * .62).at(0, -es * .15, es * .7);
      var shut = grp.add(M('arc', DARK)).sc(es * .62).at(0, es * .1, es * .7); shut.r[2] = PI;
      var brow = face.add(M('box', '#3B2A4A')).sc(es * 1.15, es * .2, es * .2).at(e[0], e[1] + es * 1.35, surfZ(S, e[0], e[1] + es * 1.35, .02) + .02);
      n.eyes.push({ grp: grp, ball: ball, iris: iris, pup: pup, gl: gl, x: [x1, x2], happy: happy, shut: shut, brow: brow, bx: e[0], lid: lid });
    });
    /* mouth */
    var mz = surfZ(S, 0, S.mouthY, .01), mouth = n.mouth = face.add(new N()).at(0, S.mouthY, mz);
    n.m = {
      smile: mouth.add(M('arc', DARK)).sc(.075).rot(0, 0, PI),
      frown: mouth.add(M('arc', DARK)).sc(.07).at(0, -.04, 0),
      open: mouth.add(new N()),
      flat: mouth.add(M('box', DARK)).sc(.11, .018, .02),
      o: mouth.add(M('sph', DARK)).sc(.04, .05, .025)
    };
    n.m.open.add(M('sph', '#3A1030', { spec: .1 })).sc(.085, .065, .03).at(0, -.02, 0);
    n.m.open.add(M('sph', '#FF7FA6', { spec: .2 })).sc(.05, .025, .03).at(0, -.05, .01);
    if (kind === 'boop') n.teeth = mouth.add(new N()).at(0, -.065, .01), n.teeth.add(M('box', '#FFFFFF', { spec: .6 })).sc(.05, .065, .025).at(-.028, 0, 0), n.teeth.add(M('box', '#FFFFFF', { spec: .6 })).sc(.05, .065, .025).at(.028, 0, 0);
    /* cheeks */
    [-1, 1].forEach(function (sd) { face.add(M('sph', '#FF9EC4', { spec: .1 })).sc(.065, .04, .02).at(sd * S.cheekX, S.cheekY - .06, surfZ(S, S.cheekX, S.cheekY - .06, .005)); });
    /* mustache (paint swap) + cream (pie) + dizzy stars */
    n.stache = face.add(new N()).at(0, S.mouthY + .06, mz + .015); n.stache.vis = false;
    n.stache.add(M('arc', '#2A1B12')).sc(.07).at(-.06, 0, 0).rot(0, 0, .5); n.stache.add(M('arc', '#2A1B12')).sc(.07).at(.06, 0, 0).rot(0, 0, -.5);
    n.cream = face.add(new N()); n.cream.vis = false;
    var cy = S.eyes[0][1] - .05, cz = surfZ(S, 0, cy, -.02);
    [[0, 0, .2], [-.13, .08, .13], [.14, .06, .14], [-.05, -.12, .13], [.1, -.14, .12], [.02, .15, .1]].forEach(function (q) { n.cream.add(M('sph', '#FFFBF5', { spec: .6, shin: 40 })).sc(q[2], q[2] * .85, q[2] * .55).at(q[0], cy + q[1], cz); });
    n.cream.add(M('sph', '#E8394A', { spec: .7 })).sc(.045).at(.02, cy + .26, cz);
    n.dizzy = torso.add(new N()).at(0, S.h + .16, 0); n.dizzy.vis = false;
    for (var i = 0; i < 3; i++) n.dizzy.add(M('sphLo', '#FFD84D', { e: .9 })).sc(.05).at(Math.cos(i * TAU / 3) * .24, 0, Math.sin(i * TAU / 3) * .24);
    /* outfit */
    if (kind === 'bip') {
      torso.add(M('ovr', '#3466D9', { spec: .15 }));
      torso.add(M('box', '#3466D9', { spec: .15 })).sc(.32, .18, .05).at(0, .58, surfZ(S, 0, .58, .015));
      torso.add(M('box', '#2B55B8')).sc(.14, .07, .02).at(0, .57, surfZ(S, 0, .57, -.03));
      [-1, 1].forEach(function (sd) { torso.add(M('sph', '#FFD23D', { spec: .8 })).sc(.026).at(sd * .12, .62, surfZ(S, .12, .62, -.04)); });
      n.hair = torso.add(new N()).at(0, S.h - .02, 0);
      [-.32, 0, .32].forEach(function (a) { n.hair.add(M('hair', '#2D2A3A')).rot(0, 0, PI + a); });
    } else if (kind === 'bop') {
      var cap = torso.add(new N()).at(0, .63, 0);
      cap.add(M('hemi', '#E8394A', { spec: .45 })).sc(S.r * 1.04, S.r * .8, S.r * 1.04);
      cap.add(M('sph', '#C9283A', { spec: .4 })).sc(.28, .028, .22).at(0, .01, S.r * .82).rot(-.1, 0, 0);
      cap.add(M('sph', '#FFFFFF', { spec: .5 })).sc(.04).at(0, S.r * .8, 0);
      cap.add(M('sph', '#FFFFFF', { spec: .3 })).sc(.07, .055, .02).at(0, S.r * .42, S.r * .9).rot(-.5, 0, 0);
      n.cap = cap;
    } else {
      var sc = torso.add(new N()).at(0, .3, 0);
      sc.add(M('ring', '#33C46A', { spec: .25 })).sc(S.r * .97, S.r * .97, S.r * .6).rot(PI / 2, 0, 0);
      sc.add(M('sph', '#2AA357', { spec: .25 })).sc(.09, .08, .07).at(.22, -.02, S.r * .93);
      n.tail = sc.add(new N()).at(.22, -.04, S.r * .95);
      n.tail.add(M('arm', '#33C46A', { spec: .25 })).sc(1.3, 1.25, .6);
      n.tail.add(M('box', '#2AA357')).sc(.12, .03, .05).at(0, -.3, 0);
      torso.add(M('sph', '#EBDDFF', { spec: .25 })).sc(.3, .15, .06).at(0, .15, surfZ(S, 0, .15, .035));
    }
    /* arms + legs */
    var self = this;
    ['L', 'R'].forEach(function (sd, i) {
      var sgn = i ? 1 : -1;
      var sh = torso.add(new N()).at(sgn * S.sh[0], S.sh[1], 0);
      sh.add(M('arm', S.col, { spec: .3 }));
      var hand = sh.add(new N()).at(0, -.33, 0); hand.add(M('sph', S.hand, { spec: .35 })).sc(.092);
      hand.add(M('sph', S.hand, { spec: .35 })).sc(.042, .05, .042).at(-sgn * .055, .03, .06);
      n['sh' + sd] = sh; n['hand' + sd] = hand;
      var hip = rig.add(new N()).at(sgn * S.hip, .17, 0);
      hip.add(M('leg', S.col, { spec: .3 }));
      hip.add(M('sph', S.shoe, { spec: .4 })).sc(.1, .07, .14).at(0, -.13, .04);
      hip.add(M('sph', '#FFFFFF', { spec: .5 })).sc(.07, .045, .055).at(0, -.135, .14);
      n['hip' + sd] = hip;
    });
    if (kind === 'bop') face.add(M('sph', '#FF9C70', { spec: .55 })).sc(.045, .036, .04).at(0, .355, surfZ(S, 0, .355, -.015));
    n.back = torso.add(new N()).at(0, S.h * .5, -S.r * .95);
    n.top = torso.add(new N()).at(0, S.h + .01, 0);
    n.front = face.add(new N()).at(0, S.eyes[0][1], surfZ(S, 0, S.eyes[0][1]) + .02);
    this.P = {}; this.blinkAt = 0; this.blinkT = -1; this.kx = 0; this.kv = 0; this.ph = Math.random() * 10; this.clicks = 0;
    this.say = function (t, ms) { self._say = { t: t, until: performance.now() + (ms || 1400) }; };
    this.sign = this.say;
  }
  var EYEMODES = { open: 1, wide: 1, x: 1, happy: 1, closed: 1, look: 1 };
  Char.prototype.reset = function (home, idleT, opt) {
    var P = this.P;
    P.x = home; P.y = 0; P.z = 0; P.turn = 0; P.spin = 0; P.lean = 0; P.tilt = 0; P.sq = 1 + Math.sin(idleT * 2.2 + this.ph) * .016;
    P.armL = .16 + Math.sin(idleT * 1.7 + this.ph) * .04; P.armR = .16 + Math.sin(idleT * 1.6 + this.ph + 1) * .04; P.armLf = 0; P.armRf = 0; P.armLt = 0; P.armRt = 0;
    P.legL = 0; P.legR = 0; P.legLs = 0; P.legRs = 0; P.seat = opt.seat || 0; P.eyes = 'open'; P.brow = 0; P.mouth = 'smile';
    P.look = null; P.cross = false; P.chew = 0; P.dark = 0; P.cream = 0; P.stache = 0; P.dizzy = 0; P.hairUp = 0; P.size = 1; P.hide = 0; P.blink = 1; P.fz = 0; P.lid = null;
  };
  /* write pose -> nodes (units). stage handles placement/scale. */
  Char.prototype.apply = function (now, look) {
    var P = this.P, n = this.n, S = this.S;
    // click squash spring
    this.kv += (-260 * this.kx - 16 * this.kv) * .016; this.kx += this.kv * .016;
    var sq = Math.max(.35, P.sq + this.kx);
    var r = this.root; r.vis = !P.hide; r.at(P.x, P.y, P.z); r.rot(0, P.turn + P.spin, 0); r.sc(P.size);
    r.dark = P.dark;
    var seat = P.seat;
    /* action → reaction: cheap secondary physics read from the animation itself.
       Landing after a fall = jelly squash; running = lean into the motion; hair/scarf trail behind. */
    if (this._px == null) { this._px = P.x; this._py = P.y; this._vy = 0; this._vxs = 0; }
    var vx = (P.x - this._px) / .016, vy = (P.y - this._py) / .016; this._px = P.x; this._py = P.y;
    if (Math.abs(vx) > 40 || Math.abs(vy) > 40) { vx = 0; vy = 0; }
    if (this._vy < -2.2 && vy > -.4 && P.y < .06 && !P.hide) this.kv -= Math.min(9, -this._vy * 1.6);
    this._vy = vy; this._vxs = this._vxs * .85 + vx * .15;
    var drag = clamp(-this._vxs * .045, -.22, .22) * (1 - seat);
    this.rig.at(0, -BY * seat * .9, 0); this.rig.rot(P.tilt, 0, P.lean + drag);
    var sx = 1 / Math.sqrt(sq); this.torso.sc(sx, sq, sx);
    this.shadow.vis = P.y < 1.2 && Math.abs(P.lean) < 1 && !P.hide; this.shadow.a = .32 * clamp(1 - P.y * .7, 0, 1) * (1 - seat * .7);
    this.shadow.sc(S.r * 1.35 * (1 - P.y * .25), 1, S.r * (1 - P.y * .25)); this.shadow.at(0, .004 - P.y / Math.max(.2, P.size), 0);
    // arms: raise sideways (armL/armR), forward (armLf/armRf), twist
    n.shL.rot(-P.armLf, P.armLt, -P.armL); n.shR.rot(-P.armRf, P.armRt, P.armR);
    // legs: swing (legL/legR) + seated dangle
    var dang = seat ? Math.sin(now / 280 + this.ph) * .35 * seat : 0;
    n.hipL.rot(-1.3 * seat + P.legL + dang, 0, -P.legLs); n.hipR.rot(-1.3 * seat + P.legR - dang * .85, 0, P.legRs);
    // eyes
    var bl = 1; if (P.blink && now > this.blinkAt) { this.blinkT = now; this.blinkAt = now + 1800 + Math.random() * 3600; if (Math.random() < .2) this.blinkAt = now + 260; }
    var bk = (now - this.blinkT) / 140; if (bk >= 0 && bk < 1) bl = Math.max(.08, Math.abs(1 - bk * 2));
    var em = P.eyes, lk = P.look || look || [0, 0];
    for (var i = 0; i < n.eyes.length; i++) {
      var E = n.eyes[i], open = em === 'open' || em === 'wide';
      E.ball.vis = open; E.x[0].vis = E.x[1].vis = em === 'x'; E.happy.vis = em === 'happy'; E.shut.vis = em === 'closed';
      var es = em === 'wide' ? 1.22 : 1;
      E.grp.sc(es, es, es);
      var lidA = open ? Math.max(P.lid != null ? P.lid : (P.brow > 0 ? .34 : em === 'wide' ? 0 : .06), (1 - bl) / .92) : 0;
      E.lid.vis = open; E.lid.r[0] = -PI / 2 + clamp(lidA, 0, 1) * PI * .98;
      E.ball.rot(clamp(lk[0], -.55, .55), clamp(lk[1] + (P.cross ? (i ? -.35 : .35) : 0), -.7, .7), 0);
      var bt = P.brow, sgn = E.bx === 0 ? 0 : (E.bx < 0 ? -1 : 1);
      E.brow.r[2] = bt > 0 ? -sgn * .42 : bt < 0 ? sgn * .38 : 0;
      E.brow.p[1] = S.eyes[i][1] + S.es * (1.35 - (bt > 0 ? .25 : 0) + (em === 'wide' ? .3 : 0));
      if (sgn === 0 && bt > 0) E.brow.r[2] = 0;
    }
    var mo = P.mouth; n.m.smile.vis = mo === 'smile' || mo === 'grin'; n.m.smile.sc(mo === 'grin' ? .1 : .075);
    n.m.frown.vis = mo === 'frown'; n.m.open.vis = mo === 'open'; n.m.flat.vis = mo === 'flat'; n.m.o.vis = mo === 'o';
    if (mo === 'open') { var ch = P.chew ? .55 + .45 * Math.abs(Math.sin(now / 90)) : 1; n.m.open.sc(1, ch, 1); }
    if (n.teeth) n.teeth.vis = mo !== 'o' && mo !== 'frown';
    n.stache.vis = !!P.stache; n.cream.vis = !!P.cream; n.dizzy.vis = !!P.dizzy; if (P.dizzy) n.dizzy.r[1] = now / 160;
    if (n.hair) { n.hair.sc(1, 1 + P.hairUp * 1.1, 1); n.hair.r[2] = clamp(this._vxs * .07, -.5, .5) - drag; }
    if (n.tail) n.tail.rot(Math.sin(now / 300 + this.ph) * .15, 0, .15 + Math.sin(now / 420) * .1 + clamp(this._vxs * .08, -.6, .6));
  };
  Char.prototype.boing = function () { this.kv -= 7; SFX('squeak'); };

  /* ---------------- props (units; all low-poly, built on demand) ---------------- */
  var PROPS = {
    rocket: function (big) { var g0 = new N(), k = big ? 2.4 : 1;
      g0.add(M('cyl', '#E8394A', { spec: .5 })).sc(.07 * k, .42 * k, .07 * k);
      g0.add(M('cyl', '#FFFFFF', { spec: .5 })).sc(.072 * k, .06 * k, .072 * k).at(0, .26 * k, 0);
      g0.add(M('cone', '#FFFFFF', { spec: .6 })).sc(.07 * k, .16 * k, .07 * k).at(0, .42 * k, 0);
      for (var i = 0; i < 3; i++) g0.add(M('box', '#3466D9')).sc(.02 * k, .12 * k, .1 * k).at(Math.sin(i * TAU / 3) * .08 * k, .05 * k, Math.cos(i * TAU / 3) * .08 * k).rot(0, i * TAU / 3, 0);
      var fl = g0.flame = g0.add(new N()); fl.add(M('cone', '#FFD23D', { e: 1, a: .92 })).sc(.06 * k, .3 * k, .06 * k).rot(PI, 0, 0);
      fl.add(M('cone', '#FF7A1A', { e: 1, a: .7 })).sc(.085 * k, .2 * k, .085 * k).rot(PI, 0, 0); fl.vis = false;
      g0.fuse = g0.add(M('cyl', '#3A2F2A')).sc(.008 * k, .08 * k, .008 * k).at(0, -.08 * k, 0); return g0; },
    pie: function () { var g0 = new N(); g0.add(M('cyl', '#C98A4B', { spec: .3 })).sc(.17, .05, .17); g0.add(M('hemi', '#FFFBF5', { spec: .6 })).sc(.16, .09, .16).at(0, .05, 0); g0.add(M('sph', '#E8394A', { spec: .8 })).sc(.032).at(0, .14, 0); return g0; },
    cake: function () { var g0 = new N(); g0.add(M('box', '#C98A4B')).sc(.9, .5, .55).at(0, .25, 0);
      var cols = ['#FFC2DA', '#FFFFFF', '#FFC2DA']; g0.tiers = [];
      for (var i = 0; i < 3; i++) g0.tiers.push(g0.add(M('tier', cols[i], { spec: .5 })).sc(.32 - i * .08, .16, .32 - i * .08).at(0, .5 + i * .16, 0));
      for (var j = 0; j < 3; j++) { g0.add(M('cyl', '#7EC8FF')).sc(.012, .08, .012).at(-.05 + j * .05, .98, 0); g0.add(M('sphLo', '#FFD23D', { e: 1 })).sc(.016, .026, .016).at(-.05 + j * .05, 1.07, 0); }
      return g0; },
    slice: function () { var g0 = new N(); g0.add(M('box', '#FFC2DA', { spec: .4 })).sc(.16, .12, .12); g0.add(M('box', '#FFFFFF')).sc(.165, .03, .125).at(0, .06, 0); return g0; },
    cushion: function () { var g0 = new N(); g0.add(M('sph', '#FF6FA0', { spec: .6 })).sc(.22, .06, .18); g0.add(M('cyl', '#FF6FA0')).sc(.03, .06, .03).at(.22, 0, 0).rot(0, 0, -PI / 2); return g0; },
    bucket: function () { var g0 = new N(); g0.add(M('bucket', '#9AA3B8', { spec: .9, shin: 60 })); g0.add(M('arc', '#6F7890')).sc(.24).at(0, .26, 0).rot(0, PI / 2, 0); return g0; },
    peel: function () { var g0 = new N(); for (var i = 0; i < 3; i++) g0.add(M('sph', '#FFD84D', { spec: .5 })).sc(.05, .02, .14).at(Math.sin(i * TAU / 3) * .1, 0, Math.cos(i * TAU / 3) * .1).rot(0, i * TAU / 3, 0); g0.add(M('sph', '#E8C23A')).sc(.06, .04, .06); return g0; },
    magnet: function () { var g0 = new N(); g0.add(M('arc', '#E8394A', { spec: .6 })).sc(.16).rot(0, 0, PI); [-1, 1].forEach(function (s) { g0.add(M('box', '#D6DCEC', { spec: 1, shin: 80 })).sc(.07, .07, .07).at(s * .16, .02, 0); }); return g0; },
    balloon: function (c) { var g0 = new N(); g0.add(M('sph', c || '#FF4F9A', { spec: .9, shin: 70 })).sc(.16, .2, .16).at(0, .9, 0); g0.add(M('cone', c || '#FF4F9A')).sc(.03, .05, .03).at(0, .68, 0); g0.add(M('cyl', '#FFFFFF')).sc(.004, .7, .004); return g0; },
    seesaw: function () { var g0 = new N(); g0.add(M('cone', '#8B93AE', { spec: .5 })).sc(.2, .32, .2); g0.plank = g0.add(new N()).at(0, .32, 0); g0.plank.add(M('box', '#C98A4B', { spec: .2 })).sc(2.5, .06, .26); return g0; },
    jar: function () { var g0 = new N(); g0.add(M('cyl', '#BDEBFF', { a: .55, spec: 1 })).sc(.14, .26, .14); g0.add(M('cyl', '#E8394A')).sc(.15, .05, .15).at(0, .26, 0); g0.add(M('sph', '#8B5A3C')).sc(.07, .02, .07).at(0, .07, 0); g0.add(M('sph', '#8B5A3C')).sc(.07, .02, .07).at(0, .12, 0); return g0; },
    cookie: function () { var g0 = new N(); g0.add(M('sph', '#B8814A', { spec: .2 })).sc(.07, .02, .07).rot(PI / 2, 0, 0); return g0; },
    juice: function () { var g0 = new N(); g0.add(M('box', '#FF9F1C', { spec: .3 })).sc(.08, .12, .05); g0.add(M('cyl', '#FFFFFF')).sc(.006, .08, .006).at(.02, .06, 0).rot(0, 0, -.3); return g0; },
    rope: function (c) { var g0 = new N(); g0.seg = g0.add(M('cyl', c || '#D9B27A', { spec: .2 })); return g0; },
    coat: function () { var g0 = new N(); g0.add(M('coat', '#8B5A3C', { spec: .2 })); [-1, 1].forEach(function (s) { g0.add(M('arm', '#7A4E33')).sc(1.5, 2.2, 1.5).at(s * .42, 2.2, 0).rot(0, 0, s * .25); });
      for (var i = 0; i < 3; i++) g0.add(M('sph', '#3B2A20')).sc(.035).at(0, 1.4 + i * .3, .45 - i * .04); return g0; },
    hat: function () { var g0 = new N(); g0.add(M('cyl', '#3B2A20', { spec: .3 })).sc(.42, .03, .42); g0.add(M('cyl', '#3B2A20', { spec: .3 })).sc(.26, .26, .26); g0.add(M('cyl', '#E8394A')).sc(.265, .05, .265).at(0, .04, 0); return g0; },
    dumbbell: function (heavy) { var g0 = new N(), k = heavy ? 2.2 : 1; g0.add(M('cyl', '#9AA3B8', { spec: .9 })).sc(.018 * k, .32 * k, .018 * k).at(-.16 * k, 0, 0).rot(0, 0, -PI / 2);
      [-1, 1].forEach(function (s) { g0.add(M('cyl', heavy ? '#2A2F45' : '#FF4F9A', { spec: .5 })).sc(.06 * k, .04 * k, .06 * k).at(s * .13 * k, -.02 * k, 0).rot(0, 0, PI / 2); }); return g0; },
    leaf: function () { var g0 = new N(); g0.add(M('sph', '#5FCB7A', { spec: .4 })).sc(.08, .015, .05); g0.add(M('cyl', '#3A8A50')).sc(.006, .05, .006).at(.08, 0, 0).rot(0, 0, -PI / 2); return g0; },
    flag: function () { var g0 = new N(); g0.add(M('cyl', '#D6DCEC', { spec: .8 })).sc(.014, .65, .014); g0.cloth = g0.add(M('box', '#E8394A', { spec: .2 })).sc(.24, .15, .012).at(.13, .56, 0); return g0; },
    ext: function () { var g0 = new N(); g0.add(M('cyl', '#E8394A', { spec: .7 })).sc(.06, .22, .06); g0.add(M('cyl', '#2A2F45')).sc(.012, .1, .012).at(.03, .26, 0).rot(0, 0, -1.1); return g0; },
    brush: function () { var g0 = new N(); g0.add(M('cyl', '#C98A4B')).sc(.014, .22, .014); g0.add(M('cone', '#1A1A1A')).sc(.024, .06, .024).at(0, .22, 0); return g0; },
    mirror: function () { var g0 = new N(); g0.add(M('cyl', '#C9CFE0', { spec: 1, shin: 90 })).sc(.13, .015, .13).rot(PI / 2, 0, 0).at(0, .14, 0); g0.add(M('cyl', '#E8394A')).sc(.02, .12, .02); return g0; },
    shelf: function () { var g0 = new N(); g0.add(M('box', '#C98A4B', { spec: .2 })).sc(1.1, .06, .32); return g0; },
    hill: function () { var g0 = new N(); g0.add(M('hemi', '#5FCB7A', { spec: .15 })).sc(1.7, .45, 1.0); return g0; },
    butterfly: function () { var g0 = new N(); g0.add(M('sph', '#2A1B3A')).sc(.012, .04, .012); g0.wl = g0.add(M('sph', '#FF7FB8', { spec: .3 })).sc(.06, .045, .008).at(-.05, 0, 0); g0.wr = g0.add(M('sph', '#FF7FB8', { spec: .3 })).sc(.06, .045, .008).at(.05, 0, 0); return g0; },
    springs: function () { var g0 = new N(); for (var i = 0; i < 3; i++) g0.add(M('ring', '#D6DCEC', { spec: 1 })).sc(.07, .07, .07).rot(PI / 2, 0, 0).at(0, -i * .04, 0); return g0; },
    cloud: function () { var g0 = new N(); [[0, 0, .2], [-.18, -.04, .15], [.18, -.03, .16], [.06, .1, .14]].forEach(function (q) { g0.add(M('sph', '#8A8FA8', { spec: .1 })).sc(q[2]).at(q[0], q[1], 0); }); return g0; },
    pin: function () { var g0 = new N(); g0.add(M('cyl', '#D6DCEC', { spec: 1 })).sc(.006, .16, .006); g0.add(M('sph', '#E8394A')).sc(.022).at(0, .16, 0); return g0; },
    dish: function () { var g0 = new N(); g0.add(M('hemi', '#D6DCEC', { spec: .9 })).sc(.24, .1, .24).rot(PI, 0, 0); g0.add(M('cyl', '#8B93AE')).sc(.012, .16, .012).at(0, -.02, 0); g0.add(M('sph', '#C6FF3D', { e: .8 })).sc(.03).at(0, .14, 0); return g0; },
    carpet: function () { var g0 = new N(); g0.add(M('box', '#B5179E', { spec: .15 })).sc(2.4, .02, .6).at(0, .01, 0); return g0; },
    counter: function () { var g0 = new N(); g0.add(M('box', '#C98A4B', { spec: .2 })).sc(.8, .9, .4).at(0, .45, 0); g0.add(M('box', '#E8C9A0')).sc(.86, .05, .46).at(0, .92, 0); return g0; },
    gum: function () { var g0 = new N(); g0.add(M('sph', '#FF7FB8', { spec: .7 })).sc(.08, .03, .07); return g0; },
    match: function () { var g0 = new N(); g0.add(M('cyl', '#E8C9A0')).sc(.008, .12, .008); g0.add(M('sphLo', '#FF7A1A', { e: 1 })).sc(.018, .028, .018).at(0, .13, 0); return g0; },
    bar: function () { var g0 = new N(); g0.add(M('box', '#4B18A8', { a: .55 })).sc(7, .05, .6); return g0; }
  };

  /* ---------------- stage ---------------- */
  var CV = null, R = null, stages = [], raf = 0, last = 0, lastDraw = 0, PTR = null, IDLE_T0 = performance.now();
  var KEYS = { momo: 'bip', noodle: 'bop', bean: 'boop', bip: 'bip', bop: 'bop', boop: 'boop' };
  function ensure() {
    if (R) return R.ok();
    CV = document.createElement('canvas'); CV.className = 'crew3d';
    CV.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:8';
    document.body.appendChild(CV); R = new T3.Renderer(CV);
    g.addEventListener('pointermove', function (e) { PTR = [e.clientX, e.clientY]; }, { passive: true });
    g.addEventListener('pointerdown', hit, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    g.addEventListener('scroll', kick, { passive: true }); g.addEventListener('resize', function () { stages.forEach(function (s) { s.resize(); }); kick(); });
    return R.ok();
  }
  function kick() { if (!raf && stages.length) { last = 0; raf = requestAnimationFrame(loop); } }
  function loop(now) {
    raf = 0; if (document.hidden || !R || !R.ok()) return;
    var dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
    var eco = PERF.tier && PERF.tier() === 'eco';
    if (eco && now - lastDraw < 31) { raf = requestAnimationFrame(loop); return; }
    lastDraw = now;
    var vw = innerWidth, vh = innerHeight, any = false;
    R.begin(vw, vh, PERF.DPR || 1);
    for (var i = 0; i < stages.length; i++) { var st = stages[i]; if (!st.measure(vw, vh)) continue; any = true; st.tick(now, dt); R.draw(st.world, st.clip); }
    raf = requestAnimationFrame(loop);
    if (!any) { cancelAnimationFrame(raf); raf = 0; setTimeout(kick, 400); }
  }
  function hit(e) {
    stages.forEach(function (st) { if (!st.rect) return; st.list.forEach(function (c) {
      var u = st.u, P = c.P, cx = st.ox + P.x * u, top = st.oy - (P.y + c.H) * u, bot = st.oy - P.y * u, hw = c.S.r * u * 1.1;
      if (e.clientX > cx - hw && e.clientX < cx + hw && e.clientY > top && e.clientY < bot) { c.boing(); c.clicks++; clearTimeout(c._ct); c._ct = setTimeout(function () { c.clicks = 0; }, 2500);
        if (c.clicks >= 5 && !st.scene) { c.clicks = 0; st.play('pokeWar'); } }
    }); });
  }

  function Stage(el, opts) {
    opts = opts || {}; this.c = el; this.opts = opts; el.classList.add('crew-band'); if (opts.mode) el.classList.add('crew-band--' + opts.mode);
    this.world = new N(); this.props = this.world.add(new N()); this.list = []; this.chars = {};
    var self = this;
    ['bip', 'bop', 'boop'].forEach(function (k) { var c = new Char(k); self.list.push(c); self.chars[k] = c; self.world.add(c.root); });
    this.chars.momo = this.chars.bip; this.chars.noodle = this.chars.bop; this.chars.bean = this.chars.boop;
    var h = opts.home || {}; this.home = {};
    this._homeFr = { bip: h.momo != null ? h.momo : (h.bip != null ? h.bip : .3), bop: h.noodle != null ? h.noodle : (h.bop != null ? h.bop : .5), boop: h.bean != null ? h.bean : (h.boop != null ? h.boop : .7) };
    Object.defineProperty(this, 'home', { get: function () { return { momo: self._homeFr.bip, noodle: self._homeFr.bop, bean: self._homeFr.boop }; },
      set: function (v) { Object.keys(v || {}).forEach(function (k) { if (KEYS[k]) self._homeFr[KEYS[k]] = v[k]; }); } });
    this.scene = null; this.mode = 'idle'; this.parts = []; this.ret = null; this._loop = null; this._lt = 0; this.dead = false; this.perch = !!opts.perch;
    this.list.forEach(function (c) { c.reset(0, 0, {}); });
    this.say = document.createElement('div'); this.say.className = 'crew-say3'; el.appendChild(this.say);
    ensure(); stages.push(this); this.resize(); kick();
  }
  Stage.prototype.resize = function () { this._r = null; };
  /* returns false when the band is invisible; sets origin (ox,oy) in viewport px and unit u */
  Stage.prototype.measure = function (vw, vh) {
    if (this.dead || !this.c.isConnected) return false;
    var r = this.c.getBoundingClientRect(); if (!r.width || !r.height) return false;
    var u = this.u, o = this.opts;
    if (o.unitFn) u = o.unitFn(this) * 100;
    else if (o.unit) u = o.unit * 100;
    else { var fit = r.height * (o.fill || .78) / 1.55; u = Math.min(fit, r.width / ((o.min || 420) / 100)); }
    u = Math.max(18, u);
    this.u = u; this.W = r.width; this.H = r.height; this.rect = r;
    var floor = o.floorY ? o.floorY(this) : r.height - (o.floorPad != null ? o.floorPad : Math.max(4, r.height * .06));
    this.floor = floor; this.ox = r.left + r.width / 2; this.oy = r.top + floor;
    if (this.oy - 3.4 * u > vh || this.oy + 2 * u < 0 || r.left > vw || r.right < 0) return false;
    this.world.at(this.ox, -this.oy, 0); this.world.sc(u);
    this.clip = this._clipOn ? [0, 0, vw, this.oy] : null;
    this.halfU = (r.width / 2) / u;
    return true;
  };
  Stage.prototype.hx = function (c) { if (!this.W || !this.u) return (this._homeFr[c.kind] - .5) * 3; return (this._homeFr[c.kind] - .5) * this.W / this.u; };
  Stage.prototype.tick = function (now, dt) {
    var self = this, t = (now - IDLE_T0) / 1000, look = null;
    if (PTR && this.opts.track !== false) { var px = (PTR[0] - this.ox) / this.u, py = (this.oy - PTR[1]) / this.u; look = [px, py]; }
    var sc = this.scene, K = this.K;
    this.list.forEach(function (c) { c.reset(self.hx(c), t + c.ph, { seat: self.perch && !sc && !self.ret ? 1 : 0 }); });
    if (sc) {
      var st = this._seek != null ? this._seek : (now - sc.t0) / 1000;
      if (st >= sc.d) this.end(); else { K.t = st; K.now = now; try { sc.f(st, K); } catch (e) { if (g.console) console.warn('crew scene', sc.name, e); this.end(); } }
    }
    if (!this.scene && this.ret) { // walk home after a scene
      var k = clamp((now - this.ret.t0) / this.ret.d, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.list.forEach(function (c) { var f = self.ret.from[c.kind], P = c.P, hx = self.hx(c);
        P.x = f.x + (hx - f.x) * e; P.y = f.y * (1 - e); P.z = f.z * (1 - e); P.lean = f.lean * (1 - e); P.tilt = f.tilt * (1 - e);
        if (k < 1 && Math.abs(hx - f.x) > .05) { var w = Math.sin(now / 60); P.legL = w * .7; P.legR = -w * .7; P.armLf = -w * .5; P.armRf = w * .5; P.turn = hx > f.x ? 1.1 : -1.1; } });
      if (k >= 1) { this.ret = null; if (this.perch) this.list.forEach(function (c) { c.P.seat = 1; }); }
    }
    /* POP ABSORBER: any hard cut in a scene (>0.6 units or >0.9 rad in one frame) becomes a
       ~150 ms whoosh instead of a teleport. Deliberate fast moves are far below the threshold. */
    var decay = Math.exp(-dt / .07);
    this.list.forEach(function (c) { var P = c.P, pv = c._pv || (c._pv = {}), of = c._of || (c._of = { x: 0, y: 0, z: 0, lean: 0, tilt: 0 });
      if (P.hide) { c._pv = null; c._of = null; return; }
      for (var f in of) { var raw = P[f], prev = pv[f];
        if (prev != null) { var d = raw - prev; if (f === 'lean' || f === 'tilt') d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) > (f === 'lean' || f === 'tilt' ? .9 : .6)) of[f] -= d; }
        of[f] *= decay; if (Math.abs(of[f]) < 1e-4) of[f] = 0; pv[f] = raw; P[f] = raw + of[f]; } });
    // pointer look
    this.list.forEach(function (c) {
      var lk = null; if (look) { var dx = look[0] - c.P.x, dy = look[1] - (c.P.y + c.H * .75); lk = [clamp(-dy * .18, -.5, .5), clamp(dx * .22 - c.P.turn, -.7, .7)]; }
      if (!sc && !self.ret && !self.perch && look) c.P.turn = clamp((look[0] - c.P.x) * .08, -.35, .35);
      c.apply(now, lk);
    });
    this.parts.length && this.tickParts(dt);
    this.drawSay();
  };
  /* particles */
  Stage.prototype.burst = function (x, y, z, n, o) {
    o = o || {}; var cols = o.c ? (Array.isArray(o.c) ? o.c : [o.c]) : ['#FFFFFF'];
    if (this.parts.length > 140) n = Math.min(n, 4);
    for (var i = 0; i < n; i++) {
      var nd = this.props.add(M('sphLo', cols[i % cols.length], { e: o.e || 0, a: o.a != null ? o.a : 1, spec: .3 })), s = (o.sz || .05) * rnd(.6, 1.3); nd.sc(s); nd.at(x, y, z || 0);
      var a = (o.ang != null ? o.ang : PI / 2) + rnd(-1, 1) * (o.spread != null ? o.spread : PI), sp = (o.sp || 2) * rnd(.4, 1.1);
      this.parts.push({ n: nd, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(-.6, .6) * (o.zsp || sp * .3), l: 0, m: (o.life || .8) * rnd(.7, 1.2), g: o.g != null ? o.g : 6, s: s, grow: o.grow || 0, a0: o.a != null ? o.a : 1 });
    }
  };
  Stage.prototype.tickParts = function (dt) {
    for (var i = this.parts.length - 1; i >= 0; i--) { var p = this.parts[i]; p.l += dt; var k = p.l / p.m;
      if (k >= 1) { this.props.remove(p.n); this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= p.g * dt; p.n.p[0] += p.vx * dt; p.n.p[1] += p.vy * dt; p.n.p[2] += p.vz * dt; p.vx *= .985;
      var s = p.s * (1 + p.grow * k) * (k > .7 ? 1 - (k - .7) / .3 : 1); p.n.sc(Math.max(.001, s)); if (p.a0 < 1) p.n.a = p.a0 * (1 - k); }
  };
  Stage.prototype.drawSay = function () {
    var ch = null, now = performance.now(); this.list.forEach(function (c) { if (c._say && c._say.until > now) ch = c; });
    if (!ch) { if (this.say.classList.contains('on')) this.say.classList.remove('on'); return; }
    if (this.say.textContent !== ch._say.t) this.say.textContent = ch._say.t;
    var x = this.W / 2 + ch.P.x * this.u, y = this.floor - (ch.P.y + ch.H + .25) * this.u;
    this.say.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px) translate(-50%,-100%)'; this.say.classList.add('on');
  };

  /* ---------------- scene runtime ---------------- */
  function s(t, a, b) { return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a); }
  var E = {
    io: function (k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; },
    out: function (k) { return 1 - Math.pow(1 - k, 3); }, inn: function (k) { return k * k * k; },
    back: function (k) { var c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    el: function (k) { return k === 0 || k === 1 ? k : Math.pow(2, -9 * k) * Math.sin((k * 10 - .75) * TAU / 3) + 1; },
    bounce: function (k) { var n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; }
  };
  function L(a, b, k) { return a + (b - a) * k; }
  function arc(k, h) { return 4 * k * (1 - k) * h; }
  function gait(P, t, r, amp) { var w = Math.sin(t * (r || 16)); P.legL = w * (amp || .75); P.legR = -P.legL; P.armLf = -w * .6; P.armRf = w * .6; P.y += Math.abs(w) * .05; }
  function mv(P, x0, x1, t, t0, t1, r, ease) { var k = s(t, t0, t1); P.x = L(x0, x1, (ease || E.io)(k)); if (k > 0 && k < 1 && Math.abs(x1 - x0) > .02) { P.turn = x1 > x0 ? 1.1 : -1.1; gait(P, t, r || 16); } return k; }
  function face(P, x) { P.turn = clamp((x - P.x) * 1.4, -1.15, 1.15); }
  function cheer(P, t, k) { P.armL = P.armR = 2.5 + Math.sin(t * 14) * .25 * (k == null ? 1 : k); P.mouth = 'open'; P.eyes = 'happy'; }
  function laugh(P, t) { P.mouth = 'open'; P.eyes = 'happy'; P.lean = Math.sin(t * 9) * .08; P.y += Math.abs(Math.sin(t * 9)) * .06; P.armL = P.armR = .5; P.armLf = P.armRf = .9; }
  function flail(P, t, sp) { sp = sp || 22; P.armL = 1.4 + Math.sin(t * sp) * 1.1; P.armR = 1.4 + Math.sin(t * sp + 2) * 1.1; P.armLf = Math.sin(t * sp * .7) * .8; P.armRf = Math.cos(t * sp * .8) * .8; }
  function dizzy(P) { P.eyes = 'x'; P.dizzy = 1; P.mouth = 'o'; }
  function pnode(n, x, y, z) { n.at(x, y, z || 0); return n; }

  Stage.prototype.play = function (name, ctx, done) {
    var key = ALIAS[name] || name, sc = SC[key]; if (!sc) { if (done) done(); return; }
    if (this.scene) this.end(true);
    if (!this.u) this.measure(innerWidth, innerHeight);
    var self = this, hw = this.halfU || 3, mids = this.list.map(function (c) { return self.hx(c); });
    var sp = clamp(hw * .42, .85, 1.35), mid = clamp((mids[0] + mids[1] + mids[2]) / 3, -hw + sp + .5, hw - sp - .5);
    if (hw < sp + .5 || !isFinite(mid)) mid = 0;
    var K = this.K = { st: this, ca: this.chars.bip, cb: this.chars.bop, cc: this.chars.boop, a: this.chars.bip.P, b: this.chars.bop.P, c: this.chars.boop.P,
      sp: sp, mid: mid, A: mid - sp, B: mid, C: mid + sp, hw: hw, ctx: ctx || {}, made: [], done: {}, t: 0 };
    K.prop = function (nm, arg) { var n = PROPS[nm](arg); self.props.add(n); K.made.push(n); return n; };
    K.hold = function (n, ch, where, x, y, z) { var host = where === 'R' ? ch.n.handR : where === 'L' ? ch.n.handL : where === 'back' ? ch.n.back : where === 'top' ? ch.n.top : where === 'front' ? ch.n.front : where === 'torso' ? ch.torso : self.props; host.add(n); n.at(x || 0, y || 0, z || 0); if (K.made.indexOf(n) < 0) K.made.push(n); return n; };
    K.at = function (t0, id, fn) { if (K.t >= t0 && !K.done[id]) { K.done[id] = 1; fn(); } };
    K.fx = function (x, y, z, n, o) { self.burst(x, y, z, n, o); };
    K.sfx = function (t0, nm) { K.at(t0, 'sfx' + t0 + nm, function () { SFX(nm); }); };
    K.clip = function (on) { self._clipOn = on; };
    K.say = function (ch, txt, ms) { ch.say(txt, ms); };
    K.faceY = function (ch) { return ch.P.y + BY + ch.S.eyes[0][1]; };
    K.home = function (ch) { return self.hx(ch); };
    /* SEAMLESS LOOPS: every scene starts from wherever the trio is right now (no snap to home)
       and spends its last ~0.7 s easing every joint back to the neutral formation pose, so a
       scene can follow itself or any other scene with zero visible pops. */
    var start = [K.ca, K.cb, K.cc].map(function (ch) { var P = ch.P; return isFinite(P.x) ? P.x : self.hx(ch); });
    var dur = sc.d * (reduced ? 1.15 : 1), OUT = Math.min(.7, dur * .14);
    this.scene = { name: key, sc: sc, d: dur, t0: performance.now(), done: done,
      f: function (t, K2) {
        var CH = [K2.ca, K2.cb, K2.cc], slots = [K2.A, K2.B, K2.C], rest = CH.map(function (ch) { return Object.assign({}, ch.P); });
        if (sc.form !== false) { var k = s(t, 0, .45);
          CH.forEach(function (ch, i) { var P = ch.P; P.x = L(start[i], slots[i], E.io(k)); if (k < 1 && Math.abs(slots[i] - start[i]) > .05) { P.turn = slots[i] > start[i] ? 1.1 : -1.1; gait(P, t, 16); } }); }
        else CH.forEach(function (ch, i) { var k0 = E.io(s(t, 0, .35)); ch.P.x = L(start[i], ch.P.x, k0); });
        sc.f(t, K2);
        var ko = s(t, dur - OUT, dur * .995); if (ko <= 0) return; var e = E.io(ko);
        CH.forEach(function (ch, i) { var P = ch.P, R0 = rest[i]; R0.x = sc.form === false ? self.hx(ch) : slots[i];
          var wasHidden = !!P.hide;
          NUM.forEach(function (f) { if (!isFinite(P[f])) P[f] = R0[f]; P[f] = L(P[f], R0[f], e); });
          ANG.forEach(function (f) { var d0 = Math.atan2(Math.sin(P[f]), Math.cos(P[f])); P[f] = L(d0, R0[f] || 0, e); });
          if (ko > .55) DISC.forEach(function (f) { P[f] = R0[f]; });
          if (wasHidden) { P.hide = 0; P.y = L(2.8, 0, E.bounce(ko)); P.eyes = 'wide'; } });
        K2.made.forEach(function (n) { if (!n._bs) n._bs = n.s.slice(); var f = Math.max(.001, 1 - E.inn(ko)); n.s[0] = n._bs[0] * f; n.s[1] = n._bs[1] * f; n.s[2] = n._bs[2] * f; });
        if (ko > .5) K2.clip(false);
      } };
    this.ret = null; this.mode = this.mode || 'idle'; kick();
    if (this.opts.onScene) try { this.opts.onScene(key); } catch (e) {}
    return key;
  };
  var NUM = ['x', 'y', 'z', 'sq', 'armL', 'armR', 'armLf', 'armRf', 'armLt', 'armRt', 'legL', 'legR', 'legLs', 'legRs', 'seat', 'brow', 'dark', 'hairUp', 'size'];
  var ANG = ['turn', 'spin', 'lean', 'tilt'];
  var DISC = ['eyes', 'mouth', 'look', 'stache', 'dizzy', 'cream', 'chew', 'cross', 'lid'];
  Stage.prototype.end = function (silent) {
    var sc = this.scene; if (!sc) return; var K = this.K, self = this;
    K.made.forEach(function (n) { if (n.parent) n.parent.remove(n); });
    this._clipOn = false; this.scene = null;
    var from = {}; this.list.forEach(function (c) { var P = c.P, ln = Math.atan2(Math.sin(P.lean), Math.cos(P.lean)), tl = Math.atan2(Math.sin(P.tilt), Math.cos(P.tilt));
      from[c.kind] = { x: P.x, y: P.y, z: P.z, lean: ln, tilt: tl }; c._say = null; });
    var far = 0; this.list.forEach(function (c) { var f = from[c.kind]; far = Math.max(far, Math.abs(f.x - self.hx(c)) * .14 + Math.abs(f.y) * .16); });
    this.ret = { t0: performance.now(), d: 1000 * clamp(.35 + far, .4, 1.5), from: from };
    if (!silent && sc.done) { var d = sc.done; setTimeout(d, 0); }
  };
  /* QA: freeze a scene at time t (seconds) */
  Stage.prototype.seek = function (name, t) { if (!this.scene || this.scene.name !== (ALIAS[name] || name)) this.play(name); this._seek = t; kick(); };
  Stage.prototype.stopLoop = function () { clearTimeout(this._lt); this._loop = null; };
  var TALL = ['trenchcoat', 'humanLadder', 'piggyback', 'springBoots'];
  Stage.prototype.pick = function (group) {
    var arr = Array.isArray(group) ? group.reduce(function (a, g0) { return a.concat(GROUPS[g0] || (SC[g0] ? [g0] : [])); }, []) : (GROUPS[group] || (SC[group] ? [group] : []));
    var self = this; this.recent = this.recent || [];
    /* short bands (lobby strip, card ledge, headline): skip gags with tall props so nothing covers the text */
    if (this.u && this.floor / this.u < 2.6) { var lo = arr.filter(function (n) { return TALL.indexOf(n) < 0; }); if (lo.length) arr = lo; }
    var fresh = arr.filter(function (n) { return self.recent.indexOf(n) < 0; }), pool = fresh.length ? fresh : arr;
    var n = pool[Math.floor(Math.random() * pool.length)]; if (n) { this.recent.push(n); if (this.recent.length > 8) this.recent.shift(); }
    return n;
  };
  Stage.prototype.playGroup = function (group, ctx, done) { var n = this.pick(group); if (n) this.play(n, ctx, done); else if (done) done(); return n; };
  Stage.prototype.loopGroup = function (group, gmin, gmax, ctx) {
    var self = this; this.stopLoop(); var token = this._loop = {};
    (function next() { if (self._loop !== token || self.dead) return;
      self.playGroup(group, ctx, function () { if (self._loop !== token) return; self._lt = setTimeout(next, (gmin || 1800) + Math.random() * ((gmax || 3600) - (gmin || 1800))); }); })();
  };
  Stage.prototype.clear = function () { if (this.scene) this.end(true); this.ret = null; };
  Stage.prototype.home_ = function () { if (!this.scene && !this.ret) { var self = this, from = {}; this.list.forEach(function (c) { from[c.kind] = { x: c.P.x, y: 0, z: 0, lean: 0, tilt: 0 }; }); this.ret = { t0: performance.now(), d: 550, from: from }; } };
  var LOBBY_MIX = ['gag', 'gag', 'dance', 'gag'];
  Stage.prototype.moment = function (m) {
    this.mode = m; this.stopLoop(); var self = this;
    if (m === 'lobby') { this.clear(); this._lt = setTimeout(function () { self.loopGroup(LOBBY_MIX, 1600, 3400); }, 700); }
    else if (m === 'read') this.playGroup('read');
    else if (m === 'answer' || m === 'idle') { if (this.scene) this.end(true); }
    else if (m === 'between') this.playGroup('gag');
  };
  Stage.prototype.react = function (kind, ctx) {
    this.stopLoop(); var map = { crowd: 'crowd', right: 'crowd', rebel: 'rebel', wrong: 'quizWrong', streakCrowd: 'crowd', streakRebel: 'rebel', upset: 'upset', gameover: 'gameover' };
    return this.playGroup(map[kind] || 'crowd', ctx);
  };
  Stage.prototype.welcome = function (names) {
    if (!names || !names.length || (this.scene && this.mode !== 'lobby')) return;
    var self = this, nm = names[names.length - 1]; this.play('wave', { name: nm }, function () { if (self.mode === 'lobby') self.loopGroup(LOBBY_MIX, 1600, 3400); });
    this.chars.bop.say(names.length > 1 ? 'Hi ' + nm + ' +' + (names.length - 1) + '!' : 'Hi ' + nm + '!', 1800);
  };
  Stage.prototype.fun = function (gmin, gmax) { this.loopGroup(['gag', 'gag', 'dance', 'chill'], gmin || 1500, gmax || 3200); };
  Stage.prototype.chaos = function () { this.stopLoop(); this.playGroup('gag'); };
  Stage.prototype.konami = function () { this.stopLoop(); this.play('danceParty'); };
  Stage.prototype.shakeFall = function () { this.stopLoop(); this.play('domino'); };
  Stage.prototype.setSkin = function () {};
  Stage.prototype.destroy = function () { this.dead = true; this.stopLoop(); if (this.scene) this.end(true); var i = stages.indexOf(this); if (i >= 0) stages.splice(i, 1); if (this.say.parentNode) this.say.remove(); };
  function units(st, frac) { return (frac - .5) * st.W / st.u; }
  /* live game moments (dynamic scenes) */
  Stage.prototype.attend = function (frac, spread) {
    if (this.scene && this.scene.name !== 'attend') return; var tx = units(this, frac), self = this, sp = (spread || .07) * this.W / this.u;
    var from = this.list.map(function (c) { return c.P.x; });
    SC.attend = { d: 2.2, form: false, f: function (t, K) { [K.ca, K.cb, K.cc].forEach(function (ch, i) { var P = ch.P, x1 = clamp(tx + (i - 1) * sp, -K.hw + .3, K.hw - .3);
        var k = mv(P, from[i], x1, t, i * .04, .42 + i * .04, 22); P.y += arc(s(t, .5 + i * .05, .9 + i * .05), .35);
        if (k >= 1) { P.turn = 0; cheer(P, t, .6); if (t > 1.3) { P.seat = self.perch ? 1 : 0; P.armL = P.armR = .3; P.mouth = 'grin'; P.eyes = 'open'; P.x = x1; } } });
      K.sfx(.5, 'boing'); } };
    this.play('attend');
  };
  Stage.prototype.lockSeal = function (frac) {
    this.stopLoop(); var tx = units(this, frac), self = this, from = this.list.map(function (c) { return c.P.x; });
    SC.stomp = { d: 2.4, form: false, f: function (t, K) { [K.ca, K.cb, K.cc].forEach(function (ch, i) { var P = ch.P, x1 = tx + (i - 1) * K.sp * .55;
        mv(P, from[i], x1, t, 0, .32, 24); var j = s(t, .4, 1.0); P.y += arc(j, 1.1); if (j > 0 && j < 1) { P.armL = P.armR = 2.7; P.legL = -.6; P.legR = .6; P.tilt = -j * TAU * (i === 1 ? 1 : 0); }
        if (t > 1.0 && t < 1.25) P.sq = .62; if (t > 1.25) { P.turn = 0; P.mouth = 'grin'; P.brow = 1; P.armL = P.armR = 1.1; P.armLf = P.armRf = 1.2; } });
      K.at(1.0, 'st', function () { SFX('lock'); K.fx(tx, .05, .2, 22, { c: ['#C6FF3D', '#FFFFFF', '#A100FF'], sp: 3, ang: PI / 2, spread: 1.3, g: 7, sz: .04, e: .8 }); }); } };
    this.play('stomp');
  };
  Stage.prototype.panic = function (sec) {
    if (this.scene && this.scene.name !== 'panic') return; var self = this;
    SC.panic = { d: sec <= 1 ? 1.6 : .95, form: false, f: function (t, K) {
      [K.ca, K.cb, K.cc].forEach(function (ch, i) { var P = ch.P, ph = i * 2.1 + sec;
        P.x = K.home(ch) + Math.sin(t * 9 + ph) * K.sp * .9; P.turn = Math.cos(t * 9 + ph) > 0 ? 1.1 : -1.1; gait(P, t, 30, .9); flail(P, t, 30); P.eyes = 'wide'; P.mouth = 'open';
        if (sec <= 1 && t > .9) { P.x = K.mid + (i - 1) * .3; P.lean = (i - 1) * 1.2; P.eyes = 'x'; P.dizzy = 1; P.legL = P.legR = 0; P.armL = P.armR = 1; } });
      if (sec <= 1) K.sfx(.9, 'bonk'); } };
    this.play('panic');
  };
  Stage.prototype.climbIn = function (spots) {
    this.stopLoop(); var self = this;
    var st = spots.map(function (sp) { return { x: units(self, sp.x), d: sp.drop / self.u }; });
    SC.climb = { d: 2.6, form: false, f: function (t, K) { [K.ca, K.cb, K.cc].forEach(function (ch, i) { var P = ch.P, sp = st[i % st.length], t0 = i * .18;
        var k = s(t, t0, t0 + 1.0); P.x = sp.x; P.y = -sp.d * (1 - E.out(k)); P.z = .25;
        if (k < 1) { var w = Math.sin(t * 14); P.armL = 2.6 + w * .4; P.armR = 2.6 - w * .4; P.legL = w * .6; P.legR = -w * .6; P.mouth = 'flat'; P.brow = 1; }
        else { var h = K.home(ch), k2 = s(t, t0 + 1.05, t0 + 1.55); P.z = .25 * (1 - k2); P.y += arc(s(t, t0 + 1.0, t0 + 1.3), .3); mv(P, sp.x, h, t, t0 + 1.05, t0 + 1.55, 18);
          if (t > t0 + 1.6) { P.turn = 0; P.seat = Math.min(1, (t - t0 - 1.6) * 4); P.mouth = 'grin'; } } }); K.sfx(1.0, 'hup'); } };
    this.play('climb');
  };

  /* ==================================================================
     THE GAGS — 30 slapstick bits from the brief + celebrations/system
     a = Bip (tall, one eye) · b = Bop (short, cap) · c = Boop (chubby)
     every scene: formation (A | B | C) in .45 s, then the bit.
     ================================================================== */
  var SC = {};
  /* ---------- ROCKET GAGS ---------- */
  SC.sneakyRocket = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var bf = K.bf || (K.bf = K.prop('butterfly')); var bt = t * 1.6; pnode(bf, B + Math.sin(bt) * .35, 1.25 + Math.sin(bt * 2.3) * .12, .5); bf.wl.r[1] = Math.sin(t * 30) * .9; bf.wr.r[1] = -bf.wl.r[1]; bf.vis = t < 3.1;
    b.turn = 0; b.look = [-.45, Math.sin(bt) * .4]; b.eyes = 'happy'; b.mouth = 'o'; b.armL = b.armR = .3;
    if (t > .5) { mv(a, A, B - .32, t, .6, 1.4, 6); a.z = -.35 * s(t, .6, 1.4); a.tilt = .25; a.mouth = 'grin'; a.brow = 1; }
    var rk = K.rk || (K.rk = K.hold(K.prop('rocket'), K.cb, 'back', 0, -.05, -.06)); rk.vis = t > 1.6; rk.r[0] = -.15;
    if (t > 1.4 && t < 2.6) { a.armLf = a.armRf = 1.3 + Math.sin(t * 20) * .2; a.x = B - .32; }
    if (t > 1.5) { mv(c, C, B + .3, t, 1.5, 2.2, 6); c.z = -.38 * s(t, 1.5, 2.2); c.tilt = .2; c.mouth = 'grin'; c.brow = 1;
      var m = K.mt || (K.mt = K.hold(K.prop('match'), K.cc, 'R', 0, 0, .05)); m.vis = t > 1.9 && t < 3.0; if (t > 2.2 && t < 3) c.armRf = 1.2; }
    K.at(2.4, 'spark', function () { K.fx(B, .55, -.5, 12, { c: ['#FFD23D', '#FF7A1A'], sp: 1.6, sz: .025, e: 1, life: .5, g: 1 }); SFX('fizz'); });
    if (t > 2.6 && t < 3.0) { a.x = B - .32; a.mouth = 'open'; laugh(a, t); }
    if (t >= 3.0) { var k = s(t, 3.0, 5.2), ang = k * 13;
      rk.flame.vis = k < 1; rk.flame.sc(1, .8 + Math.random() * .5, 1); K.sfx(3.0, 'zoom');
      b.x = B + Math.sin(ang) * .7 * (1 - k * .3); b.y = k * k * 7.5; b.z = Math.cos(ang) * .6; b.spin = k * 22; b.eyes = 'wide'; b.mouth = 'open'; flail(b, t, 30);
      if (Math.random() < .5 && k < 1) K.fx(b.x, b.y + .4, b.z, 1, { c: '#C9C4D8', sp: .3, g: -1, sz: .07, life: .7, grow: 2, a: .6 });
      var k2 = s(t, 3.25, 5.45), a2 = k2 * 13; c.x = B + Math.sin(a2) * .7 * (1 - k2 * .3); c.y = Math.max(0, k2 * k2 * 7.5 - .95); c.z = Math.cos(a2) * .6 - .2; c.spin = k2 * 20; c.lean = .6 * Math.sin(t * 9); c.eyes = 'wide'; c.mouth = 'open'; flail(c, t, 26);
      a.x = B - .32; a.z = 0; a.tilt = 0; a.turn = 0; a.eyes = 'wide'; a.mouth = 'o'; a.armL = a.armR = 2.6; a.sq = .92; a.hairUp = 1; }
    if (t >= 5.6) { var f = s(t, 5.6, 6.4), F = E.inn(f); b.x = B + .2; b.y = L(8, 0, F); b.z = 0; b.spin = 0; c.x = C; c.y = L(8, 0, s(t, 5.8, 6.6) * s(t, 5.8, 6.6)); c.z = 0; c.spin = 0; c.lean = 0;
      if (f >= 1) { b.sq = t < 6.55 ? .6 : 1; dizzy(b); } if (t > 6.6) { c.sq = t < 6.75 ? .6 : 1; dizzy(c); rk.vis = false; }
      K.sfx(6.4, 'bonk'); K.sfx(6.6, 'bonk'); } } };

  SC.rocketChain = { d: 6.8, f: function (t, K) { var P = [K.a, K.b, K.c], CH = [K.ca, K.cb, K.cc], M0 = K.mid;
    K.rks = K.rks || CH.map(function (ch) { var r = K.hold(K.prop('rocket'), ch, 'back', 0, -.05, -.05); return r; });
    var circle = [[-.55, .25], [.55, .25], [0, -.45]];
    P.forEach(function (p, i) { var nx = circle[(i + 1) % 3];
      if (t > .45 && t < 2.3) { p.x = L(p.x, M0 + circle[i][0], s(t, .45, .8)); p.z = circle[i][1] * s(t, .45, .8); p.turn = Math.atan2(nx[0] - circle[i][0], nx[1] - circle[i][1]) * .9; p.mouth = 'grin';
        if (t > .9 && t < 1.7) { p.armLf = p.armRf = 1.2; laugh(p, t); } }
      if (t >= 2.3) { var k = s(t, 2.3, 4.6), th = (t - 2.3) * 7.5 + i * TAU / 3, R0 = .95 * Math.min(1, (t - 2.3) * 3), cy = 2.2 * E.out(s(t, 2.3, 2.8));
        K.rks[i].flame.vis = k < 1; K.rks[i].flame.sc(1, .7 + Math.random() * .6, 1);
        if (t < 4.6) { p.x = M0 + Math.cos(th) * R0; p.y = cy + Math.sin(th) * R0; p.z = 0; p.lean = th + PI / 2; p.turn = 0; flail(p, t, 26); p.eyes = 'wide'; p.mouth = 'open'; }
        else { var f = s(t, 4.6, 5.0); p.x = L(M0 + Math.cos(th) * R0, M0 + (i - 1) * .3, f); p.y = L(2.2, [0, .55, 1.0][i] * 1, E.inn(f)); p.lean = [1.3, -1.2, .4][i] * f; p.turn = 0; K.rks[i].vis = false; if (f >= 1) dizzy(p); } } });
    K.at(1.9, 'sp', function () { K.fx(M0, .5, 0, 14, { c: ['#FFD23D', '#FF7A1A'], sp: 1.4, sz: .025, e: 1, life: .5, g: 1 }); SFX('fizz'); });
    K.sfx(2.3, 'zoom'); K.sfx(4.95, 'bonk'); } };

  SC.wrongEnd = { d: 6.6, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var rk = K.rk || (K.rk = K.hold(K.prop('rocket'), K.cc, 'R', 0, .05, .05));
    if (t < 1.4) { c.armR = 2.5; c.mouth = 'grin'; c.turn = 0; rk.r[2] = 0; }
    if (t >= 1.4 && t < 2.2) { if (rk.parent !== K.cc.n.back) K.hold(rk, K.cc, 'back', 0, .05, -.05); rk.r[0] = PI; c.armR = 1.8; c.armRf = .5; c.mouth = 'grin'; c.eyes = 'happy'; }
    if (t < 2.2) { [a, b].forEach(function (p, i) { p.turn = i ? -.4 : .4; p.armR = 1.2 + (Math.floor(t * 2.5) % 2) * .6; p.mouth = 'o'; }); K.sfx(1.6, 'tick'); K.sfx(1.9, 'tick'); }
    if (t >= 2.2 && t < 5.2) { K.clip(true); rk.flame.vis = true; rk.flame.sc(1, .8 + Math.random() * .5, 1);
      var k = s(t, 2.2, 2.6); c.lean = PI * E.out(k); c.y = L(0, .22, k) - s(t, 2.6, 3.3) * .05; c.spin = (t - 2.2) * 30 * (1 - s(t, 3.2, 3.6)); c.legL = Math.sin(t * 22) * .6; c.legR = -c.legL;
      if (Math.random() < .6) K.fx(B + rnd(-.2, .2) + K.C - K.B, .02, .2, 1, { c: ['#8B5A3C', '#5B3A2E'], sp: 2.2, g: 8, sz: .045, life: .6, ang: PI / 2, spread: .9 });
      K.sfx(2.2, 'zoom'); }
    if (t >= 3.6 && t < 5.2) { rk.flame.vis = false; mv(a, A, C - .38, t, 3.6, 4.1, 18); mv(b, B, C + .38, t, 3.6, 4.1, 18);
      if (t > 4.1) { var pull = Math.sin((t - 4.1) * 12) * .05; a.turn = 1.1; b.turn = -1.1; a.armL = a.armR = 2.2; a.armLf = a.armRf = 1.0; b.armL = b.armR = 2.2; b.armLf = b.armRf = 1.0; a.lean = .35 + pull; b.lean = -.35 - pull; a.brow = b.brow = 1; a.mouth = b.mouth = 'flat'; a.x = C - .4; b.x = C + .4; } }
    if (t >= 5.2) { K.clip(false); var p = s(t, 5.2, 5.9); c.y = arc(p, 1.4); c.lean = PI + PI * E.out(p); rk.vis = false; if (p >= 1) { dizzy(c); c.lean = 0; }
      a.x = C - .4 - p * .5; b.x = C + .4 + p * .5; a.lean = .2 - p * 1.6; b.lean = -.2 + p * 1.6; if (p >= 1) { a.lean = -PI / 2; b.lean = PI / 2; }
      K.at(5.2, 'pop', function () { SFX('pop'); K.fx(C, .2, .2, 16, { c: ['#8B5A3C', '#C6FF3D'], sp: 2.5, sz: .04 }); }); } } };

  SC.rocketSeat = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var rk = K.rk || (K.rk = K.prop('rocket', true)); rk.r[2] = -PI / 2;
    var rx = L(A - .4, A - .4, 0), ry = .3, launch = s(t, 3.6, 5.0);
    pnode(rk, rx + E.inn(launch) * 8, ry + E.inn(launch) * 7, 0); rk.r[2] = -PI / 2 + launch * .7; rk.flame.vis = launch > 0 && launch < 1; rk.flame.sc(1, .8 + Math.random() * .6, 1); rk.vis = launch < 1;
    if (t > .45 && t < 4.8) { [a, b].forEach(function (p, i) { var off = i ? .55 : 1.0; p.x = rk.p[0] + off; p.y = rk.p[1] + .1; p.turn = 1.0; p.seat = 1; p.lean = rk.r[2] + PI / 2; p.mouth = launch > 0 ? 'open' : 'grin'; if (launch > 0) { p.eyes = 'wide'; flail(p, t, 20); } else p.armL = p.armR = .6; }); }
    c.turn = -.5; if (t < 3.6) { c.armR = 1.6 + Math.sin(t * 6) * .3; c.armRf = .6; c.y = Math.abs(Math.sin(t * 7)) * .12 * s(t, 1, 3.6); c.mouth = 'open'; c.eyes = 'happy'; K.sfx(1.4, 'tick'); K.sfx(2.2, 'tick'); K.sfx(3.0, 'tick'); }
    else { c.turn = .4; c.armR = 2.6 + Math.sin(t * 16) * .3; c.mouth = 'grin'; }
    K.sfx(3.6, 'zoom');
    if (t >= 5.0) { var f = s(t, 5.0, 5.7); [a, b].forEach(function (p, i) { p.seat = 0; p.x = c.x - 1.0 - i * .7; p.y = L(7, 0, E.inn(f)); p.lean = (i ? -1 : 1) * PI / 2 * f; if (f >= 1) dizzy(p); }); K.sfx(5.7, 'bonk');
      c.turn = 0; c.mouth = 'grin'; c.eyes = 'happy'; c.armR = .2; } } };

  SC.fizzle = { d: 6.8, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var rk = K.rk || (K.rk = K.prop('rocket')); var up = s(t, 3.9, 4.4); pnode(rk, B, up * 9, .55); rk.flame.vis = up > 0 && up < 1;
    if (t > .5 && t < 2.6 && Math.random() < (t < 1.5 ? .6 : .2)) K.fx(B, .05, .55, 1, { c: t < 1.5 ? ['#FFD23D', '#FF7A1A'] : '#B8B4C8', sp: .7, g: t < 1.5 ? 2 : -.8, sz: t < 1.5 ? .02 : .06, e: t < 1.5 ? 1 : 0, life: .6, grow: t < 1.5 ? 0 : 1.5, a: t < 1.5 ? 1 : .6 });
    K.sfx(.5, 'fizz');
    var lean = E.io(s(t, 2.6, 3.6)) * (1 - s(t, 3.9, 4.0));
    [a, b, c].forEach(function (p, i) { var x0 = [A, B, C][i]; p.x = L(x0, B + (i - 1) * .42, lean > 0 || t > 3.9 ? 1 : 0) ; if (t < 2.6) p.x = x0;
      if (t > 2.6 && t < 3.9) { p.x = L(x0, B + (i - 1) * .42, E.io(s(t, 2.6, 3.4))); p.tilt = .55 * lean; p.z = .2 * lean; p.look = [.5, -(i - 1) * .4]; p.turn = -(i - 1) * .5; p.eyes = 'wide'; p.mouth = 'o'; }
      if (t >= 3.9) { p.x = B + (i - 1) * .42; p.turn = 0; p.dark = 1 - s(t, 6.0, 6.7); p.hairUp = 1; p.eyes = 'wide'; p.mouth = 'o'; p.armL = p.armR = .5; p.sq = t < 4.05 ? .78 : 1;
        if ((t > 4.6 && t < 4.72) || (t > 5.2 && t < 5.32) || (t > 5.8 && t < 5.92)) p.eyes = 'closed'; } });
    K.at(3.9, 'boom', function () { SFX('bassdrop'); K.fx(B, .4, .55, 34, { c: ['#FFFFFF', '#FFD23D', '#FF7A1A'], sp: 4, sz: .07, e: 1, life: .5, g: 0 }); });
    if (t > 4.0 && t < 6.0 && Math.random() < .35) K.fx(B + rnd(-1.4, 1.4), 2.4, .3, 1, { c: '#2A2333', sp: .2, g: .6, sz: .03, life: 2.4, spread: .3, ang: -PI / 2 }); } };

  SC.rocketTug = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var rk = K.rk || (K.rk = K.prop('rocket')); rk.r[2] = -PI / 2;
    var ex = K.ex || (K.ex = K.hold(K.prop('ext'), K.cc, 'R', 0, 0, .05));
    var rx = B, ry = .5;
    if (t > .45 && t < 2.0) { rx = B + Math.sin(t * 7) * .15; a.x = rx - .42; b.x = rx + .42; a.turn = 1.1; b.turn = -1.1; a.lean = .3 + Math.sin(t * 7) * .1; b.lean = -.3 + Math.sin(t * 7) * .1; a.brow = b.brow = 1; a.mouth = b.mouth = 'flat'; a.armL = a.armR = b.armL = b.armR = 1.3; a.armLf = a.armRf = b.armLf = b.armRf = 1.1; }
    if (t >= 2.0) { var k = s(t, 2.0, 5.7), dir = Math.cos((t - 2) * 3.2) > 0 ? 1 : -1; rx = B + Math.sin((t - 2) * 3.2) * Math.min(K.hw - .9, 1.9); ry = .5 + Math.abs(Math.sin(t * 9)) * .08;
      rk.flame.vis = k < 1; rk.flame.sc(1, .8 + Math.random() * .5, 1); rk.r[2] = dir > 0 ? -PI / 2 : PI / 2;
      if (k < 1) { [a, b].forEach(function (p, i) { p.x = rx - dir * (.45 + i * .45); p.y = .1; p.turn = dir * 1.1; p.lean = -dir * .7; p.legL = p.legR = -.6; p.armL = p.armR = 1.2; p.armLf = p.armRf = 1.3; p.eyes = 'wide'; p.mouth = 'open'; });
        if (Math.random() < .5) K.fx(rx - dir * 1.2, .05, .1, 1, { c: '#D9CFC0', sp: .8, g: 1, sz: .05, life: .5, a: .7 }); }
      c.x = rx - dir * 1.9; c.turn = dir * 1.1; gait(c, t, 22); c.armRf = 1.4; c.armR = .8;
      if (Math.random() < .7) K.fx(c.x + dir * .3, .7, .2, 2, { c: ['#FFFFFF', '#E6F6FF'], sp: 2.5, g: 2, sz: .05, life: .6, ang: rnd(0, PI), spread: .4 });
      K.sfx(2.0, 'zoom');
      if (k >= 1) { rk.vis = false; [a, b].forEach(function (p, i) { p.x = rx - dir * (.45 + i * .45); p.lean = (i ? -1 : 1) * PI / 2; p.y = 0; dizzy(p); p.cream = t > 6.2 ? 1 : 0; }); c.legL = c.legR = 0; c.turn = 0; } }
    rk.p = [rx, ry, 0]; } };

  /* ---------- REVENGE & PAYBACK ---------- */
  function pieThrow(K, key, from, to, t0, dur, chTo) {
    var pie = K[key] || (K[key] = K.prop('pie')); var k = s(K.t, t0, t0 + dur);
    pie.vis = k > 0 && k < 1; if (!pie.vis) return k;
    var y0 = from.y + .7, y1 = K.faceY(chTo); pnode(pie, L(from.x, to.x, k), L(y0, y1, k) + arc(k, .55), .35); pie.r[0] = -PI / 2 * k + .2; pie.r[2] = k * (to.x > from.x ? -1 : 1) * .6;
    return k;
  }
  function splat(K, P, ch, id, t0) { K.at(t0, id, function () { SFX('splat'); K.fx(P.x, K.faceY(ch), .45, 18, { c: ['#FFFBF5', '#FFE3EE'], sp: 2.4, sz: .05, life: .6 }); }); if (K.t >= t0) { P.cream = 1; if (K.t < t0 + .15) P.sq = .75; } }
  SC.pieRelay = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, CH = { a: K.ca, b: K.cb, c: K.cc }, Pp = { a: a, b: b, c: c };
    face(a, b.x); face(b, c.x); face(c, a.x);
    var seq = [['a', 'b', .8], ['b', 'c', 1.8], ['c', 'a', 2.7]];
    for (var i = 0; i < 9; i++) { var pair = [['a', 'c'], ['b', 'a'], ['c', 'b']][i % 3]; seq.push([pair[0], pair[1], 3.4 + i * .26]); }
    seq.forEach(function (q, i) { var fr = Pp[q[0]], to = Pp[q[1]], dur = i < 3 ? .45 : .22; var k = pieThrow(K, 'pie' + (i % 4), fr, to, q[2], dur, CH[q[1]]);
      if (K.t > q[2] - .25 && K.t < q[2] + .1) { fr.armR = 2.4; fr.armRf = -.4 + s(K.t, q[2] - .25, q[2]) * 2; face(fr, to.x); }
      splat(K, to, CH[q[1]], 'hit' + i, q[2] + dur); });
    if (t > 2.65 && t < 3.0) { c.turn = -1.1; c.spin = (t - 2.65) * 10; }
    if (t > 5.9) { [a, b, c].forEach(function (p) { p.turn = 0; p.mouth = 'open'; p.chew = 1; p.eyes = Math.floor(t * 2) % 3 === 0 ? 'closed' : 'open'; }); }
  } };

  SC.whoopee = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var cu = K.cu || (K.cu = K.prop('cushion')); cu.vis = t > 1.1; pnode(cu, B + .1, .06, .2);
    if (t > .45 && t < 1.3) { mv(a, A, B - .1, t, .45, .9, 14); if (t > .9) { a.tilt = .6; a.armLf = a.armRf = 1.3; } }
    if (t >= 1.3) { var k = mv(a, B - .1, A - .45, t, 1.3, 1.8, 18); if (k >= 1) { a.turn = .7; a.sq = .78; a.armLf = a.armRf = 1.6; a.armL = a.armR = .8; a.mouth = 'grin'; a.eyes = 'happy'; } }
    if (t > 1.6 && t < 3.5) { mv(c, C, B + .1, t, 1.6, 2.1, 12); if (t > 2.1) { c.turn = 0; c.y = -BY * .7 * s(t, 2.1, 2.3); c.sq = t < 2.5 ? .8 : 1; c.eyes = 'wide'; c.mouth = 'o'; cu.sc(1, .3, 1); } }
    K.at(2.3, 'fart', function () { SFX('fart'); K.fx(B + .1, .15, .1, 14, { c: ['#B7E3A1', '#D9F2C7'], sp: 1.2, g: -.5, sz: .07, grow: 1.5, a: .6, life: .9 }); });
    if (t > 2.6 && t < 3.6) { face(b, a.x); b.armR = 1.6; b.armRf = 1.2; b.mouth = 'open'; b.eyes = 'happy'; c.brow = 1; c.mouth = 'flat'; face(c, a.x); }
    if (t >= 3.6) { var th = (t - 3.6) * 3.6; [a, c].forEach(function (p, i) { var q = th - i * .9, R0 = Math.min(1.25, K.hw - .4); p.x = K.mid + Math.cos(q) * R0; p.z = Math.sin(q) * .6; p.y = 0;
        var dx = -Math.sin(q), dz = Math.cos(q); p.turn = Math.atan2(dx, dz); gait(p, t, 24); p.seat = 0; p.sq = 1; p.tilt = .15; });
      a.eyes = 'wide'; a.mouth = 'open'; flail(a, t, 18); c.brow = 1; c.mouth = 'flat'; c.armLf = c.armRf = 1.3; laugh(b, t); b.x = B + .9; b.turn = 0; } } };

  SC.bucket = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var bk = K.bk || (K.bk = K.prop('bucket')); var ah = K.faceY(K.ca) + .25, bh = K.faceY(K.cb) + .2, ch = K.faceY(K.cc) + .22;
    if (t < 1.0) { var k = s(t, .45, 1.0); pnode(bk, A, L(5, ah, E.inn(k)), 0); bk.r = [PI, 0, 0]; bk.vis = k > 0; }
    else if (t < 2.0) { pnode(bk, a.x, ah + a.y, 0); a.lean = Math.sin(t * 7) * .25; a.armL = a.armR = 1.3; a.armLf = a.armRf = .8; a.x = A + Math.sin(t * 5) * .1; a.sq = t < 1.15 ? .7 : 1; }
    else if (t < 2.5) { var k2 = s(t, 2.0, 2.5); pnode(bk, L(a.x, B, k2), L(ah, bh, k2) + arc(k2, 1.2), 0); bk.r[2] = k2 * TAU; }
    else if (t < 3.2) { pnode(bk, b.x, bh, 0); bk.r = [PI, 0, 0]; b.lean = Math.sin(t * 8) * .25; b.armL = b.armR = 1.3; b.sq = t < 2.65 ? .7 : 1; }
    else if (t < 4.6) { var k3 = s(t, 3.2, 4.4); pnode(bk, L(B, C - .35, E.out(k3)), .2 + arc(s(t, 3.2, 3.6), .8), .25); bk.r = [0, 0, PI / 2 + k3 * 9]; }
    else if (t < 5.3) { var k4 = s(t, 4.6, 5.3); pnode(bk, L(C - .35, C, k4), L(.2, ch, k4) + arc(k4, 1.4), .1); bk.r = [PI * k4, 0, 0]; }
    else { pnode(bk, c.x, ch + c.y, 0); bk.r = [PI, 0, 0]; c.lean = Math.sin(t * 7) * .3; c.x = C + Math.sin(t * 4) * .15; c.sq = t < 5.45 ? .7 : 1; c.armL = c.armR = 1.3; laugh(a, t); laugh(b, t); }
    if (t > 3.3 && t < 5.3) laugh(c, t);
    K.sfx(1.0, 'clang'); K.sfx(2.5, 'clang'); K.sfx(5.3, 'clang'); } };

  SC.pokeWar = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, P = [a, b, c], sp = K.sp * .72;
    P.forEach(function (p, i) { if (t > .45) p.x = K.mid + (i - 1) * sp; });
    var pk = [[a, b, .8], [b, c, 1.4], [c, a, 2.0]];
    pk.forEach(function (q) { if (t > q[2] - .2 && t < q[2] + .25) { face(q[0], q[1].x); q[0].armRf = 1.5; q[0].armR = .6; } if (t > q[2] && t < q[2] + .15) { q[1].sq = .8; q[1].x += (q[1].x > q[0].x ? 1 : -1) * .1; } K.sfx(q[2], 'tap'); });
    if (t > 2.4 && t < 5.0) { P.forEach(function (p, i) { var w = (t - 2.4) * 6 + i; face(p, i === 1 ? a.x : b.x); p.armR = 1.2 + Math.sin(w) * 1.0; p.armL = 1.2 + Math.cos(w) * 1.0; p.armRf = p.armLf = 1.0;
      p.lean = Math.sin(w * .5) * .25; p.sq = 1 + Math.sin(w * 3) * .05; p.brow = 1; p.mouth = 'flat'; }); K.sfx(2.6, 'whoosh'); K.sfx(3.4, 'whoosh'); K.sfx(4.2, 'whoosh'); }
    if (t >= 5.0) P.forEach(function (p, i) { var k = s(t, 5.0 + i * .2, 5.5 + i * .2); p.lean = [1, -1, 1][i] * PI / 2 * E.bounce(k); p.turn = 0; if (k > .5) dizzy(p); });
    K.sfx(5.5, 'bonk'); } };

  SC.stickyGum = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var gm = K.gm || (K.gm = K.prop('gum')); pnode(gm, A + .3, .02, .15);
    var r1 = K.r1 || (K.r1 = K.prop('rope', '#FF7FB8')), r2 = K.r2 || (K.r2 = K.prop('rope', '#FF7FB8'));
    if (t > .45 && t < 2.1) { mv(a, A, A + .3, t, .5, .8, 10); if (t > .8) { a.eyes = 'wide'; a.look = [.5, 0]; a.mouth = 'o'; } mv(b, B, A + .75, t, 1.2, 1.6, 14); mv(c, C, A + 1.2, t, 1.5, 1.9, 14); }
    var la = A + .3, lb = A + .75, lc = A + 1.2;
    if (t >= 2.1 && t < 4.7) { var k = E.out(s(t, 2.1, 4.4)); a.x = la - k * 1.3; c.x = lc + k * 1.3; b.x = lb; b.z = -k * .7; [a, b, c].forEach(function (p, i) { gait(p, t * 1.4, 18, .9); p.brow = 1; p.mouth = 'flat'; p.lean = [.3, 0, -.3][i]; p.turn = [-1.1, PI, 1.1][i]; p.tilt = i === 1 ? .3 : 0; }); }
    if (t >= 4.7) { var e = E.el(s(t, 4.7, 5.4)); a.x = L(la - 1.3, lb - .35, e); c.x = L(lc + 1.3, lb + .35, e); b.x = lb; b.z = L(-.7, 0, e); b.y = t > 5.0 ? .85 * s(t, 5.0, 5.2) : 0; b.lean = .3; [a, b, c].forEach(function (p) { p.turn = 0; if (t > 5.3) dizzy(p); }); K.sfx(4.9, 'boing'); K.sfx(5.1, 'bonk'); }
    var g1 = t > .8; r1.vis = g1; r2.vis = t > 1.6;
    function link(r, p, q) { var x1 = p.x, y1 = p.y + .35, z1 = p.z, x2 = q.x, y2 = q.y + .35, z2 = q.z, dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || .01;
      r.at(x1, y1, z1); r.seg.sc(Math.max(.006, .03 / Math.sqrt(len + .2)), len, Math.max(.006, .03 / Math.sqrt(len + .2))); r.rot(Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * 0, 0, -Math.atan2(dx, dy)); }
    if (g1) link(r1, a, b); if (r2.vis) link(r2, b, c); } };

  SC.paintSwap = { d: 7.6, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var br = K.br || (K.br = K.hold(K.prop('brush'), K.ca, 'R', 0, 0, .05)), mr = K.mr || (K.mr = K.hold(K.prop('mirror'), K.cb, 'L', 0, 0, .05)); mr.vis = t > 2.9 && t < 3.8;
    if (t < 2.8) { b.eyes = 'open'; b.lid = .93; b.mouth = 'o'; b.sq = 1 + Math.sin(t * 2.5) * .04; b.lean = .15; if (Math.random() < .03) K.fx(B + .2, 1.2, .2, 1, { c: '#F3EEFF', sp: .3, g: -.6, sz: .04, life: 1.2 }); }
    if (t > .6 && t < 2.6) { mv(a, A, B - .45, t, .6, 1.4, 6); a.tilt = .2; a.mouth = 'grin'; if (t > 1.5 && t < 2.3) { a.turn = 1.0; a.armRf = 1.3 + Math.sin(t * 22) * .25; a.armR = .6; } }
    if (t >= 2.3) { b.stache = 1; mv(a, B - .45, A, t, 2.4, 2.9, 16); if (t > 2.9) laugh(a, t); }
    if (t > 2.8 && t < 3.8) { b.eyes = 'open'; b.lean = 0; b.armLf = 1.3; b.armL = .5; b.look = [0, -.3]; b.mouth = t > 3.2 ? 'o' : 'smile'; if (t > 3.3) { b.eyes = 'wide'; b.brow = 1; } }
    c.stache = 1; if (t < 5.0) { c.turn = PI; } else { c.turn = PI * (1 - E.io(s(t, 5.0, 5.6))); }
    if (t > 3.8 && t < 5.0) { mv(b, B, C - .4, t, 3.8, 4.3, 8); if (t > 4.3) { b.turn = 1.0; b.armLf = 1.2; b.mouth = 'grin'; K.hold(br, K.cb, 'R', 0, 0, .05); b.armRf = 1.3 + Math.sin(t * 20) * .2; } }
    if (t >= 5.0) { b.x = C - .4; b.turn = .4; b.eyes = 'wide'; b.lean = .2 * Math.sin(t * 3); b.mouth = 'o'; }
    if (t > 5.6) { var k = s(t, 5.6, 6.2); a.stache = k > .6 ? 1 : 0; [a, b, c].forEach(function (p) { if (t > 6.3) { p.turn = 0; p.armL = p.armR = -.3; p.armLf = p.armRf = 0; p.mouth = 'grin'; p.eyes = 'open'; p.sq = 1.04; } }); } } };

  SC.cakeFace = { d: 7.8, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var ck = K.ck || (K.ck = K.prop('cake')); pnode(ck, B, 0, .2);
    if (t > .5 && t < 2.4) { mv(a, A, B - .55, t, .5, 1.0, 12); if (t > 1.0) { a.turn = .9; a.tilt = .3 * s(t, 1.0, 1.4); a.mouth = 'o'; a.look = [.4, .3]; } mv(b, B, B - 1.0, t, .8, 1.6, 6); if (t > .8) { b.z = -.3; b.mouth = 'grin'; b.brow = 1; } }
    if (t > 1.9 && t < 2.5) { a.tilt = .9; a.x = B - .38; b.armLf = b.armRf = 1.4; b.x = B - .75; a.sq = .85; }
    K.at(2.0, 'faceplant', function () { SFX('splat'); K.fx(B - .2, .9, .3, 24, { c: ['#FFC2DA', '#FFFFFF'], sp: 2.4, sz: .05 }); });
    if (t >= 2.0) a.cream = 1;
    if (t >= 2.5 && t < 5.4) { a.x = B - .5; a.tilt = .9 * (1 - E.io(s(t, 2.5, 3.2))); b.z = -.3 * (1 - s(t, 2.5, 3)); b.x = L(B - .75, B - 1.35, s(t, 2.5, 3)); laugh(b, t);
      if (t > 3.2) { face(a, b.x); a.brow = 1; a.mouth = 'flat'; }
      var sl = K.sl || (K.sl = K.prop('slice')); var k = s(t, 3.6, 4.0); sl.vis = t > 3.3 && k < 1; if (t < 3.6) { K.hold(sl, K.ca, 'R', 0, .05, .05); a.armR = 1.0; } else { if (sl.parent !== K.st.props) K.hold(sl, K.st, 'world'); pnode(sl, L(a.x, b.x, k), L(1, K.faceY(K.cb), k) + arc(k, .4), .3); sl.r[2] = k * 8; }
      if (t > 3.45 && t < 3.65) { a.armR = 2.6; a.armRf = .6; }
      if (t >= 4.0) { b.cream = 1; b.eyes = 'closed'; b.mouth = 'o'; } }
    K.at(4.0, 'hb', function () { SFX('splat'); K.fx(b.x, 1.0, .3, 16, { c: ['#FFC2DA', '#FFFFFF'], sp: 2.2, sz: .05 }); });
    if (t > 4.1 && t < 5.1) laugh(c, t);
    if (t >= 5.1) { [a, b].forEach(function (p) { p.turn = PI * .0 + 1.0 * E.io(s(t, 5.1, 5.5)); p.brow = 1; p.mouth = 'grin'; }); a.x = B - .5; b.x = B - 1.35;
      [['s1', a, 5.6], ['s2', b, 5.75]].forEach(function (q) { var sl = K[q[0]] || (K[q[0]] = K.prop('slice')), k = s(t, q[2], q[2] + .4); sl.vis = k > 0 && k < 1; pnode(sl, L(q[1].x, c.x, k), L(1, K.faceY(K.cc), k) + arc(k, .5), .3); sl.r[2] = k * 9; if (t > q[2] - .2 && t < q[2]) { q[1].armR = 2.6; } });
      if (t > 6.15) { c.cream = 1; c.eyes = 'closed'; c.sq = t < 6.3 ? .8 : 1; } }
    K.at(6.15, 'hc', function () { SFX('splat'); K.fx(c.x, 1.0, .3, 18, { c: ['#FFC2DA', '#FFFFFF'], sp: 2.2, sz: .05 }); });
    if (t > 6.6) { [a, b, c].forEach(function (p) { p.turn = 0; p.mouth = 'open'; p.chew = 1; p.eyes = 'happy'; p.armL = p.armR = .4; }); if (Math.random() < .2) K.fx(K.mid + rnd(-1, 1), 1.6, .3, 1, { c: '#FF7FB8', sp: .5, g: -1.2, sz: .05, life: 1 }); }
    if (t < 2.0) { c.turn = -.5; c.look = [.3, -.3]; } } };

  /* ---------- CHAOS & PHYSICS ---------- */
  SC.domino = { d: 6.8, f: function (t, K) { var a = K.a, b = K.b, c = K.c, P = [a, b, c], sp = .55;
    P.forEach(function (p, i) { if (t > .45) p.x = K.mid + (i - 1) * sp; });
    if (t > .9 && t < 1.05) { a.legL = -.8; a.tilt = .2; }
    var lt = [1.0, 1.25, 1.5]; P.forEach(function (p, i) { var k = s(t, lt[i], lt[i] + .3); if (t < 2.2) p.lean = -(i < 2 ? .85 : PI / 2) * E.inn(k); if (k > 0 && t < 2.2) { p.eyes = 'wide'; p.mouth = 'o'; } });
    K.sfx(1.25, 'tap'); K.sfx(1.5, 'tap'); K.sfx(1.8, 'bonk');
    if (t >= 2.2) { var k = s(t, 2.2, 3.4), x = L(K.mid + sp + .4, K.mid - sp - 1.6, k); c.x = x; c.lean = (1 - k) * 0 + k * 8; c.sq = .82; c.y = .1; c.armL = c.armR = 2.2; c.eyes = 'happy';
      [[b, K.mid, .25], [a, K.mid - sp, .3]].forEach(function (q) { if (x < q[1] + .3) { var j = s(t, 2.2 + (K.mid + sp + .4 - q[1] - .3) / (sp * 2 + 2) * 1.2, 3.3); q[0].y = arc(Math.min(1, j * 1.6), 1.2); q[0].lean = j * 4; q[0].eyes = 'wide'; } else q[0].lean = -.85; }); }
    if (t >= 3.4) { a.lean = PI / 2; a.y = 0; b.lean = -PI / 2; b.y = 0; c.lean = PI / 2; c.y = 0; P.forEach(function (p) { dizzy(p); p.sq = 1; }); c.x = K.mid - sp - 1.0; K.sfx(3.5, 'bell'); K.sfx(4.1, 'bell'); K.sfx(4.7, 'bell'); } } };

  SC.seesaw = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var ss = K.ss || (K.ss = K.prop('seesaw')); pnode(ss, M0, 0, .1);
    var ang = .22; if (t > 1.4) ang = L(.22, -.22, E.out(s(t, 1.4, 1.55))); if (t > 1.9) ang = -.22 + Math.sin((t - 1.9) * 12) * .15 * (1 - s(t, 1.9, 2.8));
    ss.plank.r[2] = ang;
    function endY(x) { return .35 + Math.tan(ang) * (x - M0) * -1 * -1; }
    if (t < 1.55) { b.x = M0 - 1.1; b.y = .35 + Math.sin(ang) * 1.1; b.turn = .3; c.x = M0 + .7; c.y = .35 - Math.sin(ang) * .7; c.turn = -.3; c.mouth = 'grin'; }
    if (t < 1.4) { var k = s(t, .5, 1.4); a.x = M0 + 1.15; a.y = L(4.5, .35 - Math.sin(ang) * 1.15, E.inn(k)); a.armL = a.armR = 2.4; a.eyes = 'wide'; if (k <= 0) a.y = 4.5; }
    else { a.x = M0 + 1.15; a.y = .35 - Math.sin(ang) * 1.15; a.sq = t < 1.6 ? .65 : 1; a.mouth = 'grin'; }
    K.sfx(1.4, 'boing');
    if (t >= 1.55) { var kb = s(t, 1.55, 3.3); b.x = L(M0 - 1.1, M0 + .9, kb); b.y = L(.35 + Math.sin(-.22) * 1.1, 1.85, kb) + arc(kb, 3.2); b.tilt = kb * TAU; b.eyes = 'wide'; b.mouth = 'open';
      var kc = s(t, 1.9, 3.45); c.x = L(M0 + .7, M0 + .7, kc); c.y = L(.2, 1.85 + .95, kc) + arc(kc, 2.4); c.lean = kc * -TAU * .5; c.eyes = 'wide'; c.mouth = 'open';
      if (t > 2.3 && t < 2.9) { b.armR = c.armL = 2.6 + Math.sin(t * 20) * .3; b.mouth = c.mouth = 'grin'; b.eyes = c.eyes = 'happy'; }
      if (kb >= 1) { b.x = M0 + 1.0; b.y = .35 - Math.sin(ang) * 1.15 + 1.48; b.tilt = 0; b.lean = .4; } if (kc >= 1) { c.x = M0 + 1.1; c.y = b.y + 1.0; c.lean = -.3; }
      if (t > 3.5) { [a, b, c].forEach(function (p) { dizzy(p); }); a.sq = .8; } }
    K.sfx(3.3, 'bonk'); K.sfx(3.45, 'bonk'); } };

  SC.bananaRelay = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    var pl = K.pl || (K.pl = K.prop('peel')); var px = A + .3, py = .03;
    if (t < 1.0) { mv(a, A - .3, A + .3, t, .5, 1.0, 14); }
    if (t >= 1.0 && t < 2.2) { var k = s(t, 1.0, 1.6); a.x = A + .3; a.y = arc(k, .7); a.lean = PI / 2 * E.out(k); a.legL = -1.2; a.legR = -1.6; a.eyes = 'wide'; a.mouth = 'o'; flail(a, t); if (k >= 1) { a.legL = a.legR = 0; dizzy(a); } var k2 = s(t, 1.15, 1.9); px = L(A + .3, B + .1, k2); py = .03 + arc(k2, 1.0); pl.r[1] = k2 * 10; }
    if (t >= 2.2) { a.x = A + .3; a.lean = PI / 2; dizzy(a); px = B + .1; }
    if (t >= 2.0 && t < 3.8) { if (t < 2.4) mv(b, B - .3, B + .1, t, 2.0, 2.4, 14); else { var k3 = s(t, 2.4, 3.6); b.x = L(B + .1, C + 1.3, E.out(k3)); px = b.x; b.legL = -.9; b.legR = .9; b.armL = b.armR = 2.0 + Math.sin(t * 24) * .4; b.lean = Math.sin(t * 9) * .3; b.eyes = 'wide'; b.mouth = 'o'; b.turn = 1.1; if (k3 >= 1) { b.lean = -PI / 2; dizzy(b); } } }
    if (t >= 3.8) { b.x = C + 1.3; b.lean = -PI / 2; dizzy(b); }
    K.sfx(1.0, 'squeak'); K.sfx(2.4, 'whoosh'); K.sfx(3.6, 'bonk');
    if (t >= 3.6) { mv(c, C, C + .9, t, 3.6, 4.0, 14); if (t >= 3.9 && t < 4.3) { c.tilt = .6; c.armLf = c.armRf = 1.4; px = c.x + .2; py = .3 * s(t, 4.0, 4.3); }
      if (t >= 4.3 && t < 5.2) { laugh(c, t); var k4 = s(t, 4.6, 5.2); px = L(c.x + .2, c.x + .05, k4); py = .3 + arc(k4, 1.5) - .27 * k4; if (t > 4.5) c.armR = 2.5; }
      if (t >= 5.2) { var k5 = s(t, 5.2, 5.7); c.y = arc(k5, .6); c.lean = -PI / 2 * E.out(k5); c.legL = -1.3; c.eyes = 'wide'; if (k5 >= 1) { dizzy(c); c.legL = 0; }
        var k6 = s(t, 5.4, 7.0); px = L(c.x + .4, c.x - .2, k6) + Math.sin(t * 5) * .25 * (1 - k6); py = L(2.5, .55, k6); pl.r[2] = Math.sin(t * 6) * .6; } }
    K.sfx(5.2, 'squeak'); pnode(pl, px, py, .2); } };

  SC.magnet = { d: 6.8, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var mg = K.mg || (K.mg = K.hold(K.prop('magnet'), K.cc, 'R', 0, .1, .05)); c.x = M0; c.z = -.65; c.turn = 0;
    if (t > .45) { a.x = M0 - K.sp - .2; b.x = M0 + K.sp + .2; }
    if (t < 4.0) { c.armR = 2.2; c.armRf = .6; c.mouth = 'grin'; c.brow = 1; }
    if (t > 1.0 && t < 1.6) { var k = E.inn(s(t, 1.0, 1.6)); a.x = L(M0 - K.sp - .2, M0 - .33, k); b.x = L(M0 + K.sp + .2, M0 + .33, k); a.lean = -.4; b.lean = .4; a.legL = a.legR = .5; b.legL = b.legR = .5; a.eyes = b.eyes = 'wide'; a.mouth = b.mouth = 'o'; a.turn = 1.1; b.turn = -1.1; if (Math.random() < .5) K.fx(M0, 1.2, -.4, 1, { c: '#C6FF3D', sp: 1, g: 0, sz: .03, e: 1, life: .4 }); }
    K.at(1.6, 'clang', function () { SFX('clang'); K.fx(M0, .9, .2, 14, { c: ['#FFD84D', '#FFFFFF'], sp: 2.5, sz: .03, e: 1 }); });
    if (t >= 1.6 && t < 4.4) { a.x = M0 - .33; b.x = M0 + .33; a.turn = 1.1; b.turn = -1.1; a.sq = b.sq = t < 1.75 ? .75 : 1; a.brow = b.brow = 1; a.mouth = b.mouth = 'flat';
      if (t > 1.9) { var w = t * 16; a.armR = 1.4 + Math.sin(w) * .6; a.armRf = 1.1; b.armL = 1.4 + Math.cos(w) * .6; b.armLf = 1.1; a.lean = Math.sin(t * 5) * .1; b.lean = -a.lean; if (Math.floor(t * 4) % 2) { K.sfx(Math.floor(t * 4) / 4, 'tap'); } } }
    if (t >= 4.0) { K.hold(mg, K.cc, 'top', 0, .05, 0); mg.r = [0, 0, 0]; c.armR = c.armL = 2.6 * (1 - s(t, 4.5, 4.8)); c.mouth = 'grin'; c.eyes = 'happy'; }
    if (t >= 4.5) { var k2 = s(t, 4.5, 5.0), hy = K.faceY(K.cc) + .6; a.x = L(M0 - .33, M0 - .42, k2); a.y = L(0, hy - .3, E.inn(k2)); a.z = L(0, -.65, k2); a.lean = -1.0 * k2; b.x = L(M0 + .33, M0 + .42, k2); b.y = L(0, hy - .4, E.inn(k2)); b.z = L(0, -.65, k2); b.lean = 1.0 * k2;
      if (k2 >= 1) { a.eyes = b.eyes = 'x'; c.eyes = 'wide'; c.mouth = 'o'; c.sq = t < 5.15 ? .8 : 1; c.lean = Math.sin(t * 6) * .12; } }
    K.sfx(5.0, 'clang'); } };

  SC.springBoots = { d: 6.6, f: function (t, K) { var P = [K.a, K.b, K.c], CH = [K.ca, K.cb, K.cc];
    K.spr = K.spr || CH.map(function (ch) { return [K.hold(K.prop('springs'), ch, 'world'), K.hold(K.prop('springs'), ch, 'world')]; });
    var ceil = 2.55, bar = K.bar || (K.bar = K.prop('bar')); pnode(bar, K.mid, ceil + .03, -.2);
    P.forEach(function (p, i) { var H = CH[i].H, peak = ceil - H - .02, rate = L(1.6, 4.2, s(t, .6, 4.6)), ph = ((t - .5) * rate + i * .33) % 1, y = arc(ph, peak);
      if (t < .5) y = 0; p.y = y + .14; p.sq = ph < .08 || ph > .92 ? .78 : (Math.abs(ph - .5) < .05 ? .85 : 1.04); p.armL = p.armR = 1.2 + y * .4;
      if (Math.abs(ph - .5) < .03 && t > .6) K.at(0, 'bk' + i + Math.floor((t - .5) * rate), function () { SFX('bonk'); });
      if (t > 4.6) { p.x = K.mid + Math.sin(t * 6.3 + i * 2) * Math.min(K.hw - .5, 1.8); p.spin = t * 9 * (i % 2 ? 1 : -1); p.eyes = 'wide'; p.mouth = 'open'; }
      if (t > 6.0) { p.y = 0; p.sq = t < 6.12 ? .6 : 1; p.spin = 0; dizzy(p); }
      K.spr[i][0].at(p.x - CH[i].S.hip, p.y - .1, p.z + .04); K.spr[i][1].at(p.x + CH[i].S.hip, p.y - .1, p.z + .04); }); } };

  SC.balloonLift = { d: 7.6, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    K.bl = K.bl || ['#FF4F9A', '#4FC3FF', '#C6FF3D'].map(function (col) { return K.prop('balloon', col); });
    if (t > .5 && t < 1.7) { mv(a, A, B - .45, t, .5, .9, 14); if (t > .9) { a.turn = 1.0; a.armLf = a.armRf = 1.3 + Math.sin(t * 16) * .2; } }
    var by = 0; if (t > 1.8 && t < 3.4) { by = E.io(s(t, 1.8, 3.0)) * 2.2; b.y = by; b.legL = Math.sin(t * 10) * .5; b.legR = -b.legL; b.mouth = 'grin'; b.eyes = 'happy'; b.armL = b.armR = 2.4; b.x = B + Math.sin(t * 2) * .15; }
    if (t > 1.7 && t < 3.4) { a.x = L(B - .45, A, s(t, 1.7, 2.1)); a.turn = 0; a.armR = 2.3; a.mouth = 'grin'; }
    var cHas = t > 4.4;
    K.bl.forEach(function (bl, i) { bl.vis = !(i === 0 && t > 3.4) && t > .9; var host = cHas && i > 0 ? c : b; pnode(bl, host.x + (i - 1) * .18, host.y + (host === c ? K.cc.H : K.cb.H) - .15, -.1 * i); bl.r[2] = (i - 1) * .25 + Math.sin(t * 2 + i) * .08; });
    if (t > 2.9 && t < 3.5) { var pn = K.pn || (K.pn = K.hold(K.prop('pin'), K.cc, 'R', 0, 0, .05)); pn.vis = true; mv(c, C, B + .55, t, 2.9, 3.3, 14); c.armR = 2.4; c.armRf = .6; c.mouth = 'grin'; }
    K.at(3.4, 'pop', function () { SFX('pop'); K.fx(B - .18, 2.2 + K.cb.H, 0, 16, { c: '#FF4F9A', sp: 2.4, sz: .04 }); });
    if (t >= 3.4 && t < 4.4) { var k = s(t, 3.4, 3.8); b.x = B; b.y = L(2.2, K.ca.H, E.inn(k)); a.x = B; a.turn = 0; if (k >= 1) { a.sq = t < 3.95 ? .62 : .9; b.y = K.ca.H + arc(s(t, 3.8, 4.4), .9) * (1 - s(t, 3.8, 4.4)) ; a.eyes = 'x'; } b.eyes = 'wide'; b.mouth = 'o'; c.x = B + .55; }
    K.sfx(3.8, 'bonk');
    if (t >= 4.4) { b.x = L(B, B - 1.0, s(t, 4.4, 4.8)); b.y = arc(s(t, 4.4, 4.8), .5); if (t > 4.8) { b.lean = PI / 2; dizzy(b); } a.x = B; dizzy(a);
      var k2 = s(t, 4.5, 7.4); c.x = B + .55; c.y = E.inn(k2) * 6; c.armR = 2.6 + Math.sin(t * 14) * .35; c.mouth = 'open'; c.eyes = 'wide'; c.legL = Math.sin(t * 9) * .5; c.legR = -c.legL; c.turn = 0; } } };

  SC.zoomies = { d: 5.6, form: false, f: function (t, K) { var P = [K.a, K.b, K.c], CH = [K.ca, K.cb, K.cc];
    if (!K.path) { K.path = P.map(function (p, i) { var pts = [K.home(CH[i])]; for (var j = 0; j < 7; j++) pts.push(clamp(rnd(-K.hw + .5, K.hw - .5), -2.6, 2.6)); return pts; }); K.zp = P.map(function () { return [0].concat([1, 2, 3, 4, 5, 6, 7].map(function () { return rnd(-.6, .5); })); }); }
    P.forEach(function (p, i) { var seg = Math.min(6.99, t / .7), j = Math.floor(seg), k = E.io(seg - j), pts = K.path[i], zs = K.zp[i];
      p.x = L(pts[j], pts[j + 1], k); p.z = L(zs[j], zs[j + 1], k); var dx = pts[j + 1] - pts[j], dz = zs[j + 1] - zs[j]; p.turn = Math.atan2(dx, dz); gait(p, t, 34, 1); p.tilt = .3; flail(p, t, 34); p.mouth = 'open'; p.eyes = 'wide';
      if (t > 4.9) { var f = s(t, 4.9, 5.6); p.x = L(p.x, K.home(CH[i]), f); p.z *= 1 - f; p.turn *= 1 - f; } });
    for (var i = 0; i < 3; i++) for (var j = i + 1; j < 3; j++) if (Math.abs(P[i].x - P[j].x) < .3 && Math.abs(P[i].z - P[j].z) < .3 && t < 4.9) { K.at(0, 'hit' + i + j + Math.floor(t * 4), function () { SFX('bonk'); });
      P[i].sq = P[j].sq = .7; P[i].eyes = P[j].eyes = 'x'; P[i].y += .2; P[j].y += .2; } } };

  /* ---------- TEAMWORK THAT FAILS ---------- */
  SC.humanLadder = { d: 7.8, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid, Ha = K.ca.H, Hb = K.cb.H;
    var sh = K.sh || (K.sh = K.prop('shelf')), jar = K.jar || (K.jar = K.prop('jar')); var shY = Ha + Hb + K.cc.H + .25; pnode(sh, M0 + .35, shY, -.25);
    if (t > .45) { a.x = M0; a.turn = 0; }
    var kb = s(t, .7, 1.3), kc = s(t, 1.4, 2.1);
    b.x = L(K.B + K.sp * 0, M0, kb); b.y = L(0, Ha - .1, kb) + arc(kb, .6); if (kb >= 1) { b.x = M0; b.y = Ha - .1; } if (t < .7) b.x = M0 - .6;
    c.x = L(M0 + .7, M0, kc); c.y = L(0, Ha + Hb - .18, kc) + arc(kc, .7); if (kc >= 1) { c.x = M0; c.y = Ha + Hb - .18; } if (t < 1.4) c.x = M0 + .7;
    if (t > 1.3) { a.sq = .9; a.brow = 1; a.mouth = 'flat'; a.armL = a.armR = 2.3; }
    var wob = t > 2.4 ? Math.sin((t - 2.4) * 7) * .14 * s(t, 2.4, 4.0) : 0;
    if (t > 2.1 && t < 4.0) { c.armR = 2.9; c.mouth = 'o'; c.look = [-.5, .3]; [a, b, c].forEach(function (p, i) { p.lean = wob * (i + 1); p.x = M0 - Math.sin(wob * (i + 1)) * p.y * .6; }); }
    var jy = shY + .03, jx = M0 + .35;
    if (t >= 4.0 && t < 5.4) { var f = E.inn(s(t, 4.0, 5.3)), ang = f * 1.4; [a, b, c].forEach(function (p, i) { var h = [0, Ha, Ha + Hb][i]; p.x = M0 + Math.sin(ang) * h + i * f * .5; p.y = Math.cos(ang) * h * (1 - f * .3); p.lean = -ang - i * f * .5; p.eyes = 'wide'; p.mouth = 'open'; });
      var kj = s(t, 4.4, 5.5); jx = L(M0 + .35, M0 + 1.2, kj); jy = L(shY + .03, K.cc.H + .02, E.inn(kj)) + arc(kj, .3); jar.r[2] = kj * 4; }
    if (t >= 5.4) { a.lean = -PI / 2; a.x = M0 + .05; b.lean = -PI / 2; b.x = M0 + .4; b.y = 0; c.x = M0 + 1.2; c.y = 0; c.lean = 0; c.turn = 0; dizzy(a); dizzy(b);
      if (t >= 5.5) { jx = c.x; jy = K.cc.H; jar.r[2] = 0; c.sq = t < 5.65 ? .8 : 1; c.armR = 1.0 + Math.abs(Math.sin(t * 5)) * 1.2; c.armRf = 1.2; c.mouth = 'open'; c.chew = 1; c.eyes = 'happy'; } }
    pnode(jar, jx, jy, -.15); K.sfx(5.5, 'clang');
    if (t > 5.8 && Math.random() < .2) K.fx(c.x, K.faceY(K.cc) - .1, .4, 1, { c: '#B8814A', sp: .8, sz: .02, life: .6 }); } };

  SC.piggyback = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, edge = K.hw - .35, x0 = K.mid - .3, Ha = K.ca.H;
    var k = s(t, .5, 2.6), x = L(x0, edge + .4, E.io(k));
    if (t >= .45 && t < 4.6) { a.x = x; b.x = x - .05; b.y = Ha * .72; b.z = -.15; c.x = x - .1; c.y = Ha * .72 + K.cb.H * .78; c.z = -.25; a.turn = b.turn = c.turn = 1.1;
      if (k < 1) gait(a, t, 14); else if (t < 3.1) gait(a, t, 14); a.brow = 1; a.mouth = 'flat'; b.seat = c.seat = .7; b.armLf = b.armRf = 1.3; c.armLf = c.armRf = 1.3; b.mouth = c.mouth = 'grin'; b.legL = b.legR = c.legL = c.legR = -.8; }
    if (t > 3.1 && t < 4.6) { [a, b, c].forEach(function (p) { p.look = [.55, 0]; p.turn = t > 3.8 ? 0 : 1.1; p.eyes = 'wide'; p.mouth = t > 3.8 ? 'o' : 'flat'; p.sq = t > 4.0 && t < 4.15 ? 1.08 : p.sq; }); }
    if (t >= 4.6) K.clip(true);
    if (t >= 4.6 && t < 5.6) { var f = E.inn(s(t, 4.6, 5.4)); [a, b, c].forEach(function (p, i) { p.x = x - i * .05; p.y = [0, Ha * .72, Ha * .72 + K.cb.H * .78][i] - f * 9; p.armL = p.armR = 2.6; p.eyes = 'wide'; }); }
    K.sfx(5.5, 'tap');
    if (t >= 5.6) { [K.ca, K.cb, K.cc].forEach(function (ch, i) { var P = ch.P, k2 = s(t, 5.6 + i * .15, 6.6 + i * .15); P.x = K.home(ch); P.y = -1.6 * (1 - E.out(k2)); P.z = .25; var w = Math.sin(t * 14); P.armL = 2.6 + w * .4; P.armR = 2.6 - w * .4; P.brow = 1; P.mouth = 'flat'; P.hide = k2 <= 0 ? 1 : 0; }); } } };

  SC.tugOfWar = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var r1 = K.r1 || (K.r1 = K.prop('rope')), r2 = K.r2 || (K.r2 = K.prop('rope')), jb = K.jb || (K.jb = K.hold(K.prop('juice'), K.cc, 'R', 0, .06, .05));
    var ry = .55, ax = M0 - 1.05, bx = M0 + 1.05;
    if (t > .45 && t < 3.2) { var j = Math.sin(t * 13) * .03; a.x = ax + j; b.x = bx + j; a.turn = 1.1; b.turn = -1.1; a.lean = .45; b.lean = -.45; a.legL = .4; a.legR = -.6; b.legL = -.4; b.legR = .6; a.armLf = a.armRf = 1.4; b.armLf = b.armRf = 1.4; a.brow = b.brow = 1; a.mouth = b.mouth = 'flat'; a.sq = b.sq = .95 + Math.sin(t * 20) * .02;
      c.x = M0; c.y = ry - .1; c.seat = 1; c.turn = 0; c.mouth = 'smile'; if (t > 1.5) { c.armR = .4; c.armRf = 1.9; c.mouth = 'o'; c.eyes = 'closed'; } }
    function seg(r, x1, x2, y) { r.at(x1, y, .05); r.seg.sc(.025, Math.abs(x2 - x1), .025); r.rot(0, 0, x2 > x1 ? -PI / 2 : PI / 2); }
    if (t < 3.2) { r2.vis = false; r1.vis = t > .45; seg(r1, a.x + .3, b.x - .3, ry); }
    K.at(3.2, 'snap', function () { SFX('tear'); });
    if (t >= 3.2) { var k = s(t, 3.2, 4.4); a.x = L(ax, ax - 3.2, E.out(k)); a.y = arc(k, 1.0); a.lean = k * 6; b.x = L(bx, bx + 3.2, E.out(k)); b.y = arc(k, 1.0); b.lean = -k * 6; a.eyes = b.eyes = 'wide';
      r1.vis = r2.vis = k < .5; seg(r1, a.x + .3, M0 - .05, ry - k * .3); seg(r2, M0 + .05, b.x - .3, ry - k * .3);
      c.x = M0; c.seat = 1; c.y = t < 4.9 ? ry - .1 : (ry - .1) * (1 - E.inn(s(t, 4.9, 5.2))); c.armR = .4; c.armRf = 1.9; c.mouth = 'o'; c.eyes = t > 4.3 ? 'wide' : 'closed'; if (t > 4.3 && t < 4.9) { c.look = [.5, 0]; c.armRf = .4; }
      if (t > 5.2) { c.seat = 0; c.y = 0; c.sq = t < 5.35 ? .6 : 1; dizzy(c); } }
    K.sfx(1.6, 'slurp'); K.sfx(3.8, 'slurp'); K.sfx(5.2, 'bonk'); } };

  SC.fakeLift = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var cp = K.cp || (K.cp = K.prop('carpet')); var cpx = M0 - .6;
    if (t > .45) { c.x = M0 + .9; a.x = M0 - .95; b.x = M0 - .25; }
    if (t < 3.0) { c.lean = -PI / 2 * (1 - E.out(s(t, .6, 1.4)) * .7); if (t > 1.6) c.lean = -PI / 2 * E.bounce(s(t, 1.6, 2.0)); [a, b].forEach(function (p, i) { face(p, c.x); p.armLf = p.armRf = 1.0 + (t > .6 && t < 1.6 ? .4 : 0); if (t > 1.7) laugh(p, t); }); if (t > 1.9) { c.eyes = 'x'; } }
    K.sfx(1.95, 'bonk');
    if (t >= 3.0 && t < 4.4) { c.lean = -PI / 2 * (1 - E.io(s(t, 3.0, 3.8))); c.brow = 1; c.mouth = 'flat'; if (t > 3.8) { c.turn = -1.0; c.tilt = .5; c.armLf = c.armRf = 1.5; } [a, b].forEach(function (p) { p.turn = .6; laugh(p, t); }); }
    if (t >= 4.4) { var k = s(t, 4.4, 4.7); cpx = L(M0 - .6, M0 + 3.6, E.inn(k)); c.lean = 0; c.tilt = -.3 * (1 - s(t, 4.7, 5.1)); c.armLf = c.armRf = 1.5 * (1 - k); c.turn = 0;
      [a, b].forEach(function (p, i) { var j = s(t, 4.45 + i * .05, 5.3); p.y = arc(j, 1.4 - i * .3); p.lean = j * 5 * (i ? -1 : 1); p.eyes = 'wide'; p.mouth = 'open'; p.x = L(p.x, M0 - .55, j);
        if (j >= 1) { p.y = i ? .5 : 0; p.lean = i ? -.9 : PI / 2; dizzy(p); } });
      if (t > 5.4) { c.mouth = 'grin'; c.brow = 0; c.armL = c.armR = .6 + Math.abs(Math.sin(t * 12)) * .3; c.armLf = c.armRf = .8; } }
    K.sfx(4.4, 'whoosh'); K.sfx(5.3, 'bonk'); pnode(cp, cpx, 0, .05); } };

  SC.trenchcoat = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid, Ha = K.ca.H, Hb = K.cb.H;
    var co = K.co || (K.co = K.prop('coat')), ht = K.ht || (K.ht = K.prop('hat')), ct = K.ct || (K.ct = K.prop('counter'));
    pnode(ct, M0 + 1.25, 0, -.1);
    var x = L(M0 - 1.0, M0 + .3, E.io(s(t, .6, 2.4))), sway = Math.sin(t * 9) * .04 * (t < 2.4 ? 1 : 0) + (t > 3.8 && t < 4.5 ? Math.sin(t * 20) * .08 : 0);
    if (t < 4.5) { a.x = x; b.x = x; b.y = Ha * .8; c.x = x; c.y = Ha * .8 + Hb * .8; a.z = b.z = c.z = 0; [a, b, c].forEach(function (p) { p.lean = sway; p.turn = .5; }); a.hide = 1; b.hide = 1; co.vis = true; pnode(co, x, 0, 0); co.r[2] = sway;
      if (t > .6 && t < 2.4) gait(a, t, 12); c.mouth = t > 2.6 && t < 3.8 ? (Math.floor(t * 8) % 2 ? 'open' : 'flat') : 'smile'; c.brow = -1;
      pnode(ht, x, c.y + K.cc.H - .03, 0); ht.r[2] = sway; }
    K.at(4.5, 'rip', function () { SFX('tear'); SFX('pop'); K.fx(x, 1.3, .2, 26, { c: ['#8B5A3C', '#7A4E33'], sp: 3, sz: .07, life: .8 }); });
    if (t >= 4.5) { co.vis = false; var k = s(t, 4.5, 5.2); a.hide = b.hide = 0;
      a.x = L(x, x - 1.1, k); a.y = arc(k, .9); b.x = L(x, x + 1.2, k); b.y = L(Ha * .8, 0, k) + arc(k, .9); c.x = x; c.y = L(Ha * .8 + Hb * .8, 0, E.inn(k));
      [a, b, c].forEach(function (p) { p.turn = 0; p.eyes = 'wide'; p.mouth = 'o'; if (k >= 1 && t > 5.7) { p.eyes = 'open'; p.mouth = 'smile'; p.armL = p.armR = 1.0; p.armLf = p.armRf = -.2; } });
      var kh = s(t, 4.5, 5.8); pnode(ht, L(x, c.x, kh) + Math.sin(t * 6) * .2 * (1 - kh), L(c.y + K.cc.H + .3, K.cc.H - .03, kh) + arc(kh, .8), 0); ht.r[2] = Math.sin(t * 6) * .4 * (1 - kh); } } };

  /* ---------- SILLY CONTESTS ---------- */
  SC.rps = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    if (t > .45) { a.x = M0 - .56; c.x = M0 + .56; b.x = M0 + .05; b.z = -.75; }
    face(a, c.x); face(c, a.x); b.turn = 0;
    var rounds = [.6, 2.0, 3.4], str = [.25, .5, 1];
    rounds.forEach(function (r, i) {
      if (t > r && t < r + .9) { var bob = Math.abs(Math.sin((t - r) * 10)); a.armRf = c.armLf = 1.0 + bob * .5; a.armR = c.armL = .3; a.mouth = c.mouth = 'flat'; a.brow = c.brow = 1; }
      if (t > r + .9 && t < r + 1.3) { a.armRf = 1.5; a.mouth = 'grin'; c.eyes = 'wide'; }
      if (t > r + 1.2 && t < r + 1.4 && i < 2) { c.lean = -str[i]; c.y = .05; K.sfx(r + 1.2, 'tap'); } });
    if (t > 4.6 && t < 4.75) { a.armRf = 1.6; a.armR = .9; }
    if (t >= 4.75) { var k = s(t, 4.75, 5.8); c.x = L(M0 + .42, M0 + K.hw + 2.4, E.out(k)); c.y = arc(k, 2.4); c.lean = -k * 12; c.eyes = 'wide'; c.mouth = 'open'; K.sfx(4.75, 'whoosh'); K.sfx(5.6, 'clang');
      b.armL = b.armR = 2.6; b.armLf = b.armRf = 1.0; b.eyes = 'closed'; b.mouth = 'o'; a.turn = 0; a.mouth = 'o'; a.eyes = 'wide'; if (t > 6.0) { a.armL = .4; a.armLf = 1.0; a.mouth = 'flat'; } }
    if (t >= 5.8) c.hide = 1; } };

  SC.staring = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var k = E.io(s(t, .6, 3.0)); if (t > .45) { a.x = L(M0 - .8, M0 - .4, k); b.x = L(M0 + .8, M0 + .4, k); c.x = M0 + .1; c.z = -.75; }
    a.turn = 1.15; b.turn = -1.15; a.tilt = b.tilt = .25 * k; a.eyes = b.eyes = 'wide'; a.brow = b.brow = 1;
    var mm = ['flat', 'o', 'frown', 'grin']; a.mouth = mm[Math.floor(t * 2.2) % 4]; b.mouth = mm[(Math.floor(t * 2.2) + 2) % 4]; a.sq = 1 + Math.sin(t * 5) * .06; b.sq = 1 - Math.sin(t * 5) * .06; b.cross = t > 2.2;
    c.turn = Math.sin(t * 3) * .5; c.look = [0, Math.sin(t * 3) * .5]; c.mouth = 'o';
    if (t > 2.9 && t < 3.5) { b.sq = 1.15; b.tilt = -.35; b.mouth = 'o'; b.eyes = 'closed'; }
    K.at(3.5, 'ach', function () { SFX('sneeze'); K.fx(b.x - .3, K.faceY(K.cb), .2, 26, { c: ['#E6F6FF', '#FFFFFF'], sp: 4, ang: PI, spread: .5, g: 0, sz: .04, life: .6, a: .8 }); });
    if (t >= 3.5) { var f = s(t, 3.5, 4.3); a.x = L(M0 - .4, M0 - 1.8, E.out(f)); a.lean = .6 * f + Math.sin(t * 40) * .05 * (1 - f); a.sq = 1 + Math.sin(t * 50) * .08 * (1 - f); a.mouth = 'open'; b.tilt = .3 * (1 - f); b.x = M0 + .4 + f * .2; b.mouth = 'grin'; b.eyes = 'open'; b.cross = false;
      c.x = L(M0 + .1, M0 - 1.0, E.out(s(t, 3.6, 4.4))); c.lean = .4 * s(t, 3.6, 4.4); c.eyes = 'wide';
      if (t > 4.4) { a.lean = PI / 2; dizzy(a); c.lean = PI / 2 * E.bounce(s(t, 4.4, 4.9)); dizzy(c); } } } };

  SC.danceOff = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    if (t > .45) { a.x = M0 - .6; b.x = M0 + .6; c.x = M0; c.z = -.7; }
    var beat = (t - .45) * 2.4, q = Math.floor(beat) % 4, ph = beat % 1;
    if (t > .45 && t < 3.0) { [a, b].forEach(function (p, i) { p.turn = 0; p.armR = q % 2 ? 2.7 : .4; p.armRf = q % 2 ? .3 : 1.0; p.armL = q % 2 ? .4 : 2.0; p.lean = (q % 2 ? -.15 : .15); p.y = arc(ph, .12); p.legL = q % 2 ? -.4 : 0; p.mouth = 'grin'; p.eyes = 'happy'; });
      c.y = Math.abs(Math.sin(t * 6)) * .05; c.mouth = 'smile'; c.armL = c.armR = .3 + Math.abs(Math.sin(t * 7.5)) * .2; }
    if (t >= 3.0 && t < 4.6) { c.z = L(-.7, .2, s(t, 3.0, 3.3)); flail(c, t, 26); c.spin = Math.sin(t * 7) * 1.5; c.legL = Math.sin(t * 19) * .9; c.legR = Math.cos(t * 17) * .9; c.y = Math.abs(Math.sin(t * 13)) * .2; c.mouth = 'open'; c.eyes = 'wide';
      [a, b].forEach(function (p) { p.eyes = 'wide'; p.mouth = 'o'; p.armL = p.armR = .2; p.turn = 0; }); }
    if (t >= 4.6) { [a, b, c].forEach(function (p, i) { var o = i * 1.3; flail(p, t + o, 24); p.spin = Math.sin((t + o) * 6) * 2.2; p.legL = Math.sin((t + o) * 18) * .9; p.legR = Math.cos((t + o) * 15) * .9; p.y = Math.abs(Math.sin((t + o) * 12)) * .25; p.mouth = 'open'; p.eyes = 'happy'; }); c.z = .2;
      if (t > 6.0) K.at(6.0, 'conf', function () { K.fx(M0, 2.2, .3, 30, { c: ['#A100FF', '#00AEEF', '#C6FF3D', '#FF4F9A', '#FFD23D'], sp: 2, g: 2.5, sz: .035, life: 1.4 }); SFX('tada'); }); } } };

  SC.strongman = { d: 7.4, f: function (t, K) { var a = K.a, b = K.b, c = K.c, A = K.A, B = K.B, C = K.C;
    K.d1 = K.d1 || K.hold(K.prop('dumbbell'), K.ca, 'R', 0, 0, .06); K.d2 = K.d2 || K.hold(K.prop('dumbbell'), K.cb, 'R', 0, 0, .06);
    var hv = K.hv || (K.hv = K.prop('dumbbell', true)), hv2 = K.hv2 || (K.hv2 = K.prop('dumbbell', true));
    if (t > .45 && t < 3.2) { [a, b].forEach(function (p, i) { var cur = Math.abs(Math.sin((t + i) * 3)); p.armRf = .2 + cur * 2.2; p.armR = .4; p.sq = .96; p.brow = 1; p.mouth = cur > .8 ? 'flat' : 'grin'; p.lean = Math.sin(t * 9) * .03; if (t > 2.3) { p.armL = p.armR = 2.3; p.armLt = p.armRt = 0; p.armLf = p.armRf = -.8; p.mouth = 'grin'; p.sq = 1.05; } }); }
    var hx = C, hy = .1;
    if (t > 3.0 && t < 3.9) { c.tilt = .5 * (1 - s(t, 3.3, 3.8)); c.armLf = c.armRf = 1.0 + s(t, 3.3, 3.8) * 1.6; c.sq = .82 + Math.sin(t * 40) * .03; c.mouth = 'flat'; c.brow = 1; hx = C; hy = .25 + s(t, 3.3, 3.8) * .9; }
    if (t >= 3.9) { var f = s(t, 3.9, 4.05); hx = C + .12; hy = L(1.15, .12, E.inn(f)); }
    K.sfx(4.05, 'bonk');
    if (t >= 4.05 && t < 7.4) { c.legL = -1.3; c.armL = 1.0; c.armLf = 1.6; c.y = Math.abs(Math.sin(t * 11)) * .3; c.x = C + Math.sin(t * 3) * .3; c.eyes = 'wide'; c.mouth = 'open'; if (t > 5.4) { laugh(c, t); c.armR = 1.8; c.armRf = 1.2; }
      if (t < 5.4) { laugh(a, t); laugh(b, t); } }
    pnode(hv, hx, hy, .3);
    var ax = A, ay = 1.1; if (t > 4.8 && t < 5.4) { a.armLf = a.armRf = 2.4; a.sq = .85; a.brow = 1; ay = 1.3; } if (t >= 5.4) { var f2 = s(t, 5.4, 5.55); ay = L(1.3, .12, E.inn(f2)); ax = A + .1; if (t > 5.55) { a.legR = -1.3; a.y = Math.abs(Math.sin(t * 11 + 1)) * .3; a.x = A + Math.sin(t * 3 + 1) * .3; a.eyes = 'wide'; a.mouth = 'open'; } }
    hv2.vis = t > 4.8; pnode(hv2, ax, ay, .3); K.sfx(5.55, 'bonk'); } };

  SC.tickle = { d: 7.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, P = [a, b, c], sp = K.sp * .7;
    P.forEach(function (p, i) { if (t > .45) p.x = K.mid + (i - 1) * sp; });
    function tick(x, y, t0, t1) { if (t > t0 && t < t1) { face(x, y.x); x.armLf = x.armRf = 1.3 + Math.sin(t * 40) * .25; x.mouth = 'grin'; x.eyes = 'happy'; y.mouth = 'open'; y.eyes = 'happy'; y.lean = Math.sin(t * 14) * .25; flail(y, t, 30); y.y = Math.abs(Math.sin(t * 15)) * .1; } }
    tick(c, b, .6, 2.0); if (t > 1.5 && t < 1.8) { b.turn = -1.1; b.armL = 2.6; } if (t > 1.65 && t < 1.8) a.sq = .8; K.sfx(1.65, 'tap');
    tick(a, c, 2.1, 3.4); tick(b, a, 3.4, 4.2); tick(c, b, 3.8, 4.6); tick(a, c, 4.2, 5.0);
    if (t > .6 && t < 5.0 && Math.random() < .05) SFX('giggle');
    if (t >= 5.0) P.forEach(function (p, i) { p.lean = [1, -1, 1][i] * PI / 2 * E.out(s(t, 5.0, 5.4)); p.legL = Math.sin(t * 16 + i) * .9; p.legR = -p.legL; p.mouth = 'open'; p.eyes = 'happy'; p.turn = 0; p.sq = 1 + Math.sin(t * 20 + i) * .05; }); } };

  /* ---------- CUTE FINISHERS ---------- */
  SC.groupHug = { d: 7, f: function (t, K) { var a = K.a, b = K.b, c = K.c, P = [a, b, c], M0 = K.mid;
    var k = E.io(s(t, .5, 1.2));
    if (t > .45 && t < 3.2) P.forEach(function (p, i) { p.x = L(p.x, M0 + (i - 1) * .4, k); p.turn = -(i - 1) * .7; p.armL = p.armR = 1.3; p.armLf = p.armRf = .9; p.eyes = 'happy'; p.mouth = 'grin'; p.sq = 1 + Math.sin(t * 3) * .03; });
    if (t > 1.2 && t < 2.6 && Math.random() < .15) K.fx(M0 + rnd(-.4, .4), 1.5, .3, 1, { c: '#FF4F9A', sp: .5, g: -1.2, sz: .05, life: 1 });
    if (t >= 2.6 && t < 3.2) { b.lean = -.5; b.brow = 1; b.mouth = 'flat'; a.armR = 2.0; a.armRf = 1.4; flail(b, t, 18); }
    if (t >= 3.2 && t < 4.9) { var th = (t - 3.2) * L(2, 9, s(t, 3.2, 4.9)); P.forEach(function (p, i) { var q = th + i * TAU / 3; p.x = M0 + Math.cos(q) * .45; p.z = Math.sin(q) * .45; p.turn = -q + PI / 2; p.lean = .25; p.mouth = 'open'; p.eyes = 'happy'; p.armL = p.armR = 1.3; }); }
    if (t >= 4.9) P.forEach(function (p, i) { var q = (4.9 - 3.2) * 9 + i * TAU / 3, f = E.bounce(s(t, 4.9, 5.4)); p.x = M0 + Math.cos(q) * .55; p.z = Math.sin(q) * .45; p.lean = [1, -1, .9][i] * PI / 2 * f; p.mouth = 'open'; p.eyes = 'happy'; p.legL = Math.sin(t * 14 + i) * .7; p.legR = -p.legL; });
    K.sfx(1.2, 'chime'); K.sfx(4.9, 'bonk'); } };

  SC.victory = { d: 7.6, f: function (t, K) { var a = K.a, b = K.b, c = K.c, P = [a, b, c], M0 = K.mid;
    var hl = K.hl || (K.hl = K.prop('hill')), fl = K.fl || (K.fl = K.hold(K.prop('flag'), K.ca, 'R', 0, 0, .05)), lf = K.lf || (K.lf = K.prop('leaf'));
    pnode(hl, M0, -.02, -.3); var top = [.32, .45, .3], xs = [M0 - .55, M0, M0 + .55];
    P.forEach(function (p, i) { if (t > .45 && t < 4.4) { var k = E.io(s(t, .5, 1.3)); p.x = L(p.x, xs[i], k); p.y = top[i] * k; p.z = -.3 * k; p.turn = 0; } });
    if (t > 1.3 && t < 4.4) { a.armR = 2.9; b.armL = 2.7; b.armLf = -.2; c.sq = 1.08; c.armL = c.armR = -.25; P.forEach(function (p) { p.mouth = 'grin'; p.brow = 1; }); K.at(1.4, 'sp', function () { SFX('tada'); K.fx(M0, 1.9, 0, 20, { c: ['#FFD84D', '#FFFFFF'], sp: 2, g: 1, e: 1, sz: .03 }); }); }
    var lx = L(M0 + 1.4, xs[0], s(t, 1.6, 3.6)) + Math.sin(t * 4) * .3 * (1 - s(t, 1.6, 3.6)), ly = L(3.2, top[0] + K.faceY(K.ca) - .08 + .02, s(t, 1.6, 3.6)); pnode(lf, lx, ly, .5); lf.r = [Math.sin(t * 5) * .5, 0, Math.sin(t * 4) * .6 * (1 - s(t, 3.4, 3.6))];
    if (t > 3.6 && t < 4.4) { a.cross = true; a.look = [.55, 0]; a.mouth = 'o'; a.sq = 1 + s(t, 3.8, 4.35) * .12; a.tilt = -.25 * s(t, 3.8, 4.35); a.armR = 2.0; }
    K.at(4.4, 'ach', function () { SFX('sneeze'); K.fx(xs[0], 1.4, .5, 18, { c: '#FFFFFF', sp: 3, ang: 0, spread: 1, g: 0, sz: .035, a: .8 }); });
    if (t >= 4.4) { a.cross = false; P.forEach(function (p, i) { var f = E.bounce(s(t, 4.45 + i * .2, 5.0 + i * .2)); p.x = xs[i] + f * .3; p.y = top[i] * (1 - f); p.lean = -PI / 2 * f; p.z = -.3; if (f > .5) dizzy(p); });
      var kf = s(t, 5.4, 6.1); K.hold(fl, K.st, 'world'); pnode(fl, L(xs[0] + .3, M0 + .5, kf), L(1.0, .45, kf) + arc(kf, .5), .1); fl.r[2] = -PI / 2 * kf - .2; lf.vis = t < 4.5; }
    K.sfx(5.0, 'bonk'); K.sfx(6.1, 'tap'); } };

  /* ---------- celebrations / system ---------- */
  SC.danceParty = { d: 6.2, f: function (t, K) { var P = [K.a, K.b, K.c];
    P.forEach(function (p, i) { var beat = (t - .45) * 2.5 + i * .05, q = Math.floor(beat) % 8, ph = beat % 1; if (t < .45) return;
      p.turn = q === 6 ? E.io(ph) * TAU : 0; p.y = arc(ph, .14); p.armL = [2.6, .3, 2.6, 1.6, .3, 2.6, 2.6, 1.0][q]; p.armR = [.3, 2.6, 2.6, 1.6, 2.6, .3, 2.6, 1.0][q];
      p.armLf = q === 3 ? 1.2 : 0; p.armRf = q === 3 ? 1.2 : 0; p.lean = [.15, -.15, 0, 0, .2, -.2, 0, 0][q]; p.legL = q % 2 ? -.5 : 0; p.legR = q % 2 ? 0 : -.5; p.mouth = 'grin'; p.eyes = 'happy'; });
    K.at(1.0, 'tada', function () { SFX('tada'); K.fx(K.mid, 2.4, .3, 30, { c: ['#A100FF', '#00AEEF', '#C6FF3D', '#FF4F9A', '#FFD23D'], sp: 2.2, g: 2.5, sz: .035, life: 1.6 }); }); } };

  SC.yay = { d: 4.6, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid;
    var k = s(t, .5, 1.3); a.y = arc(k, 1.3); a.tilt = -E.io(k) * TAU; cheer(a, t); a.turn = 0;
    if (t > .5) { b.x = L(K.B, M0 + .15, s(t, .5, .9)); c.x = L(K.C, M0 + .75, s(t, .5, .9)); }
    var j = s(t, 1.2, 1.9); b.y = arc(j, 1.0); c.y = arc(j, 1.0); if (j > 0) { b.turn = 1.1; c.turn = -1.1; b.armL = b.armR = 2.4; c.armL = c.armR = 2.4; }
    if (j > .45 && j < .6) { b.sq = c.sq = .75; } K.sfx(1.55, 'bonk'); if (j > .5) { b.x -= (j - .5) * .6; c.x += (j - .5) * .6; }
    if (t > 2.0) { [b, c].forEach(function (p) { p.turn = 0; cheer(p, t); }); }
    K.at(.9, 'cf', function () { SFX('tada'); K.fx(M0, 2.2, .3, 34, { c: ['#C6FF3D', '#00AEEF', '#A100FF', '#FFD23D'], sp: 2.4, g: 2.5, sz: .035, life: 1.5 }); }); } };

  SC.sad = { d: 5.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, B = K.B;
    var cl = K.cl || (K.cl = K.prop('cloud')); pnode(cl, b.x, K.cb.H + .55 + Math.sin(t * 2) * .04, 0);
    if (Math.random() < .6) K.fx(b.x + rnd(-.25, .25), K.cb.H + .45, .1, 1, { c: '#7EC8FF', sp: .2, g: 6, sz: .025, life: .5, ang: -PI / 2, spread: .2 });
    b.sq = .9; b.tilt = .25; b.brow = -1; b.mouth = 'frown'; b.eyes = 'open'; b.look = [.4, 0]; b.armL = b.armR = .05;
    if (t > 1.0) { mv(a, K.A, B - .42, t, 1.0, 1.5, 12); if (t > 1.5) { a.turn = 1.0; a.armR = 1.4; a.armRf = .8 + Math.sin(t * 6) * .2; a.brow = -1; a.mouth = 'smile'; } }
    if (t > 1.8) { mv(c, K.C, B + .45, t, 1.8, 2.3, 12); if (t > 2.3) { c.turn = -1.0; c.armL = .6; c.armLf = 1.3; var jb = K.jb || (K.jb = K.hold(K.prop('juice'), K.cc, 'L', 0, .05, .05)); c.mouth = 'grin'; } }
    if (t > 3.4) { b.brow = 0; b.mouth = 'smile'; b.tilt = 0; b.sq = 1; b.eyes = 'happy'; cl.sc(Math.max(.01, 1 - s(t, 3.4, 4))); }
    K.sfx(.4, 'trombone'); } };

  SC.wave = { d: 3.2, form: false, f: function (t, K) { [K.a, K.b, K.c].forEach(function (p, i) { p.turn = 0; p.armR = 2.4 + Math.sin(t * 14 + i) * .4; p.armRf = .3; p.mouth = 'grin'; p.eyes = t % 1 > .8 ? 'happy' : 'open'; p.y = i === 1 ? Math.abs(Math.sin(t * 6)) * .15 : 0; }); K.sfx(.2, 'chime'); } };
  SC.cheer = { d: 2.4, form: false, f: function (t, K) { [K.a, K.b, K.c].forEach(function (p, i) { p.turn = 0; cheer(p, t); p.y = arc((t * 1.6 + i * .2) % 1, .4); }); K.sfx(.1, 'wheee'); } };
  SC.highFive = { d: 3.2, f: function (t, K) { var a = K.a, b = K.b, c = K.c, M0 = K.mid; [a, b, c].forEach(function (p, i) { if (t > .45) { p.x = L(p.x, M0 + (i - 1) * .32, s(t, .45, .8)); var j = s(t, .9, 1.5); p.y = arc(j, .8); p.armL = p.armR = 2.8; p.turn = -(i - 1) * .9; p.mouth = 'grin'; p.eyes = 'happy'; } });
    K.at(1.2, 'hf', function () { SFX('pop'); K.fx(M0, 2.0, .2, 18, { c: ['#C6FF3D', '#FFFFFF'], sp: 2.4, e: 1, sz: .03 }); }); } };
  SC.bow = { d: 3.6, f: function (t, K) { [K.a, K.b, K.c].forEach(function (p, i) { p.turn = 0; var k = s(t, .8 + i * .1, 1.4 + i * .1) * (1 - s(t, 2.4, 2.9)); p.tilt = .8 * k; p.armL = p.armR = .1; p.armRf = .6 * k; p.eyes = k > .5 ? 'closed' : 'open'; }); K.sfx(.8, 'chime'); } };
  SC.dish = { d: 3.6, form: false, f: function (t, K) { var b = K.b, a = K.a, c = K.c, ds = K.ds || (K.ds = K.hold(K.prop('dish'), K.cb, 'R', 0, .1, .05));
    b.turn = 0; b.armR = 2.8; b.armRt = Math.sin(t * 2) * .8; b.mouth = 'flat'; b.brow = 1; b.y = Math.abs(Math.sin(t * 4)) * .06; ds.r = [0, Math.sin(t * 2) * 1.2, Math.sin(t * 1.5) * .4];
    face(a, b.x); a.armR = 1.6; a.armRf = .8; a.mouth = 'o'; c.turn = -.4; c.armL = 2.2 + Math.sin(t * 8) * .3; c.mouth = 'o'; } };
  SC.chillNudge = { d: 3.6, form: false, f: function (t, K) { var a = K.a, b = K.b, c = K.c, pp = K.st.perch ? 1 : 0;
    [a, b, c].forEach(function (p) { p.seat = pp; });
    if (t > .4 && t < 1.0) { face(a, b.x); a.armR = .9; a.armRf = .6; } if (t > .7 && t < .95) { b.lean = -.25; b.sq = .9; } K.sfx(.7, 'tap');
    if (t > 1.3 && t < 1.9) { face(b, c.x); b.armR = .9; b.armRf = .6; } if (t > 1.6 && t < 1.85) { c.lean = -.25; c.sq = .9; }
    if (t > 2.2 && t < 3.2) { c.turn = -1.0; c.brow = 1; c.armL = 1.2; c.mouth = 'grin'; if (t > 2.5 && t < 2.8) { b.lean = .5; a.lean = .3; a.mouth = b.mouth = 'o'; } } K.sfx(2.5, 'boing'); } };
  SC.yawn = { d: 3.4, form: false, f: function (t, K) { var p = [K.a, K.b, K.c][Math.floor(K.st._yi = (K.st._yi || 0)) % 3]; [K.a, K.b, K.c].forEach(function (q) { q.seat = K.st.perch ? 1 : 0; });
    var k = s(t, .3, 1.6) * (1 - s(t, 2.2, 2.8)); p.sq = 1 + k * .1; p.armL = p.armR = .2 + k * 2.6; p.mouth = k > .3 ? 'open' : 'smile'; p.lid = Math.min(1, k * 1.3); p.tilt = -k * .2;
    if (t > 2.8) { p.brow = 1; p.armL = p.armR = 1.6; p.armLf = p.armRf = -.6; p.mouth = 'grin'; } } };

  var GROUPS = {
    rocket: ['sneakyRocket', 'rocketChain', 'wrongEnd', 'rocketSeat', 'fizzle', 'rocketTug'],
    revenge: ['pieRelay', 'whoopee', 'bucket', 'pokeWar', 'stickyGum', 'paintSwap', 'cakeFace'],
    chaos: ['domino', 'seesaw', 'bananaRelay', 'magnet', 'springBoots', 'balloonLift', 'zoomies'],
    team: ['humanLadder', 'piggyback', 'tugOfWar', 'fakeLift', 'trenchcoat'],
    contest: ['rps', 'staring', 'danceOff', 'strongman', 'tickle'],
    finish: ['groupHug', 'victory']
  };
  GROUPS.gag = [].concat(GROUPS.rocket, GROUPS.revenge, GROUPS.chaos, GROUPS.team, GROUPS.contest, GROUPS.finish);
  GROUPS.lobby = GROUPS.slapstick = GROUPS.gag;
  GROUPS.dance = ['danceOff', 'danceParty', 'zoomies'];
  GROUPS.chill = ['chillNudge', 'yawn'];
  GROUPS.read = ['staring', 'chillNudge', 'yawn'];
  GROUPS.crowd = ['yay', 'danceParty', 'highFive', 'groupHug'];
  GROUPS.rebel = ['danceOff', 'magnet', 'bananaRelay', 'zoomies', 'rps'];
  GROUPS.quizWrong = ['sad', 'pieRelay', 'bucket', 'cakeFace'];
  GROUPS.upset = ['domino', 'fizzle'];
  GROUPS.gameover = ['victory', 'groupHug', 'danceParty'];
  GROUPS.reconnect = ['dish']; GROUPS.reconnected = ['highFive']; GROUPS.loop404 = ['fizzle', 'wrongEnd', 'bucket', 'zoomies'];
  GROUPS.hello = ['wave']; GROUPS.cheer = ['cheer']; GROUPS.credits = ['bow'];
  GROUPS.streakCrowd = GROUPS.crowd; GROUPS.streakRebel = GROUPS.rebel;
  var ALIAS = { peekCheer: 'cheer', podium: 'victory', loneWolf: 'danceOff', pyramid: 'humanLadder', bro: 'pokeWar', magnifier: 'staring', chairGP: 'rocketChain',
    coatHeist: 'trenchcoat', disco: 'danceParty', campfire: 'yawn', newJoiner: 'wave', newJoinerStack: 'cheer', fixing404: 'fizzle', satellite: 'dish', mallet: 'pokeWar',
    pie: 'pieRelay', standup: 'staring', chaiCoffee: 'cakeFace', replyAll: 'pieRelay', onMute: 'rps', stickyMummy: 'stickyGum', tieIncident: 'tugOfWar', waitingHost: 'yawn',
    cheater: 'staring', civilWar: 'tugOfWar', conga: 'danceParty', secretDance: 'danceOff', pointGasp: 'rps', slowClap: 'danceOff', perfReview: 'strongman', sadTrombone: 'sad',
    needsImprovement: 'sad', tooCool: 'danceParty', comfortHug: 'groupHug', upset: 'domino', danceOff2: 'danceOff', flexOff: 'strongman', headbang: 'danceParty', copycat: 'danceOff',
    pokeWar2: 'pokeWar', pushOff: 'piggyback', headBonk: 'zoomies', tieSnap: 'tugOfWar', sneeze: 'staring', ledgeChill: 'chillNudge', toughGuys: 'strongman' };

  /* ---------------- easter eggs ---------------- */
  function eggs(st) {
    var Kc = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], i = 0;
    g.addEventListener('keydown', function (e) { i = e.keyCode === Kc[i] ? i + 1 : (e.keyCode === Kc[0] ? 1 : 0); if (i === Kc.length) { i = 0; st.konami(); } });
    var lastShake = 0; g.addEventListener('devicemotion', function (e) { var a = e.accelerationIncludingGravity; if (!a) return; var m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0), n = Date.now(); if (m > 42 && n - lastShake > 3000) { lastShake = n; st.shakeFall(); } }, { passive: true });
  }

  /* ---------------- poses for portraits + the phone sticker crew ---------------- */
  var POSES = {
    idle: { mouth: 'smile' }, happy: { mouth: 'grin' }, smug: { brow: 1, mouth: 'grin', turn: -.3 },
    ecstatic: { eyes: 'happy', mouth: 'open', armL: 2.5, armR: 2.5 }, love: { eyes: 'happy', mouth: 'smile', armL: 1.2, armR: 1.2, armLf: .9, armRf: .9 },
    cheer: { eyes: 'happy', mouth: 'open', armL: 2.7, armR: 2.7, turn: 0 }, wave: { mouth: 'grin', armR: 2.6, armL: .2 },
    shock: { eyes: 'wide', mouth: 'o', armL: 1.9, armR: 1.9, turn: 0 }, dizzy: { eyes: 'x', mouth: 'o', dizzy: 1, armL: .9, armR: .9 },
    cream: { cream: 1, eyes: 'closed', mouth: 'o', armL: .5, armR: .5, turn: 0 }, sleepy: { lid: .9, mouth: 'o', armL: .05, armR: .05 },
    sad: { brow: -1, mouth: 'frown', armL: .05, armR: .05, lid: .3 }, tough: { brow: 1, lid: .38, mouth: 'flat', armL: 1.6, armR: 1.6, armLf: -.7, armRf: -.7, turn: 0 },
    laugh: { eyes: 'happy', mouth: 'open', armLf: 1.1, armRf: 1.1, armL: .4, armR: .4, turn: 0 }, soot: { dark: 1, eyes: 'wide', mouth: 'o', hairUp: 1, turn: 0 }
  };

  /* ---------------- portraits (Wrapped story cards) ---------------- */
  var PR = null, PCV = null, PCH = {};
  function dataURL(who, opts) {
    opts = opts || {}; who = KEYS[who] || 'bip';
    try {
      if (!PR) { PCV = document.createElement('canvas'); PR = new T3.Renderer(PCV, { preserve: true }); }
      if (!PR.ok()) return '';
      var w = opts.size || 300, h = Math.round(w * 1.25), ch = PCH[who] || (PCH[who] = new Char(who)), world = new N();
      world.add(ch.root); var u = h * .58 / HT.bip; /* one scale for all three, so their real size difference survives */ world.at(w / 2, -h * .94, 0); world.sc(u);
      ch.reset(0, 0, {}); var P = ch.P, e = opts.expr || 'happy'; P.blink = 0; P.turn = .25; P.sq = 1;
      var pz = POSES[e] || POSES.happy; for (var k in pz) P[k] = pz[k];
      if (opts.wave) { P.armR = 2.5; }
      ch.apply(0, [0, 0]); PR.begin(w, h, 1); PR.draw(world, null);
      var url = PCV.toDataURL(opts.type || 'image/png', opts.q || .92); world.remove(ch.root); return url;
    } catch (err) { return ''; }
  }

  g.Crew = {
    mount: function (el, opts) { var st = new Stage(el, opts || {}); if (!opts || opts.eggs !== false) eggs(st); return st; },
    dataURL: dataURL, portrait: function () { return ''; },
    SCENES: SC, GROUPS: GROUPS, DESIGN: SPEC, POSES: POSES, is3D: true,
    count: function () { return GROUPS.gag.length + ['danceParty', 'yay', 'sad', 'wave', 'cheer', 'highFive', 'bow', 'dish', 'chillNudge', 'yawn'].length + 5; },
    available: function () { return ensure(); }
  };
  if (PERF.register) PERF.register({ pause: function () {}, resume: kick });
})(window);

/* ==================================================================
   POCKET CREW — the phone version of the trio. No WebGL, no 3D engine.
   The 3D characters are pre-rendered into 45 crisp WebP stickers
   (assets/crew/*.webp, ~8 KB each, loaded on demand). Phones animate
   them with compositor-only CSS + native emoji props: hops, flips,
   squash, rockets, pies, bonks, banana slips, balloons, sneezes.
   Same API as the 3D Stage, so every page works unchanged.
   ================================================================== */
(function (g) {
  'use strict';
  var C = g.Crew; if (!C) return;
  var KINDS = ['bip', 'bop', 'boop'], ALIASK = { momo: 'bip', noodle: 'bop', bean: 'boop', bip: 'bip', bop: 'bop', boop: 'boop' };
  var SFX = function (n) { try { if (g.SFX && g.SFX[n]) g.SFX[n](); } catch (e) {} };
  var VER = 'v=28';
  function src(k, pose) { return '/assets/crew/' + k + '-' + pose + '.webp?' + VER; }
  var cache = {};
  function preload(k, pose) { var u = src(k, pose); if (!cache[u]) { var im = new Image(); im.decoding = 'async'; im.src = u; cache[u] = im; } return u; }

  var CSS = '' +
    '.pk-stage{position:absolute;inset:0;pointer-events:none;clip-path:inset(-600px -80px 0 -80px)}' +
    '.pk{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;will-change:transform;transition:transform .5s cubic-bezier(.3,1.3,.5,1)}' +
    '.pk>i{position:absolute;left:0;bottom:0;transform:translateX(-50%);display:block;transform-origin:50% 100%}' +
    /* phone gimmick: tilt the phone and the stickers lean + slide like they have weight, and a holo glint
       sweeps across them (mask = the sticker itself). CSS only, driven by --tilt-x from the gyroscope. */
    '.pk>i{rotate:calc(var(--tilt-x,0) * 16deg);translate:calc(var(--tilt-x,0) * 22%) 0;transition:rotate .25s ease-out,translate .35s cubic-bezier(.3,1.4,.5,1)}' +
    '.pk>i::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:screen;opacity:.85;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.65) 47%,rgba(198,255,61,.35) 52%,transparent 62%);background-size:260% 100%;background-position:calc(50% - var(--tilt-x,0) * 70%) 0;-webkit-mask:var(--m) center/100% 100% no-repeat;mask:var(--m) center/100% 100% no-repeat}' +
    '.pk img{position:relative;z-index:1;display:block;max-width:none;pointer-events:auto;-webkit-user-drag:none;user-select:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}' +
    '.pk>i::after{content:"";position:absolute;left:22%;right:22%;bottom:2%;height:9%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.35),transparent);z-index:-1}' +
    '.pk.idle>i{animation:pkIdle 2.6s ease-in-out infinite}' +
    '@keyframes pkIdle{50%{transform:translateX(-50%) scale(1.02,.98)}}' +
    '.pk.hop>i{animation:pkHop .55s cubic-bezier(.3,0,.4,1)}@keyframes pkHop{0%{transform:translateX(-50%) scale(1.12,.85)}35%{transform:translateX(-50%) translateY(-45%) scale(.92,1.1)}70%{transform:translateX(-50%) scale(1.15,.82)}100%{transform:translateX(-50%)}}' +
    '.pk.flip>i{animation:pkFlip .7s ease-in-out}@keyframes pkFlip{50%{transform:translateX(-50%) translateY(-35%) scaleX(-1)}100%{transform:translateX(-50%) scaleX(1)}}' +
    '.pk.spin>i{animation:pkSpin .9s cubic-bezier(.4,0,.2,1)}@keyframes pkSpin{25%{transform:translateX(-50%) scaleX(.05)}50%{transform:translateX(-50%) scaleX(-1)}75%{transform:translateX(-50%) scaleX(.05)}}' +
    '.pk.wobble>i{animation:pkWob .6s ease-in-out infinite}@keyframes pkWob{25%{transform:translateX(-50%) rotate(-9deg)}75%{transform:translateX(-50%) rotate(9deg)}}' +
    '.pk.dance>i{animation:pkDance .5s ease-in-out infinite}@keyframes pkDance{0%,100%{transform:translateX(-50%) rotate(-10deg) scale(1.04,.96)}50%{transform:translateX(-50%) translateY(-14%) rotate(10deg) scale(.96,1.05)}}' +
    '.pk.shake>i{animation:pkShake .12s linear infinite}@keyframes pkShake{50%{transform:translateX(-46%) rotate(3deg)}}' +
    '.pk.squash>i{animation:pkSq .4s cubic-bezier(.3,1.6,.5,1)}@keyframes pkSq{0%{transform:translateX(-50%) scale(1.35,.6)}100%{transform:translateX(-50%)}}' +
    '.pk.fall>i{transform:translateX(-50%) rotate(88deg) translateX(-20%);transition:transform .45s cubic-bezier(.5,0,.6,1.4)}' +
    '.pk.fallL>i{transform:translateX(-50%) rotate(-88deg) translateX(20%);transition:transform .45s cubic-bezier(.5,0,.6,1.4)}' +
    '.pk.up>i{transition:transform .5s cubic-bezier(.3,1.4,.5,1)}' +
    '.pk-fx{position:absolute;left:0;bottom:0;pointer-events:none;font-size:calc(var(--pku)*.32);line-height:1;transform:translate(-50%,0);will-change:transform,opacity;z-index:4}' +
    '.pk-say{position:absolute;bottom:0;transform:translate(-50%,0);padding:4px 10px;border-radius:999px;background:#F3EEFF;color:#140C2E;font:700 12px var(--f-ui,system-ui);white-space:nowrap;z-index:5;animation:pkSay 1.6s ease forwards}' +
    '@keyframes pkSay{0%{opacity:0;transform:translate(-50%,8px) scale(.6)}15%{opacity:1;transform:translate(-50%,0) scale(1.05)}85%{opacity:1}100%{opacity:0}}' +
    'html.reduced .pk>i{animation:none!important}';
  var cssDone = false;
  function boot() { if (cssDone) return; cssDone = true;
    /* gyroscope → --tilt-x (river.js also sets it; this covers pages without the river) */
    if (g.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') g.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; var v = Math.max(-1, Math.min(1, e.gamma / 40)); document.documentElement.style.setProperty('--tilt-x', v.toFixed(2)); }, { passive: true });
 var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    KINDS.forEach(function (k) { ['idle', 'happy', 'cheer', 'shock', 'laugh'].forEach(function (p) { preload(k, p); }); }); }

  function Pocket(el, opts) {
    boot(); opts = opts || {}; var self = this; this.c = el; this.opts = opts; this.perch = !!opts.perch; this.mode = 'idle'; this.scene = null; this.timers = []; this.recent = [];
    el.classList.add('crew-band', 'crew-band--pocket'); if (opts.mode) el.classList.add('crew-band--' + opts.mode);
    this.stage = document.createElement('div'); this.stage.className = 'pk-stage'; el.appendChild(this.stage);
    this._homeFr = { bip: .3, bop: .5, boop: .7 }; var h = opts.home || {}; Object.keys(h).forEach(function (k) { if (ALIASK[k]) self._homeFr[ALIASK[k]] = h[k]; });
    Object.defineProperty(this, 'home', { get: function () { return { momo: self._homeFr.bip, noodle: self._homeFr.bop, bean: self._homeFr.boop }; },
      set: function (v) { Object.keys(v || {}).forEach(function (k) { if (ALIASK[k]) self._homeFr[ALIASK[k]] = v[k]; }); self.layout(); } });
    this.ch = {}; this.list = [];
    KINDS.forEach(function (k) {
      var w = document.createElement('div'); w.className = 'pk idle'; w.innerHTML = '<i><img alt="" draggable="false"></i>';
      var img = w.querySelector('img'); img.src = src(k, 'idle'); w.firstChild.style.setProperty('--m', 'url("' + img.src + '")');
      var o = { kind: k, el: w, img: img, x: self._homeFr[k], pose: 'idle' }; self.ch[k] = o; self.list.push(o); self.stage.appendChild(w);
      img.addEventListener('pointerdown', function () { if (self.scene) return; self.move(o, 'hop'); self.pose(o, ['happy', 'laugh', 'shock', 'love', 'smug'][Math.floor(Math.random() * 5)], 900); SFX('boing'); });
    });
    this.chars = { momo: this.ch.bip, noodle: this.ch.bop, bean: this.ch.boop, bip: this.ch.bip, bop: this.ch.bop, boop: this.ch.boop };
    this.layout(); var ro = g.ResizeObserver ? new ResizeObserver(function () { self.layout(); }) : null; if (ro) ro.observe(el); else g.addEventListener('resize', function () { self.layout(); });
    this._ro = ro;
  }
  var P = Pocket.prototype;
  P.layout = function () {
    var r = this.c.getBoundingClientRect(); this.W = r.width; this.H = r.height; if (!this.W) return;
    var floor = this.opts.floorY ? this.opts.floorY(this) : this.H - (this.opts.floorPad != null ? this.opts.floorPad : Math.max(4, this.H * .06));
    var chH = this.perch ? floor * .98 : Math.min(this.H * (this.opts.fill || .9), this.W / 3.4 * 1.35);
    this.u = chH; this.floor = floor; this.stage.style.height = floor + 'px'; this.stage.style.bottom = 'auto';
    this.stage.style.setProperty('--pku', chH + 'px');
    var self = this, ih = chH / .58; this.list.forEach(function (o) { var i = o.el.firstChild; o.img.style.height = ih + 'px'; o.img.style.width = (ih * .8) + 'px'; i.style.bottom = (-ih * .06) + 'px'; self.place(o); });
  };
  P.place = function (o, x, dy) { if (x != null) o.x = x; o.dy = dy || 0; o.el.style.transform = 'translate3d(' + (o.x * this.W).toFixed(1) + 'px,' + (this.floor + (o.dy || 0)).toFixed(1) + 'px,0)'; };
  P.pose = function (o, pose, ms) {
    var self = this; o.pose = pose; o.img.src = preload(o.kind, pose); o.el.firstChild.style.setProperty('--m', 'url("' + o.img.src + '")');
    clearTimeout(o._pt); if (ms) o._pt = setTimeout(function () { o.img.src = src(o.kind, 'idle'); o.pose = 'idle'; o.el.firstChild.style.setProperty('--m', 'url("' + o.img.src + '")'); }, ms);
  };
  P.move = function (o, cls, ms) {
    var el = o.el; ['hop', 'flip', 'spin', 'squash', 'wobble', 'dance', 'shake'].forEach(function (c) { el.classList.remove(c); });
    if (cls === 'hop' || cls === 'flip' || cls === 'spin' || cls === 'squash') { void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, ms || 950); }
    else if (cls) { el.classList.add(cls); if (ms) setTimeout(function () { el.classList.remove(cls); }, ms); }
  };
  P.fallOver = function (o, left, on) { o.el.classList.toggle(left ? 'fallL' : 'fall', on !== false); if (on === false) { o.el.classList.remove('fall', 'fallL'); } };
  P.fx = function (emoji, x0, y0, x1, y1, ms, o) {
    o = o || {}; var n = document.createElement('span'); n.className = 'pk-fx'; n.textContent = emoji; this.stage.appendChild(n);
    var W = this.W, F = this.floor, u = this.u, t0 = performance.now(); ms = ms || 700;
    (function f(now) { var k = Math.min(1, (now - t0) / ms), e = o.lin ? k : k * (2 - k), x = (x0 + (x1 - x0) * e) * W, y = F - (y0 + (y1 - y0) * e) * u - Math.sin(k * Math.PI) * (o.arc || 0) * u;
      n.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%) rotate(' + ((o.spin || 0) * k) + 'deg) scale(' + (o.grow ? 1 + k * o.grow : 1) + ')';
      n.style.opacity = o.fade ? 1 - k : 1; if (k < 1) requestAnimationFrame(f); else setTimeout(function () { n.remove(); }, o.hold || 0); })(t0);
  };
  P.say = function (o, txt) { var n = document.createElement('div'); n.className = 'pk-say'; n.textContent = txt; n.style.left = (o.x * this.W) + 'px'; n.style.bottom = (this.H - this.floor + this.u * 1.02) + 'px'; this.stage.appendChild(n); setTimeout(function () { n.remove(); }, 1700); };
  P.at = function (ms, fn) { this.timers.push(setTimeout(fn, ms)); };
  P.clear = function () { this.timers.forEach(clearTimeout); this.timers = []; var self = this; this.list.forEach(function (o) { o.el.classList.remove('fall', 'fallL', 'wobble', 'dance', 'shake'); self.pose(o, 'idle'); self.place(o, self._homeFr[o.kind], 0); o.el.style.transition = ''; o.el.style.opacity = ''; }); this.stage.querySelectorAll('.pk-fx,.pk-say').forEach(function (n) { n.remove(); }); };
  P.walk = function (o, x, ms) { o.el.style.transition = 'transform ' + (ms || 500) + 'ms cubic-bezier(.45,0,.3,1)'; this.place(o, x, o.dy); this.move(o, 'wobble', ms || 500); };
  P.lift = function (o, dyUnits, ms, ease) { o.el.style.transition = 'transform ' + (ms || 500) + 'ms ' + (ease || 'cubic-bezier(.3,1.2,.5,1)'); this.place(o, o.x, -dyUnits * this.u); };

  /* ---------- 16 pocket gags (seamless: every gag ends with the trio back home, idle) ---------- */
  var G = {};
  G.pie = function (s, A, B, Cc) { s.pose(A, 'smug'); s.at(350, function () { s.move(A, 'hop'); s.fx('🥧', A.x, .6, B.x, .55, 520, { arc: .5, spin: 400 }); SFX('whoosh'); });
    s.at(880, function () { s.pose(B, 'cream'); s.move(B, 'squash'); SFX('splat'); s.fx('💥', B.x, .5, B.x, .7, 400, { fade: 1, grow: .6 }); s.pose(Cc, 'laugh'); s.move(Cc, 'dance', 1400); s.pose(A, 'laugh'); });
    s.at(2000, function () { s.pose(B, 'tough'); s.fx('🥧', B.x, .6, A.x, .6, 480, { arc: .4, spin: -400 }); });
    s.at(2500, function () { s.pose(A, 'cream'); s.move(A, 'squash'); SFX('splat'); s.pose(B, 'laugh'); });
    return 3600; };
  G.rocket = function (s, A, B, Cc) { s.pose(A, 'smug'); s.fx('🚀', B.x, .05, B.x, .05, 900, { hold: 0 }); s.at(500, function () { s.pose(B, 'shock'); s.move(B, 'shake', 600); SFX('fizz'); });
    s.at(1100, function () { SFX('zoom'); s.lift(B, 4, 650, 'cubic-bezier(.5,0,.8,.4)'); s.fx('🚀', B.x, .0, B.x, 4, 650, { lin: 1 }); s.pose(A, 'laugh'); s.pose(Cc, 'shock'); });
    s.at(2000, function () { s.pose(B, 'dizzy'); s.lift(B, 0, 600, 'cubic-bezier(.4,0,.6,1)'); });
    s.at(2620, function () { SFX('bonk'); s.move(B, 'squash'); s.fx('💫', B.x, 1, B.x, 1.2, 900, { fade: 1 }); });
    return 3800; };
  G.bonk = function (s, A, B, Cc) { var mid = (A.x + Cc.x) / 2; s.pose(A, 'happy'); s.pose(Cc, 'happy');
    s.walk(A, mid - .07, 450); s.walk(Cc, mid + .07, 450);
    s.at(460, function () { SFX('bonk'); s.fx('💥', mid, .7, mid, .9, 450, { fade: 1, grow: .8 }); s.pose(A, 'dizzy'); s.pose(Cc, 'dizzy'); s.fallOver(A, true); s.fallOver(Cc, false); s.pose(B, 'laugh'); s.move(B, 'hop'); });
    s.at(1800, function () { s.fallOver(A, true, false); s.fallOver(Cc, false, false); s.pose(A, 'idle'); s.pose(Cc, 'idle'); s.walk(A, s._homeFr[A.kind], 500); s.walk(Cc, s._homeFr[Cc.kind], 500); });
    return 2600; };
  G.banana = function (s, A, B) { s.fx('🍌', A.x + .1, 0, A.x + .1, 0, 600); s.at(300, function () { s.walk(A, A.x + .1, 300); });
    s.at(650, function () { SFX('squeak'); s.pose(A, 'shock'); s.lift(A, .5, 260); s.move(A, 'spin'); s.fx('🍌', A.x, 0, B.x, .1, 700, { arc: .8, spin: 720 }); });
    s.at(950, function () { s.lift(A, 0, 260, 'ease-in'); s.fallOver(A, false); SFX('bonk'); s.pose(A, 'dizzy'); s.pose(B, 'laugh'); s.move(B, 'dance', 900); });
    s.at(1700, function () { s.pose(B, 'shock'); s.lift(B, .4, 240); s.move(B, 'flip'); SFX('squeak'); });
    s.at(2000, function () { s.lift(B, 0, 260, 'ease-in'); s.fallOver(B, true); SFX('bonk'); s.pose(B, 'dizzy'); });
    s.at(3000, function () { s.fallOver(A, false, false); s.fallOver(B, true, false); s.walk(A, s._homeFr[A.kind], 400); });
    return 3500; };
  G.sneeze = function (s, A, B, Cc) { s.pose(B, 'shock'); s.move(B, 'shake', 700); s.at(750, function () { SFX('sneeze'); s.pose(B, 'laugh'); s.move(B, 'squash'); s.fx('💨', B.x, .5, B.x - .25, .5, 600, { fade: 1, grow: 1.5 }); s.fx('💨', B.x, .5, B.x + .25, .5, 600, { fade: 1, grow: 1.5 });
      s.pose(A, 'shock'); s.pose(Cc, 'shock'); s.walk(A, A.x - .12, 300); s.walk(Cc, Cc.x + .12, 300); s.fallOver(A, true); s.fallOver(Cc, false); });
    s.at(2000, function () { s.fallOver(A, true, false); s.fallOver(Cc, false, false); s.pose(A, 'tough'); s.pose(Cc, 'tough'); s.walk(A, s._homeFr[A.kind], 500); s.walk(Cc, s._homeFr[Cc.kind], 500); });
    return 2800; };
  G.dance = function (s, A, B, Cc) { SFX('tada'); [A, B, Cc].forEach(function (o, i) { s.at(i * 120, function () { s.pose(o, i === 1 ? 'cheer' : 'laugh'); s.move(o, 'dance', 2400); }); });
    s.at(800, function () { s.fx('🎵', B.x, 1.1, B.x + .15, 1.6, 900, { fade: 1 }); }); s.at(1500, function () { s.move(B, 'spin'); s.fx('🎶', A.x, 1.1, A.x - .1, 1.6, 900, { fade: 1 }); });
    return 2900; };
  G.balloon = function (s, A, B, Cc) { s.pose(B, 'happy'); s.fx('🎈', B.x, 1.0, B.x, 1.0, 400); s.at(400, function () { s.lift(B, 1.2, 1200, 'ease-out'); s.fx('🎈', B.x, 1.0, B.x, 2.2, 1200, { lin: 1 }); s.pose(B, 'cheer'); });
    s.at(1700, function () { s.pose(Cc, 'smug'); s.fx('📌', Cc.x, .8, B.x, 2.2, 400); });
    s.at(2100, function () { SFX('pop'); s.fx('💥', B.x, 2.2, B.x, 2.4, 400, { fade: 1 }); s.pose(B, 'shock'); s.lift(B, 0, 450, 'cubic-bezier(.5,0,.8,.6)'); });
    s.at(2560, function () { SFX('bonk'); s.move(B, 'squash'); s.pose(B, 'dizzy'); s.pose(A, 'laugh'); s.pose(Cc, 'laugh'); });
    return 3500; };
  G.sleepy = function (s, A, B, Cc) { s.pose(Cc, 'sleepy'); s.fx('💤', Cc.x + .05, 1.0, Cc.x + .12, 1.5, 1400, { fade: 1 }); s.at(900, function () { s.pose(B, 'smug'); s.walk(B, Cc.x - .1, 500); });
    s.at(1500, function () { SFX('tap'); s.move(B, 'hop'); s.pose(Cc, 'shock'); s.move(Cc, 'hop'); s.lift(Cc, .5, 200); });
    s.at(1750, function () { s.lift(Cc, 0, 300, 'ease-in'); s.pose(B, 'laugh'); });
    s.at(2400, function () { s.pose(Cc, 'tough'); s.walk(B, s._homeFr[B.kind], 450); s.move(B, 'flip'); });
    return 3100; };
  G.flex = function (s, A, B, Cc) { [A, B, Cc].forEach(function (o, i) { s.at(i * 380, function () { s.pose(o, 'tough'); s.move(o, 'squash'); s.fx('💪', o.x + .06, .8, o.x + .1, 1.1, 700, { fade: 1 }); SFX('hmph'); }); });
    s.at(1500, function () { s.pose(Cc, 'shock'); s.move(Cc, 'shake', 500); s.fx('🏋️', Cc.x, .8, Cc.x, 0, 300); });
    s.at(1850, function () { SFX('bonk'); s.pose(Cc, 'dizzy'); s.move(Cc, 'hop'); s.pose(A, 'laugh'); s.pose(B, 'laugh'); });
    return 2900; };
  G.tug = function (s, A, B, Cc) { s.pose(A, 'tough'); s.pose(B, 'tough'); s.walk(A, A.x - .05, 300); s.walk(B, B.x + .05, 300); s.move(A, 'shake'); s.move(B, 'shake'); s.pose(Cc, 'happy');
    s.at(1300, function () { SFX('tear'); s.move(A, ''); s.move(B, ''); s.walk(A, A.x - .14, 300); s.walk(B, B.x + .14, 300); s.fallOver(A, true); s.fallOver(B, false); s.pose(A, 'dizzy'); s.pose(B, 'dizzy'); s.fx('🧃', Cc.x + .07, .6, Cc.x + .07, .6, 1000); s.pose(Cc, 'love'); SFX('slurp'); });
    s.at(2500, function () { s.fallOver(A, true, false); s.fallOver(B, false, false); s.walk(A, s._homeFr[A.kind], 500); s.walk(B, s._homeFr[B.kind], 500); });
    return 3200; };
  G.spinoff = function (s, A, B, Cc) { [A, B, Cc].forEach(function (o, i) { s.at(i * 220, function () { s.pose(o, 'happy'); s.move(o, 'spin'); SFX('whoosh'); }); });
    s.at(1100, function () { [A, B, Cc].forEach(function (o) { s.pose(o, 'dizzy'); s.move(o, 'wobble', 900); }); s.fx('💫', B.x, 1.1, B.x, 1.3, 900, { fade: 1 }); });
    return 2400; };
  G.cheer = function (s, A, B, Cc) { SFX('tada'); [A, B, Cc].forEach(function (o, i) { s.at(i * 90, function () { s.pose(o, 'cheer', 1600); s.move(o, 'hop'); }); });
    s.at(300, function () { ['🎉', '✨', '🎊'].forEach(function (e, i) { s.fx(e, .5, .8, .2 + i * .3, 1.7, 900, { fade: 1 }); }); }); s.at(700, function () { [A, B, Cc].forEach(function (o) { s.move(o, 'hop'); }); });
    return 1900; };
  G.sad = function (s, A, B, Cc) { s.pose(B, 'sad'); s.fx('🌧️', B.x, 1.15, B.x, 1.2, 1900); SFX('trombone'); s.at(900, function () { s.pose(A, 'love'); s.walk(A, B.x - .1, 400); });
    s.at(1500, function () { s.pose(B, 'happy'); s.move(B, 'hop'); s.fx('❤️', B.x, 1, B.x, 1.4, 800, { fade: 1 }); });
    return 2600; };
  G.wave = function (s, A, B, Cc) { [A, B, Cc].forEach(function (o, i) { s.at(i * 160, function () { s.pose(o, 'wave', 1500); s.move(o, 'hop'); }); }); SFX('chime'); return 1800; };
  G.soot = function (s, A, B, Cc) { s.fx('🧨', B.x, 0, B.x, 0, 1200); [A, Cc].forEach(function (o) { s.walk(o, B.x + (o === A ? -.1 : .1), 400); s.pose(o, 'smug'); }); s.pose(B, 'smug');
    s.at(1200, function () { SFX('bassdrop'); s.fx('💥', B.x, .3, B.x, .6, 400, { fade: 1, grow: 1.5 }); [A, B, Cc].forEach(function (o) { s.pose(o, 'soot'); s.move(o, 'squash'); }); });
    s.at(2700, function () { [A, Cc].forEach(function (o) { s.walk(o, s._homeFr[o.kind], 500); }); });
    return 3400; };
  G.dish = function (s, A, B) { s.pose(B, 'tough'); s.fx('📡', B.x + .06, 1.0, B.x + .06, 1.0, 1800); s.move(B, 'wobble', 1800); s.pose(A, 'shock'); return 2000; };
  /* every 3D scene name/group -> a pocket gag */
  var MAP = { rocket: 'rocket', revenge: 'pie', chaos: 'bonk', team: 'tug', contest: 'flex', finish: 'cheer', gag: null, dance: 'dance', chill: 'sleepy', read: 'sleepy',
    crowd: 'cheer', rebel: 'dance', quizWrong: 'sad', upset: 'bonk', gameover: 'cheer', reconnect: 'dish', reconnected: 'cheer', loop404: 'soot', hello: 'wave', cheer: 'cheer', credits: 'wave',
    sneakyRocket: 'rocket', rocketChain: 'spinoff', wrongEnd: 'rocket', rocketSeat: 'rocket', fizzle: 'soot', rocketTug: 'rocket', pieRelay: 'pie', whoopee: 'sneeze', bucket: 'bonk', pokeWar: 'bonk',
    stickyGum: 'tug', paintSwap: 'sleepy', cakeFace: 'pie', domino: 'bonk', seesaw: 'balloon', bananaRelay: 'banana', magnet: 'bonk', springBoots: 'dance', balloonLift: 'balloon', zoomies: 'spinoff',
    humanLadder: 'flex', piggyback: 'tug', tugOfWar: 'tug', fakeLift: 'banana', trenchcoat: 'spinoff', rps: 'flex', staring: 'sneeze', danceOff: 'dance', strongman: 'flex', tickle: 'dance',
    groupHug: 'cheer', victory: 'cheer', danceParty: 'dance', yay: 'cheer', sad: 'sad', wave: 'wave', highFive: 'cheer', bow: 'wave', dish: 'dish', chillNudge: 'sleepy', yawn: 'sleepy' };
  var ALL = Object.keys(G).filter(function (k) { return k !== 'dish' && k !== 'wave' && k !== 'sad'; });
  P.pickName = function (name) { var m = MAP[name]; if (m === null || (!m && !G[name])) { var fresh = ALL.filter(function (k) { return this.recent.indexOf(k) < 0; }, this); m = fresh[Math.floor(Math.random() * fresh.length)] || 'cheer'; } return m || name; };
  P.play = function (name, ctx, done) {
    var gname = this.pickName(name), fn = G[gname]; if (!fn) { if (done) done(); return; }
    this.clear(); this.recent.push(gname); if (this.recent.length > 6) this.recent.shift();
    var self = this, trio = [this.ch.bip, this.ch.bop, this.ch.boop]; if (Math.random() < .5 && gname !== 'pie') trio = [trio[2], trio[1], trio[0]];
    this.scene = { name: gname }; var d = fn(this, trio[0], trio[1], trio[2]) || 2500;
    this.at(d, function () { self.list.forEach(function (o) { self.pose(o, 'idle'); o.el.classList.remove('fall', 'fallL', 'wobble', 'dance', 'shake'); self.walk(o, self._homeFr[o.kind], 420); self.place(o, self._homeFr[o.kind], 0); }); });
    this.at(d + 450, function () { self.scene = null; if (done) done(); });
    return gname;
  };
  P.playGroup = function (group, ctx, done) { if (Array.isArray(group)) group = group[Math.floor(Math.random() * group.length)]; return this.play(group, ctx, done); };
  P.stopLoop = function () { clearTimeout(this._lt); this._loop = null; };
  P.loopGroup = function (group, a, b) { var self = this; this.stopLoop(); var tok = this._loop = {}; (function next() { if (self._loop !== tok) return; self.playGroup(group, {}, function () { if (self._loop !== tok) return; self._lt = setTimeout(next, (a || 1800) + Math.random() * ((b || 3600) - (a || 1800))); }); })(); };
  P.fun = function () { this.loopGroup(['gag', 'gag', 'dance', 'chill'], 1500, 3000); };
  P.moment = function (m) { this.mode = m; this.stopLoop(); var self = this; if (m === 'lobby') { this.clear(); this._lt = setTimeout(function () { self.loopGroup(['gag', 'gag', 'dance'], 1500, 3200); }, 600); } else if (m === 'answer' || m === 'idle') { this.clear(); this.scene = null; } };
  P.react = function (kind) { this.stopLoop(); var m = { crowd: 'cheer', right: 'cheer', rebel: 'dance', wrong: 'sad', streakCrowd: 'dance', streakRebel: 'dance', upset: 'bonk', gameover: 'cheer' }; return this.play(m[kind] || 'cheer'); };
  P.welcome = function (names) { if (!names || !names.length) return; this.play('wave'); this.say(this.ch.bop, 'Hi ' + names[names.length - 1] + '!'); };
  P.attend = function (frac) { if (this.scene) return; var self = this; this.list.forEach(function (o, i) { self.walk(o, Math.max(.1, Math.min(.9, frac + (i - 1) * .14)), 380); self.pose(o, 'happy'); }); };
  P.lockSeal = function (frac) { this.stopLoop(); this.clear(); var self = this; this.list.forEach(function (o, i) { self.walk(o, Math.max(.1, Math.min(.9, frac + (i - 1) * .14)), 300); self.at(320, function () { self.pose(o, 'tough', 1200); self.move(o, 'squash'); }); });
    this.at(330, function () { SFX('lock'); self.fx('🔒', frac, .4, frac, 1.2, 700, { fade: 1, grow: .5 }); }); this.scene = { name: 'stomp' }; this.at(1300, function () { self.scene = null; }); };
  P.panic = function (sec) { if (this.scene) return; var self = this; this.list.forEach(function (o) { self.pose(o, 'shock', 700); self.move(o, 'shake', 700); }); if (sec <= 1) this.at(400, function () { SFX('bonk'); self.list.forEach(function (o) { self.move(o, 'hop'); }); }); };
  P.climbIn = function () { this.stopLoop(); this.clear(); var self = this; this.list.forEach(function (o, i) { o.el.style.transition = 'none'; self.place(o, self._homeFr[o.kind], self.u * 1.1); void o.el.offsetWidth;
      self.at(60 + i * 140, function () { self.lift(o, 0, 600); self.pose(o, i === 1 ? 'cheer' : 'happy', 1300); }); }); this.at(700, function () { SFX('hup'); }); };
  P.home_ = function () { var self = this; if (this.scene) return; this.list.forEach(function (o) { self.walk(o, self._homeFr[o.kind], 420); }); };
  P.chaos = function () { this.stopLoop(); this.play('gag'); };
  P.resize = function () { this.layout(); }; P.setSkin = function () {}; P.end = function () { this.clear(); this.scene = null; };
  P.destroy = function () { this.stopLoop(); this.clear(); if (this._ro) this._ro.disconnect(); this.stage.remove(); };

  C.Pocket = Pocket;
  C.isPhone = function () {
    var q = location.search; if (/[?&]force3d/.test(q)) return false; if (/[?&]pocket/.test(q)) return true;
    var coarse = g.matchMedia && g.matchMedia('(pointer: coarse)').matches;
    return !!coarse && Math.min(screen.width || innerWidth, screen.height || innerHeight) < 600;
  };
  var mount3d = C.mount;
  C.mount = function (el, opts) { opts = opts || {}; if (!opts.force3D && C.isPhone()) { var p = new Pocket(el, opts); return p; } return mount3d(el, opts); };
})(window);
