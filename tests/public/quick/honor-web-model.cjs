// Portable #79 Heder model: synthetic data only, runnable in the isolated public checkout.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../../../tools/diploma-admin/portal-data.cjs').Honors;
const F=require('./fixtures/corrections-data.js');
function fixture(){return {
 organizerId:'synthetic-organizer',enabled:true,history:F.history(),
 editions:[{editionId:'spring',year:2022,label:'Vår',status:'held'},{editionId:'autumn',year:2022,label:'Høst',status:'held'},{editionId:'next',year:2023,status:'held'},{editionId:'cancelled',year:2024,status:'cancelled'}],
 badges:[{id:'synthetic-three',name:'Tre utgaver',src:'assets/medals/service/synthetic.svg'}],
 honors:{schemaVersion:1,sources:{basis:{title:'Syntetisk kilde'}},personDetails:{},awardPolicy:{milestones:[{badgeId:'synthetic-three',minimumDocumentedEditions:3}]},groups:[{id:'volunteers',title:'Dugnad',members:[{id:'synthetic-person',name:'Syntetisk Person',roles:[{title:'Syntetisk styreverv',countsForTenure:false}],contribution:{confirmedEditionIds:['spring','autumn'],sourceIds:['basis']},awards:[],issuedDiplomas:[]}]}]}
};}
const bind=e=>({draftId:e.draftId,revision:e.revision,baseVersion:e.baseVersion});
test('portable Heder core shares ID-based counting, non-counting roles, read-only badges and original-data immutability',async()=>{
 const f=fixture(),before=structuredClone(f),w=await M.createHonorDrafts(f),e=w.open({personId:'synthetic-person'});
 let p=await w.preview({...bind(e),fields:e.fields});assert.equal(p.profile.tenure.registeredEditions,2);assert.deepEqual(p.profile.tenure.years,[2022]);assert.equal(p.profile.roles[0].countsForTenure,false);
 e.fields.tenure.selectedEditionIds.push('next');p=await w.preview({...bind(e),fields:e.fields});assert.equal(p.profile.tenure.registeredEditions,3);assert.equal(p.mainBadge.id,'synthetic-three');assert.equal(p.publicationAuthorized,false);assert.deepEqual(p.profile.badges.awarded,[]);assert.deepEqual(f,before);
 e.fields.tenure.selectedEditionIds.push('cancelled');await assert.rejects(()=>w.preview({...bind(e),fields:e.fields}),/gjennomførte/);
});
test('portable asynchronous SHA-256 previews reject an older concurrent request and cannot retain a forged review',async()=>{
 const w=await M.createHonorDrafts(fixture()),e=w.open({personId:'synthetic-person'});
 const first=w.preview({...bind(e),fields:e.fields}),newFields=structuredClone(e.fields);newFields.name='Syntetisk Endret';const second=w.preview({...bind(e),fields:newFields});
 const [a,b]=await Promise.allSettled([first,second]);assert.equal(a.status,'rejected');assert.match(a.reason.message,/foreldet/);assert.equal(b.status,'fulfilled');assert.match(b.value.selectionDigest,/^[a-f0-9]{64}$/);
 assert.throws(()=>w.keep({...bind(e),previewId:'forged'}),/foreldet/);assert.equal(b.value.profile.name,newFields.name);
});
test('portable public view removes private original references while preserving titles, roles and memorial facts',()=>{
 const f=fixture(),member=f.honors.groups[0].members[0];member.deceased=true;member.deathYear=2023;member.internalNotes=['SYNTHETIC-PRIVATE'];member.stories=[{title:'Syntetisk tittel',text:'Syntetisk historie',confirmed:true,sourceIds:['basis']}];
 const roster=M.createHonorAdminRoster({...f,editionYears:[2022,2023],editionCatalog:f.editions}),view=M.publicHonorAdminView(roster,f.badges);
 assert.equal(view.summary.memorial,1);assert.equal(view.people[0].stories[0].title,'Syntetisk tittel');assert.equal(view.people[0].memorialInfo.deathYear,2023);
 for(const key of ['SYNTHETIC-PRIVATE','sourceMember','sourceDetails','sourceIds','internalNotes'])assert.equal(JSON.stringify(view).includes(key),false);
});
test('portable Heder identity selection requires separate explicit confirmation, aliases never establish a permanent link',async()=>{
 const f=fixture(),w=await M.createHonorDrafts(f),e=w.open({personId:'synthetic-person'});
 await assert.rejects(()=>w.preview({...bind(e),fields:e.fields,identityReview:{action:'link',runnerId:'MOR-OLD2201',confirmed:false}}),/separat/);
 const p=await w.preview({...bind(e),fields:e.fields,identityReview:{action:'link',runnerId:'MOR-OLD2201',confirmed:true}});
 assert.equal(p.runnerLinkProposal.runnerId,'MOR-C220001');assert.equal(p.profile.runnerLink,null);assert.equal(p.profile.tenure.registeredEditions,2);assert.equal(p.persisted,false);
});
test('portable disabled module rejects all draft operations and an empty organizer inherits no persons, badges or identities',async()=>{
 const f=fixture();f.enabled=false;const w=await M.createHonorDrafts(f);for(const method of ['open','preview','pending','keep','discard'])await assert.rejects(async()=>w[method]({}),/ikke aktiv/);
 const empty=await M.createHonorDrafts({organizerId:'synthetic-empty',enabled:true,honors:{schemaVersion:1,groups:[],personDetails:{}},editions:[],badges:[]});
 const e=empty.open();e.fields.name='Syntetisk Ny';const p=await empty.preview({...bind(e),fields:e.fields});assert.equal(p.mainBadge,null);assert.deepEqual(p.badges,[]);assert.equal(p.profile.runnerLink,null);assert.equal(p.profile.tenure.registeredEditions,null);
});
