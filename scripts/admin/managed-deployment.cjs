// Portable managed-app packaging and fail-closed boot. No cloud provisioning.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {runtimeFiles,ADMIN_SOURCES,DATA_NAMES}=require('../lib/runtime-files.cjs');
const {safeRead,readApprovedPackage}=require('../lib/public-package.cjs');
const {privateWorkspace}=require('./storage.cjs');
const root=path.resolve(__dirname,'../..'),digest=b=>createHash('sha256').update(b).digest('hex');
const SERVER=['scripts/admin-web.cjs','scripts/build-site.cjs',...['public-package','public-schema','runtime-files'].map(n=>'scripts/lib/'+n+'.cjs'),...['account-directory','access-control','github-auth','session-auth','review-workspace','result-review','review-runtime','web-server','storage','common','result-release','result-publication','github-result-publisher','deployment-verifier','managed-deployment','private-portal-assets'].map(n=>'scripts/admin/'+n+'.cjs'),'scripts/admin/review-client.js','tools/diploma-admin/result-release-data.cjs'];
const DEPLOY=['Dockerfile','entrypoint.sh','secrets.env.example'];
function origin(value){const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password||u.hostname.endsWith('.invalid'))throw Error('Angi den faktiske separate HTTPS-origin for admin.');return value;}
function sourcePaths(registry){return [...new Set([...runtimeFiles(registry).filter(p=>!p.startsWith('data/')).map(p=>ADMIN_SOURCES[p]||p),...SERVER,...Object.values(ADMIN_SOURCES),'web-admin/profile-contract.js','web-admin/event-profile.json','package.json','package-lock.json','.github/public-data-approval.json','public-data/manifest.json',...DATA_NAMES.map(n=>'public-data/data/'+n+'.json')])];}
function relative(name){if(typeof name!=='string'||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(name))throw Error('Ugyldig pakkesti.');return name;}
async function paths(directory){const result=[];async function walk(part){for(const e of await fs.readdir(path.join(directory,part),{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlenker er ikke tillatt i driftspakken.');if(!part&&e.name==='node_modules'){if(!e.isDirectory())throw Error('Ugyldig avhengighetsmappe.');continue;}const p=part?part+'/'+e.name:e.name;if(e.isDirectory())await walk(p);else if(e.isFile())result.push(p);else throw Error('Uventet filtype i driftspakken.');}}await walk('');return result.sort();}
async function bundle(destination,{source=root,codeSha}={}){
 const git=args=>execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 codeSha=codeSha||git(['rev-parse','HEAD']);
 if(!/^[a-f0-9]{40}$/.test(codeSha)||git(['rev-parse','HEAD'])!==codeSha||git(['status','--porcelain','--untracked-files=all']))throw Error('Pakk kun et rent, kontrollert checkout på eksakt commit.');
 const out=path.resolve(destination);if(out===source||source.startsWith(out+path.sep)||out.startsWith(source+path.sep))throw Error('Driftspakken skal ligge utenfor kildecheckout.');
 await fs.mkdir(out,{mode:0o700});
 try{
  if(await fs.realpath(out)!==out)throw Error('Driftspakken må ikke ha symlenkede mapper.');
  const checked=await readApprovedPackage(path.join(source,'public-data'),{approvalFile:path.join(source,'.github/public-data-approval.json'),assetsRoot:source});
  const names=sourcePaths(checked.data.badges);
  for(const name of names){const b=await safeRead(source,name);await fs.mkdir(path.dirname(path.join(out,name)),{recursive:true});await fs.writeFile(path.join(out,name),b,{flag:'wx',mode:0o644});}
  for(const name of DEPLOY)await fs.writeFile(path.join(out,name),await safeRead(source,'deploy/admin-managed/'+name),{flag:'wx',mode:name==='entrypoint.sh'?0o755:0o644});
  await require(path.join(out,'scripts/build-site.cjs')).buildSite(path.join(out,'site')); // Uses only the copied, public sources.
  const copied=await paths(out),dirs=[...new Set(copied.flatMap(p=>p.split('/').slice(0,-1).map((_,i)=>p.split('/').slice(0,i+1).join('/'))))].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b));
  const ignore=['**',...dirs.flatMap(p=>['!'+p+'/',p+'/**']),...copied.map(p=>'!'+p),'!.dockerignore','!admin-bundle.json'].join('\n')+'\n';await fs.writeFile(path.join(out,'.dockerignore'),ignore,{flag:'wx',mode:0o644});
  const files=Object.fromEntries(await Promise.all((await paths(out)).map(async p=>[p,digest(await safeRead(out,p))])));
  const manifest={schemaVersion:1,codeSha,publicManifestSha256:checked.approval.manifestSha256,files};
  await fs.writeFile(path.join(out,'admin-bundle.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o644});
  if(git(['rev-parse','HEAD'])!==codeSha||git(['status','--porcelain','--untracked-files=all']))throw Error('Kildene endret seg under pakking.');
  return {directory:out,codeSha,files:Object.keys(files).length};
 }catch(error){await fs.rm(out,{recursive:true,force:true});throw error;}
}
async function checkBundle(directory=root){
 const m=JSON.parse(await safeRead(directory,'admin-bundle.json'));
 if(!m||Object.keys(m).sort().join('|')!=='codeSha|files|publicManifestSha256|schemaVersion'||m.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(m.codeSha)||!/^[a-f0-9]{64}$/.test(m.publicManifestSha256)||!m.files||Array.isArray(m.files))throw Error('Ugyldig driftspakke.');
 const actual=(await paths(directory)).filter(p=>p!=='admin-bundle.json'),expected=Object.keys(m.files).sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Driftspakken har manglende eller uvedkommende filer.');
 for(const [p,sha]of Object.entries(m.files)){relative(p);if(p.startsWith('data/')||p.startsWith('tests/')||p.startsWith('docs/')||p.startsWith('.git/')||!/^[a-f0-9]{64}$/.test(sha)||digest(await safeRead(directory,p))!==sha)throw Error('Driftspakkens innhold eller kontrollsum er feil.');}
 const registry=JSON.parse(await safeRead(directory,'public-data/data/badges.json')),allowed=new Set([...sourcePaths(registry),...DEPLOY,'.dockerignore',...runtimeFiles(registry).map(p=>'site/'+p),'site/build-info.json','site/public-manifest.json']);
 if(expected.length!==allowed.size||expected.some(p=>!allowed.has(p)))throw Error('Driftspakken inneholder filer utenfor den eksplisitte listen.');
 const checked=await readApprovedPackage(path.join(directory,'site'),{approvalFile:path.join(directory,'.github/public-data-approval.json'),assetsRoot:path.join(directory,'site'),site:true});
 if(checked.approval.manifestSha256!==m.publicManifestSha256)throw Error('Driftspakken har feil godkjent datagrunnlag.');
 return m;
}
async function setup({directory,adminOrigin,ownerLogin,ownerId,fetchImpl=fetch}){
 origin(adminOrigin);await privateWorkspace(directory);
 if(!ownerId){if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(ownerLogin||''))throw Error('Angi eierens bekreftede GitHub-brukernavn.');let r;try{r=await fetchImpl('https://api.github.com/users/'+encodeURIComponent(ownerLogin),{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/vnd.github+json','User-Agent':'Morothon-setup'}});}catch{throw Error('GitHub-ID kunne ikke hentes. Ingen konto er opprettet.');}if(!r.ok)throw Error('GitHub avviste oppslag av eier.');const u=await r.json();if(u.type!=='User'||u.login?.toLowerCase()!==ownerLogin.toLowerCase()||!Number.isSafeInteger(u.id))throw Error('GitHub-identiteten kunne ikke kontrolleres.');ownerId=String(u.id);}
 if(!/^\d{1,20}$/.test(ownerId))throw Error('Ugyldig numerisk eier-ID.');
 const file=path.join(directory,'owner-secrets.env'),text='MOROTHON_OWNER_USER_ID='+randomUUID()+'\nMOROTHON_OWNER_GITHUB_ID='+ownerId+'\nMOROTHON_ADMIN_STORAGE_KEY='+randomBytes(32).toString('hex')+'\nMOROTHON_ADMIN_ORIGIN='+adminOrigin+'\n';
 await fs.writeFile(file,text,{flag:'wx',mode:0o600});return {file,created:true}; // Never print secret values. Never regenerate existing identities or keys.
}
async function persistentDisk(volume,directory,{mountInfo}={}){
 if(!path.isAbsolute(volume||'')||volume==='/'||!path.resolve(directory).startsWith(path.resolve(volume)+path.sep)||await fs.realpath(volume)!==path.resolve(volume))throw Error('Angi en separat, montert varig disk og privat undermappe.');
 const rows=(mountInfo??await fs.readFile('/proc/self/mountinfo','utf8')).split('\n').filter(Boolean).map(line=>{const [a,b]=line.split(' - ');return {mount:a.split(' ')[4]?.replace(/\\([0-7]{3})/g,(_,n)=>String.fromCharCode(parseInt(n,8))),type:b?.split(' ')[0]};});
 if(!rows.some(r=>r.mount===volume&&r.type&&!/tmpfs|ramfs/.test(r.type)))throw Error('Privat lagring må være et montert varig volum, ikke midlertidig rotfilsystem.');
}
async function boot({env=process.env,directory=root,projectorFactory,serverFactory,verifyPersistent=persistentDisk,verifyPublisher}={}){
 const manifest=await checkBundle(directory),{approvedRuntime,createProjector}=require('./review-runtime.cjs');
 const runEnv={...env,MOROTHON_ADMIN_SITE:path.join(directory,'site'),MOROTHON_ADMIN_APPROVAL:path.join(directory,'.github/public-data-approval.json'),MOROTHON_PUBLISH_CODE_SHA:manifest.codeSha};
 origin(runEnv.MOROTHON_ADMIN_ORIGIN);
 if(new URL(runEnv.MOROTHON_ADMIN_ORIGIN).origin===new URL(JSON.parse(await safeRead(directory,'package.json')).homepage).origin)throw Error('Bruk egen admin-origin. Offentlig Pages-origin skal ikke endres.');
 if(runEnv.MOROTHON_ADMIN_MANAGED_HTTPS!=='true'||!path.isAbsolute(runEnv.MOROTHON_ADMIN_PRIVATE_DIR||''))throw Error('Krever eksplisitt administrert HTTPS-proxy og privat, varig disk.');
 if(runEnv.MOROTHON_PUBLISH_ENABLED!=='false'&&runEnv.MOROTHON_PUBLISH_ENABLED!=='true')throw Error('Velg eksplisitt publisering avslått eller påslått.');
 if(!/^[a-f0-9]{64}$/.test(runEnv.MOROTHON_ADMIN_STORAGE_KEY||''))throw Error('Stabil privat lagringsnøkkel mangler.');
 require('./common.cjs').separate(directory,runEnv.MOROTHON_ADMIN_PRIVATE_DIR);
 try{await verifyPersistent(runEnv.MOROTHON_ADMIN_VOLUME_ROOT,runEnv.MOROTHON_ADMIN_PRIVATE_DIR);}catch(error){error.step='persistent-storage';throw error;}
 let keyDir,probe,app;
 try{
  if(runEnv.MOROTHON_PUBLISH_ENABLED==='true'){
   const pem=runEnv.MOROTHON_PUBLISH_APP_PRIVATE_KEY;if(!pem?.includes('PRIVATE KEY'))throw Error('Appens private nøkkel mangler i hemmelighetslageret.');
   keyDir=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-app-key-'));await fs.chmod(keyDir,0o700);runEnv.MOROTHON_PUBLISH_APP_KEY_FILE=path.join(keyDir,'key.pem');await fs.writeFile(runEnv.MOROTHON_PUBLISH_APP_KEY_FILE,pem,{mode:0o600,flag:'wx'});
  }
  delete runEnv.MOROTHON_PUBLISH_APP_PRIVATE_KEY;delete env.MOROTHON_PUBLISH_APP_PRIVATE_KEY;
  const runtime=await approvedRuntime(runEnv.MOROTHON_ADMIN_SITE,runEnv.MOROTHON_ADMIN_APPROVAL);
  try{probe=await (projectorFactory||createProjector)(runtime);await probe.checkSandbox();}catch(error){error.step='chromium-sandbox';throw error;}
  await privateWorkspace(runEnv.MOROTHON_ADMIN_PRIVATE_DIR);
  const dir=await fs.mkdtemp(path.join(runEnv.MOROTHON_ADMIN_PRIVATE_DIR,'storage-check-'));
  try{const store=require('./review-workspace.cjs').privateFileStore({directory:dir,key:Buffer.from(runEnv.MOROTHON_ADMIN_STORAGE_KEY,'hex')}),draft=require('../../tools/diploma-admin/intake-model.js').Corrections.empty(runtime.base),record={v:1,revision:1,status:'draft',base:runtime.base,draft,events:[]};await store.transact('readiness',0,()=>record);if(JSON.stringify(await store.get('readiness'))!==JSON.stringify(record))throw Error('Privat lagring kunne ikke gjenopprettes.');}finally{await fs.rm(dir,{recursive:true,force:true});}
  await probe.close();probe=null;
  if(runEnv.MOROTHON_PUBLISH_ENABLED==='true'){
   const verify=verifyPublisher|| (async()=>{const {createInstallationApi,createGitHubPublisher}=require('./github-result-publisher.cjs');const adapter=createGitHubPublisher({api:createInstallationApi({appId:runEnv.MOROTHON_PUBLISH_APP_ID,installationId:runEnv.MOROTHON_PUBLISH_INSTALLATION_ID,privateKey:await fs.readFile(runEnv.MOROTHON_PUBLISH_APP_KEY_FILE)}),codeSha:manifest.codeSha,appId:runEnv.MOROTHON_PUBLISH_APP_ID}),snapshot=await adapter.snapshot();if(digest(snapshot.files.get('public-data/manifest.json'))!==manifest.publicManifestSha256)throw Error('Oppdater adminpakken til siste godkjente offentlige data før aktivering.');});
   try{await verify();}catch(error){error.step='github-preflight';throw error;} // Read-only repository/protection/green-main preflight. Never submit or merge.
  }
  // start() repeats authentication/storage checks and runs with the sandbox enabled.
  app=await (serverFactory||require('../admin-web.cjs').start)(runEnv);
  return {manifest,app,close:async()=>{await app.close();if(keyDir)await fs.rm(keyDir,{recursive:true,force:true});}};
 }catch(error){if(probe)await probe.close();if(app)await app.close();if(keyDir)await fs.rm(keyDir,{recursive:true,force:true});throw error;}
}
async function smoke(adminOrigin,{fetchImpl=fetch}={}){
 origin(adminOrigin);const calls=[['/admin-healthz',200],['/admin/',303],['/admin-api/session',401],['/admin-api/review',401],['/admin-api/publication',401]];
 for(const [name,expected]of calls){const r=await fetchImpl(adminOrigin+name,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(r.status!==expected||r.headers.get('cache-control')!=='no-store'||!r.headers.get('x-robots-tag')?.includes('noindex'))throw Error('Admin-smoke feilet ved '+name+'.');if(name==='/admin/'&&r.headers.get('location')!=='/admin/login')throw Error('Anonym admin åpner ikke innlogging.');if(name==='/admin-healthz'&&JSON.stringify(await r.json())!==JSON.stringify({status:'ok'}))throw Error('Helsesjekken gir uventet innhold.');}
 return {checks:calls.length,authenticated:false,livePublicationTested:false};
}
module.exports={SERVER,DEPLOY,sourcePaths,bundle,checkBundle,setup,persistentDisk,boot,smoke};
if(require.main===module)(async()=>{
 const [action,...args]=process.argv.slice(2);
 if(action==='bundle'&&args.length===1)console.log(JSON.stringify(await bundle(args[0])));
 else if(action==='check'&&args.length<=1)console.log(JSON.stringify({valid:true,codeSha:(await checkBundle(args[0]||root)).codeSha}));
 else if(action==='setup'&&args.length===3)console.log(JSON.stringify(await setup({directory:args[0],adminOrigin:args[1],ownerLogin:args[2]})));
 else if(action==='smoke'&&args.length===1)console.log(JSON.stringify(await smoke(args[0])));
 else if(action==='serve'&&!args.length){const app=await boot();console.log('Autentisert admin startet. Ingen rettelse publiseres uten egen godkjenning.');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));}
 else throw Error('Bruk bundle <ny mappe> | check [pakke] | setup <privat mappe> <https-origin> <GitHub-navn> | smoke <https-origin> | serve');
})().catch(error=>{const step=['persistent-storage','chromium-sandbox','github-preflight'].includes(error?.step)?' ('+error.step+')':'';console.error('Driftskontrollen feilet'+step+'. Kontroller pakke, HTTPS, privat lagring, eier, hemmeligheter og Chromium-sandbox. Ingen usikker reserve aktiveres.');process.exitCode=1;});
