# Şematik 3D görünüm: doğrulama kaydı

Tarih: 3 Ekim 2026. Proje: `/Users/mehmetbozkurt/Projects/Circuitiary`, aynı Mac mini üzerinde yerel kullanım. Bu belge 3D görüntüleme ve mevcut özelliklerin korunmasına ilişkindir; biyolojik emülasyon veya fizyoloji doğrulaması değildir.

**Durum: yerel 3D doğrulaması tamamlandı.** Son sürümde 92 birim testi, 15 Python kaynak testi ve 51 tarayıcı testi geçti. Bir masaüstü senaryosu mobil dokunmaya ayrıldığı için kasıtlı olarak atlandı; aynı dokunma senaryosu mobil görünümde geçti. Son tam tür kontrolü ve üretim derlemesi geçti. Önceki aşamanın sonucu [mevcut doğrulama kaydında](verification.md) ayrı tutulur.

## Bilimsel ve veri sözleşmesi

3D koordinatlar `schematicPositions` tarafından üretilen deterministik gösterim noktalarıdır. Öğretici devre rol sütunlarına, gerçek altgraf şematik küreye yerleştirilir. SI4/SI5 ölçümlerinden anatomik konum veya morfoloji türetilmez. Eksen, uzaklık, çizgi eğriliği ve etiket kılavuzları biyolojik uzunluk veya sinyal seyahat yolu değildir.

30 hücreli yerel anatomi 196 yönlü kimyasal ve 50 tekil gap kenarı içerir. Karşılıklı 45 kimyasal çiftin iki yönü ayrı eğrilerle, gap ile kimyasal kenar paylaşan 47 hücre çiftinin türleri ayrı kanallarla çizilir. Beş kimyasal öz bağlantı döngüleri korunur. Kaynakta raporlanan gap köşegen kayıtları dinamik çift olarak eklenmez. Öğretici devrenin negatif kimyasal bağlantıları ayrı renk ve baskılayıcı uç ile gösterilir.

3D görünüm aynı `circuit`, `activity`, seçili hücre ve susturulan bağlantı bilgisini alır; veri ithalatı, işaret varsayımı veya sayısal motor oluşturmaz. Parlaklık aynı hesaplanmış, boyutsuz etkinlikten gelir. Çizgi kalınlığı 3D'de ağırlık ölçüsü değildir. Gerçek kimyasal işaretler bilinmiyor kalır; modelin pozitif işaret ve zaman ölçeği varsayımları değişmez. Görsel odak filtresi yalnız kenar görünürlüğünü değiştirir.

Gerçek veri dışa aktarımında `display.graphView`, `display.spatialLayout` ve `affectsSimulation: false` görüntüleme tercihini kaydeder. Anatomi ve zaman serilerinin içeriği görünüm seçimi nedeniyle değişmemelidir. Yerel veri/lisans sınırı aynıdır; 3D açmak herhangi bir veri yayımlama veya dış hizmet çağrısı değildir.

## Kullanıcı işlemleri ve korunacak durum

- 2D başlangıç görünümü ve mevcut yakınlaştırma/sürükleme/sığdırma işlemleri korunur. 3D, aynı panelde ayrı sekmedir.
- Sekme geçişi seçili hücreyi, A/B/C koşulunu, zaman imlecini, oynatma durumunu, uyaranı, okunan hücreyi, susturulan kenarı, τ değerlerini, katsayıları ve grafik ölçeğini değiştirmez.
- 3D sürükleme, tekerlek/iki parmak, kamera düğmeleri ve tuval odaklı klavye işlemleriyle kullanılabilir. Küre veya etikete tıklama mevcut inspector seçimini değiştirir; sayfadaki hücre düğmeleri alternatif erişim sağlar.
- Her açılış yeni bir kamera sığdırması yapar. Eski kamera pan/zoom konumu korunması bu sözleşmenin parçası değildir; bu davranış deney sıfırlamasıyla karıştırılmaz.
- WebGL2 yokluğu, yükleme hatası ve bağlam kaybı açıklayıcı geri dönüş sunar. 2D'ye dönüş deney ayarlarını korur ve mevcut sayısal deneyi kullanır.

## Kaynak kullanımı ve yaşam döngüsü

`three` ve OrbitControls 3D açılınca dinamik yüklenir. Çizim değişikliklere yanıt olarak istenir; sabit sahne için sürekli animasyon döngüsü yoktur. Etkinlik oynatılırken kareler modelin mevcut zaman örneklerini gösterir. DPR en fazla 1,5'tir; düşük güç tercihi tarayıcıya iletilen ipucudur.

Kapatma, hata ve bağlam kaybında bekleyen çizim iptal edilir; gözlemci, olay dinleyicileri, kamera denetimleri, geometri, malzemeler, renderer ve WebGL kaynakları bırakılır. Tekrar açma yeni bir renderer oluşturur. Açma/kapatma ve bağlam kaybı senaryoları geçti; önceki renderer'ın ve kapanmış görünümün dinleyicilerinin kalmadığı denetlendi.

## Kabul ve kanıt tablosu

| Kontrol | Kabul ölçütü | Sonuç |
| --- | --- | --- |
| Model/veri/2D koruma | Koruma manifestindeki 11 mevcut dosyanın SHA-256 değerleri aynı | **11/11 aynı**; [özet kanıtı](../test-results/3d-visual/preservation-check.json) |
| Birim testleri | Mevcut sayısal ve anatomik testler ile yeni deterministik şematik yerleşim testleri geçer | **92 geçti** |
| Kaynak ithalatı | Yerel gerçek kaynak/matris testleri de korunur | **15 Python testi geçti** |
| Tür kontrolü ve build | Vue/TypeScript kaynakları, son tarayıcı testleri ve yerel üretim paketi derlenir | **Son tam tür kontrolü ve üretim derlemesi geçti** |
| İlk görünüm ve sekmeler | 2D varsayılan; mouse/klavye ile 3D ve geri dönüş çalışır | **Geçti** |
| Kamera ve hücre seçimi | Döndürme/zoom/fit; küre/etiket ve alternatif hücre düğmeleri seçimi aynı inspector'a taşır | **Geçti**; mobil dokunma ve seçim koruma dahil |
| Topoloji gösterimi | Her bağlantı ayrı çizilir; kimyasal yön, gap türü, öz bağlantılar ve baskılayıcı uç korunur | **Kod incelemesi ve iki modun görüntü kontrolü geçti** |
| Deney durumu | Koşul, seçim, ayarlar, imleç ve oynatma sekme geçişinde korunur; sonuçlar aynı kalır | **Geçti** |
| Yerel gerçek veri ve export | 30/196/50 kaynak grafı, ham ağırlıklar ve sonuçlar korunur; ek display metadata doğru | **Geçti**; iki modun sayısal JSON sonuçları aynı |
| Geri dönüş | WebGL2 yokluğu ve bağlam kaybı 2D'de devam sağlar | **Geçti** |
| Kaynak temizliği | Açma/kapatma döngülerinde önceki renderer ve kaynaklar bırakılır | **İki hedefli temizlik testi ve tam tarayıcı koşusu geçti** |
| Paket/veri sınırı | Yerel XLSX/JSON tarayıcı üretim paketine gömülmez; yeni uzak hizmet yok | **Geçti**; dist içinde kaynak veri/özet/ham koordinat işaretleri yok |
| Görsel inceleme | Masaüstü/mobil ekranlarda etiketler, seçili hücre, çizgiler ve denetimler okunur | **Geçti**; yatay taşma ve tarayıcı hatası yok |

Başlangıç koruma manifesti `/tmp/circuitiary-3d-preservation.json` dosyasında hazırlanmış, son karşılaştırma [proje içindeki kanıta](../test-results/3d-visual/preservation-check.json) kaydedilmiştir. Ana projenin model kaynakları/testleri, iki eski 2D bileşen, Cook ithalatçısı ve iki yerel veri JSON'u karşılaştırma kapsamındadır. Bu kayıt bir biyolojik veri yayını değildir.

## Geçen son kontroller

```sh
.venv/bin/python -m unittest discover -s scripts/tests -v
npm test
npm run typecheck
npm run build
npm run test:browser
```

Tam tarayıcı koşusu **51 geçti, 1 kasıtlı atlama, 0 başarısız** sonucunu 49,8 saniyede verdi: eski 32 senaryo ile yeni 19 senaryo geçti. Masaüstündeki mobil dokunma atlaması, mobil bağlamdaki dokunma kontrolünün yerine kullanılmadı; bu kontrol mobilde çalıştı ve geçti.

Yaşam döngüsü ölçümünün ilk denemesinde, ilk `Locator.evaluate` çağrısının başlattığı Playwright `InjectedScript` 13 global dinleyici ekliyordu: bir global kontrol dinleyicisi ve 12 hit-target yakalama dinleyicisi. Native CDP kaynak yığınları bunu [ayrı inceleme kaydında](../test-results/3d-visual/lifecycle-forensic.json) gösterir. Son test başlangıcı, 3D importundan önce mevcut 2D tuvalinin `tagName` değerini okuyan çağrıdan sonra alındı. Bütün global dinleyiciler sayılır; her çevrim sonunda sayının başlangıç ölçümünü aşmadığı denetlenir. Dinleyici filtresi veya ek sayı toleransı eklenmedi. Dört çevrimin tamamında test sayacı 3D'de **20**, 2D'ye dönüşte başlangıçtaki **28** değerinde kaldı; 3D'ye ait dinleyiciler kaldırıldı.

Gerçek donanım kontrolü Google Chrome'da **Apple M4 / ANGLE Metal / WebGL2** üzerinde yapıldı. Shader programı link kontrolü başarılı, bağlam kaybı yoktu. Masaüstü 1440×1050, mobil 390×844 görünümü ve üretim önizlemesinde hem sekiz hücreli hem 30 hücreli mod kontrol edildi. İki modun dışa aktarılan sayısal sonuçları aynı kaldı; öğretici tepe yaklaşık 0,663, gerçek altgrafın varsayımsal tepe değeri yaklaşık 0,049 olarak görüldü. Bunlar boyutsuz model değerleridir.

## Proje içindeki kanıtlar

- [Donanım, görünüm ve üretim önizleme raporu](../test-results/3d-visual/report.json)
- [11 dosyanın koruma kontrolü](../test-results/3d-visual/preservation-check.json)
- [Yaşam döngüsü ölçümünün kaynak incelemesi](../test-results/3d-visual/lifecycle-forensic.json)
- [Masaüstü öğretici 3D](../test-results/3d-visual/desktop-toy-3d.png), [mobil öğretici 3D](../test-results/3d-visual/mobile-toy-3d.png)
- [Masaüstü gerçek altgraf 3D](../test-results/3d-visual/desktop-real-3d.png), [mobil gerçek altgraf 3D](../test-results/3d-visual/mobile-real-3d.png)
- [Masaüstü tam sayfa](../test-results/3d-visual/desktop-real-full.png), [mobil tam sayfa](../test-results/3d-visual/mobile-real-full.png)
- [Masaüstü çıktı grafiği](../test-results/3d-visual/desktop-real-chart.png), [mobil çıktı grafiği](../test-results/3d-visual/mobile-real-chart.png)

Yeni Playwright koşusu `test-results/` klasörünü yenileyebilir. Safari, Firefox ve fiziksel iPhone test edilmedi. Chrome mobil görünüm ve dokunma emülasyonu fiziksel cihaz doğrulaması değildir. WebGL desteğinin bu makinede çalışması bütün tarayıcı ve GPU'larda çalışmayı garanti etmez. Etkinliğin görünürde doğru çizilmesi biyolojik davranışın doğrulanması anlamına gelmez.
