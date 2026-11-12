// Explicit preparation of a reviewable presentation set. Never assigns an award,
// issues a diploma, approves a medal original or runs automatically in the build.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('../js/honors-data.js'),{readHonors}=require('../tests/helpers/honors.cjs'),{createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..');
async function prepare({write=false}={}){
 const data=await readHonors(),years=H.arrangedYears(JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')).results);
 const people=data.groups.flatMap(g=>g.members),entries=[],h=await createHarness();
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
     try{await f.contentDocument.fonts.ready;await Promise.all([...f.contentDocument.images].map(i=>i.decode()));return {proof:d.contentProof,check:await MorothonDiplomas.checkServiceDraft(d,f.contentDocument),estimated:!!d.estimated};}finally{f.remove();}
    },{personId:member.id,badgeId,medalDisplay});
    assert.equal(result.check.ready,true,member.id+': '+result.check.failures.join(' '));
    assert.equal(result.estimated,false,member.id+': estimates must not become clean numbered diplomas');
    entries.push({personId:member.id,badgeId,medalDisplay,...result.proof});
   }
  }
 }finally{await h.close();}
 const set={id:'v352-presentation',scope:'presentation-only',sourceIds:['organizer-v352'],editionYears:years,entries};
 if(write){const file=path.join(root,'data/honors.json'),core=JSON.parse(await fs.readFile(file,'utf8'));core.presentationPrintSet=set;await fs.writeFile(file,JSON.stringify(core,null,2)+'\n');}
 else assert.deepEqual(set,data.presentationPrintSet,'The reviewed presentation set is stale. Inspect changes before explicitly preparing it again.');
 return {people:people.length,diplomas:entries.length,written:write};
}
module.exports={prepare};if(require.main===module)prepare({write:process.argv.includes('--write')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
