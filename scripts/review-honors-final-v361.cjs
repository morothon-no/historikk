// Actual browser/PDF evidence for the organizer's final V3.6.1 corrections.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs'),{readHonors,expectedPrintMode}=require('../tests/helpers/honors.cjs');
async function review(out='/tmp/morothon-v361-final'){
 await fs.mkdir(out,{recursive:true});const h=await createHarness(),data=await readHonors(),errors=[],profiles=[],proofs=[];
 const people=['einar-danielsen','erling-danielsen','anne-lene-forland-hansen','laila-endresen-skjulestad'];
 try{
  for(const width of [390,768,1280,1440]){
   const p=await h.browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   try{
    await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(await p.locator('#honorSources,#honorSourceContent').count(),0);
    await p.locator('#honorFeatured').screenshot({path:path.join(out,'grunnleggere-'+width+'.png')});
    await p.locator('[data-honoree="erling-danielsen"]').screenshot({path:path.join(out,'erling-kort-'+width+'.png')});
    await p.locator('#honorClosing').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'nederst-'+width+'.png'),fullPage:false});
    for(const id of people){await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#honorProfile img')].map(i=>i.decode()));});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
     await p.locator('#honorProfile').screenshot({path:path.join(out,id+'-'+width+'.png')});profiles.push({id,width,name:await p.locator('#profileName').textContent(),height:(await p.locator('#honorProfile').boundingBox()).height,sourcePanels:await p.locator('.honor-person-sources,.honor-source').count()});
     await p.locator('.diploma-example>summary').click();for(const display of ['all','latest']){await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1440].includes(width))await p.locator('.honor-person-diploma').screenshot({path:path.join(out,id+'-preview-'+display+'-'+width+'.png')});}
    }
   }finally{await p.close();}
  }
  const p=await h.browser.newPage();await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  try{for(const id of people)for(const display of ['all','latest']){
   const model=await p.evaluate(async({id,display})=>{const d=await MorothonDiplomas.serviceDraft(id,display),f=document.createElement('iframe');f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.append(f);await new Promise(r=>f.onload=r);try{return {html:MorothonDiplomas.documentHtml(d),mode:d.printMode,name:d.name,date:d.dateLabel,main:d.assetKey,extra:d.secondaryAssets.map(a=>a.key),check:await MorothonDiplomas.checkServiceDraft(d,f.contentDocument)};}finally{f.remove();}},{id,display});assert.equal(model.check.ready,true,model.check.failures.join(' '));assert.equal(model.mode,expectedPrintMode(data,id));
   const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:2});try{
    await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});const key=id+'-'+display+'-A4';await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'.png')});
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await fs.writeFile(path.join(out,key+'.pdf'),pdf);
    const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString(),fonts=execFileSync('pdffonts',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);assert.match(text,/FORHÅNDSVISNING/);assert.match(fonts,/Caveat[^\n]*yes\s+yes\s+yes/);proofs.push({id,display,name:model.name,date:model.date,mode:model.mode,main:model.main,extras:model.extra,check:model.check,pdfInfo:info,fonts});
   }finally{await q.close();}
  }}finally{await p.close();}
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({people:44,confirmedLinks:26,profiles,proofs,errors},null,2)+'\n');
  const img=(file,label)=>`<figure><figcaption>${label}</figcaption><a href="${file}.png"><img loading="lazy" src="${file}.png" alt="${label}"></a></figure>`;
  let html='<h1>Morothon V3.6.1 – endelige personrettelser</h1><p>44 personer · 26 bekreftede løperkoblinger. Kilder og revisjonsspor er bevart internt.</p><p>80 kontrollerte diplomvarianter er uendret. De åtte endrede variantene nedenfor er merket FORHÅNDSVISNING og venter på særskilt godkjenning.</p><p><a href="kontroll.json">Målinger og diplomkontroll</a></p>';
  for(const width of [390,768,1280,1440]){html+=`<h2>${width} px</h2><div class="two">${img('grunnleggere-'+width,'Fem grunnleggere – Einar med minnemarkering')}${img('erling-kort-'+width,'Erling Danielsen – ordinær dugnadsmedarbeider')}</div>`;for(const id of people)html+=img(id+'-'+width,id);html+=img('nederst-'+width,'Sidens nederste del uten kildeseksjon');}
  for(const id of people){html+=`<h2>${profiles.find(p=>p.id===id).name} · A4</h2><div class="two">`;for(const display of ['all','latest'])html+=`<div>${img(id+'-'+display+'-A4',display==='all'?'Alle merker':'Kun siste merke')}<p><a href="${id}-${display}-A4.pdf">A4-PDF · forhåndsvisning</a></p></div>`;html+='</div>';}
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V3.6.1 sluttkontroll</title><style>body{font:16px/1.5 Arial;background:#eeeadd;color:#12343e;max-width:1500px;margin:20px auto;padding:16px}h1,h2,p,figcaption{text-align:center}img{display:block;max-width:100%;height:auto;margin:auto}figure{margin:16px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:700px){.two{grid-template-columns:1fr}}</style>'+html+'</html>');
  console.log(JSON.stringify({out,profiles:profiles.length,pdfs:proofs.length,errors}));
 }finally{await h.close();}
}
module.exports={review};if(require.main===module)review(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
