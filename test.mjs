import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as C from './js/calc.js';
import { seedJobs, surveyDefaults } from './js/seed.js';

const near = (a, b, e = 0.0005, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} expected ${b} got ${a}`);
const [job] = seedJobs();
const loop = job.surveys[0], run = job.surveys[1];

test('HI and elevation (seed numbers)', () => {
  const c = C.computeSurvey(loop);
  const sta = Object.fromEntries(c.rows.filter(r => !r.ifs).map(r => [r.sta + (r.start ? '*' : ''), r]));
  near(sta['BM-1*'].hi, 107.760);
  near(sta.TP1.elev, 103.230); near(sta.TP1.hi, 109.250);
  near(sta.TP2.elev, 103.250); near(sta.TP2.hi, 108.170);
  near(sta.TP3.elev, 103.450);
  near(c.rows.find(r => r.ifs).elev, 104.990, 0.0005, 'side shot');
});

test('seed sums to TP3: ΣBS 16.25, ΣFS 15.25, +1.000', () => {
  const s = { ...loop, readings: loop.readings.slice(0, 7) };
  const c = C.computeSurvey(s);
  near(c.sumBS, 16.25); near(c.sumFS, 15.25);
  near(c.arith.diff, 1.0); near(c.arith.delta, 1.0); assert.ok(c.arith.ok);
});

test('arithmetic check over the full loop and mid-setup', () => {
  const c = C.computeSurvey(loop);
  near(c.sumBS, 20.11); near(c.sumFS, 20.10); assert.ok(c.arith.ok);
  const mid = C.computeSurvey({ ...loop, readings: loop.readings.slice(0, 3) });
  assert.equal(mid.expect, 'FS'); assert.equal(mid.arith.against, 'HI'); assert.ok(mid.arith.ok);
  // a tampered elevation breaks the check
  assert.ok(!(Math.abs(c.arith.diff - (c.arith.delta + 0.01)) < 0.0005));
});

test('three-wire mean, distance, spread check', () => {
  const tw = C.threeWire({ t: 5.214, m: 4.72, b: 4.226 }, 100, 0.003);
  near(tw.mean, 4.720); near(tw.dist, 98.8, 0.05); assert.ok(tw.orderOk && tw.spreadOk); assert.equal(tw.flagWire, null);
  const bad = C.threeWire({ t: 5.222, m: 4.72, b: 4.226 }, 100, 0.003);
  assert.equal(bad.spreadOk, false); near(bad.spreadDiff, 0.008); assert.equal(bad.flagWire, 't');
  const order = C.threeWire({ t: 4.226, m: 4.72, b: 5.214 });
  assert.equal(order.orderOk, false);
  near(C.threeWire({ t: 1.0, m: 0.5, b: 0.0 }).mean, 0.5);
  near(C.threeWire({ t: 1.001, m: 1.0, b: 0.0 }).mean, 0.667); // rounded to 0.001
  const c = C.computeSurvey(run);
  near(c.rows[0].hi, 107.170); near(c.rows[1].elev, 104.150); near(c.totalBSdist, 98.8, 0.05); near(c.imbalance, 0.4, 0.05);
  const open = C.computeSurvey({ ...run, readings: [...run.readings, { type: 'BS', point: 'TP1', wires: { t: 5.214, m: 4.72, b: 4.226 } }] });
  near(open.imbalance, 0.4, 0.05, 'open setup excluded from balance');
});

test('reading errors', () => {
  assert.equal(C.readingError(-0.1, 16), 'neg'); assert.equal(C.readingError(17.2, 16), 'over'); assert.equal(C.readingError(4.72, 16), null);
});

test('misclosure and allowable closure', () => {
  const cl = C.closure(loop);
  assert.ok(cl.closedOn); near(cl.misclosure, 0.010); near(cl.feet, 1165, 0.05);
  near(cl.miles, 1165 / 5280, 0.0001); near(cl.allowable, 0.05 * Math.sqrt(1165 / 5280));
  assert.ok(cl.pass);
  near(C.allowable(0.05, 1), 0.05); near(C.allowable(0.0333, 4), 0.067);
  near(C.mmPerSqrtKmToFtPerSqrtMi(12), 0.0499, 0.0002); near(C.mmPerSqrtKmToFtPerSqrtMi(8), 0.0333, 0.0002);
  assert.ok(!C.closure({ ...loop, standard: 'custom', customK: 0.01 }).pass);
  assert.ok(!C.closure(run).closedOn);
});

test('adjustment by setups', () => {
  const adj = C.adjust(loop, 'setups');
  const by = Object.fromEntries(adj.map(p => [p.point + (p.readingIdx < 0 ? '*' : ''), p]));
  near(by['BM-1*'].adjusted, 102.45); near(by['BM-1'].adjusted, 102.45);
  near(by.TP1.correction, -0.003); near(by.TP2.correction, -0.005); near(by.TP3.correction, -0.008);
  near(by['PAD NE'].correction, -0.008); // side shot on setup 3 of 4
});

test('adjustment by distance', () => {
  const adj = C.adjust(loop, 'distance');
  const by = Object.fromEntries(adj.map(p => [p.point + (p.readingIdx < 0 ? '*' : ''), p]));
  near(by['BM-1'].adjusted, 102.45);
  near(by.TP1.correction, -0.010 * 295 / 1165, 6e-4); near(by.TP2.correction, -0.010 * 610 / 1165, 6e-4);
  near(by.TP3.correction, -0.010 * 900 / 1165, 6e-4); near(by['PAD NE'].correction, -0.010 * 750 / 1165, 6e-4);
});

test('warnings: imbalance and max sight', () => {
  const s = { ...surveyDefaults('loop'), startBM: { name: 'BM-1', elev: 100 }, readings: [
    { type: 'BS', point: 'BM-1', value: 5, dist: 100 }, { type: 'FS', point: 'TP1', value: 4, dist: 350 }] };
  const c = C.computeSurvey(s);
  const w = c.warnings[1].join('|');
  assert.match(w, /Sight 350/); assert.match(w, /imbalance 250/);
});

test('status', () => {
  assert.equal(C.surveyStatus(loop), 'closed'); assert.equal(C.surveyStatus(run), 'open');
  assert.equal(C.fmtReading(4.72), '4.72'); assert.equal(C.fmtReading(4.725), '4.725'); assert.equal(C.f3(103.45), '103.450');
});

// ---------- Peg test ----------
import { seedPegTests } from './js/seed.js';
const [peg] = seedPegTests();

test('peg test: sample C = +0.0020 ft/100 ft, passes 0.005 tolerance', () => {
  const p = C.pegTest(peg);
  assert.ok(p.ok); near(p.diff1, 0.372); near(p.diff2, 0.368);
  near(p.per100, 0.002, 1e-9); near(p.C, 0.00002, 1e-12);
  near(p.arcsec, 4.1, 0.05); near(p.err300, 0.006); near(p.bShould, 4.246); near(p.trueDiff, 0.372);
  assert.ok(p.pass); assert.ok(!C.pegTest(peg, 0.001).pass);
});

test('peg test sign: line of sight inclined UP → C positive; DOWN → negative', () => {
  // Simulate an instrument whose line is tilted up by +0.00005 ft/ft over true readings.
  const sim = (Ctrue) => { const D = 200, dA2 = 10, dB2 = 210, Δ = 1.25; // A reads 1.25 higher than B (B is higher ground)
    const a1t = 5.0, a2t = 4.0;
    return { spacing: D, dA2, dB2, a1: C.round(a1t + Ctrue * D / 2, 3), b1: C.round(a1t - Δ + Ctrue * D / 2, 3), a2: C.round(a2t + Ctrue * dA2, 3), b2: C.round(a2t - Δ + Ctrue * dB2, 3) }; };
  near(C.pegTest(sim(0.00005)).per100, 0.005, 0.0006); assert.ok(C.pegTest(sim(0.00005)).per100 > 0);
  near(C.pegTest(sim(-0.0001)).per100, -0.010, 0.0006); assert.ok(C.pegTest(sim(-0.0001)).per100 < 0);
  near(C.pegTest(sim(0)).per100, 0, 1e-9);
  // Instrument on the B side (dA2 > dB2) gives the same C.
  near(C.pegTest({ spacing: 200, dA2: 210, dB2: 10, a1: 5.01, b1: 3.76, a2: 4.0105, b2: 2.7505 }).per100, 0.005, 1e-6);
  // Non-midway setup 1 is honoured.
  near(C.pegTest({ spacing: 200, dA1: 80, dB1: 120, dA2: 10, dB2: 210, a1: 5.008, b1: 3.762, a2: 4.001, b2: 2.771 }).per100, 0.010, 1e-6);
  assert.equal(C.pegTest({ ...peg, dA2: 100, dB2: 110 }).ok, false);
  assert.equal(C.pegTest({ ...peg, a2: null }).error, 'incomplete');
});

test('peg correction: reading − C × distance; readings with no distance untouched', () => {
  const pegC = { C: 0.00002 };
  assert.deepEqual(C.corrected(5.31, 150, pegC), { v: 5.307, corr: -0.003, noDist: false });
  assert.deepEqual(C.corrected(5.31, null, pegC), { v: 5.31, corr: null, noDist: true });
  assert.deepEqual(C.corrected(5.31, 150, null), { v: 5.31, corr: null, noDist: false });
  // negative C (line inclined down) increases the reading
  near(C.corrected(4.0, 200, { C: -0.0001 }).v, 4.02);
});

test('seed loop with peg ON: corrected HI/elev, arith check holds, OFF restores raw', () => {
  const on = { ...loop, peg: { on: true, test: peg } };
  const c = C.computeSurvey(on);
  assert.ok(c.peg && c.peg.applied === 9 && c.peg.skipped === 0);
  const sta = Object.fromEntries(c.rows.filter(r => !r.ifs).map(r => [r.sta + (r.start ? '*' : ''), r]));
  near(sta['BM-1*'].hi, 102.45 + 5.307);               // 5.31 − 0.00002·150 = 5.307
  near(sta['BM-1*'].bsRaw, 5.31); near(sta['BM-1*'].bsCorr, -0.003);
  near(sta.TP1.elev, 107.757 - 4.527);                 // 4.53 − 0.0029 → 4.527
  assert.ok(c.arith.ok);
  // Raw numbers in the stored survey are untouched.
  assert.equal(on.readings[0].value, 5.31);
  // Balanced sights → correction nearly cancels in the misclosure.
  const clOn = C.closure(on), clOff = C.closure(loop);
  near(clOff.misclosure, 0.010); near(clOn.misclosure, 0.010 + (-0.00002) * (150 + 160 + 140 + 130 - 145 - 155 - 150 - 135), 0.0011);
  const off = C.computeSurvey({ ...loop, peg: { on: false, test: peg } });
  assert.equal(off.peg, null); near(off.rows[0].hi, 107.760);
  // single-wire reading without distance is left uncorrected and counted as skipped
  const nd = { ...loop, readings: loop.readings.map((r, i) => (i === 1 ? { ...r, dist: undefined } : r)), peg: { on: true, test: peg } };
  const cn = C.computeSurvey(nd);
  assert.equal(cn.peg.skipped, 1); assert.ok(cn.info[1].noDist); near(cn.info[1].v, 4.53);
  // three-wire run uses its stadia distance automatically
  const r3 = C.computeSurvey({ ...run, peg: { on: true, test: peg } });
  near(r3.info[0].corr, -0.002); near(r3.rows[0].hi, 102.45 + 4.718);
});

// ---------- Use distance switch ----------
test('useDist OFF: same raw elevations, no peg correction, no distance checks, closure by setups, no allowable', () => {
  const off = { ...loop, useDist: false, peg: { on: true, test: peg } };
  const c = C.computeSurvey(off);
  assert.equal(c.distUsed, false);
  near(c.rows[0].hi, 107.760); near(c.rows.find(r => r.ifs).elev, 104.990);      // readings used as read
  assert.equal(c.peg.applied, 0); assert.equal(c.peg.skipped, 9);                // peg ON but nothing corrected
  assert.equal(c.totalDist, 0); assert.equal(c.imbalance, 0);
  assert.equal(c.rows[0].bsDist, 150, 'recorded distance still shown');
  const cl = C.closure(off, c);
  assert.ok(cl.closedOn && cl.distOff && cl.allowable == null && !cl.pass); near(cl.misclosure, 0.010);
  const adj = C.adjust(off, 'distance');                                          // forced to setups
  near(adj.find(p => p.point === 'TP1').correction, -0.003);
  // warnings suppressed
  const w = C.computeSurvey({ ...surveyDefaults('loop'), useDist: false, startBM: { name: 'BM-1', elev: 100 }, readings: [
    { type: 'BS', point: 'BM-1', value: 5, dist: 100 }, { type: 'FS', point: 'TP1', value: 4, dist: 350 }] });
  assert.equal((w.warnings[1] || []).length, 0);
  // three-wire: stadia recorded, not used
  const r3 = C.computeSurvey({ ...run, useDist: false, peg: { on: true, test: peg } });
  near(r3.rows[0].bsDist, 98.8, 0.05); near(r3.rows[0].hi, 107.170); assert.equal(r3.totalBSdist, 0);
  // default (undefined) = ON
  assert.equal(C.usesDist(loop), true); assert.equal(C.computeSurvey(loop).totalDist, 1165);
});

// ---------- Stake out ----------
import { seedStake } from './js/seed.js';
test('stake out: target = HI − design, cut/fill = ground − design, off-rod flags', () => {
  const a = C.stakeCalc(107.76, 103.25, 4.72, 16);
  near(a.target, 4.51); near(a.ground, 103.04); near(a.cf, -0.21); assert.equal(a.kind, 'FILL'); assert.equal(C.cfShort(a), 'F 0.21');
  const b = C.stakeCalc(107.76, 103.0, 4.10, 16); assert.equal(b.kind, 'CUT'); near(b.cf, 0.66); assert.equal(C.cfShort(b), 'C 0.66');
  assert.equal(C.stakeCalc(107.76, 102.9, 4.86).kind, 'ON GRADE');
  assert.equal(C.stakeCalc(107.76, 90.5, null, 16).out, 'below'); assert.equal(C.stakeCalc(107.76, 108.2, null, 16).out, 'above');
  assert.equal(C.stakeCalc(107.76, 103.25, null).kind, null);
});
test('stake survey: seed sample, peg + distance switch', () => {
  const s = seedStake(); const st = C.stakeSurvey(s);
  near(st.setups[0].hi, 107.76); assert.deepEqual(st.rows.map(C.cfShort), ['F 0.21', 'C 0.66', 'ON GR']);
  assert.equal(st.cuts, 1); assert.equal(st.fills, 1); assert.equal(st.onGrade, 1);
  const pg = C.stakeSurvey({ ...s, peg: { on: true, test: peg } });              // C = +0.00002: BS 5.31−0.003 → HI 107.757
  near(pg.setups[0].hi, 107.757); near(pg.rows[0].corr, -0.002);                  // 4.72 − 0.0017 → 4.718
  const off = C.stakeSurvey({ ...s, useDist: false, peg: { on: true, test: peg } });
  near(off.setups[0].hi, 107.76); assert.equal(off.rows[0].corr, null); assert.equal(off.distUsed, false);
  assert.equal(C.surveyStatus(s), 'closed');
});
