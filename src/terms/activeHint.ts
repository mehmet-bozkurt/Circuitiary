import { shallowRef } from 'vue'

// A single open explanation, including across text blocks and page changes.
export const activeHint = shallowRef<string | null>(null)
