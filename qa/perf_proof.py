import sys, json, time; sys.path.insert(0,'/home/claude/w')
from shot import *
OUT='/home/claude/w/v27/qa/'
COLLECT="""(ms)=>new Promise(r=>{const d=[];let last=0;const t0=performance.now();function f(t){if(last)d.push(t-last);last=t;if(t-t0<ms)requestAnimationFrame(f);else{d.sort((a,b)=>a-b);
 const p=q=>d[Math.min(d.length-1,Math.floor(d.length*q))];r({frames:d.length,fps:+(1000*d.length/ms).toFixed(1),p50:+p(.5).toFixed(2),p95:+p(.95).toFixed(2),max:+d[d.length-1].toFixed(2),over33:d.filter(x=>x>33).length,
 dpr:(window.FFAperf&&FFAperf.DPR)||devicePixelRatio,tier:window.FFAperf&&FFAperf.tier(),gpu:window.FFAperf&&FFAperf.stats().gpu})}}requestAnimationFrame(f)})"""
res=[]
with sync_playwright() as p:
    b=browser(p)
    for tier in ['ultra','high','balanced','eco']:
        ctx=b.new_context(viewport={'width':1280,'height':720}); pg=ctx.new_page()
        pg.goto(BASE+f'/?nointro&tier={tier}'); time.sleep(2); r=pg.evaluate(COLLECT,10000); r.update(page='landing',tier=tier); res.append(r); print(r,flush=True)
        c=post('/api/room/create',{'gameType':'wyr','timerMs':120000,'readMs':0,'enabled':[0,1]}); R,T=c['roomCode'],c['hostToken']
        j=post('/api/room/join',{'roomCode':R,'name':'Perf'})
        pg.evaluate(f"()=>{{localStorage.setItem('ffa-room','{R}');localStorage.setItem('ffa-pid','{j['playerId']}')}}")
        pg.goto(BASE+f'/play?tier={tier}'); time.sleep(1.2); post('/api/host',{'roomCode':R,'hostToken':T,'action':'start'}); time.sleep(2.2)
        r=pg.evaluate(COLLECT,10000); r.update(page='play-question',tier=tier); res.append(r); print(r,flush=True)
        post('/api/host',{'roomCode':R,'hostToken':T,'action':'reveal'}); time.sleep(.3)
        r=pg.evaluate(COLLECT,10000); r.update(page='play-reveal',tier=tier); res.append(r); print(r,flush=True)
        sc=ctx.new_page(); sc.goto(BASE+f'/screen?room={R}&tier={tier}'); time.sleep(2)
        r=sc.evaluate(COLLECT,10000); r.update(page='screen',tier=tier); res.append(r); print(r,flush=True)
        ctx.close()
    b.close()
json.dump(res,open(OUT+'perf-report.json','w'),indent=1)
