// One-owner publication outbox. All writes require server-side authorization.
// Uses the existing encrypted/CAS storage and existing correction engine.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;
const {authorize}=require('./access-control.cjs');
const {releaseFiles,backupFiles,restoreFiles,PATHS}=require('./result-release.cjs');
const {hash}=require('../../tools/diploma-admin/result-release-data.cjs');
const {buildSite}=require('../build-site.cjs'),{readApprovedPackage}=require('../lib/public-package.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=v=>JSON.parse(JSON.stringify(v));
const terminal=new Set(['published','failed','cancelled','needs-review']);
async function checkReleaseBuild(release,snapshot,{directory}){
 const dir=await fs.mkdtemp(path.join(directory,'release-check-'));await fs.chmod(dir,0o700);
 try{
  const pkg=path.join(dir,'package');await fs.mkdir(path.join(pkg,'data'),{recursive:true,mode:0o700});
  for(const name of ['history','honors','volunteers','badges','event-dates'])await fs.writeFile(path.join(pkg,'data',name+'.json'),name==='history'?release.files.get('public-data/data/history.json'):snapshot.files.get('public-data/data/'+name+'.json'));
  await fs.writeFile(path.join(pkg,'manifest.json'),release.files.get('public-data/manifest.json'));
  await readApprovedPackage(pkg,{approval:release.approval,assetsRoot:path.resolve(__dirname,'../..')});
  const build=await buildSite(path.join(dir,'site'),{dataDir:pkg,approval:release.approval});
  return {version:build.version,siteUrl:JSON.parse(await fs.readFile(path.join(build.out,'build-info.json'))).siteUrl,files:Object.fromEntries(await Promise.all(build.files.map(async p=>[p,hash(await fs.readFile(path.join(build.out,p)))])))};
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
function createResultPublication({authenticate,authorizeActor,review,reviewStore,stateStore,loadContext,adapter,verifyLive,onPublished,checkBuild,directory,clock=Date.now,strategy=null}={}){
 if(!adapter?.snapshot||!adapter?.submit||!adapter?.advance||typeof verifyLive!=='function'||typeof onPublished!=='function'||typeof authorizeActor!=='function')throw Error('Autorisert publisering, deploy-verifikasjon og kildeoppdatering kreves.');
 let progressing=false,mutation=Promise.resolve();
 const exclusive=fn=>{const result=mutation.then(fn);mutation=result.catch(()=>{});return result;};
 const orgKey=org=>'latest-'+org,jobKey=id=>'job-'+id.slice(0,48);
 const stamp=()=>new Date(clock()).toISOString();
 async function access(session,organizer,action='publish'){const principal=await authenticate(session);authorize(principal,organizer,action);return principal.subject;}
 async function getJob(id){if(!/^[a-f0-9]{64}$/.test(id||''))throw Error('Ugyldig publiseringsjobb.');const job=(await stateStore.get(jobKey(id)))?.publication||null;if(job&&(job.id!==id||(strategy?job.publicationKind!==strategy.kind:job.publicationKind!==undefined)))throw Error('Publiserings-ID stemmer ikke.');return job;}
 async function writeJob(job,action){const key=jobKey(job.id),old=await stateStore.get(key);await stateStore.transact(key,old?.revision||0,p=>({v:1,revision:(p?.revision||0)+1,status:'draft',base:copy(job.base),draft:copy(job.draft),events:[...(p?.events||[]),{action,actor:job.actor,at:stamp()}],publication:copy(job)}));return job;}
 async function latest(org){const p=await stateStore.get(orgKey(org)),job=p?.publicationId?await getJob(p.publicationId):null;if(job&&job.organizer!==org)throw Error('Publiseringen tilhører en annen arrangør.');return job;}
 async function point(job){const key=orgKey(job.organizer),old=await stateStore.get(key);await stateStore.transact(key,old?.revision||0,p=>({v:1,revision:(p?.revision||0)+1,status:'draft',base:copy(job.base),draft:C.empty(job.base),events:[],publicationId:job.id}));}
 function publicJob(job){if(!job)return null;return {...(strategy?{kind:strategy.kind,reversalOf:job.reversalOf||null}:{}),id:job.id,stage:job.stage,actor:job.actor,authorizedAt:job.authorizedAt||null,createdAt:job.createdAt,dataVersion:job.approval.dataVersion,manifestSha256:job.approval.manifestSha256,changes:job.changes,remote:job.remote||null,mergeCommit:job.mergeCommit||null,error:job.error||null,backupVerified:job.backupVerified,publishedAt:job.publishedAt||null,productionApplied:job.stage==='published',canReverse:job.stage==='published',profiles:job.stage==='published'?job.personIds.map(id=>new URL('index.html#lop='+encodeURIComponent(id),job.build.siteUrl).href):[]};}
 async function status({session,organizer}){await access(session,organizer,'read');return {enabled:true,job:publicJob(await latest(organizer))};}
 async function prepare(input){
  const actor=await access(input.session,input.organizer),current=await review.load(input),old=await latest(input.organizer);
  if((await reviewStore.get(input.organizer))?.publicationLock||old&&!terminal.has(old.stage)&&old.stage!=='prepared')throw Error('En publisering pågår allerede. Kontroller status først.');
  if(current.status!=='review-approved'||current.stale||current.revision!==input.expectedRevision||current.digest!==input.expectedDigest||current.approval?.digest!==current.digest)throw Error('Godkjenn nøyaktig siste lagrede rettelse før publisering.');
  const context=await loadContext(input.organizer);if(!same(context.base,current.draft.base))throw Error('Historikken er endret.');
  const packet=strategy?await strategy.candidate(input,current,context):await C.createCandidate(context.history,current.draft,context.base,context.project,{linkedRunnerIds:context.linkedRunnerIds||[]});
  if(!strategy){const restored=await C.restoreCandidate(packet.result.history,packet);if(!same(restored.history,context.history))throw Error('Tilbakeføringskontrollen feilet.');}
  const snapshot=await adapter.snapshot();
  if(hash(snapshot.files.get('public-data/data/history.json'))!==context.base.historySha256||hash(snapshot.files.get('public-data/manifest.json'))!==context.base.manifestSha256)throw Error('Main og redigeringsgrunnlaget har ulike dataversjoner.');
  const release=strategy?strategy.release({files:snapshot.files,after:packet.result.history,packet}):releaseFiles({files:snapshot.files,after:packet.result.history}),before=backupFiles(snapshot.files),after=backupFiles(release.files);
  // Restore the actual saved backup bytes before accepting the publication plan.
  const recovered=restoreFiles(before);for(const p of PATHS)if(!recovered.get(p).equals(snapshot.files.get(p)))throw Error('Sikkerhetskopien kunne ikke gjenopprettes.');
  const build=await (checkBuild||checkReleaseBuild)(release,snapshot,{directory});
  const id=hash(JSON.stringify({organizer:input.organizer,revision:current.revision,digest:current.digest,base:snapshot.sha,manifest:release.approval.manifestSha256,...(strategy?{kind:strategy.kind}:{})}));
  const job={...(strategy?{publicationKind:strategy.kind,reversalOf:current.reversalOf||null}:{}),id,organizer:input.organizer,actor,stage:'prepared',createdAt:stamp(),base:copy(context.base),draft:copy(current.draft),approvedRevision:current.revision,approvedDigest:current.digest,baseCommit:snapshot.sha,variables:snapshot.variables,approval:release.approval,before,after,otherFiles:Object.fromEntries([...snapshot.files].filter(([p])=>!PATHS.includes(p)).map(([p,b])=>[p,b.toString('base64')])),changes:release.changes,personIds:strategy?strategy.personIds(release.changes):[...new Set(release.changes.flatMap(c=>[c.before[1],c.after[1]]))],backupVerified:true,build};
  await writeJob(job,'publication-prepared');if(old?.stage==='prepared'&&old.id!==job.id){old.stage='cancelled';await writeJob(old,'publication-plan-superseded');}await point(job);return publicJob(job);
 }
 async function publish({session,organizer,id,confirmation}){
  const actor=await access(session,organizer),job=await getJob(id);
  if(!job||job.organizer!==organizer||job.stage!=='prepared'||confirmation!==job.approval.manifestSha256)throw Error('Bekreft denne eksakte publiseringspakken.');
  if(actor!==job.actor)throw Error('Publiseringsplanen tilhører en annen administrator.');
  await reviewStore.transact(organizer,job.approvedRevision,p=>{
   if(!p||p.status!=='review-approved'||p.approval?.digest!==job.approvedDigest||p.publicationLock)throw Error('Rettelsen er endret eller reservert.');
   return {...p,revision:p.revision+1,publicationLock:{id:job.id},events:[...p.events,{action:'publication-authorized',actor,at:stamp(),digest:job.approval.manifestSha256}]};
  });
  job.stage='submitting';job.authorizedAt=stamp();await writeJob(job,'publication-authorized');return publicJob(job);
 }
 async function unlock(job,success,newBase){
  const current=await reviewStore.get(job.organizer);if(current?.publicationLock?.id!==job.id)return;
  const verifiedRecord=success&&strategy?await strategy.verified(job,current,newBase):null;
  await reviewStore.transact(job.organizer,current.revision,p=>{
   if(p.publicationLock?.id!==job.id)throw Error('Publiseringsreservasjonen er endret.');
   const {publicationLock,...rest}=p;return {...rest,revision:p.revision+1,...(success?(verifiedRecord||{status:'published',base:copy(newBase),draft:C.empty(newBase),approval:null,lastPublication:job.id}):{}),events:[...p.events,{action:success?'publication-verified':'publication-stopped',actor:job.actor,at:stamp(),digest:job.approval.manifestSha256}]};
  });
 }
 async function progress(organizer){
  if(progressing)return;progressing=true;let job;
  try{
   job=await latest(organizer);if(!job||terminal.has(job.stage))return;
   if(job.stage==='prepared'){
    const record=await reviewStore.get(organizer),intent=record?.events?.findLast(e=>e.action==='publication-authorized'&&e.digest===job.approval.manifestSha256);
    if(record?.publicationLock?.id!==job.id||!intent)return;
    job.stage='submitting';job.authorizedAt=intent.at;await writeJob(job,'publication-intent-recovered');
   }
   await authorizeActor(job.actor,organizer);
   if(clock()-Date.parse(job.authorizedAt)>2*60*60*1000)throw Error('Publiseringens kontrollfrist er utløpt. Kontroller GitHub før videre behandling.');
   if(job.stage==='submitting'){job.remote=await adapter.submit(job);job.stage='checking';await writeJob(job,'publication-submitted');return;}
   const next=await adapter.advance(job);Object.assign(job,next);job.uncertainOutcome=false;await writeJob(job,'publication-'+job.stage);
   if(job.stage==='verifying'){
    const verified=await verifyLive(job); // Both deploy evidence AND actual public data/profile.
    const newBase=await onPublished(job,verified);await unlock(job,true,newBase);
    job.stage='published';job.publishedAt=stamp();await writeJob(job,'publication-verified');
   }else if(terminal.has(job.stage)&&!job.mergeCommit)await unlock(job,false);
  }catch(error){
   if(job){
    if(error.pending&&job.stage==='verifying'){job.error='Venter på at hele nettsiden viser riktig versjon.';await writeJob(job,'publication-propagation-wait');return;}
    job.uncertainOutcome=job.uncertainOutcome||error.uncertain===true;job.stage=job.uncertainOutcome?'needs-review':'failed';job.error=error.message;await writeJob(job,'publication-failed');if(!job.mergeCommit&&!job.uncertainOutcome)await unlock(job,false);
   }
  }finally{progressing=false;}
 }
 async function reverse(input){
  await access(input.session,input.organizer);const job=await getJob(input.id),current=await review.load(input);
  if(!job||job.organizer!==input.organizer||job.stage!=='published')throw Error('Velg en verifisert publisering for tilbakeføring.');
  if(strategy)return strategy.reverse(input,job,await loadContext(input.organizer),await adapter.snapshot());
  if(current.draft?.cases.length)throw Error('Behandle eller forkast det pågående utkastet før tilbakeføring.');
  const context=await loadContext(input.organizer),currentBytes=Buffer.from(JSON.stringify(context.history));
  // Always inspect the journal: equal current bytes can hide a later change-away-and-back.
  {
   const snapshot=await adapter.snapshot(),journal=JSON.parse(snapshot.files.get(require('./result-release.cjs').JOURNAL));
   if(!snapshot.files.get('data/history.json').equals(currentBytes))throw Error('Resultatgrunnlaget er oppdatert. Kontroller på nytt.');
   require('../../tools/diploma-admin/result-release-data.cjs').undoPublishedResults(currentBytes,journal);
   const release=journal.entries.findIndex(e=>e.manifestSha256===job.approval.manifestSha256),rows=new Set(job.changes.map(c=>c.index));
   if(release<0||journal.entries.slice(release+1).some(e=>e.changes.some(c=>rows.has(c.index))))throw Error('Dette resultatet har fått nyere endringer. Tilbakeføring krever manuell avklaring.');
  }
  if(job.changes.some(c=>!same(context.history.results[c.index],c.after)))throw Error('Resultatet er endret etter publisering. Ingen nyere verdier overskrives.');
  let draft=C.empty(context.base);
  for(const c of job.changes){const id='reverse-'+job.id.slice(0,16)+'-'+c.index;
   draft=C.report(draft,{id,category:'Tilbakeføring',personIds:[c.after[1]],description:'Tilbakefør tidligere publisert resultatkorrigering',source:'Verifisert publiseringsbackup '+job.id});
   draft=await C.propose(context.history,draft,id,{kind:'result',personIds:[c.after[1]],selector:await C.resultSelector(context.history,c.index,context.base),after:c.before,source:'Verifisert publiseringsbackup '+job.id,reason:'Eksplisitt foreslått tilbakeføring. Ny godkjenning og publisering kreves.'});
  }
  return review.save({...input,expectedRevision:current.revision,draft});
 }
 async function retry({session,organizer,id}){
  const actor=await access(session,organizer),job=await getJob(id);
  if(!job||job.organizer!==organizer||!['failed','needs-review'].includes(job.stage))throw Error('Denne publiseringen kan ikke kontrolleres på nytt automatisk.');
  await authorizeActor(actor,organizer);
  const record=await reviewStore.get(organizer);
  if(record?.publicationLock?.id!==id){
   if(record?.status!=='review-approved'||record.approval?.digest!==job.approvedDigest)throw Error('Arbeidsgrunnlaget er endret etter at publiseringen stoppet.');
   await reviewStore.transact(organizer,record.revision,p=>({...p,revision:p.revision+1,publicationLock:{id},events:[...p.events,{action:'publication-retry-authorized',actor,at:stamp()}]}));
  }
  job.stage=job.remote?'checking':'submitting';job.error=null;job.authorizedAt=stamp();await writeJob(job,'publication-recheck-authorized');return publicJob(job);
 }
 async function resume(organizer){const job=await latest(organizer);if(job?.stage==='published'){const context=await loadContext(organizer);if(context.base.manifestSha256!==job.approval.manifestSha256){const verified=await verifyLive(job);await onPublished(job,verified);}}else await progress(organizer);}
 return {drain:()=>mutation,prepare:input=>exclusive(()=>prepare(input)),publish:input=>exclusive(()=>publish(input)),status,progress:org=>exclusive(()=>progress(org)),reverse:input=>exclusive(()=>reverse(input)),retry:input=>exclusive(()=>retry(input)),resume:org=>exclusive(()=>resume(org))};
}
module.exports={createResultPublication,checkReleaseBuild};
