import { chromium, webkit, devices } from 'playwright';
const BASE = process.env.LB_BASE || 'http://127.0.0.1:8795/';
const OUT = '/workspace/preview-shots/e2e/';
const which = process.argv[2] || 'chromium';
const errors = [];
const results = [];
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`); };
let browser, ctx;
if (which === 'chromium') { browser = await chromium.launch(); ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago' }); }
else if (which === 'pixel') { browser = await chromium.launch(); ctx = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'America/Chicago' }); }
else { browser = await webkit.launch(); ctx = await browser.newContext({ ...devices['iPhone 15'], timezoneId: 'America/Chicago' }); }
const prefix = which === 'chromium' ? '' : which + '-';
const page = await ctx.newPage(); await ctx.addInitScript(() => { try { if (!localStorage.getItem('lb.dev.ent')) localStorage.setItem('lb.dev.ent', 'pro'); } catch (e) {} }); // existing suites run as Pro (gating has its own suite)
process.on('exit', () => console.log(results.join('\n') + '\nERRORS: ' + errors.join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => {
  window.__shareCalls = [];
  navigator.canShare = (d) => true;
  navigator.share = (d) => { window.__shareCalls.push({ title: d.title, text: (d.text || '').slice(0, 3000), files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }); return Promise.resolve(); };
});
const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: OUT + prefix + n + '.png' }); };
const shotClean = async (n) => { await page.waitForTimeout(350); await page.evaluate(() => document.querySelectorAll('.snackbar').forEach((x) => x.remove())); await page.screenshot({ path: OUT + prefix + n + '.png' }); };
const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(120); };
const keys = async (s) => { for (const ch of s) await tap(`#keypad button[data-k="${ch}"]`); };

await page.goto(BASE); await page.waitForSelector('.jobcard');
// first launch: one-time welcome card, no TRIAL badge
await page.waitForSelector('.welcome');
ok('welcome card on first launch', (await page.locator('.welcome').textContent()).includes('stays on your phone'));
ok('BlueWorks name in header + <title> + manifest', (await page.locator('.topbar .wordmark').textContent()) === 'BLUEWORKS' + 'LEVEL BOOK' && (await page.title()) === 'BlueWorks Level Book' && await page.evaluate(async () => { const m = await (await fetch('manifest.webmanifest')).json(); return m.name === 'BlueWorks Level Book' && m.short_name === 'Level Book' && m.short_name.length <= 12; }));
ok('no TRIAL badge; version in header', (await page.locator('.trialtag').count()) === 0 && (await page.locator('.topbar .vertag').textContent()).includes('1.3.1'));
ok('welcome card has no trial wording, keeps install + feedback tips', !/trial/i.test(await page.locator('.welcome').textContent()) && /Add to Home Screen|Install app/.test(await page.locator('.welcome').textContent()) && (await page.locator('.welcome').textContent()).includes('Send feedback'));
await shot('00-welcome');
await tap('#wlGo'); await page.waitForTimeout(200);
ok('welcome dismissed + saved', await page.locator('.welcome').count() === 0 && await page.evaluate(() => window.__lb.db().prefs.welcomed === true));
await page.reload(); await page.waitForSelector('.jobcard'); await page.waitForTimeout(300);
ok('welcome shown only once', await page.locator('.welcome').count() === 0);
ok('jobs screen renders seed job', await page.locator('.jobcard .name', { hasText: 'Pearland Tellepson' }).count() === 1);
ok('resume button visible', await page.locator('.resume').count() === 1);
await shot('01-jobs');
const swOK = await page.evaluate(async () => { try { const r = await navigator.serviceWorker?.ready; return !!r; } catch (e) { return false; } });
ok('service worker ready', swOK);

if (which === 'chromium') {
  // new job sheet
  await tap('#newJob'); await page.waitForSelector('#jn');
  ok('create disabled without name', await page.locator('#jok').isDisabled());
  await page.fill('#jn', 'Bluejack TBM'); await page.fill('#jdesc', 'Set TBMs along entry road for the clubhouse pad');
  await shot('02-new-job-sheet');
  await tap('#jok'); await page.waitForSelector('.modecard');
  ok('new job opens main menu', (await page.locator('.topbar .title').textContent()).includes('Bluejack'));
  await tap('[data-back]'); await page.waitForSelector('.jobcard');
  // swipe left with mouse on second card
  const card = page.locator('.swipe', { hasText: 'Bluejack' }).locator('.jobcard');
  const bb = await card.boundingBox();
  await page.mouse.move(bb.x + bb.width - 30, bb.y + 40); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(bb.x + bb.width - 30 - i * 18, bb.y + 42);
  await page.mouse.up(); await page.waitForTimeout(300);
  ok('swipe reveals actions', await page.locator('.swipe.open').count() === 1);
  await shot('03-jobs-swipe');
  await page.locator('.swipe.open button[data-a="archive"]').click(); await page.waitForTimeout(200);
  ok('archive snackbar', (await page.locator('.snackbar').textContent()).includes('UNDO'));
  await shot('03b-archived-snackbar');
  await page.locator('.snackbar button').click(); await page.waitForTimeout(200);
  ok('undo restores job', await page.locator('.jobcard .name', { hasText: 'Bluejack' }).count() === 1);
  // long press -> action sheet -> delete dialog with 2s disabled
  const card2 = page.locator('.swipe', { hasText: 'Bluejack' }).locator('.jobcard'); const b2 = await card2.boundingBox();
  await page.mouse.move(b2.x + 100, b2.y + 40); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); await page.waitForTimeout(200);
  ok('long-press opens action sheet', await page.locator('.sheet .listbtn', { hasText: 'Share job' }).count() === 1);
  await page.locator('.sheet .listbtn.red').click(); await page.waitForTimeout(150);
  ok('delete button disabled initially', await page.locator('.dialog [data-ok]').isDisabled());
  ok('delete dialog names job + count', (await page.locator('.dialog p').textContent()).includes('Delete Bluejack TBM and all 0 surveys'));
  await shot('04-delete-dialog');
  await page.waitForTimeout(2100);
  ok('delete enabled after 2s', !(await page.locator('.dialog [data-ok]').isDisabled()));
  await page.locator('.dialog [data-ok]').click(); await page.waitForTimeout(200);
  ok('job deleted', await page.locator('.jobcard .name', { hasText: 'Bluejack' }).count() === 0);
}

// main menu
await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard');
ok('main menu 6 cards (Stake Out above Peg Test, Pipe Slope last)', (await page.locator('.modecard').evaluateAll((e) => e.map((x) => x.dataset.mode).join(','))) === 'loop,run,site,stake,peg,pipe' && await page.locator('.modecard[data-mode="peg"]', { hasText: 'Peg Test' }).count() === 1);
ok('3-WIRE tag in recent', await page.locator('.recent .tag.blue').count() === 1);
await shot('05-main-menu');

// ---- Peg test: list -> new -> setup 1 -> setup 2 -> result ----
await tap('.modecard[data-mode="peg"]'); await page.waitForSelector('#newPeg');
ok('peg list shows sample test', (await page.locator('#pegs').textContent()).includes('SAMPLE') && (await page.locator('#pegs').textContent()).includes('+0.0020'));
await shotClean('05b-peg-list');
await tap('#newPeg'); await page.waitForSelector('#pin');
ok('peg setup: B sight defaults to D + 10', await page.inputValue('#pB2') === '210');
await page.fill('#pin', 'Auto level AT-B4 #41722'); await page.fill('#pob', 'D. Lawler');
await shotClean('05c-peg-setup');
await tap('#pstart'); await page.waitForSelector('#keypad');
ok('peg entry setup 1 strip', (await page.locator('#st1').textContent()).includes('SETUP 1'));
ok('peg confirm disabled before readings', await page.locator('#confirm').isDisabled());
await keys('5.284');
ok('peg rod crosshair on a1', (await page.locator('#rod .tag text').first().textContent()).includes('5.284'));
await keys('4.912');
ok('peg true diff +0.372', (await page.locator('.rescard').textContent()).includes('+0.372'));
await shotClean('05d-peg-entry-setup1');
await tap('#confirm'); await page.waitForTimeout(250);
ok('peg advanced to setup 2', (await page.locator('#st1').textContent()).includes('SETUP 2') && (await page.locator('#st2').textContent()).includes('210.0'));
await keys('4.618'); await keys('4.249');
const pegCard = await page.locator('.rescard').textContent();
ok('peg live C +0.0015', pegCard.includes('+0.369') && pegCard.includes('+0.0015'), pegCard);
await shotClean('05e-peg-entry-setup2');
await tap('#confirm'); await page.waitForSelector('.big');
const pegRes = await page.locator('.scroll').textContent();
ok('peg result PASS C +0.0015, 300 ft +0.0045, B should read 4.246', (await page.locator('.big .bw').textContent()) === 'PASS' && pegRes.includes('+0.0015') && pegRes.includes('+0.0045') && pegRes.includes('4.246') && pegRes.includes('inclined UP'), pegRes.slice(0, 200));
await shotClean('05f-peg-result');
await tap('#pdone'); await page.waitForSelector('.modecard');
ok('menu shows latest peg test', (await page.locator('.modecard[data-mode="peg"]').textContent()).includes('+0.0015'));

// setup new loop
await tap('.modecard[data-mode="loop"]'); await page.waitForSelector('#sn');
ok('start disabled initially', await page.locator('#start').isDisabled());
await page.fill('#sn', 'Loop 2'); await page.fill('#obs', 'D. Lawler'); await page.fill('#rodp', 'J. Ortiz');
await page.fill('#bme', '102.450');
await shot('06-setup-single');
await tap('#method button[data-v="three"]');
ok('three-wire options revealed', await page.locator('#threeOpts').isVisible());
await shot('06b-setup-three-wire');
await tap('#method button[data-v="single"]');
ok('peg toggle defaults ON with latest test', await page.getAttribute('#pegSw', 'aria-checked') === 'true' && (await page.locator('#pegSw').locator('xpath=..').textContent()).includes('+0.0015'));
await page.locator('#pegSw').scrollIntoViewIfNeeded(); await page.locator('.scroll').evaluate((e) => e.scrollBy(0, 120));
await shotClean('06c-setup-peg-toggle');
ok('setup Use distance default ON', await page.getAttribute('#setupDist', 'aria-checked') === 'true');
await page.locator('#setupDist').scrollIntoViewIfNeeded(); await page.locator('.scroll').evaluate((e) => e.scrollBy(0, 60));
await shotClean('06d-setup-dist-on');
await tap('#setupDist'); ok('setup Use distance OFF', await page.getAttribute('#setupDist', 'aria-checked') === 'false');
await shotClean('06e-setup-dist-off');
await tap('#setupDist');
ok('custom constant row hidden by default', !(await page.locator('#customRow').isVisible()));
ok('start enabled', !(await page.locator('#start').isDisabled()));
await tap('#start'); await page.waitForSelector('#keypad');

// entry single: BS 5.31 then FS 4.72
await keys('5.31'); await tap('#keypad [data-k="next"]'); await keys('150');
await tap('#confirm'); await page.waitForTimeout(300);
ok('after BS expect FS', await page.locator('#rt button[data-v="FS"][aria-pressed="true"]').count() === 1);
await keys('4.72');
const st2 = await page.locator('#st2').textContent();
ok('status strip HI 107.758 (peg: 5.31 − 0.0000150×150 = 5.308)', st2.includes('107.758'), st2);
ok('live new elev 103.038 (no FS dist yet → uncorrected)', (await page.locator('.result').first().textContent()).includes('103.038'));
ok('peg no-distance note in entry', (await page.locator('.pegmsg').textContent()).includes('no distance'));
const cross = await page.locator('#rod .crosshair').count();
ok('rod crosshair drawn', cross === 1);
ok('rod tag 4.72', (await page.locator('#rod .tag text').first().textContent()).includes('4.72'));
await page.waitForTimeout(400);
const prec = await page.evaluate(() => { const ch = document.querySelector('#rod .crosshair'); const bar = document.querySelector('#rod [data-top="472"]'); const tenth = document.querySelector('#rod [data-top="470"]');
  const barTop = bar.tagName === 'rect' ? +bar.getAttribute('y') : +bar.getAttribute('d').split(' ')[1];
  const tTop = tenth.tagName === 'rect' ? +tenth.getAttribute('y') : +tenth.getAttribute('d').split(' ')[1];
  return { cross: +ch.getAttribute('y1'), barTop, tenthTop: tTop }; });
ok('crosshair at top of 4.71–4.72 bar', Math.abs(prec.cross - prec.barTop) < 0.5, JSON.stringify(prec));
ok('no small foot number near crosshair', await page.evaluate((cy) => [...document.querySelectorAll('#rod .footsmall')].every((t) => Math.abs(+t.getAttribute('y') - cy) > 16), prec.cross));
ok('4.72 is 0.02 ft (16px) above the 4.70 tenth line', Math.abs((prec.tenthTop - prec.cross) - 16) < 0.5);
await shot('07-entry-single-4.72');
// error state: 17.2 > rod
await tap('#keypad [data-k="clr"]'); await keys('17.2');
ok('error dashed crosshair', await page.locator('#rod .crosshair.err').count() === 1);
ok('confirm disabled on error', await page.locator('#confirm').isDisabled());
await shot('09-entry-error-over-rod');
await tap('#keypad [data-k="clr"]'); await keys('4.72'); await tap('#keypad [data-k="next"]'); await keys('148');
ok('peg correction shown live: −0.002 → 4.718, elev 103.040', (await page.locator('.pegmsg').textContent()).includes('−0.002 → 4.718') && (await page.locator('.result').first().textContent()).includes('103.040'));
await page.locator('#panel').evaluate((e) => e.scrollTo(0, 9999)); await shotClean('07b-entry-peg-corrected');
ok('entry Use distance switch ON', await page.getAttribute('#distSw', 'aria-checked') === 'true');
await page.locator('#panel').evaluate((e) => e.scrollTo(0, 120)); await shotClean('07d-entry-dist-on');
await tap('#distSw'); await page.waitForTimeout(200);
ok('dist OFF: DIST field hidden, whole survey raw (HI 107.760, elev 103.040)', await page.locator('.rbox[data-f="dist"]').count() === 0 && (await page.locator('#st2').textContent()).includes('107.760') && (await page.locator('.result').first().textContent()).includes('103.040'));
ok('dist OFF: peg note', (await page.locator('.pegmsg').textContent()).includes('Peg off – no distance'));
await page.locator('#panel').evaluate((e) => e.scrollTo(0, 120)); await shotClean('07c-entry-dist-off');
await tap('#distSw'); await page.waitForTimeout(200);
ok('dist back ON: corrected again (HI 107.758)', (await page.locator('#st2').textContent()).includes('107.758') && await page.locator('.rbox[data-f="dist"]').count() === 1);
await tap('#confirm'); await page.waitForTimeout(300);
// book
await tap('#bookBtn'); await page.waitForSelector('table.book');
ok('book has rows', await page.locator('table.book tbody tr').count() === 2);
ok('arith check ok', (await page.locator('.summary').textContent()).includes('✔ OK'));
ok('book shows corrected + raw', (await page.locator('table.book').textContent()).includes('5.308') && (await page.locator('table.book').textContent()).includes('raw 5.31') && (await page.locator('#pegBtn').textContent()).includes('PEG ON'));
await shotClean('10-book-new-loop');

// seed loop book + closure
await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.recent');
await page.locator('.recent button', { hasText: 'Loop 1' }).click(); await page.waitForSelector('table.book');
const bookText = await page.locator('table.book').textContent();
ok('seed book values', ['107.760', '103.230', '109.250', '103.250', '108.170', '103.450', '104.990'].every((v) => bookText.includes(v)));
ok('seed sums', (await page.locator('.summary').textContent()).includes('ΣBS 20.110'));
await shot('11-book-seed-loop');
ok('seed loop peg OFF by default', (await page.locator('#pegBtn').textContent()).includes('PEG OFF'));
// toggle ON from the book
await tap('#pegBtn'); await page.waitForSelector('.sheet #pegSw');
await tap('.sheet #pegSw'); await page.waitForTimeout(250);
ok('sheet shows test used', (await page.locator('.sheet').textContent()).includes('+0.0015'));
await shotClean('11c-book-peg-sheet');
await tap('.sheet [data-close]'); await page.waitForTimeout(200);
const bookOn = await page.locator('table.book').textContent();
ok('peg ON changes HI/side shot (107.758, 104.989) keeps raw', bookOn.includes('107.758') && bookOn.includes('104.989') && !bookOn.includes('107.760') && bookOn.includes('raw 5.31'), bookOn.slice(0, 160));
ok('peg ON arith check still OK', (await page.locator('.summary').textContent()).includes('✔ OK'));
await shotClean('11b-book-seed-peg-on');
// toggle OFF again from the book → raw values back
await tap('#pegBtn'); await page.waitForSelector('.sheet #pegSw'); await tap('.sheet #pegSw'); await page.waitForTimeout(200); await tap('.sheet [data-close]'); await page.waitForTimeout(200);
ok('peg OFF restores raw 107.760 / 104.990', (await page.locator('table.book').textContent()).includes('107.760') && (await page.locator('table.book').textContent()).includes('104.990'));
await tap('#closeBtn'); await page.waitForSelector('.big');
ok('closure PASS', (await page.locator('.big .bw').textContent()) === 'PASS');
ok('misclosure +0.010', (await page.locator('.big').textContent()).includes('+0.010'));
await shot('12-closure');
// toggle ON from the closure screen
await tap('#pegSw'); await page.waitForTimeout(250);
const clOn = await page.locator('.scroll').textContent();
ok('closure peg ON: C shown, still PASS +0.010', await page.getAttribute('#pegSw', 'aria-checked') === 'true' && clOn.includes('C +0.0015') && clOn.includes('9 corrected') && (await page.locator('.big .bw').textContent()) === 'PASS', clOn.slice(0, 200));
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 0)); await shotClean('12c-closure-peg-on');
await tap('#closeDist'); await page.waitForTimeout(250);
const clOff = await page.locator('.scroll').textContent();
ok('closure dist OFF: allowable n/a, by-distance disabled, same misclosure', clOff.includes('n/a – distances not used') && clOff.includes('+0.010') && await page.locator('#adjm button[data-v="distance"]').isDisabled());
ok('report says Distances: not used', await page.evaluate(() => { const d = window.__lb.db(); const job = d.jobs.find((j) => j.name === 'Pearland Tellepson'); const s = job.surveys.find((x) => x.name.startsWith('Loop 1')); return window.__lb.R.textReport(job, [s]).includes('Distances: not used') && window.__lb.R.previewPages(job, [s], { table: true, checks: true }).join('').includes('not used'); }));
await tap('#closeDist'); await page.waitForTimeout(250);
ok('closure dist back ON: PASS', (await page.locator('.big .bw').textContent()) === 'PASS');
await tap('#adjm button[data-v="distance"]'); await page.waitForTimeout(200);
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 9999)); await shot('12b-closure-adjust-distance');
await tap('#shareRep'); await page.waitForSelector('.paper');
ok('preview page count', (await page.locator('.pager span').textContent()).startsWith('Page 1 of'));
const pvAll = await page.evaluate(() => { const d = window.__lb.db(); const job = d.jobs.find((j) => j.name === 'Pearland Tellepson'); const s = job.surveys.find((x) => x.name.startsWith('Loop 1')); return { pages: window.__lb.R.previewPages(job, [s], { table: true, checks: true, adjusted: true, peg: true }).join(''), text: window.__lb.R.textReport(job, [s]), csv: window.__lb.R.csvReport(job, [s]) }; });
ok('PDF preview: peg status, PEG column, peg test record', pvAll.pages.includes('Peg correction') && pvAll.pages.includes('PEG TEST RECORD (applied)') && pvAll.pages.includes('<th>PEG</th>') && pvAll.pages.includes('+0.0015'));
ok('text report says Distances: used', pvAll.text.includes('Distances: used'));
ok('text report states peg ON + C + test date', pvAll.text.includes('Peg corr ON: C +0.0015') && pvAll.text.includes('test 11/'), pvAll.text.split('\n')[4]);
ok('CSV has peg columns and record', pvAll.csv.includes('Peg corr,Corrected') && pvAll.csv.includes('Collimation C') && pvAll.csv.includes('5.308'));
await shot('13-share-preview-pdf');
await tap('#shareGo'); await page.waitForTimeout(800);
const calls = await page.evaluate(() => window.__shareCalls);
ok('navigator.share called with PDF file', calls.length === 1 && calls[0].files[0]?.type === 'application/pdf' && calls[0].files[0].size > 2000, JSON.stringify(calls[0]?.files));
ok('share title format', calls[0]?.title === 'BlueWorks Level Book – Pearland Tellepson – Loop 1 (SAMPLE) – 11/16/2026', calls[0]?.title);
await tap('#fmt button[data-v="text"]'); await shot('13b-share-preview-text');
await tap('#shareGo'); await page.waitForTimeout(300);
const calls2 = await page.evaluate(() => window.__shareCalls);
ok('text share has no files + text', calls2[1] && !calls2[1].files.length && calls2[1].text.includes('PASS') && calls2[1].text.includes('Peg corr ON'));
await tap('#fmt button[data-v="csv"]'); await shot('13c-share-preview-csv');
await tap('#fmt button[data-v="pdf"]');
// PDF itself mentions the peg test (jsPDF text stream)
const pdfHas = await page.evaluate(() => { const d = window.__lb.db(); const job = d.jobs.find((j) => j.name === 'Pearland Tellepson'); const s = job.surveys.find((x) => x.name.startsWith('Loop 1')); const out = window.__lb.R.pdfReport(job, [s], { table: true, checks: true, adjusted: true, peg: true }).output(); return out.includes('PEG TEST RECORD') && out.includes('Peg correction') && out.includes('PEG CORR'); });
ok('PDF contains peg record', pdfHas);

// three-wire run
await page.goto(BASE + '#/'); await page.waitForSelector('.resume');
await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.recent');
await page.locator('.recent button', { hasText: 'Run 1' }).click(); await page.waitForSelector('table.book');
await tap('#next'); await page.waitForSelector('#keypad');
ok('opens three-wire entry', await page.locator('.rbox.w3').count() === 3);
// next is BS on TP1
await keys('5.214'); await keys('4.720'); await keys('4.226');
const card3 = await page.locator('.rescard').textContent();
ok('three-wire MEAN 4.720 DIST 98.8', card3.includes('4.720') && card3.includes('98.8 ft'), card3);
ok('three wires drawn', await page.locator('#rod .stadia').count() === 2 && await page.locator('#rod .crosshair').count() === 1);
await shot('08-entry-three-wire');
await page.locator('#panel').evaluate((e) => e.scrollTo(0, 9999)); await shotClean('08b-three-wire-dist-on');
await tap('#distSw'); await page.waitForTimeout(200);
ok('three-wire dist OFF: stadia shown "(not used)"', (await page.locator('.rescard').textContent()).includes('98.8 ft') && (await page.locator('.rescard').textContent()).includes('(not used)'));
await page.locator('#panel').evaluate((e) => e.scrollTo(0, 9999)); await shotClean('08c-three-wire-dist-off');
await tap('#distSw'); await page.waitForTimeout(200);
await tap('#keypad [data-k="clr"]'); await keys('4.200'); // bottom wire off -> spread error
ok('spread error dashed wire', await page.locator('#rod .err').count() >= 1);
ok('accept anyway offered', await page.locator('#accept').count() === 1);
await shot('09b-entry-three-wire-spread-error');
await tap('#keypad [data-k="clr"]'); await keys('4.226');
await tap('#confirm'); await page.waitForTimeout(300);
await tap('#bookBtn'); await page.waitForSelector('table.book');
ok('three-wire book block', await page.locator('table.book .tw').count() >= 2);
await shot('10b-book-three-wire');
await tap('#shareBtn'); await page.waitForSelector('.paper');
ok('in-progress label', (await page.locator('.paper').textContent()).includes('IN PROGRESS – NOT CLOSED'));
await page.locator('#inc input[data-k="threewire"]').check(); await page.waitForTimeout(200);
await shot('13d-share-preview-three-wire');
await tap('#shareGo'); await page.waitForTimeout(600);
const calls3 = await page.evaluate(() => window.__shareCalls);
ok('3-wire share PDF', calls3.at(-1)?.files[0]?.name.endsWith('.pdf'));

// ---- Stake Out (v1.2.0) ----
{
  const panelBottom = () => page.locator('#panel').evaluate((e) => e.scrollTo(0, 9999));
  await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
  await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard');
  ok('sample Stake Out in recent', await page.locator('.recent button', { hasText: 'Stake 1' }).count() === 1);
  await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 230)); await shotClean('stake-01-menu');
  await page.locator('.recent button', { hasText: 'Stake 1' }).click(); await page.waitForSelector('table.stake');
  const seedSheet = await page.locator('table.stake').textContent();
  ok('sample stake sheet F 0.21 / C 0.66 / ON GR', seedSheet.includes('F 0.21') && seedSheet.includes('C 0.66') && seedSheet.includes('ON GR'));
  await shotClean('stake-02-sample-sheet');
  await tap('#shareBtn'); await page.waitForSelector('.paper');
  const pv = await page.locator('.paper').textContent();
  ok('stake report preview: STAKE SHEET, HI, distances, cut/fill', pv.includes('STAKE SHEET') && pv.includes('107.760') && pv.includes('Distances') && pv.includes('F 0.21'));
  await page.evaluate(() => { const w = document.querySelector('.paperwrap'); let p = w.parentElement; while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement; if (p) p.scrollTop = w.offsetTop - 60; }); await shotClean('stake-03-report-preview');
  const n0 = (await page.evaluate(() => window.__shareCalls)).length;
  await tap('#shareGo'); await page.waitForTimeout(600);
  const sc = await page.evaluate(() => window.__shareCalls);
  ok('stake PDF shared', sc.length === n0 + 1 && sc.at(-1).files[0]?.name.endsWith('.pdf'));
  ok('reports carry BlueWorks name (PDF/text/CSV)', await page.evaluate(() => { const d = window.__lb.db(); const job = d.jobs.find((j) => j.name === 'Pearland Tellepson'); const s = job.surveys.find((x) => x.type === 'stake');
    return window.__lb.R.pdfReport(job, [s], {}).output().includes('BLUEWORKS LEVEL BOOK') && window.__lb.R.textReport(job, [s]).startsWith('BLUEWORKS LEVEL BOOK') && window.__lb.R.csvReport(job, [s]).startsWith('Report,BlueWorks Level Book v1.3.1'); }));
  ok('stake PDF + CSV content', await page.evaluate(() => { const d = window.__lb.db(); const job = d.jobs.find((j) => j.name === 'Pearland Tellepson'); const s = job.surveys.find((x) => x.type === 'stake');
    const pdf = window.__lb.R.pdfReport(job, [s], { table: true, checks: true, adjusted: true, peg: true }).output(); const csv = window.__lb.R.csvReport(job, [s]);
    return pdf.includes('STAKE SHEET') && pdf.includes('F 0.21') && csv.includes('Target rod') && csv.includes('CUT,0.66'); }));
  // new stake survey
  await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
  await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard');
  await tap('.modecard[data-mode="stake"]'); await page.waitForSelector('#sn');
  await page.fill('#sn', 'Pad grades N lot'); await page.fill('#obs', 'D. Lawler'); await page.fill('#bme', '102.450');
  if (await page.locator('#pegSw:not([disabled])[aria-checked="true"]').count()) await tap('#pegSw'); // raw numbers for the checks
  await tap('#start'); await page.waitForSelector('#keypad');
  await keys('5.31'); await tap('#keypad [data-k="next"]'); await keys('150');
  ok('stake backsight HI 107.760', (await page.locator('#st2').textContent()).includes('107.760'));
  await shotClean('stake-04-backsight');
  await tap('#confirm'); await page.waitForTimeout(300);
  await keys('103.250');
  ok('stake target 4.510 + marker', (await page.locator('.tgtline').textContent()).includes('4.510') && await page.locator('#rod .target').count() === 1);
  await shotClean('stake-05-design-target');
  await keys('4.72');
  ok('stake FILL 0.21', (await page.locator('#cf').textContent()).includes('FILL 0.21') && (await page.locator('#st2').textContent()).includes('F 0.21'));
  await panelBottom(); await shotClean('stake-06-actual-fill');
  await tap('#distSw'); await page.waitForTimeout(200);
  ok('stake dist OFF hides DIST, same cut/fill', await page.locator('.rbox[data-f="dist"]').count() === 0 && (await page.locator('#cf').textContent()).includes('FILL 0.21'));
  await panelBottom(); await shotClean('stake-06b-dist-off'); await tap('#distSw'); await page.waitForTimeout(200);
  await tap('#confirm'); await page.waitForTimeout(300);
  await keys('103.000'); await keys('4.10');
  ok('stake CUT 0.66', (await page.locator('#cf').textContent()).includes('CUT 0.66'));
  await panelBottom(); await shotClean('stake-07-actual-cut');
  await tap('#confirm'); await page.waitForTimeout(300);
  await keys('90.500');
  ok('stake off-rod (past rod) warning', (await page.locator('.msg.err').textContent()).includes('past the 16 ft rod'));
  await shotClean('stake-08-off-rod-below');
  await tap('.rbox[data-f="design"]'); await tap('#keypad [data-k="clr"]'); await keys('108.200');
  ok('stake off-rod (above HI) warning', (await page.locator('.msg.err').textContent()).includes('above the line of sight'));
  await shotClean('stake-09-off-rod-above');
  await tap('.rbox[data-f="design"]'); await tap('#keypad [data-k="clr"]'); await keys('102.900'); await keys('4.86');
  ok('stake ON GRADE', (await page.locator('#cf').textContent()).includes('ON GRADE'));
  await tap('#confirm'); await page.waitForTimeout(300);
  await tap('#bookBtn'); await page.waitForSelector('table.stake');
  ok('stake sheet 3 rows', await page.locator('table.stake tbody tr').count() === 3);
  await shotClean('stake-10-sheet');
  await tap('#finish'); await page.waitForSelector('.paper');
  ok('finish opens share', (await page.locator('.paper').textContent()).includes('STAKE SHEET'));
}

// Dusk theme on entry
await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
await tap('[data-act="theme"]');
ok('dusk theme set', await page.evaluate(() => document.documentElement.dataset.theme) === 'dusk');
await shot('14-dusk-jobs');
await tap('.resume'); await page.waitForSelector('#keypad'); await keys('3.51');
await shot('14b-dusk-entry');
await tap('#bookBtn'); await page.waitForSelector('table.book'); await shot('14c-dusk-book');
await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard'); await tap('[data-act="theme"]');
// settings sheet
await tap('[data-act="settings"]'); await page.waitForSelector('#exp'); await shot('15-settings');
ok('settings Use distance default ON', await page.getAttribute('#prefDist', 'aria-checked') === 'true');
await page.locator('.sheet .sbody').evaluate((e) => e.scrollTo(0, 60)); await shotClean('15c-settings-dist-on');
await tap('#prefDist'); ok('settings default OFF saved', await page.evaluate(() => window.__lb.db().prefs.useDist === false));
await shotClean('15b-settings-dist-off');
await tap('#prefDist');

// feedback (Settings)
{
  if (await page.locator('.sheet [data-close]').count()) await tap('.sheet [data-close]');
  await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
  await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard');
  await tap('[data-act="feedback"]');
  await page.waitForSelector('#fbSend');
  ok('feedback sheet: rating, 4 categories, notes', await page.locator('#fbRate button').count() === 5 && await page.locator('#fbCat button').count() === 4 && await page.locator('#fbNotes').count() === 1);
  await tap('#fbRate button[data-v="4"]'); await tap('#fbCat button[data-v="math"]');
  await page.fill('#fbNotes', 'Closure looked right on Loop 1. Bigger CUT text please.');
  ok('attach-report option offered', await page.locator('#fbAttach').count() === 1);
  await page.check('#fbAttach');
  await shotClean('16-feedback');
  const n0 = (await page.evaluate(() => window.__shareCalls)).length;
  await tap('#fbSend'); await page.waitForTimeout(700);
  const fc = (await page.evaluate(() => window.__shareCalls)).at(-1);
  ok('feedback via Web Share with PDF', (await page.evaluate(() => window.__shareCalls)).length === n0 + 1 && fc.files[0]?.type === 'application/pdf' && fc.title === 'BlueWorks Level Book feedback v1.3.1');
  ok('feedback text: recipient, rating, category, notes, device info', ['ddlawler@hotmail.com', '(4/5)', 'Category: math', 'Bigger CUT text', 'App version: 1.3.1', 'Device/UA:', 'Screen:', 'Theme: Sunlight', 'Current screen:'].every((k) => fc.text.includes(k)), fc.text);
  // mailto fallback (no Web Share)
  await page.evaluate(() => { window.__mail = null; window.__lbMailHook = (u) => (window.__mail = u); window.__savedShare = navigator.share; navigator.share = undefined; });
  await tap('[data-act="settings"]'); await page.waitForSelector('#fbOpen'); await tap('#fbOpen'); await page.waitForSelector('#fbSend');
  await tap('#fbCat button[data-v="idea"]'); await page.fill('#fbNotes', 'Add a dark rod option'); await tap('#fbSend'); await page.waitForTimeout(300);
  const mail = await page.evaluate(() => window.__mail || '');
  const dec = decodeURIComponent(mail);
  ok('mailto fallback to ddlawler@hotmail.com, subject + body', mail.startsWith('mailto:ddlawler@hotmail.com?subject=BlueWorks%20Level%20Book%20feedback%20v1.3.1') && dec.includes('Category: idea') && dec.includes('Add a dark rod option') && dec.includes('Theme:') && dec.includes('Device/UA:'), mail.slice(0, 200));
  await page.evaluate(() => { navigator.share = window.__savedShare; window.__lbMailHook = null; });
  await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
  await tap('[data-act="settings"]'); await page.waitForSelector('#fbOpen');
  await page.locator('#fbOpen').scrollIntoViewIfNeeded(); ok('Settings: Feedback section, no trial wording', !/trial/i.test(await page.locator('.sheet').textContent()) && (await page.locator('.sheet').textContent()).includes('Send feedback')); await shotClean('16b-settings-feedback');
  await tap('.sheet [data-close]');
}

// offline reload
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.reload(); await page.waitForTimeout(800);
ok('offline reload works', await page.locator('.jobcard').count() >= 1);
await ctx.setOffline(false);
// viewport overflow check
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
ok('no horizontal overflow', !overflow);
ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
