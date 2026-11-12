const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs'),{prepare}=require('../scripts/prepare-honor-print-set.cjs'),{buildSite}=require('../scripts/build-site.cjs');
const root=path.resolve(__dirname,'..');let h,core,history;
before(async()=>{h=await createHarness();core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));history=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8'));});after(async()=>{await h?.close();});
async function open(data=core,results=history,width=1440){const p=await h.browser.newPage({viewport:{width,height:1000}});await p.route('**/data/honors.json',r=>r.fulfill({json:data}));await p.route('**/data/history.json',r=>r.fulfill({json:results}));await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();return p;}
test('V3.6.2 Jon freezes at 10 editions in 2014–2023, retains his real date and badge choices, and requires new clean-print approval',async()=>{
 for(const width of [390,1440]){const p=await open(core,history,width);try{
  await p.goto(h.base+'/heder.html#person/jon-fjeld');await p.locator('#profileName').waitFor();assert.match(await p.locator('#honorProfile .honor-main-caption').innerText(),/13 dugnadsutgaver/);await p.locator('.diploma-example>summary').click();
  for(const display of ['all','latest']){
   await p.selectOption('[data-medal-display]',display);await p.waitForFunction(display=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet')?.dataset.medalDisplay===display&&!document.querySelector('[data-honor-print]').disabled,display);
   const d=await p.evaluate(display=>MorothonDiplomas.serviceDraft('jon-fjeld',display),display);assert.deepEqual([d.contributionCount,d.contributionFirst,d.contributionLast,d.achievementYear,d.eventDate],[10,2014,2023,2023,'2023-11-11']);assert.equal(d.dateLabel,'Søgne, 11. november 2023');assert.equal(d.tribute,core.diplomaTexts.dugnad[10]);assert.equal(d.printMode,'draft');assert.equal(d.assetKey,'service-dugnad-10');assert.equal(d.collectionAssets.length,display==='all'?1:0);assert.ok(core.presentationPrintSet.entries.some(e=>e.personId===d.honoreeId&&e.medalDisplay===display&&e.contentSha256!==d.contentProof.contentSha256));
   const r=await p.locator('iframe').evaluate(f=>{const d=f.contentDocument;return {number:d.querySelector('.diploma-metric strong').textContent,period:d.querySelector('.diploma-metric small').textContent,stamp:d.querySelector('.diploma-draft')?.textContent};});assert.deepEqual(r,{number:'10',period:'2014–2023',stamp:'FORHÅNDSVISNING'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const forged=await p.evaluate(async display=>{const d=await MorothonDiplomas.serviceDraft('jon-fjeld',display);d.printMode='presentation';d.presentationApproval={verified:true};return MorothonDiplomas.checkServiceDraft(d,document.querySelector('iframe').contentDocument);},display);assert.equal(forged.ready,false);
  }
 }finally{await p.close();}}
});
test('V3.6.2 all six ordinary levels freeze count and period, including documented gaps, while aggregate totals never invent achievement years',async()=>{
 const future=structuredClone(history);for(let y=2027;y<=2033;y++)future.results.push([y,'MOR-AA6C983','Morothon','20 km','Fullført','2:00:00']);
 for(const level of [5,10,15,20,30,40]){
  const data=structuredClone(core),m=data.groups.flatMap(g=>g.members).find(m=>m.id==='dag-morten-frantzen'),first=level<=10?2014:1992,year=first+level-1;
  m.contribution={confirmedYears:Array.from({length:level+2},(_,i)=>first+i),sourceIds:['organizer-v352']};data.presentationPrintSet.entries=[];
  const p=await open(data,future);try{for(const display of ['all','latest']){const d=await p.evaluate(display=>MorothonDiplomas.serviceDraft('dag-morten-frantzen',display),display);assert.equal(d.assetKey,'service-dugnad-'+level);assert.deepEqual([d.contributionCount,d.contributionFirst,d.contributionLast,d.achievementYear],[level,first,year,year]);assert.equal(d.tribute,core.diplomaTexts.dugnad[level]);assert.equal(d.collectionAssets.length,display==='all'?[5,10,15,20,30,40].filter(n=>n<level).length:0);if(level===5)assert.equal(d.dateLabel,'Søgne, 11. november 2018');if(level===10)assert.equal(d.dateLabel,'Søgne, 11. november 2023');}}
  finally{await p.close();}
 }
 for(const aggregate of [false,true]){
  const data=structuredClone(core),m=data.groups.flatMap(g=>g.members).find(m=>m.id==='dag-morten-frantzen');m.contribution=aggregate?{fromYear:1992,approvedTotal:{editions:33,approved:true,asOfYear:2026,sourceIds:['organizer-v352']},sourceIds:['organizer-v352']}:{fromYear:2014,excludedYears:[2015,2018],sourceIds:['organizer-v352']};data.presentationPrintSet.entries=[];
  const p=await open(data);try{for(const display of ['all','latest']){const d=await p.evaluate(display=>MorothonDiplomas.serviceDraft('dag-morten-frantzen',display),display);if(aggregate){assert.deepEqual([d.contributionCount,d.contributionFirst,d.contributionLast,d.achievementYear,d.eventDate],[33,null,null,null,null]);assert.equal(d.dateLabel,'');assert.equal(d.assetKey,'service-dugnad-30');assert.equal(d.printMode,'draft');}else assert.deepEqual([d.contributionCount,d.contributionFirst,d.contributionLast,d.dateLabel],[10,2014,2025,'Søgne, 8. november 2025']);}}
  finally{await p.close();}
 }
});
test('V3.6.2 preserves all data, artwork, CSS and special diploma fingerprints from main, including Einars exact personal tribute and presentation date',async()=>{
 const base='09173da';for(const folder of ['data','assets','css','heder.html','index.html','js/honors.js','js/honors-data.js']){const files=execFileSync('git',['ls-tree','-r','--name-only',base,folder],{cwd:root}).toString().trim().split('\n');for(const f of files)assert.deepEqual(await fs.readFile(path.join(root,f)),execFileSync('git',['show',base+':'+f],{cwd:root}),f);}
 const legacy=await h.browser.newPage();await legacy.route('**/js/diplomas.js',r=>r.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',base+':js/diplomas.js'],{cwd:root}).toString()}));await legacy.goto(h.base+'/heder.html');await legacy.locator('[data-honoree]').first().waitFor();
 const p=await open();try{for(const id of ['einar-danielsen','oscar-lohne','erling-askildsen','arnfinn-haverstad','helge-reisvoll','floke-bredland','leif-wiig','christan-berthelsen','atle-aamodt','birgitte-aamodt'])for(const display of ['all','latest']){
  const d=await p.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id,display}),prior=await legacy.evaluate(({id,display})=>MorothonDiplomas.serviceDraft(id,display),{id,display}),registered=prior.contentProof;
  assert.ok(registered,id);for(const k of ['contentSha256','cssSha256','assetSha256','watermarkSha256'])assert.equal(d.contentProof[k],registered[k],id+'/'+display+'/'+k);
  if(id==='einar-danielsen'){assert.equal(d.contributionCount,33);assert.equal(d.dateLabel,'Søgne, 7. november 2026');assert.equal(d.tribute,core.personDetails[id].honorDiplomaText);assert.equal(d.assetKey,'service-aeresmerke');}
 }}finally{await p.close();await legacy.close();}
});
test('V3.6.2 audit accepts only the historical count/period migration, remains read-only and rejects unrelated edits',async()=>{
 const original=await fs.readFile(path.join(root,'data/honors.json')),r=await prepare();assert.equal(r.diplomas,60);assert.equal(r.pendingDiplomas,28);assert.equal(r.milestoneReviews.length,20);assert.deepEqual(await fs.readFile(path.join(root,'data/honors.json')),original);
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-v362-audit-'));try{
  await buildSite(temp);for(const file of ['scripts/prepare-honor-print-set.cjs','scripts/diploma-harness.cjs','tests/helpers/honors.cjs']){await fs.mkdir(path.dirname(path.join(temp,file)),{recursive:true});await fs.copyFile(path.join(root,file),path.join(temp,file));}await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  const data=JSON.parse(original);data.diplomaTexts.dugnad[10]='En uavhengig tekstendring som ikke har fått noen ny godkjenning.';await fs.writeFile(path.join(temp,'data/honors.json'),JSON.stringify(data));
  assert.throws(()=>execFileSync(process.execPath,[path.join(temp,'scripts/prepare-honor-print-set.cjs')],{cwd:temp,stdio:'pipe',timeout:120000}),e=>e.status===1&&/reviewed presentation set is stale/.test(e.stderr.toString()));
  assert.deepEqual(await fs.readFile(path.join(root,'data/honors.json')),original);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
