// Read-only, server-side Heder roster projection. No HTTP route, publication or writes.
// This preserves every legacy source member/detail while providing a normalized admin view.
// Never expose sourceMember, sourceDetails or internalNotes through a public endpoint.
'use strict';
const H=require('../../js/honors-data.js');
const ID=/^[a-z][a-z0-9-]{1,62}$/;
const validYear=y=>Number.isSafeInteger(y)&&y>=1900&&y<=2200;
const copy=x=>structuredClone(x);
function createHonorAdminRoster({organizerId,enabled,honors,volunteers,editionYears,editionCatalog}={}){
 if(typeof organizerId!=='string'||!ID.test(organizerId))
  throw Error('Heder krever en gyldig arrangør-ID.');
 if(typeof enabled!=='boolean')throw Error('Heder krever en eksplisitt modulinnstilling.');
 if(!honors||honors.schemaVersion!==1||!Array.isArray(honors.groups))
  throw Error('Heder trenger et eksisterende, gyldig kilderegister.');
 if(!Array.isArray(editionYears)||editionYears.some(y=>!validYear(y)))
  throw Error('Ugyldige gjennomførte arrangementsår.');
 // Existing Morothon sources use one edition per year. The future edition-ID
 // domain model must take over before counting multiple editions in one year.
 const years=[...new Set(editionYears)].sort((a,b)=>a-b);
 if(editionCatalog!==undefined&&!Array.isArray(editionCatalog))throw Error('Ugyldig utgavekatalog.');
 const calculationEditions=editionCatalog??years;
 if(honors.volunteerList&&(!volunteers||volunteers.schemaVersion!==1))
  throw Error('Heder mangler den tilhørende dugnadslisten.');
 if(!honors.volunteerList&&volunteers!==undefined)
  throw Error('Uventet dugnadsliste uten kildereferanse.');
 const data=honors.volunteerList?H.mergeVolunteers(honors,volunteers):copy(honors);
 const people=[],ids=new Set(),suppressedLegacyIds=[];
 for(const group of data.groups){
  if(!group||typeof group.id!=='string'||!Array.isArray(group.members))
   throw Error('Ugyldig Heder-kategori.');
  for(const member of group.members){
   if(!member||typeof member.id!=='string'||!member.id||ids.has(member.id))
    throw Error('Duplisert eller ugyldig Heder-person.');
   ids.add(member.id);
   // Previously rejected legacy entries remain in the original source for
   // provenance, but must not be resurrected as editable Heder persons.
   if(!H.isVisibleOnHonorPage(data,member.id)){
    suppressedLegacyIds.push(member.id);
    continue;
   }
   const detail=copy(data.personDetails?.[member.id]||{});
   const merged=H.personRecord(data,member);
   const profile=H.honorProfile(data,member,calculationEditions);
   const tenure=profile.tenure;
   const memorial=group.id==='memorial'||member.deceased===true||
    member.memorialRecognition?.badgeId==='service-memorial';
   const contribution=member.contribution||{};
   // A registered open period is not the same as documented individual years.
   const openPeriod=!memorial&&contribution.countingBasis!=='unknown'&&(Number.isInteger(contribution.fromYear)||typeof contribution.fromEditionId==='string')&&
    contribution.toYear===undefined&&contribution.toEditionId===undefined&&contribution.confirmedYears===undefined&&contribution.confirmedEditionIds===undefined&&
    contribution.approvedTotal===undefined;
   const visibleUnderProfile=H.isVisibleOnHonorPage(data,member.id);
   people.push({
    id:member.id,name:merged.name,groupId:group.id,
    listingOnly:member.listingOnly===true,memorial,
    hiddenFromPublic:!visibleUnderProfile,visibleIfEnabled:visibleUnderProfile,
    sourceKind:member.listingOnly===true?'volunteer-list':'honor-group',
    roles:copy(member.roles||[]),
    shortDescription:detail.shortDescription??null,
    stories:copy(detail.stories||member.stories||[]),
    honorDiplomaText:detail.honorDiplomaText??null,
    runnerLink:copy(detail.runnerLink||null),
    memorialInfo:memorial?{
     deathYear:member.deathYear??null,
     recognition:copy(member.memorialRecognition||null),
     tribute:member.diplomaTribute??null
    }:null,
    tenure:{
     basis:tenure.basis,registeredEditions:tenure.count,
     years:copy(tenure.years),fromYear:tenure.fromYear,
     toYear:tenure.toYear,excludedYears:copy(tenure.excludedYears),
     openPeriod,confirmedYears:copy(contribution.confirmedYears||[]),
     approvedTotal:copy(contribution.approvedTotal||null)
    },
    badges:{
     qualified:copy(profile.earnedBadgeIds),
     highest:profile.main.badgeId,
     next:copy(H.tenureMilestones(data,member,calculationEditions).next),
     automaticallyAwarded:false,
     planned:copy(member.plannedHonors||[]),
     formallyAwarded:copy(member.awards||[]),
     issuedDiplomas:copy(member.issuedDiplomas||[])
    },
    // Deliberately server-only; retain all original fields/provenance for a
    // future lossless editor, including uncertain facts and source IDs.
    sourceMember:copy(member),sourceDetails:detail
   });
  }
 }
 const publicEligible=people.length;
 const memorialCount=people.filter(p=>p.memorial).length;
 return {
  schemaVersion:1,organizerId,enabled,readOnly:true,publicationAuthorized:false,
  editionBasis:'legacy-distinct-year',editionYears:years,
  summary:{total:people.length,publicEligible,publicAvailable:enabled?publicEligible:0,
   suppressedLegacy:suppressedLegacyIds.length,memorial:memorialCount},
  // Internal-only provenance list: never use as a public or editable person list.
  suppressedLegacyIds,people
 };
}
module.exports={createHonorAdminRoster};
