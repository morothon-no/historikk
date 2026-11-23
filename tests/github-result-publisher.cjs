'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{generateKeyPairSync,createVerify}=require('node:crypto');
const {fakeGitHub}=require('./helpers/github-result-api.cjs'),{createInstallationApi,createGitHubPublisher}=require('../scripts/admin/github-result-publisher.cjs');
const {releaseFiles,backupFiles,PATHS}=require('../scripts/admin/result-release.cjs');
async function plan(api){const adapter=createGitHubPublisher({api:api.api,codeSha:api.codeSha,appId:'123'}),s=await adapter.snapshot(),h=JSON.parse(s.files.get('data/history.json'));h.results[0][5]='49:59';const r=releaseFiles({files:s.files,after:h});return {adapter,job:{id:'c'.repeat(64),baseCommit:s.sha,variables:s.variables,approval:r.approval,after:backupFiles(r.files)}};}
test('private source reads need only green approved public data; protection 404 still blocks publication snapshot, submit and advance',async t=>{
 const f=await fakeGitHub(t),{job}=await plan(f);let block=true;
 const adapter=createGitHubPublisher({codeSha:f.codeSha,appId:'123',api:async(route,options)=>{
  if(block&&route.endsWith('/branches/main/protection'))throw Object.assign(Error('Synthetic absent classic rule'),{githubStatus:404});
  if(route.includes('/rules/branches/main'))return [];
  return f.api(route,options);
 }});
 f.calls.length=0;const stages=[],source=await adapter.readApprovedSource({onStage:s=>stages.push(s)});
 assert.equal(source.sha,f.codeSha);assert.equal(source.variables,undefined);
 assert.deepEqual([...source.files.keys()].sort(),['.github/public-data-approval.json','public-data/manifest.json',
  ...['history','honors','volunteers','badges','event-dates'].map(n=>'public-data/data/'+n+'.json')].sort());
 assert.deepEqual(stages,['main-ref','source-version','main-ci','approved-files']);
 assert.ok(f.calls.every(c=>c.method==='GET'&&!c.path.includes('protection')&&!c.path.includes('actions/variables')));
 assert.equal(f.prs.length,0);
 await assert.rejects(()=>adapter.snapshot(),e=>e.publicSnapshotReason==='PROTECTION_RULESET');
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_RULESET');assert.equal(f.prs.length,0);
 block=false;job.remote=await adapter.submit(job);block=true;
 const writes=f.calls.filter(c=>c.method!=='GET').length;
 await assert.rejects(()=>adapter.advance(job),e=>e.publicSnapshotReason==='PROTECTION_RULESET');
 assert.equal(f.prs[0].merged,false);assert.equal(f.calls.filter(c=>c.method!=='GET').length,writes);
});
test('publication verifies an active main ruleset when classic protection is unavailable',async t=>{
 const f=await fakeGitHub(t),{job}=await plan(f);
 const repo='morothon-no/historikk',id=42;
 const names=['Public-safe source regression','Trusted policy and test plan','Public package, policy and site build','Independent trusted artifact gate'];
 const rules=[
  {type:'pull_request',parameters:{required_approving_review_count:0}},
  {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,
   required_status_checks:names.map(context=>({context,integration_id:15368}))}},
 ];
 let classicStatus=403;
 const effective=rules.map(rule=>({...structuredClone(rule),ruleset_id:id,ruleset_source:repo,ruleset_source_type:'Repository'}));
 const policy={id,source:repo,source_type:'Repository',target:'branch',enforcement:'active',rules,bypass_actors:[]};
 const adapter=createGitHubPublisher({codeSha:f.codeSha,appId:'123',api:async(route,options)=>{
  if(route.endsWith('/branches/main/protection'))throw Object.assign(Error('Classic endpoint'),{githubStatus:classicStatus});
  if(route.endsWith('/rules/branches/main?per_page=100'))return effective;
  if(route.endsWith('/rulesets/'+id))return policy;
  return f.api(route,options);
 }});
 for(const status of [403,404]){
  classicStatus=status;
  assert.equal((await adapter.snapshot()).sha,f.codeSha);
 }
 classicStatus=429;
 await assert.rejects(adapter.snapshot,e=>e.githubStatus===429);
 classicStatus=404;
 delete policy.bypass_actors;
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_BYPASS');
 policy.bypass_actors=[{actor_id:123,actor_type:'Integration',bypass_mode:'always'}];
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_BYPASS');
 policy.bypass_actors=[];
 policy.enforcement='evaluate';
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_RULESET');
 policy.enforcement='active';
 effective[1].parameters.strict_required_status_checks_policy=false;
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_STRICT');
 effective[1].parameters.strict_required_status_checks_policy=true;
 const removed=effective[1].parameters.required_status_checks.pop();
 await assert.rejects(()=>adapter.submit(job),e=>e.publicSnapshotReason==='PROTECTION_CHECKS');
 effective[1].parameters.required_status_checks.push(removed);
 assert.equal(f.prs.length,0);
 assert.ok(f.calls.every(c=>c.method==='GET'));
 job.remote=await adapter.submit(job);
 effective.shift();
 const writes=f.calls.filter(c=>c.method!=='GET').length;
 await assert.rejects(()=>adapter.advance(job),e=>e.publicSnapshotReason==='PROTECTION_REVIEWS');
 assert.equal(f.prs[0].merged,false);
 assert.equal(f.calls.filter(c=>c.method!=='GET').length,writes);
});
test('private source cannot opt out of green main or use changed code',async t=>{
 const f=await fakeGitHub(t);
 const adapter=createGitHubPublisher({codeSha:f.codeSha,appId:'123',api:async(route,o)=>{
  const r=await f.api(route,o);if(route.includes('/actions/workflows/'))r.workflow_runs.forEach(x=>{x.status='completed';x.conclusion='failure';});return r;
 }});
 await assert.rejects(()=>adapter.readApprovedSource({requireGreen:false}),e=>e.publicSnapshotReason==='MAIN_CI');
 await fsWriteSyntheticCode();
 await assert.rejects(()=>adapter.readApprovedSource(),e=>e.publicSnapshotReason==='SOURCE_VERSION');
 async function fsWriteSyntheticCode(){const fs=require('node:fs/promises'),path=require('node:path');await fs.writeFile(path.join(f.directory,'synthetic-code.js'),'synthetic');f.git(['add','.']);f.git(['commit','-qm','Synthetic changed code']);}
});
test('snapshot diagnostics distinguish protection failures while retaining every guard and read-only behavior',async t=>{
 const f=await fakeGitHub(t);
 const variants=[
  ['PROTECTION_STRICT',p=>{p.required_status_checks.strict=false;}],
  ['PROTECTION_ADMINS',p=>{p.enforce_admins.enabled=false;}],
  ['PROTECTION_REVIEWS',p=>{p.required_pull_request_reviews=null;}],
  ['PROTECTION_CHECKS',p=>{p.required_status_checks.contexts=p.required_status_checks.contexts.filter(n=>n!=='Independent trusted artifact gate');}],
  ['PROTECTION_BYPASS',p=>{p.required_pull_request_reviews.bypass_pull_request_allowances={apps:[{id:123}]};}],
 ];
 for(const [reason,change] of variants){
  const stages=[],adapter=createGitHubPublisher({codeSha:f.codeSha,appId:'123',api:async(route,options)=>{
   const value=structuredClone(await f.api(route,options));
   if(route.endsWith('/branches/main/protection'))change(value);return value;
  }});
  await assert.rejects(()=>adapter.snapshot({onStage:s=>stages.push(s)}),e=>e.publicSnapshotReason===reason);
  assert.deepEqual(stages,['main-ref','source-version','main-protection']);
 }
 const stages=[],adapter=createGitHubPublisher({api:f.api,codeSha:f.codeSha,appId:'123'});
 assert.equal((await adapter.snapshot({onStage:s=>stages.push(s)})).sha,f.codeSha);
 assert.deepEqual(stages,['main-ref','source-version','main-protection','main-ci','approved-files','approval-variables']);
 assert.ok(f.calls.every(c=>c.method==='GET'),'Diagnosis cannot write a result, approval variable or publication branch');
});
test('GitHub publisher creates exactly five data files in a real isolated Git branch, requires green checks, then uses protected PR merge',async t=>{
 const api=await fakeGitHub(t),{adapter,job}=await plan(api),before=api.read('data/history.json');job.remote=await adapter.submit(job);assert.deepEqual(api.read('data/history.json'),before);assert.equal(api.prs.length,1);
 assert.equal((await adapter.advance(job)).stage,'checking');api.state.checks='success';const merged=await adapter.advance(job);assert.equal(merged.stage,'deploying');assert.equal(api.prs[0].merged,true);assert.notDeepEqual(api.read('data/history.json'),before);assert.deepEqual(api.read('data/history.json'),api.read('public-data/data/history.json'));
 assert.equal(api.variables.MOROTHON_REVIEWED_POLICY_HEAD,merged.mergeCommit);api.state.deploy='success';assert.equal((await adapter.advance({...job,...merged})).stage,'verifying');
 const tree=api.calls.find(c=>c.path==='git/trees').body.tree;assert.deepEqual(tree.map(e=>e.path).sort(),PATHS.slice().sort());assert.ok(api.calls.every(c=>!c.path.includes('rulesets')&&c.method!=='DELETE'));
});
test('GitHub publisher rejects changed code, missing strict protection, modified approved branches and failed CI without bypassing controls',async t=>{
 const api=await fakeGitHub(t),{adapter,job}=await plan(api);api.state.strict=false;await assert.rejects(()=>adapter.submit(job),/Main må kreve/);api.state.strict=true;
 job.remote=await adapter.submit(job);api.state.checks='failed';assert.equal((await adapter.advance(job)).stage,'failed');assert.equal(api.prs[0].merged,false);
 api.prs[0].head.sha='e'.repeat(40);await assert.rejects(()=>adapter.advance(job),/endret etter godkjenningen/);
 const dirty=await fakeGitHub(t);const {adapter:a2}=await plan(dirty);const fs=require('node:fs/promises'),path=require('node:path');await fs.writeFile(path.join(dirty.directory,'unapproved-code.js'),'synthetic');dirty.git(['add','.']);dirty.git(['commit','-qm','Synthetic newer code']);await assert.rejects(()=>a2.snapshot(),/nyere kode/);
});
test('GitHub idempotent submission reuses the same branch and PR after reconnect; foreign approval-variable changes stop writes',async t=>{
 const api=await fakeGitHub(t),{adapter,job}=await plan(api),first=await adapter.submit(job),again=await adapter.submit(job);assert.deepEqual(again,first);assert.equal(api.prs.length,1);
 const other=await fakeGitHub(t),next=await plan(other);other.variables.MOROTHON_PUBLIC_DATA_SHA256='foreign-review';await assert.rejects(()=>next.adapter.submit(next.job),/annen operasjon/);assert.equal(other.prs.length,0);
});
test('GitHub App uses a short-lived signed installation token scoped to one repository, not the login identity',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),calls=[];
 const api=createInstallationApi({appId:'123',installationId:'456',privateKey,fetchImpl:async(url,options)=>{calls.push({url,options});if(url.includes('/access_tokens')){
  const input=JSON.parse(options.body);
  if(Object.hasOwn(input.permissions,'variables')||input.permissions.actions_variables!=='write')
   return {ok:false,status:422};
  return {ok:true,status:201,json:async()=>({token:'synthetic-installation-token',expires_at:new Date(Date.now()+3600000).toISOString()})};
 }return {ok:true,status:200,json:async()=>({ok:true})};}});
 await api('/repos/morothon-no/historikk/git/ref/heads/main');await api('/repos/morothon-no/historikk/compare/'+'a'.repeat(40)+'...'+'b'.repeat(40));assert.equal(calls.filter(c=>c.url.includes('/access_tokens')).length,1);
 const raw=calls[0].options.headers.Authorization.slice(7),parts=raw.split('.'),verify=createVerify('RSA-SHA256');verify.update(parts[0]+'.'+parts[1]);assert.equal(verify.verify(publicKey,parts[2],'base64url'),true);const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.iss,'123');assert.ok(claims.exp-claims.iat<=600);
 const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.repositories,['historikk']);assert.deepEqual(body.permissions,{contents:'write',pull_requests:'write',actions_variables:'write',actions:'write',checks:'read',administration:'read'});
 await assert.rejects(()=>api('/repos/another/private/git/ref/heads/main'),/avgrenset/);
 await assert.rejects(()=>api('/repos/morothon-no/historikk/../private'),/avgrenset/);
});
test('independent artifact gate is required; main policy race gets one bounded full rerun, while source failures stay blocked',async t=>{
 const api=await fakeGitHub(t),{job}=await plan(api);
 let omitGate=true;
 const adapter=createGitHubPublisher({codeSha:api.codeSha,appId:'123',api:async(...args)=>{const value=await api.api(...args);if(omitGate&&args[0].includes('/check-runs?'))return {...value,check_runs:value.check_runs.filter(c=>c.name!=='Independent trusted artifact gate')};return value;}});
 job.remote=await adapter.submit(job);api.state.checks='success';assert.equal((await adapter.advance(job)).stage,'checking');assert.equal(api.prs[0].merged,false);
 omitGate=false;Object.assign(job,await adapter.advance(job));assert.equal(job.stage,'deploying');
 api.state.deploy='failed';api.state.policyRace=true;Object.assign(job,await adapter.advance(job));assert.equal(job.stage,'deploying');assert.equal(api.state.reruns,1);
 // Re-fetching the old attempt cannot trigger a second rerun or a false failure.
 api.state.runAttempt=1;api.state.deploy='failed';assert.equal((await adapter.advance(job)).stage,'deploying');assert.equal(api.state.reruns,1);
 api.state.runAttempt=2;api.state.policyRace=false;assert.equal((await adapter.advance(job)).stage,'failed');assert.equal(api.state.reruns,1);
 api.state.deploy='success';assert.equal((await adapter.advance(job)).stage,'verifying');
});
test('required PR review refusal remains a human checkpoint and malformed write responses never leak response content',async t=>{
 const api=await fakeGitHub(t),{job}=await plan(api),adapter=createGitHubPublisher({codeSha:api.codeSha,appId:'123',api:async(route,options)=>{if(route.endsWith('/merge'))throw Object.assign(Error('Synthetic protected merge refusal'),{githubStatus:405});return api.api(route,options);}});
 job.remote=await adapter.submit(job);api.state.checks='success';assert.equal((await adapter.advance(job)).stage,'needs-review');assert.equal(api.prs[0].merged,false);
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const transport=createInstallationApi({appId:'123',installationId:'456',privateKey,fetchImpl:async()=>({ok:true,status:201,json:async()=>{throw Error('synthetic-private-response');}})});
 await assert.rejects(()=>transport('/repos/morothon-no/historikk/git/refs',{method:'POST'}),e=>e.uncertain===true&&!e.message.includes('synthetic-private-response'));
});
test('a later trusted Pages deploy can verify the same merged release without any GitHub writes',async t=>{
 const f=await fakeGitHub(t),{adapter,job}=await plan(f);
 job.publicationKind='identity';
 job.remote=await adapter.submit(job);
 f.state.checks='success';
 const {mergeCommit}=await adapter.advance(job);
 f.state.deploy='failed';
 assert.equal((await adapter.advance(job)).stage,'failed');
 const tree=f.git(['show','-s','--format=%T',mergeCommit]).toString().trim();
 const head=f.git(['commit-tree',tree,'-p',mergeCommit], 'Synthetic reviewed recovery').toString().trim();
 f.git(['update-ref','refs/heads/main',head,mergeCommit]);
 let deployed=false;
 const recovered=createGitHubPublisher({codeSha:head,appId:'123',api:async(route,options)=>{
  if(route.endsWith('actions/runs/20/attempts/1/jobs?per_page=100'))return {jobs:[{
   name:'Publish tested main only',status:'completed',conclusion:deployed?'success':'skipped',
  }]};
  return f.api(route,options);
 }});
 f.calls.length=0;
 await assert.rejects(()=>adapter.advance(job),/nyere kode|vellykket Pages/);
 await assert.rejects(()=>recovered.advance(job),/vellykket Pages/);
 f.state.deploy='success';
 await assert.rejects(()=>recovered.advance(job),/bekreftet Pages/);
 deployed=true;
 assert.deepEqual(await recovered.advance(job),{stage:'verifying',mergeCommit,deployCommit:head,runId:20});
 const fs=require('node:fs/promises'),path=require('node:path');
 await fs.appendFile(path.join(f.directory,'data/history.json'),' ');
 f.git(['add','data/history.json']);f.git(['commit','-qm','Synthetic unapproved replacement']);
 await assert.rejects(()=>recovered.advance(job),/andre data/);
 assert.ok(f.calls.every(call=>call.method==='GET'));
 assert.equal(f.prs.length,1);
});
test('continuation may read a failed deploy snapshot but normal publication still requires green main and all code/protection checks',async t=>{
 const api=await fakeGitHub(t),publisher=createGitHubPublisher({api:async(route,o)=>{const r=await api.api(route,o);if(route.includes('event=push'))for(const run of r.workflow_runs)Object.assign(run,{status:'completed',conclusion:'failure'});return r;},codeSha:api.codeSha,appId:'123'});await assert.rejects(publisher.snapshot(),/grønn/);const readOnly=await publisher.snapshot({requireGreen:false});assert.ok(readOnly.files.get('data/history.json'));assert.equal(api.prs.length,0);await assert.rejects(publisher.snapshot(),/grønn/);api.state.strict=false;await assert.rejects(publisher.snapshot({requireGreen:false}),/obligatoriske tester/);
});
test('identity publication uses the same protected five-file GitHub path with its own idempotent branch and clear title',async t=>{
 const api=await fakeGitHub(t),adapter=createGitHubPublisher({api:api.api,codeSha:api.codeSha,appId:'123'}),snapshot=await adapter.snapshot(),
  D=require('../tools/diploma-admin/result-release-data.cjs'),history=JSON.parse(snapshot.files.get('data/history.json'));
 history.redirects['MOR-C220001']='MOR-C220002';history.aliases['MOR-C220002']=['Syntetisk Kari Nord'];
 const release=releaseFiles({files:snapshot.files,after:history},D.appendIdentityPublication),job={publicationKind:'identity',id:'d'.repeat(64),baseCommit:snapshot.sha,
  variables:snapshot.variables,approval:release.approval,after:backupFiles(release.files)};
 const first=await adapter.submit(job);assert.match(first.branch,/^codex\/identity-/);assert.deepEqual(await adapter.submit(job),first);
 assert.equal(api.prs.length,1);assert.match(api.calls.find(c=>c.path==='pulls'&&c.method==='POST').body.title,/identitetsretting/);
 assert.deepEqual(api.calls.find(c=>c.path==='git/trees').body.tree.map(e=>e.path).sort(),PATHS.slice().sort());
 job.remote=first;assert.equal((await adapter.advance(job)).stage,'checking');assert.equal(api.prs[0].merged,false);
 api.state.checks='success';assert.equal((await adapter.advance(job)).stage,'deploying');
 assert.deepEqual(JSON.parse(api.read('data/history.json')).results,JSON.parse(api.read('data/history.json',api.codeSha)).results);
 assert.equal(api.calls.some(c=>c.path.includes('rulesets')||c.method==='DELETE'),false);
});
test('annual publication keeps the five-file allowlist, independent artifact gate and protected merge with an idempotent annual branch',async t=>{
 const api=await fakeGitHub(t),adapter=createGitHubPublisher({api:api.api,codeSha:api.codeSha,appId:'123'}),s=await adapter.snapshot(),D=require('../tools/diploma-admin/result-release-data.cjs'),h=JSON.parse(s.files.get('data/history.json'));
 h.results.push([2027,h.people[0].i,'Kortmoro','10 km','DNF','','','','','']);h.yearStats.push([2027,1,1,1,0,1,0,1,0,0]);h.range='1992–2027';
 const r=releaseFiles({files:s.files,after:h},D.appendAnnualPublication),job={publicationKind:'annual',id:'e'.repeat(64),baseCommit:s.sha,variables:s.variables,approval:r.approval,after:backupFiles(r.files)};
 job.remote=await adapter.submit(job);assert.match(job.remote.branch,/^codex\/annual-/);assert.deepEqual(await adapter.submit(job),job.remote);assert.equal(api.prs.length,1);
 assert.match(api.calls.find(c=>c.path==='pulls'&&c.method==='POST').body.title,/årsresultater/);
 assert.deepEqual(api.calls.find(c=>c.path==='git/trees').body.tree.map(e=>e.path).sort(),PATHS.slice().sort());assert.equal((await adapter.advance(job)).stage,'checking');assert.equal(api.prs[0].merged,false);
 api.state.checks='failed';assert.equal((await adapter.advance(job)).stage,'failed');assert.equal(api.prs[0].merged,false);
 api.state.checks='success';assert.equal((await adapter.advance(job)).stage,'deploying');assert.deepEqual(JSON.parse(api.read('data/history.json')),h);
 assert.deepEqual(D.undoPublishedResults(api.read('data/history.json'),JSON.parse(api.read('tests/public/quick/fixtures/result-publications.json'))),api.read('data/history.json',api.codeSha));
});
