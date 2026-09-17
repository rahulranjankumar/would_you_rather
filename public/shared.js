/* Shared client helpers — dependency free.
   PERF: every JS-driven effect is opt-in. play.html (600 phones) calls NONE of them. */
const L = ['A', 'B', 'C', 'D'];
const REDUCED = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SAVEDATA = navigator.connection && navigator.connection.saveData;

const API = {
  async post(p, b) { try { const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }); if (r.status === 204) return { ok: true }; return await r.json(); } catch (e) { return { error: 'Network error — check your connection' }; } },
  async get(p) { try { const r = await fetch(p); return await r.json(); } catch (e) { return { error: 'Network error' }; } },
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function connectSSE({ room, role, playerId, handlers }) {
  const q = new URLSearchParams({ room, role: role || 'player' });
  if (playerId) q.set('playerId', playerId);
  const es = new EventSource('/api/events?' + q);
  const bind = (n, fn) => es.addEventListener(n, (e) => { let d = {}; try { d = JSON.parse(e.data); } catch (_) {} fn(d); });
  if (handlers.sync) bind('state:sync', handlers.sync);
  ['lobby:update', 'question:show', 'vote:progress', 'votes:locked', 'results:reveal', 'leaderboard:update', 'game:over', 'game:restart'].forEach((ev) => { if (handlers[ev]) bind(ev, handlers[ev]); });
  es.onerror = () => {};
  return es;
}
const qrURL = (t, s) => 'https://api.qrserver.com/v1/create-qr-code/?size=' + (s || 220) + 'x' + (s || 220) + '&margin=0&data=' + encodeURIComponent(t);

/* Ambient orbs — two slow blurred shapes. Injected only where wanted. */
function addAura() {
  if (document.querySelector('.aura')) return;
  const a = document.createElement('div');
  a.className = 'aura';
  a.innerHTML = '<span class="a1"></span><span class="a2"></span>';
  document.body.appendChild(a);
}

/* Restrained celebration: a short, sparse burst. */
function shimmer(n) {
  if (REDUCED) return;
  const c = ['#CC66FF', '#B026FF', '#22F0DC', '#FFD15C', '#ffffff'];
  for (let i = 0; i < (n || 34); i++) {
    const s = document.createElement('div'); s.className = 'shard';
    const z = 2 + Math.random() * 3;
    s.style.cssText = `width:${z}px;height:${z * (2 + Math.random() * 1.4)}px;left:${Math.random() * 100}vw;background:${c[i % c.length]};opacity:${.5 + Math.random() * .4};animation:shardfall ${1.5 + Math.random() * 1.1}s cubic-bezier(.22,1,.36,1) ${Math.random() * .22}s forwards`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 3000);
  }
}
function ripple(el) {
  el.addEventListener('pointerdown', (e) => { if (REDUCED) return;
    const r = document.createElement('span'); r.className = 'ripple';
    const b = el.getBoundingClientRect(), d = Math.max(b.width, b.height) * .5;
    r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - b.left}px;top:${e.clientY - b.top}px`;
    el.appendChild(r); setTimeout(() => r.remove(), 520); });
}
function ticker(cb) {
  let raf = null;
  return { start() { cancelAnimationFrame(raf); const loop = () => { if (cb() !== false) raf = requestAnimationFrame(loop); }; loop(); }, stop() { cancelAnimationFrame(raf); } };
}
function countUp(el, to, ms) {
  if (REDUCED) { el.textContent = to + '%'; return; }
  const t0 = performance.now();
  (function f(n) { const t = Math.min(1, (n - t0) / (ms || 800)), e = 1 - Math.pow(1 - t, 3); el.textContent = Math.round(to * e) + '%'; if (t < 1) requestAnimationFrame(f); })(t0);
}
const fmtMs = (ms) => { if (ms == null) return '—'; const s = Math.floor(ms / 1000), m = ms % 1000; return s + '.' + String(m).padStart(3, '0') + 's'; };
const optCard = (t, i) => `<div class="opt" data-i="${i}" role="button" tabindex="0"><span class="tag">${L[i]}</span><span class="opt-text">${esc(t)}</span></div>`;

function resBar(text, i, pct, count, o) {
  o = o || {};
  const isC = o.correct != null && o.correct === i, isW = (o.winners || []).includes(i);
  const mark = o.correct != null ? (isC ? '<span>✓</span>' : '') : (isW ? '<span>▲</span>' : '');
  return `<div class="rbar${isC ? ' correct' : ''}" data-pct="${pct}"><div class="rfill i${i}" style="width:0%"></div>
    <div class="rc"><span class="rtag">${L[i]}</span><span class="rtext">${esc(text)}</span>${mark}<span class="rpct mono-num">0%</span></div></div>`;
}
function animBars(box) {
  box.querySelectorAll('.rbar').forEach((b, i) => { const p = parseInt(b.getAttribute('data-pct'), 10) || 0;
    setTimeout(() => { b.querySelector('.rfill').style.width = p + '%'; countUp(b.querySelector('.rpct'), p, 800); }, 80 + i * 65); });
}
function lbRows(list, quiz) {
  return (list || []).map((p) => {
    const m = String(p.rank).padStart(2, '0');
    let chips = '';
    if (p.last != null) {
      const cls = quiz ? (p.lastGood === true ? ' good' : p.lastGood === false ? ' bad' : '') : '';
      const tick = quiz ? (p.lastGood === true ? ' ✓' : p.lastGood === false ? ' ✗' : '') : '';
      chips += `<span class="chip${cls}">${L[p.last]}${tick}</span>`;
      if (p.lk) chips += '<span class="chip">🔒</span>';
      if (p.ms != null) chips += `<span class="chip time">${fmtMs(p.ms)}</span>`;
    }
    return `<div class="row"><span class="who"><span class="rank">${m}</span><span class="nm">${esc(p.name)}</span></span><span class="meta">${chips}<span class="score">${p.score}</span></span></div>`;
  }).join('') || '<div class="muted" style="font-size:13px;padding:6px 2px">No scores yet</div>';
}

/* Spline 3D robot via CDN web component — NO npm, NO build step.
   If it can't load, the stage collapses and the parent grid reflows. No placeholder shape. */
const SPLINE_SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';
let splineRequested = false;
function mountRobot(stage, scene) {
  if (!stage) return;
  stage.classList.add('robot-stage');
  if (!stage.querySelector('.glow')) { const g = document.createElement('div'); g.className = 'glow'; stage.appendChild(g); }
  const fail = () => {
    stage.classList.add('failed');
    const host = stage.closest('[data-robot-host]');
    if (host) host.classList.add('no-robot');
  };
  if (REDUCED || SAVEDATA) { fail(); return; }
  const mount = () => {
    if (!customElements.get('spline-viewer')) return fail();
    const v = document.createElement('spline-viewer');
    v.setAttribute('url', scene || SPLINE_SCENE);
    v.setAttribute('events-target', 'global');
    v.style.opacity = '0'; v.style.transition = 'opacity .9s ease';
    stage.insertBefore(v, stage.firstChild);
    v.addEventListener('load', () => {
      v.style.opacity = '1'; stage.classList.remove('failed');
      const host = stage.closest('[data-robot-host]'); if (host) host.classList.remove('no-robot');
    });
    setTimeout(() => { if (v.style.opacity === '0') fail(); }, 9000);
  };
  if (splineRequested) { customElements.whenDefined('spline-viewer').then(mount).catch(fail); return; }
  splineRequested = true;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://unpkg.com/@splinetool/viewer@1.9.28/build/spline-viewer.js';
  s.onerror = fail;
  document.head.appendChild(s);
  const guard = setTimeout(fail, 8000);
  customElements.whenDefined('spline-viewer').then(() => { clearTimeout(guard); mount(); }).catch(fail);
}

const BRAND_BAR = `<div class="brandbar">
  <div class="logos">
    <span class="logo-wrap acc"><img src="/assets/branding/accenture-logo.svg" alt="Accenture" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'accenture',style:'font-weight:800;font-size:17px'}))"></span>
    <span class="sep"></span>
    <span class="logo-wrap cur"><img src="/assets/branding/currys-logo.svg" alt="Currys" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'Currys',style:'font-weight:800;font-size:17px'}))"></span>
  </div>
  <div class="ppa">Made by PPA Warriors</div>
</div>`;
