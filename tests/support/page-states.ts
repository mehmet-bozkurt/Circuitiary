import { expect, type Page } from '@playwright/test'

export const main = (page: Page) => page.getByRole('main')
const runAll = async (page: Page) => {
  const run = main(page).getByRole('button', { name: 'Deneyi çalıştır', exact: true })
  await expect(run.first()).toBeEnabled()
  // Each run relabels its button "Yeniden çalıştır", so the first remaining one is always unrun.
  for (let remaining = await run.count(); remaining > 0; remaining--) {
    await run.first().click()
    await expect(run).toHaveCount(remaining - 1)
  }
}

/** Switches the assumptions lesson to another variable and reruns its comparison at that variable's default value. */
const assumptionVariable = (variable: 'gap-gain' | 'time-constant') => async (page: Page) => {
  await main(page).locator('#assumptions-variable').selectOption(variable)
  await main(page).getByRole('button', { name: 'Yeniden çalıştır', exact: true }).click()
  await expect(main(page).getByTestId('assumptions-result')).toHaveAttribute('data-stale', 'false')
  await expect(main(page).getByTestId('assumptions-run-settings')).toHaveAttribute('data-variable', variable)
}

/** Each route lists the UI states to measure, in order; every state is measured with all <details> open. */
const states: Record<string, Array<{ name: string; enter: (page: Page) => Promise<void> }>> = {
  '/': [
    { name: 'illustrative 2D', enter: async () => {} },
    { name: 'open term card', enter: async page => {
      await page.locator('.term-trigger').first().focus()
      await expect(page.getByRole('dialog')).toBeVisible()
    } },
    { name: 'illustrative 3D', enter: async page => {
      await page.keyboard.press('Escape')
      await page.getByRole('tab', { name: '3D · şematik uzay', exact: true }).click()
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
    } },
    { name: 'real 3D', enter: async page => {
      await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-node-count', '30')
    } },
    { name: 'real 2D', enter: async page => { await page.getByRole('tab', { name: '2D · bağlantı haritası', exact: true }).click() } },
  ],
  '/ogren/norondan-devreye': [
    { name: 'initial', enter: async () => {} },
    { name: 'removed B→C connection', enter: async page => { await main(page).getByRole('checkbox', { name: /B→C bağlantısını kaldır/ }).check() } },
  ],
  '/ogren/rehberli-deneyler': [{ name: 'all experiments run', enter: runAll }],
  '/ogren/devreyi-okumak': [{ name: 'local data loaded', enter: async page => { await expect(main(page)).toHaveAttribute('data-data-state', 'ready') } }],
  '/ogren/gercek-veri-ve-varsayimlar': [
    { name: 'chemical multiplier run', enter: runAll },
    { name: 'electrical multiplier run', enter: assumptionVariable('gap-gain') },
    { name: 'time constant run', enter: assumptionVariable('time-constant') },
  ],
  '/ogren/turler-atlasi': [{ name: 'initial', enter: async () => {} }],
}

/**
 * Visits every route and UI state the page-wide audits (contrast, decimal
 * separator) cover, with all <details> open, and calls `audit` in each state.
 */
export async function visitStates(page: Page, audit: (label: string) => Promise<void>) {
  for (const [route, steps] of Object.entries(states)) {
    await page.goto(route)
    await expect(main(page)).toBeVisible()
    for (const step of steps) {
      await step.enter(page)
      await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true }))
      await audit(`${route} · ${step.name}`)
    }
  }
}
