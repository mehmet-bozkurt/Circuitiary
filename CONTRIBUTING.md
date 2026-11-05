# Katkıda bulunmak · Contributing

*English summary is at the bottom of this page.*

Circuitiary'ye katkı vermek istediğiniz için teşekkürler. Burada her büyüklükte katkı değerlidir: bir yazım hatasının düzeltilmesi, kaynaklı bir sözlük maddesi, bir ders cümlesine itiraz ya da yeni bir önayar. Başlamadan önce [davranış kurallarını](CODE_OF_CONDUCT.md) okuyun; bilimsel çerçeve için [docs/scientific-scope.md](docs/scientific-scope.md) dosyası temel belgedir.

## Çalıştırma

Node 22.12+, 24 veya 26+ gerekir (`package.json` içindeki `engines` alanı).

```sh
npm ci --ignore-scripts   # bağımlılıkları package-lock.json'a göre kurar
npm run dev               # Vite'in yazdığı yerel adreste açılır (varsayılan 5173)
npm test                  # Vitest birim testleri
npm run typecheck         # vue-tsc
npm run build             # tür denetimi + üretim derlemesi
```

Tarayıcı senaryoları (Playwright):

```sh
npm run test:browser
npx playwright test tests/glossary-page.spec.ts   # tek bir senaryo dosyası
```

`test:browser` sistemdeki **Google Chrome**'u kullanır. Chrome başka bir yerdeyse `CIRCUITIARY_CHROME_PATH=/yol/chrome` verin. İki koşuyu aynı anda yürütecekseniz `CIRCUITIARY_DEV_PORT` ve `CIRCUITIARY_PREVIEW_PORT` ile portları ayırın.

Python içe aktarıcı testleri (yalnız `scripts/import_cook2019.py` değiştiyse gerekir):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-importer.txt
.venv/bin/python -m unittest discover -s scripts/tests -v
```

CI (`.github/workflows/ci.yml`) her pull request'te tür denetimini, `npm test`'i, derlemeyi ve Python testlerini koşar. Tarayıcı senaryoları CI'de koşmaz; değişikliğiniz arayüze dokunuyorsa kendi makinenizde koşturup sonucu PR'a yazın.

## Yerel veri ve lisansı

Gerçek *C. elegans* modu, Cook ve ark. (2019) bağlantı tablosundan türetilen 30 nöronluk bir altgrafa dayanır. **Bu veri depoda yoktur**: `data/raw/` ve `data/local/` bilerek `.gitignore`'dadır, çünkü veri dosyalarının yeniden dağıtım lisansı doğrulanmamıştır. Sonuç olarak:

- Pull request'lere **hiçbir veri dosyası eklemeyin**: ham, türetilmiş, çevrilmiş, ekran görüntüsünden ya da PDF'ten çıkarılmış tablolar da dahildir.
- Veri olmadan klonladığınızda uygulama sekiz hücreli öğretici devreyle çalışır; gerçek veri düğmesi veriyi bulamadığını söyler. Gerçek veri gerektiren bazı tarayıcı senaryoları sizde atlanır ya da koşamaz; bu beklenen bir durumdur.
- Veriyi kendiniz kaynağından indirmek ve [README](README.md) içindeki içe aktarma komutuyla yerelde üretmek isterseniz, kaynağın kendi kullanım koşullarını siz okuyup uyarsınız.

MIT lisansı (bkz. [LICENSE](LICENSE)) yalnızca kod ve özgün metinler içindir; veri kümelerini kapsamaz.

## Gözden geçirmede aranan kurallar

Her pull request şu beş şeye göre okunur:

1. **Bilimsel dürüstlük.** Biyolojiyle ilgili her ifade için bir kaynak bağlantısı verin (makale/DOI, WormAtlas, OpenWorm belgesi, ders kitabı). Model çıktısını asla ölçüm gibi sunmayın; "parametreli öğretim modeli" çerçevesi korunur. Emin olmadığınız şeyi "bilinmiyor" diye yazın. Ayrıntı: [docs/scientific-scope.md](docs/scientific-scope.md).
2. **Ondalık virgül.** Öğrenene gösterilen sayılar Türkçe biçimlenir: `src/format.ts` içindeki `decimal` ve `withComma` kullanılır; metne elle `0.5` yazılmaz. Binlik ayırıcı kullanılmaz.
3. **Erişilebilirlik.** WCAG AA kontrastı (açık ve koyu temada), doğru rol ve ad (`role`, `aria-*`), tam klavye kullanımı ve görünür odak. Yalnız renkle bilgi taşımayın; grafikler için tablo karşılığı bulunur.
4. **Her davranışın testi.** Yeni ya da değişen davranış için Vitest birim testi ekleyin; arayüze dokunuyorsa `tests/` altında bir Playwright senaryosu da ekleyin. Hata düzeltmesi, önce hatayı yakalayan bir testle gelir.
5. **Veri dosyası yok.** Yukarıdaki bölüme bakın.

Ek olarak: **küçük ve odaklı PR'lar** açın (tek konu, tek amaç), tür denetimi ve testler yerelde geçsin, gereksiz bağımlılık eklemeyin (yeni bağımlılık için önce issue açın), commit ve PR açıklamaları Türkçe ya da İngilizce olabilir. Arayüz dili şimdilik Türkçedir.

## İlk katkı fikirleri

Aşağıdakiler kodda gerçekten eksik olan, kapsamı küçük işlerdir. Bir issue açıp üstlendiğinizi yazarsanız çakışmayı önleriz.

1. **İngilizce arayüz ve çeviri altyapısı** (`good first issue`, `translation`). Metinler şu an `src/learning/*Content.ts`, `src/terms/glossary.ts` ve bileşenlerin içinde Türkçe yazılıdır. İlk adım küçük olabilir: tek bir sayfanın (örneğin Sözlük) metinlerini bir sözlük nesnesine ayırmak ve dil anahtarının nasıl durması gerektiğini bir issue'da önermek.
2. **Tür atlasına kaynaklı yeni kayıtlar** (`good first issue`, `atlas`). `src/learning/speciesAtlas.ts` şu an *C. elegans* ve *Drosophila* kayıtlarını içerir. Her yeni kayıt kaynak bağlantıları, sayım birimleri ve veri lisansı durumuyla gelir; sayıları aynı birimde olmayan kayıtlar karşılaştırılmaz.
3. **Devre kurucuya yeni önayarlar** (`good first issue`, `presets`). `src/learning/circuitBuilder.ts` içindeki `presets` listesine, öğretici bir fikri gösteren yeni bir devre ekleyin (örneğin ileri besleme baskılama ya da çift yönlü gap); ardından `circuitBuilder.test.ts`'e testini yazın.
4. **Sözlüğe kaynaklı yeni terimler** (`good first issue`, `glossary`). `src/terms/glossary.ts` içindeki maddeler anlam, sözcük kökeni ve kaynak bağlantısı taşır. Yeni terim aynı yapıyı izler; `glossary.test.ts` benzersiz kimlik, anlam, köken ve HTTPS kaynak şartını denetler.
5. **Koyu temada yazdırma denetimi** (`help wanted`, `accessibility`). Yazdırma, açık paleti zorlar ([docs/printing.md](docs/printing.md)). Koyu tema seçiliyken ve farklı tarayıcılarda (Chrome, Firefox, Safari) yazdırma önizlemesini gözden geçirip bulduklarınızı kaynak ekran görüntüsüyle bildirin ya da düzeltin.

**Kullanılan etiketler:** `good first issue`, `help wanted`, `bug`, `enhancement`, `scientific-correction` (bilimsel düzeltme), `translation`, `atlas`, `glossary`, `presets`, `accessibility`, `documentation`, `question`.

## Bir şey bildirmek

- Yanlış görünen bir biyolojik ifade için **Bilimsel düzeltme** issue şablonunu kullanın: ifade, nerede göründüğü, kaynak bağlantısı ve kaynağın ne dediği.
- Hata için **Hata bildirimi** şablonu; fikirler için **Özellik fikri** şablonu vardır.
- Güvenlik açıkları için herkese açık issue **açmayın**: [SECURITY.md](SECURITY.md).
- Sorularınız için (açıksa) Discussions sekmesini ya da bir issue'yu kullanabilirsiniz.

---

## English summary

Thanks for contributing. Any size helps: a typo, a sourced glossary entry, a challenge to a lesson sentence, a new builder preset.

**Run it:** Node 22.12+/24/26+, `npm ci --ignore-scripts`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`. Browser specs: `npm run test:browser` needs Google Chrome (or set `CIRCUITIARY_CHROME_PATH`). Importer tests: `python -m unittest discover -s scripts/tests -v` after installing `requirements-importer.txt`. CI runs typecheck, unit tests, build and the Python tests, but not the browser specs.

**Local data:** the real C. elegans data (Cook et al. 2019 subgraph) is not in the repo because its redistribution licence was never verified; `data/raw/` and `data/local/` are git-ignored. Never add data files to a pull request (raw, derived, or transcribed). Without the local data the app runs with the eight-cell teaching circuit, and a few browser specs cannot run. The MIT licence covers code and original text only.

**What reviewers enforce:** (1) scientific honesty: a source link for every biological statement, never present model output as measurement; (2) decimal comma for learner-facing numbers via `src/format.ts`; (3) accessibility: WCAG AA, roles and names, full keyboard use; (4) tests for every behaviour; (5) no data files; plus small, focused PRs.

**First contribution ideas** (labels `good first issue` / `help wanted`): English UI and an i18n layer, sourced species-atlas records, more circuit-builder presets, sourced glossary terms, a dark-theme print check. Use the "Bilimsel düzeltme" (scientific correction) issue form for biological errors, and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
