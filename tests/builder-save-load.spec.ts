import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { presetById, runDraft } from '../src/learning/circuitBuilder'
import { circuitFileText, parseCircuitFile } from '../src/learning/circuitFile'
import {
  DRAFT_STORAGE_KEY, addLink, cellCount, circuitOnPage, expectNoBrowserErrors, language, linkRows, loadMotif, metric, openBuilder, removeLink, resetButton, run,
  setRange, status, stimulusTarget, storedDraft, strength,
} from './support/builder'
import { main } from './support/ui'

test.beforeEach(async ({ page }) => { await openBuilder(page) })
test.afterEach(async ({ page }) => { await expectNoBrowserErrors(page) })

const notice = (page: Page) => main(page).getByTestId('builder-restored')
const startBlank = (page: Page) => main(page).getByTestId('builder-start-blank')
const saveButton = (page: Page) => main(page).getByRole('button', { name: 'Devreyi dosyaya kaydet', exact: true })
const fileInput = (page: Page) => main(page).getByLabel('Dosyadan yükle', { exact: true })
const fileStatus = (page: Page) => main(page).getByTestId('builder-file-status')
const fileError = (page: Page) => main(page).getByTestId('builder-file-error')
const choose = (page: Page, text: string, name = 'devre.json') => fileInput(page).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') })
const blank = { cells: '3', target: 'A', amplitude: '0.8', onset: '100', pulse: '200', links: [] as string[] }

async function download(page: Page): Promise<{ name: string; text: string }> {
  const pending = page.waitForEvent('download')
  await saveButton(page).click()
  const file = await pending
  const path = await file.path()
  expect(path).not.toBeNull()
  return { name: file.suggestedFilename(), text: await readFile(path!, 'utf8') }
}

test('with empty storage the page opens as before and keeps nothing until the circuit changes', async ({ page }) => {
  await expect(notice(page)).toHaveCount(0)
  expect(await circuitOnPage(page)).toEqual(blank)
  await expect(status(page)).toBeEmpty()
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  expect(await storedDraft(page)).toBeNull()
  // Running the untouched blank circuit is not a change of the circuit.
  await run(page)
  expect(await storedDraft(page)).toBeNull()
  await page.reload()
  await expect(notice(page)).toHaveCount(0)
})

test('the circuit is kept as it is edited, restored after a reload, and the blank button clears it', async ({ page }) => {
  await loadMotif(page, 'divergence').click()
  await setRange(strength(page, 2), 0.35)
  await cellCount(page).selectOption('4')
  await stimulusTarget(page).selectOption('D')
  await setRange(main(page).locator('#builder-onset'), 60)
  await addLink(page).click()
  await linkRows(page).nth(2).locator('select').first().selectOption('gap')
  await run(page)
  const edited = await circuitOnPage(page)
  expect(edited.links).toEqual(['excitatory A B 0.9', 'excitatory A C 0.35', 'gap A D 0.8'])
  await expect.poll(async () => parseCircuitFile((await storedDraft(page)) ?? '').ok).toBe(true)
  const kept = JSON.parse((await storedDraft(page))!)
  expect(kept).toEqual({
    app: 'Circuitiary', format: 'circuitiary-builder-circuit', schemaVersion: 1,
    draft: {
      cellCount: 4,
      links: [{ type: 'excitatory', source: 'A', target: 'B', strength: 0.9 }, { type: 'excitatory', source: 'A', target: 'C', strength: 0.35 }, { type: 'gap', source: 'A', target: 'D', strength: 0.8 }],
      stimulus: { target: 'D', amplitude: 0.8, onsetMs: 60, durationMs: 200 },
    },
  })

  await page.reload()
  await expect(notice(page)).toBeVisible()
  await expect(notice(page)).toHaveAttribute('data-state', 'restored')
  await expect(notice(page).getByRole('status')).toHaveText('Bu tarayıcıda saklanan son devren geri yüklendi. Sonuçlar saklanmaz; görmek için çalıştır.')
  expect(await circuitOnPage(page)).toEqual(edited)
  await expect(linkRows(page).nth(2)).toContainText('A ↔ D elektriksel')
  // Results are not kept: nothing is shown until the restored circuit is run, and then it runs like any other.
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  await expect(main(page).getByTestId('builder-preset-note')).toHaveCount(0)
  await run(page)
  expect(await metric(page, 'peak', 'A')).toBeGreaterThan(0.1)
  // A restored circuit can be edited like any other: the new connection gets its own controls.
  await addLink(page).click()
  await expect(linkRows(page)).toHaveCount(4)
  await removeLink(page, 4).click()

  await startBlank(page).click()
  expect(await circuitOnPage(page)).toEqual(blank)
  await expect(notice(page)).toHaveAttribute('data-state', 'blank')
  await expect(notice(page).getByRole('status')).toHaveText('Boş devreyle başlandı: 3 hücre, bağlantı yok. Tarayıcıda saklanan devre silindi.')
  await expect(startBlank(page)).toHaveCount(0)
  await expect(cellCount(page)).toBeFocused()
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  expect(await storedDraft(page)).toBeNull()
  await page.reload()
  await expect(notice(page)).toHaveCount(0)
  expect(await circuitOnPage(page)).toEqual(blank)
})

test('Sıfırla and loading an example replace the kept circuit too', async ({ page }) => {
  await loadMotif(page, 'loop').click()
  await expect.poll(() => storedDraft(page)).not.toBeNull()
  await page.reload()
  await expect(notice(page)).toBeVisible()
  await expect(linkRows(page)).toHaveCount(3)
  // Another example: the notice about the restored circuit no longer describes what is on the page.
  await loadMotif(page, 'electrical-pair').click()
  await expect(notice(page)).toHaveCount(0)
  await expect.poll(async () => JSON.parse((await storedDraft(page)) ?? '{"draft":{}}').draft.cellCount).toBe(2)
  await resetButton(page).click()
  await expect(status(page)).toContainText('Devre sıfırlandı')
  await expect.poll(() => storedDraft(page)).toBeNull()
  await page.reload()
  await expect(notice(page)).toHaveCount(0)
})

test('a circuit with a problem is not kept: the last valid one comes back', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  // A new connection is A→C: still a valid circuit, and kept.
  await addLink(page).click()
  await expect.poll(async () => JSON.parse((await storedDraft(page)) ?? '{"draft":{"links":[]}}').draft.links.length).toBe(3)
  const valid = await storedDraft(page)
  // Turned into a second A→B connection it makes the circuit invalid: that state is not written.
  await linkRows(page).nth(2).locator('select').nth(2).selectOption('B')
  await expect(main(page).getByTestId('builder-validity')).toHaveAttribute('data-valid', 'false')
  await setRange(strength(page, 1), 0.3)
  await expect(strength(page, 1)).toHaveAttribute('aria-valuetext', '0,30')
  expect(await storedDraft(page)).toBe(valid)
  await page.reload()
  await expect(notice(page)).toBeVisible()
  expect((await circuitOnPage(page)).links).toEqual(['excitatory A B 0.9', 'excitatory B C 0.9', 'excitatory A C 0.8'])
  await expect(main(page).getByTestId('builder-validity')).toHaveAttribute('data-valid', 'true')
})

test('garbage in storage is ignored silently and the page opens with the blank circuit', async ({ page }) => {
  const valid = circuitFileText(presetById('chain').draft)
  const garbage = [
    'çöp', '', 'null', '[1,2,3]', '{"cellCount":3,"links":[]}',
    valid.replace('"schemaVersion": 1', '"schemaVersion": 7'),
    valid.replace('"strength": 0.9', '"strength": 9'),
    valid.replace('"cellCount": 3', '"cellCount": 3, "extra": "<img src=x onerror=alert(1)>"'),
    valid.replace('"target": "A"', '"target": "Z"'),
    `${valid}${' '.repeat(5000)}`,
  ]
  for (const value of garbage) {
    await page.evaluate(([key, text]) => localStorage.setItem(key!, text!), [DRAFT_STORAGE_KEY, value])
    await page.reload()
    await expect(main(page)).toHaveAttribute('id', 'circuit-builder')
    await expect(notice(page), value.slice(0, 40)).toHaveCount(0)
    expect(await circuitOnPage(page), value.slice(0, 40)).toEqual(blank)
    await expect(main(page).getByTestId('builder-file-error')).toHaveCount(0)
    await expect(status(page)).toBeEmpty()
  }
  // The page still works, and the next change replaces the garbage.
  await run(page)
  await loadMotif(page, 'chain').click()
  await expect.poll(() => storedDraft(page)).toBe(valid)
})

test('the page works when storage refuses every call', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    const refuse = () => { throw new DOMException('denied', 'SecurityError') }
    Object.defineProperty(window, 'localStorage', { configurable: true, get: refuse })
  })
  const page = await context.newPage()
  await openBuilder(page)
  await expect(notice(page)).toHaveCount(0)
  await loadMotif(page, 'convergence').click()
  await run(page)
  expect(await metric(page, 'peak', 'D')).toBeGreaterThan(0.6)
  await page.reload()
  await expect(notice(page)).toHaveCount(0)
  await expect(linkRows(page)).toHaveCount(0)
  await expectNoBrowserErrors(page)
  await context.close()
})

test('“Devreyi dosyaya kaydet” downloads the circuit alone, with the schema version and the app name', async ({ page }) => {
  await loadMotif(page, 'disinhibition').click()
  await setRange(main(page).locator('#builder-amplitude'), 0.65)
  await run(page)
  const file = await download(page)
  expect(file.name).toBe('circuitiary-devre.json')
  await expect(fileStatus(page)).toHaveText('İndirme başlatıldı: circuitiary-devre.json.')
  const record = JSON.parse(file.text)
  expect(Object.keys(record)).toEqual(['app', 'format', 'schemaVersion', 'draft'])
  expect(record).toEqual({
    app: 'Circuitiary', format: 'circuitiary-builder-circuit', schemaVersion: 1,
    draft: {
      cellCount: 4,
      links: [
        { type: 'excitatory', source: 'A', target: 'B', strength: 0.9 }, { type: 'excitatory', source: 'A', target: 'C', strength: 0.9 },
        { type: 'inhibitory', source: 'B', target: 'C', strength: 0.9 }, { type: 'excitatory', source: 'A', target: 'D', strength: 0.9 },
        { type: 'inhibitory', source: 'D', target: 'B', strength: 1.5 },
      ],
      stimulus: { target: 'A', amplitude: 0.65, onsetMs: 100, durationMs: 200 },
    },
  })
  // No result, although one is on screen.
  expect(file.text).not.toMatch(/activity|timesMs|peak|result/)
  expect(file.text.length).toBeLessThan(1500)
  // Nothing about the circuit is put in the address bar.
  expect(new URL(page.url()).search).toBe('')
  expect(new URL(page.url()).hash).toBe('')

  // The file reads back: after a reset, loading it restores exactly the same circuit.
  const before = await circuitOnPage(page)
  await resetButton(page).click()
  await choose(page, file.text, file.name)
  await expect(fileStatus(page)).toHaveText('Dosyadaki devre yüklendi. Önceki sonuç temizlendi; istersen değiştir, sonra çalıştır.')
  expect(await circuitOnPage(page)).toEqual(before)
})

test('a circuit with a problem is not written to a file, and the page says why', async ({ page }) => {
  await addLink(page).click()
  await linkRows(page).first().locator('select').first().selectOption('gap')
  await linkRows(page).first().locator('select').nth(2).selectOption('A')
  await expect(main(page).getByTestId('builder-validity')).toHaveAttribute('data-valid', 'false')
  let downloads = 0
  page.on('download', () => { downloads += 1 })
  await saveButton(page).click()
  await expect(fileError(page)).toHaveAttribute('data-code', 'save-blocked')
  await expect(fileError(page)).toHaveAttribute('role', 'alert')
  await expect(fileError(page)).toHaveText('Devre dosyaya kaydedilmedi: devrede sorun var. Önce “3. Çalıştır” bölümünde listelenen sorunları gider.')
  await expect(fileStatus(page)).toBeEmpty()
  expect(downloads).toBe(0)
  // Once the problem is fixed the same button saves, and the alert goes.
  await linkRows(page).first().locator('select').nth(2).selectOption('B')
  await download(page)
  await expect(fileError(page)).toHaveCount(0)
})

test('“Dosyadan yükle” reads a valid file, clears the old result, and the loaded circuit runs', async ({ page }) => {
  await loadMotif(page, 'loop').click()
  await run(page)
  const circuit = presetById('feedback-inhibition').draft
  await choose(page, circuitFileText(circuit))
  await expect(fileError(page)).toHaveCount(0)
  await expect(fileStatus(page)).toHaveText('Dosyadaki devre yüklendi. Önceki sonuç temizlendi; istersen değiştir, sonra çalıştır.')
  expect(await circuitOnPage(page)).toEqual({ cells: '2', target: 'A', amplitude: '0.8', onset: '100', pulse: '200', links: ['excitatory A B 1.5', 'inhibitory B A 1.5'] })
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  await expect(main(page).getByTestId('builder-preset-note')).toHaveCount(0)
  await run(page)
  const expected = runDraft(circuit)
  if (!expected.ok) throw new Error('The motif does not run')
  for (const cell of expected.run.cells) expect(await metric(page, 'peak', cell.id)).toBeCloseTo(cell.peak, 12)
  // The loaded circuit is the kept one now, and its controls work: a strength changes, a connection goes.
  await expect.poll(async () => JSON.parse((await storedDraft(page)) ?? '{"draft":{}}').draft.cellCount).toBe(2)
  await setRange(strength(page, 1), 1)
  await removeLink(page, 2).click()
  await expect(linkRows(page)).toHaveCount(1)
  // The same file can be chosen again straight away.
  await choose(page, circuitFileText(circuit))
  await expect(linkRows(page)).toHaveCount(2)
  // A hand-written file with other spacing and key order is the same circuit.
  await choose(page, '{"draft":{"stimulus":{"durationMs":120,"onsetMs":0,"amplitude":1,"target":"C"},"links":[{"strength":0.5,"target":"A","source":"C","type":"gap"}],"cellCount":3},"schemaVersion":1,"format":"circuitiary-builder-circuit","app":"Circuitiary"}')
  expect(await circuitOnPage(page)).toEqual({ cells: '3', target: 'C', amplitude: '1', onset: '0', pulse: '120', links: ['gap C A 0.5'] })
  await expect(linkRows(page).first()).toContainText('A ↔ C elektriksel')
})

test('every kind of invalid file is refused with its own message and the circuit stays as it was', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  await setRange(strength(page, 2), 0.4)
  await run(page)
  const before = await circuitOnPage(page)
  await expect.poll(async () => JSON.parse((await storedDraft(page)) ?? '{"draft":{"links":[]}}').draft.links[1]?.strength).toBe(0.4)
  const keptBefore = await storedDraft(page)
  const peakBefore = await metric(page, 'peak', 'C')

  const valid = circuitFileText(presetById('disinhibition').draft)
  const cases: Array<{ name: string; text: string; code: string; says: string }> = [
    { name: 'too large', text: `${valid}${' '.repeat(4096)}`, code: 'too-large', says: 'Dosya çok büyük. Bir devre dosyası en fazla 4096 bayt olabilir' },
    { name: 'not JSON', text: valid.slice(0, -4), code: 'not-json', says: 'Dosya geçerli bir JSON metni değil.' },
    { name: 'a script instead of data', text: 'alert(document.cookie)', code: 'not-json', says: 'Dosya geçerli bir JSON metni değil.' },
    { name: 'not an object', text: `[${valid}]`, code: 'not-object', says: 'en dışta bir JSON nesnesi olmalı' },
    { name: 'another file of the app', text: '{"format":"circuitiary-output-series","formatVersion":1,"app":{"name":"Circuitiary","version":"0.1.0"}}', code: 'not-circuit-file', says: 'Bu bir Circuitiary devre dosyası değil' },
    { name: 'wrong schema version', text: valid.replace('"schemaVersion": 1', '"schemaVersion": 2'), code: 'schema-version', says: 'Dosyanın şema sürümü 2; bu sayfa yalnız sürüm 1 dosyalarını okur.' },
    { name: 'missing schema version', text: valid.replace('"schemaVersion": 1,', ''), code: 'schema-version', says: 'Dosyada geçerli bir şema sürümü (“schemaVersion”) yok.' },
    { name: 'unknown key', text: valid.replace('"cellCount": 4', '"cellCount": 4, "results": [1]'), code: 'unknown-key', says: 'Dosyada tanınmayan bir alan var: “draft.results”.' },
    { name: 'unknown key with markup in its name', text: valid.replace('"cellCount": 4', '"cellCount": 4, "<b id=injected>x</b>": 1'), code: 'unknown-key', says: '“draft.<b id=injected>x</b>”' },
    { name: 'missing key', text: valid.replace('"amplitude": 0.8,', ''), code: 'missing-key', says: 'Dosyada gerekli bir alan eksik: “draft.stimulus.amplitude”.' },
    { name: 'wrong type', text: valid.replace('"cellCount": 4', '"cellCount": "4"'), code: 'wrong-type', says: '“draft.cellCount” alanı bir sayı olmalı.' },
    { name: 'links not a list', text: valid.replace(/"links": \[[\s\S]*\],\n {4}"stimulus"/, '"links": {},\n    "stimulus"'), code: 'wrong-type', says: '“draft.links” alanı bir liste olmalı.' },
    { name: 'cell outside A–F', text: valid.replace('"target": "D"', '"target": "K"'), code: 'bad-cell', says: '“draft.links[3].target” alanı bir hücre harfi olmalı (A–F).' },
    { name: 'unknown connection type', text: valid.replace('"type": "inhibitory"', '"type": "modulatory"'), code: 'bad-link-type', says: '“draft.links[2].type” alanı şu türlerden biri olmalı: excitatory, inhibitory, gap.' },
    { name: 'strength out of range', text: valid.replace('"strength": 1.5', '"strength": 2.5'), code: 'invalid-circuit', says: 'Dosyadaki devre geçerli değil. Bağlantı 5: güç 0,05–2 aralığında olmalı.' },
    { name: 'amplitude out of range', text: valid.replace('"amplitude": 0.8', '"amplitude": 1.8'), code: 'invalid-circuit', says: 'Uyaran genliği 0–1 arasında olmalı.' },
    { name: 'cell count out of range', text: valid.replace('"cellCount": 4', '"cellCount": 9'), code: 'invalid-circuit', says: 'Hücre sayısı 2–6 arasında olmalı.' },
    { name: 'connection to a cell outside the circuit', text: valid.replace('"cellCount": 4', '"cellCount": 3'), code: 'invalid-circuit', says: 'Bağlantı 4: devrede olmayan bir hücreye bağlı.' },
    { name: 'duplicate connection', text: valid.replace('"target": "C",\n        "strength": 0.9', '"target": "B",\n        "strength": 0.9'), code: 'invalid-circuit', says: 'A→B için kimyasal bağlantı zaten var (Bağlantı 1)' },
    { name: 'value between slider steps', text: valid.replace('"strength": 1.5', '"strength": 1.52'), code: 'off-step', says: '“draft.links[4].strength” değeri sayfadaki kaydırıcının adımlarına uymuyor; adım 0,05.' },
  ]
  expect(new Set(cases.map(item => item.code)).size).toBe(12)
  for (const item of cases) {
    expect(item.text, `${item.name}: the case must differ from the valid file`).not.toBe(valid)
    await choose(page, item.text)
    await expect(fileError(page), item.name).toHaveAttribute('data-code', item.code)
    await expect(fileError(page)).toHaveAttribute('role', 'alert')
    await expect(fileError(page).locator('p').first()).toHaveText('Dosya yüklenmedi; şu anki devre değişmedi.')
    await expect(fileError(page), item.name).toContainText(item.says)
    await expect(fileStatus(page)).toBeEmpty()
    // Nothing moved: the controls, the kept circuit, the result on screen.
    expect(await circuitOnPage(page), item.name).toEqual(before)
    expect(await storedDraft(page), item.name).toBe(keptBefore)
    await expect(main(page).getByTestId('builder-result')).toHaveAttribute('data-stale', 'false')
    expect(await metric(page, 'peak', 'C')).toBe(peakBefore)
  }
  // File content is shown as text only: the markup in a key name made no element.
  await choose(page, cases[8]!.text)
  await expect(fileError(page)).toHaveAttribute('data-code', 'unknown-key')
  expect(await page.locator('#injected').count()).toBe(0)
  // No raw exception text reaches the learner.
  await expect(main(page)).not.toContainText(/SyntaxError|Unexpected token|undefined|NaN/)
  // A valid file afterwards loads and clears the alert.
  await choose(page, valid)
  await expect(fileError(page)).toHaveCount(0)
  await expect(linkRows(page)).toHaveCount(5)
})

test('the file input is labelled, reached with Tab and opened with the keyboard', async ({ page }) => {
  const input = fileInput(page)
  await expect(input).toHaveAttribute('type', 'file')
  await expect(input).toHaveAttribute('id', 'builder-file')
  await expect(main(page).locator('label[for="builder-file"]')).toHaveText('Dosyadan yükle')
  await saveButton(page).focus()
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  // The visible label shows the focus ring of the hidden input, and is a 44 px target.
  const label = main(page).locator('label[for="builder-file"]')
  expect(await label.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
  const box = (await label.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(43.5)
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  const opened = await chooser
  expect(opened.isMultiple()).toBe(false)
  await opened.setFiles({ name: 'devre.json', mimeType: 'application/json', buffer: Buffer.from(circuitFileText(presetById('chain').draft), 'utf8') })
  await expect(linkRows(page)).toHaveCount(2)
  // Clicking the label opens the same chooser.
  const again = page.waitForEvent('filechooser')
  await label.click()
  await again
})

test('keeping, saving and loading are English after switching the language', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  await expect.poll(() => storedDraft(page)).not.toBeNull()
  await choose(page, '{"app":"Circuitiary"}')
  await expect(fileError(page)).toContainText('Bu bir Circuitiary devre dosyası değil')
  await language(page).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  // The refusal already on screen is written again in English.
  await expect(fileError(page).locator('p')).toHaveText(['The file was not loaded; the current circuit is unchanged.', 'This is not a Circuitiary circuit file: the “app” and “format” fields do not hold the expected values.'])
  await expect(main(page).getByRole('heading', { level: 2, name: 'Keep the circuit', exact: true })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Save the circuit to a file', exact: true })).toBeVisible()
  const input = main(page).getByLabel('Load from a file', { exact: true })
  await input.setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(circuitFileText(presetById('chain').draft).replace('"strength": 0.9', '"strength": 0.93'), 'utf8') })
  await expect(fileError(page)).toContainText('The “draft.links[0].strength” value does not fit the steps of the slider on the page; the step is 0.05.')
  await input.setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(circuitFileText(presetById('electrical-pair').draft), 'utf8') })
  await expect(fileStatus(page)).toHaveText('The circuit in the file was loaded. The previous result was cleared; change it if you like, then run it.')
  const pending = page.waitForEvent('download')
  await main(page).getByRole('button', { name: 'Save the circuit to a file', exact: true }).click()
  // The file name and the file's keys are the same in both languages.
  expect((await pending).suggestedFilename()).toBe('circuitiary-devre.json')
  await expect(fileStatus(page)).toHaveText('The download was started: circuitiary-devre.json.')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(notice(page).getByRole('status')).toHaveText('The last circuit kept in this browser was restored. Results are not kept; run it to see them.')
  await expect(linkRows(page)).toHaveCount(1)
  await language(page).selectOption('tr')
  await expect(notice(page).getByRole('status')).toHaveText('Bu tarayıcıda saklanan son devren geri yüklendi. Sonuçlar saklanmaz; görmek için çalıştır.')
  await main(page).getByRole('button', { name: 'Boş devreyle başla', exact: true }).click()
  await language(page).selectOption('en')
  await expect(notice(page).getByRole('status')).toHaveText('Started from the blank circuit: 3 cells, no connections. The circuit kept in the browser was deleted.')
  expect(await main(page).locator('section[aria-labelledby="builder-keep-title"]').innerText()).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
})
