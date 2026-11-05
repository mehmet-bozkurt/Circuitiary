# Devreyi okumak

Üçüncü öğrenme sayfası: `/ogren/devreyi-okumak`. Mevcut 30 hücrelik yerel Cook2019 / düzeltilmiş Temmuz2020 C. elegans altgrafı üzerinde bir hücrenin komşularını, dolaylı anatomik yolları, kimyasal döngüleri ve kaynak kayıtlarını okumayı öğretir. İlk iki öğrenme sayfası ve ana deney korunur; yeni bir simülasyon motoru veya veri kümesi eklenmedi.

## Okuma kapsamı

Altgraf 30 hücre, 196 yönlü kimyasal kayıt ve 50 tekil fiziksel elektriksel çift içerir. Beş kimyasal kayıt öz bağlantıdır. Hücre sınıfı SI4 kaynak sınıfıdır; ana deneyin kullanıcı tarafından atanan uyaran/çıktı rolünden ayrıdır.

Seçili hücrenin başka hücrelerden gelen kimyasal kayıtları, başka hücrelere giden kayıtları, tekil elektriksel çiftleri ve öz bağlantıları ayrı listelenir. Öz bağlantılar giriş/çıkış listelerinde ikinci kez sayılmaz. Her kayıt ham ağırlığı, kaynak çalışma sayfasını, Excel hücresini ve satır/sütun koordinatını gösterir. Elektriksel çiftin karşılıklı matris kaydı varsa onun koordinatı da korunur.

Ham ağırlık **seri elektron mikroskopisi kesiti ağırlığıdır**. Birden fazla temasın kesitleri toplanır; temas sayısı ve boyutunu birlikte yansıtır. Doğrudan sinaps sayısı, elektriksel iletkenlik veya ölçülmüş işlevsel güç değildir. Sinaps sayısı ayrıca bilinse bile tek başına fizyolojik etki gücünü belirlemez. Cook konnektomları birden fazla EM serisinden birleştirilmiş kayıtlar ve bazı tamamlayıcı tahminler içerir; her kaydı tek bir hayvanın eksiksiz ölçümü olarak sunmuyoruz.

## Yol ve döngü

“Yol bul”, seçilen kimyasal/elektriksel/karma modda **en az kenarlı** yolu deterministik genişlik öncelikli aramayla bulur. Kimyasal kayıtlar yalnız kaynak→hedef yönünde geçilir. Tek fiziksel gap kaydı iki yönde gezilebilir; ters geçişte aynı fiziksel kayıt kimliği, ağırlığı ve kaynak koordinatı korunur. Ham ağırlık yol maliyeti veya sıralama ölçütü değildir. Eşit uzunluktaki yollar hücre adı, bağlantı türü ve kayıt kimliğine göre deterministik seçilir.

Sonuç tek mümkün, en güçlü, en hızlı veya nedensel yol değildir. Hücreler ve adımlar şematik okuma sırasıdır; anatomik konum veya sinyalin fiziksel seyahat yolu gösterilmez. Önceki/sonraki adım düğmeleri ve doğrudan adım seçimi her kenarın gerçek kaynak kaydını inceletir. Değişen hücre, hedef veya bağlantı modu önceki yol sonucunu temizler; yeniden arama açık kullanıcı işlemiyle yapılır.

- **Doğrudan örnek:** AVER→AVAR kimyasal kayıt.
- **Dolaylı örnek:** RICL→AVAR→AVBR, iki kimyasal kenar; ham ağırlıklar 18 ve 4, SI5 `hermaphrodite chemical` sayfasında HE154 ve HC183. Ters AVBR→RICL kimyasal yolu bu altgraf içinde yoktur.
- **Elektriksel örnek:** AVER↔AVAR↔AVBL↔AVBR, üç fiziksel çift; ilk adım `gap:AVAR--AVER` kaydının ters yönde okunmasıdır.
- **Sınır örneği:** AIZL’den AVAR’a gap yolu bu altgraf içinde yoktur; AIZL’nin dışarıda sekiz gap kaydı bulunduğu ayrıca görünür.
- **Döngü örneği:** OLLL→AVER→OLLL, iki hücreli yönlü kimyasal döngü. OLLL→OLLL öz bağlantısı bunun dışında listelenir.

Başlangıç=hedef olduğunda sıfır kenarlı sonuç, öz bağlantı ve çok hücreli döngüden ayrılır. Yol yoksa yalnız seçilen mod ve 30 hücrelik okuma sınırı için olmadığı belirtilir. Ziyaret edilen hücre kümesi, döngülü grafikte sonsuz aramayı engeller. Bütün olası yollar sıralanmaz.

Kimyasal döngü araması, seçili hücreden başlayıp en az bir başka hücre üzerinden geri dönen en kısa yönlü kimyasal döngüyü bulur. Öz bağlantılar ayrı tutulur. Gap kaydını gidip ters dönerek okumak kimyasal geri bildirim döngüsü olarak sunulmaz. Yapısal döngü tek başına salınım, bellek veya sürekli etkinlik kanıtlamaz.

Gap çiftini iki yönde grafik olarak gezmek, eşit fizyolojik akım ölçüldüğü anlamına gelmez. Belirli C. elegans bağlantılarında doğrultucu iletim gösterilmiştir; bu bulgu seçilen her çiftin akım yönünü belirlemez. Bir anatomik yolun varlığı gerçek sinyal geçişini, kimyasal işareti, işlevsel etkiyi veya hayvan davranışını tek başına doğrulamaz.

## Dış bağlantılar ve yerel kaynak

Seçili hücrenin altgraf dışında bırakılan gelen/giden kimyasal kayıtlarının ve gap çiftlerinin sayıları ile ham ağırlık toplamları gösterilir. Bunlar biyolojide silinmiş bağlantılar değildir. Kaynak matrisindeki gap diagonal kayıtları metadata olarak ayrı açıklanır; fiziksel hücre çiftine dönüştürülmez.

Veri yalnız mevcut aynı-origin loopback `/api/local-connectome` GET uç noktasından alınır; 30 hücrelik JSON uygulama paketine gömülmez ve `public/` ya da `dist/` içine konmaz. Kaynak sürümü, seçim kuralı, orijinal dosya adları, URL’ler, edinim zamanı ve SHA-256 özetleri açılır kaynak ayrıntılarında korunur. Lisans `unverified-local-only` olarak kalır: dosyaya özgü yeniden dağıtım izni doğrulanmadı. Bu sayfa veriyi dışarı yüklemez veya yayımlamaz.

Yükleniyor, yerel dosya eksik, HTTP hatası ve geçersiz kaynak verisi ayrı durumlar olarak gösterilir. Hata boş bir konnektommuş gibi sunulmaz; “Tekrar dene” gerçek yerel GET isteğini tekrarlar. İsteklerin zaman aşımı ve kaldırılmış sayfaya geç sonuç yazmasını engelleyen korumaları vardır.

## Ana deneye açık aktarım

Hücre seçimi, komşu inceleme ve yol arama ana deneyi değiştirmez. Yalnız **“Ana deneyde bu hücreyi incele”** düğmesi aktarır.

Ana deney zaten gerçek veri modundaysa yalnız seçili inspector hücresi değişir. Uyaran hedefi, çıktı, susturulan bağlantı, zaman sabiti hücresi, genlik, süre, katsayılar, τ değerleri, dt, A/B/C koşulu, filtre/eksen seçenekleri, zaman imleci, oynatma ve 2D/3D görünümü korunur. Sayısal sonuçlar ve deney JSON’u, görüntülenen seçili hücre alanı dışında aynıdır. Açık 3D renderer yeniden oluşturulmaz.

İlk sekiz-hücreli→gerçek-veri aktarımında gerçek ağda bulunmayan hücre/kenar kimlikleri gerçek modun mevcut varsayılanlarına uyarlanır. Sayısal ayarlar, zaman, oynatma ve görünüm korunur; önceki sekiz hücreli deney taslağı ayrıca saklanır. Ana deneydeki mevcut **“Sekiz hücreli örnek”** düğmesi bu taslağı tam olarak geri yükler ve bir kez tüketir. Bu özel aktarım dışındaki olağan mod değişimleri önceki davranışını korur.

Ana deneyin veri yüklemesi başarısız olursa kullanıcı bu sayfada açıklayıcı hata görür; eski deney değişmez. İstek beklerken kullanıcı başka sayfaya geçerse gecikmiş aktarım iptal edilir ve gizli deney değiştirilmez. Dört sayfanın kendi durumları aynı sekmedeki geçişlerde korunur; yenileme varsayılanları açar. Doğrudan adres/fragment, geri/ileri, klavye, mobil dokunma ve masaüstü Cmd/middle-click yeni sekme davranışı korunur. Derin bölüm odağı, ilk veri yüklemesi yerleşimi tamamlandıktan sonra uygulanır.

## Doğrulanmış birincil kaynaklar

- [Cook ve ark., 2019, Whole-animal connectomes of both Caenorhabditis elegans sexes](https://doi.org/10.1038/s41586-019-1352-7): yöntemler, seri EM kesiti ağırlıkları, birleştirilmiş kayıt ve tahmin kapsamı.
- [WormWiring, yazarların bağlantı tabloları](https://wormwiring.org/pages/adjacency.html): düzeltilmiş Temmuz2020 SI5 ve SI4 kaynakları.
- [Liu ve ark., 2017](https://www.nature.com/articles/ncomms14818): belirli AVA–A-tipi motor nöron elektriksel bağlantılarında doğrultucu iletim.
- [Randi ve ark., 2023, Neural signal propagation atlas of Caenorhabditis elegans](https://www.nature.com/articles/s41586-023-06683-4): anatomik komşuluktan ayrı deneysel işlevsel bağlantı ölçümü.

Açıklamalar özgün Türkçe metindir; kaynaklar bağlantı olarak verilir. Yeni bağımlılık, hesap, ücretli hizmet veya kurulum yoktur.

## Doğrulama

2026-10-03, aynı Mac mini’de:

- `npm test`: 153 birim testi geçti. Önceki 134 teste, 13 graf okuma ve altı aktarım testi eklendi. Gerçek sabitlenmiş veri için 30×30×3 = 2700 kaynak/hedef/mod çiftinin yol uzunlukları bağımsız Floyd–Warshall oracle ile karşılaştırıldı; kaynak koordinatları, ters gap geçişi, en kısa kimyasal döngüler, deterministik eşitlik seçimi, boş/yönsüz/yönlü fixture’lar ve kaynak değişmezliği denetlendi. Aktarım testleri üç gerçek koşulun bütün hesaplanmış izlerinin seçim değişikliğinde aynı kaldığını doğrular.
- `.venv/bin/python -m unittest discover -s scripts/tests -v`: mevcut 15 veri/içe aktarma testi geçti.
- `npm run test:browser -- --output=test-results/reading-browser-complete`: 103 test geçti; yalnız masaüstündeki mobil dokunma testi kasıtlı olarak atlandı, mobilde geçti. Yeni dokuz senaryo masaüstü ve mobilde 18 kez çalıştı; önceki 85 geçen tarayıcı senaryosu ve eski test dosyaları korunur.
- Yeni tarayıcı kontrolleri gerçek yerel JSON’dan bağımsız yol/cycle oracle kullanır; kaynak satırları ve görünen sayıları denetler. Öz/dolaylı/ters/yok/sıfır-kenarlı yollar, adım düğmeleri, hata/yeniden dene, iptal edilen aktarım, önceki ders cevapları ve rehberli deney sonuçları doğrulanır. Gerçek modda oynatma dahil bütün ayarlar, aynı 3D renderer ve tam sayısal JSON korunur; ilk aktarım eski örnek taslağı tam geri yükler.
- Son `npm run build`: tam TypeScript kontrolü ve üretim derlemesi geçti. Önceden mevcut büyük Three.js chunk uyarısı sürer; yeni paket eklenmedi.
- Gerçek Chrome’da 1440 px masaüstü, 390 px mobil ve 320 px reduced-motion görünümü incelendi; yatay taşma ve tarayıcı hatası yoktu. Derin kaynak bağlantısı, yenileme, üç yol türü, kaynak ayrıntıları ve dört sayfa durumu denetlendi. Yerel üretim önizlemesinde masaüstü/mobil kontroller tekrar geçti. Gerçek Metal WebGL2 3D bağlamı sağlıklı kaldı; ilk aktarım ve eski deney kaydı eşitliği doğrulandı.
- Önceki 46 kaynak/test/yapılandırma/veri/belge dosyası SHA-256 ile aynı kaldı. App deney template/styles ve Shell CSS byte olarak aynıdır. App scriptine yalnız aktarım adaptörü, Shell’e rota/menü/odak ve aktarım koordinasyonu eklendi. README önceki içeriğini aynen koruyarak genişletildi. Paket/lock dosyaları değişmedi; önceki kanıt klasörleri korundu; ham gerçek veri `dist/` veya `public/` içine eklenmedi.

Kanıtlar: `test-results/reading-browser-complete/`, `test-results/reading-visual/report.json`, `production-report.json`, `preservation.json` ve aynı klasördeki ekran görüntüleri. İlk tanılama turlarının izleri de ayrı klasörlerde tutuldu. Üretim önizlemesi testten sonra durduruldu; geliştirme adresi `http://127.0.0.1:5176/` açık kaldı. Safari/Firefox ve fiziksel iPhone test edilmedi. Başka projeye veya cihaza aktarım ve yayımlama yapılmadı.

## Tekrarlanabilirlik notu (Kasım 2026)

Bu belgedeki 320 px/azaltılmış hareket ve üretim önizlemesi denetimleri o tarihte projede bulunmayan bir kerelik betiklerle yapılmış ve `test-results/` altındaki kanıt klasörlerine yazılmıştı. Bugün aynı türden denetimler `tests/evidence.spec.ts` ile masaüstü, mobil, 320×800 azaltılmış hareket ve derlenmiş paketin önizlemesi (4177) profillerinde tekrarlanır: yatay taşma, yinelenen ID, konsol hatası, bölüm bağlantısıyla doğrudan açma ve yenileme, kaynak motorla aynı sayılar. Ayrıntılar [doğrulama kaydındadır](verification.md#tekrarlanabilir-kanıt). “Korunan dosyalar aynı kaldı” türü SHA-256 karşılaştırmaları o aşamaya aittir ve tekrarlanamaz; değişiklik geçmişi artık git'te tutulur.
