// C2.4 private-source tests: all identities, decisions and keys are synthetic.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto');
const {privateFileStore,createReviewService}=require('../scripts/admin/review-workspace.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;

const binding={dataVersion:12,manifestSha256:'a'.repeat(64),historySha256:'b'.repeat(64),snapshotSha256:'c'.repeat(64)};
const reviewer={subject:'test-reviewer',organizers:{morothon:['review']}};
const approver={subject:'test-approver',organizers:{morothon:['review','approve']}};
const foreign={subject:'test-foreign',organizers:{another:['review','approve']}};
async function setup(t){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'c24-synthetic-private-'));
 t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const key=randomBytes(32),store=privateFileStore({directory,key});
 const sessions=new Map([['review-session',reviewer],['approval-session',approver],['foreign-session',foreign]]);
 const sourceBindings={morothon:binding,another:binding};
 const service=createReviewService({
  authenticate:async session=>sessions.get(session)||null,
  getTrustedBinding:async org=>sourceBindings[org],
  store,clock:()=>Date.parse('2026-11-16T13:30:00.000Z')
 });
 return {service,store,key,directory,sourceBindings};
}
function syntheticDecision(base=binding){
 let p=C.empty(base);
 p=C.report(p,{id:'synthetic-identity-01',category:'Mulige duplikater',
  personIds:['MOR-TEST00001','MOR-TEST00002'],description:'Syntetiske profiler holdes adskilt.',
  source:'Syntetisk test, ingen levende personer'});
 return C.transition(p,'synthetic-identity-01','rejected','Arrangøren bekrefter at profilene er ulike.');
}
test('C2.4 rejects missing authentication, encryption key, storage adapter and arbitrary browser principals',async t=>{
 const {service,directory,store}=await setup(t);
 assert.throws(()=>privateFileStore({directory,key:Buffer.alloc(12)}),/256-bit/);
 assert.throws(()=>createReviewService({store}),/Sikker autentisering/);
 await assert.rejects(()=>service.load({session:'forged-token',organizer:'morothon'}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>service.load({session:reviewer,organizer:'morothon'}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>service.load({session:'foreign-session',organizer:'morothon'}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>service.load({session:'review-session',organizer:'../morothon'}),/arrangør-ID/);
 assert.equal((await service.load({session:'review-session',organizer:'morothon'})).status,'empty');
});
test('C2.4 encrypts complete corrections at rest, persists across service restarts and isolates organizer files',async t=>{
 const {service,directory,key}=await setup(t),draft=syntheticDecision();
 const saved=await service.save({session:'review-session',organizer:'morothon',expectedRevision:0,draft});
 assert.equal(saved.revision,1);assert.equal(saved.status,'draft');assert.equal(saved.publicationAuthorized,false);
 const filename=path.join(directory,'morothon.review.aesgcm'),encrypted=await fs.readFile(filename);
 assert.equal(encrypted.includes(Buffer.from('Syntetiske profiler')),false);
 assert.equal(encrypted.includes(Buffer.from('MOR-TEST00001')),false);
 assert.equal((await fs.stat(filename)).mode&0o077,0);
 assert.equal((await fs.stat(directory)).mode&0o077,0);
 const restored=privateFileStore({directory,key});
 assert.deepEqual((await restored.get('morothon')).draft,draft);
 assert.equal(await restored.get('another'),null);
 const read=await service.load({session:'review-session',organizer:'morothon'});
 assert.equal(read.stale,false);assert.equal(read.revision,1);assert.equal(read.events[0].action,'draft-saved');
 assert.equal(read.approval,null);
 await assert.rejects(()=>privateFileStore({directory,key:randomBytes(32)}).get('morothon'),/auth|authenticate|Unsupported state/i);
});
test('C2.4 uses exact revisions, history bindings and encrypted audit events; a new edit invalidates approval',async t=>{
 const {service,sourceBindings}=await setup(t),draft=syntheticDecision();
 await service.save({session:'review-session',organizer:'morothon',expectedRevision:0,draft});
 await assert.rejects(()=>service.save({session:'review-session',organizer:'morothon',expectedRevision:0,draft}),/endret/);
 await assert.rejects(()=>service.approve({session:'review-session',organizer:'morothon',expectedRevision:1,expectedDigest:'a'.repeat(64)}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>service.approve({session:'approval-session',organizer:'morothon',expectedRevision:1,expectedDigest:'b'.repeat(64)}),/annen rettingspakke/);
 const digest=(await service.save({session:'review-session',organizer:'morothon',expectedRevision:1,draft})).digest;
 const approved=await service.approve({session:'approval-session',organizer:'morothon',expectedRevision:2,expectedDigest:digest});
 assert.equal(approved.revision,3);assert.equal(approved.status,'review-approved');
 assert.equal(approved.approval.by,'test-approver');
 assert.equal(approved.publicationAuthorized,false);assert.equal(approved.productionApplied,false);
 const after=await service.load({session:'review-session',organizer:'morothon'});
 assert.deepEqual(after.events.map(e=>e.action),['draft-saved','draft-saved','review-approved']);
 await assert.rejects(()=>service.approve({session:'approval-session',organizer:'morothon',expectedRevision:2,expectedDigest:digest}),/endret/);
 const modified=await service.save({session:'review-session',organizer:'morothon',expectedRevision:3,draft});
 assert.equal(modified.revision,4);assert.equal(modified.status,'draft');
 assert.equal((await service.load({session:'review-session',organizer:'morothon'})).approval,null);
 sourceBindings.morothon={...binding,dataVersion:13};
 assert.equal((await service.load({session:'review-session',organizer:'morothon'})).stale,true);
 await assert.rejects(()=>service.save({session:'review-session',organizer:'morothon',expectedRevision:4,draft}),/foreldet/);
});
test('C2.4 never treats imported proposal statuses as authenticated organizer approval',async t=>{
 const {service}=await setup(t);
 let draft=syntheticDecision();
 draft=C.report(draft,{id:'synthetic-unresolved',category:'Innmeldt feil',personIds:['MOR-TEST00003'],description:'Uavklart syntetisk feil',source:''});
 const saved=await service.save({session:'review-session',organizer:'morothon',expectedRevision:0,draft});
 assert.equal(saved.status,'draft');
 await assert.rejects(()=>service.approve({session:'approval-session',organizer:'morothon',expectedRevision:1,expectedDigest:saved.digest}),/Uavklarte saker/);
 const current=await service.load({session:'review-session',organizer:'morothon'});
 assert.equal(current.status,'draft');assert.equal(current.events.length,1);
 assert.equal('publish' in service,false);
 assert.equal('apply' in service,false);
});
test('C2.4 rejects symlink storage roots, file tampering and overlapping writer locks without losing the previous revision',async t=>{
 const {service,store,directory}=await setup(t);
 const draft=syntheticDecision();
 await service.save({session:'review-session',organizer:'morothon',expectedRevision:0,draft});
 const lock=path.join(directory,'morothon.lock');await fs.writeFile(lock,'locked',{mode:0o600});
 await assert.rejects(()=>service.save({session:'review-session',organizer:'morothon',expectedRevision:1,draft}),/oppdatering pågår/);
 await fs.rm(lock);
 assert.equal((await service.load({session:'review-session',organizer:'morothon'})).revision,1);
 const file=path.join(directory,'morothon.review.aesgcm'),before=await fs.readFile(file);
 await fs.writeFile(file,Buffer.concat([before,Buffer.from('tamper')]));
 await assert.rejects(()=>store.get('morothon'));
 const link=path.join(path.dirname(directory),'c24-synthetic-link-'+randomBytes(3).toString('hex'));
 await fs.symlink(directory,link);t.after(()=>fs.rm(link,{force:true}));
 await assert.rejects(()=>privateFileStore({directory:link,key:randomBytes(32)}).get('morothon'),/Symlink|real directory|directory/);
});
