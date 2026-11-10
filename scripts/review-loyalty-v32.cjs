// Local before/after evidence, recovered from Git blobs. Never writes to result/asset sources.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createHarness}=require('./diploma-harness.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/morothon-v32-additions'),ref=process.argv[3]||'93d4ff3',h=await createHarness();await fs.mkdir(out,{recursive:true});
 const original=new Map(['/index.html','/js/brag-card.js','/css/brag-card.css'].map(f=>[f,execFileSync('git',['show',ref+':'+f.slice(1)],{cwd:root})]));
 const pages={},checks=[];
 try{
  for(const version of ['before','after']){
   const p=await h.browser.newPage({viewport:{width:390,height:1000}});pages[version]=p;
   if(version==='before')await p.route('**/*',r=>{const pathname=new URL(r.request().url()).pathname,key=pathname==='/'?'/index.html':pathname;return original.has(key)?r.fulfill({body:original.get(key),contentType:key.endsWith('.js')?'text/javascript':key.endsWith('.css')?'text/css':'text/html'}):r.continue();});
   await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  }
  const samples=await pages.after.evaluate(()=>[
   {key:'Kristen',id:'MOR-0C5F6C9'},
   {key:'Bronse',id:S.people.find(p=>p.c>=5&&p.c<10).i},
   {key:'To-tidligere',id:S.people.find(p=>p.c>=15&&p.c<20).i},
   {key:'Inger',id:S.people.find(p=>p.n==='Inger Katherin Dahl Frantzen').i},
   {key:'Legende',id:S.people.find(p=>p.n==='Finn Gerhard Olsen').i},
   {key:'Aeresloper',id:S.people.find(p=>p.n==='Gunnar Kåsa').i},
   {key:'Rekordholder',id:S.courseRecords[0].pid},
   ...[40,45,50].map(count=>({key:'Syntetisk-'+count,id:'V32-'+count,count})),
   {key:'Langt-testnavn',id:'V32-LONG',long:true}
  ]);
  for(const sample of samples)for(const [version,p]of Object.entries(pages)){
   await p.bringToFront();
   if(sample.count||sample.long)await p.evaluate(s=>{const origin=person('MOR-0C5F6C9'),p={...origin,i:s.id,c:s.count||12,n:s.long?'Eksempel Med Et Ekstraordinært Langt Testnavn For Kontroll Av Linjebryting':`Syntetisk kontroll · ${s.count} deltakelser`};S.personById.set(p.i,p);S.resultsByPid.set(p.i,resultsFor(origin.i));},sample);
   for(const format of ['portrait','square']){
    const r=await p.evaluate(async({id,format})=>{const m=MorothonCard.model(id),b=await MorothonCard.build(id,{format});const bitmap=await createImageBitmap(b.blob);const size=[bitmap.width,bitmap.height];bitmap.close();URL.revokeObjectURL(b.url);return {bytes:[...new Uint8Array(await b.blob.arrayBuffer())],size,name:m.p.n,count:m.p.c,previous:m.previous.length,stats:MorothonCard.cardStats(m),edge:MorothonCard.collectionSize(m.previous.length),layout:b.layout};},{id:sample.id,format});
    assert.deepEqual(r.size,[1080,format==='portrait'?1350:1080]);await fs.writeFile(path.join(out,`${sample.key}-${version}-${format}.png`),Buffer.from(r.bytes));delete r.bytes;console.log(`${sample.key} ${version} ${format}`);checks.push({...sample,version,format,...r});
   }
   if(!sample.count)for(const width of [320,390,1440]){
    await p.setViewportSize({width,height:1000});await p.evaluate(id=>openProfile(id),sample.id);await p.evaluate(()=>Promise.all([...document.querySelectorAll('.brag-card img')].map(i=>i.decode())));
    const sizes=await p.locator('.brag-card').evaluate(e=>({card:e.getBoundingClientRect().toJSON(),main:e.querySelector('.brag-main-medal')?.getBoundingClientRect().toJSON(),previous:e.querySelector('.brag-medal-row img')?.getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(sizes.overflow,false);checks.push({key:sample.key,version,width,...sizes});
    await p.locator('.brag-card').screenshot({path:path.join(out,`${sample.key}-${version}-profil-${width}.png`),animations:'disabled'});await p.evaluate(()=>closeProfile());
   }
  }
  const gallery=await h.browser.newPage({viewport:{width:850,height:1300}});
  await gallery.route(h.base+'/review/**',async r=>{const name=new URL(r.request().url()).pathname.split('/').pop();if(!/^[a-zA-Z0-9._-]+$/.test(name))return r.abort();try{return r.fulfill({body:await fs.readFile(path.join(out,name)),contentType:name.endsWith('.png')?'image/png':'text/html'});}catch{return r.abort();}});
  const style='*{box-sizing:border-box}body{background:#eee8dc;color:#123b45;font:16px/1.5 Arial;margin:0;padding:24px}h1,h2,p{text-align:center}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:22px auto;max-width:1000px}figure{margin:0;min-width:0}figcaption{text-align:center;font-weight:bold;padding:8px}img{width:100%;height:auto;display:block}nav{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}a{color:inherit}@media(max-width:700px){section{grid-template-columns:1fr}}';
  const pair=(s,suffix)=>['before','after'].map(v=>`<figure><figcaption>${s.key} · ${v==='before'?'før':'etter'}</figcaption><img src="${s.key}-${v}-${suffix}.png"></figure>`).join('');
  for(const s of samples){const html=`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style><h1>${s.key} · V3.2 før/etter</h1><p>Ekte 1080 × 1350 PNG vist i mobilstørrelse. Før: ${ref}. Etter: arbeidsversjonen.</p><section>${pair(s,'portrait')}</section>`;await fs.writeFile(path.join(out,s.key+'-sammenligning.html'),html);await gallery.goto(h.base+'/review/'+s.key+'-sammenligning.html');await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await gallery.screenshot({path:path.join(out,s.key+'-sammenligning.png'),fullPage:true});}
  const html=`<!doctype html><html lang="no"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Morothon V3.2 · lojalitet og medaljer</title><style>${style}</style><h1>V3.2 · lojalitet og større medaljesamling</h1><p>Lokale før/etter-eksempler, ingen merge eller publisering. Syntetiske terskler 40–50 og langt testnavn er bare testdata i nettleserminnet.</p><nav><a href="kontroll.json">Målinger</a><a href="../tilleggsrapport.md">Rapport</a></nav>${samples.map(s=>`<h2>${s.key}</h2><section>${pair(s,'portrait')}</section><p><a href="${s.key}-before-square.png">Før 1:1</a> · <a href="${s.key}-after-square.png">Etter 1:1</a>${!s.count?` · <a href="${s.key}-after-profil-320.png">Profil 320</a> · <a href="${s.key}-after-profil-390.png">Profil 390</a> · <a href="${s.key}-after-profil-1440.png">Profil PC</a>`:''}</p>`).join('')}`;
  await fs.writeFile(path.join(out,'index.html'),html);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({before:ref,samples,checks},null,2)+'\n');console.log(JSON.stringify({out,samples:samples.length,exports:checks.filter(c=>c.format).length,profileViews:checks.filter(c=>c.width).length}));
 }finally{await h.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
