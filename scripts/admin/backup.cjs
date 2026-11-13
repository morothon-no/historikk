// OpenPGP encryption is delegated to GnuPG; no custom encryption protocol.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const C=require('./common.cjs');
const zipCode=String.raw`
import sys,zipfile,pathlib,stat
mode,src,dst=sys.argv[1:4]
if mode=='pack':
 with zipfile.ZipFile(dst,'x',compression=zipfile.ZIP_DEFLATED,allowZip64=True) as z:
  for p in sorted(pathlib.Path(src).rglob('*')):
   if p.is_symlink(): raise ValueError('Symlink')
   if p.is_file(): z.write(p,p.relative_to(src).as_posix())
else:
 with zipfile.ZipFile(src) as z:
  entries=z.infolist(); names=[i.filename for i in entries]
  if len(names)!=len(set(names)) or len(names)>200000 or sum(i.file_size for i in entries)>int(sys.argv[4]): raise ValueError('Archive limits or duplicate entries')
  for i in entries:
   p=pathlib.PurePosixPath(i.filename)
   if not i.filename or p.is_absolute() or '..' in p.parts or p.as_posix()!=i.filename or chr(92) in i.filename or ':' in i.filename or any(ord(c)<32 for c in i.filename) or i.is_dir(): raise ValueError('Unsafe archive path')
   m=i.external_attr>>16
   if m and stat.S_IFMT(m) not in (0,stat.S_IFREG): raise ValueError('Special archive member')
  if z.testzip(): raise ValueError('Archive CRC mismatch')
  z.extractall(dst)
`;
function fingerprint(key,home){
 const lines=C.run('gpg',['--no-options','--batch','--homedir',home,'--with-colons','--show-keys',key]).split('\n');
 const pubs=lines.filter(s=>s.startsWith('pub:'));const fpr=lines.find(s=>s.startsWith('fpr:'))?.split(':')[9];
 if(pubs.length!==1||!fpr)throw Error('Expected exactly one backup recipient key');return fpr;
}
async function sealReceipt({receipt,recipientKey,recipientFingerprint,out}){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-receipt-'));await fs.chmod(temp,0o700);
 try{
  const home=path.join(temp,'gnupg');await fs.mkdir(home,{mode:0o700});if(fingerprint(recipientKey,home)!==recipientFingerprint)throw Error('Backup recipient fingerprint mismatch');
  const source=path.join(temp,'receipt.json');await C.writeNew(source,C.bytes(receipt));C.run('gpg',['--no-options','--batch','--homedir',home,'--import',recipientKey]);
  const target=path.join(temp,'receipt.gpg');C.run('gpg',['--no-options','--batch','--homedir',home,'--trust-model','always','--cipher-algo','AES256','--recipient',recipientFingerprint,'--output',target,'--encrypt',source]);
  const b=await fs.readFile(target);await C.writeNew(out,b);return {sha256:C.sha(b),bytes:b.length};
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
function openReceipt({archive,keyHome}){return C.json(Buffer.from(C.run('gpg',['--no-options','--batch','--homedir',keyHome,'--decrypt',archive])));}
async function packageDownload({archive,receipt,recipientKey,recipientFingerprint,out}){
 if(C.sha(await fs.readFile(archive))!==receipt.sha256)throw Error('Backup changed before download packaging');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-download-'));await fs.chmod(temp,0o700);
 try{
  await C.writeNew(path.join(temp,'backup.gpg'),await fs.readFile(archive));
  await sealReceipt({receipt:{...receipt,downloadOrigin:path.dirname(path.resolve(archive)),independent:false},recipientKey,recipientFingerprint,out:path.join(temp,'receipt.gpg')});
  await C.writeNew(path.join(temp,'README.txt'),Buffer.from('Morothon encrypted backup\n\nSave this complete ZIP outside GitHub and the temporary cloud workspace. Keep the recovery key separately. Backup SHA-256: '+receipt.sha256+'\n\nExtract backup.gpg and receipt.gpg. An approved restore from the downloaded independent copy is required before migration or removal of originals.\n'));
  const zip=path.join(os.tmpdir(),'morothon-download-'+require('node:crypto').randomUUID()+'.zip');
  try{C.run('python3',['-c',zipCode,'pack',temp,zip]);const b=await fs.readFile(zip);await C.writeNew(out,b);return {sha256:C.sha(b),bytes:b.length,backupSha256:receipt.sha256,independent:false};}finally{await fs.rm(zip,{force:true});}
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
async function verifyPayload(root){
 const manifest=C.json(await C.read(root,'manifest.json'));
 if(manifest.schemaVersion!==1||!manifest.files||Object.keys(manifest).sort().join('|')!=='files|schemaVersion')throw Error('Invalid backup manifest');
 const actual=await C.inventory(path.join(root,'payload'));
 if(!C.isDeepStrictEqual(actual,manifest.files))throw Error('Backup SHA-256, file inventory or mode mismatch');
 const state=C.json(await C.read(path.join(root,'payload'),'state.json'));
 if(state.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(state.sourceHead)||!Array.isArray(state.roots)||state.roots[0]!=='repository'||!state.refs||state.headRef&&!/^refs\/heads\/[a-zA-Z0-9/._-]+$/.test(state.headRef))throw Error('Invalid backup state');
 return {state,manifestSha256:C.sha(await C.read(root,'manifest.json'))};
}
async function createBackup({repository,extraRoots={},recipientKey,recipientFingerprint,out}){
 repository=path.resolve(repository);out=path.resolve(out);C.separate(repository,out);
 if(C.git(repository,['rev-parse','--is-shallow-repository'])!=='false')throw Error('Full Git history is required');
 // Refuse silently incomplete LFS preservation. The snapshot includes fetched LFS objects below.
 const hasAttributes=C.git(repository,['rev-list','--all','--','.gitattributes']);let lfs=[];
 if(hasAttributes){
  let listing;try{listing=C.git(repository,['lfs','ls-files','--all','--long']);}catch{throw Error('Install git-lfs and verify all LFS objects before backup');}
  lfs=[...new Set(listing.split('\n').filter(Boolean).map(s=>s.match(/^[a-f0-9]{64}/)?.[0]))];if(lfs.some(x=>!x))throw Error('Unrecognized LFS inventory');
 }
 const sourceHead=C.git(repository,['rev-parse','HEAD']),headRef=(()=>{try{return C.git(repository,['symbolic-ref','-q','HEAD']);}catch{return null;}})();
 const refs=Object.fromEntries(C.git(repository,['show-ref']).split('\n').filter(Boolean).map(s=>{const [sha,ref]=s.split(' ');return [ref,sha];}));
 const roots={repository,...extraRoots};if(Object.keys(extraRoots).includes('repository'))throw Error('Reserved backup root');
 for(const [name,dir]of Object.entries(roots)){if(!/^[a-z][a-z0-9-]*$/.test(name))throw Error('Invalid backup root name');C.separate(dir,out);if(name!=='repository')try{await fs.lstat(path.join(dir,'.git'));throw Error('Additional Git repositories need separate backups');}catch(e){if(e.code!=='ENOENT')throw e;}}
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-backup-'));await fs.chmod(temp,0o700);
 try{
  const home=path.join(temp,'gnupg');await fs.mkdir(home,{mode:0o700});
  if(fingerprint(recipientKey,home)!==recipientFingerprint||!/^[A-F0-9]{40,64}$/.test(recipientFingerprint))throw Error('Backup recipient fingerprint mismatch');
  const payload=path.join(temp,'archive/payload');await fs.mkdir(payload,{recursive:true,mode:0o700});
  const before={};for(const [name,dir]of Object.entries(roots)){before[name]=await C.inventory(dir);for(const [file,meta]of Object.entries(before[name])){const dest=path.join(payload,'roots',name,file),b=await C.read(dir,file);if(C.sha(b)!==meta.sha256||b.length!==meta.bytes)throw Error('Source changed while copying backup');await C.writeNew(dest,b);await fs.chmod(dest,meta.executable?0o700:0o600);}}
  C.git(repository,['bundle','create',path.join(payload,'repository.bundle'),'--all','HEAD']);
  for(const oid of lfs){const source=path.resolve(repository,C.git(repository,['rev-parse','--git-path',`lfs/objects/${oid.slice(0,2)}/${oid.slice(2,4)}/${oid}`]));const b=await fs.readFile(source);if(C.sha(b)!==oid)throw Error('Missing or changed LFS object');await C.writeNew(path.join(payload,'lfs',oid),b);}
  const state={schemaVersion:1,sourceHead,headRef,refs,roots:Object.keys(roots),lfs};await C.writeNew(path.join(payload,'state.json'),C.bytes(state));
  for(const [name,dir]of Object.entries(roots))if(!C.isDeepStrictEqual(before[name],await C.inventory(dir)))throw Error('Source changed during backup');
  if(C.git(repository,['rev-parse','HEAD'])!==sourceHead||!C.isDeepStrictEqual(refs,Object.fromEntries(C.git(repository,['show-ref']).split('\n').filter(Boolean).map(s=>{const [hash,ref]=s.split(' ');return [ref,hash];}))))throw Error('Git refs changed during backup');
  const manifest={schemaVersion:1,files:await C.inventory(payload)};await C.writeNew(path.join(temp,'archive/manifest.json'),C.bytes(manifest));
  const zip=path.join(temp,'backup.zip');C.run('python3',['-c',zipCode,'pack',path.join(temp,'archive'),zip]);
  C.run('gpg',['--no-options','--batch','--homedir',home,'--import',recipientKey]);
  const encrypted=path.join(temp,'backup.gpg');C.run('gpg',['--no-options','--batch','--homedir',home,'--trust-model','always','--cipher-algo','AES256','--recipient',recipientFingerprint,'--output',encrypted,'--encrypt',zip]);
  const b=await fs.readFile(encrypted);await C.writeNew(out,b);
  return {schemaVersion:1,sha256:C.sha(b),bytes:b.length,sourceHead,manifestSha256:C.sha(C.bytes(manifest)),recipientFingerprint};
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
async function restoreBackup({archive,receipt,keyHome,out,independentSource=null,maxBytes=20*1024**3}){
 const encrypted=await fs.readFile(archive);if(receipt.schemaVersion!==1||C.sha(encrypted)!==receipt.sha256||encrypted.length!==receipt.bytes)throw Error('Encrypted backup checksum mismatch');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Invalid archive size limit');await C.empty(out);
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-restore-'));await fs.chmod(temp,0o700);
 try{
  const zip=path.join(temp,'backup.zip');C.run('gpg',['--no-options','--batch','--homedir',keyHome,'--output',zip,'--decrypt',archive]);
  const unpacked=path.join(temp,'unpacked');await fs.mkdir(unpacked,{mode:0o700});C.run('python3',['-c',zipCode,'unpack',zip,unpacked,String(maxBytes)]);
  const manifest=C.json(await C.read(unpacked,'manifest.json'));
  for(const [file,meta]of Object.entries(manifest.files||{})){C.relative(file);if(typeof meta.executable!=='boolean')throw Error('Invalid backup mode');await C.read(path.join(unpacked,'payload'),file);await fs.chmod(path.join(unpacked,'payload',file),meta.executable?0o700:0o600);}
  const verified=await verifyPayload(unpacked);if(verified.manifestSha256!==receipt.manifestSha256||verified.state.sourceHead!==receipt.sourceHead)throw Error('Backup receipt does not match restored data');
  for(const file of await C.files(unpacked))if(file!=='manifest.json'&&!file.startsWith('payload/'))throw Error('Unexpected archive member');
  // Preserve the verified archive alongside the working restore for migration verification.
  await fs.cp(unpacked,path.join(out,'verified'),{recursive:true});
  const work=path.join(out,'repository');await fs.cp(path.join(unpacked,'payload/roots/repository'),work,{recursive:true});
  C.git(work,['init','--quiet']);C.git(work,['bundle','verify',path.join(unpacked,'payload/repository.bundle')]);
  C.git(work,['fetch','--quiet','--update-head-ok',path.join(unpacked,'payload/repository.bundle'),'+refs/*:refs/*']);
  if(verified.state.headRef)C.git(work,['symbolic-ref','HEAD',verified.state.headRef]);else C.git(work,['update-ref','--no-deref','HEAD',verified.state.sourceHead]);
  C.git(work,['read-tree','HEAD']);C.git(work,['fsck','--full','--no-reflogs']);
  if(C.git(work,['rev-parse','HEAD'])!==receipt.sourceHead)throw Error('Restored Git HEAD mismatch');
  const refs=Object.fromEntries(C.git(work,['show-ref']).split('\n').filter(Boolean).map(s=>{const [hash,ref]=s.split(' ');return [ref,hash];}));
  if(!C.isDeepStrictEqual(refs,verified.state.refs))throw Error('Restored Git refs mismatch');
  for(const oid of verified.state.lfs){const b=await C.read(path.join(unpacked,'payload'),'lfs/'+oid);if(C.sha(b)!==oid)throw Error('Restored LFS checksum mismatch');await C.writeNew(path.join(work,'.git/lfs/objects',oid.slice(0,2),oid.slice(2,4),oid),b);}
  if(!C.isDeepStrictEqual(await C.inventory(work),await C.inventory(path.join(unpacked,'payload/roots/repository'))))throw Error('Restored working tree mismatch');
  const proof={schemaVersion:1,status:'restore-tested',backupSha256:receipt.sha256,manifestSha256:receipt.manifestSha256,sourceHead:receipt.sourceHead,refsVerified:true,filesVerified:true,independentReadBackVerified:!!independentSource,independentSource};
  await C.writeNew(path.join(out,'restore-proof.json'),C.bytes(proof));return proof;
 }catch(e){await fs.rm(out,{recursive:true,force:true});throw e;}finally{await fs.rm(temp,{recursive:true,force:true});}
}
module.exports={fingerprint,sealReceipt,openReceipt,packageDownload,verifyPayload,createBackup,restoreBackup,zipCode};
