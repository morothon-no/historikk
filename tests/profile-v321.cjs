const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs');const root=path.resolve(__dirname,'..'),base='6a1febe';let h,data;
before(async()=>{h=await createHarness();data=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8'));});after(async()=>{await h?.close();});
async function load(width=390,fixture){const p=await h.browser.newPage({viewport:{width,height:1100}});if(fixture)await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;}
test('V3.2.1 fourth front-page metric is dynamically 33 with three participations; five-edition loyalty honours are unchanged',async()=>{
 assert.deepEqual(await fs.readFile(path.join(root,'js/loyalty.js')),execFileSync('git',['show',base+':js/loyalty.js'],{cwd:root}));
 for(const width of [320,390,768,1440]){const p=await load(width);try{
  const metric=p.locator('.metric').last();assert.equal(await metric.locator('strong').textContent(),'33');assert.equal(await metric.locator('small').evaluate(e=>e.firstChild.textContent),'Med 100 % deltakelse siden debut');assert.equal(await metric.locator('.metric-note').textContent(),'Minst 3 utgaver · til og med 2026');
  const r=await metric.evaluate(e=>({fit:e.scrollWidth<=e.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth,note:getComputedStyle(e.querySelector('.metric-note')).fontSize}));assert.equal(r.fit,true);assert.ok(parseFloat(r.note)>=11);
  const separation=await p.evaluate(()=>{const participants=S.people.filter(frontPagePerfectAttendance),three=participants.find(p=>p.c===3),L=loyalty(three);return {count:participants.length,three:three.c,poss:L.poss,level:L.level,recognition:L.recognition,starts:S.results.filter(countsAsParticipation).length};});assert.equal(separation.count,33);assert.equal(separation.three,3);assert.equal(separation.poss,3);assert.equal(separation.level,0);assert.equal(separation.recognition,null);
 }finally{await p.close();}}
});
test('V3.2.1 2027 metric updates from canonical unique years, includes DNF and excludes DNS and missing latest starts',async()=>{
 const p=await load();let eligible;try{eligible=await p.evaluate(()=>S.people.filter(frontPagePerfectAttendance).map(p=>p.i));}finally{await p.close();}
 const fixture=structuredClone(data),id='V321-THREE',alias='V321-ALIAS';fixture.people.push({i:id,n:'Syntetisk treårsprofil',g:'Herre'},{i:alias,n:'Godkjent testalias',g:'Herre'});fixture.redirects[alias]=id;fixture.aliases[id]=['Godkjent testalias'];fixture.yearStats.push([2027,3,2,1]);
 fixture.results.push([2027,eligible[0],'Morothon','20 km','Fullført','2:00:00'],[2027,eligible[1],'Morothon','20 km','DNF','DNF'],[2027,eligible[2],'Morothon','20 km','DNS','DNS'],...[2025,2026,2027].map(y=>[y,y===2025?alias:id,'Kortmoro','10 km','Fullført','1:00:00']),[2027,alias,'Morothon','20 km','Fullført','2:00:00']);
 const future=await load(390,fixture);try{assert.equal(await future.locator('.metric').last().locator('strong').textContent(),'3');assert.equal(await future.locator('.metric-note').textContent(),'Minst 3 utgaver · til og med 2027');const r=await future.evaluate(({id,alias})=>({canonical:resolvePid(alias),people:S.people.filter(p=>p.i===id||p.i===alias).length,count:person(id).c,loyal:loyalty(person(id)).level}),{id,alias});assert.deepEqual(r,{canonical:id,people:1,count:3,loyal:0});}finally{await future.close();}
});
test('V3.2.1 metric uses arranged editions, not calendar years or duplicate/DNS/relay rows',async()=>{
 const fixture={schemaVersion:1,people:[{i:'three',n:'Tre utgaver',g:'Herre'},{i:'duplicates',n:'Tre starter samme år',g:'Herre'},{i:'relay',n:'Stafettlag',g:'Herre'}],results:[],yearStats:[2022,2024,2027].map(y=>[y,1]),redirects:{}};
 for(const y of [2022,2024,2027]){fixture.results.push([y,'three','Morothon','20 km',y===2024?'DNF':'Fullført',y===2024?'DNF':'2:00:00'],[y,'relay','Langmoro stafett','20 km','Fullført','2:00:00']);}
 fixture.results.push(...Array.from({length:3},()=>[2027,'duplicates','Kortmoro','10 km','Fullført','1:00:00']),[2024,'duplicates','Kortmoro','10 km','DNS','DNS']);
 const p=await load(390,fixture);try{assert.equal(await p.locator('.metric').last().locator('strong').textContent(),'1');assert.equal(await p.locator('.metric-note').textContent(),'Minst 3 utgaver · til og med 2027');}finally{await p.close();}
});
test('issue #9 has one supplementary year view and no repeated stats, goals or personal performance boxes',async()=>{
 for(const width of [320,390,1440]){const p=await load(width);try{for(const name of ['Inger Katherin Dahl Frantzen','Kristen Fløgstad','Finn Gerhard Olsen','Gunnar Kåsa']){
  await p.evaluate(name=>openProfile(S.people.find(p=>p.n===name).i),name);assert.equal(await p.locator('#profileYearsDisclosure').count(),1);const detail=p.locator('.runner-full-details');await detail.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await detail.getAttribute('open'),'');assert.equal(await detail.locator('.profile-primary-stats,.brag-support').count(),0);assert.equal(await p.locator('#profile .brag-support').count(),1);assert.equal(await p.locator('#profile .brag-next').count(),1);assert.equal(await p.locator('#profile .brag-count').count(),1);
  const r=await p.evaluate(()=>{const c=document.querySelector('.brag-card'),d=document.querySelector('.runner-full-details');return {card:c.textContent,details:d.textContent,years:[...d.querySelectorAll('.brag-year-list li')].map(e=>+e.textContent),started:d.querySelectorAll('.brag-year-started').length,neutral:d.querySelector('.brag-period-basis')?.textContent||'',overflows:[...d.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className),goalsInDetail:d.querySelectorAll('.brag-next').length};});
  assert.deepEqual(r.overflows,[]);assert.equal(new Set(r.years).size,r.years.length);assert.doesNotMatch(r.details,/Samlet registrert distanse|Beste Langmoro|debutår|aktiv rekke|lengste historiske rekke/);
  if(name==='Inger Katherin Dahl Frantzen'){assert.equal(r.started,12);assert.equal(r.years.length,12);assert.equal(r.goalsInDetail,0);assert.equal(r.neutral,'');assert.equal((r.card.match(/12 på rad/g)||[]).length,1);assert.equal((r.card.match(/100 %/g)||[]).length,1);}
  if(name==='Kristen Fløgstad'){assert.equal(r.started,12);assert.equal(r.years.length,24);assert.equal(r.years.at(-1),2016);assert.match(r.neutral,/12 av 24.*1993–2016 · 50 %/);assert.doesNotMatch(r.card,/35 %|50 %/);}
  await p.keyboard.press('Escape');assert.equal(await p.locator('#panel').isVisible(),false);
 }}finally{await p.close();}}
});
test('issue #9 hides an empty supplementary view when only one participation year exists',async()=>{
 const p=await load();try{await p.evaluate(()=>openProfile(S.people.find(p=>p.c===1&&p.f===2026).i));assert.equal(await p.locator('.runner-full-details').count(),0);assert.equal(await p.locator('.brag-card .brag-next').count(),1);assert.equal(await p.locator('#profile .result-list').count(),1);}finally{await p.close();}
});
test('issue #9 single previous medal is 128px on 390 and 150px on desktop, retains its source and remains below the main motif',async()=>{
 for(const [width,size]of [[320,104],[390,128],[1440,150]]){const p=await load(width);try{
  await p.evaluate(()=>openProfile('MOR-0C5F6C9'));await p.evaluate(()=>Promise.all([...document.querySelectorAll('.brag-card img')].map(i=>i.decode())));
  const r=await p.evaluate(()=>{const card=document.querySelector('.brag-card'),main=card.querySelector('.brag-main-medal'),previous=card.querySelector('.brag-medal-row img'),edge=im=>{const r=im.getBoundingClientRect(),b=MorothonCard.visibleBounds(im);return Math.min(r.width/im.naturalWidth,r.height/im.naturalHeight)*Math.max(b.width,b.height);};return {size:previous.getBoundingClientRect().width,src:previous.src,expected:BADGE_IMAGES[5],main:edge(main),previous:edge(previous),overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(r.size,size);assert.equal(r.src,r.expected);assert.ok(r.main>r.previous*1.5);assert.equal(r.overflow,false);
 }finally{await p.close();}}
});
test('V3.2.1 PNG exports are byte-identical to published V3.2 for 1/2/5+ previous medals in both approved formats',async()=>{
 const before=await h.browser.newPage({viewport:{width:390,height:1100}}),after=await load();try{
  const originals=new Map(['/index.html','/js/brag-card.js','/css/brag-card.css'].map(f=>[f,execFileSync('git',['show',base+':'+f.slice(1)],{cwd:root})]));await before.route('**/*',r=>{const f=new URL(r.request().url()).pathname,key=f==='/'?'/index.html':f;return originals.has(key)?r.fulfill({body:originals.get(key),contentType:key.endsWith('.js')?'text/javascript':key.endsWith('.css')?'text/css':'text/html'}):r.continue();});await before.goto(h.base);await before.waitForFunction(()=>!document.querySelector('#loading'));
  const ids=await after.evaluate(()=>['MOR-0C5F6C9',S.people.find(p=>p.c>=15&&p.c<20).i,S.people.find(p=>p.n==='Finn Gerhard Olsen').i]);for(const id of ids)for(const format of ['portrait','square']){const hashes=[];for(const p of [before,after])hashes.push(await p.evaluate(async({id,format})=>{const b=await MorothonCard.build(id,{format});URL.revokeObjectURL(b.url);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.blob.arrayBuffer()))];},{id,format}));assert.deepEqual(hashes[0],hashes[1],id+' '+format);}
 }finally{await before.close();await after.close();}
});
