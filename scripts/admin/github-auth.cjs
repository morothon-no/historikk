// Server-only GitHub OAuth. No repository scopes, browser secrets or client roles.
'use strict';
const {denied}=require('./access-control.cjs');
const {createSessionAuth,cookie,cookies,hash,same,token}=require('./session-auth.cjs');
const FLOW='__Host-morothon-oauth';
function createGitHubAuth({origin,clientId,clientSecret,accounts,organizerId='sogne-morothon',fetchImpl=fetch,clock=Date.now}={}){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||!clientId||!clientSecret||!accounts?.resolveIdentity||!/^[-a-z0-9]{2,63}$/.test(organizerId))throw Error('HTTPS-adresse, GitHub OAuth-konfigurasjon og internt kontoregister kreves.');
 const sessionAuth=createSessionAuth({origin,accounts,clock}),flows=new Map();
 function sweep(){for(const [key,f]of flows)if(f.expires<=clock())flows.delete(key);}
 function begin(){
  sweep();if(flows.size>=128)throw denied('For mange innloggingsforsøk. Prøv senere.',429);
  const state=token(),verifier=token(),binding=token();flows.set(hash(state),{verifier,binding:hash(binding),expires:clock()+5*60*1000});
  const target=new URL('https://github.com/login/oauth/authorize');
  target.search=new URLSearchParams({client_id:clientId,redirect_uri:origin+'/auth/github/callback',scope:'read:user',state,code_challenge:hash(verifier),code_challenge_method:'S256'}).toString();
  return {location:target.href,cookie:cookie(FLOW,binding,300)};
 }
 async function provider(url,options){
  try{
   const r=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('provider');
   return await r.json();
  }catch{throw denied('GitHub-innlogging kunne ikke bekreftes.',502);}
 }
 async function complete(req,params){
  sweep();
  if([...params.keys()].some(k=>params.getAll(k).length!==1)||params.has('error'))throw denied('Innloggingen ble avbrutt.');
  const state=params.get('state'),code=params.get('code'),f=typeof state==='string'&&flows.get(hash(state));
  if(!f||!same(f.binding,hash(cookies(req)[FLOW]||''))||!code||code.length>512)throw denied('Innloggingen er utløpt eller gjelder en annen nettleser.');
  flows.delete(hash(state)); // One-use, even when the provider rejects the code.
  const response=await provider('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:origin+'/auth/github/callback',code_verifier:f.verifier})});
  if(typeof response.access_token!=='string'||!response.access_token||response.access_token.length>4096)throw denied('GitHub-innlogging kunne ikke bekreftes.');
  const identity=await provider('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+response.access_token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Morothon-admin'}});
  const userId=Number.isSafeInteger(identity.id)&&accounts.resolveIdentity('github',String(identity.id));
  if(!userId)throw denied('GitHub-kontoen har ikke arrangørtilgang.');
  // No login/email/name auto-linking. Only a pre-provisioned external identity.
  // Provider token is discarded; session and audit refer only to the internal ID.
  return {location:origin+'/admin/#rettelser',cookies:[cookie(FLOW,'',0),sessionAuth.issue(req,userId)]};
 }
 return {begin,complete,authenticate:sessionAuth.authenticate,csrf:sessionAuth.csrf,logout:sessionAuth.logout,origin,organizerId};
}
module.exports={createGitHubAuth};
