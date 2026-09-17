# Would You Rather + Quiz — Accenture × Currys Fun Friday
### Made by PPA Warriors

Real-time multiplayer game for Teams. **Zero dependencies, zero build step** — plain Node.js 18+.

## Run (Windows CMD)
```
cd path\to\wyr-funfriday
node server.js
```
Open **http://localhost:3000/host**. Stop with Ctrl+C.

| Surface | URL | Heavy FX? |
|---|---|---|
| Host console | `/host` | ambient only |
| Big screen (share on Teams) | opened from host console | 3D robot |
| Players | `/` → `/play` | join page has robot; **play page is LITE** |
| Report | `/report?room=CODE` | ambient only |

---

## Design system — v9 calibration

Two earlier versions missed in opposite directions:

- **v7 was noise.** Aurora + animated grid + meteors + border beams + spotlight + shimmer all
  firing at once. The diagonal meteor streaks read as screen scratches.
- **v8 was austere.** Near-black `#08070C`, purple nearly absent. Clean, but flat and cold.

**v9 keeps the dark base but lets Accenture purple actually glow:**

| | v8 (too dark) | v9 (now) |
|---|---|---|
| Base | `#08070C` near-black | `#0A0716` violet-tinted |
| Surfaces | `rgba(255,255,255,.035)` grey | `rgba(171,120,255,.075)` purple-tinted |
| Ambient | one faint gradient | four-layer glow + two slow orbs |
| Accent | `#A100FF` | `#B026FF` with `#CC66FF` highlight |
| Option washes | `.24` opacity | `.44` — colours pop |

Panels now carry a violet tint, a soft outer glow and a crisp top highlight, so they read *lit*
rather than grey. Buttons get a real purple bloom. Room code, stopwatch and reading countdown all
carry coloured glows.

**Still deleted on purpose:** meteors, animated grid, border beams. Those were the noise — not
the purple.

### The stretch bug (fixed)
The join page is a two-column grid (form | robot) inside a 940px card. When Spline failed to load,
collapsing the grid to one column left the card at 940px, so the form inflated to full width.
Now `--measure: 400px` caps the form column *and* `.stage.no-robot` narrows the card to 452px.
It cannot stretch in either state.

---

## The 3D robot (Spline)
Loaded as a **web component** from a CDN — no npm, no bundler. Appears on the **join page** and the
**big-screen lobby**, tinted toward Accenture purple with a `mix-blend-mode` layer.

**Never loads on the live voting screen.** WebGL on 600 phones mid-vote would drop frames and could
cost people their answer. If the CDN is blocked (corporate proxy), offline, or the user has
reduced-motion or data-saver on, the stage collapses and the grid reflows — no placeholder shape.

To swap the scene: remix any Spline file into your account, **Export → Code → Vanilla JS**, then
replace `SPLINE_SCENE` in `public/shared.js` with the generated `…/scene.splinecode` URL.

---

## Two-phase question timing
1. **Reading time** (default 5s, 0–30s or Off) — question shown, options dimmed and locked.
2. **Answering time** (15/20/30/45s or custom 5–300s) — options unlock, millisecond stopwatch runs.

Votes during reading are rejected server-side. Response time is measured from when answering opens.

## Scoring
`100` + speed bonus `50 × (1 − responseTime / answeringTime)`, server-timestamped.
- **Quiz** — correct answer scores; ✓/✗ shown.
- **Would You Rather** — no right/wrong anywhere; the majority scores. An all-way tie scores nobody.
- **Lock-in mode** — only locked answers score; bonus timed from the lock.

## Host controls
Start · **Close voting** (ends voting immediately rather than waiting for the timer) · Next ·
Restart · End game · Report. Plus a live two-phase timer, Voted/Locked/Players counters, and a
participants grid (grey → teal answered → gold locked).

## Capacity — measured
600 players, 5 full rounds, real SSE connections:
**3000/3000 votes accepted · ~1,038 votes/sec · 95 MB RAM · 0.252 s CPU per question.**
Run it yourself: `node loadtest.js 600`. See `DECISIONS.md`.

> Render free tier (0.1 CPU): ~2.5s to process a full 600-person round. Any full-core host is instant.

## Config
`PORT`, `MAX_PLAYERS` (700), `DEFAULT_TIMER_MS` (20000), `DEFAULT_READ_MS` (5000), `PROGRESS_HZ` (4).

## Branding
`assets/branding/` holds **placeholders**. Drop in official Accenture / approved Currys assets
(same filenames) before external use. See `BRANDING.md`.
