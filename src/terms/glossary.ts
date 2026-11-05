export interface TermSource { title: string; url: string }
export interface GlossaryTerm {
  id: string
  title: string
  aliases: string[]
  meaning: string
  origin: string
  context?: string
  sources: TermSource[]
}
const mw = (word: string): TermSource => ({ title: `Merriam-Webster · ${word}`, url: `https://www.merriam-webster.com/dictionary/${word}` })
const academy = (word: string, article: string): TermSource => ({ title: `Académie française · ${word}`, url: `https://www.dictionnaire-academie.fr/article/${article}` })

// Meanings and word histories are paraphrased from the linked sources.
// These roots do not assert a particular route of borrowing into Turkish.
export const glossaryTerms: readonly GlossaryTerm[] = [
  {
    id: 'hermafrodit', title: 'Hermafrodit', aliases: ['hermafrodit'],
    meaning: 'Hem erkek hem dişi üreme hücreleri üretebilen canlı için kullanılan biyoloji terimi.',
    origin: 'Eski Yunanca Hermaphroditos özel adından gelir. Mitolojide Hermes ile Aphrodite’nin (Afrodit) çocuğunun adıdır; bu iki adın birleşimini taşır.',
    context: 'Türler atlasında C. elegans kaydının üreme biçimini belirtir. Bu hayvan önce sperm, ardından yumurta hücreleri üretir; kendi spermiyle döllenebilir.',
    sources: [academy('hermaphrodite', 'A9H0546'), { title: 'WormAtlas · Üreme sistemi', url: 'https://www.wormatlas.org/hermaphrodite/reproductive/mainframe.htm' }],
  },
  {
    id: 'noron', title: 'Nöron', aliases: ['nöron'],
    meaning: 'Sinir sisteminde bilgi alan, işleyen ve başka hücrelere ileten sinir hücresi.',
    origin: 'Eski Yunanca neuron sözcüğü sinir, kiriş veya tendon gibi anlamlar taşır. Modern sinir hücresi adı bu eski sözcükten geliştirilmiştir.',
    context: 'Projede bir graf düğümü bir hücreyi temsil eder; çizilen küre hücrenin gerçek biçimi değildir.',
    sources: [{ title: 'Brain · Etymology and the neuron(e)', url: 'https://academic.oup.com/brain/article/143/1/374/5679563' }],
  },
  {
    id: 'dendrit', title: 'Dendrit', aliases: ['dendrit'],
    meaning: 'Birçok nöronda girdilerin alındığı, dallanabilen hücre uzantısı.',
    origin: 'Eski Yunanca dendritēs, “ağaçla ilgili” anlamındadır. Adlandırma, uzantıların ağaç dallarına benzeyen görünümünü çağrıştırır.',
    sources: [academy('dendrite', 'A9D1331')],
  },
  {
    id: 'akson', title: 'Akson', aliases: ['akson'],
    meaning: 'Birçok nöronda sinyali hücre gövdesinden diğer hücrelere doğru taşıyan uzantı.',
    origin: 'Eski Yunanca axōn, “eksen, mil” anlamındadır. Modern anatomi terimi bu kökten türetilmiştir.',
    sources: [academy('axone', 'A9A3488')],
  },
  {
    id: 'soma', title: 'Soma', aliases: ['soma'],
    meaning: 'Nöronun hücre gövdesi.',
    origin: 'Eski Yunanca sōma, “beden, gövde” demektir. Biyolojideki kullanımı bu köke dayanır.',
    sources: [mw('soma')],
  },
  {
    id: 'sinaps', title: 'Sinaps', aliases: ['sinaps', 'sinaptik'],
    meaning: 'Bir nöron ile başka bir hücre arasında bilgi iletimini sağlayan bağlantı bölgesi. “Sinaptik”, bu bağlantıyla ilgili demektir.',
    origin: 'Eski Yunanca synapsis, “birleştirme, birleşme” anlamındadır; syn (“birlikte”) ve haptein (“bağlamak”) kökleriyle ilişkilidir.',
    context: 'Kimyasal sinaps ile elektriksel sinaps farklı iletim mekanizmaları kullanır. Kaynaktaki EM kesiti ağırlığı doğrudan sinaps sayısı değildir.',
    sources: [academy('synapse', 'A9S3868')],
  },
  {
    id: 'konnektom', title: 'Konnektom', aliases: ['konnektom', 'connectome'],
    meaning: 'Bir sinir sisteminin yapısal bağlantılarının kapsamlı haritası.',
    origin: 'İngilizce connection (“bağlantı”) ve genome (“genom”) adlandırmasına benzetilerek oluşturulmuştur. Sporns ve arkadaşları ile Hagmann tarafından 2005’te bağımsız olarak önerilmiştir.',
    context: 'Projede kullanılan 30 hücrelik seçilmiş alt ağ, hayvanın bütün konnektomu değildir.',
    sources: [{ title: 'Olaf Sporns · Connectome', url: 'https://www.scholarpedia.org/article/Connectome' }],
  },
  {
    id: 'gap-junction', title: 'Gap junction', aliases: ['gap junction', 'gap junctions'],
    meaning: 'Komşu hücreler arasında doğrudan iyon ve küçük molekül geçişine olanak veren kanallı bağlantı.',
    origin: 'İngilizce gap “aralık”, junction “birleşme yeri” demektir. Adı, elektron mikroskobunda hücre zarları arasında görülen dar aralıktan gelir.',
    context: 'Projede bir fiziksel gap çifti tek yönsüz bağlantı olarak gösterilir. Her biyolojik bağlantının iki yönde eşit ilettiği varsayılmaz.',
    sources: [{ title: 'Journal of Cell Biology · Defining gap junctions', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2254793/' }, { title: 'NLM MeSH · Gap Junctions', url: 'https://www.ncbi.nlm.nih.gov/mesh/D017629' }],
  },
  {
    id: 'ablasyon', title: 'Ablasyon', aliases: ['ablasyon'],
    meaning: 'Bir hücreyi veya dokuyu çıkarma ya da işlevini ortadan kaldırma müdahalesi.',
    origin: 'Latince ablatio, “alıp götürme, çıkarma” anlamındadır; auferre (“uzaklaştırmak”) fiiliyle ilişkilidir.',
    context: 'Tek bir bağlantının model katkısını sıfırlamak, bütün hücreyi kaldırmakla aynı müdahale değildir.',
    sources: [mw('ablation')],
  },
  {
    id: 'larva', title: 'Larva', aliases: ['larva', 'larval'],
    meaning: 'Bazı hayvanların erişkin biçiminden önceki gelişim evresi.',
    origin: 'Latince larva sözcüğünün “hayalet, ruh” ve “maske” anlamları vardır. Biyolojideki larva adı bu eski sözcükten alınmıştır.',
    context: 'Atlasta L1, ilk larva evresini belirtir. Larva ve erişkin kayıtları aynı gelişim evresini anlatmaz.',
    sources: [mw('larva')],
  },
  {
    id: 'ventral', title: 'Ventral', aliases: ['ventral'],
    meaning: 'Hayvanın karın tarafına ilişkin anatomik yön.',
    origin: 'Latince venter (“karın”) ve bundan türeyen ventralis sözcüğüne dayanır.',
    context: 'VNC, İngilizce ventral nerve cord ifadesinin kısaltmasıdır: ventral sinir kordonu. Bu yön, ekrandaki aşağı yönü ifade etmez.',
    sources: [mw('ventral')],
  },
  {
    id: 'dorsal', title: 'Dorsal', aliases: ['dorsal'],
    meaning: 'Hayvanın sırt tarafına ilişkin anatomik yön.',
    origin: 'Latince dorsum, “sırt” demektir; dorsal bu kökten gelir.',
    context: 'Anatomik yön, şematik 2D/3D çizimdeki kamera yönünden bağımsızdır.',
    sources: [mw('dorsal')],
  },
  {
    id: 'ganglion', title: 'Ganglion', aliases: ['ganglion', 'gangliyon'],
    meaning: 'Sinir hücresi gövdelerini içeren sinir dokusu topluluğu.',
    origin: 'Eski Yunanca ganglion, şişlik ve sinir dokusu kütlesi anlamlarında kullanılmıştır. Sözcüğün daha eski kökeni kesin değildir.',
    sources: [mw('ganglion')],
  },
  {
    id: 'reseptor', title: 'Reseptör', aliases: ['reseptör'],
    meaning: 'Bu derslerde, belirli bir iletici moleküle bağlanarak hücresel yanıtı etkileyen alıcı molekül.',
    origin: 'Fransızca récepteur sözcüğünün kökü Latince recipere, “almak, kabul etmek” fiiline dayanır.',
    sources: [{ title: 'CNRTL · Récepteur sözcüğünün kökeni', url: 'https://www.cnrtl.fr/etymologie/r%C3%A9cepteur' }, mw('receptor')],
  },
  {
    id: 'plastisite', title: 'Plastisite', aliases: ['plastisite'],
    meaning: 'Sinir bağlantılarının ve etkilerinin deneyime veya geçmiş etkinliğe bağlı değişebilme özelliği.',
    origin: 'Eski Yunanca plastikos (“biçim verilebilen”) ve plassein (“biçim vermek”) kökleriyle ilişkilidir.',
    context: 'Circuitiary’nin mevcut sayısal motorunda öğrenmeye bağlı bağlantı değişimi hesaplanmaz.',
    sources: [mw('plastic'), mw('plasticity')],
  },
]

export interface TermSegment { text: string; term?: GlossaryTerm }
const byAlias = new Map(glossaryTerms.flatMap(term => term.aliases.map(alias => [alias.toLocaleLowerCase('tr-TR'), term] as const)))
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const aliases = [...byAlias.keys()].sort((a, b) => b.length - a.length).map(escapeRegex)
// Restrict endings so similar words (e.g. Somali, sinapsis) are not annotated.
const suffixes = ['', 'ı', 'i', 'u', 'ü', 'a', 'e', 'ın', 'in', 'un', 'ün', 'da', 'de', 'ta', 'te', 'dan', 'den', 'tan', 'ten', 'nın', 'nin', 'nun', 'nün', 'na', 'ne', 'nı', 'ni', 'nu', 'nü', 'nda', 'nde', 'ndan', 'nden', 'la', 'le', 'yla', 'yle', 'ıyla', 'iyle', 'uyla', 'üyle', 'sı', 'si', 'su', 'sü', 'dır', 'dir', 'dur', 'dür', 'ında', 'inde', 'unda', 'ünde', 'ından', 'inden', 'undan', 'ünden', 'ına', 'ine', 'una', 'üne', 'ını', 'ini', 'unu', 'ünü', 'ının', 'inin', 'unun', 'ünün']
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${aliases.join('|')})(?:[’']?(?:lar|ler)?(?:${suffixes.sort((a, b) => b.length - a.length).join('|')}))(?![\\p{L}\\p{N}_])`, 'gu')

export function splitTerms(value: unknown): TermSegment[] {
  const text = value == null ? '' : String(value)
  const lower = text.toLocaleLowerCase('tr-TR')
  // Each occurrence is explicit Vue content; no HTML parsing or DOM rewriting.
  const segments: TermSegment[] = []
  let cursor = 0
  const seen = new Set<string>()
  for (const match of lower.matchAll(pattern)) {
    const term = byAlias.get(match[1]!)!
    if (seen.has(term.id)) continue
    seen.add(term.id)
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) })
    segments.push({ text: text.slice(match.index, match.index + match[0].length), term })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}
