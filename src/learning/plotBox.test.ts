import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, h, ref, type Ref } from 'vue'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth, type ChartWidthOptions, type PlotPad } from './plotBox'

const pad: PlotPad = { top: 23, right: 18, bottom: 44, left: 58 }

describe('plot scales', () => {
  it('maps the time axis between the left and right padding', () => {
    expect(plotX(0, 300, 600, pad)).toBe(58)
    expect(plotX(300, 300, 600, pad)).toBe(582)
    expect(plotX(150, 300, 600, pad)).toBe(320)
  })

  it('treats a zero time range as 1 so a flat axis never produces NaN', () => {
    expect(plotX(0, 0, 600, pad)).toBe(58)
    expect(plotX(0.5, 0, 600, pad)).toBe(58 + 0.5 * 524)
    expect(Number.isFinite(plotX(1, 0, 600, pad))).toBe(true)
  })

  it('maps zero to the bottom of the plot and yMax to the top, for any shared yMax', () => {
    expect(plotY(0, 1, 250, pad)).toBe(206)
    expect(plotY(1, 1, 250, pad)).toBe(23)
    expect(plotY(0.5, 1, 250, pad)).toBe(114.5)
    expect(plotY(0.05, 0.1, 250, pad)).toBe(114.5)
    expect(plotY(0.1, 0.1, 250, pad)).toBe(23)
  })

  it('offers the five shared grid fractions', () => {
    expect(TICK_FRACTIONS).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})

describe('trace path', () => {
  const x = (time: number) => 10 + time * 2
  const y = (value: number) => 100 - value * 50

  it('starts with M, continues with L and writes two decimals', () => {
    expect(tracePath([0, 0.5, 1], [0, 1, 2], x, y)).toBe('M10.00,100.00 L12.00,75.00 L14.00,50.00')
    expect(tracePath([1 / 3], [1 / 3], x, y)).toBe('M10.67,83.33')
  })

  it('draws a sample without a time stamp at time 0 and an empty trace as an empty path', () => {
    expect(tracePath([0.2, 0.4], [3], x, y)).toBe('M16.00,90.00 L10.00,80.00')
    expect(tracePath([], [], x, y)).toBe('')
  })
})

describe('stimulus band', () => {
  const x = (time: number) => 50 + time * 4

  it('spans the stimulus on the time axis', () => {
    expect(bandWidth(x, 10, 20, 100)).toBe(80)
  })

  it('ends at the last sampled time', () => {
    expect(bandWidth(x, 90, 50, 100)).toBe(40)
  })

  it('is never negative when the stimulus starts after the last sample', () => {
    expect(bandWidth(x, 120, 20, 100)).toBe(0)
  })
})

interface FakeElement { clientWidth: number; boxWidth: number; getBoundingClientRect: () => { width: number }; parent?: FakeElement }
class FakeObserver {
  static instances: FakeObserver[] = []
  observed: unknown[] = []
  disconnected = false
  constructor(readonly callback: () => void) { FakeObserver.instances.push(this) }
  observe(target: unknown) { this.observed.push(target) }
  disconnect() { this.disconnected = true }
}

// A DOM-free renderer: refs receive these plain objects, which is all the width composable needs.
let sizes = { clientWidth: 0, boxWidth: 0 }
const fakeElements: FakeElement[] = []
const createFake = (): FakeElement => {
  const element: FakeElement = { ...sizes, getBoundingClientRect: () => ({ width: element.boxWidth }) }
  fakeElements.push(element)
  return element
}
const renderer = createRenderer<FakeElement, FakeElement>({
  patchProp: () => undefined,
  insert: (child, parent) => { child.parent = parent },
  remove: child => { child.parent = undefined },
  createElement: createFake,
  createText: createFake,
  createComment: createFake,
  setText: () => undefined,
  setElementText: () => undefined,
  parentNode: node => node.parent ?? null,
  nextSibling: () => null,
})

function mountChart(options: ChartWidthOptions, measured: Partial<typeof sizes> = {}, bound = true) {
  sizes = { clientWidth: 0, boxWidth: 0, ...measured }
  let width!: Ref<number>
  let widthBeforeMount = NaN
  const Chart = defineComponent({
    setup() {
      const element = ref<Element | null>(null)
      width = useChartWidth(element, options)
      widthBeforeMount = width.value
      return () => h('svg', bound ? { ref: element } : {})
    },
  })
  const app = renderer.createApp(Chart)
  app.mount(createFake())
  return { app, width, widthBeforeMount }
}

function installObserver() {
  vi.stubGlobal('ResizeObserver', FakeObserver)
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeObserver.instances = []
  fakeElements.length = 0
})

describe('useChartWidth', () => {
  it('starts from the initial width and then measures the rendered element, rounded', () => {
    installObserver()
    const { width, widthBeforeMount } = mountChart({ initial: 600 }, { clientWidth: 412.6 })
    expect(widthBeforeMount).toBe(600)
    expect(width.value).toBe(413)
  })

  it('never goes narrower than the minimum (280 by default)', () => {
    installObserver()
    expect(mountChart({ initial: 600 }, { clientWidth: 120 }).width.value).toBe(280)
    expect(mountChart({ initial: 600, min: 300 }, { clientWidth: 290 }).width.value).toBe(300)
  })

  it('can read the transformed box instead of clientWidth', () => {
    installObserver()
    const { width } = mountChart({ initial: 720, min: 300, read: element => element.getBoundingClientRect().width }, { clientWidth: 900, boxWidth: 512.4 })
    expect(width.value).toBe(512)
  })

  it('observes the element and follows every resize', () => {
    installObserver()
    const { width } = mountChart({ initial: 600 }, { clientWidth: 500 })
    expect(FakeObserver.instances).toHaveLength(1)
    const [observer] = FakeObserver.instances
    expect(observer.observed).toHaveLength(1)
    const svg = observer.observed[0] as FakeElement
    svg.clientWidth = 640
    observer.callback()
    expect(width.value).toBe(640)
    svg.clientWidth = 100
    observer.callback()
    expect(width.value).toBe(280)
  })

  it('stops observing when the chart is unmounted', () => {
    installObserver()
    const { app } = mountChart({ initial: 600 }, { clientWidth: 500 })
    expect(FakeObserver.instances[0].disconnected).toBe(false)
    app.unmount()
    expect(FakeObserver.instances[0].disconnected).toBe(true)
  })

  it('still measures once where ResizeObserver does not exist', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { width, app } = mountChart({ initial: 600 }, { clientWidth: 450 })
    expect(width.value).toBe(450)
    expect(() => app.unmount()).not.toThrow()
  })

  it('keeps the initial width and observes nothing while the element is not bound', () => {
    installObserver()
    const { width } = mountChart({ initial: 600 }, { clientWidth: 450 }, false)
    expect(width.value).toBe(600)
    expect(FakeObserver.instances).toHaveLength(0)
  })
})
