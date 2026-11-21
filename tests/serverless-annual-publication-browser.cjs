'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright'),
 {setup}=require('./helpers/annual-serverless.cjs'),{buildSite}=require('../scripts/build-site.cjs'),{approvedRuntime,createProjector}=require('../scripts/admin/review-runtime.cjs'),
 {buildProtectedAdmin}=require('../scripts/build-protected-admin.cjs'),{ADMIN_SOURCES}=require('../scripts/lib/runtime-files.cjs'),{createAdminGateway}=require('../scripts/admin/serverless/admin-gateway.cjs'),
 {createDeploymentVerifier}=require('../scripts/admin/deployment-verifier.cjs');
test('annual web workflow checks actual calculations, explicitly approves, verifies public profiles and reverses a synthetic 2027 year on desktop/tablet/mobile',{timeout:120000},async t=>{
 const f=await setup(t,{publication:true}),dir=path.join(f.directory,'web'),original=structuredClone(f.context.history),root=path.resolve(__dirname,'..'),production=await fs.readFile(path.join(root,'public-data/data/history.json'));
 let buildNumber=0;
 async function runtime(){const pkg=path.join(dir,'package-'+(++buildNumber)),approval=path.join(dir,'approval-'+buildNumber+'.json');await fs.mkdir(path.join(pkg,'data'),{recursive:true});
  for(const n of ['history','honors','volunteers','badges','event-dates'])await fs.writeFile(path.join(pkg,'data',n+'.json'),f.repository.files.get('public-data/data/'+n+'.json'));
  await fs.writeFile(path.join(pkg,'manifest.json'),f.repository.files.get('public-data/manifest.json'));await fs.writeFile(approval,f.repository.files.get('.github/public-data-approval.json'));
  const built=await buildSite(path.join(dir,'site-'+buildNumber),{dataDir:pkg,approvalFile:approval});return approvedRuntime(built.out,approval);
 }
 const initial=await runtime();Object.assign(f.context,initial);const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 // The small synthetic race history is not evidence for the real register's
 // existing presentation approvals. Keep those out of the projection fixture.
 const projectionRuntime={...initial,files:new Map(initial.files)},honors=JSON.parse(initial.files.get('data/honors.json'));honors.presentationPrintSet.entries=[];
 projectionRuntime.files.set('data/honors.json',Buffer.from(JSON.stringify(honors)));
 const projector=await createProjector(projectionRuntime,{browser});f.context.project=projector.project;assert.equal(Object.keys((await projector.project(original,{includeHonors:true})).honors).length,86);
 let lastVerified=null;
 f.state.publicationOptions={checkBuild:undefined,verifyLive:async job=>{
   const next=await runtime(),verify=createDeploymentVerifier({verifyProfiles:projector.verifyProfiles,fetchImpl:async url=>{const u=new URL(url),bytes=next.files.get(u.pathname.slice(new URL(job.build.siteUrl).pathname.length)||'index.html');return new Response(bytes||'Not found',{status:bytes?200:404});}});
   try{lastVerified=await verify(job);return lastVerified;}catch(e){throw Error('Synthetic live verification: '+(e.cause?.message||e.message));}
 }};
 const worker=path.join(dir,'worker');await buildProtectedAdmin(worker);const files=new Map(initial.files);
 for(const name of Object.keys(ADMIN_SOURCES)){let b=await fs.readFile(path.join(worker,name));if(name==='admin/index.html')b=Buffer.from(b.toString().replace('https://morothon-admin.damofra75.workers.dev',f.origin));files.set(name,b);}
 const gateway=createAdminGateway({portalOrigin:f.origin,apiOrigin:f.origin,auth:f.auth,assetSource:async name=>files.has('admin/'+name)?{bytes:files.get('admin/'+name)}:null}),{sameOriginBrokerRead}=await import('../scripts/admin/serverless/worker.mjs');
 let pending=Promise.resolve();f.state.afterDispatch=()=>{pending=pending.then(()=>f.processNext());};const errors=[];
 async function open(width){const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());const session=await f.login();
  await context.addCookies([{name:'__Host-morothon-admin',value:session,url:f.origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());if(url.origin!==f.origin)return route.abort();const headers=await r.allHeaders();
   if(!r.isNavigationRequest()&&new URL(r.frame().url()).origin===f.origin){if(!headers.origin)headers['sec-fetch-site']='same-origin';if(r.method()==='POST'&&!headers.origin)headers.origin=f.origin;}
   const req=new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})});let response;
   if(url.pathname.startsWith('/admin/'))response=await gateway(req);
   else if(url.pathname.startsWith('/site/')){const b=files.get(url.pathname.slice(6)||'index.html');return route.fulfill({status:b?200:404,body:b||'Not found',contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.ico':'image/x-icon'})[path.extname(url.pathname)]||'application/octet-stream'});}
   else response=await f.broker.fetch(sameOriginBrokerRead(req,f.origin));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(f.origin+'/admin/#import');await page.waitForFunction(()=>document.body.dataset.adminReady==='true');await page.selectOption('#annualImportKind','results');await page.locator('#annualPrivate:not([hidden])').waitFor();return {page,context,session};
 }
 async function action(page,id,route){const r=page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.request().method()==='POST');await page.click('#'+id);assert.equal((await r).status(),202);await pending;await page.waitForFunction(()=>!document.querySelector('#annualRefresh').disabled);const v=await f.request('/annual-import',undefined,session);assert.notEqual(v.body.task?.state,'failed',JSON.stringify(v.body.task));return v.body;}
 let {page,context,session}=await open(1440);
 await page.setInputFiles('#resultFile',{name:'synthetic-2027.csv',mimeType:'text/csv',buffer:Buffer.from(f.csv())});await page.waitForFunction(()=>document.querySelector('#resultSummary').textContent.includes('3 leste resultater'));
 await page.locator('#resultComplete').check();await page.waitForFunction(()=>document.querySelector('#resultSummary').textContent.includes('3 leste resultater'));
 const existing=page.locator('.result-case').filter({has:page.getByRole('heading',{name:'Syntetisk Kari Nord',exact:true})});await existing.getByLabel('Person for Syntetisk Kari Nord',{exact:true}).selectOption('MOR-C220001');await existing.getByRole('button',{name:'Bekreft resultatkoblingen',exact:true}).click();
 const fresh=page.locator('.result-case').filter({has:page.getByRole('heading',{name:'Syntetisk Ny Eksempel',exact:true})});await fresh.getByRole('textbox',{name:'Begrunnelse for Syntetisk Ny Eksempel'}).fill('Bekreftet syntetisk testidentitet.');await fresh.getByRole('button',{name:'Marker som ny person',exact:true}).click();

 await action(page,'annualPreview','/annual-import/preview');await action(page,'annualSave','/annual-import/save');
 let v=await action(page,'annualPublicationCheck','/annual-import/publication/check');assert.equal(v.publication.review.ready,true);assert.ok(v.publication.review.effects.annual);assert.ok(v.publication.review.effects.people);assert.ok(v.publication.review.effects.honors);assert.equal(f.remote.merged,0);
 // A previous completed job is history, never the status of a new import.
 const projection=await f.annualRequests.get('publication-sogne-morothon');await f.annualRequests.transact('publication-sogne-morothon',projection.revision,p=>({...p,revision:p.revision+1,job:{id:'0'.repeat(64),stage:'published',dataVersion:1}}));
 const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/annual-import'&&r.request().method()==='GET');await page.click('#annualRefresh');await refreshed;await page.waitForFunction(()=>!document.querySelector('#annualRefresh').disabled);assert.match(await page.locator('#annualPrivateStatus').innerText(),/^Serverkontrollert/);
 assert.match(await page.locator('#annualPublicationReport').innerText(),/Forrige publisering/);assert.doesNotMatch(await page.locator('#annualPrivateStatus').innerText(),/^Publisert/);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.MOROTHON_P1A_REVIEW_DIR){await fs.mkdir(process.env.MOROTHON_P1A_REVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MOROTHON_P1A_REVIEW_DIR,'annual-publication-'+width+'.png'),fullPage:true});}}
 v=await action(page,'annualPublicationApprove','/annual-import/publication/approve');assert.equal(v.status,'review-approved');assert.equal(f.remote.submitted,0);
 await f.request('/logout',{},session);await context.close();f.restart();({page,context,session}=await open(390));await page.locator('#annualPublicationPublish:enabled').waitFor();
 f.remote.checks='success';f.remote.deploy='success';v=await action(page,'annualPublicationPublish','/annual-import/publication/publish');assert.equal(v.publication.job.stage,'published');assert.ok(lastVerified);assert.equal(f.remote.merged,1);
 const after=await projector.project(f.context.history),before=await projector.project(original);assert.notDeepEqual(after.annual,before.annual);const newId=f.context.history.people.at(-1).i;assert.equal(after.people[newId].count,1);assert.deepEqual(after.people[newId].years,[2027]);assert.equal(f.context.history.results.at(-1)[4],'DNF');assert.equal(f.context.history.results.at(-1)[5],'');
 // The real profile verifier must reject a substituted/old dataset too.
 await assert.rejects(projector.verifyProfiles({siteUrl:'https://synthetic.invalid/',files:initial.files,history:f.context.history,personIds:[original.people[0].i],changes:[] }));
 const reverse=page.locator('#annualPublicationHistory button').first(),response=page.waitForResponse(r=>new URL(r.url()).pathname==='/annual-import/publication/reverse');await reverse.click();assert.equal((await response).status(),202);await pending;await page.waitForFunction(()=>!document.querySelector('#annualRefresh').disabled);
 v=(await f.request('/annual-import',undefined,session)).body;assert.equal(v.publication.review.operation,'reverse');await action(page,'annualPublicationApprove','/annual-import/publication/approve');
 v=await action(page,'annualPublicationPublish','/annual-import/publication/publish');assert.equal(v.publication.job.stage,'published');assert.deepEqual(f.context.history,original);assert.equal(f.remote.merged,2);
 assert.deepEqual(errors,[]);assert.deepEqual(await fs.readFile(path.join(root,'public-data/data/history.json')),production);
});
