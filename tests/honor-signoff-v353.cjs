const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs'),{cases,historicalFixture}=require('../scripts/honor-signoff-cases.cjs');
const root=path.resolve(__dirname,'..');let h,core;
before(async()=>{h=await createHarness();core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));});after(async()=>{await h?.close();});
async function pageFor(fixture){const p=await h.browser.newPage();if(fixture)await p.route('**/data/honors.json',r=>r.fulfill({json:fixture}));await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();return p;}
test('V3.5.3 uses registered race dates, month/year before 2014, and no invented date for aggregate totals or examples',async()=>{
 for(const c of cases){const p=await pageFor(c.historical?historicalFixture(core):null);try{for(const display of ['all','latest']){
  const d=await p.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id:c.id,display});assert.equal(d.dateLabel,c.date);assert.equal(d.eventDate,c.key==='2023'?'2023-11-11':null);assert.equal(d.dateBasis,c.key==='2023'?'documented-race-date':c.historical?'historical-month-year':'not-established');assert.equal(d.achievementYear,c.key==='2023'?2023:c.historical?2010:null);
  if(c.key==='einar'){assert.equal(d.contributionCount,33);assert.equal(d.assetKey,'service-aeresmerke');assert.ok(d.founderAsset);}
 }}finally{await p.close();}}
 // Boundary, Sunday 2018 and a future/incomplete date registry. Only the in-memory
 // fixture changes; no person, confirmed year or event-date file is written.
 for(const [first,last,date,basis]of [[2009,2013,'Søgne, november 2013','historical-month-year'],[2010,2014,'Søgne, 8. november 2014','documented-race-date'],[2014,2018,'Søgne, 11. november 2018','documented-race-date']]){
  const fixture=historicalFixture(core),m=fixture.groups.flatMap(g=>g.members).find(m=>m.id==='dag-morten-frantzen');m.contribution.confirmedYears=Array.from({length:last-first+1},(_,i)=>first+i);
  const p=await pageFor(fixture);try{const d=await p.evaluate(()=>MorothonDiplomas.serviceDraft('dag-morten-frantzen'));assert.equal(d.dateLabel,date);assert.equal(d.dateBasis,basis);}finally{await p.close();}
 }
 const p=await h.browser.newPage();try{
  const register=JSON.parse(await fs.readFile(path.join(root,'data/event-dates.json'),'utf8'));delete register.dates['2023'];await p.route('**/data/event-dates.json',r=>r.fulfill({json:register}));await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();const d=await p.evaluate(()=>MorothonDiplomas.serviceDraft('dag-morten-frantzen'));assert.equal(d.dateLabel,'Søgne, 2023');assert.equal(d.eventDate,null);assert.equal(d.dateBasis,'documented-year');
  const example=await p.evaluate(()=>MorothonDiplomas.serviceExample('dugnad-30'));assert.equal(example.dateLabel,'');assert.equal(example.achievementYear,null);
 }finally{await p.close();}
 const formal=structuredClone(core),recipient=formal.groups.flatMap(g=>g.members).find(m=>m.id==='dag-morten-frantzen');
 recipient.awards=[{id:'qa-formal-award',badgeId:'service-dugnad-10',confirmed:true,date:'2026-11-10',sourceIds:['organizer-v35']}];
 recipient.issuedDiplomas=[{awardId:'qa-formal-award',date:'2026-11-12',sourceIds:['organizer-v35']}];
 const issued=await pageFor(formal);try{const d=await issued.evaluate(()=>MorothonDiplomas.serviceDraft('dag-morten-frantzen'));assert.equal(d.achievementYear,2023);assert.equal(d.dateLabel,'Søgne, 11. november 2023');assert.equal(d.eventDate,'2023-11-11');}finally{await issued.close();}
});
test('V3.5.3 all six requested compositions have matched embedded handwriting, a single unclipped date line and one real landscape A4 PDF',async()=>{
 for(const c of cases){const p=await pageFor(c.historical?historicalFixture(core):null);try{for(const display of ['all','latest']){
  const d=await p.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id:c.id,display});
  const q=await h.browser.newPage();try{
   // The font must render from the HTML itself even if the font endpoint and all
   // third-party font services are unavailable in this independent PDF page.
   await q.route('**/assets/fonts/**',r=>r.abort());await q.setContent(await p.evaluate(d=>MorothonDiplomas.documentHtml(d),d));await q.evaluate(()=>document.fonts.ready);
   await q.addScriptTag({url:h.base+'/js/diplomas.js'});const layout=await q.evaluate(()=>MorothonDiplomas.checkLayout(document));assert.equal(layout.ready,true,layout.failures.join(' '));
   const metrics=await q.evaluate(()=>{const a=document.querySelector('.diploma-date p'),b=document.querySelector('.diploma-signature b'),sa=getComputedStyle(a),sb=getComputedStyle(b),r=document.createRange();r.selectNodeContents(a);const rects=[...r.getClientRects()].filter(r=>r.width>0),field=a.parentElement.getBoundingClientRect(),lines=[...document.querySelectorAll('.diploma-signature-line')].map(e=>e.getBoundingClientRect());return {date:a.textContent,aFont:sa.fontFamily,bFont:sb.fontFamily,aColor:sa.color,bColor:sb.color,aSize:sa.fontSize,bSize:sb.fontSize,aTop:a.getBoundingClientRect().top,bTop:b.getBoundingClientRect().top,lines:rects.length,dateInside:rects.every(r=>r.left>=field.left-1&&r.right<=field.right+1),rules:lines.map(r=>({top:r.top,height:r.height})),dateRules:a.parentElement.querySelectorAll('.diploma-signature-line').length,label:!!a.parentElement.querySelector('.diploma-date-label'),role:document.querySelector('.diploma-signature-role').textContent,faces:[...document.fonts].map(f=>({name:f.family,status:f.status}))};});
   assert.equal(metrics.date,c.date);assert.match(metrics.aFont,/Morothon Caveat/);assert.equal(metrics.aFont,metrics.bFont);assert.equal(metrics.aColor,metrics.bColor);assert.equal(metrics.aSize,metrics.bSize);assert.ok(Math.abs(metrics.aTop-metrics.bTop)<.1);assert.equal(metrics.lines,c.date?1:0);assert.equal(metrics.dateInside,true);assert.equal(metrics.dateRules,c.date?1:0);assert.equal(metrics.label,!!c.date);assert.equal(metrics.role,'Løpsleder · Morothon');assert.ok(metrics.faces.some(f=>/Morothon Caveat/.test(f.name)&&f.status==='loaded'));if(c.date)assert.deepEqual(metrics.rules[0],metrics.rules[1]);
   const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),fonts=execFileSync('pdffonts',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString().replace(/\s+/g,' ');
   assert.match(info,/Pages:\s+1\b/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<.5&&Math.abs(+size[2]-595.28)<.5);assert.match(fonts,/Caveat[^\n]+yes\s+yes\s+yes/);assert.ok(text.includes(c.name));assert.ok(text.includes(c.date));assert.match(text,/Håkon Lohne/);if(c.key==='einar'){assert.doesNotMatch(text,/MERKET OPPNÅDD|MILEPÆL OPPNÅDD/);assert.match(text.replace(/\s/g,''),/UTDELINGSDATO/);}
  }finally{await q.close();}
 }}finally{await p.close();}}
});
test('V3.5.3 font, content and real overflow checks remain mandatory for printing',async()=>{
 const p=await pageFor();try{
  const checks=await p.evaluate(async()=>{const d=await MorothonDiplomas.serviceDraft('dag-morten-frantzen'),f=document.createElement('iframe');f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.append(f);await new Promise(r=>f.onload=r);try{const doc=f.contentDocument,valid=await MorothonDiplomas.checkServiceDraft(d,doc),style=doc.querySelector('[data-service-handwriting]');style.textContent=style.textContent.replace('font-display:block','font-display:swap');const altered=await MorothonDiplomas.checkServiceDraft(d,doc);style.remove();doc.fonts.clear();const noFont=await MorothonDiplomas.checkServiceDraft(d,doc);doc.querySelector('.diploma-date p').style.fontSize='60mm';const overflow=await MorothonDiplomas.checkLayout(doc);return {valid,altered,noFont,overflow};}finally{f.remove();}});
  assert.equal(checks.valid.ready,true);assert.equal(checks.altered.ready,false);assert.match(checks.altered.failures.join(' '),/utskriftssett/);assert.equal(checks.noFont.ready,false);assert.match(checks.noFont.failures.join(' '),/håndskriftfont/);assert.equal(checks.overflow.ready,false);
 }finally{await p.close();}
 for(const corrupt of [false,true]){const p=await h.browser.newPage();try{
  await p.route('**/assets/fonts/caveat-regular-latin.woff',async r=>{if(!corrupt)return r.fulfill({status:404,body:''});const bytes=await fs.readFile(path.join(root,'assets/fonts/caveat-regular-latin.woff'));bytes[bytes.length-1]^=1;return r.fulfill({body:bytes,contentType:'font/woff'});});await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();const message=await p.evaluate(async()=>{try{await MorothonDiplomas.serviceDraft('dag-morten-frantzen');return '';}catch(e){return e.message;}});assert.match(message,corrupt?/kontrollerte filen/:/kunne ikke lastes/);
 }finally{await p.close();}}
});
test('V3.5.3 preserves all people, sources, awards, race data and ordinary diplomas; only reviewed presentation fingerprints change',async()=>{
 const prior=JSON.parse(execFileSync('git',['show','3e45c8b:data/honors.json'],{cwd:root})),current=structuredClone(core);delete prior.presentationPrintSet;delete current.presentationPrintSet;for(const e of current.diplomaExamples)if(e.illustrative&&e.badgeId.startsWith('service-dugnad-'))e.tribute=current.diplomaTexts.dugnad[e.contributionCount];delete current.personDetails;delete current.diplomaTexts;delete current.sources['organizer-v36-runner-links'];delete current.sources['organizer-v36-einar-date'];assert.deepEqual(current,prior);
 for(const f of ['data/history.json','data/event-dates.json','data/badges.json','data/volunteers.json','index.html','heder.html'])assert.deepEqual(await fs.readFile(path.join(root,f)),execFileSync('git',['show','3e45c8b:'+f],{cwd:root}),f);
 await require('./helpers/honors.cjs').assertOrdinaryDiplomaCss(root);
 const font=await fs.readFile(path.join(root,'assets/fonts/caveat-regular-latin.woff'));assert.equal(require('node:crypto').createHash('sha256').update(font).digest('hex'),'870c4d48b7667f3345bbb30a532c85da8368dcc2b7e2f84f215cd136cf87c0d9');assert.match(await fs.readFile(path.join(root,'assets/fonts/OFL-Caveat.txt'),'utf8'),/SIL OPEN FONT LICENSE Version 1.1/);
});
