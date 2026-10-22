# Performance proof: read this first
## Load (server)
See `loadproof.json`: 700 simulated phones, the v25 client behaviour compared with v27.

| Metric | v25 | v27 |
|---|---|---|
| Votes counted | 2,100 / 2,100 | 2,100 / 2,100 |
| Host lobby frames, peak per second | 371 | 5 |
| Join-storm peak requests per second | 848 | 436 (−49%) |
| Voting peak requests per second | 336 | 264 (−21%) |
| CPU per question | 0.32 s | 0.34 s (shared sandbox CPU, noisy) |

## Frame timing (client)
- **Sandbox limits:** the build sandbox has **no GPU**. Chromium renders WebGL through SwiftShader (CPU software rendering), so FPS numbers measured here (5–25 fps) say nothing about an Iris Xe laptop or a Snapdragon 7-series phone. I am **not** claiming the p95 < 16.7 ms target is proven.
- **What was verified here:**
  - DPR stays fixed.
  - Tiers change only how much is drawn.
  - The crew repaints only when something moves, and walking costs nothing because the characters are moved by the compositor.
  - The river is one draw call.
- **To get real numbers:** on the reference laptop, open any page with `?tier=balanced` and press **F**. The HUD shows FPS, p95 and DPR. For CI, run `perf_proof.py` (Playwright + rAF frame timing) on a machine with a GPU.
