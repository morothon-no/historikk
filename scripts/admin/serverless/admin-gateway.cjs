"use strict";
// Server-side admin document/asset gate. This module does not expose any
// administrative bytes to callers without an authorized server-side session.
// Deployment MUST separately stop public GitHub Pages from shipping admin files.
const { fail } = require("./github-store.cjs");
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
function loginPage() {
  // No admin scripts, private data or protected asset URLs on the public shell.
  return '<!doctype html><html lang="nb"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>Morothon · Innlogging</title></head>' +
    '<body><main><h1>Morothon administrasjon</h1><p>Logg inn med godkjent GitHub-konto.</p>' +
    '<p>Innloggingen startes fra Morothons godkjente OAuth-klient.</p></main></body></html>';
}
function createAdminGateway({ portalOrigin, auth, assetSource }) {
  if (new URL(portalOrigin).origin !== portalOrigin ||
      !portalOrigin.startsWith("https://") ||
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
        if ((Number(request.headers.get("content-length")) || 0) > 4096)
          return response("Invalid request", 413);
        let input;
        try {
          input = await request.json();
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
        return response(request.method === "HEAD" ? null : loginPage(), 200,
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
        return response(request.method === "HEAD" ? null : loginPage(), 200,
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
