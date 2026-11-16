// Server-side-only search suggestions for linking Heder to an existing runner.
// A name match never establishes identity, tenure, permission or publication.
'use strict';
const History=require('../../js/history-data.js');
const normalize=value=>String(value??'').toLocaleLowerCase('nb-NO').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replaceAll('ø','o').replaceAll('æ','ae')
 .replaceAll('å','a').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function findHonorRunnerCandidates({roster,history,personId,query,limit=10}={}){
 if(!roster||roster.readOnly!==true||!Array.isArray(roster.people)||
    personId!==undefined&&personId!==null&&typeof personId!=='string')
  throw Error('Ugyldig Heder-oppslag.');
 // No person ID is allowed while adding a NEW Heder person: search first,
 // then explicitly confirm the participant identity when creating the record.
 const person=personId==null?null:roster.people.find(p=>p.id===personId);
 if(personId!=null&&!person)throw Error('Personen finnes ikke i aktivt Heder-register.');
 if(!person&&query===undefined)throw Error('Oppgi et søk for ny Heder-person.');
 if(!history||!Array.isArray(history.people)||!Array.isArray(history.results))
  throw Error('Mangler godkjent deltakerhistorikk.');
 if(!Number.isSafeInteger(limit)||limit<1||limit>30)
  throw Error('Ugyldig antall søkeresultater.');
 if(query!==undefined&&(typeof query!=='string'||query.length>100))
  throw Error('Søketekst er ugyldig.');
 const searched=(query??person.name).trim(),needle=normalize(searched);
 if(needle.length<2)return {personId:personId??null,query:searched,candidates:[],readOnly:true};
 const model=History.create(history);
 const namesById=new Map();
 const append=(id,name)=>{
  if(typeof name!=='string'||!name.trim())return;
  const canonical=model.resolve(id);
  if(!model.people.has(canonical))return;
  if(!namesById.has(canonical))namesById.set(canonical,new Set());
  namesById.get(canonical).add(name);
 };
 for(const p of history.people)append(p.i,p.n);
 for(const [id,names] of Object.entries(history.aliases||{}))
  if(Array.isArray(names))for(const name of names)append(id,name);
 const existing=new Map();
 for(const honor of roster.people){
  const link=honor.runnerLink;
  if(link?.confirmed===true&&typeof link.runnerId==='string'){
   const canonical=model.resolve(link.runnerId);
   if(model.people.has(canonical)){
    if(!existing.has(canonical))existing.set(canonical,[]);
    existing.get(canonical).push(honor.id);
   }
  }
 }
 const words=needle.split(' ').filter(Boolean);
 const candidates=[];
 for(const p of model.people.values()){
  const names=[...(namesById.get(p.i)||new Set([p.n]))],
        normalized=names.map(normalize);
  if(!normalized.some(n=>words.every(w=>n.includes(w))))continue;
  const isExact=normalized.some(n=>n===needle);
  const isPrefix=normalized.some(n=>n.startsWith(needle));
  const linked=existing.get(p.i)||[];
  candidates.push({
   runnerId:p.i,name:p.n,
   aliases:names.filter(n=>n!==p.n),
   participationCount:model.stats(p.i)?.count||0,
   linkedToThisHonor:person!==null&&linked.includes(personId),
   linkedToOtherHonor:linked.some(id=>id!==personId),
   matchKind:isExact?'exact':isPrefix?'prefix':'name-search'
  });
 }
 const weight={exact:0,prefix:1,'name-search':2};
 candidates.sort((a,b)=>Number(b.linkedToThisHonor)-Number(a.linkedToThisHonor)||
  weight[a.matchKind]-weight[b.matchKind]||a.name.localeCompare(b.name,'nb-NO')||
  a.runnerId.localeCompare(b.runnerId));
 return {personId:personId??null,query:searched,candidates:candidates.slice(0,limit),
  readOnly:true,confirmationRequired:true,identityLinkedAutomatically:false,
  volunteerYearsAffected:false};
}
module.exports={findHonorRunnerCandidates};
