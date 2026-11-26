// Real-browser click-through. Usage: node tests/e2e.js [baseUrl] [shotDir]
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const base0 = process.argv[2], shots = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let server, base = base0;
  if (!base) {
    const root = path.join(__dirname, '..');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    server = http.createServer((q, s) => { const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
      fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); s.end(d); }); }).listen(0);
    base = 'http://127.0.0.1:' + server.address().port + '/';
  }
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png') }); } };
  const txt = s => page.$eval(s, e => e.textContent.trim());
  const setv = async (s, v) => { await page.focus(s); await page.$eval(s, e => { try { e.select(); } catch (_) {} e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); if (v !== '') await page.type(s, String(v)); };
  const ok = (n) => console.log('ok -', n);
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
  assert.equal(await page.$eval('html', e => e.dir), 'rtl'); ok('starts Arabic RTL');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow'); ok('no horizontal overflow on 390px');
  await shot('01-mobile-ar');
  // numbers
  await setv('#takeHome', 20000); await setv('#hoursPerWeek', 40); await setv('#weeksOff', 4); await setv('#nonBillablePct', ''); 
  await page.$eval('#nonBillablePct', e => { e.value = 25; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await setv('#taxPct', 10); await setv('#marginPct', '');
  await page.$eval('#marginPct', e => { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#deductible', e => e.click());
  // clear expenses, add yearly+monthly
  while (await page.$('#expList .x')) await page.click('#expList .x');
  await page.type('#expName', 'Net'); await page.type('#expAmt', '1000'); await page.click('#expForm button');
  await page.type('#expName', 'Course'); await page.type('#expAmt', '12000'); await page.select('#expPer', 'y'); await page.click('#expForm button');
  assert.equal((await page.$$('#expList li')).length, 2); ok('add expenses');
  await page.select('#roundTo', '1');
  // expected: non-deductible? we toggled to false (default true)
  const exp = (20000 / 0.9 + 2000) ; // deductible false after click -> recompute below
  const dedu = await page.$eval('#deductible', e => e.checked);
  const rev = dedu ? 20000 / 0.9 + 2000 : 22000 / 0.9;
  const hours = 40 * 0.75 * 48 / 12;
  const want = Math.round(rev / hours);
  const got = Number((await txt('#hourly')).replace(/[^0-9]/g, ''));
  assert.equal(got, want, 'hourly ' + got + ' vs ' + want); ok('hourly rate matches formula: ' + got);
  assert.ok((await page.$$('#legend li')).length >= 3); ok('breakdown legend');
  await shot('02-mobile-rate');
  // preset
  await page.click('.pre'); assert.equal((await page.$$('#expList li')).length, 3); ok('preset chip');
  // persistence
  await page.reload({ waitUntil: 'load' });
  assert.equal(await page.$eval('#takeHome', e => e.value), '20000'); assert.equal((await page.$$('#expList li')).length, 3); ok('persists after reload');
  // language
  await page.click('#lang'); assert.equal(await page.$eval('html', e => e.dir), 'ltr');
  assert.match(await txt('.tabs button'), /Your rate/); ok('switch to English LTR');
  await shot('03-mobile-en');
  // quote
  await page.click('#useRate'); assert.ok(await page.$eval('#tab-quote', e => !e.hidden)); ok('use in quote opens quote tab');
  const rate = Number(await page.$eval('#qRate', e => e.value)); assert.ok(rate > 0);
  await setv('#qHours', 10); await setv('#qRev', 20); await setv('#qRush', 0); await setv('#qFixed', 100); await setv('#qDisc', 0);
  await page.type('#qClient', 'Acme'); await page.type('#qProject', 'Logo');
  const total = rate * 10 * 1.2 + 100;
  const shown = Number((await txt('#rTotal')).replace(/[^0-9]/g, ''));
  assert.ok(Math.abs(shown - Math.round(total)) <= 1, shown + ' vs ' + total); ok('quote total ' + shown);
  await setv('#qBudget', 500);
  assert.ok(await page.$eval('#verdict', e => !e.hidden && e.classList.contains('below'))); ok('budget verdict: below');
  await setv('#qBudget', 100000);
  assert.ok(await page.$eval('#verdict', e => e.classList.contains('ok'))); ok('budget verdict: ok');
  await shot('04-mobile-quote');
  await page.click('#saveQuote'); await page.click('.tabs button[data-tab=saved]');
  assert.equal((await page.$$('#savedList li')).length, 1); assert.match(await txt('#savedList'), /Acme/); ok('save quote and list it');
  // copy quote text
  await page.click('.tabs button[data-tab=quote]'); await page.click('#copyQuote');
  assert.match(await page.evaluate(() => window.__lastCopy), /Acme/); ok('copy quote text');
  // export / import
  await page.click('.tabs button[data-tab=saved]');
  const data = await page.evaluate(() => localStorage.getItem('ta3rifa.v1'));
  assert.ok(JSON.parse(data).quotes.length === 1); ok('stored in localStorage');
  const tmp = '/tmp/ta3-import.json'; const o = JSON.parse(data); o.takeHome = 33333; fs.writeFileSync(tmp, JSON.stringify(o));
  const fi = await page.$('#importFile'); await fi.uploadFile(tmp); await sleep(300);
  assert.equal(await page.$eval('#takeHome', e => e.value), '33333'); ok('import restores data');
  fs.writeFileSync(tmp, '{bad'); await (await page.$('#importFile')).uploadFile(tmp); await sleep(300);
  assert.equal(await page.$eval('#takeHome', e => e.value), '33333'); ok('bad import rejected');
  // delete quote
  page.once('dialog', d => d.accept()); await page.click('#savedList [data-act=del]');
  assert.equal((await page.$$('#savedList li')).length, 0); ok('delete quote');
  // dark theme + desktop
  await page.click('#theme'); assert.equal(await page.$eval('html', e => e.getAttribute('data-theme')), 'dark'); ok('dark theme');
  await page.click('.tabs button[data-tab=rate]');
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await shot('05-desktop-dark');
  await page.click('#theme'); await page.click('#lang'); await shot('06-desktop-ar');
  // edge: zero hours
  await setv('#hoursPerWeek', 0); assert.equal(await txt('#hourly'), '0'); assert.ok(await page.$eval('#warn', e => !e.hidden)); ok('zero hours handled');
  assert.deepEqual(errors, [], 'console errors: ' + errors.join('|')); ok('no console errors');
  await browser.close(); if (server) server.close();
  console.log('E2E PASSED');
})().catch(e => { console.error('E2E FAILED:', e.message); process.exit(1); });
