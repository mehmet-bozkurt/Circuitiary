<script setup lang="ts">
import { computed } from 'vue'
import { splitTerms } from '../terms/glossary'
import TermHint from './TermHint.vue'
const props = defineProps<{ text: unknown }>()
const segments = computed(() => splitTerms(props.text))
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index"><TermHint v-if="segment.term" :term="segment.term" :label="segment.text" /><template v-else>{{ segment.text }}</template></template>
</template>
