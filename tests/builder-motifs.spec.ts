import { expect, test } from '@playwright/test'
import { cellIds, motifs, motifsEn, runDraft } from '../src/learning/circuitBuilder'
import { card, language, linkRows, loadMotif, metric, openBuilder, expectNoBrowserErrors, removeLink, run, setRange, status, strength } from './support/builder'
import { expectNoHorizontalOverflow, main } from './support/ui'

test.beforeEach(async ({ page }) => { await openBuilder(page) })
test.afterEach(async ({ page }) => { await expectNoBrowserErrors(page) })

const addedIds = ['divergence', 'convergence', 'feedback-inhibition', 'electrical-pair', 'disinhibition']

test('the gallery has a card for every motif: name, schematic drawn from its circuit, one sentence and a load button', async ({ page }) => {
  expect(motifs.map(motif => motif.id).slice(4)).toEqual(addedIds)
  const gallery = main(page).getByTestId('builder-gallery')
  await expect(gallery.locator('li.motif-card')).toHaveCount(motifs.length)
  for (const motif of motifs) {
    const item = card(page, motif.id)
    await expect(item.getByRole('heading', { level: 3, name: motif.title, exact: true })).toBeVisible()
    await expect(item.locator('p')).toHaveText(motif.teaches)
    // The picture is made from the motif's own cells and connections.
    const picture = item.getByRole('img')
    await expect(picture).toHaveAccessibleName(new RegExp(`^Şema: ${motif.draft.cellCount} hücre`))
    await expect(picture.locator('[data-node]')).toHaveCount(motif.draft.cellCount)
    expect(await picture.locator('[data-node]').evaluateAll(nodes => nodes.map(node => node.textContent?.trim()))).toEqual(cellIds(motif.draft.cellCount))
    expect(await picture.locator('[data-edge]').evaluateAll(edges => edges.map(edge => edge.getAttribute('data-edge')))).toEqual(motif.draft.links.map(link => link.type))
    expect(await picture.locator('[data-stimulated="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-node')))).toEqual([motif.draft.stimulus.target])
    // Shape, not color, tells the type: a closed head, a bar, or two plain lines.
    for (const [index, link] of motif.draft.links.entries()) {
      const edge = picture.locator('[data-edge]').nth(index)
      await expect(edge.locator('.edge-line')).toHaveCount(link.type === 'gap' ? 2 : 1)
      await expect(edge.locator('.edge-arrow')).toHaveCount(link.type === 'excitatory' ? 1 : 0)
      await expect(edge.locator('.edge-bar')).toHaveCount(link.type === 'inhibitory' ? 1 : 0)
    }
    const strokes = await picture.locator('.edge-line').evaluateAll(lines => [...new Set(lines.map(line => getComputedStyle(line).stroke))])
    expect(strokes, 'every connection type is drawn in the same color').toHaveLength(1)
    // The load button is named by the motif's title first, and keeps data-preset.
    const button = item.getByRole('button')
    await expect(button).toHaveAccessibleName(`${motif.title} Yükle`)
    await expect(button).toHaveAttribute('data-preset', motif.id)
    await expect(button).toHaveText('Yükle')
  }
  await expect(main(page).getByRole('list', { name: 'Şemaların okunuşu', exact: true }).getByRole('listitem')).toHaveText(['ok ucu: uyarıcı', 'çubuk uç: baskılayıcı', 'çift çizgi: elektriksel (gap)', 'çift halka: uyarılan hücre'])
})

test('every motif loads into the builder and runs to the numbers of its own circuit', async ({ page }) => {
  for (const motif of motifs) {
    await loadMotif(page, motif.id).click()
    await expect(status(page)).toHaveText(`“${motif.title}” örneği yüklendi. İstersen değiştir, sonra çalıştır.`)
    const note = main(page).getByTestId('builder-preset-note')
    await expect(note).toHaveAttribute('data-preset', motif.id)
    await expect(note).toContainText(motif.look)
    await expect(note).toContainText(motif.tryThis)
    await expect(note).toContainText(motif.boundary)
    await expect(linkRows(page)).toHaveCount(motif.draft.links.length)
    await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
    await run(page)
    await expect(main(page).getByTestId('builder-table').getByRole('row')).toHaveCount(motif.draft.cellCount + 1)
    const expected = runDraft(motif.draft)
    if (!expected.ok) throw new Error(`${motif.id} does not run`)
    for (const cell of expected.run.cells) {
      expect(await metric(page, 'peak', cell.id), `${motif.id} ${cell.id}`).toBeCloseTo(cell.peak, 12)
      expect(await metric(page, 'peak-time', cell.id), `${motif.id} ${cell.id}`).toBe(cell.peakTimeMs)
      expect(await metric(page, 'final', cell.id), `${motif.id} ${cell.id}`).toBeCloseTo(cell.finalValue, 12)
    }
  }
})

test('each new motif shows in the result table what its text describes', async ({ page }) => {
  // Divergence: B and C peak together, C is B scaled by 0,5 / 0,9; removing A→C leaves B as it was.
  await loadMotif(page, 'divergence').click()
  await run(page)
  expect(await metric(page, 'peak-time', 'B')).toBe(await metric(page, 'peak-time', 'C'))
  const divergedB = (await metric(page, 'peak', 'B'))!
  expect((await metric(page, 'peak', 'C'))! / divergedB).toBeCloseTo(0.5 / 0.9, 10)
  expect((await metric(page, 'reach', 'C'))!).toBeGreaterThan((await metric(page, 'reach', 'B'))!)
  await removeLink(page, 2).click()
  await run(page)
  expect(await metric(page, 'peak', 'C')).toBe(0)
  expect(await metric(page, 'peak', 'B')).toBe(divergedB)

  // Convergence: D with two paths is twice D with one, and peaks after B and C.
  await loadMotif(page, 'convergence').click()
  await run(page)
  const summed = (await metric(page, 'peak', 'D'))!
  expect(summed).toBeCloseTo(0.70, 2)
  await expect(main(page).getByTestId('builder-peak-D')).toHaveText('0,698')
  expect((await metric(page, 'peak-time', 'D'))!).toBeGreaterThan((await metric(page, 'peak-time', 'B'))!)
  await removeLink(page, 4).click()
  await run(page)
  expect(summed / (await metric(page, 'peak', 'D'))!).toBeCloseTo(2, 10)
  await expect(main(page).getByTestId('builder-peak-D')).toHaveText('0,349')

  // Feedback inhibition: A peaks early and B later; without the inhibition A rises to the end of the pulse, about twice as high.
  await loadMotif(page, 'feedback-inhibition').click()
  await run(page)
  const limited = (await metric(page, 'peak', 'A'))!
  expect((await metric(page, 'peak-time', 'A'))!).toBeLessThan(135)
  expect((await metric(page, 'peak-time', 'B'))!).toBeGreaterThan((await metric(page, 'peak-time', 'A'))!)
  await expect(main(page).getByTestId('builder-facts')).toContainText('altına indi')
  await removeLink(page, 2).click()
  await run(page)
  expect(await metric(page, 'peak-time', 'A')).toBe(300)
  expect((await metric(page, 'peak', 'A'))! / limited).toBeGreaterThan(1.9)
  expect((await metric(page, 'peak', 'A'))! / limited).toBeLessThan(2.3)

  // Electrically coupled pair: the two peaks add up to the peak of A alone; at strength 1 B reaches half of A.
  await loadMotif(page, 'electrical-pair').click()
  await run(page)
  const [pairA, pairB] = [(await metric(page, 'peak', 'A'))!, (await metric(page, 'peak', 'B'))!]
  expect(pairA).toBeCloseTo(0.60, 2)
  expect(pairA + pairB).toBeCloseTo(0.80, 2)
  expect(pairB / pairA).toBeCloseTo(1 / 3, 2)
  await setRange(strength(page, 1), 1)
  await run(page)
  expect((await metric(page, 'peak', 'B'))! / (await metric(page, 'peak', 'A'))!).toBeCloseTo(1 / 2, 2)

  // Disinhibition: C is high while D inhibits B; without D→B it falls.
  await loadMotif(page, 'disinhibition').click()
  await run(page)
  const released = (await metric(page, 'peak', 'C'))!
  await expect(main(page).getByTestId('builder-peak-C')).toHaveText('0,710')
  expect((await metric(page, 'peak', 'B'))!).toBeLessThan(0.2)
  await removeLink(page, 5).click()
  await run(page)
  await expect(main(page).getByTestId('builder-peak-C')).toHaveText('0,223')
  expect(released).toBeGreaterThan(3 * (await metric(page, 'peak', 'C'))!)
  expect((await metric(page, 'peak', 'B'))!).toBeGreaterThan(0.7)
})

test('a motif is loaded with the keyboard, and the gallery fits a 320 px window with 44 px buttons', async ({ page }) => {
  await loadMotif(page, 'disinhibition').focus()
  await page.keyboard.press('Enter')
  await expect(linkRows(page)).toHaveCount(5)
  await expect(main(page).getByTestId('builder-preset-note')).toHaveAttribute('data-preset', 'disinhibition')

  await page.setViewportSize({ width: 320, height: 800 })
  await expectNoHorizontalOverflow(page)
  const gallery = main(page).getByTestId('builder-gallery')
  const box = (await gallery.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  for (const id of addedIds) {
    // A card further along the row is brought into view by focusing or clicking its button.
    await loadMotif(page, id).scrollIntoViewIfNeeded()
    await expect(loadMotif(page, id)).toBeInViewport()
    const size = (await loadMotif(page, id).boundingBox())!
    expect(size.height).toBeGreaterThanOrEqual(43.5)
    expect(size.width).toBeGreaterThanOrEqual(43.5)
    expect((await card(page, id).getByRole('img').boundingBox())!.width).toBeGreaterThan(120)
  }
  await expect(main(page).getByText('Diğer örnekler için listeyi yana kaydır.', { exact: true })).toBeVisible()
  // The row scrolls inside itself; the page does not.
  expect(await gallery.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await loadMotif(page, 'electrical-pair').click()
  await expect(linkRows(page)).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
})

test('the gallery, a loaded motif and its schematics are English after switching the language', async ({ page }) => {
  await loadMotif(page, 'feedback-inhibition').click()
  await language(page).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  // The loaded motif stays loaded; its recorded status line and note are written again in English.
  await expect(linkRows(page)).toHaveCount(2)
  await expect(status(page)).toHaveText('The “Feedback inhibition” example is loaded. Change it if you like, then run it.')
  await expect(main(page).getByTestId('builder-preset-note')).toContainText('does not produce a self-sustained oscillation')
  for (const motif of motifsEn) {
    const item = card(page, motif.id)
    await expect(item.getByRole('heading', { level: 3 })).toHaveText(motif.title)
    await expect(item.locator('p')).toHaveText(motif.teaches)
    await expect(item.getByRole('button')).toHaveAccessibleName(`${motif.title} Load`)
    await expect(item.getByRole('img')).toHaveAccessibleName(new RegExp(`^Schematic: ${motif.draft.cellCount} cells`))
  }
  await expect(card(page, 'excitation-inhibition').getByRole('img')).toHaveAccessibleName('Schematic: 3 cells (A–C). Connections: A → B excitatory; A → C excitatory; B → C inhibitory. Stimulated cell: A.')
  await expect(main(page).getByRole('list', { name: 'How to read the schematics', exact: true }).getByRole('listitem')).toHaveText(['arrowhead: excitatory', 'bar end: inhibitory', 'double line: electrical (gap)', 'double ring: stimulated cell'])
  const gallery = main(page).locator('.builder-gallery')
  expect(await gallery.innerText()).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
  await loadMotif(page, 'convergence').click()
  await expect(status(page)).toHaveText('The “Convergence: two paths sum at one target” example is loaded. Change it if you like, then run it.')
  await run(page)
  await expect(main(page).getByTestId('builder-peak-D')).toHaveText('0.698')
  await language(page).selectOption('tr')
  await expect(card(page, 'convergence').getByRole('button')).toHaveAccessibleName('Yakınsama: iki yol tek hedefte toplanır Yükle')
  await expect(main(page).getByTestId('builder-peak-D')).toHaveText('0,698')
})
