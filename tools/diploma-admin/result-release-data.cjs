// Public result bytes and regression provenance only. No users, notes or credentials.
'use strict';
const {createHash}=require('node:crypto'),H=require('../../js/history-data.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=(o,n)=>{if(!o||Array.isArray(o)||Object.keys(o).sort().join('|')!==n.slice().sort().join('|'))throw Error('Ukjent publiseringsformat.');};
function encode(history){return Buffer.from(JSON.stringify(history));}
function validateJournal(journal){
 fields(journal,['schemaVersion','baselineSha256','entries']);
 if(journal.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(journal.baselineSha256)||!Array.isArray(journal.entries)||journal.entries.length>10000)throw Error('Ugyldig resultatjournal.');
 let previous=journal.baselineSha256,parent=null;
 for(const e of journal.entries){
  fields(e,['beforeSha256','afterSha256','manifestSha256','dataVersion','changes','parent','sha256']);
  if(e.beforeSha256!==previous||e.parent!==parent||![e.afterSha256,e.manifestSha256,e.sha256].every(s=>/^[a-f0-9]{64}$/.test(s))||!Number.isSafeInteger(e.dataVersion)||e.dataVersion<1||!Array.isArray(e.changes)||!e.changes.length)throw Error('Brudd i resultatjournalen.');
  const {sha256,...body}=e;if(hash(JSON.stringify(body))!==sha256)throw Error('Resultatjournalens kontrollsum er feil.');
  const seen=new Set();for(const c of e.changes){fields(c,['index','before','after']);if(!Number.isSafeInteger(c.index)||c.index<0||seen.has(c.index)||!Array.isArray(c.before)||!Array.isArray(c.after)||equal(c.before,c.after))throw Error('Ugyldig eksakt resultatendring.');seen.add(c.index);}
  previous=e.afterSha256;parent=e.sha256;
 }
 return journal;
}
function undoPublishedResults(bytes,journal){
 validateJournal(journal);let current=Buffer.from(bytes);
 if(!current.equals(encode(JSON.parse(current))))throw Error('Historikken må beholde sin kanoniske bytekoding.');
 for(const e of journal.entries.slice().reverse()){
  if(hash(current)!==e.afterSha256)throw Error('Resultatjournalen gjelder en annen historikk.');
  const data=JSON.parse(current);for(const c of e.changes){if(!equal(data.results[c.index],c.after))throw Error('Resultatjournalens etterverdier er endret.');data.results[c.index]=c.before;}
  current=encode(data);if(hash(current)!==e.beforeSha256)throw Error('Andre historiske data er endret uten grunnlag.');
 }
 if(hash(current)!==journal.baselineSha256)throw Error('Resultatjournalens originalgrunnlag stemmer ikke.');return current;
}
function appendPublication(beforeBytes,after,journal,{manifestSha256,dataVersion}){
 const before=JSON.parse(beforeBytes);H.assertValid(before);H.assertValid(after);undoPublishedResults(beforeBytes,journal);
 if(!equal(Object.fromEntries(Object.entries(before).filter(([k])=>k!=='results')),Object.fromEntries(Object.entries(after).filter(([k])=>k!=='results')))||before.results.length!==after.results.length)throw Error('Publisering tillater bare eksisterende resultatlinjer.');
 const changes=after.results.flatMap((r,index)=>equal(r,before.results[index])?[]:[{index,before:before.results[index],after:r}]);if(!changes.length)throw Error('Resultatet er allerede riktig. Ingen endring publiseres.');
 const bytes=encode(after),body={beforeSha256:hash(beforeBytes),afterSha256:hash(bytes),manifestSha256,dataVersion,changes,parent:journal.entries.at(-1)?.sha256||null};
 const next={...journal,entries:[...journal.entries,{...body,sha256:hash(JSON.stringify(body))}]};undoPublishedResults(bytes,next);return {bytes,journal:next,changes};
}
module.exports={hash,encode,validateJournal,undoPublishedResults,appendPublication};
