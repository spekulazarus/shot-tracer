import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

// Mirrors fixtures/truth.schema.json. Keep the two in sync.

export const VIEWS = ['down-the-line', 'face-on', 'other'] as const
export const MOUNTS = ['tripod', 'handheld'] as const
export const BACKGROUNDS = ['sky', 'treeline', 'mixed', 'other'] as const
export const VISIBILITIES = ['visible', 'uncertain'] as const

export interface TruthPoint {
  frame: number
  x: number
  y: number
  visibility: (typeof VISIBILITIES)[number]
}

export interface Truth {
  schemaVersion: 1
  clip: {
    file: string
    sha256?: string
    width: number
    height: number
    fps: number
    frameCount: number
    source?: string
  }
  meta: {
    view: (typeof VIEWS)[number]
    mount: (typeof MOUNTS)[number]
    background: (typeof BACKGROUNDS)[number]
    labeler?: string
    notes?: string
  }
  events: {
    impactFrame: number
    lostFrame: number | null
    landing: { frame: number | null; x: number; y: number } | null
  }
  points: TruthPoint[]
}

export interface Fixture {
  /** Directory relative to the fixtures root, e.g. `real/dtl-tripod-sky-01`. */
  id: string
  truthPath: string
  clipPath: string
  clipPresent: boolean
  truth: Truth
}

export interface FixtureError {
  id: string
  truthPath: string
  problems: string[]
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => Number.isInteger(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isOneOf = (v: unknown, options: readonly string[]) =>
  typeof v === 'string' && options.includes(v)

/** Returns a list of human-readable problems; an empty list means `value` is a valid Truth. */
export function validateTruth(value: unknown): string[] {
  const problems: string[] = []
  if (!isRec(value)) return ['root: expected an object']
  if (value.schemaVersion !== 1) problems.push('schemaVersion: expected 1')

  let bounds: { width: number; height: number; frameCount: number } | undefined
  const clip = value.clip
  if (!isRec(clip)) {
    problems.push('clip: expected an object')
  } else {
    if (typeof clip.file !== 'string' || clip.file === '') {
      problems.push('clip.file: expected a non-empty string')
    }
    const { width, height, frameCount, fps, sha256 } = clip
    if (!isInt(width) || width < 1) problems.push('clip.width: expected a positive integer')
    if (!isInt(height) || height < 1) problems.push('clip.height: expected a positive integer')
    if (!isInt(frameCount) || frameCount < 1) {
      problems.push('clip.frameCount: expected a positive integer')
    }
    if (!isNum(fps) || fps <= 0) problems.push('clip.fps: expected a positive number')
    if (sha256 !== undefined && !(typeof sha256 === 'string' && /^[0-9a-f]{64}$/.test(sha256))) {
      problems.push('clip.sha256: expected 64 lowercase hex characters')
    }
    if (isInt(width) && isInt(height) && isInt(frameCount)) bounds = { width, height, frameCount }
  }

  const meta = value.meta
  if (!isRec(meta)) {
    problems.push('meta: expected an object')
  } else {
    if (!isOneOf(meta.view, VIEWS)) problems.push(`meta.view: expected one of ${VIEWS.join(', ')}`)
    if (!isOneOf(meta.mount, MOUNTS)) {
      problems.push(`meta.mount: expected one of ${MOUNTS.join(', ')}`)
    }
    if (!isOneOf(meta.background, BACKGROUNDS)) {
      problems.push(`meta.background: expected one of ${BACKGROUNDS.join(', ')}`)
    }
  }

  let impactFrame: number | undefined
  let lostFrame: number | undefined
  const events = value.events
  if (!isRec(events)) {
    problems.push('events: expected an object')
  } else {
    if (!isInt(events.impactFrame) || events.impactFrame < 0) {
      problems.push('events.impactFrame: expected a non-negative integer')
    } else {
      impactFrame = events.impactFrame
    }
    if (events.lostFrame !== null) {
      if (
        !isInt(events.lostFrame) ||
        (impactFrame !== undefined && events.lostFrame < impactFrame)
      ) {
        problems.push('events.lostFrame: expected null or an integer >= impactFrame')
      } else {
        lostFrame = events.lostFrame
      }
    }
    const landing = events.landing
    if (landing !== null) {
      if (!isRec(landing) || !isNum(landing.x) || !isNum(landing.y)) {
        problems.push('events.landing: expected null or { frame, x, y }')
      } else if (landing.frame !== null && !isInt(landing.frame)) {
        problems.push('events.landing.frame: expected null or an integer')
      }
    }
  }

  const points = value.points
  if (!Array.isArray(points)) {
    problems.push('points: expected an array')
    return problems
  }
  let previousFrame = -1
  points.forEach((point: unknown, i) => {
    const at = `points[${i}]`
    if (!isRec(point)) {
      problems.push(`${at}: expected an object`)
      return
    }
    const { frame, x, y, visibility } = point
    if (!isInt(frame)) {
      problems.push(`${at}.frame: expected an integer`)
    } else {
      if (frame <= previousFrame) problems.push(`${at}.frame: frames must be strictly increasing`)
      if (bounds && (frame < 0 || frame >= bounds.frameCount)) {
        problems.push(`${at}.frame: outside [0, ${bounds.frameCount})`)
      }
      if (impactFrame !== undefined && frame < impactFrame) {
        problems.push(`${at}.frame: before events.impactFrame`)
      }
      if (lostFrame !== undefined && frame > lostFrame) {
        problems.push(`${at}.frame: after events.lostFrame`)
      }
      previousFrame = frame
    }
    if (!isNum(x) || (bounds && (x < 0 || x > bounds.width))) {
      problems.push(`${at}.x: expected a number within the frame width`)
    }
    if (!isNum(y) || (bounds && (y < 0 || y > bounds.height))) {
      problems.push(`${at}.y: expected a number within the frame height`)
    }
    if (!isOneOf(visibility, VISIBILITIES)) {
      problems.push(`${at}.visibility: expected one of ${VISIBILITIES.join(', ')}`)
    }
  })
  return problems
}

/** Every truth.json below `root`, sorted by path. */
export async function findTruthFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name === 'truth.json')
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

export async function loadFixtures(
  root: string,
): Promise<{ fixtures: Fixture[]; errors: FixtureError[] }> {
  const fixtures: Fixture[] = []
  const errors: FixtureError[] = []
  for (const truthPath of await findTruthFiles(root)) {
    const dir = dirname(truthPath)
    const id = relative(root, dir) || '.'
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(truthPath, 'utf8'))
    } catch (err) {
      errors.push({ id, truthPath, problems: [`invalid JSON: ${(err as Error).message}`] })
      continue
    }
    const problems = validateTruth(parsed)
    if (problems.length > 0) {
      errors.push({ id, truthPath, problems })
      continue
    }
    const truth = parsed as Truth
    const clipPath = join(dir, truth.clip.file)
    fixtures.push({ id, truthPath, clipPath, clipPresent: await exists(clipPath), truth })
  }
  return { fixtures, errors }
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )
