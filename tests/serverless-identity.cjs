'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {setup}=require('./helpers/identity-serverless.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;
const {organizer}=require('./helpers/result-publication.cjs');

test('protected identities are durably saved only after the exact private job completes, then survive logout, new login and broker recreation',async t=>{
 const f=await setup(t),session=await f.login(),original=structuredClone(f.context.history);
 const queued=await f.request('/identity/decide',{expectedRevision:0,command:f.command()},session);
 assert.equal(queued.status,202);
 let saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.persisted,false);assert.equal(saved.task.state,'queued');assert.equal(saved.status,'empty');
 assert.equal((await f.processNext()).completed,true);
 saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.persisted,true);assert.equal(saved.revision,1);assert.equal(saved.status,'draft');
 assert.equal(saved.draft.cases[0].change.personIds[1],'MOR-C220002');assert.equal(saved.publicationAuthorized,false);
 assert.equal(saved.inspection.ready,true);
 assert.equal(saved.inspection.impacts[0].before['MOR-C220001'].count,3);
 assert.equal(saved.inspection.impacts[0].after['MOR-C220002'].count,5);
 assert.equal((await f.request('/review',undefined,session)).body.draft,null);
 await f.request('/logout',{},session);assert.equal((await f.request('/identity',undefined,session)).status,401);
 f.restart();const newSession=await f.login();
 assert.deepEqual((await f.request('/identity',undefined,newSession)).body.draft,saved.draft);
 const encrypted=await fs.readFile(path.join(f.directory,organizer+'.review.aesgcm'));
 assert.equal(encrypted.includes(Buffer.from('MOR-C220001')),false);
 assert.deepEqual(f.context.history,original);assert.equal(f.remote.submitted,0);
});

test('distinct pairs remain processed after reload; explicit owner approval is separate and never calls the public publisher',async t=>{
 const f=await setup(t),session=await f.login();
 await f.request('/identity/decide',{expectedRevision:0,command:f.command('different-people')},session);await f.processNext();
 let saved=(await f.request('/identity',undefined,session)).body;
 const work=await C.worklist(C.discover(f.context.history),saved.draft);
 assert.equal(work.identity.find(c=>c.personIds.includes('MOR-C220001')).bucket,'finished');
 assert.ok(work.identity.some(c=>!c.personIds.includes('MOR-C220001')&&c.bucket==='pending'));
 assert.equal((await f.request('/identity/approve',{expectedRevision:1,expectedDigest:'f'.repeat(64)},session)).status,409);
 assert.equal((await f.request('/identity/approve',{expectedRevision:1,expectedDigest:saved.digest},session)).status,202);
 assert.equal(saved.status,'draft');await f.processNext();saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.status,'review-approved');assert.equal(saved.revision,2);assert.equal(saved.productionApplied,false);
 assert.equal(saved.approval.by,'11111111-1111-4111-8111-111111111111');
 assert.equal((await f.request('/identity/publish',{},session)).status,404);assert.equal(f.remote.merged,0);
});

test('identity routes reject anonymous/forged tokens, hostile origins, result commands, wrong source versions, stale writers and overlapping jobs',async t=>{
 const f=await setup(t),session=await f.login(),body={expectedRevision:0,command:f.command()};
 for(const route of ['/identity','/identity/decide','/identity/approve','/identity/revalidate','/identity/check']){
  assert.equal((await f.request(route,route==='/identity'?undefined:body)).status,401);
  assert.equal((await f.request(route,route==='/identity'?undefined:body,'forged')).status,401);
  assert.equal((await f.request(route,route==='/identity'?undefined:body,session,{origin:'https://evil.example.test'})).status,403);
  assert.equal((await f.request(route,route==='/identity'?undefined:body,session,{origin:null})).status,403);
 }
 assert.equal((await f.request('/identity/decide',{...body,command:{...body.command,kind:'result'}},session)).status,400);
 const wrong=structuredClone(body);wrong.command.base.dataVersion++;assert.equal((await f.request('/identity/decide',wrong,session)).status,409);
 assert.equal((await f.request('/identity/decide',body,session)).status,202);
 assert.equal((await f.request('/identity/decide',body,session)).status,409);
 await f.processNext();assert.equal((await f.request('/identity/decide',body,session)).status,409);
 assert.equal((await f.request('/identity',undefined,session)).body.revision,1);
});

test('a failed merge job cannot report a saved decision or lose a previously stored distinct pair',async t=>{
 const f=await setup(t),session=await f.login();
 await f.request('/identity/decide',{expectedRevision:0,command:f.command('different-people')},session);await f.processNext();
 const previous=(await f.request('/identity',undefined,session)).body;
 await f.request('/identity/decide',{expectedRevision:1,command:f.command('same-person',{
  personIds:['MOR-C220003','MOR-C220004'],mainPersonId:'MOR-C220004'})},session);
 assert.equal((await f.processNext()).completed,false);
 const saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.task.state,'failed');assert.match(saved.task.error,/Overlapp/);
 assert.equal(saved.revision,1);assert.deepEqual(saved.draft,previous.draft);
});

test('explicit source revalidation archives all old cases, carries stable negatives only, clears approval and preserves archives on later saves',async t=>{
 const f=await setup(t),session=await f.login();
 await f.request('/identity/decide',{expectedRevision:0,command:f.command('different-people')},session);await f.processNext();
 const old=(await f.request('/identity',undefined,session)).body;
 f.context.history.results[0][5]='49:20';
 f.context.base=await C.binding(f.context.history,{dataVersion:3,manifestSha256:'e'.repeat(64),historySha256:await C.hash(f.context.history)});
 f.repository.files.set('.github/public-data-approval.json',Buffer.from(JSON.stringify(f.context.base)));
 assert.equal((await f.request('/identity',undefined,session)).body.stale,true);
 assert.equal((await f.request('/identity/decide',{expectedRevision:1,command:f.command()},session)).status,409);
 assert.equal((await f.request('/identity/revalidate',{expectedRevision:1,expectedDigest:old.digest},session)).status,202);
 assert.equal((await f.processNext()).completed,true);
 let saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.stale,false);assert.equal(saved.archives.length,1);assert.deepEqual(saved.archives[0].draft,old.draft);
 assert.equal(saved.draft.cases[0].status,'rejected');assert.equal(saved.approval,null);
 await f.request('/identity/decide',{expectedRevision:2,command:f.command('different-people',{
  personIds:['MOR-C220003','MOR-C220004']})},session);await f.processNext();
 saved=(await f.request('/identity',undefined,session)).body;
 assert.equal(saved.archives.length,1);assert.deepEqual(saved.archives[0].draft,old.draft);
});

test('identity same-origin GET support never rewrites cross-origin reads, mutations or arbitrary paths',async()=>{
 const {sameOriginBrokerRead}=await import('../scripts/admin/serverless/worker.mjs');
 const origin='https://identity-admin.example.test',headers={'sec-fetch-site':'same-origin',authorization:'Bearer '+'x'.repeat(43)};
 const get=new Request(origin+'/identity',{headers});assert.equal(sameOriginBrokerRead(get,origin).headers.get('origin'),origin);
 for(const request of [new Request(origin+'/identity/decide',{method:'POST',headers}),
  new Request(origin+'/identity',{headers:{...headers,'sec-fetch-site':'cross-site'}}),new Request(origin+'/unknown',{headers})])
  assert.equal(sameOriginBrokerRead(request,origin),request);
});

test('a missing or substituted consequence report blocks approval; read-only checking restores the exact report without changing saved decisions',async t=>{
 const f=await setup(t),session=await f.login();
 await f.request('/identity/decide',{expectedRevision:0,command:f.command()},session);await f.processNext();
 let saved=(await f.request('/identity',undefined,session)).body;
 const key='identity-inspection-'+organizer,old=await f.control.get(key);
 await f.control.transact(key,old.revision,p=>({...p,revision:p.revision+1,digest:'f'.repeat(64)}));
 assert.equal((await f.request('/identity/approve',{expectedRevision:saved.revision,expectedDigest:saved.digest},session)).status,409);
 assert.equal((await f.request('/identity/check',{expectedRevision:saved.revision,expectedDigest:saved.digest},session)).status,202);
 assert.equal((await f.processNext()).completed,true);
 const checked=(await f.request('/identity',undefined,session)).body;
 assert.equal(checked.revision,saved.revision);assert.deepEqual(checked.draft,saved.draft);assert.equal(checked.inspection.ready,true);
});
