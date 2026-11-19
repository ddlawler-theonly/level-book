// Report import round trip: export a PDF, read the embedded data back, rebuild the surveys, compare.
// Run: node --test test-import.mjs   (uses the vendored jsPDF build so it matches the app)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import * as C from './js/calc.js';
import * as R from './js/report.js';
import { seedJobs, seedPegTests, seedStake, surveyDefaults, uid } from './js/seed.js';

const require = createRequire(import.meta.url);
const jspdf = require('./vendor/jspdf.umd.min.js');
globalThis.window = globalThis.window || {}; window.jspdf = jspdf;
const at = require('jspdf-autotable'); (at.applyPlugin || at.default?.applyPlugin)?.(jspdf.jsPDF);

const INC = { table: true, checks: true, adjusted: true, threewire: true, peg: true, notes: true };
const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.id; delete c.updated; delete c.imported; return c; };
const W = (type, point, t, m, b) => ({ id: uid(), type, point, wires: { t, m, b } });
const pdfBytes = (job, surveys) => new Uint8Array(R.pdfReport(job, surveys, INC, null).output('arraybuffer'));

// A closed three-wire loop with a peg test applied, side shot, accepted spread, unicode names.
function threeWireLoop() {
  const [peg] = seedPegTests();
  return { ...surveyDefaults('loop'), name: 'Loop 3W – Ñorth “pad” ⚠', method: 'three', observer: 'D. Lawler', rodPerson: 'J. Ortiz', instrument: 'AT-B4',
    startBM: { name: 'BM-1', elev: 102.45 }, peg: { on: true, test: { tol: 0.005, ...peg } }, adjustMethod: 'distance', closed: true,
    readings: [W('BS', 'BM-1', 5.214, 4.72, 4.226), W('FS', 'TP1', 3.512, 3.02, 2.528), W('BS', 'TP1', 6.5, 6.0, 5.5), W('IFS', 'SS1', 2.4, 2.2, 2.0),
      { ...W('FS', 'TP2', 4.9, 4.4, 3.895), accepted: true, note: 'Accepted: spread Δ0.005 > 0.003' }, W('BS', 'TP2', 3.9, 3.4, 2.9), W('FS', 'BM-1', 6.06, 5.56, 5.06)] };
}

test('every PDF carries embedded survey data; parse gives identical surveys', () => {
  const [job] = seedJobs(); job.surveys.push(threeWireLoop());
  const bytes = pdfBytes(job, job.surveys);
  const r = R.extractEmbedded(bytes);
  assert.equal(r.isPdf, true); assert.equal(r.error, undefined);
  assert.equal(r.data.job.name, job.name); assert.equal(r.data.job.date, job.date);
  assert.equal(r.data.surveys.length, job.surveys.length);
  job.surveys.forEach((s, i) => assert.deepEqual(r.data.surveys[i], JSON.parse(JSON.stringify(s)), s.name));
});

test('round trip: rebuilt surveys compute the same book, checks, closure and adjustment', () => {
  const [job] = seedJobs(); job.surveys.push(threeWireLoop());
  const back = R.extractEmbedded(pdfBytes(job, job.surveys)).data.surveys.map((s) => ({ ...s, id: uid(), imported: { at: 1 } }));
  job.surveys.forEach((s, i) => {
    const b = back[i];
    assert.deepEqual(strip(b), strip(s), 'stored data');
    assert.deepEqual(C.computeSurvey(b), C.computeSurvey(s), 'computed book');
    if (s.type !== 'site' && s.type !== 'stake') { assert.deepEqual(C.closure(b), C.closure(s), 'closure'); assert.deepEqual(C.adjust(b, b.adjustMethod), C.adjust(s, s.adjustMethod), 'adjustment'); }
    if (s.type === 'stake') assert.deepEqual(C.stakeSurvey(b), C.stakeSurvey(s), 'stake sheet');
    if (s.method === 'three') assert.deepEqual(C.distTotals(b), C.distTotals(s), 'distance totals');
    // the same report text comes out of the rebuilt data
    const norm = (t) => t.replace(/Generated .*/, '');
    assert.equal(norm(R.textReport(job, [b])), norm(R.textReport(job, [s])));
  });
  // closure of the three-wire loop really is closed
  const loop = back[back.length - 1]; assert.ok(C.closure(loop).closedOn); assert.ok(C.computeSurvey(loop).peg.applied > 0);
});

test('single-survey PDF and a re-export of the import are byte-identical in data', () => {
  const [job] = seedJobs(); const s = job.surveys[1];
  const d1 = R.extractEmbedded(pdfBytes(job, [s])).data;
  const d2 = R.extractEmbedded(pdfBytes(d1.job, d1.surveys)).data;
  assert.deepEqual(d2.surveys, d1.surveys); assert.deepEqual(d2.job, d1.job);
});

test('plan pins are not carried (plan PDFs are not embedded)', () => {
  const [job] = seedJobs(); const s = { ...job.surveys[0], pins: [{ planId: 'x', page: 1, ref: 'r0', x: 0.1, y: 0.2 }], planLast: { planId: 'x', page: 1 }, planMark: true };
  const d = R.extractEmbedded(pdfBytes(job, [s])).data.surveys[0];
  assert.equal(d.pins, undefined); assert.equal(d.planLast, undefined); assert.deepEqual(d.readings, s.readings);
});

test('older PDFs / other files: friendly errors, not crashes', () => {
  const { jsPDF } = jspdf; const old = new jsPDF(); old.text('Old Level Book report', 40, 40);
  const r = R.extractEmbedded(new Uint8Array(old.output('arraybuffer'))); assert.equal(r.error, 'none'); assert.equal(r.isPdf, true);
  const txt = R.extractEmbedded(new TextEncoder().encode('hello')); assert.equal(txt.isPdf, false); assert.equal(txt.error, 'none');
  const [job] = seedJobs(); const good = R.embedString(job, job.surveys);
  assert.equal(R.parseEmbedded(good.slice(0, 200) + good.slice(-20)).error, 'corrupt', 'truncated');
  assert.equal(R.parseEmbedded(good.slice(0, 60) + (good[60] === 'Q' ? 'R' : 'Q') + good.slice(61)).error, 'corrupt', 'tampered');
  assert.ok(R.parseEmbedded(good).data);
});

test('three-wire running distance totals', () => {
  const s = threeWireLoop(); const t = C.distTotals(s);
  assert.equal(t.rows.length, 6, 'BS/FS only, IFS excluded');
  assert.deepEqual(t.rows.slice(0, 2).map((r) => [r.type, r.d, r.cumBS, r.cumFS, r.bal, r.total]), [['BS', 98.8, 98.8, 0, 98.8, 98.8], ['FS', 98.4, 98.8, 98.4, 0.4, 197.2]]);
  assert.equal(t.cumBS, C.round(98.8 + 100 + 100, 1)); assert.equal(t.cumFS, C.round(98.4 + 100.5 + 100, 1));
  assert.equal(t.bal, C.round(t.cumBS - t.cumFS, 1)); assert.equal(t.total, C.round(t.cumBS + t.cumFS, 1));
  assert.equal(t.total, C.computeSurvey(s).totalDist, 'matches closure distance'); assert.equal(t.bal, C.computeSurvey(s).imbalance, 'matches closed-setup balance');
  assert.equal(t.open, false);
  const open = C.distTotals({ ...s, readings: s.readings.slice(0, 3) }); assert.equal(open.open, true); assert.equal(open.cumBS, 198.8);
  const off = C.distTotals({ ...s, useDist: false }); assert.equal(off.used, false); assert.equal(off.total, t.total, 'recorded stadia still totalled');
  // report carries the table
  const [job] = seedJobs(); const txt = R.textReport(job, [s]); assert.match(txt, /3-wire dist ΣBS 298\.8 {2}ΣFS 298\.9 {2}bal −0\.1 {2}total 597\.7 ft/);
  const csv = R.csvReport(job, [s]); assert.match(csv, /Sum BS ft/); assert.match(csv, /BM-1,100\.0,298\.8,298\.9,-0\.1,597\.7/);
  const pages = R.previewPages(job, [s], INC, null).join(''); assert.match(pages, /THREE-WIRE DISTANCE TOTALS/);
});
