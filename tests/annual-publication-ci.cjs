'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),
 {temp,copyPublic}=require('./helpers/public-package.cjs'),A=require('../scripts/admin/annual-result-import.cjs'),Candidate=require('../scripts/admin/annual-result-candidate.cjs'),
 C=require('../tools/diploma-admin/intake-model.js').Corrections,D=require('../tools/diploma-admin/result-release-data.cjs'),{releaseFiles,PATHS}=require('../scripts/admin/result-release.cjs');
const execute=promisify(execFile),root=path.resolve(__dirname,'..');
test('a real isolated public CI package accepts a server-derived synthetic new year while historical oracles and changed honor-print approval remain protected',{timeout:180000},async()=>{
 const dir=await temp();try{
  await copyPublic(dir);await fs.symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
  const files=new Map(await Promise.all(PATHS.map(async p=>[p,await fs.readFile(path.join(root,p))]))),history=JSON.parse(files.get('data/history.json')),approval=JSON.parse(files.get('.github/public-data-approval.json')),
   base=await C.binding(history,{dataVersion:approval.dataVersion,manifestSha256:approval.manifestSha256,historySha256:approval.historySha256}),year=Math.max(...history.yearStats.map(s=>s[0]))+1,
   ctx={organizer:'sogne-morothon',personIdPrefix:'MOR-',history,base,profile:require('../web-admin/event-profile.json'),registry:require('../public-data/data/badges.json')},
   input=A.request({organizer:ctx.organizer,base,year,completeClaim:true,text:'Navn;Øvelse;Distanse;Kjønn;Status;Tid\nSyntetisk Årskontroll Eksempel;Morothon;20 km;Dame;DNF;DNF'}),initial=await A.prepare(ctx,input);
  assert.equal(initial.identityTasks.length,1);input.decisions=[{rowId:initial.identityTasks[0].rowId,basis:initial.interpretationSha256,action:'new-person',runnerId:null,targetIndex:null,personKey:'synthetic-ci-'+year,confirmDistinct:false,reason:'Bare syntetisk testperson.'}];
  const plan=await A.prepare(ctx,input),candidate=await Candidate.candidate(ctx,input,plan),release=releaseFiles({files,after:candidate.result.history},D.appendAnnualPublication);
  for(const [name,b]of release.files){if(name==='data/history.json')continue;const dest=path.join(dir,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,b);}
  const site=path.join(dir,'tested-site');await require(path.join(dir,'scripts/build-site.cjs')).buildSite(site);const env={PATH:process.env.PATH,LANG:'C.UTF-8',MOROTHON_TEST_SITE:site,...(process.env.CHROMIUM_PATH?{CHROMIUM_PATH:process.env.CHROMIUM_PATH}:{})};
  const run=async args=>{try{const {stdout}=await execute(process.execPath,args,{cwd:dir,env,timeout:120000,maxBuffer:4*1024*1024});assert.match(stdout,/# pass [1-9][0-9]*/);assert.match(stdout,/# fail 0(?:\n|\r|$)/);}catch(e){throw Error('Synthetic annual CI failed: '+args.join(' ')+'\n'+(e.stdout||'')+'\n'+(e.stderr||''));}};
  await run(['scripts/testing/run.cjs','--level','quick','--scope','public']);
  await run(['--test','--test-reporter=tap','--test-concurrency=2','--test-name-pattern=isolated public build|annual milestones: 2026 control totals|Enny-Karin correction|A2 historical organizer-retained completion|C1.1 portal derives|C1.1 all portal APIs|C1.2 static Pages portal works','tests/public-browser.cjs','tests/regression.cjs','tests/data-quality-browser.cjs','tests/public/visual/admin-portal.cjs','tests/public/visual/web-admin.cjs']);
  const h=await require('../scripts/diploma-harness.cjs').createHarness({rootDir:site});try{
   const page=await h.browser.newPage({viewport:{width:390,height:1000}});await page.goto(h.base);await page.waitForFunction(()=>!document.querySelector('#loading'));
   const live=await page.evaluate(id=>{openProfile(id);return {latest:S.lastYear,chart:+document.querySelector('.bar').dataset.year,
    count:person(id).c,years:startedYears(person(id)),rows:resultsFor(id),text:document.querySelector('#profile').textContent,
    overflow:document.documentElement.scrollWidth>innerWidth};},plan.newPeople[0].i);
   assert.equal(live.latest,year);assert.equal(live.chart,year);assert.equal(live.count,1);assert.deepEqual(live.years,[year]);
   assert.deepEqual(live.rows,[candidate.result.history.results.at(-1)]);assert.match(live.text,/DNF/);assert.equal(live.overflow,false);
  }finally{await h.close();}
  for(const p of PATHS)assert.deepEqual(await fs.readFile(path.join(root,p)),files.get(p),'real source files remain byte-identical');
  for(const p of ['data/honors.json','data/volunteers.json','.git'])await assert.rejects(fs.access(path.join(dir,p)));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
