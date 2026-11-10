const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h;
before(async()=>{h=await createHarness();});after(async()=>{await h.close();});
async function page(width=390){const p=await h.browser.newPage({viewport:{width,height:900}});await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;}
test('V2 exports both exact formats across every tier and keeps actual text/image ink within the frame',async()=>{
 const p=await page();try{
  const samples=await p.evaluate(()=>[0,5,10,15,20,25,30,35].map(n=>S.people.find(p=>n===0?p.c<5:p.c>=n&&p.c<n+5).i));
  samples.push(await p.evaluate(()=>{
   const g=person('MOR-15AF3A3');g.n='Gunnar Kåsa Med Et Svært Langt Historisk Navn Som Skal Vises Uten Avkutting';
   S.courseRecords.push({pid:g.i,name:g.n,event:'Langmoro 20 km',gender:'Herrer',time:'1:00:00',year:2026});
   return g.i;
  }));
  for(const pid of samples)for(const format of ['portrait','square']){
   const r=await p.evaluate(async({pid,format})=>{
    const drawn=[],texts=[],it=CanvasRenderingContext2D.prototype.fillText,ii=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.fillText=function(v,x,y,...args){const m=this.measureText(String(v)),t=this.getTransform();texts.push({v:String(v),left:t.a*(x-m.actualBoundingBoxLeft)+t.e,right:t.a*(x+m.actualBoundingBoxRight)+t.e,top:t.d*(y-m.actualBoundingBoxAscent)+t.f,bottom:t.d*(y+m.actualBoundingBoxDescent)+t.f});return it.call(this,v,x,y,...args)};
    CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.width===1080&&args.length===4){const [x,y,w,h]=args,t=this.getTransform();drawn.push({src:im.src,x:t.a*x+t.e,y:t.d*y+t.f,w:t.a*w,h:t.d*h,nw:im.naturalWidth,nh:im.naturalHeight});}return ii.call(this,im,...args)};
    let b;try{b=await MorothonCard.build(pid,{format});}finally{CanvasRenderingContext2D.prototype.fillText=it;CanvasRenderingContext2D.prototype.drawImage=ii;}
    const bitmap=await createImageBitmap(b.blob),size=[bitmap.width,bitmap.height];bitmap.close();URL.revokeObjectURL(b.url);
    const m=MorothonCard.model(pid);return {size,texts,drawn,medals:m.earned.map(b=>BADGE_IMAGES[b.n])};
   },{pid,format});
   assert.deepEqual(r.size,[1080,format==='portrait'?1350:1080]);
   for(const t of r.texts){assert.ok(t.left>=40&&t.right<=1040&&t.top>=35&&t.bottom<=r.size[1]-40,`${pid} ${format}: ${JSON.stringify(t)}`);}
   for(const image of r.drawn.filter(i=>r.medals.includes(i.src))){assert.ok(Math.abs(image.w/image.h-image.nw/image.nh)<.001,'medals keep native aspect ratio');}
   assert.ok(!r.texts.some(t=>t.v==='HØYESTE OPPNÅDDE HOVEDMERKE'));
  }
 }finally{await p.close();}
});
test('V2 Inger shares current personal statistics and progress; her silver diploma remains historical',async()=>{
 const p=await page();try{const r=await p.evaluate(async()=>{const p=S.people.find(p=>p.n==='Inger Katherin Dahl Frantzen'),m=MorothonCard.model(p.i),d=await MorothonDiplomas.prepare(p.i,'badge:10');openProfile(p.i);const card=document.querySelector('.brag-card');return {c:p.c,highest:m.highest.n,previous:m.previous.map(b=>b.n),next:m.next.next.n,card:card.textContent,stats:MorothonCard.cardStats(m),bar:[card.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),card.querySelector('[role="progressbar"]').getAttribute('aria-valuemax')],best:displayTime(m.best.row[5]),km:formatKm(m.totals.km),d:[d.count,d.firstYear,d.lastYear,d.dateLabel]};});
  assert.deepEqual([r.c,r.highest,r.previous,r.next],[12,10,[5],15]);assert.deepEqual(r.bar,['12','15']);assert.match(r.card,/12 \/ 15/);assert.ok(r.card.includes(r.best)&&r.card.includes(r.km));assert.ok(!r.stats.some(s=>s[0]==='LENGSTE HISTORISKE REKKE'));assert.deepEqual(r.d,[10,2015,2024,'Søgne, 9. november 2024']);
 }finally{await p.close();}
});
test('V2 previous medal motifs are 85–105px, source-complete and smaller than the main medal at all thresholds',async()=>{
 const p=await page();try{const rows=await p.evaluate(async()=>{const p=person('MOR-15AF3A3'),old=p.c,rows=[];try{for(const n of [5,10,15,20,25,30,35,40,45,50]){p.c=n;const m=MorothonCard.model(p.i);for(const b of m.previous){const im=await loadCanvasImage(BADGE_IMAGES[b.n]),box=MorothonCard.visibleBounds(im);rows.push({n,count:m.previous.length,edge:MorothonCard.collectionSize(m.previous.length),box,w:im.naturalWidth,h:im.naturalHeight,main:MorothonCard.heroLayout(m).medal.height});}}}finally{p.c=old;}return rows;});
  for(const r of rows){assert.ok(r.edge>=85&&r.edge<=105);assert.ok(r.main>=r.edge*2.8);assert.ok(r.box.x>=0&&r.box.y>=0&&r.box.x+r.box.width<=r.w&&r.box.y+r.box.height<=r.h);}
 }finally{await p.close();}
});
test('V2 format selector regenerates the actual download, defaults to 4:5 and survives rapid changes',async()=>{
 const p=await page();try{
  await p.evaluate(()=>showSharePreview('MOR-C788866'));await p.waitForFunction(()=>document.querySelector('#sharePreview').naturalHeight===1350);
  assert.equal(await p.locator('#shareFormat').inputValue(),'portrait');
  await p.selectOption('#shareFormat','square');await p.waitForFunction(()=>document.querySelector('#sharePreview').naturalHeight===1080);
  const download=await p.evaluate(async()=>{const b=await createImageBitmap(shareBlob),r=[b.width,b.height];b.close();return r;});assert.deepEqual(download,[1080,1080]);
  await p.evaluate(()=>{showSharePreview('MOR-C788866',{format:'square'});showSharePreview('MOR-C788866',{format:'portrait'});});await p.waitForFunction(()=>document.querySelector('#sharePreview').naturalHeight===1350&&!document.querySelector('#shareSave').disabled);
  assert.equal(await p.evaluate(()=>document.querySelector('.share-modal').scrollWidth<=document.querySelector('.share-modal').clientWidth+1),true);
  await p.evaluate(()=>closeSharePreview());assert.equal(await p.locator('#shareOverlay').isVisible(),false);
 }finally{await p.close();}
});
test('V2 honor preview is undiscoverable from public pages, noindex/nofollow, but accessible directly',async()=>{
 for(const width of [320,390,1440]){const p=await page(width);try{
  await p.evaluate(()=>openProfile('MOR-15AF3A3'));assert.equal(await p.locator('a[href*="heder.html"]').count(),0);await p.goto(h.base+'/heder.html');await p.locator('#serviceBadges img').first().waitFor({state:'attached'});
  assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex, nofollow');assert.equal(await p.locator('#serviceBadges img').count(),3);assert.match(await p.locator('.development-note').textContent(),/Denne siden er under utvikling.*Har du bilder, historier eller korrigeringer/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await p.close();}}
 const root=path.resolve(__dirname,'..');for(const name of (await fs.readdir(root)).filter(n=>/sitemap.*\.(xml|txt)$/.test(n)))assert.doesNotMatch(await fs.readFile(path.join(root,name),'utf8'),/heder\.html/);
});
test('V2 launch switch restores only intentional desktop/mobile navigation links',async()=>{
 const p=await h.browser.newPage();try{const code=await fs.readFile(path.join(__dirname,'../js/navigation.js'),'utf8');await p.route('**/js/navigation.js',r=>r.fulfill({body:code.replace('HONORS_NAVIGATION_ENABLED = false','HONORS_NAVIGATION_ENABLED = true'),contentType:'text/javascript'}));await p.goto(h.base);assert.equal(await p.locator('.navlinks a[href="heder.html"],.mobile-menu a[href="heder.html"]').count(),2);}finally{await p.close();}
});
test('V2 Oscar is a sourced founder; ceremonial diploma has no technical statuses and cannot be issued publicly',async()=>{
 for(const width of [320,390,1440]){const p=await h.browser.newPage({viewport:{width,height:900}});try{
  await p.goto(h.base+'/heder.html#person/oscar-lohne');await p.locator('#profileName').waitFor();await p.locator('.diploma-example summary').click();await p.waitForFunction(()=>document.querySelector('.honor-diploma-status').textContent.includes('A4-utkast kontrollert'));
  const r=await p.evaluate(async()=>{const doc=document.querySelector('iframe').contentDocument,d=await MorothonDiplomas.serviceDraft();return {text:doc.body.textContent,layout:await MorothonDiplomas.checkLayout(doc),same:doc.querySelector('.diploma-medal').src===document.querySelector('.profile-medal').src,ready:d.imageReady,preview:d.previewOnly};});
  assert.doesNotMatch(r.text,/BEKREFTET|UTKAST|FORELØPIG|Designutkast|IKKE UTSTEDT/);assert.match(r.text,/Du var med på å skape Morothon/);assert.match(r.text,/Håkon Lohne.*Løpsleder Morothon/);assert.equal(r.layout.ready,true);assert.equal(r.same,true);assert.equal(r.ready,false);assert.equal(r.preview,true);assert.equal(await p.locator('[data-honor-print],[data-honor-pdf]').count(),0);assert.equal(await p.locator('iframe').getAttribute('sandbox'),'allow-same-origin');assert.match(await p.locator('.honor-draft-notice').textContent(),/ikke utstedt/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await p.close();}}
});
