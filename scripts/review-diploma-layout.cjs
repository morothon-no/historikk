// Local review artifacts only. Never sends, publishes or issues a diploma.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
(async()=>{const out=path.resolve(process.argv[2]||'/tmp/morothon-diploma-layout');await fs.mkdir(out,{recursive:true});const h=await createHarness();try{
 const p=await h.browser.newPage(),measurements=[];let html;
 for(const width of [320,390,768,1440]){
  await p.setViewportSize({width,height:1400});await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));await p.evaluate(()=>MorothonDiplomas.open('MOR-C788866'));
  const state=await p.evaluate(()=>{const d=MorothonDiplomas.current(),v=document.querySelector('.diploma-preview'),f=v.querySelector('iframe');return {width:innerWidth,ready:d.ready,layout:d.layout,name:d.name,count:d.count,year:d.year,date:d.dateLabel,preview:v.getBoundingClientRect().toJSON(),frame:f.getBoundingClientRect().toJSON(),warnings:d.asset.warnings};});
  assert.equal(state.ready,true);measurements.push(state);await p.locator('#diplomaDialog').screenshot({path:path.join(out,`Inger-solvdiplom-${width}px.png`)});
  html=await p.evaluate(()=>document.querySelector('#diplomaDialog iframe').srcdoc);
 }
 const d=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:1.5});await d.setContent(html);await d.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 await d.locator('.diploma-sheet').screenshot({path:path.join(out,'Inger-solvdiplom-A4.png')});
 const pdf=await d.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});await fs.writeFile(path.join(out,'Inger-solvdiplom-A4.pdf'),pdf);const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);await d.close();
 await fs.writeFile(path.join(out,'layout-malinger.json'),JSON.stringify(measurements,null,2)+'\n');await fs.writeFile(path.join(out,'A4-kontroll.txt'),info);
 const gallery='<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Morothon – diplomlayout</title><style>body{background:#f4f0e5;color:#123b45;font:16px Arial;margin:24px auto;max-width:1250px;padding:0 20px}img{max-width:100%;height:auto}a{color:inherit}.grid{display:grid;grid-template-columns:1fr 1fr;gap:25px}@media(max-width:650px){.grid{grid-template-columns:1fr}}article{padding:18px;background:white;border:1px solid #cab886;border-radius:12px}h1,h2{text-align:center}</style><h1>Ingers historiske sølvdiplom</h1><p>10 deltakelser · 2015–2024 · Søgne, 9. november 2024. Lokal forhåndsvisning; ingen utstedelse eller publisering.</p><p><a href="Inger-solvdiplom-A4.pdf">Liggende A4-PDF</a> · <a href="layout-malinger.json">Layoutmålinger</a> · <a href="../sluttrapport.md">Rapport</a></p><img src="Inger-solvdiplom-A4.png" alt="Ingers sølvdiplom i A4"><div class="grid">'+[320,390,768,1440].map(w=>`<article><h2>${w}px</h2><a href="Inger-solvdiplom-${w}px.png"><img src="Inger-solvdiplom-${w}px.png" alt="Diplomdialog ved ${w} piksler"></a></article>`).join('')+'</div></html>';
 await fs.writeFile(path.join(out,'index.html'),gallery);console.log(JSON.stringify({out,previews:4,landscapeA4:true,printReady:measurements.every(m=>m.ready)}));
 }finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1});
