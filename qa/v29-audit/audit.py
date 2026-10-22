"""UI/UX audit: every page + game state at every common screen size.
usage: python3 audit.py 390x844,1366x768   -> qa4/<vp>/<state>.png + qa4/<vp>/issues.json"""
import sys, time, json, os; sys.path.insert(0, '/home/claude/w')
from shot import *
O = '/home/claude/w/qa4/'
VP = {  # name: (w,h,touch)
 '360x640': (360, 640, 1), '375x667': (375, 667, 1), '390x844': (390, 844, 1), '412x915': (412, 915, 1), '430x932': (430, 932, 1),
 '844x390': (844, 390, 1), '768x1024': (768, 1024, 1), '1024x768': (1024, 768, 1),
 '1280x720': (1280, 720, 0), '1366x768': (1366, 768, 0), '1440x900': (1440, 900, 0), '1536x695': (1536, 695, 0),
 '1920x1080': (1920, 1080, 0), '2560x1440': (2560, 1440, 0)}
CHK = r"""(touch)=>{
 const out=[];const W=innerWidth,H=innerHeight,d=document.scrollingElement;
 if(d.scrollWidth>W+1)out.push(['hscroll','page scrolls sideways by '+(d.scrollWidth-W)+'px']);
 const vscroll=d.scrollHeight>H+2;
 const vis=e=>{const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>2&&r.height>2;};
 const name=e=>(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' "'+(e.innerText||e.value||e.placeholder||e.getAttribute('aria-label')||'').trim().slice(0,22)+'"';
 const fixedish=e=>{for(let n=e;n&&n!==document.body;n=n.parentElement){const p=getComputedStyle(n).position;if(p==='fixed'||p==='sticky')return true;}return false;};
 let els=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],.popt')].filter(vis);
 els=els.filter(e=>!els.some(o=>o!==e&&o.contains(e)));   // outermost only
 const R=els.map(e=>[e,e.getBoundingClientRect()]);
 for(const [e,r] of R){
   if(r.left<-1||r.right>W+1)out.push(['offscreen-x',name(e)+' sticks out horizontally ('+Math.round(r.left)+'..'+Math.round(r.right)+')']);
   const inView=r.top>=0&&r.bottom<=H;
   if((!vscroll||fixedish(e))&&(r.bottom>H+1||r.top<-1)&&!e.closest('[hidden]'))out.push(['offscreen-y',name(e)+' is cut off vertically ('+Math.round(r.top)+'..'+Math.round(r.bottom)+')']);
   if(inView&&!e.disabled){const pts=[[r.left+r.width/2,r.top+r.height/2],[r.left+6,r.top+6],[r.right-6,r.bottom-6]];let hid=0,by='';
     for(const [x,y] of pts){const t=document.elementFromPoint(x,y);if(t&&t!==e&&!e.contains(t)&&!t.contains(e)){hid++;by=name(t);}}
     if(hid>=2)out.push(['covered',name(e)+' is covered by '+by]);}
   if(touch&&inView&&!e.disabled&&(r.width<32||r.height<32)&&e.tagName!=='A')out.push(['small-tap',name(e)+' tap target '+Math.round(r.width)+'x'+Math.round(r.height)]);
 }
 for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i][1],b=R[j][1];
   const ix=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),iy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
   const sm=Math.min(a.width*a.height,b.width*b.height);if(ix*iy>sm*.12)out.push(['overlap',name(R[i][0])+' overlaps '+name(R[j][0])]);}
 // clipped text
 document.querySelectorAll('h1,h2,h3,h4,p,span,b,strong,label,.ptxt,button').forEach(e=>{if(!vis(e)||!e.innerText||e.children.length>2)return;const s=getComputedStyle(e);
   if((s.overflow==='hidden'||s.overflowX==='hidden')&&s.textOverflow!=='ellipsis'&&e.scrollWidth>e.clientWidth+2&&s.whiteSpace!=='normal')out.push(['clipped',name(e)+' text is clipped']);
   const r=e.getBoundingClientRect();if(r.right>W+2&&s.position!=='fixed'&&getComputedStyle(e.parentElement).overflow!=='hidden')out.push(['text-out',name(e)+' text runs off screen']);});
 // fixed bars covering in-flow interactive content
 const fixed=[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);return (s.position==='fixed')&&vis(e)&&s.pointerEvents!=='none'&&e.getBoundingClientRect().width<W*.95;});
 return out;}"""


def run(names):
    with sync_playwright() as p:
        b = browser(p)
        for nm in names:
            w, h, touch = VP[nm]; os.makedirs(O + nm, exist_ok=True); issues = {}
            mob = bool(touch and min(w, h) < 600)
            def ctx():
                c = b.new_context(viewport={'width': w, 'height': h}, has_touch=bool(touch), is_mobile=mob, device_scale_factor=1)
                c.add_init_script("try{localStorage.setItem('ffa-intro3d-at',String(Date.now()));localStorage.setItem('ffa-seen-intro','1')}catch(e){}")
                return c
            errs = []
            def snap(pg, state, wait=1.2):
                time.sleep(wait)
                try:
                    pg.screenshot(path=O + nm + '/' + state + '.png')
                    issues[state] = pg.evaluate(CHK, bool(touch))
                except Exception as e: issues[state] = [['error', str(e)[:120]]]
            def goto(pg, u):
                try: pg.goto(BASE + u, wait_until='domcontentloaded', timeout=25000)
                except Exception as e: errs.append('goto ' + u + ' ' + str(e)[:60])
            # ---- static pages
            c1 = ctx(); pg = c1.new_page(); pg.on('pageerror', lambda e: errs.append('landing ' + str(e)[:120]))
            goto(pg, '/?nointro'); snap(pg, '01-landing', 3)
            goto(pg, '/join'); snap(pg, '02-join', 1.8)
            goto(pg, '/nope-404'); snap(pg, '13-404', 1.2)
            c1.close()
            ch = ctx(); hp = ch.new_page(); hp.on('pageerror', lambda e: errs.append('host ' + str(e)[:120]))
            goto(hp, '/host')
            try: hp.wait_for_function("()=>{const i=document.getElementById('intro');return !i||i.classList.contains('done')}",timeout=12000)
            except Exception: errs.append('host intro never finished')
            snap(hp, '03-host-setup', .8)
            # ---- game: quiz, lock-in, read 0, long timer
            c = post('/api/room/create', {'gameType': 'quiz', 'bank': 'quiz', 'timerMs': 120000, 'readMs': 0, 'lockIn': True, 'autoNextMs': 0, 'enabled': [0, 1, 2]})
            R, T = c['roomCode'], c['hostToken']
            bots = [post('/api/room/join', {'roomCode': R, 'name': n, 'team': 'SAP Squad' if i % 2 else 'Basis Crew'}) for i, n in enumerate(['Neha', 'Arjun', 'Priya', 'Vikram', 'Sana', 'Kabir with a very long name'])]
            me = post('/api/room/join', {'roomCode': R, 'name': 'Rahul'})
            goto(hp, f'/host?room={R}&hostToken={T}'); time.sleep(1)
            cs = ctx(); sp = cs.new_page(); sp.on('pageerror', lambda e: errs.append('screen ' + str(e)[:120]))
            goto(sp, f'/screen?room={R}')
            cp = ctx(); pp = cp.new_page(); pp.on('pageerror', lambda e: errs.append('play ' + str(e)[:120]))
            goto(pp, '/join'); pp.evaluate(f"()=>{{localStorage.setItem('ffa-room','{R}');localStorage.setItem('ffa-pid','{me['playerId']}');localStorage.setItem('ffa-name','Rahul')}}")
            goto(pp, '/play'); snap(pp, '04-play-lobby', 2.2); snap(sp, '05-screen-lobby', .2); snap(hp, '06-host-lobby', .2)
            post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'start'})
            snap(pp, '07-play-question', 3.2); snap(sp, '08-screen-question', .3); snap(hp, '09-host-question', .2)
            try:
                pp.evaluate("()=>{const b=document.querySelectorAll('.popt')[0];b.click();setTimeout(()=>b.click(),150)}")
            except Exception: pass
            for i, bt in enumerate(bots): post('/api/vote', {'r': R, 'p': bt['playerId'], 'c': i % 3, 'lock': True, 'e': 800 + i * 300})
            snap(pp, '10-play-locked', 1.6)
            post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'reveal'})
            snap(pp, '11-play-reveal', 3.5); snap(sp, '12-screen-reveal', .3); snap(hp, '14-host-reveal', .2)
            post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'end'})
            snap(pp, '15-play-over', 3.5); snap(sp, '16-screen-over', .3)
            goto(pp, f'/report?room={R}'); snap(pp, '17-report', 2.5)
            # ---- WYR 2-option question with reading time (phone layout differs)
            c2 = post('/api/room/create', {'gameType': 'wyr', 'bank': 'wyr', 'timerMs': 120000, 'readMs': 3000, 'lockIn': False, 'enabled': [0, 1]})
            m2 = post('/api/room/join', {'roomCode': c2['roomCode'], 'name': 'Rahul'})
            pp.evaluate(f"()=>{{localStorage.setItem('ffa-room','{c2['roomCode']}');localStorage.setItem('ffa-pid','{m2['playerId']}')}}")
            goto(pp, '/play'); time.sleep(1.8)
            post('/api/host', {'roomCode': c2['roomCode'], 'hostToken': c2['hostToken'], 'action': 'start'})
            snap(pp, '18-play-wyr-reading', 1.2); snap(pp, '19-play-wyr-answer', 3)
            for x in (ch, cs, cp): x.close()
            json.dump({'issues': issues, 'errors': errs}, open(O + nm + '/issues.json', 'w'), indent=1)
            n = sum(len(v) for v in issues.values()); print(nm, 'issues', n, 'errors', len(errs), flush=True)
        b.close()

run(sys.argv[1].split(','))
