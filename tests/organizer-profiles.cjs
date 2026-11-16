// Product-foundation tests: public Morothon profile metadata and fictional people only.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Profile=require('../scripts/organizers/profile.cjs');
const {createReleasePlanner}=require('../scripts/admin/release-plan.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;
const H=require('../js/history-data.js');
const F=require('./public/quick/fixtures/corrections-data.js');
const root=path.resolve(__dirname,'..');
const morothon=JSON.parse(fs.readFileSync(path.join(root,'organizers/morothon/profile.json'),'utf8'));
const clone=x=>structuredClone(x);
const actor={subject:'synthetic-organizer-editor',organizers:{morothon:['review']}};
const supported=p=>p.organizerId==='morothon'&&p.participation.unit==='person-year'&&
 p.participation.relayCounts===false&&p.ranking.groupBy.join('|')==='year|event|distance|gender'&&p.ranking.tieMethod==='competition';
async function project(h){
 const m=H.create(h);
 return {
  people:Object.fromEntries([...m.people].map(([id,p])=>[id,{name:p.n,years:m.stats(id)?.years||[]}])),
  annual:{},records:[],
  placements:h.results.map((r,index)=>({index,personId:m.resolve(r[1]),year:r[0],
   event:r[2],distance:r[3],className:r[7]||'',bib:r[9]||'',time:r[5],
   rank:m.classPlaces.get(r)??null,sourcePlace:H.sourcePlace(r)})),
  rankings:{},diplomas:{},loyalty:{},redirects:h.redirects||{},aliases:h.aliases||{}
 };
}
const makePlanner=async({profile=morothon,history=F.history(),adapterSupports=supported,principal=actor}={})=>{
 const base=await C.binding(history,F.meta);
 const planner=createReleasePlanner({
  authenticate:async session=>session==='synthetic-session'?principal:null,
  loadTrustedContext:async org=>({profile,history,base,
   adapter:{id:'synthetic-legacy-contract-test',supports:adapterSupports,project},
   linkedRunnerIds:[]})
 });
 const ids=['MOR-C220001','MOR-C220002'];
 let packageDraft=C.report(C.empty(base),{id:'synthetic-merge',category:'Mulige duplikater',
  personIds:ids,description:'Two fictional aliases',source:'Synthetic test evidence'});
 packageDraft=await C.propose(history,packageDraft,'synthetic-merge',{
  kind:'merge',personIds:ids,source:'Synthetic test evidence',reason:'Fictional identities were externally checked.'
 });
 return {planner,packageDraft,history,base};
};
test('profile v1 preserves Morothon current policies and keeps unusual historical events visible',()=>{
 const p=Profile.validateProfile(morothon);
 assert.equal(p.organizerId,'morothon');
 assert.equal(p.timeZone,'Europe/Oslo');
 assert.deepEqual(Profile.policyForYear(p,1992).ranking.groupBy,['year','event','distance','gender']);
 assert.deepEqual(Profile.policyForYear(p,2026).participation.countStatuses,['Fullført','DNF','Disket','DQ']);
 assert.equal(Profile.eventBySource(p,'Morothon').id,'langmoro');
 assert.equal(Profile.eventBySource(p,'Junior').id,'ungdom');
 assert.equal(Profile.eventBySource(p,'Kort Kortmoro').id,'kort-kortmoro');
 assert.equal(Profile.recordPeriod(p,2013,'langmoro').id,'langmoro-legacy');
 assert.equal(Profile.recordPeriod(p,2014,'langmoro').id,'langmoro-modern');
 assert.equal(Profile.recordPeriod(p,2026,'ungdom'),null,'never fabricate an unknown junior course period');
 const history=JSON.parse(fs.readFileSync(path.join(root,'public-data/data/history.json'),'utf8'));
 const events=[...new Set(history.results.map(row=>row[2]))];
 for(const name of events)assert.ok(Profile.eventBySource(p,name),name);
 const copy=clone(morothon);copy.events.reverse();
 assert.notDeepEqual(Profile.validateProfile(copy).events,p.events);
 assert.deepEqual(morothon.events.map(e=>e.id),['langmoro','kortmoro','kort-kortmoro','ungdom'],
  'validator never mutates source profile');
 assert.match(Profile.digest(morothon),/^[a-f0-9]{64}$/);
 const reordered=Object.fromEntries(Object.entries(morothon).reverse());
 assert.equal(Profile.digest(morothon),Profile.digest(reordered),'semantic profile digest ignores JSON key order');
});
test('another organizer config can choose age-class rankings and own course periods without inheriting Morothon defaults',()=>{
 const other=clone(morothon);
 other.organizerId='skoglopet';other.name='Skogløpet';
 other.events=[{id:'skog-fem',label:'Skogløpet 5 km',sourceNames:['Skog 5 km']}];
 other.policies=[{id:'skog-policy-2020',fromYear:2020,throughYear:null,
  participation:{unit:'person-edition',countStatuses:['Fullført','DNF'],relayCounts:true},
  ranking:{groupBy:['year','event','distance','class'],tieMethod:'dense'}}];
 other.coursePeriods=[{id:'skog-trasé',label:'Løypa rundt tjernet',eventIds:['skog-fem'],fromYear:2020,throughYear:null}];
 const p=Profile.validateProfile(other);
 assert.equal(Profile.policyForYear(p,2025).ranking.groupBy.includes('gender'),false);
 assert.equal(Profile.recordPeriod(p,2025,'skog-fem').id,'skog-trasé');
 assert.equal(Profile.eventBySource(p,'Skog 5 km').id,'skog-fem');
 assert.notEqual(Profile.digest(other),Profile.digest(morothon));
 assert.throws(()=>Profile.policyForYear(p,2015),/Ingen entydig regelperiode/);
 assert.throws(()=>Profile.eventBySource(p,'Morothon'),/ikke konfigurert/);
});
test('profile rejects overlapping rule/course eras, ambiguous source names, unsafe identifiers and unknown fields',()=>{
 const changed=mutate=>{const p=clone(morothon);mutate(p);assert.throws(()=>Profile.validateProfile(p));};
 changed(p=>p.organizerId='../kunde');
 changed(p=>p.events.push({...p.events[0],id:'another'}));
 changed(p=>p.policies.push({...p.policies[0],id:'another-policy',fromYear:2020}));
 changed(p=>p.coursePeriods.push({...p.coursePeriods[0],id:'overlap',fromYear:2010}));
 changed(p=>p.events[0].sourceNames=['Morothon','Kortmoro']);
 changed(p=>p.events[0].label='<script>');
 changed(p=>p.import.formats=['eqtiming','untrusted-executable-importer']);
 changed(p=>p.policies[0].ranking.groupBy=['year','event','distance']);
 changed(p=>p.badges.registry='../secret.json');
 changed(p=>p.extraCustomerData='sensitive');
});
test('release plan is read-only, organizer-scoped, source-bound and explicitly not a publication approval',async()=>{
 const {planner,packageDraft,history,base}=await makePlanner(),snapshot=clone(history),draft=clone(packageDraft);
 const receipt=await planner.preview({session:'synthetic-session',organizer:'morothon',corrections:packageDraft});
 assert.equal(receipt.kind,'organizer-release-review-v1');
 assert.equal(receipt.organizerId,'morothon');
 assert.equal(receipt.profileSha256,Profile.digest(morothon));
 assert.equal(receipt.sourceBinding.snapshotSha256,base.snapshotSha256);
 assert.equal(receipt.proposals,1);
 assert.equal(receipt.reviewPassed,true,receipt.blockers.join(' '));
 assert.equal(receipt.productionApplied,false);
 assert.equal(receipt.publicationAuthorized,false);
 assert.equal(receipt.readyForPublication,false);
 assert.equal(receipt.policies[0].policyId,'morothon-legacy-year-rules-v1');
 assert.equal(typeof planner.apply,'undefined');assert.equal(typeof planner.publish,'undefined');
 assert.deepEqual(history,snapshot);
 assert.deepEqual(packageDraft,draft);
});
test('release planner fails closed on unauthorized tenants, stale source, profile mismatch and unimplemented ranking adapters',async()=>{
 const {planner,packageDraft,history}=await makePlanner();
 await assert.rejects(()=>planner.preview({session:'invalid',organizer:'morothon',corrections:packageDraft}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>planner.preview({session:'synthetic-session',organizer:'other-org',corrections:packageDraft}),/Ingen bekreftet tilgang/);
 const altered=clone(packageDraft);altered.base.dataVersion++;
 await assert.rejects(()=>planner.preview({session:'synthetic-session',organizer:'morothon',corrections:altered}),/annen historikkversjon/);
 const mismatched=await makePlanner({profile:{...morothon,organizerId:'wrong-tenant'}});
 await assert.rejects(()=>mismatched.planner.preview({session:'synthetic-session',organizer:'morothon',corrections:mismatched.packageDraft}),/annen arrangør/);
 const unsupported=await makePlanner({adapterSupports:()=>false});
 await assert.rejects(()=>unsupported.planner.preview({session:'synthetic-session',organizer:'morothon',corrections:unsupported.packageDraft}),/støttes ikke/);
 const empty=await makePlanner();
 await assert.rejects(()=>empty.planner.preview({session:'synthetic-session',organizer:'morothon',corrections:C.empty(await C.binding(history,F.meta))}),/Ingen konkrete/);
 assert.deepEqual(history,F.history(),'no rejection writes original data');
});
