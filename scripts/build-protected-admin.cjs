"use strict";
// Build Cloudflare Worker-bound admin assets from explicitly approved source
// filenames. This bundle must never be uploaded to public GitHub Pages.
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { ADMIN_SOURCES } = require("./lib/runtime-files.cjs");
const DEST = path.join(root, ".worker-admin-assets");
const API = "https://morothon-admin.damofra75.workers.dev";
async function buildProtectedAdmin(out = DEST) {
  out = path.resolve(out);
  if (out === root || root.startsWith(out + path.sep))
    throw Error("Unsafe protected output directory");
  await fs.mkdir(out, { recursive: true });
  if ((await fs.readdir(out)).length)
    throw Error("Protected admin output must be empty");
  for (const [filename, source] of Object.entries(ADMIN_SOURCES)) {
    if (!/^admin\/[a-z0-9.-]+$/.test(filename))
      throw Error("Unexpected protected asset name");
    let bytes = await fs.readFile(path.join(root, source));
    if (filename === "admin/index.html") {
      let html = bytes.toString("utf8");
      html = html.replace(/<meta name="local-session"[^>]*>/, "")
        .replace('<body class="portal-app">', '<body class="portal-app" data-admin-mode="protected">')
        .replace('sandbox="allow-same-origin"', 'sandbox="allow-same-origin allow-modals"')
        .replaceAll("/site/assets/", "/site/assets/")
        .replace('<meta name="morothon-admin-service" content="">',
          '<meta name="morothon-admin-service" content="' + API + '">');
      for (const file of ["admin.css","admin.js","portal.js",
         "design-model.js","design-studio.js","design-studio.css",
         "intake-model.js","intake.js","intake.css"])
        html = html.replaceAll("/" + file, "./" + file);
      const scripts = ["../js/history-data.js","portal-data.js",
        "profile-contract.js","web-transport.js"].map(f =>
          '<script defer src="' + f + '"></script>').join("");
      html = html.replace('<script defer src="./admin.js', scripts + '<script defer src="./admin.js');
      if (!html.includes('data-admin-mode="protected"') ||
          !html.includes('name="morothon-admin-service" content="' + API + '"') ||
          !html.includes('src="web-transport.js"'))
        throw Error("Protected admin HTML rewrite failed");
      bytes = Buffer.from(html);
    }
    const output = path.join(out, filename);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, bytes);
  }
  // Fail if the bundle accidentally includes any confidential dataset.
  const names = (await fs.readdir(path.join(out, "admin"))).sort();
  if (names.length !== Object.keys(ADMIN_SOURCES).length)
    throw Error("Protected asset inventory mismatch");
  return { directory: out, count: names.length, filenames: names };
}
module.exports = { buildProtectedAdmin };
if (require.main === module)
  buildProtectedAdmin(process.argv[2]).then(r =>
    console.log(JSON.stringify({count:r.count}))).catch(e => {
      console.error(e.message);
      process.exitCode = 1;
    });
