'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const C=require('./common.cjs');
async function candidate({adminRoot,publicRoot,publicCommit,out,dataVersion,verifyPrivate}){
 await verifyPrivate();C.pinned(publicRoot,publicCommit);C.separate(adminRoot,out);C.separate(publicRoot,out);
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-private-export-'));await fs.chmod(temp,0o700);
 try{
  const input=path.join(temp,'input');await fs.mkdir(input,{mode:0o700});
  for(const name of ['honors','volunteers'])await C.writeNew(path.join(input,name+'.json'),await C.read(adminRoot,'data/'+name+'.json'));
  // Public result history has one editing authority. Never read old raw fallback files.
  for(const name of ['history','badges','event-dates'])await C.writeNew(path.join(input,name+'.json'),await C.read(publicRoot,'public-data/data/'+name+'.json'));
  const {exportPackage}=require(path.join(publicRoot,'scripts/export-public-data.cjs'));
  return await exportPackage({sourceDir:input,assetsRoot:publicRoot,out,dataVersion});
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
async function equivalence({publicRoot,publicCommit,packageRoot,siteRoot}){
 C.pinned(publicRoot,publicCommit);
 const {readApprovedPackage,approvalFor}=require(path.join(publicRoot,'scripts/lib/public-package.cjs'));
 const proposed=approvalFor(await C.read(packageRoot,'manifest.json'));
 const expected=C.json(await C.read(publicRoot,'.github/public-data-approval.json'));
 // Initial migration must preserve all five approved files exactly. No new P decisions.
 if(!C.isDeepStrictEqual(proposed,expected))throw Error('Migration export differs from the currently approved public package');
 const verified=await readApprovedPackage(packageRoot,{approval:expected,assetsRoot:publicRoot});
 const {buildSite}=require(path.join(publicRoot,'scripts/build-site.cjs'));await buildSite(siteRoot,{dataDir:packageRoot,approval:expected});
 const {createHarness}=require(path.join(publicRoot,'scripts/diploma-harness.cjs'));const h=await createHarness({rootDir:siteRoot});
 try{
  const p=await h.browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(h.base+'/heder.html');await p.locator('[data-honoree]').first().waitFor();
  const reference=C.json(await C.read(publicRoot,'tests/fixtures/a1c-public-reference.json'));
  const ids=await p.locator('[data-honoree]').evaluateAll(items=>items.map(i=>i.dataset.honoree));
  const diplomas=await p.evaluate(async()=>{const data=await MorothonHonorsData.load(),all=[];for(const m of data.groups.flatMap(g=>g.members))for(const display of ['all','latest']){const d=await MorothonDiplomas.serviceDraft(m.id,display);all.push({id:m.id,display,proof:d.contentProof,mode:d.printMode,count:d.contributionCount,first:d.contributionFirst,last:d.contributionLast,date:d.dateLabel,title:d.title,tribute:d.tribute});}return all;});
  if(!C.isDeepStrictEqual(ids,reference.ids)||!C.isDeepStrictEqual(diplomas,reference.diplomas)||errors.length)throw Error('Public profiles, diploma variants or runtime differ');
  if(verified.visiblePeople!==43||diplomas.length!==86)throw Error('Migration baseline count changed; review required');
  return {profiles:43,diplomas:86,byteIdentical:true,manifestSha256:expected.manifestSha256};
 }finally{await h.close();}
}
async function validateApprovedCandidate({publicRoot,publicCommit,packageRoot,approvedManifestSha256}){
 C.pinned(publicRoot,publicCommit);
 const {readApprovedPackage,approvalFor}=require(path.join(publicRoot,'scripts/lib/public-package.cjs'));
 const proposed=approvalFor(await C.read(packageRoot,'manifest.json'));
 if(!/^[a-f0-9]{64}$/.test(approvedManifestSha256||'')||proposed.manifestSha256!==approvedManifestSha256)throw Error('External approval of this exact public manifest is required');
 await readApprovedPackage(packageRoot,{approval:proposed,assetsRoot:publicRoot});
 const old=C.json(await C.read(publicRoot,'.github/public-data-approval.json'));
 if(proposed.manifestSha256!==old.manifestSha256&&proposed.dataVersion<=old.dataVersion)throw Error('Data version must increase');
 return {approval:proposed,files:6}; // Caller receives a report; public checkout is never modified.
}
module.exports={candidate,equivalence,validateApprovedCandidate};
