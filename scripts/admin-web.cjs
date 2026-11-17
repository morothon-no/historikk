// Deploy behind an HTTPS reverse proxy. The organizer uses only the existing browser UI.
'use strict';
const http=require('node:http'),path=require('node:path');
const {createAccountDirectory}=require('./admin/account-directory.cjs');
const {createGitHubAuth}=require('./admin/github-auth.cjs');
const {privateFileStore}=require('./admin/review-workspace.cjs');
const {createResultReview}=require('./admin/result-review.cjs');
const {approvedRuntime,createProjector}=require('./admin/review-runtime.cjs');
const {createWebHandler}=require('./admin/web-server.cjs');
async function start(env=process.env){
 const site=env.MOROTHON_ADMIN_SITE,approvalFile=env.MOROTHON_ADMIN_APPROVAL;
 if(!site||!path.isAbsolute(site)||!approvalFile||!path.isAbsolute(approvalFile)||!env.MOROTHON_ADMIN_PRIVATE_DIR||!/^\d+$/.test(env.PORT||'3000')||+env.PORT>65535||+env.PORT<1)throw Error('Angi godkjent absolutt byggsti, godkjenningsfil, privat mappe og gyldig PORT.');
 if(!/^[a-f0-9]{64}$/.test(env.MOROTHON_ADMIN_STORAGE_KEY||''))throw Error('Angi en privat 256-bit lagringsnøkkel i serverens hemmelighetslager.');
 if(!/^\d{1,20}$/.test(env.MOROTHON_OWNER_GITHUB_ID||''))throw Error('Angi hovedadministratorens verifiserte numeriske GitHub-ID.');
 const accounts=createAccountDirectory({users:[{userId:env.MOROTHON_OWNER_USER_ID,active:true}],externalIdentities:[{provider:'github',subject:env.MOROTHON_OWNER_GITHUB_ID,userId:env.MOROTHON_OWNER_USER_ID}],memberships:[{userId:env.MOROTHON_OWNER_USER_ID,organizerId:'sogne-morothon',role:'owner',active:true}]});
 const auth=createGitHubAuth({origin:env.MOROTHON_ADMIN_ORIGIN,clientId:env.MOROTHON_GITHUB_CLIENT_ID,clientSecret:env.MOROTHON_GITHUB_CLIENT_SECRET,accounts});
 const store=privateFileStore({directory:env.MOROTHON_ADMIN_PRIVATE_DIR,key:Buffer.from(env.MOROTHON_ADMIN_STORAGE_KEY,'hex')});
 await store.get(auth.organizerId); // Validate private/non-Git storage before accepting any request.
 const runtime=await approvedRuntime(site,approvalFile),projector=await createProjector(runtime);
 const loadContext=async organizer=>{
  if(organizer!==auth.organizerId)throw Error('Ukjent arrangør.');
  // Live approved version must still match the immutable served/projected snapshot.
  const current=await approvedRuntime(site,approvalFile);
  if(JSON.stringify(current.base)!==JSON.stringify(runtime.base))throw Error('Datagrunnlaget er oppdatert. Start tjenesten med det nye kontrollerte bygget.');
  return {...current,project:projector.project};
 };
 const review=createResultReview({authenticate:req=>auth.authenticate(req),loadContext,store});
 const server=http.createServer(createWebHandler({auth,review,runtime}));
 server.requestTimeout=30000;server.headersTimeout=10000;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(+(env.PORT||3000),'127.0.0.1',resolve);});}
 catch(e){await projector.close();throw e;}
 return {server,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await projector.close();}};
}
module.exports={start};
if(require.main===module)start().then(app=>{
 console.log('Autentisert admin er startet bak HTTPS-proxy. Ingen publisering er aktivert.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
}).catch(()=>{console.error('Admin kunne ikke starte. Kontroller serverkonfigurasjon, godkjent bygg, privat lagringsmappe og Chromium-sandbox. Ingen usikret reserve er aktivert.');process.exitCode=1;});
