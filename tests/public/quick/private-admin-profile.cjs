"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const root=path.resolve(__dirname,"../../..");
test("profile is private: both browser editors use /admin/ while the local pilot uses loopback",async()=>{
  const [intake,design,local,runtime]=await Promise.all([
    "tools/diploma-admin/intake.js",
    "tools/diploma-admin/design-studio.js",
    "scripts/diploma-admin.cjs",
    "scripts/lib/runtime-files.cjs",
  ].map(f=>fs.readFile(path.join(root,f),"utf8")));
  // Keep the separate public-data root for results; the active event profile
  // comes from the authenticated admin origin rather than public GitHub Pages.
  for(const text of [intake,design]){
    assert.match(text,/new URL\('event-profile\.json',new URL\('\.\/',document\.baseURI\)\)/);
    assert.match(text,/window\.MorothonAdminTransport/);
  }
  assert.match(local,/route === '\/site\/admin\/event-profile\.json'/);
  assert.match(local,/root, 'web-admin\/event-profile\.json'/);
  const runtimeSource=require(path.join(root,"scripts/lib/runtime-files.cjs"));
  const list=runtimeSource.runtimeFiles({
    watermark:{src:"assets/medals/watermarks/example.png"},badges:[]
  });
  assert.equal(list.some(f=>f.startsWith("admin/")),false);
});
