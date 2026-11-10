// Local-only V3 review: screenshots, source/stat controls and unissued QA PDFs. No push/deployment.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const out=path.resolve(process.argv[2]||'/tmp/morothon-honors-v3'),beforeRef=process.argv[3]||'38751d0';await fs.mkdir(out,{recursive:true});const h=await createHarness();
 try{
  const p=await h.browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="erling-askildsen"]').waitFor();await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const members=await p.evaluate(async()=>{const d=await MorothonHonorsData.load();return d.groups.flatMap(g=>g.members).map(m=>({id:m.id,name:m.name,runnerId:m.runnerId||null,founder:gID(m.id,d)==='founders'}));function gID(id,d){return d.groups.find(g=>g.members.some(m=>m.id===id)).id;}});
  await p.screenshot({path:path.join(out,'oversikt-PC.png'),fullPage:true});
  for(const [id,file]of [['honorTimeline','tidslinje'],['founders','grunnleggere'],['organizers','overtakelsen'],['volunteers','dugnadshelter']])await p.locator('#'+id).screenshot({path:path.join(out,file+'-PC.png')});
  await p.setViewportSize({width:390,height:1000});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="erling-askildsen"]').waitFor();await p.screenshot({path:path.join(out,'oversikt-mobil.png'),fullPage:true});await p.locator('#founders').screenshot({path:path.join(out,'grunnleggere-mobil.png')});
  const profiles=[],diplomas=[];
  for(const member of members){
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});await p.goto(h.base+'/heder.html#person/'+member.id);await p.locator('#profileName').waitFor();await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,member.id);
    await p.locator('#honorProfile').screenshot({path:path.join(out,member.id+'-'+(width===1440?'PC':'mobil')+'.png')});
    profiles.push({id:member.id,width,runnerLink:await p.evaluate(()=>document.querySelector('#honorProfile .runner-profile-link')?.getAttribute('href')||null),hasDiploma:await p.locator('.diploma-example').count()>0});
    if(width===390&&member.founder){await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));await p.locator('.diploma-example').screenshot({path:path.join(out,member.id+'-diplom-mobil.png')});}
   }
   if(member.founder){
    const prepared=await p.evaluate(async id=>{const model=await MorothonDiplomas.serviceDraft(id);return {html:MorothonDiplomas.documentHtml(model),name:model.name,tribute:model.tribute,imageReady:model.imageReady,previewOnly:model.previewOnly};},member.id);
    assert.equal(prepared.imageReady,false);assert.equal(prepared.previewOnly,true);
    const d=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:1.5});await d.setContent(prepared.html);await d.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    const name=member.id+'-grunnleggerdiplom-IKKE-UTSTEDT';await d.locator('.diploma-sheet').screenshot({path:path.join(out,name+'.png')});await d.pdf({path:path.join(out,name+'.pdf'),format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});await d.close();
    const info=execFileSync('pdfinfo',[path.join(out,name+'.pdf')]).toString();assert.match(info,/Pages:\s+1\b/);assert.match(info,/\(A4\)/);diplomas.push({id:member.id,name:prepared.name,tribute:prepared.tribute,pages:1,format:'A4 landscape',issued:false});
   }
  }
  // A readable result table is generated from the live authoritative model, not copied into honor data.
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="erling-askildsen"]').waitFor();
  const stats=await p.evaluate(async()=>{const d=await MorothonHonorsData.load(),history=await MorothonHistoryData.load();return d.groups.flatMap(g=>g.members).map(m=>{const s=m.runnerId?history.stats(m.runnerId):null;return {honorId:m.id,name:m.name,runnerId:s?.id||null,count:s?.count??null,firstYear:s?.firstYear??null,lastYear:s?.lastYear??null,best:s?.best.map(b=>({event:b.event,km:b.km,period:b.period,time:b.time,year:b.year}))||[],sourcePodiums:s?.sourcePodiums||[]};});});
  // Ordinary card presentation must remain byte-identical to the pre-V3 index renderer.
  const before=await h.browser.newPage();const old=execFileSync('git',['show',`${beforeRef}:index.html`],{cwd:root});
  await before.route('**/index.html?before-v3=1',r=>r.fulfill({body:old,contentType:'text/html'}));await before.goto(h.base+'/index.html?before-v3=1');await before.waitForFunction(()=>!document.querySelector('#loading'));
  const ids=members.map(m=>m.runnerId).filter(Boolean),oldCards=await before.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,MorothonCard.profileHtml(id)])),ids);await before.close();
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));const newCards=await p.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,MorothonCard.profileHtml(id)])),ids);
  const parity=ids.map(id=>({runnerId:id,ordinaryCardUnchanged:oldCards[id]===newCards[id]}));assert.ok(parity.every(p=>p.ordinaryCardUnchanged));assert.equal(await p.locator('a[href*="heder.html"]').count(),0);
  for(const [name,value]of [['profilkontroll.json',profiles],['beregnet-lopshistorikk.json',stats],['A4-kontroll.json',diplomas],['ordinaere-kort-bevart.json',parity]])await fs.writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n');
  assert.deepEqual(errors,[]);
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const gallery=`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon – hedersside V3</title><style>*{box-sizing:border-box}body{margin:0;padding:26px;background:#eee8db;color:#12343e;font:16px/1.5 Arial}main{max-width:1450px;margin:auto}h1,h2,p{text-align:center}h2{font:400 27px Georgia}nav{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin:25px}a{color:inherit}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:#fffdf6;border:1px solid #cdb98d;padding:20px;border-radius:12px;min-width:0}img{max-width:100%;height:auto;display:block;margin:auto;max-height:1000px;object-fit:contain}.notice{padding:15px;border:1px solid #cbb374;background:#fff7df}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><main><h1>Menneskene bak historien · V3</h1><p>Lokalt til gjennomgang. Ingen push, merge, utstedelse eller publisering.</p><nav><a href="sluttrapport.md">Rapport og filliste</a><a href="oversikt-PC.png">Hele oversikten</a><a href="oversikt-mobil.png">Mobiloversikt</a><a href="beregnet-lopshistorikk.json">Kontrollerte løperkoblinger</a></nav><h2>Grunnleggerne</h2><a href="grunnleggere-PC.png"><img src="grunnleggere-PC.png"></a><h2>Historien og overtakelsen</h2><div class="grid"><article><a href="tidslinje-PC.png"><img src="tidslinje-PC.png"></a></article><article><a href="overtakelsen-PC.png"><img src="overtakelsen-PC.png"></a></article></div><h2>Personlige hedersprofiler</h2><div class="grid">${members.map(m=>`<article><h2>${safe(m.name)}</h2><a href="${m.id}-PC.png"><img src="${m.id}-PC.png"></a><p><a href="${m.id}-PC.png">PC</a> · <a href="${m.id}-mobil.png">Mobil</a></p></article>`).join('')}</div><h2>Grunnleggerdiplomer</h2><p class="notice">Kun forhåndsvisninger – ikke utstedt. Lokale QA-PDF-er er utenfor nettsidepakken. Nettsiden tilbyr fortsatt ingen utskrift/PDF for hedersdiplomer.</p><div class="grid">${members.filter(m=>m.founder).map(m=>`<article><h2>${safe(m.name)}</h2><img src="${m.id}-grunnleggerdiplom-IKKE-UTSTEDT.png"><p><a href="${m.id}-grunnleggerdiplom-IKKE-UTSTEDT.pdf">A4 QA-utkast</a> · <a href="${m.id}-diplom-mobil.png">Forhåndsvisning på mobil</a></p></article>`).join('')}</div></main></html>`;
  await fs.writeFile(path.join(out,'index.html'),gallery);
  console.log(JSON.stringify({out,profiles:profiles.length,explicitRunnerLinks:ids.length,diplomas:diplomas.length,ordinaryCardsPreserved:parity.every(p=>p.ordinaryCardUnchanged)}));
 }finally{await h.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
