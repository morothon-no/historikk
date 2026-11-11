const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),base='e8e64a70c30b4b37c86171d153f8cf45459b4fba';

test('PR16 histories, identities, ordinary diplomas and official originals survive the approved tenure extension',async()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',base,'data','assets','index.html','heder.html','js','css'],{cwd:root}).toString().trim().split('\n');
 const extended=new Set(['js/honors-data.js','js/honors.js','css/honors.css','data/volunteers.json']);
 for(const file of files.filter(f=>!extended.has(f)))assert.deepEqual(await fs.readFile(path.join(root,file)),execFileSync('git',['show',base+':'+file],{cwd:root}),file);
 const expected=JSON.parse(execFileSync('git',['show',base+':data/volunteers.json'],{cwd:root}));
 expected.people.find(p=>p.id==='atle-aamodt').excludedYears=[2026];
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'data/volunteers.json'),'utf8')),expected,'Only Atle’s documented absence may extend volunteer data');
 // Temporary renders belong outside the production tree, not in the final PR.
 await assert.rejects(fs.access(path.join(root,'review/heder-pr16')),e=>e.code==='ENOENT');
 const generator=await fs.readFile(path.join(root,'scripts/review-honor-badges.cjs'),'utf8');
 assert.match(generator,/async function review\(out=path.join\(os.tmpdir\(\),'morothon-heder-pr16'\)/);
});

test('PR16 all documented volunteer milestone years remain historical, with no invented dates or awards',async()=>{
 const h=await createHarness();try{
  const p=await h.browser.newPage(),fixture=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
  // Expose earlier milestones only in this isolated proposal fixture. The live
  // profiles propose 30; eligibility must not silently create additional awards.
  for(const member of fixture.groups.flatMap(g=>g.members).filter(m=>['oscar-lohne','erling-askildsen'].includes(m.id)))member.badgeProposal.badgeIds.push(...[5,10,15,20].map(n=>'service-dugnad-'+n));
  await p.route('**/data/honors.json',r=>r.fulfill({json:fixture}));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="oscar-lohne"]').waitFor();
  for(const id of ['oscar-lohne','erling-askildsen'])for(const [count,year]of [[5,1996],[10,2001],[15,2006],[20,2011],[30,2021]]){
   const actual=await p.evaluate(async({id,count})=>{
    const d=await MorothonDiplomas.serviceDraft(id,'service-dugnad-'+count),doc=new DOMParser().parseFromString(MorothonDiplomas.documentHtml(d),'text/html');
    return {count:d.contributionCount,year:d.achievementYear,first:d.contributionFirst,last:d.contributionLast,date:doc.querySelector('.diploma-date').textContent.trim(),lines:doc.querySelectorAll('.diploma-date .diploma-signature-line').length,preview:d.previewOnly,ready:d.imageReady,awards:(await MorothonHonorsData.find(id)).member.awards};
   },{id,count});
   assert.deepEqual(actual,{count,year,first:1992,last:year,date:'MILEPÆL OPPNÅDD I '+year,lines:0,preview:true,ready:false,awards:[]});
  }
  await p.close();
 }finally{await h.close();}
});
