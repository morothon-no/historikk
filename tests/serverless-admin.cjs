"use strict";
// Synthetic identities/results only. No live OAuth, GitHub writes or deployment.
const test = require("node:test"),
  assert = require("node:assert/strict");
const { randomBytes, generateKeyPairSync, sign } = require("node:crypto");
const {
  createAuth,
  token,
  hash,
} = require("../scripts/admin/serverless/auth.cjs");
const {
  githubStore,
  seal,
  unseal,
  sha,
  tokenConnection,
} = require("../scripts/admin/serverless/github-store.cjs");
const { oidcVerifier } = require("../scripts/admin/serverless/oidc.cjs");
const { createBroker } = require("../scripts/admin/serverless/broker.cjs");
const { createDriver } = require("../scripts/admin/serverless/driver.cjs");
const {
  publicationStore,
} = require("../scripts/admin/serverless/publication-store.cjs");
const {
  createAccountDirectory,
} = require("../scripts/admin/account-directory.cjs");
const {
  setup,
  userId,
  organizer,
} = require("./helpers/result-publication.cjs");
const C = require("../tools/diploma-admin/intake-model.js").Corrections;
const copy = (v) => structuredClone(v),
  apiOrigin = "https://service.example.test",
  portalUrl = "https://portal.example.test/historikk/admin/",
  codeSha = "a".repeat(40),
  workflowSha = "b".repeat(40);
function memory() {
  const data = new Map();
  return {
    data,
    get: async (id) => copy(data.get(id) || null),
    transact: async (id, rev, fn) => {
      const p = data.get(id);
      if ((p?.revision || 0) !== rev)
        throw Object.assign(Error("Arbeidet er endret."), { status: 409 });
      const next = fn(copy(p || null));
      assert.equal(next.revision, rev + 1);
      data.set(id, copy(next));
      return copy(next);
    },
  };
}
function accounts() {
  return createAccountDirectory({
    users: [{ userId, active: true }],
    externalIdentities: [{ provider: "github", subject: "123", userId }],
    memberships: [
      { userId, organizerId: organizer, role: "owner", active: true },
    ],
  });
}
function authFixture({ identity = 123 } = {}) {
  const store = memory(),
    clock = { now: 1800000000000 },
    requests = [];
  const options = {
    apiOrigin,
    portalOrigin: new URL(portalUrl).origin,
    portalUrl,
    clientId: "synthetic-client",
    clientSecret: "synthetic-secret",
    accounts: accounts(),
    store,
    clock: () => clock.now,
    fetchImpl: async (url, o) => {
      requests.push({ url, o });
      return Response.json(
        url.includes("access_token")
          ? { access_token: "synthetic-provider-token" }
          : { id: identity, login: "synthetic-owner" },
      );
    },
  };
  return { store, clock, requests, options, auth: createAuth(options) };
}
async function authenticate(f) {
  const verifier = token(),
    state = token(),
    begin = await f.auth.begin(
      new URLSearchParams({ challenge: hash(verifier), state }),
    ),
    url = new URL(begin.location),
    req = new Request(apiOrigin + "/auth/callback", {
      headers: { cookie: begin.cookie.split(";")[0] },
    }),
    params = new URLSearchParams({
      state: url.searchParams.get("state"),
      code: "synthetic-provider-code",
    });
  const complete = await f.auth.complete(req, params),
    fragment = new URLSearchParams(new URL(complete.location).hash.slice(1));
  return {
    verifier,
    state,
    begin,
    req,
    params,
    complete,
    code: fragment.get("morothon-auth"),
  };
}
test("serverless OAuth uses numeric identity, one-use PKCE handoff and exact portal base path across fresh isolates", async () => {
  const f = authFixture(),
    flow = await authenticate(f);
  assert.equal(new URL(flow.complete.location).pathname, "/historikk/admin/");
  assert.match(flow.begin.cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(
    new URL(flow.begin.location).searchParams.get("code_challenge_method"),
    "S256",
  );
  const fresh = createAuth(f.options);
  await assert.rejects(
    fresh.exchange({ code: flow.code, verifier: token() }),
    /utløpt/,
  );
  const session = await fresh.exchange({
    code: flow.code,
    verifier: flow.verifier,
  });
  assert.equal(session.sessionToken.length, 43);
  assert.equal(
    (
      await fresh.authenticate(
        new Request(apiOrigin, {
          headers: { authorization: "Bearer " + session.sessionToken },
        }),
      )
    ).subject,
    userId,
  );
  assert.ok(!flow.complete.location.includes("synthetic-provider"));
  assert.ok(
    !JSON.stringify([...f.store.data.values()]).includes(
      "synthetic-provider-token",
    ),
  );
  await assert.rejects(
    fresh.exchange({ code: flow.code, verifier: flow.verifier }),
    /brukt/,
  );
  await assert.rejects(fresh.complete(flow.req, flow.params), /utløpt/);
});
test("unknown GitHub users, cookie substitution, expired OAuth flows and revoked sessions fail closed", async () => {
  const bad = authFixture({ identity: 999 });
  await assert.rejects(authenticate(bad), /administratortilgang/);
  const f = authFixture(),
    v = token(),
    begin = await f.auth.begin(
      new URLSearchParams({ challenge: hash(v), state: token() }),
    ),
    params = new URLSearchParams({
      state: new URL(begin.location).searchParams.get("state"),
      code: "synthetic",
    });
  await assert.rejects(
    f.auth.complete(new Request(apiOrigin), params),
    /nettleser/,
  );
  f.clock.now += 300001;
  await assert.rejects(
    f.auth.complete(
      new Request(apiOrigin, {
        headers: { cookie: begin.cookie.split(";")[0] },
      }),
      params,
    ),
    /utløpt/,
  );
  const g = authFixture(),
    flow = await authenticate(g),
    s = await g.auth.exchange({ code: flow.code, verifier: flow.verifier }),
    r = new Request(apiOrigin, {
      headers: { authorization: "Bearer " + s.sessionToken },
    });
  await g.auth.logout(r);
  await assert.rejects(createAuth(g.options).authenticate(r), /utløpt/);
  const h = authFixture(),
    flow2 = await authenticate(h),
    s2 = await h.auth.exchange({ code: flow2.code, verifier: flow2.verifier });
  h.clock.now += 15 * 60000;
  await assert.rejects(
    h.auth.authenticate(
      new Request(apiOrigin, {
        headers: { authorization: "Bearer " + s2.sessionToken },
      }),
    ),
    /utløpt/,
  );
});
function privateApi() {
  const files = new Map(),
    writes = [];
  let isPrivate = true;
  return {
    repository: "synthetic-org/private-state",
    files,
    writes,
    setPrivate: (v) => {
      isPrivate = v;
    },
    request: async (route, o = {}) => {
      if (!route)
        return {
          private: isPrivate,
          full_name: "synthetic-org/private-state",
          default_branch: "main",
        };
      const path = route.replace(/^contents\//, "").split("?")[0];
      if (o.method === "PUT") {
        const b = JSON.parse(o.body),
          old = files.get(path);
        assert.equal(b.branch, "admin-state");
        if ((old?.sha || undefined) !== b.sha)
          throw Object.assign(Error("conflict"), { status: 409 });
        const bytes = Buffer.from(b.content, "base64"),
          m = {
            type: "file",
            encoding: "base64",
            sha: sha(bytes).slice(0, 40),
            size: bytes.length,
            content: b.content,
          };
        writes.push({ path, b, bytes });
        files.set(path, m);
        return {};
      }
      assert.match(route, /\?ref=admin-state$/);
      return copy(files.get(path) || null);
    },
  };
}
test("encrypted GitHub CAS state persists on a separate branch and refuses public storage, stale writes and cross-record ciphertext", async () => {
  const api = privateApi(),
    key = randomBytes(32),
    s = githubStore({ api, key, prefix: "reviews" });
  await s.transact(organizer, 0, () => ({
    revision: 1,
    secret: "synthetic-private-draft",
  }));
  assert.ok(!api.writes[0].bytes.includes("synthetic-private-draft"));
  assert.equal(
    (await githubStore({ api, key, prefix: "reviews" }).get(organizer)).secret,
    "synthetic-private-draft",
  );
  await assert.rejects(
    s.transact(organizer, 0, () => ({ revision: 1 })),
    /endret/,
  );
  const p = api.writes[0].path;
  assert.throws(() => unseal(key, p + "-substitute", api.writes[0].bytes));
  api.setPrivate(false);
  await assert.rejects(s.get(organizer), /privat/);
  assert.throws(() => githubStore({ api, key, branch: "main" }), /nøkkel/);
  assert.throws(() =>
    unseal(randomBytes(32), p, seal(key, p, { revision: 1 })),
  );
});
test("compressed publication storage writes immutable backup payload once, verifies digest and hydrates after restart", async () => {
  const metadata = memory(),
    payloads = memory(),
    s = publicationStore({ metadata, payloads }),
    job = {
      before: { row: "synthetic" },
      after: { row: "changed" },
      otherFiles: {},
      draft: { cases: [] },
      build: { version: "test" },
      stage: "prepared",
    };
  await s.transact("job", 0, () => ({
    revision: 1,
    draft: job.draft,
    publication: job,
  }));
  await s.transact("job", 1, (p) => ({
    ...p,
    revision: 2,
    publication: { ...p.publication, stage: "checking" },
  }));
  assert.equal(payloads.data.size, 1);
  assert.ok(!JSON.stringify(await metadata.get("job")).includes("changed"));
  assert.deepEqual(
    (await publicationStore({ metadata, payloads }).get("job")).publication,
    { ...job, stage: "checking" },
  );
  const id = [...payloads.data.keys()][0];
  payloads.data.get(id).data += "tamper";
  await assert.rejects(
    publicationStore({ metadata, payloads }).get("job"),
    /endret/,
  );
});
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 }),
  kid = "synthetic-key";
function oidcFixture() {
  const now = 1800000000000,
    jwk = { ...keys.publicKey.export({ format: "jwk" }), kid, use: "sig" },
    claims = {
      iss: "https://token.actions.githubusercontent.com",
      aud: apiOrigin + "/processor",
      iat: now / 1000,
      nbf: now / 1000,
      exp: now / 1000 + 300,
      repository: "synthetic-org/private-state",
      repository_id: "789",
      repository_visibility: "private",
      ref: "refs/heads/main",
      event_name: "workflow_dispatch",
      runner_environment: "github-hosted",
      actor_id: "456",
      workflow_sha: workflowSha,
      workflow_ref:
        "synthetic-org/private-state/.github/workflows/morothon-result-job.yml@refs/heads/main",
      run_id: "1122",
    },
    verify = oidcVerifier({
      repository: claims.repository,
      repositoryId: "789",
      workflowSha,
      actorId: "456",
      audience: claims.aud,
      clock: () => now,
      fetchImpl: async () => Response.json({ keys: [jwk] }),
    });
  function jwt(changes = {}) {
    const parts = [
        { alg: "RS256", kid },
        { ...claims, ...changes },
      ].map((o) => Buffer.from(JSON.stringify(o)).toString("base64url")),
      body = parts.join(".");
    return (
      body +
      "." +
      sign("RSA-SHA256", Buffer.from(body), keys.privateKey).toString(
        "base64url",
      )
    );
  }
  return { verify, jwt };
}
test("GitHub OIDC lease checks signature, private repo ID, exact workflow commit, actor, ref, event, audience and runner", async () => {
  const f = oidcFixture();
  assert.deepEqual(await f.verify(f.jwt()), { runId: "1122" });
  for (const changes of [
    { repository_visibility: "public" },
    { repository_id: "000" },
    { repository: "evil/fork" },
    { ref: "refs/pull/1/merge" },
    { event_name: "pull_request" },
    { workflow_sha: codeSha },
    {
      workflow_ref:
        "synthetic-org/private-state/.github/workflows/evil.yml@refs/heads/main",
    },
    { actor_id: "999" },
    { runner_environment: "self-hosted" },
    { aud: "wrong" },
    { exp: 1700000000 },
    { exp: 1900000000 },
    { iat: 1900000000 },
  ])
    await assert.rejects(f.verify(f.jwt(changes)), /identitet/);
  const signed = f.jwt();
  await assert.rejects(f.verify(signed.slice(0, -8) + "AAAAAAAA"), /identitet/);
});
async function brokerFixture(t) {
  const f = await setup(t),
    control = memory(),
    reviews = memory(),
    dispatches = [],
    leaseCalls = [],
    auth = {
      authenticate: async (r) => {
        if (r.headers.get("authorization") !== "Bearer synthetic-session")
          throw Object.assign(Error("Logg inn."), { status: 401 });
        return { subject: userId };
      },
      logout: async () => ({ loggedOut: true }),
    },
    broker = createBroker({
      portalUrl,
      apiOrigin,
      ownerUserId: userId,
      ownerGithubId: "123",
      codeSha,
      workflowSha,
      auth,
      reviews,
      control,
      privateApi: {
        request: async (route, o) => {
          if (route.includes("dispatches")) {
            dispatches.push(JSON.parse(o.body));
            return null;
          }
          return { status: "in_progress" };
        },
      },
      publicApi: {
        request: async () => ({
          encoding: "base64",
          content: f.repository.files
            .get(".github/public-data-approval.json")
            .toString("base64"),
        }),
      },
      verifyOidc: async (jwt) => {
        if (jwt !== "synthetic-private-oidc")
          throw Object.assign(Error("deny"), { status: 403 });
        return { runId: "1122" };
      },
      leaseTokens: async (task) => {
        leaseCalls.push(task);
        return { privateToken: "synthetic-private-lease" };
      },
    });
  async function request(
    route,
    body,
    { origin = new URL(portalUrl).origin, auth = true, method } = {},
  ) {
    const r = await broker.fetch(
      new Request(apiOrigin + route, {
        method: method || (body === undefined ? "GET" : "POST"),
        headers: {
          ...(origin ? { origin } : {}),
          ...(auth ? { authorization: "Bearer synthetic-session" } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: r.status, body: await r.json(), headers: r.headers };
  }
  return { ...f, broker, control, dispatches, leaseCalls, request };
}
test("broker rejects unauthenticated and foreign-origin writes; saves only source-bound result drafts, without authenticating client flags", async (t) => {
  const f = await brokerFixture(t),
    draft = await f.draft();
  assert.equal((await f.request("/review")).status, 200);
  assert.equal(
    (await f.request("/review", undefined, { auth: false })).status,
    401,
  );
  assert.equal(
    (await f.request("/review", undefined, { origin: "https://evil.test" }))
      .status,
    403,
  );
  assert.equal(
    (await f.request("/review/save", { draft, expectedRevision: 0 })).status,
    200,
  );
  assert.equal(
    (
      await f.request("/publication/publish", {
        expectedRevision: 1,
        expectedDigest: sha(draft),
        confirmation: true,
      })
    ).status,
    409,
  );
  assert.equal(f.dispatches.length, 0);
  assert.equal(
    (await f.request("/review/save", { draft, expectedRevision: 0 })).status,
    409,
  );
  const stale = copy(draft);
  stale.base.historySha256 = "f".repeat(64);
  assert.equal(
    (await f.request("/review/save", { draft: stale, expectedRevision: 1 }))
      .status,
    409,
  );
  assert.equal(
    (await f.request("/review/discard", { expectedRevision: 1 })).status,
    200,
  );
  assert.equal((await f.request("/review")).body.draft.cases.length, 0);
  assert.equal(f.remote.submitted, 0);
});
test("broker queues exact owner task once, binds lease to a trusted private run and blocks competing writes", async (t) => {
  const f = await brokerFixture(t),
    draft = await f.draft();
  await f.request("/review/save", { draft, expectedRevision: 0 });
  const start = await f.request("/review/validate", {
    expectedRevision: 1,
    expectedDigest: sha(draft),
  });
  assert.equal(start.status, 202);
  assert.equal(f.dispatches.length, 1);
  assert.equal(
    (await f.request("/review/save", { draft, expectedRevision: 1 })).status,
    409,
  );
  const task = await f.control.get("task-" + start.body.id),
    leaseReq = () =>
      new Request(apiOrigin + "/processor/lease", {
        method: "POST",
        headers: {
          authorization: "Bearer synthetic-private-oidc",
          "content-type": "application/json",
        },
        body: JSON.stringify({ task: task.id, nonce: task.nonce }),
      });
  const r = await f.broker.fetch(leaseReq());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).task.runId, "1122");
  assert.equal(f.leaseCalls.length, 1);
  assert.equal(
    (await f.request("/processor/lease", { task: task.id, nonce: task.nonce }))
      .status,
    403,
  );
  assert.equal((await f.request("/task/retry", { id: task.id })).status, 409);
});
async function drive(f, action) {
  const r = await f.review.load(f.input),
    id = String((await f.control.get("counter"))?.revision || 0).padStart(
      25,
      "0",
    );
  await f.control.transact("counter", Number(id), () => ({
    revision: Number(id) + 1,
  }));
  const task = {
    id,
    organizer,
    actor: userId,
    action,
    expectedRevision: r.revision,
    expectedDigest: r.digest,
    codeSha,
    ...(action === "reverse" ? { publicationId: f.lastPublication } : {}),
    ...((await f.reviewStore.get(organizer))?.reversalOf
      ? { reversalOf: (await f.reviewStore.get(organizer)).reversalOf }
      : {}),
  };
  await f.control.transact("task-" + id, 0, () => ({
    ...task,
    revision: 1,
    state: "running",
  }));
  return createDriver({
    lease: { task, ownerUserId: userId, codeSha },
    reviews: f.reviewStore,
    stateStore: f.stateStore,
    control: f.control,
    directory: f.directory,
    adapter: f.adapter,
    loadContext: async () => f.context,
    checkBuild: async () => ({
      version: "f".repeat(16),
      siteUrl: "https://public.example.test/",
      files: {},
    }),
    verifyLive: async () => true,
    onPublished: async (job) => {
      f.context.history = JSON.parse(
        Buffer.from(job.after["data/history.json"].base64, "base64"),
      );
      f.context.base = await f.bind(f.repository.files);
      return f.context.base;
    },
    pause: async () => {
      f.remote.checks = "success";
      f.remote.deploy = "success";
    },
  }).run();
}
test("private driver recomputes client draft, persists checked before/after, publishes only after separate owner task, then prepares explicit withdrawal", async (t) => {
  const f = await setup(t);
  f.control = memory();
  const d = await f.draft();
  await f.reviewStore.transact(organizer, 0, () => ({
    v: 1,
    revision: 1,
    status: "draft",
    base: f.context.base,
    draft: d,
    approval: null,
    events: [],
  }));
  assert.equal((await drive(f, "validate")).completed, true);
  let p = await f.control.get("projection-" + organizer);
  assert.equal(p.validation.ready, true);
  assert.equal(f.remote.submitted, 0);
  assert.equal((await drive(f, "publish")).completed, true);
  p = await f.control.get("projection-" + organizer);
  assert.equal(p.publication.stage, "published");
  assert.equal(p.history.length, 1);
  assert.equal(p.history[0].actor, userId);
  f.lastPublication = p.publication.id;
  const row = p.publication.changes[0].index;
  assert.equal(f.context.history.results[row][5], "49:58");
  assert.equal((await drive(f, "reverse")).completed, true);
  const r = await f.review.load(f.input);
  assert.equal(
    (await f.reviewStore.get(organizer)).reversalOf,
    f.lastPublication,
  );
  assert.equal(
    f.context.history.results[row][5],
    "49:58",
    "withdrawal is only a draft until separate owner publication",
  );
  assert.equal((await drive(f, "publish")).completed, true);
  assert.deepEqual(
    f.context.history.results[row],
    p.publication.changes[0].before,
  );
  assert.equal(
    (await f.control.get("projection-" + organizer)).history[0].reverses,
    f.lastPublication,
  );
});
test("leased private token adapter allows compare refs, but rejects decoded path escape and forwards JSON correctly", async () => {
  const requests = [],
    api = tokenConnection(
      "synthetic/repo",
      "synthetic-short-token",
      async (u, o) => {
        requests.push({ u, o });
        return Response.json({ ok: true });
      },
    );
  await api.request("compare/aaa...bbb");
  await api.request("git/refs", {
    method: "POST",
    body: { ref: "refs/heads/test" },
  });
  assert.equal(requests[1].o.body, '{"ref":"refs/heads/test"}');
  await assert.rejects(api.request("%2e%2e/other"));
});
test("leased GitHub adapter retains protected-review refusal and uncertain-write semantics without leaking upstream bodies", async () => {
  const denied = tokenConnection(
    "synthetic/repo",
    "synthetic-token",
    async () => new Response("upstream-private-detail", { status: 405 }),
  );
  await assert.rejects(
    denied.request("pulls/1/merge", { method: "PUT", body: {} }),
    (e) =>
      e.githubStatus === 405 && !e.message.includes("upstream-private-detail"),
  );
  const offline = tokenConnection(
    "synthetic/repo",
    "synthetic-token",
    async () => {
      throw Error("network-secret");
    },
  );
  await assert.rejects(
    offline.request("git/refs", { method: "POST", body: {} }),
    (e) => e.uncertain === true && !e.message.includes("network-secret"),
  );
  await assert.rejects(
    offline.request("contents/file"),
    (e) => e.uncertain === false,
  );
});
test("private processor template fetches only pinned public code, never original registers, private PR code or cached credentials", async () => {
  const fs = require("node:fs/promises"),
    workflow = await fs.readFile(
      require("node:path").join(
        __dirname,
        "../deploy/admin-serverless/private-workflow.yml.example",
      ),
      "utf8",
    );
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(
    workflow,
    /pull_request:|pull_request_target:|push:|upload-artifact@|persist-credentials|secrets\./,
  );
  assert.match(
    workflow,
    /git fetch --quiet --depth=1 --filter=blob:none origin "\$MOROTHON_CODE_SHA"/,
  );
  assert.match(workflow, /test ! -e data/);
  assert.match(workflow, /test ! -e scripts\/lib\/public-data.cjs/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /npm ci --ignore-scripts/);

});
test("owner can cancel an unleased uncertain dispatch, invalidating its nonce without cancelling a running publisher", async (t) => {
  const f = await brokerFixture(t),
    draft = await f.draft();
  await f.request("/review/save", { draft, expectedRevision: 0 });
  const start = await f.request("/review/validate", {
      expectedRevision: 1,
      expectedDigest: sha(draft),
    }),
    task = await f.control.get("task-" + start.body.id);
  assert.equal(
    (await f.request("/task/cancel", { id: task.id, confirmation: false }))
      .status,
    409,
  );
  assert.equal(
    (await f.request("/task/cancel", { id: task.id, confirmation: true }))
      .status,
    200,
  );
  const lease = await f.broker.fetch(
    new Request(apiOrigin + "/processor/lease", {
      method: "POST",
      headers: {
        authorization: "Bearer synthetic-private-oidc",
        "content-type": "application/json",
      },
      body: JSON.stringify({ task: task.id, nonce: task.nonce }),
    }),
  );
  assert.equal(lease.status, 403);
  assert.equal(f.leaseCalls.length, 0);
  assert.equal((await f.request("/task/retry", { id: task.id })).status, 409);
  assert.equal(
    (await f.request("/review/save", { draft, expectedRevision: 1 })).status,
    200,
  );
});

test("Worker adapter refuses missing deployment credentials without any external call", async () => {
 const worker = (await import("../scripts/admin/serverless/worker.mjs")).default;
 const response = await worker.fetch(new Request(apiOrigin + "/session"), {});
 assert.equal(response.status, 503);
 assert.equal(response.headers.get("cache-control"), "no-store");
 assert.match((await response.json()).error, /ikke aktivert/);
});
test("broker rejects oversized chunked JSON before reading the rest of its stream", async t => {
 const f = await brokerFixture(t); let reads=0,cancelled=false;
 const stream=new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(40000));},cancel(){cancelled=true;}},{highWaterMark:0});
 const response=await f.broker.fetch(new Request(apiOrigin+'/review/save',{method:'POST',headers:{origin:new URL(portalUrl).origin,authorization:'Bearer synthetic-session','content-type':'application/json'},duplex:'half',body:stream}));
 assert.equal(response.status,413);assert.equal(cancelled,true);assert.ok(reads<=3);assert.equal((await f.request('/review')).body.revision,0);
});
