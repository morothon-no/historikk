'use strict';
// Authenticated broker transport only. Parsing, identity checks and durable
// acceptance run in the pinned private processor, never in the browser/broker.
const A=require('../annual-result-import.cjs'),{sha,fail}=require('./github-store.cjs'),{token}=require('./auth.cjs');
const {ENABLED,digest:publicationDigest}=require('./annual-publication-policy.cjs');
const SCOPE='annual-result-import-v1',ORG='sogne-morothon',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const PUBLICATION_ACTIONS=['check','approve','publish','continue','reverse','cancel'].map(a=>'annual-publication-'+a);
function publicationCommand(action,value){
 const keys=['id','expectedRevision','expectedDigest',...(action==='annual-publication-approve'?['candidateDigest']:action==='annual-publication-publish'?['confirmation']:action==='annual-publication-reverse'?['publicationId','confirmation']:[])];
 if(!value||Object.keys(value).sort().join('|')!==keys.sort().join('|')||!PUBLICATION_ACTIONS.includes(action)||
   !/^[a-f0-9]{32}$/.test(value.id||'')||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||
   !(value.expectedDigest===null||/^[a-f0-9]{64}$/.test(value.expectedDigest||''))||
   action==='annual-publication-approve'&&!/^[a-f0-9]{64}$/.test(value.candidateDigest||'')||
   ['annual-publication-publish','annual-publication-reverse'].includes(action)&&value.confirmation!==true||
   action==='annual-publication-reverse'&&!/^[a-f0-9]{64}$/.test(value.publicationId||''))throw fail('Ugyldig årspubliseringsforespørsel.');
 return structuredClone(value);
}
function command(value){
 if(!value||Object.keys(value).sort().join('|')!==['id','input','expectedRevision','expectedDigest','replaceCurrent'].sort().join('|')||
    !/^[a-f0-9]{32}$/.test(value.id||'')||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||
    !(value.expectedDigest===null||/^[a-f0-9]{64}$/.test(value.expectedDigest||''))||typeof value.replaceCurrent!=='boolean')throw fail('Ugyldig årsimportforespørsel.');
 try{A.validate(value.input);}catch{throw fail('Ugyldig årsimportgrunnlag. Kontroller filen og valgene.');}
 if(value.input.organizer!==ORG)throw fail('Feil arrangør i årsimporten.',403);
 return structuredClone(value);
}
function checked(record){
 if(record&&(record.module!==SCOPE||record.organizer!==ORG||!['draft','review-approved'].includes(record.status)))throw fail('Ugyldig privat årsimport.',409);
 if(record&&!record.annualImport){if(record.digest!==null||record.status!=='draft'&&!record.annualReversal)throw fail('Ugyldig tomt årsgrunnlag.',409);return record;}
 if(record&&(record.digest!==sha(record.annualImport?.input)||
   record.annualImport?.plan?.productionApplied!==false||record.annualImport?.plan?.publicationAuthorized!==false))throw fail('Ugyldig privat årsimport.',409);
 if(record){const {checksum,...body}=record.annualImport.plan;if(checksum!==sha(body)||!same(record.base,record.annualImport.input.base))throw fail('Endret privat importgrunnlag.',409);}
 return record;
}
function createAnnualImportTransport({imports,requests,control,base,active,idle,queue,dispatch,ownerGithubId,codeSha,workflowSha,publicationEnabled=ENABLED,publicationIdle=async()=>{},clock=Date.now}){
 const available=!!imports&&!!requests;
 const publicTask=t=>t?{id:t.id,state:t.state,action:t.action,error:t.error||null}:null;
 async function load(requestId=null){
  if(!available)throw fail('Privat årsimport er ikke aktivert.',404);
  if(requestId!==null&&!/^[a-f0-9]{32}$/.test(requestId))throw fail('Ugyldig importreferanse.');
  const record=checked(await imports.get(ORG)),pointer=await control.get('annual-current-'+ORG),b=await base(),running=await active(),
   selected=requestId||((running?.scope===SCOPE&&running.annualRequestId)||pointer?.requestId),
   pending=selected?await requests.get('request-'+selected):null,task=pending?await control.get('task-'+pending.task.id):null;
  if(pending&&(pending.task.scope!==SCOPE||pending.task.organizer!==ORG||pending.command.input&&pending.command.input.organizer!==ORG))throw fail('Feil privat importjobb.',409);
  const projection=publicationEnabled===true?await requests.get('publication-'+ORG):null,
   checkedReport=projection?.review&&projection.revisionOfDraft===record?.revision&&projection.digest===publicationDigest(record)&&same(projection.base,b)?projection.review:null;
  return {scope:SCOPE,revision:record?.revision||0,digest:record?.digest||null,persisted:!!record?.annualImport,status:record?.status||'empty',
   stale:!!(record?.annualImport||record?.annualReversal)&&!same(record.base,b),input:record?.annualImport?.input||null,plan:record?.annualImport?.plan||null,
   publication:{enabled:publicationEnabled===true,...(publicationEnabled===true?{digest:publicationDigest(record),locked:!!record?.publicationLock,
    reversalOf:record?.annualReversal?.publicationId||null,review:checkedReport,job:projection?.job||null,history:projection?.history||[]}: {})},
   // Results are written only by the leased private processor. Queuing is not saving.
   request:pending?{id:pending.command.id,action:pending.task.action,input:pending.command.input,
    expectedRevision:pending.command.expectedRevision,expectedDigest:pending.command.expectedDigest,replaceCurrent:pending.command.replaceCurrent,
    result:task?.state==='completed'?pending.result||null:null}:null,
   task:publicTask(task),otherTask:running&&running.scope!==SCOPE?publicTask(running):null,
   productionApplied:false,publicationAuthorized:false};
 }
 async function start(actor,action,value){
  if(!available)throw fail('Privat årsimport er ikke aktivert.',404);
  const publishing=PUBLICATION_ACTIONS.includes(action);
  if(publishing&&publicationEnabled!==true)throw fail('Årspublisering er ikke aktivert.',404);
  if(!publishing&&!['annual-preview','annual-save'].includes(action))throw fail('Ukjent årsimporthandling.',403);
  const input=publishing?publicationCommand(action,value):command(value),key='request-'+input.id,old=await requests.get(key),binding=sha([actor.subject,action,input,codeSha,workflowSha]);
  if(old){
   if(old.binding!==binding)throw fail('Forespørselsreferansen er allerede brukt med andre valg.',409);
   if(await control.get('task-'+old.task.id))return {queued:true,id:old.task.id,requestId:input.id,repeated:true};
  }
  await idle();const b=await base(),record=checked(await imports.get(ORG));
  if((!publishing&&!same(input.input.base,b))||record&&(record.annualImport||record.annualReversal)&&!same(record.base,b)&&!['annual-publication-continue','annual-publication-cancel'].includes(action)||input.expectedRevision!==(record?.revision||0)||input.expectedDigest!==(publishing?publicationDigest(record):record?.digest||null))
   throw fail('Historikken eller det private utkastet er endret. Hent siste versjon.',409);
  if(record?.publicationLock&&action!=='annual-publication-continue'||!publishing&&record?.annualReversal)throw fail('Avklar årspubliseringen først.',409);
  if(publishing){
   if(!record)throw fail('Lagre årsimporten privat først.',409);
   if(['annual-publication-publish','annual-publication-continue','annual-publication-reverse'].includes(action))await publicationIdle();
   if(action==='annual-publication-publish'&&(record.status!=='review-approved'||record.approval?.scope!=='annual-publication'))throw fail('Godkjenn siste serverkontroll først.',409);
  }
  const task=old?.task||{v:1,revision:1,kind:'task',id:sha(token()).slice(0,32),nonce:token(),organizer:ORG,
   actor:actor.subject,ownerGithubId,action,scope:SCOPE,annualRequestId:input.id,annualBinding:binding,
   expectedRevision:input.expectedRevision,expectedDigest:input.expectedDigest,state:'queued',createdAt:new Date(clock()).toISOString(),codeSha,workflowSha};
  if(!old)await requests.transact(key,0,()=>({v:1,revision:1,binding,command:input,task,result:null}));
  const q=await queue();await control.transact('queue-'+ORG,q?.revision||0,()=>({v:1,revision:(q?.revision||0)+1,taskId:task.id}));
  await control.transact('task-'+task.id,0,()=>task);
  const previous=await control.get('annual-current-'+ORG);
  await control.transact('annual-current-'+ORG,previous?.revision||0,()=>({v:1,revision:(previous?.revision||0)+1,requestId:input.id}));
  try{await dispatch(task);}catch{throw fail('Oppstarten er ikke bekreftet. Hent status før du sender på nytt.',503);}
  return {queued:true,id:task.id,requestId:input.id};
 }
 return {available,load,start};
}
module.exports={SCOPE,PUBLICATION_ACTIONS,command,publicationCommand,createAnnualImportTransport};
