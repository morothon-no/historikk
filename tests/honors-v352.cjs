const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{expectedPrintMode,readHonors,assertOrdinaryDiplomaCss}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let data,h;const cases={'oscar-lohne':35,'erling-askildsen':35,'einar-danielsen':33,'dag-morten-frantzen':13,'hakon-lohne':12,'finn-lohne':13,'kalle-kimestad':13,'bent-bakke':6,'atle-aamodt':5,'birgitte-aamodt':5,'johannes-aamodt':6};
before(async()=>{data=await readHonors();h=await createHarness();});after(async()=>{await h?.close();});
const member=id=>H.findIn(data,id).member;
test('V3.5.2 one registered-tenure calculation drives counts, all six cumulative thresholds, main honors and every diploma choice',()=>{
 const before=JSON.stringify(data);
 for(const [id,count]of Object.entries(cases)){
  const m=member(id),s=H.honorProfile(data,m),choices=H.diplomaChoices(data,m);
  assert.equal(s.tenure.count,count,id);assert.equal(s.main.count,count,id);
  assert.deepEqual(s.earnedBadgeIds,data.awardPolicy.milestones.filter(t=>t.minimumDocumentedEditions<=count).map(t=>t.badgeId),id);
  assert.equal(choices[0],s.main.badgeId);for(const id of choices)assert.equal(H.canPresent(data,m,id),true);
  assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
 }
 const e=member('einar-danielsen');assert.equal(e.contribution.approvedTotal.editions,33);assert.equal(e.contribution.confirmedYears,undefined);assert.deepEqual(H.serviceTenure(data,e).years,[]);assert.ok(Object.values(H.serviceTenure(data,e).milestoneYears).every(y=>y===null));
 for(const id of ['oscar-lohne','erling-askildsen','einar-danielsen']){const s=H.honorProfile(data,member(id));assert.equal(s.main.badgeId,'service-aeresmerke');assert.deepEqual(s.secondaryHonorIds,id==='einar-danielsen'?['service-grunnlegger','service-memorial']:['service-grunnlegger']);assert.equal(s.collectionIds.length,5);}
 for(const id of ['arnfinn-haverstad','helge-reisvoll']){const s=H.honorProfile(data,member(id));assert.equal(s.main.badgeId,'service-grunnlegger');assert.equal(s.tenure.count,null);assert.deepEqual(s.secondaryHonorIds,[]);}
 const erling=H.honorProfile(data,member('erling-danielsen'));assert.equal(erling.main.badgeId,'service-dugnad-30');assert.equal(H.isFounder(data,member('erling-danielsen')),false);assert.equal(erling.tenure.count,33);assert.equal(erling.tenure.fromYear,1992);assert.equal(erling.earnedBadgeIds.length,5);
 assert.equal(JSON.stringify(data),before);
});
test('V3.5.2 source priority, known absences, missing/end/future years and aggregate totals never invent annual records',()=>{
 const m=c=>({id:'fixture',name:'Test',roles:[{confirmed:true,fromYear:1900,countsForTenure:false}],contribution:{...c,sourceIds:['organizer-v352']}}),years=data.editionYears;
 const calc=(c,ys=years)=>H.serviceTenure(data,m(c),ys);
 assert.equal(calc({fromYear:2014,toYear:2019}).count,6);assert.equal(calc({fromYear:2021,excludedYears:[2026]}).count,5);
 assert.equal(calc({fromYear:2014,confirmedYears:[2014,2016,2026],approvedTotal:{approved:true,editions:33,sourceIds:['organizer-v352']}}).count,3);
 assert.equal(calc({fromYear:2014,confirmedYears:[]}).count,0);
 assert.equal(calc({}).count,null);assert.equal(calc({fromYear:2030}).count,0);assert.equal(calc({fromYear:2021},[2021,2023,2023,2026]).count,3);
 assert.equal(calc({fromYear:2014},[...years,2027]).count,14);
 const approved={approvedTotal:{approved:true,editions:33,asOfYear:2026,sourceIds:['organizer-v352']}};assert.equal(calc(approved,[...years,2027]).count,33);assert.deepEqual(calc(approved).years,[]);
 for(const n of [5,10,15,20,30,40])assert.equal(calc({fromYear:1992},Array.from({length:n},(_,i)=>1992+i)).highest.editions,n);
 assert.equal(calc({fromYear:2021,excludedYears:[2026]}).milestoneYears[5],2025);
 assert.equal(H.serviceTenure(data,member('hakon-lohne')).milestoneYears[10],2024);
});
test('V3.5.2 memorials never extend an unknown end year; explicit years, end years and approved totals remain authoritative',()=>{
 const original=require('./helpers/honors.cjs').priorCorrectionMember(member('erling-danielsen')),before=JSON.stringify(original),years=data.editionYears;
 for(const context of [years,[...years,2027]]){
  const tenure=H.serviceTenure(data,original,context);
  assert.equal(tenure.count,null);assert.equal(tenure.fromYear,1992);assert.equal(tenure.toYear,null);assert.deepEqual(tenure.years,[]);assert.equal(tenure.highest,null);
  assert.deepEqual(H.diplomaChoices(data,original,context),['service-memorial']);assert.equal(H.canPresent(data,original,'service-dugnad-30',context),false);
 }
 for(const marker of [{deceased:true},{memorialRecognition:{badgeId:'service-memorial'}}]){
  const fixture={id:'memorial-fixture',...marker,deathYear:2023,contribution:{fromYear:2014,sourceIds:['organizer-v352']}};
  assert.equal(H.serviceTenure(data,fixture).count,null,'A death year is not a documented service end year');
  assert.equal(H.serviceTenure(data,{...fixture,contribution:{...fixture.contribution,toYear:2019}}).count,6);
  assert.equal(H.serviceTenure(data,{...fixture,contribution:{...fixture.contribution,confirmedYears:[2014,2017]}}).count,2);
  assert.equal(H.serviceTenure(data,{...fixture,contribution:{...fixture.contribution,approvedTotal:{approved:true,editions:13,sourceIds:['organizer-v352']}}}).count,13);
 }
 const grouped={...original};delete grouped.deceased;delete grouped.memorialRecognition;
 const historic=require('./helpers/honors.cjs').beforeFinalCorrections(data);assert.equal(H.serviceTenure(historic,grouped).count,null,'The memorial section also identifies a memorial profile');
 assert.equal(H.honorProfile(data,member('einar-danielsen')).tenure.count,33);assert.equal(JSON.stringify(original),before);assert.equal(original.contribution.toYear,undefined);
});
test('V3.5.2 archived unknown-end memorial fixture preserves 1992 without an invented total or later annual medals',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});try{
   const fixture=require('./helpers/honors.cjs').beforeFinalCorrections(await readHonors());fixture.presentationPrintSet.entries.push(...fixture.presentationPrintSet.pendingReviews.flatMap(r=>r.previousEntries));delete fixture.presentationPrintSet.pendingReviews;await p.route('**/data/honors.json',r=>r.fulfill({json:fixture}));await p.route('**/data/volunteers.json',async r=>{const v=JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8'));for(const e of data.revisionHistory[0].volunteers)v.people[v.people.findIndex(p=>p.id===e.id)]=e;return r.fulfill({json:v});});await p.goto(h.base+'/heder.html');const card=p.locator('[data-honoree="erling-danielsen"]');await card.waitFor();
   assert.match(await card.innerText(),/fra 1992/);assert.doesNotMatch(await card.innerText(),/35|2026|33/);
   await card.locator('a').click();await p.waitForFunction(()=>document.querySelector('#profileName')?.textContent==='Erling Danielsen');
   assert.match(await p.locator('.honor-profile-header').innerText(),/fra 1992/);assert.doesNotMatch(await p.locator('.honor-profile-header').innerText(),/35|2026|33/);
   assert.equal(await p.locator('.honor-earned-marks img,.honor-historic-marks img').count(),0);
   await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
   const d=await p.evaluate(()=>MorothonDiplomas.serviceDraft('erling-danielsen'));
   assert.equal(d.contributionCount,null);assert.equal(d.achievementYear,null);assert.equal(d.assetKey,'service-memorial');assert.equal(d.printMode,'presentation');assert.deepEqual(d.secondaryAssets,[]);
   const q=await h.browser.newPage();try{
    await q.setContent(await p.locator('iframe').getAttribute('srcdoc'));await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
    assert.match(execFileSync('pdfinfo',['-'],{input:pdf}).toString(),/Pages:\s+1\b/);
    const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString();assert.match(text,/Erling Danielsen/);assert.match(text,/MINNEDIPLOM/);assert.doesNotMatch(text,/35|33|2026|1992–2026|FORHÅNDSVISNING|UTKAST/);
   }finally{await q.close();}
   assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await p.close();}
 }
});
test('V3.5.2 mobile/PC profiles and clean A4 diplomas show every earned image once, including all three complete founder honors',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   for(const [id,count]of Object.entries(cases)){
    await p.goto(h.base+'/heder.html#person/'+id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,member(id).name);
    const state=H.honorProfile(data,member(id));assert.match(await p.locator('#honorProfile .honor-main-caption').first().innerText(),new RegExp(count+' dugnadsutgaver'));
    assert.equal(await p.locator('.honor-earned-marks img').count(),state.collectionIds.length);assert.equal(await p.locator('.honor-historic-marks img').count(),state.secondaryHonorIds.length);
    const urls=await p.locator('#honorProfile img').evaluateAll(es=>es.map(e=>e.src));assert.equal(new Set(urls).size,urls.length,id);
    await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
    const result=await p.evaluate(async id=>{const d=await MorothonDiplomas.serviceDraft(id),doc=document.querySelector('iframe').contentDocument;return {count:d.contributionCount,main:d.assetKey,extra:d.secondaryAssets.map(a=>a.key),year:d.achievementYear,mode:d.printMode,layout:await MorothonDiplomas.checkLayout(doc),text:doc.body.textContent,images:[...doc.querySelectorAll('img:not(.diploma-watermark)')].map(e=>e.src)};},id);
    const t=state.tenure;assert.equal(result.count,state.main.editions&&t.milestoneYears[state.main.editions]?state.main.editions:count);assert.equal(result.main,state.main.badgeId);assert.equal(result.mode,expectedPrintMode(data,id));assert.equal(result.layout.ready,true,result.layout.failures.join(' '));
    assert.deepEqual(result.extra,[...state.secondaryHonorIds,...state.collectionIds]);assert.equal(new Set(result.images).size,result.images.length);if(expectedPrintMode(data,id)==='draft')assert.match(result.text,/FORHÅNDSVISNING/);else assert.doesNotMatch(result.text,/UTKAST|FORHÅNDSVISNING|MULIGE|anslag/i);
    if(id==='einar-danielsen')assert.equal(result.year,null);
    assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('V3.5.2 real missing, swapped, hidden or overlapping secondary medals and founder marks block printing',async()=>{
 for(const fault of ['missing','swapped','hidden','overlap','founder']){
  const p=await h.browser.newPage();try{
   await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
   const result=await p.evaluate(async fault=>{const doc=document.querySelector('iframe').contentDocument,e=doc.querySelector('.diploma-service-collection img');if(fault==='missing')e.remove();if(fault==='swapped')e.src=doc.querySelector('.diploma-medal').src;if(fault==='hidden')e.style.visibility='hidden';if(fault==='overlap')e.style.transform='translateX(20mm)';if(fault==='founder')doc.querySelector('.diploma-service-founder').style.top='90mm';return MorothonDiplomas.checkServiceDraft(await MorothonDiplomas.serviceDraft('oscar-lohne'),doc);},fault);
   assert.equal(result.ready,false,fault);assert.ok(result.failures.length,fault);
  }finally{await p.close();}
 }
});
test('V3.5.2 protects historical race data, ordinary runner diploma styling and official medal originals while keeping all 44 identities',async()=>{
 const old=JSON.parse(execFileSync('git',['show','52ead66:data/honors.json'],{cwd:root}));assert.equal(data.groups.flatMap(g=>g.members).length,44);
 for(const m of old.groups.flatMap(g=>g.members)){const now=require('./helpers/honors.cjs').priorCorrectionMember(member(m.id));for(const key of ['id','name','runnerId','roles','stories','awards','issuedDiplomas','plannedHonors'])assert.deepEqual(now[key],m[key],m.id+': '+key);}
 for(const folder of ['data/history.json','data/badges.json','data/volunteers.json','data/event-dates.json','assets','index.html','js/brag-card.js'])for(const file of execFileSync('git',['ls-tree','-r','--name-only','52ead66',folder],{cwd:root}).toString().trim().split('\n'))require('./helpers/honors.cjs').assertPreservedPresentation(await require('./helpers/honors.cjs').preservedFile(root,file),execFileSync('git',['show','52ead66:'+file],{cwd:root}),file);
 await assertOrdinaryDiplomaCss(root);assert.deepEqual(data.diplomaApprovals,[]);
});
