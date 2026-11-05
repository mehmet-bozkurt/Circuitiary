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
