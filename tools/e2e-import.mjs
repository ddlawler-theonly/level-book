// Report import + three-wire running distance totals, end to end.
// node tools/e2e-import.mjs chromium|webkit   (preview on LB_BASE, live v1.3.0 copy on LB_OLD for an "older PDF")
import { chromium, webkit, devices } from 'playwright';
import { execSync } from 'node:child_process';
const BASE = process.env.LB_BASE || 'http://127.0.0.1:8796/';
const OLD = process.env.LB_OLD || 'http://127.0.0.1:8797/';
const OUT = process.env.LB_OUT || '/workspace/preview-shots/e2e/';
const which = process.argv[2] || 'chromium';
const results = []; const errors = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra && !cond ? ' – ' + extra : ''}`);
process.on('exit', () => { console.log(results.join('\n') + '\nERRORS: ' + errors.join(' | ')); });
const browser = which === 'webkit' ? await webkit.launch() : await chromium.launch();
const mk = async () => { const ctx = await browser.newContext(which === 'webkit' ? { ...devices['iPhone 15'], timezoneId: 'America/Chicago', acceptDownloads: true } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('lb.dev.ent', 'pro'); } catch (e) {} }); const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); return page; };
const P = (n) => `${OUT}${which}-${n}`;
const helpers = (page) => ({
  tap: async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(120); },
  keys: async (s) => { for (const ch of s) { await page.locator(`#keypad button[data-k="${ch}"]`).click(); await page.waitForTimeout(40); } },
  shot: async (n) => { await page.waitForTimeout(350); await page.evaluate(() => document.querySelectorAll('.snackbar').forEach((x) => x.remove())); await page.screenshot({ path: P(n) + '.png' }); },
});
async function start(page, base) { await page.goto(base); await page.waitForSelector('.jobcard'); if (await page.locator('#wlGo').count()) await page.locator('#wlGo').click(); await page.waitForTimeout(200); }
async function openRun(page) { await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.recent'); await page.locator('.recent button', { hasText: 'Run 1' }).click(); await page.waitForSelector('table.book'); }
async function savePdf(page, path) {
  const { tap } = helpers(page);
  await tap('#shareBtn'); await page.waitForSelector('.paper');
  await page.locator('#fmt button[data-v="pdf"]').click(); await page.locator('#inc input[data-k="threewire"]').check(); await page.waitForTimeout(200);
  const [dl] = await Promise.all([page.waitForEvent('download'), tap('#saveF')]); await dl.saveAs(path); return path;
}
const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.id; delete c.updated; delete c.imported; return c; };

// ---- 1. Older PDF from the live v1.3.0 app (no embedded data) ----
const oldPage = await mk(); await start(oldPage, OLD); await openRun(oldPage);
const oldPdf = await savePdf(oldPage, P('old-v130-report.pdf')); await oldPage.context().close();

// ---- 2. Preview: three-wire running totals ----
const page = await mk(); const { tap, keys, shot } = helpers(page);
await start(page, BASE); await openRun(page);
await tap('#next'); await page.waitForSelector('#keypad');
const dt = async () => (await page.locator('#distTot').innerText()).replace(/\s+/g, ' ');
let t = await dt(); ok('totals card on three-wire entry (seed BS 98.8 / FS 98.4)', /ΣBS 98\.8/.test(t) && /ΣFS 98\.4/.test(t) && /BAL \+0\.4/.test(t) && /TOTAL 197\.2/.test(t), t);
await keys('6.500'); t = await dt(); ok('live while typing: top wire alone does not count yet', /ΣBS 98\.8/.test(t), t);
await keys('6.000'); await keys('5.500'); t = await dt();
ok('live BS: ΣBS 198.8, BAL +100.4, TOTAL 297.2, setup open', /ΣBS 198\.8/.test(t) && /BAL \+100\.4/.test(t) && /TOTAL 297\.2/.test(t) && /setup open/i.test(t) && !/⚠/.test(t), t);
await tap('#confirm'); await page.waitForTimeout(300);
if (!(await page.locator('#keypad').count())) { await tap('#next'); await page.waitForSelector('#keypad'); }
await keys('4.900'); await keys('4.400'); await keys('3.895'); t = await dt();
ok('live FS: ΣFS 198.9, BAL −0.1, TOTAL 397.7, setup closed', /ΣFS 198\.9/.test(t) && /BAL −0\.1/.test(t) && /TOTAL 397\.7/.test(t) && !/setup open/i.test(t), t);
await page.locator('#panel').evaluate((e) => { const c = e.querySelector('#distTot'); e.scrollTop = c.offsetTop - 220; });
await shot('1-entry-running-totals');
// spread of the FS bottom wire is 0.005 > 0.003 -> accept anyway
if (await page.locator('#accept').count()) await tap('#accept');
await tap('#confirm'); await page.waitForTimeout(300);
await tap('#distSw'); await page.waitForTimeout(200); t = await dt(); ok('distance switch OFF: totals marked not used', /not used/i.test(t), t); await tap('#distSw'); await page.waitForTimeout(200);
await tap('#bookBtn'); await page.waitForSelector('table.book');
const orig = await page.evaluate(() => { const j = window.__lb.db().jobs.find((x) => x.name === 'Pearland Tellepson'); return { jobId: j.id, s: j.surveys.find((s) => s.name.startsWith('Run 1')) }; });
ok('run now has 4 readings', orig.s.readings.length === 4);

// ---- 3. Export the PDF and check it in poppler ----
const newPdf = await savePdf(page, P('preview-report.pdf'));
const txt = execSync(`pdftotext -layout "${newPdf}" -`).toString();
ok('PDF shows THREE-WIRE DISTANCE TOTALS table', /THREE-WIRE DISTANCE TOTALS/.test(txt) && /397\.7/.test(txt));
ok('embedded data is invisible (no LBDATA in page text)', !/LBDATA/.test(txt));
execSync(`pdftoppm -f 1 -l 1 -r 110 -png -singlefile "${newPdf}" "${P('3-pdf-page1')}"`);

// ---- 4. Import from the Jobs screen ----
await page.goto(BASE + '#/'); await page.waitForSelector('#impReport');
const nJobs = await page.evaluate(() => window.__lb.db().jobs.length);
let [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('#impReport')]); await chooser.setFiles(newPdf);
await page.waitForSelector('.dialog [data-ok]'); const dlgTxt = await page.locator('.dialog').textContent();
ok('import confirm lists the survey', /Import report\?/.test(dlgTxt) && /Run 1/.test(dlgTxt) && /4 readings/.test(dlgTxt), dlgTxt);
await shot('2-import-confirm');
await tap('.dialog [data-ok]'); await page.waitForSelector('.recent');
const imp = await page.evaluate(() => { const db = window.__lb.db(); const j = db.jobs[db.jobs.length - 1]; return { n: db.jobs.length, j, hash: location.hash }; });
ok('new job created and opened', imp.n === nJobs + 1 && imp.hash === `#/j/${imp.j.id}`);
ok('round trip: imported survey identical to original', JSON.stringify(strip(imp.j.surveys[0])) === JSON.stringify(strip(orig.s)));
const same = await page.evaluate(({ a, b }) => { const { C } = window.__lb; const f = (s) => JSON.stringify([C.computeSurvey(s), C.closure(s), C.distTotals(s)]); return f(a) === f(b); }, { a: imp.j.surveys[0], b: orig.s });
ok('round trip: same HI/elevations, closure, distance totals', same);
await page.waitForTimeout(400); await page.locator('.recent button[data-sid]').first().click(); await page.waitForSelector('table.book');
ok('imported survey opens in the book with all rows', (await page.locator('table.book tr').count()) >= 4);
// ---- 5. Import inside a job ----
await page.goto(BASE + `#/j/${orig.jobId}`); await page.waitForSelector('#impSurvey');
const nS = await page.evaluate((id) => window.__lb.db().jobs.find((j) => j.id === id).surveys.length, orig.jobId);
[chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('#impSurvey')]); await chooser.setFiles(newPdf);
await page.waitForSelector('.dialog [data-ok]'); ok('in-job import confirm', /Import into Pearland Tellepson\?/.test(await page.locator('.dialog').textContent()));
await tap('.dialog [data-ok]'); await page.waitForSelector('table.book');
const inJob = await page.evaluate((id) => window.__lb.db().jobs.find((j) => j.id === id).surveys, orig.jobId);
ok('in-job import adds the survey and opens its book', inJob.length === nS + 1 && JSON.stringify(strip(inJob.at(-1))) === JSON.stringify(strip(orig.s)) && inJob.at(-1).id !== orig.s.id);
// ---- 6. Older PDF / not a PDF ----
await page.goto(BASE + '#/'); await page.waitForSelector('#impReport');
[chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('#impReport')]); await chooser.setFiles(oldPdf);
await page.waitForSelector('.dialog [data-ok]'); const oldTxt = await page.locator('.dialog').textContent();
ok('older v1.3.0 PDF: friendly message', /No survey data in this PDF/.test(oldTxt) && /share a fresh PDF/.test(oldTxt), oldTxt);
await shot('4-import-old-pdf');
await tap('.dialog [data-ok]');
ok('nothing imported from the old PDF', (await page.evaluate(() => window.__lb.db().jobs.length)) === nJobs + 1);
[chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('#impReport')]); await chooser.setFiles(new URL('../icons/icon-192.png', import.meta.url).pathname);
await page.waitForSelector('.dialog [data-ok]'); ok('not a PDF: friendly message', /Not a PDF/.test(await page.locator('.dialog').textContent())); await tap('.dialog [data-ok]');
await shot('5-jobs-with-import-button');
await browser.close();
