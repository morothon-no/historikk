// A static server mimics Pages at the REAL /historikk/ base. No Node admin/API.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright'),{buildSite,validatePublicSite}=require('../../../scripts/build-site.cjs'),{validate}=require('../../../web-admin/profile-contract.js');
let dir,out,browser,server,base,profile,registry,build;
before(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-web-admin-'));build=await buildSite(path.join(dir,'site'));profile=JSON.parse(await fs.readFile(path.join(build.out,'admin/event-profile.json')));registry=JSON.parse(await fs.readFile(path.join(build.out,'data/badges.json')));
 out=process.env.MOROTHON_C1_REVIEW_DIR?path.join(process.env.MOROTHON_C1_REVIEW_DIR,'web-c12'):path.join(dir,'review');await fs.mkdir(out,{recursive:true});const files=new Set(build.files);
 server=http.createServer(async(req,res)=>{let name=new URL(req.url,'http://static').pathname;if(req.method!=='GET'||!name.startsWith('/historikk/'))return res.writeHead(404).end();name=name.slice('/historikk/'.length);if(name.endsWith('/')||!name)name+='index.html';if(!files.has(name))return res.writeHead(404).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff'})[path.extname(name)]||'application/octet-stream');res.end(await fs.readFile(path.join(build.out,name)));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/historikk/';browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));if(dir)await fs.rm(dir,{recursive:true,force:true});});
test('C1.2 profile contract rejects unknown/private fields, CSS/URL injection and unimplemented policy changes',()=>{
 assert.equal(validate(profile,registry).id,'sogne-morothon');
 for(const alter of [p=>p.internalNotes='private',p=>p.colors.primary='url(https://bad.example/x)',p=>p.fonts.ui='https://bad.example/font',p=>p.logoAssetId='https://bad.example/logo',p=>p.references.participationPolicy='automatic-awards',p=>p.references.diplomaTemplate='free-html',p=>p.modules.oversikt=false,p=>p.texts.welcomeTitle='<script>bad</script>',p=>p.modules.import='enabled']){const bad=structuredClone(profile);alter(bad);assert.throws(()=>validate(bad,registry));}
});
test('C1.2 exact public inventory accepts nine web files and refuses local server, original data, unknown files and invalid public profiles',async()=>{
 assert.equal(build.files.length,68);assert.equal(build.files.filter(f=>f.startsWith('admin/')).length,9);
 for(const file of ['admin/worker.cjs','admin/api.cjs','scripts/diploma-admin.cjs','data/private.json'])assert.equal(build.files.includes(file),false);
 assert.deepEqual(await fs.readFile(path.join(build.out,'data/history.json')),await fs.readFile(path.resolve(__dirname,'../../../public-data/data/history.json')));
 const html=await fs.readFile(path.join(build.out,'admin/index.html'),'utf8');assert.match(html,/noindex, nofollow/);assert.doesNotMatch(html,/__LOCAL_TOKEN__|<meta name="local-session"|src="\/admin/);assert.match(html,/Offentlig testversjon/);
 const extra=path.join(build.out,'admin/private.json');try{await fs.writeFile(extra,'{}');await assert.rejects(()=>validatePublicSite(build.out),/Unexpected or missing/);}finally{await fs.unlink(extra);}
 const file=path.join(build.out,'admin/event-profile.json'),bytes=await fs.readFile(file);try{await fs.writeFile(file,JSON.stringify({...profile,privateNotes:'no'}));await assert.rejects(()=>validatePublicSite(build.out),/profilfelt/);}finally{await fs.writeFile(file,bytes);}
 assert.equal((await validatePublicSite(build.out)).visiblePeople,43);
});
async function loaded(p,hash='oversikt'){await p.goto(base+'admin/#'+hash);await p.locator('#overviewMetrics .metric-card').first().waitFor({state:hash==='oversikt'?'visible':'attached'});}
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
 await p.getByRole('navigation').getByRole('link',{name:/Import/}).click();assert.match(await p.locator('#view-import').innerText(),/ikke aktivert/);
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
 await p.route('**/admin/event-profile.json',r=>r.fulfill({json:custom}));try{await loaded(p);assert.equal(await p.locator('#pageTitle').innerText(),'Arrangøroversikt');assert.match(await p.locator('.portal-brand').innerText(),/TESTLØPET/);assert.equal(await p.locator('.sidebar nav a:visible').count(),4);assert.match(await p.locator('#overviewMetrics').innerText(),/398/);await p.evaluate(()=>location.hash='#import');await p.waitForFunction(()=>location.hash==='#oversikt');assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.sidebar')).backgroundColor),'rgb(116, 58, 50)');}finally{await c.close();}
});
test('C1.2 a changed release refuses further preview/print instead of silently reusing stale approvals',async()=>{
 const c=await browser.newContext(),p=await c.newPage();try{await loaded(p);await p.route('**/build-info.json',async route=>{const r=await route.fetch(),j=await r.json();j.version='0'.repeat(16);await route.fulfill({json:j});});const error=await p.evaluate(async()=>{try{await MorothonAdminTransport.request('check',{items:[{kind:'runner',personId:'MOR-C788866',key:'badge:10',display:'latest'}]});return false;}catch(e){return e.message;}});assert.match(error,/oppdatert/);}finally{await c.close();}
});

test('C1.2 actual post-deploy smoke script requires the expected release and fails on stale published bytes',async()=>{
 const vm=require('node:vm'),workflow=await fs.readFile(path.resolve(__dirname,'../../../.github/workflows/pages.yml'),'utf8');
 const step=workflow.split('      - name: Verify published admin files after deployment')[1];assert.ok(step);
 const script=step.split("node <<'JS'\n")[1].split('          JS')[0].split('\n').map(line=>line.slice(10)).join('\n');
 const local=JSON.parse(await fs.readFile(path.join(build.out,'build-info.json'),'utf8'));
 for(const stale of [false,true]){
  const process={env:{PAGES_URL:local.siteUrl},exitCode:0};let requested=0;
  const sandbox={process,URL,Buffer,AbortSignal,setTimeout:fn=>{fn();},console:{log(){},error(){}},require:name=>name==='node:fs/promises'?{readFile:(file,encoding)=>fs.readFile(path.join(build.out,file.slice('_site/'.length)),encoding)}:require(name),fetch:async url=>{
   requested++;const file=new URL(url).pathname.slice('/historikk/'.length);const bytes=await fs.readFile(path.join(build.out,file));return {ok:true,arrayBuffer:async()=>stale&&file==='admin/index.html'?Buffer.from('wrong release'):bytes};
  }};
  await vm.runInNewContext(script,sandbox);assert.equal(process.exitCode,stale?1:0);assert.ok(requested>20);
 }
});
