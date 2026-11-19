<script setup lang="ts">
import { computed } from 'vue'
import type { BuilderDraft } from '../learning/circuitBuilder'
import { SCHEMATIC, layoutSchematic, schematicLabel } from '../learning/motifSchematic'

// The picture of a circuit, drawn from the circuit itself (src/learning/motifSchematic.ts).
const props = defineProps<{ draft: BuilderDraft }>()
const picture = computed(() => layoutSchematic(props.draft))
const label = computed(() => schematicLabel(props.draft))
</script>

<template>
  <svg class="motif-schematic" role="img" :aria-label="label" :viewBox="`0 0 ${SCHEMATIC.width} ${SCHEMATIC.height}`">
    <g v-for="edge in picture.edges" :key="edge.key" :data-edge="edge.type">
      <path v-for="(line, index) in edge.lines" :key="index" :d="line" class="edge-line" />
      <path v-if="edge.mark" :d="edge.mark" :class="edge.type === 'excitatory' ? 'edge-arrow' : 'edge-bar'" />
    </g>
    <g v-for="node in picture.nodes" :key="node.id" :data-node="node.id" :data-stimulated="node.stimulated">
      <circle v-if="node.stimulated" :cx="node.x" :cy="node.y" :r="SCHEMATIC.radius + SCHEMATIC.ring" class="node-ring" />
      <circle :cx="node.x" :cy="node.y" :r="SCHEMATIC.radius" class="node-disc" />
      <text :x="node.x" :y="node.y" text-anchor="middle" dominant-baseline="central">{{ node.id }}</text>
    </g>
  </svg>
</template>

<style scoped>
.motif-schematic { display: block; width: 100%; height: auto; color: var(--theme-text, #263b35); }
.edge-line { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
.edge-arrow { fill: currentColor; stroke: currentColor; stroke-width: 1; stroke-linejoin: round; }
.edge-bar { fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; }
.node-disc { fill: var(--theme-surface, #fbfcf7); stroke: currentColor; stroke-width: 1.6; }
.node-ring { fill: none; stroke: currentColor; stroke-width: 1.2; }
.motif-schematic text { fill: currentColor; font: 600 12px var(--mono, monospace); }
</style>
