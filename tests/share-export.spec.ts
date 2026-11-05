import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { dtChoices, numberRanges } from '../src/shareState'
import { cell, cells, experimentUi, expectNoHorizontalOverflow, view } from './support/ui'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const conditions = ['baseline', 'silenced', 'tau'] as const
const modeGroup = (page: Page) => page.getByRole('group', { name: 'Devre modu', exact: true })
const realButton = (page: Page) => modeGroup(page).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true })
const toyButton = (page: Page) => modeGroup(page).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })
const outputPicker = (page: Page) => page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true })
const tools = (page: Page) => page.getByRole('region', { name: 'Paylaş ve dışa aktar', exact: true })
const copyButton = (page: Page) => tools(page).getByRole('button', { name: 'Bağlantıyı kopyala', exact: true })
const csvButton = (page: Page) => tools(page).getByRole('button', { name: /^CSV indir/ })
const jsonButton = (page: Page) => tools(page).getByRole('button', { name: /^JSON indir/ })
const notice = (page: Page) => page.getByTestId('share-notice')
const status = (page: Page) => page.getByTestId('share-status')
const shareUrl = (page: Page) => page.getByTestId('share-url').inputValue()
const conditionButton = (page: Page, name: string) => page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true }).getByRole('button', { name: new RegExp(name) })
const peaks = (page: Page) => Promise.all(conditions.map(id => page.getByTestId(`peak-${id}`).innerText()))
const comma = (value: number) => value.toFixed(3).replace('.', ',')

async function download(page: Page, click: () => Promise<void>): Promise<{ name: string; text: string }> {
  const pending = page.waitForEvent('download')
  await click()
  const file = await pending
  const path = await file.path()
  expect(path).not.toBeNull()
  return { name: file.suggestedFilename(), text: await readFile(path!, 'utf8') }
}

const parseCsv = (text: string): string[][] => {
  expect(text.endsWith('\n')).toBe(true)
  return text.slice(0, -1).split('\n').map(line => line.split(','))
}
const column = (rows: string[][], name: string): number[] => {
  const index = rows[0]!.indexOf(name)
  expect(index, `column ${name}`).toBeGreaterThan(0)
  return rows.slice(1).map(row => Number(row[index]))
}

/** Changes every kind of control that the link has to carry, in the example circuit. */
async function changeExample(page: Page) {
  await page.locator('#stimulus-target').selectOption('S2')
  await page.locator('#amplitude').fill('0.45')
  await page.locator('#duration').fill('150')
  await page.locator('#base-tau').fill('45')
  await page.locator('#changed-neuron').selectOption('I3')
  await page.locator('#changed-tau').fill('60')
  await page.locator('#silenced-edge').selectOption('I4-O1')
  await page.locator('#dt').selectOption('0.5')
  await outputPicker(page).selectOption('O2')
  await cell(page, 'I4').click()
  await conditionButton(page, 'Bağlantı susturuldu').click()
  await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
}

test.describe('share link', () => {
  test('copy button confirms in a status line, writes the link to the clipboard and leaves address bar and history alone', async ({ page }) => {
    // The system clipboard is shared with other browsers running at the same time, so the text handed to it is recorded instead of read back.
    await page.addInitScript(() => {
      const written: string[] = []
      ;(window as unknown as { __written: string[] }).__written = written
      const original = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = (text: string) => { written.push(text); return original(text) }
    })
    await page.goto('/')
    await changeExample(page)
    const address = page.url()
    const entries = await page.evaluate(() => window.history.length)
    await copyButton(page).click()
    await expect(status(page)).toHaveText('Bağlantı panoya kopyalandı.')
    await expect(page.getByRole('status').filter({ hasText: 'Bağlantı panoya kopyalandı.' })).toHaveCount(1)
    const link = await shareUrl(page)
    expect(await page.evaluate(() => (window as unknown as { __written: string[] }).__written)).toEqual([link])
    expect(page.url()).toBe(address)
    expect(await page.evaluate(() => window.history.length)).toBe(entries)
    const url = new URL(link)
    expect(url.origin + url.pathname).toBe(new URL('/', page.url()).href)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      m: 'illustrative', v: '2d', c: 'silenced', st: 'S2', am: '0.45', du: '150', tb: '45', tn: 'I3', tc: '60', se: 'I4-O1', o: 'O2', n: 'I4', dt: '0.5', sc: '1',
    })
  })

  test('the copy button works from the keyboard', async ({ page }) => {
    await page.goto('/')
    await copyButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(status(page)).toHaveText('Bağlantı panoya kopyalandı.')
  })

  test('the link follows the controls and the field is read-only', async ({ page }) => {
    await page.goto('/')
    const before = await shareUrl(page)
    await page.locator('#amplitude').fill('0.35')
    const after = await shareUrl(page)
    expect(new URL(before).searchParams.get('am')).toBe('0.8')
    expect(new URL(after).searchParams.get('am')).toBe('0.35')
    await expect(page.getByTestId('share-url')).toHaveAttribute('readonly', '')
    await expect(tools(page).getByLabel('Paylaşım bağlantısı', { exact: true })).toHaveCount(1)
  })

  test('opening the copied link reproduces the same peaks and controls and says so', async ({ page, context }) => {
    await page.goto('/')
    const defaults = await peaks(page)
    await changeExample(page)
    const expected = await peaks(page)
    expect(expected).not.toEqual(defaults)
    await copyButton(page).click()
    const link = await shareUrl(page)

    const other = await context.newPage()
    await other.goto(link)
    await expect(notice(other)).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(notice(other)).toHaveAttribute('role', 'status')
    expect(await peaks(other)).toEqual(expected)
    expect(await experimentUi(other)).toEqual(await experimentUi(page))
    expect(await shareUrl(other)).toBe(link)
    await expect(other.locator('.route-notice')).toHaveCount(0)
    expect(other.url()).toBe(link)
  })

  test('the 3D view and every time step come through a link', async ({ page }) => {
    await page.goto('/?v=3d&dt=0.0625&c=tau')
    await expect(view(page, '3D')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#dt')).toHaveValue('0.0625')
    await expect(conditionButton(page, 'Zaman sabiti değişti')).toHaveAttribute('aria-pressed', 'true')
  })

  test('invalid, unknown-cell and repeated parts are ignored and named, valid parts still apply', async ({ page }) => {
    await page.goto('/?du=250&am=9&o=ZZ&st=S2&tb=7&c=nope&m=wat&sc=1&sc=0&utm_source=mail')
    await expect(notice(page)).toContainText('Bağlantıdaki ayarlar uygulandı.')
    for (const name of ['Uyaran gücü', 'Okunan hücre', 'Referans zaman sabiti', 'Gösterilen koşul', 'Devre modu', 'Yanıta göre dikey ölçek']) await expect(notice(page)).toContainText(name)
    await expect(notice(page)).not.toContainText('Uyaran süresi')
    await expect(page.locator('#duration')).toHaveValue('250')
    await expect(page.locator('#stimulus-target')).toHaveValue('S2')
    await expect(page.locator('#amplitude')).toHaveValue('0.8')
    await expect(page.locator('#base-tau')).toHaveValue('30')
    await expect(outputPicker(page)).toHaveValue('O1')
    await expect(page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true })).not.toBeChecked()
    await expect(cells(page).getByRole('button')).toHaveCount(8)
    await expect(page.getByTestId('peak-baseline')).not.toHaveText('')
  })

  test('a link with nothing usable falls back to the default experiment and says so', async ({ page }) => {
    await page.goto('/?am=7&dt=3')
    await expect(notice(page)).toContainText('Bağlantıda geçerli ayar bulunamadı')
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  })

  test('an address without our keys shows no notice, and a query never triggers the unknown-address notice', async ({ page }) => {
    for (const path of ['/', '/?foo=bar', '/?utm_source=mail&utm_medium=x', '/?m=illustrative&am=0.4', '/?am=0.4#top']) {
      await page.goto(path)
      await expect(page.locator('.route-notice'), path).toHaveCount(0)
    }
    await page.goto('/?foo=bar')
    await expect(notice(page)).toBeEmpty()
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
    await page.goto('/bilinmeyen-adres?am=0.4')
    await expect(page.locator('.route-notice')).toContainText('/bilinmeyen-adres')
  })

  test('another page keeps its own query: the link is read only on the experiment page', async ({ page }) => {
    await page.goto('/ogren/turler-atlasi?am=0.4&m=real')
    await page.getByRole('navigation', { name: 'Öğrenme ve deneyler', exact: true }).getByRole('link', { name: 'Devre deneyleri', exact: true }).click()
    await expect(page.locator('#amplitude')).toHaveValue('0.8')
    await expect(notice(page)).toBeEmpty()
  })

  test('the slider ranges and time steps the link accepts are the ones the page offers', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
    await expect(page.locator('#chemical-gain')).toBeVisible()
    const ids = { amplitude: 'amplitude', pulseDuration: 'duration', baseTau: 'base-tau', changedTau: 'changed-tau', chemicalGain: 'chemical-gain', gapGain: 'gap-gain' } as const
    for (const [field, id] of Object.entries(ids) as [keyof typeof ids, string][]) {
      const attributes = await page.locator(`#${id}`).evaluate(input => ({ min: input.getAttribute('min'), max: input.getAttribute('max'), step: input.getAttribute('step') }))
      expect(attributes, id).toEqual({ min: String(numberRanges[field].min), max: String(numberRanges[field].max), step: String(numberRanges[field].step) })
    }
    const options = await page.locator('#dt option').evaluateAll(list => list.map(option => Number((option as HTMLOptionElement).value)))
    expect(options).toEqual([...dtChoices])
  })
})

test.describe('status lines', () => {
  test('both live regions are in the page and empty before their text arrives, so screen readers announce it', async ({ page }) => {
    await page.addInitScript(() => {
      const first: string[] = []
      ;(window as unknown as { __noticeFirst: string[] }).__noticeFirst = first
      new MutationObserver(() => {
        const line = document.querySelector('[data-testid="share-notice"]')
        if (line && first.length === 0) first.push(line.textContent ?? '')
      }).observe(document, { childList: true, subtree: true })
    })
    await page.goto('/?am=0.4')
    await expect(notice(page)).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    expect(await page.evaluate(() => (window as unknown as { __noticeFirst: string[] }).__noticeFirst)).toEqual([''])
    await page.goto('/')
    for (const line of [notice(page), status(page)]) {
      await expect(line).toBeEmpty()
      await expect(line).toHaveCSS('height', '0px')
      expect(await line.evaluate(element => getComputedStyle(element).display)).not.toBe('none')
    }
  })
})

test.describe('copy fallback', () => {
  const noClipboard = () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const copied: string[] = []
    ;(window as unknown as { __copied: string[] }).__copied = copied
    document.addEventListener('copy', () => {
      const field = document.activeElement as HTMLInputElement
      copied.push(field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0))
    })
  }

  test('selects the read-only field and copies from it when the clipboard API is missing', async ({ page }) => {
    await page.addInitScript(noClipboard)
    await page.goto('/')
    await copyButton(page).click()
    await expect(status(page)).toHaveText('Bağlantı panoya kopyalandı.')
    const link = await shareUrl(page)
    expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual([link])
    expect(await page.getByTestId('share-url').evaluate((input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0))).toBe(link)
  })

  test('says so and leaves the link selected when nothing can copy', async ({ page }) => {
    await page.addInitScript(noClipboard)
    await page.addInitScript(() => { document.execCommand = () => false })
    await page.goto('/')
    await copyButton(page).click()
    await expect(status(page)).toContainText('otomatik kopyalanamadı')
    await expect(status(page)).toContainText('elle kopyalayabilirsin')
    const link = await shareUrl(page)
    expect(await page.getByTestId('share-url').evaluate((input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0))).toBe(link)
  })
})

test.describe('exports', () => {
  test('CSV has time_ms and one column per cell for the condition shown, with dot decimals', async ({ page }) => {
    await page.goto('/')
    const baseline = await download(page, () => csvButton(page).click())
    expect(baseline.name).toBe('circuitiary-sekiz-hucreli-referans.csv')
    const rows = parseCsv(baseline.text)
    expect(rows[0]).toEqual(['time_ms', 'S1', 'S2', 'I1', 'I2', 'I3', 'I4', 'O1', 'O2'])
    expect(rows).toHaveLength(702)
    expect(rows.every(row => row.length === 9)).toBe(true)
    expect(rows.slice(1).map(row => row[0])).toEqual(Array.from({ length: 701 }, (_, index) => String(index)))
    expect(rows.slice(1).every(row => row.every(value => /^\d+(\.\d+)?$/.test(value)))).toBe(true)
    expect(comma(Math.max(...column(rows, 'O1')))).toBe(await page.getByTestId('peak-baseline').innerText())
    // Row 251 is the moment the page shows at the default cursor (250 ms): every cell column matches its button.
    for (const id of rows[0]!.slice(1)) {
      await expect(cell(page, id).locator('small')).toHaveText(Number(rows[251]![rows[0]!.indexOf(id)]).toFixed(2).replace('.', ','))
    }

    await conditionButton(page, 'Bağlantı susturuldu').click()
    const silenced = await download(page, () => csvButton(page).click())
    expect(silenced.name).toBe('circuitiary-sekiz-hucreli-baglanti-susturuldu.csv')
    expect(comma(Math.max(...column(parseCsv(silenced.text), 'O1')))).toBe(await page.getByTestId('peak-silenced').innerText())
    expect(silenced.text).not.toBe(baseline.text)

    await conditionButton(page, 'Zaman sabiti değişti').click()
    const tau = await download(page, () => csvButton(page).click())
    expect(tau.name).toBe('circuitiary-sekiz-hucreli-zaman-sabiti-degisti.csv')
    expect(comma(Math.max(...column(parseCsv(tau.text), 'O1')))).toBe(await page.getByTestId('peak-tau').innerText())
  })

  test('CSV follows the time step', async ({ page }) => {
    await page.goto('/')
    await page.locator('#dt').selectOption('0.5')
    const rows = parseCsv((await download(page, () => csvButton(page).click())).text)
    expect(rows).toHaveLength(1402)
    expect(rows[1]![0]).toBe('0')
    expect(rows[2]![0]).toBe('0.5')
    expect(rows[1401]![0]).toBe('700')
  })

  test('JSON carries settings, the output cell under all three conditions, version and the honest note', async ({ page }) => {
    await page.goto('/')
    await changeExample(page)
    const file = await download(page, () => jsonButton(page).click())
    expect(file.name).toBe('circuitiary-sekiz-hucreli-O2-uc-kosul.json')
    const record = JSON.parse(file.text)
    expect(record.format).toBe('circuitiary-output-series')
    expect(record.formatVersion).toBe(1)
    expect(record.app.name).toBe('Circuitiary')
    expect(record.app.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(record.note).toBe('Model çıktısı; ölçüm değildir')
    expect(record.mode).toBe('illustrative')
    expect(record.settings).toEqual({
      durationMs: 700, dtMs: 0.5, baseTauMs: 45,
      stimulus: { target: 'S2', onsetMs: 100, durationMs: 150, amplitude: 0.45 },
      silencedConnection: 'I4-O1', tauOverridesMs: { I3: 60 },
    })
    expect(record.output.cell).toBe('O2')
    expect(record.output.timesMs).toHaveLength(1401)
    expect(Object.keys(record.output.conditions)).toEqual([...conditions])
    for (const id of conditions) {
      const series: number[] = record.output.conditions[id].activity
      expect(series).toHaveLength(1401)
      expect(comma(Math.max(...series))).toBe(await page.getByTestId(`peak-${id}`).innerText())
      expect(comma(record.output.conditions[id].peak)).toBe(await page.getByTestId(`peak-${id}`).innerText())
    }
    expect(record.source).toBeUndefined()
    expect(file.text).not.toMatch(/AVAR|Cook2019 anatomik altgrafı ve/)
  })

  test('every download announces itself in the status line', async ({ page }) => {
    await page.goto('/')
    await download(page, () => csvButton(page).click())
    await expect(status(page)).toContainText('CSV dosyası hazırlandı, indirme başladı: circuitiary-sekiz-hucreli-referans.csv')
    await download(page, () => jsonButton(page).click())
    await expect(status(page)).toContainText('JSON dosyası hazırlandı, indirme başladı: circuitiary-sekiz-hucreli-O1-uc-kosul.json')
  })
})

test.describe('real data', () => {
  async function enterRealMode(page: Page) {
    const response = await page.request.get('/api/local-connectome')
    expect(response.ok(), 'Local importer output must be available in the Vite development server').toBe(true)
    await page.goto('/')
    await realButton(page).click()
    await expect(realButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
  }

  test('a real-data link reproduces the same peaks, gains and selections', async ({ page, context }) => {
    await enterRealMode(page)
    const values = await page.evaluate(() => {
      const second = (id: string) => (document.querySelectorAll(`#${id} option`)[2] as HTMLOptionElement).value
      return { stimulus: second('stimulus-target'), edge: second('silenced-edge'), changed: second('changed-neuron') }
    })
    await page.locator('#stimulus-target').selectOption(values.stimulus)
    await page.locator('#silenced-edge').selectOption(values.edge)
    await page.locator('#changed-neuron').selectOption(values.changed)
    await page.locator('#chemical-gain').fill('1.4')
    await page.locator('#gap-gain').fill('0.3')
    await page.locator('#amplitude').fill('0.9')
    await page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true }).uncheck()
    await conditionButton(page, 'Zaman sabiti değişti').click()
    const expected = await peaks(page)
    const link = await shareUrl(page)
    const query = new URL(link).searchParams
    expect(query.get('m')).toBe('real')
    expect(query.get('cg')).toBe('1.4')
    expect(query.get('gg')).toBe('0.3')
    expect(query.get('fc')).toBe('0')

    const other = await context.newPage()
    await other.goto(link)
    await expect(other.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
    await expect(notice(other)).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(realButton(other)).toHaveAttribute('aria-pressed', 'true')
    expect(await peaks(other)).toEqual(expected)
    expect(await experimentUi(other)).toEqual(await experimentUi(page))
  })

  test('without local data the link falls back to the example and says so', async ({ page }) => {
    await page.route('**/api/local-connectome', route => route.fulfill({ status: 404, body: 'yok' }))
    await page.goto('/?m=real&st=AVER&o=AVAR&n=AVER&se=x&cg=1.4&am=0.4&du=250')
    await expect(notice(page)).toContainText('yerel veri bu bilgisayarda yok')
    await expect(notice(page)).toContainText('sekiz hücreli örneğe')
    await expect(notice(page)).not.toContainText('Geçersiz olduğu için')
    await expect(toyButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(cells(page).getByRole('button')).toHaveCount(8)
    await expect(page.locator('#amplitude')).toHaveValue('0.4')
    await expect(page.locator('#duration')).toHaveValue('250')
    await expect(page.locator('#stimulus-target')).toHaveValue('S1')
    await expect(page.locator('.route-notice')).toHaveCount(0)
    await expect(page.getByTestId('peak-baseline')).not.toHaveText('')
  })

  test('exports name the real circuit and carry the source attribution the page shows, without the anatomy', async ({ page }) => {
    await enterRealMode(page)
    const csv = await download(page, () => csvButton(page).click())
    expect(csv.name).toBe('circuitiary-c-elegans-yerel-referans.csv')
    const rows = parseCsv(csv.text)
    const cellCount = await cells(page).getByRole('button').count()
    expect(cellCount).toBeGreaterThan(8)
    expect(rows[0]).toHaveLength(cellCount + 1)
    expect(rows[0]).toContain('AVAR')

    const file = await download(page, () => jsonButton(page).click())
    expect(file.name).toBe('circuitiary-c-elegans-yerel-AVAR-uc-kosul.json')
    const record = JSON.parse(file.text)
    expect(record.mode).toBe('real')
    expect(record.note).toBe('Model çıktısı; ölçüm değildir')
    expect(record.scope).toContain('Cook2019')
    expect(record.settings.chemicalGain).toBe(0.8)
    expect(record.settings.gapGain).toBe(0.2)
    const shown = (await page.locator('.provenance-details code').evaluateAll(list => list.map(code => code.textContent ?? ''))).map(text => text.replace(/^SHA-256\s+/, ''))
    expect(shown.length).toBeGreaterThan(0)
    expect(record.source.files.map((source: { sha256: string }) => source.sha256)).toEqual(shown)
    expect(record.source.dataset.doi).toBeTruthy()
    expect(record.source.license.status).toBe('unverified-local-only')
    expect(record.source.statement).toContain('yalnız yerel kullanım')
    expect(file.text).not.toContain('rawWeight')
    expect(file.text).not.toContain('sourceRef')
    for (const id of conditions) expect(comma(record.output.conditions[id].peak)).toBe(await page.getByTestId(`peak-${id}`).innerText())
  })
})

test('the panel fits the screen, has 44 px targets and a visible heading', async ({ page }) => {
  await page.goto('/')
  await expect(tools(page)).toBeVisible()
  await expect(tools(page).getByRole('heading', { name: 'Deneyi taşı.', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  for (const target of [copyButton(page), csvButton(page), jsonButton(page), page.getByTestId('share-url')]) {
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  const order = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('main > section')].map(section => section.getAttribute('aria-label') ?? section.className)
    return sections.indexOf('Paylaş ve dışa aktar') - sections.indexOf('Hücre etkinlikleri ve seçilen hücre')
  })
  expect(order).toBe(-1)
})
