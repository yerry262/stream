import { useMemo, useState } from 'react'
import { catalog } from './catalog.js'

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'TV' },
  { key: 'home', label: 'Home videos' },
]

// Streaming services we can hand off to. These are deep links into each
// service's own search — the content plays on THEIR licensed player, in a new
// tab. There is no legal way to authenticate and play a paid service's DRM'd
// catalog inside this app, so we link out instead of pretending to embed it.
// `url(q)` returns the destination for the current query (or the service home
// when the box is empty).
const SERVICES = [
  { key: 'netflix', label: 'Netflix', url: (q) => q ? `https://www.netflix.com/search?q=${q}` : 'https://www.netflix.com/' },
  { key: 'prime', label: 'Prime Video', url: (q) => q ? `https://www.amazon.com/gp/video/search?phrase=${q}` : 'https://www.amazon.com/gp/video/storefront' },
  { key: 'hulu', label: 'Hulu', url: (q) => q ? `https://www.hulu.com/search?q=${q}` : 'https://www.hulu.com/' },
  { key: 'youtube', label: 'YouTube', url: (q) => q ? `https://www.youtube.com/results?search_query=${q}` : 'https://www.youtube.com/' },
  { key: 'youtubetv', label: 'YouTube TV', url: (q) => q ? `https://tv.youtube.com/search/${q}` : 'https://tv.youtube.com/' },
]

// Validate a pasted "play this URL" input. We only accept a direct http(s)
// link to a media file (or an HLS playlist). magnet: / torrent links are
// rejected outright — playing those requires a torrent client that fetches and
// reshares the swarm, which this app deliberately does not do. Returns an
// { item } to play, or an { error } string to show the user.
const MEDIA_EXT = /\.(mp4|m4v|webm|ogg|ogv|mov|m3u8)(\?.*)?$/i
function parseUrlInput(raw) {
  const value = raw.trim()
  if (!value) return { error: 'Paste a direct video URL.' }
  if (/^magnet:/i.test(value) || /\.torrent(\?.*)?$/i.test(value)) {
    return { error: 'Magnet and torrent links are not supported — paste a direct video file URL instead.' }
  }
  let url
  try {
    url = new URL(value)
  } catch {
    return { error: 'That does not look like a valid URL.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Only http(s) links to a video file are supported.' }
  }
  if (!MEDIA_EXT.test(url.pathname)) {
    return { error: 'Link must point to a video file (.mp4, .webm, .m3u8, …).' }
  }
  const name = decodeURIComponent(url.pathname.split('/').pop() || 'Pasted video')
  return {
    item: {
      id: `url:${value}`,
      title: name,
      description: value,
      src: value,
      type: 'home',
    },
  }
}

// Everything a title should match against when someone types in the search box.
function haystack(item) {
  return [item.title, item.description, item.year, ...(item.genres || [])]
    .join(' ')
    .toLowerCase()
}

export default function App() {
  const [active, setActive] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')

  function playUrl(e) {
    e.preventDefault()
    const { item, error } = parseUrlInput(urlInput)
    if (error) {
      setUrlError(error)
      return
    }
    setUrlError('')
    setActive(item)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter((item) => {
      const matchesType = type === 'all' || item.type === type
      const matchesQuery = q === '' || haystack(item).includes(q)
      return matchesType && matchesQuery
    })
  }, [query, type])

  return (
    <div className="app">
      <header className="topbar">
        <h1>Stream</h1>
        <input
          className="search"
          type="search"
          placeholder="Search titles, genres, years…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the library"
        />
        <div className="chips">
          {TYPES.map((t) => (
            <button
              key={t.key}
              className={`chip${type === t.key ? ' chip-active' : ''}`}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <nav className="services" aria-label="Search on streaming services">
          <span className="services-label">Search on:</span>
          {SERVICES.map((s) => (
            <a
              key={s.key}
              className="service"
              href={s.url(encodeURIComponent(query.trim()))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <form className="url-bar" onSubmit={playUrl}>
          <input
            className="url-input"
            type="url"
            inputMode="url"
            placeholder="Paste a direct video URL to play (.mp4, .webm, .m3u8)…"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); if (urlError) setUrlError('') }}
            aria-label="Play a video from a URL"
          />
          <button className="url-play" type="submit">Play URL</button>
          {urlError && <span className="url-error" role="alert">{urlError}</span>}
        </form>
      </header>

      {active && (
        <div className="player-overlay" onClick={() => setActive(null)}>
          <div className="player" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setActive(null)}>✕</button>
            {active.youtubeId ? (
              /* YouTube is the one service that permits embedded playback, via
                 its IFrame player — so a YouTube-backed entry plays inline here
                 legally, no API key needed. */
              <iframe
                className="yt"
                src={`https://www.youtube-nocookie.com/embed/${active.youtubeId}?autoplay=1`}
                title={active.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              /* preload="metadata" fetches only the header so the browser can
                 seek immediately and stream byte ranges around the playhead —
                 works when the host honors HTTP range requests. */
              <video
                src={active.src}
                poster={active.poster}
                controls
                autoPlay
                preload="metadata"
              />
            )}
            <h2>
              {active.title}
              {active.year ? <span className="year"> · {active.year}</span> : null}
            </h2>
            <p>{active.description}</p>
          </div>
        </div>
      )}

      <main className="grid">
        {results.map((item) => (
          <button key={item.id} className="card" onClick={() => setActive(item)}>
            <img src={item.poster} alt={item.title} loading="lazy" />
            <span className="card-title">
              {item.title}
              {item.year ? <span className="year"> · {item.year}</span> : null}
            </span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="empty">No titles match “{query}”.</p>
        )}
      </main>
    </div>
  )
}
