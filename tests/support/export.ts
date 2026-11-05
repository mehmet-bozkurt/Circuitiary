import { expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * Clicks "Deney kaydını indir" and returns the downloaded JSON record. With
 * `fileName`, the suggested download name is asserted as well.
 */
export async function exportRecord<T = Record<string, unknown>>(page: Page, fileName?: string): Promise<T> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const download = await pending
  if (fileName !== undefined) expect(download.suggestedFilename()).toBe(fileName)
  const path = await download.path()
  expect(path).not.toBeNull()
  return JSON.parse(await readFile(path!, 'utf8')) as T
}
