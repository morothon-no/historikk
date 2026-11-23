"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAdminGateway } = require("../scripts/admin/serverless/admin-gateway.cjs");
const { buildProtectedAdmin } = require("../scripts/build-protected-admin.cjs");
const { ADMIN_SOURCES, PUBLIC_CODE, runtimeFiles } = require("../scripts/lib/runtime-files.cjs");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const origin = "https://morothon-admin.damofra75.workers.dev";
const TOKEN = "x".repeat(43);
function fixture(options = {}) {
  let allowed = true, revoked = false, assetReads = 0;
  const auth = {
    exchange: async ({code,verifier}) => {
      if (code !== "valid" || verifier !== "valid") throw Error("bad exchange");
      return {sessionToken:TOKEN};
    },
    authenticate: async req => {
      if (!allowed || revoked || req.headers.get("authorization") !== "Bearer " + TOKEN)
        throw Error("unauthorized");
      return { roles: {"sogne-morothon":"owner"} };
    },
    logout: async req => {
      if (req.headers.get("authorization") !== "Bearer " + TOKEN) throw Error("invalid");
      revoked = true;
    },
  };
  const gate = createAdminGateway({portalOrigin:origin,apiOrigin:"https://morothon-admin.example.test",auth,...options,assetSource:async name => {
    assetReads++;
    return { bytes: "PRIVATE:" + name };
  }});
  const req = (path, {method="GET",cookie,headers={},body}={}) =>
    new Request(origin + path, {
      method,
      headers: { ...(cookie?{cookie: "__Host-morothon-admin=" + cookie}:{}), ...headers },
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
  return {gate,req,reads:()=>assetReads,deny:()=>{allowed=false;},revoked:()=>revoked};
}
test("anonymous admin gets login-only HTML and cannot retrieve JS or CSS bytes", async () => {
  const f=fixture();
  const page=await f.gate(f.req("/admin/"));
  assert.equal(page.status,200);
  assert.match(await page.text(),/Logg inn/);
  assert.doesNotMatch(await f.gate(f.req("/admin/")).then(r=>r.text()),/PRIVATE:/);
  for (const p of ["/admin/index.js","/admin/admin.js","/admin/admin.css","/admin/event-profile.json"]) {
    assert.equal((await f.gate(f.req(p))).status,401);
  }
  assert.equal(f.reads(),0,"no protected bytes read for anonymous requests");
});
test("PKCE handoff can create HTTP-only same-site cookie only from same origin", async () => {
  const f=fixture();
  const invalid=await f.gate(f.req("/admin/_session",{method:"POST",headers:{origin:"https://evil.test"},body:{code:"valid",verifier:"valid"}}));
  assert.equal(invalid.status,403);
  assert.equal((await f.gate(f.req("/admin/_session",{method:"POST",headers:{origin},body:{code:"wrong",verifier:"valid"}}))).status,401);
  const r=await f.gate(f.req("/admin/_session",{method:"POST",headers:{origin},body:{code:"valid",verifier:"valid"}}));
  assert.equal(r.status,200);
  assert.match(r.headers.get("set-cookie"),/__Host-morothon-admin=/);
  for(const flag of ["HttpOnly","Secure","SameSite=Strict","Path=/"]) assert.ok(r.headers.get("set-cookie").includes(flag));
  assert.equal((await f.gate(f.req("/admin/admin.js",{cookie:TOKEN}))).status,200);
  assert.equal(await (await f.gate(f.req("/admin/admin.js",{cookie:TOKEN}))).text(),"PRIVATE:admin.js");
});
test("authorization is verified before every protected asset, and logout revokes session", async () => {
  const f=fixture();
  assert.equal((await f.gate(f.req("/admin/admin.js",{cookie:TOKEN}))).status,200);
  f.deny();
  assert.equal((await f.gate(f.req("/admin/admin.js",{cookie:TOKEN}))).status,401);
  const p=await f.gate(f.req("/admin/",{cookie:TOKEN}));
  assert.equal(p.status,200);
  assert.match(await p.text(),/Logg inn/);
  assert.equal(f.reads(),1);
  const g=fixture();
  const response=await g.gate(g.req("/admin/_logout",{method:"POST",headers:{origin},cookie:TOKEN,body:{}}));
  assert.equal(response.status,200);
  assert.equal(g.revoked(),true);
  assert.equal((await g.gate(g.req("/admin/admin.js",{cookie:TOKEN}))).status,401);
});
test("path traversal, reserved endpoints and malformed paths cannot reach asset adapter", async () => {
  const f=fixture();
  for(const p of ["/admin/a%2fb.js","/admin/noextension","/admin/foo.map"]) {
    assert.equal((await f.gate(f.req(p,{cookie:TOKEN}))).status,404,p);
  }
  // The Request constructor canonicalizes %2e%2e before the Worker receives it.
  // It therefore cannot be used to assert that the Worker saw a raw traversal path.
  assert.equal(f.reads(),0);
});

test("protected owner can retrieve existing result API bearer only after server validation", async () => {
  const f=fixture();
  assert.equal((await f.gate(f.req("/admin/_session"))).status,401);
  const res=await f.gate(f.req("/admin/_session",{cookie:TOKEN}));
  assert.equal(res.status,200);
  assert.equal((await res.json()).sessionToken,TOKEN);
  f.deny();
  assert.equal((await f.gate(f.req("/admin/_session",{cookie:TOKEN}))).status,401);
});
test("public runtime excludes all admin files; protected bundle contains only explicit source assets", async () => {
  assert.ok(!PUBLIC_CODE.some(n=>n.startsWith("admin/")));
  const runtime=runtimeFiles({badges:[],watermark:{src:"assets/medals/watermarks/example.png"}});
  assert.ok(!runtime.some(n=>n.startsWith("admin/")));
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"morothon-gated-assets-"));
  try{
    const output=path.join(temp,"private");
    const result=await buildProtectedAdmin(output);
    assert.equal(result.count,Object.keys(ADMIN_SOURCES).length);
    const files=await fs.readdir(path.join(output,"admin"));
    assert.deepEqual(files.sort(),Object.keys(ADMIN_SOURCES).map(n=>path.basename(n)).sort());
    const html=await fs.readFile(path.join(output,"admin/index.html"),"utf8");
    assert.match(html,/data-admin-mode="protected"/);
    assert.match(html,/src="\/site\/js\/history-data\.js"/);
    assert.doesNotMatch(html,/src="\.\.\/js\/history-data\.js"/);
    assert.match(html,/morothon-admin-service" content="https:\/\/morothon-admin/);
    assert.doesNotMatch(html,/morothon-admin-auth-probe/);
    assert.ok(!files.some(n=>/history\.json|original|private/i.test(n)));
  } finally{await fs.rm(temp,{recursive:true,force:true});}
});

test("same-origin protected bearer GET gets required broker Origin without permitting foreign requests", async () => {
  const { sameOriginBrokerRead } = await import("../scripts/admin/serverless/worker.mjs");
  const bearer = "Bearer " + TOKEN;
  const req = (route, { method="GET", originHeader, site="same-origin", auth=bearer }={}) =>
    new Request(origin + route, {
      method,
      headers: {
        "Sec-Fetch-Site": site,
        ...(auth?{"Authorization":auth}:{}),
        ...(originHeader?{"Origin":originHeader}:{})
      }
    });
  for (const route of ["/session", "/review"]) {
    const input=req(route), result=sameOriginBrokerRead(input,origin);
    assert.equal(input.headers.get("origin"),null);
    assert.equal(result.headers.get("origin"),origin);
    assert.equal(result.headers.get("authorization"),bearer);
  }
  for (const input of [
    req("/session",{site:"cross-site"}),
    req("/session",{site:"none"}),
    req("/review",{auth:null}),
    req("/review",{originHeader:"https://evil.test"}),
    req("/review/save"),
    req("/session",{method:"POST"}),
    new Request("https://evil.test/session",{headers:{"Sec-Fetch-Site":"same-origin",Authorization:bearer}})
  ])
    assert.equal(sameOriginBrokerRead(input,origin),input);
});

test("OAuth begin failure diagnostics identify only safe, read-only stages", async () => {
  const { diagnoseAuthStorage } = await import("../scripts/admin/serverless/worker.mjs");
  const id = "1456606620";
  const repo = "morothon-no/historikk-admin";
  const meta = { private:true, full_name:repo, default_branch:"main", id:Number(id) };
  const calls = [];
  const api = {
    repository: repo,
    token: async () => { calls.push("token"); return "synthetic-token"; },
    request: async (route, opts) => {
      calls.push(route);
      if(route === "") return meta;
      assert.deepEqual(opts,{allow404:true});
      return null;
    },
  };
  assert.equal(await diagnoseAuthStorage(api,id),"AUTH_STATE_WRITE_OR_CRYPTO");
  assert.deepEqual(calls,["token","","contents/.morothon-state/auth?ref=admin-state"]);
  assert.equal(await diagnoseAuthStorage({...api,token:async()=>{throw Error("synthetic PRIVATE KEY");}},id),
    "AUTH_APP_INSTALLATION_TOKEN");
  assert.equal(await diagnoseAuthStorage({...api,request:async()=>{throw Error("synthetic PRIVATE DATA");}},id),
    "AUTH_PRIVATE_REPOSITORY_ACCESS");
  assert.equal(await diagnoseAuthStorage({...api,request:async(route)=>{
    if(route === "") return {...meta,private:false};
    return null;
  }},id),"AUTH_PRIVATE_REPOSITORY_METADATA");
  assert.equal(await diagnoseAuthStorage({...api,request:async(route)=>{
    if(route === "") return meta;
    throw Error("synthetic STATE CONTENT");
  }},id),"AUTH_PRIVATE_STATE_BRANCH_ACCESS");
  assert.ok(calls.every(v => v === "token" || v === "" || v.startsWith("contents/")));
});

test("OAuth GitHub App token diagnosis accepts escaped PEM and distinguishes failures", async () => {
  const { generateKeyPairSync } = require("node:crypto");
  const { normalizedAppPrivateKey, classifyTokenError, diagnoseAuthStorage } =
    await import("../scripts/admin/serverless/worker.mjs");
  const { privateKey } = generateKeyPairSync("rsa",{modulusLength:2048});
  const pem = privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const escaped = pem.replaceAll("\n","\\n");
  assert.equal(normalizedAppPrivateKey(escaped), pem.trim());
  for (const key of [pem, escaped]) {
    assert.equal(classifyTokenError({privateKey:key,httpStatus:401}),"AUTH_GITHUB_APP_HTTP_401");
    assert.equal(classifyTokenError({privateKey:key,httpStatus:403}),"AUTH_GITHUB_APP_HTTP_403");
    assert.equal(classifyTokenError({privateKey:key,httpStatus:404}),"AUTH_GITHUB_APP_HTTP_404");
    assert.equal(classifyTokenError({privateKey:key,httpStatus:422}),"AUTH_GITHUB_APP_HTTP_422");
    assert.equal(classifyTokenError({privateKey:key,httpStatus:502}),"AUTH_GITHUB_APP_HTTP_OTHER");
    assert.equal(classifyTokenError({privateKey:key,networkFailure:true}),"AUTH_GITHUB_NETWORK");
  }
  assert.equal(classifyTokenError({privateKey:"not a pem",httpStatus:401}),
    "AUTH_GITHUB_APP_KEY_INVALID");
  assert.equal(await diagnoseAuthStorage({
    token:async()=>{throw Error("synthetic upstream authorization failed");},
  },"1456606620",{tokenFailure:()=>classifyTokenError({privateKey:pem,httpStatus:403})}),
    "AUTH_GITHUB_APP_HTTP_403");
});

test("Cloudflare GitHub fetch never uses unsupported redirect:error or follows credentials on redirect", async () => {
  const { cloudflareGithubFetch } = await import("../scripts/admin/serverless/worker.mjs");
  const observed = [];
  const fakeFetch = async (url, options) => {
    observed.push({url:String(url), method:options.method || "GET", redirect:options.redirect, authorization:options.headers?.Authorization});
    assert.equal(options.redirect,"manual");
    return new Response(null,{status:302,headers:{"Location":"https://untrusted.invalid/collect"}});
  };
  const response = await cloudflareGithubFetch(
    "https://api.github.com/app/installations/183290892/access_tokens",
    {method:"POST",redirect:"error",headers:{Authorization:"Bearer synthetic-token"}},
    fakeFetch,
  );
  assert.equal(response.status,302);
  assert.equal(response.ok,false);
  assert.equal(observed.length,1,"no credential-bearing redirect is followed");
  assert.equal(observed[0].authorization,"Bearer synthetic-token");
  assert.equal(observed[0].redirect,"manual");
});

test("all Worker GitHub API and OAuth paths inject Cloudflare manual redirect adapter", async () => {
  const source = await fs.readFile(path.resolve(__dirname,"../scripts/admin/serverless/worker.mjs"),"utf8");
  assert.match(source,/const response = await cloudflareGithubFetch\(url, options\)/);
  assert.match(source,/permissions: \{ actions: "write" \},\s*fetchImpl: cloudflareGithubFetch/);
  assert.match(source,/permissions: \{ contents: "read" \},\s*fetchImpl: cloudflareGithubFetch/);
  assert.match(source,/store: stores\.auth,\s*fetchImpl: cloudflareGithubFetch/);
  assert.doesNotMatch(source,/fetch\(url, options\);/);
});

test('real Worker accepts a signed private OIDC lease in Cloudflare fetch mode, while rejecting redirects and wrong claims', async t=>{
  const {generateKeyPairSync,randomBytes,sign}=require('node:crypto');
  const {seal,unseal,sha}=require('../scripts/admin/serverless/github-store.cjs');
  const keys=generateKeyPairSync('rsa',{modulusLength:2048}),kid='synthetic-oidc';
  const key=randomBytes(32),now=Math.floor(Date.now()/1000),taskId='a'.repeat(24);
  const env={API_ORIGIN:'https://worker.example.test',PORTAL_URL:'https://worker.example.test/admin/',
    OWNER_USER_ID:'11111111-1111-4111-8111-111111111111',OWNER_GITHUB_ID:'123',
    OAUTH_CLIENT_ID:'synthetic-client',OAUTH_CLIENT_SECRET:'synthetic-secret',
    GITHUB_APP_ID:'123',GITHUB_INSTALLATION_ID:'456',
    GITHUB_APP_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}).toString(),
    STORAGE_KEY:key.toString('hex'),PRIVATE_REPOSITORY:'synthetic-org/private-state',PRIVATE_REPOSITORY_ID:'789',
    PRIVATE_WORKFLOW_SHA:'b'.repeat(40),PROCESSOR_CODE_SHA:'c'.repeat(40),DISPATCH_ACTOR_ID:'456',
    AUTH_LIMITER:{limit:async()=>({success:true})},API_LIMITER:{limit:async()=>({success:true})}};
  const claims={iss:'https://token.actions.githubusercontent.com',aud:env.API_ORIGIN+'/processor',
    iat:now,nbf:now,exp:now+300,repository:env.PRIVATE_REPOSITORY,repository_id:env.PRIVATE_REPOSITORY_ID,
    repository_visibility:'private',ref:'refs/heads/main',event_name:'workflow_dispatch',runner_environment:'github-hosted',
    actor_id:env.DISPATCH_ACTOR_ID,workflow_sha:env.PRIVATE_WORKFLOW_SHA,
    workflow_ref:env.PRIVATE_REPOSITORY+'/.github/workflows/morothon-result-job.yml@refs/heads/main',run_id:'1122'};
  const jwt=(changes={})=>{
    const body=[{alg:'RS256',kid},{...claims,...changes}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
    return body+'.'+sign('RSA-SHA256',Buffer.from(body),keys.privateKey).toString('base64url');
  };
  const task={id:taskId,revision:1,state:'queued',action:'identity-batch',nonce:'n'.repeat(43),
    actor:env.OWNER_USER_ID,ownerGithubId:env.OWNER_GITHUB_ID,codeSha:env.PROCESSOR_CODE_SHA,
    workflowSha:env.PRIVATE_WORKFLOW_SHA,createdAt:new Date().toISOString()};
  const filename='.morothon-state/control/task-'+taskId+'.aesgcm';
  let bytes=seal(key,filename,task),redirectKeys=false,branchConflicts=0,tokenFailureStatus=null,badTokenScope=null;
  const calls=[],publicPermissions=[];
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    // Workers reject redirect:error before network I/O. Node's normal fetch
    // and broker-only fixtures do not reproduce this production restriction.
    calls.push({url:String(url),method:options.method||'GET',redirect:options.redirect});
    if(options.redirect==='error')throw new TypeError('Unsupported redirect mode');
    assert.equal(options.redirect,'manual');
    if(String(url)==='https://token.actions.githubusercontent.com/.well-known/jwks'){
      assert.equal(new Headers(options.headers).has('authorization'),false,'Public signing keys do not receive a private credential');
      if(redirectKeys)return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/keys'}});
      return Response.json({keys:[{...keys.publicKey.export({format:'jwk'}),kid,use:'sig'}]});
    }
    const u=new URL(url),base='/repos/'+env.PRIVATE_REPOSITORY;
    if(u.hostname!=='api.github.com')throw Error('Unexpected synthetic host');
    if(u.pathname==='/app/installations/456/access_tokens'){
      const input=JSON.parse(options.body),scope=input.repositories[0]==='historikk'?'public':'private';
      if(scope==='public'){
        publicPermissions.push(input.permissions);
        // GitHub's server-to-server permission identifier is actions_variables.
        // Echoing an arbitrary request here previously hid the invalid key.
        if(Object.keys(input.permissions).some(k=>!['contents','actions','checks','administration','actions_variables','pull_requests'].includes(k)))
          return Response.json({message:'Synthetic unsupported permission name'},{status:422});
      }
      if(tokenFailureStatus&&scope==='public')
        return Response.json({message:'Synthetic provider details must not be logged'},{status:tokenFailureStatus});
      return Response.json({token:'synthetic-installation',permissions:badTokenScope===scope?{contents:'read'}:
        badTokenScope==='legacy-public'&&scope==='public'?{...input.permissions,actions_variables:undefined,variables:input.permissions.actions_variables}:
        badTokenScope==='broad-public'&&scope==='public'?{...input.permissions,metadata:'read',contents:'write'}:{...input.permissions,metadata:'read'},
        expires_at:new Date(Date.now()+3600000).toISOString()});
    }
    if(u.pathname===base)return Response.json({private:true,full_name:env.PRIVATE_REPOSITORY,id:789,default_branch:'main'});
    if(u.pathname===base+'/contents/'+filename){
      if(options.method==='PUT'){
        const input=JSON.parse(options.body);assert.equal(input.branch,'admin-state');assert.equal(input.sha,sha(bytes).slice(0,40));
        if(branchConflicts-- > 0)return Response.json({message:'Synthetic branch-head conflict'},{status:409});
        bytes=Buffer.from(input.content,'base64');return Response.json({});
      }
      assert.equal(u.searchParams.get('ref'),'admin-state');
      return Response.json({type:'file',encoding:'base64',sha:sha(bytes).slice(0,40),size:bytes.length,content:bytes.toString('base64')});
    }
    throw Error('Unexpected synthetic API route');
  });
  const {default:worker}=await import('../scripts/admin/serverless/worker.mjs?synthetic-oidc-lease');
  const lease=(proof,nonce=task.nonce)=>worker.fetch(new Request(env.API_ORIGIN+'/processor/lease',{
    method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+proof},body:JSON.stringify({task:taskId,nonce})}),env);
  const valid=await lease(jwt());
  assert.equal(valid.status,200,'A correctly signed private job must reach the real encrypted task gate: '+JSON.stringify({response:await valid.clone().json(),calls}));
  const issued=await valid.json();assert.equal(issued.task.runId,'1122');assert.equal(issued.codeSha,env.PROCESSOR_CODE_SHA);
  assert.deepEqual(publicPermissions.at(-1),{contents:'read',actions:'read',checks:'read',administration:'read',actions_variables:'read'});
  assert.equal(unseal(key,filename,bytes).state,'running');
  assert.ok(calls.every(c=>c.redirect==='manual'));
  for(const action of ['identity-decide','identity-batch','identity-approve','identity-revalidate','identity-check']){
    bytes=seal(key,filename,{...task,action,scope:'person-control-v1'});
    assert.equal((await lease(jwt())).status,200);
    assert.deepEqual(publicPermissions.at(-1),{contents:'read',actions:'read'},'Private identity decisions cannot receive publication-control or write permissions');
  }
  for(const action of ['publish','continue']){
    bytes=seal(key,filename,{...task,action});
    assert.equal((await lease(jwt())).status,200);
    assert.deepEqual(publicPermissions.at(-1),{contents:'write',pull_requests:'write',actions_variables:'write',actions:'write',checks:'read',administration:'read'});
  }
  const before=Buffer.from(bytes),writes=calls.filter(c=>c.method==='PUT').length;
  for(const changed of [{workflow_sha:'d'.repeat(40)},{actor_id:'999'},{repository_id:'000'},{aud:'https://other.example.test'}])
    assert.equal((await lease(jwt(changed))).status,403);
  const signed=jwt();assert.equal((await lease(signed.slice(0,-8)+'AAAAAAAA')).status,403);
  assert.equal((await lease(jwt(),'wrong-nonce')).status,403);
  assert.equal(calls.filter(c=>c.method==='PUT').length,writes);assert.ok(bytes.equals(before));
  // A confirmed Contents-API conflict with an unchanged encrypted task must
  // not abort an otherwise valid job at worker-lease before any decision runs.
  bytes=seal(key,filename,task);branchConflicts=1;
  const recovered=await lease(jwt());
  assert.equal(recovered.status,200,'The same source/owner/nonce-bound lease must survive an unrelated branch conflict');
  assert.equal(unseal(key,filename,bytes).runId,'1122');
  bytes=seal(key,filename,task);branchConflicts=99;
  const exhausted=await lease(jwt());assert.equal(exhausted.status,409);
  assert.deepEqual(await exhausted.json(),{error:'Arbeidet er endret. Hent siste versjon.',diagnostic:'LEASE_TASK_CLAIM',githubStatus:409,githubOperation:'GITHUB_STATE_WRITE'});
  assert.equal(unseal(key,filename,bytes).state,'queued');
  bytes=seal(key,filename,task);branchConflicts=0;tokenFailureStatus=422;
  const rejectedToken=await lease(jwt());assert.equal(rejectedToken.status,409);
  assert.deepEqual(await rejectedToken.json(),{error:'Arbeidet er endret. Hent siste versjon.',diagnostic:'LEASE_PUBLIC_TOKEN',githubStatus:422,githubOperation:'GITHUB_INSTALLATION_TOKEN'},
    'The normalized 409 must not hide an installation-token permission refusal');
  assert.equal(unseal(key,filename,bytes).state,'running','A token refusal can occur after claim, before a decision is processed');
  tokenFailureStatus=null;
  for(const scope of ['private','public','broad-public','legacy-public']){
    bytes=seal(key,filename,task);badTokenScope=scope;
    const insufficient=await lease(jwt());assert.equal(insufficient.status,502);
    assert.deepEqual(await insufficient.json(),{error:'Tjenesten kunne ikke fullføre kontrollen. Lagret arbeid er bevart.',
      diagnostic:scope==='private'?'LEASE_PRIVATE_TOKEN':'LEASE_PUBLIC_TOKEN',reasonCode:'TOKEN_PERMISSIONS'});
  }
  const forged=await lease(jwt({actor_id:'999'}));assert.equal(forged.status,403);
  assert.equal(Object.hasOwn(await forged.json(),'diagnostic'),false,'Unverified OIDC must not obtain private checkpoint diagnostics');
  redirectKeys=true;calls.length=0;
  const {default:fresh}=await import('../scripts/admin/serverless/worker.mjs?synthetic-oidc-redirect');
  const denied=await fresh.fetch(new Request(env.API_ORIGIN+'/processor/lease',{
    method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+jwt()},body:JSON.stringify({task:taskId,nonce:task.nonce})}),env);
  assert.equal(denied.status,403);assert.equal(calls.length,1,'A redirected JWKS must never be followed or grant a lease');
});

test("publication access probe only runs for authenticated owner GETs", async () => {
  let calls = 0, allowed = true;
  const f = fixture({
    rateLimit: async () => allowed,
    publicationAccess: async () => {
      calls++;
      return { stage: "ruleset-details", classicStatus: 404, bypassActors: "hidden" };
    },
  });
  const route = "/admin/_publication-access";
  assert.equal((await f.gate(f.req(route))).status, 401);
  assert.equal((await f.gate(f.req(route, {method: "HEAD", cookie: TOKEN}))).status, 404);
  assert.equal((await f.gate(f.req(route, {method: "POST", cookie: TOKEN, headers: {origin}}))).status, 404);
  assert.equal((await f.gate(f.req(route, {cookie: "y".repeat(43)}))).status, 401);
  allowed = false;
  assert.equal((await f.gate(f.req(route, {cookie: TOKEN}))).status, 429);
  assert.equal(calls, 0);
  allowed = true;
  const result = await f.gate(f.req(route, {cookie: TOKEN}));
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await result.json(), {stage: "ruleset-details", classicStatus: 404, bypassActors: "hidden"});
  assert.equal(calls, 1);
  assert.equal(f.reads(), 0);
});

test("publication access probe reports field visibility without exposing GitHub details", async () => {
  const {probePublicationAccess} = await import("../scripts/admin/serverless/worker.mjs");
  const repository = "morothon-no/historikk", requests = [];
  const api = {
    repository,
    token: async () => "private-token",
    request: async (route, options) => {
      requests.push(route);
      assert.equal(options, undefined);
      if (route === "branches/main/protection") throw Object.assign(Error("private response"), {githubStatus: 403});
      if (route === "rules/branches/main?per_page=100") return [{
        type: "required_status_checks", ruleset_id: 42,
        ruleset_source: repository, ruleset_source_type: "Repository",
      }];
      assert.equal(route, "rulesets/42");
      return {name: "private rule"};
    },
  };
  assert.deepEqual(await probePublicationAccess(api), {stage: "ruleset-details", classicStatus: 403, bypassActors: "hidden"});
  assert.deepEqual(requests, ["branches/main/protection", "rules/branches/main?per_page=100", "rulesets/42"]);
  assert.deepEqual(await probePublicationAccess({...api, request: async () => ({private: true})}),
    {stage: "classic-protection", classicStatus: 200});
});
