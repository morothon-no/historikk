'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/identity-serverless.cjs'),{organizer}=require('./helpers/result-publication.cjs');
const {createDriver}=require('../scripts/admin/serverless/driver.cjs'),{SCOPE}=require('../scripts/admin/identity-review.cjs');
const {ENABLED}=require('../scripts/admin/serverless/identity-publication-policy.cjs');
const view=async(f,session)=>(await f.request('/identity',undefined,session)).body;
const bound=s=>({expectedRevision:s.revision,expectedDigest:s.publication.digest});
async function run(f,session,action,extra={}){
 const request=await f.request('/identity/publication/'+action,{...bound(await view(f,session)),...extra},session);
 assert.equal(request.status,202,JSON.stringify(request.body));const result=await f.processNext();
 assert.equal(result.completed,true,JSON.stringify((await view(f,session)).task));return view(f,session);
}
async function decision(f,session){assert.equal((await f.request('/identity/batch',{expectedRevision:0,commands:[f.command(),
 f.command('different-people',{personIds:['MOR-C220003','MOR-C220004']}),
 f.command('defer',{personIds:['MOR-C220003','MOR-C220005']})]},session)).status,202);assert.equal((await f.processNext()).completed,true);}
test('default-off broker and private driver reject every publication action and cannot lease dormant identity-write tasks',async t=>{
 assert.equal(ENABLED,false);const f=await setup(t),session=await f.login();
 assert.equal((await f.request('/session',undefined,session)).body.identityPublicationEnabled,false);
 for(const action of ['check','approve','publish','continue','reverse','cancel'])assert.equal((await f.request('/identity/publication/'+action,{},session)).status,404);
 assert.equal(f.dispatches.length,0);assert.equal(f.remote.submitted,0);
 const id='a'.repeat(32),task={id,v:1,revision:1,action:'identity-publication-publish',scope:SCOPE,actor:'11111111-1111-4111-8111-111111111111',
  ownerGithubId:'123',organizer,codeSha:'a'.repeat(40),workflowSha:'b'.repeat(40),state:'queued',nonce:'synthetic',createdAt:new Date().toISOString()};
 await f.control.transact('task-'+id,0,()=>task);
 const lease=await f.broker.fetch(new Request(f.origin+'/processor/lease',{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer synthetic-oidc'},body:JSON.stringify({task:id,nonce:'synthetic'})}));
 assert.equal(lease.status,403);assert.equal((await f.control.get('task-'+id)).state,'queued');
 assert.throws(()=>createDriver({lease:{task,ownerUserId:task.actor,codeSha:task.codeSha}}),/ikke aktivert/);
});
test('owner explicitly checks, approves and publishes private merges; fresh login retrieves verified status, remaining decisions and reversible history',async t=>{
 const f=await setup(t,{identityPublicationEnabled:true}),session=await f.login(),original=structuredClone(f.context.history);
 const initial=await f.request('/identity',undefined,session);assert.equal(initial.status,200);assert.equal(initial.body.publication.review,null);assert.equal(initial.body.persisted,false);
 await decision(f,session);let saved=await view(f,session);
 assert.equal((await f.request('/identity/publication/publish',{...bound(saved),confirmation:true},session)).status,409);
 saved=await run(f,session,'check');assert.equal(saved.publication.review.merges,1);assert.equal(saved.publication.review.after.profiles['MOR-C220002'].count,5);
 assert.equal((await f.request('/identity/publication/approve',{...bound(saved),candidateDigest:'f'.repeat(64)},session)).status,409);
 saved=await run(f,session,'approve',{candidateDigest:saved.publication.review.candidateDigest});assert.equal(saved.status,'review-approved');assert.equal(f.remote.merged,0);
 f.remote.checks='success';f.remote.deploy='success';saved=await run(f,session,'publish',{confirmation:true});
 assert.equal(saved.publication.job.stage,'published');assert.equal(saved.publication.history.length,1);assert.equal(f.remote.merged,1);
 assert.deepEqual(f.context.history.results,original.results);assert.equal(saved.draft.cases.length,2);assert.equal(saved.archives.length,1);
 const published=saved.publication.job;
 await f.request('/logout',{},session);f.restart();const next=await f.login();saved=await view(f,next);
 assert.equal(saved.publication.job.id,published.id);assert.equal(saved.publication.job.stage,'published');assert.equal(saved.draft.cases.length,2);
 saved=await run(f,next,'reverse',{publicationId:published.id,confirmation:true});assert.equal(saved.publication.reversalOf,published.id);assert.equal(f.remote.merged,1);
 assert.equal((await f.request('/identity/decide',{expectedRevision:saved.revision,command:f.command()},next)).status,409);
 saved=await run(f,next,'approve',{candidateDigest:saved.publication.review.candidateDigest});
 saved=await run(f,next,'publish',{confirmation:true});assert.equal(saved.publication.job.stage,'published');assert.equal(saved.publication.history.length,2);
 assert.equal(f.remote.merged,2);assert.deepEqual(f.context.history,original);
});
test('identity publication rejects hostile/anonymous, stale or replayed requests and locks out parallel result publications',async t=>{
 const f=await setup(t,{identityPublicationEnabled:true}),session=await f.login();await decision(f,session);
 let saved=await run(f,session,'check'),b=bound(saved);
 for(const action of ['check','approve','publish','continue','reverse','cancel']){
  assert.equal((await f.request('/identity/publication/'+action,b)).status,401);
  assert.equal((await f.request('/identity/publication/'+action,b,session,{origin:'https://hostile.example.test'})).status,403);
 }
 assert.equal((await f.request('/identity/publication/check',{...b,expectedRevision:b.expectedRevision-1},session)).status,409);
 assert.equal((await f.request('/identity/publication/check',{...b,enabled:true},session)).status,400);
 saved=await run(f,session,'approve',{candidateDigest:saved.publication.review.candidateDigest});
 const result=await f.approve();await f.publication.prepare(result);const plan=(await f.publication.status(f.input)).job;
 await f.publication.publish({...f.input,id:plan.id,confirmation:plan.manifestSha256});
 assert.equal((await f.request('/identity/publication/publish',{...bound(saved),confirmation:true},session)).status,409);
 // Failed result CI releases its own lock; the independent private identities survive.
 await f.publication.progress(organizer);f.remote.checks='failed';await f.publication.progress(organizer);
 const pub=await f.request('/identity/publication/publish',{...bound(saved),confirmation:true},session);assert.equal(pub.status,202);
 assert.equal((await f.request('/identity/publication/publish',{...bound(saved),confirmation:true},session)).status,409);
 f.remote.checks='failed';assert.equal((await f.processNext()).completed,true);
 saved=await view(f,session);assert.equal(saved.publication.job.stage,'failed');assert.equal(f.remote.merged,0);
 assert.equal(saved.draft.cases.length,3);
});
