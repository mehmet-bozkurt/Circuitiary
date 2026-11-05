import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { simulate } from '../model/simulation'
import type { Circuit, SimulationConfig } from '../model/types'
import {
  CELL_IDS, LIMITS, REPORT_LEVEL, blankDraft, buildEngineCircuit, buildEngineConfig, cellIds, cloneDraft, describeRun,
  draftKey, explainEngineError, hasExcitatoryLoop, linkLabel, presetById, presets, runDraft, summarizeCells, validateDraft,
  type BuilderDraft, type BuilderLink, type BuilderRun, type CellId, type LinkType,
} from './circuitBuilder'

const link = (id: string, source: CellId, target: CellId, type: LinkType, strength: number): BuilderLink => ({ id, source, target, type, strength })
const draftOf = (cellCount: number, links: BuilderLink[], stimulus: Partial<BuilderDraft['stimulus']> = {}): BuilderDraft =>
  ({ ...blankDraft(), cellCount, links, stimulus: { ...blankDraft().stimulus, ...stimulus } })
const run = (draft: BuilderDraft): BuilderRun => {
  const outcome = runDraft(draft)
  if (!outcome.ok) throw new Error(outcome.problems.map(problem => problem.message).join(' | '))
  return outcome.run
}
const cell = (result: BuilderRun, id: CellId) => result.cells.find(item => item.id === id)!
const at = (result: BuilderRun, id: CellId, timeMs: number) => result.result.activity[id]![result.result.timesMs.indexOf(timeMs)]!
const codes = (draft: BuilderDraft) => validateDraft(draft).map(problem => problem.code)

describe('draft basics', () => {
  it('names cells A to F and takes the first n', () => {
    expect(CELL_IDS).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(cellIds(2)).toEqual(['A', 'B'])
    expect(cellIds(6)).toEqual([...CELL_IDS])
  })

  it('starts as a valid blank circuit where only the stimulated cell responds', () => {
    const blank = blankDraft()
    expect(blank.links).toEqual([])
    expect(validateDraft(blank)).toEqual([])
    const result = run(blank)
    expect(cell(result, 'A').peak).toBeGreaterThan(0.79)
    expect(cell(result, 'B').peak).toBe(0)
    expect(cell(result, 'C').peak).toBe(0)
    expect(cell(result, 'B').peakTimeMs).toBeNull()
    expect(cell(result, 'B').reachMs).toBeNull()
  })

  it('fingerprints content only, ignoring link ids, and clones deeply', () => {
    const a = draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.5)])
    const b = draftOf(3, [link('y', 'A', 'B', 'excitatory', 0.5)])
    expect(draftKey(a)).toBe(draftKey(b))
    for (const changed of [
      draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.55)]),
      draftOf(3, [link('x', 'A', 'B', 'inhibitory', 0.5)]),
      draftOf(3, [link('x', 'B', 'A', 'excitatory', 0.5)]),
      draftOf(4, [link('x', 'A', 'B', 'excitatory', 0.5)]),
      draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.5)], { amplitude: 0.7 }),
      draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.5)], { target: 'B' }),
      draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.5)], { onsetMs: 110 }),
      draftOf(3, [link('x', 'A', 'B', 'excitatory', 0.5)], { durationMs: 210 }),
      draftOf(3, []),
    ]) expect(draftKey(changed)).not.toBe(draftKey(a))
    const copy = cloneDraft(a)
    copy.links[0]!.strength = 1
    copy.stimulus.amplitude = 0.1
    expect(a.links[0]!.strength).toBe(0.5)
    expect(a.stimulus.amplitude).toBe(0.8)
  })

  it('accepts a Vue reactive draft, as the page passes it, and records a plain copy', () => {
    const live = reactive(cloneDraft(presetById('chain').draft))
    const outcome = runDraft(live)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      live.links[0]!.strength = 0.1
      expect(outcome.run.draft.links[0]!.strength).toBe(0.9)
      expect(draftKey(cloneDraft(live))).toBe(draftKey(live))
    }
  })

  it('labels links readably and sorts the two ends of a gap', () => {
    expect(linkLabel(link('a', 'A', 'B', 'excitatory', 1))).toBe('A → B uyarıcı')
    expect(linkLabel(link('a', 'C', 'A', 'inhibitory', 1))).toBe('C → A baskılayıcı')
    expect(linkLabel(link('a', 'C', 'A', 'gap', 1))).toBe('A ↔ C elektriksel')
  })
})

describe('engine circuit', () => {
  it('maps excitatory to positive and inhibitory to negative chemical weights', () => {
    const circuit = buildEngineCircuit(draftOf(3, [link('a', 'A', 'B', 'excitatory', 0.6), link('b', 'C', 'B', 'inhibitory', 0.4)]))
    expect(circuit.neurons.map(neuron => neuron.id)).toEqual(['A', 'B', 'C'])
    expect(circuit.connections.map(c => [c.source, c.target, c.weight, c.kind])).toEqual([['A', 'B', 0.6, 'chemical'], ['C', 'B', -0.4, 'chemical']])
    expect(new Set(circuit.connections.map(c => c.id)).size).toBe(2)
    expect(circuit.connections.every(c => c.evidence === 'illustrative')).toBe(true)
  })

  it('stores a gap once in canonical order whichever way the two ends were chosen', () => {
    for (const [source, target] of [['A', 'C'], ['C', 'A']] as const) {
      const circuit = buildEngineCircuit(draftOf(3, [link('g', source, target, 'gap', 0.5)]))
      expect(circuit.connections).toHaveLength(1)
      expect(circuit.connections[0]).toMatchObject({ source: 'A', target: 'C', weight: 0.5, kind: 'gap' })
    }
  })

  it('cannot express an asymmetric gap: swapping the ends changes nothing', () => {
    const forward = run(draftOf(3, [link('g', 'A', 'B', 'gap', 0.6)]))
    const backward = run(draftOf(3, [link('g', 'B', 'A', 'gap', 0.6)]))
    expect(backward.result.activity).toEqual(forward.result.activity)
  })

  it('spreads activity through a gap in both directions with the same coefficient', () => {
    const fromA = run(draftOf(2, [link('g', 'A', 'B', 'gap', 0.5)], { target: 'A' }))
    const fromB = run(draftOf(2, [link('g', 'A', 'B', 'gap', 0.5)], { target: 'B' }))
    expect(cell(fromA, 'B').peak).toBeGreaterThan(0.1)
    expect(cell(fromB, 'A').peak).toBeGreaterThan(0.1)
    expect(cell(fromA, 'B').peak).toBeCloseTo(cell(fromB, 'A').peak, 12)
    expect(cell(fromA, 'A').peak).toBeCloseTo(cell(fromB, 'B').peak, 12)
    // A gap only shares activity: the stimulated cell loses some, the neighbour stays below it.
    expect(cell(fromA, 'B').peak).toBeLessThan(cell(fromA, 'A').peak)
    expect(cell(fromA, 'A').peak).toBeLessThan(run(draftOf(2, [])).cells[0]!.peak)
  })

  it('matches an independent engine call for a mixed circuit', () => {
    const draft = draftOf(4, [link('1', 'A', 'B', 'excitatory', 0.9), link('2', 'B', 'C', 'inhibitory', 0.3), link('3', 'B', 'D', 'gap', 0.4), link('4', 'A', 'C', 'excitatory', 0.7)], { amplitude: 0.6, onsetMs: 50, durationMs: 120 })
    const circuit: Circuit = {
      id: 'oracle', name: 'oracle', provenance: 'oracle',
      neurons: ['A', 'B', 'C', 'D'].map((id, index) => ({ id, label: id, role: 'unspecified' as const, description: '', position: { x: index, y: 0 } })),
      connections: [
        { id: 'a', source: 'A', target: 'B', weight: 0.9, evidence: 'illustrative', note: '' },
        { id: 'b', source: 'B', target: 'C', weight: -0.3, evidence: 'illustrative', note: '' },
        { id: 'c', source: 'B', target: 'D', weight: 0.4, evidence: 'illustrative', note: '', kind: 'gap' },
        { id: 'd', source: 'A', target: 'C', weight: 0.7, evidence: 'illustrative', note: '' },
      ],
    }
    const config: SimulationConfig = { durationMs: 700, dtMs: 1, tauMs: 30, stimulus: { target: 'A', onsetMs: 50, durationMs: 120, amplitude: 0.6 } }
    const expected = simulate(circuit, config)
    const result = run(draft)
    expect(result.result.timesMs).toEqual(expected.timesMs)
    expect(result.result.activity).toEqual(expected.activity)
    expect(buildEngineConfig(draft)).toEqual(config)
    expect(cell(result, 'D').peak).toBeGreaterThan(0)
  })

  it('records the run settings independently of later edits to the draft', () => {
    const draft = draftOf(3, [link('1', 'A', 'B', 'excitatory', 0.9)])
    const result = run(draft)
    draft.links[0]!.strength = 0.1
    draft.stimulus.amplitude = 0.2
    expect(result.draft.links[0]!.strength).toBe(0.9)
    expect(result.result.settings.stimulus.amplitude).toBe(0.8)
  })

  it('is deterministic', () => {
    const draft = cloneDraft(presetById('loop').draft)
    expect(run(draft).result.activity).toEqual(run(draft).result.activity)
  })

  it('runs the largest allowed circuit: six cells, twelve links, strongest gaps and chemical weights', () => {
    const links: BuilderLink[] = []
    const ids = cellIds(6)
    ids.slice(1).forEach((id, index) => links.push(link(`g${index}`, 'A', id, 'gap', LIMITS.gap.max)))
    ids.slice(1).forEach((id, index) => links.push(link(`c${index}`, id, 'A', index % 2 ? 'inhibitory' : 'excitatory', LIMITS.chemical.max)))
    links.push(link('x', 'B', 'C', 'excitatory', LIMITS.chemical.max), link('y', 'C', 'B', 'excitatory', LIMITS.chemical.max))
    expect(links).toHaveLength(12)
    const outcome = runDraft(draftOf(6, links, { amplitude: 1, onsetMs: LIMITS.onsetMs.max, durationMs: LIMITS.pulseMs.max }))
    expect(outcome.ok).toBe(true)
    if (outcome.ok) outcome.run.result.timesMs.forEach((_, index) => ids.forEach(id => {
      const value = outcome.run.result.activity[id]![index]!
      expect(value).toBeGreaterThanOrEqual(-1e-9)
      expect(value).toBeLessThanOrEqual(1 + 1e-9)
    }))
  })
})

describe('validation', () => {
  it('accepts a valid mixed circuit, a chemical self-loop and opposite chemical directions', () => {
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'excitatory', 1), link('2', 'B', 'A', 'inhibitory', 1), link('3', 'A', 'A', 'excitatory', 0.5), link('4', 'A', 'B', 'gap', 0.5)]))).toEqual([])
    expect(run(draftOf(3, [link('3', 'A', 'A', 'excitatory', 0.5)])).draft.links).toHaveLength(1)
  })

  it('rejects cell counts outside 2 to 6, including fractions and NaN', () => {
    for (const cellCount of [0, 1, 7, 2.5, Number.NaN]) expect(codes(draftOf(cellCount, []))).toEqual(['cell-count'])
    expect(codes(draftOf(2, []))).toEqual([])
    expect(codes(draftOf(6, []))).toEqual([])
  })

  it('rejects a gap from a cell to itself', () => {
    expect(codes(draftOf(3, [link('g', 'B', 'B', 'gap', 0.5)]))).toEqual(['self-gap'])
  })

  it('rejects a second gap between the same two cells in either order', () => {
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'gap', 0.5), link('2', 'B', 'A', 'gap', 0.5)]))).toEqual(['duplicate-gap'])
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'gap', 0.5), link('2', 'A', 'B', 'gap', 0.7)]))).toEqual(['duplicate-gap'])
  })

  it('rejects a second chemical connection for the same ordered pair, whatever its sign', () => {
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'excitatory', 0.5), link('2', 'A', 'B', 'excitatory', 0.7)]))).toEqual(['duplicate-chemical'])
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'excitatory', 0.5), link('2', 'A', 'B', 'inhibitory', 0.7)]))).toEqual(['duplicate-chemical'])
  })

  it('names the earlier connection a duplicate repeats', () => {
    const problems = validateDraft(draftOf(3, [link('1', 'A', 'C', 'excitatory', 0.5), link('2', 'A', 'B', 'excitatory', 0.5), link('3', 'A', 'B', 'excitatory', 0.7)]))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ code: 'duplicate-chemical', linkId: '3' })
    expect(problems[0]!.message).toContain('Bağlantı 3')
    expect(problems[0]!.message).toContain('Bağlantı 2')
  })

  it('rejects links that point at cells removed from the circuit', () => {
    const problems = validateDraft(draftOf(2, [link('1', 'A', 'C', 'excitatory', 0.5), link('2', 'D', 'A', 'gap', 0.5)]))
    expect(problems.map(problem => problem.code)).toEqual(['unknown-cell', 'unknown-cell'])
    expect(problems.map(problem => problem.linkId)).toEqual(['1', '2'])
  })

  it('rejects strengths outside the type-specific range, NaN and Infinity', () => {
    for (const strength of [0, 0.04, 2.05, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(codes(draftOf(3, [link('1', 'A', 'B', 'excitatory', strength)]))).toEqual(['strength'])
    }
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'inhibitory', LIMITS.chemical.max)]))).toEqual([])
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'gap', 1.05)]))).toEqual(['strength'])
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'gap', LIMITS.gap.max)]))).toEqual([])
    expect(codes(draftOf(3, [link('1', 'A', 'B', 'gap', LIMITS.gap.min)]))).toEqual([])
  })

  it('rejects more than twelve links', () => {
    const many: BuilderLink[] = []
    for (const source of cellIds(6)) for (const target of cellIds(6)) if (source !== target && many.length < 13) many.push(link(`${source}${target}`, source, target, 'excitatory', 0.5))
    expect(many).toHaveLength(13)
    expect(codes(draftOf(6, many))).toEqual(['too-many-links'])
    expect(codes(draftOf(6, many.slice(0, 12)))).toEqual([])
  })

  it('checks every stimulus field', () => {
    expect(codes(draftOf(3, [], { target: 'D' }))).toEqual(['stimulus-target'])
    expect(codes(draftOf(3, [], { amplitude: 1.05 }))).toEqual(['amplitude'])
    expect(codes(draftOf(3, [], { amplitude: -0.1 }))).toEqual(['amplitude'])
    expect(codes(draftOf(3, [], { amplitude: Number.NaN }))).toEqual(['amplitude'])
    expect(codes(draftOf(3, [], { onsetMs: -10 }))).toEqual(['onset'])
    expect(codes(draftOf(3, [], { onsetMs: 510 }))).toEqual(['onset'])
    expect(codes(draftOf(3, [], { durationMs: 0 }))).toEqual(['pulse'])
    expect(codes(draftOf(3, [], { durationMs: 600 }))).toEqual(['pulse'])
    expect(codes(draftOf(3, [], { amplitude: 0, onsetMs: 0, durationMs: 10 }))).toEqual([])
    expect(codes(draftOf(3, [], { amplitude: 1, onsetMs: 500, durationMs: 500 }))).toEqual([])
  })

  it('collects several problems at once in reading order', () => {
    expect(codes(draftOf(3, [link('1', 'A', 'A', 'gap', 0.5), link('2', 'A', 'B', 'excitatory', 0.5), link('3', 'A', 'B', 'excitatory', 0.5)], { amplitude: 2 })))
      .toEqual(['self-gap', 'duplicate-chemical', 'amplitude'])
  })

  it('writes every message in Turkish with decimal commas and no raw engine text', () => {
    const broken = draftOf(7, [])
    const messages = [
      ...validateDraft(broken),
      ...validateDraft(draftOf(3, [link('1', 'A', 'A', 'gap', 3), link('2', 'A', 'B', 'gap', 0.5), link('3', 'B', 'A', 'gap', 0.5), link('4', 'C', 'D', 'excitatory', 0.5), link('5', 'A', 'B', 'excitatory', 9), link('6', 'A', 'B', 'excitatory', 1)], { target: 'F', amplitude: 3, onsetMs: -1, durationMs: 0 })),
    ].map(problem => problem.message)
    expect(messages.length).toBeGreaterThan(6)
    for (const message of messages) {
      expect(message).not.toMatch(/\d\.\d/)
      expect(message).not.toMatch(/\b(must|the|neuron|connection|is|are)\b/i)
      expect(message).toMatch(/[ğüşıöçĞÜŞİÖÇ]/)
    }
    expect(validateDraft(draftOf(3, [], { amplitude: 2 }))[0]!.message).toBe('Uyaran genliği 0–1 arasında olmalı.')
    expect(validateDraft(draftOf(3, [link('1', 'A', 'B', 'excitatory', 9)]))[0]!.message).toBe('Bağlantı 1: güç 0,05–2 aralığında olmalı.')
  })
})

describe('running', () => {
  it('never runs an invalid circuit and never throws', () => {
    for (const draft of [draftOf(1, []), draftOf(3, [link('g', 'A', 'A', 'gap', 1)]), draftOf(3, [link('1', 'A', 'B', 'excitatory', Number.NaN)]), { cellCount: 3, links: [], stimulus: { target: 'Z' as CellId, amplitude: 0.5, onsetMs: 0, durationMs: 10 } }]) {
      const outcome = runDraft(draft)
      expect(outcome.ok).toBe(false)
      if (!outcome.ok) expect(outcome.problems.length).toBeGreaterThan(0)
    }
  })

  it('summarizes peak, first peak time, first time at the reporting level and the final value', () => {
    const result = run(draftOf(2, [link('1', 'A', 'B', 'excitatory', 0.5)]))
    const a = cell(result, 'A')
    expect(a.peak).toBe(Math.max(...result.result.activity.A!))
    expect(a.peakTimeMs).toBe(300)
    expect(a.reachMs).toBe(104)
    expect(a.finalValue).toBe(result.result.activity.A!.at(-1))
    expect(a.finalValue).toBeLessThan(1e-3)
    expect(summarizeCells(result.draft, result.result)).toEqual(result.cells)
  })

  it('reports the earliest sample for a flat top and null times for a cell that never rises', () => {
    const flat = run(draftOf(2, [link('1', 'A', 'A', 'excitatory', 2)], { amplitude: 1, onsetMs: 0, durationMs: 500 }))
    const trace = flat.result.activity.A!
    expect(cell(flat, 'A').peak).toBe(Math.max(...trace))
    expect(cell(flat, 'A').peak).toBeGreaterThan(0.999)
    expect(cell(flat, 'A').peakTimeMs).toBe(flat.result.timesMs[trace.indexOf(cell(flat, 'A').peak)])
    expect(cell(flat, 'B').peakTimeMs).toBeNull()
    expect(cell(flat, 'B').reachMs).toBeNull()
  })

  it('describes the strongest cell, silent cells and the state after the pulse', () => {
    const result = run(draftOf(4, [link('1', 'A', 'B', 'excitatory', 0.9)]))
    expect(result.facts[0]).toBe('En yüksek tepe A hücresinde: 0,799.')
    expect(result.facts[1]).toContain('C ve D hücreleri hiç yanıt vermedi')
    expect(result.facts[2]).toBe('Uyaran 300 ms’de bitti; 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altına indi.')
    const single = run(draftOf(3, [link('1', 'A', 'B', 'excitatory', 0.9), link('2', 'B', 'C', 'excitatory', 0.9)], { target: 'A' }))
    expect(single.facts.some(fact => fact.includes('hiç yanıt vermedi'))).toBe(false)
    const quiet = run(draftOf(3, [], { amplitude: 0 }))
    expect(quiet.facts[0]).toContain('A, B ve C hücreleri hiç yanıt vermedi')
    expect(quiet.facts).toHaveLength(1)
  })

  it('stays silent about the aftermath while the pulse is still running or just ended', () => {
    const late = run(draftOf(3, [link('1', 'A', 'B', 'excitatory', 0.9)], { onsetMs: 400, durationMs: 250 }))
    expect(late.facts.some(fact => fact.includes('Uyaran'))).toBe(false)
    expect(describeRun(late.draft, late.cells, 700)).toEqual(late.facts)
  })

  it('names a feedback loop as a possible cause only when the circuit has an excitatory cycle', () => {
    const chain = (strength: number): BuilderLink[] => ['A', 'B', 'C', 'D', 'E'].map((source, index) => link(String(index), source as CellId, 'BCDEF'[index] as CellId, 'excitatory', strength))
    const stim = { onsetMs: 500, durationMs: 50, amplitude: 1 }
    const noLoop = run(draftOf(6, chain(2), stim))
    expect(noLoop.facts.at(-1)).toContain('hâlâ 0,10 düzeyinde ya da üstünde')
    expect(noLoop.facts.at(-1)).toContain('uyarıcı bir geri besleme döngüsü yok')
    expect(noLoop.facts.at(-1)).not.toContain('sürdürüyor olabilir')
    const withLoop = run(draftOf(6, [...chain(2), link('x', 'F', 'A', 'excitatory', 2)], stim))
    expect(withLoop.facts.at(-1)).toContain('uyarıcı bir geri besleme döngüsü var')
    expect(hasExcitatoryLoop([link('1', 'A', 'B', 'excitatory', 1), link('2', 'B', 'A', 'inhibitory', 1)])).toBe(false)
    expect(hasExcitatoryLoop([link('1', 'A', 'B', 'gap', 1), link('2', 'B', 'C', 'excitatory', 1)])).toBe(false)
    expect(hasExcitatoryLoop([link('1', 'A', 'A', 'excitatory', 1)])).toBe(true)
    expect(hasExcitatoryLoop([link('1', 'A', 'B', 'excitatory', 1), link('2', 'B', 'C', 'excitatory', 1), link('3', 'C', 'A', 'excitatory', 1)])).toBe(true)
  })

  it('lists the cells still above the reporting level after the pulse ended', () => {
    const result = run(presetById('loop').draft)
    expect(result.facts.at(-1)).toContain('A, B ve C hücrelerinin aktivitesi hâlâ 0,10 düzeyinde ya da üstünde')
    expect(result.facts.join(' ')).not.toMatch(/\d\.\d/)
  })
})

describe('engine error mapping', () => {
  const bareCircuit = (connections: Circuit['connections'], neurons = 3): Circuit => ({
    id: 'x', name: 'x', provenance: 'x',
    neurons: cellIds(neurons).map((id, index) => ({ id, label: id, role: 'unspecified' as const, description: '', position: { x: index, y: 0 } })),
    connections,
  })
  const config: SimulationConfig = { durationMs: 700, dtMs: 1, tauMs: 30, stimulus: { target: 'A', onsetMs: 100, durationMs: 200, amplitude: 0.8 } }
  const gap = (id: string, source: string, target: string, weight: number) => ({ id, source, target, weight, evidence: 'illustrative' as const, note: '', kind: 'gap' as const })
  const edge = (id: string, source: string, target: string, weight: number) => ({ id, source, target, weight, evidence: 'illustrative' as const, note: '' })
  const explained = (circuit: Circuit, override: Partial<SimulationConfig> = {}): string => {
    try { simulate(circuit, { ...config, ...override }) } catch (error) { return explainEngineError(error) }
    throw new Error('The engine accepted an invalid circuit.')
  }

  it('turns real engine rejections into Turkish sentences', () => {
    const cases: Array<[string, string]> = [
      [explained(bareCircuit([gap('1', 'A', 'B', 100)])), 'Elektriksel bağlantıların toplam gücü bu zaman adımı için çok büyük; hesap kararlı kalamaz. Gap güçlerini azalt.'],
      [explained(bareCircuit([edge('1', 'A', 'B', 1e308), edge('2', 'C', 'B', 1e308)]), { stimulus: config.stimulus, initialState: { A: 1, C: 1 } }), 'Bağlantı güçleri çok büyük; hesap taştı. Güçleri azalt.'],
      [explained(bareCircuit([gap('1', 'A', 'B', 0.5), gap('2', 'A', 'B', 0.5)])), 'İki hücre arasında yalnız bir elektriksel bağlantı olabilir.'],
      [explained(bareCircuit([gap('1', 'B', 'A', 0.5)])), 'Elektriksel bağlantı iki farklı hücre arasında kurulmalı ve gücü sıfırdan küçük olmamalı.'],
      [explained(bareCircuit([gap('1', 'A', 'B', -0.5)])), 'Elektriksel bağlantı iki farklı hücre arasında kurulmalı ve gücü sıfırdan küçük olmamalı.'],
      [explained(bareCircuit([edge('1', 'A', 'Z', 0.5)])), 'Devrede olmayan bir hücreye başvuruluyor. Hücre sayısını ve bağlantıları kontrol et.'],
      [explained(bareCircuit([]), { stimulus: { ...config.stimulus, target: 'Z' } }), 'Devrede olmayan bir hücreye başvuruluyor. Hücre sayısını ve bağlantıları kontrol et.'],
      [explained(bareCircuit([]), { stimulus: { ...config.stimulus, amplitude: 2 } }), 'Uyaran genliği 0–1 arasında olmalı.'],
      [explained(bareCircuit([]), { stimulus: { ...config.stimulus, onsetMs: -1 } }), 'Uyaranın başlangıcı ve süresi sıfırdan küçük olamaz.'],
      [explained(bareCircuit([edge('1', 'A', 'B', Number.NaN)])), 'Bir bağlantının gücü geçerli bir sayı değil. Gücü yeniden seç.'],
      [explained(bareCircuit([]), { durationMs: 1e9 }), 'Bu ayarlarla hesap tamamlanamadı. Hücreleri, bağlantıları ve uyaranı kontrol edip yeniden dene.'],
    ]
    for (const [actual, expected] of cases) expect(actual).toBe(expected)
  })

  it('answers non-Error throws with the generic sentence', () => {
    expect(explainEngineError('boom')).toMatch(/^Bu ayarlarla hesap tamamlanamadı/)
    expect(explainEngineError(undefined)).toMatch(/^Bu ayarlarla hesap tamamlanamadı/)
  })

  it('returns a Turkish problem, never the exception, when the engine throws inside runDraft', () => {
    const outcome = runDraft(blankDraft(), () => { throw new Error('dtMs must not exceed tau / (1 + active incident gap conductance) = 5 for A.') })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.problems).toEqual([{ code: 'engine', message: 'Elektriksel bağlantıların toplam gücü bu zaman adımı için çok büyük; hesap kararlı kalamaz. Gap güçlerini azalt.' }])
    }
    const unknown = runDraft(blankDraft(), () => { throw 'plain string' })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.problems[0]!.message).toMatch(/^Bu ayarlarla hesap tamamlanamadı/)
  })
})

describe('presets', () => {
  it('has the four named examples with distinct ids and complete teaching text', () => {
    expect(presets.map(preset => preset.id)).toEqual(['chain', 'excitation-inhibition', 'mutual-inhibition', 'loop'])
    expect(new Set(presets.map(preset => preset.title)).size).toBe(4)
    for (const preset of presets) {
      expect(preset.title.length).toBeGreaterThan(10)
      for (const text of [preset.teaches, preset.look, preset.tryThis, preset.boundary]) expect(text.length).toBeGreaterThan(40)
      expect(preset.teaches + preset.look + preset.tryThis + preset.boundary).not.toMatch(/\d\.\d/)
      expect(new Set(preset.draft.links.map(item => item.id)).size).toBe(preset.draft.links.length)
    }
  })

  it('every preset is valid and runs without engine errors', () => {
    for (const preset of presets) {
      expect(validateDraft(preset.draft), preset.id).toEqual([])
      const outcome = runDraft(preset.draft)
      expect(outcome.ok, preset.id).toBe(true)
      if (outcome.ok) outcome.run.result.timesMs.forEach((_, index) => cellIds(preset.draft.cellCount).forEach(id => {
        expect(Number.isFinite(outcome.run.result.activity[id]![index]!)).toBe(true)
      }))
    }
  })

  it('presetById returns the same object the list holds', () => {
    for (const preset of presets) expect(presetById(preset.id)).toBe(preset)
  })

  describe('chain: activity moves A to B to C, later and weaker at every step', () => {
    const base = run(presetById('chain').draft)
    it('starts later and peaks lower along the chain', () => {
      const [a, b, c] = [cell(base, 'A'), cell(base, 'B'), cell(base, 'C')]
      expect(a.reachMs).toBe(104)
      expect(a.reachMs!).toBeLessThan(b.reachMs!)
      expect(b.reachMs!).toBeLessThan(c.reachMs!)
      expect(c.reachMs! - a.reachMs!).toBeGreaterThan(30)
      expect(a.peak).toBeGreaterThan(b.peak)
      expect(b.peak).toBeGreaterThan(c.peak)
      expect(a.peak).toBeCloseTo(0.799, 3)
      expect(b.peak).toBeCloseTo(0.714, 3)
      expect(c.peak).toBeCloseTo(0.628, 3)
      expect(a.peakTimeMs!).toBeLessThan(b.peakTimeMs!)
      expect(b.peakTimeMs!).toBeLessThan(c.peakTimeMs!)
    })
    it('dies out after the pulse', () => {
      base.cells.forEach(item => expect(item.finalValue).toBeLessThan(REPORT_LEVEL))
    })
    it('"try this": a weaker A→B link lowers B and C', () => {
      const weaker = cloneDraft(presetById('chain').draft)
      weaker.links[0]!.strength = 0.5
      const result = run(weaker)
      expect(cell(result, 'B').peak).toBeCloseTo(0.397, 3)
      expect(cell(result, 'B').peak).toBeLessThan(cell(base, 'B').peak - 0.3)
      expect(cell(result, 'C').peak).toBeLessThan(cell(base, 'C').peak - 0.25)
    })
  })

  describe('excitation vs inhibition onto the same target', () => {
    const base = run(presetById('excitation-inhibition').draft)
    const withoutInhibition = (() => {
      const draft = cloneDraft(presetById('excitation-inhibition').draft)
      draft.links = draft.links.filter(item => item.type !== 'inhibitory')
      return run(draft)
    })()
    it('C rises first and is pulled back once the inhibitory cell B is active', () => {
      const c = cell(base, 'C')
      expect(c.peakTimeMs).toBe(198)
      expect(c.peakTimeMs!).toBeLessThan(base.draft.stimulus.onsetMs + base.draft.stimulus.durationMs)
      expect(at(base, 'C', 300)).toBeLessThan(c.peak - 0.03)
      expect(at(base, 'C', 400)).toBeLessThan(0.05)
    })
    it('the inhibitory link lowers C to less than half of what excitation alone gives, and below B', () => {
      expect(cell(withoutInhibition, 'C').peak).toBeCloseTo(0.714, 3)
      expect(cell(base, 'C').peak).toBeCloseTo(0.331, 3)
      expect(cell(base, 'C').peak).toBeLessThan(cell(withoutInhibition, 'C').peak / 2)
      expect(cell(base, 'C').peak).toBeLessThan(cell(base, 'B').peak / 2)
    })
    it('the inhibitory cell and the source are not changed by the inhibition itself', () => {
      expect(cell(base, 'A').peak).toBe(cell(withoutInhibition, 'A').peak)
      expect(cell(base, 'B').peak).toBe(cell(withoutInhibition, 'B').peak)
    })
  })

  describe('mutual inhibition: the cell with the slightly stronger input wins', () => {
    const base = run(presetById('mutual-inhibition').draft)
    const only = (draft: BuilderDraft, keep: (item: BuilderLink) => boolean) => ({ ...draft, links: draft.links.filter(keep) })
    it('B stays high and C is suppressed after a short early rise', () => {
      expect(cell(base, 'B').peak).toBeGreaterThan(0.65)
      expect(cell(base, 'C').peak).toBeLessThan(0.2)
      expect(cell(base, 'C').peakTimeMs).toBeLessThan(base.draft.stimulus.onsetMs + base.draft.stimulus.durationMs - 100)
      expect(at(base, 'C', 300)).toBeLessThan(0.01)
      expect(at(base, 'B', 300)).toBeGreaterThan(0.65)
    })
    it('without the mutual inhibition both would respond almost equally', () => {
      const control = run(only(presetById('mutual-inhibition').draft, item => item.type !== 'inhibitory'))
      expect(cell(control, 'C').peak).toBeGreaterThan(0.6)
      expect(cell(control, 'B').peak - cell(control, 'C').peak).toBeLessThan(0.1)
    })
    it('"try this": a stronger A→C input makes C the winner', () => {
      const flipped = cloneDraft(presetById('mutual-inhibition').draft)
      flipped.links.find(item => item.source === 'A' && item.target === 'C')!.strength = 0.95
      const result = run(flipped)
      expect(cell(result, 'C').peak).toBeGreaterThan(0.65)
      expect(cell(result, 'B').peak).toBeLessThan(0.25)
      expect(at(result, 'B', 300)).toBeLessThan(0.01)
    })
  })

  describe('loop: chemical gain 1 is the threshold at which activity outlasts the pulse', () => {
    const draft = presetById('loop').draft
    const base = run(draft)
    const scaled = (strength: number) => {
      const copy = cloneDraft(draft)
      copy.links.forEach(item => { item.strength = strength })
      return run(copy)
    }
    it('every cell receives chemical weights summing to exactly 1', () => {
      for (const id of cellIds(draft.cellCount)) {
        const incoming = draft.links.filter(item => item.target === id && item.type === 'excitatory').reduce((sum, item) => sum + item.strength, 0)
        expect(incoming).toBe(1)
      }
    })
    it('stays high long after the pulse ended and barely changes over the last 300 ms', () => {
      expect(base.draft.stimulus.onsetMs + base.draft.stimulus.durationMs).toBe(300)
      for (const id of cellIds(3)) {
        expect(cell(base, id).finalValue).toBeGreaterThan(0.9)
        expect(Math.abs(at(base, id, 700) - at(base, id, 400))).toBeLessThan(0.01)
      }
      expect(base.facts.at(-1)).toContain('hâlâ 0,10 düzeyinde ya da üstünde')
    })
    it('below 1 (0,8) the activity decays under the reporting level and keeps falling', () => {
      const below = scaled(0.8)
      for (const id of cellIds(3)) {
        expect(cell(below, id).finalValue).toBeLessThan(REPORT_LEVEL)
        expect(at(below, id, 700)).toBeLessThan(at(below, id, 400) / 2)
      }
      expect(below.facts.at(-1)).toContain('altına indi')
    })
    it('above 1 (1,2) the activity grows to the upper bound 1', () => {
      const above = scaled(1.2)
      for (const id of cellIds(3)) {
        expect(cell(above, id).finalValue).toBeGreaterThan(0.999)
        expect(at(above, id, 400)).toBeGreaterThan(at(base, id, 400) - 1e-9)
      }
    })
  })
})
