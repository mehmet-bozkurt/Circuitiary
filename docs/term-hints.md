# Sözcük anlamı ve kökeni açıklamaları

26 Ekim 2026.

Ana deney ve beş öğrenme sayfasındaki açıklama metinlerinde, sözlükteki terimin her metin parçasındaki ilk kullanımı noktalı alt çizgiyle işaretlenir. Üzerine gelmek veya klavyeyle odaklanmak kartı açar; tıklamak/dokunmak kartı açık tutar. Kartın üzerine geçilince kaynak bağlantıları kullanılabilir. Tab ile kapatma düğmesine ve kaynaklara geçilir. Escape, kapatma düğmesi veya dışarı tıklama kartı kapatır. Aynı anda tek kart açılır; sayfa/kayıt değişiminde eski açıklama kapanır.

Kartta anlam, sözcük kökeni, ilgiliyse projedeki kullanım ve kaynak bağlantıları vardır. Açıklamalar yerel içeriktir; kaynaklar yalnız kullanıcı bağlantıya basarsa yeni sekmede açılır. Sözcük kökeni, Türkçeye hangi ara dilden geçtiği doğrulanmış gibi sunulmaz. Her terimde verilen kaynaklar, anlamı ve/veya kökeni destekler.

İlk sözlük 15 madde içerir: hermafrodit, nöron, dendrit, akson, soma, sinaps/sinaptik, konnektom/connectome, gap junction, ablasyon, larva/larval, ventral, dorsal, ganglion/gangliyon, reseptör ve plastisite. Hermafrodit maddesi, mitolojik adın kökeni ile C. elegans’ın üreme biyolojisini ayrı açıklar.

Kaynaklar: Académie française, Merriam-Webster, CNRTL, WormAtlas; nöron adlandırması için Brain dergisindeki tarihçe, konnektom için Olaf Sporns’un Scholarpedia yazısı, gap junction için Journal of Cell Biology tarihçesi ve NLM MeSH. Maddeye özgü doğrudan bağlantılar `src/terms/glossary.ts` içinde ve kartlarda yer alır.

Metin bölme Türkçe büyük/küçük harfleri ve belirli ekleri tanır, görünür metni değiştirmez. Bağlantıların, seçim kutularının, form etiketlerinin, mevcut düğmelerin, kodun ve SVG çizimlerinin içine yeni etkileşimli öğe eklenmez. Açıklama kartları açık ve karanlık tema renklerini kullanır; dar ekranda pencere içinde kalır ve gerektiğinde kendi içinde kaydırılır. Sayısal motor ve kaynak anatomi değiştirilmez.

## Kontroller

- `npm test -- src/terms/glossary.test.ts`: metnin aynen korunması, Türkçe ekler, yanlış kısmi eşleşmeler, yinelenen terimler ve kaynak sözleşmesi.
- `npx playwright test tests/term-hints.spec.ts`: fareyle açma/kaynaklara geçme, klavye ve Escape, dokunma, 320 px görünümde kartın ekran sınırı, koyu tema, kayıt değişimi ve sayfa geçişleri.
- `npm run build`: tam tür kontrolü ve üretim paketi.

Sonuç: 189 birim testi ve 154 masaüstü/mobil tarayıcı senaryosu geçti; yalnız mobilde fareyle üzerine gelme ve masaüstünde mobil dokunma senaryoları kapsamlarına göre atlandı. Tam tür kontrolü ve üretim derlemesi geçti. Açık/karanlık tema ve 320 px kart görselleri `test-results/term-hints-visual/`, tüm tarayıcı sonuçları `test-results/term-hints-regression/` altında.

`term-hints-visual/` altındaki ekran görüntüleri bir kerelik alınmıştı. Açık sözlük kartının görüntüsü ve kontrast/taşma denetimi artık `tests/evidence.spec.ts` (`term-card` durumu) ve `tests/contrast.spec.ts` ile her koşuda yeniden üretilir.
