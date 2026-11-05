# Eşik taraması

`/ogren/gercek-veri-ve-varsayimlar` dersine eklenen “03b · Eşik taraması” bölümü (`#assumptions-sweep`). Dersin zaten anlattığı bir noktayı tek bir karşılaştırma yerine bütün bir aralıkta gösterir: kimyasal model çarpanı 1 olduğunda her hücrenin gelen model ağırlıkları toplamı 1 olur ve etkinlik uyaran bittikten sonra sönmek yerine kendini besleyebilir. Bu, **bu modelin** bir özelliğidir: ağırlıklar hedefe gelen ham toplamla normalize edilir ve bütün hücreler açık, eşzamanlı Euler adımıyla güncellenir. Ölçülmüş biyolojik bir eşik veya bulgu değildir; bölümün her sonuç metni bunu tekrarlar.

## Ne hesaplanır

“Taramayı çalıştır” düğmesi, dersin zaten karşılaştırdığı 30 hücrelik yerel altgrafla aynı AVER darbesini 15 kimyasal çarpan için art arda hesaplar: 0,2’den 1,6’ya 0,1’lik adımlarla (1 tam olarak ızgarada). Her hesapta elektriksel çarpan 0,2, τ 30 model ms, darbe `[100,300)` model ms ve genlik 0,8, kayıt 700 model ms ve adım 1 model ms’dir; okunan hücre AVAR’dır. Yalnız kimyasal çarpan değişir. Hesap mevcut `buildRealCircuit` ve `simulate` ile yapılır; yeni bir sayısal motor yoktur. Bütün tarama yaklaşık 60 ms sürer, bu yüzden düğmeye basılınca sonuç anında gelir.

Her çarpan için derste kullanılan aynı ölçütler (`outputMetrics`) kaydedilir: kayıt içindeki tepe aktivite, tepe zamanı ve 700 model ms’deki son değer. Mantık `src/learning/thresholdSweep.ts` içindedir; saf bir fonksiyondur, aynı veriyle aynı sonucu verir ve veriyi değiştirmez.

## Ne gösterilir

- **Grafik** (`ThresholdSweepPlot.vue`, ölçek hesapları `plotBox.ts`’ten): yatay eksen kimyasal çarpan, dikey eksen sabit 0–1 boyutsuz aktivite. Düz çizgi ve daire tepe aktiviteyi, kesikli çizgi ve kare son değeri gösterir (renge ek olarak biçim ve çizgi türü ayırır). Eşik 1’de kesikli dikey çizgi ve “eşik: 1,0” etiketiyle işaretlenir; eşiğin üstü hafif zeminle ayrılır. Noktalar hesaplanan çarpanlardır; aralarındaki çizgiler gözü yönlendirir, hesaplanmamış değerleri göstermez.
- **Tablo**: her çarpan için tepe, tepe zamanı ve son değer; satır başlığında eşiğin altı/eşik/üstü yazar. Grafiğin erişilebilir karşılığıdır (`<caption>`, sütun ve satır başlıkları). Küçük değerler sıfıra yuvarlanmaz; bilimsel gösterimle yazılır (örn. 3,162e−7). Bütün sayılar ondalık virgüllüdür.
- **Eşiğin iki yanı**: eşiğin altındaki ve üstündeki en yakın hesaplanmış çarpanın son değeri (yerel veride 0,9 ve 1,1).
- **Pencere notu**: tepe zamanı 700 model ms olan satırlarda tepe ile son değer aynıdır; bu satırlarda kayıt sonrası bir tepe veya kararlı durum belirlenmemiştir. Eşiğe yakın çarpanlarda yükselme 700 ms’den uzun sürebilir, bu yüzden son değer kayıt penceresine bağlıdır.

Yerel veride görülen sayılar (varsayılan ders ayarlarıyla): son değer 0,9’da yaklaşık 0,0087, 1,0’da 0,044, 1,1’de 0,23, 1,2’de 0,98; tepe aktivite 0,2’den 1,0’a kadar 0,011–0,078 arasında yavaşça artar. Bunlar bu modelin ve bu darbenin sonucudur; başka bir kayıt süresi veya darbeyle eşiğin çevresindeki eğri değişir (bkz. [gerçek veri ve varsayımlar](real-data-assumptions.md)).

## Tahmin sorusu

Dersin diğer deneylerindeki gibi isteğe bağlıdır: “Kimyasal çarpan 0,9’dan 1,1’e çıkınca AVAR’ın 700 model ms’deki son değeri nasıl değişir?” Seçenekler: çarpanla yaklaşık orantılı, çarpandan çok daha hızlı (birkaç kat), hemen hiç değişmez, emin değilim. Tahmin taramayla birlikte kaydedilir; sonradan seçimi değiştirmek önceki kaydı değiştirmez, “tahmin seçimin değişti” notu çıkar ve yeni seçim bir sonraki taramada kaydedilir. Geri bildirim canlı hesaplanır (`thresholdCrossing`): iki çarpanın son değerleri oranı çarpanların oranıyla (0,9’dan 1,1’e ≈1,2 kat) karşılaştırılır; oran bunun 1,5 katından büyükse “çok daha hızlı”, 0,005’ten az fark varsa “hemen hiç değişmez”, aksi hâlde “orantılı” sayılır. Bu iki sınır (`steepMargin`, `flatEndChange`) ders için seçilmiş raporlama sınırlarıdır; biyolojik bir ölçüt değildir.

## Başarısızlık ve veri yokluğu

- Tek bir çarpanın hesabı hata verirse o satır “hesaplanamadı” olur, grafikte × ile işaretlenir ve çizgi onun üzerinden köprü kurmaz; diğer noktalar gerçek sonuçlarla gösterilir ve uyarı bildirilir.
- Hiçbir çarpan hesaplanamazsa hata gösterilir ve önceki tarama kaydı korunur.
- Yerel veri yoksa, yüklenemiyorsa veya geçersizse bölüm dersin geri kalanı gibi davranır: metin görünür kalır, düğme devre dışıdır ve “Tarama, doğrulanmış yerel veri yüklendiğinde açılır.” yazar; örnek sonuç uydurulmaz.
- Sayfanın “Varsayım deneyini sıfırla” düğmesi taramayı ve tahmini de sıfırlar. Tarama kayıtları kalıcı depolamaya yazılmaz.

## Erişilebilirlik

Grafik `role="img"` ve sayısal aralığı söyleyen bir adla gelir; ayrıntılar tablodadır. Düğme ve seçim kutusu 44 px, klavyeyle işler; sonuç durumu `role="status"` ile bildirilir. Renkler `--theme-*` belirteçlerinden gelir; açık ve koyu temada WCAG AA kontrastı denetlenir. 390 px genişlikte yatay taşma yoktur; grafik kapsayıcı genişliğine uyar.

## Doğrulama

- `src/learning/thresholdSweep.test.ts`: ızgara (15 değer, kesin artan, 0,2–1,6, tam 1), belirlilik ve girdiyi değiştirmeme, özel ızgarada sıra, tek çarpan hatasında geri kalanın korunması, AVAR veya AVER yokken hepsinin “başarısız” sayılması, eşik komşusu seçimi ve eğim sınıflandırması; yerel veride her noktanın dersin `runAssumptionExperiment` sonucuyla aynı olması, eşiğin altında son değerin 0,01’in altında, 1,2 ve üstünde 0,9’un üstünde kalması ve tepenin çarpanla azalmaması.
- `tests/threshold-sweep.spec.ts` (masaüstü ve mobil): bağımsız motor çağrısıyla bütün 15 satırın değerleri, ondalık virgül, SVG işaret konumlarının eksenlerle ve eşik çizgisinin 1,0 ile örtüşmesi, tahminin kaydı ve değişiklik notu, klavye, zorlanmış tek çarpan hatası ve tümünün hatası, yerel veri yokluğu, sıfırlama, taşma ve 44 px hedefler.
- Mevcut sayfa denetimleri (`contrast`, `decimals`, `accessible-names`) bölümün çalışmış durumunu `tests/support/page-states.ts` üzerinden ziyaret eder.

## Sınırlar

Tarama yalnız kimyasal çarpanı ve dersin sabit koşulunu kapsar; elektriksel çarpan, τ, darbe ve kayıt süresi taranmaz. Eşiğin yeri anatomiye değil seçilen normalizasyona bağlıdır; farklı ağ sınırı veya farklı normalizasyon farklı eğriler verir. 15 nokta bir eğriyi ayrıntılı çözmez; noktalar arasındaki davranış hesaplanmadan çizgiyle yalnız yönlendirilir. Sonuçlar hayvan davranışı, kalsiyum ölçümü veya biyolojik bir eşik hakkında kanıt değildir.
