const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../../../tools/diploma-admin/intake-model.js').Corrections,H=require('../../../js/history-data.js'),sample=require('./fixtures/corrections-data.js');
const ids=['MOR-C220001','MOR-C220002','MOR-C220003','MOR-C220004','MOR-C220005'];
const setup=async()=>{const h=sample.history(),b=await C.binding(h,sample.meta);return {h,b,p:C.empty(b)};};
function add(p,id='case-1',personIds=ids.slice(0,2)){return C.report(p,{id,category:'Syntetisk kontroll',personIds,description:'Kontroller syntetiske kilder',source:'syntetisk-kilde:1'});}
async function merge(h,p){p=add(p);return C.propose(h,p,'case-1',{kind:'merge',personIds:ids.slice(0,2),source:'syntetisk-kilde:1',reason:'Arrangøren har kontrollert identiteten i syntetisk kilde.'});}
async function edit(h,p,b,index,after,kind='result',caseId='case-edit'){p=add(p,caseId,[H.resolveId(after?.[1]||h.results[index]?.[1]||ids[0],h.redirects)]);return C.propose(h,p,caseId,{kind,personIds:p.cases.at(-1).personIds,selector:kind==='add'?null:await C.resultSelector(h,index,b),after,source:'syntetisk-resultat:1',reason:'Kilden dokumenterer denne rettelsen.'});}
test('C2.2 discovery proposes duplicates and spelling/alias candidates without merging identical names or approved redirected identities',async()=>{
 const {h}=await setup(),before=JSON.stringify(h),suggestions=C.discover(h);assert.ok(suggestions.some(s=>s.personIds.includes(ids[2])&&s.personIds.includes(ids[3])&&s.strength==='strong'));assert.ok(suggestions.some(s=>s.personIds.includes(ids[0])&&s.personIds.includes(ids[1])));assert.ok(suggestions.every(s=>!s.personIds.includes('MOR-OLD2201')));assert.equal(JSON.stringify(h),before);
 const c=C.discover(h,{intake:{rows:[{id:'r',match:{candidates:[{id:ids[0]}]}}],reviewCases:[{rowIds:['r'],message:'Syntetisk startlistekonflikt'}]}});assert.ok(c.some(s=>s.category==='Startlistekontroll'));
});
test('C2.2 confirmed merge preserves all starts, old names, aliases and stable redirects while changing unique participation years and badge basis',async()=>{
 const {h,b,p}=await setup(),before=JSON.stringify(h),proposal=await merge(h,p),out=await C.applyCandidate(h,proposal,b,{preview:true});assert.equal(out.history.results.length,h.results.length);assert.deepEqual(out.history.results,h.results);assert.equal(H.create(out.history).resolve(ids[0]),ids[1]);assert.equal(H.create(out.history).resolve('MOR-OLD2201'),ids[1]);assert.equal(H.create(out.history).stats(ids[1]).count,5);assert.ok(out.history.aliases[ids[1]].includes(h.people[0].n));assert.ok(out.history.aliases[ids[1]].includes('Syntetisk Gammelt Etternavn'));assert.equal(JSON.stringify(h),before);assert.equal(out.productionApplied,false);assert.deepEqual((await C.applyCandidate(h,proposal,b)).history,h,'Ungodkjente forslag anvendes ikke i standardmodus');
});
test('C2.2 overlapping same-race results and gender conflicts stop a merge without deleting real starts',async()=>{
 const {h,b,p}=await setup();let q=add(p,'overlap',ids.slice(2,4));q=await C.propose(h,q,'overlap',{kind:'merge',personIds:ids.slice(2,4),source:'syntetisk kilde',reason:'Krever kildekontroll'});await assert.rejects(()=>C.applyCandidate(h,q,b,{preview:true}),/Overlapp/);
 h.people[1].g='Dame';const binding=await C.binding(h,sample.meta),m=await merge(h,C.empty(binding));await assert.rejects(()=>C.applyCandidate(h,m,binding,{preview:true}),/Motstridende/);
});
test('C2.2 person changes preserve old name as alias; alias additions are explicit and immutable result ownership survives',async()=>{
 const {h,b,p}=await setup();let q=add(p,'name',[ids[0]]);q=await C.propose(h,q,'name',{kind:'person',personIds:[ids[0]],after:{n:'Syntetisk Nytt Etternavn',g:'Dame'},source:'Syntetisk navnekilde',reason:'Bekreftet i testkilden'});const out=await C.applyCandidate(h,q,b,{preview:true});assert.equal(out.history.people[0].g,'Dame');assert.ok(out.history.aliases[ids[0]].includes(h.people[0].n));assert.deepEqual(out.history.results,h.results);
 let a=add(p,'alias',[ids[0]]);a=await C.propose(h,a,'alias',{kind:'alias',personIds:[ids[0]],after:['Syntetisk Gammelt Etternavn','Syntetisk Nytt Alias'],source:'Syntetisk navnekilde',reason:'Bekreftet historisk alias'});assert.equal((await C.applyCandidate(h,a,b,{preview:true})).history.aliases[ids[0]].length,2);
});
test('C2.2 exact result edits validate time, class, identity, source placement and DNS/DNF/DQ using shared rules; relays stay separate',async()=>{
 const {h,b,p}=await setup();for(const [status,time,delta]of [['DNS','DNS',-1],['DNF','DNF',0],['Disket','DQ',0],['Fullført','49:20',0]]){const row=[...h.results[0]];row[4]=status;row[5]=time;row[6]=1;row[7]='M10-12';const q=await edit(h,p,b,0,row),out=await C.applyCandidate(h,q,b,{preview:true});assert.equal(H.create(out.history).stats(ids[0]).count,3+delta);assert.deepEqual(out.history.results[0],row);}
 const row=[...h.results[0]];row[5]='49:99';await assert.rejects(async()=>C.applyCandidate(h,await edit(h,p,b,0,row),b,{preview:true}),/invalid-time/);
 row[5]='49:20';row[2]='Langmoro stafett';assert.equal(H.create((await C.applyCandidate(h,await edit(h,p,b,0,row),b,{preview:true})).history).stats(ids[0]).count,2);
});
test('C2.2 missing results need a source, duplicate removals are explicit and all changes remain memory-only',async()=>{
 const {h,b,p}=await setup(),row=[2026,ids[0],'Kortmoro','10 km','Fullført','48:00',1,'M','',''];const q=await edit(h,p,b,0,row,'add'),out=await C.applyCandidate(h,q,b,{preview:true});assert.equal(out.history.results.length,h.results.length+1);assert.equal(H.create(out.history).stats(ids[0]).count,4);assert.equal(H.create(h).stats(ids[0]).count,3);
 const noSource=structuredClone(q);noSource.cases[0].source='';assert.throws(()=>C.validatePackage(noSource),/kilde/);const duplicate=await edit(h,p,b,0,h.results[0],'add');await assert.rejects(()=>C.applyCandidate(h,duplicate,b,{preview:true}),/allerede/);
 const removed=await edit(h,p,b,0,null,'remove');assert.equal((await C.applyCandidate(h,removed,b,{preview:true})).history.results.length,h.results.length-1);
});
test('C2.2 portable packages round-trip deterministically, demote imported handoff approvals and reject duplicate-ID conflicts atomically',async()=>{
 const {h,b,p}=await setup(),q=await merge(h,p),first=C.parse(C.serialize(q));assert.deepEqual(first,q);assert.deepEqual((await C.applyCandidate(h,first,b,{preview:true})).history,(await C.applyCandidate(h,q,b,{preview:true})).history);
 const trusted=structuredClone(q);trusted.cases[0].status='handoff';const imported=C.importPackage(p,trusted);assert.equal(imported.package.cases[0].status,'proposed');assert.equal(C.importPackage(imported.package,first).duplicates,1);const conflicting=structuredClone(first);conflicting.cases[0].description='Annen lokal forklaring';assert.throws(()=>C.importPackage(imported.package,conflicting),/Konflikt/);assert.equal(imported.package.cases.length,1);
});
test('C2.2 exact hash/version and before-value guards reject stale, ambiguous, conflicting and malformed selectors',async()=>{
 const {h,b,p}=await setup(),q=await merge(h,p),wrong=structuredClone(q);wrong.base.historySha256='c'.repeat(64);await assert.rejects(()=>C.applyCandidate(h,wrong,b,{preview:true}),/Foreldet/);wrong.base={...b,dataVersion:99};await assert.rejects(()=>C.applyCandidate(h,wrong,b,{preview:true}),/Foreldet/);
 const changed=structuredClone(h);changed.people[0].n+=' Ny';await assert.rejects(()=>C.applyCandidate(changed,q,b,{preview:true}),/Foreldet/);
 const row=[...h.results[0]];row[5]='49:00';const e=await edit(h,p,b,0,row);delete e.cases[0].change.selector.index;assert.throws(()=>C.validatePackage(e),/felt/);
 const a=await edit(h,p,b,0,row);a.cases[0].change.before[5]='10:00';await assert.rejects(()=>C.applyCandidate(h,a,b,{preview:true}),/kildehash/);
});
test('C2.2 merge reversal is a separate traceable proposal and refuses guessed identity/result reconstruction',async()=>{
 const {h,b,p}=await setup(),q=await merge(h,p);let r=add(q,'reverse',ids.slice(0,2));r=await C.propose(h,r,'reverse',{kind:'reverse',personIds:ids.slice(0,2),reverses:'case-1',source:'Syntetisk reverseringskilde',reason:'Identiteten må deles tilbake'});const out=await C.applyCandidate(h,r,b,{preview:true});assert.deepEqual(out.history,h);assert.equal(out.journal.length,2);assert.equal(out.journal[1].reverses,'case-1');assert.equal(r.cases.length,2);
 const tamper=structuredClone(q);tamper.cases[0].change.before.ownership[0].row[1]=ids[2];await assert.rejects(()=>C.applyCandidate(h,tamper,b,{preview:true}),/tilhørighet/);
});
test('C2.2 result/add/remove/person reversals restore exact original values and leave the original audit events intact',async()=>{
 const {h,b,p}=await setup();for(const kind of ['result','add','remove','person','alias']){let q;
 if(kind==='person'||kind==='alias'){q=add(p,'change',[ids[0]]);q=await C.propose(h,q,'change',{kind,personIds:[ids[0]],after:kind==='person'?{n:'Syntetisk Nytt Navn'}:['Syntetisk Gammelt Etternavn','Syntetisk Ekstra'],source:'Syntetisk kilde',reason:'Syntetisk retting'});}
 else{const row=[...h.results[0]];row[5]='48:00';if(kind==='add')row[0]=2026;q=await edit(h,p,b,0,kind==='remove'?null:row,kind);}
 const original=q.cases[0];q=add(q,'reverse',original.personIds);q=await C.propose(h,q,'reverse',{kind:'reverse',personIds:original.personIds,reverses:original.id,source:'Syntetisk kilde',reason:'Kontrollert tilbakeføring'});assert.deepEqual((await C.applyCandidate(h,q,b,{preview:true})).history,h,kind);assert.equal(q.cases[0].events.length,2);
 }
});
test('C2.2 import refuses executable/unknown content, unsupported statuses, oversized/deep packages and forged public release claims',async()=>{
 const {p}=await setup();assert.throws(()=>C.parse('{'),/JSON/);assert.throws(()=>C.parse('x'.repeat(C.MAX_BYTES+1)),/2 MB/);for(const mutate of [x=>x.version=2,x=>x.privateToken='no',x=>x.cases.push({id:'a',status:'published'}),x=>x.base.dataVersion=-1]){const x=structuredClone(p);mutate(x);assert.throws(()=>C.parse(JSON.stringify(x)));}
 assert.throws(()=>C.parse(C.serialize(p).replace('"cases": []','"cases": [], "__proto__": {}')),/felt/);let q=add(p);q.cases[0].description='<img src=x onerror=alert(1)>';assert.throws(()=>C.parse(JSON.stringify(q)),/tekst/);assert.throws(()=>C.transition(p,'missing','published','Fake release'),/status/);
});
const project=async data=>{const m=H.create(data);return {people:Object.fromEntries([...m.people].map(([id,p])=>[id,{name:p.n,count:m.stats(id)?.count||0}])),annual:{},records:[],placements:data.results.map((r,index)=>({index,personId:m.resolve(r[1]),year:r[0],event:r[2],distance:r[3],className:r[7]||'',bib:r[9]||'',rank:m.classPlaces.get(r)??null,sourcePlace:H.sourcePlace(r)})),rankings:{},diplomas:{},loyalty:{},redirects:data.redirects||{},aliases:data.aliases||{}};};
test('C2.2 local handoff needs a current complete consequence report; unrelated package edits invalidate the report and imports cannot keep approval',async()=>{
 const {h,b,p}=await setup(),q=await merge(h,p);assert.throws(()=>C.transition(q,'case-1','handoff','Reviewed'),/konsekvens/);const impact=await C.consequences(h,q,'case-1',b,project);assert.equal(impact.ready,true);const approved=C.transition(q,'case-1','handoff',q.cases[0].reason,impact);assert.equal((await C.applyCandidate(h,approved,b)).journal.length,1);assert.equal(C.importPackage(p,approved).package.cases[0].status,'proposed');
 const edited=add(q,'new-case',[ids[4]]);assert.throws(()=>C.transition(edited,'case-1','handoff','Reviewed',impact),/konsekvens/);await assert.rejects(()=>C.consequences(h,q,'case-1',b,async()=>({people:{}})),/mangler/);
});
test('C2.2 affected Heder links, new ambiguous aliases and unsupported duplicate removals remain unresolved instead of authorizing handoff',async()=>{
 const {h,b,p}=await setup(),q=await merge(h,p),impact=await C.consequences(h,q,'case-1',b,project,{linkedRunnerIds:[ids[0]]});assert.equal(impact.ready,false);assert.match(impact.uncertain.join(' '),/Heder/);assert.throws(()=>C.transition(q,'case-1','handoff','Reviewed',impact),/konsekvens/);
 let a=add(p,'alias',[ids[0]]);a=await C.propose(h,a,'alias',{kind:'alias',personIds:[ids[0]],after:[h.people[2].n],source:'Syntetisk kilde',reason:'Må undersøkes'});assert.equal((await C.consequences(h,a,'alias',b,project)).ready,false);
 const removed=await edit(h,p,b,0,null,'remove');assert.match((await C.consequences(h,removed,'case-edit',b,project)).uncertain.join(' '),/dobbeltregistrering/);
});
test('C2.2 result reassignment names both affected canonical people and validates unknown result years and malformed source positions',async()=>{
 const {h,b,p}=await setup(),row=[...h.results[0]];row[1]=ids[4];const q=await edit(h,p,b,0,row);assert.deepEqual(q.cases[0].personIds,[ids[0],ids[4]]);const out=await C.applyCandidate(h,q,b,{preview:true});assert.equal(H.create(out.history).stats(ids[0]).count,2);assert.equal(H.create(out.history).stats(ids[4]).count,3);
 row[0]=2099;await assert.rejects(async()=>C.applyCandidate(h,await edit(h,p,b,0,row),b,{preview:true}),/arrangementsregisteret/);row[0]=2020;row[6]='bananas';await assert.rejects(async()=>C.applyCandidate(h,await edit(h,p,b,0,row),b,{preview:true}),/resultatfelt/);
});
test('C2.2 independent merge cases preserve one another, proposal snapshots do not alias input, and changed work invalidates old handoffs',async()=>{
 const {h}=await setup();h.results[6][0]=2026;const b=await C.binding(h,sample.meta);let q=await merge(h,C.empty(b));const original=JSON.stringify(h);q.cases[0].change.before.ownership[0].row[5]='mutated only in draft';assert.equal(JSON.stringify(h),original,'Proposal provenance must not alias original rows');q=await merge(h,C.empty(b));const impact=await C.consequences(h,q,'case-1',b,project);q=C.transition(q,'case-1','handoff',q.cases[0].reason,impact);
 q=add(q,'independent',ids.slice(2,4));q=await C.propose(h,q,'independent',{kind:'merge',personIds:ids.slice(2,4),source:'Syntetisk kilde',reason:'Uavhengig bekreftet identitet'});assert.equal(q.cases[0].status,'proposed','Changed active work requires new review');const out=await C.applyCandidate(h,q,b,{preview:true});assert.equal(H.create(out.history).resolve(ids[0]),ids[1]);assert.equal(H.create(out.history).resolve(ids[2]),ids[3]);assert.deepEqual(out.history.results,h.results);
 let r=add(q,'undo',ids.slice(0,2));r=await C.propose(h,r,'undo',{kind:'reverse',personIds:ids.slice(0,2),reverses:'case-1',source:'Syntetisk kilde',reason:'Tilbakefør første kandidatendring'});const reversed=await C.applyCandidate(h,r,b,{preview:true});assert.equal(H.create(reversed.history).resolve(ids[0]),ids[0]);assert.equal(H.create(reversed.history).resolve(ids[2]),ids[3]);
});
test('C2.2 approved retraction of an unapproved draft leaves exact source data unchanged and cannot reverse unrelated persons',async()=>{
 const {h,b,p}=await setup();let q=await merge(h,p);q=add(q,'undo',ids.slice(0,2));q=await C.propose(h,q,'undo',{kind:'reverse',personIds:ids.slice(0,2),reverses:'case-1',source:'Syntetisk kilde',reason:'Tilbaketrekking av ikke anvendt forslag'});const impact=await C.consequences(h,q,'undo',b,project);q=C.transition(q,'undo','handoff',q.cases[1].reason,impact);assert.deepEqual((await C.applyCandidate(h,q,b)).history,h);q.cases[1].personIds=[ids[4]];q.cases[1].change.personIds=[ids[4]];await assert.rejects(()=>C.applyCandidate(h,q,b),/andre personer/);
});
test('C2.2 start-list issues retain separate row references and source hash instead of collapsing different imported conflicts',async()=>{
 const {h}=await setup(),intake={year:2027,meta:{sourceSha256:'f'.repeat(64)},rows:[{id:'r1',line:1,name:'Syntetisk Navn En',match:{candidates:[]}},{id:'r2',line:2,name:'Syntetisk Navn To',match:{candidates:[]}}],reviewCases:[{rowIds:['r1'],message:'Uavklart identitet'},{rowIds:['r2'],message:'Uavklart identitet'}]};const list=C.discover(h,{intake}).filter(s=>s.category==='Startlistekontroll');assert.equal(list.length,2);assert.match(list[0].reason,/rad 1/);assert.match(list[1].reason,/rad 2/);assert.ok(list.every(s=>s.source.includes('f'.repeat(64))));
});
