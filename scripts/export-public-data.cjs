// Administrative command: creates a candidate, never grants publication approval.
const fs=require('node:fs/promises'),path=require('node:path');
const {exportPublicData,validateExport}=require('./lib/public-data.cjs');
const {DATA_NAMES,runtimeFiles}=require('./lib/runtime-files.cjs');
const {manifestFor,approvalFor,safeRead,readApprovedPackage}=require('./lib/public-package.cjs');
async function exportPackage({sourceDir,assetsRoot,out,dataVersion=1}){
 if(!sourceDir||!assetsRoot||!out)throw Error('Specify source directory, public assets root and empty output directory');
 sourceDir=path.resolve(sourceDir);assetsRoot=path.resolve(assetsRoot);out=path.resolve(out);
 if(out===sourceDir||sourceDir.startsWith(out+path.sep)||out.startsWith(sourceDir+path.sep))throw Error('Export output must be separate from administrative inputs');
 const originals=Object.fromEntries(await Promise.all(DATA_NAMES.map(async n=>[n,JSON.parse(await safeRead(sourceDir,n+'.json'))])));
 const projected=exportPublicData(originals);validateExport(projected,originals);
 const bytes=new Map(await Promise.all(DATA_NAMES.map(async n=>['data/'+n+'.json',n==='history'?await safeRead(sourceDir,n+'.json'):Buffer.from(JSON.stringify(projected[n],null,2)+'\n')])));
 const assetBytes=new Map(await Promise.all(runtimeFiles(projected.badges).filter(f=>f.startsWith('assets/')).map(async f=>[f,await safeRead(assetsRoot,f)])));
 const manifest=manifestFor(bytes,assetBytes,dataVersion),manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 await fs.mkdir(out,{recursive:true});if((await fs.readdir(out)).length)throw Error('Export output directory must be empty');
 for(const [file,value]of bytes){const dest=path.join(out,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,value);}
 await fs.writeFile(path.join(out,'manifest.json'),manifestBytes);
 // Candidate integrity/schema check only. This does not write a trusted approval.
 await readApprovedPackage(out,{approval:approvalFor(manifestBytes),assetsRoot});
 return {output:out,candidate:true,approval:approvalFor(manifestBytes)};
}
module.exports={exportPackage};
if(require.main===module){const [sourceDir,out,assetsRoot,dataVersion]=process.argv.slice(2);exportPackage({sourceDir,out,assetsRoot,dataVersion:dataVersion===undefined?1:Number(dataVersion)}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
