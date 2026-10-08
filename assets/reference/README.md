# Reference photos (optional)

In **Photos** mode, each P-position row shows a small reference image. By default it's a drawn golfer figure for the selected club and camera view.

To use your own reference photos instead, add them with these exact names (`P1` … `P10`):

```
assets/reference/driver/P1.jpg       face-on, shown when Driver is selected
assets/reference/driver/P1-dtl.jpg   down-the-line, shown when Driver is selected
assets/reference/7-iron/P1.jpg       face-on, shown when 7-Iron is selected
assets/reference/7-iron/P1-dtl.jpg   down-the-line, shown when 7-Iron is selected
assets/reference/P1.jpg              face-on fallback for either club
assets/reference/P1-dtl.jpg          down-the-line fallback for either club
```

The app looks in the club's folder first, then the shared folder. Any position without a matching file keeps the drawn figure. Portrait photos (about 5:6) fit best. Only use photos you have the rights to.
