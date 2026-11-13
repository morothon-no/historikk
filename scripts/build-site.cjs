// Explicit runtime package. A single deterministic content version also covers iframe CSS.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {exportPublicData,validateExport,validatePublicData}=require('./lib/public-data.cjs');
const BRAND_ASSETS=['assets/social/morothon-og.png','assets/icons/favicon-16.png','assets/icons/favicon-32.png','assets/icons/apple-touch-icon.png','assets/icons/favicon.ico'];
const DATA_NAMES=['history','badges','honors','volunteers','event-dates'];
// New administrative code must not become public just by appearing in js/.
const PUBLIC_CODE=['css/diplomas.css','css/navigation.css','css/brag-card.css','css/honors.css',
 'js/compare.js','js/rankings.js','js/loyalty.js','js/brag-card.js','js/honors.js','js/history-data.js',
 'js/navigation.js','js/diplomas.js','js/badges.js','js/honors-data.js','js/progress.js','js/milestones.js'];
async function readInputs(){return Object.fromEntries(await Promise.all(DATA_NAMES.map(async n=>[n,JSON.parse(await fs.readFile(path.join(root,'data',n+'.json'),'utf8'))])));}
function runtimeFiles(registry){
 const files=['index.html','heder.html',...DATA_NAMES.map(n=>`data/${n}.json`),...BRAND_ASSETS,'assets/fonts/caveat-regular-latin.woff','assets/fonts/OFL-Caveat.txt',...PUBLIC_CODE];
 const assets=new Set([registry.watermark.src]);
 for(const badge of registry.badges){assets.add(badge.src);if(badge.vectorSource)assets.add(badge.vectorSource);}
 for(const src of assets){
  if(!/^assets\/medals\/(approved|identity|service|watermarks)\/[a-z0-9._-]+$/.test(src))throw Error('Non-runtime asset in public register');
  files.push(src);
 }
 return files.sort();
}
async function validatePublicSite(out){
 const original=await readInputs(),actual=Object.fromEntries(await Promise.all(DATA_NAMES.map(async n=>[n,JSON.parse(await fs.readFile(path.join(out,'data',n+'.json'),'utf8'))])));
 validateExport(actual,original);
 validatePublicData('build-info',JSON.parse(await fs.readFile(path.join(out,'build-info.json'),'utf8')));
 const expected=[...runtimeFiles(actual.badges),'build-info.json'].sort(),found=[];
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink in public package');if(e.isDirectory())await walk(full);else found.push(path.relative(out,full).split(path.sep).join('/'));}}
 await walk(out);found.sort();
 if(JSON.stringify(found)!==JSON.stringify(expected))throw Error('Unexpected or missing file in public package');
 return {files:found.length,visiblePeople:actual.honors.groups.reduce((n,g)=>n+g.members.length,0)+actual.volunteers.people.filter(p=>p.id).length};
}
async function buildSite(destination=path.join(root,'_site')){
 const out=path.resolve(destination);
 if(out===root||root.startsWith(out+path.sep))throw Error('Unsafe output directory');
 await fs.mkdir(out,{recursive:true});if((await fs.readdir(out)).length)throw Error('Output directory must be empty');
 const original=await readInputs(),publicData=exportPublicData(original),files=runtimeFiles(publicData.badges);
 const sources=new Map(await Promise.all(files.map(async f=>[f,await fs.readFile(path.join(root,f))])));
 for(const name of DATA_NAMES)if(name!=='history')sources.set(`data/${name}.json`,Buffer.from(JSON.stringify(publicData[name],null,2)+'\n'));
 const hash=createHash('sha256');
 // Include the rewriter itself: changing build semantics must invalidate cached assets too.
 for(const f of ['scripts/build-site.cjs','scripts/lib/public-data.cjs','package.json',...files]){const bytes=sources.get(f)||await fs.readFile(path.join(root,f));hash.update(f+'\0'+bytes.length+'\0');hash.update(bytes);}
 const version=hash.digest('hex').slice(0,16),packageInfo=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const siteUrl=new URL(packageInfo.homepage);if(siteUrl.protocol!=='https:'||!siteUrl.pathname.endsWith('/'))throw Error('homepage must be an absolute HTTPS directory URL');
 const code=new Set(files.filter(f=>/\.(css|js)$/.test(f)));
 function assetUrl(value){const match=value.match(/^((?:\.\/)?(?:css|js)\/[^?#]+)(\?[^#]*)?(#.*)?$/);if(!match||!code.has(match[1].replace(/^\.\//,'')))return value;const params=new URLSearchParams(match[2]||'');params.set('v',version);return match[1]+'?'+params.toString()+(match[3]||'');}
 for(const name of files){
  let bytes=sources.get(name);
  if(/\.(html|js|css)$/.test(name)){
   let text=bytes.toString('utf8');
   // Covers HTML href/src as well as new URL('css/diplomas.css', document.baseURI).
   text=text.replace(/(['"])((?:\.\/)?(?:css|js)\/[^'"\s<>]+)\1/g,(full,quote,value)=>quote+assetUrl(value)+quote);
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
 await validatePublicSite(out);
 return {out,files:[...files,'build-info.json'].sort(),version};
}
module.exports={buildSite,BRAND_ASSETS,validatePublicSite};
if(require.main===module)buildSite(process.argv[2]).then(r=>console.log(JSON.stringify({output:r.out,files:r.files.length,version:r.version}))).catch(e=>{console.error(e.message);process.exitCode=1;});
