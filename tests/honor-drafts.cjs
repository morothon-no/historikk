'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const H=require('../js/honors-data.js');
const {createHonorDrafts,legacyEditionCatalog}=require('../scripts/admin/honor-drafts.cjs');
const F=require('./public/quick/fixtures/corrections-data.js');
function fixture({enabled=true,member=true,editions}={}){
 const years=editions||[
  {editionId:'synthetic-spring',year:2022,label:'Vår',status:'held'},
  {editionId:'synthetic-autumn',year:2022,label:'Høst',status:'held'},
  {editionId:'synthetic-2023',year:2023,label:'2023',status:'held'},
  {editionId:'synthetic-cancelled',year:2024,label:'Avlyst',status:'cancelled'},
  {editionId:'synthetic-planned',year:2025,label:'Planlagt',status:'planned'},
  {editionId:'synthetic-2026',year:2026,label:'2026',status:'held'}];
 const honors={schemaVersion:1,editionBasis:'edition-id',sources:{evidence:{title:'Syntetisk kilde'}},personDetails:{},
  awardPolicy:{milestones:[{badgeId:'synthetic-three',minimumDocumentedEditions:3},{badgeId:'synthetic-six',minimumDocumentedEditions:6}],retiredBadgeIds:[]},
  groups:[{id:'volunteers',title:'Dugnad',badgeId:null,members:member?[{id:'synthetic-person',name:'Syntetisk Frivillig',status:'confirmed',sourceIds:['evidence'],
   roles:[{title:'Syntetisk styreverv',fromYear:1900,countsForTenure:false,sourceIds:['evidence']}],
   contribution:{fromEditionId:'synthetic-spring',sourceIds:['evidence']},stories:[{title:'Opprinnelig tittel',text:'Opprinnelig tekst',confirmed:true,sourceIds:['evidence']}],
   awards:[],issuedDiplomas:[],badgeProposal:{badgeIds:[],status:'proposed'}}]:[]}]};
 return {organizerId:'synthetic-organizer',enabled,honors,editions:years,history:F.history()};
}
function request(e,extra={}){return {draftId:e.draftId,revision:e.revision,baseVersion:e.baseVersion,...extra};}
function preview(w,e){return w.preview(request(e,{fields:e.fields}));}
test('43 current people retain stories, roles, personal diplomas, evidence and special honors in no-op previews',()=>{
 const read=n=>JSON.parse(fs.readFileSync('public-data/data/'+n+'.json'));
 const honors=read('honors'),volunteers=read('volunteers'),history=read('history'),before=structuredClone({honors,volunteers,history});
 const w=createHonorDrafts({organizerId:'sogne-morothon',enabled:true,honors,volunteers,history,editions:legacyEditionCatalog(history,'sogne-morothon'),badges:read('badges').badges});
 const merged=H.mergeVolunteers(honors,volunteers),members=merged.groups.flatMap(g=>g.members).filter(p=>H.isVisibleOnHonorPage(merged,p.id));
 assert.equal(members.length,43);
 for(const p of members){const e=w.open({personId:p.id}),r=preview(w,e),old=H.serviceTenure(merged,p,honors.presentationPrintSet.editionYears);
  assert.equal(r.profile.id,p.id);assert.equal(r.profile.tenure.registeredEditions,old.count,p.id);assert.deepEqual(r.profile.tenure.years,old.years,p.id);
  assert.equal(r.diff.length,0,p.id);assert.equal(r.profile.badges.automaticallyAwarded,false);assert.equal(r.persisted,false);assert.equal(r.publicationAuthorized,false);
  assert.equal(r.profile.honorDiplomaText,H.personRecord(merged,p).honorDiplomaText??null);
  for(const key of ['roles','stories','memorialInfo','runnerLink','badges'])assert.deepEqual(r.profile[key],e.existing[key],p.id+' '+key);
  assert.deepEqual(r.profile.tenure.confirmedYears,e.existing.tenure.confirmedYears);
  assert.deepEqual(r.profile.tenure.excludedYears,e.existing.tenure.excludedYears);
 }
 assert.throws(()=>w.open({personId:'erling-danielsen'}),/aktivt Heder-register/);
 assert.deepEqual({honors,volunteers,history},before);assert.deepEqual(w.pending().items,[]);
});
test('native edition IDs count two held editions in one calendar year; cancelled/planned editions cannot be selected',()=>{
 const input=fixture({member:false}),w=createHonorDrafts(input),e=w.open();e.fields.name='Syntetisk Ny';e.fields.tenure.mode='documented';
 e.fields.tenure.selectedEditionIds=['synthetic-spring','synthetic-autumn'];let p=preview(w,e);
 assert.equal(p.profile.tenure.registeredEditions,2);assert.deepEqual(p.profile.tenure.years,[2022]);assert.deepEqual(p.badges,[]);
 e.fields.tenure.selectedEditionIds.push('synthetic-2023');p=preview(w,e);assert.equal(p.profile.tenure.registeredEditions,3);assert.deepEqual(p.badges.map(x=>x.id),['synthetic-three']);
 assert.equal(p.profile.badges.highest,'synthetic-three');assert.equal(p.profile.badges.automaticallyAwarded,false);assert.deepEqual(p.profile.badges.awarded,[]);
 for(const id of ['synthetic-cancelled','synthetic-planned','unknown']){e.fields.tenure.selectedEditionIds=[id];assert.throws(()=>preview(w,e),/gjennomførte/);}
 e.fields.tenure.selectedEditionIds=['synthetic-spring','synthetic-spring'];assert.throws(()=>preview(w,e),/unike/);
});
test('active period proposals, holes, individual exclusions and closed periods use the shared engine and require review',()=>{
 const input=fixture(),snapshot=structuredClone(input),w=createHonorDrafts(input),e=w.open({personId:'synthetic-person'});
 assert.deepEqual(e.fields.tenure.selectedEditionIds,['synthetic-spring','synthetic-autumn','synthetic-2023','synthetic-2026']);
 let p=preview(w,e);assert.equal(p.profile.tenure.registeredEditions,4);assert.equal(p.profile.tenure.basis,'registered-period');assert.deepEqual(p.profile.tenure.confirmedYears,[]);
 assert.equal(p.needsEditionReview,true);assert.throws(()=>w.keep(request(e,{previewId:p.previewId,editionsReviewed:false})),/Gjennomgå/);
 e.fields.tenure.selectedEditionIds=['synthetic-spring','synthetic-autumn','synthetic-2026'];e.fields.tenure.excludedEditionIds=['synthetic-2023'];p=preview(w,e);assert.equal(p.profile.tenure.registeredEditions,3);
 const kept=w.keep(request(e,{previewId:p.previewId,editionsReviewed:true}));assert.equal(kept.storage,'session-memory');assert.equal(kept.persisted,false);
 const reopened=w.open({draftId:e.draftId});assert.equal(reopened.revision,1);assert.deepEqual(reopened.fields.tenure,e.fields.tenure);
 reopened.fields.tenure.stillActive=false;reopened.fields.tenure.toEditionId='synthetic-autumn';reopened.fields.tenure.selectedEditionIds=['synthetic-spring','synthetic-autumn'];p=preview(w,reopened);assert.equal(p.profile.tenure.registeredEditions,2);
 assert.deepEqual(input,snapshot);
});
test('unknown evidence and non-counting roles do not create volunteer editions',()=>{
 const w=createHonorDrafts(fixture()),e=w.open({personId:'synthetic-person'});e.fields.tenure.mode='unknown';e.fields.tenure.stillActive=false;
 let p=preview(w,e);assert.equal(p.profile.tenure.registeredEditions,null);assert.equal(p.profile.tenure.openPeriod,false);
 e.fields.roles.push({key:null,title:'Syntetisk ekstra styreverv',fromYear:1900,toYear:2026,countsForTenure:false});p=preview(w,e);
 assert.equal(p.profile.tenure.registeredEditions,null);assert.deepEqual(p.badges,[]);
});
test('approved total never fabricates editions, milestone dates or a continuous service history, even without a catalogue',()=>{
 const f=fixture();f.honors.groups[0].members[0].contribution={fromYear:1992,approvedTotal:{approved:true,editions:33,asOfYear:2026,sourceIds:['evidence']}};
 for(const editions of [f.editions,[]]){const w=createHonorDrafts({...f,editions}),e=w.open({personId:'synthetic-person'}),p=preview(w,e);
  assert.equal(e.fields.tenure.mode,'approved-total');assert.deepEqual(e.fields.tenure.selectedEditionIds,[]);assert.equal(p.profile.tenure.registeredEditions,33);assert.deepEqual(p.selectedEditionIds,[]);
 }
 const w=createHonorDrafts(fixture({member:false})),e=w.open();e.fields.name='Syntetisk Ny';e.fields.tenure.mode='approved-total';assert.throws(()=>preview(w,e),/godkjent samlet/);
});
test('memorials with unknown end are never ongoing; existing memorials cannot be converted to active persons',()=>{
 const f=fixture();Object.assign(f.honors.groups[0].members[0],{deceased:true,deathYear:2024,contribution:{fromYear:2022,sourceIds:['evidence']}});
 const w=createHonorDrafts(f),e=w.open({personId:'synthetic-person'});assert.equal(e.fields.tenure.mode,'unknown');assert.equal(preview(w,e).profile.tenure.registeredEditions,null);
 e.fields.tenure.stillActive=true;assert.throws(()=>preview(w,e),/minneprofil/);e.fields.tenure.stillActive=false;e.fields.memorial.enabled=false;assert.throws(()=>preview(w,e),/minneprofiler/);
 const future=createHonorDrafts({...f,editions:[...f.editions,{editionId:'synthetic-2027',label:'2027',year:2027,status:'held'}]});assert.equal(preview(future,future.open({personId:'synthetic-person'})).profile.tenure.registeredEditions,null);
});
test('new held editions extend only reviewed period proposals; documented edition sets remain explicit',()=>{
 const f=fixture(),extra={editionId:'synthetic-2027',year:2027,label:'2027',status:'held'};
 const w=createHonorDrafts({...f,editions:[...f.editions,extra]}),e=w.open({personId:'synthetic-person'});assert.equal(preview(w,e).profile.tenure.registeredEditions,5);assert.equal(preview(w,e).needsEditionReview,true);
 f.honors.groups[0].members[0].contribution={confirmedEditionIds:['synthetic-spring','synthetic-autumn'],sourceIds:['evidence']};
 const d=createHonorDrafts({...f,editions:[...f.editions,extra]});assert.equal(preview(d,d.open({personId:'synthetic-person'})).profile.tenure.registeredEditions,2);
 f.honors.groups[0].members[0].contribution={confirmedYears:[2022],sourceIds:['evidence']};assert.throws(()=>createHonorDrafts(f),/entydig/);
});
test('source/revision/preview binding rejects stale, forged, foreign and bypassed review requests',()=>{
 const w=createHonorDrafts(fixture()),e=w.open({personId:'synthetic-person'}),a=preview(w,e);const b=preview(w,e);
 assert.throws(()=>w.keep(request(e,{previewId:a.previewId,editionsReviewed:true})),/foreldet/);
 assert.throws(()=>w.keep(request(e,{previewId:b.previewId,editionsReviewed:true,awards:[]})),/Ukjente/);
 assert.throws(()=>w.preview(request(e,{fields:e.fields,baseVersion:'0'.repeat(64)})),/arrangementsgrunnlaget/);
 assert.throws(()=>w.keep(request(e,{previewId:b.previewId,editionsReviewed:true,revision:99})),/endret/);
 w.keep(request(e,{previewId:b.previewId,editionsReviewed:true}));assert.throws(()=>w.preview(request(e,{fields:e.fields})),/endret/);
 const other=createHonorDrafts({...fixture(),organizerId:'other-organizer'});assert.throws(()=>other.preview(request(e,{fields:e.fields})),/arrangementsgrunnlaget/);
});
test('identity decisions need explicit review, preserve canonical aliases and cannot create permanent links or double assignments',()=>{
 const w=createHonorDrafts(fixture({member:false})),a=w.open(),b=w.open();a.fields.name='Syntetisk Ny En';b.fields.name='Syntetisk Ny To';
 const decision={action:'link',runnerId:'MOR-OLD2201',confirmed:false};assert.throws(()=>w.preview(request(a,{fields:a.fields,identityReview:decision})),/separat/);
 decision.confirmed=true;const pa=w.preview(request(a,{fields:a.fields,identityReview:decision})),pb=w.preview(request(b,{fields:b.fields,identityReview:decision}));
 assert.equal(pa.runnerLinkProposal.runnerId,'MOR-C220001');assert.equal(pa.profile.runnerLink,null);assert.equal(pa.profile.tenure.registeredEditions,null);
 w.keep(request(a,{previewId:pa.previewId}));assert.throws(()=>w.keep(request(b,{previewId:pb.previewId})),/annet øktutkast/);
 const reopen=w.open({draftId:a.draftId});assert.equal(reopen.identityReview.confirmed,true);const again=w.preview(request(reopen,{fields:reopen.fields,identityReview:reopen.identityReview}));assert.equal(again.publicationAuthorized,false);
});
test('existing confirmed runner link cannot be assigned to a different person and baseline link remains intact',()=>{
 const f=fixture();f.honors.personDetails['synthetic-person']={runnerLink:{runnerId:'MOR-C220001',confirmed:true,sourceIds:['evidence']}};
 const w=createHonorDrafts(f),e=w.open();e.fields.name='Syntetisk Ny';assert.throws(()=>w.preview(request(e,{fields:e.fields,identityReview:{action:'link',runnerId:'MOR-C220001',confirmed:true}})),/annen Heder-person/);
 assert.equal(w.open({personId:'synthetic-person'}).existing.runnerLink.runnerId,'MOR-C220001');
});
test('kept drafts are reversible overlays; reopening/discarding never alters the sources or another workspace',()=>{
 const f=fixture(),snapshot=structuredClone(f),w=createHonorDrafts(f),e=w.open({personId:'synthetic-person'});e.fields.name='Syntetisk Endret';e.fields.stories[0].title='<img src=x onerror=alert(1)>';
 const p=preview(w,e);assert.equal(p.profile.stories[0].title,e.fields.stories[0].title);assert.ok(p.diff.some(d=>d.field==='name'));
 const kept=w.keep(request(e,{previewId:p.previewId,editionsReviewed:true}));assert.equal(w.pending().items.length,1);assert.equal(kept.publicationAuthorized,false);
 const reopened=w.open({draftId:e.draftId});assert.equal(reopened.fields.name,e.fields.name);w.discard(request(reopened));assert.equal(w.pending().items.length,0);assert.equal(w.open({personId:'synthetic-person'}).fields.name,'Syntetisk Frivillig');
 assert.deepEqual(f,snapshot);assert.deepEqual(createHonorDrafts(f).pending().items,[]);
});
test('untrusted private fields, awards and original references cannot enter editable or client records',()=>{
 const f=fixture();f.honors.groups[0].members[0].internalNotes=['SYNTHETIC-PRIVATE'];f.honors.personDetails['synthetic-person']={internalNotes:['SYNTHETIC-PRIVATE']};
 const w=createHonorDrafts(f),e=w.open({personId:'synthetic-person'}),p=preview(w,e);
 for(const forbidden of ['sourceMember','sourceDetails','sourceIds','internalNotes','SYNTHETIC-PRIVATE'])assert.equal(JSON.stringify([e,p,w.pending()]).includes(forbidden),false,forbidden);
 for(const field of ['awards','issuedDiplomas','badgeProposal','sourceMember','runnerLink']){const fields=structuredClone(e.fields);fields[field]=[];assert.throws(()=>w.preview(request(e,{fields})),/Ukjente/);}
 e.fields.name='a'.repeat(161);assert.throws(()=>preview(w,e),/lang tekst/);
});
test('disabled module rejects every draft operation and a blank organizer inherits no people, badges or text',()=>{
 const w=createHonorDrafts(fixture({enabled:false}));for(const method of ['open','pending','preview','keep','discard'])assert.throws(()=>w[method]({}),/ikke aktiv/);
 const fresh=createHonorDrafts({organizerId:'svalandsgubben',enabled:true,honors:{schemaVersion:1,groups:[],personDetails:{}},editions:[],badges:[]});
 assert.equal(fresh.pending().items.length,0);const e=fresh.open();e.fields.name='Syntetisk Ny';const p=preview(fresh,e);assert.deepEqual(p.badges,[]);assert.equal(p.mainBadge,null);assert.equal(p.profile.runnerLink,null);
 assert.equal(JSON.stringify([e,p]).includes('Morothon'),false);assert.equal(p.profile.tenure.registeredEditions,null);
});
test('new names and race conditions cannot duplicate a current or kept Heder draft',()=>{
 const w=createHonorDrafts(fixture()),e=w.open();e.fields.name='Syntetisk Frivillig';assert.throws(()=>preview(w,e),/allerede/);
 e.fields.name='Syntetisk Ny';const a=preview(w,e),other=w.open();other.fields.name='Syntetisk Ny';const b=preview(w,other);w.keep(request(e,{previewId:a.previewId}));assert.throws(()=>w.keep(request(other,{previewId:b.previewId})),/allerede/);
});
test('edited facts remain unconfirmed draft content, while source evidence and hidden identities stay untouched',()=>{
 const f=fixture();f.honors.groups[0].members[0].aliases=['Syntetisk Tidligere Navn'];
 f.honors.groups[0].members.push({id:'synthetic-invalid',name:'Syntetisk Feilført',roles:[],stories:[]});f.honors.hiddenProfileIds=['synthetic-invalid'];
 const snapshot=structuredClone(f),w=createHonorDrafts(f),e=w.open({personId:'synthetic-person'});
 e.fields.roles[0].title='Syntetisk endret rolle';e.fields.stories[0].text='Syntetisk endret tekst';const p=preview(w,e);
 assert.equal(p.profile.roles[0].confirmed,false);assert.equal(p.profile.stories[0].confirmed,false);assert.deepEqual(f,snapshot);
 const n=w.open();n.fields.name='Syntetisk Tidligere Navn';assert.throws(()=>preview(w,n),/allerede/);
 n.fields.name='Syntetisk Feilført';assert.throws(()=>preview(w,n),/historiske oppføringen/);
 assert.throws(()=>w.open({personId:'synthetic-invalid'}),/aktivt/);
});
test('native documented count and milestone years are calculated centrally; memorial selections cannot exceed a known death year',()=>{
 const f=fixture(),m={id:'synthetic-new',contribution:{confirmedEditionIds:['synthetic-spring','synthetic-autumn'],sourceIds:['evidence']}};
 const result=H.tenureMilestones(f.honors,m,f.editions);assert.equal(result.documentedEditions,2);assert.equal(result.next.remaining,1);
 const w=createHonorDrafts(fixture({member:false})),e=w.open();e.fields.name='Syntetisk Minne';e.fields.memorial.enabled=true;e.fields.memorial.deathYear=2023;e.fields.tenure.mode='documented';e.fields.tenure.selectedEditionIds=['synthetic-2026'];
 assert.throws(()=>preview(w,e),/dødsåret/);
 e.fields.tenure.selectedEditionIds=['synthetic-spring','synthetic-autumn'];assert.equal(preview(w,e).profile.tenure.registeredEditions,2);
});
