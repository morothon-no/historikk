// Small Request/Response broker; heavy result engines run only in an exact private workflow.
"use strict";
const { sha, fail } = require("./github-store.cjs"),
  { token } = require("./auth.cjs");
const C = require("../../../tools/diploma-admin/intake-model.js").Corrections;
const {validateIdentityCommand, SCOPE} = require("./identity-command.cjs");
const ORG = "sogne-morothon",
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  copy = (v) => structuredClone(v);
function createBroker({
  portalUrl,
  apiOrigin,
  ownerUserId,
  ownerGithubId,
  dispatchActorId,
  codeSha,
  workflowSha,
  auth,
  reviews,
  identities,
  control,
  privateApi,
  publicApi,
  verifyOidc,
  leaseTokens,
  rateLimit = async () => true,
  clock = Date.now,
}) {
  const portal = new URL(portalUrl);
  if (
    portal.protocol !== "https:" ||
    !portal.pathname.endsWith("/admin/") ||
    new URL(apiOrigin).origin !== apiOrigin ||
    !/^https:/.test(apiOrigin) ||
    !/^[a-f0-9]{40}$/.test(codeSha) ||
    !/^[a-f0-9]{40}$/.test(workflowSha)
  )
    throw fail("Tjenesten er ikke ferdig konfigurert.", 503);
  const stamp = () => new Date(clock()).toISOString();
  async function base() {
    const f = await publicApi.request(
      "contents/.github/public-data-approval.json?ref=main",
    );
    if (f.encoding !== "base64")
      throw fail("Offentlig godkjenning kunne ikke kontrolleres.", 503);
    const p = JSON.parse(Buffer.from(f.content, "base64"));
    return {
      dataVersion: p.dataVersion,
      manifestSha256: p.manifestSha256,
      historySha256: p.historySha256,
      snapshotSha256: p.historySha256,
    };
  }
  async function queue() {
    return (await control.get("queue-" + ORG)) || null;
  }
  async function active() {
    const q = await queue();
    if (!q?.taskId) return null;
    // Older job IDs were base64url-derived and could contain uppercase letters,
    // which the encrypted GitHub store explicitly rejects as path identifiers.
    // Keep reads available for diagnosis, but never treat the stale queue as idle.
    if (!/^[a-z0-9]{20,32}$/.test(q.taskId))
      return { id: null, state: 'blocked', action: 'unknown', queueRevision: q.revision,
        error: 'En tidligere privat kontrolljobb har en ugyldig referanse. Ingen ny jobb er startet. Kontakt administrator for sikker avklaring.' };
    let task = await control.get("task-" + q.taskId);
    // The private workflow can fail before obtaining an OIDC lease. Its job
    // ID is then absent and the browser must not poll a permanently queued task.
    // Match only a completed failed run with the exact workflow, commit,
    // task title and authorized dispatch actor; never infer successful saving.
    if (task?.state === "queued" && !task.runId &&
        Date.parse(task.createdAt) + 10000 <= clock() && dispatchActorId) {
      try {
        const response = await privateApi.request(
          "actions/workflows/morothon-result-job.yml/runs?event=workflow_dispatch&per_page=30",
        );
        const run = response?.workflow_runs?.find(r =>
          // GitHub REST exposes workflow run-name in BOTH name and display_title.
          // Bind to the task's pinned private workflow commit, including older
          // queued tasks created before an operator-approved pin update.
          r.name === "Morothon task " + task.id &&
          r.display_title === "Morothon task " + task.id &&
          r.path === ".github/workflows/morothon-result-job.yml" &&
          r.head_sha === task.workflowSha &&
          String(r.actor?.id) === String(dispatchActorId) &&
          r.event === "workflow_dispatch" &&
          r.status === "completed" && r.conclusion !== "success");
        if (run) task = await control.transact("task-" + task.id, task.revision, p => ({
          ...p, revision: p.revision + 1, state: "failed",
          error: "Den private kontrolljobben feilet før lagring. Ingen avgjørelse er bekreftet. Kontroller jobbkjøringen før ny innsending.",
        }));
      } catch {
        // A read/discovery error must not approve work or silently reset queue.
      }
    }
    if (task?.state === "running" && task.runId) {
      const run = await privateApi.request("actions/runs/" + task.runId);
      if (run.status === "completed" && run.conclusion !== "success") {
        task = await control.transact(
          "task-" + task.id,
          task.revision,
          (p) => ({
            ...p,
            revision: p.revision + 1,
            state: "failed",
            error: "Kontrollen ble avbrutt. Lagret arbeid er bevart.",
          }),
        );
      }
    }
    return task;
  }
  async function idle() {
    const a = await active();
    if (a && !["completed", "failed"].includes(a.state))
      throw fail("En kontroll pågår. Vent til den er ferdig.", 409);
  }
  async function view() {
    const record = await reviews.get(ORG),
      task = await active(),
      p = await control.get("projection-" + ORG),
      b = await base();
    return {
      revision: record?.revision || 0,
      status: record?.status || "empty",
      reversalOf: record?.reversalOf || null,
      draft: record?.draft || null,
      digest: record?.draft ? sha(record.draft) : null,
      stale: !!record && !same(record.base, b),
      validation:
        p?.validation &&
        p.validation.revision === record?.revision &&
        p.validation.digest === sha(record?.draft)
          ? p.validation
          : null,
      publication: p?.publication || null,
      history: p?.history || [],
      task: task && task.scope !== SCOPE
        ? {
            id: task.id,
            state: task.state,
            action: task.action,
            queueRevision: task.state === 'blocked' ? task.queueRevision : null,
            error: task.error || null,
          }
        : null,
    };
  }
  async function identityView() {
    if (!identities) throw fail("Privat personkontroll er ikke aktivert.", 404);
    const record = await identities.get(ORG), b = await base(), task = await active(),
      inspection = await control.get('identity-inspection-'+ORG);
    if (record && (record.module !== SCOPE || record.organizer !== ORG || record.status === 'published'))
      throw fail("Ugyldig privat identitetsgrunnlag.", 409);
    if (record) C.validatePackage(record.draft);
    return {scope:SCOPE, revision:record?.revision || 0, status:record?.status || 'empty',
      persisted:!!record, draft:record?.draft || null, digest:record?.draft ? sha(record.draft) : null,
      approval:record?.approval || null, events:record?.events || [], archives:record?.archives || [],
      stale:!!record && !same(record.base,b), productionApplied:false, publicationAuthorized:false,
      inspection:record && inspection?.digest===sha(record.draft) && same(inspection.base,b) ? inspection.report : null,
      task:task && (task.scope === SCOPE || task.state === 'blocked') ? {id:task.id,state:task.state,action:task.action,queueRevision:task.queueRevision || null,
        requestId:task.identityCommand?.id || null,requestIds:task.identityCommands?.map(c=>c.id)||null,error:task.error || null} : null};
  }
  async function dispatch(task) {
    await privateApi.request(
      "actions/workflows/morothon-result-job.yml/dispatches",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: "main",
          inputs: { task: task.id, nonce: task.nonce },
        }),
      },
    );
  }
  async function startTask(actor, action, input) {
    await idle();
    const identity = action.startsWith('identity-');
    if (identity && !identities) throw fail("Privat personkontroll er ikke aktivert.",404);
    const record = await (identity ? identities : reviews).get(ORG),
      b = await base();
    let identityCommand,identityCommands;
    if (identity) {
      if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
          (record?.revision || 0) !== input.expectedRevision || record && action !== 'identity-revalidate' && !same(record.base,b))
        throw fail('Identitetsgrunnlaget er endret. Hent siste lagrede vurdering.',409);
      if (record && (record.module !== SCOPE || record.organizer !== ORG))
        throw fail('Feil privat identitetsgrunnlag.',409);
      if (action === 'identity-decide' || action === 'identity-batch') {
        try {
          if(action === 'identity-batch') {
            if(!Array.isArray(input.commands)||input.commands.length<1||input.commands.length>50)
              throw Error('Samlet innsending må ha mellom 1 og 50 avgjørelser.');
            identityCommands=input.commands.map(validateIdentityCommand);
            if(new Set(identityCommands.map(c=>c.id)).size!==identityCommands.length)
              throw Error('Samme saks-ID forekommer flere ganger.');
          } else identityCommand=validateIdentityCommand(input.command);
        } catch (error) { throw fail(error.message,400); }
        if((identityCommands||[identityCommand]).some(c=>!same(c.base,b)))
          throw fail('Historikken er oppdatert. Last inn på nytt.',409);
      } else if (!record?.draft || sha(record.draft) !== input.expectedDigest)
        throw fail('Godkjenningen gjelder en annen identitetsrevisjon.',409);
      if (action === 'identity-approve') {
        const inspection=await control.get('identity-inspection-'+ORG);
        if (!inspection?.report.ready || inspection.digest!==input.expectedDigest || !same(inspection.base,b))
          throw fail('Den lagrede identitetsrevisjonen må kontrolleres før godkjenning.',409);
      }
    }
    if (
      !identity && action !== "reverse" &&
      (!record?.draft ||
        record.revision !== input.expectedRevision ||
        sha(record.draft) !== input.expectedDigest ||
        (action !== "continue" && !same(record.base, b)))
    )
      throw fail(
        "Arbeidet eller resultatgrunnlaget er endret. Hent og kontroller på nytt.",
        409,
      );
    if (action === "publish") {
      const p = await control.get("projection-" + ORG);
      if (
        !p?.validation?.ready ||
        p.validation.revision !== record.revision ||
        p.validation.digest !== sha(record.draft) ||
        input.confirmation !== true
      )
        throw fail(
          "Kontroller og bekreft den eksakte rettelsen før publisering.",
          409,
        );
    }
    if (
      action === "reverse" &&
      (!/^[a-f0-9]{64}$/.test(input.publicationId || "") ||
        input.confirmation !== true)
    )
      throw fail("Velg rettelsen som skal trekkes tilbake.");
    const q = await queue(),
      // Lowercase hex is accepted by both the private GitHub store and the
      // processor lease contract. Base64url is not a valid storage identifier.
      id = sha(token()).slice(0, 32),
      task = {
        v: 1,
        revision: 1,
        kind: "task",
        id,
        nonce: token(),
        organizer: ORG,
        actor: actor.subject,
        ownerGithubId,
        action,
        expectedRevision: record?.revision || 0,
        expectedDigest: record?.draft ? sha(record.draft) : null,
        publicationId: input.publicationId || null,
        reversalOf: record?.reversalOf || null,
        state: "queued",
        createdAt: stamp(),
        codeSha,
        workflowSha,
        ...(identity ? {scope:SCOPE,...(identityCommand ? {identityCommand} : {}),...(identityCommands ? {identityCommands} : {})} : {}),
      };
    // Reserve before dispatch; an uncertain response cannot authorize a second task.
    await control.transact("queue-" + ORG, q?.revision || 0, (p) => ({
      v: 1,
      revision: (p?.revision || 0) + 1,
      taskId: id,
    }));
    await control.transact("task-" + id, 0, () => task);
    try {
      await dispatch(task);
    } catch {
      throw fail(
        "Jobben er lagret, men oppstarten kunne ikke bekreftes. Kontroller status før nytt forsøk.",
        503,
      );
    }
    return { queued: true, id };
  }
  async function body(request, keys) {
    const declared = +(request.headers.get("content-length") || 0);
    if (
      declared > 65536 ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw fail("Ugyldig forespørsel.");
    const reader = request.body?.getReader(), chunks = []; let size = 0;
    if (!reader) throw fail("Ugyldig forespørsel.");
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); throw fail("Velg et mindre rettingsutvalg.", 413); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const text = Buffer.concat(chunks).toString('utf8');
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw fail("Ugyldig forespørsel.");
    }
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).sort().join("|") !== keys.slice().sort().join("|")
    )
      throw fail("Uventede felt.");
    return value;
  }
  async function handle(request) {
    const url = new URL(request.url),
      route = url.pathname,
      origin = request.headers.get("origin"),
      cors =
        origin === portal.origin
          ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
          : {};
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      ...cors,
    };
    const json = (code, value) =>
        new Response(JSON.stringify(value), {
          status: code,
          headers: {
            ...headers,
            "Content-Type": "application/json; charset=utf-8",
          },
        }),
      redirect = (value) =>
        new Response(null, {
          status: 303,
          headers: {
            ...headers,
            Location: value.location,
            ...(value.cookie ? { "Set-Cookie": value.cookie } : {}),
          },
        });
    try {
      if (url.origin !== apiOrigin) throw fail("Ugyldig vertsadresse.", 403);
      if (
        !["/health"].includes(route) &&
        request.method !== "OPTIONS" &&
        !(await rateLimit(request, {
          sensitive: [
            "/auth/begin",
            "/auth/exchange",
            "/processor/lease",
          ].includes(route),
        }))
      )
        throw fail("For mange forsøk. Prøv igjen om litt.", 429);
      if (request.method === "OPTIONS") {
        if (origin !== portal.origin) throw fail("Ukjent nettside.", 403);
        return new Response(null, {
          status: 204,
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "600",
          },
        });
      }
      if (route === "/health" && request.method === "GET")
        return json(200, { status: "ok" });
      if (route === "/auth/begin" && request.method === "GET")
        return redirect(await auth.begin(url.searchParams));
      if (route === "/auth/callback" && request.method === "GET") {
        try {
          return redirect(await auth.complete(request, url.searchParams));
        } catch {
          return redirect({
            location: portalUrl + "#morothon-auth-error=denied",
            cookie:
              "__Host-morothon-oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
          });
        }
      }
      if (route === "/processor/lease" && request.method === "POST") {
        if (origin)
          throw fail("Jobbtilgang er ikke en nettleserfunksjon.", 403);
        const proof = await verifyOidc(
            (request.headers.get("authorization") || "").replace(
              /^Bearer /,
              "",
            ),
          ),
          input = await body(request, ["task", "nonce"]);
        if (!/^[A-Za-z0-9]{20,32}$/.test(input.task || ""))
          throw fail("Ukjent jobb.", 403);
        let task = await control.get("task-" + input.task);
        if (
          !task ||
          task.nonce !== input.nonce ||
          task.actor !== ownerUserId ||
          task.ownerGithubId !== ownerGithubId ||
          task.codeSha !== codeSha ||
          task.workflowSha !== workflowSha ||
          !["queued", "running"].includes(task.state) ||
          Date.parse(task.createdAt) + 45 * 60000 < clock() ||
          (task.runId && task.runId !== proof.runId)
        )
          throw fail("Jobben har ikke gyldig eiergodkjenning.", 403);
        if (!task.runId)
          task = await control.transact(
            "task-" + task.id,
            task.revision,
            (p) => ({
              ...p,
              revision: p.revision + 1,
              state: "running",
              runId: proof.runId,
            }),
          );
        return json(200, { task, ...(await leaseTokens(task)) });
      }
      if (origin !== portal.origin)
        throw fail("Åpne tjenesten fra Morothon-admin.", 403);
      if (route === "/auth/exchange" && request.method === "POST")
        return json(
          200,
          await auth.exchange(await body(request, ["code", "verifier"])),
        );
      const actor = await auth.authenticate(request);
      if (actor.subject !== ownerUserId)
        throw fail("Ingen administratortilgang.", 403);
      if (route === "/session" && request.method === "GET")
        return json(200, {
          userId: actor.subject,
          role: "owner",
          canPublish: true,
          identityPersistence: !!identities,
        });
      if (route === "/logout" && request.method === "POST") {
        await body(request, []);
        return json(200, await auth.logout(request));
      }
      if (route === "/review" && request.method === "GET")
        return json(200, await view());
      if (route === '/identity' && request.method === 'GET') return json(200,await identityView());
      if (['/identity/decide','/identity/batch','/identity/approve','/identity/revalidate','/identity/check'].includes(route) && request.method === 'POST') {
        const deciding=route.endsWith('/decide'),batch=route.endsWith('/batch');
        return json(202,await startTask(actor,
          batch?'identity-batch':deciding?'identity-decide':route.endsWith('/revalidate')?'identity-revalidate':route.endsWith('/check')?'identity-check':'identity-approve',
          await body(request,batch?['expectedRevision','commands']:deciding?['expectedRevision','command']:['expectedRevision','expectedDigest'])));
      }
      if (route === "/review/save" && request.method === "POST") {
        await idle();
        const input = await body(request, ["draft", "expectedRevision"]);
        C.validatePackage(input.draft);
        if (
          input.draft.cases.length > 20 ||
          input.draft.cases.some((c) => c.change && c.change.kind !== "result")
        )
          throw fail("Velg bare rettelser av eksisterende resultater.");
        const b = await base();
        if (!same(input.draft.base, b))
          throw fail(
            "Resultatene er oppdatert. Last inn og kontroller på nytt.",
            409,
          );
        const result = await reviews.transact(
          ORG,
          input.expectedRevision,
          (p) => {
            if (p?.publicationLock)
              throw fail("En publisering må avklares først.", 409);
            return {
              v: 1,
              revision: input.expectedRevision + 1,
              status: "draft",
              base: b,
              draft: copy(input.draft),
              approval: null,
              events: [
                ...(p?.events || []),
                { action: "draft-saved", actor: actor.subject, at: stamp() },
              ],
            };
          },
        );
        return json(200, {
          revision: result.revision,
          digest: sha(result.draft),
          saved: true,
        });
      }
      if (route === "/review/discard" && request.method === "POST") {
        await idle();
        const input = await body(request, ["expectedRevision"]),
          b = await base();
        const r = await reviews.transact(ORG, input.expectedRevision, (p) => {
          if (p?.publicationLock)
            throw fail(
              "Publiseringen må avklares før utkastet forkastes.",
              409,
            );
          return {
            v: 1,
            revision: input.expectedRevision + 1,
            status: "draft",
            base: b,
            draft: C.empty(b),
            approval: null,
            events: [
              ...(p?.events || []),
              { action: "draft-discarded", actor: actor.subject, at: stamp() },
            ],
          };
        });
        return json(200, { revision: r.revision, discarded: true });
      }
      const action = {
        "/review/validate": "validate",
        "/publication/publish": "publish",
        "/publication/continue": "continue",
        "/publication/reverse": "reverse",
      }[route];
      if (action && request.method === "POST") {
        const keys =
          action === "reverse"
            ? ["publicationId", "confirmation"]
            : action === "publish"
              ? ["expectedRevision", "expectedDigest", "confirmation"]
              : ["expectedRevision", "expectedDigest"];
        return json(
          202,
          await startTask(actor, action, await body(request, keys)),
        );
      }
      if (route === "/task/recover-invalid" && request.method === "POST") {
        // The old base64url identifier cannot address any encrypted job file:
        // private store paths accept lowercase letters/numbers only. Recovery
        // must be an explicit owner action; never automatically clear queues.
        const input = await body(request, ["expectedRevision", "confirmation"]),
          q = await queue();
        if (input.confirmation !== true ||
            !Number.isSafeInteger(input.expectedRevision) ||
            input.expectedRevision < 1 ||
            q?.revision !== input.expectedRevision ||
            typeof q.taskId !== "string" ||
            /^[a-z0-9]{20,32}$/.test(q.taskId))
          throw fail("Ingen ugyldig jobbpeker kan ryddes. Hent ny status.", 409);
        await control.transact("queue-" + ORG, q.revision, (p) => {
          if (!p || p.taskId !== q.taskId)
            throw fail("Jobbpekeren er endret. Hent ny status.", 409);
          return { ...p, revision: p.revision + 1, taskId: null,
            recovery: { at: stamp(), by: actor.subject, reason: "invalid-legacy-job-id",
              oldIdDigest: sha(q.taskId) } };
        });
        return json(200, { recovered: true, publicationApplied: false });
      }
      if (route === "/task/cancel" && request.method === "POST") {
        const input = await body(request, ["id", "confirmation"]),
          q = await queue(),
          task =
            q?.taskId === input.id && (await control.get("task-" + input.id));
        if (
          input.confirmation !== true ||
          !task ||
          task.runId ||
          task.state !== "queued"
        )
          throw fail(
            "En startet jobb må avklares gjennom lagret publiseringsstatus.",
            409,
          );
        await control.transact("task-" + task.id, task.revision, (p) => ({
          ...p,
          revision: p.revision + 1,
          state: "failed",
          nonce: null,
          error:
            "Oppstarten ble avbrutt av administrator. Ingen ny jobb kan bruke den gamle godkjenningen.",
        }));
        return json(200, { cancelled: true });
      }
      if (route === "/task/retry" && request.method === "POST") {
        const input = await body(request, ["id"]),
          q = await queue(),
          task =
            q?.taskId === input.id && (await control.get("task-" + input.id));
        if (
          !task ||
          task.runId ||
          task.state !== "queued" ||
          Date.parse(task.createdAt) + 45 * 60000 < clock()
        )
          throw fail("Kontroller pågående jobb først.", 409);
        await dispatch(task);
        return json(202, { queued: true, id: task.id });
      }
      throw fail("Handlingen finnes ikke.", 404);
    } catch (error) {
      const status = [400, 401, 403, 404, 409, 413, 429, 503].includes(
        error.status,
      )
        ? error.status
        : 502;
      return json(status, {
        error: [400, 401, 409].includes(status)
          ? error.message
          : status === 403
            ? "Ingen tilgang til denne handlingen."
            : status === 404
              ? "Handlingen finnes ikke."
              : "Tjenesten kunne ikke fullføre kontrollen. Lagret arbeid er bevart.",
      });
    }
  }
  return { fetch: handle };
}
module.exports = { createBroker };
