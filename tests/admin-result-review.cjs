'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{randomBytes}=require('node:crypto');
const C=require('../tools/diploma-admin/intake-model.js').Corrections,H=require('../js/history-data.js');
const sample=require('./public/quick/fixtures/corrections-data.js');
const {privateFileStore}=require('../scripts/admin/review-workspace.cjs'),{createResultReview}=require('../scripts/admin/result-review.cjs');
async function project(history){const m=H.create(history);return {people:Object.fromEntries([...m.people].map(([id,p])=>[id,{name:p.n,count:m.stats(id)?.count||0,years:m.stats(id)?.years||[]} ])),annual:{},records:[],placements:history.results.map((r,index)=>({index,personId:m.resolve(r[1]),year:r[0],event:r[2],distance:r[3],className:r[7]||'',bib:r[9]||'',rank:m.classPlaces.get(r)??null,sourcePlace:H.sourcePlace(r),time:r[5]})),rankings:{},diplomas:{},loyalty:{},redirects:history.redirects||{},aliases:history.aliases||{}};}
async function setup(t){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'admin-review-synthetic-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const history=sample.history(),base=await C.binding(history,sample.meta),key=randomBytes(32),store=privateFileStore({directory,key});
 const principals={owner:{subject:'11111111-1111-4111-8111-111111111111',organizers:{'sogne-morothon':['review','approve']},roles:{'sogne-morothon':'owner'}},editor:{subject:'22222222-2222-4222-8222-222222222222',organizers:{'sogne-morothon':['review']},roles:{'sogne-morothon':'editor'}},foreign:{subject:'33333333-3333-4333-8333-333333333333',organizers:{other:['review','approve']},roles:{other:'owner'}}};
 const context={history,base,project},options={authenticate:async session=>principals[session],loadContext:async()=>context,store},service=createResultReview(options);
 const input={session:'owner',organizer:'sogne-morothon'};
 async function draft(status='Fullført'){
  const index=history.results.findIndex(r=>r[0]===2022),before=history.results[index],after=[...before];after[4]=status;after[5]=status==='Fullført'?'49:58':status;after[6]=status==='Fullført'?1:status;
  let p=C.report(C.empty(base),{id:'synthetic-result-1',category:'Innmeldt feil',personIds:[before[1]],description:'Kontrollert syntetisk resultatretting',source:'Syntetisk arrangørkilde'});
  p=await C.propose(history,p,'synthetic-result-1',{kind:'result',personIds:[before[1]],selector:await C.resultSelector(history,index,base),after,source:'Syntetisk arrangørkilde',reason:'Kontrollert mot original testkilde.'});return p;
 }
 return {service,options,context,draft,input,store,directory,history};
}
test('authenticated result workflow previews, persists encrypted drafts, reopens after service restart and approves without publishing',async t=>{
 const f=await setup(t),original=JSON.stringify(f.history),draft=await f.draft();
 const preview=await f.service.preview({...f.input,draft});assert.equal(preview.review.ready,true);assert.equal(preview.review.changes[0].after[5],'49:58');
 const saved=await f.service.save({...f.input,expectedRevision:0,draft});assert.equal(saved.status,'draft');
 const stored=await fs.readFile(path.join(f.directory,'sogne-morothon.review.aesgcm'),'utf8');assert.equal(stored.includes('49:58'),false);assert.equal(stored.includes('Syntetisk'),false);
 const reopened=await createResultReview(f.options).load(f.input);assert.equal(reopened.status,'draft');assert.equal(reopened.draft.cases[0].change.after[5],'49:58');
 const approved=await f.service.approve({...f.input,expectedRevision:reopened.revision,expectedDigest:reopened.digest});assert.equal(approved.status,'review-approved');assert.equal(approved.productionApplied,false);assert.equal(approved.publicationAuthorized,false);
 const loaded=await f.service.load(f.input);assert.deepEqual(loaded.events.map(e=>e.action),['draft-saved','review-approved']);assert.equal(loaded.approval.by,'11111111-1111-4111-8111-111111111111');
 assert.equal(JSON.stringify(f.history),original);assert.equal('publish' in f.service,false);
 const changed=await f.service.save({...f.input,expectedRevision:loaded.revision,draft:await f.draft('DNF')});assert.equal(changed.status,'draft');assert.equal((await f.service.load(f.input)).approval,null);
});
test('result review rejects unauthorized access, stale versions, modified selectors, overlapping writes and forged approval flags',async t=>{
 const f=await setup(t),draft=await f.draft();
 for(const session of ['invalid','foreign'])await assert.rejects(()=>f.service.save({...f.input,session,expectedRevision:0,draft}),/Ingen tilgang/);
 const altered=structuredClone(draft);altered.cases[0].change.selector.rowSha256='e'.repeat(64);await assert.rejects(()=>f.service.save({...f.input,expectedRevision:0,draft:altered}),/kildehash/);
 const saved=await f.service.save({...f.input,expectedRevision:0,draft});
 await assert.rejects(()=>f.service.save({...f.input,expectedRevision:0,draft}),/endret/);
 await assert.rejects(()=>f.service.approve({...f.input,session:'editor',expectedRevision:1,expectedDigest:saved.digest}),/Ingen tilgang/);
 await assert.rejects(()=>f.service.approve({...f.input,expectedRevision:1,expectedDigest:'a'.repeat(64)}),/endret/);
 f.context.base={...f.context.base,dataVersion:3};assert.equal((await f.service.load(f.input)).stale,true);
 await assert.rejects(()=>f.service.save({...f.input,expectedRevision:1,draft}),/foreldet/);
});
test('result review keeps DNS and DNF participation rules, blocks unrelated identity changes, and never trusts browser handoff',async t=>{
 for(const status of ['DNS','DNF']){
  const f=await setup(t),draft=await f.draft(status),preview=await f.service.preview({...f.input,draft});
  const changed=await C.applyCandidate(f.history,preview.draft,preview.draft.base,{preview:true}),model=H.create(changed.history);
  assert.equal(model.stats('MOR-C220001').count,status==='DNS'?2:3);assert.equal(H.timeSeconds(status),null);
 }
 const f=await setup(t),draft=await f.draft();draft.cases[0].change.kind='person';await assert.rejects(()=>f.service.save({...f.input,expectedRevision:0,draft}));
 const valid=await f.draft();valid.cases[0].status='handoff';valid.cases[0].change.after[5]='99:99';await assert.rejects(()=>f.service.save({...f.input,expectedRevision:0,draft:valid}));assert.equal((await f.service.load(f.input)).status,'empty');
});
test('server rechecks existing Heder link blockers and saves unresolved result work only as draft',async t=>{
 const f=await setup(t);f.context.linkedRunnerIds=['MOR-C220001'];
 const draft=await f.draft('DNS'),saved=await f.service.save({...f.input,expectedRevision:0,draft});assert.equal(saved.review.ready,false);assert.equal(saved.status,'draft');assert.match(saved.review.uncertain.join(' '),/Heder/);
 const loaded=await f.service.load(f.input);await assert.rejects(()=>f.service.approve({...f.input,expectedRevision:loaded.revision,expectedDigest:loaded.digest}),/avklaring/);assert.equal((await f.service.load(f.input)).approval,null);
});
test('source version changes during calculation stop writes without losing previous stored data',async t=>{
 const f=await setup(t),draft=await f.draft(),project=f.context.project;let changed=false;
 f.context.project=async h=>{const value=await project(h);if(!changed){changed=true;f.context.base={...f.context.base,dataVersion:3};}return value;};
 await assert.rejects(()=>f.service.save({...f.input,expectedRevision:0,draft}),/oppdatert under kontrollen/);assert.equal(await f.store.get(f.input.organizer),null);
});
