# hieuisme12.github.io

Personal portfolio of **Lâm Trung Hiếu**, live at **https://hieuisme12.github.io**.

The hero is a small 3D city built with [Three.js](https://threejs.org). A river crosses the district and every street crosses it on a bridge of a different height. Drag the slider to raise the water: flooded bridges and sensors turn red, and an A* search recalculates the safe route around them. It's a tiny version of the flood-aware routing from my thesis, [FloodSight](https://github.com/hieuisme12/KLTN-007-FloodWatch-FE).

- Plain HTML, CSS and JavaScript. No build step.
- Three.js r170 loads from jsDelivr, pinned to an exact version.
- English and Vietnamese, switchable in the header.
- Respects `prefers-reduced-motion`, and pauses rendering when the hero is off-screen.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Push to the `main` branch of a repo named `hieuisme12.github.io`. GitHub Pages serves it automatically (Settings → Pages → Deploy from branch → `main` / root).
