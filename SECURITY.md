# Güvenlik politikası · Security policy

*English summary is at the bottom of this page.*

## Desteklenen sürüm

Yalnız **`main` dalının en son hali** desteklenir. Etiketli sürümler (`v0.1.0` gibi) sabit birer anlık görüntüdür; düzeltmeler yeni bir sürüm olarak `main` üzerinden gelir, eski sürümlere geri taşınmaz.

## Açığı nasıl bildirirsiniz

Lütfen güvenlik açıklarını **herkese açık issue olarak açmayın**. Bunun yerine GitHub'ın özel bildirim yolunu kullanın:

1. Depo sayfasında **Security** sekmesine gidin.
2. **Report a vulnerability** düğmesine basın.
3. Ne gördüğünüzü, hangi adımlarla yeniden üretilebildiğini ve etkisini yazın.

Bildirim yalnız bakımcıya görünür. Bu yol bir nedenle çalışmıyorsa, herkese açık bir issue açıp yalnızca "özel kanaldan iletmek istediğim bir güvenlik bildirimi var" yazın; ayrıntıyı oraya yazmayın.

## Kapsam: neler önemlidir

Uygulama **statik bir web sitesidir**: sunucu tarafı kodu, hesap, çerez, veritabanı ve ödeme yoktur; tarayıcıda çalışır. Bu yüzden saldırı yüzeyi dardır, ama şunlar gerçek sorun sayılır:

- **Geliştirme ve önizleme sunucusunun `/api/local-connectome` uç noktası** (`vite.local-data.ts`). Bu uç nokta yerel, depoya konmamış veri dosyasını sunar. Yalnız döngü adresinden (loopback), aynı kaynaklı isteklere cevap vermelidir. Başka bir ana makineden ya da başka bir siteden (DNS yeniden bağlama, çapraz kaynak okuma) veri alınabilmesi veya bu uç noktanın o tek yerel dosyanın dışında bir şey sunması bir açıktır. Vite sunucusunu `--host` ile dışarıya açmak desteklenen bir kullanım değildir.
- **Servis çalışanı (`public/sw.js`).** Önbellekleme mantığının başka bir kaynağın içeriğini sunması, eski veya zehirlenmiş bir kopyayı kalıcı hale getirmesi ya da kapsam dışı isteklere müdahale etmesi.
- **Tedarik zinciri.** Bağımlılıklardaki bilinen açıklar, `package-lock.json` ile gerçekte kurulan paketlerin uyuşmaması, GitHub Actions iş akışlarında gereğinden geniş izinler veya güvenilmeyen girdinin komuta aktarılması.
- **Arayüzde betik enjeksiyonu (XSS).** Paylaşım bağlantısı, içe/dışa aktarma dosyası, sözlük veya atlas içeriği gibi bir girdinin sayfada betik olarak çalışması.

Şunlar kapsam dışıdır: modelin bilimsel olarak yanlış olması (bunun için "Bilimsel düzeltme" issue şablonunu kullanın), kendi bilgisayarınızda yerel olarak değiştirdiğiniz koda yönelik saldırılar ve toplu otomatik tarayıcı çıktıları.

## Ne kadar sürede yanıt beklenir

Bu, tek kişinin boş zamanında yürüttüğü bir eğitim projesidir; bu yüzden sözler mütevazıdır:

- Bildiriminizin alındığını **yaklaşık 7 gün içinde** yazarız.
- Geçerli bir açık için ilk değerlendirmeyi ve bir düzeltme planını **yaklaşık 30 gün içinde** paylaşmaya çalışırız.
- Düzeltme yayımlanana kadar ayrıntıyı gizli tutmanızı, yayımlandıktan sonra isterseniz adınızla teşekkür etmemizi rica ederiz.

Bu süreler garanti değildir. Ödül (bug bounty) programı **yoktur**.

---

## English summary

**Supported version:** only the latest `main`. Tagged releases are snapshots; fixes ship from `main`.

**How to report:** please do not open a public issue. Use GitHub's private vulnerability reporting: repository **Security** tab, then **Report a vulnerability**. If that is unavailable, open a public issue that says only that you have a security report, with no details.

**What counts:** the app is a static site (no backend, accounts, cookies or payments), but these are in scope: the dev/preview server's `/api/local-connectome` endpoint (must answer only same-origin loopback requests and only serve the one local file), the service worker `public/sw.js` (cache poisoning, scope), supply-chain issues (vulnerable dependencies, lockfile mismatch, over-broad Actions permissions) and script injection through share links, import/export files or content. A scientifically wrong model statement is not a security issue; use the "Bilimsel düzeltme" (scientific correction) issue form instead.

**Response times (best effort, not guarantees):** acknowledgement in about 7 days, a first assessment and plan in about 30 days. There is no bug bounty.
