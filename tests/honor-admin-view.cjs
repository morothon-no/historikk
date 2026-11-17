// Heder phase B: allowlist/private-data boundaries and empty-organizer contract.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHonorAdminRoster}=require('../scripts/admin/honor-roster.cjs');
const {publicHonorAdminView}=require('../scripts/admin/honor-admin-view.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../public-data/data',name),'utf8'));
function present(enabled=true){
 const honors=read('honors'),volunteers=read('volunteers');
 return createHonorAdminRoster({organizerId:'sogne-morothon',enabled,
   honors,volunteers,editionYears:honors.presentationPrintSet.editionYears});
}
test('Heder local projection uses 43 publicly approved people and never leaks private source fields',()=>{
 const input=present(),original=structuredClone(input),view=publicHonorAdminView(input);
 assert.equal(view.people.length,43);
 assert.equal(view.summary.total,43);
 assert.equal(view.summary.memorial,2);
 assert.equal(view.readOnly,true);
 assert.equal(view.canEdit,false);
 assert.equal(view.publicationAuthorized,false);
 assert.deepEqual(input,original);
 const json=JSON.stringify(view);
 for(const forbidden of ['sourceMember','sourceDetails','internalNotes','sourceIds','suppressedLegacyIds','revisionHistory'])
  assert.equal(json.includes('"'+forbidden+'"'),false,'unexpected private field '+forbidden);
 const erling=view.people.find(p=>p.id==='erling-askildsen');
 assert.equal(erling.stories[0].title,'En idé det ble tradisjon av');
 assert.match(erling.honorDiplomaText,/Du fikk ideen/);
 assert.equal(view.people.some(p=>p.id==='erling-danielsen'),false);
 assert.ok(view.people.some(p=>p.id==='floke-bredland'&&p.memorial));
 assert.ok(view.people.some(p=>p.id==='leif-wiig'&&p.memorial));
 const linked=view.people.find(p=>p.id==='jon-fjeld').runnerLink;
 assert.equal(linked.confirmed,true);
 assert.match(linked.runnerId,/^MOR-/);
});
test('a disabled Heder module preserves persons but can be omitted from UI/API',()=>{
 const a=publicHonorAdminView(present(true)),b=publicHonorAdminView(present(false));
 assert.equal(b.enabled,false);assert.deepEqual(b.people,a.people);
 assert.equal(b.canEdit,false);
});
test('a new independent organizer starts with no Heder data, no borrowed awards or defaults',()=>{
 const honors={schemaVersion:1,groups:[],personDetails:{}};
 const empty=createHonorAdminRoster({organizerId:'svalandsgubben',enabled:false,honors,editionYears:[]});
 const view=publicHonorAdminView(empty);
 assert.equal(view.organizerId,'svalandsgubben');
 assert.equal(view.enabled,false);
 assert.equal(view.people.length,0);
 assert.equal(view.summary.memorial,0);
 assert.deepEqual(view.editionYears,[]);
 assert.equal(JSON.stringify(view).includes('Morothon'),false);
 assert.equal(JSON.stringify(view).includes('erling-askildsen'),false);
 assert.deepEqual(honors,{schemaVersion:1,groups:[],personDetails:{}});
});
test('projection is allowlisted even if input contains suspicious extra internal fields',()=>{
 const r=present(),p=r.people.find(x=>x.id==='jon-fjeld');
 p.sourceMember.internalNotes=['internal secret'];
 p.sourceDetails.internalNotes=['internal secret'];
 p.secret='internal secret';
 p.roles.push({title:'syntetisk rolle',confirmed:true,sourceIds:['internal secret'],internalNotes:['internal secret']});
 const view=publicHonorAdminView(r),raw=JSON.stringify(view);
 assert.equal(raw.includes('internal secret'),false);
 assert.ok(view.people.find(x=>x.id==='jon-fjeld').roles.some(x=>x.title==='syntetisk rolle'));
});
