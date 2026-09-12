import { describe, expect, it } from 'vitest'
import { assess, type CapabilityReport, CODEC_CASES, detectWasm } from './capabilities.ts'

function fullReport(): CapabilityReport {
  return {
    generatedAt: '2026-09-12T00:00:00.000Z',
    userAgent: 'test',
    secureContext: true,
    crossOriginIsolated: false,
    webCodecs: { videoDecoder: true, videoEncoder: true, audioDecoder: true },
    codecs: CODEC_CASES.map((c) => ({ ...c, decode: true, encode: true })),
    worker: { offscreenCanvas2d: true, videoFrameFromCanvas: true, opfsSyncAccessHandle: true },
    wasm: { supported: true, simd: true },
    webGpu: { available: false, adapter: null },
    webShareFiles: true,
    storage: { quotaMB: 1000, usageMB: 0, persisted: false },
    memory: { jsHeapLimitMB: null, deviceMemoryGB: null },
  }
}

const withCodec = (report: CapabilityReport, prefix: string, height: number, patch: object) => ({
  ...report,
  codecs: report.codecs.map((c) =>
    c.codec.startsWith(prefix) && c.height === height ? { ...c, ...patch } : c,
  ),
})

describe('assess', () => {
  it('reports nothing for a fully capable browser', () => {
    expect(assess(fullReport())).toEqual({ blockers: [], warnings: [] })
  })

  it('blocks without WebCodecs or a secure context', () => {
    const report = fullReport()
    report.secureContext = false
    report.webCodecs = { videoDecoder: false, videoEncoder: false, audioDecoder: false }
    report.codecs = report.codecs.map((c) => ({ ...c, decode: null, encode: null }))
    expect(assess(report).blockers).toEqual([
      'Not a secure context (HTTPS required for WebCodecs).',
      'No WebCodecs VideoDecoder.',
      'No WebCodecs VideoEncoder.',
    ])
  })

  it('blocks when H.264 cannot be encoded even at 1080p', () => {
    const report = withCodec(fullReport(), 'avc1', 1080, { encode: false })
    expect(assess(report).blockers).toContain(
      'Cannot encode H.264 at 1080p, so there is no export path.',
    )
  })

  it('warns about missing HEVC, HDR, 4K encode, OPFS and sharing', () => {
    let report = withCodec(fullReport(), 'hvc1.1', 2160, { decode: false })
    report = withCodec(report, 'hvc1.2', 2160, { decode: false })
    report = withCodec(report, 'avc1', 2160, { encode: false })
    report.worker = { ...report.worker, opfsSyncAccessHandle: false }
    report.webShareFiles = false
    const { blockers, warnings } = assess(report)
    expect(blockers).toEqual([])
    expect(warnings).toHaveLength(5)
  })
})

describe('detectWasm', () => {
  it('recognises WASM SIMD in Node 24', () => {
    expect(detectWasm()).toEqual({ supported: true, simd: true })
  })
})
