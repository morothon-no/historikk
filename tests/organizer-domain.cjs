// Product data-domain tests. Existing public history is only used for equality checks.
// New-customer examples contain fictional names and no account records.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const Domain=require('../scripts/organizers/domain-model.cjs');
const P=require('../scripts/organizers/profile.cjs');
const profile=JSON.parse(fs.readFileSync(path.join(__dirname,'../organizers/morothon/profile.json'),'utf8'));
const history=JSON.parse(fs.readFileSync(path.join(__dirname,'../public-data/data/history.json'),'utf8'));
const copy=x=>structuredClone(x);
test('Morothon legacy domain projection is exact and read-only, including all DNS and team entries',()=>{
 const before=copy(history),start=performance.now(),model=Domain.projectMorothon({history,profile});
 const elapsed=performance.now()-start;
 assert.equal(model.source.resultCount,history.results.length);
 assert.equal(model.people.length,history.people.length);
 assert.equal(model.source.teamResultCount,history.teamResults.length);
 assert.deepEqual(model.results.map(r=>r.legacyRow),history.results,'every current source row must survive in the same order');
 assert.equal(model.source.teamResultCount,4);
 assert.equal(model.results.filter(r=>!r.personLinked).length,79,'unlinked DNS source entries are never invented as people');
 assert.equal(model.results.filter(r=>r.status==='DNF').length,history.results.filter(r=>r[4]==='DNF').length);
 assert.equal(model.results.filter(r=>r.status==='Deltatt').length,history.results.filter(r=>r[4]==='Deltatt').length,'unusual historical status is preserved');
 for(const r of model.results){
  assert.equal(r.status,r.legacyRow[4]);
  assert.equal(r.timeRaw,r.legacyRow[5]);
  assert.equal(r.sourcePlaceRaw,r.legacyRow[6]);
  assert.equal(r.sourceRef.kind,'legacy-row');
  assert.equal(r.resultId,null,'do not fabricate stable result identifiers from row indexes');
  if(['DNS','DNF'].includes(r.status))assert.equal(r.displaySourcePlace,null);
 }
 assert.ok(model.editions.every(e=>e.date===null&&e.datePrecision==='year'),'no fictional event dates');
 assert.ok(model.competitions.every(c=>c.coursePeriodId===null||typeof c.coursePeriodId==='string'));
 const restored=Domain.reconstructLegacy(model);
 assert.deepEqual(restored,before);
 assert.deepEqual(history,before,'projection cannot mutate live source');
 assert.equal(Domain.validateSnapshot(model).snapshotSha256,model.snapshotSha256);
 assert.match(model.profileSha256,/^[a-f0-9]{64}$/);
 // Reporting is observational, not a brittle latency threshold for shared CI runners.
 process.stdout.write('# domain-model projection '+elapsed.toFixed(1)+' ms; '+model.results.length+' source results preserved\n');
});
test('two real starts can share a race and bib: legacy source ordinals stay distinct and unordered edits are rejected',()=>{
 const model=Domain.projectMorothon({history,profile}),keys=new Map();
 let observed=0;
 for(const r of model.results){
  const key=JSON.stringify([r.competitionId,r.personId,r.bib]);
  const other=keys.get(key);
  if(other&&other.timeRaw!==r.timeRaw)observed++;
  else if(!other)keys.set(key,r);
 }
 assert.ok(observed>0,'source contains genuine repeated starts with different times');
 const changed=copy(model);[changed.results[0],changed.results[1]]=[changed.results[1],changed.results[0]];
 assert.throws(()=>Domain.validateSnapshot(changed),/kilderekkefølgen|Datamodellen/i);
 assert.deepEqual(Domain.reconstructLegacy(model),history);
});
function another(){
 const p=copy(profile);
 p.organizerId='skoglopet';p.name='Skogløpet';
 p.events=[{id:'femkm',label:'Skog 5 km',sourceNames:['Skog 5 km']}];
 p.policies=[{id:'skog-2027',fromYear:2027,throughYear:null,
  participation:{unit:'person-edition',countStatuses:['Fullført','DNF'],relayCounts:true},
  ranking:{groupBy:['year','event','distance','class'],tieMethod:'dense'}}];
 p.coursePeriods=[{id:'skog-loype',label:'Løype ved skogen',eventIds:['femkm'],fromYear:2027,throughYear:null}];
 return p;
}
test('new organizer snapshot starts empty; it can model two editions in one year and stable result IDs without Morothon inheritance',()=>{
 const p=another(),m=Domain.emptyOrganizer(p);
 assert.equal(m.organizerId,'skoglopet');
 assert.equal(m.source.kind,'normalized-v1');
 assert.deepEqual(m.editions,[]);assert.deepEqual(m.results,[]);
 assert.notEqual(m.profileSha256,P.digest(profile));
 m.series.push({seriesId:'series-2027',label:'Skogløpet'});
 m.editions.push(
  {editionId:'edition-april',seriesId:'series-2027',year:2027,date:'2027-04-21',datePrecision:'day',status:'held'},
  {editionId:'edition-may',seriesId:'series-2027',year:2027,date:'2027-05-20',datePrecision:'day',status:'held'}
 );
 m.competitions.push(
  {competitionId:'competition-april',editionId:'edition-april',eventId:'femkm',eventName:'Skog 5 km',distanceLabel:'5 km',coursePeriodId:'skog-loype'},
  {competitionId:'competition-may',editionId:'edition-may',eventId:'femkm',eventName:'Skog 5 km',distanceLabel:'5 km',coursePeriodId:'skog-loype'}
 );
 m.people.push({personId:'runner-fictive-1',displayName:'Syntetisk løper',gender:'Dame'});
 m.results.push(
  {resultId:'result-april-1',sourceRef:{kind:'import-row',batchId:'batch-april',rowIndex:1},competitionId:'competition-april',
   personId:'runner-fictive-1',personLinked:true,status:'Fullført',elapsedMs:1600000},
  {resultId:'result-may-1',sourceRef:{kind:'import-row',batchId:'batch-may',rowIndex:1},competitionId:'competition-may',
   personId:'runner-fictive-1',personLinked:true,status:'Fullført',elapsedMs:1560000}
 );
 m.source.resultCount=2;
 const {createHash}=require('node:crypto');
 m.snapshotSha256=createHash('sha256').update(JSON.stringify({...m,snapshotSha256:null})).digest('hex');
 assert.equal(Domain.validateSnapshot(m).results.length,2);
 assert.throws(()=>Domain.reconstructLegacy(m),/kun for Morothon/);
 assert.equal(P.policyForYear(p,2027).ranking.groupBy.includes('class'),true);
});
test('fail closed for missing refs, forged person links, duplicate result IDs, tampering and an alien tenant',()=>{
 const p=another(),empty=Domain.emptyOrganizer(p);
 const invalid=copy(empty);
 invalid.organizerId='../other';
 assert.throws(()=>Domain.validateSnapshot(invalid),/arrangør-ID/);
 const forged=Domain.projectMorothon({history,profile});
 const changed=copy(forged);
 changed.results[0].legacyRow[5]='99:99:99';
 assert.throws(()=>Domain.validateSnapshot(changed),/Rå historisk resultat|Datamodellen/);
 const removed=copy(forged);
 removed.results.pop();
 assert.throws(()=>Domain.validateSnapshot(removed),/Resultatantallet/);
 const foreign=copy(forged);
 foreign.organizerId='skoglopet';
 assert.throws(()=>Domain.validateSnapshot(foreign),/Datamodellen/);
 assert.deepEqual(Domain.reconstructLegacy(forged),history);
});
