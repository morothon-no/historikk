const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {exportPublicData,validateExport,validatePublicData}=require('../scripts/lib/public-data.cjs');
const {buildSite,validatePublicSite}=require('../scripts/build-site.cjs');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const H=require('../js/honors-data.js'),root=path.resolve(__dirname,'..');
async function inputs(){return Object.fromEntries(await Promise.all(['honors','volunteers','history','badges','event-dates'].map(async n=>[n,JSON.parse(await fs.readFile(path.join(root,'data',n+'.json'),'utf8'))])));}
function merge(x){return H.mergeVolunteers(x.honors,x.volunteers);}
function evidenceFree(value){if(Array.isArray(value))return value.map(evidenceFree);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([k])=>!['sourceIds','source'].includes(k)).map(([k,v])=>[k,evidenceFree(v)]));}
test('public projection excludes administrative canaries and every hidden honor reference, without mutating originals',async()=>{
 const raw=await inputs(),snapshot=structuredClone(raw),h=raw.honors,v=raw.volunteers;
 h.unreviewedNewField='PRIVATE-CANARY';h.sources[Object.keys(h.sources)[0]].note='PRIVATE-CANARY';
 h.groups[0].members[0].internalNotes=['PRIVATE-CANARY'];h.groups[0].members[0].roles[0].note='PRIVATE-CANARY';
 v.people.find(p=>p.id).newPrivateField='PRIVATE-CANARY';
 const before=structuredClone(raw),pub=exportPublicData(raw),text=JSON.stringify(pub);
 assert.ok(!text.includes('PRIVATE-CANARY'));assert.ok(!JSON.stringify([pub.honors,pub.volunteers]).includes('erling-danielsen'));
 for(const field of ['revisionHistory','internalNotes','historicalNotes','previousBadgeProposals','hiddenProfileIds','pendingReviews','previousEntries','serviceEstimate'])assert.ok(!text.includes('"'+field+'"'),field);
 assert.equal(pub.honors.groups.flatMap(g=>g.members).length+pub.volunteers.people.filter(p=>p.id).length,43);
 assert.equal(pub.honors.personDetails['erling-danielsen'],undefined);
 assert.deepEqual(pub.history,snapshot.history);assert.deepEqual(raw,before);
 assert.deepEqual(pub['event-dates'].dates,snapshot['event-dates'].dates);
 assert.equal(pub.badges.badges.length,snapshot.badges.badges.length);
});
test('all visible identities, service calculations, links, badge collections and diploma text survive public projection',async()=>{
 const raw=await inputs(),pub=exportPublicData(raw),a=merge(raw),b=merge(pub),years=H.arrangedYears(raw.history.results);
 global.MorothonBadges={get:id=>raw.badges.badges.find(x=>x.id===id)};
 H.validate(b);
 const members=a.groups.flatMap(g=>g.members).filter(m=>H.isVisibleOnHonorPage(a,m.id));assert.equal(members.length,43);
 for(const m of members){
  const n=H.findIn(b,m.id)?.member;assert.ok(n,m.id);
  assert.deepEqual(H.honorProfile(b,n,years),H.honorProfile(a,m,years),m.id);
  assert.deepEqual(H.diplomaChoices(b,n,years),H.diplomaChoices(a,m,years),m.id);
  const pa=H.personRecord(a,m),pb=H.personRecord(b,n);
  for(const k of ['name','runnerId','shortDescription','honorDiplomaText','diplomaDate'])assert.deepEqual(evidenceFree(pb[k]),evidenceFree(pa[k]),m.id+':'+k);
  assert.deepEqual(evidenceFree(pb.stories.filter(s=>s.confirmed)),evidenceFree(pa.stories.filter(s=>s.confirmed)),m.id);
  for(const badge of H.diplomaChoices(a,m,years))assert.equal(H.diplomaText(b,n,badge),H.diplomaText(a,m,badge),m.id);
 }
 assert.equal(H.findIn(b,'erling-danielsen'),null);assert.equal(H.serviceTenure(b,H.findIn(b,'einar-danielsen').member,years).count,33);
 assert.equal(b.personDetails['einar-danielsen'].diplomaDate.date,'2026-11-07');
});
test('strict public validation rejects leaked fields, hidden profiles, changed approval hashes and unapproved fields in history',async()=>{
 const raw=await inputs(),pub=exportPublicData(raw);
 for(const alter of [
  p=>p.honors.internalNotes=['secret'],
  p=>p.honors.groups[0].members[0].contribution.internalNotes=['secret'],
  p=>p.volunteers.people.find(p=>p.id).internalNotes=['secret'],
  p=>p.honors.personDetails['erling-danielsen']={shortDescription:'hidden'},
  p=>p.honors.groups[0].members.push(raw.honors.groups.flatMap(g=>g.members).find(m=>m.id==='erling-danielsen')),
  p=>p.honors.presentationPrintSet.entries[0].contentSha256='0'.repeat(64),
  p=>p.history.people[0].privateContact='secret'
 ]){const bad=structuredClone(pub);alter(bad);assert.throws(()=>validateExport(bad,raw));}
 const bad=structuredClone(raw);bad.history.newPrivateField='secret';assert.throws(()=>exportPublicData(bad),/Unapproved public field/);
 const unknownHidden=structuredClone(raw);unknownHidden.honors.hiddenProfileIds=['unknown-person'];assert.throws(()=>exportPublicData(unknownHidden),/Invalid hidden profile policy/);
 const hiddenVolunteer=structuredClone(raw);hiddenVolunteer.honors.hiddenProfileIds.push('jon-fjeld');hiddenVolunteer.honors.narrative.lead='Jon Fjeld';assert.throws(()=>exportPublicData(hiddenVolunteer),/Hidden honor profile/);
 const malformed=structuredClone(pub.honors);malformed.groups[0].members[0].reason={internalNotes:'secret'};assert.throws(()=>validatePublicData('honors',malformed),/type mismatch/);
});
test('final Pages gate refuses extra files, symlinks and reintroduced administrative JSON',async()=>{
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-a1-gate-'));
 try{
  await buildSite(out);assert.equal((await validatePublicSite(out)).visiblePeople,43);
  await fs.writeFile(path.join(out,'private-backup.json'),'{}');await assert.rejects(()=>validatePublicSite(out),/Unexpected or missing/);await fs.unlink(path.join(out,'private-backup.json'));
  await fs.symlink(path.join(root,'data/honors.json'),path.join(out,'original.json'));await assert.rejects(()=>validatePublicSite(out),/Symlink/);await fs.unlink(path.join(out,'original.json'));
  const manifestFile=path.join(out,'build-info.json'),manifest=await fs.readFile(manifestFile,'utf8');
  await fs.writeFile(manifestFile,JSON.stringify({...JSON.parse(manifest),internalNotes:['secret']}));await assert.rejects(()=>validatePublicSite(out),/Unapproved public field/);await fs.writeFile(manifestFile,manifest);
  await fs.copyFile(path.join(root,'data/honors.json'),path.join(out,'data/honors.json'));await assert.rejects(()=>validatePublicSite(out),/Unapproved public field/);
 }finally{await fs.rm(out,{recursive:true,force:true});}
});
test('built public pages preserve PC/mobile cards, every visible diploma proof and print mode, with Erling hidden and runner history intact',async()=>{
 const raw=await inputs(),out=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-a1-parity-'));let source,built;
 try{
  await buildSite(out);source=await createHarness();built=await createHarness({rootDir:out});
  const snapshots=[];
  for(const h of [source,built]){
   const p=await h.browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="einar-danielsen"]').waitFor();
    const cards={};for(const width of [390,1440]){await p.setViewportSize({width,height:900});cards[width]=await p.locator('[data-honoree]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.honoree,text:n.innerText,badges:[...n.querySelectorAll('img')].map(i=>({path:new URL(i.src).pathname,alt:i.alt}))})));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    const diplomas=await p.evaluate(async()=>{
     const data=await MorothonHonorsData.load(),all=[];
     for(const m of data.groups.flatMap(g=>g.members).filter(m=>MorothonHonorsData.isVisibleOnHonorPage(data,m.id)))for(const display of ['all','latest']){
      const d=await MorothonDiplomas.serviceDraft(m.id,display);
      all.push({id:m.id,display,proof:d.contentProof,mode:d.printMode,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,date:d.dateLabel,title:d.title,tribute:d.tribute});
     }
     return all;
    });assert.equal(diplomas.length,86);
    await p.goto(h.base+'/heder.html#person/einar-danielsen');await p.locator('#profileName').waitFor();assert.equal(await p.locator('#profileName').textContent(),'Einar Danielsen');
    await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]').disabled);
    const checked=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('einar-danielsen');return MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument);});assert.equal(checked.ready,true,checked.failures.join(' '));
    await p.goto(h.base+'/heder.html#person/erling-danielsen');await p.waitForFunction(()=>document.querySelector('#honorStatus')?.textContent!==''||!location.hash.includes('erling-danielsen'));assert.equal(await p.locator('[data-honoree="erling-danielsen"]').count(),0);assert.ok(!(await p.locator('#honorProfile').innerText()).includes('Erling Danielsen'));
    await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));const history=await p.evaluate(async()=>{const h=await MorothonHistoryData.load();return {people:h.data.people.length,results:h.data.results,stats:h.stats('MOR-B1AC0FD')};});
    snapshots.push({cards,diplomas,history});assert.deepEqual(errors,[]);
   }finally{await p.close();}
  }
  assert.deepEqual(snapshots[1],snapshots[0]);
  assert.deepEqual(await fs.readFile(path.join(out,'data/history.json')),await fs.readFile(path.join(root,'data/history.json')));
 }finally{if(source)await source.close();if(built)await built.close();await fs.rm(out,{recursive:true,force:true});}
});
test('CI publishes only gated site and public-package review, never administrative link reports or archived galleries',async()=>{
 const workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
 const steps=workflow.split(/(?=      - name: )/).filter(s=>s.includes('uses: actions/upload-artifact@'));
 assert.equal(steps.length,2);
 assert.ok(steps.some(s=>s.includes('name: morothon-site')&&s.includes('path: _site/')));
 assert.ok(steps.some(s=>s.includes('name: morothon-a1-offentlig-kontroll')&&s.includes('/tmp/morothon-a1-public/')));
 assert.ok(workflow.includes('npm run public:kontroll -- _site'));
 assert.ok(workflow.indexOf('npm run public:kontroll -- _site')<workflow.indexOf('name: Retain tested site artifact'));
 for(const step of steps)assert.ok(!/\.review\/runner-links|morothon-v36\/|morothon-v353\/|morothon-v362\//.test(step));
});
