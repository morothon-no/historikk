const {test}=require('node:test'),assert=require('node:assert/strict');
const I=require('../../../tools/diploma-admin/intake-model.js'),R=I.Results,C=I.Corrections,fixture=require('./fixtures/results-data.js'),profile=require('../../../web-admin/event-profile.json'),registry=require('../../../public-data/data/badges.json');
const context=(history=fixture.history())=>I.createContext({history,profile,registry});
async function session(text,ctx=context(),year=2026,options={}){const stage=R.parse(text);return {ctx,stage,session:await R.createSession(ctx,stage,stage.mapping,{year,sourceSha256:await C.hash(text),meta:fixture.meta,...options})};}

test('C2.3b interprets all 454 synthetic rows with observed header positions, combined events and DNS/DNF/DQ without per-row approval',async()=>{
 const f=fixture.scenario454(),ctx=context(f.history),stage=R.parse(f.text),before=JSON.stringify(f.history);
 assert.deepEqual(['place','firstName','lastName','gender','club','event','className'].map(k=>stage.mapping[k]),[0,2,3,4,6,7,8]);
 const inspection=R.inspect(ctx,stage,2026);assert.equal(inspection.ready,true);assert.equal(inspection.rows.length,454);assert.ok(inspection.rows.every(r=>!r.errors.length));assert.deepEqual(inspection.rows.slice(1,4).map(r=>r.status),['DNS','DNF','Disket']);
 const s=await session(f.text,ctx),a=R.review(ctx,s.session);assert.equal(a.counts.unchanged,454);assert.equal(a.pending,0);assert.equal(a.completeness,'uncertain');assert.equal((await R.prepare(ctx,s.session,new Map())).cases.length,0);assert.equal(JSON.stringify(f.history),before);
});
test('C2.3b missing result data produces one actionable explanation, not 454 fabricated conflict cases',()=>{
 const f=fixture.scenario454({result:false}),ctx=context(f.history),stage=R.parse(f.text),a=R.inspect(ctx,stage,2026);assert.equal(a.ready,false);assert.equal(a.issues.length,1);assert.match(a.issues[0],/sluttid.*resultatstatus/);assert.equal(a.rows.length,0);assert.throws(()=>R.importedRows(ctx,stage,stage.mapping,2026),/startliste/);
});
test('C2.3b named events use one explicit confirmation per year-course group, never modern profile distances',async()=>{
 const h=fixture.history();h.results[0][0]=2010;h.results[0][3]='9 km';h.yearStats.push([2010,0]);const ctx=context(h),text='Name;Race;Finish\nSyntetisk Asmund Steinvik;Kortmoro;1:08:51',stage=R.parse(text),a=R.inspect(ctx,stage,2010);
 assert.equal(a.ready,false);assert.equal(a.groups.length,1);assert.deepEqual(a.groups[0].options.map(o=>o.value),['9 km']);
 const opts={profileChoices:{[a.groups[0].id]:'9 km'}},s=await session(text,ctx,2010,opts);assert.equal(s.session.rows[0].distance,'9 km');assert.equal(R.review(ctx,s.session).counts.unchanged,1);assert.equal(s.session.rows[0].inference[0].year,2010);
 const future=R.inspect(ctx,stage,2027);assert.equal(future.groups.length,0);assert.ok(future.rows[0].errors.some(e=>/Ingen sikker/.test(e)));assert.equal(R.review(ctx,(await session(text,ctx,2027)).session).counts.unassessable,1);
});
test('C2.3b 454 rows without source distance require two bulk confirmations, not one question per runner',()=>{
 const f=fixture.scenario454({combined:false}),ctx=context(f.history),stage=R.parse(f.text),a=R.inspect(ctx,stage,2026);assert.equal(a.groups.length,2);assert.equal(a.ready,false);
 const choices=Object.fromEntries(a.groups.map(g=>[g.id,g.options[0].value])),b=R.inspect(ctx,stage,2026,{profileChoices:choices});assert.equal(b.ready,true);assert.equal(b.rows.length,454);assert.ok(b.rows.every(r=>!r.errors.length));
});
test('C2.3b explicit historical distances prevail; conflicting source fields and multiple year-course lengths are not guessed',async()=>{
 const h=fixture.history();h.results.push([2010,fixture.ids[0],'Kortmoro','9 km','Fullført','50:00',1,'','',''],[2010,fixture.ids[1],'Kortmoro','8 km','Fullført','50:00',2,'','','']);h.yearStats.push([2010,0]);const ctx=context(h);
 const s=await session('Navn;Øvelse;Sluttid\nSyntetisk Asmund Steinvik;Kortmoro 9 km;50:00',ctx,2010);assert.equal(s.session.rows[0].distance,'9 km');assert.deepEqual(s.session.rows[0].errors,[]);
 const st=R.parse('Navn;Øvelse;Sluttid\nSyntetisk Asmund Steinvik;Kortmoro;50:00'),a=R.inspect(ctx,st,2010);assert.equal(a.groups[0].options.length,2);assert.equal(a.ready,false);
 const clash=await session('Navn;Øvelse;Distanse;Time\nSyntetisk Asmund Steinvik;Kortmoro 9 km;10 km;50:00',ctx,2010);assert.ok(clash.session.rows[0].errors.some(e=>/ulike/.test(e)));assert.equal(R.review(ctx,clash.session).counts.unassessable,1);
});
test('C2.3b supports CSV comma/semicolon, TSV, UTF-8/UTF-16/Windows-1252 and column reordering using the existing parser',async()=>{
 for(const separator of [',',';','\t']){
  const text=[['Finish','Distance','Name'],['50:00','Kortmoro 10 km','Syntetisk Åse Eksempel']].map(r=>r.join(separator)).join('\r\n');
  const encodings=[Buffer.from(text),Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')]),Buffer.from(text,'latin1')];
  for(const bytes of encodings){const decoded=I.decode(bytes),s=await session(decoded.text);assert.equal(s.session.rows[0].name,'Syntetisk Åse Eksempel');assert.equal(s.session.rows[0].event,'Kortmoro');assert.equal(s.session.rows[0].distance,'10 km');assert.deepEqual(s.session.rows[0].errors,[]);}
 }
});
test('C2.3b header ambiguity and unlabelled duration content require one explicit choice, while start-clock and rank columns are never finish results',()=>{
 const ctx=context(),stage=R.parse('Name;Race;Time;Result\nSyntetisk Eksempel;Kortmoro 10 km;50:00;51:00'),a=R.inspect(ctx,stage,2026);assert.equal(a.ready,false);assert.equal(a.choices.length,1);assert.equal(a.choices[0].options.length,2);
 const mapping={...stage.mapping,time:2};assert.equal(R.inspect(ctx,stage,2026,{mapping,manual:true}).ready,true);
 const unknown=R.parse('Name;Race;Ukjent felt\nSyntetisk Eksempel;Kortmoro 10 km;50:00'),b=R.inspect(ctx,unknown,2026);assert.equal(b.ready,false);assert.equal(b.choices[0].key,'time');assert.equal(b.choices[0].options[0].value,'2');
 for(const column of ['Starttid','Start time','Split','Rank']){const t=R.parse('Name;Race;'+column+'\nSyntetisk Eksempel;Kortmoro 10 km;'+(column==='Rank'?'12':'12:00:00'));assert.equal(R.inspect(ctx,t,2026).ready,false);assert.equal(t.mapping.time,-1);assert.equal(t.detection.candidates.time.length,0);}
});
test('C2.3b units are explicit or confirmed once; meters normalize without deforming historical race lengths',async()=>{
 for(const [header,value,expected]of [['km','9,5','9.5 km'],['Meters','9500','9.5 km'],['Distance','9500 m','9.5 km']]){
  const s=await session('Name;Event;'+header+';Time\nSyntetisk Eksempel;Kortmoro;"'+value+'";50:00');assert.equal(s.session.rows[0].distance,expected);assert.deepEqual(s.session.rows[0].errors,[]);
 }
 const stage=R.parse('Name;Race;Distance;Time\nSyntetisk Eksempel;Kortmoro;10000;50:00'),ctx=context(),a=R.inspect(ctx,stage,2026);assert.equal(a.groups.length,1);assert.equal(a.ready,false);const b=R.inspect(ctx,stage,2026,{profileChoices:{[a.groups[0].id]:'m'}});assert.equal(b.rows[0].distance,'10 km');assert.deepEqual(b.rows[0].errors,[]);
});
test('C2.3b absent optional columns preserve metadata; readable files with invalid results are distinct from identity ambiguity',async()=>{
 const s=await session('Name;Race;Result\nSyntetisk Asmund Steinvik;Kortmoro 10 km;1:08:51');assert.equal(R.review(s.ctx,s.session).counts.unchanged,1);assert.equal(s.session.rows[0].present.club,false);assert.equal(s.session.rows[0].present.place,false);
 const a=await session('Name;Race;Result\nSyntetisk Lik Person;Kortmoro 10 km;51:00\nSyntetisk Annen Person;Kortmoro 10 km;49:99');const review=R.review(a.ctx,a.session);assert.equal(review.counts.uncertain,1);assert.equal(review.counts.unassessable,1);assert.equal(review.items.find(i=>i.row?.errors.length).blocking,true);assert.equal((await R.prepare(a.ctx,a.session,new Map())).cases.length,0);
});
test('C2.3b inferred course choices remain bound to the source interpretation and cannot carry decisions to changed data',async()=>{
 const text='Name;Race;Time\nSyntetisk Asmund Steinvik;Kortmoro;1:09:00',ctx=context(),stage=R.parse(text),a=R.inspect(ctx,stage,2026),s=await session(text,ctx,2026,{profileChoices:{[a.groups[0].id]:'10 km'}}),item=R.review(ctx,s.session).items.find(i=>i.row);
 const decisions=R.decide(ctx,s.session,new Map(),item.id,{action:'confirm',runnerId:fixture.ids[0],targetIndex:0,reason:'Kontrollert syntetisk kilde og årsspesifikk øvelse.'}),packet=await R.prepare(ctx,s.session,decisions);assert.equal(packet.cases.length,1);assert.equal(packet.cases[0].change.selector.index,0);
 const modified=structuredClone(s.session);modified.rows[0].inference[0].year=2025;await assert.rejects(()=>R.prepare(ctx,modified,decisions),/endret/);assert.deepEqual(ctx.model.data,fixture.history());
});
test('C2.3b preserves explicit historical untimed participation and equivalent raw distance formatting during a time-only correction',async()=>{
 const h=fixture.history();h.results[0][3]='10,0 km';h.results[9][3]='Ukjent';const ctx=context(h),s=await session('Name;Race;Distance;Status;Time\nSyntetisk Asmund Steinvik;Kortmoro;10 km;Fullført;1:09:00\nSyntetisk Runa Ute;Kortmoro;Ukjent;Deltatt;',ctx);
 assert.deepEqual(s.session.rows.map(r=>r.errors),[[],[]]);const a=R.review(ctx,s.session),first=a.items.find(i=>i.beforeIndex===0);assert.deepEqual(first.differences.map(d=>d.field),['time']);assert.equal(first.after[3],'10,0 km');assert.equal(a.items.find(i=>i.beforeIndex===9).category,'unchanged');
 for(const value of ['Kortmoro 10 km/ 20 km','Kortmoro 10 km / 20 km']){const malformed=await session('Name;Race;Time\nSyntetisk Eksempel;'+value+';50:00');assert.ok(malformed.session.rows[0].errors.length);}
});

test('C2.3d EQtiming Startnumber and Rank Gender preserve exact result ownership through a corrected race and swapped finish times',async()=>{
 // Fictional names and values; the headings mirror the documented EQtiming CSV field names.
 const h=fixture.history(),ctx=context(h);
 const headings=['Startnumber','Firstname','Surname','Gender','Nat','Club','Stage','Class','Group','Total Time','Total TimeHMS','Total Time2','Lap','Rank Class','Diff Winner Class','Rank Gender','Diff Winner Gender','Rank Total','Diff Winner Total','TimeOfDay','City',''];
 const record=(bib,first,last,club,stage,time,rankClass,rankGender,rankTotal)=>[bib,first,last,'M','NOR',club,stage,'Herrer','Hovedstart',time,time,time,'1',rankClass,'',rankGender,'',rankTotal,'','','',''];
 const lines=[headings,
  record('301','Syntetisk Asmund','Steinvik','Syntetisk klubb A','20 km - Morothon','2:07:14','36','39','41'),
  record('318','Syntetisk Bjarne','Skogdal','Syntetisk klubb B','10 km - Kortmoro','1:08:51','13','16','20')];
 const text=lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n')+'\r\n';
 const stage=R.parse(text);
 assert.equal(stage.mapping.bib,0,'EQtiming Startnumber must not be silently omitted');
 assert.equal(stage.mapping.place,15,'Rank Gender is the official gender-wide distance placement, not Rank Class or Rank Total');
 assert.equal(stage.mapping.event,6,'EQtiming Stage must be detected as the event and course field');
 assert.equal(stage.mapping.time,9,'EQtiming Total Time must be detected as the finish result, not TimeOfDay/Total TimeHMS/Total Time2');
 const inspection=R.inspect(ctx,stage,2026);
 assert.equal(inspection.ready,true);
 assert.ok(inspection.rows.every(r=>!r.errors.length));
 const s=await R.createSession(ctx,stage,stage.mapping,{year:2026,sourceSha256:await C.hash(text),meta:fixture.meta});
 const items=R.review(ctx,s).items.filter(i=>i.row);
 assert.equal(items.length,2);assert.ok(items.every(i=>i.category==='changed'));
 assert.deepEqual(items.map(i=>i.beforeIndex),[0,1]);
 assert.deepEqual(items[0].after.slice(2),['Morothon','20 km','Fullført','2:07:14',39,'Herrer','Syntetisk klubb A','301']);
 assert.deepEqual(items[1].after.slice(2),['Kortmoro','10 km','Fullført','1:08:51',16,'Herrer','Syntetisk klubb B','318']);
 let decisions=new Map();for(const item of items)decisions=R.decide(ctx,s,decisions,item.id,{action:'confirm',runnerId:item.before[1],targetIndex:item.beforeIndex,reason:'Kontrollert syntetisk kilde og startnummer.'});
 const packet=await R.prepare(ctx,s,decisions),candidate=await C.applyCandidate(h,packet,s.base,{preview:true});
 assert.equal(packet.cases.length,2);assert.ok(packet.cases.every(c=>c.change.kind==='result'));
 assert.deepEqual(candidate.history.people,h.people);assert.equal(candidate.history.results.length,h.results.length);
 assert.deepEqual(candidate.history.results.slice(0,2),items.map(i=>i.after));
});

test('C2.3e junior age classes retain the same gender-wide distance ranking, never class-only rank',()=>{
 const csv='Name;Stage;Class;Gender;Total Time;Rank Class;Rank Gender;Rank Total\nSyntetisk Junior;10 km - Kortmoro;M15-17;M;49:22;1;4;5';
 const parsed=R.parse(csv),inspected=R.inspect(context(),parsed,2026);
 assert.equal(parsed.mapping.place,6);
 assert.equal(inspected.ready,true);assert.deepEqual(inspected.rows[0].errors,[]);
 assert.equal(inspected.rows[0].className,'M15-17');
 assert.equal(inspected.rows[0].place,4,'Junior competes for overall men podium on this distance');
 const withoutGenderRank=R.parse('Name;Stage;Class;Gender;Total Time;Rank Class\nSyntetisk Junior;10 km - Kortmoro;M15-17;M;49:22;1');
 const inspectedWithout=R.inspect(context(),withoutGenderRank,2026);
 assert.equal(withoutGenderRank.mapping.place,-1,'Class-only rank must not be mislabeled as gender-wide placement');
 assert.equal(inspectedWithout.rows[0].present.place,false,'Absent gender-wide placement must not overwrite an existing source place');
});
