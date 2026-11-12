const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{expectedPrintMode,readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let h,data,years;
before(async()=>{data=await readHonors();years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);h=await createHarness();});
after(async()=>{await h?.close();});
const member=id=>H.findIn(data,id).member;
test('V3.5.1 planned founder honor never fabricates tenure, an award date or an issued diploma; original facts survive',async()=>{
 const einar=member('einar-danielsen'),main=H.mainBadge(data,einar,years);
 assert.equal(main.badgeId,'service-aeresmerke');assert.equal(main.count,33);assert.equal(main.basis,'approved-total');
 assert.equal(H.provisionalMilestone(data,einar,years).count,33);assert.equal(einar.contribution.approvedTotal.editions,33);assert.equal(H.contribution(einar).count,0);assert.equal(einar.roles[0].title,'Grunnlegger');
 assert.deepEqual(einar.plannedHonors,[{badgeId:'service-aeresmerke',year:2026,status:'planned',sourceIds:['organizer-v351']}]);
 assert.deepEqual(data.featuredIds,['oscar-lohne','erling-askildsen']);assert.deepEqual(data.founderSpotlightIds,['einar-danielsen']);
 const old=JSON.parse(execFileSync('git',['show','41f5e45:data/honors.json'],{cwd:root}));
 for(const m of old.groups.flatMap(g=>g.members)){
  const now=require('./helpers/honors.cjs').priorCorrectionMember(member(m.id));for(const key of ['id','name','runnerId','aliases','aliasIds','contribution','roles','stories','awards','issuedDiplomas']){
   if(m.id==='hakon-lohne'&&key==='roles'||m.id==='einar-danielsen'&&key==='contribution')continue;assert.deepEqual(now[key],m[key],m.id+': '+key);
  }
  if(m.id!=='einar-danielsen')assert.deepEqual(now.badgeProposal,m.badgeProposal);
 }
 const hakon=member('hakon-lohne');assert.deepEqual(hakon.contribution.excludedYears,[2016]);assert.equal(H.contribution(hakon).count,12);assert.equal(H.contribution(member('dag-morten-frantzen')).count,13);
 const oldRole=old.groups.flatMap(g=>g.members).find(m=>m.id==='hakon-lohne').roles.find(r=>r.note);
 assert.ok(hakon.roles.some(r=>r.historicalNotes?.some(n=>n.text===oldRole.note)));assert.ok(hakon.historicalNotes.length);
 for(const file of ['data/history.json','data/volunteers.json','data/badges.json','data/event-dates.json','index.html','js/history-data.js','js/brag-card.js'])assert.deepEqual(await require('./helpers/honors.cjs').preservedFile(root,file),execFileSync('git',['show','41f5e45:'+file],{cwd:root}),file);
 await require('./helpers/honors.cjs').assertOrdinaryDiplomaCss(root);assert.deepEqual(data.diplomaApprovals,[]);
});
test('V3.5.1 44 unique cards have three founder sizes, equal memorials last, warm concise language and hidden navigation on mobile/PC',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(new Set(await p.locator('[data-honoree]').evaluateAll(es=>es.map(e=>e.dataset.honoree))).size,44);
   assert.deepEqual(await p.locator('#honorPeople>[data-honor-group]').evaluateAll(es=>es.map(e=>e.dataset.honorGroup)),['organizers','volunteers','memorial']);
   const boxes=await p.locator('[data-honoree]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.honoree,{height:e.getBoundingClientRect().height,medal:e.querySelector('img')?.getBoundingClientRect().width}])));
   assert.ok(boxes['oscar-lohne'].height>boxes['einar-danielsen'].height);assert.ok(boxes['erling-askildsen'].height>boxes['einar-danielsen'].height);
   for(const id of ['arnfinn-haverstad','helge-reisvoll']){assert.ok(boxes['einar-danielsen'].height>boxes[id].height);assert.ok(boxes['einar-danielsen'].medal>boxes[id].medal);}
   assert.equal(boxes['floke-bredland'].height,boxes['leif-wiig'].height);
   assert.equal(await p.locator('.honor-memorial-lead').count(),0);
   assert.doesNotMatch(await p.locator('body').innerText(),/Foreløpig|fravær fratrukket|ikke automatisk tildelt|Dugnadsmilepæl til vurdering|æresmerket er et forslag|designutkast|diplomutkast/i);
   await p.goto(h.base+'/heder.html#person/einar-danielsen');await p.locator('#profileName').waitFor();
   assert.doesNotMatch(await p.locator('.honor-profile-header').innerText(),/35|0 dugnadsutgaver/);assert.match(await p.locator('.honor-profile-header').innerText(),/planlagt i 2026/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));assert.equal(await p.locator('a[href*="heder.html"]').count(),0);assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('V3.5.1 reviewed presentation set covers all 44 without promoting estimated years or changing official approval states',async()=>{
 const set=data.presentationPrintSet;assert.equal(set.scope,'presentation-only');assert.equal(new Set([...set.entries.map(e=>e.personId),...set.pendingReviews.map(r=>r.personId)]).size,44);
 for(const m of data.groups.flatMap(g=>g.members)){
  const choices=H.diplomaChoices(data,m,years),safe=choices.filter(id=>H.canPresent(data,m,id));assert.ok(safe.length);
  for(const badgeId of safe)assert.ok(set.entries.some(e=>e.personId===m.id&&e.badgeId===badgeId)||set.pendingReviews.some(r=>r.personId===m.id),m.id);
  if(H.mainBadge(data,m,years).basis==='registered-period'&&H.mainBadge(data,m,years).badgeId)assert.notEqual(choices[0],'thanks');
  assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
 }
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  const rejected=await p.evaluate(async()=>{
   const d=structuredClone(await MorothonHonorsData.load()),entry=d.presentationPrintSet.entries.find(e=>e.personId==='christan-berthelsen');entry.badgeId='service-dugnad-10';
   try{MorothonHonorsData.validate(d);return false;}catch{return true;}
  });assert.equal(rejected,true);
  const model=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('jon-fjeld');return {mode:d.printMode,count:d.contributionCount,year:d.achievementYear,gratitude:d.gratitude};});
  assert.deepEqual(model,{mode:'presentation',count:13,year:2023,gratitude:false});
  const estimated=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('jon-fjeld','service-dugnad-10');return {mode:d.printMode,estimated:d.estimated,html:MorothonDiplomas.documentHtml(d)};});
  assert.equal(estimated.mode,'presentation');assert.equal(estimated.estimated,undefined);assert.doesNotMatch(estimated.html,/FORHÅNDSVISNING|MULIGE DUGNADSUTGAVER/);
 }finally{await p.close();}
});
test('V3.5.1 five genuine clean A4 PDFs retain correct recipients and historical milestones, without draft labels or invented dates',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  for(const id of ['einar-danielsen','dag-morten-frantzen','hakon-lohne','christan-berthelsen','erling-danielsen']){
   const d=await p.evaluate(id=>MorothonDiplomas.serviceDraft(id),id);assert.equal(d.printMode,expectedPrintMode(data,id));
   if(id==='einar-danielsen'){assert.equal(d.contributionCount,33);assert.equal(d.eventDate,null);assert.equal(d.achievementYear,null);}
   const q=await h.browser.newPage();try{
    await q.setContent(await p.evaluate(d=>MorothonDiplomas.documentHtml(d),d));await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});await q.addScriptTag({url:h.base+'/js/diplomas.js'});
    const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,id+': '+layout.failures);
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');
    assert.match(info,/Pages:\s+1\b/);assert.match(info,/841\.\d+ x 594|841\.\d+ x 595/);assert.ok(text.includes(member(id).name));if(expectedPrintMode(data,id)==='draft')assert.match(text,/FORHÅNDSVISNING/);else assert.doesNotMatch(text,/UTKAST|IKKE UTDELT|FORHÅNDSVISNING|EKSEMPEL/);
    if(id==='einar-danielsen'){assert.match(text,/33/);assert.doesNotMatch(text,/35|1992–2026/);}
    if(id==='dag-morten-frantzen')assert.match(text,/2014–2026/);if(id==='hakon-lohne')assert.match(text,/2014–2026/);
   }finally{await q.close();}
  }
 }finally{await p.close();}
});
test('V3.5.1 stale presentation content falls back to an explicitly marked preview and forged clean flags cannot enable printing',async()=>{
 const core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));core.presentationPrintSet.entries=core.presentationPrintSet.entries.filter(e=>e.personId!=='dag-morten-frantzen');
 const p=await h.browser.newPage();try{
  await p.route('**/data/honors.json',r=>r.fulfill({json:core}));await p.goto(h.base+'/heder.html#person/dag-morten-frantzen');await p.locator('#profileName').waitFor();await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
  assert.equal(await p.frameLocator('iframe').locator('.diploma-draft').textContent(),'FORHÅNDSVISNING');
  const result=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('dag-morten-frantzen');d.printMode='presentation';d.presentationApproval={verified:true};document.querySelector('iframe').contentDocument.querySelector('.diploma-draft').remove();return MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument);});
  assert.equal(result.ready,false);assert.match(result.failures.join(' '),/utskriftssett/);
 }finally{await p.close();}
});
