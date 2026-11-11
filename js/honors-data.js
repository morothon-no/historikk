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
  function tenureMilestones(data,member){
    const documented=contribution(member),policy=data.awardPolicy?.milestones||[];
    const qualified=policy.filter(m=>documented.count>=m.minimumDocumentedEditions)
      .map(m=>({badgeId:m.badgeId,editions:m.minimumDocumentedEditions}));
    const next=policy.find(m=>documented.count<m.minimumDocumentedEditions);
    return {documentedEditions:documented.count,qualified,highestQualified:qualified.at(-1)||null,
      next:next?{badgeId:next.badgeId,editions:next.minimumDocumentedEditions,remaining:next.minimumDocumentedEditions-documented.count}:null,
      automaticallyAwarded:false};
  }
  const validYear=y=>Number.isInteger(y)&&y>=1900&&y<=9999;
  function validateTenure(c){
    for(const field of ['fromYear','toYear'])if(c[field]!==undefined&&!validYear(c[field]))throw new Error('Ugyldig dugnadsperiode.');
    if(c.fromYear!==undefined&&c.toYear!==undefined&&c.toYear<c.fromYear)throw new Error('Ugyldig dugnadsperiode.');
    for(const field of ['confirmedYears','excludedYears'])if(c[field]!==undefined&&(!Array.isArray(c[field])||new Set(c[field]).size!==c[field].length||c[field].some(y=>!validYear(y))))throw new Error('Ugyldige dugnadsår.');
    if((c.confirmedYears||[]).some(y=>(c.excludedYears||[]).includes(y)||c.fromYear!==undefined&&y<c.fromYear||c.toYear!==undefined&&y>c.toYear))throw new Error('Motstridende dugnadsår.');
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
  // A view-only estimate. Never write inferred years into contribution(), plans,
  // awards or diploma models. Explicit year lists are never padded with estimates.
  function provisionalMilestone(data,member,editionYears){
    const editions=[...new Set(editionYears.filter(validYear))].sort((a,b)=>a-b),asOfYear=editions.at(-1)??null;
    const c=member.contribution||{},documented=contribution(member),fromYear=startYear(member);
    const result={basis:'not-established',count:null,asOfYear,fromYear,toYear:c.toYear??null,excludedYears:[...(c.excludedYears||[])],highest:null,automaticallyAwarded:false};
    if(asOfYear===null)return result;
    if(c.confirmedYears?.length){
      if(!documented.years.length)return result;
      result.basis='documented';result.count=documented.years.filter(y=>y<=asOfYear).length;
    }else if(fromYear!==null){
      result.basis='estimated';result.count=editions.filter(y=>y>=fromYear&&y<=Math.min(c.toYear??asOfYear,asOfYear)&&!(c.excludedYears||[]).includes(y)).length;
    }
    if(result.count!==null){
      const highest=(data.awardPolicy?.milestones||[]).filter(m=>result.count>=m.minimumDocumentedEditions).at(-1);
      if(highest)result.highest={badgeId:highest.badgeId,editions:highest.minimumDocumentedEditions};
    }
    return result;
  }
  function arrangedYears(results){
    return [...new Set(results.filter(r=>/^(fullfort(?: |$)|dnf$|deltatt$)/.test(String(r[4]||'').toLowerCase().replaceAll('ø','o'))).map(r=>r[0]).filter(validYear))].sort((a,b)=>a-b);
  }
  function mainBadge(data,member,editionYears){
    const documented=contribution(member),estimate=provisionalMilestone(data,member,editionYears),plan=badgePlan(data,member,findIn(data,member.id)?.group||{});
    const base={badgeId:null,basis:'not-established',count:null,fromYear:startYear(member),toYear:member.contribution?.toYear??null,toYearStatus:member.contribution?.toYearStatus||null,excludedYears:[...(member.contribution?.excludedYears||[])],status:'preliminary',automaticallyAwarded:false};
    if(member.memorialRecognition?.badgeId==='service-memorial')return {...base,badgeId:'service-memorial',basis:'organizer-estimate',count:member.serviceEstimate?.editions??null,qualifier:member.serviceEstimate?.qualifier||null,unit:member.serviceEstimate?.unit||null,status:'proposed'};
    if(plan.badgeIds.includes('service-aeresmerke'))return {...base,badgeId:'service-aeresmerke',basis:'documented',count:documented.count,fromYear:documented.first,toYear:documented.last,status:'proposed'};
    if(data.groups.find(g=>g.id==='founders')?.members.some(m=>m.id===member.id&&m.status==='confirmed'))return {...base,badgeId:'service-grunnlegger',basis:'historical-role',count:null,status:'proposed'};
    if(!estimate.highest)return base;
    return {...base,badgeId:estimate.highest.badgeId,basis:estimate.basis,count:estimate.count,fromYear:estimate.fromYear,toYear:estimate.toYear,editions:estimate.highest.editions};
  }
  function diplomaChoices(data,member,editionYears){
    const main=mainBadge(data,member,editionYears);
    if(!main.badgeId)return ['thanks'];
    if(main.badgeId==='service-memorial'||main.badgeId==='service-grunnlegger')return [main.badgeId];
    const levels=(data.awardPolicy?.milestones||[]).filter(m=>m.minimumDocumentedEditions<=(main.count||0)).map(m=>m.badgeId);
    return [...new Set([main.badgeId,...levels])].filter(id=>isActiveBadge(data,id));
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
    const tenureFields=['fromYear','toYear','toYearStatus','excludedYears','confirmedYears'];
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
        if(c){refs(c.sourceIds);validateTenure(c);if(c.confirmedYears&&!c.sourceIds?.length)throw new Error('Ugyldige dokumenterte dugnadsår.');if(c.exception){refs(c.exception.sourceIds);if(c.exception.confirmed!==true||!c.exception.sourceIds?.length)throw new Error('Særskilt beslutning mangler kilde.');}}
        const plan=member.badgeProposal;
        if(plan){refs(plan.sourceIds);if(plan.status!=='proposed'||!Array.isArray(plan.badgeIds)||new Set(plan.badgeIds).size!==plan.badgeIds.length||plan.badgeIds.some(id=>MorothonBadges.get(id).kind!=='service')||(plan.badgeIds.length?!plan.badgeIds.includes(plan.primaryBadgeId)||!plan.sourceIds?.length:plan.primaryBadgeId!==null))throw new Error('Ugyldig merkeforslag.');}
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
    for(const item of [...(data.narrative?.timeline||[]),...(data.narrative?.sharedStories||[]),...(data.narrative?.uncertainties||[])])refs(item.sourceIds);
    const examples=new Set();for(const e of data.diplomaExamples||[]){if(!key(e.id)||examples.has(e.id)||!e.label||!isActiveBadge(data,e.badgeId)||(e.badgeId!=='thanks'&&MorothonBadges.get(e.badgeId).kind!=='service'))throw new Error('Ugyldig diplomutkast.');examples.add(e.id);if(e.personId){const found=findIn(data,e.personId);if(!found||!badgePlan(data,found.member,found.group).badgeIds.includes(e.badgeId))throw new Error('Diplomutkast mangler merkeforslag.');}else if(e.illustrative!==true||!e.name||e.badgeId!=='thanks'&&(!Number.isInteger(e.contributionCount)||e.contributionCount<1))throw new Error('Typeeksempel må være eksplisitt og uten personkobling.');}
    return data;
  }
  async function load(){if(!pending)pending=(async()=>{await MorothonBadges.init();const r=await fetch('data/honors.json',{cache:'no-cache'});if(!r.ok)throw new Error('Navnelisten kunne ikke lastes.');let data=await r.json();if(data.volunteerList!==undefined){if(data.volunteerList!=='data/volunteers.json')throw new Error('Ugyldig dugnadslistefil.');const v=await fetch(data.volunteerList,{cache:'no-cache'});if(!v.ok)throw new Error('Dugnadslisten kunne ikke lastes.');data=mergeVolunteers(data,await v.json());}return validate(data);})().catch(e=>{pending=null;throw e;});return pending;}
  async function find(id){const data=await load(),record=findIn(data,id);if(!record)throw new Error('Hedersprofilen finnes ikke.');return {...record,stories:(record.member.stories||[]).filter(s=>s.confirmed&&hasSource(data,s)),roles:(record.member.roles||[]).filter(r=>r.confirmed&&hasSource(data,r))};}
  const api={load,find,findIn,membersFor,validate,badgePlan,contribution,tenureMilestones,startYear,sortVolunteers,provisionalMilestone,arrangedYears,mainBadge,diplomaChoices,isActiveBadge,mergeVolunteers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.MorothonHonorsData=api;
})();
