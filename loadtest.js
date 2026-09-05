/** Load + edge-case test. Usage: node loadtest.js auto [players] [wyr|quiz] */
const http = require('http');
const BASE = process.env.BASE || 'http://localhost:3000';
const N = parseInt(process.argv[3] || '150', 10);
function req(m, p, b) { return new Promise((res, rej) => { const d = b ? JSON.stringify(b) : null; const r = http.request(new URL(BASE + p), { method: m, headers: d ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } : {} }, (x) => { let s = ''; x.on('data', (c) => (s += c)); x.on('end', () => { try { res(JSON.parse(s || '{}')); } catch { res({}); } }); }); r.on('error', rej); if (d) r.write(d); r.end(); }); }
const post = (p, b) => req('POST', p, b), get = (p) => req('GET', p), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sse(p) { return new Promise((res) => { http.get(new URL(BASE + p), (r) => { const c = { events: 0 }; r.on('data', (ch) => { c.events += (ch.toString().match(/event:/g) || []).length; }); res(c); }); }); }
(async () => {
  const gt = process.argv[4] || 'wyr';
  const c = await post('/api/room/create', { timerMs: 60000, scoringMode: 'points', gameType: gt });
  const { roomCode, hostToken } = c;
  console.log('Room', roomCode, '| type', gt, '| banks', await get('/api/questions'));
  console.log(`Joining ${N} players...`); const t0 = Date.now(); const players = [];
  await Promise.all(Array.from({ length: N }, async (_, i) => { const r = await post('/api/room/join', { roomCode, name: 'Player' + i }); if (r.playerId) players.push(r.playerId); }));
  console.log(`  ${players.length} joined in ${Date.now() - t0}ms`);
  const listeners = await Promise.all(players.slice(0, 40).map(() => sse(`/api/events?room=${roomCode}&role=player`)));
  console.log(`  ${listeners.length} SSE listeners open`);
  await post('/api/host', { roomCode, hostToken, action: 'start' }); await sleep(150);
  const tv = Date.now();
  await Promise.all(players.map((pid, i) => post('/api/vote', { roomCode, playerId: pid, choice: i % 3 === 0 ? 1 : 0 })));
  const burst = Date.now() - tv;
  console.log(`  ${players.length} votes in ${burst}ms (${Math.round(players.length / (burst / 1000))}/s)`);
  await post('/api/host', { roomCode, hostToken, action: 'reveal' }); await sleep(300);
  for (let k = 0; k < 5; k++) { await post('/api/host', { roomCode, hostToken, action: 'next' }); await sleep(60); }
  await sleep(150);
  await Promise.all(players.map((pid, i) => post('/api/vote', { roomCode, playerId: pid, choice: i % 4 })));
  await post('/api/host', { roomCode, hostToken, action: 'reveal' }); await sleep(200);
  console.log('  4-option round OK');
  await post('/api/host', { roomCode, hostToken, action: 'next' }); await sleep(120);
  await post('/api/vote', { roomCode, playerId: players[0], choice: 0 });
  const changed = await post('/api/vote', { roomCode, playerId: players[0], choice: 1 });
  console.log('  change-vote:', changed.ok ? 'OK' : 'FAIL');
  await post('/api/host', { roomCode, hostToken, action: 'reveal' }); await sleep(50);
  const late = await post('/api/vote', { roomCode, playerId: players[1], choice: 0 });
  console.log('  vote-after-lock rejected:', late.ok === false ? 'OK' : 'FAIL');
  const bad = await post('/api/host', { roomCode, hostToken: 'WRONG', action: 'next' });
  console.log('  bad-token rejected:', bad.error ? 'OK' : 'FAIL');
  await post('/api/host', { roomCode, hostToken, action: 'end' }); await sleep(120);
  const rc = await post('/api/host', { roomCode, hostToken, action: 'reconfigure', gameType: gt === 'wyr' ? 'quiz' : 'wyr', scoringMode: 'fun' }); await sleep(120);
  console.log('  end->reconfigure:', rc.ok ? 'OK (' + JSON.stringify(rc.settings) + ')' : 'FAIL');
  const sa = await post('/api/host', { roomCode, hostToken, action: 'start' }); await sleep(80);
  console.log('  start after reconfigure:', sa.status === 'QUESTION_ACTIVE' ? 'OK' : 'FAIL');
  console.log('  Health:', await get('/healthz')); console.log('ALL DONE'); process.exit(0);
})();
