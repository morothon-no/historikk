const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {buildSite,validatePublicSite}=require('../scripts/build-site.cjs');
const {readApprovedPackage,manifestFor,approvalFor,sha256}=require('../scripts/lib/public-package.cjs');
const {checkPolicy}=require('../scripts/check-public-policy.cjs');
const {runtimeFiles}=require('../scripts/lib/runtime-files.cjs');
const root=path.resolve(__dirname,'..'),pin=path.join(root,'.github/public-data-approval.json');
const {temp,copyPublic,rewriteManifest}=require('./helpers/public-package.cjs');
test('approved package is versioned, history-bound and cannot silently accept changed, missing or extra inputs',async()=>{
 const dir=await temp();try{await copyPublic(dir);const opts={approvalFile:pin,assetsRoot:dir};assert.equal((await readApprovedPackage(path.join(dir,'public-data'),opts)).visiblePeople,43);
 for(const mutate of [async()=>fs.appendFile(path.join(dir,'public-data/data/honors.json'),' '),async()=>fs.unlink(path.join(dir,'public-data/data/honors.json')),async()=>fs.writeFile(path.join(dir,'public-data/internal.json'),'{}')]){
  await fs.rm(path.join(dir,'public-data'),{recursive:true});await fs.cp(path.join(root,'public-data'),path.join(dir,'public-data'),{recursive:true});await mutate();await assert.rejects(()=>readApprovedPackage(path.join(dir,'public-data'),opts));
 }
 await fs.rm(path.join(dir,'public-data'),{recursive:true});await fs.cp(path.join(root,'public-data'),path.join(dir,'public-data'),{recursive:true});await fs.appendFile(path.join(dir,'assets/medals/approved/participation-5.png'),'x');await assert.rejects(()=>readApprovedPackage(path.join(dir,'public-data'),opts),/Changed public asset/);
  const site=path.join(dir,'site');await buildSite(site);const infoFile=path.join(site,'build-info.json'),info=JSON.parse(await fs.readFile(infoFile,'utf8'));
  await fs.writeFile(infoFile,JSON.stringify({...info,assets:{...info.assets,'private.json':'synthetic forbidden value'}}));await assert.rejects(()=>validatePublicSite(site),/runtime URL list/);
  info.assets['js/diplomas.js']='https://invalid.example/diplomas.js';await fs.writeFile(infoFile,JSON.stringify(info));await assert.rejects(()=>validatePublicSite(site),/runtime URL/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('even a newly pinned malformed package cannot bypass public field, contract, history or file-list validation',async()=>{
 for(const fault of ['private','quality','unknown-file','version','history']){const dir=await temp();try{await copyPublic(dir);
  const proposed=await rewriteManifest(dir,async m=>{
   if(fault==='private'){const file=path.join(dir,'public-data/data/honors.json'),d=JSON.parse(await fs.readFile(file,'utf8'));d.internalNotes=['synthetic forbidden note'];const b=Buffer.from(JSON.stringify(d));await fs.writeFile(file,b);m.files['data/honors.json']={sha256:sha256(b),bytes:b.length};}
   if(fault==='quality'){const file=path.join(dir,'public-data/data/badges.json'),d=JSON.parse(await fs.readFile(file,'utf8'));delete d.minimumDpi;const b=Buffer.from(JSON.stringify(d));await fs.writeFile(file,b);m.files['data/badges.json']={sha256:sha256(b),bytes:b.length};}
   if(fault==='unknown-file')m.files['data/private.json']={sha256:'0'.repeat(64),bytes:1};
   if(fault==='version')m.schemaVersion=99;
   if(fault==='history')m.historySha256='0'.repeat(64);
  });await assert.rejects(()=>readApprovedPackage(path.join(dir,'public-data'),{approval:proposed,assetsRoot:dir}));
 }finally{await fs.rm(dir,{recursive:true,force:true});}}
});
test('PR-local approvals and safety edits cannot replace protected-base or external maintainer approval',async()=>{
 const base=await temp(),candidate=await temp(),head='a'.repeat(40);try{await copyPublic(base);await copyPublic(candidate);
  assert.equal((await checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head})).visiblePeople,43);
  for(const file of ['scripts/lib/public-schema.cjs','scripts/testing/run.cjs']){
   await fs.appendFile(path.join(candidate,file),'\n// untrusted security edit');await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head}),/exact PR head/);
   await fs.copyFile(path.join(base,file),path.join(candidate,file));
  }
  const changed=await rewriteManifest(candidate,async m=>{m.dataVersion=2;});
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head}),/exact PR head/);
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head}),/approved outside/);
  assert.equal((await checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head,approvedManifestSha:changed.manifestSha256})).approval.dataVersion,2);
  const rollback=await rewriteManifest(candidate,async m=>{m.dataVersion=1;m.files=Object.fromEntries(Object.entries(m.files).reverse());});
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head,approvedManifestSha:rollback.manifestSha256}),/must increase/);
  await fs.unlink(path.join(base,'.github/public-data-approval.json'));
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head}),/exact PR head/);
  assert.equal((await checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head,approvedManifestSha:rollback.manifestSha256})).bootstrap,true);
 }finally{await fs.rm(base,{recursive:true,force:true});await fs.rm(candidate,{recursive:true,force:true});}
});
test('fresh trusted artifact validation ignores validator and approval mutations in the PR build workspace',async()=>{
 const base=await temp(),candidate=await temp(),artifact=await temp();try{
  await copyPublic(base);await copyPublic(candidate);await buildSite(artifact);
  const trusted=path.join(base,'.github/public-data-approval.json');
  execFileSync(process.execPath,[path.join(base,'scripts/check-public-site.cjs'),artifact,trusted],{stdio:'pipe'});
  await fs.appendFile(path.join(artifact,'data/honors.json'),' ');
  await fs.writeFile(path.join(candidate,'scripts/check-public-site.cjs'),'process.exit(0);');
  await fs.writeFile(path.join(candidate,'.github/public-data-approval.json'),'{}');
  // PR code could make its own late check green. A separate runner must reject the same artifact.
  execFileSync(process.execPath,[path.join(candidate,'scripts/check-public-site.cjs'),artifact],{stdio:'pipe'});
  assert.throws(()=>execFileSync(process.execPath,[path.join(base,'scripts/check-public-site.cjs'),artifact,trusted],{stdio:'pipe'}),e=>/Changed public data file/.test(e.stderr.toString()));
 }finally{for(const dir of [base,candidate,artifact])await fs.rm(dir,{recursive:true,force:true});}
});
test('synthetic public identities and years preserve DNS/DNF, duplicate-year, alias and future milestone rules',async()=>{
 const vm=require('node:vm'),context={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'js/history-data.js'),'utf8'),context);
 const R=context.window.MorothonHistoryData,id='MOR-0000001',old='MOR-0000002';
 const person={i:id,n:'Testperson A',g:'M',c:2,f:2026,l:2027,s:0,a:0,m:0,k:0,q:0,d:0,x:'',z:''};
 const row=(year,pid,status)=>[year,pid,'Morothon','20 km',status,status==='Fullført'?'2:00:00':status,0,'','Testklubb',''];
 const history=R.create({schemaVersion:1,people:[person],results:[row(2026,id,'Fullført'),row(2026,old,'Fullført'),row(2027,old,'DNF'),row(2028,id,'DNS')],yearStats:[],redirects:{[old]:id},aliases:{[id]:['Testalias']}});
 assert.equal(history.resolve(old),id);assert.equal(history.stats(id).count,2);assert.equal(JSON.stringify(history.stats(id).years),'[2026,2027]');
 const H=require('../js/honors-data.js'),data={awardPolicy:{milestones:[{minimumDocumentedEditions:5,badgeId:'synthetic-five'},{minimumDocumentedEditions:10,badgeId:'synthetic-ten'}]},groups:[]};
 const member={id:'synthetic-volunteer',contribution:{fromYear:2018,excludedYears:[2020],sourceIds:['synthetic-evidence']}};
 const years=Array.from({length:9},(_,i)=>2018+i),a=H.serviceTenure(data,member,years),b=H.serviceTenure(data,member,[...years,2027]);
 assert.equal(a.count,8);assert.equal(b.count,9);assert.equal(a.milestoneYears[5],2023);assert.equal(b.milestoneYears[5],2023);assert.equal(b.automaticallyAwarded,false);
});
test('public Actions checkout excludes originals and uses protected-base policy; full source checks remain a main-only deploy gate',async()=>{
 const workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8'),publicJob=workflow.split('  source_checks:')[0],sourceJob=workflow.split('  source_checks:')[1].split('  deploy:')[0];
 assert.ok(publicJob.includes('sparse-checkout-cone-mode: false'));assert.ok(publicJob.includes('partialclonefilter)" = blob:none'));
 for(const line of publicJob.split('\n').map(s=>s.trim()))assert.ok(!['/data/','/tests/','/scripts/','/scripts/lib/public-data.cjs'].includes(line));
 assert.ok(publicJob.includes('github.event.pull_request.base.sha'));assert.ok(publicJob.includes('policy-base/scripts/check-public-policy.cjs'));assert.ok(publicJob.indexOf('Verify checkout and trusted policy')<publicJob.indexOf('npm ci'));
 assert.ok(!publicJob.includes('npm test'));assert.ok(publicJob.includes('policy-base/scripts/testing/run.cjs'));assert.ok(publicJob.includes("--scope public --level '${{ needs.plan.outputs.level }}'"));assert.ok(!publicJob.includes('${{ secrets.'));
 assert.ok(sourceJob.includes("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'"));assert.ok(sourceJob.includes("--scope source --level '${{ needs.plan.outputs.level }}'"));const runner=await fs.readFile(path.join(root,'scripts/testing/run.cjs'),'utf8');assert.ok(runner.includes('scripts/check-source-export.cjs'));assert.ok(runner.includes("scope!=='public'"));assert.ok(sourceJob.includes('needs: plan'));assert.equal((sourceJob.match(/if: inputs.historical_reports == true/g)||[]).length,5);
 for(const file of ['review-honors-v36.cjs','review-honors-v361.cjs','review-honors-final-v361.cjs','review-honor-signoff-v353.cjs','review-service-milestones-v362.cjs'])assert.ok(sourceJob.includes(file));
 const gate=workflow.split('  artifact_gate:')[1].split('  source_checks:')[0];
 assert.ok(gate.includes('needs: verify'));assert.ok(gate.includes('policy-base/scripts/check-public-policy.cjs'));assert.ok(gate.includes('policy-base/scripts/check-public-site.cjs'));assert.ok(gate.includes('actions/download-artifact@v4'));
 assert.ok(!/npm ci|npm run|npm test|playwright/.test(gate));assert.ok(gate.indexOf('Verify checkout and trusted policy')<gate.indexOf('Retrieve candidate artifact'));
 assert.ok(workflow.includes('needs: [artifact_gate, source_checks]'));assert.ok(!workflow.includes('continue-on-error'));
});
test('a 2027 public-history update requires a coherent new package and external approval, while stale history binding is rejected',async()=>{
 const base=await temp(),candidate=await temp(),head='b'.repeat(40);try{await copyPublic(base);await copyPublic(candidate);
  const file=path.join(candidate,'public-data/data/history.json'),history=JSON.parse(await fs.readFile(file,'utf8'));
  history.results.push([2027,history.people[0].i,'Morothon','20 km','DNF','DNF',0,'','','']);
  const bytes=Buffer.from(JSON.stringify(history));await fs.writeFile(file,bytes);
  const stale=await rewriteManifest(candidate,async m=>{m.dataVersion=2;m.files['data/history.json']={sha256:sha256(bytes),bytes:bytes.length};});
  await assert.rejects(()=>readApprovedPackage(path.join(candidate,'public-data'),{approval:stale,assetsRoot:candidate}),/Mismatched public history/);
  const fresh=await rewriteManifest(candidate,async m=>{m.historySha256=sha256(bytes);});
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head}),/approved outside/);
  const verified=await checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head,reviewedHeadSha:head,approvedManifestSha:fresh.manifestSha256});assert.equal(verified.approval.dataVersion,2);assert.equal(verified.approval.historySha256,sha256(bytes));
 }finally{await fs.rm(base,{recursive:true,force:true});await fs.rm(candidate,{recursive:true,force:true});}
});
