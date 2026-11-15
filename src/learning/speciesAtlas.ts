import { L, defineMessages, localeTag, pick } from '../i18n'

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
/** Scientific names are not translated, so both languages share one list. */
export const speciesOptionsEn: typeof speciesOptions = speciesOptions

export const countUnitLabels: Readonly<Record<AtlasCountUnit, string>> = freezeTree({
  neurons: 'nöron', 'serial-em-sections': 'seri EM kesiti ağırlığı',
  'directed-neuron-pairs': 'yönlü kimyasal hücre çifti', 'physical-gap-pairs': 'fiziksel gap çifti',
  'chemical-synapses': 'kimyasal sinaps', 'synaptic-sites': 'işaretli sinaptik nokta',
})
export const countUnitLabelsEn: typeof countUnitLabels = freezeTree({
  neurons: 'neurons', 'serial-em-sections': 'serial EM section weight',
  'directed-neuron-pairs': 'directed chemical cell pairs', 'physical-gap-pairs': 'physical gap pairs',
  'chemical-synapses': 'chemical synapses', 'synaptic-sites': 'annotated synaptic sites',
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
    counts: [neurons(166_700, false, 'Yayında bildirilen düzeltilmiş CNS nöron sayımı; beyin, optik loblar ve ventral sinir kordonu kapsamındadır. Ön baskının ikinci sürümü 166.691 bildirir; yayındaki 166.700 yuvarlanmış olabilir.')],
    limitations: ['Bütün beyin ile bütün CNS kapsamını eşitleme; ek sinir kordonu farklı bir anatomik bölgedir.', 'Bu katalog yeni veri indirmez; portal sürümü ile yayın sayımını ayrı tutar.'],
    chemicalCoverage: 'EM ile eşlenen kimyasal bağlantılar; kaynak yayına göre okunmalı, beyin-only kaydının paydasıyla karıştırılmamalı.',
    gapCoverage: 'Bu kayıtta doğrulanmış kapsamlı elektriksel bağ haritası sunulmuyor; biyolojik gap yokluğu ileri sürülmez.',
    access: { label: 'Janelia · Male CNS verisi', url: sources.maleCnsDownload!.url, note: 'Statik dosya bağlantıları vardır. neuPrint API hesap/jeton ister; bu atlas veri yüklemez. Yaklaşık kimyasal temas toplamı burada sayısal ölçüt olarak ileri sürülmemiştir.' },
    license: { status: 'verified', name: 'CC BY 4.0', scope: 'dataset', note: 'Resmî Male CNS veri sayfasındaki veri lisansı CC BY 4.0 olarak doğrulandı; sürüm v1.0 ile okunur.', sourceUrl: sources.maleCnsDownload!.url },
    modelStatus: anatomyModel, circuitiaryRelation: referenceOnly,
    sources: refs('berg2026', 'maleCnsRelease', 'maleCnsDownload', 'neuprint'), checkedDate: '2026-10-03',
  },
])

// English. Only text is written again: ids, counts, units, approximate flags, urls, pinned versions and
// license names are read from the Turkish records above, so every number and source exists once.
interface AtlasRecordText {
  readonly title: string
  readonly shortTitle: string
  readonly stage: string
  readonly sex: string
  readonly scope: { readonly label: string; readonly region: string }
  readonly reconstruction: { readonly label: string; readonly note: string }
  readonly version: string
  /** One entry per count of the record, in the record's order. */
  readonly counts: readonly { readonly label: string; readonly definition: string }[]
  /** One entry per limitation of the record, in the record's order. */
  readonly limitations: readonly string[]
  readonly chemicalCoverage: string
  readonly gapCoverage: string
  readonly access: { readonly label: string; readonly note: string }
  readonly licenseNote: string
  readonly modelStatus: string
  readonly relation: { readonly label: string; readonly note: string }
}

const sourceTitlesEn: Readonly<Record<string, string>> = {
  cook2019: 'Cook et al., 2019 · Whole-animal connectomes',
  cookMatrices: 'WormWiring · Cook connection matrices',
  cookSi5: 'Cook SI5 · matrix corrected July 2020',
  cookSi4: 'Cook SI4 · cell lists',
  winding2023: 'Winding et al., 2023 · Larval brain connectome',
  larvaCatmaid: 'Virtual Fly Brain · L1 EM CATMAID',
  scheffer2020: 'Scheffer et al., 2020 · Hemibrain',
  hemibrainData: 'Janelia FlyEM · Hemibrain data',
  neuprint: 'neuPrint · datasets and queries',
  dorkenwald2024: 'Dorkenwald et al., 2024 · Adult female brain',
  flywireGuidelines: 'FlyWire · version and data license',
  flywire783Archive: 'FlyWire · version 783.0 connection archive',
  codex: 'FlyWire Codex · brain atlas',
  berg2026: 'Berg et al., 2026 · Adult male CNS',
  maleCnsRelease: 'Janelia · Male CNS release notes',
  maleCnsDownload: 'Janelia · Male CNS data and license',
}
const sourcesEn: Readonly<Record<string, AtlasSource>> = freezeTree(Object.fromEntries(Object.values(sources).map(source => {
  const title = sourceTitlesEn[source.id]
  if (title === undefined) throw new RangeError(`No English title for atlas source: ${source.id}`)
  return [source.id, { ...source, title }]
})))

const adultEn = 'Adult'
const neuronsEn = (definition: string) => ({ label: 'Neurons', definition })
const emChemicalEn = { label: 'Chemical matrix weights',
  definition: 'An SI5 weight is a sum of serial EM sections; the number of connections and their size both affect it. This catalog does not assert a total section count.' }
const emGapEn = { label: 'Gap matrix weights',
  definition: 'The raw weight unit of the SI5 gap matrix; it is not the same quantity as the number of physical pairs or a measured conductance.' }
const anatomyModelEn = 'Anatomical data; dynamic parameters and validated behavior do not follow from this map alone.'
const referenceOnlyEn = { label: 'Record for reference only', note: 'Circuitiary does not download, import or simulate this dataset from this page.' }
const cookLicenseNoteEn = 'Permission to redistribute the SI4/SI5 files has not been verified. The license of the article or of other software does not carry over to the data files.'
const wholeAnimalScopeEn = 'Nervous system of the whole animal'
const compositeMapEn = 'Composite map from several series'
const cookVersionEn = 'Cook 2019 · SI5 corrected July 2020 + SI4'

const recordTextEn: Readonly<Record<AtlasRecordId, AtlasRecordText>> = {
  'circuitiary-subset30': {
    title: 'Circuitiary · current 30-cell subnetwork', shortTitle: 'Circuitiary · 30 cells',
    stage: adultEn, sex: 'Hermaphrodite',
    scope: { label: 'Selected anatomical subnetwork', region: '30 neurons selected around AVAR/AVER; not the whole nervous system.' },
    reconstruction: { label: 'Subnetwork derived from published data', note: 'A deterministic selection from the Cook composite map; not an independent new reconstruction of a single animal.' },
    version: 'SI5 corrected July 2020 + SI4 · local selection v1',
    counts: [neuronsEn('Exact cell identities selected with the seeds AVAR and AVER.'),
      { label: 'Chemical anatomical pairs', definition: 'Directed cell pairs; five chemical self-connections are included. The raw weight of each edge is, separately, in serial EM sections.' },
      { label: 'Gap anatomical pairs', definition: 'Each canonical physical pair is counted once. Source diagonals do not enter this pair count.' }],
    limitations: ['Connections outside the subnetwork are not included in these 196/50 records.', 'The choice of cell roles and the model parameters are not published physiological measurements.'],
    chemicalCoverage: 'Directed anatomical edges; the imported data has no measurement of chemical sign, transmitter or receptor.',
    gapCoverage: '50 physical pairs are kept; the equal two-way model gain is an assumption of the later simulation.',
    access: { label: 'Source matrix and cell lists', note: 'The local file is not read by this atlas. The record is a summary of the current pinned selection; no morphology is imported.' },
    licenseNote: cookLicenseNoteEn, modelStatus: 'The current experiments use assumed dynamics; biological behavior is not validated.',
    relation: { label: 'The subnetwork currently in use', note: 'The 196 chemical and 50 gap records are the basis of the current real data experiments; the raw weight and the normalized model weight are kept apart.' },
  },
  'cook2019-hermaphrodite': {
    title: 'Cook 2019 · adult hermaphrodite', shortTitle: 'Cook · hermaphrodite',
    stage: adultEn, sex: 'Hermaphrodite',
    scope: { label: wholeAnimalScopeEn, region: 'Nervous system graph; the matrices also include muscle and other end organs.' },
    reconstruction: { label: compositeMapEn, note: 'Combined from different EM series and animals; some gaps are filled in by extrapolation.' },
    version: cookVersionEn,
    counts: [neuronsEn('The publication’s neuron count for the adult hermaphrodite. Muscle and end organs are not included in this number.'), emChemicalEn, emGapEn],
    limitations: ['The 460-node whole-cell graph in the publication is larger than the 302 neurons; it includes muscle and end organs.', 'Not all records are connections observed directly in a single specimen.'],
    chemicalCoverage: 'The SI5 chemical matrix uses EM section weight; it is not to be confused with the separate SI2 synapse scores.',
    gapCoverage: 'There is a gap matrix; the raw weight does not define a measured conductance or rectification.',
    access: { label: 'WormWiring · source matrices', note: 'The SI4 cell list and the corrected SI5 matrices are accessible. The atlas does not load the full graph.' },
    licenseNote: cookLicenseNoteEn, modelStatus: anatomyModelEn,
    relation: { label: 'Source record of the current subnetwork', note: 'Circuitiary does not simulate all of it; it uses only the 30-neuron subnetwork selected with AVAR/AVER.' },
  },
  'cook2019-male': {
    title: 'Cook 2019 · adult male', shortTitle: 'Cook · male',
    stage: adultEn, sex: 'Male',
    scope: { label: wholeAnimalScopeEn, region: 'Male nervous system graph; muscle and other end organs are also in the matrices.' },
    reconstruction: { label: compositeMapEn, note: 'Combines the EM series of several animals and connections filled in by extrapolation.' },
    version: cookVersionEn,
    counts: [neuronsEn('The publication’s neuron count for the adult male; not the same number as the 579 whole-cell nodes.'), emChemicalEn, emGapEn],
    limitations: ['The 579-node publication graph includes muscle and end organs in addition to neurons.', 'It is not the same anatomical record as the hermaphrodite map or the current 30-cell subnetwork.'],
    chemicalCoverage: 'SI5 serial EM section weights; the raw value is not a synapse count or a signed functional weight.',
    gapCoverage: 'A gap matrix is available; the weights of the physical pairs do not determine physiological dynamics on their own.',
    access: { label: 'WormWiring · male matrix', note: 'The same publication package contains the matrices of the different sexes. Circuitiary does not load the male graph.' },
    licenseNote: cookLicenseNoteEn, modelStatus: anatomyModelEn, relation: referenceOnlyEn,
  },
  'drosophila-larva2023': {
    title: 'Winding 2023 · first-instar larval brain', shortTitle: 'Larva · 2023',
    stage: 'First larval instar (L1), about 6 hours', sex: 'Female',
    scope: { label: 'Whole larval brain', region: 'Brain; that the source EM volume contains the whole CNS does not make this record brain + whole VNC.' },
    reconstruction: { label: 'A single larval specimen', note: 'More than 99% of the brain neurons are completed; the mapping of synaptic sites to connections has separate omissions.' },
    version: 'Science 2023 · final published brain record',
    counts: [neuronsEn('480 input and 2536 differentiated brain neurons; not to be confused with the count of 3013 in the earlier preprint.'),
      { label: 'Annotated synaptic sites', definition: 'The approximate number of synaptic sites in the final publication; not the number of distinct cell pairs.' }],
    limitations: ['About 75% of the annotated sites are matched to neurons; the rest is mostly small orphan fragments.', 'The larval data is not to be read as a scaled-down copy of the adult brain.'],
    chemicalCoverage: 'Synaptic sites annotated with EM and directed connections; the partners of all sites are not completed to the same degree.',
    gapCoverage: 'This record offers no verified comprehensive map of electrical connections; that does not mean the animal has no gap junctions.',
    access: { label: 'Larva · CATMAID', note: 'Access to the reconstruction and the publication’s supplementary data are available. The MIT license of the analysis code does not determine the license of the data files.' },
    licenseNote: 'A reuse license specific to the data file has not been verified here; the article’s CC BY license does not automatically carry over to the data package.',
    modelStatus: anatomyModelEn, relation: referenceOnlyEn,
  },
  hemibrain2020: {
    title: 'Hemibrain 2020 · part of the adult female central brain', shortTitle: 'Hemibrain · 2020',
    stage: adultEn, sex: 'Female',
    scope: { label: 'Partial central brain', region: 'A part of the central brain; not the whole brain, the whole of the optic lobes or the VNC.' },
    reconstruction: { label: 'A single adult female specimen', note: 'Complete or partial neuron reconstructions; there are also cell fragments cut off at the volume boundaries.' },
    version: 'Scheffer 2020 · count scope reported by the publication',
    counts: [neuronsEn('The publication’s approximate neuron count; additional truncated cell fragments exist separately.'),
      { label: 'Chemical synapses', definition: 'The publication’s count among about 25 thousand neurons; not the same denominator as all PSD/T-bar counts in the volume.' }],
    limitations: ['Do not confuse the truncated fragments, the total PSD count of the volume and the synapse count among the publication’s neurons with one another.', 'Later portal versions do not automatically update this 2020 publication count.'],
    chemicalCoverage: 'Segmentation, skeletons, synapse locations and their partners; anatomical mapping alone is not behavior.',
    gapCoverage: 'The chemical map is not a measurement of gap dynamics or of comprehensive electrical connections; no absence of gap junctions is claimed.',
    access: { label: 'Janelia · Hemibrain', note: 'neuPrint queries, skeletons and morphology access are available; some API operations may require an account/token.' },
    licenseNote: 'The data license on the Janelia data page was verified; its scope is this publication data record.',
    modelStatus: anatomyModelEn, relation: referenceOnlyEn,
  },
  flywire2024: {
    title: 'FlyWire 2024 · the whole adult female brain', shortTitle: 'FlyWire · 2024',
    stage: adultEn, sex: 'Female',
    scope: { label: 'Whole adult brain', region: 'Central brain and optic lobes; not the ventral nerve cord, the whole CNS or the animal’s body.' },
    reconstruction: { label: 'A single FAFB specimen', note: 'Proofread segmentation and morphology; not an average that represents different animals or individual variability.' },
    version: '2024 publication · FlyWire 783 / connection archive 783.0',
    counts: [neuronsEn('The proofread neurons in this publication record; not to be confused with different current query versions.'),
      { label: 'Chemical synapses', definition: 'About 54.5 million chemical synapses among these neurons; not the number of distinct cell pairs.' }],
    limitations: ['If the version, annotation and threshold filters change, the count can change too. Do not equate the unproofread fragment contacts in the archive with the 54.5 million synapses of the publication.', 'Neurotransmitter predictions do not mean a measured receptor, time constant or validated behavior.'],
    chemicalCoverage: 'Chemical EM connections, morphology and annotations; some transmitter annotations are predictions.',
    gapCoverage: 'Electrical synapses are not included in this chemical connection record; this does not show that the animal has no gap junctions.',
    access: { label: 'FlyWire · Codex and versioned archive', note: 'Codex requires signing in with a Google account. Static access to the 783.0 connection archive is a separate route; the atlas downloads neither.' },
    licenseNote: 'The Zenodo metadata license of this pinned 783.0 connection archive is CC BY 4.0. The current general FlyWire guidelines, however, say CC BY-NC 4.0; keep the difference in scope and, in any future download or sharing, review the terms of the relevant files together. The article license is handled separately.',
    modelStatus: anatomyModelEn, relation: referenceOnlyEn,
  },
  'male-cns2026': {
    title: 'Male CNS 2026 · adult male central nervous system', shortTitle: 'Male CNS · 2026',
    stage: adultEn, sex: 'Male',
    scope: { label: 'Brain and ventral nerve cord', region: 'Central nervous system: brain + VNC; not the whole animal’s body or the entire peripheral nervous system.' },
    reconstruction: { label: 'A single adult male specimen', note: 'The same CNS reconstruction of the brain and the nerve cord; not the same specimen or scope as the FlyWire female brain.' },
    version: 'Male CNS v1.0 · 8 June 2026; Cell · 3 September 2026',
    counts: [neuronsEn('The proofread CNS neuron count reported in the publication; it covers the brain, the optic lobes and the ventral nerve cord. The second version of the preprint reports 166,691; the 166,700 in the publication may be rounded.')],
    limitations: ['Do not equate the scope of the whole brain with that of the whole CNS; the additional nerve cord is a different anatomical region.', 'This catalog downloads no new data; it keeps the portal version and the publication count apart.'],
    chemicalCoverage: 'Chemical connections mapped with EM; they should be read against the source publication and not confused with the denominator of the brain-only record.',
    gapCoverage: 'This record offers no verified comprehensive map of electrical connections; no biological absence of gap junctions is asserted.',
    access: { label: 'Janelia · Male CNS data', note: 'There are static file links. The neuPrint API requires an account/token; this atlas loads no data. An approximate total of chemical contacts is not asserted here as a numeric measure.' },
    licenseNote: 'The data license on the official Male CNS data page was verified as CC BY 4.0; it is read with version v1.0.',
    modelStatus: anatomyModelEn, relation: referenceOnlyEn,
  },
}

function withText(record: AtlasRecord, text: AtlasRecordText): AtlasRecord {
  if (text.counts.length !== record.counts.length || text.limitations.length !== record.limitations.length) throw new RangeError(`English atlas text does not match record ${record.id}.`)
  return {
    ...record, title: text.title, shortTitle: text.shortTitle,
    stage: { ...record.stage, label: text.stage }, sex: { ...record.sex, label: text.sex },
    scope: { ...record.scope, ...text.scope }, reconstruction: { ...record.reconstruction, ...text.reconstruction },
    version: { ...record.version, label: text.version },
    counts: record.counts.map((metric, index) => ({ ...metric, ...text.counts[index]! })),
    limitations: text.limitations, chemicalCoverage: text.chemicalCoverage, gapCoverage: text.gapCoverage,
    access: { ...record.access, ...text.access }, license: { ...record.license, note: text.licenseNote },
    modelStatus: { ...record.modelStatus, label: text.modelStatus },
    circuitiaryRelation: { ...record.circuitiaryRelation, ...text.relation },
    sources: record.sources.map(source => sourcesEn[source.id]!),
  }
}

/** The same records in English: identical ids, order, numbers, units, urls and pinned versions. */
export const atlasRecordsEn: typeof atlasRecords = freezeTree(atlasRecords.map(record => withText(record, recordTextEn[record.id])))

/** The record in the current language. */
export function recordFor(id: string): AtlasRecord {
  const record = L(atlasRecords, atlasRecordsEn).find(candidate => candidate.id === id)
  if (!record) throw new RangeError(`Unknown atlas record ID: ${String(id)}.`)
  return record
}

/** The records of a species in the current language; `'all'` returns the whole catalog of that language. */
export function recordsForSpecies(species: 'all' | AtlasSpeciesId): readonly AtlasRecord[] {
  const records = L(atlasRecords, atlasRecordsEn)
  if (species === 'all') return records
  if (!speciesOptions.some(option => option.id === species)) throw new RangeError(`Unknown atlas species ID: ${String(species)}.`)
  return freezeTree(records.filter(record => record.speciesId === species))
}

type ContextField = 'species' | 'stage' | 'sex' | 'scope' | 'reconstruction'
/** Capitalises a phrase that opens a sentence, by the rules of the current language (Turkish i → İ, English i → I). */
const capitalise = (phrase: string): string => phrase.charAt(0).toLocaleUpperCase(localeTag()) + phrase.slice(1)
const listed = (names: readonly string[], and: string): string => `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]!}`

const comparisonText = defineMessages({
  tr: {
    fields: { species: 'Tür', stage: 'Yaşam evresi', sex: 'Cinsiyet', scope: 'Kapsam', region: 'Anatomik bölge', reconstruction: 'Rekonstrüksiyon',
      version: 'Sabitlenen kayıt', license: 'Veri lisansı', model: 'Model durumu', relation: 'Circuitiary ile ilişkisi' },
    licenseUnverified: 'Doğrulanmadı',
    context: { species: 'tür', stage: 'evre', sex: 'cinsiyet', scope: 'kapsam', reconstruction: 'rekonstrüksiyon' } as Record<ContextField, string>,
    counts: { neurons: 'Nöron sayımı', chemical: 'Kimyasal bağlantı niceliği', gap: 'Gap bağlantı niceliği' } as Record<AtlasCountKind, string>,
    notGivenInBoth: 'Bu nicelik iki kayıtta birden verilmemiştir. Eksik bilgi sıfır bağlantı anlamına gelmez.',
    differentUnits: 'Birimler farklıdır. EM kesiti ağırlığı, hücre çifti, sinaptik nokta ve kimyasal sinaps birbirinin yerine geçmez; oran hesaplanmaz.',
    sameRecord: 'Aynı sabitlenmiş kayıt iki kez seçildi; burada ayrı iki örnek veya deney yoktur.',
    noTotal: 'Ortak birim olsa da sayısal toplam ileri sürülmemiştir; boş değer sıfır değildir.',
    contextDiffers: (names: readonly string[]) => `Birim aynı, örnek ve anatomik bağlam farklıdır. ${capitalise(names.length === 1 ? `${names[0]!} farkı` : `${listed(names, 've')} farkları`)} nedeniyle bu sayılar işlev veya kapasite sıralaması oluşturmaz.`,
    scopeAligned: 'Birim ve belirtilen kapsam örtüşür; sayı yine kayıt tanımı ve sürümüyle okunur, işlevsel eşdeğerlik veya davranış sonucu çıkarılmaz.',
  },
  en: {
    fields: { species: 'Species', stage: 'Life stage', sex: 'Sex', scope: 'Scope', region: 'Anatomical region', reconstruction: 'Reconstruction',
      version: 'Pinned record', license: 'Data license', model: 'Model status', relation: 'Relation to Circuitiary' },
    licenseUnverified: 'Not verified',
    context: { species: 'species', stage: 'stage', sex: 'sex', scope: 'scope', reconstruction: 'reconstruction' },
    counts: { neurons: 'Neuron count', chemical: 'Chemical connection quantity', gap: 'Gap connection quantity' },
    notGivenInBoth: 'This quantity is not given in both records. Missing information does not mean zero connections.',
    differentUnits: 'The units differ. EM section weight, cell pair, synaptic site and chemical synapse do not stand in for one another; no ratio is calculated.',
    sameRecord: 'The same pinned record was selected twice; there are not two separate specimens or experiments here.',
    noTotal: 'Although the unit is shared, no numeric total is asserted; an empty value is not zero.',
    contextDiffers: names => `The unit is the same; the specimen and the anatomical context differ. ${capitalise(names.length === 1 ? `a ${names[0]!} difference means` : `${listed(names, 'and')} differences mean`)} these numbers do not form a ranking of function or capacity.`,
    scopeAligned: 'The unit and the stated scope coincide; the number is still read with the record definition and version, and no functional equivalence or behavioral result is inferred.',
  },
})

const comparisonFields = [
  ['species', (record: AtlasRecord) => speciesOptions.find(option => option.id === record.speciesId)!.label],
  ['stage', (record: AtlasRecord) => record.stage.label],
  ['sex', (record: AtlasRecord) => record.sex.label],
  ['scope', (record: AtlasRecord) => record.scope.label],
  ['region', (record: AtlasRecord) => record.scope.region],
  ['reconstruction', (record: AtlasRecord) => record.reconstruction.label],
  ['version', (record: AtlasRecord) => record.version.label],
  ['license', (record: AtlasRecord) => record.license.name ?? pick(comparisonText).licenseUnverified],
  ['model', (record: AtlasRecord) => record.modelStatus.label],
  ['relation', (record: AtlasRecord) => record.circuitiaryRelation.label],
] as const

// One list decides both whether two records share a context and which differences the count note names.
// Structural fields only: the free-text region wording is descriptive, so it neither blocks alignment nor counts as a scope difference.
const contextChecks: readonly (readonly [ContextField, (left: AtlasRecord, right: AtlasRecord) => boolean])[] = [
  ['species', (left, right) => left.speciesId === right.speciesId],
  ['stage', (left, right) => left.stage.id === right.stage.id],
  ['sex', (left, right) => left.sex.id === right.sex.id],
  ['scope', (left, right) => left.scope.coverage === right.scope.coverage],
  ['reconstruction', (left, right) => left.reconstruction.kind === right.reconstruction.kind],
]

/** Descriptive comparison only: no ratios or inferred functional superiority. Records and sentences are in the current language. */
export function buildComparison(leftId: string, rightId: string): AtlasComparison {
  return compareRecords(recordFor(leftId), recordFor(rightId))
}

/** Compares two records directly; `buildComparison` resolves catalog IDs first. Row labels and notes are in the current language. */
export function compareRecords(left: AtlasRecord, right: AtlasRecord): AtlasComparison {
  const text = pick(comparisonText)
  const sameRecord = left.id === right.id
  const contextDifferences = contextChecks.filter(([, same]) => !same(left, right)).map(([field]) => text.context[field])
  const countRows = (['neurons', 'chemical', 'gap'] as const).map(kind => {
    const leftMetric = left.counts.find(metric => metric.kind === kind) ?? null
    const rightMetric = right.counts.find(metric => metric.kind === kind) ?? null
    let classification: AtlasCountClassification
    let note: string
    if (!leftMetric || !rightMetric) {
      classification = 'missing'; note = text.notGivenInBoth
    } else if (leftMetric.unit !== rightMetric.unit) {
      classification = 'different-units'; note = text.differentUnits
    } else if (sameRecord) {
      classification = 'same-record'; note = text.sameRecord
    } else if (leftMetric.value === null || rightMetric.value === null) {
      classification = 'missing'; note = text.noTotal
    } else if (contextDifferences.length) {
      classification = 'same-unit-context-differs'; note = text.contextDiffers(contextDifferences)
    } else {
      classification = 'same-unit-scope-aligned'; note = text.scopeAligned
    }
    return { kind, label: text.counts[kind], leftMetric, rightMetric, classification, note }
  })
  return freezeTree({ left, right, sameRecord,
    rows: comparisonFields.map(([key, value]) => ({ key, label: text.fields[key], left: value(left), right: value(right), different: value(left) !== value(right) })), countRows })
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

// English: the text of each question; ids, option ids, the correct option and the sources are read from the Turkish questions.
const questionTextEn: Readonly<Record<AtlasQuestion['id'], { readonly prompt: string; readonly options: Readonly<Record<string, string>>; readonly explanation: string }>> = {
  scope: { prompt: 'What does “whole adult brain” cover for FlyWire 2024?',
    options: { wholeAnimal: 'The brain, the nerve cord and the animal’s whole body', brainOnly: 'The brain; the VNC and the whole CNS are separate scopes', allIndividuals: 'The one common brain of all individuals of the species' },
    explanation: 'The FlyWire record is a single adult female brain. The brain and optic lobes are not the whole CNS, which includes the ventral nerve cord as well; Male CNS is a different specimen and scope.' },
  units: { prompt: 'How do you compare the EM section weight of Cook SI5 with FlyWire’s synapse count?',
    options: { divideCounts: 'I divide the two numbers and find the connection strength', differentUnits: 'I state that they are different quantities and form no direct ratio', bothSynapses: 'I treat both as the same synapse count' },
    explanation: 'An SI5 weight carries the size and the number of connections in the sections together. A synapse count, a section weight and a count of distinct cell pairs are separate quantities.' },
  subset: { prompt: 'What do the 30 cells in Circuitiary’s current real data circuit represent?',
    options: { wholeWorm: 'The whole nervous system of C. elegans', selectedSubset: 'A subnetwork selected from the Cook hermaphrodite record, with its outside connections missing', flySubset: 'The entire FlyWire adult brain' },
    explanation: 'The 30 neurons, with 196 directed chemical and 50 physical gap pairs, are the internal records of the current selection. This is not the same scope as the 302 neurons in the whole hermaphrodite record.' },
  model: { prompt: 'What does it take to go from an anatomical map to a behavior simulation?',
    options: { wiringEnough: 'The wiring map alone is enough; behavior is validated automatically', dynamicsAndValidation: 'Dynamic assumptions, stimulus/body context and independent biological validation', moreNeurons: 'Just counting more neurons' },
    explanation: 'Anatomy constrains the transmission relations; receptors, signs, time constants and interaction with the body do not follow from the map alone. The model output must be tested separately against biological measurement.' },
}

/** The same questions in English: identical ids, option ids, correct options and sources. */
export const atlasQuestionsEn: typeof atlasQuestions = freezeTree(atlasQuestions.map(question => {
  const text = questionTextEn[question.id]
  if (Object.keys(text.options).length !== question.options.length) throw new RangeError(`English atlas text does not match question ${question.id}.`)
  return { ...question, prompt: text.prompt, explanation: text.explanation,
    options: question.options.map(option => {
      const label = text.options[option.id]
      if (label === undefined) throw new RangeError(`No English label for option ${option.id} of atlas question ${question.id}.`)
      return { id: option.id, label }
    }) }
}))

/** Whether the option is correct, with the explanation in the current language. */
export function answerAtlasQuestion(questionId: string, optionId: string): Readonly<{ correct: boolean; explanation: string }> {
  const question = L(atlasQuestions, atlasQuestionsEn).find(candidate => candidate.id === questionId)
  if (!question) throw new RangeError(`Unknown atlas question ID: ${String(questionId)}.`)
  if (!question.options.some(option => option.id === optionId)) throw new RangeError(`Unknown option for atlas question ${questionId}: ${String(optionId)}.`)
  return freezeTree({ correct: optionId === question.correctOptionId, explanation: question.explanation })
}
