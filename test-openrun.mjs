// Open level runs (no closing benchmark): finish on a set point, no closure check. Closed runs unchanged.
// Run: node --test test-openrun.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from './js/calc.js';
import * as R from './js/report.js';
import { seedJobs, surveyDefaults, uid } from './js/seed.js';

const vendor = (f) => vm.runInThisContext(readFileSync(new URL('./vendor/' + f, import.meta.url), 'utf8'));
if (!globalThis.jspdf) { vendor('jspdf.umd.min.js'); globalThis.window = globalThis.window || {}; window.jspdf = globalThis.jspdf; vendor('jspdf.plugin.autotable.min.js'); }
const INC = { table: true, checks: true, adjusted: true, threewire: true, peg: true, notes: true };
const Rd = (type, point, value, dist) => ({ id: uid(), type, point, value, text: value.toFixed(2), dist });
const W = (type, point, t, m, b) => ({ id: uid(), type, point, wires: { t, m, b } });
// BM-1 100.000 → TP1 → SP-1. BS 5.31 FS 4.53 BS 6.02 FS 3.10 → SP-1 = 100 + 5.31 − 4.53 + 6.02 − 3.10 = 103.700
const openRun = (extra = {}) => ({ ...surveyDefaults('run'), name: 'Open run 1', startBM: { name: 'BM-1', elev: 100 }, closeBM: { name: '', elev: null },
  readings: [Rd('BS', 'BM-1', 5.31, 150), Rd('FS', 'TP1', 4.53, 145), Rd('BS', 'TP1', 6.02, 160), Rd('FS', 'SP-1', 3.10, 155)], closed: true, ...extra });
const noNaN = (t, what) => assert.ok(!/NaN|undefined/.test(t), `${what} has NaN/undefined`);

test('a run with no closing BM is an open run; loops and closed runs are not', () => {
  assert.equal(C.isOpenRun(openRun()), true);
  assert.equal(C.isOpenRun(openRun({ closeBM: { name: 'SP-1', elev: null } })), true, 'planned set point name, no elevation');
  assert.equal(C.isOpenRun(openRun({ closeBM: { name: '', elev: 12.3 } })), true, 'elevation without a name cannot close');
  assert.equal(C.isOpenRun(openRun({ closeBM: { name: 'BM-7', elev: 0 } })), false, 'zero is a real elevation');
  const [job] = seedJobs(); assert.equal(C.isOpenRun(job.surveys[0]), false, 'loop'); assert.equal(C.isOpenRun(job.surveys[1]), false, 'seed run with BM-7');
});

test('starting an open run: no readings, closure is open and not ended, nothing NaN', () => {
  const s = { ...openRun(), readings: [], closed: false }; const cl = C.closure(s);
  assert.equal(cl.open, true); assert.equal(cl.ended, false); assert.equal(cl.misclosure, null); assert.equal(cl.allowable, null);
  assert.equal(C.surveyStatus(s), 'open');
  const [job] = seedJobs(); noNaN(R.textReport(job, [s]), 'text'); noNaN(R.csvReport(job, [s]), 'csv');
});

test('finishing on a set point: its elevation is the result, arithmetic check holds, no misclosure', () => {
  const s = openRun(); const comp = C.computeSurvey(s); const cl = C.closure(s, comp);
  assert.equal(cl.ended, true); assert.equal(cl.setPoint, 'SP-1'); assert.equal(cl.setElev, 103.7);
  assert.equal(cl.closedOn, false); assert.equal(cl.misclosure, null); assert.equal(cl.pass, false); assert.equal(cl.feet, 610);
  assert.ok(comp.arith.ok); assert.equal(comp.arith.diff, 3.7); assert.equal(comp.arith.delta, 3.7);
  assert.equal(C.surveyStatus(s), 'closed', 'finished open run counts as done');
  // a set point named like a BM is still just the end of an open run
  const bmLike = openRun({ readings: [...openRun().readings.slice(0, 3), Rd('FS', 'BM-9', 3.10, 155)] }); assert.equal(C.closure(bmLike).setPoint, 'BM-9');
  // last reading a backsight: not ended
  assert.equal(C.closure(openRun({ readings: openRun().readings.slice(0, 3) })).ended, false);
  // adjustment is a no-op, never NaN
  C.adjust(s).forEach((p) => { assert.equal(p.correction, 0); assert.ok(isFinite(p.adjusted)); });
});

test('adding a known elevation later turns on the closure check', () => {
  const s = openRun({ closeBM: { name: 'SP-1', elev: 103.69, addedLater: true } }); const cl = C.closure(s);
  assert.equal(cl.open, false); assert.equal(cl.closedOn, true); assert.equal(cl.misclosure, 0.01);
  assert.ok(cl.allowable > 0); assert.equal(cl.pass, true);
});

test('reports: text, CSV and PDF preview say open run / set point, no NaN', () => {
  const [job] = seedJobs(); const s = openRun();
  const txt = R.textReport(job, [s]); noNaN(txt, 'text');
  assert.match(txt, /Open run – no closing check/); assert.match(txt, /Set point SP-1: elev 103\.700 ft/); assert.match(txt, /ELEVATIONS \(open run – unadjusted\)/);
  assert.doesNotMatch(txt, /NOT CLOSED|misclose/);
  const csv = R.csvReport(job, [s]); noNaN(csv, 'csv'); assert.match(csv, /OPEN RUN – SET POINT/); assert.doesNotMatch(csv, /,CLOSED/);
  const pages = R.previewPages(job, [s], INC, null).join(''); noNaN(pages, 'preview');
  assert.match(pages, /OPEN RUN – SET POINT SP-1 ELEV 103\.700 FT – NO CLOSING CHECK/); assert.match(pages, /Set point elevation/); assert.match(pages, /open run – ends on set point SP-1/);
  assert.doesNotMatch(pages, /Misclosure|NOT CLOSED|Allowable/);
  // in progress (not finished)
  const ip = openRun({ readings: openRun().readings.slice(0, 3), closed: false });
  const t2 = R.textReport(job, [ip]); noNaN(t2, 'in-progress text'); assert.match(t2, /OPEN RUN, NOT FINISHED/);
  noNaN(R.previewPages(job, [ip], INC, null).join(''), 'in-progress preview');
  // three-wire open run keeps distance totals
  const tw = openRun({ method: 'three', readings: [W('BS', 'BM-1', 5.214, 4.72, 4.226), W('FS', 'SP-2', 3.512, 3.02, 2.528)] });
  const t3 = R.textReport(job, [tw]); assert.match(t3, /3-wire dist ΣBS 98\.8 {2}ΣFS 98\.4/); assert.match(t3, /Set point SP-2/);
  assert.match(R.csvReport(job, [tw]), /Sum BS ft/);
});

test('PDF of an open run: renders, embeds data, import round-trips', () => {
  const [job] = seedJobs(); const s = openRun(); const tw = openRun({ name: 'Open 3W', method: 'three', readings: [W('BS', 'BM-1', 5.214, 4.72, 4.226), W('FS', 'SP-2', 3.512, 3.02, 2.528)] });
  const bytes = new Uint8Array(R.pdfReport(job, [s, tw], INC, null).output('arraybuffer'));
  const r = R.extractEmbedded(bytes); assert.equal(r.error, undefined);
  [s, tw].forEach((src, i) => {
    const b = r.data.surveys[i]; assert.deepEqual(b, JSON.parse(JSON.stringify(src)));
    assert.equal(b.closeBM.elev, null); assert.equal(C.isOpenRun(b), true);
    assert.deepEqual(C.closure(b), C.closure(src)); assert.deepEqual(C.computeSurvey(b), C.computeSurvey(src));
    const norm = (t) => t.replace(/Generated .*/, ''); assert.equal(norm(R.textReport(job, [b])), norm(R.textReport(job, [src])));
  });
  const latin = new TextDecoder('latin1').decode(bytes); assert.doesNotMatch(latin, /NaN/);
});

test('closed runs keep misclosure, allowable and adjustment exactly as before', () => {
  const s = openRun({ name: 'Closed run', closeBM: { name: 'SP-1', elev: 103.71 } }); const cl = C.closure(s);
  assert.equal(cl.open, false); assert.equal(cl.closedOn, true); assert.equal(cl.known, 103.71); assert.equal(cl.misclosure, -0.01);
  assert.equal(cl.allowable, C.allowable(0.05, C.round(610 / 5280, 4))); assert.equal(cl.pass, true);
  const adj = C.adjust(s); assert.equal(adj[adj.length - 1].adjusted, 103.71, 'closing BM held');
  const [job] = seedJobs(); const txt = R.textReport(job, [s]); assert.match(txt, /Closed on SP-1: misclose −0\.010 ft/); assert.match(txt, /FINAL ELEVATIONS/);
  assert.doesNotMatch(txt, /Open run/);
  // not closed on the BM yet → still NOT CLOSED, not "open run"
  const nc = openRun({ closeBM: { name: 'BM-7', elev: 104.16 }, closed: false }); assert.equal(C.closure(nc).closedOn, false); assert.match(R.textReport(job, [nc]), /NOT CLOSED/);
});
