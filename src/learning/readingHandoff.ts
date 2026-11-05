import type { ReadonlyRealConnectome } from '../model/types'

/** All existing experiment controls; this records a draft, never results. */
export interface ExperimentDraft {
  mode: 'illustrative' | 'real'
  graphView: '2d' | '3d'
  chemicalGain: number
  gapGain: number
  focusConnections: boolean
  scaleToResponse: boolean
  activeCondition: 'baseline' | 'silenced' | 'tau'
  stimulusTarget: string
  amplitude: number
  pulseDuration: number
  baseTau: number
  changedTau: number
  changedNeuron: string
  selectedEdge: string
  outputNeuron: string
  selectedNeuron: string
  dt: number
  cursorMs: number
  playing: boolean
}

/** A display selection preserves controls; only absent source IDs are mapped. */
export function prepareRealInspection(
  draft: Readonly<ExperimentDraft>, data: ReadonlyRealConnectome, neuronId: string,
): Readonly<ExperimentDraft> {
  const ids = new Set(data.neurons.map(neuron => neuron.id))
  if (!ids.has(neuronId)) throw new Error('The inspected neuron must be in the loaded anatomical subset')
  const edgeIds = new Set([...data.chemicalEdges, ...data.gapEdges].map(edge => edge.id))
  const input = ids.has('AVER') ? 'AVER' : data.neurons[0]!.id
  const output = ids.has('AVAR') ? 'AVAR' : input
  const fallbackEdge = data.chemicalEdges.find(edge => edge.source === input && edge.target === output)?.id
    ?? data.chemicalEdges[0]?.id ?? data.gapEdges[0]?.id
  if (!fallbackEdge) throw new Error('The experiment needs at least one anatomical connection')
  return Object.freeze({
    ...draft, mode: 'real', selectedNeuron: neuronId,
    stimulusTarget: ids.has(draft.stimulusTarget) ? draft.stimulusTarget : input,
    outputNeuron: ids.has(draft.outputNeuron) ? draft.outputNeuron : output,
    changedNeuron: ids.has(draft.changedNeuron) ? draft.changedNeuron : output,
    selectedEdge: edgeIds.has(draft.selectedEdge) ? draft.selectedEdge : fallbackEdge,
  })
}
