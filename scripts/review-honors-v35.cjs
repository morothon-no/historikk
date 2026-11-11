const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHarness}=require('./diploma-harness.cjs'),{readHonors}=require('../tests/helpers/honors.cjs');
const {approvalFixture}=require('../tests/helpers/honor-approval.cjs');
const H=require('../js/honors-data.js'),{inspectVector}=require('./review-honor-badges.cjs');
const root=path.resolve(__dirname,'..');
async function review(out=path.join(os.tmpdir(),'morothon-v35')){
 await fs.mkdir(out,{recursive:true});const h=await createHarness(),data=await readHonors(),registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results),people=data.groups.flatMap(g=>g.members),checks=[],proofs=[],errors=[];
 const rows=people.map(m=>{
  const badge=H.mainBadge(data,m,years);
  // Report a sourced estimate without changing documented tenure or badge eligibility.
  const main=badge.count===null&&m.serviceEstimate?{...badge,...m.serviceEstimate,count:m.serviceEstimate.editions,basis:'organizer-estimate'}:badge,estimate=H.provisionalMilestone(data,m,years),count=main.badgeId?main.count:estimate.count;
  const period=[H.startYear(m)?'Fra '+H.startYear(m):'Startår ukjent',(m.contribution?.toYear||(main.basis==='documented'&&main.toYear))?'til '+(m.contribution?.toYear||main.toYear)+(m.contribution?.toYearStatus==='provisional'?' (foreløpig sluttår)':''):'',m.contribution?.excludedYears?.length?'fravær '+m.contribution.excludedYears.join(', '):'',count!==null?(main.basis==='organizer-estimate'?(main.qualifier==='at-least'?'minst ':main.qualifier==='approximately'&&main.unit==='years'?'':'om lag '):'')+count+' '+(main.basis==='documented'?'dokumenterte':main.basis==='organizer-estimate'?(main.unit==='years'?(main.qualifier==='approximately'?'år med tjeneste':'anslåtte år med innsats'):'anslåtte utgaver'):'mulige')+(main.basis==='organizer-estimate'?'':' utgaver'):''].filter(Boolean).join(' · ');
  const basis=main.badgeId==='service-memorial'&&count===null?'Historisk dugnadsrolle, uten fastsatt antall':main.basis==='documented'?'Dokumenterte enkeltår':main.basis==='organizer-decision'?'Arrangørens beslutning om planlagt heder; dugnadstall ukjent':main.basis==='historical-role'?'Bekreftet historisk rolle':main.basis==='organizer-estimate'?(main.qualifier==='approximately'&&main.unit==='years'?'Oppgitt av arrangøren, uten eksakt årsrekke':'Arrangørens anslag, uten årsrekke'):estimate.basis==='estimated'?'Beregnet anslag, ikke bekreftet årsrekke':'Utilstrekkelig grunnlag';
  const diploma=main.badgeId==='service-memorial'?'Minnediplom':main.badgeId==='service-aeresmerke'?'Æresdiplom':main.badgeId==='service-grunnlegger'?'Grunnleggerdiplom':main.badgeId?'Dugnadsdiplom':'Takk for innsatsen';
  return {id:m.id,name:m.name,role:(m.roles||[]).filter(r=>r.confirmed).map(r=>r.title).join(' · ')||'Ikke oppgitt',startYear:H.startYear(m),count,countUnit:main.unit||'editions',diploma,period,basis,badge:main.badgeId?registry.badges.find(b=>b.id===main.badgeId).name:'Ingen',badgeId:main.badgeId,status:main.badgeId?'Foreløpig / forslag – ikke tildelt':'Uten merke',missingYears:H.startYear(m)===null,main};
 });
 const table=['| Navn | Rolle | Startår / periode | Utgaver / innsats | Dokumentert / anslag | Hovedmerke | Diplomtype |','| --- | --- | --- | --- | --- | --- | --- |',...rows.map(r=>`| ${r.name} | ${r.role} | ${r.period.split(' · ').filter(p=>!p.includes('utgaver')&&!p.includes('anslåtte år')&&!p.includes('år med tjeneste')).join(' · ')} | ${r.count===null?'Ikke fastsatt':(r.main.qualifier==='at-least'?'Minst ':'')+r.count+(r.countUnit==='years'?' år':' utgaver')} | ${r.basis} | ${r.badge} | ${r.diploma} |`)].join('\n');
 await fs.writeFile(path.join(out,'personregister.md'),'# Morothon V3.5 – 44 personvurderinger\n\n'+table+'\n\n## Manglende startår\n\n'+rows.filter(r=>r.missingYears).map(r=>'- '+r.name).join('\n')+'\n');
 try{
  const p=await h.browser.newPage({deviceScaleFactor:1.5});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/favicon.ico',r=>r.fulfill({path:path.join(root,'assets/icons/favicon.ico'),contentType:'image/x-icon'}));
  for(const width of [390,1440]){
   await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   assert.equal(await p.locator('[data-honoree]').count(),44);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.screenshot({path:path.join(out,`hedersside-${width}.png`),fullPage:true});
   for(const [name,selector]of [['grunnleggerne','#honorFeatured'],['dugnadsheltene','#volunteers'],['til-minne-om','#memorial'],['arrangorene','#organizers']])await p.locator(selector).screenshot({path:path.join(out,`${name}-${width}.png`)});
   checks.push({width,people:44,overflow:false,robots:await p.locator('meta[name="robots"]').getAttribute('content')});
  }
  for(const width of [390,1440]){
   await p.setViewportSize({width,height:1000});
   for(const [name,id]of [['personprofil-dugnad','hakon-lohne'],['personprofil-uten-merke','christan-berthelsen'],['personprofil-einar','einar-danielsen'],['personprofil-dag','dag-morten-frantzen'],['personprofil-minne','erling-danielsen']]){
    await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();
    await p.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});
    await p.locator('.diploma-example>summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
    assert.equal(await p.locator('[data-honor-pdf]').isEnabled(),true);
    await p.locator('.honor-person-diploma').screenshot({path:path.join(out,`${name}-apent-diplom-${width}.png`)});
   }
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();await p.locator('.honor-diploma-examples>summary').click();
   for(const e of data.diplomaExamples){await p.locator(`[data-example="${e.id}"] summary`).first().click();await p.waitForFunction(id=>!document.querySelector(`[data-example="${id}"] [data-honor-print]`)?.disabled,e.id);}
   await p.locator('.honor-diploma-examples').screenshot({path:path.join(out,`diplomgalleri-${width}.png`)});
  }
  await p.setViewportSize({width:650,height:650});await p.goto(h.base+'/assets/medals/service/memorial.svg');await p.locator('svg').evaluate(e=>{e.style.width='600px';e.style.height='600px';});await p.locator('svg').screenshot({path:path.join(out,'minnemerke.png'),omitBackground:true});
  const vectors=[];for(const font of [null,'Arial, sans-serif'])vectors.push(await inspectVector(p,h.base+'/assets/medals/service/memorial.svg',font));
  for(const v of vectors)for(const t of v.text)assert.ok(t.ink.left>=0&&t.ink.right<=1200&&t.ink.top>=0&&t.ink.bottom<=1200,t.text);
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  const requests=[...data.diplomaExamples.map(e=>({key:e.id,example:e.id})),...['einar-danielsen','dag-morten-frantzen','floke-bredland','leif-wiig','bent-bakke','hakon-lohne','christan-berthelsen','nils-martin-otterdal-nilsen'].map(id=>({key:id,id})),{key:'TEST-godkjent-person',fixtureFinal:true}];
  for(const r of requests){
   if(r.fixtureFinal)r.id=(await approvalFixture(p,h.base)).id;
   const model=await p.evaluate(async r=>{const d=r.example?await MorothonDiplomas.serviceExample(r.example):await MorothonDiplomas.serviceDraft(r.id);return {html:MorothonDiplomas.documentHtml(d),name:d.name,key:d.assetKey,ready:d.imageReady,preview:d.previewOnly,mode:d.printMode};},r);assert.equal(model.ready,model.mode==='final');assert.equal(model.preview,true);
   const fileBase=r.key+'-A4'+(['final','presentation'].includes(model.mode)?'':'-EKSEMPEL');
   const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:300/96});try{
    await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});await q.addScriptTag({url:h.base+'/js/diplomas.js'});
    const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,r.key+': '+layout.failures);assert.equal(await q.locator('.diploma-medal').count(),1);
    await q.locator('.diploma-sheet').screenshot({path:path.join(out,fileBase+'.png')});const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await fs.writeFile(path.join(out,fileBase+'.pdf'),pdf);
    const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.8898)<.5&&Math.abs(+size[2]-595.2756)<.5);
    const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString();assert.ok(text.includes(model.name));assert.doesNotMatch(text,/UTKAST|IKKE UTDELT/);if(!['final','presentation'].includes(model.mode))assert.match(text,/EKSEMPEL|FORHÅNDSVISNING/);if(model.key==='service-memorial'){assert.match(text,/TIL MINNE OM/);assert.doesNotMatch(text,/TILDELES/);}proofs.push({key:r.key,name:model.name,asset:model.key,layoutReady:true,fileBase,mode:model.mode,testFixture:!!r.fixtureFinal,draftLabelInPdf:false,previewLabelInPdf:!['final','presentation'].includes(model.mode),pdfInfo:info,fonts:execFileSync('pdffonts',['-'],{input:pdf}).toString(),images:execFileSync('pdfimages',['-list','-'],{input:pdf}).toString()});
   }finally{await q.close();}
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({rows,checks,vectors,proofs,errors},null,2)+'\n');
  const picture=(file,caption)=>`<figure><figcaption>${caption}</figcaption><a href="${file}"><img src="${file}" alt="${caption}"></a></figure>`;
  let html='<h1>Morothon V3.5.1 · heder og fellesskap</h1><p>Kontrollbilder fra gjeldende løsning. Ingen formelle tildelinger. Kontrollerte presentasjonsdiplomer kan skrives ut uten utkastmerking. Dette registrerer ingen utdeling.</p><p><a href="personregister.md">Vurdering av alle 44 personer</a> · <a href="kontroll.json">Tekniske målinger</a></p>';
  for(const name of ['hedersside','grunnleggerne','arrangorene','dugnadsheltene','til-minne-om','personprofil-dugnad','personprofil-uten-merke','personprofil-dugnad-apent-diplom','personprofil-uten-merke-apent-diplom','personprofil-einar','personprofil-dag','personprofil-minne','diplomgalleri'])html+=`<h2>${name}</h2><div class="grid">${picture(name+'-1440.png','PC · 1440 px')}${picture(name+'-390.png','Mobil · 390 px')}</div>`;
  html+='<h2>Nytt minnemerke</h2>'+picture('minnemerke.png','For alltid en del av Morothon · SVG-utkast');
  html+='<h2>Diplomtyper · visuell sammenstilling</h2><div class="grid">'+proofs.map(proof=>picture(proof.fileBase+'.png',proof.name+' · '+proof.key)).join('')+'</div>';
  for(const proof of proofs)html+=`<h2>${proof.name} · ${proof.key}</h2>${proof.testFixture?'<p>Kun teknisk testdata. Ingen faktisk diplomgodkjenning eller tildeling er gjennomført.</p>':''}${picture(proof.fileBase+'.png',proof.mode==='final'?'Liggende A4 · test av særskilt godkjent diplom':proof.mode==='presentation'?'Liggende A4 · ren presentasjonskopi':'Liggende A4 · merket eksempel')}<p><a href="${proof.fileBase}.pdf">Lokal QA-PDF · ikke utstedt</a></p>`;
  await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon V3.5</title><style>body{font:16px/1.6 Arial;background:#f6f3e9;color:#12343e;max-width:1500px;margin:25px auto;padding:0 20px}h1,h2,p,figcaption{text-align:center}img{display:block;max-width:100%;height:auto;margin:auto}figure{margin:16px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}a{color:inherit}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style>${html}</html>`);
  console.log(JSON.stringify({out,people:rows.length,proofs:proofs.length,errors}));
 }finally{await h.close();}
}
module.exports={review};if(require.main===module)review(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});
