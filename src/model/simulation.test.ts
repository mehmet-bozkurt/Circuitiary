import { describe, expect, it } from 'vitest'
import { defaultConfig, illustrativeCircuit } from './circuit'
import { MAX_SIMULATION_STEPS, simulate } from './simulation'
import type { Circuit, SimulationConfig } from './types'

const isolated: Circuit = {
  id: 'isolated', name: 'Passive cell', provenance: 'Illustrative test fixture',
  neurons: [{ id: 'A', label: 'A', role: 'input', description: 'Isolated passive cell', position: { x: 0, y: 0 } }],
  connections: [],
}

function config(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...defaultConfig, stimulus: { ...defaultConfig.stimulus }, ...overrides }
}

function cells(...ids: string[]): Circuit['neurons'] {
  return ids.map((id) => ({ id, label: id, role: 'unspecified', description: 'Synthetic cell', position: { x: 0, y: 0 } }))
}

function passive(dtMs: number) {
  return simulate(isolated, {
    durationMs: 150, dtMs, tauMs: 30,
    stimulus: { target: 'A', onsetMs: 0, durationMs: 0, amplitude: 0 },
    initialState: { A: 0.9 },
  })
}

describe('deterministic continuous activity simulation', () => {
  it('is deterministic and returns aligned traces including both endpoints', () => {
    const first = simulate(illustrativeCircuit, config())
    expect(simulate(illustrativeCircuit, config())).toEqual(first)
    expect(first.timesMs).toHaveLength(701)
    expect(first.timesMs[0]).toBe(0)
    expect(first.timesMs.at(-1)).toBe(700)
    for (const trace of Object.values(first.activity)) expect(trace).toHaveLength(first.timesMs.length)
  })

  it('keeps every activity finite and in [0, 1], even with saturation and inhibition', () => {
    const result = simulate(illustrativeCircuit, config({ stimulus: { ...defaultConfig.stimulus, amplitude: 1 } }))
    for (const trace of Object.values(result.activity)) {
      for (const value of trace) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('leaves a zero initial state at zero when stimulus amplitude is zero', () => {
    const result = simulate(illustrativeCircuit, config({ stimulus: { ...defaultConfig.stimulus, amplitude: 0 } }))
    for (const trace of Object.values(result.activity)) expect(trace.every((value) => value === 0)).toBe(true)
  })

  it('uses the half-open pulse interval and updates all cells synchronously', () => {
    const result = simulate(illustrativeCircuit, config())
    expect(result.activity.S1![100]).toBe(0)
    expect(result.activity.S1![101]).toBeCloseTo(0.8 / 30, 12)
    expect(result.activity.I1![101]).toBe(0)
    expect(result.activity.I1![102]).toBeGreaterThan(0)
    expect(result.activity.S1![301]).toBeCloseTo(result.activity.S1![300]! * (29 / 30), 12)
  })

  it('matches the passive Euler solution and converges toward exponential decay', () => {
    const coarse = passive(2).activity.A!.at(-1)!
    const fine = passive(1).activity.A!.at(-1)!
    const exact = 0.9 * Math.exp(-150 / 30)
    expect(coarse).toBeCloseTo(0.9 * (1 - 2 / 30) ** 75, 12)
    expect(fine).toBeCloseTo(0.9 * (1 - 1 / 30) ** 150, 12)
    expect(Math.abs(fine - exact)).toBeLessThan(Math.abs(coarse - exact))
    expect(Math.abs(fine - exact)).toBeLessThan(0.0006)
  })

  it('has close network trajectories when the time step is halved', () => {
    const coarse = simulate(illustrativeCircuit, config())
    const fine = simulate(illustrativeCircuit, config({ dtMs: 0.5 }))
    for (const neuron of illustrativeCircuit.neurons) {
      const errors = coarse.activity[neuron.id]!.map((value, index) => Math.abs(value - fine.activity[neuron.id]![index * 2]!))
      expect(Math.max(...errors)).toBeLessThan(0.01)
    }
  })

  it('silencing I3 → O1 suppresses O1 without altering upstream traces', () => {
    const baseline = simulate(illustrativeCircuit, config())
    const silenced = simulate(illustrativeCircuit, config({ silencedConnectionId: 'I3-O1' }))
    expect(Math.max(...baseline.activity.O1!)).toBeGreaterThan(0.3)
    expect(silenced.activity.O1!.every((value) => value === 0)).toBe(true)
    expect(silenced.activity.I3).toEqual(baseline.activity.I3)
    expect(silenced.activity.O2).toEqual(baseline.activity.O2)
  })

  it('a larger O1 time constant changes its response while preserving other cells', () => {
    const baseline = simulate(illustrativeCircuit, config())
    const slow = simulate(illustrativeCircuit, config({ tauOverrides: { O1: 90 } }))
    expect(slow.activity.O1![250]).toBeLessThan(baseline.activity.O1![250]!)
    expect(slow.activity.O1![600]).toBeGreaterThan(baseline.activity.O1![600]!)
    expect(slow.activity.I3).toEqual(baseline.activity.I3)
    expect(slow.activity.O2).toEqual(baseline.activity.O2)
  })

  it('includes an exact final endpoint when duration is not a multiple of dt', () => {
    const result = simulate(illustrativeCircuit, config({ durationMs: 2.5 }))
    expect(result.timesMs).toEqual([0, 1, 2, 2.5])
  })

  it('does not mutate the input and snapshots nested settings', () => {
    const settings = config({ tauOverrides: { O1: 90 }, initialState: { S2: 0.2 } })
    const before = structuredClone(settings)
    const circuitBefore = structuredClone(illustrativeCircuit)
    const result = simulate(illustrativeCircuit, settings)
    expect(settings).toEqual(before)
    expect(illustrativeCircuit).toEqual(circuitBefore)
    settings.stimulus.amplitude = 0
    settings.tauOverrides!.O1 = 40
    settings.initialState!.S2 = 0
    expect(result.settings).toEqual(before)
  })
})

describe('per-neuron settings are read from own keys only', () => {
  const circuitOf = (first: string): Circuit => ({ ...isolated, neurons: cells(first, 'B') })
  const settings = (target: string, overrides: Partial<SimulationConfig> = {}): SimulationConfig => ({
    durationMs: 20, dtMs: 1, tauMs: 30,
    stimulus: { target, onsetMs: 0, durationMs: 10, amplitude: 0.6 }, ...overrides,
  })

  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'a neuron named %s ignores Object.prototype members in tauOverrides and initialState',
    (id) => {
      const extra = { tauOverrides: { B: 40 }, initialState: { B: 0.5 } }
      const result = simulate(circuitOf(id), settings(id, extra))
      const reference = simulate(circuitOf('A'), settings('A', extra))
      expect(result.activity[id]).toEqual(reference.activity.A)
      expect(result.activity.B).toEqual(reference.activity.B)
      expect(result.activity[id]!.every(Number.isFinite)).toBe(true)
      expect(result.activity[id]![5]).toBeGreaterThan(0)
    },
  )

  it('ignores inherited keys, which validation never sees, instead of using them unchecked', () => {
    const baseline = simulate(circuitOf('A'), settings('A'))
    const inheritedTau = Object.create({ A: -5, B: 0.5 }) as Record<string, number>
    const inheritedState = Object.create({ A: 7, B: 0.9 }) as Record<string, number>
    const result = simulate(circuitOf('A'), settings('A', { tauOverrides: inheritedTau, initialState: inheritedState }))
    expect(result.activity).toEqual(baseline.activity)
  })
})

const invalidConfigs: Partial<SimulationConfig>[] = [
    { durationMs: 0 }, { durationMs: Infinity }, { dtMs: 0 }, { dtMs: -1 },
    { tauMs: NaN }, { tauMs: 0 }, { dtMs: 31 },
    { dtMs: 700 / (MAX_SIMULATION_STEPS + 1) },
    { stimulus: { ...defaultConfig.stimulus, target: 'missing' } },
    { stimulus: { ...defaultConfig.stimulus, onsetMs: -1 } },
    { stimulus: { ...defaultConfig.stimulus, durationMs: -1 } },
    { stimulus: { ...defaultConfig.stimulus, amplitude: 1.1 } },
    { stimulus: { ...defaultConfig.stimulus, amplitude: NaN } },
    { silencedConnectionId: 'missing' },
    { tauOverrides: { missing: 30 } }, { tauOverrides: { O1: -1 } },
    { tauOverrides: { O1: 0.5 } }, { initialState: { missing: 0 } },
    { initialState: { O1: 1.1 } }, { initialState: { O1: NaN } },
]

describe('invalid configuration and circuit rejection', () => {
  it.each(invalidConfigs)('rejects invalid settings %j', (overrides) => {
    expect(() => simulate(illustrativeCircuit, config(overrides))).toThrow()
  })

  it('rejects missing, duplicate, or unknown circuit identities and nonfinite weights', () => {
    const duplicateNeuron = structuredClone(illustrativeCircuit)
    duplicateNeuron.neurons[1]!.id = 'S1'
    const duplicateEdge = structuredClone(illustrativeCircuit)
    duplicateEdge.connections[1]!.id = duplicateEdge.connections[0]!.id
    const unknownEndpoint = structuredClone(illustrativeCircuit)
    unknownEndpoint.connections[0]!.source = 'missing'
    const invalidWeight = structuredClone(illustrativeCircuit)
    invalidWeight.connections[0]!.weight = Infinity
    for (const circuit of [duplicateNeuron, duplicateEdge, unknownEndpoint, invalidWeight, { ...illustrativeCircuit, neurons: [] }]) {
      expect(() => simulate(circuit, config())).toThrow()
    }
  })
})

describe('engine guards and stimulus timing contract', () => {
  const sums = (weight: number, count = 2): Circuit => ({
    ...isolated,
    neurons: cells(...Array.from({ length: count }, (_, i) => `S${i}`), 'T'),
    connections: Array.from({ length: count }, (_, i) => ({
      id: `S${i}-T`, source: `S${i}`, target: 'T', weight, evidence: 'illustrative', note: 'Synthetic drive',
    })),
  })
  const driven = (count: number, overrides: Partial<SimulationConfig> = {}): SimulationConfig => ({
    durationMs: 3, dtMs: 1, tauMs: 30,
    stimulus: { target: 'T', onsetMs: 0, durationMs: 0, amplitude: 0 },
    initialState: Object.fromEntries(Array.from({ length: count }, (_, i) => [`S${i}`, 1])), ...overrides,
  })

  it('rejects chemical drive that overflows to infinity instead of silently clipping it', () => {
    expect(() => simulate(sums(1.7e308), driven(2))).toThrow(/Connection drive overflowed/)
    expect(() => simulate(sums(-1.7e308), driven(2))).toThrow(/Connection drive overflowed/)
  })

  it('accepts a huge but finite chemical drive and saturates it at 1', () => {
    const result = simulate(sums(1.7e308, 1), driven(1))
    expect(result.activity.T![1]).toBeCloseTo(1 / 30, 12)
    expect(result.activity.T!.every(Number.isFinite)).toBe(true)
  })

  it.each([0, -1, NaN, Infinity])('rejects Connection.rawWeight %s', (rawWeight) => {
    const circuit = structuredClone(illustrativeCircuit)
    circuit.connections[0]!.rawWeight = rawWeight
    expect(() => simulate(circuit, config())).toThrow(/Raw weight for S1-I1/)
  })

  it('accepts a positive rawWeight but never uses it as dynamics', () => {
    const circuit = structuredClone(illustrativeCircuit)
    for (const connection of circuit.connections) connection.rawWeight = 1e6
    expect(simulate(circuit, config()).activity).toEqual(simulate(illustrativeCircuit, config()).activity)
  })

  it('evaluates an off-grid pulse at each step\'s left endpoint, for the whole step', () => {
    // Window [0.5, 2.5) on a dt = 1 grid: left endpoints 1 and 2 are inside, 0 and 3 are not.
    const result = simulate(isolated, {
      durationMs: 5, dtMs: 1, tauMs: 10,
      stimulus: { target: 'A', onsetMs: 0.5, durationMs: 2, amplitude: 0.6 },
    })
    const drive = 0.6 / 10
    const second = drive
    const third = (1 - 1 / 10) * second + drive
    const fourth = (1 - 1 / 10) * third
    expect(result.activity.A!.slice(0, 5)).toEqual([0, 0, expect.closeTo(second, 12), expect.closeTo(third, 12), expect.closeTo(fourth, 12)])
  })
})

function gapCircuit(weight = 0.4): Circuit {
  return {
    id: 'synthetic-gap', name: 'Invented physical gap test', provenance: 'Synthetic two-cell test only',
    neurons: ['A', 'B'].map((id) => ({ id, label: id, role: 'unspecified', description: 'Synthetic cell', position: { x: 0, y: 0 } })),
    connections: [{ id: 'gap:A:B', source: 'A', target: 'B', weight, kind: 'gap', evidence: 'anatomy-with-assumed-dynamics', note: 'Synthetic symmetric gap' }],
  }
}

function gapConfig(dtMs = 1, overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    durationMs: 60, dtMs, tauMs: 30,
    stimulus: { target: 'A', onsetMs: 0, durationMs: 0, amplitude: 0 },
    initialState: { A: 1, B: 0 }, ...overrides,
  }
}

describe('symmetric physical gap dynamics', () => {
  it('matches the exact discrete two-cell sum/difference solutions, including leak', () => {
    const result = simulate(gapCircuit(), gapConfig())
    result.timesMs.forEach((time, index) => {
      const sum = (1 - 1 / 30) ** time
      const difference = (1 - (1 + 2 * 0.4) / 30) ** time
      expect(result.activity.A![index]).toBeCloseTo((sum + difference) / 2, 12)
      expect(result.activity.B![index]).toBeCloseTo((sum - difference) / 2, 12)
    })
  })

  it('converges toward the continuous analytic gap solution as dt is halved', () => {
    const end = (dt: number) => {
      const result = simulate(gapCircuit(), gapConfig(dt))
      return [result.activity.A!.at(-1)!, result.activity.B!.at(-1)!]
    }
    const sum = Math.exp(-60 / 30)
    const difference = Math.exp(-(1 + 2 * 0.4) * 60 / 30)
    const exact = [(sum + difference) / 2, (sum - difference) / 2]
    const error = (values: number[]) => Math.max(...values.map((value, index) => Math.abs(value - exact[index]!)))
    expect(error(end(0.5))).toBeLessThan(error(end(1)))
    expect(error(end(0.5))).toBeLessThan(0.002)
  })

  it('cancels gap exchange in the tau-weighted sum with unequal time constants', () => {
    const result = simulate(gapCircuit(2), gapConfig(1, { durationMs: 1, tauOverrides: { A: 20, B: 50 }, initialState: { A: 0.8, B: 0.1 } }))
    const weightedChange = 20 * (result.activity.A![1]! - 0.8) + 50 * (result.activity.B![1]! - 0.1)
    // Symmetric gap flux cancels; only the leak -dt*(A+B) remains.
    expect(weightedChange).toBeCloseTo(-0.9, 12)
  })

  it('is symmetric under exchange of initial activities and is deterministic', () => {
    const circuit = gapCircuit()
    const forward = simulate(circuit, gapConfig())
    const reverse = simulate(circuit, gapConfig(1, { initialState: { A: 0, B: 1 } }))
    expect(forward.activity.A).toEqual(reverse.activity.B)
    expect(forward.activity.B).toEqual(reverse.activity.A)
    expect(simulate(circuit, gapConfig())).toEqual(forward)
  })

  it('silences one physical gap in both directions and relaxes the active-gap step bound', () => {
    const circuit = gapCircuit(2)
    const fromA = simulate(circuit, gapConfig(15, { durationMs: 30, silencedConnectionId: 'gap:A:B' }))
    const fromB = simulate(circuit, gapConfig(15, { durationMs: 30, silencedConnectionId: 'gap:A:B', initialState: { A: 0, B: 1 } }))
    expect(fromA.activity.B).toEqual([0, 0, 0])
    expect(fromA.activity.A).toEqual([1, 0.5, 0.25])
    expect(fromB.activity.A).toEqual([0, 0, 0])
    expect(fromB.activity.B).toEqual([1, 0.5, 0.25])
    expect(() => simulate(circuit, gapConfig(15))).toThrow(/incident gap/)
  })

  it('applies the conservative dt bound per neuron using all incident physical gaps', () => {
    const circuit = gapCircuit(2)
    circuit.neurons.push({ ...circuit.neurons[1]!, id: 'C', label: 'C' })
    circuit.connections.push({ ...circuit.connections[0]!, id: 'gap:B:C', source: 'B', target: 'C', weight: 3 })
    expect(() => simulate(circuit, gapConfig(5))).not.toThrow()
    expect(() => simulate(circuit, gapConfig(5.001))).toThrow(/for B/)
    expect(() => simulate(circuit, gapConfig(5, { tauOverrides: { A: 10 } }))).toThrow(/for A/)
  })

  it('remains bounded at the exact Euler limit with saturated chemical drive and no state clipping', () => {
    const circuit = gapCircuit(2)
    circuit.connections.push({ id: 'self:A', source: 'A', target: 'A', weight: 100, kind: 'chemical', evidence: 'illustrative', note: 'Saturating synthetic drive' })
    const result = simulate(circuit, gapConfig(10, { initialState: { A: 1, B: 1 }, stimulus: { target: 'B', onsetMs: 0, durationMs: 60, amplitude: 1 } }))
    for (const trace of Object.values(result.activity)) for (const value of trace) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(value).toBeCloseTo(1, 12)
    }
  })

  it('stays within a few ulp of [0, 1] at the exact dt bound with non-dyadic tau and conductance', () => {
    // Real arithmetic keeps the convex blend inside [0, 1]; floating point may exceed it by ~1 ulp.
    const tolerance = 8 * Number.EPSILON
    for (const tauMs of [0.3, 0.7, 3.3, 7.1, 13, 29.9]) for (const g of [0.1, 0.37, 1.3, 2]) {
      const dtMs = tauMs / (1 + g)
      for (const saturated of [false, true]) for (const initialState of [{ A: 1, B: 0 }, { A: 1, B: 1 }, { A: 0.3, B: 0.9 }]) {
        const circuit = gapCircuit(g)
        if (saturated) for (const id of ['A', 'B']) circuit.connections.push({ id: `self:${id}`, source: id, target: id, weight: 100, kind: 'chemical', evidence: 'illustrative', note: 'Saturating synthetic drive' })
        const result = simulate(circuit, gapConfig(dtMs, { tauMs, initialState }))
        for (const trace of Object.values(result.activity)) for (const value of trace) {
          expect(value).toBeGreaterThanOrEqual(-tolerance)
          expect(value).toBeLessThanOrEqual(1 + tolerance)
        }
      }
    }
  })

  it('clips chemical drive before adding gap diffusion, rather than clipping their sum', () => {
    const circuit = gapCircuit(0.4)
    circuit.connections.push({ id: 'chemical:B:A', source: 'B', target: 'A', weight: 100, kind: 'chemical', evidence: 'illustrative', note: 'Saturating synthetic drive' })
    const result = simulate(circuit, gapConfig(1, { durationMs: 1, initialState: { A: 0, B: 1 } }))
    expect(result.activity.A![1]).toBeCloseTo((1 + 0.4) / 30, 12)
  })

  it('rejects negative, duplicate, noncanonical, or self physical gaps and unknown connection kinds', () => {
    const negative = gapCircuit(-1)
    const diagonal = gapCircuit(); diagonal.connections[0]!.target = 'A'
    const reversed = gapCircuit(); reversed.connections[0]!.source = 'B'; reversed.connections[0]!.target = 'A'
    const duplicate = gapCircuit(); duplicate.connections.push({ ...duplicate.connections[0]!, id: 'second-gap' })
    const kind = gapCircuit(); (kind.connections[0] as unknown as { kind: string }).kind = 'unknown'
    const evidence = gapCircuit(); (evidence.connections[0] as unknown as { evidence: string }).evidence = 'measured-dynamics'
    for (const circuit of [negative, diagonal, reversed, duplicate, kind, evidence]) expect(() => simulate(circuit, gapConfig())).toThrow()
  })
})
