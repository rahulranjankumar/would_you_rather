# Architecture & Design Decisions

## No heavy 3D / animation library (§6.4 performance guardrail)
The luxury "liquid glass" look and cinematic motion are built with **CSS + a tiny amount of
vanilla JS + one lightweight `<canvas>`** — **no Framer Motion, no Three.js, no GSAP**.
Rationale:
- The player bundle must stay tiny (fast first load on mid-range phones over 4G). Shipping a 3D
  or spring-physics library would blow the budget for zero functional gain.
- All motion uses **GPU-friendly properties only** (`transform`, `opacity`, `filter`) with shared
  easing tokens (`--ease-expo`, `--ease-spring`) so it feels like spring physics without a lib.
- The particle "snap" dissolve is a single canvas that samples the **real logo asset's pixels**
  and animates them — a few KB of JS, 60fps, and disposed after it runs.

## Brand safety (§6.1 / §6.4.3)
- The intro and idle shine **never redraw or distort** the Accenture/Currys logos. They display
  the official SVG assets from `/assets/branding/` and apply CSS/canvas **transforms & masks on
  top**. The dissolve samples the rendered asset's pixels; it does not invent geometry.
- Graceful **text-mark fallback** (correct purple) if an asset is missing, so nothing breaks.

## Real-time transport: Server-Sent Events (SSE)
Chosen over raw WebSockets because it's dependency-free, auto-reconnects natively, and is a clean
one-way server→client fan-out (client→server actions go over normal HTTP POST). One Node process
comfortably handles 250+ players (load-tested).

## Server-authoritative everything
Timer, vote tallies, and the correct answer live on the server. Quiz correct answers are **never**
sent to players during voting — only at reveal. This prevents cheating and clock-drift exploits.

## Performance specifics
- Aurora background animates via `transform` on blurred orbs (cheap compositing).
- On phones (`max-width:640px`): reduced blur, fewer orbs, slower sweeps → fewer paints.
- `prefers-reduced-motion`: all motion swapped for tasteful fades; particle intro becomes a quick
  brand flash.
- Live "breathing" vote bars on the Big Screen update from throttled `vote:progress` (~5/sec),
  not per-vote, so a 150-vote burst never thrashes the UI.
