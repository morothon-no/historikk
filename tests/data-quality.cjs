const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const R=require('../js/history-data.js');
const {buildSite}=require('../scripts/build-site.cjs');
const {manifestFor,approvalFor}=require('../scripts/lib/public-package.cjs');
const root=path.resolve(__dirname,'..');
const row=(year=2026,status='Fullført',time='1:20:30',id='runner',event='Morothon')=>[year,id,event,'20 km',status,time,1,'','',''];
const fixture=results=>({schemaVersion:1,people:[{i:'runner',n:'Testløper',g:'Herre'}],results,yearStats:[[2025,1],[2026,1]],aliases:{},redirects:{}});

test('A2 status matrix separates participation, completion and timed placing, including markers in the time field',()=>{
 for(const [status,time,expected,participates,completed]of [
  ['Fullført','1:20:30','Fullført',true,true],['Fullført',null,'Fullført',true,true],
  ['Fullført','Completed','Fullført',true,true],['Deltatt','','Deltatt',true,false],
  ['DNS','1:20:30','DNS',false,false],['Fullført','DNS','DNS',false,false],
  ['DNF','1:20:30','DNF',true,false],['Fullført','DNF','DNF',true,false],
  ...['Disket','Diskvalifisert','DQ','DSQ','Disqualified'].flatMap(s=>[[s,'1:20:30','Disket',true,false],['Fullført',s,'Fullført',true,true]]),
  ['Påmeldt','1:20:30','Påmeldt',false,false],['Uavklart','1:20:30','Ukjent',false,false]
 ]){
  const r=row(2026,status,time);assert.equal(R.effectiveStatus(r),expected);
  assert.equal(R.countsAsParticipation(r),participates);assert.equal(R.isCompletedResult(r),completed);
  assert.equal(R.placements([r],()=>({g:'Herre'})).has(r),completed&&R.timeSeconds(time)!==null);
 }
 for(const event of ['Langmoro stafett','Relay'])assert.equal(R.countsAsParticipation(row(2026,'Fullført','1:20:30','runner',event)),false);
});
test('A2 strict duration parser rejects overflow, zero, ambiguous separators and status text without inventing times',()=>{
 for(const time of ['1:99:99','00:60','1:60:00','99:99','0:00:00','00:00','-1:10','1:2:03','02:09.52','01:06.14','1:20.30','DNF','Disket','Fullført','',null,Infinity])assert.equal(R.timeSeconds(time),null,String(time));
 for(const [time,seconds]of [['47:20',2840],['1:31:24',5484],['99:59',5999],['1.31.24',5484],['47.20',2840],['\u00a001:27:30',5250]])assert.equal(R.timeSeconds(time),seconds);
});
test('A2 canonical years, loyalty, future results and duplicate starts use one individual participation rule',async()=>{
 const c={window:{MorothonHistoryData:R}};vm.runInNewContext(await fs.readFile(path.join(root,'js/loyalty.js'),'utf8'),c);
 const rows=[row(2025),row(2025,'Fullført','1:20:30','old'),row(2026,'DNF','DNF'),row(2027,'DNS','DNS'),row(2028,'Fullført','1:20:30','runner','Langmoro stafett'),row(2029,'Disket','Disket')];
 const data=fixture(rows);data.redirects.old='runner';
 const model=R.create(data),years=model.stats('old').years;
 assert.deepEqual(years,[2025,2026,2029]);
 assert.equal(JSON.stringify(c.window.MorothonLoyalty.calculate(model.resultsFor('old'),[2025,2026,2027,2028,2029]).years),JSON.stringify(years));
 assert.deepEqual(R.participationYears(rows.filter(r=>r[0]<=2026)),[2025,2026]);
 assert.equal(model.stats('old').best.length,1);
});
test('A2 validation rejects unsafe, missing and cyclic identities and invalid times/statuses without changing input',()=>{
 for(const alter of [
  d=>d.people.push({...d.people[0]}),d=>d.people[0].i="bad');alert(1);//",
  d=>d.results[0][1]='missing',d=>d.results[0][1]="bad');alert(1);//",
  d=>d.redirects={runner:'other',other:'runner'},d=>d.redirects={old:'missing'},
  d=>d.aliases={missing:['Alias']},d=>d.aliases={runner:['']},
  d=>d.results[0][5]='1:99:99',d=>d.results[0][5]='02:09.52',d=>d.results[0][5]='Disket',d=>d.results[0][4]='Uavklart',
  d=>{d.results[0][4]='DNS';d.results[0][5]='DNF';},d=>d.results[0][0]=2026.5,
  d=>d.results[0][3]='-20 km',d=>d.yearStats.push([2026,1])
 ]){
  const d=fixture([row()]);alter(d);const snapshot=JSON.stringify(d);
  assert.ok(R.validate(d).errors.length);assert.throws(()=>R.create(d),/Ugyldig/);assert.equal(JSON.stringify(d),snapshot);
 }
 assert.throws(()=>R.resolveId('a',{a:'b',b:'a'}),/Syklus/);
 assert.equal(R.resolveId('old',{old:'older',older:'runner'}),'runner');
 const dns=fixture([row(2026,'DNS','DNS','not-in-person-list')]);
 assert.equal(R.validate(dns).errors.length,0);assert.equal(R.validate(dns).warnings[0].code,'legacy-dns-without-person');
 const untimed=fixture([row(2026,'Fullført',null)]);assert.equal(R.validate(untimed).errors.length,0);assert.equal(R.create(untimed).stats('runner').best.length,0);
});
test('A2 present history has only documented legacy warnings and no destructive normalization',async()=>{
 const bytes=await fs.readFile(path.join(root,'public-data/data/history.json')),data=JSON.parse(bytes),before=JSON.stringify(data),report=R.assertValid(data);
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(Object.fromEntries([...new Set(report.warnings.map(w=>w.code))].map(code=>[code,report.warnings.filter(w=>w.code===code).length])),{'ambiguous-legacy-time':2,'normalized-status':7,'legacy-disqualification-marker':1,'legacy-unknown-distance':2,'legacy-dns-without-person':79});
 const r=data.results.find(r=>r[0]===2007&&r[1]==='MOR-B1AC0FD');
 assert.equal(r[4],'Fullført');assert.equal(r[5],'Disket');assert.equal(R.effectiveStatus(r),'Fullført');assert.equal(R.isCompletedResult(r),true);
 assert.equal(R.countsAsParticipation(r),true);assert.equal(R.create(data).classPlaces.has(r),false);
 assert.equal(JSON.stringify(data),before);assert.deepEqual(await fs.readFile(path.join(root,'public-data/data/history.json')),bytes);
});
test('A2 builder rejects semantically invalid history even with an internally consistent manifest',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-a2-invalid-'));
 try{
  const dir=path.join(tmp,'package');await fs.cp(path.join(root,'public-data'),dir,{recursive:true});
  const file=path.join(dir,'data/history.json'),history=JSON.parse(await fs.readFile(file));history.results[0][5]='1:99:99';await fs.writeFile(file,JSON.stringify(history));
  const old=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'))),bytes=new Map();for(const name of Object.keys(old.files))bytes.set(name,await fs.readFile(path.join(dir,name)));
  const manifest=manifestFor(bytes,new Map(),old.dataVersion);manifest.assets=old.assets;
  const serialized=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(path.join(dir,'manifest.json'),serialized);
  await assert.rejects(()=>buildSite(path.join(tmp,'site'),{dataDir:dir,approval:approvalFor(serialized)}),/invalid-time/);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
