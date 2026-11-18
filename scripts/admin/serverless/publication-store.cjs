// Immutable compressed payloads avoid rewriting full backup bytes at every poll.
"use strict";
const { gzipSync, gunzipSync } = require("node:zlib"),
  { sha } = require("./github-store.cjs");
function publicationStore({ metadata, payloads }) {
  const cache = new Map(),
    fields = ["before", "after", "otherFiles", "draft", "build"];
  async function hydrate(record) {
    if (!record?.publication?.payloadId) return record;
    const r = structuredClone(record),
      id = r.publication.payloadId;
    let p = cache.get(id);
    if (!p) {
      const blob = await payloads.get(id);
      if (!blob || blob.sha256 !== id || sha(blob.data) !== blob.encodedSha256)
        throw Error("Publiseringsbackupen er endret.");
      p = JSON.parse(
        gunzipSync(Buffer.from(blob.data, "base64"), {
          maxOutputLength: 16 * 1024 * 1024,
        }),
      );
      if (sha(p) !== id)
        throw Error("Publiseringsbackupens kontrollsum er feil.");
      cache.set(id, p);
    }
    delete r.publication.payloadId;
    Object.assign(r.publication, structuredClone(p));
    if (r.draftRef) {
      r.draft = structuredClone(p.draft);
      delete r.draftRef;
    }
    return r;
  }
  return {
    get: async (id) => hydrate(await metadata.get(id)),
    transact: async (id, expected, update) => {
      const old = await metadata.get(id);
      if ((old?.revision || 0) !== expected)
        throw Error("Publiseringen er endret.");
      const next = update(await hydrate(old)),
        stored = structuredClone(next);
      if (stored.publication) {
        const p = Object.fromEntries(
            fields.map((k) => [k, stored.publication[k]]),
          ),
          payloadId = sha(p);
        if (!cache.has(payloadId)) {
          const existing = await payloads.get(payloadId);
          if (!existing) {
            const data = gzipSync(JSON.stringify(p)).toString("base64");
            await payloads.transact(payloadId, 0, () => ({
              v: 1,
              revision: 1,
              sha256: payloadId,
              encodedSha256: sha(data),
              data,
            }));
          }
          cache.set(payloadId, p);
        }
        for (const field of fields) delete stored.publication[field];
        stored.publication.payloadId = payloadId;
        delete stored.draft;
        stored.draftRef = true;
      }
      await metadata.transact(id, expected, () => stored);
      return next;
    },
  };
}
module.exports = { publicationStore };
