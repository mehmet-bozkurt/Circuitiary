# Nörondan devreye: kapsam ve doğrulama

Yeni öğrenme sayfası `/ogren/norondan-devreye` adresindedir. `/` adresindeki deney sayfası ve onun `#top` / `#assumptions` bağlantıları korunur. Üst menü iki bölüm arasında geçiş sağlar. Ders altı bölümde nöron parçaları, elektriksel sinyaller, kimyasal sinaps, uyarıcı/baskılayıcı etki, elektriksel sinaps ve küçük devreyi ele alır; sözlük ve sekiz açıklamalı öz denetim sorusu içerir.

## Öğretim modellerinin sınırları

Tüm örnekler elle seçilen, boyutsuz öğretim modelleridir. Hücrelerin çizimi, zaman eksenleri ve katsayıları deneysel ölçümlerden alınmadı. Kaynaklar biyoloji açıklamalarını destekler; bu modellerin biyolojik kalibrasyonu veya doğrulanması olarak sunulmaz.

1. **Eşik gösterimi:** Pozitif uyaran eşik değerine ulaşırsa aynı tek olay çizimi seçilir. Eşik altı iz büyüklüğü uyaranla değişir; sıfır uyaran olay üretmez. Eğri zar gerilimi ölçümü, iyon kanalı çözümü veya aksiyon potansiyeli uyumu değildir. Olay sayısını, frekansı veya spike train üretimini hesaplamaz.
2. **Kimyasal etki:** `drive = excitation - inhibition`; gösterilen etkinlik `clip(drive, 0, 1)`. İşaretler öğretim için atanır. Reseptör, iyon dengesi ve iletkenlik çözülmediğinden bu çıkarma, şönt tipi baskılanmanın mekanizmasını modellemez.
3. **Gap örneği:** `da/dt = g(b-a)`, `db/dt = g(a-b)`; başlangıç 1 ve 0, ters çevirme bu başlangıçları değiştirir. Açık çözüm, simetrik karşılıklı pasif bağlaşımı gösterir. Sızıntı, dış girdi ve doğrultma yoktur; gerçek elektriksel bağlantılarda bu simetri evrensel değildir.
4. **Üç hücreli devre:** `tau da/dt = -a + pulse`, `tau db/dt = -b + clip(0.9a)`, `tau dc/dt = -c + clip(0.35 + w*b)`. `tau=0.35`, `dt=0.02`, uyaran `[1,3)` aralığında; `w=+1` veya `-0.9`. B→C bağlantısının model etkisini kaldırmak `w=0` yapar. C'nin 0.35 sabit taban girdisi korunur; hücre silinmez. Eşzamanlı açık Euler bütün güncellemeleri bir önceki durumdan hesaplar.

Dersteki eşik çizimi ile deney sayfasındaki sürekli 0–1 etkinlik modeli farklıdır. Bağlantı haritası anatomiyi, dinamik denklem seçilmiş varsayımları temsil eder. Küçük devrede bir çıkış değişikliği görmek gerçek hayvan davranışını veya biyolojik beyin emülasyonunu doğrulamaz.

## Kaynaklar

Özgün Türkçe açıklamalar ve özgün SVG çizimleri kullanılır. Dış kaynak görselleri veya uzun alıntılar eklenmez. Kaynak bağlantıları ders içinde ilgili bölümde ve kaynak listesinde görünürdür.

| Konu | Kurumsal kaynak veya özgün araştırma |
| --- | --- |
| Tipik nöron yapısı | [NIH/NCI, Nerve Tissue](https://training.seer.cancer.gov/anatomy/nervous/tissue.html) |
| Dinlenim gerilimi | [Purves ve ark. (editörler), The Ionic Basis of the Resting Membrane Potential](https://www.ncbi.nlm.nih.gov/books/NBK10931/) |
| Pasif sinyal ve aksiyon potansiyeli | [Purves ve ark., Long-Distance Signaling by Means of Action Potentials](https://www.ncbi.nlm.nih.gov/books/NBK11107/) |
| Kanallar ve elektriksel sinyaller | [Alberts ve ark., Ion Channels and the Electrical Properties of Membranes](https://www.ncbi.nlm.nih.gov/books/NBK26910/) |
| Kimyasal sinaps | [Purves ve ark., Chemical Synapses](https://www.ncbi.nlm.nih.gov/books/NBK11009/) |
| Reseptör ve etki | [Purves ve ark., Neurotransmitter Receptors and Their Effects](https://www.ncbi.nlm.nih.gov/books/NBK11099/) |
| Baskılanma ve şönt etkisi | [Purves ve ark., Excitatory and Inhibitory Postsynaptic Potentials](https://www.ncbi.nlm.nih.gov/books/NBK11117/) |
| Kısa süreli sinaptik değişimler | [Purves ve ark. (editörler), Mechanisms of Short-Term Synaptic Plasticity in the Mammalian Nervous System](https://www.ncbi.nlm.nih.gov/books/NBK10968/) |
| Elektriksel sinaps | [Purves ve ark., Electrical Synapses](https://www.ncbi.nlm.nih.gov/books/NBK11164/) |
| Doğrultucu elektriksel bağlantı | [Liu ve ark., 2017, C. elegans'ta doğrultucu gap junction araştırması](https://pmc.ncbi.nlm.nih.gov/articles/PMC5364397/) |
| C. elegans'ta dereceli iletim | [Liu ve ark., 2009, Graded Synaptic Transmission at the Caenorhabditis elegans Neuromuscular Junction](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705609/) |
| AWA'da kalsiyum aksiyon potansiyelleri | [Liu ve ark., 2018, Cell](https://pubmed.ncbi.nlm.nih.gov/30220455/) |
| Anatomik ve işlevsel bağlantı | [Randi ve ark., 2023, Neural Signal Propagation Atlas of Caenorhabditis elegans](https://www.nature.com/articles/s41586-023-06683-4) |
| Nöron anatomisi, yerel sinyal ve aksiyon potansiyeli | [Betts ve ark., OpenStax Anatomy and Physiology 2e, 12.2 Nervous Tissue](https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue) |

## Gezinti ve durum

Yeni `Shell.vue`, eski `App.vue` deneyini değiştirmeden sarmalar. Ders ayrı parça olarak yüklenir; yeni paket veya router bağımlılığı eklenmez. İki sayfa ilk ziyaretlerinde bağlanır, sonraki geçişlerde görünürlükleri değişir. Deney ayarları, sonuçlar, seçili hücre/görünüm ve ders cevapları aynı sekmede sayfa geçişleri boyunca korunur. Yenileme ise önceki davranışa uygun olarak varsayılan durumu açar.

Menü gerçek bağlantılardan oluşur; doğrudan URL, yenileme, tarayıcı geçmişi ve masaüstü değiştirici/orta tıklaması kullanılabilir. Sayfa geçişinde başlık ve klavye odağı güncellenir; gizli sayfanın denetimleri erişilebilirlik ağacında yer almaz. Bölüm bağlantıları tarayıcının yerel fragment davranışını kullanır. Mac'te kurulu Chrome ile iPhone boyutu emülasyonu, fiziksel iPhone veya Safari doğrulaması değildir.

## Doğrulama kaydı

3 Ekim 2026'da Mac mini üzerinde tamamlandı:

- **107 Vitest testi geçti:** önceki 92 model/yerleşim testi ve yeni 15 öğretim matematiği testi. Eşik sınırı/sıfır girdi, sabit tek olay biçimi, negatif net girdinin kırpılması, gap toplamı/yakınlaşması ve devrenin nedensellik/bağlantı kaldırma/taban koruma koşulları sınanır.
- **15 Python ithalat testi geçti.** Gerçek veri kaynağı, yönler, ağırlıklar, tekrar üretim ve dış bağlantı kayıtları korunur.
- **73 Playwright testi geçti; 1 kasıtlı atlama:** 22 yeni ders senaryosu ve önceki 51 senaryo. Yalnız masaüstünde uygulanmayan mobil dokunma senaryosu atlandı; mobil projesinde çalıştı ve geçti. Tam komut: `npm run test:browser -- --output=test-results/neuron-lesson-browser`.
- Tam **TypeScript kontrolü ve Vite üretim derlemesi geçti**. Derste yeni paket yok; `package.json` ve kilit dosyası aynıdır. Önceden var olan, dinamik yüklenen Three.js parçasının boyut uyarısı sürer.
- Doğrudan ders URL'si, yenileme, bölüm fragment'i, geri/ileri, yerel eski fragment'ler, klavye odağı ve skip link, mobil dokunma, gerçek Cmd/orta tıklama ve sekiz sorunun doğru/yanlış açıklamaları/sıfırlaması doğrulandı.
- Önceki öğretici deneyin ayarları, seçimi, zaman imleci, koşulu, grafikleri ve JSON sonuçları; gerçek veri deneyinin 30 hücresi, anatomisi, katsayıları, 3D görünümü ve JSON sonuçları ders ziyaretinden sonra aynı kaldı.
- Gerçek Chrome'da **1440, 390 ve 320 piksel** genişliklerde yatay taşma veya yinelenen ID görülmedi. 320 piksel kontrolde azaltılmış hareket tercihi açık kullanıldı. Etkileşim ve geri bildirim ekran görüntüleri incelendi.
- Üretim önizlemesinde (`127.0.0.1:4177`) doğrudan bölüm URL'si/yenileme, ders hesabı, iki deney modu ve ders↔gerçek 3D geçişi geçti. Önizleme kontrol sonunda kapatıldı; mevcut geliştirme adresi `127.0.0.1:5176` açık kaldı. Gerçek altgraf JSON'u üretim paketine gömülmedi.
- **31 korunan mevcut dosyanın SHA-256 değeri aynı.** Bunlar `App.vue`, ortak stil, tüm eski model/2D/3D kaynakları, eski testler, ithalat, eski kapsam belgeleri, veri JSON'ları ve bağımlılık/yapılandırma dosyalarını içerir. README'nin önceki 12.235 baytı aynen korunarak yeni bölüm sona eklendi.

Yeni menü `src/Shell.vue` içinde, giriş değişikliği `src/main.ts` içinde; yeni ders kaynakları `src/components/NeuronLearningPage.vue` ve `src/learning/` altında. Yalnız yeni birim testleri için `vitest.config.ts` kapsamına `src/learning/**/*.test.ts` eklendi. Eski kaynak/test dosyalarına bu ders için değişiklik yapılmadı.

İlk masaüstü yeni sekme testi, açılan sekme için yanlışlıkla `Page.popup` olayı bekliyordu. Kayıtlı trace, gerçek Cmd tıklamasının ders URL'sinde yeni `BrowserContext.page` oluşturduğunu gösterdi. Bekleme doğru olaya geçirildi; gerçek tıklamalar, hedef URL/başlık/main denetimleri ve kaynak sayfanın aynı kalması korundu, 1→2→1 sekme sayısı kontrolü eklendi. Son tam test çalışmasında bu senaryo geçti. Reddedilen ayrı tarayıcı tanılaması yeniden denenmedi; düzeltme mevcut kaydın salt okunur incelemesine dayandı.

Kanıtlar: `test-results/neuron-lesson-browser/`, `test-results/neuron-lesson-visual/report.json`, `production.json`, `preservation.json` ve bölüm/geri bildirim/3D ekran görüntüleri. Önceki `test-results/3d-visual/` kanıtları ayrı çıktı klasörü kullanılarak korundu. Gerçek 3D tuvali Apple M4/Metal WebGL2 ile çizildi; bağlam kaybı görülmedi. Safari/Firefox, fiziksel iPhone ve ekran okuyucu testi yapılmadı; erişilebilirlik burada klavye, semantik etiketler, odak ve görünür landmark kontrolleriyle sınanmıştır.
