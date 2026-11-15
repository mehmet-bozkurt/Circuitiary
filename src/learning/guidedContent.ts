/** Teaching copy for experiments on the existing illustrative model. */
export type GuidedStepId = 'stimulus' | 'connection' | 'tau'

export interface GuidedStepContent {
  id: GuidedStepId
  title: string
  short: string
  question: string
  introduction: string
  changed: string
  held: string
  predictionPrompt: string
  predictionOptions: { id: string; label: string }[]
  observe: string
  boundary: string
}

export const guidedSteps: GuidedStepContent[] = [
  {
    id: 'stimulus',
    title: 'Uyaranı artırınca çıktı ne yapar?',
    short: 'Uyaranı değiştir',
    question: 'Girdi kuvveti ile çıktı aynı şey mi?',
    introduction: 'S1 hücresine verilen uyaranı değiştirip O1 çıktısını karşılaştır. Daha güçlü girdi, bu devrede birden fazla yolu etkiler: uyarıcı yolların yanında baskılayıcı kol da etkinleşebilir. Sonucu yalnız girdi sayısından tahmin etmek yerine iki eğriyi ve hesaplanan farkı incele.',
    changed: 'S1’e verilen uyaranın genliği.',
    held: 'Devre, bağlantı ağırlıkları, uyaranın başlangıcı ve süresi, zaman sabiti ve başlangıç durumu.',
    predictionPrompt: 'O1’in tepe değeri nasıl değişebilir?',
    predictionOptions: [
      { id: 'increase', label: 'Daha yüksek olabilir' },
      { id: 'similar', label: 'Yakın veya aynı kalabilir' },
      { id: 'decrease', label: 'Daha düşük olabilir' },
      { id: 'unsure', label: 'Emin değilim; önce karşılaştıracağım' },
    ],
    observe: 'O1’in tepe değerini ve tepe zamanını oku. Eğrinin yükselen bölümünü de karşılaştır. “Uyaran iki kat oldu, çıktı da iki kat olmalı” diye varsaymadan, sayıların bu koşulda ne söylediğini anlat.',
    boundary: 'Aktivite 0–1 aralığında boyutsuz bir model değişkenidir. Daha yüksek çizgi, daha yüksek tekil aksiyon potansiyeli veya daha zeki bir hayvan demek değildir.',
  },
  {
    id: 'connection',
    title: 'Bir bağlantıyı kaldırınca ne değişir?',
    short: 'Bağlantıyı kaldır',
    question: 'Bir yol kapanırsa bütün devre susar mı?',
    introduction: 'İki bağlantıdan birini seç: I3→O1 örnek devrede uyarıcı, I4→O1 baskılayıcı olarak atanmıştır. Aynı koşulları bağlantı açıkken ve seçilen bağlantının katkısı kaldırılmışken çalıştır. Bu müdahale yalnız bağlantıya uygulanır; kaynak veya hedef hücreyi bütünüyle kapatmaz.',
    changed: 'Yalnız seçilen I3→O1 veya I4→O1 bağlantısının modeldeki katkısı.',
    held: 'Diğer bağlantılar, S1 uyaranı, zaman sabiti ve bütün hücrelerin başlangıç durumu.',
    predictionPrompt: 'Seçtiğin bağlantı kaldırıldığında O1’in tepe değeri ne yapabilir?',
    predictionOptions: [
      { id: 'decrease', label: 'Daha düşük olabilir' },
      { id: 'similar', label: 'Yakın veya aynı kalabilir' },
      { id: 'increase', label: 'Daha yüksek olabilir' },
      { id: 'unsure', label: 'Emin değilim; önce karşılaştıracağım' },
    ],
    observe: 'O1’in hangi girdileri kaldığını düşün. Uyarıcı bir katkıyı kaldırmakla baskılayıcı bir katkıyı kaldırmak aynı müdahale değildir. Bu devrede 0–1 sınırlaması da sonucu etkiler. O1’in sonucu, bütün diğer hücrelerin sustuğunu göstermez.',
    boundary: 'Buradaki “kaldırma”, simülasyonda tek bağlantının katkısını sıfırlayan müdahaledir. Gerçek hayvanda hücreye veya sinapsa yapılan bir işlemin bütün yan etkilerini temsil etmez.',
  },
  {
    id: 'tau',
    title: 'Yanıtın zaman sabitini değiştir',
    short: 'Zaman sabitini değiştir',
    question: 'Aynı girdiyle eğrinin zaman içindeki biçimi değişir mi?',
    introduction: 'τ, bu modelde bir hücrenin etkin girdisine doğru ne hızla değiştiğini belirleyen zaman sabitidir. Bu deneyde yalnız O1’in τ değerini artırıyoruz; diğer yedi hücre 30 ms’de kalıyor. Daha büyük τ, aynı anlık koşullarda daha yavaş bir güncelleme yapar. Zamanla değişen girdi karşısında tepe değerinin yönünü ayrıca sonuçtan okumak gerekir.',
    changed: 'Yalnız O1 hücresinin model zaman sabiti τ.',
    held: 'Diğer yedi hücrenin τ değeri (30 ms), devre ve ağırlıkları, uyaran genliği, başlangıcı ve süresi, başlangıç durumu ve hesap adımı.',
    predictionPrompt: 'O1’in zaman sabiti artınca tepe değeri nasıl değişebilir?',
    predictionOptions: [
      { id: 'increase', label: 'Daha yüksek olabilir' },
      { id: 'decrease', label: 'Daha düşük olabilir' },
      { id: 'similar', label: 'Yakın veya aynı kalabilir' },
      { id: 'unsure', label: 'Emin değilim; önce karşılaştıracağım' },
    ],
    observe: 'Tepe zamanını tek başına okumakla yetinme. Uyaran kapandıktan sonraki bölümü ve deneyin sonundaki değeri de karşılaştır. Sabit süreli bir deneyde son değer henüz dinlenime dönmüş olmak zorunda değildir.',
    boundary: 'τ değerleri öğretim için seçilmiş model parametreleridir; belirli bir hayvan hücresinin ölçülmüş zar zaman sabiti olarak sunulmaz. Grafikteki ms, modelin zaman ölçeğidir.',
  },
]

export const guidedPrinciples = [
  'Önce hangi niceliği değiştirdiğini yaz. Diğer koşulların sabit kaldığını denetle.',
  'Tahmin isteğe bağlıdır. Sonuç görülmeden de yazılabilir; bir başarı puanı değildir.',
  'Parametreyi değiştirmek kayıtlı sonucu güncellemez. Yeni ayarlar için yeniden çalıştır.',
  'Sayıları ve çizgileri aynı koşul kaydından oku; eski sonucu yeni ayarmış gibi yorumlama.',
  'Bir sonuç bu modelin varsayımları altında geçerlidir. Gerçek hayvan için bağımsız doğrulama gerekir.',
]

/** English twin of `guidedSteps`: same ids, order and prediction option ids. */
export const guidedStepsEn: typeof guidedSteps = [
  {
    id: 'stimulus',
    title: 'What does the output do when you increase the stimulus?',
    short: 'Change the stimulus',
    question: 'Are input strength and output the same thing?',
    introduction: 'Change the stimulus given to cell S1 and compare the O1 output. A stronger input affects more than one pathway in this circuit: alongside the excitatory pathways, the inhibitory branch can become active too. Instead of predicting the result from the input number alone, examine the two curves and the computed difference.',
    changed: 'The amplitude of the stimulus given to S1.',
    held: 'The circuit, the connection weights, the onset and duration of the stimulus, the time constant and the initial state.',
    predictionPrompt: 'How might the peak value of O1 change?',
    predictionOptions: [
      { id: 'increase', label: 'It may be higher' },
      { id: 'similar', label: 'It may stay close or the same' },
      { id: 'decrease', label: 'It may be lower' },
      { id: 'unsure', label: 'I’m not sure; I’ll compare first' },
    ],
    observe: 'Read the peak value and the peak time of O1. Compare the rising part of the curve too. Without assuming “the stimulus doubled, so the output must double too”, describe what the numbers say in this condition.',
    boundary: 'Activity is a dimensionless model variable in the range 0–1. A higher line does not mean a larger single action potential or a more intelligent animal.',
  },
  {
    id: 'connection',
    title: 'What changes when you remove a connection?',
    short: 'Remove the connection',
    question: 'If one pathway closes, does the whole circuit go silent?',
    introduction: 'Choose one of two connections: in the example circuit I3→O1 is assigned as excitatory and I4→O1 as inhibitory. Run the same conditions with the connection on and with the contribution of the chosen connection removed. This intervention is applied to the connection only; it does not switch off the source or target cell as a whole.',
    changed: 'Only the contribution in the model of the chosen I3→O1 or I4→O1 connection.',
    held: 'The other connections, the S1 stimulus, the time constant and the initial state of all cells.',
    predictionPrompt: 'What might the peak value of O1 do when the connection you chose is removed?',
    predictionOptions: [
      { id: 'decrease', label: 'It may be lower' },
      { id: 'similar', label: 'It may stay close or the same' },
      { id: 'increase', label: 'It may be higher' },
      { id: 'unsure', label: 'I’m not sure; I’ll compare first' },
    ],
    observe: 'Think about which inputs O1 still has. Removing an excitatory contribution and removing an inhibitory contribution are not the same intervention. In this circuit the 0–1 limit also affects the result. The result for O1 does not show that all the other cells went silent.',
    boundary: 'Here “removing” is the intervention that sets the contribution of a single connection to zero in the simulation. It does not represent all the side effects of a procedure done to a cell or a synapse in a real animal.',
  },
  {
    id: 'tau',
    title: 'Change the time constant of the response',
    short: 'Change the time constant',
    question: 'With the same input, does the shape of the curve over time change?',
    introduction: 'τ is the time constant that sets, in this model, how fast a cell changes toward its effective input. In this experiment we increase only the τ value of O1; the other seven cells stay at 30 ms. A larger τ makes a slower update under the same momentary conditions. With an input that changes over time, the direction of the peak value has to be read separately from the result.',
    changed: 'Only the model time constant τ of cell O1.',
    held: 'The τ value of the other seven cells (30 ms), the circuit and its weights, the stimulus amplitude, onset and duration, the initial state and the computation step.',
    predictionPrompt: 'How might the peak value change when the time constant of O1 increases?',
    predictionOptions: [
      { id: 'increase', label: 'It may be higher' },
      { id: 'decrease', label: 'It may be lower' },
      { id: 'similar', label: 'It may stay close or the same' },
      { id: 'unsure', label: 'I’m not sure; I’ll compare first' },
    ],
    observe: 'Do not stop at reading the peak time alone. Compare the part after the stimulus turns off and the value at the end of the experiment too. In an experiment of fixed duration, the final value need not have returned to rest yet.',
    boundary: 'The τ values are model parameters chosen for teaching; they are not presented as the measured membrane time constant of a particular animal cell. The ms in the chart is the model’s time scale.',
  },
]

/** English twin of `guidedPrinciples`, in the same order. */
export const guidedPrinciplesEn: typeof guidedPrinciples = [
  'First write down which quantity you changed. Check that the other conditions stayed fixed.',
  'A prediction is optional. It can be written before the result is seen too; it is not an achievement score.',
  'Changing a parameter does not update the recorded result. Run again for the new settings.',
  'Read the numbers and the lines from the same condition record; do not interpret an old result as if it belonged to the new settings.',
  'A result holds under the assumptions of this model. A real animal requires independent validation.',
]
