# ⛳ Golf Swing P-Positions

A browser-only golf swing analyzer. Upload a video of your swing (face-on or down-the-line). The app:

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

## Hosting on GitHub Pages

It's a static site with no build step:

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, and select `main` / `(root)`.
3. After a minute the app is live at `https://lironson.github.io/golfswing/`.

## Running locally

ES modules need a web server (opening `index.html` directly from disk won't work):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Unit tests (Node 18+) run the detection and feedback logic on synthetic swings:

```bash
npm test
```

## Project layout

```
index.html          UI
css/styles.css      Styles (light/dark mode, mobile friendly)
js/app.js           UI wiring and state
js/pose.js          MediaPipe loading and frame-by-frame video sampling
js/detect.js        Signal smoothing, P1–P10 detection, camera-view guess
js/analyze.js       Rule-based feedback per position
js/overlay.js       Skeleton and guide-line drawing
js/positions.js     P-position descriptions and tunable thresholds
js/geometry.js      Maths helpers
tests/              Node unit tests with a synthetic swing generator
```

## Limitations

- Pose-only detection: the shaft-parallel positions (P2, P6, P8) are estimated from hand height, so they can be off by a few frames.
- 2D measurements depend on the camera angle. A camera that isn't square to the golfer will skew angles.
- For practice and fun. It isn't a substitute for a qualified coach.

P-position references: [HackMotion: 10 golf swing positions](https://hackmotion.com/golf-swing-positions/).
