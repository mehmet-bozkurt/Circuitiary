# Türler atlası

Beşinci öğrenme sayfası `/ogren/turler-atlasi`, **C. elegans** ve **Drosophila melanogaster** için seçilmiş bağlantı haritalarını karşılaştırır. Bu bir öğretici veri kataloğudur. Kartlar yayınlara ve resmî erişim sayfalarına dayanır; büyük veri dosyaları, harici görüntüler veya uzak sorgular yüklenmez. Altıncı bölüm bu aşamanın kapsamında değildir.

## Veri kaydını okumak

Her kart bir türe değil, belirli bir veri kaydına aittir: yaşam evresi, cinsiyet, incelenen bölge, yayın/sürüm, örnekleme ve sayıların birimi beraber okunur. Tam beyin, tüm merkezi sinir sistemi ve tüm hayvanın sinir sistemi farklı sınırlardır. Sineğin merkezi sinir sistemi beyin ve ventral sinir kordonunu kapsar; tüm beyin haritası tek başına kordonu veya bütün bedeni içermez. Sinir sisteminin kapsamlı anatomisi de kas dinamiklerini, çevreyi ve çalışan bir hayvanı tanımlamaz.

| Kayıt | Yaşam evresi / cinsiyet | Kapsam ve sabitlenmiş sayı |
| --- | --- | --- |
| Circuitiary yerel alt kümesi | Erişkin hermafrodit | AVAR/AVER çevresindeki 30 hücre; 196 yönlü kimyasal kayıt ve 50 fiziksel gap çifti. SI5 July2020/SI4, `avar-aver-one-hop-v1`. |
| Cook2019 hermafrodit | Erişkin hermafrodit | Bütün sinir sistemi, 302 nöron; birden çok EM serisinden bileşik ve kısmen ekstrapole edilmiş harita. SI5 corrected July2020 ve SI4 erişim sürümü. |
| Cook2019 erkek | Erişkin erkek | Bütün sinir sistemi, 385 nöron; aynı bileşik yaklaşım. Yayındaki 579 bütün-hücre düğümü ile 385 nöron farklı sayımlardır. |
| Winding2023 larva | Altı saatlik dişi, birinci larva evresi | Beyin, 3.016 nöron (480 giriş + 2.536 beyin nöronu); yaklaşık 548.000 işaretli sinaptik bölge. Yayımlanmış Science2023 sayımı. |
| Hemibrain2020 | Erişkin dişi | Kısmi merkezi beyin; yaklaşık 25.000 nöron ve bu yayın kapsamındaki yaklaşık 20 milyon kimyasal sinaps. Güncel neuPrint sürümünün yeniden hesaplanmış sayıları değildir. |
| FlyWire2024 | Erişkin dişi | Bütün beyin, merkezi beyin ve optik loblar; v783, 139.255 nöron ve aralarında yaklaşık 54,5 milyon kimyasal sinaps. |
| MaleCNS2026 | Erişkin erkek | Beyin + ventral sinir kordonu; yayında 166.700 nöron. Resmî v1.0, 8 Haziran2026, `male-cns:v1.0`; Cell yayını 3 Eylül2026. |

Cook'un 460/579 bütün-hücre grafı nöronların yanında kas ve uç organlar içerir; yayın kenar toplamları nöronlar arasındaki sinaps sayısı diye okunmaz. Bu atlas SI5 ham ağırlıklarının birimini verir, tüm matrisin kesit toplamını hesaplamaz. Larva yayını beyin rekonstrüksiyonudur; kaynak EM hacminin CNS'yi kapsaması, bu beyin grafını tam beyin+VNC grafına dönüştürmez. Larvada nöronların %99'dan fazlası tamamlanmış, işaretlenen sinaptik noktaların yaklaşık %75'i nöronlara bağlanmıştır. Bu iki tamamlanmışlık ölçüsü aynı değildir.

FlyWire'da her pre→post konum eşleşmesi bir kimyasal sinaps olarak sayılır. Bir presinaptik yapının birden çok postsinaptik ortağı varsa birden çok eşleşme sayılır; 54,5 milyon farklı nöron çifti anlamına gelmez. MaleCNS için özgün yayımlanmış metinden kesin sinaps toplamı bu incelemede doğrulanamadığından katalog bir toplam ileri sürmez. Bu eksiklik sıfır bağlantı demek değildir.

Sayılar kartta belirtilen yayına veya sürüme sabitlenmiştir; portalın güncel sayaçlarıyla farklı yayınların ölçütleri karıştırılmaz. Nöron sayısı, nöron çiftleri arasındaki kenar sayısı, ayrı sinaptik temaslar ve seri EM kesiti ağırlığı farklı birimlerdir. Bu sayfalarda türlerin bilişsel gücünü sıralayan bir oran hesaplanmaz.

## Etkileşimler

Tür filtresi ve kayıt seçimi incelenen kartı değiştirir. İki bağımsız seçim, kayıtların yaşam evresi, cinsiyet, bölge, örnekleme ve sayım birimlerini aynı tabloda karşılaştırır; aynı kaydı iki tarafta seçmek geçerlidir. Filtre, karşılaştırma seçimlerini değiştirmez. Açıklamalı kapsam soruları anatomik kayıttan hangi sonuçların çıkarılabileceğini öğretir. Atlas sıfırlaması yalnız bu sayfanın seçimlerini ve cevaplarını sıfırlar.

Anatomik graf, parametre eklenmiş dinamik model, beden/çevre ile davranış simülasyonu ve bağımsız ölçümlerle doğrulanmış biyolojik emülasyon ayrı açıklanır. Nörotransmitter tahmini fizyolojik kalibrasyon değildir. Bağlantı sayısından tek başına voltaj, zaman sabiti, sinaptik güç, davranış veya bellek içeriği elde edilmez.

## Circuitiary ile ilişkisi

Circuitiary'nin mevcut gerçek deneyleri, Cook2019'un düzeltilmiş Temmuz2020 SI5 ve SI4 tablolarından seçilen **30 hücre**, **196 yönlü kimyasal kayıt** (beşi öz bağlantı) ve **50 tekil fiziksel gap çifti** ile sınırlıdır. Bu sayılar seçilmiş altgrafın kayıt sayılarıdır; 196 sinaps anlamına gelmez. Ham ağırlık seri EM kesitleriyle ilişkilidir; normalize edilmiş model katsayıları ölçülmüş fizyolojik güç değildir.

Atlasın C. elegans kayıtları bu altgrafın kaynak ailesini açıklar. Tam solucan verisi yeni bir deney olarak yüklenmez; Drosophila kayıtları da simülasyon motoruna aktarılmaz. Mevcut 3D görünüm şematiktir; atlas veya kaynak bağlantıları anatomik morfolojiyi bu görünüme eklemez.

## Erişim, kaynak ve izin

Kaynaklar yayın veya veri sağlayıcının sayfalarına giden normal bağlantılardır. Kullanıcı isteyerek açana kadar harici sitelerden veri istenmez. Erişilebilir bir sayfa veya açık erişimli bir makale, bağlantılı ham veri dosyalarının aynı yeniden dağıtım iznine sahip olduğu anlamına gelmez. Makale lisansı ve veri kullanım koşulları ayrı okunur. Önceki yerel verinin `unverified-local-only` sınırı değişmez.

- [Cook ve ark., 2019](https://doi.org/10.1038/s41586-019-1352-7) ve [WormWiring matrisleri](https://wormwiring.org/pages/adjacency.html): bütün sinir sistemi, bileşik kayıtlar, nöron/bütün-hücre ayrımı ve SI5 kesit birimi.
- [Winding ve ark., 2023, özgün makale ve Methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC7614541/) ve [L1 CATMAID](https://l1em.catmaid.virtualflybrain.org/): altı saatlik dişi L1 örneği, 3.016 nöron ve sinaptik bölge sayımı.
- [Scheffer ve ark., 2020](https://doi.org/10.7554/eLife.57443) ve [Janelia Hemibrain](https://www.janelia.org/project-team/flyem/hemibrain): kısmi beyin ve yaklaşık yayın sayıları. Veri kümesinin CC BY4.0 lisansı resmî veri sayfasında belirtilir.
- [Dorkenwald ve ark., 2024](https://www.nature.com/articles/s41586-024-07558-y), [v783.0 bağlantı arşivi](https://zenodo.org/records/10676866), [FlyWire yönergeleri](https://home.flywire.ai/guidelines) ve [Codex](https://codex.flywire.ai/): bütün dişi beyni, yayın sayımı, sürüm ve erişim koşulları.
- [Berg ve ark., 2026](https://doi.org/10.1016/j.cell.2026.08.015), [MaleCNS sürüm notları](https://male-cns.janelia.org/release/) ve [MaleCNS veri erişimi](https://male-cns.janelia.org/download/): erişkin erkek beyin+VNC, v1.0 ve veri kümesinin CC BY4.0 lisansı.
- [BANC2026](https://www.nature.com/articles/s41586-026-10735-w): dişi beyin+VNC için ek güncel bağlam. Bu ilk atlasın karşılaştırma kayıtlarına eklenmedi; yeni veri indirilmedi.

FlyWire'ın belirli v783.0 Zenodo bağlantı arşivi metadata'sı CC BY4.0, güncel genel public-release yönergeleri CC BY-NC4.0 gösterir. Katalog bu arşivi ve genel portal koşullarını ayrı açıklar; bütün FlyWire verisine tek lisans atamaz. Gelecekte belirli dosyanın yeniden kullanımı için seçilen kaynak koşulları yeniden değerlendirilmelidir. Codex'in güncel uygulamalarına erişim Google hesabıyla oturum gerektirir. neuPrint API kullanımı da hesap ve erişim jetonu isteyebilir; atlas bunları kullanmaz. Cook SI4/SI5 ve larva veri dosyası için dosyaya özgü yeniden dağıtım izni bu çalışmada doğrulanmadı. Kaynak yayının açık erişim lisansı bu dosyalara otomatik aktarılmaz.

Kaynak kontrol tarihi: **2026-10-03**. Bu ilk atlas seçilmiş kayıtlarla sınırlıdır; tüm mevcut connectome projelerinin envanteri değildir.

## Doğrulama kaydı

2026-10-03, aynı `Mehmet-Mac-mini.local` üzerinde:

- `npm test`: **185 birim testi geçti**. Önceki 173 teste 12 yeni atlas testi eklendi. Derin değişmezlik, bağımsız filtreleme, geçersiz kimlikler, aynı kayıt karşılaştırması, farklı birimler/kapsamlar, eksik sayıların sıfır olmaması, kaynak/sürüm ilişkileri ve soruların doğru/yanlış açıklamaları denetlendi.
- `.venv/bin/python -m unittest discover -s scripts/tests -v`: **15 veri/içe aktarma testi geçti**; gerçek ham kaynak ve 246 yerel bağlantı kayıtları korunur.
- `npm run test:browser -- --output=test-results/atlas-browser`: **139 senaryo geçti**, mevcut masaüstü projesindeki mobil dokunma senaryosu kasıtlı olarak atlandı; aynı senaryo mobilde geçti. Yeni dokuz senaryo iki profilde 18 kez başarılı oldu. Önceki 121 başarılı tarayıcı senaryosu ve bütün eski test dosyaları korundu.
- Atlas tarayıcı testleri yeni katalog veya karşılaştırma yardımcısını içe aktarmaz. Bağımsız sabitlenmiş kaynak beklentileriyle yedi kaydın görünen sayıları, birimleri, yaklaşık/tam ayrımı, yaşam evresi, cinsiyeti, bölgesi, sürümü, kaynak bağlantısı ve veri lisansı doğrulanır. FlyWire arşivi/genel yönerge ayrımı ile MaleCNS v1.0 tarihi gerçek görünen içerikten denetlenir. Beyin ve CNS karşılaştırması farklı bölge/cinsiyet satırlarıyla doğrulanır.
- Tür filtrelemesi karşılaştırma seçimlerini etkilemez. Aynı kayıt iki tarafta seçilebilir; tablo hücreleri ve birimler aynı kalır. Dört sorunun yanlış ve doğru çıkarımları, gerekçeleri, etiketli native radyoları ve sayfaya özgü sıfırlaması geçer. Bütün atlas etkileşimleri boyunca yerel connectome API'si, uzak istek, fetch/XHR veya veri indirmesi yapılmadığı doğrulanır.
- İlk dersin girdileri, rehberli deneyin tahmini ve tamamlanmış eğrileri, üçüncü dersin gap yolu ve adımı, dördüncü dersin kaydı/eski taslağı ve 701 örnekli iki eğrisi atlas ziyaretinden ve sıfırlamasından sonra korunur. Görünür grafik boyut güncellemesi beklendikten sonra sayısal değerler ve SVG yolları tam olarak karşılaştırılır.
- Ana örnek 2D ve gerçek 3D deneylerinde bütün denetimler, izlenen çıktı, zaman/oynatma, filtreler, renderer kimliği ve tam dışa aktarılan sayısal JSON korunur. Klavye/skip-link, doğrudan adres ve derin fragment, yenileme, geri/ileri ve tam kaydırma geri yüklemesi, mobil dokunma ve gerçek Cmd/middle-click yeni sekme davranışı geçer.
- Son `npm run build`: tam TypeScript kontrolü ve üretim derlemesi geçti. Önceden var olan Three.js büyük chunk uyarısı devam eder; bağımlılık/paket/lock dosyaları değişmedi.
- Gerçek Chrome'da 1440 px masaüstü, 390 px mobil ve 320 px reduced-motion görünümleri incelendi; yatay taşma, yinelenen ID veya tarayıcı hatası yoktu. Altı yayın kartı, küçük ekranda sayı/birim açıklamaları, iki kayıt karşılaştırması, sorular ve kaynak bölümü doğrulandı. Derlenmiş yerel üretim önizlemesinde masaüstü/mobil tekrar geçti; Apple M4/Metal WebGL2 bağlamı sağlıklı, mevcut gerçek deneyin JSON'u aynı kaldı.
- Önceki **66 kaynak/test/veri/belge/yapılandırma dosyası** SHA-256 ile aynıdır. `App.vue` bütünü, dört ders, bütün eski testler ve ham/türetilmiş yerel veri korunur. Shell yalnız altıncı kalıcı görünüm, menü ve rota desteği alır; Shell CSS aynıdır. README'nin önceki metni tam olarak korunup eklenir. Önceki dokuz kanıt klasörü saklanır; gerçek veri `public/` veya `dist/` içine konmaz.

Kanıtlar `test-results/atlas-browser/` ve `test-results/atlas-visual/` altındadır. `report.json`, `production-report.json`, `preservation.json` ve ekran görüntüleri kapsamı kaydeder. Kısa üretim önizlemesi durduruldu; geliştirme sunucusu `http://127.0.0.1:5176/` olarak açık kaldı. Safari/Firefox ve fiziksel iPhone test edilmedi. Yeni bağımlılık/kurulum, büyük veri indirme, yeni motor, Deney defteri, başka projeye/cihaza aktarım veya yayımlama yapılmadı. Kalan engel yoktur.

## Tekrarlanabilirlik notu (Kasım 2026)

Bu belgedeki 320 px/azaltılmış hareket ve üretim önizlemesi denetimleri o tarihte projede bulunmayan bir kerelik betiklerle yapılmış ve `test-results/` altındaki kanıt klasörlerine yazılmıştı. Bugün aynı türden denetimler `tests/evidence.spec.ts` ile masaüstü, mobil, 320×800 azaltılmış hareket ve derlenmiş paketin önizlemesi (4177) profillerinde tekrarlanır: yatay taşma, yinelenen ID, konsol hatası, bölüm bağlantısıyla doğrudan açma ve yenileme, kaynak motorla aynı sayılar. Ayrıntılar [doğrulama kaydındadır](verification.md#tekrarlanabilir-kanıt). “Korunan dosyalar aynı kaldı” türü SHA-256 karşılaştırmaları o aşamaya aittir ve tekrarlanamaz; değişiklik geçmişi artık git'te tutulur.
