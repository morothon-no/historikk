const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs'),{createHarness}=require('../scripts/diploma-harness.cjs');
let h,data;before(async()=>{data=await readHonors();h=await createHarness();});after(async()=>{await h?.close();});
const examples=['oscar-lohne','erling-askildsen','einar-danielsen','dag-morten-frantzen','finn-lohne'];
test('V3.5.2 all overview cards show complete unique honors from the shared profile, with a dominant main medal and unclipped mobile/desktop rows',async()=>{
 for(const width of [320,390,768,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();assert.equal(await p.locator('[data-honoree]').count(),44);
   for(const m of data.groups.flatMap(g=>g.members)){
    const state=H.honorProfile(data,m),card=p.locator(`[data-honoree="${m.id}"]`),expected=[state.main.badgeId,...state.secondaryHonorIds,...state.collectionIds].filter(Boolean);
    const images=await card.locator('img').evaluateAll(es=>es.map(e=>({src:e.src,alt:e.alt,loaded:e.complete&&e.naturalWidth>0,primary:e.classList.contains('honor-card-medal')})));
    assert.equal(images.length,expected.length,m.id);assert.equal(new Set(images.map(i=>i.src)).size,images.length,m.id);assert.ok(images.every(i=>i.loaded&&i.alt));
    const registry=await p.evaluate(()=>MorothonBadges.list());for(const id of expected)assert.ok(images.some(i=>i.src.endsWith(registry.find(b=>b.id===id).src)),m.id+': '+id);
    assert.equal(images.filter(i=>i.primary).length,state.main.badgeId?1:0);
   }
   for(const id of examples){
    const card=p.locator(`[data-honoree="${id}"]`),r=await card.evaluate(e=>{const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};return {card:rect(e),main:rect(e.querySelector('.honor-card-medal')),footer:rect(e.querySelector('.honor-card-collection')),images:[...e.querySelectorAll('.honor-card-collection img')].map(rect)};});
    assert.ok(r.footer.top>=r.main.bottom+8,id+': space before the collection');
    for(const b of r.images){assert.ok(b.width>0&&b.height>0);assert.ok(r.main.width>b.width*1.3,id+': principal medal stays largest');assert.ok(b.left>=r.card.left&&b.right<=r.card.right&&b.top>=r.card.top&&b.bottom<=r.card.bottom,id+': no clipping');}
    for(let i=0;i<r.images.length;i++)for(let j=i+1;j<r.images.length;j++){const a=r.images[i],b=r.images[j];assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top),id+': no overlapping medals');}
    assert.equal(await card.locator('.honor-card-extra-honors img').count(),['oscar-lohne','erling-askildsen','einar-danielsen'].includes(id)?1:0);
    assert.equal(await card.locator('.honor-card-earned img').count(),['dag-morten-frantzen','finn-lohne'].includes(id)?1:5);
   }
   const memorial=p.locator('[data-honoree="erling-danielsen"]');assert.equal(await memorial.locator('img').count(),1);assert.match(await memorial.innerText(),/fra 1992/);assert.doesNotMatch(await memorial.innerText(),/35|33/);
   assert.match(await p.locator('[data-honoree="einar-danielsen"]').innerText(),/33 dugnadsutgaver/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('V3.5.2 both diploma choices preserve every overview/profile medal before and after returning to the overview',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   for(const id of examples){
    const card=p.locator(`[data-honoree="${id}"]`),before=await card.locator('img').evaluateAll(es=>es.map(e=>e.src));await card.locator('.honor-person-main').click();
    const m=H.findIn(data,id).member;await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,m.name);
    const profile=p.locator('#honorProfile img'),profileBefore=await profile.evaluateAll(es=>es.map(e=>e.src));assert.deepEqual([...profileBefore].sort(),[...before].sort());
    await p.locator('.diploma-example>summary').click();for(const display of ['latest','all']){
     await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);
     assert.deepEqual(await card.locator('img').evaluateAll(es=>es.map(e=>e.src)),before);assert.deepEqual(await profile.evaluateAll(es=>es.map(e=>e.src)),profileBefore);assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
    }
    await p.locator('#honorProfile>a.back').click();await p.locator('#honorOverview').waitFor({state:'visible'});assert.deepEqual(await card.locator('img').evaluateAll(es=>es.map(e=>e.src)),before);
   }
  }finally{await p.close();}
 }
});
