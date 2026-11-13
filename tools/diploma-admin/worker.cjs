// Local-only, bounded Chromium worker. No awards, approvals or source files are written.
const fs = require('node:fs/promises'), path = require('node:path');
const { promisify } = require('node:util'), { execFile } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const execute = promisify(execFile), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_ITEMS = 100;
function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) throw Error(`Velg mellom 1 og ${MAX_ITEMS} diplomer.`);
  const seen = new Set();
  return items.map(item => {
    if (!item || Object.keys(item).sort().join(',') !== 'display,key,kind,personId' || !['runner','honor'].includes(item.kind) ||
        !['all','latest'].includes(item.display) || typeof item.personId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.personId) ||
        typeof item.key !== 'string' || !/^[a-z0-9:-]{1,80}$/.test(item.key)) throw Error('Ugyldig mottaker, prestasjon eller medaljevisning.');
    return { kind: item.kind, personId: item.personId, key: item.key, display: item.display };
  }).filter(item => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; });
}
async function command(bin, args) {
  try { return (await execute(bin, args, { timeout: 60000, maxBuffer: 8 * 1024 * 1024 })).stdout; }
  catch (e) { if (e.code === 'ENOENT') throw Error(`Mangler ${bin}. Installer Poppler (poppler-utils) og start på nytt.`); throw Error(`${bin} kunne ikke kontrollere PDF-en.`); }
}
function dimensions(info, count) {
  const pageCount = info.match(/^Pages:\s+(\d+)/m);
  if (!pageCount || +pageCount[1] !== count) throw Error(`PDF-en har feil sideantall (forventet ${count}).`);
  const sizes = [...info.matchAll(/(?:Page\s+\d+\s+size|Page size):\s+([\d.]+) x ([\d.]+)/g)];
  if (sizes.length !== count || sizes.some(m => Math.abs(+m[1] - 841.89) > 1 || Math.abs(+m[2] - 595.28) > 1)) throw Error('Alle PDF-sider må være liggende A4 uten ekstra sider.');
}
const normalizedText = s => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
async function inspectPdf(file, expectations) {
  const count = expectations.length;
  dimensions(await command('pdfinfo', ['-f', '1', '-l', String(count), file]), count);
  const fonts = await command('pdffonts', [file]);
  const lines = fonts.split('\n').slice(2).filter(s => s.trim());
  if (!lines.length || lines.some(line => !/\byes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+\s*$/.test(line))) throw Error('PDF-en mangler innebygde fonter.');
  const texts = [];
  for (let i = 0; i < count; i++) {
    const text = normalizedText(await command('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', file, '-']));
    const expected = expectations[i];
    if (expected.requiredFont) {
      const pageFonts = await command('pdffonts', ['-f', String(i + 1), '-l', String(i + 1), file]);
      if (!new RegExp(expected.requiredFont, 'i').test(pageFonts)) throw Error(`Side ${i + 1}: diplomets håndskriftfont mangler. Installer fonts-urw-base35 for løperdiplomer.`);
    }
    if (!text || expected.expectedText.some(t => !text.includes(normalizedText(t)))) throw Error(`Side ${i + 1}: mottaker, dato eller signatur mangler.`);
    if (expected.mode === 'control' && !text.includes('KONTROLLKOPI')) throw Error(`Side ${i + 1}: kontrollkopimerkingen mangler.`);
    if (expected.mode === 'approved' && /KONTROLLKOPI|FORHÅNDSVISNING/.test(text)) throw Error(`Side ${i + 1}: godkjenningsstatus og PDF-merking er forskjellige.`);
    if (expected.pdfText && expected.pdfText !== text) throw Error(`Side ${i + 1}: innhold eller rekkefølge endret ved sammenslåing.`);
    texts.push(text);
  }
  return { pageCount: count, landscapeA4: true, fontsEmbedded: true, texts };
}
async function createWorker({ base, directory, assertSnapshot, beforeCheck, source } = {}) {
  for (const bin of ['pdfinfo', 'pdffonts', 'pdftotext', 'pdfunite']) await command(bin, ['-v']);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), args: ['--no-sandbox'] });
  const enginePath = path.join(__dirname, 'engine.js');
  async function engine() {
    const context = await browser.newContext({ viewport: { width: 1123, height: 794 }, serviceWorkers: 'block' });
    // Neither documents nor their fonts/assets may call an external service.
    await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    try {
      await page.goto(base + '/site/index.html'); await page.waitForFunction(() => !document.querySelector('#loading'));
      await page.addScriptTag({ path: enginePath });
      return { page, context };
    } catch (e) { await context.close(); throw e; }
  }
  let catalog;
  try { const e = await engine(); try { catalog = await e.page.evaluate(() => C1.catalog()); } finally { await e.context.close(); } }
  catch (e) { await browser.close(); throw e; }
  const allowed = new Map(catalog.map(p => [p.kind + ':' + p.personId, p]));
  async function render(item, index, pdfPath) {
    const person = allowed.get(item.kind + ':' + item.personId);
    if (!person || !person.options.some(o => o.key === item.key)) throw Error('Mottakeren eller prestasjonen er ikke tilgjengelig i godkjent offentlig grunnlag.');
    const e = await engine();
    try {
      const prepared = await e.page.evaluate(item => C1.prepare(item), item);
      await e.page.setContent(prepared.html, { waitUntil: 'load' });
      await e.page.emulateMedia({ media: 'print' });
      // Internal test seam only; no HTTP/CLI option accepts code or HTML.
      if (beforeCheck) await beforeCheck(e.page, item, index);
      const checked = await e.page.evaluate(() => C1.check());
      const entry = { ...item, name: prepared.name, title: prepared.title, year: prepared.year, period: prepared.period,
        count: prepared.count, date: prepared.date, dateBasis: prepared.dateBasis, assetKey: prepared.assetKey, priorBadges: prepared.priorBadges,
        status: checked.ready ? prepared.mode : 'blocked', reasons: prepared.reasons, errors: checked.failures,
        warnings: checked.warnings, approval: prepared.approval, contentSha256: sha(prepared.html),
        layout: { ready: checked.layout.ready, width: checked.layout.width, height: checked.layout.height },
        expectedText: prepared.expectedText, mode: prepared.mode, requiredFont: item.kind === 'honor' ? 'Caveat' : 'Z003|Chancery|SegoePrint' };
      if (checked.ready && pdfPath) {
        await e.page.pdf({ path: pdfPath, format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        const inspected = await inspectPdf(pdfPath, [entry]); entry.pdfText = inspected.texts[0];
      }
      return { entry, html: prepared.html };
    } finally { await e.context.close(); }
  }
  async function check(items, { preview = false } = {}) {
    items = normalizeItems(items); await assertSnapshot();
    const rows = []; let html;
    for (const [index, item] of items.entries()) {
      try { const result = await render(item, index); rows.push(result.entry); if (preview) html = result.html; }
      catch (e) { rows.push({ ...item, status: 'blocked', errors: [e.message], name: allowed.get(item.kind + ':' + item.personId)?.name || item.personId }); }
    }
    await assertSnapshot();
    return { schemaVersion: 1, checkedAt: new Date().toISOString(), pageCount: rows.length, entries: rows, ...(preview ? { html } : {}) };
  }
  async function produce(items, { allowControlCopies = false } = {}) {
    items = normalizeItems(items); await assertSnapshot();
    const id = randomUUID(), jobDir = path.join(directory, id); await fs.mkdir(jobDir, { mode: 0o700 });
    const entries = [], files = [];
    try {
      for (const [index, item] of items.entries()) {
        await assertSnapshot();
        const file = path.join(jobDir, `${index + 1}.pdf`); let entry;
        try { ({ entry } = await render(item, index, file)); }
        catch (error) { throw Error(`Side ${index + 1} (${allowed.get(item.kind + ':' + item.personId)?.name || item.personId}): ${error.message}`); }
        if (entry.status === 'blocked') throw Error(`Side ${index + 1} (${entry.name}): ${entry.errors.join(' ')}`);
        if (entry.status === 'control' && !allowControlCopies) throw Error(`Side ${index + 1} (${entry.name}) krever en tydelig merket kontrollkopi. Velg dette eksplisitt eller fjern mottakeren.`);
        entries.push(entry); files.push(file);
      }
      const pdf = path.join(jobDir, 'diplomer.pdf');
      if (files.length === 1) await fs.copyFile(files[0], pdf);
      else await command('pdfunite', [...files, pdf]);
      const inspected = await inspectPdf(pdf, entries); await assertSnapshot();
      const report = { schemaVersion: 1, id, generatedAt: new Date().toISOString(), pageCount: entries.length,
        formalIssuance: false, source, allowControlCopies, pdfSha256: sha(await fs.readFile(pdf)),
        checks: { landscapeA4: inspected.landscapeA4, fontsEmbedded: inspected.fontsEmbedded, everyPageAndOrderChecked: true },
        entries: entries.map(({ pdfText, expectedText, mode, ...entry }, i) => ({ page: i + 1, ...entry })) };
      const reportFile = path.join(jobDir, 'rapport.json'); await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
      for (const file of files) await fs.unlink(file);
      return { id, pdf, reportFile, report };
    } catch (e) { await fs.rm(jobDir, { recursive: true, force: true }); throw e; }
  }
  return { catalog, check, produce, close: () => browser.close() };
}
module.exports = { normalizeItems, inspectPdf, createWorker, MAX_ITEMS };
