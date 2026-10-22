"""Fun Friday Arena v28 — layout matrix. Every page x 8 screen sizes (phones in touch/mobile mode).
   Checks: no horizontal scroll; play question with 2/3/4 LONG options fits (all cards fully on screen,
   none hidden behind the emoji dock); join Board button on screen; landing Join button in first view;
   phones run the sticker crew (no WebGL), laptops the 3D crew. Screenshots -> qa/layout/*.jpg"""
import sys, time, json, os, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:3000')
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1208/chrome-linux64/chrome')
HERE = os.path.dirname(os.path.abspath(__file__)); SH = os.path.join(HERE, 'layout'); os.makedirs(SH, exist_ok=True)
def post(p, b):
    r = urllib.request.Request(BASE + p, data=json.dumps(b).encode(), headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r).read() or b'{}')
LONG = {2: ['Have unlimited chai and coffee but zero meetings ever again', 'Have every meeting run exactly on time but unlimited meetings'],
        3: ['Answer every email only by voice note', 'Answer every email only in emoji', 'Answer every email in rhyming couplets'],
        4: ['Just one more quick thing before we wrap up for the week', 'Can we circle back on the deployment plan right now',
            'Who wants to present the quarterly numbers again today', "Let's do a quick round of status updates for everyone"]}
VPS = [(360, 640, 1), (390, 844, 1), (412, 915, 1), (768, 1024, 1), (1280, 600, 0), (1366, 768, 0), (1536, 673, 0), (1920, 1080, 0)]
res = []
def rec(name, ok, info=''): res.append({'test': name, 'pass': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + ('  ' + json.dumps(info) if not ok else ''), flush=True)
HS = "()=>document.scrollingElement.scrollWidth>innerWidth+1"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    only = os.environ.get('ONLY')
    for w, h, mob in VPS:
        if only and '%dx%d' % (w, h) not in only: continue
        tag = '%dx%d' % (w, h)
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=bool(mob), is_mobile=bool(mob)); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script("localStorage.setItem('ffa-intro3d-at',String(Date.now()))")
        pg.goto(BASE + '/'); time.sleep(2.2); pg.screenshot(path=os.path.join(SH, 'landing-%s.jpg' % tag), type='jpeg', quality=60)
        jb = pg.evaluate("()=>{const r=document.getElementById('joinBtn').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0}")
        crew = pg.evaluate("()=>({gl:!!document.querySelector('canvas.crew3d'),pocket:!!document.querySelector('.pk-stage')})")
        rec('landing %s: join button in first view, no h-scroll' % tag, jb and not pg.evaluate(HS))
        phone = mob and min(w, h) < 600  # tablets are touch but big enough for the 3D crew
        rec('landing %s: %s crew' % (tag, 'sticker (no WebGL)' if phone else '3D'), (crew['pocket'] and not crew['gl']) if phone else crew['gl'], crew)
        pg.goto(BASE + '/join'); time.sleep(1.4); pg.screenshot(path=os.path.join(SH, 'join-%s.jpg' % tag), type='jpeg', quality=60)
        bb = pg.evaluate("()=>{const r=document.getElementById('go').getBoundingClientRect();return {b:Math.round(r.bottom),h:innerHeight}}")
        rec('join %s: Board button fully visible without scrolling' % tag, bb['b'] <= bb['h'] and not pg.evaluate(HS), bb)
        for n in (2, 3, 4):
            c = post('/api/room/create', {'gameType': 'wyr', 'timerMs': 120000, 'readMs': 0, 'customBank': [{'prompt': 'Would you rather... (a long one to stress the layout on small screens)', 'options': LONG[n]}]})
            me = post('/api/room/join', {'roomCode': c['roomCode'], 'name': 'Layout'})
            pg.goto(BASE + '/join'); pg.evaluate("([r,p])=>{localStorage.setItem('ffa-room',r);localStorage.setItem('ffa-pid',p);localStorage.setItem('ffa-name','Layout')}", [c['roomCode'], me['playerId']])
            pg.goto(BASE + '/play'); time.sleep(1.0)
            post('/api/host', {'roomCode': c['roomCode'], 'hostToken': c['hostToken'], 'action': 'start'}); time.sleep(2.6)
            pg.screenshot(path=os.path.join(SH, 'play-%dopt-%s.jpg' % (n, tag)), type='jpeg', quality=60)
            r = pg.evaluate("""()=>{const c=[...document.querySelectorAll('.popt')].map(x=>x.getBoundingClientRect());const d=document.getElementById('dock');
              const dt=d&&!d.hidden?d.getBoundingClientRect().top:innerHeight;const clip=[...document.querySelectorAll('.ptxt')].some(t=>t.scrollHeight>t.clientHeight+2);
              return {n:c.length,lastBottom:Math.round(Math.max(...c.map(x=>x.bottom))),dockTop:Math.round(dt),h:innerHeight,fit:getComputedStyle(document.documentElement).getPropertyValue('--fit').trim(),clip:clip,hs:document.scrollingElement.scrollWidth>innerWidth+1}}""")
            rec('play %s, %d options: all cards on screen above the dock' % (tag, n), r['n'] == n and r['lastBottom'] <= min(r['dockTop'], r['h']) + 1 and not r['clip'] and not r['hs'], r)
        rec('%s: no page errors' % tag, not errs, errs[:3])
        ctx.close()
    # big screen + host at laptop/projector sizes
    for w, h in (() if only else ((1280, 720), (1366, 768), (1920, 1080))):
        ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        c = post('/api/room/create', {'gameType': 'quiz', 'timerMs': 120000, 'readMs': 0, 'customBank': [{'prompt': 'What does SQL stand for?', 'options': LONG[4], 'correct': 0}]})
        for nm in ('Aarav', 'Neha', 'Karan'): post('/api/room/join', {'roomCode': c['roomCode'], 'name': nm})
        pg.goto(BASE + '/screen?room=' + c['roomCode']); time.sleep(2)
        post('/api/host', {'roomCode': c['roomCode'], 'hostToken': c['hostToken'], 'action': 'start'}); time.sleep(2.5)
        pg.screenshot(path=os.path.join(SH, 'screen-q-%dx%d.jpg' % (w, h)), type='jpeg', quality=60)
        r = pg.evaluate("()=>{const c=[...document.querySelectorAll('#arena .opt')].map(x=>x.getBoundingClientRect());return {n:c.length,bottom:Math.round(Math.max(...c.map(x=>x.bottom))),h:innerHeight}}")
        rec('big screen %dx%d: 4 options on screen' % (w, h), r['n'] == 4 and r['bottom'] <= r['h'], r)
        pg.goto(BASE + '/host?room=%s&hostToken=%s' % (c['roomCode'], c['hostToken'])); time.sleep(1.5)
        pg.screenshot(path=os.path.join(SH, 'host-%dx%d.jpg' % (w, h)), type='jpeg', quality=60)
        rec('host %dx%d: no h-scroll' % (w, h), not pg.evaluate(HS)); ctx.close()
    b.close()
OUTF = os.path.join(HERE, 'layout-results.json')
prev = json.load(open(OUTF)) if only and os.path.exists(OUTF) else []
names = {r['test'] for r in res}; prev = [r for r in prev if r['test'] not in names and not any(t in r['test'] for t in only.split())] if only else []
json.dump(prev + res, open(OUTF, 'w'), indent=1)
print('\n%d/%d passed' % (sum(r['pass'] for r in res), len(res)))
