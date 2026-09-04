# 🎉 Would You Rather + Live Polls
### An Accenture Fun Friday activity · Currys project team

A real-time, 150+ player game for your **Microsoft Teams** Fun Friday. The host shares the
**Big Screen** on Teams; everyone joins on their phone, votes each round, and the live crowd
result is revealed with a leaderboard. Now with a **liquid-glass UI**, **2–4 options per
question** (Would-You-Rather *and* multiple-choice polls), and a **Restart / Play Again** flow.

**Zero dependencies. No `npm install`. Plain Node.js (v18+).**

---

## 🚀 Quick start (30 seconds)

```bash
cd would-you-rather
node server.js
```

| Who | URL | What they do |
|-----|-----|--------------|
| **You (host)** | `http://localhost:3000/host` | Create room, start/advance, restart |
| **Big Screen** | link in Host Console → **share on Teams** | The screen everyone watches |
| **Players** | `http://localhost:3000/` (or scan QR) | **Enter name first**, then vote |

---

## 🎮 Running it on Teams (players in different cities)

Because everyone is remote, the app needs a public address. Easiest **free + temporary** options:

1. **Free cloud host (recommended):** deploy the folder to **Render.com** (free tier) → it runs
   `node server.js` and gives you `https://your-game.onrender.com`. Share that link + room code.
   Delete the service after the event. *No build step needed — it's plain Node.js.*
2. **Tunnel (if allowed on your machine):** `cloudflared tunnel --url http://localhost:3000`.

Then: open **/host**, click **📺 Open Big Screen**, **share that window on your Teams call**,
and everyone scans the QR / types the room code.

> On a corporate/VPN laptop, cloud hosting (option 1) is usually the smoothest and most
> compliance-friendly choice.

---

## ✨ What's new in v3
- **Two game types** — choose at setup (and switch after **End game**):
  - **🎲 Would You Rather** — no correct answer; shows the crowd's % split per option.
  - **🧠 Quiz** — each question has a **correct answer**; at reveal it highlights the correct
    option (✅) *and* still shows the % who picked each. Quiz answers are **never** sent to
    players during voting (verified) — only at reveal.
- **End game → new settings.** Clicking **End game** returns you to the setup screen to pick
  game type / leaderboard / timer again, then starts a fresh game with the same players.
- **Fixed the option-card collision** — the A/B/C/D badge now sits *above* the text (no overlap).
- **Responsive** for phone + laptop; **performance-tuned** (lighter blur + no blobs on mobile,
  `prefers-reduced-motion` respected) so it stays smooth.
- **Reliable Lock** button and clean results rows (badge · text · %, with a tinted fill bar).
- Quiz bank in **`quiz.json`** (15 questions w/ `correct` index); WYR bank in `questions.json`.

## ✨ What's new in v2

- **2–4 options per question.** `questions.json` now uses `{ category, prompt, options: [...] }`.
  Two options → Would-You-Rather cards; three/four → a poll. All 11 of your townhall/Currys
  questions are included, plus fun WYR ones (24 total).
- **Liquid-glass UI:** animated aurora background, floating blobs, frosted-glass cards,
  shimmering buttons, animated result bars, confetti, entrance motion. Respects
  `prefers-reduced-motion`.
- **Name asked first** on the join screen.
- **Restart / Play Again:** host can restart after Game Over — scores reset to 0, everyone
  returns to the lobby (players stay joined). Players & Big Screen follow automatically.
- **Hardened edge cases** (see below).

---

## 🎛️ Host controls
Start · Lock now · Next · **Restart game** · End game · timer + scoring mode at setup.

**Scoring — "Majority Rules":** +100 for siding with the most-popular option, plus a small
speed bonus. Ties (all options equal) award nobody. Switch to **Just for fun** for no points.

---

## ⚙️ Config (env vars)
| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `3000` | Port |
| `DEFAULT_TIMER_MS` | `20000` | Default per-question timer |
| `MAX_PLAYERS` | `300` | Max players per room |

Edit **`questions.json`** to change questions. Each item:
```json
{ "category": "Townhall Poll", "prompt": "Which segment do you like most?",
  "options": ["Leadership", "Achievements", "Business", "Fun"] }
```
2–4 options supported.

---

## 🧪 Load & edge-case test
```bash
node loadtest.js auto 150
```
Verified on this build:
- **150 players** joined in ~300ms; **150 simultaneous votes in ~133ms (~1,100/s)**.
- **250 players** headroom: votes in ~210ms.
- 4-option polls, change-vote, vote-after-lock rejection, bad-token rejection,
  and **end → restart → start** all pass.

---

## 🛡️ Edge cases handled
- One vote per player per question; change-vote decrements the old option atomically.
- Votes rejected once locked / outside an active question.
- **Server-authoritative timer**; stale suspense timers can't prematurely reveal a new question.
- Host-only actions (secret token); non-host events can't control the game.
- Reconnect/refresh restores your vote + score via full `state:sync` (persistent `playerId`).
- Duplicate names auto-suffixed; names sanitized + length-limited.
- Empty round / no votes → no false "winner"; all-way ties award no points.
- Malformed `questions.json` falls back safely; questions with <2 options are dropped.
- Restart resets scores and returns everyone to the lobby cleanly.

---

## 🏗️ Architecture
```
Phones/laptops (browsers)
   │  HTTP POST  (join / vote / host actions)
   │  SSE stream (question:show, results:reveal, leaderboard, game:restart, ...)
   ▼
Node.js server — state machine per room, live tallies,
server-authoritative timer, throttled SSE fan-out
```
- Real-time push via **Server-Sent Events** (native `EventSource`, auto-reconnect).
- Vote-storm safe: in-memory atomic tallies; "x of y voted" broadcast throttled (~4/sec).

### Files
```
server.js            backend (state machine + API + SSE)
questions.json       question bank (2–4 options each)
loadtest.js          150/250-player + edge-case driver
public/  index.html  join (name first) · play.html · host.html · screen.html
         app.css     liquid-glass styling  · shared.js helpers
assets/branding/     logo placeholders + BRANDING.md
```

## 🔒 Branding note
The SVGs in `assets/branding/` are **fallback wordmarks**, not the official logos. Drop in the
**official Accenture & approved Currys logos** before real use — see `assets/branding/BRANDING.md`.

## 📈 Scaling beyond one process (optional)
Not needed for one Fun Friday room (one process serves 250+). For multiple app instances, move
room state + tallies into **Redis** and fan out SSE via **Redis Pub/Sub** behind a load balancer.
