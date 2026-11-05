import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRealConnectome, buildRealCircuit } from '../model/realConnectome'
import { defaultConfig, illustrativeCircuit } from '../model/circuit'
import { simulate } from '../model/simulation'
import { prepareRealInspection } from './readingHandoff'
import type { ExperimentDraft } from './readingHandoff'

const data = parseRealConnectome(JSON.parse(readFileSync(new URL('../../data/local/cook-subset.json', import.meta.url), 'utf8')))
const toy: Readonly<ExperimentDraft> = Object.freeze({ mode: 'illustrative', graphView: '3d', chemicalGain: .5, gapGain: .4,
  focusConnections: false, scaleToResponse: true, activeCondition: 'tau', stimulusTarget: 'S2', amplitude: .55,
  pulseDuration: 150, baseTau: 50, changedTau: 180, changedNeuron: 'O2', selectedEdge: 'I4-O1',
  outputNeuron: 'O2', selectedNeuron: 'I2', dt: 2, cursorMs: 400, playing: true })
const scalarKeys = ['graphView', 'chemicalGain', 'gapGain', 'focusConnections', 'scaleToResponse', 'activeCondition',
  'amplitude', 'pulseDuration', 'baseTau', 'changedTau', 'dt', 'cursorMs', 'playing'] as const

describe('anatomical inspection preserves existing experiment drafts', () => {
  it('maps only invalid toy source identities and preserves every scalar control', () => {
    const next = prepareRealInspection(toy, data, 'RICL')
    for (const key of scalarKeys) expect(next[key]).toBe(toy[key])
    expect(next).toMatchObject({ mode: 'real', selectedNeuron: 'RICL', stimulusTarget: 'AVER',
      outputNeuron: 'AVAR', changedNeuron: 'AVAR', selectedEdge: 'chemical:AVER->AVAR' })
    expect(toy.mode).toBe('illustrative')
    expect(toy.selectedNeuron).toBe('I2')
    expect(Object.isFrozen(next)).toBe(true)
  })
  it('changes only the display selection for a valid real draft, including a physical gap ablation', () => {
    const before: ExperimentDraft = { ...toy, mode: 'real', stimulusTarget: 'OLLL', outputNeuron: 'DA08',
      changedNeuron: 'RIS', selectedNeuron: 'AVER', selectedEdge: 'gap:AVAR--AVER' }
    expect(prepareRealInspection(before, data, 'AVBR')).toEqual({ ...before, selectedNeuron: 'AVBR' })
  })
  it('preserves all three computed traces when a real display selection changes', () => {
    const before: ExperimentDraft = { ...toy, mode: 'real', stimulusTarget: 'AVER', outputNeuron: 'AVAR',
      changedNeuron: 'AVAR', selectedNeuron: 'AVER', selectedEdge: 'chemical:AVER->AVAR' }
    const next = prepareRealInspection(before, data, 'RICL')
    const results = (draft: Readonly<ExperimentDraft>) => {
      const circuit = buildRealCircuit(data, { chemicalGain: draft.chemicalGain, gapGain: draft.gapGain })
      const config = { ...defaultConfig, dtMs: draft.dt, tauMs: draft.baseTau,
        stimulus: { ...defaultConfig.stimulus, target: draft.stimulusTarget, amplitude: draft.amplitude, durationMs: draft.pulseDuration } }
      return [simulate(circuit, config), simulate(circuit, { ...config, silencedConnectionId: draft.selectedEdge }),
        simulate(circuit, { ...config, tauOverrides: { [draft.changedNeuron]: draft.changedTau } })]
    }
    expect(results(next)).toEqual(results(before))
  })
  it('leaves a stored toy draft able to reproduce its numerical results exactly', () => {
    const config = { ...defaultConfig, dtMs: toy.dt, tauMs: toy.baseTau,
      stimulus: { ...defaultConfig.stimulus, target: toy.stimulusTarget, amplitude: toy.amplitude, durationMs: toy.pulseDuration } }
    const before = simulate(illustrativeCircuit, config)
    prepareRealInspection(toy, data, 'AVAR')
    expect(simulate(illustrativeCircuit, config)).toEqual(before)
  })
  it('rejects an unknown inspected cell before producing any replacement draft', () => {
    const before = JSON.stringify(toy)
    expect(() => prepareRealInspection(toy, data, 'not-a-cell')).toThrow(/inspected neuron/)
    expect(JSON.stringify(toy)).toBe(before)
  })
  it('retains each valid ID even when other draft identities need mapping', () => {
    const before: ExperimentDraft = { ...toy, stimulusTarget: 'OLLL', changedNeuron: 'RIS', selectedEdge: 'chemical:OLLL->OLLL' }
    expect(prepareRealInspection(before, data, 'AVAR')).toMatchObject({ stimulusTarget: 'OLLL', changedNeuron: 'RIS',
      selectedEdge: 'chemical:OLLL->OLLL', outputNeuron: 'AVAR' })
  })
})
