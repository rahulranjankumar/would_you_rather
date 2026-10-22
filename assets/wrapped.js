/* ==================================================================
   FUN FRIDAY ARENA v27 — "Your Fun Friday, Wrapped"
   100 % on the device: per-question log (localStorage, 24 h) + the
   leaderboard already received in game:over. ZERO network calls.
   6 story cards drawn with Canvas 2D at 1080×1920. Tap right = next,
   left = back. Save image (PNG) · Share (Web Share API on phones).
   ================================================================== */
(function (g) {
  'use strict';
  var W = 1080, H = 1920, cv, cx, idx = 0, cards = [], data = null, timer = 0, anim = 0, img = null, imgs = {};
  var C = { void: '#05030F', ink: '#0C0722', acn: '#A100FF', violet: '#4B18A8', cyan: '#00AEEF', lime: '#C6FF3D', pearl: '#F3EEFF', mist: 'rgba(243,238,255,.62)' };
  function $(s) { return document.querySelector(s); }

  function stats(d) {
    var log = (d.log || []).slice().sort(function (a, b) { return a.n - b.n; });
    var ans = log.filter(function (x) { return x.ch != null; }), times = ans.filter(function (x) { return x.ms != null; }).map(function (x) { return Math.max(250, x.ms); });
    var avg = times.length ? times.reduce(function (a, b) { return a + b; }, 0) / times.length : null, best = times.length ? Math.min.apply(null, times) : null;
    var wyr = ans.filter(function (x) { return !x.quiz && x.maj != null; }), rebels = wyr.filter(function (x) { return x.rebel; }).length;
    var quiz = ans.filter(function (x) { return x.quiz; }), right = quiz.filter(function (x) { return x.good; }).length;
    var streak = 0, bestStreak = 0; log.forEach(function (x) { if (x.good) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0; });
    var ranks = log.map(function (x) { return x.rank; }).filter(Boolean), climb = ranks.length > 1 ? Math.max.apply(null, ranks) - ranks[ranks.length - 1] : 0;
    var offFast = ans.filter(function (x) { return x.ms != null && x.fast != null; }).map(function (x) { return Math.max(0, x.ms - x.fast); });
    var gap = offFast.length ? offFast.reduce(function (a, b) { return a + b; }, 0) / offFast.length : null;
    var fastMe = ans.filter(function (x) { return x.fastMe; }).length, lastSec = ans.filter(function (x) { return x.ms != null && x.dur - x.ms < 3000; }).length;
    var missed = log.length - ans.length, durAvg = log.length ? log.reduce(function (a, x) { return a + (x.dur || 20000); }, 0) / log.length : 20000;
    var variance = times.length > 2 ? Math.sqrt(times.reduce(function (a, t) { return a + (t - avg) * (t - avg); }, 0) / times.length) : 1e9;
    var rebelPct = wyr.length ? Math.round(rebels / wyr.length * 100) : 0, crowdPct = wyr.length ? 100 - rebelPct : 0;
    /* titles (≥ 11), first match wins, most specific first */
    var T = [
      [missed >= 3 && missed >= log.length / 2, 'The Ghost', 'Here in spirit. Mostly.'],
      [quiz.length >= 3 && right / quiz.length >= .8, 'Quiz Whiz', 'Knew it. Every time.'],
      [bestStreak >= 5, 'Hot Streak', 'Five in a row. Legendary.'],
      [fastMe >= 2, 'Fastest Finger', 'Fastest in the room, twice over.'],
      [avg != null && avg < 2500, 'Speed Demon', 'Answers before the question finishes.'],
      [wyr.length >= 3 && rebelPct >= 50, 'Chaos Coordinator', 'The room went left. You went right.'],
      [climb >= 4, 'The Comeback Kid', 'Climbed ' + climb + ' places. Respect.'],
      [avg != null && avg > durAvg * .6 && d.final && ans.every(function (x) { return x.locked || !x.ms; }), 'Professional Overthinker', 'Slow. Deliberate. Locked in.'],
      [lastSec >= 3, 'Last-Second Legend', 'Lives for the buzzer.'],
      [wyr.length >= 3 && crowdPct >= 80, 'Team Player', 'In sync with the room.'],
      [variance < 900 && times.length >= 4, 'The Metronome', 'Same speed. Every. Single. Time.'],
      [wyr.length >= 4 && Math.abs(rebelPct - 50) <= 10, 'Coin Flipper', 'Perfectly balanced, as all things should be.'],
      [true, 'Wildcard', 'Impossible to predict. Impossible to ignore.']
    ];
    var title = T.filter(function (t) { return t[0]; })[0];
    return { log: log, avg: avg, best: best, rebelPct: rebelPct, crowdPct: crowdPct, wyrN: wyr.length, quizN: quiz.length, right: right, bestStreak: bestStreak, climb: climb, gap: gap, title: title[1], sub: title[2] };
  }

  /* ---------------- drawing helpers ---------------- */
  function bg(seed) {
    cx.fillStyle = C.void; cx.fillRect(0, 0, W, H);
    var a = cx.createRadialGradient(W * .1, H * .08, 0, W * .1, H * .08, W * 1.1); a.addColorStop(0, 'rgba(161,0,255,.45)'); a.addColorStop(1, 'rgba(161,0,255,0)');
    cx.fillStyle = a; cx.fillRect(0, 0, W, H);
    var b = cx.createRadialGradient(W * 1, H * .6, 0, W, H * .6, W * .9); b.addColorStop(0, 'rgba(0,174,239,.28)'); b.addColorStop(1, 'rgba(0,174,239,0)');
    cx.fillStyle = b; cx.fillRect(0, 0, W, H);
    // particle river baked into the card
    var r = mul(seed || 7);
    for (var i = 0; i < 520; i++) { var t = r(), x = t * W * 1.2 - W * .1, y = H - t * H * 1.1 + (r() - .5) * 340 + Math.sin(t * 9) * 120; cx.globalAlpha = .15 + r() * .4;
      cx.fillStyle = r() < .08 ? C.acn : r() < .04 ? C.cyan : C.pearl; cx.fillRect(x, y, 2 + r() * 3, 2 + r() * 3); }
    cx.globalAlpha = 1;
    // grid floor
    cx.save(); cx.globalAlpha = .18; cx.strokeStyle = C.acn; cx.lineWidth = 2;
    for (var k = 0; k < 14; k++) { var yy = H - 40 - Math.pow(k / 14, 1.8) * 520; cx.beginPath(); cx.moveTo(0, yy); cx.lineTo(W, yy); cx.stroke(); }
    for (var j = -10; j <= 10; j++) { cx.beginPath(); cx.moveTo(W / 2 + j * 60, H - 560); cx.lineTo(W / 2 + j * 260, H); cx.stroke(); }
    cx.restore();
  }
  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function text(s, x, y, font, color, align, alpha) { cx.globalAlpha = alpha == null ? 1 : alpha; cx.font = font; cx.fillStyle = color; cx.textAlign = align || 'left'; cx.textBaseline = 'alphabetic'; cx.fillText(s, x, y); cx.globalAlpha = 1; }
  function eyebrow(s, y, k) { text(s.toUpperCase(), 90, y, '500 34px "JetBrains Mono",monospace', C.mist, 'left', k); }
  function big(s, y, size, color, k) { var dy = (1 - k) * 40; text(s, 90, y + dy, '400 ' + size + 'px Anton,Impact,sans-serif', color || C.pearl, 'left', k); }
  function foot() { text('FUN FRIDAY ARENA · MADE BY PPA WARRIORS', W / 2, H - 70, '500 26px "JetBrains Mono",monospace', 'rgba(243,238,255,.5)', 'center'); }
  function glass(x, y, w, h, r) { cx.save(); round(x, y, w, h, r); cx.fillStyle = 'rgba(12,7,34,.7)'; cx.fill(); cx.strokeStyle = 'rgba(243,238,255,.18)'; cx.lineWidth = 2; cx.stroke();
    var gr = cx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(161,0,255,0)'); gr.addColorStop(.3, 'rgba(161,0,255,.9)'); gr.addColorStop(.6, 'rgba(0,174,239,.9)'); gr.addColorStop(1, 'rgba(243,238,255,0)');
    cx.fillStyle = gr; cx.fillRect(x + r, y, w - 2 * r, 2); cx.restore(); }
  function round(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  function crew(who, x, y, size, k, expr) { var key = who + (expr || 'happy'), im = imgs[key]; if (!im || !im.complete) return;
    var w = size, h = size * im.height / im.width; cx.globalAlpha = k; cx.drawImage(im, x - w / 2, y - h + (1 - k) * 60, w, h); cx.globalAlpha = 1; }
  function loadImgs(sk) {
    ['momo', 'noodle', 'bean'].forEach(function (w) { ['happy', 'smug', 'ecstatic', 'love'].forEach(function (e) {
      var im = new Image(); im.src = g.Crew.dataURL(w, { size: 600, expr: e, wave: w === sk && e === 'happy' }); im.onload = function () { draw(1); }; imgs[w + e] = im; }); });
  }
  function fmt(ms) { return ms == null ? '—' : (ms / 1000).toFixed(2) + ' s'; }

  /* ---------------- the 6 cards ---------------- */
  function buildCards(d, s) {
    var mine = d.final && d.final.mine, total = (d.final && d.final.total) || 0;
    return [
      function (k) { bg(3); eyebrow('Fun Friday · ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), 220, k);
        big('YOUR FUN', 420, 170, C.pearl, k); big('FRIDAY,', 590, 170, C.pearl, Math.max(0, k * 1.2 - .2)); big('WRAPPED', 760, 170, C.lime, Math.max(0, k * 1.4 - .4));
        text(d.name || 'You', 90, 880, '600 64px Sora,sans-serif', C.pearl, 'left', k); crew(d.sk, W / 2, 1640, 560, k, 'happy'); foot(); },
      function (k) { bg(11); eyebrow('Speed', 220, k); big(fmt(s.best), 420, 190, C.lime, k); text('your fastest answer', 90, 490, '500 40px Sora,sans-serif', C.mist, 'left', k);
        // speedometer
        var cxp = W / 2, cyp = 1060, r = 300, frac = s.avg == null ? 0 : Math.max(.05, Math.min(1, 1 - s.avg / 20000)) * k;
        cx.lineWidth = 34; cx.lineCap = 'round'; cx.strokeStyle = 'rgba(243,238,255,.1)'; cx.beginPath(); cx.arc(cxp, cyp, r, Math.PI, 0); cx.stroke();
        var gr = cx.createLinearGradient(cxp - r, 0, cxp + r, 0); gr.addColorStop(0, C.cyan); gr.addColorStop(.6, C.acn); gr.addColorStop(1, C.lime);
        cx.strokeStyle = gr; cx.beginPath(); cx.arc(cxp, cyp, r, Math.PI, Math.PI + Math.PI * frac); cx.stroke();
        text(fmt(s.avg), cxp, cyp - 40, '700 84px "JetBrains Mono",monospace', C.pearl, 'center', k); text('average', cxp, cyp + 20, '500 36px "JetBrains Mono",monospace', C.mist, 'center', k);
        if (s.gap != null) text(s.gap < 60 ? 'You WERE the room’s fastest finger.' : 'on average ' + (s.gap / 1000).toFixed(2) + ' s behind the room’s fastest finger', W / 2, 1240, '500 36px Sora,sans-serif', C.pearl, 'center', k);
        crew('noodle', W / 2, 1720, 380, k, 'smug'); foot(); },
      function (k) { bg(19); eyebrow(s.wyrN ? 'Crowd vs Rebel' : 'Quiz', 220, k);
        if (s.wyrN) { big(s.rebelPct + '% REBEL', 420, 150, s.rebelPct >= 50 ? C.lime : C.pearl, k);
          var x = 90, w = W - 180, y = 560; round(x, y, w, 70, 35); cx.fillStyle = 'rgba(243,238,255,.1)'; cx.fill();
          cx.save(); round(x, y, w * (s.crowdPct / 100) * k, 70, 35); cx.fillStyle = C.acn; cx.fill(); cx.restore();
          text('WITH THE CROWD ' + s.crowdPct + '%', x, y + 130, '500 34px "JetBrains Mono",monospace', C.pearl, 'left', k);
          text('REBEL ' + s.rebelPct + '%', x + w, y + 130, '500 34px "JetBrains Mono",monospace', C.lime, 'right', k);
          text(s.rebelPct >= 50 ? 'The room went one way. You went yours.' : 'You read the room like a pro.', 90, 860, '600 46px Sora,sans-serif', C.pearl, 'left', k);
          if (s.rebelPct >= 50) crew('noodle', W / 2, 1700, 420, k, 'smug'); else { crew('bean', W / 2 - 260, 1700, 330, k, 'ecstatic'); crew('momo', W / 2, 1700, 300, k, 'ecstatic'); crew('noodle', W / 2 + 250, 1700, 250, k, 'happy'); } }
        else { big(s.right + ' / ' + s.quizN, 420, 190, C.lime, k); text('correct answers', 90, 500, '500 40px Sora,sans-serif', C.mist, 'left', k); crew('bean', W / 2, 1700, 420, k, 'ecstatic'); }
        foot(); },
      function (k) { bg(23); eyebrow('Best streak', 220, k); big(String(s.bestStreak), 520, 340, C.lime, k);
        text(s.bestStreak === 1 ? 'in a row' : 'in a row', 90, 600, '500 44px Sora,sans-serif', C.mist, 'left', k);
        for (var i = 0; i < 5; i++) { var on = i < Math.min(5, s.bestStreak) * k; glass(90 + i * 186, 760, 160, 280, 26); if (on) { var gr = cx.createLinearGradient(0, 1040, 0, 780); gr.addColorStop(0, C.acn); gr.addColorStop(1, C.lime);
          cx.fillStyle = gr; round(110 + i * 186, 780, 120, 240, 18); cx.fill(); } }
        text(s.bestStreak >= 5 ? 'LEGENDARY' : s.bestStreak >= 3 ? 'ON FIRE' : 'WARMING UP', W / 2, 1160, '400 80px Anton,sans-serif', C.pearl, 'center', k);
        crew('momo', W / 2, 1700, 360, k, 'ecstatic'); foot(); },
      function (k) { bg(31); eyebrow('Final rank', 220, k);
        if (mine) { big('#' + Math.max(1, Math.round(mine.rank * (k < 1 ? 2 - k : 1))), 560, 360, C.pearl, k); text('of ' + (total || '—') + ' players · ' + d.score + ' pts', 90, 650, '500 42px "JetBrains Mono",monospace', C.mist, 'left', k); }
        else { big(String(d.score), 520, 300, C.pearl, k); text('points · outside the top 20 (this time)', 90, 620, '500 40px Sora,sans-serif', C.mist, 'left', k); }
        var hs = [260, 360, 200]; [1, 0, 2].forEach(function (p, i) { var x = 180 + i * 260, h = hs[p] * k; glass(x, 1500 - h, 220, h, 22); text(String(p + 1), x + 110, 1500 - h + 110, '400 90px Anton,sans-serif', p === 0 ? C.lime : C.pearl, 'center', k); });
        crew(d.sk, W / 2, 1140 - 0, 300, k, 'ecstatic'); foot(); },
      function (k) { bg(41); eyebrow('Your title', 220, k);
        var t = s.title.toUpperCase().split(' '); t.forEach(function (w, i) { big(w, 440 + i * 170, 170, i === t.length - 1 ? C.lime : C.pearl, Math.max(0, Math.min(1, k * 1.5 - i * .2))); });
        text(s.sub, 90, 470 + t.length * 170, '500 44px Sora,sans-serif', C.mist, 'left', k);
        crew('bean', W / 2 - 280, 1720, 330, k, 'ecstatic'); crew('momo', W / 2, 1720, 300, k, 'love'); crew('noodle', W / 2 + 270, 1720, 250, k, 'smug'); foot(); }
    ];
  }
  function draw(k) { if (!cards[idx]) return; cx.setTransform(1, 0, 0, 1, 0, 0); cards[idx](k == null ? 1 : k); }
  function go(i) {
    idx = Math.max(0, Math.min(cards.length - 1, i)); bar(); cancelAnimationFrame(anim);
    var t0 = performance.now(); (function f(now) { var k = Math.min(1, (now - t0) / 700); draw(1 - Math.pow(1 - k, 3)); if (k < 1) anim = requestAnimationFrame(f); })(t0);
    clearTimeout(timer); timer = setTimeout(function () { if (idx < cards.length - 1) go(idx + 1); }, 6000);
  }
  function bar() { var b = $('#wrBar'); b.innerHTML = cards.map(function (_, i) { return '<i class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"><b></b></i>'; }).join(''); }
  function open(d) {
    data = d; cv = $('#wrCv'); cx = cv.getContext('2d'); var s = stats(d); cards = buildCards(d, s);
    $('#wrapped').classList.add('on'); loadImgs(d.sk); go(0);
    if (!cv._b) { cv._b = 1;
      cv.addEventListener('click', function (e) { var r = cv.getBoundingClientRect(); go(idx + (e.clientX - r.left > r.width * .35 ? 1 : -1)); });
      $('#wrX').addEventListener('click', function () { $('#wrapped').classList.remove('on'); clearTimeout(timer); });
      $('#wrSave').addEventListener('click', function () { cv.toBlob(function (b) { var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'fun-friday-wrapped-' + (idx + 1) + '.png'; a.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); }); });
      $('#wrShare').addEventListener('click', function () { cv.toBlob(function (b) { var f = new File([b], 'fun-friday-wrapped.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'My Fun Friday, Wrapped' }).catch(function () {});
        else $('#wrSave').click(); }); });
      document.addEventListener('keydown', function (e) { if (!$('#wrapped').classList.contains('on')) return; if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); if (e.key === 'Escape') $('#wrX').click(); });
    }
    $('#wrReport').href = '/report?room=' + encodeURIComponent(d.room);
  }
  g.Wrapped = { open: open, stats: stats };
})(window);
