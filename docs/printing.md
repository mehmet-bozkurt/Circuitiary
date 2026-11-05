# Yazdırılabilir sayfalar

Her sayfa (devre deneyleri, dersler, okuma, varsayımlar, atlas, devre kurucu, sözlük) tarayıcının yazdır penceresinden temiz bir A4 çıktısı verir. Bu bir görünüm düzenlemesidir: modele, verilere veya sayfaların söylediklerine bir şey eklenmez ya da çıkarılmaz. Çıktı, ekranda o an görünen durumu kâğıda döker; yeniden hesaplama yapmaz.

## Çıktıda neler değişir

- **Her zaman açık renk, beyaz zemin.** Karanlık tema seçili olsa bile çıktı açık palette ve beyaz zeminde çıkar. `src/theme.css` içindeki `@media print` bloğu karanlık temanın renk değişkenlerini sıfırlar; her bileşen kendi açık yedek rengine döner. Karanlık zemin üzerine açık yazı çıkmaz.
- **Etkileşimli kabuk gizlenir.** Gezinme çubuğu, "İçeriğe geç" bağlantısı, tema seçici, sayfa içi bölüm gezinmeleri, 3B görünüm ve kamera denetimleri, oynat/zaman çubuğu, klavye kısayolu yardımı ve terim açıklama kartları çıktıya girmez.
- **Yalnız iş yapan düğmeler gizlenir.** "Deneyi çalıştır", "Sıfırla", "İndir" gibi düğmeler kâğıtta anlamsızdır. Bir durumu gösteren düğmeler (`aria-pressed`, `aria-selected`, `aria-current` taşıyanlar, örneğin seçili koşul ya da devre modu) ve metnin içindeki terim sözcükleri kalır; seçili olan düğme koyu dolgu yerine çerçeveli çizilir. Bir öğeyi bilerek gizlemek için `data-print-hide` özniteliği yeterlidir.
- **Katlanmış bölümler açılır.** `src/print.ts`, `beforeprint` olayında bütün `<details>` öğelerini açar ve her birinin önceki durumunu öğe başına saklar; `afterprint` olayında hepsini eski haline getirir. Yazdırma iptal edilse de `afterprint` gelir, ekranda hiçbir şey açık kalmaz. Arka arkaya iki `beforeprint` ilk durumu bozmaz.
- **2B bağlantı haritası.** Harita ekran boyutuna göre canvas'a çizilir; dar bir sayfa genişliğinde kırpılırdı. `beforeprint` sırasında katmanlar tek bir canvas'a kopyalanır, sayfaya sığacak şekilde ölçeklenir ve çıktıdan sonra silinir. Koyu şekil paneli, tarayıcı arka plan grafiklerini atlasa bile açık renkli yazısı kaybolmasın diye dolgusunu korur.
- **3B görünüm yazdırılmaz.** WebGL tuvali çıktı için güvenilir değildir. 3B sekmesi açıkken çıktıda "Üç boyutlu şematik görünüm yazdırılmaz…" notu çıkar; 2B haritayı yazdırmak için 2B görünümü seçilir.
- **Sayfa düzeni.** Deney sayfasının iki sütunu alt alta dizilir; tablolar ve kaydırma kutuları kaydırılmak yerine tamamen gösterilir ve sayfaya sığar; tablo satırları, kartlar, şekiller ve grafikler sayfa sonunda bölünmemeye çalışır (`break-inside: avoid`); başlıklar sonrasındaki metinden ayrılmaz. Dış bağlantılar adreslerini parantez içinde taşır, çünkü kâğıtta tıklanmaz.
- **Odak halkası ve eğri renkleri.** Bir sayfa bağlantıyla açılınca başlığı programla odaklanır; çıktıda başlığı çerçeveleyen odak halkası çizilmez. Devre kurucu karanlık temada eğrileri için açık pastel renkler kullanır; çıktıda bu eğriler açık temanın koyu renkleriyle çizilir, çünkü pastel renkler beyaz zeminde neredeyse görünmez.
- **Kenar boşlukları ve alt bilgi.** `@page` 16/14/18 mm boşluk verir. Her sayfanın alt kenar boşluğuna "Circuitiary · eğitim amaçlı model; ölçüm değildir" satırı ve "sayfa / toplam" yazılır. Satır sayfa kenar boşluğunda durduğu için içerikle çakışmaz.

## Sınırlar

- Alt bilgi, sayfa kenar kutularını (`@page { @bottom-left … }`) destekleyen tarayıcılarda çıkar (Chrome ve Edge 131 ve sonrası). Desteklemeyen tarayıcılar satırı atlar; sayfa içeriği ve kenar boşlukları yine uygulanır.
- Açık renkli kart dolguları, yazdır penceresinde "Arka plan grafikleri" kapalıysa basılmaz; çerçeveler ve metin yine okunur kalır.
- Gerçek veri modunda bağlantı tablosu yüzlerce satırdır. Katlanmış bölümler açıldığı için bu sayfa onlarca sayfa tutabilir; yazdır penceresinde sayfa aralığı seçilebilir.
- Bir bileşen koyu dolgu üzerine açık yazı kullanıyorsa, açık zeminde okunur kalması için yazdırma kuralına bir satır eklenmelidir (mevcut koyu dolgulu bağlantılar ve düğmeler çerçeveli çizilir).
- Çıktı, ekranda o an görünen durumun anlık görüntüsüdür; grafik yeniden hesaplanmaz ya da yeniden yerleştirilmez. Yerleşim şematiktir, anatomik konum değildir. Sayfaların kapsam ve sınır notları sıradan içerik olduğundan çıktıda aynen durur.

## Nasıl doğrulanır

`tests/print.spec.ts`, Playwright ile yazdırma ortamını (`emulateMedia({ media: 'print' })`) karanlık temada ve A4 genişliğinde (794 px) ile yazdırılabilir alan genişliğinde (688 px) dener:

- sekiz sayfanın her biri için gezinme, tema seçici ve atlama bağlantısı gizli; `html` ve `body` beyaz; başlık ve metin beyaz üzerinde en az 7:1 ve 4,5:1 karşıtlıkta; yatay taşma yok;
- deney sayfasında kartların açık yüzeyi ve koyu metni, iki sütunun tek sütuna inmesi ve kaydırma kutularının tam gösterilmesi;
- oynat/indir/sıfırla düğmeleri ve sekme çubuğu gizli, durum düğmeleri ve terim sözcükleri görünür;
- 3B tuval ve kamera denetimleri gizli, açıklama notu var;
- `beforeprint` ve `afterprint` olayları gönderilince `<details>` öğelerinin açılıp tek tek eski durumuna dönmesi, tekrarlanan `beforeprint`, yalnız `afterprint` ve gerçek bir `page.pdf()` çağrısı;
- 2B harita kopyasının oluşması, boyanmış olması, tekrarda yığılmaması ve `afterprint` sonrası silinmesi;
- bağlantıyla açılan sayfanın odaklı başlığında çıktıda çerçeve olmaması; karanlık temada, çalıştırılmış devre kurucunun her eğrisinin beyaz zeminde en az 3:1 karşıtlıkta çıkması;
- stil sayfasındaki `@page` kuralının boşlukları ve alt bilgi satırı;
- deney, atlas, devre kurucu ve sözlük sayfalarından geçerli, boş olmayan PDF üretimi.

Önemli davranışlar, kuralı geri alarak (renk sıfırlama, gezinmeyi gizleme, düğme gizleme, 3B gizleme, `afterprint` geri yüklemesi, kopyanın silinmesi gibi) testin başarısız olduğu görülerek denenmiştir. Ayrıca PDF çıktıları sayfa sayfa görüntü olarak incelenmiştir; sayfa sonu boşlukları ve alt bilgi gözle denetlenir, otomatik test edilmez.
