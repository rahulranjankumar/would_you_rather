const http=require('http');
const BASE='http://127.0.0.1:3000';const N=parseInt(process.argv[2]||'600',10);const TYPE=process.argv[3]||'wyr';
const agent=new http.Agent({keepAlive:true,maxSockets:2048});const sseAgent=new http.Agent({keepAlive:true,maxSockets:4096});
const post=(p,b)=>new Promise(r=>{const d=Buffer.from(JSON.stringify(b));const q=http.request(new URL(BASE+p),{method:'POST',agent,headers:{'Content-Type':'application/json','Content-Length':d.length}},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>{try{r(s?Object.assign(JSON.parse(s),{_s:x.statusCode}):{_s:x.statusCode})}catch{r({_s:x.statusCode})}})});q.on('error',()=>r({err:1}));q.write(d);q.end()});
const get=p=>new Promise(r=>http.get(new URL(BASE+p),{agent},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>{try{r(JSON.parse(s))}catch{r({})}})}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fs=require('fs');const PID=process.env.SRV;
const cpu=()=>{if(!PID)return 0;const st=fs.readFileSync('/proc/'+PID+'/stat','utf8').split(' ');return (parseInt(st[13])+parseInt(st[14]))/100;};
(async()=>{
 const c=await post('/api/room/create',{gameType:TYPE,scoringMode:'points',timerMs:120000,readMs:300,lockIn:false});
 console.log('Room',c.roomCode,'| questions',c.questionCount);
 const players=[];let t0=Date.now();
 for(let i=0;i<N;i+=60){const b=await Promise.all(Array.from({length:Math.min(60,N-i)},(_,k)=>post('/api/room/join',{roomCode:c.roomCode,name:'P'+(i+k)})));b.forEach(r=>r.playerId&&players.push(r.playerId));}
 console.log('  joined '+players.length+' in '+(Date.now()-t0)+'ms');
 let open=0,evts=0;t0=Date.now();
 await new Promise(res=>{let d=0;players.forEach(pid=>{http.get(new URL(BASE+'/api/events?room='+c.roomCode+'&role=player&playerId='+pid),{agent:sseAgent},x=>{open++;d++;x.on('data',ch=>{evts+=(ch.toString().match(/^event:/gm)||[]).length});if(d===players.length)res();}).on('error',()=>{d++;if(d===players.length)res();});});setTimeout(res,15000);});
 await sleep(800);
 console.log('  '+open+' SSE open in '+(Date.now()-t0)+'ms  RSS '+(await get('/healthz')).rssMB+'MB');
 const R=5,c0=cpu();let acc=0;
 for(let q=0;q<R;q++){
   await post('/api/host',{roomCode:c.roomCode,hostToken:c.hostToken,action:'start'});
   await sleep(400);
   t0=Date.now();
   const vr=await Promise.all(players.map((pid,i)=>post('/api/vote',{r:c.roomCode,p:pid,c:i%2})));
   const okc=vr.filter(v=>v._s===204).length;acc+=okc;
   if(q===0)console.log('  burst: '+okc+'/'+players.length+' accepted in '+(Date.now()-t0)+'ms ('+Math.round(players.length/((Date.now()-t0)/1000))+'/s)');
   await post('/api/host',{roomCode:c.roomCode,hostToken:c.hostToken,action:'reveal'});await sleep(250);
 }
 const c1=cpu();
 console.log('  total accepted: '+acc+'/'+(R*players.length));
 if(PID)console.log('  CPU per question: '+((c1-c0)/R).toFixed(3)+'s  => Render free (0.1cpu): ~'+(((c1-c0)/R)/0.1).toFixed(1)+'s');
 console.log('  RSS after: '+(await get('/healthz')).rssMB+'MB   SSE events: '+evts);
 const rep=await get('/api/report?room='+c.roomCode);
 console.log('  report: '+(rep.questions?rep.questions.length+' questions':'n/a'));
 process.exit(0);
})();
