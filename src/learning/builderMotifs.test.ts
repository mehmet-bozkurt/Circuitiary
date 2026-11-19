import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, locale } from '../i18n'
import {
  cellIds, cloneDraft, motifs, motifsEn, presetById, presets, presetsEn, runDraft, validateDraft,
  type BuilderDraft, type BuilderLink, type BuilderRun, type CellId,
} from './circuitBuilder'

afterEach(() => { locale.value = DEFAULT_LOCALE })

const run = (draft: BuilderDraft): BuilderRun => {
  const outcome = runDraft(draft)
  if (!outcome.ok) throw new Error(outcome.problems.map(problem => problem.message).join(' | '))
  return outcome.run
}
const cell = (result: BuilderRun, id: CellId) => result.cells.find(item => item.id === id)!
const trace = (result: BuilderRun, id: CellId) => result.result.activity[id]!
const at = (result: BuilderRun, id: CellId, timeMs: number) => trace(result, id)[result.result.timesMs.indexOf(timeMs)]!
/** The motif's circuit with some connections left out: the "Dene" step of its text. */
const without = (id: Parameters<typeof presetById>[0], drop: (link: BuilderLink) => boolean): BuilderDraft => {
  const draft = cloneDraft(presetById(id).draft)
  draft.links = draft.links.filter(link => !drop(link))
  return draft
}
const added = motifs.slice(presets.length)

describe('motif gallery list', () => {
  it('starts with the four first examples, as the same objects, and adds five motifs', () => {
    expect(motifs.slice(0, 4)).toEqual([...presets])
    motifs.slice(0, 4).forEach((motif, index) => expect(motif).toBe(presets[index]))
    motifsEn.slice(0, 4).forEach((motif, index) => expect(motif).toBe(presetsEn[index]))
    expect(added.map(motif => motif.id)).toEqual(['divergence', 'convergence', 'feedback-inhibition', 'electrical-pair', 'disinhibition'])
    expect(new Set(motifs.map(motif => motif.id)).size).toBe(motifs.length)
    expect(new Set(motifs.map(motif => motif.title)).size).toBe(motifs.length)
  })

  it('gives every added motif complete Turkish teaching text with decimal commas', () => {
    for (const motif of added) {
      expect(motif.title.length, motif.id).toBeGreaterThan(10)
      for (const text of [motif.teaches, motif.look, motif.tryThis, motif.boundary]) expect(text.length, motif.id).toBeGreaterThan(40)
      expect(motif.teaches + motif.look + motif.tryThis + motif.boundary, motif.id).not.toMatch(/\d\.\d/)
      expect(new Set(motif.draft.links.map(item => item.id)).size).toBe(motif.draft.links.length)
    }
  })

  it('gives every motif an English twin with the same id, order, circuit and numbers', () => {
    const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(value => Number(value.replace(',', '.'))).sort((a, b) => a - b)
    expect(motifsEn.map(motif => motif.id)).toEqual(motifs.map(motif => motif.id))
    motifs.forEach((motif, index) => {
      const twin = motifsEn[index]!
      expect(Object.keys(twin)).toEqual(Object.keys(motif))
      expect(twin.draft).toBe(motif.draft)
      for (const key of ['title', 'teaches', 'look', 'tryThis', 'boundary'] as const) {
        expect(twin[key], `${motif.id}.${key}`).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
        expect(twin[key], `${motif.id}.${key}`).not.toMatch(/\d,\d/)
        expect(twin[key], `${motif.id}.${key}`).not.toBe(motif[key])
      }
      for (const key of ['teaches', 'look', 'tryThis', 'boundary'] as const) expect(numbers(twin[key]), `${motif.id}.${key}`).toEqual(numbers(motif[key]))
    })
  })

  it('keeps the limit sentence of every added motif in both languages', () => {
    const byId = (list: typeof motifs, id: string) => list.find(motif => motif.id === id)!
    expect(byId(motifs, 'divergence').boundary).toContain('gerçek bir aksonun dallarının eşit ilettiği anlamına gelmez')
    expect(byId(motifsEn, 'divergence').boundary).toContain('does not mean that the branches of a real axon transmit equally')
    expect(byId(motifs, 'convergence').boundary).toContain('bu basit kuraldan çıkarılamaz')
    expect(byId(motifsEn, 'convergence').boundary).toContain('cannot be inferred from this simple rule')
    expect(byId(motifs, 'feedback-inhibition').boundary).toContain('kendiliğinden süren bir salınım üretmez')
    expect(byId(motifsEn, 'feedback-inhibition').boundary).toContain('does not produce a self-sustained oscillation')
    expect(byId(motifsEn, 'feedback-inhibition').boundary).toContain('cannot be inferred from this toy model')
    expect(byId(motifs, 'electrical-pair').boundary).toContain('doğrultucu ya da hücre çiftine özgü davranışını içermez')
    expect(byId(motifsEn, 'electrical-pair').boundary).toContain('does not include the rectifying or cell-pair-specific behavior')
    expect(byId(motifs, 'disinhibition').boundary).toContain('bu oyuncak modelden çıkarılamaz')
    expect(byId(motifsEn, 'disinhibition').boundary).toContain('cannot be inferred from this toy model')
  })

  it('presetById finds every motif in the interface language', () => {
    for (const motif of motifs) expect(presetById(motif.id)).toBe(motif)
    locale.value = 'en'
    motifsEn.forEach(motif => expect(presetById(motif.id)).toBe(motif))
    expect(presetById('disinhibition').title).toBe('Inhibiting the inhibitor (disinhibition)')
  })

  it('every motif is valid, runs with finite numbers and dies out or persists as a whole number of cells', () => {
    for (const motif of motifs) {
      expect(validateDraft(motif.draft), motif.id).toEqual([])
      const result = run(motif.draft)
      result.result.timesMs.forEach((_, index) => cellIds(motif.draft.cellCount).forEach(id => expect(Number.isFinite(trace(result, id)[index]!)).toBe(true)))
    }
  })
})

describe('divergence: one cell drives two targets, each scaled by its own connection', () => {
  const base = run(presetById('divergence').draft)

  it('B and C peak at the same time and C is the scaled copy of B (0,5 / 0,9)', () => {
    expect(cell(base, 'B').peakTimeMs).toBe(cell(base, 'C').peakTimeMs)
    trace(base, 'B').forEach((value, index) => expect(trace(base, 'C')[index]!).toBeCloseTo(value * 0.5 / 0.9, 12))
    expect(cell(base, 'C').peak / cell(base, 'B').peak).toBeCloseTo(0.5 / 0.9, 12)
  })

  it('C reaches the 0,10 level later only because its trace is lower', () => {
    expect(cell(base, 'C').reachMs!).toBeGreaterThan(cell(base, 'B').reachMs!)
    expect(cell(base, 'C').peak).toBeLessThan(cell(base, 'B').peak)
  })

  it('removing A→C silences C and leaves the trace of B exactly as it was', () => {
    const pruned = run(without('divergence', link => link.target === 'C'))
    expect(cell(pruned, 'C').peak).toBe(0)
    expect(trace(pruned, 'B')).toEqual(trace(base, 'B'))
  })
})

describe('convergence: two paths sum at one target', () => {
  const base = run(presetById('convergence').draft)
  const onePath = run(without('convergence', link => link.source === 'C' && link.target === 'D'))

  it('the peak of D with both paths is twice its peak with one path', () => {
    expect(cell(base, 'D').peak).toBeGreaterThan(cell(onePath, 'D').peak)
    expect(cell(base, 'D').peak / cell(onePath, 'D').peak).toBeCloseTo(2, 10)
    // The numbers the text quotes: about 0,70 and about 0,35.
    expect(cell(base, 'D').peak).toBeCloseTo(0.70, 2)
    expect(cell(onePath, 'D').peak).toBeCloseTo(0.35, 2)
  })

  it('D, two steps away, peaks after B and C', () => {
    expect(cell(base, 'B').peakTimeMs).toBe(cell(base, 'C').peakTimeMs)
    expect(cell(base, 'D').peakTimeMs!).toBeGreaterThan(cell(base, 'B').peakTimeMs!)
  })

  it('the sum stays inside the 0–1 range, so nothing is clipped in this motif', () => {
    const [b, c] = [trace(base, 'B'), trace(base, 'C')]
    b.forEach((value, index) => expect(0.5 * value + 0.5 * c[index]!).toBeLessThan(1))
  })
})

describe('feedback inhibition: the cell limits its own response', () => {
  const base = run(presetById('feedback-inhibition').draft)
  const open = run(without('feedback-inhibition', link => link.type === 'inhibitory'))
  const pulseEnd = 300

  it('A peaks early, while the stimulus is on (about 130 ms), then sits clearly lower at 300 ms', () => {
    expect(cell(base, 'A').peakTimeMs!).toBeGreaterThan(125)
    expect(cell(base, 'A').peakTimeMs!).toBeLessThan(135)
    expect(at(base, 'A', pulseEnd)).toBeLessThan(0.7 * cell(base, 'A').peak)
    expect(at(base, 'A', pulseEnd)).toBeGreaterThan(0.1)
  })

  it('B peaks after A', () => {
    expect(cell(base, 'B').peakTimeMs!).toBeGreaterThan(cell(base, 'A').peakTimeMs!)
  })

  it('without the inhibitory connection A keeps rising to 300 ms and its peak is about 2 times as high', () => {
    expect(cell(open, 'A').peakTimeMs).toBe(pulseEnd)
    const ratio = cell(open, 'A').peak / cell(base, 'A').peak
    expect(ratio).toBeGreaterThan(1.9)
    expect(ratio).toBeLessThan(2.3)
  })

  it('the ripple is damped and nothing oscillates on its own: flat late in the pulse, gone at the end', () => {
    const late = trace(base, 'A').slice(230, 301)
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(0.01)
    for (const id of ['A', 'B'] as const) {
      expect(cell(base, id).finalValue).toBeLessThan(0.001)
      // After the pulse the activity only falls.
      const after = trace(base, id).slice(330)
      after.forEach((value, index) => { if (index) expect(value).toBeLessThanOrEqual(after[index - 1]!) })
    }
  })
})

describe('electrically coupled pair: the gap shares activity', () => {
  const base = run(presetById('electrical-pair').draft)
  const alone = run(without('electrical-pair', () => true))

  it('B rises although only A is stimulated, and never passes A', () => {
    expect(cell(alone, 'B').peak).toBe(0)
    expect(cell(base, 'B').peak).toBeGreaterThan(0.15)
    trace(base, 'B').forEach((value, index) => expect(value).toBeLessThanOrEqual(trace(base, 'A')[index]!))
  })

  it('what A loses is in B: at every moment the two traces sum to the trace of A alone', () => {
    trace(alone, 'A').forEach((value, index) => expect(trace(base, 'A')[index]! + trace(base, 'B')[index]!).toBeCloseTo(value, 12))
    // The numbers the text quotes: about 0,80 alone, 0,60 with the gap.
    expect(cell(alone, 'A').peak).toBeCloseTo(0.80, 2)
    expect(cell(base, 'A').peak).toBeCloseTo(0.60, 2)
  })

  it('at strength 1 B reaches half of the peak of A instead of one third, and still does not catch up', () => {
    expect(cell(base, 'B').peak / cell(base, 'A').peak).toBeCloseTo(1 / 3, 2)
    const strong = cloneDraft(presetById('electrical-pair').draft)
    strong.links[0]!.strength = 1
    const result = run(strong)
    expect(cell(result, 'B').peak / cell(result, 'A').peak).toBeCloseTo(1 / 2, 2)
    expect(cell(result, 'B').peak).toBeLessThan(cell(result, 'A').peak)
  })
})

describe('disinhibition: inhibiting the inhibitor releases the target', () => {
  const base = run(presetById('disinhibition').draft)
  const held = run(without('disinhibition', link => link.source === 'D' && link.target === 'B'))

  it('the peak of C is higher with D inhibiting B than without it (about 0,71 against about 0,22)', () => {
    expect(cell(base, 'C').peak).toBeGreaterThan(3 * cell(held, 'C').peak)
    expect(cell(base, 'C').peak).toBeCloseTo(0.71, 2)
    expect(cell(held, 'C').peak).toBeCloseTo(0.22, 2)
  })

  it('B falls silent after a brief rise once D is active; without D it stays high', () => {
    expect(cell(base, 'B').peak).toBeGreaterThan(0.1)
    expect(cell(base, 'B').peakTimeMs!).toBeLessThan(160)
    expect(at(base, 'B', 300)).toBeLessThan(0.01)
    expect(at(held, 'B', 300)).toBeGreaterThan(0.7)
  })

  it('C rises almost uninhibited: close to what it reaches with no inhibition at all', () => {
    const free = run(without('disinhibition', link => link.type === 'inhibitory'))
    expect(cell(free, 'C').peak - cell(base, 'C').peak).toBeLessThan(0.01)
  })
})
