# Personal Website

Static personal site: minimal typography-led home, slide-out **Projects** and **Information** panels, light/dark theme, optional cursor effects, and a separate resume page.

## What’s on the site

- **Home (`index.html`)** — Centered hero (blackletter name + sans-serif lines). Background: animated wireframe icosahedra on canvas. Top row: **Projects** / **Information** open left and right drawers; **Email** / **Instagram** / **LinkedIn** are links. Former portfolio items live in the Projects drawer. Floating controls: **theme** (bottom-right) and **effect toggles** (appear on hover) for cursor inversion and hero magnifier.
- **Resume (`inner/Resume.html`)** — Standalone résumé; shares `assets/css/main.css` and `theme.js` (no cursor-effect toggles; those are home-only).

## Tech stack

| Layer | Choice |
|--------|--------|
| **Markup** | Semantic HTML5 |
| **Styling** | Single file: `assets/css/main.css` |
| **Scripts** | Vanilla JS (see table below) |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) + [UnifrakturMaguntia](https://fonts.google.com/specimen/UnifrakturMaguntia) (blackletter) via Google Fonts |

## JavaScript modules

Scripts are plain IIFEs; each file has a top comment describing behavior and **tunable variables**. Below is a quick map; open the file for exact names and line notes.

| File | Role |
|------|------|
| **`site.js`** | Drawer open/close: Projects vs Information, backdrop, `Escape`, focus return to the control that opened the panel. |
| **`theme.js`** | `data-theme` on `<html>`, `theme-color` meta, `localStorage` key `theme`, and—if the user has never saved a theme—follows **`prefers-color-scheme`** (updates when OS scheme changes until the user clicks the theme button once). |
| **`effects-ui.js`** | Effect toggle buttons next to the theme control (only when **`(hover: hover) and (pointer: fine)`** — hidden on touch/tablet/coarse pointer); persists **`site-effect-cursor-invert`** and **`site-effect-hero-magnifier`**; dispatches **`site-effects-changed`**. |
| **`cursor-invert.js`** | Fine-pointer only: circular `mix-blend-mode: difference` lens following the mouse; respects **`site-effect-cursor-invert`** and `site-effects-changed`. Visual size is mostly CSS: **`--cursor-invert-radius`** on `html.has-cursor-invert` in `main.css`. |
| **`hero-magnifier.js`** | Fine-pointer + no reduced motion: magnified clone of `#hero-magnifier-source` under the cursor; masks the source so text isn’t doubled. Tunables: lens radius **`R`**, zoom **`scale`**, barrel/rim in **`buildLensDisplacementMapDataUrl`**; SVG **`feDisplacementMap`** `scale` in `index.html`. |
| **`hero-spheres.js`** | Hero background: several rotating **icosahedron** wireframes on **`.hero__spheres-canvas`**. Tunables: **`TARGET_COUNT`**, **`EDGE_MARGIN`**, line color in **`lineColor()`**, stroke width / projection in **`draw()`**. |
| **`project-thumb-wireframe.js`** | If the DOM contains **`.project-card__canvas`** elements (one per card), draws the same icosahedron wireframe in each thumbnail with per-card **`presets`** rotation speeds. Currently the home Projects list uses static images; this script is ready when canvases are added. |
| **`resume-date.js`** | Resume page only: sets **`.resume-masthead__date`** text and **`datetime`** from the current date (locale-formatted). |

### Local storage keys (effects + theme)

| Key | Meaning |
|-----|---------|
| `theme` | `"light"` or `"dark"` once the user has chosen; if unset, theme follows system until first click. |
| `site-effect-cursor-invert` | `"1"` = inversion on; missing or other = off (opt-in). |
| `site-effect-hero-magnifier` | `"0"` = magnifier off; missing or `"1"` = on (opt-out). |

## Project layout

```
index.html
inner/Resume.html
assets/
  css/main.css
  js/site.js
  js/theme.js
  js/effects-ui.js
  js/cursor-invert.js
  js/hero-magnifier.js
  js/hero-spheres.js
  js/project-thumb-wireframe.js
  js/resume-date.js
  img/
```

## Load order (home)

`site.js` → `theme.js` → `effects-ui.js` → `hero-spheres.js` → `hero-magnifier.js` → `cursor-invert.js` (all `defer` on `index.html`).
