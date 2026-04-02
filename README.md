# Personal Website

Static personal site: minimal typography-led home, slide-out **Projects** and **Information** panels, light/dark theme, and a separate resume page.

## What’s on the site

- **Home (`index.html`)** — Centered hero (blackletter name + sans-serif lines). Top row: **Projects** / **Information** open left and right drawers; **Email** / **Instagram** / **LinkedIn** are links. Former portfolio items live in the Projects drawer.
- **Resume (`inner/Resume.html`)** — Standalone résumé; shares `assets/css/main.css` and `theme.js`.

## Tech stack

| Layer | Choice |
|--------|--------|
| **Markup** | Semantic HTML5 |
| **Styling** | Single file: `assets/css/main.css` |
| **Scripts** | Vanilla JS: `site.js` (drawers), `theme.js` (theme + `localStorage`) |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) + [UnifrakturMaguntia](https://fonts.google.com/specimen/UnifrakturMaguntia) (blackletter) via Google Fonts |

## Project layout

```
index.html
inner/Resume.html
assets/
  css/main.css
  js/site.js
  js/theme.js
  img/
```
