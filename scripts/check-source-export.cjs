// Transitional original-source QA. Run only in the trusted source environment.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {exportPackage}=require('./export-public-data.cjs');
const {isDeepStrictEqual}=require('node:util');
const {readApprovedPackage}=require('./lib/public-package.cjs');
async function check(){
 const root=path.resolve(__dirname,'..'),approvalFile=path.join(root,'.github/public-data-approval.json'),approval=JSON.parse(await fs.readFile(approvalFile,'utf8'));
 const approved=await readApprovedPackage(path.join(root,'public-data'),{approval,assetsRoot:root});
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-source-export-'));
 try{const result=await exportPackage({sourceDir:path.join(root,'data'),assetsRoot:root,out:path.join(parent,'candidate'),dataVersion:approval.dataVersion});
  if(!isDeepStrictEqual(result.approval,approval))throw Error('Administrative sources differ from the approved public package; export and review a new candidate');
  return {sourceExport:'matches-approved',dataVersion:approved.manifest.dataVersion,visiblePeople:approved.visiblePeople};
 }finally{await fs.rm(parent,{recursive:true,force:true});}
}
module.exports={check};if(require.main===module)check().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
