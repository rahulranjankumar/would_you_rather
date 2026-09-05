# 🏆 Would You Rather + Quiz — Premium Edition
### An Accenture Fun Friday activity · Currys project team

A real-time, 150+ player game for your **Microsoft Teams** Fun Friday — now with a **luxury
"liquid glass" design**, cinematic spring motion, a glowing circular timer, live-breathing vote
bars, and a **cinematic Accenture brand intro that dissolves into particles ("snap")** on first load.

**Zero dependencies. No `npm install`. Plain Node.js (v18+).**

---

## 🚀 Quick start
```bash
cd would-you-rather
node server.js
```
| Who | URL | What |
|-----|-----|------|
| **Host** | `http://localhost:3000/host` | Pick game type, create room, control the game |
| **Big Screen** | opened from Host Console → **share on Teams** | The hero view everyone watches |
| **Players** | `http://localhost:3000/` (or scan QR) | Enter name, then vote |

---

## ✨ Premium visual & motion system (v4)
- **Liquid glass surfaces** everywhere — layered frosted panels (`backdrop-filter` blur+saturate),
  inner highlight, deep soft shadows, and a slow **specular sheen** that drifts across the glass.
- **Signature liquid background** — animated aurora orbs (purple/teal/magenta) floating behind the
  glass on a near-black → deep-purple mesh.
- **Cinematic brand intro** — on first load, the **real Accenture × Currys logo** draws in with a
  glow pulse and light sweep, then **disintegrates into drifting particles** (Avengers/Thanos
  "snap") to reveal the app. Skippable (tap), plays once per session, and is a tasteful fade under
  `prefers-reduced-motion`.
- **Spring motion** — shared easing tokens (`--ease-expo`, `--ease-spring`); tap ripples, springy
  option cards, focus-pull state transitions, frosted "lock" pulse.
- **Result reveal** — **liquid-fill** bars + **odometer count-up** percentages + elegant shimmer
  particles (not cheap confetti).
- **Big Screen (the hero)** — glowing **circular timer ring**, **live-breathing** mini vote bars
  that grow as votes stream in, and a "wow" cinematic reveal designed for the Teams share.
- **Idle logo shine** — a subtle light sweep passes over the real logo every few seconds.
- **Performance** — GPU-only animation (transform/opacity/filter), lighter effects on phones,
  full `prefers-reduced-motion` support. See `DECISIONS.md` (no heavy 3D lib by design).

## 🎮 Two game types (choose at setup, switch after End)
- **🎲 Would You Rather** — no correct answer; reveal shows the crowd's **% split** per option.
- **🧠 Quiz** — each question has a **correct answer**; reveal highlights it (✅) and shows the
  **% who picked each**. Correct answers are **never** sent to players during voting.

## 🎛️ Host controls
Start · **Lock** · Next · **Restart (same)** · **End → pick new settings**. Leaderboard on/off and
timer chosen at setup. Auto-recreates the room if the server was restarted (no "ghost room").

## ⚙️ Config
`PORT` (auto on Render), `DEFAULT_TIMER_MS` (20000), `MAX_PLAYERS` (300).
Edit **`questions.json`** (WYR) and **`quiz.json`** (with `correct` index) to change questions.

## 📊 Capacity — will 200–300 players fit in 512 MB?
**Yes, comfortably.** Measured on this build:
- Idle server: **~49 MB** RSS.
- **300 players fully connected (live SSE) + a full vote round: ~79 MB** RSS.

That leaves **400+ MB free** on a 512 MB instance. Each player is one lightweight SSE
connection + a tiny in-memory record; vote tallies are atomic counters, and the "x of y voted"
broadcast is throttled (~5/sec) so a 300-vote burst never thrashes CPU or memory. Node's single
process handles 300 concurrent easily. `MAX_PLAYERS` defaults to **350** for headroom.

> Render free tier note: the 512 MB / 0.1 shared-CPU instance is fine for one Fun Friday room.
> Just warm it up ~2 min before (it sleeps after 15 min idle).

## 🧪 Tested
`node loadtest.js auto 150 wyr` → 150 votes in ~130ms (~1,100/s); 250-player headroom; quiz
correct-answer hidden until reveal; change-vote, vote-after-lock, bad-token, end→reconfigure→start
all pass.

## 🔒 Branding
SVGs in `assets/branding/` are **fallback wordmarks** — drop in the **official Accenture & approved
Currys logos** before real use (see `BRANDING.md`). The intro animates *on top of* the real asset.

## ☁️ Deploy for teammates in other cities
See the separate **Render deploy guide** (or any card-free Node host). It's a long-running server,
so avoid serverless (Vercel/Netlify) — those can't run the live SSE connection.

### Files
```
server.js  questions.json  quiz.json  loadtest.js  DECISIONS.md
public/  index.html · play.html · host.html · screen.html
         app.css (luxury design system) · shared.js · intro.js (particle dissolve)
assets/branding/  logo placeholders + BRANDING.md
```
