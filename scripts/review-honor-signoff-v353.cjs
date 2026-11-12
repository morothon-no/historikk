const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs'),{cases,historicalFixture}=require('./honor-signoff-cases.cjs');
async function review(out,beforeRoot){
 await fs.mkdir(out,{recursive:true});const root=path.resolve(__dirname,'..'),proofs=[],errors=[];
 for(const [stage,rootDir]of [['before',beforeRoot],['after',root]]){
  if(!rootDir)continue;
  const h=await createHarness({rootDir});
  try{for(const c of cases)for(const display of ['all','latest']){
   const p=await h.browser.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   try{
    if(c.historical){const core=JSON.parse(await fs.readFile(path.join(rootDir,'data/honors.json'),'utf8'));await p.route('**/data/honors.json',r=>r.fulfill({json:historicalFixture(core)}));}
    await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
    const d=await p.evaluate(async({id,display})=>{const d=await MorothonDiplomas.serviceDraft(id,display),f=document.createElement('iframe');f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.append(f);await new Promise(r=>f.onload=r);try{return {html:MorothonDiplomas.documentHtml(d),year:d.achievementYear,date:d.dateLabel,mode:d.printMode,check:await MorothonDiplomas.checkServiceDraft(d,f.contentDocument)};}finally{f.remove();}},{id:c.id,display});
    assert.equal(d.check.ready,true,c.key+': '+d.check.failures);if(stage==='after')assert.equal(d.date,c.date);
    const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:2});
    try{
     await q.setContent(d.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
     const key=stage+'-'+c.key+'-'+display;
     await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'.png')});
     await q.locator('.diploma-signoff').screenshot({path:path.join(out,key+'-signoff.png')});
     const measurements=await q.evaluate(()=>{const e=document.querySelector('.diploma-date p'),b=document.querySelector('.diploma-signature b'),s=getComputedStyle(e),t=getComputedStyle(b);const r=document.createRange();r.selectNodeContents(e);return {date:e.textContent,dateFont:s.fontFamily,signatureFont:t.fontFamily,dateColor:s.color,signatureColor:t.color,dateLines:[...r.getClientRects()].filter(r=>r.width>0).length,images:[...document.querySelectorAll('.diploma-medal,.diploma-service-founder img,.diploma-service-collection img')].map(e=>({src:new URL(e.src).pathname,box:e.getBoundingClientRect().toJSON()}))};});
     if(stage==='after'){assert.equal(measurements.dateFont,measurements.signatureFont);assert.equal(measurements.dateColor,measurements.signatureColor);assert.equal(measurements.dateLines,c.date?1:0);}
     const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await fs.writeFile(path.join(out,key+'.pdf'),pdf);
     const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),fonts=execFileSync('pdffonts',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');
     assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<.5&&Math.abs(+size[2]-595.28)<.5);assert.ok(text.includes(c.name));if(stage==='after'){assert.ok(text.includes(c.date));assert.match(fonts,/Caveat/);}
     proofs.push({stage,case:c.key,display,year:d.year,date:d.date,mode:d.mode,layout:d.check.layout,measurements,pdfInfo:info,fonts});
    }finally{await q.close();}
    if(stage==='after'&&display==='all')for(const width of [390,1440]){
     await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html#person/'+c.id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,c.name);await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('.honor-person-diploma').screenshot({path:path.join(out,c.key+'-preview-'+width+'.png')});
    }
   }finally{await p.close();}
  }}finally{await h.close();}
 }
 for(const before of proofs.filter(p=>p.stage==='before')){const after=proofs.find(p=>p.stage==='after'&&p.case===before.case&&p.display===before.display);assert.deepEqual(after.measurements.images,before.measurements.images,'Medal placement unchanged: '+before.case+'/'+before.display);}
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({proofs,errors},null,2)+'\n');
 let html='<h1>Morothon V3.5.3 – dato og navnesignatur</h1><p>Faktisk Chromium-gjengivelse. Historisk kontrollprofil er syntetiske testdata, ikke en endring i personregisteret.</p>';
 for(const c of cases)for(const display of ['all','latest']){html+=`<h2>${c.name} · ${display==='all'?'Alle merker':'Kun siste merke'}</h2><div class="pair">`;for(const stage of ['before','after']){const key=stage+'-'+c.key+'-'+display;html+=`<figure><figcaption>${stage==='before'?'Før':'Etter'}</figcaption><a href="${key}.pdf"><img src="${key}.png" alt="${stage}"></a><img src="${key}-signoff.png" alt="Signaturfelt"></figure>`;}html+='</div>';}
 await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V3.5.3 kontroll</title><style>body{font:16px/1.5 Arial;background:#eeeadd;color:#12343e;max-width:1800px;margin:24px auto;padding:16px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{width:100%;height:auto}h1,h2,figcaption{text-align:center}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>'+html+'</html>');
 console.log(JSON.stringify({out,pdfs:proofs.length,errors}));
}
module.exports={review};if(require.main===module)review(process.argv[2]||'/tmp/morothon-v353',process.argv[3]).catch(e=>{console.error(e);process.exitCode=1});
