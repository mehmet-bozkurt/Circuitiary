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
