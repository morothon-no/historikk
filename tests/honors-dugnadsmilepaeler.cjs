const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let h;
const milestones=[5,10,15,20,30,40];
before(async()=>{h=await createHarness()});
after(async()=>{await h?.close()});

test('six documented volunteer-milestone designs coexist with three individual awards and preserve originals',async()=>{
 const r=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const service=r.badges.filter(b=>b.kind==='service'),tenure=service.filter(b=>b.series==='dugnad');
 assert.deepEqual(tenure.map(b=>b.milestoneEditions),milestones);
 assert.deepEqual(tenure.map(b=>b.name),['Ivrig hjelper','Dugnadshelt','Trofast ildsjel','Bærebjelke','Fredet inventar','Morothon-legende']);
 assert.deepEqual(tenure.map(b=>b.id),milestones.map(n=>'service-dugnad-'+n));
 assert.equal(service.filter(b=>b.displayOnHonorPage!==false).length,9);
 assert.equal(service.find(b=>b.id==='service-dugnadshelt').displayOnHonorPage,false);
 for(const b of tenure){
   assert.equal(b.status,'design-draft');assert.equal(b.printReady,false);assert.equal(b.cropReviewed,false);
   assert.equal(b.src,b.vectorSource);
   const svg=await fs.readFile(path.join(root,b.src),'utf8');
   assert.match(svg,new RegExp('>'+b.milestoneEditions+'<\\/text>'));
   assert.match(svg,/DUGNADSUTGAVER/);
   const texts=[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));assert.ok(texts.some(t=>t.replace(/\s+/g,'')===b.name.toLocaleUpperCase('nb-NO').replace(/\s+/g,'')),'Badge title missing: '+b.name);
   assert.equal(b.printReady,false);
 }
});

test('only explicitly documented volunteer editions count and determine highest candidate and next milestone, without awarding',async()=>{
 const p=await h.browser.newPage();
 try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  const r=await p.evaluate(async()=>{
    const data=await MorothonHonorsData.load(),f=MorothonHonorsData.tenureMilestones;
    const oscar=data.groups.flatMap(g=>g.members).find(x=>x.id==='oscar-lohne'),jon=data.groups.flatMap(g=>g.members).find(x=>x.id==='jon-fjeld');
    const known=f(data,oscar),unknown=f(data,jon);
    const test=counts=>counts.map(n=>{
      const m={contribution:{confirmedYears:Array.from({length:n},(_,i)=>1992+i),sourceIds:['organizer-v34']},awards:[],issuedDiplomas:[]};
      return {n,...f(data,m,Array.from({length:n},(_,i)=>1992+i)),awards:m.awards,issued:m.issuedDiplomas};
    });
    const gaps=f(data,{contribution:{fromYear:2014,confirmedYears:[2014,2015,2020,2022,2026],sourceIds:['organizer-v34']}});
    return {known,unknown,gaps,checks:test([0,4,5,9,10,14,15,19,20,29,30,35,39,40])};
  });
  assert.deepEqual(r.known.qualified.map(m=>m.editions),[5,10,15,20,30]);
  assert.equal(r.known.highestQualified.editions,30);
  assert.equal(r.known.next.editions,40);assert.equal(r.known.next.remaining,5);
  assert.equal(r.unknown.documentedEditions,0);
  assert.equal(r.gaps.documentedEditions,5);
  assert.equal(r.gaps.highestQualified.editions,5);
  for(const a of r.checks){
    assert.deepEqual(a.qualified.map(b=>b.editions),milestones.filter(n=>n<=a.n),''+a.n);
    assert.equal(a.automaticallyAwarded,false);
    assert.deepEqual(a.awards,[]);assert.deepEqual(a.issued,[]);
  }
 }finally{await p.close()}
});

test('six anonymous preview diplomas exist with formal issuance locked and clearly marked draft print controls, responsive for mobile and desktop',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1100}});
  try{
   await p.goto(h.base+'/heder.html');
   await p.locator('[data-honoree="oscar-lohne"]').waitFor();
   assert.equal(await p.locator('#serviceBadges img').count(),9);
   assert.deepEqual(await p.locator('#serviceBadges article h3').allTextContents(),
     ['Ivrig hjelper','Dugnadshelt','Trofast ildsjel','Bærebjelke','Fredet inventar','Morothon-legende','Morothons æresmerke','Grunnlegger','For alltid en del av Morothon']);
   const a=await p.evaluate(async()=>{
     const h=await MorothonHonorsData.load();
     return Promise.all(h.diplomaExamples.filter(x=>x.illustrative&&x.badgeId!=='thanks').map(async x=>{
       const d=await MorothonDiplomas.serviceExample(x.id);
       return {n:x.contributionCount,key:d.assetKey,ready:d.imageReady,preview:d.previewOnly,issued:!!d.award};
     }));
   });
   assert.deepEqual(a.map(m=>m.n),milestones);
   for(const d of a){assert.equal(d.key,'service-dugnad-'+d.n);assert.equal(d.ready,false);assert.equal(d.preview,true);assert.equal(d.issued,false)}
   await p.goto(h.base+'/heder.html#person/oscar-lohne');
   await p.locator('#profileName').waitFor();
   assert.equal(await p.locator('.honor-tenure-note').count(),0);
   assert.equal(await p.evaluate(async()=>{const d=await MorothonHonorsData.load();return MorothonHonorsData.tenureMilestones(d,MorothonHonorsData.findIn(d,'oscar-lohne').member).highestQualified.editions;}),30);
   assert.equal(await p.locator('.honor-secondary-badges img').count(),0);
   assert.match(await p.locator('.honor-historical-label').textContent(),/Grunnlegger fra 1992/);
   assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),2);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await p.close()}
 }
});

test('date field uses the race when the volunteer actually reached each milestone',async()=>{
 const page=await h.browser.newPage();
 try{
  await page.goto(h.base+'/heder.html');
  await page.locator('[data-honoree="oscar-lohne"]').waitFor();
  const result=await page.evaluate(async()=>{
   const [thirty,honor,erling,anonymous,notDocumented]=await Promise.all([
     MorothonDiplomas.serviceDraft('oscar-lohne','latest'),
     MorothonDiplomas.serviceDraft('oscar-lohne','service-aeresmerke'),
     MorothonDiplomas.serviceDraft('erling-askildsen','service-aeresmerke'),
     MorothonDiplomas.serviceExample('dugnad-30'),
     MorothonDiplomas.serviceDraft('kalle-kimestad','service-dugnad-10')
   ]);
   return [thirty,honor,erling,anonymous,notDocumented].map(d=>({
     year:d.achievementYear||null,eventDate:d.eventDate||null,label:d.dateLabel,
     basis:d.dateBasis,preview:d.previewOnly,ready:d.imageReady,
     htmlDate:new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html').querySelector('.diploma-date p').textContent,
     htmlLineCount:new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html').querySelectorAll('.diploma-date .diploma-signature-line').length
   }));
  });
  const [thirty,honor,erling,anonymous,unknown]=result;
  assert.deepEqual([thirty.year,thirty.eventDate,thirty.label],[2026,'2026-11-07','Søgne, 7. november 2026']);
  for(const entry of [honor,erling])assert.deepEqual([entry.year,entry.eventDate,entry.label],[2026,'2026-11-07','Søgne, 7. november 2026']);
  assert.deepEqual([anonymous.year,anonymous.eventDate,anonymous.label],[null,null,'']);
  assert.deepEqual([unknown.year,unknown.eventDate,unknown.label],[2023,'2023-11-11','Søgne, 11. november 2023']);
  for(const entry of result){
    assert.equal(entry.htmlDate.trim(),entry.label);
    assert.equal(entry.htmlLineCount,entry.label?1:0);
    assert.equal(entry.preview,true);assert.equal(entry.ready,false);
    assert.equal(entry.basis,entry.eventDate?'documented-race-date':'not-established');
    assert.doesNotMatch(entry.label,/utstedt|utskriftsdato|10\. november 2026/i);
  }
 }finally{await page.close()}
});
