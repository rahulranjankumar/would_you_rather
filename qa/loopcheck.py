import sys,time,json; sys.path.insert(0,'/home/claude/w')
from shot import *
JS="""()=>{const out={};const names=Object.keys(Crew.SCENES).filter(n=>!['attend','stomp','panic','climb'].includes(n));
 const F=['x','y','z'];const snap=()=>st.list.map(c=>({x:c.P.x,y:c.P.y,z:c.P.z,lean:Math.atan2(Math.sin(c.P.lean),Math.cos(c.P.lean)),tilt:Math.atan2(Math.sin(c.P.tilt),Math.cos(c.P.tilt)),hide:c.P.hide,eyes:c.P.eyes,sq:c.P.sq}));
 for(const n of names){const sc=Crew.SCENES[n];st.play(n);const d=st.scene.d;let prev=null,maxJ=0,at=0,endErr=0,bad=[];
  for(let t=0;t<d;t+=1/60){st._seek=t;st.tick(performance.now(),1/60);const cur=snap();
   if(prev){for(let i=0;i<3;i++){if(cur[i].hide||prev[i].hide)continue;const j=Math.hypot(cur[i].x-prev[i].x,cur[i].y-prev[i].y);if(j>maxJ){maxJ=j;at=t;}}}
   prev=cur;}
  st._seek=d*0.999;st.tick(performance.now(),1/60);const fin=snap();
  for(let i=0;i<3;i++){const c=fin[i];endErr=Math.max(endErr,Math.abs(c.y),Math.abs(c.z),Math.abs(c.lean),Math.abs(c.tilt),Math.abs(c.sq-1));if(c.hide)bad.push('hidden at end');if(c.eyes!=='open')bad.push('eyes '+c.eyes);}
  st._seek=null;st.end(true);st.ret=null;out[n]={maxJump:+maxJ.toFixed(2),at:+at.toFixed(2),endErr:+endErr.toFixed(3),bad};}
 return out;}"""
with sync_playwright() as p:
    b=browser(p); pg=b.new_page(viewport={'width':1280,'height':720}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(BASE+'/_crewlab.html'); time.sleep(.6); r=pg.evaluate(JS); b.close()
for k,v in sorted(r.items(),key=lambda kv:-kv[1]['maxJump']):
    flag='  <<' if v['maxJump']>.6 or v['endErr']>.03 or v['bad'] else ''
    print(f"{k:14s} jump {v['maxJump']:5.2f}@{v['at']:4.1f}  endErr {v['endErr']:.3f} {v['bad']}{flag}")
print(errs[:3])
