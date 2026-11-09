const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const {createHash}=require('node:crypto');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');const hash=b=>createHash('sha256').update(b).digest('hex');let registry,report,inventory,h;
before(async()=>{[registry,report,inventory]=await Promise.all(['data/badges.json','assets/medals/quality-report.json','assets/medals/source-inventory.json'].map(async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'))));h=await createHarness();});
after(async()=>{await h?.close();});

test('all 11 official medals: native resolutions, correct contain DPI and explicit readiness',async()=>{
 assert.equal(report.medals.length,11);assert.ok(report.gitCommitsInspected>=45);assert.ok(report.gitImageAndHtmlBlobsInspected>=23);
 assert.deepEqual(report.medals.filter(m=>m.printReady).map(m=>m.id),['badge-35','badge-40','badge-45','badge-50']);
 for(const m of report.medals){
  assert.equal(hash(await fs.readFile(path.join(root,m.source))),m.sha256);
  assert.ok(Math.abs(m.maxPrintMm300[0]-m.width/300*25.4)<.01);
  assert.ok(Math.abs(m.maxPrintMm300[1]-m.height/300*25.4)<.01);
  const b=registry.badges.find(b=>b.id===m.id);
  assert.ok(Math.abs(m.dpiAtDiplomaSize-Math.max(m.width/b.widthMm,m.height/b.heightMm)*25.4)<.01);
  if(m.printReady){assert.equal(m.transparent,true);assert.equal(m.correctCutout,true);assert.equal(m.visibleEdgePixels,0);assert.ok(m.dpiAtDiplomaSize>=300);}
  else assert.ok(m.issues.length);
 }
 assert.equal(report.medals.find(m=>m.id==='record').width,900);
 assert.ok(report.medals.find(m=>m.id==='record').dpiAtDiplomaSize>415);
 assert.equal(report.medals.find(m=>m.id==='record').printReady,false); // Enough pixels cannot approve an opaque background.
 assert.equal(inventory.candidates.find(c=>c.id==='badge-20'&&c.highestAvailable).height,345);
 assert.equal(inventory.candidates.find(c=>c.id==='badge-30'&&c.highestAvailable).height,375);
});

test('four approved originals retain exact official bytes from Git; no generated replacement enters the registry',async()=>{
 // Independent fingerprints of the official V28 bytes; works after commit and in shallow checkouts.
 const originals={35:'041fb8f38ea4a3a9f337e2475c1aefd62f384575887402de7e89d94f59c55257',40:'188fabebc0fe5e43c2f3a1c333ea62b3c6ede1cac43b84986f80955b945c08aa',45:'78b389950aa7bf010b9b7637853d8ce3d97102283a61cb6cde0b7b2adfbffafc',50:'9fb5d174dca1042be16f3ec3c8be98a9f96dbb62705c79aaf9694c7ea7a75c6a'};
 for(const n of [35,40,45,50]){
  const b=registry.badges.find(b=>b.n===n),bytes=await fs.readFile(path.join(root,b.src));
  assert.equal(hash(bytes),originals[n]);
  assert.match(b.src,/^assets\/medals\/approved\//);assert.equal(hash(bytes),b.reviewedSha256);assert.equal(b.printReady,true);
 }
 assert.ok(registry.badges.every(b=>b.src.startsWith('assets/medals/')));
 assert.ok(registry.badges.every(b=>!b.src.includes('generated')&&!b.src.includes('AVVIST')));
});

test('light/dark gallery loads every original at mobile and desktop widths; SVG stays within its panels',async()=>{
 const page=await h.browser.newPage();try{
  await page.goto(h.base+'/assets/medals/review.html');await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  assert.equal(await page.locator('.item').count(),11);assert.equal(await page.locator('.item img').count(),22);
  for(const width of [320,390,1600]){
   await page.setViewportSize({width,height:1000});
   const fits=await page.evaluate(()=>({body:document.documentElement.scrollWidth<=innerWidth,images:[...document.querySelectorAll('.sample img')].every(i=>{const r=i.getBoundingClientRect(),p=i.parentElement.getBoundingClientRect();return r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5;})}));
   assert.equal(fits.body,true);assert.equal(fits.images,true);
  }
 }finally{await page.close();}
});

test('approved runner PNG retains native quality and unverified SVG cannot bypass source verification',async()=>{
 const bytes=await fs.readFile(path.join(root,registry.watermark.src));
 assert.equal(hash(bytes),registry.watermark.sha256);assert.equal(registry.watermark.printReady,true);
 const page=await h.browser.newPage();try{
  await page.goto(h.base);await page.waitForFunction(()=>!document.querySelector('#loading'));
  const r=await page.evaluate(async()=>{const d=await MorothonDiplomas.prepare('MOR-15AF3A3','badge:35');const im=new Image();im.src=d.watermarkSrc;await im.decode();return {dpi:d.watermarkDpi,ready:d.imageReady,w:im.naturalWidth,h:im.naturalHeight,issues:d.asset.issues};});
  assert.deepEqual([r.w,r.h],[1306,1205]);assert.ok(r.dpi>=300&&r.dpi<301);assert.equal(r.ready,true);assert.deepEqual(r.issues,[]);
 }finally{await page.close();}
 const data=structuredClone(registry);data.watermark.src='assets/medals/watermarks/unverified.svg';data.watermark.sha256='unverified';
 const p=await h.browser.newPage();try{
  await p.route('**/data/badges.json',r=>r.fulfill({json:data}));
  await p.route('**/assets/medals/watermarks/unverified.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="420" height="360"><path d="M0 0H420V360H0Z" fill="teal"/></svg>'}));
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  assert.equal(await p.evaluate(async()=> (await MorothonDiplomas.prepare('MOR-15AF3A3','badge:35')).imageReady),false);
 }finally{await p.close();}
});
