import type { Circuit, Neuron } from '../model/types'

export interface Position3D {
  x: number
  y: number
  z: number
}

/**
 * Stable schematic coordinates only: these are not measured anatomical positions.
 * Sorting IDs keeps the view fixed when import or connection order changes.
 */
export function schematicPositions(circuit: Circuit): Record<string, Position3D> {
  const neurons = [...circuit.neurons].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const positions: Record<string, Position3D> = Object.create(null)

  if (circuit.realData) {
    // A Fibonacci sphere separates the imported cells without a force simulation.
    const radius = 3.5
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    neurons.forEach((neuron, index) => {
      const vertical = 1 - 2 * (index + 0.5) / neurons.length
      const ringRadius = Math.sqrt(Math.max(0, 1 - vertical * vertical))
      const angle = index * goldenAngle
      positions[neuron.id] = {
        x: radius * ringRadius * Math.cos(angle),
        y: radius * vertical,
        z: radius * ringRadius * Math.sin(angle),
      }
    })
    return positions
  }

  // The teaching circuit uses operational role columns, not biological locations.
  const roles: Neuron['role'][] = ['input', 'interneuron', 'output', 'unspecified']
  const columnX: Record<Neuron['role'], number> = {
    input: -3,
    interneuron: 0,
    output: 3,
    unspecified: 0,
  }
  roles.forEach((role) => {
    const column = neurons.filter(neuron => neuron.role === role)
    column.forEach((neuron, index) => {
      positions[neuron.id] = {
        x: columnX[role],
        y: ((column.length - 1) / 2 - index) * 1.5,
        z: (index % 2 === 0 ? 1 : -1) * (role === 'interneuron' ? 0.75 : 0.45),
      }
    })
  })
  return positions
}
