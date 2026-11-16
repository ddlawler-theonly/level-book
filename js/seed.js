// Sample data seeded on first run. Clearly labeled SAMPLE.
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function surveyDefaults(type = 'loop') {
  return {
    id: uid(), name: '', type, method: 'single', observer: '', rodPerson: '', instrument: '',
    stadiaK: 100, spreadTol: 0.003, startBM: { name: 'BM-1', elev: null }, closeBM: { name: '', elev: null },
    standard: '3rd', customK: 0.05, rodLength: 16, imbalanceLimit: 10, maxSight: 300,
    readings: [], closed: false, adjustMethod: 'setups', created: Date.now(), updated: Date.now(),
  };
}

const R = (type, point, value, dist) => ({ id: uid(), type, point, value, text: value.toFixed(2), dist });
const W = (type, point, t, m, b) => ({ id: uid(), type, point, wires: { t, m, b } });

export function seedJobs() {
  const loop = {
    ...surveyDefaults('loop'), name: 'Loop 1 (SAMPLE)', observer: 'D. Lawler', rodPerson: 'J. Ortiz', instrument: 'Auto level AT-B4',
    startBM: { name: 'BM-1', elev: 102.45 }, sample: true,
    readings: [
      R('BS', 'BM-1', 5.31, 150), R('FS', 'TP1', 4.53, 145),
      R('BS', 'TP1', 6.02, 160), R('FS', 'TP2', 6.0, 155),
      R('BS', 'TP2', 4.92, 140), R('IFS', 'PAD NE', 3.18, 95), R('FS', 'TP3', 4.72, 150),
      // Sample continuation back to BM-1 with a small plausible misclosure (+0.010 ft).
      R('BS', 'TP3', 3.86, 130), R('FS', 'BM-1', 4.85, 135),
    ],
    closed: true,
  };
  const run = {
    ...surveyDefaults('run'), name: 'Run 1 – 3-wire (SAMPLE)', method: 'three', observer: 'D. Lawler', rodPerson: 'J. Ortiz',
    instrument: 'Auto level AT-B4', startBM: { name: 'BM-1', elev: 102.45 }, closeBM: { name: 'BM-7', elev: 104.16 }, sample: true,
    readings: [W('BS', 'BM-1', 5.214, 4.72, 4.226), W('FS', 'TP1', 3.512, 3.02, 2.528)],
  };
  const now = Date.now();
  return [
    { id: uid(), name: 'Pearland Tellepson', date: '2026-11-16', description: 'Pad grades, north lot BMs', client: 'SAMPLE DATA', archived: false, created: now, updated: now, surveys: [loop, run] },
  ];
}
