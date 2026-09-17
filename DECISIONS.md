# Decisions — design & performance

## Colour calibration: three passes to get it right

**v7 — noise.** Six simultaneous effects (aurora, animated grid, meteors, conic border beams,
cursor spotlight, text shimmer). Reads as busy, not premium. The meteors in particular looked like
scratches on the screen.

**v8 — austere.** Stripped to near-black `#08070C` with purple only in focus rings and the CTA.
Technically clean, but flat and cold. Lost the brand entirely.

**v9 — calibrated.** Dark base retained, but:
- Base moved to `#0A0716` (violet-tinted, not black)
- Surfaces tinted `rgba(171,120,255,…)` so panels read *lit* rather than grey
- Ambient light is a four-layer radial stack (purple dominant, teal + magenta support)
- Two slow blurred orbs, transform-animated only — ambience, never scratches
- Accent brightened `#A100FF` → `#B026FF`, highlight `#CC66FF`
- Option washes nearly doubled (`.24` → `.44`) so colour pops
- Coloured glows on room code, stopwatch, reading countdown, buttons, focus rings

Meteors, animated grid and border beams remain deleted. The lesson: the problem was never the
purple, it was the competing effects.

## The stretch bug
The join page was a 2-column grid (form | robot) inside a 940px card. `.no-robot` collapsed the
grid to one column but left the card at 940px, so the form column inflated to fill it.
Fix: `--measure: 400px` caps the form column, and `.stage.no-robot` narrows the card itself to
452px. Cannot stretch in either state.

## Why 600 players is safe
The bottleneck was never incoming votes — it was O(players) work on every broadcast.
1. **Pre-serialised SSE frames** — `JSON.stringify` runs ONCE per event into a Buffer, reused for
   every socket. Was 600 serialisations per reveal → now 1.
2. **Role-split fan-out** — progress ticks, roster state and lobby updates go only to host + big
   screen (~2 sockets), never to the 600 players.
3. **Shared reveal payload** — one identical payload; each browser derives its own verdict.
4. **Personalised `state:sync` only on connect/reconnect** — never in the hot path.
5. **Coalesced dirty-checked interval** (~4/s) instead of a timer check per vote.
6. **One global heartbeat** instead of one `setInterval` per connection.
7. **Backpressure-aware writes** — disposable frames dropped for a stalled socket; results never.
Plus `Int32Array` counters, 204-empty vote responses, short JSON keys (`r`/`p`/`c`).

### Measured (fd limit raised to 65535)
| Players | RSS | Burst | Accepted | CPU/question |
|---|---|---|---|---|
| 600 | 95 MB | 578 ms (~1,038/s) | 3000/3000 over 5 rounds | **0.252 s** |

⚠️ Honest caveat: these are local simulated clients. Real browsers on VPN/home wifi behave
differently — do one rehearsal before the event.

## Why the robot is not on the player screen
Spline is WebGL. 600 phones each running a 3D renderer during a timed vote would drop frames on
mid-range Androids. The robot runs on exactly two surfaces: the join page (pre-game, one-time) and
the big screen (one instance, host's machine). `play.html` sets `<body class="lite">`, which swaps
the layered ambient stack for a single static gradient, drops grain, orbs and backdrop-blur, and
calls none of the JS effects. Verified: **0 heavy FX calls on the player page.**

Lite mode still keeps the purple mood — it just does it with one cheap gradient instead of four
layers plus two animated orbs.

## Stack: vanilla, not React/shadcn — deliberate
Zero dependencies means no build step, no `node_modules`, runs from `node server.js` on a
locked-down corporate laptop, and deploys to Render with an empty build command.
