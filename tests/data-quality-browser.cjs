const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const R=require('../js/history-data.js');
const {buildSite}=require('../scripts/build-site.cjs');
const {manifestFor,approvalFor}=require('../scripts/lib/public-package.cjs');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');
const row=(year=2026,status='Fullført',time='1:20:30',id='runner',event='Morothon')=>[year,id,event,'20 km',status,time,1,'','',''];
const fixture=results=>({schemaVersion:1,people:[{i:'runner',n:'Testløper',g:'Herre'}],results,yearStats:[[2025,1],[2026,1]],aliases:{},redirects:{}});

let h,out;
before(async()=>{out=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-a2-browser-'));await buildSite(out);h=await createHarness({rootDir:out});});
after(async()=>{await h?.close();if(out)await fs.rm(out,{recursive:true,force:true});});
test('A2 organizer-retained completion keeps all participations, completions and distance on mobile/PC, preserving current milestones and records',async()=>{
 const p=await h.browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  const numbers=await p.evaluate(()=>{
   const row=resultsFor('MOR-B1AC0FD').find(r=>r[0]===2007),total=runnerTotals(row[1]);
   const withOldStatus=resultsFor(row[1]).filter(r=>r[4]==='Fullført'&&effectiveStatus(r)!=='DNF');
   const oldKm=withOldStatus.reduce((sum,r)=>sum+parseDistanceKm(r[3]),0);
   const m=MorothonMilestones.calculate(2026),history=MorothonHistoryData.create(S.data);
   return {status:effectiveStatus(row),classPlace:classPlacement(row),completed:total.completed,km:total.km,oldKm,
    count:person(row[1]).c,sharedCount:history.stats(row[1]).count,starts:S.results.filter(countsAsParticipation).length,
    milestones:[m.participants.length,m.debutants.length,m.awardCount],perfect:S.people.filter(frontPagePerfectAttendance).length,
    records:S.courseRecords.map(r=>[r.name,r.time,r.year]),loyalty:loyalty(person(row[1])).count};
  });
  assert.equal(numbers.status,'Fullført');assert.equal(numbers.classPlace,null);assert.equal(numbers.oldKm,numbers.km);assert.equal(numbers.km,104);assert.equal(numbers.completed,8);assert.equal(numbers.count,8);
  assert.equal(numbers.count,numbers.sharedCount);assert.equal(numbers.count,numbers.loyalty);assert.equal(numbers.starts,6698);
  assert.deepEqual(numbers.milestones,[398,195,22]);assert.equal(numbers.perfect,33);
  assert.deepEqual(numbers.records,[['Lars Aasheim Svaland','1:31:24',2026],['Ingrid Ukkelberg','1:54:00',2023],['Simen Koland','47:20',2024],['Marianne Andersen','56:37',2025]]);
  for(const width of [390,1440]){
   await p.setViewportSize({width,height:950});await p.evaluate(()=>openProfile('MOR-B1AC0FD'));
   assert.match(await p.locator('#profile .result-row').filter({hasText:'2007'}).textContent(),/Fullført/);
   assert.equal(await p.evaluate(()=>document.querySelector('#panel').scrollWidth<=document.querySelector('#panel').clientWidth+1),true);
   await p.evaluate(()=>closeProfile());
   // Use the real year renderer; the result remains visible, never ranked as completed.
   await p.evaluate(()=>{document.querySelector('#yearDisclosure').open=true;document.querySelector('#yearSelect').value='2007';S.yearRaceMode='other';S.yearOtherKey='Kortmoro|14 km';S.yearLimit=10000;yearView();});
   const r=p.locator('.year-result-row').filter({has:p.locator('button[onclick*="MOR-B1AC0FD"]')});
   assert.equal(await r.count(),1);assert.match(await r.textContent(),/Fullført/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
