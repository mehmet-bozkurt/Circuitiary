import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, locale } from '../i18n'
import { blankDraft, cloneDraft, presetById, runDraft, type BuilderDraft, type BuilderRun, type CellId, type CellSummary } from './circuitBuilder'
import { PEAK_TIE_TOLERANCE, comparePrediction, noPrediction, predictionFeedback, predictionRules, samePrediction, type BuilderPrediction } from './builderPrediction'

afterEach(() => { locale.value = DEFAULT_LOCALE })

const run = (draft: BuilderDraft): BuilderRun => {
  const outcome = runDraft(draft)
  if (!outcome.ok) throw new Error(outcome.problems.map(problem => problem.message).join(' | '))
  return outcome.run
}
/** A real run whose per-cell summary is replaced, to place peaks and final values exactly. */
const withCells = (cells: Array<[CellId, number, number]>): BuilderRun => {
  const base = run({ ...blankDraft(), cellCount: cells.length })
  return { ...base, cells: cells.map(([id, peak, finalValue]): CellSummary => ({ id, peak, peakTimeMs: peak > 0 ? 300 : null, reachMs: null, finalValue })) }
}
const chain = run(presetById('chain').draft)
const loop = run(presetById('loop').draft)
const feedbackInhibition = run(presetById('feedback-inhibition').draft)
const text = (prediction: BuilderPrediction, result: BuilderRun) => predictionFeedback(prediction, result).map(line => line.text)

describe('comparing a prediction with a run', () => {
  it('nothing predicted: both verdicts are none and there is no feedback line', () => {
    const comparison = comparePrediction(noPrediction(), chain)
    expect(comparison.peak.verdict).toBe('none')
    expect(comparison.end.verdict).toBe('none')
    expect(comparison.peak.predicted).toBeNull()
    expect(comparison.end.predicted).toBeNull()
    // The run is still read in full.
    expect(comparison.peak.stimulated).toBe('A')
    expect(comparison.peak.top).toEqual(['B'])
    expect(comparison.end.observed).toBe('fades')
    expect(predictionFeedback(noPrediction(), chain)).toEqual([])
  })

  it('leaves the stimulated cell out: the highest peak is the highest among the other cells', () => {
    // In the chain A (stimulated) has the highest peak of all; the question is about B and C.
    expect(Math.max(...chain.cells.map(cell => cell.peak))).toBe(chain.cells[0]!.peak)
    const comparison = comparePrediction({ peak: 'B', end: '' }, chain)
    expect(comparison.peak).toMatchObject({ verdict: 'agree', predicted: 'B', stimulated: 'A', top: ['B'] })
    expect(comparison.peak.value).toBe(chain.cells[1]!.peak)
    expect(comparison.peak.value).toBeLessThan(chain.cells[0]!.peak)
    // Another stimulated cell, another set of cells: with B stimulated, the question is about A and C, and only C is downstream.
    const fromB = cloneDraft(presetById('chain').draft)
    fromB.stimulus = { ...fromB.stimulus, target: 'B' }
    expect(comparePrediction({ peak: 'C', end: '' }, run(fromB)).peak).toMatchObject({ verdict: 'agree', stimulated: 'B', top: ['C'] })
    expect(comparePrediction({ peak: 'A', end: '' }, run(fromB)).peak).toMatchObject({ verdict: 'disagree', top: ['C'] })
    // Even when it is far above every other cell, the stimulated cell never enters a tie.
    const high = withCells([['A', 0.9, 0], ['B', 0.899, 0], ['C', 0.3, 0]])
    expect(comparePrediction({ peak: 'C', end: '' }, high).peak).toMatchObject({ verdict: 'disagree', top: ['B'], value: 0.899 })
  })

  it('a prediction naming the stimulated cell of the record is no prediction about it', () => {
    expect(comparePrediction({ peak: 'A', end: '' }, chain).peak).toMatchObject({ verdict: 'none', predicted: null })
    expect(predictionFeedback({ peak: 'A', end: '' }, chain)).toEqual([])
    expect(text({ peak: 'A', end: 'fades' }, chain)[0]).toBe('Uyarılan hücre dışındaki en yüksek tepe sorusuna tahmin eklenmedi.')
  })

  it('agree: the predicted cell has the highest peak apart from the stimulated cell, and the predicted end is what the run shows', () => {
    const comparison = comparePrediction({ peak: 'B', end: 'fades' }, chain)
    expect(comparison.peak).toMatchObject({ verdict: 'agree', predicted: 'B', top: ['B'] })
    expect(comparison.peak.value).toBeCloseTo(0.714, 3)
    expect(comparison.end).toMatchObject({ verdict: 'agree', predicted: 'fades', observed: 'fades', lasting: [], responded: true, stimulus: 'ended' })
    expect(text({ peak: 'B', end: 'fades' }, chain)).toEqual([
      'Uyarılan hücre dışında en yüksek tepe için tahminin: B hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,714. Tahmin ile hesap örtüşüyor.',
      'Kaydın sonu için tahminin: etkinlik söner. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş. Tahmin ile hesap örtüşüyor.',
    ])
  })

  it('disagree: another cell peaks highest, and the activity does not end as predicted', () => {
    const comparison = comparePrediction({ peak: 'C', end: 'persists' }, chain)
    expect(comparison.peak).toMatchObject({ verdict: 'disagree', predicted: 'C', top: ['B'] })
    expect(comparison.end).toMatchObject({ verdict: 'disagree', predicted: 'persists', observed: 'fades' })
    expect(text({ peak: 'C', end: 'persists' }, chain)).toEqual([
      'Uyarılan hücre dışında en yüksek tepe için tahminin: C hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,714. Tahmin ile hesap farklı.',
      'Kaydın sonu için tahminin: etkinlik sürer. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş. Tahmin ile hesap farklı.',
    ])
    expect(comparePrediction({ peak: 'B', end: 'fades' }, loop).end).toMatchObject({ verdict: 'disagree', observed: 'persists', lasting: ['A', 'B', 'C'] })
    // The only other cell of a two-cell circuit is the answer whenever it responds.
    expect(comparePrediction({ peak: 'B', end: '' }, feedbackInhibition).peak).toMatchObject({ verdict: 'agree', top: ['B'] })
  })

  it('persisting activity agrees with “persists” and names the cells', () => {
    const lines = predictionFeedback({ peak: '', end: 'persists' }, loop)
    expect(lines.map(line => line.verdict)).toEqual(['none', 'agree'])
    expect(lines[0]!.text).toBe('Uyarılan hücre dışındaki en yüksek tepe sorusuna tahmin eklenmedi.')
    expect(lines[1]!.text).toBe('Kaydın sonu için tahminin: etkinlik sürer. Hesapta 700 ms’de A, B ve C hücrelerinin aktivitesi 0,10 düzeyinde ya da üstünde: etkinlik sürüyor. Tahmin ile hesap örtüşüyor.')
  })

  it('tie: cells within the stated tolerance share the highest peak, and naming any of them agrees', () => {
    expect(PEAK_TIE_TOLERANCE).toBe(0.005)
    const tied = withCells([['A', 0.9, 0], ['B', 0.7, 0], ['C', 0.696, 0], ['D', 0.694, 0], ['E', 0.2, 0]])
    for (const id of ['B', 'C'] as const) {
      const comparison = comparePrediction({ peak: id, end: '' }, tied)
      expect(comparison.peak.verdict, id).toBe('agree')
      expect(comparison.peak.top).toEqual(['B', 'C'])
      expect(comparison.peak.value).toBe(0.7)
    }
    // Just outside the tolerance, and far outside it.
    for (const id of ['D', 'E'] as const) expect(comparePrediction({ peak: id, end: '' }, tied).peak.verdict, id).toBe('disagree')
    expect(text({ peak: 'C', end: '' }, tied)[0]).toBe('Uyarılan hücre dışında en yüksek tepe için tahminin: C hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepeyi B ve C hücreleri paylaşıyor: en yükseği 0,700, aralarındaki fark 0,005 ya da daha az. Tahmin ettiğin hücre bu tepeyi paylaşanlardan biri: tahmin ile hesap örtüşüyor.')
    expect(text({ peak: 'E', end: '' }, tied)[0]).toBe('Uyarılan hücre dışında en yüksek tepe için tahminin: E hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepeyi B ve C hücreleri paylaşıyor: en yükseği 0,700, aralarındaki fark 0,005 ya da daha az. Tahmin ile hesap farklı.')
    // Exactly equal peaks are a tie too; exactly at the tolerance still counts.
    expect(comparePrediction({ peak: 'C', end: '' }, withCells([['A', 0.8, 0], ['B', 0.5, 0], ['C', 0.5, 0]])).peak).toMatchObject({ verdict: 'agree', top: ['B', 'C'] })
    expect(comparePrediction({ peak: 'C', end: '' }, withCells([['A', 0.8, 0], ['B', 0.5, 0], ['C', 0.495, 0]])).peak.verdict).toBe('agree')
  })

  it('a real run: in the loop example B and C are further apart than the tolerance, so only B is named', () => {
    const comparison = comparePrediction({ peak: 'C', end: '' }, loop)
    expect(comparison.peak.top).toEqual(['B'])
    expect(comparison.peak.verdict).toBe('disagree')
    // In the divergence motif driven equally, the two targets are an exact tie.
    const equal = cloneDraft(presetById('divergence').draft)
    equal.links[1]!.strength = equal.links[0]!.strength
    expect(comparePrediction({ peak: 'C', end: '' }, run(equal)).peak).toMatchObject({ verdict: 'agree', top: ['B', 'C'] })
  })

  it('a silent cell never shares a tiny highest peak', () => {
    const faint = withCells([['A', 0.5, 0], ['B', 0.003, 0], ['C', 0, 0]])
    expect(comparePrediction({ peak: 'C', end: '' }, faint).peak).toMatchObject({ verdict: 'disagree', top: ['B'] })
  })

  it('unsure: the run is described and no verdict is given', () => {
    const comparison = comparePrediction({ peak: 'unsure', end: 'unsure' }, chain)
    expect(comparison.peak.verdict).toBe('unsure')
    expect(comparison.end.verdict).toBe('unsure')
    expect(text({ peak: 'unsure', end: 'unsure' }, chain)).toEqual([
      'Uyarılan hücre dışında en yüksek tepe için “emin değilim” seçtin. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,714.',
      'Kaydın sonu için “emin değilim” seçtin. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş.',
    ])
  })

  it('no other cell responded: there is no peak to compare a cell with, even though the stimulated cell rose', () => {
    // No connections: only the stimulated cell responds.
    const alone = run(blankDraft())
    expect(alone.cells[0]!.peak).toBeGreaterThan(0.7)
    const comparison = comparePrediction({ peak: 'B', end: 'fades' }, alone)
    expect(comparison.peak).toMatchObject({ verdict: 'no-response', predicted: 'B', top: [], value: 0 })
    expect(comparison.end).toMatchObject({ verdict: 'agree', observed: 'fades', responded: true })
    expect(text({ peak: 'B', end: 'fades' }, alone)).toEqual([
      'Uyarılan hücre dışında en yüksek tepe için tahminin: B hücresi. Hesapta uyarılan hücre (A) dışında hiçbir hücre yanıt vermedi; karşılaştırılacak bir tepe yok. Bu yüzden tahmin ne örtüşüyor ne de farklı.',
      'Kaydın sonu için tahminin: etkinlik söner. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş. Tahmin ile hesap örtüşüyor.',
    ])
    expect(comparePrediction({ peak: 'unsure', end: '' }, alone).peak.verdict).toBe('unsure')
    expect(text({ peak: 'unsure', end: '' }, alone)[0]).toBe('Uyarılan hücre dışında en yüksek tepe için “emin değilim” seçtin. Hesapta uyarılan hücre (A) dışında hiçbir hücre yanıt vermedi; karşılaştırılacak bir tepe yok.')
    // With no stimulus at all nothing rises, the stimulated cell included.
    const silent = run({ ...blankDraft(), stimulus: { ...blankDraft().stimulus, amplitude: 0 } })
    expect(comparePrediction({ peak: 'C', end: 'fades' }, silent).peak.verdict).toBe('no-response')
    expect(comparePrediction({ peak: 'C', end: 'fades' }, silent).end).toMatchObject({ verdict: 'agree', responded: false })
    expect(text({ peak: 'C', end: 'fades' }, silent)[1]).toBe('Kaydın sonu için tahminin: etkinlik söner. Hesapta hiçbir hücre yanıt vermedi; 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında. Tahmin ile hesap örtüşüyor.')
  })

  it('a predicted cell that is not in the recorded circuit is no prediction about it', () => {
    const pair = run(presetById('electrical-pair').draft)
    expect(comparePrediction({ peak: 'D', end: '' }, pair).peak).toMatchObject({ verdict: 'none', predicted: null })
    expect(predictionFeedback({ peak: 'D', end: '' }, pair)).toEqual([])
  })

  it('says when the end of the record is too close to the stimulus to speak of lasting activity', () => {
    const late = cloneDraft(presetById('chain').draft)
    late.stimulus = { ...late.stimulus, onsetMs: 400, durationMs: 200 }
    const lateRun = run(late)
    expect(comparePrediction({ peak: '', end: 'persists' }, lateRun).end).toMatchObject({ verdict: 'agree', observed: 'persists', stimulus: 'late' })
    expect(text({ peak: '', end: 'persists' }, lateRun)[1]).toMatch(/Tahmin ile hesap örtüşüyor\. Uyaran 600 ms’de, kaydın sonuna \(700 ms\) yakın bitiyor; sondaki etkinlik henüz sönmekte olan yanıt olabilir\.$/)
    const on = cloneDraft(presetById('chain').draft)
    on.stimulus = { ...on.stimulus, onsetMs: 500, durationMs: 500 }
    const onRun = run(on)
    expect(comparePrediction({ peak: '', end: 'fades' }, onRun).end).toMatchObject({ verdict: 'disagree', stimulus: 'on' })
    expect(text({ peak: '', end: 'fades' }, onRun)[1]).toMatch(/Tahmin ile hesap farklı\. Kayıt 700 ms’de bittiğinde uyaran hâlâ açık; sondaki etkinlik uyaranın kendisinden geliyor olabilir\.$/)
    // 550 ms is exactly the settling time before the end: no remark.
    const settled = cloneDraft(presetById('chain').draft)
    settled.stimulus = { ...settled.stimulus, onsetMs: 350, durationMs: 200 }
    expect(comparePrediction({ peak: '', end: 'fades' }, run(settled)).end.stimulus).toBe('ended')
  })

  it('is pure: the same prediction and run give the same answer, and neither is changed', () => {
    const prediction: BuilderPrediction = { peak: 'B', end: 'persists' }
    const before = JSON.stringify([prediction, chain.cells, chain.draft])
    expect(comparePrediction(prediction, chain)).toEqual(comparePrediction(prediction, chain))
    expect(JSON.stringify([prediction, chain.cells, chain.draft])).toBe(before)
  })
})

describe('prediction text', () => {
  it('compares two predictions by their ids', () => {
    expect(samePrediction(noPrediction(), { peak: '', end: '' })).toBe(true)
    expect(samePrediction({ peak: 'A', end: '' }, { peak: 'B', end: '' })).toBe(false)
    expect(samePrediction({ peak: 'A', end: 'fades' }, { peak: 'A', end: 'unsure' })).toBe(false)
  })

  it('states the rules with the level, the record length and the tolerance, in both languages', () => {
    expect(predictionRules()).toContain('(700 ms)')
    expect(predictionRules()).toContain('0,10 düzeyinde ya da üstünde')
    expect(predictionRules()).toContain('Tepe sorusu uyarılan hücreyi saymaz')
    expect(predictionRules()).toContain('uyarılan hücre dışındaki en yüksek tepeden en çok 0,005 düşük')
    locale.value = 'en'
    expect(predictionRules()).toContain('at or above the 0.10 level')
    expect(predictionRules()).toContain('The peak question does not count the stimulated cell')
    expect(predictionRules()).toContain('at most 0.005 below the highest peak apart from the stimulated cell')
    expect(predictionRules()).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
  })

  it('writes a recorded prediction in English after a language change, without praise or blame', () => {
    const cases: Array<[BuilderPrediction, BuilderRun]> = [
      [{ peak: 'B', end: 'fades' }, chain], [{ peak: 'C', end: 'persists' }, chain], [{ peak: 'unsure', end: 'unsure' }, loop],
      [{ peak: 'B', end: 'persists' }, loop], [{ peak: 'C', end: '' }, withCells([['A', 0.9, 0.2], ['B', 0.7, 0], ['C', 0.699, 0]])], [{ peak: '', end: 'fades' }, chain],
      [{ peak: 'B', end: 'fades' }, run({ ...blankDraft(), stimulus: { ...blankDraft().stimulus, amplitude: 0 } })],
      [{ peak: 'B', end: 'fades' }, run({ ...blankDraft(), stimulus: { ...blankDraft().stimulus, onsetMs: 500, durationMs: 500 } })],
      [{ peak: 'B', end: 'fades' }, run({ ...blankDraft(), stimulus: { ...blankDraft().stimulus, onsetMs: 400, durationMs: 200 } })],
    ]
    const turkish = cases.map(([prediction, result]) => text(prediction, result))
    for (const lines of turkish) for (const line of lines) expect(line).not.toMatch(/\d\.\d/)
    locale.value = 'en'
    cases.forEach(([prediction, result], index) => {
      const lines = text(prediction, result)
      expect(lines).toHaveLength(turkish[index]!.length)
      lines.forEach((line, at) => {
        expect(line).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
        expect(line).not.toMatch(/\d,\d/)
        expect(line).not.toBe(turkish[index]![at])
        expect(line).not.toMatch(/correct|wrong|well done|right|mistake|good|bad/i)
      })
    })
    expect(text({ peak: 'C', end: 'persists' }, chain)).toEqual([
      'Your prediction for the highest peak apart from the stimulated cell: cell C. In the calculation, apart from the stimulated cell (A), the highest peak is in cell B: 0.714. The prediction and the calculation differ.',
      'Your prediction for the end of the record: the activity persists. In the calculation, at 700 ms the activity of all cells is below the 0.10 level: the activity has died out. The prediction and the calculation differ.',
    ])
    expect(text({ peak: 'C', end: 'persists' }, withCells([['A', 0.9, 0.2], ['B', 0.7, 0], ['C', 0.699, 0]]))).toEqual([
      'Your prediction for the highest peak apart from the stimulated cell: cell C. In the calculation, apart from the stimulated cell (A), cells B and C share the highest peak: the highest is 0.700, and they differ by 0.005 or less. The cell you predicted is one of those sharing that peak: the prediction and the calculation agree.',
      'Your prediction for the end of the record: the activity persists. In the calculation, at 700 ms the activity of cell A is at or above the 0.10 level: the activity persists. The prediction and the calculation agree.',
    ])
    expect(text({ peak: 'B', end: '' }, run(blankDraft()))[0]).toBe('Your prediction for the highest peak apart from the stimulated cell: cell B. In the calculation no cell apart from the stimulated cell (A) responded; there is no peak to compare with. So the prediction neither agrees nor differs.')
  })
})
