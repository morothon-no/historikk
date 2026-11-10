/* Explicit honor identities, roles and awards. Neither names nor race counts prove an identity or volunteer tenure. */
(function () {
  'use strict';
  let pending;
  const key=v=>typeof v==='string'&&/^[a-z0-9-]+$/.test(v);
  function findIn(data,id){for(const group of data.groups){const member=group.members.find(m=>m.id===id);if(member)return {member,group};}return null;}
  function membersFor(data,group){return [...(group.memberRefs||[]).map(id=>findIn(data,id).member),...group.members];}
  function hasSource(data,value){return typeof value.source==='string'&&!!value.source.trim()||Array.isArray(value.sourceIds)&&value.sourceIds.length>0&&value.sourceIds.every(id=>data.sources?.[id]);}
  function validate(data){
    const ids=new Set(),groups=new Set();if(data.schemaVersion!==1||!Array.isArray(data.groups))throw new Error('Ugyldig navneliste.');
    const refs=ids=>{if(ids!==undefined&&(!Array.isArray(ids)||ids.some(id=>!data.sources?.[id])))throw new Error('Ukjent historiekilde.');};
    for(const [id,source]of Object.entries(data.sources||{})){if(!key(id)||!source.title)throw new Error('Ugyldig kilde.');if(source.url){let url;try{url=new URL(source.url);}catch{throw new Error('Ugyldig kildelenke.');}if(url.protocol!=='https:')throw new Error('Ugyldig kildelenke.');}}
    for(const group of data.groups){
      if(!key(group.id)||groups.has(group.id)||!group.title||!Array.isArray(group.members)||(group.badgeId!=null&&MorothonBadges.get(group.badgeId).kind!=='service'))throw new Error('Ugyldig hederskategori.');groups.add(group.id);refs(group.sourceIds);
      for(const member of group.members){
        if(!key(member.id)||ids.has(member.id)||typeof member.name!=='string'||!member.name.trim()||!['confirmed','provisional'].includes(member.status)||!(member.reason==null||typeof member.reason==='string'))throw new Error('Ugyldig eller duplisert person i navnelisten.');
        if(member.runnerId!==undefined&&(typeof member.runnerId!=='string'||!/^MOR-[A-Z0-9]{7}$/.test(member.runnerId)))throw new Error('Ugyldig eksplisitt løper-ID.');
        if(member.diplomaTribute!==undefined&&(typeof member.diplomaTribute!=='string'||member.diplomaTribute.length>350))throw new Error('Ugyldig diplomtekst.');
        if(member.stories&&(!Array.isArray(member.stories)||member.stories.some(s=>typeof s.text!=='string'||typeof s.source!=='string'||typeof s.confirmed!=='boolean')))throw new Error('Ugyldig historiekilde.');
        if(member.roles&&(!Array.isArray(member.roles)||member.roles.some(r=>typeof r.title!=='string'||typeof r.confirmed!=='boolean'||r.fromYear!==undefined&&!Number.isInteger(r.fromYear))))throw new Error('Ugyldig historisk rolle.');
        for(const item of [...(member.stories||[]),...(member.roles||[])])refs(item.sourceIds);refs(member.sourceIds);
        if(group.badgeId==='service-grunnlegger'&&member.status!=='confirmed')throw new Error('Grunnleggerstatus må være bekreftet.');ids.add(member.id);
      }
    }
    for(const group of data.groups){if(group.memberRefs&&(!Array.isArray(group.memberRefs)||new Set(group.memberRefs).size!==group.memberRefs.length||group.memberRefs.some(id=>!findIn(data,id)||group.members.some(m=>m.id===id))))throw new Error('Ugyldig referanse til hedersperson.');}
    for(const retired of data.retiredProfiles||[]){if(!key(retired.id)||ids.has(retired.id)||typeof retired.name!=='string'||typeof retired.message!=='string')throw new Error('Ugyldig tidligere profil.');ids.add(retired.id);refs(retired.sourceIds);}
    if(data.displayOrder&&(!Array.isArray(data.displayOrder)||data.displayOrder.some(id=>!groups.has(id))))throw new Error('Ugyldig visningsrekkefølge.');
    for(const item of [...(data.narrative?.timeline||[]),...(data.narrative?.sharedStories||[]),...(data.narrative?.uncertainties||[])])refs(item.sourceIds);
    return data;
  }
  async function load(){if(!pending)pending=(async()=>{await MorothonBadges.init();const r=await fetch('data/honors.json',{cache:'no-cache'});if(!r.ok)throw new Error('Navnelisten kunne ikke lastes.');return validate(await r.json());})().catch(e=>{pending=null;throw e;});return pending;}
  async function find(id){const data=await load(),record=findIn(data,id);if(!record)throw new Error('Hedersprofilen finnes ikke.');return {...record,stories:(record.member.stories||[]).filter(s=>s.confirmed&&hasSource(data,s)),roles:(record.member.roles||[]).filter(r=>r.confirmed&&hasSource(data,r))};}
  window.MorothonHonorsData={load,find,findIn,membersFor,validate};
})();
