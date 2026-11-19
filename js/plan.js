// Plan sheet (PRO preview): plan PDFs live in IndexedDB, render offline with vendored pdf.js (legacy build),
// shots are pinned as { planId, page, x, y } with x/y normalized 0–1 on the rendered page (zoom/screen independent).
import { isPro as entPro } from './ent.js';
export const isPro = () => entPro();
export const PRO_TAG = '<span class="protag" title="Pro feature">PRO</span>';
export const WARN_MB = 20; export const MAX_MB = 60;

// ---------- IndexedDB (PDF bytes; metadata stays in the job JSON) ----------
const DBN = 'levelbook-plans'; const ST = 'pdfs';
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => { idbP = null; rej(r.error); };
  });
  return idbP;
}
function tx(mode, fn) {
  return idb().then((db) => new Promise((res, rej) => {
    const t = db.transaction(ST, mode); const req = fn(t.objectStore(ST));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage aborted'));
  }));
}
// ArrayBuffer, not Blob: Blobs in IndexedDB have been unreliable on older iOS Safari.
export const putPdf = (id, name, data) => tx('readwrite', (s) => s.put({ id, name, data, saved: Date.now() }));
export const getPdf = (id) => tx('readonly', (s) => s.get(id));
export const delPdf = (id) => { forgetDoc(id); return tx('readwrite', (s) => s.delete(id)); };
export const hasPdf = (id) => tx('readonly', (s) => s.count(id)).then((n) => n > 0);

// ---------- pdf.js ----------
let libP = null;
const FONTS = new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href;
export function pdfjs() {
  if (!libP) libP = import('../vendor/pdfjs/pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href; return m; }).catch((e) => { libP = null; throw e; });
  return libP;
}
const docOpts = (data) => ({ data, standardFontDataUrl: FONTS, isEvalSupported: false, isImageDecoderSupported: false, disableAutoFetch: true, disableFontFace: false }) // WebCodecs JPEG path crashes WebKit; use pdf.js's own decoder;
const docs = new Map(); // planId -> Promise<PDFDocumentProxy>; keep 2 open (iOS memory)
export function openDoc(id) {
  if (docs.has(id)) { const p = docs.get(id); docs.delete(id); docs.set(id, p); return p; }
  const p = (async () => {
    const rec = await getPdf(id);
    if (!rec) { const e = new Error('Plan PDF is not on this device – re-attach it from the job menu.'); e.missing = true; throw e; }
    const lib = await pdfjs(); return lib.getDocument(docOpts(new Uint8Array(rec.data))).promise;
  })();
  p.catch(() => docs.delete(id));
  docs.set(id, p);
  while (docs.size > 2) { const [k, v] = docs.entries().next().value; docs.delete(k); v.then((d) => d.destroy()).catch(() => {}); }
  return p;
}
export function forgetDoc(id) { const p = docs.get(id); if (p) { docs.delete(id); p.then((d) => d.destroy()).catch(() => {}); } }
// Validate a picked file: returns { pages } or throws a friendly error.
export async function inspectPdf(buf) {
  const lib = await pdfjs();
  try {
    const d = await lib.getDocument(docOpts(new Uint8Array(buf.slice(0)))).promise; const n = d.numPages; await d.destroy(); return { pages: n };
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('This PDF is password-protected. Save an unlocked copy and attach that.');
    throw new Error("That file couldn't be read as a PDF.");
  }
}
// Render one page to a canvas, capped by longest side and total pixels (iOS canvas memory limits).
export async function renderPage(id, pageNo, { maxSide = 4096, maxPixels = 10e6 } = {}) {
  const doc = await openDoc(id); const n = doc.numPages; const page = await doc.getPage(Math.min(Math.max(1, pageNo), n));
  const vp1 = page.getViewport({ scale: 1 });
  const sc = Math.min(maxSide / Math.max(vp1.width, vp1.height), Math.sqrt(maxPixels / (vp1.width * vp1.height)));
  const vp = page.getViewport({ scale: sc });
  const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise; page.cleanup();
  return { canvas: c, ptW: vp1.width, ptH: vp1.height, pages: n };
}
export const freeCanvas = (c) => { if (c) { c.width = 0; c.height = 0; } };

// ---------- label placement (shared by viewer and export) ----------
// items: [{ x, y, w, h }] in px (pin centre, label size). Returns [{ lx, ly, leader }] (label top-left).
const ANG = [0, -35, 35, 180, -145, 145, -90, 90, -60, 60, -120, 120].map((a) => (a * Math.PI) / 180);
export function placeLabels(items, { W, H, r }) {
  const placed = []; const pins = items.map((p) => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }));
  const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return items.map((p, i) => {
    let best = null;
    for (let k = 0; k < 7 && !(best && best.cost === 0); k++) {
      const d = r + 3 + k * r * 1.7;
      for (const a of ANG) {
        const cx = Math.cos(a), cy = Math.sin(a); const ax = p.x + cx * d, ay = p.y + cy * d;
        const x = cx > 0.3 ? ax : cx < -0.3 ? ax - p.w : ax - p.w / 2;
        const y = cy > 0.3 ? ay : cy < -0.3 ? ay - p.h : ay - p.h / 2;
        const rect = { x, y, w: p.w, h: p.h };
        let cost = 0;
        if (x < 0 || y < 0 || x + p.w > W || y + p.h > H) cost += 1e6;
        for (const q of placed) cost += ov(rect, q) * 3;
        pins.forEach((q, j) => { if (j !== i) cost += ov(rect, q) * 2; });
        cost += k * 0.01; // prefer close
        if (!best || cost < best.cost) best = { cost, rect, k };
        if (cost < 1) break;
      }
      if (best && best.cost < 1) break;
    }
    placed.push(best.rect);
    return { lx: best.rect.x, ly: best.rect.y, leader: best.k > 0 };
  });
}
// closest point on a rect to (x, y) – leader line end
export const rectNear = (r, x, y) => ({ x: Math.max(r.x, Math.min(x, r.x + r.w)), y: Math.max(r.y, Math.min(y, r.y + r.h)) });

// Draw pins + decluttered labels onto a rendered page canvas (export). pins: [{ n, x, y, color, lines:[{t, color}] }]
export function drawPins(canvas, pins) {
  const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; const L = Math.max(W, H);
  const r = Math.max(10, Math.round(L * 0.0105)); const fs = Math.max(11, Math.round(r * 1.0)); const lh = Math.round(fs * 1.2); const pad = Math.round(fs * 0.35);
  ctx.font = `700 ${fs}px "DejaVu Sans Mono", Menlo, monospace`;
  const items = pins.map((p) => { const w = Math.max(...p.lines.map((l) => ctx.measureText(l.t).width)) + pad * 2; return { x: p.x * W, y: p.y * H, w, h: p.lines.length * lh + pad }; });
  const pl = placeLabels(items, { W, H, r });
  // leaders first, then labels, then pins on top
  pins.forEach((p, i) => { if (!pl[i].leader) return; const it = items[i]; const e = rectNear({ x: pl[i].lx, y: pl[i].ly, w: it.w, h: it.h }, it.x, it.y);
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(e.x, e.y); ctx.stroke(); });
  pins.forEach((p, i) => {
    const it = items[i]; const { lx, ly } = pl[i];
    ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, r * 0.12);
    roundRect(ctx, lx, ly, it.w, it.h, Math.round(fs * 0.3)); ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    p.lines.forEach((l, k) => { ctx.fillStyle = l.color || '#111'; ctx.fillText(l.t, lx + pad, ly + pad * 0.6 + k * lh); });
  });
  pins.forEach((p, i) => {
    const it = items[i]; ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.2); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(r * (p.n > 99 ? 0.8 : 1.05))}px Helvetica, Arial, sans-serif`;
    ctx.fillText(String(p.n), it.x, it.y + 1); ctx.font = `700 ${fs}px "DejaVu Sans Mono", Menlo, monospace`;
  });
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// Rasterize a plan page with all its pins to JPEG (for the PDF report).
export async function rasterize(planId, page, pins, { maxSide = 2400, maxPixels = 5.5e6, quality = 0.85 } = {}) {
  const { canvas, ptW, ptH } = await renderPage(planId, page, { maxSide, maxPixels });
  drawPins(canvas, pins);
  const out = { dataUrl: canvas.toDataURL('image/jpeg', quality), w: canvas.width, h: canvas.height, ptW, ptH };
  freeCanvas(canvas); return out;
}

// ---------- full-screen viewer ----------
// opts: { title, sub, plans, planId, page, mode: 'mark'|'view', shot: { ref, kind }, pins (raw, copied), resolve(raw) -> resolved[],
//         surveyName, markOn, onToggleMark, ui: { esc, sheet, confirmDialog, toast, setSwitch } }
// Resolves to { action: 'done'|'skip', pins, last: { planId, page } }.
const viewMem = new Map();
export function openViewer(o) {
  const { esc, sheet, toast } = o.ui;
  let work = JSON.parse(JSON.stringify(o.pins || [])); const undo = [];
  let planId = o.planId, page = o.page || 1; let cv = null, ptW = 1, ptH = 1, pages = 1; let loadSeq = 0;
  let z = 1, tx = 0, ty = 0, fitW = 0, fitH = 0, vw = 0, vh = 0;
  const memKey = o.memKey;
  const el = document.createElement('div'); el.className = 'planview'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Plan sheet');
  const mark = o.mode === 'mark';
  el.innerHTML = `<div class="strip pv-strip"><button class="back" id="pvX" aria-label="${mark ? 'Skip' : 'Close plan'}" style="font-size:26px;padding:0 10px">✕</button>
      <div class="st-l"><div class="st1"><span class="pv-t">${esc(o.title)}</span>${PRO_TAG}</div><div class="st2">${o.sub || ''}</div></div>
      <button class="pv-page" id="pvPage" aria-label="Pick plan page"></button></div>
    <div class="pv-hint" id="pvHint"></div>
    <div class="pv-port" id="pvPort"><div class="pv-load" id="pvLoad">Loading plan…</div><svg class="pv-svg" id="pvSvg"></svg><div class="pv-layer" id="pvLayer"></div>
      <div class="pv-zoom"><button id="pvIn" aria-label="Zoom in">＋</button><button id="pvOut" aria-label="Zoom out">−</button><button id="pvFit" aria-label="Fit page">⤢</button></div></div>
    <div class="pv-bar${mark ? '' : ' two'}">${mark ? '<button class="btn" id="pvSkip">SKIP</button>' : ''}<button class="btn" id="pvUndo" disabled>UNDO</button><button class="btn primary" id="pvDone">${mark ? 'DONE ✔' : 'DONE'}</button></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s); const port = $('#pvPort'), layer = $('#pvLayer'), svg = $('#pvSvg');
  let finish;
  const done = new Promise((res) => (finish = res));
  const close = (action) => { if (!el.isConnected) return; remember(); freeCanvas(cv); el.remove(); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); finish({ action, pins: action === 'skip' ? null : work, last: { planId, page } }); };
  el.__close = close;
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.overlay')) close(mark ? 'skip' : 'done'); };
  document.addEventListener('keydown', onKey);
  $('#pvX').onclick = () => close(mark ? 'skip' : 'done');
  $('#pvDone').onclick = () => close('done');
  if (mark) $('#pvSkip').onclick = () => close('skip');
  $('#pvUndo').onclick = () => { if (!undo.length) return; work = JSON.parse(undo.pop()); drawPins(); };
  const snap = () => { undo.push(JSON.stringify(work)); };
  const plan = () => o.plans.find((p) => p.id === planId) || o.plans[0];
  const hint = () => {
    const hasCur = mark && work.some((p) => p.ref === o.shot.ref);
    $('#pvHint').textContent = mark ? (hasCur ? 'Pin dropped · tap again to move it, or drag it · DONE to save' : 'Tap the plan where this shot was taken · pinch to zoom') : 'Drag a pin to move it · tap a pin for details';
  };
  function remember() { if (memKey && cv) viewMem.set(memKey, { planId, page, z, tx, ty, vw, vh }); }
  // ---- geometry ----
  function measure() { const r = port.getBoundingClientRect(); vw = r.width; vh = r.height; const a = ptW / ptH; fitW = Math.min(vw - 16, (vh - 16) * a); fitH = fitW / a; }
  function fit() { z = 1; tx = (vw - fitW) / 2; ty = (vh - fitH) / 2; }
  function clampPan() { const w = fitW * z, h = fitH * z; const m = 80; tx = Math.min(vw - m, Math.max(m - w, tx)); ty = Math.min(vh - m, Math.max(m - h, ty)); }
  function zoomAt(nz, cx, cy) { nz = Math.max(1, Math.min(12, nz)); tx = cx - ((cx - tx) * nz) / z; ty = cy - ((cy - ty) * nz) / z; z = nz; clampPan(); apply(); }
  const toScreen = (p) => ({ x: tx + p.x * fitW * z, y: ty + p.y * fitH * z });
  const toNorm = (cx, cy) => ({ x: (cx - tx) / (fitW * z), y: (cy - ty) / (fitH * z) });
  function apply() { if (cv) cv.style.transform = `translate(${tx}px,${ty}px) scale(${z})`; drawPins(); }
  // ---- pins (DOM) ----
  function drawPins() {
    const all = o.resolve(work); const vis = all.filter((p) => p.planId === planId && (p.page || 1) === page);
    layer.innerHTML = vis.map((p) => `<button class="pin${mark && p.ref === o.shot.ref ? ' cur' : ''}" data-id="${p.id}" style="background:${p.color}" aria-label="Pin ${p.n} ${esc(p.point)}">${p.n}</button><div class="pinlbl" data-for="${p.id}" style="border-color:${p.color}">${p.lines.map((l) => `<div style="color:${l.color || '#111'}">${esc(l.t)}</div>`).join('')}</div>`).join('');
    const pts = vis.map(toScreen);
    const items = vis.map((p, i) => { const lb = layer.querySelector(`.pinlbl[data-for="${p.id}"]`); return { x: pts[i].x, y: pts[i].y, w: lb.offsetWidth, h: lb.offsetHeight, lb }; });
    const pl = placeLabels(items, { W: vw, H: vh, r: 17 });
    let lines = '';
    vis.forEach((p, i) => {
      const b = layer.querySelector(`.pin[data-id="${p.id}"]`); b.style.left = pts[i].x + 'px'; b.style.top = pts[i].y + 'px';
      const it = items[i]; it.lb.style.left = pl[i].lx + 'px'; it.lb.style.top = pl[i].ly + 'px';
      if (pl[i].leader) { const e = rectNear({ x: pl[i].lx, y: pl[i].ly, w: it.w, h: it.h }, it.x, it.y); lines += `<line x1="${it.x}" y1="${it.y}" x2="${e.x}" y2="${e.y}" stroke="${p.color}" stroke-width="2"/>`; }
      bindPin(b, p);
    });
    svg.innerHTML = lines;
    $('#pvUndo').disabled = !undo.length; hint();
    const cnt = all.length; if (!mark) $('#pvSubCount') && ($('#pvSubCount').textContent = `${cnt} pin${cnt === 1 ? '' : 's'}`);
  }
  function bindPin(b, p) {
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {}
      const sx = e.clientX, sy = e.clientY; let moved = false; const pr = port.getBoundingClientRect();
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!moved) { moved = true; snap(); b.classList.add('drag'); }
        const n = toNorm(ev.clientX - pr.left, ev.clientY - pr.top); const w = work.find((q) => q.id === p.id);
        w.x = clamp01(n.x); w.y = clamp01(n.y); drawPins();
      };
      const up = () => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
        if (moved) { drawPins(); toast(`Pin ${p.n} moved`); } else detail(p.id); };
      b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
  }
  function detail(id) {
    const p = o.resolve(work).find((q) => q.id === id); if (!p) return;
    const pl = o.plans.find((q) => q.id === p.planId);
    const s = sheet(`Pin ${p.n}`, `<div class="pindet"><span class="pinbig" style="background:${p.color}">${p.n}</span><div><div class="pd-pt">${esc(p.point)}</div><div class="pd-k">${esc(p.kindLabel)}</div></div></div>
      <table class="kv">${p.detail.map(([k, v, c]) => `<tr><td>${esc(k)}</td><td class="mono" ${c ? `style="color:${c};font-weight:800"` : ''}>${esc(v)}</td></tr>`).join('')}
      <tr><td>Plan</td><td>${esc(pl ? pl.name : '—')} · p${p.page || 1}</td></tr><tr><td>Position</td><td class="mono">x ${(p.x * 100).toFixed(1)}% · y ${(p.y * 100).toFixed(1)}%</td></tr></table>
      <p class="msg" style="color:var(--muted);font-weight:400">Drag the pin on the plan to move it.</p>
      <div class="row2"><button class="btn danger" id="pdDel">DELETE PIN</button><button class="btn" data-close>CLOSE</button></div>`);
    s.el.querySelector('#pdDel').onclick = () => { snap(); work = work.filter((q) => q.id !== id); s.close(); drawPins(); toast(`Pin ${p.n} deleted · UNDO to restore`); };
  }
  // ---- gestures on the port ----
  const ptrs = new Map(); let g = null;
  port.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pv-zoom') || !cv) return;
    try { port.setPointerCapture(e.pointerId); } catch (_) {} ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pr = port.getBoundingClientRect();
    if (ptrs.size === 1) g = { type: 'pan', sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty, moved: false, t0: Date.now(), pr };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; g = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: z, mx: (a.x + b.x) / 2 - pr.left, my: (a.y + b.y) / 2 - pr.top, tx0: tx, ty0: ty, pr, moved: true }; }
  });
  port.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !g) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const nz = Math.max(1, Math.min(12, (g.z0 * d) / g.d0));
      const mx = (a.x + b.x) / 2 - g.pr.left, my = (a.y + b.y) / 2 - g.pr.top;
      tx = mx - ((g.mx - g.tx0) * nz) / g.z0; ty = my - ((g.my - g.ty0) * nz) / g.z0; z = nz; clampPan(); apply();
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy; if (!g.moved && Math.hypot(dx, dy) < 8) return;
      g.moved = true; tx = g.tx0 + dx; ty = g.ty0 + dy; clampPan(); apply();
    }
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    if (g && g.type === 'pan' && !g.moved && e.type === 'pointerup' && Date.now() - g.t0 < 700) tap(e.clientX - g.pr.left, e.clientY - g.pr.top);
    if (ptrs.size === 0) g = null; else if (g && g.type === 'pinch') { const [a] = [...ptrs.values()]; g = { type: 'pan', sx: a.x, sy: a.y, tx0: tx, ty0: ty, moved: true, t0: 0, pr: g.pr }; }
  };
  port.addEventListener('pointerup', end); port.addEventListener('pointercancel', end);
  port.addEventListener('wheel', (e) => { e.preventDefault(); const pr = port.getBoundingClientRect(); zoomAt(z * Math.exp(-e.deltaY * 0.0025), e.clientX - pr.left, e.clientY - pr.top); }, { passive: false });
  // Safari fires gesture events alongside pointer events; stop its page zoom.
  ['gesturestart', 'gesturechange'].forEach((t) => port.addEventListener(t, (e) => e.preventDefault()));
  $('#pvIn').onclick = () => zoomAt(z * 1.6, vw / 2, vh / 2);
  $('#pvOut').onclick = () => zoomAt(z / 1.6, vw / 2, vh / 2);
  $('#pvFit').onclick = () => { fit(); apply(); };
  function tap(x, y) {
    if (!mark) return toast('Tap a pin to see it · drag to move');
    const n = toNorm(x, y); if (n.x < 0 || n.y < 0 || n.x > 1 || n.y > 1) return;
    snap(); const cur = work.find((p) => p.ref === o.shot.ref);
    if (cur) Object.assign(cur, { planId, page, x: round4(n.x), y: round4(n.y) });
    else work.push({ id: Math.random().toString(36).slice(2, 10), ref: o.shot.ref, kind: o.shot.kind, planId, page, x: round4(n.x), y: round4(n.y), t: Date.now() });
    navigator.vibrate?.(15); drawPins();
  }
  // ---- page picker ----
  const pageLabel = () => { const p = plan(); return o.plans.length > 1 && p ? `${shortName(p.name, 8)} p${page}/${pages}` : `p${page}/${pages}`; };
  $('#pvPage').onclick = () => {
    const counts = {}; o.resolve(work).forEach((p) => { const k = p.planId + ':' + (p.page || 1); counts[k] = (counts[k] || 0) + 1; });
    const pageBtn = (p, n) => { const k = p.id + ':' + n; const sel = p.id === planId && n === page; const c = counts[k] ? ` <span class="tag">${counts[k]} pin${counts[k] > 1 ? 's' : ''}</span>` : ''; return `<button class="listbtn${sel ? ' sel' : ''}" data-plan="${p.id}" data-pg="${n}">${sel ? '● ' : ''}Page ${n}${c}</button>`; };
    const rows = o.plans.map((p) => { const nums = Array.from({ length: p.pages || 1 }, (_, i) => i + 1); return `<div class="section-label">${esc(p.name)}</div>` + nums.map((n) => pageBtn(p, n)).join(''); }).join('');
    const tog = o.onToggleMark ? `<div class="switchrow"><div class="sw-l"><div class="sw-t">Mark shots on plan ${PRO_TAG}</div><div class="sw-d">Open this plan after every saved shot</div></div><button class="switch" id="pvMarkSw" role="switch" aria-checked="${!!o.markOn}" aria-label="Mark shots on plan"></button></div>` : '';
    const s = sheet('Plan sheet', `${tog}${rows}`);
    const sw = s.el.querySelector('#pvMarkSw'); if (sw) sw.onclick = () => { o.markOn = !o.markOn; sw.setAttribute('aria-checked', String(o.markOn)); o.onToggleMark(o.markOn); };
    s.el.querySelectorAll('[data-plan]').forEach((b) => (b.onclick = () => { s.close(); planId = b.dataset.plan; page = Number(b.dataset.pg); load(false); }));
  };
  // ---- load / render ----
  async function load(useMem) {
    const seq = ++loadSeq; $('#pvLoad').hidden = false; $('#pvLoad').textContent = 'Loading plan…';
    try {
      measure();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const pl = plan(); if (!pl) throw new Error('No plan sheet attached');
      planId = pl.id;
      const r = await renderPage(planId, page, { maxSide: Math.min(4096, Math.max(vw, vh) * dpr * 3), maxPixels: 10e6 });
      if (seq !== loadSeq || !el.isConnected) return freeCanvas(r.canvas);
      freeCanvas(cv); cv?.remove(); cv = r.canvas; ptW = r.ptW; ptH = r.ptH; pages = r.pages; page = Math.min(page, pages);
      cv.className = 'pv-canvas'; port.insertBefore(cv, svg);
      measure(); cv.style.width = fitW + 'px'; cv.style.height = fitH + 'px';
      const m = useMem && memKey && viewMem.get(memKey);
      if (m && m.planId === planId && m.page === page && Math.abs(m.vw - vw) < 2 && Math.abs(m.vh - vh) < 2) { z = m.z; tx = m.tx; ty = m.ty; } else fit();
      $('#pvLoad').hidden = true; $('#pvPage').textContent = pageLabel() + ' ▾'; apply();
    } catch (e) { console.warn(e); $('#pvLoad').textContent = e && e.missing ? e.message : 'Could not open the plan: ' + (e && e.message ? e.message : e); }
  }
  const onResize = () => { if (!cv) return; const ox = vw, oy = vh; measure(); cv.style.width = fitW + 'px'; cv.style.height = fitH + 'px'; if (Math.abs(ox - vw) > 1 || Math.abs(oy - vh) > 1) fit(); apply(); };
  window.addEventListener('resize', onResize);
  $('#pvPage').textContent = '…';
  hint(); requestAnimationFrame(() => load(true));
  return { done, close, el };
}
const clamp01 = (v) => round4(Math.max(0, Math.min(1, v)));
const round4 = (v) => Math.round(v * 10000) / 10000;
export const shortName = (n, k = 18) => (String(n).length > k ? String(n).slice(0, k - 1) + '…' : String(n));
