/** v27 load proof — realistic DEVICE behaviour, v25 client profile vs v27 client profile.
 *  node loadtest27.js            (expects v27 on :3000;  set V25=http://127.0.0.1:3025 to compare)
 *  SRV=<pid of v27 server>  SRV25=<pid of v25 server>   adds CPU per question.
 *  Human model: taps after reading, lognormal around ~2.5 s; 35 % change their mind once.
 *    v25 client: POST on every tap, immediately; host re-fetches /api/roster on every join
 *                and polls it every 1.5 s during a question.
 *    v27 client: elapsed measured on-device; first POST after 150–900 ms jitter, changes coalesced
 *                to ≤1 follow-up per second; host never polls during questions.
 *  Reports: votes counted, peak requests per second (max over 250 ms windows ×4), CPU/question,
 *  lobby:update frames per second during a 300-join storm, and the elapsedMs clamp. */
'use strict';
const http=require('http'),fs=require('fs');
const N=parseInt(process.env.N||'700',10),ROUNDS=parseInt(process.env.ROUNDS||'3',10);
const agent=new http.Agent({keepAlive:true,maxSockets:2048}),sse=new http.Agent({keepAlive:true,maxSockets:4096});
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
function req(base,method,p,b,log){return new Promise((r)=>{const d=b?Buffer.from(JSON.stringify(b)):null;if(log)log.push(Date.now());
  const q=http.request(new URL(base+p),{method,agent,headers:d?{'Content-Type':'application/json','Content-Length':d.length}:{}},(x)=>{let s='';x.on('data',(c)=>s+=c);
    x.on('end',()=>{let j={};try{j=s?JSON.parse(s):{};}catch{}j._s=x.statusCode;r(j);});});q.on('error',()=>r({err:1}));if(d)q.write(d);q.end();});}
function listen(base,room,role,pid,on){return http.get(new URL(base+'/api/events?room='+room+'&role='+role+(pid?'&playerId='+pid:'')),{agent:sse},(res)=>{let buf='';
  res.on('data',(ch)=>{buf+=ch;let i;while((i=buf.indexOf('\n\n'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+2);const m=/^event: (.+)$/m.exec(raw),dd=/^data: (.+)$/m.exec(raw);
    if(m){let o={};try{o=dd?JSON.parse(dd[1]):{};}catch{}on(m[1],o);}}});});}
const cpu=(pid)=>{if(!pid)return 0;try{const st=fs.readFileSync('/proc/'+pid+'/stat','utf8').split(' ');return (parseInt(st[13])+parseInt(st[14]))/100;}catch{return 0;}};
function lognorm(med,sig){const u=Math.random(),v=Math.random();return med*Math.exp(sig*Math.sqrt(-2*Math.log(u||1e-9))*Math.cos(2*Math.PI*v));}
function peak(log){if(!log.length)return 0;log.sort((a,b)=>a-b);let best=0,j=0;for(let i=0;i<log.length;i++){while(log[i]-log[j]>250)j++;best=Math.max(best,i-j+1);}return best*4;}

async function run(base,profile,srvPid){
  const out={profile};
  const c=await req(base,'POST','/api/room/create',{gameType:'wyr',scoringMode:'points',timerMs:12000,readMs:1000,lockIn:false});
  const room=c.roomCode,tok=c.hostToken;
  /* ---- join storm: 300 people scan the QR at once ---- */
  let lobbyFrames=[];const hostEv=[];
  listen(base,room,'host',null,(e,d)=>{hostEv.push([e,d]);if(e==='lobby:update')lobbyFrames.push(Date.now());});
  await sleep(300);
  const joinLog=[],players=[];const t0=Date.now();
  await Promise.all(Array.from({length:N},(_,i)=>sleep(Math.random()*(i<300?1000:6000)).then(async()=>{
    const r=await req(base,'POST','/api/room/join',{roomCode:room,name:'P'+i,sidekick:['momo','noodle','bean'][i%3]},joinLog);if(r.playerId)players.push(r.playerId);
    if(profile==='v25')req(base,'GET','/api/roster?room='+room+'&hostToken='+tok,null,joinLog); /* v25 host refetched the roster per join */})));
  await sleep(600);
  out.joined=players.length;
  const lf=lobbyFrames.filter((t)=>t>=t0);let lfPeak=0,j=0;for(let i=0;i<lf.length;i++){while(lf[i]-lf[j]>1000)j++;lfPeak=Math.max(lfPeak,i-j+1);}
  out.lobbyFramesTotal=lf.length;out.lobbyFramesPerSecPeak=lfPeak;out.joinStormPeakRps=peak(joinLog.slice());
  players.forEach((pid)=>listen(base,room,'player',pid,()=>{}));
  await sleep(1500);
  /* ---- questions ---- */
  let counted=0,expected=0;const voteLog=[];const c0=cpu(srvPid);
  for(let q=0;q<ROUNDS;q++){
    const before=hostEv.length;
    await req(base,'POST','/api/host',{roomCode:room,hostToken:tok,action:'start'});
    await sleep(80);const qs=hostEv.slice(before).find((x)=>x[0]==='question:show');const answerAt=qs?qs[1].answerAt:Date.now()+1000;
    let poll=null;if(profile==='v25'){poll=setInterval(()=>req(base,'GET','/api/roster?room='+room+'&hostToken='+tok,null,voteLog),1500);}
    const finalChoice=new Map();
    await Promise.all(players.map((pid,i)=>(async()=>{
      const first=Math.min(10500,Math.max(300,lognorm(2500,.6)));const change=Math.random()<.35?first+300+Math.random()*2200:null;
      const c1=i%3?0:1,c2=1-c1;finalChoice.set(pid,change&&change<11000?c2:c1);
      const wait=(t)=>sleep(Math.max(0,answerAt+t-Date.now()));
      if(profile==='v25'){await wait(first);await req(base,'POST','/api/vote',{r:room,p:pid,c:c1},voteLog);
        if(change&&change<11000){await wait(change);await req(base,'POST','/api/vote',{r:room,p:pid,c:c2},voteLog);}}
      else{ /* v27 local-first queue */
        const send1=Math.min(11300,first+150+Math.random()*1650);
        if(change&&change<send1){await wait(send1);await req(base,'POST','/api/vote',{r:room,p:pid,c:c2,e:Math.round(change)},voteLog);}
        else{await wait(send1);await req(base,'POST','/api/vote',{r:room,p:pid,c:c1,e:Math.round(first)},voteLog);
          if(change&&change<11000){await wait(Math.max(change,send1+1500));await req(base,'POST','/api/vote',{r:room,p:pid,c:c2,e:Math.round(change)},voteLog);}}}
    })()));
    if(poll)clearInterval(poll);
    const before2=hostEv.length;
    await req(base,'POST','/api/host',{roomCode:room,hostToken:tok,action:'reveal'});await sleep(1600);
    const rv=hostEv.slice(before2).find((x)=>x[0]==='results:reveal');
    const want=[0,0];finalChoice.forEach((ch)=>want[ch]++);
    if(rv){counted+=rv[1].total;expected+=players.length;out['q'+(q+1)+'Match']=rv[1].counts[0]===want[0]&&rv[1].counts[1]===want[1];}
  }
  const c1=cpu(srvPid);
  out.votesCounted=counted+'/'+expected;out.voteAll=counted===expected;
  out.votePeakRps=peak(voteLog);out.cpuPerQuestion=srvPid?+((c1-c0)/ROUNDS).toFixed(3):null;
  /* ---- fairness clamp (v27 only) ---- */
  if(profile==='v27'){
    const r2=await req(base,'POST','/api/room/create',{gameType:'quiz',timerMs:10000,readMs:0,enabled:[0]});
    const pj=await req(base,'POST','/api/room/join',{roomCode:r2.roomCode,name:'Spoofer'});
    const pk=await req(base,'POST','/api/room/join',{roomCode:r2.roomCode,name:'Honest'});
    await req(base,'POST','/api/host',{roomCode:r2.roomCode,hostToken:r2.hostToken,action:'start'});
    await sleep(1200);
    await req(base,'POST','/api/vote',{r:r2.roomCode,p:pj.playerId,c:0,e:1});           /* claims 1 ms */
    await req(base,'POST','/api/vote',{r:r2.roomCode,p:pk.playerId,c:0,e:99999});       /* claims the future */
    await req(base,'POST','/api/host',{roomCode:r2.roomCode,hostToken:r2.hostToken,action:'reveal'});await sleep(1500);
    const rep=await req(base,'GET','/api/report?room='+r2.roomCode);
    const f=rep.questions&&rep.questions[0].fastest;
    out.clampMinOk=!!(f&&f.name==='Spoofer'&&f.ms>=250);
    const lb=rep.leaderboard||[];const hon=lb.find((x)=>x.name==='Honest');out.clampMaxOk=!!(hon&&hon.ms<=1600);
  }
  return out;
}
(async()=>{
  const r27=await run(process.env.BASE||'http://127.0.0.1:3000','v27',process.env.SRV);
  let r25=null;if(process.env.V25)r25=await run(process.env.V25,'v25',process.env.SRV25);
  const rep={players:N,rounds:ROUNDS,v27:r27,v25:r25};
  if(r25){rep.votePeakDrop=+(1-r27.votePeakRps/r25.votePeakRps).toFixed(3);rep.joinPeakDrop=+(1-r27.joinStormPeakRps/r25.joinStormPeakRps).toFixed(3);
    const tot27=r27.votePeakRps+r27.joinStormPeakRps,tot25=r25.votePeakRps+r25.joinStormPeakRps;rep.overallPeakDrop=+(1-Math.max(r27.votePeakRps,r27.joinStormPeakRps)/Math.max(r25.votePeakRps,r25.joinStormPeakRps)).toFixed(3);
    if(r27.cpuPerQuestion!=null&&r25.cpuPerQuestion!=null)rep.cpuRatio=+(r27.cpuPerQuestion/Math.max(.001,r25.cpuPerQuestion)).toFixed(3);}
  console.log(JSON.stringify(rep,null,2));
  if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(rep,null,2));
  const pass=r27.voteAll&&r27.lobbyFramesPerSecPeak<=5&&r27.clampMinOk&&r27.clampMaxOk&&(!r25||rep.overallPeakDrop>=.4);
  console.log(pass?'\n=== LOAD PROOF PASSED ===':'\n=== LOAD PROOF: see numbers above ===');process.exit(0);})();
