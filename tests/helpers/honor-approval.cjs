// Isolated test data only. No actual recipient is approved by this helper.
const fs=require('node:fs/promises'),path=require('node:path');
async function approvalFixture(page,base,{approve=true,badgeId='thanks',estimated=false,changeRecord}={}){
 const core=JSON.parse(await fs.readFile(path.resolve(__dirname,'../../data/honors.json'),'utf8'));
 const id='final-approval-fixture',source='final-approval-test-source';
 core.sources[source]={title:'Bare testdata – ingen faktisk diplomgodkjenning',basis:'Isolert regresjonskontroll.'};
 const m={id,name:'Kontrollperson – bare testdata',status:'confirmed',listingOnly:true,sourceIds:[source],roles:[],stories:[],badgeProposal:{status:'proposed',primaryBadgeId:null,badgeIds:[],sourceIds:[source]},awards:[],issuedDiplomas:[]};
 if(badgeId!=='thanks'){m.contribution={fromYear:2014,sourceIds:[source]};if(!estimated)m.contribution.confirmedYears=Array.from({length:13},(_,i)=>2014+i);}
 core.groups.find(g=>g.id==='volunteers').members.push(m);
 await page.route('**/data/honors.json',r=>r.fulfill({json:core}));
 await page.goto(base+'/heder.html?approval-fixture=1#person/'+id);await page.locator('#profileName').waitFor();
 const proof=await page.evaluate(async({id,badgeId})=>(await MorothonDiplomas.serviceDraft(id,badgeId)).contentProof,{id,badgeId});
 const record={id:'test-final-approval',personId:id,badgeId,status:'approved',approvedForFinal:true,approvedOn:'2026-11-11',sourceIds:[source],contentSha256:proof.contentSha256};
 changeRecord?.(record);
 if(approve){core.diplomaApprovals.push(record);await page.reload();await page.locator('#profileName').waitFor();}
 return {id,core,record,proof};
}
module.exports={approvalFixture};
