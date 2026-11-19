const {legacyAdminFixture}=require('./_support/legacy-admin-fixture.js');
// A static server mimics Pages at the custom-domain / base. No Node admin/API.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright'),{buildSite,validatePublicSite}=require('../../../scripts/build-site.cjs'),{validate}=require('../../../web-admin/profile-contract.js');
let dir,out,browser,server,base,profile,registry,build,legacy;
before(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-web-admin-'));build=await buildSite(path.join(dir,'site'));legacy=await legacyAdminFixture(build,path.join(dir,'private-admin-preview'));profile=JSON.parse(await fs.readFile(legacy.filePath('admin/event-profile.json')));registry=JSON.parse(await fs.readFile(path.join(build.out,'data/badges.json')));
 out=process.env.MOROTHON_C1_REVIEW_DIR?path.join(process.env.MOROTHON_C1_REVIEW_DIR,'web-c12'):path.join(dir,'review');await fs.mkdir(out,{recursive:true});const files=new Set([...build.files,...legacy.files]);
 server=http.createServer(async(req,res)=>{let name=new URL(req.url,'http://static').pathname;const prefixed=name.startsWith('/historikk/');if(prefixed)name=name.slice('/historikk'.length);if(req.method!=='GET'||!name.startsWith('/'))return res.writeHead(404).end();name=name.slice('/'.length);if(name.endsWith('/')||!name)name+='index.html';if(!files.has(name))return res.writeHead(404).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff'})[path.extname(name)]||'application/octet-stream');let bytes=await fs.readFile(legacy.filePath(name));if(prefixed&&name==='build-info.json'){const info=JSON.parse(bytes);info.siteUrl=new URL('historikk/',info.siteUrl).href;bytes=Buffer.from(JSON.stringify(info));}res.end(bytes);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));if(dir)await fs.rm(dir,{recursive:true,force:true});});

async function openHonorDetails(page,id){
 const ids=await page.locator('#'+id).evaluate(el=>{const found=[];for(let n=el;n;n=n.parentElement)if(n.tagName==='DETAILS')found.unshift(n.id);return found;});
 for(const key of ids){const section=page.locator('#'+key);if(!await section.evaluate(e=>e.open))await section.locator(':scope > summary').click();}
}
async function editHonorSection(page,id,label){await openHonorDetails(page,id);await page.locator('#'+id).getByRole('button',{name:label,exact:true}).click();}

test('C1.2 profile contract rejects unknown/private fields, CSS/URL injection and unimplemented policy changes',()=>{
 assert.equal(validate(profile,registry).id,'sogne-morothon');
 for(const alter of [p=>p.internalNotes='private',p=>p.colors.primary='url(https://bad.example/x)',p=>p.fonts.ui='https://bad.example/font',p=>p.logoAssetId='https://bad.example/logo',p=>p.references.participationPolicy='automatic-awards',p=>p.references.diplomaTemplate='free-html',p=>p.modules.oversikt=false,p=>p.texts.welcomeTitle='<script>bad</script>',p=>p.modules.import='enabled']){const bad=structuredClone(profile);alter(bad);assert.throws(()=>validate(bad,registry));}
});
test('C1.2 public inventory excludes admin; isolated preview verifies legacy UI and rejects private profile fields',async()=>{
 assert.equal(build.files.length,59);assert.equal(build.files.filter(f=>f.startsWith('admin/')).length,0);assert.equal(legacy.files.size,15);
 for(const file of ['admin/worker.cjs','admin/api.cjs','scripts/diploma-admin.cjs','data/private.json'])assert.equal(build.files.includes(file),false);
 assert.deepEqual(await fs.readFile(path.join(build.out,'data/history.json')),await fs.readFile(path.resolve(__dirname,'../../../public-data/data/history.json')));
 const html=await fs.readFile(legacy.filePath('admin/index.html'),'utf8');assert.match(html,/noindex, nofollow/);assert.doesNotMatch(html,/__LOCAL_TOKEN__|<meta name="local-session"|src="\/admin/);assert.match(html,/Offentlig testversjon/);
 const extra=path.join(build.out,'admin/private.json');try{await fs.mkdir(path.dirname(extra));await fs.writeFile(extra,'{}');await assert.rejects(()=>validatePublicSite(build.out),/Unexpected or missing/);}finally{await fs.rm(path.dirname(extra),{recursive:true,force:true});}
 assert.throws(()=>validate({...profile,privateNotes:'no'},registry));
 assert.equal((await validatePublicSite(build.out)).visiblePeople,43);
});
async function loaded(p,hash='oversikt'){await p.goto(base+'admin/#'+hash);await p.locator('#view-'+hash+':not([hidden])').waitFor();if(hash==='oversikt')await p.locator('#overviewMetrics .metric-card').first().waitFor();}
async function preview(p,name,kind='runner',display='latest'){
 await p.getByRole('navigation').getByRole('link',{name:/Diplomer/}).click();await p.locator('#view-diplomer').waitFor();await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Klar.'));
 await p.selectOption('#kind',kind);await p.selectOption('#display',display);await p.fill('#search',name);await p.waitForFunction(()=>document.querySelectorAll('.recipient').length===1);
 await p.locator('.recipient').getByRole('button',{name:'Vis',exact:true}).click();await p.locator('#preview[open]').waitFor();
 await p.waitForFunction(()=>document.querySelector('#preview iframe').contentDocument?.querySelector('.diploma-sheet'));
}
test('C1.2 static Pages portal works on desktop, tablet and mobile without API calls, localhost links, or write requests',async()=>{
 const c=await browser.newContext({viewport:{width:1440,height:1050}}),p=await c.newPage(),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('request',r=>requests.push({url:r.url(),method:r.method()}));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url());});
 try{
 await loaded(p);assert.match(await p.locator('#overviewMetrics').innerText(),/398/);assert.match(await p.locator('#overviewMetrics').innerText(),/22/);
 await p.getByRole('navigation').getByRole('link',{name:'Deltakere'}).click();await p.fill('#participantSearch','Inger Katherin');await p.waitForFunction(()=>document.querySelectorAll('.participant-row').length===1);await p.getByRole('button',{name:'Se historikk',exact:true}).click();await p.locator('#participantDialog[open]').waitFor();
 assert.match(await p.locator('#participantDetail').innerText(),/12/);assert.match(await p.locator('#participantDetail').innerText(),/2024/);const href=await p.locator('#participantDetail a').getAttribute('href');assert.ok(href.startsWith(base+'index.html#lop='));await p.click('#closeParticipant');
 await p.getByRole('navigation').getByRole('link',{name:'Merker',exact:true}).click();await p.fill('#badgeSearch','Inger Katherin');await p.waitForFunction(()=>document.querySelectorAll('.runner-badge-card').length===1);
 assert.match(await p.locator('#badgeList').innerText(),/2024/);await p.selectOption('#badgeView','upcoming');await p.waitForFunction(()=>document.querySelector('#badgeList').textContent.includes('3 deltakelser igjen til 15'));
 await p.getByRole('navigation').getByRole('link',{name:'Årets arrangement'}).click();await p.locator('#intakeFile').waitFor();assert.match(await p.locator('#view-import').innerText(),/midlertidig analyse/);
 await p.getByRole('navigation').getByRole('link',{name:/Premier/}).click();assert.match(await p.locator('#view-premier').innerText(),/Ingen bestilling/);
 await preview(p,'Inger Katherin');assert.match(await p.locator('#previewStatus').innerText(),/^Godkjent/);
 const metric=await p.locator('#preview iframe').evaluate(f=>({count:f.contentDocument.querySelector('.diploma-achievement').textContent,date:f.contentDocument.querySelector('.diploma-date').textContent}));assert.equal(metric.count,'10');assert.match(metric.date,/9\. november 2024/);
 await p.evaluate(()=>{document.querySelector('#preview iframe').contentWindow.print=()=>{window.__prints=(window.__prints||0)+1;};});await p.getByRole('button',{name:'Skriv ut valgt diplom',exact:true}).click();await p.waitForFunction(()=>window.__prints===1);
 await p.locator('#preview iframe').evaluate(f=>{f.contentDocument.querySelector('.diploma-recipient h2').textContent='FEIL NAVN';});await p.getByRole('button',{name:'Skriv ut valgt diplom',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#previewStatus').textContent.startsWith('Sperret:'));assert.equal(await p.evaluate(()=>window.__prints),1);await p.click('#closePreview');
 // The new collection stays a marked control copy. No native print bypass.
 await p.selectOption('#display','all');await p.locator('.recipient').getByRole('button',{name:'Vis',exact:true}).click();await p.locator('#preview[open]').waitFor();assert.match(await p.locator('#previewStatus').innerText(),/^Kontrollkopi/);
 assert.deepEqual(await p.locator('#preview iframe').evaluate(f=>[...f.contentDocument.querySelectorAll('.c1-collection img')].map(i=>i.dataset.c1Badge)),['badge-5']);await p.click('#closePreview');
 await p.click('#demo');await p.click('#check');await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Kontrollen er ferdig'),{timeout:120000});await p.check('#allowControl');assert.equal(await p.locator('#export').isDisabled(),true);assert.match(await p.locator('#webLimitations').innerText(),/krever.*C1-server/);
 const unavailable=await p.evaluate(async()=>{try{await MorothonAdminTransport.request('export',{items:[]});return false;}catch(e){return e.message;}});assert.match(unavailable,/krever C1-serveren/);
 for(const width of [1440,768,390]){await p.setViewportSize({width,height:1050});await p.getByRole('navigation').getByRole('link',{name:'Oversikt'}).click();await p.locator('#view-oversikt').waitFor();await p.screenshot({path:path.join(out,'oversikt-'+width+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.getByRole('navigation').getByRole('link',{name:/Diplomer/}).click();await p.locator('#view-diplomer').waitFor();await p.screenshot({path:path.join(out,'diplomer-'+width+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.ok(requests.every(r=>r.method==='GET'));assert.ok(requests.filter(r=>r.url.startsWith('http')).every(r=>r.url.startsWith(base)));assert.ok(!requests.some(r=>new URL(r.url).pathname.includes('/api/')));assert.deepEqual(errors,[]);
 }finally{await c.close();}
});
test('C1.2 Heder uses existing approvals, full collections, hidden-person filtering and Einars explicit date in the static browser',async()=>{
 const c=await browser.newContext(),p=await c.newPage();try{await loaded(p);await preview(p,'Oscar Lohne','honor','all');assert.match(await p.locator('#previewStatus').innerText(),/^Godkjent/);
 assert.equal(await p.locator('#preview iframe').evaluate(f=>f.contentDocument.querySelectorAll('.diploma-service-founder img').length),1);
 const html=await p.locator('#preview iframe').getAttribute('srcdoc');const q=await c.newPage();try{await q.goto(base);await q.setContent(html);await q.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});const pdf=path.join(out,'oscar-enkeltvisning-a4.pdf');await q.pdf({path:pdf,landscape:true,format:'A4',preferCSSPageSize:true,printBackground:true});const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});assert.match(info,/Pages:\s+1/);const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size&&Math.abs(+size[1]-841.89)<1&&Math.abs(+size[2]-595.28)<1);assert.match(execFileSync('pdffonts',[pdf],{encoding:'utf8'}),/Caveat/);}finally{await q.close();}
 await p.click('#closePreview');await p.fill('#search','Einar Danielsen');await p.locator('.recipient').getByRole('button',{name:'Vis',exact:true}).click();await p.locator('#preview[open]').waitFor();assert.match(await p.locator('#previewStatus').innerText(),/^Kontrollkopi/);assert.match(await p.locator('#preview iframe').evaluate(f=>f.contentDocument.querySelector('.diploma-date').textContent),/7\. november 2026/);await p.click('#closePreview');await p.fill('#search','Erling Danielsen');assert.equal(await p.locator('.recipient').count(),0);
 }finally{await c.close();}
});
test('C1.2 event branding/module configuration changes presentation, never the participation policy or stored results',async()=>{
 const c=await browser.newContext(),p=await c.newPage(),custom=structuredClone(profile);custom.name='Testløpet';custom.colors.primary='#743a32';custom.fonts.display='system-sans';custom.modules.import=false;custom.modules.premier=false;custom.texts.pages.oversikt.title='Arrangøroversikt';custom.texts.welcomeTitle='Velkommen til testløpet';
 await p.route('**/admin/event-profile.json',r=>r.fulfill({json:custom}));try{await loaded(p);assert.equal(await p.locator('#pageTitle').innerText(),'Arrangøroversikt');assert.match(await p.locator('.portal-brand').innerText(),/TESTLØPET/);await p.locator('#navCorrections').waitFor();await p.locator('#navHeder').waitFor();assert.equal(await p.locator('.sidebar nav a:visible').count(),7);assert.match(await p.locator('#overviewMetrics').innerText(),/398/);await p.evaluate(()=>location.hash='#import');await p.waitForFunction(()=>location.hash==='#oversikt');assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.sidebar')).backgroundColor),'rgb(116, 58, 50)');}finally{await c.close();}
});
test('C1.2 a changed release refuses further preview/print instead of silently reusing stale approvals',async()=>{
 const c=await browser.newContext(),p=await c.newPage();try{await loaded(p);await p.route('**/build-info.json',async route=>{const r=await route.fetch(),j=await r.json();j.version='0'.repeat(16);await route.fulfill({json:j});});const error=await p.evaluate(async()=>{try{await MorothonAdminTransport.request('check',{items:[{kind:'runner',personId:'MOR-C788866',key:'badge:10',display:'latest'}]});return false;}catch(e){return e.message;}});assert.match(error,/oppdatert/);}finally{await c.close();}
});

test('C1.2 Pages smoke script verifies public site bytes, not protected admin assets, and rejects stale releases',async()=>{
 const vm=require('node:vm'),workflow=await fs.readFile(path.resolve(__dirname,'../../../.github/workflows/pages.yml'),'utf8');
 const step=workflow.split('      - name: Verify public site and absence of admin files after deployment')[1];assert.ok(step);
 const script=step.split("node <<'JS'\n")[1].split('          JS')[0].split('\n').map(line=>line.slice(10)).join('\n');
 const local=JSON.parse(await fs.readFile(path.join(build.out,'build-info.json'),'utf8'));
 for(const stale of [false,true]){
  const process={env:{PAGES_URL:local.siteUrl},exitCode:0};let requested=0;
  const sandbox={process,URL,Buffer,AbortSignal,setTimeout:fn=>{fn();},console:{log(){},error(){}},require:name=>name==='node:fs/promises'?{readFile:(file,encoding)=>fs.readFile(path.join(build.out,file.slice('_site/'.length)),encoding)}:require(name),fetch:async url=>{
   requested++;const file=new URL(url).pathname.slice('/'.length);const bytes=await fs.readFile(path.join(build.out,file));return {ok:true,arrayBuffer:async()=>stale&&file==='build-info.json'?Buffer.from('wrong release'):bytes};
  }};
  await vm.runInNewContext(script,sandbox);assert.equal(process.exitCode,stale?1:0);assert.ok(requested>15);
 }
});

test('Issue 80 web Heder exposes 43 approved profiles, separate memorials and no private DTO fields',async()=>{
 const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  const started=performance.now();await loaded(p,'heder');await p.locator('#honorList button').first().waitFor();
  const data=await p.evaluate(()=>MorothonAdminTransport.request('honors'));
  assert.equal(data.people.length,43);assert.equal(data.summary.memorial,3);assert.equal(data.people.some(x=>x.id==='erling-danielsen'),false);
  assert.equal(await p.locator('#honorList button').count(),43);assert.equal(await p.locator('#honorList h3').filter({hasText:'Til minne om'}).count(),1);
  for(const width of [1440,768,390]){await p.setViewportSize({width,height:1050});await p.screenshot({path:path.join(out,'heder-web-oversikt-'+width+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  for(const x of data.people.filter(x=>x.memorial)){
   await p.locator('#honorList').getByRole('button',{name:x.name,exact:true}).click();assert.match(await p.locator('#honorDetail').innerText(),/Til minne om/);
   if(x.memorialInfo.tribute){assert.equal(await p.locator('#honorReadMemorial').isVisible(),false);await openHonorDetails(p,'honorReadMemorial');assert.ok((await p.locator('#honorDetail').innerText()).includes(x.memorialInfo.tribute));}
  }
  for(const x of data.people.filter(x=>x.stories.length||x.honorDiplomaText)){
   await p.locator('#honorList').getByRole('button',{name:x.name,exact:true}).click();const text=await p.locator('#honorDetail').textContent();
   for(const story of x.stories){if(story.title)assert.ok(text.includes(story.title));assert.ok(text.includes(story.text));}
   if(x.honorDiplomaText)assert.ok(text.includes(x.honorDiplomaText));
  }
  const raw=JSON.stringify(data);for(const key of ['sourceMember','sourceDetails','sourceIds','internalNotes','revisionHistory'])assert.equal(raw.includes('"'+key+'"'),false);
  await fs.writeFile(path.join(out,'heder-web-metrics.json'),JSON.stringify({profiles:data.people.length,memorials:data.summary.memorial,firstVisitAndReviewMs:Math.round(performance.now()-started)},null,2));
  await p.goto(base);assert.equal(await p.locator('a[href*="admin/"]').count(),0);assert.equal(await p.locator('nav a[href*="heder"]').count(),0);assert.deepEqual(errors,[]);
 }finally{await c.close();}
});

test('Issue 80 web editor reuses reviewed year/role/identity logic, keeps text inert and never saves or sends drafts',async()=>{
 const c=await browser.newContext({viewport:{width:1440,height:1050}}),p=await c.newPage(),requests=[],errors=[];p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 try{
  await loaded(p,'heder');await p.locator('#honorList button').first().waitFor();
  const before=await p.evaluate(()=>MorothonAdminTransport.request('honors')),person=before.people.find(x=>!x.memorial&&x.tenure.basis==='documented');
  await p.locator('#honorList').getByRole('button',{name:person.name,exact:true}).click();await p.click('#honorEdit');await p.locator('#honorDraftForm').waitFor();
  await p.fill('#honorDraftName','Syntetisk <img src=x onerror="window.__hederXss=1">');await p.fill('#honorDraftDescription','Syntetisk omtale i fanen');await editHonorSection(p,'honorDraftDiploma','Rediger personlig diplomtekst');await p.fill('#honorDraftText','Syntetisk personlig diplomtekst');
  await editHonorSection(p,'honorDraftRoles','Rediger roller og oppgaver');await p.getByRole('button',{name:'Legg til rolle',exact:true}).click();const role=p.locator('.honor-draft-role').last();await role.locator('[data-field="title"]').fill('Syntetisk styreverv');await role.locator('[data-field="countsForTenure"]').uncheck();
  await editHonorSection(p,'honorDraftStories','Rediger historier og kilder');await p.getByRole('button',{name:'Legg til historie',exact:true}).click();const story=p.locator('.honor-draft-story').last();await story.locator('[data-field="title"]').fill('Syntetisk tittel');await story.locator('[data-field="text"]').fill('<svg onload="window.__hederXss=1">Syntetisk historie');
  await openHonorDetails(p,'honorDraftBasis');await p.selectOption('#honorDraftMode','period');await p.check('#honorDraftActive');const ids=await p.locator('#honorDraftFrom option').evaluateAll(ns=>ns.filter(n=>n.value).map(n=>n.value));await p.selectOption('#honorDraftFrom',ids.at(-5));
  await p.getByRole('button',{name:'Foreslå gjennomførte utgaver i perioden',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='5');
  await openHonorDetails(p,'honorDraftAbsences');await p.check('#honorAbsent-'+ids.at(-1));await p.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='4');assert.match(await p.locator('#honorDraftPreview').innerText(),/Foreslåtte utgaver/);
  const linked=new Set(before.people.filter(x=>x.runnerLink).map(x=>x.runnerLink.runnerId));const candidates=await p.evaluate(()=>MorothonAdminTransport.request('participants'));const runner=candidates.people.find(x=>!linked.has(x.id));
  await p.fill('#honorDraftRunnerSearch',runner.name);await p.getByRole('button',{name:'Finn løperkandidater for utkastet',exact:true}).click();await p.locator('#honorDraftRunnerResults .honor-candidate').filter({hasText:runner.id}).getByRole('button',{name:'Velg kandidat',exact:true}).click();
  assert.equal(await p.locator('#honorDraftIdentityConfirmed').isChecked(),false);await p.check('#honorDraftIdentityConfirmed');await p.waitForFunction(id=>document.querySelector('#honorDraftPreview').textContent.includes(id),runner.id);await openHonorDetails(p,'honorDraftChecks');await p.check('#honorDraftReviewed');
  assert.equal(await p.locator('#honorDraftKeep').isDisabled(),true);assert.match(await p.locator('#honorDraftKeep').innerText(),/krever innlogging/);
  assert.equal(await p.evaluate(()=>window.__hederXss||0),0);assert.equal(await p.locator('#honorDraftPreview svg,#honorDraftPreview img[src="x"]').count(),0);
  const denied=await p.evaluate(async()=>{try{await MorothonAdminTransport.request('honors/drafts/keep',{});return {};}catch(e){return {status:e.status,message:e.message};}});assert.equal(denied.status,503);assert.match(denied.message,/autentisert webtjeneste/);
  for(const width of [1440,768,390]){await p.setViewportSize({width,height:1050});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(out,'heder-web-editor-'+width+'.png'),fullPage:true});}
  assert.deepEqual(await p.evaluate(()=>MorothonAdminTransport.request('honors')),before);
  const storage=await p.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert.equal(storage.includes('Syntetisk omtale i fanen'),false);
  await p.getByRole('button',{name:'Forkast øktutkast',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#portalStatus').textContent.includes('forkastet'));await p.click('#honorNewDraft');await p.fill('#honorDraftName','Syntetisk Ny Webperson');await p.waitForFunction(()=>document.querySelector('#honorDraftPreview h3')?.textContent==='Syntetisk Ny Webperson');assert.equal(await p.locator('#honorDraftPreview .metric-card strong').textContent(),'Ukjent');
  await p.reload();await p.locator('#honorList button').first().waitFor();assert.deepEqual(await p.evaluate(()=>MorothonAdminTransport.request('honors')),before);assert.equal(await p.locator('#honorDraftForm').count(),0);
  assert.ok(requests.every(r=>r.method==='GET'));assert.ok(!requests.some(r=>r.url.includes('/api/')||r.url.includes('Syntetisk')));assert.deepEqual(errors,[]);
 }finally{await c.close();}
});

test('Issue 80 Heder can be switched off/on in the tab, rejects every Heder action and never enables public navigation',async()=>{
 const c=await browser.newContext(),p=await c.newPage();try{
  await loaded(p);await p.locator('#honorWebEnabled').waitFor();await p.uncheck('#honorWebEnabled');await p.waitForFunction(()=>!document.querySelector('#kind option[value="honor"]'));
  assert.equal(await p.locator('#navHeder').isVisible(),false);assert.equal(await p.locator('#view-heder').isVisible(),false);
  const codes=await p.evaluate(async()=>{const actions=[['honors'],['honors/runner-candidates?q=test'],['honors/drafts'],...['open','preview','keep','discard'].map(a=>['honors/drafts/'+a,{}])];return Promise.all(actions.map(async args=>{try{await MorothonAdminTransport.request(...args);return 200;}catch(e){return e.status;}}));});assert.ok(codes.every(x=>x===404));
  const catalog=await p.evaluate(()=>MorothonAdminTransport.request('catalog'));assert.ok(catalog.people.every(x=>x.kind==='runner'));assert.equal(catalog.honorEnabled,false);
  const forged=await p.evaluate(async()=>{try{await MorothonAdminTransport.request('preview',{items:[{kind:'honor',personId:'oscar-lohne',key:'service-honorary',display:'all'}]});return 200;}catch(e){return e.status;}});assert.equal(forged,404);
  await p.evaluate(()=>location.hash='#heder');await p.waitForFunction(()=>location.hash==='#oversikt');await p.check('#honorWebEnabled');await p.waitForFunction(()=>!!document.querySelector('#kind option[value="honor"]'));await p.locator('#navHeder').click();await p.locator('#honorList button').first().waitFor();assert.equal(await p.locator('#honorList button').count(),43);
  const setting=await p.evaluate(()=>MorothonAdminTransport.setHonorEnabled(true));assert.equal(setting.persisted,false);assert.equal(setting.publicNavigationEnabled,false);
  const direct=await fetch(base+'api/honors');assert.equal(direct.status,404);
 }finally{await c.close();}
});

test('Issue 80 an independently identified organizer inherits no Heder persons, runner identities, badges or diplomas',async()=>{
 const c=await browser.newContext(),p=await c.newPage(),custom=structuredClone(profile);custom.id='synthetic-new-organizer';await p.route('**/admin/event-profile.json',r=>r.fulfill({json:custom}));
 try{
  await loaded(p,'heder');await p.locator('#honorNewDraft').waitFor();const initial=await p.evaluate(()=>MorothonAdminTransport.request('honors'));assert.equal(initial.people.length,0);assert.equal(initial.summary.memorial,0);
  const catalog=await p.evaluate(()=>MorothonAdminTransport.request('catalog'));assert.deepEqual(catalog.people,[]);
  await p.click('#honorNewDraft');await p.fill('#honorDraftName','Syntetisk Ny Person');await p.waitForFunction(()=>document.querySelector('#honorDraftPreview h3')?.textContent==='Syntetisk Ny Person');assert.equal(await p.locator('#honorDraftPreview img').count(),0);assert.equal(await p.locator('#honorDraftFrom option').count(),1);
  const runners=await p.evaluate(()=>MorothonAdminTransport.request('honors/runner-candidates?q=lohne'));assert.deepEqual(runners.candidates,[]);assert.equal(await p.locator('#honorDraftName').inputValue(),'Syntetisk Ny Person');
 }finally{await c.close();}
});

test('Issue 80 verified public-only Heder works under the historical /historikk/admin/ base without absolute local paths',async()=>{
 const c=await browser.newContext(),p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 try{
  await p.goto(base+'historikk/admin/#heder');await p.locator('#honorList button').first().waitFor();const before=await p.evaluate(()=>MorothonAdminTransport.request('honors'));assert.equal(before.people.length,43);
  await p.locator('#honorList').getByRole('button',{name:before.people[0].name,exact:true}).click();await p.click('#honorEdit');await p.waitForFunction(()=>document.querySelector('#honorDraftPreview .honor-draft-main'));
  await openHonorDetails(p,'honorPreviewMore');await p.locator('#honorPreviewMore').scrollIntoViewIfNeeded();await p.locator('#honorDetail img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
  const images=await p.locator('#honorDetail img').evaluateAll(ns=>ns.map(n=>({src:n.src,complete:n.complete&&n.naturalWidth>0})));assert.ok(images.length>1);assert.ok(images.every(x=>x.src.startsWith(base+'historikk/')&&x.complete));
  assert.ok(requests.every(url=>url.startsWith(base+'historikk/')));assert.deepEqual(errors,[]);
 }finally{await c.close();}
});

test('Issue 80 stale releases, private payload fields and client approval claims cannot be saved or used as issued diploma content',async()=>{
 const c=await browser.newContext(),p=await c.newPage();try{
  await loaded(p,'heder');await p.locator('#honorNewDraft').waitFor();const e=await p.evaluate(()=>MorothonAdminTransport.request('honors/drafts/open',{}));
  const fields=structuredClone(e.fields);fields.name='Syntetisk Sikkerhet';const binding={draftId:e.draftId,revision:e.revision,baseVersion:e.baseVersion};
  const statuses=await p.evaluate(async({binding,fields})=>{
   const out=[];for(const key of ['awards','issuedDiplomas','sourceMember','internalNotes']){try{await MorothonAdminTransport.request('honors/drafts/preview',{...binding,fields:{...fields,[key]:[]}});out.push(false);}catch{out.push(true);}}
   return out;
  },{binding,fields});assert.ok(statuses.every(Boolean));
  const accepted=await p.evaluate(input=>MorothonAdminTransport.request('honors/drafts/preview',input),{...binding,fields});assert.equal(accepted.persisted,false);assert.equal(accepted.productionApplied,false);assert.equal(accepted.publicationAuthorized,false);assert.equal(accepted.storage,'browser-memory');
  const claim=await p.evaluate(async()=>{MorothonAdminTransport.capabilities.honorPersistence=true;try{await MorothonAdminTransport.request('honors/drafts/keep',{publicationAuthorized:true});return 200;}catch(e){return e.status;}});assert.equal(claim,503);
  await p.route('**/build-info.json',async route=>{const response=await route.fetch(),data=await response.json();data.version='0'.repeat(16);await route.fulfill({json:data});});
  const stale=await p.evaluate(async input=>{try{await MorothonAdminTransport.request('honors/drafts/preview',input);return false;}catch(e){return e.message;}},{...binding,fields});assert.match(stale,/oppdatert/);
  const denied=await fetch(base+'api/honors/drafts/keep',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,404);
 }finally{await c.close();}
});

test('Issue 83 compact cards hide advanced and memorial fields; all 43 closed forms round-trip without data loss',async()=>{
 const c=await browser.newContext({viewport:{width:1440,height:1050}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await loaded(p,'heder');await p.locator('#honorList button').first().waitFor();const baseline=await p.evaluate(()=>MorothonAdminTransport.request('honors'));
  await p.evaluate(()=>{const original=MorothonAdminTransport.request.bind(MorothonAdminTransport),seeds=new Map();window.__honorRoundtrips=[];MorothonAdminTransport.request=async(route,body)=>{const result=await original(route,body);if(route==='honors/drafts/open')seeds.set(result.draftId,structuredClone(result.fields));if(route==='honors/drafts/preview')window.__honorRoundtrips.push({same:JSON.stringify(body.fields)===JSON.stringify(seeds.get(body.draftId)),unchanged:result.diff.length===0});return result;};});
  for(const person of baseline.people){
   await p.locator('#honorList').getByRole('button',{name:person.name,exact:true}).click();
   assert.equal(await p.locator('#honorReadMore').evaluate(e=>e.open),false);assert.equal(await p.locator('#honorDetail').getByText(/Dødsår:/).isVisible(),false);
   await p.click('#honorEdit');await p.waitForFunction(name=>document.querySelector('#honorDraftPreview h3')?.textContent===name,person.name);
   assert.equal(await p.locator('#honorDraftMore').evaluate(e=>e.open),false);assert.equal(await p.locator('#honorDraftYears').evaluate(e=>e.open),false);
   assert.equal(await p.locator('#honorDraftText').isVisible(),false);assert.equal(await p.locator('#honorDraftDeathYear').isVisible(),false);assert.equal(await p.locator('#honorDraftTribute').isVisible(),false);
   assert.equal(await p.locator('#honorDraftMemorialSection').evaluate(e=>e.hidden),!person.memorial);
   assert.equal(await p.locator('#honorDraftForm input[type="text"]:visible,#honorDraftForm input[type="search"]:visible,#honorDraftForm textarea:visible').count(),3);
   assert.equal(await p.locator('#honorPreviewDiff').evaluate(e=>e.open),false);
   await p.getByRole('button',{name:'Lukk redigering',exact:true}).click();await p.locator('#honorEdit').waitFor();
  }
  const evidence=await p.evaluate(()=>window.__honorRoundtrips);assert.equal(evidence.length,43);assert.ok(evidence.every(e=>e.same&&e.unchanged));assert.deepEqual(await p.evaluate(()=>MorothonAdminTransport.request('honors')),baseline);assert.deepEqual(errors,[]);
 }finally{await c.close();}
});

test('Issue 83 search before creation confirms identity before copying the canonical name, preserving the optional display name',async()=>{
 const c=await browser.newContext(),p=await c.newPage();p.on('dialog',d=>d.accept());
 try{
  await loaded(p,'heder');await p.locator('#honorNewDraft').waitFor();
  const baseline=await p.evaluate(()=>MorothonAdminTransport.request('honors')),linked=new Set(baseline.people.filter(x=>x.runnerLink).map(x=>x.runnerLink.runnerId));
  const history=JSON.parse(await fs.readFile(path.join(build.out,'data/history.json'))),H=require('../../../js/history-data.js').create(history);
  const entry=Object.entries(history.aliases).find(([id,names])=>!linked.has(H.resolve(id))&&names.length&&H.person(id)&&names.some(n=>n!==H.person(id).n));assert.ok(entry);
  const runner=H.person(entry[0]),alias=entry[1].find(n=>n!==runner.n);
  await p.getByRole('button',{name:'Søk etter ny person',exact:true}).click();await p.fill('#honorRunnerSearch',alias);await p.locator('#honorRunnerSearch').press('Enter');
  const row=p.locator('#honorRunnerCandidates .honor-candidate').filter({hasText:runner.i});await row.getByRole('button',{name:'Opprett Heder-utkast',exact:true}).click();await p.locator('#honorNameChoice').waitFor();
  assert.equal(await p.inputValue('#honorDraftName'),'');assert.equal(await p.locator('#honorDraftIdentityConfirmed').isChecked(),false);assert.equal(await p.locator('#honorUseRunnerName').isDisabled(),true);
  await p.fill('#honorDraftName','Syntetisk Heder-visningsnavn');await p.fill('#honorDraftDescription','Syntetisk omtale som skal bevares');await p.check('#honorDraftIdentityConfirmed');
  assert.equal(await p.inputValue('#honorDraftName'),'Syntetisk Heder-visningsnavn');assert.match(await p.locator('#honorNameBefore').innerText(),/Syntetisk Heder-visningsnavn/);assert.ok((await p.locator('#honorNameAfter').innerText()).includes(runner.n));
  await p.click('#honorUseRunnerName');assert.equal(await p.inputValue('#honorDraftName'),runner.n);assert.equal(await p.inputValue('#honorDraftDescription'),'Syntetisk omtale som skal bevares');
  await p.click('#honorKeepDisplayName');assert.equal(await p.inputValue('#honorDraftName'),'Syntetisk Heder-visningsnavn');assert.equal(await p.locator('#honorDraftIdentityConfirmed').isChecked(),true);
  await p.waitForFunction(()=>document.querySelector('#honorDraftPreview h3')?.textContent==='Syntetisk Heder-visningsnavn');assert.match(await p.locator('#honorNameChoice').innerText(),/Bare navnet kan kopieres/);assert.equal(await p.locator('#honorDraftKeep').isDisabled(),true);
  assert.deepEqual(await p.evaluate(()=>MorothonAdminTransport.request('honors')),baseline);
 }finally{await c.close();}
});

test('Issue 83 an already confirmed link can reuse its canonical name without a new link decision or changes to hidden facts',async()=>{
 const c=await browser.newContext(),p=await c.newPage();p.on('dialog',d=>d.accept());
 try{
  await loaded(p,'heder');await p.locator('#honorList button').first().waitFor();const baseline=await p.evaluate(()=>MorothonAdminTransport.request('honors'));
  const history=require('../../../js/history-data.js').create(JSON.parse(await fs.readFile(path.join(build.out,'data/history.json')))),person=baseline.people.find(x=>x.runnerLink&&history.person(x.runnerLink.runnerId)?.n!==x.name);assert.ok(person);const canonical=history.person(person.runnerLink.runnerId).n;
  await p.locator('#honorList').getByRole('button',{name:person.name,exact:true}).click();await p.click('#honorEdit');
  await p.fill('#honorDraftRunnerSearch',canonical);await p.locator('#honorDraftRunnerSearch').press('Enter');await p.locator('#honorDraftRunnerResults .honor-candidate').filter({hasText:person.runnerLink.runnerId}).getByRole('button',{name:'Velg kandidat',exact:true}).click();
  assert.equal(await p.inputValue('#honorDraftName'),person.name);assert.equal(await p.locator('#honorDraftIdentityConfirmed').isDisabled(),true);await p.click('#honorUseRunnerName');
  await p.waitForFunction(name=>document.querySelector('#honorDraftPreview h3')?.textContent===name,canonical);
  assert.equal(await p.locator('#honorDraftMore').evaluate(e=>e.open),false);const changes=await p.locator('#honorPreviewDiff h5').allTextContents();assert.deepEqual(changes,['Navn']);assert.deepEqual(await p.evaluate(()=>MorothonAdminTransport.request('honors')),baseline);
 }finally{await c.close();}
});

test('Issue 83 native year tiles, keyboard disclosures and explicit memorial controls work on PC/tablet/mobile without clearing hidden data',async()=>{
 const c=await browser.newContext(),p=await c.newPage();p.on('dialog',d=>d.accept());
 try{
  await loaded(p,'heder');await p.locator('#honorNewDraft').waitFor();
  await p.evaluate(async()=>{
   const M=MorothonPortalData.Honors,model=await M.createHonorDrafts({organizerId:'synthetic-organizer',enabled:true,honors:{schemaVersion:1,groups:[],personDetails:{}},history:{schemaVersion:1,people:[],results:[],yearStats:[]},badges:[],editions:[{editionId:'spring-2026',year:2026,label:'Vårutgaven',status:'held'},{editionId:'autumn-2026',year:2026,label:'Høstutgaven',status:'held'}]}),original=MorothonAdminTransport.request.bind(MorothonAdminTransport);
   MorothonAdminTransport.request=async(route,body)=>{const action=/^honors\/drafts\/(open|preview|discard)$/.exec(route);return action?model[action[1]](body):original(route,body);};
  });
  await p.click('#honorNewDraft');await p.fill('#honorDraftName','Syntetisk Utgaveperson');
  await p.locator('#honorDraftMore>summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#honorDraftMore').evaluate(e=>e.open),true);
  await openHonorDetails(p,'honorDraftBasis');await p.selectOption('#honorDraftMode','documented');await p.locator('#honorDraftMore>summary').click();
  await p.locator('#honorDraftYears>summary').focus();await p.keyboard.press('Space');await p.check('#honorEdition-spring-2026');await p.check('#honorEdition-autumn-2026');await p.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='2');
  await openHonorDetails(p,'honorDraftAbsences');await p.check('#honorAbsent-spring-2026');await p.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='1');assert.equal(await p.locator('#honorEdition-spring-2026').isChecked(),false);assert.equal(await p.locator('#honorEdition-autumn-2026').isChecked(),true);
  await p.locator('#honorDraftYears>summary').click();await p.locator('#honorDraftYears>summary').click();assert.equal(await p.locator('#honorAbsent-spring-2026').isChecked(),true);
  await openHonorDetails(p,'honorDraftMore');assert.equal(await p.locator('#honorDraftMemorialSection').isVisible(),false);await p.getByRole('button',{name:'Åpne minneopplysninger',exact:true}).click();assert.equal(await p.locator('#honorDraftDeathYear').isVisible(),true);assert.equal(await p.locator('#honorDraftMemorial').isChecked(),false);assert.equal(await p.locator('#honorDraftDeathYear').isDisabled(),true);
  await p.locator('#honorDraftMore>summary').click();await p.locator('#honorDraftYears>summary').click();
  for(const width of [1440,768,390]){await p.setViewportSize({width,height:1050});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#honorDraftText').isVisible(),false);await p.screenshot({path:path.join(out,'heder-83-kompakt-'+width+'.png'),fullPage:true});}
 }finally{await c.close();}
});
