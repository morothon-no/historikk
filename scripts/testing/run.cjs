// Portable test entry point. Never trusts a PR-generated list of files or arbitrary commands.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {levels,publicFiles,sourceFiles,discoverTests}=require('./catalog.cjs');
async function run({root=path.resolve(__dirname,'../..'),level='full',scope='public'}={}){
 if(!levels.includes(level)||!['public','source','all'].includes(scope))throw Error('Invalid test level/scope');
 root=path.resolve(root);const {all,extras}=await discoverTests(root);
 const files=scope==='all'?(level==='full'?all:[...publicFiles(level,extras),...sourceFiles(level,all,extras)]):scope==='source'?sourceFiles(level,all,extras):publicFiles(level,extras);
 const required=scope==='all'?[...new Set([...files,...publicFiles(level,extras)])]:files;
 for(const f of required)if(!all.includes(f))throw Error('Missing required test: '+f);
 const execute=(args,env=process.env)=>{
  const p=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});
  if(p.error)throw p.error;if(p.status!==0)throw Error('Required test/check failed ('+(p.signal||p.status)+'): '+args.join(' '));
 };
 const start=performance.now();let site,temporarySite=false;
 try{
  if(scope!=='public'){
   await fs.access(path.join(root,'data/honors.json'));
   execute(['scripts/check-source-export.cjs']);execute(['scripts/review-runner-links.cjs']);
  }
  let env={...process.env};
  if(scope==='public'&&level!=='quick'){
   const {buildSite,validatePublicSite}=require(path.join(root,'scripts/build-site.cjs'));
   if(env.MOROTHON_TEST_SITE){site=path.resolve(env.MOROTHON_TEST_SITE);await validatePublicSite(site);}
   else{site=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-tested-public-'));temporarySite=true;await buildSite(site);}
   env.MOROTHON_TEST_SITE=site;
  }
  if(files.length)execute(['--test','--test-reporter=tap',...files],env);
  const report={level,scope,files,seconds:(performance.now()-start)/1000};console.log(JSON.stringify(report));return report;
 }finally{if(temporarySite)await fs.rm(site,{recursive:true,force:true});}
}
module.exports={run};
if(require.main===module){
 const flags=process.argv.slice(2);if(flags.length%2||flags.some((f,i)=>i%2===0&&!['--level','--scope','--root'].includes(f)))throw Error('Use --level quick|functional|visual|full --scope public|source|all [--root path]');
 const options=Object.fromEntries(Array.from({length:flags.length/2},(_,i)=>[flags[i*2].slice(2),flags[i*2+1]]));
 run(options).catch(e=>{console.error(e.message);process.exitCode=1;});
}
