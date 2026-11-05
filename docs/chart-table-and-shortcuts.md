# Grafik veri tablosu ve klavye kısayolları

5 Kasım 2026. Ana deney sayfasına (`/`) iki erişilebilirlik özelliği eklendi: etkinlik grafiğinin tablo karşılığı ve oynatma kontrolü için klavye kısayolları. Sayısal motor, devre ve veri değişmedi.

## Grafiğin veri tablosu

Etkinlik grafiğinin altında, “Yanıta göre dikey ölçek” satırından hemen sonra kapalı bir `<details>` vardır: **Grafiğin veri tablosu**. Açıldığında gerçek bir `<table>` gösterir. Ekran okuyucu ve yalnız klavye kullanan biri, grafiğin çizdiği sayıları görmeden de okuyabilir.

- Başlık (`caption`): izlenen hücrenin adı. “İzlenen çıktı hücresi” listesi değişince başlık da değişir.
- Sütunlar (`scope="col"`): Zaman (ms), A Referans, B Bağlantı susturuldu, C Zaman sabiti değişti. Satır başlığı (`scope="row"`) zamandır.
- Satırlar: kayıtlı örneklerden her 10 ms'dekiler. Varsayılan 1 ms adımda 701 örnekten 71 satır olur. 0,0625–2 ms arasındaki bütün zaman adımları 10 ms'e tam bölündüğü için her seçimde aynı 71 satır görünür; değer, o zamandaki gerçek örnekten okunur, ara değer hesaplanmaz. Örnekleme kuralı tablonun üstündeki görünür notta yazar; not örnek sayısını da gösterir.
- Son satır (`tfoot`): her koşulun **tepe** etkinliği. Tepe, tablodaki 10 ms'lik satırlardan değil, kayıtlı örneklerin hepsinden alınır (grafiğin üstündeki tepe satırıyla aynı sayıdır); bu da notta söylenir. 10 ms'lik örnekleme tepeyi kaçırabilirdi, bu yüzden tepe ayrı tutulur.
- Sayılar ondalık virgülle, üç basamakla yazılır (`0,663`). Zaman sütunu tam sayıdır.
- Dar ekranda tablo kendi kaydırma alanında (`role="region"`, `tabindex="0"`, adı başlıktan gelir) kalır. Klavyeyle odaklanıp oklarla kaydırılabilir; sayfa yatay taşmaz. Üst başlık ve tepe satırı kaydırırken yerinde kalır; alan en fazla 340 px yüksekliktedir.

### Grafikle aynı veri

Tablo kendi hesabını yapmaz. `App.vue`, grafiğe verdiği `results.baseline.timesMs` ve `traces` değerlerini ve tepe satırının kullandığı `peaks` değerini aynen tabloya verir. Bu hesaplanmış (computed) değerler, kontroller değiştikçe grafikle birlikte güncellenir: uyaran gücü ve süresi, uyaranın girdiği hücre, susturulan bağlantı, zaman sabitleri, zaman adımı, devre modu ve izlenen hücre. `src/chartTableRows.ts` yalnız hangi örneklerin satır olacağını seçer; değeri dizinle okur. Dikey ölçek ve imleç zamanı yalnız çizimi etkiler, değerleri değiştirmez.

Sınır: tablo grafiğin tam bir eşdeğeridir, ondan fazlası değildir. Etkinlik 0–1 arasında boyutsuzdur; ölçülmüş bir nöron yanıtı, ateşleme hızı ya da davranış değildir (bkz. `scientific-scope.md`). Notta da böyle yazar.

## Klavye kısayolları

Oynatma düğmesinin altındaki kapalı `<details>` “Klavye kısayolları” üç tuşu listeler:

| Tuş | İş |
| --- | --- |
| Boşluk | Oynat / duraklat |
| ← / → | Zaman imlecini 10 ms geri / ileri al; oynatmayı duraklatır |
| Home | Başa dön (0 ms) |

Ok tuşları imleci 10 ms'lik ızgaraya oturtur: oynatma 253,7 ms'de durmuşsa → 260 ms, ← 250 ms olur. İmleç 0–700 ms dışına çıkmaz. Basılı tutulan ok tuşu imleci sürekli kaydırır; basılı tutulan Boşluk oynatmayı açıp kapatmaz. Bir tuş işlenince sayfanın kendi davranışı (ör. Boşlukla aşağı kaydırma, Home ile en üste çıkma) iptal edilir. Ekran okuyucu için görünmez bir durum alanı (`role="status"`) “Oynatılıyor.”, “Duraklatıldı.” veya “Zaman 260 ms.” der; yalnız bu tuşlarla değişim olunca güncellenir.

### Ne zaman çalışmaz

Karar `src/useExperimentShortcuts.ts` içindeki tek saf işlev `shortcutAction` ile verilir; hiçbir şey yapmamak için şunlardan biri yeterlidir:

- Deney sayfası görünür değil (`suspended`: başka bir öğrenme sayfası açık). Oynatma durumu korunur, tuşlar o sayfada hiçbir şeyi değiştirmez.
- Ctrl, Cmd (Meta), Alt veya Shift basılı. (Shift'i kasıtlı olarak dışarıda bıraktık: Shift+ok metin seçer, Shift+Boşluk geri kaydırır.)
- Başka bir işleyici tuşu zaten aldı (`defaultPrevented`) ya da bir yazı giriş yöntemi düzenleme yapıyor.
- Odak kendi tuşlarını kullanan bir öğede: `input` (kaydırıcı, onay kutusu), `select`, `textarea`, `button` (3D görünüm sekmeleri, oynat düğmesi, terim kartı tetikleyicisi dahil), bağlantı, `summary`, `dialog`; ya da rolü kaydırıcı, düğme, bağlantı, sekme, onay/radyo, liste, metin kutusu, sayı kutusu, `dialog`/`alertdialog` olan öğe; `contenteditable`; bir iletişim kutusunun (terim açıklama kartı) içi; veya açık sekme durağı olan (`tabindex` ≥ 0) öğe — 3D tuval ve tablonun kaydırma alanı gibi kendi ok tuşları olan alanlar.

Odak `tabindex="-1"` taşıyan bir başlıkta ya da sayfa gövdesindeyse (sayfa geçişinden sonra olduğu gibi) tuşlar çalışır. Tek bir `keydown` dinleyicisi `document` üzerine bileşen takılınca eklenir, bileşen kalkınca kaldırılır (`useExperimentShortcuts`, `attachShortcuts`).

## Sınırlar

- Home tuşu bu sayfada “başa dön”dür; sayfanın en üstüne kaydırmak için kullanılamaz (odak bir kontroldeyken kullanılabilir).
- Tablo dikey ölçeğe, imlece veya 2D/3D görünüme göre değişmez; bunlar değerleri değiştirmez.
- Gerçek C. elegans modunda tablo aynı kuralla çalışır, ancak yerel veri olmadan test edilemez (bkz. `real-data-assumptions.md`); bu modda da kontrast ve ondalık denetimleri tabloyu açık hâliyle ziyaret eder.

## Nasıl doğrulandı

- `npx vitest run src/useExperimentShortcuts.test.ts src/chartTableRows.test.ts`: 50 birim testi. Her tuş, her değiştirici tuş, her yok sayma kuralı (görünmez sayfa, Ctrl/Meta/Alt/Shift, `defaultPrevented`, düzenleme, tüm kontrol etiketleri ve rolleri, iletişim kutusu içi, sekme durağı), basılı Boşluk, 10 ms'lik adım ve sınırları, DOM'dan odak okuma ve dinleyicinin tam bir kez eklenip aynı işlevle kaldırılması; ayrıca 0,0625–2 ms adımlarının hepsinde aynı 71 satır ve değerin doğru örnekten okunması.
- `tests/chart-table-shortcuts.spec.ts` (masaüstü ve mobil, 10 senaryo): tablonun yapısı ve notu; her hücrenin, motorun bağımsız çağrısından gelen değere ve tepe satırının sayfadaki tepelere eşitliği; uyaran gücü, τ, hücre, susturulan bağlantı, izlenen hücre, zaman adımı ve sıfırlamanın tabloyu bağımsız hesaplanan değerlere getirmesi; dar ekranda kendi alanında yatay kaydırma ve sayfa taşması yokluğu; gövdede tuşlar; değiştirici tuşlar; kaydırıcı/seçim/onay kutusu/düğme/özet odaklıyken ve terim kartı açıkken sessizlik; başka öğrenme sayfasındayken sessizlik; kısayol listesinin yeri ve içeriği.
- Mutasyon denetimi: görünmez sayfa denetimi, düğme/sekme durağı kuralları, Ctrl, basılı Boşluk, dinleyici kaldırma, örnek dizini kayması, durağan (reaktif olmayan) satırlar ve yanlış tepe kaynağı ayrı ayrı bozuldu; ilgili birim veya tarayıcı testi her seferinde başarısız oldu ve geri alındı.
- `tests/contrast.spec.ts`, `tests/decimals.spec.ts`, `tests/accessible-names.spec.ts`: tablo ve kısayol listesi açık hâlde her ana sayfa durumunda geçti (açık ve koyu tema).
- Görsel inceleme: 1440 px ve 390 px, açık ve koyu tema; tablo ve kısayol listesi taşmıyor, odak halkası görünüyor.
