import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, locale } from '../i18n'
import { blankDraft, cloneDraft, draftKey, motifs, runDraft, validateDraft, type BuilderDraft } from './circuitBuilder'
import {
  CIRCUIT_FILE_MAX_BYTES, CIRCUIT_FILE_NAME, DRAFT_STORAGE_KEY, circuitFile, circuitFileText, clearStoredDraft, parseCircuitFile, readStoredDraft, storeDraft,
  tooLargeFile, unreadableFile, type CircuitFileErrorCode, type DraftStorage,
} from './circuitFile'

afterEach(() => { locale.value = DEFAULT_LOCALE })

const sample = (): BuilderDraft => ({
  cellCount: 4,
  links: [
    { id: 'x', source: 'A', target: 'B', type: 'excitatory', strength: 0.9 },
    { id: 'y', source: 'B', target: 'C', type: 'inhibitory', strength: 1.5 },
    { id: 'z', source: 'D', target: 'C', type: 'gap', strength: 0.35 },
    { id: 'w', source: 'A', target: 'A', type: 'excitatory', strength: 0.05 },
  ],
  stimulus: { target: 'B', amplitude: 0.45, onsetMs: 50, durationMs: 310 },
})
/** The file as an object, to be changed and written back. */
const record = (draft: BuilderDraft = sample()) => JSON.parse(circuitFileText(draft)) as {
  app: unknown; format: unknown; schemaVersion: unknown
  draft: { cellCount: unknown; links: Array<Record<string, unknown>>; stimulus: Record<string, unknown> }
} & Record<string, unknown>
const changed = (change: (file: ReturnType<typeof record>) => void): string => {
  const file = record()
  change(file)
  return JSON.stringify(file)
}
const refusal = (source: string) => {
  const outcome = parseCircuitFile(source)
  if (outcome.ok) throw new Error('The file was accepted')
  return outcome.error
}
const code = (source: string): CircuitFileErrorCode => refusal(source).code

describe('writing a circuit file', () => {
  it('holds the app name, the format, the schema version and the draft, and nothing else', () => {
    const file = record()
    expect(Object.keys(file)).toEqual(['app', 'format', 'schemaVersion', 'draft'])
    expect(file.app).toBe('Circuitiary')
    expect(file.format).toBe('circuitiary-builder-circuit')
    expect(file.schemaVersion).toBe(1)
    expect(Object.keys(file.draft)).toEqual(['cellCount', 'links', 'stimulus'])
    expect(file.draft.links[0]).toEqual({ type: 'excitatory', source: 'A', target: 'B', strength: 0.9 })
    expect(file.draft.stimulus).toEqual({ target: 'B', amplitude: 0.45, onsetMs: 50, durationMs: 310 })
  })

  it('never writes a result or a connection id', () => {
    const text = circuitFileText(sample())
    expect(text).not.toMatch(/activity|timesMs|peak|"id"/)
    expect(text.endsWith('}\n')).toBe(true)
  })

  it('names the download and stays far below the size limit even for the largest circuit', () => {
    const file = circuitFile(sample())
    expect(file.name).toBe(CIRCUIT_FILE_NAME)
    expect(file.name).toBe('circuitiary-devre.json')
    expect(file.type).toContain('application/json')
    const largest: BuilderDraft = { ...blankDraft(), cellCount: 6, links: [] }
    for (const source of ['A', 'B', 'C'] as const) for (const target of ['C', 'D', 'E', 'F'] as const) largest.links.push({ id: `${source}${target}`, source, target, type: 'inhibitory', strength: 1.95 })
    expect(largest.links).toHaveLength(12)
    expect(new TextEncoder().encode(circuitFileText(largest)).length).toBeLessThan(CIRCUIT_FILE_MAX_BYTES / 2)
    expect(parseCircuitFile(circuitFileText(largest)).ok).toBe(true)
  })
})

describe('round trip', () => {
  it('reads back exactly the circuit that was written, with new connection ids', () => {
    const outcome = parseCircuitFile(circuitFileText(sample()))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(draftKey(outcome.draft)).toBe(draftKey(sample()))
    expect(outcome.draft.links.map(link => link.id)).toEqual(['f1', 'f2', 'f3', 'f4'])
    expect(validateDraft(outcome.draft)).toEqual([])
    // Writing the read circuit gives the same text again.
    expect(circuitFileText(outcome.draft)).toBe(circuitFileText(sample()))
  })

  it('round-trips every motif and the blank circuit, and the read circuit computes the same result', () => {
    for (const draft of [blankDraft(), ...motifs.map(motif => motif.draft)]) {
      const outcome = parseCircuitFile(circuitFileText(draft))
      expect(outcome.ok).toBe(true)
      if (!outcome.ok) continue
      expect(draftKey(outcome.draft)).toBe(draftKey(draft))
      const [first, second] = [runDraft(draft), runDraft(outcome.draft)]
      if (first.ok && second.ok) expect(second.run.result.activity).toEqual(first.run.result.activity)
      else throw new Error('A motif did not run')
    }
  })

  it('accepts other spacing and key order, and removes binary noise from a stepped value', () => {
    const file = record()
    file.draft.links[0]!.strength = 0.1 + 0.2
    const reordered = { draft: { stimulus: file.draft.stimulus, links: file.draft.links, cellCount: file.draft.cellCount }, schemaVersion: 1, format: file.format, app: file.app }
    const outcome = parseCircuitFile(JSON.stringify(reordered))
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.draft.links[0]!.strength).toBe(0.3)
  })
})

describe('refusing a file', () => {
  it('too large: over the byte limit, also when the characters are few but wide', () => {
    expect(code(' '.repeat(CIRCUIT_FILE_MAX_BYTES + 1))).toBe('too-large')
    expect(code(`"${'ğ'.repeat(CIRCUIT_FILE_MAX_BYTES / 2)}"`)).toBe('too-large')
    expect(refusal(' '.repeat(CIRCUIT_FILE_MAX_BYTES + 1)).message).toBe('Dosya çok büyük. Bir devre dosyası en fazla 4096 bayt olabilir; bu dosya bir devre dosyası olmayabilir.')
    const padded = circuitFileText(sample()) + ' '.repeat(CIRCUIT_FILE_MAX_BYTES)
    expect(code(padded)).toBe('too-large')
    const helper = tooLargeFile()
    expect(!helper.ok && helper.error.code).toBe('too-large')
  })

  it('not JSON', () => {
    for (const source of ['', 'merhaba', '{', circuitFileText(sample()).slice(0, -3), '{"app": "Circuitiary",}', 'alert(1)']) expect(code(source), source).toBe('not-json')
    expect(refusal('{').message).toBe('Dosya geçerli bir JSON metni değil. “Devreyi dosyaya kaydet” ile yazılmış bir dosya seç.')
  })

  it('JSON that is not an object', () => {
    for (const source of ['[]', 'null', '3', '"metin"', 'true', `[${circuitFileText(sample())}]`]) expect(code(source), source).toBe('not-object')
  })

  it('another kind of file: wrong or missing app name or format', () => {
    expect(code('{}')).toBe('not-circuit-file')
    expect(code(changed(file => { file.app = 'Başka' }))).toBe('not-circuit-file')
    expect(code(changed(file => { delete file.app }))).toBe('not-circuit-file')
    expect(code(changed(file => { file.format = 'circuitiary-output-series' }))).toBe('not-circuit-file')
    expect(code(changed(file => { file.app = { name: 'Circuitiary' } }))).toBe('not-circuit-file')
    // The experiment record of the main page is a Circuitiary file, but not a circuit file.
    expect(code(JSON.stringify({ format: 'circuitiary-output-series', formatVersion: 1, app: { name: 'Circuitiary', version: '0.1.0' } }))).toBe('not-circuit-file')
  })

  it('wrong schema version: newer, older, missing or not a whole number', () => {
    expect(refusal(changed(file => { file.schemaVersion = 2 })).message).toBe('Dosyanın şema sürümü 2; bu sayfa yalnız sürüm 1 dosyalarını okur.')
    expect(code(changed(file => { file.schemaVersion = 0 }))).toBe('schema-version')
    for (const value of [undefined, '1', 1.5, null, [1]]) {
      const error = refusal(changed(file => { if (value === undefined) delete file.schemaVersion; else file.schemaVersion = value }))
      expect(error.code).toBe('schema-version')
      expect(error.message).toBe('Dosyada geçerli bir şema sürümü (“schemaVersion”) yok. Bu sayfa yalnız sürüm 1 dosyalarını okur.')
    }
  })

  it('unknown keys at every level', () => {
    const cases: Array<[string, (file: ReturnType<typeof record>) => void]> = [
      ['result', file => { file.result = { peak: 1 } }],
      ['draft.name', file => { (file.draft as Record<string, unknown>).name = 'x' }],
      ['draft.links[1].id', file => { file.draft.links[1]!.id = 'n1' }],
      ['draft.stimulus.shape', file => { file.draft.stimulus.shape = 'ramp' }],
      ['__proto__', file => { Object.defineProperty(file, '__proto__', { value: { polluted: true }, enumerable: true }) }],
    ]
    for (const [path, change] of cases) {
      const error = refusal(changed(change))
      expect(error.code, path).toBe('unknown-key')
      expect(error.path, path).toBe(path)
      expect(error.message).toContain(`“${path}”`)
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    // A very long key is shown cut, not in full.
    const long = refusal(changed(file => { file['k'.repeat(300)] = 1 }))
    expect(long.message.length).toBeLessThan(160)
  })

  it('missing keys at every level', () => {
    const cases: Array<[string, (file: ReturnType<typeof record>) => void]> = [
      ['draft', file => { delete (file as Record<string, unknown>).draft }],
      ['draft.cellCount', file => { delete (file.draft as Record<string, unknown>).cellCount }],
      ['draft.links', file => { delete (file.draft as Record<string, unknown>).links }],
      ['draft.stimulus', file => { delete (file.draft as Record<string, unknown>).stimulus }],
      ['draft.links[2].strength', file => { delete file.draft.links[2]!.strength }],
      ['draft.links[0].type', file => { delete file.draft.links[0]!.type }],
      ['draft.stimulus.onsetMs', file => { delete file.draft.stimulus.onsetMs }],
    ]
    for (const [path, change] of cases) {
      const error = refusal(changed(change))
      expect(error.code, path).toBe('missing-key')
      expect(error.path, path).toBe(path)
    }
    expect(refusal(changed(file => { delete file.draft.stimulus.onsetMs })).message).toBe('Dosyada gerekli bir alan eksik: “draft.stimulus.onsetMs”.')
  })

  it('wrong types', () => {
    const cases: Array<[string, (file: ReturnType<typeof record>) => void]> = [
      ['draft', file => { (file as Record<string, unknown>).draft = [] }],
      ['draft.cellCount', file => { file.draft.cellCount = '4' }],
      ['draft.links', file => { (file.draft as Record<string, unknown>).links = {} }],
      ['draft.stimulus', file => { (file.draft as Record<string, unknown>).stimulus = null }],
      ['draft.links[0]', file => { (file.draft.links as unknown[])[0] = 'A→B' }],
      ['draft.links[1].type', file => { file.draft.links[1]!.type = 2 }],
      ['draft.links[1].source', file => { file.draft.links[1]!.source = 1 }],
      ['draft.links[1].target', file => { file.draft.links[1]!.target = null }],
      ['draft.links[3].strength', file => { file.draft.links[3]!.strength = '0.05' }],
      ['draft.stimulus.target', file => { file.draft.stimulus.target = 0 }],
      ['draft.stimulus.amplitude', file => { file.draft.stimulus.amplitude = true }],
      ['draft.stimulus.onsetMs', file => { file.draft.stimulus.onsetMs = '50' }],
      ['draft.stimulus.durationMs', file => { file.draft.stimulus.durationMs = null }],
    ]
    for (const [path, change] of cases) {
      const error = refusal(changed(change))
      expect(error.code, path).toBe('wrong-type')
      expect(error.path, path).toBe(path)
    }
    expect(refusal(changed(file => { file.draft.cellCount = '4' })).message).toBe('“draft.cellCount” alanı bir sayı olmalı.')
    // 1e999 is valid JSON text but not a finite number.
    expect(code(JSON.stringify(record()).replace('"amplitude":0.45', '"amplitude":1e999'))).toBe('wrong-type')
  })

  it('cells outside A–F and unknown connection types', () => {
    for (const value of ['G', 'a', 'AB', '', 'constructor']) {
      expect(code(changed(file => { file.draft.links[0]!.source = value })), value).toBe('bad-cell')
      expect(code(changed(file => { file.draft.stimulus.target = value })), value).toBe('bad-cell')
    }
    expect(refusal(changed(file => { file.draft.links[0]!.target = 'Z' })).message).toBe('“draft.links[0].target” alanı bir hücre harfi olmalı (A–F).')
    for (const value of ['chemical', 'Gap', '', 'toString']) expect(code(changed(file => { file.draft.links[0]!.type = value })), value).toBe('bad-link-type')
  })

  it('out-of-range values and everything else validateDraft rejects, with its sentences', () => {
    const cases: Array<[string, (file: ReturnType<typeof record>) => void, RegExp]> = [
      ['cell count 7', file => { file.draft.cellCount = 7 }, /Hücre sayısı 2–6 arasında olmalı/],
      ['cell count 1', file => { file.draft.cellCount = 1 }, /Hücre sayısı 2–6 arasında olmalı/],
      ['cell count 3,5', file => { file.draft.cellCount = 3.5 }, /Hücre sayısı 2–6 arasında olmalı/],
      ['strength too high', file => { file.draft.links[0]!.strength = 2.05 }, /Bağlantı 1: güç 0,05–2 aralığında olmalı/],
      ['strength zero', file => { file.draft.links[1]!.strength = 0 }, /Bağlantı 2: güç/],
      ['negative strength', file => { file.draft.links[1]!.strength = -0.5 }, /Bağlantı 2: güç/],
      ['gap strength above 1', file => { file.draft.links[2]!.strength = 1.5 }, /Bağlantı 3: güç 0,05–1 aralığında olmalı/],
      ['amplitude', file => { file.draft.stimulus.amplitude = 1.2 }, /Uyaran genliği 0–1 arasında olmalı/],
      ['onset', file => { file.draft.stimulus.onsetMs = 600 }, /Uyaranın başlangıcı 0–500 ms arasında olmalı/],
      ['duration', file => { file.draft.stimulus.durationMs = 0 }, /Uyaran süresi 10–500 ms arasında olmalı/],
      ['cell not in the circuit', file => { file.draft.cellCount = 3 }, /Bağlantı 3: devrede olmayan bir hücreye bağlı/],
      ['stimulus outside the circuit', file => { file.draft.stimulus.target = 'F' }, /Uyarılan hücre devrede yok/],
      ['gap onto itself', file => { file.draft.links[2]!.source = 'C' }, /Bağlantı 3: elektriksel \(gap\) bağlantı iki farklı hücre arasında kurulur/],
      ['duplicate chemical', file => { file.draft.links.push({ type: 'inhibitory', source: 'A', target: 'B', strength: 0.5 }) }, /Bağlantı 5: A→B için kimyasal bağlantı zaten var/],
      ['duplicate gap', file => { file.draft.links.push({ type: 'gap', source: 'C', target: 'D', strength: 0.5 }) }, /Bağlantı 5: C ↔ D arasında elektriksel bağlantı zaten var/],
      ['too many connections', file => { file.draft.cellCount = 6; file.draft.links = ['B', 'C', 'D', 'E', 'F'].flatMap(target => ['A', 'B', 'C'].filter(source => source !== target).map(source => ({ type: 'excitatory', source, target, strength: 0.5 }))) }, /En fazla 12 bağlantı ekleyebilirsin/],
    ]
    for (const [name, change, sentence] of cases) {
      const error = refusal(changed(change))
      expect(error.code, name).toBe('invalid-circuit')
      expect(error.message, name).toMatch(/^Dosyadaki devre geçerli değil\. /)
      expect(error.message, name).toMatch(sentence)
    }
  })

  it('values the sliders cannot show', () => {
    const cases: Array<[string, (file: ReturnType<typeof record>) => void]> = [
      ['draft.links[0].strength', file => { file.draft.links[0]!.strength = 0.33 }],
      ['draft.links[2].strength', file => { file.draft.links[2]!.strength = 0.07 }],
      ['draft.stimulus.amplitude', file => { file.draft.stimulus.amplitude = 0.42 }],
      ['draft.stimulus.onsetMs', file => { file.draft.stimulus.onsetMs = 105 }],
      ['draft.stimulus.durationMs', file => { file.draft.stimulus.durationMs = 12.5 }],
    ]
    for (const [path, change] of cases) {
      const error = refusal(changed(change))
      expect(error.code, path).toBe('off-step')
      expect(error.path).toBe(path)
    }
    expect(refusal(changed(file => { file.draft.links[0]!.strength = 0.33 })).message).toBe('“draft.links[0].strength” değeri sayfadaki kaydırıcının adımlarına uymuyor; adım 0,05.')
  })

  it('writes every refusal in English after a language change, with decimal points and no Turkish letters', () => {
    const errors = [
      refusal(' '.repeat(CIRCUIT_FILE_MAX_BYTES + 1)), refusal('{'), refusal('[]'), refusal('{}'),
      refusal(changed(file => { file.schemaVersion = 3 })), refusal(changed(file => { delete file.schemaVersion })),
      refusal(changed(file => { file.extra = 1 })), refusal(changed(file => { delete file.draft.stimulus.target })),
      refusal(changed(file => { file.draft.cellCount = 'x' })), refusal(changed(file => { (file.draft as Record<string, unknown>).links = 1 })),
      refusal(changed(file => { (file as Record<string, unknown>).draft = 1 })), refusal(changed(file => { file.draft.links[0]!.type = 1 })),
      refusal(changed(file => { file.draft.links[0]!.source = 'Q' })), refusal(changed(file => { file.draft.links[0]!.type = 'q' })),
      refusal(changed(file => { file.draft.links[0]!.strength = 0.33 })), refusal(changed(file => { file.draft.links[0]!.strength = 9 })),
      (() => { const outcome = unreadableFile(); if (outcome.ok) throw new Error('unexpected'); return outcome.error })(),
    ]
    expect(new Set(errors.map(error => error.code)).size).toBe(13)
    const turkish = errors.map(error => error.message)
    locale.value = 'en'
    errors.forEach((error, index) => {
      expect(error.message, error.code).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
      expect(error.message, error.code).not.toMatch(/\d,\d/)
      expect(error.message, error.code).not.toBe(turkish[index])
      expect(error.message.length).toBeGreaterThan(20)
    })
    expect(errors[14]!.message).toBe('The “draft.links[0].strength” value does not fit the steps of the slider on the page; the step is 0.05.')
    expect(errors[15]!.message).toBe('The circuit in the file is not valid. Connection 1: the strength must be in the range 0.05–2.')
    locale.value = 'tr'
    for (const message of turkish) expect(message).not.toMatch(/\d\.\d/)
  })

  it('never throws, whatever the text is', () => {
    const texts = ['\u0000', '{"app":"Circuitiary","format":"circuitiary-builder-circuit","schemaVersion":1,"draft":{"cellCount":3,"links":[null],"stimulus":{}}}', '{"draft":{"links":[[[[[[]]]]]]}}', '9'.repeat(400), '{"__proto__":{"app":"Circuitiary"}}']
    for (const source of texts) expect(() => parseCircuitFile(source)).not.toThrow()
    for (const source of texts) expect(parseCircuitFile(source).ok).toBe(false)
  })
})

describe('keeping the circuit in the browser', () => {
  const memory = (initial: Record<string, string> = {}) => {
    const items = new Map(Object.entries(initial))
    const storage: DraftStorage = {
      getItem: key => items.get(key) ?? null,
      setItem: (key, value) => { items.set(key, value) },
      removeItem: key => { items.delete(key) },
    }
    return { items, storage }
  }
  const broken: DraftStorage = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('quota') },
    removeItem: () => { throw new Error('denied') },
  }

  it('stores a circuit as the file text and reads the same circuit back', () => {
    const { items, storage } = memory()
    expect(storeDraft(sample(), storage)).toBe(true)
    expect(items.get(DRAFT_STORAGE_KEY)).toBe(circuitFileText(sample()))
    expect(draftKey(readStoredDraft(storage)!)).toBe(draftKey(sample()))
  })

  it('keeps the blank circuit as nothing, so an untouched page stores nothing', () => {
    const { items, storage } = memory()
    expect(storeDraft(blankDraft(), storage)).toBe(true)
    expect(items.size).toBe(0)
    storeDraft(sample(), storage)
    storeDraft(blankDraft(), storage)
    expect(items.has(DRAFT_STORAGE_KEY)).toBe(false)
    expect(readStoredDraft(storage)).toBeNull()
    // A blank circuit written by hand is not a circuit to restore either.
    expect(readStoredDraft(memory({ [DRAFT_STORAGE_KEY]: circuitFileText(blankDraft()) }).storage)).toBeNull()
  })

  it('does not overwrite the last valid circuit with one that has a problem', () => {
    const { items, storage } = memory()
    storeDraft(sample(), storage)
    const invalid = cloneDraft(sample())
    invalid.links.push({ id: 'dup', source: 'A', target: 'B', type: 'excitatory', strength: 0.5 })
    expect(storeDraft(invalid, storage)).toBe(false)
    expect(items.get(DRAFT_STORAGE_KEY)).toBe(circuitFileText(sample()))
  })

  it('ignores garbage and invalid circuits in storage without throwing', () => {
    const garbage = ['', 'null', 'çöp', '{"cellCount":3}', circuitFileText(sample()).replace('"schemaVersion": 1', '"schemaVersion": 2'), circuitFileText(sample()).replace('"strength": 0.9', '"strength": 9'), 'x'.repeat(100_000)]
    for (const value of garbage) expect(readStoredDraft(memory({ [DRAFT_STORAGE_KEY]: value }).storage), value.slice(0, 30)).toBeNull()
    expect(readStoredDraft(memory().storage)).toBeNull()
  })

  it('works without storage and with storage that throws', () => {
    expect(readStoredDraft(null)).toBeNull()
    expect(storeDraft(sample(), null)).toBe(false)
    expect(() => clearStoredDraft(null)).not.toThrow()
    expect(readStoredDraft(broken)).toBeNull()
    expect(storeDraft(sample(), broken)).toBe(false)
    expect(storeDraft(blankDraft(), broken)).toBe(false)
    expect(() => clearStoredDraft(broken)).not.toThrow()
    // In this test environment there is no localStorage at all: the defaults still answer.
    expect(readStoredDraft()).toBeNull()
    expect(() => clearStoredDraft()).not.toThrow()
  })

  it('clears the kept circuit', () => {
    const { items, storage } = memory()
    storeDraft(sample(), storage)
    clearStoredDraft(storage)
    expect(items.size).toBe(0)
  })
})
