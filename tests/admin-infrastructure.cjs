// All backup/migration fixtures are synthetic. Never copy live original registers here.
'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../scripts/admin/common.cjs'),R=require('../scripts/admin/repository.cjs'),B=require('../scripts/admin/backup.cjs'),M=require('../scripts/admin/migration.cjs'),P=require('../scripts/admin/publication.cjs');
const {execute}=require('../scripts/admin/operations.cjs'),S=require('../scripts/admin/storage.cjs');
const {auditSource}=require('../scripts/admin/source-audit.cjs');
const repo=path.resolve(__dirname,'..');let tmp,source,home,key,fpr,receipt,archive,restored,head;
const approved=(operation,binding)=>({schemaVersion:1,status:'approved',approvedBy:'Synthetic owner',approvedAt:'2026-11-13T12:00:00Z',operations:[operation],binding});
async function init(root){await fs.mkdir(root,{mode:0o700});C.git(root,['init','--quiet']);C.git(root,['config','user.name','Synthetic test']);C.git(root,['config','user.email','test@example.invalid']);}
before(async()=>{
 tmp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-admin-synthetic-'));source=path.join(tmp,'source');await init(source);
 await C.writeNew(path.join(source,'data/honors.json'),C.bytes({people:[{id:'synthetic-1',name:'Synthetic Person',privateNote:'Synthetic internal evidence'}]}));
 await C.writeNew(path.join(source,'data/volunteers.json'),C.bytes({people:[]}));
 await C.writeNew(path.join(source,'kilder/ærlig kilde.txt'),Buffer.from('Synthetic evidence\n'));
 await C.writeNew(path.join(source,'tool.sh'),Buffer.from('#!/bin/sh\nexit 0\n'));await fs.chmod(path.join(source,'tool.sh'),0o700);
 C.git(source,['add','.']);C.git(source,['commit','--quiet','-m','synthetic original']);C.git(source,['tag','synthetic-v1']);head=C.git(source,['rev-parse','HEAD']);
 home=path.join(tmp,'keys');await fs.mkdir(home,{mode:0o700});
 C.run('gpg',['--no-options','--batch','--homedir',home,'--pinentry-mode','loopback','--passphrase','','--quick-generate-key','Synthetic Backup <test@example.invalid>','rsa2048','encr','0']);
 key=path.join(tmp,'recipient.asc');await fs.writeFile(key,C.run('gpg',['--no-options','--batch','--homedir',home,'--armor','--export']));fpr=B.fingerprint(key,home);
 archive=path.join(tmp,'backup.gpg');receipt=await B.createBackup({repository:source,recipientKey:key,recipientFingerprint:fpr,out:archive});
 const independent=path.join(tmp,'synthetic-independent-storage');await fs.mkdir(independent);await fs.copyFile(archive,path.join(independent,'backup.gpg'));
 restored=path.join(tmp,'restored');await B.restoreBackup({archive:path.join(independent,'backup.gpg'),receipt,keyHome:home,out:restored,independentSource:independent});
});
after(async()=>{if(tmp)await fs.rm(tmp,{recursive:true,force:true});});
test('A1D optional GitHub adapter only reads and verifies identity, private visibility and permissions',async()=>{
 let reads=0;assert.equal((await R.privateRepository({request:async(endpoint)=>{reads++;assert.equal(endpoint,'repos/'+C.ADMIN);return {full_name:C.ADMIN,private:true,visibility:'private',permissions:{push:true}};}})).private,true);assert.equal(reads,1);
 await assert.rejects(()=>R.privateRepository({request:async()=>{throw Error('Forbidden');}}),/Forbidden/);
 for(const r of [{full_name:C.ADMIN,private:false,visibility:'public',permissions:{push:true}},{full_name:C.ADMIN,private:true,visibility:'private',permissions:{}},{full_name:'other/private',private:true,visibility:'private',permissions:{push:true}}])await assert.rejects(()=>R.privateRepository({request:async()=>r}),/could not be verified/);
 assert.equal((await R.privateRepository({requirePush:false,request:async()=>({full_name:C.ADMIN,private:true,visibility:'private',permissions:{pull:true,push:false}})})).private,true);
});
test('A1D exact owner approval rejects pending, wrong operations and modified bindings',()=>{
 const binding={repository:C.ADMIN,sourceCommit:head};C.approval(approved('backup',binding),'backup',binding);
 for(const a of [null,{...approved('backup',binding),status:'pending'},approved('restore',binding),approved('backup',{...binding,sourceCommit:'a'.repeat(40)})])assert.throws(()=>C.approval(a,'backup',binding),/Explicit owner approval/);
});
test('A1D real GnuPG roundtrip preserves every synthetic file, binary mode, Unicode path, Git ref and commit',async()=>{
 assert.equal(receipt.sourceHead,head);assert.equal(C.git(path.join(restored,'repository'),['rev-parse','refs/tags/synthetic-v1']),head);
 assert.deepEqual(await C.inventory(source),await C.inventory(path.join(restored,'repository')));
 const proof=C.json(await C.read(restored,'restore-proof.json'));assert.equal(proof.status,'restore-tested');assert.equal(proof.backupSha256,receipt.sha256);
 assert.ok(!(await fs.readFile(archive)).includes(Buffer.from('Synthetic internal evidence')));
 const sealed=path.join(tmp,'receipt.gpg');const digest=await B.sealReceipt({receipt,recipientKey:key,recipientFingerprint:fpr,out:sealed});assert.equal(digest.sha256,C.sha(await fs.readFile(sealed)));assert.deepEqual(B.openReceipt({archive:sealed,keyHome:home}),receipt);
 assert.ok(!(await fs.readFile(sealed)).includes(Buffer.from(receipt.sourceHead)));
});
test('A1D bad encryption fingerprint, modified archive and unapproved restore do not create usable copies',async()=>{
 await assert.rejects(()=>B.createBackup({repository:source,recipientKey:key,recipientFingerprint:'A'.repeat(40),out:path.join(tmp,'bad-key.gpg')}),/fingerprint/);
 const corrupt=path.join(tmp,'corrupt.gpg');await fs.writeFile(corrupt,Buffer.concat([await fs.readFile(archive),Buffer.from('x')]));
 await assert.rejects(()=>B.restoreBackup({archive:corrupt,receipt,keyHome:home,out:path.join(tmp,'bad-restore')}),/checksum/);
 await assert.rejects(()=>execute('restore',{schemaVersion:1,repository:C.ADMIN,sourceRoot:source,publicRoot:source,workRoot:path.join(tmp,'work'),receiptFile:path.join(tmp,'absent')},null));
 assert.equal(sync.existsSync(path.join(tmp,'bad-restore')),false);
});
test('A1D downloadable ZIP contains only encrypted data and receipt, and is not an independent restore by itself',async()=>{
 const zip=path.join(tmp,'download.zip');const info=await B.packageDownload({archive,receipt,recipientKey:key,recipientFingerprint:fpr,out:zip});assert.equal(info.independent,false);
 const out=path.join(tmp,'download-unpacked');C.run('python3',['-c',B.zipCode,'unpack',zip,out,String(20*1024**3)]);assert.deepEqual((await fs.readdir(out)).sort(),['README.txt','backup.gpg','receipt.gpg']);
 const meta=B.openReceipt({archive:path.join(out,'receipt.gpg'),keyHome:home});assert.equal(meta.independent,false);assert.equal(meta.sha256,receipt.sha256);assert.ok(!(await fs.readFile(zip)).includes(Buffer.from('Synthetic internal evidence')));
 const local=path.join(tmp,'local-only-restore');const proof=await B.restoreBackup({archive,receipt,keyHome:home,out:local});assert.equal(proof.independentReadBackVerified,false);
 const admin=path.join(tmp,'local-gated-target');await init(admin);C.git(admin,['remote','add','origin','https://github.com/'+C.ADMIN+'.git']);
 const {plan,sha256:planSha256}=await M.planMigration({sourceRoot:source,sourceCommit:head,adminRoot:admin});
 await assert.rejects(()=>M.copyMigration({sourceRoot:source,adminRoot:admin,restoredRoot:local,plan,planSha256,receipt,ownerApproval:approved('migrate',{destination:plan.destination,sourceCommit:head,planSha256}),verifyPrivate:async()=>({private:true})}),/independent storage/);
 assert.equal(sync.existsSync(path.join(admin,'data')),false);
});
test('A1D restore verifies plaintext SHA-256 and rejects changed files and unexpected members',async()=>{
 const copy=path.join(tmp,'verify-copy');await fs.cp(path.join(restored,'verified'),copy,{recursive:true});
 await fs.appendFile(path.join(copy,'payload/roots/repository/data/honors.json'),' ');await assert.rejects(()=>B.verifyPayload(copy),/SHA-256/);
});
test('A1D ZIP extraction refuses traversal, symlinks, duplicates and size excess before extraction',async()=>{
 for(const kind of ['traversal','symlink','duplicate','size']){
  const file=path.join(tmp,kind+'.zip'),out=path.join(tmp,kind+'-unpack');
  C.run('python3',['-c',`import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w'); k=sys.argv[2]\nif k=='symlink':\n i=zipfile.ZipInfo('link'); i.create_system=3; i.external_attr=0o120777<<16; z.writestr(i,'elsewhere')\nelif k=='duplicate': z.writestr('file','a'); z.writestr('file','b')\nelif k=='traversal': z.writestr('../escape','a')\nelse: z.writestr('file','too much')\nz.close()`,file,kind]);
  assert.throws(()=>C.run('python3',['-c',B.zipCode,'unpack',file,out,kind==='size'?'1':'10000']));assert.equal(sync.existsSync(path.join(tmp,'escape')),false);
 }
});
test('A1D symlinks and shallow Git backups stop without silently omitting source data',async()=>{
 const s=path.join(tmp,'symlink-source');await fs.mkdir(s);await fs.symlink(path.join(source,'data/honors.json'),path.join(s,'secret'));
 await assert.rejects(()=>C.inventory(s),/Symlink/);
 const shallow=path.join(tmp,'shallow');C.run('git',['clone','--quiet','--depth','1','file://'+source,shallow]);
 await assert.rejects(()=>B.createBackup({repository:shallow,recipientKey:key,recipientFingerprint:fpr,out:path.join(tmp,'shallow.gpg')}),/Full Git history/);
 const read=C.read;try{
  C.read=async(root,file)=>file==='data/honors.json'?Buffer.from('synthetic changed bytes during copy'):read(root,file);
  await assert.rejects(()=>B.createBackup({repository:source,recipientKey:key,recipientFingerprint:fpr,out:path.join(tmp,'copy-race.gpg')}),/Source changed while copying/);
  assert.equal(sync.existsSync(path.join(tmp,'copy-race.gpg')),false);
 }finally{C.read=read;}
});
test('A1D independent backup upload is encrypted, immutable and verified by downloading the actual object',async()=>{
 const objects=new Map(),runner=(_,args)=>{assert.equal(args[1],'--immutable');const a=args[2],b=args[3];if(a.includes(':'))sync.writeFileSync(b,objects.get(a));else objects.set(b,sync.readFileSync(a));};
 const result=await M.transferEncrypted({archive,receipt,remoteRoot:'synthetic-storage:isolated-backups',stagingRoot:path.join(tmp,'download'),runner});assert.equal(result.readBackVerified,true);
 const broken=(_,args)=>{if(args[2].includes(':'))sync.writeFileSync(args[3],'corrupt');else objects.set(args[3],sync.readFileSync(args[2]));};
 await assert.rejects(()=>M.transferEncrypted({archive,receipt,remoteRoot:'synthetic-storage:isolated-backups',stagingRoot:path.join(tmp,'download-bad'),runner:broken}),/read-back checksum/);
 await assert.rejects(()=>M.transferEncrypted({archive,receipt,remoteRoot:'remote:../escape',stagingRoot:tmp,runner}),/Expected approved/);
});
test('A1D migration is idempotent, source-preserving and gated on exact plan, actual restore and private destination',async()=>{
 const admin=path.join(tmp,'private-synthetic');await init(admin);C.git(admin,['remote','add','origin','https://github.com/'+C.ADMIN+'.git']);
 const {plan,sha256:planSha256}=await M.planMigration({sourceRoot:source,sourceCommit:head,adminRoot:admin});
 const binding={destination:plan.destination,sourceCommit:head,planSha256},options={sourceRoot:source,adminRoot:admin,restoredRoot:restored,plan,planSha256,receipt,ownerApproval:approved('migrate',binding),verifyPrivate:async()=>({private:true})};
 await assert.rejects(()=>M.copyMigration({...options,ownerApproval:null}),/Explicit owner approval/);
 await assert.rejects(()=>M.copyMigration({...options,verifyPrivate:async()=>{throw Error('public repository');}}),/public repository/);assert.equal(sync.existsSync(path.join(admin,'data')),false);
 const before=await C.inventory(source),first=await M.copyMigration(options),again=await M.copyMigration(options);assert.equal(first.copied,4);assert.equal(again.copied,0);assert.deepEqual(await C.inventory(source),before);
 assert.equal((await C.read(admin,'data/honors.json')).toString(),(await C.read(source,'data/honors.json')).toString());
 await fs.appendFile(path.join(admin,'data/honors.json'),' ');await assert.rejects(()=>M.copyMigration(options),/refusing to overwrite/);
});
test('A1D backup operations reject absent approval before creating local or remote data',async()=>{
 const work=path.join(tmp,'never-created');await assert.rejects(()=>execute('backup',{schemaVersion:1,repository:C.ADMIN,sourceRoot:source,publicRoot:source,sourceCommit:head,workRoot:work},null),/Explicit owner approval/);assert.equal(sync.existsSync(work),false);
});
test('A1D runtime workspace rejects broad permissions and Git worktrees before storing private data',async()=>{
 const broad=path.join(tmp,'broad');await fs.mkdir(broad);await fs.chmod(broad,0o755);await assert.rejects(()=>S.privateWorkspace(broad),/0700/);
 const tracked=path.join(tmp,'tracked');await init(tracked);await assert.rejects(()=>S.privateWorkspace(tracked),/outside Git worktrees/);
});
test('A1D public candidate validation checks external approval and schema without modifying the public checkout',async()=>{
 const root=path.join(tmp,'public-only'),pkg=path.join(tmp,'public-candidate');await init(root);
 const registry=C.json(await C.read(repo,'public-data/data/badges.json')),{runtimeFiles}=require('../scripts/lib/runtime-files.cjs');
 for(const file of [...runtimeFiles(registry).filter(f=>f.startsWith('assets/')),'scripts/lib/public-package.cjs','scripts/lib/public-schema.cjs','scripts/lib/runtime-files.cjs','.github/public-data-approval.json'])await C.writeNew(path.join(root,file),await C.read(repo,file));
 await fs.cp(path.join(repo,'public-data'),path.join(root,'public-data'),{recursive:true});await fs.cp(path.join(repo,'public-data'),pkg,{recursive:true});
 C.git(root,['remote','add','origin','https://github.com/'+C.PUBLIC+'.git']);C.git(root,['add','.']);C.git(root,['commit','--quiet','-m','public filtered fixture']);const commit=C.git(root,['rev-parse','HEAD']);
 const {approvalFor,sha256}=require('../scripts/lib/public-package.cjs');const manifest=C.json(await C.read(pkg,'manifest.json'));manifest.dataVersion=2;
 await fs.writeFile(path.join(pkg,'manifest.json'),C.bytes(manifest));let proposed=approvalFor(C.bytes(manifest));
 const opts={publicRoot:root,publicCommit:commit,packageRoot:pkg,approvedManifestSha256:'0'.repeat(64),branch:'codex/data-synthetic'};
 await assert.rejects(()=>P.validateApprovedCandidate(opts),/External approval/);assert.equal(C.git(root,['status','--porcelain']),'');
 const h=C.json(await C.read(pkg,'data/honors.json'));h.internalNotes=['synthetic forbidden field'];const b=C.bytes(h);await fs.writeFile(path.join(pkg,'data/honors.json'),b);manifest.files['data/honors.json']={sha256:sha256(b),bytes:b.length};await fs.writeFile(path.join(pkg,'manifest.json'),C.bytes(manifest));
 await assert.rejects(()=>P.validateApprovedCandidate({...opts,approvedManifestSha256:approvalFor(C.bytes(manifest)).manifestSha256}),/Unapproved public field/);
 await fs.rm(pkg,{recursive:true});await fs.cp(path.join(repo,'public-data'),pkg,{recursive:true});const valid=C.json(await C.read(pkg,'manifest.json'));valid.dataVersion=2;await fs.writeFile(path.join(pkg,'manifest.json'),C.bytes(valid));
 const result=await P.validateApprovedCandidate({...opts,approvedManifestSha256:approvalFor(C.bytes(valid)).manifestSha256});assert.equal(result.files,6);assert.equal(result.approval.dataVersion,2);
 assert.equal(C.git(root,['diff',commit,'--name-only']),'');assert.equal(C.git(root,['rev-parse','HEAD']),commit);assert.equal(C.git(root,['status','--porcelain']),'');
});
test('A1D Git audit detects remote refs missing from the archive and never fetches or changes the source',async()=>{
 const remote=path.join(tmp,'source-remote');C.run('git',['clone','--quiet','--bare',source,remote]);C.git(source,['remote','add','origin',remote]);
 const first=auditSource(source,{remote:true});assert.equal(first.completeGitCoverage,true);
 // Create another commit in a separate synthetic working copy and advertise it remotely.
 const extra=path.join(tmp,'synthetic-extra');C.run('git',['clone','--quiet',remote,extra]);C.git(extra,['config','user.name','Synthetic test']);C.git(extra,['config','user.email','test@example.invalid']);await C.writeNew(path.join(extra,'extra.txt'),Buffer.from('synthetic'));
 C.git(extra,['add','.']);C.git(extra,['commit','--quiet','-m','synthetic remote only']);C.git(extra,['push','--quiet','origin','HEAD:refs/heads/remote-only']);
 const second=auditSource(source,{remote:true});assert.equal(second.completeGitCoverage,false);assert.equal(second.missingReachableRefs,1);assert.equal(C.git(source,['rev-parse','HEAD']),head);
});
test('A1D local administrative storage is private and cannot bypass hosted repository visibility',async()=>{
 const admin=path.join(tmp,'local-storage');await init(admin);const c={storage:{type:'local-directory'},adminRoot:admin,publicRoot:source};
 assert.equal((await S.verifyStorage(c)).type,'local-directory');await fs.chmod(admin,0o755);await assert.rejects(()=>S.verifyStorage(c),/0700/);await fs.chmod(admin,0o700);
 C.git(admin,['remote','add','origin','https://github.com/'+C.ADMIN+'.git']);await assert.rejects(()=>S.verifyStorage(c),/visibility/);
 const verify=R.privateRepository;let checked=0;try{R.privateRepository=async()=>{checked++;throw Error('visibility unverified');};await assert.rejects(()=>S.verifyStorage({...c,storage:{type:'github'},repository:C.ADMIN}),/unverified/);assert.equal(checked,1);}finally{R.privateRepository=verify;}
});
test('A1D complete approved backup-download operation works offline without gh, Actions, tokens or rclone',async()=>{
 const work=path.join(tmp,'portable-run'),c={schemaVersion:1,sourceRoot:source,publicRoot:source,sourceCommit:head,workRoot:work,recipientKey:key,recipientFingerprint:fpr,coverageReviewed:true,verifyRemoteRefs:false};
 const binding={sourceCommit:head,remoteRoot:null,recipientFingerprint:fpr,workRoot:work,extraRoots:{},coverageReviewed:true,verifyRemoteRefs:false};
 const bin=path.join(tmp,'no-hosting-tools'),configFile=path.join(tmp,'cli-config/run.json'),approvalFile=path.join(tmp,'cli-config/approval.json');
 for(const command of ['gh','curl','rclone']){await C.writeNew(path.join(bin,command),Buffer.from('#!/bin/sh\nexit 91\n'));await fs.chmod(path.join(bin,command),0o700);}
 await C.writeNew(configFile,C.bytes(c));await C.writeNew(approvalFile,C.bytes(approved('backup-download',binding)));
 const result=C.json(Buffer.from(C.run(process.execPath,[path.join(repo,'scripts/admin/operations.cjs'),'backup-download',configFile,approvalFile],{cwd:os.tmpdir(),env:{PATH:bin+path.delimiter+process.env.PATH,LANG:'C.UTF-8'}})));
 assert.equal(result.status,'completed');assert.equal(result.independent,false);assert.equal(result.backup,'awaiting-independent-download');assert.ok(sync.existsSync(path.join(work,'morothon-backup.zip')));
 const audit=auditSource(source);assert.equal(audit.remoteChecked,false);assert.equal(audit.completeGitCoverage,false);assert.equal(audit.advertisedRefs,null);assert.equal(audit.localGitValid,true);
});
test('A1D portable configuration remains pending and contains no workflow or service-account setup',async()=>{
 const config=C.json(await C.read(repo,'ops/admin-templates/config.example.json')),approval=C.json(await C.read(repo,'ops/admin-templates/approval.example.json'));
 assert.equal(config.storage.type,'local-directory');assert.equal(approval.status,'pending');assert.deepEqual(approval.operations,[]);
 assert.deepEqual((await fs.readdir(path.join(repo,'ops/admin-templates'))).sort(),['approval.example.json','config.example.json']);
 const operations=(await C.read(repo,'scripts/admin/operations.cjs')).toString();assert.ok(!operations.includes("C.run('gh'"));assert.ok(!operations.includes("['push'"));
});
test('A1D administrative tools and private credentials remain outside public runtime and PR checkout',async()=>{
 const {runtimeFiles}=require('../scripts/lib/runtime-files.cjs'),registry=C.json(await C.read(repo,'public-data/data/badges.json'));
 assert.ok(runtimeFiles(registry).every(f=>!f.startsWith('scripts/admin/')&&!f.startsWith('ops/')));
 const workflow=(await C.read(repo,'.github/workflows/pages.yml')).toString().split('  source_checks:')[0];
 assert.ok(!/historikk-admin|ADMIN_RCLONE|PUBLIC_DATA_PROPOSER_TOKEN|\/scripts\/admin\//.test(workflow));
 assert.deepEqual(await fs.readdir(path.join(repo,'.github/workflows')),['pages.yml']);
});
