'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {setup,userId,organizer}=require('./helpers/result-publication.cjs');
const {restoreFiles}=require('../scripts/admin/result-release.cjs');
test('publication requires exact owner approval, restores encrypted backup, and writes canonical/public history together only after explicit publish',async t=>{
 const f=await setup(t),before=Buffer.from(f.repository.files.get('data/history.json')),approved=await f.approve();
 for(const session of ['viewer','editor','forged'])await assert.rejects(()=>f.publication.prepare({...approved,session}),/Ingen tilgang/);
 await assert.rejects(()=>f.publication.prepare({...approved,expectedDigest:'0'.repeat(64)}),/Godkjenn/);
 const plan=await f.publication.prepare(approved);assert.equal(plan.stage,'prepared');assert.equal(plan.backupVerified,true);assert.equal(f.remote.submitted,0);await f.publication.progress(organizer);assert.equal(f.remote.submitted,0);
 await assert.rejects(()=>f.publication.publish({...f.input,id:plan.id,confirmation:'0'.repeat(64)}),/eksakte/);
 await f.publication.publish({...f.input,id:plan.id,confirmation:plan.manifestSha256});
 const reserved=await f.review.load(f.input);await assert.rejects(async()=>f.review.save({...f.input,expectedRevision:reserved.revision,draft:await f.draft()}),/publisering pågår/);
 await f.publication.progress(organizer);assert.equal(f.remote.submitted,1);assert.deepEqual(f.repository.files.get('data/history.json'),before);
 f.remote.checks='success';await f.publication.progress(organizer);assert.equal(f.remote.merged,1);assert.deepEqual(f.repository.files.get('data/history.json'),f.repository.files.get('public-data/data/history.json'));assert.notDeepEqual(f.repository.files.get('data/history.json'),before);
 assert.equal((await f.publication.status(f.input)).job.productionApplied,false);f.remote.deploy='success';await f.publication.progress(organizer);
 const done=(await f.publication.status(f.input)).job;assert.equal(done.stage,'published');assert.equal(done.productionApplied,true);assert.equal((await f.review.load(f.input)).status,'published');assert.match(done.profiles[0],/#lop=/);
 for(const bytes of f.repository.files.values()){assert.equal(bytes.includes(Buffer.from('synthetic-private-note')),false);assert.equal(bytes.includes(Buffer.from(userId)),false);}
 const encrypted=await fs.readFile(path.join(f.directory,'publications','job-'+plan.id.slice(0,48)+'.review.aesgcm'),'utf8');assert.equal(encrypted.includes('synthetic-private-note'),false);assert.equal(encrypted.includes('49:58'),false);
});
test('failed CI, stale source, concurrent edits and missing authentication never acquire published status',async t=>{
 const f=await setup(t),approved=await f.approve(),plan=await f.publication.prepare(approved);
 const old=await f.review.load(f.input);await f.review.save({...f.input,expectedRevision:old.revision,draft:await f.draft()});
 await assert.rejects(()=>f.publication.publish({...f.input,id:plan.id,confirmation:plan.manifestSha256}),/endret/);assert.equal(f.remote.submitted,0);
 const f2=await setup(t),a2=await f2.approve(),p2=await f2.publication.prepare(a2),before=Buffer.from(f2.repository.files.get('data/history.json'));
 await f2.publication.publish({...f2.input,id:p2.id,confirmation:p2.manifestSha256});await f2.publication.progress(organizer);f2.remote.checks='failed';await f2.publication.progress(organizer);
 assert.equal((await f2.publication.status(f2.input)).job.stage,'failed');assert.equal(f2.remote.merged,0);assert.deepEqual(f2.repository.files.get('data/history.json'),before);
 const f3=await setup(t),a3=await f3.approve();f3.repository.files.set('public-data/data/history.json',Buffer.from('{}'));await assert.rejects(()=>f3.publication.prepare(a3),/ulike dataversjoner/);
});
test('a successful deploy with a stale or incomplete public site remains unverified, then completes when actual public verification passes',async t=>{
 const f=await setup(t),a=await f.approve(),p=await f.publication.prepare(a);await f.publication.publish({...f.input,id:p.id,confirmation:p.manifestSha256});await f.publication.progress(organizer);f.remote.checks='success';await f.publication.progress(organizer);f.remote.deploy='success';f.remote.live=false;await f.publication.progress(organizer);
 assert.equal((await f.publication.status(f.input)).job.stage,'verifying');assert.equal((await f.review.load(f.input)).status,'review-approved');
 f.remote.live=true;await f.publication.progress(organizer);assert.equal((await f.publication.status(f.input)).job.stage,'published');
});
test('reversal is a new draft with exact inverse values and requires fresh approval and a higher data version',async t=>{
 const f=await setup(t),original=Buffer.from(f.repository.files.get('data/history.json')),a=await f.approve(),p=await f.publication.prepare(a);await f.publication.publish({...f.input,id:p.id,confirmation:p.manifestSha256});await f.publication.progress(organizer);f.remote.checks='success';await f.publication.progress(organizer);f.remote.deploy='success';await f.publication.progress(organizer);
 await f.publication.reverse({...f.input,id:p.id});const reversed=await f.review.load(f.input);assert.equal(reversed.status,'draft');assert.equal(reversed.approval,null);assert.equal(reversed.draft.cases[0].change.after[5],'50:00');
 const approved=await f.review.approve({...f.input,expectedRevision:reversed.revision,expectedDigest:reversed.digest}),next=await f.publication.prepare({...f.input,expectedRevision:approved.revision,expectedDigest:reversed.digest});assert.equal(next.dataVersion,p.dataVersion+1);
 await f.publication.publish({...f.input,id:next.id,confirmation:next.manifestSha256});await f.publication.progress(organizer);await f.publication.progress(organizer);await f.publication.progress(organizer);assert.deepEqual(f.repository.files.get('data/history.json'),original);assert.equal((await f.publication.status(f.input)).job.stage,'published');
});
test('uncertain GitHub writes retain the publication lock and need explicit recheck; expired/revoked owners cannot continue',async t=>{
 const f=await setup(t),a=await f.approve(),p=await f.publication.prepare(a);await f.publication.publish({...f.input,id:p.id,confirmation:p.manifestSha256});await f.publication.progress(organizer);f.remote.error=Object.assign(Error('Syntetisk ukjent nettverksutfall'),{uncertain:true});await f.publication.progress(organizer);
 assert.equal((await f.publication.status(f.input)).job.stage,'needs-review');const record=await f.reviewStore.get(organizer);assert.equal(record.publicationLock.id,p.id);
 await assert.rejects(()=>f.publication.retry({...f.input,session:'viewer',id:p.id}),/Ingen tilgang/);f.remote.error=null;await f.publication.retry({...f.input,id:p.id});f.sessions.delete('owner');await f.publication.progress(organizer);assert.equal(f.remote.merged,0);assert.equal((await f.reviewStore.get(organizer)).publicationLock?.id,p.id);
});
test('uncertain initial PR creation can be explicitly rechecked through the same idempotent submission without losing approval',async t=>{
 const f=await setup(t),a=await f.approve(),p=await f.publication.prepare(a);await f.publication.publish({...f.input,id:p.id,confirmation:p.manifestSha256});
 f.remote.submitError=Object.assign(Error('Syntetisk brutt forbindelse etter forespørsel'),{uncertain:true});await f.publication.progress(organizer);assert.equal((await f.publication.status(f.input)).job.stage,'needs-review');assert.equal((await f.reviewStore.get(organizer)).publicationLock.id,p.id);
 f.remote.submitError=null;await f.publication.retry({...f.input,id:p.id});await f.publication.progress(organizer);assert.equal((await f.publication.status(f.input)).job.stage,'checking');assert.equal(f.remote.merged,0);
});
test('withdrawal preserves later unrelated corrections, but refuses a later change on the same result even if its value returned',async t=>{
 const C=require('../tools/diploma-admin/intake-model.js').Corrections;
 async function publish(f,draft){const a=await f.approve(draft),p=await f.publication.prepare(a);await f.publication.publish({...f.input,id:p.id,confirmation:p.manifestSha256});f.remote.checks='success';f.remote.deploy='success';for(let i=0;i<3;i++)await f.publication.progress(organizer);assert.equal((await f.publication.status(f.input)).job.stage,'published');return p;}
 async function correction(f,index,time){const before=f.context.history.results[index],after=[...before];after[5]=time;let draft=C.report(C.empty(f.context.base),{id:'synthetic-later-'+time.replace(':',''),category:'Innmeldt feil',personIds:[before[1]],description:'Syntetisk dokumentert rettelse',source:'syntetisk test'});return C.propose(f.context.history,draft,draft.cases[0].id,{kind:'result',personIds:[before[1]],selector:await C.resultSelector(f.context.history,index,f.context.base),after,source:'syntetisk test',reason:'Dokumentert syntetisk grunnlag.'});}
 const f=await setup(t),first=await publish(f),row=(await f.publication.status(f.input)).job.changes[0].index;
 const other=f.context.history.results.findIndex((r,i)=>i!==row&&r[1]===f.context.history.results[row][1]);assert.ok(other>=0);const second=await publish(f,await correction(f,other,'49:59'));await f.publication.reverse({...f.input,id:first.id});const draft=(await f.review.load(f.input)).draft;assert.equal(draft.cases[0].change.selector.index,row);assert.equal(f.context.history.results[other][5],'49:59');assert.equal(second.dataVersion,first.dataVersion+1);
 const g=await setup(t),original=await publish(g);await publish(g,await correction(g,row,'49:57'));await publish(g,await correction(g,row,'49:58'));await assert.rejects(g.publication.reverse({...g.input,id:original.id}),/nyere endringer/);
});
