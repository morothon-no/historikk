// Execute this guard from protected base/main, before installing or running PR code.
const fs=require('node:fs/promises'),path=require('node:path'),{isDeepStrictEqual}=require('node:util');
const protectedFiles=['.github/public-data-approval.json','package.json','package-lock.json','js/history-data.js','scripts/build-site.cjs','scripts/check-public-site.cjs','scripts/check-public-policy.cjs','scripts/lib/public-schema.cjs','scripts/lib/public-package.cjs','scripts/lib/runtime-files.cjs'];
const critical=p=>p.startsWith('.github/workflows/')||protectedFiles.includes(p);
async function policyChanges(a,b){
 const names=new Set(protectedFiles);
 for(const root of [a,b]){const dir=path.join(root,'.github/workflows');if(await exists(dir))for(const item of await fs.readdir(dir,{withFileTypes:true})){if(!item.isFile()||item.isSymbolicLink())throw Error('Invalid workflow file');names.add('.github/workflows/'+item.name);}}
 const changes=[];for(const name of names){const x=path.join(a,name),y=path.join(b,name);if(await exists(x)!==await exists(y)){changes.push(name);continue;}if(await exists(x)){for(const f of [x,y])if((await fs.lstat(f)).isSymbolicLink())throw Error('Symlink in security policy');if(!(await fs.readFile(x)).equals(await fs.readFile(y)))changes.push(name);}}return changes;
}
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
async function checkPolicy({candidateRoot,baseRoot,headSha,approvedManifestSha='',reviewedHeadSha=''}){
 candidateRoot=path.resolve(candidateRoot);baseRoot=path.resolve(baseRoot);
 const basePin=path.join(baseRoot,'.github/public-data-approval.json'),bootstrap=!await exists(basePin);
 const changedPaths=await policyChanges(baseRoot,candidateRoot),sensitive=bootstrap||changedPaths.some(critical);
 if(sensitive&&(!/^[a-f0-9]{40}$/.test(headSha||'')||reviewedHeadSha!==headSha))throw Error('Security policy changes require maintainer approval of this exact PR head');
 // A first-time guard is executable only after explicit out-of-band head review.
 const libraryRoot=bootstrap?candidateRoot:baseRoot;
 const library=require(path.join(libraryRoot,'scripts/lib/public-package.cjs'));
 const proposed=library.validateApproval(JSON.parse(await fs.readFile(path.join(candidateRoot,'.github/public-data-approval.json'),'utf8')));
 let trusted;
 if(bootstrap){if(approvedManifestSha!==proposed.manifestSha256)throw Error('Bootstrap requires an externally approved manifest hash');trusted=proposed;}
 else{
  const current=library.validateApproval(JSON.parse(await fs.readFile(basePin,'utf8')));
  if(proposed.manifestSha256===current.manifestSha256){if(!isDeepStrictEqual(proposed,current))throw Error('Candidate cannot redefine the trusted approval');trusted=current;}
  else{if(approvedManifestSha!==proposed.manifestSha256)throw Error('Candidate manifest has not been approved outside the PR');if(proposed.dataVersion<=current.dataVersion)throw Error('Public data version must increase; rollback needs a new reviewed version');trusted=proposed;}
 }
 const verified=await library.readApprovedPackage(path.join(candidateRoot,'public-data'),{approval:trusted,assetsRoot:candidateRoot});
 return {approval:trusted,visiblePeople:verified.visiblePeople,bootstrap,securityReviewRequired:sensitive};
}
module.exports={checkPolicy,critical,policyChanges};
if(require.main===module){const [candidateRoot,baseRoot,headSha,acceptedFile]=process.argv.slice(2);
 (async()=>{const result=await checkPolicy({candidateRoot,baseRoot,headSha,approvedManifestSha:process.env.MOROTHON_PUBLIC_DATA_SHA256,reviewedHeadSha:process.env.MOROTHON_REVIEWED_POLICY_HEAD});await fs.writeFile(acceptedFile,JSON.stringify(result.approval,null,2)+'\n');console.log(JSON.stringify({publicPolicy:'approved',visiblePeople:result.visiblePeople,bootstrap:result.bootstrap}));})().catch(e=>{console.error(e.message);process.exitCode=1;});}
