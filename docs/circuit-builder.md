# Devre kur

`/ogren/devre-kur` adresinde bir atölye sayfası. Öğrenen 2–6 hücreli (A–F) küçük bir devre kurar, tek bir hücreyi uyarır ve mevcut simülasyon motorunun her hücre için ne hesapladığını görür. Dört hazır örnek, her biri tek bir fikri öğretir. Sayfa bir **oyuncak modeldir**: kurulan devre gerçek bir devre, sonuç bir tahmin veya ölçüm değildir.

## Ne yapar

- **Hücreler ve uyaran:** hücre sayısı 2–6; uyarılan hücre, genlik (0–1), başlangıç (0–500 model ms) ve süre (10–500 model ms) seçilir. Kayıt her zaman 700 model ms, adım 1 ms, zaman sabiti τ = 30 model ms'dir (`defaultConfig` ile aynı). Başlangıçta üç hücre ve sıfır bağlantı vardır.
- **Bağlantılar:** “Bağlantı ekle” ile listeye satır eklenir; her satırda tür (uyarıcı kimyasal, baskılayıcı kimyasal, elektriksel/gap), kaynak, hedef, güç ve “Kaldır” düğmesi bulunur. En fazla 12 bağlantı eklenebilir.
- **Çalıştır:** devre geçerliyse mevcut `simulate` motoru çağrılır. Sonuçta her hücrenin eğrisi (tek 0–1 ölçekli SVG; renk, çizgi biçimi ve gösterge harfi birlikte) ile erişilebilir bir tablo görünür: tepe, tepe zamanı, 0,10 düzeyine ilk ulaşma zamanı ve 700 ms'deki değer. Tablonun altında hesaplanan eğrilerden okunan birkaç düz cümle vardır (en yüksek tepe, hiç yanıt vermeyen hücreler, uyaran bittikten sonra hâlâ 0,10 düzeyinde olan hücreler). Kalıcı etkinlik cümlesi “geri besleme döngüsü” ancak devrede uyarıcı kimyasal bağlantılardan oluşan yönlü bir döngü (kendine bağlantı dahil) varsa söylenir; döngü yoksa (ör. güçleri 2 olan uzun bir zincir) kalan etkinliğin hücrelerin birbirini sırayla izlemesindeki gecikmeden geldiği söylenir.
- **Bayat sonuç:** çalıştırdıktan sonra devre veya uyaran değişirse eski eğriler ve sayılar silinmez; “Ayar değişti… önceki çalıştırmaya ait” uyarısıyla işaretlenir. Yeniden çalıştırmak uyarıyı kaldırır.
- **Sonuç kartı:** geniş ve yüksek pencerelerde (≥ 1051 × 900 px) kart sayfayla birlikte yukarıda kalır; 6 hücreli bir sonuç pencereden uzunsa kart kendi içinde kayar (klavyeyle odaklanabilir) ve tablo ile cümleler görünür kalır. Dar pencerelerde kart akışın içindedir.
- **Sıfırla:** devreyi başlangıca (3 hücre, bağlantı yok, A'ya 0,80 genlikli 100–300 ms darbe) döndürür, sonucu ve örnek açıklamasını temizler.

## Hazır örnekler

| Örnek | Öğrettiği tek şey | Sayılarla desteklenen iddia |
| --- | --- | --- |
| İleri beslemeli zincir (A→B→C, 0,9) | Etkinlik sırayla ilerler, her adımda gecikir ve zayıflar | 0,10 düzeyine ulaşma 104 → 120 → 141 ms; tepe 0,799 > 0,714 > 0,628; uyaran sonrası hepsi söner |
| Uyarma ve baskılama (A→B, A→C uyarıcı; B→C baskılayıcı 0,6) | Aynı hedefe gelen uyarıcı ve baskılayıcı girdiler birbirini götürür | C tepesi 0,331; baskılayıcı bağlantı kaldırılınca 0,714; C'nin tepesi 198 ms'de, B etkinleşince geriler |
| Karşılıklı baskılama (A→B 0,9, A→C 0,8; B⊣C ve C⊣B 1,5) | Biraz daha güçlü girdi alan kazanır, diğeri bastırılır | B tepesi 0,697, C tepesi 0,147; karşılıklı baskı olmasaydı C 0,634; A→C 0,95 yapılınca kazanan C olur |
| Kendini sürdüren döngü (A→B→C→A, hepsi 1) | Geri beslemede kimyasal ağırlık 1'e ulaşınca etkinlik uyaran bittikten sonra da sönmez | 700 ms'de üç hücre de ≈ 0,98; 400–700 ms arasında 0,01'den az değişir; ağırlık 0,8'de 0,055'e düşer; 1,2'de 1'e dayanır |

Döngü örneğinin açıklaması, gerçek veri ve varsayımlar dersindeki ([real-data-assumptions.md](real-data-assumptions.md)) kimyasal çarpan açıklamasıyla aynıdır: 1 bir eşiktir; çarpan 1'in altındayken etkinlik uyaran bitince söner, 1'in üstünde yönlü kimyasal döngüler etkinliği kendi kendine besler. Bu burada da **biyolojik bir bulgu değil, seçilen modelin ve normalizasyonun sonucudur** ve yalnız kaydedilen 700 model ms için geçerlidir. Örnekteki her hücreye gelen kimyasal ağırlık toplamı tam 1'dir (birim testi bunu denetler). Yukarıdaki sayılar birim testlerinde sabitlenmiştir; örneğin metni onlardan farklı bir şey söyleyemez.

Her örnek yüklenince “Ne öğretiyor? / Neye bak? / Dene / Sınır” kartı açılır. Örnek sonradan düzenlenirse kart, açıklamanın yüklenen örneğe ait olduğunu söyler.

## Nasıl çalışır

Mantık `src/learning/circuitBuilder.ts` içindedir; sayfa (`CircuitBuilderPage.vue`) yalnız durumu tutar ve çizer.

1. **UI modeli → motor devresi.** Uyarıcı kimyasal bağlantı pozitif, baskılayıcı negatif kimyasal ağırlık olur (`kind: 'chemical'`). Elektriksel bağlantı motorda tek bir `kind: 'gap'` kaydıdır ve `source < target` kurallı sırayla saklanır.
2. **Gap simetrisi.** Motorda gap simetrik tek katsayıdır (`g·(komşu − hücre)`). Arayüzde bir gap'in yönü yoktur: iki ucu “Hücre 1 / Hücre 2” diye adlandırılır, “A ↔ B” olarak gösterilir ve uçların sırası hesabı değiştirmez (birim testi iki sırayı karşılaştırır). Asimetrik bir gap ifade edilemez. Aynı iki hücre arasında ikinci bir gap ve bir hücrenin kendine gap'i geçersizdir. Kimyasal bağlantılar her sıralı hücre çifti için tektir (A→B ile B→A ayrı olabilir; kendine kimyasal bağlantıya izin verilir).
3. **Doğrulama.** `validateDraft` bütün sorunları Türkçe cümlelerle ve satır numarasıyla listeler: hücre sayısı, olmayan hücre, kendine gap, yinelenen gap/kimyasal bağlantı, güç aralığı (kimyasal 0,05–2; gap 0,05–1), uyaran hedefi, genlik, başlangıç, süre, bağlantı sayısı. Sorun varsa “Çalıştır” düğmesi kapalıdır ve nedenleri hemen yanında listelenir; sorunlu satır işaretlenir.
4. **Motor hataları.** Aralıklar, motorun kendi doğrulamasının ve `dt ≤ τ/(1 + gap toplamı)` sınırının arayüzden tetiklenemeyeceği biçimde seçilmiştir (en güçlü durum: bir hücrede beş gap × 1 = 5 < 29). Yine de motor bir şey fırlatırsa `explainEngineError` ingilizce iletiyi Türkçe bir cümleye çevirir; bilinmeyen hata genel bir cümleyle karşılanır. Ham istisna metni ekrana hiç gelmez. `runDraft` asla fırlatmaz.
5. **Sunum.** Grafik, mevcut `plotBox.ts` yardımcılarıyla (eksen, iz yolu, uyaran bandı, genişlik ölçümü) çizilir; yeni çizim kodu kopyalanmamıştır. Sonuç tablosu ve cümleler aynı kayıttan gelir.

## Sınırlar

- Oyuncak model: hücre adları yalnız etikettir; güçler ve τ öğrencinin seçtiği boyutsuz varsayımlardır. Aktivite voltaj, ateşleme hızı, kalsiyum veya davranış değildir; ms modelin zaman ölçeğidir.
- Tepe zamanı bir olay başlangıcı veya iletim gecikmesi değildir; 0,10 bir raporlama düzeyidir (biyolojik eşik değil); son değer kararlı durum iddiası değildir. Kalıcı yanıt cümlesi “olabilir” der: yalnız 700 ms'lik kayıttaki duruma bakar.
- Tek uyarılan hücre, tek darbe, sabit τ, sıfır başlangıç. Hücre başına zaman sabiti, birden çok uyaran ve kayıt süresi seçilemez; bunlar kapsam dışı bırakıldı.
- Kimyasal bağlantının işareti burada öğrencinin seçimidir; gerçek bir sinapsın işareti nörotransmitterden tek başına çıkarılamaz.
- Devre kalıcı depolanmaz, dışa aktarılmaz ve paylaşılamaz; sayfa yenilenince başa döner.
- Elektriksel bağlantı doğrultucu fizyoloji veya çifte özgü işlev içermez; yalnız simetrik difüzyon kuralıdır ([bilimsel kapsam](scientific-scope.md)).

## Doğrulama

- `src/learning/circuitBuilder.test.ts` (birim): UI modelinden motor devresine eşleme ve bağımsız bir motor çağrısıyla birebir eşitlik; gap'in iki sırada aynı sonucu vermesi ve iki yönde simetrik yayılması; her doğrulama kodu ve sınır değerleri; Türkçe iletilerde ondalık noktası olmaması; gerçek motor reddinden doğan her ileti için çeviri; motor fırlatınca Türkçe sorun; en büyük devrenin (6 hücre, 12 bağlantı, en güçlü gap ve ağırlıklar) hatasız çalışması; dört örneğin geçerli olması ve yukarıdaki sayısal iddiaların her biri (tepe/ulaşma sırası, baskılamanın yarıdan fazla azaltması, kazananın A→C ile değişmesi, döngüde 400–700 ms durağanlığı, ağırlık 0,8 ve 1,2 karşılaştırmaları).
- `tests/circuit-builder.spec.ts` (tarayıcı): menüden açılış ve oyuncak model uyarısı; sıfırdan kurulum (kimyasal + gap) ve tablonun bağımsız motor çağrısıyla eşitliği, grafiğin 701 örneği; dört örneğin iddiaları; örnek düzenleme notu; bağlantı kaldırma, odak yönetimi ve bayat sonuç; geçersiz devrede Çalıştır'ın kapanması ve Türkçe nedenler; hücre sayısını azaltınca bağlantıların silinmesi; Sıfırla; yalnız klavyeyle kurma/çalıştırma/silme; 390 px'de yatay taşma olmaması, 44 px hedefler ve genişlik değişince grafiğin yeniden ölçülmesi. Masaüstü ve mobil projelerde çalışır.
- Sayfa `tests/support/page-states.ts` içinde üç durumla (boş, döngü örneği çalıştırılmış, çalıştırma sonrası düzenlenmiş ve sorun listeli) kontrast (açık/koyu, WCAG AA), ondalık virgülü ve rolsüz `aria-label` denetimlerinden geçer.
- Her aralık kaydırıcısında `aria-valuetext` vardır (ondalık virgülü). Bağlantı satırlarındaki denetimlerin adı satır başlığıyla birleşir (“Bağlantı 2 Tür”).

Son çalıştırmada birim dosyasının 51 testi ve tarayıcı dosyasının 13 senaryosu geçti (biri yalnız masaüstü). Önemli davranışlar için tek tek bozma denemesi yapıldı ve ilgili test başarısız oldu: gap'in kurallı sıraya çevrilmemesi, baskılayıcı işaretinin kaybı, yinelenen gap'in sıraya duyarlı denetlenmesi, kendine gap'in kabulü, 0,10 düzeyinin yok sayılması, motor iletisinin çevrilmemesi, Çalıştır'ın her zaman açık olması, bayat sonucun işaretlenmemesi, hücre azaltınca bağlantıların kalması, silmeden sonra odağın kaybolması ve Sıfırla'nın sonucu temizlememesi. Tam tarayıcı paketi (derlenmiş önizleme dahil), gerçek Safari/Firefox ve ekran okuyucu elle denenmedi.

Komutlar: `npx vitest run src/learning/circuitBuilder.test.ts`; `npx playwright test tests/circuit-builder.spec.ts`.
