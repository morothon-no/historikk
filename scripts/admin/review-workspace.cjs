// C2.4 private, server-side review workspace. Not a Pages route or an HTTP server.
// This module never publishes or applies a correction to public history.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createCipheriv,createDecipheriv,randomBytes,createHash}=require('node:crypto');
const {privateWorkspace}=require('./storage.cjs');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;

const MAX_STORED_BYTES=8*1024*1024,MAX_EVENTS=1000;
const ORGANIZER=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const copy=v=>JSON.parse(JSON.stringify(v));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=msg=>{throw Error(msg);};
function organizerId(value){
 if(typeof value!=='string'||!ORGANIZER.test(value))fail('Ugyldig arrangør-ID.');
 return value;
}
function revision(value){
 if(!Number.isSafeInteger(value)||value<0)fail('Forventet revisjon må være et gyldig heltall.');
 return value;
}
function authenticatedActor(value,org,permission){
 if(!value||typeof value!=='object'||typeof value.subject!=='string'||!/^[a-zA-Z0-9_:@.-]{3,200}$/.test(value.subject)||
    !value.organizers||typeof value.organizers!=='object'||Array.isArray(value.organizers)||
    !Object.hasOwn(value.organizers,org)||!Array.isArray(value.organizers[org])||
    !value.organizers[org].includes(permission))fail('Ingen bekreftet tilgang til arrangørens arbeidsgrunnlag.');
 return value.subject;
}
function checkedBinding(binding){
 // Reuse the exact immutable source-binding contract from C2.2.
 return C.empty(binding).base;
}
function privateFileStore({directory,key}={}){
 if(typeof directory!=='string'||!path.isAbsolute(directory))fail('Angi en absolutt privat lagringsmappe.');
 if(!Buffer.isBuffer(key)||key.length!==32)fail('Lagring krever en 256-bit hemmelig nøkkel levert fra privat nøkkelhvelv.');
 const dir=path.resolve(directory),secret=Buffer.from(key);
 const fileFor=org=>path.join(dir,organizerId(org)+'.review.aesgcm');
 const lockFor=org=>path.join(dir,organizerId(org)+'.lock');
 async function safeRoot(){await privateWorkspace(dir);}
 function seal(org,record){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);
  cipher.setAAD(Buffer.from('morothon-c24-v1:'+org));
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(record),'utf8'),cipher.final()]);
  return Buffer.from(JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')})+'\n');
 }
 function unseal(org,bytes){
  if(bytes.length>MAX_STORED_BYTES)fail('Det private arbeidsgrunnlaget er for stort.');
  const envelope=JSON.parse(bytes.toString('utf8'));
  if(envelope.v!==1||typeof envelope.data!=='string'||typeof envelope.iv!=='string'||typeof envelope.tag!=='string')fail('Ukjent kryptert lagringsformat.');
  const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');
  if(iv.length!==12||tag.length!==16)fail('Ugyldig kryptert lagring.');
  const decipher=createDecipheriv('aes-256-gcm',secret,iv);
  decipher.setAAD(Buffer.from('morothon-c24-v1:'+org));decipher.setAuthTag(tag);
  const plain=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);
  if(plain.length>MAX_STORED_BYTES)fail('Arbeidsgrunnlaget er for stort.');
  const record=JSON.parse(plain.toString('utf8'));
  if(!record||record.v!==1||!Number.isSafeInteger(record.revision)||record.revision<1||
    !Array.isArray(record.events)||record.events.length>MAX_EVENTS||
    !['draft','review-approved'].includes(record.status))fail('Ugyldig lagret arbeidsgrunnlag.');
  return record;
 }
 async function readUnlocked(org){
  try{
   const file=fileFor(org),stat=await fs.lstat(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.mode&0o077)fail('Privat lagringsfil har feil tilgang.');
   return unseal(org,await fs.readFile(file));
  }catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async function get(org){org=organizerId(org);await safeRoot();return copy(await readUnlocked(org));}
 async function transact(org,expected,update){
  org=organizerId(org);revision(expected);await safeRoot();
  let lock;
  try{lock=await fs.open(lockFor(org),'wx',0o600);}
  catch(e){if(e.code==='EEXIST')fail('En annen oppdatering pågår. Prøv igjen etter kontroll.');throw e;}
  let temp;
  try{
   const previous=await readUnlocked(org);
   if((previous?.revision||0)!==expected)fail('Arbeidsgrunnlaget er endret. Last inn siste revisjon før du lagrer.');
   const next=update(copy(previous));
   if(!next||next.v!==1||next.revision!==expected+1||!Array.isArray(next.events)||next.events.length>MAX_EVENTS)fail('Ugyldig ny arbeidsrevisjon.');
   const bytes=seal(org,next);
   if(bytes.length>MAX_STORED_BYTES)fail('Arbeidsgrunnlaget overstiger lagringsgrensen.');
   temp=path.join(dir,org+'.'+randomBytes(12).toString('hex')+'.tmp');
   const handle=await fs.open(temp,'wx',0o600);
   try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
   await fs.rename(temp,fileFor(org));temp=null;
   const d=await fs.open(dir,'r');try{await d.sync();}finally{await d.close();}
   return copy(next);
  }finally{
   if(temp)await fs.rm(temp,{force:true});
   await lock.close();await fs.rm(lockFor(org),{force:true});
  }
 }
 return {get,transact}; // Never expose key, paths or an unauthenticated HTTP handler.
}
function createReviewService({authenticate,getTrustedBinding,store,clock=()=>Date.now()}={}){
 if(typeof authenticate!=='function'||typeof getTrustedBinding!=='function'||
    !store||typeof store.get!=='function'||typeof store.transact!=='function')fail('Sikker autentisering, kildebinding og privat lagringsadapter er påkrevd.');
 async function access(session,org,permission){
  organizerId(org);
  // authenticate must verify a signed session or token server-side; never trust browser claims.
  return authenticatedActor(await authenticate(session),org,permission);
 }
 async function source(org){return checkedBinding(await getTrustedBinding(org));}
 function event(action,actor,at,rev,value){
  return {action,actor,at,revision:rev,digest:value};
 }
 const stamp=()=>new Date(clock()).toISOString();
 async function load({session,organizer}){
  await access(session,organizer,'review');
  const trusted=await source(organizer),record=await store.get(organizer);
  return {revision:record?.revision||0,status:record?.status||'empty',
    stale:!!record&&!equal(record.base,trusted),
    draft:record?copy(record.draft):null,
    approval:record?.approval?copy(record.approval):null,
    events:record?copy(record.events):[]};
 }
 async function save({session,organizer,expectedRevision,draft}){
  const actor=await access(session,organizer,'review'),base=await source(organizer);
  revision(expectedRevision);
  const normalized=C.parse(C.serialize(draft));
  if(!equal(normalized.base,base))fail('Resultatgrunnlaget er foreldet. Oppdater historikkversjonen før ny vurdering.');
  const sha=digest(normalized),at=stamp();
  const next=await store.transact(organizer,expectedRevision,previous=>{
   if(previous&&!equal(previous.base,base))fail('Lagret sak gjelder en foreldet historikkversjon.');
   const rev=expectedRevision+1,events=[...(previous?.events||[]),event('draft-saved',actor,at,rev,sha)];
   return {v:1,revision:rev,status:'draft',base:copy(base),draft:normalized,approval:null,events};
  });
  return {revision:next.revision,status:next.status,digest:sha,publicationAuthorized:false,productionApplied:false};
 }
 async function approve({session,organizer,expectedRevision,expectedDigest}){
  const actor=await access(session,organizer,'approve'),base=await source(organizer);
  revision(expectedRevision);
  if(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest))fail('Manglende eksakt kontrollsum.');
  const at=stamp();
  const next=await store.transact(organizer,expectedRevision,previous=>{
   if(!previous||!previous.draft||!equal(previous.base,base))fail('Ingen oppdatert rettingspakke kan godkjennes.');
   C.validatePackage(previous.draft);
   if(digest(previous.draft)!==expectedDigest)fail('Godkjenningen gjelder en annen rettingspakke.');
   if(previous.draft.cases.some(c=>['reported','review','proposed'].includes(c.status)))
    fail('Uavklarte saker må behandles før samlet godkjenning.');
   if(!previous.draft.cases.length)fail('Ingen behandlede saker er tilgjengelige.');
   const rev=expectedRevision+1,approval={by:actor,at,digest:expectedDigest,base:copy(base)};
   return {...previous,revision:rev,status:'review-approved',approval,
     events:[...previous.events,event('review-approved',actor,at,rev,expectedDigest)]};
  });
  return {revision:next.revision,status:next.status,approval:copy(next.approval),
    publicationAuthorized:false,productionApplied:false};
 }
 return {load,save,approve}; // Explicitly no apply, write-history, deployment or publication function.
}
module.exports={privateFileStore,createReviewService};
