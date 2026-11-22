'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {setup}=require('./helpers/identity-serverless.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;
const {organizer}=require('./helpers/result-publication.cjs');
test('private-only source routing is restricted to exact identity action and module, never publication or import',()=>{
 const {isPrivateIdentityTask,SCOPE}=require('../scripts/admin/serverless/identity-command.cjs');
 for(const action of ['identity-decide','identity-batch','identity-approve','identity-revalidate','identity-check']){
  assert.equal(isPrivateIdentityTask({scope:SCOPE,action}),true);
  assert.equal(isPrivateIdentityTask({scope:'result-control-v1',action}),false);
 }
 for(const action of ['publish','continue','reverse','validate','identity-publication-publish','identity-publication-check','annual-save','annual-publication-publish','identity-batch-forged'])
  assert.equal(isPrivateIdentityTask({scope:SCOPE,action}),false);
 assert.equal(isPrivateIdentityTask(null),false);assert.equal(isPrivateIdentityTask({}),false);
});
test('actual private processor saves and reopens a distinct decision with encrypted CAS despite protection 404, without browser or public writes',async t=>{
 const f=await setup(t),{main}=require('../scripts/admin/serverless/processor.cjs');
 const {seal,unseal,sha,githubStore,tokenConnection}=require('../scripts/admin/serverless/github-store.cjs');
 const {createIdentityReview,identityReviewStore}=require('../scripts/admin/identity-review.cjs');
 const code='a'.repeat(40),id='b'.repeat(24),privateRepo='synthetic-org/private-state',command=f.command('different-people');
 const task={id,revision:2,state:'running',runId:'123',scope:'person-control-v1',action:'identity-batch',
  actor:f.sessions.get('owner').subject,organizer,codeSha:code,expectedRevision:0,identityCommands:[command]};
 const taskPath='.morothon-state/control/task-'+id+'.aesgcm',encrypted=new Map([[taskPath,seal(f.key,taskPath,task)]]),calls=[];
 const env={GITHUB_ACTIONS:'true',GITHUB_RUN_ID:'123',MOROTHON_BROKER_ORIGIN:'https://worker.example.test',
  MOROTHON_TASK:id,MOROTHON_TASK_NONCE:'n'.repeat(43),MOROTHON_CODE_SHA:code,
  ACTIONS_ID_TOKEN_REQUEST_URL:'https://token.actions.githubusercontent.com/oidc',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'synthetic-oidc'};
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET';calls.push({path:u.pathname,method});
  if(u.hostname==='token.actions.githubusercontent.com')return Response.json({value:'synthetic-private-proof'});
  if(u.origin===env.MOROTHON_BROKER_ORIGIN)return Response.json({task,privateToken:'synthetic-private',publicToken:'synthetic-public',storageKey:f.key.toString('hex'),
   privateRepository:privateRepo,privateRepositoryId:'456',publicRepository:'morothon-no/historikk',codeSha:code,ownerUserId:task.actor,appId:'123'});
  const base='/repos/'+privateRepo;
  if(u.pathname===base)return Response.json({private:true,full_name:privateRepo,id:456,default_branch:'main'});
  if(u.pathname.startsWith(base+'/contents/')){
   const name=u.pathname.slice((base+'/contents/').length),old=encrypted.get(name);
   assert.match(name,/^\.morothon-state\/(identity-reviews|control)\//);
   if(method==='PUT'){
    const body=JSON.parse(options.body);assert.equal(body.branch,'admin-state');assert.equal(body.sha,old?sha(old).slice(0,40):undefined);
    encrypted.set(name,Buffer.from(body.content,'base64'));return Response.json({});
   }
   return old?Response.json({type:'file',encoding:'base64',sha:sha(old).slice(0,40),size:old.length,content:old.toString('base64')}):Response.json({}, {status:404});
  }
  assert.equal(method,'GET','No operation may write to the public repository');
  const p=u.pathname.replace('/repos/morothon-no/historikk/','');
  if(p==='branches/main/protection')return Response.json({}, {status:404});
  if(p==='git/ref/heads/main')return Response.json({object:{sha:code}});
  if(p.startsWith('compare/'))return Response.json({status:'identical',merge_base_commit:{sha:code},files:[]});
  if(p==='actions/workflows/pages.yml/runs')return Response.json({workflow_runs:[{id:1,head_sha:code,event:'push',path:'.github/workflows/pages.yml',status:'completed',conclusion:'success'}]});
  if(p.startsWith('contents/')){
   const file=p.slice(9);assert.ok(file.startsWith('public-data/')||file==='.github/public-data-approval.json');
   const bytes=f.repository.files.get(file);assert.ok(bytes,file);return Response.json({type:'file',encoding:'base64',size:bytes.length,content:bytes.toString('base64')});
  }
  throw Error('Unexpected synthetic route');
 });
 await main(env);
 assert.equal(unseal(f.key,taskPath,encrypted.get(taskPath)).state,'completed');
 assert.ok(calls.every(c=>!c.path.includes('branches/main/protection')&&!c.path.includes('actions/variables')));
 const reopen=()=>createIdentityReview({authenticate:session=>f.auth.authenticate(new Request(f.origin+'/identity',{headers:{authorization:'Bearer '+session}})),
  loadContext:async()=>f.context,store:identityReviewStore({openNamespace:()=>githubStore({api:tokenConnection(privateRepo,'synthetic-private'),key:f.key,repositoryId:'456',prefix:'identity-reviews'})})});
 const session=await f.login(),first=await reopen().load({session,organizer});
 assert.equal(first.persisted,true);assert.equal(first.revision,1);assert.equal(first.counts.rejected,1);
 assert.equal(first.productionApplied,false);assert.equal(first.publicationAuthorized,false);
 await f.auth.logout(new Request(f.origin+'/logout',{headers:{authorization:'Bearer '+session}}));
 await assert.rejects(()=>reopen().load({session,organizer}));
 const second=await reopen().load({session:await f.login(),organizer});
 assert.deepEqual(second.draft,first.draft);assert.equal(second.counts.rejected,1);
 assert.equal(second.worklist.identity.some(c=>c.bucket==='pending'&&c.personIds.includes(command.personIds[0])&&c.personIds.includes(command.personIds[1])),false);
 for(const bytes of encrypted.values())assert.equal(bytes.includes(Buffer.from(command.reason)),false,'Private decisions remain ciphertext');
 // Positive identity changes still need the established consequence engine.
 // Test both a verified sandbox and a refused sandbox; no fallback is allowed.
 const processorPath=require.resolve('../scripts/admin/serverless/processor.cjs'),originalModule=require.cache[processorPath];
 const runtime=require('../scripts/admin/review-runtime.cjs');let sandboxAllowed=true,checked=false,projections=0,closed=0;
 const factory=t.mock.method(runtime,'createProjector',async()=>({
  checkSandbox:async()=>{if(!sandboxAllowed)throw Error('Chromium-sandbox kunne ikke bekreftes.');checked=true;},
  project:async history=>{assert.equal(checked,true);projections++;return f.context.project(history);},close:async()=>{closed++;}
 }));
 try{
  delete require.cache[processorPath];const {main:mergeMain}=require(processorPath);
  for(const allowed of [true,false]){
   task.identityCommands=[f.command('same-person')];sandboxAllowed=allowed;checked=false;projections=0;closed=0;
   encrypted.clear();encrypted.set(taskPath,seal(f.key,taskPath,task));
   const oldExit=process.exitCode;
   try{await mergeMain(env);}finally{process.exitCode=oldExit;}
   assert.equal(unseal(f.key,taskPath,encrypted.get(taskPath)).state,allowed?'completed':'failed');
   assert.equal(projections>0,allowed);assert.equal(closed,1);
   assert.equal(encrypted.has('.morothon-state/identity-reviews/'+organizer+'.aesgcm'),allowed,'A refused sandbox cannot save a positive decision');
  }
 }finally{factory.mock.restore();require.cache[processorPath]=originalModule;}
});

test('identity reads fail closed when a pre-created private directory has unsafe permissions',async t=>{
 const f=await setup(t),session=await f.login();
 await fs.mkdir(f.directory,{mode:0o700});await fs.chmod(f.directory,0o755);
 await assert.rejects(f.identities.get(organizer),/Runtime workspace must be private \(0700\)/);
 const read=await f.request('/identity',undefined,session);
 assert.equal(read.status,502);
 assert.equal(read.body.error,'Tjenesten kunne ikke fullføre kontrollen. Lagret arbeid er bevart.');
 assert.equal((await fs.stat(f.directory)).mode&0o777,0o755,'Never silently repair an unsafe storage destination');
 assert.deepEqual(await fs.readdir(f.directory),[]);
});

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
