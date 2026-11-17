// Single API boundary for the local portal. All future identity/authorization
// middleware belongs in front of this handler, never in client navigation.
const fs = require('node:fs/promises');
const { timingSafeEqual } = require('node:crypto');
function createApi({ token, getOrigin, getWorker, getPortal, assertSnapshot, getHonorView, searchHonorRunner, getHonorDrafts, isHonorEnabled=()=>true }) {
  let busy = false; const jobs = new Map();
  return async function handleApi(req, res, url) {
    const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    // This is the existing local anti-CSRF capability, NOT user authentication.
    const supplied = Buffer.from(req.headers['x-morothon-token'] || '');
    if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return send(403, { error: 'Ugyldig lokal økt. Last siden på nytt.' });
    const worker = getWorker(), portal = getPortal(), route = url.pathname;
    if (!worker || !portal) return send(503, { error: 'Administrasjonen starter. Prøv igjen om litt.' });
    await assertSnapshot();
    const honorRoute=route==='/api/honors'||route.startsWith('/api/honors/');
    if(honorRoute&&!getHonorView?.()?.enabled)return send(404,{error:'Heder-modulen er ikke aktiv.'});
    if (req.method === 'GET') {
      if (route === '/api/catalog') return send(200, { people: isHonorEnabled()?worker.catalog:worker.catalog.filter(p=>p.kind!=='honor'), maxItems: 100, honorEnabled:isHonorEnabled() });
      if (route === '/api/overview') return send(200, {...portal.overview(),honorEnabled:isHonorEnabled()});
      if (route === '/api/participants') return send(200, portal.participants(url.searchParams));
      if (route === '/api/badges') return send(200, portal.badgeList(url.searchParams));
      if(route==='/api/honors/drafts'){
        if([...url.searchParams.keys()].length)return send(400,{error:'Ukjente søkefelt.'});
        return getHonorDrafts?.()?send(200,getHonorDrafts().pending()):send(404,{error:'Utkast er ikke tilgjengelig.'});
      }
      // Heder admin data are approved-public-derived and deliberately allowlisted.
      // Route exists ONLY on the local loopback process, behind its session token.
      if (route === '/api/honors' || route === '/api/honors/runner-candidates') {
        const view = getHonorView?.();
        if (!view?.enabled) return send(404, { error: 'Heder-modulen er ikke aktiv.' });
        if (route === '/api/honors') {
          if ([...url.searchParams.keys()].length) return send(400, { error: 'Ukjente søkefelt.' });
          return send(200, view);
        }
        const keys = [...url.searchParams.keys()];
        if (keys.some(k => !['q','personId'].includes(k) || url.searchParams.getAll(k).length !== 1))
          return send(400, { error: 'Ugyldige søkefelt.' });
        const query = url.searchParams.get('q') ?? undefined;
        const personId = url.searchParams.get('personId') ?? undefined;
        if (query !== undefined && query.length > 100) return send(400, { error: 'For langt navn.' });
        try { return send(200, searchHonorRunner({ personId, query })); }
        catch (e) { return send(400, { error: e.message }); }
      }
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
    const draftAction=/^\/api\/honors\/drafts\/(open|preview|keep|discard)$/.exec(route);
    if (req.method !== 'POST' || !draftAction&&!['/api/check', '/api/preview', '/api/export'].includes(route)) return send(404, { error: 'Ukjent handling.' });
    if (req.headers.origin !== getOrigin() || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Handlingen krever en lokal JSON-forespørsel.' });
    if (busy) return send(409, { error: 'En kontroll eller eksport pågår allerede. Vent til den er ferdig.' });
    let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 256 * 1024) return send(413, { error: 'For stor jobb.' }); }
    const input = JSON.parse(body);
    if(!isHonorEnabled()&&Array.isArray(input?.items)&&input.items.some(item=>item?.kind==='honor'))return send(404,{error:'Heder-modulen er ikke aktiv.'});
    if(draftAction){
      if([...url.searchParams.keys()].length)return send(400,{error:'Ukjente søkefelt.'});
      const drafts=getHonorDrafts?.();if(!drafts)return send(404,{error:'Utkast er ikke tilgjengelig.'});
      try{return send(200,await drafts[draftAction[1]](input));}catch(e){return send(400,{error:e.message});}
    }
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
