// All runner names and results in search tests are synthetic. No link is saved.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHonorAdminRoster}=require('../scripts/admin/honor-roster.cjs');
const {findHonorRunnerCandidates}=require('../scripts/admin/honor-runner-search.cjs');
const F=require('./public/quick/fixtures/corrections-data.js');
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
function roster(){
 const honors=load('honors.json');
 return createHonorAdminRoster({organizerId:'morothon',enabled:true,
  honors,volunteers:load('volunteers.json'),
  editionYears:honors.presentationPrintSet.editionYears});
}
test('Heder participant search suggests multiple IDs, never merges people with matching names',()=>{
 const r=roster(),history=F.history(),snapshot=structuredClone(r),source=structuredClone(history);
 const result=findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',query:'Syntetisk Samme Navn'});
 assert.equal(result.candidates.length,2);
 assert.deepEqual(result.candidates.map(p=>p.runnerId).sort(),['MOR-C220003','MOR-C220004']);
 assert.ok(result.candidates.every(p=>p.matchKind==='exact'));
 assert.equal(result.confirmationRequired,true);
 assert.equal(result.identityLinkedAutomatically,false);
 assert.equal(result.volunteerYearsAffected,false);
 assert.deepEqual(r,snapshot);
 assert.deepEqual(history,source);
});
test('Heder participant search supports aliases, unchanged confirmed links and no guessed associations',()=>{
 const r=roster(),history=F.history();
 const result=findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',query:'syntetisk gammelt etternavn'});
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].runnerId,'MOR-C220001');
 assert.equal(result.candidates[0].participationCount,3);
 const person=r.people.find(p=>p.id==='jon-fjeld');
 assert.equal(person.runnerLink.confirmed,true,'previously confirmed runner link is retained');
 assert.equal(person.runnerLink.runnerId,'MOR-EFAFF95');
 assert.equal(result.candidates[0].linkedToThisHonor,false,'a suggested alias is not a confirmed link');
});
test('Heder participant search marks runner IDs already associated with other Heder records',()=>{
 const r=roster(),history=F.history();
 const member=r.people.find(p=>p.id==='rune-bergjord');
 member.runnerLink={runnerId:'MOR-C220003',confirmed:true,sourceIds:['synthetic-provenance']};
 const res=findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',query:'Samme Navn'});
 const matched=res.candidates.find(p=>p.runnerId==='MOR-C220003');
 assert.equal(matched.linkedToOtherHonor,true);
 assert.equal(matched.linkedToThisHonor,false);
 assert.equal(res.candidates.find(p=>p.runnerId==='MOR-C220004').linkedToOtherHonor,false);
});
test('Heder participant lookup rejects invalid person and excessive or malformed queries',()=>{
 const r=roster(),history=F.history();
 assert.throws(()=>findHonorRunnerCandidates({roster:r,history,personId:'erling-danielsen',query:'Syntetisk'}),/aktivt Heder-register/);
 assert.throws(()=>findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',query:'a'.repeat(101)}),/Søketekst/);
 assert.throws(()=>findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',limit:100}),/antall/);
 assert.deepEqual(findHonorRunnerCandidates({roster:r,history,personId:'jon-fjeld',query:'A'}).candidates,[]);
});

test('new Heder person can search existing runners before creating an honor record',()=>{
 const r=roster(),history=F.history();
 const result=findHonorRunnerCandidates({roster:r,history,query:'Syntetisk Kari'});
 assert.equal(result.personId,null);
 assert.deepEqual(result.candidates.map(p=>p.runnerId).sort(),['MOR-C220001','MOR-C220002']);
 assert.equal(result.confirmationRequired,true);
 assert.equal(result.identityLinkedAutomatically,false);
 assert.throws(()=>findHonorRunnerCandidates({roster:r,history}),/Oppgi et søk/);
});
