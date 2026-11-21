'use strict';
// Adapter to the existing approval/outbox/PR/CI/backup/verification engine.
const C=require('../../../tools/diploma-admin/intake-model.js').Corrections,D=require('../../../tools/diploma-admin/result-release-data.cjs'),
 A=require('../annual-result-candidate.cjs'),{createResultPublication}=require('../result-publication.cjs'),
 {releaseFiles,restoreFiles,JOURNAL}=require('../result-release.cjs'),{authorize}=require('../access-control.cjs'),{digest}=require('./annual-publication-policy.cjs');
const copy=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),stateNamespace=store=>({get:k=>store.get('annual-'+k),transact:(k,r,fn)=>store.transact('annual-'+k,r,fn)});
function createAnnualPublication({enabled=false,authenticate,authorizeActor,store,stateStore,loadContext,adapter,directory,verifyLive,onPublished,checkBuild,clock=Date.now}){
 const state=stateNamespace(stateStore),stamp=()=>new Date(clock()).toISOString();
 async function access(input){if(enabled!==true)throw Error('Årspublisering er ikke aktivert.');const p=await authenticate(input.session);authorize(p,input.organizer,'publish');return p.subject;}
 async function record(input){await access(input);const p=await store.get(input.organizer),ctx=await loadContext(input.organizer);
  if(!p||p.revision!==input.expectedRevision||digest(p)!==input.expectedDigest||((p.annualImport||p.annualReversal)&&!same(p.base,ctx.base)))throw Error('Årsutkastet eller historikken er endret. Hent siste kontroll.');return {p,ctx};}
 async function details(id,org){const job=(await state.get('job-'+String(id).slice(0,48)))?.publication;
  if(!/^[a-f0-9]{64}$/.test(id||'')||!job||job.id!==id||job.organizer!==org||job.publicationKind!=='annual'||job.stage!=='published'||!job.backupVerified)throw Error('Velg en verifisert årspublisering.');
  const before=JSON.parse(restoreFiles(job.before).get('data/history.json')),after=JSON.parse(restoreFiles(job.after).get('data/history.json'));
  if(!same(require('../../../tools/diploma-admin/annual-release-data.cjs').changes(before,after,{reverse:!!job.reversalOf}),job.changes))throw Error('Publiseringsbackupen er endret.');return job;
 }
 async function candidate(input){const {p,ctx}=await record(input);let packet;
  if(p.annualReversal){const job=await details(p.annualReversal.publicationId,input.organizer),snapshot=await adapter.snapshot();
   if(D.hash(snapshot.files.get('data/history.json'))!==ctx.base.historySha256)throw Error('Main er oppdatert.');
   packet={result:{history:D.undoAnnualPublication(ctx.history,JSON.parse(snapshot.files.get(JOURNAL)),job.approval.manifestSha256)},annualReversalManifest:job.approval.manifestSha256};
  }else{if(!p.annualImport)throw Error('Ingen lagret årsimport.');packet=await A.candidate(ctx,p.annualImport.input,p.annualImport.plan);}
  const before=await ctx.project(ctx.history,{includeHonors:true}),after=await ctx.project(packet.result.history,{includeHonors:true}),effects={};
  // Every changed calculation is retained, never just the directly edited runners.
  for(const area of ['people','annual','rankings','records','placements','loyalty','diplomas','honors']){
   if(same(before[area],after[area]))continue;
   if(Array.isArray(before[area]))effects[area]={before:before[area],after:after[area]};
   else effects[area]=Object.fromEntries([...new Set([...Object.keys(before[area]||{}),...Object.keys(after[area]||{})])].filter(k=>!same(before[area]?.[k],after[area]?.[k])).map(k=>[k,{before:before[area]?.[k]??null,after:after[area]?.[k]??null}]));
  }
  const changes=require('../../../tools/diploma-admin/annual-release-data.cjs').changes(ctx.history,packet.result.history,{reverse:!!p.annualReversal}),
   report={ready:true,operation:p.annualReversal?'reverse':'import',reversalOf:p.annualReversal?.publicationId||null,
    candidateDigest:D.hash(JSON.stringify({base:ctx.base,digest:digest(p),after:D.hash(D.encode(packet.result.history)),changes,effects})),changes,effects};
  if(Buffer.byteLength(JSON.stringify(report))>6*1024*1024)throw Error('Konsekvensrapporten er for stor. Avgrens importen uten å utelate avvik.');
  if(!same((await loadContext(input.organizer)).base,ctx.base))throw Error('Historikken er oppdatert under beregningen.');return {p,ctx,packet,report};
 }
 const review={async load(input){await access(input);const p=await store.get(input.organizer),ctx=await loadContext(input.organizer);
  return {revision:p?.revision||0,digest:digest(p),status:p?.approval?.scope==='annual-publication'?p.status:'draft',approval:p?.approval||null,
   draft:p?.draft||C.empty(ctx.base),reversalOf:p?.annualReversal?.publicationId||null,stale:!!p&&!same(p.base,ctx.base)};}};
 const strategy={kind:'annual',async candidate(input,current){const r=await candidate({...input,expectedRevision:current.revision,expectedDigest:current.digest});
   if(r.p.approval?.candidateDigest!==r.report.candidateDigest)throw Error('Godkjenningen gjelder et annet før-/etter-grunnlag.');return r.packet;},
  release:({files,after,packet})=>releaseFiles({files,after},(bytes,after,j,meta)=>D.appendAnnualPublication(bytes,after,j,{...meta,reverses:packet.annualReversalManifest||null})),
  personIds:changes=>[...new Set(changes.flatMap(c=>c.field==='people'?[c.before?.i,c.after?.i]:c.field==='results'?[c.before?.[1],c.after?.[1]]:[]).filter(Boolean))],
  async verified(job,p,newBase){return {status:'draft',base:copy(newBase),draft:C.empty(newBase),digest:null,annualImport:null,approval:null,annualReversal:null,
    lastAnnualPublication:job.id,archives:[...(p.archives||[]),...(p.annualImport?[{...copy(p.annualImport),base:p.base,digest:p.digest,approval:p.approval,publicationId:job.id,archivedBy:job.actor,archivedAt:stamp()}]:[])]};},
  async reverse(input,job,ctx,snapshot){await details(job.id,input.organizer);const p=await store.get(input.organizer);
   if(p?.annualImport||p?.publicationLock||p?.annualReversal)throw Error('Avklar det aktive private årsutkastet før tilbakeføring.');
   if(D.hash(snapshot.files.get('data/history.json'))!==ctx.base.historySha256)throw Error('Main er oppdatert.');
   D.undoAnnualPublication(ctx.history,JSON.parse(snapshot.files.get(JOURNAL)),job.approval.manifestSha256);const actor=await access(input);
   await store.transact(input.organizer,p.revision,r=>({...r,revision:r.revision+1,base:copy(ctx.base),draft:C.empty(ctx.base),status:'draft',approval:null,annualReversal:{publicationId:job.id},events:[...r.events,{action:'annual-reversal-prepared',actor,at:stamp(),publicationId:job.id}]}));return review.load(input);
  }};
 const publication=createResultPublication({authenticate,authorizeActor,review,reviewStore:store,stateStore:state,loadContext,adapter,directory,verifyLive,onPublished,checkBuild,clock,strategy});
 async function approve(input){const actor=await access(input),r=await candidate(input);
  if(input.candidateDigest!==r.report.candidateDigest)throw Error('Bekreft den eksakte serverberegnede konsekvensrapporten.');
  await store.transact(input.organizer,input.expectedRevision,p=>{
   if(p.publicationLock||digest(p)!==input.expectedDigest||!same(p.base,r.ctx.base))throw Error('Årsgrunnlaget er endret.');
   return {...p,revision:p.revision+1,status:'review-approved',approval:{scope:'annual-publication',by:actor,at:stamp(),base:copy(p.base),digest:digest(p),candidateDigest:r.report.candidateDigest},
    events:[...p.events,{action:'annual-publication-approved',actor,at:stamp(),digest:input.expectedDigest}]};});return review.load(input);
 }
 return {load:review.load,preview:async input=>(await candidate(input)).report,approve,
  async publish(input){const {p}=await record(input);if(p.status!=='review-approved'||p.approval?.scope!=='annual-publication')throw Error('Godkjenn siste lagrede årsutkast først.');const job=await publication.prepare(input);await publication.publish({...input,id:job.id,confirmation:job.manifestSha256});return job;},
  async cancel(input){const actor=await access(input);await store.transact(input.organizer,input.expectedRevision,p=>{
   if(!p||p.publicationLock||digest(p)!==input.expectedDigest)throw Error('Kontroller pågående publisering først.');return {...p,revision:p.revision+1,status:'draft',approval:null,annualReversal:null,events:[...p.events,{action:'annual-approval-cancelled',actor,at:stamp()}]};});return review.load(input);},
  status:async input=>{await access(input);return publication.status(input);},progress:async input=>{await access(input);return publication.progress(input.organizer);},
  retry:async input=>{await access(input);return publication.retry(input);},reverse:async input=>{await record(input);return publication.reverse(input);}};
}
module.exports={createAnnualPublication,stateNamespace};
