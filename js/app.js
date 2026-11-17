import * as C from './calc.js';
import { seedJobs, seedPegTests, seedStake, surveyDefaults, uid } from './seed.js';
import { RodView } from './rod.js';
import * as R from './report.js';

// ---------- native bridge (Capacitor iOS build injects window.LBNative; absent in the browser/PWA) ----------
const N = () => (window.LBNative && window.LBNative.isNative ? window.LBNative : null);

// ---------- storage ----------
const KEY = 'levelbook.v1';
let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !Array.isArray(db.jobs)) { db = { jobs: seedJobs(), prefs: { theme: localStorage.getItem('lb.theme') || 'sunlight', includes: {} }, seeded: Date.now() }; save(); }
  db.prefs = db.prefs || { theme: 'sunlight', includes: {} }; db.prefs.includes = db.prefs.includes || {};
  if (!Array.isArray(db.pegTests)) { db.pegTests = seedPegTests(); save(); } // v1.1.0: peg tests live at app level (all jobs)
  if (!(db.prefs.pegTol > 0)) db.prefs.pegTol = C.PEG_TOL_DEFAULT;
  if (typeof db.prefs.useDist !== 'boolean') db.prefs.useDist = true;
  // v1.2.0: add the sample Stake Out to the sample Pearland job once
  if (!db.prefs.stakeSeeded) { const sj = db.jobs.find((j) => j.client === 'SAMPLE DATA' && j.surveys.some((x) => x.sample)); if (sj && !sj.surveys.some((x) => x.type === 'stake')) sj.surveys.push(seedStake()); db.prefs.stakeSeeded = true; save(); }
}
function save() { try { const json = JSON.stringify(db); localStorage.setItem(KEY, json); localStorage.setItem('lb.theme', db.prefs.theme); N()?.backup(json); } catch (e) { toast('Could not save – storage full?'); } }
const touch = (job, s) => { const t = Date.now(); job.updated = t; if (s) s.updated = t; save(); };
const getJob = (id) => db.jobs.find((j) => j.id === id);
const getSurvey = (job, sid) => job && job.surveys.find((s) => s.id === sid);

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = () => document.getElementById('app');
const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const TYPE = { loop: 'Level Loop', run: 'Level Run', site: 'Site Levels', stake: 'Stake Out' };
const SHORT = { loop: 'Loop', run: 'Run', site: 'Site levels', stake: 'Stake' };
const sgn = (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(3));

const I = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="7"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  loop: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M30 13a12 12 0 1 0 2 10"/><path d="M31 5v8h-8"/></svg>',
  run: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="20" r="3"/><path d="M10 20h24M27 13l7 7-7 7"/></svg>',
  site: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="20" cy="20" r="12"/><path d="M20 4v8M20 28v8M4 20h8M28 20h8"/><circle cx="20" cy="20" r="2" fill="currentColor"/></svg>',
  ok: '<svg viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 25l9 9 19-20"/></svg>',
  x: '<svg viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M13 13l22 22M35 13L13 35"/></svg>',
  stake: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 34h32"/><path d="M20 36V10"/><path d="M20 10l10 4-10 4"/><path d="M8 26h24" stroke-dasharray="3 3"/></svg>',
  peg: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 34h34"/><path d="M8 34V14M32 34V10"/><path d="M6 14h4M6 19h4M6 24h4M30 10h4M30 15h4M30 20h4"/><path d="M14 22l4-6 4 6M18 16v-3"/><path d="M13 13h21" stroke-dasharray="2 3"/></svg>',
  level: '<svg viewBox="0 0 96 96" width="96" height="96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="62" y="10" width="14" height="76" rx="2"/><path d="M62 22h7M62 34h7M62 46h7M62 58h7M62 70h7"/><path d="M16 40h30l-4 10H20z"/><path d="M31 50v12M22 86l9-24 9 24"/><path d="M46 44h12" stroke-dasharray="3 4"/></svg>',
};
const topbar = ({ back, title, right = '', wordmark }) => `<header class="topbar">${back ? `<button class="back" data-back="${esc(back.href)}">‹ ${esc(back.label)}</button>` : ''}${wordmark ? `<span class="wordmark">LEVEL BOOK</span><span class="trialtag" title="Field trial build">TRIAL</span><span class="vertag">v${R.APP_VERSION}</span><span class="spacer"></span>` : `<span class="title">${esc(title || '')}</span>`}${right}</header>`;
const sysIcons = () => `<button class="iconbtn" data-act="feedback" aria-label="Send feedback">${I.chat}</button><button class="iconbtn" data-act="theme" aria-label="Toggle Sunlight/Dusk theme">${I.theme}</button><button class="iconbtn" data-act="settings" aria-label="Settings">${I.gear}</button>`;
function bindCommon(root) {
  $$('[data-back]', root).forEach((b) => (b.onclick = () => go(b.dataset.back)));
  $$('[data-act="theme"]', root).forEach((b) => (b.onclick = toggleTheme));
  $$('[data-act="settings"]', root).forEach((b) => (b.onclick = openSettings));
  $$('[data-act="feedback"]', root).forEach((b) => (b.onclick = () => openFeedback()));
}

// ---------- field trial: welcome + feedback ----------
const FEEDBACK_TO = 'ddlawler@hotmail.com';
function welcomeCard() {
  const o = overlay(`<div class="dialog welcome" role="dialog" aria-label="Welcome to the Level Book field trial">
    <div class="wl-h"><span class="trialtag">TRIAL</span><h2>Welcome to Level Book</h2></div>
    <p>Thanks for field-testing <b>Level Book v${R.APP_VERSION}</b> – a digital level book for loops, runs, site levels, stake out and peg tests.</p>
    <ul class="wl">
      <li><b>Your data stays on your phone.</b> Nothing is uploaded; there is no account.</li>
      <li><b>Send feedback</b> any time with the ${I.chat.replace('<svg', '<svg width="18" height="18" style="vertical-align:-4px"')} button at the top, or in Settings.</li>
      <li><b>Back up</b> with Settings → Export backup, especially before deleting the app.</li>
      <li>A <b>sample job</b> (Pearland) is loaded so you can look around.</li>
    </ul>
    <button class="btn primary block" id="wlGo">GET STARTED</button></div>`, { dialog: true, onClose: () => { db.prefs.welcomed = true; save(); } });
  $('#wlGo', o.el).onclick = () => o.close();
  return o;
}
function screenName() {
  const h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!h.length) return 'Jobs';
  if (h[0] !== 'j') return h.join('/');
  if (!h[2]) return 'Main menu';
  if (h[2] === 'peg') return 'Peg test' + (h[3] ? ' · ' + (h[3] === 'new' ? 'setup' : h[3] === 'entry' ? 'entry' : 'result') : 's');
  if (h[2] === 's') { const v = (h[4] || 'book').split('?')[0]; return ({ entry: 'Entry', book: 'Book', close: 'Closure', share: 'Share' })[v] || v; }
  return h[2];
}
function feedbackContext() {
  const h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const job = h[0] === 'j' ? getJob(h[1]) : null; let s = null;
  if (job && h[2] === 's') s = getSurvey(job, h[3]);
  else if (job) s = [...job.surveys].sort((a, b) => b.updated - a.updated)[0] || null;
  return { job, s };
}
function feedbackText(f, ctx) {
  const lines = [
    `Level Book feedback v${R.APP_VERSION}`, `To: ${FEEDBACK_TO}`, '',
    `Rating: ${f.rating ? '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating) + ` (${f.rating}/5)` : 'not given'}`,
    `Category: ${f.cat}`, '', 'Notes:', f.notes.trim() || '(none)', '',
    '— device info —',
    `App version: ${R.APP_VERSION}${isStandalone() ? ' (installed)' : ' (browser)'}`,
    `Device/UA: ${navigator.userAgent}`,
    `Screen: ${screen.width}×${screen.height} @${window.devicePixelRatio || 1}x · viewport ${innerWidth}×${innerHeight}`,
    `Theme: ${db.prefs.theme === 'dusk' ? 'Dusk' : 'Sunlight'}`,
    `Current screen: ${screenName()}${ctx.job ? ' · ' + ctx.job.name : ''}${ctx.s ? ' · ' + ctx.s.name : ''}`,
  ];
  if (f.attach && ctx.s) lines.push(`Attached report: ${R.fileBase(ctx.job, ctx.s)}.pdf`);
  return lines.join('\n');
}
function feedbackMailto(f, ctx, note) {
  const body = feedbackText(f, ctx).split('\n').filter((l) => !l.startsWith('To: ')).join('\n') + (note ? '\n\n' + note : '');
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent('Level Book feedback v' + R.APP_VERSION)}&body=${encodeURIComponent(body)}`;
}
function openFeedback() {
  const ctx = feedbackContext(); const f = { rating: 0, cat: 'bug', notes: '', attach: false };
  const cats = [['bug', 'Bug'], ['idea', 'Idea'], ['looks', 'Looks'], ['math', 'Math']];
  const s = sheet('Send feedback', `
    <div class="section-label">How is it working?</div>
    <div class="stars" id="fbRate" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button data-v="${n}" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
    <div class="section-label">Category</div>
    <div class="seg" id="fbCat">${cats.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === f.cat}">${l}</button>`).join('')}</div>
    <div class="section-label">Notes</div>
    <textarea class="input" id="fbNotes" rows="4" placeholder="What happened, what you expected, or what would help in the field…"></textarea>
    ${ctx.s ? `<label class="checkrow"><input type="checkbox" id="fbAttach"><span>Attach current survey report (PDF)<br><small class="mono">${esc(ctx.s.name)}</small></span></label>` : ''}
    <div class="msg" style="font-weight:400;color:var(--muted);margin:8px 0">Goes to ${FEEDBACK_TO}. App version, device, screen size, theme and current screen are added so we can reproduce it.</div>
    <button class="btn primary block" id="fbSend">SEND FEEDBACK ▶</button>`, { tall: true });
  $$('#fbRate button', s.el).forEach((b) => (b.onclick = () => { f.rating = +b.dataset.v; $$('#fbRate button', s.el).forEach((x) => { x.classList.toggle('on', +x.dataset.v <= f.rating); x.setAttribute('aria-checked', +x.dataset.v === f.rating); }); }));
  $$('#fbCat button', s.el).forEach((b) => (b.onclick = () => { f.cat = b.dataset.v; $$('#fbCat button', s.el).forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  $('#fbNotes', s.el).oninput = (e) => (f.notes = e.target.value);
  if ($('#fbAttach', s.el)) $('#fbAttach', s.el).onchange = (e) => (f.attach = e.target.checked);
  // Build everything synchronously inside the tap so iOS keeps the user gesture for navigator.share.
  $('#fbSend', s.el).onclick = () => {
    const title = 'Level Book feedback v' + R.APP_VERSION; const text = feedbackText(f, ctx);
    let file = null;
    if (f.attach && ctx.s) { try { file = new File([R.pdfReport(ctx.job, [ctx.s], includesFor(ctx.job)).output('blob')], R.fileBase(ctx.job, ctx.s) + '.pdf', { type: 'application/pdf' }); } catch (e) { console.warn(e); } }
    const mail = (note) => { const url = feedbackMailto(f, ctx, note); if (window.__lbMailHook) return window.__lbMailHook(url); location.href = url; };
    const done = () => { s.close(); toast('Thanks – feedback ready to send'); };
    if (N()) { const p = file ? N().shareFile({ blob: file, name: file.name, title, text }) : N().shareText({ title, text }); p.then((r) => r !== 'cancelled' && done()).catch(() => mail()); return; }
    let data = null;
    if (navigator.share) { data = { title, text }; if (file) { if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file]; else data = null; } }
    if (data) navigator.share(data).then(done).catch((err) => { if (err && err.name === 'AbortError') return; mail(file ? 'Report could not be attached here – use Share in the book to send it.' : ''); });
    else { mail(file ? 'Report not attached (this browser cannot share files) – use Share in the book to send it.' : ''); s.close(); }
  };
  return s;
}

// ---------- theme ----------
function applyTheme() {
  const dusk = db.prefs.theme === 'dusk';
  document.documentElement.dataset.theme = dusk ? 'dusk' : 'sunlight';
  $('meta[name="theme-color"]')?.setAttribute('content', dusk ? '#121417' : '#FFFFFF');
  $('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', dusk ? 'black-translucent' : 'default');
  syncStatusBar();
}
// Native status bar: light text on dark surfaces (Dusk, or the dark entry status strip).
const syncStatusBar = () => N()?.setStatusBarDark(db.prefs.theme === 'dusk' || /\/entry/.test(location.hash));
function toggleTheme() { db.prefs.theme = db.prefs.theme === 'dusk' ? 'sunlight' : 'dusk'; save(); applyTheme(); if (rodView) rodView.draw(); }

// ---------- overlays ----------
function overlay(html, { dialog = false, onClose } = {}) {
  const o = document.createElement('div'); o.className = 'overlay' + (dialog ? ' dialog-wrap' : ''); o.innerHTML = html;
  const close = () => { o.remove(); onClose && onClose(); };
  o.addEventListener('click', (e) => { if (e.target === o) close(); });
  document.body.appendChild(o); $$('[data-close]', o).forEach((b) => (b.onclick = close));
  return { el: o, close };
}
function sheet(title, body, { tall } = {}) {
  return overlay(`<div class="sheet${tall ? ' tall' : ''}" role="dialog" aria-label="${esc(title)}"><div class="handle"></div><div class="sh"><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div><div class="sbody">${body}</div></div>`);
}
function choose(title, options, current, onPick) {
  const s = sheet(title, options.map((o) => `<button class="listbtn${o.v === current ? ' sel' : ''}" data-v="${esc(o.v)}">${o.v === current ? '● ' : ''}${esc(o.label)}</button>`).join(''));
  $$('.listbtn', s.el).forEach((b) => (b.onclick = () => { s.close(); onPick(b.dataset.v); }));
}
function confirmDialog({ title, text, ok = 'OK', danger, delayMs = 0, cancel = 'Cancel' }) {
  return new Promise((res) => {
    const d = overlay(`<div class="dialog" role="alertdialog"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row2"><button class="btn" data-c>${esc(cancel)}</button><button class="btn ${danger ? 'solid-danger' : 'primary'}" data-ok ${delayMs ? 'disabled' : ''}>${esc(ok)}</button></div></div>`, { dialog: true, onClose: () => res(false) });
    const okb = $('[data-ok]', d.el);
    if (delayMs) setTimeout(() => (okb.disabled = false), delayMs);
    $('[data-c]', d.el).onclick = () => { d.el.remove(); res(false); };
    okb.onclick = () => { d.el.remove(); res(true); };
  });
}
let snackTimer;
function snackbar(text, actionLabel, onAction, ms = 6000) {
  $('.snackbar')?.remove(); clearTimeout(snackTimer);
  const s = document.createElement('div'); s.className = 'snackbar'; s.setAttribute('role', 'status');
  s.innerHTML = `<span>${esc(text)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  const pin = $('.pinned') || $('.keypad'); s.style.bottom = `${(pin ? pin.offsetHeight : 0) + 12}px`;
  document.body.appendChild(s);
  if (actionLabel) $('button', s).onclick = () => { s.remove(); onAction(); };
  snackTimer = setTimeout(() => s.remove(), ms);
}
const toast = (t) => snackbar(t, null, null, 2500);

// ---------- job status ----------
function jobStatus(job) {
  const st = job.surveys.map(C.surveyStatus);
  if (!st.length) return 'open';
  if (st.includes('check')) return 'check';
  if (st.includes('open')) return 'open';
  return 'closed';
}
const chip = (st) => st === 'closed' ? '<span class="chip closed">✔ closed</span>' : st === 'check' ? '<span class="chip check">⚠ check</span>' : '<span class="chip open">○ open</span>';
const stColor = (st) => (st === 'closed' ? 'var(--pass)' : st === 'check' ? 'var(--warn)' : 'var(--muted)');
function jobSummary(job) {
  const n = { loop: 0, run: 0, site: 0, stake: 0 }; job.surveys.forEach((s) => n[s.type]++);
  const parts = []; if (n.loop) parts.push(`${n.loop} loop${n.loop > 1 ? 's' : ''}`); if (n.run) parts.push(`${n.run} run${n.run > 1 ? 's' : ''}`);
  if (n.site) { const pts = job.surveys.filter((s) => s.type === 'site').reduce((a, s) => a + s.readings.filter((r) => r.type !== 'BS').length, 0); parts.push(`Site levels · ${pts} pts`); }
  if (n.stake) parts.push(`${n.stake} stake out${n.stake > 1 ? 's' : ''}`);
  return parts.join(' · ') || 'No surveys yet';
}
const openSurveyOf = (job) => [...job.surveys].sort((a, b) => b.updated - a.updated).find((s) => !s.closed);

// ---------- router ----------
let rodView = null; let entry = null;
window.addEventListener('hashchange', () => { $('.snackbar')?.remove(); render(); });
function render() {
  rodView = null; if (db) syncStatusBar();
  $$('.overlay').forEach((o) => o.remove());
  const h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (!h.length) return jobsScreen();
    if (h[0] === 'j') {
      const job = getJob(h[1]); if (!job) return go('#/');
      if (h.length === 2) return menuScreen(job);
      if (h[2] === 'new') return setupScreen(job, h[3]);
      if (h[2] === 'share') return shareScreen(job, null);
      if (h[2] === 'peg') {
        if (!h[3]) return pegListScreen(job);
        if (h[3] === 'new') return pegSetupScreen(job);
        if (h[3] === 'entry') return pegEntryScreen(job);
        const t = db.pegTests.find((x) => x.id === h[3]); if (t) return pegResultScreen(job, t);
        return go(`#/j/${job.id}/peg`);
      }
      if (h[2] === 's') {
        const s = getSurvey(job, h[3]); if (!s) return go(`#/j/${job.id}`);
        const [view, q] = (h[4] || 'book').split('?');
        if (s.type === 'stake') return view === 'entry' ? stakeScreen(job, s) : view === 'share' ? shareScreen(job, s) : stakeSheetScreen(job, s);
        if (view === 'entry') return entryScreen(job, s, new URLSearchParams(q || ''));
        if (view === 'book') return bookScreen(job, s);
        if (view === 'close') return closureScreen(job, s);
        if (view === 'share') return shareScreen(job, s);
      }
    }
    go('#/');
  } catch (err) { console.error(err); app().innerHTML = `<div class="scroll"><h2>Something went wrong</h2><pre>${esc(err.stack)}</pre><button class="btn" onclick="location.hash='#/'">Back to jobs</button></div>`; }
}

// ---------- 0. Jobs ----------
const jobsUI = { tab: 'active', q: '', sort: 'date' };
function jobsScreen() {
  const root = app();
  root.innerHTML = `<div class="screen">${topbar({ wordmark: true, right: sysIcons() })}
    <div class="scroll" id="jobsScroll">
      <input class="input" id="q" type="search" placeholder="🔍  Search jobs" value="${esc(jobsUI.q)}" aria-label="Search jobs" autocomplete="off">
      <div class="searchrow"><div class="seg" id="tabs"><button data-v="active" aria-pressed="${jobsUI.tab === 'active'}">Active</button><button data-v="archived" aria-pressed="${jobsUI.tab === 'archived'}">Archived</button></div>
      <button class="btn" id="sortBtn">Sort: ${{ date: 'Date', name: 'Name', edited: 'Edited' }[jobsUI.sort]} ▾</button></div>
      <div class="jobs-list" id="list"></div>
    </div>
    <div class="pinned"><button class="btn primary block" id="newJob">＋&nbsp; NEW JOB</button></div></div>`;
  bindCommon(root);
  $('#q').oninput = (e) => { jobsUI.q = e.target.value; drawList(); };
  $$('#tabs button').forEach((b) => (b.onclick = () => { jobsUI.tab = b.dataset.v; jobsScreen(); }));
  $('#sortBtn').onclick = () => choose('Sort jobs', [{ v: 'date', label: 'Project date' }, { v: 'name', label: 'Name' }, { v: 'edited', label: 'Last edited' }], jobsUI.sort, (v) => { jobsUI.sort = v; jobsScreen(); });
  $('#newJob').onclick = () => jobSheet();
  drawList();
  if (!db.prefs.welcomed) welcomeCard();
}
function drawList() {
  const list = $('#list'); const q = jobsUI.q.trim().toLowerCase();
  let jobs = db.jobs.filter((j) => (jobsUI.tab === 'archived') === !!j.archived).filter((j) => !q || (j.name + ' ' + j.description).toLowerCase().includes(q));
  jobs.sort((a, b) => jobsUI.sort === 'name' ? a.name.localeCompare(b.name) : jobsUI.sort === 'edited' ? b.updated - a.updated : (b.date || '').localeCompare(a.date || ''));
  if (!jobs.length) {
    list.innerHTML = `<div class="empty">${I.level}<h2>${q ? 'No matching jobs' : jobsUI.tab === 'archived' ? 'No archived jobs' : 'No jobs yet'}</h2><p>${jobsUI.tab === 'archived' ? 'Archived jobs show up here, read-only.' : 'Tap New Job to start your first level book.'}</p></div>`;
    return;
  }
  list.innerHTML = jobs.map((j) => {
    const st = jobStatus(j); const open = !j.archived && openSurveyOf(j);
    return `<div class="swipe" data-id="${j.id}"><div class="actions">${j.archived ? `<button class="arch" data-a="restore">Restore</button>` : `<button class="arch" data-a="archive">Archive</button>`}<button class="del" data-a="delete">Delete</button></div>
      <div class="jobcard" style="--st:${stColor(st)}" role="button" tabindex="0" aria-label="Open job ${esc(j.name)}">
        <div class="l1"><span class="name">${esc(j.name)}</span><span class="date">${esc(R.usDate(j.date))}</span></div>
        <div class="desc">${esc(j.description || '—')}</div>
        <div class="l3"><span>${esc(jobSummary(j))}</span>${chip(st)}${j.archived ? '<span class="tag">ARCHIVED</span>' : ''}${open ? `<button class="resume" data-resume="${open.id}">Resume</button>` : ''}</div>
        <span class="chev">›</span></div></div>`;
  }).join('');
  $$('.swipe', list).forEach(bindSwipe);
}
function bindSwipe(wrap) {
  const card = $('.jobcard', wrap); const id = wrap.dataset.id; const job = getJob(id);
  let sx = 0, sy = 0, dx = 0, drag = false, moved = false, lp = null, active = false, longFired = false, openX = 0;
  const setX = (x) => (card.style.transform = x ? `translateX(${x}px)` : '');
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.resume')) return;
    if (e.pointerType === 'touch' && e.clientX < 20) return; // leave iOS edge back-swipe alone
    active = true; sx = e.clientX; sy = e.clientY; dx = 0; drag = false; moved = false; longFired = false;
    openX = wrap.classList.contains('open') ? -160 : 0;
    lp = setTimeout(() => { if (!moved) { longFired = true; active = false; navigator.vibrate?.(20); jobActions(job); } }, 550);
  });
  card.addEventListener('pointermove', (e) => {
    if (!active) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) { moved = true; clearTimeout(lp); }
    if (!drag && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) { drag = true; card.classList.add('dragging'); try { card.setPointerCapture(e.pointerId); } catch (_) {} }
    if (drag) { dx = Math.max(-170, Math.min(0, openX + mx)); setX(dx); e.preventDefault(); }
  });
  const end = () => {
    clearTimeout(lp); if (!active) return; active = false; card.classList.remove('dragging');
    if (drag) { if (dx < -60) { wrap.classList.add('open'); setX(-160); } else { wrap.classList.remove('open'); setX(0); } }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  card.addEventListener('click', (e) => {
    const rb = e.target.closest('.resume');
    if (rb) { e.stopPropagation(); entry = null; go(`#/j/${id}/s/${rb.dataset.resume}/entry`); return; }
    if (drag || moved || longFired) { drag = false; moved = false; longFired = false; return; }
    if (wrap.classList.contains('open')) { wrap.classList.remove('open'); setX(0); return; }
    go(`#/j/${id}`);
  });
  $$('.actions button', wrap).forEach((b) => (b.onclick = () => doJobAction(job, b.dataset.a)));
}
function jobActions(job) {
  const s = sheet(job.name, `<button class="listbtn" data-a="open">Open job</button><button class="listbtn" data-a="share">Share job (combined report)</button><button class="listbtn" data-a="edit">Edit job details</button>${job.archived ? '<button class="listbtn" data-a="restore">Restore</button>' : '<button class="listbtn" data-a="archive">Archive</button>'}<button class="listbtn red" data-a="delete">Delete…</button>`);
  $$('.listbtn', s.el).forEach((b) => (b.onclick = () => { s.close(); doJobAction(job, b.dataset.a); }));
}
async function doJobAction(job, a) {
  if (a === 'open') return go(`#/j/${job.id}`);
  if (a === 'share') return go(`#/j/${job.id}/share`);
  if (a === 'edit') return jobSheet(job);
  if (a === 'archive') { job.archived = true; touch(job); render(); snackbar('Job archived', 'UNDO', () => { job.archived = false; touch(job); render(); }); return; }
  if (a === 'restore') { job.archived = false; touch(job); render(); toast('Job restored'); return; }
  if (a === 'delete') {
    const n = job.surveys.length; const closed = job.surveys.some((s) => s.closed);
    const ok = await confirmDialog({ title: 'Delete job?', text: `Delete ${job.name} and all ${n} survey${n === 1 ? '' : 's'}? This can't be undone.${closed && !job.archived ? ' Tip: this job has closed surveys – consider Archive instead.' : ''}`, ok: 'Delete', danger: true, delayMs: 2000 });
    if (ok) { db.jobs = db.jobs.filter((j) => j !== job); save(); go('#/'); toast('Job deleted'); } else render();
  }
}
function jobSheet(job) {
  const edit = !!job; const j = job || { name: '', date: todayISO(), description: '', client: '' };
  const s = sheet(edit ? 'EDIT JOB' : 'NEW JOB', `
    <label class="field"><span>Job name</span><input class="input" id="jn" value="${esc(j.name)}" autocomplete="off" maxlength="80" enterkeyhint="next"></label>
    <label class="field"><span>Project date</span><input class="input mono" id="jd" type="date" value="${esc(j.date)}"></label>
    <label class="field"><span>Description</span><textarea class="input" id="jdesc" maxlength="200" rows="3">${esc(j.description)}</textarea><div class="counter"><span id="jc">${(j.description || '').length}</span>/200</div></label>
    <label class="field"><span>Client / job # (optional)</span><input class="input" id="jcl" value="${esc(j.client || '')}" autocomplete="off"></label>
    <div class="row2" style="margin-top:8px"><button class="btn" data-close>CANCEL</button><button class="btn primary" id="jok" disabled>${edit ? 'SAVE' : 'CREATE JOB ▶'}</button></div>`, { tall: true });
  const nm = $('#jn', s.el), ok = $('#jok', s.el), ds = $('#jdesc', s.el);
  const upd = () => (ok.disabled = !nm.value.trim()); upd(); nm.oninput = upd;
  ds.oninput = () => ($('#jc', s.el).textContent = ds.value.length);
  setTimeout(() => nm.focus(), 250);
  ok.onclick = () => {
    const data = { name: nm.value.trim(), date: $('#jd', s.el).value || todayISO(), description: ds.value.trim(), client: $('#jcl', s.el).value.trim() };
    if (edit) { Object.assign(job, data); touch(job); s.close(); render(); return; }
    const nj = { id: uid(), ...data, archived: false, created: Date.now(), updated: Date.now(), surveys: [] };
    db.jobs.push(nj); save(); s.close(); go(`#/j/${nj.id}`);
  };
}

// ---------- 1. Main menu ----------
function menuScreen(job) {
  const ro = job.archived; const root = app();
  const surveys = [...job.surveys].sort((a, b) => b.updated - a.updated);
  root.innerHTML = `<div class="screen">${topbar({ back: { href: '#/', label: 'Jobs' }, title: job.name, right: sysIcons() })}
    <div class="scroll">
      ${ro ? `<div class="banner"><span><b>Archived</b> · read-only</span><button class="btn blue" id="restore">RESTORE</button></div>` : ''}
      <div class="section-label">${esc(R.usDate(job.date))} · ${esc(job.description || '')}</div>
      ${[['loop', 'Level Loop', 'Start and close on the same benchmark'], ['run', 'Level Run', 'Carry elevation from one BM to another'], ['site', 'Site Levels', 'One setup, many side shots'], ['stake', 'Stake Out', 'Backsight a BM, set grade stakes – cut/fill'], ['peg', 'Peg Test', pegMenuLine()]].map(([t, n, d]) => `<button class="modecard" data-mode="${t}" ${ro && t !== 'peg' ? 'disabled' : ''}>${I[t]}<div><div class="mt">${n}</div><div class="md">${d}</div></div></button>`).join('')}
      <div class="section-label">Recent</div>
      ${surveys.length ? `<div class="recent">${surveys.map((s) => `<button data-sid="${s.id}"><span class="rn">${esc(s.name)}</span><span class="tag">${SHORT[s.type].toUpperCase()}</span>${s.method === 'three' && s.type !== 'site' ? '<span class="tag blue">3-WIRE</span>' : ''}${statusChip(s)}</button>`).join('')}</div>` : '<div class="empty" style="padding:24px">No surveys in this job yet. Pick a mode above.</div>'}
    </div>
    <div class="pinned"><div class="row2"><button class="btn" id="shareJob">${I.share.replace('<svg', '<svg width="20" height="20"')} SHARE JOB</button><button class="btn" id="editJob">EDIT JOB</button></div></div></div>`;
  bindCommon(root);
  $('#restore') && ($('#restore').onclick = () => { job.archived = false; touch(job); render(); });
  $$('.modecard').forEach((b) => (b.onclick = () => { b.classList.add('flash'); setTimeout(() => go(b.dataset.mode === 'peg' ? `#/j/${job.id}/peg` : `#/j/${job.id}/new/${b.dataset.mode}`), 120); }));
  $$('.recent button').forEach((b) => (b.onclick = () => go(`#/j/${job.id}/s/${b.dataset.sid}/book`)));
  $('#shareJob').onclick = () => go(`#/j/${job.id}/share`);
  $('#editJob').onclick = () => (ro ? toast('Archived jobs are read-only') : jobSheet(job));
}
function statusChip(s) {
  const st = C.surveyStatus(s);
  if (st === 'closed') { const cl = s.type === 'site' || s.type === 'stake' ? null : C.closure(s); return `<span class="chip closed">✔ ${cl ? Math.abs(cl.misclosure).toFixed(3) : 'done'}</span>`; }
  if (st === 'check') return `<span class="chip check">⚠ ${Math.abs(C.closure(s).misclosure).toFixed(3)}</span>`;
  return '<span class="chip open">OPEN</span>';
}

// ---------- 2. Setup ----------
const INSTRUMENTS = ['Automatic level', 'Digital level', 'Dumpy level', 'Tilting level', 'Laser level', 'Other'];
function setupScreen(job, type) {
  if (job.archived || !TYPE[type]) return go(`#/j/${job.id}`);
  const s = surveyDefaults(type);
  const count = job.surveys.filter((x) => x.type === type).length + 1;
  const root = app();
  const sec = (label, body) => `<div><div class="section-label">${label}</div><div class="card">${body}</div></div>`;
  const elevInput = (id) => `<div class="suffix" data-suffix="ft"><input class="input num" id="${id}" inputmode="decimal" autocomplete="off" placeholder="0.000"></div>`;
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}`, label: 'Back' }, title: `New ${TYPE[type]}`, right: sysIcons() })}
    <div class="scroll">
      ${sec('Job', `<div class="field"><span>Job</span><div class="input" style="display:flex;align-items:center;justify-content:space-between;background:var(--alt)"><b>${esc(job.name)}</b><span class="mono">${esc(R.usDate(job.date))}</span></div></div>
        <label class="field"><span>Survey name</span><input class="input" id="sn" placeholder="e.g. ${SHORT[type]} ${count}" autocomplete="off"></label>
        <label class="field"><span>Observer</span><input class="input" id="obs" autocomplete="off"></label>
        <label class="field"><span>Rod person</span><input class="input" id="rodp" autocomplete="off"></label>
        <div class="field"><span>Instrument</span><button class="selectbtn" id="inst"><span id="instv">Automatic level</span><span>▾</span></button></div>
        <div class="field"><span>Units</span><span class="chip locked">🔒 US decimal ft</span></div>`)}
      ${type === 'site' || type === 'stake' ? '' : sec('Reading method', `<div class="seg" id="method"><button data-v="single" aria-pressed="true">Single wire</button><button data-v="three" aria-pressed="false">Three-wire</button></div>
        <div id="threeOpts" hidden style="margin-top:16px"><label class="field"><span>Stadia constant K</span><input class="input num" id="sk" inputmode="decimal" value="100"></label>
        <label class="field"><span>Wire spread tolerance</span><div class="suffix" data-suffix="ft"><input class="input num" id="stol" inputmode="decimal" value="0.003"></div></label></div>`)}
      ${sec('Starting benchmark', `<label class="field"><span>BM name</span><input class="input" id="bmn" value="BM-1" autocomplete="off"></label><label class="field"><span>Elevation</span>${elevInput('bme')}</label>`)}
      ${type === 'run' ? sec('Closing benchmark', `<label class="field"><span>BM name</span><input class="input" id="cbn" placeholder="e.g. BM-7" autocomplete="off"></label><label class="field"><span>Known elevation</span>${elevInput('cbe')}</label>`) : ''}
      ${type === 'loop' ? sec('Closing benchmark', `<div class="msg" style="color:var(--muted)">A loop closes back on the starting benchmark.</div>`) : ''}
      ${sec('Distances', distRow(db.prefs.useDist, { id: 'setupDist', note: 'Default for this survey; you can switch it on the entry screen. OFF: no DIST field, no peg correction, no balance/sight checks, closure by setups.' }))}
      ${type === 'site' ? '' : sec('Peg correction', pegSetupBlock())}
      ${sec('Checks', `${type === 'site' || type === 'stake' ? '' : `<div class="field"><span>Closure standard</span><button class="selectbtn" id="std"><span id="stdv">${C.STANDARDS[0].label} · 0.050 ft√mi</span><span>▾</span></button></div><label class="field" id="customRow" hidden><span>Custom constant (ft√mi)</span><input class="input num" id="ck" inputmode="decimal" value="0.05"></label>`}
        <div class="field"><span>Rod length</span><button class="selectbtn" id="rodl"><span id="rodlv">16 ft</span><span>▾</span></button></div>
        <label class="field"><span>BS/FS imbalance limit</span><div class="suffix" data-suffix="ft"><input class="input num" id="imb" inputmode="decimal" value="10"></div></label>
        <label class="field"><span>Max sight length</span><div class="suffix" data-suffix="ft"><input class="input num" id="maxs" inputmode="decimal" value="300"></div></label>`)}
    </div>
    <div class="pinned"><button class="btn primary block" id="start" disabled>START BOOK ▶</button></div></div>`;
  bindCommon(root);
  const st = { inst: 'Automatic level', method: 'single', std: '3rd', rod: 16 };
  const latest = C.latestPeg(db.pegTests); st.pegOn = !!latest && !latest.sample; st.useDist = db.prefs.useDist;
  $('#setupDist').onclick = () => { st.useDist = !st.useDist; setSwitch($('#setupDist'), st.useDist); };
  const pegSw = $('#pegSw');
  if (pegSw) { setSwitch(pegSw, st.pegOn); pegSw.onclick = () => { if (!latest) return; st.pegOn = !st.pegOn; setSwitch(pegSw, st.pegOn); }; }
  $('#pegShoot') && ($('#pegShoot').onclick = () => go(`#/j/${job.id}/peg/new`));
  $('#inst').onclick = () => choose('Instrument', INSTRUMENTS.map((v) => ({ v, label: v })), st.inst, (v) => { st.inst = v; $('#instv').textContent = v; });
  $$('#method button').forEach((b) => (b.onclick = () => { st.method = b.dataset.v; $$('#method button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#threeOpts').hidden = st.method !== 'three'; }));
  const stdLabel = (x) => (x.k ? `${x.label} · ${x.k} ft√mi` : x.label);
  $('#std') && ($('#std').onclick = () => choose('Closure standard', C.STANDARDS.map((x) => ({ v: x.id, label: stdLabel(x) })), st.std, (v) => { st.std = v; const x = C.STANDARDS.find((y) => y.id === v); $('#stdv').textContent = stdLabel(x); $('#customRow').hidden = v !== 'custom'; }));
  $('#rodl').onclick = () => choose('Rod length', [13, 14, 16, 25].map((v) => ({ v: String(v), label: `${v} ft` })), String(st.rod), (v) => { st.rod = Number(v); $('#rodlv').textContent = `${v} ft`; });
  const valid = () => $('#sn').value.trim() && isFinite(parseFloat($('#bme').value)) && (type !== 'run' || ($('#cbn').value.trim() && isFinite(parseFloat($('#cbe').value))));
  const upd = () => ($('#start').disabled = !valid());
  $$('input', root).forEach((i) => i.addEventListener('input', upd));
  $('#start').onclick = () => {
    if (!valid()) return;
    Object.assign(s, {
      name: $('#sn').value.trim(), observer: $('#obs').value.trim(), rodPerson: $('#rodp').value.trim(), instrument: st.inst,
      method: type === 'site' || type === 'stake' ? 'single' : st.method, stakes: type === 'stake' ? [] : undefined, stadiaK: parseFloat($('#sk')?.value) || 100, spreadTol: parseFloat($('#stol')?.value) || 0.003,
      startBM: { name: ($('#bmn').value.trim() || 'BM-1').toUpperCase(), elev: C.round(parseFloat($('#bme').value), 3) },
      closeBM: type === 'run' ? { name: $('#cbn').value.trim().toUpperCase(), elev: C.round(parseFloat($('#cbe').value), 3) } : { name: '', elev: null },
      standard: st.std, customK: parseFloat($('#ck')?.value) || 0.05, rodLength: st.rod,
      imbalanceLimit: parseFloat($('#imb').value) || 10, maxSight: parseFloat($('#maxs').value) || 300,
      peg: type !== 'site' && latest ? { on: st.pegOn, test: pegSnap(latest) } : null, useDist: st.useDist,
    });
    job.surveys.push(s); touch(job, s); entry = null; go(`#/j/${job.id}/s/${s.id}/entry`);
  };
}

// ---------- 3. Entry ----------
function nextPointName(s, type) {
  if (type === 'IFS') return `SS${s.readings.filter((r) => r.type === 'IFS').length + 1}`;
  let n = 1; const names = new Set(s.readings.map((r) => r.point.toUpperCase()));
  while (names.has(`TP${n}`)) n++; return `TP${n}`;
}
function newEntryState(job, s, params) {
  const three = s.method === 'three' && s.type !== 'site';
  const editIdx = params.has('edit') ? Number(params.get('edit')) : null;
  const comp = C.computeSurvey(s);
  const st = { jobId: job.id, sid: s.id, three, editIdx, reading: '', dist: '', t: '', m: '', b: '', active: three ? 't' : 'reading', accepted: false, type: comp.expect, point: '', note: '' };
  if (editIdx != null && s.readings[editIdx]) {
    const r = s.readings[editIdx]; st.type = r.type; st.point = r.point;
    if (r.wires) { st.t = r.wires.t.toFixed(3); st.m = r.wires.m.toFixed(3); st.b = r.wires.b.toFixed(3); }
    else { st.reading = r.text || C.fmtReading(r.value); st.dist = r.dist != null ? String(r.dist) : ''; }
    st.accepted = !!r.accepted; st.note = r.note || '';
  } else {
    const want = params.get('type');
    if (want === 'IFS' && comp.expect === 'FS') st.type = 'IFS';
    else if (s.type === 'site' && comp.expect === 'FS' && s.readings.length) st.type = 'IFS';
    st.point = st.type === 'BS' ? comp.currentPoint : nextPointName(s, st.type);
  }
  return st;
}
const ctxFor = (s, st) => C.computeSurvey(st.editIdx != null ? { ...s, readings: s.readings.slice(0, st.editIdx) } : s);
function entryEval(s, st) {
  const ctx = ctxFor(s, st); const L = s.rodLength || 16;
  const out = { ctx, errors: [], acceptable: false, warns: [], wires: {}, value: null, dist: null };
  const num = (x) => (x === '' || x === '.' ? null : parseFloat(x));
  if (st.three) {
    const t = num(st.t), m = num(st.m), b = num(st.b);
    ['t', 'm', 'b'].forEach((k) => { const v = num(st[k]); const er = C.readingError(v, L); out.wires[k] = { v, error: er ? (er === 'over' ? '> ROD' : '< 0') : null, impossible: !!er }; if (er) out.errors.push(`${k.toUpperCase()} ${er === 'over' ? `over rod length (${L} ft)` : 'below zero'}`); });
    if (t != null && m != null && b != null && !out.errors.length) {
      const tw = C.threeWire({ t, m, b }, s.stadiaK, s.spreadTol); out.tw = tw; out.value = tw.mean; out.dist = tw.dist;
      if (!tw.orderOk) { out.wires[tw.flagWire].error = 'ORDER'; out.errors.push('Wire order must be T > M > B'); }
      else if (!tw.spreadOk) { out.wires[tw.flagWire].error = `Δ${tw.spreadDiff.toFixed(3)}`; out.errors.push(`Wire spread uneven: Δ ${tw.spreadDiff.toFixed(3)} > ${s.spreadTol} ft`); out.acceptable = true; out.acceptNote = `Accepted: spread Δ${tw.spreadDiff.toFixed(3)} > ${s.spreadTol}`; }
      if (tw.meanWarn) out.warns.push(`⚠ Mean differs from middle wire by ${tw.meanDev.toFixed(3)} ft`);
    }
  } else {
    const v = num(st.reading); const er = C.readingError(v, L); out.value = v; out.dist = num(st.dist);
    out.wires.r = { v, error: er ? (er === 'over' ? '> ROD' : '< 0') : null, impossible: !!er };
    if (er) out.errors.push(er === 'over' ? `Reading over rod length (${L} ft)` : 'Reading below zero');
  }
  out.distRec = out.dist; if (!C.usesDist(s)) out.dist = null; // switch OFF: distance not used
  if (out.dist != null && s.maxSight && out.dist > s.maxSight) out.warns.push(`⚠ Sight ${out.dist} ft > max ${s.maxSight} ft`);
  if (st.type === 'FS' && out.dist != null) { const su = ctx.setups[ctx.setups.length - 1]; if (su && su.bsDist != null && Math.abs(su.bsDist - out.dist) > s.imbalanceLimit) out.warns.push(`⚠ Setup imbalance ${C.round(Math.abs(su.bsDist - out.dist), 1)} ft > ${s.imbalanceLimit} ft`); }
  if (out.value != null && !isNaN(out.value)) {
    const peg = C.pegFor(s); out.peg = peg ? C.corrected(out.value, out.dist, peg) : null;
    const v = out.peg ? out.peg.v : out.value;
    if (st.type === 'BS') out.result = { label: 'New HI', v: C.round(ctx.lastElev + v, 3) };
    else if (ctx.hi != null) out.result = { label: 'New elev', v: C.round(ctx.hi - v, 3) };
  }
  out.impossible = st.three ? Object.values(out.wires).some((w) => w.impossible) || !!(out.tw && !out.tw.orderOk) : out.wires.r.impossible;
  out.complete = out.value != null && !isNaN(out.value) && st.point.trim() !== '';
  out.canConfirm = out.complete && !out.impossible && (!out.errors.length || (out.acceptable && st.accepted));
  return out;
}
function entryScreen(job, s, params) {
  if (job.archived) return go(`#/j/${job.id}/s/${s.id}/book`);
  if (!entry || entry.sid !== s.id || params.toString() !== entry.params) { entry = newEntryState(job, s, params); entry.params = params.toString(); }
  const st = entry; const root = app();
  root.innerHTML = `<div class="screen">
    <div class="strip"><button class="back" id="toBook" aria-label="Back to book" style="font-size:28px;padding:0 8px">‹</button><div class="st-l"><div class="st1"><span id="st1"></span>${st.three ? ' <span class="tag blue">3-WIRE</span>' : ''}</div><div class="st2" id="st2"></div></div><button class="iconbtn" id="bookBtn" aria-label="Level book">${I.book}</button></div>
    <div class="entry-mid"><div class="rodcol"><svg id="rod" role="img" aria-label="Level rod"></svg></div><div class="panel" id="panel"></div></div>
    <div class="keypad" id="keypad">
      <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="fn" data-k="back" aria-label="Backspace">⌫</button>
      <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="confirm" data-k="ok" id="confirm">CONFIRM</button>
      <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
      <button data-k=".">.</button><button data-k="0">0</button><button class="fn" data-k="clr">CLR</button><button class="fn" data-k="next">NEXT ↓</button>
    </div></div>`;
  $('#toBook').onclick = $('#bookBtn').onclick = () => { entry = null; go(`#/j/${job.id}/s/${s.id}/book`); };
  rodView = new RodView($('#rod'));
  const draw = () => drawEntry(job, s);
  const key = (k) => {
    const f = st.active;
    if (k === 'ok') return confirmEntry(job, s);
    if (k === 'next') { st.active = st.three ? { t: 'm', m: 'b', b: 't' }[f] : f === 'reading' && C.usesDist(s) ? 'dist' : 'reading'; return draw(); }
    if (k === 'clr') { st[f] = ''; st.accepted = false; return draw(); }
    if (k === 'back') { st[f] = st[f].slice(0, -1); st.accepted = false; return draw(); }
    let v = st[f];
    if (k === '.') { if (v.includes('.')) return; v = (v || '0') + '.'; }
    else {
      const [ip, dp] = v.split('.'); const maxInt = f === 'dist' ? 4 : 2; const maxDec = f === 'dist' ? 1 : 3;
      if (dp == null && (ip || '').replace(/^0/, '').length >= maxInt) return;
      if (dp != null && dp.length >= maxDec) return;
      v = v === '0' ? k : v + k;
    }
    st[f] = v; st.accepted = false;
    if (st.three && /\.\d{3}$/.test(v) && f !== 'b') st.active = f === 't' ? 'm' : 'b'; // auto-advance
    draw();
  };
  $$('#keypad button').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
  window.onresize = () => rodView && rodView.draw();
  draw();
}
function drawEntry(job, s) {
  const st = entry; const ev = entryEval(s, st); const ctx = ev.ctx;
  const setupN = ctx.setups.length + (st.type === 'BS' ? 1 : 0);
  const from = st.type === 'BS' ? st.point : ctx.currentPoint;
  $('#st1').innerHTML = st.editIdx != null ? `EDIT · ${esc(st.point)} ${st.type}` : `SETUP ${setupN || 1} · ${esc(from)} → ${st.type === 'BS' ? 'HI' : esc(st.point || '?')}`;
  $('#st2').innerHTML = `<small>HI</small> ${ctx.hi != null ? C.f3(ctx.hi) : '—'} <small>ELEV</small> ${C.f3(ctx.lastElev)}`;
  const allowed = st.editIdx != null ? [st.type] : ctx.expect === 'BS' ? ['BS'] : ['FS', 'IFS'];
  const closeBM = C.closingBM(s);
  const rbox = (k, label, cls) => { const w = ev.wires[k === 'reading' ? 'r' : k]; const bad = w && w.error; return `<div class="rbox ${cls}${st.active === k ? ' active' : ''}${bad ? ' bad' : ''}" data-f="${k}" role="textbox" aria-label="${label}"><span class="lab">${label}</span><span class="val">${st[k] ? esc(st[k]) : '<span class="ph">–.––</span>'}</span></div>`; };
  const resLine = `<div class="result ${ev.impossible ? 'bad' : ''}"><span class="lbl">${ev.result ? ev.result.label : st.type === 'BS' ? 'New HI' : 'New elev'} </span>${ev.result && !ev.impossible ? C.f3(ev.result.v) : '—'}</div>`;
  const p = $('#panel');
  p.innerHTML = `<div class="seg rt" id="rt">${['BS', 'FS', 'IFS'].map((t) => `<button data-v="${t}" aria-pressed="${st.type === t}" ${allowed.includes(t) ? '' : 'disabled style="opacity:.35"'}>${t}</button>`).join('')}</div>
    <div class="ptrow"><input class="input" id="pt" value="${esc(st.point)}" aria-label="Point name" autocomplete="off" autocapitalize="characters" ${st.type === 'BS' && st.editIdx == null ? 'readonly' : ''}></div>
    ${st.type === 'FS' && st.editIdx == null && closeBM && closeBM.name && s.type !== 'site' && st.point !== closeBM.name ? `<div class="quick"><button id="closeOn">Close on ${esc(closeBM.name)}</button></div>` : ''}
    ${st.three ? `${rbox('t', 'TOP', 'w3')}${rbox('m', 'MID', 'w3')}${rbox('b', 'BOT', 'w3')}
      <div class="rescard"><div class="result"><span class="lbl">MEAN </span>${ev.tw ? ev.tw.mean.toFixed(3) : '—'}</div><div class="result${C.usesDist(s) ? '' : ' muted'}"><span class="lbl">DIST </span>${ev.distRec != null && !isNaN(ev.distRec) ? ev.distRec.toFixed(1) + ' ft' : '—'}${C.usesDist(s) ? '' : '<span class="lbl"> (not used)</span>'}</div>${resLine}</div>`
    : `${rbox('reading', 'READING', '')}${C.usesDist(s) ? rbox('dist', 'DIST ft', 'small') : ''}${resLine}`}
    ${distRow(C.usesDist(s), { compact: true, note: C.usesDist(s) ? '' : st.three ? 'Stadia shown, not used' : 'No DIST · read as is' })}
    ${ev.peg && !ev.impossible ? (ev.peg.noDist ? `<div class="msg pegmsg nd">${C.usesDist(s) ? 'Peg: no distance – reading used as is' : 'Peg off – no distance'}</div>` : `<div class="msg pegmsg">Peg ${sgn(ev.peg.corr)} → ${ev.peg.v.toFixed(3)}</div>`) : ''}
    ${ev.errors.map((e) => `<div class="msg err">✕ ${esc(e)}</div>`).join('')}${ev.warns.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('')}
    ${ev.acceptable && !st.accepted ? '<button class="btn accept" id="accept">Accept anyway</button>' : ''}${ev.acceptable && st.accepted ? '<div class="msg warn">⚠ Accepted – note added to row</div>' : ''}
    ${st.editIdx != null && st.editIdx === s.readings.length - 1 ? '<button class="btn danger accept" id="delR">Delete this reading</button>' : ''}`;
  $$('#rt button').forEach((b) => (b.onclick = () => { if (!allowed.includes(b.dataset.v)) return; st.type = b.dataset.v; if (st.editIdx == null) st.point = st.type === 'BS' ? ctx.currentPoint : nextPointName(s, st.type); drawEntry(job, s); }));
  $$('.rbox', p).forEach((b) => (b.onclick = () => { st.active = b.dataset.f; drawEntry(job, s); }));
  $('#distSw', p).onclick = () => toggleDist(job, s, () => { if (!C.usesDist(s) && st.active === 'dist') st.active = 'reading'; drawEntry(job, s); });
  $('#pt').oninput = (e) => { st.point = e.target.value.toUpperCase(); e.target.value = st.point; $('#confirm').disabled = !entryEval(s, st).canConfirm; };
  $('#pt').onchange = () => drawEntry(job, s);
  $('#closeOn') && ($('#closeOn').onclick = () => { st.point = closeBM.name; drawEntry(job, s); });
  $('#accept') && ($('#accept').onclick = () => { st.accepted = true; st.note = ev.acceptNote; drawEntry(job, s); });
  $('#delR') && ($('#delR').onclick = async () => { if (await confirmDialog({ title: 'Delete reading?', text: `Remove ${st.type} on ${st.point}?`, ok: 'Delete', danger: true })) { s.readings.pop(); s.closed = false; touch(job, s); entry = null; go(`#/j/${job.id}/s/${s.id}/book`); } });
  $('#confirm').disabled = !ev.canConfirm;
  const firstMsg = $('.msg, #accept', p); if (firstMsg && (ev.errors.length || ev.warns.length)) p.scrollTop = p.scrollHeight; else if (!st.three || st.active === 't') p.scrollTop = 0;
  // rod
  const svg = $('#rod'); const H = svg.clientHeight || 380; const L = s.rodLength || 16;
  let wires, center, ppf, mean = null;
  if (st.three) {
    const ok = ['t', 'm', 'b'].map((k) => ev.wires[k].v).filter((v) => v != null && !isNaN(v) && v >= 0 && v <= L);
    const mv = ev.wires.m.v;
    center = ok.length > 1 ? (Math.max(...ok) + Math.min(...ok)) / 2 : mv != null && !isNaN(mv) ? mv : ok.length ? ok[0] : rodView.cur ? rodView.cur.c : 5;
    const span = ok.length > 1 ? Math.max(...ok) - Math.min(...ok) : 0;
    ppf = Math.min(800, Math.max(40, (H * 0.8) / (span + 0.25)));
    wires = ['t', 'm', 'b'].map((k) => ({ v: ev.wires[k].v, main: k === 'm', active: st.active === k, error: !!ev.wires[k].error, impossible: ev.wires[k].impossible, label: `${k.toUpperCase()} ${st[k] || ''}`, sub: ev.wires[k].error }));
    mean = ev.tw ? ev.tw.mean : null;
  } else {
    const v = ev.wires.r.v; center = v != null && !isNaN(v) ? v : rodView.cur ? rodView.cur.c : 5;
    ppf = 800;
    wires = v != null && !isNaN(v) ? [{ v, main: true, active: st.active === 'reading', error: !!ev.wires.r.error, impossible: ev.wires.r.impossible, label: st.reading, sub: ev.wires.r.error }] : [];
  }
  const dim = Object.values(ev.wires).some((w) => w.error);
  rodView.set({ center: Math.max(0.15, Math.min(L - 0.15, center)), ppf, rodLength: L, wires, mean, dim, three: st.three, instant: !rodView.cur });
}
async function confirmEntry(job, s) {
  const st = entry; const ev = entryEval(s, st); if (!ev.canConfirm) return;
  const r = { id: st.editIdx != null ? s.readings[st.editIdx].id : uid(), type: st.type, point: st.point.trim().toUpperCase() };
  if (st.three) r.wires = { t: parseFloat(st.t), m: parseFloat(st.m), b: parseFloat(st.b) };
  else { r.value = parseFloat(st.reading); r.text = st.reading.includes('.') && !st.reading.endsWith('.') ? st.reading : r.value.toFixed(2); if (C.usesDist(s) && st.dist !== '' && st.dist !== '.') r.dist = parseFloat(st.dist); }
  if (st.accepted && ev.acceptable) { r.accepted = true; r.note = st.note; }
  if (st.editIdx != null) { s.readings[st.editIdx] = r; touch(job, s); entry = null; toast('Reading updated – book recalculated'); return go(`#/j/${job.id}/s/${s.id}/book`); }
  s.readings.push(r); s.closed = false; touch(job, s);
  const closeBM = C.closingBM(s);
  entry = null;
  if (r.type === 'FS' && s.type !== 'site' && closeBM && r.point === String(closeBM.name).toUpperCase()) {
    render();
    const ok = await confirmDialog({ title: `Closed on ${closeBM.name}`, text: `Foresight on ${closeBM.name} recorded. Close the ${s.type} now and check misclosure?`, ok: 'CLOSE ▶', cancel: 'Keep going' });
    if (ok) { s.closed = true; touch(job, s); return go(`#/j/${job.id}/s/${s.id}/close`); }
    return;
  }
  render();
  toast(`${r.type} ${r.point} saved`);
}

// ---------- 4. Level book ----------
const bookUI = { compact: false, editHint: false };
function bookScreen(job, s) {
  const ro = job.archived; const comp = C.computeSurvey(s); const three = s.method === 'three' && s.type !== 'site';
  const root = app();
  const rd0 = (v, text, w) => {
    if (v == null) return '';
    if (w && three && !bookUI.compact) { const tw = C.threeWire(w, s.stadiaK, s.spreadTol); const good = tw.orderOk && tw.spreadOk; return `<div class="tw"><small>${w.t.toFixed(3)}</small><small>${w.m.toFixed(3)}</small><small>${w.b.toFixed(3)}</small><b>${tw.mean.toFixed(3)}</b><span class="spread ${good ? 'ok' : 'bad'}">${good ? '✔' : '✕'}Δ${tw.spreadDiff.toFixed(3)}</span></div>`; }
    return w ? `<b>${C.threeWire(w, s.stadiaK, s.spreadTol).mean.toFixed(3)}</b>` : C.fmtReading(v, text);
  };
  // With peg correction: corrected value (used in HI/elev) bold, the booked raw reading small beneath.
  const rd = (r, p) => {
    const v = r[p], w = r[p + 'Wires'];
    if (v == null) return '';
    if (r[p + 'Corr'] != null) {
      if (w && three && !bookUI.compact) return `${rd0(v, null, w).replace(/<b>[^<]*<\/b>/, `<small>mean ${C.threeWire(w, s.stadiaK, s.spreadTol).mean.toFixed(3)}</small>`)}<div class="pc"><b>${v.toFixed(3)}</b><small>peg ${sgn(r[p + 'Corr'])}</small></div>`;
      return `<div class="pc"><b>${v.toFixed(3)}</b><small>raw ${w ? r[p + 'Raw'].toFixed(3) : C.fmtReading(r[p + 'Raw'], r[p + 'RawText'])}</small></div>`;
    }
    if (r[p + 'NoPeg']) return `<div class="pc">${rd0(v, r[p + 'Text'], w)}<small class="nd" title="No sight distance – not peg-corrected">no dist</small></div>`;
    return rd0(v, r[p + 'Text'], w);
  };
  let lastSetup = 0;
  const rowsHtml = comp.rows.map((r, i) => {
    const cls = [r.kind === 'BM' ? 'bm' : '', r.ifs ? 'ifs' : '', r.warn.length ? 'warn' : '', r.setup !== lastSetup && i > 0 && !r.ifs ? 'newsetup' : ''].join(' ');
    lastSetup = r.setup;
    const dist = [r.bsDist, r.fsDist].filter((x) => x != null).join(three ? '<br>' : ' / ');
    return `<tr class="${cls}" data-i="${i}"><td>${esc(r.sta)}${r.ifs ? '<br><span class="tag">IFS</span>' : ''}${r.warn.length ? ` <span class="wf" title="${esc(r.warn.join('; '))}">⚠</span>` : ''}</td>
      <td>${rd(r, 'bs')}</td><td>${r.hi != null ? C.f3(r.hi) : ''}</td><td>${rd(r, 'fs')}</td><td><b>${C.f3(r.elev)}</b></td>
      <td class="${three ? '' : 'landscape-only'}">${dist}</td><td class="landscape-only" style="font-family:var(--sans);font-size:13px;text-align:left;max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(r.warn.join('; '))}</td></tr>`;
  }).join('');
  const balWarn = Math.abs(comp.imbalance) > s.imbalanceLimit;
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}`, label: 'Job' }, title: s.name, right: `<span class="tag">${SHORT[s.type].toUpperCase()}</span>${three ? '<span class="tag blue">3-WIRE</span>' : ''}<button class="iconbtn" id="shareBtn" aria-label="Share report">${I.share}</button>` })}
    ${bookUI.editHint ? '<div class="hint">Tap a row to edit its reading</div>' : ''}
    ${three || s.type !== 'site' ? `<div class="booktools">${s.type !== 'site' ? pegChip(s, comp) : ''}${three ? `<button class="btn" id="compact" style="min-height:44px">${bookUI.compact ? '☑' : '☐'} Compact</button><span class="msg" style="color:var(--muted)">K ${s.stadiaK} · tol ${s.spreadTol} ft</span>` : ''}</div>` : ''}
    <div class="tablewrap"><table class="book${three ? ' three' : ''}"><thead><tr><th>STA</th><th>BS</th><th>HI</th><th>FS</th><th>ELEV</th><th class="${three ? '' : 'landscape-only'}">DIST</th><th class="landscape-only" style="text-align:left">NOTES</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    ${s.readings.length ? '' : '<div class="empty">No readings yet. Tap + NEXT SETUP to take the first backsight.</div>'}</div>
    <div class="summary">
      <div>ΣBS ${comp.sumBS.toFixed(3)}   ΣFS ${comp.sumFS.toFixed(3)}</div>
      <div>ΣBS−ΣFS ${sgn(comp.arith.diff)} vs Δ${comp.arith.against === 'HI' ? 'HI' : 'elev'} ${sgn(comp.arith.delta)} <span class="${comp.arith.ok ? 'ok' : 'bad'}">${comp.arith.ok ? '✔ OK' : '✕ FAIL'}</span></div>
      ${comp.distUsed ? `<div class="${balWarn ? 'wn' : ''}">BS/FS dist ${comp.totalBSdist} / ${comp.totalFSdist} ft · bal ${comp.imbalance > 0 ? '+' : ''}${comp.imbalance}${balWarn ? ' ⚠' : ''}</div>` : '<div style="color:var(--muted)">Distances not used · no balance check</div>'}
      ${three ? `<div class="${comp.failedChecks ? 'bad' : ''}">Failed wire checks: ${comp.failedChecks} ${comp.failedChecks ? '✕' : '✔'}</div>` : ''}
    </div>
    <div class="pinned">${ro ? '<div class="msg" style="color:var(--muted);text-align:center">Archived job – read-only</div>' : `
      <button class="btn primary block" id="next">＋ NEXT SETUP</button>
      <div class="row3"><button class="btn" id="side" ${comp.expect === 'FS' ? '' : 'disabled'}>＋ SIDE SHOT</button><button class="btn" id="editRow" ${s.readings.length ? '' : 'disabled'}>EDIT ROW</button><button class="btn blue" id="closeBtn" ${s.readings.length ? '' : 'disabled'}>${s.type === 'site' ? 'FINISH ▶' : `CLOSE ${s.type === 'run' ? 'RUN' : 'LOOP'} ▶`}</button></div>`}</div></div>`;
  bindCommon(root);
  $('#shareBtn').onclick = () => go(`#/j/${job.id}/s/${s.id}/share`);
  $('#compact') && ($('#compact').onclick = () => { bookUI.compact = !bookUI.compact; bookScreen(job, s); });
  $('#pegBtn') && ($('#pegBtn').onclick = () => pegSheet(job, s, () => bookScreen(job, s)));
  if (!ro) {
    $('#next').onclick = () => { entry = null; go(`#/j/${job.id}/s/${s.id}/entry`); };
    $('#side').onclick = () => { entry = null; go(`#/j/${job.id}/s/${s.id}/entry?type=IFS`); };
    $('#editRow').onclick = () => { bookUI.editHint = !bookUI.editHint; bookScreen(job, s); };
    $('#closeBtn').onclick = async () => {
      if (s.type === 'site') { s.closed = true; touch(job, s); return go(`#/j/${job.id}/s/${s.id}/share`); }
      const cl = C.closure(s, comp);
      if (!cl.closedOn) { await confirmDialog({ title: 'Not closed yet', text: `The last foresight must be on ${cl.bm?.name || 'the closing BM'} to close this ${s.type}. Take an FS on ${cl.bm?.name}, then close.`, ok: 'OK', cancel: 'Back' }); return; }
      s.closed = true; touch(job, s); go(`#/j/${job.id}/s/${s.id}/close`);
    };
  }
  $$('table.book tbody tr').forEach((tr) => (tr.onclick = () => {
    if (ro) return toast('Archived job – read-only');
    const r = comp.rows[Number(tr.dataset.i)]; bookUI.editHint = false;
    const open = (idx) => { entry = null; go(`#/j/${job.id}/s/${s.id}/entry?edit=${idx}`); };
    if (r.bsIdx != null && r.fsIdx != null) choose(`Edit ${r.sta}`, [{ v: String(r.fsIdx), label: `FS ${rdTxt(r.fsRaw ?? r.fs, r.fsRawText, r.fsWires)}` }, { v: String(r.bsIdx), label: `BS ${rdTxt(r.bsRaw ?? r.bs, r.bsRawText, r.bsWires)}` }], null, (v) => open(Number(v)));
    else if (r.bsIdx != null || r.fsIdx != null) open(r.bsIdx ?? r.fsIdx);
  }));
}
const rdTxt = (v, t, w) => (w ? `${v.toFixed(3)} (T ${w.t.toFixed(3)} M ${w.m.toFixed(3)} B ${w.b.toFixed(3)})` : C.fmtReading(v, t));

// ---------- 5. Closure ----------
function closureScreen(job, s) {
  if (s.type === 'site') return go(`#/j/${job.id}/s/${s.id}/book`);
  const comp = C.computeSurvey(s); const cl = C.closure(s, comp); const root = app();
  const method = s.adjustMethod || 'setups';
  const adj = cl.closedOn ? C.adjust(s, method, comp, cl) : [];
  const verdict = !cl.closedOn ? ['na', 'NOT CLOSED', I.x] : cl.allowable == null ? ['na', 'NO DISTANCE', I.x] : cl.pass ? ['pass', 'PASS', I.ok] : ['fail', 'FAIL', I.x];
  const std = C.STANDARDS.find((x) => x.id === s.standard) || C.STANDARDS[0];
  const bal = Math.abs(comp.imbalance) > s.imbalanceLimit;
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}/s/${s.id}/book`, label: 'Book' }, title: `Closure · ${s.name}`, right: `<button class="iconbtn" id="shareBtn" aria-label="Share report">${I.share}</button>` })}
    <div class="scroll">
      <div class="big ${verdict[0]}" role="status">${verdict[2]}<div><div class="bw">${verdict[1]}</div><div>${cl.closedOn ? `Misclosure ${sgn(cl.misclosure)} ft · allowable ${cl.allowable == null ? (cl.distOff ? 'n/a – distances not used' : 'n/a') : '±' + cl.allowable.toFixed(3)} ft` : `Last FS must be on ${esc(cl.bm?.name || '')}`}</div></div></div>
      <div class="section-label">Peg correction</div>
      <div class="card" style="padding:4px 16px">${pegSwitchRow(s, comp, job.archived)}</div>
      <div class="card" style="padding:4px 16px;margin-top:8px">${distRow(!cl.distOff, { id: 'closeDist', note: cl.distOff ? 'Off · allowable and distance adjustment not available' : '' })}</div>
      <div class="section-label">Closure</div>
      <div class="card kv">
        <span class="k">Closed on</span><span class="v">${esc(cl.bm?.name || '—')}</span>
        <span class="k">Known elevation</span><span class="v">${C.f3(cl.known)}</span>
        <span class="k">Computed elevation</span><span class="v">${C.f3(cl.computed)}</span>
        <span class="k">Misclosure</span><span class="v">${sgn(cl.misclosure)}</span>
        <span class="k">Distance</span><span class="v">${cl.distOff ? 'not used' : `${cl.feet} ft · ${cl.miles.toFixed(3)} mi`}</span>
        <span class="k">Setups</span><span class="v">${cl.setups}</span>
        <span class="k">Standard</span><span class="v" style="font-family:var(--sans);font-size:15px">${esc(std.id === 'custom' ? 'Custom' : std.label)}</span>
        <span class="k">Allowable = ${cl.k}·√mi</span><span class="v">${cl.allowable == null ? 'n/a' : '±' + cl.allowable.toFixed(3)}</span>
      </div>
      <div class="section-label">Checks</div>
      <div class="card kv">
        <span class="k">ΣBS − ΣFS</span><span class="v">${sgn(comp.arith.diff)}</span>
        <span class="k">Last − first elev</span><span class="v">${sgn(comp.arith.delta)}</span>
        <span class="k">Arithmetic check</span><span class="v" style="color:${comp.arith.ok ? 'var(--pass)' : 'var(--err)'}">${comp.arith.ok ? '✔ PASS' : '✕ FAIL'}</span>
        ${comp.distUsed ? `<span class="k">BS / FS distance</span><span class="v">${comp.totalBSdist} / ${comp.totalFSdist}</span>
        <span class="k">Distance balance</span><span class="v" style="color:${bal ? 'var(--warn)' : 'inherit'}">${comp.imbalance > 0 ? '+' : ''}${comp.imbalance} ft${bal ? ' ⚠' : ' ✔'}</span>` : '<span class="k">Distances</span><span class="v" style="font-family:var(--sans)">not used</span>'}
      </div>
      ${cl.closedOn ? `<div class="section-label">Adjusted elevations</div>
      <div class="seg" id="adjm"><button data-v="setups" aria-pressed="${method === 'setups' || cl.distOff}">By setups</button><button data-v="distance" aria-pressed="${method === 'distance' && !cl.distOff}" ${cl.distOff ? 'disabled style="opacity:.35"' : ''}>By distance</button></div>
      ${cl.distOff ? '<div class="msg" style="font-weight:400;color:var(--muted);margin-top:6px">Distances are off for this survey, so adjustment is by setups.</div>' : ''}
      <div class="card" style="margin-top:8px;padding:8px 12px"><table class="adj"><thead><tr><th>POINT</th><th>MEASURED</th><th>CORR</th><th>ADJUSTED</th></tr></thead><tbody>
      ${adj.map((p) => `<tr><td>${esc(p.point)}${p.side ? ' <span class="tag">IFS</span>' : ''}</td><td>${C.f3(p.elev)}</td><td>${sgn(p.correction)}</td><td><b>${C.f3(p.adjusted)}</b></td></tr>`).join('')}</tbody></table>
      <div class="msg" style="color:var(--muted);font-weight:400;margin-top:8px">Correction ${sgn(-cl.misclosure)} ft distributed ${method === 'distance' && !cl.distOff ? 'in proportion to cumulative sight distance' : 'equally per setup'}; the closing BM is held at its known elevation.</div></div>` : ''}
      <button class="btn" style="margin-top:16px;width:100%" id="reopen" ${job.archived ? 'disabled' : ''}>Reopen ${s.type} to add readings</button>
    </div>
    <div class="pinned"><div class="row2" style="grid-template-columns:2fr 1fr"><button class="btn primary" id="shareRep">${I.share.replace('<svg', '<svg width="22" height="22"')} SHARE REPORT</button><button class="btn" id="print">PRINT BOOK</button></div></div></div>`;
  bindCommon(root);
  $('#shareBtn').onclick = $('#shareRep').onclick = () => go(`#/j/${job.id}/s/${s.id}/share`);
  $$('#adjm button').forEach((b) => (b.onclick = () => { s.adjustMethod = b.dataset.v; touch(job, s); closureScreen(job, s); }));
  bindPegSwitch(job, s, () => closureScreen(job, s));
  $('#closeDist') && ($('#closeDist').onclick = () => toggleDist(job, s, () => closureScreen(job, s)));
  $('#reopen').onclick = () => { s.closed = false; touch(job, s); go(`#/j/${job.id}/s/${s.id}/book`); };
  $('#print').onclick = () => { const doc = R.pdfReport(job, [s], includesFor(job)); openBlob(doc.output('blob'), R.fileBase(job, s) + '.pdf'); };
}

// ---------- 6. Share ----------
const INC_DEFAULT = { table: true, checks: true, adjusted: true, threewire: false, notes: false, peg: true };
const includesFor = (job) => ({ ...INC_DEFAULT, ...(db.prefs.includes[job.id] || {}) });
const shareUI = { fmt: 'pdf', page: 0 };
function shareScreen(job, s) {
  const surveys = s ? [s] : job.surveys; const root = app(); const inc = includesFor(job);
  const back = s ? `#/j/${job.id}/s/${s.id}/${s.closed && s.type !== 'site' ? 'close' : 'book'}` : `#/j/${job.id}`;
  const opts = [['table', 'Level book table'], ['checks', 'Checks & closure'], ['adjusted', 'Adjusted elevations'], ['threewire', 'Three-wire detail'], ['peg', 'Peg test record'], ['notes', 'Notes & warnings']];
  root.innerHTML = `<div class="screen">${topbar({ back: { href: back, label: s ? 'Back' : 'Job' }, title: 'SHARE REPORT' })}
    <div class="scroll">
      <div class="section-label">Format</div>
      <div class="seg" id="fmt"><button data-v="pdf" aria-pressed="${shareUI.fmt === 'pdf'}">PDF</button><button data-v="text" aria-pressed="${shareUI.fmt === 'text'}">Text</button><button data-v="csv" aria-pressed="${shareUI.fmt === 'csv'}">CSV</button></div>
      <div class="section-label">Include ${s ? '' : `· ${surveys.length} surveys (combined)`}</div>
      <div class="card" style="padding:0 16px" id="inc">${opts.map(([k, l]) => `<label class="check"><input type="checkbox" data-k="${k}" ${inc[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="section-label">Preview</div>
      <div id="preview"></div>
    </div>
    <div class="pinned"><div class="row2"><button class="btn" id="saveF">SAVE TO FILES</button><button class="btn primary" id="shareGo">SHARE ▶</button></div></div></div>`;
  bindCommon(root);
  const draw = () => {
    const inc = includesFor(job); const pv = $('#preview');
    if (!surveys.length) { pv.innerHTML = '<div class="empty">No surveys to share yet.</div>'; return; }
    if (shareUI.fmt === 'text') pv.innerHTML = `<div class="paperwrap"><div class="paper text"><pre>${esc(R.textReport(job, surveys))}</pre></div></div><div class="msg" style="color:var(--muted);font-weight:400;margin-top:6px">Sent as the message text – good for SMS and Teams chats.</div>`;
    else if (shareUI.fmt === 'csv') { const lines = R.csvReport(job, surveys).split('\r\n'); pv.innerHTML = `<div class="paperwrap"><div class="paper text"><pre style="font-size:8px">${esc(lines.slice(0, 40).join('\n'))}${lines.length > 40 ? '\n…' : ''}</pre></div></div>`; }
    else {
      const pages = R.previewPages(job, surveys, inc); shareUI.page = Math.max(0, Math.min(shareUI.page, pages.length - 1));
      pv.innerHTML = `<div class="paperwrap"><div class="paper" style="position:relative">${pages[shareUI.page]}</div></div><div class="pager"><button id="pp" aria-label="Previous page">‹</button><span>Page ${shareUI.page + 1} of ${pages.length}</span><button id="pn" aria-label="Next page">›</button></div>`;
      $('#pp').onclick = () => { shareUI.page = Math.max(0, shareUI.page - 1); draw(); };
      $('#pn').onclick = () => { shareUI.page = Math.min(pages.length - 1, shareUI.page + 1); draw(); };
    }
  };
  $$('#fmt button').forEach((b) => (b.onclick = () => { shareUI.fmt = b.dataset.v; shareUI.page = 0; $$('#fmt button').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  $$('#inc input').forEach((c) => (c.onchange = () => { db.prefs.includes[job.id] = { ...includesFor(job), [c.dataset.k]: c.checked }; save(); draw(); }));
  // iOS: build the file synchronously and call navigator.share directly inside the tap handler (no awaits first).
  $('#shareGo').onclick = () => { if (surveys.length) doShare(job, s, surveys); };
  $('#saveF').onclick = () => { if (!surveys.length) return; const f = buildFile(job, s, surveys); downloadBlob(f.blob, f.name); };
  draw();
}
function buildFile(job, s, surveys) {
  const base = R.fileBase(job, s); const inc = includesFor(job);
  if (shareUI.fmt === 'pdf') return { blob: R.pdfReport(job, surveys, inc).output('blob'), name: base + '.pdf', type: 'application/pdf' };
  if (shareUI.fmt === 'csv') return { blob: new Blob([R.csvReport(job, surveys)], { type: 'text/csv' }), name: base + '.csv', type: 'text/csv' };
  return { blob: new Blob([R.textReport(job, surveys)], { type: 'text/plain' }), name: base + '.txt', type: 'text/plain' };
}
function doShare(job, s, surveys) {
  const title = R.reportTitle(job, s); const text = R.textReport(job, surveys);
  const f = buildFile(job, s, surveys);
  if (N()) { // native iOS: write to the cache dir, then open the system share sheet with the file URI
    const p = shareUI.fmt === 'text' ? N().shareText({ title, text }) : N().shareFile({ blob: f.blob, name: f.name, title, text });
    p.then((r) => r !== 'cancelled' && toast('Shared')).catch((e) => toast('Share failed: ' + (e?.message || e)));
    return;
  }
  let data = null;
  if (shareUI.fmt === 'text') data = navigator.share ? { title, text } : null;
  else { const file = new File([f.blob], f.name, { type: f.type }); if (navigator.canShare && navigator.canShare({ files: [file] })) data = { title, text, files: [file] }; }
  if (data && navigator.share) navigator.share(data).then(() => toast('Shared')).catch((err) => { if (err && err.name === 'AbortError') return; shareFallback(title, text, f); });
  else shareFallback(title, text, f);
}
function shareFallback(title, text, f) {
  const enc = encodeURIComponent; const shortText = text.length > 1500 ? text.slice(0, 1500) + '…' : text;
  const smsSep = isIOS ? '&' : '?';
  const s = sheet('Share', `<p class="msg" style="color:var(--muted);font-weight:400">This browser can't hand files to other apps directly. Save the file, then attach it – or send the text summary.</p>
    <button class="listbtn" id="fbDl">⬇ Save ${esc(f.name)}</button>
    <button class="listbtn" id="fbCopy">📋 Copy text summary</button>
    <a class="listbtn" href="mailto:?subject=${enc(title)}&body=${enc(shortText)}" style="text-decoration:none">✉ Email (text summary)</a>
    <a class="listbtn" href="sms:${smsSep}body=${enc(shortText)}" style="text-decoration:none">💬 Text message (text summary)</a>`);
  $('#fbDl', s.el).onclick = () => downloadBlob(f.blob, f.name);
  $('#fbCopy', s.el).onclick = () => {
    const legacy = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); toast('Copied'); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied'), legacy); else legacy();
  };
}
function downloadBlob(blob, name) {
  if (N()) { N().shareFile({ blob, name, title: name }).catch((e) => toast('Save failed: ' + (e?.message || e))); return; } // share sheet has “Save to Files”
  const url = URL.createObjectURL(blob);
  if (isIOS && isStandalone()) { const w = window.open(url, '_blank'); if (!w) location.href = url; } // iOS home-screen apps often ignore a[download]
  else { const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000); toast(`Saved ${name}`);
}
function openBlob(blob, name) { if (N()) return downloadBlob(blob, name); const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) downloadBlob(blob, name); setTimeout(() => URL.revokeObjectURL(url), 120000); }

// ---------- Peg test (two-peg collimation check) ----------
const pegEval = (t) => C.pegTest(t, db.prefs.pegTol || C.PEG_TOL_DEFAULT);
const pegSnap = (t) => ({ tol: db.prefs.pegTol || C.PEG_TOL_DEFAULT, ...JSON.parse(JSON.stringify(t)) });
const pegShort = (t) => { const p = pegEval(t); return `${R.usDate(t.date)} · C ${C.pegLabel(p.per100)} ft/100 ft`; };
function pegMenuLine() {
  const t = C.latestPeg(db.pegTests);
  return t ? `Two-peg collimation check<br><span class="mono">Last ${esc(R.usDate(t.date))} · ${C.pegLabel(pegEval(t).per100)}${t.sample ? ' (sample)' : ''}</span>` : 'Two-peg collimation check';
}
function setSwitch(el, on) { el.setAttribute('aria-checked', String(!!on)); }
// "Use distance" switch row (same switch style; the row + switch give a ≥56 px tap target).
function distRow(on, { id = 'distSw', note, locked, compact } = {}) {
  const d = note ?? (on ? 'Sight distances used for peg correction, balance checks & closure' : 'Readings used as read · no distance checks');
  return `<div class="switchrow distrow${compact ? ' compact' : ''}"><div class="sw-l"><div class="sw-t">Use distance</div>${d ? `<div class="sw-d">${d}</div>` : ''}</div><button class="switch" id="${id}" role="switch" aria-checked="${locked ? 'true' : !!on}" aria-label="Use distance" ${locked ? 'disabled' : ''}></button></div>`;
}
const pegPass = (t) => { const p = pegEval(t); return p.pass ? '<span class="chip closed">✔ within tol</span>' : '<span class="chip check">⚠ over tol</span>'; };
function pegSetupBlock() {
  const t = C.latestPeg(db.pegTests);
  if (!t) return `<div class="switchrow"><div class="sw-l"><div class="sw-t">Apply peg correction</div><div class="sw-d">No peg test yet</div></div><button class="switch" id="pegSw" role="switch" aria-checked="false" aria-label="Peg correction" disabled></button></div>
    <button class="btn block" id="pegShoot" style="margin-top:8px">${I.peg.replace('<svg', '<svg width="22" height="22"')} SHOOT A PEG TEST</button>`;
  return `<div class="switchrow"><div class="sw-l"><div class="sw-t">Apply peg correction</div><div class="sw-d mono">${esc(pegShort(t))}</div><div class="sw-d">${esc(t.instrument || '—')}${t.sample ? ' · <span class="tag">SAMPLE</span>' : ''}</div></div><button class="switch" id="pegSw" role="switch" aria-label="Peg correction"></button></div>
    <div class="msg" style="font-weight:400;color:var(--muted);margin-top:8px">Reading − C × sight distance on every BS/FS/IFS with a distance (three-wire: stadia distance). Single-wire shots without a distance stay as read.${t.sample ? ' <b>The latest test is SAMPLE data, so this starts OFF – shoot your own.</b>' : ''}</div>`;
}
function pegChip(s, comp) {
  const on = comp.peg; const t = s.peg?.test;
  const txt = on ? `PEG ON · ${C.pegLabel(on.per100)}` : t || C.latestPeg(db.pegTests) ? 'PEG OFF' : 'NO PEG TEST';
  return `<button class="btn pegbtn${on ? ' on' : ''}" id="pegBtn" style="min-height:44px">${txt} ▾</button>${on && on.skipped ? `<span class="msg" style="color:var(--muted)">${on.skipped} uncorrected (no dist)</span>` : ''}`;
}
function pegSwitchRow(s, comp, ro) {
  const t = s.peg?.test; const latest = C.latestPeg(db.pegTests); const on = comp.peg;
  const d = on ? `C ${C.pegLabel(on.per100)} ft/100 ft · test ${R.usDate(t.date)}<br>${on.applied} corrected${on.skipped ? ` · ${on.skipped} no distance` : ''}`
    : t ? `Off · raw readings (test ${R.usDate(t.date)} on file)` : latest ? 'Off · raw readings' : 'No peg test yet';
  return `<div class="switchrow"><div class="sw-l"><div class="sw-t">Apply peg correction</div><div class="sw-d mono">${d}</div></div><button class="switch" id="pegSw" role="switch" aria-checked="${!!on}" aria-label="Peg correction" ${ro || (!t && !latest) ? 'disabled' : ''}></button></div>
    <button class="linkbtn" id="pegMore">Peg test options ›</button>`;
}
function togglePeg(job, s) {
  const latest = C.latestPeg(db.pegTests);
  if (!s.peg || !s.peg.test) { if (!latest) return toast('No peg test yet'); s.peg = { on: true, test: pegSnap(latest) }; }
  else s.peg.on = !s.peg.on;
  touch(job, s); toast(s.peg.on ? `Peg correction ON · C ${C.pegLabel(pegEval(s.peg.test).per100)}` : 'Peg correction OFF – raw readings');
}
function bindPegSwitch(job, s, rerender) {
  const sw = $('#pegSw'); if (sw) sw.onclick = () => { togglePeg(job, s); rerender(); };
  const m = $('#pegMore'); if (m) m.onclick = () => pegSheet(job, s, rerender);
}
function pegSheet(job, s, rerender) {
  const ro = job.archived; const comp = C.computeSurvey(s); const t = s.peg?.test; const latest = C.latestPeg(db.pegTests);
  const p = t ? pegEval(t) : null; const newer = latest && (!t || latest.id !== t.id);
  const sh = sheet('Peg correction', `${pegSwitchRow(s, comp, ro)}
    ${t ? `<div class="section-label">Peg test used by this ${SHORT[s.type].toLowerCase()}</div><div class="card kv" style="font-size:15px">
      <span class="k">Date</span><span class="v">${esc(R.usDate(t.date))}</span><span class="k">Instrument</span><span class="v" style="font-family:var(--sans)">${esc(t.instrument || '—')}</span>
      <span class="k">C</span><span class="v">${C.pegLabel(p.per100)} ft/100 ft</span><span class="k">Result</span><span class="v">${pegPass(t)}</span></div>
      <div class="msg" style="font-weight:400;color:var(--muted);margin-top:6px">A copy of the test is saved with this book, so newer peg tests never change it unless you pick “Use latest”.</div>` : ''}
    ${newer && !ro ? `<button class="btn block" id="useLatest" style="margin-top:12px">Use latest peg test · ${esc(pegShort(latest))}</button>` : ''}
    <button class="listbtn" id="pegList" style="margin-top:12px">${I.peg.replace('<svg', '<svg width="22" height="22"')} View peg tests</button>`);
  const refresh = () => { sh.close(); rerender(); pegSheet(job, s, rerender); };
  const sw = $('#pegSw', sh.el); if (sw) sw.onclick = () => { togglePeg(job, s); refresh(); };
  $('#pegMore', sh.el)?.remove();
  $('#useLatest', sh.el) && ($('#useLatest', sh.el).onclick = () => { s.peg = { on: true, test: pegSnap(latest) }; touch(job, s); toast(`Using peg test ${R.usDate(latest.date)}`); refresh(); });
  $('#pegList', sh.el).onclick = () => { sh.close(); go(`#/j/${job.id}/peg`); };
}
function pegListScreen(job) {
  const root = app(); const tests = [...db.pegTests].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0));
  const row = (t, i) => { const p = pegEval(t); return `<button data-pid="${t.id}"><span class="rn"><b class="mono">${esc(R.usDate(t.date))}</b> · ${esc(t.instrument || '—')}${t.sample ? ' <span class="tag">SAMPLE</span>' : ''}${i === 0 ? ' <span class="tag blue">LATEST</span>' : ''}<br><span class="mono" style="font-size:15px;color:var(--muted)">C ${C.pegLabel(p.per100)} ft/100 ft</span></span>${p.pass ? '<span class="chip closed">✔</span>' : '<span class="chip check">⚠</span>'}</button>`; };
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}`, label: 'Job' }, title: 'Peg Tests', right: sysIcons() })}
    <div class="scroll">
      <div class="card" style="display:flex;gap:16px;align-items:center;margin-top:8px">${pegDiagram(70)}</div>
      <div class="msg" style="font-weight:400;color:var(--muted);margin:8px 4px">Shared by all jobs. New loops and runs use the latest test; each book keeps a copy of the one it used. Tolerance ±${db.prefs.pegTol} ft/100 ft (Settings).</div>
      <div class="section-label">Tests</div>
      ${tests.length ? `<div class="recent" id="pegs">${tests.map(row).join('')}</div>` : `<div class="empty">${I.peg.replace('<svg', '<svg width="64" height="64"')}<h2>No peg tests yet</h2><p>Check your level before a loop: two pegs about 200 ft apart.</p></div>`}
    </div>
    <div class="pinned"><button class="btn primary block" id="newPeg">＋&nbsp; NEW PEG TEST</button></div></div>`;
  bindCommon(root);
  $$('#pegs button').forEach((b) => (b.onclick = () => go(`#/j/${job.id}/peg/${b.dataset.pid}`)));
  $('#newPeg').onclick = () => go(`#/j/${job.id}/peg/new`);
}
// Small field diagram of the two setups.
function pegDiagram(h = 70) {
  const lvl = (x, y) => `<path d="M${x - 5} ${y + 14}l5-10 5 10M${x} ${y + 4}v-5" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="${x - 6}" y="${y - 5}" width="12" height="5" rx="1" fill="var(--yellow)" stroke="currentColor" stroke-width="1.2"/>`;
  const peg = (x, y, l) => `<path d="M${x} ${y + 14}v-26" stroke="currentColor" stroke-width="2.5"/><text x="${x}" y="${y + 26}" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor">${l}</text>`;
  return `<svg viewBox="0 0 300 ${h * 1.6}" width="100%" height="${h * 1.6}" style="color:var(--text);font-family:var(--sans)">
    <text x="0" y="12" font-size="10" font-weight="800" fill="var(--muted)">SETUP 1 · MIDWAY</text>${peg(60, 30, 'A')}${peg(250, 30, 'B')}${lvl(155, 30)}
    <path d="M70 26H240" stroke="var(--blue)" stroke-dasharray="3 3"/><text x="155" y="60" text-anchor="middle" font-size="9" fill="var(--muted)">D/2 · D/2</text>
    <text x="0" y="78" font-size="10" font-weight="800" fill="var(--muted)">SETUP 2 · NEAR A</text>${peg(60, 96, 'A')}${peg(250, 96, 'B')}${lvl(36, 96)}
    <path d="M44 92H240" stroke="var(--blue)" stroke-dasharray="3 3"/><text x="150" y="${h * 1.6 - 2}" text-anchor="middle" font-size="9" fill="var(--muted)">dA · dB</text></svg>`;
}
let pegDraft = null;
function pegSetupScreen(job) {
  const root = app(); const last = C.latestPeg(db.pegTests.filter((t) => !t.sample));
  const num = (id, v, suffix = 'ft') => `<div class="suffix" data-suffix="${suffix}"><input class="input num" id="${id}" inputmode="decimal" autocomplete="off" value="${v}"></div>`;
  const sec = (label, body) => `<div><div class="section-label">${label}</div><div class="card">${body}</div></div>`;
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}/peg`, label: 'Back' }, title: 'New Peg Test', right: sysIcons() })}
    <div class="scroll">
      ${sec('Instrument', `<label class="field"><span>Date</span><input class="input mono" id="pd" type="date" value="${todayISO()}"></label>
        <label class="field"><span>Instrument (make / serial)</span><input class="input" id="pin" value="${esc(last?.instrument || '')}" placeholder="e.g. Auto level AT-B4 #41722" autocomplete="off"></label>
        <label class="field"><span>Observer</span><input class="input" id="pob" value="${esc(last?.observer || '')}" autocomplete="off"></label>
        <div class="field"><span>Rod length</span><button class="selectbtn" id="prl"><span id="prlv">16 ft</span><span>▾</span></button></div>`)}
      ${sec('Pegs & sights', `${distRow(true, { id: 'pegDist', locked: true, note: '🔒 Peg test needs distances' })}${pegDiagram(56)}
        <label class="field" style="margin-top:12px"><span>Peg spacing A–B (D)</span>${num('pD', 200)}</label>
        <div class="msg" style="font-weight:400;color:var(--muted);margin:-8px 0 16px">Setup 1 is midway: <span class="mono" id="mid">100.0 / 100.0 ft</span></div>
        <div class="row2"><label class="field"><span>Setup 2 → A</span>${num('pA2', 10)}</label><label class="field"><span>Setup 2 → B</span>${num('pB2', 210)}</label></div>
        <div class="msg" style="font-weight:400;color:var(--muted)">Default: level 10 ft behind peg A, so B = D + 10. Pace or tape the sights.</div>`)}
    </div>
    <div class="pinned"><button class="btn primary block" id="pstart">START PEG TEST ▶</button></div></div>`;
  bindCommon(root);
  let rod = 16; let bEdited = false;
  $('#prl').onclick = () => choose('Rod length', [13, 14, 16, 25].map((v) => ({ v: String(v), label: `${v} ft` })), String(rod), (v) => { rod = Number(v); $('#prlv').textContent = `${v} ft`; });
  const f = (id) => parseFloat($(id).value);
  const upd = () => {
    const D = f('#pD'); if (!bEdited && D > 0 && f('#pA2') >= 0) $('#pB2').value = String(C.round(D + f('#pA2'), 1));
    $('#mid').textContent = D > 0 ? `${(D / 2).toFixed(1)} / ${(D / 2).toFixed(1)} ft` : '—';
    $('#pstart').disabled = !(D >= 20 && f('#pA2') >= 0 && f('#pB2') > 0 && Math.abs(f('#pB2') - f('#pA2')) >= 20 && $('#pin').value.trim());
  };
  $('#pB2').addEventListener('input', () => (bEdited = true));
  $$('input', root).forEach((i) => i.addEventListener('input', upd)); upd();
  $('#pstart').onclick = () => {
    pegDraft = { jobId: job.id, test: { id: uid(), date: $('#pd').value || todayISO(), instrument: $('#pin').value.trim(), observer: $('#pob').value.trim(), spacing: f('#pD'), dA2: f('#pA2'), dB2: f('#pB2'), a1: null, b1: null, a2: null, b2: null, rodLength: rod, jobName: job.name, created: Date.now() },
      step: 1, active: 'a1', a1: '', b1: '', a2: '', b2: '' };
    go(`#/j/${job.id}/peg/entry`);
  };
}
function pegEntryScreen(job) {
  if (!pegDraft || pegDraft.jobId !== job.id) return go(`#/j/${job.id}/peg/new`);
  const root = app(); const st = pegDraft;
  root.innerHTML = `<div class="screen">
    <div class="strip"><button class="back" id="pback" aria-label="Back" style="font-size:28px;padding:0 8px">‹</button><div class="st-l"><div class="st1"><span id="st1"></span> <span class="tag blue">PEG</span></div><div class="st2" id="st2"></div></div></div>
    <div class="entry-mid"><div class="rodcol"><svg id="rod" role="img" aria-label="Level rod"></svg></div><div class="panel" id="panel"></div></div>
    <div class="keypad" id="keypad">
      <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="fn" data-k="back" aria-label="Backspace">⌫</button>
      <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="confirm" data-k="ok" id="confirm">CONFIRM</button>
      <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
      <button data-k=".">.</button><button data-k="0">0</button><button class="fn" data-k="clr">CLR</button><button class="fn" data-k="next">NEXT ↓</button>
    </div></div>`;
  $('#pback').onclick = async () => { if (st.a1 || st.b1 || st.a2 || st.b2) { if (!(await confirmDialog({ title: 'Discard peg test?', text: 'The readings you entered will be lost.', ok: 'Discard', danger: true }))) return; } pegDraft = null; go(`#/j/${job.id}/peg`); };
  rodView = new RodView($('#rod'));
  const fields = () => (st.step === 1 ? ['a1', 'b1'] : ['a2', 'b2']);
  const key = (k) => {
    const f = st.active;
    if (k === 'ok') return pegConfirm(job);
    if (k === 'next') { const fs = fields(); st.active = fs[(fs.indexOf(f) + 1) % 2]; return drawPeg(job); }
    if (k === 'clr') { st[f] = ''; return drawPeg(job); }
    if (k === 'back') { st[f] = st[f].slice(0, -1); return drawPeg(job); }
    let v = st[f];
    if (k === '.') { if (v.includes('.')) return; v = (v || '0') + '.'; }
    else { const [ip, dp] = v.split('.'); if (dp == null && (ip || '').replace(/^0/, '').length >= 2) return; if (dp != null && dp.length >= 3) return; v = v === '0' ? k : v + k; }
    st[f] = v;
    if (/\.\d{3}$/.test(v) && f === fields()[0] && !st[fields()[1]]) st.active = fields()[1]; // auto-advance A → B
    drawPeg(job);
  };
  $$('#keypad button').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
  window.onresize = () => rodView && rodView.draw();
  drawPeg(job);
}
const pegFields = () => (pegDraft.step === 1 ? ['a1', 'b1'] : ['a2', 'b2']);
const pnum = (x) => (x === '' || x === '.' || x == null ? null : parseFloat(x));
function pegDraftTest() { const st = pegDraft; return { ...st.test, a1: pnum(st.a1), b1: pnum(st.b1), a2: pnum(st.a2), b2: pnum(st.b2) }; }
function drawPeg(job) {
  const st = pegDraft; const t = st.test; const L = t.rodLength || 16; const ev = pegEval(pegDraftTest());
  const errOf = (k) => { const e = C.readingError(pnum(st[k]), L); return e ? (e === 'over' ? `over rod length (${L} ft)` : 'below zero') : null; };
  const dA = st.step === 1 ? t.spacing / 2 : t.dA2, dB = st.step === 1 ? t.spacing / 2 : t.dB2;
  $('#st1').textContent = st.step === 1 ? 'PEG TEST · SETUP 1 · MIDWAY' : 'PEG TEST · SETUP 2 · NEAR A';
  $('#st2').innerHTML = `<small>→A</small> ${dA.toFixed(1)} <small>→B</small> ${dB.toFixed(1)} <small>ft</small>`;
  const rbox = (k, label) => { const bad = errOf(k); return `<div class="rbox w3${st.active === k ? ' active' : ''}${bad ? ' bad' : ''}" data-f="${k}" role="textbox" aria-label="${label}"><span class="lab">${label}</span><span class="val">${st[k] ? esc(st[k]) : '<span class="ph">–.–––</span>'}</span></div>`; };
  const d1 = st.a1 && st.b1 ? C.round(pnum(st.a1) - pnum(st.b1), 3) : null; const d2 = st.a2 && st.b2 ? C.round(pnum(st.a2) - pnum(st.b2), 3) : null;
  const errs = pegFields().map(errOf).filter(Boolean);
  const p = $('#panel');
  p.innerHTML = `<div class="seg" id="pstep"><button data-v="1" aria-pressed="${st.step === 1}">Setup 1</button><button data-v="2" aria-pressed="${st.step === 2}" ${st.a1 && st.b1 && d1 != null ? '' : 'disabled style="opacity:.35"'}>Setup 2</button></div>
    ${st.step === 1 ? `${rbox('a1', 'ROD A · a1')}${rbox('b1', 'ROD B · b1')}` : `${rbox('a2', 'ROD A · a2')}${rbox('b2', 'ROD B · b2')}`}
    <div class="rescard">${st.step === 1 ? `<div class="result"><span class="lbl">TRUE a1−b1 </span>${d1 != null ? sgn(d1) : '—'}</div>`
      : `<div class="result" style="font-size:16px"><span class="lbl">TRUE a1−b1 </span>${sgn(d1)}</div><div class="result" style="font-size:16px"><span class="lbl">APP. a2−b2 </span>${d2 != null ? sgn(d2) : '—'}</div><div class="result ${ev.ok && !ev.pass ? 'bad' : ''}"><span class="lbl">C </span>${ev.ok ? C.pegLabel(ev.per100) + '<span class="lbl"> ft/100 ft</span>' : '—'}</div>`}</div>
    ${errs.map((e) => `<div class="msg err">✕ Reading ${esc(e)}</div>`).join('')}
    ${st.step === 2 && ev.error && ev.error !== 'incomplete' ? `<div class="msg err">✕ ${esc(ev.error)}</div>` : ''}
    ${st.step === 2 && ev.ok ? `<div class="msg ${ev.pass ? '' : 'warn'}" style="${ev.pass ? 'color:var(--pass)' : ''}">${ev.pass ? '✔ Within' : '⚠ Over'} ±${ev.tol} ft/100 ft</div>` : ''}
    <div class="msg" style="font-weight:400;color:var(--muted)" ${st.step === 2 && ev.ok ? 'hidden' : ''}>${st.step === 1 ? 'Level midway between the pegs – equal sights cancel the error.' : 'Move the level near peg A. Read A, then the far rod on B.'}</div>`;
  $$('#pstep button').forEach((b) => (b.onclick = () => { const n = Number(b.dataset.v); if (n === 2 && !(st.a1 && st.b1)) return; st.step = n; st.active = n === 1 ? 'a1' : 'a2'; drawPeg(job); }));
  $$('.rbox', p).forEach((b) => (b.onclick = () => { st.active = b.dataset.f; drawPeg(job); }));
  const complete = pegFields().every((k) => pnum(st[k]) != null && !errOf(k)) && (st.step === 1 || ev.ok);
  $('#confirm').disabled = !complete; $('#confirm').textContent = st.step === 1 ? 'NEXT SETUP' : 'SAVE';
  // Rod shows the active reading; while it is still empty, the other reading of this setup stays on the rod.
  const shown = pnum(st[st.active]) != null ? st.active : pegFields().find((k) => pnum(st[k]) != null) || st.active;
  const v = pnum(st[shown]); const bad = !!errOf(shown);
  const center = v != null && !isNaN(v) ? v : rodView.cur ? rodView.cur.c : 5;
  const wires = v != null && !isNaN(v) ? [{ v, main: true, active: shown === st.active, error: bad, impossible: bad, label: st[shown], sub: bad ? (v > L ? '> ROD' : '< 0') : null }] : [];
  rodView.set({ center: Math.max(0.15, Math.min(L - 0.15, center)), ppf: 800, rodLength: L, wires, mean: null, dim: bad, three: false, instant: !rodView.cur });
}
function pegConfirm(job) {
  const st = pegDraft; if ($('#confirm').disabled) return;
  if (st.step === 1) { st.step = 2; st.active = 'a2'; toast('Setup 1 saved – move the level near peg A'); return drawPeg(job); }
  const t = { ...pegDraftTest(), tol: db.prefs.pegTol || C.PEG_TOL_DEFAULT }; db.pegTests.push(t); save(); pegDraft = null;
  go(`#/j/${job.id}/peg/${t.id}`);
}
function pegResultScreen(job, t) {
  const root = app(); const p = pegEval(t); const latest = C.latestPeg(db.pegTests);
  const users = db.jobs.flatMap((j) => j.surveys.filter((s) => s.peg?.test?.id === t.id).map((s) => `${j.name} – ${s.name}`));
  const verdict = !p.ok ? ['na', 'INCOMPLETE', I.x] : p.pass ? ['pass', 'PASS', I.ok] : ['fail', 'ADJUST', I.x];
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}/peg`, label: 'Peg tests' }, title: `Peg Test · ${R.usDate(t.date)}`, right: sysIcons() })}
    <div class="scroll">
      <div class="big ${verdict[0]}" role="status">${verdict[2]}<div><div class="bw">${verdict[1]}</div><div class="mono" style="font-size:20px;font-weight:800">C ${C.pegLabel(p.per100)} ft/100 ft</div><div>tolerance ±${p.tol} ft/100 ft${t.id === latest?.id ? ' · LATEST' : ''}</div></div></div>
      ${t.sample ? '<div class="banner"><span><b>SAMPLE</b> peg test – shoot your own before applying it to real work.</span></div>' : ''}
      <div class="section-label">Collimation error</div>
      <div class="card kv">
        <span class="k">C per 100 ft</span><span class="v">${C.pegLabel(p.per100)} ft</span>
        <span class="k">C per foot</span><span class="v">${p.C == null ? '—' : (p.C >= 0 ? '+' : '−') + Math.abs(p.C).toFixed(6)}</span>
        <span class="k">Angle</span><span class="v">${p.arcsec == null ? '—' : (p.arcsec >= 0 ? '+' : '−') + Math.abs(p.arcsec).toFixed(1) + '″'}</span>
        <span class="k">Error, 100 ft sight</span><span class="v">${C.pegLabel(p.per100)} ft</span>
        <span class="k">Error, 300 ft sight</span><span class="v">${p.C == null ? '—' : C.pegLabel(C.round(p.C * 300, 4))} ft</span>
        <span class="k">Line of sight</span><span class="v" style="font-family:var(--sans)">${p.C > 0 ? 'inclined UP' : p.C < 0 ? 'inclined DOWN' : 'level'}</span>
      </div>
      <div class="section-label">Setup 1 · midway (${(p.dA1).toFixed(1)} / ${(p.dB1).toFixed(1)} ft)</div>
      <div class="card kv"><span class="k">Rod A · a1</span><span class="v">${C.f3(t.a1)}</span><span class="k">Rod B · b1</span><span class="v">${C.f3(t.b1)}</span><span class="k">True diff a1 − b1</span><span class="v">${sgn(p.diff1)}</span></div>
      <div class="section-label">Setup 2 · near A (${C.round(p.dA2, 1)} / ${C.round(p.dB2, 1)} ft)</div>
      <div class="card kv"><span class="k">Rod A · a2</span><span class="v">${C.f3(t.a2)}</span><span class="k">Rod B · b2</span><span class="v">${C.f3(t.b2)}</span><span class="k">Apparent a2 − b2</span><span class="v">${sgn(p.diff2)}</span>
        <span class="k">Rod B should read</span><span class="v">${C.f3(p.bShould)}</span></div>
      <div class="msg" style="font-weight:400;color:var(--muted);margin:8px 4px;line-height:1.4">C = [(a2 − b2) − (a1 − b1)] ÷ (dA − dB). C &gt; 0: line of sight inclined up, readings too high. Corrected reading = reading − C × sight distance. Curvature &amp; refraction neglected.</div>
      <div class="section-label">Details</div>
      <div class="card kv" style="font-size:15px"><span class="k">Instrument</span><span class="v" style="font-family:var(--sans)">${esc(t.instrument || '—')}</span><span class="k">Observer</span><span class="v" style="font-family:var(--sans)">${esc(t.observer || '—')}</span><span class="k">Peg spacing</span><span class="v">${C.round(t.spacing, 1)} ft</span><span class="k">Shot on job</span><span class="v" style="font-family:var(--sans)">${esc(t.jobName || (t.sample ? 'Sample' : '—'))}</span><span class="k">Used by</span><span class="v" style="font-family:var(--sans)">${users.length ? users.length + ' survey' + (users.length > 1 ? 's' : '') : 'none yet'}</span></div>
    </div>
    <div class="pinned"><div class="row2"><button class="btn danger" id="pdel">DELETE</button><button class="btn primary" id="pdone">DONE ▶</button></div></div></div>`;
  bindCommon(root);
  $('#pdone').onclick = () => go(`#/j/${job.id}`);
  $('#pdel').onclick = async () => {
    if (!(await confirmDialog({ title: 'Delete peg test?', text: `Delete the ${R.usDate(t.date)} peg test? Surveys that used it keep their own copy.`, ok: 'Delete', danger: true }))) return;
    db.pegTests = db.pegTests.filter((x) => x !== t); save(); go(`#/j/${job.id}/peg`); toast('Peg test deleted');
  };
}

function toggleDist(job, s, rerender) {
  s.useDist = !C.usesDist(s); touch(job, s);
  toast(s.useDist ? 'Distances ON – whole survey recalculated' : 'Distances OFF – whole survey recalculated');
  rerender();
}
// ---------- Stake out (DRAFT UI) ----------
let stakeSt = null;
const stakeSetups = (s) => s.readings.filter((r) => r.type === 'BS');
const stakeHI = (s, setupIdx) => C.stakeSurvey(s).setups[setupIdx]?.hi ?? null;
const stakeActual = (s, k) => C.corrected(k.value, C.usesDist(s) ? k.dist ?? null : null, C.pegFor(s)).v;
const cfText = (st) => (st.kind == null ? '—' : st.kind === 'ON GRADE' ? 'ON GRADE' : `${st.kind} ${Math.abs(st.cf).toFixed(2)}`);
function stakeScreen(job, s) {
  if (job.archived) return go(`#/j/${job.id}/s/${s.id}/book`);
  const setups = stakeSetups(s).length;
  if (!stakeSt || stakeSt.sid !== s.id) stakeSt = { sid: s.id, mode: setups ? 'stake' : 'bs', active: setups ? 'design' : 'reading', reading: '', dist: '', design: '', point: nextStakeName(s) };
  const root = app();
  root.innerHTML = `<div class="screen">
    <div class="strip"><button class="back" id="toBook" aria-label="Back to stake sheet" style="font-size:28px;padding:0 8px">‹</button><div class="st-l"><div class="st1"><span id="st1"></span> <span class="tag blue">STAKE</span></div><div class="st2" id="st2"></div></div><button class="iconbtn" id="bookBtn" aria-label="Stake sheet">${I.book}</button></div>
    <div class="entry-mid"><div class="rodcol"><svg id="rod" role="img" aria-label="Level rod"></svg></div><div class="panel" id="panel"></div></div>
    <div class="keypad" id="keypad">
      <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="fn" data-k="back" aria-label="Backspace">⌫</button>
      <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="confirm" data-k="ok" id="confirm">CONFIRM</button>
      <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
      <button data-k=".">.</button><button data-k="0">0</button><button class="fn" data-k="clr">CLR</button><button class="fn" data-k="next">NEXT ↓</button>
    </div></div>`;
  $('#toBook').onclick = $('#bookBtn').onclick = () => { stakeSt = null; go(`#/j/${job.id}/s/${s.id}/book`); };
  rodView = new RodView($('#rod'));
  const key = (k) => {
    const st = stakeSt; const f = st.active;
    if (k === 'ok') return stakeConfirm(job, s);
    if (k === 'next') { const order = (st.mode === 'bs' ? ['reading', 'dist'] : ['design', 'reading', 'dist']).filter((x) => x !== 'dist' || C.usesDist(s)); st.active = order[(order.indexOf(f) + 1) % order.length]; return drawStake(job, s); }
    if (k === 'clr') { st[f] = ''; return drawStake(job, s); }
    if (k === 'back') { st[f] = st[f].slice(0, -1); return drawStake(job, s); }
    let v = st[f];
    if (k === '.') { if (v.includes('.')) return; v = (v || '0') + '.'; }
    else {
      const [ip, dp] = v.split('.'); const maxInt = f === 'dist' || f === 'design' ? 4 : 2; const maxDec = f === 'dist' ? 1 : 3;
      if (dp == null && (ip || '').replace(/^0/, '').length >= maxInt) return; if (dp != null && dp.length >= maxDec) return; v = v === '0' ? k : v + k;
    }
    st[f] = v;
    if (f === 'design' && /\.\d{3}$/.test(v)) st.active = 'reading';
    drawStake(job, s);
  };
  $$('#keypad button').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
  window.onresize = () => rodView && rodView.draw();
  drawStake(job, s);
}
function nextStakeName(s) { let n = (s.stakes || []).length + 1; const names = new Set((s.stakes || []).map((k) => k.point)); while (names.has(`STK${n}`)) n++; return `STK${n}`; }
function drawStake(job, s) {
  const st = stakeSt; const L = s.rodLength || 16; const peg = C.pegFor(s);
  const num = (x) => (x === '' || x === '.' ? null : parseFloat(x));
  const useD = C.usesDist(s); const reading = num(st.reading), dist = useD ? num(st.dist) : null, design = num(st.design);
  const dRow = distRow(useD, { compact: true, note: useD ? '' : peg ? 'Peg off – no distance' : 'No DIST · read as is' });
  const rErr = C.readingError(reading, L);
  const rbox = (k, label, cls = '') => { const bad = (k === 'reading' && rErr) || (k === 'design' && st.calc?.out); return `<div class="rbox ${cls}${st.active === k ? ' active' : ''}${bad ? ' bad' : ''}" data-f="${k}" role="textbox" aria-label="${label}"><span class="lab">${label}</span><span class="val">${st[k] ? esc(st[k]) : '<span class="ph">–.––</span>'}</span></div>`; };
  const p = $('#panel'); let ok = false;
  if (st.mode === 'bs') {
    const pc = C.corrected(reading, dist, peg); const hi = reading != null && !rErr ? C.round(Number(s.startBM.elev) + pc.v, 3) : null;
    $('#st1').textContent = `BACKSIGHT · ${s.startBM.name} ${C.f3(Number(s.startBM.elev))}`;
    $('#st2').innerHTML = `<small>HI</small> ${hi != null ? C.f3(hi) : '—'}`;
    p.innerHTML = `<div class="minilabel">Backsight on benchmark</div><div class="ptrow"><input class="input" value="${esc(s.startBM.name)}" readonly aria-label="Benchmark"></div>
      ${rbox('reading', 'BS READING')}${useD ? rbox('dist', 'DIST ft', 'small') : ''}${dRow}
      <div class="result ${rErr ? 'bad' : ''}"><span class="lbl">HI </span>${hi != null ? C.f3(hi) : '—'}</div>
      ${rErr ? `<div class="msg err">✕ Reading ${rErr === 'over' ? `over rod length (${L} ft)` : 'below zero'}</div>` : ''}
      ${peg && pc.corr != null ? `<div class="msg pegmsg">Peg ${sgn(pc.corr)} → ${pc.v.toFixed(3)}</div>` : ''}
      <div class="msg" style="font-weight:400;color:var(--muted)">HI = BM elevation + backsight. Then set grade stakes from this setup.</div>`;
    ok = reading != null && !rErr;
    const wires = reading != null ? [{ v: reading, main: true, active: true, error: !!rErr, impossible: !!rErr, label: st.reading, sub: rErr ? (rErr === 'over' ? '> ROD' : '< 0') : null }] : [];
    rodView.set({ center: Math.max(0.15, Math.min(L - 0.15, reading ?? rodView.cur?.c ?? 5)), ppf: 800, rodLength: L, wires, dim: !!rErr, three: false, instant: !rodView.cur });
  } else {
    const setupIdx = stakeSetups(s).length - 1; const hi = stakeHI(s, setupIdx);
    const pc = C.corrected(reading, dist, peg);
    const calc = (st.calc = C.stakeCalc(hi, design, reading != null && !rErr ? pc.v : null, L));
    $('#st1').textContent = `STAKE OUT · SETUP ${setupIdx + 1} · ${s.startBM.name}`;
    $('#st2').innerHTML = `<small>HI</small> ${C.f3(hi)} <small>TGT</small> ${calc.target != null ? calc.target.toFixed(2) : '—'}${calc.kind ? ` <span class="stcf ${calc.kind === 'CUT' ? 'cut' : calc.kind === 'FILL' ? 'fill' : 'grade'}">${calc.kind === 'ON GRADE' ? 'ON GRADE' : `${calc.kind[0]} ${Math.abs(calc.cf).toFixed(2)}`}</span>` : ''}`;
    const cfCls = calc.kind === 'CUT' ? 'cut' : calc.kind === 'FILL' ? 'fill' : calc.kind ? 'grade' : '';
    p.innerHTML = `<div class="ptrow"><input class="input" id="spt" value="${esc(st.point)}" aria-label="Stake name" autocomplete="off" autocapitalize="characters"></div>
      ${rbox('design', 'DESIGN ELEV', 'w3')}
      <div class="tgtline ${calc.out ? 'bad' : ''}"><span class="lbl">TARGET ROD</span><b>${calc.target != null ? C.f3(calc.target) : '—'}</b></div>
      ${calc.out ? `<div class="msg err">✕ ${calc.out === 'above' ? `Grade is ${Math.abs(calc.target).toFixed(2)} ft above the line of sight – raise the instrument or set an offset` : `Target ${calc.target.toFixed(2)} ft is past the ${L} ft rod – set up lower or use an offset stake`}</div>` : ''}
      ${rbox('reading', 'ACTUAL ROD', 'w3')}
      <div class="cfbox ${cfCls}" id="cf" ${calc.kind ? '' : 'hidden'}>${cfText(calc)}<small>ft</small></div>
      ${useD ? rbox('dist', 'DIST ft', 'small') : ''}${dRow}
      <div class="result"><span class="lbl">GROUND </span>${calc.ground != null ? C.f3(calc.ground) : '—'}</div>
      ${rErr ? `<div class="msg err">✕ Reading ${rErr === 'over' ? `over rod length (${L} ft)` : 'below zero'}</div>` : ''}
      ${peg && pc.corr != null ? `<div class="msg pegmsg">Peg ${sgn(pc.corr)} → ${pc.v.toFixed(3)}</div>` : ''}`;
    $('#spt').oninput = (e) => { st.point = e.target.value.toUpperCase(); e.target.value = st.point; };
    ok = design != null && reading != null && !rErr && st.point.trim() !== '';
    // rod: target marker + actual crosshair
    const tv = calc.target; const tIn = tv != null && !calc.out;
    const wires = reading != null ? [{ v: reading, main: true, active: st.active === 'reading', error: !!rErr, impossible: !!rErr, label: st.reading, sub: rErr ? (rErr === 'over' ? '> ROD' : '< 0') : null }] : [];
    const target = tv != null ? { v: Math.max(0, Math.min(L, tv)), label: calc.out ? (calc.out === 'above' ? '↑ TGT' : '↓ TGT') : tv.toFixed(2), sub: calc.out ? 'OFF ROD' : null, error: !!calc.out } : null;
    const pts = [tIn ? tv : null, reading != null && !rErr ? reading : null].filter((x) => x != null);
    const H = $('#rod').clientHeight || 380; const span = pts.length > 1 ? Math.abs(pts[0] - pts[1]) : 0;
    const center = pts.length ? (Math.max(...pts) + Math.min(...pts)) / 2 : target ? target.v : rodView.cur?.c ?? 5;
    rodView.set({ center: Math.max(0.15, Math.min(L - 0.15, center)), ppf: Math.min(800, Math.max(40, (H * 0.8) / (span + 0.25))), rodLength: L, wires, target, dim: !!calc.out || !!rErr, three: false, instant: !rodView.cur });
  }
  $$('.rbox', p).forEach((b) => (b.onclick = () => { st.active = b.dataset.f; drawStake(job, s); }));
  $('#distSw', p).onclick = () => toggleDist(job, s, () => { if (!C.usesDist(s) && st.active === 'dist') st.active = 'reading'; drawStake(job, s); });
  $('#confirm').disabled = !ok; $('#confirm').textContent = st.mode === 'bs' ? 'SET HI' : 'SAVE STAKE';
}
function stakeConfirm(job, s) {
  const st = stakeSt; if ($('#confirm').disabled) return;
  const num = (x) => (x === '' || x === '.' ? null : parseFloat(x));
  if (st.mode === 'bs') {
    s.readings.push({ id: uid(), type: 'BS', point: s.startBM.name, value: num(st.reading), text: st.reading, ...(C.usesDist(s) && num(st.dist) != null ? { dist: num(st.dist) } : {}) });
    touch(job, s); Object.assign(st, { mode: 'stake', active: 'design', reading: '', dist: '' }); toast(`HI ${C.f3(stakeHI(s, stakeSetups(s).length - 1))} set`); return drawStake(job, s);
  }
  const k = { id: uid(), point: st.point.trim().toUpperCase(), design: num(st.design), value: num(st.reading), text: st.reading, setup: stakeSetups(s).length - 1, ...(C.usesDist(s) && num(st.dist) != null ? { dist: num(st.dist) } : {}) };
  (s.stakes = s.stakes || []).push(k); touch(job, s);
  const c = C.stakeCalc(stakeHI(s, k.setup), k.design, stakeActual(s, k), s.rodLength);
  toast(`${k.point} · ${cfText(c)}`);
  Object.assign(st, { design: '', reading: '', dist: '', active: 'design', point: nextStakeName(s) }); drawStake(job, s);
}
function stakeSheetScreen(job, s) {
  const ro = job.archived; const root = app(); const L = s.rodLength || 16;
  const setups = stakeSetups(s);
  const ss = C.stakeSurvey(s); const rows = ss.rows.map((c, i) => ({ k: s.stakes[i], c }));
  root.innerHTML = `<div class="screen">${topbar({ back: { href: `#/j/${job.id}`, label: 'Job' }, title: s.name, right: `<span class="tag">STAKE</span><button class="iconbtn" id="shareBtn" aria-label="Share stake sheet">${I.share}</button>` })}
    <div class="booktools"><div class="msg mono" style="font-size:15px">${setups.map((b, i) => `Setup ${i + 1}: BS ${esc(s.startBM.name)} ${C.fmtReading(b.value, b.text)} → HI <b>${C.f3(stakeHI(s, i))}</b>`).join('<br>') || 'No backsight yet'}</div></div>
    <div class="tablewrap"><table class="book stake"><thead><tr><th>STAKE</th><th>DESIGN</th><th>TGT</th><th>ROD</th><th>CUT/FILL</th></tr></thead><tbody>
      ${rows.map(({ k, c }) => `<tr><td>${esc(k.point)}</td><td>${C.f3(k.design)}</td><td>${C.f3(c.target)}</td><td>${C.fmtReading(k.value, k.text)}</td><td><span class="cf ${c.kind === 'CUT' ? 'cut' : c.kind === 'FILL' ? 'fill' : 'grade'}">${C.cfShort(c)}</span>${c.out ? ' <span class="wf" title="Target off the rod">⚠</span>' : ''}</td></tr>`).join('')}
    </tbody></table>${rows.length ? '' : '<div class="empty">No stakes yet. Tap + NEXT STAKE.</div>'}</div>
    <div class="summary"><div>${rows.length} stake${rows.length === 1 ? '' : 's'} · ${rows.filter((r) => r.c.kind === 'CUT').length} cut · ${rows.filter((r) => r.c.kind === 'FILL').length} fill · ground = HI − rod</div><div>Cut/fill = ground − design · rod ${L} ft · distances ${ss.distUsed ? 'used' : 'not used'}${ss.peg ? ` · peg ${C.pegLabel(ss.peg.per100)}` : ''}</div></div>
    <div class="pinned">${ro ? '<div class="msg" style="color:var(--muted);text-align:center">Archived job – read-only</div>' : `<button class="btn primary block" id="nextStake">＋ NEXT STAKE</button>
      <div class="row2"><button class="btn" id="newBS">NEW SETUP (BS)</button><button class="btn blue" id="finish">FINISH ▶</button></div>`}</div></div>`;
  bindCommon(root);
  $('#shareBtn').onclick = () => go(`#/j/${job.id}/s/${s.id}/share`);
  if (!ro) {
    $('#nextStake').onclick = () => { stakeSt = null; go(`#/j/${job.id}/s/${s.id}/entry`); };
    $('#newBS').onclick = () => { stakeSt = { sid: s.id, mode: 'bs', active: 'reading', reading: '', dist: '', design: '', point: nextStakeName(s) }; go(`#/j/${job.id}/s/${s.id}/entry`); };
    $('#finish').onclick = () => { s.closed = true; touch(job, s); go(`#/j/${job.id}/s/${s.id}/share`); };
  }
}

// ---------- settings ----------
async function openSettings() {
  let persisted = null; try { persisted = await navigator.storage?.persisted?.(); } catch (e) {}
  const s = sheet('Settings', `
    <div class="section-label">Theme</div><div class="seg" id="thm"><button data-v="sunlight" aria-pressed="${db.prefs.theme !== 'dusk'}">☀ Sunlight</button><button data-v="dusk" aria-pressed="${db.prefs.theme === 'dusk'}">☾ Dusk</button></div>
    <div class="section-label">Distances</div>
    ${distRow(db.prefs.useDist, { id: 'prefDist', note: 'Default for new surveys. Each survey can still switch it.' })}
    <div class="section-label">Peg test</div>
    <label class="field"><span>Collimation tolerance (ft per 100 ft)</span><div class="suffix" data-suffix="ft"><input class="input num" id="pegTol" inputmode="decimal" value="${db.prefs.pegTol}"></div></label>
    <div class="msg" style="font-weight:400;color:var(--muted);margin:-8px 0 8px">Default ${C.PEG_TOL_DEFAULT} ft/100 ft (≈10″). A peg test outside this fails – adjust the level’s reticle.</div>
    <div class="section-label">Backup</div>
    <button class="listbtn" id="exp">⬇ Export backup (JSON)</button>
    <label class="listbtn" style="cursor:pointer">⬆ Import backup (JSON)<input type="file" id="imp" accept="application/json,.json" class="sr"></label>
    <button class="listbtn" id="persist">🔒 Keep data on this device ${persisted ? '(granted)' : persisted === false ? '(not granted)' : ''}</button>
    <button class="listbtn" id="sample">＋ Add sample job again</button>
    <div class="section-label">Field trial</div>
    <button class="listbtn" id="fbOpen">${I.chat.replace('<svg', '<svg width="22" height="22"')} Send feedback</button>
    <button class="listbtn" id="wlOpen">ⓘ Show welcome card</button>
    <div class="section-label">About</div>
    <div class="msg" style="font-weight:400;color:var(--muted);line-height:1.5">Level Book v${R.APP_VERSION} (field trial) · US survey decimal feet · works offline.<br>${isIOS && !isStandalone() ? 'Install: Safari → Share → Add to Home Screen.<br>' : ''}Data is stored only on this device. Safari can clear data for sites not added to the Home Screen after ~7 days unused – export backups regularly.<br>Storage: ${persisted ? 'persistent' : 'best-effort'} · ${isStandalone() ? 'installed app' : 'browser tab'}</div>`);
  $('#fbOpen', s.el).onclick = () => { s.close(); openFeedback(); };
  $('#wlOpen', s.el).onclick = () => { s.close(); welcomeCard(); };
  $('#prefDist', s.el).onclick = () => { db.prefs.useDist = !db.prefs.useDist; save(); setSwitch($('#prefDist', s.el), db.prefs.useDist); toast(`New surveys: distances ${db.prefs.useDist ? 'ON' : 'OFF'}`); };
  $('#pegTol', s.el).onchange = (e) => { const v = parseFloat(e.target.value); if (v > 0 && v < 1) { db.prefs.pegTol = v; save(); toast(`Peg tolerance ${v} ft/100 ft`); } else { e.target.value = db.prefs.pegTol; toast('Enter a value like 0.005'); } };
  $$('#thm button', s.el).forEach((b) => (b.onclick = () => { db.prefs.theme = b.dataset.v; save(); applyTheme(); $$('#thm button', s.el).forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  $('#exp', s.el).onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'levelbook', version: R.APP_VERSION, exported: new Date().toISOString(), data: db }, null, 1)], { type: 'application/json' });
    const name = `LevelBook-backup-${todayISO()}.json`; const file = new File([blob], name, { type: 'application/json' });
    if (!N() && isIOS && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: name }).catch((e) => { if (e.name !== 'AbortError') downloadBlob(blob, name); });
    else downloadBlob(blob, name);
  };
  $('#imp', s.el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const data = j.data || j; if (!Array.isArray(data.jobs)) throw new Error('no jobs in file');
      const ok = await confirmDialog({ title: 'Import backup?', text: `Merge ${data.jobs.length} job(s) from ${f.name}. Jobs with the same ID are replaced.`, ok: 'Import' });
      if (!ok) return;
      data.jobs.forEach((nj) => { const i = db.jobs.findIndex((x) => x.id === nj.id); if (i >= 0) db.jobs[i] = nj; else db.jobs.push(nj); });
      (data.pegTests || []).forEach((t) => { const i = db.pegTests.findIndex((x) => x.id === t.id); if (i >= 0) db.pegTests[i] = t; else db.pegTests.push(t); });
      save(); render(); toast(`Imported ${data.jobs.length} job(s)`);
    } catch (err) { toast('Import failed: ' + err.message); }
  };
  $('#persist', s.el).onclick = async () => { let r = false; try { r = await navigator.storage?.persist?.(); } catch (e) {} toast(r ? 'Storage marked persistent' : 'Browser declined – export backups regularly'); };
  $('#sample', s.el).onclick = () => { db.jobs.push(...seedJobs()); if (!db.pegTests.some((t) => t.sample)) db.pegTests.push(...seedPegTests()); save(); s.close(); go('#/'); };
}

// ---------- boot ----------
async function boot() {
  if (N()) { try { if (!localStorage.getItem(KEY)) { const v = await N().restore(); if (v) { localStorage.setItem(KEY, v); toast('Restored from on-device backup'); } } } catch (e) { console.warn('restore', e); } }
  load(); applyTheme(); render();
  if (N()) {
    N().hideSplash();
    document.addEventListener('click', (e) => { if (e.target.closest('.keypad button, .btn.primary, .modecard, .seg button')) N().tap(); }, true);
  } else {
    try { navigator.storage?.persisted?.().then((p) => { if (!p) return navigator.storage.persist?.(); }).catch(() => {}); } catch (e) {}
    // Service worker only for the browser/PWA build; never inside the Capacitor native shell.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.LB_NO_SW && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  }
}
boot();
window.__lb = { db: () => db, C, R };
