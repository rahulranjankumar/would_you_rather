/* ============================================================
   CINEMATIC BRAND INTRO  +  PARTICLE DISSOLVE ("snap")
   Sequence:
     1) Currys purple circle pops in
     2) "currys" letters fly in from all directions & settle inside the circle
     3) Accenture wordmark + ">" draw in, with glow + light sweep
     4) Accenture WINKS 😉
     5) The whole lockup disintegrates into drifting particles (Thanos snap)
   Skippable (tap), plays once per session, tasteful fade under reduced-motion.
   Brand-safe: the Accenture asset is displayed & sampled, never redrawn.
   ============================================================ */
(function () {
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const force = document.body.getAttribute('data-intro') === 'always';
  if (!force && sessionStorage.getItem('wyr_intro_done')) return;

  const CURRYS = 'currys'.split('');
  const letterSpans = CURRYS.map((ch, i) => {
    const ang = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 220;
    const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist;
    const rot = (Math.random() * 120 - 60);
    const delay = 0.55 + i * 0.11;
    return `<span class="cl" style="--tx:${tx.toFixed(0)}px;--ty:${ty.toFixed(0)}px;--rot:${rot.toFixed(0)}deg;animation-delay:${delay}s">${ch}</span>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'brandIntro';
  overlay.innerHTML = `
    <div class="bi-vignette"></div>
    <div class="bi-lockup" id="biLockup">
      <div class="bi-logos">
        <span class="bi-logo bi-acc" id="biAcc">
          <img src="/assets/branding/accenture-logo.svg" alt="Accenture"
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bi-fallback',textContent:'accenture'}))">
        </span>
        <span class="bi-x" id="biX">&times;</span>
        <span class="bi-currys" id="biCur">
          <span class="bi-circle"></span>
          <span class="bi-word">${letterSpans}</span>
        </span>
      </div>
      <div class="bi-sub" id="biSub">Fun Friday &bull; Currys project team</div>
    </div>
    <canvas id="biCanvas"></canvas>
    <div class="bi-skip" id="biSkip">tap to skip</div>`;
  document.body.appendChild(overlay);

  const css = document.createElement('style');
  css.textContent = `
    #brandIntro{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
      background:radial-gradient(120% 90% at 50% 40%, #1a0033 0%, #0A0A0F 70%);overflow:hidden;animation:biOverlayIn .5s ease both}
    @keyframes biOverlayIn{from{opacity:0}to{opacity:1}}
    #brandIntro .bi-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 50% at 50% 45%, rgba(161,0,255,.18), transparent 70%)}
    #brandIntro .bi-lockup{position:relative;text-align:center;transform:translateZ(0);will-change:transform,opacity,filter}
    #brandIntro .bi-logos{display:flex;align-items:center;justify-content:center;gap:clamp(18px,3.4vw,40px)}

    /* Accenture */
    #brandIntro .bi-acc{position:relative;display:inline-flex;opacity:0;transform-origin:50% 60%}
    #brandIntro .bi-acc img{height:clamp(40px,7vw,72px);width:auto;display:block;filter:drop-shadow(0 6px 30px rgba(161,0,255,.55))}
    #brandIntro .bi-fallback{font:800 clamp(34px,7vw,66px)/1 'Inter','Segoe UI',sans-serif;color:#fff}
    #brandIntro.play .bi-acc{animation:biPop .9s cubic-bezier(.22,1,.36,1) 1.35s both}
    #brandIntro.play .bi-acc::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;
      background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.7) 50%,transparent 60%);
      transform:translateX(-130%);animation:biShine 1.3s cubic-bezier(.22,1,.36,1) 2.2s}
    @keyframes biShine{to{transform:translateX(130%)}}
    /* the WINK 😉 (triggered right before the snap) */
    #brandIntro .bi-acc.wink img{animation:biWink .5s ease-in-out}
    @keyframes biWink{0%,100%{transform:scaleY(1) rotate(0)}
      35%{transform:scaleY(.12) scaleX(1.05) rotate(-1deg)}  /* eye shut */
      55%{transform:scaleY(1) rotate(0)}
      70%{transform:translateY(-3px) scale(1.05)}            /* cheeky bob */ }

    /* "×" */
    #brandIntro .bi-x{color:#A100FF;font-weight:300;font-size:clamp(26px,4vw,46px);opacity:0;filter:drop-shadow(0 0 16px rgba(161,0,255,.8))}
    #brandIntro.play .bi-x{animation:biPop .7s cubic-bezier(.34,1.56,.4,1) 1.65s both}

    /* Currys assembly */
    #brandIntro .bi-currys{position:relative;width:clamp(104px,16vw,168px);height:clamp(104px,16vw,168px);display:inline-flex;align-items:center;justify-content:center}
    #brandIntro .bi-circle{position:absolute;inset:0;border-radius:50%;background:radial-gradient(120% 120% at 35% 25%, #6a2bd0, #4C1D95 70%);
      box-shadow:0 14px 50px rgba(76,29,149,.65), inset 0 2px 14px rgba(255,255,255,.18), 0 0 0 1px rgba(255,255,255,.06);
      transform:scale(0);opacity:0}
    #brandIntro.play .bi-circle{animation:curCircle .75s cubic-bezier(.34,1.56,.4,1) .2s both}
    @keyframes curCircle{0%{opacity:0;transform:scale(0) rotate(-25deg)}60%{opacity:1;transform:scale(1.14) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
    #brandIntro .bi-word{position:relative;z-index:1;display:flex;font:800 clamp(24px,3.6vw,38px)/1 'Trebuchet MS','Segoe UI',Arial,sans-serif;color:#fff;letter-spacing:-1px}
    #brandIntro .bi-word .cl{opacity:0;display:inline-block;will-change:transform,opacity;text-shadow:0 1px 6px rgba(0,0,0,.25)}
    #brandIntro.play .bi-word .cl{animation:curLetter .62s cubic-bezier(.34,1.56,.4,1) both}
    @keyframes curLetter{0%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(.3)}
      70%{opacity:1}100%{opacity:1;transform:none}}
    /* little settle bounce of the whole word once assembled */
    #brandIntro.play .bi-word{animation:curSettle .5s ease 1.25s both}
    @keyframes curSettle{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}

    #brandIntro .bi-sub{margin-top:clamp(16px,2.6vw,28px);color:#c8bfe6;letter-spacing:.35em;text-transform:uppercase;font-size:clamp(10px,1.6vw,14px);font-weight:600;opacity:0}
    #brandIntro.play .bi-sub{animation:biSub 1s cubic-bezier(.22,1,.36,1) 1.9s both}
    @keyframes biPop{0%{opacity:0;transform:translateY(16px) scale(.86);filter:blur(10px)}100%{opacity:1;transform:none;filter:blur(0)}}
    @keyframes biSub{0%{opacity:0;letter-spacing:.55em;transform:translateY(8px)}100%{opacity:.95;letter-spacing:.35em;transform:none}}

    #brandIntro #biCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0}
    #brandIntro .bi-skip{position:absolute;bottom:26px;right:28px;color:#8b86a6;font-size:12px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;opacity:0;animation:biSkipIn .5s ease 1.6s forwards}
    @keyframes biSkipIn{to{opacity:.6}}
    #brandIntro.dissolving .bi-lockup{opacity:0;transition:opacity .12s linear}
    #brandIntro.dissolving #biCanvas{opacity:1}
    #brandIntro.out{animation:biOut .7s cubic-bezier(.22,1,.36,1) forwards}
    @keyframes biOut{to{opacity:0;transform:scale(1.04);filter:blur(6px);visibility:hidden}}
    @media (prefers-reduced-motion: reduce){
      #brandIntro.play .bi-acc,#brandIntro.play .bi-x,#brandIntro.play .bi-circle,#brandIntro.play .bi-word .cl,#brandIntro.play .bi-sub{animation:none;opacity:1}
      #brandIntro .bi-circle{transform:scale(1)}
    }`;
  document.head.appendChild(css);

  const done = () => { sessionStorage.setItem('wyr_intro_done', '1'); overlay.classList.add('out'); setTimeout(() => overlay.remove(), 750); };

  if (REDUCED) { overlay.classList.add('play'); setTimeout(done, 1900); overlay.querySelector('#biSkip').onclick = done; return; }

  requestAnimationFrame(() => overlay.classList.add('play'));

  let started = false;
  const runFinale = () => {
    if (started) return; started = true;
    // Accenture winks first, THEN the snap dissolve
    const acc = overlay.querySelector('#biAcc');
    acc.classList.add('wink');
    setTimeout(() => dissolve(overlay).then(done), 620);
  };
  overlay.querySelector('#biSkip').onclick = done;
  overlay.addEventListener('click', (e) => { if (e.target.id === 'biSkip') return; started ? done() : runFinale(); });

  // Timeline: circle+letters (~1.3s) → accenture in (~1.35s) → shine/sub → hold → wink → snap
  setTimeout(runFinale, 3500);

  /* ---- Particle disintegration ---- */
  function dissolve(overlay) {
    return new Promise((resolve) => {
      const lockup = overlay.querySelector('#biLockup');
      const canvas = overlay.querySelector('#biCanvas');
      const rect = lockup.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = overlay.clientWidth, H = overlay.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

      const off = document.createElement('canvas');
      off.width = Math.ceil(rect.width); off.height = Math.ceil(rect.height);
      const octx = off.getContext('2d');
      const boxOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height }; };

      // 1) Accenture: draw its rendered asset (or text fallback)
      const accImg = lockup.querySelector('#biAcc img');
      const loads = [];
      if (accImg && accImg.src) loads.push(new Promise((res) => { const im = new Image(); im.onload = () => { octx.drawImage(im, ...Object.values(boxOf(accImg)).slice(0, 2), boxOf(accImg).w, boxOf(accImg).h); res(); }; im.onerror = res; im.src = accImg.src; }));

      Promise.all(loads).then(() => {
        overlay.classList.add('dissolving'); // hand off DOM → canvas seamlessly

        // accenture text fallback (if image failed)
        lockup.querySelectorAll('#biAcc .bi-fallback').forEach((el) => { const b = boxOf(el); octx.fillStyle = '#fff'; octx.font = `800 ${b.h * 0.92}px Inter, sans-serif`; octx.textBaseline = 'top'; octx.fillText(el.textContent, b.x, b.y + b.h * 0.04); });

        // 2) "×"
        const xEl = lockup.querySelector('#biX'); if (xEl) { const b = boxOf(xEl); octx.fillStyle = '#A100FF'; octx.font = `300 ${b.h * 0.9}px Inter, sans-serif`; octx.textBaseline = 'top'; octx.fillText('×', b.x + b.w * 0.12, b.y + b.h * 0.05); }

        // 3) Currys: draw the purple circle + white "currys" (the stylized placeholder)
        const cur = lockup.querySelector('#biCur');
        if (cur) {
          const b = boxOf(cur); const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2;
          const grad = octx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
          grad.addColorStop(0, '#6a2bd0'); grad.addColorStop(1, '#4C1D95');
          octx.fillStyle = grad; octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.fill();
          octx.fillStyle = '#fff'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
          octx.font = `800 ${r * 0.62}px 'Trebuchet MS', 'Segoe UI', sans-serif`;
          octx.fillText('currys', cx, cy + r * 0.02);
          octx.textAlign = 'left';
        }

        // 4) subtitle
        const sub = lockup.querySelector('#biSub'); if (sub) { const b = boxOf(sub); octx.fillStyle = 'rgba(200,191,230,.95)'; octx.textBaseline = 'top'; octx.font = `600 ${Math.max(9, b.h * 0.7)}px Inter, sans-serif`; octx.fillText(sub.textContent.trim(), b.x, b.y + b.h * 0.1); }

        sampleAndAnimate(off, rect, ctx, W, H, resolve);
      });
    });
  }

  function sampleAndAnimate(off, rect, ctx, W, H, resolve) {
    let data; try { data = off.getContext('2d').getImageData(0, 0, off.width, off.height).data; } catch (e) { return resolve(); }
    const isMobile = W < 640; const step = isMobile ? 5 : 4;
    const ox = rect.left, oy = rect.top; const parts = [];
    const palette = ['#ffffff', '#e9d5ff', '#C766FF', '#A100FF', '#9ff5ec', '#8b5cf6'];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] > 60) {
          const px = ox + x, py = oy + y;
          parts.push({ x: px, y: py, oy: py, vx: 0.6 + Math.random() * 1.8, vy: -(0.5 + Math.random() * 1.6), g: 0.008 + Math.random() * 0.01,
            size: step * (0.75 + Math.random() * 0.6), color: palette[(Math.random() * palette.length) | 0],
            delay: (x / off.width) * 320 + Math.random() * 120, life: 0, ttl: 900 + Math.random() * 700 });
        }
      }
    }
    const t0 = performance.now(), maxDelay = 460;
    function frame(now) {
      const elapsed = now - t0; ctx.clearRect(0, 0, W, H); let alive = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (elapsed < p.delay) { alive++; ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); continue; }
        p.life += 16; p.vx += 0.02; p.vy += p.g; p.x += p.vx + Math.sin((p.oy + p.life) * 0.01) * 0.6; p.y += p.vy;
        const k = Math.max(0, 1 - p.life / p.ttl);
        if (k > 0) { alive++; ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size * (0.6 + k * 0.4), p.size * (0.6 + k * 0.4)); }
      }
      ctx.globalAlpha = 1;
      if (alive > 0 && elapsed < maxDelay + 1800) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  }
})();
