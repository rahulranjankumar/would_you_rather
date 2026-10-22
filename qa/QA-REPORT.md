# Fun Friday Arena v28.1 · QA report (batch 2)
Run against the real server in Chromium (Playwright). Phones are emulated with touch input and mobile mode.

| Suite | Result |
|---|---|
| `npm run widthtest` (static rules) | all pass |
| `npm run playtest` (original API play-through) | 63 / 63 |
| `qa/test_matrix.py` (logic combinations) | 24 / 24: options 2/3/4 × Quiz/WYR × lock-in off/on × reading time 0/3 s |
| `qa/test_matrix.py` (edge cases) | 12 / 12: clock skew ±6 s × reading time 0/3 s, join mid-question, reload keeps the pick, freeze/resume, network drop → reconnect overlay → recovers, restart, auto-advance, game over → Wrapped + cursor, report cursor |
| `qa/test_layout.py` (8 screen sizes) | 62 / 62: landing Join in first view, join Board button on screen, 2/3/4 long options all on screen above the emoji dock with no clipped text, no horizontal scroll, sticker crew on phones and 3D on tablet/laptop, big screen + host at 1280/1366/1920 |
| `validate.py` (3D scenes) | 42 / 42 scenes run start to finish, no NaN, nothing off into space |
| `loopcheck.py` (seamless loops) | every scene ends ≤ 0.016 units from its start pose. The remaining larger frame-to-frame moves are deliberate off-screen moves: falling out of frame behind the card, rockets above the top edge. |
| `loadproof` (700 players) | 2,100 / 2,100 votes counted, host lobby frames ≤ 5/s, answer-time clamp OK |

## Notes on the test environment
- **Frame rate:** the sandbox has no GPU (software WebGL), so it can't measure frame rate. On a real laptop, press **F** on any page to see FPS, tier and DPR.
- **Fonts and emoji:** the sandbox blocks Google Fonts and has no emoji font, so screenshots show fallback fonts and empty boxes for emoji. Real devices show them normally.
