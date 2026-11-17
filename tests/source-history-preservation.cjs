const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const helper=require('./helpers/honors.cjs'),{changes,previousSha256}=require('./public/quick/fixtures/historical-corrections.js');
const root=path.resolve(__dirname,'..'),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
test('historical source preservation restores only PR43 approved fields and retains the original complete-file fingerprint without writing sources',async()=>{
 const file=path.join(root,'data/history.json'),current=await fs.readFile(file),prior=helper.beforeApprovedResultCorrections(current);assert.equal(digest(prior),previousSha256);assert.notEqual(digest(current),previousSha256);
 helper.assertPreservedPresentation(current,prior,'data/history.json');helper.assertPreservedPresentation(prior,prior,'data/history.json');assert.deepEqual(await helper.preservedFile(root,'data/history.json'),prior);assert.deepEqual(await fs.readFile(file),current);
});
test('historical source preservation still rejects unrelated identities, other results, metadata and unauthorized edits on an approved row',async()=>{
 const source=await fs.readFile(path.join(root,'data/history.json'));
 // Keep failing assertion diffs small: use the exact authorized row guards,
 // fictional unrelated fields and no copy of the full historical register.
 const data={people:[{i:'synthetic',n:'Syntetisk Profil'}],results:[...changes.map(c=>[...c.after]),[2000,'synthetic','Kortmoro','13 km','Fullført','51:00',1,'','','']],updated:'2026-11-15'},current=Buffer.from(JSON.stringify(data)),journal={schemaVersion:1,baselineSha256:digest(current),entries:[]},expected=helper.beforeApprovedResultCorrections(current,journal);
 helper.assertPreservedPresentation(current,expected,'data/history.json',journal);
 const changeRow=data.results.findIndex(r=>JSON.stringify(r)===JSON.stringify(changes[0].after));assert.ok(changeRow>=0);
 for(const mutate of [d=>{d.people[0].n='Syntetisk uautorisert navneendring';},d=>{d.results.at(-1)[5]='9:59:59';},d=>{d.updated='1900-01-01';},d=>{d.results[changeRow][6]=999;},d=>{d.results[changeRow][5]='02:10:00';}]){
  const altered=structuredClone(data);mutate(altered);assert.throws(()=>helper.assertPreservedPresentation(Buffer.from(JSON.stringify(altered)),expected,'data/history.json',journal));
 }
 assert.throws(()=>helper.assertPreservedPresentation(Buffer.concat([current,Buffer.from('\n')]),expected,'data/history.json',journal));
 assert.deepEqual(await fs.readFile(path.join(root,'data/history.json')),source);
});
test('historical normalization never applies result allowances to another protected file',()=>{
 const a=Buffer.from('{"synthetic":1}'),b=Buffer.from('{"synthetic":2}');assert.throws(()=>helper.assertPreservedPresentation(a,b,'data/event-dates.json'));helper.assertPreservedPresentation(a,a,'data/event-dates.json');
});
