/** node loadtest.js [players] [wyr|quiz];  SRV=<pid> adds CPU/question */
'use strict';
const http=require('http'),fs=require('fs');
const BASE=process.env.BASE||'http://127.0.0.1:3000';
const N=parseInt(process.argv[2]||'700',10),TYPE=process.argv[3]||'wyr';
const ROUNDS=parseInt(process.env.ROUNDS||'5',10),PID=process.env.SRV;
const agent=new http.Agent({keepAlive:true,maxSockets:2048});
const sseAgent=new http.Agent({keepAlive:true,maxSockets:4096});
const post=(p,b)=>new Promise((r)=>{
  const d=Buffer.from(JSON.stringify(b));
  const q=http.request(new URL(BASE+p),{method:'POST',agent,headers:{'Content-Type':'application/json','Content-Length':d.length}},(x)=>{
    let s='';x.on('data',(c)=>(s+=c));
    x.on('end',()=>{try{r(s?Object.assign(JSON.parse(s),{_s:x.statusCode}):{_s:x.statusCode});}catch{r({_s:x.statusCode});}});});
  q.on('error',()=>r({err:1}));q.write(d);q.end();});
const get=(p)=>new Promise((r)=>http.get(new URL(BASE+p),{agent},(x)=>{
  let s='';x.on('data',(c)=>(s+=c));x.on('end',()=>{try{r(JSON.parse(s));}catch{r({});}});}).on('error',()=>r({})));
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
const cpu=()=>{if(!PID)return 0;try{const st=fs.readFileSync('/proc/'+PID+'/stat','utf8').split(' ');
  return (parseInt(st[13])+parseInt(st[14]))/100;}catch{return 0;}};
(async()=>{
  console.log('Load test: '+N+' players, '+TYPE+' bank, '+ROUNDS+' rounds\n');
  const c=await post('/api/room/create',{gameType:TYPE,scoringMode:'points',timerMs:120000,readMs:300,lockIn:false});
  if(!c.roomCode){console.error('Could not create room');process.exit(1);}
  console.log('  room '+c.roomCode+' | '+c.questionCount+' questions');
  let t0=Date.now();const players=[];
  for(let i=0;i<N;i+=60){
    const b=await Promise.all(Array.from({length:Math.min(60,N-i)},(_,k)=>post('/api/room/join',{roomCode:c.roomCode,name:'P'+(i+k)})));
    b.forEach((r)=>r.playerId&&players.push(r.playerId));}
  console.log('  joined '+players.length+'/'+N+' in '+(Date.now()-t0)+'ms');
  let open=0,evts=0;t0=Date.now();
  await new Promise((res)=>{let done=0;
    players.forEach((pid)=>{
      http.get(new URL(BASE+'/api/events?room='+c.roomCode+'&role=player&playerId='+pid),{agent:sseAgent},(x)=>{
        open++;done++;x.on('data',(ch)=>{evts+=(ch.toString().match(/^event:/gm)||[]).length;});
        if(done===players.length)res();}).on('error',()=>{done++;if(done===players.length)res();});});
    setTimeout(res,20000);});
  await sleep(800);
  const h1=await get('/healthz');
  console.log('  '+open+' SSE streams open in '+(Date.now()-t0)+'ms | RSS '+h1.rssMB+'MB\n');
  const c0=cpu();let acc=0,slow=0;
  for(let q=0;q<ROUNDS;q++){
    await post('/api/host',{roomCode:c.roomCode,hostToken:c.hostToken,action:'start'});
    await sleep(400);t0=Date.now();
    const vr=await Promise.all(players.map((pid,i)=>post('/api/vote',{r:c.roomCode,p:pid,c:i%2})));
    const ms=Date.now()-t0;if(ms>slow)slow=ms;
    const ok=vr.filter((v)=>v._s===204).length;acc+=ok;
    console.log('  Q'+(q+1)+': '+ok+'/'+players.length+' votes accepted in '+ms+'ms ('+Math.round(players.length/(ms/1000))+'/s)');
    await post('/api/host',{roomCode:c.roomCode,hostToken:c.hostToken,action:'reveal'});await sleep(1500);}
  const c1=cpu();
  await post('/api/host',{roomCode:c.roomCode,hostToken:c.hostToken,action:'end'});
  const rep=await get('/api/report?room='+c.roomCode),h2=await get('/healthz');
  console.log('\n  -- summary --');
  console.log('  votes accepted : '+acc+'/'+(ROUNDS*players.length));
  console.log('  slowest burst  : '+slow+'ms');
  console.log('  SSE events rcvd: '+evts);
  console.log('  RSS            : '+h1.rssMB+'MB -> '+h2.rssMB+'MB');
  if(PID){const per=(c1-c0)/ROUNDS;
    console.log('  CPU/question   : '+per.toFixed(3)+'s  => Render free (0.1 vCPU): ~'+(per/0.1).toFixed(1)+'s');}
  console.log('  report         : '+(rep.questions?rep.questions.length+' questions, '+rep.leaderboard.length+' on board':'n/a'));
  process.exit(0);})();
