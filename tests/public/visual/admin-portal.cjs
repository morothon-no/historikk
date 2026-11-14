const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const { startAdmin } = require('../../../scripts/diploma-admin.cjs');
const { createPortalData } = require('../../../tools/diploma-admin/portal-data.cjs');
const root = path.resolve(__dirname, '../../..');
let app, browser, out, history, badges;
before(async () => {
  [history, badges] = await Promise.all(['history', 'badges'].map(n => fs.readFile(path.join(root, 'public-data/data', n + '.json'), 'utf8').then(JSON.parse)));
  app = await startAdmin(); browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  out = process.env.MOROTHON_C1_REVIEW_DIR ? path.join(process.env.MOROTHON_C1_REVIEW_DIR, 'portal-c11') : await fs.mkdtemp(path.join(os.tmpdir(), 'morothon-c11-'));
  await fs.mkdir(out, { recursive: true });
});
after(async () => { await browser?.close(); await app?.close(); if (!process.env.MOROTHON_C1_REVIEW_DIR && out) await fs.rm(out, { recursive: true, force: true }); });
const request = route => fetch(app.origin + '/api/' + route, { headers: { 'X-Morothon-Token': app.token } });
test('C1.1 portal derives current edition, participation, milestones, canonical identities and historical badges from the shared data model', async () => {
  const p = createPortalData({ history, badges, honorCount: 43 }), overview = p.overview();
  assert.equal(overview.latestParticipants, 398); assert.equal(overview.debutants, 195); assert.equal(overview.newBadges, 22); assert.equal(overview.latestYear, 2026); assert.equal(overview.honorCount, 43);
  const inger = p.participants(new URLSearchParams({ q: 'Inger Katherin Dahl Frantzen' })); assert.equal(inger.total, 1);
  const profile = p.participant(inger.people[0].id); assert.equal(profile.count, 12); assert.equal(profile.highestBadge.level, 10); assert.equal(profile.highestBadge.year, 2024); assert.equal(profile.nextBadge.remaining, 3);
  assert.deepEqual(profile.earned.map(b => b.level), [5, 10]); assert.ok(profile.results.length >= 12);
  assert.equal(p.participants(new URLSearchParams({ q: 'Finn Gerhard Olsen' })).people[0].count, 31);
  for (const name of ['Gunnar Kåsa', 'Morten Borø']) assert.equal(p.participants(new URLSearchParams({ q: name })).people[0].count, 35);
  const upcoming = p.badgeList(new URLSearchParams({ q: 'Inger Katherin', view: 'upcoming', level: '15' })); assert.equal(upcoming.total, 1);
  assert.equal(p.badgeList(new URLSearchParams({ q: 'Inger Katherin', view: 'earned', level: '15' })).total, 0);
  const merged = Object.keys(history.redirects)[0]; if (merged) assert.throws(() => p.participant(merged), /finnes ikke/);
});
test('C1.1 future editions, DNS, DNF, duplicate starts, registered aliases and redirects keep separate and dynamic participation rules', () => {
  const sample = { schemaVersion: 1, people: [{ i: 'P1', n: 'Løper En', g: 'Herre' }, { i: 'P2', n: 'Bare DNS', g: 'Dame' }], redirects: { OLD: 'P1' }, aliases: { OLD: ['Tidligere Navn'] },
    yearStats: [[2026], [2027]], results: [[2026, 'P1', 'Langmoro', '20 km', 'DNF', 'DNF'], [2026, 'OLD', 'Kortmoro', '10 km', 'Fullført', '50:00'], [2027, 'P1', 'Kortmoro', '10 km', 'Fullført', '49:00'], [2027, 'P2', 'Langmoro', '20 km', 'DNS', 'DNS']] };
  const p = createPortalData({ history: sample, badges, honorCount: 0 });
  assert.equal(p.overview().latestYear, 2027); assert.equal(p.overview().latestParticipants, 1); assert.equal(p.overview().runnerCount, 1);
  assert.equal(p.participant('P1').count, 2); assert.deepEqual(p.participant('P1').years, [2026, 2027]); assert.equal(p.participant('P2').count, 0);
  assert.equal(p.participants(new URLSearchParams({ q: 'Tidligere Navn' })).people[0].id, 'P1');
  assert.ok(p.participant('P1').results.some(r => r.status === 'DNF')); assert.equal(p.participant('P2').nextBadge, null);
  assert.equal(p.participants(new URLSearchParams()).total, 2);
});
test('C1.1 all portal APIs share local session enforcement, reject invalid queries and remain read-only with no raw-register routes', async () => {
  for (const route of ['overview', 'participants', 'badges', 'participants/MOR-C788866']) {
    assert.equal((await fetch(app.origin + '/api/' + route)).status, 403);
    assert.equal((await request(route)).status, 200);
    assert.equal((await fetch(app.origin + '/api/' + route, { headers: { 'X-Morothon-Token': app.token, Origin: 'https://foreign.example' } })).status, 403);
  }
  for (const route of ['participants?limit=999', 'participants?offset=-1', 'participants?private=true', 'badges?view=guess', 'badges?level=13', 'participants?q=a&q=b']) assert.equal((await request(route)).status, 400);
  assert.equal((await request('participants/not-a-person')).status, 404);
  assert.equal((await fetch(app.origin + '/api/participants', { method: 'POST', headers: { 'X-Morothon-Token': app.token, Origin: app.origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  for (const route of ['/data/honors.json', '/tools/diploma-admin/api.cjs', '/api/volunteers', '/api/import', '/api/awards']) assert.notEqual((await fetch(app.origin + route, { headers: { 'X-Morothon-Token': app.token } })).status, 200);
  const overview = await (await request('overview')).json(); assert.equal(overview.latestParticipants, 398);
  const second = await (await request('participants?limit=2&offset=2')).json(); assert.equal(second.people.length, 2); assert.equal(second.offset, 2);
});
test('C1.1 desktop and tablet navigation, participant history, upcoming milestones and C2 placeholders work without changing the diploma selection', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }), p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await p.goto(app.origin); await p.locator('#overviewMetrics .metric-card').first().waitFor();
    assert.equal(await p.locator('.sidebar nav a').count(), 7); assert.equal(await p.locator('#pageTitle').innerText(), 'Oversikt');
    await p.getByRole('navigation').getByRole('link', { name: 'Deltakere' }).click();
    await p.fill('#participantSearch', 'Inger Katherin'); await p.waitForFunction(() => document.querySelectorAll('.participant-row').length === 1);
    await p.getByRole('button', { name: 'Se historikk', exact: true }).click(); await p.locator('#participantDialog[open]').waitFor();
    assert.match(await p.locator('#participantDetail').innerText(), /Sølvmerket/); assert.match(await p.locator('#participantDetail').innerText(), /2024/);
    await p.getByRole('button', { name: 'Velg diplom', exact: true }).click();
    await p.waitForFunction(() => location.hash === '#diplomer' && document.querySelector('#kind').value === 'runner');
    assert.equal(await p.inputValue('#search'), 'Inger Katherin Dahl Frantzen');
    await p.click('#demo'); assert.equal(await p.locator('.job-row').count(), 5);
    await p.getByRole('navigation').getByRole('link', { name: 'Merker', exact: true }).click();
    await p.selectOption('#badgeView', 'upcoming'); await p.fill('#badgeSearch', 'Inger Katherin'); await p.selectOption('#badgeLevel', '15');
    await p.waitForFunction(() => document.querySelectorAll('.runner-badge-card').length === 1);
    assert.match(await p.locator('#badgeList').innerText(), /3 deltakelser igjen/);
    for (const name of ['Premier']) { await p.getByRole('navigation').getByRole('link', { name: new RegExp(name) }).click(); await p.waitForFunction(name => document.querySelector('#pageTitle').textContent === name, name); assert.equal(await p.locator('[data-view]:visible input[type="file"]').count(), 0); }
    await p.getByRole('navigation').getByRole('link', { name: 'Årets arrangement' }).click(); await p.locator('#intakeFile').waitFor();
    for (const width of [1440, 768]) {
      await p.setViewportSize({ width, height: 1050 });
      await p.getByRole('navigation').getByRole('link', { name: 'Oversikt' }).click(); await p.locator('#overviewMetrics .metric-card').first().waitFor();
      await p.screenshot({ path: path.join(out, `oversikt-${width}.png`), fullPage: true });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await p.getByRole('navigation').getByRole('link', { name: /Diplomer/ }).click(); await p.locator('#view-diplomer').waitFor(); assert.equal(await p.locator('.job-row').count(), 5);
      assert.equal(await p.locator('#navDiplomaCount').innerText(), '5');
      await p.screenshot({ path: path.join(out, `diplomer-${width}.png`), fullPage: true });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await p.getByRole('navigation').getByRole('link', { name: 'Deltakere' }).click(); await p.locator('.participant-row').first().waitFor();
    await p.screenshot({ path: path.join(out, 'deltakere-768.png'), fullPage: true }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.getByRole('navigation').getByRole('link', { name: 'Merker', exact: true }).click(); await p.locator('.runner-badge-card').first().waitFor();
    await p.screenshot({ path: path.join(out, 'merker-768.png'), fullPage: true }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.evaluate(() => document.querySelector('.skip-link').click()); assert.equal(await p.evaluate(() => document.activeElement.id), 'portalMain'); assert.equal(await p.evaluate(() => location.hash), '#merker');
    await p.getByRole('navigation').getByRole('link', { name: 'Oversikt' }).click(); await p.locator('#view-oversikt').waitFor();
    await p.getByRole('navigation').getByRole('link', { name: /Diplomer/ }).click(); await p.locator('#view-diplomer').waitFor();
    assert.equal(await p.locator('.sidebar nav a[aria-current="page"]').count(), 1);
    await p.goBack(); await p.waitForFunction(() => location.hash === '#oversikt');
    await p.goto(app.origin + '/#ukjent'); await p.waitForFunction(() => location.hash === '#oversikt');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('C1.1 participant loading failures show a clear error instead of stale results and allow a retry', async () => {
  const context = await browser.newContext(), p = await context.newPage();
  try {
    await p.goto(app.origin + '/#deltakere'); await p.locator('.participant-row').first().waitFor();
    await p.route('**/api/participants?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test: historikken kan ikke lastes.' }) }));
    await p.fill('#participantSearch', 'Inger'); await p.getByText('Test: historikken kan ikke lastes.').waitFor(); assert.equal(await p.locator('.participant-row').count(), 0);
    await p.unroute('**/api/participants?*'); await p.fill('#participantSearch', 'Inger Katherin'); await p.waitForFunction(() => document.querySelectorAll('.participant-row').length === 1);
    assert.equal(await p.locator('#portalStatus').innerText(), '');
    await p.route('**/api/participants?*', async route => {
      await p.evaluate(() => { location.hash = '#oversikt'; }); await p.locator('#view-oversikt').waitFor();
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Skal ikke vises på en annen side.' }) });
    });
    await p.fill('#participantSearch', 'Finn');
    await p.waitForFunction(() => document.querySelector('#participantList').textContent.includes('Kunne ikke laste listen'));
    assert.equal(await p.locator('#portalStatus').innerText(), ''); assert.equal(await p.locator('#pageTitle').innerText(), 'Oversikt');
  } finally { await context.close(); }
});
