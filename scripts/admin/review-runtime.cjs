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
 let queue=Promise.resolve();
 async function calculate(history){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  try{
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),name=url.pathname.slice(1)||'index.html',bytes=runtime.files.get(name);
    if(url.origin!=='https://projection.invalid'||request.method()!=='GET'||!bytes)return route.abort();
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'}[path.extname(name)]||'application/octet-stream';
    return route.fulfill({body:bytes,contentType:type});
   });
   await page.goto('https://projection.invalid/index.html');
   await page.waitForFunction(()=>window.MorothonDiplomas&&!document.querySelector('#loading'));
   await page.addScriptTag({url:'https://projection.invalid/admin/diploma-adapter.js'});
   return await page.evaluate(data=>window.C2Project(data),history);
  }finally{await context.close();}
 }
 return {project(history){const job=queue.then(()=>calculate(history));queue=job.catch(()=>{});return job;},close:()=>providedBrowser?Promise.resolve():browser.close()};
}
module.exports={approvedRuntime,createProjector};
