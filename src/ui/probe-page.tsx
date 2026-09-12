import { useEffect, useState } from 'preact/hooks'
import { assess, type CapabilityReport, probeCapabilities } from '../io/capabilities.ts'

const mark = (value: boolean | null) => (value === null ? '—' : value ? '✓' : '✗')

export function ProbePage() {
  const [report, setReport] = useState<CapabilityReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    probeCapabilities().then(setReport, (err: unknown) => setError(String(err)))
  }, [])

  if (error) return <main>Probe failed: {error}</main>
  if (!report) return <main>Probing this browser…</main>

  const { blockers, warnings } = assess(report)
  const json = JSON.stringify(report, null, 2)
  const copy = () =>
    navigator.clipboard.writeText(json).then(
      () => setCopied(true),
      () => setCopied(false),
    )

  const features: [string, string][] = [
    ['Secure context', mark(report.secureContext)],
    ['Cross-origin isolated', mark(report.crossOriginIsolated)],
    ['OffscreenCanvas 2D in worker', mark(report.worker.offscreenCanvas2d)],
    ['VideoFrame from canvas in worker', mark(report.worker.videoFrameFromCanvas)],
    ['OPFS sync access handle', mark(report.worker.opfsSyncAccessHandle)],
    ['WebAssembly / SIMD', `${mark(report.wasm.supported)} / ${mark(report.wasm.simd)}`],
    ['WebGPU', report.webGpu.available ? `✓ ${report.webGpu.adapter ?? ''}` : '✗'],
    ['Share files', mark(report.webShareFiles)],
    ['Storage quota', report.storage.quotaMB === null ? '—' : `${report.storage.quotaMB} MB`],
    [
      'JS heap limit',
      report.memory.jsHeapLimitMB === null ? '—' : `${report.memory.jsHeapLimitMB} MB`,
    ],
  ]

  return (
    <main>
      <h1>Capability probe</h1>
      <p class="muted">{report.userAgent}</p>

      {blockers.length === 0 ? (
        <p class="ok">This browser can run shot-tracer.</p>
      ) : (
        <ul class="bad">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul class="warn">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <h2>Codecs</h2>
      <table>
        <thead>
          <tr>
            <th>Config</th>
            <th>Decode</th>
            <th>Encode</th>
          </tr>
        </thead>
        <tbody>
          {report.codecs.map((c) => (
            <tr key={c.codec}>
              <td>
                {c.label} <code>{c.codec}</code>
              </td>
              <td>{mark(c.decode)}</td>
              <td>{mark(c.encode)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Features</h2>
      <table>
        <tbody>
          {features.map(([name, value]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.worker.error && <p class="muted">Worker notes: {report.worker.error}</p>}

      <p>
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy as JSON'}
        </button>
      </p>
      <details>
        <summary>Raw report</summary>
        <pre id="probe-json">{json}</pre>
      </details>
    </main>
  )
}
