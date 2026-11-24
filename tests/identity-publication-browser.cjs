'use strict';
// Entire protected owner flow and public old-link verification, synthetic data only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright'),{setup}=require('./helpers/identity-serverless.cjs');
const {buildSite}=require('../scripts/build-site.cjs'),{buildProtectedAdmin}=require('../scripts/build-protected-admin.cjs');
const {approvedRuntime,createProjector}=require('../scripts/admin/review-runtime.cjs'),{checkReleaseBuild}=require('../scripts/admin/result-publication.cjs');
const {createDeploymentVerifier}=require('../scripts/admin/deployment-verifier.cjs'),{createAdminGateway}=require('../scripts/admin/serverless/admin-gateway.cjs');
const {ADMIN_SOURCES}=require('../scripts/lib/runtime-files.cjs');
test('protected owner checks, approves, publishes and reverses synthetic identities on responsive screens; real public engines verify old links, counts and unchanged results',{timeout:180000},async t=>{
 let verificationFailure=null;
 const history=require('./public/quick/fixtures/corrections-data.js').history();
 history.people.push({...history.people[4],i:'MOR-C220006',n:'Syntetisk Status Looper',c:1});
 history.results.push([2023,'MOR-C220006','Morothon','20 km','Fullført','1:50:00',1,'M','','']);

 const options={pause:async()=>{if(verificationFailure)throw Error('Synthetic verification failed');}},f=await setup(t,{identityPublicationEnabled:true,publicationOptions:options,history}),original=structuredClone(f.context.history),
  assets=path.join(path.dirname(f.directory),'identity-publication-browser'),data=path.join(assets,'package'),approval=path.join(assets,'approval.json');
 await fs.mkdir(path.join(data,'data'),{recursive:true});
 async function build(label){
  for(const n of ['history','honors','volunteers','badges','event-dates'])await fs.writeFile(path.join(data,'data',n+'.json'),f.repository.files.get('public-data/data/'+n+'.json'));
  await fs.writeFile(path.join(data,'manifest.json'),f.repository.files.get('public-data/manifest.json'));
  await fs.writeFile(approval,f.repository.files.get('.github/public-data-approval.json'));
  const built=await buildSite(path.join(assets,label),{dataDir:data,approvalFile:approval});return approvedRuntime(built.out,approval);
 }
 const runtime=await build('before'),protectedDir=path.join(assets,'protected');await buildProtectedAdmin(protectedDir);
 const adminFiles=new Map();for(const name of Object.keys(ADMIN_SOURCES)){let bytes=await fs.readFile(path.join(protectedDir,name));
  if(name==='admin/index.html')bytes=Buffer.from(bytes.toString().replace('https://morothon-admin.damofra75.workers.dev',f.origin));adminFiles.set(name,bytes);}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const projector=await createProjector(runtime,{browser});Object.assign(f.context,runtime,{project:projector.project});let sequence=0;
 options.checkBuild=checkReleaseBuild;
 options.verifyLive=async job=>{
  const live=await build('live-'+(++sequence)),verify=createDeploymentVerifier({verifyProfiles:projector.verifyProfiles,
   fetchImpl:async url=>{const name=new URL(url).pathname.slice(new URL(job.build.siteUrl).pathname.length),bytes=live.files.get(name);return new Response(bytes||null,{status:bytes?200:404});}});
  let verified;try{verified=await verify(job);}catch(error){verificationFailure=error.cause?.message||error.message;throw error;}
  // Explicitly verify the older redirect as well as both selected person IDs.
  await projector.verifyProfiles({...verified,siteUrl:job.build.siteUrl,personIds:['MOR-OLD2201'],changes:job.changes});
  runtime.files=verified.files;return verified;
 };
 const {sameOriginBrokerRead}=await import('../scripts/admin/serverless/worker.mjs');
 const gateway=createAdminGateway({portalOrigin:f.origin,apiOrigin:f.origin,auth:f.auth,
  assetSource:async name=>adminFiles.has('admin/'+name)?{bytes:adminFiles.get('admin/'+name)}:null});
 const errors=[],traffic=[];
 async function open(width=1440){const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());const session=await f.login();
  await context.addCookies([{name:'__Host-morothon-admin',value:session,url:f.origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==f.origin)return route.abort();
   if(url.pathname.startsWith('/site/')){const bytes=runtime.files.get(url.pathname.slice(6));return route.fulfill({status:bytes?200:404,body:bytes||'Not found',contentType:type(url.pathname)});}
   const headers=await request.allHeaders();if(!request.isNavigationRequest()&&new URL(request.frame().url()).origin===f.origin){if(!headers.origin)headers['sec-fetch-site']='same-origin';if(request.method()==='POST')headers.origin=f.origin;}
   const req=new Request(request.url(),{method:request.method(),headers,...(request.postData()?{body:request.postData()}: {})}),
    response=url.pathname.startsWith('/admin/')?await gateway(req):await f.broker.fetch(sameOriginBrokerRead(req,f.origin));
   traffic.push({path:url.pathname,status:response.status});return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{
   if(d.message().startsWith('Forberede tilbakeføring?'))return d.accept();
   errors.push('Unexpected dialog: '+d.message());return d.dismiss();
  });await page.goto(f.origin+'/admin/#personkontroll');
  await page.waitForFunction(()=>document.querySelector('#identityService'));
  try{await page.waitForFunction(()=>document.querySelector('#identityRefresh:enabled'));}
  catch(error){throw Error(error.message+' '+JSON.stringify({errors,traffic:traffic.slice(-15),status:await page.locator('#identityServiceStatus').textContent()}));}
  return {page,context,session};
 }
 function type(name){return ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.ico':'image/x-icon'})[path.extname(name)]||'application/octet-stream';}
 let {page,context,session}=await open();
 const posted=route=>page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.request().method()==='POST');
 async function processResponse(response){
  assert.equal((await response).status(),202,JSON.stringify(traffic.slice(-6)));const result=await f.processNext();
  if(!result.completed){const q=await f.control.get('queue-sogne-morothon'),task=await f.control.get('task-'+q.taskId);
   assert.fail(JSON.stringify({verificationFailure,error:task?.error}));}
 }
 async function action(button,...routes){
  const responses=routes.map(posted);await page.click(button);
  for(const response of responses)await processResponse(response);
  await page.waitForFunction(()=>!document.querySelector('#identityRefresh').disabled,{},{timeout:30000});
 }
 const first=page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'});
 const quickLookup=first.getByRole('link',{name:'Søk i Google',exact:true});
 assert.equal(await quickLookup.isVisible(),true);
 assert.equal(new URL(await quickLookup.getAttribute('href')).searchParams.get('q').split(' OR ').length,2);
 assert.equal(await page.locator('#identityBatchTray').isVisible(),false);
 assert.equal(await page.locator('#identityPublication').isVisible(),false);
 assert.equal(await page.locator('#identityWorklist').evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('#identityServiceCounts'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
 await first.locator('select[id^="identityQuickMain-"]').selectOption('MOR-C220002');await first.getByRole('button',{name:'Samme person',exact:true}).click();
 await page.locator('#identityWorklist article').filter({hasText:'Syntetisk Samme Navn'}).getByRole('button',{name:'Forskjellige personer',exact:true}).click();
 await page.getByText('Finn profiler manuelt',{exact:true}).click();
 await page.fill('#identityManualSearch0','Statusløper');
 await page.selectOption('#identityManualPerson0','MOR-C220005');
 await page.fill('#identityManualSearch1','Status Looper');
 await page.selectOption('#identityManualPerson1','MOR-C220006');
 await page.click('#identityManualOpen');
 const lookup=page.locator('#identityEditor details').filter({has:page.getByText('Søk etter kilder',{exact:true})});
 await lookup.locator('summary').click();
 const google=new URL(await lookup.getByRole('link',{name:'Søk i Google'}).getAttribute('href'));
 assert.equal(google.origin,'https://www.google.com');
 assert.equal(google.searchParams.get('q'),'"Syntetisk Statusløper" OR "Syntetisk Status Looper"');
 assert.match(await lookup.getByLabel('Spørsmål til Gemini').inputValue(),/Oppgi lenke, år/);

 await page.selectOption('#identityMainPerson','MOR-C220006');
 await page.click('#identitySame');
 await page.waitForFunction(()=>document.querySelectorAll('#identityBatchTray .identity-batch-entry').length===3);
 await action('#identityBatchSubmit','/identity/batch','/identity/publication/check');assert.equal(f.remote.merged,0);
 assert.match(await page.locator('#identityPublication').textContent(),/Syntetisk Kari N. Nord · 5 deltakelser/);
 assert.match(await page.locator('#identityPublication').textContent(),/2 bekreftede sammenslåinger/);
 assert.equal(await page.locator('#identityPublicationPublish').isEnabled(),true);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow at '+width);
  if(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR){await fs.mkdir(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,{recursive:true});await page.locator('#identityPublication').screenshot({path:path.join(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,'for-etter-'+width+'.png')});}}
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(f.remote.merged,0);
 f.remote.checks='success';f.remote.deploy='success';
 const approvalResponse=posted('/identity/publication/approve'), publish=posted('/identity/publication/publish');
 await page.getByRole('button',{name:'Bekreft publisering',exact:true}).click();
 await processResponse(approvalResponse);
 assert.equal((await publish).status(),202);
 await page.waitForFunction(()=>document.querySelector('#identityPublication').textContent.includes('Jobben fortsetter'));
 await page.selectOption('#identityFilter','finished');
 await page.locator('#identityWorklist .identity-quick-compare:visible').first().waitFor();
 assert.equal(await page.locator('#identityWorklist .identity-quick-compare:visible').first().isEnabled(),true);
 await page.locator('#identityWorklist .identity-quick-compare:visible').first().click();
 await page.fill('#identityManualSearch0','Statusløper');
 await page.selectOption('#identityManualPerson0','MOR-C220005');
 await page.click('#identityManualOpen');
 await page.getByText('Hovednavn og alias uten sammenslåing',{exact:true}).click();
 await page.fill('#identityNewName','Syntetisk neste pulje');
 await page.click('#identityAlias');
 await page.locator('#identityBatchTray .identity-batch-entry').waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.startsWith('morothon-personkontroll-next-'))),true);
 assert.equal(await page.locator('#identityBatchSubmit').isDisabled(),true);
 await processResponse(publish);
 await page.waitForFunction(()=>!document.querySelector('#identityRefresh').disabled,{},{timeout:30000});
 assert.match(await page.locator('#identityPublicationStatus').textContent(),/Publisert og etterkontrollert/);assert.equal(f.remote.merged,1);
 assert.deepEqual(f.context.history.results,original.results);assert.equal(f.context.history.redirects['MOR-C220001'],'MOR-C220002');assert.equal(f.context.history.redirects['MOR-C220005'],'MOR-C220006');
 await page.click('#identityLogout');await context.close();f.restart();({page,context}=await open(390));
 assert.match(await page.locator('#identityPublicationStatus').textContent(),/Publisert og etterkontrollert/);
 await page.click('#identityPublicationHistory summary');
 await action('#identityPublicationReverse','/identity/publication/reverse');assert.equal(f.remote.merged,1);
 assert.match(await page.locator('#identityPublicationStatus').textContent(),/Kontrollert – klar til publisering/,'a reversal preview must not inherit the previous published label');
 assert.equal(await page.locator('#identityPublicationPublish').isEnabled(),true);
 await action('#identityPublicationPublish','/identity/publication/approve','/identity/publication/publish');
 assert.equal(f.remote.merged,2);assert.deepEqual(f.context.history,original);assert.deepEqual(errors,[]);
 const raw=await f.identities.get('sogne-morothon');assert.equal(raw.draft.cases.length,1);assert.equal(raw.draft.cases[0].status,'rejected');
 // Correct JSON is insufficient if the rendered panel shows another name.
 const wrong=new Map(runtime.files),html=wrong.get('index.html').toString();
 assert.ok(html.includes("'Løperprofil for '+p.n"));wrong.set('index.html',Buffer.from(html.replace("'Løperprofil for '+p.n","'Løperprofil for Syntetisk Feilvisning'")));
 await assert.rejects(projector.verifyProfiles({siteUrl:'https://synthetic.example.test/',files:wrong,history:original,
  personIds:['MOR-C220003','MOR-C220001'],changes:[]}),/Kontrollpunkter: rendered/);
 await context.close();({page,context,session}=await open(768));
 const current=(await f.request('/identity',undefined,session)).body;
 assert.equal((await f.request('/identity/decide',{expectedRevision:current.revision,command:f.command('alias',{
  personIds:['MOR-C220005'],mainPersonId:null,name:'Syntetisk Ekstra Alias'})},session)).status,202);
 assert.equal((await f.processNext()).completed,true);await page.click('#identityRefresh');
 await page.waitForFunction(()=>document.querySelector('#identityPublicationStatus').textContent.startsWith('Lagret privat.'));
 assert.equal(await page.locator('#identityPublicationPublish').count(),0,'new private work is never labelled or authorized as already published');
 assert.deepEqual(f.context.history,original);assert.equal(f.remote.merged,2);
});
