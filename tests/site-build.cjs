const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {buildSite}=require('../scripts/build-site.cjs');
const {createHarness}=require('../scripts/diploma-harness.cjs');
test('Pages artifact contains approved runtime assets and excludes QA, source archives and rejected designs',async()=>{
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-public-site-'));
 try{
  const result=await buildSite(out);
  assert.ok(result.files.includes('data/history.json'));assert.ok(result.files.includes('data/volunteers.json'));assert.ok(result.files.includes('heder.html'));
  assert.ok(result.files.includes('assets/medals/approved/participation-5.png'));
  assert.ok(result.files.includes('assets/medals/watermarks/morothon-runner-approved.png'));
  for(const file of ['assets/fonts/caveat-regular-latin.woff','assets/fonts/OFL-Caveat.txt'])assert.deepEqual(await fs.readFile(path.join(out,file)),await fs.readFile(path.resolve(__dirname,'..',file)));
  assert.ok(result.files.every(f=>!/(^tests\/|^scripts\/|^docs\/|review|originals|rejected|backup|alpha\.png)/.test(f)));
  const registry=JSON.parse(await fs.readFile(path.join(out,'data/badges.json'),'utf8'));
  for(const badge of registry.badges)assert.equal((await fs.stat(path.join(out,badge.src))).isFile(),true);
  assert.equal(registry.watermark.posterRunnerDraft,undefined);assert.equal(registry.watermark.textRemovalDraft,undefined);
  await assert.rejects(()=>buildSite(out),/must be empty/);
  const h=await createHarness({rootDir:out});
  try{
   const p=await h.browser.newPage({viewport:{width:390,height:844}}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))errors.push(r.url());});
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
   await p.locator('.mobile-menu summary').click();assert.equal(await p.locator('a[href="heder.html"]').count(),0);await p.goto(h.base+'/heder.html');
   await p.locator('[data-honoree="anne-lene-forland-hansen"]').waitFor();assert.equal(await p.locator('[data-honoree]').count(),43);assert.equal(await p.locator('[data-honoree="anne-lene-forland-hansen"]').count(),1);await p.locator('[data-honoree="oscar-lohne"] .honor-person-main').click();await p.locator('#profileName').waitFor();
   assert.equal(await p.locator('#profileName').textContent(),'Oscar Lohne');
   await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
   const diploma=await p.evaluate(async()=>{const doc=document.querySelector('iframe').contentDocument,d=await MorothonDiplomas.serviceDraft('oscar-lohne');return {font:[...doc.fonts].some(f=>f.family.includes('Morothon Caveat')&&f.status==='loaded'),date:doc.querySelector('.diploma-date p').textContent,checked:await MorothonDiplomas.checkServiceDraft(d,doc)};});
   assert.equal(diploma.font,true);assert.equal(diploma.date,'Søgne, 7. november 2026');assert.equal(diploma.checked.ready,true,diploma.checked.failures.join(' '));
   assert.deepEqual(errors,[]);
  }finally{await h.close();}
 }finally{await fs.rm(out,{recursive:true,force:true});}
});
