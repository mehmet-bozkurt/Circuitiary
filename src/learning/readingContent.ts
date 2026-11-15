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
  neighbors: 'Giriş, başka bir hücreden seçili hücreye gelen kimyasal kayıttır. Çıkış, seçili hücreden başka bir hücreye gider. Öz döngü, kaynağı ve hedefi aynı olan kimyasal kayıttır; giriş ve çıkış listelerinde ikinci kez sayılmaz. Elektriksel çift ise seçili hücre ile komşusu arasında bir kez gösterilir.',
  gap: 'Elektriksel çiftleri grafikte iki yönde gezebiliriz. Bu, iki yönde eşit fizyolojik akım ölçüldüğü anlamına gelmez. Belirli C. elegans bağlantılarında doğrultucu iletim gösterilmiştir; o bulgu bu alt kümedeki her çiftin akım yönünü belirlemez.',
  route: 'Yol bulma, seçilen bağlantı türünde en az kenarlı anatomik yolu arar. Kimyasal kenar okun yönünde, elektriksel çift iki yönde geçilir. Ham ağırlıklar sıralamaya katılmaz. Bu sonuç en güçlü, en hızlı, tek mümkün veya nedensel yol değildir.',
  direct: 'Tek kenar, doğrudan komşuluk gösterir. İki veya daha fazla kenar, aradaki hücreleri içeren dolaylı bir yoldur. Kaynak ile hedef aynıysa sıfır kenarlı yol çıkar; bu, öz döngü veya bir etkileşim kanıtı değildir.',
  routeLimit: 'Yol bulunmaması yalnız bu 30 hücrelik alt grafiğe ve seçilen moda ilişkindir. Dışarıda kalan hücreler başka yollar oluşturabilir. Arama, ziyaret edilen hücreleri izler; döngüler nedeniyle sonsuza kadar dolaşmaz ve bütün olası yolları sıralamaz.',
  cycle: 'Kimyasal döngü, yönlü bağlantıları izleyip başlangıç hücresine dönmektir. A→B→A gibi en az iki hücreli bir döngüyü, A→A öz döngüsünden ayrı gösteriyoruz. Yapısal döngü tek başına sürekli etkinlik, salınım, bellek veya geri bildirim davranışı kanıtlamaz.',
  boundary: 'Bu alt küme yalıtılmış bir okuma sınırıdır. Seçili hücrenin dışarıdaki kimyasal giriş, çıkış ve elektriksel çift kayıtları aşağıda sayılır. Bu bağlantılar biyolojide yok olmuş değildir; yalnız burada gösterilen iç ağın dışında kalırlar.',
  function: 'Yol, seçili anatomik kayıtlardan oluşur. Bir sinyalin gerçekten geçtiğini, bağlantının uyarıcı/baskılayıcı etkisini veya hayvan davranışını tek başına kanıtlamaz. İşlevsel yanıtları ölçen çalışmalar, anatominin yanında fizyolojik deneyler gerektiğini gösterir.',
  local: 'Veri, aynı uygulamanın yerel /api/local-connectome adresinden alınır. Ham dosyalar ve türetilmiş alt küme yerelde tutulur; bu ders veriyi dışarı yüklemez. Dosyaya özgü yeniden dağıtım izni doğrulanmış değildir. Dosyanın erişilebilir olması açık lisans anlamına gelmez.',
  handoff: 'Hücre seçmek veya yol aramak ana deneyi değiştirmez. Aşağıdaki düğme, açık isteğinle seçili hücreyi ana deneyde açar. Ana deney zaten gerçek veri modundaysa yalnız seçilen hücre değişir. İlk geçişte gerçek ağda bulunmayan hücre/bağlantı seçimleri uyarlanır; sayısal ayarlar, görünüm ve zaman konumu korunur; yalnız dikey ölçek, gerçek veri modunun varsayılanı olan yanıta göre ölçeğe geçer. İlk geçişten önceki örnek devre ayarlarına, ana deneydeki “Sekiz hücreli örnek” düğmesiyle dönebilirsin.',
} as const

export const readingPrompts = [
  'Bir kaydın kaynağı ile hedefini yer değiştirirsen kimyasal yol hâlâ var mı?',
  'En az kenarlı yolun “en hızlı sinyal” olduğunu söylemek için hangi ek ölçümlere ihtiyacın olur?',
  'Yol bulunmayan bir hücrenin dışarıda kalan bağlantıları var mı?',
  'Ham EM ağırlığı ile seçilmiş dinamik model ağırlığını neden ayrı okuyoruz?',
] as const

// English twins (docs/i18n.md, rule 3): the same ids, keys, order and lengths as the Turkish constants above.
// The Turkish constants are literal (`as const`), so a twin's type keeps their shape (keys, tuple length, ids, addresses) and frees only the text.
type Texts<T> = { readonly [K in keyof T]: string }
type Sources<T> = { readonly [K in keyof T]: T[K] extends { readonly id: infer Id; readonly url: infer Url } ? { readonly id: Id; readonly title: string; readonly url: Url } : never }

export const readingSourcesEn: Sources<typeof readingSources> = [
  { id: 'cook', title: 'Cook et al., 2019 — C. elegans connectomes and the definition of the EM weights', url: 'https://doi.org/10.1038/s41586-019-1352-7' },
  { id: 'data', title: 'WormWiring — the authors’ corrected connectivity tables', url: 'https://wormwiring.org/pages/adjacency.html' },
  { id: 'gap', title: 'Liu et al., 2017 — rectifying conduction at specific electrical connections', url: 'https://www.nature.com/articles/ncomms14818' },
  { id: 'function', title: 'Randi et al., 2023 — measurements of functional connectivity, separate from anatomy', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
]

export const readingNotesEn: Texts<typeof readingNotes> = {
  anatomy: 'Here we read the 30 cells in the current local data file. Chemical records are directed from the source cell to the target cell. Electrical records are kept as a single physical pair. The cell class is the classification in the source list; it is not an input/output role assigned in this lesson.',
  weight: 'The raw anatomical weight is based on the total of the serial electron microscopy (EM) sections that belong to the connection; it reflects the number and the size of the synapses together. “12” does not directly mean 12 synapses or a measured functional strength. Even if the number of synapses is known, that number alone is not a measured strength of effect. The source table cell makes the record checkable.',
  dataset: 'The connectomes of Cook and colleagues contain records combined from more than one EM series and filled-in estimates. We do not present every record of this subset as a complete brain measured directly from a single animal. The version used is the corrected SI5 connectivity table and the SI4 cell list.',
  neighbors: 'An input is a chemical record that comes from another cell to the selected cell. An output goes from the selected cell to another cell. A self-loop is a chemical record whose source and target are the same; it is not counted a second time in the input and output lists. An electrical pair is shown once, between the selected cell and its neighbor.',
  gap: 'We can walk electrical pairs in both directions in the graph. This does not mean that equal physiological current was measured in both directions. Rectifying conduction has been shown at specific C. elegans connections; that finding does not determine the direction of current for every pair in this subset.',
  route: 'Path finding looks for the anatomical path with the fewest edges in the selected connection type. A chemical edge is crossed in the direction of the arrow, an electrical pair in both directions. Raw weights play no part in the ranking. This result is not the strongest, the fastest, the only possible or a causal path.',
  direct: 'A single edge shows direct adjacency. Two or more edges make an indirect path that includes the cells in between. If the source and the target are the same, the result is a path with zero edges; this is not a self-loop or evidence of an interaction.',
  routeLimit: 'Finding no path concerns only this 30-cell subgraph and the selected mode. Cells left outside may form other paths. The search keeps track of the visited cells; it does not wander forever because of cycles, and it does not list all possible paths.',
  cycle: 'A chemical cycle means following directed connections and returning to the starting cell. We show a cycle of at least two cells, such as A→B→A, separately from an A→A self-loop. A structural cycle alone does not prove sustained activity, oscillation, memory or feedback behavior.',
  boundary: 'This subset is an isolated reading boundary. The selected cell’s outside chemical input, output and electrical pair records are counted below. These connections have not disappeared in biology; they only fall outside the inner network shown here.',
  function: 'A path is made of selected anatomical records. On its own it does not prove that a signal really passes, that a connection has an excitatory/inhibitory effect, or an animal behavior. Studies that measure functional responses show that physiological experiments are needed alongside anatomy.',
  local: 'The data is fetched from the local /api/local-connectome address of the same application. The raw files and the derived subset are kept locally; this lesson does not upload the data anywhere. File-specific redistribution permission has not been verified. A file being accessible does not mean it has an open license.',
  handoff: 'Choosing a cell or searching for a path does not change the main experiment. The button below opens the selected cell in the main experiment, at your explicit request. If the main experiment is already in real-data mode, only the selected cell changes. On the first switch, cell/connection selections that do not exist in the real network are adapted; numeric settings, the view and the time position are kept; only the vertical scale switches to the scale fitted to the response, the default of real-data mode. You can return to the example-circuit settings from before the first switch with the “Eight-cell example” button in the main experiment.',
}

export const readingPromptsEn: Texts<typeof readingPrompts> = [
  'If you swap the source and the target of a record, is the chemical path still there?',
  'What additional measurements would you need to say that the path with the fewest edges is the “fastest signal”?',
  'Does a cell with no path found have connections left outside?',
  'Why do we read the raw EM weight and the chosen dynamic model weight separately?',
]
