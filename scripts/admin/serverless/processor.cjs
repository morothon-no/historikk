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
const {isPrivateIdentityTask}=require('./identity-command.cjs');
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
const snapshotStages=new Set(['main-ref','source-version','main-protection','main-ci','approved-files','approval-variables']);
function failureDiagnostic(error){
  const parts=[];
  if(['SOURCE_VERSION','PROTECTION_STRICT','PROTECTION_ADMINS','PROTECTION_REVIEWS','PROTECTION_CHECKS','PROTECTION_BYPASS','MAIN_CI'].includes(error?.publicSnapshotReason))
    parts.push(error.publicSnapshotReason);
  if([400,401,403,404,409,422,429,500,502,503].includes(error?.githubStatus))parts.push('GITHUB_HTTP_'+error.githubStatus);
  if(['ENOENT','EACCES','EPERM'].includes(error?.code))parts.push('FILESYSTEM_'+error.code);
  if(error?.message==='Chromium-sandbox kunne ikke bekreftes.')parts.push('BROWSER_SANDBOX_UNCONFIRMED');
  return parts.length?parts.join(' '):null;
}
function reportFailure(error,write=message=>console.error(message)){
  const diagnostic=failureDiagnostic(error);
  if(diagnostic)write('Privat prosessorkontroll: '+diagnostic);
  write('Privat prosessorfase: '+safeStage);
  write('Privat kontroll feilet før fullføring. Ingen vellykket publisering er meldt.');
}
async function leaseFailureDiagnostic(response) {
  try {
    const reader=response.body?.getReader();if(!reader)return null;
    const chunks=[];let size=0;
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>2048){await reader.cancel();return null;}
      chunks.push(Buffer.from(value));
    }
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!['LEASE_TASK_READ','LEASE_TASK_BINDING','LEASE_TASK_CLAIM','LEASE_TOKEN_ISSUE','LEASE_PRIVATE_TOKEN','LEASE_PUBLIC_TOKEN'].includes(data.diagnostic))return null;
    return data.diagnostic+
      (['GITHUB_INSTALLATION_TOKEN','GITHUB_STATE_WRITE','GITHUB_STATE_READ','GITHUB_REPOSITORY_METADATA','GITHUB_OTHER'].includes(data.githubOperation)?' '+data.githubOperation:'')+
      ([400,401,403,404,409,422,429,500,502,503].includes(data.githubStatus)?' upstream HTTP '+data.githubStatus:'')+
      (data.reasonCode==='TOKEN_PERMISSIONS'?' TOKEN_PERMISSIONS':'');
  }catch{return null;}
}
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
    const diagnostic=await leaseFailureDiagnostic(r);
    if(diagnostic)console.error("Privat prosessor: "+diagnostic);
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
    annualImports=githubStore({api:privateApi,key,repositoryId:lease.privateRepositoryId,prefix:'annual-imports'}),
    annualRequests=githubStore({api:privateApi,key,repositoryId:lease.privateRepositoryId,prefix:'annual-requests'}),
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
  let projector,projectorPromise;
  try {
    safeStage = 'public-snapshot';
    const privateIdentity=isPrivateIdentityTask(lease.task),
      onStage=stage=>{if(snapshotStages.has(stage))safeStage='public-snapshot/'+stage;};
    const snapshot = privateIdentity ? await adapter.readApprovedSource({onStage}) : await adapter.snapshot({
        requireGreen: !['continue','identity-publication-continue','annual-publication-continue'].includes(lease.task.action),
        onStage,
      }),
      data = path.join(directory, "package");
    safeStage='public-package-write';
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
    safeStage='public-package-build';
    const built = await buildSite(path.join(directory, "site"), {
        dataDir: data,
        approvalFile,
      });
    safeStage='public-runtime-validation';
    const runtime = await approvedRuntime(built.out, approvalFile);
    // Annual plans do not render diplomas or publish; use their existing row
    // engine directly, without starting an unrelated browser projection.
    async function requireProjector(){
      if(!projectorPromise)projectorPromise=(async()=>{
        safeStage='browser-start';projector=await createProjector(runtime);
        safeStage='browser-sandbox';await projector.checkSandbox();
        safeStage='private-decision';return projector;
      })();
      return projectorPromise;
    }
    // Distinct/deferred decisions need no rendering. A merge still invokes the
    // same consequence engine and must pass sandbox verification before use.
    if(!privateIdentity&&!['annual-preview','annual-save'].includes(lease.task.action))await requireProjector();
    const driver = createDriver({
      lease,
      reviews,
      identities,
      annualImports,
      annualRequests,
      control,
      stateStore,
      directory,
      adapter,
      loadContext: async () => ({ ...runtime, project: privateIdentity ? async history=>(await requireProjector()).project(history) : projector?.project,
        organizer:'sogne-morothon',personIdPrefix:'MOR-',
        profile:JSON.parse(await fs.readFile(path.resolve(__dirname,'../../../web-admin/event-profile.json'),'utf8')),
        registry:JSON.parse(runtime.files.get('data/badges.json')),
        honors:JSON.parse(runtime.files.get('data/honors.json')),volunteers:JSON.parse(runtime.files.get('data/volunteers.json')) }),
      verifyLive: projector?createDeploymentVerifier({verifyProfiles:projector.verifyProfiles}):undefined,
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
module.exports = { main, leaseFailureDiagnostic, failureDiagnostic, reportFailure };
if (require.main === module)
  main().catch(error => {
    reportFailure(error);
    process.exitCode = 1;
  });
