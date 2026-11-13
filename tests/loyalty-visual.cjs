const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..');let h,rules,history;
before(async()=>{const context=vm.createContext({window:{}});for(const file of ['history-data','loyalty'])vm.runInContext(await fs.readFile(path.join(root,`js/${file}.js`),'utf8'),context);rules=context.window;history=JSON.parse(await fs.readFile(path.join(root,'public-data/data/history.json'),'utf8'));h=await createHarness();});
after(async()=>{await h?.close();});
const years=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const row=(y,id='runner',status='Fullført',race='Morothon')=>[y,id,race,'20 km',status,status==='Fullført'?'2:00:00':status,1];
const plain=x=>JSON.parse(JSON.stringify(x));
const calc=(ys,editions)=>rules.MorothonLoyalty.calculate(ys.map(y=>row(y)),editions);
async function page(width=390,fixture){const p=await h.browser.newPage({viewport:{width,height:1000}});if(fixture)await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;}
test('V3.2 profile, card and loyalty calendar distinguish period share, historical honours and latest participants at all widths',async()=>{
 for(const width of [320,390,768,1440]){const p=await page(width);try{
  const r=await p.evaluate(()=>{openProfile('MOR-0C5F6C9');const m=MorothonCard.model('MOR-0C5F6C9');return {stats:MorothonCard.cardStats(m),card:document.querySelector('.brag-card').textContent,details:document.querySelector('.runner-full-details').textContent,L:loyalty(person(m.p.i))};});
  assert.match(r.card,/5 på rad.*2005–2009/);assert.match(r.card,/2016/);assert.doesNotMatch(r.card,/35\s*%|50\s*%|lojalitet siden debut/i);assert.match(r.details,/12 av 24 arrangerte utgaver i perioden 1993–2016 · 50 %/);assert.equal(r.L.count,12);
  await p.evaluate(()=>closeProfile());await p.locator('#loyalSearch').fill('Kristen Fløgstad');assert.match(await p.locator('#loyalGrid').textContent(),/50 %.*12 av 24 arrangerte utgaver · 1993–2016/);await p.selectOption('#loyalMode','recent');assert.equal(await p.locator('.loyal-card').count(),0);await p.selectOption('#loyalMode','period');assert.equal(await p.locator('.loyal-card').count(),1);
  await p.locator('#loyalSearch').fill('');await p.selectOption('#loyalMode','honors');assert.ok(await p.locator('.loyal-card').count()>0);assert.match(await p.locator('#loyalExplanation').textContent(),/debut.*beholdes ved comeback/);
  const data=await p.locator('.loyal-card').evaluateAll(es=>es.map(e=>e.textContent));assert.ok(data.every(t=>/arrangerte utgaver · \d{4}–\d{4}/.test(t)));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await p.close();}}
});
test('V3.2 comeback keeps named historical recognition on profile, both exports and the honours calendar without claiming current 100%',async()=>{
 const fixture=structuredClone(history),id='V32-RETURN';fixture.people.push({i:id,n:'Dokumentert testløper',g:'Herre'});fixture.results.push(...[...years(2000,2009),2027].map(y=>row(y,id)));fixture.yearStats.push([2027,1]);const p=await page(390,fixture);try{
  const r=await p.evaluate(async id=>{openProfile(id);const m=MorothonCard.model(id),texts=[],original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...args){texts.push(String(t));return original.call(this,t,...args);};try{for(const format of ['portrait','square']){const b=await MorothonCard.build(id,{format});URL.revokeObjectURL(b.url);}}finally{CanvasRenderingContext2D.prototype.fillText=original;}return {card:document.querySelector('.brag-card').textContent,profile:document.querySelector('#profileLoyaltyDisclosure').textContent,texts,stats:MorothonCard.cardStats(m)};},id);
  assert.match(r.card,/historisk heder.*2000–2009/i);assert.doesNotMatch(r.card,/100\s*%|39[,.]?\d*\s*%/);assert.match(r.profile,/Tilbake i 2027/);assert.match(r.profile,/Ubrutt deltakelse i perioden 2000–2009/);assert.ok(r.texts.includes('HISTORISK HEDER'));assert.ok(r.texts.includes('2000–2009'));assert.ok(!r.texts.some(t=>/100\s*%|39[,.]?\d*\s*%/.test(t)));
  await p.evaluate(()=>closeProfile());await p.selectOption('#loyalMode','honors');await p.locator('#loyalSearch').fill('Dokumentert testløper');assert.match(await p.locator('#loyalGrid').textContent(),/100 %.*10 av 10 arrangerte utgaver · 2000–2009.*historisk oppnådd/);await p.selectOption('#loyalMode','period');assert.match(await p.locator('#loyalGrid').textContent(),/11 av 28 arrangerte utgaver · 2000–2027/);
 }finally{await p.close();}
});
test('V3.2 70/90/100 honours use the same named periods on profile, both PNG formats and the calendar',async()=>{
 const fixture=structuredClone(history),cases=[{id:'V32-70',years:[2000,...years(2002,2006),2009],level:70,name:'Trofast Morothon-løper',range:'2000–2009'},{id:'V32-90',years:[2000,...years(2002,2009)],level:90,name:'Svært trofast',range:'2000–2009'},{id:'V32-100',years:years(2017,2026),level:100,name:'Ubrutt siden debut',range:'2017–2026'}];
 for(const c of cases){fixture.people.push({i:c.id,n:c.id,g:'Herre'});fixture.results.push(...c.years.map(y=>row(y,c.id)));}
 const p=await page(390,fixture);try{for(const c of cases){
  const r=await p.evaluate(async c=>{openProfile(c.id);const texts=[],it=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(v,...args){texts.push(String(v));return it.call(this,v,...args);};try{for(const format of ['portrait','square']){const b=await MorothonCard.build(c.id,{format});URL.revokeObjectURL(b.url);}}finally{CanvasRenderingContext2D.prototype.fillText=it;}return {stats:MorothonCard.cardStats(MorothonCard.model(c.id)),card:document.querySelector('.brag-card').textContent,profile:document.querySelector('#profileLoyaltyDisclosure').textContent,texts};},c);
  assert.match(r.card,new RegExp(c.level+' %'));assert.ok(r.card.includes(c.range));assert.ok(r.profile.includes(c.name));assert.ok(r.texts.includes(c.level+' %'));assert.ok(r.texts.includes(c.range));
  await p.evaluate(()=>closeProfile());await p.locator('#loyalSearch').fill(c.id);assert.match(await p.locator('#loyalGrid').textContent(),new RegExp(c.level+' %'));assert.ok((await p.locator('#loyalGrid').textContent()).includes(c.range));
 }}finally{await p.close();}
});
test('V3.2 actual PNG ink, adaptive medals and section bounds fit both formats through nine previous medals, records and long names',async()=>{
 const p=await page();try{
  const ids=await p.evaluate(()=>[5,10,15,25,30,35].map(n=>S.people.find(p=>p.c>=n&&p.c<n+5).i));ids.push('MOR-0C5F6C9');ids.push(await p.evaluate(()=>{const original=person('MOR-0C5F6C9'),p={...original,i:'V32-LONG',n:'Kristen Med Et Svært Langt Historisk Navn Som Må Brytes Uten Avkutting'};S.personById.set(p.i,p);S.resultsByPid.set(p.i,resultsFor(original.i));return p.i;}));ids.push(await p.evaluate(()=>S.courseRecords[0].pid));
  for(const count of [40,45,50])ids.push(await p.evaluate(count=>{const p={...S.people.find(p=>p.c===35),i:'V32-'+count,c:count};S.personById.set(p.i,p);S.resultsByPid.set(p.i,resultsFor('MOR-15AF3A3'));return p.i;},count));
  for(const pid of ids)for(const format of ['portrait','square']){
   const r=await p.evaluate(async({pid,format})=>{
    const m=MorothonCard.model(pid),texts=[],images=[],it=CanvasRenderingContext2D.prototype.fillText,ii=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.fillText=function(v,x,y,...args){if(this.canvas.width===1080){const b=this.measureText(String(v)),t=this.getTransform();texts.push({v:String(v),left:t.a*(x-b.actualBoundingBoxLeft)+t.e,right:t.a*(x+b.actualBoundingBoxRight)+t.e,top:t.d*(y-b.actualBoundingBoxAscent)+t.f,bottom:t.d*(y+b.actualBoundingBoxDescent)+t.f});}return it.call(this,v,x,y,...args);};
    CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.width===1080&&args.length===4&&m.earned.some(b=>BADGE_IMAGES[b.n]===im.src)){const [x,y,w,h]=args,t=this.getTransform(),b=MorothonCard.visibleBounds(im);images.push({src:im.src,left:t.a*(x+w*b.x/im.naturalWidth)+t.e,right:t.a*(x+w*(b.x+b.width)/im.naturalWidth)+t.e,top:t.d*(y+h*b.y/im.naturalHeight)+t.f,bottom:t.d*(y+h*(b.y+b.height)/im.naturalHeight)+t.f,ratio:w/h,native:im.naturalWidth/im.naturalHeight});}return ii.call(this,im,...args);};
    let b;try{b=await MorothonCard.build(pid,{format});}finally{CanvasRenderingContext2D.prototype.fillText=it;CanvasRenderingContext2D.prototype.drawImage=ii;}
    const bitmap=await createImageBitmap(b.blob),size=[bitmap.width,bitmap.height];bitmap.close();URL.revokeObjectURL(b.url);return {texts,images,size,layout:b.layout,previous:m.previous.length};
   },{pid,format});
   assert.deepEqual(r.size,[1080,format==='portrait'?1350:1080]);for(const t of r.texts)assert.ok(t.left>=40&&t.right<=1040&&t.top>=35&&t.bottom<=r.size[1]-40,`${pid}/${format} text ${JSON.stringify(t)}`);
   for(const im of r.images){assert.ok(Math.abs(im.ratio-im.native)<.001);assert.ok(im.left>=40&&im.right<=1040&&im.top>=35&&im.bottom<=r.size[1]-100);for(const t of r.texts)assert.ok(!(im.left<t.right-.5&&im.right>t.left+.5&&im.top<t.bottom-.5&&im.bottom>t.top+.5),`${pid}/${format} medal overlaps ${t.v}`);}
   const sections=r.layout.sections;for(let i=1;i<sections.length;i++)assert.ok(sections[i].top>=sections[i-1].bottom-.1);assert.ok(sections.at(-1).bottom<=r.size[1]-100+.1);
   if(pid==='MOR-0C5F6C9'){assert.equal(r.layout.scale,1);assert.equal(r.layout.collectionEdge,180);assert.ok(!r.texts.some(t=>/35\s*%|50\s*%|LOJALITET SIDEN DEBUT/.test(t)));const bronze=r.images[1];assert.ok(Math.abs(Math.max(bronze.right-bronze.left,bronze.bottom-bronze.top)-180)<.01);}
   if(r.images.length>1){const main=Math.max(r.images[0].right-r.images[0].left,r.images[0].bottom-r.images[0].top),previous=Math.max(...r.images.slice(1).map(im=>Math.max(im.right-im.left,im.bottom-im.top)));assert.ok(main>previous*1.5,'main medal stays clearly largest');}
  }
 }finally{await p.close();}
});
test('V3.2 mobile and desktop profiles keep complete medal motifs, readable stats and a clearly larger main medal',async()=>{
 for(const width of [320,390,1440]){const p=await page(width);try{
  const ids=await p.evaluate(()=>['MOR-0C5F6C9',...[5,15,30,35].map(n=>S.people.find(p=>p.c>=n&&p.c<n+5).i),S.courseRecords[0].pid]);
  for(const id of ids){await p.evaluate(id=>openProfile(id),id);await p.evaluate(()=>Promise.all([...document.querySelectorAll('.brag-card img')].map(im=>im.decode())));
   const r=await p.locator('.brag-card').evaluate(card=>{
    const b=card.getBoundingClientRect(),ink=im=>{const r=im.getBoundingClientRect(),v=MorothonCard.visibleBounds(im),scale=Math.min(r.width/im.naturalWidth,r.height/im.naturalHeight),x=r.x+(r.width-im.naturalWidth*scale)/2,y=r.y+(r.height-im.naturalHeight*scale)/2;return {left:x+v.x*scale,right:x+(v.x+v.width)*scale,top:y+v.y*scale,bottom:y+(v.y+v.height)*scale};};
    const medals=[...card.querySelectorAll('.brag-main-medal,.brag-medal-row img')].map(ink);
    const statText=[...card.querySelectorAll('.brag-stats strong,.brag-stats small,.brag-stats em')].map(e=>{const r=e.getBoundingClientRect();return {fits:e.scrollWidth<=e.clientWidth+1,left:r.left,right:r.right,center:getComputedStyle(e).textAlign};});
    return {bounds:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height},medals,statText,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(r.overflow,false);for(const im of r.medals){assert.ok(im.left>=r.bounds.left&&im.right<=r.bounds.right&&im.top>=r.bounds.top&&im.bottom<=r.bounds.bottom);}
   if(r.medals.length>1){const edge=im=>Math.max(im.right-im.left,im.bottom-im.top);assert.ok(edge(r.medals[0])>Math.max(...r.medals.slice(1).map(edge))*1.5,`${id}/${width} hierarchy`);}
   for(const t of r.statText){assert.equal(t.fits,true);assert.ok(t.left>=r.bounds.left&&t.right<=r.bounds.right);assert.equal(t.center,'center');}
   if(id==='MOR-0C5F6C9'&&width<400){assert.ok(r.bounds.height<910,'larger medals remain within the 947–980px mobile baseline');}
   await p.evaluate(()=>closeProfile());
  }
 }finally{await p.close();}}
});
