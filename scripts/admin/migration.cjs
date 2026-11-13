'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const C=require('./common.cjs'),{verifyPayload}=require('./backup.cjs');
const ORIGINALS=['data/honors.json','data/volunteers.json'];
async function planMigration({sourceRoot,sourceCommit,publicCommit=sourceCommit,adminRoot,destination=adminRoot?'local:'+path.resolve(adminRoot):null,additionalFiles=[]}){
 C.pinned(sourceRoot,sourceCommit);
 if(!/^[a-f0-9]{40}$/.test(publicCommit||''))throw Error('Pin the reviewed public export toolchain');
 const files={};for(const file of [...new Set([...ORIGINALS,...additionalFiles])].sort()){const b=await C.read(sourceRoot,file);files[file]={sha256:C.sha(b),bytes:b.length};}
 if(typeof destination!=='string'||!destination)throw Error('An explicit migration destination is required');
 const plan={schemaVersion:1,destination,sourceCommit,publicToolsCommit:publicCommit,files,publicData:'unchanged',removeOriginals:false};
 return {plan,sha256:C.sha(C.bytes(plan))}; // Private journal only; never publish original-record hashes.
}
async function copyMigration({sourceRoot,adminRoot,restoredRoot,plan,planSha256,destination=plan.destination,receipt,ownerApproval,verifyPrivate}){
 if(C.sha(C.bytes(plan))!==planSha256||plan.destination!==destination||plan.removeOriginals!==false||destination?.startsWith('local:')&&destination!=='local:'+path.resolve(adminRoot))throw Error('Migration plan mismatch');
 C.approval(ownerApproval,'migrate',{destination,sourceCommit:plan.sourceCommit,planSha256});
 await verifyPrivate();C.pinned(sourceRoot,plan.sourceCommit);C.separate(sourceRoot,adminRoot);C.separate(sourceRoot,restoredRoot);
 const proof=C.json(await C.read(restoredRoot,'restore-proof.json')),verified=await verifyPayload(path.join(restoredRoot,'verified'));
 if(proof.status!=='restore-tested'||proof.independentReadBackVerified!==true||!proof.independentSource||proof.backupSha256!==receipt.sha256||proof.manifestSha256!==receipt.manifestSha256||verified.manifestSha256!==receipt.manifestSha256||verified.state.sourceHead!==plan.sourceCommit)throw Error('A matching actual restore test from approved independent storage is required');
 C.git(path.join(restoredRoot,'repository'),['fsck','--full','--no-reflogs']);
 const items=[];
 for(const [file,expected]of Object.entries(plan.files)){
  const b=await C.read(sourceRoot,file),restored=await C.read(path.join(restoredRoot,'repository'),file);
  if(C.sha(b)!==expected.sha256||b.length!==expected.bytes||!b.equals(restored))throw Error('Original or restored data changed');items.push([file,b]);
 }
 items.push([`archive/${plan.sourceCommit}/history.bundle`,await C.read(path.join(restoredRoot,'verified/payload'),'repository.bundle')]);
 items.push([`release-journal/import-${planSha256}.json`,C.bytes({plan,planSha256,backup:receipt,restore:proof})]);
 // Validate every existing destination before writing anything; reruns are idempotent.
 for(const [file,b]of items)try{if(!(await C.read(adminRoot,file)).equals(b))throw Error('Destination differs; refusing to overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
 await verifyPrivate();
 let copied=0;for(const [file,b]of items){try{await C.read(adminRoot,file);}catch(e){if(e.code!=='ENOENT')throw e;await C.writeNew(path.join(adminRoot,file),b);copied++;}}
 return {copied,unchanged:items.length-copied,sourceRemoved:false};
}
async function transferEncrypted({archive,receipt,remoteRoot,stagingRoot,objectName=receipt.sha256+'.gpg',runner=C.run}){
 if(!/^[a-zA-Z0-9_-]+:[a-zA-Z0-9/._-]+$/.test(remoteRoot)||remoteRoot.slice(remoteRoot.indexOf(':')+1).split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Expected approved rclone remote and object prefix');
 if(C.sha(await fs.readFile(archive))!==receipt.sha256)throw Error('Backup changed before upload');
 if(!/^[a-f0-9]{64}(?:\.receipt)?\.gpg$/.test(objectName))throw Error('Invalid backup object name');
 const object=remoteRoot.replace(/\/$/,'')+'/'+objectName,check=path.join(stagingRoot,'download-'+receipt.sha256+'.gpg');
 await fs.mkdir(stagingRoot,{recursive:true,mode:0o700});
 try{
  runner('rclone',['copyto','--immutable',archive,object]);runner('rclone',['copyto','--immutable',object,check]);
  if(C.sha(await fs.readFile(check))!==receipt.sha256)throw Error('Independent backup read-back checksum mismatch');
  return {object,sha256:receipt.sha256,readBackVerified:true};
 }finally{await fs.rm(check,{force:true});}
}
module.exports={ORIGINALS,planMigration,copyMigration,transferEncrypted};
