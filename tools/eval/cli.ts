// Fixture harness entry point (`npm run eval`).
//
// Scaffold stage: discovers and validates fixtures. The tracking pipeline, metrics,
// baseline comparison and PASS/FAIL columns are built in milestone M1 (docs/TESTING.md).

import { resolve } from 'node:path'
import { loadFixtures } from './fixtures.ts'

const root = resolve(import.meta.dirname, '../../fixtures')
const { fixtures, errors } = await loadFixtures(root)

const rows = fixtures.map((f) => {
  const { clip, meta, points } = f.truth
  return {
    fixture: f.id,
    view: meta.view,
    mount: meta.mount,
    background: meta.background,
    video: `${clip.width}x${clip.height}@${clip.fps}`,
    labelled: String(points.filter((p) => p.visibility === 'visible').length),
    clip: f.clipPresent ? 'present' : 'missing',
  }
})

printTable(rows)

for (const error of errors) {
  console.error(`\n✗ ${error.id}  (${error.truthPath})`)
  for (const problem of error.problems) console.error(`    ${problem}`)
}

console.log(
  `\n${fixtures.length} valid fixture(s), ${errors.length} invalid.` +
    '\nTracking pipeline not implemented yet: recall, error and PASS/FAIL columns arrive in M1.',
)
process.exitCode = errors.length > 0 ? 1 : 0

function printTable(data: Record<string, string>[]): void {
  const first = data[0]
  if (!first) {
    console.log('No fixtures found under fixtures/.')
    return
  }
  const columns = Object.keys(first)
  const widths = columns.map((c) => Math.max(c.length, ...data.map((row) => (row[c] ?? '').length)))
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ')
  console.log(line(columns))
  console.log(line(widths.map((w) => '-'.repeat(w))))
  for (const row of data) console.log(line(columns.map((c) => row[c] ?? '')))
}
