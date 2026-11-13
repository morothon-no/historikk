// Actual data operations require a private config and a separate, exact owner approval.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const C=require('./common.cjs'),S=require('./storage.cjs'),B=require('./backup.cjs'),M=require('./migration.cjs'),P=require('./publication.cjs'),{auditSource}=require('./source-audit.cjs');
async function execute(operation,c,ownerApproval){
 if(c.schemaVersion!==1)throw Error('Invalid private operation configuration');
 const check=()=>S.verifyStorage(c,{requirePush:operation==='migrate'});
 for(const file of [c.planFile,c.receiptFile].filter(Boolean))C.separate(c.publicRoot,file);
 if(operation==='plan')return M.planMigration({...c,destination:S.destination(c)});
 if(operation==='validate-public')return P.validateApprovedCandidate(c);
 const work=path.resolve(c.workRoot);C.separate(c.publicRoot,work);C.separate(c.sourceRoot,work);
 if(operation==='backup'||operation==='backup-download'){
  const binding={sourceCommit:c.sourceCommit,remoteRoot:operation==='backup-download'?null:c.remoteRoot,recipientFingerprint:c.recipientFingerprint,workRoot:work,extraRoots:c.extraRoots||{},coverageReviewed:c.coverageReviewed===true,verifyRemoteRefs:c.verifyRemoteRefs===true};
  C.approval(ownerApproval,operation,binding);C.pinned(c.sourceRoot,c.sourceCommit);
  if(c.coverageReviewed!==true)throw Error('External sources, refs, LFS and GitHub attachments must be inventoried and approved first');
  const audit=auditSource(c.sourceRoot,{remote:c.verifyRemoteRefs===true});
  if(!audit.localGitValid||c.verifyRemoteRefs===true&&!audit.completeGitCoverage)throw Error('Git archive coverage check failed; stop before backup');
  await S.privateWorkspace(work);const archive=path.join(work,'backup.gpg');
  const receipt=await B.createBackup({repository:c.sourceRoot,extraRoots:c.extraRoots,recipientKey:c.recipientKey,recipientFingerprint:c.recipientFingerprint,out:archive});
  if(operation==='backup-download'){const download=await B.packageDownload({archive,receipt,recipientKey:c.recipientKey,recipientFingerprint:c.recipientFingerprint,out:path.join(work,'morothon-backup.zip')});return {backup:'awaiting-independent-download',...download};}
  const remote=await M.transferEncrypted({archive,receipt,remoteRoot:c.remoteRoot,stagingRoot:path.join(work,'read-back')});
  const completed={...receipt,remote};await C.writeNew(path.join(work,'backup-receipt.json'),C.bytes(completed));
  const sealed=path.join(work,'receipt.gpg'),digest=await B.sealReceipt({receipt:completed,recipientKey:c.recipientKey,recipientFingerprint:c.recipientFingerprint,out:sealed});
  await M.transferEncrypted({archive:sealed,receipt:digest,remoteRoot:c.remoteRoot,stagingRoot:path.join(work,'receipt-read-back'),objectName:receipt.sha256+'.receipt.gpg'});
  return {backup:'encrypted-and-read-back-verified',backupSha256:receipt.sha256,sourceRemoved:false};
 }
 if(operation==='restore'){
  const expectedSha=c.backupSha256;C.approval(ownerApproval,'restore',{backupSha256:expectedSha,restoreRoot:path.resolve(c.restoreRoot)});
  if(!/^[a-f0-9]{64}$/.test(expectedSha||'')||!/^[a-zA-Z0-9_-]+:[a-zA-Z0-9/._-]+$/.test(c.remoteRoot)||c.remoteRoot.slice(c.remoteRoot.indexOf(':')+1).split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid approved backup location');
  C.separate(c.publicRoot,c.restoreRoot);C.separate(c.sourceRoot,c.restoreRoot);
  await S.privateWorkspace(work);const sealed=path.join(work,'receipt-download.gpg');C.run('rclone',['copyto','--immutable',c.remoteRoot.replace(/\/$/,'')+'/'+expectedSha+'.receipt.gpg',sealed]);
  const receipt=B.openReceipt({archive:sealed,keyHome:c.keyHome});if(receipt.sha256!==expectedSha)throw Error('Receipt differs from approved backup SHA');
  await C.writeNew(c.receiptFile,C.bytes(receipt));
  const expected=c.remoteRoot.replace(/\/$/,'')+'/'+receipt.sha256+'.gpg';if(receipt.remote?.object!==expected||!receipt.remote.readBackVerified)throw Error('Backup must be retrieved from the approved independent destination');
  await S.privateWorkspace(work);const archive=path.join(work,'restore-download.gpg');C.run('rclone',['copyto','--immutable',expected,archive]);
  return B.restoreBackup({archive,receipt,keyHome:c.keyHome,out:c.restoreRoot,independentSource:expected});
 }
 if(operation==='restore-download'){
  C.approval(ownerApproval,'restore-download',{backupSha256:c.backupSha256,restoreRoot:path.resolve(c.restoreRoot),independentCopyRoot:path.resolve(c.independentCopyRoot)});
  C.separate(c.publicRoot,c.restoreRoot);C.separate(c.sourceRoot,c.restoreRoot);C.separate(c.independentCopyRoot,work);
  const receipt=B.openReceipt({archive:path.join(c.independentCopyRoot,'receipt.gpg'),keyHome:c.keyHome});
  if(receipt.sha256!==c.backupSha256||!receipt.downloadOrigin)throw Error('Downloaded backup receipt mismatch');
  C.separate(c.independentCopyRoot,receipt.downloadOrigin);await C.writeNew(c.receiptFile,C.bytes(receipt));
  return B.restoreBackup({archive:path.join(c.independentCopyRoot,'backup.gpg'),receipt,keyHome:c.keyHome,out:c.restoreRoot,independentSource:path.resolve(c.independentCopyRoot)});
 }
 if(operation==='migrate'){
  const {plan,sha256:planSha256}=C.json(await fs.readFile(c.planFile)),receipt=C.json(await fs.readFile(c.receiptFile));
  if(c.publicCommit!==plan.publicToolsCommit)throw Error('The migration approval does not cover this export toolchain');
  const copied=await M.copyMigration({...c,destination:S.destination(c),plan,planSha256,receipt,ownerApproval,verifyPrivate:check});
  await S.privateWorkspace(work);const checkRoot=await fs.mkdtemp(path.join(work,'migration-check-'));
  await P.candidate({...c,out:path.join(checkRoot,'package'),verifyPrivate:check});
  const preserved=await P.equivalence({...c,packageRoot:path.join(checkRoot,'package'),siteRoot:path.join(checkRoot,'site')});
  await C.writeNew(path.join(c.adminRoot,'release-journal','verified-'+planSha256+'.json'),C.bytes({planSha256,...preserved})).catch(async e=>{if(e.code!=='EEXIST')throw e;if(!(await C.read(c.adminRoot,'release-journal/verified-'+planSha256+'.json')).equals(C.bytes({planSha256,...preserved})))throw Error('Existing verification journal differs');});
  return {...copied,...preserved};
 }
 if(operation==='export'){
  const binding={destination:S.destination(c),adminCommit:c.adminCommit,publicCommit:c.publicCommit,dataVersion:c.dataVersion};C.approval(ownerApproval,'export',binding);C.pinned(c.adminRoot,c.adminCommit);
  return P.candidate({...c,out:path.join(work,'public-candidate'),verifyPrivate:check});
 }
 if(operation==='verify-migration')return P.equivalence({...c,packageRoot:path.join(work,'public-candidate'),siteRoot:path.join(work,'site')});
 throw Error('Unknown admin operation');
}
module.exports={execute};
if(require.main===module){const [operation,configFile,approvalFile]=process.argv.slice(2);(async()=>{
 const c=C.json(await fs.readFile(configFile));
 // Real runtime configuration and approval journals must not be tracked publicly.
 C.separate(path.dirname(path.resolve(configFile)),c.publicRoot);
 const a=approvalFile?C.json(await fs.readFile(approvalFile)):null;
 const result=await execute(operation,c,a);
 if(operation==='plan'){if(!c.planFile)throw Error('A private plan destination is required');C.separate(c.publicRoot,c.planFile);await S.privateWorkspace(path.dirname(c.planFile));await C.writeNew(c.planFile,C.bytes(result));console.log(JSON.stringify({plan:'prepared',files:Object.keys(result.plan.files).length}));}
 else console.log(JSON.stringify({operation,status:'completed',...(['backup','backup-download','validate-public','verify-migration'].includes(operation)?result:{})}));
 })().catch(()=>{console.error('Admin operation stopped. Check configuration, approval, visibility and private diagnostics; no original was removed.');process.exitCode=1;});}
