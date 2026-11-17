// Trusted checkout integration tests. Provider accounts, credentials and results are synthetic.
'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),https=require('node:https'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto');
const {chromium}=require('playwright'),{buildSite}=require('../scripts/build-site.cjs'),{entry,sha256,approvalFor}=require('../scripts/lib/public-package.cjs');
const {approvedRuntime,createProjector}=require('../scripts/admin/review-runtime.cjs'),{createGitHubAuth}=require('../scripts/admin/github-auth.cjs'),{privateFileStore}=require('../scripts/admin/review-workspace.cjs'),{createResultReview}=require('../scripts/admin/result-review.cjs'),{createWebHandler}=require('../scripts/admin/web-server.cjs');
const {createAccountDirectory}=require('../scripts/admin/account-directory.cjs');
const userId='11111111-1111-4111-8111-111111111111';
const fixture=require('./public/quick/fixtures/corrections-data.js');
const root=path.resolve(__dirname,'..');let dir,browser,server,origin,runtime,handler,makeService,review,auth,resetAuth;
before(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-web-auth-synthetic-'));
 const dataDir=path.join(dir,'public'),approvalFile=path.join(dir,'approval.json');await fs.cp(path.join(root,'public-data'),dataDir,{recursive:true});
 const bytes=Buffer.from(JSON.stringify(fixture.history())),manifest=JSON.parse(await fs.readFile(path.join(dataDir,'manifest.json')));manifest.dataVersion++;manifest.historySha256=sha256(bytes);manifest.files['data/history.json']=entry(bytes);
 const manifestBytes=Buffer.from(JSON.stringify(manifest)),approval=approvalFor(manifestBytes);await fs.writeFile(path.join(dataDir,'manifest.json'),manifestBytes);await fs.writeFile(path.join(dataDir,'data/history.json'),bytes);await fs.writeFile(approvalFile,JSON.stringify(approval));
 const build=await buildSite(path.join(dir,'site'),{dataDir,approval});runtime=await approvedRuntime(build.out,approvalFile);
 const keyFile=path.join(dir,'test-key.pem'),certFile=path.join(dir,'test-cert.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 server=https.createServer({key:await fs.readFile(keyFile),cert:await fs.readFile(certFile)},(req,res)=>handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='https://localhost:'+server.address().port;
 // Existing test-container Chromium has no SUID/userns sandbox. Production
 // createProjector defaults to a sandbox and never falls back to this test launch.
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const projector=await createProjector(runtime,{browser}),key=randomBytes(32);
 resetAuth=(role='owner')=>{auth=createGitHubAuth({origin,clientId:'synthetic-client',clientSecret:'synthetic-secret',accounts:createAccountDirectory({users:[{userId,active:true}],externalIdentities:[{provider:'github',subject:'12345',userId}],memberships:[{userId,organizerId:'sogne-morothon',role,active:true}]}),fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/user')?{id:12345}:{access_token:'synthetic-provider-token'}})});};resetAuth();
 makeService=()=>createResultReview({authenticate:req=>auth.authenticate(req),loadContext:async org=>{assert.equal(org,'sogne-morothon');return {...runtime,project:projector.project};},store:privateFileStore({directory:path.join(dir,'private'),key})});
 review=makeService();handler=createWebHandler({auth,review,runtime});
});
after(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(dir)await fs.rm(dir,{recursive:true,force:true});});
async function open(){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Execute the real begin handler and preserve its browser-binding cookie. Only
 // replace the provider redirect; no test ever sends a request to live GitHub.
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
  if(url.pathname!=='/auth/github')return route.continue();
  const response=await route.fetch({maxRedirects:0}),headers=response.headers(),state=new URL(headers.location).searchParams.get('state');
  return route.fulfill({response,headers:{...headers,location:origin+'/auth/github/callback?code=synthetic&state='+state}});
 });
 await page.goto(origin+'/admin/');await page.getByRole('link',{name:'Logg inn med GitHub',exact:true}).click();
 try{await page.locator('#serverReview').waitFor();}catch(e){throw Error('Admin initialization: '+page.url()+' / '+JSON.stringify(errors)+' / '+(await page.locator('body').innerText()).slice(-2800));}
 return {context,page,errors};
}
test('authenticated admin denies anonymous writes, bad origins, forged roles, arbitrary files and publication routes',async()=>{
 const context=await browser.newContext({ignoreHTTPSErrors:true});try{
  for(const method of ['get','post']){const r=await context.request[method](origin+'/admin-api/review',{data:{role:'owner'}});assert.equal(r.status(),401);}
  assert.equal((await context.request.get(origin+'/scripts/admin/review-workspace.cjs')).status(),404);
  assert.equal((await context.request.get(origin+'/data/honors.json')).status(),200); // Approved public projection only.
 }finally{await context.close();}
 const f=await open();try{
  const response=await f.context.request.get(origin+'/admin-api/session'),session=await response.json();assert.equal(session.role,'owner');assert.equal(session.canPublish,false);
  const forged=await f.context.request.post(origin+'/admin-api/review/save',{headers:{Origin:'https://attacker.test','X-Morothon-CSRF':session.csrf},data:{draft:{},expectedRevision:0}});assert.equal(forged.status(),403);
  const noCsrf=await f.context.request.post(origin+'/admin-api/review/save',{headers:{Origin:origin},data:{draft:{},expectedRevision:0}});assert.equal(noCsrf.status(),403);
  const tenant=await f.context.request.post(origin+'/admin-api/review/save',{headers:{Origin:origin,'X-Morothon-CSRF':session.csrf},data:{draft:{},expectedRevision:0,organizer:'another',role:'owner'}});assert.equal(tenant.status(),400);
  assert.equal((await f.context.request.post(origin+'/admin-api/publish',{headers:{Origin:origin,'X-Morothon-CSRF':session.csrf},data:{}})).status(),400);
  assert.equal(response.headers()['cache-control'],'no-store');assert.equal(response.headers()['access-control-allow-origin'],undefined);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('browser result correction uses existing UI and real engines, survives closing browser/service restart, and separately approves without public changes',async()=>{
 const before=Buffer.from(runtime.files.get('data/history.json')),f=await open();
 try{
  await f.page.locator('a[href="#deltakere"]').first().click();await f.page.fill('#participantSearch','Syntetisk Kari Nord');await f.page.locator('.participant-row').filter({has:f.page.getByText('Syntetisk Kari Nord',{exact:true})}).getByRole('button',{name:'Se historikk',exact:true}).click();
  await f.page.getByRole('button',{name:'Rett et resultat',exact:true}).click();await f.page.locator('#correctionEditor').waitFor();
  const choice=f.page.locator('#correctionResultChoice');const index=fixture.history().results.findIndex(r=>r[0]===2022);await choice.selectOption(String(index));await f.page.fill('#correctionField5','49:58');
  await f.page.locator('#correctionOtherChoices > summary').click();await f.page.fill('#correctionSource','Syntetisk kontrollert tidtakerkilde');await f.page.fill('#correctionReason','Riktig sluttid er kontrollert i syntetisk kilde.');
  await f.page.locator('#correctionApprove').click();await f.page.waitForFunction(()=>document.querySelector('#correctionStatus').textContent.includes('klargjort'));
  await f.page.click('#serverReviewPreview');await f.page.waitForFunction(()=>document.querySelector('#serverReviewDiff').textContent.includes('49:58'));
  assert.match(await f.page.locator('#serverReviewDiff').innerText(),/50:00/);assert.match(await f.page.locator('#serverReviewDiff').innerText(),/bestått/);
  await f.page.click('#serverReviewSave');await f.page.waitForFunction(()=>document.querySelector('#serverReviewStatus').textContent.includes('Utkast · revisjon 1'));
  // Typing after a preview must not approve or silently save the previous field value.
  await f.page.fill('#correctionField5','49:57');assert.equal(await f.page.isDisabled('#serverReviewApprove'),true);
  await f.page.click('#serverReviewPreview');await f.page.waitForFunction(()=>document.querySelector('#serverReviewDiff').textContent.includes('49:57'));
  await f.page.click('#serverReviewSave');await f.page.waitForFunction(()=>document.querySelector('#serverReviewStatus').textContent.includes('Utkast · revisjon 2'));
  // A slow server response must not mark text typed during the save as saved.
  let releaseSave,saveStarted;const gate=new Promise(r=>{releaseSave=r;}),started=new Promise(r=>{saveStarted=r;});
  const hold=async route=>{saveStarted();await gate;await route.continue();};await f.page.route(origin+'/admin-api/review/save',hold);
  await f.page.click('#serverReviewSave');await started;await f.page.fill('#correctionField5','49:56');releaseSave();
  await f.page.waitForFunction(()=>document.querySelector('#serverReviewStatus').textContent.includes('Utkast · revisjon 3'));
  assert.equal(await f.page.isDisabled('#serverReviewApprove'),true);assert.equal(await f.page.inputValue('#correctionField5'),'49:56');
  const duringSave=await(await f.context.request.get(origin+'/admin-api/review')).json();assert.equal(duringSave.draft.cases[0].change.after[5],'49:57');
  await f.page.unroute(origin+'/admin-api/review/save',hold);await f.page.click('#serverReviewSave');await f.page.waitForFunction(()=>document.querySelector('#serverReviewStatus').textContent.includes('Utkast · revisjon 4'));
  for(const width of [1440,768,390]){await f.page.setViewportSize({width,height:1050});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.MOROTHON_C1_REVIEW_DIR){await fs.mkdir(path.join(process.env.MOROTHON_C1_REVIEW_DIR,'issue82'),{recursive:true});await f.page.screenshot({path:path.join(process.env.MOROTHON_C1_REVIEW_DIR,'issue82','resultatutkast-'+width+'.png'),fullPage:true});}}
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 // Recreate the service with the same private encrypted storage; no browser state.
 resetAuth();review=makeService();handler=createWebHandler({auth,review,runtime});
 const fresh=await open();try{
  await fresh.page.click('#serverReviewLoad');await fresh.page.waitForFunction(()=>document.querySelector('#correctionBody').textContent.includes('Syntetisk Kari Nord'));
  assert.match(await fresh.page.locator('#serverReviewStatus').innerText(),/Utkast · revisjon 4/);assert.equal(await fresh.page.isDisabled('#serverReviewApprove'),false);
  fresh.page.once('dialog',d=>d.accept());await fresh.page.click('#serverReviewApprove');await fresh.page.waitForFunction(()=>document.querySelector('#serverReviewStatus').textContent.includes('Godkjent · ikke publisert'));
  const stored=await fresh.context.request.get(origin+'/admin-api/review');const data=await stored.json();assert.equal(data.draft.cases[0].change.after[5],'49:56');assert.equal(data.approval.by,userId);assert.equal(data.productionApplied,false);
  const publicResult=await fresh.context.request.get(origin+'/data/history.json');assert.deepEqual(await publicResult.body(),before);assert.deepEqual(fresh.errors,[]);
 }finally{await fresh.context.close();}
});
test('HTTP API enforces viewer/editor privileges independently of client buttons or role claims',async()=>{
 for(const role of ['viewer','editor']){
  resetAuth(role);review=makeService();handler=createWebHandler({auth,review,runtime});const f=await open();try{
   const session=await(await f.context.request.get(origin+'/admin-api/session')).json();assert.equal(session.role,role);
   const headers={Origin:origin,'X-Morothon-CSRF':session.csrf};
   assert.equal((await f.context.request.get(origin+'/admin-api/review')).status(),200);
   assert.equal((await f.context.request.post(origin+'/admin-api/review/approve',{headers,data:{expectedRevision:0,expectedDigest:'a'.repeat(64)}})).status(),403);
   if(role==='viewer')assert.equal((await f.context.request.post(origin+'/admin-api/review/save',{headers,data:{expectedRevision:0,draft:{}}})).status(),403);
   assert.equal(await f.page.isDisabled('#serverReviewApprove'),true);
  }finally{await f.context.close();}
 }
 resetAuth();review=makeService();handler=createWebHandler({auth,review,runtime});
});
test('approved Morothon correction is replayed only in an isolated source copy, with real projections and no result/person file changes',async()=>{
 const C=require('../tools/diploma-admin/intake-model.js').Corrections,{changes}=require('./public/quick/fixtures/historical-corrections.js');
 const sourceFile=path.join(root,'public-data/data/history.json'),original=await fs.readFile(sourceFile),history=JSON.parse(original),change=changes[2];
 const index=history.results.findIndex(r=>JSON.stringify(r)===JSON.stringify(change.after));assert.ok(index>=0);
 history.results[index]=[...change.before]; // Reproduce the already documented, corrected event/distance only.
 const base=await C.binding(history,{dataVersion:2,manifestSha256:'a'.repeat(64),historySha256:sha256(Buffer.from(JSON.stringify(history)))}),projector=await createProjector(runtime,{browser});
 const store=privateFileStore({directory:path.join(dir,'documented-source-replay'),key:randomBytes(32)}),service=createResultReview({authenticate:async()=>({subject:userId,organizers:{'sogne-morothon':['review','approve']},roles:{'sogne-morothon':'owner'}}),loadContext:async()=>({history,base,project:projector.project}),store});
 let draft=C.report(C.empty(base),{id:'documented-event-correction',category:'Innmeldt feil',personIds:[change.before[1]],description:'Gjenspilling av en allerede dokumentert historisk øvelsesrettelse',source:'Tidligere arrangørgodkjent korrigering fra november 2026'});
 draft=await C.propose(history,draft,'documented-event-correction',{kind:'result',personIds:[change.before[1]],selector:await C.resultSelector(history,index,base),after:change.after,source:'Tidligere arrangørgodkjent korrigering fra november 2026',reason:'Kontrollert gjenspilling i isolert test. Ingen ny historisk påstand.'});
 const input={session:'synthetic-authenticated-session',organizer:'sogne-morothon'},preview=await service.preview({...input,draft});
 assert.equal(preview.review.ready,true);assert.deepEqual(preview.review.changes[0].after,change.after);assert.ok(preview.review.changed.includes('people'));
 await service.save({...input,expectedRevision:0,draft});const read=await service.load(input);assert.equal(read.status,'draft');
 await service.approve({...input,expectedRevision:read.revision,expectedDigest:read.digest});
 assert.deepEqual(await fs.readFile(sourceFile),original);assert.deepEqual(history.results[index],change.before);
});
