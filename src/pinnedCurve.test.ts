import { describe, expect, it } from 'vitest'
import { changedSettings } from './pinnedCurve'
import { sampleAt, sampleRows } from './chartTableRows'
import type { ShareState } from './shareState'

const base: ShareState = {
  mode: 'illustrative', graphView: '2d', activeCondition: 'baseline',
  chemicalGain: 1, gapGain: 0.2, focusConnections: true, scaleToResponse: false,
  stimulusTarget: 'S1', amplitude: 0.5, pulseDuration: 200, baseTau: 30, changedTau: 90, changedNeuron: 'O1',
  selectedEdge: 'I3-O1', outputNeuron: 'O1', selectedNeuron: 'S1', dt: 1,
}

describe('changedSettings', () => {
  it('is empty while nothing that defines a curve has changed', () => {
    expect(changedSettings(base, { ...base })).toEqual([])
    // Viewing choices never change a curve.
    expect(changedSettings(base, { ...base, graphView: '3d', selectedNeuron: 'O2', focusConnections: false, scaleToResponse: true })).toEqual([])
  })

  it('lists the changed settings in a fixed order', () => {
    expect(changedSettings(base, { ...base, dt: 0.5, amplitude: 0.8, outputNeuron: 'O2' })).toEqual(['outputNeuron', 'amplitude', 'dt'])
    expect(changedSettings(base, { ...base, stimulusTarget: 'S2', pulseDuration: 100, baseTau: 45 })).toEqual(['stimulusTarget', 'pulseDuration', 'baseTau'])
  })

  it('counts the silenced connection only when one of the two curves is the silenced condition', () => {
    expect(changedSettings(base, { ...base, selectedEdge: 'I4-O1' })).toEqual([])
    expect(changedSettings({ ...base, activeCondition: 'silenced' }, { ...base, activeCondition: 'silenced', selectedEdge: 'I4-O1' })).toEqual(['selectedEdge'])
    expect(changedSettings(base, { ...base, activeCondition: 'silenced', selectedEdge: 'I4-O1' })).toEqual(['activeCondition', 'selectedEdge'])
  })

  it('counts the changed cell and its time constant only when one of the two curves is the tau condition', () => {
    expect(changedSettings(base, { ...base, changedTau: 150, changedNeuron: 'I4' })).toEqual([])
    expect(changedSettings({ ...base, activeCondition: 'tau' }, { ...base, activeCondition: 'tau', changedTau: 150, changedNeuron: 'I4' })).toEqual(['changedNeuron', 'changedTau'])
  })

  it('counts the two gains only with real data', () => {
    expect(changedSettings(base, { ...base, chemicalGain: 1.5, gapGain: 0.4 })).toEqual([])
    const real: ShareState = { ...base, mode: 'real' }
    expect(changedSettings(real, { ...real, chemicalGain: 1.5, gapGain: 0.4 })).toEqual(['chemicalGain', 'gapGain'])
  })
})

describe('a pinned curve in the data table', () => {
  const grid = (dt: number, duration = 700) => Array.from({ length: Math.round(duration / dt) + 1 }, (_, index) => index * dt)

  it('reads a series with its own time step at the same moment, not the same index', () => {
    const times = grid(0.5)
    const pinnedTimes = grid(2)
    const current = times.map(time => time / 1000)
    const pinned = pinnedTimes.map(time => 1 - time / 1000)
    const rows = sampleRows(times, [{ id: 'baseline', values: current }, { id: 'pinned', values: pinned, times: pinnedTimes }], 10)
    expect(rows).toHaveLength(71)
    expect(rows[0]).toEqual({ timeMs: 0, values: [0, 1] })
    expect(rows[25]!.timeMs).toBe(250)
    expect(rows[25]!.values[0]).toBe(current[500])
    expect(rows[25]!.values[1]).toBe(pinned[125])
    expect(rows.at(-1)!.values[1]).toBe(pinned.at(-1))
  })

  it('gives null where the series has no sample at that time', () => {
    expect(sampleAt([0, 2, 4], [0.1, 0.2, 0.3], 2)).toBe(0.2)
    expect(sampleAt([0, 2, 4], [0.1, 0.2, 0.3], 3)).toBeNull()
    expect(sampleAt([0, 2, 4], [0.1, 0.2, 0.3], 6)).toBeNull()
    expect(sampleAt([], [], 0)).toBeNull()
    expect(sampleAt([0], [0.5], 0)).toBe(0.5)
  })
})
