// Reproduce the workflow's real file boundary, rather than a full working copy.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {discoverTests}=require('../../../scripts/testing/catalog.cjs');
const root=path.resolve(__dirname,'../../..'),fixture='tests/public/quick/fixtures/intake-data.js';
test('public sparse checkout and recursively isolated packages retain synthetic JS/JSON fixtures without private source access',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-public-fixtures-')),sparse=path.join(dir,'sparse'),nested=path.join(dir,'nested');
 try{
  await fs.mkdir(sparse);const workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
  const blocks=[...workflow.matchAll(/name: Checkout public files only[^\n]*\n[\s\S]*?sparse-checkout: \|\n((?: {12}\/[^\n]+\n)+)/g)];assert.ok(blocks.length>=1,'Read the actual workflow sparse inventory');
  const paths=blocks[0][1].trim().split('\n').map(s=>s.trim());for(const block of blocks)assert.deepEqual(block[1].trim().split('\n').map(s=>s.trim()),paths);
  for(const item of paths){const relative=item.slice(1).replace(/\/$/,''),src=path.join(root,relative),dest=path.join(sparse,relative);assert.ok(relative&&!relative.includes('..'));let stat;try{stat=await fs.lstat(src);}catch(e){if(e.code==='ENOENT')continue;throw e;}assert.equal(stat.isSymbolicLink(),false);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(src,dest,{recursive:stat.isDirectory()});}
  for(const dir of [sparse])for(const file of ['data/honors.json','data/volunteers.json','scripts/export-public-data.cjs','tests/helpers/intake-data.js'])await assert.rejects(()=>fs.access(path.join(dir,file)),{code:'ENOENT'});
  for(const resource of [fixture,'tests/public/quick/fixtures/emit-data.js'])assert.deepEqual(await fs.readFile(path.join(sparse,resource)),await fs.readFile(path.join(root,resource)));
  const discovered=await discoverTests(sparse);assert.equal(discovered.all.includes(fixture),false,'Support JS must not be executed as another test');
  const runIntake=cwd=>execFileSync(process.execPath,['--test','tests/public/quick/intake.cjs'],{cwd,env:{PATH:process.env.PATH,LANG:'C.UTF-8'},encoding:'utf8',timeout:60000});
  assert.match(runIntake(sparse),/C2\.1a/);
  // Both CSV and XML/browser suites must resolve the helper in the sparse tree.
  assert.equal(require.resolve('../quick/fixtures/intake-data.js',{paths:[path.join(sparse,'tests/public/visual')]}),path.join(sparse,fixture));
  const resource='tests/public/quick/fixtures/synthetic-resource.json';await fs.writeFile(path.join(sparse,resource),' {"synthetic":true}\n');
  await require(path.join(sparse,'tests/helpers/public-package.cjs')).copyPublic(nested);
  for(const resource of [fixture,'tests/public/quick/fixtures/emit-data.js'])assert.deepEqual(await fs.readFile(path.join(nested,resource)),await fs.readFile(path.join(root,resource)));assert.match(runIntake(nested),/C2\.1a/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(nested,resource))),{synthetic:true});
  for(const file of ['data/honors.json','data/volunteers.json','scripts/export-public-data.cjs','tests/helpers/intake-data.js'])await assert.rejects(()=>fs.access(path.join(nested,file)),{code:'ENOENT'});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
