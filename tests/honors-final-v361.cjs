const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {readHonors,beforeFinalCorrections}=require('./helpers/honors.cjs'),H=require('../js/honors-data.js'),{createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),changed=['einar-danielsen','erling-danielsen','anne-lene-forland-hansen','laila-endresen-skjulestad'];
test('Final V3.6.1 corrections preserve all 44 identities, all 26 links and the exact prior records in the internal audit archive',async()=>{
 const d=await readHonors(),prior=JSON.parse(execFileSync('git',['show','bcb6f52:data/honors.json'],{cwd:root})),raw=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8')),revision=raw.revisionHistory[0];
 assert.equal(d.groups.flatMap(g=>g.members).length,44);assert.equal(new Set(d.groups.flatMap(g=>g.members).map(m=>m.id)).size,44);assert.equal(d.groups.find(g=>g.id==='founders').members.length,5);
 assert.deepEqual(revision.narrativeUncertainties,prior.narrative.uncertainties);
 for(const record of revision.members)assert.deepEqual(record.member,H.findIn(prior,record.member.id).member);
 for(const [id,details]of Object.entries(revision.personDetails))assert.deepEqual(details,prior.personDetails[id]);
 for(const id of Object.keys(prior.personDetails))assert.deepEqual(raw.personDetails[id]?.runnerLink,prior.personDetails[id].runnerLink);
 assert.deepEqual(beforeFinalCorrections(raw).groups,prior.groups);assert.deepEqual(raw.diplomaApprovals,prior.diplomaApprovals);
 const e=H.findIn(d,changed[0]),r=H.findIn(d,changed[1]);assert.equal(e.group.id,'founders');assert.equal(e.member.deceased,true);assert.equal(e.member.deathYear,undefined);assert.ok(d.founderSpotlightIds.includes(e.member.id));
 assert.equal(r.group.id,'volunteers');assert.equal(r.member.deceased,false);assert.equal(r.member.memorialRecognition,undefined);assert.equal(r.member.contribution.fromYear,1992);assert.equal(r.member.contribution.toYear,undefined);
 for(const m of [e.member,r.member]){assert.equal(H.serviceTenure(d,m).count,33);assert.equal(H.serviceTenure(d,m).basis,'approved-total');assert.deepEqual(H.serviceTenure(d,m).years,[]);assert.deepEqual(m.awards,[]);assert.deepEqual(m.issuedDiplomas,[]);}
 assert.deepEqual(H.honorProfile(d,e.member).secondaryHonorIds,['service-grunnlegger','service-memorial']);assert.equal(H.mainBadge(d,e.member).badgeId,'service-aeresmerke');assert.equal(H.mainBadge(d,r.member).badgeId,'service-dugnad-30');assert.deepEqual(H.honorProfile(d,r.member).secondaryHonorIds,[]);
 for(const id of changed.slice(2)){const m=H.findIn(d,id).member;assert.equal(m.contribution.fromYear,2016);assert.equal(m.contribution.confirmedYears,undefined);assert.equal(H.serviceTenure(d,m).count,11);assert.equal(H.serviceTenure(d,m).basis,'registered-period');assert.equal(H.mainBadge(d,m).badgeId,'service-dugnad-10');}
 const known=H.findIn(d,'erling-askildsen').member;assert.equal(H.isFounder(d,known),true);assert.equal(H.serviceTenure(d,known).count,35);
 const prints=raw.presentationPrintSet;assert.equal(prints.entries.length,80);assert.deepEqual(prints.entries,prior.presentationPrintSet.entries.filter(e=>!changed.includes(e.personId)));assert.deepEqual(prints.pendingReviews.map(r=>r.personId),changed);
 for(const pending of prints.pendingReviews){assert.equal(pending.status,'pending');assert.deepEqual(pending.previousEntries,prior.presentationPrintSet.entries.filter(e=>e.personId===pending.personId));}
});
test('Final V3.6.1 hides all source UI and notes on overview, every current profile and retired routes at four screen widths while validating sources',async()=>{
 const h=await createHarness(),data=await readHonors(),errors=[];try{for(const width of [390,768,1280,1440]){
  const p=await h.browser.newPage({viewport:{width,height:1000}});p.on('pageerror',e=>errors.push(e.message));try{
   for(const id of [null,...require('./helpers/honors.cjs').visibleMembers(data).map(m=>m.id),...(data.retiredProfiles||[]).map(r=>r.id)]){
    await p.goto(h.base+'/heder.html'+(id?'#person/'+id:''));if(id)await p.locator('#profileName').waitFor();else{await p.locator('[data-honoree]').first().waitFor();const heights=await p.locator('#memorial [data-honoree]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.equal(heights.length,2);assert.equal(heights[0],heights[1]);}
    assert.equal(await p.locator('#honorSources,#honorSourceContent,.honor-person-sources,.honor-source').count(),0);
    const content=await p.locator(id?'#honorProfile':'#honorOverview').textContent();assert.doesNotMatch(content,/Bakgrunn og kilder|organizer-v\d|sourceIds|internalNotes|data\/volunteers\.json|data\/honors\.json/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   await p.goto(h.base+'/heder.html#person/einar-danielsen');await p.locator('#profileName').waitFor();assert.equal(await p.locator('#honorProfile .honor-remembrance').textContent(),'Til minne');assert.match(await p.locator('#honorProfile').innerText(),/Einar er ikke lenger blant oss/);
   const raw=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));raw.personDetails['einar-danielsen'].stories[0].sourceIds=['unknown-source'];await p.route('**/data/honors.json',r=>r.fulfill({json:raw}));await p.reload();await p.waitForFunction(()=>document.querySelector('#honorStatus').textContent.includes('kilde'));assert.equal(await p.locator('[data-honoree]').count(),0);
  }finally{await p.close();}
 }assert.deepEqual(errors,[]);}finally{await h.close();}
});
test('Final V3.6.1 changed diploma combinations keep draft proofing, both variants preserve the highest medal, Einar date and one unclipped A4 page',async()=>{
 const h=await createHarness();try{const p=await h.browser.newPage();await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();for(const id of changed)for(const display of ['all','latest']){
  const d=await p.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id,display});assert.equal(d.printMode,'draft');assert.equal(d.finalApproval,undefined);assert.equal(d.presentationApproval,undefined);
  if(id==='einar-danielsen'){assert.equal(d.dateLabel,'Søgne, 7. november 2026');assert.equal(d.assetKey,'service-aeresmerke');assert.equal(d.achievementYear,null);assert.equal(d.secondaryAssets.filter(a=>a.key==='service-memorial').length,1);assert.ok(d.founderAsset);}
  if(id==='erling-danielsen'){assert.equal(d.assetKey,'service-dugnad-30');assert.equal(d.dateLabel,'');assert.equal(d.contributionCount,33);assert.ok(!d.secondaryAssets.some(a=>/memorial|grunnlegger|aeresmerke/.test(a.key)));}
  const q=await h.browser.newPage();try{await q.setContent(await p.evaluate(d=>MorothonDiplomas.documentHtml(d),d));await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await p.evaluate(()=>window.__qaFrame?.remove());const check=await p.evaluate(async d=>{const f=document.createElement('iframe');f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.append(f);await new Promise(r=>f.onload=r);try{return await MorothonDiplomas.checkServiceDraft(d,f.contentDocument);}finally{f.remove();}},d);assert.equal(check.ready,true,check.failures.join(' '));
   const pdf=await q.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}}),info=execFileSync('pdfinfo',['-'],{input:pdf}).toString(),text=execFileSync('pdftotext',['-','-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);assert.match(text,/FORHÅNDSVISNING/);assert.ok(text.replace(/\s+/g,' ').includes(d.name));if(id==='einar-danielsen'){const words=text.replace(/\s+/g,'');assert.ok(words.includes('FORINNSATSENDUGA'));assert.ok(!words.includes('FORATDUSTILLEROPP')); /* PDF extraction separates letter-spaced captions. */}
  }finally{await q.close();}
 }await p.close();}finally{await h.close();}
});

test('Final V3.6.1 every memorial context uses remembrance language instead of thanking a living helper for turning up',async()=>{
 const h=await createHarness();try{const p=await h.browser.newPage();await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();for(const id of ['einar-danielsen','floke-bredland','leif-wiig'])for(const display of ['all','latest']){const r=await p.evaluate(async({id,display})=>{const d=await MorothonDiplomas.serviceDraft(id,display),doc=new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html');return {remembrance:d.inRemembrance,main:d.assetKey,text:doc.body.textContent};},{id,display});assert.equal(r.remembrance,true);assert.doesNotMatch(r.text,/for at du stiller opp|takk for du stiller opp|du er med på å gjøre Morothon mulig/i);if(id==='einar-danielsen'){assert.equal(r.main,'service-aeresmerke');assert.match(r.text,/FOR INNSATSEN DU GA/);}else assert.match(r.text,/MINNEDIPLOM/);}
 const living=await p.evaluate(async()=>MorothonDiplomas.serviceDraft('erling-danielsen'));assert.equal(living.inRemembrance,false);assert.equal(living.assetKey,'service-dugnad-30');await p.close();}finally{await h.close();}
});
