/**
 * WOULD YOU RATHER + QUIZ — Accenture × Currys Fun Friday
 * Made by PPA Warriors
 *
 * Optimised for ONE large room (~700 players). See DECISIONS.md.
 *  - Pre-serialised SSE frames (1 stringify per event, not per client)
 *  - Role-split fan-out (progress/roster → host+screen only, ~2 sockets)
 *  - Shared reveal payload; clients derive their own verdict
 *  - Reading phase + answer stopwatch from server timestamps (no extra events)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSETS_DIR = path.join(__dirname, 'assets');
const DEFAULT_TIMER_MS = parseInt(process.env.DEFAULT_TIMER_MS || '20000', 10);
const DEFAULT_READ_MS = parseInt(process.env.DEFAULT_READ_MS || '5000', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '700', 10);
const PROGRESS_HZ = parseInt(process.env.PROGRESS_HZ || '4', 10);
const HIGH_WATER = 512 * 1024;

function normalizeBank(raw, requireCorrect) {
  if (!Array.isArray(raw)) throw new Error('not an array');
  const list = raw.map((q) => {
    const options = Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [];
    const item = { round: String(q.round || ''), category: String(q.category || 'Question'), prompt: String(q.prompt || 'Would you rather…'), options };
    if (requireCorrect || q.correct !== undefined) { const c = Number(q.correct); item.correct = Number.isInteger(c) && c >= 0 && c < options.length ? c : 0; }
    return item;
  }).filter((q) => q.options.length >= 2);
  if (!list.length) throw new Error('no valid questions');
  return list;
}
function loadBank(file, rc) {
  try { return normalizeBank(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')), rc); }
  catch (e) { console.error('Bank ' + file + ':', e.message);
    return rc ? [{ round: '', category: 'Quiz', prompt: 'Sample?', options: ['Right', 'Wrong'], correct: 0 }]
              : [{ round: '', category: 'Fun', prompt: 'Would you rather…', options: ['Option A', 'Option B'] }]; }
}
const BANKS = { wyr: loadBank('questions.json', false), quiz: loadBank('quiz.json', true) };

const rooms = new Map();
const makeCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let x; do { x = Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join(''); } while (rooms.has(x)); return x; };
const normType = (t) => (t === 'quiz' ? 'quiz' : 'wyr');
const clampTimer = (ms) => { const n = parseInt(ms, 10); return Number.isNaN(n) ? DEFAULT_TIMER_MS : Math.max(5000, Math.min(300000, n)); };
const clampRead = (ms) => { const n = parseInt(ms, 10); return Number.isNaN(n) ? DEFAULT_READ_MS : Math.max(0, Math.min(30000, n)); };

function pickQuestions(room, enabled, custom) {
  const bank = custom || BANKS[room.settings.gameType] || BANKS.wyr;
  let chosen = bank;
  if (Array.isArray(enabled) && enabled.length) { const s = new Set(enabled.map(Number)); chosen = bank.filter((_, i) => s.has(i)); }
  if (!chosen.length) chosen = bank;
  room.questions = chosen.map((q, i) => ({ id: i, ...q }));
}
function createRoom(s = {}) {
  const room = {
    code: makeCode(), hostToken: crypto.randomBytes(16).toString('hex'), status: 'LOBBY',
    settings: { gameType: normType(s.gameType), scoringMode: s.scoringMode === 'fun' ? 'fun' : 'points',
      timerMs: clampTimer(s.timerMs), readMs: clampRead(s.readMs), lockIn: !!s.lockIn },
    customBank: null, questions: [], currentIndex: -1,
    players: new Map(), seqNext: 1,
    playerClients: new Set(), ctrlClients: new Set(),
    round: null, history: [], report: null, createdAt: Date.now(),
  };
  if (s.customBank) { try { room.customBank = normalizeBank(s.customBank, false); } catch (_) {} }
  pickQuestions(room, s.enabled, room.customBank);
  rooms.set(room.code, room);
  return room;
}

const frame = (ev, d) => Buffer.from('event: ' + ev + '\ndata: ' + JSON.stringify(d) + '\n\n');
const PING = Buffer.from(': ping\n\n');
function w(c, buf, disposable) { const r = c.res; if (disposable && r.writableLength > HIGH_WATER) return; try { r.write(buf); } catch (_) {} }
function fanout(set, buf, d) { for (const c of set) w(c, buf, d); }
function fanoutAll(room, buf, d) { fanout(room.playerClients, buf, d); fanout(room.ctrlClients, buf, d); }

function addClient(room, res, sock, role, playerId) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  if (sock) { sock.setNoDelay(true); sock.setKeepAlive(true, 30000); }
  const c = { res, role, playerId };
  const set = (role === 'host' || role === 'screen') ? room.ctrlClients : room.playerClients;
  set.add(c);
  res.on('close', () => set.delete(c));
  w(c, frame('state:sync', buildSync(room, playerId)), false);
}
const pubQ = (q) => (q ? { id: q.id, round: q.round, category: q.category, prompt: q.prompt, options: q.options } : null);

function buildSync(room, playerId) {
  const p = playerId ? room.players.get(playerId) : null;
  const q = room.currentIndex >= 0 ? room.questions[room.currentIndex] : null;
  let timer = null, hasVoted = false, yourChoice = null, locked = false;
  if (room.round) {
    const r = room.round;
    timer = { startedAt: r.startedAt, answerAt: r.answerAt, durationMs: r.durationMs, readMs: r.readMs, remaining: Math.max(0, r.answerAt + r.durationMs - Date.now()) };
    if (playerId && r.choices.has(playerId)) { hasVoted = true; yourChoice = r.choices.get(playerId); locked = r.locked.has(playerId); }
  }
  const results = room.status === 'RESULTS' && room.round ? computeResults(room) : null;
  return { status: room.status, roomCode: room.code, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode,
    timerMs: room.settings.timerMs, readMs: room.settings.readMs, lockIn: room.settings.lockIn,
    playerCount: room.players.size, totalQuestions: room.questions.length, questionNumber: room.currentIndex + 1,
    question: pubQ(q), timer, hasVoted, yourChoice, locked,
    yourScore: p ? p.score : 0, yourName: p ? p.name : null, results, leaderboard: lbTop(room, 10) };
}

function clearTimers(room) { const r = room.round; if (!r) return; if (r.t1) { clearTimeout(r.t1); r.t1 = null; } if (r.t2) { clearTimeout(r.t2); r.t2 = null; } }

function startQuestion(room) {
  clearTimers(room);
  if (room.currentIndex + 1 >= room.questions.length) return endGame(room);
  room.currentIndex++;
  const q = room.questions[room.currentIndex], n = q.options.length;
  const now = Date.now(), readMs = room.settings.readMs;
  room.status = 'QUESTION_ACTIVE';
  room.round = { questionId: q.id, optionCount: n, correct: room.settings.gameType === 'quiz' ? q.correct : null,
    startedAt: now, answerAt: now + readMs, readMs, durationMs: room.settings.timerMs,
    counts: new Int32Array(n), choices: new Map(), times: new Map(), locked: new Set(),
    t1: null, t2: null, dirty: false };
  fanoutAll(room, frame('question:show', { ...pubQ(q), startedAt: now, answerAt: now + readMs, readMs,
    durationMs: room.round.durationMs, questionNumber: room.currentIndex + 1, totalQuestions: room.questions.length,
    gameType: room.settings.gameType, lockIn: room.settings.lockIn }), false);
  room.round.t1 = setTimeout(() => lockVotes(room), readMs + room.round.durationMs);
}
function lockVotes(room) {
  if (!room.round || room.status !== 'QUESTION_ACTIVE') return;
  clearTimers(room); room.status = 'LOCKED';
  fanoutAll(room, frame('votes:locked', { questionId: room.round.questionId }), false);
  room.round.t2 = setTimeout(() => revealResults(room), 1200);
}
function computeResults(room) {
  const counts = Array.from(room.round.counts);
  let total = 0, max = 0;
  for (let i = 0; i < counts.length; i++) { total += counts[i]; if (counts[i] > max) max = counts[i]; }
  const percents = counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
  const winners = total > 0 ? counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0) : [];
  return { counts, percents, total, winners, correct: room.round.correct };
}
function revealResults(room) {
  if (!room.round || room.status !== 'LOCKED') return;
  clearTimers(room); room.status = 'RESULTS';
  const r = room.round, res = computeResults(room);
  const on = room.settings.scoringMode === 'points', needLock = room.settings.lockIn, quiz = room.settings.gameType === 'quiz';
  const winSet = new Set(res.winners), allTie = res.winners.length >= r.optionCount;
  for (const [pid, ch] of r.choices) {
    const p = room.players.get(pid); if (!p) continue;
    const t = r.times.get(pid);
    p.lastChoice = ch; p.lastMs = t == null ? null : t; p.lastLocked = r.locked.has(pid);
    p.answered = (p.answered || 0) + 1;
    if (t != null) p.totalTime = (p.totalTime || 0) + t;
    const good = quiz ? (res.correct != null && ch === res.correct) : (!allTie && winSet.has(ch));
    p.lastGood = quiz ? good : null;
    if (!on) continue;
    if (needLock && !r.locked.has(pid)) continue;
    if (!good) continue;
    const ratio = t == null ? 0 : Math.max(0, 1 - t / r.durationMs);
    p.score += 100 + Math.round(50 * ratio);
    p.correctCount = (p.correctCount || 0) + 1;
  }
  const q = room.questions[room.currentIndex];
  room.history.push({ n: room.currentIndex + 1, round: q.round, category: q.category, prompt: q.prompt, options: q.options,
    counts: res.counts, percents: res.percents, total: res.total, winners: res.winners, correct: res.correct });
  fanoutAll(room, frame('results:reveal', { ...res, gameType: room.settings.gameType, questionId: r.questionId }), false);
  fanoutAll(room, frame('leaderboard:update', { top: lbTop(room, 10) }), false);
}
function endGame(room) {
  clearTimers(room); room.status = 'GAME_OVER'; room.report = buildReport(room);
  fanoutAll(room, frame('game:over', { leaderboard: lbTop(room, 20), totalPlayers: room.players.size,
    totalQuestions: room.history.length, scoringMode: room.settings.scoringMode, hasReport: true }), false);
}
function buildReport(room) {
  const ps = [...room.players.values()], withT = ps.filter((p) => p.answered > 0);
  const fast = withT.slice().sort((a, b) => a.totalTime / a.answered - b.totalTime / b.answered)[0];
  const most = ps.slice().sort((a, b) => (b.answered || 0) - (a.answered || 0))[0];
  const contr = room.settings.gameType === 'wyr' ? ps.slice().sort((a, b) => (a.correctCount || 0) / Math.max(1, a.answered || 1) - (b.correctCount || 0) / Math.max(1, b.answered || 1))[0] : null;
  const div = room.history.map((h) => ({ n: h.n, prompt: h.prompt, c: Math.abs(50 - Math.max(...h.percents, 0)) })).sort((a, b) => a.c - b.c)[0];
  return { roomCode: room.code, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode,
    totalPlayers: room.players.size, totalQuestions: room.history.length, questions: room.history, leaderboard: lbTop(room, 100),
    superlatives: { fastest: fast ? { name: fast.name, avgMs: Math.round(fast.totalTime / fast.answered) } : null,
      mostAnswered: most ? { name: most.name, answered: most.answered || 0 } : null,
      mostContrarian: contr ? { name: contr.name } : null,
      mostDivisive: div ? { n: div.n, prompt: div.prompt } : null } };
}
function resetPlayers(room) { for (const p of room.players.values()) { p.score = 0; p.lastChoice = null; p.lastGood = null; p.lastMs = null; p.lastLocked = false; p.answered = 0; p.correctCount = 0; p.totalTime = 0; } }
function restartGame(room) { clearTimers(room); resetPlayers(room); room.currentIndex = -1; room.round = null; room.history = []; room.report = null; room.status = 'LOBBY';
  fanoutAll(room, frame('game:restart', { playerCount: room.players.size, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode, lockIn: room.settings.lockIn, readMs: room.settings.readMs }), false); }
function reconfigure(room, s) {
  clearTimers(room);
  if (s.gameType) room.settings.gameType = normType(s.gameType);
  if (s.scoringMode) room.settings.scoringMode = s.scoringMode === 'fun' ? 'fun' : 'points';
  if (s.timerMs) room.settings.timerMs = clampTimer(s.timerMs);
  if (s.readMs !== undefined) room.settings.readMs = clampRead(s.readMs);
  if (s.lockIn !== undefined) room.settings.lockIn = !!s.lockIn;
  if (s.customBank) { try { room.customBank = normalizeBank(s.customBank, false); } catch (_) {} }
  if (s.clearCustom) room.customBank = null;
  pickQuestions(room, s.enabled, room.customBank);
  resetPlayers(room); room.currentIndex = -1; room.round = null; room.history = []; room.report = null; room.status = 'LOBBY';
  fanoutAll(room, frame('game:restart', { playerCount: room.players.size, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode, lockIn: room.settings.lockIn, readMs: room.settings.readMs }), false);
}
function lbTop(room, n) {
  const a = [...room.players.values()]; a.sort((x, y) => y.score - x.score);
  const out = [];
  for (let i = 0; i < Math.min(n, a.length); i++) { const p = a[i];
    out.push({ rank: i + 1, name: p.name, score: p.score, last: p.lastChoice == null ? null : p.lastChoice,
      lastGood: p.lastGood == null ? null : p.lastGood, ms: p.lastMs == null ? null : p.lastMs, lk: !!p.lastLocked }); }
  return out;
}
function recordVote(room, pid, raw, lockIt) {
  const r = room.round;
  if (room.status !== 'QUESTION_ACTIVE' || !r) return 0;
  const p = room.players.get(pid); if (!p) return 1;
  const ch = raw | 0; if (ch < 0 || ch >= r.optionCount) return 2;
  if (r.locked.has(pid)) return 3;
  const now = Date.now();
  if (now < r.answerAt) return 4;
  const prev = r.choices.get(pid);
  if (prev !== ch) { if (prev !== undefined) r.counts[prev]--; r.counts[ch]++; r.choices.set(pid, ch); r.dirty = true; }
  const elapsed = now - r.answerAt;
  if (lockIt) { r.locked.add(pid); r.times.set(pid, elapsed); r.dirty = true; }
  else if (!room.settings.lockIn) r.times.set(pid, elapsed);
  else if (!r.times.has(pid)) r.times.set(pid, elapsed);
  return 9;
}
setInterval(() => {
  for (const room of rooms.values()) {
    const r = room.round;
    if (!r || room.status !== 'QUESTION_ACTIVE' || !r.dirty) continue;
    r.dirty = false;
    const votedSeq = [], lockedSeq = [];
    for (const [pid] of r.choices) { const p = room.players.get(pid); if (!p) continue; (r.locked.has(pid) ? lockedSeq : votedSeq).push(p.seq); }
    fanout(room.ctrlClients, frame('vote:progress', { votedCount: r.choices.size, lockedCount: r.locked.size,
      totalCount: room.players.size, counts: Array.from(r.counts), voted: votedSeq, locked: lockedSeq }), true);
  }
}, Math.max(100, Math.floor(1000 / PROGRESS_HZ)));
setInterval(() => { for (const room of rooms.values()) { fanout(room.playerClients, PING, true); fanout(room.ctrlClients, PING, true); } }, 15000);
setInterval(() => { const n = Date.now(); for (const [c, r] of rooms) if (n - r.createdAt > 12 * 3600 * 1000) rooms.delete(c); }, 3600 * 1000);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const sendJSON = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
function serveStatic(req, res, u) {
  let rel = u;
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/host') rel = '/host.html'; if (rel === '/play') rel = '/play.html';
  if (rel === '/screen') rel = '/screen.html'; if (rel === '/report') rel = '/report.html';
  let base = PUBLIC_DIR;
  if (rel.startsWith('/assets/')) { base = ASSETS_DIR; rel = rel.replace('/assets', ''); }
  const fp = path.join(base, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fp.startsWith(base)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' }); res.end(d); });
}
const readBody = (req, lim) => new Promise((rs) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > (lim || 2e5)) req.destroy(); }); req.on('end', () => { try { rs(JSON.parse(d || '{}')); } catch { rs({}); } }); });
const clean = (n) => String(n || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Player';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://h'), p = url.pathname;
  if (p === '/api/events' && req.method === 'GET') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    if (!room) { res.writeHead(404); return res.end('room not found'); }
    return addClient(room, res, req.socket, url.searchParams.get('role') || 'player', url.searchParams.get('playerId') || null);
  }
  if (p === '/api/vote' && req.method === 'POST') {
    const b = await readBody(req, 512);
    const room = rooms.get(String(b.r || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { e: 'Room not found' });
    const c = recordVote(room, b.p, b.c, !!b.lock);
    if (c === 9) { res.writeHead(204); return res.end(); }
    return sendJSON(res, 400, { e: { 0: 'Voting is closed', 1: 'Unknown player — please rejoin', 2: 'Invalid choice', 3: 'Your answer is locked in', 4: 'Still reading time — hold on!' }[c] || 'error' });
  }
  if (p === '/api/room/create' && req.method === 'POST') { const b = await readBody(req, 3e5); const r = createRoom(b);
    return sendJSON(res, 200, { roomCode: r.code, hostToken: r.hostToken, settings: r.settings, questionCount: r.questions.length }); }
  if (p === '/api/room/verify' && req.method === 'POST') { const b = await readBody(req); const r = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!r) return sendJSON(res, 200, { ok: false, reason: 'no_room' });
    if (b.hostToken && b.hostToken !== r.hostToken) return sendJSON(res, 200, { ok: false, reason: 'bad_token' });
    return sendJSON(res, 200, { ok: true, status: r.status, playerCount: r.players.size, settings: r.settings }); }
  if (p === '/api/room/join' && req.method === 'POST') {
    const b = await readBody(req); const room = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found — check the code' });
    if (b.playerId && room.players.has(b.playerId)) return sendJSON(res, 200, { playerId: b.playerId, name: room.players.get(b.playerId).name });
    if (room.players.size >= MAX_PLAYERS) return sendJSON(res, 403, { error: 'Room is full' });
    let name = clean(b.name); const lo = name.toLowerCase();
    let dup = false; for (const pl of room.players.values()) if (pl.name.toLowerCase() === lo) { dup = true; break; }
    if (dup) { const s = new Set([...room.players.values()].map((x) => x.name.toLowerCase())); let i = 2; while (s.has((name + ' ' + i).toLowerCase())) i++; name = name + ' ' + i; }
    const id = crypto.randomBytes(8).toString('hex');
    room.players.set(id, { id, seq: room.seqNext++, name, score: 0, lastChoice: null, lastGood: null, lastMs: null, lastLocked: false, answered: 0, correctCount: 0, totalTime: 0, joinedAt: Date.now() });
    fanout(room.ctrlClients, frame('lobby:update', { playerCount: room.players.size, name, seq: room.seqNext - 1 }), true);
    return sendJSON(res, 200, { playerId: id, name });
  }
  if (p === '/api/roster' && req.method === 'GET') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found' });
    if (url.searchParams.get('hostToken') !== room.hostToken) return sendJSON(res, 403, { error: 'Not authorized' });
    const r = room.round;
    return sendJSON(res, 200, { total: room.players.size, players: [...room.players.values()].sort((a, b) => a.seq - b.seq)
      .map((p) => ({ seq: p.seq, name: p.name, score: p.score, voted: r ? r.choices.has(p.id) : false,
        locked: r ? r.locked.has(p.id) : false, choice: r && r.choices.has(p.id) ? r.choices.get(p.id) : null })) });
  }
  if (p === '/api/host' && req.method === 'POST') {
    const b = await readBody(req, 3e5); const room = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found' });
    if (b.hostToken !== room.hostToken) return sendJSON(res, 403, { error: 'Not authorized' });
    switch (b.action) {
      case 'start': case 'next': startQuestion(room); break;
      case 'lock': lockVotes(room); break;
      case 'reveal': if (room.status === 'QUESTION_ACTIVE') lockVotes(room); if (room.status === 'LOCKED') revealResults(room); break;
      case 'end': endGame(room); break;
      case 'restart': restartGame(room); break;
      case 'reconfigure': reconfigure(room, b); break;
      default: return sendJSON(res, 400, { error: 'Unknown action' });
    }
    return sendJSON(res, 200, { ok: true, status: room.status, settings: room.settings, questionCount: room.questions.length });
  }
  if (p === '/api/bank' && req.method === 'GET') { const t = normType(url.searchParams.get('type'));
    return sendJSON(res, 200, { type: t, questions: BANKS[t].map((q, i) => ({ i, round: q.round, category: q.category, prompt: q.prompt, options: q.options, correct: q.correct })) }); }
  if (p === '/api/report' && req.method === 'GET') { const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found' });
    if (!room.report) room.report = buildReport(room);
    return sendJSON(res, 200, room.report); }
  if (p === '/healthz') { const m = process.memoryUsage(); return sendJSON(res, 200, { ok: true, rooms: rooms.size, uptime: process.uptime(), rssMB: Math.round(m.rss / 1048576) }); }
  if (req.method === 'GET') return serveStatic(req, res, p);
  res.writeHead(404); res.end('Not found');
});
server.headersTimeout = 0; server.requestTimeout = 0; server.keepAliveTimeout = 76000;
server.listen(PORT, () => {
  console.log('\n  Would You Rather + Quiz — Accenture × Currys  |  Made by PPA Warriors');
  console.log('  http://localhost:' + PORT + '   Host: /host');
  console.log('  Banks: WYR=' + BANKS.wyr.length + ' Quiz=' + BANKS.quiz.length + '  MAX_PLAYERS=' + MAX_PLAYERS + '\n');
});
