"use strict";
// Synthetic Cloudflare metadata only. Never deploys, logs or reads real secret values.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const {
  readConfig,
  validateConfig,
  verifySource,
  validateDispatch,
  checkMetadata,
  remotePreflight,
  verifyHealth,
} = require("../deploy/admin-serverless/check-deployment.cjs");
const clone = structuredClone,
  version = "11111111-1111-4111-8111-111111111111";
function environment(c) {
  return {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "morothon-no/historikk",
    CLOUDFLARE_ACCOUNT_ID: c.account_id,
    CONFIRM_WORKER: c.name,
    VERIFIED_OAUTH_CLIENT_ID: c.vars.OAUTH_CLIENT_ID,
    VERIFIED_PRIVATE_WORKFLOW_SHA: c.vars.PRIVATE_WORKFLOW_SHA,
    BINDINGS_REVIEWED: "true",
    ROLLBACK_VERSION_ID: version,
  };
}
const settings = () => ({
  bindings: [
    "OAUTH_CLIENT_SECRET",
    "GITHUB_APP_PRIVATE_KEY",
    "STORAGE_KEY",
  ].map((name) => ({ name, type: "secret_text" })),
});
const deployments = () => ({
  deployments: [{ versions: [{ version_id: version, percentage: 100 }] }],
});
test("active deployment config reuses the exact Worker and confirmed non-secret identities, with a stable internal UUID", async () => {
  const c = await readConfig();
  assert.equal(c.name, "morothon-admin");
  assert.deepEqual(c.routes, [{
    pattern: "historikk.morothon.no/admin/*", zone_name: "morothon.no",
  }]);
  assert.deepEqual(c.assets, {
    directory: "../../.worker-admin-assets",
    binding: "ADMIN_ASSETS",
    run_worker_first: true,
  });
  assert.equal(c.vars.OWNER_USER_ID, "2932a52f-6831-40a4-b566-bc97a0ab344f");
  assert.equal(c.vars.OWNER_GITHUB_ID, "322168409");
  assert.equal(c.vars.GITHUB_APP_ID, "5815769");
  assert.equal(c.vars.GITHUB_INSTALLATION_ID, "183290892");
  assert.equal(c.vars.PRIVATE_REPOSITORY_ID, "1456606620");
  assert.equal(c.vars.DISPATCH_ACTOR_ID, "358260624");
  assert.equal(c.vars.OAUTH_CLIENT_ID, "Ov23liCJ8N6fIUUWXq3");
  assert.equal(
    c.vars.PRIVATE_WORKFLOW_SHA,
    "99c1d9a704a6f7a0ab83a4d307ea97f38e99b77f",
  );
  assert.equal(
    c.vars.PROCESSOR_CODE_SHA,
    "d5c907d8bc1ebd7196db3fa3ae17b16e3a2d92c3",
  );
  assert.equal(
    path.resolve(__dirname, "../deploy/admin-serverless", c.main),
    path.resolve(__dirname, "../scripts/admin/serverless/worker.mjs"),
  );
});
test("config rejects secret values, alternate target/name/env, routes, paid resources and changed limits", async () => {
  const c = await readConfig();
  for (const alter of [
    (x) => (x.name = "other"),
    (x) => (x.account_id = "a".repeat(32)),
    (x) => (x.main = "./another.mjs"),
    (x) => (x.env = {}),
    (x) => (x.routes = ["*/*"]),
    (x) => (x.routes[0].pattern = "historikk.morothon.no/*"),
    (x) => (x.routes[0].zone_name = "other.invalid"),
    (x) => (x.assets.run_worker_first = false),
    (x) => (x.assets.binding = "UNSAFE"),
    (x) => (x.kv_namespaces = []),
    (x) => (x.vars.STORAGE_KEY = "not-allowed"),
    (x) => (x.vars.OAUTH_CLIENT_SECRET = "not-allowed"),
    (x) => (x.secrets = { OAUTH_CLIENT_SECRET: "not-allowed" }),
    (x) => (x.ratelimits[0].simple.limit = 500),
    (x) => (x.ratelimits[0].namespace_id = "0"),
    (x) => (x.ratelimits[1].namespace_id = "1001"),
  ]) {
    const changed = clone(c);
    alter(changed);
    assert.throws(() => validateConfig(changed));
  }
});
test("dispatch requires main, correct repository/account, explicit operator checks and a rollback version", async () => {
  const c = await readConfig(),
    e = environment(c);
  assert.doesNotThrow(() => validateDispatch(c, e));
  for (const [key, value] of [
    ["GITHUB_EVENT_NAME", "push"],
    ["GITHUB_EVENT_NAME", "pull_request"],
    ["GITHUB_REF", "refs/heads/feature"],
    ["GITHUB_REPOSITORY", "untrusted/fork"],
    ["CLOUDFLARE_ACCOUNT_ID", "wrong"],
    ["CONFIRM_WORKER", "other"],
    ["VERIFIED_OAUTH_CLIENT_ID", "Ov23Unverified"],
    ["VERIFIED_PRIVATE_WORKFLOW_SHA", "a".repeat(40)],
    ["BINDINGS_REVIEWED", "false"],
    ["ROLLBACK_VERSION_ID", ""],
  ])
    assert.throws(() => validateDispatch(c, { ...e, [key]: value }));
});
test("source guard rejects changed Worker/runtime and non-ancestor pins, without executing candidate code", async () => {
  const c = await readConfig();
  let paths;
  const good = (args) => {
    if (args[0] === "cat-file") return "commit\n";
    if (args[0] === "diff") {
      paths = args;
      return "";
    }
    return "";
  };
  assert.equal(verifySource(c, { git: good }).workerSourceMatches, true);
  assert.ok(paths.includes("scripts/admin/serverless"));
  assert.ok(paths.includes("tools/diploma-admin/intake-model.js"));
  assert.equal(verifySource(c, {
    git: args => args[0] === "diff" ? "scripts/admin/serverless/worker.mjs\nscripts/admin/serverless/admin-gateway.cjs\n" : good(args),
  }).workerSourceMatches, true);
  assert.throws(
    () =>
      verifySource(c, {
        git: (args) =>
          args[0] === "diff"
            ? "scripts/admin/serverless/broker.cjs\n"
            : good(args),
      }),
    /avviker/,
  );
  assert.throws(
    () =>
      verifySource(c, {
        git: (args) => {
          if (args[0] === "merge-base") throw Error("non-ancestor");
          return good(args);
        },
      }),
    /non-ancestor/,
  );
});
test("metadata guard requires all three secret names and an existing single-version rollback target, without values", async () => {
  const c = await readConfig(),
    s = settings(),
    d = deployments();
  assert.deepEqual(checkMetadata(c, s, d, version), {
    worker: "morothon-admin",
    requiredSecretNamesPresent: true,
    unknownBindings: false,
    rollbackVersion: version,
  });
  s.bindings.pop();
  assert.throws(() => checkMetadata(c, s, d, version), /secrets mangler/);
  assert.throws(
    () => checkMetadata(c, settings(), { deployments: [] }, version),
    /Tilbakeføringsversjonen/,
  );
  d.deployments[0].versions[0].percentage = 50;
  assert.throws(() => checkMetadata(c, settings(), d, version), /gradvis/);
});
test("unknown bindings, plaintext secret collisions and changed existing rate counters stop rollout", async () => {
  const c = await readConfig();
  for (const b of [
    { name: "UNKNOWN_DB", type: "d1" },
    { name: "UNKNOWN_SECRET", type: "secret_text" },
    { name: "OAUTH_CLIENT_SECRET", type: "plain_text" },
    {
      name: "AUTH_LIMITER",
      type: "ratelimit",
      namespace_id: "9999",
      simple: { limit: 5, period: 60 },
    },
  ]) {
    const s = settings();
    s.bindings = s.bindings.filter((x) => x.name !== b.name);
    s.bindings.push(b);
    assert.throws(() => checkMetadata(c, s, deployments(), version));
  }
  const s = settings();
  s.bindings.push(
    ...c.ratelimits.map((r) => ({
      ...r,
      type: "ratelimit",
      simple: { period: r.simple.period, limit: r.simple.limit },
    })),
    { name: "API_ORIGIN", type: "plain_text" },
  );
  assert.equal(
    checkMetadata(c, s, deployments(), version).unknownBindings,
    false,
  );
});
test("remote preflight is GET-only, fixed-account, metadata-only and cannot create a missing Worker", async () => {
  const c = await readConfig(),
    e = { ...environment(c), CLOUDFLARE_API_TOKEN: "synthetic-deploy-token" },
    calls = [];
  const report = await remotePreflight(c, e, {
    fetchImpl: async (url, o) => {
      calls.push({ url, method: o.method });
      return Response.json({
        success: true,
        result: url.endsWith("/settings") ? settings() : deployments(),
      });
    },
  });
  assert.equal(report.requiredSecretNamesPresent, true);
  assert.deepEqual(
    calls.map((c) => c.url),
    ["settings", "deployments"].map(
      (p) =>
        "https://api.cloudflare.com/client/v4/accounts/" +
        c.account_id +
        "/workers/scripts/morothon-admin/" +
        p,
    ),
  );
  assert.ok(calls.every((c) => c.method === "GET"));
  assert.ok(!JSON.stringify(report).includes("synthetic-deploy-token"));
  await assert.rejects(
    remotePreflight(c, e, {
      fetchImpl: async () =>
        new Response("private upstream error", { status: 404 }),
    }),
    /Ingen deploy/,
  );
  await assert.rejects(
    remotePreflight(c, { ...e, CLOUDFLARE_API_TOKEN: "" }),
    /mangler/,
  );
});
test("post-deploy health verification performs only safe GETs and rejects anonymous access or unhealthy responses", async () => {
  const c = await readConfig(),
    calls = [];
  assert.equal(
    (
      await verifyHealth(c, {
        fetchImpl: async (url, o) => {
          calls.push({ url, o });
          if (url.endsWith("/health")) return Response.json({ status: "ok" });
          if (url.endsWith("/review")) return new Response("{}",{status:401});
          if (url === c.vars.PORTAL_URL)
            return new Response("<html><button>Logg inn med GitHub</button></html>", {
              status:200,headers:{"Content-Type":"text/html"}
            });
          if (url.startsWith(c.vars.PORTAL_URL))
            return new Response("Unauthorized",{status:401});
          return new Response("Not found",{status:404});
        },
      })
    ).publicTransportActivated,
    true,
  );
  assert.ok(
    calls.every((x) => x.o.method === "GET" && !x.url.includes("/auth/")),
  );
  assert.equal(calls[1].o.headers.Origin, "https://historikk.morothon.no");
  await assert.rejects(
    verifyHealth(c, {
      sleep: async () => {},
      fetchImpl: async () => new Response("{}", { status: 503 }),
    }),
    /helse/,
  );
  await assert.rejects(
    verifyHealth(c, {
      sleep: async () => {},
      fetchImpl: async (url) => Response.json({ status: "ok" }),
    }),
    /Anonym/,
  );
});
test("manual workflow has no automatic trigger, write/deploy permissions, public artifact or direct PR-code execution", async () => {
  const file = await fs.readFile(
    path.join(__dirname, "../.github/workflows/deploy-admin-worker.yml"),
    "utf8",
  );
  assert.match(file, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(
    file,
    /^\s+(push|pull_request|pull_request_target|schedule|workflow_run):/m,
  );
  assert.doesNotMatch(
    file,
    /(contents|actions|id-token|deployments|packages): write|upload-artifact@|actions\/cache@|persist-credentials|secrets-file|secret (put|bulk|delete)/,
  );
  assert.match(file, /github.ref == 'refs\/heads\/main'/);
  assert.match(file, /github.repository == 'morothon-no\/historikk'/);
  assert.match(file, /wrangler@4\.164\.0/);
  assert.doesNotMatch(file, /wrangler@latest|npm ci/);
  assert.match(file, /--ignore-scripts/);
  assert.match(file, /test ! -e data/);
  assert.match(file, /test ! -e public-data/);
  assert.match(file, /secrets.CLOUDFLARE_API_TOKEN/);
  assert.match(file, /vars.CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(
    file,
    /secrets\.(OAUTH_CLIENT_SECRET|GITHUB_APP_PRIVATE_KEY|STORAGE_KEY)/,
  );
  const remote = file.indexOf("check-deployment.cjs remote"),
    deploy = file.indexOf(" deploy --config");
  assert.ok(remote > 0 && deploy > remote);
  assert.match(file, /--name morothon-admin/);
  assert.match(
    file,
    /run: node deploy\/admin-serverless\/check-deployment.cjs health/,
  );
});
