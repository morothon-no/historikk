// Public result bytes and regression provenance only. No users, notes or credentials.
'use strict';
const {createHash}=require('node:crypto'),H=require('../../js/history-data.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=(o,n)=>{if(!o||Array.isArray(o)||Object.keys(o).sort().join('|')!==n.slice().sort().join('|'))throw Error('Ukjent publiseringsformat.');};
function encode(history){return Buffer.from(JSON.stringify(history));}
function validateJournal(journal){
 fields(journal,['schemaVersion','baselineSha256','entries']);
 if(![1,2].includes(journal.schemaVersion)||!/^[a-f0-9]{64}$/.test(journal.baselineSha256)||!Array.isArray(journal.entries)||journal.entries.length>10000)throw Error('Ugyldig resultatjournal.');
 let previous=journal.baselineSha256,parent=null;
 for(const e of journal.entries){
  const identity=e.kind==='identity';
  fields(e,['beforeSha256','afterSha256','manifestSha256','dataVersion','changes','parent','sha256',...(identity?['kind']:[])]);
  if(identity&&journal.schemaVersion!==2)throw Error('Identitetsjournal krever versjon 2.');
  if(e.beforeSha256!==previous||e.parent!==parent||![e.afterSha256,e.manifestSha256,e.sha256].every(s=>/^[a-f0-9]{64}$/.test(s))||!Number.isSafeInteger(e.dataVersion)||e.dataVersion<1||!Array.isArray(e.changes)||!e.changes.length)throw Error('Brudd i resultatjournalen.');
  const {sha256,...body}=e;if(hash(JSON.stringify(body))!==sha256)throw Error('Resultatjournalens kontrollsum er feil.');
  const seen=new Set();for(const c of e.changes){
   if(identity){validateIdentityPatch(c);const key=c.field+':'+c.key;if(seen.has(key))throw Error('Duplisert identitetsendring.');seen.add(key);}
   else{fields(c,['index','before','after']);if(!Number.isSafeInteger(c.index)||c.index<0||seen.has(c.index)||!Array.isArray(c.before)||!Array.isArray(c.after)||equal(c.before,c.after))throw Error('Ugyldig eksakt resultatendring.');seen.add(c.index);}}
  previous=e.afterSha256;parent=e.sha256;
 }
 return journal;
}
function undoPublishedResults(bytes,journal){
 validateJournal(journal);let current=Buffer.from(bytes);
 if(!current.equals(encode(JSON.parse(current))))throw Error('Historikken må beholde sin kanoniske bytekoding.');
 for(const e of journal.entries.slice().reverse()){
  if(hash(current)!==e.afterSha256)throw Error('Resultatjournalen gjelder en annen historikk.');
  const data=JSON.parse(current);if(e.kind==='identity')applyIdentityPatches(data,e.changes,true);else for(const c of e.changes){if(!equal(data.results[c.index],c.after))throw Error('Resultatjournalens etterverdier er endret.');data.results[c.index]=c.before;}
  current=encode(data);if(hash(current)!==e.beforeSha256)throw Error('Andre historiske data er endret uten grunnlag.');
 }
 if(hash(current)!==journal.baselineSha256)throw Error('Resultatjournalens originalgrunnlag stemmer ikke.');return current;
}
function validateIdentityPatch(c){
 fields(c,['field','key','before','after','beforeIndex','afterIndex']);
 if(!['redirects','aliases','name'].includes(c.field)||typeof c.key!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(c.key)||['__proto__','constructor','prototype'].includes(c.key)||equal(c.before,c.after))throw Error('Ugyldig identitetsendring.');
 for(const side of ['before','after'])if(c.field==='name'?c[side+'Index']!==null:!Number.isSafeInteger(c[side+'Index'])||c[side+'Index']< -1||c[side+'Index']>1000000||(c[side]===null)!==(c[side+'Index']===-1))throw Error('Ugyldig nøkkelrekkefølge.');
 const name=v=>typeof v==='string'&&v.trim()&&v.length<=200&&!/[<>\u0000-\u001f]/.test(v);
 for(const v of [c.before,c.after]){
  if(c.field==='name'?!name(v):c.field==='redirects'?v!==null&&(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v)):v!==null&&(!Array.isArray(v)||v.length>1000||v.some(n=>!name(n))))throw Error('Ugyldig offentlig identitetsverdi.');
 }
}
function identityValue(history,c){
 if(c.field==='name'){const p=history.people.find(p=>p.i===c.key);if(!p)throw Error('Profilen finnes ikke.');return p.n;}
 return Object.hasOwn(history[c.field]||{},c.key)?history[c.field][c.key]:null;
}
function applyIdentityPatches(history,changes,reverse=false){
 for(const c of changes){
  validateIdentityPatch(c);const before=reverse?c.after:c.before,index=reverse?c.afterIndex:c.beforeIndex;
  if(!equal(identityValue(history,c),before)||c.field!=='name'&&Object.keys(history[c.field]||{}).indexOf(c.key)!==index)throw Error('Identitetsverdiene er endret. Ingen verdier overskrives.');
 }
 for(const field of ['redirects','aliases']){
  const group=changes.filter(c=>c.field===field);if(!group.length)continue;
  const keys=new Set(group.map(c=>c.key)),remaining=Object.entries(history[field]||{}).filter(([key])=>!keys.has(key)),
   entries=group.filter(c=>(reverse?c.before:c.after)!==null),out=Array(remaining.length+entries.length);
  for(const c of entries){const index=reverse?c.beforeIndex:c.afterIndex;
   if(index>=out.length||out[index])throw Error('Motstridende nøkkelrekkefølge.');out[index]=[c.key,structuredClone(reverse?c.before:c.after)];}
  let i=0;for(let at=0;at<out.length;at++)if(!out[at])out[at]=remaining[i++];history[field]=Object.fromEntries(out);
 }
 for(const c of changes.filter(c=>c.field==='name'))history.people.find(p=>p.i===c.key).n=reverse?c.before:c.after;
}
function identityChanges(before,after){
 H.assertValid(before);H.assertValid(after);
 const clean=h=>({...Object.fromEntries(Object.entries(h).filter(([k])=>!['aliases','redirects'].includes(k))),people:h.people.map(p=>({...p,n:''}))});
 if(!equal(clean(before),clean(after)))throw Error('Identitetspublisering må bevare resultater, profil-ID-er, distanser og løypehistorikk.');
 const changes=[];
 for(const field of ['redirects','aliases'])for(const key of new Set([...Object.keys(before[field]||{}),...Object.keys(after[field]||{})])){
  const c={field,key,before:Object.hasOwn(before[field]||{},key)?before[field][key]:null,after:Object.hasOwn(after[field]||{},key)?after[field][key]:null,beforeIndex:Object.keys(before[field]||{}).indexOf(key),afterIndex:Object.keys(after[field]||{}).indexOf(key)};
  if(!equal(c.before,c.after)){validateIdentityPatch(c);changes.push(c);}
 }
 before.people.forEach((p,i)=>{if(p.n!==after.people[i].n)changes.push({field:'name',key:p.i,before:p.n,after:after.people[i].n,beforeIndex:null,afterIndex:null});});
 if(!changes.length)throw Error('Ingen identitetsendringer å publisere.');
 return changes;
}
function appendIdentityPublication(beforeBytes,after,journal,{manifestSha256,dataVersion}){
 undoPublishedResults(beforeBytes,journal);const changes=identityChanges(JSON.parse(beforeBytes),after),bytes=encode(after),
  body={beforeSha256:hash(beforeBytes),afterSha256:hash(bytes),manifestSha256,dataVersion,changes,parent:journal.entries.at(-1)?.sha256||null,kind:'identity'},
  next={...journal,schemaVersion:2,entries:[...journal.entries,{...body,sha256:hash(JSON.stringify(body))}]};
 undoPublishedResults(bytes,next);return {bytes,journal:next,changes};
}
function undoIdentityPublication(history,journal,manifestSha256){
 undoPublishedResults(encode(history),journal);
 const index=journal.entries.findIndex(e=>e.manifestSha256===manifestSha256),entry=journal.entries[index];
 if(!entry||entry.kind!=='identity')throw Error('Velg en verifisert identitetspublisering.');
 const keys=new Set(entry.changes.map(c=>c.field+':'+c.key));
 if(journal.entries.slice(index+1).some(e=>e.kind==='identity'&&e.changes.some(c=>keys.has(c.field+':'+c.key))))throw Error('Identiteten har nyere endringer. Tilbakeføring krever manuell kontroll.');
 const after=structuredClone(history);applyIdentityPatches(after,entry.changes,true);
 H.assertValid(after);identityChanges(history,after);return after;
}
function appendPublication(beforeBytes,after,journal,{manifestSha256,dataVersion}){
 const before=JSON.parse(beforeBytes);H.assertValid(before);H.assertValid(after);undoPublishedResults(beforeBytes,journal);
 if(!equal(Object.fromEntries(Object.entries(before).filter(([k])=>k!=='results')),Object.fromEntries(Object.entries(after).filter(([k])=>k!=='results')))||before.results.length!==after.results.length)throw Error('Publisering tillater bare eksisterende resultatlinjer.');
 const changes=after.results.flatMap((r,index)=>equal(r,before.results[index])?[]:[{index,before:before.results[index],after:r}]);if(!changes.length)throw Error('Resultatet er allerede riktig. Ingen endring publiseres.');
 const bytes=encode(after),body={beforeSha256:hash(beforeBytes),afterSha256:hash(bytes),manifestSha256,dataVersion,changes,parent:journal.entries.at(-1)?.sha256||null};
 const next={...journal,entries:[...journal.entries,{...body,sha256:hash(JSON.stringify(body))}]};undoPublishedResults(bytes,next);return {bytes,journal:next,changes};
}
module.exports={hash,encode,validateJournal,undoPublishedResults,appendPublication,appendIdentityPublication,identityChanges,undoIdentityPublication};
