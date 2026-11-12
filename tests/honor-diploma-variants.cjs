const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
let data,h;before(async()=>{data=await readHonors();h=await createHarness();});after(async()=>{await h?.close();});
test('V3.5.2 both diploma variants have separate reviewed fingerprints for all 44 recipients and enforce the highest principal award',async()=>{
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  assert.equal(data.presentationPrintSet.entries.length,88);
  for(const m of data.groups.flatMap(g=>g.members)){
   const state=H.honorProfile(data,m),expected=state.main.badgeId||'thanks';assert.deepEqual(H.diplomaChoices(data,m),[expected]);
   const pair=[];for(const display of ['all','latest']){
    const d=await p.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id:m.id,display});
    assert.equal(d.assetKey,expected==='thanks'?'debut':expected);assert.equal(d.medalDisplay,display);assert.equal(d.printMode,'presentation',m.id+': '+display);
    assert.deepEqual(d.collectionAssets.map(a=>a.key),display==='all'?state.collectionIds:[]);
    assert.equal(!!d.founderAsset,state.secondaryHonorIds.includes('service-grunnlegger'));
    assert.ok(data.presentationPrintSet.entries.some(e=>e.personId===m.id&&e.badgeId===expected&&e.medalDisplay===display&&e.contentSha256===d.contentProof.contentSha256));pair.push(d.contentProof.contentSha256);
   }
   assert.notEqual(pair[0],pair[1]);assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
  }
  for(const [id,badgeId]of [['dag-morten-frantzen','service-dugnad-5'],['oscar-lohne','service-dugnad-30'],['einar-danielsen','service-grunnlegger']]){
   assert.equal(H.canPresent(data,H.findIn(data,id).member,badgeId),false);
   assert.equal(await p.evaluate(async({id,badgeId})=>{try{await MorothonDiplomas.serviceDraft(id,badgeId);return false;}catch{return true;}},{id,badgeId}),true);
  }
 }finally{await p.close();}
});
test('V3.5.2 mobile/PC switches only the smaller collection, preserves profile medals, and exports both variants as clean single-page A4 PDFs',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});try{
   for(const id of ['dag-morten-frantzen','oscar-lohne','einar-danielsen']){
    const m=H.findIn(data,id).member,state=H.honorProfile(data,m);await p.goto(h.base+'/heder.html#person/'+id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,m.name);
    const profile=await p.locator('#honorProfile>section.honor-earned-marks img').evaluateAll(es=>es.map(e=>e.src));assert.equal(profile.length,state.collectionIds.length);
    await p.locator('.diploma-example>summary').click();
    assert.deepEqual(await p.locator('.honor-choice option').allTextContents(),['Alle merker','Kun siste merke']);
    for(const display of ['all','latest','all']){
     await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);
     const frame=p.locator('iframe'),r=await frame.evaluate(e=>{const d=e.contentDocument,main=d.querySelector('.diploma-medal');return {main:main.src,width:main.getBoundingClientRect().width,small:[...d.querySelectorAll('.diploma-service-founder img,.diploma-service-collection img')].map(e=>e.getBoundingClientRect().width),collection:d.querySelectorAll('.diploma-service-collection img').length,founder:d.querySelectorAll('.diploma-service-founder img').length};});
     assert.ok(r.main.includes(state.main.badgeId==='service-aeresmerke'?'aeresmerke':'dugnad-10'));assert.equal(r.collection,display==='all'?state.collectionIds.length:0);assert.equal(r.founder,id==='dag-morten-frantzen'?0:1);assert.ok(r.small.every(w=>r.width>w*1.8));
     assert.deepEqual(await p.locator('#honorProfile>section.honor-earned-marks img').evaluateAll(es=>es.map(e=>e.src)),profile);
     await frame.evaluate(e=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;});
     for(const action of ['[data-honor-print]','[data-honor-pdf]']){await p.locator(action).click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]').disabled);}
     assert.equal(await frame.evaluate(e=>e.contentWindow.__prints),2);
     if(display==='latest'||display==='all'){
      const q=await h.browser.newPage();try{await q.setContent(await frame.getAttribute('srcdoc'));await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
       const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);assert.match(info,/841\.\d+ x 594|841\.\d+ x 595/);assert.ok(text.replace(/\s+/g,' ').includes(m.name));assert.doesNotMatch(text,/UTKAST|FORHÅNDSVISNING/);
      }finally{await q.close();}
     }
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('V3.5.2 variant approval cannot be swapped, duplicated or used to print a lower principal medal',async()=>{
 const duplicate=structuredClone(data);duplicate.presentationPrintSet.entries.push(structuredClone(duplicate.presentationPrintSet.entries[0]));
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html#person/dag-morten-frantzen');await p.locator('#profileName').waitFor();
  assert.equal(await p.evaluate(d=>{try{MorothonHonorsData.validate(d);return false;}catch{return true;}},duplicate),true);
  await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
  const invalid=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('dag-morten-frantzen');d.medalDisplay='latest';return MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument);});
  assert.equal(invalid.ready,false);assert.match(invalid.failures.join(' '),/utskriftssett/);
  assert.equal(H.serviceTenure(data,H.findIn(data,'erling-danielsen').member).count,null);assert.equal(H.serviceTenure(data,H.findIn(data,'einar-danielsen').member).count,33);
 }finally{await p.close();}
});
