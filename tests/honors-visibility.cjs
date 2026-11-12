const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors,visibleMembers}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),baseline='ce1c434';let h,core,data;
before(async()=>{core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));data=await readHonors();h=await createHarness();});after(async()=>{await h?.close();});
test('Honor visibility hides only Erling Danielsen while preserving every identity, source, approval, race result and approved image',async()=>{
 const previous=JSON.parse(execFileSync('git',['show',baseline+':data/honors.json'],{cwd:root})),copy=structuredClone(core);
 assert.deepEqual(copy.hiddenProfileIds,['erling-danielsen']);delete copy.hiddenProfileIds;assert.deepEqual(copy,previous);
 assert.equal(data.groups.flatMap(g=>g.members).length,44);assert.equal(visibleMembers(data).length,43);
 assert.equal(H.isVisibleOnHonorPage(data,'erling-danielsen'),false);assert.equal(H.isVisibleOnHonorPage(data,'einar-danielsen'),true);assert.equal(H.isVisibleOnHonorPage(data,'erling-askildsen'),true);
 assert.equal(data.personDetails['erling-danielsen'].runnerLink.runnerId,'MOR-B82F8A3');
 const p=await h.browser.newPage();try{await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  for(const field of [[],['unknown'],['erling-danielsen','erling-danielsen'],'erling-danielsen']){
   const message=await p.evaluate(async field=>{const fixture=structuredClone(await MorothonHonorsData.load());fixture.hiddenProfileIds=field;try{MorothonHonorsData.validate(fixture);return '';}catch(e){return e.message;}},field);
   if(Array.isArray(field)&&!field.length)assert.equal(message,'');else assert.match(message,/skjult hedersprofil/);
  }
 }finally{await p.close();}
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'data/history.json','data/volunteers.json','data/badges.json','data/event-dates.json','assets','css','index.html','js/diplomas.js'],{cwd:root}).toString().trim().split('\n');
 for(const file of files)assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show',baseline+':'+file],{cwd:root}),file);
});
test('Honor overview, search, referenced cards and named diploma gallery exclude Erling; old and alias URLs return safely to the overview on mobile and PC',async()=>{
 const fixture=structuredClone(core),erling=H.findIn(fixture,'erling-danielsen').member;
 erling.aliasIds=['erling-eldre-lenke'];erling.badgeProposal={status:'proposed',primaryBadgeId:'service-dugnad-30',badgeIds:['service-dugnad-30'],sourceIds:erling.sourceIds};
 fixture.groups.find(g=>g.id==='organizers').memberRefs.push(erling.id);
 fixture.diplomaExamples.push({id:'hidden-erling-example',label:'Erling Danielsen',personId:erling.id,badgeId:'service-dugnad-30'});
 for(const width of [390,1440]){const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});try{
  await p.route('**/data/honors.json',r=>r.fulfill({json:fixture}));await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  assert.equal(await p.locator('[data-honoree]').count(),43);assert.equal(await p.locator('[data-honoree="erling-danielsen"],a[href*="erling-danielsen"],[data-example="hidden-erling-example"]').count(),0);assert.doesNotMatch(await p.locator('body').textContent(),/Erling Danielsen/);
  await p.locator('#honorSearch').fill('Erling Danielsen');assert.equal(await p.locator('[data-honoree]:visible').count(),0);assert.equal(await p.locator('#honorSearchStatus').innerText(),'0 navn i oversikten');
  await p.locator('#honorSearch').fill('Erling Askildsen');assert.equal(await p.locator('[data-honoree]:visible').getAttribute('data-honoree'),'erling-askildsen');await p.locator('#honorSearch').fill('');
  for(const id of ['erling-danielsen','erling-eldre-lenke','%65rling-danielsen']){
   await p.goto(h.base+'/heder.html#person/'+id);await p.waitForURL('**/heder.html#oversikt');await p.locator('#honorOverview').waitFor({state:'visible'});assert.equal(await p.locator('#honorProfile').isVisible(),false);assert.equal(await p.locator('#honorProfile img,#honorProfile iframe,#honorProfile [data-honor-print]').count(),0);assert.doesNotMatch(await p.locator('body').textContent(),/Erling Danielsen/);assert.equal(await p.locator('#honorStatus').textContent(),'');assert.doesNotMatch(await p.title(),/Danielsen/);
  }
  // Every actual person link still resolves to a known, visible canonical identity.
  const links=await p.locator('a[href^="#person/"]').evaluateAll(es=>es.map(e=>decodeURIComponent(e.getAttribute('href').slice(8))));assert.equal(new Set(links).size,43);assert.ok(links.every(id=>H.isVisibleOnHonorPage(data,id)));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');assert.deepEqual(errors,[]);
 }finally{await p.close();}}
});
test('All internal diploma proofs including Einar stay identical; Einars profile and Erlings Adelskalender runner profile still work',async()=>{
 const previous=await h.browser.newPage(),current=await h.browser.newPage();try{
  for(const file of ['js/honors.js','js/honors-data.js','data/honors.json'])await previous.route('**/'+file,r=>r.fulfill({contentType:file.endsWith('.json')?'application/json':'text/javascript',body:execFileSync('git',['show',baseline+':'+file],{cwd:root}).toString()}));
  for(const p of [previous,current]){await p.goto(h.base+'/heder.html#person/einar-danielsen');await p.locator('#profileName').waitFor();}
  const snapshot=p=>p.evaluate(async()=>{const data=await MorothonHonorsData.load(),result=[];for(const m of data.groups.flatMap(g=>g.members))for(const display of ['all','latest']){const d=await MorothonDiplomas.serviceDraft(m.id,display);result.push({id:m.id,display,proof:d.contentProof,mode:d.printMode,date:d.dateLabel});}return result;});
  assert.deepEqual(await snapshot(current),await snapshot(previous));
  assert.equal(await current.locator('#profileName').textContent(),'Einar Danielsen');assert.match(await current.locator('#honorProfile').innerText(),/33 dugnadsutgaver/);
  const before=await previous.locator('.honor-profile-header').innerText();assert.equal(await current.locator('.honor-profile-header').innerText(),before);
  await current.locator('.diploma-example>summary').click();for(const display of ['all','latest']){await current.selectOption('[data-medal-display]',display);await current.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);assert.equal(await current.frameLocator('iframe').locator('.diploma-date p').textContent(),'Søgne, 7. november 2026');}
  await current.goto(h.base+'/index.html#lop=MOR-B82F8A3');await current.locator('#panel').waitFor({state:'visible'});assert.equal(await current.locator('#profile .brag-identity h2').textContent(),'Erling Danielsen');assert.match(current.url(),/#lop=MOR-B82F8A3$/);
 }finally{await previous.close();await current.close();}
});
