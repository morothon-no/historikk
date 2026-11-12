// Reproducible comparison: identical current facts, CSS before/after V3.6.1.
// Review output is deliberately outside the production package and repository.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),baseline='bcbb266c48da5370ffa1aea765872c6d388801da';
const ids=['oscar-lohne','per-sangvik','dag-morten-frantzen'],widths=[1440,1280,768,390];
const oldCss=file=>execFileSync('git',['show',baseline+':css/'+file],{cwd:root}).toString();
async function open(h,stage,width){
 const p=await h.browser.newPage({viewport:{width,height:1000}});
 if(stage==='before'){
  for(const file of ['honors.css','diplomas.css'])await p.route('**/css/'+file,r=>r.fulfill({contentType:'text/css',body:oldCss(file)}));
  const facts=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
  // Preserve the reviewed fingerprints belonging to the baseline CSS. Links do not change diploma content.
  const pending=facts.presentationPrintSet.pendingReviews||[];facts.presentationPrintSet=JSON.parse(execFileSync('git',['show',baseline+':data/honors.json'],{cwd:root})).presentationPrintSet;facts.presentationPrintSet.entries=facts.presentationPrintSet.entries.filter(e=>!pending.some(p=>p.personId===e.personId));if(pending.length)facts.presentationPrintSet.pendingReviews=pending;
  await p.route('**/data/honors.json',r=>r.fulfill({json:facts}));
 }
 await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();return p;
}
async function profile(p,id){
 await p.locator(`[data-honoree="${id}"] a`).click();await p.locator('#profileName').waitFor();await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#honorProfile img')].map(i=>i.decode()));});
 // Loading messages and image diagnostics are asynchronous; diploma proofs are checked separately below.
 return p.locator('#honorProfile').evaluate(e=>{const content=e.cloneNode(true);content.querySelectorAll('.honor-diploma-status,.honor-image-quality div').forEach(n=>n.remove());return {height:e.getBoundingClientRect().height,text:content.textContent.replace(/\s+/g,' ').trim(),images:[...e.querySelectorAll('img')].map(i=>i.getAttribute('src')),overflow:document.documentElement.scrollWidth>innerWidth,controls:[...e.querySelectorAll('.back,.primary-runner-link,summary,select,button')].filter(x=>x.checkVisibility()).map(x=>({text:x.textContent.trim(),width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),header:e.querySelector('.honor-profile-header')?.getBoundingClientRect().height||null};});
}
async function diploma(p,id,display){
 return p.evaluate(async({id,display})=>{
  const d=await MorothonDiplomas.serviceDraft(id,display),f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px';
  await new Promise(r=>{f.onload=r;f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.append(f);});
  try{const {cssSha256,contentSha256,...composition}=await MorothonDiplomas.serviceProof(d);const stableComposition=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(composition))))).map(n=>n.toString(16).padStart(2,'0')).join('');return {stableComposition,html:MorothonDiplomas.documentHtml(d),check:await MorothonDiplomas.checkServiceDraft(d,f.contentDocument),name:d.name,date:d.dateLabel,main:d.assetKey,display:d.medalDisplay};}finally{f.remove();}
 },{id,display});
}
async function review(out=path.join(os.tmpdir(),'morothon-v361'),{images=true}={}){
 await fs.mkdir(out,{recursive:true});const h=await createHarness(),profiles=[],diplomas=[],cards=[],errors=[];
 try{
  for(const stage of ['before','after'])for(const width of widths){
   const p=await open(h,stage,width);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   try{
    const card=p.locator('[data-honoree="floke-bredland"]');cards.push({stage,width,html:await card.innerHTML(),box:await card.boundingBox()});
    if(images)await card.screenshot({path:path.join(out,`${stage}-minnekort-${width}.png`)});
    for(const id of ids){
     const measure=await profile(p,id);assert.equal(measure.overflow,false,id+'/'+width);if(stage==='after')assert.ok(measure.controls.every(c=>c.height>=43),id+': retain touch targets');
     profiles.push({stage,width,id,...measure});if(images)await p.locator('#honorProfile').screenshot({path:path.join(out,`${stage}-${id}-${width}.png`)});
     await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet'));
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Open preview stays inside screen');
     if(images&&[1440,390].includes(width))await p.locator('.honor-person-diploma').screenshot({path:path.join(out,`${stage}-${id}-preview-${width}.png`)});
     await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
    }
   }finally{await p.close();}
  }
  for(const prior of profiles.filter(r=>r.stage==='before')){
   const next=profiles.find(r=>r.stage==='after'&&r.width===prior.width&&r.id===prior.id);assert.equal(next.text,prior.text,'No content removed');assert.deepEqual(next.images,prior.images,'No medals removed');
   next.reductionPx=Math.round(prior.height-next.height);next.reductionPercent=+(100*(prior.height-next.height)/prior.height).toFixed(1);
   if(prior.width>=1280)assert.ok(next.height<prior.height-80,prior.id+': meaningful desktop reduction');
  }
  for(const prior of cards.filter(r=>r.stage==='before')){const next=cards.find(r=>r.stage==='after'&&r.width===prior.width);assert.equal(next.html,prior.html);assert.ok(next.box.width>=prior.box.width,'The two remaining memorial cards share the available width');if(prior.width<=768)assert.equal(next.box.height,prior.box.height,'Memorial content remains equally compact at narrower widths');}
  for(const stage of ['before','after']){
   const p=await open(h,stage,1440);
   try{for(const id of ['oscar-lohne','erling-askildsen','einar-danielsen','arnfinn-haverstad','helge-reisvoll','dag-morten-frantzen','per-sangvik'])for(const display of ['all','latest']){
    const model=await diploma(p,id,display);assert.equal(model.check.ready,true,id+': '+model.check.failures);
    const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:2});
    if(stage==='before')await q.route('**/css/diplomas.css',r=>r.fulfill({contentType:'text/css',body:oldCss('diplomas.css')}));
    try{
     await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await q.addScriptTag({url:h.base+'/js/diplomas.js'});
     const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,id+': '+layout.failures);
     const geometry=await q.evaluate(()=>[...document.querySelectorAll('.diploma-medal,.diploma-service-founder,.diploma-service-collection,.diploma-signoff')].map(e=>({element:e.className,box:e.getBoundingClientRect().toJSON()})));
     const key=`${stage}-${id}-${display}-A4`;if(images)await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'.png')});
     const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
     if(images)await fs.writeFile(path.join(out,key+'.pdf'),pdf);
     const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),fonts=execFileSync('pdffonts',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<.5&&Math.abs(+size[2]-595.28)<.5,'Landscape A4 within Chromium sub-pixel rounding');assert.match(fonts,/Caveat[^\n]*yes\s+yes\s+yes/);
     diplomas.push({stage,id,display,stableComposition:model.stableComposition,date:model.date,main:model.main,geometry,ready:model.check.ready,layoutReady:layout.ready,pdfInfo:info,fonts});
    }finally{await q.close();}
   }}finally{await p.close();}
  }
  for(const prior of diplomas.filter(r=>r.stage==='before')){
   const next=diplomas.find(r=>r.stage==='after'&&r.id===prior.id&&r.display===prior.display);assert.equal(next.date,prior.date);assert.equal(next.main,prior.main);assert.equal(next.stableComposition,prior.stableComposition,'Diploma content and graphics unchanged apart from CSS');
   for(const [i,e]of prior.geometry.entries()){
    const n=next.geometry[i];assert.equal(n.element,e.element);
    if(e.element==='diploma-service-founder'){assert.equal(n.box.width,e.box.width);assert.equal(n.box.height,e.box.height);assert.equal(n.box.top,e.box.top);assert.ok(n.box.left<150&&e.box.left>800);assert.ok(Math.abs(n.box.left-(1122.5-e.box.right))<1,'Mirrored A4 margins');}
    else assert.deepEqual(n,e,'Only secondary founder position changes');
   }
   if(images&&!prior.geometry.some(e=>e.element==='diploma-service-founder'))assert.deepEqual(await fs.readFile(path.join(out,`before-${prior.id}-${prior.display}-A4.png`)),await fs.readFile(path.join(out,`after-${prior.id}-${prior.display}-A4.png`)),'No-founder diploma pixels unchanged');
  }
  assert.deepEqual(errors,[]);const report={baseline,profileComparisons:profiles,memorialCards:cards,diplomas,errors};await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify(report,null,2)+'\n');
  if(images){
   const img=(key,label)=>`<figure><figcaption>${label}</figcaption><a href="${key}.png"><img loading="lazy" src="${key}.png" alt="${label}"></a></figure>`;
   let html='<h1>Morothon V3.6.1</h1><p>Samme bekreftede personopplysninger før og etter. Kun CSS er sammenlignet.</p><p><a href="kontroll.json">Målinger, A4-kontroll og innholdssammenligning</a></p>';
   for(const width of widths)for(const id of [...ids,'minnekort'])html+=`<h2>${id} · ${width}px</h2><div class="pair">${img('before-'+id+'-'+width,'Før')}${img('after-'+id+'-'+width,'Etter')}</div>`;
   for(const d of diplomas.filter(r=>r.stage==='after'))html+=`<h2>${d.id} · ${d.display==='all'?'Alle merker':'Kun siste merke'}</h2><div class="pair">${img('before-'+d.id+'-'+d.display+'-A4','Før')}${img('after-'+d.id+'-'+d.display+'-A4','Etter')}</div><p><a href="after-${d.id}-${d.display}-A4.pdf">Faktisk A4-PDF</a></p>`;
   await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V3.6.1 før/etter</title><style>body{font:16px/1.5 Arial;max-width:1600px;margin:20px auto;padding:16px;background:#eeeadd;color:#12343e}h1,h2,p,figcaption{text-align:center}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;height:auto}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>'+html+'</html>');
  }
  return report;
 }finally{await h.close();}
}
module.exports={review,baseline,ids,widths};
if(require.main===module)review(process.argv[2]).then(r=>console.log(JSON.stringify({profiles:r.profileComparisons.filter(p=>p.stage==='after').map(({id,width,height,reductionPercent})=>({id,width,height,reductionPercent})),pdfs:r.diplomas.length,errors:r.errors}))).catch(e=>{console.error(e);process.exitCode=1;});
