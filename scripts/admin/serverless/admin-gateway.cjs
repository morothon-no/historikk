"use strict";
// Server-side admin document/asset gate. This module does not expose any
// administrative bytes to callers without an authorized server-side session.
// Deployment MUST separately stop public GitHub Pages from shipping admin files.
const COOKIE = "__Host-morothon-admin";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Vary": "Cookie",
};
const setCookie = (value, age) =>
  COOKIE + "=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" + age;
function getCookie(request) {
  const hits = (request.headers.get("cookie") || "").split(";")
    .map(x => x.trim()).filter(x => x.startsWith(COOKIE + "="));
  if (hits.length !== 1) return null;
  const value = hits[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
function response(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...headers, ...extra } });
}
async function smallJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing request body");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw Error("Request too large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    reader.releaseLock();
  }
}
function loginPage(apiOrigin) {
  // The only anonymous JavaScript is an OAuth bootstrap; no admin app code is delivered.
  const bootstrap = `
(() => {
  "use strict";
  const api = ${JSON.stringify(apiOrigin)};
  const key = "morothon-admin-pkce";
  const status = document.getElementById("status");
  const button = document.getElementById("login");
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
  const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
  const sha = async value => b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
  function fail() {
    sessionStorage.removeItem(key);
    status.textContent = "Innlogging kunne ikke fullføres. Prøv igjen.";
    button.disabled = false;
  }
  async function begin() {
    button.disabled = true;
    try {
      const verifier = random(), state = random(), challenge = await sha(verifier);
      sessionStorage.setItem(key,JSON.stringify({verifier,state,created:Date.now()}));
      const url = new URL("/auth/begin",api);
      url.search = new URLSearchParams({challenge,state}).toString();
      location.assign(url.href);
    } catch { fail(); }
  }
  async function finish() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("morothon-auth") && !params.has("morothon-auth-error")) return;
    history.replaceState(null,"",location.pathname+location.search);
    button.disabled = true;
    try {
      const pending = JSON.parse(sessionStorage.getItem(key)||"null");
      sessionStorage.removeItem(key);
      if (!pending || Date.now()-pending.created>300000 ||
          params.get("state")!==pending.state || !params.get("morothon-auth") ||
          !/^[A-Za-z0-9_-]{43}$/.test(params.get("morothon-auth"))) throw Error("invalid handoff");
      const response = await fetch("/admin/_session",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({code:params.get("morothon-auth"),verifier:pending.verifier})
      });
      if (!response.ok) throw Error("session exchange failed");
      location.replace("/admin/");
    } catch { fail(); }
  }
  button.addEventListener("click",begin);
  finish();
})();
`;
  const safeScript = bootstrap;
  return '<!doctype html><html lang="nb"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>Morothon · Innlogging</title></head>' +
    '<body><main><h1>Morothon administrasjon</h1><p>Logg inn med godkjent GitHub-konto.</p>' +
    '<button id="login" type="button">Logg inn med GitHub</button>' +
    '<p id="status" role="status"></p></main><script>' + safeScript + '</script></body></html>';
}
function createAdminGateway({ portalOrigin, apiOrigin, auth, assetSource,
  rateLimit = async () => true, publicationAccess }) {
  if (new URL(portalOrigin).origin !== portalOrigin ||
      !portalOrigin.startsWith("https://") ||
      new URL(apiOrigin).origin !== apiOrigin || !apiOrigin.startsWith("https://") ||
      typeof auth?.authenticate !== "function" ||
      typeof auth?.exchange !== "function" ||
      typeof auth?.logout !== "function" ||
      typeof assetSource !== "function")
    throw Error("Admin-gateway krever HTTPS, autentisering og privat asset-kilde.");
  return async function handle(request) {
    const url = new URL(request.url);
    if (url.origin !== portalOrigin || !url.pathname.startsWith("/admin/"))
      return response("Not found", 404);
    if (request.method === "OPTIONS") return response("Not found", 404);
    if (request.method === "POST") {
      // Cookie-authenticated operations must never accept cross-origin POST.
      if (request.headers.get("origin") !== portalOrigin)
        return response("Forbidden", 403);
      if (url.pathname === "/admin/_session") {
        if (!(await rateLimit(request))) return response("Too many requests", 429);
        if ((Number(request.headers.get("content-length")) || 0) > 4096)
          return response("Invalid request", 413);
        let input;
        try {
          input = await smallJson(request);
          if (!input || Object.keys(input).sort().join(",") !== "code,verifier")
            throw Error();
        } catch { return response("Invalid request", 400); }
        try {
          const session = await auth.exchange(input);
          if (!/^[A-Za-z0-9_-]{43}$/.test(session.sessionToken))
            throw Error("Invalid session");
          return response(JSON.stringify({ authenticated: true }), 200, {
            "Content-Type": "application/json",
            "Set-Cookie": setCookie(session.sessionToken, 900),
          });
        } catch { return response("Unauthorized", 401); }
      }
      if (url.pathname === "/admin/_logout") {
        const token = getCookie(request);
        if (!token) return response("Unauthorized", 401, { "Set-Cookie": setCookie("", 0) });
        try {
          await auth.logout(new Request(portalOrigin, {
            headers: { authorization: "Bearer " + token },
          }));
        } catch {
          return response("Unauthorized", 401, { "Set-Cookie": setCookie("", 0) });
        }
        return response(JSON.stringify({ loggedOut: true }), 200, {
          "Content-Type": "application/json",
          "Set-Cookie": setCookie("", 0),
        });
      }
      return response("Not found", 404);
    }
    if (request.method !== "GET" && request.method !== "HEAD")
      return response("Method not allowed", 405);
    const publicationProbe = url.pathname === "/admin/_publication-access";
    if (publicationProbe && (!publicationAccess || request.method !== "GET" || url.search))
      return response("Not found", 404);
    if (url.pathname === "/admin/_session" || publicationProbe) {
      // The existing result API consumes a tab-memory bearer token. Expose it
      // only to a browser whose HttpOnly cookie is verified server-side.
      const raw = getCookie(request);
      if (!raw) return response("Unauthorized", 401);
      if (publicationProbe && !(await rateLimit(request))) return response("Too many requests", 429);
      try {
        const actor = await auth.authenticate(new Request(portalOrigin, {
          headers: { authorization: "Bearer " + raw },
        }));
        if (actor?.roles?.["sogne-morothon"] !== "owner")
          return response("Forbidden", 403);
        if (publicationProbe) {
          const result = await publicationAccess().catch(() => ({ stage: "unavailable" }));
          return response(JSON.stringify(result), 200, { "Content-Type": "application/json" });
        }
        return response(request.method === "HEAD" ? null :
          JSON.stringify({ sessionToken: raw }), 200, {
          "Content-Type": "application/json",
        });
      } catch {
        return response("Unauthorized", 401, { "Set-Cookie": setCookie("", 0) });
      }
    }
    const pathname = url.pathname === "/admin/" ? "index.html" :
      url.pathname.slice("/admin/".length);
    // Reserved paths are never served from the asset store.
    if (!pathname || pathname.startsWith("_") ||
        pathname.includes("..") || pathname.includes("%") ||
        !/^[a-zA-Z0-9/_-]+\.(html|js|css|json|svg|png|woff2?)$/.test(pathname))
      return response("Not found", 404);
    const token = getCookie(request);
    if (!token) {
      if (pathname === "index.html")
        return response(request.method === "HEAD" ? null : loginPage(apiOrigin), 200,
          { "Content-Type": "text/html; charset=utf-8" });
      return response("Unauthorized", 401);
    }
    try {
      const actor = await auth.authenticate(new Request(portalOrigin, {
        headers: { authorization: "Bearer " + token },
      }));
      if (actor?.roles?.["sogne-morothon"] !== "owner")
        return response("Forbidden", 403);
    } catch {
      if (pathname === "index.html")
        return response(request.method === "HEAD" ? null : loginPage(apiOrigin), 200,
          { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie("", 0) });
      return response("Unauthorized", 401, { "Set-Cookie": setCookie("", 0) });
    }
    const asset = await assetSource(pathname);
    if (!asset || !asset.bytes) return response("Not found", 404);
    const ext = pathname.slice(pathname.lastIndexOf("."));
    return response(request.method === "HEAD" ? null : asset.bytes, 200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
    });
  };
}
module.exports = { createAdminGateway };
