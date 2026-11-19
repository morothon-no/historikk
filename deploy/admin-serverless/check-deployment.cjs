"use strict";
// Deployment-only guard. Never reads a secret value, original register or private checkout.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const ACCOUNT = "7abd3bf4d65ed1b4395258ef99938ee5",
  WORKER = "morothon-admin";
const SECRETS = [
  "OAUTH_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "STORAGE_KEY",
];
const CORE = [
  "scripts/admin/serverless",
  "scripts/admin/account-directory.cjs",
  "scripts/admin/access-control.cjs",
  "tools/diploma-admin/intake-model.js",
  "js/history-data.js",
];
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function requireThat(ok, message) {
  if (!ok) throw Error(message);
}
function validateConfig(c) {
  const keys = [
    "name",
    "account_id",
    "main",
    "compatibility_date",
    "compatibility_flags",
    "workers_dev",
    "routes",
    "preview_urls",
    "observability",
    "keep_vars",
    "assets",
    "secrets",
    "ratelimits",
    "vars",
  ];
  requireThat(
    same(Object.keys(c).sort(), keys.sort()),
    "Ukjente eller manglende konfigurasjonsfelt.",
  );
  requireThat(
    c.name === WORKER && c.account_id === ACCOUNT,
    "Feil eksisterende Worker eller konto.",
  );
  requireThat(
    c.main === "../../scripts/admin/serverless/worker.mjs",
    "Bruk eksisterende Worker med korrekt relativ sti.",
  );
  requireThat(
    c.compatibility_date === "2026-11-18" &&
      same(c.compatibility_flags, ["nodejs_compat"]),
    "Kompatibilitetsoppsett er endret; ny gjennomgang kreves.",
  );
  requireThat(
    c.workers_dev === true &&
      c.preview_urls === false &&
      same(c.observability, { enabled: false }) &&
      c.keep_vars === false,
    "Uventet eksponering eller konfigurasjonsoverstyring.",
  );
  requireThat(
    same(c.routes, []),
    "Separat workers.dev-admin skal ikke overta det offentlige domenet.",
  );
  requireThat(
    same(c.assets, {
      directory: "../../.worker-admin-assets",
      binding: "ADMIN_ASSETS",
      run_worker_first: true,
    }),
    "Adminressurser må leveres fra Worker før offentlig asset-handler.",
  );
  requireThat(
    same(c.secrets, { required: SECRETS }),
    "Secrets skal bare navngis som påkrevde, aldri inneholde verdier.",
  );
  requireThat(
    same(c.ratelimits, [
      {
        name: "AUTH_LIMITER",
        namespace_id: "1001",
        simple: { limit: 5, period: 60 },
      },
      {
        name: "API_LIMITER",
        namespace_id: "1002",
        simple: { limit: 60, period: 60 },
      },
    ]),
    "Feil limiter, terskel eller namespace-ID.",
  );
  const expected = [
    "API_ORIGIN",
    "PORTAL_URL",
    "OWNER_USER_ID",
    "OWNER_GITHUB_ID",
    "OAUTH_CLIENT_ID",
    "GITHUB_APP_ID",
    "GITHUB_INSTALLATION_ID",
    "PRIVATE_REPOSITORY",
    "PRIVATE_REPOSITORY_ID",
    "PRIVATE_WORKFLOW_SHA",
    "PROCESSOR_CODE_SHA",
    "DISPATCH_ACTOR_ID",
  ];
  requireThat(
    same(Object.keys(c.vars).sort(), expected.sort()) &&
      Object.values(c.vars).every((v) => typeof v === "string"),
    "Bare eksplisitte, ikke-hemmelige runtime-variabler er tillatt.",
  );
  const v = c.vars;
  requireThat(
    v.API_ORIGIN === "https://morothon-admin.damofra75.workers.dev" &&
      v.PORTAL_URL === "https://morothon-admin.damofra75.workers.dev/admin/",
    "Feil bekreftet adresse.",
  );
  requireThat(
    UUID.test(v.OWNER_USER_ID),
    "Intern eier-ID må være en stabil UUID v4.",
  );
  for (const k of [
    "OWNER_GITHUB_ID",
    "GITHUB_APP_ID",
    "GITHUB_INSTALLATION_ID",
    "PRIVATE_REPOSITORY_ID",
    "DISPATCH_ACTOR_ID",
  ])
    requireThat(
      /^[1-9][0-9]*$/.test(v[k]),
      "Ugyldig numerisk identitetsbinding.",
    );
  requireThat(
    v.PRIVATE_REPOSITORY === "morothon-no/historikk-admin",
    "Feil privat jobb-repository.",
  );
  requireThat(
    /^[a-f0-9]{40}$/.test(v.PROCESSOR_CODE_SHA) &&
      /^[a-f0-9]{40}$/.test(v.PRIVATE_WORKFLOW_SHA),
    "Eksakte, gjennomgåtte kodeversjoner kreves.",
  );
  requireThat(
    /^Ov23[a-zA-Z0-9]+$/.test(v.OAUTH_CLIENT_ID),
    "GitHub OAuth App client-ID må kontrolleres.",
  );
  return c;
}
async function readConfig() {
  const text = await fs.readFile(
    path.join(__dirname, "wrangler.jsonc"),
    "utf8",
  );
  return validateConfig(JSON.parse(text.replace(/^\/\/[^\n]*\n/, "")));
}
function verifySource(
  c,
  {
    git = (args) =>
      execFileSync("git", args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
  } = {},
) {
  const sha = c.vars.PROCESSOR_CODE_SHA;
  requireThat(
    git(["cat-file", "-t", sha]).trim() === "commit",
    "Prosessorkoden finnes ikke som verifiserbar Git-commit.",
  );
  git(["merge-base", "--is-ancestor", sha, "HEAD"]);
  // The private processor remains pinned to its reviewed commit. Worker-only
  // document routing and asset authentication can change independently,
  // but broker/auth/processor dependencies MUST still match the pinned SHA.
  const gatewayOnly = new Set([
    "scripts/admin/serverless/worker.mjs",
    "scripts/admin/serverless/admin-gateway.cjs",
    "scripts/admin/serverless/public-runtime-proxy.cjs",
  ]);
  const differences = git(["diff", sha, "--name-only", "--", ...CORE])
    .trim().split("\n").filter(Boolean);
  requireThat(
    differences.every(file => gatewayOnly.has(file)),
    "Prosessor- eller autentiseringsavhengigheter avviker; oppdater privat jobb-pin før deploy.",
  );
  return { processorCodeSha: sha, workerSourceMatches: true };
}
function validateDispatch(c, env) {
  requireThat(
    env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      env.GITHUB_REF === "refs/heads/main" &&
      env.GITHUB_REPOSITORY === "morothon-no/historikk",
    "Utrulling er kun tillatt manuelt fra main i riktig repository.",
  );
  requireThat(
    env.CLOUDFLARE_ACCOUNT_ID === c.account_id,
    "Repository-variabelen peker på feil Cloudflare-konto.",
  );
  requireThat(
    env.CONFIRM_WORKER === c.name,
    "Bekreft eksisterende Worker-navn.",
  );
  requireThat(
    env.VERIFIED_OAUTH_CLIENT_ID === c.vars.OAUTH_CLIENT_ID,
    "OAuth App client-ID/callback må verifiseres av operatøren.",
  );
  requireThat(
    env.VERIFIED_PRIVATE_WORKFLOW_SHA === c.vars.PRIVATE_WORKFLOW_SHA,
    "Privat main/workflow og prosessorkode må verifiseres på nytt.",
  );
  requireThat(
    env.BINDINGS_REVIEWED === "true",
    "Secrets, alle bindings og namespace-ID-er må gjennomgås før utrulling.",
  );
  requireThat(
    UUID.test(env.ROLLBACK_VERSION_ID || ""),
    "En eksisterende Cloudflare-versjon for tilbakeføring kreves.",
  );
}
function checkMetadata(c, settings, deployments, rollback) {
  requireThat(
    Array.isArray(settings?.bindings),
    "Eksisterende Worker-metadata kunne ikke kontrolleres.",
  );
  const bindings = settings.bindings,
    names = new Set();
  for (const b of bindings) {
    requireThat(
      typeof b.name === "string" && !names.has(b.name),
      "Duplisert eller ugyldig binding.",
    );
    names.add(b.name);
    if (SECRETS.includes(b.name)) {
      requireThat(
        b.type === "secret_text",
        "Påkrevd secret har feil bindingstype.",
      );
      continue;
    }
    if (b.name === "ADMIN_ASSETS") {
      requireThat(b.type === "assets",
        "Eksisterende admin-asset binding har feil type.");
      continue;
    }
    const limiter = c.ratelimits.find((r) => r.name === b.name);
    if (limiter) {
      requireThat(
        b.type === "ratelimit" &&
          String(b.namespace_id) === limiter.namespace_id &&
          b.simple?.limit === limiter.simple.limit &&
          b.simple?.period === limiter.simple.period,
        "Eksisterende limiter avviker. Stopp; ikke overskriv tellere uten gjennomgang.",
      );
      continue;
    }
    requireThat(
      Object.hasOwn(c.vars, b.name) && b.type === "plain_text",
      "Ukjent binding kan bli fjernet av Wrangler. Stopp og avklar.",
    );
  }
  requireThat(
    SECRETS.every((s) => names.has(s)),
    "En av de tre eksisterende secrets mangler. Ingen ny Worker eller nøkkel opprettes.",
  );
  const current = deployments?.deployments?.[0]?.versions;
  requireThat(
    Array.isArray(current) &&
      current.length === 1 &&
      current[0].percentage === 100 &&
      current[0].version_id === rollback,
    "Tilbakeføringsversjonen er ikke gjeldende 100 %-versjon. Stopp ved gradvis utrulling eller endret versjon.",
  );
  return {
    worker: c.name,
    requiredSecretNamesPresent: true,
    unknownBindings: false,
    rollbackVersion: rollback,
  };
}
async function remotePreflight(c, env, { fetchImpl = fetch } = {}) {
  validateDispatch(c, env);
  requireThat(!!env.CLOUDFLARE_API_TOKEN, "Eksisterende deploy-token mangler.");
  async function get(suffix) {
    const r = await fetchImpl(
      "https://api.cloudflare.com/client/v4/accounts/" +
        c.account_id +
        "/workers/scripts/" +
        c.name +
        suffix,
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: "Bearer " + env.CLOUDFLARE_API_TOKEN },
      },
    );
    requireThat(
      r.ok,
      "Eksisterende Cloudflare-metadata kunne ikke verifiseres. Ingen deploy.",
    );
    const data = await r.json();
    requireThat(
      data.success === true,
      "Cloudflare avviste metadatakontrollen. Ingen deploy.",
    );
    return data.result;
  }
  // Settings returns secret names/types, never values. No content/secret-read endpoint.
  const settings = await get("/settings"),
    deployments = await get("/deployments");
  return checkMetadata(c, settings, deployments, env.ROLLBACK_VERSION_ID);
}
async function verifyHealth(c, {
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  // Workers and zone routes can propagate across edge locations after deploy.
  // A bounded retry never bypasses an individual security assertion.
  async function probe() {
  const request = (route, headers = {}) =>
    fetchImpl(c.vars.API_ORIGIN + route, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers,
    });
  const h = await request("/health");
  requireThat(
    h.status === 200 && (await h.json()).status === "ok",
    "Worker-helse er ikke bekreftet. Ingen automatiske rettelser eller ny utrulling.",
  );
  const denied = await request("/review", {
    Origin: new URL(c.vars.PORTAL_URL).origin,
  });
  requireThat(
    denied.status === 401,
    "Anonym resultattilgang er ikke korrekt sperret. Stopp.",
  );
  // Read-only deployment acceptance: an anonymously visible admin shell is
  // a security failure even when /health and /review return healthy codes.
  const portal = new URL(c.vars.PORTAL_URL);
  const entry = await fetchImpl(portal.href, {
    method: "GET", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  requireThat(entry.status === 200 &&
    (entry.headers.get("content-type") || "").includes("text/html"),
    "Beskyttet adminadresse leverer ikke innloggingssiden.");
  const markup = await entry.text();
  requireThat(markup.includes("Logg inn med GitHub") &&
    !markup.includes("portal-shell") && !markup.includes("resultServiceSave"),
    "Anonym besøkende får se administrasjonen. Utrulling er ikke godkjent.");
  // Every protected document and asset must remain unavailable anonymously.
  // Check the entry document explicitly; a hidden JS file alone is not enough.
  const protectedAssets = [
    "index.html", "admin.js", "admin.css", "web-transport.js",
    "event-profile.json", "diploma-adapter.js",
  ];
  for (const asset of protectedAssets) {
    const blocked = await fetchImpl(new URL(asset, portal), {
      method: "GET", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (asset === "index.html") {
      const html = await blocked.text();
      requireThat(blocked.status === 200 &&
        (blocked.headers.get("content-type") || "").includes("text/html") &&
        html.includes("Logg inn med GitHub") &&
        !html.includes("portal-shell") && !html.includes("resultServiceSave"),
        "Anonym admin/index.html leverer annet enn innloggingssiden.");
    } else {
      requireThat(blocked.status === 401,
        "Adminfil er offentlig tilgjengelig uten innlogging: " + asset);
    }
  }
  // Public runtime mirror must be readable on the admin origin and must not
  // allow admin source paths through the public mirror.
  const publicRuntime = await fetchImpl(new URL("/site/public-manifest.json", portal), {
    method: "GET", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  requireThat(publicRuntime.status === 200 &&
    (publicRuntime.headers.get("content-type") || "").includes("application/json"),
    "Offentlig runtime-speil på admin-origin fungerer ikke.");
  const forbiddenMirror = await fetchImpl(new URL("/site/admin/admin.js", portal), {
    method: "GET", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  requireThat(forbiddenMirror.status === 404,
    "Offentlig speil kan levere adminfiler.");
  // Neither the original Pages alias nor the public canonical domain may
  // deliver a leftover admin entrypoint. A Pages canonical redirect is not
  // evidence of protection: follow it and require an actual 404/410.
  const pagesBase = "https://morothon-no.github.io/historikk/admin/";
  const publicBase = "https://historikk.morothon.no/admin/";
  for (const asset of ["", ...protectedAssets, "admin.js.map"]) {
    const aliasUrl = new URL(asset, pagesBase);
    const pagesAlias = await fetchImpl(aliasUrl, {
      method: "GET", redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    let safe = [404, 410].includes(pagesAlias.status);
    if (!safe && [301, 302, 307, 308].includes(pagesAlias.status)) {
      const location = pagesAlias.headers.get("location") || "";
      let target;
      try { target = new URL(location, aliasUrl); } catch {}
      const intended = new URL(asset, publicBase);
      if (target && target.origin === intended.origin &&
          target.pathname === intended.pathname && target.search === intended.search) {
        const final = await fetchImpl(target, {
          method: "GET", redirect: "error", cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        safe = [404, 410].includes(final.status);
      }
    }
    requireThat(safe,
      "Den gamle offentlige Pages-adressen leverer fortsatt admin: " +
        aliasUrl.pathname);
  }
  return {
    health: "ok",
    anonymousReview: "denied",
    protectedPortal: "login-only",
    protectedAssets: "denied",
    publicPagesAlias: "no-admin-content",
    publicTransportActivated: true,
  };
  }
  let failure;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await probe();
    } catch (error) {
      failure = error;
      if (attempt < 4) await sleep(1500);
    }
  }
  throw failure;
}
module.exports = {
  readConfig,
  validateConfig,
  verifySource,
  validateDispatch,
  checkMetadata,
  remotePreflight,
  verifyHealth,
};
if (require.main === module)
  (async () => {
    const c = await readConfig(),
      mode = process.argv[2];
    requireThat(
      ["local", "dispatch", "remote", "health"].includes(mode),
      "Velg eksplisitt kontrollmodus.",
    );
    let report;
    if (mode === "local") report = verifySource(c);
    if (mode === "dispatch") {
      validateDispatch(c, process.env);
      report = verifySource(c);
    }
    if (mode === "remote") report = await remotePreflight(c, process.env);
    if (mode === "health") report = await verifyHealth(c);
    console.log(JSON.stringify(report));
  })().catch(() => {
    console.error(
      "Utrullingskontrollen stoppet. Se kontrollpunktene i operatørveiledningen; ingen sikkerhetssperre er omgått.",
    );
    process.exitCode = 1;
  });
