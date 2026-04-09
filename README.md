# Personal Website

Static personal site: minimal typography-led home, slide-out **Projects** and **Information** panels, light/dark theme, and a separate resume page.

## What’s on the site

- **Home (`index.html`)** — Centered hero (blackletter name + sans-serif lines). Background: animated wireframe icosahedra on canvas. Top row: **Projects** / **Information** open left and right drawers; **Email** / **Instagram** / **LinkedIn** are links. Former portfolio items live in the Projects drawer. Floating control: **theme** (bottom-right).
- **Resume (`inner/Resume.html`)** — Standalone résumé; shares `assets/css/main.css` and `theme.js`.

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
| **`hero-spheres.js`** | Hero background: several rotating **icosahedron** wireframes on **`.hero__spheres-canvas`**. Tunables: **`TARGET_COUNT`**, **`EDGE_MARGIN`**, line color in **`lineColor()`**, stroke width / projection in **`draw()`**. |
| **`project-thumb-wireframe.js`** | If the DOM contains **`.project-card__canvas`** elements (one per card), draws the same icosahedron wireframe in each thumbnail with per-card **`presets`** rotation speeds. Currently the home Projects list uses static images; this script is ready when canvases are added. |
| **`resume-date.js`** | Resume page only: sets **`.resume-masthead__date`** text and **`datetime`** from the current date (locale-formatted). |

### Local storage (theme)

| Key | Meaning |
|-----|---------|
| `theme` | `"light"` or `"dark"` once the user has chosen; if unset, theme follows system until first click. |

## Project layout

```
index.html
inner/Resume.html
assets/
  css/main.css
  js/site.js
  js/theme.js
  js/hero-spheres.js
  js/project-thumb-wireframe.js
  js/resume-date.js
  img/
```

## Load order (home)

`site.js` → `theme.js` → `hero-spheres.js` (all `defer` on `index.html`).
