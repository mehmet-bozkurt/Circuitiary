<script setup lang="ts">
import TermText from './TermText.vue'
import { computed, onMounted, ref } from 'vue'
import LessonTracePlot from '../learning/LessonTracePlot.vue'
import { glossary, lessonSections, lessonSources, neuronParts, selfChecks } from '../learning/lessonContent'
import { chemicalLesson, gapLesson, smallCircuitLesson, thresholdLesson } from '../learning/lessonMath'
import { decimal } from '../format'
import { BASE } from '../siteBase'

const emit = defineEmits<{ ready: [] }>()
onMounted(() => emit('ready'))
const selectedPart = ref<string>('dendrite')
const currentPart = computed(() => neuronParts.find(part => part.id === selectedPart.value) ?? neuronParts[0])
const stimulus = ref(.38)
const threshold = ref(.60)
const excitation = ref(.65)
const inhibition = ref(.25)
const gapStrength = ref(.60)
const gapTime = ref(2.50)
const reverseGap = ref(false)
const circuitStimulus = ref(.80)
const circuitInhibitory = ref(false)
const circuitAblated = ref(false)
const answers = ref<Record<string, string>>({})
const thresholdResult = computed(() => thresholdLesson(stimulus.value, threshold.value))
const chemical = computed(() => chemicalLesson(excitation.value, inhibition.value))
const gap = computed(() => gapLesson(gapStrength.value))
const gapA = computed(() => reverseGap.value ? gap.value.b : gap.value.a)
const gapB = computed(() => reverseGap.value ? gap.value.a : gap.value.b)
const gapIndex = computed(() => Math.max(0, Math.min(100, Math.round(gapTime.value / .05))))
const gapAtA = computed(() => gapA.value[gapIndex.value] ?? 0)
const gapAtB = computed(() => gapB.value[gapIndex.value] ?? 0)
const gapDirection = computed(() => gapStrength.value === 0 ? 'Akım yok' : gapAtA.value > gapAtB.value ? 'A → B' : gapAtB.value > gapAtA.value ? 'B → A' : 'Düzeyler eşit')
const circuit = computed(() => smallCircuitLesson({ stimulus: circuitStimulus.value, inhibitory: circuitInhibitory.value, ablated: circuitAblated.value }))
const correctCount = computed(() => selfChecks.filter(question => answers.value[question.id] === question.correct).length)
const answeredCount = computed(() => Object.keys(answers.value).length)
const format = (value: number, digits = 2) => decimal(value, digits)
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`
function resetLesson() {
  selectedPart.value = 'dendrite'
  stimulus.value = .38
  threshold.value = .60
  excitation.value = .65
  inhibition.value = .25
  gapStrength.value = .60
  gapTime.value = 2.50
  reverseGap.value = false
  circuitStimulus.value = .80
  circuitInhibitory.value = false
  circuitAblated.value = false
  answers.value = {}
}
</script>

<template>
  <main id="neuron-lesson" tabindex="-1" class="neuron-lesson">
    <header class="lesson-intro">
      <div>
        <p class="lesson-eyebrow">CIRCUITIARY / ÖĞRENME NOTLARI / 01</p>
        <h1 id="lesson-title" tabindex="-1"><TermText text="Nörondan " /><em>devreye</em></h1>
        <p class="lesson-summary">Bir hücrenin parçalarını tanı. Bir sinyalin nasıl değiştiğini gör. Sonra üç hücreyle küçük, sınanabilir bir deney yap.</p>
        <p class="lesson-duration">Yaklaşık 25–35 dakika · Ön bilgi gerektirmez · Kendi hızında ilerle</p>
      </div>
      <button type="button" class="lesson-reset" @click="resetLesson">Dersi sıfırla</button>
    </header>

    <div class="lesson-boundary"><strong>Bu sayfayı nasıl okumalı?</strong><p>Biyolojik açıklamalar kaynaklara dayanır. Etkileşimlerin sayıları ise öğretim için seçilmiştir. Grafiklerdeki düzey ve zaman boyutsuzdur; mV, milisaniye, kalsiyum ölçümü veya gerçek olay sayısı değildir. Kaydırıcılar anında hesaplanır; animasyon beklemen gerekmez.</p></div>

    <div class="lesson-layout">
      <aside class="lesson-navigation">
        <nav aria-label="Dersin bölümleri">
          <p class="lesson-eyebrow">BU DERSTE</p>
          <a v-for="(section, index) in lessonSections" :key="section.id" :href="`#${section.id}`"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ section.short }}</a>
          <a href="#lesson-glossary"><span>+</span>Mini sözlük</a>
          <a href="#lesson-self-check"><span>?</span>Kendini dene</a>
          <a href="#lesson-sources"><span>↗</span>Kaynaklar</a>
        </nav>
        <p class="navigation-note">Bir kavramı oku, gösterimde tek bir şeyi değiştir, sonucu kendi cümlenle açıkla.</p>
      </aside>

      <div class="lesson-body">
        <section v-for="(section, index) in lessonSections" :id="section.id" :key="section.id" :data-lesson-section="index + 1" :aria-labelledby="`${section.id}-title`" class="lesson-section">
          <p class="section-number">{{ String(index + 1).padStart(2, '0') }} / 06</p>
          <h2 :id="`${section.id}-title`"><TermText :text="section.title" /></h2>
          <p class="section-lead"><TermText :text="section.lead" /></p>
          <p v-for="paragraph in section.paragraphs" :key="paragraph" class="lesson-paragraph"><TermText :text="paragraph" /></p>

          <div v-if="section.id === 'lesson-neuron'" class="lesson-demo anatomy-demo">
            <p class="demo-eyebrow">KEŞFET / BİR PARÇA SEÇ</p>
            <svg viewBox="0 0 780 300" class="neuron-drawing" aria-hidden="true">
              <g class="drawing-part" :class="{ chosen: selectedPart === 'dendrite' }" @click="selectedPart = 'dendrite'">
                <g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M215 145 144 91 91 75 M145 91 135 44 M204 130 179 61 194 32 M209 172 140 205 88 239 M140 205 105 180 M224 185 196 252 166 266 M197 252 213 277" />
                </g>
                <circle cx="111" cy="124" r="21" class="part-number" /><text x="111" y="133">1</text>
              </g>
              <g class="drawing-part" :class="{ chosen: selectedPart === 'soma' }" @click="selectedPart = 'soma'">
                <path d="M187 137 Q200 100 246 112 Q275 105 289 137 L321 149 290 171 Q277 214 237 203 Q189 205 187 169Z" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="4" />
                <circle cx="244" cy="157" r="24" fill="var(--theme-surface, #f8f6e9)" stroke="currentColor" stroke-width="3" />
                <circle cx="245" cy="77" r="21" class="part-number" /><text x="245" y="86">2</text>
              </g>
              <g class="drawing-part" :class="{ chosen: selectedPart === 'axon' }" @click="selectedPart = 'axon'">
                <path d="M310 150 C373 142 434 160 500 150 L590 150" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" />
                <path d="M390 138 422 138 M453 142 485 142 M518 138 550 138" stroke="#c4bf9d" stroke-width="20" stroke-linecap="round" />
                <circle cx="453" cy="98" r="21" class="part-number" /><text x="453" y="107">3</text>
              </g>
              <g class="drawing-part" :class="{ chosen: selectedPart === 'terminal' }" @click="selectedPart = 'terminal'">
                <path d="M587 150 Q622 135 635 94 M587 150 Q634 157 650 162 M587 150 Q618 169 635 214" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
                <ellipse cx="641" cy="88" rx="17" ry="12" fill="currentColor" /><ellipse cx="656" cy="162" rx="17" ry="12" fill="currentColor" /><ellipse cx="641" cy="221" rx="17" ry="12" fill="currentColor" />
                <circle cx="592" cy="54" r="21" class="part-number" /><text x="592" y="63">4</text>
              </g>
              <g class="drawing-part" :class="{ chosen: selectedPart === 'cleft' }" @click="selectedPart = 'cleft'">
                <rect x="677" y="130" width="28" height="64" rx="9" fill="currentColor" opacity=".13" />
                <path d="M716 112 Q699 162 716 211" fill="none" stroke="#999e8a" stroke-width="7" />
                <circle cx="690" cy="249" r="21" class="part-number" /><text x="690" y="258">5</text>
              </g>
            </svg>
            <div class="part-buttons" role="group" aria-label="Nöronun parçaları">
              <button v-for="part in neuronParts" :key="part.id" type="button" :aria-pressed="selectedPart === part.id" @click="selectedPart = part.id"><span aria-hidden="true">{{ part.number }}</span>{{ part.title }}</button>
            </div>
            <div class="part-inspector" aria-live="polite" aria-atomic="true"><h3 data-testid="neuron-part-title"><TermText :text="currentPart.title" /></h3><p><TermText :text="currentPart.description" /></p><p class="try-question"><TermText :text="currentPart.prompt" /></p></div>
            <p class="model-note">Özgün şematik çizim; anatomik konum, ölçek veya belirli bir türün hücre biçimi değildir. Çizime dokunabilir ya da üstteki düğmeleri klavyeyle seçebilirsin.</p>
          </div>

          <div v-else-if="section.id === 'lesson-signal'" class="lesson-demo">
            <p class="demo-eyebrow">DENE / EŞİĞİN İKİ YANI</p>
            <div class="slider-grid">
              <div><label for="lesson-stimulus">Uyaran <output for="lesson-stimulus">{{ format(stimulus) }}</output></label><input id="lesson-stimulus" v-model.number="stimulus" type="range" :aria-valuetext="format(stimulus)" min="0" max="1" step="0.01" /></div>
              <div><label for="lesson-threshold">Eşik <output for="lesson-threshold">{{ format(threshold) }}</output></label><input id="lesson-threshold" v-model.number="threshold" type="range" :aria-valuetext="format(threshold)" min="0" max="1" step="0.01" /></div>
            </div>
            <div class="demo-readouts">
              <div><span>Eşik kararı</span><strong data-testid="threshold-status">{{ thresholdResult.fired ? 'Tek olay oluştu' : 'Olay oluşmadı' }}</strong></div>
              <div><span>Olay tepesi</span><output data-testid="threshold-peak">{{ format(thresholdResult.fired ? 1 : 0) }}</output></div>
              <div><span>Çizimin tepesi</span><output>{{ format(thresholdResult.peak) }}</output></div>
            </div>
            <LessonTracePlot :times="thresholdResult.trace.times" :traces="[{ id: 'response', label: thresholdResult.fired ? 'Tek olay şeması' : 'Yerel yanıt şeması', color: 'var(--theme-trace-green, #35694f)', values: thresholdResult.trace.values }]" title="Bir yerel yanıt veya tek olayın çizimi" y-label="Göreli çizim değeri" />
            <p class="model-note"><strong>Varsayım:</strong> Sıfır olmayan uyaran eşiğe ulaştığında aynı, tepe değeri 1 olan tek eğri seçilir. Eşik altında daha küçük eğri yerel yanıtı temsil eder. Eğri biçimi çizim tercihidir; gerçek aksiyon potansiyeli biçimi, mV veya frekans hesabı değildir.</p>
          </div>

          <div v-else-if="section.id === 'lesson-chemical'" class="chemical-steps" role="group" aria-label="Kimyasal sinapsın üç aşaması">
            <div><span>01</span><h3>Salım</h3><p><TermText text="Presinaptik uç, iletici molekülleri aralığa bırakır." /></p></div>
            <div><span>02</span><h3>Bağlanma</h3><p><TermText text="İletici, postsinaptik reseptörle etkileşir." /></p></div>
            <div><span>03</span><h3>Yanıt</h3><p><TermText text="Reseptör ve hücrenin koşulları sonucu belirler." /></p></div>
          </div>

          <div v-else-if="section.id === 'lesson-ei'" class="lesson-demo">
            <p class="demo-eyebrow">DENE / İKİ ATANMIŞ ETKİYİ BİRLEŞTİR</p>
            <div class="slider-grid">
              <div><label for="lesson-excitation">Uyarıcı girdi <output for="lesson-excitation">{{ format(excitation) }}</output></label><input id="lesson-excitation" v-model.number="excitation" type="range" :aria-valuetext="format(excitation)" min="0" max="1" step="0.01" /></div>
              <div><label for="lesson-inhibition">Baskılayıcı girdi <output for="lesson-inhibition">{{ format(inhibition) }}</output></label><input id="lesson-inhibition" v-model.number="inhibition" type="range" :aria-valuetext="format(inhibition)" min="0" max="1" step="0.01" /></div>
            </div>
            <div class="effect-bars" aria-hidden="true"><div><span>+ Uyarıcı</span><i><b :style="{ width: `${excitation * 100}%` }"></b></i></div><div class="inhibitory-bar"><span>− Baskılayıcı</span><i><b :style="{ width: `${inhibition * 100}%` }"></b></i></div><div><span>Çıktı</span><i><b :style="{ width: `${chemical.activity * 100}%` }"></b></i></div></div>
            <div class="demo-readouts"><div><span>Net girdi: uyarıcı − baskılayıcı</span><output data-testid="chemical-drive">{{ signed(chemical.drive) }}</output></div><div><span>0–1 aralığına sınırlanan çıktı</span><output data-testid="chemical-activity">{{ format(chemical.activity) }}</output></div></div>
            <p class="model-note"><strong>Varsayım:</strong><TermText text=" İşaretler atanmıştır. Çıktı = en küçük(1, en büyük(0, uyarıcı − baskılayıcı)). Negatif net girdi, bu gösterimde negatif gerilim demek değildir. İyon kanalı, reseptör ve şönt baskılanması hesaplanmıyor." /></p>
          </div>

          <div v-else-if="section.id === 'lesson-gap'" class="lesson-demo">
            <p class="demo-eyebrow">DENE / FARKI VE YÖNÜ DEĞİŞTİR</p>
            <div class="slider-grid"><div><label for="lesson-gap-strength">Elektriksel bağ kuvveti <output for="lesson-gap-strength">{{ format(gapStrength) }}</output></label><input id="lesson-gap-strength" v-model.number="gapStrength" type="range" :aria-valuetext="format(gapStrength)" min="0" max="1" step="0.01" /></div><div><label for="lesson-gap-time">İncelenen öğretici zaman <output for="lesson-gap-time">{{ format(gapTime) }}</output></label><input id="lesson-gap-time" v-model.number="gapTime" type="range" :aria-valuetext="format(gapTime)" min="0" max="5" step="0.05" /></div></div>
            <button type="button" class="demo-button" :aria-pressed="reverseGap" @click="reverseGap = !reverseGap">Başlangıcı ters çevir</button>
            <div class="coupled-cells" aria-hidden="true"><span>A <b>{{ format(gapAtA) }}</b></span><i>{{ gapStrength === 0 ? '⋯' : '↔' }}</i><span>B <b>{{ format(gapAtB) }}</b></span></div>
            <div class="demo-readouts"><div><span>A’nın düzeyi</span><output data-testid="gap-a-value">{{ format(gapAtA, 3) }}</output></div><div><span>B’nin düzeyi</span><output data-testid="gap-b-value">{{ format(gapAtB, 3) }}</output></div><div><span>Modelde etki yönü</span><strong data-testid="gap-direction">{{ gapDirection }}</strong></div></div>
            <LessonTracePlot :times="gap.times" :traces="[{ id: 'a', label: 'A', color: 'var(--theme-trace-blue, #456e91)', values: gapA }, { id: 'b', label: 'B', color: 'var(--theme-trace-red, #9b5c4f)', values: gapB, dashed: true }]" :marker-time="gapTime" title="İki göreli düzeyin yakınlaşması" />
            <p class="model-note"><strong>Varsayım:</strong> dA/dt = g(B − A), dB/dt = g(A − B). Eşit, doğrusal iki yönlü bağ; sızıntı, dış girdi ve doğrultma yok. Başlangıç 1 ve 0; toplam bu modelde 1 kalır. Bu değerler gerçek hücre gerilimleri değildir.</p>
          </div>

          <div v-else-if="section.id === 'lesson-circuit'" class="lesson-demo">
            <p class="demo-eyebrow">DENE / BİR DEĞİŞKEN, BİR KARŞILAŞTIRMA</p>
            <div class="slider-grid circuit-controls"><div><label for="lesson-circuit-stimulus">A’ya verilen uyaran <output for="lesson-circuit-stimulus">{{ format(circuitStimulus) }}</output></label><input id="lesson-circuit-stimulus" v-model.number="circuitStimulus" type="range" :aria-valuetext="format(circuitStimulus)" min="0" max="1" step="0.01" /></div><div class="check-controls"><label for="lesson-circuit-inhibitory"><input id="lesson-circuit-inhibitory" v-model="circuitInhibitory" type="checkbox" /> B→C baskılayıcı olsun</label><label for="lesson-circuit-ablated"><input id="lesson-circuit-ablated" v-model="circuitAblated" type="checkbox" /> B→C bağlantısını kaldır</label></div></div>
            <div class="small-circuit" role="img" :aria-label="`A, B'yi uyarır. B ile C bağlantısı ${circuitAblated ? 'kaldırılmış' : circuitInhibitory ? 'baskılayıcı' : 'uyarıcı'}. C ayrıca sabit 0,35 taban girdisi alır.`"><span>A</span><i>→</i><span>B</span><i :class="{ muted: circuitAblated, negative: circuitInhibitory && !circuitAblated }">{{ circuitAblated ? '⋯' : circuitInhibitory ? '⊣' : '→' }}</i><span>C<small>taban: 0,35</small></span></div>
            <LessonTracePlot :times="circuit.times" :traces="[{ id: 'a', label: 'A', color: 'var(--theme-trace-blue, #456e91)', values: circuit.a }, { id: 'b', label: 'B', color: 'var(--theme-trace-gold, #9b7242)', values: circuit.b, dashed: true }, { id: 'c', label: 'C', color: 'var(--theme-trace-green, #35694f)', values: circuit.c }]" title="Üç hücrenin boyutsuz aktivitesi" y-label="Model aktivitesi" />
            <div class="demo-readouts"><div><span>C’nin en düşük değeri</span><output data-testid="circuit-min">{{ format(circuit.outputMinimum, 3) }}</output></div><div><span>C’nin en yüksek değeri</span><output data-testid="circuit-max">{{ format(circuit.outputMaximum, 3) }}</output></div><div><span>Girdi bitiminde C − taban</span><output data-testid="circuit-delta">{{ signed(circuit.deltaAtPulseEnd) }}</output></div></div>
            <p class="model-note"><strong>Varsayım:</strong> A girdisi 1 ≤ t &lt; 3 aralığında açık. Yanıtlar sızıntılı sürekli düzeyler; olay sayısı değildir. C’nin tabanı ve başlangıcı 0,35. Bağlantıyı kaldırmak yalnız B→C katsayısını sıfırlar. Hücreyi susturmaz.</p>
            <details class="lesson-equations"><summary>Bu küçük devrenin denklemlerini gör</summary><p>clip(x), değeri 0–1 aralığına sınırlar. τ = 0,35 ve adım = 0,02; ikisi de öğretici birimdedir.</p><code>τ dA/dt = −A + uyaran(t)<br />τ dB/dt = −B + clip(0,9 A)<br />τ dC/dt = −C + clip(0,35 + w B)</code><p>w, uyarıcı durumda +1; baskılayıcı durumda −0,9; bağlantı kaldırıldığında 0. Güncellemeler önceki adımdaki A/B/C değerlerini kullanır. Hiçbir katsayı biyolojik ölçümden alınmadı.</p></details>
          </div>

          <p class="inline-sources"><strong>Okuma kaynakları:</strong> <template v-for="(sourceId, sourceIndex) in section.sources" :key="sourceId"><span v-if="sourceIndex"> · </span><a :href="lessonSources[sourceId].url">{{ lessonSources[sourceId].title }}</a></template></p>
        </section>

        <section id="lesson-glossary" aria-labelledby="lesson-glossary-title" class="lesson-section">
          <p class="section-number">BAŞVURU</p><h2 id="lesson-glossary-title">Mini sözlük</h2><p class="section-lead">Bir sözcük takıldığında buraya dön. Aynı sözcüğün modeldeki anlamı ile biyolojideki kapsamını ayır.</p>
          <dl class="lesson-glossary"><div v-for="[term, description] in glossary" :key="term"><dt><TermText :text="term" /></dt><dd><TermText :text="description" /></dd></div></dl>
        </section>

        <section id="lesson-self-check" aria-labelledby="lesson-self-check-title" class="lesson-section">
          <p class="section-number">KENDİNİ DENE</p><h2 id="lesson-self-check-title">Sekiz küçük kontrol</h2><p class="section-lead">Bir yanıt seç; gerekçesini hemen oku. Yanıtını değiştirebilirsin. Amaç puan toplamak kadar, varsayım ile ölçüm arasındaki farkı anlatabilmek.</p>
          <p class="quiz-progress"><TermText :text="answeredCount" />/8 yanıtlandı · <TermText :text="correctCount" />/8 doğru</p>
          <fieldset v-for="(question, index) in selfChecks" :key="question.id" :data-question-id="question.id" class="quiz-question">
            <legend><span><TermText :text="index + 1" />.</span> <TermText :text="question.question" /></legend>
            <label v-for="option in question.options" :key="option.id" :class="{ selected: answers[question.id] === option.id }"><input v-model="answers[question.id]" type="radio" :name="question.id" :value="option.id" :aria-describedby="answers[question.id] ? `lesson-feedback-${question.id}` : undefined" />{{ option.text }}</label>
            <div v-if="answers[question.id]" :id="`lesson-feedback-${question.id}`" role="status" :data-testid="`quiz-feedback-${question.id}`" :data-correct="answers[question.id] === question.correct" class="quiz-feedback"><strong>{{ answers[question.id] === question.correct ? 'Doğru.' : 'Yeniden düşün.' }}</strong> {{ question.explanation }}</div>
          </fieldset>
        </section>

        <section id="lesson-sources" aria-labelledby="lesson-sources-title" class="lesson-section lesson-source-section">
          <p class="section-number">KAYNAKLARI İZLE</p><h2 id="lesson-sources-title">Dersin dayandığı okumalar</h2><p class="lesson-paragraph">Temel açıklamalar için kurumsal sitelerden erişilen ders kitapları; hayvana özgü örnekler için özgün araştırmalar kullanıldı. Erişilebilir olmak açık lisans anlamına gelmez. Bu sayfadaki çizimler ve hesaplar öğretici tasarımdır. Kaynaklardaki deneysel ölçümlerin kopyası değildir.</p>
          <ul><li v-for="source in lessonSources" :key="source.url"><a :href="source.url">{{ source.title }} <span aria-hidden="true">↗</span></a></li></ul>
        </section>

        <div class="lesson-next"><div><p class="lesson-eyebrow">BİR SONRAKİ ADIM</p><h2>Şimdi bağlantıyı sorgula.</h2><p>Devre deneyinde bir bağlantıyı seç. Anatomik kanıtı, atanan etkiyi ve seçilen dinamiği ayrı ayrı anlatmayı dene.</p></div><a :href="BASE">Devre deneyine geç <span aria-hidden="true">→</span></a></div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.neuron-lesson{max-width:1320px;padding-bottom:64px;outline:none}.lesson-intro{display:flex;gap:35px;align-items:flex-start;justify-content:space-between;padding:52px 0 32px}.lesson-eyebrow,.section-number,.demo-eyebrow{font:10px/1.7 var(--mono,monospace);letter-spacing:1.2px;color:var(--theme-muted, #596b5e)}.lesson-intro h1{font:400 62px/1.1 var(--serif,Georgia,serif);letter-spacing:-2px;margin:18px 0 22px}.lesson-intro h1 em{color:var(--theme-muted, #466f5d)}.lesson-summary{max-width:680px;font-size:17px;line-height:1.9}.lesson-duration{font-size:12px;line-height:1.8;color:var(--theme-muted, #5d6962);margin-top:17px}.lesson-reset,.demo-button{background:var(--theme-surface-soft, #eef1e5);border:1px solid var(--theme-border, #c6cfbb);border-radius:5px;color:var(--theme-text, #344e3b);font-size:12px;line-height:1.5;padding:12px 16px;min-height:44px}.lesson-reset{flex:none;margin-top:21px}.lesson-boundary{border-left:3px solid #7b9471;padding:17px 21px;background:var(--theme-surface-soft, #eaf0e2);font-size:13px;line-height:1.9}.lesson-boundary strong{font-weight:600}.lesson-boundary p{margin-top:5px}.lesson-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:48px;margin-top:48px}.lesson-navigation{align-self:start;position:sticky;top:24px}.lesson-navigation nav{display:grid;gap:4px}.lesson-navigation nav>p{margin-bottom:12px}.lesson-navigation a{display:flex;gap:12px;padding:10px 8px;font-size:12px;line-height:1.6;border-bottom:1px solid var(--theme-border, #daddd2)}.lesson-navigation a span{font:10px/1.9 var(--mono,monospace);color:var(--theme-muted, #5f6a56);width:18px;flex:none}.lesson-navigation a:hover{background:var(--theme-surface-soft, #e9eedf)}.navigation-note{font-size:11px;line-height:1.9;color:var(--theme-muted, #5d6962);margin-top:21px}.lesson-body{max-width:870px;min-width:0}.lesson-section{scroll-margin-top:26px;padding:0 0 48px;margin-bottom:44px;border-bottom:1px solid var(--theme-border, #daddd2)}.lesson-section h2{font:400 32px/1.3 var(--serif,Georgia,serif);letter-spacing:-.7px;margin:12px 0 20px}.section-lead{font-size:17px;line-height:1.9;margin-bottom:21px}.lesson-paragraph{font-size:14px;line-height:2;color:var(--theme-text, #435649);margin:17px 0}.lesson-demo{background:var(--theme-surface, #fafbf5);border:1px solid var(--theme-border, #ccd5c2);border-radius:9px;margin-top:28px;padding:24px;min-width:0}.demo-eyebrow{margin-bottom:18px;color:var(--theme-muted, #636951)}.model-note{border-top:1px solid var(--theme-border, #daddd2);padding-top:17px;margin-top:22px;font-size:12px;line-height:1.9;color:var(--theme-muted, #5d6a5a)}.model-note strong{font-weight:600}.slider-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.slider-grid label{display:flex;align-items:baseline;justify-content:space-between;gap:15px;font-size:12px;line-height:1.8;margin-bottom:8px}.slider-grid label output{font:12px/1.7 var(--mono,monospace);color:var(--theme-text, #345b45)}.slider-grid input[type=range]{display:block;height:30px;width:100%;margin:0;accent-color:#46785a}.demo-readouts{display:flex;flex-wrap:wrap;gap:22px;border-top:1px solid var(--theme-border, #dde1d4);margin-top:21px;padding-top:18px}.demo-readouts>div{display:flex;flex:1 1 140px;min-width:0;flex-direction:column;gap:8px}.demo-readouts span{font-size:11px;line-height:1.8;color:var(--theme-muted, #5d6a58)}.demo-readouts output{font:19px/1.5 var(--mono,monospace);color:var(--theme-text, #294e3a)}.demo-readouts strong{font-size:13px;line-height:1.8;font-weight:500}.inline-sources{font-size:11px;line-height:2;color:var(--theme-muted, #5d6a57);margin-top:23px;overflow-wrap:anywhere}.inline-sources a,.lesson-source-section a{text-decoration:underline;text-decoration-color:var(--theme-border, #aebda5);text-underline-offset:3px}.inline-sources a:hover,.lesson-source-section a:hover{color:var(--theme-text, #274f3a)}.inline-sources strong{font-weight:500}.neuron-drawing{width:100%;display:block;margin:0 0 20px;background:var(--theme-surface-soft, #f0f2e7);border-radius:6px}.drawing-part{color:var(--theme-muted, #596b5a);cursor:pointer}.drawing-part.chosen{color:var(--theme-text, #234533)}.drawing-part:hover{color:var(--theme-muted, #35533f)}.part-number{fill:var(--theme-surface, #fafbf5);stroke:currentColor;stroke-width:3}.drawing-part text{font:24px var(--mono,monospace);fill:currentColor;text-anchor:middle}.part-buttons{display:flex;gap:7px;flex-wrap:wrap}.part-buttons button{font-size:12px;line-height:1.6;min-height:44px;padding:10px 11px;border:1px solid var(--theme-border, #cbd5c0);background:var(--theme-surface, #f7f9ee);border-radius:5px;color:var(--theme-muted, #456044)}.part-buttons button span{font:10px var(--mono,monospace);margin-right:7px}.part-buttons button[aria-pressed=true]{background:#365b42;color:#f5f6e9;border-color:#365b42}.part-inspector{padding-top:22px;min-height:170px}.part-inspector h3{font:400 23px var(--serif,Georgia,serif);margin:0 0 10px}.part-inspector p{font-size:13px;line-height:1.95;color:var(--theme-text, #435649)}.part-inspector .try-question{font-size:12px;color:var(--theme-muted, #596c50);margin-top:12px}.chemical-steps{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:27px}.chemical-steps>div{border:1px solid var(--theme-border, #cbd5c0);border-radius:7px;padding:19px;background:var(--theme-surface-soft, #eef1e5)}.chemical-steps span{font:10px var(--mono,monospace);color:var(--theme-muted, #5e6a55)}.chemical-steps h3{font:400 22px var(--serif,Georgia,serif);margin:13px 0 9px}.chemical-steps p{font-size:12px;line-height:1.8}.effect-bars{display:grid;gap:13px;margin-top:24px}.effect-bars>div{display:grid;grid-template-columns:112px 1fr;align-items:center;gap:12px}.effect-bars span{font-size:11px}.effect-bars i{height:12px;border-radius:3px;background:var(--theme-surface-soft, #e7ecde);overflow:hidden}.effect-bars b{height:100%;display:block;background:#51795a}.effect-bars .inhibitory-bar b{background:#a26455}.demo-button{margin-top:17px}.demo-button[aria-pressed=true]{border-color:#5c7d52;background:var(--theme-surface-soft, #e1ead6)}.coupled-cells{display:flex;align-items:center;justify-content:center;gap:35px;margin-top:25px}.coupled-cells>span{width:90px;height:90px;border:2px solid #7f9771;background:var(--theme-surface-soft, #e6eedc);border-radius:50%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:9px;font:19px var(--serif,Georgia,serif)}.coupled-cells b{font:13px var(--mono,monospace);font-weight:400}.coupled-cells i{font-style:normal;font-size:30px;color:var(--theme-info, #53697c)}.check-controls{display:flex;flex-direction:column;gap:12px;justify-content:center}.check-controls label{justify-content:flex-start;align-items:center;gap:10px;margin:0;min-height:35px}.check-controls input{width:18px;height:18px;accent-color:#46785a;margin:0;flex:none}.small-circuit{display:flex;justify-content:center;align-items:center;gap:24px;margin:28px 0 8px;min-height:106px}.small-circuit>span{width:65px;height:65px;border-radius:50%;background:var(--theme-surface-soft, #e5ecda);border:2px solid #7d9470;display:flex;align-items:center;justify-content:center;font:24px var(--serif,Georgia,serif);position:relative}.small-circuit i{font:29px var(--serif,Georgia,serif);color:var(--theme-muted, #4f6e4c)}.small-circuit i.negative{color:var(--theme-danger, #92574b)}.small-circuit i.muted{color:var(--theme-muted, #808878)}.small-circuit small{position:absolute;top:74px;white-space:nowrap;font:10px var(--mono,monospace);color:var(--theme-muted, #606a58)}.lesson-equations{border-top:1px solid var(--theme-border, #daddd2);margin-top:19px;padding-top:15px;font-size:12px;line-height:1.9}.lesson-equations summary{cursor:pointer;min-height:32px}.lesson-equations p{margin-top:13px}.lesson-equations code{font:11px/2 var(--mono,monospace);display:block;margin-top:14px;background:var(--theme-surface-soft, #edf1e4);padding:12px;overflow-wrap:anywhere}.lesson-glossary{margin:25px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:0 24px}.lesson-glossary>div{padding:14px 0;border-bottom:1px solid var(--theme-border, #daddd2)}.lesson-glossary dt{font-size:13px;font-weight:600;line-height:1.7}.lesson-glossary dd{font-size:12px;line-height:1.9;margin:5px 0 0;color:var(--theme-muted, #5b6b5a)}.quiz-progress{font:11px/1.8 var(--mono,monospace);color:var(--theme-muted, #576d4d);margin:20px 0 24px}.quiz-question{border:1px solid var(--theme-border, #ced7c4);border-radius:7px;padding:19px;margin:0 0 22px;background:var(--theme-surface, #fafbf5);min-width:0}.quiz-question legend{font-size:14px;line-height:1.8;font-weight:500;padding:0 7px;max-width:100%}.quiz-question legend span{font:12px var(--mono,monospace);color:var(--theme-muted, #5b6b4f)}.quiz-question label{display:flex;gap:11px;align-items:flex-start;font-size:13px;line-height:1.8;padding:11px 10px;border-radius:5px;margin-top:5px;cursor:pointer;min-height:44px}.quiz-question label.selected{background:var(--theme-surface-soft, #eaf0e1)}.quiz-question label:hover{background:var(--theme-surface-soft, #eef2e7)}.quiz-question input{margin:5px 0 0;width:17px;height:17px;flex:none;accent-color:#416b4f}.quiz-feedback{font-size:12px;line-height:1.9;border-left:3px solid #a57b40;background:var(--theme-surface-soft, #f3eddf);padding:12px 14px;margin-top:15px}.quiz-feedback[data-correct=true]{border-color:#71965f;background:var(--theme-surface-soft, #e9f0df)}.quiz-feedback strong{font-weight:600}.lesson-source-section ul{padding-left:20px;margin:21px 0 0}.lesson-source-section li{font-size:12px;line-height:1.9;margin-bottom:11px;overflow-wrap:anywhere}.lesson-next{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:28px;background:var(--theme-surface-soft, #e8eddf);border:1px solid var(--theme-border, #c9d3be);border-radius:8px}.lesson-next h2{font:400 27px/1.4 var(--serif,Georgia,serif);margin:12px 0}.lesson-next p:not(.lesson-eyebrow){font-size:12px;line-height:1.9;max-width:400px}.lesson-next a{padding:13px 17px;border-radius:5px;background:#35583e;color:#f8f7e8;font-size:12px;line-height:1.8;white-space:nowrap}.lesson-next a span{margin-left:11px}
@media(max-width:1050px){.lesson-layout{grid-template-columns:165px minmax(0,1fr);gap:28px}.lesson-demo{padding:20px}.lesson-intro h1{font-size:56px}.lesson-next{align-items:flex-start;flex-direction:column}}
@media(max-width:760px){.lesson-intro{padding:34px 0 27px;flex-direction:column;gap:20px}.lesson-intro h1{font-size:47px;letter-spacing:-1.5px;margin:16px 0 19px}.lesson-summary{font-size:15px}.lesson-duration{font-size:11px}.lesson-reset{margin:0}.lesson-boundary{padding:15px 17px;font-size:12px}.lesson-layout{grid-template-columns:1fr;gap:32px;margin-top:30px}.lesson-navigation{position:static}.lesson-navigation nav{display:flex;flex-wrap:wrap;gap:7px}.lesson-navigation nav>p{width:100%;margin-bottom:3px}.lesson-navigation a{font-size:11px;padding:8px 10px;border:1px solid var(--theme-border, #cbd4c0);border-radius:4px;gap:7px}.navigation-note{margin-top:14px}.lesson-section{padding-bottom:34px;margin-bottom:32px}.lesson-section h2{font-size:28px}.section-lead{font-size:15px}.lesson-paragraph{font-size:13px;line-height:2}.lesson-demo{padding:18px 14px;margin-top:24px}.slider-grid{grid-template-columns:1fr;gap:17px}.demo-readouts{gap:18px}.demo-readouts>div{flex-basis:110px}.demo-readouts output{font-size:17px}.part-buttons{display:grid;grid-template-columns:1fr 1fr}.part-buttons button{text-align:left;font-size:11px;padding:10px}.part-inspector{min-height:0}.chemical-steps{grid-template-columns:1fr;gap:10px}.chemical-steps>div{padding:17px;display:grid;grid-template-columns:35px 1fr;gap:0 10px}.chemical-steps h3{font-size:21px;margin:0 0 8px}.chemical-steps span{align-self:center}.chemical-steps p{grid-column:2}.lesson-glossary{grid-template-columns:1fr}.quiz-question{padding:15px 10px}.quiz-question legend{font-size:13px}.quiz-question label{font-size:12px}.coupled-cells{gap:23px}.coupled-cells>span{width:79px;height:79px}.small-circuit{gap:15px}.small-circuit>span{width:57px;height:57px}.small-circuit small{top:66px}.lesson-next{padding:23px}.lesson-next h2{font-size:25px}.lesson-next a{width:100%;text-align:center}.inline-sources{font-size:10px}}
@media(prefers-reduced-motion:reduce){.neuron-lesson *{scroll-behavior:auto!important}}
</style>
