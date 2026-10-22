# Fun Friday Arena v27 — Run & Host Guide (one page)

Accenture × Currys · Made by PPA Warriors

## Run it
- Needs **Node 16+** and has zero dependencies. Start it with `npm start` and open `http://localhost:3000`.
- **Render (free tier):** `render.yaml` is already included. Push to a repo, create a Render Blueprint and you're done. Join links and QR codes use `RENDER_EXTERNAL_URL` automatically. Set `PUBLIC_URL` only if you use a custom domain.
- **Settings:** `MAX_PLAYERS` (default 700), `DEFAULT_TIMER_MS`, `DEFAULT_READ_MS` and `PROGRESS_HZ` (default 4).

## Before the session (10 min)
1. Open **/host**, pick a **Mode** (Would You Rather, Quiz, Hot Takes, Emoji Decode or Speed Round), then the timers, auto-advance, team mode, seasonal skin, crew and reactions. Select your questions and press **Create room**.
2. Put **/screen?room=CODE** on the projector (use the *Big screen* button in the host console). It's built for 1920×1080.
3. Ask the room to scan the QR code. Each player picks a sidekick on the boarding pass and lands in the lobby, where their name drops onto the big screen.

## During the game
| Key | Action |
|---|---|
| Space | Start / next |
| R | Reveal now |
| N | Next question |
| C | 🎭 Chaos: a crew slapstick scene plays on every screen |
| D | 🥁 Drumroll: 2 s drumroll and dim before the reveal |

- **Host power buttons.** 🔦 **Spotlight** sweeps a random player's name across the big screen. ⏸ **Freeze** pauses the clock; press it again to resume.
- **Would You Rather.** Points go to the majority side, and the fastest finger scores most. There are **no wrong answers**: picking the minority is "Rebel energy".
- **Quiz and Emoji Decode.** There's one correct answer. **Speed Round** gives 5-second questions with a doubled speed bonus.
- **Between questions.** The big screen plays a 4 s Crew Comedy interlude, then the leaderboard. Pressing **Next** cuts the interlude short.

## After the game
- **Players.** Each phone opens **Your Fun Friday, Wrapped**, six story cards built on the phone itself, with Save and Share buttons.
- **Host.** Open **/report?room=CODE** to print it, save it as PDF or export a CSV.

## If something goes wrong
- **A player's phone drops off.** The crew shows "Reconnecting…" with the satellite dish, and the phone rejoins on its own. Their answers are timed on the device and sent again automatically.
- **The server restarted.** The host console creates a fresh room and shows the new code.
- **A slow laptop or old phone.** Graphics adapt automatically by drawing *less*, never by blurring. Press **F** on any page to see the FPS, tier and the fixed DPR.
- **No sound.** Sound is optional; the 🔊 button bottom-right toggles it. The game is fully playable muted.

## Hidden details (for the "who made this?" moment)
- Tap **Made by PPA Warriors** three times for the credits.
- Click a crew member 5× and they'll chase your cursor.
- Leave the page idle for 60 s and the crew starts a campfire.
- The Konami code (↑↑↓↓←→←→BA) starts a disco.
- Shake your phone and the crew falls over.


## Intro ringtone and timing (`public/intro3d.html`, top of the file)
1. Put your ringtone in the **public/** folder as **call-ringtone.mp3**. To use another name or format (.m4a, .ogg or .wav), change `CALL_URL`.
2. Adjust the settings next to it if you need to:

| Setting | What it does | Default |
|---|---|---|
| `RING_SECONDS` | How long the phone rings, in story seconds (real time is this ÷ `SPEED`). Keep it below 7. | 3.0 |
| `RING_START_AT` | Skips silence at the start of your file (seconds). | 0 |
| `RING_VOLUME` | Volume from 0 to 1. | 1 |
| `SPEED` | Speed of the whole intro (1 is fast, 0.8 comfortable). | 0.8 |
| `QUIZ_WAIT` | Seconds the intro quiz waits for a tap. | 5 |

If the file is missing, a built-in marimba ring plays.

## QA you can rerun
`npm start`, then in another terminal:
- `npm run test:matrix`: every game-logic combination plus the edge cases.
- `npm run test:layout`: every page at 8 screen sizes.

## After deploying a new version
Nothing to do. Pages and game code are network-first, so every phone gets the new build on its next load. If someone kept an old tab open all day, one refresh is enough.
