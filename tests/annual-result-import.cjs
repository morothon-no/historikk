'use strict';
// Fictional CSVs and private temporary stores only. No live provider or dataset writes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomBytes}=require('node:crypto');
const A=require('../scripts/admin/annual-result-import.cjs'),S=require('../scripts/admin/annual-import-review.cjs'),
 C=require('../tools/diploma-admin/intake-model.js').Corrections,F=require('./public/quick/fixtures/corrections-data.js'),
 profile=require('../web-admin/event-profile.json'),registry=require('../public-data/data/badges.json');
const org='synthetic-organizer',existing='MOR-C220001';
const csv=(rows)=>['Navn;Øvelse;Distanse;Kjønn;Status;Tid;Plass;Startnummer',...rows].join('\n');
const future=()=>csv(['Syntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;101',
 'Syntetisk Helt Ny Eksempel;Morothon;20 km;Dame;DNF;1:20:00;12;102',
 'Syntetisk Uten Start;Kortmoro;10 km;Herre;DNS;DNS;;103']);
async function setup(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'annual-import-synthetic-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const history=F.history(),base=await C.binding(history,F.meta),context={organizer:org,history,base,profile,registry,personIdPrefix:'MOR-'},key=randomBytes(32),
  actor={subject:'11111111-1111-4111-8111-111111111111',roles:{[org]:'owner'},organizers:{[org]:['review','approve']}},
  store=S.privateAnnualImportFileStore({directory,key}),options={store,loadContext:async()=>context,authenticate:async session=>session==='owner'?actor:null},service=S.createAnnualImportReview(options),input={session:'owner',organizer:org};
 const source=(text=future(),year=2027)=>A.request({organizer:org,base:context.base,year,text,completeClaim:true});
 const decision=(plan,rowId,action='existing',extra={})=>({rowId,basis:plan.interpretationSha256,action,
  runnerId:action==='existing'?existing:null,targetIndex:null,personKey:action==='new-person'?'synthetic-person-key':null,confirmDistinct:false,reason:'Kontrollert i syntetisk arrangørkilde.',...extra});
 return {directory,key,context,options,store,service,input,source,decision};
}
test('annual contract creates a source-bound new-year plan with existing/new people, clean DNF and informational DNS without changing history',async t=>{
 const f=await setup(t),before=structuredClone(f.context.history),request=f.source(),initial=await A.prepare(f.context,request);
 assert.equal(initial.ready,false);assert.equal(initial.summary.dns,1);assert.equal(initial.newPeople.length,0);
 const ids=initial.identityTasks.map(r=>r.rowId);assert.equal(ids.length,2);
 request.decisions=[f.decision(initial,ids[0]),f.decision(initial,ids[1],'new-person')];
 const plan=await A.prepare(f.context,request);assert.equal(plan.ready,true);assert.equal(plan.newEdition,true);assert.equal(plan.newPeople.length,1);
 assert.equal(plan.summary.newResults,2);assert.equal(plan.summary.dns,1);assert.equal(plan.newPeople[0].g,'Dame');
 const dnf=plan.operations.find(op=>op.after?.[4]==='DNF');assert.equal(dnf.after[5],'');assert.equal(dnf.after[6],'');
 assert.equal(plan.profiles.find(p=>p.id===existing).count,4);assert.equal(plan.productionApplied,false);assert.equal(plan.publicationAuthorized,false);
 assert.deepEqual(f.context.history,before);assert.equal('history' in plan,false);assert.equal('yearStats' in plan,false);
 assert.deepEqual(await A.prepare(f.context,request),plan);assert.equal((await A.verify(f.context,request,plan)).valid,true);
 await assert.rejects(f.service.preview({...f.input,input:{...request,publicationAuthorized:true}}),/felt/);
});
test('existing-year additions and corrected times preserve aliases, raw ownership, unrelated rows and missing source registrations',async t=>{
 const f=await setup(t),request=f.source(csv(['Syntetisk Gammelt Etternavn;Kortmoro;10 km;Herre;Fullført;49:20;1;101']),2022),before=structuredClone(f.context.history);
 const p=await A.prepare(f.context,request);assert.equal(p.newEdition,false);request.decisions=[f.decision(p,p.identityTasks[0].rowId,'existing',{runnerId:'MOR-OLD2201',targetIndex:2})];
 const out=await A.prepare(f.context,request);assert.equal(out.ready,true);assert.equal(out.summary.changed,1);assert.equal(out.operations[0].after[5],'49:20');
 assert.equal(out.operations[0].after[1],existing);assert.deepEqual(out.operations[0].before,before.results[2]);assert.deepEqual(f.context.history,before);
 const add=f.source(csv(['Syntetisk Kari Nord;Morothon;19 km;Herre;Fullført;1:45:00;1;404']),2026),first=await A.prepare(f.context,add);
 add.decisions=[f.decision(first,first.identityTasks.find(i=>i.kind==='person-review').rowId)];const result=await A.prepare(f.context,add);
 assert.equal(result.summary.newResults,1);assert.equal(result.operations.find(op=>op.kind==='add-result').after[3],'19 km');
 assert.equal(result.summary.preservedMissing,1);assert.equal(result.operations.some(op=>op.kind==='remove'),false);
});
test('annual work is encrypted and durable across fresh services; identical reimport is idempotent and cannot approve/publish',async t=>{
 const f=await setup(t),request=f.source(),plan=await A.prepare(f.context,request);
 request.decisions=[f.decision(plan,plan.identityTasks[0].rowId),f.decision(plan,plan.identityTasks[1].rowId,'new-person')];
 const saved=await f.service.save({...f.input,input:request,expectedRevision:0,expectedDigest:null,replaceCurrent:false});assert.equal(saved.revision,1);assert.equal(saved.status,'draft');
 const restarted=S.createAnnualImportReview({...f.options,store:S.privateAnnualImportFileStore({directory:f.directory,key:f.key})}),loaded=await restarted.load(f.input);
 assert.deepEqual(loaded.plan,saved.plan);assert.equal(loaded.stale,false);assert.deepEqual(Buffer.from(loaded.input.source.data,'base64'),Buffer.from(future()));
 const repeated=await restarted.save({...f.input,input:request,expectedRevision:1,expectedDigest:saved.digest,replaceCurrent:false});
 assert.equal(repeated.changed,false);assert.equal(repeated.revision,1);assert.equal(repeated.events.length,1);
 const bytes=await fs.readFile(path.join(f.directory,S.SCOPE,org+'.review.aesgcm'));assert.equal(bytes.includes(Buffer.from('Syntetisk')),false);assert.equal(bytes.includes(Buffer.from(request.source.data)),false);
 assert.equal('publish' in restarted,false);assert.equal('approve' in restarted,false);assert.equal(saved.plan.requires.verifiedBackup,true);
});
test('reimport conflicts require exact revision/hash and explicit source replacement, retaining the complete previous private source',async t=>{
 const f=await setup(t),input=f.source(),saved=await f.service.save({...f.input,input,expectedRevision:0,expectedDigest:null,replaceCurrent:false});
 const changed=f.source(future().replace('49:20','48:59'));assert.equal((await f.service.preview({...f.input,input:changed})).replacesPrivateSource,true);
 await assert.rejects(f.service.save({...f.input,input:changed,expectedRevision:1,expectedDigest:saved.digest,replaceCurrent:false}),/bekreft/);
 await assert.rejects(f.service.save({...f.input,input:changed,expectedRevision:0,expectedDigest:saved.digest,replaceCurrent:true}),/endret/);
 await assert.rejects(f.service.save({...f.input,input:changed,expectedRevision:1,expectedDigest:'a'.repeat(64),replaceCurrent:true}),/endret/);
 const next=await f.service.save({...f.input,input:changed,expectedRevision:1,expectedDigest:saved.digest,replaceCurrent:true});assert.equal(next.revision,2);
 assert.deepEqual(next.archives[0].input,input);assert.equal(next.archives[0].digest,saved.digest);
 f.context.base={...f.context.base,dataVersion:f.context.base.dataVersion+1};assert.equal((await f.service.load(f.input)).stale,true);
 await assert.rejects(f.service.save({...f.input,input:next.input,expectedRevision:2,expectedDigest:next.digest,replaceCurrent:true}),/foreldet/);
});
test('authorization, tenant isolation, source races, source identities and imported approval flags fail closed',async t=>{
 const f=await setup(t),input=f.source();for(const method of ['preview','save','load'])await assert.rejects(f.service[method]({...f.input,session:'forged',input}),/tilgang/);
 await assert.rejects(f.service.preview({...f.input,organizer:'another-organizer',input}),/tilgang/);
 await assert.rejects(f.service.preview({...f.input,input:{...input,organizer:'another-organizer'}}),/annen arrangør/);
 const q=structuredClone(input);q.base.snapshotSha256='e'.repeat(64);await assert.rejects(A.prepare(f.context,q),/foreldet/);
 const p=await A.prepare(f.context,input);input.decisions=[f.decision(p,p.identityTasks[0].rowId)];input.source.data=Buffer.from(future()+'\n').toString('base64');
 await assert.rejects(A.prepare(f.context,input),/annen fil/);
 let n=0;const raced=S.createAnnualImportReview({...f.options,loadContext:async()=>++n===1?f.context:{...f.context,base:{...f.context.base,dataVersion:999}}});
 await assert.rejects(raced.save({...f.input,input:f.source(),expectedRevision:0,expectedDigest:null,replaceCurrent:false}),/oppdatert under kontrollen/);
 assert.equal(await f.store.get(org),null);
});
test('unknown identities, documented non-starts, conflicting DNS and incomplete rows never silently become new people or replacements',async t=>{
 const f=await setup(t),request=f.source(csv(['Syntetisk Lik Ukjent;Kortmoro;10 km;Herre;Fullført;49:20;1;200',
 'Syntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;49:99;1;201']));const p=await A.prepare(f.context,request);
 assert.equal(p.ready,false);assert.equal(p.newPeople.length,0);assert.ok(p.identityTasks.some(i=>i.kind==='source-conflict'));
 const names=f.source(csv(['Syntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;200'])),np=await A.prepare(f.context,names);
 names.decisions=[f.decision(np,np.identityTasks[0].rowId,'new-person')];await assert.rejects(A.prepare(f.context,names),/avklares/);
 const dns=f.source(csv(['Syntetisk Kari Nord;Kortmoro;10 km;Herre;DNS;DNS;;1']),2022),dp=await A.prepare(f.context,dns);
 assert.equal(dp.ready,false);assert.equal(dp.identityTasks[0].kind,'source-conflict');assert.equal(dp.operations.some(op=>op.after),false);
 const unknown=f.source(csv(['Syntetisk Ny Deltaker;Kortmoro;10 km;Herre;Fullført;49:20;1;200'])),up=await A.prepare(f.context,unknown);
 unknown.decisions=[f.decision(up,up.identityTasks[0].rowId,'defer')];const deferred=await A.prepare(f.context,unknown);
 assert.equal(deferred.ready,false);assert.equal(deferred.summary.deferred,1);assert.equal(deferred.newPeople.length,0);
});
test('the contract reuses CSV/TSV encodings and exact historical distances, without pretending XML or start lists are results',async t=>{
 const f=await setup(t);
 for(const sep of [';',',','\t'])for(const encoding of ['utf8','utf16le','latin1']){
  const text=[['Name','Event','Distance','Result'],['Syntetisk Åse Eksempel','Kortmoro','9 km','50:00']].map(row=>row.join(sep)).join('\r\n'),
   bytes=encoding==='utf16le'?Buffer.concat([Buffer.from([255,254]),Buffer.from(text,encoding)]):Buffer.from(text,encoding),
   request=A.request({organizer:org,base:f.context.base,year:2010,bytes}),first=await A.prepare(f.context,request);
  request.decisions=[f.decision(first,first.identityTasks[0].rowId,'new-person')];const p=await A.prepare(f.context,request);
  assert.equal(p.sourceSha256,A.hash(bytes));assert.equal(p.newPeople[0].n,'Syntetisk Åse Eksempel');assert.equal(p.operations[0].after[3],'9 km');
 }
 await assert.rejects(A.prepare(f.context,f.source('<StartList/>')),/CSV/);
 await assert.rejects(A.prepare(f.context,f.source('Name;Race;Start time\nSyntetisk Start;Kortmoro;12:00:00')),/sluttid|resultatstatus/);
});
test('new person keys are stable across reimports and incompatible reuse or forged checked plans is rejected',async t=>{
 const f=await setup(t),source=f.source(csv(['Syntetisk Ny Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;222'])),p=await A.prepare(f.context,source);
 source.decisions=[f.decision(p,p.identityTasks[0].rowId,'new-person')];const one=await A.prepare(f.context,source);
 const changed=f.source(csv(['Syntetisk Ny Nord;Kortmoro;10 km;Herre;Fullført;48:20;1;222'])),cp=await A.prepare(f.context,changed);
 changed.decisions=[f.decision(cp,cp.identityTasks[0].rowId,'new-person')];const two=await A.prepare(f.context,changed);assert.equal(one.newPeople[0].i,two.newPeople[0].i);
 const corrupt=structuredClone(one);corrupt.operations[0].after[5]='47:00';const {checksum,...body}=corrupt;corrupt.checksum=A.hash(body);
 await assert.rejects(A.verify(f.context,source,corrupt),/endret/);
 const duplicate=f.source(csv(['Syntetisk Ny Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;222','Syntetisk Annen Nord;Morothon;20 km;Herre;Fullført;1:49:20;1;223'])),d=await A.prepare(f.context,duplicate);
 duplicate.decisions=d.identityTasks.map(i=>f.decision(d,i.rowId,'new-person'));await assert.rejects(A.prepare(f.context,duplicate),/forskjellige navn/);
});
test('redirect-owned registrations retain their original owner and a forgotten selector cannot create an extra start',async t=>{
 const f=await setup(t);f.context.history.results[2][1]='MOR-OLD2201';f.context.base=await C.binding(f.context.history,F.meta);
 const input=f.source(csv(['Syntetisk Gammelt Etternavn;Kortmoro;10 km;Herre;Fullført;49:20;1;3']),2022),first=await A.prepare(f.context,input);
 input.decisions=[f.decision(first,first.identityTasks[0].rowId)];
 await assert.rejects(A.prepare(f.context,input),/eksisterende resultatlinjen/);
 input.decisions[0].targetIndex=2;const checked=await A.prepare(f.context,input),op=checked.operations.find(o=>o.kind==='correct-result');
 assert.equal(op.before[1],'MOR-OLD2201');assert.equal(op.after[1],'MOR-OLD2201');assert.equal(op.after[5],'49:20');
 assert.equal(checked.summary.newResults,0);assert.equal(checked.profiles[0].id,existing);assert.equal(checked.profiles[0].count,3);
 assert.equal(f.context.history.results[2][5],'50:00');
});
test('one explicitly confirmed new identity can have several starts without counting several annual participations',async t=>{
 const f=await setup(t),input=f.source(csv(['Syntetisk Ny Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;222',
 'Syntetisk Ny Nord;Morothon;20 km;Herre;Fullført;1:49:20;1;223'])),first=await A.prepare(f.context,input);
 input.decisions=first.identityTasks.map(i=>f.decision(first,i.rowId,'new-person'));const checked=await A.prepare(f.context,input);
 assert.equal(checked.newPeople.length,1);assert.equal(checked.summary.newResults,2);assert.equal(checked.profiles[0].count,1);assert.deepEqual(checked.profiles[0].years,[2027]);
 const known=f.source(csv(['Syntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;49:20;1;222'])),p=await A.prepare(f.context,known);
 known.decisions=[f.decision(p,p.identityTasks[0].rowId,'new-person',{confirmDistinct:true})];const distinct=await A.prepare(f.context,known);
 assert.equal(distinct.newPeople.length,1);assert.notEqual(distinct.newPeople[0].i,existing);
 assert.deepEqual(f.context.history.aliases,F.history().aliases);assert.deepEqual(f.context.history.redirects,F.history().redirects);
});
test('competing private saves use CAS and cannot overwrite decisions or the older result workspace',async t=>{
 const f=await setup(t),oldStore=require('../scripts/admin/review-workspace.cjs').privateFileStore({directory:f.directory,key:f.key}),
  legacy={v:1,revision:1,status:'draft',base:f.context.base,draft:C.empty(f.context.base),events:[]};
 await oldStore.transact(org,0,()=>legacy);
 const a=f.source(),b=f.source(future().replace('49:20','48:00')),attempt=input=>f.service.save({...f.input,input,expectedRevision:0,expectedDigest:null,replaceCurrent:false}),
  results=await Promise.allSettled([attempt(a),attempt(b)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.deepEqual(await oldStore.get(org),legacy);const saved=await f.service.load(f.input);assert.equal(saved.revision,1);assert.equal(saved.events.length,1);
 const copied=path.join(f.directory,S.SCOPE,'other-organizer.review.aesgcm');
 await fs.copyFile(path.join(f.directory,S.SCOPE,org+'.review.aesgcm'),copied);await fs.chmod(copied,0o600);
 await assert.rejects(f.store.get('other-organizer')); // Real tenant AAD, not only application filtering.
 assert.throws(()=>S.createAnnualImportReview({...f.options,store:oldStore}),/modulavgrenset/);
});
test('a viewer cannot mutate and a revoked session or caller mutation during checking cannot produce a different saved source',async t=>{
 const f=await setup(t),viewer=S.createAnnualImportReview({...f.options,authenticate:async()=>({subject:'22222222-2222-4222-8222-222222222222',roles:{[org]:'viewer'}})});
 assert.equal((await viewer.load(f.input)).status,'empty');await assert.rejects(viewer.preview({...f.input,input:f.source()}),/tilgang/);
 let calls=0;const revoked=S.createAnnualImportReview({...f.options,authenticate:async session=>++calls<3?f.options.authenticate(session):null});
 await assert.rejects(revoked.save({...f.input,input:f.source(),expectedRevision:0,expectedDigest:null,replaceCurrent:false}),/tilgang/);
 assert.equal(await f.store.get(org),null);
 const input=f.source(),before=structuredClone(input);let changed=false;
 const mutate=S.createAnnualImportReview({...f.options,authenticate:async session=>{
  if(!changed){changed=true;input.source.data=Buffer.from(future().replace('49:20','40:00')).toString('base64');}return f.options.authenticate(session);
 }});
 const saved=await mutate.save({...f.input,input,expectedRevision:0,expectedDigest:null,replaceCurrent:false});assert.deepEqual(saved.input,before);
 await assert.rejects(C.applyCandidate(f.context.history,saved.plan,f.context.base,{preview:true}));
 assert.deepEqual(f.context.history,F.history());
});
