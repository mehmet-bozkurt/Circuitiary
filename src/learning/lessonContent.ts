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
} as const

export type LessonSourceId = keyof typeof lessonSources

export const neuronParts = [
  { id: 'dendrite', title: 'Dendrit', number: 1, description: 'Birçok nöronda girdilerin alındığı dallanmış uzantı. Gelen etkiler burada yerel gerilim değişikliklerine katkı verebilir. Her türün ve her nöronun aynı dendrit ağacına sahip olması gerekmez.', prompt: 'Birden fazla girdinin nerede buluşabileceğini düşün.' },
  { id: 'soma', title: 'Hücre gövdesi', number: 2, description: 'Soma; çekirdeği ve hücrenin yaşamasını sağlayan birçok yapıyı barındırır. Nöron, yalnızca bir elektrik kablosu değil, protein üreten ve enerji kullanan canlı bir hücredir.', prompt: 'Bakım ve sinyal işleme aynı hücrede bir aradadır.' },
  { id: 'axon', title: 'Akson', number: 3, description: 'Birçok nöronda sinyali hücre gövdesinden uzak bölgelere taşıyan uzantı. Aksiyon potansiyeli üreten hücrelerde zar boyunca yenilenen elektriksel olay ilerleyebilir. Bütün hayvan hücrelerinin bu çizime uyması gerekmez.', prompt: 'Bir sinyalin uzaktaki hedefe ulaşmasını düşün.' },
  { id: 'terminal', title: 'Sinaptik uç', number: 4, description: 'Kimyasal sinapsta iletici moleküllerin salınabildiği presinaptik bölge. Uç, aksonun sonunda bir hedef hücreye yaklaşır; hücreler işlevsel olarak iletişim kurar.', prompt: 'Elektriksel değişiklik burada kimyasal iletişime bağlanabilir.' },
  { id: 'cleft', title: 'Sinaptik aralık', number: 5, description: 'Kimyasal sinapstaki hücre zarları arasındaki dar bölge. İletici moleküller bu aralığı geçip hedefteki reseptörlere bağlanabilir. Elektriksel sinapsın mekanizması ise farklıdır.', prompt: 'Aralıkta görünen boşluk, iletişim olmadığı anlamına gelmez.' },
] as const

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

export const glossary = [
  ['Soma', 'Hücre gövdesi.'], ['Dendrit', 'Birçok nöronda girdilerin alındığı uzantı.'],
  ['Akson', 'Birçok hücrede sinyali uzak bölgelere taşıyan uzantı.'], ['Zar potansiyeli', 'Hücre içi ve dışı arasındaki gerilim farkı.'],
  ['Depolarizasyon', 'Potansiyelin daha pozitif yöne değişmesi.'], ['Hiperpolarizasyon', 'Potansiyelin daha negatif yöne değişmesi.'],
  ['Eşik', 'Bu gösterimde olayın tetiklendiği sınır; biyolojide koşullara bağlıdır.'],
  ['Presinaptik / postsinaptik', 'İleten taraf / yanıtlayan taraf.'], ['Reseptör', 'İleticiye yanıt veren protein.'],
  ['Şönt baskılanması', 'Artan iletkenliğin diğer girdinin gerilim etkisini azaltması.'], ['Plastisite', 'Sinaptik etkinin geçmişe bağlı değişmesi.'],
  ['Gap junction', 'Hücreler arasında doğrudan akım geçiren kanallar.'], ['Konnektom', 'Sinir sistemindeki bağlantıların haritası.'],
  ['Model', 'Seçilmiş varsayımlarla bir sistemin belirli özelliklerini temsil eden tanım.'],
] as const

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
