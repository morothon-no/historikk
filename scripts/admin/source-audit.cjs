'use strict';
const C=require('./common.cjs');
function auditSource(root,{remote=false}={}){
 const shallow=C.git(root,['rev-parse','--is-shallow-repository'])!=='false';
 const reachable=new Set(C.git(root,['rev-list','--objects','--all','HEAD']).split('\n').map(s=>s.split(' ')[0]));
 const advertised=remote?C.git(root,['ls-remote','origin','refs/heads/*','refs/tags/*','refs/pull/*/head']).split('\n').filter(Boolean).map(s=>s.split(/\s+/)):[];
 // ls-remote is metadata only: never fetch new original data before migration approval.
 const missing=advertised.filter(([sha])=>!reachable.has(sha));
 C.git(root,['fsck','--full','--no-reflogs']);
 return {schemaVersion:1,sourceHead:C.git(root,['rev-parse','HEAD']),shallow,remoteChecked:remote,advertisedRefs:remote?advertised.length:null,missingReachableRefs:remote?missing.length:null,gitObjectsValid:true,localGitValid:!shallow,completeGitCoverage:remote&&!shallow&&advertised.length>0&&missing.length===0,externalSourcesVerified:false};
}
module.exports={auditSource};if(require.main===module){try{console.log(JSON.stringify(auditSource(process.argv[2],{remote:process.argv.includes('--remote')}),null,2));}catch{console.error('Source audit unavailable; archival coverage is not verified');process.exitCode=1;}}
