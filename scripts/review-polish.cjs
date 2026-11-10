// Local review only: captures before/after assets, PNG exports and native A4 PDFs. No publishing.
const fs=require('node:fs/promises'),path=require('node:path');const {createHarness}=require('./diploma-harness.cjs');
(async()=>{const out=path.resolve(process.argv[2]||'/tmp/morothon-polish-review');await fs.mkdir(out,{recursive:true});const h=await createHarness();try{
 const p=await h.browser.newPage({viewport:{width:390,height:900}});await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
 const metrics=[];
 for(const [name,id]of [['Morten Borø','Morten'],['Gunnar Kåsa','Gunnar'],['Inger Katherin Dahl Frantzen','Inger']]){
  const m=await p.evaluate(async name=>{const person=S.people.find(p=>p.n===name),r=await MorothonCard.build(person.i);const bitmap=await createImageBitmap(r.blob),size=[bitmap.width,bitmap.height];bitmap.close();const bytes=Array.from(new Uint8Array(await r.blob.arrayBuffer()));URL.revokeObjectURL(r.url);return {pid:person.i,bytes,size,html:MorothonCard.profileHtml(person.i),head:document.head.innerHTML};},name);
  await fs.writeFile(path.join(out,id+'-skrytekort-etter.png'),Buffer.from(m.bytes));
  const card=await h.browser.newPage({viewport:{width:390,height:1000}});await card.goto(h.base);await card.setContent('<!doctype html><html><head>'+m.head+'</head><body>'+m.html+'</body></html>');await card.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const bounds=await card.locator('.brag-card').boundingBox();await card.locator('.brag-card').screenshot({path:path.join(out,id+'-mobil-etter.png')});metrics.push({name,exportSize:m.size,mobileCard:bounds});await card.close();
 }
 for(const [name,key,file]of [['Inger Katherin Dahl Frantzen','badge:10','Inger-solvdiplom-2024'],['Gunnar Kåsa','badge:35','Gunnar-diplom'],['Morten Borø','badge:35','Morten-diplom'],[null,'debut','Debutdiplom']]){
  const prepared=await p.evaluate(async({name,key})=>{const person=name?S.people.find(p=>p.n===name):S.people.find(p=>p.c===1&&p.f===2026),m=await MorothonDiplomas.prepare(person.i,key);return {model:m,html:MorothonDiplomas.documentHtml(m)};},{name,key});
  const doc=await h.browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:1.5});await doc.setContent(prepared.html,{waitUntil:'load'});await doc.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  await doc.locator('.diploma-sheet').screenshot({path:path.join(out,file+'.png')});await doc.pdf({path:path.join(out,file+'.pdf'),format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});await doc.close();
  const {asset,...model}=prepared.model;await fs.writeFile(path.join(out,file+'-data.json'),JSON.stringify({...model,asset:{src:asset.src,width:asset.width,height:asset.height,dpi:asset.dpi,warnings:asset.warnings}},null,2)+'\n');
 }
 await fs.writeFile(path.join(out,'skrytekort-maal.json'),JSON.stringify(metrics,null,2)+'\n');
 if(await fs.stat(path.join(out,'Morten-skrytekort-for.png')).catch(()=>null)){
  await p.setViewportSize({width:1440,height:1100});
  const gallery='<!doctype html><html lang="no"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:25px;background:#eae5dc;color:#163b46;font:16px Arial}h1,h2,p{text-align:center}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}img{display:block;width:100%;height:auto}h2{font-size:22px}</style><h1>Morten Borø – kortere skrytekort</h1><p>Samme opptjente merker og prestisjenivå · full statistikk beholdes i løperprofilen</p><div class="grid"><section><h2>Før · 1080 × 1350</h2><img src="Morten-skrytekort-for.png"></section><section><h2>Etter · gjeldende hovedformat</h2><img src="Morten-skrytekort-etter.png"></section></div></html>';
  await fs.writeFile(path.join(out,'sammenligning.html'),gallery);await p.route(h.base+'/comparison/**',async r=>{const name=new URL(r.request().url()).pathname.split('/').pop();if(!['sammenligning.html','Morten-skrytekort-for.png','Morten-skrytekort-etter.png'].includes(name))return r.abort();return r.fulfill({body:await fs.readFile(path.join(out,name)),contentType:name.endsWith('.png')?'image/png':'text/html'});});await p.goto(h.base+'/comparison/sammenligning.html');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,'Morten-for-etter.png'),fullPage:true});
 }
 console.log(JSON.stringify({out,metrics}));
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1});
