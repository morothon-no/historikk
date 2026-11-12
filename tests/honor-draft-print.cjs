const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('../js/honors-data.js'),{readHonors}=require('./helpers/honors.cjs');
const {createHarness}=require('../scripts/diploma-harness.cjs'),{installMetricFont}=require('../scripts/diploma-font-harness.cjs');
let h,data,people,years;
before(async()=>{h=await createHarness();data=await readHonors();people=data.groups.flatMap(g=>g.members);years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(__dirname,'../data/history.json'),'utf8')).results);});
after(async()=>{await h?.close();});
async function open(p,id='oscar-lohne'){
 await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();await p.locator('.diploma-example>summary').click();
 await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
}
async function actions(p,container=p){
 const frame=container.locator('iframe');await frame.evaluate(e=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;});
 for(const selector of ['[data-honor-print]','[data-honor-pdf]']){
  await container.locator(selector).click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]:enabled')?false:true);
 }
 assert.equal(await frame.evaluate(e=>e.contentWindow.__prints),2);
}
test('V3.5 all 44 people and future name-only additions have a personal diploma without invented badges, years or formal awards',()=>{
 const before=JSON.stringify(data);assert.equal(people.length,44);
 const options=people.map(m=>({m,ids:H.diplomaChoices(data,m,years),main:H.mainBadge(data,m,years)}));
 assert.equal(options.filter(r=>r.ids[0]==='thanks').length,24);
 for(const {m,ids,main}of options){assert.ok(ids.length,m.id);assert.equal(ids[0],main.basis==='estimated'?'thanks':main.badgeId||'thanks');assert.ok(!ids.some(id=>data.awardPolicy.retiredBadgeIds.includes(id)));assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);}
 assert.equal(JSON.stringify(data),before);
 const core=structuredClone(data),future=H.mergeVolunteers(core,{schemaVersion:1,sourceIds:['organizer-v35'],people:[{id:'future-fixture',name:'En fremtidig frivillig'}]}),member=H.findIn(future,'future-fixture').member;
 assert.deepEqual(H.diplomaChoices(future,member,years),['thanks']);assert.equal(H.startYear(member),null);assert.deepEqual(member.awards,[]);
});
test('V3.5 every profile at 390/1440px opens its own checked printable draft, with no duplicate medals or horizontal overflow',async()=>{
 for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   for(const m of people){
    await p.evaluate(id=>location.hash='person/'+id,m.id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,m.name);
    await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
    assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),2,m.id);
    assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true,m.id);
    const r=await p.locator('iframe').evaluate(e=>({name:e.contentDocument.querySelector('.diploma-recipient h2').textContent,stamp:e.contentDocument.querySelector('.diploma-draft')?.textContent||null,images:e.contentDocument.querySelectorAll('.diploma-medal').length}));
    assert.equal(r.name,m.name);assert.equal(r.stamp,null);assert.equal(r.images,1);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,m.id);
    if(m.id==='christan-berthelsen'){
     assert.equal(await p.locator('.honor-profile-medals img').count(),0);
     const d=await p.evaluate(()=>MorothonDiplomas.serviceDraft('christan-berthelsen'));assert.equal(d.gratitude,true);assert.equal(d.contributionCount,null);assert.equal(d.achievementYear,null);
    }
   }
   await open(p,'hakon-lohne');await actions(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
 }
});
test('V3.5 every gallery example has active print/PDF controls; browser output keeps a visible draft label on one A4 page',async()=>{
 const p=await h.browser.newPage({viewport:{width:390,height:1000}});
 try{
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();await p.locator('.honor-diploma-examples>summary').click();
  for(const e of data.diplomaExamples){
   const c=p.locator(`[data-example="${e.id}"]`);await c.locator('.honor-example-preview>summary').click();
   await p.waitForFunction(id=>!document.querySelector(`[data-example="${id}"] [data-honor-print]`)?.disabled,e.id);
   assert.equal(await c.locator('[data-honor-pdf]').isEnabled(),true,e.id);
   const frame=c.locator('iframe');await frame.evaluate(e=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;});
   for(const button of ['[data-honor-print]','[data-honor-pdf]']){await c.locator(button).click();await p.waitForFunction(id=>!document.querySelector(`[data-example="${id}"] [data-honor-print]`)?.disabled,e.id);}
   assert.equal(await frame.evaluate(e=>e.contentWindow.__prints),2,e.id);
   const html=await frame.getAttribute('srcdoc'),q=await h.browser.newPage();
   try{
    await q.setContent(html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await q.emulateMedia({media:'print'});
    assert.equal(await q.locator('.diploma-draft').count(),e.illustrative?1:0);
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');
    assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<.5&&Math.abs(+size[2]-595.28)<.5);
    assert.doesNotMatch(text,/UTKAST|IKKE UTDELT/);if(e.illustrative)assert.match(text,/EKSEMPEL/);assert.match(text,/Håkon Lohne/);assert.match(text,/Løpsleder · Morothon/);
    if(e.badgeId==='thanks'){assert.match(text,/TAKK FOR INNSATSEN/);assert.doesNotMatch(text,/MILEPÆL OPPNÅDD|MULIGE DUGNADSUTGAVER|\? dugnadsutgaver/);}
    if(e.badgeId==='service-memorial'){assert.match(text,/TIL MINNE OM/);assert.doesNotMatch(text,/TILDELES/);}
   }finally{await q.close();}
  }
 }finally{await p.close();}
});
test('V3.5 live print revalidation blocks real clipping, overlap, oversized or missing graphics, and a missing draft label',async()=>{
 const faults={
  size:doc=>doc.querySelector('.diploma-medal').style.height='150mm',
  clip:doc=>{const e=doc.querySelector('.diploma-recipient h2');e.style.height='2mm';e.style.overflow='hidden';},
  overlap:doc=>doc.querySelector('.diploma-citation').style.transform='translateY(-20mm)',
  stamp:doc=>{const e=doc.createElement('p');e.className='diploma-draft';e.textContent='FORHÅNDSVISNING';doc.querySelector('.diploma-sheet').appendChild(e);},
  image:doc=>doc.querySelector('.diploma-medal').src='missing-image.png'
 };
 for(const [name,mutate]of Object.entries(faults)){
  const p=await h.browser.newPage();try{
   await open(p);await p.locator('iframe').evaluate((e,fn)=>{e.contentWindow.__prints=0;e.contentWindow.print=()=>e.contentWindow.__prints++;new Function('doc',`return (${fn})(doc)`)(e.contentDocument);},mutate.toString());
   await p.locator('[data-honor-print]').click();await p.waitForFunction(()=>{const t=document.querySelector('.honor-diploma-status').textContent;return !t.startsWith('Diplomet er kontrollert');});
   assert.equal(await p.locator('[data-honor-print]').isEnabled(),false,name);assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),false,name);assert.equal(await p.locator('iframe').evaluate(e=>e.contentWindow.__prints),0,name);
  }finally{await p.close();}
 }
});
test('V3.5 inadequate raster quality still blocks draft printing while design approval stays separate',async()=>{
 const p=await h.browser.newPage();try{
  // A genuine 8px transparent raster must not pass just because the registry says 2400px.
  const png=execFileSync('python',['-c',"from PIL import Image;import sys;im=Image.new('RGBA',(8,8));im.putpixel((4,4),(0,40,50,255));im.save(sys.stdout.buffer,format='PNG')"]);
  await p.route('**/assets/medals/service/grunnlegger.png',r=>r.fulfill({body:png,contentType:'image/png'}));
  await p.goto(h.base+'/heder.html#person/arnfinn-haverstad');await p.locator('#profileName').waitFor();await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('DPI'));
  assert.equal(await p.locator('[data-honor-print]').isEnabled(),false);assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),false);
  const d=await p.evaluate(async()=>{const x=await MorothonDiplomas.serviceDraft('arnfinn-haverstad');return {approved:x.imageReady,preview:x.previewOnly};});assert.deepEqual(d,{approved:false,preview:true});
 }finally{await p.close();}
});
test('V3.5 draft readiness keeps the Windows numeric ink fix for names, mobile widths and 100–200% scaling',async()=>{
 for(const width of [390,1440])for(const dpr of [1,1.25,2]){
  const p=await h.browser.newPage({viewport:{width,height:1000},deviceScaleFactor:dpr});try{
   await installMetricFont(p);await open(p,'hakon-lohne');assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
   const r=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('hakon-lohne'),doc=document.querySelector('iframe').contentDocument;return {checked:await MorothonDiplomas.checkServiceDraft(d,doc),numeric:(await MorothonDiplomas.checkLayout(doc)).measurements.flatMap(m=>m.textFragments).filter(f=>f.method==='numeric-ink').length};});
   assert.equal(r.checked.ready,true,r.checked.failures.join(' '));assert.ok(r.numeric>0);
   const long=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('christan-berthelsen');d.printMode='draft';delete d.presentationApproval;d.name='Et Svært Langt Navn Brukt Bare Til Kontroll Av Diplomet Uten Oppdiktet Historikk';const f=document.createElement('iframe');f.srcdoc=MorothonDiplomas.documentHtml(d);await new Promise(resolve=>{f.onload=resolve;document.body.appendChild(f)});try{return await MorothonDiplomas.checkServiceDraft(d,f.contentDocument);}finally{f.remove();}});
   assert.equal(long.ready,true,long.failures.join(' '));
  }finally{await p.close();}
 }
});
