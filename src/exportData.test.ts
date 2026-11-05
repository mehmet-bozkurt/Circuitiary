import { describe, expect, it } from 'vitest'
import pkg from '../package.json'
import { buildCsv, buildExportRecord, csvCell, csvFile, EXPORT_NOTE, jsonFile, plainNumber, stringifyRecord } from './exportData'
import type { JsonExportArgs } from './exportData'
import { defaultConfig, illustrativeCircuit } from './model/circuit'
import { simulate } from './model/simulation'
import type { ConnectomeDataset, DeepReadonly, SimulationResult } from './model/types'

const config = { ...defaultConfig, durationMs: 60, stimulus: { ...defaultConfig.stimulus, onsetMs: 2, durationMs: 10 } }
const results = {
  baseline: simulate(illustrativeCircuit, config),
  silenced: simulate(illustrativeCircuit, { ...config, silencedConnectionId: 'I3-O1' }),
  tau: simulate(illustrativeCircuit, { ...config, tauOverrides: { O1: 90 } }),
}
const args: JsonExportArgs = { mode: 'illustrative', circuit: illustrativeCircuit, results, outputCell: 'O1', appVersion: pkg.version }

describe('plainNumber', () => {
  it('uses a dot, trims zeros, and removes float noise and negative zero', () => {
    expect(plainNumber(0.8)).toBe('0.8')
    expect(plainNumber(1)).toBe('1')
    expect(plainNumber(0.1 + 0.2)).toBe('0.3')
    expect(plainNumber(0.0625)).toBe('0.0625')
    expect(plainNumber(-0)).toBe('0')
    expect(plainNumber(-1e-12)).toBe('0')
    expect(plainNumber(1 / 3)).toBe('0.33333333')
    expect(plainNumber(1e-7)).toBe('0.0000001')
    expect(plainNumber(Number.NaN)).toBe('')
  })
})

describe('csvCell', () => {
  it('quotes only cells with a comma, quote or line break and doubles inner quotes', () => {
    expect(csvCell('AVAR')).toBe('AVAR')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('cr\r')).toBe('"cr\r"')
  })
})

describe('buildCsv', () => {
  const small: Pick<SimulationResult, 'timesMs' | 'activity'> = { timesMs: [0, 0.5, 1], activity: { B: [0, 0.25, 0.1 + 0.2], 'A,x': [1, 0, 0.0625] } }

  it('writes a header row and one row per sample, in the given column order', () => {
    expect(buildCsv(['B', 'A,x'], small)).toBe('time_ms,B,"A,x"\n0,0,1\n0.5,0.25,0\n1,0.3,0.0625\n')
    expect(buildCsv(['A,x', 'B'], small).split('\n')[0]).toBe('time_ms,"A,x",B')
  })

  it('leaves a cell empty rather than writing a made-up number when a series is missing', () => {
    expect(buildCsv(['B', 'Z'], small)).toBe('time_ms,B,Z\n0,0,\n0.5,0.25,\n1,0.3,\n')
  })

  it('has no decimal comma, no BOM and ends with one newline', () => {
    const text = buildCsv(illustrativeCircuit.neurons.map(n => n.id), results.baseline)
    expect(text.startsWith('time_ms,S1,S2,I1,I2,I3,I4,O1,O2\n')).toBe(true)
    expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true)
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
    const rows = text.trimEnd().split('\n').map(line => line.split(','))
    expect(rows).toHaveLength(results.baseline.timesMs.length + 1)
    expect(rows.every(row => row.length === 9)).toBe(true)
    expect(rows.slice(1).every(row => row.every(cell => /^-?\d+(\.\d+)?$/.test(cell)))).toBe(true)
  })
})

describe('csvFile', () => {
  it('names the file after the circuit and the condition in ASCII and keeps the circuit cell order', () => {
    const file = csvFile({ mode: 'illustrative', condition: 'silenced', circuit: illustrativeCircuit, result: results.silenced })
    expect(file.name).toBe('circuitiary-sekiz-hucreli-baglanti-susturuldu.csv')
    expect(file.type).toBe('text/csv;charset=utf-8')
    expect(file.text).toBe(buildCsv(['S1', 'S2', 'I1', 'I2', 'I3', 'I4', 'O1', 'O2'], results.silenced))
    for (const condition of ['baseline', 'silenced', 'tau'] as const) {
      expect(csvFile({ mode: 'real', condition, circuit: illustrativeCircuit, result: results[condition] }).name).toMatch(/^circuitiary-c-elegans-yerel-[a-z-]+\.csv$/)
    }
  })

  it('carries the values of the result it was given', () => {
    const file = csvFile({ mode: 'illustrative', condition: 'tau', circuit: illustrativeCircuit, result: results.tau })
    const o1Column = file.text.split('\n')[0]!.split(',').indexOf('O1')
    const column = file.text.trimEnd().split('\n').slice(1).map(line => Number(line.split(',')[o1Column]))
    column.forEach((value, index) => expect(value).toBeCloseTo(results.tau.activity.O1![index]!, 8))
  })
})

describe('JSON export', () => {
  it('has the documented shape for the example circuit', () => {
    const record = buildExportRecord(args) as Record<string, any>
    expect(Object.keys(record)).toEqual(['format', 'formatVersion', 'app', 'note', 'scope', 'mode', 'circuit', 'settings', 'output'])
    expect(record.format).toBe('circuitiary-output-series')
    expect(record.formatVersion).toBe(1)
    expect(record.app).toEqual({ name: 'Circuitiary', version: pkg.version })
    expect(record.note).toBe(EXPORT_NOTE)
    expect(record.note).toBe('Model çıktısı; ölçüm değildir')
    expect(record.scope).toContain('biyolojik veri')
    expect(record.circuit).toEqual({ id: illustrativeCircuit.id, name: illustrativeCircuit.name, neuronCount: 8, connectionCount: 12 })
    expect(record.settings).toEqual({
      durationMs: 60, dtMs: 1, baseTauMs: 30,
      stimulus: { target: 'S1', onsetMs: 2, durationMs: 10, amplitude: 0.8 },
      silencedConnection: 'I3-O1', tauOverridesMs: { O1: 90 },
    })
    expect(record.output.cell).toBe('O1')
    expect(record.output.timesMs).toHaveLength(61)
    expect(record.output.timesMs.at(-1)).toBe(60)
    expect(Object.keys(record.output.conditions)).toEqual(['baseline', 'silenced', 'tau'])
    expect(record.source).toBeUndefined()
  })

  it('carries the output cell series of all three conditions with their peaks', () => {
    const record = buildExportRecord({ ...args, outputCell: 'O1' }) as Record<string, any>
    for (const id of ['baseline', 'silenced', 'tau'] as const) {
      const series: number[] = record.output.conditions[id].activity
      expect(series).toHaveLength(61)
      series.forEach((value, index) => expect(value).toBeCloseTo(results[id].activity.O1![index]!, 8))
      expect(record.output.conditions[id].peak).toBeCloseTo(Math.max(...results[id].activity.O1!), 8)
    }
    expect(record.output.conditions.silenced.activity).not.toEqual(record.output.conditions.baseline.activity)
  })

  it('serialises to valid JSON with number series on one line and a trailing newline', () => {
    const file = jsonFile(args)
    expect(file.type).toBe('application/json;charset=utf-8')
    expect(file.text.endsWith('}\n')).toBe(true)
    expect(JSON.parse(file.text)).toEqual(JSON.parse(JSON.stringify(buildExportRecord(args))))
    expect(file.text.split('\n').length).toBeLessThan(80)
    expect(file.text).toMatch(/"timesMs": \[0,1,2,3,/)
    expect(file.text).toContain('"note": "Model çıktısı; ölçüm değildir"')
  })

  it('names the file in ASCII after mode and output cell, whatever the cell is called', () => {
    expect(jsonFile(args).name).toBe('circuitiary-sekiz-hucreli-O1-uc-kosul.json')
    expect(jsonFile({ ...args, mode: 'real', outputCell: 'AVAR' }).name).toBe('circuitiary-c-elegans-yerel-AVAR-uc-kosul.json')
    expect(jsonFile({ ...args, outputCell: 'çıktı/1' }).name).toBe('circuitiary-sekiz-hucreli-kt-1-uc-kosul.json')
    expect(jsonFile({ ...args, outputCell: 'ğüş' }).name).toBe('circuitiary-sekiz-hucreli-hucre-uc-kosul.json')
    expect(jsonFile(args).name).toMatch(/^[A-Za-z0-9.-]+$/)
  })

  it('adds the source attribution and the gains in real mode only', () => {
    const dataset = {
      id: 'test-dataset', title: 'Test başlık', version: 'v1', doi: '10.0000/test',
      sources: [{ name: 'file.xlsx', url: 'https://example.org/file.xlsx', sha256: 'abc', downloadedAtUtc: '2020-01-01T00:00:00Z', extra: 'not copied' }],
      license: { status: 'unverified-local-only', note: 'Yeniden dağıtım izni doğrulanmadı.' },
      anatomicalWeightUnit: 'x', orientation: 'y', provenanceNotes: [],
    } as unknown as DeepReadonly<ConnectomeDataset>
    const circuit = { ...illustrativeCircuit, realData: { parameters: { chemicalGain: 0.7, gapGain: 0.3 } } } as unknown as JsonExportArgs['circuit']
    const record = buildExportRecord({ ...args, mode: 'real', circuit, dataset }) as Record<string, any>
    expect(record.mode).toBe('real')
    expect(record.scope).toContain('Cook2019')
    expect(record.settings.chemicalGain).toBe(0.7)
    expect(record.settings.gapGain).toBe(0.3)
    expect(record.source.dataset).toEqual({ id: 'test-dataset', title: 'Test başlık', version: 'v1', doi: '10.0000/test' })
    expect(record.source.files).toEqual([{ name: 'file.xlsx', url: 'https://example.org/file.xlsx', sha256: 'abc', downloadedAtUtc: '2020-01-01T00:00:00Z' }])
    expect(record.source.license).toEqual({ status: 'unverified-local-only', note: 'Yeniden dağıtım izni doğrulanmadı.' })
    expect(record.source.statement).toContain('yalnız yerel kullanım')
    expect(record.note).toBe(EXPORT_NOTE)
    expect((buildExportRecord({ ...args, dataset }) as Record<string, any>).source).toBeUndefined()
  })
})

describe('stringifyRecord', () => {
  it('collapses only arrays made of numbers', () => {
    const text = stringifyRecord({ a: [1, 2.5, -3, 1e-7], b: ['x', 'y'], c: [], d: [[1, 2]] })
    expect(text).toContain('"a": [1,2.5,-3,1e-7]')
    expect(text).toContain('"b": [\n')
    expect(JSON.parse(text)).toEqual({ a: [1, 2.5, -3, 1e-7], b: ['x', 'y'], c: [], d: [[1, 2]] })
  })
})
