# Sözlük sayfası

5 Kasım 2026.

`/ogren/sozluk` adresindeki Sözlük sayfası, noktalı altı çizili sözcüklerin açıklama kartlarında kullanılan ortak sözlüğün (`src/terms/glossary.ts`) tamamını tek yerde gösterir. Her madde için başlık, anlam, sözcük kökeni, varsa “Bu projede” notu ve kaynak bağlantıları vardır. Kartlardaki metin ile bu sayfadaki metin aynı veridir; sayfa hiçbir madde metnini yeniden yazmaz.

Maddeler `Intl.Collator('tr')` ile Türkçe alfabe sırasına dizilir (Ç, Ğ, İ, Ö, Ş, Ü kendi temel harflerinden sonra gelir). Aramada eşleşmeyen maddeler gizlenir; kalanlar aynı sırada kalır.

## Arama

“Sözcük ara” alanı, maddenin adında, başka biçimlerinde (örneğin sinaptik, connectome, gangliyon) ve anlam metninde arar. Köken ve kaynak metinlerinde aranmaz; sayfa bunu söyler. Sorgudaki her sözcüğün bulunması gerekir, sıra önemli değildir (“junction gap” de Gap junction maddesini bulur). Anlam metninde geçen sözcük de eşleşir: “nöron” yazınca adı nöron olmayan ama anlamında nöron geçen maddeler de listelenir.

Eşleştirme `src/terms/glossarySearch.ts` içindeki saf işlevlerle yapılır. Metin önce Türkçe kurallarla küçültülür (İ → i, I → ı), sonra ı ve aksanlı harfler (ş, ğ, ü, ö, ç, â, î, û) düz harfe indirilir. Bu yüzden “HERMAFRODİT”, “HERMAFRODIT” ve “hermafrodit” aynı maddeyi bulur; Türkçe harfi olmayan bir klavyeyle “noron” yazınca Nöron da bulunur. Bunun bedeli, ı ile i arasındaki ayrımın aramada korunmamasıdır; bu bilerek seçilmiş bir kolaylıktır.

Bir `role="status"` bölgesi her değişiklikten sonra sonucu duyurur (““konnektom” için 15 sözcükten 1 tanesi bulundu.”, ““zzzz” ile eşleşen sözcük bulunamadı.”). Hiç eşleşme yoksa ayrıca görünür bir boş sonuç kutusu ve aramayı temizleyip odağı alana döndüren bir düğme çıkar.

## Bağlantılar ve odak

Her madde `#term-<kimlik>` parçasıyla adreslenir (`termAnchorId`). Başlığın yanındaki “#” bağlantısı bu parçayı adrese ekler; adresi kopyalayıp paylaşmak yeter. Parçalı adres açıldığında madde ekranın üstüne kaydırılır ve odak alır; odak halkası görünür kalır. Bu iş `src/Shell.vue` içindeki `completeFocus` işlevinin mevcut parça odağı kuralına Sözlük sayfasının eklenmesiyle yapılır: sayfanın kodu yüklenirken adresin parçası değişirse son parça odaklanır. Arama bir maddeyi gizlemişken adres parçası o maddeye giderse arama temizlenir ve madde gösterilir. Bu, sayfa açıkken adres parçası değiştiğinde olduğu gibi, Sözlük başka bir sayfa açıkken bellekte kaldığı ve eski arama yerinde durduğu için uygulama içi bir bağlantıyla geri dönüldüğünde de geçerlidir (sayfa yeniden görünür olunca adres parçasına bakılır).

Kaynak bağlantıları `target="_blank" rel="noopener noreferrer"` ile açılır ve sayfanın başındaki not bunu belirtir. Bağlantı metni kaynağın adıdır; adres görünür metin olarak yazılmaz.

## Sınırlar

- Bu bir öğrenme notudur; bilimsel tanım kaynağı değildir. Anlamlar ve kökenler bağlantıdaki kaynaklardan özetlenmiştir ve bir sözcüğün Türkçeye hangi dilden, hangi yoldan girdiğini iddia etmez (bkz. `src/terms/glossary.ts` başındaki not).
- “Bu projede” notları Circuitiary modelinin sınırlarını söyler; kaynakların sözü değildir. Bu sayfa yeni bir bilimsel iddia eklemez.
- Arama anlam metni ile sınırlıdır; sıralama alfabetiktir, eşleşme yakınlığına göre değildir. Yazım yanlışlarını (örneğin harf eksiği) düzeltmez.
- Madde sayısı ve metni yalnız `glossary.ts` değiştiğinde değişir; sayfa bunu çalışma zamanında başka yerden okumaz.
- Sayfa, kartlardaki noktalı altı çizili sözcükleri kullanmaz; madde metinlerinde ikinci bir kart açılmaz.

## Erişilebilirlik

Arama alanının görünür etiketi vardır; başlık, durum bölgesi ve ipucu alana bağlanmıştır. Her madde adlandırılmış bir `article` ve `h2` başlığıdır. Düğmeler, “#” bağlantıları ve kaynak bağlantıları en az 44 px yüksekliğindedir. Renkler açık ve karanlık tema belirteçlerinden gelir; kontrast, ondalık virgül ve rolsüz `aria-label` denetimleri sayfanın dört durumunu (tüm maddeler, bağlantıyla odaklanmış madde, arama sonucu, eşleşmeyen arama) gezer. Sayfada hareket yoktur; kaydırma `prefers-reduced-motion` altında da anında olur. 390 px genişlikte yatay taşma yoktur.

## Kontroller

- `npx vitest run src/terms`: Türkçe sıralama, Türkçe harf katlama (İ/i, I/ı, ş, ğ, ü, ö, ç), başlık/takma ad/anlam eşleşmesi, çok sözcüklü sorgu, sonuç iletisi ve `#term-…` çözümleme.
- `npx playwright test tests/glossary-page.spec.ts`: her terimin tam bir kez ve alfabetik görünmesi, anlam/köken/kaynak metni ve `rel` değerleri, arama daraltma ve temizleme, Türkçe harfli sorgular, eşleşmeyen arama, doğrudan bağlantıyla kaydırma ve odak, uygulama içi bağlantı (eski bir arama o maddeyi gizlemişken de), yükleme sürerken değişen parça, “Başka biçimler” satırı, “#” bağlantısı, gizli maddeye gidiş, dokunma hedefleri ve yatay taşma (masaüstü ve mobil).
- `tests/contrast.spec.ts`, `tests/decimals.spec.ts`, `tests/accessible-names.spec.ts`: `tests/support/page-states.ts` içindeki dört Sözlük durumunu da gezer.

Önemli davranışlar için bir bozma denemesi yapıldı: Türkçe katlama, takma ad araması, alfabetik sıra, `rel="noreferrer"`, gizli maddeye gidişteki arama temizleme ve Shell parça odağı kuralı geri alındığında ilgili testler kırıldı; sonra geri yüklendi.
