const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),base='e8e64a70c30b4b37c86171d153f8cf45459b4fba';

test('PR16 histories, identities, ordinary diplomas and official originals survive the approved tenure extension',async()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',base,'data','assets','index.html','heder.html','js','css'],{cwd:root}).toString().trim().split('\n');
 const extended=new Set(['js/history-data.js','js/loyalty.js','js/honors-data.js','js/honors.js','css/honors.css','data/volunteers.json','data/honors.json','data/badges.json','heder.html','js/diplomas.js','css/diplomas.css']);
 await require('./helpers/honors.cjs').assertOrdinaryDiplomaCss(root);
 for(const file of files.filter(f=>!extended.has(f)))require('./helpers/honors.cjs').assertPreservedPresentation(await fs.readFile(path.join(root,file)),execFileSync('git',['show',base+':'+file],{cwd:root}),file);
 const expected=JSON.parse(execFileSync('git',['show',base+':data/volunteers.json'],{cwd:root}));
 expected.people.find(p=>p.id==='atle-aamodt').excludedYears=[2026];
 const n=expected.people.find(p=>p.id==='nils-martin-otterdal-nilsen');Object.assign(n,{role:'Styreleder i Søgne Skiklubb',roleType:'external',sourceIds:['organizer-v34','organizer-v35']});
 assert.deepEqual(JSON.parse(await require('./helpers/honors.cjs').preservedFile(root,'data/volunteers.json')),expected,'Only the authorized Atle and Nils Martin facts may extend volunteer data');
 // Temporary renders belong outside the production tree, not in the final PR.
 await assert.rejects(fs.access(path.join(root,'review/heder-pr16')),e=>e.code==='ENOENT');
 const generator=await fs.readFile(path.join(root,'scripts/review-honor-badges.cjs'),'utf8');
 assert.match(generator,/async function review\(out=path.join\(os.tmpdir\(\),'morothon-heder-pr16'\)/);
});

test('PR16 registered totals retain historical badge years, with no invented dates or awards',async()=>{
 const h=await createHarness();try{
  const p=await h.browser.newPage(),fixture=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
  // Extra proposal entries in this fixture cannot change the registered total,
  // the historical achievement years, or the empty formal award register.
  for(const member of fixture.groups.flatMap(g=>g.members).filter(m=>['oscar-lohne','erling-askildsen'].includes(m.id)))member.badgeProposal.badgeIds.push(...[5,10,15,20].map(n=>'service-dugnad-'+n));
  await p.route('**/data/honors.json',r=>r.fulfill({json:fixture}));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  for(const id of ['oscar-lohne','erling-askildsen'])for(const [count,year]of [[5,1996],[10,2001],[15,2006],[20,2011],[30,2021]]){
   const actual=await p.evaluate(async({id,count})=>{
    const d=await MorothonDiplomas.serviceDraft(id),history=MorothonHonorsData.serviceTenure(await MorothonHonorsData.load(),(await MorothonHonorsData.find(id)).member),doc=new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html');
    return {count:d.contributionCount,year:history.milestoneYears[count],first:d.contributionFirst,last:d.contributionLast,date:doc.querySelector('.diploma-date p').textContent.trim(),lines:doc.querySelectorAll('.diploma-date .diploma-signature-line').length,preview:d.previewOnly,ready:d.imageReady,awards:(await MorothonHonorsData.find(id)).member.awards};
   },{id,count});
   assert.deepEqual(actual,{count:35,year,first:1992,last:2026,date:'Søgne, 7. november 2026',lines:1,preview:true,ready:false,awards:[]});
  }
  await p.close();
 }finally{await h.close();}
});
