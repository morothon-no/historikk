'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),
 {setup:source,userId,organizer}=require('./helpers/result-publication.cjs'),A=require('../scripts/admin/annual-result-import.cjs'),
 {privateAnnualImportFileStore,createAnnualImportReview}=require('../scripts/admin/annual-import-review.cjs'),
 {createAnnualPublication}=require('../scripts/admin/serverless/annual-publication.cjs'),{digest}=require('../scripts/admin/serverless/annual-publication-policy.cjs'),
 D=require('../tools/diploma-admin/result-release-data.cjs');
async function setup(t){
 const f=await source(t);Object.assign(f.context,{organizer,personIdPrefix:'MOR-',profile:require('../web-admin/event-profile.json'),registry:require('../public-data/data/badges.json')});
 const store=privateAnnualImportFileStore({directory:path.join(f.directory,'annual'),key:f.key}),authenticate=async s=>f.sessions.get(s),loadContext=async()=>f.context,
  review=createAnnualImportReview({authenticate,loadContext,store}),options={enabled:true,authenticate,authorizeActor:async id=>assert.equal(id,userId),store,stateStore:f.stateStore,loadContext,
   adapter:f.adapter,directory:f.directory,checkBuild:async()=>({version:'f'.repeat(16),siteUrl:'https://synthetic.example.test/',files:{}}),
   verifyLive:async()=>{if(!f.remote.live)throw Object.assign(Error('Synthetic pending'),{pending:true});return true;},
   onPublished:async()=>{f.context.history=JSON.parse(f.repository.files.get('data/history.json'));f.context.base=await f.bind(f.repository.files);return f.context.base;}},pub=createAnnualPublication(options);
 const request=A.request({organizer,base:f.context.base,year:2027,completeClaim:true,text:'Navn;Øvelse;Distanse;Kjønn;Status;Tid;Plass;Startnummer\nSyntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;101\nSyntetisk Ny Eksempel;Morothon;20 km;Dame;DNF;1:20:00;2;102\nSyntetisk Uten Start;Kortmoro;10 km;Herre;DNS;DNS;;103'}),plan=await A.prepare(f.context,request);
 request.decisions=plan.identityTasks.map((p,i)=>({rowId:p.rowId,basis:plan.interpretationSha256,action:i?'new-person':'existing',runnerId:i?null:'MOR-C220001',targetIndex:null,personKey:i?'synthetic-new-person':null,confirmDistinct:false,reason:'Kontrollert syntetisk kilde.'}));
 async function save(input=request){const p=await store.get(organizer);return review.save({...f.input,input,expectedRevision:p?.revision||0,expectedDigest:p?.digest||null,replaceCurrent:false});}
 const bound=async()=>{const p=await store.get(organizer);return {...f.input,expectedRevision:p?.revision||0,expectedDigest:digest(p)};};
 async function approve(){const report=await pub.preview(await bound());await pub.approve({...await bound(),candidateDigest:report.candidateDigest});return report;}
 async function complete(){f.remote.checks='success';f.remote.deploy='success';for(let i=0;i<8;i++){await pub.progress(f.input);if((await pub.status(f.input)).job?.stage==='published')return;}assert.fail(JSON.stringify((await pub.status(f.input)).job));}
 return {...f,store,review,pub,options,request,save,bound,approve,complete};
}
test('annual publication uses the existing outbox, preserves exact historical bytes and private sources, and reverses only after new approval',async t=>{
 const f=await setup(t),original=structuredClone(f.context.history);await f.save();const report=await f.approve();assert.equal(report.ready,true);assert.ok(report.effects.people);
 const job=await f.pub.publish(await f.bound());assert.equal(job.backupVerified,true);assert.equal(f.remote.submitted,0);await f.complete();assert.equal(f.remote.merged,1);
 const h=f.context.history;assert.equal(h.people.length,original.people.length+1);assert.deepEqual(h.results.slice(0,original.results.length),original.results);
 assert.deepEqual(h.yearStats.at(-1),[2027,3,2,2,1,1,1,1,1,0]);assert.equal(h.results.at(-1)[4],'DNF');assert.equal(h.results.at(-1)[5],'');
 const stored=await f.store.get(organizer);assert.equal(stored.annualImport,null);assert.deepEqual(stored.archives[0].input,f.request);
 const journal=JSON.parse(f.repository.files.get('tests/public/quick/fixtures/result-publications.json'));assert.equal(journal.schemaVersion,3);assert.deepEqual(D.undoPublishedResults(D.encode(h),journal),D.encode(original));
 await f.pub.reverse({...await f.bound(),id:job.id});await assert.rejects(f.pub.publish(await f.bound()),/Godkjenn/);await f.approve();await f.pub.publish(await f.bound());await f.complete();
 assert.deepEqual(f.context.history,original);assert.equal(f.remote.merged,2);assert.deepEqual((await f.store.get(organizer)).archives[0].input,f.request);
});
test('annual approvals reject unresolved identities, forged candidates, stale revisions, missing completeness and unauthorized access',async t=>{
 const f=await setup(t);await assert.rejects(createAnnualPublication({...f.options,enabled:false}).preview(await f.bound()),/ikke aktivert/);
 const unresolved=structuredClone(f.request);unresolved.decisions=[];await f.save(unresolved);await assert.rejects(f.pub.preview(await f.bound()),/Avklar/);
 const p=await f.store.get(organizer);await f.review.save({...f.input,input:f.request,expectedRevision:p.revision,expectedDigest:p.digest,replaceCurrent:false});
 const before=await f.store.get(organizer),b=await f.bound(),r=await f.pub.preview(b);await assert.rejects(f.pub.preview({...b,session:'viewer'}));
 await assert.rejects(f.pub.approve({...b,candidateDigest:'f'.repeat(64)}),/eksakte/);await assert.rejects(f.pub.approve({...b,expectedRevision:0,candidateDigest:r.candidateDigest}),/endret/);
 assert.deepEqual(await f.store.get(organizer),before);const incomplete=structuredClone(f.request);incomplete.source.completeClaim=false;const ip=await A.prepare(f.context,{...incomplete,decisions:[]});incomplete.decisions.forEach(d=>d.basis=ip.interpretationSha256);
 await f.review.save({...b,input:incomplete,replaceCurrent:true});await assert.rejects(f.pub.preview(await f.bound()),/komplett/);assert.equal(f.remote.submitted,0);
});
test('failed CI, uncertain live results and repeated authorization never become published or lose the private import',async t=>{
 const f=await setup(t);await f.save();await f.approve();const bound=await f.bound(),job=await f.pub.publish(bound);await assert.rejects(f.pub.publish(bound));
 await f.pub.progress(f.input);f.remote.checks='failed';await f.pub.progress(f.input);assert.equal((await f.pub.status(f.input)).job.stage,'failed');assert.equal(f.remote.merged,0);assert.ok((await f.store.get(organizer)).annualImport);
 await f.pub.retry({...f.input,id:job.id});f.remote.checks='success';f.remote.deploy='success';f.remote.live=false;for(let i=0;i<4;i++)await f.pub.progress(f.input);
 assert.equal((await f.pub.status(f.input)).job.stage,'verifying');assert.ok((await f.store.get(organizer)).annualImport);assert.equal(f.remote.merged,1);
 f.remote.live=true;await f.pub.progress(f.input);assert.equal((await f.pub.status(f.input)).job.stage,'published');assert.equal(f.remote.merged,1);
});
test('reimport after publication adds no duplicates, a corrected file changes the exact row and a newer correction blocks unsafe year rollback',async t=>{
 const f=await setup(t);await f.save();await f.approve();const first=await f.pub.publish(await f.bound());await f.complete();
 const published=structuredClone(f.context.history),input=structuredClone(f.request);input.base=structuredClone(f.context.base);input.decisions=[];
 const repeated=await A.prepare(f.context,input);assert.equal(repeated.hasChanges,false);assert.equal(repeated.summary.unchanged,2);
 await f.save(input);await assert.rejects(f.pub.preview(await f.bound()),/faktisk endring/);assert.deepEqual(f.context.history,published);
 const corrected=structuredClone(input);corrected.source.data=Buffer.from(Buffer.from(input.source.data,'base64').toString().replace('49:20','48:50')).toString('base64');
 const plan=await A.prepare(f.context,corrected);corrected.decisions=plan.identityTasks.map(p=>({rowId:p.rowId,basis:plan.interpretationSha256,action:'existing',runnerId:'MOR-C220001',targetIndex:p.beforeIndex,personKey:null,confirmDistinct:false,reason:'Bekreftet syntetisk tidsrettelse.'}));
 // The row selector is obtained from the immutable plan, not a guessed index.
 for(const d of corrected.decisions)d.targetIndex=plan.operations.find(o=>o.rowId===d.rowId)?.beforeIndex??f.context.history.results.findIndex(r=>r[0]===2027&&r[1]==='MOR-C220001');
 await f.review.save({...await f.bound(),input:corrected,replaceCurrent:true});await f.approve();await f.pub.publish(await f.bound());await f.complete();
 assert.equal(f.context.history.people.length,published.people.length);assert.equal(f.context.history.results.length,published.results.length);assert.equal(f.context.history.results.find(r=>r[0]===2027&&r[1]==='MOR-C220001')[5],'48:50');
 await assert.rejects(f.pub.reverse({...await f.bound(),id:first.id}),/nyere/);assert.equal(f.remote.merged,2);
});
test('approval binds the complete server consequence report, not only the resulting history bytes',async t=>{
 const f=await setup(t);await f.save();await f.approve();const before=await f.store.get(organizer),project=f.context.project;
 f.context.project=async h=>({...await project(h),rankings:h.yearStats.some(r=>r[0]===2027)?{'MOR-C220001':1}:{}});
 await assert.rejects(f.pub.publish(await f.bound()),/annet før-/);assert.equal(f.remote.submitted,0);assert.deepEqual(await f.store.get(organizer),before);
});
