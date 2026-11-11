const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const {readHonors}=require('./helpers/honors.cjs');

const root=path.resolve(__dirname,'..');let h,data;
before(async()=>{h=await createHarness();data=await readHonors();});
after(async()=>{await h?.close();});

test('aeresmerke is the independent design-only top distinction with no automatic threshold',async()=>{
 const b=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const service=b.badges.filter(x=>x.kind==='service');
 assert.deepEqual(service.map(x=>x.id),['service-dugnadshelt','service-dugnad-5','service-dugnad-10','service-dugnad-15','service-dugnad-20','service-dugnad-30','service-dugnad-40','service-hedersildsjel','service-aeresmerke','service-grunnlegger','service-memorial']);
 const a=service.find(b=>b.id==='service-aeresmerke');
 assert.equal(a.name,'Morothons æresmerke');
 assert.equal(a.status,'design-draft');assert.equal(a.printReady,false);
 assert.equal(a.cropReviewed,false);assert.equal(a.widthMm,55);
 const svg=await fs.readFile(path.join(root,a.src),'utf8');
 assert.match(svg,/<svg\b/);assert.match(svg,/>MOROTHONS<\/text>/);assert.match(svg,/>ÆRESMERKE<\/text>/);
 assert.doesNotMatch(svg,/>35<\/text>|<script|<foreignObject|<image/i);
 const p=data.awardPolicy;
 assert.equal(p.milestones[0].minimumDocumentedEditions,5);
 assert.equal(p.milestones[1].minimumDocumentedEditions,10);
 assert.deepEqual(p.milestones.map(m=>m.minimumDocumentedEditions),[5,10,15,20,30,40]);
 assert.equal(p.specialHonors.find(m=>m.badgeId==='service-aeresmerke').rule.includes('Ingen årsterskel'),true);
});

test('Oscar and Erling have only proposed highest honor, never issued awards or diplomas',async()=>{
 for(const id of ['oscar-lohne','erling-askildsen']){
  const m=data.groups.flatMap(g=>g.members).find(m=>m.id===id);
  assert.ok(m);assert.equal(m.badgeProposal.primaryBadgeId,'service-aeresmerke');
  assert.deepEqual(m.badgeProposal.badgeIds,['service-aeresmerke']);
  assert.equal(m.contribution.confirmedYears.length,35);
  assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);
  assert.match(m.diplomaTribute,/35 utgaver/);
 }
 for(const e of data.diplomaExamples.filter(e=>['oscar-35','erling-35'].includes(e.id)))assert.equal(e.badgeId,'service-aeresmerke');
});

test('highest-honor page and each A4 preview remain visually contained and impossible to print',async()=>{
 for(const width of [390,1440]){
  const page=await h.browser.newPage({viewport:{width,height:1100}});
  try{
   await page.goto(h.base+'/heder.html');
   await page.locator('#serviceBadges img').first().waitFor({state:'attached'});
   assert.equal(await page.locator('#serviceBadges img').count(),9);
   assert.equal(await page.locator('a[href*="heder.html"]').count(),0);
   for(const id of ['oscar-lohne','erling-askildsen']){
    await page.goto(h.base+'/heder.html#person/'+id);
    await page.locator('#profileName').waitFor();
    await page.waitForFunction(()=>document.querySelector('.profile-medal')?.complete);
    assert.match(await page.locator('.profile-medal').getAttribute('src'),/aeresmerke\.svg$/);
    assert.equal(await page.locator('.honor-secondary-badges img').count(),0);
    await page.locator('.diploma-example>summary').click();
    await page.waitForFunction(()=>document.querySelector('.honor-diploma-status')?.textContent.includes('A4-utkast kontrollert'));
    const q=await page.evaluate(async()=>{
      const d=await MorothonDiplomas.serviceDraft(location.hash.split('/').at(-1));
      const doc=document.querySelector('.diploma-example iframe').contentDocument;
      const layout=await MorothonDiplomas.checkLayout(doc);
      const img=await MorothonDiplomas.inspectAsset('service-aeresmerke');
      return {title:doc.querySelector('.diploma-heading h1').textContent,
        secondary:doc.querySelectorAll('.diploma-service-secondary img').length,
        fit:document.documentElement.scrollWidth<=innerWidth,
        layout:layout.ready,reason:layout.failures,preview:d.previewOnly,
        canPrint:d.imageReady,approved:img.ready,
        dims:[img.width,img.height],transparent:img.transparent,
        printed:document.querySelectorAll('[data-honor-print],[data-honor-pdf],[data-diploma-print],[data-diploma-pdf]').length};
    });
    assert.equal(q.title,'ÆRESDIPLOM');
    assert.equal(q.secondary,0);assert.equal(q.layout,true,q.reason.join(' '));
    assert.equal(q.fit,true);assert.equal(q.preview,true);assert.equal(q.canPrint,false);
    assert.equal(q.approved,false);assert.equal(q.transparent,true);
    assert.deepEqual(q.dims,[2400,2400]);assert.equal(q.printed,2);
   }
  }finally{await page.close();}
 }
});
