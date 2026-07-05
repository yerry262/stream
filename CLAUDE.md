# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

`stream` is a static content-streaming web app: users browse a poster grid and click a title to play it in an overlay video player. Built with **Vite + React**, deployed as a static site to **GitHub Pages** via GitHub Actions.

## Commands

- `npm install` — install dependencies
- `npm run dev` — local dev server (Vite)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally

## Architecture

- `index.html` — Vite entry, mounts `#root`
- `src/main.jsx` — React root
- `src/App.jsx` — the whole UI: catalog grid + click-to-play overlay `<video>`
- `src/catalog.js` — the content list (single source of truth for titles/videos)
- `src/index.css` — all styling (dark theme, no CSS framework)
- `.github/workflows/deploy.yml` — build + deploy to Pages on push to `main`

## Conventions & gotchas

- **Base path**: `vite.config.js` sets `base: '/stream/'` so assets resolve under `yerry262.github.io/stream/`. If the repo is renamed or moved to a custom domain, update this.
- **Adding content**: edit `src/catalog.js` only — the UI renders whatever is in that array. No backend.
- **Deploy source**: GitHub Pages must be set to "GitHub Actions" (Settings → Pages), not a branch.
- Purely client-side; there is no server, database, or auth.
