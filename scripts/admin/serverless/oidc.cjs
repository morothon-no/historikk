// Only an exact, private, reviewed workflow can obtain a short-lived processor lease.
"use strict";
const { createPublicKey, verify } = require("node:crypto");
const { fail } = require("./github-store.cjs");
function oidcVerifier({
  repository,
  repositoryId,
  workflowSha,
  actorId,
  audience,
  fetchImpl = fetch,
  clock = Date.now,
}) {
  let jwks,
    until = 0;
  return async (jwt) => {
    try {
      if (typeof jwt !== "string" || jwt.length > 16000) throw Error();
      const p = jwt.split(".");
      if (p.length !== 3) throw Error();
      const h = JSON.parse(Buffer.from(p[0], "base64url")),
        c = JSON.parse(Buffer.from(p[1], "base64url"));
      if (h.alg !== "RS256" || typeof h.kid !== "string") throw Error();
      if (!jwks || until < clock()) {
        const r = await fetchImpl(
          "https://token.actions.githubusercontent.com/.well-known/jwks",
          { redirect: "error", signal: AbortSignal.timeout(10000) },
        );
        if (!r.ok) throw Error();
        jwks = (await r.json()).keys;
        until = clock() + 300000;
      }
      const key = jwks.find(
        (k) => k.kid === h.kid && k.kty === "RSA" && k.use === "sig",
      );
      if (
        !key ||
        !verify(
          "RSA-SHA256",
          Buffer.from(p[0] + "." + p[1]),
          createPublicKey({ key, format: "jwk" }),
          Buffer.from(p[2], "base64url"),
        )
      )
        throw Error();
      const now = Math.floor(clock() / 1000);
      if (
        c.iss !== "https://token.actions.githubusercontent.com" ||
        c.aud !== audience ||
        !Number.isSafeInteger(c.exp) ||
        c.exp <= now ||
        c.exp > now + 600 ||
        !Number.isSafeInteger(c.iat) ||
        c.iat > now + 30 ||
        c.nbf > now + 30 ||
        c.repository !== repository ||
        String(c.repository_id) !== String(repositoryId) ||
        c.repository_visibility !== "private" ||
        c.ref !== "refs/heads/main" ||
        c.event_name !== "workflow_dispatch" ||
        c.runner_environment !== "github-hosted" ||
        String(c.actor_id) !== String(actorId) ||
        c.workflow_sha !== workflowSha ||
        c.workflow_ref !==
          repository +
            "/.github/workflows/morothon-result-job.yml@refs/heads/main" ||
        !/^\d+$/.test(String(c.run_id))
      )
        throw Error();
      return { runId: String(c.run_id) };
    } catch {
      throw fail(
        "Jobben har ikke bekreftet, privat arbeidsflyt-identitet.",
        403,
      );
    }
  };
}
module.exports = { oidcVerifier };
