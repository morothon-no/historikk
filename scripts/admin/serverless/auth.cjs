// One owner, official GitHub OAuth, persistent one-use handoff, opaque API sessions.
// Browser sessionStorage holds only a one-use PKCE verifier, never an API/GitHub token.
"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { sha, fail } = require("./github-store.cjs");
const token = () => randomBytes(32).toString("base64url"),
  hash = (s) => createHash("sha256").update(Buffer.from(s)).digest("base64url");
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookie = (value, age) =>
  "__Host-morothon-oauth=" +
  value +
  "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
  age;
function createAuth({
  apiOrigin,
  portalOrigin,
  portalUrl = portalOrigin + "/admin/",
  clientId,
  clientSecret,
  accounts,
  store,
  fetchImpl = fetch,
  clock = Date.now,
}) {
  for (const o of [apiOrigin, portalOrigin])
    if (new URL(o).origin !== o || new URL(o).protocol !== "https:")
      throw fail("Innlogging krever eksakte HTTPS-adresser.", 503);
  if (
    new URL(portalUrl).origin !== portalOrigin ||
    !new URL(portalUrl).pathname.endsWith("/admin/")
  )
    throw fail("Ugyldig portaladresse.", 503);
  if (!clientId || !clientSecret || !accounts?.resolveIdentity)
    throw fail("Innlogging er ikke konfigurert.", 503);
  async function provider(url, options) {
    try {
      const r = await fetchImpl(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error();
      return await r.json();
    } catch {
      throw fail("GitHub-innlogging kunne ikke bekreftes.", 502);
    }
  }
  async function begin(params) {
    const challenge = params.get("challenge"),
      clientState = params.get("state");
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(challenge || "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(clientState || "")
    )
      throw fail("Start innloggingen fra Morothon-admin.");
    const state = token(),
      binding = token(),
      verifier = token(),
      id = "flow-" + sha(state);
    await store.transact(id, 0, () => ({
      v: 1,
      revision: 1,
      kind: "flow",
      challenge,
      clientState,
      verifier,
      binding: hash(binding),
      expires: clock() + 300000,
      spent: false,
    }));
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: apiOrigin + "/auth/callback",
      scope: "read:user",
      state,
      code_challenge: hash(verifier),
      code_challenge_method: "S256",
    }).toString();
    return { location: url.href, cookie: cookie(binding, 300) };
  }
  async function complete(request, params) {
    if (
      params.has("error") ||
      [...params.keys()].some((k) => params.getAll(k).length !== 1)
    )
      throw fail("Innloggingen ble avbrutt.");
    const state = params.get("state"),
      code = params.get("code");
    if (!/^[A-Za-z0-9_-]{43}$/.test(state || "") || !code || code.length > 512)
      throw fail("Innloggingen er utløpt.");
    const id = "flow-" + sha(state),
      flow = await store.get(id),
      binding = Object.fromEntries(
        (request.headers.get("cookie") || "")
          .split(";")
          .map((s) => s.trim().split("=")),
      )["__Host-morothon-oauth"];
    if (
      !flow ||
      flow.spent ||
      flow.expires <= clock() ||
      !equal(flow.binding, hash(binding || ""))
    )
      throw fail(
        "Innloggingen gjelder en annen nettleser eller er utløpt.",
        401,
      );
    await store.transact(id, flow.revision, (p) => ({
      ...p,
      revision: p.revision + 1,
      spent: true,
    }));
    const response = await provider(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: apiOrigin + "/auth/callback",
          code_verifier: flow.verifier,
        }),
      },
    );
    if (
      typeof response.access_token !== "string" ||
      !response.access_token ||
      response.access_token.length > 4096
    )
      throw fail("GitHub-innlogging kunne ikke bekreftes.", 401);
    const identity = await provider("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + response.access_token,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Morothon-admin",
        },
      }),
      userId =
        Number.isSafeInteger(identity.id) &&
        accounts.resolveIdentity("github", String(identity.id));
    if (!userId)
      throw fail("GitHub-kontoen har ikke administratortilgang.", 403);
    const codeOut = token();
    await store.transact("handoff-" + sha(codeOut), 0, () => ({
      v: 1,
      revision: 1,
      kind: "handoff",
      userId,
      challenge: flow.challenge,
      expires: clock() + 60000,
      spent: false,
    }));
    return {
      location:
        portalUrl +
        "#" +
        new URLSearchParams({
          "morothon-auth": codeOut,
          state: flow.clientState,
        }),
      cookie: cookie("", 0),
    };
  }
  async function exchange({ code, verifier }) {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(code || "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(verifier || "")
    )
      throw fail("Innloggingen kunne ikke fullføres.", 401);
    const id = "handoff-" + sha(code),
      h = await store.get(id);
    if (
      !h ||
      h.spent ||
      h.expires <= clock() ||
      !equal(h.challenge, hash(verifier)) ||
      !accounts.user(h.userId)?.active
    )
      throw fail("Innloggingen er utløpt eller allerede brukt.", 401);
    await store.transact(id, h.revision, (p) => ({
      ...p,
      revision: p.revision + 1,
      spent: true,
    }));
    const raw = token(),
      sid = "session-" + sha(raw);
    await store.transact(sid, 0, () => ({
      v: 1,
      revision: 1,
      kind: "session",
      userId: h.userId,
      expires: clock() + 15 * 60000,
      touched: clock(),
      revoked: false,
    }));
    return { sessionToken: raw, expires: clock() + 15 * 60000 };
  }
  async function authenticate(request) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
      request.headers.get("authorization") || "",
    );
    if (!match) throw fail("Logg inn for å fortsette.", 401);
    const id = "session-" + sha(match[1]),
      s = await store.get(id),
      user = s && accounts.user(s.userId);
    if (
      !s ||
      s.kind !== "session" ||
      s.revoked ||
      s.expires <= clock() ||
      s.touched + 30 * 60000 <= clock() ||
      !user?.active
    )
      throw fail("Innloggingen er utløpt. Lagret arbeid er bevart.", 401);
    const p = require("../access-control.cjs").membershipPrincipal(
      user,
      accounts.memberships(s.userId),
    );
    if (p.roles["sogne-morothon"] !== "owner")
      throw fail("Ingen administratortilgang.", 403);
    if (clock() - s.touched > 5 * 60000)
      try {
        await store.transact(id, s.revision, (v) => ({
          ...v,
          revision: v.revision + 1,
          touched: clock(),
        }));
      } catch (e) {
        if (e.status !== 409) throw e;
        const fresh = await store.get(id);
        if (fresh.revoked) throw fail("Innloggingen er avsluttet.", 401);
      }
    return { ...p, sessionId: id };
  }
  async function logout(request) {
    const p = await authenticate(request),
      s = await store.get(p.sessionId);
    await store.transact(p.sessionId, s.revision, (v) => ({
      ...v,
      revision: v.revision + 1,
      revoked: true,
    }));
    return { loggedOut: true };
  }
  return { begin, complete, exchange, authenticate, logout };
}
module.exports = { createAuth, token, hash, equal };
