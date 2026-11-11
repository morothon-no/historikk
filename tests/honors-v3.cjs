const {readHonors}=require('./helpers/honors.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,honors,history;
const links={ 'erling-askildsen':'MOR-5ACFAA4','oscar-lohne':'MOR-87AA561','arnfinn-haverstad':'MOR-A4F1F02','helge-reisvoll':'MOR-AD182FF','einar-danielsen':'MOR-D48A84B','kalle-kimestad':'MOR-C65968C','finn-lohne':'MOR-3FAED73','hakon-lohne':'MOR-AA6C983' };
before(async()=>{h=await createHarness();honors=await readHonors();history=JSON.parse(await fs.readFile(path.join(__dirname,'../data/history.json'),'utf8'));});after(async()=>{await h.close();});
async function load({width=1440,id='',data,results}={}){const p=await h.browser.newPage({viewport:{width,height:1000}});if(data)await p.route('**/data/honors.json',r=>r.fulfill({json:data}));if(results)await p.route('**/data/history.json',r=>r.fulfill({json:results}));await p.goto(h.base+'/heder.html'+(id?'#person/'+id:''));await p.locator(id?'#profileName':'[data-honor-group="founders"]').waitFor();return p;}
test('V3 five sourced founders, explicit runner IDs, confirmed volunteers and independent organizer roles',()=>{
 const founders=honors.groups.find(g=>g.id==='founders');assert.deepEqual(founders.members.map(m=>m.name),['Erling Askildsen','Oscar Lohne','Arnfinn Håverstad','Helge Reisvoll','Einar Danielsen']);assert.ok(founders.members.every(m=>m.status==='confirmed'));
 const all=honors.groups.flatMap(g=>g.members);assert.equal(all.some(m=>m.name==='Helge Andersen'),false);assert.equal(honors.retiredProfiles[0].id,'helge-andersen');
 for(const [id,pid]of Object.entries(links))assert.equal(all.find(m=>m.id===id).runnerId,pid);
 for(const id of ['kalle-kimestad','finn-lohne']){const m=all.find(m=>m.id===id);assert.equal(m.status,'confirmed');assert.equal(m.roles[0].fromYear,2014);}
 for(const id of ['dag-morten-frantzen','hakon-lohne']){const m=all.find(m=>m.id===id);assert.equal(m.status,'provisional');assert.equal(m.roles[0].confirmed,true);assert.equal(m.roles[0].fromYear,2014);}
 assert.equal(all.find(m=>m.id==='dag-morten-frantzen').runnerId,undefined);assert.equal(all.find(m=>m.id==='bent-bakke').runnerId,undefined);assert.equal(honors.groups.find(g=>g.id==='organizers').badgeId,null);
 assert.ok(all.every(m=>(m.roles||[]).every(r=>r.sourceIds.length>0)));assert.match(all.find(m=>m.id==='hakon-lohne').roles[0].note,/Svalbard.*2016/);
});
test('V3 dynamically computes controlled participation totals and exact comparable distances from the unmodified history',async()=>{
 const p=await load();try{
 const actual=await p.evaluate(async ids=>{const model=await MorothonHistoryData.load();return Object.fromEntries(Object.entries(ids).map(([id,pid])=>{const s=model.stats(pid),best=s.best.find(b=>b.event==='Morothon'&&b.km===21&&b.period==='historical');return [id,{count:s.count,first:s.firstYear,last:s.lastYear,best21:best?[best.time,best.year]:null,bestGroups:s.best.map(b=>[b.event,b.km,b.period,b.time,b.year]),wins:s.sourceWins.map(r=>[r[0],r[2],r[3],r[5],r[6]])}];}));},links);
 assert.deepEqual([actual['erling-askildsen'].count,actual['erling-askildsen'].first,actual['erling-askildsen'].last,actual['erling-askildsen'].best21],[18,1992,2025,['1:44:45',1995]]);
 const expected={'oscar-lohne':[2,'2:01:45',1995],'arnfinn-haverstad':[6,'1:34:39',1995],'helge-reisvoll':[5,'5:10:43',2003],'einar-danielsen':[9,'1:43:42',1996],'finn-lohne':[6,'1:55:30',1995]};
 for(const [id,[count,time,year]]of Object.entries(expected)){assert.equal(actual[id].count,count);assert.deepEqual(actual[id].best21,[time,year]);}
 assert.equal(actual['kalle-kimestad'].count,12);assert.deepEqual([actual['kalle-kimestad'].first,actual['kalle-kimestad'].last],[1993,2007]);assert.equal(actual['hakon-lohne'].count,13);
 assert.ok(actual['arnfinn-haverstad'].wins.some(r=>JSON.stringify(r)===JSON.stringify([1993,'Kortmoro','10 km','0:49:59',1])));
 assert.ok(actual['erling-askildsen'].bestGroups.some(b=>b[1]===18&&b[3]==='1:33:24'));assert.equal(actual['erling-askildsen'].best21[0],'1:44:45');
 assert.ok(actual['hakon-lohne'].bestGroups.some(b=>b[1]===20&&b[2]==='historical'));assert.ok(actual['hakon-lohne'].bestGroups.some(b=>b[1]===20&&b[2]==='since-2014'));
 assert.deepEqual(actual['kalle-kimestad'].bestGroups.filter(b=>b[0]==='Kortmoro').map(b=>b[1]).sort((a,b)=>a-b),[10,13,14]);
 }finally{await p.close();}
});
test('shared rules preserve all ordinary profile years, class placements, alias behavior and history bytes',async()=>{
 const before=await fs.readFile(path.join(__dirname,'../data/history.json'));const p=await h.browser.newPage();try{await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));const result=await p.evaluate(()=>{const model=MorothonHistoryData.create(S.data);return {places:S.results.every(r=>classPlacement(r)===(model.classPlaces.get(r)||null)),years:S.people.every(p=>JSON.stringify(startedYears(p))===JSON.stringify(model.stats(p.i)?.years||[])),alias:model.stats('MOR-4CB0E52').id,unknown:model.stats('MOR-0000000'),json:JSON.stringify(S.data.results)};});assert.equal(result.places,true);assert.equal(result.years,true);assert.equal(result.alias,'MOR-72A949A');assert.equal(result.unknown,null);assert.equal(result.json,JSON.stringify(history.results));assert.deepEqual(await fs.readFile(path.join(__dirname,'../data/history.json')),before);
 }finally{await p.close();}
});
test('V3 every linked honor card and profile works on mobile and desktop; founder distinctions are computed',async()=>{
 for(const width of [320,390,1440]){const p=await load({width});try{
  assert.equal(await p.locator('[data-honor-group="founders"] [data-honoree]').count(),5);
  assert.match(await p.locator('[data-honoree="erling-askildsen"] .honor-distinction').textContent(),/Flest løpsdeltakelser/);assert.match(await p.locator('[data-honoree="arnfinn-haverstad"] .honor-distinction').textContent(),/Raskeste grunnlegger.*21 km/);
  for(const [id,pid]of Object.entries(links)){
   await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();assert.equal(await p.locator('#honorProfile .runner-profile-link').getAttribute('href'),'index.html#lop='+pid);assert.ok(await p.locator('#honorProfile .honor-race-metrics b').count());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${id} at ${width}`);
  }
  await p.goto(h.base+'/heder.html#person/arnfinn-haverstad');await p.locator('#profileName').waitFor();assert.match(await p.locator('.honor-podiums').textContent(),/1\. plassKortmoro · 10 km · 199349:59/);await p.locator('#honorProfile .runner-profile-link').click();await p.locator('#panel').waitFor({state:'visible'});assert.match(await p.locator('#profile .brag-identity h2').textContent(),/Arnfinn Håverstad/);assert.match(p.url(),/#lop=MOR-A4F1F02/);
 }finally{await p.close();}}
});
test('V3 missing runner identity never guesses by name; broken explicit links and retired routes remain safe',async()=>{
 const data=structuredClone(honors),vol=data.groups.find(g=>g.id==='volunteers');vol.members.push({id:'unlinked-example',name:'Erling Askildsen',status:'provisional',reason:null,stories:[]});vol.members.push({id:'broken-example',name:'Ukjent kobling',status:'provisional',runnerId:'MOR-0000000',reason:null,stories:[]});
 const p=await load({id:'unlinked-example',data});try{assert.equal(await p.locator('#honorProfile .honor-race-metrics').count(),0);assert.equal(await p.locator('#honorProfile .runner-profile-link').count(),0);assert.equal(await p.locator('.honor-racing').count(),0);assert.equal(await p.locator('.eyebrow').filter({hasText:'BEKREFTET HISTORISK ROLLE'}).count(),0);
 await p.goto(h.base+'/heder.html#person/broken-example');await p.locator('#profileName').waitFor();assert.equal(await p.locator('#honorProfile .runner-profile-link').count(),0);
 await p.goto(h.base+'/heder.html#person/helge-andersen');await p.locator('#profileName').waitFor();assert.match(await p.locator('#honorProfile').textContent(),/ikke oppført som bekreftet grunnlegger/);assert.equal(await p.locator('#honorProfile img').count(),0);
 }finally{await p.close();}
});
test('V3 participation uses DNS/DNF, unique years and redirects; source podiums and distance groups remain separate',async()=>{
 const p=await load();try{const r=await p.evaluate(()=>{
 const f={schemaVersion:1,people:[{i:'root',n:'Test',g:'Herre'},{i:'team',n:'Testlag',g:'Herre'}],redirects:{old:'root',older:'old'},yearStats:[[1992,1],[1993,1],[2014,1],[2015,1]],teamResults:[{year:2015,team:'Testlag'}],results:[[1992,'old','Morothon','21 km','Fullført','1:44:45',2],[1992,'older','Kortmoro','10 km','Fullført','49:59',1],[1993,'root','Morothon','18 km','DNF','DNF'],[2014,'root','Morothon','20 km','DNS','DNS'],[2015,'root','Morothon','21 km','Fullført','1:50:00',4],[2015,'root','Morothon','20 km','Fullført','1:00:00',3]]};const m=MorothonHistoryData.create(f),s=m.stats('older');return {id:s.id,count:s.count,years:s.years,groups:s.best.map(b=>[b.km,b.period,b.time]),sourceWins:s.sourceWins.length,podiums:s.sourcePodiums.length,team:m.stats('team'),mutated:f.people[0].c};
 });assert.deepEqual([r.id,r.count,r.years],['root',3,[1992,1993,2015]]);assert.equal(r.groups.length,4);assert.equal(r.sourceWins,1);assert.equal(r.podiums,3);assert.equal(r.team,null);assert.equal(r.mutated,undefined);
 }finally{await p.close();}
});
test('V3 stats and cohort distinctions follow newer history while role and volunteer tenure stay independent',async()=>{
 const results=structuredClone(history);results.results.push([2026,'MOR-5ACFAA4','Kortmoro','10 km','Fullført','1:40:00',99,'Herrer','','']);const p=await load({id:'erling-askildsen',results});try{assert.equal(await p.locator('.honor-race-metrics b').first().textContent(),'19');assert.match(await p.locator('.honor-race-metrics').textContent(),/1992–2026/);assert.match(await p.locator('[data-distance="10"]').textContent(),/1:40:00/);
 await p.goto(h.base+'/heder.html#person/helge-reisvoll');await p.locator('#profileName').waitFor();assert.equal(await p.locator('.honor-race-metrics b').first().textContent(),'5');assert.match(await p.locator('#honorProfile .honor-story').textContent(),/innsatsen rundt arrangementet/);assert.doesNotMatch(await p.locator('#honorProfile .profile-role').textContent(),/5 år/);
 }finally{await p.close();}
});
test('V3.4 narrative preserves 128, resolves Svalbard to 2016 and keeps uncertain Floke dates out of the main story',async()=>{
 const p=await load();try{const text=await p.locator('#honorOverview').textContent();assert.match(text,/1992–2013/);assert.match(text,/2014–2026/);assert.match(text,/Dag Morten Frantzen, Håkon Lohne og Bent-Inge Bakke/);assert.match(text,/Floke Bredland/);assert.equal(await p.locator('[data-honoree*="floke"]').count(),1);assert.match(await p.locator('#honorTimeline').textContent(),/Allerede i 1992 stilte 128 deltakere/);assert.doesNotMatch(await p.locator('#honorTimeline').textContent(),/129/);assert.match(await p.locator('#honorSourceContent').textContent(),/128/);assert.equal(await p.locator('a[href="https://www.fvn.no/lokalsporten/i/qKlrz/soegne-morothon-for-25-gang"]').count()>0,true);
 assert.ok(honors.groups.flatMap(g=>g.members).filter(m=>m.id!=='bent-bakke').every(m=>m.stories.every(s=>s.sourceIds.length&&s.confirmed)));
 assert.match(text,/Til minne om/);assert.match(honors.groups.flatMap(g=>g.members).find(m=>m.id==='hakon-lohne').stories[0].text,/2016/);
 }finally{await p.close();}
});
test('V3 all founder diplomas have short personal tributes, native medals and safe A4 previews; organizers get no automatic award',async()=>{
 const p=await load();try{for(const member of honors.groups.find(g=>g.id==='founders').members){await p.goto(h.base+'/heder.html#person/'+member.id);await p.locator('#profileName').waitFor();await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));
 const d=await p.evaluate(async id=>{const doc=document.querySelector('iframe').contentDocument,m=await MorothonDiplomas.serviceDraft(id);return {name:doc.querySelector('.diploma-recipient h2').textContent,tribute:doc.querySelector('.diploma-citation').textContent,layout:await MorothonDiplomas.checkLayout(doc),src:doc.querySelector('.diploma-medal').src,expected:m.asset.src,ready:m.imageReady,preview:m.previewOnly};},member.id);
 assert.equal(d.name,member.name);assert.equal(d.tribute,member.diplomaTribute);assert.equal(d.layout.ready,true);assert.equal(d.src,d.expected);assert.equal(d.ready,false);assert.equal(d.preview,true);assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),0);assert.equal(await p.locator('iframe').getAttribute('sandbox'),'allow-same-origin');
 }
 await p.goto(h.base+'/heder.html#person/bent-bakke');await p.locator('#profileName').waitFor();assert.equal(await p.locator('.diploma-example').count(),0);assert.equal(await p.locator('.honor-no-award').count(),0);
 }finally{await p.close();}
});
