// A portable, immutable snapshot of the approved public build, not admin originals.
'use strict';
const path=require('node:path');
const {readApprovedPackage,safeRead}=require('../lib/public-package.cjs');
const {runtimeFiles}=require('../lib/runtime-files.cjs');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;
async function approvedRuntime(site,approvalFile){
 const checked=await readApprovedPackage(site,{approvalFile,assetsRoot:site,site:true}),files=new Map();
 for(const name of [...runtimeFiles(checked.data.badges),'public-manifest.json','build-info.json'])files.set(name,await safeRead(site,name));
 const base=await C.binding(checked.data.history,{dataVersion:checked.manifest.dataVersion,manifestSha256:checked.approval.manifestSha256,historySha256:checked.manifest.historySha256});
 const honors=checked.data.honors,details=honors.personDetails||{},volunteers=checked.data.volunteers.people||[];
 const linkedRunnerIds=[...new Set([...(honors.groups||[]).flatMap(g=>g.members).map(m=>details[m.id]?.runnerLink?.runnerId||m.runnerId),...Object.values(details).map(d=>d.runnerLink?.runnerId),...volunteers.map(d=>d.runnerLink?.runnerId||d.runnerId)].filter(Boolean).map(id=>require('../../js/history-data.js').resolveId(id,checked.data.history.redirects)))];
 return {files,history:checked.data.history,base,linkedRunnerIds};
}
async function createProjector(runtime,{executablePath=process.env.CHROMIUM_PATH||'/usr/bin/chromium',browser:providedBrowser}={}){
 const {chromium}=require('playwright');
 // Run as an unprivileged account with Chromium sandbox support. No --no-sandbox.
 const browser=providedBrowser||await chromium.launch({executablePath,chromiumSandbox:true,env:{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'nb_NO.UTF-8'}});
 let queue=Promise.resolve();const cache=new Map();
 async function calculate(history,includeHonors){
  const files=new Map(runtime.files),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  // Modules loading history separately must see the same candidate snapshot.
  files.set('data/history.json',Buffer.from(JSON.stringify(history)));
  try{
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.slice(1)||'index.html',bytes=files.get(name);
    if(url.origin!=='https://projection.invalid'||request.method()!=='GET'||!bytes)return route.abort();
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'}[path.extname(name)]||'application/octet-stream';
    return route.fulfill({body:bytes,contentType:type});
   });
   await page.goto('https://projection.invalid/index.html');
   await page.waitForFunction(()=>window.MorothonDiplomas&&!document.querySelector('#loading'));
   // Private projection runtime reads the exact checked-out engine source, never
   // a vanished public /admin asset or a remote, untrusted script.
   await page.addScriptTag({content:await require('node:fs/promises').readFile(path.resolve(__dirname,'../../tools/diploma-admin/engine.js'),'utf8')});
   return await page.evaluate(async({history,includeHonors})=>{
    const projection=await window.C2Project(history);
    if(includeHonors){projection.honors={};const data=await MorothonHonorsData.load();
     for(const member of data.groups.flatMap(g=>g.members))for(const display of ['all','latest']){
      const d=await MorothonDiplomas.serviceDraft(member.id,display);projection.honors[member.id+':'+display]={
       name:d.name,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,badge:d.assetKey,
       collection:d.secondaryAssets.map(a=>a.key),date:d.dateLabel,mode:d.printMode,proof:d.contentProof};
     }
    }return projection;
   },{history,includeHonors});
  }finally{await context.close();}
 }
 async function verifyProfiles({siteUrl,files,history,personIds,changes}){
  const context=await browser.newContext({serviceWorkers:'block'}),base=new URL(siteUrl);
  try{
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url()),name=url.pathname.slice(base.pathname.length)||'index.html',bytes=files.get(name);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||request.method()!=='GET'||!bytes)return route.abort();return route.fulfill({body:bytes,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'})[path.extname(name)]||'application/octet-stream'});});
   for(const id of personIds){
    // A hash-only navigation reuses the previous document. The public site
    // opens a deep-linked profile at startup, so verify each link in a fresh
    // page rather than accidentally checking the preceding person's panel.
    const page=await context.newPage();try{
    await page.goto(new URL('index.html#lop='+encodeURIComponent(id),base).href);await page.waitForFunction(()=>typeof S!=='undefined'&&S.data&&!document.querySelector('#loading'));
    if(!require('../../js/history-data.js').create(history).person(id)){
     // Reversing a new year can remove a newly created person. Verify the
     // actual delivered dataset and absent profile, never skip that recipient.
     const removed=await page.evaluate(({id,expected})=>!person(id)&&!resultsFor(id).length&&
       JSON.stringify(S.results)===JSON.stringify(expected.results)&&JSON.stringify(S.stats)===JSON.stringify(expected.yearStats)&&
       JSON.stringify(S.people.map(p=>p.i))===JSON.stringify(expected.people.map(p=>p.i))&&document.querySelector('#panel')?.hidden,{id,expected:history});
     if(!removed)throw Error('Tilbakeført ny løper finnes fortsatt i den publiserte profilen.');continue;
    }
    await page.locator('#panel:not([hidden])').waitFor();
    const checked=await page.evaluate(({id,expected})=>{
     const model=MorothonHistoryData.create(expected),canonical=model.resolve(id),p=person(id),stats=model.stats(id);
     return {person:!!p,results:JSON.stringify(S.results)===JSON.stringify(expected.results),
      canonical:resolvePid(id)===canonical,name:p?.n===model.person(id)?.n,
      count:p?.c===(stats?.count||0),years:JSON.stringify(startedYears(p))===JSON.stringify(stats?.years||[]),
      rows:JSON.stringify(resultsFor(id))===JSON.stringify(model.resultsFor(id)),
      rendered:document.querySelector('#panel')?.getAttribute('aria-label')==='Løperprofil for '+model.person(id)?.n};
    },{id,expected:history});
    const failed=Object.keys(checked).filter(key=>checked[key]!==true);
    if(failed.length)throw Error('Løperprofilen viser et annet resultatgrunnlag. Kontrollpunkter: '+failed.join(', ')+'.');
    const older=page.locator('#profile .older-results');if(await older.count())await older.locator('summary').click();
    for(const c of changes.filter(c=>Number.isInteger(c.index)&&Array.isArray(c.after)&&c.after[1]===id)){
     if(require('../../js/history-data.js').effectiveStatus(c.after)==='DNS')continue;
     const descriptor=await page.evaluate(row=>resultDescriptor(row),c.after),rows=page.locator('#profile .result-row').filter({has:page.getByText(String(c.after[0]),{exact:true})});
     if(!await rows.filter({hasText:descriptor}).count())throw Error('Den korrigerte registreringen vises ikke i profilen.');
    }
    }finally{await page.close();}
   }
  }finally{await context.close();}
 }
 return {async project(history,{includeHonors=false}={}){
  // Cache only immutable engine projections by complete snapshot SHA, not
  // authorization, source validation, approvals or publication decisions.
  const key=await C.hash({history,includeHonors});
  if(!cache.has(key)){const job=queue.then(()=>calculate(history,includeHonors));queue=job.catch(()=>{cache.delete(key);});cache.set(key,job);if(cache.size>2)cache.delete(cache.keys().next().value);}
  return structuredClone(await cache.get(key));
 },verifyProfiles,healthy:()=>browser.isConnected(),async checkSandbox(){const context=await browser.newContext({locale:'en-US'});try{const page=await context.newPage();await page.goto('chrome://sandbox');const text=await page.locator('body').innerText();if(!/PID namespaces\s+Yes/i.test(text)||!/Seccomp-BPF sandbox\s+Yes/i.test(text)||!/adequately sandboxed/i.test(text))throw Error('Chromium-sandbox kunne ikke bekreftes.');}finally{await context.close();}},close:()=>providedBrowser?Promise.resolve():browser.close()};
}
module.exports={approvedRuntime,createProjector};
