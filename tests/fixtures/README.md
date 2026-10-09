# Real swing clips for testing

Put real swing videos here (5 seconds or less, one swing each), for example
`dtl-iron7.mp4` and `face-driver.mp4`. Then:

1. Run `npm start` in one terminal.
2. Run `node tests/fixtures/extract.mjs` (needs Playwright: `npm i -D playwright`).
   This runs the app's real pose pipeline on every frame and writes `<clip>.landmarks.json`.
3. Write `<clip>.expected.json` with the true P1–P10 times, read off the video by hand:

   ```json
   { "handedness": "right", "times": [0.82, 1.10, 1.31, 1.62, 1.75, 1.80, 1.86, 1.92, 2.01, 2.60] }
   ```

   `"tolerance"` (seconds, default 0.1) is optional.

`npm test` then checks that detection finds P2–P9 within the tolerance on each clip.
