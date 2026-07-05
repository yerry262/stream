import { useState } from 'react'
import { catalog } from './catalog.js'

export default function App() {
  const [active, setActive] = useState(null)

  return (
    <div className="app">
      <header className="topbar">
        <h1>Stream</h1>
      </header>

      {active && (
        <div className="player-overlay" onClick={() => setActive(null)}>
          <div className="player" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setActive(null)}>✕</button>
            <video src={active.src} poster={active.poster} controls autoPlay />
            <h2>{active.title}</h2>
            <p>{active.description}</p>
          </div>
        </div>
      )}

      <main className="grid">
        {catalog.map((item) => (
          <button key={item.id} className="card" onClick={() => setActive(item)}>
            <img src={item.poster} alt={item.title} loading="lazy" />
            <span className="card-title">{item.title}</span>
          </button>
        ))}
      </main>
    </div>
  )
}
