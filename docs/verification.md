# Circuitiary doğrulama ve kabul kaydı

Tarih: 3 Ekim 2026. Makine: `Mehmet-Mac-mini.local`. Konum: `/Users/mehmetbozkurt/Projects/Circuitiary`. Bu kayıt yerel yazılım/veri doğrulamasıdır; biyolojik yanıt doğrulaması değildir.

## Tamamlanan kabul ölçütleri

- [x] Sekiz hücreli öğretici devre, ilk davranışı ve JSON şemasıyla korunuyor.
- [x] Cook2019 SI5'in **corrected July 2020** dosyası ve SI4 hücre listesi resmi WormWiring kaynağından edinildi. Gerçek dosya özetleri, byte uzunlukları ve UTC indirme zamanları edinim kaydında.
- [x] AVAR/AVER çevresinde sabit kuralla 30 nöron, 196 yönlü kimyasal kenar, 50 tekil fiziksel gap çifti seçildi. Tüm kaynak hücreleri doğrulandı; iki ithalat aynı sonucu üretti.
- [x] Kimyasal satır kaynak/sütun hedef yönü, ham EM kesiti ağırlığı, kare olmayan kaynak matrisi, CANL/CANR kaynak eksikliği ve gap simetrisi denetlendi.
- [x] Kaynaktaki 17 gap diagonal kaydı ayrı metadata içinde korunuyor; seçilen hücreler arasında diagonal gap yok. Beş kimyasal öz bağlantı korunuyor.
- [x] Dışarıda kalan 448 gelen kimyasal, 471 giden kimyasal ve 336 gap çifti; ham toplamları ve hücre başına raporları kayıtta. Dış gap etkisinin çıkarılması, dış hücreyi sıfıra sabitlemekten ayrıldı.
- [x] Ham anatomi değişmez kopya olarak korunuyor; varsayımsal pozitif kimyasal işaret, ayrı gap difüzyonu, normalizasyon, zaman ölçeği ve τ görünür ve dışa aktarılıyor.
- [x] Uyaran/okuma hücresi, tek bağlantı susturma, τ ve iki dinamik katsayı; sıfırlama ve mod geçişi çalışıyor. Gap susturma iki yönü kaldırıyor; hücre ablasyonu yapılmıyor.
- [x] 30 hücrenin tamamı en güçlü UI katsayıları/en hızlı τ ile çalışıyor. Zaman adımı duyarlılığı bildiriliyor; ince adım seçeneği ve kesirli zaman göstergesi doğrulandı.
- [x] Görünüm filtresi ve ortak dikey ölçek hesaplanan sonuçları değiştirmiyor. Grafik yerleşimi anatomik konum olarak sunulmuyor; mobilde grafik ve eksenler okunabilir.
- [x] İki modun JSON dışa aktarımı kaynak/varsayım/ayar/zaman serilerini doğru saklıyor. Eksik yerel veri hatası ve yeniden deneme öğretici modu bozmuyor.
- [x] Yerel API yalnız loopback/same-origin GET'e izin veriyor; yabancı Origin 403, POST 405. Veri üretim paketinde yok.

## Geçen kontroller

| Kontrol | Sonuç |
| --- | --- |
| `.venv/bin/python -m unittest discover -s scripts/tests -v` | **15 geçti**, gerçek kaynak testleri atlanmadı |
| `npm test` | **87 geçti**, iki sayısal/model test dosyası |
| `npm run build` içindeki tam `vue-tsc --noEmit` | Geçti; Vue, tüm model kaynakları, yapılandırmalar ve tarayıcı testleri dahil |
| `npm run build` | Geçti; son `dist/` çıktısı üretildi |
| `npm run test:browser` | **32 geçti**, 1440 px masaüstü + 390 px mobil Chrome görünümü |
| Yerel üretim önizlemesi | İki mod, gerçek veri yükleme ve schema2 JSON indirme geçti |
| Üretim paketi denetimi | XLSX, yerel JSON, kaynak hash'i ve serileştirilmiş ham ağırlık kayıtları yok |
| Son görsel inceleme | Masaüstü/mobil devre, çizgiler ve varsayım defteri incelendi; yatay taşma/çalışma hatası yok |

Tarayıcı testi geliştirme sunucusunu kullanır. Ek üretim kontrolü `npm run preview -- --port 4177` ile yapılmış, dışarıya yayımlanmamıştır. Playwright mevcut `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` uygulamasını headless çalıştırır; yeni tarayıcı kurulmamıştır. Mobil kontrol gerçek iPhone/Safari testi değildir, Chrome'da mobil görünüm ve dokunma emülasyonudur.

İlk çalışmada uç parametreler için keyfî `<0,1` yakınsama beklentisi başarısız oldu. İnceleme, sınır korumanın sağlandığını fakat kaba Euler adımının hızlı yükselişi geciktirdiğini gösterdi. Nihai çözüm bir kontrolü gevşetmek değildir: görünür duyarlılık uyarısı, 0,0625 ms'ye kadar ince adımlar ve küçülen adımda azalan fark kontrolü eklendi. Son testte bu uç deneyin `dt/2` farkı 0,01'in altına indi. Bu eşik bir yazılım inceleme ölçütüdür; biyolojik doğruluk sertifikası değildir.

## Referans çıktıları

Her iki deney 700 ms, sıfır başlangıç, 100 ms başlangıçlı 200 ms/0,8 uyaran; temel τ 30 ms ve dt 1 ms kullanır.

- Kurgusal S1→O1 deneyinde A tepe yaklaşık **0,663**, `I3→O1` susturulmuş B **0**, O1 τ=90 ms C yaklaşık **0,543**. Önceki davranış korunmuştur.
- Gerçek altgrafın **varsayımsal** AVER→AVAR modelinde A tepe **0,0492478692**, varsayılan bağlantı susturma B yaklaşık **0,013**, AVAR τ=90 ms C yaklaşık **0,041**. Değerler boyutsuzdur; ölçülmüş kalsiyum, voltaj veya ateşleme hızı değildir.
- AUAR uyarımı/kimyasal katsayı 2/gap katsayısı 1/τ=10 ms uç deneyinde dt2↔dt1 en büyük fark **0,15115237**; dt1↔0,5 **0,07962399**; dt0,5↔0,25 **0,04138652**; dt0,25↔0,125 **0,02104838**. Tüm 30 uyaran için adım küçüldükçe fark azalır; sonuçlar sonlu ve 0–1 içindedir. Küçük adım da yaklaşık çözümdür.

## Kanıt dosyaları

- `data/local/acquisition.json`: dosya bütünlüğü, sürüm, edinim, seçim ve sınır raporu.
- `data/local/cook-subset.json`: yerel ham anatomi ve kaynak koordinatları.
- `test-results/final-real-visual/`: son masaüstü/mobil devre, çıktı grafiği, varsayım ve tam sayfa ekranları. **Bu klasör artık yok**; büyük olasılıkla `--output` verilmeden yapılan sonraki bir Playwright koşusu varsayılan `test-results/` klasörünü temizlerken silindi.
- `tests/learning.spec.ts`, `tests/real-data.spec.ts`: iki modun tarayıcı kabul senaryoları.
- `src/model/*.test.ts`, `scripts/tests/test_import_cook2019.py`: sayısal ve kaynak doğrulaması.

Bu belge 3 Ekim 2026 ilk aşamasının kaydıdır; bugünkü test sayıları README'deki “Güncel doğrulama durumu” bölümündedir. Playwright çıktısı artık `test-results/latest/` altına yazılır; her koşu yalnız o klasörü temizler, diğer kanıt klasörleri korunur. Kaynak ve bilimsel sınırlar [veri raporunda](real-data-next-step.md) ve [bilimsel kapsamda](scientific-scope.md) açıklanır.

## Açık sınırlar ve denenmeyen alanlar

Yerel çalışma için erişim/kurulum engeli yok. **Dosyaya özgü yeniden dağıtım lisansı doğrulanmadı**; XLSX, türetilmiş altküme ve gerçek veri içeren deney kaydı halka açık dağıtıma hazır sayılmıyor. Veri `data/raw/`/`data/local/` içinde ve `.gitignore` kapsamındadır. Yayımlama, makine taşıma veya dış senkronizasyon yapılmadı.

Gerçek hayvan davranışı, voltaj, spike veya kalsiyum gözlem modeli kalibre edilmedi; deneysel biyolojik doğrulama yapılmadı. Safari/Firefox ve fiziksel mobil cihaz test edilmedi. Sürekli bir hizmet veya makine yeniden başladıktan sonra otomatik başlatma kurulmadı; gerektiğinde README komutuyla yerel sunucu tekrar açılır.

Ortam: Node22.22.0, Vue3.5.43, Vite8.3.2, TypeScript5.9.3, Cytoscape3.34.3, Vitest5.0.3, Playwright1.63.0; Python3.9.6/openpyxl3.1.5/et-xmlfile2.0.0. Bağımlılıklar proje dosyalarıyla sabittir.

## Tekrarlanabilir kanıt

Kasım 2026'dan itibaren görsel ve üretim denetimleri projedeki `tests/evidence.spec.ts` ile tekrarlanır. Senaryo `playwright.config.ts` içindeki beş profilde koşar:

| Profil | Sunucu | Görünüm |
| --- | --- | --- |
| `desktop` | dev, 4176 | 1440×1050 |
| `mobile` | dev, 4176 | iPhone 13, 390×664, dokunmatik |
| `narrow-reduced-motion` | dev, 4176 | 320×800, `prefers-reduced-motion: reduce` |
| `production-desktop` | `npm run build` + `vite preview`, 4177 | 1440×1050 |
| `production-mobile` | `npm run build` + `vite preview`, 4177 | iPhone 13 |

Altı sayfanın her durumunda şunlar denetlenir:

- yatay sayfa taşması olmaması ve ID'lerin benzersizliği,
- azaltılmış hareket tercihinin sayfaya ulaşması,
- konsol veya sayfa hatası olmaması,
- bölüm bağlantısıyla doğrudan açılan adresin yenilemede aynı hedefte kalması.

Ayrı olarak `tests/decimals.spec.ts` aynı sayfa durumlarında görünen metinde ve erişilebilir adlarda (aria-label, aria-valuetext) ondalık noktası kalmadığını denetler: arayüz Türkçedir, sayılar ondalık virgülle yazılır. Tanımlayıcı, sürüm, DOI, lisans ve Türkçe binlik ayırıcı (139.255) istisnadır; `data-*` öznitelikleri ve SVG yol verisi makine okunur kalır.

Sayısal denetimler şunlardır:

- Ana deneyde iki modun indirilen kaydı Node'da yeniden simüle edilir ve birebir aynı çıkmalıdır; gösterilen tepe değerleri de bu izlerle aynı olmalıdır.
- Nörondan devreye dersinin örnekleri `lessonMath` ile, üç rehberli deney `runGuidedExperiment` ile, varsayım karşılaştırması `runAssumptionExperiment` ile karşılaştırılır. Okuma sayfasının sayıları ve RICL→AVBR yolu `circuitReading` ile karşılaştırılır.
- Türler atlası hiçbir veri veya uzak kaynak isteği yapmamalıdır.

Ana deneyde ayrıca 2D/3D, iki mod, açık sözlük kartı, koyu tema ve "İçeriğe geç" bağlantısının odaktayken görünmesi sınanır. Üretim profillerinde yalnız hash'li `/assets/` paketlerinin yüklendiği, `/src/` veya Vite istemcisi isteği olmadığı, `dist/` içinde JSON/XLSX bulunmadığı ve veri yollarının veri döndürmediği denetlenir.

Her test durum ekran görüntülerini ve koşunun profilini, tarayıcı sürümünü, git commit'ini ve çalışma ağacının temizliğini içeren bir `evidence.json` yazar. Normal koşu (`npm run test:browser`) bunları `test-results/latest/` altına yazar. Saklanacak koşu için `npm run test:evidence` kullanılır: çıktıyı ve `report.json` sayılarını yeni, zaman damgalı `test-results/evidence-YYYYMMDD-HHMMSS/` klasörüne yazar ve önceki klasörlere dokunmaz.

Tekrarlanmayanlar: eski aşamalardaki SHA-256 koruma manifestleri (yerlerini git aldı), `3d-visual/lifecycle-forensic.json` dinleyici adli kaydı (üst sınır `tests/three-d.spec.ts` içinde sınanır) ve bir kerelik ekran görüntüsü karşılaştırmaları. Safari, Firefox ve fiziksel cihazlar hâlâ test edilmez.

