// Read-only portal projections of the approved public package. No source registers.
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../js/history-data.js'));else window.MorothonPortalData=factory(window.MorothonHistoryData);})(function(History){
const compareNames = (a, b) => a.name.localeCompare(b.name, 'nb-NO');
const fold = value => String(value).toLocaleLowerCase('nb-NO').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae');
function createPortalData({ history, badges, honorCount, assetBase = '/site/', profile }) {
  const model = History.create(history), levels = badges.badges.filter(b => b.kind === 'participation').sort((a, b) => a.n - b.n);
  const years = history.yearStats.map(r => r[0]).sort((a, b) => a - b), latestYear = years.at(-1)??null, aliases = new Map();
  for (const [id, names] of Object.entries(history.aliases || {})) { const canonical = model.resolve(id); aliases.set(canonical, [...aliases.get(canonical) || [], ...names]); }
  for (const p of history.people) if (model.resolve(p.i) !== p.i) { const id = model.resolve(p.i); aliases.set(id, [...aliases.get(id) || [], p.n]); }
  const badge = (b, year) => b ? { id: b.id, name: b.name, level: b.n, src: assetBase + b.src, ...(year ? { year } : {}) } : null;
  const rows = [...model.people.values()].map(p => {
    const stats = model.stats(p.i) || { count: 0, years: [], firstYear: null, lastYear: null };
    const earned = levels.filter(b => b.n <= stats.count).map(b => badge(b, stats.years[b.n - 1]));
    const next = stats.count > 0 ? levels.find(b => b.n > stats.count) : null;
    return { id: p.i, name: p.n, gender: p.g, count: stats.count, firstYear: stats.firstYear, lastYear: stats.lastYear,
      years: stats.years, earned, highestBadge: earned.at(-1) || null,
      nextBadge: next ? { ...badge(next), remaining: next.n - stats.count } : null,
      search: fold([p.n, ...aliases.get(p.i) || []].join(' ')) };
  }).filter(Boolean).sort(compareNames), byId = new Map(rows.map(p => [p.id, p]));
  const summary = ({ years, search, earned, ...p }) => p;
  function query(params, extra = []) {
    for (const name of params.keys()) if (!['q', 'offset', 'limit', ...extra].includes(name) || params.getAll(name).length !== 1) throw Error('Ukjent eller gjentatt søkefelt.');
    const q = params.get('q') || ''; if (q.length > 100) throw Error('Søket kan være inntil 100 tegn.');
    const integer = (key, fallback, max) => { const v = params.get(key); if (v === null) return fallback; if (!/^\d+$/.test(v) || +v > max) throw Error('Ugyldig sideinndeling.'); return +v; };
    const offset = integer('offset', 0, 100000), limit = integer('limit', 40, 100); if (limit < 1) throw Error('Velg minst én rad.');
    const tokens = fold(q.trim()).split(/\s+/).filter(Boolean);
    return { offset, limit, matches: p => tokens.every(t => p.search.includes(t)) };
  }
  function participants(params) {
    const { offset, limit, matches } = query(params), found = rows.filter(matches);
    return { total: found.length, offset, limit, people: found.slice(offset, offset + limit).map(summary) };
  }
  function participant(id) {
    const p = byId.get(id); if (!p) throw Error('Deltakeren finnes ikke i den godkjente historikken.');
    return { ...summary(p), years: p.years, earned: p.earned,
      results: model.resultsFor(id).slice().sort((a, b) => b[0] - a[0]).map(r => ({ year: r[0], event: profile?.distances.find(d=>d.competition===r[2]&&d.km===History.parseDistanceKm(r[3]))?.name || History.eventLabel(r), distance: r[3], status: History.effectiveStatus(r), time: r[5], place: History.sourcePlace(r), club: r[8] || null })) };
  }
  function badgeList(params) {
    const { offset, limit, matches } = query(params, ['view', 'level']), view = params.get('view') || 'earned', level = params.get('level') || 'all';
    if (!['earned', 'upcoming'].includes(view) || level !== 'all' && !levels.some(b => String(b.n) === level)) throw Error('Ukjent merkeutvalg.');
    const found = rows.filter(matches).filter(p => view === 'earned' ? p.earned.some(b => level === 'all' || String(b.level) === level) : p.nextBadge && (level === 'all' || String(p.nextBadge.level) === level));
    found.sort((a, b) => view === 'upcoming' ? a.nextBadge.remaining - b.nextBadge.remaining || compareNames(a, b) : b.count - a.count || compareNames(a, b));
    return { total: found.length, offset, limit, view, people: found.slice(offset, offset + limit).map(p => ({ ...summary(p), earned: p.earned })) };
  }
  function overview() {
    const latest = rows.filter(p => p.years.includes(latestYear)), milestones = rows.flatMap(p => p.earned.filter(b => b.year === latestYear).map(b => ({ id: p.id, name: p.name, badge: b })));
    return { logoSrc: assetBase + badges.badges.find(b => b.id === 'debut').src, watermarkSrc: assetBase + badges.watermark.src, latestYear, firstYear: years[0]??null, editionCount: years.length, runnerCount: rows.filter(p => p.count > 0).length, registeredPeople: rows.length, honorCount,
      latestParticipants: latest.length, debutants: latest.filter(p => p.firstYear === latestYear).length, newBadges: milestones.length,
      levels: levels.map(b => badge(b)), milestones: milestones.sort((a, b) => b.badge.level - a.badge.level || compareNames(a, b)).slice(0, 6),
      recentEditions: years.slice(-5).reverse().map(year => ({ year, participants: rows.filter(p => p.years.includes(year)).length })) };
  }
  return { overview, participants, participant, badgeList };
}
return { createPortalData };
});

/* Shared Heder projections and #79 draft engine. Pure data only; no file/network writes.
   The browser adapter uses approved public input and exposes preview, never persistence. */
(function(factory){
 if(typeof module==='object'&&module.exports)module.exports.Honors=factory(()=>({H:require('../../js/honors-data.js'),History:require('../../js/history-data.js')}),require('node:crypto').webcrypto);
 else window.MorothonPortalData.Honors=factory(()=>({H:window.MorothonHonorsData,History:window.MorothonHistoryData}),window.crypto);
})(function(getRules,Crypto){
 'use strict';
 let H,History;
 function rules(){({H,History}=getRules());if(!H||!History)throw Error('Heder-modellen kunne ikke lastes.');}
 const ID=/^[a-z][a-z0-9-]{1,62}$/;
 const validYear=y=>Number.isSafeInteger(y)&&y>=1900&&y<=2200;
 const copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const hash=async x=>[...new Uint8Array(await Crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const randomHex=n=>[...Crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const fail=message=>{throw Error(message);};
function createHonorAdminRoster({organizerId,enabled,honors,volunteers,editionYears,editionCatalog}={}){
 rules();
 if(typeof organizerId!=='string'||!ID.test(organizerId))
  throw Error('Heder krever en gyldig arrangør-ID.');
 if(typeof enabled!=='boolean')throw Error('Heder krever en eksplisitt modulinnstilling.');
 if(!honors||honors.schemaVersion!==1||!Array.isArray(honors.groups))
  throw Error('Heder trenger et eksisterende, gyldig kilderegister.');
 if(!Array.isArray(editionYears)||editionYears.some(y=>!validYear(y)))
  throw Error('Ugyldige gjennomførte arrangementsår.');
 // Existing Morothon sources use one edition per year. The future edition-ID
 // domain model must take over before counting multiple editions in one year.
 const years=[...new Set(editionYears)].sort((a,b)=>a-b);
 if(editionCatalog!==undefined&&!Array.isArray(editionCatalog))throw Error('Ugyldig utgavekatalog.');
 const calculationEditions=editionCatalog??years;
 if(honors.volunteerList&&(!volunteers||volunteers.schemaVersion!==1))
  throw Error('Heder mangler den tilhørende dugnadslisten.');
 if(!honors.volunteerList&&volunteers!==undefined)
  throw Error('Uventet dugnadsliste uten kildereferanse.');
 const data=honors.volunteerList?H.mergeVolunteers(honors,volunteers):copy(honors);
 const people=[],ids=new Set(),suppressedLegacyIds=[];
 for(const group of data.groups){
  if(!group||typeof group.id!=='string'||!Array.isArray(group.members))
   throw Error('Ugyldig Heder-kategori.');
  for(const member of group.members){
   if(!member||typeof member.id!=='string'||!member.id||ids.has(member.id))
    throw Error('Duplisert eller ugyldig Heder-person.');
   ids.add(member.id);
   // Previously rejected legacy entries remain in the original source for
   // provenance, but must not be resurrected as editable Heder persons.
   if(!H.isVisibleOnHonorPage(data,member.id)){
    suppressedLegacyIds.push(member.id);
    continue;
   }
   const detail=copy(data.personDetails?.[member.id]||{});
   const merged=H.personRecord(data,member);
   const profile=H.honorProfile(data,member,calculationEditions);
   const tenure=profile.tenure;
   const memorial=group.id==='memorial'||member.deceased===true||
    member.memorialRecognition?.badgeId==='service-memorial';
   const contribution=member.contribution||{};
   // A registered open period is not the same as documented individual years.
   const openPeriod=!memorial&&contribution.countingBasis!=='unknown'&&(Number.isInteger(contribution.fromYear)||typeof contribution.fromEditionId==='string')&&
    contribution.toYear===undefined&&contribution.toEditionId===undefined&&contribution.confirmedYears===undefined&&contribution.confirmedEditionIds===undefined&&
    contribution.approvedTotal===undefined;
   const visibleUnderProfile=H.isVisibleOnHonorPage(data,member.id);
   people.push({
    id:member.id,name:merged.name,groupId:group.id,
    listingOnly:member.listingOnly===true,memorial,
    hiddenFromPublic:!visibleUnderProfile,visibleIfEnabled:visibleUnderProfile,
    sourceKind:member.listingOnly===true?'volunteer-list':'honor-group',
    roles:copy(member.roles||[]),
    shortDescription:detail.shortDescription??null,
    stories:copy(detail.stories||member.stories||[]),
    honorDiplomaText:detail.honorDiplomaText??null,
    runnerLink:copy(detail.runnerLink||null),
    memorialInfo:memorial?{
     deathYear:member.deathYear??null,
     recognition:copy(member.memorialRecognition||null),
     tribute:member.diplomaTribute??null
    }:null,
    tenure:{
     basis:tenure.basis,registeredEditions:tenure.count,
     years:copy(tenure.years),fromYear:tenure.fromYear,
     toYear:tenure.toYear,excludedYears:copy(tenure.excludedYears),
     openPeriod,confirmedYears:copy(contribution.confirmedYears||[]),
     approvedTotal:copy(contribution.approvedTotal||null)
    },
    badges:{
     qualified:copy(profile.earnedBadgeIds),secondary:copy(profile.secondaryHonorIds),
     highest:profile.main.badgeId,
     next:copy(H.tenureMilestones(data,member,calculationEditions).next),
     automaticallyAwarded:false,
     planned:copy(member.plannedHonors||[]),
     formallyAwarded:copy(member.awards||[]),
     issuedDiplomas:copy(member.issuedDiplomas||[])
    },
    // Deliberately server-only; retain all original fields/provenance for a
    // future lossless editor, including uncertain facts and source IDs.
    sourceMember:copy(member),sourceDetails:detail
   });
  }
 }
 const publicEligible=people.length;
 const memorialCount=people.filter(p=>p.memorial).length;
 return {
  schemaVersion:1,organizerId,enabled,readOnly:true,publicationAuthorized:false,
  editionBasis:'legacy-distinct-year',editionYears:years,
  summary:{total:people.length,publicEligible,publicAvailable:enabled?publicEligible:0,
   suppressedLegacy:suppressedLegacyIds.length,memorial:memorialCount},
  // Internal-only provenance list: never use as a public or editable person list.
  suppressedLegacyIds,people
 };
}
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
function publicHonorAdminView(roster,badgeAssets=[]){
 if(!roster||roster.readOnly!==true||!Array.isArray(roster.people)||
  typeof roster.organizerId!=='string'||typeof roster.enabled!=='boolean')
  throw Error('Ugyldig Heder-register.');
 const people=roster.people.map(p=>{
  const c=p.tenure||{},b=p.badges||{},m=p.memorialInfo;
  return {
   id:p.id,name:p.name,groupId:p.groupId,
   memorial:p.memorial===true,listingOnly:p.listingOnly===true,
   roles:(p.roles||[]).map(r=>({title:r.title,
    ...(own(r,'confirmed')?{confirmed:r.confirmed}:{}),
    ...(own(r,'fromYear')?{fromYear:r.fromYear}:{}),
    ...(own(r,'countsForTenure')?{countsForTenure:r.countsForTenure}:{} )})),
   shortDescription:p.shortDescription??null,
   stories:(p.stories||[]).map(s=>({title:s.title??null,text:s.text,confirmed:s.confirmed===true})),
   honorDiplomaText:p.honorDiplomaText??null,
   runnerLink:p.runnerLink?.confirmed===true?{runnerId:p.runnerLink.runnerId,confirmed:true}:null,
   memorialInfo:p.memorial===true?{
    deathYear:m?.deathYear??null,
    tribute:m?.tribute??null,
    hasMemorialRecognition:!!m?.recognition
   }:null,
   tenure:{
    basis:c.basis??null,registeredEditions:c.registeredEditions??null,
    years:Array.isArray(c.years)?[...c.years]:[],
    confirmedYears:Array.isArray(c.confirmedYears)?[...c.confirmedYears]:[],
    excludedYears:Array.isArray(c.excludedYears)?[...c.excludedYears]:[],
    fromYear:c.fromYear??null,toYear:c.toYear??null,
    openPeriod:c.openPeriod===true,
    approvedTotal:c.approvedTotal?.approved===true?{
     editions:c.approvedTotal.editions,asOfYear:c.approvedTotal.asOfYear??null
    }:null
   },
   badges:{
    qualified:[...(b.qualified||[])],secondary:[...(b.secondary||[])],
    highest:b.highest??null,
    next:b.next?{editions:b.next.editions,remaining:b.next.remaining}:null,
    awarded:(b.formallyAwarded||[]).map(a=>({badgeId:a.badgeId,date:a.date})),
    automaticallyAwarded:false
   }
  };
 });
 return {schemaVersion:1,organizerId:roster.organizerId,enabled:roster.enabled,
  readOnly:true,canEdit:false,publicationAuthorized:false,
  summary:{total:people.length,memorial:people.filter(p=>p.memorial).length},
  editionYears:[...(roster.editionYears||[])],people,
  badgeAssets:badgeAssets.filter(b=>people.some(p=>p.badges.highest===b.id||p.badges.qualified.includes(b.id)||p.badges.secondary.includes(b.id))).map(b=>({id:b.id,name:b.name,src:b.src}))};
}
const normalize=value=>String(value??'').toLocaleLowerCase('nb-NO').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replaceAll('ø','o').replaceAll('æ','ae')
 .replaceAll('å','a').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function findHonorRunnerCandidates({roster,history,personId,query,limit=10}={}){
 rules();
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
  const stats=model.stats(p.i);
  candidates.push({
   runnerId:p.i,name:p.n,
   aliases:names.filter(n=>n!==p.n),
   participationCount:stats?.count||0,participationYears:[...(stats?.years||[])],
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
function object(value,allowed){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Ukjente eller ugyldige utkastfelt.');
 return value;
}
function text(value,max=2000){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('Ugyldig eller for lang tekst.');return value;}
function optionalYear(value){if(value===null)return null;if(!Number.isInteger(value)||value<1900||value>2200)fail('Ugyldig årstall.');return value;}
function list(value,max){if(!Array.isArray(value)||value.length>max)fail('Ugyldig eller for lang liste.');return value;}
function bool(value){if(typeof value!=='boolean')fail('Velg ja eller nei.');return value;}
function legacyEditionCatalog(history,organizerId){
 rules();
 // These IDs are a versioned, local legacy mapping, not newly published result IDs.
 return H.arrangedYears(history.results).map(year=>({editionId:organizerId+'-'+year,year,label:String(year),status:'held'}));
}
async function createHonorDrafts({organizerId,enabled,honors,volunteers,editions,history,badges=[]}={}){
 rules();
 if(typeof enabled!=='boolean'||typeof organizerId!=='string'||!/^[a-z][a-z0-9-]{1,62}$/.test(organizerId))fail('Ugyldig arrangør eller modulinnstilling.');
 const original=copy(honors),source=honors.volunteerList?H.mergeVolunteers(honors,volunteers):copy(honors);
 if(!Array.isArray(editions))fail('Mangler arrangørens utgavekatalog.');
 const catalog=copy(editions).map((e,index)=>({...e,order:e?.order??index})).sort((a,b)=>a.year-b.year||a.order-b.order);if(!Array.isArray(catalog))fail('Mangler arrangørens utgavekatalog.');
 const calculation={...source,editionBasis:'edition-id'};
 // The shared engine validates IDs/statuses, including an empty native catalog.
 H.serviceTenure(calculation,{id:'catalog-validation',contribution:{}},catalog);
 const held=catalog.filter(e=>e.status==='held'),yearList=[...new Set(held.map(e=>e.year))].sort((a,b)=>a-b);
 const baselineRoster=createHonorAdminRoster({organizerId,enabled,honors:{...original,editionBasis:'edition-id'},volunteers,editionYears:yearList,editionCatalog:catalog});
 const publicBaseline=publicHonorAdminView(baselineRoster),records=new Map(),previews=new Map();
 const model=history?History.create(copy(history)):null;
 const baseVersion=await hash({format:'heder-session-draft-v1',organizerId,source,catalog,history:history??null,badges});
 let draftSourceId;do{draftSourceId='session-draft-'+randomHex(12);}while(Object.hasOwn(source.sources||{},draftSourceId));
 const badgeMap=new Map(badges.map(b=>[b.id,{id:b.id,name:b.name,src:b.src}]));
 const safety={format:'heder-session-draft-v1',schemaVersion:1,canEditDraft:true,storage:'session-memory',persisted:false,productionApplied:false,publicationAuthorized:false,canPublish:false};
 const active=()=>{if(!enabled)fail('Heder-modulen er ikke aktiv.');};
 const allowedIds=new Set(held.map(e=>e.editionId));
 function byYear(year){const matches=held.filter(e=>e.year===year);if(matches.length!==1)fail('Velg konkrete utgaver; årstallet er ikke entydig.');return matches[0].editionId;}
 function baseline(personId){
  const found=personId==null?null:H.findIn(source,personId);
  if(personId!=null&&(!found||!H.isVisibleOnHonorPage(source,personId)||found.member.id!==personId))fail('Personen finnes ikke i aktivt Heder-register.');
  return found;
 }
 function seed(personId){
  const found=baseline(personId),member=found?.member||{},record=found?H.personRecord(source,member):{};
  const c=member.contribution||{},p=publicBaseline.people.find(p=>p.id===personId),memorial=p?.memorial===true;
  const mode=c.confirmedEditionIds!==undefined||c.confirmedYears!==undefined?'documented':c.approvedTotal?'approved-total':
   (c.fromYear!==undefined||c.fromEditionId!==undefined)&&(!memorial||c.toYear!==undefined||c.toEditionId!==undefined)?'period':'unknown';
  const boundary=(year,last)=>{const matches=held.filter(e=>e.year===year);return (mode==='period'?(last?matches.at(-1):matches[0]):matches.length===1?matches[0]:null)?.editionId??null;};
  const from=c.fromEditionId??boundary(c.fromYear,false);
  const to=c.toEditionId??boundary(c.toYear,true);
  return {
   name:record.name||'',shortDescription:record.shortDescription||'',honorDiplomaText:record.honorDiplomaText||'',
   roles:(member.roles||[]).map((r,i)=>({key:'role-'+i,title:r.title,countsForTenure:r.countsForTenure!==false,fromYear:r.fromYear??null,toYear:r.toYear??null})),
   stories:(record.stories||[]).map((s,i)=>({key:'story-'+i,title:s.title||'',text:s.text,sourceNote:s.source||''})),
   memorial:{enabled:memorial,deathYear:member.deathYear??null,tribute:memorial?member.diplomaTribute||'':''},
   tenure:{mode,selectedEditionIds:mode==='period'?[...(H.serviceTenure(calculation,member,catalog).editionIds||[])]:[...(c.confirmedEditionIds||(c.confirmedYears||[]).map(byYear))],
    excludedEditionIds:[...(c.excludedEditionIds||(c.excludedYears||[]).map(byYear))],fromEditionId:from,toEditionId:to,
    stillActive:!memorial&&mode==='period'&&c.toYear===undefined&&c.toEditionId===undefined}
  };
 }
 function checkedFields(value,record){
  object(value,['name','shortDescription','honorDiplomaText','roles','stories','memorial','tenure']);
  const f={name:text(value.name,160).trim(),shortDescription:text(value.shortDescription,2000),honorDiplomaText:text(value.honorDiplomaText,5000)};
  if(!f.name)fail('Skriv inn personens navn.');
  const keys=(rows,prefix)=>{const seen=new Set();for(const r of rows){if(r.key!==null&&(!new RegExp('^'+prefix+'-[0-9]+$').test(r.key)||seen.has(r.key)))fail('Ugyldig eller duplisert tekst-/rollenøkkel.');if(r.key!==null)seen.add(r.key);}};
  f.roles=list(value.roles,30).map(r=>{object(r,['key','title','countsForTenure','fromYear','toYear']);const row={key:r.key,title:text(r.title,160),countsForTenure:bool(r.countsForTenure),fromYear:optionalYear(r.fromYear),toYear:optionalYear(r.toYear)};
   if(!row.title.trim()||row.fromYear!==null&&row.toYear!==null&&row.toYear<row.fromYear)fail('Kontroller rolle og eventuell periode.');return row;});keys(f.roles,'role');
  f.stories=list(value.stories,30).map(s=>{object(s,['key','title','text','sourceNote']);const row={key:s.key,title:text(s.title,200),text:text(s.text,5000),sourceNote:text(s.sourceNote,500)};if(!row.text.trim())fail('Skriv historietekst eller fjern den tomme historien.');return row;});keys(f.stories,'story');
  const originalFields=record.originalFields;
  for(const [key,rows]of [['roles',f.roles],['stories',f.stories]])for(const row of rows)if(row.key!==null&&!originalFields[key].some(r=>r.key===row.key))fail('Tekst-/rollenøkkelen tilhører ikke denne personen.');
  object(value.memorial,['enabled','deathYear','tribute']);f.memorial={enabled:bool(value.memorial.enabled),deathYear:optionalYear(value.memorial.deathYear),tribute:text(value.memorial.tribute,3000)};
  if(originalFields.memorial.enabled&&!f.memorial.enabled)fail('Eksisterende minneprofiler kan ikke gjøres aktive i denne utkastpiloten.');
  if(!f.memorial.enabled&&(f.memorial.deathYear!==null||f.memorial.tribute))fail('Dødsår og minnetekst krever en minneprofil.');
  const t=object(value.tenure,['mode','selectedEditionIds','excludedEditionIds','fromEditionId','toEditionId','stillActive']);
  if(!['unknown','documented','period','approved-total'].includes(t.mode))fail('Velg et gyldig beregningsgrunnlag.');
  const ids=values=>{list(values,500);if(new Set(values).size!==values.length||values.some(id=>!allowedIds.has(id)))fail('Velg bare unike, faktisk gjennomførte utgaver.');return [...values];};
  f.tenure={mode:t.mode,selectedEditionIds:ids(t.selectedEditionIds),excludedEditionIds:ids(t.excludedEditionIds),fromEditionId:t.fromEditionId,toEditionId:t.toEditionId,stillActive:bool(t.stillActive)};
  for(const id of [t.fromEditionId,t.toEditionId])if(id!==null&&!allowedIds.has(id))fail('Velg en gjennomført start-/sluttutgave.');
  if(t.mode==='approved-total'&&!baseline(record.isNew?null:record.personId)?.member.contribution?.approvedTotal)fail('Det finnes ikke et godkjent samlet antall å bevare.');
  if(f.memorial.enabled&&t.stillActive)fail('En minneprofil kan ikke være løpende aktiv.');
  if(t.mode==='period'&&(!t.fromEditionId||!t.stillActive&&!t.toEditionId||t.stillActive&&t.toEditionId))fail('Velg start og enten fortsatt aktiv eller en eksplisitt sluttutgave.');
  if(t.mode!=='period'&&t.stillActive)fail('Fortsatt aktiv gjelder bare en registrert periode.');
  if(f.memorial.enabled&&f.memorial.deathYear!==null&&[...t.selectedEditionIds,...(t.toEditionId?[t.toEditionId]:[])].some(id=>held.find(e=>e.editionId===id).year>f.memorial.deathYear))fail('Velg bare utgaver som ligger senest i det oppgitte dødsåret.');
  if(t.selectedEditionIds.some(id=>t.excludedEditionIds.includes(id)))fail('En utgave kan ikke være både valgt innsats og fravær.');
  return f;
 }
 function access(request,extra=[]){
  active();object(request,['draftId','revision','baseVersion',...extra]);
  const r=records.get(request.draftId);
  if(!r||request.baseVersion!==baseVersion||request.baseVersion!==r.baseVersion)fail('Utkastet tilhører ikke dette arrangementsgrunnlaget. Åpne et nytt utkast.');
  if(!Number.isSafeInteger(request.revision)||request.revision!==r.revision)fail('Utkastet er endret. Åpne siste øktversjon før du fortsetter.');
  return r;
 }
 function makeData(record,fields,identity){
  const data=copy(source);data.editionBasis='edition-id';data.sources??={};data.sources[draftSourceId]={title:'Lokal utkastgjennomgang; ikke publiseringsgodkjenning'};
  const found=baseline(record.isNew?null:record.personId),old=found?.member;
  let member=old?copy(old):{id:record.personId,name:fields.name,status:'provisional',roles:[],stories:[],awards:[],issuedDiplomas:[],badgeProposal:{badgeIds:[],primaryBadgeId:null,status:'proposed'}};
  member.name=fields.name;
  member.roles=fields.roles.map(r=>{const prior=old?.roles?.[Number(r.key?.slice(5))]||{};const was=record.originalFields.roles.find(x=>x.key===r.key&&r.key!==null);if(was&&same(was,r))return copy(prior);const row={...copy(prior),title:r.title,countsForTenure:r.countsForTenure};delete row.fromYear;delete row.toYear;if(r.fromYear!==null)row.fromYear=r.fromYear;if(r.toYear!==null)row.toYear=r.toYear;row.confirmed=false;return row;});
  if(!old||fields.memorial.enabled!==record.originalFields.memorial.enabled)member.deceased=fields.memorial.enabled;
  if(!old||fields.memorial.deathYear!==record.originalFields.memorial.deathYear){if(fields.memorial.deathYear!==null)member.deathYear=fields.memorial.deathYear;else delete member.deathYear;}
  if(fields.memorial.enabled&&(!old||fields.memorial.tribute!==record.originalFields.memorial.tribute))member.diplomaTribute=fields.memorial.tribute;
  const t=fields.tenure,c=old?.contribution&&same(t,record.originalFields.tenure)?copy(old.contribution):{sourceIds:[draftSourceId]};
  if(t.mode==='approved-total')Object.assign(c,copy(old.contribution));
  else if(t.mode==='documented')c.confirmedEditionIds=[...t.selectedEditionIds];
  else if(t.mode==='period'){c.fromEditionId=t.fromEditionId;if(t.toEditionId)c.toEditionId=t.toEditionId;c.proposedEditionIds=[...t.selectedEditionIds];}
  else{c.countingBasis='unknown';if(old?.contribution?.fromYear!==undefined)c.fromYear=old.contribution.fromYear;}
  c.excludedEditionIds=[...t.excludedEditionIds];member.contribution=c;
  if(found){const group=data.groups.find(g=>g.id===found.group.id);group.members[group.members.findIndex(p=>p.id===member.id)]=member;}
  else{let group=data.groups.find(g=>g.id==='draft-people');if(!group){group={id:'draft-people',title:'Heder-utkast',members:[],badgeId:null};data.groups.push(group);}group.members.push(member);}
  const originalDetails=copy(data.personDetails?.[record.personId]||{}),priorStories=H.personRecord(source,old||{}).stories||[];
  const stories=fields.stories.map(s=>{const original=priorStories[Number(s.key?.slice(6))]||{};const was=record.originalFields.stories.find(x=>x.key===s.key&&s.key!==null);if(was&&same(was,s))return copy(original);const row={...copy(original),title:s.title,text:s.text};if(s.sourceNote)row.source=s.sourceNote;else delete row.source;if(!s.title&&original.title===undefined)delete row.title;row.confirmed=false;return row;});
  const details={...originalDetails,shortDescription:fields.shortDescription,stories,honorDiplomaText:fields.honorDiplomaText};
  for(const key of ['shortDescription','honorDiplomaText'])if(fields[key]===''&&originalDetails[key]===undefined)delete details[key];
  if(identity?.action==='link')details.runnerLink={runnerId:identity.runnerId,confirmed:false};
  if(identity?.action==='remove')delete details.runnerLink;
  (data.personDetails??={})[record.personId]=details;
  return {data,member};
 }
 function checkedIdentity(value,record){
  if(value==null)return null;
  object(value,['action','runnerId','confirmed']);
  if(value.confirmed!==true||!['link','remove'].includes(value.action))fail('Løperidentiteten må bekreftes separat før den tas med i utkastet.');
  if(value.action==='remove'){if(value.runnerId!==null)fail('Ugyldig fjerning av løperkobling.');return {action:'remove',confirmedInDraft:true};}
  if(!model||typeof value.runnerId!=='string'||!model.person(value.runnerId))fail('Velg en gyldig løper fra deltakerhistorikken.');
  const runnerId=model.resolve(value.runnerId);
  for(const p of baselineRoster.people)if(p.id!==record.personId&&p.runnerLink?.confirmed===true&&model.resolve(p.runnerLink.runnerId)===runnerId)fail('Løperen er allerede koblet til en annen Heder-person. Åpne eksisterende profil.');
  for(const r of records.values())if(r.id!==record.id&&r.keptIdentity?.runnerId===runnerId)fail('Løperen er allerede valgt i et annet øktutkast.');
  return {action:'link',runnerId,confirmedInDraft:true};
 }
 function meta(record){return {draftId:record.id,personId:record.personId,name:record.keptFields?.name||record.originalFields.name||'Ny person',revision:record.revision,baseVersion,state:record.keptFields?'kept':'editing',...safety};}
 function open(request={}){
  active();object(request,['personId','draftId']);
  if(request.personId!==undefined&&request.draftId!==undefined)fail('Velg enten person eller øktutkast.');
  let record;
  if(request.draftId!==undefined){record=records.get(request.draftId);if(!record)fail('Utkastet finnes ikke i denne økten.');}
  else{
   if(request.personId!==undefined&&typeof request.personId!=='string')fail('Ugyldig personvalg.');
   const existing=request.personId!=null?baseline(request.personId):null;
   record=existing?[...records.values()].find(r=>r.personId===request.personId):null;
   if(!record){
    if(records.size>=100)fail('Økten har for mange utkast. Forkast et utkast før du oppretter flere.');
    const id='draft-'+randomHex(12),personId=existing?request.personId:'draft-person-'+randomHex(12);
    record={id,personId,isNew:!existing,baseVersion,revision:0,originalFields:seed(existing?personId:null),keptFields:null,keptIdentity:null};records.set(id,record);
   }
  }
  const found=baseline(record.isNew?null:record.personId);
  return {...meta(record),isNew:record.isNew,fields:copy(record.keptFields||record.originalFields),identityReview:record.keptIdentity?{action:record.keptIdentity.action,runnerId:record.keptIdentity.runnerId??null,confirmed:true}:null,
   existing:copy(publicBaseline.people.find(p=>p.id===record.personId)||null),
   evidence:{hasOriginalSources:!!found?.member.sourceIds?.length,approvedTotal:found?.member.contribution?.approvedTotal?{editions:found.member.contribution.approvedTotal.editions,asOfYear:found.member.contribution.approvedTotal.asOfYear??null}:null},
   editions:catalog.map(e=>({editionId:e.editionId,year:e.year,label:e.label||String(e.year),status:e.status})),
   rules:(source.awardPolicy?.milestones||[]).map(m=>({badgeId:m.badgeId,editions:m.minimumDocumentedEditions,name:badgeMap.get(m.badgeId)?.name||String(m.minimumDocumentedEditions)+' utgaver'}))};
 }
 function uniqueName(fields,record){
  const normalized=name=>name.toLocaleLowerCase('nb-NO').replace(/[-\s]+/g,' ').trim();
  if(!record.isNew&&normalized(fields.name)===normalized(record.originalFields.name))return;
  if((source.retiredProfiles||[]).some(p=>typeof p.name==='string'&&normalized(p.name)===normalized(fields.name))||baselineRoster.suppressedLegacyIds.some(id=>normalized(H.findIn(source,id).member.name)===normalized(fields.name)))fail('Denne historiske oppføringen krever egen gjennomgang før den kan gjeninnføres.');
  if(baselineRoster.people.some(p=>p.id!==record.personId&&[p.name,...(p.sourceMember.aliases||[])].some(name=>normalized(name)===normalized(fields.name)))||[...records.values()].some(r=>r.id!==record.id&&r.keptFields&&normalized(r.keptFields.name)===normalized(fields.name)))fail('Navnet finnes allerede i Heder eller et øktutkast. Åpne eksisterende person før du oppretter et mulig duplikat.');
 }
 async function preview(request){
  const record=access(request,['fields','identityReview']),revision=record.revision,ticket=(record.previewRequest||0)+1;record.previewRequest=ticket;record.latestPreviewId=null;
  const fields=checkedFields(request.fields,record),identity=checkedIdentity(request.identityReview,record);
  uniqueName(fields,record);
  const {data,member}=makeData(record,fields,identity);
  const roster=createHonorAdminRoster({organizerId,enabled,honors:data,editionYears:yearList,editionCatalog:catalog});
  const profile=publicHonorAdminView(roster).people.find(p=>p.id===record.personId);
  const tenure=H.serviceTenure(data,member,catalog);
  const diffs=[],labels={name:'Navn',shortDescription:'Kort omtale',roles:'Roller',stories:'Historier',honorDiplomaText:'Personlig diplomtekst',memorial:'Minneprofil',tenure:'Utgaver og beregningsgrunnlag'};
  for(const [key,label]of Object.entries(labels))if(!same(record.originalFields[key],fields[key]))diffs.push({field:key,label,before:copy(record.originalFields[key]),after:copy(fields[key])});
  if(identity)diffs.push({field:'runnerLink',label:'Løperkobling (bare utkast)',before:copy(publicBaseline.people.find(p=>p.id===record.personId)?.runnerLink||null),after:copy(identity)});
  const id='preview-'+randomHex(12);
  const needsEditionReview=fields.tenure.mode==='period'||!same(fields.tenure,record.originalFields.tenure);
  const value={previewId:id,draftId:record.id,personId:record.personId,revision:record.revision,baseVersion,...safety,
   profile,selectedEditionIds:[...(tenure.editionIds||[])],diff:diffs,needsEditionReview,
   consequences:{beforeCount:publicBaseline.people.find(p=>p.id===record.personId)?.tenure.registeredEditions??null,afterCount:profile.tenure.registeredEditions,formalAwardsUnchanged:true},
   qualifier:'Kun kvalifisering i et utkast; ingen formell tildeling eller rent diplom.',
   badges:(H.tenureMilestones(data,member,catalog).qualified||[]).map(m=>({id:m.badgeId,editions:m.editions,src:badgeMap.get(m.badgeId)?.src||null,name:badgeMap.get(m.badgeId)?.name||m.editions+' utgaver'})),
   secondaryBadges:profile.badges.secondary.map(id=>copy(badgeMap.get(id))).filter(Boolean),
   mainBadge:copy(badgeMap.get(profile.badges.highest)||null),runnerLinkProposal:copy(identity),selectionDigest:await hash({fields,identity,baseVersion})};
  if(records.get(record.id)!==record||record.revision!==revision||record.previewRequest!==ticket)fail('Forhåndsvisningen er foreldet. Kontroller endringene igjen.');
  record.latestPreviewId=id;
  previews.set(id,{draftId:record.id,revision:record.revision,fields,identity,needsEditionReview,value});
  if(previews.size>100)previews.delete(previews.keys().next().value);
  return copy(value);
 }
 function keep(request){
  const record=access(request,['previewId','editionsReviewed']),candidate=previews.get(request.previewId);
  if(!candidate||record.latestPreviewId!==request.previewId||candidate.draftId!==record.id||candidate.revision!==record.revision)fail('Forhåndsvisningen er foreldet. Kontroller endringene igjen.');
  if(candidate.needsEditionReview&&request.editionsReviewed!==true)fail('Gjennomgå og bekreft de konkrete utgavene før utkastet beholdes.');
  if(request.editionsReviewed!==undefined&&typeof request.editionsReviewed!=='boolean')fail('Ugyldig utgavegjennomgang.');
  uniqueName(candidate.fields,record);
  if(candidate.identity)checkedIdentity({action:candidate.identity.action,runnerId:candidate.identity.runnerId??null,confirmed:true},record);
  // The server-held preview, not client-supplied records or approval claims, is retained.
  record.keptFields=copy(candidate.fields);record.keptIdentity=copy(candidate.identity);record.revision++;
  for(const [key,p]of previews)if(p.draftId===record.id)previews.delete(key);
  return {...meta(record),message:'Utkastet er beholdt kun i denne serverøkten. Ingen personregistre eller diplomer er endret.'};
 }
 function discard(request){const record=access(request);records.delete(record.id);for(const [key,p]of previews)if(p.draftId===record.id)previews.delete(key);return {discarded:true,...safety};}
 function pending(){active();return {items:[...records.values()].filter(r=>r.keptFields).map(meta),baseVersion,...safety};}
 return {open,preview,keep,discard,pending};
}
return {createHonorAdminRoster,publicHonorAdminView,findHonorRunnerCandidates,createHonorDrafts,legacyEditionCatalog};
});
