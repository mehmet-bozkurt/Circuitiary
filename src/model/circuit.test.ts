import { describe, expect, it } from 'vitest'
import { defaultConfig, illustrativeCircuit, illustrativeCircuitEn } from './circuit'
import { simulate } from './simulation'

const turkishLetters = /[ğşıİçöüĞŞÇÖÜ]/

describe('English twin of the illustrative circuit', () => {
  it('has the same ids, roles, positions, weights and order as the Turkish circuit', () => {
    expect(illustrativeCircuitEn.id).toBe(illustrativeCircuit.id)
    expect(illustrativeCircuitEn.neurons).toHaveLength(illustrativeCircuit.neurons.length)
    expect(illustrativeCircuitEn.connections).toHaveLength(illustrativeCircuit.connections.length)
    const neuronShape = ({ id, role, position }: typeof illustrativeCircuit.neurons[number]) => ({ id, role, position })
    expect(illustrativeCircuitEn.neurons.map(neuronShape)).toEqual(illustrativeCircuit.neurons.map(neuronShape))
    const edgeShape = ({ note: _note, ...rest }: typeof illustrativeCircuit.connections[number]) => rest
    expect(illustrativeCircuitEn.connections.map(edgeShape)).toEqual(illustrativeCircuit.connections.map(edgeShape))
  })

  it('translates every text field and keeps the cell names in the labels', () => {
    const texts = (circuit: typeof illustrativeCircuit) => [
      circuit.name, circuit.provenance,
      ...circuit.neurons.flatMap((neuron) => [neuron.label, neuron.description]),
      ...circuit.connections.map((edge) => edge.note),
    ]
    const turkish = texts(illustrativeCircuit)
    const english = texts(illustrativeCircuitEn)
    expect(english).toHaveLength(turkish.length)
    english.forEach((text, index) => {
      expect(text.trim()).toBe(text)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toBe(turkish[index])
      expect(text).not.toMatch(turkishLetters)
    })
    for (const neuron of illustrativeCircuitEn.neurons) expect(neuron.label).toContain(neuron.id)
  })

  it('gives the same simulation as the Turkish circuit', () => {
    expect(simulate(illustrativeCircuitEn, defaultConfig).activity).toEqual(simulate(illustrativeCircuit, defaultConfig).activity)
  })
})
