# Rehberli deneyler

`/ogren/rehberli-deneyler` adresinde ikinci öğrenme bölümü. Üç bağımsız karşılaştırma vardır: uyaranı artırma, tek bağlantının model katkısını kaldırma ve yalnız O1'in zaman sabitini değiştirme. Tahmin isteğe bağlıdır; boş, yanlış veya “emin değilim” seçimi hesaplamayı engellemez.

## Hesaplanan karşılaştırmalar

Yeni `guidedExperiments.ts`, mevcut `src/model/circuit.ts` içindeki sekiz hücreli örnek devre ve `src/model/simulation.ts` içindeki motoru kullanır. Yeni bir sayısal motor veya biyolojik veri eklenmedi. Her çalıştırmada iki koşul gerçekten hesaplanır; grafikteki eğriler ve tablodaki sayılar bu koşulların kaydedilmiş örneklerinden gelir.

| Deney | Temel koşul | Tek değişiklik |
| --- | --- | --- |
| Uyaran | S1 darbe genliği 0,4 | Genlik 0,8 |
| Bağlantı | Bütün örnek bağlantılar etkin | I3→O1 (+1) veya I4→O1 (−0,3) katkısı kaldırılır |
| Zaman sabiti | Bütün hücrelerde τ=30 model ms | Yalnız O1'de τ=90 varsayılan; arayüzde 40–180 arası seçilebilir |

Her iki koşulda 700 model ms kayıt, 1 ms adım, S1'e `[100,300)` aralığında darbe ve sıfır başlangıç kullanılır. Uyaran karşılaştırması dışındaki deneylerde genlik 0,8'dir. Diğer devre, ağırlık ve simülasyon ayarları aynı kalır. Motor eşzamanlı açık Euler ile önceki adımdaki değerleri kullanır:

`tau_i dx_i/dt = -x_i + clip(sum_j W_ij*x_j + I_i(t), 0, 1)`

Bu örnek devrede gap junction yoktur. Ağırlıklar, işaretler ve zaman sabitleri öğretim için elle seçilmiştir; ölçülmüş hayvan fizyolojisi değildir. Aktivite 0–1 aralığında boyutsuzdur. Zaman birimi model ölçeğidir. Çıktı zar gerilimi, kalsiyum ölçümü, ateşleme hızı veya olay sayısı olarak yorumlanmaz.

## Ölçütlerin anlamı

- Tepe: O1'in bütün kayıt boyunca en yüksek etkinliği. Pozitif tepe için zaman, bu maksimuma ilk ulaşan örneğin zamanıdır. Tamamen sıfır çıktının tepe zamanı yoktur.
- 0,10 düzeyine ilk ulaşma: O1'in kaydedilmiş örneklerinin ilk kez 0,10 veya üzerine çıktığı zaman. 0,10 bu ders için seçilmiş **raporlama düzeyidir; biyolojik ateşleme eşiği değildir**. Ara değer hesabı yapılmaz.
- Ulaşma gecikmesi: İlk ulaşma zamanından 100 ms uyaran başlangıcı çıkarılır. Düzeye hiç ulaşılmazsa zaman ve gecikme `null` kalır; arayüzde “—” ve açıklama gösterilir. Küçük pozitif bir tepe olup düzeye ulaşılmaması ayrıca mümkündür.
- Son değer: 700 model ms'de kaydedilen O1 değeri. Sonlu bir kayıt, hücrenin tabana tamamen döndüğünü garanti etmez.
- Farklar: Değişiklik eksi temel. Bir zaman yoksa farkı da sayı olarak uydurulmaz. Daha erken sabit düzey geçişi, biyolojik iletim hızının arttığı sonucunu vermez.

Tahmin geri bildirimi O1'in gerçek hesaplanmış tepe farkının işaretini kullanır; mutlak fark `1e-8` altında ise “aynı veya sayısal olarak çok yakın” sınıfındadır. Bu sınıflandırma biyolojik istatistiksel anlamlılık testi değildir.

## Kayıt ve taslak güvenliği

Başlangıçta sonuç yoktur. “Deneyi çalıştır” ve “Yeniden çalıştır”, iki gerçek simülasyon sonucunu, tüm sekiz hücrenin izlerini, ayarları, değişen değişkeni ve açıklanan varsayımları derin dondurulmuş bir kayda alır. Çalıştırma numarası yalnız başarılı hesapta artar. Tahmin de o anda ayrı kaydedilir.

Bağlantı veya τ taslağını değiştirmek önceki grafiği ya da sayıları değiştirmez. Önceki sonuç görünür kalır, “önceki ayarların sonucu” olarak işaretlenir ve yeniden çalıştırma istenir. Tahmin seçimi sonradan değişirse eski kaydın tahmini geriye dönük düzeltilmez. Aynı ayarla yeniden çalıştırma aynı sayıları verir.

Üç bölümün bağımsız sıfırlaması ve tüm rehberli deneyleri sıfırlama düğmesi vardır. Bu sıfırlamalar ilk öğrenme dersini veya ana devre deneyini değiştirmez. Aynı sekmede üç sayfa arasındaki geçişler, her sayfanın kendi durumunu korur. Yenileme varsayılanları açar; kalıcı depolama veya hesap eklenmedi.

## Biyolojik okuma kaynakları

Sayısal sonuçların kaynağı mevcut yerel model/motordur. Aşağıdaki kurumsal erişim bağlantıları temel biyolojik kavramları açıklar; bu deneylerin parametrelerini kalibre etmiş veya hayvan davranışını doğrulamış kaynaklar olarak sunulmaz:

- [Purves ve ark. (editörler), Neurotransmitter Receptors and Their Effects](https://www.ncbi.nlm.nih.gov/books/NBK11099/): etkinin reseptör ve hücresel bağlama bağlı olması.
- [Purves ve ark. (editörler), Excitatory and Inhibitory Postsynaptic Potentials](https://www.ncbi.nlm.nih.gov/books/NBK11117/): uyarıcı/baskılayıcı etki ile gerilim yönünün ayrılması.
- [Purves ve ark. (editörler), Long-Distance Signaling by Means of Action Potentials](https://www.ncbi.nlm.nih.gov/books/NBK11107/): yerel sinyal ile aksiyon potansiyelinin ayrımı.

Özgün Türkçe açıklama ve özgün SVG çizimleri kullanılır. Önceki gerçek veri lisansı ve yerel paylaşım sınırları korunur. Bu bölümün karşılaştırmaları gerçek altgrafı kullanmaz.

## Doğrulama

2026-10-03, aynı Mac mini üzerinde:

- `npm test`: 134 birim testi geçti; 27 yeni test iki koşulun bütün hücre izlerini bağımsız mevcut motor çağrılarıyla karşılaştırır. Tek değişken, sıfır çıktı, raporlama düzeyine ulaşmayan pozitif çıktı, deterministik tekrar ve kayıt değişmezliği denetlendi.
- `.venv/bin/python -m unittest discover -s scripts/tests -v`: mevcut 15 içe aktarma testi geçti.
- `npm run test:browser -- --output=test-results/guided-browser`: 85 test geçti, masaüstündeki mobil dokunma testi kasıtlı olarak atlandı. Aynı dokunma testi mobil projede geçti. 12 yeni masaüstü/mobil senaryo ve önceki bütün senaryolar çalıştı; eski test dosyaları değiştirilmedi.
- Yeni tarayıcı testleri tablodaki gerçek sayıları, iki eğrinin 701 örneğinin tamamını, gerçek 0–1 eksenini, 0–700 zaman eksenini ve 100–300 uyaran bandını mevcut motorla doğrular. Boş/yanlış/emin değilim tahminleri, klavye denetimleri ve sonuç bildirimleri çalışır.
- Taslak değişirken önceki kayıt korunur; yeniden çalıştırma yeni kaydı hesaplar. Bölüm/tüm-deney sıfırlamaları ayrı kalır. İlk dersin ayarları ve cevapları, eski örnek/gerçek devrenin bütün dışa aktarılan JSON kaydı, seçili hücre, zaman ve 2D/3D durumu sayfa geçişlerinde korunur.
- Doğrudan adres, yenileme, fragment, geri/ileri, native mobil dokunma ve masaüstü Cmd/middle-click yeni sekme davranışı geçti. Her seferinde tek görünür `main` ve doğru sayfa başlığı vardır.
- Son `npm run build` içindeki tam TypeScript kontrolü ve üretim derlemesi geçti. Mevcut büyük Three.js paketine ilişkin Vite boyut uyarısı sürer; başarısızlık yoktur, yeni bağımlılık eklenmedi.

Gerçek Chrome ekranları 1440 px masaüstü, 390 px mobil ve 320 px dar/reduced-motion görünümünde incelendi; yatay taşma ve tarayıcı hatası yoktu. Derlenmiş üretim önizlemesinde masaüstü/mobil doğrudan açma, yenileme, deneyler, ders geçişi ve gerçek 30 hücreli 3D görünüm tekrar doğrulandı. Apple M4/Metal WebGL2 bağlamı sağlıklı kaldı; örnek ve gerçek devrenin hesaplanmış sonuçları aynıydı. Uzun element ekran görüntülerinde görünen sabit skip-link örtüşmesinin ekran yakalama kaynaklı olduğu, normal viewport görüntüsü ve odak/konum ölçümüyle doğrulandı.

Önceki 40 kaynak, test, yapılandırma, ders, model ve veri dosyasının SHA-256 değerleri aynı kaldı. `README.md` önceki metni aynen koruyarak genişletildi; yalnız sayfa kabuğuna yeni rota/menü eklendi. Paket/lock dosyaları değişmedi. Ham gerçek veri `dist/` veya `public/` altına konmadı. Önceki 3D ve ilk ders kanıtları korundu.

Kanıtlar `test-results/guided-browser/` ve `test-results/guided-visual/` altındadır. `report.json`, `production-report.json` ve `preservation.json` kapsamı kaydeder. Üretim önizlemesi testten sonra durduruldu; mevcut geliştirme sunucusu `http://127.0.0.1:5176/` olarak kaldı. Safari/Firefox ve fiziksel iPhone test edilmedi. Başka cihaz veya projeye aktarım ve yayımlama yapılmadı.
