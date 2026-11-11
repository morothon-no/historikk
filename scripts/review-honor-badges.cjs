// Actual Chromium renders of registered SVG originals. Review files never enter the site build.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..');

function textContrast(){
 const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');
 const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
 const luminance=rgb=>rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const paper=luminance(rgb(getComputedStyle(document.querySelector('.diploma-sheet')).backgroundColor));
 return [...document.querySelectorAll('.diploma-heading>p,.diploma-recipient h3,.diploma-metric span,.diploma-service-words b')].map(e=>{
  const color=getComputedStyle(e).color,ink=luminance(rgb(color));return {text:e.textContent,color,ratio:(Math.max(paper,ink)+.05)/(Math.min(paper,ink)+.05)};
 });
}

async function inspectVector(page,url,font){
 await page.goto(url);
 if(font)await page.evaluate(font=>{const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=`text,tspan{font-family:${font}!important}`;document.documentElement.appendChild(style);},font);
 await page.evaluate(()=>document.fonts.ready);
 return page.evaluate(()=>{
  const svg=document.documentElement,c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas').getContext('2d');
  const rect=b=>({left:b.x,top:b.y,right:b.x+b.width,bottom:b.y+b.height});
  const text=[...svg.querySelectorAll('text:not(:has(tspan)),tspan')].filter(e=>e.textContent.trim()).map(e=>{
   const s=getComputedStyle(e),start=e.getStartPositionOfChar(0),box=e.getBBox();
   c.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;const m=c.measureText(e.textContent);
   const matrix=svg.getCTM().inverse().multiply(e.getCTM());
   const points=[[box.x,start.y-m.actualBoundingBoxAscent],[box.x+box.width,start.y+m.actualBoundingBoxDescent]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
   return {text:e.textContent,role:e.getAttribute('data-role')||e.closest('text').getAttribute('data-role'),font:s.fontFamily,size:parseFloat(s.fontSize),
    ink:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};
  });
  const emblem=svg.querySelector('[data-role="emblem"]');
  return {text,emblem:emblem?rect(emblem.getBBox()):null,count:text.find(t=>t.role==='count')?.ink||null,
   vector:true,viewBox:svg.getAttribute('viewBox'),title:svg.querySelector('title')?.textContent||null};
 });
}

async function review(out=path.join(os.tmpdir(),'morothon-heder-pr16'),badgesOnly=false){
 out=path.resolve(out);await fs.mkdir(out,{recursive:true});
 const registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const levels=[5,10,15,20,30,40],ids=[...levels.map(n=>'service-dugnad-'+n),'service-hedersildsjel','service-grunnlegger','service-aeresmerke'];
 const badges=ids.map(id=>registry.badges.find(b=>b.id===id));assert.ok(badges.every(Boolean));
 const harness=await createHarness(),errors=[],vectors=[],proofs=[],views=[];
 const css='*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f3e9;color:#12343e;font:16px/1.5 Arial}h1,h2,p{text-align:center}h1{font-family:Georgia;font-weight:400}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.six{grid-template-columns:repeat(6,minmax(0,1fr))}figure{margin:0;padding:12px;background:#fffdf6;border:1px solid #d8cdb3;border-radius:12px;text-align:center}figure img{display:block;width:100%;height:345px;object-fit:contain}figcaption b{display:block;font-size:20px}figcaption small{display:block;color:#526b70}.six img{height:250px}.six b{font-size:17px}.single img{height:600px}.dark{background:#092936;color:#fff}';
 const tile=b=>`<figure><img src="${harness.base}/${b.vectorSource}"><figcaption><b>${b.name}</b><small>${b.milestoneEditions?b.milestoneEditions+' dugnadsutgaver':'Særskilt heder'} · designutkast</small></figcaption></figure>`;
 try{
  const p=await harness.browser.newPage({deviceScaleFactor:1.5});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // Standalone SVG documents have no HTML icon link. Serve the site's real
  // favicon for Chromium's implicit request in this local QA harness.
  await p.route('**/favicon.ico',r=>r.fulfill({path:path.join(root,'assets/icons/favicon.ico'),contentType:'image/x-icon'}));
  for(const [file,items,width,extra]of [['alle-ni-merker',badges,1500,''],['seks-dugnadsmerker',badges.slice(0,6),1650,'six'],...levels.slice(3).map(n=>['naerbilde-'+n,[badges.find(b=>b.milestoneEditions===n)],650,'single'])]){
   await p.setViewportSize({width,height:1000});await p.setContent(`<html lang="no"><meta charset="utf-8"><style>${css}</style><h1>Morothon · ${file==='alle-ni-merker'?'ni hedersmerker':file==='seks-dugnadsmerker'?'seks nivåer i samme størrelse':items[0].name}</h1><p>Faktiske SVG-originaler · utkast til visuell godkjenning</p><div class="grid ${extra}" style="${items.length===1?'grid-template-columns:1fr':''}">${items.map(tile).join('')}</div></html>`);
   await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,file+'.png'),fullPage:true});
  }
  for(const badge of badges){
   const bytes=await fs.readFile(path.join(root,badge.vectorSource));
   for(const font of [null,'Arial, sans-serif']){
    const geometry=await inspectVector(p,harness.base+'/'+badge.vectorSource,font);
    vectors.push({id:badge.id,src:badge.vectorSource,sha256:createHash('sha256').update(bytes).digest('hex'),fontOverride:font,...geometry});
   }
  }
  if(!badgesOnly){
   for(const width of [390,1440]){
    await p.setViewportSize({width,height:1000});await p.goto(harness.base+'/heder.html');
    await p.locator('[data-honoree="oscar-lohne"]').waitFor();
    const ids=await p.locator('[data-honoree]').evaluateAll(es=>es.map(e=>e.dataset.honoree));
    assert.equal(ids.length,44);assert.equal(new Set(ids).size,44);
    await p.screenshot({path:path.join(out,`oversikt-${width}.png`),fullPage:true});
    await p.locator('[data-honor-group="memorial"]').screenshot({path:path.join(out,`til-minne-om-${width}.png`)});
    await p.locator('.honor-library>summary').click();
    await p.evaluate(()=>Promise.all([...document.querySelectorAll('#serviceBadges img')].map(i=>i.decode())));
    await p.locator('#serviceBadges').screenshot({path:path.join(out,`merker-${width}.png`)});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);views.push({width,people:ids.length,uniquePeople:new Set(ids).size,badges:await p.locator('#serviceBadges img').count(),overflow:false});
    for(const id of ['oscar-lohne','erling-askildsen']){
     await p.goto(harness.base+'/heder.html#person/'+id);await p.waitForFunction(id=>document.querySelector('#profileName')?.textContent===(id==='oscar-lohne'?'Oscar Lohne':'Erling Askildsen'),id);
     await p.evaluate(()=>Promise.all([...document.querySelectorAll('.honor-profile-header img')].map(i=>i.decode())));
     await p.locator('.honor-profile-header').screenshot({path:path.join(out,`${id}-${width}.png`)});
    }
   }
   await p.goto(harness.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
   for(const key of [...levels.map(n=>n===5?'dugnadshelt-fem':'dugnad-'+n),'oscar-30','erling-30','oscar-35','erling-35']){
    const model=await p.evaluate(async key=>{
     const d=key.endsWith('-30')&&!key.startsWith('dugnad-')?await MorothonDiplomas.serviceDraft(key.startsWith('oscar')?'oscar-lohne':'erling-askildsen','service-dugnad-30'):await MorothonDiplomas.serviceExample(key);
     return {html:MorothonDiplomas.documentHtml(d),name:d.name,role:d.roleLabel,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,date:d.dateLabel,achievementYear:d.achievementYear,yearText:d.achievementYear?(d.assetKey.startsWith('service-dugnad-')?'MILEPÆL OPPNÅDD I '+d.achievementYear:'35 DUGNADSUTGAVER I '+d.achievementYear):'',tribute:d.tribute,preview:d.previewOnly,imageReady:d.imageReady,secondary:d.secondaryAssets.map(a=>a.key)};
    },key);
    assert.equal(model.preview,true);assert.equal(model.imageReady,false);
    const q=await harness.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:300/96});
    q.on('pageerror',e=>errors.push(e.message));q.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
    await q.addScriptTag({url:harness.base+'/js/diplomas.js'});const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));
    assert.equal(layout.ready,true,key+': '+layout.failures.join(' '));
    const contrasts=await q.evaluate(textContrast);assert.ok(contrasts.every(t=>t.ratio>=4.5),key+': low text contrast');
    await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'-A4-UTKAST-IKKE-UTDELT.png')});
    const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
    await fs.writeFile(path.join(out,key+'-A4-UTKAST-IKKE-UTDELT.pdf'),pdf);
    const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);
    const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.8898)<.5&&Math.abs(+size[2]-595.2756)<.5,key+': landscape A4');
    const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');assert.ok(text.includes(model.name));assert.ok(text.includes(model.yearText||'Løpsleder Morothon'));assert.ok(!text.includes('__________________'));
    const signoff=await q.locator('.diploma-service-signoff').evaluate(e=>({date:e.querySelector('.diploma-date').textContent.trim(),dateLines:e.querySelectorAll('.diploma-date .diploma-signature-line').length,signature:e.querySelector('.diploma-signature b').textContent,role:e.querySelector('.diploma-signature-role').textContent}));
    assert.deepEqual(signoff,{date:model.yearText,dateLines:0,signature:'Håkon Lohne',role:'Løpsleder Morothon'});
    assert.ok(!/tildelt i|utdelt i|utstedt i/i.test(text));
    proofs.push({key,...model,html:undefined,layout:{ready:layout.ready,failures:layout.failures},contrasts,pdfInfo:info});await q.close();
   }
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),vectors,views,proofs,errors},null,2)+'\n');
  let markdown='# PR #16 – faktisk visuell gjennomgang\n\nAlle bilder er gjengitt direkte fra SVG-filene i denne grenen med Chromium. Ingen AI-illustrasjoner eller plassholdere. Alle merker er designutkast; ingen nye tildelinger og ingen offentlig utskrift/PDF.\n\n## Alle ni merker\n\n![Alle ni merker](alle-ni-merker.png)\n\n## Seks nivåer i lik størrelse\n\n![Seks dugnadsmerker](seks-dugnadsmerker.png)\n\n## Nærbilder\n\n';
  for(const n of [20,30,40])markdown+=`### ${n} dugnadsutgaver\n\n![${n} dugnadsutgaver](naerbilde-${n}.png)\n\n`;
  if(!badgesOnly){
   markdown+='## Mobil og PC\n\n[Oversikt på mobil](oversikt-390.png) · [Oversikt på PC](oversikt-1440.png) · [Til minne om](til-minne-om-390.png)\n\n[Merker på mobil](merker-390.png) · [Merker på PC](merker-1440.png)\n\n![Mobilvisning](merker-390.png)\n\n';
   for(const id of ['oscar-lohne','erling-askildsen'])markdown+=`[${id}: mobil](${id}-390.png) · [PC](${id}-1440.png)\n\n`;
   markdown+='## A4 – utkast, ikke utdelt\n\nNavngitte dugnadsmilepæler viser oppnåelsesåret (30: 2021, 35 utgaver: 2026), ikke en formell tildelingsdato. Anonyme eksempler har ingen dato eller strek.\n\n';
   for(const item of proofs)markdown+=`### ${item.role} · ${item.name} · ${item.count} utgaver\n\n[PDF – utkast, ikke utdelt](${item.key}-A4-UTKAST-IKKE-UTDELT.pdf)\n\n![${item.key} – utkast, ikke utdelt](${item.key}-A4-UTKAST-IKKE-UTDELT.png)\n\n`;
  }
  markdown+='## Målinger\n\n[Maskinlesbare kilder, SHA-256, tekstgrenser og A4-resultater](kontroll.json). Filene er lokale QA-prøver og skal ikke committes eller publiseres. Sluttrapporten vedlikeholdes i repositoryets `docs/pr16-sluttkontroll.md`.\n';
  await fs.writeFile(path.join(out,'README.md'),markdown);
  const html=markdown.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2">').replace(/\[([^\]]*)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/\n\n/g,'<p>');
  await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{max-width:1600px;margin:auto}img{max-width:100%;height:auto;display:block;margin:20px auto}a{color:inherit}</style>${html}</html>`);
  console.log(JSON.stringify({out,vectors:vectors.length,proofs:proofs.length,errors}));
 }finally{await harness.close();}
}
module.exports={review,inspectVector,textContrast};
if(require.main===module)review(process.argv.slice(2).find(a=>!a.startsWith('--')),process.argv.includes('--badges-only')).catch(e=>{console.error(e);process.exitCode=1});
