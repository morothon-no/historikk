// Trusted private Actions processor. No public PR job gets these credentials.
"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os");
const { githubStore, tokenConnection } = require("./github-store.cjs"),
  { publicationStore } = require("./publication-store.cjs"),
  { createDriver } = require("./driver.cjs");
const { createGitHubPublisher } = require("../github-result-publisher.cjs"),
  { buildSite } = require("../../build-site.cjs"),
  { approvedRuntime, createProjector } = require("../review-runtime.cjs"),
  { createDeploymentVerifier } = require("../deployment-verifier.cjs");
const C = require("../../../tools/diploma-admin/intake-model.js").Corrections;
const mask = (s) =>
  process.stdout.write(
    "::add-mask::" +
      String(s)
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A") +
      "\n",
  );
let safeStage = 'setup';
async function main(env = process.env) {
  safeStage = 'setup';
  const origin = new URL(env.MOROTHON_BROKER_ORIGIN);
  if (
    env.GITHUB_ACTIONS !== "true" ||
    origin.protocol !== "https:" ||
    origin.origin !== env.MOROTHON_BROKER_ORIGIN ||
    !/^\d+$/.test(env.GITHUB_RUN_ID || "") ||
    !/^[A-Za-z0-9]{20,32}$/.test(env.MOROTHON_TASK || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(env.MOROTHON_TASK_NONCE || "") ||
    !/^[a-f0-9]{40}$/.test(env.MOROTHON_CODE_SHA || "")
  )
    throw Error("Ugyldig privat jobbkontekst.");
  const oidcUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (
    oidcUrl.protocol !== "https:" ||
    !oidcUrl.hostname.endsWith(".actions.githubusercontent.com")
  )
    throw Error("Mangler GitHub OIDC.");
  oidcUrl.searchParams.set("audience", origin.origin + "/processor");
  safeStage = 'github-oidc';
  const oidcResponse = await fetch(oidcUrl, {
    headers: { Authorization: "Bearer " + env.ACTIONS_ID_TOKEN_REQUEST_TOKEN },
    redirect: "error",
  });
  if (!oidcResponse.ok) throw Error("OIDC feilet.");
  const jwt = (await oidcResponse.json()).value;
  mask(jwt);
  safeStage = 'worker-lease';
  const r = await fetch(origin.origin + "/processor/lease", {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + jwt,
    },
    body: JSON.stringify({
      task: env.MOROTHON_TASK,
      nonce: env.MOROTHON_TASK_NONCE,
    }),
  });
  if (!r.ok) {
    // Report only a bounded HTTP status, never the response body or bearer.
    console.error("Privat prosessor: lease HTTP " +
      ([400,401,403,404,409,429,500,502,503].includes(r.status) ? r.status : "other"));
    throw Error("Jobben har ikke gyldig eierautorisasjon.");
  }
  safeStage = 'lease-response';
  const lease = await r.json();
  for (const secret of [
    lease.privateToken,
    lease.publicToken,
    lease.storageKey,
  ])
    mask(secret);
  if (
    lease.task.runId !== env.GITHUB_RUN_ID ||
    lease.codeSha !== env.MOROTHON_CODE_SHA ||
    lease.publicRepository !== "morothon-no/historikk"
  )
    throw Error("Feil betrodd kodeversjon eller jobb.");
  safeStage = 'private-data';
  const privateApi = tokenConnection(
      lease.privateRepository,
      lease.privateToken,
    ),
    publicApi = tokenConnection(lease.publicRepository, lease.publicToken),
    key = Buffer.from(lease.storageKey, "hex"),
    reviews = githubStore({
      api: privateApi,
      key,
      repositoryId: lease.privateRepositoryId,
      prefix: "reviews",
    }),
    identities = githubStore({api:privateApi,key,repositoryId:lease.privateRepositoryId,
      prefix:'identity-reviews'}),
    control = githubStore({
      api: privateApi,
      key,
      repositoryId: lease.privateRepositoryId,
      prefix: "control",
    }),
    stateStore = publicationStore({
      metadata: githubStore({
        api: privateApi,
        key,
        repositoryId: lease.privateRepositoryId,
        prefix: "publication-state",
      }),
      payloads: githubStore({
        api: privateApi,
        key,
        repositoryId: lease.privateRepositoryId,
        prefix: "publication-data",
      }),
    });
  const adapter = createGitHubPublisher({
    api: (route, options) => {
      const prefix = "/repos/" + lease.publicRepository + "/";
      if (!route.startsWith(prefix))
        throw Error("Feil publiseringsrepository.");
      return publicApi.request(route.slice(prefix.length), options);
    },
    codeSha: lease.codeSha,
    appId: lease.appId,
  });
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "morothon-private-job-"),
  );
  await fs.chmod(directory, 0o700);
  let projector;
  try {
    safeStage = 'public-snapshot';
    const snapshot = await adapter.snapshot({
        requireGreen: !['continue','identity-publication-continue'].includes(lease.task.action),
      }),
      data = path.join(directory, "package");
    await fs.mkdir(path.join(data, "data"), { recursive: true });
    for (const name of [
      "history",
      "honors",
      "volunteers",
      "badges",
      "event-dates",
    ])
      await fs.writeFile(
        path.join(data, "data", name + ".json"),
        snapshot.files.get("public-data/data/" + name + ".json"),
      );
    await fs.writeFile(
      path.join(data, "manifest.json"),
      snapshot.files.get("public-data/manifest.json"),
    );
    const approvalFile = path.join(directory, "approval.json");
    await fs.writeFile(
      approvalFile,
      snapshot.files.get(".github/public-data-approval.json"),
    );
    const built = await buildSite(path.join(directory, "site"), {
        dataDir: data,
        approvalFile,
      }),
      runtime = await approvedRuntime(built.out, approvalFile);
    projector = await createProjector(runtime);
    await projector.checkSandbox();
    const driver = createDriver({
      lease,
      reviews,
      identities,
      control,
      stateStore,
      directory,
      adapter,
      loadContext: async () => ({ ...runtime, project: projector.project }),
      verifyLive: createDeploymentVerifier({
        verifyProfiles: projector.verifyProfiles,
      }),
      onPublished: async (job, verified) => {
        const manifest = JSON.parse(verified.files.get("public-manifest.json")),
          base = await C.binding(verified.history, {
            dataVersion: manifest.dataVersion,
            manifestSha256: job.approval.manifestSha256,
            historySha256: manifest.historySha256,
          });
        Object.assign(runtime, {
          files: verified.files,
          history: verified.history,
          base,
        });
        return base;
      },
    });
    safeStage = 'private-decision';
    const result = await driver.run();
    if (!result.completed) process.exitCode = 1;
    console.log(
      result.completed
        ? "Privat kontroll er fullført."
        : "Privat kontroll stoppet; lagret status må gjennomgås.",
    );
  } finally {
    await projector?.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}
module.exports = { main };
if (require.main === module)
  main().catch(() => {
    console.error("Privat prosessorfase: " + safeStage);
    console.error(
      "Privat kontroll feilet før fullføring. Ingen vellykket publisering er meldt.",
    );
    process.exitCode = 1;
  });
