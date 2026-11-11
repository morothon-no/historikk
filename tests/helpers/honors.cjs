const fs=require('node:fs/promises'),path=require('node:path');
const {mergeVolunteers}=require('../../js/honors-data.js');
async function readHonors(){
 const root=path.resolve(__dirname,'../..'),data=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 return data.volunteerList?mergeVolunteers(data,JSON.parse(await fs.readFile(path.join(root,data.volunteerList),'utf8'))):data;
}
// Compare preserved historical facts through the explicitly approved V3.5 migration.
// New active semantics are asserted independently in honors-v35.cjs.
function historicalMember(member){
 const copy=structuredClone(member),{execFileSync}=require('node:child_process');
 const baseline=JSON.parse(execFileSync('git',['show','8e28dd6:data/honors.json'],{cwd:path.resolve(__dirname,'../..')}));
 const old=baseline.groups.flatMap(g=>g.members).find(m=>m.id===copy.id);if(!old)return copy;
 if(copy.previousBadgeProposals?.length){copy.badgeProposal=copy.previousBadgeProposals[0];delete copy.previousBadgeProposals;}
 if(['dag-morten-frantzen','hakon-lohne','finn-lohne','kalle-kimestad','bent-bakke'].includes(copy.id))delete copy.contribution;
 if(copy.id==='hakon-lohne')copy.roles=copy.roles.filter(r=>r.title!=='Løpsleder Morothon');
 if(copy.memorialRecognition){for(const key of ['reason','sourceIds','diplomaTribute']){if(old[key]===undefined)delete copy[key];else copy[key]=old[key];}delete copy.memorialRecognition;delete copy.serviceEstimate;}
 return copy;
}
async function assertOrdinaryDiplomaCss(root){
 const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
 const original=execFileSync('git',['show','8e28dd6:css/diplomas.css'],{cwd:root}).toString(),current=await fs.readFile(path.join(root,'css/diplomas.css'),'utf8');
 assert.ok(current.startsWith(original),'All existing diploma styles are preserved verbatim');
 const added=current.slice(original.length).replace(/\/\*[\s\S]*?\*\//g,'').trim();
 for(const rule of added.split('}').filter(s=>s.trim()))assert.ok(rule.trim().startsWith('.diploma-service '),'New styles are scoped only to service drafts');
}
module.exports={readHonors,historicalMember,assertOrdinaryDiplomaCss};
