import { afterEach, describe, expect, it } from 'vitest'
import { locale } from './i18n'
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

describe('share text in English', () => {
  afterEach(() => { locale.value = 'tr' })

  it('has an English name beside every Turkish field name', () => {
    for (const field of Object.values(shareFields)) {
      expect(field.label).not.toBe('')
      expect(field.labelEn).not.toBe('')
      expect(field.labelEn).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
    }
    expect(shareFields.amplitude.label).toBe('Uyaran gücü')
  })

  it('writes the notice in the language of the moment it is called', () => {
    const outcome = { applied: 4, ignored: ['amplitude', 'dt'], realUnavailable: false } as const
    const turkish = shareNotice(outcome)
    locale.value = 'en'
    expect(shareNotice({ applied: 4, ignored: [], realUnavailable: false })).toBe('The settings in the link were applied.')
    expect(shareNotice(outcome)).toBe('The settings in the link were applied. Parts ignored because they were invalid: Stimulus strength, Time step.')
    expect(shareNotice({ applied: 2, ignored: [], realUnavailable: true })).toContain('the local data is not on this computer')
    expect(shareNotice({ applied: 2, ignored: [], realUnavailable: true })).toContain('eight-cell example')
    expect(shareNotice({ applied: 0, ignored: ['mode'], realUnavailable: false })).toBe('No valid setting was found in the link; the default experiment was opened. Parts ignored because they were invalid: Circuit mode.')
    for (const realUnavailable of [true, false]) for (const applied of [0, 3]) {
      expect(shareNotice({ applied, ignored: Object.keys(shareFields) as Array<keyof typeof shareFields>, realUnavailable })).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
    }
    locale.value = 'tr'
    expect(shareNotice(outcome)).toBe(turkish)
  })

  it('builds the same link in both languages', () => {
    const turkish = buildShareUrl(real, 'http://localhost/')
    locale.value = 'en'
    expect(buildShareUrl(real, 'http://localhost/')).toBe(turkish)
  })
})

describe('stimulus protocol in the link', () => {
  const protocol: ShareState = { ...toy, stimulusShape: 'sine', sinePeriod: 250, noiseAmplitude: 0.15, noiseSeed: 7 }
  const defaults: ShareState = { ...toy, stimulusShape: 'pulse', sinePeriod: 100, noiseAmplitude: 0, noiseSeed: 1 }
  // What a link of the example carries: the real-only settings are not written in that mode.
  const inToyLink = (state: ShareState) => Object.fromEntries(Object.entries(state).filter(([field]) => !['chemicalGain', 'gapGain', 'focusConnections'].includes(field)))

  it('leaves the link of a default experiment exactly as it was before the protocol existed', () => {
    const before = 'http://localhost/?m=illustrative&v=2d&c=baseline&st=S1&am=0.8&du=200&tb=30&tn=O1&tc=90&se=I3-O1&o=O1&n=S1&dt=1&sc=0'
    expect(buildShareUrl(toy, 'http://localhost/')).toBe(before)
    expect(buildShareUrl(defaults, 'http://localhost/')).toBe(before)
    expect(buildShareUrl({ ...real, ...{ stimulusShape: 'pulse', sinePeriod: 100, noiseAmplitude: 0, noiseSeed: 1 } }, 'http://localhost/')).toBe(buildShareUrl(real, 'http://localhost/'))
  })

  it('writes each key only where it differs from its default, after the stimulus duration', () => {
    const url = new URL(buildShareUrl(protocol, 'http://localhost/'))
    expect([...url.searchParams.keys()]).toEqual(['m', 'v', 'c', 'st', 'am', 'du', 'sh', 'sp', 'na', 'ns', 'tb', 'tn', 'tc', 'se', 'o', 'n', 'dt', 'sc'])
    expect(url.searchParams.get('sh')).toBe('sine')
    expect(url.searchParams.get('sp')).toBe('250')
    expect(url.searchParams.get('na')).toBe('0.15')
    expect(url.searchParams.get('ns')).toBe('7')
    const onlyShape = new URL(buildShareUrl({ ...defaults, stimulusShape: 'ramp' }, 'http://localhost/'))
    expect(onlyShape.searchParams.get('sh')).toBe('ramp')
    for (const key of ['sp', 'na', 'ns']) expect(onlyShape.searchParams.has(key), key).toBe(false)
    // No float noise from the slider arithmetic.
    expect(new URL(buildShareUrl({ ...defaults, noiseAmplitude: 0.1 + 0.2 }, 'http://localhost/')).searchParams.get('na')).toBe('0.3')
  })

  it('round-trips the protocol; defaults come back as absent', () => {
    const parsed = parseShareQuery(query(buildShareUrl(protocol, 'http://localhost/')))
    expect(parsed.ignored).toEqual([])
    expect(parsed.values).toEqual(inToyLink(protocol))
    const plain = parseShareQuery(query(buildShareUrl(defaults, 'http://localhost/')))
    expect(plain.ignored).toEqual([])
    expect(plain.values).toEqual(inToyLink(toy))
    for (const key of ['stimulusShape', 'sinePeriod', 'noiseAmplitude', 'noiseSeed'] as const) expect(key in plain.values, key).toBe(false)
  })

  it('round-trips every shape, both ends of both sliders and the seed range', () => {
    for (const stimulusShape of ['pulse', 'ramp', 'sine'] as const) expect(parseShareQuery(`?sh=${stimulusShape}`).values).toEqual({ stimulusShape })
    for (const sinePeriod of [50, 100, 400]) expect(parseShareQuery(`?sp=${sinePeriod}`).values).toEqual({ sinePeriod })
    for (const noiseAmplitude of [0, 0.05, 0.3]) expect(parseShareQuery(`?na=${noiseAmplitude}`).values).toEqual({ noiseAmplitude })
    for (const noiseSeed of [1, 2, 9999]) expect(parseShareQuery(`?ns=${noiseSeed}`).values).toEqual({ noiseSeed })
    for (const [field, value] of [['sinePeriod', 50], ['sinePeriod', 400], ['noiseAmplitude', 0.3], ['noiseSeed', 9999]] as const) {
      expect(parseShareQuery(query(buildShareUrl({ ...defaults, [field]: value }, 'http://localhost/'))).values[field]).toBe(value)
    }
  })

  it('reports an unknown shape and values outside the range or off the step', () => {
    const bad = parseShareQuery('?sh=square&sp=45&na=0.35&ns=0')
    expect(bad.values).toEqual({})
    expect(bad.found).toBe(true)
    expect(bad.ignored).toEqual(['stimulusShape', 'sinePeriod', 'noiseAmplitude', 'noiseSeed'])
    for (const text of ['sh=Sine', 'sh=', 'sp=410', 'sp=105', 'sp=40', 'na=0.07', 'na=-0.05', 'na=0,1', 'na=1e-1', 'ns=1.5', 'ns=10000', 'ns=-3', 'ns=abc', 'ns=', 'sh=ramp&sh=sine']) {
      const parsed = parseShareQuery(`?${text}`)
      expect(parsed.values, text).toEqual({})
      expect(parsed.ignored, text).toHaveLength(1)
    }
    expect(shareNotice({ applied: 1, ignored: bad.ignored, realUnavailable: false }))
      .toBe('Bağlantıdaki ayarlar uygulandı. Geçersiz olduğu için yok sayılan parçalar: Uyaran biçimi, Sinüs periyodu, Girdi gürültüsü, Gürültü tohumu.')
  })

  it('keeps the protocol through the circuit check and the fallback to the example', () => {
    const parsed = parseShareQuery('?m=real&sh=ramp&na=0.1&ns=4&st=AVER')
    expect(restrictToCircuit(parsed, toyIds, 'illustrative').values).toMatchObject({ stimulusShape: 'ramp', noiseAmplitude: 0.1, noiseSeed: 4 })
    expect(withoutRealSelections(parsed).values).toEqual({ mode: 'illustrative', stimulusShape: 'ramp', noiseAmplitude: 0.1, noiseSeed: 4 })
    expect(withoutRealSelections(parsed).ignored).toEqual([])
  })

  it('an old link without the keys parses to no protocol values and nothing ignored', () => {
    const old = parseShareQuery('?m=illustrative&v=2d&c=baseline&st=S1&am=0.8&du=200&tb=30&tn=O1&tc=90&se=I3-O1&o=O1&n=S1&dt=1&sc=0')
    expect(old.ignored).toEqual([])
    expect(old.values).toEqual(inToyLink(toy))
  })

  it('names the protocol fields in both languages', () => {
    expect(shareFields.stimulusShape).toEqual({ key: 'sh', label: 'Uyaran biçimi', labelEn: 'Stimulus shape' })
    expect(shareFields.sinePeriod).toEqual({ key: 'sp', label: 'Sinüs periyodu', labelEn: 'Sine period' })
    expect(shareFields.noiseAmplitude).toEqual({ key: 'na', label: 'Girdi gürültüsü', labelEn: 'Input noise' })
    expect(shareFields.noiseSeed).toEqual({ key: 'ns', label: 'Gürültü tohumu', labelEn: 'Noise seed' })
  })
})
