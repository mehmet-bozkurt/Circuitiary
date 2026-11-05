# Yerel gerçek anatomi verisi: AVAR/AVER altgrafı

## Tamamlanan veri aşaması

Cook 2019’un düzeltilmiş SI5 çalışma kitabı ile SI4 hücre listesi yerel olarak okunup doğrulandı. Deterministik seçim **30 nöron, 196 yönlü kimyasal kenar ve 50 tekil elektriksel kenar** üretir. Beş kimyasal öz bağlantı korunur. Yerel üretilen veri `data/local/cook-subset.json`, kaynak/ithalat kaydı `data/local/acquisition.json` içindedir; ham çalışma kitapları `data/raw/` altında kalır. Bu yollar sürüm kontrolü ve yayımlanacak paketten dışlanır.

Bu aşama gerçek **anatomik bağlantı** verisini ekler. Nörotransmitter/reseptör kanıtı, işaret, etkin sinaptik kuvvet, zaman sabiti, kalsiyum gözlem modeli ve davranış doğrulaması eklemez. Dinamik deneyi çalıştırırken bu bilgileri varsayımsal model parametrelerinden ayırmak gerekir. Bütün hayvanın biyolojik beyin emülasyonu iddiası yoktur.

## Kaynak, sürüm ve bütünlük

Makale: Cook ve ark., “Whole-animal connectomes of both Caenorhabditis elegans sexes”, Nature 2019; [DOI: 10.1038/s41586-019-1352-7](https://doi.org/10.1038/s41586-019-1352-7). Resmî indirme listesi: [WormWiring adjacency matrices](https://wormwiring.org/pages/adjacency.html).

| Dosya | Yerel ad | SHA-256 |
| --- | --- | --- |
| [SI5, corrected July 2020](https://wormwiring.org/si/SI%205%20Connectome%20adjacency%20matrices%2C%20corrected%20July%202020.xlsx) | `cook2019-si5-corrected-july2020.xlsx` | `1f4fdbf84746b69b49a8da0816f52787860ce349b638dce37924ba80f90c70c9` |
| [SI4 cell lists](https://wormwiring.org/si/SI%204%20Cell%20lists.xlsx) | `cook2019-si4-cell-lists.xlsx` | `f5c524407e196ba8045cfb86fb996d41730e4b899a7c24b0c525a4d2ad0a7376` |

UTC edinim zamanları SI5 için `2026-10-03T02:46:04.246507Z`, SI4 için `2026-10-03T02:51:05.053918Z` olarak kaydedilir. Bu çalıştırmada zaman kanıtı indirme sonrasında kaydedilen yerel dosya mtime değeridir; ithalat zamanı veya deneyin yapıldığı tarih değildir. Dosya byte uzunlukları, gerçek çalışma sayfası adları ve bütün seçim raporu manifestte hesaplanır. CLI her iki tam dosya özetini sabit beklenen değerlerle karşılaştırır; değişmiş dosyada çıktı üretmeden durur.

Cook’un bütün hayvan grafı farklı EM serileri/hayvanlar birleştirilerek ve bazı veri boşlukları ekstrapolasyonla doldurularak oluşturulmuştur. SI5 ağırlığı toplam **seri EM kesiti sayısıdır**; sinaps adedi ve boyutunu birlikte temsil eder. Salt sayılmış sinaps adetlerini veren SI2’den farklıdır. Bir altgraf kenarına, kaynak ayrıca ayırmıyorsa “doğrudan ölçülmüş” veya “ekstrapole edilmiş” etiketi uydurulmaz. [Birincil makale ve ek açıklamaları](https://www.nature.com/articles/s41586-019-1352-7)

## Gerçek çalışma kitabının düzeni

- Kimyasal sayfa: `hermaphrodite chemical`, **300 kaynak satırı × 454 hedef sütunu**. Satır adları C4’ten, hedef başlıkları D3’ten başlar; ilk ağırlık hücresi D4’tür. Kimyasal matris kare değildir.
- Elektriksel sayfa: `hermaphrodite gap jn symmetric`, **469 × 469**. Aynı başlık düzeni kullanılır; hücre kümeleri ve bütün pozitif karşılıklı ağırlıklar doğrulanır. Asimetrik gap sayfası simetrik fiziksel kenar kaynağı yerine kullanılmaz.
- SI4’ün `pharynx`, `sex-shared`, `hermaphrodite specific` sayfaları **302 nöronluk** tam ad eşleşen izinli liste sağlar. Özgün `sensory`, `interneuron`, `motorneuron`, `neuron` sınıfları korunur. Kaslar ve diğer hücreler seçime alınmaz; dış bağlantı raporunda yer alabilir.
- CANL ve CANR kimyasal hedeflerde ve gap tablosunda vardır; kimyasal kaynak satırları yoktur. Bu, sabit kaynak sürümü için açıklanmış istisnadır. Hayalî satır/hücre eklenmez; farklı bir nöronun beklenmedik eksikliği hata olur.
- Kaynağın seyrek matris gösterimindeki boş sayısal hücreler “bu dosyada kayıtlı kenar yok” anlamında okunur. Bu biyolojik olarak bağlantının kesin yokluğunu kanıtlamaz. Boş başlık, eksik sınıflama, bozuk eşleme veya geçersiz sayı bu kurala girmez ve hata olur. Kimyasal/gap boş giriş sayıları sırasıyla 131.321 ve 217.078 olarak raporlanır.

## Sabit seçim ve korunan ham değerler

Başlangıç düğümleri tam adlarıyla `AVAR`, `AVER` olur. Adaylar yalnızca bu iki hücrenin bir adım uzaklığındaki SI4 nöronlarıdır: sıfırdan büyük kimyasal gelen/giden veya gap bağlantısı yeterlidir. Adaylar önce iki başlangıç düğümüyle toplam **ham kimyasal ağırlık azalan**, sonra ayrı **tekil fiziksel gap ağırlık azalan**, sonra **tam hücre adı artan** sırada dizilir. Kimyasal ve gap puanları birbirine eklenmez. En fazla 28 aday eklenir; seçilen hücreler arasındaki bütün pozitif bağlantılar korunur. Görsel sadeleştirme için bir ağırlık eşiği uygulanmaz.

`selection.ranking` bütün adayları ve sıralarını içerir; başlangıç hücreleri bu listede tekrar edilmez. `selection.neuronIds`, iki başlangıç hücresi ve seçilen adayların sırası ile oluşur. Üretilen JSON şeması `schemaVersion: 1` kullanır.

Kimyasal kaynak sözleşmesi `C[kaynak, hedef]` biçimindedir. Model hedef satırından girdi topluyorsa dönüşüm `W[hedef, kaynak] = C[kaynak, hedef]` olarak yapılır. Yön kontrol örneği: **AVER → AVAR = 33**, hücre `HE176`; ters yönde **AVAR → AVER = 3**, hücre `GX183`. Bu değerler seri EM kesiti ağırlığıdır, 33 ve 3 sinaps veya ölçülmüş işlevsel etki değildir.

Her kimyasal kenar `source`, `target`, `rawWeight`, `sourceRef` taşır. Her normal gap kenarı tam adlarla `a < b` olacak şekilde bir kez saklanır; `sourceRef` ve `reciprocalSourceRef` iki eş ağırlıklı kaynak hücresini korur. Koordinatlar 1 tabanlı satır/sütun ve Excel hücre adıdır. Nöron referansları SI4’e, kenar referansları SI5’e aittir. Dinamik işaret veya ağırlık normalizasyonu bu ham alanları değiştirmez.

Simetrik kaynakta **17 pozitif köşegen gap kaydı** bulunur. Bunların tamamı kaynak koordinatları ve `selected` bayrağıyla `selection.excludedGapSelfEntries` içinde korunur; mevcut 30 hücre arasında seçilen köşegen kayıt yoktur. Alanın `neuronId` adı, kaynakta nöron olmayan hücrelerin de özgün etiketini taşıyabilir. Bu kayıtlar normal `gapEdges` listesine çevrilmez ve biyolojik öz bağlantı yorumu yapılmaz. Sessiz veri kaybı yoktur.

## Altgraf sınırı

| Dışarıda kalan bağlantı | Pozitif kaynak kenarı adedi | Ham seri EM kesiti ağırlığı toplamı |
| --- | ---: | ---: |
| Seçili hücrelere gelen kimyasal | 448 | 2.346 |
| Seçili hücrelerden çıkan kimyasal | 471 | 2.106 |
| Seçili/dış hücre arasındaki tekil gap | 336 | 3.544 |

`omittedExternal` bu toplamları, `omittedByNeuron` hücre başına aynı altı alanı verir. Dış hücreler yalnızca nöronlarla sınırlı değildir; kas ve diğer uç organ bağlantıları da rapora girer. Kaynakta olmayan CAN kimyasal satırları için hayalî dış kenar sayısı üretilmez.

Model **izole indüklenmiş altgrafı** kullanır: dış kimyasal girdiler ve bütün dış gap bağlantıları kaldırılır. Dış elektriksel hücreler sıfıra clamp edilmiş sayılmaz; onların etkisi modellenmemiştir. Çünkü sıfırda sabitlenmiş bir dış gap hücresi iç hücreye sızıntı etkisi yapardı, kenarı kaldırmak aynı sınır koşulu değildir. Altgrafın biyolojik olarak kapalı bir işlevsel devre olduğu öne sürülmez.

## Yerel tekrar üretim

Bağımlılıklar `requirements-importer.txt` içinde `openpyxl==3.1.5` ve `et-xmlfile==2.0.0` olarak sabitlenir. İthalatçı internet erişimi kullanmaz ve dosya indirmez. Resmî kaynaklardan edinilmiş iki yerel dosyayı okur:

```sh
.venv/bin/python scripts/import_cook2019.py \
  --si5 data/raw/cook2019-si5-corrected-july2020.xlsx \
  --si4 data/raw/cook2019-si4-cell-lists.xlsx \
  --si5-downloaded-at 2026-10-03T02:46:04.246507Z \
  --si4-downloaded-at 2026-10-03T02:51:05.053918Z \
  --output data/local/cook-subset.json \
  --acquisition-output data/local/acquisition.json

.venv/bin/python -m unittest discover -s scripts/tests -p 'test_import_cook2019.py' -v
```

`--help` bütün seçenekleri açıklar; `--limit` toplam düğüm sayısını 2–30 arasında sınırlar. Başlık, hücre eşlemi, sayı geçerliliği, simetri, başlangıç hücreleri ve kaynak özetleri doğrulanmadan JSON hedefleri yazılmaz. Aynı dosyalar ve aynı parametreler aynı seçimi üretir. Testler yön ve ham değer/koordinat eşleşmesi, sıralama ve gap tekilleştirmesi, dış bağlantılar, eksik başlık/sınıflama/hücre, negatif/sonlu olmayan değer ve değiştirilmiş dosya hatalarını denetler. Gerçek yerel kaynak mevcutsa sabit SI5/SI4 eşlem testleri de çalışır; veri dosyası depoda paketlenmez.

## Lisans ve sonraki bilimsel çalışma

Dosyaya özgü yeniden dağıtım lisansı doğrulanmadı. Açık indirme bağlantısı ve site telif bildirimi tek başına veri dağıtım izni değildir. Kullanıcının yetkilendirdiği yerel eğitim kullanımı için veriler bu Mac mini’de kalır; JSON lisans durumu `unverified-local-only` olarak görünür. Ham dosyalar ve türetilmiş biyolojik altküme halka açık depo, yayımlanacak dağıtım veya dış servise eklenmez. Kamuya açmak ayrı izin doğrulaması gerektirir.

Bir sonraki deneysel aşama işaret/reseptör kanıtı ve gözlem modeli gerektirir. AVER uyarımından sonra AVAR yanıtı, [Randi ve ark. 2023](https://doi.org/10.1038/s41586-023-06683-4) ile araştırılabilecek bir sorudur. Şimdiki boyutsuz çıktı, makaledeki kalsiyum ΔF/F ölçümünün doğrulanmış yeniden üretimi değildir. Anatomik grafın doğru okunması ve yazılım testlerinin geçmesi, bu ayrı biyolojik doğrulamayı tamamlamaz.
