import { expect, test, type Locator, type Page } from '@playwright/test'
import { exportRecord } from './support/export'
import { cell, cells, experimentLink, experimentUi, expectNoHorizontalOverflow, main, navLabels, navLink, view } from './support/ui'

const atlasPath = '/ogren/turler-atlasi'
const neuronPath = '/ogren/norondan-devreye'
const guidedPath = '/ogren/rehberli-deneyler'
const readingPath = '/ogren/devreyi-okumak'
const assumptionsPath = '/ogren/gercek-veri-ve-varsayimlar'
const atlasLink = (page: Page) => navLink(page, navLabels.atlas)
const speciesFilter = (page: Page) => main(page).locator('#atlas-species-filter')
const recordSelect = (page: Page) => main(page).locator('#atlas-record-select')
const compareA = (page: Page) => main(page).locator('#atlas-compare-a')
const compareB = (page: Page) => main(page).locator('#atlas-compare-b')
const selectedRecord = (page: Page) => main(page).getByTestId('atlas-selected-record')
const comparison = (page: Page) => main(page).getByTestId('atlas-comparison')
const question = (page: Page, id: string) => main(page).locator(`fieldset[data-question-id="${id}"]`)
const defaults = { selected: 'circuitiary-subset30', left: 'circuitiary-subset30', right: 'flywire2024' } as const
const recordIds = ['circuitiary-subset30', 'cook2019-hermaphrodite', 'cook2019-male', 'drosophila-larva2023', 'hemibrain2020', 'flywire2024', 'male-cns2026']
interface ExpectedMetric { kind: 'neurons' | 'chemical' | 'gap'; value: number | null; unit: string; approximate: boolean }
interface ExpectedRecord {
  id: string
  species: string
  sex: string
  stage: string
  scope: string
  version: string
  metrics: ExpectedMetric[]
  primary: string
}
// These pinned expectations come from the original publications and official
// release pages, independently of speciesAtlas.ts and its comparison helpers.
// Cook: doi:10.1038/s41586-019-1352-7; larva: doi:10.1126/science.add9330;
// hemibrain: doi:10.7554/eLife.57443; FlyWire: doi:10.1038/s41586-024-07558-y;
// MaleCNS: doi:10.1016/j.cell.2026.08.015, male-cns.janelia.org v1.0.
const expectedRecords: ExpectedRecord[] = [
  { id: 'circuitiary-subset30', species: 'c-elegans', sex: 'Hermafrodit', stage: 'Erişkin', scope: 'Seçilmiş anatomik alt ağ', version: 'July 2020',
    metrics: [{ kind: 'neurons', value: 30, unit: 'neurons', approximate: false }, { kind: 'chemical', value: 196, unit: 'directed-neuron-pairs', approximate: false }, { kind: 'gap', value: 50, unit: 'physical-gap-pairs', approximate: false }],
    primary: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { id: 'cook2019-hermaphrodite', species: 'c-elegans', sex: 'Hermafrodit', stage: 'Erişkin', scope: 'Bütün hayvanın sinir sistemi', version: 'July 2020',
    metrics: [{ kind: 'neurons', value: 302, unit: 'neurons', approximate: false }, { kind: 'chemical', value: null, unit: 'serial-em-sections', approximate: false }, { kind: 'gap', value: null, unit: 'serial-em-sections', approximate: false }],
    primary: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { id: 'cook2019-male', species: 'c-elegans', sex: 'Erkek', stage: 'Erişkin', scope: 'Bütün hayvanın sinir sistemi', version: 'July 2020',
    metrics: [{ kind: 'neurons', value: 385, unit: 'neurons', approximate: false }, { kind: 'chemical', value: null, unit: 'serial-em-sections', approximate: false }, { kind: 'gap', value: null, unit: 'serial-em-sections', approximate: false }],
    primary: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { id: 'drosophila-larva2023', species: 'drosophila', sex: 'Dişi', stage: 'Birinci larva evresi', scope: 'Bütün larva beyni', version: '2023',
    metrics: [{ kind: 'neurons', value: 3016, unit: 'neurons', approximate: false }, { kind: 'chemical', value: 548_000, unit: 'synaptic-sites', approximate: true }],
    primary: 'https://doi.org/10.1126/science.add9330' },
  { id: 'hemibrain2020', species: 'drosophila', sex: 'Dişi', stage: 'Erişkin', scope: 'Kısmi merkez beyin', version: '2020',
    metrics: [{ kind: 'neurons', value: 25_000, unit: 'neurons', approximate: true }, { kind: 'chemical', value: 20_000_000, unit: 'chemical-synapses', approximate: true }],
    primary: 'https://doi.org/10.7554/eLife.57443' },
  { id: 'flywire2024', species: 'drosophila', sex: 'Dişi', stage: 'Erişkin', scope: 'Bütün erişkin beyni', version: '783',
    metrics: [{ kind: 'neurons', value: 139_255, unit: 'neurons', approximate: false }, { kind: 'chemical', value: 54_500_000, unit: 'chemical-synapses', approximate: true }],
    primary: 'https://doi.org/10.1038/s41586-024-07558-y' },
  { id: 'male-cns2026', species: 'drosophila', sex: 'Erkek', stage: 'Erişkin', scope: 'Beyin ve ventral sinir kordonu', version: 'v1.0',
    metrics: [{ kind: 'neurons', value: 166_700, unit: 'neurons', approximate: false }],
    primary: 'https://doi.org/10.1016/j.cell.2026.08.015' },
]

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  const attached = new WeakSet<Page>()
  const attach = (target: Page) => {
    if (attached.has(target)) return
    attached.add(target)
    target.on('pageerror', error => errors.push(error.message))
    target.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  }
  attach(page)
  page.context().on('page', attach)
})
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], 'Atlas scenarios must not log exceptions or browser console errors').toEqual([])
})

async function expectAtlas(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${atlasPath}/?(?:[?#].*)?$`))
  await expect(page).toHaveTitle('Türler atlası · Circuitiary')
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'species-atlas')
  await expect(main(page).getByRole('heading', { name: 'Türler atlası', level: 1, exact: true })).toHaveAttribute('id', 'atlas-title')
  await expect(atlasLink(page)).toHaveAttribute('aria-current', 'page')
  await expect(recordSelect(page)).toBeEnabled()
}

async function atlasState(page: Page) {
  return main(page).evaluate(element => ({
    controls: [...element.querySelectorAll('select')].map(control => ({ id: control.id, value: control.value })),
    questions: [...element.querySelectorAll('fieldset[data-question-id]')].map(question => ({
      id: question.getAttribute('data-question-id'),
      checked: [...question.querySelectorAll('input:checked')].map(input => (input as HTMLInputElement).value),
      feedback: question.querySelector('[role="status"]')?.textContent ?? null,
    })),
    record: element.querySelector('[data-testid="atlas-selected-record"]')?.textContent,
    comparison: element.querySelector('[data-testid="atlas-comparison"]')?.textContent,
  }))
}

async function resetAtlas(page: Page) {
  await main(page).getByRole('button', { name: 'Atlas seçimini sıfırla', exact: true }).click()
  await expect(speciesFilter(page)).toHaveValue('all')
  await expect(recordSelect(page)).toHaveValue(defaults.selected)
  await expect(compareA(page)).toHaveValue(defaults.left)
  await expect(compareB(page)).toHaveValue(defaults.right)
  await expect(main(page).locator('fieldset[data-question-id] input:checked')).toHaveCount(0)
}

async function exerciseAtlas(page: Page) {
  await speciesFilter(page).selectOption('drosophila')
  await recordSelect(page).selectOption('drosophila-larva2023')
  await compareA(page).selectOption('cook2019-hermaphrodite')
  await compareB(page).selectOption('flywire2024')
  await question(page, 'scope').locator('input[value="brainOnly"]').check()
  await expect(question(page, 'scope').getByRole('status')).not.toHaveText('')
}

async function expectRecordFacts(page: Page, expected: ExpectedRecord) {
  const card = selectedRecord(page)
  await expect(card).toHaveAttribute('data-record-id', expected.id)
  await expect(card).toHaveAttribute('data-species-id', expected.species)
  await expect(card.locator('[data-field="sex"] dd')).toContainText(expected.sex)
  await expect(card.locator('[data-field="stage"] dd')).toContainText(expected.stage)
  await expect(card.locator('[data-field="scope"] dd')).toContainText(expected.scope)
  await expect(card.locator('[data-field="version"] dd')).toContainText(expected.version)
  await expect(card.locator('[data-field="version"] dd code')).not.toHaveText('')
  await expect(card.locator('[data-field="checked-date"] dd')).toHaveText('2026-10-03')
  const metrics = card.locator('li[data-count-kind]')
  await expect(metrics).toHaveCount(expected.metrics.length)
  for (const metric of expected.metrics) {
    const count = card.locator(`li[data-count-kind="${metric.kind}"]`)
    await expect(count).toHaveAttribute('data-unit', metric.unit)
    await expect(count).toHaveAttribute('data-approximate', String(metric.approximate))
    await expect(count).toHaveAttribute('data-value', metric.value === null ? 'not-reported' : String(metric.value))
    const visible = count.locator('strong')
    await expect(visible).toBeVisible()
    if (metric.value === null) await expect(visible).toHaveText('Bu atlas kaydında verilmedi')
    else {
      const text = (await visible.textContent())!.trim()
      expect(Number(text.replace(/[≈\s.,]/g, '')), 'The visible count must retain the primary-source value').toBe(metric.value)
      expect(text.includes('≈'), 'Published approximate totals stay explicitly approximate').toBe(metric.approximate)
    }
    await expect(count.locator('p')).not.toHaveText('')
  }
  await expect(card.getByRole('list', { name: 'Seçili kaydın birincil kaynakları', exact: true }).locator(`a[href="${expected.primary}"]`)).toHaveCount(1)
  await expect(card).toHaveAttribute('data-model-status', expected.id === defaults.selected ? 'assumed-dynamics' : 'anatomical-dataset')
  await expect(card).toHaveAttribute('data-record-kind', expected.id === defaults.selected ? 'current-subset' : 'published')
  await expect(card).toHaveAttribute('data-circuitiary-relation', expected.id === defaults.selected ? 'current-local-subset' : expected.id === 'cook2019-hermaphrodite' ? 'source-of-current-subset' : 'reference-only')
  if (expected.species === 'drosophila') {
    await expect(card.locator('[data-field="model-status"]')).toContainText('Anatomik veri')
    await expect(card).toContainText('indirmez, içe aktarmaz veya simüle etmez')
  }
}

test('all seven records expose independently pinned counts, units, sex, life stage, scope, versions and source-specific licensing without loading other models', async ({ page }) => {
  await page.goto(atlasPath)
  await expectAtlas(page)
  await expect(main(page)).toHaveAttribute('data-catalog-kind', 'static-reference')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('#amplitude')).toHaveCount(0)
  await expect(speciesFilter(page)).toHaveValue('all')
  await expect(recordSelect(page)).toHaveValue(defaults.selected)
  await expect(compareA(page)).toHaveValue(defaults.left)
  await expect(compareB(page)).toHaveValue(defaults.right)
  const unlabelled = await main(page).evaluate(element => [...element.querySelectorAll('input,select,textarea')].filter(control => {
    const native = control as HTMLInputElement
    return !([...(native.labels ?? [])].some(label => label.textContent?.trim()) || control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim().split(/\s+/).every(id => document.getElementById(id)?.textContent?.trim()))
  }).map(control => control.id))
  expect(unlabelled).toEqual([])
  for (const id of ['atlas-records', 'atlas-comparison', 'atlas-scope-quiz', 'atlas-interpretation', 'atlas-sources']) await expect(main(page).locator(`#${id}`)).toHaveCount(1)
  for (const record of expectedRecords) {
    await recordSelect(page).selectOption(record.id)
    await expectRecordFacts(page, record)
    const card = selectedRecord(page)
    if (record.id.startsWith('cook2019') || record.id === defaults.selected) {
      await expect(card.locator('[data-field="license"]')).toHaveAttribute('data-license-status', 'unverified')
      await expect(card.locator('[data-field="license"]')).toContainText('dosyalarının yeniden dağıtım izni doğrulanmadı')
    }
    if (record.id.startsWith('cook2019')) {
      await expect(card.locator('[data-field="reconstruction"]')).toContainText('bileşik')
      await expect(card.locator('[data-field="counts"]')).toContainText('bağlantı sayısı ve büyüklüğü birlikte')
      await expect(card).toContainText(record.id.endsWith('male') ? '579' : '460')
    }
    if (record.id === 'drosophila-larva2023') {
      await expect(card).toContainText(/6 saat|altı saat/)
      await expect(card.locator('[data-field="scope"]')).toContainText('bu kaydı beyin + bütün VNC yapmaz')
    }
    if (record.id === 'flywire2024') {
      await expect(card.locator('[data-field="scope"]')).toContainText('ventral sinir kordonu, bütün CNS veya hayvanın bedeni değildir')
      await expect(card.locator('[data-field="license"]')).toHaveAttribute('data-license-status', 'verified')
      await expect(card.locator('[data-field="license"]')).toContainText('CC BY 4.0')
      await expect(card.locator('[data-field="license"]')).toContainText('CC BY-NC')
      await expect(card.locator('[data-field="license"]')).toContainText('783')
    }
    if (record.id === 'male-cns2026') {
      await expect(card.locator('[data-field="license"]')).toHaveAttribute('data-license-status', 'verified')
      await expect(card.locator('[data-field="license"]')).toContainText('CC BY 4.0')
      await expect(card.locator('[data-field="version"]')).toContainText('2026-06-08')
    }
  }
  const sourceCards = main(page).locator('#atlas-sources [data-source-record-id]')
  await expect(sourceCards).toHaveCount(7)
  expect(await sourceCards.evaluateAll(cards => cards.map(card => card.getAttribute('data-source-record-id')).sort())).toEqual([...recordIds].sort())
  const external = main(page).locator('a[href^="https://"]')
  expect(await external.count()).toBeGreaterThan(7)
  for (const link of await external.all()) {
    expect((await link.getAttribute('rel'))?.split(/\s+/)).toContain('noopener')
    await expect(link).not.toHaveAttribute('download')
    await expect(link).not.toHaveAttribute('target', '_blank')
  }
  await expectNoHorizontalOverflow(page)
  await page.reload()
  await expectAtlas(page)
  await expect(recordSelect(page)).toHaveValue(defaults.selected)
  await expectRecordFacts(page, expectedRecords[0]!)
})

test('scope questions explain incorrect and correct reasoning through native labelled radios, keep other atlas choices intact and reset explicitly', async ({ page }) => {
  await page.goto(atlasPath)
  await expectAtlas(page)
  await exerciseAtlas(page)
  await question(page, 'scope').locator('input[value="wholeAnimal"]').check()
  const choices = { species: await speciesFilter(page).inputValue(), record: await recordSelect(page).inputValue(), left: await compareA(page).inputValue(), right: await compareB(page).inputValue() }
  const cases = [
    { id: 'scope', wrong: 'wholeAnimal', correct: 'brainOnly', concepts: [/dişi/, /ventral sinir kordonu/, /bütün CNS/] },
    { id: 'units', wrong: 'divideCounts', correct: 'differentUnits', concepts: [/SI5/, /kesit/, /Sinaps sayısı/, /ayrı nicelik/] },
    { id: 'subset', wrong: 'wholeWorm', correct: 'selectedSubset', concepts: [/30 nöron/, /196/, /50/, /302/] },
    { id: 'model', wrong: 'wiringEnough', correct: 'dynamicsAndValidation', concepts: [/reseptörler/, /zaman sabitleri/, /beden/, /biyolojik ölçüm/] },
  ]
  await expect(main(page).locator('fieldset[data-question-id]')).toHaveCount(4)
  for (const [index, item] of cases.entries()) {
    const group = question(page, item.id)
    await expect(group.getByRole('radio')).toHaveCount(3)
    const wrong = group.locator(`input[value="${item.wrong}"]`)
    await expect(wrong).toHaveAccessibleName(/.+/)
    await wrong.focus()
    await page.keyboard.press('Space')
    await expect(wrong).toBeChecked()
    const feedback = group.getByTestId(`atlas-quiz-feedback-${item.id}`)
    await expect(feedback).toHaveAttribute('data-correct', 'false')
    await expect(feedback).toHaveAttribute('role', 'status')
    await expect(feedback).toHaveAttribute('aria-live', 'polite')
    await expect(feedback).toHaveAttribute('aria-atomic', 'true')
    await expect(feedback).toContainText('Bu çıkarımı yeniden düşün.')
    for (const concept of item.concepts) await expect(feedback).toContainText(concept)
    const correct = group.locator(`input[value="${item.correct}"]`)
    await expect(correct).toHaveAttribute('aria-describedby', `atlas-feedback-${item.id}`)
    await correct.check()
    await expect(correct).toBeChecked()
    await expect(wrong).not.toBeChecked()
    await expect(feedback).toHaveAttribute('data-correct', 'true')
    await expect(feedback).toContainText('Doğru çıkarım.')
    for (const concept of item.concepts) await expect(feedback).toContainText(concept)
    await expect(main(page).getByTestId('atlas-quiz-progress')).toHaveText(`${index + 1} / 4 soru yanıtlandı.`)
  }
  await expect(speciesFilter(page)).toHaveValue(choices.species)
  await expect(recordSelect(page)).toHaveValue(choices.record)
  await expect(compareA(page)).toHaveValue(choices.left)
  await expect(compareB(page)).toHaveValue(choices.right)
  await resetAtlas(page)
  await expect(main(page).getByTestId('atlas-quiz-progress')).toHaveText('0 / 4 soru yanıtlandı.')
  for (const item of cases) {
    const feedback = question(page, item.id).getByTestId(`atlas-quiz-feedback-${item.id}`)
    await expect(feedback).not.toHaveAttribute('data-correct')
    await expect(feedback).toContainText('Bir seçenek seçtiğinde açıklama burada görünür.')
  }
  await expectNoHorizontalOverflow(page)
})

async function guidedSnapshot(page: Page) {
  return page.getByTestId('guided-result-stimulus').evaluate(element => ({
    paths: [...element.querySelectorAll('[data-guided-trace]')].map(path => path.getAttribute('d')),
    values: [...element.querySelectorAll('[data-value]')].map(value => [value.getAttribute('data-testid'), value.getAttribute('data-value'), value.textContent]),
  }))
}

async function assumptionsSnapshot(page: Page) {
  return page.getByTestId('assumptions-result').evaluate(element => ({
    traces: [...element.querySelectorAll('[data-assumption-trace]')].map(path => ({ condition: path.getAttribute('data-assumption-trace'), d: path.getAttribute('d') })),
    values: [...element.querySelectorAll('[data-value]')].map(value => ({ id: value.getAttribute('data-testid'), value: value.getAttribute('data-value'), text: value.textContent })),
    settings: [...element.querySelectorAll('[data-testid="assumptions-run-settings"]')].map(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), text: node.textContent })),
    examples: [...(element.closest('main')?.querySelectorAll('[data-testid^="assumptions-example-"]') ?? [])]
      .map(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), text: node.textContent })),
  }))
}

test('atlas choices persist independently across all four earlier learning pages, and atlas reset preserves their drafts and completed results', async ({ page }) => {
  await page.goto(neuronPath)
  await page.locator('#lesson-stimulus').fill('0.4')
  await page.locator('#lesson-threshold').fill('0.9')
  await page.locator('#lesson-circuit-stimulus').fill('0.3')
  const neuronIds = ['#lesson-stimulus', '#lesson-threshold', '#lesson-circuit-stimulus']
  const neuronBefore = await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))
  await navLink(page, navLabels.guided).click()
  await expect(page).toHaveURL(new RegExp(`${guidedPath}$`))
  await page.locator('#guided-stimulus-prediction').selectOption('unsure')
  await main(page).locator('#guided-stimulus').getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  await expect(page.getByTestId('guided-result-stimulus')).toHaveAttribute('data-run-number', '1')
  const guidedBefore = await guidedSnapshot(page)
  expect(guidedBefore.paths).toHaveLength(2)
  expect(guidedBefore.values.length).toBeGreaterThan(8)
  await navLink(page, navLabels.reading).click()
  await expect(page).toHaveURL(new RegExp(`${readingPath}$`))
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
  await page.locator('#reading-neuron').selectOption('AVER')
  await page.locator('#reading-target').selectOption('AVBR')
  await page.locator('#reading-mode').selectOption('gap')
  await main(page).getByRole('button', { name: 'Yol bul', exact: true }).click()
  await main(page).getByRole('button', { name: 'Sonraki adım', exact: true }).click()
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  const readingBefore = await page.getByTestId('reading-path-hops').locator('[data-edge-id]').evaluateAll(hops => hops.map(hop => hop.getAttribute('data-edge-id')))
  expect(readingBefore).toEqual(['gap:AVAR--AVER', 'gap:AVAR--AVBL', 'gap:AVBL--AVBR'])
  await navLink(page, navLabels.assumptions).click()
  await expect(page).toHaveURL(new RegExp(`${assumptionsPath}$`))
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
  await page.locator('#assumptions-variable').selectOption('time-constant')
  await expect(page.locator('#assumptions-comparison-value')).toHaveValue('90')
  await main(page).getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  await expect(page.getByTestId('assumptions-result')).toHaveAttribute('data-run-number', '1')
  const assumptionsBefore = await assumptionsSnapshot(page)
  expect(assumptionsBefore.traces).toHaveLength(2)
  for (const trace of assumptionsBefore.traces) expect(trace.d?.match(/[ML]/g)).toHaveLength(701)
  await page.locator('#assumptions-comparison-value').fill('60')
  await expect(page.getByTestId('assumptions-result')).toHaveAttribute('data-stale', 'true')
  await atlasLink(page).click()
  await expectAtlas(page)
  await exerciseAtlas(page)
  const atlasBefore = await atlasState(page)
  await navLink(page, navLabels.neuron).click()
  expect(await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))).toEqual(neuronBefore)
  await atlasLink(page).click()
  await expect.poll(() => atlasState(page)).toEqual(atlasBefore)
  await resetAtlas(page)
  await navLink(page, navLabels.guided).click()
  await expect(page.locator('#guided-stimulus-prediction')).toHaveValue('unsure')
  await expect(page.getByTestId('guided-result-stimulus')).toHaveAttribute('data-run-number', '1')
  // Hidden charts legitimately resize; wait for their original visible geometry
  // before asserting exact preservation of every path and recorded numeric value.
  await expect.poll(() => guidedSnapshot(page)).toEqual(guidedBefore)
  await navLink(page, navLabels.reading).click()
  await expect(page.locator('#reading-neuron')).toHaveValue('AVER')
  await expect(page.locator('#reading-target')).toHaveValue('AVBR')
  await expect(page.locator('#reading-mode')).toHaveValue('gap')
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  expect(await page.getByTestId('reading-path-hops').locator('[data-edge-id]').evaluateAll(hops => hops.map(hop => hop.getAttribute('data-edge-id')))).toEqual(readingBefore)
  await navLink(page, navLabels.assumptions).click()
  await expect(page.locator('#assumptions-variable')).toHaveValue('time-constant')
  await expect(page.locator('#assumptions-comparison-value')).toHaveValue('60')
  await expect(page.getByTestId('assumptions-result')).toHaveAttribute('data-run-number', '1')
  await expect(page.getByTestId('assumptions-result')).toHaveAttribute('data-stale', 'true')
  await expect.poll(() => assumptionsSnapshot(page)).toEqual(assumptionsBefore)
  await navLink(page, navLabels.neuron).click()
  expect(await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))).toEqual(neuronBefore)
  await expectNoHorizontalOverflow(page)
})

test('species filters affect only the selected catalog record while both independent comparison choices remain usable', async ({ page }) => {
  await page.goto(atlasPath)
  await expectAtlas(page)
  await expect(speciesFilter(page).locator('option')).toHaveCount(3)
  expect(await speciesFilter(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['all', 'c-elegans', 'drosophila'])
  await expect(recordSelect(page)).toHaveValue(defaults.selected)
  expect(await recordSelect(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual([...recordIds].sort())
  await compareA(page).selectOption('cook2019-male')
  await compareB(page).selectOption('hemibrain2020')
  const beforeComparison = await comparison(page).textContent()
  await speciesFilter(page).selectOption('drosophila')
  expect(await recordSelect(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort()))
    .toEqual(['drosophila-larva2023', 'hemibrain2020', 'flywire2024', 'male-cns2026'].sort())
  await recordSelect(page).selectOption('flywire2024')
  await expect(selectedRecord(page)).toHaveAttribute('data-record-id', 'flywire2024')
  await expect(compareA(page)).toHaveValue('cook2019-male')
  await expect(compareB(page)).toHaveValue('hemibrain2020')
  await expect(comparison(page)).toHaveText(beforeComparison!)
  expect(await compareA(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual([...recordIds].sort())
  expect(await compareB(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual([...recordIds].sort())
  await speciesFilter(page).selectOption('c-elegans')
  expect(await recordSelect(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort()))
    .toEqual(['circuitiary-subset30', 'cook2019-hermaphrodite', 'cook2019-male'].sort())
  const wormSelection = await recordSelect(page).inputValue()
  expect(['circuitiary-subset30', 'cook2019-hermaphrodite', 'cook2019-male']).toContain(wormSelection)
  await expect(selectedRecord(page)).toHaveAttribute('data-record-id', wormSelection)
  await expect(compareA(page)).toHaveValue('cook2019-male')
  await expect(compareB(page)).toHaveValue('hemibrain2020')
  await speciesFilter(page).selectOption('all')
  await expect(recordSelect(page)).toHaveValue(wormSelection)
  await expectNoHorizontalOverflow(page)
})

test('a record can be compared with itself without fabricating a ranking or treating counts with different units as equivalent', async ({ page }) => {
  await page.goto(atlasPath)
  await expectAtlas(page)
  await compareA(page).selectOption('flywire2024')
  await compareB(page).selectOption('flywire2024')
  const same = main(page).getByTestId('atlas-same-record')
  await expect(same).toHaveAttribute('role', 'status')
  await expect(same).toBeVisible()
  const rows = comparison(page).locator('tbody tr[data-comparison-row], tbody tr[data-count-comparison]')
  expect(await rows.count()).toBeGreaterThan(6)
  for (const row of await rows.all()) {
    const cells = row.locator('th,td')
    await expect(cells).toHaveCount(3)
    const values = await cells.allTextContents()
    expect(values[1]?.trim()).toBe(values[2]?.trim())
  }
  await compareA(page).selectOption('cook2019-hermaphrodite')
  await expect(same).toHaveCount(0)
  await expect(comparison(page)).toContainText('EM')
  await expect(comparison(page)).toContainText(/sinaps|sinaptik/)
  const chemical = comparison(page).locator('[data-count-comparison="chemical"]')
  await expect(chemical).toHaveAttribute('data-classification', 'different-units')
  await expect(chemical.locator('[data-side="left"]')).toHaveAttribute('data-unit', 'serial-em-sections')
  await expect(chemical.locator('[data-side="left"]')).toHaveAttribute('data-value', 'not-reported')
  await expect(chemical.locator('[data-side="left"] strong')).toHaveText('Bu atlas kaydında verilmedi')
  await expect(chemical.locator('[data-side="right"]')).toHaveAttribute('data-unit', 'chemical-synapses')
  await expect(chemical.locator('[data-side="right"]')).toHaveAttribute('data-value', '54500000')
  const neuronCounts = comparison(page).locator('[data-count-comparison="neurons"]')
  await expect(neuronCounts).toHaveAttribute('data-classification', 'same-unit-context-differs')
  await expect(neuronCounts.locator('[data-side="left"]')).toHaveAttribute('data-value', '302')
  await expect(neuronCounts.locator('[data-side="right"]')).toHaveAttribute('data-value', '139255')
  await compareA(page).selectOption('flywire2024')
  await compareB(page).selectOption('male-cns2026')
  const scopes = comparison(page).locator('[data-comparison-row="scope"]')
  await expect(scopes).toHaveAttribute('data-different', 'true')
  await expect(scopes.locator('td').nth(0)).toHaveText('Bütün erişkin beyni')
  await expect(scopes.locator('td').nth(1)).toHaveText('Beyin ve ventral sinir kordonu')
  const sexes = comparison(page).locator('[data-comparison-row="sex"]')
  await expect(sexes.locator('td').nth(0)).toHaveText('Dişi')
  await expect(sexes.locator('td').nth(1)).toHaveText('Erkek')
  await expect(neuronCounts).toHaveAttribute('data-classification', 'same-unit-context-differs')
  await expect(neuronCounts.locator('[data-side="left"]')).toHaveAttribute('data-value', '139255')
  await expect(neuronCounts.locator('[data-side="right"]')).toHaveAttribute('data-value', '166700')
  await expect(chemical).toHaveAttribute('data-classification', 'missing')
  await expect(chemical.locator('[data-side="right"]')).toHaveAttribute('data-value', 'not-reported')
  await expect(chemical.locator('[data-side="right"]')).toHaveText('Bu atlas kaydında verilmedi')
  await expectNoHorizontalOverflow(page)
})

test('atlas browsing, comparison, answering and reset perform no connectome fetch, external request or dataset download', async ({ page }) => {
  const requests: { url: string; method: string; type: string }[] = []
  const downloads: string[] = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), type: request.resourceType() }))
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.goto(atlasPath)
  await expectAtlas(page)
  await expect(page.locator('#amplitude')).toHaveCount(0)
  await exerciseAtlas(page)
  await resetAtlas(page)
  await recordSelect(page).selectOption('male-cns2026')
  await expectNoHorizontalOverflow(page)
  const origin = new URL(page.url()).origin
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.filter(request => new URL(request.url).origin !== origin), 'Catalog interactions keep every network request on the local application').toEqual([])
  expect(requests.filter(request => new URL(request.url).pathname === '/api/local-connectome'), 'The atlas must not load or mount the main connectome experiment').toEqual([])
  expect(requests.filter(request => ['fetch', 'xhr'].includes(request.type)), 'Static catalog browsing must not silently request a dataset').toEqual([])
  expect(requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(downloads).toEqual([])
})



test('atlas native fragments, reload, keyboard focus, scroll restoration and touch or actual modified-link tabs retain browser semantics', async ({ page, isMobile }) => {
  await page.goto(`${atlasPath}#atlas-sources`)
  await expectAtlas(page)
  await expect(page.locator('#atlas-sources')).toBeFocused()
  await expect(page.locator('#atlas-sources')).toBeInViewport()
  await page.reload()
  await expectAtlas(page)
  await expect(page.locator('#atlas-sources')).toBeFocused()
  await expect(page.locator('#atlas-sources')).toBeInViewport()
  await experimentLink(page).click()
  await page.getByRole('link', { name: /Modeli anlamak/ }).click()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  // Assign genuine keyboard focus without overwriting the saved native scroll.
  await atlasLink(page).evaluate(link => (link as HTMLElement).focus({ preventScroll: true }))
  await expect(atlasLink(page)).toBeFocused()
  await expect(page.locator('#assumptions')).toBeInViewport()
  const departureScroll = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Enter')
  await expectAtlas(page)
  await expect(page.locator('#atlas-title')).toBeFocused()
  const skip = page.getByRole('link', { name: 'İçeriğe geç', exact: true })
  await expect(skip).toHaveAttribute('href', '#species-atlas')
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${atlasPath}#species-atlas$`))
  await expect(main(page)).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${atlasPath}$`))
  await page.goBack()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(departureScroll)
  await page.goForward()
  await expectAtlas(page)
  await experimentLink(page).click()
  const originalUrl = page.url()
  await expect(atlasLink(page)).toHaveAttribute('href', atlasPath)
  if (isMobile) {
    await atlasLink(page).tap()
    await expectAtlas(page)
    await experimentLink(page).tap()
    await expect(page).toHaveURL(originalUrl)
  } else {
    const context = page.context()
    expect(context.pages()).toHaveLength(1)
    const actions: Parameters<Locator['click']>[0][] = [{ modifiers: ['ControlOrMeta'] }, { button: 'middle' }]
    for (const options of actions) {
      const pending = context.waitForEvent('page')
      await atlasLink(page).click(options)
      const tab = await pending
      expect(tab).not.toBe(page)
      expect(context.pages()).toHaveLength(2)
      await expectAtlas(tab)
      await expect(page).toHaveURL(originalUrl)
      await tab.close()
      expect(context.pages()).toHaveLength(1)
    }
  }
  await expectNoHorizontalOverflow(page)
})

for (const experimentMode of ['toy', 'real'] as const) {
  test(`visiting and resetting the atlas preserves all ${experimentMode} experiment controls, ${experimentMode === 'toy' ? '2D' : '3D'} view, playing time and full numerical JSON`, async ({ page }) => {
    const epoch = new Date('2030-01-01T00:00:00Z')
    await page.clock.install({ time: epoch })
    await page.clock.pauseAt(new Date(epoch.getTime() + 1000))
    await page.goto('/')
    if (experimentMode === 'real') {
      await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
      await expect(cells(page).getByRole('button')).toHaveCount(30)
      await page.locator('#chemical-gain').fill('1.1')
      await page.locator('#gap-gain').fill('0.4')
      await page.locator('#stimulus-target').selectOption('PVCL')
      await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('PVCR')
      await page.locator('#changed-neuron').selectOption('PVDL')
      await page.locator('#silenced-edge').selectOption('gap:AVAR--AVER')
      await page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true }).uncheck()
      await cell(page, 'ASHR').click()
    } else {
      await expect(cells(page).getByRole('button')).toHaveCount(8)
      await page.locator('#stimulus-target').selectOption('S2')
      await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2')
      await page.locator('#changed-neuron').selectOption('I4')
      await page.locator('#silenced-edge').selectOption('I4-O1')
      await cell(page, 'O2').click()
    }
    await page.locator('#amplitude').fill('0.55')
    await page.locator('#duration').fill('350')
    await page.locator('#base-tau').fill('45')
    await page.locator('#changed-tau').fill('150')
    await page.locator('#dt').selectOption('0.5')
    await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).fill('400')
    await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true }).getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
    let renderer: string | null = null
    if (experimentMode === 'real') {
      await view(page, '3D').click()
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-node-count', '30', { timeout: 15_000 })
      await page.clock.runFor(32)
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
      renderer = await page.locator('.circuit-3d').getAttribute('data-renderer-instance')
      expect(renderer).not.toBeNull()
    } else await expect(view(page, '2D')).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Etkinliği oynat', exact: true }).click()
    await page.clock.runFor(64)
    const beforeUi = await experimentUi(page)
    expect(beforeUi.playing).toBe(true)
    expect(Number(beforeUi.cursor)).toBeGreaterThan(400)
    const beforeJson = await exportRecord(page)
    await atlasLink(page).click()
    await expectAtlas(page)
    await expect(page.locator('#amplitude')).not.toBeVisible()
    await exerciseAtlas(page)
    await resetAtlas(page)
    await experimentLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    await expect(cells(page).getByRole('button')).toHaveCount(experimentMode === 'toy' ? 8 : 30)
    expect(await experimentUi(page)).toEqual(beforeUi)
    expect(await exportRecord(page)).toEqual(beforeJson)
    if (renderer) {
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-instance', renderer)
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready')
    }
    await expectNoHorizontalOverflow(page)
  })
}
