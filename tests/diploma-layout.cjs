const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs');
let h,history,css,badges;
const inger='MOR-C788866',gunnar='MOR-15AF3A3';
before(async()=>{h=await createHarness();[history,badges]=await Promise.all(['history','badges'].map(async name=>JSON.parse(await fs.readFile(path.join(__dirname,'../data/'+name+'.json'),'utf8'))));css=await fs.readFile(path.join(__dirname,'../css/diplomas.css'),'utf8');});
after(async()=>{await h?.close();});
async function load({width=1440,fixture,styles,registry}={}){
 const p=await h.browser.newPage({viewport:{width,height:1000}});
 if(fixture)await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));
 if(registry)await p.route('**/data/badges.json',r=>r.fulfill({json:registry}));
 if(styles)await p.route('**/css/diplomas.css',r=>r.fulfill({body:css+'\n'+styles,contentType:'text/css'}));
 await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;
}
async function open(p,pid=inger,key='badge:10'){
 await p.evaluate(pid=>MorothonDiplomas.open(pid),pid);
 if(await p.locator('#diplomaChoice').inputValue()!==key){await p.selectOption('#diplomaChoice',key);await p.waitForFunction(key=>MorothonDiplomas.current()?.key===key,key);}
 return p.evaluate(()=>{const d=MorothonDiplomas.current(),doc=document.querySelector('#diplomaDialog iframe').contentDocument;return {ready:d.ready,imageReady:d.imageReady,layout:d.layout,date:d.dateLabel,name:d.name,year:d.year,count:d.count,first:d.firstYear,last:d.lastYear,src:doc.querySelector('.diploma-medal').getAttribute('src')};});
}
test('Inger silver diploma preserves historical data and enables print with complete width-fitted A4 on mobile and desktop',async()=>{
 const p=await load();try{
  for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:1000});const d=await open(p);
   assert.equal(d.ready,true,JSON.stringify(d.layout.failures));assert.equal(d.layout.ready,true);assert.equal(d.imageReady,true);
   assert.deepEqual([d.name,d.count,d.first,d.last,d.year,d.date],['Inger Katherin Dahl Frantzen',10,2015,2024,2024,'Søgne, 9. november 2024']);assert.match(d.src,/approved\/participation-10\.png$/);
   assert.equal(await p.locator('[data-diploma-print]').isEnabled(),true);assert.equal(await p.locator('[data-diploma-pdf]').isEnabled(),true);
   await p.waitForFunction(()=>{const v=document.querySelector('.diploma-preview'),f=v.querySelector('iframe').getBoundingClientRect(),b=v.getBoundingClientRect();return f.right<=b.right&&f.bottom<=b.bottom&&Math.abs(f.width-v.clientWidth)<1;});
   const fit=await p.evaluate(()=>{const v=document.querySelector('.diploma-preview'),b=v.getBoundingClientRect(),f=v.querySelector('iframe').getBoundingClientRect(),d=document.querySelector('#diplomaDialog');return {ratio:f.width/f.height,inside:f.left>=b.left&&f.right<=b.right&&f.top>=b.top&&f.bottom<=b.bottom,scroll:document.documentElement.scrollWidth>innerWidth||d.scrollWidth>d.clientWidth};});
   assert.ok(Math.abs(fit.ratio-297/210)<.001);assert.equal(fit.inside,true);assert.equal(fit.scroll,false);
  }
 }finally{await p.close();}
});
test('all ten earned badge levels, four records and debut fit short/long names and export one unclipped landscape A4 page',async()=>{
 const fixture=structuredClone(history);
 // Future years are an in-memory fixture only, so 40/45/50 are genuinely earned by the model.
 for(let year=2027;year<=2041;year++){fixture.yearStats.push([year,1,1]);fixture.results.push([year,gunnar,'Morothon','20 km','Fullført','2:30:00',1,'Herrer','','']);}
 const p=await load({fixture});try{
  const samples=await p.evaluate(pid=>[...[5,10,15,20,25,30,35,40,45,50].map(n=>({pid,key:'badge:'+n})),...S.courseRecords.map(r=>({pid:r.pid,key:'record:0'})),{pid:S.people.find(p=>p.c===1&&p.f===2026).i,key:'debut'}],gunnar);
  assert.equal(samples.length,15);
  for(const sample of samples)for(const name of ['Ada Li','Inger Katherin Dahl Frantzen Med Et Langt Historisk Navn Som Skal Vises Uten Beskjæring']){
   await p.evaluate(({pid,name})=>{person(pid).n=name;}, {...sample,name});const d=await open(p,sample.pid,sample.key);assert.equal(d.layout.ready,true,sample.key+': '+d.layout.failures.join('; '));assert.equal(d.ready,true);assert.equal(d.name,name);
   const html=await p.evaluate(()=>document.querySelector('#diplomaDialog iframe').srcdoc);
   const printPage=await h.browser.newPage();try{await printPage.setContent(html);await printPage.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    const pdf=await printPage.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
    const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);assert.match(info,/Page size:\s+841\.\d+ x 594\.\d+|Page size:\s+841\.\d+ x 595\.\d+/);
    const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');assert.ok(text.includes(name),name);assert.match(text,/Håkon Lohne/);assert.match(text,/Løpsleder Morothon/);assert.ok(text.includes(d.date),d.date);
   }finally{await printPage.close();}
  }
 }finally{await p.close();}
});
test('font fallback and fractional zoom remain measurable; line-box overhang is accepted only within its allocated field',async()=>{
 const p=await load();try{await open(p);
  for(const font of ['Arial','DejaVu Sans','DejaVu Serif','Z003'])for(const zoom of [.8,1,1.1,1.25]){
   const d=await p.evaluate(async({font,zoom})=>{const doc=document.querySelector('#diplomaDialog iframe').contentDocument;doc.documentElement.style.zoom=zoom;for(const e of doc.querySelectorAll('.diploma-date p,.diploma-signature b,.diploma-signature span'))e.style.fontFamily=font;return MorothonDiplomas.checkLayout(doc);},{font,zoom});assert.equal(d.ready,true,font+' '+zoom+': '+d.failures.join('; '));assert.equal(d.tolerance,1);
  }
  const lineBox=await p.evaluate(async()=>{const doc=document.querySelector('#diplomaDialog iframe').contentDocument;doc.documentElement.style.zoom=1;const metric=doc.querySelector('.diploma-left');metric.style.padding='3mm 0';metric.querySelector('strong').style.lineHeight='.95';return MorothonDiplomas.checkLayout(doc);});
  assert.equal(lineBox.ready,true,lineBox.failures.join('; '));const text=lineBox.measurements.find(m=>m.element==='diploma-achievement');assert.ok(text.scrollOverflow.y>1);assert.ok(Object.values(text.outsideField).every(v=>v<=1));
  // The same overhang must be rejected if an element actually clips it.
  const clipped=await p.evaluate(async()=>{const doc=document.querySelector('#diplomaDialog iframe').contentDocument;doc.querySelector('.diploma-achievement').style.overflow='hidden';return MorothonDiplomas.checkLayout(doc);});assert.equal(clipped.ready,false);assert.ok(clipped.measurements.find(m=>m.element==='diploma-achievement').clipped);
 }finally{await p.close();}
});
test('one-pixel geometry tolerance accepts subpixel rounding and rejects real footer overflow with exact diagnostics',async()=>{
 const p=await load();try{await open(p);
  for(const delta of [.5,2.5]){
   const d=await p.evaluate(async delta=>{const doc=document.querySelector('#diplomaDialog iframe').contentDocument,el=doc.querySelector('.diploma-signature span'),row=doc.querySelector('.diploma-signoff');el.style.transform='';const range=doc.createRange();range.selectNodeContents(el);el.style.transform=`translateY(${row.getBoundingClientRect().bottom-range.getBoundingClientRect().bottom+delta}px)`;return MorothonDiplomas.checkLayout(doc);},delta);
   assert.equal(d.ready,delta<1,JSON.stringify(d.failures));const footer=d.measurements.find(m=>m.element==='diploma-signoff');assert.ok(Math.abs(footer.outsideField.bottom-delta)<.05);
  }
 }finally{await p.close();}
});
test('real metric, footer, name, medal and page-size violations still fail; print remains gated by layout and asset approval',async()=>{
 const p=await load();try{
  for(const fault of ['metric','footer','name','medal','paper','overlap']){
   await open(p);const d=await p.evaluate(async fault=>{const doc=document.querySelector('#diplomaDialog iframe').contentDocument;
    if(fault==='metric')doc.querySelector('.diploma-achievement').style.fontSize='70mm';
    if(fault==='footer')doc.querySelector('.diploma-signoff').style.height='5mm';
    if(fault==='name'){const el=doc.querySelector('.diploma-recipient h2');el.textContent='Langt navn '.repeat(30);el.style.whiteSpace='nowrap';}
    if(fault==='medal')doc.querySelector('.diploma-medal').style.height='150mm';
    if(fault==='paper')doc.querySelector('.diploma-sheet').style.width='280mm';
    if(fault==='overlap')doc.querySelector('.diploma-citation').style.transform='translateY(-10mm)';
    return MorothonDiplomas.checkLayout(doc);},fault);assert.equal(d.ready,false,fault);assert.ok(d.failures.length>0);
  }
 }finally{await p.close();}
 const badLayout=await load({styles:'.diploma-signoff{height:5mm}'});try{const d=await open(badLayout);assert.equal(d.imageReady,true);assert.equal(d.ready,false);assert.match(d.layout.failures.join(' '),/diploma-signoff/);assert.equal(await badLayout.locator('[data-diploma-print]').isEnabled(),false);assert.equal(await badLayout.locator('[data-diploma-pdf]').isEnabled(),false);}finally{await badLayout.close();}
 const tampered=structuredClone(badges);tampered.badges.find(b=>b.id==='badge-10').reviewedSha256='unreviewed';
 const badAsset=await load({registry:tampered});try{const d=await open(badAsset);assert.equal(d.layout.ready,true);assert.equal(d.imageReady,false);assert.equal(d.ready,false);assert.equal(await badAsset.locator('[data-diploma-print]').isEnabled(),false);}finally{await badAsset.close();}
});
test('honor previews use the same full-page fitter on mobile and PC and keep issuance disabled',async()=>{
 const p=await load();try{for(const width of [320,390,1440]){await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));
  await p.waitForFunction(()=>{const v=document.querySelector('.honor-diploma');return Math.abs(v.querySelector('iframe').getBoundingClientRect().width-v.clientWidth)<1;});
  const r=await p.evaluate(()=>{const v=document.querySelector('.honor-diploma'),b=v.getBoundingClientRect(),f=v.querySelector('iframe').getBoundingClientRect();return {fits:f.left>=b.left&&f.right<=b.right+.1&&f.top>=b.top&&f.bottom<=b.bottom+.1,fills:Math.abs(f.width-v.clientWidth)<1,noScroll:document.documentElement.scrollWidth<=innerWidth};});assert.deepEqual(r,{fits:true,fills:true,noScroll:true});assert.equal(await p.locator('iframe').getAttribute('sandbox'),'allow-same-origin');assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),0);
 }}finally{await p.close();}
});
