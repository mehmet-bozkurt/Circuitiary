import { locale } from '../i18n'

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

// English twin: the same ids in the same order. Translated from the Turkish entries above, which stay the source text.
// The same caution applies: these roots do not assert a particular route of borrowing into English.
// Aliases are the forms English prose uses (singular, plural, adjective); they are what splitTerms annotates in English text.
export const glossaryTermsEn: readonly GlossaryTerm[] = [
  {
    id: 'hermafrodit', title: 'Hermaphrodite', aliases: ['hermaphrodite', 'hermaphrodites'],
    meaning: 'A biology term for an organism that can produce both male and female reproductive cells.',
    origin: 'It comes from the Ancient Greek proper name Hermaphroditos. In mythology it is the name of the child of Hermes and Aphrodite; it combines the two names.',
    context: 'In the species atlas it states the reproductive mode of the C. elegans record. This animal first produces sperm, then egg cells; it can be fertilized by its own sperm.',
    sources: [academy('hermaphrodite', 'A9H0546'), { title: 'WormAtlas · Reproductive system', url: 'https://www.wormatlas.org/hermaphrodite/reproductive/mainframe.htm' }],
  },
  {
    id: 'noron', title: 'Neuron', aliases: ['neuron', 'neurons'],
    meaning: 'A nerve cell that receives information in the nervous system, processes it and passes it on to other cells.',
    origin: 'The Ancient Greek word neuron carries meanings such as nerve, sinew or tendon. The modern name for the nerve cell was developed from this old word.',
    context: 'In the project a graph node represents one cell; the sphere that is drawn is not the real shape of the cell.',
    sources: [{ title: 'Brain · Etymology and the neuron(e)', url: 'https://academic.oup.com/brain/article/143/1/374/5679563' }],
  },
  {
    id: 'dendrit', title: 'Dendrite', aliases: ['dendrite', 'dendrites', 'dendritic'],
    meaning: 'In many neurons, a cell extension that can branch and where inputs are received.',
    origin: 'Ancient Greek dendritēs means “relating to a tree”. The name evokes the way the extensions look like the branches of a tree.',
    sources: [academy('dendrite', 'A9D1331')],
  },
  {
    id: 'akson', title: 'Axon', aliases: ['axon', 'axons', 'axonal'],
    meaning: 'In many neurons, the extension that carries the signal from the cell body toward other cells.',
    origin: 'Ancient Greek axōn means “axis, axle”. The modern anatomical term is derived from this root.',
    sources: [academy('axone', 'A9A3488')],
  },
  {
    id: 'soma', title: 'Soma', aliases: ['soma', 'somas', 'somata'],
    meaning: 'The cell body of a neuron.',
    origin: 'Ancient Greek sōma means “body”. Its use in biology rests on this root.',
    sources: [mw('soma')],
  },
  {
    id: 'sinaps', title: 'Synapse', aliases: ['synapse', 'synapses', 'synaptic'],
    meaning: 'The connection site between a neuron and another cell where information is passed on. “Synaptic” means relating to this connection.',
    origin: 'Ancient Greek synapsis means “joining, union”; it is related to the roots syn (“together”) and haptein (“to fasten”).',
    context: 'A chemical synapse and an electrical synapse use different transmission mechanisms. The EM section weight in the source is not directly a synapse count.',
    sources: [academy('synapse', 'A9S3868')],
  },
  {
    id: 'konnektom', title: 'Connectome', aliases: ['connectome', 'connectomes'],
    meaning: 'A comprehensive map of the structural connections of a nervous system.',
    origin: 'It was formed from the English word connection by analogy with the name genome. It was proposed independently in 2005 by Sporns and colleagues and by Hagmann.',
    context: 'The selected 30-cell subnetwork used in the project is not the animal’s whole connectome.',
    sources: [{ title: 'Olaf Sporns · Connectome', url: 'https://www.scholarpedia.org/article/Connectome' }],
  },
  {
    id: 'gap-junction', title: 'Gap junction', aliases: ['gap junction', 'gap junctions'],
    meaning: 'A connection with channels that lets ions and small molecules pass directly between neighboring cells.',
    origin: 'In English, gap means an opening or space and junction a place of joining. The name comes from the narrow gap seen between cell membranes under the electron microscope.',
    context: 'In the project a physical gap pair is shown as one undirected connection. It is not assumed that every biological connection conducts equally in both directions.',
    sources: [{ title: 'Journal of Cell Biology · Defining gap junctions', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2254793/' }, { title: 'NLM MeSH · Gap Junctions', url: 'https://www.ncbi.nlm.nih.gov/mesh/D017629' }],
  },
  {
    id: 'ablasyon', title: 'Ablation', aliases: ['ablation', 'ablations'],
    meaning: 'An intervention that removes a cell or tissue, or abolishes its function.',
    origin: 'Latin ablatio means “carrying away, removal”; it is related to the verb auferre (“to take away”).',
    context: 'Setting the model contribution of a single connection to zero is not the same intervention as removing the whole cell.',
    sources: [mw('ablation')],
  },
  {
    id: 'larva', title: 'Larva', aliases: ['larva', 'larvae', 'larval'],
    meaning: 'The developmental stage of some animals that comes before the adult form.',
    origin: 'The Latin word larva has the meanings “ghost, spirit” and “mask”. The name larva in biology was taken from this old word.',
    context: 'In the atlas, L1 denotes the first larval stage. Larval and adult records do not describe the same developmental stage.',
    sources: [mw('larva')],
  },
  {
    id: 'ventral', title: 'Ventral', aliases: ['ventral'],
    meaning: 'The anatomical direction relating to the belly side of the animal.',
    origin: 'It rests on Latin venter (“belly”) and the word ventralis derived from it.',
    context: 'VNC is the abbreviation of ventral nerve cord. This direction does not mean the downward direction on the screen.',
    sources: [mw('ventral')],
  },
  {
    id: 'dorsal', title: 'Dorsal', aliases: ['dorsal'],
    meaning: 'The anatomical direction relating to the back side of the animal.',
    origin: 'Latin dorsum means “back”; dorsal comes from this root.',
    context: 'The anatomical direction is independent of the camera direction in the schematic 2D/3D drawing.',
    sources: [mw('dorsal')],
  },
  {
    id: 'ganglion', title: 'Ganglion', aliases: ['ganglion', 'ganglia'],
    meaning: 'A cluster of nervous tissue that contains nerve cell bodies.',
    origin: 'Ancient Greek ganglion was used in the senses of a swelling and a mass of nervous tissue. The earlier origin of the word is not certain.',
    sources: [mw('ganglion')],
  },
  {
    id: 'reseptor', title: 'Receptor', aliases: ['receptor', 'receptors'],
    meaning: 'In these lessons, a receiving molecule that binds a particular transmitter molecule and so affects the cellular response.',
    origin: 'The root of the French word récepteur goes back to the Latin verb recipere, “to take, to receive”.',
    sources: [{ title: 'CNRTL · Origin of the word récepteur', url: 'https://www.cnrtl.fr/etymologie/r%C3%A9cepteur' }, mw('receptor')],
  },
  {
    id: 'plastisite', title: 'Plasticity', aliases: ['plasticity'],
    meaning: 'The capacity of neural connections and their effects to change depending on experience or past activity.',
    origin: 'It is related to the Ancient Greek roots plastikos (“able to be shaped”) and plassein (“to shape”).',
    context: 'Circuitiary’s current numerical engine does not compute learning-dependent changes in connections.',
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

// English text: whole words only, no Turkish endings; a possessive ’s stays with the word, and a two-word alias may be hyphenated ("gap-junction pair").
const byAliasEn = new Map(glossaryTermsEn.flatMap(term => term.aliases.map(alias => [alias.toLocaleLowerCase('en-US'), term] as const)))
const aliasesEn = [...byAliasEn.keys()].sort((a, b) => b.length - a.length).map(alias => escapeRegex(alias).replace(/ /g, '[ -]'))
// Matched case-insensitively on the text itself: lower-casing it by Turkish rules would turn I into ı.
const patternEn = new RegExp(`(?<![\\p{L}\\p{N}_])(${aliasesEn.join('|')})(?:[’']s)?(?![\\p{L}\\p{N}_])`, 'giu')

/** Splits a text of the current interface language into plain parts and that language's glossary terms (first use of each term only). */
export function splitTerms(value: unknown): TermSegment[] {
  const text = value == null ? '' : String(value)
  const english = locale.value === 'en'
  // Turkish is matched on its Turkish lower-casing (same length as the text), English on the text itself.
  const matches = english ? text.matchAll(patternEn) : text.toLocaleLowerCase('tr-TR').matchAll(pattern)
  // Each occurrence is explicit Vue content; no HTML parsing or DOM rewriting.
  const segments: TermSegment[] = []
  let cursor = 0
  const seen = new Set<string>()
  for (const match of matches) {
    const term = english ? byAliasEn.get(match[1]!.toLocaleLowerCase('en-US').replace('-', ' ')) : byAlias.get(match[1]!)!
    if (!term || seen.has(term.id)) continue
    seen.add(term.id)
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) })
    segments.push({ text: text.slice(match.index, match.index + match[0].length), term })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}

/** The glossary page lists terms in Turkish alphabetical order (Ç, Ğ, İ, Ö, Ş, Ü sort after their base letters). */
const titleCollator = new Intl.Collator('tr')
export const glossaryAlphabetical: readonly GlossaryTerm[] = [...glossaryTerms].sort((a, b) => titleCollator.compare(a.title, b.title))
/** The same terms under their English titles, in English alphabetical order. */
const titleCollatorEn = new Intl.Collator('en')
export const glossaryAlphabeticalEn: readonly GlossaryTerm[] = [...glossaryTermsEn].sort((a, b) => titleCollatorEn.compare(a.title, b.title))
/** Fragment id of a term on the glossary page: /ogren/sozluk#term-<id>. */
export const termAnchorId = (id: string): string => `term-${id}`
