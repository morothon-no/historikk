'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{setup}=require('./helpers/annual-serverless.cjs'),A=require('../scripts/admin/annual-result-import.cjs');
async function accepted(f){const input=f.sourceInput(),first=await A.prepare(f.context,input);input.decisions=first.identityTasks.map((t,i)=>({rowId:t.rowId,basis:first.interpretationSha256,
 action:i?'new-person':'existing',runnerId:i?null:'MOR-C220001',targetIndex:null,personKey:i?'synthetic-new-person':null,confirmDistinct:false,reason:'Kontrollert syntetisk personvalg.'}));return input;}
test('protected annual import previews and saves only after private processing, survives logout/restart and never changes public data',async t=>{
 const f=await setup(t),session=await f.login(),before=structuredClone(f.context.history),input=await accepted(f),command=f.command(input);
 assert.equal((await f.request('/annual-import',undefined,session)).body.persisted,false);
 const queued=await f.request('/annual-import/preview',command,session);assert.equal(queued.status,202);
 assert.equal((await f.request('/annual-import',undefined,session)).body.request.result,null);assert.equal(await f.annualImports.get('sogne-morothon'),null);
 assert.equal((await f.processNext()).completed,true);let view=(await f.request('/annual-import',undefined,session)).body;
 assert.equal(view.request.result.plan.ready,true);assert.equal(view.persisted,false);assert.equal(view.request.result.plan.newEdition,true);
 const save=f.command(input);assert.equal((await f.request('/annual-import/save',save,session)).status,202);assert.equal((await f.processNext()).completed,true);
 view=(await f.request('/annual-import',undefined,session)).body;assert.equal(view.persisted,true);assert.equal(view.revision,1);assert.equal(view.plan.summary.newResults,2);
 assert.equal(view.plan.summary.dns,1);const dnf=view.plan.operations.find(o=>o.after?.[4]==='DNF');assert.equal(dnf.after[5],'');assert.equal(dnf.after[6],'');
 await f.request('/logout',{},session);f.restart();const reopened=(await f.request('/annual-import',undefined,await f.login())).body;
 assert.deepEqual(reopened.input,input);assert.deepEqual(reopened.plan,view.plan);assert.equal(reopened.productionApplied,false);assert.deepEqual(f.context.history,before);
 for(const value of f.encrypted.values())assert.equal(Buffer.from(value.content,'base64').includes(Buffer.from('Syntetisk')),false);
 assert.equal(await f.reviewStore.get('sogne-morothon'),null);
});
test('identical/repeated imports are idempotent, corrected files require source replacement and retain the exact older private input',async t=>{
 const f=await setup(t),session=await f.login(),input=await accepted(f),save=f.command(input);
 const first=await f.request('/annual-import/save',save,session);await f.processNext();
 const repeat=await f.request('/annual-import/save',save,session);assert.equal(repeat.body.id,first.body.id);assert.equal(repeat.body.repeated,true);assert.equal(f.dispatches.length,0);
 let v=(await f.request('/annual-import',undefined,session)).body;
 const same=f.command(input,v.revision,v.digest);await f.request('/annual-import/save',same,session);await f.processNext();
 v=(await f.request('/annual-import',undefined,session)).body;assert.equal(v.revision,1);assert.equal(v.request.result.changed,false);
 const corrected=await accepted(f);corrected.source.data=Buffer.from(f.csv('48:50')).toString('base64');const p=await A.prepare(f.context,{...corrected,decisions:[]});corrected.decisions.forEach(d=>d.basis=p.interpretationSha256);
 await f.request('/annual-import/preview',f.command(corrected,v.revision,v.digest),session);await f.processNext();
 const preview=(await f.request('/annual-import',undefined,session)).body.request.result;assert.equal(preview.replacesPrivateSource,true);assert.equal(preview.comparison.changed,1);
 await f.request('/annual-import/save',f.command(corrected,v.revision,v.digest),session);assert.equal((await f.processNext()).completed,false);
 assert.equal((await f.request('/annual-import',undefined,session)).body.revision,1);
 await f.request('/annual-import/save',f.command(corrected,v.revision,v.digest,{replaceCurrent:true}),session);assert.equal((await f.processNext()).completed,true);
 v=(await f.request('/annual-import',undefined,session)).body;assert.equal(v.revision,2);assert.deepEqual((await f.annualImports.get('sogne-morothon')).archives[0].input,input);
});
test('annual routes reject anonymous/foreign/forged/stale requests, conflicting reuse, publication actions and expired leases',async t=>{
 const f=await setup(t),session=await f.login(),command=f.command();
 for(const sessionValue of [undefined,'forged'])assert.equal((await f.request('/annual-import',undefined,sessionValue)).status,401);
 assert.equal((await f.request('/annual-import/save',command,session,{site:'https://hostile.example.test'})).status,403);
 const forged=structuredClone(command);forged.input.publicationAuthorized=true;assert.equal((await f.request('/annual-import/save',forged,session)).status,400);
 const stale=structuredClone(command);stale.expectedRevision=1;assert.equal((await f.request('/annual-import/save',stale,session)).status,409);
 assert.equal((await f.request('/annual-import/publish',command,session)).status,404);
 await f.request('/annual-import/preview',command,session);const conflict=structuredClone(command);conflict.input.year=2028;assert.equal((await f.request('/annual-import/preview',conflict,session)).status,409);
 f.state.now+=46*60000;await assert.rejects(f.processNext(),/403/);assert.equal(await f.annualImports.get('sogne-morothon'),null);
});
test('uncertain dispatch has a reusable task, cancellation is explicit, and a failed save cannot be displayed as confirmed',async t=>{
 const f=await setup(t),session=await f.login();f.state.dispatchError=true;
 const command=f.command(await accepted(f));assert.equal((await f.request('/annual-import/save',command,session)).status,503);
 let v=(await f.request('/annual-import',undefined,session)).body;assert.equal(v.task.state,'queued');assert.equal(v.persisted,false);assert.equal(v.request.result,null);
 assert.equal((await f.request('/annual-import/save',command,session)).body.repeated,true);
 await f.request('/task/cancel',{id:v.task.id,confirmation:true},session);await assert.rejects(f.processNext(),/403/);
 f.state.dispatchError=false;const altered=f.command();altered.input.source.data=Buffer.from(f.csv().replace('49:20','49:99')).toString('base64');
 await f.request('/annual-import/save',altered,session);assert.equal((await f.processNext()).completed,true); // unresolved draft is allowed, never publication
 v=(await f.request('/annual-import',undefined,session)).body;assert.equal(v.plan.ready,false);assert.equal(v.plan.summary.unresolved,2);
});
test('tampered private job data and source changes between queue and processing stop acceptance without touching other modules',async t=>{
 for(const changedSource of [false,true]){
  const f=await setup(t),session=await f.login(),command=f.command(await accepted(f));await f.request('/annual-import/save',command,session);
  if(changedSource)f.context.base={...f.context.base,dataVersion:999};
  else{const key='request-'+command.id,record=await f.annualRequests.get(key);await f.annualRequests.transact(key,record.revision,p=>({...p,revision:p.revision+1,command:{...p.command,replaceCurrent:true}}));}
  assert.equal((await f.processNext()).completed,false);const v=(await f.request('/annual-import',undefined,session)).body;
  assert.equal(v.persisted,false);assert.equal(v.request.result,null);assert.equal(v.task.state,'failed');assert.equal(await f.reviewStore.get('sogne-morothon'),null);
 }
});
test('large annual requests use their bounded private payload store while legacy correction limits and source isolation remain unchanged',async t=>{
 const f=await setup(t),session=await f.login(),command=f.command(f.sourceInput(f.csv()+'\n'.repeat(60000)));
 assert.ok(Buffer.byteLength(JSON.stringify(command))>65536);assert.equal((await f.request('/annual-import/preview',command,session)).status,202);
 assert.equal((await f.processNext()).completed,true);assert.equal((await f.request('/review',undefined,session)).body.task,null);
 const r=await f.broker.fetch(new Request(f.origin+'/review/save',{method:'POST',headers:{origin:f.origin,authorization:'Bearer '+session,'Content-Type':'application/json'},body:JSON.stringify(command)}));assert.equal(r.status,413);
 assert.equal((await f.request('/annual-import?requestId=invalid',undefined,session)).status,400);
 assert.equal((await f.request('/annual-import?requestId='+command.id+'&requestId='+command.id,undefined,session)).status,400);
});
test('conflicting simultaneous submissions cannot hide the winning task, and exact old requests can be queried without replaying writes',async t=>{
 const f=await setup(t),session=await f.login(),a=f.command(),b=f.command(f.sourceInput(f.csv('48:50'))),
  results=await Promise.all([f.request('/annual-import/preview',a,session),f.request('/annual-import/preview',b,session)]);
 assert.equal(results.filter(r=>r.status===202).length,1);assert.equal(f.dispatches.length,1);
 const current=(await f.request('/annual-import',undefined,session)).body;assert.equal(current.task.state,'queued');assert.equal(current.task.id,results.find(r=>r.status===202).body.id);
 await f.processNext();const oldId=current.request.id;
 await f.request('/annual-import/preview',f.command(),session);await f.processNext();
 const old=(await f.request('/annual-import?requestId='+oldId,undefined,session)).body;assert.equal(old.request.id,oldId);assert.equal(old.task.state,'completed');assert.equal(f.dispatches.length,0);
});
