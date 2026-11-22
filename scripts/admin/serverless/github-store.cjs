// Hosting-independent encrypted CAS storage. GitHub is only this adapter.
"use strict";
const {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createSign,
} = require("node:crypto");
const sha = (v) =>
  createHash("sha256")
    .update(
      Buffer.isBuffer(v)
        ? v
        : Buffer.from(typeof v === "string" ? v : JSON.stringify(v)),
    )
    .digest("hex");
const copy = (v) => (v === null ? null : structuredClone(v));
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
function apiOperation(route,method='GET') {
  const p='/'+route.replace(/^\//,'');
  if(/^\/app\/installations\/\d+\/access_tokens$/.test(p))return 'GITHUB_INSTALLATION_TOKEN';
  if(p.includes('/contents/.morothon-state/'))return method==='PUT'?'GITHUB_STATE_WRITE':'GITHUB_STATE_READ';
  if(/^\/repos\/[^/]+\/[^/?#]+$/.test(p))return 'GITHUB_REPOSITORY_METADATA';
  return 'GITHUB_OTHER';
}
function seal(key, name, value) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from("morothon-serverless-v1:" + name));
  const bytes = Buffer.concat([
    c.update(Buffer.from(JSON.stringify(value))),
    c.final(),
  ]);
  return Buffer.from(
    JSON.stringify({
      v: 1,
      iv: iv.toString("base64"),
      tag: c.getAuthTag().toString("base64"),
      data: bytes.toString("base64"),
    }),
  );
}
function unseal(key, name, bytes) {
  const e = JSON.parse(Buffer.from(bytes)),
    d = createDecipheriv("aes-256-gcm", key, Buffer.from(e.iv, "base64"));
  if (e.v !== 1) throw fail("Ukjent privat lagringsformat.");
  d.setAAD(Buffer.from("morothon-serverless-v1:" + name));
  d.setAuthTag(Buffer.from(e.tag, "base64"));
  return JSON.parse(
    Buffer.concat([d.update(Buffer.from(e.data, "base64")), d.final()]),
  );
}
function connection({
  repository,
  appId,
  installationId,
  privateKey,
  permissions,
  verifyPermissions = false,
  fetchImpl = fetch,
  clock = Date.now,
}) {
  if (
    !/^[a-z\d-]+\/[a-z\d._-]+$/i.test(repository || "") ||
    !/^\d+$/.test(appId || "") ||
    !/^\d+$/.test(installationId || "")
  )
    throw fail("GitHub-forbindelsen er ikke konfigurert.", 503);
  let cached;
  async function http(url, options, token) {
    let r;
    try {
      r = await fetchImpl("https://api.github.com" + url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Morothon-admin",
          Authorization: "Bearer " + token,
          ...options?.headers,
        },
      });
    } catch {
      throw fail(
        "GitHub kunne ikke nås. Kontroller status før nytt forsøk.",
        502,
      );
    }
    if (r.status === 404 && options?.allow404) return null;
    if (!r.ok)
      throw Object.assign(fail(
        r.status === 409 || r.status === 422
          ? "Arbeidet er endret. Hent siste versjon."
          : "GitHub avviste forespørselen.",
        r.status === 409 || r.status === 422 ? 409 : 502,
      ), { githubStatus: r.status, githubOperation: apiOperation(url,options?.method) });
    return r.status === 204
      ? null
      : options?.raw
        ? Buffer.from(await r.arrayBuffer())
        : r.json();
  }
  async function token() {
    if (cached && cached.until > clock() + 60000) return cached.value;
    const p = (v) => Buffer.from(JSON.stringify(v)).toString("base64url"),
      now = Math.floor(clock() / 1000),
      body =
        p({ alg: "RS256", typ: "JWT" }) +
        "." +
        p({ iat: now - 30, exp: now + 540, iss: appId }),
      s = createSign("RSA-SHA256");
    s.update(Buffer.from(body));
    const jwt = body + "." + s.sign(privateKey, "base64url"),
      r = await http(
        "/app/installations/" + installationId + "/access_tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repositories: [repository.split("/")[1]],
            permissions,
          }),
        },
        jwt,
      );
    if (
      typeof r?.token !== "string" ||
      !Number.isFinite(Date.parse(r.expires_at))
    )
      throw fail("GitHub-token kunne ikke bekreftes.", 502);
    if (verifyPermissions && (!r.permissions ||
        Object.entries(permissions).some(([name,level])=>r.permissions[name]!==level) ||
        Object.keys(r.permissions).some(name=>!Object.hasOwn(permissions,name)&&
          !(name==='metadata'&&r.permissions[name]==='read'))))
      throw Object.assign(fail("GitHub-tokenets rettigheter kunne ikke bekreftes.",502),
        {githubFailure:'TOKEN_PERMISSIONS'});
    cached = { value: r.token, until: Date.parse(r.expires_at) };
    return r.token;
  }
  async function request(route, options = {}) {
    if (
      typeof route !== "string" ||
      route.includes("\\") ||
      route.split(/[/?#]/).some((p) => {
        try {
          return decodeURIComponent(p) === "..";
        } catch {
          return true;
        }
      }) ||
      route.startsWith("/")
    )
      throw fail("Ugyldig GitHub-sti.");
    return http(
      "/repos/" + repository + (route ? "/" + route : ""),
      options,
      await token(),
    );
  }
  return { request, token, repository };
}
function tokenConnection(repository, token, fetchImpl = fetch) {
  if (!/^[a-z\d-]+\/[a-z\d._-]+$/i.test(repository || "") || !token)
    throw fail("Ugyldig GitHub-forbindelse.");
  return {
    repository,
    token: async () => token,
    request: async (route, o = {}) => {
      if (
        typeof route !== "string" ||
        route.startsWith("/") ||
        route.split(/[/?#]/).some((p) => {
          try {
            return decodeURIComponent(p) === "..";
          } catch {
            return true;
          }
        }) ||
        route.includes("\\")
      )
        throw fail("Ugyldig privat lagringssti.");
      const method = o.method || "GET";
      let r;
      try {
        r = await fetchImpl(
          "https://api.github.com/repos/" +
            repository +
            (route ? "/" + route : ""),
          {
            method,
            redirect: "error",
            signal: AbortSignal.timeout(20000),
            headers: {
              Accept: o.raw
                ? "application/vnd.github.raw+json"
                : "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "Morothon-admin",
              Authorization: "Bearer " + token,
              ...(o.body ? { "Content-Type": "application/json" } : {}),
              ...o.headers,
            },
            ...(o.body
              ? {
                  body:
                    typeof o.body === "string"
                      ? o.body
                      : JSON.stringify(o.body),
                }
              : {}),
          },
        );
      } catch {
        throw Object.assign(
          fail(
            "GitHub kunne ikke nås. Kontroller status før nytt forsøk.",
            502,
          ),
          { uncertain: method !== "GET" },
        );
      }
      if (r.status === 404 && o.allow404) return null;
      if (!r.ok)
        throw Object.assign(
          fail(
            r.status === 409 || r.status === 422
              ? "Arbeidet er endret."
              : "GitHub avviste forespørselen.",
            r.status === 409 || r.status === 422 ? 409 : 502,
          ),
          { githubStatus: r.status, githubOperation: apiOperation(route,method) },
        );
      try {
        return r.status === 204
          ? null
          : o.raw
            ? Buffer.from(await r.arrayBuffer())
            : await r.json();
      } catch {
        throw Object.assign(
          fail("GitHub returnerte et uleselig svar. Kontroller status.", 502),
          { uncertain: method !== "GET" },
        );
      }
    },
  };
}
function githubStore({
  api,
  key,
  prefix = "state",
  branch = "admin-state",
  repositoryId,
  maxBytes = 8 * 1024 * 1024,
}) {
  if (
    !Buffer.isBuffer(key) ||
    key.length !== 32 ||
    !/^[-a-z]+$/.test(prefix) ||
    branch !== "admin-state"
  )
    throw fail("Privat lagring krever en separat 256-bit nøkkel.");
  const name = (id) => {
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(id || ""))
      throw fail("Ugyldig privat nøkkel.");
    return ".morothon-state/" + prefix + "/" + id + ".aesgcm";
  };
  async function privateRepo() {
    const r = await api.request("");
    if (
      r?.private !== true ||
      r.full_name !== api.repository ||
      r.default_branch !== "main" ||
      (repositoryId && String(r.id) !== String(repositoryId))
    )
      throw fail(
        "Privat lagring er sperret: repositoryet må være privat med main.",
        503,
      );
  }
  async function read(id) {
    await privateRepo();
    const path = name(id),
      m = await api.request(
        "contents/" + path + "?ref=" + encodeURIComponent(branch),
        { allow404: true },
      );
    if (!m) return { value: null, sha: null };
    if (
      m.type !== "file" ||
      !/^[a-f0-9]{40}$/.test(m.sha) ||
      m.size > maxBytes * 2
    )
      throw fail("Ugyldig privat lagringsfil.");
    const bytes =
      m.encoding === "base64"
        ? Buffer.from(m.content, "base64")
        : await api.request(
            "contents/" + path + "?ref=" + encodeURIComponent(branch),
            {
              raw: true,
              headers: { Accept: "application/vnd.github.raw+json" },
            },
          );
    return { value: unseal(key, path, bytes), sha: m.sha };
  }
  async function get(id) {
    return copy((await read(id)).value);
  }
  async function transact(id, expected, update) {
    if (!Number.isSafeInteger(expected) || expected < 0)
      throw fail("Ugyldig revisjon.");
    const old = await read(id);
    if ((old.value?.revision || 0) !== expected)
      throw fail("Arbeidet er endret. Hent siste versjon.", 409);
    const next = update(copy(old.value));
    if (!next || next.revision !== expected + 1)
      throw fail("Ugyldig privat revisjon.");
    const bytes = seal(key, name(id), next);
    if (bytes.length > maxBytes * 2) throw fail("Arbeidet er for stort.");
    const write = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Morothon: privat arbeidsrevisjon",
        branch,
        content: bytes.toString("base64"),
        ...(old.sha ? { sha: old.sha } : {}),
      }),
    };
    // Contents writes share a Git branch, even across independent records.
    // Retry only a definite upstream 409 after verifying that the exact target
    // has NOT changed. A newer revision (even identical desired contents) must
    // still fail: OAuth handoffs and other one-use transitions depend on CAS.
    // Reuse the same mutation and ciphertext; never replay an uncertain write.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await api.request("contents/" + name(id), write);
        return copy(next);
      } catch (error) {
        if (attempt === 2 || error.githubStatus !== 409 ||
            error.githubOperation !== 'GITHUB_STATE_WRITE' || error.uncertain === true)
          throw error;
        const current = await read(id);
        if (current.sha !== old.sha || (current.value?.revision || 0) !== expected ||
            JSON.stringify(current.value) !== JSON.stringify(old.value))
          throw fail("Arbeidet er endret. Hent siste versjon.", 409);
      }
    }
  }
  return { get, transact };
}
module.exports = {
  sha,
  seal,
  unseal,
  connection,
  tokenConnection,
  githubStore,
  fail,
};
