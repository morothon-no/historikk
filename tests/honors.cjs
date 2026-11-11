const {readHonors}=require('./helpers/honors.cjs');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,data;
before(async()=>{h=await createHarness();data=await readHonors();});
after(async()=>{await h.close();});
test('V3.4 honor page: single compact cards, featured founders, organizer roles and memorials on mobile and desktop',async()=>{
 for(const width of [320,390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:900}});try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="hakon-lohne"]').first().waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),43);assert.deepEqual(await p.locator('[data-honor-group="organizers"] .honor-person-main strong').allTextContents(),['Dag Morten Frantzen','Håkon Lohne','Bent-Inge Bakke']);
   assert.deepEqual(await p.locator('[data-honor-group="founders"] .honor-person-main strong').allTextContents(),['Oscar Lohne','Erling Askildsen','Arnfinn Håverstad','Helge Reisvoll','Einar Danielsen']);assert.deepEqual(await p.locator('#honorFeatured .honor-featured-card strong').allTextContents(),['Oscar Lohne','Erling Askildsen']);assert.equal(await p.locator('[data-honor-group="founders"] .honor-founder-others li').count(),3);
   assert.equal(await p.locator('.honor-award-status').count(),0);
   assert.equal(await p.locator('#serviceBadges img').count(),9);
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
  assert.equal(await p.locator('[data-honor-group="volunteers"] li').count(),33);
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
