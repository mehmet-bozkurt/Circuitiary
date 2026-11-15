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

/** The same circuit with English text: ids, roles, positions, weights and order are identical to `illustrativeCircuit`. */
export const illustrativeCircuitEn: Circuit = {
  id: 'illustrative-eight-cell',
  name: 'Eight-cell example circuit',
  provenance: 'A circuit designed by hand for learning. The connections and parameters are examples; it contains no biological data or measured physiological parameters.',
  neurons: [
    { id: 'S1', label: 'Input S1', role: 'input', description: 'The default stimulus input. It supplies activity to two excitatory branches.', position: { x: 60, y: 100 } },
    { id: 'S2', label: 'Input S2', role: 'input', description: 'The alternative stimulus input. It connects more strongly to the inhibitory branch.', position: { x: 60, y: 290 } },
    { id: 'I1', label: 'Interneuron I1', role: 'interneuron', description: 'Passes S1 activity to the I3 branch through an excitatory connection.', position: { x: 250, y: 70 } },
    { id: 'I2', label: 'Interneuron I2', role: 'interneuron', description: 'Supplies activity to both the excitatory I3 branch and the inhibitory I4 branch.', position: { x: 250, y: 230 } },
    { id: 'I3', label: 'Interneuron I3', role: 'interneuron', description: 'Combines excitatory inputs and affects both output cells.', position: { x: 460, y: 90 } },
    { id: 'I4', label: 'Inhibitory I4', role: 'interneuron', description: 'With its negative outgoing weights, it reduces the total input reaching the output cells.', position: { x: 460, y: 290 } },
    { id: 'O1', label: 'Output O1', role: 'output', description: 'The main output cell. Silencing the I3 → O1 connection removes its excitatory input.', position: { x: 680, y: 100 } },
    { id: 'O2', label: 'Output O2', role: 'output', description: 'The second output cell. It combines excitatory inputs with a stronger inhibitory input.', position: { x: 680, y: 290 } },
  ],
  connections: [
    { id: 'S1-I1', source: 'S1', target: 'I1', weight: 0.9, evidence: 'illustrative', note: 'Excitatory model weight chosen for the example circuit.' },
    { id: 'S1-I2', source: 'S1', target: 'I2', weight: 0.7, evidence: 'illustrative', note: 'Excitatory model weight chosen for the example circuit.' },
    { id: 'S2-I2', source: 'S2', target: 'I2', weight: 0.3, evidence: 'illustrative', note: 'A weaker alternative excitatory input.' },
    { id: 'S2-I4', source: 'S2', target: 'I4', weight: 0.9, evidence: 'illustrative', note: 'The alternative input activates the inhibitory branch.' },
    { id: 'I1-I3', source: 'I1', target: 'I3', weight: 0.9, evidence: 'illustrative', note: 'Excitatory intermediate connection.' },
    { id: 'I2-I3', source: 'I2', target: 'I3', weight: 0.35, evidence: 'illustrative', note: 'A second excitatory path to the I3 branch.' },
    { id: 'I2-I4', source: 'I2', target: 'I4', weight: 0.8, evidence: 'illustrative', note: 'An excitatory connection that activates the inhibitory interneuron.' },
    { id: 'I3-O1', source: 'I3', target: 'O1', weight: 1, evidence: 'illustrative', note: 'The connection chosen for the silencing comparison.' },
    { id: 'I4-O1', source: 'I4', target: 'O1', weight: -0.3, evidence: 'illustrative', note: 'The negative weight reduces the total input reaching cell O1.' },
    { id: 'I2-O2', source: 'I2', target: 'O2', weight: 0.2, evidence: 'illustrative', note: 'A direct excitatory path to cell O2.' },
    { id: 'I3-O2', source: 'I3', target: 'O2', weight: 0.75, evidence: 'illustrative', note: 'An excitatory path to cell O2.' },
    { id: 'I4-O2', source: 'I4', target: 'O2', weight: -0.55, evidence: 'illustrative', note: 'A stronger inhibitory input to cell O2.' },
  ],
}
