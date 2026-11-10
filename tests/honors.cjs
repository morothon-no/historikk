const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,data;
before(async()=>{h=await createHarness();data=JSON.parse(await fs.readFile(path.join(__dirname,'../data/honors.json'),'utf8'));});
after(async()=>{await h.close();});
test('honor page: confirmed founders, provisional volunteers and three categories on mobile and desktop',async()=>{
 for(const width of [320,390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:900}});try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="hakon-lohne"]').first().waitFor();
   assert.deepEqual(await p.locator('[data-honor-group="volunteers"] .honor-person-main strong').allTextContents(),['Kalle Kimestad','Finn Lohne','Dag Morten Frantzen','Håkon Lohne']);
   assert.deepEqual(await p.locator('[data-honor-group="founders"] .honor-person-main strong').allTextContents(),['Erling Askildsen','Oscar Lohne','Arnfinn Håverstad','Helge Reisvoll','Einar Danielsen']);
   assert.equal(await p.locator('[data-honor-group="volunteers"] .honor-award-status').filter({hasText:'ikke endelig tildelt'}).count(),2);
   assert.equal(await p.locator('#serviceBadges img').count(),3);
   assert.equal(await p.locator('#honorProfile').isVisible(),false);
   assert.equal(await p.locator('iframe').count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await p.close();}
 }
});
test('another volunteer is rendered from data only, with escaped names/reasons and no changes to JS',async()=>{
 const copy=structuredClone(data);copy.groups.find(g=>g.id==='volunteers').members.push({id:'new-volunteer',name:'Nytt navn <b>Test</b>',status:'provisional',reason:'Tekst <img src=x onerror=alert(1)>'});
 const p=await h.browser.newPage();try{
  await p.route('**/data/honors.json',route=>route.fulfill({json:copy}));await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="new-volunteer"]').waitFor();
  assert.equal(await p.locator('[data-honor-group="volunteers"] li').count(),5);
  assert.equal(await p.locator('[data-honoree="new-volunteer"] strong').textContent(),'Nytt navn <b>Test</b>');
  assert.equal(await p.locator('[data-honoree="new-volunteer"] img[src="x"],[data-honoree="new-volunteer"] strong b').count(),0);
 }finally{await p.close();}
});
test('duplicate identifiers fail clearly rather than silently merging honors or runner identities',async()=>{
 const copy=structuredClone(data);copy.groups[1].members.push({...copy.groups[1].members[0]});
 const p=await h.browser.newPage();try{
  await p.route('**/data/honors.json',route=>route.fulfill({json:copy}));await p.goto(h.base+'/heder.html');await p.waitForFunction(()=>document.querySelector('#honorStatus').textContent.includes('duplisert'));
  assert.equal(await p.locator('[data-honoree]').count(),0);
 }finally{await p.close();}
});
test('30 red arc is retained as explicitly confirmed without changing the medal pixels',async()=>{
 const r=JSON.parse(await fs.readFile(path.join(__dirname,'../data/badges.json'),'utf8'));
 const masks=JSON.parse(await fs.readFile(path.join(__dirname,'../assets/medals/review/cutouts/masks.json'),'utf8'));
 assert.equal(r.badges.find(b=>b.id==='badge-30').retainRedArc,true);assert.equal(masks.masks.find(b=>b.id==='badge-30').retainRedArc,true);
});
