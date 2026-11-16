// All PostgreSQL review storage tests use an in-memory simulation of parameterized
// SELECT/INSERT/UPDATE CAS semantics; NO real database, network or user data.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {postgresReviewStore}=require('../scripts/admin/postgres-review-store.cjs');
const {createReviewService}=require('../scripts/admin/review-workspace.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;
const binding={dataVersion:12,manifestSha256:'a'.repeat(64),historySha256:'b'.repeat(64),snapshotSha256:'c'.repeat(64)};
function fakePg(){
 const rows=new Map(),calls=[];
 const pool={query:async(sql,args)=>{
  calls.push({sql,args:structuredClone(args)});
  if(sql.startsWith('SELECT revision')){
   const found=rows.get(args[0]);return {rows:found?[structuredClone(found)]:[],rowCount:found?1:0};
  }
  if(sql.startsWith('INSERT INTO organizer_review_workspace')){
   const [org,revision,envelope]=args;
   if(rows.has(org))return {rowCount:0,rows:[]};
   rows.set(org,{revision,envelope});return {rowCount:1,rows:[{revision}]};
  }
  if(sql.startsWith('UPDATE organizer_review_workspace')){
   const [org,revision,envelope,expected]=args,found=rows.get(org);
   if(!found||found.revision!==expected)return {rowCount:0,rows:[]};
   rows.set(org,{revision,envelope});return {rowCount:1,rows:[{revision}]};
  }
  throw Error('Unrecognized SQL operation: '+sql);
 }};
 return {pool,rows,calls};
}
function make(t={}){
 const db=fakePg(),keys=new Map([
  ['morothon',randomBytes(32)],['skoglopet',randomBytes(32)]
 ]);
 const keyProvider=async org=>keys.get(org);
 const store=postgresReviewStore({pool:db.pool,keyProvider});
 const sessions={
  reviewer:{subject:'fictional-reviewer',organizers:{morothon:['review']}},
  owner:{subject:'fictional-owner',organizers:{morothon:['review','approve'],skoglopet:['review','approve']}},
  foreign:{subject:'fictional-foreign',organizers:{skoglopet:['review']}}
 };
 const service=createReviewService({authenticate:async session=>sessions[session]||null,
  getTrustedBinding:async org=>binding,store,
  clock:()=>Date.parse('2026-11-16T18:30:00.000Z')});
 return {...db,keys,store,service};
}
function draftFor(org){
 let p=C.empty(binding);
 p=C.report(p,{id:'fictional-'+org,category:'Mulige duplikater',
  personIds:['PERSON-FAKE-ONE','PERSON-FAKE-TWO'],description:'Syntetisk sak for '+org,
  source:'Syntetisk kontroll uten ekte persondata'});
 return C.transition(p,'fictional-'+org,'rejected','To forskjellige syntetiske profiler.');
}
test('postgres review store validates mandatory private dependencies, tenant IDs and 256-bit keys',async()=>{
 assert.throws(()=>postgresReviewStore(),/pool og nøkkelprovider/);
 const {store,service,keys}=make();
 await assert.rejects(()=>store.get('../morothon'),/arrangør-ID/);
 await assert.rejects(()=>service.load({session:'forged',organizer:'morothon'}),/Ingen bekreftet tilgang/);
 await assert.rejects(()=>service.load({session:'foreign',organizer:'morothon'}),/Ingen bekreftet tilgang/);
 keys.set('morothon',Buffer.alloc(12));
 await assert.rejects(()=>service.save({session:'reviewer',organizer:'morothon',expectedRevision:0,draft:draftFor('morothon')}),/256-bit/);
});
test('existing C2.4 service saves encrypted tenant data in PostgreSQL and survives service recreation',async()=>{
 const {service,store,rows,calls,pool,keys}=make();
 const draft=draftFor('morothon');
 const saved=await service.save({session:'reviewer',organizer:'morothon',expectedRevision:0,draft});
 assert.equal(saved.revision,1);assert.equal(saved.productionApplied,false);
 assert.equal(rows.get('morothon').revision,1);
 const ciphertext=rows.get('morothon').envelope;
 assert.equal(ciphertext.includes('Syntetisk sak'),false);
 assert.equal(ciphertext.includes('PERSON-FAKE-ONE'),false);
 assert.match(ciphertext,/"iv":/);assert.match(ciphertext,/"tag":/);
 const restored=postgresReviewStore({pool,keyProvider:async org=>keys.get(org)});
 assert.deepEqual((await restored.get('morothon')).draft,draft);
 assert.equal(await restored.get('skoglopet'),null);
 assert.deepEqual((await service.load({session:'reviewer',organizer:'morothon'})).events.map(x=>x.action),['draft-saved']);
 assert.ok(calls.every(c=>/organizer_id = \$1|VALUES \(\$1, \$2, \$3\)/.test(c.sql)),'all SQL is parameterized and scoped');
 assert.ok(calls.every(c=>c.sql.indexOf('fictional-reviewer')===-1),'no principal embedded in SQL text');
});
test('optimistic CAS rejects concurrent first saves and lost updates; approval remains non-publishing',async()=>{
 const {service,rows}=make(),draft=draftFor('morothon');
 const outcomes=await Promise.allSettled([service.save({session:'owner',organizer:'morothon',expectedRevision:0,draft}),
  service.save({session:'owner',organizer:'morothon',expectedRevision:0,draft})]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 assert.equal(rows.get('morothon').revision,1);
 const current=await service.load({session:'owner',organizer:'morothon'});
 await assert.rejects(()=>service.save({session:'owner',organizer:'morothon',expectedRevision:0,draft}),/endret/);
 const approved=await service.approve({session:'owner',organizer:'morothon',expectedRevision:1,
  expectedDigest:outcomes.find(x=>x.status==='fulfilled').value.digest});
 assert.equal(approved.revision,2);
 assert.equal(approved.status,'review-approved');
 assert.equal(approved.publicationAuthorized,false);
 assert.equal(approved.productionApplied,false);
 const changed=await service.save({session:'owner',organizer:'morothon',expectedRevision:2,draft});
 assert.equal(changed.revision,3);
 assert.equal((await service.load({session:'owner',organizer:'morothon'})).approval,null);
 assert.equal('publish' in service,false);
});
test('PostgreSQL tenant AAD prevents ciphertext substitution even when private keys match',async()=>{
 const {store,service,rows,keys}=make();
 const common=randomBytes(32);keys.set('morothon',common);keys.set('skoglopet',common);
 await service.save({session:'owner',organizer:'morothon',expectedRevision:0,draft:draftFor('morothon')});
 rows.set('skoglopet',{...rows.get('morothon')});
 await assert.rejects(()=>store.get('skoglopet'),/auth|authenticate|Unsupported state/i);
 assert.deepEqual((await store.get('morothon')).draft,draftFor('morothon'));
});
test('corrupted ciphertext and stale or mismatched history fail closed without rewriting stored bytes',async()=>{
 const {store,service,rows}=make(),draft=draftFor('morothon');
 await service.save({session:'owner',organizer:'morothon',expectedRevision:0,draft});
 const before=structuredClone(rows.get('morothon')),envelope=JSON.parse(before.envelope);
 envelope.data=envelope.data.slice(0,-2)+'AA';
 rows.set('morothon',{...before,envelope:JSON.stringify(envelope)});
 await assert.rejects(()=>store.get('morothon'));
 assert.equal(rows.get('morothon').revision,1);
 const {service:another}=make();
 const tampered=C.empty({...binding,dataVersion:13});
 await assert.rejects(()=>another.save({session:'owner',organizer:'morothon',expectedRevision:0,draft:tampered}),/foreldet/);
});
