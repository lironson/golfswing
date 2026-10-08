# ⛳ Golf Swing P-Positions

A browser-only golf swing analyzer. Add photos of whichever P-positions you have (say P1, P4 and P8). All 10 positions are listed on one page, each with a reference figure and its checkpoints, and the rest can stay blank. Every photo gets guide lines and coaching tips.

> **Video mode is turned off for now.** The code is still here. To bring back the 🎥 Video | 🖼 Photos toggle, set `VIDEO_ENABLED = true` at the top of the mode section in [`js/app.js`](js/app.js). The sections below on video describe how it works when it's on.

In video mode the app:In video mode the app:

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
| P4 | Top | Highest hand position before the downswing |
| P5 | Lead arm parallel (downswing) | Hands drop back to lead-shoulder height |
| P6 | Shaft parallel (downswing) | Hands back at about hip height |
| P7 | Impact | Lowest hand position in the downswing |
| P8 | Shaft parallel (follow-through) | Hands back up to about hip height |
| P9 | Trail arm parallel (follow-through) | Hands reach trail-shoulder height |
| P10 | Finish | Hands settle after the swing |

The positions are worked out from body pose only, because the club isn't tracked. If a frame is a little off, use the **◀ ▶ buttons or the slider** on each card to fine-tune it. The feedback updates instantly.

## Photos mode

The page lists all 10 positions. Each row shows:

- **Reference:** a drawn golfer figure (or your own photo, see [`assets/reference/`](assets/reference/README.md)), the ideal position, and its checkpoints.
- **Your photo:** tap to add one. It gets the same guide lines and feedback as a video frame. Use *Replace* or *Remove* to change it.

Every photo is checked on its own (posture, arm extension, spine tilt, weight at the finish, and so on). **If you add a P1 (address) photo**, the other photos are also compared against it for head movement, spine-angle loss, hip sway and shift, and hands at impact. Photos are lined up by the lead foot and body size, so small framing differences are fine, but take them from the same camera spot. Photos are kept only for the current tab and are cleared when you refresh.

## Feedback checks

**Down-the-line:** spine tilt and knee flex at address, arm hang, takeaway path, spine angle kept through impact (early extension), hips moving off the butt line, a possible over-the-top move, head dipping or lifting, trail-knee straightening, and a tall finish.

**Face-on:** shoulder tilt at address, lead-arm extension, head sway, hip sway, shoulder turn, lower body leading the downswing, hands ahead at impact (flip), spine tilt at impact, hip slide, extension after impact (chicken wing), and weight on the lead foot at the finish.

All thresholds live in `CONFIG` in [`js/positions.js`](js/positions.js) if you want to tune them.

## Filming tips

- Use a tripod at about hand height. Keep the **whole body (and club) in frame** for the entire swing.
- **Face-on:** camera square to your chest. **Down-the-line:** camera behind your hands, pointing at the target.
- Good light, a plain background and fitted clothes all help.
- Slow-motion (120/240 fps) clips give the most precise positions. Trim the clip to one swing if you can. Long clips are scanned quickly first to find the swing.
- iPhone: if a `.mov` won't play in Chrome, open the app in Safari, or set Camera → Formats → *Most Compatible*.

## Running locally

ES modules need a web server (opening `index.html` directly from disk won't work):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Unit tests (Node 18+) run the detection and feedback logic on synthetic swings:

```bash
npm test
```

## Releasing changes

`index.html` loads the stylesheet and every script with a version tag (`?v=2026.10.08-1`), so browsers fetch fresh copies after a release instead of mixing cached old files with the new page. When you change anything in `css/` or `js/`, change that version string everywhere in `index.html` (find and replace). If you add a new file to `js/`, also add it to the import map there. `npm test` checks that every script is listed and all the versions match.

## Project layout

```
index.html          UI
css/styles.css      Styles (light/dark mode, mobile friendly)
js/app.js           UI wiring and state
js/pose.js          MediaPipe loading and frame-by-frame video sampling
js/detect.js        Signal smoothing, P1–P10 detection, camera-view guess
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
```

## Limitations

- Pose-only detection: the shaft-parallel positions (P2, P6, P8) are estimated from hand height, so they can be off by a few frames.
- 2D measurements depend on the camera angle. A camera that isn't square to the golfer will skew angles.
- For practice and fun. It isn't a substitute for a qualified coach.

P-position references: [HackMotion: 10 golf swing positions](https://hackmotion.com/golf-swing-positions/).
