import { describe, expect, it } from 'vitest'
import {
  answerAtlasQuestion, atlasDefaults, atlasQuestions, atlasRecords, buildComparison, compareRecords,
  countUnitLabels, recordFor, recordsForSpecies, speciesOptions,
  type AtlasRecord, type AtlasRecordId, type AtlasSpeciesId,
} from './speciesAtlas'

const count = (id: string, kind: 'neurons' | 'chemical' | 'gap') => recordFor(id).counts.find(metric => metric.kind === kind)

describe('curated anatomy scope and measurement boundaries', () => {
  it('keeps reported neuron populations separate from all-cell graphs, fragments and the local derived subset', () => {
    // Independently verified publication populations; these are not the
    // total matrix nodes, current portal query totals or synapse counts.
    const populations: Record<string, number> = {
      'circuitiary-subset30': 30, 'cook2019-hermaphrodite': 302, 'cook2019-male': 385,
      'drosophila-larva2023': 3016, hemibrain2020: 25_000, flywire2024: 139_255, 'male-cns2026': 166_700,
    }
    expect(new Set(atlasRecords.map(record => record.id)).size).toBe(7)
    expect(atlasRecords.filter(record => record.kind === 'published')).toHaveLength(6)
    for (const [id, value] of Object.entries(populations)) {
      expect(count(id, 'neurons')).toMatchObject({ value, unit: 'neurons' })
    }
    expect(count('hemibrain2020', 'neurons')!.approximate).toBe(true)
    expect(count('flywire2024', 'neurons')!.approximate).toBe(false)
    expect(recordFor('cook2019-hermaphrodite').reconstruction.kind).toBe('composite')
    expect(recordFor('cook2019-male').reconstruction.kind).toBe('composite')
    expect(recordFor('circuitiary-subset30').scope.coverage).toBe('selected-subgraph')
    expect(recordFor('circuitiary-subset30').modelStatus.kind).toBe('assumed-dynamics')
    expect(atlasRecords.filter(record => record.circuitiaryRelation.kind === 'current-local-subset').map(record => record.id)).toEqual(['circuitiary-subset30'])
    expect(atlasRecords.filter(record => record.circuitiaryRelation.kind === 'source-of-current-subset').map(record => record.id)).toEqual(['cook2019-hermaphrodite'])
    expect(atlasRecords.filter(record => record.kind === 'published').every(record => record.modelStatus.kind === 'anatomical-dataset')).toBe(true)
  })

  it('preserves the different chemical units and unknown totals without inventing zero connectivity', () => {
    expect(count('cook2019-hermaphrodite', 'chemical')).toMatchObject({ value: null, unit: 'serial-em-sections' })
    expect(count('cook2019-male', 'gap')).toMatchObject({ value: null, unit: 'serial-em-sections' })
    expect(count('circuitiary-subset30', 'chemical')).toMatchObject({ value: 196, unit: 'directed-neuron-pairs' })
    expect(count('circuitiary-subset30', 'gap')).toMatchObject({ value: 50, unit: 'physical-gap-pairs' })
    expect(count('drosophila-larva2023', 'chemical')).toMatchObject({ value: 548_000, unit: 'synaptic-sites', approximate: true })
    expect(count('hemibrain2020', 'chemical')).toMatchObject({ value: 20_000_000, unit: 'chemical-synapses', approximate: true })
    expect(count('flywire2024', 'chemical')).toMatchObject({ value: 54_500_000, unit: 'chemical-synapses', approximate: true })
    expect(count('male-cns2026', 'chemical')).toBeUndefined()
    expect(atlasRecords.filter(record => record.speciesId === 'drosophila').every(record => !record.counts.some(metric => metric.kind === 'gap'))).toBe(true)
    for (const record of atlasRecords) for (const metric of record.counts) {
      expect(countUnitLabels[metric.unit]).toBeTruthy()
      if (metric.value !== null) expect(Number.isFinite(metric.value) && metric.value > 0).toBe(true)
    }
  })

  it('distinguishes life stage, sex and brain/CNS scopes independently of neuron totals', () => {
    const larva = recordFor('drosophila-larva2023')
    const wholeBrain = recordFor('flywire2024')
    const maleCns = recordFor('male-cns2026')
    expect([larva.stage.id, larva.sex.id, larva.scope.coverage]).toEqual(['first-instar', 'female', 'whole-brain'])
    expect([wholeBrain.stage.id, wholeBrain.sex.id, wholeBrain.scope.coverage]).toEqual(['adult', 'female', 'whole-brain'])
    expect([maleCns.stage.id, maleCns.sex.id, maleCns.scope.coverage]).toEqual(['adult', 'male', 'whole-cns'])
    expect(recordFor('hemibrain2020').scope.coverage).toBe('partial-brain')
    const larvaAdult = buildComparison(larva.id, wholeBrain.id)
    expect(larvaAdult.rows.find(row => row.key === 'sex')!.different).toBe(false)
    expect(larvaAdult.rows.find(row => row.key === 'stage')!.different).toBe(true)
    expect(larvaAdult.countRows.find(row => row.kind === 'neurons')!.classification).toBe('same-unit-context-differs')
  })

  it('pins source-specific data licenses and original count scope rather than inheriting article or current portal claims', () => {
    for (const id of ['circuitiary-subset30', 'cook2019-hermaphrodite', 'cook2019-male', 'drosophila-larva2023']) {
      expect(recordFor(id).license).toMatchObject({ scope: 'dataset', status: 'unverified', name: null })
    }
    const flywire = recordFor('flywire2024')
    expect(flywire.license).toMatchObject({ scope: 'dataset', status: 'verified', name: 'CC BY 4.0', sourceUrl: 'https://zenodo.org/records/10676866' })
    expect(flywire.license.note).toContain('CC BY-NC 4.0')
    expect(flywire.sources.some(source => source.url === 'https://home.flywire.ai/guidelines')).toBe(true)
    expect(flywire.version.pinned).toContain('783.0')
    expect(recordFor('hemibrain2020').version.pinned).toContain('publication-counts')
    expect(recordFor('male-cns2026').version.pinned).toContain('male-cns:v1.0')
    expect(recordFor('male-cns2026').version.pinned).toContain('2026-06-08')
    for (const record of atlasRecords) {
      expect(record.checkedDate).toBe('2026-10-03')
      expect(record.sources.some(source => source.kind === 'paper')).toBe(true)
      if (record.license.status === 'verified') expect(record.sources.some(source => source.url === record.license.sourceUrl)).toBe(true)
      for (const source of record.sources) expect(new URL(source.url).protocol).toBe('https:')
    }
  })
})

describe('pure deterministic filters and contextual comparisons', () => {
  it('filters whole records without changing their independent IDs, defaults or shared catalog', () => {
    const before = JSON.stringify(atlasRecords)
    const worms = recordsForSpecies('c-elegans')
    const flies = recordsForSpecies('drosophila')
    expect(worms).toHaveLength(3)
    expect(flies).toHaveLength(4)
    expect(worms.every(record => record.speciesId === 'c-elegans')).toBe(true)
    expect(flies.every(record => record.speciesId === 'drosophila')).toBe(true)
    expect(new Set([...worms, ...flies].map(record => record.id)).size).toBe(atlasRecords.length)
    expect(recordsForSpecies('all')).toBe(atlasRecords)
    expect(recordFor(atlasDefaults.selectedRecordId).id).toBe('circuitiary-subset30')
    expect(recordFor(atlasDefaults.comparisonLeftId)).not.toBe(recordFor(atlasDefaults.comparisonRightId))
    expect(JSON.stringify(atlasRecords)).toBe(before)
    expect(Object.isFrozen(worms)).toBe(true)
  })

  it('does not turn shared count units into equal scope, identical populations or a functional ranking', () => {
    const comparison = buildComparison('flywire2024', 'male-cns2026')
    expect(comparison.sameRecord).toBe(false)
    expect(comparison.rows.find(row => row.key === 'scope')!.different).toBe(true)
    expect(comparison.rows.find(row => row.key === 'sex')!.different).toBe(true)
    const populations = comparison.countRows.find(row => row.kind === 'neurons')!
    expect(populations.leftMetric!.unit).toBe(populations.rightMetric!.unit)
    expect(populations.classification).toBe('same-unit-context-differs')
    const wormSexes = buildComparison('cook2019-hermaphrodite', 'cook2019-male')
    expect(wormSexes.rows.find(row => row.key === 'scope')!.different).toBe(false)
    expect(wormSexes.rows.find(row => row.key === 'sex')!.different).toBe(true)
    expect(wormSexes.countRows.find(row => row.kind === 'neurons')!.classification).toBe('same-unit-context-differs')
  })

  it('names only the differences that exist in the same-unit note', () => {
    const note = (left: string, right: string) => buildComparison(left, right).countRows.find(row => row.kind === 'neurons')!.note
    expect(note('hemibrain2020', 'flywire2024')).toContain('Kapsam farkı nedeniyle')
    expect(note('drosophila-larva2023', 'flywire2024')).toContain('Evre farkı nedeniyle')
    expect(note('flywire2024', 'male-cns2026')).toContain('Cinsiyet ve kapsam farkları nedeniyle')
    expect(note('circuitiary-subset30', 'drosophila-larva2023')).toContain('Tür, evre, cinsiyet, kapsam ve rekonstrüksiyon farkları nedeniyle')
    // Both Cook records cover the whole nervous system; only the region wording and the sex differ.
    expect(note('cook2019-hermaphrodite', 'cook2019-male')).toContain('Cinsiyet farkı nedeniyle')
    expect(note('cook2019-hermaphrodite', 'cook2019-male')).not.toMatch(/[Kk]apsam/)
  })

  it('classifies distinct records with the same structural context as scope-aligned, whatever the region wording', () => {
    // No catalogue pair shares species, stage, sex, coverage and reconstruction yet, so a synthetic later release exercises the branch.
    const flywire = recordFor('flywire2024')
    const laterRelease: AtlasRecord = { ...flywire, id: 'later-release' as AtlasRecordId,
      counts: flywire.counts.map(metric => ({ ...metric, value: metric.value! + 1_000 })) }
    const aligned = compareRecords(flywire, laterRelease)
    expect(aligned.sameRecord).toBe(false)
    expect(aligned.countRows.map(row => [row.kind, row.classification])).toEqual([
      ['neurons', 'same-unit-scope-aligned'], ['chemical', 'same-unit-scope-aligned'], ['gap', 'missing']])
    expect(aligned.countRows[0]!.note).toContain('kapsam örtüşür')
    const reworded = compareRecords(flywire, { ...laterRelease, scope: { ...laterRelease.scope, region: 'Aynı kapsamın farklı ifadesi.' } })
    expect(reworded.countRows[0]!.classification).toBe('same-unit-scope-aligned')
    // One structural difference is enough to demote it, and the note names that field.
    const other = compareRecords(flywire, { ...laterRelease, sex: { id: 'male', label: 'Erkek' } }).countRows[0]!
    expect(other.classification).toBe('same-unit-context-differs')
    expect(other.note).toContain('Cinsiyet farkı nedeniyle')
  })

  it('classifies incompatible chemical quantities without calculating a misleading ratio', () => {
    for (const [left, right] of [
      ['cook2019-hermaphrodite', 'flywire2024'],
      ['circuitiary-subset30', 'drosophila-larva2023'],
      ['drosophila-larva2023', 'hemibrain2020'],
    ]) {
      const row = buildComparison(left!, right!).countRows.find(candidate => candidate.kind === 'chemical')!
      expect(row.leftMetric!.unit).not.toBe(row.rightMetric!.unit)
      expect(row.classification).toBe('different-units')
      expect(row).not.toHaveProperty('ratio')
      expect(row).not.toHaveProperty('percentageDifference')
    }
  })

  it('keeps missing measurements and unasserted totals separate from zero', () => {
    const absent = buildComparison('circuitiary-subset30', 'flywire2024').countRows.find(row => row.kind === 'gap')!
    expect(absent.classification).toBe('missing')
    expect(absent.leftMetric!.value).toBe(50)
    expect(absent.rightMetric).toBeNull()
    const noTotal = buildComparison('cook2019-hermaphrodite', 'cook2019-male').countRows.find(row => row.kind === 'chemical')!
    expect(noTotal.classification).toBe('missing')
    expect(noTotal.leftMetric!.value).toBeNull()
    expect(noTotal.rightMetric!.value).toBeNull()
  })

  it('supports selecting the same record twice and swapping independent sides without changing catalog state', () => {
    const before = JSON.stringify(atlasRecords)
    const same = buildComparison('circuitiary-subset30', 'circuitiary-subset30')
    expect(same.sameRecord).toBe(true)
    expect(same.rows.every(row => !row.different)).toBe(true)
    expect(same.countRows.every(row => row.classification === 'same-record')).toBe(true)
    const forward = buildComparison('hemibrain2020', 'flywire2024')
    const reverse = buildComparison('flywire2024', 'hemibrain2020')
    expect(reverse.left).toBe(forward.right)
    expect(reverse.right).toBe(forward.left)
    expect(reverse.rows.map(row => [row.key, row.left, row.right, row.different])).toEqual(forward.rows.map(row => [row.key, row.right, row.left, row.different]))
    expect(reverse.countRows.map(row => row.classification)).toEqual(forward.countRows.map(row => row.classification))
    expect(buildComparison('hemibrain2020', 'flywire2024')).toEqual(forward)
    expect(JSON.stringify(atlasRecords)).toBe(before)
  })

  it('rejects unknown exact IDs and filters instead of silently falling back to a different dataset', () => {
    for (const id of ['', 'FlyWire2024', 'flywire2024 ', 'unpublished']) {
      expect(() => recordFor(id)).toThrow(RangeError)
      expect(() => buildComparison(id, 'flywire2024')).toThrow(RangeError)
      expect(() => buildComparison('flywire2024', id)).toThrow(RangeError)
    }
    expect(() => recordsForSpecies('adult' as AtlasSpeciesId)).toThrow(RangeError)
  })
})

describe('immutable teaching records and scope feedback', () => {
  it('freezes nested catalog, filter, defaults, comparison and teaching data', () => {
    const flywire = recordFor('flywire2024')
    const comparison = buildComparison('circuitiary-subset30', 'flywire2024')
    for (const value of [atlasRecords, speciesOptions, atlasDefaults, countUnitLabels, flywire, flywire.scope,
      flywire.counts, flywire.counts[0], flywire.license, flywire.sources, flywire.sources[0], flywire.limitations,
      comparison, comparison.rows, comparison.rows[0], comparison.countRows, comparison.countRows[0], atlasQuestions, atlasQuestions[0]!.options]) expect(Object.isFrozen(value)).toBe(true)
    expect(() => { (flywire.counts[0] as { value: number }).value = 1 }).toThrow(TypeError)
    expect(() => { (atlasDefaults as { comparisonRightId: string }).comparisonRightId = 'hemibrain2020' }).toThrow(TypeError)
    expect(() => { (flywire.sources as unknown as unknown[]).push({}) }).toThrow(TypeError)
  })

  it('gives bounded feedback on brain scope, measurement units, current subset and dynamics/validation', () => {
    const correct = { scope: 'brainOnly', units: 'differentUnits', subset: 'selectedSubset', model: 'dynamicsAndValidation' }
    const availableSourceIds = new Set(atlasRecords.flatMap(record => record.sources.map(source => source.id)))
    expect(atlasQuestions.map(question => question.id)).toEqual(['scope', 'units', 'subset', 'model'])
    for (const question of atlasQuestions) {
      expect(question.options).toHaveLength(3)
      expect(new Set(question.options.map(option => option.id)).size).toBe(3)
      for (const option of question.options) {
        const feedback = answerAtlasQuestion(question.id, option.id)
        expect(feedback.correct).toBe(option.id === correct[question.id])
        expect(feedback.explanation.length).toBeGreaterThan(40)
        expect(Object.isFrozen(feedback)).toBe(true)
      }
      expect(question.sourceIds.every(id => availableSourceIds.has(id))).toBe(true)
    }
    expect(() => answerAtlasQuestion('unknown', 'brainOnly')).toThrow(RangeError)
    expect(() => answerAtlasQuestion('scope', 'differentUnits')).toThrow(RangeError)
  })
})
