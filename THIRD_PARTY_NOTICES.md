# Üçüncü taraf bildirimleri · Third-party notices

Circuitiary'nin kendi kodu ve metinleri [MIT lisansıyla](LICENSE) yayımlanır. Bu dosya, tarayıcıya giden pakete giren üçüncü taraf kitaplıkları, geliştirme araçlarını ve projenin atıf yaptığı veri/literatür kaynaklarını sayar. Hukuki tavsiye değildir; bilgilendirme amaçlıdır.

*English summary:* Circuitiary's own code is MIT-licensed. The browser bundle contains only MIT-licensed libraries (Vue, Cytoscape.js, three.js). **No third-party dataset is included in this repository**; the C. elegans connectome files the app can read locally are not distributed here, and their redistribution licence has not been verified. Fonts are the visitor's system fonts; nothing is loaded from a CDN or font service.

Bu denetim `package-lock.json` (104 paket), kurulu paketlerin `package.json` ve `LICENSE` dosyaları ve depodaki dosyalar üzerinden yapıldı. Okunamayan hiçbir lisans tahmin edilmedi; okunamayanlar aşağıda açıkça belirtildi.

## Tarayıcı paketine giren kitaplıklar · Bundled libraries

Üretim bağımlılıkları yalnız üç pakettir (`package.json` → `dependencies`). Tarayıcıya giden kod bunlardan ve Vue'nun çalışma zamanı alt paketlerinden gelir. Hepsi MIT lisanslıdır; telif satırı her paketin kendi `LICENSE` dosyasından alınmıştır.

| Paket | Sürüm | Lisans | Telif satırı (paketin `LICENSE` dosyasından) | Ne için |
| --- | --- | --- | --- | --- |
| [vue](https://github.com/vuejs/core) | 3.5.43 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You | Arayüz çatısı |
| `@vue/runtime-dom`, `@vue/runtime-core`, `@vue/reactivity`, `@vue/shared` | 3.5.43 | MIT | Copyright (c) 2018-present, Yuxi (Evan) You | Vue'nun çalışma zamanı |
| [cytoscape](https://github.com/cytoscape/cytoscape.js) | 3.34.3 | MIT | Copyright (c) 2016-2026, The Cytoscape Consortium. | 2D devre grafiği |
| [three](https://github.com/mrdoob/three.js) | 0.186.1 | MIT | Copyright © 2010-2026 three.js authors | Şematik 3D görünüm |

MIT lisansı, telif satırının ve izin metninin kopyalarla birlikte verilmesini ister. Üretim derlemesi (`vite.config.ts`, `build.rolldownOptions.output`) kitaplıkların lisans başlıklarını (`@license` ve telif satırları) küçültülmüş dosyalarda korur; Cytoscape.js telif satırını düz bir blok yorumla yazdığı için o parçaya derleme sırasında aynı tek satırlık bildirim eklenir. Tam izin metinleri bu dosyada ve her paketin `node_modules/<paket>/LICENSE` dosyasında durur; README bu dosyaya bağlanır.

Yapı aracının küçük çalışma zamanı yardımcıları (modül yükleme gibi) pakete karışabilir; Vite de MIT lisanslıdır.

### Yalnız derleme sırasında kullanılan üretim bağımlılığı alt paketleri

`vue` paketi, tarayıcıya gönderilmeyen derleyici paketlerini de çeker: `@vue/compiler-dom`, `@vue/compiler-core`, `@vue/compiler-sfc`, `@vue/compiler-ssr`, `@vue/server-renderer` ve onların bağımlılıkları (`@babel/parser`, `@babel/types`, `@babel/helper-*`, `estree-walker`, `magic-string`, `@jridgewell/sourcemap-codec`, `postcss`, `nanoid`, `csstype`, `entities`, `source-map-js`, `picocolors`). `package-lock.json` bunların lisansını MIT, ISC (`picocolors`), BSD-2-Clause (`entities`) ve BSD-3-Clause (`source-map-js`) olarak bildirir; bu paketlerin tek tek `LICENSE` dosyaları denetimde okunmadı, yalnız bu alan değerlerine dayanılmıştır. Hiçbiri tarayıcı paketine girmez.

## Geliştirme araçları · Development tools

Dağıtılan pakete girmez, yalnız geliştirme, test ve derleme sırasında çalışır. Lisanslar `package-lock.json` ve kurulu `package.json` dosyalarındaki `license` alanından alınmıştır.

- `vite` 8.3.2: MIT
- `@vitejs/plugin-vue` 6.0.9: MIT
- `vitest` 5.0.3: MIT
- `vue-tsc` 3.3.12: MIT
- `typescript` 5.9.3: Apache-2.0
- `@playwright/test` 1.63.0: Apache-2.0
- `@types/node` 26.6.4: MIT
- `@types/three` 0.186.0: MIT
- `lightningcss` 1.33.0 ve platform paketleri (Vite'ın geçişli bağımlılığı): **MPL-2.0**. Yalnız derleme aracı olarak kullanılır; değiştirilmez, kaynağı bu depoya kopyalanmaz ve tarayıcı paketine girmez. MPL-2.0'ın dosya düzeyindeki koşulları bu projenin lisansını etkilemez.
- Python içe aktarıcısı (`scripts/import_cook2019.py`): `openpyxl` 3.1.5 (MIT, Copyright (c) 2010 openpyxl) ve `et-xmlfile` 2.0.0 (MIT; paketin küçük bir bölümü Python Software Foundation lisansıyla gelir, bkz. paketin `LICENCE.python` dosyası) (`requirements-importer.txt`). Lisans dosyaları kurulu kopyalardan okundu. Depoda yer almaz, dağıtılmaz; yalnız yerelde kurulur ve site paketine girmez.

## Lisans uyumluluğu · Licence compatibility

Tarayıcıya giden tüm bileşenler MIT lisanslıdır; projenin MIT altında yayımlanmasıyla uyumludur ve kopyaların taşıması gereken tek koşul telif satırı ile izin metninin korunmasıdır. Apache-2.0 (TypeScript, Playwright) ve MPL-2.0 (lightningcss) lisanslı araçlar yalnız geliştirme ortamında çalıştığı ve pakete girmediği için projenin lisansını etkilemez. Copyleft (GPL/AGPL/LGPL) lisanslı üretim bağımlılığı yoktur; `package-lock.json` içindeki 104 paketin lisans alanları: MIT 82, MPL-2.0 12 (hepsi `lightningcss`, yalnız geliştirme), Apache-2.0 7, BSD-2-Clause 1, BSD-3-Clause 1, ISC 1.

## Veri ve literatür · Data and literature

**Bu depoda hiçbir üçüncü taraf veri kümesi yoktur.** Ham dosyalar ve bunlardan türetilen alt küme `data/raw/` ve `data/local/` altında, `.gitignore` kapsamındadır; hiçbir sürümde (git geçmişi dahil) depoya eklenmemiştir, derlenen pakete ve çevrimiçi demoya da girmez.

### Cook 2019 / WormWiring (C. elegans bağlantı tabloları)

- Makale: Cook ve ark., “Whole-animal connectomes of both *Caenorhabditis elegans* sexes”, *Nature*, 2019. [DOI: 10.1038/s41586-019-1352-7](https://doi.org/10.1038/s41586-019-1352-7)
- Dosyalar: [WormWiring · adjacency matrices](https://wormwiring.org/pages/adjacency.html) sayfasından, SI5 (“Connectome adjacency matrices, corrected July 2020”) ve SI4 (“Cell lists”). Uygulama bunları kullanıcının kendi bilgisayarında okuyabilir; dosyaların SHA-256 özetleri `docs/real-data-next-step.md` içinde kayıtlıdır.
- **Lisans durumu: doğrulanmadı.** Bu iki dosya için yeniden dağıtım izni bulunmadığından (ne makalenin lisansı ne de sitenin telif bildirimi dosyalara otomatik aktarılmaz) dosyalar ve türetilmiş altküme depoya konmaz. Uygulama içindeki lisans etiketi `unverified-local-only` olarak görünür.
- Depodaki belge ve testlerde bu veriden yalnız kısa, kaynağı belirtilmiş olgular yer alır: SHA-256 özetleri, sayfa/matris boyutları, seçilen altgrafın toplam sayıları (30 nöron, 196 yönlü kimyasal kenar, 50 gap çifti), dışarıda kalan bağlantıların toplamları ve belgelerde (özellikle `docs/circuit-reading.md`, `docs/real-data-assumptions.md`) ile testlerde çalışılmış birkaç örnek kenar (örneğin AVER → AVAR = 33, AVAR → AVER = 3, RICL → AVAR = 18, AVAR → AVBR = 4; seri EM kesiti ağırlığı, hücre koordinatıyla). Otuz hücrenin tamamı için hücre başına veya kenar başına ağırlık tablosu, elektronik tablo veya bu veriden alınmış ekran görüntüsü depoda yoktur. Testlerdeki sentetik örnekler (ör. `X`, `A`–`C` hücreleri) uydurmadır.

### Birincil literatür (bilimsel bağlam, yalnız bağlantı olarak)

- Randi ve ark., 2023, *Nature*, C. elegans işlevsel bağlantı (sinyal yayılımı) atlası: [DOI: 10.1038/s41586-023-06683-4](https://doi.org/10.1038/s41586-023-06683-4)
- Liu ve ark., 2017, *Nature Communications*, elektriksel bağlantılarda doğrultucu iletim: [ncomms14818](https://www.nature.com/articles/ncomms14818) (aynı konu için [PMC5364397](https://pmc.ncbi.nlm.nih.gov/articles/PMC5364397/))
- Liu ve ark., 2009, C. elegans nöromüsküler bağlantılarında dereceli iletim ve salım: [PMC2705609](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705609/)
- Liu ve ark., 2018, AWA nöronunda kalsiyum aksiyon potansiyelleri: [PubMed 30220455](https://pubmed.ncbi.nlm.nih.gov/30220455/)

### Türler atlası kayıtları

Atlas sayfası yalnız meta veri (tür, yaşam evresi, kapsam, sayı birimi, sürüm) ve birincil kaynak bağlantıları verir; aşağıdaki veri kümelerinden hiçbirini indirmez, içe aktarmaz veya depoya koymaz. Lisans etiketleri uygulamanın atlas kaydında, kontrol tarihi 2026-10-03 ile tutulur ve o kayıt esas alınır.

- Winding ve ark., 2023, birinci evre larva beyni (*Science*): [DOI: 10.1126/science.add9330](https://doi.org/10.1126/science.add9330); [Virtual Fly Brain · L1 EM CATMAID](https://l1em.catmaid.virtualflybrain.org/). Veri dosyasına özgü lisans doğrulanmadı.
- Scheffer ve ark., 2020, Hemibrain (*eLife*): [DOI: 10.7554/eLife.57443](https://doi.org/10.7554/eLife.57443); [Janelia FlyEM · Hemibrain](https://www.janelia.org/project-team/flyem/hemibrain); [neuPrint](https://neuprint.janelia.org/). Atlas kaydına göre veri lisansı CC BY 4.0.
- Dorkenwald ve ark., 2024, FlyWire erişkin dişi beyni (*Nature*): [DOI: 10.1038/s41586-024-07558-y](https://doi.org/10.1038/s41586-024-07558-y); [v783.0 bağlantı arşivi](https://zenodo.org/records/10676866) (Zenodo meta verisi CC BY 4.0; FlyWire'ın güncel genel yönergesi CC BY-NC 4.0 der, bkz. [FlyWire yönergeleri](https://home.flywire.ai/guidelines)); [FlyWire Codex](https://codex.flywire.ai/).
- Berg ve ark., 2026, erişkin erkek merkezi sinir sistemi (*Cell*): [DOI: 10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015); [Janelia · Male CNS](https://male-cns.janelia.org/download/) ve [sürüm notları](https://male-cns.janelia.org/release/). Atlas kaydına göre veri lisansı CC BY 4.0.
- Dişi beyin + VNC için ek bağlam: [Nature, s41586-026-10735-w](https://www.nature.com/articles/s41586-026-10735-w) (yalnız belgede anılır, atlas kaydı yoktur).

## Sözlük ve öğretim kaynakları · Glossary and teaching sources

Ders metinleri ve sözlük maddeleri projenin kendi sözleridir; kaynaklardan **yalnız özetlenir (parafraz)**, kaynak metni alıntılanmaz (bkz. `src/terms/glossary.ts` başındaki not). Kaynaklara **yalnız bağlantı** verilir; içerikleri depoya kopyalanmaz ve kaynaklar kullanıcı bağlantıya basmadıkça açılmaz (bağlantılar yeni sekmede, `noopener noreferrer` ile açılır).

Sözlük kaynakları: [Académie française](https://www.dictionnaire-academie.fr/), [Merriam-Webster](https://www.merriam-webster.com/), [CNRTL](https://www.cnrtl.fr/), [WormAtlas](https://www.wormatlas.org/hermaphrodite/reproductive/mainframe.htm), [Brain · “Etymology and the neuron(e)”](https://academic.oup.com/brain/article/143/1/374/5679563), Olaf Sporns, [Scholarpedia · Connectome](https://www.scholarpedia.org/article/Connectome), [Journal of Cell Biology · gap junction tarihçesi](https://pmc.ncbi.nlm.nih.gov/articles/PMC2254793/), [NLM MeSH · Gap Junctions](https://www.ncbi.nlm.nih.gov/mesh/D017629).

Ders kaynakları: [NIH/NCI SEER eğitimi · sinir dokusu](https://training.seer.cancer.gov/anatomy/nervous/tissue.html); [Rice University / OpenStax · Anatomy and Physiology 2e, “Nervous Tissue”](https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue); Purves ve ark. ile Alberts ve ark.'nın NCBI Bookshelf bölümleri ([NBK10931](https://www.ncbi.nlm.nih.gov/books/NBK10931/), [NBK11107](https://www.ncbi.nlm.nih.gov/books/NBK11107/), [NBK26910](https://www.ncbi.nlm.nih.gov/books/NBK26910/), [NBK11009](https://www.ncbi.nlm.nih.gov/books/NBK11009/), [NBK11099](https://www.ncbi.nlm.nih.gov/books/NBK11099/), [NBK11117](https://www.ncbi.nlm.nih.gov/books/NBK11117/), [NBK10968](https://www.ncbi.nlm.nih.gov/books/NBK10968/), [NBK11164](https://www.ncbi.nlm.nih.gov/books/NBK11164/)).

## Yazı tipleri ve görseller · Fonts and graphics

- **Yazı tipi:** Hiçbir yazı tipi dosyası paketlenmez ve hiçbiri çevrimiçi bir hizmetten yüklenmez (`@font-face` yok, Google Fonts veya başka bir CDN yok). Arayüz ziyaretçinin sistem yazı tiplerini kullanır: gövde için `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, başlıklar için `Georgia, "Times New Roman", serif`, sayılar için `ui-monospace, SFMono-Regular, Menlo, monospace` (`src/style.css`). Bu yüzden yazı tipi lisansı yükümlülüğü doğmaz; görünüm işletim sistemine göre değişir.
- **Simgeler ve çizimler:** `public/favicon.svg` ve `public/icon.svg` yalnız dikdörtgen, yol ve daire ilkellerinden oluşan basit geometrik çizimlerdir; bilinen bir üçüncü taraf simge setinden veya logodan alınmamıştır ve proje için hazırlanmış kabul edilir. Arayüzdeki devre çizimleri ve şemalar SVG olarak projede çizilmiştir; harici simge kitaplığı (Font Awesome, Material Icons vb.) kullanılmaz.
- **Ekran görüntüleri ve sosyal önizleme** (`docs/images/`): Projenin kendi arayüzünden alınmıştır ve yalnız sentetik sekiz hücreli devreyi, ders, sözlük ve atlas sayfalarını gösterir; gerçek veri görünümü içermez.
- **Dış istek yok:** Uygulama açıldığında üçüncü taraf bir sunucuya istek yapmaz (izleyici, analitik, CDN, iframe, WebSocket yok); dış bağlantılar yalnız kullanıcı tıklarsa açılır. Tarayıcıya yalnız tema tercihi (`localStorage`) ve çevrimdışı kullanım için uygulama dosyalarının önbelleği (servis çalışanı) yazılır; kişisel veri toplanmaz.
