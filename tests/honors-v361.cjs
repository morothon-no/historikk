const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {review,baseline}=require('../scripts/review-honors-v361.cjs'),{readHonors}=require('./helpers/honors.cjs'),{reviewLinks}=require('../scripts/lib/runner-link-review.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs'),H=require('../js/honors-data.js');
const root=path.resolve(__dirname,'..');
// The organizer explicitly confirmed these exact fourteen report entries, including
// the non-exact Bent-Inge / Bent Inge spelling. Future suggestions remain proposals.
const confirmed={
 'arvid-boro':'MOR-5F10796','astrid-lohne':'MOR-3CBFFC3','bent-bakke':'MOR-046CD37',
 'erling-danielsen':'MOR-B82F8A3','johannes-aamodt':'MOR-FB68447','jon-fjeld':'MOR-EFAFF95',
 'joran-eriksen':'MOR-5F72D06','lars-aamodt':'MOR-D4F55FF','leif-wiig':'MOR-88334F0',
 'lene-holmen-berg':'MOR-830D9E6','mari-melsom-kristensen':'MOR-B42530E',
 'nils-henning-pedersen':'MOR-000B270','rune-bergjord':'MOR-45DF0B4','tom-lohne':'MOR-BE568A1'
};
test('V3.6.1 persists exactly the fourteen explicitly confirmed identities without changing historical people, service counts, diploma dates or awards',async()=>{
 const current=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8')),prior=JSON.parse(execFileSync('git',['show',baseline+':data/honors.json'],{cwd:root})),data=await readHonors(),people=data.groups.flatMap(g=>g.members),history=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8'));
 assert.equal(people.length,44);assert.equal(new Set(people.map(p=>p.id)).size,44);
 assert.ok(current.sources['organizer-v361-confirmed-links']);
 for(const [id,runnerId]of Object.entries(confirmed)){
  const entry=current.personDetails[id].runnerLink;assert.equal(prior.personDetails[id].runnerLink,undefined);assert.deepEqual(entry,{runnerId,confirmed:true,sourceIds:['organizer-v361-confirmed-links']});assert.ok(history.people.some(p=>p.i===runnerId));
 }
 assert.equal(H.findIn(data,'bent-bakke').member.name,'Bent-Inge Bakke');assert.equal(history.people.find(p=>p.i===confirmed['bent-bakke']).n,'Bent Inge Bakke');
 const report=reviewLinks(data,history);assert.equal(report.summary.confirmed,26);assert.equal(report.rows.filter(r=>r.requiresConfirmation).length,0);
 assert.equal(current.presentationPrintSet.entries.length,80);
 for(const [i,entry] of current.presentationPrintSet.entries.entries()){const old=prior.presentationPrintSet.entries.find(e=>e.personId===entry.personId&&e.badgeId===entry.badgeId&&e.medalDisplay===entry.medalDisplay);assert.notEqual(entry.cssSha256,old.cssSha256);assert.notEqual(entry.contentSha256,old.contentSha256);assert.deepEqual({...entry,cssSha256:old.cssSha256,contentSha256:old.contentSha256},old,'Only CSS and the composition hash covering it change');}
 const restored=require('./helpers/honors.cjs').beforeFinalCorrections(current);for(const id of Object.keys(confirmed))delete restored.personDetails[id].runnerLink;delete restored.sources['organizer-v361-confirmed-links'];delete restored.presentationPrintSet;delete prior.presentationPrintSet;assert.deepEqual(restored,prior,'No other registry facts changed');
 const einar=H.findIn(data,'einar-danielsen').member,erling=H.findIn(data,'erling-danielsen').member;assert.equal(H.serviceTenure(data,einar).count,33);assert.equal(H.serviceTenure(data,erling).count,33);assert.equal(current.personDetails['einar-danielsen'].diplomaDate.date,'2026-11-07');
});
test('V3.6.1 all fourteen confirmed links appear on cards and correct profiles at mobile and PC widths',async()=>{
 const h=await createHarness(),data=await readHonors();try{
  for(const width of [390,1440]){const p=await h.browser.newPage({viewport:{width,height:1000}});try{
   for(const [id,runnerId]of Object.entries(confirmed)){
    await p.goto(h.base+'/heder.html');await p.locator(`[data-honoree="${id}"]`).waitFor();const card=p.locator(`[data-honoree="${id}"]`),match=(await card.locator('.honor-card-racing').innerText()).match(/(\d+) løpsdeltakelser/);assert.ok(match,id);
    await card.locator('a').click();await p.locator('#profileName').waitFor();assert.equal(await p.locator('.primary-runner-link').getAttribute('href'),'index.html#lop='+runnerId);assert.equal(await p.locator('.honor-race-metrics b').first().textContent(),match[1]);assert.equal(await p.locator('#profileName').textContent(),H.findIn(data,id).member.name);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
  }finally{await p.close();}}
 }finally{await h.close();}
});
test('V3.6.1 compact profiles preserve every text, medal and touch target at four widths; real A4 PDFs move only the founder marker and retain print checks',async()=>{
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-v361-test-'));try{const result=await review(out,{images:false});assert.equal(result.profileComparisons.length,24);assert.equal(result.diplomas.length,28);assert.deepEqual(result.errors,[]);}finally{await fs.rm(out,{recursive:true,force:true});}
});
