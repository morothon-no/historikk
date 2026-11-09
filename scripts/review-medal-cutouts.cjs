// Controlled source-preserving cutouts, native-size proof PDF and review gallery. Local only.
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const out=path.resolve(process.argv[2]||'/tmp/morothon-cutout-review');await fs.mkdir(out,{recursive:true});
 const registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const cuts=JSON.parse(await fs.readFile(path.join(root,'assets/medals/review/cutouts/manifest.json'),'utf8'));
 const h=await createHarness();try{
  const p=await h.browser.newPage({viewport:{width:1600,height:1100}});await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  const rows=await p.evaluate(async({registry,cuts})=>{
   const result=[];
   for(const b of registry.badges.filter(b=>['participation','record'].includes(b.kind))){
    const cut=cuts.cutouts.find(c=>c.id===b.id),src=cut?.src||b.src;
    const im=new Image();im.src=new URL(src,document.baseURI).href;await im.decode();
    const w=im.naturalWidth,h=im.naturalHeight,c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,w,h).data;
    let x0=w,y0=h,x1=-1,y1=-1,edges=0,transparent=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const a=d[(y*w+x)*4+3];if(!a)transparent++;
     if(a>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
     if(a>32&&(x===0||y===0||x===w-1||y===h-1))edges++;
    }
    const bounds=[x0,y0,x1+1,y1+1],longest=Math.max(x1-x0+1,y1-y0+1),dpi=longest/55*25.4;
    const issues=[];
    if(cut)issues.push('Frileggingsutkast: manuell maske krever kantkontroll. Ingen nygenererte motivdetaljer.');
    if(dpi<300)issues.push('Native detaljoppløsning er under 300 DPI ved 55 mm. Oppskalering vil ikke dokumentere bedre detaljkvalitet.');
    if(edges)issues.push('Motivet berører kildebildets ytterkant. Eventuell kildebeskjæring kan ikke gjenopprettes uten ny original.');
    if(b.id==='badge-30'&&!b.retainRedArc)issues.push('Rød bue må avklares før endring.');
    if(b.id==='record')issues.push('Små mellomrom og mørke kanter mellom laurbærbladene må vurderes; ikke godkjent for trykk ennå.');
    result.push({id:b.id,name:b.name,src,originalSource:cut?.source||b.originalSource,originalSha256:cut?.sourceSha256||b.reviewedSha256,width:w,height:h,bounds,longestVisiblePixels:longest,medalSizeMm:55,effectiveDpiAt55:dpi,maxVisibleMm300:longest/300*25.4,fullyTransparentFraction:transparent/(w*h),visibleEdgePixels:edges,nativeRgbPreserved:cut?cut.nativeRgbPreserved:true,resized:false,generatedMotif:false,printReady:!cut&&b.printReady===true,status:cut?'review-pending':'quality-checked-original',issues});
   }return result;
  },{registry,cuts});
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const img=src=>src;
  const gallery=`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon – kontrollert frilegging</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#ebe6db;color:#12343e;font:15px/1.5 Arial}header{text-align:center;max-width:1000px;margin:0 auto 28px}h1{font-size:30px}h2{font-size:18px;margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.card{padding:18px;border:1px solid #d6c9b0;border-radius:12px;background:#fffdf7}.pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}.art{aspect-ratio:1;display:grid;place-items:center;padding:8px;min-width:0;overflow:hidden;background:#fffdf7}.dark{background:#09212d}.art img{width:100%;height:100%;object-fit:contain;min-height:0}.ok{color:#22684a}.pending{color:#985d28}small{display:block;font-size:12px}.card p{margin:10px 0 0}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><header><h1>Morothon – kontrollert frilegging</h1><p>Originalenes fargepiksler er uendret. Maskekantene er fortsatt til kontroll. Ingen oppskalering eller nygenererte medaljer.</p><p>35/40/45/50 er uendrede, godkjente originaler. 5–30 og rekordmerket er konservative frileggingsutkast til kantkontroll.</p></header><div class="grid">${rows.map(r=>`<article class="card" data-medal="${r.id}"><h2>${safe(r.name)}</h2><div class="pair"><div class="art"><img src="${img(r.src)}" alt="${safe(r.name)} på lys flate"></div><div class="art dark"><img src="${img(r.src)}" alt="${safe(r.name)} på mørk flate"></div></div><p>${r.width} × ${r.height} px · ${r.effectiveDpiAt55.toFixed(0)} DPI ved 55 mm motiv</p><small>Maks motivstørrelse ved 300 DPI: ${r.maxVisibleMm300.toFixed(1)} mm</small><p class="${r.printReady?'ok':'pending'}"><b>${r.printReady?'Godkjent original':'Ikke trykkgodkjent – frileggingsutkast'}</b></p><small>${r.issues.map(safe).join(' ')}</small></article>`).join('')}</div></html>`;
  const stage=r=>{
   const bw=r.bounds[2]-r.bounds[0],bh=r.bounds[3]-r.bounds[1],scale=55/Math.max(bw,bh),left=(55-bw*scale)/2-r.bounds[0]*scale,top=(55-bh*scale)/2-r.bounds[1]*scale;
   return `<div class="medal-stage" data-visible-mm="55" data-id="${r.id}"><img src="${img(r.src)}" style="width:${r.width*scale}mm;height:${r.height*scale}mm;left:${left}mm;top:${top}mm" alt="${safe(r.name)}"></div>`;
  };
  const proof=`<!doctype html><html lang="no"><meta charset="utf-8"><title>A4-testark – Morothon-medaljer 55 mm</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.sheet{width:210mm;height:297mm;padding:10mm 15mm;display:grid;grid-template-rows:14mm 258mm 5mm;color:#12343e;background:white;font-family:Arial;print-color-adjust:exact;-webkit-print-color-adjust:exact}header h1{font-size:4.5mm;margin:0 0 1mm}header p{font-size:2.5mm;margin:0}.proof-grid{display:grid;grid-template-columns:repeat(3,55mm);grid-template-rows:repeat(4,63mm);gap:2mm 7.5mm}.proof-cell{width:55mm;height:63mm}.medal-stage{position:relative;overflow:hidden;width:55mm;height:55mm;outline:.1mm dashed #d4d4ca}.medal-stage img{position:absolute;max-width:none;max-height:none}.caption{height:8mm;font-size:2.2mm;line-height:1.25;padding-top:.7mm}.caption strong{display:block;font-size:2.5mm}footer{display:flex;align-items:center;justify-content:space-between;font-size:2.1mm}.measure{display:inline-block;width:50mm;border-top:.25mm solid #12343e;text-align:center}.pending{color:#8a562b}.ok{color:#22684a}</style><article class="sheet"><header><h1>Morothon – A4-testark · 55 mm medaljer</h1><p>Lengste synlige motivkant er 55 mm. Skriv ut 100 %, uten tilpasning, marger eller topp-/bunntekst.</p></header><div class="proof-grid">${rows.map(r=>`<section class="proof-cell">${stage(r)}<div class="caption ${r.printReady?'ok':'pending'}"><strong>${safe(r.name)}</strong>${r.effectiveDpiAt55.toFixed(0)} DPI · ${r.printReady?'Godkjent original':'UTKAST – ikke trykkgodkjent'}</div></section>`).join('')}</div><footer><span>Prøveark – ingen endring av offisielle motiv.</span><span class="measure">Kontrollmål: 50 mm</span></footer></article></html>`;
  for(const [name,html]of [['oversikt.html',gallery],['A4-testark.html',proof]]){
   await fs.writeFile(path.join(out,name),html);await p.route(h.base+'/'+name,route=>route.fulfill({contentType:'text/html',body:html}));await p.goto(h.base+'/'+name);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   if(name==='oversikt.html'){
    await p.screenshot({path:path.join(out,'alle-medaljer-lys-mork.png'),fullPage:true});
    for(const id of ['record','badge-5','badge-30'])await p.locator(`[data-medal="${id}"]`).screenshot({path:path.join(out,id+'-kontroll.png')});
   }else{
    const sizes=await p.locator('.medal-stage').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}));
    if(sizes.length!==11||sizes.some(([w,h])=>Math.abs(w-55*96/25.4)>.1||Math.abs(h-55*96/25.4)>.1))throw Error('55 mm proof field mismatch');
    await p.locator('.sheet').screenshot({path:path.join(out,'A4-testark.png')});
    await p.pdf({path:path.join(out,'A4-testark-55mm.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
   }
  }
  const info=execFileSync('pdfinfo',[path.join(out,'A4-testark-55mm.pdf')]).toString();if(!/Pages:\s+1\b/.test(info))throw Error('Proof is not one A4 page');
  await fs.writeFile(path.join(out,'PDF-kontroll.txt'),info+'\n'+execFileSync('pdfimages',['-list',path.join(out,'A4-testark-55mm.pdf')]).toString());
  await fs.writeFile(path.join(out,'kvalitetsrapport.json'),JSON.stringify({schemaVersion:1,scope:'Native motifs on A4 at 55 mm, measured from nonzero-alpha bounds; no resolution gain claimed',medals:rows},null,2)+'\n');
  const report=`# Morothon – kontrollert frilegging og 55 mm prøvetrykk\n\nGitHub main er hentet lesende uten push eller endringer i arbeidsfilene. 45 tilgjengelige commits og 23 unike HTML-/bildeblobs er undersøkt på nytt. Ingen større løperoriginaler ble funnet. Masterpakke, innebygde bilder og tidligere lokale kilder er også kontrollert.\n\nAlle sju frileggingsutkast beholder hver eneste RGB-piksel i den dekodede originalen, også under transparent bakgrunn. Bare alfa er endret med eksplisitte manuelle masker. Ingen skalering, skarphetsfilter, oppfunne detaljer eller generativt motiv er brukt. Maskenes nøyaktighet er likevel en separat kontroll: RGB-bevaring beviser ikke at en maske følger ytterkanten perfekt.\n\n35/40/45/50 er uendrede originalfiler. SHA-256 og synlig kantkontakt er kontrollert. Deres godkjenning er beholdt. De øvrige er ikke aktivert i registerets produksjonsoppslag.\n\n| Merke | Native fil | Native motiv ved 55 mm | Maks motiv ved 300 DPI | Status |\n|---|---:|---:|---:|---|\n${rows.map(r=>`| ${r.name} | ${r.width} × ${r.height} | ${r.effectiveDpiAt55.toFixed(0)} DPI | ${r.maxVisibleMm300.toFixed(1)} mm | ${r.printReady?'Godkjent original':'Frileggingsutkast, ikke godkjent'} |`).join('\n')}\n\nDPI her måler selve maskens synlige motiv ved 55 mm, ikke en større fotografisk bakgrunn eller filens transparente luft. Dette er derfor en strengere og mer relevant kontroll enn å regne på hele bildeflaten. Oppløsningen har ikke økt. A4-testarket viser alle motiver med lengste synlige kant 55 mm. Papirutskrift må være 100 %; kontroller 50 mm-linjen med linjal. PDF-en har én A4-side. Et digitalt testark erstatter ikke et fysisk prøvetrykk.\n\n${rows.map(r=>`## ${r.name}\n\nKilde: \`${r.originalSource}\`. Visning: \`${r.src}\`.\n\n- Alfa: ${(r.fullyTransparentFraction*100).toFixed(1)} % helt transparent.\n- Synlige piksler på kildegrensen: ${r.visibleEdgePixels}.\n- ${r.issues.length?r.issues.join('\n- '):'Godkjent original, ingen nye kantproblemer observert.'}\n`).join('\n')}\n\nKantene i frileggingsutkastene må fortsatt gjennomgås i tilstrekkelig forstørrelse. 5–30 kan ikke trykkgodkjennes ved 55 mm/300 DPI ut fra eksisterende kilder. Rekordmerket lander på cirka 298 DPI ved 55 mm synlig motiv, marginalt under 300. Ved omtrent 54,7 mm når det 300 DPI. Mellomrom/ytterkanter mellom laurbærbladene er heller ikke endelig godkjent. Behold eksisterende motiv og hent bedre originaler fremfor å generere nye.\n\nAlle aktive merker hentes fra det eksisterende fellesregisteret data/badges.json. Godkjente originaler brukes i diplom/profil/skrytekort. Uavklarte utkast holdes separat, og plassholdere er ikke byttet ut med uavklarte filer.\n`;
  await fs.writeFile(path.join(out,'kvalitetsrapport.md'),report);
  if(!process.argv.includes('--no-save-project-report')) await fs.writeFile(path.join(root,'assets/medals/review/cutouts/proof-quality.json'),JSON.stringify({schemaVersion:1,medals:rows},null,2)+'\n');
  console.log(JSON.stringify({out,medals:rows.length,ready:rows.filter(r=>r.printReady).map(r=>r.id),pdf:'A4-testark-55mm.pdf'}));
 }finally{await h.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
