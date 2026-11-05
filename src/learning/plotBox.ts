import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** Space between the SVG edge and the plot area, in viewBox units. */
export interface PlotPad { top: number; right: number; bottom: number; left: number }

/** Grid lines and tick labels sit at these fractions of the shared axis range. */
export const TICK_FRACTIONS: readonly number[] = [0, .25, .5, .75, 1]

/** Time axis: 0 at the left padding, maxTime at the right padding. A zero range falls back to 1 so a flat time axis never divides by zero. */
export const plotX = (time: number, maxTime: number, width: number, pad: PlotPad): number =>
  pad.left + time / (maxTime || 1) * (width - pad.left - pad.right)

/** Value axis: 0 on the bottom edge of the plot, yMax on the top edge. Every trace of a figure shares one yMax. */
export const plotY = (value: number, yMax: number, height: number, pad: PlotPad): number =>
  pad.top + (1 - value / yMax) * (height - pad.top - pad.bottom)

/** SVG path of one trace; a sample without a time stamp is drawn at time 0. */
export const tracePath = (values: readonly number[], times: readonly number[], x: (time: number) => number, y: (value: number) => number): string =>
  values.map((value, index) => `${index ? 'L' : 'M'}${x(times[index] ?? 0).toFixed(2)},${y(value).toFixed(2)}`).join(' ')

/** Width of the stimulus band: it ends at the last sampled time and is never negative. */
export const bandWidth = (x: (time: number) => number, onsetMs: number, durationMs: number, maxTime: number): number =>
  Math.max(0, x(Math.min(maxTime, onsetMs + durationMs)) - x(onsetMs))

export interface ChartWidthOptions {
  /** Width used before the element is measured. */
  initial: number
  /** Narrowest viewBox width, so a collapsed container never squeezes the plot. */
  min?: number
  /** How the element's width is read; clientWidth unless the chart needs the transformed box. */
  read?: (element: Element) => number
}

/** viewBox width that follows the rendered width of the bound element, measured on mount and on every resize. */
export function useChartWidth(element: Readonly<Ref<Element | null | undefined>>, { initial, min = 280, read = target => target.clientWidth }: ChartWidthOptions): Ref<number> {
  const width = ref(initial)
  let observer: ResizeObserver | undefined
  const measure = () => { if (element.value) width.value = Math.max(min, Math.round(read(element.value))) }
  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && element.value) {
      observer = new ResizeObserver(measure)
      observer.observe(element.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())
  return width
}
