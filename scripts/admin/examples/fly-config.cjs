// Optional Fly.io example only. Not imported by, or included in, the admin runtime.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {privateWorkspace}=require('../storage.cjs');
async function config({directory,appName,templateFile=path.resolve(__dirname,'../../../deploy/admin-managed/examples/fly/fly.toml.example')}){
 if(!/^[a-z][a-z0-9-]{2,50}$/.test(appName||''))throw Error('Velg et gyldig, separat applikasjonsnavn.');
 await privateWorkspace(directory);const file=path.join(directory,'fly.toml'),text=(await fs.readFile(templateFile,'utf8')).replaceAll('REPLACE-WITH-APP-NAME',appName);
 await fs.writeFile(file,text,{flag:'wx',mode:0o600});return {file,adminUrl:'https://'+appName+'.fly.dev/admin/',callback:'https://'+appName+'.fly.dev/auth/github/callback',publicationEnabled:false};
}
module.exports={config};
if(require.main===module){const [directory,appName,...extra]=process.argv.slice(2);if(!directory||!appName||extra.length){console.error('Bruk <privat mappe> <appnavn>. Ingen tjeneste opprettes.');process.exitCode=1;}else config({directory,appName}).then(v=>console.log(JSON.stringify(v))).catch(()=>{console.error('Konfigurasjonen kunne ikke opprettes. Eksisterende filer er bevart.');process.exitCode=1;});}
