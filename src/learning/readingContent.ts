export const readingSources = [
  { id: 'cook', title: 'Cook ve ark., 2019 — C. elegans konnektomları ve EM ağırlıklarının tanımı', url: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { id: 'data', title: 'WormWiring — yazarların düzeltilmiş bağlantı tabloları', url: 'https://wormwiring.org/pages/adjacency.html' },
  { id: 'gap', title: 'Liu ve ark., 2017 — belirli elektriksel bağlantılarda doğrultucu iletim', url: 'https://www.nature.com/articles/ncomms14818' },
  { id: 'function', title: 'Randi ve ark., 2023 — anatomiden ayrı işlevsel bağlantı ölçümleri', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
] as const

export const readingNotes = {
  anatomy: 'Burada mevcut yerel veri dosyasındaki 30 hücreyi okuyoruz. Kimyasal kayıtlar kaynak hücreden hedef hücreye yönlüdür. Elektriksel kayıtlar tek bir fiziksel çift olarak tutulur. Hücre sınıfı, kaynak listesindeki sınıflandırmadır; bu derste atanmış bir girdi/çıktı rolü değildir.',
  weight: 'Ham anatomik ağırlık, bağlantıya ait seri elektron mikroskopisi (EM) kesitlerinin toplamına dayanır; sinapsların sayısını ve boyutunu birlikte yansıtır. “12”, doğrudan 12 sinaps veya ölçülmüş işlevsel güç demek değildir. Sinaps sayısı bilinse bile bu sayı tek başına ölçülmüş etki gücü değildir. Kaynak tablosu hücresi, kaydı denetlenebilir kılar.',
  dataset: 'Cook ve arkadaşlarının konnektomları birden fazla EM serisinden birleştirilen kayıtlar ve tamamlanan tahminler içerir. Bu alt kümenin her kaydını tek bir hayvandan doğrudan ölçülmüş eksiksiz bir beyin olarak sunmuyoruz. Kullanılan sürüm, düzeltilmiş SI5 bağlantı tablosu ve SI4 hücre listesidir.',
  neighbours: 'Giriş, başka bir hücreden seçili hücreye gelen kimyasal kayıttır. Çıkış, seçili hücreden başka bir hücreye gider. Öz döngü, kaynağı ve hedefi aynı olan kimyasal kayıttır; giriş ve çıkış listelerinde ikinci kez sayılmaz. Elektriksel çift ise seçili hücre ile komşusu arasında bir kez gösterilir.',
  gap: 'Elektriksel çiftleri grafikte iki yönde gezebiliriz. Bu, iki yönde eşit fizyolojik akım ölçüldüğü anlamına gelmez. Belirli C. elegans bağlantılarında doğrultucu iletim gösterilmiştir; o bulgu bu alt kümedeki her çiftin akım yönünü belirlemez.',
  route: 'Yol bulma, seçilen bağlantı türünde en az kenarlı anatomik yolu arar. Kimyasal kenar okun yönünde, elektriksel çift iki yönde geçilir. Ham ağırlıklar sıralamaya katılmaz. Bu sonuç en güçlü, en hızlı, tek mümkün veya nedensel yol değildir.',
  direct: 'Tek kenar, doğrudan komşuluk gösterir. İki veya daha fazla kenar, aradaki hücreleri içeren dolaylı bir yoldur. Kaynak ile hedef aynıysa sıfır kenarlı yol çıkar; bu, öz döngü veya bir etkileşim kanıtı değildir.',
  routeLimit: 'Yol bulunmaması yalnız bu 30 hücrelik alt grafiğe ve seçilen moda ilişkindir. Dışarıda kalan hücreler başka yollar oluşturabilir. Arama, ziyaret edilen hücreleri izler; döngüler nedeniyle sonsuza kadar dolaşmaz ve bütün olası yolları sıralamaz.',
  cycle: 'Kimyasal döngü, yönlü bağlantıları izleyip başlangıç hücresine dönmektir. A→B→A gibi en az iki hücreli bir döngüyü, A→A öz döngüsünden ayrı gösteriyoruz. Yapısal döngü tek başına sürekli etkinlik, salınım, bellek veya geri bildirim davranışı kanıtlamaz.',
  boundary: 'Bu alt küme yalıtılmış bir okuma sınırıdır. Seçili hücrenin dışarıdaki kimyasal giriş, çıkış ve elektriksel çift kayıtları aşağıda sayılır. Bu bağlantılar biyolojide yok olmuş değildir; yalnız burada gösterilen iç ağın dışında kalırlar.',
  function: 'Yol, seçili anatomik kayıtlardan oluşur. Bir sinyalin gerçekten geçtiğini, bağlantının uyarıcı/baskılayıcı etkisini veya hayvan davranışını tek başına kanıtlamaz. İşlevsel yanıtları ölçen çalışmalar, anatominin yanında fizyolojik deneyler gerektiğini gösterir.',
  local: 'Veri, aynı uygulamanın yerel /api/local-connectome adresinden alınır. Ham dosyalar ve türetilmiş alt küme yerelde tutulur; bu ders veriyi dışarı yüklemez. Dosyaya özgü yeniden dağıtım izni doğrulanmış değildir. Dosyanın erişilebilir olması açık lisans anlamına gelmez.',
  handoff: 'Hücre seçmek veya yol aramak ana deneyi değiştirmez. Aşağıdaki düğme, açık isteğinle seçili hücreyi ana deneyde açar. Ana deney zaten gerçek veri modundaysa yalnız seçilen hücre değişir. İlk geçişte gerçek ağda bulunmayan hücre/bağlantı seçimleri uyarlanır; sayısal ayarlar, görünüm ve zaman konumu korunur. İlk geçişten önceki örnek devre ayarlarına, ana deneydeki “Sekiz hücreli örnek” düğmesiyle dönebilirsin.',
} as const

export const readingPrompts = [
  'Bir kaydın kaynağı ile hedefini yer değiştirirsen kimyasal yol hâlâ var mı?',
  'En az kenarlı yolun “en hızlı sinyal” olduğunu söylemek için hangi ek ölçümlere ihtiyacın olur?',
  'Yol bulunmayan bir hücrenin dışarıda kalan bağlantıları var mı?',
  'Ham EM ağırlığı ile seçilmiş dinamik model ağırlığını neden ayrı okuyoruz?',
] as const
