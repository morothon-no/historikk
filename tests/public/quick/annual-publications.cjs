'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../../../tools/diploma-admin/result-release-data.cjs'),P=require('../../../tools/diploma-admin/annual-release-data.cjs'),sample=require('./fixtures/corrections-data.js');
test('annual provenance v3 preserves old result/identity journals and exact source bytes across new people, a new year and reversal',()=>{
 const h=sample.history(),bytes=D.encode(h),j={schemaVersion:1,baselineSha256:D.hash(bytes),entries:[]},a=structuredClone(h);a.results[0][5]='49:59';
 const first=D.appendPublication(bytes,a,j,{manifestSha256:'a'.repeat(64),dataVersion:3}),named=structuredClone(a);named.aliases={...named.aliases,[named.people[0].i]:['Syntetisk Tidligere Navn']};
 const identity=D.appendIdentityPublication(first.bytes,named,first.journal,{manifestSha256:'b'.repeat(64),dataVersion:4}),next=structuredClone(named);
 next.people.push({i:'MOR-ABCDE01',n:'Syntetisk Ny Person',g:'Dame'});next.results.push([2027,'MOR-ABCDE01','Kortmoro','10 km','DNF','','','','','']);next.yearStats.push([2027,1,1,1,0,1,0,0,1,0]);next.range='1992–2027';
 const annual=D.appendAnnualPublication(identity.bytes,next,identity.journal,{manifestSha256:'c'.repeat(64),dataVersion:5});assert.equal(annual.journal.schemaVersion,3);assert.deepEqual(D.undoPublishedResults(annual.bytes,annual.journal),bytes);
 const restored=D.undoAnnualPublication(next,annual.journal,'c'.repeat(64));assert.deepEqual(restored,named);
 const reversed=D.appendAnnualPublication(annual.bytes,restored,annual.journal,{manifestSha256:'d'.repeat(64),dataVersion:6,reverses:'c'.repeat(64)});assert.deepEqual(D.undoPublishedResults(reversed.bytes,reversed.journal),bytes);
 assert.throws(()=>D.appendAnnualPublication(annual.bytes,restored,annual.journal,{manifestSha256:'d'.repeat(64),dataVersion:6}),/slette/);
 const wrong=structuredClone(next);wrong.people[0].n='Syntetisk Uautorisert Navn';assert.throws(()=>P.changes(next,wrong),/Uautorisert/);
 const foreign=structuredClone(next);foreign.redirects={...foreign.redirects,'MOR-ABCDE01':next.people[0].i};assert.throws(()=>P.changes(next,foreign),/identitetskoblinger/);
});
test('annual rollback rejects newer owned changes, reordered rows, tampered hashes and extra administrative fields',()=>{
 const h=sample.history(),bytes=D.encode(h),j={schemaVersion:1,baselineSha256:D.hash(bytes),entries:[]},next=structuredClone(h);next.results[0][5]='49:59';
 const a=D.appendAnnualPublication(bytes,next,j,{manifestSha256:'a'.repeat(64),dataVersion:3}),later=structuredClone(next);later.results[0][5]='49:58';
 const b=D.appendPublication(a.bytes,later,a.journal,{manifestSha256:'b'.repeat(64),dataVersion:4});assert.throws(()=>D.undoAnnualPublication(later,b.journal,'a'.repeat(64)),/nyere/);
 const swapped=structuredClone(next);[swapped.results[0],swapped.results[1]]=[swapped.results[1],swapped.results[0]];assert.throws(()=>P.changes(next,swapped),/Uautorisert/);
 const hash=structuredClone(a.journal);hash.entries[0].changes[0].after[5]='40:00';assert.throws(()=>D.undoPublishedResults(a.bytes,hash),/kontrollsum/);
 assert.throws(()=>P.validatePatch({field:'people',index:1,before:null,after:{i:'MOR-ABCDE01',n:'Syntetisk Person',privateNote:'not public'}}),/offentlig/);
});
