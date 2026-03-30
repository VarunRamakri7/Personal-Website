# Personal Website

My portfolio website: full-page sections, light/dark theme, and a separate resume page.

## What’s on the site

- **Home (`index.html`)** — Intro, works carousel, and contact in a single-page layout. Navigation is vertical: side dots, hamburger overlay, wheel/trackpad, keyboard (↑/↓), and touch swipe.
- **Resume (`inner/Resume.html`)** — Standalone resume; shares `assets/css/main.css` and theme behavior.

There is no app server or build step required to view the site; open the HTML files or serve the folder locally.

## Tech stack

| Layer | Choice |
|--------|--------|
| **Markup** | Semantic HTML5 |
| **Styling** | Plain CSS (`assets/css/main.css`; optional `main.sass` if you compile Sass) |
| **Scripts** | **Vanilla JavaScript** only — no React, Vue, or jQuery in the loaded bundle |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |

Legacy jQuery/Hammer files remain in the repo for reference but are **not** loaded by `index.html`.

## Scripts (loaded)

| File | Role |
|------|------|
| `assets/js/site.js` | Full-page section changes, wheel/touch/keyboard, hamburger “perspective” menu, portfolio/work slider, contact field labels |
| `assets/js/theme.js` | `data-theme` (`light` / `dark`) + `localStorage` persistence; runs with `defer` after parse |

Both scripts use an IIFE and `DOMContentLoaded` (or immediate run if DOM is ready) so they do not pollute the global scope.

## Methodologies and design choices

- **Static-first** — Files ship as-is; suitable for GitHub Pages any static host.
- **Progressive enhancement** — Core content is HTML; JS adds section switching and carousel; theme uses a small inline head script to avoid flash of wrong theme.
- **No framework runtime** — Keeps payload small and avoids framework churn; behavior is explicit in `site.js`.
- **Full-page sections** — One “active” `<li>` under `.main-content`; CSS transitions (`section--next` / `section--prev`) give direction hints for animations.
- **Wheel / trackpad** — Scroll events are intercepted (`passive: false`) so the page does not scroll like a long document; small deltas are **accumulated** until a threshold, then one section step fires (see comments in `site.js`). A short lock prevents double-advances; opening/closing the nav resets state via custom events.
- **Modal state** — The hamburger menu is considered open when `.perspective` has `perspective--modalview` (not only `outer-nav.is-vis`), so wheel/keyboard logic stays in sync with the real UI.
- **Theming** — `html[data-theme="light"|"dark"]` drives tokens; `theme.js` persists the choice in `localStorage` and updates `theme-color`.

## Project layout (high level)

```
index.html
inner/Resume.html
assets/
  css/main.css      # main stylesheet (legacy minified block + custom tokens/components)
  js/site.js        # portfolio UI
  js/theme.js       # theme toggle + persistence
  img/              # images and assets
```

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
