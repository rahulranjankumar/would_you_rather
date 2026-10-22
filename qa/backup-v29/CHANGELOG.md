# Fun Friday Arena — v27 "ARENA 2035" · CHANGELOG (final, batch 3 of 3)

Accenture × Currys · Made by PPA Warriors

v27 builds on v25. The game logic and API are unchanged: every v25 endpoint still works and the original 63 playtest checks still pass. The server changes add to v25 and make each request cheaper. All visuals run on the visitor's device.

---

## 1. Performance engine: `assets/perf.js` (FFA.perf)
- **Fixed resolution.** DPR is `Math.min(devicePixelRatio, 2)`, or 3 on phones that report 3. It's read once and never changes. No canvas resizes at runtime, no render scaling and no upscaling.
- **Tiers.** Ultra, High, Balanced and Eco are set from the GPU string, core count, device memory, pointer type, reduced motion and Save-Data. The result is cached for 7 days. Battery below 20% and not charging switches to Eco.
- **Budgets change quantity only.** Particles are 2,400 / 1,500 / 800 / 300 and confetti is 420 / 260 / 140 / 70. Glass blur is 12 / 10 / 4 / 0 px; Eco uses a multi-stop gradient glass that keeps the rim. Card tilt is off on Eco.
- **Runtime governor.** It tracks an EMA plus p90/p95. It steps down after 1.5 s below 50 fps and steps up after 6 s above 58 fps. It locks after 2 failed step-ups and ignores the first 1.5 s and single hitches over 250 ms. Tier changes crossfade.
- **Pausing.** All loops pause when the tab is hidden or the 3D intro covers the page. Crew bands also pause off-screen (IntersectionObserver).
- **F-key HUD.** Shows FPS, p95, tier, GPU and "DPR n (fixed)".
- `?tier=balanced` (or any tier) forces a tier for QA.

## 2. Server (`server.js`): additive changes that make it cheaper
- **Coalesced joins.** `lobby:update` now goes out once per 250 ms progress tick as `{playerCount, newNames[], sidekicks[]}`, and to players at most once per second. In a 700-join storm, host frames peaked at 4 per second instead of 371 (see `qa/loadproof.json`).
- **Leaderboard cache.** Serialised leaderboards and team totals are cached behind a dirty flag.
- **Local-first votes.** `/api/vote` accepts the device-measured `e` (elapsedMs). It's clamped to `[250 ms, real elapsed]`. Late, jittered batches are accepted for 1.2 s after lock, but only if `e` falls inside the timer.
- **Reactions.** `/api/react` stores counts only and flushes once per 500 ms to the big screen. There's no per-tap broadcast.
- **Host powers.** `chaos`, `drumroll`, `spotlight` and `freeze` (pause/resume the clock) each send one tiny frame.
- **New modes on the same vote engine.** Hot Takes uses the WYR engine with `hottakes.json`. Emoji Decode uses the Quiz engine with `emoji.json`. Speed Round uses a 5 s timer and a doubled speed bonus.
- **Other.** Teams are optional at join, with team totals in `leaderboard:update`. Sidekicks are stored per player.
- **Report.** New superlatives: most with the crowd, longest streak and average answer time.
- **Small additions.** `/api/time` (clock sync), `/healthz` now reports a `players` count, unknown pages serve `404.html`, plus a PWA manifest.

## 3. The Signal River: `assets/river.js` (every page)
- **Rendering.** One WebGL canvas at native DPR draws every particle in a single `gl.POINTS` call. Particles move through an analytic curl-noise field, roughly 1 in 12 purple and 1 in 30 cyan. If WebGL is missing, it falls back to a 2D canvas that changes fill colour once per colour group.
- **Cursor and touch.** The cursor creates a vortex. Fast moves leave a 24-point iridescent ribbon, and clicks send a chrome shockwave. Hovered buttons magnetise nearby particles. On phones, tilt steers the river, dragging draws a ribbon, and a 600 ms long-press makes a black hole that bursts on release with a soft haptic.
- **Game moods.** The river shows a shooting star in the lobby, dims and slows during reading, speeds up 1.6× while answering, pulses with a violet heartbeat in the last 3 s, and pours toward the majority on reveal. A lime solo stream follows a rebel's card, a quiz miss triggers a chromatic split, and game over assembles a podium that then bursts.
- **Background layers.** Nebulae and the grid floor are CSS layers that only move with transforms. On Balanced/Eco the nebulae are baked into the river's background, so they add no extra layers.

## 4. The Crew: `assets/crew.js`
- **Cast.** Momo is the Intern: a lavender gumdrop with a spring-loaded sprout, an INTERN lanyard and perched round glasses. Noodle is the Senior Dev: a teal capsule in a half-up hoodie with swinging drawstrings, a headset and a coffee that always lands back in his hand. Boss Bean is the Manager: a peach bean in a navy blazer, with a far-too-long tie, thick acting eyebrows and a moustache. All designs are original; there's no yellow capsule, denim, overalls or goggles.
- **Animation.** Squash and stretch preserve volume. Springs drive the sprout, drawstrings, tie, coat tails, arms and glasses. Eyes blink every 2–6 s (sometimes twice) and track the cursor, a target or each other. There are 10 expressions with a 60 ms morph, and held props stay upright.
- **41 playable scenes.** All 35 from the brief plus 6 extras: Campfire (60 s idle), Konami disco, 404 "fixing", Satellite (reconnect), High-five (reconnected), Bow (credits), plus a wave and a cheer for the landing. Scenes are data timelines (`[ms, who, act, ...args]`), so each one is written once and runs anywhere.
- **Director.** Picks scenes by game moment and by **your** result, never repeating any of the last 6. Picking Sides and Lock-in Seal react to your live taps, Final Countdown reacts to the clock ticks, and New Joiner Welcome handles batched names (a sign stack that falls over).
- **Easter eggs.** Click a crew member 5× and they chase your cursor. Shake your phone to knock them over. Konami code starts a disco, and 60 s idle starts the campfire.
- **Never blocks play.** The crew lives in its own band: above the answers on phones, under the cards on PC. Cards move by at most 5 px when nudged.

## 5. Pages
- **Landing.** Kinetic headline with chrome rotating brackets and a magnetic liquid-glass Join button. V1 is vignetted into the void, and the crew peeks up from the bottom edge and cheers when you hover Join. "How it works" has three holo cards playing V3–V5 inside. The game-mode drag carousel plays a crew mini-scene on hover. Also: a live odometer room counter, V6 with "SEE YOU AT 4 PM", and the credits easter egg.
  - **Video rules.** Videos load with `preload="none"`, play only when visible and only one at a time. On phones only V1 autoplays. Each video's first frame is captured once and cached as its poster.
  - **3D intro.** The once-per-40-minutes policy and the ▶ Play intro pill are kept. The page "pulls back" after the intro. Lite mode is removed; the perf tiers handle it automatically.
- **Join ("Boarding Pass").** V2 plays at 30% behind frosted holo glass. The 5-cell room code flips in like a departure board and auto-advances. The name field gets a self-drawing cyan focus ring and shakes if the name is taken. You pick a sidekick (Momo, Noodle or Boss Bean). Boarding tears the perforated stub, then a portal swirl takes you to /play.
- **Play ("The Arena").**
  - **Cards.** Holographic glass cards with 8° tilt, a cursor or tilt-driven specular hotspot, holo sheen, a pressure ripple, a lime selected rim and a chrome LOCKED seal.
  - **Timer.** A chrome timer ring sits around the VS badge and heats from cyan to purple to violet-red.
  - **Reveal.** Vote fills rise like liquid and slosh. The majority gets a chrome crown, corner cannons and the river pour. Your card gets a lime REBEL tag if you went against the crowd. Chrome coins fly to an odometer score pill.
  - **Extras.** Combo meter (×2 🔥, ×3 ⚡, ×5 LEGENDARY flash with a bass drop). The emoji dock is batched. The leaderboard shows rank-change arrows. Haptics are on for phones.
  - **WYR wording.** WYR never says "wrong": you're either *With the crowd* or *Against the crowd · Rebel energy*.
- **Wrapped.** Six story cards drawn on a 1080×1920 canvas: hello, speed, crowd vs rebel, best streak, final rank and your title (13 titles). Save PNG or Share. It makes **zero network calls**, and the log is deleted after 24 h.
- **Host ("Mission Control").** New setup options: Mode (WYR, Quiz, Hot Takes, Emoji Decode, Speed Round), Team mode, Seasonal skin, Crew on the big screen and Reactions. Host powers (🎭 Chaos, 🥁 Drumroll, 🔦 Spotlight, ⏸ Freeze) have keyboard shortcuts: Space, R, N, C and D. **There's no roster polling**: the roster loads on reveal, at game end, when the players panel opens, or from names that arrive with each lobby update.
- **Big screen ("The Show").**
  - **Lobby.** V1 at 25% behind the river. The room code is in holo-foil mono, the QR code has a chrome frame, and joining names drop in as tiles with sidekick avatars.
  - **Questions and reveal.** Vote rain falls into each option's bucket, and reactions float up. Reveal uses the same liquid bars, crown and cannons, plus a "Fastest finger" card with a chrome flash. A 4 s Crew Comedy interlude plays, then the board.
  - **Team mode.** A tug-of-war rope appears.
  - **Game over.** Holo pillars, the crew carries the winner's placard, and V6 plays behind "MISSION COMPLETE".
  - **Host powers.** Spotlight sweeps a name across the screen.
- **Report.** Crew header, per-question bars, new superlatives and print-friendly styles.
- **404 and Reconnecting.** On the 404 page the crew is fixing the site. When the connection drops, they adjust a satellite dish, then high-five when it's back.

## 6. FX (`assets/fx.js`)
- **Confetti.** Now renders at native DPR (v25 capped it at 1.5). It uses direct `setTransform` math instead of save/translate/rotate/restore, changes fill colour once per colour group per frame, and caps the particle count by tier.
- **20 transitions.** The original 15 plus hologram scan, portal swirl, liquid chrome wipe, warp streaks and pixel assemble. The old clip-path "iris" is now a transform scale. Everything animates **transform and opacity only**.
- **Other.** Lime cursor ring and chrome coins.

## 7. Intro (`public/intro3d.html`): targeted fixes only
- **MSAA.** Fixed at 4× for the whole run. The quality ladder no longer changes it; tier 6 thins the crowd instead.
- **Crowd.** Uses LOD helmets (28×20 segments) and `MeshStandardMaterial`. The hero cast stays at full quality.
- **Thanos snap.** The dust is built in `requestIdleCallback` during the end card instead of with a synchronous `getImageData` at the snap.
- **Warm-up.** `renderer.compile(scene, camera)` runs behind the gate.

---

## Decisions where the brief left it to me ("Agent's call") and deviations
1. **The crew is an SVG rig on every tier, not three.js 3D on Ultra/High (deviates from §6.6).** Each character is its own small SVG moved by a compositor-only `translate3d`, and the code skips DOM writes when nothing changed. That means walking never repaints the band, and an idle crew costs almost no paint. A second WebGL context on /play would compete with the Signal River for the GPU and would require loading three.js on the play page. The SVG version looks the same on every phone and keeps the signs and text crisp at native DPR.
2. **River particles are simulated on the CPU and drawn with one WebGL `POINTS` call**, not with ping-pong float textures. At 2,400 particles this is well under a millisecond of JS on laptops, and it doesn't depend on float-texture support, which varies across Android GPUs.
3. **Intro lights are not removed from the scene graph.** Changing the light count forces three.js shader recompiles mid-cinematic, which is a bigger hitch than the per-light cost it would save. Warm-up compile was added instead.
4. **"First to answer!" and "Photo finish" are not built.** Both would need per-vote ordering broadcast to every phone, which makes the server more expensive (hard rule). The "⚡ Fastest finger" badge uses data the server already sends.
5. **The WYR "Upset!"** (majority flips in the last second) can't be detected on a phone without a per-vote stream. "Upset!" fires in Quiz mode when the minority was right.
6. **Wrapped says "x s behind the room's fastest finger"** instead of "faster than 72% of the room". The device doesn't know other players' times, and the brief rules out a new endpoint.
7. **Teams are chosen at join.** There's no auto-balancing (the brief allowed choosing at join). The tug-of-war shows the top two teams.
8. **Seasonal skins change the crew's wardrobe only:** Diwali kurta, Christmas scarf and Santa hat, and party hats at the finale. Diyas along the bottom, Holi powder confetti and snow in the river are **not** built yet.
9. **"Who Said It?" mode and an extra room-shouting mechanic** (double-or-nothing / Boss Question) are **not** built yet. Both need new server state, so they were left out to keep this release safe.
10. **"No wrong answers" was rephrased** to "Every answer counts" so the word "wrong" never appears in WYR, as the hard rule requires.

## Test status (see `/qa`)
- **widthtest (v27 static):** all checks pass. These cover the DPR rules, motion rules, video whitelist, crew ≥ 30 scenes, no "wrong" in WYR, team-name-only credits and the server cost rules.
- **playtest:** 63 / 63 pass. It's unchanged from v25.
- **loadtest27 (700 players, realistic tap model, v25 vs v27, final run):**
  - **Votes:** all 2,100 of 2,100 counted, and every question's counts matched what the devices sent.
  - **Answer time:** spoofed answer times are clamped (minimum and maximum both verified).
  - **Join storm:** lobby frames to the host peaked at **5/s** (v25: 371/s), and peak requests dropped **49%** (436 vs 848 per second).
  - **Voting burst:** the peak dropped **21%** (264 vs 336 per second). In batch 1 it was 17% *higher*; widening the send jitter (150 to 1,800 ms, follow-ups at most every 1.5 s, always before the flush 600 ms before time-up) fixed it.
  - **Busiest moment overall:** **49% lower** than v25, which meets the brief's ≥ 40% target.
  - **CPU per question:** 0.34 s vs 0.32 s for v25, about **8% higher**. This doesn't meet the brief's "equal or lower" target. Both servers ran side by side on one shared sandbox CPU, so the comparison is noisy; re-measure on Render before relying on it.
- **Playwright screenshots** at 6 viewports, with automated checks for horizontal scroll, crew overlap and clipped text: see `qa/`.
- **Frame timing:** the sandbox renders with software WebGL (SwiftShader), so the numbers are **not** from the reference Iris Xe laptop. See `qa/PERF.md` before reading them.

## Batch 3 fixes
- **Crew signs and speech bubbles** (for example Noodle's lime "REBEL" sign) could stay invisible when the browser was busy, because the pop-in animation started at opacity 0. The pop is now scale-only, so signs are always readable.
- **Vote sends** are spread more widely (see the load test results above).
- **Landing (phone):** the "host console" link no longer sits under the crew band and the ▶ Play intro pill.
- **Big-screen podium:** the tallest pillar is now #1.
- **Big screen:** a big screen that opens after people have joined now fills its name wall right away (the server sends the last 60 names once, on connect).
- **Big screen:** in four-option questions the timer ring is smaller so it doesn't cover the option letters, podium pillars have a minimum height so the "pts" line isn't clipped, and the footer no longer shows "· questions" without a number.
- **404 page:** no horizontal scroll at 768 px.

## QA screenshot pass (`qa/`, `qa/qa-results.json`)
- **Coverage:** 62 screenshots across 360×640, 390×844, 768×1024, 1280×720, 1536×864 and 1920×1080, covering landing, join, play (lobby, question, rebel reveal, Wrapped), screen (lobby, question, game over), host, report and 404.
- **Automated checks:** no overlap between the crew and tap targets, and no clipped text.
- **Horizontal scroll:** one case (404 at 768 px), now fixed.
- **Test flake:** one click timeout on the 1280 px run came from the software renderer being slow. That page's screenshot shows the question rendered correctly.
- **Known screenshot artefacts in this sandbox:**
  - Emoji show as empty boxes, because the sandbox has no emoji font.
  - The QR code is blank, because the sandbox blocks the external QR service.
  
  Both display normally on real devices.

---
## v27.4: feedback round
- **Intro loader:** the "Loading 3D…" spinner is replaced by a Mr-Bean-style UFO loader:
  - **Sequence:** a saucer swoops in from the top-left corner (tiny, then big) and switches on its tractor beam. "FUN" and "FRIDAY" drop down the beam, then "FRIDAY" lands crooked and slips.
  - **Controls:** once the engine is ready, the screen shows *Press any key or click anywhere to continue*.
  - **Skipping:** Esc does nothing until the show has started, and the landing page's ✕ only appears after start.
  - **Exit:** the saucer zips away as the camera dives into the scene.
- **Ringtone:** the ringtone settings are at the top of `public/intro3d.html`: `CALL_URL`, `RING_SECONDS`, `RING_START_AT` and `RING_VOLUME`.
- **Emoji reactions:** there are now 8: 😂 🔥 😱 👏 💜 😎 😜 🥺.
  - **Your taps:** shown on your screen instantly. The emoji flies from the dock and pops in the background with your name, with a 3D spin and a ring burst. Each dock button counts your own taps.
  - **Others' taps:** the server sends one batched frame (every 0.5 s with up to 60 players, 1 s up to 250, 2 s above that) listing the top 30 [name, emoji, count]. Phones and the big screen scatter them at random spots with names, up to 3 copies each and no "×N".
- **Cursor:** the circle cursor is replaced by a chrome spaceship whose nose is the click point. It turns toward the direction you move and leaves a rocket-exhaust trail (white → lime → cyan → purple), which boosts over buttons and on click.
- **Avatars:** the avatar picker is removed. Everyone gets a unique coloured initials badge on their phone, the big screen tiles and the leaderboard.
- **Landing page:** "The room tonight" section and its menu link are removed. The crew is now fully visible in the first screen.
- **4 options on laptops:** the timer ring moves into the top bar and the cards are compact. The question, all 4 cards and the crew fit at 1536×695.
- **Quiz colours:** the correct answer is green with ✓ and your wrong pick is red with ✕, on phones and the big screen.
- **Crew in the game:** the crew is bigger and lives on the cards. They climb up the card edge, walk along the top, and sit with their legs dangling and swinging. Taps pass straight through them.
- **New 2.5D moves:** a turnaround spin (the body narrows and the face slides round), depth pops, falling off the ledge and climbing back.
- **11 dance moves:** robot, floss, sprinkler, twist, disco, shuffle, wiggle, headbang, chicken, flex and moonwalk.
- **New scenes, played at random throughout the lobby and the game:**
  - **Dances:** Dance Party, Dance-Off, Copycat, Flex-Off and Headbang.
  - **Trio gags:** Poke War, Push-Off-The-Ledge, Head Bonk, Tie Snap, Sneeze, Ledge Chill and Tough Guys.


---
## v28.0: Batch 1 of 2 (real 3D trio)
- **New trio:** the 2D SVG crew is deleted. **Bip** (tall, one big eye, blue overalls, hair sprigs), **Bop** (short, two eyes, red cap) and **Boop** (chubby, buck teeth, green scarf) are now real 3D models. They have pastel vinyl-toy bodies, soft key and fill lighting, specular highlights and a lilac rim light.
- **Engine (`assets/toy3d.js`):** a custom WebGL engine of about 15 KB, used instead of three.js, which would be about 600 KB on each of 400 phones.
  - One shared full-screen canvas for all crew bands on a page.
  - Resolution stays at the device's native DPR.
  - Rendering pauses when no band is visible or the tab is hidden, and eco mode runs at 30 fps.
- **Rig and faces:** a 3D rig with squash and stretch, real body turns (the characters can show their backs), eyes that track the cursor in 3D, and blinking. 10 expressions: wide, happy, closed, X (dizzy), cross-eyed, brows, smile/grin/open/frown/o mouths, plus cream face, mustache, soot, hair standing up, dizzy stars and seated with dangling legs.
- **42 scenes (`assets/crew.js`).** All 30 gags from the brief:
  - **Rocket:** sneaky rocket, rocket chain, wrong end, rocket seat, fizzle fake-out, rocket tug.
  - **Revenge:** pie relay, whoopee cushion, bucket, poke war, sticky gum, paint swap, plus **cake in the face**.
  - **Chaos:** domino, seesaw, banana relay, magnet, spring boots, balloon lift, plus **zoomies** (high-speed random runs with collisions).
  - **Teamwork fails:** human ladder, piggyback, tug-of-war, fake-out lift, trench coat.
  - **Contests:** rock-paper-scissors, staring contest, dance-off, strong-man, tickle.
  - **Finishers:** group hug, victory pose.
  - **Game moments:** celebrations, sad (rain cloud), wave, cheer, high-five, bow, satellite dish, nudge and yawn, plus live attend, stomp-lock, panic and climb-in.
- **Where the trio appears:**
  - **Landing:** stands on the headline (not over the video) and loops random gags.
  - **Play:** climbs onto the answer cards, sits on the edge and plays random gags between questions.
  - **Also:** lobby, big screen, report, 404 and the reconnect overlay.
- **New sounds:** splat, boing, clang, fizz, sneeze, zoom and bell.
- **Fixed: "Reading time" stuck and answers not selectable.**
  - **Cause:** the clock offset was skewed when a slow (cold-started) server answered the time sync.
  - **Clock sync:** it now trusts only the fastest round trip and never reuses an offset from a previous session.
  - **Lower bound:** each question frame also sets a minimum offset.
  - **Reading time 0:** with reading time set to 0, answering opens immediately.
- **Fixed:** the trio no longer goes missing when a scene starts before the band has been measured.
- **QA:** `public/_crewlab.html` (`?s=sceneName`) and `stage.seek(name, t)` freeze any scene at any moment.


---
## v28.1: Batch 2 of 2 (polish, phones, fit-to-screen, full testing)

### Seamless loops on every scene
- **Start:** each scene starts from wherever the trio is standing.
- **End:** in its last ~0.7 s every joint, position, expression and prop eases back to the neutral start pose. Any scene can follow itself or any other scene with no snap. All 42 scenes were verified frame by frame (`loopcheck`): final-pose error is at most 0.016 units.
- **Pop absorber:** a hard cut of more than 0.6 units, or more than 0.9 rad, in one frame becomes a ~150 ms whoosh instead of a teleport.
- **Landing carousel:** gags now loop back-to-back with no gap.

### 3D look upgrades (compared against the reference studio)
- **Faces:** real eyelids (a skin dome that rotates down for blinks, sleepy and sneaky looks), a dark lash rim around each eye and a second catchlight.
- **Body details:** thumbs on the mitten hands, white toe caps on the sneakers, a belly patch on Boop and a button nose on Bop.
- **Short bands:** in short bands (lobby strip, card ledge, landing headline), gags with tall props (trench coat, human ladder, piggyback stack, spring-boot ceiling) are skipped so nothing covers text.

### Phones: no 3D, a sticker crew
- **Rendering:** phones (touch screen with shortest side under 600 px) never create a WebGL context. The trio is 45 pre-rendered WebP stickers (`assets/crew/*.webp`, about 11 KB each, loaded on demand), animated with compositor-only CSS and native emoji props.
- **16 phone gags:** pie war, rocket, head-bonk, banana slip, sneeze, dance, balloon pop, sleepy poke, flex-off, tug snap, spin-off, cheer, rain-cloud, wave, soot boom and the satellite dish. Tap a sticker and it reacts.
- **Same API:** every page runs unchanged. `?force3d=1` and `?pocket=1` override the choice for QA.
- **Landing on phones:** the heavy 3D intro is skipped and its pill hidden. Laptops and the big screen still get it.

### Auto-fit to every screen
- **Play:** with 2, 3 or 4 options, `fitQ()` shrinks the question, cards, crew band and type step by step (down to 58%) until everything fits the viewport, with no scrolling and nothing under the emoji dock. 3 options sit in 3 columns on laptops; landscape phones get 2 columns.
- **Join:** the boarding pass fits the screen with `fitJ()`, so the Board button is always visible. Short laptops get a wider two-column pass. It doesn't re-fit while you type, so the keyboard can't make it jump.
- **Emoji dock:** sizes itself to the phone width and no longer overlaps the mute button.

### Other fixes
- **Cursor:** the spaceship cursor now sits above Wrapped, and also appears on the report page and the host console.
- **Intro:** if the browser already allows sound, the intro starts by itself right after the UFO; otherwise "press any key / click" unlocks sound. The "SOUND ON" hint is removed. The hero cast's sphere tessellation is trimmed (72×54 → 52×40 and 56×40 → 44×32) with no visible difference at screen size.
- **Server:** serves `.m4a`, `.ogg` and `.wav`, so a custom ringtone can use any of those formats.

### Reference studio code: what was adopted and what wasn't
- **Adopted:** articulated 3D eyes with eyelids and catchlights, thumbs, two-tone sneakers, a belly patch and a button nose. The 3D trio already used real 3D facial parts and a shared soft-light shader.
- **Not adopted:** three.js from a CDN (about 600 KB per phone; Toy3D is about 15 KB), the yellow skin plus goggle strap on Bip (reads as Minions), and a 1024² shadow map (our contact-shadow discs cost nothing).
- **Reference's claims about `intro3d.html`:** checked against the code.
  - **Face canvases:** already redraw only when the expression changes, not every frame.
  - **LED wall:** already capped at 30 fps.
  - **`getImageData`:** already moved off the snap in v27.
  - **Bloom and shadows:** already handled adaptively by the quality ladder.
  - **What was left:** only the sphere tessellation trim, which is now applied.


---
## v28.2: efficiency pass from the reference studio, phone gimmick, fit fixes

### 3D intro (`public/intro3d.html`): adopted the reference's efficiency choices
- **No post-processing:** EffectComposer, UnrealBloom and OutputPass are removed. The scene renders straight to screen with native hardware MSAA (`antialias:true`) instead of a HalfFloat 4× MSAA render target plus bloom mip chain.
- **Materials:** MeshPhysicalMaterial (clearcoat, sheen, transmission) is replaced by MeshStandardMaterial, so there's no shader-compile stall at start.
- **Lighter render cost:**
  - Shared geometry tessellation trimmed (for example the helmet goes from 52×40 to 32×24).
  - Face textures drawn at 512×256 instead of 1024×512.
  - Shadow map 2048 instead of 4096, with a tighter shadow frustum.
  - The LED wall redraws at 15 fps.
  - Only 2 real party spotlights; the other beams are additive cones.
- **Pixel ratio:** capped at 1.75 and set once.
- **Look:** the saturated grade is kept (`#gl{filter:saturate(1.15) contrast(1.05)}`, compositor-only).
- **Not taken from the reference:**
  - The chapter jump bar (the clickable "01 CALL … 08 SPACE SNAP" tags).
  - The always-on FPS badge. FPS shows only when you press **F**.
  - The "START REFINED 3D INTRO" button.
  - The 0.65 s gate. Our UFO loader and the "start straight away if sound is already allowed" rule stay.
  - Real ringtone and logo file names are restored.
- **Ringtone:** the settings are at the top of `intro3d.html`: `CALL_URL`, `RING_SECONDS`, `RING_START_AT`, `RING_VOLUME`, plus `SPEED`.

### Trio (3D, laptops)
- **Secondary physics from the animation itself:** characters squash like jelly when they land after a fall and lean into fast moves. Hair sprigs and Boop's scarf tail trail behind. This works across all 42 scenes at no extra cost.
- **Color:** the saturation and contrast lift is done inside the Toy3D shader, so there's no extra pass.

### Phones (no 3D)
- **Tilt the phone:** the sticker crew leans and slides with the tilt, as if they have weight. A holographic glint sweeps across each sticker, masked to the sticker's own shape. This uses CSS only, driven by the gyroscope.

### Fixes
- **Reveal Now no longer drops answers still in flight.** The server locks, waits out the 1.2 s grace, then reveals. Answers sent with the local-first jitter are now always counted.
- **Laptop reveal:** the verdict and leaderboard now fit on screen. `fitQ` measures cards, verdict and board above the emoji dock, and the board shows 3 rows on short screens.
- **Phone results:** the ✓ / ✕ badge sits on the letter chip and no longer collides with the % column.
- **Toasts** sit above the emoji dock.
- **No sideways scroll** on any play screen.
- **Landing auto-fit:** the headline and crew shrink together so the Join button is always visible, from 1280×600 to 4K. The ▶ Play intro pill moved next to the mute button.

---
## v29.0: deploy build (reading-time fix, double-tap lock-in, full permutation test)

### Reading time Off + custom answer time stuck on 3 s / answers not selectable
- Root cause after deploy: pages still loaded game code as `?v=27` and the service worker served the cached copy first, so phones kept running the old clock-skew code.
- All assets now `?v=29`. The service worker is now network-first (cache only offline) and deletes older caches. HTML is always revalidated.
- Reading time left = the shorter of server-synced time and the phone's own monotonic clock. A bad clock can't keep "Reading time" on. Reading Off = answering from the first frame.
- `vote()` checks the live phase instead of a stored flag. Mid-join, reconnect and freeze/resume use the server's `remaining` / `readLeft`.

### Double tap to lock in
- In lock-in rooms, two taps on the same card within 400 ms pick and lock it. The Lock it in button still works.

### Tests
- `npm run permtest`: 1,720 combinations, 18,119 checks, 0 failed (5 modes × 7 reading × 6 answering × lock × scoring × create/reconfigure, plus auto-advance, mid-join, reconnect, freeze, restart, Reveal Now, time clamp).
- Real host console: Reading Off + Custom 12 s + Must lock in, with the phone clock 4 s wrong and an old stored offset. Cards were usable immediately, and a double tap locked the answer on the server.
- playtest 63/63, widthtest all pass.


---
## v29.0: deploy build (reading-time fix, double-tap lock-in, permutation test, full UI audit)

### "Reading time Off + custom answer time → stuck on 3 s, can't select an answer"
- **Root cause on deployed phones:** v28 changed `assets/arena.js` (clock sync), but pages still loaded it as `?v=27`, and the service worker served the cached copy first. Phones kept running old code with the ±3 s clock skew.
- **Asset versions:** every asset reference is now `?v=29`.
- **Service worker:** network-first. The cache is only an offline fallback, and old caches are deleted.
- **Server:** HTML is always revalidated (`no-cache`).
- **Phase logic:** reading time left is the shorter of the synced server clock and the phone's own monotonic clock since the question arrived. A bad clock can no longer keep the cards locked. Reading Off means answering opens on the first frame.
- **Votes:** `vote()` checks the live phase.
- **Server messages:** freeze/resume and mid-join use `readLeft` / `remaining` from the server.

### Double tap to lock in
In lock-in rooms, tapping the same card twice within 400 ms picks it and locks it. The Lock it in button still works.

### UI audit fixes (screenshots at 14 screen sizes, every page and game state)
- **Host console on phones:**
  - The layout was 545 px wide on a 390 px phone, so the page zoomed out and buttons were cut off. It now fits.
  - Header: icon-only Big Screen button and a compact brand.
  - Controls: 2-column grid.
- **Host "Close Voting" button:** the label was invisible because the global `.hot` gradient-text class made the text transparent. Fixed.
- **Host timer:** showed `00:107` for timers over 59 s. It now uses mm:ss (`01:47`).
- **Phone emoji dock:** no longer runs under the mute button. The footer credit hides while the dock is up.
- **LOCKED stamp:** the card makes room for it, so it doesn't cover the answer text. It fades out on results so the % column is never covered.
- **Lock-in hint:** centred under the button.
- **Report page on phones:** the Export / Print / Host buttons were cut off. They now wrap under the brand.
- **Join page:** the footer credit no longer runs under the mute button.
- **Landing "How it works":** the video tiles have a branded gradient behind them, so a slow or blocked video never shows a black box.
- **Landscape phones (844×390):**
  - The emoji dock moves to a slim column on the right edge.
  - The brand and crew band are compact.
  - The cards, the Lock it in button and the hint all fit on screen, with nothing under the dock.
  - If a very long question still doesn't fit, the page scrolls instead of hiding anything.
- **Landing on landscape phones:** the Join pill no longer runs under the mute button.
- **Big screen footer:** the credit no longer runs under the mute button.
- **Touch screens running the host console:** all setup and control buttons are at least 40–44 px tall.

### QA run for this build
- Static width checks: pass.
- Playtest: 63/63 pass.
- Permutation test: 18,119/18,119 pass (1,720 setting combinations).
- Screenshot audit: 19 page/game states captured at 14 viewports, from 360×640 up to 2560×1440. Results are in `qa/v29-audit/`.
- Audit findings that are intentional and left unchanged:
  - Game-mode cards in the landing carousel extend past the edge. That's the swipe affordance.
  - Player tiles on the big screen scroll the same way.
  - The Wrapped overlay covers the page on purpose.
