// Runtime config contains paths and approval metadata only; no tokens or original registers.
'use strict';
const path=require('node:path'),C=require('./common.cjs');
async function prepare(mode,env=process.env){
 if(env.GITHUB_REPOSITORY!==C.ADMIN||env.GITHUB_REF!=='refs/heads/main')throw Error('Private protected main only');
 const workspace=path.resolve(env.GITHUB_WORKSPACE),tmp=path.resolve(env.RUNNER_TEMP),publicRoot=path.join(workspace,'public-code'),adminRoot=path.join(workspace,'admin');
 const location=path.join(tmp,'morothon-'+(mode==='publish'?'publish':mode.startsWith('backup')?'backup':'export'));
 let c,a;
 if(mode==='publish'){
  a=C.json(Buffer.from(env.PUBLISH_APPROVAL||'null'));
  c={schemaVersion:1,repository:C.ADMIN,publicRoot,sourceRoot:publicRoot,workRoot:path.join(location,'work'),publicCommit:env.PUBLIC_TOOLS_SHA,packageRoot:path.join(workspace,'public-candidate'),approvedManifestSha256:env.APPROVED_MANIFEST_SHA256,branch:a?.binding?.branch};
  C.approval(a,'publish',{publicCommit:c.publicCommit,manifestSha256:c.approvedManifestSha256,branch:c.branch});
 }else if(mode==='export'){
  const lock=C.json(await C.read(adminRoot,'toolchain-lock.json'));if(lock.enabled!==true)throw Error('Private toolchain is not enabled');
  c={schemaVersion:1,repository:C.ADMIN,publicRoot,adminRoot,sourceRoot:adminRoot,workRoot:location,adminCommit:C.git(adminRoot,['rev-parse','HEAD']),publicCommit:lock.publicCommit,dataVersion:Number(env.PUBLIC_DATA_VERSION)};
  a=C.json(Buffer.from(env.ADMIN_EXPORT_APPROVAL_JSON||'null'));C.approval(a,'export',{repository:C.ADMIN,adminCommit:c.adminCommit,publicCommit:c.publicCommit,dataVersion:c.dataVersion});
 }else if(mode==='backup'||mode==='backup-download'){
  const base=C.json(await C.read(adminRoot,'config/backup.json'));
  c={...base,schemaVersion:1,repository:C.ADMIN,publicRoot,sourceRoot:adminRoot,sourceCommit:C.git(adminRoot,['rev-parse','HEAD']),workRoot:location};
  a=C.json(Buffer.from(env.ADMIN_BACKUP_APPROVAL_JSON||'null'));C.approval(a,mode,{repository:C.ADMIN,sourceCommit:c.sourceCommit,remoteRoot:mode==='backup-download'?null:c.remoteRoot,recipientFingerprint:c.recipientFingerprint,workRoot:location,extraRoots:c.extraRoots||{},coverageReviewed:c.coverageReviewed===true});
  if(mode==='backup'&&!env.ADMIN_RCLONE_CONFIG)throw Error('Independent storage credential is missing');
 }else throw Error('Unknown private workflow mode');
 await C.writeNew(path.join(location,'config.json'),C.bytes(c));await C.writeNew(path.join(location,'approval.json'),C.bytes(a));
 if(mode==='backup')await C.writeNew(path.join(location,'rclone.conf'),Buffer.from(env.ADMIN_RCLONE_CONFIG));
 return {mode,prepared:true};
}
module.exports={prepare};if(require.main===module)prepare(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('Private workflow configuration or exact owner approval is missing');process.exitCode=1;});
