// Universal search: look a query up in public, keyless, CORS-enabled catalogs
// so the static site can find "anything" — not just the local catalog — and
// hand playback off to whichever streaming service carries it.
//
// Sources (both free, no API key, CORS open — required for GitHub Pages):
// - iTunes Search API — movies. Bonus: `previewUrl` is a directly playable
//   trailer/preview clip we can show inline.
// - TVMaze — TV shows, with posters and summaries.
//
// Results are normalized to the same shape the local catalog uses, plus
// `overview` and optional `previewUrl`, and tagged `external: true` so the UI
// knows these open a "where to watch" panel instead of a local player.

// iTunes artwork URLs embed their size ("100x100bb"); ask for a bigger one.
function upscaleArtwork(url) {
  return url ? url.replace(/100x100bb/, '600x600bb') : url
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').trim() : ''
}

async function searchItunesMovies(query, signal) {
  // Deliberately no `media=movie` param: some iTunes edge nodes return zero
  // results when it's set. Fetch broadly and keep only feature films.
  const url = `https://itunes.apple.com/search?limit=25&term=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`iTunes search failed (${res.status})`)
  const data = await res.json()
  return (data.results || [])
    .filter((r) => r.kind === 'feature-movie' && r.trackName)
    .slice(0, 12)
    .map((r) => ({
      id: `itunes:${r.trackId}`,
      external: true,
      title: r.trackName,
      year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined,
      type: 'movie',
      poster: upscaleArtwork(r.artworkUrl100),
      overview: r.longDescription || r.shortDescription || '',
      genres: r.primaryGenreName ? [r.primaryGenreName] : [],
      previewUrl: r.previewUrl || null,
    }))
}

async function searchTvmazeShows(query, signal) {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`TVMaze search failed (${res.status})`)
  const data = await res.json()
  return (data || [])
    .filter((r) => r.show)
    .slice(0, 12)
    .map(({ show }) => ({
      id: `tvmaze:${show.id}`,
      external: true,
      title: show.name,
      year: show.premiered ? Number(show.premiered.slice(0, 4)) : undefined,
      type: 'series',
      poster: show.image ? show.image.original || show.image.medium : null,
      overview: stripHtml(show.summary),
      genres: show.genres || [],
      previewUrl: null,
    }))
}

// Search all sources at once. A source failing (offline, rate limit) just
// drops its results — the other source's hits still come back.
export async function searchEverywhere(query, signal) {
  const settled = await Promise.allSettled([
    searchItunesMovies(query, signal),
    searchTvmazeShows(query, signal),
  ])
  // Surface an abort so the caller can ignore stale requests.
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const results = settled
    .filter((s) => s.status === 'fulfilled')
    .flatMap((s) => s.value)
  const failures = settled.filter((s) => s.status === 'rejected').length
  // Interleave movies and shows so one source doesn't bury the other, and
  // titles that start with the query float to the top within each source.
  const q = query.toLowerCase()
  const rank = (item) => (item.title.toLowerCase().startsWith(q) ? 0 : 1)
  const movies = results.filter((r) => r.type === 'movie').sort((a, b) => rank(a) - rank(b))
  const shows = results.filter((r) => r.type === 'series').sort((a, b) => rank(a) - rank(b))
  const merged = []
  for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
    if (movies[i]) merged.push(movies[i])
    if (shows[i]) merged.push(shows[i])
  }
  return { results: merged, allFailed: failures === settled.length }
}
