/* BRAND INTRO — Currys mark assembles, Accenture resolves, PPA WARRIORS ignites,
   Accenture winks, lockup dissolves into particles. Skippable, once per session. */
(function () {
  const REDUCED = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const force = document.body.getAttribute('data-intro') === 'always';
  if (!force && sessionStorage.getItem('wyr_intro')) return;

  const letters = 'currys'.split('').map((ch, i) => {
    const a = Math.random() * Math.PI * 2, d = 130 + Math.random() * 170;
    return `<span class="cl" style="--tx:${(Math.cos(a) * d) | 0}px;--ty:${(Math.sin(a) * d) | 0}px;--rot:${((Math.random() * 100) - 50) | 0}deg;animation-delay:${(0.32 + i * 0.065).toFixed(2)}s">${ch}</span>`;
  }).join('');

  const o = document.createElement('div');
  o.id = 'bIntro';
  o.innerHTML = `<div class="bi-vig"></div>
    <div class="bi-lock" id="biLock">
      <div class="bi-row">
        <span class="bi-acc" id="biAcc"><img src="/assets/branding/accenture-logo.svg" alt="Accenture"
          onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bi-fb',textContent:'accenture'}))"></span>
        <span class="bi-sep" id="biSep"></span>
        <span class="bi-cur" id="biCur"><span class="bi-circ"></span><span class="bi-word">${letters}</span></span>
      </div>
      <div class="bi-ppa" id="biPpa"><span class="mb">Made by</span><span class="wr">PPA WARRIORS<span class="fire"></span></span></div>
    </div>
    <canvas id="biCv"></canvas><div class="bi-skip" id="biSkip">skip</div>`;
  document.body.appendChild(o);

  const st = document.createElement('style');
  st.textContent = `
  #bIntro{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;
    background:radial-gradient(85% 60% at 50% 42%,#1C0B38 0%,#0A0716 72%);overflow:hidden;animation:biIn .3s ease both}
  @keyframes biIn{from{opacity:0}to{opacity:1}}
  #bIntro .bi-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(52% 44% at 50% 46%,rgba(176,38,255,.2),transparent 72%)}
  #bIntro .bi-lock{position:relative;text-align:center;max-width:100%}
  #bIntro .bi-row{display:flex;align-items:center;justify-content:center;gap:clamp(14px,3vw,34px);flex-wrap:nowrap}
  #bIntro .bi-acc{position:relative;display:inline-flex;opacity:0;transform-origin:50% 62%}
  #bIntro .bi-acc img{height:clamp(24px,5.6vw,58px);width:auto;display:block;filter:drop-shadow(0 0 22px rgba(176,38,255,.5))}
  #bIntro .bi-fb{font:800 clamp(22px,5.6vw,54px)/1 Inter,sans-serif;color:#fff;letter-spacing:-.03em}
  #bIntro.play .bi-acc{animation:biPop .58s cubic-bezier(.22,1,.36,1) .88s both}
  #bIntro.play .bi-acc::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;
    background:linear-gradient(112deg,transparent 42%,rgba(255,255,255,.6) 50%,transparent 58%);
    transform:translateX(-130%);animation:biSh .9s cubic-bezier(.22,1,.36,1) 1.4s}
  @keyframes biSh{to{transform:translateX(130%)}}
  #bIntro .bi-acc.wink img,#bIntro .bi-acc.wink .bi-fb{animation:biWink .42s ease-in-out}
  @keyframes biWink{0%,100%{transform:scaleY(1)}34%{transform:scaleY(.1) scaleX(1.05)}58%{transform:scaleY(1)}74%{transform:translateY(-3px) scale(1.04)}}
  #bIntro .bi-sep{width:1px;height:clamp(22px,4vw,44px);background:rgba(198,163,255,.28);opacity:0}
  #bIntro.play .bi-sep{animation:biFade .4s ease 1.08s both}
  @keyframes biFade{to{opacity:1}}
  #bIntro .bi-cur{position:relative;width:clamp(78px,15vw,142px);height:clamp(78px,15vw,142px);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
  #bIntro .bi-circ{position:absolute;inset:0;border-radius:50%;background:radial-gradient(118% 118% at 34% 24%,#6A2BD0,#4C1D95 72%);
    box-shadow:0 18px 50px -12px rgba(76,29,149,.9),0 0 40px -8px rgba(176,38,255,.5);transform:scale(0);opacity:0}
  #bIntro.play .bi-circ{animation:biCirc .5s cubic-bezier(.34,1.5,.4,1) .1s both}
  @keyframes biCirc{0%{opacity:0;transform:scale(0) rotate(-22deg)}62%{opacity:1;transform:scale(1.1) rotate(3deg)}100%{opacity:1;transform:scale(1)}}
  #bIntro .bi-word{position:relative;z-index:1;display:flex;font:800 clamp(17px,3.4vw,32px)/1 'Trebuchet MS','Segoe UI',sans-serif;color:#fff;letter-spacing:-.04em}
  #bIntro .bi-word .cl{opacity:0;display:inline-block;will-change:transform,opacity}
  #bIntro.play .bi-word .cl{animation:biLet .42s cubic-bezier(.34,1.5,.4,1) both}
  @keyframes biLet{0%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(.3)}72%{opacity:1}100%{opacity:1;transform:none}}
  #bIntro.play .bi-word{animation:biSet .32s ease .8s both}
  @keyframes biSet{0%,100%{transform:scale(1)}42%{transform:scale(1.07)}}
  #bIntro .bi-ppa{margin-top:clamp(18px,3vw,30px);opacity:0;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap}
  #bIntro.play .bi-ppa{animation:biUp .5s cubic-bezier(.22,1,.36,1) 1.54s both}
  @keyframes biUp{0%{opacity:0;transform:translateY(7px)}100%{opacity:1;transform:none}}
  #bIntro .bi-ppa .mb{font:600 clamp(8.5px,1.4vw,11px)/1 Inter,sans-serif;color:#8B82A8;letter-spacing:.26em;text-transform:uppercase}
  #bIntro .bi-ppa .wr{position:relative;font-family:Orbitron,Inter,sans-serif;font-weight:900;font-size:clamp(11px,2vw,17px);letter-spacing:.17em;
    background:linear-gradient(0deg,#FF6A00,#FFB020 48%,#FFE9A3);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  #bIntro.play .bi-ppa .wr{animation:biEmber 2.2s ease-in-out 2s infinite}
  @keyframes biEmber{0%,100%{filter:drop-shadow(0 0 5px rgba(255,130,20,.5))}50%{filter:drop-shadow(0 0 14px rgba(255,170,40,.9))}}
  #bIntro .bi-ppa .fire{position:absolute;left:-5%;right:-5%;bottom:72%;height:20px;pointer-events:none;opacity:0;
    background:radial-gradient(closest-side at 16% 100%,#FFCF4A,rgba(255,120,0,.42) 56%,transparent 76%),
      radial-gradient(closest-side at 40% 100%,#FFE9A3,rgba(255,90,0,.42) 56%,transparent 76%),
      radial-gradient(closest-side at 62% 100%,#FFCF4A,rgba(255,120,0,.46) 56%,transparent 76%),
      radial-gradient(closest-side at 86% 100%,#FFE9A3,rgba(255,80,0,.42) 56%,transparent 76%);filter:blur(4px)}
  #bIntro.play .bi-ppa .fire{animation:biIg .34s ease 1.9s forwards,biFl .9s ease-in-out 2.24s infinite}
  @keyframes biIg{from{opacity:0;transform:scaleY(.2)}to{opacity:.88;transform:scaleY(1)}}
  @keyframes biFl{0%,100%{transform:scaleY(1);opacity:.85}28%{transform:scaleY(1.22) scaleX(.97);opacity:.98}54%{transform:scaleY(.9) scaleX(1.03);opacity:.76}}
  @keyframes biPop{0%{opacity:0;transform:translateY(12px) scale(.9);filter:blur(7px)}100%{opacity:1;transform:none;filter:blur(0)}}
  #bIntro #biCv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0}
  #bIntro .bi-skip{position:absolute;bottom:22px;right:22px;color:#6E6789;font-size:10.5px;letter-spacing:.2em;
    text-transform:uppercase;cursor:pointer;font-weight:600;opacity:0;animation:biFade .4s ease 1s forwards}
  #bIntro .bi-skip:hover{color:#A79EC4}
  #bIntro.diss .bi-lock{opacity:0;transition:opacity .1s linear}
  #bIntro.diss #biCv{opacity:1}
  #bIntro.out{animation:biOut .48s cubic-bezier(.22,1,.36,1) forwards}
  @keyframes biOut{to{opacity:0;transform:scale(1.03);filter:blur(5px);visibility:hidden}}
  @media (prefers-reduced-motion:reduce){
    #bIntro.play .bi-acc,#bIntro.play .bi-sep,#bIntro.play .bi-circ,#bIntro.play .bi-word .cl,#bIntro.play .bi-ppa{animation:none;opacity:1}
    #bIntro .bi-circ{transform:scale(1)}#bIntro .bi-ppa .fire{opacity:.85}}`;
  document.head.appendChild(st);

  const done = () => { sessionStorage.setItem('wyr_intro', '1'); o.classList.add('out'); setTimeout(() => o.remove(), 500); };
  if (REDUCED) { o.classList.add('play'); setTimeout(done, 1500); o.querySelector('#biSkip').onclick = done; return; }
  requestAnimationFrame(() => o.classList.add('play'));

  let go = false;
  const finale = () => { if (go) return; go = true; o.querySelector('#biAcc').classList.add('wink'); setTimeout(() => dissolve().then(done), 500); };
  o.querySelector('#biSkip').onclick = (e) => { e.stopPropagation(); done(); };
  o.addEventListener('click', () => (go ? done() : finale()));
  setTimeout(finale, 3000);

  function dissolve() {
    return new Promise((resolve) => {
      const lock = o.querySelector('#biLock'), cv = o.querySelector('#biCv');
      const rect = lock.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const W = o.clientWidth, H = o.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const off = document.createElement('canvas');
      off.width = Math.ceil(rect.width); off.height = Math.ceil(rect.height);
      const oc = off.getContext('2d');
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height }; };
      const img = lock.querySelector('#biAcc img');
      const p = img && img.src ? new Promise((r) => { const im = new Image(); im.onload = () => { const b = box(img); oc.drawImage(im, b.x, b.y, b.w, b.h); r(); }; im.onerror = r; im.src = img.src; }) : Promise.resolve();
      p.then(() => {
        o.classList.add('diss'); oc.textBaseline = 'top';
        lock.querySelectorAll('.bi-fb').forEach((el) => { const b = box(el); oc.fillStyle = '#fff'; oc.font = `800 ${b.h * .92}px Inter,sans-serif`; oc.fillText(el.textContent, b.x, b.y + b.h * .04); });
        const sp = lock.querySelector('#biSep'); if (sp) { const b = box(sp); oc.fillStyle = 'rgba(198,163,255,.28)'; oc.fillRect(b.x, b.y, Math.max(1, b.w), b.h); }
        const cur = lock.querySelector('#biCur');
        if (cur) { const b = box(cur), cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2;
          const g = oc.createRadialGradient(cx - r * .3, cy - r * .35, r * .2, cx, cy, r); g.addColorStop(0, '#6A2BD0'); g.addColorStop(1, '#4C1D95');
          oc.fillStyle = g; oc.beginPath(); oc.arc(cx, cy, r, 0, 6.284); oc.fill();
          oc.fillStyle = '#fff'; oc.textAlign = 'center'; oc.textBaseline = 'middle';
          oc.font = `800 ${r * .6}px 'Trebuchet MS',sans-serif`; oc.fillText('currys', cx, cy); oc.textAlign = 'left'; oc.textBaseline = 'top'; }
        const ppa = lock.querySelector('#biPpa'); if (ppa) { const b = box(ppa); oc.fillStyle = '#FFB020'; oc.font = `900 ${Math.max(8, b.h * .46)}px Orbitron,Inter,sans-serif`; oc.fillText('MADE BY PPA WARRIORS', b.x, b.y + b.h * .28); }
        run(off, rect, ctx, W, H, resolve);
      });
    });
  }
  function run(off, rect, ctx, W, H, resolve) {
    let d; try { d = off.getContext('2d').getImageData(0, 0, off.width, off.height).data; } catch (e) { return resolve(); }
    const step = W < 640 ? 5 : 4, ox = rect.left, oy = rect.top, ps = [];
    const pal = ['#fff', '#E3D4FF', '#CC66FF', '#B026FF', '#8FF5E9', '#FFB930'];
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step)
      if (d[(y * off.width + x) * 4 + 3] > 60) ps.push({ x: ox + x, y: oy + y, oy: oy + y,
        vx: .7 + Math.random() * 1.9, vy: -(.6 + Math.random() * 1.7), g: .011 + Math.random() * .012,
        s: step * (.72 + Math.random() * .55), c: pal[(Math.random() * pal.length) | 0],
        dl: (x / off.width) * 220 + Math.random() * 85, l: 0, ttl: 720 + Math.random() * 520 });
    const t0 = performance.now();
    (function f(now) {
      const el = now - t0; ctx.clearRect(0, 0, W, H); let alive = 0;
      for (let i = 0; i < ps.length; i++) { const p = ps[i];
        if (el < p.dl) { alive++; ctx.globalAlpha = 1; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); continue; }
        p.l += 16; p.vx += .025; p.vy += p.g; p.x += p.vx + Math.sin((p.oy + p.l) * .01) * .55; p.y += p.vy;
        const k = Math.max(0, 1 - p.l / p.ttl);
        if (k > 0) { alive++; ctx.globalAlpha = k; ctx.fillStyle = p.c; const s = p.s * (.6 + k * .4); ctx.fillRect(p.x, p.y, s, s); } }
      ctx.globalAlpha = 1;
      if (alive && el < 1800) requestAnimationFrame(f); else resolve();
    })(t0);
  }
})();
