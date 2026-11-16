// Local Heder admin view projection: explicitly allowlist fields before any HTTP response.
// All input comes from the already-approved PUBLIC snapshot, never private source registers.
// A local session token is required by the caller. No edit or award operation exists here.
'use strict';
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
function publicHonorAdminView(roster){
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
   stories:(p.stories||[]).map(s=>({text:s.text,confirmed:s.confirmed===true})),
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
    qualified:[...(b.qualified||[])],
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
  editionYears:[...(roster.editionYears||[])],people};
}
module.exports={publicHonorAdminView};
