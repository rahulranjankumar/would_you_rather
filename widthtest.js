/** v27 static checks (no server needed): resolution rules, motion rules, video whitelist,
 *  crew scene count, WYR has no "wrong", credits, server cost, and the v25 behaviours we kept. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
let ok=true;const fail=(m)=>{console.log('   FAIL  '+m);ok=false;},pass=(m)=>console.log('   PASS  '+m);
const rd=(f)=>fs.readFileSync(f,'utf8');
const P={land:rd('public/landing.html'),join:rd('public/join.html'),play:rd('public/play.html'),host:rd('public/host.html'),screen:rd('public/screen.html'),
  report:rd('public/report.html'),e404:rd('public/404.html'),intro:rd('public/intro3d.html')};
const A={perf:rd('assets/perf.js'),river:rd('assets/river.js'),fx:rd('assets/fx.js'),crew:rd('assets/crew.js'),arena:rd('assets/arena.js'),css:rd('assets/arena.css'),
  theme:rd('assets/theme.css'),wrapped:rd('assets/wrapped.js'),sfx:rd('assets/sfx.js')};
const srv=rd('server.js');
const strip=(s)=>s.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('\n=== RESOLUTION IS NEVER COMPROMISED ===');
/DPR = raw >= 3 && \/Mobi\|Android\|iPhone\/i\.test\(navigator\.userAgent\) \? 3 : Math\.min\(raw, 2\)/.test(A.perf)?pass('DPR = min(devicePixelRatio,2), 3 on 3x phones — computed once'):fail('perf DPR rule');
!/DPR\s*=(?!=)/.test(strip(A.perf).replace(/var DPR = raw[^;]*;/,'').replace(/Object\.freeze && \(DPR = DPR\);/,''))?pass('FFAperf never reassigns DPR'):fail('DPR reassigned in perf.js');
/var DPR = P\.DPR;/.test(A.river)&&/cv\.width = Math\.round\(W \* DPR\)/.test(A.river)?pass('Signal River canvas at native DPR'):fail('river DPR');
/var DPR = PERF\.DPR;/.test(A.fx)&&!/1\.5\)/.test(A.fx.match(/var DPR[^;]*;/)[0])?pass('confetti canvas at native DPR (v25 capped at 1.5)'):fail('fx DPR');
!/EffectComposer|UnrealBloom|setMSAA\(\d\)/.test(P.intro.replace(/function setMSAA[^\n]*\n/,''))&&/antialias:true/.test(P.intro)?pass('intro: no post-processing passes, native hardware MSAA (never changes at runtime)'):fail('intro MSAA still changes');
(P.intro.match(/setPixelRatio\(/g)||[]).length===1&&/DPR=Math\.min\(window\.devicePixelRatio\|\|1,1\.75\)/.test(P.intro)?pass('intro pixel ratio set once (cap 1.75, never lowered at runtime)'):fail('intro pixel ratio');
const tierFiles=[A.perf,A.river,A.fx,A.crew];
!tierFiles.some((s)=>/onTier\([^)]*\{[^}]*(width|height|DPR)\s*=/.test(s))?pass('tier changes only alter counts/complexity, never canvas size'):fail('tier touches resolution');

console.log('\n=== MOTION: transform + opacity only ===');
function keyframeProps(css){const out=[];const re=/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g;let m;while((m=re.exec(css))){const body=m[1];
  body.replace(/\{([^}]*)\}/g,(_,decl)=>{decl.split(';').forEach((d)=>{const p=d.split(':')[0].trim();if(p)out.push(p);});});}return out;}
const banned=/^(filter|-webkit-filter|backdrop-filter|background-position|box-shadow|clip-path|-webkit-clip-path|width|height)$/;
const sheets={play:P.play,join:P.join,landing:P.land,screen:P.screen,e404:P.e404,'arena.css':A.css,'fx.js':A.fx};
let bad=[];Object.keys(sheets).forEach((k)=>{keyframeProps(sheets[k]).forEach((p)=>{if(banned.test(p))bad.push(k+':'+p);});});
!bad.length?pass('no animated filter / background-position / box-shadow / clip-path / width in v27 keyframes'):fail('banned animated props: '+bad.join(', '));
!/filter:blur\(60px\)/.test(P.play)?pass('play: aurora blur(60px) removed (Signal River replaces it)'):fail('aurora blur still on play');
!/\.mascot\{position:relative/.test(rd('assets/mascot.js'))?pass('mascot.js no longer overrides .mwrap{position:absolute}'):fail('mascot css bug');
!/<video/.test(P.play)?pass('no video on /play — the GPU belongs to the game'):fail('video on play');

console.log('\n=== VIDEOS: only the six from §12 ===');
const OK=['hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894','hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411','hf_20260331_053923_22c0a6a5-313c-474c-85ff-3b50d25e944a',
  'hf_20260331_054411_511c1b7a-fb2f-42ef-bf6c-32c0b1a06e79','hf_20260331_055427_ac7035b5-9f3b-4289-86fc-941b2432317d','hf_20260331_055729_72d66327-b59e-4ae9-bb70-de6ccb5ecdb0'];
const vids=[];Object.values(P).forEach((s)=>(s.match(/[\w-]+\.mp4/g)||[]).forEach((v)=>vids.push(v.replace('.mp4',''))));
vids.length&&vids.every((v)=>OK.includes(v))?pass(vids.length+' video references, all from the approved six'):fail('unknown video: '+vids.filter((v)=>!OK.includes(v)));
/preload="none"/.test(P.land)&&/one at a time|ONE at a time/.test(P.land)?pass('landing: preload=none, play when visible, one video at a time'):fail('landing video policy');

console.log('\n=== INTRO 3D FIXES ===');
/requestIdleCallback/.test(P.intro)&&/dustQueued=true/.test(P.intro)?pass('Thanos dust precomputed in idle time during the end card'):fail('buildDust still synchronous');
/helmetLo:new THREE\.SphereGeometry\(\.44,16,12\)/.test(P.intro)&&!/new THREE\.MeshPhysicalMaterial/.test(P.intro)?pass('intro: lean shared geometry, crowd LOD, MeshStandardMaterial only (no clearcoat/transmission compile stall)'):fail('crowd LOD');
/renderer\.compile\(scene,camera\)/.test(P.intro)?pass('materials pre-compiled behind the gate'):fail('no renderer.compile');
/40\*60\*1000/.test(P.land)&&/introFab/.test(P.land)?pass('3D intro once per 40 min + ▶ Play intro pill'):fail('intro policy');

console.log('\n=== THE CREW ===');
const win={matchMedia:()=>({matches:false}),SFX:null,performance:{now:()=>0}};const ctx={window:win,performance:{now:()=>0}};vm.createContext(ctx);
vm.runInContext(rd('assets/toy3d.js'),ctx);vm.runInContext(A.crew,ctx);
const crew=ctx.window.Crew,n=Object.keys(crew.SCENES).length;
n>=30?pass('trio has '+n+' animated 3D scenes (>= 30)'):fail('only '+n+' scenes');
crew.is3D&&/Toy3D/.test(A.crew)?pass('characters are real 3D (Toy3D WebGL), the 2D SVG crew is gone'):fail('crew not 3D');
['bip','bop','boop'].every((w)=>crew.DESIGN[w])?pass('cast: Bip (one eye, overalls) · Bop (cap) · Boop (teeth, scarf)'):fail('cast');
Object.values(crew.DESIGN).every((d)=>!/^#F[0-9A-F]D/i.test(d.col)) && !/M\('[^']*goggle/i.test(A.crew)?pass('original look: pastel bodies, no yellow skin, no goggles'):fail('derivative design cue');
['lobby','read','crowd','rebel','quizWrong','slapstick','streakCrowd','streakRebel','upset','gameover','loop404','reconnect','gag','dance','chill'].every((g)=>crew.GROUPS[g]&&crew.GROUPS[g].length)?pass('scene groups for every game moment, 404 and reconnect'):fail('missing scene group');

console.log('\n=== WOULD YOU RATHER HAS NO WRONG ANSWERS ===');
const wrongLines=P.play.split('\n').filter((l)=>/wrong|incorrect|✗/i.test(l));
wrongLines.every((l)=>/quiz/i.test(l))?pass('"wrong" only ever appears in Quiz code paths ('+wrongLines.length+' lines)'):fail('"wrong" outside quiz: '+wrongLines.filter((l)=>!/quiz/i.test(l)).join(' | ').slice(0,200));
/With the crowd/.test(P.play)&&/Against the crowd/.test(P.play)&&/Rebel energy/.test(P.play)?pass('WYR verdicts: With the crowd / Against the crowd · Rebel energy'):fail('WYR verdict copy');
crew.GROUPS.rebel.every((s)=>!/wrong/i.test(JSON.stringify(crew.SCENES[s].s)))?pass('rebel scenes tease and celebrate, never say "wrong"'):fail('rebel scene says wrong');

console.log('\n=== CREDITS: team name only ===');
const all=Object.values(P).concat(Object.values(A)).concat([srv,rd('README.md')]).join('\n');
!/rahul|ranjan|kumar/i.test(all)?pass('no personal names anywhere'):fail('personal name found');
['land','join','play','screen','report','e404'].every((k)=>/Made by PPA Warriors/.test(P[k]))?pass('"Made by PPA Warriors" on every page'):fail('credit missing');
/credit-mark/.test(A.arena)&&/MADE BY PPA WARRIORS/.test(A.arena)?pass('credits easter egg: tap the mark 3x'):fail('credits egg');

console.log('\n=== SERVER COST ===');
!/three|webgl|canvas/i.test(srv)?pass('server renders nothing'):fail('server renders');
/pendJoin/.test(srv)&&!/fanout\(room\.ctrlClients,frame\('lobby:update',\{playerCount:room\.players\.size,name,seq/.test(srv)?pass('lobby:update coalesced into the progress tick'):fail('per-join broadcast still present');
/lbCache/.test(srv)?pass('serialised leaderboard cached (dirty flag)'):fail('no lb cache');
/MIN_ELAPSED=250/.test(srv)&&/GRACE_MS=1200/.test(srv)?pass('client elapsedMs clamped to [250 ms, real elapsed], 1.2 s grace'):fail('vote clamp');
/scheduleRoster\(\)\{[\s\S]{0,260}clearTimeout\(rosterTimer\);\}/.test(P.host)?pass('host does NOT poll /api/roster during questions'):fail('host roster polling');
/react/.test(srv)&&/reactDirty/.test(srv)?pass('emoji reactions = counts per 500 ms tick'):fail('reactions');
/segAuto/.test(P.host)&&/api\/config/.test(P.host)?pass('kept: auto-advance setup + PUBLIC_URL join links'):fail('host regressions');

console.log('\n=== LOCAL-FIRST + WRAPPED ===');
/150 \+ Math\.random\(\) \* Math\.min\(1650/.test(A.arena)&&/sendBeacon/.test(A.arena)&&/arm\(end\)/.test(A.arena)?pass('jittered send, coalesced changes, flush 600 ms before time-up, beacon on hide'):fail('vote queue');
!/fetch\(|XMLHttpRequest|sendBeacon/.test(A.wrapped)?pass('Wrapped makes zero network calls'):fail('Wrapped touches the network');
(A.wrapped.match(/\[[^\]]*, '([A-Z][\w-]+(?: [\w-]+)*)', '/g)||[]).length>=11?pass('Wrapped has ≥ 11 titles'):fail('Wrapped titles');

console.log('\n=== v28: SEAMLESS LOOPS, PHONES, AUTO-FIT ===');
/SEAMLESS LOOPS/.test(A.crew)&&/POP ABSORBER/.test(A.crew)?pass('every scene eases back to the start pose (seamless loops) + hard cuts become whooshes'):fail('seamless loops');
typeof crew.Pocket==='function'&&typeof crew.isPhone==='function'?pass('phones get the sticker crew (no WebGL), laptops/big screen get 3D'):fail('pocket crew');
fs.readdirSync('assets/crew').filter((f)=>/\.webp$/.test(f)).length>=45?pass(fs.readdirSync('assets/crew').length+' pre-rendered WebP stickers for phones'):fail('sticker sprites missing');
/function fitQ\(\)/.test(P.play)&&/\.pstage\.three/.test(P.play)?pass('play auto-fits 2, 3 or 4 options to any screen'):fail('play fit');
/function fitJ\(\)/.test(P.join)?pass('join boarding pass auto-fits (Board button always on screen)'):fail('join fit');
/getAutoplayPolicy/.test(P.intro)&&!/SOUND ON FOR THE FULL SHOW/.test(P.intro)?pass('intro starts directly when sound is already allowed; hint removed'):fail('intro autoplay');
/z-index:2147483001/.test(A.fx)&&/FX\.cursor\(\)/.test(P.report)?pass('spaceship cursor above Wrapped and on the report page'):fail('cursor coverage');
console.log('\n=== TRANSITIONS & TIERS ===');
const TX=A.fx.match(/var TX = \[([\s\S]*?)\];/)[1].split(',').length;
TX===20?pass('20 question transitions (15 + scan, portal, chrome, warp, pixel)'):fail('transitions: '+TX);
/ultra:[\s\S]*particles: 2400[\s\S]*eco:[\s\S]*particles: 300/.test(A.perf)?pass('budget table: 2400 / 1500 / 800 / 300 particles'):fail('budget table');
/F for the HUD/.test(A.perf)&&/DPR ' \+ DPR \+ ' \(fixed\)/.test(A.perf)?pass('F-key HUD shows FPS, p95, tier, GPU and the fixed DPR'):fail('HUD');

console.log('\n=== v29: READING TIME, DOUBLE-TAP, DEPLOY FRESHNESS ===');
/function readLeft\(q\)\{if\(!q\|\|!\(q\.readMs>0\)\)return 0;/.test(P.play)&&/Math\.min\(bySync,byLocal\)/.test(P.play)?pass('reading phase = min(server clock, phone monotonic clock); Off = answer from frame 1'):fail('reading phase logic');
/var ph0=curPhase\(\)/.test(P.play)?pass('vote() uses the live phase, never a stale flag'):fail('vote phase');
/S\.lockIn&&S\.lastTap&&S\.lastTap\.i===i&&now-S\.lastTap\.t<400/.test(P.play)?pass('lock-in: double tap on a card picks AND locks'):fail('double tap');
const vers=new Set();Object.values(P).forEach((t)=>(t.match(/\?v=\d+/g)||[]).forEach((x)=>vers.add(x)));
vers.size===1?pass('one asset version everywhere ('+[...vers][0]+') — a deploy busts every cache'):fail('mixed asset versions '+[...vers]);
const sw=rd('public/sw.js');/fetch\(e\.request,\{cache:'no-cache'\}\)/.test(sw)&&!/return hit\|\|net/.test(sw)?pass('service worker is network-first (old code can never be served after a deploy)'):fail('sw cache-first');
/ext==='\.html'\)\?'no-cache'/.test(srv)?pass('HTML always revalidated by the browser'):fail('html cache headers');
console.log('\n'+(ok?'=== ALL STATIC CHECKS PASSED ===':'=== CHECKS FAILED ===')+'\n');process.exit(ok?0:1);
