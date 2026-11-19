import { expect, test, type Page } from '@playwright/test'
import { addLink, cellCount, expectNoBrowserErrors, language, loadMotif, metric, openBuilder, resetButton, run, runButton, setRange, stimulusTarget, strength } from './support/builder'
import { expectNoHorizontalOverflow, main } from './support/ui'

test.beforeEach(async ({ page }) => { await openBuilder(page) })
test.afterEach(async ({ page }) => { await expectNoBrowserErrors(page) })

const peakChoice = (page: Page) => main(page).getByRole('combobox', { name: 'Uyarılan hücre dışında en yüksek tepeye hangi hücre ulaşır?', exact: true })
const endChoice = (page: Page) => main(page).getByRole('combobox', { name: 'Kaydın sonunda etkinlik sürüyor olacak mı?', exact: true })
const feedback = (page: Page) => main(page).getByTestId('builder-prediction-feedback')
const peakLine = (page: Page) => main(page).getByTestId('builder-prediction-peak')
const endLine = (page: Page) => main(page).getByTestId('builder-prediction-end')
const changed = (page: Page) => main(page).getByTestId('builder-prediction-changed')
const options = (select: ReturnType<typeof peakChoice>) => select.locator('option').evaluateAll(all => all.map(option => `${(option as HTMLOptionElement).value}=${option.textContent}`))

test('the prediction is optional: the choices follow the circuit and say what a tie means', async ({ page }) => {
  const group = main(page).getByRole('group', { name: 'İstersen önce tahmin et', exact: true })
  await expect(group).toContainText('Tahmin isteğe bağlıdır ve bir puan değildir.')
  await expect(peakChoice(page)).toHaveValue('')
  await expect(endChoice(page)).toHaveValue('')
  // The stimulated cell (A) is not a choice: the question is about the others.
  expect(await options(peakChoice(page))).toEqual(['=Tahmin eklemeden devam et', 'B=Hücre B', 'C=Hücre C', 'unsure=Emin değilim'])
  expect(await options(endChoice(page))).toEqual(['=Tahmin eklemeden devam et', 'fades=Söner', 'persists=Sürer', 'unsure=Emin değilim'])
  await cellCount(page).selectOption('5')
  expect(await options(peakChoice(page))).toEqual(['=Tahmin eklemeden devam et', 'B=Hücre B', 'C=Hücre C', 'D=Hücre D', 'E=Hücre E', 'unsure=Emin değilim'])
  await stimulusTarget(page).selectOption('D')
  expect(await options(peakChoice(page))).toEqual(['=Tahmin eklemeden devam et', 'A=Hücre A', 'B=Hücre B', 'C=Hücre C', 'E=Hücre E', 'unsure=Emin değilim'])
  // The rule is stated next to the questions, with the page's own numbers and a decimal comma.
  await expect(group).toContainText('“Sürer”: kaydın son anında (700 ms) en az bir hücrenin aktivitesi 0,10 düzeyinde ya da üstünde.')
  await expect(group).toContainText('Tepe sorusu uyarılan hücreyi saymaz: darbeyi doğrudan o alır.')
  await expect(group).toContainText('Tepesi, uyarılan hücre dışındaki en yüksek tepeden en çok 0,005 düşük olan hücreler o tepeyi paylaşmış sayılır')
  await expect(peakChoice(page)).toHaveAttribute('aria-describedby', 'builder-prediction-rules')
  // The questions sit before Run in the page, so they are met first with the keyboard.
  await endChoice(page).focus()
  await page.keyboard.press('Tab')
  await expect(runButton(page)).toBeFocused()
})

test('without a prediction the result says so and nothing else is added', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  await run(page)
  await expect(feedback(page)).toHaveAttribute('data-predicted', 'false')
  await expect(feedback(page).getByRole('heading', { level: 3 })).toHaveText('Tahminin ve hesap')
  await expect(main(page).getByTestId('builder-prediction-none')).toHaveText('Bu kayda tahmin eklenmedi.')
  await expect(feedback(page).locator('p')).toHaveCount(1)
  await expect(peakLine(page)).toHaveCount(0)
  await expect(endLine(page)).toHaveCount(0)
  await expect(changed(page)).toHaveCount(0)
  // The result itself is what it always was.
  await expect(main(page).getByTestId('builder-facts').locator('li')).toHaveText(['En yüksek tepe A hücresinde: 0,799.', 'Uyaran 300 ms’de bitti; 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altına indi.'])
  await expect(main(page).getByTestId('builder-run-settings')).toContainText('Kayıt #1: 3 hücre, 2 bağlantı. A hücresine 0,80 genlikli darbe, 100–300 model ms.')
})

test('a prediction is recorded with the run; agreement is stated plainly, with the numbers', async ({ page }) => {
  await loadMotif(page, 'feedback-inhibition').click()
  await peakChoice(page).selectOption('B')
  await endChoice(page).selectOption('fades')
  // Nothing is compared before the run.
  await expect(feedback(page)).toHaveCount(0)
  await run(page)
  await expect(feedback(page)).toHaveAttribute('data-predicted', 'true')
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışında en yüksek tepe için tahminin: B hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,420. Tahmin ile hesap örtüşüyor.')
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(endLine(page)).toHaveText('Kaydın sonu için tahminin: etkinlik söner. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş. Tahmin ile hesap örtüşüyor.')
  await expect(feedback(page)).toContainText('Bu bir puan ya da değerlendirme değildir')
  await expect(main(page).getByTestId('builder-prediction-none')).toHaveCount(0)
  await expect(changed(page)).toHaveCount(0)
  // No praise, no blame, no score.
  await expect(feedback(page)).not.toContainText(/doğru|yanlış|tebrik|aferin|hata|puanın/i)
})

test('disagreement, “not sure” and a single answered question each get their own plain line', async ({ page }) => {
  await loadMotif(page, 'loop').click()
  await peakChoice(page).selectOption('C')
  await endChoice(page).selectOption('fades')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'disagree')
  // A, the stimulated cell, has the highest peak of all (0,998); the line speaks of the others only.
  await expect(main(page).getByTestId('builder-peak-A')).toHaveText('0,998')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışında en yüksek tepe için tahminin: C hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,989. Tahmin ile hesap farklı.')
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'disagree')
  await expect(endLine(page)).toHaveText('Kaydın sonu için tahminin: etkinlik söner. Hesapta 700 ms’de A, B ve C hücrelerinin aktivitesi 0,10 düzeyinde ya da üstünde: etkinlik sürüyor. Tahmin ile hesap farklı.')

  await peakChoice(page).selectOption('unsure')
  await endChoice(page).selectOption('unsure')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'unsure')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışında en yüksek tepe için “emin değilim” seçtin. Hesapta uyarılan hücre (A) dışında en yüksek tepe B hücresinde: 0,989.')
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'unsure')
  await expect(endLine(page)).toHaveText('Kaydın sonu için “emin değilim” seçtin. Hesapta 700 ms’de A, B ve C hücrelerinin aktivitesi 0,10 düzeyinde ya da üstünde: etkinlik sürüyor.')

  await peakChoice(page).selectOption('')
  await endChoice(page).selectOption('persists')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'none')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışındaki en yüksek tepe sorusuna tahmin eklenmedi.')
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'agree')

  await endChoice(page).selectOption('')
  await run(page)
  await expect(main(page).getByTestId('builder-prediction-none')).toBeVisible()
  await expect(feedback(page)).toHaveAttribute('data-predicted', 'false')
})

test('a tie is named: either of two cells that share the highest peak apart from the stimulated cell agrees', async ({ page }) => {
  // A drives B and C with the same strength 2: both saturate and are equal. D has no input.
  await cellCount(page).selectOption('4')
  await addLink(page).click()
  await addLink(page).click()
  await setRange(strength(page, 1), 2)
  await setRange(strength(page, 2), 2)
  await peakChoice(page).selectOption('C')
  await run(page)
  expect(await metric(page, 'peak', 'B')).toBe(await metric(page, 'peak', 'C'))
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışında en yüksek tepe için tahminin: C hücresi. Hesapta uyarılan hücre (A) dışında en yüksek tepeyi B ve C hücreleri paylaşıyor: en yükseği 0,999, aralarındaki fark 0,005 ya da daha az. Tahmin ettiğin hücre bu tepeyi paylaşanlardan biri: tahmin ile hesap örtüşüyor.')
  await peakChoice(page).selectOption('D')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'disagree')
  await expect(peakLine(page)).toContainText('Hesapta uyarılan hücre (A) dışında en yüksek tepeyi B ve C hücreleri paylaşıyor')

  // The comparison leaves out whichever cell is stimulated: with B stimulated nothing drives the others.
  await stimulusTarget(page).selectOption('B')
  await peakChoice(page).selectOption('A')
  await endChoice(page).selectOption('fades')
  await run(page)
  expect(await metric(page, 'peak', 'B')).toBeGreaterThan(0.7)
  expect(await metric(page, 'peak', 'A')).toBe(0)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'no-response')
  await expect(peakLine(page)).toHaveText('Uyarılan hücre dışında en yüksek tepe için tahminin: A hücresi. Hesapta uyarılan hücre (B) dışında hiçbir hücre yanıt vermedi; karşılaştırılacak bir tepe yok. Bu yüzden tahmin ne örtüşüyor ne de farklı.')
  await expect(endLine(page)).toHaveText('Kaydın sonu için tahminin: etkinlik söner. Hesapta 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında: etkinlik sönmüş. Tahmin ile hesap örtüşüyor.')

  // With no stimulus nothing responds at all, and the end line says that instead.
  await stimulusTarget(page).selectOption('A')
  await setRange(main(page).locator('#builder-amplitude'), 0)
  await peakChoice(page).selectOption('D')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'no-response')
  await expect(endLine(page)).toHaveText('Kaydın sonu için tahminin: etkinlik söner. Hesapta hiçbir hücre yanıt vermedi; 700 ms’de bütün hücrelerin aktivitesi 0,10 düzeyinin altında. Tahmin ile hesap örtüşüyor.')

  // A pulse that is still on when the record ends: the line adds that the activity may be the stimulus itself.
  await setRange(main(page).locator('#builder-amplitude'), 1)
  await setRange(main(page).locator('#builder-onset'), 500)
  await setRange(main(page).locator('#builder-pulse'), 300)
  await endChoice(page).selectOption('persists')
  await run(page)
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(endLine(page)).toContainText('Tahmin ile hesap örtüşüyor. Kayıt 700 ms’de bittiğinde uyaran hâlâ açık; sondaki etkinlik uyaranın kendisinden geliyor olabilir.')
})

test('changing the prediction after a run is marked as changed; the record keeps the prediction it was run with', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  await peakChoice(page).selectOption('B')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(changed(page)).toHaveCount(0)

  await peakChoice(page).selectOption('C')
  await expect(changed(page)).toBeVisible()
  await expect(changed(page)).toHaveText('Tahmin seçimin değişti; bu kayıttaki tahmin korunuyor. Yeni seçimin bir sonraki çalıştırmada kaydedilir.')
  await expect(feedback(page)).toHaveAttribute('data-changed', 'true')
  // Not re-scored: the line still shows the prediction of the run, and the result is not stale.
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expect(peakLine(page)).toContainText('en yüksek tepe için tahminin: B hücresi.')
  await expect(main(page).getByTestId('builder-result')).toHaveAttribute('data-stale', 'false')
  await expect(main(page).getByTestId('builder-stale')).toHaveCount(0)
  // Choosing the recorded prediction again removes the mark.
  await peakChoice(page).selectOption('B')
  await expect(changed(page)).toHaveCount(0)
  // Adding the second answer after the run is a change too, also when the record had no prediction for it.
  await endChoice(page).selectOption('persists')
  await expect(changed(page)).toBeVisible()
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'none')

  await peakChoice(page).selectOption('C')
  await run(page)
  await expect(changed(page)).toHaveCount(0)
  await expect(main(page).getByTestId('builder-result')).toHaveAttribute('data-run-number', '2')
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'disagree')
  await expect(peakLine(page)).toContainText('en yüksek tepe için tahminin: C hücresi.')
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'disagree')
})

test('a record made without a prediction is marked when one is chosen afterwards', async ({ page }) => {
  await run(page)
  await expect(main(page).getByTestId('builder-prediction-none')).toBeVisible()
  await endChoice(page).selectOption('unsure')
  await expect(changed(page)).toBeVisible()
  await expect(main(page).getByTestId('builder-prediction-none')).toHaveText('Bu kayda tahmin eklenmedi.')
  await expect(endLine(page)).toHaveCount(0)
})

test('a new circuit starts a new prediction, and a predicted cell that leaves the circuit is dropped', async ({ page }) => {
  await cellCount(page).selectOption('4')
  await peakChoice(page).selectOption('D')
  await endChoice(page).selectOption('fades')
  await cellCount(page).selectOption('3')
  await expect(peakChoice(page)).toHaveValue('')
  await expect(endChoice(page)).toHaveValue('fades')
  // Dropped, not hidden: when a cell D exists again the old answer does not come back.
  await cellCount(page).selectOption('4')
  await expect(peakChoice(page)).toHaveValue('')
  await cellCount(page).selectOption('3')
  await peakChoice(page).selectOption('B')
  await cellCount(page).selectOption('5')
  await expect(peakChoice(page)).toHaveValue('B')
  // The same when the predicted cell becomes the stimulated one: it is no longer a possible answer.
  await stimulusTarget(page).selectOption('C')
  await expect(peakChoice(page)).toHaveValue('B')
  await stimulusTarget(page).selectOption('B')
  await expect(peakChoice(page)).toHaveValue('')
  await expect(endChoice(page)).toHaveValue('fades')
  await stimulusTarget(page).selectOption('A')
  await expect(peakChoice(page)).toHaveValue('')
  // Removing the stimulated cell moves the stimulus back to A; a prediction naming A goes with it.
  await stimulusTarget(page).selectOption('E')
  await peakChoice(page).selectOption('A')
  await cellCount(page).selectOption('4')
  await expect(stimulusTarget(page)).toHaveValue('A')
  await expect(peakChoice(page)).toHaveValue('')

  await loadMotif(page, 'divergence').click()
  await expect(peakChoice(page)).toHaveValue('')
  await expect(endChoice(page)).toHaveValue('')
  await peakChoice(page).selectOption('unsure')
  await run(page)
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'unsure')
  await resetButton(page).click()
  await expect(peakChoice(page)).toHaveValue('')
  await expect(feedback(page)).toHaveCount(0)
})

test('the prediction controls and feedback fit a 320 px window and are named', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await loadMotif(page, 'loop').click()
  await peakChoice(page).selectOption('B')
  await endChoice(page).selectOption('persists')
  await run(page)
  await expect(endLine(page)).toHaveAttribute('data-verdict', 'agree')
  await expectNoHorizontalOverflow(page)
  for (const select of [peakChoice(page), endChoice(page)]) {
    const box = (await select.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(43.5)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
  }
  const line = (await endLine(page).boundingBox())!
  expect(line.x + line.width).toBeLessThanOrEqual(320)
})

test('a recorded prediction and its feedback follow a later switch to English', async ({ page }) => {
  await loadMotif(page, 'chain').click()
  await peakChoice(page).selectOption('C')
  await endChoice(page).selectOption('fades')
  await run(page)
  await endChoice(page).selectOption('unsure')
  await expect(changed(page)).toBeVisible()
  await language(page).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const group = main(page).getByRole('group', { name: 'Predict first, if you like', exact: true })
  await expect(group).toContainText('A prediction is optional and is not a score.')
  await expect(group).toContainText('“Persists”: at the last moment of the record (700 ms) the activity of at least one cell is at or above the 0.10 level.')
  await expect(group).toContainText('The peak question does not count the stimulated cell: it takes the pulse directly.')
  await expect(group).toContainText('at most 0.005 below the highest peak apart from the stimulated cell')
  const peak = main(page).getByRole('combobox', { name: 'Apart from the stimulated cell, which cell will reach the highest peak?', exact: true })
  const end = main(page).getByRole('combobox', { name: 'Will activity still be present at the end of the record?', exact: true })
  // The choices are the same choices: ids are kept, only the words change.
  await expect(peak).toHaveValue('C')
  await expect(end).toHaveValue('unsure')
  expect(await options(peak)).toEqual(['=Continue without adding a prediction', 'B=Cell B', 'C=Cell C', 'unsure=I’m not sure'])
  expect(await options(end)).toEqual(['=Continue without adding a prediction', 'fades=Dies out', 'persists=Persists', 'unsure=I’m not sure'])

  await expect(feedback(page).getByRole('heading', { level: 3 })).toHaveText('Your prediction and the calculation')
  await expect(peakLine(page)).toHaveAttribute('data-verdict', 'disagree')
  await expect(peakLine(page)).toHaveText('Your prediction for the highest peak apart from the stimulated cell: cell C. In the calculation, apart from the stimulated cell (A), the highest peak is in cell B: 0.714. The prediction and the calculation differ.')
  await expect(endLine(page)).toHaveText('Your prediction for the end of the record: the activity dies out. In the calculation, at 700 ms the activity of all cells is below the 0.10 level: the activity has died out. The prediction and the calculation agree.')
  await expect(changed(page)).toHaveText('Your prediction choice changed; the prediction in this record is kept. Your new choice is recorded on the next run.')
  await expect(feedback(page)).toContainText('This is not a score or an assessment')
  expect(await feedback(page).innerText()).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
  expect(await group.innerText()).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)

  await end.selectOption('')
  await peak.selectOption('')
  await run(page)
  await expect(main(page).getByTestId('builder-prediction-none')).toHaveText('No prediction was added to this record.')
  await language(page).selectOption('tr')
  await expect(main(page).getByTestId('builder-prediction-none')).toHaveText('Bu kayda tahmin eklenmedi.')
})
