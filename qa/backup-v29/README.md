# Fun Friday Arena — Accenture × Currys · v28.1
A zero-dependency Node.js party game. Run `npm start`, then open http://localhost:3000. The host console is at `/host` and the big screen at `/screen`.

**v27** is a premium motion and character release. It adds:
- **The Signal River:** a living WebGL particle background at native resolution.
- **The Crew:** Momo, Noodle and Boss Bean, with 41 data-driven scenes.
- **Upgraded pages:** holographic glass cards, a boarding-pass join page, a big-screen show and a host Mission Control.
- **On-device features:** local-first answer timing and Wrapped story cards.
- **FFA.perf:** adapts *how much* is drawn and never *how sharp* it is.

See **CHANGELOG.md** for everything that changed, including each judgement call I made and what isn't built yet. See **HOSTING.md** for the one-page run guide.

## Tests
- `npm run widthtest`: static rules (resolution, motion, videos, crew, WYR wording, credits, server cost)
- `npm run playtest`: the original 63 end-to-end checks (start the server first)
- `npm run loadtest`: 700 players, v25-style hammer
- `npm run loadproof`: realistic v25-vs-v27 device behaviour. Set `V25=http://host:port` to compare.

QA screenshots and performance reports live in `/qa`.

Made by PPA Warriors.
