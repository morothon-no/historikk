// Administrative projection and original-source checks. Never loaded by the public builder.
const {createHash}=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const {shape,validatePublicData,schemas}=require('./public-schema.cjs');
function exportPublicData(input){
 const h=structuredClone(input.honors),v=structuredClone(input.volunteers);
 const all=[...h.groups.flatMap(g=>g.members),...v.people.filter(p=>p.id)];
 if(h.hiddenProfileIds!==undefined&&(!Array.isArray(h.hiddenProfileIds)||new Set(h.hiddenProfileIds).size!==h.hiddenProfileIds.length||h.hiddenProfileIds.some(id=>!all.some(m=>m.id===id))))throw Error('Invalid hidden profile policy; publication stopped');
 const hidden=new Set(h.hiddenProfileIds||[]),hiddenMembers=all.filter(m=>hidden.has(m.id));
 for(const m of hiddenMembers)for(const id of m.aliasIds||[])hidden.add(id);
 const visible=id=>!hidden.has(id);
 for(const group of h.groups){group.members=group.members.filter(m=>visible(m.id));if(group.memberRefs)group.memberRefs=group.memberRefs.filter(visible);}
 v.people=v.people.filter(p=>visible(p.id||p.profileId));
 const visibleIds=new Set([...h.groups.flatMap(g=>g.members.map(m=>m.id)),...v.people.filter(p=>p.id).map(p=>p.id)]);
 for(const field of ['featuredIds','founderSpotlightIds'])if(h[field])h[field]=h[field].filter(id=>visibleIds.has(id));
 h.personDetails=Object.fromEntries(Object.entries(h.personDetails||{}).filter(([id])=>visibleIds.has(id)));
 h.retiredProfiles=(h.retiredProfiles||[]).filter(p=>visible(p.id)).map(p=>({id:p.id,name:p.name,message:'Oppføringen er korrigert.'}));
 h.diplomaExamples=(h.diplomaExamples||[]).filter(e=>!e.personId||visibleIds.has(e.personId));
 h.diplomaApprovals=(h.diplomaApprovals||[]).filter(e=>visibleIds.has(e.personId));
 if(h.presentationPrintSet){
  h.presentationPrintSet.entries=h.presentationPrintSet.entries.filter(e=>visibleIds.has(e.personId));
 }
 // Only confirmed stories are rendered. Neither old decisions nor unused source
 // descriptions become public just because a browser validator needs a source handle.
 const cleanStories=items=>(items||[]).filter(s=>s.confirmed);
 for(const m of h.groups.flatMap(g=>g.members)){m.stories=cleanStories(m.stories);m.roles=(m.roles||[]).filter(r=>r.confirmed);}
 for(const d of Object.values(h.personDetails))d.stories=cleanStories(d.stories);
 h.narrative.sharedStories=cleanStories(h.narrative.sharedStories);
 h.publicDataVersion=1;v.publicDataVersion=1;
 // Opaque handles retain evidence distinctions/confirmed flags without exposing
 // administrative source IDs, source notes, chat references or archived text.
 const known=new Set([...Object.keys(h.sources||{}),...Object.keys(v.sources||{})]);
 const handle=id=>{if(!known.has(id))throw Error('Unknown publication evidence reference');return 'evidence-'+createHash('sha256').update(id).digest('hex').slice(0,20);};
 const used={honors:new Set(),volunteers:new Set()};
 function evidence(obj,set){
  if(Array.isArray(obj))return obj.map(x=>evidence(x,set));
  if(!obj||typeof obj!=='object')return obj;
  for(const [k,value]of Object.entries(obj)){
   if(k==='sourceIds'){obj[k]=value.map(id=>{const publicId=handle(id);set.add(publicId);return publicId;});}
   else if(k==='source'&&typeof value==='string')obj[k]='Publiseringsgrunnlag';
   else obj[k]=evidence(value,set);
  }
  return obj;
 }
 const result={};
 for(const [name,raw]of Object.entries(input)){
  if(!schemas[name])throw Error('Unexpected public JSON input');
  if(name==='history'){validatePublicData(name,raw);result[name]=structuredClone(raw);continue;}
  const projected=shape(name==='honors'?h:name==='volunteers'?v:raw,schemas[name]);
  if(used[name]){
   delete projected.sources;evidence(projected,used[name]);
   // The list's own sources must not collide with the core's sources during merge.
   if(name==='honors')projected.sources={};
  }
  result[name]=projected;
 }
 // Keep the complete set of referenced opaque handles on the core register;
 // list.sources is empty so mergeVolunteers cannot duplicate a source.
 for(const id of new Set([...used.honors,...used.volunteers]))result.honors.sources[id]={title:'Publiseringsgrunnlag'};
 result.volunteers.sources={};
 for(const [name,data]of Object.entries(result))validatePublicData(name,data);
 validateVisibility(result,input);
 return result;
}
function validateVisibility(publicData,original){
 const text=JSON.stringify([publicData.honors,publicData.volunteers]);
 for(const id of original.honors.hiddenProfileIds||[]){
  const m=[...original.honors.groups.flatMap(g=>g.members),...original.volunteers.people].find(m=>m.id===id);
  for(const token of [id,...m?.aliasIds||[],m?.name,...m?.aliases||[]].filter(Boolean))if(text.includes(token))throw Error('Hidden honor profile in public export');
 }
}
function validateExport(publicData,original){
 for(const [name,data]of Object.entries(publicData))validatePublicData(name,data);
 validateVisibility(publicData,original);
 if(!isDeepStrictEqual(publicData,exportPublicData(original)))throw Error('Public package differs from the approved projection');
 return true;
}
module.exports={exportPublicData,validatePublicData,validateExport};
