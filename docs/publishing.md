# Yayınlama ve tanıtım rehberi

Bu belge Circuitiary'yi herkese açık bir GitHub deposu olarak yayınlayan kişi (depo sahibi) içindir: neyin hazır olduğunu, tek komutun ne yaptığını, elle kalan işleri, verilen kararları ve yayından sonra ilgi çekmenin gerçekçi yolunu özetler. Depodaki her şey gibi bu belge de herkese açıktır; bu yüzden içinde kişisel bilgi yoktur.

## 1. Neler hazır

| Alan | Dosya | Durum |
| --- | --- | --- |
| Lisans | `LICENSE` | MIT, "Copyright (c) 2026 Mehmet Bozkurt" |
| Giriş sayfası | `README.md`, `docs/images/` | Ekran görüntüleri ve `social-preview.png` var |
| Canlı demo | `.github/workflows/pages.yml` | Yalnız herkese açık depoda çalışır; demo sekiz hücreli devreyi ve dersleri içerir |
| Alıntı | `CITATION.cff` | CFF 1.2.0, DOI yok (bkz. bölüm 6) |
| Güvenlik | `SECURITY.md` | Özel bildirim yolu: Security sekmesi > Report a vulnerability |
| Katkı | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | Beş "ilk katkı fikri" ve etiket adları dahil |
| Şablonlar | `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` | Hata, özellik fikri, **Bilimsel düzeltme** formları |
| Otomasyon | `ci.yml`, `codeql.yml`, `dependabot.yml` | CodeQL özel depoda atlanır (`if: github.event.repository.private == false`) |
| Yayın betiği | `scripts/go-public.sh` | Bölüm 2 |

Yayından önce sizin yapacağınız iki şey:

1. Bütün değişiklikleri commit edip `main`'e push edin. Betik, çalışma ağacı temiz değilse ya da `HEAD`, `origin/main` ile aynı değilse hiçbir şey yapmaz.
2. `git log` içinde yayımlanmasını istemediğiniz bir şey olmadığına bakın. Depo açılınca **bütün geçmiş**, kapalı issue'lar ve eski Actions logları herkese görünür olur. Betik ayrıca `data/` izinin geçmişte olmadığını denetler (veri lisansı doğrulanmadı).

## 2. Tek komut: `scripts/go-public.sh`

```sh
scripts/go-public.sh --dry-run   # önce deneyin: yalnız denetler, yazacağı komutları basar
scripts/go-public.sh             # asıl çalıştırma; "yayınla" yazmanızı ister
```

Önce şunları **denetler** ve biri tutmuyorsa durur: çalışma ağacı temiz, `main` dalındasınız, `HEAD == origin/main`, geçmişte `data/` yok, `gh` depo sahibi hesapla giriş yapmış ve yönetici yetkiniz var. Sonra ne yapacağını yazar ve `yayınla` kelimesini ister (`--yes` ile atlanır).

Yaptıkları (hepsi yeniden çalıştırılabilir; zaten yapılmış olan atlanır ya da aynı değere ayarlanır; başarısız adım adıyla raporlanır):

1. Depoyu herkese açar. Başarısız olursa betik durur.
2. Açıklama, ana sayfa ve konu etiketlerini ayarlar; wiki ve projects kapalı, issues açık, birleşince dalı sil; Discussions'ı açar; `good first issue`, `scientific-correction` gibi etiketleri oluşturur.
3. Secret scanning + push protection, özel güvenlik bildirimi, Dependabot uyarıları ve otomatik güvenlik düzeltmelerini açar.
4. GitHub Pages'i "GitHub Actions" kaynağıyla açar (zaten varsa kaynağı düzeltir) ve `pages.yml` iş akışını tetikler; sonda canlı adresin açılmasını en çok yaklaşık üç dakika bekler (`--no-wait` ile atlanır).
5. `v0.1.0` sürümünü kısa Türkçe + İngilizce notlarla oluşturur (`--no-release` ile atlanır, `--release-only` ile sonradan yapılır).

Bir şey ters giderse: Settings > General > Danger Zone'dan depo yeniden özel yapılabilir. Ama bu yıldızları ve izleyicileri siler, o arada alınmış kopyalar (fork) geri alınamaz; asıl koruma yayından önceki denetimdir.

## 3. Elle kalan işler

- **Sosyal önizleme:** Settings > General > Social preview > `docs/images/social-preview.png` yükleyin. API'si yoktur; bağlantı paylaşılınca görünen kart budur.
- **Zenodo / DOI:** bölüm 6.
- **Canlı siteyi** telefonda, koyu temada ve gizli pencerede bir kez gezin; README'deki bağlantıları tıklayın.
- **Üçüncü taraf bildirimi:** Yayınlanan site `vue`, `cytoscape` ve `three` kütüphanelerini (üçü de MIT) içerir; MIT, telif bildiriminin dağıtımla birlikte korunmasını ister. Bu yükümlülük [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) dosyasıyla karşılanır; Üretim derlemesi `vite.config.ts` ayarıyla kitaplıkların lisans başlıklarını küçültülmüş dosyalarda korur; README bu dosyaya bağlanır. Canlı sitenin altbilgisinden de bağlantı vermek isteğe bağlı bir iyileştirmedir. Yalnızca geliştirme aracı olan paketler (TypeScript, Playwright: Apache-2.0; lightningcss: MPL-2.0) siteye girmez.
- **İsteğe bağlı:** `main` için dal koruması (tek bakımcı için gerekli değil), Discussions kategorilerini gözden geçirme.

## 4. Kararlar

**Lisans: MIT.** Kod ve öğretici metinlerin başkaları tarafından (öğretmenler, derslik, başka projeler) serbestçe yeniden kullanılması hedeflenir; MIT bunun en az sürtünmeli yoludur. Çalışma zamanında tarayıcıya giden her kitaplık MIT'tir; geliştirme araçları Apache-2.0 ve MPL-2.0 olabilir ama dağıtılmaz; GPL/AGPL/LGPL türü bir üretim bağımlılığı yoktur (ayrıntı: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)). Lisans **yalnız kodu ve özgün metinleri** kapsar. Depoda hiçbir veri kümesi yoktur; yerel veri dosyaları (`data/raw`, `data/local`) kendi kaynaklarının koşullarına tabidir ve lisansları doğrulanmadığı için dağıtılmaz. İlk herkese açık sürümden önce lisansı değiştirmek serbesttir; sonrasında değişiklik yalnız yeni sürümleri etkiler, önceki sürümleri almış olanların hakları geri alınamaz.

**`"private": true` kalıyor.** `package.json` içindeki bu alan yanlışlıkla `npm publish` yapılmasını engeller; uygulama bir npm paketi değil, bir sitedir. `license`, `author`, `repository`, `bugs`, `homepage`, `description` ve `keywords` alanları yine de GitHub ve araçlar için doldurulmuştur.

**Yazar e-postası.** Commit'ler, depo herkese açılmadan önce GitHub'ın gizlilik adresiyle (`<kimlik>+mehmet-bozkurt@users.noreply.github.com`) yeniden yazıldı; kişisel bir e-posta adresi geçmişte yoktur. Yeni commit'lerde de aynı adres kullanılmalıdır:

```sh
git config user.name  "Mehmet Bozkurt"
git config user.email "KIMLIK+mehmet-bozkurt@users.noreply.github.com"   # KIMLIK: https://api.github.com/users/mehmet-bozkurt adresindeki "id"
```

GitHub'da Settings > Emails altında "Keep my email addresses private" ve "Block command line pushes that expose my email" seçeneklerini de açın. Commit'ler artık `mehmet-bozkurt` hesabına bağlanır (bu yüzden katkı grafiğinde görünür).

## 5. Tanıtım planı

Depoyu açmak insanları getirmez; ilgi, doğru insanlara doğru cümleyle ulaşmaktan gelir. Sıra önemlidir.

**Duyurudan önce (aynı gün hazır olmalı):** canlı demo açılıyor, README'nin ilk ekranında ekran görüntüsü + demo bağlantısı + iki cümlelik İngilizce özet var, `v0.1.0` yayında, sosyal önizleme yüklü, en az üç `good first issue` açık (CONTRIBUTING içindeki fikirlerden), Discussions açık.

**Nerede, kime:**

| Kitle | Yer | Not |
| --- | --- | --- |
| Bilim insanları | OpenWorm topluluğu (güncel kanallar için openworm.org), r/compmathneuro, r/neuroscience, Neuromatch Academy topluluğu, Brainhack, Open Source Neuroscience listesi | Her topluluğun kendi kendini tanıtma kuralları vardır; göndermeden önce okuyun, gerekiyorsa önce moderatöre sorun |
| Yazılımcılar | Show HN, Vue topluluğu ve "Made with Vue" benzeri vitrinler, DEV/Medium yazısı | Show HN için demo kayıtsız denenebilmeli: öyle |
| Türkçe okur | Türkçe bilim yazan siteler ve bültenler, üniversitelerin nörobilim/biyoloji kulüpleri, kendi sosyal medya hesaplarınız, LinkedIn | Yayın yapan bir yazara kısa ve kişisel bir e-posta, toplu duyurudan iyi sonuç verir |
| Öğretmenler | Biyoloji/fen öğretmenlerinin WhatsApp, Telegram ve Facebook grupları, öğretmen odası arkadaşları | Önce bir derse uygun tek sayfa gösterin (örneğin Kılavuzlu deneyler); "yazdır" ve çevrimdışı özelliğini öne çıkarın |
| Kürasyon listeleri | awesome-computational-neuroscience gibi "awesome" listeleri, eğitim yazılımı listeleri | Her listenin katkı kuralı vardır; kural dışı PR'lar kapanır |

Topluluk adlarının güncelliğini göndermeden önce kendiniz doğrulayın; bu listeyi bir başlangıç noktası olarak kullanın.

**İlk gönderiyi dürüst yazmak.** Güçlü iddia yerine somut olan: ne olduğunu, ne olmadığını ve ne istediğinizi yazın. Örnek:

> Circuitiary: küçük sinir devrelerini kurarak öğrenmek için Türkçe bir deney defteri. Sekiz hücreli bir öğretici devre ve (yerel veriyle) *C. elegans* bağlantı tablosundan seçilmiş 30 nöronluk bir altgraf üzerinde bir bağlantıyı susturup ya da bir zaman sabitini değiştirip ne olduğuna bakıyorsunuz. Bu **parametreli bir öğretim modelidir**: ölçüm, davranış simülasyonu ya da beyin emülasyonu değil. Çevrimiçi demo yalnız sekiz hücreli devreyi ve dersleri içerir; gerçek veri lisansı doğrulanmadığı için depoda yok. En çok işime yarayacak şey: yanlış ya da fazla iddialı bir biyolojik cümle görürseniz "Bilimsel düzeltme" formuyla bildirmeniz. Kod MIT.
>
> *English:* A Turkish-language teaching notebook for building and probing small neuron circuits (an 8-cell toy circuit, plus a 30-neuron *C. elegans* subgraph if you import the data yourself). It is a parameterised teaching model, not a measurement or a brain emulation. Feedback I most want: scientific corrections, with sources.

Kaçının: "beyni simüle ediyor", "yapay zekâ", "devrim", ölçülmemiş doğruluk iddiaları. Eleştiri gelirse savunmaya geçmeyin; kaynağı isteyin, haklıysa düzeltin ve teşekkür edin.

**Takvim:** ilk gün depo + Show HN ya da bilim topluluğundan biri (aynı gün hepsi değil); ilk hafta öğretmen ve Türkçe okur; ikinci hafta bir kısa yazı ("Bir bağlantıyı susturunca ne olur?") ve awesome listesi PR'ları. Bir gönderi tutmazsa yenisini ancak yeni bir sürümle (somut yeni bir şeyle) yapın.

## 6. Zenodo ile DOI

DOI, projenin akademik yazılarda alıntılanabilmesini sağlar.

1. zenodo.org'da GitHub hesabınızla giriş yapın, Account > GitHub sayfasında `mehmet-bozkurt/Circuitiary` için düğmeyi açın. Özel depolar listede görünmez, yani bu adım **depo açıldıktan sonra** yapılır.
2. DOI yalnız düğme açıldıktan **sonra yayımlanan** sürümlere verilir. İki yol: (a) `v0.1.0` DOI'siz kalır, DOI sonraki sürümde (örneğin `v0.1.1`) gelir; (b) `scripts/go-public.sh --no-release` ile çalıştırın, Zenodo'yu bağlayın, sonra `scripts/go-public.sh --release-only` ile `v0.1.0`'ı yayımlayın. Varsayılan tek komut (a)'dır.
3. DOI gelince README'ye rozet, `CITATION.cff`'ye `doi:` alanı ekleyin (tüm sürümleri temsil eden "concept DOI" tercih edilir). Zenodo `CITATION.cff` bilgisini kullanabilir; kullanmazsa bir `.zenodo.json` ekleyin.
4. Uzun vadede, belgeler ve birkaç gerçek kullanıcı oturduğunda, eğitim yazılımı için hakemli bir yer (örneğin Journal of Open Source Education) düşünülebilir.

## 7. İlk issue'lar ve ilk hafta

- İlk yanıtı 48 saat içinde verin: teşekkür, bir soru ya da net bir sonraki adım. Cevap vermeye zaman yoksa bile "gördüm, hafta sonu bakacağım" yeter.
- Etiketleyin (`bug`, `scientific-correction`, `good first issue`...). Bir hafta içinde kapanmayacaksa nedenini yazın.
- **Bilimsel düzeltmeleri öne alın**: kaynağı okuyun, kaynağın ne dediğini yanıtta tekrar edin, haklıysa hemen düzeltin, değilse kibarca ve kaynakla açıklayın. "Ölçülmüş bulgu mu, model tercihi mi" ayrımını görünür kılmak çoğu tartışmayı çözer.
- İlk katkıcıya sıcak davranın: küçük bir PR'ı bile uzun bir inceleme listesiyle boğmayın; şablondaki maddelerden yalnız gerçekten eksik olanı isteyin, gerisini kendiniz tamamlayabilirsiniz.
- Veri dosyası içeren PR'ları kibarca kapatın ve `CONTRIBUTING.md` içindeki veri bölümüne yönlendirin.
- Güvenlik bildirimi gelirse herkese açık konuşmayın; Security sekmesindeki özel taslakta yanıt verin.
- İlk ay haftada bir kısa "gelen kutusu" saati ayırın; Dependabot PR'ları haftalık gelir, minör/yama grupları tek PR'dır, hızlıca birleştirilebilir.
