"use strict";
// Assemble the legacy Node admin only within the authenticated Node server.
// Never add these assets to buildSite(), public Pages, or publication packages.
const fs = require("node:fs/promises");
const path = require("node:path");
const {ADMIN_SOURCES} = require("../lib/runtime-files.cjs");
async function loadPrivatePortalAssets({root=path.resolve(__dirname,"../..")}={}) {
  const assets = new Map();
  for (const [name, source] of Object.entries(ADMIN_SOURCES)) {
    let bytes = await fs.readFile(path.join(root,source));
    if (name === "admin/index.html") {
      let html = bytes.toString("utf8")
        .replace(/<meta name="local-session"[^>]*>/, "")
        .replace('<body class="portal-app">','<body class="portal-app" data-admin-mode="public-preview">')
        .replace('sandbox="allow-same-origin"','sandbox="allow-same-origin allow-modals"')
        .replaceAll("/site/assets/","../assets/");
      for (const file of ["admin.css","admin.js","portal.js",
        "design-model.js","design-studio.js","design-studio.css",
        "intake-model.js","intake.js","intake.css"])
        html=html.replaceAll("/"+file,"./"+file);
      const scripts=["../js/history-data.js","portal-data.js",
        "profile-contract.js","web-transport.js"]
        .map(file=>'<script defer src="'+file+'"></script>').join("");
      html=html.replace('<script defer src="./admin.js',scripts+'<script defer src="./admin.js');
      if (!html.includes('data-admin-mode="public-preview"') ||
          !html.includes('src="web-transport.js"'))
        throw Error("Private Node admin bundle invalid");
      bytes=Buffer.from(html);
    }
    assets.set(name,bytes);
  }
  if(assets.size!==Object.keys(ADMIN_SOURCES).length)
    throw Error("Private Node admin inventory mismatch");
  return assets;
}
module.exports={loadPrivatePortalAssets};
