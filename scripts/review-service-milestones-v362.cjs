// Same immutable register, actual before/after application code and A4 output.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),baseline='09173da';
async function review(out='/tmp/morothon-v362'){
 await fs.mkdir(out,{recursive:true});const h=await createHarness(),rows=[],proofs=[],errors=[];
 try{for(const stage of ['before','after']){
  const p=await h.browser.newPage();p.on('pageerror',e=>errors.push(e.message));
  if(stage==='before')await p.route('**/js/diplomas.js',r=>r.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',baseline+':js/diplomas.js'],{cwd:root}).toString()}));
  try{
   await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
   const ids=await p.evaluate(async()=>{const d=await MorothonHonorsData.load();return d.groups.flatMap(g=>g.members).map(m=>m.id);});
   for(const id of ids)for(const display of ['all','latest']){
    const model=await p.evaluate(async({id,display})=>{const d=await MorothonDiplomas.serviceDraft(id,display);return {id,display,name:d.name,main:d.assetKey,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,year:d.achievementYear,date:d.dateLabel,mode:d.printMode,proof:d.contentProof,html:['jon-fjeld','einar-danielsen'].includes(id)?MorothonDiplomas.documentHtml(d):null};},{id,display});
    rows.push({...model,stage,html:undefined});
    if(!model.html)continue;
    const q=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:2});try{
     await q.setContent(model.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await q.addScriptTag({url:h.base+'/js/diplomas.js'});
     const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,layout.failures.join(' '));
     const key=stage+'-'+id+'-'+display;await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'.png')});
     const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});await fs.writeFile(path.join(out,key+'.pdf'),pdf);
     const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);proofs.push({stage,id,display,layoutReady:true,pdfInfo:info});
    }finally{await q.close();}
   }
  }finally{await p.close();}
 }
 const affected=[];
 for(const before of rows.filter(r=>r.stage==='before')){
  const after=rows.find(r=>r.stage==='after'&&r.id===before.id&&r.display===before.display);
  if(before.proof.contentSha256!==after.proof.contentSha256){assert.match(after.main,/^service-dugnad-/);assert.equal(after.mode,'draft');assert.equal(after.date,before.date);affected.push({id:after.id,name:after.name,display:after.display,previous:{count:before.count,first:before.first,last:before.last},current:{count:after.count,first:after.first,last:after.last},date:after.date,previousMode:before.mode});}
  else{assert.deepEqual({...after,stage:undefined},{...before,stage:undefined});}
 }
 for(const display of ['all','latest']){
  assert.deepEqual(await fs.readFile(path.join(out,'before-einar-danielsen-'+display+'.png')),await fs.readFile(path.join(out,'after-einar-danielsen-'+display+'.png')),'Einar is pixel-identical');
  const jon=rows.find(r=>r.stage==='after'&&r.id==='jon-fjeld'&&r.display===display);assert.deepEqual([jon.count,jon.first,jon.last,jon.date],[10,2014,2023,'Søgne, 11. november 2023']);
 }
 // The actual profile UI still shows current service totals, independently of
 // the historical diploma. Check scaled previews and live print controls too.
 const ui=[];for(const width of [390,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});try{await p.goto(h.base+'/heder.html#person/jon-fjeld');await p.locator('#profileName').waitFor();assert.match(await p.locator('#honorProfile .honor-main-caption').innerText(),/13 dugnadsutgaver/);await p.locator('.diploma-example>summary').click();for(const display of ['all','latest']){await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]').disabled,display);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('.honor-person-diploma').screenshot({path:path.join(out,'jon-preview-'+width+'-'+display+'.png')});ui.push({width,display,overflow:false,markedPreview:true});}}finally{await p.close();}
 }
 assert.deepEqual(errors,[]);const report={baseline,people:44,affectedPeople:new Set(affected.map(r=>r.id)).size,affectedVariants:affected.length,affected,rows,proofs,ui,errors};await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify(report,null,2)+'\n');
 const img=(key,label)=>`<figure><figcaption>${label}</figcaption><a href="${key}.pdf"><img src="${key}.png" alt="${label}"></a></figure>`;
 let html='<h1>Morothon V3.6.2 · Jons 10-utgaversdiplom</h1><p>Før: 13 utgaver, 2014–2026. Etter: 10 utgaver, 2014–2023. Samme dato: Søgne, 11. november 2023.</p><p>Endrede varianter er merket FORHÅNDSVISNING og krever ny godkjenning. Personregister og godkjenninger er ikke endret.</p><p><a href="kontroll.json">Alle 44 personer · før/etter og påvirkede varianter</a></p>';
 for(const display of ['all','latest'])html+=`<h2>${display==='all'?'Alle merker':'Kun siste merke'}</h2><div class="two">${img('before-jon-fjeld-'+display,'Før')}${img('after-jon-fjeld-'+display,'Etter')}</div>`;
 html+='<h2>Berørte diplomer</h2><table><tr><th>Person</th><th>Før</th><th>Etter</th><th>Dato (uendret)</th></tr>';for(const r of affected.filter(r=>r.display==='all'))html+=`<tr><td>${r.name}</td><td>${r.previous.count} · ${r.previous.first}–${r.previous.last}</td><td>${r.current.count} · ${r.current.first}–${r.current.last}</td><td>${r.date}</td></tr>`;html+='</table><h2>Einars Æresdiplom · uendret</h2>'+img('after-einar-danielsen-all','Samme komposisjon, tekst og dato; pikselidentisk');
 await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon V3.6.2</title><style>body{font:16px/1.5 Arial;color:#12343e;background:#eeeadd;max-width:1600px;margin:24px auto;padding:16px}h1,h2,p,figcaption{text-align:center}figure{margin:0}img{width:100%;height:auto}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}table{border-collapse:collapse;margin:auto}td,th{padding:8px;border-bottom:1px solid #bca}@media(max-width:700px){.two{grid-template-columns:1fr}}</style>'+html+'</html>');
 console.log(JSON.stringify({out,affectedPeople:report.affectedPeople,affectedVariants:affected.length,pdfs:proofs.length,errors}));return report;
 }finally{await h.close();}
}
module.exports={review};if(require.main===module)review(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
