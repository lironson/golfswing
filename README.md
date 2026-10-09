# ⛳ Golf Swing P-Positions

A browser-only golf swing analyzer with two modes, switched with the Video | Photos toggle (set `VIDEO_ENABLED = false` in [`js/app.js`](js/app.js) to offer photos only).

**Photos:** add photos of whichever P-positions you have (say P1, P4 and P8). All 10 positions are listed on one page, each with a reference figure and its checkpoints, and the rest can stay blank. Every photo gets guide lines and coaching tips.

**Video:** add a clip of one swing. Up to 5 seconds is analysed; for a longer clip you slide a 5-second window over the swing. The app:

1. **Finds the 10 P-positions** (Address → Finish) and pulls each one out as a still image.
2. **Draws guide lines** over each still: spine angle, butt line, shoulder plane, head box, sway lines, and more.
3. **Gives coaching comments** for each position, with your top 3 priorities summarised at the top.

Everything runs locally in your browser with [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). **Your video is never uploaded anywhere.**

## The 10 P-positions

| P | Position | What the app looks for |
|---|----------|------------------------|
| P1 | Address | Still hands before the takeaway starts |
| P2 | Takeaway, shaft parallel | Hands reach about hip height on the way back |
| P3 | Lead arm parallel (backswing) | Hands reach lead-shoulder height |
| P4 | Top | Highest hand position before impact |
| P5 | Lead arm parallel (downswing) | Hands drop back to lead-shoulder height |
| P6 | Shaft parallel (downswing) | Hands back at about hip height |
| P7 | Impact | Lowest point of the fast-moving hands after the backswing |
| P8 | Shaft parallel (follow-through) | Hands back up to about hip height |
| P9 | Trail arm parallel (follow-through) | Hands reach trail-shoulder height |
| P10 | Finish | Hands settle after the swing |

The positions are worked out from body pose only, because the club isn't tracked. If a frame is a little off, use the **◀ ▶ buttons or the slider** on each card to fine-tune it. The feedback updates instantly.

### How video detection works

1. **Every frame is read in one pass.** The video plays muted and pauses on each new frame while MediaPipe finds the body, so no frame is skipped and nothing has to seek (seeking re-decodes from the last keyframe and was the slow part before).
2. **The hand track is cleaned.** Wrist and elbow points with low visibility, and one- or two-frame jumps (motion blur, wrists mixed up), are dropped and filled in from the frames either side. Repeated frames are ignored.
3. **The swing is found** as the longest burst of hand movement, so a waggle before or walking off after doesn't confuse it.
4. **Anchors first:** impact (P7) is the lowest point of the fast-moving hands after the backswing, the top (P4) is the highest hand position before that, and address (P1) is where the hands were last still before the takeaway. The other positions are found from hand height between the anchors.
5. **Sanity check:** if the downswing or the backswing:downswing tempo looks implausible, or a position had to be estimated, its card says *best guess, check this frame*.

## Photos mode

The page lists all 10 positions. Each row shows:

- **Reference:** a drawn golfer figure (or your own photo, see [`assets/reference/`](assets/reference/README.md)), the ideal position, and its checkpoints.
- **Your photo:** tap to add one. It gets the same guide lines and feedback as a video frame. Use *Replace* or *Remove* to change it.

Every photo is checked on its own (posture, arm extension, spine tilt, weight at the finish, and so on). **If you add a P1 (address) photo**, the other photos are also compared against it for head movement, spine-angle loss, hip sway and shift, and hands at impact. Photos are lined up by the lead foot and body size, so small framing differences are fine, but take them from the same camera spot. Photos are kept only for the current tab and are cleared when you refresh.

## Driver and 7-iron

The app opens on **7-Iron** and **Down-the-line** the first time, then remembers your last Club, Golfer and Camera view choices in that browser.

Use the **Club** toggle (Driver | 7-Iron) at the top of the page. It changes three things:

- **Notes:** each position's summary and checkpoints are written separately for each club. The driver is swept up off a tee from a wide, tilted setup with the ball just inside the lead heel. The 7-iron is struck down (ball, then turf) from a centred setup with a near-neutral spine and the hands ahead.
- **Reference figures:** the driver figure has a wider stance, the ball forward on a tee and more spine tilt. The 7-iron figure has the ball centred, a near-neutral spine and forward shaft lean at impact.
- **Camera view:** the reference figures also follow the Face-on / Down-the-line toggle. The down-the-line figures show spine bend (driver about 32°, 7-iron about 40°), the ball farther from the feet with the driver, the shaft on the ball-to-hands plane at P3, P5 and P9, and a dashed butt line the hips should stay on through impact.
- **Feedback:** some rules use club-specific ranges. For example, shoulder tilt at address (more for driver, nearly level for the 7-iron), hands at impact (the 7-iron must lead with the hands; the driver shaft can be near vertical) and spine tilt at impact.

## Feedback checks

**Down-the-line:** spine tilt and knee flex at address, arm hang, takeaway path, spine angle kept through impact (early extension), hips moving off the butt line, a possible over-the-top move, head dipping or lifting, trail-knee straightening, and a tall finish.

**Face-on:** shoulder tilt at address, lead-arm extension, head sway, hip sway, shoulder turn, lower body leading the downswing, hands ahead at impact (flip), spine tilt at impact, hip slide, extension after impact (chicken wing), and weight on the lead foot at the finish.

All thresholds live in `CONFIG` in [`js/positions.js`](js/positions.js) if you want to tune them; `CONFIG.clubs` holds the driver and 7-iron overrides.

## Filming tips

- Use a tripod at about hand height. Keep the **whole body (and club) in frame** for the entire swing.
- **Face-on:** camera square to your chest. **Down-the-line:** camera behind your hands, pointing at the target.
- Good light, a plain background and fitted clothes all help.
- One swing per clip, starting a moment before address and ending after the finish. Only 5 seconds is analysed.
- Film at 60 fps if you can: the downswing lasts about a quarter of a second, so more frames means more precise positions. Slow-motion clips are stretched in time, so 5 seconds of one may not cover the whole swing.
- iPhone: if a `.mov` won't play in Chrome, open the app in Safari, or set Camera → Formats → *Most Compatible*.

## Running locally

ES modules need a web server (opening `index.html` directly from disk won't work):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Unit tests (Node 18+) run the detection and feedback logic on synthetic swings, including noisy ones (jitter, lost and glitching wrists, repeated frames), and on any real clips in [`tests/fixtures/`](tests/fixtures/README.md):

```bash
npm test
```

## Releasing changes

`index.html` loads the stylesheet and every script with a version tag (`?v=2026.10.09-1`), so browsers fetch fresh copies after a release instead of mixing cached old files with the new page. When you change anything in `css/` or `js/`, change that version string everywhere in `index.html` (find and replace). If you add a new file to `js/`, also add it to the import map there. `npm test` checks that every script is listed and all the versions match.

## Project layout

```
index.html          UI
css/styles.css      Styles (light/dark mode, mobile friendly)
js/app.js           UI wiring and state
js/pose.js          MediaPipe loading and frame-by-frame video capture
js/detect.js        Hand-track cleaning, P1–P10 detection, camera-view guess
js/analyze.js       Rule-based feedback per position
js/overlay.js       Skeleton and guide-line drawing
js/photos.js        Photos mode (fill-in-the-blanks P1–P10 page)
js/reference.js     Drawn reference figures (overridable via assets/reference/)
js/export.js        PNG export helpers
js/ui.js            Shared renderers for coaching notes and readouts
assets/fonts/       Self-hosted Barlow, Barlow Condensed and IBM Plex Mono (SIL Open Font License)
js/positions.js     P-position descriptions and tunable thresholds
js/geometry.js      Maths helpers
tests/              Node unit tests with a synthetic swing generator
tests/fixtures/     Real swing clips, their landmarks and true P-times (see its README)
```

## Limitations

- Pose-only detection: the shaft-parallel positions (P2, P6, P8) are estimated from hand height, so they can be off by a few frames.
- 2D measurements depend on the camera angle. A camera that isn't square to the golfer will skew angles.
- For practice and fun. It isn't a substitute for a qualified coach.

P-position references: [HackMotion: 10 golf swing positions](https://hackmotion.com/golf-swing-positions/).
