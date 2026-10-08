# Reference photos (optional)

In **Photos** mode, each P-position row shows a small reference image. By default it's a drawn golfer figure for the selected club.

To use your own reference photos instead, add them named exactly `P1.jpg … P10.jpg`:

```
assets/reference/driver/P1.jpg … P10.jpg    shown when Driver is selected
assets/reference/7-iron/P1.jpg … P10.jpg    shown when 7-Iron is selected
assets/reference/P1.jpg … P10.jpg           fallback for either club
```

The app looks in the club's folder first, then the shared folder. Any position without a matching file keeps the drawn figure. Portrait photos (about 5:6) fit best. Only use photos you have the rights to.
