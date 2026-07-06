// In-browser torrent streaming and seeding via WebTorrent — no client install
// needed. The whole "get a torrent client" flow happens inside the app:
// paste a magnet link / open a .torrent file to stream it, or pick a local
// video to seed and get a shareable magnet link.
//
// Important WebTorrent reality: browser peers talk WebRTC, not TCP/UDP, so
// they can only exchange data with other WebRTC-capable peers — another
// browser tab running this app, WebTorrent Desktop, or webtorrent-hybrid.
// A plain qBittorrent/Transmission seed is NOT reachable from a browser
// unless the torrent also has WebRTC seeds. The `announce` list below is
// WebSocket trackers, which is how WebRTC peers find each other.
//
// The library (~1 MB) is loaded lazily on first torrent use so the normal
// browse/search experience pays nothing for it.

export const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce',
]

// Anything a <video> element can play — video and audio-only formats alike.
const MEDIA_EXT = /\.(mp4|m4v|webm|mov|ogv|mkv|mp3|m4a|m4b|aac|flac|wav|oga|ogg|opus)$/i

let clientPromise = null

async function createClient() {
  const { default: WebTorrent } = await import('webtorrent/dist/webtorrent.min.js')
  const client = new WebTorrent()
  // The streaming server needs a service worker to proxy range requests from
  // the <video> element into the torrent. If registration fails (old browser,
  // private mode), we fall back to blob playback: download fully, then play.
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.min.js`, {
      scope: import.meta.env.BASE_URL,
    })
    const registration = await navigator.serviceWorker.ready
    client.createServer({ controller: registration })
  } catch {
    /* blob fallback below */
  }
  window.__wtClient = client // console/debug access
  return client
}

export function getTorrentClient() {
  if (!clientPromise) clientPromise = createClient()
  return clientPromise
}

// Normalize the accepted torrent inputs to something client.add understands.
// - magnet: URI → as-is
// - .torrent File (from an <input type=file>) → bytes
export async function toTorrentId(input) {
  if (typeof input === 'string') return input
  if (input instanceof File) return new Uint8Array(await input.arrayBuffer())
  throw new Error('Unsupported torrent input')
}

// Add a torrent and stream its largest video file into `videoEl`.
// Returns the torrent so the caller can poll stats and destroy it on close.
export async function streamTorrent(input, videoEl, onError) {
  const client = await getTorrentClient()
  const torrentId = await toTorrentId(input)

  const start = (torrent) => {
    const file = torrent.files
      .filter((f) => MEDIA_EXT.test(f.name))
      .sort((a, b) => b.length - a.length)[0]
    if (!file) {
      onError('No playable media file (.mp4, .mp3, .webm, …) in this torrent.')
      return
    }
    // Only fetch the file being watched — and prioritize pieces around the
    // playhead (the streaming server turns the <video>'s range requests into
    // piece priorities, so seeking re-targets the download).
    torrent.files.forEach((f) => { if (f !== file) f.deselect() })
    file.select()
    if (client._server) {
      file.streamTo(videoEl)
      videoEl.play().catch(() => {/* user gesture policies — controls remain */})
    } else {
      file.blob().then((blob) => {
        videoEl.src = URL.createObjectURL(blob)
        videoEl.play().catch(() => {})
      }, () => onError('Could not read the video from the torrent.'))
    }
  }

  // Re-adding a torrent that is already in the client (e.g. replaying, or
  // playing something this tab is seeding) is an error — reuse it instead.
  const existing = await new Promise((resolve) => {
    if (typeof torrentId === 'string' && torrentId.startsWith('magnet:')) {
      const match = /urn:btih:([0-9a-fA-F]{40})/.exec(torrentId)
      resolve(match ? client.get(match[1].toLowerCase()) : null)
    } else {
      resolve(null)
    }
  })
  if (existing) {
    const torrent = await existing
    if (torrent) {
      if (torrent.ready) start(torrent)
      else torrent.once('ready', () => start(torrent))
      torrent.__shared = true // don't destroy on player close; it may be seeding
      return torrent
    }
  }

  const torrent = client.add(torrentId, { announce: TRACKERS })
  torrent.on('error', (err) => onError(err?.message || String(err)))
  torrent.once('ready', () => start(torrent))
  return torrent
}

// Seed local files; resolves with the live torrent (magnetURI, stats).
// Seeding lasts as long as the tab stays open.
export async function seedFiles(files) {
  const client = await getTorrentClient()
  return new Promise((resolve, reject) => {
    try {
      client.seed(files, { announce: TRACKERS }, (torrent) => {
        torrent.__shared = true
        resolve(torrent)
      })
    } catch (err) {
      reject(err)
    }
  })
}
