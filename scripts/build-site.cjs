// Public-only builder: consumes an approved package, never administrative originals.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {BRAND_ASSETS,DATA_NAMES,PUBLIC_CODE,ADMIN_SOURCES,runtimeFiles}=require('./lib/runtime-files.cjs');
const {readApprovedPackage,safeRead}=require('./lib/public-package.cjs');
const {assertValid}=require('../js/history-data.js');
const defaultApproval=path.join(root,'.github/public-data-approval.json');
async function validatePublicSite(out,{approvalFile=defaultApproval,approval}={}){
 const verified=await readApprovedPackage(out,{approvalFile,approval,assetsRoot:out,site:true});
 assertValid(verified.data.history);
 return {files:runtimeFiles(verified.data.badges).length+2,visiblePeople:verified.visiblePeople,dataVersion:verified.manifest.dataVersion};
}
async function buildSite(destination=path.join(root,'_site'),{dataDir=path.join(root,'public-data'),approvalFile=defaultApproval,approval}={}){
 const out=path.resolve(destination);
 if(out===root||root.startsWith(out+path.sep))throw Error('Unsafe output directory');
 await fs.mkdir(out,{recursive:true});if((await fs.readdir(out)).length)throw Error('Output directory must be empty');
 const verified=await readApprovedPackage(dataDir,{approvalFile,approval,assetsRoot:root}),files=runtimeFiles(verified.data.badges);
 assertValid(verified.data.history);
 const sources=new Map();
 for(const file of files)sources.set(file,verified.bytes.get(file)||verified.assetBytes.get(file)||await safeRead(root,ADMIN_SOURCES[file]||file));
 const hash=createHash('sha256');
 // Include the rewriter itself: changing build semantics must invalidate cached assets too.
 for(const f of ['scripts/build-site.cjs','scripts/lib/public-schema.cjs','scripts/lib/public-package.cjs','scripts/lib/runtime-files.cjs','package.json',...files]){const bytes=sources.get(f)||await fs.readFile(path.join(root,f));hash.update(f+'\0'+bytes.length+'\0');hash.update(bytes);}
 hash.update(verified.manifestBytes);
 const version=hash.digest('hex').slice(0,16),packageInfo=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const siteUrl=new URL(packageInfo.homepage);if(siteUrl.protocol!=='https:'||!siteUrl.pathname.endsWith('/'))throw Error('homepage must be an absolute HTTPS directory URL');
 const code=new Set(files.filter(f=>/\.(css|js)$/.test(f)));
 const profile=JSON.parse(sources.get('admin/event-profile.json'));require('../web-admin/profile-contract.js').validate(profile,verified.data.badges);
 function assetUrl(value){const match=value.match(/^((?:\.\/)?(?:css|js|admin)\/[^?#]+)(\?[^#]*)?(#.*)?$/);if(!match||!code.has(match[1].replace(/^\.\//,'')))return value;const params=new URLSearchParams(match[2]||'');params.set('v',version);return match[1]+'?'+params.toString()+(match[3]||'');}
 for(const name of files){
  let bytes=sources.get(name);
  if(/\.(html|js|css)$/.test(name)){
   let text=bytes.toString('utf8');
   if(name==='admin/index.html'){
    text=text.replace(/<meta name="local-session"[^>]*>/,'').replace('<body class="portal-app">','<body class="portal-app" data-admin-mode="public-preview">')
      .replace('sandbox="allow-same-origin"','sandbox="allow-same-origin allow-modals"')
      .replaceAll('/site/assets/','../assets/').replace('Utviklingsversjon · lokal tilgang','Offentlig testversjon · ingen innlogging').replace('Lokalt arbeidsrom','Offentlig testversjon').replace('Utviklingsversjon.<br>Ingen innlogging eller produksjonsdrift.','Offentlig tilgjengelig test.<br>Kun godkjente offentlige data.').replace('Kun lokal utvikling. Jobblisten lagres i nettleserøkten.','Offentlig testversjon · ingen innlogging eller administrative skrivefunksjoner.');
    for(const f of ['admin.css','admin.js','portal.js','design-model.js','design-studio.js','design-studio.css'])text=text.replaceAll('/'+f,'./'+f+'?v='+version);
    const extra=['../js/history-data.js','portal-data.js','profile-contract.js','web-transport.js'].map(f=>'<script defer src="'+f+'?v='+version+'"></script>').join('');
    text=text.replace('<script defer src="./admin.js',extra+'<script defer src="./admin.js');
   }

   // Covers HTML href/src as well as new URL('css/diplomas.css', document.baseURI).
   text=text.replace(/(['"])((?:\.\/)?(?:css|js|admin)\/[^'"\s<>]+)\1/g,(full,quote,value)=>quote+assetUrl(value)+quote);
   if(name.endsWith('.html')){
    text=text.replace(/(<meta\b[^>]*\bname="morothon-version"[^>]*\bcontent=")[^"]*(")/g,'$1'+version+'$2').replace(/(<meta\b[^>]*\bcontent=")[^"]*("[^>]*\bname="morothon-version")/g,'$1'+version+'$2');
    if(name==='index.html'){
     text=text.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]*(")/g,'$1'+siteUrl.href+'$2');
     text=text.replace(/(<meta\b[^>]*(?:property|name)="(?:og:url|twitter:url)"[^>]*content=")[^"]*(")/g,'$1'+siteUrl.href+'$2');
     text=text.replace(/(<meta\b[^>]*(?:property|name)="(?:og:image|twitter:image)"[^>]*content=")[^"]*(")/g,'$1'+new URL('assets/social/morothon-og.png',siteUrl).href+'$2');
    }
   }
   bytes=Buffer.from(text);
  }
  const dest=path.join(out,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);
 }
 const manifest={version,siteUrl:siteUrl.href,assets:Object.fromEntries([...code].sort().map(f=>[f,assetUrl(f)]))};
 await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify(manifest,null,2)+'\n');
 await fs.writeFile(path.join(out,'public-manifest.json'),verified.manifestBytes);
 await validatePublicSite(out,{approval:verified.approval});
 return {out,files:[...files,'build-info.json','public-manifest.json'].sort(),version};
}
module.exports={buildSite,BRAND_ASSETS,validatePublicSite};
if(require.main===module)buildSite(process.argv[2],{...(process.argv[3]?{dataDir:process.argv[3]}:{}),...(process.argv[4]?{approvalFile:process.argv[4]}:{})}).then(r=>console.log(JSON.stringify({output:r.out,files:r.files.length,version:r.version}))).catch(e=>{console.error(e.message);process.exitCode=1;});
