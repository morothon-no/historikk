// Run with: node --test tests/regression.cjs (requires Playwright and Chromium).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let server, browser, base, data;
before(async () => {
  data = JSON.parse(await fs.readFile(path.join(root, 'data/history.json'), 'utf8'));
  server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const content = await fs.readFile(file);
      res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'text/html');
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); });

async function load(options = {}, withoutTeams = false, fixture = data) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (withoutTeams || fixture !== data) await page.route('**/data/history.json', route => {
    const { teamResults, ...individualData } = fixture;
    return route.fulfill({ json: withoutTeams ? individualData : fixture });
  });
  await page.goto(base);
  await page.waitForFunction(() => !document.querySelector('#loading'));
  return { context, page, errors };
}

test('mobile: every year is reachable, correctly labelled and tappable; swipe and resize work', async () => {
  const { context, page, errors } = await load({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const expected = [...data.yearStats].sort((a, b) => b[0] - a[0]);
    assert.equal(expected[0][0], 2026);
    assert.equal(expected.at(-1)[0], 1992);
    for (const width of [320, 390, 620]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#statistikk').scrollIntoViewIfNeeded();
      await page.locator('#chartScroll').evaluate(el => el.scrollLeft = 0);
      assert.deepEqual(await page.locator('.bar-year').allTextContents(), expected.map(s => String(s[0])));
      const dims = await page.locator('#chartScroll').evaluate(el => ({ total: el.scrollWidth, visible: el.clientWidth }));
      assert.ok(dims.total > dims.visible);
      const first = await page.locator('.bar').first().boundingBox();
      assert.ok(first.width >= 44);
      // Native scrolling keeps the axis and columns together; test every year's tooltip.
      for (const stat of expected) {
        const bar = page.locator(`.bar[data-year="${stat[0]}"]`);
        await bar.scrollIntoViewIfNeeded();
        await bar.tap();
        await page.waitForFunction(text => {
          const tip = document.querySelector('#chartTooltip');
          return !tip.hidden && tip.textContent === text;
        }, `${stat[0]}: ${stat[2]} deltakere`);
        const rects = await page.evaluate(() => {
          const c = document.querySelector('#chart').getBoundingClientRect(), t = document.querySelector('#chartTooltip').getBoundingClientRect();
          return { left: t.left - c.left, right: c.right - t.right };
        });
        assert.ok(rects.left >= 0 && rects.right >= 0);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    // Exercise an actual touch swipe in Chromium, rather than just setting scrollLeft.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#chartScroll').evaluate(el => el.scrollLeft = 0);
    await page.locator('#chartScroll').scrollIntoViewIfNeeded();
    const box = await page.locator('#chartScroll').boundingBox();
    const cdp = await context.newCDPSession(page);
    const y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 320, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 320 - i * 30, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#chartScroll').scrollLeft > 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => document.querySelector('.bar').dataset.year === '1992');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.bar').dataset.year === '2026' && document.querySelector('#chartScroll').scrollLeft === 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('desktop: all years fit, chronological axis, hover and keyboard show correct values', async () => {
  const { context, page, errors } = await load();
  try {
    for (const width of [621, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => document.querySelector('.bar').dataset.year === '1992');
      const dims = await page.locator('#chartScroll').evaluate(el => ({ total: el.scrollWidth, visible: el.clientWidth }));
      assert.ok(dims.total <= dims.visible + 1);
      assert.deepEqual(await page.locator('.bar-year').allTextContents(), data.yearStats.map(s => String(s[0])).sort());
      const bar = page.locator('.bar[data-year="2026"]');
      await bar.hover();
      assert.equal(await page.locator('#chartTooltip').textContent(), '2026: 398 deltakere');
      await bar.focus();
      await bar.press('Enter');
      assert.equal(await page.locator('#chartTooltip').isVisible(), true);
      await bar.press('Escape');
      assert.equal(await page.locator('#chartTooltip').isVisible(), false);
      await bar.press('Space');
      assert.equal(await page.locator('#chartTooltip').isVisible(), true);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

async function individualState(page) {
  return page.evaluate(() => ({
    people: S.people, stats: S.stats, results: S.results,
    starts: S.results.filter(countsAsParticipation).length,
    metrics: document.querySelector('#metrics').textContent,
    calendar: document.querySelector('#rankBody').innerHTML,
    ranking: document.querySelector('#rankingResults').innerHTML,
    milestones: MorothonMilestones.calculate(S.lastYear),
    badges: S.people.map(p => [p.i, runnerBadges(p, loyalty(p))]),
    totals: S.people.map(p => [p.i, runnerTotals(p.i), performanceStats(p.i), MorothonProgress.groups(p.i)])
  }));
}

test('2026 relay teams: official places, times, DNS, filters and isolation from individual statistics', async () => {
  const withTeams = await load();
  const withoutTeams = await load({}, true);
  try {
    assert.deepEqual(await individualState(withTeams.page), await individualState(withoutTeams.page));
    const { page } = withTeams;
    await page.locator('#yearDisclosure').evaluate(el => el.open = true);
    await page.selectOption('#yearSelect', '2026');
    assert.equal(await page.locator('#yearMainRace').textContent(), 'Langmoro · 20 km');
    assert.equal((await page.locator('#aar').textContent()).includes('Langmoro / Morothon'), false);
    assert.equal((await page.locator('#yearCards').textContent()).includes('Morothon'), false);
    const summaryBefore = await page.locator('#yearSummary').textContent();
    // A previous individual gender filter must not hide mixed/unspecified teams.
    await page.selectOption('#yearGender', 'Dame');
    await page.locator('#yearRelayRace').click();
    assert.equal(await page.locator('#yearRelayRace').textContent(), 'Langmoro stafett');
    assert.equal(await page.locator('#yearGender').isDisabled(), true);
    const rows = page.locator('.year-team-result');
    assert.equal(await rows.count(), 4);
    assert.deepEqual(await rows.locator('.year-runner > strong').allTextContents(), ['Sudredalen ræsårforening', 'Målet er å komme i mål', 'Vennedølane', 'Play!']);
    assert.deepEqual(await rows.locator('.year-class-place > strong').allTextContents(), ['1.', '2.', '3.', '–']);
    assert.deepEqual(await rows.locator('.year-time').allTextContents(), ['2:01:23', '2:20:12', '2:39:26', 'DNS']);
    assert.deepEqual(await rows.locator('.year-status').allTextContents(), ['Fullført', 'Fullført', 'Fullført', 'DNS']);
    assert.equal(await rows.locator('button').count(), 0); // No fabricated individual profiles.
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const fitting = await rows.evaluateAll(els => els.every(el => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1;
      }));
      assert.ok(fitting, `Relay rows must fit at ${width}px`);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator('#yearSummary').textContent(), summaryBefore);
    assert.equal((await page.locator('#yearCards').textContent()).includes('4 × 5'), false);
    assert.match(await page.locator('#yearCards').textContent(), /4 etapper med varierende lengde/);
    await page.locator('#yearSearch').fill('Play!');
    assert.equal(await rows.count(), 1);
    assert.equal(await rows.locator('.year-status').textContent(), 'DNS');
    await page.locator('#yearSearch').fill('ingen treff');
    assert.match(await page.locator('#yearCards').textContent(), /Ingen treff/);
    await page.locator('#yearSearch').fill('');
    await page.selectOption('#yearSelect', '2025');
    assert.equal(await page.locator('#yearRelayRace').isVisible(), false);
    assert.equal(await page.locator('#yearGender').isEnabled(), true);
    await page.selectOption('#yearSelect', '1992');
    await page.locator('#yearOtherRace').click();
    assert.equal((await page.locator('#yearOtherSelect').textContent()).includes('Morothon'), false);
    await page.locator('#yearMainRace').click();
    await page.locator('#yearCards .year-runner button').first().click();
    assert.equal(await page.locator('#panel').isVisible(), true);
    assert.deepEqual(withTeams.errors, []);
    assert.deepEqual(withoutTeams.errors, []);
  } finally { await withTeams.context.close(); await withoutTeams.context.close(); }
});

test('course records: current data drives all four front-page records and profile awards', async () => {
  const { context, page, errors } = await load();
  try {
    const expected = [
      { pid: 'MOR-96EB117', name: 'Lars Aasheim Svaland', event: 'Langmoro 20 km', gender: 'Herrer', time: '1:31:24', year: 2026 },
      { pid: 'MOR-9EECC4C', name: 'Ingrid Ukkelberg', event: 'Langmoro 20 km', gender: 'Damer', time: '1:54:00', year: 2023 },
      { pid: 'MOR-0FD8C65', name: 'Simen Koland', event: 'Kortmoro 10 km', gender: 'Herrer', time: '47:20', year: 2024 },
      { pid: 'MOR-9281219', name: 'Marianne Andersen', event: 'Kortmoro 10 km', gender: 'Damer', time: '56:37', year: 2025 }
    ];
    assert.deepEqual(await page.evaluate(() => S.courseRecords), expected);
    await page.locator('#recordOtherMore').click();
    assert.equal(await page.locator('#recordGrid .record-card').count(), 4);
    for (const [i, record] of expected.entries()) {
      const card = page.locator('#recordGrid .record-card').nth(i);
      const text = await card.textContent();
      for (const value of [record.name, record.event, record.gender, record.time, String(record.year)]) assert.ok(text.includes(value));
      await card.click();
      const profile = await page.locator('#profile .profile-record-strip').textContent();
      for (const value of [record.event, record.time, String(record.year)]) assert.ok(profile.includes(value));
      assert.deepEqual(await page.evaluate(pid => recordMatchesFor(person(pid)), record.pid), [record]);
      const badge = await page.evaluate(pid => {
        const p = person(pid);
        return runnerBadges(p, loyalty(p)).find(b => b.cls === 'record');
      }, record.pid);
      assert.ok(badge.desc.includes(record.time) && badge.desc.includes(String(record.year)));
      const share = await page.evaluate(async pid => {
        const text = [], original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          text.push(String(value)); return original.call(this, value, ...args);
        };
        try {
          const card = await buildShareCard(pid);
          URL.revokeObjectURL(card.url);
          return { text, type: card.blob.type, size: card.blob.size };
        } finally { CanvasRenderingContext2D.prototype.fillText = original; }
      }, record.pid);
      assert.equal(share.type, 'image/png');
      assert.ok(share.size > 0);
      assert.ok(share.text.includes(`${record.event} · ${record.gender} · ${record.time} (${record.year})`));
      await page.locator('#close').click();
    }
    // A future faster result changes both the front page and record-holder identity automatically.
    // Intercept only the test response; never change history.json on disk.
    const future = structuredClone(data);
    const challenger = future.results.find(r => r[0] === 2026 && r[1] === 'MOR-9F0C42C' && r[2] === 'Morothon' && r[3] === '20 km');
    assert.ok(challenger);
    challenger[5] = '1:30:00';
    await page.route('**/data/history.json', route => route.fulfill({ json: future }));
    await page.goto(base);
    await page.waitForFunction(() => !document.querySelector('#loading'));
    assert.match(await page.locator('#recordGrid').textContent(), /Marius Aurebekk/);
    assert.match(await page.locator('#recordGrid').textContent(), /1:30:00/);
    assert.deepEqual(await page.evaluate(() => recordMatchesFor(person('MOR-96EB117'))), []);
    await page.locator('#recordGrid .record-card').first().click();
    assert.match(await page.locator('#profile .profile-record-strip').textContent(), /1:30:00/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('course record boundaries: 2014 included, exact distances, finish status, identity and joint records', async () => {
  const { context, page, errors } = await load();
  try {
    const records = await page.evaluate(() => {
      const people = new Map([
        ['a', { i: 'a', n: 'Samme navn', g: 'Herre' }],
        ['b', { i: 'b', n: 'Samme navn', g: 'Herre' }],
        ['c', { i: 'c', n: 'Kvinne', g: 'Dame' }],
        ['unknown', { i: 'unknown', n: 'Ukjent kjønn', g: '' }]
      ]);
      const row = (year, pid, race, distance, time, status = 'Fullført') => [year, pid, race, distance, status, time];
      return calculateCourseRecords([
        row(2015, 'a', 'Morothon', '20 km', '1:40:00'),
        row(2014, 'a', 'Morothon', '20 km', '1:40:00'), // First qualifying course year, earliest repeat.
        row(2016, 'b', 'Morothon', '20 km', '1:40:00'), // Joint record, distinct ID despite same name.
        row(2015, 'c', 'Morothon', '20 km', '1:50:00'),
        row(2014, 'a', 'Kortmoro', '10 km', '50:00'),
        row(2014, 'c', 'Kortmoro', '10 km', '1:00:00'),
        row(2013, 'a', 'Morothon', '20 km', '1:00:00'),
        row(2026, 'a', 'Morothon', '21 km', '1:00:00'),
        row(2026, 'a', 'Morothon', '20.1 km', '1:00:00'),
        row(2026, 'a', 'Kortmoro', '20 km', '1:00:00'),
        row(2026, 'a', 'Morothon', '10 km', '1:00'),
        row(2026, 'a', 'Kortmoro', '5 km', '1:00'),
        row(2026, 'a', 'Langmoro stafett', '20 km', '1:00:00'),
        row(2026, 'a', 'Junior', '20 km', '1:00:00'),
        row(2026, 'a', 'Morothon', '20 km', '1:00:00', 'DNS'),
        row(2026, 'a', 'Morothon', '20 km', '1:00:00', 'DNF'),
        row(2026, 'a', 'Morothon', '20 km', '1:00:00', 'Disket'),
        row(2026, 'a', 'Morothon', '20 km', 'DNS'),
        row(2026, 'a', 'Morothon', '20 km', '00:00'),
        row(2026, 'a', 'Morothon', '20 km', 'ugyldig tid'),
        row(2026, 'missing', 'Morothon', '20 km', '1:00:00'),
        row(2026, 'unknown', 'Morothon', '20 km', '1:00:00'),
        row(null, 'a', 'Morothon', '20 km', '1:00:00')
      ], pid => people.get(pid));
    });
    assert.deepEqual(records.map(r => [r.pid, r.event, r.gender, r.time, r.year]), [
      ['a', 'Langmoro 20 km', 'Herrer', '1:40:00', 2014],
      ['b', 'Langmoro 20 km', 'Herrer', '1:40:00', 2016],
      ['c', 'Langmoro 20 km', 'Damer', '1:50:00', 2015],
      ['a', 'Kortmoro 10 km', 'Herrer', '50:00', 2014],
      ['c', 'Kortmoro 10 km', 'Damer', '1:00:00', 2014]
    ]);
    assert.deepEqual(await page.evaluate(() => calculateCourseRecords([])), []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('annual milestones: 2026 control totals, calendar/profile agreement and mobile/desktop navigation', async () => {
  for (const width of [320, 390, 1440]) {
    const { context, page, errors } = await load({ viewport: { width, height: 900 } });
    try {
      const totals = await page.evaluate(() => {
        const r = MorothonMilestones.calculate(2026);
        return { participants: r.participants.length, debutants: r.debutants.length, awards: r.awardCount,
          badges: r.badges.map(item => [item.badge.n, item.people.length]) };
      });
      assert.deepEqual(totals, { participants: 398, debutants: 195, awards: 22, badges: [[5, 17], [10, 2], [25, 1], [35, 2]] });
      assert.deepEqual(await page.locator('#annualMilestones .annual-stat strong').allTextContents(), ['195', '22']);
      await page.locator('#openYearMilestones').click();
      assert.equal(await page.locator('#yearDisclosure').getAttribute('open'), '');
      assert.equal(await page.locator('#yearSelect').inputValue(), '2026');
      assert.deepEqual(await page.locator('[data-annual-category]').evaluateAll(els => els.map(el => el.dataset.annualCategory)), ['debut', '5', '10', '25', '35']);
      assert.equal(await page.locator('.annual-person').count(), 10);
      while (await page.locator('[data-annual-more]').count()) await page.locator('[data-annual-more]').click();
      assert.equal(await page.locator('.annual-person').count(), 195);
      for (const [threshold, count] of [[5, 17], [10, 2], [25, 1], [35, 2]]) {
        await page.locator(`[data-annual-category="${threshold}"]`).click();
        while (await page.locator('[data-annual-more]').count()) await page.locator('[data-annual-more]').click();
        assert.equal(await page.locator('.annual-person').count(), count);
      }
      assert.deepEqual(await page.locator('.annual-person').evaluateAll(els => els.map(el => el.textContent.split('35 deltakelser')[0])), ['Gunnar Kåsa', 'Morten Borø']);
      for (const [name, count] of [['Finn Gerhard Olsen', 31], ['Gunnar Kåsa', 35], ['Morten Borø', 35]]) {
        const result = await page.evaluate(name => {
          const p = S.people.find(p => p.n === name);
          return { count: p.c, years: startedYears(p).length, badge: highestMilestone(p).n };
        }, name);
        assert.equal(result.count, count);
        assert.equal(result.years, count);
        assert.equal(result.badge, count === 31 ? 30 : 35);
        await page.selectOption('#rankMin', '0');
        await page.locator('#rankSearch').fill(name);
        const calendarRow = page.locator('#rankBody tr').filter({ hasText: name });
        assert.equal(await calendarRow.locator('td').nth(2).textContent(), String(count));
        await calendarRow.locator('button').click();
        assert.equal(await page.locator('#profile .profile-primary-stats > div > strong').first().textContent(), String(count));
        await page.locator('#close').click();
      }
      await page.locator('.annual-person').first().click();
      assert.equal(await page.locator('#panel').isVisible(), true);
      assert.match(await page.locator('#profile').textContent(), /Gunnar Kåsa/);
      assert.match(await page.locator('#profile').textContent(), /Morothon-æresløper/);
      await page.locator('#close').click();
      await page.selectOption('#yearSelect', '1992');
      assert.match(await page.locator('#yearMilestonesTitle').textContent(), /1992/);
      assert.deepEqual(await page.locator('[data-annual-category]').evaluateAll(els => els.map(el => el.dataset.annualCategory)), ['debut']);
      await page.locator('#openYearMilestones').click();
      assert.match(await page.locator('#yearMilestonesTitle').textContent(), /2026/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('annual milestone rules: all ten thresholds, unique years, DNS, DNF, canonical IDs, aliases and future years', async () => {
  const fixture = { schemaVersion: 1, people: [
    { i: 'canonical', n: 'Testløper', g: 'Herre', c: 0 },
    { i: 'old', n: 'Gammelt navn', g: 'Herre', c: 0 },
    { i: 'dns', n: 'Bare DNS', g: 'Dame', c: 0 }
  ], results: [], yearStats: [], redirects: { older: 'old', old: 'canonical' },
    aliases: { old: ['Godkjent alias'] }, teamResults: [{ year: 2041, event: 'Langmoro stafett', team: 'Separat lag', place: 1, time: '2:00:00', status: 'Fullført', legs: 4 }] };
  for (let i = 0; i < 50; i++) {
    const year = 1992 + i;
    fixture.results.push([year, i % 2 ? 'older' : 'canonical', 'Morothon', '20 km', i === 4 ? 'DNF' : 'Fullført', i === 4 ? 'DNF' : '2:00:00']);
    fixture.yearStats.push([year, 1, 1]);
  }
  fixture.results.push([1996, 'old', 'Kortmoro', '10 km', 'Fullført', '1:00:00']); // Same person/year, no double credit.
  fixture.results.push([1991, 'canonical', 'Morothon', '20 km', 'DNS', 'DNS']); // Does not move debut back.
  fixture.results.push([2041, 'dns', 'Morothon', '20 km', 'DNS', 'DNS']);
  const { context, page, errors } = await load({}, false, fixture);
  try {
    const result = await page.evaluate(() => ({
      people: S.people.map(p => p.i),
      count: person('old').c,
      years: startedYears(person('older')).length,
      debut: MorothonMilestones.calculate(1992).debutants.map(p => p.i),
      dnsOnly: MorothonMilestones.calculate(1991).participants.length,
      thresholds: PARTICIPATION_BADGES.map(b => {
        const r = MorothonMilestones.calculate(1991 + b.n);
        return [b.n, r.badges.map(item => [item.badge.n, item.people.map(p => p.i)]), r.awardCount];
      }),
      aliasMatches: personNameMatch(person('old'), 'Godkjent alias') && personNameMatch(person('older'), 'Gammelt navn'),
      missingYear: MorothonMilestones.calculate(2042).participants.length,
      highest: highestMilestone(person('canonical')).n
    }));
    assert.deepEqual(result.people, ['canonical', 'dns']);
    assert.equal(result.count, 50);
    assert.equal(result.years, 50);
    assert.deepEqual(result.debut, ['canonical']);
    assert.equal(result.dnsOnly, 0);
    assert.equal(result.aliasMatches, true);
    assert.equal(result.missingYear, 0);
    assert.equal(result.highest, 50);
    assert.deepEqual(result.thresholds, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(n => [n, [[n, ['canonical']]], 1]));
    assert.deepEqual(await page.locator('#annualMilestones .annual-stat strong').allTextContents(), ['0', '1']);
    assert.match(await page.locator('#annualMilestones').textContent(), /2041/);
    await page.locator('#openYearMilestones').click();
    await page.locator('[data-annual-category="50"]').click();
    assert.equal(await page.locator('.annual-person').count(), 1);
    assert.match(await page.locator('.annual-person').textContent(), /Testløper/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Enny-Karin correction: one documented 1999 result, canonical alias/redirect and preserved historical data', async () => {
  const { createHash } = require('node:crypto');
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  // Preservation fingerprints from approved V28 (dd2aff6), excluding only the affected rows/profile.
  assert.equal(hash(data.people.filter(p => !['MOR-72A949A', 'MOR-4CB0E52'].includes(p.i))), '0b2cfcbdc71789a0f1e758e166fc4b2fa16e53f13ef1b31bc9ea3e936025e896');
  assert.equal(hash(data.results.filter(r => !(r[0] === 1999 && ['MOR-72A949A', 'MOR-4CB0E52'].includes(r[1])))), '4a9090ac739e5205087f563446fda4ba21626b37f5af4b7b580fe062195a3b17');
  assert.equal(hash(data.yearStats.filter(s => s[0] !== 1999)), '81d11f1378a320c3a1cadd5018c6e137bc8ea1db6c75adee8148e97136aa7625');
  assert.equal(hash(data.teamResults), 'c04ab350260c74fcfcc566904bbb762b7fe5ac8ba07fd8977a2c05c8a92b5b93');
  assert.equal(data.people.length, 2643);
  assert.equal(data.results.length, 6914);
  assert.equal(data.people.some(p => p.i === 'MOR-4CB0E52'), false);
  assert.equal(data.results.some(r => r[1] === 'MOR-4CB0E52'), false);
  assert.deepEqual(data.results.filter(r => r[1] === 'MOR-72A949A' && r[0] === 1999), [[1999, 'MOR-72A949A', 'Kortmoro', '13 km', 'Fullført', '1:22:22', 20, '', '', '']]);
  assert.equal(data.redirects['MOR-4CB0E52'], 'MOR-72A949A');
  assert.ok(data.aliases['MOR-72A949A'].includes('Enny Dvergsnes'));
  assert.deepEqual(data.yearStats.find(s => s[0] === 1999), [1999, 204, 204, 204, 204, 0, 0, 57, 147, 0]);
  assert.match(data.people.find(p => p.i === 'MOR-72A949A').z, /dokumentert.*1:22:22, 20\. plass/);
  const { context, page, errors } = await load();
  try {
    const state = await page.evaluate(() => {
      const p = person('MOR-4CB0E52');
      return { id: p.i, count: p.c, years: startedYears(p).length, highest: highestMilestone(p).n,
        debut1999: MorothonMilestones.calculate(1999).debutants.filter(q => q.i === p.i).length,
        participants: MorothonMilestones.calculate(1999).participants.length };
    });
    assert.deepEqual(state, { id: 'MOR-72A949A', count: 23, years: 23, highest: 20, debut1999: 1, participants: 204 });
    await page.locator('#mainSearch').fill('Enny Dvergsnes');
    await page.locator('#searchGo').click();
    assert.match(await page.locator('#profile').textContent(), /Enny-Karin Vindheim/);
    assert.match(await page.locator('#profile .result-row').filter({ hasText: '1999' }).textContent(), /1:22:22/);
    assert.match(await page.locator('#profile .result-row').filter({ hasText: '1999' }).textContent(), /20\. plass i kildelisten/);
    await page.goto(base + '/index.html#lop=MOR-4CB0E52');
    await page.locator('#panel').waitFor({ state: 'visible' });
    assert.match(page.url(), /#lop=MOR-72A949A$/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Skrytekort V2: official earned medals, tier hierarchy, record honor and responsive profiles', async () => {
  const { context, page, errors } = await load();
  try {
    const samples = await page.evaluate(() => [1, 5, 10, 15, 20, 25, 30, 35].map(n => {
      const p = S.people.find(p => p.c >= n && p.c < (n === 1 ? 5 : n + 5));
      return { id: p.i, tier: MorothonCard.model(p.i).tier };
    }));
    assert.deepEqual(samples.map(s => s.tier), ['none', 'bronze', 'silver', 'gold', 'platinum', 'titanium', 'legend', 'honorary']);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const sample of samples) {
        await page.evaluate(pid => openProfile(pid), sample.id);
        const info = await page.evaluate(pid => {
          const m = MorothonCard.model(pid), card = document.querySelector('.brag-card');
          const largest = card.querySelector('.brag-main-medal'), previous = [...card.querySelectorAll('.brag-medal-row img')];
          return { earned: m.earned.map(b => b.n), previous: previous.map(img => img.alt), expectedPrevious: m.previous.map(b => b.name),
            officialHighest: !largest || largest.src === BADGE_IMAGES[String(m.highest.n)],
            officialPrevious: previous.every((img, i) => img.src === BADGE_IMAGES[String(m.previous[i].n)]),
            mainHeight: largest?.getBoundingClientRect().height || 0, smallHeight: previous[0]?.getBoundingClientRect().height || 0,
            fits: document.querySelector('#panel').scrollWidth <= document.querySelector('#panel').clientWidth,
            honor: card.classList.contains('brag-honorary'), frame: getComputedStyle(card).borderTopWidth,
            centered: [...card.querySelectorAll('.brag-count,.brag-earned,.brag-stats>div,.brag-previous,.brag-support')].every(el => getComputedStyle(el).textAlign === 'center'),
            collectionHeading: card.querySelector('.brag-previous h4')?.textContent,
            captions: card.querySelectorAll('.brag-medal-row figcaption').length,
            duplicatedHighest: !!largest && previous.some(img => img.src === largest.src),
            active: m.active,
            medalY: largest ? largest.getBoundingClientRect().top + largest.getBoundingClientRect().height / 2 : 0,
            countY: card.querySelector('.brag-count').getBoundingClientRect().top + card.querySelector('.brag-count').getBoundingClientRect().height / 2,
            numberCenter: (() => { const r = card.querySelector('.brag-count strong').getBoundingClientRect(); return r.left + r.width / 2; })(),
            countCenter: (() => { const r = card.querySelector('.brag-count').getBoundingClientRect(); return r.left + r.width / 2; })(),
            statLabels: [...card.querySelectorAll('.brag-stats>div')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.querySelector('small').textContent),
            medalCenter: largest ? largest.getBoundingClientRect().left + largest.getBoundingClientRect().width / 2 : 0,
            cardCenter: card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2,
            text: card.textContent };
        }, sample.id);
        assert.deepEqual(info.previous, info.expectedPrevious);
        assert.equal(info.captions, 0);
        assert.equal(info.duplicatedHighest, false);
        if (info.previous.length) assert.equal(info.collectionHeading, 'Min medaljesamling');
        assert.equal(info.officialHighest, true);
        assert.equal(info.officialPrevious, true);
        if (info.smallHeight) assert.ok(info.mainHeight > info.smallHeight * 2);
        assert.equal(info.centered, true);
        assert.ok(Math.abs(info.numberCenter - info.countCenter) < 1);
        if (!info.honor && info.earned.length) assert.ok(Math.abs(info.medalY - info.countY) < 1, 'Medal and number must use the same centre line');
        assert.equal(info.fits, true, `Profile ${sample.id} must fit ${width}px`);
        if (info.active > 0) assert.match(info.text, /aktiv rekke/);
        else { assert.equal(info.statLabels.includes('aktiv rekke'), false); assert.equal(info.statLabels[0], 'lengste historiske rekke'); }
        assert.match(info.text, /lengste historiske rekke/);
        assert.equal(info.text.includes('høydemeter'), false);
        if (info.honor) { assert.equal(info.frame, '3px'); assert.match(info.text, /MOROTHON-ÆRESLØPER/); assert.ok(Math.abs(info.medalCenter - info.cardCenter) < 2); }
        if (sample.tier === 'legend') assert.match(info.text, /MOROTHON-LEGENDE/);
        if (sample.tier === 'titanium') assert.equal(info.frame, '2px');
        if (!info.earned.length) assert.match(info.text, /På vei mot Bronsemerket/);
        await page.evaluate(() => closeProfile());
      }
      await page.evaluate(() => openProfile('MOR-96EB117'));
      assert.equal(await page.locator('.brag-main-medal').count(), 0);
      assert.equal(await page.locator('.brag-identity + .profile-record-strip').count(), 1);
      assert.match(await page.locator('.profile-record-strip').textContent(), /Langmoro 20 km · Herrer · 1:31:24 \(2026\)/);
      assert.equal(await page.locator('.brag-count strong').textContent(), '4');
      await page.evaluate(() => closeProfile());
    }
    // Actually export every tier, including the long named silver medal profile.
    for (const pid of [...samples.map(s => s.id), 'MOR-C788866', 'MOR-96EB117', 'MOR-6D5A088']) {
      const exported = await page.evaluate(async pid => {
        const text = [], images = [], originalText = CanvasRenderingContext2D.prototype.fillText, originalImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.fillText = function(value, x, y, ...args) { const width = this.measureText(String(value)).width; text.push({ value: String(value), x: x - (this.textAlign === 'center' ? width / 2 : 0), y, width, align: this.textAlign }); return originalText.call(this, value, x, y, ...args); };
        CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) { images.push(img.src); return originalImage.call(this, img, ...args); };
        try {
          const m = MorothonCard.model(pid), result = await buildShareCard(pid);
          const bitmap = await createImageBitmap(result.blob);
          const size = [bitmap.width, bitmap.height]; bitmap.close(); URL.revokeObjectURL(result.url);
          return { text, size, bytes: result.blob.size, earned: m.earned.map(b => BADGE_IMAGES[String(b.n)]), images,
            name: m.p.n, active: m.active, tier: m.tier, honorary: m.honorary, records: m.records.length };
        } finally { CanvasRenderingContext2D.prototype.fillText = originalText; CanvasRenderingContext2D.prototype.drawImage = originalImage; }
      }, pid);
      assert.deepEqual(exported.size, [1080, 1350]);
      assert.ok(exported.bytes > 10000);
      assert.ok(exported.text.every(t => t.x >= 0 && t.x + t.width <= 1035 && t.y > 0 && t.y < 1315), `Text must fit canvas for ${pid}`);
      assert.ok(exported.earned.every(src => exported.images.includes(src)));
      if (exported.earned.length > 1) {
        const collection = exported.text.find(t => t.value === 'MIN MEDALJESAMLING');
        assert.ok(collection);
        assert.equal(exported.text.some(t => t.y > collection.y && t.y < collection.y + 110 && /^\d+$/.test(t.value)), false);
      }
      for (const label of ['DELTAKELSER', ...(exported.active > 0 ? ['AKTIV REKKE'] : []), 'LENGSTE HISTORISKE REKKE', 'LOJALITET SIDEN DEBUT', 'DEBUTÅR']) {
        assert.ok(exported.text.some(t => t.value === label && t.align === 'center'), `${label} must be centered`);
      }
      if (!exported.active) assert.equal(exported.text.some(t => t.value === 'AKTIV REKKE'), false);
      if (exported.tier === 'legend') assert.ok(exported.text.some(t => t.value === 'MOROTHON-LEGENDE'));
      assert.equal(exported.text.some(t => /HØYDEMETER/.test(t.value)), false);
      if (exported.honorary) assert.ok(exported.text.some(t => t.value === 'MOROTHON-ÆRESLØPER'));
      if (exported.records) assert.ok(exported.text.some(t => t.value === 'REGJERENDE REKORDHOLDER'));
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('honorary status: all-edition recognition is dynamic, record status survives and very long names wrap', async () => {
  const { context, page, errors } = await load();
  try {
    for (const pid of ['MOR-15AF3A3', 'MOR-6D5A088']) {
      assert.match(await page.evaluate(pid => MorothonCard.honorText(MorothonCard.model(pid)), pid), /alle 35 utgaver/);
    }
    const state = await page.evaluate(async () => {
      const p = person('MOR-15AF3A3');
      S.stats.push([2027, 0, 0]);
      const m = MorothonCard.model(p.i), text = MorothonCard.honorText(m);
      S.courseRecords.push({ pid: p.i, name: p.n, event: 'Langmoro 20 km', gender: 'Herrer', time: '1:00:00', year: 2026 });
      const longName = 'Gunnar Kåsa Med Et Svært Langt Historisk Navn Som Skal Få Plass Uten Avkutting';
      p.n = longName;
      openProfile(p.i);
      const result = await buildShareCard(p.i);
      URL.revokeObjectURL(result.url);
      const canvas = document.createElement('canvas').getContext('2d'); canvas.font = '700 42px Arial';
      const lines = MorothonCard.linesFor(canvas, longName, 964);
      return { allEditions: m.allEditions, text, honorary: m.honorary,
        record: !!document.querySelector('.brag-honorary .brag-record'),
        longName: document.querySelector('.brag-identity h2').textContent,
        fits: lines.every(line => canvas.measureText(line).width <= 964), reconstructed: lines.join(' ') };
    });
    assert.equal(state.allEditions, false);
    assert.equal(state.text.includes('alle 35'), false);
    assert.equal(state.honorary, true);
    assert.equal(state.record, true);
    assert.equal(state.longName, state.reconstructed);
    assert.equal(state.fits, true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('shared grid: optical number centring, aligned medal tracks and consistent lower sections for 5/10/15/25/31/35', async () => {
  const { context, page, errors } = await load();
  try {
    const layouts = [];
    for (const count of [5, 10, 15, 25, 31, 35]) {
      const result = await page.evaluate(async count => {
        const p = S.people.find(p => p.c === count), m = MorothonCard.model(p.i), layout = MorothonCard.heroLayout(m);
        const originalText = CanvasRenderingContext2D.prototype.fillText, originalImage = CanvasRenderingContext2D.prototype.drawImage;
        let number, medal, supportY;
        CanvasRenderingContext2D.prototype.fillText = function(value, x, y, ...args) {
          if (String(value) === String(count) && parseFloat(this.font.match(/([\d.]+)px/)[1]) >= 80) {
            const metrics = this.measureText(String(value));
            number = { x: x + (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2,
              y: y + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2 };
          }
          if (String(value) === 'Samlet registrert distanse') supportY = y;
          return originalText.call(this, value, x, y, ...args);
        };
        CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
          if (img.src === BADGE_IMAGES[String(m.highest.n)]) medal = { x: args[0] + args[2] / 2, y: args[1] + args[3] / 2 };
          return originalImage.call(this, img, ...args);
        };
        try {
          const exported = await buildShareCard(p.i); URL.revokeObjectURL(exported.url);
          return { number, medal, supportY, layout };
        } finally { CanvasRenderingContext2D.prototype.fillText = originalText; CanvasRenderingContext2D.prototype.drawImage = originalImage; }
      }, count);
      const n = result.layout.number, m = result.layout.medal;
      assert.ok(Math.abs(result.number.x - (58 + n.x + n.width / 2)) < .01, `Visible ink for ${count} must be centred`);
      assert.ok(Math.abs((result.number.y - result.medal.y) - (n.y + n.height / 2 - m.y - m.height / 2)) < .01);
      if (count !== 35) layouts.push(result);
    }
    assert.ok(layouts.every(r => r.supportY === layouts[0].supportY), 'Lower information must share the same vertical position');
    assert.ok(layouts.every(r => JSON.stringify(r.layout.medal) === JSON.stringify(layouts[0].layout.medal)));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const name of ['Inger Katherin Dahl Frantzen', 'Solbjørg Tronstad Hausvik']) {
        const fits = await page.evaluate(name => {
          const p = S.people.find(p => p.n === name); openProfile(p.i);
          const heading = document.querySelector('.brag-identity h2'), panel = document.querySelector('#panel');
          return heading.textContent === name && heading.scrollWidth <= heading.clientWidth + 1 && panel.scrollWidth <= panel.clientWidth + 1;
        }, name);
        assert.equal(fits, true, `${name} must fit at ${width}px`);
        await page.evaluate(() => closeProfile());
      }
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
