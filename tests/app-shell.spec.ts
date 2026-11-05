import { expect, test, type Page } from '@playwright/test'
import { experimentLink, main, navLabels, navLink } from './support/ui'

const lessonLink = (page: Page) => navLink(page, navLabels.neuron)
const timeSlider = (page: Page) => page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })
const playButton = (page: Page) => page.getByRole('button', { name: 'Etkinliği oynat', exact: true })
const pauseButton = (page: Page) => page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })

// Wraps simulate() in the module the dev server serves, so a spec can count how
// many full simulations a control costs without touching application code.
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

async function visibleNumbers(page: Page) {
  return {
    peaks: await Promise.all(['baseline', 'silenced', 'tau'].map(id => page.getByTestId(`peak-${id}`).textContent())),
    convergence: await page.getByTestId('convergence-error').textContent(),
    curves: await page.locator('.activation-chart path').evaluateAll(paths => paths.map(path => path.getAttribute('d'))),
  }
}

test('a control re-runs only the simulations it feeds', async ({ page }) => {
  await countSimulations(page)
  await page.goto('/')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  // Three conditions plus the dt/2 numerical check.
  expect(await simulations(page)).toBe(4)
  // Only the condition each control belongs to is simulated again.
  expect(await runsOf(page, () => page.locator('#changed-tau').fill('150'))).toBe(1)
  expect(await runsOf(page, () => page.locator('#changed-neuron').selectOption('I4'))).toBe(1)
  expect(await runsOf(page, () => page.locator('#silenced-edge').selectOption('I4-O1'))).toBe(1)
  // Viewing choices never simulate.
  expect(await runsOf(page, () => page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2'))).toBe(0)
  expect(await runsOf(page, () => page.getByRole('button', { name: 'B Bağlantı susturuldu', exact: true }).click())).toBe(0)
  expect(await runsOf(page, () => timeSlider(page).fill('400'))).toBe(0)
  // The shared baseline settings feed every condition and the check.
  expect(await runsOf(page, () => page.locator('#base-tau').fill('45'))).toBe(4)
  expect(await runsOf(page, () => page.locator('#amplitude').fill('0.55'))).toBe(4)
  expect(await runsOf(page, () => page.locator('#dt').selectOption('0.5'))).toBe(4)
})

test('partial recomputation shows the same numbers as setting the final values on a fresh page', async ({ page }) => {
  await page.goto('/')
  await page.locator('#changed-tau').fill('150')
  await page.locator('#silenced-edge').selectOption('I4-O1')
  await page.locator('#amplitude').fill('0.55')
  await page.locator('#changed-neuron').selectOption('I4')
  await page.locator('#changed-tau').fill('40')
  await page.locator('#dt').selectOption('0.25')
  await page.locator('#silenced-edge').selectOption('I3-O1')
  const incremental = await visibleNumbers(page)
  const fresh = await page.context().newPage()
  try {
    await fresh.goto('/')
    await fresh.locator('#dt').selectOption('0.25')
    await fresh.locator('#amplitude').fill('0.55')
    await fresh.locator('#changed-neuron').selectOption('I4')
    await fresh.locator('#changed-tau').fill('40')
    await fresh.locator('#silenced-edge').selectOption('I3-O1')
    expect(await visibleNumbers(fresh)).toEqual(incremental)
  } finally { await fresh.close() }
  expect(incremental.curves).toHaveLength(3)
})

test.describe('playback while another page is shown', () => {
  test.beforeEach(async ({ page }) => {
    const epoch = new Date('2030-01-01T00:00:00Z')
    await page.clock.install({ time: epoch })
    await page.clock.pauseAt(new Date(epoch.getTime() + 1000))
    await page.goto('/')
  })

  test('is suspended behind a lesson page and resumes from the same time', async ({ page }) => {
    await playButton(page).click()
    await page.clock.runFor(160)
    const leftAt = Number(await timeSlider(page).inputValue())
    expect(leftAt).toBeGreaterThan(250)
    await lessonLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
    // Long enough to reach the end of the 700 ms simulation if it kept running.
    await page.clock.runFor(4000)
    await experimentLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    await expect(timeSlider(page)).toHaveValue(String(leftAt))
    await expect(pauseButton(page)).toBeVisible()
    await page.clock.runFor(160)
    const resumedAt = Number(await timeSlider(page).inputValue())
    // Only the visible 160 ms count: about 0.22 ms of model time per ms.
    expect(resumedAt).toBeGreaterThan(leftAt)
    expect(resumedAt - leftAt).toBeLessThan(60)
    await pauseButton(page).click()
    await expect(playButton(page)).toBeVisible()
  })

  test('an inspection from the reading page keeps playing and continues once the experiment is shown', async ({ page, request }) => {
    // Needs the local anatomy served by the dev server; the other specs that read it fail without it.
    test.skip(!(await request.get('/api/local-connectome')).ok(), 'Yerel gerçek veri yok')
    await playButton(page).click()
    await page.clock.runFor(160)
    const leftAt = Number(await timeSlider(page).inputValue())
    expect(leftAt).toBeGreaterThan(250)
    await navLink(page, navLabels.reading).click()
    await expect(main(page)).toHaveAttribute('id', 'circuit-reading')
    await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
    await main(page).locator('#reading-neuron').selectOption('RIS')
    await main(page).getByRole('button', { name: 'Ana deneyde bu hücreyi incele', exact: true }).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    await expect(timeSlider(page)).toHaveValue(String(leftAt))
    await expect(pauseButton(page)).toBeVisible()
    await page.clock.runFor(160)
    const resumedAt = Number(await timeSlider(page).inputValue())
    expect(resumedAt).toBeGreaterThan(leftAt)
    expect(resumedAt - leftAt).toBeLessThan(60)
  })

  test('a paused experiment stays paused after a visit to another page', async ({ page }) => {
    await timeSlider(page).fill('300')
    await lessonLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
    await page.clock.runFor(1000)
    await experimentLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    await page.clock.runFor(1000)
    await expect(timeSlider(page)).toHaveValue('300')
    await expect(playButton(page)).toBeVisible()
  })
})

const lessonChunk = /\/src\/components\/NeuronLearningPage\.vue(\?|$)/

test('a lesson page chunk that fails once is retried without the learner noticing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let requests = 0
  await page.route(lessonChunk, route => (++requests === 1 ? route.abort('failed') : route.continue()))
  await page.goto('/')
  await lessonLink(page).click()
  await expect(page.getByRole('heading', { level: 1, name: /Nörondan devreye|Bir nöron/ })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toBeGreaterThanOrEqual(2)
  expect(errors).toEqual([])
})

test('a lesson page chunk that keeps failing shows a visible error with a way to reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(lessonChunk, route => route.abort('failed'))
  await page.goto('/')
  await lessonLink(page).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Bu sayfa yüklenemedi')
  // The other pages stay usable: only the failed one shows the message.
  await experimentLink(page).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  // Reloading after the network recovers opens the requested lesson.
  await page.unroute(lessonChunk)
  await lessonLink(page).click()
  await alert.getByRole('button', { name: 'Sayfayı yenile' }).click()
  await expect(page).toHaveURL(/\/ogren\/norondan-devreye$/)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(main(page).first()).toBeVisible()
  expect(errors).toEqual([])
})

const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'adresinde bir sayfa yok' })

test('an address outside the app opens the experiment page and says so, with a link home', async ({ page }) => {
  await page.goto('/yanlis/adres?x=1')
  await expect(notice(page)).toContainText('“/yanlis/adres” adresinde bir sayfa yok')
  await expect(main(page)).toBeVisible()
  await expect(page).toHaveTitle('Sayfa bulunamadı · Circuitiary')
  await notice(page).getByRole('link', { name: 'Devre deneyleri sayfasına git' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(notice(page)).toHaveCount(0)
  await expect(page).toHaveTitle('Circuitiary · Devre deneyleri')
  // Both addresses show the experiment page, so only the notice tells them apart.
  await page.goBack()
  await expect(notice(page)).toContainText('“/yanlis/adres”')
  await page.goForward()
  await expect(notice(page)).toHaveCount(0)
})

test('the unknown-address notice follows the history and never shows on the app\'s own addresses', async ({ page }) => {
  await page.goto('/yanlis/adres')
  await expect(notice(page)).toBeVisible()
  await lessonLink(page).click()
  await expect(notice(page)).toHaveCount(0)
  await page.goBack()
  await expect(notice(page)).toBeVisible()
  await expect(page).toHaveTitle('Sayfa bulunamadı · Circuitiary')
  for (const path of ['/', '/ogren/norondan-devreye/', '/ogren/rehberli-deneyler', '/ogren/devreyi-okumak', '/ogren/gercek-veri-ve-varsayimlar/', '/ogren/turler-atlasi']) {
    await page.goto(path)
    await expect(main(page)).toBeVisible()
    await expect(notice(page), path).toHaveCount(0)
  }
})
