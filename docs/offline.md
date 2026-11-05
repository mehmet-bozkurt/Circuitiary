# Çevrimdışı kullanım

Circuitiary bir tarayıcıda internet varken bir kez açıldıktan sonra, aynı tarayıcıda ağ yokken de açılır. Amaç, bağlantısı güvenilmez bir sınıfta öğrenme sayfalarının ve sekiz hücreli öğretici devrenin çalışmaya devam etmesidir. Bu özellik yalnız **uygulama dosyalarını** saklar. Hiçbir veri, ölçüm veya biyolojik içerik eklemez; bütün hesaplar zaten tarayıcıda yapılır.

## Ne yapar

- `public/sw.js` küçük bir service worker'dır. İlk açılışta uygulamanın bütün dosyalarını (sayfa kabuğu, betikler, stiller, tembel yüklenen ders sayfaları, simge, manifest) tarayıcı önbelleğine alır. Yaklaşık 1,8 MB sıkıştırılmamış dosya; ders sayfalarını daha önce açmış olmak gerekmez.
- **Sayfa açılışları** önce ağı dener, böylece yeni sürüm bağlantı olur olmaz görünür. Ağ yoksa, sunucu 5xx dönerse veya 4 saniyede yanıt gelmezse önbellekteki kabuk gösterilir; uygulama adresten hangi dersin açılacağını kendisi bulur (`/ogren/...` yollarının hepsi).
- **`/assets/` altındaki içerik adlı dosyalar** önce önbellekten gelir; adları içeriklerinin özetini taşıdığı için aynı ad aynı dosyadır. Sunucu bulunamayan bir dosya için uygulama sayfasını (HTML) döndürürse bu yanıt asla saklanmaz.
- Simge ve manifest gibi birkaç adsız dosya önce ağdan, ağ yoksa önbellekten gelir.
- `public/manifest.webmanifest` ve `public/icon.svg`, tarayıcı destekliyorsa uygulamanın ana ekrana veya masaüstüne "yüklenmesine" izin verir (`standalone`, Türkçe, açık tema renkleri `index.html` ile aynı).

## Gerçek veri uç noktası asla önbelleğe alınmaz

`/api/local-connectome` dosyaya özgü yeniden dağıtım izni doğrulanmamış yerel veriyi sunar (bkz. `docs/real-data-assumptions.md`). Service worker `/api/` altındaki hiçbir isteğe karışmaz: istek her zaman ağa gider, yanıt hiçbir önbelleğe yazılmaz ve çevrimdışıyken uç nokta bir sayfa gibi açılmaya çalışılsa bile uygulama kabuğu onun yerine konmaz. Çevrimdışıyken ya da yerel sunucu kapalıyken gerçek veri modu bu yüzden bugünkü gibi "Yerel gerçek veri yüklenemedi" uyarısını gösterir; sekiz hücreli deney çalışır. Yalnızca GET, aynı kaynak (origin) ve `Range` içermeyen istekler işlenir; geri kalan her şey tarayıcının olağan yolundan geçer.

## Sürümler nasıl değişir

Derleme sırasında `vite.config.ts` içindeki küçük `circuitiary-offline-cache` eklentisi, çıktıdaki `sw.js` dosyasına iki şey yazar: üretilen dosyaların listesi ve bu dosyaların (ile `sw.js` kaynağının) içeriğinden türetilen 12 karakterlik bir derleme kimliği. Önbellek adı `circuitiary-<kimlik>` olur. Dosyalardan biri bile değişirse kimlik değişir, tarayıcı yeni worker'ı kurar, bütün dosyaları indirir ve yalnızca hepsi başarılıysa devreye girer (`skipWaiting` + `clients.claim`). Aktifleşirken `circuitiary-` ile başlayan eski önbellekler silinir; başka adlı önbelleklere dokunulmaz. Kurulum yarıda kalırsa yarım önbellek silinir, çalışan eski sürüm ve önbelleği korunur.

Kayıt `src/main.ts` içindedir ve yalnızca üretim derlemesinde (`import.meta.env.PROD`) ve service worker destekleyen tarayıcıda yapılır. Geliştirme sunucusu hiçbir zaman worker kaydetmez. Kayıt başarısız olursa (gizli pencere, engelli depolama) hata sessizce yutulur ve çevrimiçi uygulama aynen çalışır.

## Sınırlar

- **Güvenli bağlam gerekir.** Service worker yalnız HTTPS veya `localhost`/`127.0.0.1` üzerinde çalışır. Sınıf ağındaki düz `http://192.168...` adresinde özellik kendiliğinden devre dışı kalır, uygulama olduğu gibi çalışır.
- **İlk açılış çevrimiçi olmalıdır** ve her yeni sürümü almak için bir kez daha çevrimiçi açmak gerekir. Açık bir sekme, yeni sürüm yayımlandığında eski dosyaları aramaya devam edebilir; ders sayfası yüklenemezse mevcut uyarı sayfayı yenilemeyi önerir.
- Önbellek tarayıcıya ve adrese özeldir; tarayıcı depolamayı temizlerse veya yer açmak için siler ise yeniden çevrimiçi açmak gerekir. Aygıtlar arasında eşitleme veya arka planda güncelleme yoktur.
- Uygulama sitenin kökünde (`/`) sunulur; başka bir alt yola yerleştirme desteklenmez.
- Çevrimdışı mod bir doğruluk iddiası taşımaz: aynı derleme, aynı sayılar. Tema tercihi `localStorage`'da kalır; bu özellik onu değiştirmez.

## Nasıl doğrulanır

`tests/offline.spec.ts` yalnızca `production-desktop` projesinde (üretim önizlemesi) çalışır; `desktop` ve `mobile` geliştirme projeleri onu atlar. Her test, gerçek derlemeyi küçük bir ara sunucu üzerinden taze bir `127.0.0.1` portunda sunar. Böylece ağ gerçekten kesilebilir (bağlantı düşürme, 503, yanıt vermeme), derleme kimliği değiştirilebilir ve `/api/local-connectome` yanıtı yapay bir metinle verilir (yerel veri hiç okunmaz). Ara sunucu, `vite preview` gibi her yanıta `Vary: Origin` ekler; tarayıcı sayfanın kendi betik ve stil isteklerine `Origin` başlığı koyduğu için önbellek aramasında `ignoreVary` kullanılmazsa çevrimdışı hiçbir derleme dosyası bulunamazdı.

| Test | Neyi kanıtlar |
| --- | --- |
| Bir kez çevrimiçi açıldıktan sonra her sayfa çevrimdışı açılır | Yenileme, doğrudan adres ve hiç açılmamış tembel ders sayfası (atlas) çevrimdışı çalışır |
| Kabuk ağ öncelikli, içerik adlı dosyalar önbellekten | Çevrimiçi yenilemede `/` ağa gider, `/assets/` ağa gitmez |
| Sunucu hatası ve yanıt vermeyen ağ | 503 ve takılan ağda önbellekteki kabuk görünür |
| Yerel veri uç noktası | Çevrimiçi ağdan gelir, önbelleklerde `/api` yoktur; çevrimdışı `fetch` ağ hatasıyla düşer, sayfa olarak da açılmaz, uygulama "yüklenemedi" uyarısını gösterir |
| Bulunamayan dosyaya uygulama sayfası dönerse | HTML yanıtı `/assets/` altında saklanmaz |
| Yeni derleme kimliği | Eski önbellek silinir, yenisi tam dolar, başka adlı önbellek kalır, yeni sürüm çevrimdışı açılır |
| Eksik dosyalı yeni derleme | Kurulum düşer, yarım önbellek silinir, çalışan önbellek kalır |
| Derleme çıktısı | `sw.js` içindeki yer tutucular dolu, liste gerçek dosyaları sayar, manifest alanları ve tema rengi `index.html` ile uyumlu, simge SVG |

Testler bir kez bozularak sınanmıştır (5xx geri dönüşü, zaman aşımı, `/assets/` önbellek önceliği, `/api/` kuralı, HTML koruması, eski önbellek silme, yabancı önbelleği koruma, yarım kurulum temizliği, kabuk geri dönüşü, eklentinin dosya listesi): her bozma ilgili testi kırmıştır. `playwright.config.ts` bütün projelerde `serviceWorkers: 'block'` kullanır; yalnız bu dosya kendisi için `allow` ister, bu yüzden başka hiçbir test worker'dan etkilenmez. Geliştirme sunucusunda kayıt olmadığı elle denendi (kayıt sayısı 0).
