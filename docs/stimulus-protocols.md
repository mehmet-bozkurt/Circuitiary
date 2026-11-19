# Uyaran protokolleri

Ana deney sayfası bir hücreye girdi verir ve aynı girdiyi üç koşulda (A referans, B bağlantı susturuldu, C zaman sabiti değişti) izler. Bugüne kadar bu girdi tek biçimdeydi: dikdörtgen bir darbe. **Uyaran protokolleri**, "DENEYİ KUR" panelinin uyaran bölümüne iki seçim ekler: girdinin **biçimi** (darbe, rampa, sinüs) ve isteğe bağlı, tekrarlanabilir bir **girdi gürültüsü**. Örnek sorular: "Aynı güçte yavaş yükselen bir girdi O1'i darbe kadar yükseltir mi?", "Girdi 100 ms'lik bir ritimle salınırsa çıktı bu ritmi ne kadar taşır?", "Girdiye dalgalanma eklenince tepe değeri ne kadar oynar?"

Varsayılan durum (darbe, gürültü kapalı) sayfanın bu özellikten önceki hâlidir: aynı hesap, aynı sayılar, aynı paylaşım bağlantısı, aynı deney kaydı.

## Ne yapar

- **Uyaran biçimi** (`#stimulus-shape`): Darbe, Rampa ya da Sinüs. Üç koşul da aynı girdiyi alır.
- **Sinüs periyodu** (`#sine-period`): yalnız biçim Sinüs iken görünür; 50–400 ms, 10 ms adımla, varsayılan 100 ms. Başka bir biçim seçilince değeri saklanır ama hesaba girmez.
- **Girdi gürültüsü** (`#noise-amplitude`): 0–0,30, 0,05 adımla, varsayılan 0 (kapalı).
- **Yeni gürültü örneği çek**: yalnız gürültü 0'dan büyükken görünür. Tohumu bir artırır (1'den 9999'a, sonra yeniden 1); yanında o anki tohum yazar ("Tohum 3"). Aynı tohum her zaman aynı diziyi verir.
- **Grafikte girdi çizgisi**: biçim darbe değilse ya da gürültü açıksa, uyarılan hücreye verilen girdi I(t) etkinlik grafiğinde aynı 0–1 ekseninde ince bir çizgi olarak çizilir; göstergeye "Girdi I(t) · ince çizgi" eklenir ve grafiğin erişilebilir adına bir cümle eklenir. Sarı bant (uyaran penceresi) her durumda kalır. Varsayılan durumda çizgi, gösterge girdisi ve ek cümle yoktur.
- **Kullandığımız dinamik** kartında, o an kullanılan girdi formülü ve simgelerin anlamı yazar (yalnız varsayılan dışındaki durumlarda).
- **Sıfırla** dört ayarı da varsayılana döndürür (biçim, periyot, gürültü, tohum).
- **Sabitle ve karşılaştır** değişen protokol ayarlarını da listeler: biçim ve gürültü her zaman; periyot, iki eğriden biri sinüs kullanıyorsa; tohum, iki eğriden birinde gürültü açıksa. Örnek: `Uyaran biçimi: Darbe → Sinüs`.

## Formüller

Uyaran penceresi yarı açıktır: `[t₀, t₀ + T)`; `t₀` uyaranın başlangıcı (sayfada 100 ms), `T` uyaran süresi, `A` uyaran gücü. Pencerenin dışında `I(t) = 0`. Pencerenin içinde, `s = t − t₀` ile:

| Biçim | I(t) |
| --- | --- |
| Darbe (varsayılan) | `A` |
| Rampa | `A · s / T` (başlangıçta 0; pencerenin sonuna doğru `A` değerine yaklaşır) |
| Sinüs | `A · (1 − cos(2π · s / P)) / 2` (0 ile `A` arasında yükseltilmiş kosinüs; `P` periyot; başlangıçta 0, yarım periyotta `A`) |

Gürültü açıkken bu değere şu eklenir:

```
g · u(tohum, k),   k = ⌊s / h⌋,   u ∈ [−1, 1]
```

- `g` gürültü genliği (kaydırıcının değeri), `h` tutma aralığıdır; sayfada `h = 10 ms` sabittir (`NOISE_HOLD_MS`).
- `u`, tohum ile aralık numarasından hesaplanan bir özet (hash) değeridir (`unitNoise`): tohum ve aralık numarası 32 bitlik tamsayılar olarak karıştırılır (Murmur3 son karıştırıcısı), sonuç `[−1, 1]` aralığına ölçeklenir. Durum tutan bir üreteç değildir: bir aralığın değeri, başka hangi aralıkların hangi sırayla sorulduğuna bağlı değildir.
- Ek, her tutma aralığında sabittir. Bu yüzden **zaman adımından bağımsızdır**: dt ile dt/2 aynı zamanlarda aynı değeri okur. Her adımda yeniden örneklenen bir "beyaz gürültü" böyle olmazdı; adım küçüldükçe başka bir girdi olurdu ve sayfadaki dt/2 yakınsama denetimi anlamını yitirirdi. 10 ms, sayfanın sunduğu her zaman adımının (0,0625–2 ms) tam katıdır; hiçbir adım bir değer değişiminin üstüne denk gelmez.
- Toplam (`biçim + gürültü`) kendi başına kırpılmaz; 0'ın altına inebilir ya da 1'i aşabilir. Model her zamanki gibi hücrenin toplam girdisini kırpar: `clip(Σⱼ wᵢⱼ xⱼ + Iᵢ(t), 0, 1)`.
- Girdi, her Euler adımının sol ucunda okunur ve adım boyunca sabit tutulur (darbede de böyleydi). Rampa ve sinüs bu yüzden O(dt) hatayla örneklenir; hata adım küçüldükçe azalır.

## Sınırlar: bu ne değildir

- Biçimler, öğrenenin seçtiği **öğretim girdileridir**. Hiçbiri ölçülmüş bir uyaran, bir duyusal sinyalin ya da bir akım enjeksiyonunun kaydı değildir.
- "Gürültü" **sözde rastgele** bir sayı dizisidir: tohumu aynı kaldıkça aynı çıkar. **Biyolojik gürültünün modeli değildir** (kanal gürültüsü, sinaptik değişkenlik, ağ etkinliği gibi hiçbir süreci temsil etmez); dağılımı, genliği ve 10 ms'lik tutma aralığı biyolojik bir ölçüme dayanmaz. Modelin kendisine gürültü eklenmemiştir: ek yalnız uyarılan hücrenin girdisindedir, yalnız uyaran penceresi içindedir ve tümüyle belirlenimcidir.
- Etkinlik ve girdi boyutsuz model varsayımlarıdır; volt, akım ya da ateşleme hızı değildir.
- Girdi çizgisi kırpılmamış `I(t)` değeridir ve eksene göre yeniden ölçeklenmez. "Yanıta göre dikey ölçek" açıkken eksen 1'den küçük olabilir; çizginin eksenin dışında kalan kısmı (ve 0'ın altına inen kısmı) çizilmez.
- Girdi çizgisi grafiğin veri tablosuna ve CSV/JSON seri dışa aktarımına sütun olarak eklenmez. Deney kaydı ve JSON dışa aktarımı ise kullanılan ayarları (biçim, periyot, gürültü genliği, tohum, tutma aralığı) taşır; girdi bunlardan yeniden hesaplanabilir.
- Başlangıç zamanı (100 ms) ve tutma aralığı (10 ms) sayfada ayarlanamaz.
- Yalnız ana deney sayfasındadır; ders sayfaları, rehberli deneyler ve "Devre kur" kendi girdilerini kullanır.

## Varsayılan durumun korunması

- Motor: `config.stimulus` içindeki `shape`, `periodMs` ve `noise` isteğe bağlıdır. Verilmediklerinde `simulate` bit bit eski sonucu üretir ve `result.settings` içine hiçbir varsayılan yazılmaz (nesne eski biçimindedir).
- Sayfa: varsayılan protokolde motora verilen `stimulus` nesnesi eskisiyle aynıdır, fazladan anahtar yoktur (`protocolStimulus`). Periyot yalnız sinüste, gürültü yalnız genlik 0'dan büyükken motora geçer.
- Paylaşım bağlantısı: yeni anahtarlar yalnız varsayılandan farklıyken yazılır, `du` anahtarından sonra: `sh` (biçim: `pulse`/`ramp`/`sine`), `sp` (periyot), `na` (gürültü genliği), `ns` (tohum). Varsayılan deneyin bağlantısı eskisiyle aynıdır; bu anahtarları taşımayan eski bağlantılar varsayılanlarla ve "yok sayıldı" bildirimi olmadan açılır. Geçersiz değerler (bilinmeyen biçim, aralık ya da adım dışı sayı) adıyla bildirilir ve varsayılan korunur.
- Deney kaydı (`Deney kaydını indir`): `model.stimulusWindow` ve `model.noise: false` varsayılan durumda eskisiyle aynıdır. Bir biçim seçilince `stimulusWindow` pencereyle birlikte formülü de yazar; gürültü açıkken `noise`, genliği, tohumu, tutma aralığını ve "biyolojik gürültü modeli değildir" ifadesini içeren bir nesnedir.
- Grafik: varsayılan durumda üç `<path>` çizilir, `<polyline>` yoktur ve erişilebilir ad değişmez.

## Nerede

- `src/model/types.ts`: `StimulusShape`, `StimulusNoise`, `StimulusConfig`.
- `src/model/simulation.ts`: `stimulusValue` (I(t)), `unitNoise`, yeni alanların doğrulaması, `simulate` açıklaması.
- `src/stimulusProtocol.ts`: varsayılanlar ve aralıklar, `NOISE_HOLD_MS`, `protocolStimulus` (sayfa ayarlarından motor ayarı), `inputWaveform` (grafikteki çizgi), `exportedStimulusModel` (deney kaydındaki açıklama), `nextNoiseSeed`.
- `src/App.vue` + `src/App.messages.ts`: denetimler, alan notu, formül satırı, sıfırlama, paylaşım, deney kaydı (Türkçe ve İngilizce).
- `src/components/ActivationChart.vue` + `ActivationChart.messages.ts`: girdi çizgisi (`<polyline>`, çizim alanına kırpılır) ve erişilebilir ada eklenen cümle.
- `src/shareState.ts`, `src/learning/readingHandoff.ts` (`ExperimentDraft`): bağlantı anahtarları, katı ayrıştırma, alan adları.
- `src/pinnedCurve.ts`, `src/components/PinnedComparison.vue`: değişen protokol ayarlarının sayılması ve yazılması.

## Doğrulama

- `npx vitest run src/model/simulation.test.ts`: darbenin pencere kenarlarında eski kuralla aynı olması; rampanın başlangıçta 0 olup sonda güce ulaşması; sinüsün başlangıçta 0, yarım periyotta güce eşit olması; gürültünün tohuma göre tekrarlanabilir, tohumlar arasında farklı, tutma aralığında sabit, pencere dışında sıfır ve dt ile dt/2 için ortak zamanlarda aynı olması; motorun her adımın sol ucunda `stimulusValue` kullanması; gürültü açıkken adım yarılandıkça farkın yaklaşık yarılanması; varsayılan deneyin eski motorla aynı sayıları vermesi ve ayar nesnesinin biçimi; geçersiz alanların hata mesajları.
- `npx vitest run src/stimulusProtocol.test.ts`: varsayılan protokolün fazladan anahtar üretmemesi, denetim uçlarının motorca kabul edilmesi, tutma aralığının her zaman adımının tam katı olması, deney kaydı açıklaması.
- `npx vitest run src/shareState.test.ts src/pinnedCurve.test.ts src/App.messages.test.ts`: bağlantıda gidiş-dönüş, varsayılanın yazılmaması, geçersiz değerlerin bildirilmesi, eski bağlantılar; değişen ayar kuralları; iki dildeki metinler ve uyarı cümleleri.
- `npx playwright test tests/stimulus-protocols.spec.ts`: varsayılan durumun değişmemesi (üç eğri, çizgi yok, O1 tepe değeri 0,663, aynı bağlantı ve kayıt); her biçimin eğrileri değiştirip girdiyi çizmesi; periyot denetiminin yalnız sinüste görünmesi; gürültünün aynı bağlantıyla yeniden açıldığında aynı, yeni örnekle farklı olması; gürültü açıkken dt/2 farkının küçük kalması ve adımla azalması; her yeni denetimin dört hesap (üç koşul ve yakınsama denetimi) tetiklemesi; sıfırlama; paylaşım bağlantısı; deney kaydı; sabitle-karşılaştır listesi; etiketler, 44 px hedefler, klavye; dil değişimi.
