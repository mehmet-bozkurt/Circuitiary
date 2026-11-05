<script setup lang="ts">
import TermText from './TermText.vue'
import { computed, onMounted, reactive } from 'vue'
import GuidedTracePlot from '../learning/GuidedTracePlot.vue'
import { guidedPrinciples, guidedSteps } from '../learning/guidedContent'
import type { GuidedStepId } from '../learning/guidedContent'
import { lessonSources } from '../learning/lessonContent'
import { runGuidedExperiment } from '../learning/guidedExperiments'
import type { GuidedRunSnapshot } from '../learning/guidedExperiments'
import { decimal } from '../format'
import { BASE, withBase } from '../siteBase'

const emit = defineEmits<{ ready: [] }>()
onMounted(() => emit('ready'))

interface ExperimentState {
  prediction: string
  connectionId: 'I3-O1' | 'I4-O1'
  tauMs: number
  runNumber: number
  snapshot: GuidedRunSnapshot | null
  recordedPrediction: string
  recordedConnectionId: 'I3-O1' | 'I4-O1'
  recordedTauMs: number
  error: string
  statusMessage: string
}
const newState = (): ExperimentState => ({ prediction: '', connectionId: 'I3-O1', tauMs: 90, runNumber: 0, snapshot: null, recordedPrediction: '', recordedConnectionId: 'I3-O1', recordedTauMs: 90, error: '', statusMessage: '' })
const biologicalReadings = ['receptors', 'inhibition', 'action'] as const
const experiments = reactive<Record<GuidedStepId, ExperimentState>>({ stimulus: newState(), connection: newState(), tau: newState() })
const completedCount = computed(() => guidedSteps.filter(step => experiments[step.id].snapshot !== null).length)
const format = (value: number, digits = 3) => decimal(value, digits)
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`
const metricTime = (value: number | null) => value === null ? '—' : `${format(value, 0)} ms`
const edgeLabel = (id: string) => id === 'I4-O1' ? 'I4→O1 (baskılayıcı, −0,3)' : 'I3→O1 (uyarıcı, +1)'
const predictionText = (id: GuidedStepId, prediction: string) => guidedSteps.find(step => step.id === id)?.predictionOptions.find(option => option.id === prediction)?.label ?? 'Tahmin eklenmedi'
function stale(id: GuidedStepId): boolean {
  const state = experiments[id]
  return state.snapshot !== null && (id === 'connection' ? state.connectionId !== state.recordedConnectionId : id === 'tau' ? state.tauMs !== state.recordedTauMs : false)
}
function predictionChanged(id: GuidedStepId): boolean {
  const state = experiments[id]
  return state.snapshot !== null && state.prediction !== state.recordedPrediction
}
function runExperiment(id: GuidedStepId) {
  const state = experiments[id]
  try {
    const options = id === 'connection' ? { connectionId: state.connectionId } : id === 'tau' ? { comparisonTauMs: state.tauMs } : {}
    const snapshot = runGuidedExperiment(id, state.runNumber + 1, options)
    state.snapshot = snapshot
    state.runNumber = snapshot.runNumber
    state.recordedPrediction = state.prediction
    state.recordedConnectionId = state.connectionId
    state.recordedTauMs = state.tauMs
    state.error = ''
    state.statusMessage = `Koşul kaydı #${snapshot.runNumber} hazır. İki koşulun grafiği ve hesaplanan O1 ölçütleri sonuç bölümünde.`
  } catch {
    state.error = 'Bu ayarlarla hesap tamamlanamadı. Ayarları kontrol edip yeniden çalıştır.'
  }
}
function resetExperiment(id: GuidedStepId) {
  Object.assign(experiments[id], newState())
  experiments[id].statusMessage = 'Bu deney sıfırlandı. Ayarlar başlangıca döndü; önceki sonuç ve tahmin kaydı temizlendi.'
}
function resetAll() { guidedSteps.forEach(step => resetExperiment(step.id)) }
function peakTrend(snapshot: GuidedRunSnapshot): 'increase' | 'decrease' | 'similar' {
  return Math.abs(snapshot.delta.peak) <= 1e-8 ? 'similar' : snapshot.delta.peak > 0 ? 'increase' : 'decrease'
}
// "Yakın veya aynı" accepts a peak change below 5% of the reference peak; the
// exact direction still counts for an increase/decrease prediction.
const nearPeakFraction = 0.05
function peakIsNear(snapshot: GuidedRunSnapshot): boolean {
  return Math.abs(snapshot.delta.peak) <= nearPeakFraction * Math.max(snapshot.baseline.metrics.peak, 1e-8)
}
function resultExplanation(id: GuidedStepId): string {
  const state = experiments[id]
  const snapshot = state.snapshot
  if (!snapshot) return ''
  const trend = peakTrend(snapshot)
  const observation = trend === 'increase' ? `O1’in tepe değeri ${format(snapshot.delta.peak)} arttı.` : trend === 'decrease' ? `O1’in tepe değeri ${format(-snapshot.delta.peak)} azaldı.` : 'İki koşulda O1’in tepe değeri aynı veya sayısal olarak çok yakın.'
  if (id === 'stimulus') return `${observation} Bu kayıt yalnız 0,40 ve 0,80 uyaranlarının karşılaştırmasıdır. Tepe zamanını ve 0,10 düzeyine ulaşma zamanını ayrı oku: sabit bir düzeye daha erken ulaşmak, sinyalin biyolojik iletim hızının arttığını göstermez. Bu karşılaştırmada hiçbir hücre 0–1 üst sınırına ulaşmaz; bu yüzden devre orantılı davranır ve bütün hücrelerin eğrisi tam iki katına çıkar. Baskılayıcı kol da aynı oranda büyüdüğü için tepe zamanı değişmez. Uyaran üst sınıra çarpacak kadar büyük olsaydı bu orantı bozulurdu.`
  if (id === 'connection') {
    const reason = state.recordedConnectionId === 'I4-O1'
      ? 'Baskılayıcı I4→O1 katkısı kaldırıldı. I3’ün uyarıcı girdisine karşı koyan negatif katkı artık eklenmiyor; I4 hücresi ise etkin kalıyor.'
      : snapshot.comparison.metrics.peak === 0
        ? 'Uyarıcı I3→O1 katkısı kaldırıldı. Kalan I4→O1 girdisi negatif; 0–1 sınırlaması bunu 0 hedef aktivitesine çeviriyor. O1 sıfırdan başladığı için bu koşulda sıfır kalıyor. I3 ve O1 hücreleri kapatılmadı.'
        : 'Uyarıcı I3→O1 katkısı kaldırıldı; I3 ve O1 hücreleri kapatılmadı. Sonucu kalan girdiler ve 0–1 sınırlaması belirliyor.'
    return `${observation} ${reason} Diğer bağlantılar korunuyor. Bu özel devrenin sonucu, her bağlantı kaldırma deneyine genellenmez.`
  }
  return `${observation} Bu kayıtta yalnız O1’in τ değeri 30’dan ${state.recordedTauMs} model ms’ye değişti. Diğer yedi hücre 30 ms’de kaldı. Tepe zamanı, 0,10 düzeyine ulaşma gecikmesi ve uyaran sonrasındaki düşüş aynı şeyi ölçmez; eğriyle birlikte karşılaştır.`
}
function predictionExplanation(id: GuidedStepId): string {
  const state = experiments[id]
  if (!state.snapshot) return ''
  if (!state.recordedPrediction) return 'Bu koşul kaydına tahmin eklenmedi. Sonuç yine tam olarak hesaplandı; şimdi gözlemini kendi cümlenle anlatabilirsin.'
  if (state.recordedPrediction === 'unsure') return '“Emin değilim” seçeneğiyle çalıştırdın. Şimdi sayısal farkı ve eğriyi kullanarak bir açıklama kurabilirsin.'
  if (state.recordedPrediction === 'similar' && peakTrend(state.snapshot) !== 'similar' && peakIsNear(state.snapshot)) return 'Kaydettiğin “yakın” tahmini bu koşulla örtüşüyor: tepe değişimi temel tepenin %5’inden küçük. Küçük de olsa değişimin yönünü eğride ve tabloda oku.'
  return state.recordedPrediction === peakTrend(state.snapshot) ? 'Kaydettiğin tahmin bu koşuldaki tepe değişimiyle örtüşüyor. Nedenini devrenin girdileri üzerinden anlatmayı dene.' : 'Tepe değişimi kaydettiğin tahminden farklı. Hangi varsayımını değiştireceğini düşün; yeni ayarlarla tekrar karşılaştırabilirsin.'
}
const endValue = (snapshot: GuidedRunSnapshot, condition: 'baseline' | 'comparison') => snapshot[condition].result.activity.O1?.at(-1) ?? 0
</script>

<template>
  <main id="guided-experiments" tabindex="-1" class="guided-page">
    <header class="guided-intro"><div><p class="guided-eyebrow">CIRCUITIARY / ÖĞRENME NOTLARI / 02</p><h1 id="guided-title" tabindex="-1">Rehberli deneyler</h1><p class="guided-summary">Bir şeyi değiştir. Önce tahmin et, sonra çalıştır. Sonucu bir sayı ve bir gerekçeyle anlat.</p><p class="guided-meta">Üç bağımsız deney · Yaklaşık 15–25 dakika · Sekiz hücreli öğretici devre</p></div><button type="button" class="guided-reset" @click="resetAll">Rehberli deneyleri sıfırla</button></header>

    <div class="guided-boundary"><strong>Model üzerinde kontrollü bir karşılaştırma</strong><p>Bu sayfa, mevcut sekiz hücreli örnek devrenin aynı simülasyon motorunu kullanır. Gerçek hayvan verisi değildir. Her çalıştırmada temel koşul ile tek değişiklik içeren koşul yeniden hesaplanır; ana devre deneyindeki ayarların değişmez. Aktivite boyutsuzdur, ms modelin zaman ölçeğidir.</p></div>
    <nav class="guided-navigation" aria-label="Rehberli deney adımları"><a v-for="(step, index) in guidedSteps" :key="step.id" :href="`#guided-${step.id}`"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ step.short }}<small>{{ stale(step.id) ? 'Yeni ayar bekliyor' : experiments[step.id].snapshot ? 'Kayıt var' : 'Henüz çalışmadı' }}</small></a></nav>
    <div class="guided-progress"><span data-testid="guided-progress">{{ completedCount }}/3 deney çalıştırıldı</span><a :href="withBase('/ogren/norondan-devreye')">Önce nörondan devreye dersini oku <span aria-hidden="true">↗</span></a></div>

    <section v-for="(step, index) in guidedSteps" :id="`guided-${step.id}`" :key="step.id" :data-experiment-id="step.id" :aria-labelledby="`guided-${step.id}-title`" class="guided-experiment">
      <div class="experiment-heading"><p class="guided-eyebrow">DENEY {{ String(index + 1).padStart(2, '0') }} / 03</p><h2 :id="`guided-${step.id}-title`"><TermText :text="step.title" /></h2><p class="experiment-question"><TermText :text="step.question" /></p><p class="experiment-introduction"><TermText :text="step.introduction" /></p></div>
      <div class="experiment-workspace">
        <div class="experiment-plan">
          <h3>1. Koşulları karşılaştır</h3>
          <dl class="controlled-conditions"><div><dt>Değişen</dt><dd><TermText :text="step.changed" /></dd></div><div><dt>Sabit tutulan</dt><dd><TermText :text="step.held" /></dd></div></dl>
          <table class="conditions-table"><caption>Yeni çalıştırma için koşullar</caption><thead><tr><th scope="col">Değişken</th><th scope="col">Temel</th><th scope="col">Değişiklik</th></tr></thead><tbody><tr v-if="step.id === 'stimulus'"><th scope="row">S1 uyaranı</th><td>0,40</td><td>0,80</td></tr><tr v-else-if="step.id === 'connection'"><th scope="row"><TermText :text="experiments.connection.connectionId === 'I4-O1' ? 'I4→O1' : 'I3→O1'" /></th><td>Bağlantı açık</td><td>Katkısı kaldırılır</td></tr><tr v-else><th scope="row">O1’in τ değeri</th><td>30 ms</td><td><TermText :text="experiments.tau.tauMs" /> ms</td></tr></tbody></table>
          <div v-if="step.id === 'connection'" class="draft-control"><label for="guided-connection-edge">Kaldırılacak bağlantı</label><select id="guided-connection-edge" v-model="experiments.connection.connectionId"><option value="I3-O1">I3→O1 · uyarıcı (+1)</option><option value="I4-O1">I4→O1 · baskılayıcı (−0,3)</option></select></div>
          <div v-if="step.id === 'tau'" class="draft-control"><label for="guided-tau-value">O1’in yeni zaman sabiti <output for="guided-tau-value">{{ experiments.tau.tauMs }} ms</output></label><input id="guided-tau-value" v-model.number="experiments.tau.tauMs" type="range" min="40" max="180" step="10" /><p>Diğer yedi hücrede τ = 30 ms. Uyaran ve bağlantılar aynı.</p></div>
          <h3>2. İstersen tahmin ekle</h3>
          <div class="draft-control"><label :for="`guided-${step.id}-prediction`">{{ step.predictionPrompt }}</label><select :id="`guided-${step.id}-prediction`" v-model="experiments[step.id].prediction"><option value="">Tahmin eklemeden devam et</option><option v-for="option in step.predictionOptions" :key="option.id" :value="option.id">{{ option.label }}</option></select><p>Tahmin isteğe bağlıdır; “emin değilim” de bir başlangıçtır.</p></div>
          <div class="run-actions"><button type="button" class="run-button" :aria-controls="`guided-result-region-${step.id}`" @click="runExperiment(step.id)">{{ experiments[step.id].snapshot ? 'Yeniden çalıştır' : 'Deneyi çalıştır' }} <span aria-hidden="true">→</span></button><button type="button" class="case-reset" @click="resetExperiment(step.id)">Bu deneyi sıfırla</button></div>
          <p :data-testid="`guided-status-${step.id}`" class="guided-status" role="status" aria-live="polite" aria-atomic="true">{{ experiments[step.id].statusMessage }}</p>
          <p v-if="experiments[step.id].error" class="guided-error" role="alert">{{ experiments[step.id].error }}</p>
          <p class="experiment-boundary"><TermText :text="step.boundary" /></p>
        </div>

        <div class="experiment-observation">
          <h3>3. Sonucu oku</h3>
          <div :id="`guided-result-region-${step.id}`" role="region" :aria-label="`${step.short}: hesaplanan sonuç`">
          <div v-if="!experiments[step.id].snapshot" class="not-run"><span aria-hidden="true">↗</span><p>Sonuç henüz hesaplanmadı.</p><p>Koşulları seçip “Deneyi çalıştır” düğmesine bas. Tahmin vermeden de çalıştırabilirsin.</p></div>
          <div v-else :data-testid="`guided-result-${step.id}`" :data-run-number="experiments[step.id].snapshot!.runNumber" :data-stale="stale(step.id)" class="run-result">
            <div class="record-heading"><p>Koşul kaydı #<TermText :text="experiments[step.id].snapshot!.runNumber" /></p><span>{{ stale(step.id) ? 'Önceki ayarların sonucu' : 'Geçerli ayarların sonucu' }}</span></div>
            <p v-if="stale(step.id)" :data-testid="`guided-stale-${step.id}`" class="stale-warning" role="status">Ayar değişti. Aşağıdaki sayılar ve eğriler önceki çalıştırmaya ait. Yeni ayarların sonucunu görmek için yeniden çalıştır.</p>
            <div :data-testid="`guided-run-settings-${step.id}`" :data-baseline-amplitude="experiments[step.id].snapshot!.baseline.result.settings.stimulus.amplitude" :data-comparison-amplitude="experiments[step.id].snapshot!.comparison.result.settings.stimulus.amplitude" :data-baseline-o1-tau="experiments[step.id].snapshot!.baseline.result.settings.tauOverrides?.O1 ?? experiments[step.id].snapshot!.baseline.result.settings.tauMs" :data-comparison-o1-tau="experiments[step.id].snapshot!.comparison.result.settings.tauOverrides?.O1 ?? experiments[step.id].snapshot!.comparison.result.settings.tauMs" :data-silenced-connection="experiments[step.id].snapshot!.comparison.result.settings.silencedConnectionId ?? ''" class="record-settings"><strong>Bu kayıtta karşılaştırılan:</strong><p v-if="step.id === 'stimulus'">S1 uyaranı 0,40 → 0,80.</p><p v-else-if="step.id === 'connection'"><TermText :text="edgeLabel(experiments[step.id].recordedConnectionId)" /> açık → katkısı kaldırılmış.</p><p v-else>Yalnız O1’in τ değeri: 30 → <TermText :text="experiments[step.id].recordedTauMs" /> model ms.</p><p>Uyaran 100–300 ms arasında açık; deney 700 ms, hesap adımı 1 ms. Başlangıç aktivitesi bütün hücrelerde 0.</p><p :data-testid="`guided-recorded-prediction-${step.id}`">Kaydedilen tahmin: <TermText :text="predictionText(step.id, experiments[step.id].recordedPrediction)" /></p></div>
            <p v-if="predictionChanged(step.id)" class="prediction-note">Tahmin seçimin değişti; bu kayıttaki tahmin korunuyor. Yeni seçimin bir sonraki çalıştırmada kaydedilir.</p>
            <GuidedTracePlot :times-ms="experiments[step.id].snapshot!.baseline.result.timesMs" :baseline="experiments[step.id].snapshot!.baseline.result.activity.O1!" :changed="experiments[step.id].snapshot!.comparison.result.activity.O1!" :baseline-label="experiments[step.id].snapshot!.baseline.label" :changed-label="experiments[step.id].snapshot!.comparison.label" :onset-ms="experiments[step.id].snapshot!.baseline.result.settings.stimulus.onsetMs" :stimulus-duration-ms="experiments[step.id].snapshot!.baseline.result.settings.stimulus.durationMs" />
            <table class="metrics-table"><caption>O1 için hesaplanan ölçütler · bu koşul kaydı</caption><thead><tr><th scope="col">Ölçüt</th><th scope="col">Temel</th><th scope="col">Değişiklik</th></tr></thead><tbody>
              <tr><th scope="row">Tepe aktivite</th><td :data-testid="`guided-${step.id}-baseline-peak`" :data-value="experiments[step.id].snapshot!.baseline.metrics.peak">{{ format(experiments[step.id].snapshot!.baseline.metrics.peak) }}</td><td :data-testid="`guided-${step.id}-comparison-peak`" :data-value="experiments[step.id].snapshot!.comparison.metrics.peak">{{ format(experiments[step.id].snapshot!.comparison.metrics.peak) }}</td></tr>
              <tr><th scope="row">Tepe zamanı</th><td :data-testid="`guided-${step.id}-baseline-peak-time`" :data-value="experiments[step.id].snapshot!.baseline.metrics.peakTimeMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.baseline.metrics.peakTimeMs)" /></td><td :data-testid="`guided-${step.id}-comparison-peak-time`" :data-value="experiments[step.id].snapshot!.comparison.metrics.peakTimeMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.comparison.metrics.peakTimeMs)" /></td></tr>
              <tr><th scope="row">0,10 düzeyine ulaşma zamanı</th><td :data-testid="`guided-${step.id}-baseline-response-time`" :data-value="experiments[step.id].snapshot!.baseline.metrics.responseTimeMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.baseline.metrics.responseTimeMs)" /></td><td :data-testid="`guided-${step.id}-comparison-response-time`" :data-value="experiments[step.id].snapshot!.comparison.metrics.responseTimeMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.comparison.metrics.responseTimeMs)" /></td></tr>
              <tr><th scope="row">0,10 düzeyine ulaşma gecikmesi</th><td :data-testid="`guided-${step.id}-baseline-response-delay`" :data-value="experiments[step.id].snapshot!.baseline.metrics.responseDelayMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.baseline.metrics.responseDelayMs)" /></td><td :data-testid="`guided-${step.id}-comparison-response-delay`" :data-value="experiments[step.id].snapshot!.comparison.metrics.responseDelayMs ?? 'null'"><TermText :text="metricTime(experiments[step.id].snapshot!.comparison.metrics.responseDelayMs)" /></td></tr>
              <tr><th scope="row">700 ms’de aktivite</th><td :data-testid="`guided-${step.id}-baseline-end`" :data-value="endValue(experiments[step.id].snapshot!, 'baseline')">{{ format(endValue(experiments[step.id].snapshot!, 'baseline')) }}</td><td :data-testid="`guided-${step.id}-comparison-end`" :data-value="endValue(experiments[step.id].snapshot!, 'comparison')">{{ format(endValue(experiments[step.id].snapshot!, 'comparison')) }}</td></tr>
            </tbody></table>
            <p class="reporting-note"><strong>0,10 bir raporlama düzeyidir;</strong> biyolojik ateşleme eşiği değildir. Gecikme, bu düzeye ilk ulaşma zamanından uyaranın başlangıcını (100 ms) çıkarır. “—”, ilgili ölçütün oluşmadığını gösterir; sıfır gecikme anlamına gelmez.</p>
            <p v-if="experiments[step.id].snapshot!.comparison.metrics.peakTimeMs === null" :data-testid="`guided-no-peak-${step.id}`" class="no-response">Değiştirilmiş koşulda tepe oluşmadı: O1 aktivitesi sıfır kaldı.</p>
            <p v-if="experiments[step.id].snapshot!.comparison.metrics.responseTimeMs === null" :data-testid="`guided-no-response-${step.id}`" class="no-response">Değiştirilmiş koşulda O1, 0,10 raporlama düzeyine ulaşmadı.</p>
            <div class="result-meaning"><p class="guided-eyebrow">BU SAYILAR NE SÖYLÜYOR?</p><p :data-testid="`guided-explanation-${step.id}`"><TermText :text="resultExplanation(step.id)" /></p><p :data-testid="`guided-prediction-feedback-${step.id}`"><TermText :text="predictionExplanation(step.id)" /></p><p class="peak-difference">Tepe farkı (değişiklik − temel): <output :data-testid="`guided-peak-difference-${step.id}`" :data-value="experiments[step.id].snapshot!.delta.peak">{{ signed(experiments[step.id].snapshot!.delta.peak) }}</output></p></div>
            <p class="observe-prompt"><strong>Kendi cümlenle:</strong> <TermText :text="step.observe" /></p>
          </div>
          </div>
        </div>
      </div>
    </section>

    <section id="guided-assumptions" aria-labelledby="guided-assumptions-title" class="guided-assumptions"><div><p class="guided-eyebrow">DENEYİ OKUMA ALIŞKANLIĞI</p><h2 id="guided-assumptions-title">Sonuç kadar koşulları da sakla.</h2><p>Bu üç karşılaştırma, yalnız belirtilen devrenin ve dinamiğin sonuçlarıdır. Hücrelerin davranışını, bir hayvanın bedenini veya zihnini doğrulamaz.</p></div><div><ol><li v-for="principle in guidedPrinciples" :key="principle"><TermText :text="principle" /></li></ol><details><summary>Kullanılan dinamik ve kaynak</summary><p>Mevcut öğretici model: τᵢ dxᵢ/dt = −xᵢ + clip(Σⱼ Wᵢⱼ xⱼ + Iᵢ(t), 0, 1). Bu örnek devrede elektriksel bağ yoktur. İşaretler ve ağırlıklar elle seçilmiştir; fizyolojik ölçüm değildir. Hesap önceki adımdaki bütün hücre değerlerini kullanır.</p><p>İlk derste <a :href="withBase('/ogren/norondan-devreye#lesson-circuit')">anatomik harita, dinamik model ve biyolojik doğrulama arasındaki ayrımı</a> ve <a :href="withBase('/ogren/norondan-devreye#lesson-sources')">kurumsal okumalar ile özgün araştırmaları</a> bulabilirsin.</p></details><div class="guided-readings"><p><strong>Biyolojik kavramlar için okuma:</strong><TermText text=" Bu kaynaklar reseptörleri, uyarıcı/baskılayıcı yanıtları ve sinyalleri açıklar. Buradaki sayısal model parametrelerinin ölçüldüğü veya doğrulandığı kaynaklar olarak kullanılmaz." /></p><ul><li v-for="sourceId in biologicalReadings" :key="sourceId"><a :href="lessonSources[sourceId].url">{{ lessonSources[sourceId].title }}</a></li></ul></div></div></section>
    <div class="guided-next"><a :href="withBase('/ogren/norondan-devreye')">Nörondan devreye dersine dön <span aria-hidden="true">←</span></a><a :href="BASE" class="experiment-link">Devre deneyine geç <span aria-hidden="true">→</span></a></div>
  </main>
</template>

<style scoped>
.guided-status{font-size:11px;line-height:1.9;color:var(--theme-muted, #556d4c);margin-top:12px;min-height:21px}.guided-readings{border-top:1px solid var(--theme-border, #daddd2);padding-top:17px;margin-top:20px}.guided-readings strong{font-weight:500}.guided-readings ul{padding-left:18px;margin:14px 0 0}.guided-readings li{font-size:11px;line-height:1.9;margin-bottom:9px;overflow-wrap:anywhere}
.guided-page{padding-bottom:65px;outline:none}.guided-intro{padding:52px 0 32px;display:flex;align-items:flex-start;justify-content:space-between;gap:35px}.guided-eyebrow{font:10px/1.8 var(--mono,monospace);letter-spacing:1.2px;color:var(--theme-muted, #596b56)}.guided-intro h1{font:400 61px/1.1 var(--serif,Georgia,serif);letter-spacing:-2px;margin:19px 0 23px}.guided-summary{font-size:17px;line-height:1.9;max-width:660px}.guided-meta{font-size:12px;line-height:1.8;color:var(--theme-muted, #5c6a5a);margin-top:16px}.guided-reset{background:var(--theme-surface-soft, #ecf0e4);border:1px solid var(--theme-border, #c4d0bc);border-radius:5px;color:var(--theme-text, #3d5840);padding:12px 15px;min-height:44px;font-size:12px;line-height:1.7;flex:none;margin-top:22px}.guided-boundary{padding:17px 21px;border-left:3px solid #7c9571;background:var(--theme-surface-soft, #eaf0e2);font-size:13px;line-height:1.9}.guided-boundary strong{font-weight:600}.guided-boundary p{margin-top:6px}.guided-navigation{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:28px}.guided-navigation a{display:grid;grid-template-columns:26px 1fr;gap:8px 10px;border:1px solid var(--theme-border, #cbd4c1);border-radius:6px;padding:15px 17px;font-size:13px;line-height:1.7;background:var(--theme-surface, #f8f9f0)}.guided-navigation a:hover{background:var(--theme-surface-soft, #ecf1e3)}.guided-navigation a>span{font:11px/2 var(--mono,monospace);color:var(--theme-muted, #5e6a52)}.guided-navigation small{grid-column:2;font-size:10px;color:var(--theme-muted, #5d6b54)}.guided-progress{display:flex;justify-content:space-between;gap:20px;font-size:11px;line-height:1.9;padding:17px 0 31px;color:var(--theme-muted, #5a6b56)}.guided-progress>span{font-family:var(--mono,monospace)}.guided-progress a{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--theme-border, #aab99f)}.guided-experiment{border-top:1px solid var(--theme-border, #daddd2);padding:38px 0 44px;scroll-margin-top:25px}.experiment-heading{max-width:850px}.experiment-heading h2{font:400 32px/1.4 var(--serif,Georgia,serif);letter-spacing:-.7px;margin:12px 0 15px}.experiment-question{font-size:17px;line-height:1.9;margin-bottom:15px}.experiment-introduction{font-size:14px;line-height:2;color:var(--theme-muted, #4c624c)}.experiment-workspace{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:25px;margin-top:28px;align-items:start}.experiment-plan,.experiment-observation{padding:24px;border:1px solid var(--theme-border, #ccd5c1);border-radius:8px;background:var(--theme-surface, #fafbf5);min-width:0}.experiment-plan{background:var(--theme-surface-soft, #eff3e8)}.experiment-workspace h3{font:400 23px/1.5 var(--serif,Georgia,serif);margin:0 0 20px;letter-spacing:-.4px}.controlled-conditions{margin:0 0 21px}.controlled-conditions>div{display:grid;grid-template-columns:93px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--theme-border, #d3ddc7);font-size:12px;line-height:1.9}.controlled-conditions dt{font-weight:500;color:var(--theme-muted, #556d4e)}.controlled-conditions dd{margin:0;color:var(--theme-muted, #4c5f49)}.conditions-table,.metrics-table{width:100%;border-collapse:collapse;font-size:11px;line-height:1.8;table-layout:fixed}.conditions-table caption,.metrics-table caption{text-align:left;font-size:11px;font-weight:500;margin-bottom:9px;color:var(--theme-muted, #586c51)}.conditions-table th,.conditions-table td,.metrics-table th,.metrics-table td{border-bottom:1px solid var(--theme-border, #d7dfcc);padding:10px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.conditions-table thead,.metrics-table thead{background:var(--theme-surface-soft, #e9efdf)}.conditions-table th,.metrics-table th{font-weight:500}.metrics-table th:first-child{width:48%}.metrics-table td{font-family:var(--mono,monospace);font-size:11px}.conditions-table{margin-bottom:24px}.experiment-plan h3:not(:first-child){margin-top:25px}.draft-control label{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:12px;line-height:1.9;margin:0 0 9px}.draft-control label output{font:12px/1.8 var(--mono,monospace);white-space:nowrap;color:var(--theme-text, #43673b)}.draft-control select{width:100%;font-size:12px;line-height:1.8;min-height:45px;background:var(--theme-surface, #fafbf5);padding:9px}.draft-control input[type=range]{height:32px;display:block;width:100%;margin:0;accent-color:#4a7952}.draft-control p{font-size:11px;line-height:1.9;color:var(--theme-muted, #5a6c51);margin-top:9px}.run-actions{display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-top:25px}.run-button{padding:12px 17px;border-radius:5px;background:#355a3d;color:#f7f8eb;min-height:44px;font-size:12px;line-height:1.7}.run-button span{margin-left:12px}.case-reset{padding:10px 0;min-height:44px;font-size:11px;line-height:1.8;background:transparent;color:var(--theme-muted, #596c50);text-decoration:underline;text-underline-offset:3px}.experiment-boundary{font-size:11px;line-height:1.9;color:var(--theme-muted, #5b6b53);border-top:1px solid var(--theme-border, #d3dcc8);padding-top:17px;margin-top:22px}.not-run{display:flex;min-height:250px;align-items:center;justify-content:center;flex-direction:column;text-align:center;border:1px dashed var(--theme-border, #c6d2ba);border-radius:6px;background:var(--theme-surface, #f3f6ed);padding:27px;color:var(--theme-muted, #5b6b53)}.not-run>span{font:38px var(--serif,Georgia,serif);color:var(--theme-muted, #9bad8c);margin-bottom:14px}.not-run p{font-size:13px;line-height:1.9;max-width:280px}.not-run p+p{font-size:11px;margin-top:12px}.record-heading{display:flex;justify-content:space-between;gap:13px;flex-wrap:wrap;font-size:11px;line-height:1.8;color:var(--theme-muted, #516e48);padding-bottom:14px;border-bottom:1px solid var(--theme-border, #d9e0cf)}.record-heading p{font-family:var(--mono,monospace)}.record-heading span{font-size:10px}.record-settings{font-size:11px;line-height:1.9;color:var(--theme-muted, #596b54);margin-top:17px}.record-settings strong{font-weight:500}.record-settings p{margin-top:8px}.record-settings p:last-child{border-top:1px solid var(--theme-border, #d9e0cf);padding-top:10px;margin-top:13px}.stale-warning,.guided-error{border-left:3px solid #ad843f;background:var(--theme-surface-soft, #f3eddb);padding:12px 14px;font-size:12px;line-height:1.9;color:var(--theme-warning, #77592e);margin-top:16px}.guided-error{border-color:#a76754;background:var(--theme-surface-soft, #f4e9df);color:var(--theme-danger, #865d46)}.prediction-note{font-size:11px;line-height:1.9;color:var(--theme-muted, #726541);border-left:2px solid #b8a76c;padding-left:12px;margin-top:17px}.metrics-table{margin-top:24px}.reporting-note{font-size:11px;line-height:1.9;color:var(--theme-muted, #5c6b54);padding:14px 0;border-bottom:1px solid var(--theme-border, #d7dfcc)}.reporting-note strong{font-weight:500}.no-response{font-size:12px;line-height:1.9;margin-top:12px;color:var(--theme-muted, #6d674c)}.result-meaning{padding:18px;margin-top:20px;background:var(--theme-surface-soft, #eaf1e2);border-radius:6px}.result-meaning>p:not(.guided-eyebrow){font-size:12px;line-height:1.95;margin-top:10px;color:var(--theme-muted, #486441)}.result-meaning .peak-difference{font-size:11px}.peak-difference output{font:14px var(--mono,monospace);margin-left:7px;white-space:nowrap}.observe-prompt{font-size:12px;line-height:1.9;color:var(--theme-muted, #586c4d);margin-top:20px}.observe-prompt strong{font-weight:500}.guided-assumptions{display:grid;grid-template-columns:.7fr 1.3fr;gap:40px;border-top:1px solid var(--theme-border, #daddd2);padding:40px 0 35px}.guided-assumptions h2{font:400 30px/1.4 var(--serif,Georgia,serif);margin:14px 0 19px;letter-spacing:-.6px}.guided-assumptions p,.guided-assumptions li{font-size:12px;line-height:1.95;color:var(--theme-muted, #5a6b55)}.guided-assumptions ol{margin:0;padding-left:22px}.guided-assumptions li{padding-left:6px;margin-bottom:12px}.guided-assumptions details{border-top:1px solid var(--theme-border, #daddd2);margin-top:22px;padding-top:17px}.guided-assumptions summary{font-size:12px;line-height:1.8;cursor:pointer;min-height:35px}.guided-assumptions details p{margin-top:13px}.guided-assumptions a{text-decoration:underline;text-decoration-color:var(--theme-border, #aabc9f);text-underline-offset:3px}.guided-next{display:flex;justify-content:space-between;align-items:center;gap:22px;padding:24px;border:1px solid var(--theme-border, #cbd5bf);border-radius:7px;background:var(--theme-surface-soft, #e9efdf)}.guided-next a{font-size:12px;line-height:1.9;padding:11px 4px}.guided-next span{margin-left:11px}.guided-next .experiment-link{border-radius:5px;background:#35583d;color:#f8f7e8;padding:12px 17px}
@media(max-width:1050px){.guided-intro h1{font-size:54px}.experiment-workspace{gap:18px;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.experiment-plan,.experiment-observation{padding:19px}.guided-reset{font-size:11px}.controlled-conditions>div{grid-template-columns:78px 1fr;gap:9px}.guided-assumptions{gap:26px}}
@media(max-width:760px){.guided-intro{padding:34px 0 26px;flex-direction:column;gap:22px}.guided-intro h1{font-size:46px;letter-spacing:-1.5px;margin:17px 0 19px}.guided-summary{font-size:15px}.guided-meta{font-size:11px}.guided-reset{margin:0}.guided-boundary{padding:15px 17px;font-size:12px}.guided-navigation{grid-template-columns:1fr;gap:8px;margin-top:22px}.guided-navigation a{grid-template-columns:25px 1fr auto;padding:12px 14px;font-size:12px;align-items:center}.guided-navigation small{grid-column:3;font-size:9px}.guided-progress{flex-direction:column;gap:10px;padding:17px 0 24px}.guided-experiment{padding:29px 0 34px}.experiment-heading h2{font-size:28px}.experiment-question{font-size:15px}.experiment-introduction{font-size:13px}.experiment-workspace{grid-template-columns:1fr;gap:15px;margin-top:23px}.experiment-plan,.experiment-observation{padding:20px 15px}.experiment-workspace h3{font-size:22px}.controlled-conditions>div{font-size:11px;grid-template-columns:80px 1fr}.conditions-table,.metrics-table{font-size:10px}.conditions-table th,.conditions-table td,.metrics-table th,.metrics-table td{padding:10px 6px}.metrics-table td{font-size:10px}.metrics-table th:first-child{width:46%}.draft-control label{font-size:12px}.draft-control select{font-size:11px}.run-actions{gap:10px}.not-run{min-height:220px}.result-meaning{padding:16px 13px}.result-meaning>p:not(.guided-eyebrow){font-size:11px}.guided-assumptions{grid-template-columns:1fr;gap:24px;padding:32px 0}.guided-assumptions h2{font-size:27px}.guided-next{flex-direction:column;align-items:stretch;gap:10px;padding:21px}.guided-next a{text-align:center;font-size:11px}.guided-next .experiment-link{padding:12px}.stale-warning{font-size:11px}}
@media(prefers-reduced-motion:reduce){.guided-page *{scroll-behavior:auto!important}}
</style>
