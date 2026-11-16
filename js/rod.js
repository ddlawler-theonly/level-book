// SVG Philadelphia-style rod. Values in US decimal feet; rod reading increases upward.
const RED = '#E00000', FOOT = '#D50000', YEL = '#FFC400', BLUE = '#0B5FA5';
const NS = 'http://www.w3.org/2000/svg';

export class RodView {
  constructor(svg) { this.svg = svg; this.cur = null; this.anim = null; this.opts = null; }
  set(opts) {
    this.opts = opts;
    const target = { c: opts.center, p: opts.ppf };
    if (!this.cur || opts.instant) { this.cur = target; return this.draw(); }
    const from = { ...this.cur }; const t0 = performance.now(); const dur = 150;
    cancelAnimationFrame(this.anim);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      this.cur = { c: from.c + (target.c - from.c) * e, p: from.p + (target.p - from.p) * e };
      this.draw();
      if (k < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }
  draw() {
    const o = this.opts; const svg = this.svg;
    const W = svg.clientWidth || svg.getBoundingClientRect().width || 150;
    const H = svg.clientHeight || svg.getBoundingClientRect().height || 380;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const { c, p } = this.cur; const L = o.rodLength || 16;
    const cy = H / 2; const y = (v) => cy - (v - c) * p;
    const tagW = 44; const x0 = 24; const x1 = Math.max(x0 + 50, W - tagW - 20); const fw = x1 - x0; const xc = x0 + fw / 2;
    const vMin = Math.max(0, c - cy / p - 0.1), vMax = Math.min(L, c + cy / p + 0.1);
    const parts = [];
    parts.push(`<defs><linearGradient id="edge" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#C9C9C3"/><stop offset=".07" stop-color="#F4F4F1"/><stop offset=".14" stop-color="#FFFFFF"/><stop offset=".86" stop-color="#FFFFFF"/><stop offset=".93" stop-color="#F1F1EE"/><stop offset="1" stop-color="#C2C2BC"/></linearGradient><filter id="sh" x="-20%" y="-5%" width="140%" height="110%"><feDropShadow dx="1.5" dy="0" stdDeviation="1.5" flood-opacity=".2"/></filter><clipPath id="faceclip"><rect x="${x0}" y="${y(L)}" width="${fw}" height="${y(0) - y(L)}"/></clipPath></defs>`);
    const top = Math.max(-10, y(L)), bot = Math.min(H + 10, y(0));
    let g = `<g class="face" opacity="${o.dim ? 0.4 : 1}"><rect x="${x0}" y="${top}" width="${fw}" height="${Math.max(0, bot - top)}" fill="url(#edge)" stroke="#A8A8A2" stroke-width="1" filter="url(#sh)"/><g clip-path="url(#faceclip)">`;
    // Graduations (matches the reference): separate black bars 0.01 ft tall, left-aligned on the LEFT half;
    // bottom of each bar = odd hundredth, top = even hundredth. The bar topped by each tenth is long with a slanted
    // point (its top-right tip marks the exact tenth); the bar starting at .x5 is medium with a point; the rest are short.
    const bh = p * 0.01; const bx = x0 + fw * 0.05;
    const font = `font-family="'Arial Narrow','Roboto Condensed','Helvetica Neue Condensed','Liberation Sans Narrow','Nimbus Sans Narrow','DejaVu Sans Condensed',Arial,sans-serif" font-stretch="condensed" font-weight="700"`;
    const capH = 0.72; const numX = x0 + fw * 0.58; const numAvail = fw * 0.30;
    const numH = 0.065 * p; const numF = numH / capH; const sxN = Math.min(1, numAvail / (numF * 0.5));
    const footH = 0.095 * p; const footF = footH / capH; const sxF = Math.min(1, (fw * 0.40) / (footF * 0.5));
    const smallF = Math.max(6, Math.min(13, (0.016 * p) / capH));
    const wireVals = (o.wires || []).map((w) => w.v).filter((v) => v != null && isFinite(v));
    const bar = (hb, len, tip) => {
      const yt = y((hb + 1) / 100);
      return tip ? `<path data-top="${hb + 1}" d="M${bx} ${yt} H${bx + len + tip} L${bx + len} ${yt + bh} H${bx} Z" fill="#000"/>` : `<rect data-top="${hb + 1}" x="${bx}" y="${yt}" width="${len}" height="${bh}" fill="#000"/>`;
    };
    const t0 = Math.floor(vMin * 10) - 2, t1 = Math.ceil(vMax * 10) + 2;
    for (let t = t0; t <= t1; t++) {
      if (t < 0 || t >= L * 10) continue;
      const base = t / 10;
      for (const k of [1, 3, 5, 7, 9]) {
        const hb = Math.round(t * 10 + k); if (hb + 1 > L * 100) continue;
        if (k === 9) g += bar(hb, fw * 0.40, Math.max(3, fw * 0.10));       // tenth (top = next tenth)
        else if (k === 5) g += bar(hb, fw * 0.30, Math.max(2, fw * 0.07));  // mid-tenth
        else g += bar(hb, fw * 0.26, 0);
      }
      const tenth = ((t % 10) + 10) % 10; const foot = Math.floor(t / 10);
      if (tenth === 0) {
        // whole foot: large red numeral; the foot line (top of the long tick) crosses its lower part
        g += `<text class="footnum" transform="translate(${x0 + fw * 0.52} ${y(base - 0.045)}) scale(${sxF} 1)" ${font} font-size="${footF}" fill="${FOOT}">${foot}</text>`;
      } else {
        // tenth numeral: the tenth line meets the upper part of the numeral, as on the reference rod
        g += `<text class="tenthnum" transform="translate(${numX} ${y(base - 0.045)}) scale(${sxN} 1)" ${font} font-size="${numF}" fill="#000">${tenth}</text>`;
      }
      // small red foot number: once per tenth (~.x4), far right edge, hidden near any wire/tag (±0.02 ft)
      const sv = base + 0.04;
      if (tenth !== 0 && tenth !== 9 && !wireVals.some((v) => Math.abs(v - sv) < 0.02 + 0.016))
        g += `<text class="footsmall" x="${x1 - 3}" y="${y(sv) + smallF * capH / 2}" text-anchor="end" ${font} font-size="${smallF}" fill="${FOOT}" fill-opacity=".85">${foot}</text>`;
    }
    g += `</g></g>`;
    parts.push(g);
    // highlight wash under active wire
    const act = (o.wires || []).find((w) => w.active && w.v != null && isFinite(w.v) && !w.impossible);
    if (act) { const b = Math.floor(act.v * 100 + 1e-6) / 100; parts.push(`<rect x="${x0}" y="${y(b + 0.01)}" width="${fw}" height="${Math.max(2, bh)}" fill="${YEL}" fill-opacity=".5"/>`); }
    // mean line
    if (o.mean != null && isFinite(o.mean)) parts.push(`<line x1="${x0}" x2="${x1}" y1="${y(o.mean)}" y2="${y(o.mean)}" stroke="${BLUE}" stroke-width="2" stroke-dasharray="2 3"/>`);
    // wires + tags
    const tags = [];
    (o.wires || []).forEach((w) => {
      if (w.v == null || !isFinite(w.v)) return;
      const wy = Math.max(20, Math.min(H - 20, y(w.v))); const dash = w.error ? ' stroke-dasharray="8 5"' : '';
      if (w.main) {
        parts.push(`<line x1="${x0 - 8}" x2="${x1 + 8}" y1="${wy}" y2="${wy}" stroke="#fff" stroke-width="5"${dash}/>`);
        parts.push(`<line class="crosshair${w.error ? ' err' : ''}" x1="${x0 - 8}" x2="${x1 + 8}" y1="${wy}" y2="${wy}" stroke="${RED}" stroke-width="3"${dash}/>`);
        parts.push(`<path d="M${x0 - 16} ${wy - 7} L${x0 - 5} ${wy} L${x0 - 16} ${wy + 7}Z" fill="${RED}" stroke="#fff" stroke-width="1"/>`);
        parts.push(`<path d="M${x1 + 16} ${wy - 7} L${x1 + 5} ${wy} L${x1 + 16} ${wy + 7}Z" fill="${RED}" stroke="#fff" stroke-width="1"/>`);
      } else {
        parts.push(`<line x1="${x0}" x2="${x1}" y1="${wy}" y2="${wy}" stroke="#fff" stroke-width="4"${dash}/>`);
        parts.push(`<line class="stadia${w.error ? ' err' : ''}" x1="${x0}" x2="${x1}" y1="${wy}" y2="${wy}" stroke="${RED}" stroke-width="2"${dash}/>`);
      }
      tags.push({ y: wy, w });
    });
    tags.sort((a, b) => a.y - b.y);
    for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < 38) tags[i].y = tags[i - 1].y + 38;
    tags.forEach(({ y: ty, w }) => {
      const tx = x1 + 18; const tw = Math.max(40, W - tx - 4);
      const fill = w.error ? '#fff' : w.active ? YEL : '#fff'; const stroke = w.error ? RED : w.active ? YEL : '#9A9A92';
      const color = w.error ? RED : '#111';
      const txt = (w.error ? '✕ ' : '') + w.label; const sub = w.error ? w.sub || '' : '';
      const fs = Math.min(w.main && !o.three ? 18 : 13, (tw - 6) / (Math.max(txt.length, sub.length) * 0.62));
      const h = sub ? 36 : 26;
      parts.push(`<g class="tag${w.error ? ' err' : ''}"><rect x="${tx}" y="${ty - h / 2}" width="${tw}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${w.error ? 2 : 1.5}"/><text x="${tx + tw / 2}" y="${sub ? ty - 2 : ty + fs * 0.36}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="800" font-size="${fs}" fill="${color}">${esc(txt)}</text>${sub ? `<text x="${tx + tw / 2}" y="${ty + 12}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="800" font-size="${Math.min(12, fs)}" fill="${color}">${esc(sub)}</text>` : ''}</g>`);
    });
    // mini full-length rod
    const mt = 10, mb = H - 10; const my = (v) => mb - (v / L) * (mb - mt);
    parts.push(`<rect x="3" y="${mt}" width="6" height="${mb - mt}" rx="3" fill="#fff" stroke="#9A9A92"/>`);
    for (let f = 0; f <= L; f++) parts.push(`<line x1="3" x2="${f % 5 === 0 ? 9 : 6}" y1="${my(f)}" y2="${my(f)}" stroke="${f % 5 === 0 ? FOOT : '#9A9A92'}" stroke-width="${f % 5 === 0 ? 0.8 : 0.5}"/>`);
    parts.push(`<rect x="2" y="${my(Math.min(L, vMax))}" width="8" height="${Math.max(2, my(vMin) - my(Math.min(L, vMax)))}" fill="${YEL}" fill-opacity=".45"/>`);
    const dv = Math.max(0, Math.min(L, c));
    parts.push(`<circle cx="6" cy="${my(dv)}" r="4.5" fill="${o.dim ? RED : YEL}" stroke="#111" stroke-width="1.5"/>`);
    svg.innerHTML = parts.join('');
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
