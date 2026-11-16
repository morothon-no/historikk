// Organizer configuration contract v1. Server-side/read-only until explicitly integrated.
// No Morothon rules may be inferred or silently applied to another organizer.
'use strict';
const {createHash}=require('node:crypto');
const FORMAT='adelskalender-organizer-profile-v1';
const STATUS=['Fullført','DNF','DNS','Disket','DQ'];
const COLUMNS=['year','event','distance','gender','class'];
const GROUP_REQUIRED=['year','event','distance'];
const ID=/^[a-z][a-z0-9-]{1,62}$/;
const fail=(s)=>{throw Error(s);};
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function fields(value,required,optional,label){
 if(!plain(value))fail(label+' må være et objekt.');
 const allowed=new Set([...required,...optional]);
 for(const name of Object.keys(value))if(!allowed.has(name))fail('Ukjent felt i '+label+': '+name);
 for(const name of required)if(!Object.hasOwn(value,name))fail('Mangler felt i '+label+': '+name);
}
function slug(s,label){if(typeof s!=='string'||!ID.test(s))fail('Ugyldig '+label+'.');return s;}
function word(s,label,max=140){
 if(typeof s!=='string'||!s.trim()||s!==s.trim()||s.length>max||/[\x00-\x1f\x7f<>]/.test(s))fail('Ugyldig '+label+'.');
 return s;
}
function year(y,label){if(!Number.isSafeInteger(y)||y<1800||y>2200)fail('Ugyldig '+label+'.');return y;}
function unique(values,label){if(!Array.isArray(values)||!values.length||new Set(values).size!==values.length)fail('Duplisert eller tom '+label+'.');}
function boundedPeriod(p,label){
 fields(p,['id','fromYear','throughYear'],[],label);slug(p.id,label+' ID');year(p.fromYear,label+' start');
 if(p.throughYear!==null){year(p.throughYear,label+' slutt');if(p.throughYear<p.fromYear)fail(label+' slutter før start.');}
}
function nonoverlapping(periods,key,label){
 for(const a of periods)for(const b of periods){
  if(a===b||key(a)!==key(b))continue;
  const x=a.fromYear<=b.fromYear?a:b,y=x===a?b:a;
  if(x.throughYear===null||x.throughYear>=y.fromYear)fail('Overlappende '+label+': '+x.id+' / '+y.id);
 }
}
function validateProfile(input){
 // Copy before returning; caller's draft must never mutate a validated profile.
 let p;try{p=JSON.parse(JSON.stringify(input));}catch{fail('Arrangørprofilen må være gyldige JSON-data.');}
 fields(p,['format','schemaVersion','organizerId','name','locale','timeZone','events','policies','coursePeriods','badges','import'],[], 'arrangørprofil');
 if(p.format!==FORMAT||p.schemaVersion!==1)fail('Ukjent versjon av arrangørprofil.');
 slug(p.organizerId,'arrangør-ID');word(p.name,'arrangørnavn');
 if(typeof p.locale!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(p.locale))fail('Ugyldig språk.');
 try{new Intl.DateTimeFormat(p.locale,{timeZone:p.timeZone});}catch{fail('Ugyldig språk eller tidssone.');}
 unique(p.events,'konkurranser');
 const eventIds=new Set(),sources=new Set();
 for(const ev of p.events){
  fields(ev,['id','label','sourceNames'],[],'konkurranse');
  slug(ev.id,'konkurranse-ID');word(ev.label,'konkurransenavn');
  if(eventIds.has(ev.id))fail('Duplisert konkurranse-ID.');eventIds.add(ev.id);
  unique(ev.sourceNames,'historiske konkurransenavn');
  for(const s of ev.sourceNames){
   word(s,'kildekonkurranse');
   if(sources.has(s))fail('Samme kildenavn er tilordnet to konkurranser.');
   sources.add(s);
  }
 }
 unique(p.policies,'regelperioder');
 const policyIds=new Set();
 for(const policy of p.policies){
  fields(policy,['id','fromYear','throughYear','participation','ranking'],[],'regelperiode');
  boundedPeriod({id:policy.id,fromYear:policy.fromYear,throughYear:policy.throughYear},'regelperiode');
  if(policyIds.has(policy.id))fail('Duplisert regelperiode-ID.');policyIds.add(policy.id);
  const part=policy.participation;
  fields(part,['unit','countStatuses','relayCounts'],[],'deltakelsesregel');
  if(!['person-year','person-edition','person-result'].includes(part.unit))fail('Ukjent telleenhet.');
  if(typeof part.relayCounts!=='boolean')fail('Ugyldig stafettregel.');
  unique(part.countStatuses,'tellende statuser');
  if(part.countStatuses.some(x=>!STATUS.includes(x)||x==='DNS'))fail('Ugyldig deltakelsesstatus eller DNS som tellende.');
  const rank=policy.ranking;
  fields(rank,['groupBy','tieMethod'],[],'plasseringsregel');
  unique(rank.groupBy,'rangeringsfelter');
  if(rank.groupBy.some(x=>!COLUMNS.includes(x))||GROUP_REQUIRED.some(x=>!rank.groupBy.includes(x))||
     !rank.groupBy.some(x=>x==='gender'||x==='class'))fail('Ugyldig rangeringsgruppering.');
  if(!['competition','dense'].includes(rank.tieMethod))fail('Ugyldig regel for delte plasseringer.');
 }
 nonoverlapping(p.policies,()=>p.organizerId,'regelperioder');
 if(!Array.isArray(p.coursePeriods))fail('Løypeperioder må være en liste.');
 const courseIds=new Set(),course=[];
 for(const c of p.coursePeriods){
  fields(c,['id','label','eventIds','fromYear','throughYear'],[],'løypeperiode');
  boundedPeriod({id:c.id,fromYear:c.fromYear,throughYear:c.throughYear},'løypeperiode');
  word(c.label,'løypeperiodenavn');unique(c.eventIds,'løypeperiodens konkurranser');
  if(courseIds.has(c.id)||c.eventIds.some(x=>!eventIds.has(x)))fail('Duplisert eller ukjent løypeperiode.');
  courseIds.add(c.id);
  for(const id of c.eventIds)course.push({...c,eventId:id});
 }
 nonoverlapping(course,x=>x.eventId,'løypeperioder per konkurranse');
 fields(p.badges,['registry'],[],'merker');
 if(typeof p.badges.registry!=='string'||!/^data\/[a-z0-9][a-z0-9._/-]*\.json$/.test(p.badges.registry)||
   p.badges.registry.split('/').some(x=>x==='..'||x==='.') )fail('Ugyldig offentlig merkeregister.');
 fields(p.import,['formats','requiresCompleteYearConfirmation'],[],'resultatimport');
 unique(p.import.formats,'importformater');
 if(p.import.formats.some(x=>!['eqtiming','delimited','historic-manual'].includes(x))||
    typeof p.import.requiresCompleteYearConfirmation!=='boolean')fail('Ugyldig importkonfigurasjon.');
 return p;
}
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(plain(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
 return v;
}
function digest(profile){
 const validated=validateProfile(profile);
 return createHash('sha256').update(JSON.stringify(canonical(validated))).digest('hex');
}
function policyForYear(profile,editionYear){
 const p=validateProfile(profile);year(editionYear,'arrangementsår');
 const match=p.policies.filter(r=>r.fromYear<=editionYear&&(r.throughYear===null||editionYear<=r.throughYear));
 if(match.length!==1)fail('Ingen entydig regelperiode for '+p.organizerId+' i '+editionYear+'.');
 return {organizerId:p.organizerId,policyId:match[0].id,participation:match[0].participation,
  ranking:match[0].ranking,profileSha256:digest(p)};
}
function eventBySource(profile,sourceName){
 const p=validateProfile(profile),matches=p.events.filter(e=>e.sourceNames.includes(sourceName));
 if(matches.length!==1)fail('Kildekonkurransen er ikke konfigurert for arrangøren: '+String(sourceName).slice(0,80));
 return matches[0];
}
function recordPeriod(profile,editionYear,eventId){
 const p=validateProfile(profile);year(editionYear,'arrangementsår');slug(eventId,'konkurranse-ID');
 if(!p.events.some(e=>e.id===eventId))fail('Ukjent konkurranse.');
 const match=p.coursePeriods.filter(r=>r.eventIds.includes(eventId)&&r.fromYear<=editionYear&&(r.throughYear===null||editionYear<=r.throughYear));
 if(match.length>1)fail('Flere løypeperioder for samme år og konkurranse.');
 return match.length?match[0]:null; // Unknown is NOT evidence of an unchanged route.
}
module.exports={FORMAT,validateProfile,digest,policyForYear,eventBySource,recordPeriod};
