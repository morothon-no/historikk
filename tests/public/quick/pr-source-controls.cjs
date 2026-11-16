const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const control=require('../../../scripts/testing/pr-source.cjs');
const root=path.resolve(__dirname,'../../..');
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-pr-source-control-'));
 for(const file of control.files){await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),file.endsWith('.json')?'{}':'');}
 const history=await fs.readFile(path.join(dir,'public-data/data/history.json'));
 await fs.writeFile(path.join(dir,'approval.json'),JSON.stringify({historySha256:createHash('sha256').update(history).digest('hex')}));
 // These must never be materialized or exposed to the test child.
 await fs.mkdir(path.join(dir,'data'));await fs.writeFile(path.join(dir,'data/honors.json'),'synthetic-private-marker');
 await fs.mkdir(path.join(dir,'.git'));await fs.writeFile(path.join(dir,'.git/config'),'synthetic-credential-marker');
 return dir;
}
test('PR source control runs all four required tests on every level and reports the rest as unverified',()=>{
 const {coverage,tests}=control;
 assert.equal(tests.length,4);
 for(const name of ['organizer-domain','postgres-review-store','organizer-profiles','c24-review-workspace'])assert.ok(tests.includes('tests/'+name+'.cjs'));
 const report=coverage([...tests,'tests/future-source.cjs','tests/public/quick/example.cjs','tests/public-build.cjs']);
 assert.deepEqual(report.notVerifiedBeforeMerge,['tests/future-source.cjs']);
 assert.match(report.remainingControl,/Explicit trusted full source control required/);
 assert.throws(()=>coverage(tests.slice(1)),/Missing required/);
 assert.throws(()=>coverage([...tests,'tests/unsafe`name.cjs']),/Invalid source test inventory/);
});
test('PR source runner proves red then green with a synthetic failure and isolates data, Git and environment',async()=>{
 const dir=await fixture(),runner=path.join(root,'scripts/testing/pr-source.cjs');
 try{
  // CLI uses Git tree inventory in CI; for this synthetic fixture supply one
  // directly through the same protected run entry point, never a PR parameter.
  const invoke=()=>spawnSync(process.execPath,['-e',
   'require(process.argv[1]).run({root:process.argv[2],approvalFile:process.argv[2]+"/approval.json",reportFile:process.argv[2]+"/report.json",inventory:'+JSON.stringify(control.tests)+'}).catch(e=>{console.error(e.message);process.exitCode=1})',runner,dir],
   {encoding:'utf8',timeout:30000,env:{...process.env,MOROTHON_SYNTHETIC_SECRET:'must-not-reach-child',NODE_OPTIONS:''}});
  const first=path.join(dir,control.tests[0]);
  await fs.writeFile(first,"const {test}=require('node:test');test('deliberate synthetic failure',()=>{throw Error('expected-red-probe')});");
  const red=invoke();assert.equal(red.status,1,red.stderr);assert.match(red.stdout,/expected-red-probe/);
  const redReport=JSON.parse(await fs.readFile(path.join(dir,'report.json')));assert.equal(redReport.status,'not-verified');assert.deepEqual(redReport.verifiedBeforeMerge,[]);
  await fs.writeFile(first,`const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('snapshot and clean environment',()=>{
 assert.equal(process.env.MOROTHON_SYNTHETIC_SECRET,undefined);assert.equal(process.env.GITHUB_TOKEN,undefined);assert.equal(process.env.GITHUB_OUTPUT,undefined);assert.equal(process.env.NODE_OPTIONS,undefined);
 for(const p of ['data','.git','node_modules'])assert.equal(fs.existsSync(p),false);
 assert.equal(fs.existsSync(path.join(process.env.HOME,'.gitconfig')),false);
});`);
  const green=invoke();assert.equal(green.status,0,green.stdout+green.stderr);
  const greenReport=JSON.parse(await fs.readFile(path.join(dir,'report.json')));assert.equal(greenReport.status,'passed');assert.deepEqual(greenReport.verifiedBeforeMerge,control.tests);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('PR source dependencies fail closed on missing files, changed history and symlinks',async()=>{
 const dir=await fixture(),options={root:dir,approvalFile:path.join(dir,'approval.json'),inventory:control.tests};
 try{
  const dependency=path.join(dir,'scripts/organizers/profile.cjs');await fs.unlink(dependency);
  await assert.rejects(()=>control.run(options),/ENOENT/);await fs.writeFile(dependency,'');
  await fs.appendFile(path.join(dir,'public-data/data/history.json'),' ');
  await assert.rejects(()=>control.run(options),/approved public history/);
  await fs.writeFile(path.join(dir,'public-data/data/history.json'),'{}');
  await fs.unlink(dependency);await fs.symlink(path.join(dir,'data/honors.json'),dependency);
  await assert.rejects(()=>control.run(options),/Symlink/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('PR source job has zero token permissions, protected controls and no publishing capabilities',async()=>{
 const text=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
 const job=text.split('  pr_source_checks:')[1].split('  plan:')[0];
 assert.match(job,/name: Public-safe source regression/);assert.match(job,/permissions: \{\}/);
 assert.match(job,/if: always\(\) && github.event_name == 'pull_request'/);
 assert.match(job,/needs: plan/);assert.match(job,/test "\$PLAN_RESULT" = success/);
 assert.match(job,/policy-base\/scripts\/check-public-policy.cjs/);
 assert.match(job,/policy-base\/scripts\/testing\/run.cjs/);
 assert.match(job,/--scope pr-source --approval/);
 assert.match(job,/MOROTHON_REVIEWED_POLICY_HEAD/);
 assert.match(job,/--filter=blob:none/);assert.match(job,/sparse-checkout set --no-cone/);
 assert.doesNotMatch(job,/uses: actions\/checkout|secrets\.|npm ci|upload-artifact|environment:|pages: write|contents: write|id-token: write|continue-on-error/);
 const {critical}=require('../../../scripts/check-public-policy.cjs');assert.equal(critical('scripts/testing/pr-source.cjs'),true);
});
