// Content catalog — the single source of truth for the library.
//
// Only add content you have the right to distribute: your own home videos,
// or work that is public domain / Creative Commons. Do NOT point `src` at
// copyrighted films or TV you don't have a license for.
//
// Each entry:
//   id          unique slug (used as React key)
//   title       display title
//   description short synopsis
//   poster      image URL (16:9 works best with the card layout)
//   src         browser-playable video URL (mp4, or HLS .m3u8 via <video>)
//   year        release/record year (shown + searchable)
//   type        'movie' | 'series' | 'home' — drives the filter chips
//   genres      array of tags, also searchable
//   youtubeId   (optional) a YouTube video id — when present, the title plays
//               inline via YouTube's embed player instead of using `src`.
//               Only use ids of videos that are legitimately on YouTube.
//
// STREAMING NOTE: for "load only the part you're watching" (seek without a
// full download), `src` must be hosted somewhere that supports HTTP range
// requests — S3/R2/Backblaze/nginx do; GitHub Pages does NOT. The <video>
// element handles the byte-range seeking automatically once the host cooperates.
export const catalog = [
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    description: 'A giant rabbit takes revenge on three bullying rodents.',
    poster: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
    src: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
    year: 2008,
    type: 'movie',
    genres: ['animation', 'comedy', 'open movie'],
  },
  {
    id: 'sintel',
    title: 'Sintel',
    description: 'A lone warrior searches for the dragon she once befriended.',
    poster: 'https://durian.blender.org/wp-content/uploads/2010/06/05.8b_comp_000272.jpg',
    src: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
    year: 2010,
    type: 'movie',
    genres: ['animation', 'fantasy', 'open movie'],
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    description: 'Warriors and scientists band together to save the world from robots.',
    poster: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
    src: 'https://test-videos.co.uk/vids/tearsofsteel/mp4/h264/720/Tears_of_Steel_720_10s_1MB.mp4',
    year: 2012,
    type: 'movie',
    genres: ['sci-fi', 'action', 'open movie'],
  },
  {
    id: 'big-buck-bunny-yt',
    title: 'Big Buck Bunny (YouTube)',
    description: 'The Blender Foundation’s official upload — plays inline via YouTube embed.',
    poster: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
    youtubeId: 'aqz-KE-bpKQ',
    year: 2008,
    type: 'movie',
    genres: ['animation', 'comedy', 'open movie', 'youtube'],
  },
]
