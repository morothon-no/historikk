// Maintainer-only scan. Reports are not site assets; there is no apply/auto-link mode.
const fs=require('node:fs/promises'),path=require('node:path'),{watchFile,unwatchFile}=require('node:fs');
const {randomUUID}=require('node:crypto');
const H=require('../js/honors-data.js'),{reviewLinks,markdown}=require('./lib/runner-link-review.cjs');
const defaultRoot=path.resolve(__dirname,'..');
async function scan({root=defaultRoot,output=path.join(root,'.review/runner-links'),previous=null}={}){
 const core=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 let data=core;if(core.volunteerList){if(core.volunteerList!=='data/volunteers.json')throw new Error('Ugyldig dugnadslistefil.');data=H.mergeVolunteers(core,JSON.parse(await fs.readFile(path.join(root,core.volunteerList),'utf8')));}
 const history=JSON.parse(await fs.readFile(path.join(root,'data/history.json'),'utf8')),prior=previous?JSON.parse(await fs.readFile(previous,'utf8')):null;
 if(prior&&(prior.schemaVersion!==1||!Array.isArray(prior.rows)))throw new Error('Ugyldig tidligere koblingsrapport.');
 const profileBase=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).homepage;
 const report=reviewLinks(data,history,{previous:prior,profileBase});
 // Never let a caller choose a registry/source directory as the report target.
 const out=path.resolve(output);if(!path.isAbsolute(output))throw new Error('Rapportmappe må være absolutt.');
 const allowed=(target,project)=>target!==project&&(!target.startsWith(project+path.sep)||target===path.join(project,'.review')||target.startsWith(path.join(project,'.review')+path.sep));
 if(!allowed(out,path.resolve(root)))throw new Error('Rapporter må ligge utenfor kildefilene eller under .review.');
 await fs.mkdir(out,{recursive:true});if(!allowed(await fs.realpath(out),await fs.realpath(root)))throw new Error('Rapportmappen peker inn i kildefilene.');
 const outputs=['koblingsforslag.json','koblingsforslag.md'].map(name=>path.join(out,name));
 for(const target of outputs)if((await fs.lstat(target).catch(()=>null))?.isSymbolicLink())throw new Error('Rapportmål kan ikke være en symbolsk lenke.');
 for(const [file,text]of [[outputs[0],JSON.stringify(report,null,2)+'\n'],[outputs[1],markdown(report)]]){const temp=file+'.'+process.pid+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,text,{flag:'wx'});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
 const errors=['broken-link','invalid-confirmation','duplicate-confirmation'].reduce((sum,k)=>sum+report.summary[k],0);
 return {report,output:out,errors};
}
function args(argv){const options={};let watching=false;for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--watch')watching=true;else if(['--output','--previous','--root'].includes(a)){if(!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('Verdi mangler for '+a);options[a.slice(2)]=path.resolve(argv[++i]);}else throw new Error('Ukjent argument: '+a);}return {options,watching};}
async function main(argv=process.argv.slice(2)){
 const {options,watching}=args(argv),run=async()=>{const r=await scan(options);console.log(JSON.stringify({output:r.output,...r.report.summary,sourceWarnings:r.report.warnings.length,errors:r.errors}));return r;};
 if(!watching){const r=await run();if(r.errors)process.exitCode=1;return;}
 const files=['data/honors.json','data/volunteers.json','data/history.json'].map(f=>path.join(options.root||defaultRoot,f));let timer,running=false,pending=false;
 const update=async()=>{if(running){pending=true;return;}running=true;try{await run();}catch(e){console.error('Kontrollen feilet; siste gyldige rapport beholdes: '+e.message);}finally{running=false;if(pending){pending=false;update();}}};
 await update();for(const file of files)watchFile(file,{interval:300},()=>{clearTimeout(timer);timer=setTimeout(update,250);});
 const close=()=>{clearTimeout(timer);files.forEach(file=>unwatchFile(file));};process.once('SIGINT',close);process.once('SIGTERM',close);
}
module.exports={scan,args,main};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
