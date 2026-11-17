'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{generateKeyPairSync,createVerify}=require('node:crypto');
const {fakeGitHub}=require('./helpers/github-result-api.cjs'),{createInstallationApi,createGitHubPublisher}=require('../scripts/admin/github-result-publisher.cjs');
const {releaseFiles,backupFiles,PATHS}=require('../scripts/admin/result-release.cjs');
async function plan(api){const adapter=createGitHubPublisher({api:api.api,codeSha:api.codeSha,appId:'123'}),s=await adapter.snapshot(),h=JSON.parse(s.files.get('data/history.json'));h.results[0][5]='49:59';const r=releaseFiles({files:s.files,after:h});return {adapter,job:{id:'c'.repeat(64),baseCommit:s.sha,variables:s.variables,approval:r.approval,after:backupFiles(r.files)}};}
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
 const api=createInstallationApi({appId:'123',installationId:'456',privateKey,fetchImpl:async(url,options)=>{calls.push({url,options});if(url.includes('/access_tokens'))return {ok:true,status:201,json:async()=>({token:'synthetic-installation-token',expires_at:new Date(Date.now()+3600000).toISOString()})};return {ok:true,status:200,json:async()=>({ok:true})};}});
 await api('/repos/morothon-no/historikk/git/ref/heads/main');await api('/repos/morothon-no/historikk/compare/'+'a'.repeat(40)+'...'+'b'.repeat(40));assert.equal(calls.filter(c=>c.url.includes('/access_tokens')).length,1);
 const raw=calls[0].options.headers.Authorization.slice(7),parts=raw.split('.'),verify=createVerify('RSA-SHA256');verify.update(parts[0]+'.'+parts[1]);assert.equal(verify.verify(publicKey,parts[2],'base64url'),true);const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.iss,'123');assert.ok(claims.exp-claims.iat<=600);
 const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.repositories,['historikk']);assert.equal(body.permissions.contents,'write');assert.equal(body.permissions.checks,'read');assert.equal(body.permissions.administration,'read');assert.equal(body.permissions.pages,undefined);
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
