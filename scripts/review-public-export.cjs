// Review only the validated public package. Never attach raw-register QA archives.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createHarness}=require('./diploma-harness.cjs'),{validatePublicSite}=require('./build-site.cjs');
async function review(out,site){
 out=path.resolve(out);site=path.resolve(site);const expected=await validatePublicSite(site);await fs.mkdir(out,{recursive:true});
 assert.equal((await fs.readdir(out)).length,0,'Review directory must be empty');
 const h=await createHarness({rootDir:site}),errors=[],checks=[];
 try{
  const p=await h.browser.newPage();p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const width of [390,1440]){
   await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="einar-danielsen"]').waitFor();
   await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   assert.equal(await p.locator('[data-honoree]').count(),expected.visiblePeople);assert.equal(await p.locator('[data-honoree="erling-danielsen"]').count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const [name,selector]of [['grunnleggere','#honorFeatured'],['minne','#memorial'],['innledning','#honorIntro']])await p.locator(selector).screenshot({path:path.join(out,`${name}-${width}.png`)});
   for(const id of ['einar-danielsen','oscar-lohne','jon-fjeld']){
    await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();
    await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>!document.querySelector('[data-honor-print]')?.disabled);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await p.locator('#honorProfile').screenshot({path:path.join(out,`${id}-${width}.png`)});
   }
   checks.push({width,visiblePeople:expected.visiblePeople,horizontalOverflow:false});
  }
  for(const id of ['oscar-lohne','erling-askildsen','einar-danielsen','jon-fjeld'])for(const display of ['all','latest']){
   await p.goto(h.base+'/heder.html#person/'+id);await p.locator('#profileName').waitFor();if(!await p.locator('.diploma-example').evaluate(e=>e.open))await p.locator('.diploma-example summary').click();
   await p.selectOption('[data-medal-display]',display);
   await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]')?.disabled,display);
   const checked=await p.evaluate(async({id,display})=>{const d=await MorothonDiplomas.serviceDraft(id,display);return {html:MorothonDiplomas.documentHtml(d),date:d.dateLabel,count:d.contributionCount,mode:d.printMode,check:await MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument)};},{id,display});
   assert.equal(checked.check.ready,true,checked.check.failures.join(' '));
   const q=await h.browser.newPage();try{
    await q.goto(h.base+'/heder.html');await q.setContent(checked.html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    const key=id+'-'+display;await q.locator('.diploma-sheet').screenshot({path:path.join(out,key+'.png')});await q.pdf({path:path.join(out,key+'.pdf'),format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
    checks.push({id,display,date:checked.date,count:checked.count,mode:checked.mode,layoutReady:true});
   }finally{await q.close();}
  }
  await p.close();assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({publicExport:true,checks,errors},null,2)+'\n');
  const images=(await fs.readdir(out)).filter(f=>f.endsWith('.png')).sort();
  const html=images.map(f=>`<figure><figcaption>${f}</figcaption><a href="${f}"><img loading="lazy" src="${f}" alt="${f}"></a>${f.includes('-all.')||f.includes('-latest.')?`<p><a href="${f.replace('.png','.pdf')}">A4 PDF</a></p>`:''}</figure>`).join('');
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>A1 – offentlig eksport</title><style>body{font:16px Arial;background:#f5f3ed;color:#12343e;max-width:1500px;margin:auto;padding:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}</style><h1>A1 – kontroll av offentlig byggepakke</h1><p>'+expected.visiblePeople+' synlige personer. Ingen endringer i heder, utdeling eller diplomgodkjenninger.</p><main>'+html+'</main></html>');
  return {checks:checks.length,pdfs:8,errors};
 }finally{await h.close();}
}
module.exports={review};if(require.main===module)review(process.argv[2],process.argv[3]||'_site').then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
