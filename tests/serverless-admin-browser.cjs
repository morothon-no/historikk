"use strict";
// Pages UI -> OAuth -> broker -> private processor -> isolated real Git/build/profile.
// All results are synthetic. Only GitHub network transports are simulated.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { randomBytes } = require("node:crypto"),
  { chromium } = require("playwright");
const { fakeGitHub } = require("./helpers/github-result-api.cjs"),
  { userId, organizer } = require("./helpers/result-publication.cjs");
const { createAuth } = require("../scripts/admin/serverless/auth.cjs"),
  { createBroker } = require("../scripts/admin/serverless/broker.cjs"),
  { createDriver } = require("../scripts/admin/serverless/driver.cjs");
const { privateFileStore } = require("../scripts/admin/review-workspace.cjs"),
  {
    createAccountDirectory,
  } = require("../scripts/admin/account-directory.cjs");
const {
    createGitHubPublisher,
  } = require("../scripts/admin/github-result-publisher.cjs"),
  {
    createDeploymentVerifier,
  } = require("../scripts/admin/deployment-verifier.cjs");
const {
    approvedRuntime,
    createProjector,
  } = require("../scripts/admin/review-runtime.cjs"),
  { buildSite } = require("../scripts/build-site.cjs");
const { buildProtectedAdmin } = require("../scripts/build-protected-admin.cjs");
const { ADMIN_SOURCES } = require("../scripts/lib/runtime-files.cjs");
const C = require("../tools/diploma-admin/intake-model.js").Corrections,
  sample = require("./public/quick/fixtures/corrections-data.js");
const origin = "https://portal.example.test",
  service = "https://service.example.test",
  workflowSha = "b".repeat(40);
function memory() {
  const data = new Map();
  return {
    get: async (k) => structuredClone(data.get(k) || null),
    transact: async (k, r, fn) => {
      const old = data.get(k);
      if ((old?.revision || 0) !== r)
        throw Object.assign(Error("endret"), { status: 409 });
      const next = fn(structuredClone(old || null));
      data.set(k, structuredClone(next));
      return structuredClone(next);
    },
  };
}
test(
  "Pages admin logs in, edits synthetic existing result, reopens private draft, publishes and withdraws through real build/profile controls",
  { timeout: 300000 },
  async (t) => {
    const root = path.resolve(__dirname, ".."),
      original = await fs.readFile(
        path.join(root, "public-data/data/history.json"),
      ),
      api = await fakeGitHub(t, sample.history()),
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "serverless-browser-"));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    let generation = 0, needsOwnerReview = true;
    async function build() {
      const dataDir = path.join(dir, "package-" + generation),
        approvalFile = path.join(dir, "approval-" + generation + ".json");
      await fs.mkdir(path.join(dataDir, "data"), { recursive: true });
      for (const n of [
        "history",
        "honors",
        "volunteers",
        "badges",
        "event-dates",
      ])
        await fs.writeFile(
          path.join(dataDir, "data", n + ".json"),
          api.read("public-data/data/" + n + ".json"),
        );
      await fs.writeFile(
        path.join(dataDir, "manifest.json"),
        api.read("public-data/manifest.json"),
      );
      await fs.writeFile(
        approvalFile,
        api.read(".github/public-data-approval.json"),
      );
      const result = await buildSite(path.join(dir, "site-" + generation++), {
        dataDir,
        approvalFile,
      });
      return approvedRuntime(result.out, approvalFile);
    }
    const runtime = await build();
    // The public site no longer exposes admin; the test mounts separate
    // Worker assets only inside its isolated synthetic browser environment.
    const protectedDir = path.join(dir, "worker-assets");
    await buildProtectedAdmin(protectedDir);
    const protectedFiles = new Map();
    for (const name of Object.keys(ADMIN_SOURCES)) {
      let bytes = await fs.readFile(path.join(protectedDir, name));
      if (name === "admin/index.html") bytes = Buffer.from(bytes.toString()
        .replace('data-admin-mode="protected"', 'data-admin-mode="public-preview"'));
      protectedFiles.set(name, bytes);
    }
    let publicFiles = new Map([...runtime.files, ...protectedFiles]);
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    t.after(() => browser.close());
    const projector = await createProjector(runtime, { browser });
    const reviews = privateFileStore({
        directory: path.join(dir, "reviews"),
        key: randomBytes(32),
      }),
      stateStore = privateFileStore({
        directory: path.join(dir, "publication"),
        key: randomBytes(32),
      }),
      control = memory(),
      authStore = memory(),
      accounts = createAccountDirectory({
        users: [{ userId, active: true }],
        externalIdentities: [{ provider: "github", subject: "123", userId }],
        memberships: [
          { userId, organizerId: organizer, role: "owner", active: true },
        ],
      }),
      auth = createAuth({
        apiOrigin: service,
        portalOrigin: origin,
        clientId: "synthetic-client",
        clientSecret: "synthetic-secret",
        accounts,
        store: authStore,
        fetchImpl: async (url) =>
          Response.json(
            url.endsWith("/user")
              ? { id: 123 }
              : { access_token: "synthetic-provider-token" },
          ),
      }),
      adapter = createGitHubPublisher({
        api: async (route, options) => {
          if (needsOwnerReview && options?.method === "PUT" && /pulls\/\d+\/merge$/.test(route))
            throw Object.assign(Error("Syntetisk påkrevd eiergodkjenning"), {githubStatus:405});
          return api.api(route, options);
        },
        codeSha: api.codeSha,
        appId: "123",
      }),
      verify = createDeploymentVerifier({
        verifyProfiles: projector.verifyProfiles,
        fetchImpl: async (url) => {
          const bytes = publicFiles.get(new URL(url).pathname.slice(1));
          return { ok: !!bytes, arrayBuffer: async () => bytes };
        },
      });
    let pending = Promise.resolve(),
      jobError;
    async function processTask(input) {
      const task = await control.get("task-" + input.task);
      await control.transact("task-" + task.id, task.revision, (p) => ({
        ...p,
        revision: p.revision + 1,
        state: "running",
        runId: "123",
      }));
      const result = await createDriver({
        lease: { task, ownerUserId: userId, codeSha: api.codeSha },
        reviews,
        stateStore,
        control,
        adapter,
        directory: dir,
        loadContext: async () => ({ ...runtime, project: projector.project }),
        verifyLive: verify,
        onPublished: async (job, checked) => {
          const m = JSON.parse(checked.files.get("public-manifest.json")),
            base = await C.binding(checked.history, {
              dataVersion: m.dataVersion,
              manifestSha256: job.approval.manifestSha256,
              historySha256: m.historySha256,
            });
          Object.assign(runtime, {
            files: checked.files,
            history: checked.history,
            base,
          });
          return base;
        },
        pause: async () => {
          api.state.checks = "success";
          api.state.deploy = "success";
          if (api.prs.some((p) => p.merged))
            publicFiles = new Map([...(await build()).files, ...protectedFiles]);
        },
      }).run();
      if (!result.completed)
        jobError = (await control.get("task-" + task.id)).error;
    }
    const broker = createBroker({
      portalUrl: origin + "/admin/",
      apiOrigin: service,
      ownerUserId: userId,
      ownerGithubId: "123",
      codeSha: api.codeSha,
      workflowSha,
      auth,
      reviews,
      control,
      privateApi: {
        request: async (route, o) => {
          if (route.includes("dispatches")) {
            const value = JSON.parse(o.body);
            pending = pending.then(() => processTask(value.inputs));
            return null;
          }
          return { status: "in_progress" };
        },
      },
      publicApi: {
        request: async () => ({
          encoding: "base64",
          content: api
            .read(".github/public-data-approval.json")
            .toString("base64"),
        }),
      },
      verifyOidc: async () => {
        throw Error("not a browser endpoint");
      },
      leaseTokens: async () => {
        throw Error("not browser credentials");
      },
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    });
    t.after(() => context.close());
    await context.route("**/*", async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (u.origin === service) {
        const res = await broker.fetch(
          new Request(r.url(), {
            method: r.method(),
            headers: await r.allHeaders(),
            ...(r.postData() ? { body: r.postData() } : {}),
          }),
        );
        const headers = Object.fromEntries(res.headers);
        if (u.pathname === "/auth/begin") {
          const upstream = new URL(headers.location);
          headers.location =
            service +
            "/auth/callback?code=synthetic-code&state=" +
            upstream.searchParams.get("state");
        }
        if (headers.location) {
          const location = headers.location;
          delete headers.location;
          headers["content-type"] = "text/html";
          return route.fulfill({
            status: 200,
            headers,
            body:
              "<script>location.replace(" +
              JSON.stringify(location) +
              ")</script>",
          });
        }
        return route.fulfill({
          status: res.status,
          headers,
          body: await res.text(),
        });
      }
      if (
        u.origin === "https://github.com" &&
        u.pathname === "/login/oauth/authorize"
      )
        return route.fulfill({
          status: 303,
          headers: {
            location:
              service +
              "/auth/callback?code=synthetic-code&state=" +
              u.searchParams.get("state"),
          },
        });
      if (u.origin !== origin || r.method() !== "GET") return route.abort();
      const name =
          u.pathname.slice(1) + (u.pathname.endsWith("/") ? "index.html" : ""),
        bytes = publicFiles.get(name);
      if (!bytes) return route.fulfill({ status: 404, body: "Not found" });
      return route.fulfill({
        body:
          name === "admin/index.html"
            ? Buffer.from(
                bytes
                  .toString()
                  .replace(
                    /name="morothon-admin-service" content="[^"]*"/,
                    'name="morothon-admin-service" content="' + service + '"',
                  ),
              )
            : bytes,
        contentType:
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".woff": "font/woff",
            ".ico": "image/x-icon",
          }[path.extname(name)] || "application/octet-stream",
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    if (process.env.MOROTHON_DEBUG_TEST)
      page.on("response", (r) => {
        const u = new URL(r.url());
        if (u.origin === service || u.origin === "https://github.com")
          console.log(r.status(), u.origin + u.pathname);
      });
    async function login() {
      await page.goto(origin + "/admin/#rettelser");
      await page.locator("#resultServiceLogin").click();
      try {
        await page.waitForFunction(
          () =>
            document.querySelector(".local-tag")?.textContent ===
            "Innlogget · Hovedadministrator",
        );
      } catch {
        throw Error(
          "Innlogging stoppet: " +
            (new URL(page.url()).origin + new URL(page.url()).pathname) +
            " / " +
            (await page.locator("body").innerText()).slice(0, 500) +
            " / " +
            errors.join(";"),
        );
      }
      await page.waitForFunction(
        () => document.querySelector("#resultServiceSave")?.disabled === false,
      );
    }
    async function settled(text) {
      try {
        await page.waitForFunction(
          (value) =>
            document
              .querySelector("#resultServiceStatus")
              ?.textContent.includes(value) ||
            document
              .querySelector("#resultServiceStatus")
              ?.textContent.startsWith("Kontrollen stoppet"),
          text,
          { timeout: 100000 },
        );
      } catch {
        throw Error(
          "Ventet på " +
            text +
            ": " +
            (await page.locator("#resultServiceStatus").innerText()) +
            " / " +
            (jobError || ""),
        );
      }
      assert.equal(jobError, undefined, jobError);
      assert.ok(
        (await page.locator("#resultServiceStatus").innerText()).includes(text),
      );
    }
    await login();
    await page.locator('a[href="#deltakere"]').first().click();
    await page.fill("#participantSearch", "Syntetisk Kari Nord");
    await page
      .locator(".participant-row")
      .filter({ has: page.getByText("Syntetisk Kari Nord", { exact: true }) })
      .getByRole("button", { name: "Se historikk", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Rett et resultat", exact: true })
      .click();
    await page.selectOption("#correctionResultChoice", "0");
    await page.fill("#correctionField5", "49:58");
    if (
      (await page.locator("#correctionOtherChoices").getAttribute("open")) ===
      null
    )
      await page.locator("#correctionOtherChoices > summary").click();
    await page.fill(
      "#correctionSource",
      "Syntetisk arrangørbekreftet testkilde",
    );
    await page.fill("#correctionReason", "Kontrollert syntetisk rettelse.");
    await page.click("#resultServiceSave");
    await settled("Lagret utkast");
    assert.equal(api.prs.length, 0);
    await page.waitForFunction(
      () => !document.querySelector("#resultServicePublish").disabled,
    );
    assert.match(await page.locator("#resultService").innerText(), /49:58/);
    assert.deepEqual(
      await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })),
      { local: {}, session: {} },
      "No API or provider credentials persist in browser storage",
    );
    await page.reload();
    await page.locator("#resultServiceLogin").waitFor();
    assert.equal(
      await page.locator("#resultServicePublish").isDisabled(),
      true,
    );
    await login();
    await page.click("#resultServiceLoad");
    await page.waitForFunction(
      () => !document.querySelector("#resultServicePublish").disabled,
    );
    assert.equal(
      await page.evaluate(
        () =>
          MorothonCorrectionWorkspace.exportDraft().cases[0].change.after[5],
      ),
      "49:58",
    );
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1050 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (process.env.MOROTHON_C1_REVIEW_DIR) {
        const out = path.join(process.env.MOROTHON_C1_REVIEW_DIR, "serverless");
        await fs.mkdir(out, { recursive: true });
        await page.screenshot({
          path: path.join(out, "kontrollert-rettelse-" + width + ".png"),
          fullPage: true,
        });
      }
    }
    await page.click("#resultServicePublish");
    await settled("godkjenning");
    assert.equal(api.prs[0].merged, false);
    await page.locator("#resultServicePublicationDetails > summary").click();
    assert.match(await page.getByRole("link", {name:"Åpne nødvendig godkjenning", exact:true}).getAttribute("href"), /github.com\/morothon-no\/historikk\/pull\//);
    needsOwnerReview = false; // Simulated external human approval, never App self-review.
    await page.click("#resultServiceContinue");
    await settled("Publisert og kontrollert");
    await pending;
    assert.equal(api.prs.length, 1);
    assert.equal(
      JSON.parse(api.read("data/history.json")).results[0][5],
      "49:58",
    );
    assert.deepEqual(
      api.read("data/history.json"),
      api.read("public-data/data/history.json"),
    );
    const actual = await context.newPage();
    await actual.goto(origin + "/index.html#lop=MOR-C220001");
    await actual.locator("#panel:not([hidden])").waitFor();
    assert.equal(await actual.evaluate(() => S.results[0][5]), "49:58");
    await actual.close();
    await page
      .getByRole("button", { name: "Trekk tilbake", exact: true })
      .first()
      .click();
    await settled("Lagret utkast");
    await page.waitForFunction(
      () => !document.querySelector("#resultServicePublish").disabled,
    );
    assert.equal(
      await page.locator("#resultServicePublish").innerText(),
      "Bekreft og publiser tilbakeføring",
    );
    assert.equal(
      JSON.parse(api.read("data/history.json")).results[0][5],
      "49:58",
    );
    await page.click("#resultServicePublish");
    await settled("Publisert og kontrollert");
    await pending;
    assert.equal(
      JSON.parse(api.read("data/history.json")).results[0][5],
      "50:00",
    );
    assert.equal(api.prs.length, 2);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      await fs.readFile(path.join(root, "public-data/data/history.json")),
      original,
    );
  },
);
