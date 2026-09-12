// Worker half of the capability probe: features that only matter inside workers.

import type { WorkerCheck } from './capabilities.ts'

type SyncAccessHandle = {
  write(buffer: BufferSource, options?: { at?: number }): number
  flush(): void
  close(): void
}
type SyncCapableFileHandle = FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<SyncAccessHandle>
}

const PROBE_FILE = 'capability-probe.tmp'
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function run(): Promise<WorkerCheck> {
  const result: WorkerCheck = {
    offscreenCanvas2d: false,
    videoFrameFromCanvas: false,
    opfsSyncAccessHandle: false,
  }
  const errors: string[] = []

  try {
    const canvas = new OffscreenCanvas(16, 16)
    const ctx = canvas.getContext('2d')
    result.offscreenCanvas2d = ctx !== null
    if (ctx && typeof VideoFrame !== 'undefined') {
      ctx.fillRect(0, 0, 16, 16)
      const frame = new VideoFrame(canvas, { timestamp: 0 })
      result.videoFrameFromCanvas = frame.displayWidth === 16
      frame.close()
    }
  } catch (err) {
    errors.push(`canvas: ${message(err)}`)
  }

  try {
    const root = await navigator.storage.getDirectory()
    const handle = (await root.getFileHandle(PROBE_FILE, { create: true })) as SyncCapableFileHandle
    const access = await handle.createSyncAccessHandle()
    access.write(new Uint8Array([1, 2, 3, 4]), { at: 0 })
    access.flush()
    access.close()
    await root.removeEntry(PROBE_FILE)
    result.opfsSyncAccessHandle = true
  } catch (err) {
    errors.push(`opfs: ${message(err)}`)
  }

  if (errors.length > 0) result.error = errors.join('; ')
  return result
}

run().then((result) => postMessage(result))
