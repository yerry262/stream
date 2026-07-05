# Stream

A static content-streaming web app (browse a catalog, click to watch) built with Vite + React and deployed to GitHub Pages via GitHub Actions.

**Live:** https://yerry262.github.io/stream/

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Add content

Edit `src/catalog.js` — each entry needs an `id`, `title`, `description`, `poster` image URL, and a browser-playable `src` video URL.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to GitHub Pages.

**One-time setup:** in the repo on GitHub, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

The Vite `base` in `vite.config.js` is set to `/stream/` to match the repo name; change it if you rename the repo or use a custom domain.
