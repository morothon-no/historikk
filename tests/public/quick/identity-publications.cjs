'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../../../tools/diploma-admin/result-release-data.cjs'),
 sample=require('./fixtures/corrections-data.js');
test('identity journal v2 preserves v1 entries and exact original bytes through mixed result, merge and reversal publications',()=>{
 const original=sample.history(),bytes=D.encode(original),journal={schemaVersion:1,baselineSha256:D.hash(bytes),entries:[]},result=structuredClone(original);
 result.results[0][5]='49:57';const a=D.appendPublication(bytes,result,journal,{manifestSha256:'a'.repeat(64),dataVersion:3});
 const merged=structuredClone(result);merged.redirects['MOR-C220001']='MOR-C220002';merged.aliases['MOR-C220002']=['Syntetisk Kari Nord'];
 const b=D.appendIdentityPublication(a.bytes,merged,a.journal,{manifestSha256:'b'.repeat(64),dataVersion:4});
 assert.equal(b.journal.schemaVersion,2);assert.deepEqual(b.journal.entries[0],a.journal.entries[0]);
 assert.deepEqual(D.undoPublishedResults(b.bytes,b.journal),bytes);assert.deepEqual(merged.results,result.results);
 const newer=structuredClone(merged);newer.results[1][5]='49:56';const c=D.appendPublication(b.bytes,newer,b.journal,{manifestSha256:'c'.repeat(64),dataVersion:5});
 const inverse=D.undoIdentityPublication(newer,c.journal,'b'.repeat(64));assert.equal(inverse.results[1][5],'49:56');assert.deepEqual(inverse.redirects,original.redirects);
 const d=D.appendIdentityPublication(c.bytes,inverse,c.journal,{manifestSha256:'d'.repeat(64),dataVersion:6});assert.deepEqual(D.undoPublishedResults(d.bytes,d.journal),bytes);
});
test('identity journal rejects results, gender, unknown fields, reordered IDs, broken hashes and later change-away-and-back on owned identity keys',()=>{
 const before=sample.history(),bytes=D.encode(before),j={schemaVersion:1,baselineSha256:D.hash(bytes),entries:[]},merged=structuredClone(before);
 merged.redirects['MOR-C220001']='MOR-C220002';
 for(const mutate of [h=>h.results[0][5]='49:00',h=>h.people[0].g='Dame',h=>h.people.reverse(),h=>h.yearStats[0][1]++]){
  const changed=structuredClone(merged);mutate(changed);assert.throws(()=>D.appendIdentityPublication(bytes,changed,j,{manifestSha256:'a'.repeat(64),dataVersion:3}));
 }
 const a=D.appendIdentityPublication(bytes,merged,j,{manifestSha256:'a'.repeat(64),dataVersion:3});
 const bad=structuredClone(a.journal);bad.entries[0].changes[0].note='Private note';assert.throws(()=>D.undoPublishedResults(a.bytes,bad));
 const reversed=D.undoIdentityPublication(merged,a.journal,'a'.repeat(64)),b=D.appendIdentityPublication(a.bytes,reversed,a.journal,{manifestSha256:'b'.repeat(64),dataVersion:4}),
  c=D.appendIdentityPublication(b.bytes,merged,b.journal,{manifestSha256:'c'.repeat(64),dataVersion:5});
 assert.throws(()=>D.undoIdentityPublication(merged,c.journal,'a'.repeat(64)),/nyere endringer/);
});
