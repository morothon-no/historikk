// Local review artifacts only. No writes to history/assets, no push or deployment.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
const names=[['Inger Katherin Dahl Frantzen','Inger'],['Finn Gerhard Olsen','Finn'],['Gunnar Kåsa','Gunnar'],['Morten Borø','Morten']];
(async()=>{
 const out=path.resolve(process.argv[2]||'/tmp/morothon-v2'),beforeRef=process.argv[3]||'HEAD';await fs.mkdir(out,{recursive:true});const h=await createHarness();
 try{
  const p=await h.browser.newPage({viewport:{width:1440,height:1000}}),metrics=[],navigation=[];
  const writeCard=async(page,name,file,format)=>{const r=await page.evaluate(async({name,format})=>{const person=S.people.find(p=>p.n===name),m=MorothonCard.model(person.i),c=await MorothonCard.build(person.i,{format});const b=await createImageBitmap(c.blob),size=[b.width,b.height];b.close();URL.revokeObjectURL(c.url);return {bytes:Array.from(new Uint8Array(await c.blob.arrayBuffer())),size,pid:person.i,highest:m.highest.n,count:person.c,previous:m.previous.map(b=>b.n),best:displayTime(m.best.row[5]),km:formatKm(m.totals.km)};},{name,format});await fs.writeFile(path.join(out,file),Buffer.from(r.bytes));const {bytes,...info}=r;return info;};
  // Recover the real earlier 4:5 renderer, never stretch the prior square export.
  const before=await h.browser.newPage();
  for(const file of ['js/brag-card.js','css/brag-card.css']){const body=execFileSync('git',['show',`${beforeRef}:${file}`],{cwd:path.resolve(__dirname,'..')});await before.route('**/'+file,r=>r.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));}
  await before.goto(h.base);await before.waitForFunction(()=>!document.querySelector('#loading'));
  for(const [name,label]of names){const file=path.join(out,label+'-tidligere-4x5.png');if(!await fs.stat(file).catch(()=>null))await writeCard(before,name,label+'-tidligere-4x5.png','portrait');}
  await before.close();await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  for(const [name,label]of names){
   for(const format of ['portrait','square'])metrics.push({name,label,format,...await writeCard(p,name,label+'-v2-'+format+'.png',format)});
   await p.setViewportSize({width:390,height:900});await p.evaluate(name=>openProfile(S.people.find(p=>p.n===name).i),name);await p.screenshot({path:path.join(out,label+'-profil-mobil.png')});await p.evaluate(()=>closeProfile());
   const bytes=await fs.readFile(path.join(out,label+'-v2-portrait.png'));
   await p.setContent(`<style>html,body{margin:0;background:#061820}img{display:block;width:390px;height:auto}</style><img alt="${name}" src="data:image/png;base64,${bytes.toString('base64')}">`);await p.locator('img').evaluate(im=>im.decode());await p.locator('img').screenshot({path:path.join(out,label+'-delingskort-mobil-390.png')});
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  }
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:900});await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
   if(width<1101)await p.locator('.mobile-menu summary').click();
   const links=await p.locator('a[href*="heder.html"]').count();assert.equal(links,0);navigation.push({width,honorLinks:links,horizontalOverflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   await p.screenshot({path:path.join(out,'navigasjon-'+width+'.png')});
   await p.goto(h.base+'/heder.html');await p.locator('#serviceBadges img').first().waitFor();await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,'hedersside-'+width+'.png'),fullPage:true});
   await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));await p.screenshot({path:path.join(out,'Oscar-forhandsvisning-'+width+'.png'),fullPage:true});
  }
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  for(const [name,key,file]of [['Inger Katherin Dahl Frantzen','badge:10','Inger-solvdiplom-2024'],['Gunnar Kåsa','badge:35','Gunnar-diplom'],['Morten Borø','badge:35','Morten-diplom'],[null,'debut','Debutdiplom'],[null,'service','Oscar-grunnleggerdiplom-IKKE-UTSTEDT']]){
   const r=await p.evaluate(async({name,key})=>{const d=key==='service'?await MorothonDiplomas.serviceDraft():await MorothonDiplomas.prepare((name?S.people.find(p=>p.n===name):S.people.find(p=>p.c===1&&p.f===2026)).i,key);return {html:MorothonDiplomas.documentHtml(d),name:d.name};},{name,key});
   const d=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:1.5});await d.setContent(r.html);await d.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   const layout=await d.evaluate(async()=>{const sheet=document.querySelector('.diploma-sheet').getBoundingClientRect();return [...document.querySelectorAll('[data-layout-check]')].every(e=>{const r=e.getBoundingClientRect();return r.left>=sheet.left-.5&&r.right<=sheet.right+1&&r.bottom<=sheet.bottom+1&&e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1;});});assert.equal(layout,true,file);
   await d.locator('.diploma-sheet').screenshot({path:path.join(out,file+'.png')});await d.pdf({path:path.join(out,file+'.pdf'),format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});await d.close();
   assert.match(execFileSync('pdfinfo',[path.join(out,file+'.pdf')]).toString(),/Pages:\s+1\b/);
  }
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const style='*{box-sizing:border-box}body{margin:0;padding:24px;background:#eae5d9;color:#163b46;font:16px/1.5 Arial}h1,p,h2{text-align:center}h2{font-size:21px}img{display:block;width:100%;height:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}section{min-width:0}nav{display:flex;justify-content:center;flex-wrap:wrap;gap:18px;margin:20px}a{color:inherit}.notice{text-align:center;padding:12px;background:#fff6dc;border:1px solid #c6a867}';
  const frame=(title,body)=>`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(title)}</title><style>${style}</style><h1>${safe(title)}</h1>${body}</html>`;
  const pair=(name,label)=>`<section><h2>${safe(name)} · tidligere 4:5</h2><img src="${label}-tidligere-4x5.png"></section><section><h2>${safe(name)} · V2 4:5</h2><img src="${label}-v2-portrait.png"></section>`;
  await p.route(h.base+'/review-v2/**',async route=>{const name=new URL(route.request().url()).pathname.split('/').pop();if(!/^[a-zA-Z0-9._-]+$/.test(name))return route.abort();try{return route.fulfill({body:await fs.readFile(path.join(out,name)),contentType:name.endsWith('.png')?'image/png':'text/html'});}catch{return route.abort();}});
  await p.setViewportSize({width:1440,height:1100});
  for(const [name,label]of names){const html=frame(name+' – sammenligning',`<p>Original 4:5 fra ${safe(beforeRef)} mot forbedret V2. Begge er ekte 1080 × 1350-eksporter.</p><div class="grid">${pair(name,label)}</div>`);await fs.writeFile(path.join(out,label+'-sammenligning.html'),html);await p.goto(h.base+'/review-v2/'+label+'-sammenligning.html');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,label+'-sammenligning.png'),fullPage:true});}
  const index=frame('Morothon – sluttjustering V2',`<p>Lokale forhåndsvisninger · ingen push, merge eller publisering</p><nav><a href="sluttrapport.md">Rapport og filliste</a><a href="Inger-solvdiplom-2024.pdf">Ingers historiske sølvdiplom</a><a href="hedersside-1440.png">Hedersside under utvikling</a><a href="navigasjon-390.png">Offentlig mobilmeny</a></nav><div class="grid">${names.map(([name,label])=>`<section><h2>${safe(name)}</h2><a href="${label}-sammenligning.png"><img src="${label}-sammenligning.png"></a><p><a href="${label}-v2-portrait.png">4:5</a> · <a href="${label}-v2-square.png">1:1</a> · <a href="${label}-delingskort-mobil-390.png">Faktisk mobilstørrelse</a></p></section>`).join('')}</div><h2>Oscar Lohne – grunnleggerdiplom</h2><p class="notice">Kun forhåndsvisning. Ikke utstedt. Utkaststatus står utenfor selve diplomdesignet. Ingen utskrift eller PDF fra hederssiden.</p><img src="Oscar-grunnleggerdiplom-IKKE-UTSTEDT.png"><p><a href="Oscar-forhandsvisning-390.png">Se utkastet med status og kontekst på mobil</a></p>`);
  await fs.writeFile(path.join(out,'index.html'),index);await p.setViewportSize({width:1600,height:1100});await p.goto(h.base+'/review-v2/index.html');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,'samlet-gjennomgang.png'),fullPage:true});
  await fs.writeFile(path.join(out,'kontrollmaal.json'),JSON.stringify({beforeRef,metrics,navigation},null,2)+'\n');console.log(JSON.stringify({out,cards:metrics.length,navigation,localA4Pdfs:5}));
 }finally{await h.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
