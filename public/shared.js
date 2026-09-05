/* Shared client helpers — dependency free, premium tier */
const OPT_LETTERS = ['A', 'B', 'C', 'D'];
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const API = {
  async post(path, body) {
    try { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return await r.json(); }
    catch (e) { return { error: 'Network error — check your connection' }; }
  },
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function connectSSE({ room, role, playerId, handlers }) {
  const params = new URLSearchParams({ room, role: role || 'player' });
  if (playerId) params.set('playerId', playerId);
  const es = new EventSource('/api/events?' + params.toString());
  const bind = (n, fn) => es.addEventListener(n, (e) => { let d = {}; try { d = JSON.parse(e.data); } catch (_) {} fn(d); });
  if (handlers.sync) bind('state:sync', handlers.sync);
  ['lobby:update', 'question:show', 'vote:progress', 'votes:locked', 'results:reveal', 'leaderboard:update', 'game:over', 'game:restart'].forEach((ev) => { if (handlers[ev]) bind(ev, handlers[ev]); });
  es.onerror = () => {};
  return es;
}

function qrImageURL(text, size = 220) { return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&margin=0&data=' + encodeURIComponent(text); }

/* Aurora liquid background (injected once). */
function addAurora() {
  if (document.querySelector('.aurora')) return;
  const a = document.createElement('div');
  a.className = 'aurora';
  a.innerHTML = '<span class="o1"></span><span class="o2"></span><span class="o3"></span><span class="o4"></span>';
  document.body.appendChild(a);
}

/* Elegant shimmer particles (premium, not cheap confetti). */
function shimmerBurst(n = 60, opts) {
  if (REDUCED) return;
  opts = opts || {};
  const colors = opts.colors || ['#A100FF', '#C766FF', '#00E6D2', '#FFCE4A', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'shard';
    const size = 3 + Math.random() * 4;
    s.style.width = size + 'px'; s.style.height = (size * (1.6 + Math.random())) + 'px';
    s.style.left = (opts.originX != null ? opts.originX + (Math.random() * 40 - 20) : Math.random() * 100) + (opts.originX != null ? 'vw' : 'vw');
    s.style.color = colors[i % colors.length];
    s.style.background = 'currentColor';
    s.style.animation = `shardfall ${1.7 + Math.random() * 1.6}s cubic-bezier(.22,1,.36,1) forwards`;
    s.style.animationDelay = (Math.random() * 0.35) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3800);
  }
}

/* Spring tap ripple on option cards. */
function attachRipple(el) {
  el.addEventListener('pointerdown', (e) => {
    if (REDUCED) return;
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = el.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height) * 0.5;
    r.style.width = r.style.height = d + 'px';
    r.style.left = (e.clientX - rect.left) + 'px';
    r.style.top = (e.clientY - rect.top) + 'px';
    el.appendChild(r);
    setTimeout(() => r.remove(), 620);
  });
}

/* Server-timestamp countdown. */
function makeCountdown(onTick) {
  let raf = null, endAt = 0, dur = 1;
  function loop() { const remaining = Math.max(0, endAt - Date.now()); onTick(remaining, dur); if (remaining > 0) raf = requestAnimationFrame(loop); }
  return { start(startedAt, durationMs) { cancelAnimationFrame(raf); dur = durationMs; endAt = startedAt + durationMs; loop(); }, stop() { cancelAnimationFrame(raf); } };
}

/* Odometer / roll count-up for percentages. */
function countUp(el, to, ms) {
  if (REDUCED) { el.textContent = to + '%'; return; }
  const start = performance.now(); const from = 0;
  function f(now) {
    const t = Math.min(1, (now - start) / (ms || 900));
    const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(from + (to - from) * e) + '%';
    if (t < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

/* Option card (badge above text — no collision). */
function optionCardHTML(text, i) {
  return `<div class="opt" data-i="${i}" role="button" tabindex="0"><span class="tag">${OPT_LETTERS[i]}</span><span class="opt-text">${esc(text)}</span></div>`;
}

/* Liquid-fill result bar. Returns HTML; call animateResultBars() after inserting. */
function resultBarHTML(text, i, pct, count, opts) {
  opts = opts || {};
  const isCorrect = opts.correct != null && opts.correct === i;
  const isWinner = (opts.winners || []).includes(i);
  const cls = isCorrect ? ' correct' : '';
  let mark = '';
  if (opts.correct != null) mark = isCorrect ? '<span class="rmark">✅</span>' : '';
  else if (isWinner) mark = '<span class="rmark">👑</span>';
  return `<div class="rbar${cls}" data-pct="${pct}">
    <div class="rfill i${i}" style="width:0%"></div>
    <div class="rcontent"><span class="rtag">${OPT_LETTERS[i]}</span><span class="rtext">${esc(text)}</span>${mark}
      <span class="rpct" data-to="${pct}">0%</span></div></div>`;
}
/* Animate the liquid fill + odometer after the rows are in the DOM. */
function animateResultBars(container) {
  container.querySelectorAll('.rbar').forEach((bar, idx) => {
    const pct = parseInt(bar.getAttribute('data-pct'), 10) || 0;
    const fill = bar.querySelector('.rfill');
    const pctEl = bar.querySelector('.rpct');
    setTimeout(() => { fill.style.width = pct + '%'; countUp(pctEl, pct, 950); }, 120 + idx * 90);
  });
}

function leaderboardRowsHTML(list) {
  return (list || []).map((p) => {
    const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : ('#' + p.rank);
    return `<div class="row"><span class="who"><span class="rank">${medal}</span><span class="nm">${esc(p.name)}</span></span><span class="score">${p.score}</span></div>`;
  }).join('') || '<div class="muted">No scores yet</div>';
}

const BRAND_BAR = `
<div class="brandbar glass">
  <div class="logos">
    <span class="logo-wrap acc-hi"><span class="acc-halo"></span><img src="/assets/branding/accenture-logo.svg" alt="Accenture" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'accenture',style:'font-weight:800;font-size:19px'}))"></span>
    <span class="x">&times;</span>
    <span class="logo-wrap currys-lg"><img src="/assets/branding/currys-logo.svg" alt="Currys" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'Currys',style:'font-weight:800;font-size:19px'}))"></span>
  </div>
  <div class="tag">Fun Friday &bull; Currys project team</div>
</div>`;
const BRAND_FOOTER = `<div class="footer">An Accenture Fun Friday activity &mdash; Currys project team \ud83c\udf89</div>`;
