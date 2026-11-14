// Run with: node --test tests/regression.cjs (requires Playwright and Chromium).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const siteRoot = process.env.MOROTHON_TEST_SITE || root;
let server, browser, base, data;
before(async () => {
  data = JSON.parse(await fs.readFile(path.join(root, 'public-data/data/history.json'), 'utf8'));
  server = http.createServer(async (req, res) => {
    const file = path.resolve(siteRoot, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(siteRoot + path.sep)) { res.writeHead(403).end(); return; }
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
    // touchEnd releases the finger, but Chromium may keep scrolling inertially.
    // Finish that real gesture before testing a separate viewport transition.
    await page.locator('#chartScroll').evaluate(el => { window.__chartScrollEnded = false; el.addEventListener('scrollend', () => { window.__chartScrollEnded = true; }, { once: true }); });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#chartScroll').scrollLeft > 0);
    await page.waitForFunction(() => window.__chartScrollEnded);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => document.querySelector('.bar').dataset.year === '1992');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.bar').dataset.year === '2026' && document.querySelector('#chartScroll').scrollLeft === 0).catch(async error => {
      console.error('Chart resize diagnostic', await page.evaluate(() => ({ year: document.querySelector('.bar').dataset.year, left: document.querySelector('#chartScroll').scrollLeft, width: innerWidth, mobile: matchMedia('(max-width:620px)').matches, active: document.activeElement?.outerHTML.slice(0,200) })));
      throw error;
    });
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
            active: m.active, ceremonial: m.ceremonial, expectedStatLabels: MorothonCard.cardStats(m).map(s=>s[0].toLocaleLowerCase('nb-NO')),
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
        if (info.smallHeight) assert.ok(info.mainHeight > info.smallHeight);
        assert.equal(info.centered, true);
        assert.ok(Math.abs(info.numberCenter - info.countCenter) < 1);
        if (!info.ceremonial && info.earned.length) assert.ok(Math.abs(info.medalY - info.countY) < 1, 'Medal and number must use the same centre line');
        assert.equal(info.fits, true, `Profile ${sample.id} must fit ${width}px`);
        assert.deepEqual(info.statLabels,info.expectedStatLabels);
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
        CanvasRenderingContext2D.prototype.fillText = function(value, x, y, ...args) { const width = this.measureText(String(value)).width; text.push({ value: String(value), x: x - (this.textAlign === 'center' ? width / 2 : this.textAlign === 'right' ? width : 0), y, width, align: this.textAlign }); return originalText.call(this, value, x, y, ...args); };
        CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) { images.push(img.src); return originalImage.call(this, img, ...args); };
        try {
          const m = MorothonCard.model(pid), result = await buildShareCard(pid);
          const bitmap = await createImageBitmap(result.blob);
          const size = [bitmap.width, bitmap.height]; bitmap.close(); URL.revokeObjectURL(result.url);
          return { text, size, bytes: result.blob.size, earned: m.earned.map(b => BADGE_IMAGES[String(b.n)]), images,
            name: m.p.n, active: m.active, tier: m.tier, honorary: m.honorary, records: m.records.length, statLabels: MorothonCard.cardStats(m).map(s=>s[0]) };
        } finally { CanvasRenderingContext2D.prototype.fillText = originalText; CanvasRenderingContext2D.prototype.drawImage = originalImage; }
      }, pid);
      assert.equal(exported.size[0],1080);assert.equal(exported.size[1],1350);
      assert.ok(exported.bytes > 10000);
      assert.ok(exported.text.every(t => t.x >= 0 && t.x + t.width <= 1035 && t.y > 0 && t.y < 1330), `Text must fit canvas for ${pid}`);
      assert.ok(exported.earned.every(src => exported.images.includes(src)));
      if (exported.earned.length > 1) {
        const collection = exported.text.find(t => t.value === 'MIN MEDALJESAMLING');
        assert.ok(collection);
        assert.equal(exported.text.some(t => t.y > collection.y && t.y < collection.y + 110 && /^\d+$/.test(t.value)), false);
      }
      for (const label of ['DELTAKELSER',...exported.statLabels]) {
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
      assert.match(await page.evaluate(pid => MorothonCard.honorText(MorothonCard.model(pid)), pid), /samtlige utgaver siden 1992/);
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
    assert.equal(state.text.includes('samtlige'), false);
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
          if (String(value) === 'Finn din egen Morothon-historie') supportY = y;
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
      if (count < 30) layouts.push(result);
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
