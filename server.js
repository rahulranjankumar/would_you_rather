/**
 * WOULD YOU RATHER + QUIZ — Multiplayer Web Game
 * Accenture Fun Friday activity — Currys project team
 * Dependency-free Node.js server. SSE real-time, server-authoritative timer.
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
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '350', 10);
const PROGRESS_THROTTLE_MS = 200;

function loadBank(file, requireCorrect) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    const list = raw.map((q) => {
      const options = Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [];
      const item = { category: String(q.category || 'Question'), prompt: String(q.prompt || ''), options };
      if (requireCorrect) { const c = Number(q.correct); item.correct = Number.isInteger(c) && c >= 0 && c < options.length ? c : 0; }
      return item;
    }).filter((q) => q.options.length >= 2);
    if (!list.length) throw new Error('empty');
    return list;
  } catch (e) {
    console.error('Bank load problem (' + file + '):', e.message);
    return requireCorrect ? [{ category: 'Quiz', prompt: 'Sample?', options: ['Right', 'Wrong'], correct: 0 }]
                          : [{ category: 'Fun', prompt: 'Would you rather\u2026', options: ['Option A', 'Option B'] }];
  }
}
const BANKS = { wyr: loadBank('questions.json', false), quiz: loadBank('quiz.json', true) };

const rooms = new Map();
function makeRoomCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let x; do { x = Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join(''); } while (rooms.has(x)); return x; }
function normGameType(t) { return t === 'quiz' ? 'quiz' : 'wyr'; }
function clampTimer(ms) { const n = parseInt(ms, 10); return Number.isNaN(n) ? DEFAULT_TIMER_MS : Math.max(5000, Math.min(120000, n)); }
function loadQuestionsInto(room) { const b = BANKS[room.settings.gameType] || BANKS.wyr; room.questions = b.map((q, i) => ({ id: i, ...q })); }

function createRoom(settings = {}) {
  const code = makeRoomCode();
  const room = {
    code, hostToken: crypto.randomBytes(16).toString('hex'), status: 'LOBBY',
    settings: { gameType: normGameType(settings.gameType), scoringMode: settings.scoringMode === 'fun' ? 'fun' : 'points', timerMs: clampTimer(settings.timerMs) },
    questions: [], currentIndex: -1, players: new Map(), clients: new Set(), round: null, createdAt: Date.now(),
  };
  loadQuestionsInto(room); rooms.set(code, room); return room;
}

function addClient(room, res, role, playerId) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  const client = { res, role, playerId };
  room.clients.add(client);
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 15000);
  res.on('close', () => { clearInterval(hb); room.clients.delete(client); });
  sendTo(client, 'state:sync', buildSync(room, playerId));
}
function sendTo(c, event, data) { try { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {} }
function broadcast(room, event, data) { for (const c of room.clients) sendTo(c, event, data); }
function broadcastSync(room) { for (const c of room.clients) sendTo(c, 'state:sync', buildSync(room, c.playerId)); }
function publicQuestion(q) { return q ? { id: q.id, category: q.category, prompt: q.prompt, options: q.options } : null; }

function buildSync(room, playerId) {
  const player = playerId ? room.players.get(playerId) : null;
  const q = room.currentIndex >= 0 ? room.questions[room.currentIndex] : null;
  let timer = null, hasVoted = false, yourChoice = null;
  if (room.round) {
    const remaining = Math.max(0, room.round.startedAt + room.round.durationMs - Date.now());
    timer = { startedAt: room.round.startedAt, durationMs: room.round.durationMs, remaining };
    if (playerId && room.round.choices.has(playerId)) { hasVoted = true; yourChoice = room.round.choices.get(playerId); }
  }
  const results = room.status === 'RESULTS' && room.round ? computeResults(room) : null;
  let yourChoiceWasMajority = null, yourCorrect = null;
  if (results && yourChoice != null) {
    yourChoiceWasMajority = results.winners.includes(yourChoice);
    if (room.settings.gameType === 'quiz' && results.correct != null) yourCorrect = yourChoice === results.correct;
  }
  return {
    status: room.status, roomCode: room.code, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode, timerMs: room.settings.timerMs,
    playerCount: room.players.size, totalQuestions: room.questions.length, questionNumber: room.currentIndex + 1,
    question: publicQuestion(q), timer, hasVoted, yourChoice, yourScore: player ? player.score : 0, yourName: player ? player.name : null,
    results, yourChoiceWasMajority, yourCorrect, leaderboard: leaderboardTop(room, 10),
  };
}

function clearRoundTimer(room) { if (!room.round) return; if (room.round.timer) { clearTimeout(room.round.timer); room.round.timer = null; } if (room.round.revealTimer) { clearTimeout(room.round.revealTimer); room.round.revealTimer = null; } }

function startQuestion(room) {
  clearRoundTimer(room);
  if (room.currentIndex + 1 >= room.questions.length) return endGame(room);
  room.currentIndex++;
  const q = room.questions[room.currentIndex];
  room.status = 'QUESTION_ACTIVE';
  room.round = { questionId: q.id, optionCount: q.options.length, correct: room.settings.gameType === 'quiz' ? q.correct : null, startedAt: Date.now(), durationMs: room.settings.timerMs, counts: new Array(q.options.length).fill(0), choices: new Map(), voteTimes: new Map(), timer: null, revealTimer: null, lastProgressSent: 0 };
  broadcast(room, 'question:show', { ...publicQuestion(q), startedAt: room.round.startedAt, durationMs: room.round.durationMs, questionNumber: room.currentIndex + 1, totalQuestions: room.questions.length, gameType: room.settings.gameType });
  broadcastSync(room);
  room.round.timer = setTimeout(() => lockVotes(room), room.round.durationMs);
}
function lockVotes(room) { if (room.status !== 'QUESTION_ACTIVE' || !room.round) return; clearRoundTimer(room); room.status = 'LOCKED'; broadcast(room, 'votes:locked', { questionId: room.round.questionId }); room.round.revealTimer = setTimeout(() => revealResults(room), 1400); }
function computeResults(room) { const counts = room.round.counts.slice(); const total = counts.reduce((a, b) => a + b, 0); const percents = counts.map((c) => (total ? Math.round((c / total) * 100) : 0)); const maxCount = Math.max(...counts, 0); const winners = total > 0 ? counts.map((c, i) => (c === maxCount ? i : -1)).filter((i) => i >= 0) : []; return { counts, percents, total, maxCount, winners, correct: room.round.correct }; }

function revealResults(room) {
  if (!room.round || room.status !== 'LOCKED') return;
  clearRoundTimer(room); room.status = 'RESULTS';
  const results = computeResults(room); const on = room.settings.scoringMode === 'points';
  if (on) {
    if (room.settings.gameType === 'quiz' && results.correct != null) {
      for (const [pid, choice] of room.round.choices.entries()) { const p = room.players.get(pid); if (p && choice === results.correct) { const t = room.round.voteTimes.get(pid) || room.round.durationMs; p.score += 100 + Math.round(50 * Math.max(0, 1 - t / room.round.durationMs)); } }
    } else if (room.settings.gameType === 'wyr' && results.winners.length && results.winners.length < room.round.optionCount) {
      for (const [pid, choice] of room.round.choices.entries()) { const p = room.players.get(pid); if (p && results.winners.includes(choice)) { const t = room.round.voteTimes.get(pid) || room.round.durationMs; p.score += 100 + Math.round(50 * Math.max(0, 1 - t / room.round.durationMs)); } }
    }
  }
  for (const c of room.clients) {
    const yc = c.playerId != null && room.round.choices.has(c.playerId) ? room.round.choices.get(c.playerId) : null;
    sendTo(c, 'results:reveal', { ...results, gameType: room.settings.gameType, yourChoice: yc, yourChoiceWasMajority: yc != null ? results.winners.includes(yc) : null, yourCorrect: yc != null && results.correct != null ? yc === results.correct : null, yourScore: c.playerId && room.players.get(c.playerId) ? room.players.get(c.playerId).score : 0 });
  }
  broadcast(room, 'leaderboard:update', { top: leaderboardTop(room, 10) });
}
function endGame(room) { clearRoundTimer(room); room.status = 'GAME_OVER'; broadcast(room, 'game:over', { leaderboard: leaderboardTop(room, 20), totalPlayers: room.players.size, totalQuestions: Math.max(0, room.currentIndex + 1), scoringMode: room.settings.scoringMode }); broadcastSync(room); }
function restartGame(room) { clearRoundTimer(room); for (const p of room.players.values()) p.score = 0; room.currentIndex = -1; room.round = null; room.status = 'LOBBY'; broadcast(room, 'game:restart', { playerCount: room.players.size, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode }); broadcastSync(room); }
function reconfigureGame(room, s) { clearRoundTimer(room); if (s.gameType) room.settings.gameType = normGameType(s.gameType); if (s.scoringMode) room.settings.scoringMode = s.scoringMode === 'fun' ? 'fun' : 'points'; if (s.timerMs) room.settings.timerMs = clampTimer(s.timerMs); loadQuestionsInto(room); for (const p of room.players.values()) p.score = 0; room.currentIndex = -1; room.round = null; room.status = 'LOBBY'; broadcast(room, 'game:restart', { playerCount: room.players.size, gameType: room.settings.gameType, scoringMode: room.settings.scoringMode }); broadcastSync(room); }
function leaderboardTop(room, n) { return [...room.players.values()].sort((a, b) => b.score - a.score).slice(0, n).map((p, i) => ({ rank: i + 1, name: p.name, score: p.score })); }

function recordVote(room, playerId, choiceRaw) {
  if (room.status !== 'QUESTION_ACTIVE' || !room.round) return { ok: false, error: 'Voting is closed' };
  if (!room.players.has(playerId)) return { ok: false, error: 'Unknown player \u2014 please rejoin' };
  const choice = Number(choiceRaw);
  if (!Number.isInteger(choice) || choice < 0 || choice >= room.round.optionCount) return { ok: false, error: 'Invalid choice' };
  const prev = room.round.choices.get(playerId);
  if (prev === choice) return { ok: true, unchanged: true };
  if (prev != null) room.round.counts[prev] = Math.max(0, room.round.counts[prev] - 1);
  room.round.counts[choice]++; room.round.choices.set(playerId, choice); room.round.voteTimes.set(playerId, Date.now() - room.round.startedAt);
  const now = Date.now();
  if (now - room.round.lastProgressSent > PROGRESS_THROTTLE_MS) { room.round.lastProgressSent = now; broadcast(room, 'vote:progress', { votedCount: room.round.choices.size, totalCount: room.players.size, counts: room.round.counts.slice() }); }
  return { ok: true };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function sendJSON(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function serveStatic(req, res, urlPath) {
  let rel = urlPath;
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/host') rel = '/host.html'; if (rel === '/play') rel = '/play.html'; if (rel === '/screen') rel = '/screen.html';
  let baseDir = PUBLIC_DIR;
  if (rel.startsWith('/assets/')) { baseDir = ASSETS_DIR; rel = rel.replace('/assets', ''); }
  const filePath = path.join(baseDir, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(baseDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' }); res.end(data); });
}
function readBody(req) { return new Promise((resolve) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } }); }); }
function sanitizeName(n) { return String(n || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Player'; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  if (p === '/api/events' && req.method === 'GET') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    if (!room) { res.writeHead(404); return res.end('room not found'); }
    const playerId = url.searchParams.get('playerId') || null;
    if (playerId && room.players.has(playerId)) room.players.get(playerId).lastSeen = Date.now();
    return addClient(room, res, url.searchParams.get('role') || 'player', playerId);
  }
  if (p === '/api/room/create' && req.method === 'POST') { const b = await readBody(req); const room = createRoom(b); return sendJSON(res, 200, { roomCode: room.code, hostToken: room.hostToken, settings: room.settings }); }
  if (p === '/api/room/verify' && req.method === 'POST') { const b = await readBody(req); const room = rooms.get(String(b.roomCode || '').toUpperCase()); if (!room) return sendJSON(res, 200, { ok: false, reason: 'no_room' }); if (b.hostToken && b.hostToken !== room.hostToken) return sendJSON(res, 200, { ok: false, reason: 'bad_token' }); return sendJSON(res, 200, { ok: true, status: room.status, playerCount: room.players.size, settings: room.settings }); }
  if (p === '/api/room/join' && req.method === 'POST') {
    const b = await readBody(req); const room = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found \u2014 check the code' });
    if (b.playerId && room.players.has(b.playerId)) { const pl = room.players.get(b.playerId); pl.lastSeen = Date.now(); return sendJSON(res, 200, { playerId: b.playerId, name: pl.name }); }
    if (room.players.size >= MAX_PLAYERS) return sendJSON(res, 403, { error: 'Room is full' });
    let name = sanitizeName(b.name); const existing = new Set([...room.players.values()].map((x) => x.name.toLowerCase()));
    if (existing.has(name.toLowerCase())) { let i = 2; while (existing.has(`${name} ${i}`.toLowerCase())) i++; name = `${name} ${i}`; }
    const playerId = crypto.randomBytes(8).toString('hex'); room.players.set(playerId, { id: playerId, name, score: 0, lastSeen: Date.now() });
    broadcast(room, 'lobby:update', { playerCount: room.players.size, name }); return sendJSON(res, 200, { playerId, name });
  }
  if (p === '/api/vote' && req.method === 'POST') { const b = await readBody(req); const room = rooms.get(String(b.roomCode || '').toUpperCase()); if (!room) return sendJSON(res, 404, { error: 'Room not found' }); const r = recordVote(room, b.playerId, b.choice); return sendJSON(res, r.ok ? 200 : 400, r); }
  if (p === '/api/host' && req.method === 'POST') {
    const b = await readBody(req); const room = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!room) return sendJSON(res, 404, { error: 'Room not found' });
    if (b.hostToken !== room.hostToken) return sendJSON(res, 403, { error: 'Not authorized' });
    switch (b.action) {
      case 'start': case 'next': startQuestion(room); break;
      case 'lock': lockVotes(room); break;
      case 'reveal': if (room.status === 'QUESTION_ACTIVE') lockVotes(room); if (room.status === 'LOCKED') revealResults(room); break;
      case 'end': endGame(room); break;
      case 'restart': restartGame(room); break;
      case 'reconfigure': reconfigureGame(room, b); break;
      case 'setTimer': room.settings.timerMs = clampTimer(b.timerMs); broadcastSync(room); break;
      default: return sendJSON(res, 400, { error: 'Unknown action' });
    }
    return sendJSON(res, 200, { ok: true, status: room.status, settings: room.settings });
  }
  if (p === '/api/questions' && req.method === 'GET') return sendJSON(res, 200, { wyr: BANKS.wyr.length, quiz: BANKS.quiz.length });
  if (p === '/healthz') return sendJSON(res, 200, { ok: true, rooms: rooms.size, uptime: process.uptime() });
  if (req.method === 'GET') return serveStatic(req, res, p);
  res.writeHead(404); res.end('Not found');
});
setInterval(() => { const now = Date.now(); for (const [code, room] of rooms) if (now - room.createdAt > 12 * 3600 * 1000) rooms.delete(code); }, 3600 * 1000);
server.listen(PORT, () => { console.log(`\n  Would You Rather + Quiz — Accenture x Currys\n  http://localhost:${PORT}   Host: /host`); console.log(`  Banks: WYR=${BANKS.wyr.length} Quiz=${BANKS.quiz.length}\n`); });
