---
name: verify
description: Build, run, and drive the stream app to verify changes end-to-end
---

# Verifying stream

Production-like verification (what CI + Pages actually serve):

```bash
npm ci            # or npm install
npm run lint      # eslint flat config, zero-warning bar
npm run build     # vite build → dist/
npm run preview   # serves dist at http://localhost:4173/stream/ (port may bump to 4174+)
```

Drive it in Chrome (DevTools MCP works on this machine):

1. **Grid**: 4 catalog cards render (Big Buck Bunny, Sintel, Tears of Steel, BBB YouTube).
2. **Universal search**: type 2+ chars (e.g. "severance") → "FOUND EVERYWHERE" grid appears
   (iTunes + TVMaze, needs network); clicking a result opens the where-to-watch panel with
   per-service deep links. Service links in the header rewrite to the query.
3. **Play overlay**: click a catalog card → `<video>` mounts and renders frames (BBB src is a
   remote mp4; 206 responses mean range requests work).
4. **Play bar probes**: garbage input → accessible alert "That does not look like a valid URL.";
   nonsense search query → "No titles match …" with no stuck spinner.

Gotchas:
- CDP `fill` with an empty string does NOT fire React's onChange — the query state keeps its
  old value. Reload the page to reset search state instead of clearing the box.
- A lone `/favicon.ico` 404 in the console is the browser's automatic probe (repo ships no
  favicon), not an app error.
- Torrent flows (magnet/.torrent/seed) need a second peer; a real check is a 2-tab swarm on
  the live domain — see project memory. Don't block a PASS on them for unrelated changes.
