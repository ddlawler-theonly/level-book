// Open level run (optional closing BM) + Pipe Slope calculator, end to end.
// node tools/e2e-openrun-pipe.mjs chromium|webkit   (preview on LB_BASE). chromium run also writes the preview screenshots.
import { chromium, webkit, devices } from 'playwright';
import { execSync } from 'node:child_process';
const BASE = process.env.LB_BASE || 'http://127.0.0.1:8796/';
const SHOTS = process.env.LB_SHOTS || '/workspace/preview-shots/';
const OUT = '/workspace/preview-shots/e2e/';
const which = process.argv[2] || 'chromium';
const results = []; const errors = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra && !cond ? ' – ' + extra : ''}`);
process.on('exit', () => { console.log(results.join('\n') + `\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed\nERRORS: ` + errors.join(' | ')); });
const browser = which === 'webkit' ? await webkit.launch() : await chromium.launch();
const ctx = await browser.newContext(which === 'webkit' ? { ...devices['iPhone 15'], timezoneId: 'America/Chicago', acceptDownloads: true } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', acceptDownloads: true });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('lb.dev.ent')) localStorage.setItem('lb.dev.ent', 'pro'); } catch (e) {} });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(120); };
const keys = async (s) => { for (const ch of s) { await page.locator(`#keypad button[data-k="${ch}"]`).click(); await page.waitForTimeout(30); } };
const clean = () => page.evaluate(() => document.querySelectorAll('.snackbar').forEach((x) => x.remove()));
const shot = async (path) => { await page.waitForTimeout(350); await clean(); await page.screenshot({ path }); };
const db = () => page.evaluate(() => window.__lb.db());
const text = async (sel) => (await page.locator(sel).innerText()).replace(/\s+/g, ' ');
const noNaN = async (what) => { const t = await page.locator('#app').innerText(); ok(`${what}: no NaN/undefined on screen`, !/NaN|undefined/.test(t), t.match(/.{0,40}(NaN|undefined).{0,40}/)?.[0]); };
const pearland = async () => { await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard'); await page.locator('.jobcard', { hasText: 'Pearland' }).first().click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard'); };
const shotOut = (n) => `${OUT}${which}-${n}.png`;

await page.goto(BASE); await page.waitForSelector('.jobcard'); if (await page.locator('#wlGo').count()) await tap('#wlGo');

// ---- 1. Setup: closing benchmark optional ----
await pearland();
ok('run card mentions set point', (await text('.modecard[data-mode="run"]')).includes('set point'));
await tap('.modecard[data-mode="run"]'); await page.waitForSelector('#sn');
ok('section labelled "Closing benchmark (optional)"', /closing benchmark \(optional\)/i.test(await page.locator('.section-label', { hasText: /closing/i }).innerText()));
await page.fill('#sn', 'Open run – SD line'); await page.fill('#bme', '100.000');
ok('START BOOK enabled with closing name + elevation blank', !(await page.locator('#start').isDisabled()));
await page.fill('#cbe', '101.5'); await page.waitForTimeout(100);
ok('elevation without a BM name: START disabled + inline hint', (await page.locator('#start').isDisabled()) && await page.locator('#cbErr').isVisible());
await page.fill('#cbe', ''); await page.waitForTimeout(100);
ok('cleared elevation: START enabled again, hint hidden', !(await page.locator('#start').isDisabled()) && !(await page.locator('#cbErr').isVisible()));
await page.locator('.section-label', { hasText: /closing/i }).scrollIntoViewIfNeeded(); await page.evaluate(() => { const l = [...document.querySelectorAll('.section-label')].find((x) => /closing/i.test(x.textContent)); const sc = document.querySelector('.scroll'); sc.scrollTop = l.offsetTop - 260; });
if (which === 'chromium') await shot(SHOTS + '4-optional-closing-setup.png'); else await shot(shotOut('optional-closing-setup'));
await tap('#start'); await page.waitForSelector('#keypad');
let s = (await db()).jobs.find((j) => j.name === 'Pearland Tellepson').surveys.find((x) => x.name === 'Open run – SD line');
ok('survey saved with closeBM elev null (open run)', s && s.closeBM.elev === null && s.closeBM.name === '');
ok('no "Close on" quick button in an open run', (await page.locator('#closeOn').count()) === 0);

// ---- 2. Readings: BS 5.31 → TP1 FS 4.53 → BS 6.02 → set point FS 3.10 ----
await keys('5.31'); await tap('#keypad [data-k="next"]'); await keys('150'); await tap('#confirm'); await page.waitForTimeout(300);
await keys('4.53'); await tap('#keypad [data-k="next"]'); await keys('145'); await tap('#confirm'); await page.waitForTimeout(300);
if (!(await page.locator('#keypad').count())) { await tap('#next'); await page.waitForSelector('#keypad'); }
await keys('6.02'); await tap('#keypad [data-k="next"]'); await keys('160'); await tap('#confirm'); await page.waitForTimeout(300);
await keys('3.10'); await tap('#keypad [data-k="next"]'); await keys('155'); await tap('#confirm'); await page.waitForTimeout(300);
await tap('#bookBtn'); await page.waitForSelector('table.book');
ok('book button reads FINISH RUN', (await page.locator('#closeBtn').innerText()).includes('FINISH RUN'));
await tap('#closeBtn'); await page.waitForSelector('#spName');
ok('finish dialog: set point name prefilled with last FS (TP2) and elevation 103.700', (await page.inputValue('#spName')) === 'TP2' && (await text('.dialog')).includes('103.700'));
await page.fill('#spName', 'sp-mh4'); await tap('.dialog [data-ok]'); await page.waitForSelector('#openRes');
const res = await text('#openRes');
ok('result: SET POINT SP-MH4 · 103.700 ft, "Open run, no closing check"', res.includes('SET POINT') && res.includes('SP-MH4 · 103.700 ft') && res.includes('Open run, no closing check'), res);
const body = await text('#app');
const kvs = (await page.locator('#openRes, .kv').allInnerTexts()).join(' '); ok('no misclosure / allowable in the open-run result or tables', !/misclosure|allowable/i.test(kvs) && kvs.includes('Open run – none'), kvs);
ok('arithmetic check shown and passing (+3.700)', /ΣBS − ΣFS \+3\.700/.test(body) && /Arithmetic check ✔ PASS/.test(body), body);
ok('distance totals shown (610 ft)', body.includes('610 ft'));
await noNaN('open-run result');
if (which === 'chromium') await shot(SHOTS + '5-open-run-result.png'); else await shot(shotOut('open-run-result'));
s = (await db()).jobs.find((j) => j.name === 'Pearland Tellepson').surveys.find((x) => x.name === 'Open run – SD line');
ok('last FS renamed to the set point and run marked finished', s.readings[3].point === 'SP-MH4' && s.closed === true);
await page.goto(BASE + `#/j/${(await db()).jobs.find((j) => j.name === 'Pearland Tellepson').id}`); await page.waitForSelector('.recent');
ok('recent list chip shows set point elevation', (await text('.recent:not(.plans)')).includes('SP-MH4 103.700'));
await page.locator('.recent button', { hasText: 'Open run' }).click(); await page.waitForSelector('table.book'); await tap('#closeBtn'); await page.waitForSelector('#spName'); await tap('.dialog [data-ok]'); await page.waitForSelector('#openRes');

// ---- 3. Share: text + PDF say open run, no NaN; PDF import round-trips ----
await tap('#shareRep'); await page.waitForSelector('.paper');
const paper = await text('.paper'); ok('PDF preview: OPEN RUN – SET POINT SP-MH4 ELEV 103.700', paper.includes('OPEN RUN – SET POINT SP-MH4 ELEV 103.700 FT – NO CLOSING CHECK'), paper.slice(0, 400));
ok('PDF preview: no NaN, no NOT CLOSED, no Misclosure', !/NaN|NOT CLOSED|Misclosure/.test(paper));
await page.locator('#fmt button[data-v="pdf"]').click(); await page.waitForTimeout(200);
const [dl] = await Promise.all([page.waitForEvent('download'), tap('#saveF')]); const pdfPath = shotOut('open-run.pdf').replace('.png', ''); await dl.saveAs(pdfPath);
const pdfText = execSync(`pdftotext -layout "${pdfPath}" -`).toString();
ok('PDF text: open run + set point elevation, no NaN', /OPEN RUN/.test(pdfText) && /Set point elevation\s+103\.700 ft/.test(pdfText) && !/NaN/.test(pdfText), pdfText.slice(0, 500));
const before = s;
await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
const buf = [...(await import('node:fs')).readFileSync(pdfPath)];
await page.evaluate((bytes) => { window.__lb.importReportFile(null, 'open-run.pdf', new Uint8Array(bytes).buffer); }, buf).catch((e) => errors.push('import: ' + e.message));
await page.waitForSelector('.dialog'); await tap('.dialog [data-ok]'); await page.waitForTimeout(500);
const imp = (await db()).jobs.filter((j) => j.name === 'Pearland Tellepson').pop().surveys.find((x) => x.name === 'Open run – SD line' && x.imported);
ok('imported open run: same readings, closeBM elev null', imp && JSON.stringify(imp.readings) === JSON.stringify(before.readings) && imp.closeBM.elev === null);
const same = imp && await page.evaluate(({ a, b }) => { const { C } = window.__lb; const f = (x) => JSON.stringify([C.computeSurvey(x), C.closure(x)]); return f(a) === f(b); }, { a: imp, b: before });
ok('imported open run computes the same result', !!same);

// ---- 4. Add a known elevation later → closure check ----
const job0 = (await db()).jobs.find((j) => j.name === 'Pearland Tellepson');
await page.goto(BASE + `#/j/${job0.id}/s/${before.id}/close`); await page.waitForSelector('#knownElev');
ok('CHECK CLOSURE disabled until a number', await page.locator('#addKnown').isDisabled());
await page.fill('#knownElev', '103.69'); await tap('#addKnown'); await page.waitForSelector('.big .bw');
const cl = await text('.big'); ok('known elevation added later: PASS with misclosure +0.010', cl.includes('PASS') && cl.includes('Misclosure +0.010'), cl);
ok('remove-known button offered', (await page.locator('#dropKnown').count()) === 1);
await tap('#dropKnown'); await page.waitForSelector('#openRes'); ok('removed: back to open run result', (await text('#openRes')).includes('SP-MH4 · 103.700'));

// ---- 5. Closed run (with a closing BM) still works as before ----
await pearland(); await tap('.modecard[data-mode="run"]'); await page.waitForSelector('#sn');
await page.fill('#sn', 'Closed run'); await page.fill('#bme', '100.000');
await page.fill('#cbn', 'bm-7'); await page.waitForTimeout(80);
ok('name only (no elevation) is allowed too (planned set point)', !(await page.locator('#start').isDisabled())); await page.fill('#cbe', '101.000'); await tap('#start'); await page.waitForSelector('#keypad');
await keys('5.00'); await tap('#keypad [data-k="next"]'); await keys('100'); await tap('#confirm'); await page.waitForTimeout(300);
ok('closed run: "Close on BM-7" quick button', (await page.locator('#closeOn').innerText()).includes('Close on BM-7'));
await tap('#closeOn'); await keys('3.99'); await tap('#keypad [data-k="next"]'); await keys('100'); await tap('#confirm');
await page.waitForSelector('.dialog'); ok('closing dialog asks to check misclosure', (await text('.dialog')).includes('misclosure'));
await tap('.dialog [data-ok]'); await page.waitForSelector('.big .bw');
const cl2 = await text('.big'); ok('closed run: PASS, misclosure +0.010, allowable shown', cl2.includes('PASS') && cl2.includes('Misclosure +0.010') && cl2.includes('allowable ±'), cl2);
ok('closed run: adjusted elevations section', (await page.locator('.section-label', { hasText: 'Adjusted elevations' }).count()) === 1);
await noNaN('closed-run closure');

// ---- 6. Pipe slope calculator ----
await pearland();
ok('Pipe Slope card in main menu (after Peg Test)', (await page.locator('.modecard').evaluateAll((e) => e.map((x) => x.dataset.mode).join(','))) === 'loop,run,site,stake,peg,pipe');
await tap('.modecard[data-mode="pipe"]'); await page.waitForSelector('#psStart');
ok('empty calculator shows a prompt, no table', (await page.locator('.pstable').count()) === 0 && (await text('#psOut')).includes('Enter the starting elevation'));
await page.fill('#psStart', '852.40');
await page.fill('input[data-f="len"][data-i="0"]', '150'); await page.fill('input[data-f="slope"][data-i="0"]', '1.00');
ok('live result for section 1: 852.400 → 850.900', (await text('#psr0')).includes('852.400 → 850.900'));
await tap('#psAdd'); await page.fill('input[data-f="len"][data-i="1"]', '220.5'); await page.fill('input[data-f="slope"][data-i="1"]', '0.75');
await tap('#psAdd'); await page.fill('input[data-f="len"][data-i="2"]', '98'); await page.fill('input[data-f="slope"][data-i="2"]', '2.08');
let out = await text('#psOut');
ok('3 sections chained: ends 850.900 / 849.246 / 847.208', (await page.locator('.pstable tbody tr').count()) === 3 && /850\.900/.test(out) && /849\.246/.test(out) && /847\.208/.test(out), out);
ok('totals: 468.50 ft, −5.192 ft (drop)', out.includes('468.50 ft') && out.includes('−5.192 ft (drop)'), out);
await page.locator('.psdir[data-i="2"] button[data-v="up"]').click(); await page.waitForTimeout(150); out = await text('#psOut');
ok('rise on section 3: end 851.284', out.includes('851.284'), out);
await page.locator('.psdir[data-i="2"] button[data-v="down"]').click();
await page.fill('input[data-f="slope"][data-i="1"]', '25'); await page.waitForTimeout(100);
ok('slope > 20 %: warning, still calculated', (await text('#psm1')).includes('Steep') && (await page.locator('.pstable tbody tr').count()) === 3);
await page.fill('input[data-f="slope"][data-i="1"]', '120'); await page.waitForTimeout(100);
ok('slope > 100 %: rejected inline, rows 2–3 hidden', (await text('#psm1')).includes('over 100%') && (await page.locator('.pstable tbody tr').count()) === 1 && (await text('#psr2')).trim() === '–');
await page.fill('input[data-f="slope"][data-i="1"]', '0.75'); await page.fill('input[data-f="len"][data-i="0"]', '0'); await page.waitForTimeout(100);
ok('length 0: rejected, no table rows', (await text('#psm0')).includes('more than 0') && (await page.locator('.pstable').count()) === 0);
await page.fill('input[data-f="len"][data-i="0"]', '20000'); await page.waitForTimeout(100); ok('length over 10,000 ft rejected', (await text('#psm0')).includes('10,000'));
await page.fill('input[data-f="len"][data-i="0"]', '150'); await page.fill('#psStart', 'abc'); await page.waitForTimeout(100);
ok('bad elevation: inline error, results hidden', (await text('#psmS')).includes('must be a number') && (await page.locator('.pstable').count()) === 0);
await noNaN('pipe calculator with bad input');
await page.fill('#psStart', '852.40'); await page.waitForTimeout(100);
await page.reload(); await page.waitForSelector('#psStart');
ok('inputs persist after reload', (await page.inputValue('#psStart')) === '852.40' && (await page.locator('.pipesec').count()) === 3 && (await page.inputValue('input[data-f="slope"][data-i="2"]')) === '2.08');
const [csv] = await Promise.all([page.waitForEvent('download'), tap('#psCsv')]); const csvPath = shotOut('pipe.csv').replace('.png', ''); await csv.saveAs(csvPath);
const csvT = (await import('node:fs')).readFileSync(csvPath, 'utf8'); ok('CSV export has 3 sections and totals', csvT.split('\r\n')[3].startsWith('3,849.246,98,2.08,DROP,-2.038,847.208') && csvT.includes('Total length ft,468.5'), csvT);
await page.evaluate(() => document.querySelector('#pipeScroll').scrollTop = document.querySelector('#psOut').offsetTop - 520);
if (which === 'chromium') await shot(SHOTS + '6-pipe-slope-calculator.png'); else await shot(shotOut('pipe-slope'));
await tap('.pipesec[data-i="2"] .psdel'); ok('remove section: 2 left, totals recalculated', (await page.locator('.pipesec').count()) === 2 && (await text('#psOut')).includes('370.50 ft'));
// offline: the service worker caches pipe.js
const cached = await page.evaluate(async () => { try { await navigator.serviceWorker.ready; const keys = await caches.keys(); const c = await caches.open(keys.find((k) => k === 'levelbook-v1.3.0-p2')); return !!(await c.match('./js/pipe.js')); } catch (e) { return 'err ' + e.message; } });
ok('service worker cache levelbook-v1.3.0-p2 holds js/pipe.js', cached === true, String(cached));
await browser.close();
