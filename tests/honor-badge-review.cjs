const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs'),{inspectVector,textContrast}=require('../scripts/review-honor-badges.cjs');
const root=path.resolve(__dirname,'..'),base='861cd13',levels=[5,10,15,20,30,40];let h,registry,honors;
before(async()=>{h=await createHarness();registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));honors=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));});
after(async()=>{await h?.close();});

test('PR16 all nine real vectors have unclipped, non-overlapping text in native and Windows-compatible font environments',async()=>{
 const p=await h.browser.newPage();try{
  for(const badge of registry.badges.filter(b=>b.kind==='service'&&b.displayOnHonorPage!==false))for(const font of [null,'Arial, sans-serif']){
   const r=await inspectVector(p,h.base+'/'+badge.vectorSource,font);
   assert.equal(r.viewBox,'0 0 1200 1200');assert.ok(r.text.length>0);
   for(const text of r.text){const b=text.ink;assert.ok(b.left>=0&&b.top>=0&&b.right<=1200&&b.bottom<=1200,badge.id+': '+JSON.stringify(text));}
   for(let i=0;i<r.text.length;i++)for(let j=i+1;j<r.text.length;j++){
    const a=r.text[i].ink,b=r.text[j].ink;
    assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)+.5||Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top)+.5,badge.id+': '+r.text[i].text+' overlaps '+r.text[j].text);
   }
   if(badge.series==='dugnad'){
    assert.ok(r.count.top-r.emblem.bottom>=4,badge.id+': emblem/count gap');
    const title=r.text.filter(t=>t.role==='title');assert.ok(title.length);
    for(const t of title)assert.ok(t.ink.left>=186&&t.ink.right<=1014&&t.ink.top>=682&&t.ink.bottom<=816,badge.id+': title outside ribbon');
    assert.ok(r.text.filter(t=>t.role==='caption').every(t=>t.size>=40));
   }
  }
 }finally{await p.close();}
});

test('PR16 milestone diplomas freeze the count, period, selected humour and actual race date without later honors',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  for(const id of ['oscar-lohne','erling-askildsen']){
   const result=await p.evaluate(async id=>{
    const thirty=await MorothonDiplomas.serviceDraft(id,'service-dugnad-30'),honor=await MorothonDiplomas.serviceDraft(id);
    return {thirty:{count:thirty.contributionCount,first:thirty.contributionFirst,last:thirty.contributionLast,date:thirty.dateLabel,year:thirty.achievementYear,tribute:thirty.tribute,secondary:thirty.secondaryAssets.length,ready:thirty.imageReady,preview:thirty.previewOnly},honor:{count:honor.contributionCount,first:honor.contributionFirst,last:honor.contributionLast,date:honor.dateLabel,ready:honor.imageReady,preview:honor.previewOnly},source:(await MorothonHonorsData.find(id)).member.contribution.confirmedYears.length};
   },id);
   assert.deepEqual([result.thirty.count,result.thirty.first,result.thirty.last,result.thirty.year,result.thirty.date],[30,1992,2021,2021,'Søgne, 13. november 2021']);
   assert.equal(result.thirty.tribute,honors.diplomaExamples.find(e=>e.id==='dugnad-30').tribute);assert.match(result.thirty.tribute,/Riksantikvaren/);assert.equal(result.thirty.secondary,0);
   assert.deepEqual([result.honor.count,result.honor.first,result.honor.last,result.honor.date],[35,1992,2026,'Søgne, 7. november 2026']);
   assert.equal(result.source,35);for(const d of [result.thirty,result.honor]){assert.equal(d.ready,false);assert.equal(d.preview,true);}
  }
  for(const example of honors.diplomaExamples.filter(e=>e.illustrative)){
   const d=await p.evaluate(async id=>{const d=await MorothonDiplomas.serviceExample(id);return {count:d.contributionCount,date:d.dateLabel,year:d.achievementYear,tribute:d.tribute};},example.id);
   assert.equal(d.count,example.contributionCount);assert.equal(d.tribute,example.tribute);assert.equal(d.year,null);assert.equal(d.date,'');
  }
 }finally{await p.close();}
});

test('PR16 every example describes its selected threshold, never five years for all six levels',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  for(const e of honors.diplomaExamples.filter(e=>e.illustrative)){
   const text=await p.locator(`[data-example="${e.id}"]`).textContent();assert.ok(text.includes(e.contributionCount+' dokumenterte dugnadsutgaver'));assert.ok(text.includes('Vis utkastet for '+e.contributionCount+' dugnadsutgaver'));
  }
 }finally{await p.close();}
});

test('PR16 every honorary A4 example retains legible metallic text above 4.5:1 contrast',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  await p.locator('.honor-diploma-examples>summary').click();
  for(const example of honors.diplomaExamples){
   const container=p.locator(`[data-example="${example.id}"]`);await container.locator('.honor-example-preview>summary').click();
   await p.waitForFunction(id=>document.querySelector(`[data-example="${id}"] .honor-diploma-status`)?.textContent.includes('A4-utkast kontrollert'),example.id);
   const frame=await(await container.locator('iframe').elementHandle()).contentFrame(),contrasts=await frame.evaluate(textContrast);
   assert.ok(contrasts.length>=3);assert.ok(contrasts.every(c=>c.ratio>=4.5),example.id+': '+JSON.stringify(contrasts));
  }
 }finally{await p.close();}
});

test('PR16 legacy assets, all histories, IDs, awards and ordinary diploma implementation remain unchanged',async()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',base,'data','assets/medals','index.html','js/brag-card.js','js/history-data.js'],{cwd:root}).toString().trim().split('\n');
 const allowed=new Set([...levels.map(n=>'assets/medals/service/dugnad-'+n+'.svg'),'assets/medals/service/aeresmerke.svg','data/honors.json','data/volunteers.json']);
 for(const f of files.filter(f=>!allowed.has(f)))assert.deepEqual(await fs.readFile(path.join(root,f)),execFileSync('git',['show',base+':'+f],{cwd:root}),f);
 const originalCss=execFileSync('git',['show',base+':css/diplomas.css'],{cwd:root}).toString(),css=await fs.readFile(path.join(root,'css/diplomas.css'),'utf8');assert.ok(css.startsWith(originalCss));assert.match(css.slice(originalCss.length),/\.diploma-service /);
 const ordinary=s=>s.replace(/  async function serviceContent\([\s\S]*?(?=  function signoffHtml)/,'SERVICE-ONLY\n')
  .replace(/  \/\/ Volunteer diplomas show the documented milestone YEAR only\.[\s\S]*?(?=  function serviceDocumentHtml)/,'')
  .replace(/  function serviceDocumentHtml\([\s\S]*?(?=  function documentHtml)/,'SERVICE-DOCUMENT-ONLY\n');
 assert.equal(ordinary(await fs.readFile(path.join(root,'js/diplomas.js'),'utf8')),ordinary(execFileSync('git',['show',base+':js/diplomas.js'],{cwd:root}).toString()));
 for(const b of registry.badges.filter(b=>b.kind==='service')){assert.equal(b.status,'design-draft');assert.equal(b.printReady,false);assert.equal(b.cropReviewed,false);}
 assert.ok(honors.groups.flatMap(g=>g.members).every(m=>!m.awards.length&&!m.issuedDiplomas.length));
});
