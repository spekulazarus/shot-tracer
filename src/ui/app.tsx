import { ProbePage } from './probe-page.tsx'

export function App() {
  if (new URLSearchParams(location.search).has('probe')) return <ProbePage />
  return (
    <main>
      <h1>shot-tracer</h1>
      <p>Nothing to trace yet. See docs/ROADMAP.md for what comes next.</p>
      <p>
        <a href="?probe">Check what this browser supports</a>
      </p>
    </main>
  )
}
