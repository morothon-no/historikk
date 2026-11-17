'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../../../tools/diploma-admin/result-release-data.cjs'),sample=require('./fixtures/corrections-data.js');
test('public result provenance restores exact historical bytes across forward and reverse releases, rejecting unrelated edits',()=>{
 const h=sample.history(),bytes=D.encode(h),j={schemaVersion:1,baselineSha256:D.hash(bytes),entries:[]},after=structuredClone(h);after.results[0][5]='49:59';
 const first=D.appendPublication(bytes,after,j,{manifestSha256:'a'.repeat(64),dataVersion:3});assert.deepEqual(D.undoPublishedResults(first.bytes,first.journal),bytes);
 const reverse=D.appendPublication(first.bytes,h,first.journal,{manifestSha256:'b'.repeat(64),dataVersion:4});assert.deepEqual(reverse.bytes,bytes);assert.deepEqual(D.undoPublishedResults(reverse.bytes,reverse.journal),bytes);
 const other=structuredClone(after);other.people[0].n='Syntetisk uautorisert navn';assert.throws(()=>D.appendPublication(bytes,other,j,{manifestSha256:'a'.repeat(64),dataVersion:3}),/bare eksisterende resultatlinjer/);
 const invalid=structuredClone(first.journal);invalid.entries[0].changes[0].after[5]='1:99:99';assert.throws(()=>D.undoPublishedResults(first.bytes,invalid),/kontrollsum/);
 const extra=structuredClone(after);extra.results[1][5]='1:23:45';assert.throws(()=>D.undoPublishedResults(D.encode(extra),first.journal),/annen historikk/);
 assert.throws(()=>D.appendPublication(bytes,h,j,{manifestSha256:'a'.repeat(64),dataVersion:3}),/allerede riktig/);
});
