const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),base='8e28dd6';let data,registry,years,h;
before(async()=>{data=await readHonors();registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);h=await createHarness();});
after(async()=>{await h?.close();});
const byId=id=>H.findIn(data,id).member;
const expected={
 'oscar-lohne':['service-aeresmerke',35],'erling-askildsen':['service-aeresmerke',35],
 'arnfinn-haverstad':['service-grunnlegger',null],'helge-reisvoll':['service-grunnlegger',null],'einar-danielsen':['service-aeresmerke',null],
 'erling-danielsen':['service-memorial',null],'floke-bredland':['service-memorial',25],'leif-wiig':['service-memorial',25],
 'dag-morten-frantzen':['service-dugnad-10',13],'hakon-lohne':['service-dugnad-10',12],'finn-lohne':['service-dugnad-10',13],'kalle-kimestad':['service-dugnad-10',13],
 'bent-bakke':['service-dugnad-5',6],'jon-fjeld':['service-dugnad-10',13],'rune-bergjord':['service-dugnad-10',12],
 'per-sangvik':['service-dugnad-5',8],'tom-lohne':['service-dugnad-5',6],'birgitte-aamodt':['service-dugnad-5',5],'johannes-aamodt':['service-dugnad-5',6],'atle-aamodt':['service-dugnad-5',5]
};

test('V3.5 audits all 44 identities against the explicit main-badge priority without inventing years or awards',()=>{
 const people=data.groups.flatMap(g=>g.members),original=JSON.stringify(data);assert.equal(people.length,44);assert.equal(new Set(people.map(m=>m.id)).size,44);
 for(const m of people){const main=H.mainBadge(data,m,years);assert.deepEqual([main.badgeId,main.count],expected[m.id]||[null,null],m.id);assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);assert.equal(main.automaticallyAwarded,false);}
 assert.equal(JSON.stringify(data),original);assert.equal(people.filter(m=>H.mainBadge(data,m,years).badgeId===null).length,24);
 for(const id of ['finn-lohne','kalle-kimestad']){assert.equal(byId(id).contribution.fromYear,2014);assert.equal(H.contribution(byId(id)).count,0);assert.equal(H.mainBadge(data,byId(id),years).basis,'estimated');}
 const bent=H.mainBadge(data,byId('bent-bakke'),[...years,2027,2028]);assert.equal(bent.count,6);assert.equal(bent.toYear,2019);assert.equal(bent.toYearStatus,'provisional');
 for(const id of ['erling-danielsen','floke-bredland','leif-wiig']){assert.equal(byId(id).contribution?.confirmedYears,undefined);assert.equal(byId(id).contribution?.toYear,undefined);assert.deepEqual(H.diplomaChoices(data,byId(id),years),['service-memorial']);}
 assert.equal(byId('erling-danielsen').deathYear,undefined);assert.equal(data.groups.find(g=>g.id==='founders').members.length,5);
 const hakon=byId('hakon-lohne');assert.equal(hakon.roles[0].title,'Løpsleder Morothon');assert.equal(hakon.roles[0].fromYear,undefined);assert.ok(hakon.roles.some(r=>r.fromYear===2014));
 const nils=byId('nils-martin-otterdal-nilsen');assert.equal(nils.roles[0].title,'Styreleder i Søgne Skiklubb');assert.equal(nils.roles[0].countsForTenure,false);assert.equal(H.startYear(nils),null);
});

test('V3.5 nine active badge types coexist with unchanged retired assets and preserved historical proposals',async()=>{
 const active=registry.badges.filter(b=>b.kind==='service'&&b.active!==false&&b.displayOnHonorPage!==false);assert.equal(active.length,9);
 assert.deepEqual(active.filter(b=>b.series!=='dugnad').map(b=>b.id).sort(),['service-aeresmerke','service-grunnlegger','service-memorial']);
 for(const b of active){assert.equal(b.status,'design-draft');assert.equal(b.printReady,false);}
 for(const id of ['service-hedersildsjel','service-dugnadshelt']){const b=registry.badges.find(b=>b.id===id);assert.equal(b.active,false);assert.equal(b.displayOnHonorPage,false);assert.equal(H.isActiveBadge(data,id),false);}
 const previous=JSON.parse(execFileSync('git',['show',base+':data/honors.json'],{cwd:root}));
 for(const m of previous.groups.flatMap(g=>g.members)){
  const now=byId(m.id);for(const key of ['id','name','runnerId','aliasIds','aliases','awards','issuedDiplomas','stories'])assert.deepEqual(now[key],m[key],m.id+': '+key);
  if(JSON.stringify(m.badgeProposal)!==JSON.stringify(now.badgeProposal))assert.ok(now.previousBadgeProposals.some(p=>JSON.stringify(p)===JSON.stringify(m.badgeProposal)),m.id);
  for(const r of m.roles)assert.ok(now.roles.some(n=>JSON.stringify(n)===JSON.stringify(r)||n.title===r.title&&n.fromYear===r.fromYear&&n.historicalNotes?.some(h=>h.text===r.note)),m.id+': historical role');
 }
 await require('./helpers/honors.cjs').assertOrdinaryDiplomaCss(root);
 for(const dir of ['data/history.json','data/event-dates.json','assets','index.html','js/history-data.js','js/brag-card.js']){
  const files=execFileSync('git',['ls-tree','-r','--name-only',base,dir],{cwd:root}).toString().trim().split('\n');for(const f of files)assert.deepEqual(await fs.readFile(path.join(root,f)),execFileSync('git',['show',base+':'+f],{cwd:root}),f);
 }
 const stripService=s=>s.replace(/  async function serviceContent\([\s\S]*?(?=  function signoffHtml)/,'SERVICE\n').replace(/  function serviceDocumentHtml\([\s\S]*?(?=  function documentHtml)/,'SERVICE-DOC\n').replace('serviceExample, serviceProof, checkServiceDraft, printServiceDraft,','serviceExample,');
 assert.equal(stripService(await fs.readFile(path.join(root,'js/diplomas.js'),'utf8')),stripService(execFileSync('git',['show',base+':js/diplomas.js'],{cwd:root}).toString()));
});

test('V3.5 every card and profile has at most one main badge at mobile/desktop widths; all identities and gates survive',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();assert.equal(await p.locator('[data-honoree]').count(),44);
   assert.deepEqual(await p.locator('#honorPeople>[data-honor-group]').evaluateAll(es=>es.map(e=>e.dataset.honorGroup)),['organizers','volunteers','memorial']);
   for(const m of data.groups.flatMap(g=>g.members)){
    const card=p.locator(`[data-honoree="${m.id}"]`),key=expected[m.id]?.[0];assert.equal(await card.locator('img').count(),key?1:0,m.id);
    if(key)assert.ok((await card.locator('img').getAttribute('src')).endsWith(registry.badges.find(b=>b.id===key).src),m.id);
   }
   assert.match(await p.locator('[data-honoree="bent-bakke"]').innerText(),/Med da nye krefter overtok i 2014/);
   assert.doesNotMatch(await p.locator('[data-honoree="erling-danielsen"]').innerText(),/33|null/);
   const lead=await p.locator('[data-honoree="erling-danielsen"] img').boundingBox(),other=await p.locator('[data-honoree="leif-wiig"] img').boundingBox();assert.equal(lead.width,other.width,'All three memorials have the same medal size');
   await p.locator('.honor-library>summary').click();assert.equal(await p.locator('#serviceBadges img').count(),9);assert.doesNotMatch(await p.locator('#serviceBadges').innerText(),/Hedersildsjel/);
   for(const m of data.groups.flatMap(g=>g.members)){
    await p.goto(h.base+'/heder.html#person/'+m.id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,m.name);
    assert.equal(await p.locator('.honor-profile-medals img').count(),expected[m.id]?1:0,m.id);assert.equal(await p.locator('.honor-secondary-badges img').count(),0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,m.id);
    assert.equal(await p.locator('option[value="service-hedersildsjel"],option[value="service-dugnadshelt"]').count(),0);
   }
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));assert.equal(await p.locator('a[href*="heder.html"]').count(),0);assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});

test('V3.5 retired formal awards remain valid historical records, while new diploma choices exclude retired motifs',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  const record=await p.evaluate(async()=>{
   const d=structuredClone(await MorothonHonorsData.load()),m=d.groups[0].members[0];
   m.awards=[{id:'historical-fixture',badgeId:'service-hedersildsjel',confirmed:true,date:'2024-11-09',sourceIds:['organizer-v34']}];
   m.issuedDiplomas=[{awardId:'historical-fixture',date:'2024-11-09',sourceIds:['organizer-v34']}];
   const before=JSON.stringify([m.awards,m.issuedDiplomas]);MorothonHonorsData.validate(d);
   return {preserved:JSON.stringify([m.awards,m.issuedDiplomas])===before,options:MorothonHonorsData.diplomaChoices(d,m,Array.from({length:35},(_,i)=>1992+i))};
  });
  assert.equal(record.preserved,true);assert.ok(!record.options.some(id=>data.awardPolicy.retiredBadgeIds.includes(id)));
 }finally{await p.close();}
});

test('V3.5 service diplomas use one active main image; memorials never address a living recipient or invent a date',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  const requests=[...data.diplomaExamples.map(e=>({example:e.id})),...['floke-bredland','leif-wiig','bent-bakke','hakon-lohne'].map(id=>({id}))];
  for(const request of requests){
   const r=await p.evaluate(async r=>{const d=r.example?await MorothonDiplomas.serviceExample(r.example):await MorothonDiplomas.serviceDraft(r.id),f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px';await new Promise(resolve=>{f.onload=resolve;f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.appendChild(f)});try{return {layout:await MorothonDiplomas.checkLayout(f.contentDocument),key:d.assetKey,secondary:d.secondaryAssets.length,images:f.contentDocument.querySelectorAll('.diploma-medal,.diploma-service-secondary img').length,text:f.contentDocument.body.textContent,date:f.contentDocument.querySelector('.diploma-date').textContent,ready:d.imageReady,preview:d.previewOnly,memorial:d.memorial};}finally{f.remove();}},request);
   assert.equal(r.layout.ready,true,JSON.stringify(request)+': '+r.layout.failures);assert.equal(r.images,1);assert.equal(r.secondary,0);assert.equal(r.ready,false);assert.equal(r.preview,true);assert.ok(!data.awardPolicy.retiredBadgeIds.includes(r.key));
   if(r.memorial){assert.match(r.text,/MINNEDIPLOM/);assert.match(r.text,/TIL MINNE OM/);assert.doesNotMatch(r.text,/TILDELES|FOR AT DU STILLER OPP/);assert.equal(r.date.trim(),'');}
   if(request.id==='bent-bakke'){assert.match(r.text,/TAKK FOR INNSATSEN/);assert.equal(r.date.trim(),'');}
  }
  for(const id of data.awardPolicy.retiredBadgeIds){const rejected=await p.evaluate(async id=>{try{await MorothonDiplomas.serviceDraft('oscar-lohne',id);return false;}catch{return true;}},id);assert.equal(rejected,true);}
 }finally{await p.close();}
});
