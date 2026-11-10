// Current approved assets only. Historical mask-review reports are left intact.
// Creates local proof files; never changes assets, pushes or deploys.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('./diploma-harness.cjs');
const root = path.resolve(__dirname, '..');
const safe = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

(async () => {
  const out = path.resolve(process.argv[2] || '/tmp/morothon-approved-medals');
  await fs.mkdir(out, { recursive: true });
  const h = await createHarness();
  try {
    const p = await h.browser.newPage({ viewport: { width: 1600, height: 1100 } });
    await p.goto(h.base); await p.waitForFunction(() => !document.querySelector('#loading'));
    const rows = await p.evaluate(async () => {
      const rows = [];
      for (const b of [...MorothonBadges.list('participation'), MorothonBadges.get('record')]) {
        const a = await MorothonDiplomas.inspectAsset(b.id);
        const im = new Image(); im.src = a.src; await im.decode();
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        let x0=c.width, y0=c.height, x1=-1, y1=-1, transparent=0;
        for (let y=0; y<c.height; y++) for (let x=0; x<c.width; x++) {
          const alpha=pixels[(y*c.width+x)*4+3];
          if (!alpha) transparent++;
          if (alpha>0) { x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
        }
        const longest=Math.max(x1-x0+1,y1-y0+1), dpiAt55=longest/55*25.4;
        rows.push({id:b.id,name:b.name,src:b.src,width:c.width,height:c.height,bounds:[x0,y0,x1+1,y1+1],
          sha256:a.digest,transparentFraction:transparent/(c.width*c.height),edgeContact:a.edgeContact,
          dpiAt55,maxVisibleMm300:longest/300*25.4,dpiInDiploma:a.dpi,
          native300At55:dpiAt55>=300,userApproved:a.userApproved,sourceCheck:a.ready,warnings:a.warnings});
      }
      return rows;
    });
    assert.equal(rows.length,11);
    for (const r of rows) { assert.equal(r.sourceCheck,true,r.id); assert.equal(r.userApproved,true,r.id); assert.ok(r.transparentFraction>0,r.id); }
    for (const r of rows) {
      const mime=r.src.endsWith('.png')?'image/png':'image/webp';
      r.dataUrl=`data:${mime};base64,${(await fs.readFile(path.join(root,r.src))).toString('base64')}`;
    }
    const status = r => r.native300At55 ? 'Godkjent original · minst 300 DPI' : 'Brukergodkjent avvik · under 300 DPI';
    const stage = r => {
      const [x0,y0,x1,y1]=r.bounds, bw=x1-x0, bh=y1-y0, scale=55/Math.max(bw,bh);
      return `<div class="medal-stage" data-visible-mm="55"><img src="${r.dataUrl}" alt="${safe(r.name)}" style="width:${r.width*scale}mm;height:${r.height*scale}mm;left:${(55-bw*scale)/2-x0*scale}mm;top:${(55-bh*scale)/2-y0*scale}mm"></div>`;
    };
    const gallery=`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon – godkjente medaljefiler</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#ebe6db;color:#12343e;font:15px/1.5 Arial}header{text-align:center;max-width:1000px;margin:0 auto 25px}h2{font-size:18px;margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{padding:18px;border:1px solid #d6c9b0;border-radius:12px;background:#fffdf7}.pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}.art{aspect-ratio:1;display:grid;place-items:center;padding:8px;min-width:0;background:#fffdf7}.dark{background:#09212d}.art img{width:100%;height:100%;object-fit:contain;min-height:0}small{display:block;font-size:12px}.warning{color:#8c5b25}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><header><h1>Morothons offisielle medaljer</h1><p>Aktive, brukergodkjente filer fra fellesregisteret · samme motiv på lys og mørk flate</p><p>Ingen motiv er endret eller oppskalert. Brukergodkjenning av et avvik betyr ikke at filen har 300 DPI ved 55 mm.</p></header><div class="grid">${rows.map(r=>`<article class="card"><h2>${safe(r.name)}</h2><div class="pair"><div class="art"><img src="${r.dataUrl}" alt="${safe(r.name)} på lys flate"></div><div class="art dark"><img src="${r.dataUrl}" alt="${safe(r.name)} på mørk flate"></div></div><p>${r.width} × ${r.height} px · transparent</p><small>${r.dpiAt55.toFixed(0)} DPI ved 55 mm synlig motiv · maks ${r.maxVisibleMm300.toFixed(1)} mm ved 300 DPI</small><p class="${r.native300At55?'':'warning'}"><b>${status(r)}</b></p><small>${r.edgeContact?'Motivet berører originalens bildekant; tidligere dokumentert og brukerakseptert kildebegrensning.':'Ingen synlige piksler berører bildekanten.'}</small></article>`).join('')}</div></html>`;
    const proof=`<!doctype html><html lang="no"><meta charset="utf-8"><title>A4 – Morothon-medaljer 55 mm</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.sheet{width:210mm;height:297mm;padding:10mm 15mm;display:grid;grid-template-rows:14mm 258mm 5mm;color:#12343e;background:white;font-family:Arial;print-color-adjust:exact;-webkit-print-color-adjust:exact}header h1{font-size:4.5mm;margin:0 0 1mm}header p{font-size:2.5mm;margin:0}.proof-grid{display:grid;grid-template-columns:repeat(3,55mm);grid-template-rows:repeat(4,63mm);gap:2mm 7.5mm}.cell{width:55mm;height:63mm}.medal-stage{position:relative;width:55mm;height:55mm;overflow:hidden;outline:.1mm dashed #d4d4ca}.medal-stage img{position:absolute;max-width:none;max-height:none}.caption{height:8mm;font-size:2.1mm;line-height:1.25;padding-top:.7mm}.caption strong{display:block;font-size:2.5mm}.warning{color:#8c5b25}footer{display:flex;align-items:center;justify-content:space-between;font-size:2mm}.measure{width:50mm;border-top:.25mm solid #12343e;text-align:center}</style><article class="sheet"><header><h1>Morothon – godkjente filer · 55 mm motiv</h1><p>Skriv ut ved 100 %, uten tilpasning. Brukergodkjente avvik er oppgitt; ingen oppskalering.</p></header><div class="proof-grid">${rows.map(r=>`<section class="cell">${stage(r)}<div class="caption ${r.native300At55?'':'warning'}"><strong>${safe(r.name)}</strong>${r.dpiAt55.toFixed(0)} DPI · ${r.native300At55?'minst 300 DPI':'brukergodkjent oppløsningsavvik'}</div></section>`).join('')}</div><footer><span>Digital kontroll; fysisk prøvetrykk er ikke utført her.</span><span class="measure">Kontrollmål: 50 mm</span></footer></article></html>`;
    for (const [name,html] of [['oversikt.html',gallery],['A4-testark.html',proof]]) {
      await fs.writeFile(path.join(out,name),html);
      await p.setContent(html,{waitUntil:'load'}); await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
      if (name==='oversikt.html') await p.screenshot({path:path.join(out,'alle-medaljer-lys-mork.png'),fullPage:true});
      else {
        const sizes=await p.locator('.medal-stage').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}));
        assert.equal(sizes.length,11);
        for (const [w,height] of sizes) { assert.ok(Math.abs(w-55*96/25.4)<.1); assert.ok(Math.abs(height-55*96/25.4)<.1); }
        await p.locator('.sheet').screenshot({path:path.join(out,'A4-testark.png')});
        await p.pdf({path:path.join(out,'A4-testark-55mm.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
      }
    }
    const pdf=path.join(out,'A4-testark-55mm.pdf'),info=execFileSync('pdfinfo',[pdf]).toString();
    assert.match(info,/Pages:\s+1\b/);
    const pageSize=info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts \(A4\)/);
    assert.ok(pageSize,'PDF must be A4');
    assert.ok(Math.abs(Number(pageSize[1])-210/25.4*72)<1 && Math.abs(Number(pageSize[2])-297/25.4*72)<1,'A4 page dimensions within Chromium rounding');
    await fs.writeFile(path.join(out,'PDF-kontroll.txt'),info+'\n'+execFileSync('pdfimages',['-list',pdf]).toString());
    await fs.writeFile(path.join(out,'kvalitetsrapport.json'),JSON.stringify(rows.map(({dataUrl,...r})=>r),null,2)+'\n');
    const report=`# Morothon – aktive medaljefiler og faktisk kvalitet\n\nAlle elleve aktive filer er målt på nytt og kontrollert mot fellesregisterets hashbundne godkjenning. Originale RGB-piksler, form, motiv, tekst og farger er bevart. Ingen redesign eller oppskalering. Tidligere kildesøk fant ikke større originaler for 5–30. Ingen ny nettverkshenting eller nye originalfunn er gjort i denne sluttjusteringen.\n\n| Merke | Native piksler | DPI ved 55 mm motiv | Maks motiv ved 300 DPI | Status |\n|---|---:|---:|---:|---|\n${rows.map(r=>`| ${r.name} | ${r.width} × ${r.height} | ${r.dpiAt55.toFixed(0)} | ${r.maxVisibleMm300.toFixed(1)} mm | ${status(r)} |`).join('\n')}\n\n## Begrensninger\n\n5–30 har 168–189 DPI ved 55 mm synlig motiv; rekordmerket har cirka 298 DPI. Disse filene er brukergodkjent med dokumenterte oppløsningsavvik, ikke dokumentert som nye 300 DPI-originaler. Kildegrensen berøres av noen piksler på 5/10/15/25; dette er tidligere dokumentert og brukerakseptert, uten nye beskjæringer. 35/40/45/50 er uendrede 700 × 700-originaler med cirka 323 DPI og fri bildekant. Alle filene har gjennomsiktig bakgrunn og vises på både lys og mørk flate.\n\nA4-testarket viser 55 mm lengste synlige motivkant med bevart sideforhold, og en kontrollstrek på 50 mm. PDF-format og størrelser er maskinelt kontrollert; fysisk prøvetrykk må utføres på skriver ved 100 %. Gjeldende diplommal bruker et 55 mm bildefelt, der transparent luft kan gi et mindre synlig motiv; se hedersrapportens separate DPI-måling.\n\n## Kilder og kontroll\n\n${rows.map(r=>`- ${r.name}: \`${r.src}\`, SHA-256 \`${r.sha256}\`.`).join('\n')}\n`;
    await fs.writeFile(path.join(out,'kvalitetsrapport.md'),report);
    console.log(JSON.stringify({out,medals:rows.length,approved:rows.filter(r=>r.userApproved).length,native300At55:rows.filter(r=>r.native300At55).length,pdfPages:1}));
  } finally { await h.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
