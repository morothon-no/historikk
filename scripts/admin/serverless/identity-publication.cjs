"use strict";
// Identity adapter for the established publication outbox; no second publisher.
const C=require('../../../tools/diploma-admin/intake-model.js').Corrections,
 H=require('../../../js/history-data.js'),
 D=require('../../../tools/diploma-admin/result-release-data.cjs'),
 {createResultPublication}=require('../result-publication.cjs'),
 {releaseFiles,restoreFiles,JOURNAL}=require('../result-release.cjs'),
 {carryIdentityEvidence}=require('../identity-review.cjs'),
 {authorize}=require('../access-control.cjs'),{digest}=require('./identity-publication-policy.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=v=>structuredClone(v);
const stateNamespace=store=>({get:key=>store.get('identity-'+key),transact:(key,rev,fn)=>store.transact('identity-'+key,rev,fn)});
function createIdentityPublication({enabled=false,authenticate,authorizeActor,identity,store,stateStore,loadContext,adapter,
 directory,verifyLive,onPublished,checkBuild,clock=Date.now}){
 const state=stateNamespace(stateStore),stamp=()=>new Date(clock()).toISOString();
 const carryMarker=job=>'identity-pub-carried-'+job.id.slice(0,32);
 const untouched=(c,job)=>{const at=c.events.findLastIndex(e=>e.action===carryMarker(job)&&e.reason===job.id);
  return at>=0&&!c.events.slice(at+1).some(e=>/^identity-(same-person|different-people|defer|rename|alias)$/.test(e.action));};
 async function retained(p,current,job,at){
  let source=copy(p);
  if(job.reversalOf){const original=await details(job.reversalOf,job.organizer);
   source.draft.cases=source.draft.cases.map(c=>{const old=original.draft.cases.find(old=>old.id===c.id);
    return old&&untouched(c,original)?{...copy(old),events:copy(c.events)}:c;});}
  let draft=await carryIdentityEvidence(source,current,at);const model=H.create(current.history),suggestions=C.discover({...current.history,results:[]});
  for(const old of source.draft.cases){
   if(draft.cases.some(c=>c.id===old.id)||old.change&&old.status!=='rejected'||!old.events.some(e=>['identity-defer','identity-different-people'].includes(e.action)))continue;
   const ids=old.personIds.map(id=>model.resolve(id));
   if(new Set(ids).size!==ids.length)throw Error('En uavklart eller avvist sak berøres av sammenslåingen.');
   const suggestion=suggestions.find(s=>same([...s.personIds].sort(),[...ids].sort()));
   draft=suggestion?(await C.openSuggestion(draft,suggestion,old.id)).package:C.report(draft,{id:old.id,personIds:ids,category:old.category,description:old.description,source:old.source});
   draft=C.updateNotes(draft,old.id,{description:old.description,source:old.source,reason:old.reason});
   draft=C.transition(draft,old.id,old.status==='rejected'?'rejected':'review',old.reason);
   const next=draft.cases.at(-1);next.createdAt=old.createdAt;next.events=[...copy(old.events),...next.events,
    {at,action:old.status==='rejected'?'identity-different-people':'identity-defer',reason:'Bevart etter verifisert publisering.'}];
  }
  for(const c of draft.cases)c.events.push({at,action:carryMarker(job),reason:job.id});
  return draft;
 }
 async function access(input){if(enabled!==true)throw Error('Identitetspublisering er ikke aktivert.');
  const actor=await authenticate(input.session);authorize(actor,input.organizer,'publish');return actor.subject;}
 async function record(input){await access(input);const p=await store.get(input.organizer),ctx=await loadContext(input.organizer);
  if(!p||!same(p.base,ctx.base)||p.revision!==input.expectedRevision||digest(p)!==input.expectedDigest)
   throw Error('Identitetsrevisjonen eller historikken er endret. Hent siste kontroll.');
  return {p,ctx};}
 async function details(id,organizer){const job=(await state.get('job-'+String(id).slice(0,48)))?.publication;
  if(!/^[a-f0-9]{64}$/.test(id||'')||!job||job.id!==id||job.organizer!==organizer||job.publicationKind!=='identity'||job.stage!=='published'||!job.backupVerified)
   throw Error('Velg en verifisert identitetspublisering.');
  const before=JSON.parse(restoreFiles(job.before).get('data/history.json')),after=JSON.parse(restoreFiles(job.after).get('data/history.json'));
  if(!same(D.identityChanges(before,after),job.changes))throw Error('Tilbakeføringsgrunnlaget er endret.');return job;}
 async function candidate(input){const {p,ctx}=await record(input);let packet,selectedIds=[],deferred=0,different=0;
  if(p.identityReversal){
   const job=await details(p.identityReversal.publicationId,input.organizer),snapshot=await adapter.snapshot();
   if(D.hash(snapshot.files.get('data/history.json'))!==ctx.base.historySha256)throw Error('Main er endret.');
   const history=D.undoIdentityPublication(ctx.history,JSON.parse(snapshot.files.get(JOURNAL)),job.approval.manifestSha256);
   packet={result:{history}};
  }else{
   const checked=await identity.publicationCandidate({...input,expectedDigest:D.hash(JSON.stringify(p.draft))});
   ({packet,selectedIds,deferred,different}=checked);
   const after=H.create(packet.result.history);
   if(p.draft.cases.some(c=>c.status==='review'&&c.personIds.length===2&&after.resolve(c.personIds[0])===after.resolve(c.personIds[1])))
    throw Error('En utsatt identitetssak må avklares før denne sammenslåingen publiseres.');
  }
  deferred=p.draft.cases.filter(c=>c.status==='review'&&!c.change).length;different=p.draft.cases.filter(c=>c.status==='rejected').length;
  const changes=D.identityChanges(ctx.history,packet.result.history),ids=personIds(changes),
   before=await ctx.project(ctx.history),after=await ctx.project(packet.result.history),
   candidateDigest=D.hash(JSON.stringify({base:ctx.base,digest:digest(p),after:D.hash(D.encode(packet.result.history)),selectedIds}));
  const selected=new Set(ids);
  const otherRankingChanges=[...new Set([...Object.keys(before.rankings),...Object.keys(after.rankings)])]
   .filter(id=>!selected.has(id)&&!same(before.rankings[id],after.rankings[id])).length;
  const affected=(view,history)=>({profiles:Object.fromEntries(ids.map(id=>[id,view.people[id]||null])),
    aliases:Object.fromEntries(ids.map(id=>[id,history.aliases?.[id]||[]])),
    redirects:Object.fromEntries(ids.map(id=>[id,history.redirects?.[id]||null])),
    placements:view.placements.filter(row=>ids.includes(row.personId)),records:view.records,
    rankings:Object.fromEntries(ids.map(id=>[id,view.rankings[id]??null])),
    loyalty:Object.fromEntries(ids.map(id=>[id,view.loyalty[id]||null]))});
  // Persist exact ranks for the affected profiles and count secondary rank changes.
  // Candidate validation and comparison still run on the complete projections.
  const report={ready:true,operation:p.identityReversal?'reverse':'merge',reversalOf:p.identityReversal?.publicationId||null,
   candidateDigest,otherRankingChanges,merges:selectedIds.length,retained:{deferred,different},personIds:ids,
   before:affected(before,ctx.history),after:affected(after,packet.result.history),changed:Object.keys(before).filter(k=>!same(before[k],after[k]))};
  if(Buffer.byteLength(JSON.stringify(report))>96*1024)throw Error('Konsekvensrapporten er for stor. Avgrens utvalget.');
  if(!same((await loadContext(input.organizer)).base,ctx.base))throw Error('Historikken ble endret under kontrollen.');
  return {p,ctx,packet,report};
 }
 function personIds(changes){return [...new Set(changes.flatMap(c=>[c.key,...(c.field==='redirects'?[c.before,c.after].filter(Boolean):[])]))];}
 const review={
  async load(input){await access(input);const p=await store.get(input.organizer),ctx=await loadContext(input.organizer);
   return {revision:p?.revision||0,status:p?.approval?.scope==='identity-publication'?p.status:'draft',
    draft:p?.draft||C.empty(ctx.base),digest:digest(p),approval:p?.approval||null,reversalOf:p?.identityReversal?.publicationId||null,stale:!!p&&!same(p.base,ctx.base)};},
 };
 const strategy={kind:'identity',
  async candidate(input,current){const computed=await candidate({...input,expectedRevision:current.revision,expectedDigest:current.digest});
   if(computed.p.approval?.candidateDigest!==computed.report.candidateDigest)throw Error('Godkjenningen gjelder et annet før-/etter-grunnlag.');
   return computed.packet;},
  release:input=>releaseFiles(input,D.appendIdentityPublication),personIds,
  async verified(job,p,newBase){const current=await loadContext(job.organizer),at=stamp();
   if(!same(current.base,newBase))throw Error('Den verifiserte kilden er endret.');
   const draft=await retained(p,current,job,at);
   return {status:'draft',base:copy(newBase),draft,approval:null,identityReversal:null,lastIdentityPublication:job.id,
    archives:[...(p.archives||[]),{base:p.base,draft:p.draft,approval:p.approval,digest:D.hash(JSON.stringify(p.draft)),
     archivedBy:job.actor,archivedAt:at,publicationId:job.id}]};},
  async reverse(input,job,ctx,snapshot){await details(job.id,input.organizer);const loaded=await review.load(input);
   if(loaded.stale||loaded.draft.cases.some(c=>c.change&&c.status!=='rejected'))throw Error('Avklar aktive identitetsforslag før tilbakeføring.');
   if(loaded.draft.cases.some(c=>c.personIds.some(id=>job.personIds.includes(id))&&!untouched(c,job)))
    throw Error('Nyere private avgjørelser berører identiteten. Tilbakeføring krever manuell avklaring.');
   D.undoIdentityPublication(ctx.history,JSON.parse(snapshot.files.get(JOURNAL)),job.approval.manifestSha256);
   const actor=await access(input);
   await store.transact(input.organizer,loaded.revision,p=>{
    if(p.publicationLock||!same(p.base,ctx.base))throw Error('Arbeidsgrunnlaget er låst eller endret.');
    return {...p,revision:p.revision+1,status:'draft',approval:null,identityReversal:{publicationId:job.id},
     events:[...p.events,{action:'identity-reversal-prepared',actor,at:stamp(),publicationId:job.id}]};});
   return review.load(input);},
 };
 const publication=createResultPublication({authenticate,authorizeActor,review,reviewStore:store,stateStore:state,
  loadContext,adapter,directory,verifyLive,onPublished,checkBuild,clock,strategy});
 async function preview(input){const computed=await candidate(input);return {revision:computed.p.revision,digest:digest(computed.p),...computed.report};}
 async function approve(input){const actor=await access(input),computed=await candidate(input);
  if(input.candidateDigest!==computed.report.candidateDigest)throw Error('Kontroller nøyaktig dette før-/etter-grunnlaget før godkjenning.');
  await store.transact(input.organizer,input.expectedRevision,p=>{
   if(p.publicationLock||digest(p)!==input.expectedDigest||!same(p.base,computed.ctx.base))throw Error('Arbeidsgrunnlaget er endret.');
   return {...p,revision:p.revision+1,status:'review-approved',approval:{scope:'identity-publication',by:actor,at:stamp(),base:copy(p.base),
    digest:digest(p),candidateDigest:computed.report.candidateDigest},events:[...p.events,{action:'identity-publication-approved',actor,at:stamp(),digest:input.expectedDigest}]};});
  return review.load(input);
 }
 async function publish(input){await access(input);const p=await record(input);
  if(p.p.status!=='review-approved'||p.p.approval?.scope!=='identity-publication')throw Error('Godkjenn siste lagrede identitetskontroll først.');
  const job=await publication.prepare(input);await publication.publish({...input,id:job.id,confirmation:job.manifestSha256});return job;
 }
 async function cancel(input){const actor=await access(input);await store.transact(input.organizer,input.expectedRevision,p=>{
  if(!p||digest(p)!==input.expectedDigest||p.publicationLock)throw Error('Publiseringen er endret eller må avklares først.');return {...p,revision:p.revision+1,status:'draft',approval:null,identityReversal:null,
   events:[...p.events,{action:'identity-publication-review-cancelled',actor,at:stamp()}]};});return review.load(input);}
 return {preview,approve,publish,cancel,load:review.load,
  status:async input=>{await access(input);return publication.status(input);},
  progress:async input=>{await access(input);return publication.progress(input.organizer);},
  retry:async input=>{await access(input);return publication.retry(input);},
  reverse:async input=>{await record(input);return publication.reverse(input);}};
}
module.exports={createIdentityPublication,stateNamespace};
