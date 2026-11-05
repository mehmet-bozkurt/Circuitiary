import { expect, test, type Page } from '@playwright/test'
import { glossaryTerms } from '../src/terms/glossary'
import { expectNoHorizontalOverflow, main, navLabels, navLink } from './support/ui'

const glossaryPath = '/ogren/sozluk'
const total = glossaryTerms.length
const search = (page: Page) => main(page).getByRole('searchbox', { name: 'Sözcük ara', exact: true })
const status = (page: Page) => main(page).getByRole('status')
const entries = (page: Page) => main(page).locator('article.glossary-term')
const shownIds = (page: Page) => entries(page).evaluateAll(elements => elements.map(element => element.getAttribute('data-term-id')))
const search_ = async (page: Page, query: string) => { await search(page).fill(query); return shownIds(page) }

test('the navigation opens the glossary and every term appears exactly once, in Turkish alphabetical order', async ({ page }) => {
  await page.goto('/')
  await navLink(page, navLabels.glossary).click()
  await expect(page).toHaveURL(new RegExp(`${glossaryPath}$`))
  await expect(page).toHaveTitle('Sözlük · Circuitiary')
  await expect(page.getByRole('heading', { level: 1, name: 'Sözlük', exact: true })).toBeFocused()
  await expect(entries(page)).toHaveCount(total)
  for (const term of glossaryTerms) {
    await expect(main(page).locator(`#term-${term.id}`)).toHaveCount(1)
    await expect(main(page).getByRole('heading', { level: 2, name: term.title, exact: true })).toHaveCount(1)
  }
  const titles = await main(page).locator('article.glossary-term h2').allTextContents()
  const collator = new Intl.Collator('tr')
  expect(titles).toEqual([...glossaryTerms.map(term => term.title)].sort(collator.compare))
  await expect(status(page)).toHaveText(`${total} sözcüğün tamamı listeleniyor.`)
  await expectNoHorizontalOverflow(page)
})

test('each term shows its meaning, origin, project note and sources as safe external links', async ({ page }) => {
  await page.goto(glossaryPath)
  for (const term of glossaryTerms) {
    const entry = main(page).locator(`#term-${term.id}`)
    await expect(entry).toContainText(term.meaning)
    await expect(entry).toContainText(term.origin)
    if (term.context) await expect(entry).toContainText(term.context)
    else await expect(entry.getByText('Bu projede', { exact: true })).toHaveCount(0)
    for (const source of term.sources) {
      const link = entry.getByRole('link', { name: source.title, exact: true })
      await expect(link).toHaveAttribute('href', source.url)
      await expect(link).toHaveAttribute('target', '_blank')
      expect(await link.getAttribute('rel')).toMatch(/\bnoopener\b/)
      expect(await link.getAttribute('rel')).toMatch(/\bnoreferrer\b/)
    }
  }
  // No external link anywhere on the page lacks the protective rel.
  const external = await main(page).locator('a[href^="http"]').evaluateAll(links => links.map(link => link.getAttribute('rel') ?? ''))
  expect(external).toHaveLength(glossaryTerms.reduce((count, term) => count + term.sources.length, 0))
  for (const rel of external) expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
})

test('the page states what the glossary does not claim', async ({ page }) => {
  await page.goto(glossaryPath)
  await expect(main(page)).toContainText('Bu sözlük bir öğrenme notudur')
  await expect(main(page)).toContainText('hangi yoldan girdiğini iddia etmez')
})

test('searching narrows the list, announces the count, and clearing restores it', async ({ page }) => {
  await page.goto(glossaryPath)
  await search(page).fill('konnektom')
  await expect(entries(page)).toHaveCount(1)
  await expect(entries(page).first()).toHaveAttribute('data-term-id', 'konnektom')
  await expect(status(page)).toHaveText(`“konnektom” için ${total} sözcükten 1 tanesi bulundu.`)
  await main(page).getByRole('button', { name: 'Aramayı temizle', exact: true }).click()
  await expect(search(page)).toHaveValue('')
  await expect(search(page)).toBeFocused()
  await expect(entries(page)).toHaveCount(total)
  await expect(status(page)).toHaveText(`${total} sözcüğün tamamı listeleniyor.`)
  await expect(main(page).getByRole('button', { name: 'Aramayı temizle', exact: true })).toHaveCount(0)
})

test('a search with several words keeps the alphabetical order and needs every word', async ({ page }) => {
  await page.goto(glossaryPath)
  expect(await search_(page, 'gap junction')).toEqual(['gap-junction'])
  expect(await search_(page, 'junction gap')).toEqual(['gap-junction'])
  expect(await search_(page, 'gap xyz')).toEqual([])
  const wide = await search_(page, 'nöron')
  expect(wide.length).toBeGreaterThan(2)
  expect(wide).toContain('noron')
  const collator = new Intl.Collator('tr')
  const titleOf = (id: string | null) => glossaryTerms.find(term => term.id === id)!.title
  expect(wide.map(titleOf)).toEqual([...wide.map(titleOf)].sort(collator.compare))
})

test('Turkish letters, capitals and plain-keyboard spellings find the same term', async ({ page }) => {
  await page.goto(glossaryPath)
  // İ and I lower-case differently in Turkish; both capitals still reach the term.
  for (const query of ['HERMAFRODİT', 'HERMAFRODIT', 'hermafrodit', 'Hermafrodİt']) expect(await search_(page, query), query).toEqual(['hermafrodit'])
  for (const query of ['RESEPTÖR', 'reseptör', 'reseptor']) expect(await search_(page, query), query).toEqual(['reseptor'])
  for (const query of ['NÖRON', 'noron', 'Nöron']) expect(await search_(page, query), query).toContain('noron')
  expect(await search_(page, 'SINAPS')).toContain('sinaps')
  expect(await search_(page, 'SİNAPS')).toContain('sinaps')
  // An alias that is not the title, and a word that only occurs in the meaning.
  expect(await search_(page, 'connectome')).toEqual(['konnektom'])
  expect(await search_(page, 'sinaptik')).toContain('sinaps')
  expect(await search_(page, 'KARIN TARAFINA')).toEqual(['ventral'])
  // The origin text is not searched, and the page says so.
  expect(await search_(page, 'Hermes')).toEqual([])
})

test('a search without a match says so, offers a way back, and restores the list', async ({ page }) => {
  await page.goto(glossaryPath)
  await search(page).fill('zzzz')
  await expect(entries(page)).toHaveCount(0)
  await expect(status(page)).toHaveText('“zzzz” ile eşleşen sözcük bulunamadı.')
  const empty = main(page).getByTestId('glossary-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText('Eşleşen sözcük yok')
  await empty.getByRole('button', { name: 'Aramayı temizle, bütün sözcükleri göster' }).click()
  await expect(empty).toHaveCount(0)
  await expect(entries(page)).toHaveCount(total)
  await expect(search(page)).toBeFocused()
})

test('a shared link scrolls to the term and focuses it', async ({ page }) => {
  await page.goto(`${glossaryPath}#term-konnektom`)
  const entry = main(page).locator('#term-konnektom')
  await expect(entry).toBeFocused()
  const top = (await entry.boundingBox())!.y
  expect(top).toBeGreaterThanOrEqual(0)
  expect(top).toBeLessThan(200)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  // The browser's own focus ring (programmatic focus) must be visible, not removed.
  expect(await entry.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
})

test('an in-app link to a term opens the glossary on that term', async ({ page }) => {
  await page.goto('/ogren/turler-atlasi')
  await expect(main(page)).toBeVisible()
  // Another page links to a term the same way a reader would follow a shared link.
  await page.evaluate(path => {
    const link = document.createElement('a')
    link.id = 'to-term'
    link.href = path
    link.textContent = 'Plastisite sözlükte'
    document.querySelector('.term-help')!.append(link)
  }, `${glossaryPath}#term-plastisite`)
  await page.locator('#to-term').click()
  await expect(page).toHaveURL(new RegExp(`${glossaryPath}#term-plastisite$`))
  await expect(page.locator('#term-plastisite')).toBeFocused()
  expect((await page.locator('#term-plastisite').boundingBox())!.y).toBeLessThan(200)
})

test('a fragment chosen while the glossary is still loading is the one that gets focused', async ({ page }) => {
  // Hold the page's code back, follow a plain link to the glossary, then let the address gain a term fragment.
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/components/GlossaryPage.vue*', async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.evaluate(path => {
    const link = document.createElement('a')
    link.id = 'to-glossary'
    link.href = path
    link.textContent = 'Sözlüğe git'
    document.querySelector('.term-help')!.append(link)
  }, glossaryPath)
  await page.locator('#to-glossary').click()
  await expect(page).toHaveURL(new RegExp(`${glossaryPath}$`))
  await page.evaluate(() => history.replaceState(null, '', '/ogren/sozluk#term-soma'))
  release()
  await expect(page.locator('#term-soma')).toBeFocused()
})

test('the permalink of a term changes the address and focuses that term', async ({ page }) => {
  await page.goto(glossaryPath)
  const link = main(page).locator('#term-soma').getByRole('link', { name: 'Soma sözcüğünün kalıcı bağlantısı', exact: true })
  await expect(link).toHaveAttribute('href', '#term-soma')
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${glossaryPath}#term-soma$`))
  await expect(main(page).locator('#term-soma')).toBeFocused()
})

test('a link to a term hidden by the search clears the search and shows the term', async ({ page }) => {
  await page.goto(glossaryPath)
  await search(page).fill('akson')
  await expect(main(page).locator('#term-noron')).toHaveCount(0)
  await page.evaluate(() => { location.hash = '#term-noron' })
  await expect(search(page)).toHaveValue('')
  await expect(entries(page)).toHaveCount(total)
  await expect(main(page).locator('#term-noron')).toBeFocused()
})

test('the controls are touch sized and the page does not scroll sideways', async ({ page }) => {
  await page.goto(glossaryPath)
  await search(page).fill('nöron')
  const small = await main(page).locator('input, button, a').evaluateAll(controls => controls
    .filter(control => (control as HTMLElement).checkVisibility())
    .map(control => ({ name: (control.getAttribute('aria-label') ?? control.textContent ?? '').trim().slice(0, 40), box: control.getBoundingClientRect() }))
    .filter(control => control.box.height < 43.5 || control.box.width < 43.5)
    .map(control => `${control.name} ${Math.round(control.box.width)}x${Math.round(control.box.height)}`))
  expect(small).toEqual([])
  await expectNoHorizontalOverflow(page)
  await search(page).fill('zzzz')
  await expectNoHorizontalOverflow(page)
  await page.goto(`${glossaryPath}#term-gap-junction`)
  await expectNoHorizontalOverflow(page)
})

test('an in-app link to a term still reaches it when an earlier search on this page hid it', async ({ page }) => {
  await page.goto(glossaryPath)
  await search(page).fill('akson')
  await expect(entries(page)).toHaveCount(1)
  // The glossary stays mounted with its search while another page is open; an in-app link then points at a hidden term.
  await navLink(page, navLabels.experiments).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(path => {
    const link = document.createElement('a')
    link.id = 'to-term'
    link.href = path
    link.textContent = 'Nöron sözlükte'
    document.querySelector('.term-help')!.append(link)
  }, `${glossaryPath}#term-noron`)
  await page.locator('#to-term').click()
  await expect(page).toHaveURL(new RegExp(`${glossaryPath}#term-noron$`))
  await expect(main(page).locator('#term-noron')).toBeFocused()
  await expect(search(page)).toHaveValue('')
})

test('a term lists its other forms, and only those that differ from its title', async ({ page }) => {
  await page.goto(glossaryPath)
  await expect(main(page).locator('#term-konnektom')).toContainText('Başka biçimler: connectome')
  await expect(main(page).locator('#term-sinaps')).toContainText('Başka biçimler: sinaptik')
  // An alias that only repeats the title is not shown a second time.
  await expect(main(page).locator('#term-noron').getByText('Başka biçimler')).toHaveCount(0)
})
