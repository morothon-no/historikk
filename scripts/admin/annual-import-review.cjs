'use strict';
// Thin private workspace over the existing encrypted CAS adapter. No HTTP route,
// new database, approval, publisher, background job or production file writer.
const path=require('node:path'),Contract=require('./annual-result-import.cjs'),
 {privateFileStore}=require('./review-workspace.cjs'),{authorize}=require('./access-control.cjs'),
 C=require('../../tools/diploma-admin/intake-model.js').Corrections;
const SCOPE='annual-result-import-v1',scoped=Symbol('annual-import-store'),copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function comparePlans(previous,next){
 const entries=plan=>(plan?.operations||[]).filter(o=>o.after).map(o=>[o.beforeIndex!==null?'existing-'+o.beforeIndex:
  JSON.stringify([o.after[0],o.after[1],o.after[2],o.after[3],o.after[9]]),o.after]),old=new Map(entries(previous)),fresh=new Map(entries(next)),items=[];
 for(const [key,after]of fresh){const before=old.get(key)||null;items.push({kind:before?same(before,after)?'unchanged':'changed':'added',before,after});}
 for(const [key,before]of old)if(!fresh.has(key))items.push({kind:'missing',before,after:null});
 return {added:items.filter(i=>i.kind==='added').length,changed:items.filter(i=>i.kind==='changed').length,
  unchanged:items.filter(i=>i.kind==='unchanged').length,missing:items.filter(i=>i.kind==='missing').length,items};
}
function annualImportStore({openNamespace}){
 const backing=openNamespace(SCOPE);
 if(!backing?.get||!backing?.transact)throw Error('Separat kryptert årsimportlager kreves.');
 function checked(record,organizer){
  if(record&&(record.module!==SCOPE||record.organizer!==organizer||record.status!=='draft'))throw Error('Feil arrangør eller modul i årsimportlageret.');
  if(record){Contract.validate(record.annualImport.input);const plan=record.annualImport.plan,{checksum,...body}=plan;
   if(record.digest!==Contract.hash(record.annualImport.input)||checksum!==Contract.hash(body)||
      plan.productionApplied!==false||plan.publicationAuthorized!==false||!same(record.base,record.annualImport.input.base))throw Error('Årsimportgrunnlaget er endret.');
   C.validatePackage(record.draft);if(record.draft.cases.length)throw Error('Årsimport og eldre resultatsaker skal ikke blandes.');
  }
  return record;
 }
 return {[scoped]:true,get:async org=>checked(await backing.get(org),org),
  transact:(org,revision,update)=>backing.transact(org,revision,p=>{checked(p,org);return checked({...update(p),module:SCOPE,organizer:org},org);})};
}
function privateAnnualImportFileStore({directory,key}){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('Privat, absolutt lagringsmappe kreves.');
 return annualImportStore({openNamespace:scope=>privateFileStore({directory:path.join(directory,scope),key})});
}
function createAnnualImportReview({authenticate,loadContext,store,clock=Date.now}){
 if(!store?.[scoped]||typeof authenticate!=='function'||typeof loadContext!=='function')throw Error('Autentisering, betrodd kilde og modulavgrenset lager kreves.');
 async function access(input,action){const actor=await authenticate(input.session);authorize(actor,input.organizer,action);return actor.subject;}
 async function context(organizer){const ctx=await loadContext(organizer);if(ctx.organizer!==organizer)throw Error('Feil arrangørgrunnlag.');return ctx;}
 function binding(input){if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||
  !(input.expectedDigest===null||/^[a-f0-9]{64}$/.test(input.expectedDigest||'')))throw Error('Eksakt privat revisjon og kontrollsum kreves.');}
 function current(record,input){if((record?.revision||0)!==input.expectedRevision||(record?.digest||null)!==input.expectedDigest)throw Error('Årsimporten er endret. Hent siste private revisjon.');}
 const flags={productionApplied:false,publicationAuthorized:false};
 async function load(input){await access(input,'read');const [record,ctx]=await Promise.all([store.get(input.organizer),context(input.organizer)]);
  if(!record)return {scope:SCOPE,revision:0,digest:null,status:'empty',persisted:false,stale:false,input:null,plan:null,...flags};
  const stale=!same(record.base,ctx.base);
  if(!stale)await Contract.verify(ctx,record.annualImport.input,record.annualImport.plan);
  return {scope:SCOPE,revision:record.revision,digest:record.digest,status:'draft',persisted:true,stale,
   input:copy(record.annualImport.input),plan:copy(record.annualImport.plan),events:copy(record.events),archives:copy(record.archives||[]),...flags};
 }
 async function preview(input){input={...input,input:copy(input.input)};await access(input,'write');const ctx=await context(input.organizer),record=await store.get(input.organizer);
  const plan=await Contract.prepare(ctx,input.input);
  if(!same((await context(input.organizer)).base,ctx.base))throw Error('Historikken ble oppdatert under kontrollen.');
  return {plan,previous:record?{revision:record.revision,digest:record.digest,summary:copy(record.annualImport.plan.summary)}:null,
   comparison:record?comparePlans(record.annualImport.plan,plan):null,
   replacesPrivateSource:!!record&&Contract.hash(record.annualImport.input.source)!==Contract.hash(input.input.source),...flags};
 }
 async function save(input){input={...input,input:copy(input.input)};await access(input,'write');binding(input);
  if(typeof input.replaceCurrent!=='boolean')throw Error('Velg uttrykkelig om forrige private fil skal erstattes.');
  const previous=await store.get(input.organizer);current(previous,input);
  const checked=await preview(input),digest=Contract.hash(input.input),ctx=await context(input.organizer);
  if(previous&&!same(previous.base,ctx.base))throw Error('Lagret årsimport bruker en foreldet historikk. Bevar den og avklar ny kilde først.');
  if(checked.replacesPrivateSource&&!input.replaceCurrent)throw Error('En annen fil er lagret privat. Gjennomgå forskjellene og bekreft utskifting av utkastet.');
  const actor=await access(input,'write');
  if(!same(checked.plan.base,ctx.base)||!same((await context(input.organizer)).base,ctx.base))throw Error('Historikken er endret. Ingen ny årsimport er lagret.');
  if(previous?.digest===digest){current(await store.get(input.organizer),input);return {...await load(input),changed:false};}
  const at=new Date(clock()).toISOString();
  await store.transact(input.organizer,input.expectedRevision,p=>{
   current(p,input);if(p?.publicationLock)throw Error('En publisering må avklares først.');
   return {v:1,revision:input.expectedRevision+1,status:'draft',base:copy(ctx.base),draft:C.empty(ctx.base),digest,
    annualImport:{input:copy(input.input),plan:copy(checked.plan)},approval:null,
    archives:[...(p?.archives||[]),...(checked.replacesPrivateSource?[{input:copy(p.annualImport.input),plan:copy(p.annualImport.plan),digest:p.digest,by:actor,at}]:[])],
    events:[...(p?.events||[]),{action:'annual-import-saved',actor,at,digest,sourceSha256:checked.plan.sourceSha256}]};
  });
  return {...await load(input),changed:true};
 }
 return {load,preview,save};
}
module.exports={SCOPE,annualImportStore,privateAnnualImportFileStore,createAnnualImportReview};
