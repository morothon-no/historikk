const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {readHonors,historicalMember}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let h,data,list;
before(async()=>{h=await createHarness();data=await readHonors();list=JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8'));});
after(async()=>{await h?.close();});
async function open(width=390){const p=await h.browser.newPage({viewport:{width,height:1000}});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="christan-berthelsen"]').waitFor();return p;}

test('issue #13 changes only sourced honor content: 44 identities, Christan name-only, no invented roles or participation',async()=>{
 const people=data.groups.flatMap(g=>g.members),byId=new Map(people.map(m=>[m.id,m]));
 assert.equal(people.length,44);assert.equal(byId.size,44);
 assert.equal(people.filter(m=>m.listingOnly).length,31);
 for(const m of people.filter(m=>m.listingOnly)){
  const entry=list.people.find(p=>p.id===m.id);assert.ok(entry);
  assert.equal(m.reason,null);assert.deepEqual(m.stories,[]);assert.equal(m.runnerId,undefined);
  assert.deepEqual(m.roles.map(r=>r.title),entry.role?[entry.role]:[]);
  assert.equal(m.contribution?.fromYear,entry.fromYear);
  assert.deepEqual(m.badgeProposal.badgeIds,[]);assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
 }
 const christan=byId.get('christan-berthelsen');assert.equal(christan.name,'Christan Berthelsen');assert.deepEqual(christan.roles,[]);assert.equal(christan.contribution,undefined);
 assert.equal(byId.get('jon-fjeld').roles[0].title,'Barneløp og startpistol');assert.equal(byId.get('jon-fjeld').contribution.fromYear,2014);
 for(const id of ['anne-lene-forland-hansen','laila-endresen-skjulestad'])assert.equal(byId.get(id).contribution,undefined);
 const old=JSON.parse(execFileSync('git',['show','22bd10a:data/honors.json'],{cwd:root}));
 for(const m of old.groups.flatMap(g=>g.members)){
  const n=historicalMember(byId.get(m.id));assert.ok(n,m.id);
  if(['dag-morten-frantzen','hakon-lohne','oscar-lohne','erling-askildsen'].includes(m.id)){
   for(const key of ['id','name','runnerId','status','roles','awards','issuedDiplomas'])assert.deepEqual(n[key],m[key],m.id+': '+key); if(!['oscar-lohne','erling-askildsen'].includes(m.id))assert.deepEqual(n.badgeProposal,m.badgeProposal);
   for(const story of m.stories)assert.ok(n.stories.some(s=>s.text===story.text.replaceAll('Bent Bakke','Bent-Inge Bakke')));
  }else if(m.id==='bent-bakke'){
    assert.equal(n.name,'Bent-Inge Bakke');assert.ok(n.aliases.includes('Bent Bakke'));
    assert.match(n.reason,/2014–2019.*foreløpig|Foreløpig.*2014–2019/i);assert.deepEqual(n.badgeProposal.badgeIds,[]);
    const normalized={...n,name:m.name,sourceIds:m.sourceIds,reason:m.reason,internalNotes:m.internalNotes};delete normalized.aliases;
    assert.deepEqual(normalized,m,m.id);
  }else assert.deepEqual(n,m,m.id);
 }
 const protectedFiles=execFileSync('git',['ls-tree','-r','--name-only','22bd10a','assets/medals','data/history.json','data/event-dates.json','index.html'],{cwd:root}).toString().trim().split('\n');
 for(const file of protectedFiles)assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show','22bd10a:'+file],{cwd:root}),file);
});

test('issue #13 renders short non-duplicated volunteer rows with only supplied details at every required width',async()=>{
 for(const width of [320,390,768,1440]){
  const p=await open(width);try{
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(await p.locator('.honor-volunteer-card').count(),31);
   assert.equal(await p.locator('.honor-volunteer-card:not(.honor-card-with-collection) img:not(.honor-card-medal),.honor-volunteer-card p,.honor-volunteer-card .honor-card-summary').count(),0);
   const rows=await p.locator('.honor-volunteer-card').evaluateAll(es=>es.map(e=>({id:e.dataset.honoree,text:[e.querySelector('strong').textContent,e.querySelector('.honor-card-role')?.textContent].filter(Boolean).join(' '),provisional:!!e.querySelector('.honor-main-caption'),collection:!!e.querySelector('.honor-card-collection'),height:e.getBoundingClientRect().height,racingHeight:(()=>{const r=e.querySelector('.honor-card-racing');return r?r.getBoundingClientRect().height+parseFloat(getComputedStyle(r).marginTop)+parseFloat(getComputedStyle(r).marginBottom):0;})()})));
   assert.equal(new Set(rows.map(r=>r.id)).size,31);assert.ok(rows.every(r=>r.height<=(r.collection?205:r.provisional?155:110)+r.racingHeight),JSON.stringify(rows));
   const row=id=>rows.find(r=>r.id===id).text;
   assert.equal(row('christan-berthelsen'),'Christan Berthelsen');assert.equal(row('lars-aamodt'),'Lars Vassbotn Aamodt');
   assert.equal(row('jon-fjeld'),'Jon Fjeld Barneløp og startpistol · fra 2014');
   assert.equal(row('per-sangvik'),'Per Sangvik Løypemerking · fra 2019');
   assert.equal(row('anne-lene-forland-hansen'),'Anne Lene Førland-Hansen Drikkestasjon');
   assert.equal(row('laila-endresen-skjulestad'),'Laila Endresen Skjulestad Drikkestasjon');
   assert.ok(await p.locator('#honorThanks').isVisible());assert.match(await p.locator('#honorThanks').innerText(),/Takk/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.locator('#honorSearch').fill('startpistol');assert.equal(await p.locator('[data-honoree]:visible').getAttribute('data-honoree'),'jon-fjeld');
   await p.locator('#honorSearch').fill('Christan');assert.equal(await p.locator('[data-honoree]:visible').getAttribute('data-honoree'),'christan-berthelsen');
   await p.locator('#honorSearch').fill('Karl Kimestad');assert.equal(await p.locator('[data-honoree]:visible').getAttribute('data-honoree'),'kalle-kimestad');
  }finally{await p.close();}
 }
});

test('issue #13 old volunteer URLs remain minimal, return focus and never invent a story or runner profile, but offer a personal thank-you draft',async()=>{
 const p=await open();try{
  for(const entry of list.people.filter(e=>e.id&&!['jon-fjeld','rune-bergjord','per-sangvik','tom-lohne','birgitte-aamodt','johannes-aamodt','atle-aamodt'].includes(e.id))){
   await p.goto(h.base+'/heder.html#person/'+entry.id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,entry.name);
   const H=require('../js/honors-data.js'),record=H.personRecord(data,H.findIn(data,entry.id).member);
   assert.equal(await p.locator('#honorProfile .honor-story,#honorProfile img,#honorProfile iframe,#honorProfile>.eyebrow').count(),0);
   assert.equal(await p.locator('#honorProfile .honor-racing').count(),record.runnerId?1:0);
   if(record.runnerId)assert.equal(await p.locator('#honorProfile .primary-runner-link').getAttribute('href'),'index.html#lop='+record.runnerId);
   else assert.ok(await p.locator('#honorProfile').evaluate(e=>e.getBoundingClientRect().height<500));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.keyboard.press('Escape');await p.locator('#honorOverview').waitFor({state:'visible'});
   assert.equal(await p.evaluate(()=>document.activeElement.closest('[data-honoree]')?.dataset.honoree),entry.id);
  }
  const gratitude=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('christan-berthelsen');return {thanks:d.gratitude,count:d.contributionCount,year:d.achievementYear};});assert.deepEqual(gratitude,{thanks:true,count:null,year:null});
  // Legacy long fields must not silently upgrade a name-list entry to a full profile.
  const r=await p.evaluate(async()=>{const d=await MorothonHonorsData.load(),core=structuredClone(d);core.groups.forEach(g=>g.members=g.members.filter(m=>!m.listingOnly));const merged=MorothonHonorsData.mergeVolunteers(core,{schemaVersion:1,sourceIds:['organizer-v34'],people:[{id:'fixture-only',name:'Bare test',text:'Automatisk skryt skal ikke vises',stories:[{text:'En lang testhistorie',source:'Test',confirmed:true}]}]});return merged.groups.flatMap(g=>g.members).find(m=>m.id==='fixture-only');});
  assert.equal(r.listingOnly,true);assert.equal(r.reason,null);assert.deepEqual(r.stories,[]);assert.deepEqual(r.roles,[]);assert.deepEqual(r.badgeProposal.badgeIds,[]);
 }finally{await p.close();}
});

test('issue #13 personal organizer stories stay separate from racing and all honor previews remain hidden and locked',async()=>{
 for(const width of [390,1440]){
  const p=await open(width);try{
   await p.goto(h.base+'/heder.html#person/dag-morten-frantzen');await p.locator('#profileName').waitFor();
   const dag=await p.locator('#honorProfile').innerText();assert.match(dag,/Hjernen bak klokka/);assert.match(dag,/tidtaking/);assert.match(dag,/med et smil/);assert.match(dag,/20 km/);assert.match(dag,/stykkevis og delt/);
   assert.equal(await p.locator('.honor-racing').count(),0);
   await p.goto(h.base+'/heder.html#person/hakon-lohne');await p.waitForFunction(()=>document.querySelector('#profileName')?.textContent==='Håkon Lohne');
   const hakon=await p.locator('#honorProfile').innerText();for(const word of ['Det spreke alibiet','replikken','løypemerking','klargjøring','nedrigging','2016'])assert.ok(hakon.includes(word));
   assert.equal(await p.locator('.honor-racing').count(),1);assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),2);
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="christan-berthelsen"]').waitFor();
   assert.equal(await p.locator('#honorFeatured [data-honoree]').count(),5);assert.equal(await p.locator('#honorFeatured .honor-featured-card').count(),2);assert.equal(await p.locator('[data-honoree="oscar-lohne"]').count(),1);assert.equal(await p.locator('[data-honoree="erling-askildsen"]').count(),1);
   for(const key of ['dugnadshelt-fem','grunnlegger-flere','oscar-35','erling-35']){const d=await p.evaluate(async key=>{const m=await MorothonDiplomas.serviceExample(key);return {preview:m.previewOnly,ready:m.imageReady};},key);assert.deepEqual(d,{preview:true,ready:false});}
   assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
   await p.goto(h.base+'/index.html');assert.equal(await p.locator('a[href*="heder.html"]').count(),0);
  }finally{await p.close();}
 }
});

test('issue #13 quality details report the 55mm SVG main badge and all secondary images for highest honor while retaining every approval warning',async()=>{
 for(const width of [390,1440]){
  const p=await open(width);try{
   await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();
   await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status')?.textContent.includes('Diplomet er kontrollert'));
   const lines=await p.locator('#honorProfile .honor-image-quality p').allTextContents();
   assert.equal(lines.length,7);assert.match(lines[0],/Morothons æresmerke.*SVG · ingen fast original-DPI · Skalerbar vektor ved 55\.0 mm/);
   for(const line of lines){assert.match(line,/ikke godkjent for tildeling/);assert.match(line,/kontrolleres og godkjennes/);}
   await p.selectOption('.honor-choice select','latest');
   await p.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay==='latest');
   await p.waitForFunction(()=>document.querySelector('#honorProfile .honor-image-quality p')?.textContent.startsWith('Morothons æresmerke:'));
   assert.equal(await p.locator('#honorProfile .honor-image-quality p').count(),2);
   assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),2);
   assert.equal(await p.evaluate(async()=>(await MorothonDiplomas.serviceDraft('oscar-lohne','latest')).imageReady),false);
  }finally{await p.close();}
 }
});
