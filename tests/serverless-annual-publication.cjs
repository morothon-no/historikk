'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{setup}=require('./helpers/annual-serverless.cjs'),A=require('../scripts/admin/annual-result-import.cjs'),{sha}=require('../scripts/admin/serverless/github-store.cjs');
async function saved(t){
 const f=await setup(t,{publication:true}),session=await f.login(),input=f.sourceInput();input.source.completeClaim=true;
 const plan=await A.prepare(f.context,input);input.decisions=plan.identityTasks.map((p,i)=>({rowId:p.rowId,basis:plan.interpretationSha256,action:i?'new-person':'existing',runnerId:i?null:'MOR-C220001',targetIndex:null,personKey:i?'synthetic-new':null,confirmDistinct:false,reason:'Syntetisk bekreftet identitet.'}));
 assert.equal((await f.request('/annual-import/save',f.command(input),session)).status,202);assert.equal((await f.processNext()).completed,true);
 const view=async()=>(await f.request('/annual-import',undefined,session)).body;
 async function command(action,extra={}){const v=await view();return {id:sha(crypto.randomUUID()).slice(0,32),expectedRevision:v.revision,expectedDigest:v.publication.digest,...extra};}
 async function run(action,extra={}){const c=await command(action,extra),r=await f.request('/annual-import/publication/'+action,c,session);assert.equal(r.status,202,JSON.stringify(r.body));assert.equal((await f.processNext()).completed,true,JSON.stringify(await view()));return view();}
 return {...f,session,view,command,run};
}
test('annual protected publication requires exact server review and owner approval, survives fresh login and uses existing CI/backup/rollback chain',async t=>{
 const f=await saved(t),original=structuredClone(f.context.history);assert.equal((await f.view()).publication.review,null);
 assert.equal((await f.request('/annual-import/publication/publish',await f.command('publish',{confirmation:true}),f.session)).status,409);
 let v=await f.run('check');assert.equal(v.publication.review.ready,true);assert.equal(f.remote.submitted,0);
 const approve=await f.command('approve',{candidateDigest:v.publication.review.candidateDigest});
 assert.equal((await f.request('/annual-import/publication/approve',approve,f.session)).status,202);assert.equal((await f.processNext()).completed,true);
 v=await f.view();assert.equal(v.status,'review-approved');assert.equal(v.publication.job,null);
 const second=await f.login();f.restart();const reopened=(await f.request('/annual-import',undefined,second)).body;assert.deepEqual(reopened.publication.review,v.publication.review);assert.equal(reopened.status,'review-approved');
 f.remote.checks='success';f.remote.deploy='success';v=await f.run('publish',{confirmation:true});assert.equal(v.publication.job.stage,'published');assert.equal(v.persisted,false);assert.equal(f.remote.merged,1);
 assert.equal(v.publication.job.backupVerified,true);assert.equal(v.publication.history.length,1);assert.equal(f.context.history.yearStats.at(-1)[0],2027);
 assert.equal((await f.annualImports.get('sogne-morothon')).archives.length,1);
 v=await f.run('reverse',{publicationId:v.publication.job.id,confirmation:true});assert.equal(v.publication.review.operation,'reverse');assert.equal(f.remote.merged,1);
 v=await f.run('approve',{candidateDigest:v.publication.review.candidateDigest});v=await f.run('publish',{confirmation:true});
 assert.equal(v.publication.job.stage,'published');assert.deepEqual(f.context.history,original);assert.equal(f.remote.merged,2);
 assert.equal(await f.reviewStore.get('sogne-morothon'),null);
});
test('annual publication rejects disabled routes, forged approvals, stale writers, hostile origins and replay collisions without losing the private source',async t=>{
 const f=await saved(t),before=await f.annualImports.get('sogne-morothon');
 for(const session of [undefined,'forged'])assert.equal((await f.request('/annual-import/publication/check',await f.command('check'),session)).status,401);
 assert.equal((await f.request('/annual-import/publication/check',await f.command('check'),f.session,{site:'https://hostile.example.test'})).status,403);
 const forged=await f.command('approve',{candidateDigest:'f'.repeat(64)});assert.equal((await f.request('/annual-import/publication/approve',forged,f.session)).status,202);assert.equal((await f.processNext()).completed,false);
 assert.deepEqual(await f.annualImports.get('sogne-morothon'),before);
 assert.equal((await f.request('/annual-import/publication/check',{...await f.command('check'),expectedRevision:999},f.session)).status,409);
 const c=await f.command('check');assert.equal((await f.request('/annual-import/publication/check',c,f.session)).status,202);assert.equal((await f.processNext()).completed,true);
 assert.equal((await f.request('/annual-import/publication/check',c,f.session)).body.repeated,true);
 assert.equal((await f.request('/annual-import/publication/check',{...c,expectedRevision:999},f.session)).status,409);
 assert.equal(f.remote.merged,0);const off=await setup(t);assert.equal((await off.request('/annual-import/publication/check',c,await off.login())).status,404);
});
test('private publication locks stop cross-module writes and source changes after queueing stop approval',async t=>{
 const f=await saved(t);let v=await f.run('check');v=await f.run('approve',{candidateDigest:v.publication.review.candidateDigest});
 const C=require('../tools/diploma-admin/intake-model.js').Corrections;
 await f.reviewStore.transact('sogne-morothon',0,()=>({v:1,revision:1,status:'draft',base:f.context.base,draft:C.empty(f.context.base),events:[],publicationLock:{id:'e'.repeat(64)}}));
 assert.equal((await f.request('/annual-import/publication/publish',await f.command('publish',{confirmation:true}),f.session)).status,409);
 const held=await f.annualImports.get('sogne-morothon');assert.equal(held.status,'review-approved');assert.equal(f.remote.submitted,0);
 await f.reviewStore.transact('sogne-morothon',1,p=>{const {publicationLock,...r}=p;return {...r,revision:2};});
 await f.run('cancel');v=await f.run('check');const c=await f.command('approve',{candidateDigest:v.publication.review.candidateDigest});
 await f.request('/annual-import/publication/approve',c,f.session);f.context.base={...f.context.base,dataVersion:999};
 assert.equal((await f.processNext()).completed,false);assert.equal((await f.annualImports.get('sogne-morothon')).status,'draft');assert.equal(f.remote.submitted,0);
});
