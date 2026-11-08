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
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'text/html');
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
