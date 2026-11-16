// Tenant-neutral DOMAIN contract + read-only Morothon migration adapter.
// Internal server-side preview only. Never serves as an authorized data writer.
'use strict';
const {createHash}=require('node:crypto');
const Profile=require('./profile.cjs');
const History=require('../../js/history-data.js');
const FORMAT='adelskalender-domain-snapshot-v1';
const ID=/^[a-z][a-z0-9-]{1,90}$/;
const LEGACY_PERSON_ID=/^[A-Za-z][A-Za-z0-9._:-]{1,100}$/;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const bad=reason=>{throw Error(reason);};
const safeId=(id,what)=>{if(typeof id!=='string'||!ID.test(id))bad('Ugyldig '+what+'.');return id;};
const personId=(id)=>{if(typeof id!=='string'||!LEGACY_PERSON_ID.test(id))bad('Ugyldig person-ID.');return id;};
function array(value,label){if(!Array.isArray(value))bad('Mangler liste: '+label);return value;}
function unique(rows,field,label,{person=false}={}){
 const seen=new Set();
 for(const row of array(rows,label)){
  if(!row||typeof row!=='object'||Array.isArray(row))bad('Ugyldig '+label+'.');
  const key=person?personId(row[field]):safeId(row[field],label+' ID');
  if(seen.has(key))bad('Duplisert '+label+' ID.');
  seen.add(key);
 }
 return seen;
}
function validateSnapshot(value){
 const m=clone(value);
 if(!m||m.format!==FORMAT||m.schemaVersion!==1||m.purpose!=='private-read-only-preview')
  bad('Ukjent eller ikke-skrivebeskyttet datamodell.');
 safeId(m.organizerId,'arrangør-ID');
 if(typeof m.profileSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.profileSha256))
  bad('Mangler versjonert arrangørprofil.');
 const series=unique(m.series,'seriesId','serier'),
  editions=unique(m.editions,'editionId','utgaver'),
  competitions=unique(m.competitions,'competitionId','konkurranser'),
  persons=unique(m.people,'personId','personer',{person:true});
 const yearIndex=new Map(),editionIndex=new Map();
 for(const x of m.editions){
  if(!series.has(x.seriesId)||!Number.isInteger(x.year)||x.year<1800||x.year>2200)
   bad('Utgave refererer ukjent serie eller ugyldig år.');
  if(!['year','day','range'].includes(x.datePrecision)||
     x.datePrecision==='year'&&x.date!==null||
     x.datePrecision==='day'&&!/^\d{4}-\d{2}-\d{2}$/.test(x.date||''))
   bad('Utgave mangler pålitelig datopresisjon.');
  editionIndex.set(x.editionId,x);
  yearIndex.set(x.editionId,x.year);
 }
 for(const x of m.competitions){
  if(!editions.has(x.editionId)||typeof x.eventName!=='string'||!x.eventName||
     typeof x.distanceLabel!=='string'||!x.distanceLabel||
     x.coursePeriodId!==null&&typeof x.coursePeriodId!=='string')
   bad('Konkurranse har ugyldig utgave, distanse eller løypeperiode.');
 }
 if(!['morothon-history-v1','normalized-v1'].includes(m.source?.kind))
  bad('Ukjent kildemodell.');
 const legacy=m.source.kind==='morothon-history-v1';
 if(!Number.isSafeInteger(m.source.resultCount)||m.source.resultCount<0||
    !Number.isSafeInteger(m.source.teamResultCount)||m.source.teamResultCount<0||
    !/^[a-f0-9]{64}$/.test(m.source.sha256||''))
  bad('Kildens antall og kontrollsum er ugyldige.');
 if(!Array.isArray(m.results)||m.results.length!==m.source.resultCount)
  bad('Resultatantallet stemmer ikke med kildegrunnlaget.');
 const competitionIndex=new Map(m.competitions.map(c=>[c.competitionId,c]));
 const ordinals=new Set(),nativeIds=new Set();
 for(const r of m.results){
  if(!r||!competitions.has(r.competitionId)||typeof r.status!=='string'||!r.status)
   bad('Resultat refererer ukjent konkurranse eller status.');
  const known=r.personId!==null&&persons.has(r.personId);
  if(r.personLinked!==known)bad('Resultat koblet til ukjent person eller motstridende personstatus.');
  if(legacy){
   if(r.resultId!==null||r.sourceRef?.kind!=='legacy-row'||
      !Number.isSafeInteger(r.sourceRef.ordinal)||r.sourceRef.ordinal<0||
      ordinals.has(r.sourceRef.ordinal))
    bad('Historisk rad mangler entydig kildeposisjon.');
   ordinals.add(r.sourceRef.ordinal);
   if(r.sourceRef.ordinal>=m.results.length||typeof r.personId!=='string'||
      !Array.isArray(r.legacyRow)||r.legacyRow.length!==10||
      r.status!==r.legacyRow[4]||r.timeRaw!==r.legacyRow[5]||
      r.sourcePlaceRaw!==r.legacyRow[6]||r.personId!==r.legacyRow[1])
    bad('Rå historisk resultatpost kan ikke rekonstrueres uten tap.');
   const competition=competitionIndex.get(r.competitionId);
   if(yearIndex.get(competition.editionId)!==r.legacyRow[0]||
      competition.eventName!==r.legacyRow[2]||competition.distanceLabel!==r.legacyRow[3])
    bad('Resultatpostens konkurranse eller utgave er ikke identisk med kilden.');
  }else{
   safeId(r.resultId,'resultat-ID');
   if(nativeIds.has(r.resultId))bad('Duplisert resultat-ID i ny arrangørmodell.');
   nativeIds.add(r.resultId);
   if(r.personId!==null)personId(r.personId);
   if(r.sourceRef?.kind!=='import-row'||
      typeof r.sourceRef.batchId!=='string'||!ID.test(r.sourceRef.batchId)||
      !Number.isSafeInteger(r.sourceRef.rowIndex)||r.sourceRef.rowIndex<0)
    bad('Nye resultater må ha en stabil ID og dokumentert kildebatch.');
   if(r.elapsedMs!==null&&(!Number.isSafeInteger(r.elapsedMs)||r.elapsedMs<0))
    bad('Ugyldig tid i resultatmodellen.');
  }
 }
 if(legacy){
  if(ordinals.size!==m.results.length||!m.results.every((r,index)=>r.sourceRef.ordinal===index))
   bad('Kilderekkefølgen må ikke endres ved migreringsvisning.');
  for(const p of m.people)if(!p.legacyPerson||p.legacyPerson.i!==p.personId||
     p.displayName!==p.legacyPerson.n||p.gender!==p.legacyPerson.g)
   bad('Historisk person må bevares uten navne- eller ID-endring.');
  if(!Array.isArray(m.source.keyOrder)||!m.source.keyOrder.includes('people')||
     !m.source.keyOrder.includes('results')||!m.source.legacyHeader||
     typeof m.source.legacyHeader!=='object'||Array.isArray(m.source.legacyHeader))
   bad('Mangler full rekonstruksjon av kildedata.');
  if(!Array.isArray(m.source.legacyHeader.teamResults)||
     m.source.legacyHeader.teamResults.length!==m.source.teamResultCount)
   bad('Stafettresultater må bevares separat.');
 }else{
  if(m.source.teamResultCount!==0||m.source.keyOrder!==undefined||
     m.source.legacyHeader!==undefined)
   bad('Native data må ikke få med Morothons historiske kildeformat.');
  for(const p of m.people)if(typeof p.displayName!=='string'||!p.displayName.trim())
   bad('Ny person mangler visningsnavn.');
 }
 if(typeof m.snapshotSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.snapshotSha256))
  bad('Mangler modellens kontrollsum.');
 const expected=sha({...m,snapshotSha256:null});
 if(m.snapshotSha256!==expected)bad('Datamodellen er endret etter kontroll. Ingen migrering.');
 return m;
}
function projectMorothon({history,profile}={}){
 if(!history||!Array.isArray(history.people)||!Array.isArray(history.results)||
    !Array.isArray(history.teamResults))bad('Ugyldig Morothon-historikk.');
 const p=Profile.validateProfile(profile);
 if(p.organizerId!=='morothon')bad('Denne overgangsadapteren er kun for Morothons opprinnelige filer.');
 const original=clone(history),sourceHash=sha(original);
 const eventMap=new Map();
 for(const e of p.events)for(const name of e.sourceNames)eventMap.set(name,e.id);
 const periods=new Map();
 const policyYears=new Set(original.results.map(r=>r[0]));
 for(const year of policyYears)Profile.policyForYear(p,year);
 const people=original.people.map(person=>({
  personId:person.i,displayName:person.n,gender:person.g,legacyPerson:clone(person)
 }));
 const known=new Set(people.map(x=>x.personId));
 const editions=[],competitions=[],results=[],yearSeen=new Set(),compMap=new Map();
 for(let index=0;index<original.results.length;index++){
  const row=original.results[index];
  if(!Array.isArray(row)||row.length!==10||!Number.isSafeInteger(row[0])||
     typeof row[1]!=='string'||typeof row[2]!=='string'||typeof row[3]!=='string')
   bad('Ukjent historisk kilderad. Migrering må stoppe.');
  const [year,personId,eventName,distanceLabel,status,timeRaw,sourcePlaceRaw]=row;
  const eventId=eventMap.get(eventName);
  if(!eventId)bad('Kilden har konkurranse som ikke finnes i arrangørprofilen.');
  const editionId='morothon-'+year;
  if(!yearSeen.has(year)){
   editions.push({editionId,seriesId:'morothon-series',year,date:null,datePrecision:'year',status:'held'});
   yearSeen.add(year);
  }
  const group=JSON.stringify([year,eventName,distanceLabel]);
  let competitionId=compMap.get(group);
  if(!competitionId){
   competitionId='competition-'+sha(group).slice(0,24);
   if(competitions.some(c=>c.competitionId===competitionId))bad('Kollisjon i konkurranse-ID.');
   const periodKey=JSON.stringify([year,eventId]);
   if(!periods.has(periodKey)){
    const period=Profile.recordPeriod(p,year,eventId);
    periods.set(periodKey,period?.id||null);
   }
   competitions.push({competitionId,editionId,eventId,eventName,distanceLabel,
     coursePeriodId:periods.get(periodKey)});
   compMap.set(group,competitionId);
  }
  results.push({
   resultId:null, // Historical source lacks a stable result ID; never synthesize a publishable ID.
   sourceRef:{kind:'legacy-row',ordinal:index},competitionId,
   personId,personLinked:known.has(personId),status,timeRaw,sourcePlaceRaw,
   displaySourcePlace:History.sourcePlace(row),classLabel:row[7],club:row[8],bib:row[9],
   legacyRow:clone(row)
  });
 }
 const source={
  kind:'morothon-history-v1',sha256:sourceHash,resultCount:results.length,
  teamResultCount:original.teamResults.length,
  keyOrder:Object.keys(original),
  legacyHeader:Object.fromEntries(Object.entries(original).filter(([key])=>key!=='people'&&key!=='results'))
 };
 const snapshot={
  format:FORMAT,schemaVersion:1,purpose:'private-read-only-preview',organizerId:p.organizerId,
  profileSha256:Profile.digest(p),
  series:[{seriesId:'morothon-series',label:p.name}],
  editions,competitions,people,results,source,snapshotSha256:null
 };
 snapshot.snapshotSha256=sha(snapshot);
 return validateSnapshot(snapshot);
}
function emptyOrganizer(profile){
 const p=Profile.validateProfile(profile);
 const snapshot={
  format:FORMAT,schemaVersion:1,purpose:'private-read-only-preview',
  organizerId:p.organizerId,profileSha256:Profile.digest(p),
  series:[],editions:[],competitions:[],people:[],results:[],
  source:{kind:'normalized-v1',sha256:sha({kind:'new-organizer',organizerId:p.organizerId}),
   resultCount:0,teamResultCount:0},
  snapshotSha256:null
 };
 snapshot.snapshotSha256=sha(snapshot);
 return validateSnapshot(snapshot);
}
function reconstructLegacy(snapshot){
 const m=validateSnapshot(snapshot),result={};
 if(m.organizerId!=='morothon')bad('Historisk rekonstruksjon støttes kun for Morothon-adapteren.');
 for(const key of m.source.keyOrder){
  if(key==='people')result[key]=m.people.map(p=>clone(p.legacyPerson));
  else if(key==='results')result[key]=m.results.map(r=>clone(r.legacyRow));
  else if(Object.hasOwn(m.source.legacyHeader,key))result[key]=clone(m.source.legacyHeader[key]);
  else bad('Rekonstruksjonsfelt mangler fra kilden.');
 }
 if(sha(result)!==m.source.sha256)bad('Rekonstruert historikk avviker fra originalen.');
 return result; // Caller must treat this as a read-only comparison artifact.
}
module.exports={FORMAT,validateSnapshot,emptyOrganizer,projectMorothon,reconstructLegacy};
