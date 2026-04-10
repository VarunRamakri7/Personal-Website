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
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) + [Major Mono Display](https://fonts.google.com/specimen/Major+Mono+Display) (hero name) via Google Fonts (`display=swap`) |

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

## Responsive behavior (what was added)

- **Viewport** — `viewport-fit=cover` on `index.html` and `inner/Resume.html` so `env(safe-area-inset-*)` works on notched phones.
- **Hero** — `min-height: 100dvh` (with `100vh` fallback) for stable height when mobile browser chrome shows/hides; **container queries** on `.hero` control when the name stays on one line (with a **fallback** `@media` if container queries are unsupported).
- **Top nav** — Padding respects **safe areas**; below **560px** width the two nav rows **stack**; **`(pointer: coarse)`** increases tap targets (~44px) for Portfolio / Information / links.
- **Drawers** — Width uses **`100svw`** where supported to avoid **`100vw` + scrollbar** overflow; **coarse pointer** users get larger **Back / Close** controls.
- **Theme toggle** — Position uses **`max(..., env(safe-area-inset-*))`** so it clears the iPhone home indicator and side safe areas.
- **Project images** — **`loading="lazy"`**, **`decoding="async"`**, and **`sizes`** for layout hints (single asset URLs unchanged until you add `srcset`).
- **Hero canvas** — **`prefers-reduced-data: reduce`** matches **`prefers-reduced-motion`**: one static draw, no animation loop; also forces **budget** graphics path.

Fonts already use Google Fonts with **`display=swap`**.
