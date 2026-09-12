import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadFixtures, validateTruth } from './fixtures.ts'

const root = resolve(import.meta.dirname, '../../fixtures')
const readExample = async () =>
  JSON.parse(await readFile(resolve(root, 'example/truth.json'), 'utf8')) as Record<string, unknown>

describe('fixture format', () => {
  it('accepts every committed truth.json', async () => {
    const { fixtures, errors } = await loadFixtures(root)
    expect(errors).toEqual([])
    expect(fixtures.map((f) => f.id)).toContain('example')
  })

  it('rejects out-of-order and out-of-bounds points', async () => {
    const truth = await readExample()
    truth.points = [
      { frame: 44, x: 10, y: 10, visibility: 'visible' },
      { frame: 43, x: 99_999, y: 10, visibility: 'visible' },
    ]
    expect(validateTruth(truth)).toEqual([
      'points[1].frame: frames must be strictly increasing',
      'points[1].x: expected a number within the frame width',
    ])
  })

  it('rejects labels outside the impact..lost window', async () => {
    const truth = await readExample()
    truth.points = [{ frame: 10, x: 10, y: 10, visibility: 'visible' }]
    expect(validateTruth(truth)).toEqual(['points[0].frame: before events.impactFrame'])
  })
})
