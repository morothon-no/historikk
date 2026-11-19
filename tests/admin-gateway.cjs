"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAdminGateway } = require("../scripts/admin/serverless/admin-gateway.cjs");
const { buildProtectedAdmin } = require("../scripts/build-protected-admin.cjs");
const { ADMIN_SOURCES, PUBLIC_CODE, runtimeFiles } = require("../scripts/lib/runtime-files.cjs");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const origin = "https://morothon-admin.damofra75.workers.dev";
const TOKEN = "x".repeat(43);
function fixture() {
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
  const gate = createAdminGateway({portalOrigin:origin,apiOrigin:"https://morothon-admin.example.test",auth,assetSource:async name => {
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
