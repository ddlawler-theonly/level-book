import { webkit, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8795/';
const OUT = process.env.MOUT || '/workspace/manual/shots-new/';
const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 15'], timezoneId: 'America/Chicago' });
await ctx.addInitScript(() => { window.__shareCalls = []; navigator.share = (d) => { window.__shareCalls.push(d.title); return Promise.resolve(); }; navigator.canShare = () => true; });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('lbFree')) localStorage.setItem('lb.pro', '1'); } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const boxes = {};
const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(140); };
const keys = async (s) => { for (const ch of s) await tap(`#keypad button[data-k="${ch}"]`); };
const clr = () => tap('#keypad [data-k="clr"]');
const panelBottom = () => page.locator('#panel').evaluate((e) => e.scrollTo(0, 9999));
const panelTop = () => page.locator('#panel').evaluate((e) => e.scrollTo(0, 0));
const scrollTo = (sel, off = 0) => page.evaluate(([s, o]) => { const el = document.querySelector(s); let p = el.parentElement; while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement; if (p) p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - o; }, [sel, off]);
// cap(name, [[selector, nth?], ...]) – screenshot + callout boxes (CSS px)
async function cap(name, calls = []) {
  await page.waitForTimeout(420);
  await page.evaluate(() => document.querySelectorAll('.snackbar').forEach((x) => x.remove()));
  const bx = [];
  for (const c of calls) { const [sel, nth = 0] = Array.isArray(c) ? c : [c]; const loc = page.locator(sel).nth(nth); const bb = (await loc.count()) ? await loc.boundingBox() : null; if (!bb) console.log('NO BOX', name, sel); bx.push(bb); }
  boxes[name] = bx; await page.screenshot({ path: OUT + name + '.png' });
}
const openJob = async () => { await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard'); await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard'); };

// --- first launch / jobs
await page.goto(BASE); await page.waitForSelector('.welcome');
await cap('welcome', ['#wlGo']);
await tap('#wlGo');
await cap('jobs', ['.jobcard', '#newJob', '.resume']);
await tap('#newJob'); await page.waitForSelector('#jn');
await page.fill('#jn', 'Bluejack TBM'); await page.fill('#jdesc', 'Set TBMs along entry road');
await cap('newjob', ['#jn', '#jok']);
await tap('#jok'); await page.waitForSelector('.modecard'); await tap('[data-back]'); await page.waitForSelector('.jobcard');
{ const card = page.locator('.swipe', { hasText: 'Bluejack' }).locator('.jobcard'); const bb = await card.boundingBox();
  await page.mouse.move(bb.x + bb.width - 30, bb.y + 40); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(bb.x + bb.width - 30 - i * 18, bb.y + 42); await page.mouse.up(); await page.waitForTimeout(300); }
await cap('swipe', ['.swipe.open .actions']);
await page.locator('.swipe.open .jobcard').click({ position: { x: 20, y: 20 } }).catch(() => {}); await page.waitForTimeout(300);
// --- main menu
await openJob();
await cap('menu', [['.modecard', 0], ['.modecard', 1], ['.modecard', 2], ['.modecard', 3], ['.modecard', 4]]);
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 9999)); await cap('menu-recent', ['.recent']);
// --- new loop setup
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 0));
await tap('.modecard[data-mode="loop"]'); await page.waitForSelector('#sn');
await page.fill('#sn', 'Loop 2'); await page.fill('#obs', 'D. Lawler'); await page.fill('#rodp', 'J. Ortiz');
await cap('setup-top', ['#sn', '#method']);
await scrollTo('#bme', 120); await page.fill('#bme', '102.450'); await cap('setup-bm', ['#bmn', '#bme']);
await scrollTo('#setupDist', 200); await cap('setup-dist', ['#setupDist', '#pegSw']);
await scrollTo('#std', 160); await cap('setup-checks', ['#std', '#rodl', '#imb', '#maxs']);
await tap('#start'); await page.waitForSelector('#keypad');
// --- entry single wire
await cap('entry-empty', ['#st2', '#rt', '#rod', '#keypad']);
await keys('5.31'); await cap('entry-bs', ['.rbox', '#rod .tag', '#keypad [data-k="next"]']);
await tap('#keypad [data-k="next"]'); await keys('150');
await cap('entry-bs-dist', ['.rbox[data-f="dist"]', '#confirm']);
await tap('#confirm'); await page.waitForTimeout(300);
await keys('4.72'); await tap('#keypad [data-k="next"]'); await keys('148');
await cap('entry-fs', [['#rt button', 1], '#st2', '.result']);
await panelBottom(); await cap('entry-fs-bottom', ['#distSw', '#confirm']);
await clr(); await tap('.rbox'); await clr(); await keys('17.2'); await cap('entry-error', ['#rod .crosshair.err', '#confirm']).catch(()=>{});
await clr(); await keys('4.72'); await tap('#keypad [data-k="next"]'); await clr(); await keys('148'); await tap('#confirm'); await page.waitForTimeout(300);
await keys('6.012'); await tap('#keypad [data-k="next"]'); await keys('120'); await tap('#confirm'); await page.waitForTimeout(300);
await panelTop(); await cap('entry-closeon', ['#closeOn']);
await tap('#closeOn'); await keys('6.596'); await tap('#keypad [data-k="next"]'); await keys('125');
await cap('entry-closing', ['#st1', '.result']);
await tap('#confirm'); await page.waitForSelector('.dialog');
await cap('close-dialog', ['.dialog [data-ok]']);
await tap('.dialog [data-ok]'); await page.waitForSelector('.big');
await cap('closure', ['.big', '#closeDist']);
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 9999)); await cap('closure-adjust', ['#adjm', '#shareRep']);
await tap('[data-back]'); await page.waitForSelector('table.book');
await cap('book', ['table.book', '.summary']);
await cap('book-buttons', ['#next', '#side', '#closeBtn', '#pegBtn']);
// --- three-wire run (seed Run 1)
await openJob();
await tap('.modecard[data-mode="run"]'); await page.waitForSelector('#sn');
await tap('#method button[data-v="three"]'); await cap('run-setup-three', ['#method', '#sk', '#stol']);
await scrollTo('#cbn', 160); await cap('run-setup-close', ['#cbn', '#cbe']);
await openJob();
await page.locator('.recent button', { hasText: 'Run 1' }).click(); await page.waitForSelector('table.book');
await tap('#next'); await page.waitForSelector('#keypad');
await keys('5.214'); await keys('4.720'); await keys('4.226');
await cap('three-entry', [['.rbox.w3', 0], ['.rbox.w3', 1], ['.rbox.w3', 2], '.rescard']);
await panelBottom(); await cap('three-checks', ['.rescard', '#distSw']);
await panelTop(); await clr(); await keys('4.200'); await cap('three-spread', ['#rod .err', '#accept']);
await clr(); await keys('4.226');
// running distance totals: BS confirmed, FS being typed (setup complete)
await tap('#confirm'); await page.waitForTimeout(300); if (!(await page.locator('#keypad').count())) { await tap('#next'); await page.waitForSelector('#keypad'); }
await keys('4.900'); await keys('4.400'); await keys('3.900');
await page.locator('#panel').evaluate((e) => { const c = e.querySelector('#distTot'); e.scrollTop = c.offsetTop - 200; }); await cap('three-totals', ['#distTot', '.dtot .dt.wn, .dtot .dt:nth-child(3)']);
await tap('#bookBtn'); await page.waitForSelector('table.book');
await page.evaluate(() => { const db = window.__lb.db(); const s = db.jobs.flatMap((j) => j.surveys).find((x) => x.name.startsWith('Run 1')); s.readings.length = 2; localStorage.setItem('levelbook.v1', JSON.stringify(db)); });
// --- site levels
await openJob();
await tap('.modecard[data-mode="site"]'); await page.waitForSelector('#sn');
await page.fill('#sn', 'Site 1 – pad shots'); await page.fill('#obs', 'D. Lawler'); await page.fill('#bme', '102.450');
await tap('#start'); await page.waitForSelector('#keypad');
await keys('5.31'); await tap('#confirm'); await page.waitForTimeout(300);
await keys('4.18'); await cap('site-ifs', ['#rt', '.result']);
await tap('#confirm'); await page.waitForTimeout(300); await keys('3.96'); await tap('#confirm'); await page.waitForTimeout(300);
await tap('#bookBtn'); await page.waitForSelector('table.book'); await cap('site-book', ['table.book']);
// --- stake out
await openJob();
await tap('.modecard[data-mode="stake"]'); await page.waitForSelector('#sn');
await page.fill('#sn', 'Pad grades N lot'); await page.fill('#obs', 'D. Lawler'); await page.fill('#bme', '102.450');
await cap('stake-setup', ['#sn', '#bme']);
await tap('#start'); await page.waitForSelector('#keypad');
await keys('5.31'); await tap('#keypad [data-k="next"]'); await keys('150');
await cap('stake-bs', ['#st2', '#confirm']);
await tap('#confirm'); await page.waitForTimeout(300);
await keys('103.250'); await cap('stake-target', ['.tgtline', '#rod .target']);
await keys('4.72'); await panelBottom(); await cap('stake-fill', ['#cf', '#st2']);
await tap('#confirm'); await page.waitForTimeout(300);
await keys('103.000'); await keys('4.10'); await panelBottom(); await cap('stake-cut', ['#cf']);
await tap('#confirm'); await page.waitForTimeout(300);
await keys('108.200'); await cap('stake-off', ['.msg.err']);
await tap('.rbox[data-f="design"]'); await clr(); await keys('102.900'); await keys('4.86'); await tap('#confirm'); await page.waitForTimeout(300);
await tap('#bookBtn'); await page.waitForSelector('table.stake');
await cap('stake-sheet', ['table.stake', '#nextStake', '#newBS', '#finish']);
// --- peg test
await openJob();
await tap('.modecard[data-mode="peg"]'); await page.waitForSelector('#newPeg');
await cap('peg-list', ['#pegs', '#newPeg']);
await tap('#newPeg'); await page.waitForSelector('#pin');
await page.fill('#pin', 'Auto level AT-B4'); await page.fill('#pob', 'D. Lawler');
await cap('peg-setup', ['#pB2', '#pstart']);
await tap('#pstart'); await page.waitForSelector('#keypad');
await keys('5.284'); await keys('4.912'); await cap('peg-s1', ['#st1', '.rescard']);
await tap('#confirm'); await page.waitForTimeout(250);
await keys('4.618'); await keys('4.249'); await cap('peg-s2', ['#st2', '.rescard']);
await tap('#confirm'); await page.waitForSelector('.big');
await cap('peg-result', ['.big']);
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 9999)); await cap('peg-result-2', ['#pdone']);
await tap('#pdone'); await page.waitForSelector('.modecard');
// apply peg on seed loop: book PEG button
await page.locator('.recent button', { hasText: 'Loop 1' }).click(); await page.waitForSelector('table.book');
await tap('#pegBtn'); await page.waitForSelector('.sheet #pegSw'); await tap('.sheet #pegSw'); await page.waitForTimeout(250);
await cap('peg-sheet', ['.sheet #pegSw']);
await tap('.sheet #pegSw'); await tap('.sheet [data-close]');
// --- share / reports from seed loop
await tap('#closeBtn'); await page.waitForSelector('.big'); await tap('#shareRep'); await page.waitForSelector('.paper');
await cap('share', ['#fmt', '#inc', '#shareGo', '#saveF']);
await scrollTo('.paperwrap', 60); await cap('share-preview', ['.paper', '.pager']);
await tap('#fmt button[data-v="text"]'); await scrollTo('.paperwrap', 60); await cap('share-text', ['#fmt']);
await tap('#fmt button[data-v="pdf"]');
// --- themes
await openJob(); await tap('[data-act="theme"]');
await cap('dusk-menu', ['[data-act="theme"]']);
await page.locator('.recent button', { hasText: 'Run 1' }).click(); await page.waitForSelector('table.book'); await tap('#next'); await page.waitForSelector('#keypad');
await keys('5.214'); await keys('4.720'); await keys('4.226'); await cap('dusk-entry', []);
await openJob(); await tap('[data-act="theme"]');
// --- settings
await tap('[data-act="settings"]'); await page.waitForSelector('#exp');
await cap('settings', ['#thm', '#proStatus', '#kpSize']);
await scrollTo('#prefDist', 120); await cap('settings-2', ['#prefDist', '#pegTol']);
await scrollTo('#exp', 80); await cap('settings-backup', ['#exp', 'label:has(#imp)', '#persist']);
await scrollTo('#helpOpen', 120); await cap('settings-trial', ['#helpOpen', '#fbOpen', '#wlOpen']);
await tap('#fbOpen'); await page.waitForSelector('#fbSend');
await tap('#fbRate button[data-v="4"]'); await tap('#fbCat button[data-v="idea"]'); await page.fill('#fbNotes', 'Bigger CUT text on the stake screen please.');
await cap('feedback', ['#fbRate', '#fbCat', '#fbNotes', '#fbAttach']);
await scrollTo('#fbSend', 300); await cap('feedback-send', ['#fbSend']);

await page.evaluate(() => document.querySelectorAll('.overlay').forEach((o) => o.remove()));
// --- NEW in this build: help & manual
await openJob();
await cap('menu-help', ['#menuHelp']);
await tap('#menuHelp'); await page.waitForSelector('.manual .mpg canvas', { timeout: 20000 }); await page.waitForTimeout(800);
await cap('manual-viewer', ['.manual [data-close]', '#mPage']);
await tap('.manual [data-close]');
// --- keypad size
await tap('[data-act="settings"]'); await page.waitForSelector('#kpSize');
await tap('#kpSize button[data-v="compact"]'); await page.waitForTimeout(200);
await scrollTo('#kpSize', 160); await cap('settings-keypad', ['#kpSize']);
await tap('.sheet [data-close]');
await page.locator('.recent button', { hasText: 'Loop 1' }).click(); await page.waitForSelector('table.book'); await tap('#next'); await page.waitForSelector('#keypad');
await keys('5.31'); await cap('entry-compact', ['#keypad', '#rod']);
await openJob(); await tap('[data-act="settings"]'); await page.waitForSelector('#kpSize'); await tap('#kpSize button[data-v="large"]'); await tap('.sheet [data-close]');
// --- plan sheet (Pro)
const PLAN = new URL('../samples/Sample-Site-Plan.pdf', import.meta.url).pathname;
const viewerReady = async () => { await page.waitForSelector('.planview .pv-canvas', { timeout: 20000 }); await page.waitForFunction(() => document.querySelector('#pvLoad')?.hidden === true); await page.waitForTimeout(300); };
const tapPlan = async (fx, fy) => { const bb = await page.locator('.pv-canvas').boundingBox(); await page.mouse.click(bb.x + fx * bb.width, bb.y + fy * bb.height); await page.waitForTimeout(250); };
{ const [ch] = await Promise.all([page.waitForEvent('filechooser'), tap('#attachPlan')]); await ch.setFiles(PLAN); }
await page.waitForSelector('#planList [data-plan]', { timeout: 20000 });
await scrollTo('#planList', 200); await cap('plan-attached', ['#planList']);
await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 0));
await tap('.modecard[data-mode="loop"]'); await page.waitForSelector('#start');
await page.fill('#sn', 'Pad grades'); await page.fill('#bme', '50.000');
await scrollTo('#planSec', 200); await cap('plan-setup', ['#planSec']);
await tap('#start'); await page.waitForSelector('#keypad');
await keys('5.31'); await tap('#confirm'); await viewerReady();
await cap('plan-mark', ['.planview .st1']);
await tapPlan(120 / 1224, 610 / 792);
await cap('plan-pin', ['.planview .pin', '#pvDone']);
await tap('#pvDone'); await page.waitForTimeout(300);
await page.locator('#toBook').click(); await page.waitForSelector('#side'); await tap('#side'); await page.waitForSelector('#keypad');
for (const [rd, x, y] of [['3.18', 380, 300], ['3.40', 680, 260], ['4.02', 900, 520]]) { await keys(rd); await tap('#confirm'); await viewerReady(); await tapPlan(x / 1224, y / 792); await tap('#pvDone'); await page.waitForTimeout(250); }
await page.locator('#toBook').click(); await page.waitForSelector('table.book');
await tap('#shareBtn'); await page.waitForSelector('.paperwrap', { timeout: 15000 }); await page.waitForTimeout(800);
{ const t = await page.locator('.pager span').textContent(); const np = Number((t.match(/of (\d+)/) || [0, 1])[1]); for (let i = 1; i < np; i++) await tap('#pn'); }
await page.waitForTimeout(1200);
const mapSel = '.paper .planmap img';
await page.locator('.paperwrap').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await cap('plan-report', [mapSel]);
// --- report import
await openJob(); await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 9999)); await cap('import-menu', ['#impSurvey']);
await page.locator('.recent button', { hasText: 'Run 1' }).click(); await page.waitForSelector('table.book');
await tap('#shareBtn'); await page.waitForSelector('.paper'); await tap('#fmt button[data-v="pdf"]');
{ const [dl] = await Promise.all([page.waitForEvent('download'), tap('#saveF')]); await dl.saveAs('/tmp/lb-manual-run.pdf'); }
await page.goto(BASE + '#/'); await page.waitForSelector('#impReport'); await cap('import-jobs', ['#impReport']);
{ const [ch] = await Promise.all([page.waitForEvent('filechooser'), tap('#impReport')]); await ch.setFiles('/tmp/lb-manual-run.pdf'); }
await page.waitForSelector('.dialog [data-ok]'); await cap('import-confirm', ['.dialog p', '.dialog [data-ok]']);
await tap('.dialog [data-c]');
// --- open level run (no closing benchmark) – v1.3.1 preview
await openJob(); await tap('.modecard[data-mode="run"]'); await page.waitForSelector('#sn');
await page.fill('#sn', 'Storm line MH-4'); await page.fill('#bme', '102.450');
if ((await page.locator('#planSw').count()) && (await page.locator('#planSw').getAttribute('aria-checked')) === 'true') await tap('#planSw');
await scrollTo('#cbNote', 140); await cap('run-setup-open', ['#cbNote', '#cbn', '#start']);
await tap('#start'); await page.waitForSelector('#keypad');
await keys('5.31'); await tap('#keypad [data-k="next"]'); await keys('150'); await tap('#confirm'); await page.waitForTimeout(300);
await keys('4.53'); await tap('#keypad [data-k="next"]'); await keys('145'); await tap('#confirm'); await page.waitForTimeout(300);
if (!(await page.locator('#keypad').count())) { await tap('#next'); await page.waitForSelector('#keypad'); }
await keys('6.02'); await tap('#keypad [data-k="next"]'); await keys('160'); await tap('#confirm'); await page.waitForTimeout(300);
await page.fill('#pt', 'MH-4 INV'); await page.locator('#pt').dispatchEvent('change'); await page.waitForTimeout(150);
await keys('3.10'); await tap('#keypad [data-k="next"]'); await keys('155'); await tap('#confirm'); await page.waitForTimeout(300);
await tap('#bookBtn'); await page.waitForSelector('table.book');
await cap('open-run-book', ['#closeBtn']);
await tap('#closeBtn'); await page.waitForSelector('#spName');
await cap('open-run-finish', ['#spName', '.dialog .kv', '.dialog [data-ok]']);
await tap('.dialog [data-ok]'); await page.waitForSelector('#openRes');
await cap('open-run-result', ['#openRes', ['.kv', 0]]);
await scrollTo('#knownElev', 300); await cap('open-run-known', ['#knownElev', '#addKnown']);
// --- pipe slope calculator
await openJob(); await page.locator('.scroll').evaluate((e) => e.scrollTo(0, 0)); await tap('.modecard[data-mode="pipe"]'); await page.waitForSelector('#psStart');
await page.fill('#psStart', '852.40'); await page.fill('input[data-f="len"][data-i="0"]', '150'); await page.fill('input[data-f="slope"][data-i="0"]', '1.00');
await tap('#psAdd'); await page.fill('input[data-f="len"][data-i="1"]', '220.5'); await page.fill('input[data-f="slope"][data-i="1"]', '0.75');
await tap('#psAdd'); await page.fill('input[data-f="len"][data-i="2"]', '98'); await page.fill('input[data-f="slope"][data-i="2"]', '2.08');
await page.locator('#pipeScroll').evaluate((e) => e.scrollTo(0, 0)); await page.evaluate(() => document.activeElement && document.activeElement.blur());
await cap('pipe-input', ['#psStart', ['input[data-f="len"]', 0], ['input[data-f="slope"]', 0], ['.psdir', 0], ['#psr0']]);
await scrollTo('#psAdd', 360); await cap('pipe-results', ['#psAdd', '.pstable', '#psTot', '#psCsv']);
await page.fill('input[data-f="slope"][data-i="1"]', '120'); await scrollTo('.pipesec[data-i="1"]', 120); await cap('pipe-error', ['#psm1', '#psr2']);
await page.fill('input[data-f="slope"][data-i="1"]', '0.75');
// --- Free vs Pro (fresh Free state)
await page.evaluate(() => { sessionStorage.setItem('lbFree', '1'); localStorage.clear(); indexedDB.deleteDatabase('levelbook-ent'); indexedDB.deleteDatabase('levelbook-plans'); });
await page.goto(BASE + '#/'); await page.reload(); await page.waitForSelector('.jobcard');
if (await page.locator('#wlGo').count()) await tap('#wlGo');
await page.locator('.jobcard', { hasText: 'Pearland' }).click({ position: { x: 120, y: 20 } }); await page.waitForSelector('.modecard');
await cap('free-menu', [['.modecard', 0], ['.modecard', 3]]);
await tap('.modecard[data-mode="loop"]'); await page.waitForSelector('#upTrial');
await cap('pro-upgrade', ['#upTrial', '.upg-price']);
await tap('.sheet [data-close]');
await page.goto(BASE + '#/'); await page.waitForSelector('.jobcard');
for (const nm of ['North pad TBMs', 'Clubhouse grades']) { await tap('#newJob'); await page.waitForSelector('#jn'); await page.fill('#jn', nm); await tap('#jok'); await page.waitForSelector('.modecard'); await tap('[data-back]'); await page.waitForSelector('.jobcard'); }
await tap('#newJob'); await page.waitForTimeout(400);
await cap('job-limit', ['.upg-msg', '#upTrial']);
await tap('.sheet [data-close]');
await tap('[data-act="settings"]'); await page.waitForSelector('#proStatus');
await cap('free-settings', ['#proStatus']);
fs.writeFileSync(OUT + 'boxes.json', JSON.stringify(boxes, null, 1));
console.log('shots', Object.keys(boxes).length, 'errors:', errs.join(' | '));
await b.close();
