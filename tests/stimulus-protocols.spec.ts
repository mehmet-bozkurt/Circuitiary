import { expect, test, type Page } from '@playwright/test'
import { NOISE_HOLD_MS, stimulusDefaults, stimulusRanges } from '../src/stimulusProtocol'
import { exportRecord } from './support/export'
import { expectNoHorizontalOverflow } from './support/ui'

/**
 * Stimulus protocols on the main experiment page: the shape of the input (pulse, ramp, sine) and an
 * optional reproducible pseudo-random addition (src/stimulusProtocol.ts, stimulusValue in
 * src/model/simulation.ts). The default state must be the page as it was before protocols existed.
 */
const conditions = ['baseline', 'silenced', 'tau'] as const
const chart = (page: Page) => page.locator('.activation-chart')
const curves = (page: Page) => page.locator('.activation-chart path')
const paths = (page: Page) => curves(page).evaluateAll(all => all.map(path => path.getAttribute('d')))
const waveform = (page: Page) => page.locator('.activation-chart polyline')
const waveformPoints = (page: Page) => waveform(page).getAttribute('points')
const shape = (page: Page) => page.locator('#stimulus-shape')
const period = (page: Page) => page.locator('#sine-period')
const noise = (page: Page) => page.locator('#noise-amplitude')
const resample = (page: Page) => page.getByTestId('noise-resample')
const seed = (page: Page) => page.getByTestId('noise-seed')
const shareUrl = (page: Page) => page.getByTestId('share-url').inputValue()
const peaks = (page: Page) => Promise.all(conditions.map(id => page.getByTestId(`peak-${id}`).innerText()))
const convergence = async (page: Page) => Number((await page.getByTestId('convergence-error').innerText()).replace(',', '.'))
const DEFAULT_LABEL = 'Üç koşulun boyutsuz etkinlik değerlerini zamana göre karşılaştıran grafik. Ortak dikey eksen 0–1,00.'
const INPUT_NOTE = 'Uyarılan hücreye verilen girdi I(t) de aynı eksende ince çizgiyle çizilir.'
const DEFAULT_LINK_QUERY = '?m=illustrative&v=2d&c=baseline&st=S1&am=0.8&du=200&tb=30&tn=O1&tc=90&se=I3-O1&o=O1&n=S1&dt=1&sc=0'

/** The y values of the drawn input, in viewBox units (smaller is higher on the chart). */
const waveformYs = async (page: Page) => (await waveformPoints(page))!.split(' ').map(point => Number(point.split(',')[1]))

// Wraps simulate() in the module the dev server serves, as tests/app-shell.spec.ts does, to count full simulations.
async function countSimulations(page: Page) {
  await page.route(/\/src\/model\/simulation\.ts(\?|$)/, async route => {
    const response = await route.fetch()
    const body = (await response.text()).replace(/export function simulate\(/,
      'export function simulate() { globalThis.__simulations = (globalThis.__simulations ?? 0) + 1; return countedSimulate.apply(undefined, arguments) }\nfunction countedSimulate(')
    await route.fulfill({ response, body })
  })
}
const simulations = (page: Page) => page.evaluate(() => (globalThis as unknown as { __simulations?: number }).__simulations ?? 0)
async function runsOf(page: Page, change: () => Promise<unknown>) {
  const before = await simulations(page)
  await change()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  return await simulations(page) - before
}

test.describe('default state', () => {
  test('is the page as it was: three curves, no input line, the same peak, the same link and the same record', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
    // The three peaks and the dt/2 difference of the default experiment, as the engine gave them before protocols existed.
    expect(await peaks(page)).toEqual(['0,663', '0,000', '0,543'])
    await expect(curves(page)).toHaveCount(3)
    await expect(waveform(page)).toHaveCount(0)
    await expect(page.getByTestId('input-waveform')).toHaveCount(0)
    await expect(page.getByTestId('input-key')).toHaveCount(0)
    await expect(page.getByTestId('input-formula')).toHaveCount(0)
    expect(await chart(page).getAttribute('aria-label')).toBe(DEFAULT_LABEL)
    await expect(page.locator('.trace-key > span')).toHaveText(['Referans', 'Bağlantı susturuldu', 'Zaman sabiti değişti'])

    await expect(shape(page)).toHaveValue(stimulusDefaults.stimulusShape)
    await expect(shape(page).locator('option')).toHaveText(['Darbe', 'Rampa', 'Sinüs'])
    await expect(period(page)).toHaveCount(0)
    await expect(noise(page)).toHaveValue('0')
    await expect(resample(page)).toHaveCount(0)
    await expect(seed(page)).toHaveCount(0)

    expect(new URL(await shareUrl(page)).search).toBe(DEFAULT_LINK_QUERY)
    await expect(page.getByTestId('convergence-error')).toHaveText('0,00250')

    const record = await exportRecord<{ model: Record<string, unknown>; results: Record<string, { settings: { stimulus: Record<string, unknown> } }> }>(page, 'circuitiary-experiment.json')
    expect(record.model.stimulusWindow).toBe('[onsetMs, onsetMs + durationMs)')
    expect(record.model.noise).toBe(false)
    expect(Object.keys(record.model)).toEqual(['equation', 'method', 'activityUnit', 'initialState', 'stimulusWindow', 'noise', 'biologicalDataset'])
    for (const id of conditions) expect(record.results[id]!.settings.stimulus).toEqual({ target: 'S1', onsetMs: 100, durationMs: 200, amplitude: 0.8 })
  })

  test('the field note says what the protocol is and is not', async ({ page }) => {
    await page.goto('/')
    const note = page.getByTestId('protocol-note')
    await expect(note).toContainText('senin seçtiğin öğretim girdileridir')
    await expect(note).toContainText('sözde rastgele bir sayı dizisidir; biyolojik gürültünün modeli değildir')
    await expect(note).toContainText('Buradaki hiçbir girdi ölçülmüş bir uyaran değildir.')
  })
})

test.describe('shapes', () => {
  test('each shape changes the curves and draws the input; the pulse brings the default page back', async ({ page }) => {
    await page.goto('/')
    const pulsePaths = await paths(page)
    const pulsePeaks = await peaks(page)

    await shape(page).selectOption('ramp')
    await expect(waveform(page)).toHaveCount(1)
    await expect(curves(page)).toHaveCount(3)
    const rampPaths = await paths(page)
    // A and C change. B silences I3 → O1 by default, the only drive O1 has, so its O1 curve is flat zero for every input.
    for (const index of [0, 2]) expect(rampPaths[index]).not.toBe(pulsePaths[index])
    expect(rampPaths[1]).toBe(pulsePaths[1])
    const rampPeaks = await peaks(page)
    expect(rampPeaks).not.toEqual(pulsePeaks)
    await expect(page.getByTestId('input-key')).toHaveText('Girdi I(t) · ince çizgi')
    expect(await chart(page).getAttribute('aria-label')).toBe(`${DEFAULT_LABEL} ${INPUT_NOTE}`)
    await expect(page.getByTestId('input-formula')).toContainText('I(t) = A · (t − t₀) / T')
    await expect(page.getByTestId('input-formula')).toContainText('T uyaran süresi')
    // The ramp starts on the zero line and climbs towards the amplitude (0,80 of a 0–1 axis).
    const rampYs = await waveformYs(page)
    const zeroLine = Math.max(...rampYs)
    const plotHeight = 240 - 23 - 38
    expect(zeroLine).toBeCloseTo(240 - 38, 1)
    expect(zeroLine - Math.min(...rampYs)).toBeGreaterThan(0.79 * plotHeight)
    expect(zeroLine - Math.min(...rampYs)).toBeLessThan(0.8 * plotHeight + 0.01)

    await shape(page).selectOption('sine')
    await expect(waveform(page)).toHaveCount(1)
    const sinePaths = await paths(page)
    for (const index of [0, 2]) {
      expect(sinePaths[index]).not.toBe(pulsePaths[index])
      expect(sinePaths[index]).not.toBe(rampPaths[index])
    }
    expect(await peaks(page)).not.toEqual(rampPeaks)
    // With another silenced connection the B curve follows the input too.
    await page.locator('#silenced-edge').selectOption('I4-O1')
    const silencedSine = (await paths(page))[1]
    await shape(page).selectOption('ramp')
    expect((await paths(page))[1]).not.toBe(silencedSine)
    await shape(page).selectOption('sine')
    await page.locator('#silenced-edge').selectOption('I3-O1')
    expect(await paths(page)).toEqual(sinePaths)
    await expect(page.getByTestId('input-formula')).toContainText('I(t) = A · (1 − cos(2π(t − t₀) / P)) / 2')
    // The raised cosine reaches the amplitude exactly and returns to zero: two periods of 100 ms in the 200 ms window.
    const sineYs = await waveformYs(page)
    expect(zeroLine - Math.min(...sineYs)).toBeCloseTo(0.8 * plotHeight, 1)
    expect(sineYs.filter((y, index) => index > 0 && index < sineYs.length - 1 && y < sineYs[index - 1]! && y < sineYs[index + 1]!)).toHaveLength(2)

    await shape(page).selectOption('pulse')
    await expect(waveform(page)).toHaveCount(0)
    await expect(page.getByTestId('input-key')).toHaveCount(0)
    expect(await paths(page)).toEqual(pulsePaths)
    expect(await peaks(page)).toEqual(pulsePeaks)
    expect(await chart(page).getAttribute('aria-label')).toBe(DEFAULT_LABEL)
  })

  test('the period control is there only for the sine, and changes the curves', async ({ page }) => {
    await page.goto('/')
    await expect(period(page)).toHaveCount(0)
    await shape(page).selectOption('ramp')
    await expect(period(page)).toHaveCount(0)
    await shape(page).selectOption('sine')
    await expect(period(page)).toBeVisible()
    await expect(period(page)).toHaveValue(String(stimulusDefaults.sinePeriod))
    await expect(page.locator('label[for="sine-period"]')).toHaveText('Sinüs periyodu 100 ms')
    const before = await paths(page)
    const pointsBefore = await waveformPoints(page)
    await period(page).fill('200')
    await expect(page.locator('label[for="sine-period"]')).toHaveText('Sinüs periyodu 200 ms')
    expect((await paths(page))[0]).not.toBe(before[0])
    expect(await waveformPoints(page)).not.toBe(pointsBefore)
    expect(new URL(await shareUrl(page)).searchParams.get('sp')).toBe('200')
    // The period is kept while another shape is chosen, and is no longer part of what is computed.
    await shape(page).selectOption('pulse')
    await expect(period(page)).toHaveCount(0)
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
    await shape(page).selectOption('sine')
    await expect(period(page)).toHaveValue('200')
  })
})

test.describe('input noise', () => {
  test('is off by default, shows its seed when on, and a new sample changes the curves', async ({ page }) => {
    await page.goto('/')
    const quiet = await paths(page)
    await noise(page).fill('0.2')
    await expect(page.locator('label[for="noise-amplitude"]')).toHaveText('Girdi gürültüsü 0,20')
    await expect(noise(page)).toHaveAttribute('aria-valuetext', '0,20')
    await expect(resample(page)).toBeVisible()
    await expect(resample(page)).toHaveText('Yeni gürültü örneği çek')
    await expect(seed(page)).toHaveText('Tohum 1')
    await expect(waveform(page)).toHaveCount(1)
    await expect(curves(page)).toHaveCount(3)
    await expect(page.getByTestId('input-formula')).toContainText('I(t) = A + g · u(s, ⌊(t − t₀) / h⌋)')
    await expect(page.getByTestId('input-formula')).toContainText(`h = ${NOISE_HOLD_MS} ms`)
    await expect(page.getByTestId('input-formula')).toContainText('biyolojik gürültünün modeli değildir')
    const first = await paths(page)
    const firstInput = await waveformPoints(page)
    expect(first[0]).not.toBe(quiet[0])

    await resample(page).click()
    await expect(seed(page)).toHaveText('Tohum 2')
    const second = await paths(page)
    expect(second[0]).not.toBe(first[0])
    expect(await waveformPoints(page)).not.toBe(firstInput)
    expect(new URL(await shareUrl(page)).searchParams.get('ns')).toBe('2')
    // The button keeps the focus, so it can be pressed again from the keyboard.
    await expect(resample(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(seed(page)).toHaveText('Tohum 3')

    // Off again: the default curves, and nothing of the noise is drawn.
    await noise(page).fill('0')
    await expect(resample(page)).toHaveCount(0)
    await expect(waveform(page)).toHaveCount(0)
    expect(await paths(page)).toEqual(quiet)
  })

  test('is reproducible: the same share link gives the same curves after a reload and in a new page', async ({ page }) => {
    await page.goto('/')
    await shape(page).selectOption('sine')
    await noise(page).fill('0.25')
    await resample(page).click()
    await resample(page).click()
    await expect(seed(page)).toHaveText('Tohum 3')
    const link = await shareUrl(page)
    const expected = { paths: await paths(page), input: await waveformPoints(page), peaks: await peaks(page), convergence: await page.getByTestId('convergence-error').innerText() }

    await page.goto(link)
    await expect(page.getByTestId('share-notice')).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(seed(page)).toHaveText('Tohum 3')
    const read = async (target: Page) => ({ paths: await paths(target), input: await waveformPoints(target), peaks: await peaks(target), convergence: await target.getByTestId('convergence-error').innerText() })
    expect(await read(page)).toEqual(expected)
    await page.reload()
    await expect(seed(page)).toHaveText('Tohum 3')
    expect(await read(page)).toEqual(expected)

    const fresh = await page.context().newPage()
    try {
      await fresh.goto(link)
      await expect(fresh.getByTestId('noise-seed')).toHaveText('Tohum 3')
      expect(await read(fresh)).toEqual(expected)
      // Another seed in the same link is another experiment.
      await fresh.goto(link.replace('ns=3', 'ns=4'))
      await expect(fresh.getByTestId('noise-seed')).toHaveText('Tohum 4')
      expect((await read(fresh)).paths[0]).not.toBe(expected.paths[0])
    } finally { await fresh.close() }
  })

  test('does not depend on the time step: the dt/2 difference stays small and shrinks with the step', async ({ page }) => {
    await page.goto('/')
    const quiet = await convergence(page)
    await shape(page).selectOption('sine')
    await noise(page).fill(String(stimulusRanges.noiseAmplitude.max))
    await expect(seed(page)).toBeVisible()
    const errors: number[] = []
    for (const dt of ['2', '1', '0.5', '0.25']) {
      await page.locator('#dt').selectOption(dt)
      const error = await convergence(page)
      errors.push(error)
      expect(error, `dt ${dt}`).toBeLessThan(0.01)
      await expect(page.getByTestId('numerical-warning'), `dt ${dt}`).toHaveCount(0)
    }
    // A first-order method on a step-independent input: halving the step roughly halves the difference.
    for (let index = 1; index < errors.length; index += 1) {
      expect(errors[index]!).toBeLessThan(errors[index - 1]! * 0.65)
      expect(errors[index]!).toBeGreaterThan(errors[index - 1]! * 0.35)
    }
    // At the default step the difference is of the size it has without noise.
    expect(errors[1]!).toBeLessThan(quiet * 2)
  })
})

test('every new control feeds the three conditions and the numerical check, and nothing else', async ({ page }) => {
  await countSimulations(page)
  await page.goto('/')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  expect(await simulations(page)).toBe(4)
  expect(await runsOf(page, () => shape(page).selectOption('sine'))).toBe(4)
  expect(await runsOf(page, () => period(page).fill('150'))).toBe(4)
  expect(await runsOf(page, () => noise(page).fill('0.1'))).toBe(4)
  expect(await runsOf(page, () => resample(page).click())).toBe(4)
  // The input line is drawn from the settings, not from another run; viewing choices still cost nothing.
  expect(await runsOf(page, () => page.getByRole('button', { name: 'B Bağlantı susturuldu', exact: true }).click())).toBe(0)
  expect(await runsOf(page, () => page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check())).toBe(0)
  // A control of one condition still costs one run with a protocol on.
  expect(await runsOf(page, () => page.locator('#changed-tau').fill('150'))).toBe(1)
})

test('reset returns the protocol to its defaults and the page to the default curves', async ({ page }) => {
  await page.goto('/')
  const defaults = { paths: await paths(page), peaks: await peaks(page), link: await shareUrl(page) }
  await shape(page).selectOption('sine')
  await period(page).fill('250')
  await noise(page).fill('0.3')
  await resample(page).click()
  await expect(seed(page)).toHaveText('Tohum 2')
  expect(await shareUrl(page)).not.toBe(defaults.link)

  await page.getByRole('button', { name: /^Sıfırla/ }).click()
  await expect(shape(page)).toHaveValue('pulse')
  await expect(period(page)).toHaveCount(0)
  await expect(noise(page)).toHaveValue('0')
  await expect(resample(page)).toHaveCount(0)
  await expect(waveform(page)).toHaveCount(0)
  expect(await paths(page)).toEqual(defaults.paths)
  expect(await peaks(page)).toEqual(defaults.peaks)
  expect(await shareUrl(page)).toBe(defaults.link)
  // The period and the seed went back as well, not only the two visible controls.
  await shape(page).selectOption('sine')
  await expect(period(page)).toHaveValue('100')
  await noise(page).fill('0.05')
  await expect(seed(page)).toHaveText('Tohum 1')
})

test.describe('share link', () => {
  test('carries the protocol with short keys, only where it differs from the default, and round-trips it', async ({ page }) => {
    await page.goto('/')
    await shape(page).selectOption('ramp')
    expect(new URL(await shareUrl(page)).search).toBe(DEFAULT_LINK_QUERY.replace('&du=200', '&du=200&sh=ramp'))
    await shape(page).selectOption('sine')
    await period(page).fill('150')
    await noise(page).fill('0.15')
    await resample(page).click()
    await page.locator('#amplitude').fill('0.6')
    const link = await shareUrl(page)
    expect(new URL(link).search).toBe(DEFAULT_LINK_QUERY.replace('am=0.8&du=200', 'am=0.6&du=200&sh=sine&sp=150&na=0.15&ns=2'))
    const expected = { paths: await paths(page), peaks: await peaks(page), input: await waveformPoints(page) }

    await page.goto(link)
    await expect(page.getByTestId('share-notice')).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(shape(page)).toHaveValue('sine')
    await expect(period(page)).toHaveValue('150')
    await expect(noise(page)).toHaveValue('0.15')
    await expect(seed(page)).toHaveText('Tohum 2')
    expect({ paths: await paths(page), peaks: await peaks(page), input: await waveformPoints(page) }).toEqual(expected)
    // The opened page writes the same link again.
    expect(await shareUrl(page)).toBe(link)
  })

  test('an old link without the keys opens with the default protocol and no ignored part', async ({ page }) => {
    await page.goto(`/${DEFAULT_LINK_QUERY.replace('am=0.8', 'am=0.5')}`)
    await expect(page.getByTestId('share-notice')).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(shape(page)).toHaveValue('pulse')
    await expect(noise(page)).toHaveValue('0')
    await expect(waveform(page)).toHaveCount(0)
    await expect(curves(page)).toHaveCount(3)
    expect(new URL(await shareUrl(page)).search).toBe(DEFAULT_LINK_QUERY.replace('am=0.8', 'am=0.5'))
  })

  test('invalid protocol values are reported by name and the defaults are kept', async ({ page }) => {
    await page.goto('/?sh=square&sp=45&na=0.31&ns=0&am=0.5')
    await expect(page.getByTestId('share-notice')).toHaveText('Bağlantıdaki ayarlar uygulandı. Geçersiz olduğu için yok sayılan parçalar: Uyaran biçimi, Sinüs periyodu, Girdi gürültüsü, Gürültü tohumu.')
    await expect(shape(page)).toHaveValue('pulse')
    await expect(noise(page)).toHaveValue('0')
    await expect(page.locator('#amplitude')).toHaveValue('0.5')
    await expect(waveform(page)).toHaveCount(0)
  })
})

test('the experiment record describes the shape and the pseudo-random addition that were used', async ({ page }) => {
  await page.goto('/')
  await shape(page).selectOption('sine')
  await period(page).fill('200')
  await noise(page).fill('0.1')
  await resample(page).click()
  const record = await exportRecord<{ model: { stimulusWindow: string; noise: Record<string, unknown> }; results: Record<string, { settings: { stimulus: Record<string, unknown> } }> }>(page, 'circuitiary-experiment.json')
  expect(record.model.stimulusWindow).toContain('[onsetMs, onsetMs + durationMs)')
  expect(record.model.stimulusWindow).toContain('I(t) = amplitude * (1 - cos(2 * pi * (t - onsetMs) / periodMs)) / 2 (sine)')
  expect(record.model.noise).toMatchObject({ amplitude: 0.1, seed: 2, holdMs: NOISE_HOLD_MS })
  expect(String(record.model.noise.kind)).toContain('not a model of biological noise')
  for (const id of conditions) {
    expect(record.results[id]!.settings.stimulus).toEqual({ target: 'S1', onsetMs: 100, durationMs: 200, amplitude: 0.8, shape: 'sine', periodMs: 200, noise: { amplitude: 0.1, seed: 2, holdMs: NOISE_HOLD_MS } })
  }
})

test('pin and compare lists a changed shape, period, noise and seed in words', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('pin-curve').click()
  await shape(page).selectOption('sine')
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Uyaran biçimi: Darbe → Sinüs'])
  await period(page).fill('200')
  await noise(page).fill('0.1')
  await resample(page).click()
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText([
    'Uyaran biçimi: Darbe → Sinüs', 'Sinüs periyodu: 100 ms → 200 ms', 'Girdi gürültüsü: 0,00 → 0,10', 'Gürültü tohumu: 1 → 2',
  ])
  // The pinned curve is the fourth path; the input line is not a path.
  await expect(curves(page)).toHaveCount(4)
  await expect(waveform(page)).toHaveCount(1)
  // Pinned with noise on, then only the sample changes: only the seed is listed.
  await page.getByTestId('pin-curve').click()
  await expect(page.getByTestId('pin-no-changes')).toBeVisible()
  await resample(page).click()
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Gürültü tohumu: 2 → 3'])
})

test('the input line stays inside the plot when the vertical scale is fitted to a small response', async ({ page }) => {
  await page.goto('/')
  await page.locator('#amplitude').fill('0.1')
  await shape(page).selectOption('ramp')
  await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
  await expect(page.getByTestId('chart-y-max')).not.toHaveText('1')
  // The line is clipped to the plot area instead of being rescaled or drawn over the axis labels.
  const clipped = await waveform(page).evaluate(line => {
    const clip = (line as SVGPolylineElement).ownerSVGElement!.querySelector('clipPath rect')!
    return { url: line.getAttribute('clip-path'), id: clip.parentElement!.id, top: Number(clip.getAttribute('y')), height: Number(clip.getAttribute('height')) }
  })
  expect(clipped.url).toBe(`url(#${clipped.id})`)
  expect(clipped.top).toBe(22)
  expect(clipped.height).toBe(240 - 23 - 38 + 2)
  await expect(curves(page)).toHaveCount(3)
})

test('the new controls have labels, comma values, 44 px targets and the documented ranges', async ({ page }) => {
  await page.goto('/')
  await shape(page).selectOption('sine')
  await noise(page).fill('0.05')
  await expect(page.getByRole('combobox', { name: 'Uyaran biçimi', exact: true })).toHaveValue('sine')
  await expect(page.getByRole('slider', { name: /^Sinüs periyodu/ })).toHaveValue('100')
  await expect(page.getByRole('slider', { name: /^Girdi gürültüsü/ })).toHaveAttribute('aria-valuetext', '0,05')
  await expect(page.getByRole('button', { name: 'Yeni gürültü örneği çek', exact: true })).toBeVisible()
  const attributes = (id: string) => page.locator(`#${id}`).evaluate(input => ({ min: Number(input.getAttribute('min')), max: Number(input.getAttribute('max')), step: Number(input.getAttribute('step')) }))
  expect(await attributes('sine-period')).toEqual(stimulusRanges.sinePeriod)
  expect(await attributes('noise-amplitude')).toEqual(stimulusRanges.noiseAmplitude)
  for (const control of [shape(page), period(page), noise(page), resample(page)]) {
    const box = await control.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  // Keyboard: the slider moves one step per arrow key and the focus is visible.
  await noise(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(noise(page)).toHaveValue('0.1')
  expect(await noise(page).evaluate(input => getComputedStyle(input).outlineStyle)).not.toBe('none')
  await resample(page).focus()
  expect(await resample(page).evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe('none')
  await expectNoHorizontalOverflow(page)
})

test('the protocol follows the language in place', async ({ page }) => {
  await page.goto('/')
  await shape(page).selectOption('sine')
  await noise(page).fill('0.15')
  await resample(page).click()
  const before = { paths: await paths(page), link: await shareUrl(page) }
  await page.locator('#language-preference').selectOption('en')
  await expect(page.locator('label[for="stimulus-shape"]')).toHaveText('Stimulus shape')
  await expect(shape(page).locator('option')).toHaveText(['Pulse', 'Ramp', 'Sine'])
  await expect(shape(page)).toHaveValue('sine')
  await expect(page.locator('label[for="sine-period"]')).toHaveText('Sine period 100 ms')
  await expect(page.locator('label[for="noise-amplitude"]')).toHaveText('Input noise 0.15')
  await expect(noise(page)).toHaveAttribute('aria-valuetext', '0.15')
  await expect(resample(page)).toHaveText('Draw a new noise sample')
  await expect(seed(page)).toHaveText('Seed 2')
  await expect(page.getByTestId('protocol-note')).toContainText('it is not a model of biological noise')
  await expect(page.getByTestId('protocol-note')).toContainText('No input here is a measured stimulus.')
  await expect(page.getByTestId('input-key')).toHaveText('Input I(t) · thin line')
  await expect(page.getByTestId('input-formula')).toContainText('P the sine period')
  await expect(page.getByTestId('input-formula')).toContainText('it is not a model of biological noise')
  await expect(chart(page)).toHaveAttribute('aria-label', /Shared vertical axis 0–1\.00\. The input I\(t\) given to the stimulated cell is drawn as well, as a thin line on the same axis\.$/)
  // The language changes text only: the curves and the link are the same.
  expect(await paths(page)).toEqual(before.paths)
  expect(await shareUrl(page)).toBe(before.link)
  await page.getByTestId('pin-curve').click()
  await shape(page).selectOption('ramp')
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Stimulus shape: Sine → Ramp'])
})
