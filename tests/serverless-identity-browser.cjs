'use strict';
// Protected HTML + real authentication/broker/driver/storage/projector. No live services.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const {setup}=require('./helpers/identity-serverless.cjs');
const {buildSite}=require('../scripts/build-site.cjs');
const {buildProtectedAdmin}=require('../scripts/build-protected-admin.cjs');
const {approvedRuntime,createProjector}=require('../scripts/admin/review-runtime.cjs');
const {createAdminGateway}=require('../scripts/admin/serverless/admin-gateway.cjs');
const {ADMIN_SOURCES}=require('../scripts/lib/runtime-files.cjs');

async function identityBrowser(t){
 // Each test file has its own Node process. Exercise CI's usual umask even
 // when the local shell uses 0077, which previously hid an unsafe fixture root.
 const previousUmask=process.umask(0o022);t.after(()=>process.umask(previousUmask));
 const f=await setup(t),root=path.resolve(__dirname,'..'),original=await fs.readFile(path.join(root,'public-data/data/history.json'));
 // f.directory belongs exclusively to the encrypted store. Let the real store
 // create it with 0700; recursive asset builds would otherwise create it 0755.
 const assets=path.join(path.dirname(f.directory),'browser-fixture');
 const data=path.join(assets,'browser-package'),approval=path.join(assets,'browser-approval.json');
 await fs.mkdir(path.join(data,'data'),{recursive:true});
 for(const name of ['history','honors','volunteers','badges','event-dates'])await fs.writeFile(path.join(data,'data',name+'.json'),f.repository.files.get('public-data/data/'+name+'.json'));
 await fs.writeFile(path.join(data,'manifest.json'),f.repository.files.get('public-data/manifest.json'));
 await fs.writeFile(approval,f.repository.files.get('.github/public-data-approval.json'));
 const built=await buildSite(path.join(assets,'browser-site'),{dataDir:data,approvalFile:approval});
 const runtime=await approvedRuntime(built.out,approval),protectedDir=path.join(assets,'protected-assets');
 await buildProtectedAdmin(protectedDir);
 const protectedHtml=await fs.readFile(path.join(protectedDir,'admin/index.html'),'utf8');
 // Task-first overview is shared by the protected Worker shell and local admin.
 const taskHub=protectedHtml.indexOf('class="admin-work-hub"');
 const welcome=protectedHtml.indexOf('class="welcome-card"');
 assert.ok(taskHub>0 && welcome>taskHub,'admin work cards must appear before decorative welcome content');
 assert.equal((protectedHtml.match(/class="admin-work-card"/g)||[]).length,6,
   'all six existing task routes must be retained after reordering');
 const bootStylePosition=protectedHtml.indexOf('<style data-morothon-protected-boot>');
 assert.ok(bootStylePosition>0,'protected admin must include critical pre-paint shell-hiding CSS');
 assert.ok(bootStylePosition<protectedHtml.indexOf('href="./intake.css"'),
   'legacy shell must be hidden before loading external CSS');
 assert.ok(protectedHtml.slice(bootStylePosition,protectedHtml.indexOf('</style>',bootStylePosition))
   .includes(':not([data-admin-ready="true"]) .portal-shell{visibility:hidden}'),
   'critical style must hide the uninitialized protected admin shell');
 const files=new Map(runtime.files);
 for(const name of Object.keys(ADMIN_SOURCES)){
  let bytes=await fs.readFile(path.join(protectedDir,name));
  if(name==='admin/index.html')bytes=Buffer.from(bytes.toString().replace('https://morothon-admin.damofra75.workers.dev',f.origin));
  files.set(name,bytes);
 }
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(()=>browser.close());
 const projector=await createProjector(runtime,{browser});t.after(()=>projector.close());
 Object.assign(f.context,runtime,{project:projector.project});
 const {sameOriginBrokerRead}=await import('../scripts/admin/serverless/worker.mjs');
 const gateway=createAdminGateway({portalOrigin:f.origin,apiOrigin:f.origin,auth:f.auth,
  assetSource:async name=>files.has('admin/'+name)?{bytes:files.get('admin/'+name)}:null});
 const errors=[],writes=[],traffic=[],pages=[];let modeledIdentityReads=0;
 let intercept=null;
 async function open({authenticated=true,width=1440}={}){
  const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());
  const session=authenticated?await f.login():null;
  if(session)await context.addCookies([{name:'__Host-morothon-admin',value:session,url:f.origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!==f.origin)return route.abort();
   if(intercept && await intercept(route,url))return;
   const headers=await r.allHeaders();
   // Reproduce the initial GET without browser-generated Fetch Metadata. This
   // must reach the real read normalizer, not leave startup waiting forever.
   if(r.method()==='GET'&&url.pathname==='/identity'&&(!headers.origin||headers.origin===f.origin)){
    delete headers.origin;headers['sec-fetch-site']='none';modeledIdentityReads++;
   }
   // Playwright's fulfilled HTTPS fixture omits browser-generated Fetch Metadata.
   // Model it only for subrequests originating in this fixture's own frame;
   // production normalization and hostile-origin rejection are tested separately.
   if(!r.isNavigationRequest()&&new URL(r.frame().url()).origin===f.origin){
    // The fixture knows the originating frame; do not depend on the browser's
    // generated headers for requests that never enter a real HTTPS network.
    if(!headers.origin)headers['sec-fetch-site']='same-origin';
    if(r.method()==='POST'&&!headers.origin)headers.origin=f.origin;
   }
   const request=new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})});
   let response;
   if(url.pathname.startsWith('/admin/'))response=await gateway(request);
   else if(url.pathname.startsWith('/site/')){
    const name=url.pathname.slice(6)||'index.html',bytes=files.get(name);
    return route.fulfill({status:bytes?200:404,body:bytes||'Not found',contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.ico':'image/x-icon'})[path.extname(name)]||'application/octet-stream'});
   }else{
    if(r.method()==='POST')writes.push(url.pathname);
    response=await f.broker.fetch(sameOriginBrokerRead(request,f.origin));
    traffic.push({path:url.pathname,status:response.status,site:headers['sec-fetch-site'],origin:headers.origin});
   }
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const identityRead=authenticated?page.waitForResponse(r=>new URL(r.url()).pathname==='/identity'&&r.request().method()==='GET'):null;
  await page.goto(f.origin+'/admin/#personkontroll');
  if(authenticated){await page.locator('#identityService').waitFor();
   assert.equal((await identityRead).status(),200,'Initial private identity read must pass the real read/authentication gate');}
  return {context,page,session};
 }
 return {f,root,original,open,errors,writes,traffic,pages,
  get modeledIdentityReads(){return modeledIdentityReads;},
  intercept(fn){intercept=fn;}};
}

test('protected Personkontroll saves, approves and reopens after a fresh login; failed merges never become saved, and responsive worklists hide handled pairs', {timeout:120000},async t=>{
 const fixture=await identityBrowser(t);
 const {f,root,original,open,errors,writes,traffic,pages}=fixture;
 try {
 let {page,context,session}=await open();
 async function submitQueued(){
  const receipt=page.waitForResponse(r=>new URL(r.url()).pathname==='/identity/batch'&&r.request().method()==='POST');
  await page.click('#identityBatchSubmit');
  assert.equal((await receipt).status(),202,'Process a synthetic job only after the server has accepted this batch');
  await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 }
 assert.equal((await fs.stat(f.directory)).mode&0o777,0o700,'The private store must create its own 0700 directory under CI umask 0022');
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Ingen lagrede'));
 assert.equal(await page.locator('body').getAttribute('data-admin-ready'),'true','protected admin shell appears only after confirmed startup');
 assert.equal(await page.locator('#identityWorklist article').count(),2);
 assert.equal(await page.locator('#identityApprove').isEnabled(),false);
 assert.equal(await page.locator('#identityPublication').isVisible(),false,'default-off identity publication must have no operative owner controls');
 assert.equal(await page.locator('#identityPublicationPublish').count(),0);
 assert.equal(await page.locator('#navCorrections').textContent(),'Resultatkontroll');
 assert.equal(await page.locator('[data-correction-tab="suggestions"]').isVisible(),false);
 assert.ok((await page.locator('#view-import').textContent()).includes('Rett og kontroller eksisterende resultater'));
 const first=page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'});
 assert.match(await first.textContent(),/2020, 2021, 2022/,'first profile participation years must be visible on the card');
 assert.match(await first.textContent(),/2023, 2024/,'second profile participation years must be visible on the card');
 const overlapping=page.locator('#identityWorklist article').filter({hasText:'Syntetisk Samme Navn'});
 assert.match(await overlapping.textContent(),/Begge er registrert i 2025/,'shared years must be clearly flagged before choosing merge');
 const actionWidths=await first.locator('.identity-quick-actions button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().width));
 assert.ok(actionWidths.every(w=>w<260),'quick decisions should not stretch to full card width');
 assert.equal(await first.getByRole('button',{name:'Forskjellige personer',exact:true}).count(),1,'Every pending pair must expose the distinct-person quick choice');
 assert.equal(await first.getByRole('button',{name:'Samme person',exact:true}).count(),1,'Every pending pair must expose direct same-person choice');
 assert.equal(await first.getByRole('button',{name:'Undersøk senere'}).count(),1,'Every pending pair must expose an editable defer choice');
 const colored=await first.locator('.identity-quick-actions button').evaluateAll(buttons=>buttons.map(b=>({color:getComputedStyle(b).backgroundColor,foreground:getComputedStyle(b).color,height:b.getBoundingClientRect().height})));
 assert.equal(colored.length,3);
 assert.notEqual(colored[0].color,colored[1].color,'same and distinct identity decisions must have distinct visible colors');
 assert.ok(colored.every(b=>b.height>=44),'quick choices must have usable touch targets');
 // A click is an editable choice only. The single batch action saves a real
 // follow-up, which must survive logout, broker restart and a fresh login.
 await first.getByRole('button',{name:'Undersøk senere'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#identityBatchTray .identity-batch-entry').length===1);
 assert.match(await page.locator('#identityServiceCounts').textContent(),/1Ubehandlede/,'A staged defer must leave only the remaining pair in the pending count');
 assert.equal(await page.locator('[data-identity-count="session-followup"] strong').textContent(),'1');
 assert.equal(await page.locator('[data-identity-count="followup"] strong').textContent(),'0','A local choice must never be counted as a server-saved follow-up');
 assert.equal(await page.locator('#identityBatchTray .identity-batch-entry').count(),1);
 assert.equal(await f.identities.get('sogne-morothon'),null);
 await page.locator('#identityBatchTray').getByRole('button',{name:'Angre',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#identityBatchTray .identity-batch-entry').length===0);
 await page.waitForFunction(()=>document.querySelectorAll('#identityWorklist article').length===2);
 assert.equal(await page.locator('[data-identity-count="pending"] strong').textContent(),'2');
 assert.equal(await page.locator('[data-identity-count="session-followup"] strong').textContent(),'0');
 await first.getByRole('button',{name:'Undersøk senere'}).click();
 await page.selectOption('#identityFilter','followup');
 assert.equal(await page.locator('#identityWorklist article').count(),1);
 await page.selectOption('#identityFilter','pending');
 assert.equal(await page.locator('#identityWorklist article').count(),1);
 await page.selectOption('#identityFilter','all');
 await submitQueued();
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
 assert.equal(await page.locator('#identityBatchTray .identity-batch-entry').count(),0);
 assert.equal(await page.locator('[data-identity-count="followup"] strong').textContent(),'1');
 assert.equal(await page.locator('[data-identity-count="session-followup"] strong').textContent(),'0');
 const deferredId=(await f.identities.get('sogne-morothon')).draft.cases[0].id;
 await page.click('#resultServiceLogout');await page.locator('#login').waitFor();
 await context.close();f.restart();
 ({page,context,session}=await open({width:768}));
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
 assert.equal(await page.locator('#identityWorklist article').count(),1,'Deferred pair is no longer unprocessed after a fresh login');
 await page.selectOption('#identityFilter','followup');
 assert.equal(await page.locator('#identityWorklist article').count(),1);
 assert.ok((await page.locator('#identityWorklist').textContent()).includes('Syntetisk Kari N. Nord'));
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Saved follow-up fits viewport '+width);
  if(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR){
   await fs.mkdir(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,{recursive:true});
   await page.screenshot({path:path.join(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,'oppfolging-'+width+'.png'),fullPage:true});
  }
 }
 await page.setViewportSize({width:768,height:1000});
 await page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'}).getByRole('button',{name:'Sammenlign profiler'}).click();
 assert.equal(await page.locator('#identityEditor').evaluate(e=>document.activeElement===e),true,'comparison must receive focus');
 assert.equal(await page.locator('#identityEditor').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=-2&&r.top<innerHeight-60;}),true,'comparison must be scrolled into the visible viewport');
 await page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'}).locator('select[id^="identityQuickMain-"]').selectOption('MOR-C220002');
 const firstDecision=page.waitForResponse(r=>new URL(r.url()).pathname==='/identity/batch'&&r.request().method()==='POST');
 await page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'}).getByRole('button',{name:'Samme person',exact:true}).click();
 assert.equal(await page.locator('#identityBatchTray .identity-batch-entry').count(),1);
 assert.equal((await f.identities.get('sogne-morothon')).revision,1,'click alone must not change the saved follow-up');
 await page.click('#identityBatchSubmit');
 assert.equal((await firstDecision).status(),202,'The authenticated identity POST must pass the real Origin gate');
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 assert.equal(await page.locator('#resultServiceLogout').isEnabled(),true);
 assert.equal((await f.identities.get('sogne-morothon')).revision,1);
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
 assert.equal((await f.identities.get('sogne-morothon')).draft.cases[0].id,deferredId,'Resolving a follow-up preserves its case identity');
 assert.equal(await page.locator('[data-identity-count="followup"] strong').textContent(),'0');
 await page.selectOption('#identityFilter','pending');
 await page.waitForFunction(()=>document.querySelectorAll('#identityWorklist article').length===1);
 assert.ok((await page.locator('#identityServiceCounts').textContent()).includes('1Behandlede'));
 // The remaining identical-name profiles have overlapping starts. A failed
 // server check must not remove them or block a subsequent distinct decision.
 await page.locator('#identityWorklist article').getByRole('button',{name:'Sammenlign profiler'}).click();
 await page.selectOption('#identityMainPerson','MOR-C220004');
 await page.click('#identitySame');await submitQueued();
 assert.equal((await f.processNext()).completed,false);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Overlapp'));
 assert.equal((await f.identities.get('sogne-morothon')).revision,2);
 await page.click('#identityDifferent');
 await submitQueued();
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('revisjon 3'));
 assert.equal(await page.locator('#identityWorklist article').count(),0);
 const counts=await page.locator('#identityServiceCounts').textContent();
 assert.ok(counts.includes('0Ubehandlede'));assert.ok(counts.includes('1Behandlede'));assert.ok(counts.includes('1Avviste par'));
 await page.selectOption('#identityFilter','finished');assert.equal(await page.locator('#identityWorklist article').count(),1);
 await page.selectOption('#identityFilter','rejected');await page.waitForFunction(()=>document.querySelector('#identityWorklist').textContent.includes('Syntetisk Samme Navn'));
 assert.equal(await page.locator('#identityApprove').isVisible(),false,'no redundant second owner approval required');
 assert.equal(writes.some(route=>route.startsWith('/publication/')),false);
 await page.click('#resultServiceLogout');await page.locator('#login').waitFor();
 assert.equal((await f.request('/identity',undefined,session)).status,401);
 await context.close();f.restart();
 const again=await open({width:768});
 await again.page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
 assert.equal(await again.page.locator('#identityWorklist article').count(),0);
 await again.page.selectOption('#identityFilter','finished');await again.page.locator('#identityWorklist button').click();
 assert.equal(await again.page.locator('#identityEditor h2').textContent(),'Lagret identitetsavgjørelse');
 assert.ok((await again.page.locator('#identityEditor').textContent()).includes('Syntetisk Kari N. Nord'));
 for(const width of [1440,768,390]){
  await again.page.setViewportSize({width,height:1000});
  assert.equal(await again.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);
  if(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR){await fs.mkdir(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,{recursive:true});
   await again.page.evaluate(()=>window.scrollTo(0,0));
   await again.page.screenshot({path:path.join(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,'personkontroll-'+width+'.png'),fullPage:true});}
 }
 assert.deepEqual(errors,[]);assert.equal(f.remote.submitted,0);assert.equal(f.remote.merged,0);
 assert.ok((await fs.readFile(path.join(root,'public-data/data/history.json'))).equals(original));
 const anonymous=await open({authenticated:false});await anonymous.page.locator('#login').waitFor();
 assert.equal(await anonymous.page.locator('#identityService').count(),0);
 assert.ok(fixture.modeledIdentityReads>=3,'Every fresh login must exercise the initial read without generated Fetch Metadata');
 } catch(error) {
  const ui=await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(()=>({
   hash:location.hash,status:document.querySelector('#identityServiceStatus')?.textContent,
   result:document.querySelector('#resultServiceStatus')?.textContent,
   pending:document.querySelectorAll('#identityWorklist article').length,
  })).catch(()=>({unavailable:true}))));
  throw new Error(error.message+'\nSynthetic HTTP/UI diagnostics: '+JSON.stringify({errors,traffic,ui}),{cause:error});
 }
});

test('Personkontroll keeps unsaved batches and errors truthful through version mismatch, network loss, bounded waits and exact receipts', {timeout:120000},async t=>{
 const fixture=await identityBrowser(t),{f,open,writes}=fixture;
 let {page,context,session}=await open();
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Ingen lagrede'));
 const status=()=>page.locator('#identityServiceStatus').textContent();
 const first=()=>page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'});
 const second=()=>page.locator('#identityWorklist article').filter({hasText:'Syntetisk Samme Navn'});
 const fulfilled=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 async function eventually(check){
  const end=Date.now()+5000;
  while(!await check()){if(Date.now()>end)assert.fail('Expected synthetic browser state was not reached');await new Promise(r=>setTimeout(r,20));}
 }
 await t.test('quick choices show unsaved status, preserve chosen main name and undo without a server job',async()=>{
  await first().locator('select').selectOption('MOR-C220002');
  await first().getByRole('button',{name:'Samme person',exact:true}).click();
  await second().getByRole('button',{name:'Forskjellige personer',exact:true}).click();
  assert.match(await status(),/2 ulagrede avgjørelser/);
  assert.equal(await page.locator('#identityWorklist article').count(),0);
  assert.equal(await page.locator('[data-identity-count="pending"] strong').textContent(),'0');
  await page.selectOption('#identityFilter','all');
  assert.match(await first().locator('.identity-unsaved').textContent(),/hovednavn: Syntetisk Kari N. Nord/);
  assert.equal(await first().locator('select').inputValue(),'MOR-C220002');
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'2');
  assert.equal(await page.locator('[data-identity-count="finished"] strong').textContent(),'0');
  assert.equal(f.dispatches.length,0);assert.equal(await f.identities.get('sogne-morothon'),null);
  await page.selectOption('#identityFilter','pending');
  for(let n=0;n<2;n++)await page.locator('#identityBatchTray').getByRole('button',{name:'Angre',exact:true}).first().click();
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'0');
 });
 await t.test('404 and 409 keep local choices editable; filtering cannot erase a 502 or its explanation',async()=>{
  await first().getByRole('button',{name:'Forskjellige personer',exact:true}).click();
  for(const [code,html] of [[404,false],[404,true],[409,false]]){
   fixture.intercept(async(route,url)=>{
    if(url.pathname==='/identity/batch') {
     if(html)await route.fulfill({status:code,contentType:'text/html',body:'Not found'});
     else await fulfilled(route,code,{error:'Syntetisk revisjonskonflikt'});
     return true;
    }
    return false;
   });
   await page.click('#identityBatchSubmit');
   await eventually(async()=>await page.locator('#identityBatchSubmit').isEnabled());
   assert.match(await status(),code===404?/serverversjonen.*samlet personkontroll/:/revisjonskonflikt/);
   assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'1');
   assert.equal(f.dispatches.length,0);
  }
  fixture.intercept(async(route,url)=>{
   if(url.pathname==='/identity'){await fulfilled(route,502,{error:'Syntetisk privat tjenestefeil'});return true;}return false;
  });
  await page.click('#identityRefresh');
  await eventually(async()=>/privat tjenestefeil/.test(await status()));
  const error=await status();
  await page.fill('#identitySearch','Kari');await page.selectOption('#identityFilter','all');
  assert.equal(await status(),error);
  assert.equal(await page.locator('#identityServiceStatus').getAttribute('data-error'),'true');
  assert.equal(await page.locator('#identityRefresh').isEnabled(),true);
  fixture.intercept(null);await page.click('#identityRefresh');
  await eventually(async()=>!/privat tjenestefeil/.test(await status()));
  await page.fill('#identitySearch','');await page.selectOption('#identityFilter','pending');
 });
 await t.test('an HTTP request stops after 20 seconds and can be refreshed without resubmission',async()=>{
  await page.clock.install();
  let release,received;
  const waiting=new Promise(r=>{received=r;}),hold=new Promise(r=>{release=r;});
  fixture.intercept(async(route,url)=>{
   if(url.pathname!=='/identity')return false;
   received();await hold;await route.abort().catch(()=>{});return true;
  });
  await page.click('#identityRefresh');await waiting;
  await page.clock.runFor(20001);
  await eventually(async()=>/20 sekunder/.test(await status()));
  assert.equal(await page.locator('#identityRefresh').isEnabled(),true);
  assert.match(await page.locator('#identityActionHelp').textContent(),/ulagret/);
  release();fixture.intercept(null);await page.click('#identityRefresh');
  await eventually(async()=>await page.locator('#identityBatchSubmit').isEnabled());
  assert.equal(f.dispatches.length,0);
 });
 await t.test('a lost queued response, unknown status and unrelated failed task never fake saving or unlock resubmission',async()=>{
  let queued;
  fixture.intercept(async(route,url)=>{
   if(url.pathname!=='/identity/batch')return false;
   queued=await f.request('/identity/batch',route.request().postDataJSON(),session);
   await route.abort();return true;
  });
  await page.click('#identityBatchSubmit');
  await eventually(async()=>await page.locator('#identityRefresh').isEnabled());
  assert.equal(queued.status,202);assert.equal(f.dispatches.length,1);
  assert.equal(await page.locator('#identityBatchSubmit').isEnabled(),false);
  assert.equal(await f.identities.get('sogne-morothon'),null);
  // A second authenticated session must open immediately while the private
  // workflow is still queued; waiting for that job is not a login requirement.
  fixture.intercept(null);
  const duringJob=await open({width:768});
  assert.equal(await duringJob.page.locator('body').getAttribute('data-admin-ready'),'true');
  assert.match(await duringJob.page.locator('#identityServiceStatus').textContent(),/Privat kontroll pågår/);
  assert.equal(await duringJob.page.locator('#identityRefresh').isEnabled(),true);
  await duringJob.context.close();
  for(const change of [
   task=>({...task,state:'unrecognized'}),
   task=>({...task,id:'a'.repeat(32),state:'failed',requestIds:['another-request'],error:'Syntetisk annen jobb feilet'})
  ]){
   fixture.intercept(async(route,url)=>{
    if(url.pathname!=='/identity')return false;
    const current=(await f.request('/identity',undefined,session)).body;
    current.task=change(current.task);await fulfilled(route,200,current);return true;
   });
   await page.click('#identityRetry');
   await eventually(async()=>await page.locator('#identityRetry').isEnabled());
   assert.equal(await page.locator('#identityBatchSubmit').isEnabled(),false);
   assert.match(await page.locator('#identityActionHelp').textContent(),/Valgene er låst/);
   assert.equal(f.dispatches.length,1);
  }
  fixture.intercept(null);
  const queuedRead=page.waitForResponse(r=>new URL(r.url()).pathname==='/identity');
  await page.click('#identityRetry');await queuedRead;
  await page.clock.setSystemTime(new Date(Date.now()+180000));
  await page.clock.runFor(4001);
  await eventually(async()=>/Kontrollen pågår fortsatt/.test(await status()));
  assert.equal(await page.locator('#identityRetry').isEnabled(),true);
  assert.equal(await page.locator('#resultServiceLogout').isEnabled(),true);
  assert.equal(f.dispatches.length,1);
  // Complete the existing immutable request; fetching status performs no POST.
  assert.equal((await f.processNext()).completed,true);
  const posts=writes.length;
  await page.click('#identityRetry');
  await eventually(async()=>/Lagret privat/.test(await status()));
  assert.equal(writes.length,posts);
  assert.equal(await page.locator('[data-identity-count="rejected"] strong').textContent(),'1');
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'0');
 });
 await t.test('one 202 batch saves two choices only after both exact receipts and survives a fresh login',async()=>{
  // First pair was rejected above. Reopen with a fresh session, without any
  // browser-side command replay; the saved negative must stay out of pending.
  await page.click('#resultServiceLogout');await page.locator('#login').waitFor();await context.close();f.restart();
  ({page,context,session}=await open({width:390}));
  await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
  assert.equal(await first().count(),0);
  assert.equal(await page.locator('[data-identity-count="rejected"] strong').textContent(),'1');
  // Add a second, explicit single-profile alias through the existing editor.
  await second().getByRole('button',{name:'Sammenlign profiler'}).click();
  await page.click('#identityLater');
  await page.locator('#identityEditor details').filter({has:page.getByText('Hovednavn og alias uten sammenslåing',{exact:true})}).locator('summary').click();
  await page.fill('#identityNewName','Syntetisk Kontrollalias');await page.click('#identityAlias');
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'2');
  const revision=(await f.identities.get('sogne-morothon')).revision;
  // A later revision and completed task alone are insufficient. Every exact
  // command marker is required, including the single-profile alias command.
  fixture.intercept(async(route,url)=>{
   if(url.pathname!=='/identity')return false;
   const current=(await f.request('/identity',undefined,session)).body;
   if(current.revision<=revision){await fulfilled(route,200,current);return true;}
   const submitted=current.task.requestIds;
   const storedCommands=current.draft.cases.flatMap(c=>c.events).filter(e=>/^request-[a-f0-9]{64}$/.test(e.action));
   assert.equal(submitted.length,2);assert.ok(storedCommands.length>=3);
   const marker=storedCommands.at(-1).action;
   for(const c of current.draft.cases)c.events=c.events.filter(e=>e.action!==marker);
   await fulfilled(route,200,current);return true;
  });
  const accepted=page.waitForResponse(r=>new URL(r.url()).pathname==='/identity/batch');
  await page.click('#identityBatchSubmit');assert.equal((await accepted).status(),202);
  assert.equal(f.dispatches.length,1);
  assert.equal((await f.identities.get('sogne-morothon')).revision,revision);
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'2');
  assert.equal((await f.processNext()).completed,true);
  await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Ingen samlet lagringskvittering')).catch(async error=>{throw Error(error.message+' status='+await status()+' '+JSON.stringify(fixture.traffic.slice(-5)));});
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'2');
  assert.equal(await page.locator('#identityBatchSubmit').isEnabled(),false);
  fixture.intercept(null);await page.click('#identityRetry');
  await page.waitForFunction(()=>document.querySelector('[data-identity-count="unsaved"] strong').textContent==='0');
  assert.equal((await f.identities.get('sogne-morothon')).revision,revision+1);
  assert.equal(await page.locator('#identityPublication').isVisible(),false);
  await page.click('#resultServiceLogout');await page.locator('#login').waitFor();await context.close();f.restart();
  ({page,context,session}=await open({width:768}));
  assert.equal(await page.locator('[data-identity-count="rejected"] strong').textContent(),'1');
  assert.equal(await page.locator('[data-identity-count="followup"] strong').textContent(),'1');
 });
 await t.test('a non-JSON 401 clears the authenticated shell instead of leaving private controls visible',async()=>{
  await f.request('/logout',{},session);
  fixture.intercept(async(route,url)=>{
   if(url.pathname!=='/identity')return false;
   await route.fulfill({status:401,contentType:'text/html',body:'Session expired'});return true;
  });
  await page.click('#identityRefresh');
  await page.locator('#login').waitFor();
  assert.equal(await page.locator('#identityService').count(),0);
 });
 assert.deepEqual(fixture.errors,[]);assert.equal(f.remote.submitted,0);assert.equal(f.remote.merged,0);
 assert.ok((await fs.readFile(path.join(fixture.root,'public-data/data/history.json'))).equals(fixture.original));
});

test('staged same and different decisions leave pending immediately, undo restores them, and refresh explicitly reads without saving', {timeout:60000},async t=>{
 const fixture=await identityBrowser(t),{f,open,writes}=fixture;
 const {page}=await open();
 if(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR)await fs.mkdir(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,{recursive:true});
 const first=()=>page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'});
 const second=()=>page.locator('#identityWorklist article').filter({hasText:'Syntetisk Samme Navn'});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  await first().locator('select').selectOption('MOR-C220002');
  await first().getByRole('button',{name:'Samme person',exact:true}).click();
  assert.equal(await first().count(),0,'A same-person choice must leave pending before private submission');
  assert.equal(await page.locator('[data-identity-count="pending"] strong').textContent(),'1');
  await second().getByRole('button',{name:'Forskjellige personer',exact:true}).click();
  assert.equal(await page.locator('#identityWorklist article').count(),0,'A distinct choice must also leave pending');
  assert.equal(await page.locator('[data-identity-count="pending"] strong').textContent(),'0');
  assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'2');
  assert.equal(await page.locator('[data-identity-count="finished"] strong').textContent(),'0');
  assert.equal(await page.locator('[data-identity-count="rejected"] strong').textContent(),'0','Local choices are not saved rejections');
  assert.match(await page.locator('#identityWorklist').textContent(),/fortsatt ulagret/);
  await page.selectOption('#identityFilter','all');
  assert.match(await first().locator('.identity-unsaved').textContent(),/hovednavn: Syntetisk Kari N. Nord/);
  assert.equal(await first().locator('select').inputValue(),'MOR-C220002');
  await page.selectOption('#identityFilter','pending');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Unsaved decisions fit '+width);
  if(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.MOROTHON_IDENTITY_SCREENSHOT_DIR,'ulagrede-valg-'+width+'.png'),fullPage:true});
  for(let n=0;n<2;n++)await page.locator('#identityBatchTray').getByRole('button',{name:'Angre',exact:true}).first().click();
  assert.equal(await page.locator('#identityWorklist article').count(),2,'Undo returns both pairs to pending');
  assert.equal(await page.locator('[data-identity-count="pending"] strong').textContent(),'2');
 }
 await first().getByRole('button',{name:'Forskjellige personer',exact:true}).click();
 let release,received;
 const hold=new Promise(r=>{release=r;}),waiting=new Promise(r=>{received=r;});
 fixture.intercept(async(route,url)=>{
  if(url.pathname!=='/identity')return false;
  assert.equal(route.request().method(),'GET');received();await hold;return false;
 });
 await page.click('#identityRefresh');await waiting;
 try{
  assert.match(await page.locator('#identityServiceStatus').textContent(),/Henter lagrede avgjørelser/);
  assert.equal(await page.locator('#identityRefresh').isEnabled(),false);
 }finally{release();}
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Status hentet fra serveren'));
 assert.match(await page.locator('#identityServiceStatus').textContent(),/1 avgjørelse er fortsatt ulagret/);
 assert.match(await page.locator('#identityServiceStatus').textContent(),/Ingen lagrede avgjørelser/);
 assert.equal(await first().count(),0,'A refresh must not put a locally decided pair back into pending');
 assert.equal(await page.locator('[data-identity-count="unsaved"] strong').textContent(),'1');
 assert.equal(await page.locator('#identityBatchSubmit').textContent(),'Lagre avgjørelser privat');
 assert.equal(await page.locator('#identityBatchSubmit').isEnabled(),true);
 assert.equal(writes.length,0,'Choices, undo and refresh must not write or start a private task');
 assert.equal(f.dispatches.length,0);assert.equal(await f.identities.get('sogne-morothon'),null);
 assert.deepEqual(fixture.errors,[]);
 assert.ok((await fs.readFile(path.join(fixture.root,'public-data/data/history.json'))).equals(fixture.original));
});
