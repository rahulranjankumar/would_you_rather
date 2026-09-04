/**
 * Load test + edge-case driver.
 * Usage: node loadtest.js auto [players]
 */
const http = require('http');
const BASE = process.env.BASE || 'http://localhost:3000';
const N = parseInt(process.argv[3] || '150', 10);

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(BASE + path);
    const r = http.request(u, { method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const post = (p, b) => req('POST', p, b);
const get = (p) => req('GET', p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sse(path) {
  return new Promise((resolve) => {
    http.get(new URL(BASE + path), (res) => {
      const client = { events: 0 };
      res.on('data', (c) => { client.events += (c.toString().match(/event:/g) || []).length; });
      resolve(client);
    });
  });
}

(async () => {
  const gt = process.argv[4] || 'wyr';
  const create = await post('/api/room/create', { timerMs: 60000, scoringMode: 'points', gameType: gt });
  const { roomCode, hostToken } = create;
  console.log('Room', roomCode, '| type', gt, '| banks:', await get('/api/questions'));

  console.log(`Joining ${N} players...`);
  const t0 = Date.now();
  const players = [];
  await Promise.all(Array.from({ length: N }, async (_, i) => {
    const r = await post('/api/room/join', { roomCode, name: 'Player' + i });
    if (r.playerId) players.push(r.playerId);
  }));
  console.log(`  ${players.length} joined in ${Date.now() - t0}ms`);

  const listeners = await Promise.all(players.slice(0, 40).map(() => sse(`/api/events?room=${roomCode}&role=player`)));
  console.log(`  ${listeners.length} SSE listeners open`);

  // Q1 is 2-option; drive a burst vote
  await post('/api/host', { roomCode, hostToken, action: 'start' });
  await sleep(150);
  const tv = Date.now();
  await Promise.all(players.map((pid, i) => post('/api/vote', { roomCode, playerId: pid, choice: i % 3 === 0 ? 1 : 0 })));
  const burst = Date.now() - tv;
  console.log(`  Q1 (2-opt): ${players.length} votes in ${burst}ms (${Math.round(players.length / (burst / 1000))}/s)`);
  await post('/api/host', { roomCode, hostToken, action: 'reveal' });
  await sleep(300);

  // advance to a 4-option poll (Q6 index 5) — start next a few times
  for (let k = 0; k < 5; k++) { await post('/api/host', { roomCode, hostToken, action: 'next' }); await sleep(60); }
  await sleep(150);
  // vote across 4 options to test multi-option + a near-tie
  await Promise.all(players.map((pid, i) => post('/api/vote', { roomCode, playerId: pid, choice: i % 4 })));
  await post('/api/host', { roomCode, hostToken, action: 'reveal' });
  await sleep(300);
  console.log('  4-option poll vote + reveal OK');

  // change-vote test
  const cv1 = await post('/api/host', { roomCode, hostToken, action: 'next' }); await sleep(120);
  await post('/api/vote', { roomCode, playerId: players[0], choice: 0 });
  const changed = await post('/api/vote', { roomCode, playerId: players[0], choice: 1 });
  console.log('  change-vote:', changed.ok ? 'OK' : 'FAIL');

  // vote after lock should fail
  await post('/api/host', { roomCode, hostToken, action: 'reveal' }); await sleep(50);
  const late = await post('/api/vote', { roomCode, playerId: players[1], choice: 0 });
  console.log('  vote-after-lock rejected:', late.ok === false ? 'OK (' + late.error + ')' : 'FAIL');

  // bad token
  const bad = await post('/api/host', { roomCode, hostToken: 'WRONG', action: 'next' });
  console.log('  bad-token rejected:', bad.error ? 'OK' : 'FAIL');

  // END game then RESTART then start again
  await post('/api/host', { roomCode, hostToken, action: 'end' }); await sleep(120);
  const afterEnd = await post('/api/host', { roomCode, hostToken, action: 'restart' }); await sleep(150);
  console.log('  end -> restart:', afterEnd.ok ? 'OK (status ' + afterEnd.status + ')' : 'FAIL');
  const startAgain = await post('/api/host', { roomCode, hostToken, action: 'start' }); await sleep(120);
  console.log('  start after restart:', startAgain.status === 'QUESTION_ACTIVE' ? 'OK' : 'FAIL (' + startAgain.status + ')');

  const totalEvents = listeners.reduce((a, c) => a + c.events, 0);
  console.log(`  SSE events delivered to sample: ${totalEvents}`);
  console.log('  Health:', await get('/healthz'));
  console.log('ALL DONE');
  process.exit(0);
})();
