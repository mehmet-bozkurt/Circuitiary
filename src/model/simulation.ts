import type { Circuit, SimulationConfig, SimulationResult } from './types'

/** Bounds browser memory and prevents accidental extremely long runs. */
export const MAX_SIMULATION_STEPS = 100_000

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`)
}

function positive(value: number, name: string): void {
  finite(value, name)
  if (value <= 0) throw new Error(`${name} must be greater than zero.`)
}

function unitInterval(value: number, name: string): void {
  finite(value, name)
  if (value < 0 || value > 1) throw new Error(`${name} must be in [0, 1].`)
}

function validate(circuit: Circuit, config: SimulationConfig): Map<string, number> {
  if (circuit.neurons.length === 0) throw new Error('The circuit must contain at least one neuron.')
  const neuronIds = new Set<string>()
  for (const neuron of circuit.neurons) {
    if (typeof neuron.id !== 'string' || neuron.id.length === 0 || neuronIds.has(neuron.id)) {
      throw new Error('Neuron IDs must be non-empty and unique.')
    }
    neuronIds.add(neuron.id)
  }
  const connectionIds = new Set<string>()
  const gapPairs = new Set<string>()
  const gapIncident = new Map(circuit.neurons.map((neuron) => [neuron.id, 0]))
  for (const connection of circuit.connections) {
    if (typeof connection.id !== 'string' || connection.id.length === 0 || connectionIds.has(connection.id)) {
      throw new Error('Connection IDs must be non-empty and unique.')
    }
    connectionIds.add(connection.id)
    if (!neuronIds.has(connection.source) || !neuronIds.has(connection.target)) {
      throw new Error(`Connection ${connection.id} refers to an unknown neuron.`)
    }
    finite(connection.weight, `Weight for ${connection.id}`)
    if (connection.evidence !== 'illustrative' && connection.evidence !== 'anatomy-with-assumed-dynamics') {
      throw new Error(`Unknown evidence for ${connection.id}.`)
    }
    if (connection.kind !== undefined && connection.kind !== 'chemical' && connection.kind !== 'gap') {
      throw new Error(`Unknown connection kind for ${connection.id}.`)
    }
    if (connection.rawWeight !== undefined) positive(connection.rawWeight, `Raw weight for ${connection.id}`)
    if (connection.kind === 'gap') {
      if (connection.source >= connection.target) throw new Error('Physical gaps must be non-self canonical source < target pairs.')
      if (connection.weight < 0) throw new Error('Physical gap conductance must be non-negative.')
      const pair = JSON.stringify([connection.source, connection.target])
      if (gapPairs.has(pair)) throw new Error('A physical gap must be stored only once.')
      gapPairs.add(pair)
      if (connection.id !== config.silencedConnectionId) {
        for (const id of [connection.source, connection.target]) {
          const sum = gapIncident.get(id)! + connection.weight
          finite(sum, `Incident gap conductance for ${id}`)
          gapIncident.set(id, sum)
        }
      }
    }
  }

  positive(config.durationMs, 'durationMs')
  positive(config.dtMs, 'dtMs')
  positive(config.tauMs, 'tauMs')
  if (Math.ceil(config.durationMs / config.dtMs) > MAX_SIMULATION_STEPS) {
    throw new Error(`Simulation exceeds the ${MAX_SIMULATION_STEPS}-step limit.`)
  }
  if (!neuronIds.has(config.stimulus.target)) throw new Error('Stimulus target is an unknown neuron.')
  finite(config.stimulus.onsetMs, 'Stimulus onsetMs')
  finite(config.stimulus.durationMs, 'Stimulus durationMs')
  if (config.stimulus.onsetMs < 0 || config.stimulus.durationMs < 0) {
    throw new Error('Stimulus onset and duration must be non-negative.')
  }
  unitInterval(config.stimulus.amplitude, 'Stimulus amplitude')
  if (config.silencedConnectionId !== undefined && !connectionIds.has(config.silencedConnectionId)) {
    throw new Error('Silenced connection is an unknown connection.')
  }
  for (const [id, tau] of Object.entries(config.tauOverrides ?? {})) {
    if (!neuronIds.has(id)) throw new Error(`Time constant override refers to unknown neuron ${id}.`)
    positive(tau, `Time constant for ${id}`)
  }
  for (const neuron of circuit.neurons) {
    const tau = config.tauOverrides?.[neuron.id] ?? config.tauMs
    const maximumStep = tau / (1 + gapIncident.get(neuron.id)!)
    if (config.dtMs > maximumStep) {
      throw new Error(`dtMs must not exceed tau / (1 + active incident gap conductance) = ${maximumStep} for ${neuron.id}.`)
    }
  }
  for (const [id, value] of Object.entries(config.initialState ?? {})) {
    if (!neuronIds.has(id)) throw new Error(`Initial state refers to unknown neuron ${id}.`)
    unitInterval(value, `Initial activity for ${id}`)
  }
  return gapIncident
}

function copySettings(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    stimulus: { ...config.stimulus },
    ...(config.tauOverrides === undefined ? {} : { tauOverrides: { ...config.tauOverrides } }),
    ...(config.initialState === undefined ? {} : { initialState: { ...config.initialState } }),
  }
}

/**
 * Synchronous deterministic forward Euler integration of
 * tau_i dx_i/dt = -x_i + clip(sum_j W_ij x_j + I_i(t), 0, 1)
 *                 + sum_j g_ij (x_j - x_i).
 * W_ij is the signed chemical weight from source j to target i. Each physical
 * gap is one symmetric nonnegative conductance g_ij = g_ji, outside the clip.
 * Silencing a physical gap removes its contribution in both directions.
 *
 * Activity, chemical weights and gap conductances are dimensionless model
 * assumptions, not measured voltage, rates, or biophysical conductance.
 * Every update reads only the previous state. The pulse is evaluated at the
 * left endpoint, active on [onset, onset + duration). A partial final step
 * reaches durationMs exactly. dt <= tau_i / (1 + sum_j active g_ij) makes the
 * update a convex blend; the resulting state is never clipped.
 */
export function simulate(circuit: Circuit, config: SimulationConfig): SimulationResult {
  const gapIncidentById = validate(circuit, config)
  const indices = new Map(circuit.neurons.map((neuron, index) => [neuron.id, index]))
  const connections = circuit.connections
    .filter((connection) => connection.id !== config.silencedConnectionId)
    .map((connection) => ({
      source: indices.get(connection.source)!,
      target: indices.get(connection.target)!,
      weight: connection.weight,
      gap: connection.kind === 'gap',
    }))
  const chemicals = connections.filter((connection) => !connection.gap)
  const gaps = connections.filter((connection) => connection.gap)
  const gapIncident = circuit.neurons.map((neuron) => gapIncidentById.get(neuron.id)!)
  const tau = circuit.neurons.map((neuron) => config.tauOverrides?.[neuron.id] ?? config.tauMs)
  let state = circuit.neurons.map((neuron) => config.initialState?.[neuron.id] ?? 0)
  const activity = Object.fromEntries(circuit.neurons.map((neuron, index) => [neuron.id, [state[index]!]]))
  const timesMs = [0]
  const stepCount = Math.ceil(config.durationMs / config.dtMs)
  const stimulusIndex = indices.get(config.stimulus.target)!
  const stimulusEnd = config.stimulus.onsetMs + config.stimulus.durationMs

  for (let step = 1; step <= stepCount; step += 1) {
    const previousTime = timesMs[step - 1]!
    const nextTime = Math.min(step * config.dtMs, config.durationMs)
    if (nextTime <= previousTime) break
    const stepMs = nextTime - previousTime
    const drive = new Array<number>(state.length).fill(0)
    const gapNeighborDrive = new Array<number>(state.length).fill(0)
    for (const connection of chemicals) {
      drive[connection.target] = drive[connection.target]! + connection.weight * state[connection.source]!
    }
    for (const connection of gaps) {
      gapNeighborDrive[connection.source] = gapNeighborDrive[connection.source]! + connection.weight * state[connection.target]!
      gapNeighborDrive[connection.target] = gapNeighborDrive[connection.target]! + connection.weight * state[connection.source]!
    }
    if (previousTime >= config.stimulus.onsetMs && previousTime < stimulusEnd) {
      drive[stimulusIndex] = drive[stimulusIndex]! + config.stimulus.amplitude
    }
    state = state.map((value, index) => {
      const total = drive[index]!
      const neighborDrive = gapNeighborDrive[index]!
      if (!Number.isFinite(total) || !Number.isFinite(neighborDrive)) {
        throw new Error('Connection drive overflowed; reduce model weights.')
      }
      const target = Math.max(0, Math.min(1, total))
      const fraction = stepMs / tau[index]!
      // Preserve the original illustrative numerical behavior when no gap
      // is incident. No state clipping is used in either branch.
      if (gapIncident[index] === 0) return (1 - fraction) * value + fraction * target
      const retained = 1 - stepMs / (tau[index]! / (1 + gapIncident[index]!))
      return retained * value + fraction * target + fraction * neighborDrive
    })
    timesMs.push(nextTime)
    circuit.neurons.forEach((neuron, index) => activity[neuron.id]!.push(state[index]!))
  }
  return { timesMs, activity, settings: copySettings(config) }
}
