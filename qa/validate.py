import sys,time,json; sys.path.insert(0,'/home/claude/w')
from shot import *
with sync_playwright() as p:
    b=browser(p); pg=b.new_page(viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if 'crew' in m.text.lower() else None)
    pg.goto(BASE+'/_crewlab.html'); time.sleep(.6)
    res=pg.evaluate("""()=>{const out={};const names=Object.keys(Crew.SCENES).filter(n=>!['attend','stomp','panic','climb'].includes(n));
      for(const n of names){const sc=Crew.SCENES[n];let bad=[];st.play(n);
        for(let t=0;t<sc.d;t+=0.1){st._seek=t;try{st.tick(performance.now(),.016)}catch(e){bad.push('EXC '+t.toFixed(1)+' '+e.message);break}
          if(!st.scene){bad.push('ended early '+t.toFixed(1));break}
          for(const c of st.list){const P=c.P;for(const k of ['x','y','z','turn','lean','tilt','sq','armL','armR','legL']){if(!isFinite(P[k])){bad.push(n+' '+c.kind+' '+k+' NaN @'+t.toFixed(1));}}
            if(Math.abs(P.x)>12||P.y>12||P.y<-12)bad.push(c.kind+' far '+P.x.toFixed(1)+','+P.y.toFixed(1)+' @'+t.toFixed(1));}
          if(bad.length>3)break;}
        st._seek=null;st.end(true);st.ret=null;out[n]={d:sc.d,bad:[...new Set(bad)].slice(0,4)};}
      return out;}""")
    b.close()
bad={k:v for k,v in res.items() if v['bad']}
print(len(res),'scenes;',len(bad),'with issues'); print(json.dumps(bad,indent=1)[:3000]); print(errs[:5])
