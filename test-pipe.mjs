// Pipe slope calculator math. Run: node --test test-pipe.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as PS from './js/pipe.js';

const S = (len, slope, dir = 'down') => ({ len, slope, dir });

test('single drop: end = start − slope%/100 × length', () => {
  const r = PS.pipeCalc({ start: '100', sections: [S('200', '0.5')] });
  assert.equal(r.rows[0].start, 100); assert.equal(r.rows[0].change, -1); assert.equal(r.rows[0].end, 99);
  assert.equal(r.totalLen, 200); assert.equal(r.totalChange, -1); assert.equal(r.end, 99); assert.equal(r.allOk, true);
});

test('multi-section chaining: each end is the next start', () => {
  const r = PS.pipeCalc({ start: 852.4, sections: [S(150, 1.0), S(220.5, 0.75), S(98, 2.08)] });
  assert.deepEqual(r.rows.map((x) => [x.start, x.end]), [[852.4, 850.9], [850.9, 849.246], [849.246, 847.208]]);
  // 0.0075 × 220.5 = 1.65375 → 1.654; 0.0208 × 98 = 2.0384 → 2.038
  assert.equal(r.rows[1].mag, 1.654); assert.equal(r.rows[2].mag, 2.038);
  assert.equal(r.totalLen, 468.5); assert.equal(r.totalChange, -5.192); assert.equal(r.end, 847.208);
});

test('rise vs drop', () => {
  const up = PS.pipeCalc({ start: '50', sections: [S('100', '2', 'up')] }); assert.equal(up.rows[0].end, 52); assert.equal(up.rows[0].change, 2);
  const mix = PS.pipeCalc({ start: '50', sections: [S('100', '2', 'down'), S('100', '2', 'up')] }); assert.equal(mix.end, 50); assert.equal(mix.totalChange, 0);
  assert.equal(PS.dirWord(up.rows[0]), 'RISE'); assert.equal(PS.dirWord(mix.rows[0]), 'DROP');
  assert.equal(PS.pipeCalc({ start: 1, sections: [{ len: 10, slope: 1 }] }).rows[0].dir, 'down', 'drop is the default');
  assert.equal(PS.changeText(-1.5), '−1.500 ft (drop)'); assert.equal(PS.changeText(0.25), '+0.250 ft (rise)'); assert.equal(PS.changeText(0), '±0.000 ft');
});

test('rounding to 3 decimals (half away from zero, chained on the rounded value)', () => {
  const r = PS.pipeCalc({ start: '100.0004', sections: [S('33.3', '0.45')] }); // 0.14985 → 0.150
  assert.equal(r.start, 100); assert.equal(r.rows[0].mag, 0.15); assert.equal(r.rows[0].end, 99.85);
  assert.equal(PS.f3(99.85), '99.850'); assert.equal(PS.f3(0.0005), '0.001'); assert.equal(PS.f3(-0.0005), '-0.001'); assert.equal(PS.f3(NaN), '');
  const neg = PS.pipeCalc({ start: '-2.5', sections: [S('10', '1')] }); assert.equal(neg.end, -2.6, 'negative elevations are fine');
});

test('validation: start elevation', () => {
  assert.equal(PS.pipeCalc({ start: '', sections: [S(1, 1)] }).startErr, 'Enter the starting flow line elevation');
  for (const bad of ['abc', '1e3', '.', '12ft', 'Infinity', NaN]) assert.equal(PS.checkStart(bad), bad === '' ? 'x' : 'Elevation must be a number', String(bad));
  assert.equal(PS.checkStart('1,250.5'), null); assert.equal(PS.num('1,250.5'), 1250.5); assert.equal(PS.num('.5'), 0.5);
  const r = PS.pipeCalc({ start: 'x', sections: [S(100, 1), S(100, 1)] }); assert.ok(r.rows.every((x) => x.hidden && x.end == null)); assert.equal(r.end, null); assert.equal(r.totalLen, null);
});

test('validation: length > 0 and ≤ 10,000 ft; slope finite, ≥ 0, warn > 20 %, reject > 100 %', () => {
  const e = (len, slope) => PS.checkSection(S(len, slope));
  assert.deepEqual(e('0', '1').errors, ['Length must be more than 0 ft']); assert.deepEqual(e('-5', '1').errors, ['Length must be more than 0 ft']);
  assert.match(e('10000.01', '1').errors[0], /over 10,000 ft/); assert.deepEqual(e('10000', '1').errors, []);
  assert.deepEqual(e('', '1').errors, ['Enter a length']); assert.deepEqual(e('ab', '1').errors, ['Length must be a number']);
  assert.deepEqual(e('10', '').errors, ['Enter a slope']); assert.deepEqual(e('10', 'x').errors, ['Slope must be a number']);
  assert.match(e('10', '-1').errors[0], /positive %/);
  assert.deepEqual(e('10', '20').warns, []); assert.match(e('10', '20.5').warns[0], /over 20%/); assert.deepEqual(e('10', '20.5').errors, []);
  assert.deepEqual(e('10', '100').errors, []); assert.match(e('10', '100.1').errors[0], /over 100%/);
  assert.deepEqual(e('10', '0').errors, [], 'flat pipe allowed');
  // a steep section still calculates (warning only)
  const steep = PS.pipeCalc({ start: 10, sections: [S(10, 25)] }); assert.equal(steep.rows[0].end, 7.5); assert.equal(steep.rows[0].warns.length, 1);
});

test('invalid row hides its result and every row after it; totals cover the valid rows only; never NaN', () => {
  const r = PS.pipeCalc({ start: '100', sections: [S('100', '1'), S('0', '1'), S('100', '1')] });
  assert.deepEqual(r.rows.map((x) => x.hidden), [false, true, true]); assert.equal(r.rows[2].errors.length, 0, 'row 3 is fine but hidden');
  assert.equal(r.validCount, 1); assert.equal(r.allOk, false); assert.equal(r.totalLen, 100); assert.equal(r.end, 99);
  assert.equal(PS.tableRows(r).length, 1);
  const all = JSON.stringify(r) + PS.pipeText(r) + PS.pipeCSV(r); assert.doesNotMatch(all, /NaN|undefined|Infinity/);
  const empty = PS.pipeCalc(PS.pipeDefault()); assert.doesNotMatch(JSON.stringify(empty) + PS.pipeText(empty) + PS.pipeCSV(empty), /NaN|undefined/);
});

test('text and CSV export', () => {
  const r = PS.pipeCalc({ start: '100', sections: [S('200', '0.5'), S('50', '2', 'up')] });
  const t = PS.pipeText(r); assert.match(t, /Start flow line 100\.000 ft/); assert.match(t, /DROP 1\.000/); assert.match(t, /RISE 1\.000/);
  assert.match(t, /Total length 250\.00 ft · total change ±0\.000 ft · end 100\.000 ft/);
  const c = PS.pipeCSV(r).split('\r\n'); assert.equal(c[0], 'Section,Start elev ft,Length ft,Slope %,Direction,Change ft,End elev ft');
  assert.equal(c[1], '1,100.000,200,0.5,DROP,-1.000,99.000'); assert.equal(c[2], '2,99.000,50,2,RISE,1.000,100.000');
});
