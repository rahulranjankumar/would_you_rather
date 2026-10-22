/* ==================================================================
   FUN FRIDAY ARENA v27 — "The Signal River" (living background)
   One full-screen WebGL canvas at NATIVE DPR (FFAperf.DPR, never changed).
   A long-exposure river of light flowing bottom-left -> top-right, braided
   by an analytic curl-noise field. Tiers change the particle COUNT only.
     PC:    cursor = gravitational vortex, fast moves leave an iridescent
            ribbon, click = chrome shockwave, hovered buttons magnetise
            particles like iron filings.
     Phone: tilt steers the river, drag draws a ribbon, long-press (600 ms)
            makes a black hole that bursts on release (+ soft haptic).
   Game moods: lobby, read, answer, last3, pour(x,y), rebel(el), chroma(),
   podium(), burst(). Fallback: 2D canvas with fewer particles.
   ================================================================== */
(function (g) {
  'use strict';
  var P = g.FFAperf || { DPR: Math.min(g.devicePixelRatio || 1, 2), budget: function () { return { particles: 800 }; }, onTier: function () {}, register: function () {}, reduced: false, coarse: false };
  var DPR = P.DPR;
  var MAXN = 2400;
  var cv, gl, ctx2d, prog, buf, data, W = 0, H = 0, N = 0, target = 0;
  var px, py, vx, vy, life, kind;                       // SoA particle state
  var rib, rctx, ribPts = [], rings = [], wellOn = false, wellX = 0, wellY = 0, wellT0 = 0;
  var mx = -9999, my = -9999, mvx = 0, mvy = 0, lastMove = 0, magnet = null;
  var flowAngle = -Math.PI / 4, tiltX = 0, tiltY = 0;
  var speed = 1, dim = 1, mood = 'lobby', pourAt = null, pourUntil = 0, rebelEl = null, rebelUntil = 0, chromaUntil = 0;
  var podiumPts = null, podiumUntil = 0, heartbeat = 0, star = null, nextStar = 0;
  var running = false, raf = 0, t0 = performance.now(), last = 0, paused = false, frames = 0;
  var reduced = P.reduced;

  /* ---------------- analytic curl noise ---------------- */
  /* psi(x,y,t) = sum sin/cos; velocity = (dpsi/dy, -dpsi/dx) => divergence-free swirls */
  function curl(x, y, t, out) {
    var a1 = .0021, b1 = .0017, a2 = .0049, b2 = .0043, a3 = .011, b3 = .009;
    var s1 = x * a1 + t * .07, c1 = y * b1 - t * .05;
    var s2 = x * a2 - t * .11, c2 = y * b2 + t * .09;
    var s3 = (x + y) * a3 + t * .2, c3 = (x - y) * b3 - t * .15;
    // d/dy and d/dx of: sin(s1)cos(c1) + .55 sin(c2)cos(s2) + .22 sin(s3)sin(c3)
    var dy = -Math.sin(s1) * Math.sin(c1) * b1 + .55 * Math.cos(c2) * b2 * Math.cos(s2)
           + .22 * (Math.cos(s3) * a3 * Math.sin(c3) + Math.sin(s3) * Math.cos(c3) * -b3);
    var dx = Math.cos(s1) * a1 * Math.cos(c1) - .55 * Math.sin(c2) * Math.sin(s2) * a2
           + .22 * (Math.cos(s3) * a3 * Math.sin(c3) + Math.sin(s3) * Math.cos(c3) * b3);
    out[0] = dy * 900; out[1] = -dx * 900;
  }
  var tmp = [0, 0];

  function seed(i, anywhere) {
    // spawn along the bottom-left edges of the river so it "flows in"
    if (anywhere) { px[i] = Math.random() * W; py[i] = Math.random() * H; }
    else if (Math.random() < .5) { px[i] = -10; py[i] = Math.random() * H; }
    else { px[i] = Math.random() * W; py[i] = H + 10; }
    vx[i] = 0; vy[i] = 0; life[i] = Math.random();
    var r = Math.random();
    kind[i] = r < 1 / 30 ? 2 : r < 1 / 30 + 1 / 12 ? 1 : 0; // 2 cyan, 1 purple, 0 pearl
  }
  function alloc() {
    px = new Float32Array(MAXN); py = new Float32Array(MAXN); vx = new Float32Array(MAXN); vy = new Float32Array(MAXN);
    life = new Float32Array(MAXN); kind = new Uint8Array(MAXN); data = new Float32Array(MAXN * 5);
  }

  /* ---------------- WebGL ---------------- */
  var VS = 'attribute vec2 p;attribute float s;attribute vec2 c;uniform vec2 r;uniform float d;varying vec2 vc;' +
    'void main(){vec2 q=p/r*2.-1.;gl_Position=vec4(q.x,-q.y,0.,1.);gl_PointSize=s*d;vc=c;}';
  var FS = 'precision mediump float;varying vec2 vc;uniform float dim;' +
    'vec3 pal(float k){return k<.5?vec3(.953,.933,1.):k<1.5?vec3(.63,0.,1.):k<2.5?vec3(0.,.68,.94):vec3(.776,1.,.24);}' +
    'void main(){vec2 u=gl_PointCoord-.5;float m=smoothstep(.5,.0,length(u));gl_FragColor=vec4(pal(vc.x)*m*vc.y*dim,m*vc.y*dim);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
  function initGL() {
    try { gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return false;
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog); buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    var lp = gl.getAttribLocation(prog, 'p'), ls = gl.getAttribLocation(prog, 's'), lc = gl.getAttribLocation(prog, 'c');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 1, gl.FLOAT, false, 20, 8);
    gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 2, gl.FLOAT, false, 20, 12);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    prog.r = gl.getUniformLocation(prog, 'r'); prog.d = gl.getUniformLocation(prog, 'd'); prog.dim = gl.getUniformLocation(prog, 'dim');
    return true;
  }
  function size() {
    W = innerWidth; H = innerHeight;
    /* native DPR, computed once. Never scaled at runtime. */
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    rib.width = cv.width; rib.height = cv.height;
    if (gl) gl.viewport(0, 0, cv.width, cv.height);
  }

  /* ---------------- simulation ---------------- */
  function step(dt, t) {
    var fa = flowAngle + tiltX * .6, fx = Math.cos(fa), fy = Math.sin(fa);
    var base = 34 * speed * (reduced ? .4 : 1);
    var hasM = mx > -999 && (performance.now() - lastMove < 2500);
    var pour = pourAt && t < pourUntil, rebel = rebelEl && t < rebelUntil, rb = null;
    if (rebel) { var r0 = rebelEl.getBoundingClientRect(); rb = [r0.left + r0.width / 2, r0.top + r0.height / 2]; }
    var pod = podiumPts && t < podiumUntil;
    var k = 0;
    for (var i = 0; i < N; i++) {
      curl(px[i], py[i], t, tmp);
      var ax = fx * base + tmp[0] * speed, ay = fy * base + tmp[1] * speed;
      if (hasM) {                                          // cursor vortex (orbit, then rejoin)
        var dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
        if (d2 < 48400) { var d = Math.sqrt(d2) + 1, f = (1 - d / 220) * 140;
          ax += (-dy / d) * f - dx / d * f * .25; ay += (dx / d) * f - dy / d * f * .25; }
      }
      if (magnet) {                                        // iron filings toward hovered button
        var ddx = magnet[0] - px[i], ddy = magnet[1] - py[i], dd = ddx * ddx + ddy * ddy;
        if (dd < 90000) { var di = Math.sqrt(dd) + 1, ff = (1 - di / 300) * 60; ax += ddx / di * ff; ay += ddy / di * ff; }
      }
      if (wellOn) {                                        // phone black hole
        var wx = wellX - px[i], wy = wellY - py[i], wd = Math.sqrt(wx * wx + wy * wy) + 1;
        if (wd < 340) { var wf = (1 - wd / 340) * 420; ax += wx / wd * wf + (-wy / wd) * wf * .4; ay += wy / wd * wf + (wx / wd) * wf * .4; }
      }
      if (pour) { var qx = pourAt[0] - px[i], qy = pourAt[1] - py[i], qd = Math.sqrt(qx * qx + qy * qy) + 1;
        ax += qx / qd * 120; ay += qy / qd * 120; }
      if (pod && i < podiumPts.length) { var tx = podiumPts[i][0] - px[i], ty = podiumPts[i][1] - py[i]; ax = tx * 3; ay = ty * 3; }
      if (rebel && i < 60) {                               // lime solo stream follows YOUR card
        var lx = rb[0] + Math.sin(t * 2 + i) * 60 - px[i], ly = rb[1] + Math.cos(t * 1.7 + i * .7) * 30 - py[i];
        ax = lx * 2.2; ay = ly * 2.2;
      }
      vx[i] += (ax - vx[i]) * Math.min(1, dt * 3); vy[i] += (ay - vy[i]) * Math.min(1, dt * 3);
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; life[i] += dt * .05;
      if (px[i] > W + 20 || py[i] < -20 || px[i] < -40 || py[i] > H + 40) seed(i, false);
      var tw = .5 + .5 * Math.sin(life[i] * 40 + i);
      var sz = (kind[i] ? 2.5 : 1 + (i % 7) * .2) * (pod ? 1.6 : 1);
      var al = (kind[i] ? .75 : .32 + .25 * tw) * (heartbeat > 0 ? 1 + heartbeat * .5 : 1);
      var kk = rebel && i < 60 ? 3 : kind[i];
      data[k++] = px[i]; data[k++] = py[i]; data[k++] = sz; data[k++] = kk; data[k++] = Math.min(1, al);
    }
  }
  function drawGL() {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(prog.r, W, H); gl.uniform1f(prog.d, DPR); gl.uniform1f(prog.dim, dim);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, N * 5));
    gl.drawArrays(gl.POINTS, 0, N);
  }
  var COL2D = ['rgba(243,238,255,', 'rgba(161,0,255,', 'rgba(0,174,239,', 'rgba(198,255,61,'];
  function draw2D() {
    ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0); ctx2d.clearRect(0, 0, W, H);
    for (var c = 0; c < 4; c++) {                        // grouped by colour: one fillStyle per group
      ctx2d.fillStyle = COL2D[c] + (.5 * dim) + ')';
      for (var i = 0, k = 0; i < N; i++, k += 5) if (data[k + 3] === c) ctx2d.fillRect(data[k] - .8, data[k + 1] - .8, data[k + 2] * .8, data[k + 2] * .8);
    }
  }
  /* ---------------- ribbon + shockwave overlay ---------------- */
  function drawFx(t) {
    var any = ribPts.length > 1 || rings.length || star;
    if (!any && !rctx.dirty) return;
    rctx.setTransform(DPR, 0, 0, DPR, 0, 0); rctx.clearRect(0, 0, W, H); rctx.dirty = any;
    var now = performance.now();
    while (ribPts.length && now - ribPts[0][2] > 600) ribPts.shift();
    if (ribPts.length > 2) {
      rctx.lineCap = 'round';
      for (var i = 1; i < ribPts.length; i++) {
        var a = ribPts[i - 1], b = ribPts[i], k = i / ribPts.length, age = 1 - (now - b[2]) / 600;
        rctx.strokeStyle = 'hsla(' + (275 - k * 90) + ',100%,' + (62 + k * 25) + '%,' + (age * .75) + ')';
        rctx.lineWidth = 6 * k * age; rctx.beginPath(); rctx.moveTo(a[0], a[1]);
        rctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); rctx.lineTo(b[0], b[1]); rctx.stroke();
      }
    }
    for (var j = rings.length - 1; j >= 0; j--) {
      var r = rings[j], q = (now - r.t) / 500; if (q >= 1) { rings.splice(j, 1); continue; }
      var e = 1 - Math.pow(1 - q, 3);
      rctx.strokeStyle = 'rgba(243,238,255,' + (1 - q) * .8 + ')'; rctx.lineWidth = 1;
      rctx.beginPath(); rctx.arc(r.x, r.y, 4 + e * 256, 0, 6.2832); rctx.stroke();
      rctx.strokeStyle = 'rgba(161,0,255,' + (1 - q) * .35 + ')'; rctx.beginPath(); rctx.arc(r.x, r.y, 2 + e * 250, 0, 6.2832); rctx.stroke();
    }
    if (star) {
      var sq = (now - star.t) / 900; if (sq >= 1) star = null; else {
        var sx = star.x + sq * star.dx, sy = star.y + sq * star.dy, gr = rctx.createLinearGradient(sx - star.dx * .25, sy - star.dy * .25, sx, sy);
        gr.addColorStop(0, 'rgba(243,238,255,0)'); gr.addColorStop(1, 'rgba(243,238,255,' + (1 - sq) + ')');
        rctx.strokeStyle = gr; rctx.lineWidth = 1.6; rctx.beginPath(); rctx.moveTo(sx - star.dx * .25, sy - star.dy * .25); rctx.lineTo(sx, sy); rctx.stroke();
      }
    }
  }
  function shock(x, y, strength) {
    rings.push({ x: x, y: y, t: performance.now() });
    for (var i = 0; i < N; i++) { var dx = px[i] - x, dy = py[i] - y, d = Math.sqrt(dx * dx + dy * dy) + 1;
      if (d < 260) { var f = (1 - d / 260) * (strength || 900); vx[i] += dx / d * f; vy[i] += dy / d * f; } }
    kick();
  }

  /* ---------------- loop ---------------- */
  function loop(now) {
    raf = 0; if (paused) return; frames++;
    var dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    var t = (now - t0) / 1000;
    if (N < target) { for (var i = N; i < Math.min(target, N + 60); i++) seed(i, true); N = Math.min(target, N + 60); }
    else if (N > target) N = Math.max(target, N - 40);     // crossfade-ish: shrink gradually
    if (heartbeat > 0) heartbeat = Math.max(0, heartbeat - dt * 3);
    if (mood === 'lobby' && now > nextStar) { nextStar = now + 8000 + Math.random() * 7000;
      star = { x: Math.random() * W * .7, y: Math.random() * H * .3, dx: W * .35, dy: H * .18, t: now }; rctx.dirty = true; }
    step(dt, t);
    if (gl) drawGL(); else draw2D();
    drawFx(t);
    var chroma = now < chromaUntil;
    if (chroma !== cv._ch) { cv._ch = chroma; document.documentElement.classList.toggle('river-chroma', chroma); }
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && !paused && running) { last = 0; raf = requestAnimationFrame(loop); } }

  /* ---------------- input ---------------- */
  function bindInput() {
    var lp = null;
    g.addEventListener('pointermove', function (e) {
      var now = performance.now(), dtm = Math.max(1, now - lastMove);
      mvx = (e.clientX - mx) / dtm; mvy = (e.clientY - my) / dtm; mx = e.clientX; my = e.clientY; lastMove = now;
      var fast = Math.abs(mvx) + Math.abs(mvy) > .9;
      if (!reduced && (e.pointerType === 'touch' ? e.buttons : fast)) { ribPts.push([mx, my, now]); if (ribPts.length > 24) ribPts.shift(); rctx.dirty = true; }
      if (lp && (Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) > 14)) { clearTimeout(lp.t); lp = null; }
      if (wellOn) { wellX = mx; wellY = my; }
      var b = e.target && e.target.closest && e.target.closest('button:not([disabled]),a,.magnetic,.popt:not([disabled])');
      if (b) { var r = b.getBoundingClientRect(); magnet = [r.left + r.width / 2, r.top + r.height / 2]; } else magnet = null;
    }, { passive: true });
    g.addEventListener('pointerdown', function (e) {
      mx = e.clientX; my = e.clientY; lastMove = performance.now();
      if (e.pointerType !== 'mouse') {
        lp = { x: e.clientX, y: e.clientY, t: setTimeout(function () { wellOn = true; wellX = mx; wellY = my; wellT0 = performance.now(); lp = null; }, 600) };
      } else shock(e.clientX, e.clientY);
    }, { passive: true });
    function up(e) {
      if (lp) { clearTimeout(lp.t); lp = null; shock(e.clientX, e.clientY, 600); }
      if (wellOn) { wellOn = false; shock(wellX, wellY, 1600); if (navigator.vibrate) navigator.vibrate([12, 30, 18]); }
    }
    g.addEventListener('pointerup', up, { passive: true }); g.addEventListener('pointercancel', up, { passive: true });
    document.addEventListener('mouseleave', function () { mx = -9999; magnet = null; });
    function orient(e) { if (e.gamma == null) return; tiltX = Math.max(-1, Math.min(1, e.gamma / 45)); tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
      document.documentElement.style.setProperty('--tilt-x', tiltX.toFixed(3)); document.documentElement.style.setProperty('--tilt-y', tiltY.toFixed(3)); }
    if (P.coarse && g.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        g.addEventListener('pointerdown', function ask() { g.removeEventListener('pointerdown', ask);
          DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') g.addEventListener('deviceorientation', orient); }).catch(function () {}); }, { once: true });
      } else g.addEventListener('deviceorientation', orient);
    }
  }

  /* ---------------- public API ---------------- */
  function mount(opts) {
    if (cv) return API; opts = opts || {};
    var host = document.createElement('div'); host.className = 'river' + (opts.className ? ' ' + opts.className : '');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '<div class="river__neb river__neb--a"></div><div class="river__neb river__neb--b"></div><div class="river__floor"><i></i></div>';
    cv = document.createElement('canvas'); cv.className = 'river__cv';
    rib = document.createElement('canvas'); rib.className = 'river__fx'; rctx = rib.getContext('2d'); rctx.dirty = true;
    host.appendChild(cv); host.appendChild(rib);
    document.body.insertBefore(host, document.body.firstChild);
    alloc();
    if (!initGL()) ctx2d = cv.getContext('2d');
    size(); g.addEventListener('resize', size);
    target = Math.min(MAXN, (P.budget().particles || 800) * (gl ? 1 : .5) | 0);
    P.onTier(function (t, b) { target = Math.min(MAXN, (b.particles || 800) * (gl ? 1 : .5) | 0); });
    bindInput();
    P.register({ pause: function () { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; }, resume: function () { paused = false; kick(); } });
    running = true;
    /* first paint: void, then the river fades in from the centre outward */
    host.classList.add('is-in');
    kick();
    return API;
  }
  var API = {
    mount: mount,
    mood: function (m) {
      mood = m;
      if (m === 'read') { speed = .55; dim = .8; }
      else if (m === 'answer') { speed = 1.6; dim = 1; }
      else if (m === 'last3') { speed = 1.9; dim = 1; }
      else if (m === 'calm' || m === 'lobby') { speed = 1; dim = 1; }
      document.documentElement.setAttribute('data-mood', m);
    },
    pulse: function () { heartbeat = 1; },
    pour: function (x, y, ms) { pourAt = [x, y]; pourUntil = (performance.now() - t0) / 1000 + (ms || 1600) / 1000; },
    rebel: function (el, ms) { rebelEl = el; rebelUntil = (performance.now() - t0) / 1000 + (ms || 5000) / 1000; },
    chroma: function () { chromaUntil = performance.now() + 180; },
    shock: function (x, y) { shock(x, y); },
    podium: function (pts, ms) { podiumPts = pts; podiumUntil = (performance.now() - t0) / 1000 + (ms || 2200) / 1000;
      setTimeout(function () { podiumPts = null; shock(innerWidth / 2, innerHeight * .6, 1800); }, ms || 2200); },
    speed: function (s) { speed = s; },
    get count() { return N; },
    get frames() { return frames; },
    get rings() { return rings.length; },
    get webgl() { return !!gl; }
  };
  g.River = API;
})(window);
