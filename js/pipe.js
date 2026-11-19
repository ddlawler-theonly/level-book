// BlueWorks Level Book — Pipe Slope Calculator (pure math, no DOM). US survey feet, slope in percent.
// Each section: change = slope% / 100 × length; DROP (downhill, default) subtracts it, RISE adds it.
// A section's end flow line elevation is the next section's start.
export const MAX_LEN = 10000;   // ft per section
export const WARN_SLOPE = 20;   // % – warn (not block) above this
export const MAX_SLOPE = 100;   // % – reject above this

const r3 = (v) => { const f = 1000; return Math.round((v + Math.sign(v) * 1e-9) * f) / f; };
export const f3 = (v) => (v == null || !isFinite(v) ? '' : r3(v).toFixed(3));
// Strict number parse: '' / '.' / '1e3' / '12abc' are not numbers. Accepts '-12.5', '.5', '1,250.5'.
export function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(/,/g, '');
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}
export const blank = (v) => String(v ?? '').trim() === '';

export function checkStart(v) {
  if (blank(v)) return 'Enter the starting flow line elevation';
  return num(v) == null ? 'Elevation must be a number' : null;
}
export function checkSection(sec) {
  const errors = []; const warns = [];
  const L = num(sec.len), S = num(sec.slope);
  if (blank(sec.len)) errors.push('Enter a length');
  else if (L == null) errors.push('Length must be a number');
  else if (L <= 0) errors.push('Length must be more than 0 ft');
  else if (L > MAX_LEN) errors.push(`Length over ${MAX_LEN.toLocaleString('en-US')} ft – split it into sections`);
  if (blank(sec.slope)) errors.push('Enter a slope');
  else if (S == null) errors.push('Slope must be a number');
  else if (S < 0) errors.push('Enter slope as a positive % and pick Drop or Rise');
  else if (S > MAX_SLOPE) errors.push(`Slope over ${MAX_SLOPE}% – check the value`);
  else if (S > WARN_SLOPE) warns.push(`Steep: ${r3(S)}% is over ${WARN_SLOPE}% – double-check`);
  return { errors, warns, len: errors.length ? null : L, slope: errors.length ? null : S };
}

// state: { start, sections: [{ len, slope, dir: 'down' | 'up' }] } – values may be strings (as typed) or numbers.
export function pipeCalc(state) {
  const startErr = checkStart(state.start);
  let elev = startErr ? null : r3(num(state.start));
  let blocked = !!startErr; let totalLen = 0; let validCount = 0;
  const start0 = elev;
  const rows = (state.sections || []).map((sec, i) => {
    const dir = sec.dir === 'up' ? 'up' : 'down';
    const c = checkSection(sec);
    const row = { n: i + 1, dir, errors: c.errors, warns: c.warns, len: c.len, slope: c.slope, start: null, change: null, end: null, hidden: true };
    if (blocked || c.errors.length) { blocked = true; return row; }
    const mag = r3((c.slope / 100) * c.len);
    const end = r3(elev + (dir === 'up' ? mag : -mag));
    Object.assign(row, { start: elev, change: dir === 'up' ? mag : -mag, mag, end, hidden: false });
    elev = end; totalLen += c.len; validCount++;
    return row;
  });
  const n = rows.length; const allOk = !startErr && n > 0 && validCount === n;
  const totalChange = validCount ? r3(elev - start0) : null;
  return { startErr, start: start0, rows, validCount, allOk, totalLen: validCount ? r3(totalLen) : null, totalChange, end: validCount ? elev : null };
}

export const dirWord = (row) => (row.dir === 'up' ? 'RISE' : 'DROP');
export const TABLE_HEAD = ['#', 'START ELEV', 'LENGTH', 'SLOPE %', 'DROP/RISE', 'END ELEV'];
export const tableRows = (res) => res.rows.filter((r) => !r.hidden).map((r) => [String(r.n), f3(r.start), r3(r.len).toFixed(2), String(r3(r.slope)), `${dirWord(r)} ${f3(r.mag)}`, f3(r.end)]);
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(3);
export const changeText = (v) => (v == null ? '' : `${signed(v)} ft${v < 0 ? ' (drop)' : v > 0 ? ' (rise)' : ''}`);

export function pipeText(res, title = 'Pipe slope') {
  const pad = (s, n) => String(s).padStart(n);
  const out = [`BLUEWORKS LEVEL BOOK – ${title}`, `Start flow line ${f3(res.start)} ft`, `${pad('#', 2)}${pad('START', 10)}${pad('LEN', 9)}${pad('SLOPE%', 8)}${pad('DROP/RISE', 13)}${pad('END', 10)}`];
  tableRows(res).forEach((r) => out.push(`${pad(r[0], 2)}${pad(r[1], 10)}${pad(r[2], 9)}${pad(r[3], 8)}${pad(r[4], 13)}${pad(r[5], 10)}`));
  if (res.validCount) out.push(`Total length ${res.totalLen.toFixed(2)} ft · total change ${changeText(res.totalChange)} · end ${f3(res.end)} ft`);
  if (!res.allOk) out.push(`(${res.rows.length - res.validCount} section${res.rows.length - res.validCount === 1 ? '' : 's'} not calculated – fix the inputs)`);
  out.push('US survey feet · change = slope% / 100 × length');
  return out.join('\n');
}
export function pipeCSV(res) {
  const lines = [['Section', 'Start elev ft', 'Length ft', 'Slope %', 'Direction', 'Change ft', 'End elev ft']];
  res.rows.filter((r) => !r.hidden).forEach((r) => lines.push([r.n, f3(r.start), r3(r.len), r3(r.slope), dirWord(r), f3(r.change), f3(r.end)]));
  if (res.validCount) lines.push([], ['Total length ft', r3(res.totalLen)], ['Total change ft', f3(res.totalChange)], ['End elev ft', f3(res.end)]);
  return lines.map((l) => l.join(',')).join('\r\n');
}
export const pipeDefault = () => ({ start: '', sections: [{ len: '', slope: '', dir: 'down' }] });
