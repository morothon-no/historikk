// Adapt existing source-bound correction/review engines; never a production writer.
'use strict';
const {createHash}=require('node:crypto');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;
const {createReviewService}=require('./review-workspace.cjs');
const {authorize}=require('./access-control.cjs');
const digest=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createResultReview({authenticate,loadContext,store}){
 const service=createReviewService({authenticate,getTrustedBinding:async org=>(await loadContext(org)).base,store});
 async function access(input,action){authorize(await authenticate(input.session),input.organizer,action);}
 async function check(organizer,draft){
  const context=await loadContext(organizer),{history,base,project,linkedRunnerIds=[]}=context;
  // Imported/browser handoff flags are not authenticated approval evidence.
  const parsed=C.parse(C.serialize(draft));
  if(!equal(parsed.base,base))throw Error('Resultatgrunnlaget er foreldet. Last inn oppdatert historikk.');
  if(parsed.cases.some(c=>c.change&&c.change.kind!=='result'))throw Error('Denne første lagringsflyten støtter bare rettelser av eksisterende resultater. Andre forslag beholdes i arbeidslisten.');
  let normalized=C.importPackage(C.empty(base),parsed).package;
  // Avoid accumulating a new untrusted-import event on every preview/reload.
  normalized.cases.forEach((c,i)=>{c.events=parsed.cases[i].events;});
  await C.applyCandidate(history,normalized,base,{preview:true});
  const active=normalized.cases.filter(c=>c.change&&['proposed','handoff'].includes(c.status)),cache=new Map();
  const cachedProject=async data=>{const key=await C.hash(data);if(!cache.has(key))cache.set(key,Promise.resolve(project(data)));return cache.get(key);};
  const review=active.length?await C.reviewStaged(history,normalized,base,cachedProject,{linkedRunnerIds}):{ready:false,uncertain:['Klargjør minst én konkret resultatkorrigering først.'],errors:[],changed:[]};
  if(review.ready)for(const c of active){
   const impact=await C.consequences(history,normalized,c.id,base,cachedProject,{linkedRunnerIds});
   if(!impact.ready){review.ready=false;review.uncertain.push(...impact.uncertain);review.errors.push(...impact.errors);break;}
   // A server-recomputed technical handoff is still stored as status=draft.
   // Authenticated owner approval remains a separate revision/CAS action.
   normalized=C.transition(normalized,c.id,'handoff',c.reason,impact);
  }
  if(!equal((await loadContext(organizer)).base,base))throw Error('Historikken ble oppdatert under kontrollen. Prøv igjen.');
  const changes=active.map(c=>({caseId:c.id,name:history.people.find(p=>p.i===c.personIds[0])?.n||c.personIds[0],before:c.change.before,after:c.change.after,source:c.source,reason:c.reason}));
  return {draft:normalized,review:{ready:review.ready,uncertain:review.uncertain,errors:review.errors,changed:review.changed,changes},digest:digest(normalized),productionApplied:false,publicationAuthorized:false};
 }
 async function load(input){await access(input,'read');const result=await service.load(input);return {...result,digest:result.draft?digest(result.draft):null,productionApplied:result.status==='published',publicationAuthorized:false};}
 async function preview({session,organizer,draft}){
  // Enforce server-verified access before any costly calculation.
  await access({session,organizer},'write');await service.load({session,organizer});return check(organizer,draft);
 }
 async function save(input){
  const checked=await preview(input);
  await access(input,'write'); // Membership/session may have changed during calculation.
  const result=await service.save({...input,draft:checked.draft});return {...result,review:checked.review};
 }
 async function approve(input){
  await access(input,'approve');
  const current=await load(input);
  if(current.revision!==input.expectedRevision||current.digest!==input.expectedDigest)throw Error('Arbeidsgrunnlaget er endret. Hent siste revisjon.');
  const checked=await check(input.organizer,current.draft);
  if(!checked.review.ready)throw Error('Rettelsen krever avklaring før godkjenning: '+checked.review.uncertain.join(' '));
  // Digest/revision CAS and source binding are independently checked again.
  return service.approve(input);
 }
 return {load,preview,save,approve};
}
module.exports={createResultReview};
