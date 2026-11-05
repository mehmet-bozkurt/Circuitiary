import { describe, expect, it } from 'vitest'
import { illustrativeCircuit } from '../model/circuit'
import type { Circuit, RealCircuitMetadata } from '../model/types'
import { schematicPositions } from './layout3d'

function realCircuit(count: number): Circuit {
  return {
    id: 'real-layout-fixture',
    name: 'Layout fixture',
    provenance: 'Test fixture only.',
    neurons: Array.from({ length: count }, (_, index) => ({
      id: `N${String(index).padStart(2, '0')}`,
      label: `Cell ${index}`,
      role: 'unspecified' as const,
      description: 'Test fixture.',
      position: { x: 0, y: 0 },
    })),
    connections: [],
    // The helper branches on presence, never reads or invents biological metadata.
    realData: {} as RealCircuitMetadata,
  }
}

describe('schematicPositions', () => {
  it('puts the teaching circuit in role columns with finite, distinct positions', () => {
    const positions = schematicPositions(illustrativeCircuit)
    expect(Object.keys(positions)).toHaveLength(8)
    const uniquePositions = new Set<string>()
    for (const neuron of illustrativeCircuit.neurons) {
      const point = positions[neuron.id]!
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true)
      expect(point.x).toBe(neuron.role === 'input' ? -3 : neuron.role === 'output' ? 3 : 0)
      uniquePositions.add(JSON.stringify(point))
    }
    expect(uniquePositions.size).toBe(8)
    expect(new Set(Object.values(positions).map(point => point.z)).size).toBeGreaterThan(1)
  })

  it('is deterministic and independent of neuron and connection iteration order', () => {
    for (const circuit of [illustrativeCircuit, realCircuit(30)]) {
      const reordered = {
        ...circuit,
        neurons: [...circuit.neurons].reverse(),
        connections: [...circuit.connections].reverse(),
      }
      expect(schematicPositions(reordered)).toEqual(schematicPositions(circuit))
      expect(schematicPositions(circuit)).toEqual(schematicPositions(circuit))
    }
  })

  it('spreads 30 imported cells at distinct points on a finite schematic sphere', () => {
    const circuit = realCircuit(30)
    const positions = schematicPositions(circuit)
    expect(Object.keys(positions)).toHaveLength(30)
    const uniquePositions = new Set<string>()
    for (const point of Object.values(positions)) {
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true)
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(3.5, 12)
      uniquePositions.add(JSON.stringify(point))
    }
    expect(uniquePositions.size).toBe(30)
  })

  it('handles empty and single-cell real circuits without division errors', () => {
    expect(Object.keys(schematicPositions(realCircuit(0)))).toEqual([])
    const one = schematicPositions(realCircuit(1))
    expect(one.N00).toEqual({ x: 3.5, y: 0, z: 0 })
  })

  it('does not mutate source neurons or their existing 2D coordinates', () => {
    const circuit = realCircuit(30)
    const before = JSON.stringify(circuit)
    schematicPositions(circuit)
    expect(JSON.stringify(circuit)).toBe(before)
    expect(circuit.neurons[0]!.position).toEqual({ x: 0, y: 0 })
  })
})
