const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {classify,gitChanges,plan,protectedTest}=require('../scripts/testing/plan.cjs');
const {publicFiles,sourceFiles,requirements}=require('../scripts/testing/catalog.cjs');
test('B1 selects cumulative levels conservatively, with no documentation override for code/data changes',()=>{
 for(const files of [['README.md'],['docs/help.md','docs/metrics.json']])assert.equal(classify(files).level,'quick');
 assert.equal(classify(['docs/a.md','js/progress.js']).level,'functional');
 assert.equal(classify(['css/honors.css']).level,'visual');
 for(const p of ['data/honors.json','public-data/data/history.json','js/history-data.js','js/honors-data.js','js/diplomas.js','css/diplomas.css','assets/fonts/new.woff','package.json','.github/workflows/pages.yml','scripts/testing/catalog.cjs','tests/new.cjs','new/file.js','docs/probe.cjs'])assert.equal(classify(['docs/a.md',p]).level,'full',p);
 for(const input of [null,[],['../README.md'],['/README.md'],['docs\\x.md']])assert.equal(classify(input).level,'full');
 assert.equal(classify(['README.md'],{forceFull:true}).level,'full');
});
test('B1 public/source full partitions every existing test exactly once; no declared test disappears',async()=>{
 const all=(await fs.readdir(path.join(__dirname))).filter(f=>f.endsWith('.cjs')).map(f=>'tests/'+f).sort();
 const pub=publicFiles('full'),source=sourceFiles('full',all);assert.equal(new Set([...pub,...source]).size,all.length);assert.deepEqual([...pub,...source].sort(),all);
 for(const f of publicFiles('quick'))assert.ok(publicFiles('functional').includes(f));for(const f of publicFiles('functional'))assert.ok(publicFiles('visual').includes(f));
 assert.deepEqual(sourceFiles('full',[...all,'tests/future.cjs']).at(-1),'tests/future.cjs');
});
test('B1 quick has no browser/PDF/Python requirement; known integration and print levels declare their tools',()=>{
 assert.deepEqual(requirements('quick','public'),{browser:false,pdf:false,python:false});assert.deepEqual(requirements('quick','source'),{browser:false,pdf:false,python:false});
 assert.deepEqual(requirements('functional','public'),{browser:true,pdf:false,python:false});assert.deepEqual(requirements('visual','public'),{browser:true,pdf:true,python:false});assert.equal(requirements('full','source').python,true);
 assert.throws(()=>requirements('untrusted','public'),/Unknown/);
});
test('B1 rename, deletion and unavailable Git range never lower test coverage; test edits require external head review',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-plan-fixture-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init');git('config','user.email','test@example.invalid');git('config','user.name','Synthetic');
  await fs.mkdir(path.join(dir,'docs'));await fs.mkdir(path.join(dir,'tests'));await fs.writeFile(path.join(dir,'docs/a.md'),'a');await fs.writeFile(path.join(dir,'tests/one.cjs'),'synthetic');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
  git('mv','docs/a.md','unknown.file');await fs.writeFile(path.join(dir,'tests/one.cjs'),'changed');git('add','.');git('commit','-m','head');const head=git('rev-parse','HEAD');
  const changed=await gitChanges(dir,base,head);assert.ok(changed.includes('docs/a.md'));assert.ok(changed.includes('unknown.file'));assert.equal(classify(changed).level,'full');
  await assert.rejects(()=>plan({root:dir,base,head,checkReview:true}),/exact PR head/);
  assert.equal((await plan({root:dir,base,head,checkReview:true,reviewedHead:head})).level,'full');
  assert.equal((await plan({root:dir,base:'0'.repeat(40),head})).level,'full');
  await assert.rejects(()=>plan({root:dir,base:'0'.repeat(40),head,checkReview:true}),/maintainer head review/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
 for(const f of ['tests/new.cjs','scripts/testing/run.cjs','scripts/diploma-harness.cjs'])assert.equal(protectedTest(f),true);
});
test('B1 missing required tests or an invalid scope fail closed before any test command runs',async()=>{
 const {run}=require('../scripts/testing/run.cjs'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-missing-tests-'));
 try{await fs.mkdir(path.join(dir,'tests'));await assert.rejects(()=>run({root:dir,scope:'public',level:'quick'}),/Missing required test/);await assert.rejects(()=>run({root:dir,scope:'skip',level:'quick'}),/Invalid/);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('B1 CI plans before PR code, installs only required tools, keeps independent gate and never deploys around failures',async()=>{
 const workflow=await fs.readFile(path.resolve(__dirname,'../.github/workflows/pages.yml'),'utf8');
 const planner=workflow.split('  plan:')[1].split('  verify:')[0],verify=workflow.split('  verify:')[1].split('  artifact_gate:')[0],gate=workflow.split('  artifact_gate:')[1].split('  source_checks:')[0],source=workflow.split('  source_checks:')[1].split('  deploy:')[0],deploy=workflow.split('  deploy:')[1];
 assert.match(planner,/policy-base\/scripts\/testing\/plan.cjs/);assert.match(verify,/needs: plan/);assert.match(source,/needs: plan/);
 assert.match(planner,/if: github.event_name == 'pull_request' \|\| github.ref == 'refs\/heads\/main'/);
 assert.match(verify,/policy-base\/scripts\/testing\/run.cjs/);assert.match(verify,/public_browser == 'true'/);assert.match(verify,/public_pdf == 'true'/);assert.match(source,/source_python == 'true'/);
 assert.match(gate,/policy-base\/scripts\/check-public-site.cjs/);assert.match(gate,/needs: verify/);assert.match(deploy,/needs: \[artifact_gate, source_checks\]/);
 assert.doesNotMatch(workflow,/continue-on-error|pull_request_target|paths-ignore/);assert.doesNotMatch(deploy,/always\(/);
 assert.match(verify,/if: always\(\)/);assert.match(verify,/PLAN_RESULT: \$\{\{ needs.plan.result \}\}/);
 assert.ok(verify.indexOf('Require successful trusted plan')<verify.indexOf('Checkout public files'));
 for(const status of ['failure','cancelled','skipped'])assert.throws(()=>execFileSync('bash',['-c','test "$PLAN_RESULT" = success'],{env:{...process.env,PLAN_RESULT:status},stdio:'pipe'}));
 execFileSync('bash',['-c','test "$PLAN_RESULT" = success'],{env:{...process.env,PLAN_RESULT:'success'},stdio:'pipe'});
 assert.match(source,/if: github.ref == 'refs\/heads\/main' && github.event_name != 'pull_request'/);
 assert.equal((source.match(/if: inputs.historical_reports == true/g)||[]).length,5);
 assert.ok(!planner.includes('npm ci'));assert.ok(!gate.includes('npm ci'));
});
