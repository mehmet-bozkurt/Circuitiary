import { decimal } from '../format'
import { defineMessages, pick } from '../i18n'
import { defaultConfig } from '../model/circuit'
import { REPORT_LEVEL, SETTLE_MS, joinIds, type BuilderRun, type CellId } from './circuitBuilder'

/**
 * The optional prediction of the builder page: two questions the run answers from its own numbers.
 * The peak question is about the cells other than the stimulated one: the stimulated cell takes the pulse
 * directly and has the highest peak in almost every circuit, so asking about it would teach nothing.
 * A prediction is stored as ids ('' = none); sentences are written when they are rendered, so a recorded
 * prediction follows a later language change. Nothing here is a score.
 */
export type PeakChoice = '' | 'unsure' | CellId
export type EndChoice = '' | 'unsure' | 'fades' | 'persists'
export interface BuilderPrediction { peak: PeakChoice; end: EndChoice }
export const noPrediction = (): BuilderPrediction => ({ peak: '', end: '' })
export const samePrediction = (a: BuilderPrediction, b: BuilderPrediction): boolean => a.peak === b.peak && a.end === b.end

/**
 * Cells (other than the stimulated one) whose peak is at most this far below the highest of their peaks share
 * it: a prediction naming any of them agrees with the run. The table shows three decimals, so smaller
 * differences are hardly visible there.
 */
export const PEAK_TIE_TOLERANCE = 0.005

export type Verdict = 'none' | 'unsure' | 'agree' | 'disagree'
export interface PredictionComparison {
  peak: {
    /** 'no-response': a cell was predicted but no cell other than the stimulated one rose above 0, so there is no peak to compare with. */
    verdict: Verdict | 'no-response'
    predicted: CellId | null
    /** The stimulated cell of the recorded run: left out of the comparison. */
    stimulated: CellId
    /** The cells sharing the highest peak among the others, in cell order; empty when none of them responded. */
    top: CellId[]
    /** That highest peak: the highest among the cells other than the stimulated one. */
    value: number
  }
  end: {
    verdict: Verdict
    predicted: 'fades' | 'persists' | null
    /** 'persists': at the last recorded sample at least one cell is at or above the reporting level. */
    observed: 'fades' | 'persists'
    lasting: CellId[]
    /** False when every peak is 0, the stimulated cell's too: nothing rose, so nothing could fade. */
    responded: boolean
    /** Where the pulse ends relative to the record: long before its end, less than the settling time before it, or not at all. */
    stimulus: 'ended' | 'late' | 'on'
  }
}

type Recorded = Pick<BuilderRun, 'draft' | 'cells' | 'result'>

/** Compares a prediction with a recorded run. Pure: the same prediction and run always give the same answer. */
export function comparePrediction(prediction: BuilderPrediction, run: Recorded): PredictionComparison {
  const stimulated = run.draft.stimulus.target
  const others = run.cells.filter(cell => cell.id !== stimulated)
  const value = Math.max(0, ...others.map(cell => cell.peak))
  const top = value > 0 ? others.filter(cell => cell.peak > 0 && cell.peak >= value - PEAK_TIE_TOLERANCE).map(cell => cell.id) : []
  // Only another cell of the recorded circuit can have been a prediction about it: not the stimulated cell, not a cell that is not there.
  const cell = prediction.peak !== '' && prediction.peak !== 'unsure' && others.some(item => item.id === prediction.peak) ? prediction.peak : null
  const peakVerdict = prediction.peak === 'unsure' ? 'unsure' : cell === null ? 'none' : !top.length ? 'no-response' : top.includes(cell) ? 'agree' : 'disagree'

  const lasting = run.cells.filter(item => item.finalValue >= REPORT_LEVEL).map(item => item.id)
  const observed = lasting.length ? 'persists' : 'fades'
  const predictedEnd = prediction.end === 'fades' || prediction.end === 'persists' ? prediction.end : null
  const endVerdict = prediction.end === 'unsure' ? 'unsure' : predictedEnd === null ? 'none' : predictedEnd === observed ? 'agree' : 'disagree'
  const pulseEnd = run.draft.stimulus.onsetMs + run.draft.stimulus.durationMs
  const durationMs = run.result.settings.durationMs
  return {
    peak: { verdict: peakVerdict, predicted: cell, stimulated, top, value },
    end: {
      verdict: endVerdict, predicted: predictedEnd, observed, lasting, responded: run.cells.some(item => item.peak > 0),
      stimulus: pulseEnd >= durationMs ? 'on' : pulseEnd + SETTLE_MS > durationMs ? 'late' : 'ended',
    },
  }
}

const text = defineMessages({
  tr: {
    rules: (duration: string, level: string, tolerance: string) =>
      `“Sürer”: kaydın son anında (${duration} ms) en az bir hücrenin aktivitesi ${level} düzeyinde ya da üstünde. “Söner”: hepsi bu düzeyin altında. Tepe sorusu uyarılan hücreyi saymaz: darbeyi doğrudan o alır. Tepesi, uyarılan hücre dışındaki en yüksek tepeden en çok ${tolerance} düşük olan hücreler o tepeyi paylaşmış sayılır; tahmin ettiğin hücre onlardan biriyse tahmin hesapla örtüşür.`,
    peakPredicted: (id: string) => `Uyarılan hücre dışında en yüksek tepe için tahminin: ${id} hücresi.`,
    peakUnsure: 'Uyarılan hücre dışında en yüksek tepe için “emin değilim” seçtin.',
    peakNone: 'Uyarılan hücre dışındaki en yüksek tepe sorusuna tahmin eklenmedi.',
    peakObserved: (stimulated: string, id: string, peak: string) => `Hesapta uyarılan hücre (${stimulated}) dışında en yüksek tepe ${id} hücresinde: ${peak}.`,
    peakShared: (stimulated: string, ids: string, peak: string, tolerance: string) => `Hesapta uyarılan hücre (${stimulated}) dışında en yüksek tepeyi ${ids} hücreleri paylaşıyor: en yükseği ${peak}, aralarındaki fark ${tolerance} ya da daha az.`,
    peakNoResponse: (stimulated: string) => `Hesapta uyarılan hücre (${stimulated}) dışında hiçbir hücre yanıt vermedi; karşılaştırılacak bir tepe yok.`,
    endPredicted: (persists: boolean) => `Kaydın sonu için tahminin: etkinlik ${persists ? 'sürer' : 'söner'}.`,
    endUnsure: 'Kaydın sonu için “emin değilim” seçtin.',
    endNone: 'Kaydın sonu sorusuna tahmin eklenmedi.',
    endPersists: (duration: string, ids: string, many: boolean, level: string) => `Hesapta ${duration} ms’de ${ids} hücre${many ? 'lerinin' : 'sinin'} aktivitesi ${level} düzeyinde ya da üstünde: etkinlik sürüyor.`,
    endFades: (duration: string, level: string) => `Hesapta ${duration} ms’de bütün hücrelerin aktivitesi ${level} düzeyinin altında: etkinlik sönmüş.`,
    endSilent: (duration: string, level: string) => `Hesapta hiçbir hücre yanıt vermedi; ${duration} ms’de bütün hücrelerin aktivitesi ${level} düzeyinin altında.`,
    stimulusOn: (duration: string) => `Kayıt ${duration} ms’de bittiğinde uyaran hâlâ açık; sondaki etkinlik uyaranın kendisinden geliyor olabilir.`,
    stimulusLate: (end: string, duration: string) => `Uyaran ${end} ms’de, kaydın sonuna (${duration} ms) yakın bitiyor; sondaki etkinlik henüz sönmekte olan yanıt olabilir.`,
    agree: 'Tahmin ile hesap örtüşüyor.',
    agreeShared: 'Tahmin ettiğin hücre bu tepeyi paylaşanlardan biri: tahmin ile hesap örtüşüyor.',
    disagree: 'Tahmin ile hesap farklı.',
    noComparison: 'Bu yüzden tahmin ne örtüşüyor ne de farklı.',
  },
  en: {
    rules: (duration: string, level: string, tolerance: string) =>
      `“Persists”: at the last moment of the record (${duration} ms) the activity of at least one cell is at or above the ${level} level. “Dies out”: all are below that level. The peak question does not count the stimulated cell: it takes the pulse directly. Cells whose peak is at most ${tolerance} below the highest peak apart from the stimulated cell count as sharing that peak; if the cell you predicted is one of them, the prediction agrees with the calculation.`,
    peakPredicted: (id: string) => `Your prediction for the highest peak apart from the stimulated cell: cell ${id}.`,
    peakUnsure: 'For the highest peak apart from the stimulated cell you chose “I’m not sure”.',
    peakNone: 'No prediction was added for the question about the highest peak apart from the stimulated cell.',
    peakObserved: (stimulated: string, id: string, peak: string) => `In the calculation, apart from the stimulated cell (${stimulated}), the highest peak is in cell ${id}: ${peak}.`,
    peakShared: (stimulated: string, ids: string, peak: string, tolerance: string) => `In the calculation, apart from the stimulated cell (${stimulated}), cells ${ids} share the highest peak: the highest is ${peak}, and they differ by ${tolerance} or less.`,
    peakNoResponse: (stimulated: string) => `In the calculation no cell apart from the stimulated cell (${stimulated}) responded; there is no peak to compare with.`,
    endPredicted: (persists: boolean) => `Your prediction for the end of the record: the activity ${persists ? 'persists' : 'dies out'}.`,
    endUnsure: 'For the end of the record you chose “I’m not sure”.',
    endNone: 'No prediction was added for the end-of-record question.',
    endPersists: (duration: string, ids: string, many: boolean, level: string) => `In the calculation, at ${duration} ms the activity of ${many ? 'cells' : 'cell'} ${ids} is at or above the ${level} level: the activity persists.`,
    endFades: (duration: string, level: string) => `In the calculation, at ${duration} ms the activity of all cells is below the ${level} level: the activity has died out.`,
    endSilent: (duration: string, level: string) => `In the calculation no cell responded; at ${duration} ms the activity of all cells is below the ${level} level.`,
    stimulusOn: (duration: string) => `When the record ends at ${duration} ms the stimulus is still on; the activity at the end may come from the stimulus itself.`,
    stimulusLate: (end: string, duration: string) => `The stimulus ends at ${end} ms, close to the end of the record (${duration} ms); the activity at the end may be a response that is still dying out.`,
    agree: 'The prediction and the calculation agree.',
    agreeShared: 'The cell you predicted is one of those sharing that peak: the prediction and the calculation agree.',
    disagree: 'The prediction and the calculation differ.',
    noComparison: 'So the prediction neither agrees nor differs.',
  },
})

/** What the two option words and a shared highest peak mean, in the interface language. Call it while rendering. */
export const predictionRules = (): string =>
  pick(text).rules(decimal(defaultConfig.durationMs, 0), decimal(REPORT_LEVEL, 2), decimal(PEAK_TIE_TOLERANCE, 3))

export interface FeedbackLine { question: 'peak' | 'end'; verdict: Verdict | 'no-response'; text: string }

/**
 * One line per question, in the interface language: what was predicted, what the run showed, whether they
 * agree. No praise and no blame. Empty when nothing was predicted; the page then says only that.
 */
export function predictionFeedback(prediction: BuilderPrediction, run: Recorded): FeedbackLine[] {
  const t = pick(text)
  const { peak, end } = comparePrediction(prediction, run)
  if (peak.verdict === 'none' && end.verdict === 'none') return []
  const duration = decimal(run.result.settings.durationMs, 0)
  const level = decimal(REPORT_LEVEL, 2)

  const peakParts: string[] = []
  if (peak.verdict === 'none') peakParts.push(t.peakNone)
  else {
    peakParts.push(peak.verdict === 'unsure' ? t.peakUnsure : t.peakPredicted(peak.predicted!))
    peakParts.push(!peak.top.length ? t.peakNoResponse(peak.stimulated)
      : peak.top.length === 1 ? t.peakObserved(peak.stimulated, peak.top[0]!, decimal(peak.value, 3))
        : t.peakShared(peak.stimulated, joinIds(peak.top), decimal(peak.value, 3), decimal(PEAK_TIE_TOLERANCE, 3)))
    if (peak.verdict === 'agree') peakParts.push(peak.top.length > 1 ? t.agreeShared : t.agree)
    if (peak.verdict === 'disagree') peakParts.push(t.disagree)
    if (peak.verdict === 'no-response') peakParts.push(t.noComparison)
  }

  const endParts: string[] = []
  if (end.verdict === 'none') endParts.push(t.endNone)
  else {
    endParts.push(end.verdict === 'unsure' ? t.endUnsure : t.endPredicted(end.predicted === 'persists'))
    endParts.push(!end.responded ? t.endSilent(duration, level)
      : end.observed === 'persists' ? t.endPersists(duration, joinIds(end.lasting), end.lasting.length > 1, level)
        : t.endFades(duration, level))
    if (end.verdict === 'agree') endParts.push(t.agree)
    if (end.verdict === 'disagree') endParts.push(t.disagree)
    if (end.responded && end.stimulus === 'on') endParts.push(t.stimulusOn(duration))
    if (end.responded && end.stimulus === 'late') endParts.push(t.stimulusLate(decimal(run.draft.stimulus.onsetMs + run.draft.stimulus.durationMs, 0), duration))
  }
  return [
    { question: 'peak', verdict: peak.verdict, text: peakParts.join(' ') },
    { question: 'end', verdict: end.verdict, text: endParts.join(' ') },
  ]
}
