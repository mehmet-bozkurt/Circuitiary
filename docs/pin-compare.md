# Sabitle ve karşılaştır

Ana deney sayfasındaki grafik, aynı uyaranı üç koşulda (A referans, B bağlantı susturuldu, C zaman sabiti değişti) gösterir. **Sabitle ve karşılaştır**, buna dördüncü bir eğri ekler: o an gösterilen koşulun eğrisi grafikte kayıt olarak kalır; öğrenen bir ayarı değiştirir ve eski ile yeni eğriyi aynı eksende görür. Örnek soru: "Uyaran gücünü 0,80'den 0,50'ye indirince O1'in tepe değeri ne kadar düşer?"

## Ne yapar

- **Bu eğriyi sabitle**: gösterilen koşulun, okunan hücredeki eğrisini o anki ayarlarla birlikte kaydeder. Grafikte gri, çizgi-nokta desenli dördüncü eğri olarak çizilir; göstergede ve veri tablosunda `◆ Sabitlenen (A, O1)` adıyla yer alır.
- **Özet**: sabitlenen eğrinin ve şimdi gösterilen eğrinin koşulu, hücresi ve tepe değeri; ikisinin tepe farkı (şimdiki − sabitlenen).
- **Sabitlemeden sonra değişen ayarlar**: yalnız iki eğriden birini değiştirebilen ayarlar listelenir, örneğin `Uyaran gücü: 0,80 → 0,50`. Susturulan bağlantı, iki eğriden biri B koşuluysa; değişen hücre ve zaman sabiti, biri C koşuluysa; iki katsayı yalnız gerçek veri modunda sayılır. Görünüm seçimleri (2D/3D, seçili hücre, odak, dikey ölçek) eğriyi değiştirmediği için listelenmez.
- **Şimdiki eğriyle değiştir** ve **Sabitlemeyi kaldır**.

## Sınırlar

- Sabitlenen eğri bir kayıttır: ayarlar değişse de yeniden hesaplanmaz. Zaman adımı değişirse kendi örnek zamanlarıyla çizilir; tabloda aynı ana denk gelen örneği okunur.
- Devre modu değişince (sekiz hücreli örnek ↔ gerçek veri) kaldırılır, çünkü öbür devrede başka hücreler vardır. **Sıfırla** onu kaldırmaz; böylece varsayılan ayarlarla karşılaştırılabilir.
- Paylaşım bağlantısına, CSV/JSON dışa aktarımına ve deney kaydına girmez.
- "Yanıta göre dikey ölçek" açıkken eksen, sabitlenen eğrinin tepesini de içine alacak biçimde seçilir.
- İki eğri de aynı öğretim modelinin çıktısıdır; ölçüm değildir.

## Nerede

- `src/pinnedCurve.ts`: kayıt türü ve `changedSettings` (hangi ayar farkları listelenir).
- `src/components/PinnedComparison.vue` + `PinnedComparison.messages.ts`: düğmeler, özet, değişen ayarlar (Türkçe ve İngilizce).
- `src/App.vue`: sabitleme, dördüncü eğri, dikey ölçek.
- `src/components/ActivationChart.vue`, `ChartDataTable.vue`, `src/chartTableRows.ts` (`sampleAt`): kendi zaman adımı olan bir eğriyi çizme ve tabloya koyma.

## Doğrulama

- `npx vitest run src/pinnedCurve.test.ts`: ayar farkı kuralları ve farklı zaman adımlı eğrinin tabloda aynı andan okunması.
- `npx playwright test tests/pin-compare.spec.ts`: eğrinin ayar değişince yerinde kalması, tepe farkı, değişen ayar listesi, zaman adımı değişimi, sıfırlama, paylaşım bağlantısına girmemesi, dil değişimi.
- Sabitlenmiş durum, sayfa geneli denetimlerin (kontrast, ondalık, erişilebilir adlar, dil) gezdiği durumlar arasındadır (`tests/support/page-states.ts`).
