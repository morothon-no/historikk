// Single API boundary for the local portal. All future identity/authorization
// middleware belongs in front of this handler, never in client navigation.
const fs = require('node:fs/promises');
const { timingSafeEqual } = require('node:crypto');
function createApi({ token, getOrigin, getWorker, getPortal, assertSnapshot }) {
  let busy = false; const jobs = new Map();
  return async function handleApi(req, res, url) {
    const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    // This is the existing local anti-CSRF capability, NOT user authentication.
    const supplied = Buffer.from(req.headers['x-morothon-token'] || '');
    if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return send(403, { error: 'Ugyldig lokal økt. Last siden på nytt.' });
    const worker = getWorker(), portal = getPortal(), route = url.pathname;
    if (!worker || !portal) return send(503, { error: 'Administrasjonen starter. Prøv igjen om litt.' });
    await assertSnapshot();
    if (req.method === 'GET') {
      if (route === '/api/catalog') return send(200, { people: worker.catalog, maxItems: 100 });
      if (route === '/api/overview') return send(200, portal.overview());
      if (route === '/api/participants') return send(200, portal.participants(url.searchParams));
      if (route === '/api/badges') return send(200, portal.badgeList(url.searchParams));
      if (/^\/api\/participants\/[A-Za-z0-9_-]{1,128}$/.test(route)) {
        try { return send(200, portal.participant(route.slice('/api/participants/'.length))); }
        catch (e) { return send(404, { error: e.message }); }
      }
      const download = route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/(diplomer.pdf|rapport.json)$/);
      if (download) {
        const job = jobs.get(download[1]); if (!job) return send(404, { error: 'Ukjent jobb eller økten er avsluttet.' });
        const file = download[2] === 'diplomer.pdf' ? job.pdf : job.reportFile;
        res.setHeader('Content-Disposition', `attachment; filename="morothon-${job.id}-${download[2]}"`);
        res.setHeader('Content-Type', download[2].endsWith('.pdf') ? 'application/pdf' : 'application/json'); return res.end(await fs.readFile(file));
      }
    }
    if (req.method !== 'POST' || !['/api/check', '/api/preview', '/api/export'].includes(route)) return send(404, { error: 'Ukjent handling.' });
    if (req.headers.origin !== getOrigin() || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Handlingen krever en lokal JSON-forespørsel.' });
    if (busy) return send(409, { error: 'En kontroll eller eksport pågår allerede. Vent til den er ferdig.' });
    let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 256 * 1024) return send(413, { error: 'For stor jobb.' }); }
    const input = JSON.parse(body);
    if (!input || Object.keys(input).some(k => !['items', 'allowControlCopies'].includes(k)) || input.allowControlCopies !== undefined && typeof input.allowControlCopies !== 'boolean') return send(400, { error: 'Ugyldig jobb.' });
    if (route === '/api/preview' && input.items?.length !== 1) return send(400, { error: 'Velg ett diplom for forhåndsvisning.' });
    if (busy) return send(409, { error: 'En annen jobb pågår. Vent til den er ferdig.' });
    busy = true;
    try {
      if (route === '/api/export') {
        const job = await worker.produce(input.items, { allowControlCopies: input.allowControlCopies === true }); jobs.set(job.id, job);
        return send(200, { id: job.id, report: job.report });
      }
      return send(200, await worker.check(input.items, { preview: route === '/api/preview' }));
    } finally { busy = false; }
  };
}
module.exports = { createApi };
