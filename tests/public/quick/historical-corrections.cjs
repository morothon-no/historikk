const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const R=require('../../../js/history-data.js'),{changes,previousHistory,previousSha256}=require('./fixtures/historical-corrections.js');
const root=path.resolve(__dirname,'../../..'),bytes=fs.readFileSync(path.join(root,'public-data/data/history.json'));
// These assertions describe the November historical correction, not later,
// separately approved releases. Reconstruct only the exact journalled rows.
const D=require('../../../tools/diploma-admin/result-release-data.cjs'),journal=require('./fixtures/result-publications.json');
const data=JSON.parse(D.undoPublishedResults(bytes,journal)),previous=previousHistory(data);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const thresholds=[5,10,15,20,25,30,35,40,45,50];
test('live history matches the trusted manifest and only exact journalled result changes differ from the historical baseline',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'public-data/manifest.json'))),approval=JSON.parse(fs.readFileSync(path.join(root,'.github/public-data-approval.json')));
 assert.equal(D.hash(bytes),approval.historySha256);assert.equal(manifest.historySha256,approval.historySha256);assert.equal(D.hash(fs.readFileSync(path.join(root,'public-data/manifest.json'))),approval.manifestSha256);
 if(journal.entries.length){assert.equal(journal.entries.at(-1).dataVersion,approval.dataVersion);assert.equal(journal.entries.at(-1).manifestSha256,approval.manifestSha256);}
 assert.deepEqual(R.validate(JSON.parse(bytes)).errors,[]);assert.equal(D.hash(D.undoPublishedResults(bytes,journal)),journal.baselineSha256);
});
function yearsByPerson(h){const groups=new Map();for(const p of h.people)groups.set(R.resolveId(p.i,h.redirects),[]);for(const r of h.results){const id=R.resolveId(r[1],h.redirects);if(groups.has(id))groups.get(id).push(r);}return [...groups].map(([id,rows])=>[id,R.participationYears(rows)]);}

test('November result corrections change exactly four complete rows and six cells, preserving every other historical byte',()=>{
 assert.equal(hash(previous),previousSha256);assert.equal(data.people.length,2643);assert.equal(data.results.length,6914);
 const rows=data.results.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(previous.results[i]));assert.equal(rows.length,4);
 assert.deepEqual(rows,changes.map(c=>c.after));assert.equal(rows.reduce((n,r)=>n+r.filter((v,i)=>v!==changes.find(c=>JSON.stringify(c.after)===JSON.stringify(r)).before[i]).length,0),6);
 for(const key of Object.keys(data).filter(k=>k!=='results'))assert.deepEqual(data[key],previous[key]);
});
test('all canonical participation years, attendance thresholds and annual participants survive time and event corrections',()=>{
 const before=yearsByPerson(previous),after=yearsByPerson(data);assert.deepEqual(after,before);
 for(const threshold of thresholds)assert.deepEqual(after.filter(([,years])=>years.length>=threshold).map(([id])=>id),before.filter(([,years])=>years.length>=threshold).map(([id])=>id));
 for(const [year]of data.yearStats)assert.deepEqual(after.filter(([,years])=>years.includes(year)).map(([id])=>id),before.filter(([,years])=>years.includes(year)).map(([id])=>id));
 assert.equal(new Map(after).get('MOR-15AF3A3').length,35);
 for(const year of [2012,2013]){assert.ok(data.results.some(r=>r[0]===year&&r[2]==='Kortmoro'&&r[3]==='13 km'&&r[4]==='Fullført'));const r=data.results.find(r=>r[0]===year&&r[1]==='MOR-15AF3A3');assert.equal(r[4],'Deltatt');assert.equal(r[5],'');assert.equal(r[6],'');assert.equal(R.isCompletedResult(r),false);}
});
test('corrected times become timed results while recorded source places remain intact and all other computed changes stay in the two historical groups',()=>{
 const person=id=>data.people.find(p=>p.i===R.resolveId(id,data.redirects)),oldPlaces=R.placements(previous.results,person),newPlaces=R.placements(data.results,person);
 const targets=changes.slice(0,2).map(c=>data.results.find(r=>JSON.stringify(r)===JSON.stringify(c.after)));
 assert.deepEqual(targets.map(r=>R.timeSeconds(r[5])),[7792,3974]);assert.deepEqual(targets.map(r=>r[6]),[45,127]);assert.deepEqual(targets.map(r=>newPlaces.get(r)),[35,2]);
 const changed=data.results.flatMap((r,i)=>(oldPlaces.get(previous.results[i])??null)===(newPlaces.get(r)??null)?[]:[r]);assert.equal(changed.length,76);
 assert.equal(changed.filter(r=>r[0]===1994&&r[2]==='Morothon'&&r[3]==='18 km').length,7);assert.equal(changed.filter(r=>r[0]===1998&&r[2]==='Kortmoro'&&r[3]==='13 km').length,69);
 const model=R.create(data);for(const row of targets)assert.ok(model.stats(row[1]).best.some(b=>b.event===row[2]&&b.km===R.parseDistanceKm(row[3])&&b.period==='historical'));
});
test('corrected legacy spellings cannot be reintroduced through the former person-specific time exceptions',()=>{
 assert.deepEqual(R.validate(data).errors,[]);
 for(const change of changes.slice(0,2)){const invalid=structuredClone(data),index=invalid.results.findIndex(r=>JSON.stringify(r)===JSON.stringify(change.after));invalid.results[index]=[...change.before];assert.ok(R.validate(invalid).errors.some(e=>e.code==='invalid-time'&&e.at===`results[${index}][5]`));assert.equal(R.timeSeconds(change.before[5]),null);}
});
test('documented DQ completion, seven time-field DNFs and distinct equal-name identities retain their original status and IDs',()=>{
 const dq=data.results.find(r=>r[0]===2007&&r[1]==='MOR-B1AC0FD');assert.deepEqual(dq,previous.results.find(r=>r[0]===2007&&r[1]==='MOR-B1AC0FD'));assert.equal(R.effectiveStatus(dq),'Fullført');assert.equal(R.countsAsParticipation(dq),true);assert.equal(R.timeSeconds(dq[5]),null);
 const dnfs=data.results.filter(r=>r[0]===2014&&r[4]==='Fullført'&&r[5]==='DNF');assert.equal(dnfs.length,7);for(const r of dnfs){assert.equal(R.effectiveStatus(r),'DNF');assert.equal(R.countsAsParticipation(r),true);assert.equal(R.isCompletedResult(r),false);}
 for(const r of data.results.filter(r=>R.effectiveStatus(r)==='DNS'))assert.equal(R.countsAsParticipation(r),false);
 for(const pair of [['MOR-51D2451','MOR-669609C'],['MOR-36949C3','MOR-7D386DB']]){assert.notEqual(R.resolveId(pair[0],data.redirects),R.resolveId(pair[1],data.redirects));for(const id of pair)assert.ok(data.people.some(p=>p.i===id));}
});
