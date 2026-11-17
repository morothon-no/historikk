// Synthetic OAuth identities only. No real provider credentials or live GitHub calls.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createGitHubAuth}=require('../scripts/admin/github-auth.cjs');
const {membershipPrincipal,authorize}=require('../scripts/admin/access-control.cjs');
const {createAccountDirectory}=require('../scripts/admin/account-directory.cjs');
const userId='11111111-1111-4111-8111-111111111111';
const accounts=()=>createAccountDirectory({users:[{userId,active:true}],externalIdentities:[{provider:'github',subject:'12345',userId}],memberships:[{userId,organizerId:'sogne-morothon',role:'owner',active:true}]});
function fixture(){
 let now=Date.parse('2026-11-17T12:00:00Z'),id=12345;const calls=[];
 const auth=createGitHubAuth({origin:'https://admin.example.test',clientId:'synthetic-client',clientSecret:'synthetic-server-secret',accounts:accounts(),clock:()=>now,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/user')?{id,login:'synthetic-login'}:{access_token:'synthetic-provider-token'}};}});
 const req=cookie=>({headers:{cookie}});
 async function login(){const start=auth.begin(),params=new URLSearchParams({state:new URL(start.location).searchParams.get('state'),code:'synthetic-code'}),cookie=start.cookie.split(';')[0],result=await auth.complete(req(cookie),params);return {start,params,flow:cookie,result,req:req(result.cookies[1].split(';')[0])};}
 return {auth,req,login,calls,advance:ms=>{now+=ms;},foreign:()=>{id=54321;}};
}
test('web admin OAuth binds state to browser, uses PKCE and numeric provider ID, never exposing client secret or provider token',async()=>{
 const f=fixture(),login=await f.login(),url=new URL(login.start.location);
 assert.equal(url.origin,'https://github.com');assert.equal(url.searchParams.get('scope'),'read:user');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.has('client_secret'),false);
 assert.match(login.result.cookies[1],/^__Host-.*; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800$/);
 const actor=f.auth.authenticate(login.req);assert.equal(actor.subject,userId);assert.deepEqual(actor.roles,{'sogne-morothon':'owner'});
 assert.equal(JSON.stringify(login.result).includes('synthetic-provider-token'),false);assert.equal(JSON.stringify(actor).includes('synthetic-server-secret'),false);
 const body=JSON.parse(f.calls[0].options.body);assert.equal(body.client_secret,'synthetic-server-secret');assert.equal(require('node:crypto').createHash('sha256').update(body.code_verifier).digest('base64url'),url.searchParams.get('code_challenge'));
 await assert.rejects(()=>f.auth.complete(f.req(login.flow),login.params),/utløpt/);
});
test('web admin rejects login CSRF, forged sessions, other accounts, replay and expired OAuth state',async()=>{
 const f=fixture(),start=f.auth.begin(),params=new URLSearchParams({state:new URL(start.location).searchParams.get('state'),code:'synthetic-code'});
 await assert.rejects(()=>f.auth.complete(f.req(''),params),/annen nettleser/);assert.equal(f.calls.length,0);
 assert.throws(()=>f.auth.authenticate(f.req('__Host-morothon-admin=forged')),/Logg inn/);
 f.foreign();await assert.rejects(()=>f.auth.complete(f.req(start.cookie.split(';')[0]),params),/ikke arrangørtilgang/);
 const expired=fixture(),s=expired.auth.begin();expired.advance(300001);await assert.rejects(()=>expired.auth.complete(expired.req(s.cookie.split(';')[0]),new URLSearchParams({state:new URL(s.location).searchParams.get('state'),code:'code'})),/utløpt/);
});
test('web admin sessions enforce CSRF, logout, inactivity and absolute expiry; browser role claims are ignored',async()=>{
 const f=fixture(),login=await f.login(),actor=f.auth.authenticate(login.req);
 assert.throws(()=>f.auth.csrf({...login.req,headers:{...login.req.headers,origin:'https://attacker.test','x-morothon-csrf':actor.csrf}},actor),/innloggede/);
 assert.throws(()=>f.auth.csrf({...login.req,headers:{...login.req.headers,origin:f.auth.origin,'x-morothon-csrf':'ø'.repeat(43)}},actor),/innloggede/);
 f.auth.csrf({...login.req,headers:{...login.req.headers,origin:f.auth.origin,'x-morothon-csrf':actor.csrf}},actor);
 f.auth.logout(login.req);assert.throws(()=>f.auth.authenticate(login.req),/Logg inn/);
 const idle=await f.login();f.advance(1800001);assert.throws(()=>f.auth.authenticate(idle.req),/Logg inn/);
 const full=await f.login();for(let i=0;i<16;i++){f.advance(29*60000);f.auth.authenticate(full.req);}f.advance(16*60000+1);assert.throws(()=>f.auth.authenticate(full.req),/Logg inn/);
});
test('web admin separates users from memberships, supports owner/editor/viewer, and refuses cross-organizer access',()=>{
 for(const role of ['owner','editor','viewer']){
  const p=membershipPrincipal({userId:'synthetic-user',active:true},[{userId:'synthetic-user',organizerId:'synthetic-event',role,active:true},{userId:'another-user',organizerId:'another-event',role:'owner',active:true}]);
  authorize(p,'synthetic-event','read');
  if(role==='viewer')assert.throws(()=>authorize(p,'synthetic-event','write'),/Ingen tilgang/);else authorize(p,'synthetic-event','write');
  if(role==='owner')authorize(p,'synthetic-event','approve');else assert.throws(()=>authorize(p,'synthetic-event','approve'),/Ingen tilgang/);
  assert.throws(()=>authorize(p,'another-event','read'),/Ingen tilgang/);
 }
 const revoked=membershipPrincipal({userId:'synthetic-user',active:true},[{userId:'synthetic-user',organizerId:'synthetic-event',role:'owner',active:false}]);assert.throws(()=>authorize(revoked,'synthetic-event','read'),/Ingen tilgang/);
});
test('web admin startup fails closed with missing secrets, non-HTTPS origins, arbitrary owner names and unsafe storage configuration',async()=>{
 for(const patch of [{origin:'http://example.test'},{origin:'https://example.test/path'},{clientSecret:''},{accounts:null}])assert.throws(()=>createGitHubAuth({origin:'https://example.test',clientId:'synthetic',clientSecret:'synthetic',accounts:accounts(),...patch}));
 await assert.rejects(()=>require('../scripts/admin-web.cjs').start({}),/Angi/);
});
test('internal user IDs, memberships and audit subjects survive replacing an external identity provider',()=>{
 const config={users:[{userId,active:true}],externalIdentities:[{provider:'github',subject:'12345',userId}],memberships:[{userId,organizerId:'sogne-morothon',role:'owner',active:true}]};
 const original=createAccountDirectory(config),replacement=createAccountDirectory({...config,externalIdentities:[{provider:'future-provider',subject:'opaque-provider-subject',userId}]});
 assert.equal(original.resolveIdentity('github','12345'),userId);assert.equal(replacement.resolveIdentity('future-provider','opaque-provider-subject'),userId);assert.equal(replacement.resolveIdentity('github','12345'),null);
 assert.deepEqual(membershipPrincipal(original.user(userId),original.memberships(userId)),membershipPrincipal(replacement.user(userId),replacement.memberships(userId)));
 assert.equal(membershipPrincipal(replacement.user(userId),replacement.memberships(userId)).subject,userId);
 assert.equal('linkIdentity' in replacement,false);assert.equal('createUser' in replacement,false);
});
test('identity registry refuses duplicate external identities, unknown users and provider-derived internal IDs',()=>{
 const config={users:[{userId,active:true}],externalIdentities:[{provider:'github',subject:'12345',userId}],memberships:[]};
 assert.throws(()=>createAccountDirectory({...config,externalIdentities:[...config.externalIdentities,...config.externalIdentities]}),/én intern bruker/);
 assert.throws(()=>createAccountDirectory({...config,externalIdentities:[{provider:'github',subject:'12345',userId:'unknown'}]}),/identitetskobling/);
 assert.throws(()=>createAccountDirectory({...config,users:[{userId:'github-12345',active:true}]}),/intern bruker-ID/);
 assert.equal(createAccountDirectory(config).resolveIdentity('github','another-subject'),null);
});
test('OAuth provider failures expose neither upstream response fragments nor credentials',async()=>{
 const auth=createGitHubAuth({origin:'https://admin.example.test',clientId:'synthetic-client',clientSecret:'synthetic-private-secret',accounts:accounts(),fetchImpl:async()=>({ok:true,json:async()=>{throw Error('synthetic-sensitive-upstream-token');}})});
 const start=auth.begin();await assert.rejects(()=>auth.complete({headers:{cookie:start.cookie.split(';')[0]}},new URLSearchParams({state:new URL(start.location).searchParams.get('state'),code:'synthetic-code'})),error=>{assert.equal(error.status,502);assert.equal(error.message.includes('synthetic-sensitive'),false);return true;});
});
