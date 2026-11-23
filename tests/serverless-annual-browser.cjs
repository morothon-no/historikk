'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const {setup}=require('./helpers/annual-serverless.cjs'),{buildSite}=require('../scripts/build-site.cjs'),{approvedRuntime}=require('../scripts/admin/review-runtime.cjs'),
 {buildProtectedAdmin}=require('../scripts/build-protected-admin.cjs'),{ADMIN_SOURCES}=require('../scripts/lib/runtime-files.cjs'),{createAdminGateway}=require('../scripts/admin/serverless/admin-gateway.cjs');
test('protected annual web import confirms identities, saves a new year privately, reopens after login, reimports and recovers failures on desktop/mobile', {timeout:120000},async t=>{
 const f=await setup(t),root=path.resolve(__dirname,'..'),original=await fs.readFile(path.join(root,'public-data/data/history.json')),
  dir=path.join(f.directory,'browser'),data=path.join(dir,'package'),approval=path.join(dir,'approval.json');
 await fs.mkdir(path.join(data,'data'),{recursive:true});
 for(const name of ['history','honors','volunteers','badges','event-dates'])await fs.writeFile(path.join(data,'data',name+'.json'),f.repository.files.get('public-data/data/'+name+'.json'));
 await fs.writeFile(path.join(data,'manifest.json'),f.repository.files.get('public-data/manifest.json'));await fs.writeFile(approval,f.repository.files.get('.github/public-data-approval.json'));
 const built=await buildSite(path.join(dir,'site'),{dataDir:data,approvalFile:approval}),runtime=await approvedRuntime(built.out,approval);
 Object.assign(f.context,runtime);const protectedDir=path.join(dir,'worker');await buildProtectedAdmin(protectedDir);const files=new Map(runtime.files);
 for(const name of Object.keys(ADMIN_SOURCES)){let bytes=await fs.readFile(path.join(protectedDir,name));if(name==='admin/index.html')bytes=Buffer.from(bytes.toString().replace('https://morothon-admin.damofra75.workers.dev',f.origin));files.set(name,bytes);}
 const gateway=createAdminGateway({portalOrigin:f.origin,apiOrigin:f.origin,auth:f.auth,assetSource:async name=>files.has('admin/'+name)?{bytes:files.get('admin/'+name)}:null}),
  {sameOriginBrokerRead}=await import('../scripts/admin/serverless/worker.mjs'),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 let pending=Promise.resolve(),blockAnnualRead=false,malformedAnnualRead=false,holdAnnualPost=false;const held=[];f.state.afterDispatch=()=>{pending=pending.then(()=>f.processNext());};const errors=[],writes=[];
 async function open(width=1440){const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());const session=await f.login();
  await context.addCookies([{name:'__Host-morothon-admin',value:session,url:f.origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());if(url.origin!==f.origin)return route.abort();
   if(holdAnnualPost&&url.pathname==='/annual-import/preview'&&r.method()==='POST')return new Promise(resolve=>held.push(()=>route.abort().then(resolve)));
   if(malformedAnnualRead&&url.pathname==='/annual-import')return route.fulfill({status:502,contentType:'text/html',body:'Unavailable'});
   if(blockAnnualRead&&url.pathname==='/annual-import')return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Syntetisk nettverksfeil. Hent status på nytt.'})});
   const headers=await r.allHeaders();if(!r.isNavigationRequest()&&new URL(r.frame().url()).origin===f.origin){if(!headers.origin)headers['sec-fetch-site']='same-origin';if(r.method()==='POST'&&!headers.origin)headers.origin=f.origin;}
   const request=new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})});let response;
   if(url.pathname.startsWith('/admin/'))response=await gateway(request);
   else if(url.pathname.startsWith('/site/')){const bytes=files.get(url.pathname.slice(6)||'index.html');return route.fulfill({status:bytes?200:404,body:bytes||'Not found',contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.ico':'image/x-icon'})[path.extname(url.pathname)]||'application/octet-stream'});}
   else{if(r.method()==='POST')writes.push(url.pathname);response=await f.broker.fetch(sameOriginBrokerRead(request,f.origin));}
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(f.origin+'/admin/#import');
  await page.waitForFunction(()=>document.body.dataset.adminReady==='true');await page.selectOption('#annualImportKind','results');await page.locator('#annualPrivate:not([hidden])').waitFor();return {page,context,session};
 }
 async function upload(page,text){await page.setInputFiles('#resultFile',{name:'synthetic-results.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.querySelector('#resultSummary').textContent.includes('3 leste resultater'));}
 async function choices(page){const existing=page.locator('.result-case').filter({has:page.getByRole('heading',{name:'Syntetisk Kari Nord',exact:true})});
  await existing.getByLabel('Person for Syntetisk Kari Nord',{exact:true}).selectOption('MOR-C220001');
  await existing.getByRole('button',{name:'Bekreft resultatkoblingen',exact:true}).click();
  const fresh=page.locator('.result-case').filter({has:page.getByRole('heading',{name:'Syntetisk Ny Eksempel',exact:true})});
  await fresh.getByRole('textbox',{name:'Begrunnelse for Syntetisk Ny Eksempel'}).fill('Identiteten er kontrollert i den syntetiske testlisten.');await fresh.getByRole('button',{name:'Marker som ny person',exact:true}).click();
 }
 async function preview(page){const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/annual-import/preview'&&r.request().method()==='POST');await page.click('#annualPreview');assert.equal((await response).status(),202);await pending;
  await page.waitForFunction(()=>!document.querySelector('#annualPreview').disabled&&(/Serverkontrollert|Lagret privat/.test(document.querySelector('#annualPrivateStatus').textContent)||document.querySelector('#resultStatus').dataset.error==='true'));
  assert.match(await page.locator('#annualPrivateStatus').innerText(),/Serverkontrollert|Lagret privat/,await page.locator('#resultStatus').innerText());assert.equal(await page.isEnabled('#annualSave'),true);}
 async function save(page,revision){const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/annual-import/save'&&r.request().method()==='POST');await page.click('#annualSave');assert.equal((await response).status(),202);await pending;
  await page.waitForFunction(r=>!document.querySelector('#annualSave').disabled&&document.querySelector('#annualPrivateStatus').textContent.includes('Lagret privat · revisjon '+r),revision);}
 let {page,context,session}=await open();
 assert.equal(await page.getByRole('heading',{name:'Importer endelige resultater',exact:true}).isVisible(),true);
 await upload(page,f.csv());assert.equal(await page.inputValue('#resultYear'),'2027');await choices(page);await preview(page);await save(page,1);
 const saved=(await f.request('/annual-import',undefined,session)).body;assert.equal(saved.plan.newPeople.length,1);assert.equal(saved.plan.summary.dns,1);assert.equal(saved.plan.ready,true);
 assert.equal(await page.locator('#annualPrivate').getByRole('button',{name:/publiser/i}).count(),0);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.MOROTHON_P1A_REVIEW_DIR){await fs.mkdir(process.env.MOROTHON_P1A_REVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MOROTHON_P1A_REVIEW_DIR,'annual-import-'+width+'.png'),fullPage:true});}}
 const storage=await page.evaluate(()=>Object.keys(localStorage).map(k=>localStorage.getItem(k)).join(''));assert.equal(storage.includes('Syntetisk'),false);
 await f.request('/logout',{},session);await context.close();f.restart();({page,context,session}=await open(390));
 await page.click('#annualLoad');await page.waitForFunction(()=>document.querySelector('#annualPrivateStatus').textContent.includes('Hentet privat'));
 assert.equal(await page.inputValue('#resultYear'),'2027');await preview(page);await save(page,1); // exact restore/reimport cannot create a new revision
 await upload(page,f.csv('48:50'));await choices(page);await preview(page);assert.match(await page.locator('#annualPrivateSummary').innerText(),/1 endrede/);await save(page,2);
 blockAnnualRead=true;await page.click('#annualRefresh');await page.waitForFunction(()=>document.querySelector('#resultStatus').textContent.includes('Syntetisk nettverksfeil'));
 assert.equal(await page.isEnabled('#annualRefresh'),true);blockAnnualRead=false;await page.click('#annualRefresh');await page.waitForFunction(()=>document.querySelector('#annualPrivateStatus').textContent.includes('Lagret privat · revisjon 2'));
 malformedAnnualRead=true;await page.click('#annualRefresh');await page.waitForFunction(()=>document.querySelector('#resultStatus').textContent.includes('Serverresultatet er ukjent'));
 assert.equal(await page.isEnabled('#annualRefresh'),true);malformedAnnualRead=false;
 // Exercise the actual fetch AbortController without spending 20 seconds in
 // every CI run. Virtual browser time changes no server/authorization clock.
 await page.clock.install();holdAnnualPost=true;const outgoing=page.waitForRequest(r=>new URL(r.url()).pathname==='/annual-import/preview'&&r.method()==='POST');
 await page.click('#annualPreview');await outgoing;await page.clock.fastForward(20001);
 await page.waitForFunction(()=>document.querySelector('#annualPrivateStatus').textContent.includes('Serverresultatet er ukjent'));
 assert.equal(await page.isEnabled('#annualRefresh'),true);holdAnnualPost=false;for(const release of held)await release();
 await page.clock.resume();await page.click('#annualRefresh');await page.waitForFunction(()=>document.querySelector('#annualPrivateStatus').textContent.includes('Lagret privat · revisjon 2'));
 await pending;assert.deepEqual(errors,[]);assert.equal(writes.some(p=>p.startsWith('/publication/')||p.startsWith('/identity/')),false);
 const nextApproval=JSON.parse(f.repository.files.get('.github/public-data-approval.json'));nextApproval.dataVersion++;
 f.repository.files.set('.github/public-data-approval.json',Buffer.from(JSON.stringify(nextApproval)));
 await page.click('#annualRefresh');await page.waitForFunction(()=>document.querySelector('#annualPrivateStatus').textContent.includes('Historikken er oppdatert'));
 assert.equal(await page.isEnabled('#annualSave'),false);assert.equal(await page.isEnabled('#annualPreview'),false);
 assert.deepEqual(await fs.readFile(path.join(root,'public-data/data/history.json')),original);assert.equal((await f.request('/annual-import',undefined,session)).body.plan.operations.find(o=>o.after?.[4]==='DNF').after[5],'');
});
