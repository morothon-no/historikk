const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,data;
// K10-12 and M10-12: corrected EQ Timing screenshot supplied by the organizer, 2026-11-10.
// M13-14: same class ranking applied to its three unchanged recorded finish times.
// [ID, name, class, time, former source place, corrected class place]
const expected=[
 ['MOR-62BB3A0','Live Hajumøvland','K10-12','20:19',2,1],
 ['MOR-DDE9462','Astrid Marie Holmen Solvik','K10-12','20:27',3,2],
 ['MOR-675E992','Sarah Oftebro','K10-12','23:58',4,3],
 ['MOR-D3A8B65','Oda Holmen Hosteland','K10-12','24:01',5,4],
 ['MOR-CE30D34','Emma Louise Nygård','K10-12','24:01',5,4],
 ['MOR-25FA843','Nora Seilskjær Granberg','K10-12','24:02',7,6],
 ['MOR-04DF8BE','Arne Borø Svaland','M10-12','12:48',2,1],
 ['MOR-2613579','Jakob Kristiansen','M10-12','13:17',4,2],
 ['MOR-70303BA','Elander Sylta','M10-12','13:45',5,3],
 ['MOR-8BBD326','Sander Ingebretsen','M10-12','15:45',6,4],
 ['MOR-ED01590','Aron Elias Nevestad','M10-12','15:45',6,4],
 ['MOR-BC00F1A','Erling Holmen Hosteland','M10-12','15:51',8,6],
 ['MOR-638C1F4','Jon Grindland','M10-12','16:10',1,7],
 ['MOR-37322F3','Kalle Nordmarken','M10-12','16:33',10,8],
 ['MOR-D816ECF','Einar Lohne Ådnøy','M10-12','17:32',11,9],
 ['MOR-3477048','Odin Kostøl','M10-12','17:58',12,10],
 ['MOR-1FD0BC8','Erlend Otto Pettersen','M10-12','18:38',13,11],
 ['MOR-5764018','Olav Espeland','M10-12','18:48',14,12],
 ['MOR-6668042','Maldus Sylta','M13-14','12:39',1,1],
 ['MOR-93272F4','Jakob Aamodt','M13-14','12:55',3,2],
 ['MOR-58DA43C','Einar Larsen','M13-14','16:19',9,3]
];
const junior=r=>r[0]===2026&&r[2]==='Junior'&&r[3]==='3 km';
before(async()=>{data=JSON.parse(await fs.readFile(path.join(__dirname,'../data/history.json'),'utf8'));h=await createHarness();});after(async()=>{await h.close();});
async function load(width=390,fixture){const p=await h.browser.newPage({viewport:{width,height:900}});if(fixture)await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;}
test('Jon correction and all 21 junior class places preserve every other historical field byte-for-byte',()=>{
 const rows=data.results.filter(junior);assert.equal(rows.length,expected.length);
 for(const [id,name,cls,time,oldPlace,place]of expected){const r=rows.find(r=>r[1]===id),p=data.people.find(p=>p.i===id);assert.equal(p.n,name);assert.equal(r[7],cls);assert.equal(r[5],time);assert.equal(r[6],place);}
 const jon=data.people.find(p=>p.i==='MOR-638C1F4'),row=rows.find(r=>r[1]===jon.i);assert.equal(jon.g,'Herre');assert.deepEqual(row,[2026,jon.i,'Junior','3 km','Fullført','16:10',7,'M10-12','FRAMSTEG IL','120']);
 // Reconstruct only the documented changed fields in memory: the entire previous file must match.
 const previous=structuredClone(data);previous.updated='2026-11-09';previous.people.find(p=>p.i===jon.i).g='Dame';
 for(const [id,,,,oldPlace]of expected)previous.results.find(r=>junior(r)&&r[1]===id)[6]=oldPlace;
 previous.results.find(r=>junior(r)&&r[1]===jon.i)[7]='K10-12';
 assert.equal(createHash('sha256').update(JSON.stringify(previous)).digest('hex'),'e73daae2c4dbc0bb5d68e2bc0174ab7ff3b1e7e1c5024af891e2f4ef6fd9a719');
});
test('runtime agrees with EQ class places, gender counts and podiums; participation, records and teams stay unchanged',async()=>{
 const p=await load();try{const r=await p.evaluate(()=>{
  const rows=S.results.filter(r=>r[0]===2026&&isJuniorRace(r)),started=S.results.filter(r=>r[0]===2026&&countsAsParticipation(r)),count=rows=>Object.fromEntries(['Dame','Herre'].map(g=>[g,new Set(rows.filter(r=>person(r[1])?.g===g).map(r=>resolvePid(r[1]))).size]));
  const jon=person('MOR-638C1F4'),j=performanceStats(jon.i),live=performanceStats('MOR-62BB3A0');
  return {places:rows.map(r=>[r[1],classPlacement(r)]),junior:count(rows),year:count(started),all:Object.fromEntries(['Dame','Herre'].map(g=>[g,S.people.filter(p=>p.g===g).length])),jon:{count:jon.c,wins:j.wins,podiums:j.podiums,best:j.bestPlace,badges:performanceBadgeList(jon).map(b=>b.name)},live2026Win:live.winYears.includes(2026),records:S.courseRecords.map(r=>[r.name,r.time,r.year]),teams:S.data.teamResults.length,milestones:MorothonMilestones.calculate(2026).participants.length};
 });
 for(const [id,,,,,place]of expected)assert.equal(r.places.find(x=>x[0]===id)[1],place,id);
 assert.deepEqual(r.junior,{Dame:6,Herre:15});assert.deepEqual(r.year,{Dame:150,Herre:248});assert.deepEqual(r.all,{Dame:952,Herre:1691});assert.deepEqual(r.jon,{count:1,wins:0,podiums:0,best:7,badges:[]});assert.equal(r.live2026Win,true);assert.equal(r.teams,4);assert.equal(r.milestones,398);
 assert.deepEqual(r.records,[['Lars Aasheim Svaland','1:31:24',2026],['Ingrid Ukkelberg','1:54:00',2023],['Simen Koland','47:20',2024],['Marianne Andersen','56:37',2025]]);
 }finally{await p.close();}
});
test('mobile and desktop junior archive groups by actual class; Jon profile, filters and source place agree',async()=>{
 for(const width of [320,390,1440]){const p=await load(width);try{
  await p.locator('#yearDisclosure > summary').click();await p.locator('#yearJuniorRace').click();while(await p.locator('#yearMore').isVisible())await p.locator('#yearMore').click();
  assert.deepEqual(await p.locator('#yearCards .year-class-heading span:first-child').allTextContents(),['K10-12','M10-12','M13-14']);assert.equal(await p.locator('#yearCards .year-result-row').count(),21);
  for(const [id,name,cls,time,,place]of expected){const row=p.locator('#yearCards .year-result-row').filter({hasText:name});assert.equal(await row.locator('.year-class-place strong').textContent(),'#'+place);assert.equal(await row.locator('.year-class-place small').textContent(),cls);assert.equal(await row.locator('.year-time').textContent(),time);}
  await p.selectOption('#yearGender','Dame');assert.equal(await p.locator('#yearCards .year-result-row').count(),6);assert.equal(await p.locator('#yearCards button').filter({hasText:'Jon Grindland'}).count(),0);
  await p.selectOption('#yearGender','Herre');while(await p.locator('#yearMore').isVisible())await p.locator('#yearMore').click();assert.equal(await p.locator('#yearCards .year-result-row').count(),15);await p.locator('#yearCards button').filter({hasText:'Jon Grindland'}).click();
  assert.match(await p.locator('.brag-identity p').textContent(),/Herre/);assert.match(await p.locator('#profile .result-row').textContent(),/M10-12.*FRAMSTEG IL.*7\. plass i kildelisten.*16:10.*M10-12 nr\. 7/);assert.equal(await p.locator('#profile .performance-section').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#panel').scrollWidth<=document.querySelector('#panel').clientWidth),true);
 }finally{await p.close();}}
});
test('class ties, DNF/DNS and adult gender rankings remain correct when junior age classes differ',async()=>{
 const f=structuredClone(data),row=(pid,cls,status,time)=>[2026,pid,'Junior','3 km',status,time,null,cls,'',''];
 f.people.push({i:'junior-dnf',n:'DNF test',g:'Herre'},{i:'junior-dns',n:'DNS test',g:'Herre'});f.results.push(row('junior-dnf','M10-12','DNF','DNF'),row('junior-dns','M10-12','DNS','DNS'));
 const p=await load(390,f);try{const r=await p.evaluate(()=>{const get=id=>S.results.find(r=>r[0]===2026&&r[1]===id);return {m10:[classPlacement(get('MOR-ED01590')),classPlacement(get('MOR-8BBD326')),classPlacement(get('MOR-BC00F1A'))],k10:[classPlacement(get('MOR-D3A8B65')),classPlacement(get('MOR-CE30D34')),classPlacement(get('MOR-25FA843'))],dnf:classPlacement(get('junior-dnf')),dns:classPlacement(get('junior-dns')),adult:classPlacement(get('MOR-96EB117'))};});assert.deepEqual(r.m10,[4,4,6]);assert.deepEqual(r.k10,[4,4,6]);assert.equal(r.dnf,null);assert.equal(r.dns,null);assert.equal(r.adult,1);
 }finally{await p.close();}
});
