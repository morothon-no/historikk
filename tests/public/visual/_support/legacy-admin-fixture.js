// Synthetic browser fixture for the old read-only portal UI.
// It is deliberately NOT part of buildSite() or its public deployment artifact.
// Static tests can inspect the legacy interface without publishing admin bytes.
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { ADMIN_SOURCES } = require("../../../../scripts/lib/runtime-files.cjs");
const root = path.resolve(__dirname, "../../../..");
async function legacyAdminFixture(site, target) {
  const targetDir = path.resolve(target);
  await fs.mkdir(path.join(targetDir, "admin"), { recursive:true });
  const { version } = JSON.parse(await fs.readFile(
    path.join(site.out,"build-info.json"),"utf8"));
  const files = new Set(Object.keys(ADMIN_SOURCES));
  const urlFor = file => "./" + file + "?v=" + version;
  for (const [file, source] of Object.entries(ADMIN_SOURCES)) {
    let data = await fs.readFile(path.join(root,source));
    if (file === "admin/index.html") {
      let html = data.toString("utf8");
      html = html.replace(/<meta name="local-session"[^>]*>/,"")
        .replace('<body class="portal-app">',
          '<body class="portal-app" data-admin-mode="public-preview">')
        .replace('sandbox="allow-same-origin"',
          'sandbox="allow-same-origin allow-modals"')
        .replaceAll("/site/assets/","../assets/")
        .replace("Utviklingsversjon · lokal tilgang",
          "Offentlig testversjon · ingen innlogging")
        .replace("Lokalt arbeidsrom","Offentlig testversjon")
        .replace("Utviklingsversjon.<br>Ingen innlogging eller produksjonsdrift.",
          "Offentlig tilgjengelig test.<br>Kun godkjente offentlige data.")
        .replace("Kun lokal utvikling. Jobblisten lagres i nettleserøkten.",
          "Offentlig testversjon · ingen innlogging eller administrative skrivefunksjoner.");
      for (const f of ["admin.css","admin.js","portal.js",
        "design-model.js","design-studio.js","design-studio.css",
        "intake-model.js","intake.js","intake.css"])
        html = html.replaceAll("/"+f,urlFor(f));
      const extra = ["../js/history-data.js","portal-data.js",
        "profile-contract.js","web-transport.js"].map(f=>
          '<script defer src="'+f+'?v='+version+'"></script>').join("");
      html = html.replace('<script defer src="./admin.js',
        extra+'<script defer src="./admin.js');
      data = Buffer.from(html);
    }
    await fs.writeFile(path.join(targetDir,file),data);
  }
  return {
    files,
    out: targetDir,
    filePath: name => path.join(
      files.has(name) ? targetDir : site.out, name),
  };
}
module.exports = { legacyAdminFixture };
