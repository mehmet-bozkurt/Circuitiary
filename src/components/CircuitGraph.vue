<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { Core, EdgeSingular } from 'cytoscape'
import type { Circuit } from '../model/types'

const props = withDefaults(defineProps<{
  circuit: Circuit
  activity: Record<string, number>
  selectedNode: string
  silencedConnectionId?: string
  /** Visual filtering only. The complete circuit still enters the simulation. */
  focusConnections?: boolean
}>(), { focusConnections: false })
const emit = defineEmits<{ select: [id: string] }>()
const container = ref<HTMLDivElement>()
const graphReady = ref(false)
const isRealCircuit = computed(() => Boolean(props.circuit.realData))
let graph: Core | undefined
let observer: ResizeObserver | undefined
let disposed = false
let gridColumns = 0

const roleColor = (role: string) => role === 'input' ? '#d8b978' : role === 'output' ? '#aed6c4' : role === 'interneuron' ? '#b9c5d3' : '#c4d1c8'

function update() {
  if (!graph) return
  const zoom = graph.zoom()
  const modelWeights = new Map(props.circuit.connections.map(connection => [connection.id, connection.weight]))
  const focus = isRealCircuit.value && props.focusConnections && graph.getElementById(props.selectedNode).isNode()
  graph.batch(() => {
    graph!.nodes().forEach(node => {
      const activity = Math.max(0, Math.min(1, props.activity[node.id()] ?? 0))
      const selected = node.id() === props.selectedNode
      node.style({
        'font-size': 12 / zoom,
        'width': Math.max(46, 32 / zoom) + activity * 12,
        'height': Math.max(46, 32 / zoom) + activity * 12,
        'background-opacity': 0.3 + activity * 0.7,
        'border-width': isRealCircuit.value ? (selected ? 3 : 1) / zoom : selected ? 4 : 1.5,
        'border-color': selected ? '#ffffff' : roleColor(node.data('role')),
      })
    })
    graph!.edges().forEach(edge => {
      const modelWeight = modelWeights.get(edge.id()) ?? 0
      edge.data('weight', modelWeight)
      const muted = edge.id() === props.silencedConnectionId
      const gap = edge.data('kind') === 'gap'
      const incident = edge.source().id() === props.selectedNode || edge.target().id() === props.selectedNode
      edge.style({
        'width': 1.4 + Math.min(1.5, Math.abs(modelWeight)) * 2,
        'display': focus && !incident ? 'none' : 'element',
        'opacity': muted ? 0.24 : isRealCircuit.value && incident ? 0.85 : 0.65,
        'line-style': gap || muted ? 'dashed' : 'solid',
      })
    })
  })
}

function fitGraph() {
  if (!graph) return
  graph.minZoom(0.01)
  graph.fit(isRealCircuit.value ? graph.nodes() : undefined, 38)
  const fittedZoom = graph.zoom()
  graph.minZoom(fittedZoom * 0.75)
  graph.maxZoom(Math.max(2.5, fittedZoom * 3))
  update()
}

function changeZoom(factor: number) {
  if (!graph || !container.value) return
  const zoom = Math.max(graph.minZoom(), Math.min(graph.maxZoom(), graph.zoom() * factor))
  graph.zoom({ level: zoom, renderedPosition: { x: container.value.clientWidth / 2, y: container.value.clientHeight / 2 } })
}

function resizeGraph() {
  if (!graph || !container.value) return
  graph.resize()
  if (isRealCircuit.value) {
    const columns = container.value.clientWidth < 460 ? 3 : 6
    if (columns !== gridColumns) {
      gridColumns = columns
      graph.nodes().positions((_node, index) => {
        // Row order follows the dataset's deterministic cell order. This is a
        // reading layout, not a biological coordinate or anatomical position.
        return { x: (index % columns) * 110, y: Math.floor(index / columns) * 78 }
      })
    }
  }
  fitGraph()
}

onMounted(async () => {
  const { default: cytoscape } = await import('cytoscape')
  if (disposed || !container.value) return
  graph = cytoscape({
    container: container.value,
    elements: [
      ...props.circuit.neurons.map(neuron => ({ data: { id: neuron.id, role: neuron.role, label: neuron.id }, position: neuron.position })),
      ...props.circuit.connections.map(connection => ({ data: { id: connection.id, source: connection.source, target: connection.target, weight: connection.weight, kind: connection.kind ?? 'chemical' } })),
    ],
    layout: { name: 'preset', padding: 38 },
    userZoomingEnabled: isRealCircuit.value,
    userPanningEnabled: isRealCircuit.value,
    autoungrabify: true,
    style: [
      { selector: 'node', style: {
        'label': 'data(label)', 'color': '#f5f4e9', 'font-size': 14, 'font-family': 'ui-monospace, monospace',
        'text-outline-color': '#192d2b', 'text-outline-width': 2,
        'text-valign': 'center', 'text-halign': 'center', 'background-color': node => roleColor(node.data('role')),
        'width': 46, 'height': 46, 'border-width': 1.5, 'border-color': '#c7d6d2',
      } },
      { selector: 'edge', style: {
        'width': (edge: EdgeSingular) => 1.4 + Math.min(1.5, Math.abs(Number(edge.data('weight')))) * 2,
        'line-color': '#aabbb9', 'target-arrow-color': '#aabbb9', 'target-arrow-shape': 'triangle',
        'curve-style': 'bezier', 'arrow-scale': 0.85,
      } },
      { selector: 'edge[weight < 0]', style: { 'line-color': '#d69792', 'target-arrow-color': '#d69792', 'target-arrow-shape': 'tee' } },
      { selector: 'edge[kind = "gap"]', style: {
        'line-color': '#90bde1', 'target-arrow-color': '#90bde1', 'target-arrow-shape': 'none',
        'source-arrow-shape': 'none', 'line-style': 'dashed',
      } },
    ],
  })
  graph.on('tap', 'node', event => emit('select', event.target.id()))
  graph.on('zoom', update)
  resizeGraph()
  graphReady.value = true
  observer = new ResizeObserver(resizeGraph)
  observer.observe(container.value)
})

watch(() => [props.activity, props.selectedNode, props.silencedConnectionId, props.focusConnections, props.circuit], update, { deep: true })
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); graph?.destroy() })
</script>

<template>
  <div v-if="isRealCircuit" class="graph-tools" aria-label="Grafik yakınlaştırma">
    <button type="button" :disabled="!graphReady" @click="fitGraph">Tüm hücreleri sığdır</button>
    <div class="graph-zoom-buttons">
      <button type="button" :disabled="!graphReady" aria-label="Grafiği uzaklaştır" @click="changeZoom(1 / 1.25)">−</button>
      <button type="button" :disabled="!graphReady" aria-label="Grafiği yakınlaştır" @click="changeZoom(1.25)">+</button>
    </div>
  </div>
  <div ref="container" class="circuit-canvas" :class="{ 'real-circuit-canvas': isRealCircuit }" aria-hidden="true"></div>
</template>

<style scoped>
.real-circuit-canvas { height: 600px; touch-action: none; }
.graph-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; z-index: 1; padding-top: 16px; }
.graph-tools button { background: #3a5145; color: #f2f4e8; border: 1px solid #6d8876; border-radius: 4px; font-size: 11px; min-height: 38px; padding: 8px 12px; }
.graph-tools button:disabled { opacity: .5; cursor: default; }
.graph-zoom-buttons { display: flex; gap: 6px; }
.graph-zoom-buttons button { font-size: 18px; width: 38px; padding: 5px; }
@media (max-width: 760px) { .real-circuit-canvas { height: 650px; } }
</style>
