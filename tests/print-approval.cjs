const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,registry;
before(async()=>{h=await createHarness();registry=JSON.parse(await fs.readFile(path.join(__dirname,'../data/badges.json'),'utf8'));});after(async()=>{await h.close();});
test('explicit print approval activates exact files without inventing resolution or changing source detail',async()=>{
 assert.equal(registry.minimumDpi,300);
 for(const b of registry.badges.filter(b=>['participation','record'].includes(b.kind))){
  assert.equal(b.printReady,true);const data=await fs.readFile(path.join(__dirname,'..',b.src));assert.equal(createHash('sha256').update(data).digest('hex'),b.printApproval.sha256);
  if(b.controlledCutoutDraft)assert.deepEqual(data,await fs.readFile(path.join(__dirname,'..',b.controlledCutoutDraft.src)));
 }
 const p=await h.browser.newPage();try{
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  const r=await p.evaluate(async()=>{const a=await MorothonDiplomas.inspectAsset('badge-5'),d=await MorothonDiplomas.prepare('MOR-15AF3A3','badge:5');return {dpi:a.dpi,minimum:a.minimumDpi,approved:a.userApproved,ready:a.ready,warnings:a.warnings,imageReady:d.imageReady};});
  assert.ok(r.dpi<300);assert.equal(r.minimum,300);assert.equal(r.approved,true);assert.equal(r.ready,true);assert.equal(r.imageReady,true);assert.ok(r.warnings.some(w=>w.includes('ikke en 300 DPI-original')));
 }finally{await p.close();}
});
test('lower-DPI exception is tied to the approved bytes; missing or altered approval cannot bypass checks',async()=>{
 for(const mode of ['missing','bad-hash','changed-file']){
  const data=structuredClone(registry),b=data.badges.find(b=>b.id==='badge-5');
  if(mode==='missing')delete b.printApproval;
  if(mode==='bad-hash')b.printApproval.sha256='other-file';
  if(mode==='changed-file')b.src=data.badges.find(b=>b.id==='record').src;
  const p=await h.browser.newPage();try{
   await p.route('**/data/badges.json',route=>route.fulfill({json:data}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
   assert.equal(await p.evaluate(async()=> (await MorothonDiplomas.inspectAsset('badge-5')).ready),false);
  }finally{await p.close();}
 }
});
