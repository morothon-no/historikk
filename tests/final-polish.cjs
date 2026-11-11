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
   assert.equal(r.layout,true,s.key);assert.equal(r.different,true,s.key);assert.equal(r.dateFits,true,s.key);assert.equal(r.oneLine,true,s.key);assert.match(r.signature,/Håkon Lohne.*Løpsleder Morothon/);
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
  assert.deepEqual(r.size,[1080,1350]);assert.equal(r.count,'35');assert.match(r.note,/samtlige utgaver siden 1992 · 100 % lojalitet/);assert.equal(r.previous,r.expected);assert.equal(r.stats,0);assert.equal(r.goals,0);assert.match(r.full,/Deltakelser år for år/);assert.doesNotMatch(r.full,/Samlet registrert distanse|lengste historiske rekke/);assert.ok(!r.texts.some(t=>/NESTE DELMÅL|LENGSTE HISTORISKE REKKE|LOJALITET SIDEN DEBUT/.test(t)));
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
    const ratios=[...e.querySelectorAll('.brag-next>strong,.brag-next>span,.brag-year-list li')].map(el=>{const fg=lum(color(el)),own=getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number),surface=own.length<4||own[3]>0?lum(own.slice(0,3)):bg;return (Math.max(surface,fg)+.05)/(Math.min(surface,fg)+.05)});
    const panel=document.querySelector('#panel');return {ratios,fit:e.scrollWidth<=e.clientWidth+1&&panel.scrollWidth<=panel.clientWidth+1,text:e.textContent};
   });
   assert.equal(r.fit,true,`${width}px ${name}`);assert.ok(r.ratios.every(v=>v>=4.5),`readable supporting values: ${r.ratios}`);assert.match(r.text,/Deltakelser år for år/);assert.doesNotMatch(r.text,/Samlet registrert distanse|Beste|aktiv rekke|lengste historiske rekke/);
  }
 }}finally{await p.close();}
});
test('all 5–50, record, debut and service diplomas align matching handwriting above equal rules with a typeset role',async()=>{
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
     const doc=frame.contentDocument;await doc.fonts.ready;const date=doc.querySelector('.diploma-date p'),name=doc.querySelector('.diploma-signature b'),role=doc.querySelector('.diploma-signature-role'),lines=[...doc.querySelectorAll('.diploma-signature-line')],isService=!!doc.querySelector('.diploma-service');
     const style=e=>doc.defaultView.getComputedStyle(e),box=e=>e.getBoundingClientRect();
     const baseline=e=>{const probe=doc.createElement('i');probe.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';e.appendChild(probe);const y=box(probe).top;probe.remove();return y;};
     return {name:name.textContent,role:role.textContent,nameFont:style(name).font,dateFont:style(date).font,nameColor:style(name).color,dateColor:style(date).color,roleFont:style(role).fontFamily,roleSize:parseFloat(style(role).fontSize),nameSize:parseFloat(style(name).fontSize),baselineDelta:Math.abs(baseline(date)-baseline(name)),topDelta:Math.abs(box(date).top-box(name).top),aboveLines:isService?box(name).bottom<=box(lines[0]).top:box(date).bottom<=box(lines[0]).top&&box(name).bottom<=box(lines[1]).top,roleBelow:box(role).top>=box(lines.at(-1)).bottom,lineCount:lines.length,lineDelta:lines.length>1?Math.abs(box(lines[0]).top-box(lines[1]).top):0,lineHeights:lines.map(e=>box(e).height),lineWidths:lines.map(e=>box(e).width),lineBorders:lines.map(e=>style(e).borderBottom),lineTexts:lines.map(e=>e.textContent),layout:await MorothonDiplomas.checkLayout(doc)};
    }finally{frame.remove();}
   },html);
   assert.equal(result.name,'Håkon Lohne',key);assert.equal(result.role,'Løpsleder Morothon',key);
   if(key.startsWith('service-')){
    assert.equal(result.lineCount,1,key);assert.equal(result.aboveLines,true,key);assert.equal(result.roleBelow,true,key);
    assert.match(result.dateFont,/Arial/,key);assert.equal(result.layout.ready,true,`${key}: ${result.layout.failures}`);
    continue;
   }
   assert.match(result.nameFont,/Z003.*cursive/,key);assert.equal(result.nameFont,result.dateFont,key);assert.equal(result.nameColor,result.dateColor,key);assert.match(result.roleFont,/Arial/,key);assert.ok(result.roleSize<result.nameSize,key);
   assert.ok(result.baselineDelta<.1,key);assert.ok(result.topDelta<.1,key);assert.ok(result.lineDelta<.1,key);assert.equal(result.aboveLines,true,key);assert.equal(result.roleBelow,true,key);assert.equal(result.lineCount,2,key);
   assert.ok(Math.abs(result.lineHeights[0]-result.lineHeights[1])<.1,key);assert.ok(Math.abs(result.lineWidths[0]-result.lineWidths[1])<.1,key);assert.equal(result.lineBorders[0],result.lineBorders[1],key);assert.deepEqual(result.lineTexts,['',''],key);assert.equal(result.layout.ready,true,`${key}: ${result.layout.failures}`);
  }
  assert.equal(documents.length,22);
 }finally{await synthetic.close();await actual.close();}
});

test('short/year-only and long dates with short/long names keep matching footer baselines and export one A4 PDF',async()=>{
 const {execFileSync}=require('node:child_process'),p=await load();
 try{for(const name of ['Ada Li','Inger Katherin Dahl Frantzen Med Et Langt Historisk Navn Som Skal Vises Uten Beskjæring'])for(const date of ['Søgne, 1996','Søgne, 9. november 2024','Søgne, 30. september 2024']){
  // Typography-only fixtures. No event date or runner identity is changed in history.json.
  const rendered=await p.evaluate(async({name,date})=>{const model=await MorothonDiplomas.prepare('MOR-C788866','badge:10'),html=MorothonDiplomas.documentHtml({...model,name,dateLabel:date}),frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px;border:0';
   await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=html;document.body.appendChild(frame);});try{const doc=frame.contentDocument,layout=await MorothonDiplomas.checkLayout(doc),a=doc.querySelector('.diploma-date p'),b=doc.querySelector('.diploma-signature b');return {html,layout,date:a.textContent,dateWidth:a.getBoundingClientRect().width,dateScroll:a.scrollWidth,dateClient:a.clientWidth,fontSize:doc.defaultView.getComputedStyle(a).fontSize,nameFontSize:doc.defaultView.getComputedStyle(b).fontSize,topDelta:Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)};}finally{frame.remove();}
  },{name,date});assert.equal(rendered.layout.ready,true,name+' '+date+': '+rendered.layout.failures.join('; '));assert.equal(rendered.date,date);assert.equal(rendered.fontSize,rendered.nameFontSize);assert.ok(rendered.topDelta<.1);assert.ok(rendered.dateScroll<=rendered.dateClient+1);
  const pdfPage=await h.browser.newPage();try{await pdfPage.setContent(rendered.html);await pdfPage.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});const pdf=await pdfPage.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<1&&Math.abs(+size[2]-595.28)<1);const text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');assert.ok(text.includes(name));assert.ok(text.includes(date));assert.match(text,/Håkon Lohne/);assert.match(text,/Løpsleder Morothon/);}finally{await pdfPage.close();}
 }}finally{await p.close();}
});
