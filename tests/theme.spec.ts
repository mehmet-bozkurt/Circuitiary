import { expect, test } from '@playwright/test'
import { experimentLink, navLabels, navLink } from './support/ui'

test('system theme follows the OS while an explicit choice takes priority', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true })
  await expect(theme).toHaveValue('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(18, 29, 25)')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await theme.selectOption('dark')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(18, 29, 25)')
  await theme.selectOption('light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(245, 244, 237)')
  await theme.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('theme persists across reloads and every lesson without changing experiment curves', async ({ page }) => {
  await page.goto('/')
  const curves = page.locator('.activation-chart path')
  await expect(curves).toHaveCount(3)
  const before = await curves.evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark')
  expect(await curves.evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(before)
  for (const name of [navLabels.neuron, navLabels.guided, navLabels.reading, navLabels.assumptions, navLabels.atlas]) {
    await navLink(page, name).click()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toHaveValue('dark')
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(18, 29, 25)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toHaveValue('dark')
  await experimentLink(page).click()
  await expect(curves).toHaveCount(3)
  expect(await curves.evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(before)
})

test('theme remains usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } })
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/ogren/turler-atlasi')
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('main')).toBeVisible()
})

test('theme choices synchronize between open tabs', async ({ page, context }) => {
  await page.goto('/')
  const other = await context.newPage()
  await other.goto('/ogren/turler-atlasi')
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark')
  await expect(other.getByRole('combobox', { name: 'Tema', exact: true })).toHaveValue('dark')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark')
  await other.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('light')
  await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toHaveValue('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
