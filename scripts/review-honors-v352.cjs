const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{createHarness}=require('./diploma-harness.cjs'),{readHonors}=require('../tests/helpers/honors.cjs'),H=require('../js/honors-data.js');
async function review(out=path.join(os.tmpdir(),'morothon-v352')){
 await fs.mkdir(out,{recursive:true});const data=await readHonors(),people=data.groups.flatMap(g=>g.members),registry=JSON.parse(await fs.readFile(path.resolve(__dirname,'../data/badges.json'),'utf8'));
 const badgeName=id=>id==='thanks'?'Takk for innsatsen':registry.badges.find(b=>b.id===id).name;
 const rows=people.map(m=>{const s=H.honorProfile(data,m);return {id:m.id,name:m.name,startYear:m.contribution?.fromYear??s.tenure.first??H.startYear(m),endYear:m.contribution?.toYear??null,lastCountedYear:s.tenure.last,excludedYears:s.tenure.excludedYears,count:s.tenure.count,basis:s.tenure.basis,main:s.main.badgeId?badgeName(s.main.badgeId):'Ingen',mainId:s.main.badgeId,earned:s.earnedBadgeIds.map(badgeName),earnedIds:s.earnedBadgeIds,founder:H.isFounder(data,m),defaultDiploma:H.diplomaChoices(data,m)[0]};});
 const table=['| Navn | Startår | Sluttår | Fravær | Utgaver | Hovedutmerkelse | Opptjente dugnadsmerker | Grunnlegger | Standarddiplom |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |',...rows.map(r=>`| ${r.name} | ${r.startYear??'Ikke oppgitt'} | ${r.endYear??'Ikke oppgitt'} | ${r.excludedYears.join(', ')||'–'} | ${r.count??'Ikke fastsatt'} | ${r.main} | ${r.earned.join(', ')||'–'} | ${r.founder?'Ja':'Nei'} | ${badgeName(r.defaultDiploma)} |`)].join('\n');
 await fs.writeFile(path.join(out,'personregister.md'),'# V3.5.2 – alle 44 personer\n\nRegistrerte perioder og arrangørgodkjente totaler følger samme beregning. Startår kan være en registrert grunnleggerrolle uten kjent dugnadsperiode; rollen gir ikke dugnadsutgaver alene. Manglende sluttår er ikke en bekreftet biografisk opplysning om aktivitet i siste år.\n\n'+table+'\n');
 await fs.writeFile(path.join(out,'personregister.json'),JSON.stringify(rows,null,2)+'\n');
 const h=await createHarness(),errors=[],checks=[],proofs=[];
 const required=['oscar-lohne','erling-askildsen','einar-danielsen','dag-morten-frantzen','hakon-lohne','finn-lohne','bent-bakke'];
 const cardExamples=['oscar-lohne','erling-askildsen','einar-danielsen','dag-morten-frantzen','finn-lohne'];
 try{
  const p=await h.browser.newPage({deviceScaleFactor:1.5});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const width of [390,1440]){
   await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const [name,selector]of [['innledning','#honorIntro'],['oversikt','main'],['grunnleggerne','#honorFeatured'],['minne','#memorial']])await p.locator(selector).screenshot({path:path.join(out,`${name}-${width}.png`)});
   for(const id of cardExamples)await p.locator(`[data-honoree="${id}"]`).screenshot({path:path.join(out,`${id}-kort-${width}.png`)});
   for(const id of required){await p.goto(h.base+'/heder.html#person/'+id);await p.waitForFunction(name=>document.querySelector('#profileName')?.textContent===name,rows.find(r=>r.id===id).name);await p.locator('#honorProfile').screenshot({path:path.join(out,`${id}-${width}.png`)});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(['dag-morten-frantzen','oscar-lohne','einar-danielsen'].includes(id)){
     await p.locator('.diploma-example>summary').click();
     for(const display of ['all','latest']){await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);await p.locator('.honor-person-diploma').screenshot({path:path.join(out,`${id}-diplom-${display}-${width}.png`)});}
    }
   }
   checks.push({width,people:44,horizontalOverflow:false});
  }
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  const requests=[...required,...['arnfinn-haverstad','helge-reisvoll','christan-berthelsen','erling-danielsen']].map(id=>({id,key:id}));
  requests.push(...data.diplomaExamples.filter(e=>e.illustrative).map(e=>({example:e.id,key:e.id})));
  for(const r of requests.flatMap(r=>['all','latest'].map(display=>({...r,display,key:r.key+(display==='latest'?'-latest':'')})))){
   const model=await p.evaluate(async r=>{
    const d=r.example?await MorothonDiplomas.serviceExample(r.example,r.display):await MorothonDiplomas.serviceDraft(r.id,r.display),f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px';
    await new Promise(resolve=>{f.onload=resolve;f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.appendChild(f)});
    try{const check=await MorothonDiplomas.checkServiceDraft(d,f.contentDocument);return {html:MorothonDiplomas.documentHtml(d),name:d.name,count:d.contributionCount,mode:d.printMode,medalDisplay:d.medalDisplay,main:d.assetKey,extras:d.secondaryAssets.map(a=>a.key),check};}finally{f.remove();}
   },r);
   assert.equal(model.check.ready,true,r.key+': '+model.check.failures);if(r.id)assert.equal(model.mode,require('../tests/helpers/honors.cjs').expectedPrintMode(data,r.id),r.id);
   const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:300/96});try{
    await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});await q.addScriptTag({url:h.base+'/js/diplomas.js'});
    const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,r.key+': '+layout.failures);
    const images=await q.locator('.diploma-medal,.diploma-service-founder img,.diploma-service-collection img').evaluateAll(es=>es.map(e=>({principal:e.classList.contains('diploma-medal'),src:e.src,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight})).sort((a,b)=>Number(b.principal)-Number(a.principal)));
    assert.equal(new Set(images.map(i=>i.src)).size,images.length,r.key+': no duplicate images');
    assert.ok(images.slice(1).every(i=>i.width<images[0].width/1.8),r.key+': principal medal remains dominant');
    await q.locator('.diploma-sheet').screenshot({path:path.join(out,r.key+'-A4.png')});
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await fs.writeFile(path.join(out,r.key+'-A4.pdf'),pdf);
    const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');
    assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<.5&&Math.abs(+size[2]-595.28)<.5);
    assert.ok(text.includes(model.name));if(model.mode==='draft')assert.match(text,r.example?/EKSEMPEL/:/FORHÅNDSVISNING/);else assert.doesNotMatch(text,/UTKAST|FORHÅNDSVISNING|MULIGE DUGNADSUTGAVER/);if(r.example)assert.match(text,/EKSEMPEL/);else assert.doesNotMatch(text,/EKSEMPEL/);
    proofs.push({key:r.key,name:model.name,count:model.count,mode:model.mode,medalDisplay:model.medalDisplay,main:model.main,extras:model.extras,images,layoutReady:true,pdfInfo:info,fonts:execFileSync('pdffonts',['-'],{input:pdf}).toString(),pdfImages:execFileSync('pdfimages',['-list','-'],{input:pdf}).toString()});
   }finally{await q.close();}
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({rows,checks,proofs,errors},null,2)+'\n');
  comparison(out);
  const picture=(file,label)=>`<figure><figcaption>${label}</figcaption><a href="${file}"><img src="${file}" alt="${label}"></a></figure>`;
  let html='<h1>Morothon V3.5.2 · heder gjennom årene</h1><p>Kontroll av gjeldende kode. Ingen formell utdeling registreres ved utskrift.</p><p><a href="personregister.md">Alle 44 personer</a> · <a href="kontroll.json">Kontrollmålinger</a></p><h2>De tre æresdiplomene</h2><p><a href="tre-aeresdiplomer.png">Åpne samlet sammenligningsbilde</a></p><div class="three">';
  for(const id of required.slice(0,3))html+=picture(id+'-A4.png',rows.find(r=>r.id===id).name);html+='</div>';
  for(const id of cardExamples)html+=`<h2>${rows.find(r=>r.id===id).name} · oversiktskort</h2><div class="two">${picture(id+'-kort-1440.png','PC · hele merkesamlingen')}${picture(id+'-kort-390.png','Mobil · hele merkesamlingen')}</div>`;
  for(const name of ['innledning','oversikt','grunnleggerne','minne',...required])html+=`<h2>${name}</h2><div class="two">${picture(name+'-1440.png','PC · 1440 px')}${picture(name+'-390.png','Mobil · 390 px')}</div>`;
  for(const id of ['dag-morten-frantzen','oscar-lohne','einar-danielsen'])for(const width of [390,1440])html+=`<h2>${rows.find(r=>r.id===id).name} · ${width} px</h2><div class="two">${picture(id+'-diplom-all-'+width+'.png','Alle merker')}${picture(id+'-diplom-latest-'+width+'.png','Kun siste merke')}</div>`;
  for(const d of proofs)html+=`<h2>${d.name}</h2>${picture(d.key+'-A4.png','Liggende A4 · '+(d.medalDisplay==='latest'?'Kun siste merke · ':'Alle merker · ')+(d.mode==='presentation'?'ren presentasjonskopi':'eksempel'))}<p><a href="${d.key}-A4.pdf">Åpne faktisk A4-PDF</a></p>`;
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon V3.5.2</title><style>body{font:16px/1.6 Arial;background:#f6f3e9;color:#12343e;max-width:1700px;margin:25px auto;padding:0 20px}h1,h2,p,figcaption{text-align:center}.two,.three{display:grid;gap:20px;grid-template-columns:repeat(2,minmax(0,1fr))}.three{grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:12px 0}img{display:block;max-width:100%;height:auto;margin:auto}a{color:inherit}@media(max-width:700px){.two,.three{grid-template-columns:1fr}}</style>'+html+'</html>');
  console.log(JSON.stringify({out,people:rows.length,proofs:proofs.length,errors}));
 }finally{await h.close();}
}
function comparison(out){
 execFileSync('python',['-c',[
   'from PIL import Image, ImageDraw, ImageFont',
   'from pathlib import Path',
   'import sys',
   'out = Path(sys.argv[1])',
   'items = [("oscar-lohne", "Oscar Lohne · 35 utgaver"), ("erling-askildsen", "Erling Askildsen · 35 utgaver"), ("einar-danielsen", "Einar Danielsen · 33 utgaver")]',
   'canvas = Image.new("RGB", (2400, 620), "#eeeadd")',
   'draw = ImageDraw.Draw(canvas)',
   'font = ImageFont.load_default(size=24)',
   'for i, (key, label) in enumerate(items):',
   '    im = Image.open(out / (key + "-A4.png")).convert("RGB")',
   '    im.thumbnail((780, 552), Image.Resampling.LANCZOS)',
   '    canvas.paste(im, (i * 800 + (800 - im.width) // 2, 54))',
   '    draw.text((i * 800 + 400, 15), label, font=font, fill="#12343e", anchor="mt")',
   'canvas.save(out / "tre-aeresdiplomer.png")'
  ].join('\n'),out]);
}
module.exports={review,comparison};if(require.main===module)review(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});
