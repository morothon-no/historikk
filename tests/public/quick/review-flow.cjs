const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {checkPolicy,policyChanges}=require('../../../scripts/check-public-policy.cjs');
const {discoverTests,publicFiles,sourceFiles}=require('../../../scripts/testing/catalog.cjs');
const {temp,copyPublic}=require('../../helpers/public-package.cjs');
test('ordinary code, tests, harness, dependencies and test commands need no manual policy-head approval',async()=>{
 const base=await temp(),candidate=await temp(),head='b'.repeat(40);
 try{
  await copyPublic(base);await copyPublic(candidate);
  for(const file of ['js/history-data.js','tests/data-quality.cjs','scripts/diploma-harness.cjs','scripts/review-public-export.cjs','package-lock.json'])await fs.appendFile(path.join(candidate,file),'\n');
  const pkg=JSON.parse(await fs.readFile(path.join(candidate,'package.json')));pkg.scripts.test='node -e "process.exit(0)"';pkg.devDependencies['synthetic-test-dependency']='0.0.0';
  await fs.writeFile(path.join(candidate,'package.json'),JSON.stringify(pkg));
  assert.deepEqual(await policyChanges(base,candidate),[]);
  const checked=await checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head});assert.equal(checked.securityReviewRequired,false);assert.equal(checked.visiblePeople,43);
 }finally{await fs.rm(base,{recursive:true,force:true});await fs.rm(candidate,{recursive:true,force:true});}
});
test('publication scripts and lifecycle hooks remain protected while ordinary npm metadata is reviewed normally',async()=>{
 const base=await temp(),candidate=await temp(),head='c'.repeat(40);
 try{
  await copyPublic(base);await copyPublic(candidate);const original=JSON.parse(await fs.readFile(path.join(candidate,'package.json')));
  for(const key of ['build','public:kontroll','data:export','data:check-sources','prebuild','postbuild','prepublic:kontroll','postdata:export']){
   const pkg=structuredClone(original);pkg.scripts[key]='node -e "process.exit(0)"';await fs.writeFile(path.join(candidate,'package.json'),JSON.stringify(pkg));
   await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head}),/exact PR head/);
  }
  await fs.writeFile(path.join(candidate,'package.json'),'{');await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:head}));
 }finally{await fs.rm(base,{recursive:true,force:true});await fs.rm(candidate,{recursive:true,force:true});}
});
test('security-export changes remain detectable by tree ID without exposing excluded source files to a public checkout',async()=>{
 const base=await temp(),candidate=await temp(),file='scripts/lib/public-data.cjs';
 const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  await copyPublic(base);await copyPublic(candidate);
  for(const [dir,text]of [[base,'synthetic baseline'],[candidate,'synthetic changed export']]){
   await fs.writeFile(path.join(dir,file),text);git(dir,'init');git(dir,'config','user.email','test@example.invalid');git(dir,'config','user.name','Synthetic');git(dir,'add','.');git(dir,'commit','-m','fixture');await fs.unlink(path.join(dir,file));
  }
  assert.ok((await policyChanges(base,candidate,{requireGit:true})).includes(file));
  await assert.rejects(()=>checkPolicy({baseRoot:base,candidateRoot:candidate,headSha:git(candidate,'rev-parse','HEAD'),requireGit:true}),/exact PR head/);
  for(const dir of [base,candidate])await assert.rejects(()=>fs.access(path.join(dir,file)));
 }finally{await fs.rm(base,{recursive:true,force:true});await fs.rm(candidate,{recursive:true,force:true});}
});
test('new public tests join their tier and full coverage automatically, without workflow or catalog edits',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-new-public-tests-'));
 try{
  for(const level of ['quick','functional','visual','full']){await fs.mkdir(path.join(root,'tests/public',level),{recursive:true});await fs.writeFile(path.join(root,'tests/public',level,'example.cjs'),'// synthetic');}
  const {all,extras}=await discoverTests(root);assert.equal(all.length,4);assert.equal(publicFiles('quick',extras).filter(f=>all.includes(f)).length,1);assert.equal(publicFiles('visual',extras).filter(f=>all.includes(f)).length,3);
  assert.deepEqual(sourceFiles('full',all,extras),[]);assert.ok(all.every(f=>publicFiles('full',extras).includes(f)));
  await fs.symlink(path.join(root,'tests/public/quick/example.cjs'),path.join(root,'tests/public/quick/linked.cjs'));await assert.rejects(()=>discoverTests(root),/Symlink/);await fs.unlink(path.join(root,'tests/public/quick/linked.cjs'));
  await fs.mkdir(path.join(root,'tests/public/unknown'));await assert.rejects(()=>discoverTests(root),/Unknown/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
