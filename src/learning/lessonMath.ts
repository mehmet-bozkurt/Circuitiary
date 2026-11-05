/**
 * Schematic teaching models, not measured neuron physiology.
 * Activity, input, weights, and time are dimensionless. The single-event shape,
 * signs, tonic input, and rate constants below are explicit lesson assumptions.
 */

export type Series = { times: number[]; values: number[] }

function unitInput(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number in [0, 1].`)
  }
}

function clipActivity(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * One schematic all-or-none event. Crossing the scalar threshold selects the
 * same response shape and peak; it does not model spike trains or firing rate.
 * Zero input never triggers an event, including when the threshold is zero.
 */
export function thresholdLesson(stimulus: number, threshold: number): {
  fired: boolean
  peak: number
  trace: Series
} {
  unitInput(stimulus, 'stimulus')
  unitInput(threshold, 'threshold')
  const fired = stimulus > 0 && stimulus >= threshold
  const peak = fired ? 1 : stimulus
  const times = Array.from({ length: 121 }, (_, index) => index * 0.025)
  const values = times.map(time => {
    if (time <= 1 || time >= 2) return 0
    // A smooth single hump is a drawing convention, not an action-potential fit.
    const shape = Math.sin(Math.PI * (time - 1)) ** 2
    return peak * shape
  })
  return { fired, peak, trace: { times, values } }
}

/** Assigned positive and negative model signs, not transmitter-derived effects. */
export function chemicalLesson(excitation: number, inhibition: number): {
  drive: number
  activity: number
} {
  unitInput(excitation, 'excitation')
  unitInput(inhibition, 'inhibition')
  const drive = excitation - inhibition
  return { drive, activity: clipActivity(drive) }
}

/**
 * Reciprocal, symmetric, passive coupling without leak, external drive, or
 * rectification: da/dt = g(b-a), db/dt = g(a-b), initially a=1 and b=0.
 * This optional lesson assumption is not a universal model of gap junctions.
 */
export function gapLesson(strength: number): {
  times: number[]
  a: number[]
  b: number[]
  finalA: number
  finalB: number
} {
  unitInput(strength, 'strength')
  const times = Array.from({ length: 101 }, (_, index) => index * 0.05)
  const a = times.map(time => 0.5 + 0.5 * Math.exp(-2 * strength * time))
  const b = times.map(time => 0.5 - 0.5 * Math.exp(-2 * strength * time))
  return { times, a, b, finalA: a[a.length - 1]!, finalB: b[b.length - 1]! }
}

export interface SmallCircuitLessonConfig {
  stimulus: number
  inhibitory: boolean
  ablated: boolean
}

export interface SmallCircuitLessonResult {
  times: number[]
  a: number[]
  b: number[]
  c: number[]
  outputMinimum: number
  outputMaximum: number
  /** Alias of outputMaximum for chart integrations. */
  peakOutput: number
  /** C at pulse end (t=3) minus its pre-equilibrated tonic baseline (0.35). */
  deltaAtPulseEnd: number
}

/**
 * Three-cell feedforward rate lesson, using synchronous explicit Euler:
 *   tau da/dt = -a + pulse(t),       pulse(t)=stimulus for 1 <= t < 3
 *   tau db/dt = -b + clip(0.9a)
 *   tau dc/dt = -c + clip(0.35 + w*b)
 * tau=0.35, dt=0.02, w=+1 or -0.9. Ablation sets w=0, removing only B->C.
 * Initially a=b=0, c=0.35. Tonic C drive reveals inhibitory decreases while
 * preserving zero-driven A and B. No coefficients are biologically calibrated.
 */
export function smallCircuitLesson(config: SmallCircuitLessonConfig): SmallCircuitLessonResult {
  unitInput(config.stimulus, 'stimulus')
  if (typeof config.inhibitory !== 'boolean' || typeof config.ablated !== 'boolean') {
    throw new RangeError('inhibitory and ablated must be boolean values.')
  }
  const dt = 0.02
  const tau = 0.35
  const baseline = 0.35
  const weight = config.ablated ? 0 : config.inhibitory ? -0.9 : 1
  const times = [0]
  const a = [0]
  const b = [0]
  const c = [baseline]

  for (let step = 1; step <= 300; step += 1) {
    const previousTime = (step - 1) * dt
    const previousA = a[step - 1]!
    const previousB = b[step - 1]!
    const previousC = c[step - 1]!
    const pulse = previousTime >= 1 && previousTime < 3 ? config.stimulus : 0
    // Every update uses the previous state; dt/tau < 1 preserves unit bounds.
    a.push(previousA + (dt / tau) * (pulse - previousA))
    b.push(previousB + (dt / tau) * (clipActivity(0.9 * previousA) - previousB))
    c.push(previousC + (dt / tau) * (clipActivity(baseline + weight * previousB) - previousC))
    times.push(step * dt)
  }

  const outputMinimum = Math.min(...c)
  const outputMaximum = Math.max(...c)
  return {
    times,
    a,
    b,
    c,
    outputMinimum,
    outputMaximum,
    peakOutput: outputMaximum,
    deltaAtPulseEnd: c[150]! - baseline,
  }
}
