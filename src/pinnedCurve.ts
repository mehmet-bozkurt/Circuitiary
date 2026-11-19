import type { ShareField, ShareState } from './shareState'
import { resolveProtocol } from './stimulusProtocol'

/**
 * One curve kept on the chart while the learner changes the experiment ("pin and compare").
 * It is a record of what was computed at the moment of pinning: it is never recomputed, and it
 * stays out of the share link and the exported files.
 */
export interface PinnedCurve {
  condition: ShareState['activeCondition']
  /** The cell whose activity the curve shows. */
  output: string
  timesMs: readonly number[]
  values: readonly number[]
  /** Largest value over all recorded samples. */
  peak: number
  /** Every setting that defined the experiment when the curve was pinned. */
  settings: ShareState
}

const beforeStimulusProtocol: ShareField[] = ['activeCondition', 'outputNeuron', 'stimulusTarget', 'amplitude', 'pulseDuration']
const afterStimulusProtocol: ShareField[] = ['baseTau', 'dt']
const silencedOnly: ShareField[] = ['selectedEdge']
const tauOnly: ShareField[] = ['changedNeuron', 'changedTau']
const realOnly: ShareField[] = ['chemicalGain', 'gapGain']

/**
 * The settings that differ between the pinned curve and the curve shown now, in a fixed order.
 * Only settings that can change one of the two curves are listed: the silenced connection counts
 * when either curve is the "connection silenced" condition, the changed cell and its time constant
 * when either is the "time constant changed" condition, and the two gains only with real data.
 * Of the stimulus protocol, the shape and the noise amplitude always count; the sine period only when
 * either curve used the sine, and the noise seed only when either curve had noise on. A record without
 * protocol fields means the defaults (see stimulusProtocol.ts).
 * Viewing choices (2D/3D, selected cell, focus, vertical scale) never change a curve.
 */
export function changedSettings(pinned: ShareState, current: ShareState): ShareField[] {
  const protocolBefore = resolveProtocol(pinned)
  const protocolNow = resolveProtocol(current)
  const before: ShareState = { ...pinned, ...protocolBefore }
  const now: ShareState = { ...current, ...protocolNow }
  const conditions = [before.activeCondition, now.activeCondition]
  const usesSine = protocolBefore.stimulusShape === 'sine' || protocolNow.stimulusShape === 'sine'
  const usesNoise = protocolBefore.noiseAmplitude > 0 || protocolNow.noiseAmplitude > 0
  const fields: ShareField[] = [
    ...beforeStimulusProtocol,
    'stimulusShape',
    ...(usesSine ? ['sinePeriod' as const] : []),
    'noiseAmplitude',
    ...(usesNoise ? ['noiseSeed' as const] : []),
    ...afterStimulusProtocol,
    ...(conditions.includes('silenced') ? silencedOnly : []),
    ...(conditions.includes('tau') ? tauOnly : []),
    ...(now.mode === 'real' ? realOnly : []),
  ]
  return fields.filter(field => before[field] !== now[field])
}
