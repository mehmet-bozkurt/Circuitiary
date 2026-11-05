# Paylaş ve dışa aktar

Devre deneyleri sayfasında (`/`) grafiklerin ve hücre listesinin hemen üstünde “Paylaş ve dışa aktar” bölümü vardır. İki iş yapar: deneyin ayarlarını bir bağlantıya yazar ve sonuçları CSV veya JSON dosyası olarak indirtir. Sunucu, hesap ya da ağ isteği yoktur; bağlantı ayarları adres çubuğundaki sorgu dizgisinde, dosyalar tarayıcıda üretilen bir `Blob` içindedir.

Her ikisi de bir **model çıktısını** taşır. Etkinlik değerleri öğretici modelin boyutsuz sayılarıdır (0–1 aralığı); ölçüm, zar gerilimi, kalsiyum sinyali veya ateşleme hızı değildir. Gerçek veri modunda anatomi Cook2019 kaynağından gelir, dinamik ise bu uygulamanın varsayımsal modelidir (bkz. `scientific-scope.md`).

## Ayarları bağlantı olarak paylaş

Bağlantı yalnız ayarları taşır, sonuçları değil. Bağlantıyı açan kişinin tarayıcısı aynı modeli aynı ayarlarla yeniden çalıştırır; tepe etkinlik değerleri bu yüzden iki tarafta aynıdır.

### Anahtarlar

Anahtarlar kısadır ve bağlantıda bu sırayla yazılır. Gerçek veri modunda olmayan `cg`, `gg` ve `fc` sekiz hücreli örnekte yazılmaz.

| Anahtar | Ayar | Geçerli değerler |
| --- | --- | --- |
| `m` | Devre modu | `illustrative` (sekiz hücreli örnek), `real` (C. elegans, yerel veri) |
| `v` | Devre görünümü | `2d`, `3d` |
| `c` | Grafikte gösterilen koşul | `baseline`, `silenced`, `tau` |
| `st` | Uyaranın girdiği hücre | Devrenin giriş hücrelerinden biri (gerçek modda her hücre) |
| `am` | Uyaran gücü | 0–1, adım 0,05 |
| `du` | Uyaran süresi (ms) | 50–400, adım 10 |
| `tb` | Referansta tüm hücrelerin τ değeri (ms) | 10–80, adım 5 |
| `tn` | Zaman sabiti değişen hücre | Devredeki herhangi bir hücre |
| `tc` | O hücrenin τ değeri (ms) | 10–180, adım 5 |
| `se` | Susturulan bağlantı | Devredeki bir bağlantı kimliği |
| `o` | Okunan (çıktı) hücre | Okuma listesindeki hücrelerden biri |
| `n` | Seçili hücre | Devredeki herhangi bir hücre |
| `dt` | Zaman adımı (ms) | 0,0625 · 0,125 · 0,25 · 0,5 · 1 · 2 |
| `cg` | Kimyasal katsayı (yalnız gerçek mod) | 0–2, adım 0,1 |
| `gg` | Gap katsayısı (yalnız gerçek mod) | 0–1, adım 0,1 |
| `fc` | Seçili hücreye odaklan (yalnız gerçek mod) | `1`, `0` |
| `sc` | Yanıta göre dikey ölçek | `1`, `0` |

Sayılar nokta ondalıkla yazılır (`am=0.45`); bu makine okunur biçimdir, ekranda gösterilen sayılar yine ondalık virgüllüdür. Aralıklar ve adımlar ekrandaki kaydırıcılarınkiyle aynıdır; bir test bunu sayfadan okuyarak denetler.

Örnek: `/?m=illustrative&v=2d&c=silenced&st=S2&am=0.45&du=150&tb=45&tn=I3&tc=60&se=I4-O1&o=O2&n=I4&dt=0.5&sc=1`

### Taşınmayanlar

Oynatma konumu ve oynatma durumu bağlantıya girmez: bağlantı duraklatılmış ve varsayılan anda (250 ms) açılır. Eğriler ve tepe değerler bunlara bağlı değildir. Tema tercihi de kişiseldir ve taşınmaz.

### Açılışta doğrulama

Bağlantı yalnız deney sayfasında okunur ve **katı** doğrulanır:

- Bilinmeyen anahtarlar (`utm_source` gibi) sessizce atlanır.
- Bir anahtar iki kez yazılmışsa belirsizdir; ikisi de yok sayılır.
- Sayı düz bir ondalık nokta yazımı olmalıdır (virgül, işaret, üstel yazım, baştaki sıfır yok), aralıkta ve kaydırıcı adımında olmalıdır. Listeden seçilen değerler (mod, görünüm, koşul, zaman adımı) tam eşleşmelidir.
- Hücre ve bağlantı kimlikleri, seçilen modun devresinde bulunmalıdır. Örnekte olmayan bir kimlik yok sayılır.
- Geçerli parçalar uygulanır, geçersizler atlanır. Eksik kalan ayarlar seçilen modun varsayılanıdır.

Sonucu sayfa “Paylaş ve dışa aktar” bölümünün üstündeki bir durum satırında (`role="status"`, nazik duyuru) söyler:

- “Bağlantıdaki ayarlar uygulandı.” Geçersiz parça varsa ardından adlarıyla sayılır (“Uyaran gücü, Okunan hücre”).
- Hiçbir parça geçerli değilse: “Bağlantıda geçerli ayar bulunamadı; varsayılan deney açıldı.”
- Bağlantı gerçek veri modunu istiyor ama yerel veri bu bilgisayarda yoksa ya da yüklenemezse: sekiz hücreli örnek açılır. Hücre ve bağlantı seçimleri (gerçek modun kimlikleri) ile gerçek moda özgü ayarlar uygulanmaz; sayısal ayarlar (uyaran, τ, zaman adımı) uygulanır ve durum satırı bunu söyler.

Adreste anahtarlarımızdan hiçbiri yoksa hiçbir ileti gösterilmez. Adres çubuğu ve geçmiş açılışta değiştirilmez. “Bilinmeyen adres” uyarısı yalnız yola (`pathname`) bakar, sorgu dizgisi onu tetiklemez.

### Bağlantıyı kopyala

“Bağlantıyı kopyala” düğmesi tam adresi `navigator.clipboard.writeText` ile panoya yazar. Pano API'si yoksa ya da reddedilirse salt okunur “Paylaşım bağlantısı” alanı seçilir ve `execCommand('copy')` denenir. İkisi de olmazsa alanda seçili kalır ve durum satırı elle kopyalamayı söyler. Sonuç `role="status"` satırında bildirilir. Alan her zaman görünürdür ve kontrollerle birlikte güncellenir. Kopyalamak adres çubuğunu değiştirmez ve geçmişe giriş eklemez.

## Dışa aktar

Dosya adları ASCII'dir ve devreyi, koşulu veya okunan hücreyi söyler.

| Dosya | Ad |
| --- | --- |
| CSV | `circuitiary-sekiz-hucreli-referans.csv`, `…-baglanti-susturuldu.csv`, `…-zaman-sabiti-degisti.csv` (gerçek modda `circuitiary-c-elegans-yerel-…`) |
| JSON | `circuitiary-sekiz-hucreli-O1-uc-kosul.json` (gerçek modda `circuitiary-c-elegans-yerel-AVAR-uc-kosul.json`) |

### CSV

Grafikte gösterilen koşulun tüm hücrelerini içerir.

- Virgülle ayrılmış, UTF-8, BOM yok, satır sonu `\n`, dosya bir satır sonuyla biter.
- İlk satır başlıktır: `time_ms` ve ardından devrenin hücre sırasıyla her hücre için bir sütun (örnekte `S1,S2,I1,I2,I3,I4,O1,O2`).
- Her sonraki satır bir zaman örneğidir. Ondalık ayracı **nokta**dır; en çok sekiz ondalık yazılır, sondaki sıfırlar atılır, sayı eksi sıfır olmaz. Bilimsel gösterim kullanılmaz.
- Virgül, tırnak veya satır sonu içeren hücreler RFC 4180'e göre tırnaklanır (kimlikler normalde buna ihtiyaç duymaz). Bir hücrenin serisi yoksa hücre uydurma bir sayı yerine boş bırakılır.
- Satır sayısı `700 / dt + 1`'dir (1 ms adımla 701 satır).

Gerçek modda sütun sayısı altgraftaki nöron sayısı kadardır (30 hücre). Dosyada kaynak bilgisi yoktur; CSV başlığını bozmamak için bilerek eklenmedi. Kaynak künyesi JSON'dadır.

### JSON

Okunan hücrenin üç koşuldaki serisini ve ayarları taşır. Sayı dizileri tek satırda yazılır.

```json
{
  "format": "circuitiary-output-series",
  "formatVersion": 1,
  "app": { "name": "Circuitiary", "version": "0.1.0" },
  "note": "Model çıktısı; ölçüm değildir",
  "scope": "Öğretici kurgusal devre; biyolojik veri veya doğrulanmış davranış emülasyonu değildir.",
  "mode": "illustrative",
  "circuit": { "id": "…", "name": "…", "neuronCount": 8, "connectionCount": 12 },
  "settings": {
    "durationMs": 700, "dtMs": 1, "baseTauMs": 30,
    "stimulus": { "target": "S1", "onsetMs": 100, "durationMs": 200, "amplitude": 0.8 },
    "silencedConnection": "I3-O1",
    "tauOverridesMs": { "O1": 90 }
  },
  "output": {
    "cell": "O1",
    "unit": "boyutsuz etkinlik, 0 ile 1 arası",
    "timesMs": [0, 1, 2],
    "conditions": {
      "baseline": { "label": "Referans", "peak": 0.663, "activity": [0, 0, 0] },
      "silenced": { "label": "Bağlantı susturuldu", "peak": 0, "activity": [0, 0, 0] },
      "tau": { "label": "Zaman sabiti değişti", "peak": 0, "activity": [0, 0, 0] }
    }
  }
}
```

(Sayılar örnek gösterim içindir. Diziler gerçek dosyada tüm örnekleri içerir; `peak`, ilgili serinin en büyük değeridir ve sayfadaki tepe etkinlikle aynıdır.)

- `settings` simülasyonun çalıştığı ayarlardır: kayıt süresi, zaman adımı, referans τ, uyaran, susturulan bağlantı ve τ'sı değiştirilen hücre. Gerçek modda ayrıca `chemicalGain` ve `gapGain` yazılır.
- `app.version`, `package.json` sürümüdür.
- `note` her dosyada aynıdır ve değişmez: “Model çıktısı; ölçüm değildir”.
- Gerçek modda `source` alanı sayfanın zaten gösterdiği kaynak künyesini taşır: veri kümesi (`id`, `title`, `version`, `doi`), kaynak dosyalar (`name`, `url`, `sha256`, `downloadedAtUtc`), lisans durumu (`unverified-local-only`) ve “yeniden dağıtım izni doğrulanmadı; yalnız yerel kullanım” ifadesi. Anatomi tabloları (ham ağırlıklar, kaynak hücre koordinatları) bu dosyaya **yazılmaz**; yalnız türetilmiş model serileri yazılır.
- Sayılar en çok sekiz ondalığa yuvarlanır.

Sayfadaki eski “Deney kaydını indir” düğmesi değişmedi: devrenin tamamını, üç koşulun tüm hücre sonuçlarını ve (gerçek modda) anatomiyi içeren daha büyük kayıt onunla indirilir.

## Sınırlar

- Bağlantı kalıcı değildir ve sonuç taşımaz. Model veya varsayılan değerler değişirse eski bağlantı farklı sayılar üretebilir; JSON'daki `app.version` bu yüzden yazılır. Bağlantıya sürüm anahtarı eklenmedi.
- Bağlantı uzundur (yaklaşık 120–180 karakter). Kısaltma hizmeti yoktur; ağ isteği yapılmaz.
- Dosya içe aktarma yoktur: JSON ve CSV yalnız dışa aktarılır.
- CSV virgülle ayrılır ve nokta ondalık kullanır. Türkçe yerel ayarlı Excel genellikle noktalı virgül ve ondalık virgül bekler; dosyayı çift tıklayarak açmak yerine “Veri > Metin/CSV'den” ile ayraç olarak virgülü seçmek gerekir.
- Gerçek veri bağlantısı yalnız yerel verinin bulunduğu bir bilgisayarda gerçek modu açar; kaynak dosyaların yeniden dağıtım izni doğrulanmadığı için veri bağlantıyla taşınmaz.
- Gerçek mod serileri türetilmiş model çıktısıdır; yine de yerel veriye dayandığından JSON'daki lisans uyarısı geçerlidir.

## Nasıl doğrulanır

- `src/shareState.test.ts`: anahtar sırası ve benzersizliği, nokta ondalık yazım ve kayan nokta gürültüsünün temizlenmesi, her kaydırıcı uç değeri ve her zaman adımı için gidiş-dönüş, katı doğrulama (tür, aralık, adım, virgül/işaret/üstel/baştaki sıfır yazımları, tekrarlı anahtar, boş/uzun/denetim karakterli kimlik, `constructor` gibi adlar), devrede olmayan kimliklerin atılması, gerçek moda özgü ayarların örnekte sessizce atılması, gerçek veri yoksa geri dönüş ve durum iletileri.
- `src/exportData.test.ts`: sayı biçimi, CSV kaçışı, sütun sırası, eksik seri, ondalık virgül ve BOM olmaması, dosya adları (ASCII), JSON şekli, üç koşulun serisi ve tepeleri, not, sürüm ve gerçek moddaki kaynak künyesi.
- `tests/share-export.spec.ts` (Playwright): kopyalama (durum satırı, panoya yazılan metin, adres çubuğu ve geçmiş değişmez, klavye), pano API'siz geri dönüş ve hiçbir şeyin kopyalamadığı durum, kopyalanan bağlantıyı yeni sayfada açınca **aynı tepe değerleri** ve aynı kontrol değerleri, geçersiz/tekrarlı/bilinmeyen parçalar, sorgu dizgisinin bilinmeyen adres uyarısını tetiklememesi, başka sayfanın sorgusunun okunmaması, kaydırıcı aralıklarının sayfayla aynı olması, gerçek veri bağlantısı (katsayılar, odak, seçimler) ve yerel veri yokken geri dönüş, CSV ve JSON indirmeleri (`waitForEvent('download')` ile iner, dosya ayrıştırılır; CSV sütunları hücre düğmelerindeki değerlerle, JSON ve CSV tepeleri sayfadaki tepelerle karşılaştırılır), gerçek modda kaynak künyesinin sayfadaki SHA-256 değerleriyle aynı olması ve anatominin dosyaya girmemesi, 390 px genişlikte taşma olmaması ve 44 px hedefler.
- Panelin durumları `tests/support/page-states.ts` içindeki “share link notice and copy status” durumuyla kontrast, ondalık virgül ve erişilebilir ad denetimlerinden geçer.
