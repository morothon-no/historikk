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
    const ids=proposal?.badgeIds||(data.contentVersion?[]:group.badgeId?[group.badgeId]:[]);
    return {badgeIds:ids,primaryBadgeId:proposal?.primaryBadgeId||ids[0]||null,status:'proposed'};
  }
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
    const fields=new Set(['id','name','role','fromYear','text','sourceIds','stories','nameStatus','internalNotes']);
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
      if(seen.has(entry.id)||findIn(combined,entry.id)||combined.retiredProfiles?.some(m=>m.id===entry.id))throw new Error('Duplisert person: bruk profileId for en eksisterende hedersprofil.');seen.add(entry.id);
      const sources=entry.sourceIds??list.sourceIds;
      if(!Array.isArray(sources)||!sources.length||sources.some(id=>!key(id)||!Object.hasOwn(combined.sources||{},id)))throw new Error('Dugnadspersonen mangler gyldig kilde.');
      const member={id:entry.id,name:entry.name,status:'confirmed',listingOnly:true,reason:null,sourceIds:[...sources],roles:entry.role?[{title:entry.role,confirmed:true,sourceIds:[...sources]}]:[],stories:[],badgeProposal:{status:'proposed',primaryBadgeId:null,badgeIds:[],sourceIds:[...sources]},awards:[],issuedDiplomas:[]};
      // Legacy text/stories are accepted for file compatibility, never promoted to a full honor profile.
      if(entry.fromYear!==undefined){if(member.roles[0])member.roles[0].fromYear=entry.fromYear;member.contribution={fromYear:entry.fromYear,sourceIds:[...sources]};}
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
        if(c){refs(c.sourceIds);if(c.confirmedYears&&(!Array.isArray(c.confirmedYears)||new Set(c.confirmedYears).size!==c.confirmedYears.length||c.confirmedYears.some(y=>!Number.isInteger(y)||y<1900||y>9999)||!c.sourceIds?.length))throw new Error('Ugyldige dokumenterte dugnadsår.');if(c.fromYear!==undefined&&!Number.isInteger(c.fromYear))throw new Error('Ugyldig dugnadsstart.');if(c.exception){refs(c.exception.sourceIds);if(c.exception.confirmed!==true||!c.exception.sourceIds?.length)throw new Error('Særskilt beslutning mangler kilde.');}}
        const plan=member.badgeProposal;
        if(plan){refs(plan.sourceIds);if(plan.status!=='proposed'||!Array.isArray(plan.badgeIds)||new Set(plan.badgeIds).size!==plan.badgeIds.length||plan.badgeIds.some(id=>MorothonBadges.get(id).kind!=='service')||(plan.badgeIds.length?!plan.badgeIds.includes(plan.primaryBadgeId)||!plan.sourceIds?.length:plan.primaryBadgeId!==null))throw new Error('Ugyldig merkeforslag.');}
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
    const examples=new Set();for(const e of data.diplomaExamples||[]){if(!key(e.id)||examples.has(e.id)||!e.label||MorothonBadges.get(e.badgeId).kind!=='service')throw new Error('Ugyldig diplomutkast.');examples.add(e.id);if(e.personId){const found=findIn(data,e.personId);if(!found||!badgePlan(data,found.member,found.group).badgeIds.includes(e.badgeId))throw new Error('Diplomutkast mangler merkeforslag.');}else if(e.illustrative!==true||!e.name||!Number.isInteger(e.contributionCount)||e.contributionCount<1)throw new Error('Typeeksempel må være eksplisitt og uten personkobling.');}
    return data;
  }
  async function load(){if(!pending)pending=(async()=>{await MorothonBadges.init();const r=await fetch('data/honors.json',{cache:'no-cache'});if(!r.ok)throw new Error('Navnelisten kunne ikke lastes.');let data=await r.json();if(data.volunteerList!==undefined){if(data.volunteerList!=='data/volunteers.json')throw new Error('Ugyldig dugnadslistefil.');const v=await fetch(data.volunteerList,{cache:'no-cache'});if(!v.ok)throw new Error('Dugnadslisten kunne ikke lastes.');data=mergeVolunteers(data,await v.json());}return validate(data);})().catch(e=>{pending=null;throw e;});return pending;}
  async function find(id){const data=await load(),record=findIn(data,id);if(!record)throw new Error('Hedersprofilen finnes ikke.');return {...record,stories:(record.member.stories||[]).filter(s=>s.confirmed&&hasSource(data,s)),roles:(record.member.roles||[]).filter(r=>r.confirmed&&hasSource(data,r))};}
  const api={load,find,findIn,membersFor,validate,badgePlan,contribution,tenureMilestones,mergeVolunteers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.MorothonHonorsData=api;
})();
