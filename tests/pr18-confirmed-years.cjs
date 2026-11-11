const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),baseline='8e28dd6',source='organizer-pr18-confirmed-years';let data,years,h;
const person=id=>H.findIn(data,id).member;
before(async()=>{data=await readHonors();years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);h=await createHarness();});
after(async()=>{await h?.close();});

test('PR18 documented volunteer years are exact, never padded into future editions, with main badges and historical records preserved',async()=>{
 const cases=[['dag-morten-frantzen',13,[]],['hakon-lohne',12,[2016]]];
 for(const [id,count,excluded]of cases){
  const m=person(id),expected=Array.from({length:13},(_,i)=>2014+i).filter(y=>!excluded.includes(y));
  assert.deepEqual(m.contribution.confirmedYears,expected);assert.deepEqual(m.contribution.excludedYears||[],excluded);
  assert.ok(m.contribution.sourceIds.includes(source));assert.equal(H.contribution(m).count,count);
  for(const editions of [years,[...years,2027]]){const result=H.mainBadge(data,m,editions);assert.equal(result.count,count);assert.equal(result.basis,'documented');assert.equal(result.badgeId,'service-dugnad-10');}
 }
 assert.equal(data.groups.flatMap(g=>g.members).length,44);
 for(const m of data.groups.flatMap(g=>g.members)){
  assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
  assert.equal(m.roles.filter(r=>r.sourceIds?.includes(source)).length,['dag-morten-frantzen','erling-askildsen'].includes(m.id)?1:0,m.id);
  assert.equal(!!m.contribution?.sourceIds?.includes(source),cases.some(([id])=>id===m.id),m.id);
 }
 for(const id of ['oscar-lohne','erling-askildsen']){assert.equal(H.contribution(person(id)).count,35);assert.equal(H.mainBadge(data,person(id),years).badgeId,'service-aeresmerke');}
 // Use a merged-main baseline so this remains valid after squash/deleting the PR branch.
 // The existing V3.5 preservation tests also cover all original assets and historical facts.
 for(const file of ['data/history.json','data/event-dates.json'])assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show',baseline+':'+file],{cwd:root}),file);
 assert.deepEqual(data.diplomaApprovals,[]);
});

test('PR18 undated chair roles remain visible supplementary roles and cannot change tenure or sort order',async()=>{
 for(const id of ['dag-morten-frantzen','erling-askildsen']){
  const m=person(id),role=m.roles.find(r=>r.sourceIds?.includes(source));
  assert.equal(role.title,'Tidligere styreleder i Søgne Skiklubb');assert.equal(role.confirmed,true);assert.equal(role.countsForTenure,false);
  assert.equal(role.fromYear,undefined);assert.equal(role.toYear,undefined);
  const earlier=structuredClone(m);earlier.roles.find(r=>r.sourceIds?.includes(source)).fromYear=1900;
  assert.equal(H.startYear(earlier),H.startYear(m));assert.deepEqual(H.contribution(earlier),H.contribution(m));
  assert.deepEqual(H.mainBadge(data,earlier,years),H.mainBadge(data,m,years));
  const without=structuredClone(m);without.roles=without.roles.filter(r=>!r.sourceIds?.includes(source));
  const peers=data.groups.flatMap(g=>g.members).filter(p=>p.id!==id);
  assert.deepEqual(H.sortVolunteers([...peers,earlier]).map(p=>p.id),H.sortVolunteers([...peers,without]).map(p=>p.id));
 }
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   for(const id of ['dag-morten-frantzen','erling-askildsen']){
    await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();
    assert.equal(await p.locator('.profile-additional-role').innerText(),'Tidligere styreleder i Søgne Skiklubb');
    assert.equal(await p.locator('.profile-role').innerText(),person(id).roles[0].title);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="hakon-lohne"]').waitFor();
   for(const [id,count]of [['dag-morten-frantzen',13],['hakon-lohne',12]])assert.match(await p.locator(`[data-honoree="${id}"]`).innerText(),new RegExp(count+' dokumenterte'));
   const models=await p.evaluate(async()=>Promise.all(['dag-morten-frantzen','hakon-lohne'].map(async id=>{
    const d=await MorothonDiplomas.serviceDraft(id);return {id,count:d.contributionCount,year:d.achievementYear,estimated:d.estimated,date:d.eventDate};
   })));
   assert.deepEqual(models.map(m=>[m.id,m.count,m.year,m.date]),[['dag-morten-frantzen',10,2023,'2023-11-11'],['hakon-lohne',10,2024,'2024-11-09']]);
   assert.ok(models.every(m=>!m.estimated));assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
