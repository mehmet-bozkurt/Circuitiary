import { expect, type Page } from '@playwright/test'

/**
 * Turkish UI names the specs look elements up by. A renamed tab, link or group
 * is changed here once; the specs import these locators instead of copying them.
 */
export const navLabels = {
  experiments: 'Devre deneyleri',
  neuron: 'Nörondan devreye',
  guided: 'Rehberli deneyler',
  reading: 'Devreyi okumak',
  assumptions: 'Gerçek veri ve varsayımlar',
  atlas: 'Türler atlası',
} as const
export const viewLabels = { '2D': '2D · bağlantı haritası', '3D': '3D · şematik uzay' } as const

export const main = (page: Page) => page.getByRole('main')
export const navigation = (page: Page) => page.getByRole('navigation', { name: 'Öğrenme ve deneyler', exact: true })
export const navLink = (page: Page, name: string) => navigation(page).getByRole('link', { name, exact: true })
export const experimentLink = (page: Page) => navLink(page, navLabels.experiments)
export const cells = (page: Page) => page.getByRole('group', { name: 'İncelenecek hücre', exact: true })
export const cell = (page: Page, id: string) => cells(page).getByRole('button').filter({ has: page.locator('span', { hasText: new RegExp(`^${id}$`) }) })
export const view = (page: Page, id: keyof typeof viewLabels) => page.getByRole('tab', { name: viewLabels[id], exact: true })

export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

/** What the experiment controls show right now; compared before and after a page change. */
export interface ExperimentUi {
  values: Record<string, string>
  output: string
  cursor: string
  selected: string | null
  condition: string | null
  graphView: string | null
  playing: boolean
  focusedConnections: boolean | null
  scaledChart: boolean
}

export async function experimentUi(page: Page): Promise<ExperimentUi> {
  const values: Record<string, string> = {}
  for (const id of ['stimulus-target', 'amplitude', 'duration', 'silenced-edge', 'changed-neuron', 'changed-tau', 'base-tau', 'dt', 'chemical-gain', 'gap-gain']) {
    const control = page.locator(`#${id}`)
    if (await control.count()) values[id] = await control.inputValue()
  }
  const focus = page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true })
  return {
    values,
    output: await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).inputValue(),
    cursor: await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).inputValue(),
    selected: await cells(page).getByRole('button', { pressed: true }).locator('span').textContent(),
    condition: await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true }).getByRole('button', { pressed: true }).textContent(),
    graphView: await page.getByRole('tab', { selected: true }).textContent(),
    playing: await page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true }).count() === 1,
    focusedConnections: await focus.count() ? await focus.isChecked() : null,
    scaledChart: await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).isChecked(),
  }
}

/** Waits three animation frames so a canvas or WebGL draw requested just before has landed. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}
