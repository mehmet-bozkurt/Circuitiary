import { describe, expect, it } from 'vitest'
import { buildShareUrl, dtChoices, numberRanges, parseShareQuery, restrictToCircuit, shareFields, shareNotice, withoutRealSelections } from './shareState'
import type { ShareIds, ShareState } from './shareState'

const toy: ShareState = {
  mode: 'illustrative', graphView: '2d', activeCondition: 'baseline', stimulusTarget: 'S1', amplitude: 0.8, pulseDuration: 200,
  baseTau: 30, changedNeuron: 'O1', changedTau: 90, selectedEdge: 'I3-O1', outputNeuron: 'O1', selectedNeuron: 'S1', dt: 1,
  chemicalGain: 1, gapGain: 0.5, focusConnections: true, scaleToResponse: false,
}
const real: ShareState = {
  ...toy, mode: 'real', graphView: '3d', activeCondition: 'silenced', stimulusTarget: 'AVER', outputNeuron: 'AVAR', changedNeuron: 'AVAR',
  selectedEdge: 'AVER>AVAR', selectedNeuron: 'AVER', amplitude: 0.35, baseTau: 45, changedTau: 175, dt: 0.0625, chemicalGain: 0.7, gapGain: 0.3, focusConnections: false, scaleToResponse: true,
}
const toyIds: ShareIds = { stimulusTargets: ['S1', 'S2'], outputs: ['O1', 'O2'], neurons: ['S1', 'S2', 'I1', 'O1', 'O2'], edges: ['I3-O1', 'S1-I1'] }
const query = (url: string) => new URL(url).search

describe('buildShareUrl', () => {
  it('writes every experiment setting under its documented short key, in a fixed order', () => {
    const url = new URL(buildShareUrl(toy, 'http://127.0.0.1:4176/'))
    expect(url.pathname).toBe('/')
    expect(url.hash).toBe('')
    expect([...url.searchParams.keys()]).toEqual(['m', 'v', 'c', 'st', 'am', 'du', 'tb', 'tn', 'tc', 'se', 'o', 'n', 'dt', 'sc'])
    expect(Object.fromEntries(url.searchParams)).toEqual({
      m: 'illustrative', v: '2d', c: 'baseline', st: 'S1', am: '0.8', du: '200', tb: '30', tn: 'O1', tc: '90', se: 'I3-O1', o: 'O1', n: 'S1', dt: '1', sc: '0',
    })
  })

  it('adds the real-data gains and focus flag only in real mode, with dot decimals and no float noise', () => {
    const url = new URL(buildShareUrl({ ...real, chemicalGain: 0.1 + 0.2, amplitude: 0.15000000000000002 }, 'http://localhost/'))
    expect(url.searchParams.get('cg')).toBe('0.3')
    expect(url.searchParams.get('am')).toBe('0.15')
    expect(url.searchParams.get('gg')).toBe('0.3')
    expect(url.searchParams.get('fc')).toBe('0')
    expect(url.searchParams.get('dt')).toBe('0.0625')
    expect(buildShareUrl(toy, 'http://localhost/')).not.toMatch(/[?&](cg|gg|fc)=/)
  })

  it('drops an existing query and hash from the base address', () => {
    expect(buildShareUrl(toy, 'http://localhost/?x=1#top')).toMatch(/^http:\/\/localhost\/\?m=illustrative&/)
    expect(buildShareUrl(toy, 'http://localhost/?x=1#top')).not.toContain('#')
  })

  it('keeps every short key unique', () => {
    const keys = Object.values(shareFields).map(field => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('parseShareQuery', () => {
  it('round-trips the example and the real-data state', () => {
    for (const state of [toy, real]) {
      const parsed = parseShareQuery(query(buildShareUrl(state, 'http://localhost/')))
      expect(parsed.ignored).toEqual([])
      expect(parsed.found).toBe(true)
      const expected = state.mode === 'real' ? state : Object.fromEntries(Object.entries(state).filter(([field]) => !['chemicalGain', 'gapGain', 'focusConnections'].includes(field)))
      expect(parsed.values).toEqual(expected)
    }
  })

  it('round-trips every slider extreme and every time step', () => {
    for (const [field, range] of Object.entries(numberRanges)) {
      for (const value of [range.min, range.max]) {
        const state = { ...real, [field]: value }
        expect(parseShareQuery(query(buildShareUrl(state, 'http://localhost/'))).values[field as keyof ShareState]).toBe(value)
      }
    }
    for (const dt of dtChoices) expect(parseShareQuery(`?dt=${dt}`).values.dt).toBe(dt)
  })

  it('finds nothing in an address without our keys and ignores unknown keys silently', () => {
    expect(parseShareQuery('')).toEqual({ found: false, values: {}, ignored: [] })
    expect(parseShareQuery('?utm_source=x&foo=bar')).toEqual({ found: false, values: {}, ignored: [] })
    const mixed = parseShareQuery('?utm_source=x&am=0.5')
    expect(mixed).toEqual({ found: true, values: { amplitude: 0.5 }, ignored: [] })
  })

  it('rejects values of the wrong type, outside the range or off the slider step', () => {
    const bad = parseShareQuery('?m=both&v=4d&c=other&am=1.05&du=45&tb=7&tc=185&dt=3&cg=2.1&gg=-1&fc=yes&sc=2')
    expect(bad.values).toEqual({})
    expect(bad.ignored.sort()).toEqual(['activeCondition', 'amplitude', 'baseTau', 'changedTau', 'chemicalGain', 'dt', 'focusConnections', 'gapGain', 'graphView', 'mode', 'pulseDuration', 'scaleToResponse'].sort())
  })

  it('rejects number spellings other than a plain dot decimal', () => {
    for (const text of ['0,5', '+0.5', '.5', '5e-1', ' 0.5', '0.5 ', '00.5', '0.5.1', 'NaN', 'Infinity', '0x1', '']) {
      expect(parseShareQuery(`?am=${encodeURIComponent(text)}`).values, JSON.stringify(text)).toEqual({})
    }
    expect(parseShareQuery('?am=0.50').values.amplitude).toBe(0.5)
  })

  it('treats a repeated key as ambiguous and ignores both values', () => {
    const repeated = parseShareQuery('?am=0.5&am=0.6&m=real')
    expect(repeated.values).toEqual({ mode: 'real' })
    expect(repeated.ignored).toEqual(['amplitude'])
  })

  it('rejects empty, oversized and control-character cell IDs', () => {
    expect(parseShareQuery('?o=').ignored).toEqual(['outputNeuron'])
    expect(parseShareQuery(`?o=${'A'.repeat(65)}`).ignored).toEqual(['outputNeuron'])
    expect(parseShareQuery('?o=A%00B').ignored).toEqual(['outputNeuron'])
    expect(parseShareQuery(`?o=${'A'.repeat(64)}`).values.outputNeuron).toBe('A'.repeat(64))
  })

  it('does not trust prototype-looking names: they are plain IDs that the circuit then refuses', () => {
    const parsed = restrictToCircuit(parseShareQuery('?o=constructor&st=__proto__&n=toString'), toyIds, 'illustrative')
    expect(parsed.values).toEqual({})
    expect(parsed.ignored.sort()).toEqual(['outputNeuron', 'selectedNeuron', 'stimulusTarget'])
  })
})

describe('restrictToCircuit', () => {
  it('keeps IDs the circuit has and reports the rest', () => {
    const parsed = restrictToCircuit(parseShareQuery('?st=S2&o=O2&tn=I1&n=S1&se=I3-O1'), toyIds, 'illustrative')
    expect(parsed.ignored).toEqual([])
    expect(parsed.values).toEqual({ stimulusTarget: 'S2', outputNeuron: 'O2', changedNeuron: 'I1', selectedNeuron: 'S1', selectedEdge: 'I3-O1' })
    const wrong = restrictToCircuit(parseShareQuery('?st=I1&o=S1&tn=AVER&n=AVAR&se=nope'), toyIds, 'illustrative')
    expect(wrong.values).toEqual({})
    expect(wrong.ignored).toEqual(['stimulusTarget', 'outputNeuron', 'changedNeuron', 'selectedNeuron', 'selectedEdge'])
  })

  it('silently drops the real-only settings in the example, but keeps them for real data', () => {
    const parsed = parseShareQuery('?cg=0.5&gg=0.2&fc=0&cg=1')
    expect(restrictToCircuit(parsed, toyIds, 'illustrative').ignored).toEqual([])
    expect(restrictToCircuit(parseShareQuery('?cg=0.5&gg=0.2&fc=0'), toyIds, 'illustrative').values).toEqual({})
    expect(restrictToCircuit(parseShareQuery('?cg=0.5&gg=0.2&fc=0'), toyIds, 'real').values).toEqual({ chemicalGain: 0.5, gapGain: 0.2, focusConnections: false })
  })
})

describe('withoutRealSelections', () => {
  it('falls back to the example without listing the real-only parts as invalid', () => {
    const parsed = withoutRealSelections(parseShareQuery('?m=real&st=AVER&o=AVAR&am=0.4&cg=0.5&du=45'))
    expect(parsed.values).toEqual({ mode: 'illustrative', amplitude: 0.4 })
    expect(parsed.ignored).toEqual(['pulseDuration'])
  })
})

describe('shareNotice', () => {
  it('says the settings were applied, and lists ignored parts by name', () => {
    expect(shareNotice({ applied: 4, ignored: [], realUnavailable: false })).toBe('Bağlantıdaki ayarlar uygulandı.')
    expect(shareNotice({ applied: 4, ignored: ['amplitude', 'dt'], realUnavailable: false }))
      .toBe('Bağlantıdaki ayarlar uygulandı. Geçersiz olduğu için yok sayılan parçalar: Uyaran gücü, Zaman adımı.')
  })

  it('says when real data is unavailable and when nothing was usable', () => {
    expect(shareNotice({ applied: 2, ignored: [], realUnavailable: true })).toContain('yerel veri bu bilgisayarda yok')
    expect(shareNotice({ applied: 2, ignored: [], realUnavailable: true })).toContain('sekiz hücreli örneğe')
    expect(shareNotice({ applied: 0, ignored: ['mode'], realUnavailable: false })).toContain('geçerli ayar bulunamadı')
  })
})
