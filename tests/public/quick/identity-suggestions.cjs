// All names and profiles below are fictional. Never use actual register rows.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../../../tools/diploma-admin/intake-model.js').Corrections,sample=require('./fixtures/corrections-data.js');
function history(names,years=names.map((_,i)=>2020+i)){
 const h=sample.history(),template=h.people[0];h.people=names.map((n,i)=>({...template,i:'MOR-N'+String(i+1).padStart(6,'0'),n,c:1,f:years[i],l:years[i]}));h.aliases={};h.redirects={};h.results=h.people.map((p,i)=>[years[i],p.i,'Kortmoro','10 km','Fullført',(40+i)+':00',1,'M','Syntetisk klubb',String(i+1)]);return h;
}
const identities=h=>C.discover(h).filter(s=>['Navn eller alias','Mulige duplikater','Navnevariant','Mulig navnevariant','Mulig navneendring'].includes(s.category));
const positive=[
 ['Alvinka Nordvik','alvinka   NORDVIK','strong'],
 ['Alvinka Nordvik','Alvinka Petra Nordvik','moderate'],
 ['Alvinka Petra Nordvik','Alvinka Nordvik','moderate'],
 ['Alvinka P. Nordvik','Alvinka Petra Nordvik','moderate'],
 ['Alvinka Nordvik','Alvinkaa Nordvik','moderate'],
 ['Alvinka Svanberg','Alvinka Svanbreg','moderate'],
 ['Alvinka Nordvik','Alvinka Nordvik Fjordberg','moderate'],
 ['Alvinka-Petra Nordvik','Alvinka Petra Nordvik','strong'],
 ['Alvinka Ås','Alvinka Aas','moderate'],
 ['Alvinka Li','Alvinka Petra Li','moderate'],
 ['Alvinka Nordvik','Alvinkaa Nordvikk','weak']
];
test('C2.2a full token roles retain exact names, middle names, initials, plausible spelling, surname additions and careful Norwegian variants',()=>{
 for(const [a,b,strength]of positive){const left=C.compareNames(a,b),right=C.compareNames(b,a);assert.ok(left,'Expected synthetic name variant');assert.equal(left.strength,strength);assert.deepEqual(right,left);assert.equal(identities(history([a,b])).length,1);assert.match(left.reason,/kontrolleres/);}
});
test('C2.2a same given name, unrelated surnames, substrings and shared short tokens never create automatic identity suggestions',()=>{
 for(const names of [['Alvinka Nordvik','Alvinka Bjerkedal'],['Alvinka Nord','Alvinka Nordvik'],['Testa Li Nordvik','Testa Li Fjordberg'],['Alvinka De','Alvinka De Bjerkedal'],['Ola Nordvik','Ole Nordvik'],['Alvinka Petra Nordvik','Alvinka Astrid Nordvik'],['Alvinka A A Nordvik','Alvinka Arne Nordvik']]){assert.equal(C.compareNames(...names),null);assert.equal(identities(history(names)).length,0);}
});
test('C2.2a nearby, separated or overlapping participation years never establish or exclude identity',()=>{
 for(const years of [[2020,2021],[2020,2026],[2020,2020],[2026,2020]]){assert.equal(identities(history(['Alvinka Nordvik','Alvinka Bjerkedal'],years)).length,0);assert.equal(identities(history(['Alvinka Nordvik','Alvinka Petra Nordvik'],years)).length,1);}
});
test('C2.2a aliases and prior redirects support a strong signal across different surnames without changing IDs, aliases or results',()=>{
 const h=history(['Alvinka Nordvik','Alvinka Bjerkedal']);h.aliases[h.people[0].i]=['Alvinka Bjerkedal'];const before=JSON.stringify(h),list=identities(h);assert.equal(list.length,1);assert.equal(list[0].strength,'strong');assert.equal(list[0].category,'Navn eller alias');assert.equal(JSON.stringify(h),before);
 const merged=structuredClone(h);merged.redirects[merged.people[0].i]=merged.people[1].i;assert.equal(identities(merged).length,0,'One canonical identity must not be suggested against itself');
 const old=history(['Alvinka Nordvik','Alvinka Bjerkedal','Alvinka Bjerkedal']);old.redirects[old.people[2].i]=old.people[0].i;assert.equal(identities(old).length,1);assert.equal(identities(old)[0].strength,'strong');
});
test('C2.2a refresh links cases with stable opaque origins, reuses open cases and preserves handled states through export/import',async()=>{
 const h=history(['Alvinka Nordvik','Alvinka Petra Nordvik']),b=await C.binding(h,sample.meta),s=identities(h)[0],p=C.empty(b),opened=await C.openSuggestion(p,s,'case-names');assert.equal(opened.reused,false);assert.equal(opened.package.cases.length,1);assert.equal(p.cases.length,0);
 const pending=await C.reviewSuggestions([s],opened.package);assert.equal(pending[0].bucket,'pending');assert.match(pending[0].origin,/^suggestion-[a-f0-9]{64}$/);const again=await C.openSuggestion(opened.package,s,'must-not-be-created');assert.equal(again.reused,true);assert.equal(again.package.cases.length,1);
 const rejected=C.transition(opened.package,opened.caseId,'rejected','Forskjellige syntetiske personer.');assert.equal((await C.reviewSuggestions([s],rejected))[0].bucket,'finished');const restored=C.importPackage(C.empty(b),C.parse(C.serialize(rejected))).package;assert.equal((await C.reviewSuggestions([s],restored))[0].bucket,'finished');assert.equal(restored.cases.length,1);assert.deepEqual((await C.applyCandidate(h,restored,b)).history,h);
 const deferred=C.transition(opened.package,opened.caseId,'review','Trenger syntetisk dokumentasjon.');assert.equal((await C.reviewSuggestions([s],deferred))[0].bucket,'followup');
 const note=C.updateNotes(opened.package,opened.caseId,{description:'Syntetisk sak kontrollert',source:'Syntetisk kilde',reason:'Videre kontroll nødvendig'});assert.equal((await C.reviewSuggestions([s],note))[0].bucket,'followup');
});
test('C2.2a earlier cases remain associated by canonical pair despite changed rule/category, while unrelated manual cases stay separate',async()=>{
 const h=history(['Alvinka Nordvik','Alvinka Petra Nordvik']),b=await C.binding(h,sample.meta),s=identities(h)[0];let p=C.report(C.empty(b),{id:'old-case',category:'Mulig navneendring',personIds:s.personIds.slice().reverse(),description:'Tidligere syntetisk vurdering'});p=C.transition(p,'old-case','rejected','Syntetisk kontroll fullført.');assert.equal((await C.reviewSuggestions([s],p))[0].caseId,'old-case');assert.equal((await C.openSuggestion(p,s,'unused')).reused,true);
 const manual=C.report(C.empty(b),{id:'manual',category:'Manuell sak',personIds:s.personIds,description:'En annen syntetisk problemstilling'});assert.equal((await C.reviewSuggestions([s],manual))[0].caseId,null);
 const original=JSON.stringify(p);await C.reviewSuggestions([s],p);assert.equal(JSON.stringify(p),original);
 const importedSource={...s,category:'Startlistekontroll',source:'Syntetisk startlistekilde'};let work=(await C.openSuggestion(C.empty(b),importedSource,'manual-merge')).package;work=await C.propose(h,work,'manual-merge',{kind:'merge',personIds:s.personIds,source:'Syntetisk identitetskilde',reason:'Identiteten er manuelt gjennomgått.'});assert.equal((await C.reviewSuggestions([s],work))[0].bucket,'followup');
});
test('C2.2a refresh does not hide other result issues or a conflict from a newer start-list source',async()=>{
 const h=history(['Alvinka Nordvik']),b=await C.binding(h,sample.meta),p=C.empty(b),base={id:'synthetic',category:'Startlistekontroll',personIds:[h.people[0].i],resultIndexes:[],reason:'Syntetisk rad må kontrolleres',source:'SHA-256 '+ 'a'.repeat(64)};let opened=await C.openSuggestion(p,base,'source-case');opened.package=C.transition(opened.package,'source-case','rejected','Syntetisk vurdering.');assert.equal((await C.reviewSuggestions([{...base,source:'SHA-256 '+'b'.repeat(64)}],opened.package))[0].bucket,'pending');
 const row={...base,category:'Mulig dobbeltresultat',resultIndexes:[0],source:''},other={...row,resultIndexes:[1]};let result=await C.openSuggestion(p,row,'row-case');result.package=C.transition(result.package,'row-case','rejected','Syntetisk kontroll.');assert.equal((await C.reviewSuggestions([other],result.package))[0].bucket,'pending');
});
