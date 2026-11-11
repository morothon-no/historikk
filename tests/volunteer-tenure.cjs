const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let data,list,history,h,years;
const expected=[['jon-fjeld',13,10],['rune-bergjord',12,10],['per-sangvik',8,5],['tom-lohne',6,5],['birgitte-aamodt',5,5],['johannes-aamodt',6,5],['atle-aamodt',5,5]];
before(async()=>{data=await readHonors();list=JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8'));history=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8'));years=[...new Set(history.results.map(r=>r[0]))];h=await createHarness();});
after(async()=>{await h?.close();});
const person=id=>H.findIn(data,id).member;
const member=c=>({id:'test',name:'Test',contribution:{...c,sourceIds:['organizer-v34']},roles:[],badgeProposal:{badgeIds:[]},awards:[],issuedDiplomas:[]});

test('provisional tenure: seven real people use actual editions and Atle’s single documented absence, without mutating data',()=>{
 const original=JSON.stringify(data);
 for(const [id,count,tier]of expected){
  const p=person(id),r=H.provisionalMilestone(data,p,years);
  assert.equal(r.basis,'registered-period');assert.equal(r.asOfYear,2026);assert.equal(r.count,count,id);assert.equal(r.highest.badgeId,'service-dugnad-'+tier);
  assert.equal(H.contribution(p).count,0);assert.equal(H.contribution(p).eligible,false);assert.equal(r.automaticallyAwarded,false);
  assert.deepEqual(p.badgeProposal.badgeIds,[]);assert.deepEqual(p.awards,[]);assert.deepEqual(p.issuedDiplomas,[]);
 }
 assert.deepEqual(person('atle-aamodt').contribution.excludedYears,[2026]);assert.equal(JSON.stringify(data),original);
 for(const id of ['anne-lene-forland-hansen','laila-endresen-skjulestad','christan-berthelsen','lars-aamodt'])assert.equal(H.provisionalMilestone(data,person(id),years).highest,null,id);
});

test('provisional tenure: end years, non-arranged gaps, exclusions, missing/future starts and changing policy are respected',()=>{
 const cases=[
  [{fromYear:2014,toYear:2019},6,5],
  [{fromYear:2021,toYear:2024},4,null],
  [{fromYear:2021,excludedYears:[2020,2026,2028]},5,5],
  [{fromYear:2030},0,null],[{toYear:2026},null,null],[{},null,null],
 ];
 for(const [c,count,tier]of cases){const r=H.provisionalMilestone(data,member(c),years);assert.equal(r.count,count);assert.equal(r.highest?.editions??null,tier);}
 assert.equal(H.provisionalMilestone(data,member({fromYear:2020}),[2020,2020,2022]).count,2);
 assert.equal(H.provisionalMilestone(data,member({fromYear:2014}),[]).count,null);
 const policy={awardPolicy:{milestones:[{badgeId:'service-dugnad-5',minimumDocumentedEditions:7}]}};
 assert.equal(H.provisionalMilestone(policy,member({fromYear:2021}),years).highest,null,'Thresholds come from policy, not constants');
 for(const n of [5,10,15,20,30,40]){
  const editions=Array.from({length:n},(_,i)=>1987+i);assert.equal(H.provisionalMilestone(data,member({fromYear:1987}),editions).highest.editions,n);
 }
});

test('documented years stay sparse and independent of estimates, personal proposals and formal awards',()=>{
 const p=member({fromYear:2014,confirmedYears:[2024,2014,2021,2016,2022]});
 const r=H.provisionalMilestone(data,p,years);assert.equal(r.basis,'documented');assert.equal(r.count,5);assert.equal(r.highest.editions,5);
 assert.equal(H.startYear(member({confirmedYears:[2019,2014]})),2014);
 for(const id of ['oscar-lohne','erling-askildsen']){
  const p=person(id),before=JSON.stringify(p);assert.equal(H.provisionalMilestone(data,p,years).count,35);assert.equal(H.provisionalMilestone(data,p,years).highest.editions,30);
  assert.equal(p.badgeProposal.primaryBadgeId,'service-aeresmerke');assert.equal(JSON.stringify(p),before);
 }
 const future=H.provisionalMilestone(data,member({confirmedYears:[2027]}),years);assert.equal(future.count,0);assert.equal(future.highest,null);
});

test('volunteer sorting uses registered start or earliest documented year and Norwegian Æ/Ø/Å order without mutation',()=>{
 const rows=[{id:'unknown-aa',name:'Åse'},{id:'unknown-ae',name:'Ægir'},
  {...member({fromYear:2021}),id:'b',name:'Øyvind'},
  {...member({confirmedYears:[2022,2020]}),id:'c',name:'Cecilie'},
  {...member({fromYear:2021}),id:'a',name:'Ærlig'},
  {id:'old',name:'Rune',roles:[{confirmed:true,fromYear:2014}]},
  {...member({fromYear:2021}),id:'d',name:'Åge'},
  {id:'unknown-a',name:'Anders'}];
 const before=JSON.stringify(rows);assert.deepEqual(H.sortVolunteers(rows).map(m=>m.id),['old','c','a','b','d','unknown-a','unknown-ae','unknown-aa']);assert.equal(JSON.stringify(rows),before);
});

test('optional tenure fields validate sources, bounds, lists and conflicting years in both ordinary and full profiles',async()=>{
 const core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 const entry={id:'fixture',name:'Test',sourceIds:['organizer-v34'],fromYear:2014,toYear:2021,excludedYears:[2016],confirmedYears:[2014,2017]};
 const merged=H.mergeVolunteers(core,{schemaVersion:1,people:[entry]}),actual=H.findIn(merged,'fixture').member;
 assert.deepEqual(actual.contribution,{sourceIds:entry.sourceIds,fromYear:2014,toYear:2021,excludedYears:[2016],confirmedYears:[2014,2017]});
 assert.equal(H.contribution(actual).count,2);assert.equal(H.provisionalMilestone(data,actual,years).count,2);
 for(const patch of [{toYear:2013},{toYear:'2026'},{excludedYears:[2026,2026]},{excludedYears:[null]},{excludedYears:'2026'},{confirmedYears:[2014,2014]},{excludedYears:[2014]},{confirmedYears:[2022]}])assert.throws(()=>H.mergeVolunteers(core,{schemaVersion:1,people:[{...entry,...patch}]}),/Ugyldig|Motstridende/);
 assert.throws(()=>H.mergeVolunteers(core,{schemaVersion:1,people:[{...entry,sourceIds:['unknown']}]}),/kilde/);
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  for(const patch of [{toYear:1991},{excludedYears:[1992]},{excludedYears:['2026']}]){
   const error=await p.evaluate(async patch=>{const d=structuredClone(await MorothonHonorsData.load());Object.assign(d.groups[0].members[0].contribution,patch);try{MorothonHonorsData.validate(d);return '';}catch(e){return e.message;}},patch);assert.match(error,/Ugyldig|Motstridende/);
  }
 }finally{await p.close();}
});

test('cards display only provisional SVGs, preserve other groups and stay compact on mobile/PC with print gates unchanged',async()=>{
 for(const width of [320,390,768,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(await p.locator('[data-main-badge^="service-dugnad-"]').count(),12);
   const order=await p.locator('#volunteers [data-honoree]').evaluateAll(es=>es.map(e=>e.dataset.honoree));
   const expectedOrder=H.sortVolunteers(H.membersFor(data,data.groups.find(g=>g.id==='volunteers')).filter(m=>!['dag-morten-frantzen','hakon-lohne'].includes(m.id))).map(m=>m.id);assert.deepEqual(order,expectedOrder);
   assert.deepEqual(await p.locator('#honorFeatured [data-honoree]').evaluateAll(es=>es.map(e=>e.dataset.honoree)),['oscar-lohne','erling-askildsen','einar-danielsen','arnfinn-haverstad','helge-reisvoll']);
   assert.deepEqual(await p.locator('#memorial [data-honoree]').evaluateAll(es=>es.map(e=>e.dataset.honoree)),data.groups.find(g=>g.id==='memorial').members.map(m=>m.id));
   for(const [id,count,tier]of expected){
    const card=p.locator(`[data-honoree="${id}"]`);assert.doesNotMatch(await card.innerText(),/Foreløpig|fravær fratrukket/);assert.equal(await card.locator('img').getAttribute('src'),h.base+'/assets/medals/service/dugnad-'+tier+'.svg');
    assert.match(await card.locator('.honor-main-caption').textContent(),new RegExp(count+' dugnadsutgaver'));assert.equal(await card.locator('.honor-main-caption').getAttribute('data-basis'),'registered-period');
   }
   assert.doesNotMatch(await p.locator('[data-honoree="atle-aamodt"]').innerText(),/kjente fravær fratrukket/);
   for(const id of ['kalle-kimestad','finn-lohne','oscar-lohne','erling-askildsen'])assert.equal(await p.locator(`[data-honoree="${id}"] img`).count(),1);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
   const gated=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('jon-fjeld');return d.previewOnly&&!d.gratitude&&d.contributionCount===13&&d.printMode==='presentation';});assert.equal(gated,true);
   await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('Diplomet er kontrollert'));assert.equal(await p.locator('[data-honor-print],[data-honor-pdf],[data-diploma-print],[data-diploma-pdf]').count(),2);
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));assert.equal(await p.locator('a[href*="heder.html"]').count(),0);assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});

test('new arranged years update estimates automatically; a future calendar row or a failed history load cannot invent editions',async()=>{
 for(const mode of ['calendar','registered','dns','future','missing']){
  const p=await h.browser.newPage();try{
   const fixture=structuredClone(history);fixture.yearStats.push([2028,0,0,0,0,0,0,0,0,0]);
   if(mode==='future'){const row=fixture.results.find(r=>r[0]===2026&&r[4]==='Fullført');fixture.results.push([2027,...row.slice(1)]);}
   if(['registered','dns'].includes(mode)){const row=fixture.results.find(r=>r[0]===2026);fixture.results.push([2028,...row.slice(1)]);fixture.results.at(-1)[4]=mode==='dns'?'DNS':'Påmeldt';}
   await p.route('**/data/history.json',r=>r.fulfill(mode==='missing'?{status:503,body:'Unavailable'}:{json:fixture}));
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
   const result=await p.evaluate(async()=>{const d=await MorothonHonorsData.load(),m=MorothonHonorsData.findIn(d,'atle-aamodt').member;let years=[];try{const h=await MorothonHistoryData.load();years=[...new Set(h.data.results.filter(r=>MorothonHistoryData.isCompletedResult(r)||['DNF','Deltatt'].includes(MorothonHistoryData.effectiveStatus(r))).map(r=>r[0]))];}catch{}return MorothonHonorsData.provisionalMilestone(d,m,years);});
   assert.equal(result.asOfYear,mode==='future'?2027:mode==='missing'?null:2026);assert.equal(result.count,mode==='future'?6:mode==='missing'?null:5);
   if(mode==='missing'){assert.equal(await p.locator('[data-main-badge^="service-dugnad-"]').count(),12);assert.match(await p.locator('#honorStatus').innerText(),/Løpshistorikken er ikke tilgjengelig/);}
  }finally{await p.close();}
 }
});

test('tenure extension changes only the authorized volunteer absence, never identities, history, official images or diploma code',async()=>{
 const base='0d11b368b6ea2866613816903fe41d34e7bac4b1';
 await require('./helpers/honors.cjs').assertOrdinaryDiplomaCss(root);
 for(const dir of ['data/history.json','data/event-dates.json','assets','index.html']){
  const files=execFileSync('git',['ls-tree','-r','--name-only',base,dir],{cwd:root}).toString().trim().split('\n');
  for(const file of files)assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show',base+':'+file],{cwd:root}),file);
 }
 const original=JSON.parse(execFileSync('git',['show',base+':data/volunteers.json'],{cwd:root}));original.people.find(m=>m.id==='atle-aamodt').excludedYears=[2026];const n=original.people.find(p=>p.id==='nils-martin-otterdal-nilsen');Object.assign(n,{role:'Styreleder i Søgne Skiklubb',roleType:'external',sourceIds:['organizer-v34','organizer-v35']});assert.deepEqual(list,original);
});
