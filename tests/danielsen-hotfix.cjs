const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),source='organizer-danielsen-estimate-correction';let data,years,h;
before(async()=>{data=await readHonors();years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);h=await createHarness();});
after(async()=>{await h?.close();});

test('Danielsen hotfix moves only the sourced estimate and removes its incorrect attribution, without changing identities, awards or formal approvals',async()=>{
 const baseline=JSON.parse(execFileSync('git',['show','52ead66:data/honors.json'],{cwd:root})),old=baseline.groups.flatMap(g=>g.members),einar=H.findIn(data,'einar-danielsen').member,erling=H.findIn(data,'erling-danielsen').member;
 assert.deepEqual(einar.serviceEstimate,{editions:33,qualifier:'approximately',sourceIds:[source],unit:'years'});assert.equal(erling.serviceEstimate,undefined);
 assert.equal(H.contribution(einar).count,0);assert.equal(H.provisionalMilestone(data,einar,years).count,33);
 assert.equal(H.mainBadge(data,einar,years).badgeId,'service-aeresmerke');assert.equal(H.mainBadge(data,einar,years).count,33);
 assert.equal(H.mainBadge(data,erling,years).badgeId,'service-memorial');assert.equal(H.mainBadge(data,erling,years).count,null);
 for(const previous of old){
  const expected=structuredClone(previous);
  if(previous.id==='einar-danielsen'){expected.serviceEstimate=einar.serviceEstimate;expected.sourceIds.push(source,'organizer-v352');expected.contribution=einar.contribution;}
  if(previous.id==='erling-danielsen'){delete expected.serviceEstimate;expected.sourceIds.push(source);expected.reason='Med på dugnad fra 1992 og en av dem som har bidratt aller lengst. Vi minnes Erling og innsatsen hans med takknemlighet.';}
  assert.deepEqual(H.findIn(data,previous.id).member,expected,previous.id);
 }
 assert.equal(data.presentationPrintSet.entries.length,88);assert.deepEqual(data.diplomaApprovals,baseline.diplomaApprovals);
 for(const file of ['data/history.json','data/volunteers.json','data/badges.json'])assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show','52ead66:'+file],{cwd:root}),file);
 for(const file of ['honors.md','v35-personregister.md','v35-sluttrapport.md','v351-sluttrapport.md'])assert.doesNotMatch(await fs.readFile(path.join(root,'docs',file),'utf8'),/Erlings anslag|Erling Danielsens om lag 33|Erling Danielsen[^\n|]*\|[^\n]*Om lag 33/);
});

test('Danielsen hotfix shows 33 years of service only on Einar at mobile/desktop widths; both clean diplomas retain the correct identities and printable content',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="einar-danielsen"]').waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),44);
   assert.match(await p.locator('[data-honoree="einar-danielsen"]').innerText(),/33 dugnadsutgaver/);
   assert.doesNotMatch(await p.locator('#memorial').innerText(),/33|null|undefined/);
   assert.match(await p.locator('[data-honoree="erling-danielsen"]').innerText(),/fra 1992.*aller lengst/s);
   for(const id of ['einar-danielsen','erling-danielsen']){
    await p.goto(h.base+'/heder.html#person/'+id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,H.findIn(data,id).member.name);
    const header=await p.locator('.honor-profile-header').innerText();
    if(id==='einar-danielsen'){assert.match(header,/33 dugnadsutgaver/);assert.doesNotMatch(header,/anslag|anslår|rundt|om lag/i);assert.match(header,/Grunnlegger/);assert.match(header,/planlagt i 2026/);}
    else{assert.doesNotMatch(header,/33|null|undefined/);assert.match(header,/fra 1992.*aller lengst/s);}
    await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
    const model=await p.evaluate(async id=>{const d=await MorothonDiplomas.serviceDraft(id);return {mode:d.printMode,proof:d.contentProof.contentSha256,text:document.querySelector('iframe').contentDocument.body.textContent};},id);
    assert.equal(model.mode,'presentation');assert.equal(model.proof,data.presentationPrintSet.entries.find(e=>e.personId===id).contentSha256);
    assert.doesNotMatch(model.text,/UTKAST|FORHÅNDSVISNING/);if(id==='einar-danielsen')assert.match(model.text,/33/);else assert.doesNotMatch(model.text,/33/);assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
