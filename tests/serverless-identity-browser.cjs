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

test('protected Personkontroll saves, approves and reopens after a fresh login; failed merges never become saved, and responsive worklists hide handled pairs', {timeout:120000},async t=>{
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
 async function open({authenticated=true,width=1440}={}){
  const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());
  const session=authenticated?await f.login():null;
  if(session)await context.addCookies([{name:'__Host-morothon-admin',value:session,url:f.origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!==f.origin)return route.abort();
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
 try {
 const {page,context,session}=await open();
 assert.equal((await fs.stat(f.directory)).mode&0o777,0o700,'The private store must create its own 0700 directory under CI umask 0022');
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Ingen lagrede'));
 assert.equal(await page.locator('#identityWorklist article').count(),2);
 assert.equal(await page.locator('#identityApprove').isEnabled(),false);
 assert.equal(await page.locator('#navCorrections').textContent(),'Resultatkontroll');
 assert.equal(await page.locator('[data-correction-tab="suggestions"]').isVisible(),false);
 assert.ok((await page.locator('#view-import').textContent()).includes('Rett og kontroller eksisterende resultater'));
 const first=page.locator('#identityWorklist article').filter({hasText:'Syntetisk Kari N. Nord'});
 assert.equal(await first.getByRole('button',{name:'Forskjellige personer',exact:true}).count(),1,'Every pending pair must expose the distinct-person quick choice');
 assert.equal(await first.getByRole('button',{name:'Samme person – velg hovednavn'}).count(),1,'Every pending pair must expose main-name review');
 const colored=await first.locator('.identity-quick-actions button').evaluateAll(buttons=>buttons.map(b=>({color:getComputedStyle(b).backgroundColor,foreground:getComputedStyle(b).color,height:b.getBoundingClientRect().height})));
 assert.equal(colored.length,2);
 assert.notEqual(colored[0].color,colored[1].color,'identity decisions must have distinct visible colors');
 assert.ok(colored.every(b=>b.height>=44),'quick choices must have usable touch targets');
 await first.getByRole('button',{name:'Samme person – velg hovednavn'}).click();
 assert.equal(await page.locator('#identityEditor').evaluate(e=>document.activeElement===e),true,'comparison must receive focus');
 assert.equal(await page.locator('#identityEditor').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=-2&&r.top<innerHeight-60;}),true,'comparison must be scrolled into the visible viewport');
 await page.selectOption('#identityMainPerson','MOR-C220002');
 const firstDecision=page.waitForResponse(r=>new URL(r.url()).pathname==='/identity/decide'&&r.request().method()==='POST');
 await page.click('#identitySame');
 assert.equal((await firstDecision).status(),202,'The authenticated identity POST must pass the real Origin gate');
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 assert.equal(await page.locator('#identityLogout').isEnabled(),true);
 assert.equal((await f.identities.get('sogne-morothon')),null);
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Lagret privat'));
 await page.waitForFunction(()=>document.querySelectorAll('#identityWorklist article').length===1);
 assert.ok((await page.locator('#identityServiceCounts').textContent()).includes('1Behandlede'));
 // The remaining identical-name profiles have overlapping starts. A failed
 // server check must not remove them or block a subsequent distinct decision.
 await page.locator('#identityWorklist button').click();
 await page.selectOption('#identityMainPerson','MOR-C220004');
 await page.click('#identitySame');await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 assert.equal((await f.processNext()).completed,false);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Overlapp'));
 assert.equal((await f.identities.get('sogne-morothon')).revision,1);
 await page.click('#identityDifferent');
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('revisjon 2'));
 assert.equal(await page.locator('#identityWorklist article').count(),0);
 const counts=await page.locator('#identityServiceCounts').textContent();
 assert.ok(counts.includes('0Ubehandlede'));assert.ok(counts.includes('1Behandlede'));assert.ok(counts.includes('1Avviste par'));
 await page.selectOption('#identityFilter','finished');assert.equal(await page.locator('#identityWorklist article').count(),1);
 await page.selectOption('#identityFilter','rejected');await page.waitForFunction(()=>document.querySelector('#identityWorklist').textContent.includes('Syntetisk Samme Navn'));
 await page.click('#identityApprove');await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('pågår'));
 assert.equal((await f.processNext()).completed,true);
 await page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Godkjent – ikke publisert'));
 assert.equal(await page.locator('#identityApprove').isEnabled(),false);
 assert.equal(writes.some(route=>route.startsWith('/publication/')),false);
 await page.click('#identityLogout');await page.locator('#login').waitFor();
 assert.equal((await f.request('/identity',undefined,session)).status,401);
 await context.close();f.restart();
 const again=await open({width:768});
 await again.page.waitForFunction(()=>document.querySelector('#identityServiceStatus').textContent.includes('Godkjent – ikke publisert'));
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
 assert.ok(modeledIdentityReads>=2,'Both fresh logins must exercise the initial read without generated Fetch Metadata');
 } catch(error) {
  const ui=await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(()=>({
   hash:location.hash,status:document.querySelector('#identityServiceStatus')?.textContent,
   result:document.querySelector('#resultServiceStatus')?.textContent,
   pending:document.querySelectorAll('#identityWorklist article').length,
  })).catch(()=>({unavailable:true}))));
  throw new Error(error.message+'\nSynthetic HTTP/UI diagnostics: '+JSON.stringify({errors,traffic,ui}),{cause:error});
 }
});
