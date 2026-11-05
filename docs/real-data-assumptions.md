# Gerçek veri ve varsayımlar

Dördüncü öğrenme sayfası `/ogren/gercek-veri-ve-varsayimlar`. Kaynakta raporlanan anatomik kayıtlarla, bu projede seçilen dinamik varsayımları ayırır. Aynı gerçek altgraf, mevcut devre üreticisi ve mevcut sayısal motorla iki koşulda hesaplanır. Yeni biyolojik veri, yeni motor veya önceki sayfalara müdahale yoktur.

## Kaynak ve seçim

Cook2019 çalışmasının düzeltilmiş Temmuz2020 SI5 bağlantı tablosu ve SI4 hücre listesi, mevcut yerel `/api/local-connectome` üzerinden okunur. Aynı AVAR/AVER seçiminde 30 hücre, 196 yönlü kimyasal kayıt (beşi öz bağlantı) ve 50 tekil fiziksel gap çifti vardır. Sayılar seçtiğimiz altgrafın kayıt sayılarıdır; tüm hayvanın veya sinaptik temasların toplamı değildir.

Ham ağırlık sinaptik yapıların geçtiği seri EM kesitlerinin toplamına dayanır. Sinaps sayısı ve boyutunu birlikte yansıtır; sinaps sayısı, ölçülmüş işlevsel güç veya elektriksel iletkenlik değildir. Bu dosyadan ayrı bir sinaps sayısı çıkarılmaz. Cook grafiği farklı EM serilerinden birleştirilmiş ve bazı boşlukları ekstrapolasyonla tamamlanmış bir kaynaktır; içe aktarılmış her kenarın doğrudan ölçüm/tahmin ayrımı ayrı metadata olarak bulunmaz.

Hücre sınıfları SI4 kaynak sınıflarıdır. Uyaran hedefi AVER ve gözlenen çıktı AVAR deney tercihleridir. Kaynak koordinatları Excel sayfa/satır/sütun/hücre referansıdır; anatomik 3D konum veya morfoloji değildir. Şematik görünümdeki yerleşim biyolojik uzaklık değildir.

## Kayda eklenen model

Bu içe aktarılmış anatomi verisinde kimyasal işaret, reseptör, zaman sabiti, uyaran ve ölçülmüş etkinlik yanıtı bulunmaz. Bu ifade biyolojide hiçbir şey bilinmediği anlamına gelmez; yüklenmiş verinin kapsamını belirtir.

Mevcut model bütün kimyasal etkileri pozitif varsayar. Kimyasal ham değer, hedefin **altgraf içindeki** gelen ham toplamına bölünüp kimyasal katsayıyla ölçeklenir. Gap ham değeri, iki ucun altgraf içindeki gap toplamlarının büyüğüne bölünüp elektriksel katsayıyla ölçeklenir; paydalar en az 1’dir. Gap model terimi simetrik `g·(komşu−hücre)` yayılımıdır. Doğrultma veya ölçülmüş biyofiziksel iletkenlik çözülmez.

Gerçek örnek AVER→AVAR: ham 33, SI5 HE176; AVAR’ın iç gelen toplamı 540. Temel katsayı 0,8 ile `0,8×33/540 = 0,0488889` model ağırlığı olur. AVAR—AVER gap çifti: ham 2, HE220 ve karşılıklı HL213; iç gap toplamları 110 ve 3. Katsayı 0,2 ile `0,2×2/110 = 0,00363636`. Bunlar seçilmiş normalizasyonun hesaplarıdır, fizyolojik güç kalibrasyonu değildir. Kayıtlı deneyin iki koşulundaki model ağırlıkları ayrı gösterilir.

Altgrafın dışında 448 gelen, 471 giden kimyasal ve 336 gap kaydı bırakılmıştır; toplam ham ağırlıkları sırasıyla 2346, 2106 ve 3544’tür. Dış kimyasal girdi sıfır kabul edilir; dış gap etkileri çıkarılır. Dış hücreler sıfıra bağlanmaz. Kaynak gap diagonal kayıtları raporlanır fakat fiziksel hücre çifti olarak simüle edilmez.

## Kontrollü karşılaştırma

“Deneyi çalıştır”, temel ve karşılaştırma koşulunu gerçekten hesaplar; başlangıçta sonuç veya eğri yoktur. Temel kimyasal katsayı 0,8, elektriksel katsayı 0,2 ve bütün hücrelerin τ değeri 30 model ms’dir. İki koşulda da sıfır başlangıç, AVER’e `[100,300)` model ms aralığında genliği 0,8 darbe, 700 model ms kayıt ve 1 model ms Euler adımı kullanılır. Çıktı AVAR’dır.

Yalnız bir seçilmiş varsayım değişir:

| Değişken | Karşılaştırma aralığı | Diğer koşullar |
| --- | --- | --- |
| Kimyasal katsayı | 0–1,5; varsayılan 1,2 | Gap 0,2, τ30 sabit |
| Elektriksel katsayı | 0–1; varsayılan 0,6 | Kimyasal 0,8, τ30 sabit |
| Bütün hücrelerin zaman sabiti | 15–120 model ms; varsayılan 90 | İki katsayı sabit; bütün 30 hücrede aynı τ |

Önceki rehberli dersteki O1’e özgü zaman sabiti değişiminden farklı olarak bu sayfa bütün seçili hücrelerin τ değerini değiştirir. Katsayı sıfır olunca kaynak anatomisi ve kayıt kimlikleri korunur; yalnız ilgili model katkısı sıfır olur. Diğer bağlantı türü etkin kalabilir. Temel değerin aynısını seçmek aynı hesaplanmış izleri üretir.

Kimyasal çarpanda 1 bir eşiktir. Bu normalizasyonda gelen kimyasal bağlantısı olan her hücrenin model ağırlıkları toplamı tam olarak çarpana eşittir. Çarpan 1’in altındayken etkinlik uyaran bitince söner. 1’in üstünde yönlü kimyasal döngüler etkinliği kendi kendine besler ve etkinlik uyaran bittikten sonra da büyür. Üst sınıra (1) ne kadar sürede ulaşacağı çarpana ve uyarana bağlıdır. Bu yerel altgrafta varsayılan darbeyle (genlik 0,8, 200 ms) 1,2 çarpanında 700 ms kaydın sonunda 30 hücrenin 29'u 0,9'u aşar ve AVAR 0,978'e çıkar. 1,05'te aynı durum ancak 3000 ms'lik bir kayıtta görülür. Çok zayıf ve kısa bir darbede (genlik 0,05, 10 ms) 1,1 çarpanı 3000 ms'de doyuma ulaşırken 1,05 hâlâ büyümektedir. Çarpan 1,0'da yanıt çok yavaş söner. Varsayılan 1,2 karşılaştırması bu kendini besleyen rejime girer. Ders bunu kontrol paneli ve sonuç açıklamasında belirtir; bu biyolojik bir bulgu değil, seçilen normalizasyonun ve modelin sonucudur.

AVAR eğrilerinin tamamı 701 kaydedilmiş örnekten çizilir. İki koşul aynı görünür dikey ölçeği kullanır; küçük yanıtlar için ortak yakınlaştırma, isteğe bağlı 0–1 ölçeği vardır. Ölçek veri veya sonucu değiştirmez. Tepe, ilk pozitif tepe zamanı ve 700 ms’deki son değer gösterilir. Tepe zamanı olay başlangıcı, eşik geçişi veya akson iletim gecikmesi değildir; tamamen sıfır çıktının tepe zamanı yoktur. Son değer kararlı durum değildir. En büyük mutlak iz farkı bütün 30 hücre ve bütün zaman örneklerinde hesaplanır; biyolojik istatistiksel anlamlılık değildir.

Tam kaynak veri, devre, parametreler, iki hesaplanmış sonuç ve ölçütler değişmez bir kayda alınır. Taslak parametre değişikliği önceki sonucu ve kayıtlı ayarları değiştirmez; eski kayıt işaretlenir ve yeniden çalıştırma istenir. Sıfırlama yalnız bu derse aittir. İlk üç ders ve ana deneyin ayarları, sayısal JSON’u, zaman/oynatma ve 2D/3D görünümü sayfa geçişlerinde korunur. Yenileme varsayılanları açar; kalıcı depolama eklenmedi.

## Doğrulamanın sınırı ve kaynaklar

Varsayımlar değişince model izlerinin değişmesi, gerçek hayvan davranışını doğrulamaz. Aktivite 0–1 boyutsuz sürekli model değeridir; voltaj, Hz, kalsiyum veya spike sayısı değildir. Zaman ölçeği ölçüme kalibre edilmemiştir. Beden, kas ve çevre yoktur. Biyolojik doğrulama, bağımsız deneysel ölçümlerle karşılaştırma gerektirir. Sayısal adım küçüldükçe sonuçların yakınlaşması seçilmiş denklemin çözümüne ilişkindir; biyolojik doğrulama veya parametre kalibrasyonu değildir. Sınır içinde kalan sonuç tek başına yakınsama kanıtı değildir.

- [Cook ve ark., 2019](https://doi.org/10.1038/s41586-019-1352-7): anatomi kaynağı, seri EM kesiti ağırlıkları, birleştirilmiş kayıtlar ve ekstrapolasyon.
- [WormWiring](https://wormwiring.org/pages/adjacency.html): yazarların düzeltilmiş Temmuz2020 SI5 ve SI4 tabloları.
- [Liu ve ark., 2017](https://www.nature.com/articles/ncomms14818): belirli AVA–VA5/VA8 bağlantılarında doğrultucu elektriksel iletim; seçilen her gap çiftinin akım yönü hakkında sonuç değildir.
- [Randi ve ark., 2023](https://www.nature.com/articles/s41586-023-06683-4): anatomiden ayrı deneysel işlevsel sinyal yayılımı ölçümü; bu projeye kalsiyum verileri yüklenmedi.

Kaynak sürümü, seçim kuralı, URL’ler, gerçek edinim zamanları ve SHA-256 özetleri görünürdür. Dosyaya özgü yeniden dağıtım izni doğrulanmadı; `unverified-local-only` geçerlidir. Ham/türetilmiş veri `public/` veya `dist/` içine konmaz; aynı-origin loopback GET ile yerel okunur. Yükleniyor/eksik/hatalı/geçersiz durumları ayrı açıklanır; hata örnek sonuçla örtülmez, açık yeniden deneme vardır. Yeni bağımlılık, hesap, ücretli hizmet, kurulum veya yayımlama yoktur.

## Doğrulama kaydı

2026-10-03, aynı `Mehmet-Mac-mini.local` üzerinde:

- `npm test`: **173 birim testi geçti**. Önceki 153 teste, 20 yeni anlamlı modül testi eklendi. Üç değişkenin sınır/azaltma/sıfır/temelle eşit koşulları, aynı anatomide tek parametre değişimi, tüm hücre izleri, kaynak koordinatları, ayrı ve değişmez kayıtlar, sıfır çıktıda `null` tepe zamanı ve hatalı istekler denetlendi. Gerçek 30 hücrelik kaynakta iki koşulun bütün zaman serileri mevcut motorla bağımsız çağrılar üzerinden karşılaştırıldı.
- `.venv/bin/python -m unittest discover -s scripts/tests -v`: **15 veri/içe aktarma testi geçti**.
- `npm run test:browser -- --output=test-results/assumptions-browser-final`: **121 test geçti**, yalnız mevcut masaüstü projesindeki mobil dokunma senaryosu kasıtlı olarak atlandı; aynı senaryo mobilde geçti. Yeni dokuz senaryo masaüstü/mobilde 18 kez çalıştı; önceki 103 başarılı tarayıcı senaryosu korundu. Eski test dosyaları değiştirilmedi.
- Yeni tarayıcı oracle, yeni ders modülünü kullanmadan mevcut parser/devre üreticisi/motoru çağırır. Görünen sayılar, küçük değerlerin bilimsel gösterimi, aynı ölçekli SVG’nin 701 noktasının tamamı, görünen eksen yazıları/konumları ve 100–300 uyaran bandı doğrulanır. Ortak yanıt ölçeği ve sabit 0–1 ölçeği aynı hesapları korur. Ham 33 ve 2 kayıtları, HE176/HE220/HL213 koordinatları, 540 ve 110/3 iç toplamları ve iki model katsayısı doğrulanır.
- Sıfır ve temelle eşit katsayılar, global τ değişimi, gerçek klavye ArrowRight ile 90→95 güncellemesi, kayıt/eski-taslak/yeniden-çalıştır/sıfırlama, yükleniyor/503/404/geçersiz veri/yeniden deneme geçer. Tür değişiminde range input yeni sınırlarla yeniden oluşturulur; native range ile model değeri tutarlıdır.
- Ana örnek 2D ve gerçek 3D deneylerinde oynatma dahil bütün ayarlar, zaman ve tam dışa aktarılan sayısal JSON aynı kalır. İlk üç öğrenme sayfasının cevapları, kayıtları, yol ve adım seçimleri bağımsız korunur. Doğrudan adres, yenileme, derin fragment, klavye/skip-link, geri/ileri ve tam kaydırma geri yüklemesi, mobil dokunma, gerçek Cmd/middle-click yeni sekme davranışı geçer.
- Son `npm run build`: tam TypeScript kontrolü ve üretim derlemesi geçti. Önceden var olan büyük Three.js chunk uyarısı sürer; yeni bağımlılık veya kurulum yoktur.
- Gerçek Chrome’da 1440 px masaüstü, 390 px mobil ve 320 px reduced-motion ekranları incelendi; taşma ve tarayıcı hatası yoktu. Üç gerçek hesap karşılaştırması, ortak küçük yanıt ölçeği, eski kayıt korunması, üçüncü ders durumu ve kaynak fragment’i/yenileme doğrulandı. Derlenmiş yerel üretim önizlemesinde masaüstü/mobil kontroller tekrar geçti; gerçek Metal WebGL2 3D bağlamı sağlıklı, ana deneyin JSON’u aynı kaldı.
- Önceki **59 kaynak/test/belge/veri/yapılandırma dosyası** SHA-256 ile aynıdır; `App.vue` bütünüyle korunur. Shell’e yalnız beşinci kalıcı görünüm, rota/menü ve veri yüklemesini bekleyen odak desteği eklenir; Shell CSS aynıdır. README’nin eski metni tam olarak korunup eklenir. Paket/lock dosyaları, gerçek ham XLSX ve türetilmiş JSON değişmez; önceki bütün kanıt klasörleri korunur; gerçek veri `dist/` veya `public/` içine eklenmez.

Kanıtlar `test-results/assumptions-browser-final/` ve `test-results/assumptions-visual/` altındadır. `report.json`, `production-report.json`, `preservation.json` ve ekran görüntüleri kapsamı kaydeder. İlk tanılama izleri ayrı klasörde tutuldu. Kısa üretim önizlemesi durduruldu; geliştirme sunucusu `http://127.0.0.1:5176/` olarak açık kaldı. Safari/Firefox ve fiziksel iPhone test edilmedi. Türler atlası ve deney defteri bu aşamada eklenmedi; başka proje/cihaza aktarım veya yayımlama yapılmadı.

