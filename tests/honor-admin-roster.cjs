// Phase A: internal Heder admin projection regression. No public route or write.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHonorAdminRoster}=require('../scripts/admin/honor-roster.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
const load=()=>{
 const honors=read('honors.json'),volunteers=read('volunteers.json');
 return {organizerId:'morothon',enabled:true,honors,volunteers,
  editionYears:honors.presentationPrintSet.editionYears};
};
test('Heder admin joins both original registers without changing any source data',()=>{
 const input=load(),original=structuredClone(input),roster=createHonorAdminRoster(input);
 assert.deepEqual(input,original,'projection cannot rewrite legacy registers');
 assert.equal(roster.readOnly,true);
 assert.equal(roster.publicationAuthorized,false);
 assert.equal(roster.editionBasis,'legacy-distinct-year');
 assert.equal(roster.summary.total,43,'12 valid source profiles plus 31 unique volunteers');
 assert.equal(roster.summary.publicEligible,43,'rejected source profile must not return to the admin roster');
 assert.equal(roster.summary.suppressedLegacy,1);
 assert.equal(roster.people.length,new Set(roster.people.map(p=>p.id)).size);
 assert.equal(roster.people.some(p=>p.id==='erling-danielsen'),false,'the erroneous person must stay out of the active roster');
 assert.ok(roster.suppressedLegacyIds.includes('erling-danielsen'));
 assert.ok(input.honors.groups.some(g=>g.members.some(m=>m.id==='erling-danielsen')),'source provenance is preserved unchanged');
 const erling=roster.people.find(p=>p.id==='erling-askildsen');
 assert.ok(erling.stories.length);
 assert.ok(erling.shortDescription);
 assert.equal(erling.sourceKind,'honor-group');
 assert.equal(roster.people.find(p=>p.id==='jon-fjeld').sourceKind,'volunteer-list');
 assert.ok(roster.people.find(p=>p.id==='jon-fjeld').roles.length);
});
test('Heder admin exposes existing tenure and badges without inventing award decisions',()=>{
 const roster=createHonorAdminRoster(load()),person=roster.people.find(p=>p.id==='dag-morten-frantzen');
 assert.equal(person.tenure.registeredEditions,13);
 assert.deepEqual(person.tenure.confirmedYears,[2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]);
 assert.ok(person.badges.qualified.includes('service-dugnad-10'));
 assert.equal(person.badges.automaticallyAwarded,false);
 const kalle=roster.people.find(p=>p.id==='kalle-kimestad');
 assert.equal(kalle.tenure.openPeriod,true,'open period is explicitly labelled as period, not confirmed years');
 assert.deepEqual(kalle.tenure.confirmedYears,[]);
 const atle=roster.people.find(p=>p.id==='atle-aamodt');
 assert.ok(atle.tenure.excludedYears.includes(2026));
 assert.equal(atle.tenure.years.includes(2026),false);
});
test('Til minne om remains separate and never gains inferred active service years',()=>{
 const input=load();
 const now=createHonorAdminRoster(input);
 const next=createHonorAdminRoster({...input,editionYears:[...input.editionYears,2027]});
 for(const id of ['floke-bredland','leif-wiig']){
  const a=now.people.find(p=>p.id===id),b=next.people.find(p=>p.id===id);
  assert.equal(a.memorial,true);assert.equal(a.tenure.openPeriod,false);
  assert.ok(a.memorialInfo);
  assert.equal(b.tenure.registeredEditions,a.tenure.registeredEditions);
  assert.deepEqual(b.tenure.years,a.tenure.years);
 }
 assert.ok(now.summary.memorial>=2);
});
test('disabled module retains all internal records without presenting them as public',()=>{
 const input=load(),active=createHonorAdminRoster(input),disabled=createHonorAdminRoster({...input,enabled:false});
 assert.equal(disabled.summary.publicAvailable,0);
 assert.equal(disabled.summary.total,active.summary.total);
 assert.deepEqual(disabled.people,active.people,'configuration must never delete Heder data');
 assert.equal(disabled.enabled,false);
 assert.equal(active.summary.publicAvailable,43);
});
test('invalid source, duplicate identity or invented year fails clearly',()=>{
 const input=load();
 assert.throws(()=>createHonorAdminRoster({...input,organizerId:'../other'}),/arrangør-ID/);
 assert.throws(()=>createHonorAdminRoster({...input,enabled:undefined}),/modulinnstilling/);
 assert.throws(()=>createHonorAdminRoster({...input,volunteers:null}),/dugnadslisten/);
 assert.throws(()=>createHonorAdminRoster({...input,editionYears:[2026,2027.1]}),/arrangementsår/);
 const duplicate=structuredClone(input);
 duplicate.honors.groups[0].members.push(structuredClone(duplicate.honors.groups[0].members[0]));
 assert.throws(()=>createHonorAdminRoster(duplicate),/Duplisert/);
});
