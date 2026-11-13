// Explicit public test inventory. Source tests are discovered only in the trusted source checkout.
const levels=['quick','functional','visual','full'];
const fs=require('node:fs/promises'),path=require('node:path');
const publicGroups={
 quick:['tests/data-quality.cjs','tests/public-build.cjs','tests/test-planning.cjs','tests/loyalty-v32.cjs'],
 functional:['tests/public-modules.cjs','tests/data-quality-browser.cjs','tests/regression.cjs'],
 visual:['tests/regression-visual.cjs','tests/loyalty-visual.cjs','tests/site-build.cjs','tests/public-browser.cjs','tests/public-pdf.cjs']
};
const sourceVisual=['tests/honor-card-collections.cjs','tests/honors-visibility.cjs','tests/quality-v32.cjs'];
function publicFiles(level,extras=[]){
 const n=levels.indexOf(level);if(n<0)throw Error('Unknown test level');
 return [...Object.entries(publicGroups).flatMap(([name,files])=>levels.indexOf(name)<=n?files:[]),...extras.filter(e=>levels.indexOf(e.level)<=n).map(e=>e.file)];
}
function sourceFiles(level,all,extras=[]){
 if(!levels.includes(level))throw Error('Unknown test level');
 if(level==='full'){const pub=new Set(publicFiles('full',extras));return all.filter(f=>!pub.has(f));}
 return level==='visual'?sourceVisual:[];
}
async function discoverTests(root){
 const all=[],extras=[],dir=path.join(root,'tests');
 for(const entry of await fs.readdir(dir,{withFileTypes:true}))if(entry.name.endsWith('.cjs')){
  if(!entry.isFile())throw Error('Invalid or symlinked test file');all.push('tests/'+entry.name);
 }
 const publicDir=path.join(dir,'public');
 try{
  if(!(await fs.lstat(publicDir)).isDirectory()||(await fs.lstat(publicDir)).isSymbolicLink())throw Error('Invalid public test directory');
 }catch(e){if(e.code==='ENOENT')return {all:all.sort(),extras};throw e;}
 async function walk(relative,level){
  for(const entry of await fs.readdir(path.join(root,relative),{withFileTypes:true})){
   if(entry.isSymbolicLink())throw Error('Symlink in public tests');
   const file=relative+'/'+entry.name;
   if(entry.isDirectory())await walk(file,level);
   else if(entry.isFile()&&entry.name.endsWith('.cjs')){all.push(file);extras.push({file,level});}
  }
 }
 for(const entry of await fs.readdir(publicDir,{withFileTypes:true})){
  if(entry.name==='README.md'&&entry.isFile())continue;
  if(!entry.isDirectory()||!levels.includes(entry.name))throw Error('Unknown public test level');
  await walk('tests/public/'+entry.name,entry.name);
 }
 return {all:all.sort(),extras:extras.sort((a,b)=>a.file.localeCompare(b.file))};
}
function requirements(level,scope){
 if(!levels.includes(level)||!['public','source'].includes(scope))throw Error('Unknown test requirements');
 const browser=scope==='public'?level!=='quick':['visual','full'].includes(level);
 return {browser,pdf:scope==='public'?['visual','full'].includes(level):level==='full',python:scope==='source'&&level==='full'};
}
module.exports={levels,publicGroups,publicFiles,sourceFiles,requirements,discoverTests};
