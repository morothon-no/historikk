// Server-only, repository-scoped publishing adapter. Login credentials are never used.
'use strict';
const {createSign}=require('node:crypto');
const {PATHS}=require('./result-release.cjs');
const {hash}=require('../../tools/diploma-admin/result-release-data.cjs');
const REPO='morothon-no/historikk',WORKFLOW='pages.yml';
const VARIABLE_NAMES=['MOROTHON_PUBLIC_DATA_SHA256','MOROTHON_REVIEWED_POLICY_HEAD'];
const snapshotFailure=(message,reason)=>Object.assign(Error(message),{publicSnapshotReason:reason});
function createInstallationApi({appId,installationId,privateKey,fetchImpl=fetch,clock=Date.now}){
 if(!/^\d+$/.test(appId||'')||!/^\d+$/.test(installationId||'')||!privateKey)throw Error('GitHub App, installasjon og privat servernøkkel må konfigureres.');
 let cached;
 async function call(route,{method='GET',body,token,allow404=false}={}){
  let r;try{r=await fetchImpl('https://api.github.com'+route,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Morothon-result-publication',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Object.assign(Error('GitHub kunne ikke nås. Kontroller status før nytt forsøk.'),{uncertain:method!=='GET'});}
  if(r.status===404&&allow404)return null;
  if(!r.ok)throw Object.assign(Error('GitHub avviste publiseringshandlingen ('+r.status+'). Ingen sikkerhetssperre er omgått.'),{status:502,githubStatus:r.status});
  if(r.status===204)return null;try{return await r.json();}catch{throw Object.assign(Error('GitHub returnerte et uleselig svar. Kontroller status før nytt forsøk.'),{uncertain:method!=='GET'});}
 }
 async function installationToken(){
  if(cached&&cached.until>clock()+60000)return cached.token;
  const sec=Math.floor(clock()/1000),part=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),unsigned=part({alg:'RS256',typ:'JWT'})+'.'+part({iat:sec-30,exp:sec+540,iss:appId});
  const signer=createSign('RSA-SHA256');signer.update(unsigned);const jwt=unsigned+'.'+signer.sign(privateKey,'base64url');
  const result=await call('/app/installations/'+installationId+'/access_tokens',{method:'POST',token:jwt,body:{repositories:['historikk'],permissions:{contents:'write',pull_requests:'write',actions_variables:'write',actions:'write',checks:'read',administration:'read'}}});
  if(typeof result?.token!=='string'||!Number.isFinite(Date.parse(result.expires_at)))throw Error('GitHub App-token kunne ikke verifiseres.');cached={token:result.token,until:Date.parse(result.expires_at)};return cached.token;
 }
 return async(route,options={})=>{
  if(!route.startsWith('/repos/'+REPO+'/')||route.includes('\\')||route.split(/[/?#]/).some(p=>{try{return decodeURIComponent(p)==='..';}catch{return true;}}))throw Error('Publisering er avgrenset til Morothons repository.');
  return call(route,{...options,token:await installationToken()});
 };
}
function createGitHubPublisher({api,codeSha,appId}={}){
 if(typeof api!=='function'||!/^[a-f0-9]{40}$/.test(codeSha||''))throw Error('En betrodd kodeversjon og serverautentisert GitHub-adapter kreves.');
 const request=(route,options)=>api('/repos/'+REPO+'/'+route,options),get=(route,options)=>request(route,options);
 const encode=s=>encodeURIComponent(s);
 async function file(path,ref){const r=await get('contents/'+path+'?ref='+encode(ref));if(!r||r.type!=='file'||r.encoding!=='base64'||typeof r.content!=='string'||r.size>8*1024*1024)throw Error('Ugyldig kildefil i publiseringsgrunnlaget.');return Buffer.from(r.content,'base64');}
 async function main(){const r=await get('git/ref/heads/main');if(!/^[a-f0-9]{40}$/.test(r?.object?.sha||''))throw Error('Main kunne ikke verifiseres.');return r.object.sha;}
 async function unchangedCode(sha){
  const comparison=await get('compare/'+codeSha+'...'+sha);
  if(!['ahead','identical'].includes(comparison.status)||comparison.merge_base_commit?.sha!==codeSha||!Array.isArray(comparison.files)||comparison.files.some(f=>!PATHS.includes(f.filename)))throw snapshotFailure('Main har nyere kode eller sikkerhetsregler. Oppdater den betrodde adminversjonen først.','SOURCE_VERSION');
 }
 async function protection(){
  const p=await get('branches/main/protection');
  const message='Main må kreve oppdatert PR, pull request og obligatoriske tester også for administratorer.';
  if(p.required_status_checks?.strict!==true)throw snapshotFailure(message,'PROTECTION_STRICT');
  if(p.enforce_admins?.enabled!==true)throw snapshotFailure(message,'PROTECTION_ADMINS');
  if(!p.required_pull_request_reviews)throw snapshotFailure(message,'PROTECTION_REVIEWS');
  const names=[...new Set([...(p.required_status_checks.contexts||[]),...(p.required_status_checks.checks||[]).map(c=>c.context)])];
  for(const name of ['Public-safe source regression','Trusted policy and test plan','Public package, policy and site build','Independent trusted artifact gate'])if(!names.includes(name))throw snapshotFailure('Main mangler påkrevd status: '+name+'.','PROTECTION_CHECKS');
  if((p.required_pull_request_reviews.bypass_pull_request_allowances?.apps||[]).some(a=>String(a.id)===String(appId)))throw snapshotFailure('Publiseringsappen må ikke ha unntak fra PR-beskyttelsen.','PROTECTION_BYPASS');return names;
 }
 async function variable(name){if(!VARIABLE_NAMES.includes(name))throw Error('Ukjent godkjenningsvariabel.');return (await get('actions/variables/'+name,{allow404:true}))?.value??null;}
 async function setVariable(name,value,previous){
  const current=await variable(name);if(current===value)return;
  if(current!==previous)throw Error('Publiseringsgodkjenningen er endret av en annen operasjon.');
  await request('actions/variables'+(current===null?'':'/'+name),{method:current===null?'POST':'PATCH',body:{name,value}});
 }
 async function runs(sha,event){const r=await get('actions/workflows/'+WORKFLOW+'/runs?head_sha='+sha+'&event='+event+'&per_page=30');return (r.workflow_runs||[]).filter(r=>r.head_sha===sha&&r.event===event&&r.path==='.github/workflows/pages.yml');}
 async function sourceHead(onStage){
  onStage('main-ref');const sha=await main();
  onStage('source-version');await unchangedCode(sha);
  return sha;
 }
 async function sourceFiles(sha,paths,requireGreen,onStage){
  onStage('main-ci');
  const production=(await runs(sha,'push')).sort((a,b)=>b.id-a.id)[0];
  if(requireGreen&&(!production||production.status!=='completed'||production.conclusion!=='success'))throw snapshotFailure('Siste produksjonskjøring på main må være grønn før ny publisering.','MAIN_CI');
  onStage('approved-files');
  const files=new Map(await Promise.all(paths.map(async p=>[p,await file(p,sha)])));
  return {sha,files};
 }
 // Private review reads the approved public package, never publication state.
 // There is no option to disable source binding or green-main validation here.
 async function readApprovedSource({onStage=()=>{}}={}){
  const sha=await sourceHead(onStage);
  return sourceFiles(sha,[...['history','honors','volunteers','badges','event-dates'].map(n=>'public-data/data/'+n+'.json'),
    'public-data/manifest.json','.github/public-data-approval.json'],true,onStage);
 }
 async function snapshot({requireGreen=true,onStage=()=>{}}={}){
  const sha=await sourceHead(onStage);
  onStage('main-protection');await protection();
  const source=await sourceFiles(sha,[...PATHS,...['honors','volunteers','badges','event-dates'].map(n=>'public-data/data/'+n+'.json')],requireGreen,onStage);
  onStage('approval-variables');
  return {...source,variables:Object.fromEntries(await Promise.all(VARIABLE_NAMES.map(async n=>[n,await variable(n)])))};
 }
 async function verifyCommit(sha,job){
  const commit=await get('git/commits/'+sha);if(commit.parents?.length!==1||commit.parents[0].sha!==job.baseCommit)throw Error('Publiseringsgrenen har feil forelder.');
  const diff=await get('compare/'+job.baseCommit+'...'+sha);
  if(!Array.isArray(diff.files)||diff.files.length!==PATHS.length||diff.files.some(f=>!PATHS.includes(f.filename)||!['modified','added'].includes(f.status)))throw Error('Publiseringsgrenen inneholder andre filer enn de fem godkjente datafilene.');
  for(const path of PATHS)if(hash(await file(path,sha))!==job.after[path].sha256)throw Error('Publiseringsgrenen avviker fra den godkjente rettelsen.');
 }
 async function submit(job){
  if(await main()!==job.baseCommit)throw Error('Main er endret. Klargjør rettelsen mot siste versjon.');await unchangedCode(job.baseCommit);await protection();
  const identity=job.publicationKind==='identity',label=identity?'identitetsretting':job.publicationKind==='annual'?'årsresultater':'resultatretting';
  const branch='codex/'+(identity?'identity-':job.publicationKind==='annual'?'annual-':'result-')+job.id.slice(0,32);let ref=await get('git/ref/heads/'+branch,{allow404:true});
  if(!ref){
   const base=await get('git/commits/'+job.baseCommit),tree=[];
   for(const path of PATHS){const blob=await request('git/blobs',{method:'POST',body:{content:job.after[path].base64,encoding:'base64'}});tree.push({path,mode:'100644',type:'blob',sha:blob.sha});}
   const nextTree=await request('git/trees',{method:'POST',body:{base_tree:base.tree.sha,tree}}),commit=await request('git/commits',{method:'POST',body:{message:'Morothon: godkjent '+label+' '+job.id.slice(0,12),tree:nextTree.sha,parents:[job.baseCommit]}});
   await request('git/refs',{method:'POST',body:{ref:'refs/heads/'+branch,sha:commit.sha}});ref={object:{sha:commit.sha}};
  }
  const head=ref.object.sha;await verifyCommit(head,job);
  // Private owner approval of exact data-only bytes; untrusted PR code has no
  // access to this adapter or these variables. Existing A1C gates remain intact.
  await setVariable(VARIABLE_NAMES[0],job.approval.manifestSha256,job.variables[VARIABLE_NAMES[0]]);
  await setVariable(VARIABLE_NAMES[1],head,job.variables[VARIABLE_NAMES[1]]);
  const prs=await get('pulls?state=all&head=morothon-no:'+encode(branch)+'&base=main');let pr=prs[0];
  if(!pr)pr=await request('pulls',{method:'POST',body:{base:'main',head:branch,title:'Morothon – godkjent '+label+' '+job.id.slice(0,12),body:'Autentisert publiseringshandling fra Morothon-admin. Kun eksakte, godkjente offentlige data. Jobb '+job.id+'. Ingen private notater eller originalregistre er inkludert.'}});
  return {branch,head,pr:pr.number,url:pr.html_url};
 }
 async function advance(job){
  if(!job.remote)return {stage:'submitting'};
  const pr=await get('pulls/'+job.remote.pr);if(pr.head.sha!==job.remote.head)throw Error('PR-grenen er endret etter godkjenningen.');
  if(pr.merged){
   const merge=pr.merge_commit_sha,commit=await get('git/commits/'+merge);
   if(commit.parents?.length!==2||commit.parents[0].sha!==job.baseCommit||commit.parents[1].sha!==job.remote.head)throw Error('Mergegrunnlaget er endret. Ingen publisering kan bekreftes.');
   for(const path of PATHS)if(hash(await file(path,merge))!==job.after[path].sha256)throw Error('Merget datagrunnlag stemmer ikke med godkjenningen.');
   await setVariable(VARIABLE_NAMES[1],merge,job.remote.head);
   const run=(await runs(merge,'push')).sort((a,b)=>b.id-a.id)[0];
   if(!run||run.status!=='completed')return {stage:'deploying',mergeCommit:merge,runId:run?.id};
   if(run.conclusion!=='success'){
    // Merge SHA is unknowable before GitHub merges. A run that starts before
    // the exact merge-head approval may need one complete, gated rerun.
    if(job.rerunId===run.id&&(run.run_attempt||1)<=job.rerunAttempt)return {stage:'deploying',mergeCommit:merge};
    const jobs=await get('actions/runs/'+run.id+'/jobs?per_page=100'),failures=(jobs.jobs||[]).filter(j=>j.conclusion==='failure');
    if(!job.rerunId&&failures.length&&failures.every(j=>j.name==='Trusted policy and test plan')){await request('actions/runs/'+run.id+'/rerun',{method:'POST'});return {stage:'deploying',mergeCommit:merge,rerunId:run.id,rerunAttempt:run.run_attempt||1};}
    return {stage:'failed',mergeCommit:merge,error:'Main-kjøringen feilet. Pages er ikke bekreftet oppdatert. Kontroller kjøringen før videre behandling.',runId:run.id};
   }
   return {stage:'verifying',mergeCommit:merge,runId:run.id};
  }
  if(pr.state!=='open')throw Error('Publiserings-PR-en er lukket uten merge.');
  if(await main()!==job.baseCommit)throw Error('Main er endret under kontrollen. Ingen merge utføres.');
  const required=await protection();await verifyCommit(job.remote.head,job);
  const run=(await runs(job.remote.head,'pull_request')).filter(r=>(r.pull_requests||[]).some(p=>p.number===job.remote.pr)).sort((a,b)=>b.id-a.id)[0];
  if(!run||run.status!=='completed')return {stage:'checking'};
  if(run.conclusion!=='success')return {stage:'failed',error:'PR-kontrollene feilet. Ingen merge eller publisering er utført.'};
  const checks=await get('commits/'+job.remote.head+'/check-runs?per_page=100&filter=latest');
  if(!required.every(name=>(checks.check_runs||[]).some(c=>c.name===name&&c.app?.slug==='github-actions'&&c.status==='completed'&&c.conclusion==='success')))return {stage:'checking'};
  // Branch protection remains the atomic, server-side up-to-date/PR gate.
  let merged;try{merged=await request('pulls/'+job.remote.pr+'/merge',{method:'PUT',body:{sha:job.remote.head,merge_method:'merge'}});}catch(error){if([403,405].includes(error.githubStatus))return {stage:'needs-review',error:'GitHub krever godkjenning eller endret driftskonfigurasjon før merge. Ingen sperre er omgått.'};throw error;}
  if(merged.merged!==true)return {stage:'needs-review',error:'GitHub krever mer gjennomgang før merge. Ingen sperre er omgått.'};
  await setVariable(VARIABLE_NAMES[1],merged.sha,job.remote.head);return {stage:'deploying',mergeCommit:merged.sha};
 }
 return {readApprovedSource,snapshot,submit,advance,repository:REPO};
}
module.exports={createInstallationApi,createGitHubPublisher};
