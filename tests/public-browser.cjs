const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createHarness}=require('../scripts/diploma-harness.cjs');
const {temp,copyPublic}=require('./helpers/public-package.cjs');
const root=path.resolve(__dirname,'..');
test('isolated public build and existing site test need no administrative files, exporter, Git history or private credentials',async()=>{
 const dir=await temp();let h;try{await copyPublic(dir);execFileSync(process.execPath,['scripts/testing/run.cjs','--level','quick','--scope','public'],{cwd:dir,env:{PATH:process.env.PATH,LANG:'C.UTF-8'},stdio:'pipe',timeout:120000});await fs.symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
  for(const f of ['data/honors.json','data/volunteers.json','scripts/export-public-data.cjs','scripts/lib/public-data.cjs','.git'])await assert.rejects(()=>fs.access(path.join(dir,f)));
  const out=path.join(dir,'site');await fs.mkdir(out);const permissions=['--permission','--allow-fs-read='+dir,'--allow-fs-write='+out],env={PATH:process.env.PATH,LANG:'C.UTF-8'};
  const result=JSON.parse(execFileSync(process.execPath,[...permissions,'scripts/build-site.cjs',out],{cwd:dir,env,encoding:'utf8'}));assert.equal(result.files,59);
  assert.throws(()=>execFileSync(process.execPath,[...permissions,'-e',`require('node:fs').readFileSync(${JSON.stringify(path.join(root,'data/honors.json'))})`],{cwd:dir,env,stdio:'pipe'}),e=>/ERR_ACCESS_DENIED/.test(e.stderr.toString()));
  execFileSync('npm',['run','build','--',path.join(dir,'npm-site')],{cwd:dir,env,stdio:'pipe',timeout:120000});
  execFileSync(process.execPath,['scripts/check-public-site.cjs',out],{cwd:dir,env,stdio:'pipe'});
  h=await createHarness({rootDir:out});const p=await h.browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();const ref=JSON.parse(await fs.readFile(path.join(dir,'tests/fixtures/a1c-public-reference.json'),'utf8'));
  for(const width of [390,1440]){await p.setViewportSize({width,height:900});assert.deepEqual(await p.locator('[data-honoree]').evaluateAll(nodes=>nodes.map(n=>n.dataset.honoree)),ref.ids);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  const actual=await p.evaluate(async()=>{const data=await MorothonHonorsData.load(),all=[];for(const m of data.groups.flatMap(g=>g.members))for(const display of ['all','latest']){const d=await MorothonDiplomas.serviceDraft(m.id,display);all.push({id:m.id,display,proof:d.contentProof,mode:d.printMode,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,date:d.dateLabel,title:d.title,tribute:d.tribute});}return all;});
  assert.deepEqual(actual,ref.diplomas);assert.equal(actual.length,86);
  await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));const counts=await p.evaluate(async()=>{const h=await MorothonHistoryData.load();return [h.data.people.length,h.data.results.length,h.data.teamResults.length];});assert.deepEqual(counts,[2643,6914,4]);assert.deepEqual(errors,[]);
 }finally{if(h)await h.close();await fs.rm(dir,{recursive:true,force:true});}
});
