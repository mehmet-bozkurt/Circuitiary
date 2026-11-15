import { glossaryTerms, glossaryTermsEn, type GlossaryTerm } from '../terms/glossary'

// Every content constant here has an English twin (`…En`) with the same type, ids, order and lengths (docs/i18n.md, rule 3).
// A consumer chooses when rendering: `computed(() => L(lessonSections, lessonSectionsEn))`.

export const lessonSources = {
  seer: { title: 'NIH / NCI SEER — sinir dokusu ve nöronun parçaları', url: 'https://training.seer.cancer.gov/anatomy/nervous/tissue.html' },
  openstax: { title: 'Rice University / OpenStax — Nervous Tissue', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue' },
  membrane: { title: 'Purves ve ark. / NCBI — dinlenim zar potansiyeli', url: 'https://www.ncbi.nlm.nih.gov/books/NBK10931/' },
  action: { title: 'Purves ve ark. / NCBI — aksiyon potansiyeli', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11107/' },
  ions: { title: 'Alberts ve ark. / NCBI — iyon kanalları ve elektriksel özellikler', url: 'https://www.ncbi.nlm.nih.gov/books/NBK26910/' },
  release: { title: 'Purves ve ark. / NCBI — kimyasal sinaptik iletim', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11009/' },
  receptors: { title: 'Purves ve ark. / NCBI — nörotransmitter reseptörleri', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11099/' },
  inhibition: { title: 'Purves ve ark. / NCBI — uyarıcı ve baskılayıcı yanıtlar', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11117/' },
  plasticity: { title: 'Purves ve ark. / NCBI — kısa süreli sinaptik plastisite', url: 'https://www.ncbi.nlm.nih.gov/books/NBK10968/' },
  electrical: { title: 'Purves ve ark. / NCBI — elektriksel sinapslar', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11164/' },
  rectification: { title: 'Liu ve ark., 2017 — C. elegans bağlantılarında doğrultucu iletim', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5364397/' },
  graded: { title: 'Liu ve ark., 2009 — C. elegans nöromüsküler bağlantılarında dereceli iletim ve salım', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2705609/' },
  awa: { title: 'Liu ve ark., 2018 — AWA nöronunda kalsiyum aksiyon potansiyelleri', url: 'https://pubmed.ncbi.nlm.nih.gov/30220455/' },
  atlas: { title: 'Randi ve ark., 2023 — C. elegans işlevsel bağlantı atlası', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
}

/** Published titles of English-language sources stay as published; only the Turkish descriptions are translated. Addresses are identical. */
export const lessonSourcesEn: typeof lessonSources = {
  seer: { title: 'NIH / NCI SEER — nervous tissue and the parts of a neuron', url: 'https://training.seer.cancer.gov/anatomy/nervous/tissue.html' },
  openstax: { title: 'Rice University / OpenStax — Nervous Tissue', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-nervous-tissue' },
  membrane: { title: 'Purves et al. / NCBI — resting membrane potential', url: 'https://www.ncbi.nlm.nih.gov/books/NBK10931/' },
  action: { title: 'Purves et al. / NCBI — action potential', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11107/' },
  ions: { title: 'Alberts et al. / NCBI — ion channels and electrical properties', url: 'https://www.ncbi.nlm.nih.gov/books/NBK26910/' },
  release: { title: 'Purves et al. / NCBI — chemical synaptic transmission', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11009/' },
  receptors: { title: 'Purves et al. / NCBI — neurotransmitter receptors', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11099/' },
  inhibition: { title: 'Purves et al. / NCBI — excitatory and inhibitory responses', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11117/' },
  plasticity: { title: 'Purves et al. / NCBI — short-term synaptic plasticity', url: 'https://www.ncbi.nlm.nih.gov/books/NBK10968/' },
  electrical: { title: 'Purves et al. / NCBI — electrical synapses', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11164/' },
  rectification: { title: 'Liu et al., 2017 — rectifying transmission in C. elegans connections', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5364397/' },
  graded: { title: 'Liu et al., 2009 — graded transmission and release at C. elegans neuromuscular junctions', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2705609/' },
  awa: { title: 'Liu et al., 2018 — calcium action potentials in the AWA neuron', url: 'https://pubmed.ncbi.nlm.nih.gov/30220455/' },
  atlas: { title: 'Randi et al., 2023 — C. elegans functional connectivity atlas', url: 'https://www.nature.com/articles/s41586-023-06683-4' },
}

export type LessonSourceId = keyof typeof lessonSources

export interface NeuronPart { id: string; title: string; number: number; description: string; prompt: string }

export const neuronParts: readonly NeuronPart[] = [
  { id: 'dendrite', title: 'Dendrit', number: 1, description: 'Birçok nöronda girdilerin alındığı dallanmış uzantı. Gelen etkiler burada yerel gerilim değişikliklerine katkı verebilir. Her türün ve her nöronun aynı dendrit ağacına sahip olması gerekmez.', prompt: 'Birden fazla girdinin nerede buluşabileceğini düşün.' },
  { id: 'soma', title: 'Hücre gövdesi', number: 2, description: 'Soma; çekirdeği ve hücrenin yaşamasını sağlayan birçok yapıyı barındırır. Nöron, yalnızca bir elektrik kablosu değil, protein üreten ve enerji kullanan canlı bir hücredir.', prompt: 'Bakım ve sinyal işleme aynı hücrede bir aradadır.' },
  { id: 'axon', title: 'Akson', number: 3, description: 'Birçok nöronda sinyali hücre gövdesinden uzak bölgelere taşıyan uzantı. Aksiyon potansiyeli üreten hücrelerde zar boyunca yenilenen elektriksel olay ilerleyebilir. Bütün hayvan hücrelerinin bu çizime uyması gerekmez.', prompt: 'Bir sinyalin uzaktaki hedefe ulaşmasını düşün.' },
  { id: 'terminal', title: 'Sinaptik uç', number: 4, description: 'Kimyasal sinapsta iletici moleküllerin salınabildiği presinaptik bölge. Uç, aksonun sonunda bir hedef hücreye yaklaşır; hücreler işlevsel olarak iletişim kurar.', prompt: 'Elektriksel değişiklik burada kimyasal iletişime bağlanabilir.' },
  { id: 'cleft', title: 'Sinaptik aralık', number: 5, description: 'Kimyasal sinapstaki hücre zarları arasındaki dar bölge. İletici moleküller bu aralığı geçip hedefteki reseptörlere bağlanabilir. Elektriksel sinapsın mekanizması ise farklıdır.', prompt: 'Aralıkta görünen boşluk, iletişim olmadığı anlamına gelmez.' },
]

export const neuronPartsEn: typeof neuronParts = [
  { id: 'dendrite', title: 'Dendrite', number: 1, description: 'A branched extension where inputs are received in many neurons. Incoming effects can contribute to local voltage changes here. Not every species and not every neuron has to have the same dendritic tree.', prompt: 'Think about where more than one input could meet.' },
  { id: 'soma', title: 'Cell body', number: 2, description: 'The soma holds the nucleus and many of the structures that keep the cell alive. A neuron is not just an electrical cable; it is a living cell that makes proteins and uses energy.', prompt: 'Maintenance and signal processing exist side by side in the same cell.' },
  { id: 'axon', title: 'Axon', number: 3, description: 'An extension that, in many neurons, carries the signal to regions far from the cell body. In cells that produce action potentials, an electrical event that is regenerated along the membrane can travel. Not all animal cells have to fit this drawing.', prompt: 'Think about a signal reaching a distant target.' },
  { id: 'terminal', title: 'Synaptic terminal', number: 4, description: 'The presynaptic region where transmitter molecules can be released at a chemical synapse. At the end of the axon the terminal comes close to a target cell; the cells communicate functionally.', prompt: 'Here an electrical change can be linked to chemical communication.' },
  { id: 'cleft', title: 'Synaptic cleft', number: 5, description: 'The narrow region between the cell membranes at a chemical synapse. Transmitter molecules can cross this cleft and bind to receptors on the target. The mechanism of an electrical synapse, however, is different.', prompt: 'The gap you see at the cleft does not mean there is no communication.' },
]

export const lessonSections: {
  id: string; title: string; short: string; lead: string; paragraphs: string[]; sources: LessonSourceId[]
}[] = [
  {
    id: 'lesson-neuron', title: 'Nöronun parçaları', short: 'Nöronu tanı',
    lead: 'Önce bir hücreyi tanıyalım. Bağlantı haritasındaki bir nokta, gerçekte zarla çevrili, enerji kullanan ve farklı uzantıları olan canlı bir yapıdır.',
    paragraphs: [
      'Tipik bir nöron çiziminde hücre gövdesi, dendritler ve akson ayırt edilir. Dendritler birçok girdinin alındığı uzantılardır; akson birçok hücrede sinyali daha uzak bir bölgeye taşır. Sinaps, bir hücrenin başka bir hücreyi etkileyebildiği işlevsel temas bölgesidir. Bir nöronun çok sayıda bağlantısı olabilir.',
      'Bu çizim bir öğretim şemasıdır. Hücrelerin biçimi, büyüklüğü ve sinyal üretme özellikleri türlere ve hücre tiplerine göre değişir. İnsan ders kitaplarındaki tipik çok kutuplu çizimi, bütün solucan veya sinek nöronlarına bire bir uygulamayız. Glia gibi diğer hücreler de sinir dokusunun işleyişine katılır.',
      'Aşağıdaki parçaları seç. Sonra bir girdi, bu hücrede hangi bölgelere ulaşabilir diye düşün. Çizimdeki mesafe ve büyüklükler ölçüm değildir; burada öğrenilecek ilişki, parçanın adı ile işlevi arasındadır.',
    ], sources: ['seer', 'openstax'],
  },
  {
    id: 'lesson-signal', title: 'Zardan sinyale: yerel değişiklik ve eşik', short: 'Sinyali izle',
    lead: 'Zar potansiyeli, hücrenin içi ile dışı arasındaki elektriksel gerilim farkıdır. “Dinlenim”, bu farkın sıfır olması demek değildir.',
    paragraphs: [
      'İyonların hücre içinde ve dışında farklı dağılımı, zarın hangi iyonları geçirdiğiyle birlikte gerilim farkına katkı verir. Kanallar geçişi düzenler; pompalar iyon farklarının sürdürülmesine yardımcı olur. Depolarizasyon potansiyelin daha pozitif, hiperpolarizasyon daha negatif yöne değişmesidir. Bunlar bir değişikliğin yönünü anlatır.',
      'Yerel potansiyellerin büyüklüğü değişebilir; pasif olarak yayılırken zayıflayabilirler. Uygun bir hücrede eşik aşılınca aksiyon potansiyeli, zar boyunca kendini yenileyen bir olay olarak yayılabilir. Belirli koşullarda daha güçlü uyaran tekil olayın tepesini orantılı yükseltmek yerine olayların sayısını veya zamanlamasını değiştirebilir. Eşik ve olay biçimi biyolojik bağlama bağlıdır.',
      'Bu gösterimde önce uyaranı eşiğin altında tut, sonra eşiğe çıkar. Eşik üstündeki iki farklı uyaranı karşılaştır: tek olayın tepesinin aynı kaldığını gör. Uyaranı sıfıra indir. Burada yalnız bir eşik kararı ve bir çizim var; olay dizisi, ateşleme sıklığı, iyon kanalları veya gerçek gerilim hesaplanmıyor.',
    ], sources: ['membrane', 'action', 'ions'],
  },
  {
    id: 'lesson-chemical', title: 'Kimyasal sinaps: iletici ve reseptör', short: 'Kimyasal sinaps',
    lead: 'İki hücre arasındaki kimyasal iletişimi üç adımda izle: salım, bağlanma, yanıt.',
    paragraphs: [
      'Presinaptik uçtaki kalsiyum artışı, veziküllerden nörotransmitter salınmasına katkı verir. İletici molekül sinaptik aralıkta ilerler ve hedef hücrenin reseptörüne bağlanır. Reseptörün etkilediği kanallar ve hücrenin iyon koşulları, oluşan yanıtı belirler. Bu nedenle ileticinin adı tek başına her bağlantının etkisini söylemez.',
      '“Presinaptik” sinyali ileten tarafı, “postsinaptik” yanıtlayan tarafı anlatır. Bir kimyasal bağlantıyı grafikte A→B diye çizmek, bu ilişkinin yönünü kaydeder. Okun varlığı, B’nin kesin olarak olay üreteceğini veya davranışın ne olacağını belirlemez; etki büyüklüğü ve hücrenin o andaki durumu da gerekir.',
      'Sinaptik etki sabit olmak zorunda değildir. Yakın etkinlik geçmişine bağlı kısa süreli güçlenme veya zayıflama, plastisitenin örnekleridir. Bir modelde kaydırıcıyı elle değiştirmek ise kendiliğinden biyolojik plastisiteyi simüle etmez. Böyle bir model için geçmişi izleyen ve bağlantıyı değiştiren ayrıca tanımlanmış bir mekanizma gerekir.',
    ], sources: ['release', 'receptors', 'plasticity'],
  },
  {
    id: 'lesson-ei', title: 'Uyarıcı ve baskılayıcı etkileri ayır', short: 'Uyarıcı / baskılayıcı',
    lead: 'Bir etkiyi değerlendirirken yalnız okun yönüne veya gerilimin artıp azalmasına bakmak yeterli değildir.',
    paragraphs: [
      'Uyarıcı etki, ilgili koşullarda hedefin yanıt üretme olasılığını artırır; baskılayıcı etki azaltabilir. Bunun hangi yönde olacağı reseptöre, etkilenen kanallara ve iyon koşullarına bağlıdır. Aynı iletici farklı reseptörlerde farklı yanıtlar oluşturabilir. Bu yüzden anatomik bağlantıya gerekçesiz “artı” veya “eksi” işareti eklemeyiz.',
      'Baskılanma her zaman daha negatif gerilim demek değildir. Zar iletkenliğinin artması, başka bir uyarıcı girdinin gerilim etkisini azaltabilir: buna şönt baskılanması denir. Dinlenimde belirgin bir gerilim değişikliği olmadan da baskılayıcı etki görülebilir. Dolayısıyla gerilim yönü ile işlevsel etkiyi aynı şey saymayız.',
      'Aşağıda etkilerin işaretlerini bilerek biz atıyoruz. Önce yalnız uyarıcı girdiyi artır; sonra onu sabit tutup baskılayıcı girdiyi artır. Hangi miktarda çıktı sıfıra ulaşıyor? Bu basit çıkarma örneği net etkiyi öğretir; reseptörleri, iletkenlikleri veya gerçek şönt mekanizmasını çözmez.',
    ], sources: ['receptors', 'inhibition'],
  },
  {
    id: 'lesson-gap', title: 'Elektriksel sinaps: farkın yönü önemlidir', short: 'Elektriksel bağ',
    lead: 'Gap junction kanalları, hücreler arasında doğrudan iyon akımına olanak verir. İletici molekül salımı şart değildir.',
    paragraphs: [
      'Birçok elektriksel bağlantıda akım iki yönde akabilir; o andaki gerilim farkı yönü etkiler. Bazı bağlantılar iki yönde eşit iletmez, yani doğrultucu davranabilir. C. elegans’ta da belirli bağlantılar için bu asimetri ölçülmüştür. Bu bulguyu bütün elektriksel sinapsların aynı olduğu şeklinde genellemeyiz.',
      'Bu örnekte A yüksek, B düşük bir göreli düzeyden başlar. Simetrik bir bağ, farkı zamanla azaltır. Bağ kuvvetini sıfıra indirince hücrelerin başlangıçları korunur. Başlangıcı ters çevirince etki yönü değişir. Daha güçlü bağın aynı zamandaki farkı ne kadar küçülttüğünü sayısal değerlerden kontrol et.',
      'Gösterimde sızıntı, dış girdi ve doğrultma yoktur. A+B toplamının sabit kalması bu seçilmiş denklemlerin sonucudur; canlı bir hücrenin bütün iyon ve enerji süreçleri için böyle bir toplam yasası ileri sürmüyoruz. Zaman sürgüsü bir grafiği inceleme aracıdır, gerçek zamanlı deney kaydı değildir.',
    ], sources: ['electrical', 'rectification'],
  },
  {
    id: 'lesson-circuit', title: 'Üç hücreli devreden modelin sınırlarına', short: 'Küçük devre',
    lead: 'Şimdi tek bir hücre yerine A→B→C zincirini incele. Bir parametreyi değiştir, sonucu gör, sonra nedenini kendi cümlenle açıkla.',
    paragraphs: [
      'A, belirli bir süre dış girdi alıyor; B, A’dan etkileniyor; C de B’den etkileniyor. Her hücrenin yanıtı zaman içinde değişiyor. C’ye ayrıca sabit 0,35 taban girdisi veriyoruz: böylece baskılayıcı B→C bağlantısı, C’yi bu tabanın altına düşürebilir. A, B ve C gerçek hayvan hücre adları değildir; bütün katsayılar öğretim için seçildi.',
      'Önce B→C’yi uyarıcı tutup uyaranı artır. Ardından B→C bağlantısını belirtilen baskılayıcı katsayıya geçir. Son olarak yalnız B→C bağlantısını kaldır. C’nin sıfırlanmadığına dikkat et: taban girdisi devam ediyor. Bir bağlantının kaldırılmasıyla bir hücrenin tamamen susturulması farklı deneylerdir. Ablasyonun burada tam olarak neyi değiştirdiği açıkça tanımlıdır.',
      'Bağlantı haritası, hangi hücrelerin temas ettiğine dair anatomik kanıt sağlar. Dinamik model, bu temaslara seçilmiş denklemler ve parametreler ekler. Beden ve çevreyle etkileşim kuran bir model, davranış simülasyonuna ilerleyebilir. Gerçek biyolojik sistemi yeniden ürettiğini söylemek içinse bağımsız fizyolojik ve davranışsal ölçümlerle karşılaştırma gerekir.',
      'C. elegans nöronlarında dereceli iletim ölçülmüştür; AWA hücrelerinde kalsiyum aksiyon potansiyelleri de gösterilmiştir. Bu çeşitlilik, bütün hücreleri tek eşik şemasına indirgememeyi gerektirir. İşlevsel atlaslar, anatomik haritanın yanında deneysel yanıtları da inceler. Bir eğrinin görünmesi, hayvanın davranışının doğrulandığı veya zihninin kopyalandığı anlamına gelmez.',
      'Devre deneyine döndüğünde şu dört soruyu sor: Bağlantı nereden geldi? Etki işareti biliniyor mu? Parametre ölçüldü mü, seçildi mi? Çıktı hangi bağımsız veriyle karşılaştırıldı? Circuitiary’nin mevcut deneyindeki boyutsuz aktiviteyi, zar gerilimi, kalsiyum ölçümü veya olay sayısıyla aynı nicelik gibi okumamalısın.',
    ], sources: ['graded', 'awa', 'atlas'],
  },
]

export const lessonSectionsEn: typeof lessonSections = [
  {
    id: 'lesson-neuron', title: 'Parts of a neuron', short: 'Meet the neuron',
    lead: 'Let’s first get to know one cell. A point on a connection map is, in reality, a living structure that is enclosed by a membrane, uses energy and has different extensions.',
    paragraphs: [
      'A typical neuron drawing distinguishes the cell body, the dendrites and the axon. Dendrites are the extensions where many inputs are received; in many cells the axon carries the signal to a more distant region. A synapse is the functional contact region where one cell can affect another. A neuron can have a large number of connections.',
      'This drawing is a teaching diagram. The shape and size of cells and the way they produce signals vary across species and cell types. We do not apply the typical multipolar drawing of human textbooks one-to-one to all worm or fly neurons. Other cells, such as glia, also take part in the workings of nervous tissue.',
      'Select the parts below. Then think about which regions an input could reach in this cell. The distances and sizes in the drawing are not measurements; the relationship to learn here is the one between the name of a part and its function.',
    ], sources: ['seer', 'openstax'],
  },
  {
    id: 'lesson-signal', title: 'From membrane to signal: local change and threshold', short: 'Follow the signal',
    lead: 'The membrane potential is the electrical voltage difference between the inside and the outside of the cell. “Resting” does not mean that this difference is zero.',
    paragraphs: [
      'The different distribution of ions inside and outside the cell, together with which ions the membrane lets through, contributes to the voltage difference. Channels regulate the passage; pumps help maintain the ion differences. Depolarization is a change of the potential in the more positive direction, hyperpolarization in the more negative direction. These describe the direction of a change.',
      'Local potentials can vary in size; they can weaken as they spread passively. In a suitable cell, once the threshold is crossed, an action potential can spread along the membrane as a self-regenerating event. Under certain conditions a stronger stimulus can change the number or the timing of events instead of raising the peak of a single event proportionally. The threshold and the shape of the event depend on the biological context.',
      'In this demonstration, first keep the stimulus below the threshold, then raise it to the threshold. Compare two different stimuli above the threshold: see that the peak of the single event stays the same. Lower the stimulus to zero. There is only a threshold decision and a drawing here; no train of events, firing rate, ion channels or real voltage is calculated.',
    ], sources: ['membrane', 'action', 'ions'],
  },
  {
    id: 'lesson-chemical', title: 'Chemical synapse: transmitter and receptor', short: 'Chemical synapse',
    lead: 'Follow the chemical communication between two cells in three steps: release, binding, response.',
    paragraphs: [
      'A rise in calcium at the presynaptic terminal contributes to the release of neurotransmitter from vesicles. The transmitter molecule travels across the synaptic cleft and binds to a receptor on the target cell. The channels the receptor affects and the ion conditions of the cell determine the response that results. For this reason the name of the transmitter alone does not tell you the effect of every connection.',
      '“Presynaptic” refers to the side that sends the signal, “postsynaptic” to the side that responds. Drawing a chemical connection as A→B in a graph records the direction of this relationship. The presence of the arrow does not determine that B will definitely produce an event, or what the behavior will be; the size of the effect and the state of the cell at that moment are also needed.',
      'A synaptic effect does not have to be fixed. Short-term strengthening or weakening that depends on recent activity history are examples of plasticity. Changing a slider by hand in a model, however, does not by itself simulate biological plasticity. Such a model needs a separately defined mechanism that tracks the history and changes the connection.',
    ], sources: ['release', 'receptors', 'plasticity'],
  },
  {
    id: 'lesson-ei', title: 'Tell excitatory and inhibitory effects apart', short: 'Excitatory / inhibitory',
    lead: 'When you assess an effect, it is not enough to look only at the direction of the arrow or at whether the voltage rises or falls.',
    paragraphs: [
      'An excitatory effect raises, under the relevant conditions, the probability that the target produces a response; an inhibitory effect can lower it. Which direction this takes depends on the receptor, the channels affected and the ion conditions. The same transmitter can produce different responses at different receptors. That is why we do not add a “plus” or “minus” sign to an anatomical connection without justification.',
      'Inhibition does not always mean a more negative voltage. An increase in membrane conductance can reduce the voltage effect of another, excitatory input: this is called shunting inhibition. An inhibitory effect can be seen even without a marked voltage change at rest. So we do not treat the direction of the voltage and the functional effect as the same thing.',
      'Below, we assign the signs of the effects ourselves, deliberately. First increase only the excitatory input; then hold it fixed and increase the inhibitory input. At what amount does the output reach zero? This simple subtraction example teaches the net effect; it does not resolve receptors, conductances or the real shunting mechanism.',
    ], sources: ['receptors', 'inhibition'],
  },
  {
    id: 'lesson-gap', title: 'Electrical synapse: the direction of the difference matters', short: 'Electrical coupling',
    lead: 'Gap junction channels allow ion current to flow directly between cells. The release of a transmitter molecule is not required.',
    paragraphs: [
      'In many electrical connections current can flow in both directions; the voltage difference at that moment affects the direction. Some connections do not conduct equally in both directions, that is, they can behave as rectifiers. In C. elegans, too, this asymmetry has been measured for specific connections. We do not generalize this finding to mean that all electrical synapses are the same.',
      'In this example A starts from a high relative level and B from a low one. A symmetric coupling reduces the difference over time. When you lower the coupling strength to zero, the cells keep their starting values. When you reverse the start, the direction of the effect changes. Check from the numerical values how much a stronger coupling shrinks the difference at the same time.',
      'The demonstration has no leak, external input or rectification. That the sum A+B stays constant is a consequence of these chosen equations; we do not claim such a sum law for all the ion and energy processes of a living cell. The time slider is a tool for inspecting a graph, not a real-time experimental recording.',
    ], sources: ['electrical', 'rectification'],
  },
  {
    id: 'lesson-circuit', title: 'From a three-cell circuit to the limits of the model', short: 'Small circuit',
    lead: 'Now, instead of a single cell, examine the chain A→B→C. Change one parameter, see the result, then explain the reason in your own words.',
    paragraphs: [
      'A receives external input for a set period; B is affected by A; and C is affected by B. Each cell’s response changes over time. We also give C a constant baseline input of 0.35: this way the inhibitory B→C connection can push C below this baseline. A, B and C are not the names of real animal cells; all the coefficients were chosen for teaching.',
      'First keep B→C excitatory and increase the stimulus. Next, switch the B→C connection to the stated inhibitory gain. Finally, remove only the B→C connection. Notice that C does not go to zero: the baseline input continues. Removing a connection and silencing a cell completely are different experiments. Exactly what the ablation changes here is explicitly defined.',
      'A connection map provides anatomical evidence about which cells are in contact. A dynamic model adds chosen equations and parameters to these contacts. A model that interacts with a body and an environment can move on toward behavior simulation. To say that it reproduces the real biological system, however, requires comparison with independent physiological and behavioral measurements.',
      'Graded transmission has been measured in C. elegans neurons; calcium action potentials have also been shown in AWA cells. This diversity requires us not to reduce all cells to a single threshold scheme. Functional atlases examine experimental responses alongside the anatomical map. The appearance of a curve does not mean that the animal’s behavior has been validated or that its mind has been copied.',
      'When you return to the circuit experiment, ask these four questions: Where did the connection come from? Is the sign of the effect known? Was the parameter measured or chosen? Against which independent data was the output compared? You should not read the dimensionless activity in Circuitiary’s current experiment as the same quantity as membrane voltage, a calcium measurement or an event count.',
    ], sources: ['graded', 'awa', 'atlas'],
  },
]

// Terms that also have a hint card take their meaning from src/terms/glossary.ts; only lesson-only terms are defined here.
const sharedFrom = (terms: readonly GlossaryTerm[]) => (id: string): readonly [string, string] => {
  const term = terms.find(candidate => candidate.id === id)
  if (!term) throw new RangeError(`Unknown glossary term: ${id}`)
  return [term.title, term.meaning]
}
const shared = sharedFrom(glossaryTerms)
const sharedEn = sharedFrom(glossaryTermsEn)

export const glossary: readonly (readonly [term: string, description: string])[] = [
  shared('soma'), shared('dendrit'),
  shared('akson'), ['Zar potansiyeli', 'Hücre içi ve dışı arasındaki gerilim farkı.'],
  ['Depolarizasyon', 'Potansiyelin daha pozitif yöne değişmesi.'], ['Hiperpolarizasyon', 'Potansiyelin daha negatif yöne değişmesi.'],
  ['Eşik', 'Bu gösterimde olayın tetiklendiği sınır; biyolojide koşullara bağlıdır.'],
  ['Presinaptik / postsinaptik', 'İleten taraf / yanıtlayan taraf.'], shared('reseptor'),
  ['Şönt baskılanması', 'Artan iletkenliğin diğer girdinin gerilim etkisini azaltması.'], shared('plastisite'),
  shared('gap-junction'), shared('konnektom'),
  ['Model', 'Seçilmiş varsayımlarla bir sistemin belirli özelliklerini temsil eden tanım.'],
]

export const glossaryEn: typeof glossary = [
  sharedEn('soma'), sharedEn('dendrit'),
  sharedEn('akson'), ['Membrane potential', 'The voltage difference between the inside and the outside of the cell.'],
  ['Depolarization', 'A change of the potential in the more positive direction.'], ['Hyperpolarization', 'A change of the potential in the more negative direction.'],
  ['Threshold', 'In this demonstration, the limit at which the event is triggered; in biology it depends on the conditions.'],
  ['Presynaptic / postsynaptic', 'The sending side / the responding side.'], sharedEn('reseptor'),
  ['Shunting inhibition', 'Increased conductance reducing the voltage effect of the other input.'], sharedEn('plastisite'),
  sharedEn('gap-junction'), sharedEn('konnektom'),
  ['Model', 'A description that represents certain properties of a system under chosen assumptions.'],
]

export const selfChecks = [
  { id: 'q1', question: 'Tipik nöron çiziminde dendritlerin temel görevi nedir?', options: [
    { id: 'receive', text: 'Birçok girdinin alındığı uzantılar olmak' }, { id: 'package', text: 'Nörotransmitterleri veziküle paketlemek' }, { id: 'pump', text: 'İyon farklarını tek başına üretmek' },
  ], correct: 'receive', explanation: 'Dendritler birçok nöronda girdilerin alındığı uzantılardır. Bu, bütün hücrelerin aynı biçimde olduğu anlamına gelmez.' },
  { id: 'q2', question: 'Dinlenim zar potansiyeli için hangi açıklama daha doğrudur?', options: [
    { id: 'zero', text: 'Dinlenimde zarın iki tarafı mutlaka aynı gerilimdedir' }, { id: 'gradients', text: 'İyon dağılımı ve zarın seçici geçirgenliği gerilim farkına katkı verir' }, { id: 'instantPump', text: 'Her aksiyon potansiyelini tek başına pompa oluşturur' },
  ], correct: 'gradients', explanation: 'Dinlenim, sıfır gerilim demek değildir. Seçici geçirgenlik ve iyon farkları birlikte etkilidir; pompalar farkların sürdürülmesine katkı verir.' },
  { id: 'q3', question: 'Bu tek olay gösteriminde eşik aşıldıktan sonra uyaranı artırınca ne değişir?', options: [
    { id: 'taller', text: 'Tek olayın tepesi uyaranla orantılı büyür' }, { id: 'universal', text: 'Bütün türler için aynı ateşleme sıklığı hesaplanır' }, { id: 'samePeak', text: 'Çizilen tek olayın tepesi aynı kalır' },
  ], correct: 'samePeak', explanation: 'Bu gösterim bir olay seçer; ateşleme dizisi veya frekans hesaplamaz. Eşik altında görülen daha küçük eğri, yerel yanıtın şematik gösterimidir.' },
  { id: 'q4', question: 'Bir kimyasal bağlantının uyarıcı mı baskılayıcı mı olduğunu ne belirler?', options: [
    { id: 'transmitterOnly', text: 'Yalnız nörotransmitterin adı' }, { id: 'receptorContext', text: 'Reseptör, etkilenen kanallar ve hücrenin iyon koşulları da' }, { id: 'arrow', text: 'Çizimdeki okun uzunluğu' },
  ], correct: 'receptorContext', explanation: 'Aynı iletici farklı reseptörlerde farklı etkiler oluşturabilir. Bu nedenle iletici adı, her bağlantı için tek başına yeterli değildir.' },
  { id: 'q5', question: 'Baskılanma için gerilim mutlaka daha negatif olmalı mı?', options: [
    { id: 'shunt', text: 'Hayır; artan iletkenlik diğer girdilerin etkisini azaltabilir' }, { id: 'always', text: 'Evet; baskılanma yalnız hiperpolarizasyondur' }, { id: 'noChange', text: 'Gerilim değişmezse hiçbir etki olamaz' },
  ], correct: 'shunt', explanation: 'Şönt tipi baskılanma, dinlenimde belirgin gerilim değişikliği olmadan da uyarıcı girdinin etkisini azaltabilir. Gerilim yönü tek başına etiket koydurmaz. Dersin çıkarma modeli bu mekanizmayı çözmez.' },
  { id: 'q6', question: 'Elektriksel sinapslar için hangisi doğrudur?', options: [
    { id: 'chemistry', text: 'Akım önce nörotransmittere dönüşmek zorundadır' }, { id: 'equal', text: 'Bütün bağlantılar iki yönde eşit iletir' }, { id: 'rectification', text: 'Birçok bağlantı iki yönlüdür; bazıları bir yönü daha iyi iletir' },
  ], correct: 'rectification', explanation: 'Gap junction doğrudan iyon akımına olanak verir. İki yöne eşit doğrusal iletim bu gösterimin varsayımıdır; doğrultucu bağlantılar da ölçülmüştür.' },
  { id: 'q7', question: 'A→B→C öğretici devrede bir bağlantıyı değiştirince C’nin grafiği değişti. Ne gösterdik?', options: [
    { id: 'behavior', text: 'Gerçek hayvan davranışını doğruladık' }, { id: 'model', text: 'Belirttiğimiz modelde bu değişikliğin sonucu etkilediğini' }, { id: 'mind', text: 'Hayvanın zihnini yeniden oluşturduk' },
  ], correct: 'model', explanation: 'Kontrollü deney, bu modelin varsayımları altında bir ilişkiyi gösterir. Gerçek hayvanı açıklamak için fizyolojik ölçümler ve davranış karşılaştırmaları da gerekir.' },
  { id: 'q8', question: 'C. elegans için hangi genelleme uygundur?', options: [
    { id: 'diverse', text: 'Dereceli iletim önemlidir; AWA gibi bazı hücrelerde kalsiyum aksiyon potansiyelleri ölçülmüştür' }, { id: 'never', text: 'Hiçbir nöronu aksiyon potansiyeli üretemez' }, { id: 'lif', text: 'Bütün nöronları aynı eşikli olay modeliyle doğrulanmıştır' },
  ], correct: 'diverse', explanation: 'Türün bütün nöronlarını tek bir sinyalleme biçimine indirgemeyiz. Bu dersin eşik şeması bütün C. elegans hücreleri için doğrulanmış bir model değildir.' },
]

/** Same ids, option order and correct option as `selfChecks`; only question, option and feedback text differ. */
export const selfChecksEn: typeof selfChecks = [
  { id: 'q1', question: 'What is the main role of dendrites in a typical neuron drawing?', options: [
    { id: 'receive', text: 'Being the extensions where many inputs are received' }, { id: 'package', text: 'Packaging neurotransmitters into vesicles' }, { id: 'pump', text: 'Producing the ion differences on their own' },
  ], correct: 'receive', explanation: 'In many neurons, dendrites are the extensions where inputs are received. This does not mean that all cells have the same shape.' },
  { id: 'q2', question: 'Which statement about the resting membrane potential is more accurate?', options: [
    { id: 'zero', text: 'At rest the two sides of the membrane are necessarily at the same voltage' }, { id: 'gradients', text: 'The distribution of ions and the selective permeability of the membrane contribute to the voltage difference' }, { id: 'instantPump', text: 'The pump alone creates every action potential' },
  ], correct: 'gradients', explanation: 'Resting does not mean zero voltage. Selective permeability and ion differences act together; pumps contribute to maintaining the differences.' },
  { id: 'q3', question: 'In this single-event demonstration, what changes when you increase the stimulus after the threshold has been crossed?', options: [
    { id: 'taller', text: 'The peak of the single event grows in proportion to the stimulus' }, { id: 'universal', text: 'The same firing rate is calculated for all species' }, { id: 'samePeak', text: 'The peak of the drawn single event stays the same' },
  ], correct: 'samePeak', explanation: 'This demonstration selects one event; it does not calculate a firing train or a frequency. The smaller curve seen below the threshold is a schematic depiction of the local response.' },
  { id: 'q4', question: 'What determines whether a chemical connection is excitatory or inhibitory?', options: [
    { id: 'transmitterOnly', text: 'Only the name of the neurotransmitter' }, { id: 'receptorContext', text: 'The receptor, the channels affected and the ion conditions of the cell as well' }, { id: 'arrow', text: 'The length of the arrow in the drawing' },
  ], correct: 'receptorContext', explanation: 'The same transmitter can produce different effects at different receptors. For this reason the name of the transmitter alone is not enough for every connection.' },
  { id: 'q5', question: 'Does the voltage have to become more negative for inhibition?', options: [
    { id: 'shunt', text: 'No; increased conductance can reduce the effect of other inputs' }, { id: 'always', text: 'Yes; inhibition is only hyperpolarization' }, { id: 'noChange', text: 'If the voltage does not change, there can be no effect' },
  ], correct: 'shunt', explanation: 'Shunting inhibition can reduce the effect of an excitatory input even without a marked voltage change at rest. The direction of the voltage alone does not justify a label. The lesson’s subtraction model does not resolve this mechanism.' },
  { id: 'q6', question: 'Which of these is true of electrical synapses?', options: [
    { id: 'chemistry', text: 'The current must first be converted into neurotransmitter' }, { id: 'equal', text: 'All connections conduct equally in both directions' }, { id: 'rectification', text: 'Many connections are two-way; some conduct better in one direction' },
  ], correct: 'rectification', explanation: 'A gap junction allows ion current to flow directly. Equal, linear conduction in both directions is an assumption of this demonstration; rectifying connections have also been measured.' },
  { id: 'q7', question: 'In the A→B→C teaching circuit, C’s graph changed when a connection was changed. What did we show?', options: [
    { id: 'behavior', text: 'We validated real animal behavior' }, { id: 'model', text: 'That this change affected the result in the model we specified' }, { id: 'mind', text: 'We recreated the animal’s mind' },
  ], correct: 'model', explanation: 'A controlled experiment shows a relationship under the assumptions of this model. Explaining the real animal also requires physiological measurements and behavioral comparisons.' },
  { id: 'q8', question: 'Which generalization is appropriate for C. elegans?', options: [
    { id: 'diverse', text: 'Graded transmission is important; calcium action potentials have been measured in some cells such as AWA' }, { id: 'never', text: 'None of its neurons can produce an action potential' }, { id: 'lif', text: 'All of its neurons have been validated with the same thresholded event model' },
  ], correct: 'diverse', explanation: 'We do not reduce all the neurons of the species to a single form of signaling. The threshold scheme of this lesson is not a validated model for all C. elegans cells.' },
]
