// Report builders: model -> plain text, CSV, PDF (jsPDF, vendored), HTML preview pages.
import * as C from './calc.js';
export const APP_VERSION = '1.1.0';

const TYPE = { loop: 'Level Loop', run: 'Level Run', site: 'Site Levels' };
export const usDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
export const stamp = (d = new Date()) => {
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let tz = ''; try { tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName').value; } catch (e) {}
  return `${date} ${time} ${tz}`.trim();
};
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(3);

export function surveyModel(job, s) {
  const comp = C.computeSurvey(s);
  const isSite = s.type === 'site';
  const cl = isSite ? null : C.closure(s, comp);
  const closed = !!s.closed && (isSite || cl.closedOn);
  const adj = !isSite && closed && cl.closedOn ? C.adjust(s, s.adjustMethod || 'setups', comp, cl) : null;
  const std = C.STANDARDS.find((x) => x.id === s.standard) || C.STANDARDS[0];
  const pegT = s.peg?.test || null; const peg = pegT ? C.pegTest(pegT, pegT.tol || C.PEG_TOL_DEFAULT) : null;
  return { job, s, comp, cl, closed, adj, std, isSite, three: s.method === 'three' && !isSite, pegOn: !!comp.peg, pegT, peg };
}

// Peg-correction status line and the peg test record (for every report format).
export function pegStatus(m) {
  if (m.isSite) return null;
  if (m.pegOn) return `ON – C ${C.pegLabel(m.comp.peg.per100)} ft/100 ft (test ${usDate(m.pegT.date)}, ${m.pegT.instrument || '—'}); ${m.comp.peg.applied} readings corrected, ${m.comp.peg.skipped} without distance left as read`;
  return m.pegT ? `OFF – raw readings (test ${usDate(m.pegT.date)} on file, C ${C.pegLabel(m.peg.per100)} ft/100 ft)` : 'OFF – no peg test';
}
export function pegLines(t, p = C.pegTest(t)) {
  return [
    ['Peg test date', `${usDate(t.date)}${t.sample ? ' (SAMPLE)' : ''}`], ['Instrument / observer', `${t.instrument || '—'} / ${t.observer || '—'}`],
    ['Peg spacing', `${C.round(t.spacing, 1)} ft`],
    ['Setup 1 (midway)', `a1 ${C.f3(t.a1)}  b1 ${C.f3(t.b1)}  sights ${p.dA1.toFixed(1)}/${p.dB1.toFixed(1)} ft  a1-b1 ${sgn(p.diff1)}`],
    ['Setup 2 (near A)', `a2 ${C.f3(t.a2)}  b2 ${C.f3(t.b2)}  sights ${C.round(p.dA2, 1)}/${C.round(p.dB2, 1)} ft  a2-b2 ${sgn(p.diff2)}`],
    ['Collimation C', `${C.pegLabel(p.per100)} ft/100 ft (${p.arcsec == null ? '—' : (p.arcsec >= 0 ? '+' : '-') + Math.abs(p.arcsec).toFixed(1) + '"'}); 300 ft sight ${sgn(p.err300)} ft`],
    ['Peg test result', `${p.pass ? 'PASS' : 'FAIL'} (tolerance ${p.tol} ft/100 ft)`],
    ['Formula', 'C = [(a2-b2)-(a1-b1)] / (dA-dB); corrected = reading - C x dist'],
  ];
}

export const reportTitle = (job, s) => `Level Book – ${job.name}${s ? ' – ' + s.name : ''} – ${usDate(job.date)}`;
export const fileBase = (job, s) => ['LevelBook', job.name, s ? s.name : 'Job', (job.date || '').replace(/-/g, '')].join('_').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');

function tableRows(m, inc) {
  const { comp, s, three } = m; const out = [];
  comp.rows.forEach((r) => {
    const wires = (w) => (w ? [w.t.toFixed(3), w.m.toFixed(3), w.b.toFixed(3)] : ['', '', '']);
    const row = {
      sta: (r.ifs ? '  ' : '') + r.sta + (r.ifs ? ' (IFS)' : ''), bs: r.bs != null ? C.fmtReading(r.bsRaw ?? r.bs, r.bsRaw != null ? r.bsRawText : r.bsText) : '', hi: r.hi != null ? C.f3(r.hi) : '',
      fs: r.fs != null ? C.fmtReading(r.fsRaw ?? r.fs, r.fsRaw != null ? r.fsRawText : r.fsText) : '', elev: C.f3(r.elev),
      peg: [['bs', 'BS'], ['fs', r.ifs ? 'IFS' : 'FS']].map(([p]) => (r[p] == null ? null : r[p + 'Corr'] != null ? sgn(r[p + 'Corr']) : r[p + 'NoPeg'] ? 'n/d' : null)).filter(Boolean).join('/'), dist: [r.bsDist, r.fsDist].filter((x) => x != null).join('/'),
      note: (r.warn || []).join('; '), bm: r.kind === 'BM', ifs: !!r.ifs, warn: (r.warn || []).length > 0,
    };
    if (three && inc.threewire) {
      const tw = r.bsWires ? r.bsWires : null; const fw = r.fsWires ? r.fsWires : null;
      row.wiresBS = wires(tw); row.wiresFS = wires(fw);
      const chk = (w) => { if (!w) return ''; const t = C.threeWire(w, s.stadiaK, s.spreadTol); return (t.orderOk && t.spreadOk ? 'OK ' : 'FAIL ') + 'Δ' + t.spreadDiff.toFixed(3); };
      row.check = [chk(tw), chk(fw)].filter(Boolean).join(' / ');
    }
    out.push(row);
  });
  return out;
}

function checksLines(m) {
  const { comp, cl, s, isSite, three } = m; const L = [];
  L.push(['Sum BS / Sum FS', `${comp.sumBS.toFixed(3)} / ${comp.sumFS.toFixed(3)}`]);
  L.push(['Arithmetic check', `${sgn(comp.arith.diff)} vs ${sgn(comp.arith.delta)} ${comp.arith.ok ? 'PASS' : 'FAIL'}`]);
  L.push(['BS / FS distance', `${comp.totalBSdist} / ${comp.totalFSdist} ft (imbalance ${comp.imbalance} ft)`]);
  if (three) L.push(['Three-wire checks failed', String(comp.failedChecks)]);
  if (!isSite) L.push(['Peg correction', pegStatus(m)]);
  if (!isSite) {
    L.push(['Closed on', cl.closedOn ? `${cl.bm.name}` : 'NOT CLOSED']);
    if (cl.closedOn) {
      L.push(['Known / computed elev', `${C.f3(cl.known)} / ${C.f3(cl.computed)}`]);
      L.push(['Misclosure', `${sgn(cl.misclosure)} ft`]);
      L.push(['Distance / setups', `${cl.feet} ft (${cl.miles.toFixed(3)} mi) / ${cl.setups}`]);
      L.push(['Allowable', cl.allowable == null ? 'n/a (no distances)' : `${cl.allowable.toFixed(3)} ft  (${cl.k} ft√mi, ${m.std.id === 'custom' ? 'custom' : m.std.label})`]);
      L.push(['Result', cl.allowable == null ? 'NO DISTANCE' : cl.pass ? 'PASS' : 'FAIL']);
    }
  }
  const warns = []; comp.rows.forEach((r) => (r.warn || []).forEach((w) => warns.push(`${r.sta}: ${w}`)));
  return { lines: L, warns };
}

function headerLines(m) {
  const { job, s } = m;
  return [
    ['Job', job.name], ['Project date', usDate(job.date)], ['Description', job.description || ''], ['Client / job #', job.client || ''],
    ['Survey', `${s.name} (${TYPE[s.type]})`], ['Reading method', s.type === 'site' ? 'Single wire' : s.method === 'three' ? `Three-wire (K=${s.stadiaK}, tol ${s.spreadTol} ft)` : 'Single wire'],
    ['Observer / rod', `${s.observer || '—'} / ${s.rodPerson || '—'}`], ['Instrument', s.instrument || '—'], ['Units', 'US survey decimal feet'],
    ...(s.type === 'site' ? [] : [['Peg correction', pegStatus(m)]]),
    ['Benchmarks', `Start ${s.startBM.name} ${C.f3(Number(s.startBM.elev))}` + (s.type === 'run' ? `; close ${s.closeBM.name} ${C.f3(Number(s.closeBM.elev))}` : s.type === 'loop' ? `; close on ${s.startBM.name}` : '')],
  ];
}

const pad = (s, n, right) => { s = String(s ?? ''); return right ? s.padStart(n) : s.padEnd(n); };

export function textReport(job, surveys) {
  const out = [];
  surveys.forEach((s, i) => {
    const m = surveyModel(job, s);
    if (i) out.push('');
    out.push(`LEVEL BOOK – ${job.name}`);
    out.push(`${usDate(job.date)} · ${job.description || ''}`.trim());
    out.push(`${s.name} · ${TYPE[s.type]} · ${m.three ? '3-wire' : 'single wire'}`);
    if (!m.closed) out.push('*** IN PROGRESS – NOT CLOSED ***');
    out.push(`Start ${s.startBM.name} ${C.f3(Number(s.startBM.elev))}`);
    if (!m.isSite) out.push(m.pegOn ? `Peg corr ON: C ${C.pegLabel(m.comp.peg.per100)} ft/100ft (test ${usDate(m.pegT.date)}, ${m.pegT.instrument || '—'}) · ${m.comp.peg.applied} corr, ${m.comp.peg.skipped} no dist` : `Peg corr OFF${m.pegT ? ` (test ${usDate(m.pegT.date)} on file)` : ''}`);
    out.push(`ΣBS ${m.comp.sumBS.toFixed(3)}  ΣFS ${m.comp.sumFS.toFixed(3)}  Arith ${m.comp.arith.ok ? 'PASS ✔' : 'FAIL ✕'}`);
    if (m.cl && m.cl.closedOn) {
      out.push(`Closed on ${m.cl.bm.name}: misclose ${sgn(m.cl.misclosure)} ft`);
      out.push(`Allow ${m.cl.allowable == null ? 'n/a' : m.cl.allowable.toFixed(3)} ft (${m.cl.feet} ft) → ${m.cl.allowable == null ? 'NO DIST' : m.cl.pass ? 'PASS ✔' : 'FAIL ✕'}`);
    }
    if (m.adj) {
      out.push(`FINAL ELEVATIONS (adj. by ${s.adjustMethod === 'distance' ? 'distance' : 'setups'})`);
      m.adj.slice(1).forEach((p) => out.push(`${pad(p.point + (p.side ? '*' : ''), 10)}${pad(p.adjusted.toFixed(3), 9, true)}`));
      if (m.adj.some((p) => p.side)) out.push('* side shot');
    } else {
      out.push('ELEVATIONS (unadjusted)');
      m.comp.pointElev.slice(1).forEach((p) => out.push(`${pad(p.point + (p.side ? '*' : ''), 10)}${pad(p.elev.toFixed(3), 9, true)}`));
    }
  });
  out.push(`Generated ${stamp()} · Level Book v${APP_VERSION}`);
  return out.join('\n');
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvReport(job, surveys) {
  const lines = [['Job', job.name], ['Project date', usDate(job.date)], ['Description', job.description || ''], ['Client/job #', job.client || ''], ['Units', 'US survey decimal ft'], ['Generated', stamp()], []];
  lines.push(['Survey', 'Type', 'Method', 'Seq', 'Setup', 'Reading', 'Point', 'Value', 'Top', 'Mid', 'Bot', 'Dist ft', 'Peg corr', 'Corrected', 'HI', 'Elev', 'Adj Elev', 'Check', 'Notes', 'Status']);
  const pegRows = [];
  surveys.forEach((s) => {
    const m = surveyModel(job, s); const adjBy = {}; (m.adj || []).forEach((p) => { if (p.readingIdx >= 0) adjBy[p.readingIdx] = p.adjusted; });
    if (m.pegT) pegRows.push([s.name, m.pegOn ? 'Peg correction ON' : 'Peg correction OFF'], ...pegLines(m.pegT, m.peg).map(([k, v]) => [s.name, k, v]));
    s.readings.forEach((r, i) => {
      const inf = m.comp.info[i]; const v = inf.raw; const d = inf.d;
      const tw = r.wires ? C.threeWire(r.wires, s.stadiaK, s.spreadTol) : null;
      lines.push([s.name, TYPE[s.type], m.three ? '3-wire' : 'single', i + 1, inf.setup, r.type, r.point, C.fmtReading(v, r.wires ? null : r.text), r.wires ? r.wires.t.toFixed(3) : '', r.wires ? r.wires.m.toFixed(3) : '', r.wires ? r.wires.b.toFixed(3) : '', d ?? '',
        inf.corr != null ? inf.corr.toFixed(3) : m.pegOn && inf.noDist ? 'no dist' : '', m.pegOn ? inf.v.toFixed(3) : '', r.type === 'BS' ? C.f3(inf.hi) : '', inf.elev == null ? '' : C.f3(inf.elev), adjBy[i] != null ? C.f3(adjBy[i]) : '', tw ? (tw.orderOk && tw.spreadOk ? 'PASS' : 'FAIL') + ` d${tw.spreadDiff.toFixed(3)}` : '', (m.comp.warnings[i] || []).join('; '), m.closed ? 'CLOSED' : 'IN PROGRESS'],);
    });
  });
  if (pegRows.length) lines.push([], ['Survey', 'Peg test', 'Value'], ...pegRows);
  return lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
}

// ---- PDF (jsPDF + AutoTable, loaded from /vendor as globals) ----
const winAnsi = (s) => String(s ?? '').replace(/ft√mi/g, 'ft*sqrt(mi)').replace(/mm√km/g, 'mm*sqrt(km)').replace(/±/g, '+').replace(/Σ/g, 'Sum ').replace(/Δ/g, 'd').replace(/✔/g, 'OK').replace(/✕/g, 'X').replace(/⚠/g, '!').replace(/√/g, 'sqrt').replace(/→/g, '->').replace(/·/g, '-').replace(/−/g, '-').replace(/±/g, '+/-').replace(/[^\x00-\xFF–—]/g, '?');

export function pdfReport(job, surveys, inc) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(); const M = 40;
  surveys.forEach((s, si) => {
    if (si) doc.addPage();
    const m = surveyModel(job, s);
    let y = M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(winAnsi(`LEVEL BOOK – ${job.name}`), M, y); y += 8;
    doc.setDrawColor(255, 196, 0); doc.setLineWidth(3); doc.line(M, y, W - M, y); y += 14;
    if (!m.closed) { doc.setTextColor(197, 34, 31); doc.setFontSize(11); doc.text('IN PROGRESS – NOT CLOSED', M, y); doc.setTextColor(0); y += 14; }
    doc.setFontSize(9);
    headerLines(m).forEach(([k, v]) => { doc.setFont('helvetica', 'bold'); doc.text(winAnsi(k), M, y); doc.setFont('helvetica', 'normal'); doc.text(winAnsi(v), M + 95, y, { maxWidth: W - 2 * M - 95 }); y += 12; });
    y += 4;
    if (inc.table) {
      const rows = tableRows(m, inc);
      const head = ['STA', 'BS', 'HI', 'FS', 'ELEV', 'DIST'];
      if (m.pegOn) head.push('PEG CORR');
      if (m.three && inc.threewire) head.push('BS T/M/B', 'FS T/M/B', 'CHECK');
      if (inc.notes) head.push('NOTES');
      const body = rows.map((r) => { const b = [r.sta, r.bs, r.hi, r.fs, r.elev, r.dist]; if (m.pegOn) b.push(r.peg); if (m.three && inc.threewire) b.push(r.wiresBS.filter(Boolean).join('/'), r.wiresFS.filter(Boolean).join('/'), r.check); if (inc.notes) b.push(r.note); return b.map(winAnsi); });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('LEVEL BOOK', M, y + 6); y += 10;
      doc.autoTable({ startY: y, head: [head], body, margin: { left: M, right: M, bottom: 50 }, theme: 'plain',
        styles: { font: 'courier', fontSize: m.three && inc.threewire ? 6.5 : 8.5, cellPadding: 3, halign: 'right', textColor: 20 },
        headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [228, 228, 222], halign: 'right' },
        alternateRowStyles: { fillColor: [239, 239, 234] },
        columnStyles: { 0: { halign: 'left', font: 'helvetica' } },
        didParseCell: (d) => { if (d.section === 'head' && d.column.index === 0) d.cell.styles.halign = 'left'; if (d.section === 'body' && rows[d.row.index].bm && d.column.index === 0) d.cell.styles.fontStyle = 'bold'; },
        didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 0) { const r = rows[d.row.index]; if (r.bm || r.warn) { doc.setFillColor(...(r.warn ? [227, 116, 0] : [11, 95, 165])); doc.rect(d.cell.x, d.cell.y, 2.5, d.cell.height, 'F'); } } },
      });
      y = doc.lastAutoTable.finalY + 16;
      if (m.pegOn) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.text(winAnsi('BS/FS are the readings as booked; HI and ELEV use peg-corrected readings (reading - C x sight distance). n/d = no distance, not corrected.'), M, y - 6); y += 6; }
    }
    const block = (title, lines) => {
      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(title, M, y); y += 4;
      doc.autoTable({ startY: y, body: lines.map((l) => l.map(winAnsi)), theme: 'plain', margin: { left: M, right: M, bottom: 50 }, styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 }, 1: { font: 'courier' } },
        didParseCell: (d) => { const t = String(d.cell.raw || ''); if (d.column.index === 1 && /\bFAIL\b|NOT CLOSED/.test(t)) d.cell.styles.textColor = [197, 34, 31]; else if (d.column.index === 1 && /\bPASS\b/.test(t)) d.cell.styles.textColor = [30, 142, 62]; } });
      y = doc.lastAutoTable.finalY + 14;
    };
    if (inc.checks) { const c = checksLines(m); block('CHECKS & CLOSURE', c.lines); if (c.warns.length && inc.notes) block('WARNINGS', c.warns.map((w) => ['!', w])); }
    if (m.pegT && inc.peg !== false) block(`PEG TEST RECORD (${m.pegOn ? 'applied' : 'not applied'})`, pegLines(m.pegT, m.peg));
    if (inc.adjusted) {
      if (m.adj) block(`FINAL ELEVATIONS (adjusted by ${s.adjustMethod === 'distance' ? 'distance' : 'setups'})`, [['Point', 'Measured / Corr / ADJUSTED'], ...m.adj.map((p) => [p.point + (p.side ? ' (IFS)' : ''), `${C.f3(p.elev)}  ${sgn(p.correction)}  ${C.f3(p.adjusted)}`])]);
      else block('ELEVATIONS (unadjusted – not closed)', m.comp.pointElev.map((p) => [p.point + (p.side ? ' (IFS)' : ''), C.f3(p.elev)]));
    }
  });
  const n = doc.getNumberOfPages(); const H = doc.internal.pageSize.getHeight(); const st = winAnsi(stamp());
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text(winAnsi(`Generated ${st} - Level Book v${APP_VERSION} - US survey feet`), M, H - 24);
    doc.text(`Page ${i} of ${n}`, W - M, H - 24, { align: 'right' }); doc.setTextColor(0);
  }
  return doc;
}

// ---- HTML preview pages (approximate letter pagination) ----
const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function previewPages(job, surveys, inc) {
  const PAGE_LINES = 54; const pages = []; let cur = []; let lines = 0;
  const push = (html, n) => { if (lines + n > PAGE_LINES && cur.length) { pages.push(cur.join('')); cur = []; lines = 0; } cur.push(html); lines += n; };
  surveys.forEach((s, si) => {
    if (si && cur.length) { pages.push(cur.join('')); cur = []; lines = 0; }
    const m = surveyModel(job, s);
    push(`<h3>LEVEL BOOK – ${e(job.name)}</h3><div style="height:2px;background:#FFC400;margin:2px 0 4px"></div>${m.closed ? '' : '<div class="inprog">IN PROGRESS – NOT CLOSED</div>'}`, 3);
    push(`<table class="kvt">${headerLines(m).map(([k, v]) => `<tr><td style="text-align:left;font-family:Helvetica;font-weight:700;width:28%;background:none">${e(k)}</td><td style="text-align:left;background:none">${e(v)}</td></tr>`).join('')}</table>`, 11);
    if (inc.table) {
      const rows = tableRows(m, inc);
      const head = ['STA', 'BS', 'HI', 'FS', 'ELEV', 'DIST']; if (m.pegOn) head.push('PEG'); if (m.three && inc.threewire) head.push('BS T/M/B', 'FS T/M/B', 'CHECK'); if (inc.notes) head.push('NOTES');
      const th = `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>`;
      let chunk = []; const flush = () => { if (chunk.length) push(`<table>${th}${chunk.join('')}</table>`, chunk.length + 1); chunk = []; };
      push('<h4>LEVEL BOOK</h4>', 2);
      rows.forEach((r) => {
        const c = [r.sta, r.bs, r.hi, r.fs, r.elev, r.dist]; if (m.pegOn) c.push(r.peg); if (m.three && inc.threewire) c.push(r.wiresBS.filter(Boolean).join('/'), r.wiresFS.filter(Boolean).join('/'), r.check); if (inc.notes) c.push(r.note);
        chunk.push(`<tr>${c.map((x, i) => `<td style="${i === 0 ? `border-left:3px solid ${r.warn ? '#E37400' : r.bm ? '#0B5FA5' : 'transparent'};${r.bm ? 'font-weight:700' : ''}` : ''}">${e(x)}</td>`).join('')}</tr>`);
        if (lines + chunk.length + 1 >= PAGE_LINES) flush();
      });
      flush();
      if (m.pegOn) push('<div style="font-style:italic;font-size:7px;color:#444">BS/FS as booked; HI and ELEV use peg-corrected readings (reading − C × dist). n/d = no distance.</div>', 1);
    }
    const block = (t, L) => push(`<h4>${e(t)}</h4><table>${L.map(([k, v]) => `<tr><td style="text-align:left;font-family:Helvetica;font-weight:700;width:38%">${e(k)}</td><td style="text-align:left;${/\bFAIL\b|NOT CLOSED/.test(v) ? 'color:#C5221F;font-weight:700' : /\bPASS\b/.test(v) ? 'color:#1E8E3E;font-weight:700' : ''}">${e(v)}</td></tr>`).join('')}</table>`, L.length + 2);
    if (inc.checks) { const c = checksLines(m); block('CHECKS & CLOSURE', c.lines); if (c.warns.length && inc.notes) block('WARNINGS', c.warns.map((w) => ['⚠', w])); }
    if (m.pegT && inc.peg !== false) block(`PEG TEST RECORD (${m.pegOn ? 'applied' : 'not applied'})`, pegLines(m.pegT, m.peg));
    if (inc.adjusted) {
      if (m.adj) block(`FINAL ELEVATIONS (adjusted by ${s.adjustMethod === 'distance' ? 'distance' : 'setups'})`, [['Point', 'Measured / Corr / ADJUSTED'], ...m.adj.map((p) => [p.point + (p.side ? ' (IFS)' : ''), `${C.f3(p.elev)}  ${sgn(p.correction)}  ${C.f3(p.adjusted)}`])]);
      else block('ELEVATIONS (unadjusted – not closed)', m.comp.pointElev.map((p) => [p.point + (p.side ? ' (IFS)' : ''), C.f3(p.elev)]));
    }
  });
  if (cur.length) pages.push(cur.join(''));
  const st = stamp();
  return pages.map((p, i) => `${p}<div style="margin-top:8px;color:#666;font-size:7.5px;display:flex;justify-content:space-between"><span>Generated ${e(st)} · Level Book v${APP_VERSION}</span><span>Page ${i + 1} of ${pages.length}</span></div>`);
}
