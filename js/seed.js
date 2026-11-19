// Sample data seeded on first run. Clearly labeled SAMPLE.
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function surveyDefaults(type = 'loop') {
  return {
    id: uid(), name: '', type, method: 'single', observer: '', rodPerson: '', instrument: '',
    stadiaK: 100, spreadTol: 0.003, startBM: { name: 'BM-1', elev: null }, closeBM: { name: '', elev: null },
    standard: '3rd', customK: 0.05, rodLength: 16, imbalanceLimit: 10, maxSight: 300,
    readings: [], closed: false, adjustMethod: 'setups', peg: null, created: Date.now(), updated: Date.now(),
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
    { id: uid(), name: 'Pearland Tellepson', date: '2026-11-16', description: 'Pad grades, north lot BMs', client: 'SAMPLE DATA', sample: true, archived: false, created: now, updated: now, surveys: [loop, run, seedStake()] },
  ];
}

// Sample two-peg test: pegs 200 ft apart; setup 1 midway (100/100); setup 2 10 ft behind peg A (10/210).
// a1 − b1 = 0.372 (true), a2 − b2 = 0.368 (apparent) → C = (0.368 − 0.372)/(10 − 210) = +0.00002 ft/ft = +0.0020 ft/100 ft.
export function seedPegTests() {
  return [{ id: uid(), date: '2026-11-12', instrument: 'Auto level AT-B4', observer: 'D. Lawler', note: 'SAMPLE – shoot your own before relying on it',
    spacing: 200, dA2: 10, dB2: 210, a1: 5.284, b1: 4.912, a2: 4.618, b2: 4.250, rodLength: 16, sample: true, created: Date.parse('2026-11-12T08:00:00-06:00') }];
}

// Sample stake out: BS 5.31 on BM-1 (102.45) → HI 107.760. Target = HI − design; cut/fill = (HI − rod) − design.
export function seedStake() {
  const t = Date.parse('2026-11-16T10:00:00-06:00');
  return { ...surveyDefaults('stake'), name: 'Stake 1 – pad corners (SAMPLE)', observer: 'D. Lawler', rodPerson: 'J. Ortiz', instrument: 'Auto level AT-B4',
    startBM: { name: 'BM-1', elev: 102.45 }, sample: true, closed: true, created: t, updated: t,
    readings: [{ id: uid(), type: 'BS', point: 'BM-1', value: 5.31, text: '5.31', dist: 150 }],
    stakes: [
      { id: uid(), point: 'PAD-NE', design: 103.25, value: 4.72, text: '4.72', dist: 85, setup: 0 },  // FILL 0.21
      { id: uid(), point: 'PAD-NW', design: 103.0, value: 4.10, text: '4.10', dist: 120, setup: 0 },  // CUT 0.66
      { id: uid(), point: 'PAD-SW', design: 102.9, value: 4.86, text: '4.86', dist: 140, setup: 0 },  // ON GRADE
    ] };
}
