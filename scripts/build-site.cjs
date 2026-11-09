// Publish only runtime files. Tests, source archives and review material never enter the Pages artifact.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function buildSite(destination=path.join(root,'_site')){
 const out=path.resolve(destination);
 if(out===root||root.startsWith(out+path.sep))throw Error('Unsafe output directory');
 await fs.mkdir(out,{recursive:true});if((await fs.readdir(out)).length)throw Error('Output directory must be empty');
 const files=['index.html','heder.html',...['history','badges','honors','event-dates'].map(n=>`data/${n}.json`)];
 for(const [folder,extension]of [['css','.css'],['js','.js']])for(const name of await fs.readdir(path.join(root,folder)))if(name.endsWith(extension))files.push(`${folder}/${name}`);
 const registry=JSON.parse(await fs.readFile(path.join(root,'data/badges.json'),'utf8'));
 const assets=new Set([registry.watermark.src]);
 for(const badge of registry.badges){assets.add(badge.src);if(badge.vectorSource)assets.add(badge.vectorSource);}
 for(const src of assets){
  if(!/^assets\/medals\/(approved|identity|service|watermarks)\/[a-z0-9._-]+$/.test(src))throw Error(`Non-runtime asset in register: ${src}`);
  files.push(src);
 }
 for(const name of files){const dest=path.join(out,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,name),dest);}
 return {out,files:files.sort()};
}
module.exports={buildSite};
if(require.main===module)buildSite(process.argv[2]).then(r=>console.log(JSON.stringify({output:r.out,files:r.files.length}))).catch(e=>{console.error(e.message);process.exitCode=1;});
