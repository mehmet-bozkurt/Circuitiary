export type AtlasSpeciesId = 'c-elegans' | 'drosophila'
export type AtlasRecordId = 'circuitiary-subset30' | 'cook2019-hermaphrodite' | 'cook2019-male'
  | 'drosophila-larva2023' | 'hemibrain2020' | 'flywire2024' | 'male-cns2026'
export type AtlasCountKind = 'neurons' | 'chemical' | 'gap'
export type AtlasCountUnit = 'neurons' | 'serial-em-sections' | 'directed-neuron-pairs'
  | 'physical-gap-pairs' | 'chemical-synapses' | 'synaptic-sites'
export type AtlasCoverage = 'whole-nervous-system' | 'whole-cns' | 'whole-brain' | 'partial-brain' | 'selected-subgraph'

export interface AtlasSource {
  readonly id: string
  readonly title: string
  readonly url: string
  readonly kind: 'paper' | 'data' | 'documentation'
}

export interface AtlasCountMetric {
  readonly kind: AtlasCountKind
  readonly label: string
  /** Null means no aggregate is asserted; it never means zero connectivity. */
  readonly value: number | null
  readonly unit: AtlasCountUnit
  readonly approximate: boolean
  readonly definition: string
}

export interface AtlasRecord {
  readonly id: AtlasRecordId
  readonly speciesId: AtlasSpeciesId
  readonly title: string
  readonly shortTitle: string
  readonly kind: 'published' | 'current-subset'
  readonly stage: { readonly id: 'adult' | 'first-instar'; readonly label: string }
  readonly sex: { readonly id: 'hermaphrodite' | 'female' | 'male' | 'not-stated'; readonly label: string }
  readonly scope: { readonly coverage: AtlasCoverage; readonly label: string; readonly region: string }
  readonly reconstruction: { readonly kind: 'single-specimen' | 'composite' | 'derived-subset'; readonly label: string; readonly note: string }
  readonly version: { readonly label: string; readonly pinned: string }
  readonly counts: readonly AtlasCountMetric[]
  readonly limitations: readonly string[]
  readonly chemicalCoverage: string
  readonly gapCoverage: string
  readonly access: { readonly label: string; readonly url: string; readonly note: string }
  readonly license: { readonly status: 'verified' | 'unverified'; readonly name: string | null; readonly scope: 'dataset'; readonly note: string; readonly sourceUrl: string | null }
  readonly modelStatus: { readonly kind: 'anatomical-dataset' | 'assumed-dynamics'; readonly label: string }
  readonly circuitiaryRelation: { readonly kind: 'current-local-subset' | 'source-of-current-subset' | 'reference-only'; readonly label: string; readonly note: string }
  readonly sources: readonly AtlasSource[]
  readonly checkedDate: '2026-10-03'
}

export type AtlasCountClassification = 'same-record' | 'same-unit-scope-aligned'
  | 'same-unit-context-differs' | 'different-units' | 'missing'

export interface AtlasComparison {
  readonly left: AtlasRecord
  readonly right: AtlasRecord
  readonly sameRecord: boolean
  readonly rows: readonly { readonly key: string; readonly label: string; readonly left: string; readonly right: string; readonly different: boolean }[]
  readonly countRows: readonly {
    readonly kind: AtlasCountKind
    readonly label: string
    readonly leftMetric: AtlasCountMetric | null
    readonly rightMetric: AtlasCountMetric | null
    readonly classification: AtlasCountClassification
    readonly note: string
  }[]
}

export interface AtlasQuestion {
  readonly id: 'scope' | 'units' | 'subset' | 'model'
  readonly prompt: string
  readonly options: readonly { readonly id: string; readonly label: string }[]
  readonly correctOptionId: string
  readonly explanation: string
  readonly sourceIds: readonly string[]
}

function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value) }
  return value
}

export const speciesOptions: readonly { readonly id: AtlasSpeciesId; readonly label: string }[] = freezeTree([
  { id: 'c-elegans' as const, label: 'C. elegans' },
  { id: 'drosophila' as const, label: 'D. melanogaster' },
])

export const countUnitLabels: Readonly<Record<AtlasCountUnit, string>> = freezeTree({
  neurons: 'nöron', 'serial-em-sections': 'seri EM kesiti ağırlığı',
  'directed-neuron-pairs': 'yönlü kimyasal hücre çifti', 'physical-gap-pairs': 'fiziksel gap çifti',
  'chemical-synapses': 'kimyasal sinaps', 'synaptic-sites': 'işaretli sinaptik nokta',
})

export const atlasDefaults: Readonly<{ species: 'all'; selectedRecordId: AtlasRecordId; comparisonLeftId: AtlasRecordId; comparisonRightId: AtlasRecordId }> = freezeTree({ species: 'all' as const, selectedRecordId: 'circuitiary-subset30' as AtlasRecordId,
  comparisonLeftId: 'circuitiary-subset30' as AtlasRecordId, comparisonRightId: 'flywire2024' as AtlasRecordId })

const sources: Readonly<Record<string, AtlasSource>> = freezeTree({
  cook2019: { id: 'cook2019', title: 'Cook ve ark., 2019 · Whole-animal connectomes', url: 'https://doi.org/10.1038/s41586-019-1352-7', kind: 'paper' },
  cookMatrices: { id: 'cookMatrices', title: 'WormWiring · Cook bağlantı matrisleri', url: 'https://wormwiring.org/pages/adjacency.html', kind: 'data' },
  cookSi5: { id: 'cookSi5', title: 'Cook SI5 · July 2020 düzeltmeli matris', url: 'https://wormwiring.org/si/SI%205%20Connectome%20adjacency%20matrices%2C%20corrected%20July%202020.xlsx', kind: 'data' },
  cookSi4: { id: 'cookSi4', title: 'Cook SI4 · hücre listeleri', url: 'https://wormwiring.org/si/SI%204%20Cell%20lists.xlsx', kind: 'data' },
  winding2023: { id: 'winding2023', title: 'Winding ve ark., 2023 · Larval brain connectome', url: 'https://doi.org/10.1126/science.add9330', kind: 'paper' },
  larvaCatmaid: { id: 'larvaCatmaid', title: 'Virtual Fly Brain · L1 EM CATMAID', url: 'https://l1em.catmaid.virtualflybrain.org/', kind: 'data' },
  scheffer2020: { id: 'scheffer2020', title: 'Scheffer ve ark., 2020 · Hemibrain', url: 'https://doi.org/10.7554/eLife.57443', kind: 'paper' },
  hemibrainData: { id: 'hemibrainData', title: 'Janelia FlyEM · Hemibrain verisi', url: 'https://www.janelia.org/project-team/flyem/hemibrain', kind: 'data' },
  neuprint: { id: 'neuprint', title: 'neuPrint · veri kümeleri ve sorgulama', url: 'https://neuprint.janelia.org/', kind: 'documentation' },
  dorkenwald2024: { id: 'dorkenwald2024', title: 'Dorkenwald ve ark., 2024 · Adult female brain', url: 'https://doi.org/10.1038/s41586-024-07558-y', kind: 'paper' },
  flywireGuidelines: { id: 'flywireGuidelines', title: 'FlyWire · sürüm ve veri lisansı', url: 'https://home.flywire.ai/guidelines', kind: 'documentation' },
  flywire783Archive: { id: 'flywire783Archive', title: 'FlyWire · sürüm 783.0 bağlantı arşivi', url: 'https://zenodo.org/records/10676866', kind: 'data' },
  codex: { id: 'codex', title: 'FlyWire Codex · beyin atlası', url: 'https://codex.flywire.ai/', kind: 'data' },
  berg2026: { id: 'berg2026', title: 'Berg ve ark., 2026 · Adult male CNS', url: 'https://doi.org/10.1016/j.cell.2026.08.015', kind: 'paper' },
  maleCnsRelease: { id: 'maleCnsRelease', title: 'Janelia · Male CNS sürüm notları', url: 'https://male-cns.janelia.org/release/', kind: 'documentation' },
  maleCnsDownload: { id: 'maleCnsDownload', title: 'Janelia · Male CNS verisi ve lisansı', url: 'https://male-cns.janelia.org/download/', kind: 'data' },
})
const refs = (...ids: string[]): AtlasSource[] => ids.map(id => { const source = sources[id]; if (!source) throw new RangeError(`Unknown atlas source: ${id}`); return source })
const neurons = (value: number, approximate = false, definition = 'Kayıtta belirtilen kapsam içindeki nöronlar.'): AtlasCountMetric => ({ kind: 'neurons', label: 'Nöronlar', value, unit: 'neurons', approximate, definition })
const emChemical: AtlasCountMetric = { kind: 'chemical', label: 'Kimyasal matris ağırlıkları', value: null, unit: 'serial-em-sections', approximate: false,
  definition: 'SI5 ağırlığı seri EM kesitlerinin toplamıdır; bağlantı sayısı ve büyüklüğü birlikte etkiler. Bu katalog bir toplam kesit sayısı ileri sürmez.' }
const emGap: AtlasCountMetric = { kind: 'gap', label: 'Gap matris ağırlıkları', value: null, unit: 'serial-em-sections', approximate: false,
  definition: 'SI5 gap matrisinin ham ağırlık birimidir; fiziksel çift sayısıyla veya ölçülmüş iletkenlikle aynı nicelik değildir.' }
const anatomyModel = { kind: 'anatomical-dataset' as const, label: 'Anatomik veri; dinamik parametreler ve doğrulanmış davranış bu haritadan tek başına çıkmaz.' }
const referenceOnly = { kind: 'reference-only' as const, label: 'Bilgi amaçlı kayıt', note: 'Circuitiary bu veri kümesini bu sayfadan indirmez, içe aktarmaz veya simüle etmez.' }
const cookLicense = { status: 'unverified' as const, name: null, scope: 'dataset' as const,
  note: 'SI4/SI5 dosyalarının yeniden dağıtım izni doğrulanmadı. Makalenin ya da başka yazılımın lisansı veri dosyalarına aktarılmaz.', sourceUrl: null }

/** Selected, versioned examples; not an exhaustive or automatically updated catalog. */
export const atlasRecords: readonly AtlasRecord[] = freezeTree([
  {
    id: 'circuitiary-subset30', speciesId: 'c-elegans', title: 'Circuitiary · mevcut 30 hücreli alt ağ', shortTitle: 'Circuitiary · 30 hücre', kind: 'current-subset',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'hermaphrodite', label: 'Hermafrodit' },
    scope: { coverage: 'selected-subgraph', label: 'Seçilmiş anatomik alt ağ', region: 'AVAR/AVER çevresinde seçilmiş 30 nöron; bütün sinir sistemi değildir.' },
    reconstruction: { kind: 'derived-subset', label: 'Yayın verisinden türetilmiş alt ağ', note: 'Cook bileşik haritasından deterministik seçim; tek hayvanın bağımsız yeni rekonstrüksiyonu değildir.' },
    version: { label: 'SI5 corrected July 2020 + SI4 · yerel seçim v1', pinned: 'cook2019-hermaphrodite-si5-july2020; avar-aver-one-hop-v1' },
    counts: [neurons(30, false, 'AVAR ve AVER tohumlarıyla seçilmiş tam hücre kimlikleri.'),
      { kind: 'chemical', label: 'Kimyasal anatomik çiftler', value: 196, unit: 'directed-neuron-pairs', approximate: false, definition: 'Yönlü hücre çiftleri; beş kimyasal öz bağlantı dahildir. Her kenarın ham ağırlığı ayrıca seri EM kesiti cinsindedir.' },
      { kind: 'gap', label: 'Gap anatomik çiftler', value: 50, unit: 'physical-gap-pairs', approximate: false, definition: 'Her kanonik fiziksel çift bir kez sayılır. Kaynak köşegenleri bu çift sayısına girmez.' }],
    limitations: ['Alt ağ dışındaki bağlantılar bu 196/50 kayda dahil değildir.', 'Hücre rollerinin seçilmesi ve model parametreleri yayımlanmış fizyolojik ölçüm değildir.'],
    chemicalCoverage: 'Yönlü anatomik kenarlar; içe aktarılan veride kimyasal işaret, verici veya reseptör ölçümü yok.',
    gapCoverage: '50 fiziksel çift korunur; eşit iki yönlü model katsayısı sonraki simülasyonun varsayımıdır.',
    access: { label: 'Kaynak matris ve hücre listeleri', url: sources.cookMatrices!.url, note: 'Yerel dosya bu atlas tarafından okunmaz. Kayıt, mevcut sabitlenmiş seçimin özetidir; morfoloji içe aktarımı yapılmaz.' },
    license: cookLicense, modelStatus: { kind: 'assumed-dynamics', label: 'Mevcut deneylerde varsayımsal dinamik kullanılır; biyolojik davranış doğrulanmış değildir.' },
    circuitiaryRelation: { kind: 'current-local-subset', label: 'Şu anda kullanılan alt ağ', note: '196 kimyasal ve 50 gap kaydı mevcut gerçek veri deneylerine temel olur; ham ağırlık ile normalize model ağırlığı ayrı tutulur.' },
    sources: refs('cook2019', 'cookMatrices', 'cookSi5', 'cookSi4'), checkedDate: '2026-10-03',
  },
  {
    id: 'cook2019-hermaphrodite', speciesId: 'c-elegans', title: 'Cook 2019 · erişkin hermafrodit', shortTitle: 'Cook · hermafrodit', kind: 'published',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'hermaphrodite', label: 'Hermafrodit' },
    scope: { coverage: 'whole-nervous-system', label: 'Bütün hayvanın sinir sistemi', region: 'Sinir sistemi grafı; matrisler kas ve başka uç organları da içerir.' },
    reconstruction: { kind: 'composite', label: 'Birden çok seriden bileşik harita', note: 'Farklı EM serileri ve hayvanlardan birleştirilir; bazı boşluklar ekstrapolasyonla tamamlanır.' },
    version: { label: 'Cook 2019 · SI5 corrected July 2020 + SI4', pinned: 'SI5-corrected-July-2020; SI4' },
    counts: [neurons(302, false, 'Yayının erişkin hermafrodit nöron sayısı. Kas ve uç organlar bu sayıya dahil değildir.'), emChemical, emGap],
    limitations: ['Yayındaki 460 düğümlü bütün hücre grafı 302 nörondan daha geniştir; kas ve uç organ içerir.', 'Bütün kayıtlar tek örnekte doğrudan gözlenmiş bağlantılar değildir.'],
    chemicalCoverage: 'SI5 kimyasal matrisi EM kesiti ağırlığı kullanır; ayrı SI2 sinaps puanlarıyla karıştırılmaz.',
    gapCoverage: 'Gap matrisi vardır; ham ağırlık ölçülmüş iletkenlik veya doğrultuculuk tanımlamaz.',
    access: { label: 'WormWiring · kaynak matrisler', url: sources.cookMatrices!.url, note: 'SI4 hücre listesi ve düzeltilmiş SI5 matrisleri erişilebilirdir. Atlas tam grafı yüklemez.' },
    license: cookLicense, modelStatus: anatomyModel,
    circuitiaryRelation: { kind: 'source-of-current-subset', label: 'Mevcut alt ağın kaynak kaydı', note: 'Circuitiary bunun tamamını simüle etmez; yalnız AVAR/AVER ile seçilmiş 30 nöronluk alt ağı kullanır.' },
    sources: refs('cook2019', 'cookMatrices', 'cookSi5', 'cookSi4'), checkedDate: '2026-10-03',
  },
  {
    id: 'cook2019-male', speciesId: 'c-elegans', title: 'Cook 2019 · erişkin erkek', shortTitle: 'Cook · erkek', kind: 'published',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'male', label: 'Erkek' },
    scope: { coverage: 'whole-nervous-system', label: 'Bütün hayvanın sinir sistemi', region: 'Erkek sinir sistemi grafı; kas ve başka uç organlar da matrislerde bulunur.' },
    reconstruction: { kind: 'composite', label: 'Birden çok seriden bileşik harita', note: 'Birden çok hayvanın EM serilerini ve ekstrapolasyonla tamamlanan bağlantıları birleştirir.' },
    version: { label: 'Cook 2019 · SI5 corrected July 2020 + SI4', pinned: 'SI5-corrected-July-2020; SI4' },
    counts: [neurons(385, false, 'Yayının erişkin erkek nöron sayısı; 579 bütün-hücre düğümü ile aynı sayı değildir.'), emChemical, emGap],
    limitations: ['579 düğümlü yayın grafı nöronlara ek olarak kas ve uç organları içerir.', 'Hermafrodit haritası ve mevcut 30 hücreli alt ağ ile aynı anatomik kayıt değildir.'],
    chemicalCoverage: 'SI5 seri EM kesiti ağırlıkları; ham değer sinaps sayısı ya da işaretli işlevsel ağırlık değildir.',
    gapCoverage: 'Gap matrisi mevcuttur; fiziksel çiftlerin ağırlıkları fizyolojik dinamiği tek başına belirlemez.',
    access: { label: 'WormWiring · erkek matrisi', url: sources.cookMatrices!.url, note: 'Aynı yayın paketi farklı cinsiyet matrislerini içerir. Circuitiary erkek grafını yüklemez.' },
    license: cookLicense, modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('cook2019', 'cookMatrices', 'cookSi5', 'cookSi4'), checkedDate: '2026-10-03',
  },
  {
    id: 'drosophila-larva2023', speciesId: 'drosophila', title: 'Winding 2023 · birinci evre larva beyni', shortTitle: 'Larva · 2023', kind: 'published',
    stage: { id: 'first-instar', label: 'Birinci larva evresi (L1), yaklaşık 6 saat' }, sex: { id: 'female', label: 'Dişi' },
    scope: { coverage: 'whole-brain', label: 'Bütün larva beyni', region: 'Beyin; kaynak EM hacminin bütün CNS içermesi bu kaydı beyin + bütün VNC yapmaz.' },
    reconstruction: { kind: 'single-specimen', label: 'Tek larva örneği', note: 'Beyin nöronlarının %99’dan fazlası tamamlanmış; sinaptik noktaların bağlantı eşlemesinde ayrı eksikler vardır.' },
    version: { label: 'Science 2023 · son yayımlanmış beyin kaydı', pinned: 'Science-add9330-2023' },
    counts: [neurons(3016, false, '480 girdi ve 2536 farklılaşmış beyin nöronu; eski ön baskıdaki 3013 sayısıyla karıştırılmaz.'),
      { kind: 'chemical', label: 'İşaretli sinaptik noktalar', value: 548_000, unit: 'synaptic-sites', approximate: true, definition: 'Son yayının yaklaşık sinaptik nokta sayısıdır; farklı hücre çiftlerinin sayısı değildir.' }],
    limitations: ['İşaretli noktaların yaklaşık %75’i nöronlarla eşleştirilmiştir; kalan bölüm çoğunlukla küçük yetim fragmanlardır.', 'Larva verisi erişkin beyninin küçültülmüş kopyası olarak yorumlanmaz.'],
    chemicalCoverage: 'EM ile işaretlenen sinaptik noktalar ve yönlü bağlantılar; tüm noktaların partneri eşit ölçüde tamamlanmış değildir.',
    gapCoverage: 'Bu kayıtta doğrulanmış kapsamlı elektriksel bağ haritası sunulmuyor; bu durum hayvanda gap olmadığı anlamına gelmez.',
    access: { label: 'Larva · CATMAID', url: sources.larvaCatmaid!.url, note: 'Rekonstrüksiyon erişimi ve yayın ek verileri vardır. Analiz kodunun MIT lisansı veri dosyalarının lisansını belirlemez.' },
    license: { status: 'unverified', name: null, scope: 'dataset', note: 'Veri dosyasına özgü yeniden kullanım lisansı burada doğrulanmadı; makalenin CC BY lisansı veri paketine otomatik aktarılmaz.', sourceUrl: null },
    modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('winding2023', 'larvaCatmaid'), checkedDate: '2026-10-03',
  },
  {
    id: 'hemibrain2020', speciesId: 'drosophila', title: 'Hemibrain 2020 · erişkin dişi merkez beyin bölümü', shortTitle: 'Hemibrain · 2020', kind: 'published',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'female', label: 'Dişi' },
    scope: { coverage: 'partial-brain', label: 'Kısmi merkez beyin', region: 'Merkez beynin bir bölümü; bütün beyin, optik lobların bütünü veya VNC değildir.' },
    reconstruction: { kind: 'single-specimen', label: 'Tek erişkin dişi örneği', note: 'Tam ya da kısmi nöron rekonstrüksiyonları; hacim sınırlarında kesilen hücre parçaları da vardır.' },
    version: { label: 'Scheffer 2020 · yayının raporladığı sayım kapsamı', pinned: 'eLife-57443-2020; publication-counts; no-current-portal-recount' },
    counts: [neurons(25_000, true, 'Yayının yaklaşık nöron sayımı; ek kesilmiş hücre parçaları ayrıca bulunur.'),
      { kind: 'chemical', label: 'Kimyasal sinapslar', value: 20_000_000, unit: 'chemical-synapses', approximate: true, definition: 'Yaklaşık 25 bin nöron arasındaki yayın sayımı; hacimdeki bütün PSD/T-bar sayılarıyla aynı payda değildir.' }],
    limitations: ['Kesilmiş parçaları, hacmin bütün PSD sayısını ve yayın nöronları arasındaki sinaps sayısını birbirine karıştırma.', 'Daha sonraki portal sürümleri bu 2020 yayın sayımını otomatik güncellemez.'],
    chemicalCoverage: 'Segmentasyon, iskeletler, sinaps konumları ve partnerleri; anatomik eşleme tek başına davranış değildir.',
    gapCoverage: 'Kimyasal harita gap dinamiğinin veya kapsamlı elektriksel bağların ölçümü değildir; gap yokluğu iddia edilmez.',
    access: { label: 'Janelia · Hemibrain', url: sources.hemibrainData!.url, note: 'neuPrint sorguları, iskeletler ve morfoloji erişimi bulunur; bazı API işlemleri hesap/jeton isteyebilir.' },
    license: { status: 'verified', name: 'CC BY 4.0', scope: 'dataset', note: 'Janelia veri sayfasındaki veri lisansı doğrulandı; kapsamı bu yayın veri kaydıdır.', sourceUrl: sources.hemibrainData!.url },
    modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('scheffer2020', 'hemibrainData', 'neuprint'), checkedDate: '2026-10-03',
  },
  {
    id: 'flywire2024', speciesId: 'drosophila', title: 'FlyWire 2024 · erişkin dişi beyninin bütünü', shortTitle: 'FlyWire · 2024', kind: 'published',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'female', label: 'Dişi' },
    scope: { coverage: 'whole-brain', label: 'Bütün erişkin beyni', region: 'Merkez beyin ve optik loblar; ventral sinir kordonu, bütün CNS veya hayvanın bedeni değildir.' },
    reconstruction: { kind: 'single-specimen', label: 'Tek FAFB örneği', note: 'Düzeltilmiş segmentasyon ve morfoloji; farklı hayvanları veya bireysel değişkenliği temsil eden bir ortalama değildir.' },
    version: { label: '2024 yayın · FlyWire 783 / bağlantı arşivi 783.0', pinned: 'materialization-783-October-2023; Zenodo-10676866-v783.0-2024-06-02' },
    counts: [neurons(139_255, false, 'Bu yayın kaydındaki düzeltilmiş nöronlar; farklı güncel sorgu sürümleriyle karıştırılmaz.'),
      { kind: 'chemical', label: 'Kimyasal sinapslar', value: 54_500_000, unit: 'chemical-synapses', approximate: true, definition: 'Bu nöronlar arasındaki yaklaşık 54,5 milyon kimyasal sinaps; farklı hücre çifti sayısı değildir.' }],
    limitations: ['Sürüm, anotasyon ve eşik filtreleri değişirse sayım da değişebilir. Arşivdeki düzeltilmemiş fragman temaslarını 54,5 milyon yayın sinapsıyla eşitleme.', 'Nörotransmitter tahminleri ölçülmüş reseptör, zaman sabiti veya doğrulanmış davranış anlamına gelmez.'],
    chemicalCoverage: 'Kimyasal EM bağlantıları, morfoloji ve anotasyonlar; bazı verici anotasyonları tahmindir.',
    gapCoverage: 'Elektriksel sinapslar bu kimyasal bağlantı kaydına dahil değildir; bu, hayvanda gap bulunmadığını göstermez.',
    access: { label: 'FlyWire · Codex ve sürümlü arşiv', url: sources.codex!.url, note: 'Codex için Google hesabıyla oturum açılır. 783.0 bağlantı arşivinin statik erişimi ayrı bir yoldur; atlas ikisini de indirmez.' },
    license: { status: 'verified', name: 'CC BY 4.0', scope: 'dataset', note: 'Bu sabitlenmiş 783.0 bağlantı arşivinin Zenodo metadata lisansı CC BY 4.0. Güncel genel FlyWire kılavuzu ise CC BY-NC 4.0 diyor; kapsam farkını koru ve gelecekteki indirme/paylaşımda ilgili dosya koşullarını birlikte incele. Makale lisansı ayrıca ele alınır.', sourceUrl: sources.flywire783Archive!.url },
    modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('dorkenwald2024', 'flywire783Archive', 'flywireGuidelines', 'codex'), checkedDate: '2026-10-03',
  },
  {
    id: 'male-cns2026', speciesId: 'drosophila', title: 'Male CNS 2026 · erişkin erkek merkezi sinir sistemi', shortTitle: 'Male CNS · 2026', kind: 'published',
    stage: { id: 'adult', label: 'Erişkin' }, sex: { id: 'male', label: 'Erkek' },
    scope: { coverage: 'whole-cns', label: 'Beyin ve ventral sinir kordonu', region: 'Merkezi sinir sistemi: beyin + VNC; bütün hayvanın bedeni veya çevresel sinir sisteminin tamamı değildir.' },
    reconstruction: { kind: 'single-specimen', label: 'Tek erişkin erkek örneği', note: 'Beyin ve sinir kordonunun aynı CNS rekonstrüksiyonu; FlyWire dişi beyniyle aynı örnek ve kapsam değildir.' },
    version: { label: 'Male CNS v1.0 · 8 Haziran 2026; Cell · 3 Eylül 2026', pinned: 'male-cns:v1.0; 2026-06-08; doi:10.1016/j.cell.2026.08.015' },
    counts: [neurons(166_700, false, 'Yayında bildirilen düzeltilmiş CNS nöron sayımı; beyin, optik loblar ve ventral sinir kordonu kapsamındadır.')],
    limitations: ['Bütün beyin ile bütün CNS kapsamını eşitleme; ek sinir kordonu farklı bir anatomik bölgedir.', 'Bu katalog yeni veri indirmez; portal sürümü ile yayın sayımını ayrı tutar.'],
    chemicalCoverage: 'EM ile eşlenen kimyasal bağlantılar; kaynak yayına göre okunmalı, beyin-only kaydının paydasıyla karıştırılmamalı.',
    gapCoverage: 'Bu kayıtta doğrulanmış kapsamlı elektriksel bağ haritası sunulmuyor; biyolojik gap yokluğu ileri sürülmez.',
    access: { label: 'Janelia · Male CNS verisi', url: sources.maleCnsDownload!.url, note: 'Statik dosya bağlantıları vardır. neuPrint API hesap/jeton ister; bu atlas veri yüklemez. Yaklaşık kimyasal temas toplamı burada sayısal ölçüt olarak ileri sürülmemiştir.' },
    license: { status: 'verified', name: 'CC BY 4.0', scope: 'dataset', note: 'Resmî Male CNS veri sayfasındaki veri lisansı CC BY 4.0 olarak doğrulandı; sürüm v1.0 ile okunur.', sourceUrl: sources.maleCnsDownload!.url },
    modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('berg2026', 'maleCnsRelease', 'maleCnsDownload', 'neuprint'), checkedDate: '2026-10-03',
  },
])

export function recordFor(id: string): AtlasRecord {
  const record = atlasRecords.find(candidate => candidate.id === id)
  if (!record) throw new RangeError(`Unknown atlas record ID: ${String(id)}.`)
  return record
}

export function recordsForSpecies(species: 'all' | AtlasSpeciesId): readonly AtlasRecord[] {
  if (species === 'all') return atlasRecords
  if (!speciesOptions.some(option => option.id === species)) throw new RangeError(`Unknown atlas species ID: ${String(species)}.`)
  return freezeTree(atlasRecords.filter(record => record.speciesId === species))
}

const comparisonFields = [
  ['species', 'Tür', (record: AtlasRecord) => speciesOptions.find(option => option.id === record.speciesId)!.label],
  ['stage', 'Yaşam evresi', (record: AtlasRecord) => record.stage.label],
  ['sex', 'Cinsiyet', (record: AtlasRecord) => record.sex.label],
  ['scope', 'Kapsam', (record: AtlasRecord) => record.scope.label],
  ['region', 'Anatomik bölge', (record: AtlasRecord) => record.scope.region],
  ['reconstruction', 'Rekonstrüksiyon', (record: AtlasRecord) => record.reconstruction.label],
  ['version', 'Sabitlenen kayıt', (record: AtlasRecord) => record.version.label],
  ['license', 'Veri lisansı', (record: AtlasRecord) => record.license.name ?? 'Doğrulanmadı'],
  ['model', 'Model durumu', (record: AtlasRecord) => record.modelStatus.label],
  ['relation', 'Circuitiary ile ilişkisi', (record: AtlasRecord) => record.circuitiaryRelation.label],
] as const

/** Descriptive comparison only: no ratios or inferred functional superiority. */
export function buildComparison(leftId: string, rightId: string): AtlasComparison {
  const left = recordFor(leftId)
  const right = recordFor(rightId)
  const sameRecord = left.id === right.id
  const contextAligned = left.speciesId === right.speciesId && left.stage.id === right.stage.id
    && left.sex.id === right.sex.id && left.scope.coverage === right.scope.coverage
    && left.scope.region === right.scope.region && left.reconstruction.kind === right.reconstruction.kind
  const countRows = (['neurons', 'chemical', 'gap'] as const).map(kind => {
    const leftMetric = left.counts.find(metric => metric.kind === kind) ?? null
    const rightMetric = right.counts.find(metric => metric.kind === kind) ?? null
    let classification: AtlasCountClassification
    let note: string
    if (!leftMetric || !rightMetric) {
      classification = 'missing'; note = 'Bu nicelik iki kayıtta birden verilmemiştir. Eksik bilgi sıfır bağlantı anlamına gelmez.'
    } else if (leftMetric.unit !== rightMetric.unit) {
      classification = 'different-units'; note = 'Birimler farklıdır. EM kesiti ağırlığı, hücre çifti, sinaptik nokta ve kimyasal sinaps birbirinin yerine geçmez; oran hesaplanmaz.'
    } else if (sameRecord) {
      classification = 'same-record'; note = 'Aynı sabitlenmiş kayıt iki kez seçildi; burada ayrı iki örnek veya deney yoktur.'
    } else if (leftMetric.value === null || rightMetric.value === null) {
      classification = 'missing'; note = 'Ortak birim olsa da sayısal toplam ileri sürülmemiştir; boş değer sıfır değildir.'
    } else if (!contextAligned) {
      classification = 'same-unit-context-differs'; note = 'Birim aynı, örnek ve anatomik bağlam farklıdır. Tür, evre, cinsiyet ve kapsam farkları nedeniyle bu sayılar işlev veya kapasite sıralaması oluşturmaz.'
    } else {
      classification = 'same-unit-scope-aligned'; note = 'Birim ve belirtilen kapsam örtüşür; sayı yine kayıt tanımı ve sürümüyle okunur, işlevsel eşdeğerlik veya davranış sonucu çıkarılmaz.'
    }
    return { kind, label: kind === 'neurons' ? 'Nöron sayımı' : kind === 'chemical' ? 'Kimyasal bağlantı niceliği' : 'Gap bağlantı niceliği', leftMetric, rightMetric, classification, note }
  })
  return freezeTree({ left, right, sameRecord,
    rows: comparisonFields.map(([key, label, value]) => ({ key, label, left: value(left), right: value(right), different: value(left) !== value(right) })), countRows })
}

export const atlasQuestions: readonly AtlasQuestion[] = freezeTree([
  { id: 'scope', prompt: 'FlyWire 2024 için “bütün erişkin beyni” neyi kapsar?',
    options: [{ id: 'wholeAnimal', label: 'Beyni, sinir kordonunu ve hayvanın bütün bedenini' }, { id: 'brainOnly', label: 'Beyni; VNC ve bütün CNS ayrı kapsamdır' }, { id: 'allIndividuals', label: 'Türün bütün bireylerindeki tek ortak beyni' }],
    correctOptionId: 'brainOnly', explanation: 'FlyWire kaydı tek erişkin dişi beynidir. Beyin ve optik loblar, ventral sinir kordonuyla birlikte bütün CNS demek değildir; Male CNS farklı örnek ve kapsamdır.', sourceIds: ['dorkenwald2024', 'berg2026'] },
  { id: 'units', prompt: 'Cook SI5’in EM kesiti ağırlığı ile FlyWire’ın sinaps sayısını nasıl karşılaştırırsın?',
    options: [{ id: 'divideCounts', label: 'İki sayıyı bölüp bağlantı gücünü bulurum' }, { id: 'differentUnits', label: 'Farklı nicelikler olduklarını belirtir, doğrudan oran kurmam' }, { id: 'bothSynapses', label: 'İkisini de aynı sinaps sayısı kabul ederim' }],
    correctOptionId: 'differentUnits', explanation: 'SI5 ağırlığı kesitlerdeki bağlantı boyutu ve sayısını birlikte taşır. Sinaps sayısı, kesit ağırlığı ve farklı hücre çifti sayısı ayrı niceliklerdir.', sourceIds: ['cook2019', 'cookMatrices', 'dorkenwald2024'] },
  { id: 'subset', prompt: 'Circuitiary’nin mevcut gerçek veri devresindeki 30 hücre neyi temsil eder?',
    options: [{ id: 'wholeWorm', label: 'C. elegans’ın bütün sinir sistemini' }, { id: 'selectedSubset', label: 'Cook hermafrodit kaydından seçilmiş, dış bağlantıları eksik bir alt ağı' }, { id: 'flySubset', label: 'FlyWire erişkin beyninin tamamını' }],
    correctOptionId: 'selectedSubset', explanation: '30 nöron ile 196 yönlü kimyasal ve 50 fiziksel gap çifti mevcut seçimin iç kayıtlarıdır. Bütün hermafrodit kaydındaki 302 nöronla aynı kapsam değildir.', sourceIds: ['cook2019', 'cookSi5', 'cookSi4'] },
  { id: 'model', prompt: 'Bir anatomik haritadan davranış simülasyonuna geçmek için ne gerekir?',
    options: [{ id: 'wiringEnough', label: 'Yalnız kablo haritası yeter; davranış otomatik doğrulanır' }, { id: 'dynamicsAndValidation', label: 'Dinamik varsayımlar, uyaran/beden bağlamı ve bağımsız biyolojik doğrulama' }, { id: 'moreNeurons', label: 'Sadece daha fazla nöron saymak' }],
    correctOptionId: 'dynamicsAndValidation', explanation: 'Anatomi aktarım ilişkilerini sınırlar; reseptörler, işaretler, zaman sabitleri ve bedenle etkileşim tek başına haritadan çıkmaz. Model çıktısı biyolojik ölçümle ayrıca sınanmalıdır.', sourceIds: ['cook2019', 'dorkenwald2024'] },
])

export function answerAtlasQuestion(questionId: string, optionId: string): Readonly<{ correct: boolean; explanation: string }> {
  const question = atlasQuestions.find(candidate => candidate.id === questionId)
  if (!question) throw new RangeError(`Unknown atlas question ID: ${String(questionId)}.`)
  if (!question.options.some(option => option.id === optionId)) throw new RangeError(`Unknown option for atlas question ${questionId}: ${String(optionId)}.`)
  return freezeTree({ correct: optionId === question.correctOptionId, explanation: question.explanation })
}
