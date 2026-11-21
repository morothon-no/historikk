'use strict';
// First annual-import contract. Reuses existing parsing, matching and row rules.
// A checked plan is private preparation, never an authorized publication package.
const I=require('../../tools/diploma-admin/intake-model.js'),R=I.Results,C=I.Corrections,
 H=require('../../js/history-data.js'),{createHash}=require('node:crypto');
const FORMAT='morothon-annual-result-import-v1',MAX_BYTES=4*1024*1024,MAX_DECISIONS=5000;
const copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),
 hash=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function fields(v,names,label){if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).sort().join('|')!==names.slice().sort().join('|'))throw Error('Ukjente eller manglende felt i '+label+'.');}
function text(v,label,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max||/[<>\x00-\x1f\x7f]/.test(v))throw Error('Ugyldig '+label+'.');}
function validate(input){
 fields(input,['format','version','organizer','base','year','source','options','decisions'],'importkontrakt');
 if(input.format!==FORMAT||input.version!==1)throw Error('Ukjent årsimportkontrakt.');
 if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.organizer||''))throw Error('Ugyldig arrangør.');C.empty(input.base);
 if(!Number.isSafeInteger(input.year)||input.year<1900||input.year>2200)throw Error('Velg et gyldig resultatår.');
 fields(input.source,['data','scope','completeClaim'],'kilde');text(input.source.scope,'kildeområde',100);
 if(typeof input.source.data!=='string'||input.source.data.length>Math.ceil(MAX_BYTES/3)*4||typeof input.source.completeClaim!=='boolean')throw Error('Velg en resultatfil på maksimalt 4 MB.');
 const bytes=Buffer.from(input.source.data,'base64');if(!bytes.length||bytes.length>MAX_BYTES||bytes.toString('base64')!==input.source.data)throw Error('Ugyldige originalbytes i resultatfilen.');
 if(!input.options||Array.isArray(input.options)||typeof input.options!=='object'||Object.keys(input.options).some(k=>!['delimiter','mapping','profileChoices','fixedCourse','confirmedFields','nameMode','manual'].includes(k)))throw Error('Ukjente importvalg.');
 if(!Array.isArray(input.decisions)||input.decisions.length>MAX_DECISIONS)throw Error('For mange importavgjørelser.');
 const ids=new Set();for(const d of input.decisions){
  fields(d,['rowId','basis','action','runnerId','targetIndex','personKey','confirmDistinct','reason'],'importavgjørelse');
  text(d.rowId,'radreferanse',100);text(d.reason,'begrunnelse');
  if(ids.has(d.rowId)||!['existing','new-person','defer','reject'].includes(d.action)||!/^[a-f0-9]{64}$/.test(d.basis||'')||typeof d.confirmDistinct!=='boolean')throw Error('Ugyldig eller duplisert importavgjørelse.');ids.add(d.rowId);
  if(d.action==='existing'){
   if(typeof d.runnerId!=='string'||!(d.targetIndex===null||Number.isSafeInteger(d.targetIndex)&&d.targetIndex>=0)||d.personKey!==null||d.confirmDistinct)throw Error('Velg bare eksisterende person og eventuell eksakt resultatlinje.');
  }else if(d.runnerId!==null||d.targetIndex!==null||d.action!=='new-person'&&d.personKey!==null)throw Error('Uventet person- eller resultatvalg.');
  if(d.action==='new-person'?!/^[a-zA-Z0-9_-]{8,100}$/.test(d.personKey||''):d.confirmDistinct)throw Error('Ny person krever en stabil lokal personreferanse.');
 }
 if(Buffer.byteLength(JSON.stringify(input))>6*1024*1024)throw Error('Importgrunnlaget er for stort.');return input;
}
function request({organizer,base,year,text:sourceText,bytes,scope='delimited-results-v1',completeClaim=false,options={},decisions=[]}){
 if(bytes!==undefined&&sourceText!==undefined||bytes===undefined&&typeof sourceText!=='string')throw Error('Velg én kildefil.');
 const data=bytes===undefined?Buffer.from(sourceText,'utf8'):Buffer.from(bytes);
 return validate({format:FORMAT,version:1,organizer,base:copy(base),year,source:{data:data.toString('base64'),scope,completeClaim},options:copy(options),decisions:copy(decisions)});
}
async function prepare(context,input){
 validate(input);
 if(!same(input.base,context.base)||await C.hash(context.history)!==context.base.snapshotSha256)throw Error('Resultatgrunnlaget er foreldet. Hent siste versjon.');
 if(context.organizer!==input.organizer)throw Error('Importen gjelder en annen arrangør.');
 if(!/^[A-Za-z][A-Za-z0-9_-]{1,30}-$/.test(context.personIdPrefix||''))throw Error('Arrangørens person-ID-regel mangler.');
 const bytes=Buffer.from(input.source.data,'base64'),decoded=I.decode(bytes),
  ctx=I.createContext({history:context.history,registry:context.registry,profile:context.profile,
  honors:context.honors,volunteers:context.volunteers,externalLinks:context.externalLinks||[]}),staged=R.parse(decoded.text,{delimiter:input.options.delimiter}),
  session=await R.createSession(ctx,staged,input.options.mapping||staged.mapping,{...input.options,year:input.year,
   sourceSha256:hash(bytes),sourceScope:input.source.scope,meta:context.base,completeClaim:input.source.completeClaim});
 const original=R.review(ctx,session),choices=new Map(input.decisions.map(d=>[d.rowId,d]));
 if(input.decisions.some(d=>d.basis!==session.key))throw Error('Avgjørelsen gjelder en annen fil, tolkning eller historikk.');
 if(input.decisions.some(d=>!original.items.some(i=>i.id===d.rowId)))throw Error('Avgjørelsen gjelder en ukjent rad.');
 let decisions=new Map();
 for(const d of input.decisions){const item=original.items.find(i=>i.id===d.rowId);
  if(!item.row) {if(!['defer','reject'].includes(d.action))throw Error('Manglende kilderader kan ikke slettes eller erstattes automatisk.');continue;}
  if(item.category==='dns')throw Error('DNS uten dokumentert start skal ikke opprette en person eller en deltakelse.');
  if(item.blocking&&d.action!=='defer'&&d.action!=='reject')throw Error('Kildekonflikten må avklares før import.');
  if(d.action==='existing'){
   // A match to an existing registration must not become a second start merely
   // because a caller forgot its index. Additional starts need their own review.
   if(item.before&&d.targetIndex===null)throw Error('Velg den eksisterende resultatlinjen før rettelsen bekreftes.');
   decisions=R.decide(ctx,session,decisions,d.rowId,{action:'confirm',runnerId:d.runnerId,targetIndex:d.targetIndex,reason:d.reason});
  }
  else if(d.action==='defer'||d.action==='reject')decisions=R.decide(ctx,session,decisions,d.rowId,{action:d.action,reason:d.reason});
 }
 const analysis=R.review(ctx,session,decisions),newPeople=[],operations=[],identityTasks=[],rows=[],personKeys=new Map(),
  knownIds=new Set([...context.history.people.map(p=>p.i),...Object.keys(context.history.redirects||{})]);
 for(const item of analysis.items){const d=choices.get(item.id),row=item.row;
  if(!row){operations.push({rowId:item.id,kind:'preserve-missing',beforeIndex:item.beforeIndex,before:copy(item.before),after:null});continue;}
  if(item.category==='relay'){identityTasks.push({rowId:item.id,kind:'relay',reason:item.reason,candidates:[]});continue;}
  if(item.category==='dns'){operations.push({rowId:item.id,kind:'dns',beforeIndex:null,before:null,after:null});continue;}
  if(d?.action==='reject'||d?.action==='defer'){
   operations.push({rowId:item.id,kind:d.action,beforeIndex:item.beforeIndex,before:copy(item.before),after:null});
   if(d.action==='defer')identityTasks.push({rowId:item.id,kind:'person-review',reason:d.reason,candidates:item.candidates.map(p=>p.id)});continue;
  }
  if(item.blocking){identityTasks.push({rowId:item.id,kind:'source-conflict',reason:item.reason,candidates:item.candidates.map(p=>p.id)});continue;}
  let after=item.after;
  if(d?.action==='new-person'){
   if(row.errors.length||row.relay||row.status==='DNS')throw Error('Ny person krever et gyldig individuelt resultat.');
   if(item.before||item.relatedIndices.length)throw Error('En eksisterende registrering må avklares i Personkontroll før en ny person opprettes.');
   if(item.candidates.length&&!d.confirmDistinct)throw Error('Mulige eksisterende personer må avklares før en ny profil opprettes.');
   const personId=context.personIdPrefix+hash([input.organizer,d.personKey]).slice(0,7).toUpperCase(),
    person={i:personId,n:row.name,g:row.gender};
   if(knownIds.has(personId))throw Error('Den nye personreferansen finnes allerede. Velg eksisterende profil.');
   if(!personKeys.has(d.personKey)&&newPeople.some(p=>p.i===personId))throw Error('Kollisjon i ny person-ID. Avklar personreferansene.');
   if(personKeys.has(d.personKey)&&!same(personKeys.get(d.personKey),person))throw Error('Samme nye personreferanse brukes med forskjellige navn eller kjønn.');
   if(!personKeys.has(d.personKey)){personKeys.set(d.personKey,person);newPeople.push(person);}
   after=[input.year,personId,row.event,row.distance,row.status,row.time,row.place,row.className,row.club,row.bib];
  }else if(item.category==='unchanged'){
   operations.push({rowId:item.id,kind:'unchanged',beforeIndex:item.beforeIndex,before:copy(item.before),after:copy(item.before)});continue;
  }else if(d?.action!=='existing'){
   identityTasks.push({rowId:item.id,kind:'person-review',reason:item.reason,candidates:item.candidates.map(p=>p.id)});continue;
  }
  if(!after)throw Error('Resultatet mangler et entydig, bekreftet personvalg.');after=copy(after);
  if(H.effectiveStatus(after)==='DNF'){after[4]='DNF';after[5]='';after[6]='';}
  const person=newPeople.find(p=>p.i===after[1])||ctx.model.person(after[1]);
  H.assertValid({schemaVersion:1,people:[{...person,i:after[1]}],results:[after],yearStats:[[input.year]],aliases:{},redirects:{}});
  if(rows.some(r=>same(r,after)))throw Error('Flere rader ville opprette samme resultat.');rows.push(after);
  operations.push({rowId:item.id,kind:item.before&&d?.action!=='new-person'?'correct-result':'add-result',
   beforeIndex:d?.action==='new-person'?null:item.beforeIndex,before:d?.action==='new-person'?null:copy(item.before),after});
 }
 // Existing rows never disappear. This temporary model only calculates named
 // preview counts; it is NOT returned as a legacy/public history or yearStats row.
 const candidate=copy(context.history);candidate.people.push(...newPeople);
 for(const op of operations)if(op.kind==='correct-result')candidate.results[op.beforeIndex]=copy(op.after);else if(op.kind==='add-result')candidate.results.push(copy(op.after));
 const newEdition=!context.history.yearStats.some(r=>r[0]===input.year);
 if(newEdition)candidate.yearStats.push([input.year]);
 H.assertValid(candidate);const model=H.create(candidate),affected=[...new Set(operations.flatMap(op=>op.after?[model.resolve(op.after[1])]:[]))];
 const summary={read:session.rows.length,newPeople:newPeople.length,newResults:operations.filter(op=>op.kind==='add-result').length,
  changed:operations.filter(op=>op.kind==='correct-result').length,unchanged:operations.filter(op=>op.kind==='unchanged').length,
  dns:operations.filter(op=>op.kind==='dns').length,preservedMissing:operations.filter(op=>op.kind==='preserve-missing').length,
  unresolved:identityTasks.length,deferred:operations.filter(op=>op.kind==='defer').length,rejected:operations.filter(op=>op.kind==='reject').length};
 const plan={format:FORMAT,version:1,organizer:input.organizer,base:copy(context.base),interpretationSha256:session.key,
  sourceSha256:session.source.sha256,sourceEncoding:decoded.encoding,year:input.year,newEdition,newPeople,operations,identityTasks,summary,
  profiles:affected.map(id=>({id,name:model.person(id).n,years:model.stats(id)?.years||[],count:model.stats(id)?.count||0})),
  ready:!identityTasks.length,hasChanges:!!(summary.newResults||summary.changed),sourceCompleteClaim:input.source.completeClaim,mode:'merge-only',productionApplied:false,publicationAuthorized:false,
  requires:{authenticatedApproval:true,verifiedBackup:true,publicReleaseAdapter:true,postDeploymentVerification:true}};
 plan.checksum=hash(plan);return plan;
}
async function verify(context,input,plan){const expected=await prepare(context,input);if(!same(expected,plan))throw Error('Importplanen er endret. Ny serverkontroll kreves.');return {valid:true,publicationAuthorized:false,productionApplied:false};}
module.exports={FORMAT,request,validate,prepare,verify,hash};
