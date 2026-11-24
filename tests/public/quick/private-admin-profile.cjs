"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const root=path.resolve(__dirname,"../../..");
test("profile is private: both browser editors use /admin/ while the local pilot uses loopback",async()=>{
  const [intake,design,local,runtime,webTransport]=await Promise.all([
    "tools/diploma-admin/intake.js",
    "tools/diploma-admin/design-studio.js",
    "scripts/diploma-admin.cjs",
    "scripts/lib/runtime-files.cjs",
    "web-admin/web-transport.js",
  ].map(f=>fs.readFile(path.join(root,f),"utf8")));
  // Keep the separate public-data root for results; the active event profile
  // comes from the authenticated admin origin rather than public GitHub Pages.
  for(const text of [intake,design]){
    assert.match(text,/new URL\('event-profile\.json',new URL\('\.\/',document\.baseURI\)\)/);
    assert.match(text,/window\.MorothonAdminTransport/);
  }
  assert.match(local,/route === '\/site\/admin\/event-profile\.json'/);
  assert.match(local,/root, 'web-admin\/event-profile\.json'/);
  // Result calculations no longer resolve the admin adapter through the
  // public build-info assets map, which must exclude every admin URL.
  assert.match(intake,/const protectedAdapter=window\.MorothonAdminTransport/);
  assert.match(intake,/new URL\('diploma-adapter\.js',new URL\('\.\/',document\.baseURI\)\)/);
  assert.match(local,/route === '\/diploma-adapter\.js'/);
  assert.match(local,/path\.join\(uiRoot, 'engine\.js'\)/);

  const runtimeSource=require(path.join(root,"scripts/lib/runtime-files.cjs"));
  const list=runtimeSource.runtimeFiles({
    watermark:{src:"assets/medals/watermarks/example.png"},badges:[]
  });
  assert.equal(list.some(f=>f.startsWith("admin/")),false);
  // A client whose cookie/bearer session expired must not keep showing the
  // privileged workspace while rendering an unauthenticated error.
  assert.match(webTransport,/if \(protectedPortal\) \{\s*reloadAdminEntry\(\)/);
  assert.match(webTransport,/if \(!response\.ok\) \{ reloadAdminEntry\(\); return; \}/);
  assert.match(webTransport,/function reloadAdminEntry\(\)\{\s*const destination=location\.hash==="#personkontroll"\?"\/admin\/#personkontroll":"\/admin\/";\s*history\.replaceState\(null,"",destination\);\s*location\.reload\(\);/);
  assert.match(webTransport,/if \(!response\.ok\)\s+throw Error\("Utlogging kunne ikke bekreftes\. Prøv igjen\."\)/);
});
