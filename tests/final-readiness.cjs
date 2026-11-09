const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h;
before(async()=>{h=await createHarness();});after(async()=>{await h.close();});
test('main navigation and keyboard-accessible mobile menu reach the honor page without horizontal overflow',async()=>{
 for(const width of [320,390,900,1100,1101,1280,1440]){
  const p=await h.browser.newPage({viewport:{width,height:900}});try{
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(width<=1100){await p.locator('.mobile-menu summary').click();assert.equal(await p.locator('.mobile-menu').getAttribute('open'),'');await p.keyboard.press('Escape');assert.equal(await p.locator('.mobile-menu').getAttribute('open'),null);await p.locator('.mobile-menu summary').press('Enter');await p.locator('.mobile-menu a[href="heder.html"]').click();}
   else await p.locator('.navlinks a[href="heder.html"]').click();
   await p.locator('[data-honoree="oscar-lohne"]').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await p.close();}
 }
});
test('honor profile routes: Oscar is a documented founder, provisional volunteers get their own draft and history works',async()=>{
 for(const width of [320,390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"] a').click();await p.locator('#profileName').waitFor();
   assert.equal(await p.locator('#profileName').textContent(),'Oscar Lohne');assert.match(await p.locator('.profile-role').textContent(),/Grunnlegger/);assert.match(await p.locator('#honorProfile').textContent(),/Ingen dokumentert historie/);
   await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));
   assert.equal(await p.frameLocator('iframe').locator('.diploma-recipient h2').textContent(),'Oscar Lohne');assert.equal(await p.frameLocator('iframe').locator('.diploma-heading h1').textContent(),'GRUNNLEGGERDIPLOM');
   assert.equal(await p.evaluate(async()=>MorothonDiplomas.checkLayout(document.querySelector('iframe').contentDocument).then(r=>r.ready)),true);
   assert.equal(await p.locator('[data-honor-print]').isEnabled(),true);
   await p.evaluate(()=>{window.__honorPrints=0;document.querySelector('iframe').contentWindow.print=()=>window.__honorPrints++;});
   await p.locator('[data-honor-pdf]').click();assert.equal(await p.evaluate(()=>window.__honorPrints),1);
   assert.match(await p.frameLocator('iframe').locator('.diploma-draft').textContent(),/DIPLOMUTKAST · IKKE UTSTEDT/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.goBack();await p.locator('#honorOverview').waitFor({state:'visible'});await p.locator('[data-honoree="dag-morten-frantzen"] a').click();await p.waitForFunction(()=>document.querySelector('#profileName')?.textContent==='Dag Morten Frantzen');
   await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet'));
   assert.match(await p.locator('.profile-role').textContent(),/foreløpig/);assert.equal(await p.frameLocator('iframe').locator('.diploma-recipient h2').textContent(),'Dag Morten Frantzen');assert.equal(await p.frameLocator('iframe').locator('.diploma-heading h1').textContent(),'DUGNADSDIPLOM');
   assert.doesNotMatch(await p.locator('#honorProfile').textContent(),/Floke|Til minne om/);assert.equal(await p.locator('[data-honor-print]').isDisabled(),true);
   assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('profiles display only confirmed sourced stories; individual identities and unknown honor IDs are not guessed',async()=>{
 const data=JSON.parse(await fs.readFile(path.join(__dirname,'../data/honors.json'),'utf8'));data.groups[0].members[0].stories=[{title:'Kontrollert testhistorie',text:'Kun testdata.',source:'Testkilde',confirmed:true},{title:'Ubekreftet',text:'Skal ikke vises.',source:'',confirmed:false}];
 const p=await h.browser.newPage();try{
  await p.route('**/data/honors.json',r=>r.fulfill({json:data}));await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();assert.match(await p.locator('.honor-story').textContent(),/Kun testdata/);assert.doesNotMatch(await p.locator('#honorProfile').textContent(),/Skal ikke vises/);
  await p.evaluate(()=>location.hash='#person/unknown');await p.waitForFunction(()=>document.querySelector('#profileName')?.textContent==='Hedersprofilen finnes ikke');
 }finally{await p.close();}
});
test('1992 fix changes only the conflicting stroke in the native SVG; canonical PNG remains 2400px transparent',async()=>{
 const svg=await fs.readFile(path.join(__dirname,'../assets/medals/service/grunnlegger.svg'),'utf8');assert.doesNotMatch(svg,/M-180 105 H180/);assert.match(svg,/>1992<\/text>/);
 const p=await h.browser.newPage();try{
  await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();
  const r=await p.evaluate(async()=>{const a=await MorothonDiplomas.inspectAsset('service-grunnlegger');const d=await MorothonDiplomas.serviceDraft('oscar-lohne');return {w:a.width,h:a.height,alpha:a.transparent,edge:a.edgeContact,src:a.src,same:document.querySelector('.profile-medal').src===d.asset.src};});
  assert.equal(r.w,2400);assert.equal(r.h,2400);assert.equal(r.alpha,true);assert.equal(r.edge,0);assert.equal(r.same,true);
 }finally{await p.close();}
});
test('unconfirmed founder records cannot appear as documented founder profiles',async()=>{
 const data=JSON.parse(await fs.readFile(path.join(__dirname,'../data/honors.json'),'utf8'));data.groups[0].members[0].status='provisional';
 const p=await h.browser.newPage();try{
  await p.route('**/data/honors.json',r=>r.fulfill({json:data}));await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.waitForFunction(()=>document.querySelector('#honorStatus').textContent.includes('Grunnleggerstatus må være bekreftet'));
  assert.equal(await p.locator('.profile-role').count(),0);
 }finally{await p.close();}
});
