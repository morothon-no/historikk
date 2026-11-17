// Session-memory Heder overlays only. No file writes, production adapter or publication approval.
'use strict';
const {createHash,randomBytes}=require('node:crypto');
const H=require('../../js/honors-data.js'),History=require('../../js/history-data.js');
const {createHonorAdminRoster}=require('./honor-roster.cjs');
const {publicHonorAdminView}=require('./honor-admin-view.cjs');
const copy=x=>structuredClone(x),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=message=>{throw Error(message);};
function object(value,allowed){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Ukjente eller ugyldige utkastfelt.');
 return value;
}
function text(value,max=2000){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('Ugyldig eller for lang tekst.');return value;}
function optionalYear(value){if(value===null)return null;if(!Number.isInteger(value)||value<1900||value>2200)fail('Ugyldig årstall.');return value;}
function list(value,max){if(!Array.isArray(value)||value.length>max)fail('Ugyldig eller for lang liste.');return value;}
function bool(value){if(typeof value!=='boolean')fail('Velg ja eller nei.');return value;}
function legacyEditionCatalog(history,organizerId){
 // These IDs are a versioned, local legacy mapping, not newly published result IDs.
 return H.arrangedYears(history.results).map(year=>({editionId:organizerId+'-'+year,year,label:String(year),status:'held'}));
}
function createHonorDrafts({organizerId,enabled,honors,volunteers,editions,history,badges=[]}={}){
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
 const baseVersion=hash({format:'heder-session-draft-v1',organizerId,source,catalog,history:history??null,badges});
 let draftSourceId;do{draftSourceId='session-draft-'+randomBytes(12).toString('hex');}while(Object.hasOwn(source.sources||{},draftSourceId));
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
  member.roles=fields.roles.map(r=>{const prior=old?.roles?.[Number(r.key?.slice(5))]||{};const was=record.originalFields.roles.find(x=>x.key===r.key&&r.key!==null);if(was&&hash(was)===hash(r))return copy(prior);const row={...copy(prior),title:r.title,countsForTenure:r.countsForTenure};delete row.fromYear;delete row.toYear;if(r.fromYear!==null)row.fromYear=r.fromYear;if(r.toYear!==null)row.toYear=r.toYear;row.confirmed=false;return row;});
  if(!old||fields.memorial.enabled!==record.originalFields.memorial.enabled)member.deceased=fields.memorial.enabled;
  if(!old||fields.memorial.deathYear!==record.originalFields.memorial.deathYear){if(fields.memorial.deathYear!==null)member.deathYear=fields.memorial.deathYear;else delete member.deathYear;}
  if(fields.memorial.enabled&&(!old||fields.memorial.tribute!==record.originalFields.memorial.tribute))member.diplomaTribute=fields.memorial.tribute;
  const t=fields.tenure,c=old?.contribution&&hash(t)===hash(record.originalFields.tenure)?copy(old.contribution):{sourceIds:[draftSourceId]};
  if(t.mode==='approved-total')Object.assign(c,copy(old.contribution));
  else if(t.mode==='documented')c.confirmedEditionIds=[...t.selectedEditionIds];
  else if(t.mode==='period'){c.fromEditionId=t.fromEditionId;if(t.toEditionId)c.toEditionId=t.toEditionId;c.proposedEditionIds=[...t.selectedEditionIds];}
  else{c.countingBasis='unknown';if(old?.contribution?.fromYear!==undefined)c.fromYear=old.contribution.fromYear;}
  c.excludedEditionIds=[...t.excludedEditionIds];member.contribution=c;
  if(found){const group=data.groups.find(g=>g.id===found.group.id);group.members[group.members.findIndex(p=>p.id===member.id)]=member;}
  else{let group=data.groups.find(g=>g.id==='draft-people');if(!group){group={id:'draft-people',title:'Heder-utkast',members:[],badgeId:null};data.groups.push(group);}group.members.push(member);}
  const originalDetails=copy(data.personDetails?.[record.personId]||{}),priorStories=H.personRecord(source,old||{}).stories||[];
  const stories=fields.stories.map(s=>{const original=priorStories[Number(s.key?.slice(6))]||{};const was=record.originalFields.stories.find(x=>x.key===s.key&&s.key!==null);if(was&&hash(was)===hash(s))return copy(original);const row={...copy(original),title:s.title,text:s.text};if(s.sourceNote)row.source=s.sourceNote;else delete row.source;if(!s.title&&original.title===undefined)delete row.title;row.confirmed=false;return row;});
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
    const id='draft-'+randomBytes(12).toString('hex'),personId=existing?request.personId:'draft-person-'+randomBytes(12).toString('hex');
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
 function preview(request){
  const record=access(request,['fields','identityReview']);
  const fields=checkedFields(request.fields,record),identity=checkedIdentity(request.identityReview,record);
  uniqueName(fields,record);
  const {data,member}=makeData(record,fields,identity);
  const roster=createHonorAdminRoster({organizerId,enabled,honors:data,editionYears:yearList,editionCatalog:catalog});
  const profile=publicHonorAdminView(roster).people.find(p=>p.id===record.personId);
  const tenure=H.serviceTenure(data,member,catalog);
  const diffs=[],labels={name:'Navn',shortDescription:'Kort omtale',roles:'Roller',stories:'Historier',honorDiplomaText:'Personlig diplomtekst',memorial:'Minneprofil',tenure:'Utgaver og beregningsgrunnlag'};
  for(const [key,label]of Object.entries(labels))if(hash(record.originalFields[key])!==hash(fields[key]))diffs.push({field:key,label,before:copy(record.originalFields[key]),after:copy(fields[key])});
  if(identity)diffs.push({field:'runnerLink',label:'Løperkobling (bare utkast)',before:copy(publicBaseline.people.find(p=>p.id===record.personId)?.runnerLink||null),after:copy(identity)});
  const id='preview-'+randomBytes(12).toString('hex');
  const needsEditionReview=fields.tenure.mode==='period'||hash(fields.tenure)!==hash(record.originalFields.tenure);
  const value={previewId:id,draftId:record.id,personId:record.personId,revision:record.revision,baseVersion,...safety,
   profile,selectedEditionIds:[...(tenure.editionIds||[])],diff:diffs,needsEditionReview,
   consequences:{beforeCount:publicBaseline.people.find(p=>p.id===record.personId)?.tenure.registeredEditions??null,afterCount:profile.tenure.registeredEditions,formalAwardsUnchanged:true},
   qualifier:'Kun kvalifisering i et utkast; ingen formell tildeling eller rent diplom.',
   badges:(H.tenureMilestones(data,member,catalog).qualified||[]).map(m=>({id:m.badgeId,editions:m.editions,src:badgeMap.get(m.badgeId)?.src||null,name:badgeMap.get(m.badgeId)?.name||m.editions+' utgaver'})),
   mainBadge:copy(badgeMap.get(profile.badges.highest)||null),runnerLinkProposal:copy(identity),selectionDigest:hash({fields,identity,baseVersion})};
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
module.exports={createHonorDrafts,legacyEditionCatalog};
