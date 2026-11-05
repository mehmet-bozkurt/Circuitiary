import type { Circuit, SimulationConfig } from './types'

export const illustrativeCircuit: Circuit = {
  id: 'illustrative-eight-cell',
  name: 'Sekiz hücreli örnek devre',
  provenance: 'Öğrenme amacıyla elle tasarlanmış devre. Bağlantılar ve parametreler örnektir; biyolojik veri veya ölçülmüş fizyolojik parametre içermez.',
  neurons: [
    { id: 'S1', label: 'Girdi S1', role: 'input', description: 'Varsayılan uyaran girişidir. İki uyarıcı kola aktivite sağlar.', position: { x: 60, y: 100 } },
    { id: 'S2', label: 'Girdi S2', role: 'input', description: 'Alternatif uyaran girişidir. Baskılayıcı kola daha güçlü bağlanır.', position: { x: 60, y: 290 } },
    { id: 'I1', label: 'Ara nöron I1', role: 'interneuron', description: 'S1 aktivitesini uyarıcı bir bağlantıyla I3 koluna aktarır.', position: { x: 250, y: 70 } },
    { id: 'I2', label: 'Ara nöron I2', role: 'interneuron', description: 'Hem uyarıcı I3 koluna hem de baskılayıcı I4 koluna aktivite sağlar.', position: { x: 250, y: 230 } },
    { id: 'I3', label: 'Ara nöron I3', role: 'interneuron', description: 'Uyarıcı girdileri birleştirir ve iki çıktı hücresini de etkiler.', position: { x: 460, y: 90 } },
    { id: 'I4', label: 'Baskılayıcı I4', role: 'interneuron', description: 'Negatif çıkış ağırlıklarıyla çıktı hücrelerine gelen toplam girdiyi azaltır.', position: { x: 460, y: 290 } },
    { id: 'O1', label: 'Çıktı O1', role: 'output', description: 'Ana çıktı hücresidir. I3 → O1 bağlantısının susturulması uyarıcı girdisini kaldırır.', position: { x: 680, y: 100 } },
    { id: 'O2', label: 'Çıktı O2', role: 'output', description: 'İkinci çıktı hücresidir. Uyarıcı girdilerle daha güçlü baskılayıcı girdiyi birleştirir.', position: { x: 680, y: 290 } },
  ],
  connections: [
    { id: 'S1-I1', source: 'S1', target: 'I1', weight: 0.9, evidence: 'illustrative', note: 'Örnek devre için seçilmiş uyarıcı model ağırlığı.' },
    { id: 'S1-I2', source: 'S1', target: 'I2', weight: 0.7, evidence: 'illustrative', note: 'Örnek devre için seçilmiş uyarıcı model ağırlığı.' },
    { id: 'S2-I2', source: 'S2', target: 'I2', weight: 0.3, evidence: 'illustrative', note: 'Daha zayıf alternatif uyarıcı girdi.' },
    { id: 'S2-I4', source: 'S2', target: 'I4', weight: 0.9, evidence: 'illustrative', note: 'Alternatif girdi, baskılayıcı kolu etkinleştirir.' },
    { id: 'I1-I3', source: 'I1', target: 'I3', weight: 0.9, evidence: 'illustrative', note: 'Uyarıcı ara bağlantı.' },
    { id: 'I2-I3', source: 'I2', target: 'I3', weight: 0.35, evidence: 'illustrative', note: 'I3 koluna ikinci uyarıcı yol.' },
    { id: 'I2-I4', source: 'I2', target: 'I4', weight: 0.8, evidence: 'illustrative', note: 'Uyarıcı bağlantı, baskılayıcı ara nöronu etkinleştirir.' },
    { id: 'I3-O1', source: 'I3', target: 'O1', weight: 1, evidence: 'illustrative', note: 'Susturma karşılaştırması için seçilen bağlantı.' },
    { id: 'I4-O1', source: 'I4', target: 'O1', weight: -0.3, evidence: 'illustrative', note: 'Negatif ağırlık, O1 hücresine gelen toplam girdiyi azaltır.' },
    { id: 'I2-O2', source: 'I2', target: 'O2', weight: 0.2, evidence: 'illustrative', note: 'O2 hücresine doğrudan uyarıcı yol.' },
    { id: 'I3-O2', source: 'I3', target: 'O2', weight: 0.75, evidence: 'illustrative', note: 'O2 hücresine uyarıcı yol.' },
    { id: 'I4-O2', source: 'I4', target: 'O2', weight: -0.55, evidence: 'illustrative', note: 'O2 hücresine daha güçlü baskılayıcı girdi.' },
  ],
}

export const defaultConfig: SimulationConfig = {
  durationMs: 700,
  dtMs: 1,
  tauMs: 30,
  stimulus: { target: 'S1', onsetMs: 100, durationMs: 200, amplitude: 0.8 },
}
