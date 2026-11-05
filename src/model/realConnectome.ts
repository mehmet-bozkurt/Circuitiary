import type {
  AnatomicalChemicalEdge, AnatomicalGapEdge, AnatomicalNeuron, Circuit,
  ConnectomeDataset, ConnectomeSelection, OmittedConnections, ReadonlyRealConnectome,
  RealConnectome, RealModelParameters, SimulationConfig, SourceReference,
} from './types'

export const defaultRealModelParameters: Readonly<RealModelParameters> = Object.freeze({ chemicalGain: 0.8, gapGain: 0.2 })
export const chemicalNormalizationFormula = 'chemicalGain * rawWeight / max(1, totalIncomingRawWeight[target])'
export const gapNormalizationFormula = 'gapGain * rawWeight / max(1, max(totalIncidentRawWeight[a], totalIncidentRawWeight[b]))'
export const realDefaultReadout = 'AVAR'
export const realDefaultConfig: SimulationConfig = {
  durationMs: 700, dtMs: 1, tauMs: 30,
  stimulus: { target: 'AVER', onsetMs: 100, durationMs: 200, amplitude: 0.8 },
}

function fail(path: string, message: string): never { throw new Error(`${path}: ${message}`) }

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object')
  return value as Record<string, unknown>
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) fail(path, 'expected a non-empty trimmed string (no leading or trailing whitespace)')
  return value
}

function number(value: unknown, path: string, positive = false, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    fail(path, positive ? 'expected a finite positive number' : 'expected a finite non-negative number')
  }
  if (integer && !Number.isSafeInteger(value)) fail(path, 'expected a safe integer')
  return value
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected a boolean')
  return value
}

function array<T>(value: unknown, path: string, parse: (entry: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, 'expected an array')
  return value.map((entry, index) => parse(entry, `${path}[${index}]`))
}

function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'contains duplicate identities')
}

/** Copy JSON data only: extra source metadata is retained without executing it. */
function cloneJson(value: unknown, path = 'data', ancestors = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'nonfinite JSON number')
    return value
  }
  if (typeof value !== 'object') fail(path, 'only JSON values are allowed')
  if (ancestors.has(value)) fail(path, 'cyclic data is not JSON')
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) fail(path, 'expected a plain JSON object')
  ancestors.add(value)
  const result = Array.isArray(value)
    ? value.map((entry, index) => cloneJson(entry, `${path}[${index}]`, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJson(entry, `${path}.${key}`, ancestors)]))
  ancestors.delete(value)
  return result
}

function freezeRecursively(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return
  Object.values(value).forEach(freezeRecursively)
  Object.freeze(value)
}

function sourceReference(value: unknown, path: string): SourceReference {
  const raw = record(value, path)
  const cell = text(raw.cell, `${path}.cell`)
  const row = number(raw.row, `${path}.row`, true, true)
  const column = number(raw.column, `${path}.column`, true, true)
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(cell)
  if (!match) fail(`${path}.cell`, 'expected an uppercase Excel cell reference')
  const cellColumn = [...match[1]!].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0)
  if (cellColumn !== column || Number(match[2]) !== row) fail(path, 'cell does not match the one-based row and column')
  return { ...raw, sheet: text(raw.sheet, `${path}.sheet`), row, column, cell }
}

function omitted(value: unknown, path: string): OmittedConnections {
  const raw = record(value, path)
  return {
    ...raw,
    chemicalIncomingCount: number(raw.chemicalIncomingCount, `${path}.chemicalIncomingCount`, false, true),
    chemicalOutgoingCount: number(raw.chemicalOutgoingCount, `${path}.chemicalOutgoingCount`, false, true),
    gapCount: number(raw.gapCount, `${path}.gapCount`, false, true),
    chemicalIncomingWeight: number(raw.chemicalIncomingWeight, `${path}.chemicalIncomingWeight`),
    chemicalOutgoingWeight: number(raw.chemicalOutgoingWeight, `${path}.chemicalOutgoingWeight`),
    gapWeight: number(raw.gapWeight, `${path}.gapWeight`),
  }
}

function dataset(value: unknown, path: string): ConnectomeDataset {
  const raw = record(value, path)
  const license = record(raw.license, `${path}.license`)
  if (license.status !== 'unverified-local-only') fail(`${path}.license.status`, 'unsupported licensing status')
  const sources = array(raw.sources, `${path}.sources`, (entry, entryPath) => {
    const source = record(entry, entryPath)
    const url = text(source.url, `${entryPath}.url`)
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) fail(`${entryPath}.url`, 'expected an HTTP(S) source URL')
    } catch { fail(`${entryPath}.url`, 'expected an HTTP(S) source URL') }
    const sha256 = text(source.sha256, `${entryPath}.sha256`)
    if (!/^[a-fA-F0-9]{64}$/.test(sha256)) fail(`${entryPath}.sha256`, 'expected a SHA-256 hex digest')
    const downloadedAtUtc = text(source.downloadedAtUtc, `${entryPath}.downloadedAtUtc`)
    if (!downloadedAtUtc.endsWith('Z') || !Number.isFinite(Date.parse(downloadedAtUtc))) fail(`${entryPath}.downloadedAtUtc`, 'expected a UTC date ending in Z')
    return { ...source, name: text(source.name, `${entryPath}.name`), url, sha256, downloadedAtUtc }
  })
  if (sources.length === 0) fail(`${path}.sources`, 'must identify at least one source')
  return {
    ...raw,
    id: text(raw.id, `${path}.id`), title: text(raw.title, `${path}.title`),
    version: text(raw.version, `${path}.version`), doi: text(raw.doi, `${path}.doi`), sources,
    license: { ...license, status: 'unverified-local-only', note: text(license.note, `${path}.license.note`) },
    anatomicalWeightUnit: text(raw.anatomicalWeightUnit, `${path}.anatomicalWeightUnit`),
    orientation: text(raw.orientation, `${path}.orientation`),
    provenanceNotes: array(raw.provenanceNotes, `${path}.provenanceNotes`, text),
  }
}

/** Runtime validation, defensive JSON copy, and recursive freeze of raw anatomy. */
export function parseRealConnectome(value: unknown): ReadonlyRealConnectome {
  const raw = record(cloneJson(value), 'data')
  if (raw.schemaVersion !== 1) fail('data.schemaVersion', 'unsupported schema version; expected 1')
  const neurons = array(raw.neurons, 'data.neurons', (entry, path): AnatomicalNeuron => {
    const neuron = record(entry, path)
    const cellType = neuron.cellType
    if (cellType !== 'sensory' && cellType !== 'interneuron' && cellType !== 'motorneuron' && cellType !== 'neuron') {
      fail(`${path}.cellType`, 'unknown source cell type')
    }
    return { ...neuron, id: text(neuron.id, `${path}.id`), label: text(neuron.label, `${path}.label`), cellType, sourceRef: sourceReference(neuron.sourceRef, `${path}.sourceRef`) }
  })
  if (neurons.length === 0) fail('data.neurons', 'must contain at least one selected neuron')
  unique(neurons.map((neuron) => neuron.id), 'data.neurons')
  const ids = new Set(neurons.map((neuron) => neuron.id))
  const chemicalEdges = array(raw.chemicalEdges, 'data.chemicalEdges', (entry, path): AnatomicalChemicalEdge => {
    const edge = record(entry, path)
    const source = text(edge.source, `${path}.source`)
    const target = text(edge.target, `${path}.target`)
    if (!ids.has(source) || !ids.has(target)) fail(path, 'chemical endpoint is not an exact selected cell ID')
    return { ...edge, id: text(edge.id, `${path}.id`), source, target, rawWeight: number(edge.rawWeight, `${path}.rawWeight`, true), sourceRef: sourceReference(edge.sourceRef, `${path}.sourceRef`) }
  })
  const gapEdges = array(raw.gapEdges, 'data.gapEdges', (entry, path): AnatomicalGapEdge => {
    const edge = record(entry, path)
    const a = text(edge.a, `${path}.a`)
    const b = text(edge.b, `${path}.b`)
    if (!ids.has(a) || !ids.has(b)) fail(path, 'gap endpoint is not an exact selected cell ID')
    if (a >= b) fail(path, 'physical gaps must be non-self canonical a < b pairs')
    const sourceRef = sourceReference(edge.sourceRef, `${path}.sourceRef`)
    const reciprocalSourceRef = sourceReference(edge.reciprocalSourceRef, `${path}.reciprocalSourceRef`)
    if (reciprocalSourceRef.sheet !== sourceRef.sheet || reciprocalSourceRef.row !== sourceRef.column
      || reciprocalSourceRef.column !== sourceRef.row || sourceRef.row === sourceRef.column) {
      fail(`${path}.reciprocalSourceRef`, 'must be the mirror cell of sourceRef (same sheet, row and column swapped, off the diagonal)')
    }
    return {
      ...edge, id: text(edge.id, `${path}.id`), a, b,
      rawWeight: number(edge.rawWeight, `${path}.rawWeight`, true), sourceRef, reciprocalSourceRef,
    }
  })
  // The graph view puts neurons and edges into one element id namespace, so all three lists must be disjoint.
  unique([...neurons, ...chemicalEdges, ...gapEdges].map((item) => item.id), 'data neuron and edge IDs')
  unique(chemicalEdges.map((edge) => JSON.stringify([edge.source, edge.target])), 'data chemical directed pairs')
  unique(gapEdges.map((edge) => JSON.stringify([edge.a, edge.b])), 'data physical gap pairs')

  const selectionRaw = record(raw.selection, 'data.selection')
  const seeds = array(selectionRaw.seeds, 'data.selection.seeds', text)
  const neuronIds = array(selectionRaw.neuronIds, 'data.selection.neuronIds', text)
  unique(seeds, 'data.selection.seeds')
  unique(neuronIds, 'data.selection.neuronIds')
  if (seeds.length === 0 || seeds.some((id) => !ids.has(id))) fail('data.selection.seeds', 'seeds must be present in selected cells')
  if (JSON.stringify(neuronIds) !== JSON.stringify(neurons.map((neuron) => neuron.id))) fail('data.selection.neuronIds', 'must match selected neuron order exactly')
  const limit = number(selectionRaw.limit, 'data.selection.limit', true, true)
  if (limit > 30 || limit < seeds.length || neurons.length > limit) fail('data.selection.limit', 'inconsistent selected cell limit; maximum is 30')
  const ranking = array(selectionRaw.ranking, 'data.selection.ranking', (entry, path) => {
    const candidate = record(entry, path)
    const neuronId = text(candidate.neuronId, `${path}.neuronId`)
    if (seeds.includes(neuronId)) fail(path, 'seed cells do not belong in candidate-only ranking')
    const selected = boolean(candidate.selected, `${path}.selected`)
    if (selected !== ids.has(neuronId)) fail(path, 'selected flag disagrees with selected cells')
    return {
      ...candidate, neuronId, selected,
      chemicalSeedWeight: number(candidate.chemicalSeedWeight, `${path}.chemicalSeedWeight`),
      gapSeedWeight: number(candidate.gapSeedWeight, `${path}.gapSeedWeight`),
      rank: number(candidate.rank, `${path}.rank`, true, true),
    }
  })
  unique(ranking.map((candidate) => candidate.neuronId), 'data.selection.ranking')
  ranking.forEach((candidate, index) => {
    if (candidate.rank !== index + 1) fail('data.selection.ranking', 'ranks must be contiguous and in ascending order')
    if (candidate.selected !== (index < limit - seeds.length)) fail('data.selection.ranking', 'selection must be the leading candidates within the limit')
    if (candidate.chemicalSeedWeight === 0 && candidate.gapSeedWeight === 0) fail('data.selection.ranking', 'candidate must have a positive seed connection score')
    const previous = ranking[index - 1]
    if (previous && (
      previous.chemicalSeedWeight < candidate.chemicalSeedWeight
      || (previous.chemicalSeedWeight === candidate.chemicalSeedWeight && previous.gapSeedWeight < candidate.gapSeedWeight)
      || (previous.chemicalSeedWeight === candidate.chemicalSeedWeight && previous.gapSeedWeight === candidate.gapSeedWeight && previous.neuronId > candidate.neuronId)
    )) fail('data.selection.ranking', 'must be ordered by chemical score descending, gap score descending, then exact ID ascending')
  })
  const expectedIds = [...seeds, ...ranking.filter((candidate) => candidate.selected).map((candidate) => candidate.neuronId)]
  if (JSON.stringify(neuronIds) !== JSON.stringify(expectedIds)) fail('data.selection.neuronIds', 'must equal seeds followed by selected candidates in ranking order')
  const omittedByNeuron = array(selectionRaw.omittedByNeuron, 'data.selection.omittedByNeuron', (entry, path) => {
    const stats = omitted(entry, path)
    return { ...stats, neuronId: text(stats.neuronId, `${path}.neuronId`) }
  })
  unique(omittedByNeuron.map((entry) => entry.neuronId), 'data.selection.omittedByNeuron')
  if (omittedByNeuron.length !== ids.size || omittedByNeuron.some((entry) => !ids.has(entry.neuronId))) fail('data.selection.omittedByNeuron', 'must report every selected cell exactly once')
  const omittedExternal = omitted(selectionRaw.omittedExternal, 'data.selection.omittedExternal')
  const statFields = ['chemicalIncomingCount', 'chemicalOutgoingCount', 'gapCount', 'chemicalIncomingWeight', 'chemicalOutgoingWeight', 'gapWeight'] as const
  for (const field of statFields) {
    const sum = omittedByNeuron.reduce((total, entry) => total + entry[field], 0)
    if (!Number.isFinite(sum) || Math.abs(sum - omittedExternal[field]) > 1e-9 * Math.max(1, sum, omittedExternal[field])) {
      fail(`data.selection.omittedExternal.${field}`, 'must equal the aggregate per-cell statistics')
    }
  }
  const excludedGapSelfEntries = array(selectionRaw.excludedGapSelfEntries, 'data.selection.excludedGapSelfEntries', (entry, path) => {
    const diagonal = record(entry, path)
    const neuronId = text(diagonal.neuronId, `${path}.neuronId`)
    const selected = boolean(diagonal.selected, `${path}.selected`)
    if (selected !== ids.has(neuronId)) fail(path, 'diagonal selected flag disagrees with selected cells')
    const sourceRef = sourceReference(diagonal.sourceRef, `${path}.sourceRef`)
    if (sourceRef.row !== sourceRef.column) fail(`${path}.sourceRef`, 'diagonal record must sit on a diagonal cell (row equals column)')
    return { ...diagonal, neuronId, selected, rawWeight: number(diagonal.rawWeight, `${path}.rawWeight`, true), sourceRef }
  })
  unique(excludedGapSelfEntries.map((entry) => entry.neuronId), 'data.selection.excludedGapSelfEntries')
  const selection: ConnectomeSelection = {
    ...selectionRaw, algorithm: text(selectionRaw.algorithm, 'data.selection.algorithm'), seeds, limit, neuronIds, ranking,
    omittedExternal,
    omittedByNeuron, excludedGapSelfEntries,
  }
  const result: RealConnectome = { ...raw, schemaVersion: 1, dataset: dataset(raw.dataset, 'data.dataset'), neurons, chemicalEdges, gapEdges, selection }
  freezeRecursively(result)
  return result
}

/** Anatomy is preserved; all signs, gains, time constants and rate dynamics are assumptions. */
export function buildRealCircuit(data: ReadonlyRealConnectome, parameters: RealModelParameters = defaultRealModelParameters): Circuit {
  const validated = parseRealConnectome(data)
  const chemicalGain = number(parameters.chemicalGain, 'chemicalGain')
  const gapGain = number(parameters.gapGain, 'gapGain')
  const chemicalIncomingRawWeight = Object.fromEntries(validated.neurons.map((neuron) => [neuron.id, 0]))
  const gapIncidentRawWeight = Object.fromEntries(validated.neurons.map((neuron) => [neuron.id, 0]))
  for (const edge of validated.chemicalEdges) {
    chemicalIncomingRawWeight[edge.target]! += edge.rawWeight
    number(chemicalIncomingRawWeight[edge.target], `incoming raw weight for ${edge.target}`)
  }
  for (const edge of validated.gapEdges) {
    gapIncidentRawWeight[edge.a]! += edge.rawWeight
    gapIncidentRawWeight[edge.b]! += edge.rawWeight
    number(gapIncidentRawWeight[edge.a], `incident raw weight for ${edge.a}`)
    number(gapIncidentRawWeight[edge.b], `incident raw weight for ${edge.b}`)
  }
  const chemicalDenominatorByTarget = Object.fromEntries(validated.neurons.map((neuron) => [neuron.id, Math.max(1, chemicalIncomingRawWeight[neuron.id]!)]))
  const gapDenominatorByConnection = Object.fromEntries(validated.gapEdges.map((edge) => [edge.id, Math.max(1, gapIncidentRawWeight[edge.a]!, gapIncidentRawWeight[edge.b]!)]))
  const realData: NonNullable<Circuit['realData']> = {
    dataset: validated.dataset, selection: validated.selection, parameters: { chemicalGain, gapGain },
    modelAssumptions: {
      chemicalSign: 'unknown-assumed-positive', dynamics: 'dimensionless-continuous-rate-assumption',
      boundary: 'isolated-induced-subgraph', externalChemicalInput: 'zero', externalGapConnections: 'removed',
      diagonalGapEntries: 'reported-not-simulated',
    },
    normalization: { chemicalFormula: chemicalNormalizationFormula, gapFormula: gapNormalizationFormula,
      chemicalIncomingRawWeight, gapIncidentRawWeight, chemicalDenominatorByTarget, gapDenominatorByConnection },
  }
  freezeRecursively(realData)
  return {
    id: `${validated.dataset.id}:assumed-rate-model`,
    name: 'C. elegans — anatomiden varsayımsal devre modeli',
    provenance: `${validated.dataset.title} (${validated.dataset.version}); seçilmiş anatomik alt ağ. Kimyasal işaret bilinmiyor ve pozitif varsayılıyor. Boyutsuz dinamik, ağırlık normalizasyonu ve zaman sabitleri ölçülmüş biyoloji değildir. Dış kimyasal giriş sıfır; dış elektriksel bağlantılar kesilmiş; köşegen kayıtlar yalnızca raporlanmıştır.`,
    neurons: validated.neurons.map((neuron, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / validated.neurons.length
      return {
        id: neuron.id, label: neuron.label, role: 'unspecified', cellType: neuron.cellType, sourceRef: neuron.sourceRef,
        description: `${neuron.id}: kaynak hücre sınıfı “${neuron.cellType}”. Uyarılan/okunan hücre seçimi deney ayarıdır; giriş veya çıkış görevi atanmamıştır. Aktivite ve zaman sabiti varsayımsal model değerleridir.`,
        position: { x: 390 + 280 * Math.cos(angle), y: 320 + 260 * Math.sin(angle) },
      }
    }),
    connections: [
      ...validated.chemicalEdges.map((edge) => {
        const weight = chemicalGain * (edge.rawWeight / chemicalDenominatorByTarget[edge.target]!)
        number(weight, `normalized chemical weight for ${edge.id}`)
        return {
          id: edge.id, source: edge.source, target: edge.target, kind: 'chemical' as const,
          rawWeight: edge.rawWeight, weight, sourceRef: edge.sourceRef, evidence: 'anatomy-with-assumed-dynamics' as const,
          note: `Kaynakta yönlü kimyasal anatomik bağlantı; ham ağırlık ${edge.rawWeight}. İşaret bilinmiyor; pozitif etki varsayıldı. Normalize model ağırlığı ölçülmüş güç değildir.`,
        }
      }),
      ...validated.gapEdges.map((edge) => {
        const weight = gapGain * (edge.rawWeight / gapDenominatorByConnection[edge.id]!)
        number(weight, `normalized gap weight for ${edge.id}`)
        return {
          id: edge.id, source: edge.a, target: edge.b, kind: 'gap' as const,
          rawWeight: edge.rawWeight, weight, sourceRef: edge.sourceRef, reciprocalSourceRef: edge.reciprocalSourceRef,
          evidence: 'anatomy-with-assumed-dynamics' as const,
          note: `Kaynakta simetrik elektriksel anatomik bağlantı; ham ağırlık ${edge.rawWeight}. Tek fiziksel kenar iki yönde g·(komşu−hücre) yayılımı uygular; g boyutsuz varsayımdır.`,
        }
      }),
    ],
    realData,
  }
}
