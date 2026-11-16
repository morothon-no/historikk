// Private/read-only organizer-aware release review. No web routes, Git writes or publish action.
// A trusted backend must provide authenticated principals, source data and policy adapters.
'use strict';
const {createHash}=require('node:crypto');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;
const P=require('../organizers/profile.cjs');
const fail=message=>{throw Error(message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function createReleasePlanner({authenticate,loadTrustedContext}={}){
 if(typeof authenticate!=='function'||typeof loadTrustedContext!=='function')
  fail('Planlegging krever serververifisert innlogging og kildeprofil. Ingen anonym modus.');
 async function preview({session,organizer,corrections}={}){
  if(typeof organizer!=='string'||!/^[a-z][a-z0-9-]{1,62}$/.test(organizer))
   fail('Ugyldig arrangør.');
  const principal=await authenticate(session);
  if(!principal||typeof principal.subject!=='string'||!principal.subject||
     !principal.organizers||!Object.hasOwn(principal.organizers,organizer)||
     !Array.isArray(principal.organizers[organizer])||!principal.organizers[organizer].includes('review'))
   fail('Ingen bekreftet tilgang til denne arrangørens rettelser.');
  // Never accept a browser-provided profile, history, adapter or source binding.
  const trusted=await loadTrustedContext(organizer);
  if(!trusted||typeof trusted!=='object')fail('Mangler autoritativ arrangørkilde.');
  const profile=P.validateProfile(trusted.profile);
  if(profile.organizerId!==organizer)fail('Arrangørprofilen tilhører en annen arrangør.');
  const history=trusted.history,base=trusted.base,adapter=trusted.adapter;
  if(!history||!base||!adapter||typeof adapter.project!=='function'||typeof adapter.supports!=='function'||
     typeof adapter.id!=='string'||!adapter.id)fail('Mangler verifisert regne- og publiseringsadapter.');
  C.validatePackage(corrections);
  if(!equal(corrections.base,base)||await C.hash(history)!==base.snapshotSha256)
   fail('Rettelsespakken gjelder en annen historikkversjon. Ingen forhåndskontroll utført.');
  const years=new Set();
  for(const row of history.results){
   if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||typeof row[2]!=='string')
    fail('Ugyldig historisk resultat. Stopp uten å endre data.');
   P.eventBySource(profile,row[2]);years.add(row[0]);
  }
  if(!years.size)fail('Arrangørens historikk mangler resultater.');
  const rules=[];
  for(const year of [...years].sort((a,b)=>a-b)){
   const resolved=P.policyForYear(profile,year);
   if(await adapter.supports(resolved,{organizer,year})!==true)
    fail('Reglene for '+organizer+' i '+year+' støttes ikke av den valgte motoren. Ingen forhåndskontroll kan godkjennes.');
   rules.push({year,policyId:resolved.policyId});
  }
  const proposed=corrections.cases.filter(c=>['proposed','handoff'].includes(c.status)&&c.change);
  if(!proposed.length)fail('Ingen konkrete arrangørgodkjente endringsforslag finnes.');
  const before=await C.hash(history),review=await C.reviewStaged(history,corrections,base,adapter.project,{
   linkedRunnerIds:trusted.linkedRunnerIds||[]
  });
  if(await C.hash(history)!==before)fail('Regnemotoren endret kildedata under kontrollen.');
  return {
   schemaVersion:1,kind:'organizer-release-review-v1',organizerId:organizer,adapterId:adapter.id,
   profileSha256:P.digest(profile),correctionsSha256:hash(corrections),
   sourceBinding:JSON.parse(JSON.stringify(base)),policies:rules,
   proposals:review.proposed,affectedCalculations:review.changed,
   blockers:[...review.uncertain,...review.errors.map(e=>e.code||String(e))],
   reviewPassed:review.ready,productionApplied:false,
   publicationAuthorized:false,readyForPublication:false,
   // No passwords, identities, private person lists or workspaces in this receipt.
   nextStep:review.ready?'Separate authenticated publication approval, verified backup, protected PR and CI required':'Resolve blockers in original source-bound review workspace'
  };
 }
 return {preview}; // Deliberately no save(), apply(), publish(), merge() or Git action.
}
module.exports={createReleasePlanner};
