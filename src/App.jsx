import { useEffect, useMemo, useRef, useState } from 'react'
import { catalog } from './catalog.js'
import { searchEverywhere } from './universalSearch.js'
import { streamTorrent, seedFiles } from './torrent.js'

// Simplified brand marks drawn inline so the static site needs no external
// image hosts (and keeps working offline). Each is a recognizable glyph, not
// the full trademarked wordmark.
const ICONS = {
  netflix: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E50914" d="M6 2h3.5l5 12.5V2H18v20l-3.5-1-5-12.5V21L6 22z" />
    </svg>
  ),
  prime: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00A8E1" d="M8 5v10l9-5z" />
      <path fill="none" stroke="#00A8E1" strokeWidth="1.8" strokeLinecap="round" d="M4 18.5c5.5 3 10.5 3 16-.5" />
      <path fill="none" stroke="#00A8E1" strokeWidth="1.8" strokeLinecap="round" d="M18.5 16.5l1.8.4-.5 1.8" />
    </svg>
  ),
  hulu: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1CE783" d="M5 2h3.4v6.4c.6-.2 1.3-.4 2.2-.4H14c2.8 0 4.4 1.7 4.4 4.3V22H15v-8.9c0-1-.6-1.7-1.6-1.7h-3.4c-1 0-1.6.7-1.6 1.7V22H5z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect fill="#FF0000" x="2" y="5" width="20" height="14" rx="4" />
      <path fill="#fff" d="M10 9l6 3-6 3z" />
    </svg>
  ),
  youtubetv: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect fill="none" stroke="#FF0000" strokeWidth="1.8" x="2" y="4.5" width="20" height="13" rx="3" />
      <path fill="#FF0000" d="M10 8l5.5 3L10 14z" />
      <path stroke="#FF0000" strokeWidth="1.8" strokeLinecap="round" d="M8 20.5h8" />
    </svg>
  ),
}

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
// `login` is the service's own sign-in page, used by the "connect" flow below.
const SERVICES = [
  { key: 'netflix', label: 'Netflix', login: 'https://www.netflix.com/login', url: (q) => q ? `https://www.netflix.com/search?q=${q}` : 'https://www.netflix.com/' },
  { key: 'prime', label: 'Prime Video', login: 'https://www.amazon.com/gp/sign-in.html', url: (q) => q ? `https://www.amazon.com/gp/video/search?phrase=${q}` : 'https://www.amazon.com/gp/video/storefront' },
  { key: 'hulu', label: 'Hulu', login: 'https://auth.hulu.com/web/login', url: (q) => q ? `https://www.hulu.com/search?q=${q}` : 'https://www.hulu.com/' },
  { key: 'youtube', label: 'YouTube', login: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F', url: (q) => q ? `https://www.youtube.com/results?search_query=${q}` : 'https://www.youtube.com/' },
  { key: 'youtubetv', label: 'YouTube TV', login: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Ftv.youtube.com%2F', url: (q) => q ? `https://tv.youtube.com/search/${q}` : 'https://tv.youtube.com/' },
]

// "Connecting" a service means: open its own sign-in page in a new tab (the
// user authenticates on the service directly — a static site can't and
// shouldn't handle their credentials), then remember the pairing in
// localStorage so this browser shows the service as connected. It's a local
// convenience marker; we cannot verify the cross-origin session from here.
const CONNECTED_KEY = 'stream.connectedServices'

function loadConnected() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONNECTED_KEY))
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}

function saveConnected(set) {
  try {
    localStorage.setItem(CONNECTED_KEY, JSON.stringify([...set]))
  } catch {
    /* private mode / storage disabled — pairing just won't persist */
  }
}

// Validate a pasted "play this" input. Accepts a direct http(s) link to a
// media file (or HLS playlist), or a magnet: link — magnets stream in-browser
// through the WebTorrent client in src/torrent.js. Returns an { item } to
// play, or an { error } string to show the user.
const MEDIA_EXT = /\.(mp4|m4v|webm|ogg|ogv|mov|m3u8|mp3|m4a|m4b|aac|flac|wav|oga|opus)(\?.*)?$/i
function parseUrlInput(raw) {
  const value = raw.trim()
  if (!value) return { error: 'Paste a direct video URL or a magnet link.' }
  if (/^magnet:/i.test(value)) {
    const name = /[?&]dn=([^&]+)/.exec(value)
    return {
      item: {
        id: `torrent:${value}`,
        title: name ? decodeURIComponent(name[1].replace(/\+/g, ' ')) : 'Torrent stream',
        description: 'Streaming from peers via WebTorrent.',
        torrent: value,
        type: 'home',
      },
    }
  }
  if (/\.torrent(\?.*)?$/i.test(value)) {
    return { error: 'For a .torrent file, download it and use "Open .torrent" below.' }
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

function fmtBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log2(n) / 10))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

// Plays a magnet link or .torrent file in-browser via WebTorrent: pieces are
// fetched from WebRTC peers and streamed into the <video>. The torrent is
// destroyed when the player closes unless this tab is also seeding it.
function TorrentPlayer({ input }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let torrent = null
    let timer = null
    let closed = false
    streamTorrent(input, videoRef.current, setError).then((t) => {
      if (closed) {
        if (!t.__shared) t.destroy()
        return
      }
      torrent = t
      timer = setInterval(() => {
        setStats({ peers: t.numPeers, progress: t.progress, speed: t.downloadSpeed })
      }, 1000)
    }, (err) => setError(err?.message || 'Could not start the torrent.'))
    return () => {
      closed = true
      if (timer) clearInterval(timer)
      if (torrent && !torrent.__shared) torrent.destroy()
    }
  }, [input])

  return (
    <>
      <video ref={videoRef} controls playsInline preload="metadata" />
      {error ? (
        <p className="torrent-stats torrent-error" role="alert">{error}</p>
      ) : (
        <p className="torrent-stats">
          {!stats
            ? 'Connecting to peers…'
            : stats.progress >= 1
              ? `Downloaded · seeding back to ${stats.peers} peer${stats.peers === 1 ? '' : 's'}`
              : `${stats.peers} peer${stats.peers === 1 ? '' : 's'} · ${Math.round(stats.progress * 100)}% · ${fmtBytes(stats.speed)}/s`}
        </p>
      )}
    </>
  )
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
  const [connected, setConnected] = useState(loadConnected)
  // Universal search: results from public catalogs (iTunes movies, TVMaze TV)
  // for anything not in the local library, plus the item whose "where to
  // watch" panel is open.
  const [external, setExternal] = useState({ status: 'idle', results: [], q: '' })
  const [detail, setDetail] = useState(null)
  // Torrents this tab is seeding (live WebTorrent objects) — they keep
  // uploading to peers for as long as the tab stays open.
  const [seeds, setSeeds] = useState([])
  const [seedError, setSeedError] = useState('')
  const [seedBusy, setSeedBusy] = useState(false)
  const [copiedMagnet, setCopiedMagnet] = useState('')
  const [, setSeedTick] = useState(0) // re-render to refresh live seed stats
  const torrentFileRef = useRef(null)
  const seedFileRef = useRef(null)

  useEffect(() => {
    if (seeds.length === 0) return
    const timer = setInterval(() => setSeedTick((t) => t + 1), 2000)
    return () => clearInterval(timer)
  }, [seeds.length])

  function openTorrentFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setUrlError('')
    setActive({
      id: `torrent-file:${file.name}`,
      title: file.name.replace(/\.torrent$/i, ''),
      description: 'Streaming from peers via WebTorrent.',
      torrent: file,
      type: 'home',
    })
  }

  async function seedVideo(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (files.length === 0) return
    setSeedError('')
    setSeedBusy(true)
    try {
      const torrent = await seedFiles(files)
      setSeeds((prev) => [...prev, torrent])
    } catch (err) {
      setSeedError(err?.message || 'Could not start seeding.')
    } finally {
      setSeedBusy(false)
    }
  }

  function copyMagnet(torrent) {
    navigator.clipboard?.writeText(torrent.magnetURI).then(() => {
      setCopiedMagnet(torrent.infoHash)
      setTimeout(() => setCopiedMagnet(''), 2000)
    })
  }

  function stopSeeding(torrent) {
    torrent.destroy()
    setSeeds((prev) => prev.filter((t) => t !== torrent))
  }

  function toggleConnect(service) {
    setConnected((prev) => {
      const next = new Set(prev)
      if (next.has(service.key)) {
        next.delete(service.key) // disconnect = just forget the local pairing
      } else {
        next.add(service.key)
        window.open(service.login, '_blank', 'noopener,noreferrer')
      }
      saveConnected(next)
      return next
    })
  }

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

  // Debounced universal search: wait for typing to settle, then query the
  // public catalogs. AbortController + cleanup ignores stale responses.
  // Results are tagged with the query they answer (`q`); render code treats
  // anything tagged with a different query as still loading — that way the
  // effect never has to reset state synchronously.
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { results, allFailed } = await searchEverywhere(q, controller.signal)
        setExternal({ status: allFailed ? 'error' : 'done', results, q })
      } catch (err) {
        if (err.name !== 'AbortError') setExternal({ status: 'error', results: [], q })
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  // The universal-search UI is live once the query is long enough; until the
  // in-flight fetch for the *current* query lands, it's in the loading state.
  const externalActive = q.length >= 2
  const externalReady = externalActive && external.q === q

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter((item) => {
      const matchesType = type === 'all' || item.type === type
      const matchesQuery = q === '' || haystack(item).includes(q)
      return matchesType && matchesQuery
    })
  }, [query, type])

  // External hits honor the type chips too ('home' videos can only be local),
  // and anything already in the library is dropped to avoid duplicate cards.
  const externalShown = useMemo(() => {
    if (!externalReady || type === 'home') return []
    const localTitles = new Set(catalog.map((i) => i.title.toLowerCase()))
    return external.results.filter(
      (item) => (type === 'all' || item.type === type) && !localTitles.has(item.title.toLowerCase()),
    )
  }, [externalReady, external.results, type])

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
          {SERVICES.map((s) => {
            const isConnected = connected.has(s.key)
            return (
              <span key={s.key} className={`service-group${isConnected ? ' service-connected' : ''}`}>
                <a
                  className="service"
                  href={s.url(encodeURIComponent(query.trim()))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="service-icon">{ICONS[s.key]}</span>
                  {s.label}
                  {isConnected && <span className="service-dot" title="Connected on this browser" aria-label="Connected" />}
                </a>
                <button
                  type="button"
                  className="service-connect"
                  onClick={() => toggleConnect(s)}
                  title={isConnected
                    ? `Forget ${s.label} pairing on this browser`
                    : `Sign in to ${s.label} (opens its sign-in page) and pair it on this browser`}
                >
                  {isConnected ? 'Connected ✓' : 'Connect'}
                </button>
              </span>
            )
          })}
        </nav>
        <form className="url-bar" onSubmit={playUrl}>
          <input
            className="url-input"
            type="text"
            inputMode="url"
            placeholder="Paste a video URL (.mp4, .m3u8) or a magnet link…"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); if (urlError) setUrlError('') }}
            aria-label="Play a video from a URL or magnet link"
          />
          <button className="url-play" type="submit">Play</button>
          <button
            className="url-play"
            type="button"
            onClick={() => torrentFileRef.current?.click()}
            title="Open a downloaded .torrent file and stream its video from peers"
          >
            Open .torrent
          </button>
          <input
            ref={torrentFileRef}
            type="file"
            accept=".torrent,application/x-bittorrent"
            hidden
            onChange={openTorrentFile}
          />
          <button
            className="url-play"
            type="button"
            disabled={seedBusy}
            onClick={() => seedFileRef.current?.click()}
            title="Share a video or audio file you own: this tab seeds it to peers and gives you a magnet link"
          >
            {seedBusy ? 'Hashing…' : 'Seed a file'}
          </button>
          <input
            ref={seedFileRef}
            type="file"
            accept="video/*,audio/*,.mp4,.m4v,.webm,.mov,.mkv,.mp3,.m4a,.flac,.wav,.ogg,.opus"
            hidden
            onChange={seedVideo}
          />
          {urlError && <span className="url-error" role="alert">{urlError}</span>}
          {seedError && <span className="url-error" role="alert">{seedError}</span>}
        </form>
        {seeds.length > 0 && (
          <div className="seed-list">
            <span className="services-label">Seeding (keep this tab open):</span>
            {seeds.map((t) => (
              <span key={t.infoHash} className="seed-item">
                <button
                  className="seed-name"
                  title="Play this torrent"
                  onClick={() => setActive({
                    id: `torrent:${t.magnetURI}`,
                    title: t.name,
                    description: 'Streaming from peers via WebTorrent.',
                    torrent: t.magnetURI,
                    type: 'home',
                  })}
                >
                  {t.name}
                </button>
                <span className="seed-stats">{t.numPeers} peer{t.numPeers === 1 ? '' : 's'} · ↑ {fmtBytes(t.uploaded)}</span>
                <button className="service-connect" onClick={() => copyMagnet(t)}>
                  {copiedMagnet === t.infoHash ? 'Copied ✓' : 'Copy magnet'}
                </button>
                <button className="service-connect" onClick={() => stopSeeding(t)}>Stop</button>
              </span>
            ))}
          </div>
        )}
      </header>

      {active && (
        <div className="player-overlay" onClick={() => setActive(null)}>
          <div className="player" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setActive(null)}>✕</button>
            {active.torrent ? (
              <TorrentPlayer input={active.torrent} />
            ) : active.youtubeId ? (
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

      {detail && (
        <div className="player-overlay" onClick={() => setDetail(null)}>
          <div className="player detail" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>✕</button>
            {detail.previewUrl ? (
              <video src={detail.previewUrl} poster={detail.poster || undefined} controls autoPlay preload="metadata" />
            ) : detail.poster ? (
              <img className="detail-poster" src={detail.poster} alt={detail.title} />
            ) : null}
            <h2>
              {detail.title}
              {detail.year ? <span className="year"> · {detail.year}</span> : null}
            </h2>
            {detail.genres?.length > 0 && (
              <p className="detail-genres">{detail.genres.join(' · ')}</p>
            )}
            <p>{detail.overview || 'No description available.'}</p>
            <div className="detail-watch">
              <span className="services-label">Watch on:</span>
              {SERVICES.map((s) => (
                <a
                  key={s.key}
                  className="service"
                  href={s.url(encodeURIComponent(detail.title))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="service-icon">{ICONS[s.key]}</span>
                  {s.label}
                  {connected.has(s.key) && <span className="service-dot" title="Connected on this browser" aria-label="Connected" />}
                </a>
              ))}
            </div>
            {detail.previewUrl && (
              <p className="detail-note">Playing the free preview clip — pick a service above for the full title.</p>
            )}
          </div>
        </div>
      )}

      <main>
        {externalShown.length > 0 && <h2 className="section-title">Your library</h2>}
        <div className="grid">
          {results.map((item) => (
            <button key={item.id} className="card" onClick={() => setActive(item)}>
              <img src={item.poster} alt={item.title} loading="lazy" />
              <span className="card-title">
                {item.title}
                {item.year ? <span className="year"> · {item.year}</span> : null}
              </span>
            </button>
          ))}
          {results.length === 0 && externalShown.length === 0 && (!externalActive || externalReady) && (
            <p className="empty">No titles match “{query}”.</p>
          )}
        </div>

        {externalActive && !externalReady && (
          <p className="external-status">Searching everywhere…</p>
        )}
        {externalReady && external.status === 'error' && (
          <p className="external-status">Couldn’t reach the movie/TV databases — check your connection.</p>
        )}
        {externalShown.length > 0 && (
          <>
            <h2 className="section-title">Found everywhere</h2>
            <p className="section-hint">From public movie &amp; TV databases — pick a title to see where to watch it.</p>
            <div className="grid">
              {externalShown.map((item) => (
                <button key={item.id} className="card" onClick={() => setDetail(item)}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} loading="lazy" />
                  ) : (
                    <span className="card-noposter" aria-hidden="true">🎬</span>
                  )}
                  <span className={`card-badge card-badge-${item.type}`}>{item.type === 'movie' ? 'Movie' : 'TV'}</span>
                  <span className="card-title">
                    {item.title}
                    {item.year ? <span className="year"> · {item.year}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
