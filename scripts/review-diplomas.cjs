// node scripts/review-diplomas.cjs /absolute/review/output (no deployment or data changes).
const { createHarness } = require('./diploma-harness.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
(async () => {
  const out = path.resolve(process.argv[2] || '/tmp/morothon-diploma-review');
  await fs.mkdir(out, { recursive: true });
  const harness = await createHarness();
  try {
    const page = await harness.browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(harness.base); await page.waitForFunction(() => !document.querySelector('#loading'));
    const assets = await page.evaluate(async () => {
      const output = [];
      for (const key of [...PARTICIPATION_BADGES.map(b => `badge-${b.n}`), 'record', 'debut', ...MorothonBadges.list('service').map(b => b.id)]) {
        const { src, ...audit } = await MorothonDiplomas.inspectAsset(key); output.push(audit);
      }
      return output;
    });
    const samples = await page.evaluate(() => {
      const named = { 5: S.people.find(p => p.c >= 5 && p.c < 10 && !/Floke/i.test(p.n)), 10: S.people.find(p => p.n === 'Inger Katherin Dahl Frantzen'),
        15: S.people.find(p => p.c >= 15 && p.c < 20 && !/Floke/i.test(p.n)), 20: S.people.find(p => p.c >= 20 && p.c < 25 && !/Floke/i.test(p.n)),
        25: S.people.find(p => p.n === 'Solbjørg Tronstad Hausvik'), 30: S.people.find(p => p.n === 'Finn Gerhard Olsen'),
        35: S.people.find(p => p.n === 'Gunnar Kåsa') };
      return [...[5, 10, 15, 20, 25, 30, 35].map(n => ({ id: String(n), pid: named[n].i, key: `badge:${n}` })),
        { id: 'rekord', pid: S.people.find(p => p.n === 'Lars Aasheim Svaland').i, key: 'record:0' },
        { id: 'debut', pid: S.people.find(p => p.c === 1 && p.f === S.lastYear).i, key: 'debut' }];
    });
    const previews = [];
    for (const sample of samples) {
      const prepared = await page.evaluate(async ({ pid, key }) => {
        const m = await MorothonDiplomas.prepare(pid, key);
        return { html: MorothonDiplomas.documentHtml(m), name: m.name, title: m.title, year: m.year, dateLabel: m.dateLabel, imageReady: m.imageReady };
      }, sample);
      const preview = await harness.browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1.5 });
      await preview.route(harness.base + '/review-diploma/**', route => route.fulfill({ body: prepared.html, contentType: 'text/html' }));
      await preview.goto(harness.base + `/review-diploma/${sample.id}`);
      await preview.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      const failures = await preview.evaluate(() => {
        const sheet = document.querySelector('.diploma-sheet').getBoundingClientRect();
        return [...document.querySelectorAll('[data-layout-check],.diploma-recipient h2,.diploma-description')].filter(el => {
          const r = el.getBoundingClientRect(); return r.left < sheet.left || r.right > sheet.right + 1 || r.bottom > sheet.bottom + 1 || el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        }).map(el => el.className);
      });
      if (failures.length) throw new Error(`Layoutfeil i ${sample.id}: ${failures.join(', ')}`);
      await preview.locator('.diploma-sheet').screenshot({ path: path.join(out, `${sample.id}.png`) });
      await preview.pdf({ path: path.join(out, `${sample.id}-A4.pdf`), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      if (sample.id === '35') await preview.pdf({ path: path.join(out, 'Gunnar-Kaasa-A4.pdf'), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      previews.push({ id: sample.id, name: prepared.name, title: prepared.title, year: prepared.year, date: prepared.dateLabel, imageReady: prepared.imageReady, layoutReady: true });
      await preview.close();
    }
    await fs.writeFile(path.join(out, 'bildekontroll.json'), JSON.stringify(assets, null, 2) + '\n');
    await fs.writeFile(path.join(out, 'forhandsvisninger.json'), JSON.stringify(previews, null, 2) + '\n');
    const rows = assets.map(a => `| ${a.key} | ${a.width} × ${a.height} | ${a.widthMm.toFixed(1)} × ${a.heightMm.toFixed(1)} mm | ${Math.floor(a.dpi)} | ${a.cropReviewed ? 'Kontrollert original' : 'Original må kontrolleres'} | ${a.ready ? 'Bestått' : 'Ikke godkjent'} |`).join('\n');
    const report = `# Bildekontroll – master v2

Ett felles register: data/badges.json. Gunnar Kåsa v2 er layoutreferanse. Ingen resultatdata er endret. Tabellen måler faktisk aktiv bildefil i diplomfeltet, inkludert eventuell transparent luft. Bruksgodkjenning må ikke forveksles med native 300 DPI.

| Kilde | Native piksler | Bildeflate i diplom | DPI i bildeflaten | Kildekontroll | Bruk |
|---|---:|---:|---:|---|---|
${rows}

Alle løper-/rekordfiler er aktivert etter brukerens uttrykkelige godkjenning. 5–30 gir cirka 168–189 DPI ved 55 mm synlig medalje; rekordmerket cirka 298 DPI. Bildene er ikke oppskalert til en falsk detaljoppløsning. I dagens diplommal er 55 mm bildefeltet; transparent luft gjør selve medaljen mindre, og tabellen kan derfor vise høyere DPI enn 55 mm-testarket. Se ../faktisk-bildekvalitet.md for begge målinger. Ingen plassholder erstatter et godkjent løpermerke.

35/40/45/50 er uendrede 700px-originaler. Den valgte grove løperlogoen er brukerens godkjente PNG, og utskrift/PDF er tilgjengelig for kontrollerte løperdiplomer. Dugnads- og grunnleggerillustrasjonene bruker samme native 2400px-filer i hedersprofil og diplom. Grunnleggerens kryssende strek er fjernet i SVG-masteren, og PNG-en er eksportert på nytt uten andre endringer i vektordesignet. Bekreftede grunnleggere kan eksportere tydelig merkede diplomutkast; foreløpige dugnadsoppføringer gir ingen utstedt utmerkelse.

Oscar Lohne er bekreftet som grunnlegger. Dag Morten Frantzen og Håkon Lohne er foreløpig oppført som dugnadshelter. Ingen ubekreftet biografi eller minneseksjon er lagt til.

Datoer følger opptjeningsår, rekordår eller debutår. 11. november 2018 er bevart. Signaturfeltet er tomt.
`;
    const pdfImages = execFileSync('pdfimages', ['-list', path.join(out, 'Gunnar-Kaasa-A4.pdf')]).toString();
    if (!/\bimage\s+700\s+700\b/.test(pdfImages)) throw new Error('Den gjenfunne 700px-originalen mangler i utkast-PDF-en.');
    await fs.writeFile(path.join(out, 'bildekontroll.md'), report);
    const gallery = `<!doctype html><html lang="no"><meta charset="utf-8"><title>Morothon – merkediplomer</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#eeeae0;color:#123b45;font:16px Arial}h1,p{text-align:center}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}h2{font-size:18px;margin:0 0 8px;text-align:center}img{display:block;width:100%;height:auto;box-shadow:0 3px 12px #0002}small{display:block;text-align:center;margin-top:8px;color:#64716e}a{color:inherit;text-decoration:none}</style><h1>Morothon – sju merkediplomer</h1><p>Lyse A4-hedersdiplomer · Master v2 · godkjente løpermerker · dokumenterte native oppløsningsavvik</p><div class="grid">${previews.filter(p => /^\d+$/.test(p.id)).map(p => `<div><h2>${p.title}</h2><a href="${p.id}.png"><img src="${p.id}.png" alt="${p.title}"></a><small>${p.name} · ${p.date}</small></div>`).join('')}</div></html>`;
    await fs.writeFile(path.join(out, 'index.html'), gallery);
    const overview = await harness.browser.newPage({ viewport: { width: 1800, height: 1300 } });
    await overview.route(harness.base + '/gallery/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      if (!/^(index\.html|\d+\.png)$/.test(name)) return route.abort();
      return route.fulfill({ body: await fs.readFile(path.join(out, name)), contentType: name.endsWith('.png') ? 'image/png' : 'text/html' });
    });
    await overview.goto(harness.base + '/gallery/index.html');
    await overview.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await overview.screenshot({ path: path.join(out, 'oversikt.png'), fullPage: true });
    const honor = await harness.browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await honor.goto(harness.base + '/heder.html');
    await honor.waitForFunction(() => document.querySelectorAll('#serviceBadges img').length === 2);
    await honor.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await honor.screenshot({ path: path.join(out, 'hedersside-pc.png'), fullPage: true });
    await honor.setViewportSize({ width: 390, height: 844 });
    await honor.screenshot({ path: path.join(out, 'hedersside-mobil.png'), fullPage: true });
    const service = await page.evaluate(async () => MorothonDiplomas.documentHtml(await MorothonDiplomas.serviceDraft()));
    const servicePage = await harness.browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1.5 });
    await servicePage.setContent(service, { waitUntil: 'load' });
    await servicePage.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await servicePage.locator('.diploma-sheet').screenshot({ path: path.join(out, 'oscar-dugnadsdiplom-utkast.png') });
    await page.evaluate(() => openProfile('MOR-15AF3A3'));
    await page.locator('.brag-card').screenshot({ path: path.join(out, 'gunnar-skrytekort-profil.png') });
    const share = await page.evaluate(async () => { const c = await buildShareCard('MOR-15AF3A3'); const r = await fetch(c.url); const b = new Uint8Array(await r.arrayBuffer()); URL.revokeObjectURL(c.url); return Array.from(b); });
    await fs.writeFile(path.join(out, 'gunnar-delingskort.png'), Buffer.from(share));
    console.log(JSON.stringify({ output: out, previews: previews.length, assets: assets.length, activePreviewBelow300Dpi: assets.filter(a => a.dpi < 300).map(a => a.key), gunnarPdf: 'Gunnar-Kaasa-A4.pdf' }));
  } finally { await harness.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
