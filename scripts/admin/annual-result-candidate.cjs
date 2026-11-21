'use strict';
const A=require('./annual-result-import.cjs'),H=require('../../js/history-data.js'),P=require('../../tools/diploma-admin/annual-release-data.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function candidate(context,input,storedPlan){
 await A.verify(context,input,storedPlan);const plan=await A.prepare(context,input);
 if(!plan.ready||!plan.hasChanges)throw Error('Avklar identiteter og kilder, og velg minst én faktisk endring.');
 if(plan.newEdition&&(!plan.sourceCompleteClaim||plan.summary.rejected))throw Error('Ny årgang krever et gjennomgått komplett individuelt resultatgrunnlag.');
 if(plan.newPeople.some(p=>!['Herre','Dame'].includes(p.g)))throw Error('Avklar kjønn på nye profiler før rangering og publisering.');
 const history=structuredClone(context.history),seen=new Set(),model=H.create(history);
 for(const p of plan.newPeople)history.people.push({...p,c:1,f:plan.year,l:plan.year,s:1,a:1});
 const key=r=>JSON.stringify([r[0],H.resolveId(r[1],history.redirects),r[2],r[3]]);
 for(const op of plan.operations){
  if(op.kind==='correct-result'){
   if(!same(history.results[op.beforeIndex],op.before))throw Error('Resultatlinjen har nyere kildeverdier.');history.results[op.beforeIndex]=structuredClone(op.after);
  }else if(op.kind==='add-result'){
   if(seen.has(key(op.after))||context.history.results.some(r=>key(r)===key(op.after)))throw Error('En mulig dobbeltstart må avklares før publisering.');seen.add(key(op.after));history.results.push(structuredClone(op.after));
  }
 }
 const newNames=plan.newPeople.map(p=>p.n.normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/\s+/g,' ').trim());
 if(new Set(newNames).size!==newNames.length)throw Error('Like navn på flere nye profiler må identitetsavklares.');
 const finalModel=H.create({...history,yearStats:plan.newEdition?[...history.yearStats,[plan.year]]:history.yearStats}),rows=history.results.filter(r=>r[0]===plan.year&&H.countsAsParticipation(r)),unique=new Set(rows.map(r=>finalModel.resolve(r[1]))).size;
 if(plan.newEdition){
  // Explicit legacy adapter: registered, unique starters, starts, completions,
  // DNF, DNS, adult men, adult women, juniors. Only the documented source year.
  history.yearStats.push([plan.year,plan.summary.read,unique,rows.length,rows.filter(H.isCompletedResult).length,
   rows.filter(r=>H.effectiveStatus(r)==='DNF').length,plan.summary.dns,
   rows.filter(r=>!H.isJuniorRace(r)&&finalModel.person(r[1]).g==='Herre').length,
   rows.filter(r=>!H.isJuniorRace(r)&&finalModel.person(r[1]).g==='Dame').length,rows.filter(H.isJuniorRace).length]);
 }else{
  // Other slots are archival export figures (including unlinked legacy DNS).
  // Never reconstruct or overwrite them from today's corrected person data.
  history.yearStats.find(r=>r[0]===plan.year)[2]=unique;
 }
 const years=history.yearStats.map(r=>r[0]);history.range=Math.min(...years)+'–'+Math.max(...years);
 H.assertValid(history);const changes=P.changes(context.history,history);
 return {result:{history},changes,personIds:[...new Set(changes.filter(c=>c.field==='results').flatMap(c=>[c.before?.[1],c.after?.[1]]).filter(Boolean).map(id=>model.resolve(id)))]};
}
module.exports={candidate};
