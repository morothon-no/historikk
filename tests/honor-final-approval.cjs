const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs'),{approvalFixture}=require('./helpers/honor-approval.cjs');
let h;before(async()=>{h=await createHarness();});after(async()=>{await h?.close();});
const open=async p=>{await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);};
test('professional honor overview, cards, profiles and gallery avoid redundant draft wording while preserving estimates and proposals',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.doesNotMatch(await p.title(),/utkast|forhåndsvisning/i);
   assert.doesNotMatch(await p.locator('body').innerText(),/utkast|ikke utdelt|under utvikling/i);
   assert.match(await p.locator('[data-honoree="hakon-lohne"]').innerText(),/12 dugnadsutgaver · 2014–2026/);
   assert.doesNotMatch(await p.locator('[data-honoree="oscar-lohne"]').innerText(),/forslag/);
   await p.locator('.honor-diploma-examples>summary').click();
   assert.doesNotMatch(await p.locator('#honorExamples').innerText(),/utkast|ikke utdelt/i);
   assert.ok((await p.locator('#honorExamples summary').allTextContents()).filter(t=>t==='Vis diplom').length>=11);
   await p.goto(h.base+'/heder.html#person/hakon-lohne');await p.locator('#profileName').waitFor();
   assert.doesNotMatch(await p.locator('#honorProfile').innerText(),/utkast|ikke utdelt/i);await open(p);
   assert.equal(await p.locator('.honor-draft-notice').isVisible(),false);
   assert.equal(await p.frameLocator('iframe').locator('.diploma-draft').count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');
  }finally{await p.close();}
 }
 const core=JSON.parse(await fs.readFile(path.resolve(__dirname,'../data/honors.json'),'utf8'));assert.deepEqual(core.diplomaApprovals,[]);
});
test('only explicit recipient/content approval plus approved graphics allows a final PDF without draft wording, never an automatic award',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});try{
   const {id}=await approvalFixture(p,h.base);await open(p);
   const d=await p.evaluate(id=>MorothonDiplomas.serviceDraft(id),id);assert.equal(d.printMode,'final');assert.equal(d.imageReady,true);
   assert.equal(await p.locator('.honor-draft-notice').isVisible(),false);
   assert.equal(await p.frameLocator('iframe').locator('.diploma-draft').count(),0);
   assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
   assert.doesNotMatch(await p.frameLocator('iframe').locator('body').innerText(),/utkast|ikke utdelt/i);
   await p.locator('iframe').evaluate(e=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;});
   for(const action of ['[data-honor-print]','[data-honor-pdf]']){await p.locator(action).click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]').disabled);}
   assert.equal(await p.locator('iframe').evaluate(e=>e.contentWindow.__prints),2);
   const states=await p.evaluate(async id=>{const m=(await MorothonHonorsData.find(id)).member;return [m.awards,m.issuedDiplomas];},id);assert.deepEqual(states,[[],[]]);
   const q=await h.browser.newPage();try{
    await q.setContent(await p.locator('iframe').getAttribute('srcdoc'));await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
    assert.match(execFileSync('pdfinfo',['-'],{input:pdf}).toString(),/Pages:\s+1\b/);
    const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');assert.doesNotMatch(text,/UTKAST|IKKE UTDELT/);assert.match(text,/Kontrollperson/);assert.match(text,/Håkon Lohne/);
   }finally{await q.close();}
  }finally{await p.close();}
 }
 // The same reviewed content must survive Pages' cache URLs and a new origin.
 const tmp=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'honor-final-build-'));
 let built;const p=await h.browser.newPage();
 try{
  const fixture=await approvalFixture(p,h.base),site=await require('../scripts/build-site.cjs').buildSite(path.join(tmp,'site'));
  built=await createHarness({rootDir:site.out});const q=await built.browser.newPage();
  await q.route('**/data/honors.json',r=>r.fulfill({json:fixture.core}));
  await q.goto(built.base+'/heder.html#person/'+fixture.id);await q.locator('#profileName').waitFor();await open(q);
  const d=await q.evaluate(id=>MorothonDiplomas.serviceDraft(id),fixture.id);
  assert.equal(d.contentProof.contentSha256,fixture.proof.contentSha256);assert.equal(d.printMode,'final');
  assert.equal(await q.locator('[data-honor-pdf]').isEnabled(),true);
 }finally{await p.close();await built?.close();await fs.rm(tmp,{recursive:true,force:true});}
});
test('missing, wrong-recipient, stale-content or unapproved-graphic approval keeps a clearly marked printable draft',async()=>{
 for(const options of [{approve:false},{changeRecord:a=>a.personId='oscar-lohne'},{changeRecord:a=>a.contentSha256='0'.repeat(64)},{badgeId:'service-dugnad-10'}]){
  const p=await h.browser.newPage();try{
   const {id}=await approvalFixture(p,h.base,options);await open(p);
   assert.equal(await p.evaluate(async id=>(await MorothonDiplomas.serviceDraft(id)).printMode,id),'draft');
   assert.equal(await p.frameLocator('iframe').locator('.diploma-draft').isVisible(),true);
   assert.equal(await p.locator('.honor-draft-notice').isVisible(),true);
   assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
  }finally{await p.close();}
 }
});
test('final output revalidates approved content and graphics; forged flags, changed text/CSS and real clipping cannot bypass print gates',async()=>{
 for(const fault of ['text','css','clip','flags']){
  const p=await h.browser.newPage();try{
   const {id}=await approvalFixture(p,h.base,{approve:fault!=='flags'});await open(p);
   if(fault==='css'){
    const css=await fs.readFile(path.resolve(__dirname,'../css/diplomas.css'),'utf8');await p.route('**/css/diplomas.css*',r=>r.fulfill({body:css+'\n.diploma-service{color:#123456}',contentType:'text/css'}));
   }else if(fault==='text')await p.locator('iframe').evaluate(e=>e.contentDocument.querySelector('.diploma-description').textContent='Changed after approval');
   else if(fault==='clip')await p.locator('iframe').evaluate(e=>{const n=e.contentDocument.querySelector('.diploma-recipient h2');n.style.height='1mm';n.style.overflow='hidden';});
   if(fault==='flags'){
    const r=await p.evaluate(async id=>{const d=await MorothonDiplomas.serviceDraft(id);d.printMode='final';d.finalApproval={verified:true};d.imageReady=true;d.ready=true;return MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument);},id);
    assert.equal(r.ready,false);assert.match(r.failures.join(' '),/godkjenning/);
   }else{
    await p.locator('iframe').evaluate(e=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;});
    await p.locator('[data-honor-print]').click();await p.waitForFunction(()=>!document.querySelector('.honor-diploma-status').textContent.startsWith('Diplomet er kontrollert'));
    assert.equal(await p.locator('[data-honor-print]').isEnabled(),false,fault);assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),false,fault);assert.equal(await p.locator('iframe').evaluate(e=>e.contentWindow.__prints),0);
   }
  }finally{await p.close();}
 }
});
test('final approval metadata requires a named recipient, source, unique identity and exact reviewed hash',async()=>{
 const p=await h.browser.newPage();try{
  const {core,record}=await approvalFixture(p,h.base);
  const failures=await p.evaluate(({core,record})=>{
   const variants=[{...record,sourceIds:[]},{...record,contentSha256:'invalid'},{...record,approvedForFinal:false},{...record,personId:'unknown'}];
   return variants.map(a=>{const d=structuredClone(core);d.diplomaApprovals=[a];try{MorothonHonorsData.validate(d);return false;}catch{return true;}}).concat([(()=>{const d=structuredClone(core);d.diplomaApprovals.push({...record});try{MorothonHonorsData.validate(d);return false;}catch{return true;}})()]);
  },{core,record});assert.deepEqual(failures,[true,true,true,true,true]);
 }finally{await p.close();}
});
test('approved final printing preserves estimated volunteer years and never changes an estimate into a documented award',async()=>{
 const p=await h.browser.newPage();try{
  const registry=JSON.parse(await fs.readFile(path.resolve(__dirname,'../data/badges.json'),'utf8')),badge=registry.badges.find(b=>b.id==='service-dugnad-10');
  const bytes=await fs.readFile(path.resolve(__dirname,'../',badge.src)),digest=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  for(const b of registry.badges.filter(b=>b.id==='service-dugnad-5')){const bytes=await fs.readFile(path.resolve(__dirname,'../',b.src)),sha=require('node:crypto').createHash('sha256').update(bytes).digest('hex');Object.assign(b,{status:'fixture-approved',printReady:true,cropReviewed:true,reviewedSha256:sha,printApproval:{sha256:sha}});}
  Object.assign(badge,{status:'fixture-approved',printReady:true,cropReviewed:true,reviewedSha256:digest,printApproval:{sha256:digest}});
  await p.route('**/data/badges.json',r=>r.fulfill({json:registry}));
  const {id}=await approvalFixture(p,h.base,{badgeId:badge.id,estimated:true});await open(p);
  await p.selectOption('.honor-choice select','all');await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled&&document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-metric span')?.textContent==='DUGNADSUTGAVER');
  const d=await p.evaluate(({id,badgeId})=>MorothonDiplomas.serviceDraft(id,badgeId),{id,badgeId:badge.id});
  assert.equal(d.printMode,'final');assert.equal(d.estimated,undefined);assert.equal(d.contributionCount,13);assert.equal(d.achievementYear,2023);
  assert.match(await p.frameLocator('iframe').locator('body').innerText(),/DUGNADSUTGAVER/);
  assert.doesNotMatch(await p.frameLocator('iframe').locator('body').innerText(),/anslag|MULIGE/);
  assert.equal(await p.frameLocator('iframe').locator('.diploma-draft').count(),0);
  const m=await p.evaluate(async id=>(await MorothonHonorsData.find(id)).member,id);
  assert.equal(m.contribution.confirmedYears,undefined);assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
 }finally{await p.close();}
});
