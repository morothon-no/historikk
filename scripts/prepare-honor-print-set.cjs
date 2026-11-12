// Explicit preparation of a reviewable presentation set. Never assigns an award,
// issues a diploma, approves a medal original or runs automatically in the build.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('../js/honors-data.js'),{readHonors}=require('../tests/helpers/honors.cjs'),{createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..');
async function prepare({write=false}={}){
 const data=await readHonors(),years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);
 const people=data.groups.flatMap(g=>g.members),entries=[],pending=[],milestoneReviews=[],pendingIds=new Set((data.presentationPrintSet?.pendingReviews||[]).map(r=>r.personId)),h=await createHarness();
 try{
  const p=await h.browser.newPage();await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  for(const member of people){
   const choices=H.diplomaChoices(data,member,years).filter(id=>H.canPresent(data,member,id));
   assert.ok(choices.length,member.id+': no truthful personal diploma');
   for(const badgeId of choices)for(const medalDisplay of ['all','latest']){
    const result=await p.evaluate(async({personId,badgeId,medalDisplay})=>{
     const d=await MorothonDiplomas.serviceDraft(personId,badgeId,medalDisplay),f=document.createElement('iframe');
     f.style.cssText='position:fixed;left:-10000px;width:1123px;height:794px';
     await new Promise(resolve=>{f.onload=resolve;f.srcdoc=MorothonDiplomas.documentHtml(d);document.body.appendChild(f);});
     try{
      await f.contentDocument.fonts.ready;await Promise.all([...f.contentDocument.images].map(i=>i.decode()));
      // Recognize only the V3.6.2 count/period correction. Restoring exactly the
      // former total/period must reproduce an existing reviewed fingerprint.
      // Changes to dates, text, assets, CSS or any other content still fail.
      const data=await MorothonHonorsData.load(),member=(await MorothonHonorsData.find(personId)).member;
      const tenure=MorothonHonorsData.serviceTenure(data,member),badge=MorothonBadges.get(d.assetKey);
      const old=data.presentationPrintSet?.entries.find(e=>e.personId===personId&&e.badgeId===badgeId&&e.medalDisplay===medalDisplay);
      let milestoneReview=null;
      if(d.printMode==='draft'&&old&&badge.series==='dugnad'&&Number.isInteger(d.achievementYear)&&d.contributionCount===badge.milestoneEditions&&d.contributionFirst===tenure.first&&d.contributionLast===d.achievementYear){
       const former=await MorothonDiplomas.serviceProof({...d,contributionCount:tenure.count,contributionFirst:tenure.first,contributionLast:tenure.last});
       if(['contentSha256','cssSha256','assetSha256','watermarkSha256'].every(k=>former[k]===old[k]))milestoneReview=old;
      }
      return {proof:d.contentProof,mode:d.printMode,check:await MorothonDiplomas.checkServiceDraft(d,f.contentDocument),estimated:!!d.estimated,milestoneReview};
     }finally{f.remove();}
    },{personId:member.id,badgeId,medalDisplay});
    assert.equal(result.check.ready,true,member.id+': '+result.check.failures.join(' '));
    assert.equal(result.estimated,false,member.id+': estimates must not become clean numbered diplomas');
    if(pendingIds.has(member.id)){assert.equal(result.mode,'draft',member.id+': changed content must remain a marked preview');pending.push({personId:member.id,badgeId,medalDisplay,...result.proof});}
    else if(result.milestoneReview){
     // Keep the old approval as audit evidence, never approve the new content.
     entries.push(result.milestoneReview);milestoneReviews.push({personId:member.id,badgeId,medalDisplay,...result.proof});
    }else entries.push({personId:member.id,badgeId,medalDisplay,...result.proof});
   }
  }
 }finally{await h.close();}
 const set={id:'v352-presentation',scope:'presentation-only',sourceIds:['organizer-v352'],editionYears:years,entries};
 if(data.presentationPrintSet?.pendingReviews)set.pendingReviews=data.presentationPrintSet.pendingReviews;
 if(write&&(pending.length||milestoneReviews.length))throw new Error('Endrede diplomer venter på særskilt godkjenning; ingen kontrollsummer er skrevet.');
 if(write){const file=path.join(root,'data/honors.json'),core=JSON.parse(await fs.readFile(file,'utf8'));core.presentationPrintSet=set;await fs.writeFile(file,JSON.stringify(core,null,2)+'\n');}
 else assert.deepEqual(set,data.presentationPrintSet,'The reviewed presentation set is stale. Inspect changes before explicitly preparing it again.');
 return {people:people.length,diplomas:entries.length-milestoneReviews.length,pendingDiplomas:pending.length+milestoneReviews.length,pendingPeople:[...new Set([...pendingIds,...milestoneReviews.map(e=>e.personId)])],milestoneReviews:milestoneReviews.map(({personId,badgeId,medalDisplay})=>({personId,badgeId,medalDisplay})),written:write};
}
module.exports={prepare};if(require.main===module)prepare({write:process.argv.includes('--write')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
