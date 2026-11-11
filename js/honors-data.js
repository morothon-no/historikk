/* Explicit honor identities, roles and awards. Neither names nor race counts prove an identity or volunteer tenure. */
(function () {
  'use strict';
  let pending;
  const key=v=>typeof v==='string'&&/^[a-z0-9-]+$/.test(v);
  function findIn(data,id){for(const group of data.groups){const member=group.members.find(m=>m.id===id||m.aliasIds?.includes(id));if(member)return {member,group};}return null;}
  function membersFor(data,group){return [...(group.memberRefs||[]).map(id=>findIn(data,id).member),...group.members];}
  function hasSource(data,value){return typeof value.source==='string'&&!!value.source.trim()||Array.isArray(value.sourceIds)&&value.sourceIds.length>0&&value.sourceIds.every(id=>data.sources?.[id]);}
  function badgePlan(data,member,group){
    const proposal=member.badgeProposal;
    // Legacy group graphics never establish a formal award; V3.4 requires an explicit plan.
    const ids=(proposal?.badgeIds||(data.contentVersion?[]:group.badgeId?[group.badgeId]:[])).filter(id=>isActiveBadge(data,id));
    return {badgeIds:ids,primaryBadgeId:ids.includes(proposal?.primaryBadgeId)?proposal.primaryBadgeId:ids[0]||null,status:'proposed'};
  }
  const isActiveBadge=(data,id)=>!(data.awardPolicy?.retiredBadgeIds||['service-hedersildsjel','service-dugnadshelt']).includes(id);
  function contribution(member){
    const c=member.contribution||{},years=c.sourceIds?.length?[...new Set(c.confirmedYears||[])].sort((a,b)=>a-b):[];
    return {years,count:years.length,first:years[0]??null,last:years.at(-1)??null,
      eligible:years.length>=5||c.exception?.confirmed===true&&!!c.exception.sourceIds?.length,
      basis:years.length>=5?'documented-editions':c.exception?.confirmed===true?'explicit-decision':'not-established'};
  }
  function tenureMilestones(data,member,editionYears){
    const tenure=serviceTenure(data,member,editionYears),count=tenure.count||0,policy=data.awardPolicy?.milestones||[];
    const qualified=policy.filter(m=>count>=m.minimumDocumentedEditions).map(m=>({badgeId:m.badgeId,editions:m.minimumDocumentedEditions}));
    const next=policy.find(m=>count<m.minimumDocumentedEditions);
    return {registeredEditions:tenure.count,documentedEditions:contribution(member).count,qualified,highestQualified:qualified.at(-1)||null,
      next:next?{badgeId:next.badgeId,editions:next.minimumDocumentedEditions,remaining:next.minimumDocumentedEditions-count}:null,automaticallyAwarded:false};
  }
  const validYear=y=>Number.isInteger(y)&&y>=1900&&y<=9999;
  function validateTenure(c){
    for(const field of ['fromYear','toYear'])if(c[field]!==undefined&&!validYear(c[field]))throw new Error('Ugyldig dugnadsperiode.');
    if(c.fromYear!==undefined&&c.toYear!==undefined&&c.toYear<c.fromYear)throw new Error('Ugyldig dugnadsperiode.');
    for(const field of ['confirmedYears','excludedYears'])if(c[field]!==undefined&&(!Array.isArray(c[field])||new Set(c[field]).size!==c[field].length||c[field].some(y=>!validYear(y))))throw new Error('Ugyldige dugnadsår.');
    if((c.confirmedYears||[]).some(y=>(c.excludedYears||[]).includes(y)||c.fromYear!==undefined&&y<c.fromYear||c.toYear!==undefined&&y>c.toYear))throw new Error('Motstridende dugnadsår.');
    if(c.approvedTotal){const t=c.approvedTotal;if(t.approved!==true||!Number.isInteger(t.editions)||t.editions<0||!t.sourceIds?.length||t.asOfYear!==undefined&&!validYear(t.asOfYear))throw new Error('Ugyldig arrangørgodkjent samlet dugnadsantall.');}
    if(c.toYearStatus!==undefined&&(!['confirmed','provisional'].includes(c.toYearStatus)||c.toYear===undefined))throw new Error('Ugyldig status for dugnadsslutt.');
  }
  function startYear(member){
    const registered=[member.contribution?.fromYear,...(member.roles||[]).filter(r=>r.confirmed&&r.countsForTenure!==false).map(r=>r.fromYear)].filter(validYear);
    return registered.length?Math.min(...registered):contribution(member).first;
  }
  const norwegianNames=new Intl.Collator('nb-NO',{sensitivity:'base',numeric:true});
  function sortVolunteers(members){
    return [...members].sort((a,b)=>(startYear(a)??Infinity)-(startYear(b)??Infinity)||norwegianNames.compare(a.name,b.name)||norwegianNames.compare(a.id,b.id));
  }
  // The one registered-service calculation used by cards, profiles, diplomas
  // and reports. Source provenance remains separate from formal issuance.
  function serviceTenure(data,member,editionYears){
    const editions=[...new Set((editionYears??data.editionYears??data.presentationPrintSet?.editionYears??[]).filter(validYear))].sort((a,b)=>a-b);
    const c=member.contribution||{},asOfYear=editions.at(-1)??null;
    const result={basis:'not-established',count:null,years:[],asOfYear,fromYear:c.fromYear??null,toYear:c.toYear??null,
      excludedYears:[...(c.excludedYears||[])],highest:null,automaticallyAwarded:false};
    if(Array.isArray(c.confirmedYears)&&c.sourceIds?.length){
      result.basis='documented';result.years=[...new Set(c.confirmedYears)].filter(y=>asOfYear===null||y<=asOfYear).sort((a,b)=>a-b);result.count=result.years.length;
    }else if(c.approvedTotal?.approved===true&&c.approvedTotal.sourceIds?.length){
      if(asOfYear!==null&&c.approvedTotal.asOfYear>asOfYear)return result;
      result.basis='approved-total';result.count=c.approvedTotal.editions;
    }else if(c.fromYear!==undefined&&asOfYear!==null){
      result.basis='registered-period';result.years=editions.filter(y=>y>=c.fromYear&&y<=Math.min(c.toYear??asOfYear,asOfYear)&&!result.excludedYears.includes(y));result.count=result.years.length;
    }
    result.first=result.years[0]??null;result.last=result.years.at(-1)??null;
    result.fromYear=c.fromYear??result.first;
    result.toYearStatus=c.toYearStatus||null;
    result.milestoneYears=Object.fromEntries((data.awardPolicy?.milestones||[]).map(m=>[m.minimumDocumentedEditions,result.years[m.minimumDocumentedEditions-1]??null]));
    if(result.count!==null){const highest=(data.awardPolicy?.milestones||[]).filter(m=>result.count>=m.minimumDocumentedEditions).at(-1);if(highest)result.highest={badgeId:highest.badgeId,editions:highest.minimumDocumentedEditions};}
    return result;
  }
  // Backwards-compatible API name; no independent calculation.
  const provisionalMilestone=serviceTenure;
  function arrangedYears(results){
    return [...new Set(results.filter(r=>/^(fullfort(?: |$)|dnf$|deltatt$)/.test(String(r[4]||'').toLowerCase().replaceAll('ø','o'))).map(r=>r[0]).filter(validYear))].sort((a,b)=>a-b);
  }
  function isFounder(data,member){return !!data.groups.find(g=>g.id==='founders')?.members.some(m=>m.id===member.id&&m.status==='confirmed');}
  function mainBadge(data,member,editionYears){
    const tenure=serviceTenure(data,member,editionYears),plan=badgePlan(data,member,findIn(data,member.id)?.group||{});
    const base={badgeId:null,basis:tenure.basis,count:tenure.count,fromYear:tenure.fromYear,toYear:tenure.toYear,toYearStatus:tenure.toYearStatus||null,
      excludedYears:tenure.excludedYears,status:'earned',automaticallyAwarded:false};
    if(member.memorialRecognition?.badgeId==='service-memorial')return {...base,badgeId:'service-memorial',status:'proposed'};
    if(plan.badgeIds.includes('service-aeresmerke'))return {...base,badgeId:'service-aeresmerke',status:member.plannedHonors?.some(h=>h.badgeId==='service-aeresmerke')?'planned':'proposed'};
    if(isFounder(data,member))return {...base,badgeId:'service-grunnlegger',status:'historical'};
    return tenure.highest?{...base,badgeId:tenure.highest.badgeId,editions:tenure.highest.editions}:base;
  }
  function honorProfile(data,member,editionYears){
    const tenure=serviceTenure(data,member,editionYears),main=mainBadge(data,member,editionYears);
    const earned=(data.awardPolicy?.milestones||[]).filter(m=>tenure.count!==null&&tenure.count>=m.minimumDocumentedEditions).map(m=>m.badgeId).filter(id=>isActiveBadge(data,id));
    const historical=isFounder(data,member)?['service-grunnlegger']:[];
    const special=badgePlan(data,member,findIn(data,member.id)?.group||{}).badgeIds.filter(id=>!earned.includes(id));
    return {tenure,main,earnedBadgeIds:earned,historicalBadgeIds:historical,
      secondaryHonorIds:[...new Set([...historical,...special])].filter(id=>id!==main.badgeId&&isActiveBadge(data,id)),
      collectionIds:earned.filter(id=>id!==main.badgeId)};
  }
  function diplomaChoices(data,member,editionYears){
    const profile=honorProfile(data,member,editionYears);
    return [...new Set([profile.main.badgeId||'thanks',...profile.secondaryHonorIds,...profile.earnedBadgeIds])].filter(id=>isActiveBadge(data,id));
  }
  function canPresent(data,member,badgeId,editionYears){
    if(badgeId==='thanks')return true;
    return diplomaChoices(data,member,editionYears).includes(badgeId);
  }
  // A small, source-backed name list extends the same canonical profiles. It cannot award badges.
  function mergeVolunteers(data,list){
    if(list?.schemaVersion!==1||!Array.isArray(list.people))throw new Error('Ugyldig dugnadsliste.');
    const combined=structuredClone(data),group=combined.groups?.find(g=>g.id==='volunteers'),seen=new Set();
    if(!group)throw new Error('Dugnadsgruppen mangler.');
    delete combined.volunteerList;
    if(list.sources!==undefined){
      if(!list.sources||typeof list.sources!=='object'||Array.isArray(list.sources))throw new Error('Ugyldige dugnadskilder.');
      for(const [id,source]of Object.entries(list.sources)){
        if(!key(id)||Object.hasOwn(combined.sources||{},id))throw new Error('Dugnadskilden finnes allerede.');
        (combined.sources??={})[id]=structuredClone(source);
      }
    }
    const tenureFields=['fromYear','toYear','toYearStatus','excludedYears','confirmedYears','approvedTotal'];
    const fields=new Set(['id','name','role','roleType',...tenureFields,'text','sourceIds','stories','nameStatus','internalNotes']);
    for(const entry of list.people){
      if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Ugyldig person i dugnadslisten.');
      if(entry.profileId!==undefined){
        const found=key(entry.profileId)&&findIn(combined,entry.profileId);
        if(Object.keys(entry).length!==1||!found)throw new Error('Ukjent hedersprofil i dugnadslisten.');
        if(seen.has(found.member.id))throw new Error('Duplisert person i dugnadslisten.');seen.add(found.member.id);
        if(!group.members.some(m=>m.id===found.member.id)&&!group.memberRefs?.includes(found.member.id))(group.memberRefs??=[]).push(found.member.id);
        continue;
      }
      if(Object.keys(entry).some(k=>!fields.has(k))||!key(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||entry.role!==undefined&&(typeof entry.role!=='string'||!entry.role.trim())||entry.text!==undefined&&typeof entry.text!=='string'||entry.fromYear!==undefined&&(!Number.isInteger(entry.fromYear)||entry.fromYear<1900||entry.fromYear>9999)||entry.nameStatus!==undefined&&!['partial','as-provided'].includes(entry.nameStatus)||entry.internalNotes!==undefined&&(!Array.isArray(entry.internalNotes)||entry.internalNotes.some(n=>typeof n!=='string')))throw new Error('Ugyldig person i dugnadslisten.');
      validateTenure(entry);
      if(entry.roleType!==undefined&&(entry.roleType!=='external'||!entry.role))throw new Error('Ugyldig tilleggsrolle.');
      if(seen.has(entry.id)||findIn(combined,entry.id)||combined.retiredProfiles?.some(m=>m.id===entry.id))throw new Error('Duplisert person: bruk profileId for en eksisterende hedersprofil.');seen.add(entry.id);
      const sources=entry.sourceIds??list.sourceIds;
      if(!Array.isArray(sources)||!sources.length||sources.some(id=>!key(id)||!Object.hasOwn(combined.sources||{},id)))throw new Error('Dugnadspersonen mangler gyldig kilde.');
      const member={id:entry.id,name:entry.name,status:'confirmed',listingOnly:true,reason:null,sourceIds:[...sources],roles:entry.role?[{title:entry.role,confirmed:true,sourceIds:[...sources]}]:[],stories:[],badgeProposal:{status:'proposed',primaryBadgeId:null,badgeIds:[],sourceIds:[...sources]},awards:[],issuedDiplomas:[]};
      if(entry.roleType==='external')member.roles[0].countsForTenure=false;
      // Legacy text/stories are accepted for file compatibility, never promoted to a full honor profile.
      if(tenureFields.some(field=>entry[field]!==undefined)){
        member.contribution={sourceIds:[...sources]};
        for(const field of tenureFields)if(entry[field]!==undefined)member.contribution[field]=structuredClone(entry[field]);
        if(entry.fromYear!==undefined&&member.roles[0])member.roles[0].fromYear=entry.fromYear;
      }
      if(entry.nameStatus)member.nameStatus=entry.nameStatus;if(entry.internalNotes)member.internalNotes=[...entry.internalNotes];
      group.members.push(member);
    }
    return combined;
  }
  function validate(data){
    const ids=new Set(),groups=new Set();if(data.schemaVersion!==1||!Array.isArray(data.groups))throw new Error('Ugyldig navneliste.');
    const refs=ids=>{if(ids!==undefined&&(!Array.isArray(ids)||ids.some(id=>!data.sources?.[id])))throw new Error('Ukjent historiekilde.');};
    for(const [id,source]of Object.entries(data.sources||{})){if(!key(id)||!source.title)throw new Error('Ugyldig kilde.');if(source.url){let url;try{url=new URL(source.url);}catch{throw new Error('Ugyldig kildelenke.');}if(url.protocol!=='https:')throw new Error('Ugyldig kildelenke.');}}
    const milestones=data.awardPolicy?.milestones||[];
    if(!Array.isArray(milestones)||!milestones.length||milestones.some((m,i)=>!Number.isInteger(m.minimumDocumentedEditions)||m.minimumDocumentedEditions<=0||i>0&&m.minimumDocumentedEditions<=milestones[i-1].minimumDocumentedEditions||MorothonBadges.get(m.badgeId).kind!=='service'))throw new Error('Ugyldig dugnadsmilepæl.');
    const special=data.awardPolicy?.specialHonors||[];
    if(!Array.isArray(special)||special.some(m=>MorothonBadges.get(m.badgeId).kind!=='service'||!m.rule))throw new Error('Ugyldig særskilt heder.');
    for(const group of data.groups){
      if(!key(group.id)||groups.has(group.id)||!group.title||!Array.isArray(group.members)||(group.badgeId!=null&&MorothonBadges.get(group.badgeId).kind!=='service'))throw new Error('Ugyldig hederskategori.');groups.add(group.id);refs(group.sourceIds);
      for(const member of group.members){
        if(!key(member.id)||ids.has(member.id)||typeof member.name!=='string'||!member.name.trim()||!['confirmed','provisional'].includes(member.status)||!(member.reason==null||typeof member.reason==='string'))throw new Error('Ugyldig eller duplisert person i navnelisten.');
        if(member.runnerId!==undefined&&(typeof member.runnerId!=='string'||!/^MOR-[A-Z0-9]{7}$/.test(member.runnerId)))throw new Error('Ugyldig eksplisitt løper-ID.');
        if(member.diplomaTribute!==undefined&&(typeof member.diplomaTribute!=='string'||member.diplomaTribute.length>350))throw new Error('Ugyldig diplomtekst.');
        if(member.stories&&(!Array.isArray(member.stories)||member.stories.some(s=>typeof s.text!=='string'||typeof s.source!=='string'||typeof s.confirmed!=='boolean')))throw new Error('Ugyldig historiekilde.');
        if(member.roles&&(!Array.isArray(member.roles)||member.roles.some(r=>typeof r.title!=='string'||typeof r.confirmed!=='boolean'||r.fromYear!==undefined&&!Number.isInteger(r.fromYear))))throw new Error('Ugyldig historisk rolle.');
        for(const item of [...(member.stories||[]),...(member.roles||[])])refs(item.sourceIds);refs(member.sourceIds);
        if((member.roles||[]).some(r=>r.confirmed&&!hasSource(data,r)))throw new Error('Bekreftet rolle mangler kilde.');
        if(member.aliases&&(!Array.isArray(member.aliases)||member.aliases.some(v=>typeof v!=='string'||!v.trim())))throw new Error('Ugyldige navnealiaser.');
        if(member.aliasIds&&(!Array.isArray(member.aliasIds)||member.aliasIds.some(v=>!key(v))))throw new Error('Ugyldige profillenker.');
        const c=member.contribution;
        if(c){refs(c.sourceIds);if(c.approvedTotal)refs(c.approvedTotal.sourceIds);validateTenure(c);if(c.confirmedYears&&!c.sourceIds?.length)throw new Error('Ugyldige dokumenterte dugnadsår.');if(c.exception){refs(c.exception.sourceIds);if(c.exception.confirmed!==true||!c.exception.sourceIds?.length)throw new Error('Særskilt beslutning mangler kilde.');}}
        const plan=member.badgeProposal;
        if(plan){refs(plan.sourceIds);if(plan.status!=='proposed'||!Array.isArray(plan.badgeIds)||new Set(plan.badgeIds).size!==plan.badgeIds.length||plan.badgeIds.some(id=>MorothonBadges.get(id).kind!=='service')||(plan.badgeIds.length?!plan.badgeIds.includes(plan.primaryBadgeId)||!plan.sourceIds?.length:plan.primaryBadgeId!==null))throw new Error('Ugyldig merkeforslag.');}
        for(const honor of member.plannedHonors||[]){refs(honor.sourceIds);if(honor.status!=='planned'||!validYear(honor.year)||!honor.sourceIds?.length||honor.date!==undefined||!plan?.badgeIds.includes(honor.badgeId))throw new Error('Planlagt heder krever kilde og år, uten oppdiktet utdelingsdato.');}
        if(member.memorialRecognition){refs(member.memorialRecognition.sourceIds);if(member.memorialRecognition.badgeId!=='service-memorial'||!member.memorialRecognition.sourceIds?.length)throw new Error('Minnestatus krever eget kildebelagt forslag.');}
        if(member.serviceEstimate){const e=member.serviceEstimate;refs(e.sourceIds);if(!Number.isInteger(e.editions)||e.editions<1||!['approximately','at-least'].includes(e.qualifier)||!['editions','years'].includes(e.unit)||!e.sourceIds?.length)throw new Error('Ugyldig arrangøranslag.');}
        if(member.awards!==undefined&&!Array.isArray(member.awards)||member.issuedDiplomas!==undefined&&!Array.isArray(member.issuedDiplomas))throw new Error('Ugyldig tildelingsregister.');
        for(const award of member.awards||[]){refs(award.sourceIds);if(!key(award.id)||MorothonBadges.get(award.badgeId).kind!=='service'||award.confirmed!==true||!/^\d{4}-\d{2}-\d{2}$/.test(award.date||'')||!award.sourceIds?.length)throw new Error('Tildeling krever en egen kildebelagt beslutning.');}
        for(const diploma of member.issuedDiplomas||[]){refs(diploma.sourceIds);if(!(member.awards||[]).some(a=>a.id===diploma.awardId)||!diploma.sourceIds?.length||!/^\d{4}-\d{2}-\d{2}$/.test(diploma.date||''))throw new Error('Utstedt diplom krever en registrert tildeling.');}
        if(group.badgeId==='service-grunnlegger'&&member.status!=='confirmed')throw new Error('Grunnleggerstatus må være bekreftet.');ids.add(member.id);
      }
    }
    for(const group of data.groups){if(group.memberRefs&&(!Array.isArray(group.memberRefs)||new Set(group.memberRefs).size!==group.memberRefs.length||group.memberRefs.some(id=>!findIn(data,id)||group.members.some(m=>m.id===id))))throw new Error('Ugyldig referanse til hedersperson.');}
    for(const member of data.groups.flatMap(g=>g.members))for(const alias of member.aliasIds||[]){if(ids.has(alias))throw new Error('Ugyldig eller duplisert profilalias.');ids.add(alias);}
    for(const retired of data.retiredProfiles||[]){if(!key(retired.id)||ids.has(retired.id)||typeof retired.name!=='string'||typeof retired.message!=='string')throw new Error('Ugyldig tidligere profil.');ids.add(retired.id);refs(retired.sourceIds);}
    if(data.displayOrder&&(!Array.isArray(data.displayOrder)||data.displayOrder.some(id=>!groups.has(id))))throw new Error('Ugyldig visningsrekkefølge.');
    if(data.featuredIds&&(!Array.isArray(data.featuredIds)||new Set(data.featuredIds).size!==data.featuredIds.length||data.featuredIds.some(id=>{const m=findIn(data,id)?.member;return !m||!m.contribution?.allEditions||contribution(m).count!==35;})))throw new Error('Fremheving av 35 utgaver krever dokumenterte dugnadsår.');
    if(data.founderSpotlightIds&&(!Array.isArray(data.founderSpotlightIds)||new Set(data.founderSpotlightIds).size!==data.founderSpotlightIds.length||data.founderSpotlightIds.some(id=>data.featuredIds?.includes(id)||!data.groups.find(g=>g.id==='founders')?.members.some(m=>m.id===id&&m.status==='confirmed'))))throw new Error('Egen grunnleggerfremheving krever en bekreftet grunnlegger.');
    for(const item of [...(data.narrative?.timeline||[]),...(data.narrative?.sharedStories||[]),...(data.narrative?.uncertainties||[])])refs(item.sourceIds);
    // Final-use approval is distinct from an award or issued diploma. It is
    // scoped to one named recipient, one diploma and the exact reviewed content.
    if(data.diplomaApprovals!==undefined&&!Array.isArray(data.diplomaApprovals))throw new Error('Ugyldig diplomgodkjenning.');
    const approvals=new Set();
    for(const a of data.diplomaApprovals||[]){
      refs(a.sourceIds);const pair=a.personId+':'+a.badgeId;
      if(!key(a.id)||approvals.has(a.id)||approvals.has(pair)||!findIn(data,a.personId)||
        a.status!=='approved'||a.approvedForFinal!==true||!a.sourceIds?.length||
        !/^\d{4}-\d{2}-\d{2}$/.test(a.approvedOn||'')||!/^[a-f0-9]{64}$/.test(a.contentSha256||'')||
        !isActiveBadge(data,a.badgeId)||(a.badgeId!=='thanks'&&MorothonBadges.get(a.badgeId).kind!=='service'))throw new Error('Endelig diplom krever en særskilt kildebelagt godkjenning av nøyaktig innhold.');
      approvals.add(a.id);approvals.add(pair);
    }
    if(data.presentationPrintSet){
      const set=data.presentationPrintSet,pairs=new Set();refs(set.sourceIds);
      if(!key(set.id)||set.scope!=='presentation-only'||!set.sourceIds?.length||!Array.isArray(set.entries))throw new Error('Ugyldig presentasjonssett.');
      for(const entry of set.entries){
        const m=findIn(data,entry.personId)?.member,pair=entry.personId+':'+entry.badgeId;
        if(!m||pairs.has(pair)||!canPresent(data,m,entry.badgeId)||!['contentSha256','cssSha256','assetSha256','watermarkSha256'].every(k=>/^[a-f0-9]{64}$/.test(entry[k]||'')))throw new Error('Presentasjonsdiplomet mangler grunnlag eller kontrollert innhold.');
        pairs.add(pair);
      }
    }
    const examples=new Set();for(const e of data.diplomaExamples||[]){if(!key(e.id)||examples.has(e.id)||!e.label||!isActiveBadge(data,e.badgeId)||(e.badgeId!=='thanks'&&MorothonBadges.get(e.badgeId).kind!=='service'))throw new Error('Ugyldig diplomutkast.');examples.add(e.id);if(e.personId){const found=findIn(data,e.personId);if(!found||!badgePlan(data,found.member,found.group).badgeIds.includes(e.badgeId))throw new Error('Diplomutkast mangler merkeforslag.');}else if(e.illustrative!==true||!e.name||e.badgeId!=='thanks'&&(!Number.isInteger(e.contributionCount)||e.contributionCount<1))throw new Error('Typeeksempel må være eksplisitt og uten personkobling.');}
    return data;
  }
  async function load(){if(!pending)pending=(async()=>{await MorothonBadges.init();const r=await fetch('data/honors.json',{cache:'no-cache'});if(!r.ok)throw new Error('Navnelisten kunne ikke lastes.');let data=await r.json();if(data.volunteerList!==undefined){if(data.volunteerList!=='data/volunteers.json')throw new Error('Ugyldig dugnadslistefil.');const v=await fetch(data.volunteerList,{cache:'no-cache'});if(!v.ok)throw new Error('Dugnadslisten kunne ikke lastes.');data=mergeVolunteers(data,await v.json());}let editionYears=data.presentationPrintSet?.editionYears||[];try{editionYears=arrangedYears((await MorothonHistoryData.load()).data.results);}catch{}Object.defineProperty(data,'editionYears',{value:editionYears,enumerable:false});return validate(data);})().catch(e=>{pending=null;throw e;});return pending;}
  async function find(id){const data=await load(),record=findIn(data,id);if(!record)throw new Error('Hedersprofilen finnes ikke.');return {...record,stories:(record.member.stories||[]).filter(s=>s.confirmed&&hasSource(data,s)),roles:(record.member.roles||[]).filter(r=>r.confirmed&&hasSource(data,r))};}
  const api={load,find,findIn,membersFor,validate,badgePlan,contribution,tenureMilestones,serviceTenure,honorProfile,isFounder,startYear,sortVolunteers,provisionalMilestone,arrangedYears,mainBadge,diplomaChoices,canPresent,isActiveBadge,mergeVolunteers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.MorothonHonorsData=api;
})();
