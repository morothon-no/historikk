// Protected control: execute from base/main, never from an unreviewed PR.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync,execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {publicFiles}=require('./catalog.cjs');
const tests=Object.freeze([
 'tests/organizer-domain.cjs','tests/postgres-review-store.cjs',
 'tests/organizer-profiles.cjs','tests/c24-review-workspace.cjs'
]);
// Exact dependencies only. No administrative registers, DB drivers, npm hooks,
// credentials, original exports or source-data helpers belong in this snapshot.
const files=Object.freeze([...tests,
 'scripts/organizers/domain-model.cjs','scripts/organizers/profile.cjs',
 'scripts/admin/release-plan.cjs','scripts/admin/postgres-review-store.cjs',
 'scripts/admin/review-workspace.cjs','scripts/admin/storage.cjs','scripts/admin/common.cjs',
 'tools/diploma-admin/intake-model.js','js/history-data.js',
 'organizers/morothon/profile.json','tests/public/quick/fixtures/corrections-data.js',
 'public-data/data/history.json'
]);
async function readRegular(root,file){
 if(await fs.realpath(root)!==path.resolve(root))throw Error('Symlinked source root');
 let current=root;
 for(const segment of file.split('/')){
  current=path.join(current,segment);
  if((await fs.lstat(current)).isSymbolicLink())throw Error('Symlink in PR source dependency: '+file);
 }
 if(!(await fs.stat(current)).isFile())throw Error('Missing regular PR source dependency: '+file);
 return fs.readFile(current);
}
function coverage(inventory){
 if(!Array.isArray(inventory)||inventory.some(f=>typeof f!=='string'||!/^tests\/[a-zA-Z0-9._/-]+$/.test(f)))throw Error('Invalid source test inventory');
 const pub=new Set(publicFiles('full'));
 const source=inventory.filter(f=>/^tests\/[^/]+\.cjs$/.test(f)&&!pub.has(f));
 for(const file of tests)if(!source.includes(file))throw Error('Missing required PR source test: '+file);
 return {requiredBeforeMerge:[...tests],notVerifiedBeforeMerge:source.filter(f=>!tests.includes(f)).sort(),
  remainingControl:'Explicit trusted full source control required; a green PR is not a pass for these tests. Main retains its source regression deploy gate.'};
}
async function run({root,approvalFile,reportFile,inventory}={}){
 root=path.resolve(root);if(!approvalFile)throw Error('Trusted accepted approval is required');
 // Approval is produced by the base guard before any candidate code runs.
 const approval=JSON.parse(await fs.readFile(approvalFile,'utf8'));
 const history=await readRegular(root,'public-data/data/history.json');
 if(!/^[a-f0-9]{64}$/.test(approval.historySha256||'')||createHash('sha256').update(history).digest('hex')!==approval.historySha256)throw Error('PR source history is not the approved public history');
 inventory??=execFileSync('git',['-C',root,'ls-tree','-r','--name-only','-z','HEAD','--','tests'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const report={schemaVersion:1,...coverage(inventory),verifiedBeforeMerge:[],status:'not-verified'};
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-pr-source-'));
 try{
  const snapshot=path.join(temp,'snapshot'),home=path.join(temp,'home'),scratch=path.join(temp,'tmp');
  await fs.mkdir(home);await fs.mkdir(scratch);
  for(const file of files){const target=path.join(snapshot,file);const bytes=await readRegular(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
  // No .git metadata, node_modules, environment secrets, GitHub command files,
  // NODE_OPTIONS/NODE_PATH, cloud credentials, cache or deploy artifacts.
  const env={PATH:process.env.PATH,HOME:home,TMPDIR:scratch,TMP:scratch,TEMP:scratch,LANG:'C.UTF-8',TZ:'UTC'};
  const child=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:snapshot,env,stdio:'inherit',timeout:120000});
  if(child.error)throw child.error;
  if(child.status!==0)throw Error('Required PR source tests failed ('+(child.signal||child.status)+')');
  report.status='passed';report.verifiedBeforeMerge=[...tests];return report;
 }finally{
  // Report only controls the review summary; never consumed by deployment.
  if(reportFile)await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));await fs.rm(temp,{recursive:true,force:true});
 }
}
module.exports={tests,files,coverage,readRegular,run};
if(require.main===module){const [root,approvalFile,reportFile]=process.argv.slice(2);run({root,approvalFile,reportFile}).catch(e=>{console.error(e.message);process.exitCode=1;});}
