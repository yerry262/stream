# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

`stream` is a static content-streaming web app: users browse a poster grid and click a title to play it in an overlay video player. Built with **Vite + React**, deployed as a static site to **GitHub Pages** via GitHub Actions. Live at https://yerry262.github.io/stream/.

## Commands

- `npm install` — install dependencies
- `npm run dev` — local dev server (Vite)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally

## Architecture

- `index.html` — Vite entry, mounts `#root`
- `src/main.jsx` — React root
- `src/App.jsx` — the whole UI: search box + type filter chips, a "Search on:" row of deep links to streaming services, catalog grid, click-to-play overlay. Search matches title/description/year/genres; filtering is pure client-side over the in-memory catalog.
  - **Service deep links** (`SERVICES`): Netflix/Prime/Hulu/YouTube/YouTube TV buttons that open each service's own search for the current query in a new tab. They link out — there is no legal way to authenticate and play a paid service's DRM'd catalog inside this app, so we hand off to the service's licensed player rather than embedding it. Each button shows an inline-SVG brand mark (`ICONS`) and has a **Connect** control: connecting opens the service's own sign-in page in a new tab and remembers the pairing in `localStorage` (`stream.connectedServices`) so the browser shows a "Connected ✓" badge. The pairing is a local convenience marker only — the app cannot verify a cross-origin session.
  - **Inline YouTube**: a catalog entry with a `youtubeId` plays inline via YouTube's embed (`youtube-nocookie.com/embed`) instead of the `<video>` element. YouTube is the only listed service that permits embedded playback.
  - **Play-a-URL bar** (`parseUrlInput`): paste a direct http(s) link to a media file (`.mp4/.webm/.m3u8/…`) and it plays in the overlay without a catalog edit. `magnet:` and `.torrent` links are rejected by design — streaming those needs a torrent client that fetches and reshares the swarm, which this app does not do.
  - **Universal search** (`searchEverywhere` in `src/universalSearch.js`): typing 2+ chars debounce-queries public keyless CORS APIs — iTunes Search (movies, with playable `previewUrl` trailer clips) and TVMaze (TV shows) — and renders a "Found everywhere" grid below the library. Clicking a result opens a where-to-watch panel: poster/preview, overview, and per-service "Watch on" deep links for that exact title. External hits honor the type chips and are deduped against local catalog titles. iTunes gotcha: the request deliberately omits `media=movie` (some iTunes edge nodes return zero results with it) and filters `kind === 'feature-movie'` client-side. Either source failing just drops its results (`Promise.allSettled`).
- `src/catalog.js` — the content list (single source of truth for titles/videos)
- `src/index.css` — all styling (dark theme, no CSS framework)
- `.github/workflows/deploy.yml` — build + deploy to Pages on push to `main`

## Conventions & gotchas

- **Base path**: `vite.config.js` sets `base: '/stream/'` so assets resolve under `yerry262.github.io/stream/`. If the repo is renamed or moved to a custom domain, update this.
- **Adding content**: edit `src/catalog.js` only — the UI renders whatever is in that array. No backend. Each entry is `{ id, title, description, poster, src, year, type, genres }`, plus an optional `youtubeId` (when set, the title plays inline via YouTube embed instead of `src`). `poster` is an image URL, `src` is any browser-playable video URL (mp4/HLS), `type` is `'movie' | 'series' | 'home'` (drives the filter chips), and `genres` is a string array (also searchable).
- **Licensing**: only add content you have the right to distribute — your own home videos, or public-domain / Creative Commons work. Do not point `src` at copyrighted films/TV you aren't licensed for.
- **Range-request streaming**: to load only the part being watched (seek without full download), host `src` files somewhere that honors HTTP range requests — S3/R2/Backblaze/nginx do; **GitHub Pages does not**. The `<video>` element (with `preload="metadata"`) handles byte-range seeking automatically once the host cooperates.
- **Deploy source**: GitHub Pages must be set to "GitHub Actions" (Settings → Pages), not a branch.
- Purely client-side; there is no server, database, or auth.
