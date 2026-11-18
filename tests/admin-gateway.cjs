"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAdminGateway } = require("../scripts/admin/serverless/admin-gateway.cjs");
const origin = "https://historikk.morothon.no";
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
  const gate = createAdminGateway({portalOrigin:origin,auth,assetSource:async name => {
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
  for(const p of ["/admin/_session","/admin/%2e%2e/admin.js","/admin/a%2fb.js","/admin/noextension","/admin/foo.map"]) {
    assert.equal((await f.gate(f.req(p,{cookie:TOKEN}))).status,404,p);
  }
  assert.equal(f.reads(),0);
});
