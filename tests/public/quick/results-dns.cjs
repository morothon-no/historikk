// Every name, source identifier and row below is fictional.
const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../../../tools/diploma-admin/intake-model.js'),R=I.Results,C=I.Corrections,H=require('../../../js/history-data.js'),F=require('./fixtures/results-data.js'),profile=require('../../../web-admin/event-profile.json'),registry=require('../../../public-data/data/badges.json');
const context=(history=F.history(),extra={})=>I.createContext({history,profile,registry,...extra});
async function setup(text,history=F.history(),extra={}){const ctx=context(history,extra),staged=R.parse(text),session=await R.createSession(ctx,staged,staged.mapping,{year:2026,sourceSha256:await C.hash(text),meta:F.meta,completeClaim:true,...extra});return {ctx,session,a:R.review(ctx,session)};}
const source=(name,status='DNS',bib='',event='Kortmoro',distance='10 km',time=status)=>`Name;Bib;Race;Distance;Status;Time\n${name};${bib};${event};${distance};${status};${time}`;
test('C2.3d unmatched DNS is information, never a new person/result or a correction decision; valid DNF is still participation',async()=>{
 const s=await setup(source('Syntetisk Ustartet Utøver')),item=s.a.items.find(i=>i.row);assert.equal(item.category,'dns');assert.equal(item.newType,null);assert.equal(s.a.counts.new,0);assert.equal(s.a.counts.dns,1);assert.equal(s.a.pending,s.a.counts.missing);assert.equal(R.needsAttention(item),false);assert.equal((await R.prepare(s.ctx,s.session,new Map())).cases.length,0);assert.throws(()=>R.decide(s.ctx,s.session,new Map(),item.id,{action:'confirm',runnerId:F.ids[7],targetIndex:null,reason:'Syntetisk kontroll'}),/DNS/);
 const d=await setup(source('Syntetisk Nyutøver Annen','DNF')),r=d.a.items.find(i=>i.row);assert.equal(r.category,'new');assert.equal(r.newType,'person');assert.equal(H.countsAsParticipation([2026,'','','','DNF','DNF']),true);
 const z=await setup(source('Syntetisk Ustartet Utøver','DNS','','Kortmoro','10 km','00:00:00'));assert.equal(z.a.counts.dns,1);
 const timed=await setup(source('Syntetisk Nyutøver Annen','DNF','','Kortmoro','10 km','1:23:45'));assert.equal(timed.session.rows[0].time,'DNF');assert.equal(timed.session.rows[0].sourceTime,'1:23:45');assert.equal(timed.a.items.find(i=>i.row).category,'new');
});
test('C2.3d DNS contradicting a completion, DNF or untimed participation remains a source conflict, including changed exercise with a supported bib',async()=>{
 for(const [index,bib,event,distance]of [[0,'301','Kortmoro','10 km'],[2,'401','Morothon','20 km'],[4,'403','Morothon','20 km'],[0,'301','Morothon','20 km']]){const h=F.history(),name=h.people.find(p=>p.i===h.results[index][1]).n,s=await setup(source(name,'DNS',bib,event,distance)),item=s.a.items.find(i=>i.row);assert.equal(item.category,'conflict');assert.equal(item.conflictType,'source');assert.equal(item.blocking,true);assert.equal(item.beforeIndex,index);assert.match(item.reason,/dokumentert start/);assert.throws(()=>R.decide(s.ctx,s.session,new Map(),item.id,{action:'confirm',runnerId:h.results[index][1],targetIndex:index,reason:'Syntetisk kontroll'}),/Kildekonflikt/);}
 const broken=await setup(source('Syntetisk Ustartet Utøver','DNS','','Kortmoro','10 km','50:00'));assert.equal(broken.a.counts.unassessable,1);assert.match(broken.a.items.find(i=>i.row).reason,/positiv sluttid/);
 const other=await setup(source('Syntetisk Asmund Steinvik','DNS','777','Morothon','20 km'));assert.equal(other.a.counts.dns,1,'DNS in another exercise does not erase a documented start');assert.equal(other.a.counts.missing,9);
 const explicitOther=await setup(`Name;Morothon-ID;Race;Distance;Status;Time\nSyntetisk Asmund Steinvik;${F.ids[0]};Morothon;20 km;DNS;DNS`);assert.equal(explicitOther.a.counts.dns,1);assert.equal(explicitOther.a.counts.missing,9);assert.equal(explicitOther.a.items.find(i=>i.row).beforeIndex,null,'A person ID cannot let an informational DNS claim a start in another exercise');
});
test('C2.3d separates a proposed existing-runner addition from a new identity and leaves uncertain name-only variants for manual control',async()=>{
 const s=await setup(source('Syntetisk Edda Tillegg','DNF','701'));let item=s.a.items.find(i=>i.row);assert.equal(item.category,'new');assert.equal(item.newType,'result');let decisions=R.decide(s.ctx,s.session,new Map(),item.id,{action:'confirm',runnerId:F.ids[7],targetIndex:null,reason:'Bekreftet syntetisk person og ny start.'}),packet=await R.prepare(s.ctx,s.session,decisions);assert.equal(packet.cases[0].change.kind,'add');assert.equal(H.create((await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true})).history).stats(F.ids[7]).count,2);
 const fresh=await setup(source('Syntetisk Ukjent Annenfamilie','Fullført','901','Kortmoro','10 km','50:00'));assert.equal(fresh.a.items.find(i=>i.row).newType,'person');
 const variant=await setup(source('Syntetisk Edda Tillegr','Fullført','901','Kortmoro','10 km','50:00'));assert.equal(variant.a.items.find(i=>i.row).category,'uncertain');assert.equal((await R.prepare(variant.ctx,variant.session,new Map())).cases.length,0);
});
test('C2.3d known bib/name corrections retain exact result identity across exercise, distance and time changes, without changing people',async()=>{
 const s=await setup(F.csv(F.corrected())),items=s.a.items.filter(i=>i.category==='changed');assert.deepEqual(items.map(i=>i.beforeIndex),[0,1]);assert.deepEqual(items[0].differences.map(d=>d.field),['event','distance','time']);assert.deepEqual(items[1].differences.map(d=>d.field),['time']);let ds=new Map();for(const item of items)ds=R.decide(s.ctx,s.session,ds,item.id,{action:'confirm',runnerId:item.before[1],targetIndex:item.beforeIndex,reason:'Syntetisk kilde dokumenterer rettelsen.'});const packet=await R.prepare(s.ctx,s.session,ds),after=await C.applyCandidate(s.ctx.model.data,packet,s.session.base,{preview:true});assert.deepEqual(after.history.people,F.history().people);assert.deepEqual(after.history.results.slice(0,2),F.corrected().results.slice(0,2));
 const idText=`Name;Morothon-ID;Race;Distance;Status;Time\nSyntetisk Asmund Steinvik;${F.ids[0]};Morothon;20 km;Fullført;2:07:14`,r=await setup(idText);assert.equal(r.a.counts.changed,1);assert.equal(r.a.items.find(i=>i.row).beforeIndex,0);assert.equal(r.a.items.some(i=>i.id==='missing-0'),false);
});
test('C2.3d distinguishes result-selection uncertainty from identity and ties its historical rows to one case instead of reporting separate missing results',async()=>{
 const s=await setup(source('Syntetisk Asmund Steinvik','Fullført','','Morothon','20 km','2:07:14')),item=s.a.items.find(i=>i.row),linked=s.a.items.find(i=>i.beforeIndex===0);assert.equal(item.category,'registration');assert.equal(s.a.counts.uncertain,0);assert.equal(linked.category,'unlinked');assert.deepEqual(linked.relatedItemIds,[item.id]);assert.equal(R.needsAttention(linked),false);assert.equal(s.a.pending,s.a.counts.missing+1);
 const ds=R.decide(s.ctx,s.session,new Map(),item.id,{action:'confirm',runnerId:F.ids[0],targetIndex:0,reason:'Syntetisk kilde bekrefter at øvelse og tid var feil.'}),a=R.review(s.ctx,s.session,ds);assert.equal(a.counts.unlinked,0);assert.equal(a.counts.changed,1);assert.equal(a.items.some(i=>i.id==='missing-0'),false);
 const h=F.history();h.results.push([2026,F.ids[0],'Morothon','20 km','DNF','DNF',null,'Herrer','','701']);const multiple=await setup(source('Syntetisk Asmund Steinvik','Fullført','','Kortmoro','9 km','49:00'),h),m=multiple.a.items.find(i=>i.row);assert.equal(m.category,'registration');assert.equal(multiple.a.counts.unlinked,2);assert.equal((await R.prepare(multiple.ctx,multiple.session,new Map())).cases.length,0);
});
test('C2.3d synthetic 454-row observed totals yield 52 DNS information rows and preserve a real name review; a fully supported version leaves only two tasks',async()=>{
 for(const ambiguous of [true,false]){const f=F.reconciliation454({ambiguous}),s=await setup(f.text,f.history);assert.equal(s.a.read,454);assert.equal(s.a.existing,398);assert.equal(s.a.counts.dns,52);assert.equal(s.a.counts.changed,2);assert.equal(s.a.counts.new,0);assert.equal(s.a.counts.relay,4);assert.equal(s.a.counts.unchanged,ambiguous?395:396);assert.equal(s.a.counts.uncertain,ambiguous?1:0);assert.equal(s.a.counts.unlinked,ambiguous?1:0);assert.equal(s.a.counts.missing,0);assert.equal(s.a.pending,ambiguous?3:2);assert.equal((await R.prepare(s.ctx,s.session,new Map())).cases.length,0);assert.deepEqual(s.ctx.model.data,f.history);}
});
test('C2.3d does not assume all 52 extra source records are DNS; real new finishes, invalid rows and partial exports remain visible on reimport',async()=>{
 const f=F.reconciliation454(),lines=f.text.split('\r\n');lines[399]=lines[399].replace('"DNS";"DNS"','"Fullført";"51:00"');const mixed=await setup(lines.join('\r\n'),f.history);assert.equal(mixed.a.counts.dns,51);assert.equal(mixed.a.counts.new,1);assert.equal(mixed.a.pending,3);const again=await setup(lines.join('\r\n'),f.history);assert.deepEqual(again.a.counts,mixed.a.counts);
 const h=F.history(),partial=await setup(F.csv(h,h.results.slice(0,1)));assert.equal(partial.a.counts.missing,8);assert.equal(partial.a.completeness,'partial');const ds=R.decide(partial.ctx,partial.session,new Map(),partial.a.items.find(i=>i.category==='missing').id,{action:'reject',reason:'Syntetisk eksport er filtrert; behold registreringen.'}),packet=await R.prepare(partial.ctx,partial.session,ds);assert.deepEqual((await C.applyCandidate(h,packet,partial.session.base,{preview:true})).history,h);
});

test('C2.3e DNF never gains an official place in the profile or imported result, even with a provider gender rank',async()=>{
 const h=F.history();h.results[2][6]=7; // Legacy nonfinish rank; preserve old source bytes, do not show the rank.
 assert.equal(H.effectiveStatus(h.results[2]),'DNF');
 assert.equal(H.sourcePlace(h.results[2]),null,'legacy DNF must not display numeric source placement');
 assert.equal(H.create(h).stats(F.ids[2]).sourceResults.length,0,'DNF must not award wins or podiums');
 const text='Name;Bib;Race;Distance;Status;Time;Rank Gender\nSyntetisk Frida Bruddvik;401;Morothon;20 km;DNF;DNF;7';
 const ctx=context(h),stage=R.parse(text),inspection=R.inspect(ctx,stage,2026);
 assert.equal(stage.mapping.place,6);
 assert.equal(inspection.ready,true);
 assert.equal(inspection.rows[0].sourcePlace,'7','provider token retained only for source inspection');
 assert.equal(inspection.rows[0].place,'','no placement in imported result row');
 assert.equal(inspection.rows[0].present.place,false,'nonfinish rank must not overwrite historic result');
 assert.ok(inspection.rows[0].warnings.some(w=>w.includes('Plasseringen er utelatt')));
 const session=await R.createSession(ctx,stage,stage.mapping,{year:2026,sourceSha256:await C.hash(text),meta:F.meta});
 const review=R.review(ctx,session);
 assert.equal(review.counts.unchanged,1,'legacy source rank must not generate a false correction');
 assert.equal(review.items.find(i=>i.row)?.after?.[6],7,'existing raw source value is preserved until separately corrected');
 const publicSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../../index.html'),'utf8');
 assert.match(publicSource,/function sourcePlaceLabel\(r\)\{const n=MorothonHistoryData\.sourcePlace\(r\)/,'profile and year result display must use status-aware rank');
 for(const status of ['DNS','DNF','Disket']){
  assert.equal(H.sourcePlace([2026,F.ids[2],'Morothon','20 km',status,status,1,'Herrer','','401']),null);
 }
});
