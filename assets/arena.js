/* ==================================================================
   FUN FRIDAY ARENA v27 — page boot helpers (all pages)
   river · mute · kinetic type · specular glass · magnetic buttons ·
   card tilt · credits easter egg · reconnect crew · clock sync ·
   local-first vote queue (jittered, batched, clamped server-side)
   ================================================================== */
(function (g) {
  'use strict';
  var PERF = g.FFAperf || { DPR: 1, tier: function () { return 'high'; }, budget: function () { return { tilt: true }; }, reduced: false, coarse: false };
  var A = {};

  /* ---------- kinetic type: split into words with a 40 ms 3D-tilt stagger ---------- */
  A.kinetic = function (el, text, delayMs) {
    if (!el) return; var t = text != null ? text : el.textContent; el.classList.add('kt'); el.setAttribute('aria-label', t);
    var words = String(t).split(/(\s+)/), k = 0, html = '';
    words.forEach(function (w) { if (/^\s+$/.test(w)) { html += ' '; return; } if (!w) return;
      html += '<span class="w" aria-hidden="true" style="--k:' + (k++) + ';--kd:' + (delayMs || 0) + 'ms">' + esc(w) + '</span>'; });
    el.innerHTML = html;
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  A.esc = esc;

  /* ---------- specular hotspot + optional 3D tilt (rAF-throttled) ---------- */
  A.glass = function (sel, opts) {
    opts = opts || {}; var raf = 0, cur = null, ev = null;
    function apply() {
      raf = 0; if (!cur || !ev) return; var r = cur.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      cur.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); cur.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      cur.style.setProperty('--irid-a', (Math.atan2(y - .5, x - .5) * 57.3).toFixed(0) + 'deg');
      if (opts.tilt && PERF.budget().tilt !== false && !PERF.reduced) {
        var max = opts.max || 8; cur.style.setProperty('--rx', ((.5 - y) * max).toFixed(2) + 'deg'); cur.style.setProperty('--ry', ((x - .5) * max).toFixed(2) + 'deg');
      }
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var t = e.target && e.target.closest && e.target.closest(sel);
      if (cur && cur !== t) { cur.style.setProperty('--rx', '0deg'); cur.style.setProperty('--ry', '0deg'); }
      cur = t; ev = e; if (t && !raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
  };

  /* ---------- magnetic buttons (pull 8 px toward the cursor within 120 px) ---------- */
  A.magnetic = function (sel) {
    if (PERF.coarse) return; var els = [].slice.call(document.querySelectorAll(sel)), raf = 0, mx = 0, my = 0;
    function f() { raf = 0; els.forEach(function (el) { var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = mx - cx, dy = my - cy, d = Math.sqrt(dx * dx + dy * dy);
      var reach = 120 + Math.max(r.width, r.height) / 2;
      if (d < reach) { var k = (1 - d / reach) * 8 / Math.max(1, d) ; el.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)'; el.classList.add('is-near'); }
      else if (el.classList.contains('is-near')) { el.style.transform = ''; el.classList.remove('is-near'); } }); }
    document.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(f); }, { passive: true });
  };

  /* ---------- mute button ---------- */
  A.mute = function () {
    if (document.querySelector('.mute-btn')) return;
    var b = document.createElement('button'); b.className = 'mute-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Toggle sound');
    b.innerHTML = '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>' +
      '<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
    b.addEventListener('click', function () { if (g.SFX) g.SFX.toggle(); });
    document.body.appendChild(b); return b;
  };

  /* ---------- credits easter egg: tap the PPA Warriors mark 3x ---------- */
  A.credits = function (sel) {
    var n = 0, t = 0;
    document.addEventListener('click', function (e) {
      var m = e.target.closest && e.target.closest(sel || '.credit-mark'); if (!m) return;
      n++; clearTimeout(t); t = setTimeout(function () { n = 0; }, 900);
      if (n >= 3) { n = 0; roll(); }
    });
    function roll() {
      var c = document.createElement('div'); c.className = 'credits';
      c.innerHTML = '<div class="credits__roll"><span>Fun Friday Arena</span><span>Directed, animated &amp; engineered by</span><b>PPA Warriors</b>' +
        '<span>Starring</span><span>Momo · The Intern</span><span>Noodle · The Senior Dev</span><span>Boss Bean · The Manager</span><span>No pixels were downscaled in the making of this game</span></div><div class="crew-band"></div>';
      document.body.appendChild(c); requestAnimationFrame(function () { c.classList.add('on'); });
      if (g.SFX) g.SFX.chime();
      var st = g.Crew && g.Crew.mount(c.querySelector('.crew-band'), { eggs: false, track: false });
      setTimeout(function () { if (st) { st.play('bow'); setTimeout(function () { st.chars.bean.sign('MADE BY PPA WARRIORS', 2600, '#C6FF3D'); }, 1600); } }, 900);
      setTimeout(function () { c.classList.remove('on'); setTimeout(function () { if (st) st.destroy(); c.remove(); }, 500); }, 6400);
      c.addEventListener('click', function () { c.classList.remove('on'); setTimeout(function () { c.remove(); }, 500); });
    }
  };

  /* ---------- connection lost: crew adjusts a satellite dish ---------- */
  var off = null, offStage = null;
  A.offline = function (on) {
    if (on) {
      if (!off) { off = document.createElement('div'); off.className = 'offline'; off.setAttribute('role', 'status');
        off.innerHTML = '<div class="crew-band"></div><b>RECONNECTING…</b>'; document.body.appendChild(off); }
      if (!off.classList.contains('on')) { off.classList.add('on');
        if (g.Crew) { if (!offStage) offStage = g.Crew.mount(off.querySelector('.crew-band'), { eggs: false, unit: .42, floorPad: 6 }); offStage.loopGroup('reconnect', 300, 600); } }
    } else if (off && off.classList.contains('on')) {
      if (offStage) { offStage.stopLoop(); offStage.play('highFive'); }
      setTimeout(function () { off.classList.remove('on'); }, 1500);
    }
  };

  /* ---------- clock sync: 3 pings, median offset ---------- */
  A.offset = 0;
  A.syncClock = function () {
    var res = [];
    function ping(i) {
      var t0 = Date.now();
      return fetch('/api/time', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { var t1 = Date.now(); res.push({ o: j.t - (t0 + t1) / 2, rtt: t1 - t0 }); })
        .catch(function () {}).then(function () { if (i < 4) return ping(i + 1); });
    }
    /* NTP-style: trust the sample with the SMALLEST round trip (a cold Render server can take
       seconds to answer, which used to skew the offset by ±3 s and keep "Reading time" on) */
    return ping(0).then(function () { if (res.length) { res.sort(function (a, b) { return a.rtt - b.rtt; }); if (res[0].rtt < 1500) A.offset = res[0].o; } try { localStorage.setItem('ffa-offset', String(A.offset)); } catch (e) {} return A.offset; });
  };
  A.offset = 0; /* never trust a stored offset from another server/session */
  A.floorOff = -1e15;
  A.serverNow = function () { return Date.now() + Math.max(A.offset, A.floorOff); };

  /* ---------- local-first vote queue ----------
     tap -> elapsed computed instantly on-device (no network wait) -> UI updates.
     Send: once after a random 150–900 ms jitter; later changes coalesced to
     ≤ 1 follow-up per second; lock-in once (jittered); flush 600 ms before
     time-up; retry with backoff; sendBeacon on page hide. */
  A.voteQueue = function (cfg) {
    var pending = null, timer = 0, inflight = false, lastSent = 0, sentOnce = false, tries = 0, endAt = 0, flushT = 0;
    function body(p) { return { r: cfg.room, p: cfg.pid, c: p.c, lock: !!p.lock, e: Math.round(p.e) }; }
    function send() {
      timer = 0; if (!pending || inflight) return;
      var p = pending; pending = null; inflight = true; lastSent = Date.now(); sentOnce = true;
      fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(p)), keepalive: true })
        .then(function (r) {
          inflight = false;
          if (r.status === 204) { tries = 0; if (cfg.onOk) cfg.onOk(p); if (pending) schedule(1000); return; }
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (j.code === 1 || j.code === 2 || j.code === 3 || j.code === 0) { if (cfg.onFail) cfg.onFail(j, p); return; }
            if (j.code === 4) { if (!pending) pending = p; schedule(400); return; }
            retry(p);
          });
        }).catch(function () { inflight = false; retry(p); });
    }
    function retry(p) { if (!pending) pending = p; tries++; schedule(Math.min(4000, 300 * Math.pow(2, tries))); }
    function schedule(ms) { clearTimeout(timer); timer = setTimeout(send, ms); }
    function put(c, e, lock) {
      pending = { c: c, e: e, lock: lock || (pending && pending.lock) };
      if (inflight) return;
      /* v27.3: spread wider. The tap time is already fixed on the device, so a later send costs
         the player nothing; it just flattens the burst. Never later than the pre-deadline flush. */
      var room = endAt ? Math.max(150, endAt - A.serverNow() - 700) : 1600;
      if (!sentOnce) schedule(150 + Math.random() * Math.min(1650, room));
      else schedule(Math.max(0, 1500 - (Date.now() - lastSent)) + (lock ? Math.random() * 600 : 0));
    }
    function arm(end) { endAt = end; clearTimeout(flushT); var ms = end - A.serverNow() - 600; flushT = setTimeout(function () { if (pending) { clearTimeout(timer); send(); } }, Math.max(0, ms)); }
    function reset() { pending = null; sentOnce = false; tries = 0; clearTimeout(timer); clearTimeout(flushT); inflight = false; }
    function beacon() { if (pending && navigator.sendBeacon) { try { navigator.sendBeacon('/api/vote', new Blob([JSON.stringify(body(pending))], { type: 'application/json' })); pending = null; } catch (e) {} } }
    document.addEventListener('visibilitychange', function () { if (document.hidden) beacon(); });
    g.addEventListener('pagehide', beacon);
    return { put: put, arm: arm, reset: reset, flush: function () { clearTimeout(timer); send(); }, pending: function () { return pending; } };
  };

  /* ---------- reaction batching (counts per 500 ms, never per tap) ---------- */
  A.reactions = function (cfg) {
    var c = [0, 0, 0, 0, 0, 0, 0, 0], t = 0;
    return function (i) { c[i]++; if (!t) t = setTimeout(function () { var b = c; c = [0, 0, 0, 0, 0, 0, 0, 0]; t = 0;
      fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r: cfg.room, p: cfg.pid, c: b }), keepalive: true }).catch(function () {}); }, 500); };
  };

  /* ---------- initials badge (no avatar picker: 400 people, 400 unique badges) ---------- */
  A.hue = function (name) { var h = 0; name = String(name || '?'); for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return h % 360; };
  A.initials = function (name, size) {
    var n = String(name || '?').trim(), parts = n.split(/\s+/), ini = (parts[0][0] || '?') + (parts[1] ? parts[1][0] : (parts[0][1] || ''));
    var h = A.hue(n), sz = size || 28;
    return '<span class="av-ini" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * .4) + 'px;background:linear-gradient(135deg,hsl(' + h + ' 85% 58%),hsl(' + ((h + 50) % 360) + ' 80% 42%));box-shadow:inset 0 1px 0 rgba(255,255,255,.35)">' + esc(ini.toUpperCase()) + '</span>';
  };
  /* ---------- haptics ---------- */
  A.buzz = function (p) { if (navigator.vibrate && PERF.coarse) try { navigator.vibrate(p); } catch (e) {} };

  /* ---------- boot ---------- */
  A.boot = function (o) {
    o = o || {};
    if (o.river !== false && g.River) g.River.mount();
    if (o.mute !== false) A.mute();
    A.credits();
    if (g.FX && o.fx !== false) g.FX.init();
    A.glass('.lg,.tilt', { tilt: false });
  };
  g.Arena = A;
})(window);
