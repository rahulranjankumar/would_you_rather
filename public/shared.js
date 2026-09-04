/* Shared client helpers — dependency free */

const OPT_LETTERS = ['A', 'B', 'C', 'D'];

const API = {
  async post(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return await r.json();
    } catch (e) { return { error: 'Network error — check your connection' }; }
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function connectSSE({ room, role, playerId, handlers }) {
  const params = new URLSearchParams({ room, role: role || 'player' });
  if (playerId) params.set('playerId', playerId);
  const es = new EventSource('/api/events?' + params.toString());
  const bind = (name, fn) => es.addEventListener(name, (e) => {
    let data = {}; try { data = JSON.parse(e.data); } catch (_) {}
    fn(data);
  });
  if (handlers.sync) bind('state:sync', handlers.sync);
  ['lobby:update', 'question:show', 'vote:progress', 'votes:locked',
   'results:reveal', 'leaderboard:update', 'game:over', 'game:restart'].forEach((ev) => {
    if (handlers[ev]) bind(ev, handlers[ev]);
  });
  es.onerror = () => {};
  return es;
}

function qrImageURL(text, size = 220) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&margin=0&data=' + encodeURIComponent(text);
}

function confettiBurst(n = 80) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#A100FF', '#00E0C8', '#FF4FD8', '#FFB020', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animation = `fall ${1.6 + Math.random() * 1.4}s linear forwards`;
    c.style.animationDelay = Math.random() * 0.3 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
}

function makeCountdown(onTick) {
  let raf = null, endAt = 0, dur = 1;
  function loop() {
    const remaining = Math.max(0, endAt - Date.now());
    onTick(remaining, dur);
    if (remaining > 0) raf = requestAnimationFrame(loop);
  }
  return {
    start(startedAt, durationMs) { cancelAnimationFrame(raf); dur = durationMs; endAt = startedAt + durationMs; loop(); },
    stop() { cancelAnimationFrame(raf); },
  };
}

function addBlobs() {
  const f = document.createDocumentFragment();
  ['b1', 'b2', 'b3'].forEach((c) => { const d = document.createElement('div'); d.className = 'blob ' + c; f.appendChild(d); });
  document.body.appendChild(f);
}

/* Build an option card (badge ABOVE text — no collision). */
function optionCardHTML(text, i) {
  return `<div class="opt" data-i="${i}" role="button" tabindex="0">
    <span class="tag">${OPT_LETTERS[i]}</span>
    <span class="opt-text">${esc(text)}</span>
  </div>`;
}

/* Build a results bar row. correct = index or null; showMark toggles ✓/✗ per-user. */
function resultBarHTML(text, i, pct, count, opts) {
  opts = opts || {};
  const isCorrect = opts.correct != null && opts.correct === i;
  const isWinner = (opts.winners || []).includes(i);
  const cls = isCorrect ? ' correct' : '';
  let mark = '';
  if (opts.correct != null) mark = isCorrect ? '<span class="rmark">✅</span>' : '';
  else if (isWinner) mark = '<span class="rmark">👑</span>';
  return `<div class="rbar${cls}">
    <div class="rfill i${i}" style="width:${pct}%"></div>
    <div class="rcontent">
      <span class="rtag">${OPT_LETTERS[i]}</span>
      <span class="rtext">${esc(text)}</span>
      ${mark}
      <span class="rpct">${pct}%${opts.showCounts && count != null ? ` (${count})` : ''}</span>
    </div>
  </div>`;
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
    <img src="/assets/branding/accenture-logo.svg" alt="Accenture" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'accenture',style:'font-weight:800;font-size:19px'}))">
    <span class="x">&times;</span>
    <img src="/assets/branding/currys-logo.svg" alt="Currys" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'Currys',style:'font-weight:800;font-size:19px'}))">
  </div>
  <div class="tag">Fun Friday &bull; Currys project team</div>
</div>`;

const BRAND_FOOTER = `<div class="footer">An Accenture Fun Friday activity &mdash; Currys project team \ud83c\udf89</div>`;
