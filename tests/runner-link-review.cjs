const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawn,execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {reviewLinks,markdown}=require('../scripts/lib/runner-link-review.cjs'),{scan,args}=require('../scripts/review-runner-links.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs'),H=require('../js/honors-data.js');
const root=path.resolve(__dirname,'..'),pid='MOR-A000001',other='MOR-B000002',old='MOR-C000003';
const registry=(name='Anna Olsen')=>({schemaVersion:1,sources:{qa:{title:'Testbekreftelse'}},personDetails:{},groups:[{id:'volunteers',members:[{id:'anna',name,aliases:[]}]}]});
const history=()=>({schemaVersion:1,people:[{i:pid,n:'Anna Olsen',g:'Dame'}],results:[[2026,pid,'Morothon','20 km','Fullført','2:00:00']],yearStats:[[2026,1,1]],aliases:{},redirects:{}});
const row=(d,h)=>reviewLinks(d,h).rows[0];
test('runner proposals use exact registered names and aliases, canonicalize redirects and never persist an identity',()=>{
 const h=history(),d=registry('  ANITA   BERG ');h.people.push({i:old,n:'Anita Berg',g:'Dame'});h.redirects[old]=pid;h.aliases[old]=['Anita Berg'];const before=JSON.stringify({d,h}),r=row(d,h);
 assert.equal(r.status,'unique');assert.equal(r.requiresConfirmation,true);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].candidateId,pid);assert.equal(r.candidates[0].participations,1);assert.ok(r.candidates[0].matches.some(m=>m.basis==='registered-alias'));assert.equal(JSON.stringify({d,h}),before);assert.equal(d.groups[0].members[0].runnerId,undefined);assert.deepEqual(d.personDetails,{});
 const alias=registry('Anne Olsen');alias.groups[0].members[0].aliases=['Anna Olsen'];assert.equal(row(alias,history()).status,'unique');
});
test('duplicate exact names, weak spellings, initials and partial names always require manual confirmation',()=>{
 const h=history();h.people.push({i:other,n:'Anna Olsen',g:'Dame'});h.results.push([2025,other,'Morothon','20 km','Fullført','3:00:00']);const both=row(registry(),h);assert.equal(both.status,'ambiguous');assert.equal(both.candidates.length,2);assert.equal(both.requiresConfirmation,true);
 for(const name of ['Anna O','Anna Olse','Anna Maria Olsen']){const r=row(registry(name),history());assert.equal(r.status,'uncertain',name);assert.equal(r.requiresConfirmation,true);}
 const partial=registry();partial.groups[0].members[0].nameStatus='partial';assert.equal(row(partial,history()).status,'uncertain');
 const norwegian=history();norwegian.people[0].n='Jenny Aamodt';assert.equal(row(registry('Jenny Åmodt'),norwegian).status,'uncertain');
 const no=registry('En Annen Person');assert.equal(row(no,history()).status,'unmatched');
 const team=history();team.results[0][2]='Langmoro stafett';assert.equal(row(registry(),team).status,'unmatched');
});
test('existing confirmations stay explicit and broken/duplicate/invalid links and ownership conflicts are flagged, never repaired',()=>{
 const d=registry(),h=history();d.groups[0].members.push({id:'known',name:'Annen visningsform',runnerId:pid});assert.equal(reviewLinks(d,h).rows.find(r=>r.personId==='anna').status,'owner-conflict');
 d.personDetails.anna={runnerLink:{runnerId:pid,confirmed:true,sourceIds:['qa']}};assert.equal(reviewLinks(d,h).summary['duplicate-confirmation'],2);
 d.groups[0].members.pop();h.redirects[old]=pid;d.personDetails.anna.runnerLink.runnerId=old;const valid=row(d,h);assert.equal(valid.status,'confirmed');assert.equal(valid.recordedId,old);assert.equal(valid.candidates[0].candidateId,pid);assert.equal(d.personDetails.anna.runnerLink.runnerId,old);
 d.personDetails.anna.runnerLink.confirmed=false;assert.equal(row(d,h).status,'invalid-confirmation');d.personDetails.anna.runnerLink.confirmed=true;d.personDetails.anna.runnerLink.sourceIds=['constructor'];assert.equal(row(d,h).status,'invalid-confirmation');
 d.personDetails.anna.runnerLink.sourceIds=['qa'];d.personDetails.anna.runnerLink.runnerId=other;assert.equal(row(d,h).status,'broken-link');h.redirects[pid]=old;d.personDetails.anna.runnerLink.runnerId=pid;assert.equal(row(d,h).status,'broken-link');
});
test('future reports distinguish new and changed proposals; fresh results update counts without generating false identity changes',()=>{
 const d=registry(),h=history(),first=reviewLinks(d,h);assert.equal(first.summary.newProposals,1);
 h.results.push([2027,pid,'Morothon','20 km','DNF','DNF'],[2027,pid,'Kortmoro','10 km','Fullført','1:00:00'],[2028,pid,'Morothon','20 km','DNS','DNS'],[2029,pid,'Langmoro stafett','20 km','Fullført','2:00:00']);const next=reviewLinks(d,h,{previous:first});assert.equal(next.summary.newProposals,0);assert.equal(next.rows[0].change,'unchanged');assert.equal(next.rows[0].candidates[0].participations,2);assert.equal(next.rows[0].candidates[0].lastYear,2027);
 h.people.push({i:other,n:'Anna Olsen',g:'Dame'});const ambiguous=reviewLinks(d,h,{previous:next});assert.equal(ambiguous.rows[0].change,'changed');assert.equal(ambiguous.summary.changedProposals,1);d.groups[0].members.push({id:'new',name:'Ukjent Navn'});assert.equal(reviewLinks(d,h,{previous:ambiguous}).rows.find(r=>r.personId==='new').change,'new');
 const hostile=registry('<img src=x onerror=alert(1)>');assert.doesNotMatch(markdown(reviewLinks(hostile,h)),/<img/);assert.match(markdown(reviewLinks(hostile,h)),/&lt;img/);assert.throws(()=>reviewLinks(d,h,{profileBase:'javascript:alert(1)'}),/HTTPS/);
});
test('the report command preserves every register and result byte, rejects source destinations and has no apply mode',async()=>{
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'runner-link-report-'));try{
  const files=['data/honors.json','data/volunteers.json','data/history.json'],hash=async f=>createHash('sha256').update(await fs.readFile(path.join(root,f))).digest('hex'),before=await Promise.all(files.map(hash));const r=await scan({output:out});assert.equal(r.errors,0);assert.equal(r.report.rows.length,44);assert.equal(r.report.summary.confirmed,26);assert.deepEqual(await Promise.all(files.map(hash)),before);assert.match(await fs.readFile(path.join(out,'koblingsforslag.md'),'utf8'),/Allerede bekreftede koblinger/);
  const previous=path.join(out,'koblingsforslag.json'),again=await scan({output:out,previous});assert.equal(again.report.summary.newProposals,0);assert.equal(again.report.summary.changedProposals,0);
  assert.throws(()=>args(['--apply']),/Ukjent/);await assert.rejects(scan({output:path.join(root,'data')}),/utenfor kildefilene/);
  await fs.rm(previous);await fs.symlink(path.join(root,'data/honors.json'),previous);await assert.rejects(scan({output:out}),/symbolsk/);assert.deepEqual(await Promise.all(files.map(hash)),before);
 }finally{await fs.rm(out,{recursive:true,force:true});}
});
async function until(check,{stage='rapporten',diagnostics=()=>'',exited=()=>false}={}){
 const deadline=Date.now()+12000;
 while(Date.now()<deadline){
  if(exited())throw new Error('Overvåkingen stoppet mens testen ventet på '+stage+'\n'+diagnostics());
  try{if(await check())return;}catch(e){if(e.code!=='ENOENT')throw new Error('Feil ved kontroll av '+stage+': '+e.message+'\n'+diagnostics(),{cause:e});}
  await new Promise(r=>setTimeout(r,75));
 }
 throw new Error('Ventet for lenge på '+stage+'\n'+diagnostics());
}
test('watch mode automatically reviews newly saved volunteers and history aliases, preserving the last report during an incomplete JSON save',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'runner-link-watch-')),project=path.join(dir,'project'),out=path.join(dir,'reports');await fs.mkdir(path.join(project,'data'),{recursive:true});
 const d=registry('Navn Uten Treff'),hist=history(),vol={schemaVersion:1,sourceIds:['qa'],people:[]};d.volunteerList='data/volunteers.json';
 const files={core:path.join(project,'data/honors.json'),vol:path.join(project,'data/volunteers.json'),hist:path.join(project,'data/history.json')};
 await fs.writeFile(files.core,JSON.stringify(d));await fs.writeFile(files.hist,JSON.stringify(hist));await fs.writeFile(files.vol,JSON.stringify(vol));await fs.writeFile(path.join(project,'package.json'),JSON.stringify({homepage:'https://example.test/'}));
 const child=spawn(process.execPath,[path.join(root,'scripts/review-runner-links.cjs'),'--root',project,'--output',out,'--watch'],{stdio:['ignore','pipe','pipe']});
 let exitState,stdout='',stderr='';const events=[];
 const exited=new Promise(resolve=>{child.once('exit',(code,signal)=>{exitState={code,signal};resolve();});child.once('error',e=>{exitState={error:e.message};resolve();});});
 child.stdout.on('data',b=>{stdout=(stdout+b).slice(-16000);});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-16000);});
 const readers=[child.stdout,child.stderr].map(input=>require('node:readline').createInterface({input}));
 for(const reader of readers)reader.on('line',line=>{try{events.push(JSON.parse(line));}catch{}});
 const diagnostics=()=>JSON.stringify({exitState,stdout,stderr}),wait=(stage,check)=>until(check,{stage,diagnostics,exited:()=>!!exitState});
 const report=()=>fs.readFile(path.join(out,'koblingsforslag.json'),'utf8');
 try{
  await wait('watch-ready',()=>events.some(e=>e.event==='watch-ready'));
  assert.deepEqual(events.find(e=>e.event==='watch-ready').files.sort(),['history.json','honors.json','volunteers.json']);
  // Edit immediately after readiness, without using the first report as a
  // proxy for installed watchers or adding a startup sleep.
  vol.people.push({id:'registered-now',name:'Testalias Til Løper'});await fs.writeFile(files.vol,JSON.stringify(vol));await wait('ny dugnadsperson',async()=>JSON.parse(await report()).rows.length===2);
  hist.aliases[pid]=['Testalias Til Løper'];await fs.writeFile(files.hist,JSON.stringify(hist));await wait('nytt historikkalias',async()=>JSON.parse(await report()).rows.some(r=>r.personId==='registered-now'&&r.status==='unique'));
  const saved=await report();
  for(const [invalid,errorType]of [['{','SyntaxError'],[JSON.stringify({schemaVersion:1,people:null}),'Error']]){
   const before=events.length;await fs.writeFile(files.vol,invalid);
   await wait('observert feil for ugyldig JSON',()=>events.slice(before).some(e=>e.event==='watch-error'&&e.errorType===errorType));
   assert.equal(await report(),saved,'Only a successfully parsed and validated scan may replace the report');
  }
  vol.people[0].name='Anna Olsen';await fs.writeFile(files.vol,JSON.stringify(vol));await wait('gjenopprettet dugnadsregister',async()=>JSON.parse(await report()).rows.some(r=>r.personId==='registered-now'&&r.name==='Anna Olsen'));
  d.groups[0].members[0].name='Oppdatert Kildenavn';await fs.writeFile(files.core,JSON.stringify(d));await wait('oppdatert hedersregister',async()=>JSON.parse(await report()).rows.some(r=>r.personId==='anna'&&r.name==='Oppdatert Kildenavn'));
  // Directory monitoring must survive a save implemented by rename as well.
  hist.aliases[pid].push('Oppdatert Kildenavn');await fs.writeFile(files.hist+'.tmp',JSON.stringify(hist));await fs.rename(files.hist+'.tmp',files.hist);
  await wait('alias lagret ved filbytte',async()=>JSON.parse(await report()).rows.some(r=>r.personId==='anna'&&r.status==='unique'));
  assert.equal(vol.people[0].runnerId,undefined);assert.equal(d.groups[0].members[0].runnerId,undefined);
 }finally{
  if(!exitState)child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),2000);
  try{await exited;}finally{clearTimeout(force);readers.forEach(r=>r.close());await fs.rm(dir,{recursive:true,force:true});}
 }
});
test('an exact proposal stays invisible as a race identity until explicit confirmation; then card, statistics and correct runner link appear',async()=>{
 const h=await createHarness();try{
  const core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8')),vol=JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8')),hist=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')),id='qa-new-volunteer',runner='MOR-QA00001';vol.people.push({id,name:'Syntetisk Kontrollperson'});hist.people.push({i:runner,n:'Syntetisk Kontrollperson',g:'Herre'});hist.results.push([2026,runner,'Kortmoro','10 km','Fullført','1:00:00']);const combined=H.mergeVolunteers(core,vol),proposal=reviewLinks(combined,hist).rows.find(r=>r.personId===id);assert.equal(proposal.status,'unique');assert.equal(proposal.requiresConfirmation,true);
  const p=await h.browser.newPage({viewport:{width:390,height:1000}});await p.route('**/data/honors.json',r=>r.fulfill({json:core}));await p.route('**/data/volunteers.json',r=>r.fulfill({json:vol}));await p.route('**/data/history.json',r=>r.fulfill({json:hist}));await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();assert.equal(await p.locator('.honor-racing').count(),0);assert.equal(core.personDetails[id],undefined);
  core.sources['qa-confirmation']={title:'Eksplisitt testbekreftelse'};core.personDetails[id]={runnerLink:{runnerId:runner,confirmed:true,sourceIds:['qa-confirmation']}};await p.reload();await p.locator('#profileName').waitFor();assert.equal(await p.locator('.honor-race-metrics b').first().textContent(),'1');assert.equal(await p.locator('.primary-runner-link').getAttribute('href'),'index.html#lop='+runner);await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();assert.match(await p.locator(`[data-honoree="${id}"]`).innerText(),/1 løpsdeltakelser/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.close();
 }finally{await h.close();}
});
test('new DNF results and canonical redirects refresh confirmed race counts and links at mobile/PC widths without changing volunteer years',async()=>{
 const h=await createHarness();try{
  const core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8')),raw=JSON.stringify(core),source=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8'));let hist=source;const id='hakon-lohne',runner='MOR-AA6C983';
  const merged=H.mergeVolunteers(core,JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8'))),tenure=H.serviceTenure(merged,H.findIn(merged,id).member);
  for(const width of [390,1440]){
   hist=source;const p=await h.browser.newPage({viewport:{width,height:1000}});await p.route('**/data/history.json',r=>r.fulfill({json:hist}));await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();const before=Number(await p.locator('.honor-race-metrics b').first().textContent());
   hist=structuredClone(source);const canonical='MOR-QA00003';hist.people.push({...hist.people.find(p=>p.i===runner),i:canonical});hist.redirects[runner]=canonical;hist.redirects['MOR-QA00002']=runner;hist.results.push([2027,'MOR-QA00002','Morothon','20 km','DNF','DNF'],[2027,runner,'Kortmoro','10 km','Fullført','1:00:00'],[2028,runner,'Morothon','20 km','DNS','DNS']);hist.yearStats.push([2027,1,1]);
   await p.reload();await p.locator('#profileName').waitFor();assert.equal(Number(await p.locator('.honor-race-metrics b').first().textContent()),before+1);assert.match(await p.locator('.honor-race-metrics').innerText(),/2027/);assert.equal(await p.locator('.primary-runner-link').getAttribute('href'),'index.html#lop='+canonical);
   const count=await p.evaluate(async id=>{const d=await MorothonDiplomas.serviceDraft(id);return d.contributionCount;},id);assert.equal(count,tenure.count);assert.equal(count,12);await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();assert.match(await p.locator(`[data-honoree="${id}"] .honor-card-racing`).innerText(),new RegExp((before+1)+' løpsdeltakelser'));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.close();
  }
  assert.equal(JSON.stringify(core),raw);
 }finally{await h.close();}
});
