const fs=require('node:fs/promises'),path=require('node:path');
const {mergeVolunteers}=require('../../js/honors-data.js');
async function readHonors(){
 const root=path.resolve(__dirname,'../..'),data=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 const merged=data.volunteerList?mergeVolunteers(data,JSON.parse(await fs.readFile(path.join(root,data.volunteerList),'utf8'))):data;
 Object.defineProperty(merged,'editionYears',{value:require('../../js/honors-data.js').arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results),enumerable:false});
 return merged;
}
// Compare preserved historical facts through the explicitly approved V3.5 migration.
// New active semantics are asserted independently in honors-v35.cjs.
function historicalMember(member){
 const copy=structuredClone(member),{execFileSync}=require('node:child_process');
 const baseline=JSON.parse(execFileSync('git',['show','8e28dd6:data/honors.json'],{cwd:path.resolve(__dirname,'../..')}));
 const old=baseline.groups.flatMap(g=>g.members).find(m=>m.id===copy.id);if(!old)return copy;
 if(copy.previousBadgeProposals?.length){copy.badgeProposal=copy.previousBadgeProposals[0];delete copy.previousBadgeProposals;}
 if(['dag-morten-frantzen','hakon-lohne','finn-lohne','kalle-kimestad','bent-bakke'].includes(copy.id))delete copy.contribution;
 copy.roles=copy.roles.filter(r=>!(r.countsForTenure===false&&r.sourceIds?.includes('organizer-pr18-confirmed-years')));
 if(copy.id==='hakon-lohne'){copy.roles=copy.roles.filter(r=>r.title!=='Løpsleder Morothon').map(r=>r.historicalNotes?structuredClone(old.roles.find(o=>o.title===r.title)):r);copy.internalNotes=old.internalNotes;delete copy.historicalNotes;}
 if(copy.id==='einar-danielsen'){delete copy.plannedHonors;delete copy.serviceEstimate;delete copy.contribution;copy.sourceIds=old.sourceIds;}
 if(copy.memorialRecognition){for(const key of ['reason','sourceIds','diplomaTribute']){if(old[key]===undefined)delete copy[key];else copy[key]=old[key];}delete copy.memorialRecognition;delete copy.serviceEstimate;}
 return copy;
}
async function assertOrdinaryDiplomaCss(root){
 const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
 const original=execFileSync('git',['show','8e28dd6:css/diplomas.css'],{cwd:root}).toString(),current=await fs.readFile(path.join(root,'css/diplomas.css'),'utf8');
 assert.ok(current.startsWith(original),'All existing diploma styles are preserved verbatim');
 const added=current.slice(original.length).replace(/\/\*[\s\S]*?\*\//g,'').trim();
 for(const rule of added.split('}').filter(s=>s.trim()))assert.ok(/^\.diploma-service(?:[ .:#])/.test(rule.trim()),'New styles are scoped only to service drafts');
}
function ordinaryDiplomaCode(s){return s.replace(/  async function serviceContent\([\s\S]*?(?=  function signoffHtml)/,'SERVICE\n')
 .replace(/  \/\/ Volunteer diplomas show the documented milestone YEAR only\.[\s\S]*?(?=  function serviceDocumentHtml)/,'')
 .replace(/  function serviceDocumentHtml\([\s\S]*?(?=  function documentHtml)/,'SERVICE-DOC\n')
 .replace(/    \/\/ Service-only secondary mark collision checks\.[\s\S]*?    \/\/ End service-only secondary mark collision checks\.\n/,'')
 .replace(",'.diploma-service-collection'",'').replace('.map(selector=>doc.querySelector(selector)).filter(Boolean)','.map(selector=>doc.querySelector(selector))')
 .replace('serviceExample, serviceProof, checkServiceDraft, printServiceDraft,','serviceExample,');}
module.exports={readHonors,historicalMember,assertOrdinaryDiplomaCss,ordinaryDiplomaCode};
