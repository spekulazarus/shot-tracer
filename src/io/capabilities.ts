// What this browser can do, checked against the requirements in ARCHITECTURE §9.

export interface CodecCase {
  label: string
  codec: string
  width: number
  height: number
}

export interface CodecCheck extends CodecCase {
  /** null = the WebCodecs interface itself is missing. */
  decode: boolean | null
  encode: boolean | null
}

export interface WorkerCheck {
  offscreenCanvas2d: boolean
  videoFrameFromCanvas: boolean
  opfsSyncAccessHandle: boolean
  error?: string
}

export interface CapabilityReport {
  generatedAt: string
  userAgent: string
  secureContext: boolean
  crossOriginIsolated: boolean
  webCodecs: { videoDecoder: boolean; videoEncoder: boolean; audioDecoder: boolean }
  codecs: CodecCheck[]
  worker: WorkerCheck
  wasm: { supported: boolean; simd: boolean }
  webGpu: { available: boolean; adapter: string | null }
  webShareFiles: boolean
  storage: { quotaMB: number | null; usageMB: number | null; persisted: boolean | null }
  memory: { jsHeapLimitMB: number | null; deviceMemoryGB: number | null }
}

export const CODEC_CASES: readonly CodecCase[] = [
  { label: 'HEVC Main · 4K60', codec: 'hvc1.1.6.L153.B0', width: 3840, height: 2160 },
  {
    label: 'HEVC Main10 · 4K60 (iPhone HDR)',
    codec: 'hvc1.2.4.L153.B0',
    width: 3840,
    height: 2160,
  },
  { label: 'HEVC Main · 1080p60', codec: 'hvc1.1.6.L123.B0', width: 1920, height: 1080 },
  { label: 'H.264 High · 4K60', codec: 'avc1.640034', width: 3840, height: 2160 },
  { label: 'H.264 High · 1080p60', codec: 'avc1.64002A', width: 1920, height: 1080 },
]

// Smallest module using a v128 instruction (same probe as wasm-feature-detect).
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
])

export function detectWasm(): CapabilityReport['wasm'] {
  if (typeof WebAssembly !== 'object') return { supported: false, simd: false }
  return { supported: true, simd: WebAssembly.validate(SIMD_PROBE) }
}

async function checkDecode({ codec, width, height }: CodecCase): Promise<boolean | null> {
  if (typeof VideoDecoder === 'undefined') return null
  try {
    const result = await VideoDecoder.isConfigSupported({
      codec,
      codedWidth: width,
      codedHeight: height,
    })
    return result.supported === true
  } catch {
    return false
  }
}

async function checkEncode({ codec, width, height }: CodecCase): Promise<boolean | null> {
  if (typeof VideoEncoder === 'undefined') return null
  try {
    const result = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      framerate: 60,
      bitrate: width >= 3840 ? 40_000_000 : 12_000_000,
    })
    return result.supported === true
  } catch {
    return false
  }
}

const NO_WORKER: WorkerCheck = {
  offscreenCanvas2d: false,
  videoFrameFromCanvas: false,
  opfsSyncAccessHandle: false,
}

function probeWorker(timeoutMs = 5000): Promise<WorkerCheck> {
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./capabilities.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      resolve({ ...NO_WORKER, error: `worker failed to start: ${String(err)}` })
      return
    }
    const finish = (result: WorkerCheck) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ...NO_WORKER, error: 'worker timed out' }), timeoutMs)
    worker.onmessage = (event: MessageEvent<WorkerCheck>) => finish(event.data)
    worker.onerror = (event) => finish({ ...NO_WORKER, error: event.message || 'worker error' })
  })
}

type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter(): Promise<{ info?: { vendor?: string; architecture?: string } } | null>
  }
}

async function probeWebGpu(): Promise<CapabilityReport['webGpu']> {
  const gpu = (navigator as GpuNavigator).gpu
  if (!gpu) return { available: false, adapter: null }
  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return { available: false, adapter: null }
    const info = adapter.info
    return {
      available: true,
      adapter: [info?.vendor, info?.architecture].filter(Boolean).join(' '),
    }
  } catch {
    return { available: false, adapter: null }
  }
}

function canShareFiles(): boolean {
  try {
    const file = new File([], 'probe.mp4', { type: 'video/mp4' })
    return navigator.canShare?.({ files: [file] }) ?? false
  } catch {
    return false
  }
}

async function probeStorage(): Promise<CapabilityReport['storage']> {
  const toMB = (bytes: number | undefined) =>
    bytes === undefined ? null : Math.round(bytes / 2 ** 20)
  try {
    const estimate = await navigator.storage?.estimate()
    const persisted = (await navigator.storage?.persisted?.()) ?? null
    return { quotaMB: toMB(estimate?.quota), usageMB: toMB(estimate?.usage), persisted }
  } catch {
    return { quotaMB: null, usageMB: null, persisted: null }
  }
}

function probeMemory(): CapabilityReport['memory'] {
  const heap = (performance as Performance & { memory?: { jsHeapSizeLimit: number } }).memory
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return {
    jsHeapLimitMB: heap ? Math.round(heap.jsHeapSizeLimit / 2 ** 20) : null,
    deviceMemoryGB: deviceMemory ?? null,
  }
}

export async function probeCapabilities(): Promise<CapabilityReport> {
  const [codecs, worker, webGpu, storage] = await Promise.all([
    Promise.all(
      CODEC_CASES.map(async (c) => ({
        ...c,
        decode: await checkDecode(c),
        encode: await checkEncode(c),
      })),
    ),
    probeWorker(),
    probeWebGpu(),
    probeStorage(),
  ])
  return {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    secureContext: globalThis.isSecureContext,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    webCodecs: {
      videoDecoder: typeof VideoDecoder !== 'undefined',
      videoEncoder: typeof VideoEncoder !== 'undefined',
      audioDecoder: typeof AudioDecoder !== 'undefined',
    },
    codecs,
    worker,
    wasm: detectWasm(),
    webGpu,
    webShareFiles: canShareFiles(),
    storage,
    memory: probeMemory(),
  }
}

export interface Assessment {
  /** Missing capabilities that make the app unusable in this browser. */
  blockers: string[]
  /** Missing capabilities that degrade specific features. */
  warnings: string[]
}

export function assess(report: CapabilityReport): Assessment {
  const blockers: string[] = []
  const warnings: string[] = []
  const codec = (prefix: string, height: number) =>
    report.codecs.find((c) => c.codec.startsWith(prefix) && c.height === height)

  if (!report.secureContext) blockers.push('Not a secure context (HTTPS required for WebCodecs).')
  if (!report.webCodecs.videoDecoder) blockers.push('No WebCodecs VideoDecoder.')
  if (!report.webCodecs.videoEncoder) blockers.push('No WebCodecs VideoEncoder.')
  if (report.webCodecs.videoEncoder && !codec('avc1', 1080)?.encode) {
    blockers.push('Cannot encode H.264 at 1080p, so there is no export path.')
  }
  if (!report.worker.offscreenCanvas2d) blockers.push('No OffscreenCanvas 2D in workers.')
  if (!report.wasm.supported) blockers.push('No WebAssembly.')

  if (report.webCodecs.videoDecoder && !codec('hvc1.1', 2160)?.decode) {
    warnings.push('No HEVC decode: iPhone clips must be re-exported as H.264.')
  }
  if (report.webCodecs.videoDecoder && !codec('hvc1.2', 2160)?.decode) {
    warnings.push('No HEVC Main10 decode: iPhone HDR clips will not open.')
  }
  if (codec('avc1', 1080)?.encode && !codec('avc1', 2160)?.encode) {
    warnings.push('No 4K H.264 encode: exports fall back to 1080p.')
  }
  if (!report.worker.opfsSyncAccessHandle) {
    warnings.push('No OPFS sync access: large exports cannot be streamed to disk.')
  }
  if (!report.webShareFiles) warnings.push('No file sharing: exports are offered as downloads.')
  return { blockers, warnings }
}
