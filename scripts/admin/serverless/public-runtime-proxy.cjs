"use strict";
// Read-only mirror of a narrowly allowlisted public Pages runtime. It gives
// the protected admin iframe same-origin access without copying admin assets
// to public Pages or requiring any changes to a customer's DNS.
const PUBLIC_ORIGIN = "https://historikk.morothon.no";
const ALLOWED = [
  /^index\.html$/,
  /^public-manifest\.json$/,
  /^build-info\.json$/,
  /^data\/(?:history|badges|honors|volunteers|event-dates)\.json$/,
  /^(?:js|css)\/[a-z0-9][a-z0-9._-]*\.(?:js|css)$/,
  /^assets\/(?:medals\/(?:approved|service|identity|watermarks)|fonts|icons|social)\/[a-z0-9][a-z0-9._-]*\.(?:png|svg|webp|ico|woff2?|txt)$/,
];
const deniedHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function createPublicRuntimeProxy({ publicOrigin = PUBLIC_ORIGIN, fetchImpl = fetch } = {}) {
  const base = new URL(publicOrigin);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash)
    throw Error("Public runtime requires fixed HTTPS site origin");
  return async function proxy(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/site/") || !["GET", "HEAD"].includes(request.method))
      return new Response("Not found", { status: 404, headers: deniedHeaders });
    const name = url.pathname.slice("/site/".length);
    if (name.includes("%") || !ALLOWED.some(pattern => pattern.test(name)))
      return new Response("Not found", { status: 404, headers: deniedHeaders });
    try {
      const target = new URL("/" + name + url.search, base);
      const upstream = await fetchImpl(target, {
        method: request.method, redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "Accept": request.headers.get("accept") || "*/*" },
      });
      const resolved = upstream.url ? new URL(upstream.url) : target;
      if (resolved.protocol !== "https:" ||
          ![base.host, "morothon-no.github.io"].includes(resolved.host) ||
          upstream.status !== 200)
        return new Response("Public runtime unavailable", { status: 502, headers: deniedHeaders });
      const type = upstream.headers.get("content-type") || "application/octet-stream";
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: 200,
        headers: { ...deniedHeaders, "Content-Type": type,
          "X-Robots-Tag": "noindex, nofollow" },
      });
    } catch {
      return new Response("Public runtime unavailable", { status: 502, headers: deniedHeaders });
    }
  };
}
module.exports = { createPublicRuntimeProxy };
