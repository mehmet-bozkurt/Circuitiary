<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as ThreeTypes from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/addons/controls/OrbitControls.js'
import type { Circuit, Connection } from '../model/types'
import { schematicPositions } from '../view/layout3d'
import { decimal } from '../format'

const props = withDefaults(defineProps<{
  circuit: Circuit
  activity: Record<string, number>
  selectedNode: string
  silencedConnectionId?: string
  /** Only line visibility changes; the complete circuit still drives dynamics. */
  focusConnections?: boolean
}>(), { focusConnections: false })
const emit = defineEmits<{ select: [id: string]; request2d: [] }>()

type RendererStatus = 'loading' | 'ready' | 'unavailable' | 'context-lost' | 'error'
interface NodeLabel { id: string; x: number; y: number; projectedX: number; projectedY: number; visible: boolean; depth: number; layer: number }
interface EdgeVisual { connection: Connection; group: ThreeTypes.Group; materials: ThreeTypes.Material[]; head?: ThreeTypes.Mesh }
type NodeMesh = ThreeTypes.Mesh<ThreeTypes.SphereGeometry, ThreeTypes.MeshStandardMaterial>

const viewport = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const rendererStatus = ref<RendererStatus>('loading')
const failureMessage = ref('')
const renderCount = ref(0)
const nodeCount = ref(0)
const visibleEdgeCount = ref(0)
const cameraPosition = ref('')
const cameraTarget = ref('')
const cameraQuaternion = ref('')
const labels = ref<NodeLabel[]>([])
const instanceId = globalThis.crypto?.randomUUID?.() ?? `circuit-3d-${Date.now()}-${Math.random().toString(36).slice(2)}`
const topologySignature = computed(() => JSON.stringify({
  real: Boolean(props.circuit.realData),
  neurons: props.circuit.neurons.map(node => [node.id, node.role]),
  edges: props.circuit.connections.map(edge => [edge.id, edge.source, edge.target, edge.kind, edge.weight < 0]),
}))

let THREE: typeof import('three') | undefined
let renderer: ThreeTypes.WebGLRenderer | undefined
let rawContext: WebGL2RenderingContext | undefined
let graphicsCanvas: HTMLCanvasElement | undefined
let scene: ThreeTypes.Scene | undefined
let camera: ThreeTypes.PerspectiveCamera | undefined
let controls: OrbitControlsType | undefined
let raycaster: ThreeTypes.Raycaster | undefined
let halo: ThreeTypes.Mesh | undefined
let resizeObserver: ResizeObserver | undefined
let pendingFrame = 0
let disposed = false
let createdEventSent = false
let runtimeListenersActive = false
let fitRadius = 4
let pointerStart: { x: number; y: number; id: number; moved: boolean } | undefined
const activePointers = new Set<number>()
const nodeMeshes = new Map<string, NodeMesh>()
const edges: EdgeVisual[] = []
const geometries = new Set<ThreeTypes.BufferGeometry>()
const materials = new Set<ThreeTypes.Material>()

function roleColor(role: string) {
  return role === 'input' ? '#d8b978' : role === 'output' ? '#aed6c4' : role === 'interneuron' ? '#b9c5d3' : '#c4d1c8'
}

function activityFor(id: string) {
  const value = props.activity[id] ?? 0
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function trackGeometry<T extends ThreeTypes.BufferGeometry>(geometry: T): T { geometries.add(geometry); return geometry }
function trackMaterial<T extends ThreeTypes.Material>(material: T): T { materials.add(material); return material }

function releaseSceneResources() {
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
  geometries.clear()
  materials.clear()
  nodeMeshes.clear()
  edges.length = 0
  scene?.clear()
  halo = undefined
  labels.value = []
  nodeCount.value = 0
  visibleEdgeCount.value = 0
}

function releaseGraphics() {
  if (pendingFrame) cancelAnimationFrame(pendingFrame)
  pendingFrame = 0
  resizeObserver?.disconnect()
  resizeObserver = undefined
  controls?.removeEventListener('change', requestRender)
  controls?.dispose()
  controls = undefined
  if (graphicsCanvas) {
    graphicsCanvas.removeEventListener('webglcontextlost', contextLost)
    if (runtimeListenersActive) {
      graphicsCanvas.removeEventListener('pointerdown', pointerDown)
      graphicsCanvas.removeEventListener('pointermove', pointerMove)
      graphicsCanvas.removeEventListener('pointerup', pointerUp)
      graphicsCanvas.removeEventListener('pointercancel', pointerCancel)
      graphicsCanvas.removeEventListener('keydown', canvasKey)
    }
  }
  if (runtimeListenersActive) document.removeEventListener('visibilitychange', visibilityChanged)
  runtimeListenersActive = false
  pointerStart = undefined
  activePointers.clear()
  releaseSceneResources()
  const oldRenderer = renderer
  renderer = undefined
  if (oldRenderer) {
    oldRenderer.renderLists.dispose()
    oldRenderer.dispose()
    if (!rawContext?.isContextLost()) oldRenderer.forceContextLoss()
  } else if (rawContext && !rawContext.isContextLost()) {
    rawContext.getExtension('WEBGL_lose_context')?.loseContext()
  }
  if (createdEventSent) {
    window.dispatchEvent(new CustomEvent('circuitiary:3d-disposed', { detail: { instanceId } }))
    createdEventSent = false
  }
  rawContext = undefined
  graphicsCanvas = undefined
  scene = undefined
  camera = undefined
  raycaster = undefined
}

function fail(status: Exclude<RendererStatus, 'loading' | 'ready'>, message: string) {
  if (disposed) return
  rendererStatus.value = status
  failureMessage.value = message
  releaseGraphics()
}

function contextLost(event: Event) {
  event.preventDefault()
  fail('context-lost', '3D görünüm kesildi. 2D görünümden deneyine devam edebilirsin.')
}

function requestRender() {
  if (disposed || pendingFrame || !renderer || !scene || !camera || document.hidden) return
  if (rendererStatus.value !== 'ready' && rendererStatus.value !== 'loading') return
  pendingFrame = requestAnimationFrame(renderScene)
}

function visibilityChanged() { if (!document.hidden) requestRender() }

function worldUnitsPerPixel(position: ThreeTypes.Vector3) {
  if (!camera || !viewport.value) return 0.03
  const distance = camera.position.distanceTo(position)
  return 2 * distance * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, viewport.value.clientHeight)
}

function updateAppearance() {
  if (!THREE || !camera) return
  const real = Boolean(props.circuit.realData)
  nodeMeshes.forEach((mesh, id) => {
    const activity = activityFor(id)
    const color = new THREE!.Color(roleColor(mesh.userData.role as string))
    mesh.material.color.copy(color).multiplyScalar(0.42 + activity * 0.58)
    mesh.material.emissive.copy(color)
    mesh.material.emissiveIntensity = 0.05 + activity * 0.7
    const radius = worldUnitsPerPixel(mesh.position) * (real ? 10 : 14) * (1 + activity * 0.12)
    mesh.scale.setScalar(radius)
    mesh.userData.activity = activity
  })
  const selected = nodeMeshes.get(props.selectedNode)
  if (halo) {
    halo.visible = Boolean(selected)
    if (selected) {
      halo.position.copy(selected.position)
      halo.quaternion.copy(camera.quaternion)
      halo.scale.setScalar(selected.scale.x * 1.5)
    }
  }
  let visibleCount = 0
  edges.forEach(edge => {
    const connection = edge.connection
    const incident = connection.source === props.selectedNode || connection.target === props.selectedNode
    edge.group.visible = !props.focusConnections || !selected || incident
    if (edge.group.visible) visibleCount += 1
    const muted = connection.id === props.silencedConnectionId
    edge.materials.forEach(material => {
      material.opacity = muted ? 0.18 : incident ? 0.92 : 0.62
      material.transparent = true
    })
    if (edge.head) edge.head.scale.setScalar(worldUnitsPerPixel(edge.head.position) * 10)
  })
  visibleEdgeCount.value = visibleCount
}

function projectLabels() {
  if (!camera || !viewport.value) return
  const width = viewport.value.clientWidth
  const height = viewport.value.clientHeight
  const projected: NodeLabel[] = []
  nodeMeshes.forEach((mesh, id) => {
    const position = mesh.position.clone().project(camera!)
    projected.push({
      id, x: 0, y: 0,
      projectedX: (position.x + 1) / 2 * width,
      projectedY: (1 - position.y) / 2 * height,
      visible: position.z >= -1 && position.z <= 1 && Math.abs(position.x) <= 1.1 && Math.abs(position.y) <= 1.1,
      depth: camera!.position.distanceTo(mesh.position),
      layer: 0,
    })
  })
  // Label placement is screen-space bookkeeping, never a biological location.
  // Resolve nearby labels while retaining a guide to each actual sphere center.
  projected.sort((a, b) => Number(b.id === props.selectedNode) - Number(a.id === props.selectedNode) || a.depth - b.depth || a.id.localeCompare(b.id))
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = []
  const offsets = [[0, 23], [0, -23], [38, 0], [-38, 0], [38, 28], [-38, 28], [38, -28], [-38, -28], [0, 48], [0, -48], [62, 48], [-62, 48], [62, -48], [-62, -48], [0, 76], [0, -76], [70, 76], [-70, 76], [70, -76], [-70, -76]]
  projected.forEach(label => {
    if (!label.visible) return
    const w = Math.max(32, label.id.length * 7 + 14)
    const h = 26
    let best = { x: label.projectedX, y: label.projectedY + 23 }
    let leastOverlap = Infinity
    for (const [dx, dy] of offsets) {
      const x = Math.max(w / 2 + 3, Math.min(width - w / 2 - 3, label.projectedX + dx!))
      const y = Math.max(h / 2 + 3, Math.min(height - h / 2 - 3, label.projectedY + dy!))
      const overlap = occupied.reduce((sum, rect) => sum + (Math.abs(rect.x - x) < (rect.w + w) / 2 + 3 && Math.abs(rect.y - y) < (rect.h + h) / 2 + 3 ? 1 : 0), 0)
      if (overlap < leastOverlap) { best = { x, y }; leastOverlap = overlap }
      if (overlap === 0) break
    }
    label.x = best.x
    label.y = best.y
    occupied.push({ ...best, w, h })
  })
  // Placement priority becomes paint order only. DOM and Tab order stay sorted by
  // ID, so camera moves or a new selection never reorder (and unfocus) a label button.
  projected.forEach((label, index) => { label.layer = projected.length - index })
  labels.value = projected.sort((a, b) => a.id.localeCompare(b.id))
}

function renderScene() {
  pendingFrame = 0
  if (disposed || !renderer || !scene || !camera || rawContext?.isContextLost()) return
  try {
    updateAppearance()
    renderer.render(scene, camera)
    renderCount.value += 1
    projectLabels()
    cameraPosition.value = camera.position.toArray().map(value => value.toFixed(6)).join(',')
    cameraTarget.value = controls?.target.toArray().map(value => value.toFixed(6)).join(',') ?? ''
    cameraQuaternion.value = camera.quaternion.toArray().map(value => value.toFixed(6)).join(',')
    rendererStatus.value = 'ready'
  } catch {
    fail('error', '3D görünüm hazırlanamadı. 2D görünümden deneyine devam edebilirsin.')
  }
}

function makeEdge(connection: Connection) {
  if (!THREE || !scene) return
  const source = nodeMeshes.get(connection.source)
  const target = nodeMeshes.get(connection.target)
  if (!source || !target) return
  const gap = connection.kind === 'gap'
  const inhibitory = !gap && connection.weight < 0
  const color = gap ? '#90bde1' : inhibitory ? '#d69792' : '#b9cbc1'
  const group = new THREE.Group()
  let curve: ThreeTypes.Curve<ThreeTypes.Vector3>
  if (connection.source === connection.target) {
    const origin = source.position
    curve = new THREE.CubicBezierCurve3(
      origin.clone().add(new THREE.Vector3(0.22, 0.02, 0)),
      origin.clone().add(new THREE.Vector3(0.95, 1.0, 0.45)),
      origin.clone().add(new THREE.Vector3(-0.95, 1.0, 0.45)),
      origin.clone().add(new THREE.Vector3(-0.22, 0.02, 0)),
    )
  } else {
    const direction = target.position.clone().sub(source.position).normalize()
    const axis = Math.abs(direction.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const offset = direction.clone().cross(axis).normalize().multiplyScalar(gap ? 0 : 0.48)
    const midpoint = source.position.clone().add(target.position).multiplyScalar(0.5).add(offset)
    // Reversed chemical directions bend to opposite sides; gaps use a separate
    // straight dashed channel. Every source record remains its own edge.
    curve = new THREE.QuadraticBezierCurve3(source.position.clone(), midpoint, target.position.clone())
  }
  const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)))
  const material = gap
    ? trackMaterial(new THREE.LineDashedMaterial({ color, dashSize: 0.2, gapSize: 0.13, transparent: true, opacity: 0.7 }))
    : trackMaterial(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }))
  const line = new THREE.Line(geometry, material)
  if (gap) line.computeLineDistances()
  group.add(line)
  const edgeMaterials: ThreeTypes.Material[] = [material]
  let head: ThreeTypes.Mesh | undefined
  if (!gap) {
    const headMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }))
    const headGeometry = inhibitory
      ? trackGeometry(new THREE.CylinderGeometry(0.055, 0.055, 1, 8))
      : trackGeometry(new THREE.ConeGeometry(0.36, 1, 8))
    head = new THREE.Mesh(headGeometry, headMaterial)
    const t = connection.source === connection.target ? 0.72 : 0.78
    const tangent = curve.getTangent(t).normalize()
    const orientation = inhibitory
      ? tangent.clone().cross(Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
      : tangent
    head.position.copy(curve.getPoint(t))
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), orientation)
    group.add(head)
    edgeMaterials.push(headMaterial)
  }
  scene.add(group)
  edges.push({ connection, group, materials: edgeMaterials, head })
}

function buildCircuit(resetCamera = true) {
  if (!THREE || !scene || !camera) return
  const three = THREE
  releaseSceneResources()
  const positions = schematicPositions(props.circuit)
  const sphereGeometry = trackGeometry(new THREE.SphereGeometry(1, 20, 14))
  props.circuit.neurons.forEach(neuron => {
    const point = positions[neuron.id]
    if (!point) return
    const material = trackMaterial(new three.MeshStandardMaterial({ color: roleColor(neuron.role), roughness: 0.6, metalness: 0.05 }))
    const mesh = new three.Mesh(sphereGeometry, material)
    mesh.position.set(point.x, point.y, point.z)
    mesh.userData.neuronId = neuron.id
    mesh.userData.role = neuron.role
    nodeMeshes.set(neuron.id, mesh)
    scene!.add(mesh)
  })
  props.circuit.connections.forEach(makeEdge)
  halo = new THREE.Mesh(
    trackGeometry(new THREE.RingGeometry(0.9, 1, 32)),
    trackMaterial(new THREE.MeshBasicMaterial({ color: '#f8fae9', side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })),
  )
  halo.renderOrder = 2
  scene.add(halo)
  scene.add(new THREE.HemisphereLight('#f4faef', '#324f45', 1.35))
  const light = new THREE.DirectionalLight('#ffffff', 1.5)
  light.position.set(3, 6, 8)
  scene.add(light)
  fitRadius = Math.max(1, ...Array.from(nodeMeshes.values(), mesh => mesh.position.length())) + 1
  const grid = new THREE.GridHelper(fitRadius * 2.7, 12, '#779488', '#506f65')
  grid.position.y = -fitRadius + 0.1
  trackGeometry(grid.geometry)
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  gridMaterials.forEach(material => { material.transparent = true; material.opacity = 0.18; trackMaterial(material) })
  scene.add(grid)
  nodeCount.value = nodeMeshes.size
  if (resetCamera) fitCamera(true)
  requestRender()
}

function fitCamera(initialDirection = false) {
  if (!THREE || !camera || !controls) return
  const halfVertical = camera.fov * Math.PI / 360
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect)
  const distance = fitRadius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.05
  const direction = initialDirection
    ? new THREE.Vector3(0.65, 0.35, 1).normalize()
    : camera.position.clone().sub(controls.target).normalize()
  if (direction.lengthSq() === 0) direction.set(0.65, 0.35, 1).normalize()
  controls.target.set(0, 0, 0)
  camera.position.copy(direction.multiplyScalar(distance))
  controls.minDistance = fitRadius * 0.55
  controls.maxDistance = distance * 3
  camera.lookAt(controls.target)
  controls.update()
  requestRender()
}

function zoomCamera(factor: number) {
  if (!camera || !controls) return
  const offset = camera.position.clone().sub(controls.target)
  const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * factor))
  offset.setLength(distance)
  camera.position.copy(controls.target).add(offset)
  controls.update()
  requestRender()
}

function rotateCamera(yaw: number, pitch: number) {
  if (!THREE || !camera || !controls) return
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  spherical.theta += yaw
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + pitch, 0.12, Math.PI - 0.12)
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
  camera.lookAt(controls.target)
  controls.update()
  requestRender()
}

function canvasKey(event: KeyboardEvent) {
  const step = Math.PI / 14
  if (event.key === 'ArrowLeft') rotateCamera(-step, 0)
  else if (event.key === 'ArrowRight') rotateCamera(step, 0)
  else if (event.key === 'ArrowUp') rotateCamera(0, -step)
  else if (event.key === 'ArrowDown') rotateCamera(0, step)
  else if (event.key === '+' || event.key === '=') zoomCamera(1 / 1.2)
  else if (event.key === '-' || event.key === '−') zoomCamera(1.2)
  else if (event.key === 'Home') fitCamera(true)
  else return
  event.preventDefault()
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  activePointers.add(event.pointerId)
  if (activePointers.size > 1) {
    // A pinch is a camera gesture even if one finger stayed still.
    if (pointerStart) pointerStart.moved = true
  } else {
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false }
  }
  graphicsCanvas?.focus({ preventScroll: true })
}

function pointerMove(event: PointerEvent) {
  if (pointerStart?.id !== event.pointerId) return
  if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) pointerStart.moved = true
}

function pointerCancel(event: PointerEvent) { activePointers.delete(event.pointerId); pointerStart = undefined }

function pointerUp(event: PointerEvent) {
  activePointers.delete(event.pointerId)
  const start = pointerStart
  if (start?.id === event.pointerId) pointerStart = undefined
  if (!start || start.id !== event.pointerId || start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5 || !THREE || !camera || !raycaster || !graphicsCanvas) return
  const rect = graphicsCanvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
  const hit = raycaster.intersectObjects(Array.from(nodeMeshes.values()), false)[0]
  if (hit) emit('select', hit.object.userData.neuronId as string)
}

function resize() {
  if (!renderer || !camera || !viewport.value) return
  const width = Math.max(1, viewport.value.clientWidth)
  const height = Math.max(1, viewport.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  fitCamera()
  requestRender()
}

onMounted(async () => {
  if (!canvas.value || !viewport.value) return
  graphicsCanvas = canvas.value
  try {
    rawContext = graphicsCanvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'low-power' }) ?? undefined
    if (!rawContext) {
      fail('unavailable', 'Bu tarayıcıda 3D görünüm kullanılamıyor. 2D görünümden deneyine devam edebilirsin.')
      return
    }
    graphicsCanvas.addEventListener('webglcontextlost', contextLost)
    const [three, orbit] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')])
    if (disposed || rendererStatus.value !== 'loading') return
    if (!rawContext || rawContext.isContextLost() || !graphicsCanvas) {
      fail('context-lost', '3D görünüm kesildi. 2D görünümden deneyine devam edebilirsin.')
      return
    }
    THREE = three
    renderer = new THREE.WebGLRenderer({ canvas: graphicsCanvas, context: rawContext, antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setClearColor('#192d2b', 0)
    createdEventSent = true
    window.dispatchEvent(new CustomEvent('circuitiary:3d-created', { detail: { instanceId } }))
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(48, viewport.value.clientWidth / viewport.value.clientHeight, 0.05, 1000)
    camera.position.set(8, 5, 13)
    controls = new orbit.OrbitControls(camera, graphicsCanvas)
    controls.enableDamping = false
    controls.autoRotate = false
    controls.enablePan = true
    controls.zoomSpeed = 0.85
    controls.rotateSpeed = 0.65
    controls.addEventListener('change', requestRender)
    raycaster = new THREE.Raycaster()
    graphicsCanvas.addEventListener('pointerdown', pointerDown)
    graphicsCanvas.addEventListener('pointermove', pointerMove)
    graphicsCanvas.addEventListener('pointerup', pointerUp)
    graphicsCanvas.addEventListener('pointercancel', pointerCancel)
    graphicsCanvas.addEventListener('keydown', canvasKey)
    document.addEventListener('visibilitychange', visibilityChanged)
    runtimeListenersActive = true
    buildCircuit()
    resize()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(viewport.value)
  } catch {
    fail('error', '3D görünüm hazırlanamadı. 2D görünümden deneyine devam edebilirsin.')
  }
})

watch(() => [props.activity, props.selectedNode, props.silencedConnectionId, props.focusConnections], requestRender, { deep: true })
watch(topologySignature, () => buildCircuit())
onBeforeUnmount(() => { disposed = true; releaseGraphics(); THREE = undefined })
</script>

<template>
  <section class="circuit-3d" :data-renderer-status="rendererStatus" :data-renderer-instance="instanceId" :data-node-count="nodeCount" :data-visible-edge-count="visibleEdgeCount" :data-render-count="renderCount" :data-camera-position="cameraPosition" :data-camera-target="cameraTarget" :data-camera-quaternion="cameraQuaternion">
    <p class="schematic-note">Şematik 3D; anatomik konum/morfoloji değildir.</p>
    <div v-if="rendererStatus === 'loading' || rendererStatus === 'ready'" class="camera-tools" aria-label="3D kamera denetimleri">
      <button type="button" :disabled="rendererStatus !== 'ready'" @click="fitCamera(true)">Devreyi sığdır</button>
      <div class="camera-tool-group">
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü uzaklaştır" @click="zoomCamera(1.2)">−</button>
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü yakınlaştır" @click="zoomCamera(1 / 1.2)">+</button>
      </div>
      <div class="camera-tool-group">
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü sola döndür" @click="rotateCamera(-Math.PI / 14, 0)">←</button>
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü sağa döndür" @click="rotateCamera(Math.PI / 14, 0)">→</button>
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü yukarı döndür" @click="rotateCamera(0, -Math.PI / 14)">↑</button>
        <button type="button" :disabled="rendererStatus !== 'ready'" aria-label="3D görünümü aşağı döndür" @click="rotateCamera(0, Math.PI / 14)">↓</button>
      </div>
    </div>
    <div v-if="rendererStatus === 'loading' || rendererStatus === 'ready'" ref="viewport" class="viewport-3d">
      <canvas ref="canvas" class="circuit-3d-canvas" tabindex="0" role="img" aria-label="Şematik üç boyutlu devre. Döndürmek için sürükle; yakınlaştırmak için tekerlek veya iki parmak kullan. Klavyede ok tuşları döndürür, artı ve eksi yakınlaştırır, Home devreyi sığdırır."></canvas>
      <svg class="label-guides-3d" aria-hidden="true">
        <line v-for="label in labels.filter(item => item.visible)" :key="label.id" :x1="label.projectedX" :y1="label.projectedY" :x2="label.x" :y2="label.y" />
      </svg>
      <div class="node-labels-3d">
        <button v-for="label in labels" v-show="label.visible" :key="label.id" type="button" class="node-label-3d" :class="{ selected: label.id === selectedNode }" :style="{ left: `${label.x}px`, top: `${label.y}px`, zIndex: label.layer }" :data-node-id="label.id" :data-activity="activityFor(label.id)" :data-projected-x="label.projectedX" :data-projected-y="label.projectedY" :data-visible="label.visible" :aria-pressed="label.id === selectedNode" :aria-label="`${label.id} hücresini seç; etkinlik ${decimal(activityFor(label.id), 3)}`" @click="emit('select', label.id)">{{ label.id }}</button>
      </div>
      <p v-if="rendererStatus === 'loading'" class="loading-3d" role="status">3D devre hazırlanıyor…</p>
    </div>
    <div v-else class="fallback-3d" role="status">
      <p>{{ failureMessage }}</p>
      <button type="button" @click="emit('request2d')">2D görünümüne dön</button>
    </div>
    <p v-if="rendererStatus === 'ready'" class="instructions-3d">Sürükle: döndür · İki parmak / tekerlek: yakınlaştır · Hücreye veya etiketine tıkla: seç. Parlaklık hesaplanan boyutsuz etkinliği gösterir.</p>
  </section>
</template>

<style scoped>
.circuit-3d { position: relative; z-index: 1; }
.schematic-note { color: #ced8c6; font-size: 10px; line-height: 1.7; margin-top: 17px; }
.camera-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 13px; }
.camera-tool-group { display: flex; gap: 5px; }
.camera-tools button, .fallback-3d button { background: #3a5145; color: #f2f4e8; border: 1px solid #6d8876; border-radius: 4px; font-size: 11px; min-height: 38px; padding: 8px 12px; }
.camera-tool-group button { width: 38px; font-size: 17px; padding: 5px; }
.camera-tools button:disabled { opacity: .5; cursor: default; }
.viewport-3d { position: relative; width: 100%; height: 500px; margin-top: 7px; }
.circuit-3d-canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.label-guides-3d, .node-labels-3d { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.label-guides-3d line { stroke: #c6d6c7; stroke-width: 1; opacity: .23; }
.node-label-3d { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; background: #192d2bed; color: #f2f4e8; border: 1px solid #718878; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 11px; font-weight: 500; line-height: 1; min-height: 25px; min-width: 30px; padding: 6px; white-space: nowrap; }
.node-label-3d.selected { color: #ffffff; border-color: #f4f6df; background: #3a5145; }
.loading-3d { position: absolute; inset: 0; display: grid; place-content: center; color: #d5dfce; font-size: 13px; pointer-events: none; }
.instructions-3d { color: #b5c7b8; font-size: 10px; line-height: 1.8; margin-top: 12px; }
.fallback-3d { padding: 40px 20px; min-height: 230px; display: grid; align-content: center; justify-items: start; gap: 18px; color: #d4dfce; font-size: 13px; line-height: 1.8; }
@media (max-width: 760px) { .viewport-3d { height: 540px; } .camera-tools { gap: 7px; } }
</style>
