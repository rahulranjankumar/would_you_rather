/* ==================================================================
   FUN FRIDAY ARENA v27 — FFA.perf
   Adaptive quality WITHOUT touching resolution.
     - DPR is read ONCE (Math.min(devicePixelRatio,2), or 3 on 3x phones)
       and is never changed afterwards. No render scaling, no upscaling.
     - Tiers (ultra / high / balanced / eco) only change HOW MUCH is drawn:
       particle counts, confetti caps, blur strength, secondary motion.
     - Runtime governor: EMA + rolling p90 of frame time. Step down after
       1.5 s under 50 fps, step up after 6 s above 58 fps, lock after two
       failed step-ups. First 1.5 s and single >250 ms hitches are ignored.
     - Pauses all registered loops when the tab is hidden.
     - Press F for the HUD (FPS, p95, tier, GPU, DPR — proving DPR is fixed).
   ================================================================== */
(function (g) {
  'use strict';
  var TIERS = ['eco', 'balanced', 'high', 'ultra'];
  var BUDGET = {
    ultra:    { particles: 2400, confetti: 420, blur: 12, crewExtras: true,  tilt: true,  grid: 'always', secondary: 1 },
    high:     { particles: 1500, confetti: 260, blur: 10, crewExtras: false, tilt: true,  grid: 'always', secondary: 1 },
    balanced: { particles: 800,  confetti: 140, blur: 4,  crewExtras: false, tilt: true,  grid: 'pause',  secondary: 1 },
    eco:      { particles: 300,  confetti: 70,  blur: 0,  crewExtras: false, tilt: false, grid: 'static', secondary: .5 }
  };
  var raw = g.devicePixelRatio || 1;
  /* fixed for the whole session: 3 only on phones that report 3 */
  var DPR = raw >= 3 && /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 3 : Math.min(raw, 2);
  Object.freeze && (DPR = DPR); // documented constant
  var KEY = 'ffa-perf-v27', WEEK = 7 * 864e5;
  var reduced = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = g.matchMedia && g.matchMedia('(pointer: coarse)').matches;
  var listeners = [], loops = new Set();
  var state = { tier: 'high', gpu: '', hz: 60, locked: false, failedUps: 0, profiled: false };

  function gpuString() {
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl');
      if (!gl) return 'no-webgl';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return String(s || '');
    } catch (e) { return ''; }
  }
  function classify(gpu, hz) {
    var cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    var c = navigator.connection, save = !!(c && c.saveData);
    var s = 0;
    if (/RTX|Radeon RX|Apple M[1-9]|M[1-9] (Pro|Max)|Arc A|GeForce GTX 1[6-9]|Adreno \(TM\) 7[3-9]\d|Mali-G7[1-9]/i.test(gpu)) s += 3;
    else if (/Iris|Xe|Adreno \(TM\) 6[4-9]\d|Adreno \(TM\) 7|Apple GPU|Mali-G[6-9]/i.test(gpu)) s += 2;
    else if (/SwiftShader|llvmpipe|Microsoft Basic|no-webgl/i.test(gpu)) s -= 2;
    else s += 1;
    if (cores >= 8) s += 1; if (cores <= 4) s -= 1;
    if (mem >= 8) s += 1; if (mem <= 2) s -= 1;
    if (coarse) s -= 1;
    var t = s >= 4 ? 'ultra' : s >= 2 ? 'high' : s >= 0 ? 'balanced' : 'eco';
    if (save || reduced) t = TIERS[Math.max(0, TIERS.indexOf(t) - 1)];
    return t;
  }
  function measureHz(cb) {
    var n = 0, t0 = 0, last = 0, d = [];
    function f(t) { if (!t0) t0 = t; else d.push(t - last); last = t;
      if (++n < 60) requestAnimationFrame(f);
      else { d.sort(function (a, b) { return a - b; }); var med = d[d.length >> 1] || 16.7; cb(Math.round(1000 / med)); } }
    requestAnimationFrame(f);
  }
  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && Date.now() - o.at < WEEK) return o; } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), tier: state.tier, gpu: state.gpu, hz: state.hz })); } catch (e) {} }
  function setTier(t, why) {
    if (t === state.tier) return;
    state.tier = t; document.documentElement.setAttribute('data-tier', t);
    /* tier change is a crossfade, never a pop */
    document.documentElement.classList.add('tier-xfade');
    setTimeout(function () { document.documentElement.classList.remove('tier-xfade'); }, 420);
    listeners.forEach(function (fn) { try { fn(t, BUDGET[t], why); } catch (e) {} });
    save(); hud();
  }
  /* ---------- battery: <20 % and not charging => Eco ---------- */
  function battery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (b) {
      function chk() { if (b.level < .2 && !b.charging) setTier('eco', 'battery'); }
      chk(); b.addEventListener('levelchange', chk); b.addEventListener('chargingchange', chk);
    }).catch(function () {});
  }
  /* ---------- runtime governor ---------- */
  var ema = 16.7, buf = new Float32Array(120), bi = 0, bn = 0, lastT = 0, startAt = 0, lowSince = 0, highSince = 0, rising = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = 0; return; }
    if (!lastT) { lastT = t; if (!startAt) startAt = t; return; }
    var dt = t - lastT; lastT = t;
    if (t - startAt < 1500 || dt > 250) return;            // warm-up + shader-compile hitches ignored
    ema = ema * .92 + dt * .08; buf[bi] = dt; bi = (bi + 1) % buf.length; bn = Math.min(bn + 1, buf.length);
    var fps = 1000 / ema, idx = TIERS.indexOf(state.tier);
    if (fps < 50) { highSince = 0; if (!lowSince) lowSince = t;
      if (t - lowSince > 1500 && idx > 0) { lowSince = 0; if (state.upTry) { state.failedUps++; state.upTry = false; if (state.failedUps >= 2) state.locked = true; }
        setTier(TIERS[idx - 1], 'governor-down'); } }
    else if (fps > 58) { lowSince = 0; if (!highSince) highSince = t;
      if (!state.locked && t - highSince > 6000 && idx < 3) { highSince = 0; state.upTry = true; setTier(TIERS[idx + 1], 'governor-up'); } }
    else { lowSince = 0; highSince = 0; }
    if (hudOn && (bi & 7) === 0) hud();
  }
  function pct(p) { if (!bn) return 0; var a = Array.prototype.slice.call(buf, 0, bn).sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }
  /* ---------- HUD ---------- */
  var hudOn = false, hudEl = null;
  function hud() {
    if (!hudOn) return;
    if (!hudEl) { hudEl = document.createElement('div'); hudEl.className = 'ffa-hud'; document.body.appendChild(hudEl); }
    hudEl.textContent = 'FPS ' + Math.round(1000 / ema) + '  p95 ' + pct(.95).toFixed(1) + 'ms\nTIER ' + state.tier.toUpperCase() + (state.locked ? ' (locked)' : '') +
      '\nDPR ' + DPR + ' (fixed)  canvas px stay native\nGPU ' + (state.gpu || '?').slice(0, 42);
  }
  g.addEventListener('keydown', function (e) {
    if ((e.key === 'f' || e.key === 'F') && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) {
      hudOn = !hudOn; if (!hudOn && hudEl) { hudEl.remove(); hudEl = null; } else hud(); }
  });
  /* ---------- visibility: pause registered loops ---------- */
  document.addEventListener('visibilitychange', function () {
    document.documentElement.classList.toggle('is-hidden', document.hidden);
    loops.forEach(function (l) { try { document.hidden ? l.pause() : l.resume(); } catch (e) {} });
  });

  function init() {
    var cached = load();
    if (cached) { state.gpu = cached.gpu; state.hz = cached.hz; state.tier = cached.tier; }
    else { state.gpu = gpuString(); state.tier = classify(state.gpu, 60); }
    var forced = (location.search.match(/[?&]tier=(ultra|high|balanced|eco)/) || [])[1];
    if (forced) { state.tier = forced; state.locked = true; }
    document.documentElement.setAttribute('data-tier', state.tier);
    if (reduced) document.documentElement.classList.add('reduced');
    if (!cached && !forced) measureHz(function (hz) { state.hz = hz; save(); });
    battery();
    requestAnimationFrame(frame);
  }
  init();

  g.FFAperf = {
    DPR: DPR,
    reduced: reduced,
    coarse: coarse,
    tier: function () { return state.tier; },
    budget: function () { return BUDGET[state.tier]; },
    onTier: function (fn) { listeners.push(fn); },
    register: function (loop) { loops.add(loop); return function () { loops.delete(loop); }; },
    stats: function () { return { fps: 1000 / ema, p95: pct(.95), p90: pct(.9), tier: state.tier, dpr: DPR, gpu: state.gpu }; },
    setTier: setTier
  };
})(window);
