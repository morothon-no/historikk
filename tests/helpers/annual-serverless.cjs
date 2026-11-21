'use strict';
// Synthetic network and repository only; real OAuth, AES-GCM stores, broker,
// pinned lease, parser, CAS and private processor driver.
const {setup:source,userId,organizer}=require('./result-publication.cjs'),{memory}=require('./identity-serverless.cjs'),
 {createAuth,token,hash}=require('../../scripts/admin/serverless/auth.cjs'),
 {createAccountDirectory}=require('../../scripts/admin/account-directory.cjs'),
 {createBroker}=require('../../scripts/admin/serverless/broker.cjs'),{createDriver}=require('../../scripts/admin/serverless/driver.cjs'),
 {githubStore,sha}=require('../../scripts/admin/serverless/github-store.cjs'),A=require('../../scripts/admin/annual-result-import.cjs');
const origin='https://annual-admin.example.test',codeSha='a'.repeat(40),workflowSha='b'.repeat(40);
async function setup(t,{publication=false}={}){
 const f=await source(t),control=memory(),authStore=memory(),encrypted=new Map(),dispatches=[],state={dispatchError:false,afterDispatch:null,run:100,now:1800000000000};
 Object.assign(f.context,{organizer,personIdPrefix:'MOR-',profile:require('../../web-admin/event-profile.json'),registry:require('../../public-data/data/badges.json')});
 const privateApi={repository:'synthetic/private-admin',request:async(route,opt)=>{
  if(route==='')return {private:true,full_name:'synthetic/private-admin',default_branch:'main',id:12345};
  if(route.startsWith('contents/')){const name=route.slice(9).split('?')[0],old=encrypted.get(name);
   if(opt?.method==='PUT'){const value=JSON.parse(opt.body);if((value.sha||null)!==(old?.sha||null))throw Error('Synthetic CAS conflict');encrypted.set(name,{content:value.content,sha:sha(value.content).slice(0,40)});return {};}
   return old?{type:'file',encoding:'base64',...old,size:Buffer.from(old.content,'base64').length}:null;
  }
  if(route.includes('/dispatches')){const d=JSON.parse(opt.body);dispatches.push(d);if(state.dispatchError)throw Error('Synthetic dispatch response lost');if(state.afterDispatch)await state.afterDispatch(d);return null;}
  if(route.includes('/runs?'))return {workflow_runs:[]};return {status:'in_progress'};
 }};
 const annualImports=githubStore({api:privateApi,key:f.key,repositoryId:'12345',prefix:'annual-imports'}),
  annualRequests=githubStore({api:privateApi,key:f.key,repositoryId:'12345',prefix:'annual-requests'}),
  accounts=createAccountDirectory({users:[{userId,active:true}],externalIdentities:[{provider:'github',subject:'123',userId}],memberships:[{userId,organizerId:organizer,role:'owner',active:true}]}),
  auth=createAuth({apiOrigin:origin,portalOrigin:origin,portalUrl:origin+'/admin/',clientId:'synthetic-client',clientSecret:'synthetic-secret',accounts,store:authStore,
   fetchImpl:async url=>Response.json(url.endsWith('/user')?{id:123}:{access_token:'synthetic-token'})});
 let broker;
 function restart(){broker=createBroker({portalUrl:origin+'/admin/',apiOrigin:origin,ownerUserId:userId,ownerGithubId:'123',codeSha,workflowSha,
  auth,reviews:f.reviewStore,control,annualImports,annualRequests,privateApi,annualPublicationEnabled:publication,clock:()=>state.now,
  publicApi:{request:async()=>({encoding:'base64',content:f.repository.files.get('.github/public-data-approval.json').toString('base64')})},
  verifyOidc:async jwt=>{if(jwt!=='synthetic-oidc')throw Object.assign(Error('deny'),{status:403});return {runId:String(++state.run)};},
  leaseTokens:async()=>({ownerUserId:userId,codeSha})});return broker;}restart();
 async function login(){const verifier=token(),begin=await auth.begin(new URLSearchParams({challenge:hash(verifier),state:token()})),completed=await auth.complete(
  new Request(origin+'/auth/callback',{headers:{cookie:begin.cookie.split(';')[0]}}),new URLSearchParams({state:new URL(begin.location).searchParams.get('state'),code:'synthetic-code'}));
  const code=new URLSearchParams(new URL(completed.location).hash.slice(1)).get('morothon-auth');return (await auth.exchange({code,verifier})).sessionToken;}
 async function request(route,body,session,{site=origin}={}){const r=await broker.fetch(new Request(origin+route,{method:body===undefined?'GET':'POST',
  headers:{...(site?{origin:site}:{}),...(session?{authorization:'Bearer '+session}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:r.status,body:await r.json()};}
 async function processNext(){const job=dispatches.shift();if(!job)throw Error('No synthetic dispatch');const r=await broker.fetch(new Request(origin+'/processor/lease',{
  method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer synthetic-oidc'},body:JSON.stringify(job.inputs)}));
  if(r.status!==200)throw Error('Synthetic lease HTTP '+r.status);return createDriver({lease:await r.json(),reviews:f.reviewStore,annualImports,annualRequests,control,
   loadContext:async()=>f.context,annualPublicationEnabled:publication,pause:async()=>{},stateStore:f.stateStore,directory:f.directory,
   checkBuild:publication?async()=>({version:'f'.repeat(16),siteUrl:'https://synthetic.example.test/',files:{}}):undefined,
   verifyLive:async()=>true,onPublished:async()=>{f.context.history=JSON.parse(f.repository.files.get('data/history.json'));f.context.base=await f.bind(f.repository.files);return f.context.base;},
   adapter:publication?f.adapter:new Proxy({},{get(){throw Error('Annual import must never call the publisher');}}),...state.publicationOptions}).run();}
 const csv=(time='49:20')=>'År;Navn;Øvelse;Distanse;Kjønn;Status;Tid;Plass;Startnummer\n2027;Syntetisk Kari Nord;Kortmoro;10 km;Herre;Fullført;'+time+';1;101\n2027;Syntetisk Ny Eksempel;Morothon;20 km;Dame;DNF;1:20:00;3;102\n2027;Syntetisk Uten Start;Kortmoro;10 km;Herre;DNS;DNS;;103';
 const sourceInput=(text=csv())=>A.request({organizer,base:f.context.base,year:2027,text});
 const command=(input=sourceInput(),revision=0,digest=null,extra={})=>({id:sha(token()).slice(0,32),input,expectedRevision:revision,expectedDigest:digest,replaceCurrent:false,...extra});
 return {...f,origin,auth,login,request,processNext,restart,command,sourceInput,csv,annualImports,annualRequests,control,encrypted,dispatches,state,get broker(){return broker;}};
}
module.exports={setup,origin,codeSha,workflowSha};
