"""Fun Friday Arena v28 — browser scenario matrix (run with the server on :3000).
   python3 qa/test_matrix.py  -> qa/matrix-results.json
   Every combination of: options 2/3/4 x Quiz/WYR x lock-in off/on x reading time 0/3 s,
   plus edge cases: client clock skew (+/-6 s), join mid-question, reload after voting,
   freeze/resume, restart, auto-advance, offline/reconnect, game over -> Wrapped."""
import sys, time, json, os, urllib.request, itertools
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:3000')
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1208/chrome-linux64/chrome')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'matrix-results.json')
def post(p, b):
    r = urllib.request.Request(BASE + p, data=json.dumps(b).encode(), headers={'Content-Type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(r).read() or b'{}')
    except Exception as e: return {'err': str(e)}
OPTS = {2: ['Chai', 'Coffee'], 3: ['Chai', 'Coffee', 'Cold drink'], 4: ['Chai', 'Coffee', 'Cold drink', 'Water']}
def bank(n, quiz): return [{'prompt': 'Q%d: pick one' % i, 'options': OPTS[n], **({'correct': 0} if quiz else {})} for i in range(3)]
results = []
def rec(name, ok, info=''):
    results.append({'test': name, 'pass': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + ('  ' + str(info) if info and not ok else ''), flush=True)

def player(b, R, pid, name, skew=0, vp=(1366, 768), mobile=False):
    ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, has_touch=mobile, is_mobile=mobile)
    if skew: ctx.add_init_script('(()=>{const o=Date.now;Date.now=()=>o()+%d;})()' % skew)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/join')
    pg.evaluate("([r,p,n])=>{localStorage.setItem('ffa-room',r);localStorage.setItem('ffa-pid',p);localStorage.setItem('ffa-name',n)}", [R, pid, name])
    pg.goto(BASE + '/play'); time.sleep(1.2)
    return ctx, pg, errs

def wait_enabled(pg, timeout=9):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate("()=>{const b=document.querySelector('.popt');return !!b&&!b.disabled}"): return time.time() - t0
        time.sleep(.15)
    return None

def combo(b, n, quiz, lock, read):
    name = 'combo n=%d %s lock=%s read=%ds' % (n, 'quiz' if quiz else 'wyr', lock, read)
    c = post('/api/room/create', {'gameType': 'quiz' if quiz else 'wyr', 'timerMs': 60000, 'readMs': read * 1000, 'lockIn': lock, 'customBank': bank(n, quiz)})
    R, T = c['roomCode'], c['hostToken']
    me = post('/api/room/join', {'roomCode': R, 'name': 'Tester'}); o1 = post('/api/room/join', {'roomCode': R, 'name': 'Bot1'}); o2 = post('/api/room/join', {'roomCode': R, 'name': 'Bot2'})
    ctx, pg, errs = player(b, R, me['playerId'], 'Tester')
    try:
        post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'start'}); time.sleep(1.0)
        t0 = time.time()
        while time.time() - t0 < 5 and not pg.evaluate("()=>document.querySelectorAll('.popt').length"): time.sleep(.1)
        cards = pg.evaluate("()=>document.querySelectorAll('.popt').length")
        if read: early = pg.evaluate("()=>{const b=document.querySelector('.popt');return !!b&&b.disabled}")
        else: early = True
        waited = wait_enabled(pg)
        pick = n - 1  # wrong in quiz (correct = 0), minority in WYR
        ok_click = False
        if waited is not None:
            pg.locator('.popt').nth(pick).click(timeout=4000, force=True)
            time.sleep(.3); ok_click = pg.evaluate("(i)=>document.querySelectorAll('.popt')[i].classList.contains('is-picked')", pick)
            if lock: pg.locator('#lockBtn').click(timeout=3000, force=True); time.sleep(.2)
        for o in (o1, o2): post('/api/vote', {'r': R, 'p': o['playerId'], 'c': 0, 'lock': lock})
        time.sleep(1.6)  # jittered send + flush
        post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'reveal'}); time.sleep(1.8)
        st = pg.evaluate("""()=>{const c=[...document.querySelectorAll('.popt')];return {res:c.every(x=>x.classList.contains('showres')),
            correct:c.map(x=>x.classList.contains('is-correct')),miss:c.map(x=>x.classList.contains('is-miss')),major:c.map(x=>x.classList.contains('is-major')),
            verdict:(document.querySelector('.verdict b')||{}).textContent||'',locked:!!document.querySelector('.seal')}}""")
        rep = json.loads(urllib.request.urlopen(BASE + '/api/report?room=' + R).read())
        counted = rep['questions'][0]['total'] if rep.get('questions') else -1
        checks = [cards == n, early, waited is not None, ok_click, st['res'], counted == 3]
        if quiz: checks += [st['correct'][0], st['miss'][pick]]
        else: checks += [st['major'][0], 'wrong' not in st['verdict'].lower()]
        if lock: checks.append(st['locked'])
        rec(name, all(checks) and not errs, {'cards': cards, 'readLockedEarly': early, 'enabledAfter': waited, 'picked': ok_click, 'counted': counted, 'state': st, 'errs': errs[:2]})
    finally: ctx.close()

def edges(b):
    # clock skew: the "reading time stuck / can't select" bug
    for skew in (6000, -6000):
        for read in (0, 3):
            c = post('/api/room/create', {'gameType': 'quiz', 'timerMs': 60000, 'readMs': read * 1000, 'customBank': bank(4, True)}); R, T = c['roomCode'], c['hostToken']
            me = post('/api/room/join', {'roomCode': R, 'name': 'Skew'})
            ctx, pg, errs = player(b, R, me['playerId'], 'Skew', skew=skew)
            post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'start'}); time.sleep(.8)
            w = wait_enabled(pg, 9); ok = w is not None and w < read + 1.6
            if ok: pg.locator('.popt').nth(0).click(force=True); time.sleep(.3); ok = pg.evaluate("()=>!!document.querySelector('.popt.is-picked')")
            ph = pg.evaluate("()=>(document.querySelector('#pphase')||{}).textContent")
            rec('clock skew %+ds, read %ds -> answers open on time and selectable' % (skew // 1000, read), ok, {'enabledAfter': w, 'phase': ph}); ctx.close()
    # join mid-question
    c = post('/api/room/create', {'gameType': 'wyr', 'timerMs': 60000, 'readMs': 0, 'customBank': bank(3, False)}); R, T = c['roomCode'], c['hostToken']
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'start'}); time.sleep(.5)
    me = post('/api/room/join', {'roomCode': R, 'name': 'Late'})
    ctx, pg, errs = player(b, R, me['playerId'], 'Late'); w = wait_enabled(pg, 5)
    if w is not None: pg.locator('.popt').nth(1).click(force=True); time.sleep(1.8)
    rep = json.loads(urllib.request.urlopen(BASE + '/api/roster?room=' + R + '&hostToken=' + T).read())
    rec('join mid-question -> sees question, can vote', w is not None and any(p['voted'] for p in rep['players']), rep)
    # reload after voting -> choice restored
    pg.reload(); time.sleep(1.5); rec('reload after voting -> my pick is restored', pg.evaluate("()=>document.querySelectorAll('.popt')[1]&&document.querySelectorAll('.popt')[1].classList.contains('is-picked')"))
    # freeze / resume
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'freeze'}); time.sleep(.6)
    fz = pg.evaluate("()=>/frozen/i.test((document.querySelector('#pphase')||{}).textContent)")
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'freeze'}); time.sleep(.6)
    rec('host freeze -> phone shows frozen, resume continues', fz and not pg.evaluate("()=>/frozen/i.test((document.querySelector('#pphase')||{}).textContent)"))
    # offline -> reconnect overlay -> back
    pg.goto(BASE + '/play?qa=1'); time.sleep(1.5)
    pg.evaluate("()=>window.__ffaBus.kick(3500)"); time.sleep(1.0); ov = pg.evaluate("()=>{const o=document.querySelector('.offline');return !!o&&o.classList.contains('on')}")
    time.sleep(6); back = pg.evaluate("()=>{const o=document.querySelector('.offline');return !o||!o.classList.contains('on')}")
    rec('network drop -> reconnect overlay -> recovers', ov and back, {'overlay': ov, 'recovered': back})
    # restart -> lobby
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'restart'}); time.sleep(1.2)
    rec('host restart -> back to lobby', pg.evaluate("()=>!!document.querySelector('.pstate.lobby')")); ctx.close()
    # auto-advance
    c = post('/api/room/create', {'gameType': 'wyr', 'timerMs': 5000, 'readMs': 0, 'autoNextMs': 5000, 'customBank': bank(2, False)}); R, T = c['roomCode'], c['hostToken']
    me = post('/api/room/join', {'roomCode': R, 'name': 'Auto'}); ctx, pg, errs = player(b, R, me['playerId'], 'Auto')
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'start'}); time.sleep(13.5)
    q = pg.evaluate("()=>(document.querySelector('.eyebrow b')||{}).textContent")
    rec('auto-advance -> next question starts by itself', q == '2', q)
    # game over -> Wrapped + spaceship cursor above it
    post('/api/host', {'roomCode': R, 'hostToken': T, 'action': 'end'}); time.sleep(6.5)
    pg.mouse.move(400, 300); pg.mouse.move(600, 380, steps=6); time.sleep(.3)
    wr = pg.evaluate("()=>{const w=document.getElementById('wrapped'),s=document.querySelector('.fx-ship');return {open:w.classList.contains('on'),ship:!!s&&getComputedStyle(s).opacity>0&&(+getComputedStyle(s).zIndex)>(+getComputedStyle(w).zIndex)}}")
    rec('game over -> Wrapped opens, spaceship cursor visible above it', wr['open'] and wr['ship'], wr); ctx.close()
    # report page has the spaceship cursor
    ctx = b.new_context(viewport={'width': 1366, 'height': 768}); pg = ctx.new_page(); pg.goto(BASE + '/report?room=' + R); time.sleep(1.5)
    pg.mouse.move(300, 300); pg.mouse.move(500, 360, steps=6); time.sleep(.3)
    rec('report page -> spaceship cursor', pg.evaluate("()=>!!document.querySelector('.fx-ship')&&getComputedStyle(document.querySelector('.fx-ship')).opacity>0")); ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if which in ('all', 'combos'):
        for n, quiz, lock, read in itertools.product((2, 3, 4), (True, False), (False, True), (0, 3)):
            if os.environ.get('SKIP') and ('%d%s%s%d' % (n, quiz, lock, read)) in os.environ['SKIP']: continue
            combo(b, n, quiz, lock, read)
    if which in ('all', 'edges'): edges(b)
    b.close()
prev = json.load(open(OUT)) if os.path.exists(OUT) and which != 'all' else []
prev = [r for r in prev if r['test'] not in {x['test'] for x in results}]
json.dump(prev + results, open(OUT, 'w'), indent=1)
print('\n%d/%d passed' % (sum(r['pass'] for r in results), len(results)))
