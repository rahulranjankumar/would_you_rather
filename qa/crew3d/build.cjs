/* Builds assets/crew3d.js — the v30 three.js crew (Astro · Jelly · Muse).
   Sources: qa/crew3d/src (extracted from the lab file) + qa/crew3d/band.js (v30 compositor).
   Every patch is an exact match and is asserted, so a changed source fails loudly.
   Run: node qa/crew3d/build.cjs        Made by PPA Warriors */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, 'src');
const rd = (f) => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n');
let fails = 0;
function rep(name, src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('PATCH FAIL', name, 'matches=' + n); fails++; return src; }
  return src.replace(from, () => to);
}
function cut(name, src, startMark, endMark, keepEnd, insert) {
  const a = src.indexOf(startMark); const b = a < 0 ? -1 : src.indexOf(endMark, a + startMark.length);
  if (a < 0 || b < 0) { console.error('CUT FAIL', name, a, b); fails++; return src; }
  return src.slice(0, a) + (insert || '') + (keepEnd ? src.slice(b) : src.slice(b + endMark.length));
}

/* ---------------- core ---------------- */
let core = rd('js_core.js');
core = rep('core.testflag', core, "if (P.has('t')) {", "if (P.has('crewt')) {");
core = rep('core.dpr', core, 'const DPR = Math.min(window.devicePixelRatio || 1, 2);',
  'const DPR = (window.FFAperf && +window.FFAperf.DPR) || Math.min(window.devicePixelRatio || 1, 2);');
core = rep('core.renderer', core, "const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });",
  "const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });\nrenderer.setClearColor(0x000000, 0);");
core = rep('core.canvas', core, 'document.body.prepend(renderer.domElement);',
  "renderer.domElement.className = 'crew3d'; renderer.domElement.setAttribute('aria-hidden', 'true'); renderer.domElement.setAttribute('data-crew', 'three');\n" +
  "renderer.domElement.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:8';\n" +
  'document.body.appendChild(renderer.domElement);');
core = rep('core.bg', core, 'scene.background = new T.Color(0x000000);', 'scene.background = null;   // v30: transparent band over the page');
core = rep('core.fov', core, 'const camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);',
  'const camera = new T.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 100);');
core = rep('core.furq.decl', core, 'const furTime = { value: 0 };',
  'const furTime = { value: 0 };\nlet FUR_Q = 1;   /* v30: fur shell budget per perf tier (band.js sets it before the crew is built) */');
core = rep('core.furq.use', core, 'const N = o.shells || 24; const FU = FUR_U;',
  'const N = Math.max(6, Math.round((o.shells || 24) * FUR_Q)); const FU = FUR_U;');

/* ---------------- chars (no fox) ---------------- */
let chars = rd('js_chars.js');
{
  const i4 = chars.indexOf('   4) FOX'), a = chars.lastIndexOf('/* ====', i4);
  const iS = chars.indexOf('   SOCKETS'), b = chars.lastIndexOf('/* ====', iS);
  if (i4 < 0 || a < 0 || iS < 0 || b < 0 || b <= a) { console.error('CUT FAIL chars.fox', i4, a, iS, b); fails++; }
  else chars = chars.slice(0, a) + chars.slice(b);
}
chars = rep('chars.sockfox', chars,
  "  fox:  { headTop:['head',0,0.34,0], face:['head',0,-0.04,0.48], back:['body',0,0.62,-0.3], belly:['body',0,0.5,0.34], seat:['head',0,0.34,0],\n          chest:['body',0,0.72,0.3], tailTip:['tail',0.5,0.76,0.08] },\n", '');

/* ---------------- engine ---------------- */
let eng = rd('js_engine.js');
eng = rep('eng.stats', eng, "const statsOn = P.has('t') || P.has('stats');", "const statsOn = P.has('crewt') || P.has('crewstats');");
eng = rep('eng.proffox', eng, "  fox:  {hw:0.34,hd:0.30,H:1.45,com:0.62, rest:0.30, style:'trot',  ease:'outBack',    mass:0.6, crouch:0.035,impact:'thud'},\n", '');

/* ---------------- anim ---------------- */
let anim = rd('js_anim.js');
anim = rep('anim.test', anim, "const TEST = P.has('t');", "const TEST = P.has('crewt');");
anim = rep('anim.kix', anim, 'const KIND_IX={jelly:0,astro:1,muse:2,fox:3};', 'const KIND_IX={jelly:0,astro:1,muse:2};');
anim = rep('anim.pitch', anim, 'const PITCH={jelly:520, astro:380, muse:260, fox:450};', 'const PITCH={jelly:520, astro:380, muse:260};');
anim = rep('anim.audio.listeners', anim,
  "  addEventListener('pointerdown',init,{once:false}); addEventListener('keydown',e=>{ init(); if (e.key==='m'||e.key==='M') toggle(); });\n",
  "  /* v30: no global listeners; respects the app-wide SFX mute; created lazily */\n" +
  "  function ready(){ if (TEST) return false; if (window.SFX && window.SFX.muted && window.SFX.muted()) return false; if (!ac) init(); if (!ac) return false;\n" +
  "    if (ac.state==='suspended'){ try{ ac.resume(); }catch(e){} return false; } return !muted; }\n");
anim = rep('anim.audio.say', anim, 'function say(who,n,pm=1){ if (!ac||muted) return;', 'function say(who,n,pm=1){ if (!ready()) return;');
anim = rep('anim.audio.sfx', anim, 'function sfx(name,a){ if (!ac||muted) return;', 'function sfx(name,a){ if (!ready()) return;');
anim = rep('anim.ikclear', anim,
  '    if (s.wA<1e-3 && !(D.clip && D.clip.castIx.includes(s.ci))){ a.fill(0); s.ikW.fill(0); s.attNow=null; }',
  '    if (s.wA<1e-3 && !s.ikFree && !(D.clip && D.clip.castIx.includes(s.ci))){ a.fill(0); s.ikW.fill(0); s.attNow=null; }');
anim = rep('anim.ikw', anim, '  for (let li=0;li<4;li++){ const wi=s.ikW[li]*w;', '  for (let li=0;li<4;li++){ const wi=s.ikW[li]*(s.ikFree?1:w);');
anim = rep('anim.seat', anim, "  const y=Math.max(-0.2,o[CI['body.py']]) + Math.max(0,-minY) - sink;",
  "  const y=Math.max(-0.2,o[CI['body.py']]) + Math.max(0,-minY) - sink - (s.extDrop||0);");
anim = rep('anim.exprlist', anim, "const EXPR=['neutral','shock','giggle','love','smug','scared','dizzy','embarrassed'];",
  "const EXPR=['neutral','shock','giggle','love','smug','scared','dizzy','embarrassed','sleepy','sad'];");
anim = rep('anim.expr.new', anim, "  else if (ex==='embarrassed'){ eyeS=0.7; }",
  "  else if (ex==='embarrassed'){ eyeS=0.7; }\n  else if (ex==='sleepy'){ eyeSy=0.3; }\n  else if (ex==='sad'){ eyeS=0.86; eyeSy=0.6; }");
anim = rep('anim.expr.jelly', anim,
  "    f.mouth.visible = ex!=='shock' && ex!=='giggle' && ex!=='scared';\n    f.mouthO.visible = ex==='shock'||ex==='scared'; f.mouthO.scale.setScalar(ex==='scared'?0.6:pop);",
  "    f.mouth.visible = ex!=='shock' && ex!=='giggle' && ex!=='scared' && ex!=='sad';\n    f.mouthO.visible = ex==='shock'||ex==='scared'||ex==='sad'; f.mouthO.scale.setScalar(ex==='scared'?0.6:ex==='sad'?0.4:pop);");
anim = rep('anim.expr.astro', anim,
  "    f.smile.visible = !(ex==='shock'||ex==='scared'||ex==='embarrassed'); f.smileO.visible = ex==='shock'||ex==='scared';",
  "    f.smile.visible = !(ex==='shock'||ex==='scared'||ex==='embarrassed'||ex==='sad'); f.smileO.visible = ex==='shock'||ex==='scared'||ex==='sad';");
anim = rep('anim.expr.astroeyes', anim,
  "      d.scale.set(sc*(ex==='smug'&&i===0?1.4:1), sc*(ex==='smug'&&i===0?0.25:1)*s.blinkMul, 0.4*sc);",
  "      d.scale.set(sc*(ex==='smug'&&i===0?1.4:1), sc*(ex==='smug'&&i===0?0.25:1)*s.blinkMul*(ex==='sleepy'?0.3:ex==='sad'?0.7:1), 0.4*sc);");
anim = rep('anim.jellydeform', anim, 'if (!ctx.skipDeform){ const fast = s.wA>0.05;',
  'if (!ctx.skipDeform){ const fast = s.wA>0.05 || s.velW.lengthSq()>0.09;');   // v30: moving Jelly re-deforms every frame
anim = rep('anim.clips.all', anim, "  const all=['jelly','astro','muse','fox'];", "  const all=['jelly','astro','muse'];");
anim = rep('anim.clips.L', anim, "  const L=(w)=>({jelly:-1.95,astro:-0.82,muse:0.28,fox:1.45})[w];", "  const L=(w)=>({jelly:-1.95,astro:-0.82,muse:0.28})[w];");
{ // drop the lab's 4-character clip library (micro-gags, scenes, moves): the v29 Stage drives the trio in B0
  const a = anim.indexOf('  /* ---------- MICRO-GAGS ---------- */'), m = anim.indexOf('MOVES LIBRARY', a), b = m < 0 ? -1 : anim.indexOf('\n}\n', m);
  if (a < 0 || m < 0 || b < 0) { console.error('CUT FAIL anim.clips', a, m, b); fails++; }
  else anim = anim.slice(0, a) + '  /* v30 (B0): the lab clip library is not shipped. The v29 Stage drives the trio through D.ext;\n     native Phase-0 gags are authored here in batches B1-B5. */\n  void K; void TO; void PU; void FN; void X; void SFX; void SAY; void FXE; void all; void L;' + anim.slice(b);
}

/* dead fox branches (the crew is Jelly, Astro, Muse) */
anim = rep('fox.setExpr', anim, "  if (s.kind==='fox' && (name==='shock'||name==='scared')) s.earKick=1;\n", '');
anim = rep('fox.poof', anim, "  s.poofT = k==='muse'||k==='fox' ? poof : 0;", "  s.poofT = k==='muse' ? poof : 0;");
anim = cut('fox.face', anim, "  if (k==='fox'){\n    const open = ex==='shock'", "  if ((k==='muse'||k==='fox') && f.blushes){", true);
anim = rep('fox.blush', anim, "  if ((k==='muse'||k==='fox') && f.blushes){", "  if (k==='muse' && f.blushes){");
anim = rep('fox.eyes1', anim, "  const eyes = k==='fox' ? f.openEyes : u.eyes;", '  const eyes = u.eyes;');
anim = rep('fox.eyes2', anim, "    const eyes = s.kind==='fox' ? s.u.face.openEyes : s.u.eyes;", '    const eyes = s.u.eyes;');
anim = cut('fox.idle', anim, "  if (k==='fox'){ a[CI['armL.rz']]", "  if (k==='jelly'){ a[CI['armL.rz']]", true);
anim = cut('fox.secondary', anim, "  if (k==='fox'){\n    o[CI['tail.ry']]", "  if (k==='jelly'){\n    const sy=stepSpring", true);

/* v30: let the compositor drop running FX when the cast moves to another band */
anim = rep('anim.clearfx', anim, 'const api = { setExprIx:setExpr,', 'const api = { clearFx:()=>{ for (const f of FX) f.on=false; }, setExprIx:setExpr,');

/* ---------------- band (v30 compositor) ---------------- */
const band = fs.readFileSync(path.join(__dirname, 'band.js'), 'utf8').replace(/\r\n/g, '\n');

/* ---------------- fox audit: nothing fox-shaped may survive outside dead branches ---------------- */
const foxLines = [core, chars, eng, anim].join('\n').split('\n').filter(l => /fox/i.test(l));
const foxLeft = foxLines.length;
foxLines.forEach(l => console.log('  fox ref:', l.trim().slice(0, 140)));

const head = '/* Fun Friday Arena v30 - crew3d: Astro, Jelly and Muse on three.js r129.\n' +
  '   GENERATED by qa/crew3d/build.cjs from qa/crew3d/src + qa/crew3d/band.js. Edit those, then rebuild.\n' +
  '   Loaded lazily by assets/crew.js on devices that can run 3D. Made by PPA Warriors */\n';
const out = head + '(function () {\nif (window.Crew3D) return;\nif (!window.THREE) { window.Crew3D = { ok: false, err: "three.js missing" }; return; }\ntry {\n' +
  ['/* ===== core ===== */', core, '/* ===== chars ===== */', chars, '/* ===== engine ===== */', eng, '/* ===== anim ===== */', anim, '/* ===== band ===== */', band].join('\n') +
  '\n} catch (err) {\n  try { console.warn("[crew3d] disabled:", err && err.message); } catch (e) {}\n' +
  '  try { var cv = document.querySelector("canvas[data-crew=three]"); if (cv) cv.remove(); } catch (e) {}\n' +
  '  window.Crew3D = { ok: false, err: String((err && err.message) || err) };\n}\n})();\n';

if (fails) { console.error('BUILD FAILED: ' + fails + ' patch(es)'); process.exit(1); }
const dst = path.join(ROOT, 'assets', 'crew3d.js');
fs.writeFileSync(dst, out);
// vendor copy of three.js (verbatim)
const vend = path.join(ROOT, 'assets', 'vendor'); if (!fs.existsSync(vend)) fs.mkdirSync(vend);
const three = fs.readFileSync(path.join(SRC, 'lib_three.min.js'));
fs.writeFileSync(path.join(vend, 'three.r129.min.js'), three);
console.log('wrote', dst, out.length, 'chars; three', three.length, 'bytes; fox refs left:', foxLeft);
console.log('BUILD OK');
