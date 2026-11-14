// Local C1 pilot, using only approved public data. No source registry or 86-page gallery.
const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const { startAdmin } = require('../../../scripts/diploma-admin.cjs');
const { normalizeItems, inspectPdf } = require('../../../tools/diploma-admin/worker.cjs');
const { validatePublicSite } = require('../../../scripts/build-site.cjs');
let app, browser, out;
const runner = (name, key, display = 'latest') => { const p = app.worker.catalog.find(p => p.kind === 'runner' && p.name === name); assert.ok(p, name); return { kind: p.kind, personId: p.personId, key: key || p.defaultKey, display }; };
const honor = (personId, key = 'service-aeresmerke', display = 'all') => ({ kind: 'honor', personId, key, display });
before(async () => {
  out = process.env.MOROTHON_C1_REVIEW_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'morothon-c1-review-'));
  await fs.mkdir(out, { recursive: true }); app = await startAdmin();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await app?.close(); if (!process.env.MOROTHON_C1_REVIEW_DIR && out) await fs.rm(out, { recursive: true, force: true }); });
test('C1 validates job identities and variants, deduplicates repeated selections, and preserves deliberate historical choices', () => {
  const a = runner('Inger Katherin Dahl Frantzen', 'badge:10');
  assert.equal(normalizeItems([a, a, { ...a, key: 'badge:5' }, { ...a, display: 'all' }]).length, 3);
  for (const items of [[], Array(101).fill(a), [{ ...a, personId: '../other' }], [{ ...a, html: '<b>unsafe</b>' }], [{ ...a, display: 'unknown' }]]) assert.throws(() => normalizeItems(items));
});
test('C1 is loopback-only, rejects foreign origins/hosts and missing session tokens, and never serves original registers or hidden Heder profiles', async () => {
  assert.match(app.origin, /^http:\/\/127\.0\.0\.1:/);
  assert.equal(app.worker.catalog.filter(p => p.kind === 'honor').length, 43);
  assert.equal(app.worker.catalog.some(p => p.kind === 'honor' && p.personId === 'erling-danielsen'), false);
  assert.ok(app.worker.catalog.some(p => p.kind === 'honor' && p.personId === 'einar-danielsen'));
  assert.equal((await fetch(app.origin + '/api/catalog')).status, 403);
  assert.equal((await fetch(app.origin + '/api/catalog', { headers: { 'X-Morothon-Token': app.token, Origin: 'https://untrusted.example' } })).status, 403);
  const foreignHost = await new Promise((resolve, reject) => { const req = require('node:http').get(app.origin + '/', { headers: { Host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(foreignHost, 403);
  for (const file of ['/data/honors.json', '/.git/config', '/tools/diploma-admin/worker.cjs', '/site/data/../honors.json']) assert.equal((await fetch(app.origin + file)).status, 404);
  assert.equal((await fetch(app.origin + '/api/export', { method: 'POST', headers: { 'X-Morothon-Token': app.token, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  const hidden = await app.worker.check([honor('erling-danielsen')]); assert.equal(hidden.entries[0].status, 'blocked');
  await assert.rejects(() => app.worker.produce([honor('erling-danielsen')], { allowControlCopies: true }), /ikke tilgjengelig/);
  const built = await validatePublicSite(app.site); assert.equal(built.files, 68); assert.equal(built.visiblePeople, 43);
  for (const name of ['tools', 'admin.js', 'scripts', 'docs']) await assert.rejects(() => fs.access(path.join(app.site, name)));
});
test('C1 uses earned historical runner snapshots, only earlier medals, both Heder variants, long names and Einars agreed date', async () => {
  const longest = app.worker.catalog.filter(p => p.kind === 'runner').sort((a, b) => b.name.length - a.name.length)[0]; assert.ok(longest.name.length >= 30);
  const result = await app.worker.check([
    runner('Inger Katherin Dahl Frantzen', 'badge:5', 'all'), runner('Inger Katherin Dahl Frantzen', 'badge:10', 'all'), runner('Inger Katherin Dahl Frantzen', 'badge:10'),
    honor('oscar-lohne'), honor('oscar-lohne', 'service-aeresmerke', 'latest'), honor('einar-danielsen'),
    { kind: 'runner', personId: longest.personId, key: longest.defaultKey, display: 'latest' }
  ]);
  assert.ok(result.entries.every(e => e.status !== 'blocked'), JSON.stringify(result.entries.map(e => [e.name, e.errors])));
  const [bronze, silver, latest, oscar, oscarLatest, einar] = result.entries;
  assert.equal(silver.count, 10); assert.equal(silver.period, '2015–2024'); assert.equal(silver.date, 'Søgne, 9. november 2024');
  assert.deepEqual(silver.priorBadges, ['badge-5']); assert.deepEqual(bronze.priorBadges, []); assert.deepEqual(latest.priorBadges, []);
  assert.equal(silver.status, 'control'); assert.equal(latest.status, 'approved');
  assert.ok(oscar.priorBadges.includes('service-dugnad-30')); assert.deepEqual(oscarLatest.priorBadges, []);
  assert.equal(oscar.status, 'approved'); assert.equal(oscarLatest.status, 'approved');
  assert.equal(einar.status, 'control');
  assert.equal(einar.count, 33); assert.equal(einar.date, 'Søgne, 7. november 2026'); assert.equal(einar.year, null); assert.equal(einar.period, null);
  const invalid = await app.worker.check([runner('Inger Katherin Dahl Frantzen', 'badge:15'), honor('oscar-lohne', 'service-dugnad-30')]);
  assert.ok(invalid.entries.every(e => e.status === 'blocked'));
});
test('C1 ordinary record/debut, undated founders and memorial profiles retain their existing special rules', async () => {
  const memorial = app.worker.catalog.find(p => p.kind === 'honor' && p.defaultKey === 'service-memorial'); assert.ok(memorial);
  const result = await app.worker.check([
    runner('Lars Aasheim Svaland', 'record:0', 'all'), runner('Inger Katherin Dahl Frantzen', 'debut', 'all'),
    honor('helge-reisvoll', 'service-grunnlegger', 'latest'), honor(memorial.personId, memorial.defaultKey),
    runner('Ingrid Ukkelberg', 'record:0', 'all')
  ]);
  assert.ok(result.entries.every(e => e.status !== 'blocked'), JSON.stringify(result.entries.map(e => e.errors)));
  assert.equal(result.entries[0].year, 2026); assert.equal(result.entries[0].assetKey, 'record');
  assert.equal(result.entries[1].year, 2015); assert.deepEqual(result.entries[1].priorBadges, []);
  assert.equal(result.entries[2].date, null); assert.equal(result.entries[2].period, null); assert.equal(result.entries[2].year, null);
  assert.equal(result.entries[3].assetKey, 'service-memorial');
  assert.equal(result.entries[4].year, 2023); assert.equal(result.entries[4].status, 'control'); assert.deepEqual(result.entries[4].priorBadges, ['badge-5', 'badge-10']);
});
test('C1 missing content approval cannot produce a clean diploma; explicit control export retains visible marking and embedded fonts', async () => {
  const item = honor('jon-fjeld', 'service-dugnad-10');
  const result = await app.worker.check([item]); assert.equal(result.entries[0].status, 'control');
  assert.equal(result.entries[0].period, '2014–2023'); assert.equal(result.entries[0].date, 'Søgne, 11. november 2023');
  await assert.rejects(() => app.worker.produce([item]), /kontrollkopi/);
  const produced = await app.worker.produce([item], { allowControlCopies: true });
  assert.equal(produced.report.formalIssuance, false); assert.equal(produced.report.entries[0].status, 'control');
  await fs.copyFile(produced.pdf, path.join(out, 'jon-fjeld-kontrollkopi.pdf'));
  await fs.writeFile(path.join(out, 'jon-fjeld-rapport.json'), JSON.stringify(produced.report, null, 2));
});
test('C1 organizer UI searches, filters, selects, reorders and exports six A4 pages for five people, including both medal displays on mobile and PC', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true }), p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto(app.origin + '/#diplomer'); await p.getByText('Klar. Velg et utvalg eller prøv fem mottakere.').waitFor();
    await p.selectOption('#kind', 'runner'); await p.fill('#search', 'Inger Katherin'); await p.selectOption('#year', '2024');
    assert.equal(await p.locator('.recipient').count(), 1); await p.selectOption('#year', '2023'); assert.equal(await p.locator('.recipient').count(), 0);
    await p.selectOption('#year', 'all'); await p.selectOption('#kind', 'honor'); await p.fill('#search', 'Oscar'); assert.equal(await p.locator('.recipient').count(), 1);
    assert.equal(await p.locator('.recipient select option').count(), 1);
    await p.selectOption('#kind', 'all'); await p.fill('#search', ''); await p.click('#demo');
    assert.equal(await p.locator('.job-row').count(), 5);
    await p.selectOption('#display', 'all'); await p.fill('#search', 'Inger Katherin'); await p.locator('.recipient').getByRole('button', { name: 'Velg', exact: true }).click();
    await p.click('#addAll'); assert.equal(await p.locator('.job-row').count(), 6);
    await p.getByRole('button', { name: 'Flytt Inger Katherin Dahl Frantzen ned', exact: true }).first().click();
    await p.locator('#job .job-row').last().getByRole('button', { name: 'Fjern', exact: true }).click(); assert.equal(await p.locator('.job-row').count(), 5);
    await p.locator('.recipient').getByRole('button', { name: 'Velg', exact: true }).click();
    await p.click('#check'); await p.getByText('Kontrollen er ferdig. Se status på hver mottaker.').waitFor({ timeout: 180000 });
    assert.match(await p.locator('#exportSummary').innerText(), /6 A4-sider.*2 kontrollkopier.*0 sperrede/);
    assert.equal(await p.locator('#export').isDisabled(), true);
    await p.screenshot({ path: path.join(out, 'diplomverksted-pc.png'), fullPage: true });
    const row = p.locator('#job .job-row').last(); await row.getByRole('button', { name: 'Vis', exact: true }).click();
    await p.locator('#preview[open]').waitFor({ timeout: 60000 });
    await p.locator('#preview iframe').evaluate(f => new Promise(resolve => { if (f.contentDocument?.readyState === 'complete') resolve(); else f.onload = resolve; }));
    await p.screenshot({ path: path.join(out, 'historisk-solv-med-samling.png'), fullPage: true });
    await p.setViewportSize({ width: 390, height: 844 }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.screenshot({ path: path.join(out, 'forhaandsvisning-mobil.png'), fullPage: true }); await p.click('#closePreview');
    await p.screenshot({ path: path.join(out, 'diplomverksted-mobil.png'), fullPage: true });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.check('#allowControl'); await p.click('#export');
    await p.getByRole('button', { name: 'Last ned PDF · 6 sider' }).waitFor({ timeout: 180000 });
    await p.waitForFunction(() => [...document.querySelectorAll('#downloads button')].every(b => !b.disabled));
    const pdfEvent = p.waitForEvent('download'); await p.getByRole('button', { name: 'Last ned PDF · 6 sider' }).click(); await (await pdfEvent).saveAs(path.join(out, 'fem-mottakere-seks-diplomer.pdf'));
    const reportEvent = p.waitForEvent('download'); await p.getByRole('button', { name: 'Last ned produksjonsrapport' }).click(); await (await reportEvent).saveAs(path.join(out, 'produksjonsrapport.json'));
    const report = JSON.parse(await fs.readFile(path.join(out, 'produksjonsrapport.json'))); assert.equal(report.pageCount, 6); assert.equal(new Set(report.entries.map(e => e.name)).size, 5);
    const expectations = report.entries.map(e => ({ ...e, mode: e.status, expectedText: [e.name, e.date, 'Håkon Lohne'].filter(Boolean) }));
    const inspected = await inspectPdf(path.join(out, 'fem-mottakere-seks-diplomer.pdf'), expectations); assert.equal(inspected.pageCount, 6);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('C1 a real layout error on the last page aborts the entire batch and leaves no partial downloadable PDF', async () => {
  const failing = await startAdmin({ beforeCheck: async (p, item, index) => { if (index === 4) await p.evaluate(() => { document.querySelector('.diploma-recipient h2').style.transform = 'translateY(1000px)'; }); } });
  try {
    const items = [runner('Inger Katherin Dahl Frantzen'), runner('Finn Gerhard Olsen'), runner('Gunnar Kåsa'), honor('oscar-lohne'), honor('einar-danielsen')];
    await assert.rejects(() => failing.worker.produce(items), /Side 5 \(Einar Danielsen\).*Innholdet passer ikke/);
    assert.deepEqual((await fs.readdir(path.dirname(failing.site))).sort(), ['site']);
  } finally { await failing.close(); }
});
test('C1 can start, preview and produce a PDF in an isolated checkout without original registers, Git metadata or credentials', async () => {
  const { copyPublic } = require('../../helpers/public-package.cjs'), { promisify } = require('node:util'), { execFile } = require('node:child_process');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'morothon-c1-isolated-'));
  try {
    await copyPublic(dir); await fs.symlink(path.resolve(__dirname, '../../../node_modules'), path.join(dir, 'node_modules'), 'dir');
    for (const name of ['data', '.git', 'scripts/export-public-data.cjs', 'scripts/lib/public-data.cjs']) await assert.rejects(() => fs.access(path.join(dir, name)));
    const code = `(async()=>{const a=await require('./scripts/diploma-admin.cjs').startAdmin();try{const p=a.worker.catalog.find(p=>p.name==='Inger Katherin Dahl Frantzen'&&p.kind==='runner');const job=await a.worker.produce([{kind:p.kind,personId:p.personId,key:'badge:10',display:'latest'}]);console.log(JSON.stringify({people:a.worker.catalog.filter(p=>p.kind==='honor').length,pages:job.report.pageCount,status:job.report.entries[0].status}));}finally{await a.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`;
    const { stdout } = await promisify(execFile)(process.execPath, ['-e', code], { cwd: dir, timeout: 60000, env: { PATH: process.env.PATH, LANG: 'C.UTF-8', ...(process.env.CHROMIUM_PATH ? { CHROMIUM_PATH: process.env.CHROMIUM_PATH } : {}) } });
    assert.deepEqual(JSON.parse(stdout), { people: 43, pages: 1, status: 'approved' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('C1 changed approved inputs invalidate unfinished checks and exports rather than reusing a stale snapshot', async () => {
  const file = path.join(app.site, 'css/diplomas.css'), original = await fs.readFile(file);
  try { await fs.appendFile(file, '\n/* synthetic stale-job test */'); await assert.rejects(() => app.worker.check([runner('Inger Katherin Dahl Frantzen')]), /Start verktøyet på nytt/); }
  finally { await fs.writeFile(file, original); }
  await app.assertSnapshot();
});
