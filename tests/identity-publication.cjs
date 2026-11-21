'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {setup,userId,organizer}=require('./helpers/result-publication.cjs'),
 {createIdentityReview,privateIdentityFileStore}=require('../scripts/admin/identity-review.cjs'),
 {createIdentityPublication}=require('../scripts/admin/serverless/identity-publication.cjs'),
 {digest}=require('../scripts/admin/serverless/identity-publication-policy.cjs'),D=require('../tools/diploma-admin/result-release-data.cjs'),H=require('../js/history-data.js');
async function fixture(t,{enabled=true,history}={}){
 const f=await setup(t,{...(history?{history}:{})}),store=privateIdentityFileStore({directory:path.join(f.directory,'identities'),key:f.key}),
  authenticate=async key=>f.sessions.get(key),loadContext=async()=>f.context,identity=createIdentityReview({authenticate,loadContext,store}),
  options={enabled,authenticate,authorizeActor:async id=>{assert.equal(id,userId);},identity,store,stateStore:f.stateStore,loadContext,adapter:f.adapter,directory:f.directory,
   verifyLive:async()=>{if(!f.remote.live)throw Object.assign(Error('Syntetisk gammel side'),{pending:true});return true;},
   onPublished:async()=>{f.context.history=JSON.parse(f.repository.files.get('data/history.json'));f.context.base=await f.bind(f.repository.files);return f.context.base;},
   checkBuild:async()=>({version:'f'.repeat(16),siteUrl:'https://synthetic.example.test/',files:{}})},
  publication=createIdentityPublication(options),input=f.input;
 let n=0;
 const command=(kind,ids=['MOR-C220001','MOR-C220002'])=>({format:'morothon-identity-decision-v1',version:1,id:'synthetic-'+(++n),base:structuredClone(f.context.base),kind,
  personIds:ids,mainPersonId:kind==='same-person'?ids[1]:null,name:null,source:'Syntetisk arrangørbekreftelse',reason:'Syntetisk kontrollert identitet.'});
 const revision=async()=>{const p=await store.get(organizer);return {...input,expectedRevision:p?.revision||0,expectedDigest:digest(p)};};
 async function approve(){const preview=await publication.preview(await revision());await publication.approve({...await revision(),candidateDigest:preview.candidateDigest});return preview;}
 async function complete(){f.remote.checks='success';f.remote.deploy='success';for(let i=0;i<8;i++){await publication.progress(input);if((await publication.status(input)).job?.stage==='published')return;}
  assert.fail(JSON.stringify((await publication.status(input)).job));}
 return {...f,store,identity,publication,options,command,revision,approve,complete};
}
test('stored merges publish through the existing outbox, retain different/deferred cases and exact results, survive restart and reverse with new approval',async t=>{
 const f=await fixture(t),original=structuredClone(f.context.history),commands=[f.command('same-person'),f.command('different-people',['MOR-C220003','MOR-C220004']),f.command('defer',['MOR-C220003','MOR-C220005'])];
 await f.identity.decideBatch({...f.input,expectedRevision:0,commands});
 const view=await f.approve();assert.equal(view.merges,1);assert.equal(view.retained.deferred,1);assert.equal(view.retained.different,1);
 assert.equal(view.after.profiles['MOR-C220002'].count,5);assert.equal(view.after.profiles['MOR-C220002'].name,'Syntetisk Kari N. Nord');
 const first=await f.publication.publish(await f.revision());assert.equal(first.backupVerified,true);assert.equal(f.remote.submitted,0);
 await f.complete();assert.equal(f.remote.submitted,1);assert.equal(f.remote.merged,1);
 assert.deepEqual(f.context.history.results,original.results);assert.deepEqual(f.context.history.people,original.people);assert.deepEqual(f.context.history.yearStats,original.yearStats);
 assert.equal(H.resolveId('MOR-C220001',f.context.history.redirects),'MOR-C220002');
 const stored=await f.store.get(organizer);assert.equal(stored.draft.cases.length,2);assert.equal(stored.draft.cases.filter(c=>c.status==='rejected').length,1);
 assert.equal(stored.archives[0].draft.cases.length,3);assert.equal(stored.status,'draft');
 const restarted=createIdentityPublication(f.options);assert.equal((await restarted.status(f.input)).job.stage,'published');
 await f.publication.reverse({...await f.revision(),id:first.id});assert.equal(f.remote.submitted,1);
 await assert.rejects(f.publication.publish(await f.revision()),/Godkjenn/);await f.approve();
 await f.publication.publish(await f.revision());await f.complete();assert.deepEqual(f.context.history,original);assert.equal(f.remote.merged,2);
 assert.equal((await f.store.get(organizer)).draft.cases.length,2);
});
test('activation, authorization, exact revision/digest/candidate, no-merge selections and stale source all fail closed',async t=>{
 const f=await fixture(t);await assert.rejects(f.publication.preview(await f.revision()),/revisjonen/);
 await f.identity.decide({...f.input,expectedRevision:0,command:f.command('same-person')});
 const before=await f.store.get(organizer),request=await f.revision(),preview=await f.publication.preview(request);
 await assert.rejects(createIdentityPublication({...f.options,enabled:false}).preview(request),/ikke aktivert/);
 await assert.rejects(f.publication.preview({...request,session:'viewer'}));
 await assert.rejects(f.publication.approve({...request,candidateDigest:'f'.repeat(64)}),/før-/);
 await assert.rejects(f.publication.approve({...request,expectedRevision:request.expectedRevision-1,candidateDigest:preview.candidateDigest}),/revisjonen/);
 assert.deepEqual(await f.store.get(organizer),before);assert.equal(f.remote.submitted,0);
 await f.approve();const approved=await f.revision();f.context.base={...f.context.base,dataVersion:f.context.base.dataVersion+1};
 await assert.rejects(f.publication.publish(approved),/revisjonen/);assert.equal(f.remote.submitted,0);
});
test('failed CI and stale live verification cannot become published; repeated authorization cannot create a second merge',async t=>{
 const f=await fixture(t);await f.identity.decide({...f.input,expectedRevision:0,command:f.command('same-person')});await f.approve();
 const authorized=await f.revision();await f.publication.publish(authorized);await assert.rejects(f.publication.publish(authorized));
 await f.publication.progress(f.input);f.remote.checks='failed';await f.publication.progress(f.input);
 assert.equal((await f.publication.status(f.input)).job.stage,'failed');assert.equal(f.remote.merged,0);
 const job=(await f.publication.status(f.input)).job;await f.publication.retry({...f.input,id:job.id});
 f.remote.checks='success';f.remote.deploy='success';f.remote.live=false;
 for(let i=0;i<4;i++)await f.publication.progress(f.input);
 assert.equal((await f.publication.status(f.input)).job.stage,'verifying');assert.equal(f.remote.merged,1);
 assert.equal((await f.store.get(organizer)).archives?.length||0,0);
 f.remote.live=true;await f.publication.progress(f.input);assert.equal((await f.publication.status(f.input)).job.stage,'published');assert.equal(f.remote.merged,1);
});
test('multiple confirmed merges are atomic; current negatives and follow-ups still constrain the complete candidate',async t=>{
 const history=require('./public/quick/fixtures/corrections-data.js').history();
 history.people.push({...history.people[4],i:'MOR-C220006',n:'Syntetisk Status Looper',c:1});
 history.results.push([2023,'MOR-C220006','Morothon','20 km','Fullført','1:50:00',1,'M','','']);
 const f=await fixture(t,{history}),original=structuredClone(history);
 await f.identity.decideBatch({...f.input,expectedRevision:0,commands:[f.command('same-person'),
  f.command('same-person',['MOR-C220005','MOR-C220006']),f.command('different-people',['MOR-C220003','MOR-C220004'])]});
 const report=await f.approve();assert.equal(report.merges,2);assert.equal(report.after.profiles['MOR-C220002'].count,5);
 assert.equal(report.after.profiles['MOR-C220006'].count,3);await f.publication.publish(await f.revision());await f.complete();
 assert.equal(f.remote.merged,1);assert.deepEqual(f.context.history.results,original.results);
 assert.equal(H.create(f.context.history).people.size,4);
 const g=await fixture(t);await g.identity.decideBatch({...g.input,expectedRevision:0,commands:[g.command('different-people',['MOR-C220001','MOR-C220005'])]});
 await assert.rejects(g.identity.decideBatch({...g.input,expectedRevision:1,commands:[g.command('same-person'),g.command('same-person',['MOR-C220002','MOR-C220005'])]}));
 assert.equal((await g.store.get(organizer)).draft.cases.length,1);assert.equal(g.remote.merged,0);
});
test('a stale approval can be cancelled without losing decisions, while newer related private evidence stops reversal',async t=>{
 const f=await fixture(t);await f.identity.decide({...f.input,expectedRevision:0,command:f.command('same-person')});await f.approve();
 const before=await f.store.get(organizer),approved=await f.revision();f.context.base={...f.context.base,dataVersion:f.context.base.dataVersion+1};
 await f.publication.cancel(approved);assert.deepEqual((await f.store.get(organizer)).draft,before.draft);assert.equal((await f.store.get(organizer)).approval,null);
 const g=await fixture(t);await g.identity.decide({...g.input,expectedRevision:0,command:g.command('same-person')});await g.approve();
 const job=await g.publication.publish(await g.revision());await g.complete();
 await g.identity.decide({...g.input,expectedRevision:(await g.store.get(organizer)).revision,command:g.command('defer',['MOR-C220002','MOR-C220005'])});
 await assert.rejects(g.publication.reverse({...await g.revision(),id:job.id}),/Nyere private/);assert.equal(g.remote.merged,1);
});
