// Synthetic owner/provider, real auth/broker/driver and encrypted private files.
'use strict';
const path=require('node:path'),{randomBytes}=require('node:crypto');
const {setup:sourceFixture,userId,organizer}=require('./result-publication.cjs');
const {createAuth,token,hash}=require('../../scripts/admin/serverless/auth.cjs');
const {createAccountDirectory}=require('../../scripts/admin/account-directory.cjs');
const {createBroker}=require('../../scripts/admin/serverless/broker.cjs');
const {createDriver}=require('../../scripts/admin/serverless/driver.cjs');
const {privateFileStore}=require('../../scripts/admin/review-workspace.cjs');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections;
const origin='https://identity-admin.example.test',codeSha='a'.repeat(40),workflowSha='b'.repeat(40);
function memory(){const data=new Map();return {get:async k=>structuredClone(data.get(k)||null),
  transact:async(k,r,fn)=>{const old=data.get(k);if((old?.revision||0)!==r)throw Object.assign(Error('endret'),{status:409});
    const next=fn(structuredClone(old||null));data.set(k,structuredClone(next));return structuredClone(next);}};}
async function setup(t,{identityPublicationEnabled=false,publicationOptions={},history}={}){
  const f=await sourceFixture(t,{history}),control=memory(),authStore=memory(),key=randomBytes(32),dispatches=[];
  const directory=path.join(f.directory,'identity-private');
  const accounts=createAccountDirectory({users:[{userId,active:true}],
    externalIdentities:[{provider:'github',subject:'123',userId}],
    memberships:[{userId,organizerId:organizer,role:'owner',active:true}]});
  const auth=createAuth({apiOrigin:origin,portalOrigin:origin,portalUrl:origin+'/admin/',
    clientId:'synthetic-client',clientSecret:'synthetic-secret',accounts,store:authStore,
    fetchImpl:async url=>Response.json(url.endsWith('/user')?{id:123}:{access_token:'synthetic-provider-token'})});
  let identities=privateFileStore({directory,key}),broker,runId=100;
  function restart(){identities=privateFileStore({directory,key});broker=createBroker({
    portalUrl:origin+'/admin/',apiOrigin:origin,ownerUserId:userId,ownerGithubId:'123',codeSha,workflowSha,
    auth,reviews:f.reviewStore,identities,control,
    identityPublicationEnabled,
    privateApi:{request:async(route,options)=>{if(route.includes('/dispatches')){dispatches.push(JSON.parse(options.body));return null;}
      return {status:'in_progress'};}},
    publicApi:{request:async()=>({encoding:'base64',content:f.repository.files.get('.github/public-data-approval.json').toString('base64')})},
    verifyOidc:async jwt=>{if(jwt!=='synthetic-oidc')throw Object.assign(Error('deny'),{status:403});return {runId:String(++runId)};},
    leaseTokens:async()=>({ownerUserId:userId,codeSha})});return broker;}
  restart();
  async function login(){const verifier=token(),state=token(),begin=await auth.begin(new URLSearchParams({challenge:hash(verifier),state}));
    const completed=await auth.complete(new Request(origin+'/auth/callback',{headers:{cookie:begin.cookie.split(';')[0]}}),
      new URLSearchParams({state:new URL(begin.location).searchParams.get('state'),code:'synthetic-code'}));
    const code=new URLSearchParams(new URL(completed.location).hash.slice(1)).get('morothon-auth');
    return (await auth.exchange({code,verifier})).sessionToken;}
  async function request(route,body,session,{origin:site=origin}={}){const response=await broker.fetch(new Request(origin+route,{
    method:body===undefined?'GET':'POST',headers:{...(site?{origin:site}:{}),...(session?{authorization:'Bearer '+session}:{}),
      ...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
    return {response,status:response.status,body:await response.json()};}
  async function processNext(){const job=dispatches.shift();if(!job)throw Error('Ingen syntetisk jobb.');
    const response=await broker.fetch(new Request(origin+'/processor/lease',{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer synthetic-oidc'},body:JSON.stringify(job.inputs)}));
    if(response.status!==200)throw Error('Syntetisk lease ble avvist.');const lease=await response.json();
    return createDriver({lease,identities,control,reviews:f.reviewStore,loadContext:async()=>f.context,
      ...(identityPublicationEnabled ? {identityPublicationEnabled,stateStore:f.stateStore,directory:f.directory,adapter:f.adapter,
        pause:async()=>{},verifyLive:async()=>{if(!f.remote.live)throw Error('Synthetic live verification failure');return true;},
        onPublished:async()=>{f.context.history=JSON.parse(f.repository.files.get('data/history.json'));f.context.base=await f.bind(f.repository.files);return f.context.base;},
        checkBuild:async()=>({version:'f'.repeat(16),siteUrl:'https://synthetic.example.test/',files:{}}),...publicationOptions}:
        {adapter:new Proxy({}, {get(){throw Error('Identity jobs must never access the public publisher');}})})}).run();}
  function command(kind='same-person',extra={}){return {format:'morothon-identity-decision-v1',version:1,id:'synthetic-'+token().slice(0,20),
    base:structuredClone(f.context.base),kind,personIds:['MOR-C220001','MOR-C220002'],mainPersonId:kind==='same-person'?'MOR-C220002':null,name:null,
    source:'Syntetisk arrangørkilde',reason:'Identiteten er kontrollert i en syntetisk kilde.',...extra};}
  return {...f,origin,auth,login,request,processNext,command,restart,dispatches,control,directory,key,
    get broker(){return broker;},get identities(){return identities;}};
}
module.exports={setup,memory,origin,codeSha,workflowSha};
