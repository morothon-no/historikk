const {test}=require('node:test'),assert=require('node:assert/strict');
const I=require('../../../tools/diploma-admin/intake-model.js'),R=I.Results,C=I.Corrections,H=require('../../../js/history-data.js'),sample=require('./fixtures/results-data.js'),profile=require('../../../web-admin/event-profile.json'),registry=require('../../../public-data/data/badges.json');
const context=(h=sample.history(),extra={})=>I.createContext({history:h,profile,registry,...extra});
async function setup(text=sample.csv(),ctx=context(),year=2026,extra={}){const staged=R.parse(text),session=await R.createSession(ctx,staged,staged.mapping,{year,sourceSha256:await C.hash(text),meta:sample.meta,completeClaim:true,...extra});return {ctx,session,analysis:R.review(ctx,session),staged};}
function confirm(s,decisions,item,id,index){return R.decide(s.ctx,s.session,decisions,item.id,{action:'confirm',runnerId:id,targetIndex:index,reason:'Kontrollert mot syntetisk arrangørkilde.'});}

test('C2.3a CSV minimum format reuses strict byte/quote limits, supports manual mapping and separate names, and never accepts start-list XML as results',async()=>{
 const s=await setup();assert.equal(s.session.rows.length,9);assert.ok(s.session.rows.every(r=>!r.errors.length));assert.equal(s.staged.kind,'result-staging');
 assert.throws(()=>R.parse('<StartList/>'),/CSV/);assert.throws(()=>R.parse('a;b\n"bad;b'),/uavsluttet/);assert.throws(()=>I.decode(Uint8Array.from([0,1,0,2])),/tekstfil/);
 const text='Fornavn;Etternavn;Løp;km;Sluttid;Resultatstatus\nSyntetisk Asmund;Steinvik;Kortmoro;10 km;1:08:51;Fullført',staged=R.parse(text);staged.mapping.event=2;
 const rows=R.importedRows(s.ctx,staged,staged.mapping,2026);assert.equal(rows[0].name,'Syntetisk Asmund Steinvik');assert.equal(rows[0].time,'1:08:51');assert.deepEqual(rows[0].errors,[]);
 const duplicate={...staged.mapping,time:staged.mapping.event};assert.throws(()=>R.importedRows(s.ctx,staged,duplicate,2026),/flere resultatfelt/);
});
test('C2.3a start lists and invalid results cannot masquerade as final results; legitimate untimed completion, DNS and DNF have no validation errors',async()=>{
 const ctx=context();for(const text of ['Navn;Øvelse;Distanse\nSyntetisk Person;Kortmoro;10 km','Navn;Øvelse;Distanse;Starttid\nSyntetisk Person;Kortmoro;10 km;12:00:00']){const stage=R.parse(text);assert.throws(()=>R.importedRows(ctx,stage,stage.mapping,2026),/startliste/);}
 for(const text of ['Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Person;Kortmoro;10 km;Påmeldt;','Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Person;Kortmoro;10 km;Fullført;49:99','Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Person;Kortmoro;10 km;DNS;DNF','Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Person;Kortmoro;-10 km;Fullført;49:00']){const stage=R.parse(text);assert.ok(R.importedRows(ctx,stage,stage.mapping,2026)[0].errors.length);}
 const s=await setup();for(const index of [2,3,4,8,9])assert.equal(s.analysis.items.find(i=>i.beforeIndex===index)?.category,'unchanged');
});
test('C2.3a exact result reimport creates zero changes and zero correction cases without asking to approve unchanged rows',async()=>{
 const s=await setup();assert.equal(s.analysis.counts.unchanged,9);for(const key of ['changed','new','missing','uncertain','conflict'])assert.equal(s.analysis.counts[key],0);assert.equal(s.analysis.completeness,'apparent-complete');assert.equal(s.analysis.pending,0);assert.equal((await R.prepare(s.ctx,s.session,new Map())).cases.length,0);
});
test('C2.3a synthetic swapped times and wrong event/distance pair by year, bib and supported name without creating people',async()=>{
 const s=await setup(sample.csv(sample.corrected()));assert.equal(s.analysis.counts.changed,2);assert.equal(s.analysis.counts.new,0);assert.equal(s.analysis.counts.missing,0);
 const changed=s.analysis.items.filter(i=>i.category==='changed');assert.deepEqual(changed.map(i=>i.beforeIndex),[0,1]);assert.deepEqual(changed[0].differences.map(d=>d.field),['event','distance','time']);assert.deepEqual(changed[1].differences.map(d=>d.field),['time']);
 let decisions=new Map();for(const item of changed)decisions=confirm(s,decisions,item,item.before[1],item.beforeIndex);
 const packet=await R.prepare(s.ctx,s.session,decisions),candidate=await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true});assert.deepEqual(candidate.history.people,s.ctx.model.data.people);assert.equal(candidate.history.results.length,10);assert.deepEqual(candidate.history.results.slice(0,2),sample.corrected().results.slice(0,2));assert.equal(C.parse(C.serialize(packet)).cases.length,2);
});
test('C2.3a uses approved aliases and redirects without normalizing stored ownership or treating nearby years as identity evidence',async()=>{
 const h=sample.history();h.results[0][1]='MOR-R23OLD';const changed=structuredClone(h);changed.results[0][8]='Syntetisk oppdatert klubb';let text=sample.csv(changed).replace('Syntetisk Asmund Steinvik','Syntetisk Asmund Gammelt');const s=await setup(text,context(h)),item=s.analysis.items.find(i=>i.beforeIndex===0);assert.equal(item.category,'changed');assert.equal(item.after[1],'MOR-R23OLD');
 const other=await setup('Navn;Startnummer;Øvelse;Distanse;Status;Tid\nSyntetisk Asmund Heltannet;999;Kortmoro;10 km;Fullført;50:00');assert.equal(other.analysis.items.find(i=>i.row)?.candidates.length,0);assert.equal(other.analysis.items.find(i=>i.row)?.category,'new');
});
test('C2.3a identical names remain distinct; a bib supports only this result pair and ambiguity requires an explicit target',async()=>{
 const s=await setup();assert.deepEqual(s.analysis.items.filter(i=>[5,6].includes(i.beforeIndex)).map(i=>i.category),['unchanged','unchanged']);
 const text='Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Lik Person;Kortmoro;10 km;Fullført;51:00',ambiguous=await setup(text),item=ambiguous.analysis.items.find(i=>i.row);assert.equal(item.category,'uncertain');assert.equal(item.beforeIndex,null);assert.equal(item.candidates.length,2);
 const choices=confirm(ambiguous,new Map(),item,sample.ids[5],5),packet=await R.prepare(ambiguous.ctx,ambiguous.session,choices);assert.equal(packet.cases[0].change.selector.index,5);assert.equal(packet.cases[0].change.kind,'result');assert.deepEqual((await C.applyCandidate(ambiguous.ctx.model.data,packet,ambiguous.session.base,{preview:true})).history.people,sample.history().people);
});
test('C2.3a incompatible bibs/external IDs block preparation while two compatible starts retain one annual participation',async()=>{
 const base=sample.corrected(),rows=base.results.slice(0,2);rows[1][9]='301';const clash=await setup(sample.csv(base,rows));assert.equal(clash.analysis.counts.conflict,2);const item=clash.analysis.items.find(i=>i.row);assert.throws(()=>confirm(clash,new Map(),item,sample.ids[0],0),/Kildekonflikt/);
 const h=sample.history();h.results.push([2026,sample.ids[0],'Morothon','20 km','Fullført','2:00:00',1,'Herrer','Syntetisk klubb A','301']);const s=await setup(sample.csv(h),context(h));assert.equal(s.analysis.counts.conflict,0);assert.equal(s.analysis.counts.unchanged,10);assert.equal(H.participationYears(s.ctx.model.resultsFor(sample.ids[0])).length,1);
 const wrong='Navn;Startnummer;Øvelse;Distanse;Status;Tid\nSyntetisk Heltannen Person;301;Kortmoro;10 km;Fullført;50:00';assert.equal((await setup(wrong)).analysis.counts.conflict,1);
 const supported=await setup(sample.csv(sample.corrected())),paired=supported.analysis.items.find(i=>i.beforeIndex===0);assert.throws(()=>confirm(supported,new Map(),paired,sample.ids[1],1),/annen person/);
});
test('C2.3a scoped documented external IDs are respected and never transplanted across providers',async()=>{
 const externalLinks=[{sourceScope:'synthetic-source-A',athleteId:'EXT-1',runnerId:sample.ids[0],confirmed:true,evidence:'Syntetisk kilde'}],ctx=context(sample.history(),{externalLinks}),text='Navn;Utøver-ID;Øvelse;Distanse;Status;Tid\nSyntetisk Asmund Steinvik;EXT-1;Kortmoro;10 km;Fullført;1:08:51';
 const s=await setup(text,ctx,2026,{sourceScope:'synthetic-source-A'});assert.equal(s.analysis.counts.unchanged,1);assert.equal(ctx.externalRunner('synthetic-source-B','EXT-1'),null);
 const bad=await setup(text.replace('Syntetisk Asmund Steinvik','Syntetisk Bjarne Skogdal'),ctx,2026,{sourceScope:'synthetic-source-A'});assert.equal(bad.analysis.counts.conflict,1);
});
test('C2.3a missing results are control items, never deletes; rejection and defer preserve every original row',async()=>{
 const s=await setup(sample.csv(sample.history(),sample.history().results.slice(0,1)));assert.equal(s.analysis.counts.missing,8);assert.equal(s.analysis.completeness,'partial');assert.equal((await R.prepare(s.ctx,s.session,new Map())).cases.length,0);
 const item=s.analysis.items.find(i=>i.category==='missing'),decisions=R.decide(s.ctx,s.session,new Map(),item.id,{action:'reject',reason:'Syntetisk eksport er filtrert, behold historikken.'}),packet=await R.prepare(s.ctx,s.session,decisions);assert.equal(packet.cases[0].change,null);assert.equal(packet.cases[0].status,'rejected');assert.deepEqual((await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true})).history,s.ctx.model.data);
});
test('C2.3a new existing-person results use the correction add contract; new people and relay teams remain separate control records',async()=>{
 const h=sample.history(),row=[2026,sample.ids[7],'Kortmoro','10 km','DNF','DNF',null,'Herrer','','701'],s=await setup(sample.csv(h,[row])),item=s.analysis.items.find(i=>i.row);assert.equal(item.category,'new');const decisions=confirm(s,new Map(),item,sample.ids[7],null),packet=await R.prepare(s.ctx,s.session,decisions);assert.equal(packet.cases[0].change.kind,'add');const after=(await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true})).history;assert.equal(H.create(after).stats(sample.ids[7]).count,2);
 const fresh=await setup('Navn;Startnummer;Øvelse;Distanse;Status;Tid\nSyntetisk Heltfersk Nordberg;999;Kortmoro;10 km;Fullført;50:00'),person=fresh.analysis.items.find(i=>i.row),choice=R.decide(fresh.ctx,fresh.session,new Map(),person.id,{action:'new',reason:'Syntetisk kilde bekrefter ny person.'}),p=await R.prepare(fresh.ctx,fresh.session,choice);assert.equal(p.cases[0].status,'review');assert.equal(p.cases[0].change,null);
 const relay=await setup('Navn;Øvelse;Distanse;Status;Tid\nSyntetisk Lag;Langmoro stafett;;Fullført;2:20:00');assert.equal(relay.analysis.counts.relay,1);assert.equal(relay.analysis.pending,relay.analysis.counts.missing);assert.equal((await R.prepare(relay.ctx,relay.session,new Map())).cases.length,0);assert.ok(relay.analysis.items.find(i=>i.category==='relay').row.relay);
 const relayClass=await setup('Navn;Øvelse;Distanse;Klasse;Status;Tid\nSyntetisk Lag;Morothon;20 km;Stafett;Fullført;2:20:00');assert.equal(relayClass.analysis.counts.relay,1);assert.equal((await R.prepare(relayClass.ctx,relayClass.session,new Map())).cases.length,0);
});
test('C2.3a changed sources, interpretation and history invalidate decisions; correction export binds exact row, source SHA and approved data version',async()=>{
 const s=await setup(sample.csv(sample.corrected())),item=s.analysis.items.find(i=>i.category==='changed'),decisions=confirm(s,new Map(),item,sample.ids[0],0),packet=await R.prepare(s.ctx,s.session,decisions),c=packet.cases[0];assert.equal(packet.base.dataVersion,2);assert.equal(c.change.selector.rowSha256,await C.hash(s.ctx.model.data.results[0]));assert.match(c.source,new RegExp(s.session.source.sha256));assert.match(c.source,new RegExp(s.session.key));assert.ok(c.events.some(e=>e.action==='result-source-'+s.session.source.sha256));
 const again=await R.prepare(s.ctx,s.session,decisions);assert.equal(C.importPackage(packet,again).duplicates,1);const report=JSON.parse(await R.report(s.ctx,s.session,decisions));assert.equal(await C.hash({base:report.base,source:report.source,mapping:report.mapping,rows:report.items.filter(i=>i.row).map(i=>i.row)}),report.interpretationSha256);
 const next=await setup(sample.csv(sample.corrected())+'\n');assert.throws(()=>R.review(next.ctx,next.session,decisions),/beslutning|grunnlag|fil/);
 const altered=structuredClone(s.session);altered.rows[0].time='2:00:00';await assert.rejects(()=>R.prepare(s.ctx,altered,decisions),/endret/);
 s.ctx.model.data.results[0][5]='1:00:00';await assert.rejects(()=>R.prepare(s.ctx,s.session,decisions),/endret/);
});
test('C2.3a a not-yet-approved new year exports a review case, not an incomplete automatic year/statistics update',async()=>{
 const h=sample.history(),row=[2027,sample.ids[0],'Kortmoro','10 km','Fullført','50:00',1,'Herrer','','301'],s=await setup(sample.csv(h,[row]),context(h),2027),item=s.analysis.items.find(i=>i.row),decisions=confirm(s,new Map(),item,sample.ids[0],null),packet=await R.prepare(s.ctx,s.session,decisions);assert.equal(packet.cases[0].status,'review');assert.equal(packet.cases[0].change,null);assert.deepEqual((await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true})).history,h);assert.match(await R.report(s.ctx,s.session,decisions),/morothon-results-review-v1/);
});
