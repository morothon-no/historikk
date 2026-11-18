// Deploy behind an HTTPS reverse proxy. The organizer uses only the existing browser UI.
'use strict';
const http=require('node:http'),path=require('node:path'),fs=require('node:fs/promises');
const {createAccountDirectory}=require('./admin/account-directory.cjs');
const {createGitHubAuth}=require('./admin/github-auth.cjs');
const {privateFileStore}=require('./admin/review-workspace.cjs');
const {createResultReview}=require('./admin/result-review.cjs');
const {approvedRuntime,createProjector}=require('./admin/review-runtime.cjs');
const {createWebHandler}=require('./admin/web-server.cjs');
const {createInstallationApi,createGitHubPublisher}=require('./admin/github-result-publisher.cjs');
const {createResultPublication}=require('./admin/result-publication.cjs');
const {createDeploymentVerifier}=require('./admin/deployment-verifier.cjs');
const {authorize,membershipPrincipal}=require('./admin/access-control.cjs');
const C=require('../tools/diploma-admin/intake-model.js').Corrections;
function listenHost(env){if(env.MOROTHON_ADMIN_MANAGED_HTTPS===undefined||env.MOROTHON_ADMIN_MANAGED_HTTPS==='false')return '127.0.0.1';if(env.MOROTHON_ADMIN_MANAGED_HTTPS==='true')return '0.0.0.0';throw Error('Velg eksplisitt administrert HTTPS-proxy.');}
async function start(env=process.env){
 const bind=listenHost(env);
 const checkStorage=async()=>{if(env.MOROTHON_ADMIN_MANAGED_HTTPS==='true')await require('./admin/managed-deployment.cjs').persistentDisk(env.MOROTHON_ADMIN_VOLUME_ROOT,env.MOROTHON_ADMIN_PRIVATE_DIR);};
 const site=env.MOROTHON_ADMIN_SITE,approvalFile=env.MOROTHON_ADMIN_APPROVAL;
 if(!site||!path.isAbsolute(site)||!approvalFile||!path.isAbsolute(approvalFile)||!env.MOROTHON_ADMIN_PRIVATE_DIR||!/^\d+$/.test(env.PORT||'3000')||+env.PORT>65535||+env.PORT<1)throw Error('Angi godkjent absolutt byggsti, godkjenningsfil, privat mappe og gyldig PORT.');
 if(!/^[a-f0-9]{64}$/.test(env.MOROTHON_ADMIN_STORAGE_KEY||''))throw Error('Angi en privat 256-bit lagringsnøkkel i serverens hemmelighetslager.');
 if(!/^\d{1,20}$/.test(env.MOROTHON_OWNER_GITHUB_ID||''))throw Error('Angi hovedadministratorens verifiserte numeriske GitHub-ID.');
 const accounts=createAccountDirectory({users:[{userId:env.MOROTHON_OWNER_USER_ID,active:true}],externalIdentities:[{provider:'github',subject:env.MOROTHON_OWNER_GITHUB_ID,userId:env.MOROTHON_OWNER_USER_ID}],memberships:[{userId:env.MOROTHON_OWNER_USER_ID,organizerId:'sogne-morothon',role:'owner',active:true}]});
 const auth=createGitHubAuth({origin:env.MOROTHON_ADMIN_ORIGIN,clientId:env.MOROTHON_GITHUB_CLIENT_ID,clientSecret:env.MOROTHON_GITHUB_CLIENT_SECRET,accounts});
 const store=privateFileStore({directory:env.MOROTHON_ADMIN_PRIVATE_DIR,key:Buffer.from(env.MOROTHON_ADMIN_STORAGE_KEY,'hex')});
 await checkStorage();
 await store.get(auth.organizerId); // Validate private/non-Git storage before accepting any request.
 const runtime=await approvedRuntime(site,approvalFile),projector=await createProjector(runtime);let liveSource=false;
 const loadContext=async organizer=>{
  if(organizer!==auth.organizerId)throw Error('Ukjent arrangør.');await checkStorage();
  // Live approved version must still match the immutable served/projected snapshot.
  if(liveSource)return {...runtime,project:projector.project};
  const current=await approvedRuntime(site,approvalFile);
  if(JSON.stringify(current.base)!==JSON.stringify(runtime.base))throw Error('Datagrunnlaget er oppdatert. Start tjenesten med det nye kontrollerte bygget.');
  return {...current,project:projector.project};
 };
 const review=createResultReview({authenticate:req=>auth.authenticate(req),loadContext,store});
 let publication,timer,closing=false;
 try{
  if(env.MOROTHON_PUBLISH_ENABLED==='true'){
   const file=env.MOROTHON_PUBLISH_APP_KEY_FILE,root=path.resolve(__dirname,'..');
   if(!file||!path.isAbsolute(file)||path.resolve(file).startsWith(root+path.sep))throw Error('App-nøkkelen skal ligge privat utenfor repositoryet.');
   const resolved=await fs.realpath(file);if(resolved===root||resolved.startsWith(root+path.sep))throw Error('App-nøkkelen må ikke peke inn i repositoryet.');
   const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.mode&0o077)throw Error('App-nøkkelfilen må være privat.');
   const api=createInstallationApi({appId:env.MOROTHON_PUBLISH_APP_ID,installationId:env.MOROTHON_PUBLISH_INSTALLATION_ID,privateKey:await fs.readFile(file)});
   const adapter=createGitHubPublisher({api,codeSha:env.MOROTHON_PUBLISH_CODE_SHA,appId:env.MOROTHON_PUBLISH_APP_ID});
   publication=createResultPublication({authenticate:req=>auth.authenticate(req),authorizeActor:async userId=>{await checkStorage();return authorize(membershipPrincipal(accounts.user(userId),accounts.memberships(userId)),auth.organizerId,'publish');},review,reviewStore:store,stateStore:privateFileStore({directory:path.join(env.MOROTHON_ADMIN_PRIVATE_DIR,'publications'),key:Buffer.from(env.MOROTHON_ADMIN_STORAGE_KEY,'hex')}),directory:env.MOROTHON_ADMIN_PRIVATE_DIR,loadContext,adapter,verifyLive:createDeploymentVerifier({verifyProfiles:projector.verifyProfiles}),onPublished:async(job,verified)=>{
    const manifest=JSON.parse(verified.files.get('public-manifest.json')),base=await C.binding(verified.history,{dataVersion:manifest.dataVersion,manifestSha256:job.approval.manifestSha256,historySha256:manifest.historySha256});
    Object.assign(runtime,{files:verified.files,history:verified.history,base});liveSource=true;return base;
   }});
   await publication.resume(auth.organizerId);
   timer=setInterval(()=>publication.progress(auth.organizerId).catch(()=>{}),10000);timer.unref();
  }else if(env.MOROTHON_PUBLISH_ENABLED&&env.MOROTHON_PUBLISH_ENABLED!=='false')throw Error('Velg eksplisitt om publisering skal aktiveres.');
 }catch(error){await projector.close();throw error;}
 const server=http.createServer(createWebHandler({auth,review,runtime,publication,healthy:async()=>{try{await checkStorage();return !closing&&projector.healthy();}catch{return false;}}}));
 server.requestTimeout=30000;server.headersTimeout=10000;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(+(env.PORT||3000),bind,resolve);});}
 catch(e){clearInterval(timer);await projector.close();throw e;}
 return {server,close:async()=>{closing=true;clearInterval(timer);await new Promise(r=>server.close(r));await publication?.drain();await projector.close();}};
}
module.exports={start,listenHost};
if(require.main===module)start().then(app=>{
 console.log('Autentisert admin er startet bak HTTPS-proxy. Publisering krever egen autorisert handling.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
}).catch(()=>{console.error('Admin kunne ikke starte. Kontroller serverkonfigurasjon, godkjent bygg, privat lagringsmappe og Chromium-sandbox. Ingen usikret reserve er aktivert.');process.exitCode=1;});
