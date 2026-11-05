# Çevrimiçi demo (GitHub Pages)

Bu belge, Circuitiary'nin `https://mehmet-bozkurt.github.io/Circuitiary/` adresinde nasıl yayımlandığını, alt yolun (taban yolun) uygulamada nasıl çalıştığını, demonun neyi içermediğini ve nasıl sınandığını anlatır.

Demo bir **öğretim modelidir**: Sekiz hücreli kurgusal devre, dersler, rehberli deneyler, tür atlası, devre kurucu ve sözlük tam çalışır. Gerçek veri modu yoktur (aşağıda). Hiçbir sayfa ölçüm, doğrulanmış davranış veya beyin emülasyonu iddiasında bulunmaz; kapsam kuralı [scientific-scope.md](scientific-scope.md) belgesindedir.

## 1. Taban yol nasıl çalışır

Pages, bir proje sitesini kök dizinde değil `/<depo adı>/` altında sunar. Uygulama bu yüzden her adresi tek bir değerden türetir.

| Parça | Ne yapar |
| --- | --- |
| `vite.config.ts` | `CIRCUITIARY_BASE` ortam değişkenini okur (varsayılan `/`). Değer `/` ile başlamalı ve bitmeli; aksi hâlde derleme açık bir hata verir. Vite'ın `base` ayarı buradan gelir. |
| `src/siteBase.ts` | `import.meta.env.BASE_URL` değerini tek yerde toplar: `withBase('/ogren/sozluk')` adresi tabanın altına koyar, `appPath(pathname)` tabanı çıkarıp uygulama yolunu verir. Yerel veri uç noktasının adresi (`LOCAL_DATA_URL`) ve demo cümlesi de burada. |
| `src/Shell.vue` | Gezinme bağlantıları, sayfa eşleme (`pageFor`), bilinmeyen adres denetimi, `history.pushState` adresleri ve "ana sayfaya git" bağlantısı tabana göredir. Bilinmeyen adres bildirimi yolu tabansız yazar: `/Circuitiary/yanlis/adres` için “/yanlis/adres”. |
| `src/main.ts` | Service worker `…/Circuitiary/sw.js` adresinden ve `…/Circuitiary/` kapsamıyla kaydedilir. |
| `public/sw.js` | Kendi klasörünü (`new URL('./', self.location)`) taban kabul eder; kabuk, `assets/` ve `api` (yerel veri uç noktası, asla önbelleğe alınmaz, worker ona hiç dokunmaz) yolları ondan türer. Önbellek listesini derleme eklentisi taban önekli yazar. |
| `public/manifest.webmanifest` | Kaynak dosya köke göredir (`/`, `/icon.svg`); varsayılan tabanda olduğu gibi yayımlanır. Başka bir tabanda derleme eklentisi `id`, `start_url`, `scope` ve simge adreslerine tabanı ekler. |
| `index.html` | Vite, `<link>` ve `<script>` adreslerine tabanı kendisi ekler. |

**Varsayılan taban `/` iken hiçbir şey değişmez.** `withBase` ve `appPath` girdiyi aynen döndürür; `npm run test:browser` ve `tests/offline.spec.ts` bu yüzden eskisi gibi geçer. Taban ancak `CIRCUITIARY_BASE` verilince değişir, yalnız Pages iş akışı verir.

Uygulama içinde köke göre bir adres yazarken (`href="/ogren/..."`, `fetch('/api/...')`, `new URL('/', …)`) **kullanma**; `withBase(...)` ya da `BASE` kullan. Aksi hâlde demo o bağlantıda siteyi `mehmet-bozkurt.github.io/ogren/...` adresine götürür ve orada sayfa yoktur.

## 2. Demo kipi (`VITE_DEMO=1`)

Pages iş akışı derlemeyi `VITE_DEMO=1` ile yapar. Bu kipte yerel veri uç noktasına hiç istek gitmez; verinin olmadığı yerde şu cümle görünür:

> Bu çevrimiçi demoda gerçek veri yoktur: veri kümesinin dağıtım lisansı doğrulanmadığı için depoya konmaz. Yerel kurulumda kendi indirdiğin dosyalarla çalışır (README).

| Yer | Demoda ne olur |
| --- | --- |
| Devre deneyleri, “C. elegans · gerçek veri” düğmesi | Mod değişmez; düğmenin altında yukarıdaki cümle çıkar. Sekiz hücreli örnek çalışmaya devam eder. |
| Devreyi okumak | Veri bölümünde cümle görünür (durum `missing`), “Tekrar dene” düğmesi yoktur. Hücre seçimi ve yol araçları veri yüklenince açılır; demoda açılmaz. |
| Gerçek veri ve varsayımlar | Aynı biçimde. Varsayım deneyi ve eşik taraması veri olmadan çalıştırılamaz. |
| `?m=real` içeren paylaşım bağlantısı | Ayarlar sekiz hücreli örneğe uygulanır, mevcut bildirim satırı gerçek verinin olmadığını söyler. |

`VITE_DEMO` verilmediğinde (geliştirme, `npm run build`, `npm run preview`) mevcut iletiler, “Tekrar dene” düğmeleri ve test kancaları değişmez.

Bu iki ders sayfasının gövde metni “yerel veri dosyası” anlatır; demo cümlesi o bölümün hemen altında durur ve neden veri bulunmadığını açıklar.

## 3. Yerelde derleme ve sunma

Hızlıca bakmak için (depodaki `dist/` klasörüne dokunmadan):

```sh
CIRCUITIARY_BASE=/Circuitiary/ VITE_DEMO=1 npx vite build --outDir /tmp/circuitiary-pages --emptyOutDir
cp /tmp/circuitiary-pages/index.html /tmp/circuitiary-pages/404.html
npx vite preview --outDir /tmp/circuitiary-pages --port 4180
# http://127.0.0.1:4180/Circuitiary/
```

`vite preview` bilinmeyen adreslere 200 ile `index.html` verir; Pages ise 404 durum koduyla `404.html` verir. Pages'in gerçek davranışına en yakın deneme `npm run test:pages`'tir (bölüm 5): derlemeyi bir geçici klasöre koyar ve Pages gibi davranan küçük bir sunucudan sunar.

Başka bir alt yol denemek için `CIRCUITIARY_BASE=/baska/` yeterlidir. Özel alan adıyla kökten sunuluyorsa taban `/` kalır (değişken verilmez).

## 4. Neden `404.html`?

GitHub Pages sunucu tarafı yönlendirme yapmaz. `/Circuitiary/ogren/sozluk` gibi bir derin bağlantıda bu adreste dosya yoktur. Pages bu durumda sitenin kökündeki `404.html` dosyasını **404 durum koduyla** sunar. Uygulama kendi yönlendirmesini tarayıcıda yaptığı için `404.html`, `index.html`'in kopyasıdır: sayfa açılır, adrese bakıp doğru dersi gösterir. İş akışı bunu derlemeden sonra yapar:

```sh
cp dist/index.html dist/404.html
```

Sonuçları:

- Bir derin bağlantıya ilk girişte tarayıcı, ana belge için 404 durum kodunu geliştirici konsoluna bir satır olarak yazar. Bu Pages'in doğası; sayfa normal çalışır. Arama motorları derin bağlantıları 404 sayabilir; ana sayfa (`/Circuitiary/`) 200 döner ve demo için yeterlidir.
- Service worker bu yanıtı olduğu gibi geçirir; çevrimdışıyken önbellekteki kabuğu verir ve uygulama yolu çözer (bölüm 5'te sınanır).
- `/Circuitiary` (sonda eğik çizgi olmadan) Pages tarafından `/Circuitiary/` adresine yönlendirilir.

## 5. Sınama: `npm run test:pages`

`tests/base-path.spec.ts`, `playwright.pages.config.ts` ile çalışır. Test kendi içinde:

1. `CIRCUITIARY_BASE=/Circuitiary/ VITE_DEMO=1 vite build` komutunu **geçici bir klasöre** (`dist/` değil) çalıştırır ve `404.html`'i iş akışındaki gibi kopyalar,
2. Pages gibi davranan bir Node sunucusu başlatır (`/Circuitiary/` altı dışında hiçbir şey yok; bilinmeyen yol 404 durum koduyla `404.html`; boş port işletim sisteminden alınır),
3. Şunları doğrular: ana sayfa ve her gezinme bağlantısı tabanın altında ve sayfa yenilenmeden çalışır; sayfalardaki her `/` ile başlayan bağlantı tabanlıdır; derin bağlantılar (`ogren/sozluk`, `ogren/devre-kur`, sondaki eğik çizgili ve parçalı biçimleri) `404.html` üzerinden açılır; geri/ileri ve paylaşım bağlantısı tabanı korur; bilinmeyen adres bildirimi yolu tabansız yazar; service worker `/Circuitiary/` kapsamıyla kaydolur ve görülmüş bir sayfa çevrimdışı yeniden yüklenir; hiçbir istek `/Circuitiary/` dışına, hiçbiri `/api/` adresine gitmez; demo cümlesi doğru yerlerde görünür; konsolda hata ve yakalanmamış istisna yoktur.

Notlar:

- Testler yalnız `CIRCUITIARY_PAGES` ayarlıyken kaydolur (config bunu kendisi ayarlar). Varsayılan `npm run test:browser` dosyayı bulur ama içinden test çalıştırmaz; süresi ve sonuç sayıları değişmez.
- Chrome yolu ana yapılandırmayla aynıdır (`CIRCUITIARY_CHROME_PATH`, varsayılan macOS Google Chrome).
- Çıktı klasörü depo dışındadır (`$TMPDIR/circuitiary-pages-results`); `test-results/` kullanılmaz.

Birim düzeyinde `src/siteBase.test.ts`, `withBase` ve `appPath` işlevlerini sınar.

## 6. İş akışı ve Pages ayarları

`.github/workflows/pages.yml` (iş akışının adı **Pages**):

- `main`'e her push'ta ve elle (`workflow_dispatch`) çalışır.
- İş `if: github.event.repository.private == false` ile korunur: Pages özel depoda ücretli plan ister, bu yüzden depo özelken iş atlanır. Depo herkese açılınca ilk çalıştırmayı `scripts/go-public.sh` tetikler.
- İzinler: `contents: read`, `pages: write`, `id-token: write`. Eşzamanlılık grubu `pages`, yarım kalan yayın kesilmez.
- Adımlar: `actions/checkout@v7`, `actions/setup-node@v7` (Node 22, npm önbelleği), `npm ci --ignore-scripts`, `npm run build` (önce tür denetimi; `CIRCUITIARY_BASE=/<depo adı>/`, `VITE_DEMO=1`), `cp dist/index.html dist/404.html`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` (`dist`), `actions/deploy-pages@v5` (ortam `github-pages`).
- Taban yol depo adından gelir (`github.event.repository.name`); depo yeniden adlandırılırsa demo adresi de değişir ve ek ayar gerekmez. Depo adı `<kullanıcı>.github.io` ise site kökten sunulur: o durumda `CIRCUITIARY_BASE` satırı kaldırılmalıdır.

Yayın betiğinin (`scripts/go-public.sh`) Pages için yaptığı iki şey:

1. `repos/<depo>/pages` için **build_type = workflow** (Source: GitHub Actions) ayarı; Pages zaten varsa kaynağı aynı değere getirir.
2. `pages.yml` iş akışını `workflow_dispatch` ile `main` üzerinde tetikler ve canlı adresin açılmasını bekler.

Başka bir Pages ayarı (özel alan adı, HTTPS zorlaması, dal kaynağı) gerekmez. `github-pages` ortamı Pages açılınca GitHub tarafından kendiliğinden oluşturulur.

## 7. Bilinen sınırlar

- `npm run dev` ve `npm run preview` ile **yerel gerçek veri** yalnız varsayılan tabanla çalışır: `vite.local-data.ts` uç noktayı `/api/local-connectome` adresinde sunar ve tabanı bilmez. Taban değiştirilerek geliştirme yapılırsa gerçek veri sayfaları “bulunamadı” durumunda kalır. Pages demosunda zaten veri yoktur.
- Demo tarayıcıda yalnız tema tercihini `localStorage` içinde tutar (`src/theme.ts`); sunucuya hiçbir şey gönderilmez. Uygulama çözümleme, çerez veya üçüncü taraf istek içermez; test hiçbir isteğin `/Circuitiary/` dışına çıkmadığını doğrular.
- İlk ziyaretten sonra service worker tüm demoyu önbelleğe alır; yeni bir derlemede önbellek kimliği değiştiği için eski önbellek silinir. Ayrıntı: [offline.md](offline.md).

## 8. Karar kaydı

- **Taban yol `import.meta.env.BASE_URL` ile**, `<base>` etiketi ya da göreli (`./`) `base` ile değil: kabuk derin adreslerden de açıldığı için göreli adresler `/Circuitiary/ogren/` altında kırılırdı.
- **Manifest kaynağı köke göre kaldı**, derleme eklentisi taban ekler: mevcut `tests/offline.spec.ts` varsayılan tabanda `start_url: '/'` ve `/icon.svg` bekler; bu şekilde varsayılan derleme bayt bayt aynı kalır.
- **`404.html` iş akışında kopyalanır**, bir Vite eklentisiyle değil: yalnız Pages için gerekli, başka dağıtımlarda ek dosya üretmek istemeyiz.
- **Demo kipi derleme zamanı bayrağıdır**, çalışma zamanı algılaması değil: veri uç noktası olmayan sitede istek atıp 404 beklemek yerine hiç istek atmaz, ve çıktıda “yerel veri bulunamadı” iletisi gösterilmez.
- **`src/siteBase.ts` yeni bir dosyadır**; adres türetme ve demo cümlesi tek yerde dursun, üç ders sayfası ve ana sayfa aynı metni kopyalamasın diye.
