const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHarness}=require('../scripts/diploma-harness.cjs');let h,history;
before(async()=>{h=await createHarness();history=JSON.parse(await fs.readFile(path.join(__dirname,'../data/history.json'),'utf8'));});after(async()=>{await h.close();});
async function load(fixture){const p=await h.browser.newPage({viewport:{width:390,height:900}});if(fixture)await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));return p;}
test('Inger historical silver: exactly 10 starts, 2015–2024 and 9 November 2024; current profile retains 12',async()=>{
 const p=await load();try{
  const r=await p.evaluate(async()=>{const person=S.people.find(p=>p.n==='Inger Katherin Dahl Frantzen'),d=await MorothonDiplomas.prepare(person.i,'badge:10'),doc=new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html');return {count:d.count,career:person.c,start:d.firstYear,end:d.lastYear,date:d.dateLabel,value:doc.querySelector('.diploma-achievement').textContent,period:doc.querySelector('.diploma-left small').textContent,text:doc.body.textContent};});
  assert.deepEqual([r.count,r.career,r.start,r.end],[10,12,2015,2024]);assert.equal(r.date,'Søgne, 9. november 2024');assert.equal(r.value,'10');assert.equal(r.period,'2015–2024');assert.doesNotMatch(r.text,/2026|12 deltakelser/);
 }finally{await p.close();}
});
test('all ten thresholds freeze at award year, dedupe annual starts, count DNF and ignore DNS through redirects',async()=>{
 const f={schemaVersion:1,people:[{i:'runner',n:'Kontrolløper',g:'Herre',c:0}],results:[],yearStats:[],redirects:{alias:'runner'}};
 for(let i=0;i<50;i++){const y=1992+i;f.results.push([y,i%2?'alias':'runner','Morothon','20 km',i===4?'DNF':'Fullført',i===4?'DNF':'2:00:00']);f.yearStats.push([y,1,1]);}
 f.results.push([1991,'alias','Morothon','20 km','DNS','DNS'],[1996,'runner','Kortmoro','10 km','Fullført','1:00:00']);
 const p=await load(f);try{const rows=await p.evaluate(()=>PARTICIPATION_BADGES.map(b=>{const d=MorothonDiplomas.model('alias',`badge:${b.n}`);return {n:b.n,count:d.count,career:d.careerCount,start:d.firstYear,end:d.lastYear,year:d.year,editions:d.editionCount,all:d.allEditions};}));for(const r of rows){assert.equal(r.count,r.n);assert.equal(r.career,50);assert.equal(r.start,1992);assert.equal(r.end,1991+r.n);assert.equal(r.year,1991+r.n);assert.equal(r.editions,r.n);assert.equal(r.all,true);}}
 finally{await p.close();}
});
test('debut title occurs once; all diploma types avoid duplicate title/subtitle and dates/signature fit A4',async()=>{
 const p=await load();try{
  const requests=await p.evaluate(()=>[...[5,10,15,20,25,30,35].map(n=>({pid:S.people.find(p=>p.c>=n).i,key:`badge:${n}`})),{pid:'MOR-96EB117',key:'record:0'},{pid:S.people.find(p=>p.f===2026&&p.c===1).i,key:'debut'}]);
  for(const s of requests){
   await p.evaluate(s=>MorothonDiplomas.open(s.pid),s);await p.selectOption('#diplomaChoice',s.key);await p.waitForFunction(k=>MorothonDiplomas.current()?.key===k,s.key);
   const r=await p.evaluate(()=>{const d=document.querySelector('#diplomaDialog iframe').contentDocument,normalize=s=>s.toUpperCase().replace(/[^\p{L}\p{N}]/gu,''),title=d.querySelector('h1').textContent,sub=d.querySelector('.diploma-recipient h3')?.textContent||'',date=d.querySelector('.diploma-date p'),style=d.defaultView.getComputedStyle(date);return {title,sub,different:normalize(title)!==normalize(sub),layout:MorothonDiplomas.current().layout.ready,dateFits:date.scrollWidth<=date.clientWidth+1,oneLine:date.getBoundingClientRect().height<=parseFloat(style.lineHeight)+5,signature:d.querySelector('.diploma-signature').textContent};});
   assert.equal(r.layout,true,s.key);assert.equal(r.different,true,s.key);assert.equal(r.dateFits,true,s.key);assert.equal(r.oneLine,true,s.key);assert.match(r.signature,/Håkon Lohne.*Løpsleder Søgne Morothon/);
   if(s.key==='debut'){assert.equal(r.title,'MIN FØRSTE MOROTHON');assert.equal(r.sub,'Debutdiplom');}
   await p.locator('[data-diploma-close]').click();
  }
 }finally{await p.close();}
});
test('honorary cards export portrait, keep every medal and personal achievements, omit redundant stats/goals',async()=>{
 const p=await load();try{for(const name of ['Morten Borø','Gunnar Kåsa']){
  const r=await p.evaluate(async name=>{const person=S.people.find(p=>p.n===name),m=MorothonCard.model(person.i),doc=document.createElement('div');doc.innerHTML=MorothonCard.profileHtml(person.i);const card=doc.querySelector('.brag-card'),full=doc.querySelector('.runner-full-details'),texts=[],original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(v,...args){texts.push(String(v));return original.call(this,v,...args);};
   let result;try{result=await MorothonCard.build(person.i);}finally{CanvasRenderingContext2D.prototype.fillText=original;}
   const bitmap=await createImageBitmap(result.blob),size=[bitmap.width,bitmap.height];bitmap.close();URL.revokeObjectURL(result.url);
   return {size,note:card.querySelector('.brag-honor-text').textContent,count:card.querySelector('.brag-count strong').textContent,previous:card.querySelectorAll('.brag-medal-row img').length,expected:m.previous.length,stats:card.querySelectorAll('.brag-stats').length,goals:card.querySelectorAll('.brag-next').length,full:full.textContent,texts};
  },name);
  assert.deepEqual(r.size,[1080,1350]);assert.equal(r.count,'35');assert.match(r.note,/samtlige utgaver siden 1992 · 100 % lojalitet/);assert.equal(r.previous,r.expected);assert.equal(r.stats,0);assert.equal(r.goals,0);assert.match(r.full,/lengste historiske rekke/);assert.match(r.full,/Samlet registrert distanse/);assert.ok(!r.texts.some(t=>/NESTE DELMÅL|LENGSTE HISTORISKE REKKE|LOJALITET SIDEN DEBUT/.test(t)));
 }}finally{await p.close();}
});
test('full profile details remain keyboard-accessible, readable and within mobile/desktop panels',async()=>{
 const p=await load();try{for(const width of [320,390,1440]){
  await p.setViewportSize({width,height:900});
  for(const name of ['Gunnar Kåsa','Inger Katherin Dahl Frantzen']){
   await p.evaluate(name=>openProfile(S.people.find(p=>p.n===name).i),name);
   await p.locator('.runner-full-details summary').focus();await p.keyboard.press('Enter');
   assert.equal(await p.locator('.runner-full-details').getAttribute('open'),'');
   const r=await p.locator('.runner-full-details').evaluate(e=>{
    const color=el=>getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const bg=lum(getComputedStyle(e).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number));
    const ratios=[...e.querySelectorAll('.brag-support strong,.brag-support span,.brag-next>strong,.brag-next>span')].map(el=>{const fg=lum(color(el));return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)});
    const panel=document.querySelector('#panel');return {ratios,fit:e.scrollWidth<=e.clientWidth+1&&panel.scrollWidth<=panel.clientWidth+1,text:e.textContent};
   });
   assert.equal(r.fit,true,`${width}px ${name}`);assert.ok(r.ratios.every(v=>v>=4.5),`readable supporting values: ${r.ratios}`);assert.match(r.text,/Samlet registrert distanse/);assert.match(r.text,/Beste/);
  }
 }}finally{await p.close();}
});
test('all 5–50, record, debut and service diplomas share handwritten attribution and retain room for a real signature',async()=>{
 const fixture={schemaVersion:1,people:[{i:'signature-check',n:'Kontrollperson',g:'Herre',c:50}],results:[],yearStats:[]};
 for(let i=0;i<50;i++){const year=1992+i;fixture.results.push([year,'signature-check','Morothon','20 km','Fullført','2:00:00']);fixture.yearStats.push([year,1,1]);}
 const synthetic=await load(fixture),actual=await load();
 try{
  const documents=await synthetic.evaluate(async()=>Promise.all(PARTICIPATION_BADGES.map(async b=>({key:`badge:${b.n}`,html:MorothonDiplomas.documentHtml(await MorothonDiplomas.prepare('signature-check',`badge:${b.n}`))}))));
  documents.push(...await actual.evaluate(async()=>{
   const debut=S.people.find(p=>p.c===1&&p.f===2026),record=await MorothonDiplomas.prepare('MOR-96EB117','record:0');
   const items=[{key:'record',html:MorothonDiplomas.documentHtml(record)},{key:'debut',html:MorothonDiplomas.documentHtml(await MorothonDiplomas.prepare(debut.i,'debut'))}];
   const service=await MorothonDiplomas.serviceDraft('oscar-lohne');
   // Presentation fixtures only: exercise all registered service styles without assigning honors.
   for(const badge of MorothonBadges.list('service'))items.push({key:badge.id,html:MorothonDiplomas.documentHtml({...service,name:'Kontrollperson',roleLabel:badge.name,assetKey:badge.id,asset:await MorothonDiplomas.inspectAsset(badge.id)})});
   return items;
  }));
  for(const {key,html}of documents){
   const result=await actual.evaluate(async html=>{
    const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px;border:0';
    await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=html;document.body.appendChild(frame);});
    try{
     const doc=frame.contentDocument;await doc.fonts.ready;const name=doc.querySelector('.diploma-signature b'),role=doc.querySelector('.diploma-signature span'),line=doc.querySelector('.diploma-signature-line');
     return {name:name.textContent,role:role.textContent,nameFont:doc.defaultView.getComputedStyle(name).fontFamily,roleFont:doc.defaultView.getComputedStyle(role).fontFamily,blankHeight:line.getBoundingClientRect().height,blankText:line.textContent,layout:await MorothonDiplomas.checkLayout(doc)};
    }finally{frame.remove();}
   },html);
   assert.equal(result.name,'Håkon Lohne',key);assert.equal(result.role,'Løpsleder Søgne Morothon',key);
   assert.match(result.nameFont,/Z003.*cursive/,key);assert.equal(result.roleFont,result.nameFont,key);
   assert.ok(result.blankHeight>=5*96/25.4-.1,key);assert.equal(result.blankText,'',key);assert.equal(result.layout.ready,true,`${key}: ${result.layout.failures}`);
  }
  assert.equal(documents.length,15);
 }finally{await synthetic.close();await actual.close();}
});
