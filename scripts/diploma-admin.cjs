// C1 local organizer pilot. Never imported by the public builder or a Pages route.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { buildSite, validatePublicSite } = require('./build-site.cjs');
const { runtimeFiles } = require('./lib/runtime-files.cjs');
const { createWorker } = require('../tools/diploma-admin/worker.cjs');
const root = path.resolve(__dirname, '..'), uiRoot = path.join(root, 'tools/diploma-admin');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.pdf': 'application/pdf' };
async function snapshot(files) {
  const hash = createHash('sha256');
  for (const file of files) { hash.update(file + '\0'); hash.update(await fs.readFile(file)); }
  return hash.digest('hex');
}
async function startAdmin({ port = 0, beforeCheck } = {}) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'morothon-c1-')); await fs.chmod(temp, 0o700);
  let worker, origin, busy = false; const token = randomBytes(32).toString('hex'), jobs = new Map();
  const server = http.createServer(async (req, res) => {
    const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    try {
      if (!origin || req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Kun lokal tilgang fra samme adresse er tillatt.' });
      const url = new URL(req.url, origin), route = url.pathname;
      if (route.startsWith('/api/')) {
        const supplied = Buffer.from(req.headers['x-morothon-token'] || '');
        if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return send(403, { error: 'Ugyldig lokal økt.' });
        if (!worker) return send(503, { error: 'Diplomverktøyet starter. Prøv igjen om litt.' });
        if (req.method === 'GET' && route === '/api/catalog') return send(200, { people: worker.catalog, maxItems: 100 });
        const download = route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/(diplomer.pdf|rapport.json)$/);
        if (req.method === 'GET' && download) {
          await assertSnapshot(); const job = jobs.get(download[1]); if (!job) return send(404, { error: 'Ukjent jobb eller økten er avsluttet.' });
          const file = download[2] === 'diplomer.pdf' ? job.pdf : job.reportFile;
          res.setHeader('Content-Disposition', `attachment; filename="morothon-${job.id}-${download[2]}"`);
          res.setHeader('Content-Type', types[path.extname(file)]); return res.end(await fs.readFile(file));
        }
        if (req.method !== 'POST' || !['/api/check', '/api/preview', '/api/export'].includes(route)) return send(404, { error: 'Ukjent handling.' });
        if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Handlingen krever en lokal JSON-forespørsel.' });
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
      }
      if (req.method !== 'GET') return send(405, { error: 'Handling ikke tillatt.' });
      if (route === '/') {
        // The per-session CSRF capability is delivered only to this loopback UI.
        const html = (await fs.readFile(path.join(uiRoot, 'index.html'), 'utf8')).replace('__LOCAL_TOKEN__', token);
        res.setHeader('Content-Type', types['.html']); return res.end(html);
      }
      if (['/admin.js', '/admin.css'].includes(route)) {
        res.setHeader('Content-Type', types[path.extname(route)]); return res.end(await fs.readFile(path.join(uiRoot, route.slice(1))));
      }
      const relative = route.startsWith('/site/') ? route.slice(6) : null;
      if (!siteFiles?.has(relative)) return send(404, { error: 'Filen er ikke tilgjengelig i det lokale verktøyet.' });
      res.setHeader('Content-Type', types[path.extname(relative)] || 'application/octet-stream');
      return res.end(await fs.readFile(path.join(site, relative)));
    } catch (e) { if (!res.headersSent) send(400, { error: e.message }); else res.end(); }
  });
  const site = path.join(temp, 'site'); let siteFiles, originalDigest, inputFiles;
  async function assertSnapshot() {
    if (await snapshot(inputFiles) !== originalDigest) throw Error('Datagrunnlag, mal eller godkjenning er endret. Start verktøyet på nytt og kontroller utvalget igjen.');
  }
  try {
    const result = await buildSite(site), registry = JSON.parse(await fs.readFile(path.join(root, 'public-data/data/badges.json')));
    await validatePublicSite(site); siteFiles = new Set(result.files);
    inputFiles = [...runtimeFiles(registry).filter(f => !f.startsWith('data/')).map(f => path.join(root, f)),
      ...['manifest.json', 'data/history.json', 'data/honors.json', 'data/volunteers.json', 'data/badges.json', 'data/event-dates.json'].map(f => path.join(root, 'public-data', f)),
      path.join(root, '.github/public-data-approval.json'), path.join(root, 'package.json'), path.join(root, 'scripts/diploma-admin.cjs'), ...['engine.js','worker.cjs'].map(f=>path.join(uiRoot,f)), ...result.files.map(f => path.join(site, f))];
    originalDigest = await snapshot(inputFiles);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); origin = `http://127.0.0.1:${server.address().port}`;
    const approved = JSON.parse(await fs.readFile(path.join(root, '.github/public-data-approval.json'), 'utf8'));
    worker = await createWorker({ base: origin, directory: temp, assertSnapshot, beforeCheck,
      source: { manifestSha256: approved.manifestSha256, dataVersion: approved.dataVersion, buildVersion: result.version, snapshotSha256: originalDigest } });
    return { origin, token, worker, site, assertSnapshot,
      async close() { await worker.close(); await new Promise(resolve => server.close(resolve)); await fs.rm(temp, { recursive: true, force: true }); } };
  } catch (e) { if (worker) await worker.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); await fs.rm(temp, { recursive: true, force: true }); throw e; }
}
module.exports = { startAdmin };
if (require.main === module) {
  startAdmin().then(app => {
    console.log(`Morothon diplomverksted: ${app.origin}\nÅpne adressen i nettleseren. Avslutt med Ctrl+C. Ingen data eller godkjenninger endres.`);
    let closing = false; const stop = async () => { if (closing) return; closing = true; await app.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }).catch(e => { console.error('Kunne ikke starte diplomverkstedet: ' + e.message); process.exitCode = 1; });
}
