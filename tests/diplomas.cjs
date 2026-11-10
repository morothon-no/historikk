const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('../scripts/diploma-harness.cjs');
let harness, history, assets, dates;
before(async () => {
  harness = await createHarness();
  const root = path.resolve(__dirname, '..');
  [history, assets, dates] = await Promise.all(['history', 'badges', 'event-dates'].map(async file => JSON.parse(await fs.readFile(path.join(root, 'data', `${file}.json`), 'utf8'))));
});
after(async () => { await harness?.close(); });
async function load(overrides = {}, width = 1440) {
  const context = await harness.browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [file, content] of Object.entries(overrides)) await page.route(`**/data/${file}.json`, route => route.fulfill({ json: content }));
  await page.goto(harness.base); await page.waitForFunction(() => !document.querySelector('#loading'));
  return { context, page, errors };
}

test('diploma content: actual profiles, earned milestones, record qualification and year/date selection', async () => {
  const { context, page, errors } = await load();
  try {
    const actual = await page.evaluate(async () => {
      const requests = [
        ['Gunnar Kåsa', 'badge:35'], ['Morten Borø', 'badge:35'], ['Finn Gerhard Olsen', 'badge:30'],
        ['Solbjørg Tronstad Hausvik', 'badge:25'], ['Inger Katherin Dahl Frantzen', 'badge:10'], ['Lars Aasheim Svaland', 'record:0']
      ];
      const models = [];
      for (const [name, key] of requests) {
        const p = S.people.find(p => p.n === name), m = await MorothonDiplomas.prepare(p.i, key);
        models.push({ name: m.name, key, year: m.year, count: m.count, date: m.dateLabel, achievement: m.achievement, citation: m.citation });
      }
      const g = S.people.find(p => p.n === 'Gunnar Kåsa');
      const oldBadge = await MorothonDiplomas.prepare(g.i, 'badge:5');
      const enny = MorothonDiplomas.choices('MOR-4CB0E52');
      let rejectsUnearned = false;
      try { MorothonDiplomas.model('MOR-96EB117', 'badge:5'); } catch { rejectsUnearned = true; }
      const recordChoices = MorothonDiplomas.choices('MOR-96EB117');
      const debut = S.people.find(p => p.c === 1 && p.f === 2026);
      return { models, oldDate: oldBadge.dateLabel, oldYear: oldBadge.year, rejectsUnearned,
        larsBadges: recordChoices.filter(o => o.type === 'badge').length,
        larsRecords: recordChoices.filter(o => o.type === 'record').length,
        enny: enny.map(o => [o.key, o.year]), debut: MorothonDiplomas.model(debut.i, 'debut') };
    });
    assert.deepEqual(actual.models.map(m => [m.name, m.year, m.count]), [
      ['Gunnar Kåsa', 2026, 35], ['Morten Borø', 2026, 35], ['Finn Gerhard Olsen', 2025, 30],
      ['Solbjørg Tronstad Hausvik', 2026, 25], ['Inger Katherin Dahl Frantzen', 2024, 10], ['Lars Aasheim Svaland', 2026, 4]
    ]);
    assert.equal(actual.models[0].date, 'Søgne, 7. november 2026');
    assert.equal(actual.models[2].date, 'Søgne, 8. november 2025');
    assert.equal(actual.models[4].date, 'Søgne, 9. november 2024');
    assert.equal(actual.models[5].achievement, '1:31:24');
    assert.match(actual.models[0].citation, /Alle 35 arrangerte utgaver.*100 % gjennom hele historien/);
    assert.equal(actual.oldYear, 1996); assert.equal(actual.oldDate, 'Søgne, 1996');
    assert.equal(actual.rejectsUnearned, true); assert.equal(actual.larsBadges, 0); assert.equal(actual.larsRecords, 1);
    assert.equal(actual.enny.filter(o => o[0] === 'debut')[0][1], 1999);
    assert.equal(actual.enny.some(o => o[0] === 'badge:25'), false);
    assert.equal(actual.debut.title, 'Min første Morothon'); assert.equal(actual.debut.threshold, null);
    assert.equal(dates.dates['2018'], '2018-11-11');
    assert.equal(new Date(dates.dates['2018'] + 'T12:00:00Z').getUTCDay(), 0);
    assert.match(dates.source.name, /EQ Timing/);
    const date2018 = await page.evaluate(register => MorothonDiplomas.dateLabel(2018, register), dates);
    assert.equal(date2018, 'Søgne, 11. november 2018');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('asset quality: original dimensions, true DPI, checksum review and no false print readiness', async () => {
  const { context, page, errors } = await load();
  try {
    const quality = await page.evaluate(async () => {
      const items = [];
      for (const key of ['badge-5', 'badge-10', 'badge-15', 'badge-20', 'badge-25', 'badge-30', 'badge-35', 'record', 'debut']) {
        const a = await MorothonDiplomas.inspectAsset(key);
        items.push({ key, width: a.width, height: a.height, dpi: a.dpi, ready: a.ready, issues: a.issues, edges: a.edgeContact });
      }
      return items;
    });
    assert.deepEqual(quality.filter(a => !a.ready).map(a => a.key), []);
    assert.ok(quality.filter(a => !a.ready).every(a => a.issues.length > 0));
    const honorary = quality.find(a => a.key === 'badge-35');
    assert.equal(honorary.width, 700); assert.equal(honorary.height, 700); assert.equal(honorary.edges, 0); assert.deepEqual(honorary.issues, []);
    assert.ok(honorary.dpi > 323 && honorary.dpi < 324); assert.equal(honorary.ready, true);
    assert.equal(quality.find(a => a.key === 'record').ready, true);
    assert.equal(quality.find(a => a.key === 'debut').ready, true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  const tampered = structuredClone(assets); tampered.badges.find(b => b.id === 'badge-35').reviewedSha256 = 'different-source';
  const changed = await load({ badges: tampered });
  try { assert.equal(await changed.page.evaluate(async () => (await MorothonDiplomas.inspectAsset('badge-35')).ready), false); }
  finally { await changed.context.close(); }
});

test('diploma preview: A4 layout, responsive scaling, gated print/PDF and returning to the profile', async () => {
  for (const width of [320, 390, 1440]) {
    const { context, page, errors } = await load({}, width);
    try {
      await page.evaluate(() => openProfile('MOR-15AF3A3'));
      await page.locator('[data-diploma-person]').click();
      await page.waitForFunction(() => MorothonDiplomas.current()?.key === 'badge:35');
      assert.equal(await page.locator('[data-diploma-print]').isEnabled(), true);
      assert.equal(await page.locator('[data-diploma-pdf]').isEnabled(), true);
      const result = await page.evaluate(() => {
        const d = MorothonDiplomas.current(), frame = document.querySelector('#diplomaDialog iframe'), doc = frame.contentDocument;
        const image = doc.querySelector('.diploma-medal'), img = image.getBoundingClientRect(), style = getComputedStyle(image);
        return { ready: d.ready, layout: d.layout, date: doc.querySelector('.diploma-date p').textContent,
          contain: style.objectFit, signature: doc.querySelector('.diploma-signature').textContent,
          heading: doc.querySelector('.diploma-heading h1').textContent,
          metricValues: [...doc.querySelectorAll('.diploma-metric>strong')].map(el => el.textContent),
          edition: doc.querySelector('.diploma-edition b').textContent,
          cells: [...doc.querySelectorAll('.diploma-main>*')].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, y: r.top + r.height / 2 }; }),
          w: img.width, h: img.height, previewFits: frame.getBoundingClientRect().width <= document.querySelector('.diploma-preview').clientWidth + 1 };
      });
      assert.equal(result.ready, true); assert.equal(result.layout.ready, true);
      assert.equal(result.heading, 'HEDERSDIPLOM'); assert.deepEqual(result.metricValues, ['35', '100 %']);
      assert.equal(result.edition, '35. UTGAVE');
      assert.ok(result.cells[0].right < result.cells[1].left && result.cells[1].right < result.cells[2].left);
      assert.ok(Math.abs(result.cells[0].y-result.cells[1].y)<1 && Math.abs(result.cells[1].y-result.cells[2].y)<1);
      assert.ok(Math.abs(result.layout.width / result.layout.height - 297 / 210) < .001);
      assert.equal(result.date, 'Søgne, 7. november 2026'); assert.equal(result.contain, 'contain');
      assert.equal(result.previewFits, true); assert.match(result.signature, /Håkon Lohne.*Løpsleder Morothon/);
      await page.evaluate(() => { window.__diplomaPrintCalls = 0; document.querySelector('#diplomaDialog iframe').contentWindow.print = () => window.__diplomaPrintCalls++; });
      await page.locator('[data-diploma-print]').dispatchEvent('click'); await page.locator('[data-diploma-pdf]').dispatchEvent('click');
      assert.equal(await page.evaluate(() => window.__diplomaPrintCalls), 2);
      await page.selectOption('#diplomaChoice', 'badge:5');
      await page.waitForFunction(() => MorothonDiplomas.current()?.key === 'badge:5');
      assert.equal(await page.locator('[data-diploma-print]').isEnabled(), true);
      assert.equal(await page.locator('[data-diploma-pdf]').isEnabled(), true);
      assert.match(await page.locator('#diplomaStatus').textContent(), /godkjent med dokumenterte begrensninger/);
      assert.equal(await page.frameLocator('#diplomaDialog iframe').locator('.diploma-date p').textContent(), 'Søgne, 1996');
      assert.equal(await page.frameLocator('#diplomaDialog iframe').locator('.diploma-draft').count(), 0);
      await page.keyboard.press('Escape');
      await page.locator('#diplomaDialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#diplomaDialog').isVisible(), false);
      assert.equal(await page.locator('#panel').isVisible(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('all seven diploma variants plus record and debut: content fits A4; Gunnar exports as a single landscape PDF', async () => {
  const { context, page, errors } = await load();
  try {
    const samples = await page.evaluate(() => [
      ...[5, 10, 15, 20, 25, 30, 35].map(n => ({ pid: S.people.find(p => p.c >= n && p.c < n + 5).i, key: `badge:${n}` })),
      { pid: 'MOR-96EB117', key: 'record:0' }, { pid: S.people.find(p => p.c === 1 && p.f === 2026).i, key: 'debut' }
    ]);
    for (const sample of samples) {
      await page.evaluate(sample => MorothonDiplomas.open(sample.pid), sample);
      await page.selectOption('#diplomaChoice', sample.key);
      await page.waitForFunction(key => MorothonDiplomas.current()?.key === key, sample.key);
      assert.equal(await page.evaluate(() => MorothonDiplomas.current().layout.ready), true);
      await page.locator('[data-diploma-close]').click();
    }
    const prepared = await page.evaluate(async () => MorothonDiplomas.documentHtml(await MorothonDiplomas.prepare('MOR-15AF3A3', 'badge:35')));
    const documentPage = await context.newPage();
    await documentPage.setContent(prepared, { waitUntil: 'load' });
    await documentPage.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    const pdf = await documentPage.pdf({ format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    const info = execFileSync('pdfinfo', ['-'], { input: pdf }).toString();
    assert.match(info, /Pages:\s+1\b/);
    const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
    assert.ok(size && Math.abs(Number(size[1]) - 841.89) < 1 && Math.abs(Number(size[2]) - 595.28) < 1);
    const text = execFileSync('pdftotext', ['-', '-'], { input: pdf }).toString().replace(/\s+/g, ' ');
    for (const value of ['Gunnar Kåsa', '35', 'Håkon Lohne', '7. november 2026', '100 % gjennom hele historien']) assert.ok(text.toLocaleLowerCase('nb-NO').includes(value.toLocaleLowerCase('nb-NO')), value);
    assert.equal(text.replace(/\s+/g, '').includes('FORHÅNDSVISNING'), false);
    assert.ok(text.replace(/\s+/g, '').toLowerCase().includes('deltakelser'));
    const imageList = execFileSync('pdfimages', ['-list', '-'], { input: pdf }).toString();
    const medal = imageList.split('\n').find(line => /\bimage\s+700\s+700\b/.test(line));
    assert.ok(medal, 'The recovered native 700×700 official original must remain embedded unchanged');
    const columns = medal.trim().split(/\s+/);
    assert.ok(Number(columns[12]) >= 300 && Number(columns[13]) >= 300, 'PDF retains the actual 700px original at 300+ DPI');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('future editions, DNS/DNF, duplicate starts, merged identities and historical award years stay consistent', async () => {
  for (const participates of [false, true]) {
    const future = structuredClone(history);
    future.yearStats.push([2027, 1, participates ? 1 : 0]);
    future.results.push([2027, 'MOR-15AF3A3', 'Morothon', '20 km', participates ? 'DNF' : 'DNS', participates ? 'DNF' : 'DNS']);
    future.results.push([2026, 'MOR-15AF3A3', 'Kortmoro', '10 km', 'Fullført', '1:00:00']);
    const { context, page, errors } = await load({ history: future });
    try {
      const info = await page.evaluate(async () => {
        const m = await MorothonDiplomas.prepare('MOR-15AF3A3', 'badge:35');
        const e = MorothonDiplomas.model('MOR-4CB0E52', 'debut');
        return { count: m.count, year: m.year, all: m.allEditions, citation: m.citation, enny: [e.pid, e.count, e.year], futureDate: MorothonDiplomas.dateLabel(2027, { dates: {} }) };
      });
      assert.equal(info.count, 35); assert.equal(info.year, 2026); assert.equal(info.all, true);
      assert.equal(info.citation.includes('100 %'), true);
      assert.equal(info.citation.includes('Alle 35'), true);
      assert.deepEqual(info.enny, ['MOR-72A949A', 23, 1999]); assert.equal(info.futureDate, 'Søgne, 2027');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('invalid date registers cannot silently produce a false exact date', async () => {
  const invalid = structuredClone(dates); invalid.dates['2018'] = '2018-02-31';
  const { context, page } = await load({ 'event-dates': invalid });
  try {
    const failed = await page.evaluate(async () => { try { await MorothonDiplomas.prepare('MOR-15AF3A3', 'badge:35'); return false; } catch { return true; } });
    assert.equal(failed, true);
  } finally { await context.close(); }
});


test('long names fit the certificate and layout verification rejects an oversized medal', async () => {
  const { context, page, errors } = await load();
  try {
    await page.evaluate(() => { person('MOR-C788866').n = 'Inger Katherin Dahl Frantzen Med Et Langt Historisk Navn Som Skal Vises Uten Beskjæring'; });
    await page.evaluate(() => MorothonDiplomas.open('MOR-C788866'));
    assert.equal(await page.evaluate(() => MorothonDiplomas.current().layout.ready), true);
    const failed = await page.evaluate(async () => {
      const doc = document.querySelector('#diplomaDialog iframe').contentDocument;
      doc.querySelector('.diploma-medal').style.height = '150mm';
      return await MorothonDiplomas.checkLayout(doc);
    });
    assert.equal(failed.ready, false);
    assert.ok(failed.failures.some(issue => issue.includes('Medaljen')));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
