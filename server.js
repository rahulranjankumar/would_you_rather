/**
 * WOULD YOU RATHER + QUIZ — Accenture x Currys Fun Friday · v27 "ARENA 2035"
 * Made by PPA Warriors. Zero dependencies (node core only).
 * Optimised for ONE large room (~700 players) over SSE.
 * v27 server changes are ADDITIVE and make the server cheaper:
 *   - lobby:update coalesced into the progress tick (join storms = 1 frame / tick)
 *   - serialised leaderboard cached per state (dirty flag)
 *   - votes may carry a client-measured elapsedMs (clamped server-side for fairness)
 *     and arrive with jitter; 1.2 s grace while LOCKED
 *   - emoji reactions are COUNTS per 500 ms tick, never per tap
 *   - host powers (chaos / drumroll / spotlight / freeze) are single tiny frames
 */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const PORT=process.env.PORT||3000;
const PUBLIC_DIR=path.join(__dirname,'public');
const ASSETS_DIR=path.join(__dirname,'assets');
const DEFAULT_TIMER_MS=parseInt(process.env.DEFAULT_TIMER_MS||'20000',10);
const DEFAULT_READ_MS=parseInt(process.env.DEFAULT_READ_MS||'5000',10);
const MAX_PLAYERS=parseInt(process.env.MAX_PLAYERS||'700',10);
const PROGRESS_HZ=parseInt(process.env.PROGRESS_HZ||'4',10);
const HIGH_WATER=512*1024;
// Public base URL for join links/QR (set on Render, e.g. https://fun-friday-arena.onrender.com).
// If unset, the host page falls back to its own origin.
const PUBLIC_URL=(process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'').replace(/\/+$/,'');
// Auto-advance: 0 = off, otherwise ms to wait on the results screen before the next question.
const clampAuto=(ms)=>{const n=parseInt(ms,10);return !n||Number.isNaN(n)?0:Math.max(5000,Math.min(120000,n));};

function normalizeBank(raw,requireCorrect){
  if(!Array.isArray(raw))throw new Error('not an array');
  const list=raw.map((q)=>{
    const options=Array.isArray(q.options)?q.options.map(String).slice(0,4):[];
    const item={round:String(q.round||''),category:String(q.category||'Question'),
      prompt:String(q.prompt||'Would you rather...'),options};
    if(requireCorrect||q.correct!==undefined){const c=Number(q.correct);
      item.correct=Number.isInteger(c)&&c>=0&&c<options.length?c:0;}
    return item;}).filter((q)=>q.options.length>=2);
  if(!list.length)throw new Error('no valid questions');
  return list;}
function loadBank(file,rc){
  try{return normalizeBank(JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8')),rc);}
  catch(e){console.error('Bank '+file+':',e.message);
    return rc?[{round:'',category:'Quiz',prompt:'Sample?',options:['Right','Wrong'],correct:0}]
             :[{round:'',category:'Fun',prompt:'Would you rather...',options:['Option A','Option B']}];}}
const BANKS={wyr:loadBank('questions.json',false),quiz:loadBank('quiz.json',true),
  hot:loadBank('hottakes.json',false),emoji:loadBank('emoji.json',true)};
/* v27 modes ride the SAME vote engine: Hot Takes = WYR bank, Emoji Decode = Quiz bank,
   Speed Round = 5 s timer + doubled speed bonus. */
const BANK_ENGINE={wyr:'wyr',quiz:'quiz',hot:'wyr',emoji:'quiz'};

const rooms=new Map();
const makeCode=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let x;do{x=Array.from({length:5},()=>c[Math.floor(Math.random()*c.length)]).join('');}while(rooms.has(x));return x;};
const normType=(t)=>(t==='quiz'?'quiz':'wyr');
const clampTimer=(ms)=>{const n=parseInt(ms,10);return Number.isNaN(n)?DEFAULT_TIMER_MS:Math.max(5000,Math.min(300000,n));};
const clampRead=(ms)=>{const n=parseInt(ms,10);return Number.isNaN(n)?DEFAULT_READ_MS:Math.max(0,Math.min(30000,n));};
function pickQuestions(room,enabled,custom){
  const bank=custom||BANKS[room.settings.bank]||BANKS[room.settings.gameType]||BANKS.wyr;
  let chosen=bank;
  if(Array.isArray(enabled)&&enabled.length){const s=new Set(enabled.map(Number));chosen=bank.filter((_,i)=>s.has(i));}
  if(!chosen.length)chosen=bank;
  room.questions=chosen.map((q,i)=>({id:i,...q}));}
function createRoom(s={}){
  const room={code:makeCode(),hostToken:crypto.randomBytes(16).toString('hex'),status:'LOBBY',
    settings:{gameType:BANK_ENGINE[s.bank]||normType(s.gameType),bank:BANK_ENGINE[s.bank]?s.bank:normType(s.gameType),speed:!!s.speed,
      teamMode:!!s.teamMode,skin:['diwali','holi','christmas'].includes(s.skin)?s.skin:'default',crew:s.crew!==false,reactions:s.reactions!==false,
      scoringMode:s.scoringMode==='fun'?'fun':'points',
      timerMs:clampTimer(s.timerMs),readMs:clampRead(s.readMs),lockIn:!!s.lockIn,autoNextMs:clampAuto(s.autoNextMs)},
    customBank:null,questions:[],currentIndex:-1,players:new Map(),seqNext:1,
    playerClients:new Set(),ctrlClients:new Set(),round:null,history:[],report:null,createdAt:Date.now(),
    pendJoin:[],joinDirty:false,lastPlayerLobby:0,lbCache:new Map(),react:[0,0,0,0,0,0,0,0],reactBy:new Map(),reactDirty:false,freeze:null};
  if(s.customBank){try{room.customBank=normalizeBank(s.customBank,false);}catch(_){}}
  pickQuestions(room,s.enabled,room.customBank);
  rooms.set(room.code,room);return room;}
const frame=(ev,d)=>Buffer.from('event: '+ev+'\ndata: '+JSON.stringify(d)+'\n\n');
const PING=Buffer.from(': ping\n\n');
function w(c,buf,disp){const r=c.res;if(disp&&r.writableLength>HIGH_WATER)return;try{r.write(buf);}catch(_){}}
function fanout(set,buf,d){for(const c of set)w(c,buf,d);}
function fanoutAll(room,buf,d){fanout(room.playerClients,buf,d);fanout(room.ctrlClients,buf,d);}
function addClient(room,res,sock,role,playerId){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',
    Connection:'keep-alive','X-Accel-Buffering':'no'});
  res.write('retry: 3000\n\n');
  if(sock){sock.setNoDelay(true);sock.setKeepAlive(true,30000);}
  const c={res,role,playerId};
  const set=(role==='host'||role==='screen')?room.ctrlClients:room.playerClients;
  set.add(c);res.on('close',()=>set.delete(c));
  const sync=buildSync(room,playerId);
  /* big screen/host joining late: the last 60 names once, so the name wall isn't empty */
  if(set===room.ctrlClients){const ps=[...room.players.values()].slice(-60);sync.recentNames=ps.map((p)=>p.name);sync.recentSk=ps.map((p)=>p.sk||'momo');}
  w(c,frame('state:sync',sync),false);}
const pubQ=(q)=>(q?{id:q.id,round:q.round,category:q.category,prompt:q.prompt,options:q.options}:null);
function buildSync(room,playerId){
  const p=playerId?room.players.get(playerId):null;
  const q=room.currentIndex>=0?room.questions[room.currentIndex]:null;
  let timer=null,hasVoted=false,yourChoice=null,locked=false;
  if(room.round){const r=room.round;
    timer={startedAt:r.startedAt,answerAt:r.answerAt,durationMs:r.durationMs,readMs:r.readMs,
      remaining:Math.max(0,r.answerAt+r.durationMs-Date.now())};
    if(playerId&&r.choices.has(playerId)){hasVoted=true;yourChoice=r.choices.get(playerId);locked=r.locked.has(playerId);}}
  const results=room.status==='RESULTS'&&room.round?computeResults(room):null;
  return {status:room.status,roomCode:room.code,gameType:room.settings.gameType,scoringMode:room.settings.scoringMode,
    timerMs:room.settings.timerMs,readMs:room.settings.readMs,lockIn:room.settings.lockIn,
    playerCount:room.players.size,totalQuestions:room.questions.length,questionNumber:room.currentIndex+1,
    question:pubQ(q),timer,hasVoted,yourChoice,locked,known:playerId?!!p:undefined,
    yourScore:p?p.score:0,yourName:p?p.name:null,results,leaderboard:lbTop(room,10),
    autoNextMs:room.settings.autoNextMs,autoNextAt:room.round&&room.round.autoNextAt||0,
    bank:room.settings.bank,speed:room.settings.speed,skin:room.settings.skin,crew:room.settings.crew,reactions:room.settings.reactions,teamMode:room.settings.teamMode};}
function clearTimers(room){const r=room.round;if(!r)return;if(r.t1){clearTimeout(r.t1);r.t1=null;}if(r.t2){clearTimeout(r.t2);r.t2=null;}if(r.t3){clearTimeout(r.t3);r.t3=null;}r.autoNextAt=0;}
function startQuestion(room){
  clearTimers(room);
  if(room.currentIndex+1>=room.questions.length)return endGame(room);
  room.currentIndex++;
  const q=room.questions[room.currentIndex],n=q.options.length;
  const now=Date.now(),readMs=room.settings.readMs;
  room.status='QUESTION_ACTIVE';
  room.round={questionId:q.id,optionCount:n,correct:room.settings.gameType==='quiz'?q.correct:null,
    startedAt:now,answerAt:now+readMs,readMs,durationMs:room.settings.timerMs,
    counts:new Int32Array(n),choices:new Map(),times:new Map(),locked:new Set(),t1:null,t2:null,dirty:false};
  fanoutAll(room,frame('question:show',{...pubQ(q),startedAt:now,answerAt:now+readMs,readMs,
    durationMs:room.round.durationMs,questionNumber:room.currentIndex+1,totalQuestions:room.questions.length,
    gameType:room.settings.gameType,scoringMode:room.settings.scoringMode,lockIn:room.settings.lockIn,
    bank:room.settings.bank,speed:room.settings.speed}),false);
  room.round.t1=setTimeout(()=>lockVotes(room),readMs+room.round.durationMs);}
function lockVotes(room){
  if(!room.round||room.status!=='QUESTION_ACTIVE')return;
  clearTimers(room);room.status='LOCKED';room.round.lockedAt=Date.now();room.freeze=null;
  fanoutAll(room,frame('votes:locked',{questionId:room.round.questionId}),false);
  room.round.t2=setTimeout(()=>revealResults(room),1200);}
function computeResults(room){
  const counts=Array.from(room.round.counts);
  let total=0,max=0;
  for(let i=0;i<counts.length;i++){total+=counts[i];if(counts[i]>max)max=counts[i];}
  const percents=counts.map((c)=>(total?Math.round((c/total)*100):0));
  const winners=total>0?counts.map((c,i)=>(c===max?i:-1)).filter((i)=>i>=0):[];
  return {counts,percents,total,winners,correct:room.round.correct};}
function revealResults(room){
  if(!room.round||room.status!=='LOCKED')return;
  clearTimers(room);room.status='RESULTS';
  const r=room.round,res=computeResults(room);
  const on=room.settings.scoringMode==='points',needLock=room.settings.lockIn,quiz=room.settings.gameType==='quiz';
  const winSet=new Set(res.winners),allTie=res.winners.length>=r.optionCount;
  let fastest=null;
  for(const [pid,ch] of r.choices){
    const p=room.players.get(pid);if(!p)continue;
    const t=r.times.get(pid);
    p.lastChoice=ch;p.lastMs=t==null?null:t;p.lastLocked=r.locked.has(pid);
    p.answered=(p.answered||0)+1;
    if(t!=null)p.totalTime=(p.totalTime||0)+t;
    const good=quiz?(res.correct!=null&&ch===res.correct):(!allTie&&winSet.has(ch));
    p.lastGood=quiz?good:null;
    if(good){p.streak=(p.streak||0)+1;p.bestStreak=Math.max(p.bestStreak||0,p.streak);p.crowd=(p.crowd||0)+(quiz?0:1);}else p.streak=0;
    if(good&&t!=null&&(!fastest||t<fastest.ms))fastest={name:p.name,ms:t};
    if(!on)continue;
    if(needLock&&!r.locked.has(pid))continue;
    if(!good)continue;
    const ratio=t==null?0:Math.max(0,1-t/r.durationMs);
    p.score+=100+Math.round((room.settings.speed?100:50)*ratio);
    p.correctCount=(p.correctCount||0)+1;}
  lbDirty(room);
  const q=room.questions[room.currentIndex];
  room.history.push({n:room.currentIndex+1,round:q.round,category:q.category,prompt:q.prompt,options:q.options,
    counts:res.counts,percents:res.percents,total:res.total,winners:res.winners,correct:res.correct,fastest});
  if(room.settings.autoNextMs){r.autoNextAt=Date.now()+room.settings.autoNextMs;
    r.t3=setTimeout(()=>{if(room.status==='RESULTS')startQuestion(room);},room.settings.autoNextMs);}
  fanoutAll(room,frame('results:reveal',{...res,gameType:room.settings.gameType,questionId:r.questionId,fastest,autoNextAt:r.autoNextAt||0}),false);
  fanoutAll(room,frame('leaderboard:update',{top:lbTop(room,10),teams:teamTotals(room)}),false);}
function teamTotals(room){
  const hit=room.lbCache.get('teams');if(hit)return hit;
  const m=new Map();for(const p of room.players.values()){if(!p.team)continue;const k=p.team.toLowerCase();const t=m.get(k)||{team:p.team,score:0,n:0};t.score+=p.score;t.n++;m.set(k,t);}
  const out=[...m.values()].sort((a,b)=>b.score-a.score).slice(0,8);room.lbCache.set('teams',out);return out;}
function endGame(room){
  clearTimers(room);room.status='GAME_OVER';room.report=buildReport(room);
  fanoutAll(room,frame('game:over',{leaderboard:lbTop(room,20),totalPlayers:room.players.size,
    totalQuestions:room.history.length,scoringMode:room.settings.scoringMode,hasReport:true}),false);}
function buildReport(room){
  const ps=[...room.players.values()],withT=ps.filter((p)=>p.answered>0);
  const fast=withT.slice().sort((a,b)=>a.totalTime/a.answered-b.totalTime/b.answered)[0];
  const most=ps.slice().sort((a,b)=>(b.answered||0)-(a.answered||0))[0];
  const contr=room.settings.gameType==='wyr'
    ?ps.slice().sort((a,b)=>(a.correctCount||0)/Math.max(1,a.answered||1)-(b.correctCount||0)/Math.max(1,b.answered||1))[0]:null;
  const div=room.history.map((h)=>({n:h.n,prompt:h.prompt,c:Math.abs(50-Math.max(...h.percents,0))})).sort((a,b)=>a.c-b.c)[0];
  return {roomCode:room.code,gameType:room.settings.gameType,scoringMode:room.settings.scoringMode,
    totalPlayers:room.players.size,totalQuestions:room.history.length,questions:room.history,leaderboard:lbTop(room,100),
    superlatives:{fastest:fast?{name:fast.name,avgMs:Math.round(fast.totalTime/fast.answered)}:null,
      mostAnswered:most?{name:most.name,answered:most.answered||0}:null,
      mostContrarian:contr?{name:contr.name}:null,
      mostDivisive:div?{n:div.n,prompt:div.prompt}:null,
      mostCrowd:(()=>{if(room.settings.gameType!=='wyr')return null;const m=ps.slice().sort((a,b)=>(b.crowd||0)-(a.crowd||0))[0];return m&&m.crowd?{name:m.name,n:m.crowd}:null;})(),
      longestStreak:(()=>{const m=ps.slice().sort((a,b)=>(b.bestStreak||0)-(a.bestStreak||0))[0];return m&&m.bestStreak?{name:m.name,n:m.bestStreak}:null;})(),
      avgMs:(()=>{let t=0,n=0;for(const p of withT){t+=p.totalTime;n+=p.answered;}return n?Math.round(t/n):null;})()}};}
function resetPlayers(room){lbDirty(room);for(const p of room.players.values()){
  p.score=0;p.lastChoice=null;p.lastGood=null;p.lastMs=null;p.lastLocked=false;
  p.answered=0;p.correctCount=0;p.totalTime=0;p.streak=0;p.bestStreak=0;p.crowd=0;}}
function restartPayload(room){return {playerCount:room.players.size,gameType:room.settings.gameType,
  scoringMode:room.settings.scoringMode,lockIn:room.settings.lockIn,readMs:room.settings.readMs,
  timerMs:room.settings.timerMs,autoNextMs:room.settings.autoNextMs,totalQuestions:room.questions.length};}
function restartGame(room){
  clearTimers(room);room.freeze=null;resetPlayers(room);
  room.currentIndex=-1;room.round=null;room.history=[];room.report=null;room.status='LOBBY';
  fanoutAll(room,frame('game:restart',restartPayload(room)),false);}
function reconfigure(room,s){
  clearTimers(room);
  if(s.gameType)room.settings.gameType=normType(s.gameType);
  if(s.bank&&BANK_ENGINE[s.bank]){room.settings.bank=s.bank;room.settings.gameType=BANK_ENGINE[s.bank];}else if(s.gameType)room.settings.bank=normType(s.gameType);
  if(s.speed!==undefined)room.settings.speed=!!s.speed;
  if(s.skin!==undefined)room.settings.skin=['diwali','holi','christmas'].includes(s.skin)?s.skin:'default';
  if(s.teamMode!==undefined)room.settings.teamMode=!!s.teamMode;
  if(s.crew!==undefined)room.settings.crew=!!s.crew;
  if(s.reactions!==undefined)room.settings.reactions=!!s.reactions;
  if(s.scoringMode)room.settings.scoringMode=s.scoringMode==='fun'?'fun':'points';
  if(s.timerMs)room.settings.timerMs=clampTimer(s.timerMs);
  if(s.readMs!==undefined)room.settings.readMs=clampRead(s.readMs);
  if(s.lockIn!==undefined)room.settings.lockIn=!!s.lockIn;
  if(s.autoNextMs!==undefined)room.settings.autoNextMs=clampAuto(s.autoNextMs);
  if(s.customBank){try{room.customBank=normalizeBank(s.customBank,false);}catch(_){}}
  if(s.clearCustom)room.customBank=null;
  pickQuestions(room,s.enabled,room.customBank);
  resetPlayers(room);
  room.currentIndex=-1;room.round=null;room.history=[];room.report=null;room.status='LOBBY';
  fanoutAll(room,frame('game:restart',restartPayload(room)),false);}
function lbDirty(room){room.lbCache.clear();}
function lbTop(room,n){
  const hit=room.lbCache.get(n);if(hit)return hit;
  const out=lbBuild(room,n);room.lbCache.set(n,out);return out;}
function lbBuild(room,n){
  const a=[...room.players.values()];
  a.sort((x,y)=>y.score-x.score||x.seq-y.seq);
  const out=[];
  for(let i=0;i<Math.min(n,a.length);i++){const p=a[i];
    out.push({rank:i+1,name:p.name,score:p.score,sk:p.sk,team:p.team||undefined,last:p.lastChoice==null?null:p.lastChoice,
      lastGood:p.lastGood==null?null:p.lastGood,ms:p.lastMs==null?null:p.lastMs,lk:!!p.lastLocked});}
  return out;}
const GRACE_MS=1200,MIN_ELAPSED=250;
function recordVote(room,pid,raw,lockIt,clientMs){
  const r=room.round;
  if(!r)return 0;
  const now=Date.now();
  /* late arrivals (jittered batches) are accepted for 1.2 s after the lock,
     but only if the device says the tap happened inside the timer */
  const late=room.status==='LOCKED'&&r.lockedAt&&now-r.lockedAt<=GRACE_MS&&clientMs!=null&&clientMs<=r.durationMs;
  if(room.status!=='QUESTION_ACTIVE'&&!late)return 0;
  const p=room.players.get(pid);if(!p)return 1;
  const ch=raw|0;if(ch<0||ch>=r.optionCount)return 2;
  if(r.locked.has(pid))return 3;
  if(now<r.answerAt)return 4;
  const prev=r.choices.get(pid);
  if(prev!==ch){if(prev!==undefined)r.counts[prev]--;r.counts[ch]++;r.choices.set(pid,ch);r.dirty=true;}
  /* fairness: the device measures its own tap time (no network wait), the server
     clamps it to [250 ms, time actually elapsed] so nobody can claim to be faster
     than physically possible */
  const real=now-r.answerAt-(r.frozenMs||0);
  let elapsed=real;
  if(clientMs!=null&&isFinite(clientMs))elapsed=Math.max(MIN_ELAPSED,Math.min(Math.round(clientMs),real));
  if(late)elapsed=Math.min(elapsed,r.durationMs);
  if(lockIt){r.locked.add(pid);r.times.set(pid,elapsed);r.dirty=true;}
  else if(!room.settings.lockIn)r.times.set(pid,elapsed);
  else if(!r.times.has(pid))r.times.set(pid,elapsed);
  return 9;}
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    /* coalesced joins: ONE lobby:update per tick to host/screen, at most 1/s to players */
    if(room.joinDirty){room.joinDirty=false;
      const names=room.pendJoin.splice(0,room.pendJoin.length);
      const last=names[names.length-1]||null;
      fanout(room.ctrlClients,frame('lobby:update',{playerCount:room.players.size,newNames:names.slice(-40).map((x)=>x.name),
        sidekicks:names.slice(-40).map((x)=>x.sk),name:last&&last.name,seq:last&&last.seq}),true);
      room.playerPend=(room.playerPend||[]).concat(names.map((x)=>x.name)).slice(-12);}
    if(room.playerPend&&room.playerPend.length&&now-room.lastPlayerLobby>=1000){room.lastPlayerLobby=now;
      fanout(room.playerClients,frame('lobby:update',{playerCount:room.players.size,newNames:room.playerPend}),true);room.playerPend=[];}
    /* reactions: counts per emoji per tick, to the big screen only */
    /* emoji: ONE batched frame per interval to everyone. The interval stretches with room size
       (≤60 players 0.5 s · ≤250 1 s · bigger 2 s) so 700 people spamming taps cost the same as 10. */
    const iv=room.players.size<=60?500:room.players.size<=250?1000:2000;
    if(room.reactDirty&&now-(room.lastReact||0)>=iv){room.reactDirty=false;room.lastReact=now;
      const who=[];for(const [pid,arr] of room.reactBy){const p=room.players.get(pid);if(!p)continue;
        for(let i=0;i<8;i++)if(arr[i])who.push([p.name,i,arr[i]]);}
      who.sort((a,b)=>b[2]-a[2]);
      const buf=frame('react',{c:room.react.slice(),who:who.slice(0,30),iv});
      fanout(room.ctrlClients,buf,true);if(room.settings.reactions!==false)fanout(room.playerClients,buf,true);
      room.react=[0,0,0,0,0,0,0,0];room.reactBy.clear();}
    const r=room.round;
    if(!r||room.status!=='QUESTION_ACTIVE'||!r.dirty)continue;
    r.dirty=false;
    const vs=[],ls=[];
    for(const [pid] of r.choices){const p=room.players.get(pid);if(!p)continue;
      (r.locked.has(pid)?ls:vs).push(p.seq);}
    fanout(room.ctrlClients,frame('vote:progress',{votedCount:r.choices.size,lockedCount:r.locked.size,
      totalCount:room.players.size,counts:Array.from(r.counts),voted:vs,locked:ls}),true);}
},Math.max(100,Math.floor(1000/PROGRESS_HZ)));
setInterval(()=>{for(const room of rooms.values()){fanout(room.playerClients,PING,true);fanout(room.ctrlClients,PING,true);}},15000);
setInterval(()=>{const n=Date.now();for(const [c,r] of rooms)if(n-r.createdAt>12*3600*1000)rooms.delete(c);},3600*1000);

const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.m4a':'audio/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4'};
const sendJSON=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(o));};
const ROUTES={'/':'/landing.html','':'/landing.html','/join':'/join.html','/host':'/host.html',
  '/play':'/play.html','/screen':'/screen.html','/report':'/report.html','/intro3d':'/intro3d.html',
  '/currys-logo.svg':'/assets/branding/currys.svg','/manifest.webmanifest':'/manifest.webmanifest'};
function serveStatic(req,res,u){
  let rel=ROUTES[u]||u, base=PUBLIC_DIR;
  if(rel.startsWith('/assets/')){base=ASSETS_DIR;rel=rel.slice('/assets'.length);}
  const fp=path.join(base,path.normalize(rel).replace(/^(\.\.[/\\])+/,''));
  if(!fp.startsWith(base)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(fp,(e,d)=>{
    if(e){if(!rel.startsWith('/assets/')&&!path.extname(rel)||/\.html$/.test(rel))return fs.readFile(path.join(PUBLIC_DIR,'404.html'),(e2,d2)=>{
        res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(e2?'Not found':d2);});
      res.writeHead(404);return res.end('Not found');}
    const noCache=/\/sw\.js$/.test(fp);
    const ext=path.extname(fp),versioned=/[?&]v=/.test(req.url||'');
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream',
      'Cache-Control':(noCache||ext==='.html')?'no-cache':versioned?'public, max-age=86400':'no-cache'});
    res.end(d);});}
const readBody=(req,lim)=>new Promise((rs)=>{
  let d='';req.on('data',(c)=>{d+=c;if(d.length>(lim||2e5))req.destroy();});
  req.on('end',()=>{try{rs(JSON.parse(d||'{}'));}catch{rs({});}});});
const clean=(n)=>String(n||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,20)||'Player';

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://h'),p=url.pathname;
  if(p==='/api/events'&&req.method==='GET'){
    const room=rooms.get((url.searchParams.get('room')||'').toUpperCase());
    if(!room){res.writeHead(404);return res.end('room not found');}
    return addClient(room,res,req.socket,url.searchParams.get('role')||'player',url.searchParams.get('playerId')||null);}
  if(p==='/api/vote'&&req.method==='POST'){
    const b=await readBody(req,512);
    const room=rooms.get(String(b.r||'').toUpperCase());
    if(!room)return sendJSON(res,404,{e:'Room not found'});
    const c=recordVote(room,b.p,b.c,!!b.lock,b.e==null?null:Number(b.e));
    if(c===9){res.writeHead(204);return res.end();}
    return sendJSON(res,400,{code:c,e:{0:'Voting is closed',1:'Unknown player - please rejoin',2:'Invalid choice',3:'Your answer is locked in',4:'Still reading time - hold on!'}[c]||'error'});}
  if(p==='/api/room/create'&&req.method==='POST'){
    const b=await readBody(req,3e5);const r=createRoom(b);
    return sendJSON(res,200,{roomCode:r.code,hostToken:r.hostToken,settings:r.settings,questionCount:r.questions.length});}
  if(p==='/api/room/verify'&&req.method==='POST'){
    const b=await readBody(req);const r=rooms.get(String(b.roomCode||'').toUpperCase());
    if(!r)return sendJSON(res,200,{ok:false,reason:'no_room'});
    if(b.hostToken&&b.hostToken!==r.hostToken)return sendJSON(res,200,{ok:false,reason:'bad_token'});
    const out={ok:true,status:r.status,playerCount:r.players.size,settings:r.settings,questionCount:r.questions.length};
    if(b.playerId){const p2=r.players.get(b.playerId);out.known=!!p2;if(p2)out.name=p2.name;}
    return sendJSON(res,200,out);}
  if(p==='/api/room/checkname'&&req.method==='POST'){
    const b=await readBody(req);const r=rooms.get(String(b.roomCode||'').toUpperCase());
    if(!r)return sendJSON(res,200,{ok:false});
    const lo=clean(b.name).toLowerCase();
    let taken=false;
    for(const pl of r.players.values())if(pl.name.toLowerCase()===lo){taken=true;break;}
    return sendJSON(res,200,{ok:true,taken});}
  if(p==='/api/room/join'&&req.method==='POST'){
    const b=await readBody(req);const room=rooms.get(String(b.roomCode||'').toUpperCase());
    if(!room)return sendJSON(res,404,{error:'Room not found - check the code'});
    if(b.playerId&&room.players.has(b.playerId))return sendJSON(res,200,{playerId:b.playerId,name:room.players.get(b.playerId).name,resumed:true});
    if(room.players.size>=MAX_PLAYERS)return sendJSON(res,403,{error:'Room is full'});
    let name=clean(b.name);const lo=name.toLowerCase();
    let dup=false;for(const pl of room.players.values())if(pl.name.toLowerCase()===lo){dup=true;break;}
    if(dup){const s=new Set([...room.players.values()].map((x)=>x.name.toLowerCase()));let i=2;
      while(s.has((name+' '+i).toLowerCase()))i++;name=name+' '+i;}
    const id=crypto.randomBytes(8).toString('hex');
    const sk=['momo','noodle','bean'].includes(b.sidekick)?b.sidekick:'momo';
    const team=b.team?String(b.team).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,18):null;
    room.players.set(id,{id,seq:room.seqNext++,name,sk,team,score:0,lastChoice:null,lastGood:null,lastMs:null,
      lastLocked:false,answered:0,correctCount:0,totalTime:0,joinedAt:Date.now()});
    room.pendJoin.push({name,seq:room.seqNext-1,sk});room.joinDirty=true;lbDirty(room);
    return sendJSON(res,200,{playerId:id,name,renamed:dup});}
  if(p==='/api/roster'&&req.method==='GET'){
    const room=rooms.get((url.searchParams.get('room')||'').toUpperCase());
    if(!room)return sendJSON(res,404,{error:'Room not found'});
    if(url.searchParams.get('hostToken')!==room.hostToken)return sendJSON(res,403,{error:'Not authorized'});
    const r=room.round;
    return sendJSON(res,200,{total:room.players.size,
      players:[...room.players.values()].sort((a,b)=>a.seq-b.seq).map((p)=>({
        seq:p.seq,name:p.name,score:p.score,voted:r?r.choices.has(p.id):false,
        locked:r?r.locked.has(p.id):false,choice:r&&r.choices.has(p.id)?r.choices.get(p.id):null}))});}
  if(p==='/api/host'&&req.method==='POST'){
    const b=await readBody(req,3e5);const room=rooms.get(String(b.roomCode||'').toUpperCase());
    if(!room)return sendJSON(res,404,{error:'Room not found'});
    if(b.hostToken!==room.hostToken)return sendJSON(res,403,{error:'Not authorized'});
    switch(b.action){
      case 'start': case 'next': startQuestion(room);break;
      case 'lock': lockVotes(room);break;
      case 'reveal':
        /* v28.2: never cut off answers still in flight. From QUESTION_ACTIVE we lock and let the
           normal 1.2 s grace run (jittered local-first votes land inside it), then reveal. */
        if(room.status==='QUESTION_ACTIVE')lockVotes(room);
        else if(room.status==='LOCKED')revealResults(room);break;
      case 'end': endGame(room);break;
      /* v27 host powers: each is ONE tiny frame, everything else happens on the devices */
      case 'chaos': fanoutAll(room,frame('crew:chaos',{seed:Math.floor(Math.random()*1e6)}),true);break;
      case 'drumroll': fanoutAll(room,frame('crew:drumroll',{ms:2000}),true);break;
      case 'spotlight':{const ps=[...room.players.values()];
        if(ps.length){const pk=ps[Math.floor(Math.random()*ps.length)];fanout(room.ctrlClients,frame('spotlight',{name:pk.name,sk:pk.sk}),true);}break;}
      case 'freeze':{const r=room.round;if(room.status!=='QUESTION_ACTIVE'||!r)break;
        if(!room.freeze){clearTimeout(r.t1);r.t1=null;room.freeze={at:Date.now()};
          fanoutAll(room,frame('timer:freeze',{frozen:true}),false);}
        else{const d=Date.now()-room.freeze.at;room.freeze=null;
          r.durationMs+=d; /* the clock simply paused: extend the answer window */
          const left=r.answerAt+r.durationMs-Date.now();
          r.t1=setTimeout(()=>lockVotes(room),Math.max(0,left));
          const nw=Date.now();fanoutAll(room,frame('timer:resume',{answerAt:r.answerAt,durationMs:r.durationMs,readMs:r.readMs,readLeft:Math.max(0,r.answerAt-nw),remaining:Math.max(0,r.answerAt+r.durationMs-nw)}),false);}
        break;}
      case 'restart': restartGame(room);break;
      case 'reconfigure': reconfigure(room,b);break;
      case 'auto':
        room.settings.autoNextMs=clampAuto(b.autoNextMs);
        if(room.round){if(room.round.t3){clearTimeout(room.round.t3);room.round.t3=null;}room.round.autoNextAt=0;
          if(room.status==='RESULTS'&&room.settings.autoNextMs){room.round.autoNextAt=Date.now()+room.settings.autoNextMs;
            room.round.t3=setTimeout(()=>{if(room.status==='RESULTS')startQuestion(room);},room.settings.autoNextMs);}}
        fanout(room.ctrlClients,frame('auto:update',{autoNextMs:room.settings.autoNextMs,autoNextAt:room.round&&room.round.autoNextAt||0}),false);
        break;
      default: return sendJSON(res,400,{error:'Unknown action'});}
    return sendJSON(res,200,{ok:true,status:room.status,settings:room.settings,questionCount:room.questions.length});}
  if(p==='/api/bank'&&req.method==='GET'){
    const q=url.searchParams.get('type');const t=BANKS[q]?q:normType(q);
    return sendJSON(res,200,{type:t,engine:BANK_ENGINE[t],questions:BANKS[t].map((q,i)=>({i,round:q.round,category:q.category,prompt:q.prompt,options:q.options,correct:q.correct}))});}
  if(p==='/api/report'&&req.method==='GET'){
    const room=rooms.get((url.searchParams.get('room')||'').toUpperCase());
    if(!room)return sendJSON(res,404,{error:'Room not found'});
    if(!room.report)room.report=buildReport(room);
    return sendJSON(res,200,room.report);}
  if(p==='/api/time'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"t":'+Date.now()+'}');}
  if(p==='/api/react'&&req.method==='POST'){
    const b=await readBody(req,256);const room=rooms.get(String(b.r||'').toUpperCase());
    if(room&&room.players.has(b.p)&&Array.isArray(b.c)){let arr=room.reactBy.get(b.p);if(!arr){arr=[0,0,0,0,0,0,0,0];room.reactBy.set(b.p,arr);}
      for(let i=0;i<8;i++){const n=Math.max(0,Math.min(20,b.c[i]|0));room.react[i]+=n;arr[i]+=n;}room.reactDirty=true;}
    res.writeHead(204);return res.end();}
  if(p==='/api/config'&&req.method==='GET'){
    return sendJSON(res,200,{publicUrl:PUBLIC_URL});}
  if(p==='/healthz'){const m=process.memoryUsage();
    let pl=0;for(const r of rooms.values())pl+=r.players.size;
    return sendJSON(res,200,{ok:true,rooms:rooms.size,players:pl,uptime:process.uptime(),rssMB:Math.round(m.rss/1048576)});}
  if(req.method==='GET')return serveStatic(req,res,p);
  res.writeHead(404);res.end('Not found');});
server.headersTimeout=0;server.requestTimeout=0;server.keepAliveTimeout=76000;
server.listen(PORT,()=>{
  console.log('\n  Fun Friday Arena v27 - Accenture x Currys | Made by PPA Warriors');
  console.log('  http://localhost:'+PORT+'   Host: /host');
  console.log('  Banks: WYR='+BANKS.wyr.length+' Quiz='+BANKS.quiz.length+'  MAX_PLAYERS='+MAX_PLAYERS+'\n');});
