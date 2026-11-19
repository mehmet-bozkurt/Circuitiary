export interface SourceReference {
  sheet: string
  row: number
  column: number
  cell: string
  [key: string]: unknown
}

export interface AnatomicalNeuron {
  id: string
  label: string
  cellType: 'sensory' | 'interneuron' | 'motorneuron' | 'neuron'
  sourceRef: SourceReference
  [key: string]: unknown
}

export interface AnatomicalChemicalEdge {
  id: string
  source: string
  target: string
  rawWeight: number
  sourceRef: SourceReference
  [key: string]: unknown
}

/** One physical gap record, stored once in canonical a < b order. */
export interface AnatomicalGapEdge {
  id: string
  a: string
  b: string
  rawWeight: number
  sourceRef: SourceReference
  reciprocalSourceRef: SourceReference
  [key: string]: unknown
}

export interface OmittedConnections {
  chemicalIncomingCount: number
  chemicalOutgoingCount: number
  gapCount: number
  chemicalIncomingWeight: number
  chemicalOutgoingWeight: number
  gapWeight: number
  [key: string]: unknown
}

export interface ConnectomeSelection {
  algorithm: string
  seeds: string[]
  limit: number
  neuronIds: string[]
  ranking: Array<{
    neuronId: string
    chemicalSeedWeight: number
    gapSeedWeight: number
    rank: number
    selected: boolean
    [key: string]: unknown
  }>
  omittedExternal: OmittedConnections
  omittedByNeuron: Array<OmittedConnections & { neuronId: string }>
  /** Source diagonal entries are reported, never simulated as physical gaps. */
  excludedGapSelfEntries: Array<{
    neuronId: string
    rawWeight: number
    sourceRef: SourceReference
    selected: boolean
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface ConnectomeDataset {
  id: string
  title: string
  version: string
  doi: string
  sources: Array<{
    name: string
    url: string
    sha256: string
    downloadedAtUtc: string
    [key: string]: unknown
  }>
  license: { status: 'unverified-local-only'; note: string; [key: string]: unknown }
  anatomicalWeightUnit: string
  orientation: string
  provenanceNotes: string[]
  [key: string]: unknown
}

export interface RealConnectome {
  schemaVersion: 1
  dataset: ConnectomeDataset
  neurons: AnatomicalNeuron[]
  chemicalEdges: AnatomicalChemicalEdge[]
  gapEdges: AnatomicalGapEdge[]
  selection: ConnectomeSelection
  [key: string]: unknown
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export type ReadonlyRealConnectome = DeepReadonly<RealConnectome>

export interface RealModelParameters {
  chemicalGain: number
  gapGain: number
}

export interface RealCircuitMetadata {
  dataset: DeepReadonly<ConnectomeDataset>
  selection: DeepReadonly<ConnectomeSelection>
  parameters: Readonly<RealModelParameters>
  modelAssumptions: {
    chemicalSign: 'unknown-assumed-positive'
    dynamics: 'dimensionless-continuous-rate-assumption'
    boundary: 'isolated-induced-subgraph'
    externalChemicalInput: 'zero'
    externalGapConnections: 'removed'
    diagonalGapEntries: 'reported-not-simulated'
  }
  normalization: {
    chemicalFormula: string
    gapFormula: string
    chemicalIncomingRawWeight: Readonly<Record<string, number>>
    gapIncidentRawWeight: Readonly<Record<string, number>>
    chemicalDenominatorByTarget: Readonly<Record<string, number>>
    gapDenominatorByConnection: Readonly<Record<string, number>>
  }
}

export interface Neuron {
  id: string
  label: string
  role: 'input' | 'interneuron' | 'output' | 'unspecified'
  description: string
  position: { x: number; y: number }
  cellType?: AnatomicalNeuron['cellType']
  sourceRef?: DeepReadonly<SourceReference>
}

export interface Connection {
  id: string
  source: string
  target: string
  /** Signed chemical weight, or nonnegative physical gap conductance; dimensionless. */
  weight: number
  evidence: 'illustrative' | 'anatomy-with-assumed-dynamics'
  note: string
  /** Absent in the original illustrative circuit; treated as chemical there. */
  kind?: 'chemical' | 'gap'
  rawWeight?: number
  sourceRef?: DeepReadonly<SourceReference>
  reciprocalSourceRef?: DeepReadonly<SourceReference>
}

export interface Circuit {
  id: string
  name: string
  provenance: string
  neurons: Neuron[]
  connections: Connection[]
  realData?: RealCircuitMetadata
}

/** How the input changes inside the stimulus window; an absent shape is the rectangular pulse. */
export type StimulusShape = 'pulse' | 'ramp' | 'sine'

/**
 * A reproducible pseudo-random addition to the input inside the stimulus window: piecewise constant
 * over `holdMs`, so it does not depend on the time step. It is a teaching input, not a model of
 * biological noise.
 */
export interface StimulusNoise {
  /** Largest absolute value of the addition; dimensionless, in [0, 1]. */
  amplitude: number
  /** Integer in [0, 4294967295]; the same seed gives the same sequence. */
  seed: number
  /** Length of one constant interval, counted from the stimulus onset. */
  holdMs: number
}

export interface StimulusConfig {
  target: string
  onsetMs: number
  durationMs: number
  /** Dimensionless, in [0, 1]: the pulse height, the end value of the ramp, the top of the sine. */
  amplitude: number
  /** Absent means 'pulse'. */
  shape?: StimulusShape
  /** Period of the sine shape; required for it and unused by the other shapes. */
  periodMs?: number
  /** Absent means no addition. */
  noise?: StimulusNoise
}

export interface SimulationConfig {
  durationMs: number
  dtMs: number
  tauMs: number
  stimulus: StimulusConfig
  silencedConnectionId?: string
  tauOverrides?: Record<string, number>
  /** Dimensionless activity in [0, 1]. Unspecified neurons start at zero. */
  initialState?: Record<string, number>
}

export interface SimulationResult {
  timesMs: number[]
  /** Dimensionless activity; these values are not volts or firing rates. */
  activity: Record<string, number[]>
  settings: SimulationConfig
}
