export const assumptionSources = [
  { title: 'Cook ve ark., 2019 — konnektomların oluşturulması ve EM ağırlıkları', url: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { title: 'WormWiring — yazarların düzeltilmiş bağlantı tabloları', url: 'https://wormwiring.org/pages/adjacency.html' },
  { title: 'Liu ve ark., 2017 — elektriksel bağlantılarda doğrultucu iletim', url: 'https://www.nature.com/articles/ncomms14818' },
  { title: 'Randi ve ark., 2023 — deneysel işlevsel bağlantı atlası', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
] as const

export const assumptionVariables = [
  { id: 'chemical-gain', label: 'Kimyasal model çarpanı', short: 'Kimyasal çarpan', baseline: .8, initial: 1.2, min: 0, max: 1.5, step: .1, unit: 'boyutsuz', scope: 'Bütün kimyasal model bağlantıları', explanation: 'Ham kimyasal kayıtlar aynı kalır. Seçilen çarpan, normalize edilmiş kimyasal model ağırlıklarını birlikte değiştirir. Sıfır seçmek anatomik bağlantıları silmez; bu modeldeki kimyasal katkılarını sıfırlar. Bu normalizasyonda gelen kimyasal bağlantısı olan her hücrenin model ağırlıkları toplamı tam olarak çarpana eşittir; bu yüzden 1 bir eşiktir. Çarpan 1’in altındayken etkinlik uyaran bitince söner. 1’in üstünde yönlü kimyasal döngüler etkinliği kendi kendine besleyebilir ve kısa bir uyaran bile ağın çoğunu üst sınıra (1) taşıyabilir. Bu biyolojik bir bulgu değil, seçilen normalizasyonun ve modelin sonucudur.' },
  { id: 'gap-gain', label: 'Elektriksel model çarpanı', short: 'Elektriksel çarpan', baseline: .2, initial: .6, min: 0, max: 1, step: .1, unit: 'boyutsuz', scope: 'Bütün fiziksel çiftlerin model bağ katsayıları', explanation: 'Ham elektriksel çiftler aynı kalır. Değişen, seçilmiş simetrik difüzyon modelinin boyutsuz katsayısıdır. Bu sayı biyolojik iletkenlik birimi değildir; sıfır seçilince anatomik çiftler korunur.' },
  { id: 'time-constant', label: 'Ortak model zaman sabiti τ', short: 'Zaman sabiti τ', baseline: 30, initial: 90, min: 15, max: 120, step: 5, unit: 'model ms', scope: 'Bütün 30 hücrenin zaman sabiti', explanation: 'Bu deneyde τ bütün 30 hücrede birlikte değişir. Önceki rehberli dersteki yalnız O1’e uygulanan değişiklikten farklıdır. Bağlantıların ham ve normalize ağırlıkları korunur; yanıtların zaman içindeki gelişimi değişebilir.' },
] as const

export const assumptionCopy = {
  lead: 'Aynı anatomiyi kullanmak, aynı dinamik sonucu garanti etmez. Burada kaynaktan gelen kayıtları bizim seçtiğimiz denklemlerden ve sayılardan ayırıyoruz.',
  raw: 'Ham birim seri elektron mikroskopisi (EM) kesiti ağırlığıdır. Bir bağlantının ağırlığı, sinapsların sayısını ve boyutunu birlikte yansıtır; doğrudan sinaps sayısı değildir. Bu içe aktarım ayrı bir sinaps sayısı vermiyor. Sinaps sayısı bilinse bile sayı tek başına ölçülmüş etki gücü olmaz.',
  identity: 'Hücre kimliği ve sınıfı kaynak listesinden gelir. AVER’i uyarmak, AVAR’ı okumak ise deney seçimidir; kaynakta bu hücrelere atanmış girdi/çıktı rolleri değildir. Kaynak koordinatları Excel sayfası, satır, sütun ve hücre adresidir. Bu JSON gerçek anatomik 3D konum veya morfoloji taşımaz.',
  composite: 'Cook ve arkadaşlarının konnektomları birden fazla EM serisinden birleştirilen kayıtlar ve tamamlanan tahminler içerir. Bu alt küme tek hayvandan doğrudan ölçülmüş, eksiksiz bir beyin olarak sunulmaz. Sayılarımız yayımdaki tüm hayvanın değil, yerelde seçilmiş alt ağın sayılarıdır.',
  signs: 'Bu içe aktarılmış anatomi verisinde ölçülmüş iletici, reseptör ve kimyasal etki işaretleri yok. Model bütün kimyasal işaretleri pozitif varsayar. Bu, anatominin uyarıcı etkiyi doğruladığı anlamına gelmez; başka kaynaklarda bu özelliklerin bilinmediğini de söylemez.',
  gap: 'Bir elektriksel çiftin tek kayıt olması veya matriste karşılıklı bulunması, iki yönde eşit fizyolojik akım göstermez. Model simetrik g·(komşu − hücre) difüzyonu ekler. Belirli solucan bağlantılarında doğrultucu iletim ölçülmüştür; bu araştırma buradaki her çiftin akım yönünü belirlemez.',
  normalization: 'Normalizasyon, ham kaydı boyutsuz model katsayısına dönüştüren seçimdir. Paydalar yalnız bu 30 hücrelik alt grafikteki gelen veya hücreye değen ham ağırlık toplamlarıdır; hayvanın bütün ağı değildir. Çarpanlar ve normalize ağırlıklar ölçülmüş sinaptik güç ya da iletkenlik değildir.',
  dynamics: 'Çıktı x, 0–1 aralığında boyutsuz sürekli model aktivitesidir. Zar gerilimi, Hz cinsinden ateşleme hızı, kalsiyum ölçümü veya olay sayısı değildir. Zaman sabitleri, 1 ms hesap adımı, uyaran ve sıfır başlangıç bu deney için seçilmiştir; bu anatomi dosyasından ölçülmüş fizyoloji olarak çıkarılmaz.',
  boundary: 'Dış kimyasal katkı sıfır varsayılır; dış elektriksel bağlar modele alınmaz. Dışarıdaki hücreler biyolojide silinmiş veya sıfıra sabitlenmiş değildir. Alt ağ sınırı da bir model seçimidir ve başka ağ sınırları farklı sonuçlar verebilir.',
  experiment: 'Bir değişken seç. Temel koşul sabit: kimyasal çarpan 0,8; elektriksel çarpan 0,2; bütün hücrelerde τ = 30 model ms. İkinci koşulda yalnız seçtiğin parametre değişir. “Deneyi çalıştır” iki koşulu mevcut simülasyon motoruyla hesaplar; ana devre deneyindeki ayarlarını değiştirmez.',
  validation: 'Bir hesaplanan eğri, seçilen denklemlerin sonucudur. Farklı zaman adımlarıyla tutarlı çözüm elde etmek sayısal yakınsamayı sınar; hayvanın biyolojisini doğrulamaz. Bu sayfa hesap adımını değiştirmiyor ve yeni bir yakınsama testi yürütmüyor.',
  physiology: 'Biyolojik karşılaştırma için bağımsız fizyolojik ve davranışsal ölçümler gerekir. Randi ve arkadaşlarının işlevsel atlası, uyarım sonrası kalsiyum yanıtlarını araştırır; anatomik bağlantıyla işlevsel yanıtı aynı şey saymaz. Circuitiary bu sayfada o deneysel yanıtları içe aktarmış veya onlara uyum sağlamış değildir.',
  questions: 'Bir modeli değerlendirirken şunu sor: Hangi bilgi kaynaktan geldi? Hangi değer seçildi? Sonuç başka makul parametrelerle değişiyor mu? Ölçülen hayvan yanıtıyla hangi nicelik, hangi koşulda karşılaştırıldı?',
  sweep: 'Yukarıdaki karşılaştırma kimyasal çarpan için tek bir değeri sınar. Burada aynı koşulu 15 çarpan için art arda hesaplıyoruz: 0,2’den 1,6’ya 0,1’lik adımlarla. Her hesapta elektriksel çarpan 0,2, τ 30 model ms ve AVER darbesi aynıdır; yalnız kimyasal çarpan değişir. Çizgiler AVAR’ın kayıt içindeki tepe aktivitesini ve 700 model ms’deki son değerini gösterir. Bu normalizasyonda gelen kimyasal bağlantısı olan her hücrenin model ağırlıkları toplamı çarpana eşittir; 1 bu yüzden işaretli bir eşiktir. Eşik, bu modelin bir özelliğidir: ağırlıklar hedefe gelen ham toplamla normalize edilir ve bütün hücreler açık, eşzamanlı Euler adımıyla güncellenir. Ölçülmüş biyolojik bir eşik veya bulgu değildir.',
  sweepWindow: 'Eşiğin hemen üstünde yükselme 700 model ms’den uzun sürebilir; bu yüzden son değer bu kayıt penceresine bağlıdır. Daha uzun bir kayıtta eşiğe yakın çarpanların son değeri de değişir. Aralarındaki çizgiler hesaplanmamış değerler hakkında bilgi vermez.',
  local: 'Veri aynı uygulamanın yerel /api/local-connectome adresinden okunur; ham dosyalar ve türetilmiş alt küme yerelde tutulur. Dosyaya özgü yeniden dağıtım izni doğrulanmış değildir. Açık erişim, açık lisans anlamına gelmez. Bu sayfa veriyi dışarı yüklemez.',
} as const

export const sweepPrediction = {
  prompt: 'Kimyasal çarpan 0,9’dan 1,1’e çıkınca AVAR’ın 700 model ms’deki son değeri nasıl değişir?',
  hint: 'Çarpan bu aralıkta yaklaşık 1,2 kat büyür. Tahmin isteğe bağlıdır; “emin değilim” de bir başlangıçtır.',
  options: [
    { id: 'proportional', label: 'Çarpanla aynı mertebede, yaklaşık orantılı artar' },
    { id: 'steep', label: 'Çarpandan çok daha hızlı, birkaç kat artar' },
    { id: 'flat', label: 'Hemen hiç değişmez' },
    { id: 'unsure', label: 'Emin değilim; önce taramaya bakacağım' },
  ],
} as const

/**
 * The type of an English twin: the Turkish constant's shape with ids, addresses and numbers
 * fixed and every other text free. A twin with another id, order, length or number fails the type check.
 */
export type Translated<T> = T extends string ? string : T extends number ? T : { readonly [K in keyof T]: K extends 'id' | 'url' ? T[K] : Translated<T[K]> }

export const assumptionSourcesEn: Translated<typeof assumptionSources> = [
  { title: 'Cook et al., 2019 — construction of the connectomes and EM weights', url: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { title: 'WormWiring — the authors’ corrected connectivity tables', url: 'https://wormwiring.org/pages/adjacency.html' },
  { title: 'Liu et al., 2017 — rectifying conduction at electrical connections', url: 'https://www.nature.com/articles/ncomms14818' },
  { title: 'Randi et al., 2023 — experimental functional connectivity atlas', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
]

export const assumptionVariablesEn: Translated<typeof assumptionVariables> = [
  { id: 'chemical-gain', label: 'Chemical model gain', short: 'Chemical gain', baseline: .8, initial: 1.2, min: 0, max: 1.5, step: .1, unit: 'dimensionless', scope: 'All chemical model connections', explanation: 'The raw chemical records stay the same. The chosen gain changes the normalized chemical model weights together. Choosing zero does not delete the anatomical connections; it sets their chemical contribution in this model to zero. In this normalization, the model weights of every cell that has an incoming chemical connection sum to exactly the gain; that is why 1 is a threshold. While the gain is below 1, activity dies out once the stimulus ends. Above 1, directed chemical loops can feed activity back into itself, and even a short stimulus can carry most of the network to the upper bound (1). This is not a biological finding; it is a result of the chosen normalization and of the model.' },
  { id: 'gap-gain', label: 'Electrical model gain', short: 'Electrical gain', baseline: .2, initial: .6, min: 0, max: 1, step: .1, unit: 'dimensionless', scope: 'Model coupling coefficients of all physical pairs', explanation: 'The raw electrical pairs stay the same. What changes is the dimensionless coefficient of the chosen symmetric diffusion model. This number is not a unit of biological conductance; when zero is chosen, the anatomical pairs are kept.' },
  { id: 'time-constant', label: 'Shared model time constant τ', short: 'Time constant τ', baseline: 30, initial: 90, min: 15, max: 120, step: 5, unit: 'model ms', scope: 'The time constant of all 30 cells', explanation: 'In this experiment τ changes in all 30 cells together. This differs from the change in the earlier guided lesson, which was applied to O1 only. The raw and normalized weights of the connections are kept; how the responses develop over time can change.' },
]

export const assumptionCopyEn: Translated<typeof assumptionCopy> = {
  lead: 'Using the same anatomy does not guarantee the same dynamic result. Here we separate the records that come from the source from the equations and numbers that we chose.',
  raw: 'The raw unit is the serial electron microscopy (EM) section weight. The weight of a connection reflects the number and the size of the synapses together; it is not a direct synapse count. This import does not give a separate synapse count. Even if the synapse count were known, the count alone would not be a measured strength of effect.',
  identity: 'Cell identity and class come from the source list. Stimulating AVER and reading AVAR, however, is a choice of the experiment; they are not input/output roles assigned to these cells in the source. The source coordinates are the Excel sheet, row, column and cell address. This JSON carries no real anatomical 3D position or morphology.',
  composite: 'The connectomes of Cook and colleagues contain records combined from more than one EM series and filled-in estimates. This subset is not presented as a complete brain measured directly from a single animal. Our numbers are those of the locally selected subnetwork, not of the whole animal in the publication.',
  signs: 'This imported anatomy data has no measured transmitters, receptors or signs of chemical effect. The model assumes that every chemical sign is positive. This does not mean that the anatomy confirms an excitatory effect; nor does it say that these properties are unknown in other sources.',
  gap: 'That an electrical pair is a single record, or appears reciprocally in the matrix, does not show equal physiological current in both directions. The model adds symmetric g·(neighbor − cell) diffusion. Rectifying conduction has been measured at particular worm connections; that research does not determine the direction of current of every pair here.',
  normalization: 'Normalization is the choice that turns a raw record into a dimensionless model coefficient. The denominators are only the totals of raw weight arriving at, or touching, a cell within this 30-cell subgraph; they are not the whole network of the animal. The gains and the normalized weights are not measured synaptic strength or conductance.',
  dynamics: 'The output x is a dimensionless continuous model activity in the range 0–1. It is not membrane voltage, a firing rate in Hz, a calcium measurement or an event count. The time constants, the 1 ms calculation step, the stimulus and the zero start were chosen for this experiment; they are not derived from this anatomy file as measured physiology.',
  boundary: 'The external chemical contribution is assumed to be zero; external electrical connections are not taken into the model. The cells outside are not deleted or fixed at zero in biology. The subnetwork boundary is also a model choice, and other network boundaries can give different results.',
  experiment: 'Choose one variable. The baseline condition is fixed: chemical gain 0.8; electrical gain 0.2; τ = 30 model ms in all cells. In the second condition only the parameter you chose changes. “Run the experiment” computes the two conditions with the existing simulation engine; it does not change your settings in the main circuit experiment.',
  validation: 'A computed curve is the result of the chosen equations. Obtaining a consistent solution with different time steps tests numerical convergence; it does not validate the biology of the animal. This page does not change the calculation step and does not run a new convergence test.',
  physiology: 'A biological comparison needs independent physiological and behavioral measurements. The functional atlas of Randi and colleagues investigates calcium responses after stimulation; it does not treat anatomical connection and functional response as the same thing. On this page Circuitiary has not imported those experimental responses and has not been fitted to them.',
  questions: 'When you evaluate a model, ask: Which information came from the source? Which value was chosen? Does the result change with other plausible parameters? Which quantity was compared with the measured animal response, and under which condition?',
  sweep: 'The comparison above tests a single value of the chemical gain. Here we compute the same condition for 15 gains one after another: from 0.2 to 1.6 in steps of 0.1. In every calculation the electrical gain is 0.2, τ is 30 model ms and the AVER pulse is the same; only the chemical gain changes. The lines show AVAR’s peak activity within the recording and its final value at 700 model ms. In this normalization, the model weights of every cell that has an incoming chemical connection sum to the gain; that is why 1 is a marked threshold. The threshold is a property of this model: the weights are normalized by the raw total arriving at the target, and all cells are updated with an explicit, synchronous Euler step. It is not a measured biological threshold or finding.',
  sweepWindow: 'Just above the threshold the rise can take longer than 700 model ms; the final value therefore depends on this recording window. In a longer recording the final value of the gains near the threshold changes too. The lines between the points give no information about values that were not computed.',
  local: 'The data is read from the local /api/local-connectome address of the same application; the raw files and the derived subset are kept locally. A redistribution permission specific to the file has not been verified. Open access does not mean an open license. This page does not upload the data anywhere.',
}

export const sweepPredictionEn: Translated<typeof sweepPrediction> = {
  prompt: 'When the chemical gain rises from 0.9 to 1.1, how does AVAR’s final value at 700 model ms change?',
  hint: 'The gain grows about 1.2 times over this range. The prediction is optional; “I am not sure” is a start too.',
  options: [
    { id: 'proportional', label: 'It rises roughly in proportion, on the same order as the gain' },
    { id: 'steep', label: 'It rises much faster than the gain, several times over' },
    { id: 'flat', label: 'It hardly changes at all' },
    { id: 'unsure', label: 'I am not sure; I will look at the sweep first' },
  ],
}
