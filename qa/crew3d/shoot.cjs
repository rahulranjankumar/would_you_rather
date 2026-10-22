/* v30 crew QA harness: real server + headless Edge over the DevTools protocol (no npm deps).
   node qa/crew3d/shoot.cjs stickers      -> renders the 45 Pocket stickers from the three.js crew
   node qa/crew3d/shoot.cjs shots         -> screenshot matrix (1920x1080, 1366x768, 390x844) + console + stats
   node qa/crew3d/shoot.cjs scenes [names] -> scene frames on the 404 band at 1366x768 (+ numeric foot/IK logs)
   Output: qa/crew3d/shots/*.png and qa/crew3d/shoot-<mode>.json        Made by PPA Warriors */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(__dirname, 'shots');
const PORT = 3917, DBG = 9333, BASE = 'http://127.0.0.1:' + PORT;
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MODE = process.argv[2] || 'shots', ARGS = process.argv.slice(3);
const GPU = process.env.CREW_GPU === '1'
  ? ['--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = { mode: MODE, started: new Date().toISOString(), pages: [], errors: [] };
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function getJSON(url, method) {
  return new Promise((res, rej) => { const rq = http.request(url, { method: method || 'GET' }, (r) => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }); rq.on('error', rej); rq.end(); });
}
async function waitHttp(url, ms) { const t0 = Date.now(); for (;;) { try { return await getJSON(url); } catch (e) { if (Date.now() - t0 > ms) throw new Error('timeout ' + url); await sleep(250); } } }
function up(url) { return new Promise((res) => { const rq = http.get(url, (r) => { r.resume(); res(true); }); rq.on('error', () => res(false)); }); }
async function waitUp(url, ms) { const t0 = Date.now(); while (!(await up(url))) { if (Date.now() - t0 > ms) throw new Error('server not up'); await sleep(200); } }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.wait = new Map(); this.on = {}; this.console = [];
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.wait.has(m.id)) { const w = this.wait.get(m.id); this.wait.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); return; }
      const h = this.on[m.method]; if (h) h.forEach(f => f(m.params)); }); }
  send(method, params) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params: params || {} })); return new Promise((res, rej) => this.wait.set(id, { res, rej })); }
  once(method, ms) { return new Promise((res) => { const f = (p) => { this.on[method] = this.on[method].filter(x => x !== f); res(p); }; (this.on[method] = this.on[method] || []).push(f); if (ms) setTimeout(() => res(null), ms); }); }
  listen(method, f) { (this.on[method] = this.on[method] || []).push(f); }
  async eval(expr, ms) { const r = await Promise.race([this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms || 60000).then(() => ({ exceptionDetails: { text: 'eval timeout' } }))]);
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)); return r.result.value; }
}

async function open(cdp, url, vw, vh, mobile, waitMs) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: mobile ? 2 : 1, mobile: !!mobile, screenWidth: vw, screenHeight: vh });
  await cdp.send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await cdp.send('Emulation.setUserAgentOverride', { userAgent: mobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0' });
  cdp.console = [];
  const loaded = cdp.once('Page.loadEventFired', 20000);
  await cdp.send('Page.navigate', { url });
  await loaded; await sleep(waitMs || 2500);
}
async function shot(cdp, name) { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); return f; }
const PROBE = `(function(){ var gl=null; try{ var c=document.createElement('canvas'); var x=c.getContext('webgl2')||c.getContext('webgl'); gl=x?(x.getParameter(x.VERSION)+' | '+(x.getExtension('WEBGL_debug_renderer_info')?x.getParameter(x.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):'?')):'none'; }catch(e){ gl='err '+e; }
  return { tier: window.FFAperf&&FFAperf.tier(), phone: Crew.isPhone(), can3D: Crew.can3D?Crew.can3D():'n/a', three: !!window.THREE, gl: gl,
    scripts: Array.prototype.map.call(document.scripts, function(s){return s.src;}).filter(function(s){return /three|crew3d/.test(s);}) }; })()`;
const STATS = `(function(){ var c=document.querySelector('canvas.crew3d'); return { crew3d: !!(window.Crew3D&&window.Crew3D.ok), err: window.Crew3D&&window.Crew3D.err||null,
  canvas: !!c, canvasThree: !!document.querySelector('canvas[data-crew=three]'), pocket: document.querySelectorAll('.pk-stage').length, stats: window.Crew3D&&window.Crew3D.stats?window.Crew3D.stats():null }; })()`;

async function main() {
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  const prof = path.join(__dirname, '.edge-profile');
  const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + DBG, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--window-size=1920,1080'].concat(GPU, ['about:blank']), { stdio: 'ignore' });
  const kill = () => { for (const p of [edge, srv]) { try { require('child_process').spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {} } };
  process.on('exit', kill);
  try {
    await waitUp(BASE + '/', 15000);
    await waitHttp('http://127.0.0.1:' + DBG + '/json/version', 20000);
    const list = await getJSON('http://127.0.0.1:' + DBG + '/json/list'); const pg = list.find(t => t.type === 'page');
    const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    cdp.listen('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') cdp.console.push(p.type + ': ' + p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ')); });
    cdp.listen('Runtime.exceptionThrown', (p) => cdp.console.push('exception: ' + (p.exceptionDetails.exception ? p.exceptionDetails.exception.description : p.exceptionDetails.text)));
    cdp.listen('Log.entryAdded', (p) => { if (p.entry.level === 'error') cdp.console.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });

    if (MODE === 'stickers') await stickers(cdp);
    else if (MODE === 'scenes') await scenes(cdp);
    else if (MODE === 'perch') await perch(cdp);
    else if (MODE === 'probe') await probeRun(cdp);
    else await shots(cdp);
  } catch (e) { log.errors.push(String(e && e.stack || e)); }
  fs.writeFileSync(path.join(__dirname, 'shoot-' + MODE + '.json'), JSON.stringify(log, null, 1));
  kill(); setTimeout(() => process.exit(0), 300);
}

async function stickers(cdp) {
  await open(cdp, BASE + '/crew-sticker-studio-404?crew3d=1&tier=ultra', 1366, 768, false, 3000);
  const ok = await cdp.eval(`new Promise(r=>{ let n=0; (function w(){ if (window.Crew3D) return r(window.Crew3D.ok?'ok':'fail:'+window.Crew3D.err); if (++n>200) return r('timeout'); setTimeout(w,100); })(); })`);
  log.pages.push({ page: 'studio', crew3d: ok, console: cdp.console.slice() });
  if (ok !== 'ok') return;
  const poses = ['cheer', 'cream', 'dizzy', 'ecstatic', 'happy', 'idle', 'laugh', 'love', 'sad', 'shock', 'sleepy', 'smug', 'soot', 'tough', 'wave'];
  const cast = { bip: 'astro', bop: 'jelly', boop: 'muse' };
  let bytes = 0, n = 0;
  for (const slot of Object.keys(cast)) for (const p of poses) {
    const url = await cdp.eval(`window.Crew3D.sticker(${JSON.stringify(slot)}, ${JSON.stringify(p)}, { w: 400, h: 500, q: 0.9 })`);
    const m = /^data:image\/webp;base64,(.*)$/.exec(url || ''); if (!m) { log.errors.push('sticker ' + slot + ' ' + p + ' not webp: ' + String(url).slice(0, 40)); continue; }
    const buf = Buffer.from(m[1], 'base64'), f = path.join(ROOT, 'assets', 'crew', cast[slot] + '-' + p + '.webp');
    fs.writeFileSync(f, buf); bytes += buf.length; n++;
  }
  await cdp.eval('window.Crew3D.stickerDone(), 1');
  log.stickers = { n, bytes, avg: Math.round(bytes / Math.max(1, n)) };
  log.pages[0].console = cdp.console.slice();
}

async function shots(cdp) {
  const pages = [['landing', '/'], ['join', '/join'], ['screen', '/screen'], ['report', '/report'], ['play', '/play'], ['404', '/no-such-page']];
  const sizes = [['1920x1080', 1920, 1080, false], ['1366x768', 1366, 768, false], ['390x844', 390, 844, true]];
  const only = ARGS.length ? ARGS : null;
  for (const [sz, w, h, mob] of sizes) for (const [nm, url] of pages) {
    if (only && !only.includes(nm) && !only.includes(sz)) continue;
    await open(cdp, BASE + url + (mob ? '' : (url.includes('?') ? '&' : '?') + 'tier=high'), w, h, mob, 4500);
    const st = await cdp.eval(STATS).catch(e => ({ evalError: String(e) }));
    const f = await shot(cdp, nm + '-' + sz);
    log.pages.push({ page: nm, size: sz, file: path.basename(f), state: st, console: cdp.console.slice() });
  }
}

async function perch(cdp) {
  await open(cdp, BASE + '/no-such-page?crewstats&tier=high', 1366, 768, false, 3000);
  await cdp.eval(`(function(){
    var wrap=document.createElement('div'); wrap.style.cssText='position:fixed;left:283px;top:330px;width:800px;height:380px;z-index:5;padding-top:150px;box-sizing:border-box';
    var card=document.createElement('div'); card.style.cssText='height:200px;border-radius:18px;background:#2b2250;border:2px solid #6b5bd6;color:#fff;font:700 28px sans-serif;display:flex;align-items:center;justify-content:center'; card.textContent='Answer card';
    wrap.appendChild(card); document.body.appendChild(wrap);
    var band=document.createElement('div'); band.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none'; wrap.appendChild(band);
    window.__perch=Crew.mount(band,{perch:true,mode:'perch',eggs:false,home:{momo:.3,noodle:.5,bean:.7},floorY:function(){return 150;},unitFn:function(){return .98;}});
    setTimeout(function(){ __perch.climbIn([{x:.05,drop:200},{x:.95,drop:200},{x:.6,drop:200}]); }, 200); return 1; })()`);
  for (const [ms, nm] of [[700, 'climb'], [2600, 'seated']]) { await sleep(ms); await shot(cdp, 'perch-' + nm); }
  await cdp.eval(`(__perch.play('chillNudge'), 1)`); await sleep(1200); await shot(cdp, 'perch-nudge');
  log.pages.push({ page: 'perch', stats: await cdp.eval('window.Crew3D.stats()'), drops: await cdp.eval('window.Crew3D.debug.XS.map(function(x){return [x.kind,+x.seatDrop.toFixed(3),+x.base.toFixed(3)];})'), console: cdp.console.filter(x => x.indexOf('favicon') < 0 && x.indexOf('/no-such-page') < 0) });
}

/* probe <url> <script.js> [w h]: the script is evaluated as an async function body; its return value is logged.
   It may call shot('name') (exposed as window.__shot via a binding-free poll) - kept simple: return data only. */
async function probeRun(cdp) {
  const url = ARGS[0] || '/no-such-page?crewstats&tier=high', file = ARGS[1], w = +(ARGS[2] || 1366), h = +(ARGS[3] || 768);
  await open(cdp, BASE + url, w, h, w < 600, 3000);
  const body = fs.readFileSync(path.resolve(file), 'utf8');
  const steps = body.split(/^\/\/\s*@shot\s+(\S+)\s*$/m);   // "// @shot name" splits the script into stages with a screenshot after each
  const out = [];
  for (let i = 0; i < steps.length; i += 2) {
    const r = await cdp.eval('(async function(){' + steps[i] + '\n})()', 90000).catch(e => 'ERR ' + e.message);
    out.push(r);
    if (steps[i + 1]) await shot(cdp, 'probe-' + steps[i + 1]);
  }
  log.pages.push({ page: url, out, console: cdp.console.filter(x => x.indexOf('favicon') < 0 && x.indexOf('/no-such-page') < 0) });
}

async function scenes(cdp) {
  await open(cdp, BASE + '/no-such-page?crewstats&tier=high', 1366, 768, false, 3500);
  const list = ARGS.length ? ARGS : await cdp.eval(`(function(){ var G=Crew.GROUPS, out=[]; ['rocket','revenge','chaos','team','contest','finish'].forEach(function(g){ var a=G[g]||[]; if (a[0]) out.push(a[0]); if (a[1]) out.push(a[1]); });
    ['danceOff','highFive','pokeWar'].forEach(function(n){ if (Crew.SCENES[n]) out.push(n); }); return out; })()`);
  log.sceneList = list;
  const ok = await cdp.eval(`new Promise(r=>{ let n=0; (function w(){ if (window.Crew3D) return r(window.Crew3D.ok?'ok':'fail:'+window.Crew3D.err); if (++n>200) return r('timeout'); setTimeout(w,100); })(); })`);
  const probe = await cdp.eval(PROBE).catch(e => String(e));
  log.pages.push({ page: '404', crew3d: ok, probe, console: cdp.console.filter(x => !/favicon/.test(x)) });
  if (ok !== 'ok') return;
  for (const sc of list) {
    const d = await cdp.eval(`(function(){ var st=window.Crew3D.debug.active(); if(!st) return -1; st.stopLoop&&st.stopLoop(); st.play(${JSON.stringify(sc)}); return st.scene ? st.scene.d : 0; })()`);
    log.pages.push({ scene: sc, dur: d });
    if (!(d > 0)) continue;
    const marks = [0.2, 0.45, 0.7, 0.92];
    let t0 = 0;
    for (const k of marks) { const at = d * k * 1000; await sleep(Math.max(0, at - t0)); t0 = at; await shot(cdp, 'scene-' + sc + '-' + Math.round(k * 100)); }
    const stats = await cdp.eval('window.Crew3D.stats()');
    log.pages.push({ scene: sc, stats, console: cdp.console.slice() });
    await sleep(Math.max(0, d * 1000 - t0) + 600);
  }
}
main();
