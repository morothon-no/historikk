const fs=require('node:fs/promises'),path=require('node:path');
const {mergeVolunteers}=require('../../js/honors-data.js');
// Historical snapshot checks undo only the four organizer-approved corrections.
// The archive is independently compared against bcb6f52 in the final V3.6.1 tests.
function beforeFinalCorrections(data){
 const copy=structuredClone(data),revision=copy.revisionHistory?.find(r=>r.supersedesCommit==='bcb6f5245db41b7896ad8837ecae4ad88cdb9703');
 if(!revision)return copy;
 for(const record of revision.members){for(const g of copy.groups)g.members=g.members.filter(m=>m.id!==record.member.id);const group=copy.groups.find(g=>g.id===record.groupId);if(record.member.id==='erling-danielsen')group.members.unshift(structuredClone(record.member));else group.members.push(structuredClone(record.member));}
 for(const entry of revision.volunteers){const m=copy.groups.flatMap(g=>g.members).find(m=>m.id===entry.id);if(m){delete m.contribution;m.roles.forEach(r=>delete r.fromYear);m.sourceIds=entry.sourceIds;if(m.badgeProposal)m.badgeProposal.sourceIds=entry.sourceIds;m.roles.forEach(r=>r.sourceIds=entry.sourceIds);}}
 for(const [id,record]of Object.entries(revision.personDetails))copy.personDetails[id]=structuredClone(record);
 if(revision.narrativeUncertainties)copy.narrative.uncertainties=structuredClone(revision.narrativeUncertainties);
 if(revision.diplomaExamples)for(const e of revision.diplomaExamples){const i=copy.diplomaExamples.findIndex(x=>x.id===e.id);copy.diplomaExamples[i]=structuredClone(e);}
 delete copy.revisionHistory;delete copy.sources['organizer-v361-final-corrections'];return copy;
}
function priorCorrectionMember(member){
 const current=JSON.parse(require('node:fs').readFileSync(path.resolve(__dirname,'../../data/honors.json'),'utf8'));
 const record=current.revisionHistory?.[0]?.members.find(r=>r.member.id===member.id);return record?structuredClone(record.member):structuredClone(member);
}
function expectedPrintMode(data,id){return data.presentationPrintSet?.pendingReviews?.some(r=>r.personId===id)?'draft':'presentation';}
async function preservedFile(root,file){
 const bytes=await fs.readFile(path.join(root,file));
 if(file==='data/volunteers.json'){
  const data=JSON.parse(bytes),core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
  for(const old of core.revisionHistory?.[0]?.volunteers||[]){const index=data.people.findIndex(p=>p.id===old.id);data.people[index]=old;}
  return Buffer.from(JSON.stringify(data,null,2)+'\n');
 }
 if(file==='heder.html'){
  const line=' <details id="honorSources" class="honor-sources"><summary>Bakgrunn og kilder</summary><div id="honorSourceContent"></div></details>\n';
  return Buffer.from(bytes.toString().replace(' <p id="honorStatus"',line+' <p id="honorStatus"'));
 }
 return bytes;
}
async function readHonors(){
 const root=path.resolve(__dirname,'../..'),data=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 const merged=data.volunteerList?mergeVolunteers(data,JSON.parse(await fs.readFile(path.join(root,data.volunteerList),'utf8'))):data;
 Object.defineProperty(merged,'editionYears',{value:require('../../js/honors-data.js').arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results),enumerable:false});
 return merged;
}
// Compare preserved historical facts through the explicitly approved V3.5 migration.
// New active semantics are asserted independently in honors-v35.cjs.
function historicalMember(member){
 const copy=priorCorrectionMember(member),{execFileSync}=require('node:child_process');
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
 // V3.5.3 replaces only the two service footer rules at the end of this baseline.
 // Everything before that footer remains byte-identical, including runner styles.
 const preserved=original.slice(0,original.indexOf('/* Service diplomas have a milestone year,'));
 assert.ok(preserved.length>10000&&current.startsWith(preserved),'All ordinary diploma styles are preserved verbatim');
 const added=current.slice(preserved.length).replace(/\/\*[\s\S]*?\*\//g,'').trim();
 for(const rule of added.split('}').filter(s=>s.trim()))assert.ok(/^\.diploma-service(?:[ .:#]|-signoff[ .:#])/.test(rule.trim()),'New styles are scoped only to service diplomas');
}
function ordinaryDiplomaCode(s){return s.replace(/  async function serviceContent\([\s\S]*?(?=  function signoffHtml)/,'SERVICE\n')
 .replace(/  \/\/ Volunteer (?:diplomas show the documented milestone YEAR only\.|dates refer to the achieved milestone,)[\s\S]*?(?=  function serviceDocumentHtml)/,'')
 .replace(/  function serviceDocumentHtml\([\s\S]*?(?=  function documentHtml)/,'SERVICE-DOC\n')
 .replace(/    \/\/ Service-only secondary mark collision checks\.[\s\S]*?    \/\/ End service-only secondary mark collision checks\.\n/,'')
 .replace(",'.diploma-service-collection'",'').replace('.map(selector=>doc.querySelector(selector)).filter(Boolean)','.map(selector=>doc.querySelector(selector))')
 .replace('serviceExample, serviceProof, checkServiceDraft, printServiceDraft,','serviceExample,');}
module.exports={readHonors,historicalMember,assertOrdinaryDiplomaCss,ordinaryDiplomaCode,beforeFinalCorrections,priorCorrectionMember,expectedPrintMode,preservedFile};
