/* =====================================================================
   PANEL — browse & play every v29 trio scene on our characters
   Keys: Space play/pause · ←/→ prev/next · L loop · A auto · S sound · H hide panel
   ===================================================================== */
(() => {
const B = window.Bridge;
const css = `
#ap{position:fixed;left:14px;top:12px;bottom:40px;width:300px;z-index:20;display:flex;flex-direction:column;gap:8px;
  background:rgba(14,14,20,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);
  border-radius:16px;padding:12px;font:13px "Segoe UI",system-ui,sans-serif;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.45);transition:transform .3s,opacity .3s}
#ap.hide{transform:translateX(-330px);opacity:0}
#ap h3{margin:0;font-size:14px;font-weight:600;letter-spacing:.02em;display:flex;justify-content:space-between;align-items:center}
#ap h3 small{opacity:.5;font-weight:400}
#ap .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#ap button,#ap select{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:5px 9px;font:inherit;cursor:pointer}
#ap button:hover{background:rgba(255,255,255,.16)}
#ap button.on{background:#5b8cff;border-color:#5b8cff}
#ap select option{color:#000}
#ap .cast{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;font-size:12px}
#ap .tabs{display:flex;gap:4px;flex-wrap:wrap}
#ap .tabs button{padding:3px 8px;font-size:12px}
#ap .list{flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px;padding-right:4px}
#ap .list button{text-align:left;display:flex;justify-content:space-between;border-radius:8px}
#ap .list button span{opacity:.45;font-size:11px}
#ap .list button.on{background:#ff8a3d;border-color:#ff8a3d}
#ap .bar{height:5px;background:rgba(255,255,255,.12);border-radius:3px;cursor:pointer;position:relative}
#ap .bar i{position:absolute;left:0;top:0;bottom:0;background:#5b8cff;border-radius:3px}
#ap .now{font-size:12px;opacity:.75;min-height:16px}
#apBtn{position:fixed;left:14px;top:12px;z-index:19;background:rgba(14,14,20,.7);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:6px 10px;cursor:pointer;font-size:13px}
.hint{left:auto!important;right:18px;bottom:28px!important}
@media (max-width:700px){#ap{width:auto;right:14px;top:auto;height:46vh}#ap.hide{transform:translateY(60vh)}}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
const KINDS = {astro:'Astronaut', jelly:'Jelly', muse:'Muse (yeti)', fox:'Fox'};
const ap = document.createElement('div'); ap.id='ap';
ap.innerHTML = `
<h3>v29 Crew Moves <small>${B.scenes().length} scenes</small></h3>
<div class="cast">${B.SLOTS.map(s=>`<span>${B.SLOT_NAME[s]}</span><select data-slot="${s}">${Object.keys(KINDS).map(k=>`<option value="${k}" ${B.CAST[s]===k?'selected':''}>${KINDS[k]}</option>`).join('')}</select>`).join('')}</div>
<div class="cast"><span>4th: <b id="pX"></b></span><select id="pMix"><option value="join">Joins in every scene</option><option value="mix">Mixed moves (auto)</option>${B.scenes().filter(n=>!['wave','cheer','bow','dish','chillNudge','yawn','trenchcoat','piggyback','rps'].includes(n)).map(n=>`<option value="${n}">Mix: ${n}</option>`).join('')}</select>
<span>…mix role</span><select id="pXs"><option value="auto">Auto</option>${B.SLOTS.map(s=>`<option value="${s}">${B.SLOT_NAME[s]}</option>`).join('')}</select></div>
<div class="row"><button id="pPlay">⏸</button><button id="pStop">■</button><button id="pPrev">◀</button><button id="pNext">▶</button>
<select id="pSpeed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>
<div class="row"><button id="pLoop">Loop</button><button id="pAuto">Auto-play</button><button id="pAll">Play all</button><button id="pSnd">🔊</button></div>
<div class="bar" id="pBar"><i></i></div>
<div class="now" id="pNow">Idle — pick a scene</div>
<div class="tabs" id="pTabs"></div>
<div class="list" id="pList"></div>`;
document.body.appendChild(ap);
const btn = document.createElement('button'); btn.id='apBtn'; btn.textContent='☰ Moves'; document.body.appendChild(btn);
btn.onclick=()=>ap.classList.toggle('hide');

const G = B.groups(), ALL = B.scenes();
const TABS = { All:ALL, Rocket:G.rocket, Revenge:G.revenge, Chaos:G.chaos, Team:G.team, Contest:G.contest, Finish:G.finish, Dance:G.dance, Chill:G.chill,
  Reactions:['yay','cheer','sad','wave','highFive','bow','dish','danceParty','groupHug'] };
let tab='All', list=ALL, playAll=false;
const $=id=>ap.querySelector('#'+id);
function dur(n){ return (Crew.SCENES[n]||{}).d||0; }
function renderTabs(){ $('pTabs').innerHTML=Object.keys(TABS).map(t=>`<button class="${t===tab?'on':''}" data-t="${t}">${t}</button>`).join(''); }
function renderList(){ list=TABS[tab].filter(n=>Crew.SCENES[n]);
  $('pList').innerHTML=list.map(n=>`<button data-n="${n}" class="${B.cur===n?'on':''}">${n}<span>${dur(n).toFixed(1)}s</span></button>`).join(''); }
renderTabs(); renderList();
$('pTabs').onclick=e=>{ const t=e.target.dataset.t; if (!t) return; tab=t; renderTabs(); renderList(); };
$('pList').onclick=e=>{ const b=e.target.closest('button'); if (!b) return; playAll=false; $('pAll').classList.remove('on'); B.paused=false; B.play(b.dataset.n); };
ap.querySelectorAll('select[data-slot]').forEach(sel=>sel.onchange=()=>{ B.setCast(sel.dataset.slot, sel.value); ap.querySelectorAll('select[data-slot]').forEach(x=>x.value=B.CAST[x.dataset.slot]); xn(); });
const xn=()=>$('pX').textContent=KINDS[B.extraKind()]; xn();
$('pMix').onchange=$('pXs').onchange=()=>B.setMix($('pMix').value,$('pXs').value);
const step=d=>{ const i=list.indexOf(B.cur); const n=list[(i<0?0:(i+d+list.length)%list.length)]; B.paused=false; B.play(n); };
$('pPlay').onclick=()=>{ B.paused=!B.paused; };
$('pStop').onclick=()=>{ playAll=false; B.loop=false; B.auto=false; syncBtns(); B.stop(); };
$('pPrev').onclick=()=>step(-1); $('pNext').onclick=()=>step(1);
$('pSpeed').onchange=e=>B.speed=+e.target.value;
$('pLoop').onclick=()=>{ B.loop=!B.loop; if (B.loop){ B.auto=false; playAll=false; } syncBtns(); };
$('pAuto').onclick=()=>{ B.auto=!B.auto; if (B.auto){ B.loop=false; playAll=false; } syncBtns(); };
$('pAll').onclick=()=>{ playAll=!playAll; if (playAll){ B.loop=false; B.auto=false; B.paused=false; B.play(list[0]); } syncBtns(); };
$('pSnd').onclick=()=>{ if (window.SFX){ SFX.toggle(); } syncBtns(); };
function syncBtns(){ $('pLoop').classList.toggle('on',B.loop); $('pAuto').classList.toggle('on',B.auto); $('pAll').classList.toggle('on',playAll);
  $('pSnd').textContent = window.SFX && SFX.muted() ? '🔇' : '🔊'; }
syncBtns();
$('pBar').onclick=e=>{ const r=e.currentTarget.getBoundingClientRect(), d=B.dur(); if (d) { B.seek((e.clientX-r.left)/r.width*d); B.refresh(); } };
B.onScene=n=>{ ap.querySelectorAll('#pList button').forEach(b=>b.classList.toggle('on',b.dataset.n===n));
  if (!n && playAll){ const i=list.indexOf(lastN); if (i>=0 && i<list.length-1) setTimeout(()=>B.play(list[i+1]),350); else { playAll=false; syncBtns(); } }
  if (n) lastN=n; };
let lastN=null;
(function ui(){ const d=B.dur(); $('pBar').firstElementChild.style.width = d ? Math.min(100,B.clock/d*100)+'%' : '0';
  $('pNow').textContent = B.cur ? `${B.paused?'Paused':'Playing'}: ${B.cur}  ${B.clock.toFixed(1)} / ${d.toFixed(1)}s` + (B.EX.mode==='mix'&&B.EX.cur?`  ·  ${KINDS[B.extraKind()]}: ${B.EX.cur} (as ${B.EX.curSlot})`:`  ·  ${KINDS[B.extraKind()]} joins in`) : 'Idle — pick a scene';
  $('pPlay').textContent = B.paused ? '▶' : '⏸'; requestAnimationFrame(ui); })();
addEventListener('keydown',e=>{ if (e.target.tagName==='SELECT') return;
  if (e.code==='Space'){ e.preventDefault(); B.paused=!B.paused; }
  else if (e.key==='ArrowRight') step(1); else if (e.key==='ArrowLeft') step(-1);
  else if (e.key==='l'||e.key==='L') $('pLoop').click(); else if (e.key==='a'||e.key==='A') $('pAuto').click();
  else if (e.key==='s'||e.key==='S') $('pSnd').click(); else if (e.key==='h'||e.key==='H') ap.classList.toggle('hide'); });
// first gesture unlocks audio for v29 SFX
addEventListener('pointerdown',()=>{ try{ SFX && SFX.click && 0; }catch(e){} },{once:true});
})();

