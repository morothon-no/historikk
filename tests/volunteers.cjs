const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {mergeVolunteers}=require('../js/honors-data.js');
const {historicalMember}=require('./helpers/honors.cjs');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let h,core,list;
before(async()=>{
 core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 list=JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8'));
 h=await createHarness();
});
after(async()=>{await h?.close();});

test('V3.4 separate volunteer list preserves all 44 canonical identities and removes both uncertain start years',()=>{
 const combined=mergeVolunteers(core,list),members=combined.groups.flatMap(g=>g.members);
 assert.equal(list.people.filter(p=>p.id).length,31);
 assert.equal(list.people.filter(p=>p.profileId).length,2);
 assert.equal(members.length,44);assert.equal(new Set(members.map(m=>m.id)).size,44);
 assert.equal(combined.volunteerList,undefined);assert.equal(core.volunteerList,'data/volunteers.json');
 const old=JSON.parse(execFileSync('git',['show','92b892a:data/honors.json'],{cwd:root}));
 for(const m of old.groups.flatMap(g=>g.members)){
  const actual=historicalMember(require('./helpers/honors.cjs').beforeFinalCorrections(combined).groups.flatMap(g=>g.members).find(n=>n.id===m.id));assert.ok(actual,m.id);
  if(['anne-lene-forland-hansen','laila-endresen-skjulestad'].includes(m.id)){
   assert.equal(actual.contribution,undefined);assert.ok(actual.roles.every(r=>r.fromYear===undefined));
   assert.equal(actual.reason,null);
   assert.ok(actual.stories.every(s=>!s.text.match(/2014|2016/)));
   assert.deepEqual(actual.badgeProposal.badgeIds,[]);
  }else if(actual.listingOnly){assert.equal(actual.runnerId,undefined);assert.equal(actual.reason,null);assert.deepEqual(actual.stories,[]);assert.deepEqual(actual.badgeProposal.badgeIds,[]);}else if(['dag-morten-frantzen','hakon-lohne','oscar-lohne','erling-askildsen'].includes(m.id)){for(const key of ['id','name','status','runnerId','roles','awards','issuedDiplomas'])assert.deepEqual(actual[key],m[key],m.id+': '+key);if(!['oscar-lohne','erling-askildsen'].includes(m.id))assert.deepEqual(actual.badgeProposal,m.badgeProposal);for(const story of m.stories)assert.ok(actual.stories.some(s=>s.text===story.text.replaceAll('Bent Bakke','Bent-Inge Bakke')));}else if(m.id==='bent-bakke'){
    assert.equal(actual.name,'Bent-Inge Bakke');assert.ok(actual.aliases.includes('Bent Bakke'));
    assert.match(actual.reason,/2014–2019/);assert.equal(actual.contribution?.confirmedYears,undefined);
    const normalized={...actual,name:m.name,sourceIds:m.sourceIds,reason:m.reason,internalNotes:m.internalNotes};delete normalized.aliases;
    assert.deepEqual(normalized,m,'Existing organizer metadata unchanged except verified full name');
  }else assert.deepEqual(actual,m,m.id);
 }
 assert.match(combined.sources['organizer-v34-drikkestasjon-start'].basis,/Startåret er ikke avklart/);
});

test('V3.4 volunteer identities must reference existing profiles and never silently overwrite or merge them',()=>{
 const ref=mergeVolunteers(core,{schemaVersion:1,people:[{profileId:'oscar-lohne'}]});
 assert.equal(ref.groups.flatMap(g=>g.members).filter(m=>m.id==='oscar-lohne').length,1);
 assert.ok(ref.groups.find(g=>g.id==='volunteers').memberRefs.includes('oscar-lohne'));
 for(const people of [
  [{profileId:'kalle-kimestad'},{profileId:'karl-kimestad'}],
  [{profileId:'unknown'}],
  [{profileId:'kalle-kimestad',name:'Do not overwrite'}],
  [{id:'kalle-kimestad',name:'Do not overwrite'}],
  [{id:'karl-kimestad',name:'Do not invent another identity'}],
  [{id:'helge-andersen',name:'Do not revive a retired identity'}],
  [{id:'new-name',name:'One'},{id:'new-name',name:'Two'}]
 ])assert.throws(()=>mergeVolunteers(core,{...list,people}),/Duplisert|Ukjent/);
});

test('V3.4 ordinary names require sources, cannot add awards or runner IDs, and new sources cannot overwrite older ones',()=>{
 const entry={id:'new-name',name:'Testnavn',sourceIds:['new-source']};
 const source={title:'Kilde bare i test',publisher:'Test',basis:'Testfixture, ikke publisert.'};
 const combined=mergeVolunteers(core,{schemaVersion:1,sources:{'new-source':source},people:[entry]});
 const member=combined.groups.flatMap(g=>g.members).find(m=>m.id===entry.id);
 assert.deepEqual(combined.sources['new-source'],source);assert.deepEqual(member.awards,[]);
 assert.deepEqual(member.issuedDiplomas,[]);assert.deepEqual(member.badgeProposal.badgeIds,[]);
 assert.equal(member.runnerId,undefined);assert.equal(member.contribution,undefined);
 assert.deepEqual(member.roles,[]);
 assert.throws(()=>mergeVolunteers(core,{schemaVersion:1,people:[entry]}),/kilde/);
 assert.throws(()=>mergeVolunteers(core,{schemaVersion:1,people:[{...entry,sourceIds:['constructor']}]}),/kilde/);
 assert.throws(()=>mergeVolunteers(core,{schemaVersion:1,sources:{history:source},people:[]}),/finnes allerede/);
 for(const extra of [{runnerId:'MOR-0000000'},{awards:[]},{badgeProposal:{}},{fromYear:null},{fromYear:'2016'}]){
  assert.throws(()=>mergeVolunteers(core,{...list,people:[{...entry,sourceIds:['organizer-v34'],...extra}]}),/Ugyldig/);
 }
});

test('V3.4 Anne Lene and Laila have one working profile each and the newly confirmed start on mobile or desktop',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="anne-lene-forland-hansen"]').waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),43);
   for(const id of ['anne-lene-forland-hansen','laila-endresen-skjulestad']){
    const card=p.locator(`[data-honoree="${id}"]`);assert.equal(await card.count(),1);
    assert.match(await card.innerText(),/fra 2016/);
    assert.equal(await card.locator('a').count(),1);await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();
    assert.match(p.url(),new RegExp('#person/'+id+'$'));
    assert.match(await p.locator('#honorProfile').innerText(),/2016/);
    assert.doesNotMatch(await p.locator('#honorProfile').innerText(),/begynte samtidig|Historier og minner/);
    assert.equal(await p.locator('#honorProfile .honor-profile-medals img').count(),1);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await p.keyboard.press('Escape');await p.locator('#honorOverview').waitFor({state:'visible'});
   }
  }finally{await p.close();}
 }
});

test('V3.4 a new sourced volunteer is added through volunteers.json alone, while a founder reference stays a single featured profile',async()=>{
 const fixture=structuredClone(list);
 fixture.sources={...fixture.sources,'fixture-source':{title:'Kilde for testnavn',publisher:'Test',basis:'Ikke en faktisk person.'}};
 fixture.people.push({profileId:'oscar-lohne'},{id:'fixture-name',name:'Bare test <b>navn</b>',role:'Testrolle',sourceIds:['fixture-source']});
 const p=await h.browser.newPage({viewport:{width:390,height:1000}});
 try{
  await p.route('**/data/volunteers.json',r=>r.fulfill({json:fixture}));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="fixture-name"]').waitFor();
  assert.equal(await p.locator('[data-honoree]').count(),44); // 43 visible people plus the fixture.
  assert.equal(await p.locator('[data-honoree="oscar-lohne"]').count(),1);
  const card=p.locator('[data-honoree="fixture-name"]');
  assert.equal(await card.locator('strong').textContent(),'Bare test <b>navn</b>');assert.equal(await card.locator('b').count(),0);
  assert.equal(await card.locator('a').count(),1);await p.goto(h.base+'/heder.html#person/fixture-name');await p.locator('#profileName').waitFor();assert.equal(await p.locator('#profileName').textContent(),'Bare test <b>navn</b>');
  assert.equal(await p.locator('#honorProfile .runner-profile-link,#honorProfile iframe').count(),0);
  const result=await p.evaluate(async()=>{const d=await MorothonHonorsData.load();return {total:d.groups.flatMap(g=>g.members).length,source:d.sources['fixture-source'].title,member:(await MorothonHonorsData.find('fixture-name')).member};});
  assert.equal(result.total,45);assert.equal(result.source,'Kilde for testnavn');assert.deepEqual(result.member.badgeProposal.badgeIds,[]);
  const preserved=await p.evaluate(async()=> (await MorothonHonorsData.load()).sources);
  for(const [id,source]of Object.entries({...core.sources,...list.sources}))assert.deepEqual(preserved[id],source,id);
  assert.deepEqual(core,JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8')));
  assert.deepEqual(list,JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8')));
 }finally{await p.close();}
});

test('V3.4 a failed volunteer fetch shows a clear error, never a silently incomplete honor page',async()=>{
 const p=await h.browser.newPage();
 try{
  await p.route('**/data/volunteers.json',r=>r.fulfill({status:404,body:'Not found'}));
  await p.goto(h.base+'/heder.html');await p.waitForFunction(()=>document.querySelector('#honorStatus').textContent.includes('Dugnadslisten kunne ikke lastes'));
  assert.equal(await p.locator('[data-honoree]').count(),0);
  assert.equal(await p.locator('#honorProfile iframe,[data-honor-print],[data-honor-pdf]').count(),0);
  assert.equal(await p.evaluate(async()=>{try{await MorothonHonorsData.load();return '';}catch(e){return e.message;}}),'Dugnadslisten kunne ikke lastes.');
  await p.unroute('**/data/volunteers.json');
  assert.equal(await p.evaluate(async()=>{const d=await MorothonHonorsData.load();return d.groups.flatMap(g=>g.members).length;}),44);
  await p.reload();await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  assert.equal(await p.locator('[data-honoree]').count(),43);
  assert.doesNotMatch(await p.locator('#honorStatus').textContent(),/kunne ikke lastes/);
 }finally{await p.close();}
});

test('Nov 2026 organizer name additions stay unique, memorial honors Leif, and no award is inferred',()=>{
 const c=mergeVolunteers(core,list),all=c.groups.flatMap(g=>g.members);
 assert.equal(all.length,44);assert.equal(new Set(all.map(x=>x.id)).size,44);
 assert.equal(new Set(all.map(x=>x.name)).size,44);
 assert.equal(all.find(x=>x.id==='leif-wiig').deathYear,2023);
 assert.match(all.find(x=>x.id==='leif-wiig').roles[0].title,/Tidtaking/);
 for(const [id,name] of [['magne','Magne Lia'],['arnfinn-g','Arnfinn Grimestad'],['lars-aamodt','Lars Vassbotn Aamodt'],['bent-bakke','Bent-Inge Bakke']]){
   assert.equal(all.find(x=>x.id===id).name,name);
 }
 for(const id of ['georg-engenes','trine-danielsen','lene-holmen-berg','arvid-boro','margrete-tofte','joran-eriksen','preben-s-dahl']){
   const member=all.find(x=>x.id===id);assert.ok(member);assert.equal(member.listingOnly,true);
   assert.deepEqual(member.badgeProposal.badgeIds,[]);assert.equal(member.contribution,undefined);
 }
 assert.equal(all.find(x=>x.id==='leif-wiig').badgeProposal.primaryBadgeId,'service-memorial');
 assert.equal(all.find(x=>x.id==='aud-o').name,'Aud Ovesen');assert.equal(all.find(x=>x.id==='aud-o').contribution,undefined);
 assert.ok(all.every(x=>x.awards.length===0&&x.issuedDiplomas.length===0));
});

test('Arrangørens nye dugnadsstartår og Atles fravær i 2026 gir ingen bekreftet årsrekke eller formell tildeling',()=>{
 const c=mergeVolunteers(core,list),people=c.groups.flatMap(g=>g.members);
 for(const [id,year] of [['birgitte-aamodt',2022],['johannes-aamodt',2021],['atle-aamodt',2021]]){
   const m=people.find(person=>person.id===id);
   assert.equal(m.contribution.fromYear,year);
   assert.equal(m.contribution.confirmedYears,undefined);
   assert.equal(m.badgeProposal.primaryBadgeId,null);
   assert.deepEqual(m.badgeProposal.badgeIds,[]);
 }
 assert.match(people.find(m=>m.id==='atle-aamodt').internalNotes.join(' '),/ikke bidro på dugnad i 2026/);
});
