// Private PostgreSQL storage adapter for C2.4 workspaces. No HTTP API or public writes.
// pg Pool-compatible query client and trusted per-organizer key provider are injected.
// Safe, optimistic revision CAS means no check-then-write race or lost updates.
'use strict';
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const MAX_BYTES=8*1024*1024,MAX_EVENTS=1000;
const ORG=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const fail=s=>{throw Error(s);};
const copy=v=>JSON.parse(JSON.stringify(v));
function organizerId(id){if(typeof id!=='string'||!ORG.test(id))fail('Ugyldig arrangør-ID.');return id;}
function rev(n){if(!Number.isSafeInteger(n)||n<0)fail('Ugyldig forventet revisjon.');return n;}
function checkedRecord(record,revision){
 if(!record||record.v!==1||record.revision!==revision||!['draft','review-approved','published'].includes(record.status)||
    !Array.isArray(record.events)||record.events.length>MAX_EVENTS||
    typeof record.base!=='object'||!record.base||
    typeof record.draft!=='object'||!record.draft)
  fail('Ugyldig revisjonsbundet arbeidsgrunnlag.');
 const bytes=Buffer.from(JSON.stringify(record));
 if(bytes.length>MAX_BYTES)fail('Arbeidsgrunnlaget overstiger grensen på 8 MiB.');
 return bytes;
}
async function keyFor(provider,organizer){
 const key=await provider(organizer);
 if(!Buffer.isBuffer(key)||key.length!==32)fail('Privat PostgreSQL-lagring krever en 256-bit arrangørnøkkel fra nøkkelhvelv.');
 return key;
}
function seal(organizer,key,bytes){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('adelskalender-postgres-review-v1:'+organizer));
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});
}
function unseal(organizer,key,envelope){
 if(typeof envelope!=='string'||Buffer.byteLength(envelope)>MAX_BYTES*2)fail('Ugyldig kryptert arbeidsgrunnlag.');
 const e=JSON.parse(envelope);
 if(e.v!==1||typeof e.iv!=='string'||typeof e.tag!=='string'||typeof e.data!=='string')
  fail('Ukjent kryptert lagringsformat.');
 const iv=Buffer.from(e.iv,'base64'),tag=Buffer.from(e.tag,'base64'),encrypted=Buffer.from(e.data,'base64');
 if(iv.length!==12||tag.length!==16||encrypted.length>MAX_BYTES)
  fail('Ugyldig kryptert lagring.');
 const decipher=createDecipheriv('aes-256-gcm',key,iv);
 decipher.setAAD(Buffer.from('adelskalender-postgres-review-v1:'+organizer));
 decipher.setAuthTag(tag);
 const bytes=Buffer.concat([decipher.update(encrypted),decipher.final()]);
 if(bytes.length>MAX_BYTES)fail('For stort lagret arbeidsgrunnlag.');
 return JSON.parse(bytes.toString('utf8'));
}
function postgresReviewStore({pool,keyProvider}={}){
 if(!pool||typeof pool.query!=='function'||typeof keyProvider!=='function')
  fail('PostgreSQL-adapter krever en privat pool og nøkkelprovider.');
 async function current(org){
  const db=await pool.query(
   'SELECT revision, envelope FROM organizer_review_workspace WHERE organizer_id = $1',
   [org]
  );
  if(!db||!Array.isArray(db.rows)||db.rows.length>1)
   fail('Ugyldig svar fra privat lagringsdatabase.');
  if(!db.rows.length)return null;
  const row=db.rows[0],revision=Number(row.revision);
  if(!Number.isSafeInteger(revision)||revision<1)fail('Ugyldig lagringsrevisjon.');
  const key=await keyFor(keyProvider,org);
  const record=unseal(org,key,row.envelope);
  checkedRecord(record,revision);
  return record;
 }
 async function get(organizer){
  const org=organizerId(organizer);
  return copy(await current(org));
 }
 async function transact(organizer,expectedRevision,mutate){
  const org=organizerId(organizer),expected=rev(expectedRevision);
  if(typeof mutate!=='function')fail('Mangler synkron, kontrollert endringsfunksjon.');
  const before=await current(org);
  if((before?.revision||0)!==expected)
   fail('Arbeidsgrunnlaget er endret. Hent siste revisjon før lagring.');
  const next=mutate(copy(before));
  if(next&&typeof next.then==='function')fail('Asynkron endringsfunksjon er ikke tillatt.');
  const bytes=checkedRecord(next,expected+1),key=await keyFor(keyProvider,org);
  const envelope=seal(org,key,bytes);
  let result;
  if(!expected){
   // An existing row is never overwritten by a stale first writer.
   result=await pool.query(
    'INSERT INTO organizer_review_workspace (organizer_id, revision, envelope) VALUES ($1, $2, $3) ON CONFLICT (organizer_id) DO NOTHING RETURNING revision',
    [org,1,envelope]
   );
  }else{
   // Single atomic SQL update; no preceding SELECT lock is relied upon.
   result=await pool.query(
    'UPDATE organizer_review_workspace SET revision = $2, envelope = $3, updated_at = NOW() WHERE organizer_id = $1 AND revision = $4 RETURNING revision',
    [org,expected+1,envelope,expected]
   );
  }
  if(!result||result.rowCount!==1)
   fail('Arbeidsgrunnlaget ble oppdatert av en annen økt. Ingen endringer er overskrevet.');
  return copy(next);
 }
 return {get,transact}; // Existing createReviewService enforces signed sessions and roles.
}
module.exports={postgresReviewStore};
