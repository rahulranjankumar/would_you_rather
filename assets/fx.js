/* ==================================================================
   FUN FRIDAY ARENA v27 — motion kit (FX)
   - ONE shared confetti canvas at NATIVE DPR (FFAperf.DPR; v25 capped it
     at 1.5 — now razor-sharp on Retina & 3x phones). Size never changes
     at runtime except on window resize.
   - Draw path: direct setTransform math (no save/translate/rotate/restore
     per particle) and particles GROUPED BY COLOUR: one fillStyle change
     per colour per frame. Cap follows the perf tier (420/260/140/70).
   - 20 question transitions (15 classics + hologram scan, portal swirl,
     liquid chrome wipe, warp streaks, pixel assemble). Transform and
     opacity ONLY — no animated clip-path / filter / box-shadow.
   - Lime cursor ring on fine pointers; paper poppers on tap; chrome coins.
   ================================================================== */
(function (g) {
  'use strict';
  var PERF = g.FFAperf || { DPR: Math.min(g.devicePixelRatio || 1, 2), budget: function () { return { confetti: 260 }; }, reduced: false };
  var COLORS = ['#A100FF', '#C77DFF', '#00AEEF', '#5FD8FF', '#C6FF3D', '#F3EEFF', '#4B18A8'];
  var reduced = PERF.reduced;
  var DPR = PERF.DPR;
  function cap() { return (PERF.budget().confetti || 260) * (reduced ? .35 : 1) | 0; }

  /* ---------------- confetti engine ---------------- */
  var cv, cx, P = [], running = false;
  function ensure() {
    if (cv) return; cv = document.createElement('canvas'); cv.className = 'fx-canvas';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
    document.body.appendChild(cv); cx = cv.getContext('2d'); size(); g.addEventListener('resize', size);
  }
  function size() { cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR); }
  function spawn(x, y, n, o) {
    ensure(); o = o || {}; var MAX = cap(); if (reduced) n = Math.ceil(n * .35);
    var cols = o.colors || COLORS;
    for (var i = 0; i < n && P.length < MAX; i++) {
      var a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - .5) * (o.spread || Math.PI * 1.2);
      var v = (o.speed || 9) * (.45 + Math.random() * .75);
      P.push({ x: x * DPR, y: y * DPR, vx: Math.cos(a) * v * DPR, vy: Math.sin(a) * v * DPR, w: (5 + Math.random() * 7) * DPR, h: (3 + Math.random() * 5) * DPR,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, ci: i % cols.length, cols: cols, life: 0, max: (o.life || 90) + Math.random() * 40,
        round: o.shape === 'c' || Math.random() < .16, g: o.gravity == null ? .22 : o.gravity });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  var groups = {};
  function tick() {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    groups = {};
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.life++; p.vx *= .985; p.vy = p.vy * .985 + p.g * DPR; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.life > p.max || p.y > cv.height + 40) { P[i] = P[P.length - 1]; P.pop(); continue; }
      var c = p.cols[p.ci]; (groups[c] = groups[c] || []).push(p);
    }
    for (var col in groups) {
      cx.fillStyle = col; var arr = groups[col];
      for (var k = 0; k < arr.length; k++) {
        var q = arr[k], a = 1 - Math.max(0, (q.life - q.max * .7) / (q.max * .3));
        cx.globalAlpha = a;
        var cs = Math.cos(q.r), sn = Math.sin(q.r), fl = q.round ? 1 : Math.cos(q.life * .18 + q.r);
        /* direct transform: rotate(r) then scale(1, flip) */
        cx.setTransform(cs, sn, -sn * fl, cs * fl, q.x, q.y);
        if (q.round) { cx.beginPath(); cx.arc(0, 0, q.h * .6, 0, 6.283); cx.fill(); }
        else cx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      }
    }
    cx.globalAlpha = 1; cx.setTransform(1, 0, 0, 1, 0, 0);
    if (P.length) requestAnimationFrame(tick); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  function burst(x, y, n, o) { spawn(x, y, n || 60, o); }
  function cannons(opt) {
    var w = innerWidth, h = innerHeight, o = opt || {};
    spawn(0, h * .88, 80, { angle: -Math.PI / 3, spread: .7, speed: 18, life: 120, colors: o.colors });
    spawn(w, h * .88, 80, { angle: -Math.PI * 2 / 3, spread: .7, speed: 18, life: 120, colors: o.colors });
    if (g.SFX) g.SFX.pop();
  }
  function rain(n, o) { var w = innerWidth; for (var i = 0; i < (n || 6); i++) setTimeout(function () { spawn(Math.random() * w, -10, 14, { angle: Math.PI / 2, spread: .9, speed: 3, life: 160, gravity: .08, colors: o && o.colors }); }, i * 120); }

  /* ---------------- paper poppers on any tap ---------------- */
  var lastPop = 0;
  function poppers() {
    g.addEventListener('pointerdown', function (e) {
      var now = Date.now(); if (now - lastPop < 90) return; lastPop = now;
      spawn(e.clientX, e.clientY, 14, { spread: Math.PI * 2, speed: 6, life: 50, gravity: .18 });
    }, { passive: true });
  }

  /* ---------------- spaceship cursor + rocket exhaust ----------------
     Fine pointers only. The NOSE is the hotspot. The ship turns toward where you move
     (springs back to a classic cursor angle when idle). Exhaust = one small canvas, ≤90
     particles, loop sleeps when everything has faded. Boost flame over buttons / on click. */
  function cursor() {
    if (!(g.matchMedia && g.matchMedia('(pointer: fine)').matches)) return;
    var ship = document.createElement('div'); ship.className = 'fx-ship';
    ship.innerHTML = '<svg viewBox="-20 -24 40 48" width="34" height="40"><defs><linearGradient id="shB" x1="0" x2="1"><stop offset="0" stop-color="#8b85a8"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#a9a3c4"/></linearGradient>' +
      '<radialGradient id="shW" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#E9FBFF"/><stop offset=".5" stop-color="#5FD8FF"/><stop offset="1" stop-color="#0086C3"/></radialGradient></defs>' +
      '<path d="M-7,10 L-15,18 L-13,6 Z" fill="#A100FF"/><path d="M7,10 L15,18 L13,6 Z" fill="#A100FF"/>' +
      '<path d="M0,-22 C8,-12 9,2 7,14 L-7,14 C-9,2 -8,-12 0,-22Z" fill="url(#shB)" stroke="#2a2440" stroke-width=".8"/>' +
      '<ellipse cx="0" cy="-6" rx="3.6" ry="5" fill="url(#shW)" stroke="#2a2440" stroke-width=".6"/><path d="M-5,14 h10 l-2,3 h-6Z" fill="#4B18A8"/>' +
      '<path class="fx-flame" d="M-3.5,17 Q0,30 3.5,17Z" fill="#C6FF3D"/></svg>';
    document.body.appendChild(ship); document.documentElement.classList.add('fx-cursor');
    var cv = document.createElement('canvas'); cv.className = 'fx-trail'; document.body.appendChild(cv);
    var cx2 = cv.getContext('2d'), D = DPR;
    function sz() { cv.width = Math.round(innerWidth * D); cv.height = Math.round(innerHeight * D); } sz(); g.addEventListener('resize', sz);
    var x = -100, y = -100, px = x, py = y, ang = -0.6, tgt = -0.6, vx = 0, vy = 0, boost = 0, press = 0, raf = 0, last = 0, seen = false, P2 = [], lastMove = 0;
    var COL = ['255,255,255', '198,255,61', '0,174,239', '161,0,255'];
    function emit(n, power) {
      var a = ang + Math.PI / 2;                        // exhaust leaves from the tail, opposite the nose
      var tx = x + Math.cos(a) * 34, ty = y + Math.sin(a) * 34;
      for (var i = 0; i < n && P2.length < 90; i++) {
        var sp = (1.2 + Math.random() * 1.8) * power, s = (Math.random() - .5) * .5;
        P2.push({ x: tx, y: ty, vx: Math.cos(a + s) * sp - vx * .15, vy: Math.sin(a + s) * sp - vy * .15, l: 0, m: 22 + Math.random() * 18, r: 2.4 + Math.random() * 2.6 * power });
      }
    }
    function loop(t) {
      raf = 0; var dt = Math.min(40, t - (last || t)); last = t;
      var dx = x - px, dy = y - py; px += dx * .35; py += dy * .35;
      vx = vx * .7 + dx * .3; vy = vy * .7 + dy * .3;
      var moving = Math.abs(vx) + Math.abs(vy) > .6;
      tgt = moving ? Math.atan2(vy, vx) + Math.PI / 2 : (t - lastMove > 500 ? -0.6 : tgt);
      var d = tgt - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); ang += d * .22;
      boost += ((press ? 2.2 : 0) + (ship._big ? .8 : 0) - boost) * .2;
      var power = .55 + Math.min(1.6, (Math.abs(vx) + Math.abs(vy)) * .08) + boost * .5;
      if (moving || boost > .3) emit(moving ? 2 : 1, power);
      /* nose = hotspot: the ship's nose sits 22px ahead of its centre */
      var nx = x - Math.sin(ang) * 18, ny = y + Math.cos(ang) * 18;
      ship.style.transform = 'translate3d(' + (nx - 17).toFixed(1) + 'px,' + (ny - 20).toFixed(1) + 'px,0) rotate(' + (ang * 57.3).toFixed(1) + 'deg) scale(' + (1 + boost * .06).toFixed(3) + ')';
      ship.style.setProperty('--fl', (0.7 + power * .45 + Math.random() * .25).toFixed(2));
      cx2.setTransform(D, 0, 0, D, 0, 0); cx2.clearRect(0, 0, innerWidth, innerHeight); cx2.globalCompositeOperation = 'lighter';
      for (var i = P2.length - 1; i >= 0; i--) {
        var p = P2[i]; p.l += dt / 16.7; p.x += p.vx; p.y += p.vy; p.vx *= .94; p.vy *= .94;
        var k = p.l / p.m; if (k >= 1) { P2[i] = P2[P2.length - 1]; P2.pop(); continue; }
        var ci = k < .15 ? 0 : k < .35 ? 1 : k < .65 ? 2 : 3;
        cx2.fillStyle = 'rgba(' + COL[ci] + ',' + (1 - k) * .55 + ')';
        cx2.beginPath(); cx2.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, 6.283); cx2.fill();
      }
      cx2.globalCompositeOperation = 'source-over';
      if (P2.length || Math.abs(x - px) + Math.abs(y - py) > .3 || Math.abs(d) > .01 || boost > .05) raf = requestAnimationFrame(loop);
      else { cx2.clearRect(0, 0, innerWidth, innerHeight); last = 0; }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    g.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY; lastMove = performance.now(); if (!seen) { seen = true; px = x; py = y; ship.style.opacity = 1; }
      var t2 = e.target && e.target.closest && e.target.closest('.popt:not([disabled]),button:not([disabled]),a,[data-hover],input');
      ship._big = !!t2; kick();
    }, { passive: true });
    g.addEventListener('pointerdown', function () { press = 1; emit(14, 2.6); kick(); }, { passive: true });
    g.addEventListener('pointerup', function () { press = 0; kick(); }, { passive: true });
    document.addEventListener('mouseleave', function () { ship.style.opacity = 0; });
    document.addEventListener('mouseenter', function () { if (seen) ship.style.opacity = 1; });
  }

  /* ---------------- 20 transitions ---------------- */
  var TX = ['wipe', 'rise', 'iris', 'slash', 'doors', 'blinds', 'chevron', 'rings', 'rays', 'glitch', 'dots', 'ripple', 'flip', 'stripes', 'swoosh',
            'scan', 'portal', 'chrome', 'warp', 'pixel'];
  var bag = [];
  function nextTx() { if (!bag.length) { bag = TX.slice(); for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; } } return bag.pop(); }
  var layer;
  function transition(label, cb, force) {
    if (!layer) { layer = document.createElement('div'); layer.className = 'fx-tx'; document.body.appendChild(layer); }
    var name = reduced ? 'fade' : (force || nextTx()), inner = '', i;
    var count = { blinds: 7, stripes: 7, rings: 4, ripple: 4, doors: 2, dots: 24, glitch: 6, rays: 12, portal: 6, warp: 28, pixel: 48 }[name] || 1;
    for (i = 0; i < count; i++) {
      var pos = name === 'dots' ? ';left:' + ((i % 6) * 20 - 4) + '%;top:' + (Math.floor(i / 6) * 28 - 6) + '%'
              : name === 'pixel' ? ';left:' + ((i % 8) * 12.5) + '%;top:' + (Math.floor(i / 8) * 16.667) + '%' : '';
      inner += '<i style="--i:' + i + ';--r:' + (Math.random() * 2 - 1).toFixed(3) + pos + '"></i>';
    }
    if (name === 'chevron') inner = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="fxg"><stop offset="0" stop-color="#A100FF"/><stop offset="1" stop-color="#00AEEF"/></linearGradient></defs><path d="M0 0 L60 0 L100 50 L60 100 L0 100 L40 50Z" fill="url(#fxg)"/></svg>';
    layer.className = 'fx-tx on tx-' + name;
    layer.innerHTML = inner + (label ? '<b class="fx-lbl">' + label + '</b>' : '');
    if (g.SFX) g.SFX.whoosh();
    setTimeout(function () { if (cb) cb(); }, reduced ? 200 : 380);
    clearTimeout(layer._t); layer._t = setTimeout(function () { layer.className = 'fx-tx'; layer.innerHTML = ''; }, reduced ? 600 : 1150);
    return name;
  }

  /* ---------------- points, coins, count-up ---------------- */
  function scorePop(x, y, txt, good) {
    var n = document.createElement('div'); n.className = 'fx-pop' + (good ? ' good' : ' bad'); n.textContent = txt;
    n.style.left = x + 'px'; n.style.top = y + 'px'; document.body.appendChild(n); setTimeout(function () { n.remove(); }, 1600);
  }
  function countUp(el, from, to, ms) {
    var t0 = performance.now(); ms = ms || 900;
    (function f(now) { var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  /* chrome coins fly on a curved path from a card to the score pill */
  function coins(fromEl, toEl, n, onArrive) {
    if (!fromEl || !toEl) { if (onArrive) onArrive(); return; }
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect(), N = reduced ? 3 : (n || 8), got = 0;
    var x0 = a.left + a.width / 2, y0 = a.top + a.height * .4, x1 = b.left + b.width * .3, y1 = b.top + b.height / 2;
    for (var i = 0; i < N; i++) (function (i) {
      var c = document.createElement('div'); c.className = 'fx-coin'; document.body.appendChild(c);
      var cxp = (x0 + x1) / 2 + (Math.random() - .5) * 160, cyp = Math.min(y0, y1) - 120 - Math.random() * 80, t0 = performance.now() + i * 40, d = 620 + Math.random() * 160;
      var sx = x0 + (Math.random() - .5) * 60, sy = y0 + (Math.random() - .5) * 30;
      (function f(now) {
        var k = (now - t0) / d; if (k < 0) { c.style.opacity = 0; requestAnimationFrame(f); return; }
        if (k >= 1) { c.remove(); if (g.SFX) g.SFX.coin(0); if (++got === N && onArrive) onArrive(); return; }
        var e = k * k * (3 - 2 * k), u = 1 - e;
        var x = u * u * sx + 2 * u * e * cxp + e * e * x1, y = u * u * sy + 2 * u * e * cyp + e * e * y1;
        c.style.opacity = 1; c.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) rotateY(' + (k * 720) + 'deg) scale(' + (1 - k * .35) + ')';
        requestAnimationFrame(f);
      })(performance.now());
    })(i);
  }

  var CSS = '' +
    'html.fx-cursor,html.fx-cursor *{cursor:none!important}' +
    '.fx-ring,.fx-dot{position:fixed;left:0;top:0;pointer-events:none;z-index:95;will-change:transform}' +
    '.fx-ship{position:fixed;left:0;top:0;z-index:2147483001;width:34px;height:40px;pointer-events:none;opacity:0;transition:opacity .2s;will-change:transform;transform-origin:17px 20px;filter:drop-shadow(0 0 6px rgba(161,0,255,.6))}' +
    '.fx-ship svg{display:block;overflow:visible}.fx-flame{transform-origin:0 17px;transform:scaleY(var(--fl,1));transition:transform .06s}' +
    '.fx-trail{position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;pointer-events:none}' +
    '.fx-tx{position:fixed;inset:0;z-index:92;pointer-events:none;overflow:hidden;display:none;perspective:900px}.fx-tx.on{display:block}' +
    '.fx-tx i{position:absolute;display:block;background:linear-gradient(115deg,#4B18A8,#A100FF 45%,#00AEEF)}' +
    '.fx-lbl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6);font:400 clamp(60px,14vw,180px)/1 Anton,Impact,sans-serif;color:#F3EEFF;' +
    'opacity:0;animation:fxl .95s cubic-bezier(.2,.8,.2,1) forwards;letter-spacing:-.01em;white-space:nowrap}' +
    '@keyframes fxl{0%{opacity:0;transform:translate(-50%,-50%) scale(1.5) rotateX(-40deg)}30%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%) scale(.92)}}' +
    '.tx-fade i{inset:0;background:#05030F;animation:fxf .6s ease forwards}@keyframes fxf{0%,100%{opacity:0}40%,60%{opacity:1}}' +
    '.tx-wipe i{inset:0;animation:fxw .9s cubic-bezier(.7,0,.3,1) forwards}@keyframes fxw{0%{transform:translateX(-101%)}45%,55%{transform:none}100%{transform:translateX(101%)}}' +
    '.tx-rise i{inset:0;animation:fxr .9s cubic-bezier(.7,0,.3,1) forwards}@keyframes fxr{0%{transform:translateY(101%)}45%,55%{transform:none}100%{transform:translateY(-101%)}}' +
    '.tx-iris i{left:50%;top:50%;width:160vmax;height:160vmax;margin:-80vmax 0 0 -80vmax;border-radius:50%;animation:fxi .95s ease-in-out forwards}@keyframes fxi{0%,100%{transform:scale(0)}45%,55%{transform:scale(1)}}' +
    '.tx-slash i{inset:-20%;animation:fxs .9s cubic-bezier(.7,0,.3,1) forwards}@keyframes fxs{0%{transform:translateX(-130%) skewX(-25deg)}45%,55%{transform:skewX(-25deg)}100%{transform:translateX(130%) skewX(-25deg)}}' +
    '.tx-doors i{top:0;bottom:0;width:50.5%}.tx-doors i:first-child{left:0;animation:fxd1 .9s ease-in-out forwards}.tx-doors i:last-child{right:0;animation:fxd2 .9s ease-in-out forwards}' +
    '@keyframes fxd1{0%,100%{transform:translateX(-101%)}45%,55%{transform:none}}@keyframes fxd2{0%,100%{transform:translateX(101%)}45%,55%{transform:none}}' +
    '.tx-blinds i,.tx-stripes i{left:0;right:0;height:calc(100%/7 + 1px);top:calc(var(--i)*100%/7);transform:scaleY(0);animation:fxb .9s ease-in-out forwards;animation-delay:calc(var(--i)*35ms)}' +
    '.tx-stripes i{transform-origin:left;animation-name:fxst}@keyframes fxb{0%,100%{transform:scaleY(0)}45%,55%{transform:scaleY(1)}}@keyframes fxst{0%,100%{transform:scaleX(0)}45%,55%{transform:scaleX(1)}}' +
    '.tx-chevron svg{position:absolute;top:0;height:100%;width:140%;left:-140%;animation:fxc .95s cubic-bezier(.7,0,.3,1) forwards}@keyframes fxc{0%{transform:none}50%{transform:translateX(85%)}100%{transform:translateX(200%)}}' +
    '.tx-rings i,.tx-ripple i{left:50%;top:50%;width:30vmax;height:30vmax;margin:-15vmax 0 0 -15vmax;border-radius:50%;background:none;border:4vmax solid #A100FF;opacity:0;animation:fxrg .9s ease-out forwards;animation-delay:calc(var(--i)*90ms)}' +
    '.tx-rings i:nth-child(even),.tx-ripple i:nth-child(odd){border-color:#00AEEF}@keyframes fxrg{0%{transform:scale(.1);opacity:1}100%{transform:scale(4.5);opacity:0}}' +
    '.tx-rays i{left:50%;top:50%;width:150vmax;height:12vmax;margin:-6vmax 0 0 0;transform-origin:0 50%;transform:rotate(calc(var(--i)*30deg)) scaleX(0);animation:fxry .9s ease-in-out forwards}' +
    '@keyframes fxry{0%,100%{transform:rotate(calc(var(--i)*30deg)) scaleX(0)}45%,55%{transform:rotate(calc(var(--i)*30deg)) scaleX(1)}}' +
    '.tx-glitch i{left:0;right:0;height:calc(100%/6 + 1px);top:calc(var(--i)*100%/6);animation:fxgl .85s steps(6) forwards}@keyframes fxgl{0%{transform:translateX(-101%)}40%,60%{transform:translateX(calc(var(--r)*3%))}100%{transform:translateX(101%)}}' +
    '.tx-dots i{width:18vmax;height:18vmax;border-radius:50%;transform:scale(0);animation:fxdt .9s ease-in-out forwards;animation-delay:calc(var(--i)*12ms)}@keyframes fxdt{0%,100%{transform:scale(0)}45%,55%{transform:scale(1.6)}}' +
    '.tx-flip i{inset:0;transform-origin:50% 50%;animation:fxfl .9s ease-in-out forwards}@keyframes fxfl{0%,100%{transform:rotateY(90deg)}45%,55%{transform:none}}' +
    '.tx-swoosh i{inset:-30%;border-radius:50%;animation:fxsw .95s cubic-bezier(.7,0,.3,1) forwards}@keyframes fxsw{0%{transform:translate(-120%,60%) scale(.6)}45%,55%{transform:none}100%{transform:translate(120%,-60%) scale(.6)}}' +
    /* 16 hologram scan */ '.tx-scan i{inset:0;background:#05030F;transform-origin:top;animation:fxsc .95s cubic-bezier(.7,0,.3,1) forwards}.tx-scan i::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:3px;background:#00AEEF;opacity:.9}' +
    '@keyframes fxsc{0%{transform:scaleY(0)}45%,55%{transform:scaleY(1)}56%{opacity:.85}58%{opacity:1}100%{transform:scaleY(0);transform-origin:bottom}}' +
    /* 17 portal swirl */ '.tx-portal i{left:50%;top:50%;width:140vmax;height:140vmax;margin:-70vmax 0 0 -70vmax;border-radius:50%;background:conic-gradient(from calc(var(--i)*60deg),#A100FF,#4B18A8,#00AEEF,#A100FF);opacity:.9;animation:fxpo .95s ease-in-out forwards;animation-delay:calc(var(--i)*25ms)}' +
    '@keyframes fxpo{0%,100%{transform:rotate(-180deg) scale(0)}45%,55%{transform:rotate(0) scale(calc(1 - var(--i)*.12))}}' +
    /* 18 liquid chrome wipe */ '.tx-chrome i{top:-20%;bottom:-20%;left:-30%;width:160%;border-radius:45%;background:linear-gradient(100deg,#2a2440,#e9e6f5 30%,#7b7598 46%,#f3eeff 60%,#2a2440);animation:fxch 1s cubic-bezier(.7,0,.3,1) forwards}' +
    '@keyframes fxch{0%{transform:translateX(-110%) scaleX(.6)}45%,55%{transform:none}100%{transform:translateX(110%) scaleX(.6)}}' +
    /* 19 warp streaks */ '.tx-warp{background:transparent}.tx-warp i{left:50%;top:50%;width:60vmax;height:2px;background:#F3EEFF;transform-origin:0 50%;opacity:0;animation:fxwp .9s ease-in forwards;animation-delay:calc(var(--i)*8ms)}' +
    '.tx-warp i:nth-child(3n){background:#A100FF}.tx-warp i:nth-child(5n){background:#00AEEF}' +
    '@keyframes fxwp{0%{opacity:0;transform:rotate(calc(var(--i)*12.86deg)) translateX(2vmax) scaleX(.05)}40%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*12.86deg)) translateX(40vmax) scaleX(1)}}' +
    '.tx-warp::before{content:"";position:absolute;inset:0;background:#05030F;animation:fxf .9s ease forwards}' +
    /* 20 pixel assemble */ '.tx-pixel i{width:calc(100%/8 + 1px);height:calc(100%/6 + 1px);transform:scale(0);animation:fxpx .9s steps(4) forwards;animation-delay:calc((var(--r) + 1)*90ms)}' +
    '@keyframes fxpx{0%,100%{transform:scale(0)}45%,55%{transform:scale(1)}}' +
    '.fx-pop{position:fixed;z-index:93;pointer-events:none;transform:translate(-50%,-50%);font:400 clamp(34px,4vw,56px)/1 Anton,Impact,sans-serif;animation:fxpp 1.5s cubic-bezier(.2,.8,.2,1) forwards}' +
    '.fx-pop.good{color:#C6FF3D}.fx-pop.bad{color:#F3EEFF;opacity:.8}' +
    '@keyframes fxpp{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}20%{opacity:1;transform:translate(-50%,-80%) scale(1.15)}70%{opacity:1;transform:translate(-50%,-140%) scale(1)}100%{opacity:0;transform:translate(-50%,-190%) scale(.9)}}' +
    '.fx-coin{position:fixed;left:0;top:0;z-index:94;width:18px;height:18px;border-radius:50%;pointer-events:none;will-change:transform;' +
    'background:conic-gradient(from 210deg,#8b85a8,#ffffff,#a9a3c4,#f3eeff,#6f6990,#ffffff,#8b85a8);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.7)}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  g.FX = { init: function () { cursor(); poppers(); }, cursor: function () { if (!document.querySelector('.fx-ship')) cursor(); }, burst: burst, cannons: cannons, rain: rain, transition: transition, scorePop: scorePop, countUp: countUp, coins: coins, TX: TX, cap: cap };
})(window);
