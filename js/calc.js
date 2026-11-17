// Level Book — pure calculation module (no DOM). US survey decimal feet only.
export const FT_PER_MILE = 5280;

// Closure standards. FGCS vertical-control standards are written as k·√K (mm, K in km).
// Converted to feet and miles: 1 mm√km = 0.0041619 ft√mi.
export const STANDARDS = [
  { id: '3rd', label: '3rd order (12 mm√km)', k: 0.050 },
  { id: '2-II', label: '2nd order, class II (8 mm√km)', k: 0.0333 },
  { id: '2-I', label: '2nd order, class I (6 mm√km)', k: 0.025 },
  { id: '1-II', label: '1st order, class II (4 mm√km)', k: 0.0166 },
  { id: '1-I', label: '1st order, class I (3 mm√km)', k: 0.0125 },
  { id: 'custom', label: 'Custom constant (ft√mi)', k: null },
];
export const mmPerSqrtKmToFtPerSqrtMi = (mm) => (mm / 304.8006) * Math.sqrt(1.609347);

export const round = (v, d = 3) => {
  if (v == null || !isFinite(v)) return v;
  const f = Math.pow(10, d);
  return Math.round((v + Math.sign(v) * 1e-9) * f) / f;
};
export const f3 = (v) => (v == null || !isFinite(v) ? '' : round(v, 3).toFixed(3));
export const fmtReading = (v, text) => {
  if (text) return text;
  if (v == null || !isFinite(v)) return '';
  return Math.abs(round(v * 100, 6) - Math.round(v * 100)) < 1e-6 ? v.toFixed(2) : round(v, 3).toFixed(3);
};

export function readingError(v, rodLength) {
  if (v == null || isNaN(v)) return null;
  if (v < 0) return 'neg';
  if (v > rodLength) return 'over';
  return null;
}

// Three-wire reduction.
export function threeWire({ t, m, b }, K = 100, tol = 0.003) {
  const mean = round((t + m + b) / 3, 3);
  const dist = round(K * (t - b), 1);
  const upper = round(t - m, 3);
  const lower = round(m - b, 3);
  const spreadDiff = round(Math.abs(upper - lower), 3);
  const orderOk = t > m && m > b;
  const spreadOk = spreadDiff <= tol + 1e-9;
  // Wire most likely wrong: the outer wire on the larger interval (or the out-of-order wire).
  let flagWire = null;
  if (!orderOk) flagWire = !(t > m) ? 't' : 'b';
  else if (!spreadOk) flagWire = upper > lower ? 't' : 'b';
  const meanDev = round(Math.abs(mean - m), 3);
  const meanWarn = meanDev > tol + 1e-9;
  return { mean, dist, upper, lower, spreadDiff, orderOk, spreadOk, flagWire, meanDev, meanWarn };
}

export const valueOf = (r, s) => (r.wires ? threeWire(r.wires, s.stadiaK, s.spreadTol).mean : r.value);
export const distOf = (r, s) => (r.wires ? threeWire(r.wires, s.stadiaK, s.spreadTol).dist : (r.dist ?? null));

// ---------- Two-peg (collimation) test ----------
// Sign convention: C > 0 means the line of sight is inclined UP, so every reading is too HIGH by C × sight distance.
//   observed = true + C·d   →   corrected reading = reading − C × d
// Setup 1 (midway, equal sights) gives the true difference; setup 2 (near peg A) gives an apparent one:
//   a1 − b1 = Δ + C(dA1 − dB1)          a2 − b2 = Δ + C(dA2 − dB2)
//   C = [(a2 − b2) − (a1 − b1)] / [(dA2 − dB2) − (dA1 − dB1)]   (midway: dA1 = dB1, so the 2nd term drops out)
// Curvature & refraction are neglected (0.0206·(d/1000 ft)² ≈ 0.0009 ft at 210 ft and nearly cancels in setup 1).
export const PEG_TOL_DEFAULT = 0.005; // ft per 100 ft of sight (≈ 10″ of arc)
export const ARCSEC_PER_RAD = 206264.806;
export function pegTest(t, tol = PEG_TOL_DEFAULT) {
  const D = Number(t.spacing);
  const dA1 = t.dA1 != null ? Number(t.dA1) : D / 2, dB1 = t.dB1 != null ? Number(t.dB1) : D / 2;
  const dA2 = Number(t.dA2), dB2 = Number(t.dB2);
  const { a1, b1, a2, b2 } = t;
  const have = [a1, b1, a2, b2, dA1, dB1, dA2, dB2].every((x) => x != null && isFinite(x));
  const diff1 = have ? round(a1 - b1, 3) : null, diff2 = have ? round(a2 - b2, 3) : null;
  const den = (dA2 - dB2) - (dA1 - dB1);
  const ok = have && Math.abs(den) >= 20;
  const per100 = ok ? round(((diff2 - diff1) / den) * 100, 4) : null; // ft per 100 ft (stored precision)
  const C = per100 == null ? null : per100 / 100;                   // ft per ft
  const trueDiff = ok ? round(diff1 - C * (dA1 - dB1), 3) : null;
  return {
    ok, dA1, dB1, dA2, dB2, diff1, diff2, trueDiff, C, per100,
    arcsec: C == null ? null : round(Math.atan(C) * ARCSEC_PER_RAD, 1),
    err100: per100, err300: C == null ? null : round(C * 300, 3),
    bShould: ok ? round(b2 - C * dB2, 3) : null, aShould: ok ? round(a2 - C * dA2, 3) : null,
    tol, pass: ok && Math.abs(per100) <= tol + 1e-9,
    error: !have ? 'incomplete' : !ok ? 'Setup 2 sights must differ by at least 20 ft' : null,
  };
}
export const pegLabel = (per100) => (per100 == null ? '—' : (per100 > 0 ? '+' : per100 < 0 ? '−' : '±') + Math.abs(per100).toFixed(4));
export const latestPeg = (tests) => [...(tests || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0))[0] || null;
// Peg correction in force for a survey (snapshot stored on the survey), or null.
export function pegFor(s) {
  if (!s.peg || !s.peg.on || !s.peg.test) return null;
  const p = pegTest(s.peg.test);
  return p.ok ? { C: p.C, per100: p.per100, test: s.peg.test } : null;
}
// Apply the peg correction to one reading. Returns the value used in the reduction.
export function corrected(raw, d, peg) {
  if (!peg || raw == null || !isFinite(raw)) return { v: raw, corr: null, noDist: false };
  if (d == null || !isFinite(d) || d <= 0) return { v: raw, corr: null, noDist: true };
  const v = round(raw - peg.C * d, 3);
  return { v, corr: round(v - raw, 3), noDist: false };
}

export const isBMName = (name, s) => {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  return n === (s.startBM?.name || '').toUpperCase() || n === (s.closeBM?.name || '').toUpperCase() || /^T?BM/.test(n);
};

// Walk the readings and reduce the whole level book.
export function computeSurvey(s) {
  const rows = [];
  const setups = [];
  const warnings = {}; // reading index -> [text]
  const addW = (i, w) => (warnings[i] = warnings[i] || []).push(w);
  let elev = s.startBM ? Number(s.startBM.elev) : null;
  let point = s.startBM?.name || 'BM';
  let hi = null;
  let sumBS = 0, sumFS = 0, totBSd = 0, totFSd = 0, failed = 0;
  let expect = 'BS';
  let curRow = null;
  const firstElev = elev;
  const pointElev = [{ point, elev, cumDist: 0, setup: 0, readingIdx: -1, kind: 'BM' }];
  let cumDist = 0;
  const readings = s.readings || [];
  const peg = pegFor(s); const info = []; let pegApplied = 0, pegSkipped = 0;
  rows.push(curRow = { sta: point, kind: 'BM', bs: null, hi: null, fs: null, elev, setup: 1, bsIdx: null, fsIdx: null, start: true });
  readings.forEach((r, i) => {
    const raw = valueOf(r, s);
    const d = distOf(r, s);
    const pc = corrected(raw, d, peg); const v = pc.v;
    if (peg) { if (pc.noDist) pegSkipped++; else pegApplied++; }
    const rawText = r.wires ? null : r.text; const text = pc.corr != null ? null : rawText;
    const pg = (p) => ({ [p + 'Raw']: raw, [p + 'RawText']: rawText, [p + 'Corr']: pc.corr, [p + 'NoPeg']: pc.noDist });
    if (r.wires) {
      const tw = threeWire(r.wires, s.stadiaK, s.spreadTol);
      if (!tw.orderOk || !tw.spreadOk) { failed++; addW(i, !tw.orderOk ? 'Wire order' : `Spread Δ ${tw.spreadDiff.toFixed(3)}`); }
      else if (tw.meanWarn) addW(i, `Mean−mid ${tw.meanDev.toFixed(3)}`);
    }
    if (d != null && s.maxSight && d > s.maxSight) addW(i, `Sight ${d} ft > ${s.maxSight}`);
    if (r.note) addW(i, r.note);
    if (r.type === 'BS') {
      hi = round(elev + v, 3);
      info[i] = { raw, v, corr: pc.corr, noDist: pc.noDist, d, hi, elev: null, setup: setups.length + 1 };
      sumBS += v; if (d) { totBSd += d; cumDist += d; }
      setups.push({ n: setups.length + 1, bsIdx: i, fsIdx: null, bsDist: d, fsDist: null, hi, ifs: [], from: point, to: null });
      if (curRow && curRow.sta === point && curRow.bs == null && !curRow.ifs) {
        Object.assign(curRow, { bs: v, hi, bsIdx: i, bsText: text, bsWires: r.wires || null, bsDist: d, setup: setups.length, ...pg('bs') });
      } else {
        rows.push(curRow = { sta: point, kind: isBMName(point, s) ? 'BM' : 'TP', bs: v, hi, fs: null, elev, setup: setups.length, bsIdx: i, bsText: text, bsWires: r.wires || null, bsDist: d, ...pg('bs') });
      }
      expect = 'FS';
    } else if (r.type === 'FS') {
      const su = setups[setups.length - 1];
      const e = round(hi - v, 3);
      info[i] = { raw, v, corr: pc.corr, noDist: pc.noDist, d, hi: null, elev: e, setup: setups.length };
      sumFS += v; if (d) { totFSd += d; cumDist += d; }
      if (su) { su.fsIdx = i; su.fsDist = d; su.to = r.point; }
      elev = e; point = r.point;
      rows.push(curRow = { sta: r.point, kind: isBMName(r.point, s) ? 'BM' : 'TP', bs: null, hi: null, fs: v, elev: e, setup: setups.length, fsIdx: i, fsText: text, fsWires: r.wires || null, fsDist: d, ...pg('fs') });
      pointElev.push({ point: r.point, elev: e, cumDist, setup: setups.length, readingIdx: i, kind: curRow.kind });
      if (su && su.bsDist != null && su.fsDist != null && s.imbalanceLimit && Math.abs(su.bsDist - su.fsDist) > s.imbalanceLimit)
        addW(i, `Setup ${su.n} imbalance ${round(Math.abs(su.bsDist - su.fsDist), 1)} ft`);
      expect = 'BS';
    } else if (r.type === 'IFS') {
      const su = setups[setups.length - 1];
      const e = round(hi - v, 3);
      info[i] = { raw, v, corr: pc.corr, noDist: pc.noDist, d, hi: null, elev: e, setup: setups.length };
      if (su) su.ifs.push(i);
      rows.push({ sta: r.point, kind: 'IFS', ifs: true, fs: v, elev: e, setup: setups.length, fsIdx: i, fsText: text, fsWires: r.wires || null, fsDist: d, cumDist, ...pg('fs') });
      pointElev.push({ point: r.point, elev: e, cumDist: cumDist + 0, setup: setups.length, readingIdx: i, kind: 'IFS', side: true });
    }
  });
  rows.forEach((row) => {
    row.warn = [...(row.bsIdx != null ? warnings[row.bsIdx] || [] : []), ...(row.fsIdx != null ? warnings[row.fsIdx] || [] : [])];
  });
  const lastRef = expect === 'FS' ? hi : elev;
  const delta = firstElev == null ? null : round(lastRef - firstElev, 3);
  const diff = round(sumBS - sumFS, 3);
  // Running BS/FS balance over completed setups (both sights measured).
  const imbalance = round(setups.filter((su) => su.bsDist != null && su.fsDist != null).reduce((a, su) => a + su.bsDist - su.fsDist, 0), 1);
  return {
    rows, setups, warnings, pointElev, info,
    peg: peg ? { ...peg, applied: pegApplied, skipped: pegSkipped } : null,
    sumBS: round(sumBS, 3), sumFS: round(sumFS, 3),
    arith: { diff, delta, ok: delta != null && Math.abs(diff - delta) < 0.0005, against: expect === 'FS' ? 'HI' : 'elev' },
    firstElev, lastElev: elev, currentPoint: point, hi, expect,
    totalBSdist: round(totBSd, 1), totalFSdist: round(totFSd, 1), totalDist: round(totBSd + totFSd, 1),
    imbalance, failedChecks: failed, lastFS: [...readings].reverse().find((r) => r.type === 'FS') || null,
  };
}

export const closingBM = (s) => (s.type === 'run' ? s.closeBM : s.startBM);
export const standardK = (s) => {
  const st = STANDARDS.find((x) => x.id === s.standard) || STANDARDS[0];
  return st.id === 'custom' ? Number(s.customK) || 0 : st.k;
};
export const allowable = (k, miles) => round(k * Math.sqrt(Math.max(miles, 0)), 3);

export function closure(s, comp = computeSurvey(s)) {
  const bm = closingBM(s);
  const closedOn = comp.expect === 'BS' && comp.lastFS && bm && comp.currentPoint.trim().toUpperCase() === String(bm.name).trim().toUpperCase();
  const known = bm ? Number(bm.elev) : null;
  const computed = comp.lastElev;
  const misclosure = round(computed - known, 3);
  const miles = round(comp.totalDist / FT_PER_MILE, 4);
  const k = standardK(s);
  const allow = comp.totalDist > 0 ? allowable(k, miles) : null;
  const pass = allow != null && Math.abs(misclosure) <= allow + 1e-9;
  return { bm, closedOn: !!closedOn, known, computed, misclosure, miles, feet: comp.totalDist, setups: comp.setups.length, k, allowable: allow, pass, noDistance: !(comp.totalDist > 0) };
}

// Proportional adjustment. Correction = −misclosure distributed by setup count or by cumulative distance.
// Turning points / BMs: setup i of n -> i/n; distance -> cumDist/total. Side shots take the correction
// of the setup's height of instrument (setup i -> i/n; distance -> cumulative distance through that setup's BS).
export function adjust(s, method = 'setups', comp = computeSurvey(s), cl = closure(s, comp)) {
  const corr = -cl.misclosure;
  const n = comp.setups.length || 1;
  const total = comp.totalDist || 0;
  const bsCum = []; let c = 0;
  comp.setups.forEach((su) => { c += su.bsDist || 0; bsCum[su.n] = c; c += su.fsDist || 0; });
  return comp.pointElev.map((p, idx) => {
    let frac;
    if (idx === 0) frac = 0;
    else if (method === 'distance') frac = total > 0 ? (p.side ? bsCum[p.setup] : p.cumDist) / total : 0;
    else frac = p.setup / n;
    const correction = round(corr * frac, 3);
    return { ...p, frac, correction, adjusted: round(p.elev + correction, 3) };
  });
}

export function surveyStatus(s) {
  if (!s.readings?.length) return 'open';
  if (s.type === 'site') return s.closed ? 'closed' : 'open';
  if (!s.closed) return 'open';
  const cl = closure(s);
  return cl.pass ? 'closed' : 'check';
}
