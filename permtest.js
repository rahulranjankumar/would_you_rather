/** v29 permutation test — every host setting combination, end to end, over real HTTP + SSE.
 *  node permtest.js            (server running on :3000)   CONC=60 to change parallelism
 *  Payloads are built EXACTLY like host.html's Create / "Edit questions → Start new game".
 *  Per combination: stored settings, question:show timing, vote refused during reading /
 *  accepted instantly when reading is Off, lock rules, counts, scoring, auto-advance.
 *  Extra scenarios: join mid-question, reconnect, freeze/resume, restart, Reveal Now with
 *  answers in flight, server-side elapsed clamp. */
'use strict';
const http = require('http');
const BASE = process.env.BASE || 'http://127.0.0.1:3000', CONC = +(process.env.CONC || 60);
const agent = new http.Agent({ keepAlive: true, maxSockets: 4096 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function req(method, p, b) {
  return new Promise((r) => {
    const d = b ? Buffer.from(JSON.stringify(b)) : null;
    const q = http.request(new URL(BASE + p), { method, agent, headers: d ? { 'Content-Type': 'application/json', 'Content-Length': d.length } : {} }, (x) => {
      let s = ''; x.on('data', (c) => (s += c)); x.on('end', () => { let j = {}; try { j = s ? JSON.parse(s) : {}; } catch (e) {} j._s = x.statusCode; r(j); });
    });
    q.on('error', (e) => r({ _s: 0, err: e.message })); if (d) q.write(d); q.end();
  });
}
const post = (p, b) => req('POST', p, b), get = (p) => req('GET', p);
function listen(room, role, pid) {
  const ev = [], waiters = [];
  const h = http.get(new URL(BASE + '/api/events?room=' + room + '&role=' + role + (pid ? '&playerId=' + pid : '')), { agent }, (res) => {
    let buf = ''; res.on('data', (ch) => { buf += ch; let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const m = /^event: (.+)$/m.exec(raw), dd = /^data: (.+)$/m.exec(raw);
        if (m) { let o = {}; try { o = dd ? JSON.parse(dd[1]) : {}; } catch (e) {} const e2 = [m[1], o, Date.now()]; ev.push(e2);
          for (let k = waiters.length - 1; k >= 0; k--) if (waiters[k].n === m[1]) { waiters[k].r(e2); waiters.splice(k, 1); break; } } } });
  });
  return { ev, close: () => h.destroy(),
    /* consumes events in order: an event that arrived BEFORE wait() was called is still returned */
    wait: (n, ms) => new Promise((r) => { for (let k = 0; k < ev.length; k++) if (ev[k][0] === n && !ev[k].used) { ev[k].used = 1; return r(ev[k]); }
      const w = { n, r: (e2) => { e2.used = 1; r(e2); } }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); r(null); } }, ms || 4000); }) };
}
/* ---- host.html payload builder (mirror of modePayload + Create) ---- */
function payload(mode, read, timer, lock, score, auto) {
  const sp = mode === 'speed';
  return { gameType: (mode === 'quiz' || mode === 'emoji') ? 'quiz' : 'wyr', bank: sp ? 'wyr' : mode, speed: sp, teamMode: false, skin: 'default', crew: true, reactions: true,
    scoringMode: score, lockIn: lock, timerMs: sp ? 5000 : timer, readMs: sp ? Math.min(1500, read) : read, autoNextMs: auto, enabled: [0, 1, 2] };
}
const MODES = ['wyr', 'quiz', 'hot', 'emoji', 'speed'];
const READS = [['off', 0], ['3s', 3000], ['5s', 5000], ['8s', 8000], ['custom0', 0], ['custom2', 2000], ['custom12', 12000]];
const TIMERS = [['15s', 15000], ['20s', 20000], ['30s', 30000], ['45s', 45000], ['custom5', 5000], ['custom60', 60000]];
const LOCKS = [false, true], SCORES = ['points', 'fun'], PATHS = ['create', 'reconfigure'];

let pass = 0, fail = 0; const fails = [];
function ck(name, ok, info) { if (ok) pass++; else { fail++; if (fails.length < 60) fails.push(name + (info !== undefined ? '  -> ' + JSON.stringify(info).slice(0, 200) : '')); } }

async function makeRoom(pl, path) {
  if (path === 'create') return post('/api/room/create', pl);
  const c = await post('/api/room/create', payload('wyr', 5000, 20000, false, 'points', 20000)); // room with DIFFERENT old settings
  const r = await post('/api/host', Object.assign({ roomCode: c.roomCode, hostToken: c.hostToken, action: 'reconfigure' }, pl));
  return Object.assign({}, c, { questionCount: r.questionCount, settings: r.settings });
}
async function correctIdx(q) {
  const bank = await get('/api/bank?type=' + (/Guess the movie/.test(q.prompt) ? 'emoji' : 'quiz'));
  const hit = (bank.questions || []).find((b) => b.prompt === q.prompt); return hit ? hit.correct : null;
}

async function combo(mode, R, T, lock, score, path, auto) {
  const id = [mode, R[0], T[0], lock ? 'lock' : 'free', score, path, auto ? 'auto' + auto : ''].join('|');
  const pl = payload(mode, R[1], T[1], lock, score, auto || 0), want = { read: pl.readMs, timer: pl.timerMs };
  const c = await makeRoom(pl, path); if (!c.roomCode) return ck(id + ' room', false, c);
  const room = c.roomCode, tok = c.hostToken;
  const v = await post('/api/room/verify', { roomCode: room });
  const s = v.settings || {};
  ck(id + ' settings', s.readMs === want.read && s.timerMs === want.timer && s.lockIn === lock && s.scoringMode === score && (s.autoNextMs || 0) === (auto ? Math.max(5000, auto) : 0), s);
  const ps = [];
  for (const n of ['A', 'B', 'C']) ps.push(await post('/api/room/join', { roomCode: room, name: n + Math.random().toString(36).slice(2, 6) }));
  const L = listen(room, 'player', ps[0].playerId), H = listen(room, 'host');
  await Promise.all([L.wait('state:sync', 5000), H.wait('state:sync', 5000)]); // streams really open
  await post('/api/host', { roomCode: room, hostToken: tok, action: 'start' });
  const qs = await L.wait('question:show', 4000);
  if (!qs) { L.close(); H.close(); return ck(id + ' question:show', false); }
  const q = qs[1];
  ck(id + ' q.readMs', q.readMs === want.read, q.readMs);
  ck(id + ' q.answerAt', q.answerAt - q.startedAt === want.read, q.answerAt - q.startedAt);
  ck(id + ' q.durationMs', q.durationMs === want.timer, q.durationMs);
  ck(id + ' q.lockIn', q.lockIn === lock, q.lockIn);
  const quiz = pl.gameType === 'quiz';
  const early = await post('/api/vote', { r: room, p: ps[0].playerId, c: 0, e: 0 });
  if (want.read === 0) ck(id + ' instant vote accepted (reading off)', early._s === 204, early);
  else ck(id + ' vote during reading refused', early._s === 400 && early.code === 4, early);
  if (want.read > 0) await sleep(Math.max(0, q.answerAt - Date.now()) + 40);
  const correct = quiz ? await correctIdx(q) : null;
  const a1 = await post('/api/vote', { r: room, p: ps[0].playerId, c: lock ? 1 : 0, e: 300 });
  ck(id + ' vote after reading accepted', a1._s === 204, a1);
  if (lock) {
    const a2 = await post('/api/vote', { r: room, p: ps[0].playerId, c: 0, e: 400 }); ck(id + ' change before lock ok', a2._s === 204, a2);
    const a3 = await post('/api/vote', { r: room, p: ps[0].playerId, c: 0, lock: true, e: 500 }); ck(id + ' lock ok', a3._s === 204, a3);
    const a4 = await post('/api/vote', { r: room, p: ps[0].playerId, c: 1, e: 600 }); ck(id + ' change after lock refused', a4._s === 400 && a4.code === 3, a4);
    await post('/api/vote', { r: room, p: ps[1].playerId, c: 1, lock: true, e: 700 });
    await post('/api/vote', { r: room, p: ps[2].playerId, c: 0, e: 800 }); // NOT locked
  } else {
    await post('/api/vote', { r: room, p: ps[1].playerId, c: 1, e: 700 });
    await post('/api/vote', { r: room, p: ps[2].playerId, c: 0, e: 800 });
  }
  await post('/api/host', { roomCode: room, hostToken: tok, action: 'reveal' });
  const rv = await H.wait('results:reveal', 4000);
  if (!rv) { L.close(); H.close(); return ck(id + ' reveal', false); }
  ck(id + ' counts', rv[1].counts[0] === 2 && rv[1].counts[1] === 1 && rv[1].total === 3, rv[1].counts);
  const ros = await get('/api/roster?room=' + room + '&hostToken=' + tok), byName = {}; (ros.players || []).forEach((p) => (byName[p.name] = p.score));
  const sc = ps.map((p) => byName[p.name]);
  const win = (i) => quiz ? i === correct : i === 0;
  const picks = [0, 1, 0], locked = lock ? [true, true, false] : [true, true, true];
  const exp = picks.map((c2, i) => score === 'fun' ? 0 : (win(c2) && locked[i] ? 1 : 0));
  ck(id + ' scoring', sc.every((v2, i) => exp[i] ? v2 > 0 : v2 === 0), { sc, exp, correct });
  if (auto) {
    const nx = await L.wait('question:show', Math.max(5000, auto) + 2500);
    ck(id + ' auto-advance fired', !!nx && Math.abs((nx[2] - rv[2]) - Math.max(5000, auto)) < 1500, nx ? nx[2] - rv[2] : null);
  }
  L.close(); H.close();
}

async function scenarios() {
  const S = 'scenario';
  for (const read of [0, 3000]) { // join mid-question + reconnect
    const c = await post('/api/room/create', payload('quiz', read, 20000, false, 'points', 0));
    const p1 = await post('/api/room/join', { roomCode: c.roomCode, name: 'P1' });
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' });
    await sleep(500);
    const late = await post('/api/room/join', { roomCode: c.roomCode, name: 'Late' });
    const L = listen(c.roomCode, 'player', late.playerId); const sy = await L.wait('state:sync', 2000);
    const t = sy && sy[1].timer;
    ck(S + ' mid-join sync has timer r' + read, !!t && t.readMs === read && typeof t.remaining === 'number', t);
    ck(S + ' mid-join reading-left r' + read, !!t && (read === 0 ? t.remaining <= t.durationMs : t.remaining > t.durationMs), t);
    const v1 = await post('/api/vote', { r: c.roomCode, p: late.playerId, c: 0 });
    ck(S + ' mid-join vote r' + read, read === 0 ? v1._s === 204 : v1.code === 4, v1);
    L.close();
    const L2 = listen(c.roomCode, 'player', p1.playerId); const s2 = await L2.wait('state:sync', 2000);
    ck(S + ' reconnect sync r' + read, !!s2 && s2[1].status === 'QUESTION_ACTIVE' && !!s2[1].timer, s2 && s2[1].status); L2.close();
  }
  { // freeze during answering
    const c = await post('/api/room/create', payload('wyr', 0, 6000, false, 'points', 0));
    const p = await post('/api/room/join', { roomCode: c.roomCode, name: 'F' }); const L = listen(c.roomCode, 'player', p.playerId);
    await L.wait('state:sync'); await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); await L.wait('question:show');
    await sleep(1000); await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'freeze' }); await L.wait('timer:freeze');
    await sleep(6000); const v = await post('/api/vote', { r: c.roomCode, p: p.playerId, c: 0 });
    ck(S + ' vote while frozen past the original end', v._s === 204, v);
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'freeze' }); const rs = await L.wait('timer:resume');
    ck(S + ' resume carries readLeft+remaining', !!rs && rs[1].readLeft === 0 && rs[1].remaining > 4000 && rs[1].remaining < 5200, rs && rs[1]);
    const lk = await L.wait('votes:locked', 7000); ck(S + ' locks after resumed time', !!lk); L.close(); }
  { // freeze during reading
    const c = await post('/api/room/create', payload('wyr', 5000, 6000, false, 'points', 0));
    const p = await post('/api/room/join', { roomCode: c.roomCode, name: 'F2' }); const L = listen(c.roomCode, 'player', p.playerId);
    await L.wait('state:sync'); await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); await L.wait('question:show');
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'freeze' }); await sleep(800);
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'freeze' }); const rs = await L.wait('timer:resume');
    ck(S + ' resume during reading: readLeft>0', !!rs && rs[1].readLeft > 3000, rs && rs[1]); L.close(); }
  { // restart
    const c = await post('/api/room/create', payload('quiz', 0, 15000, false, 'points', 0));
    const p = await post('/api/room/join', { roomCode: c.roomCode, name: 'R' }); const L = listen(c.roomCode, 'player', p.playerId);
    await L.wait('state:sync'); await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); await L.wait('question:show');
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'restart' }); const rr = await L.wait('game:restart');
    ck(S + ' restart keeps readMs', !!rr && rr[1].readMs === 0 && rr[1].timerMs === 15000, rr && rr[1]);
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); const q2 = await L.wait('question:show');
    ck(S + ' after restart read 0', !!q2 && q2[1].readMs === 0 && q2[1].answerAt === q2[1].startedAt, q2 && q2[1].readMs);
    const v = await post('/api/vote', { r: c.roomCode, p: p.playerId, c: 0 }); ck(S + ' after restart instant vote', v._s === 204, v); L.close(); }
  { // Reveal Now with answers in flight
    const c = await post('/api/room/create', payload('wyr', 0, 30000, false, 'points', 0));
    const p = await post('/api/room/join', { roomCode: c.roomCode, name: 'J' }); const H = listen(c.roomCode, 'host');
    await H.wait('state:sync'); await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); await sleep(800);
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'reveal' });
    await sleep(400); const v = await post('/api/vote', { r: c.roomCode, p: p.playerId, c: 1, e: 700 });
    ck(S + ' in-flight vote within grace accepted', v._s === 204, v);
    const rv = await H.wait('results:reveal', 2500); ck(S + ' in-flight vote counted', !!rv && rv[1].counts[1] === 1, rv && rv[1].counts); H.close(); }
  { // elapsed clamp
    const c = await post('/api/room/create', payload('quiz', 0, 10000, false, 'points', 0));
    const a = await post('/api/room/join', { roomCode: c.roomCode, name: 'Fast' }), b = await post('/api/room/join', { roomCode: c.roomCode, name: 'Liar' });
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'start' }); await sleep(900);
    await post('/api/vote', { r: c.roomCode, p: a.playerId, c: 0, e: 1 }); await post('/api/vote', { r: c.roomCode, p: b.playerId, c: 0, e: 99999 });
    await post('/api/host', { roomCode: c.roomCode, hostToken: c.hostToken, action: 'reveal' }); await sleep(1500);
    const rep = await get('/api/report?room=' + c.roomCode), lb = rep.leaderboard || [];
    const fa = lb.find((x) => x.name === 'Fast'), li = lb.find((x) => x.name === 'Liar');
    ck(S + ' clamp floor 250 ms', !!fa && fa.ms >= 250, fa); ck(S + ' clamp future -> real', !!li && li.ms <= 1500, li); }
}

(async () => {
  const jobs = [];
  for (const mode of MODES) for (const R of READS) for (const T of TIMERS) for (const lock of LOCKS) for (const score of SCORES) for (const path of PATHS)
    jobs.push([mode, R, T, lock, score, path, 0]);
  for (const mode of MODES) for (const R of [READS[0], READS[1]]) for (const lock of LOCKS) for (const auto of [15000, 6000])
    jobs.push([mode, R, TIMERS[4], lock, 'points', 'create', auto]);
  console.log('\n=== PERMUTATION TEST: ' + jobs.length + ' combinations (' + MODES.length + ' modes × ' + READS.length + ' reading × ' + TIMERS.length + ' answering × lock × scoring × create/reconfigure, + auto-advance) ===');
  const t0 = Date.now(); let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => { while (i < jobs.length) { const j = jobs[i++]; try { await combo(...j); } catch (e) { ck(j.join('|') + ' crashed', false, e.message); } } }));
  console.log('   combinations done in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  await scenarios();
  fails.forEach((f) => console.log('   FAIL  ' + f));
  console.log('\n=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===\n'); process.exit(fail ? 1 : 0);
})();
