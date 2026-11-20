// #116 A: private identity decisions, using the existing correction and review engines.
// No HTTP route, source writer, publication permission or browser persistence here.
'use strict';
const path = require('node:path');
const {createHash} = require('node:crypto');
const C = require('../../tools/diploma-admin/intake-model.js').Corrections;
const H = require('../../js/history-data.js');
const {authorize} = require('./access-control.cjs');
const {createReviewService, privateFileStore} = require('./review-workspace.cjs');

const {validateIdentityCommand:command,SCOPE}=require('./serverless/identity-command.cjs');
const scoped = Symbol(SCOPE);
const copy = v => structuredClone(v);
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = message => { throw Error(message); };
const deferred = c => c.status === 'review' && !c.change &&
  c.events.filter(e => /^identity-(defer|same-person|different-people)$/.test(e.action)).at(-1)?.action === 'identity-defer';

// A trusted server factory opens a physically separate namespace in an existing
// encrypted CAS adapter. Never use an organizer ID as a pseudo-module/tenant ID.
function identityReviewStore({openNamespace} = {}) {
  if (typeof openNamespace !== 'function') fail('Separat privat navnerom for Personkontroll er påkrevd.');
  const backing = openNamespace(SCOPE);
  if (!backing || typeof backing.get !== 'function' || typeof backing.transact !== 'function')
    fail('Kryptert, revisjonsbundet lagringsadapter er påkrevd.');
  function checked(record, organizer) {
    if (record && (record.module !== SCOPE || record.organizer !== organizer || record.status === 'published'))
      fail('Arbeidsgrunnlaget tilhører en annen modul eller arrangør, eller har ugyldig publiseringsstatus.');
    if (record) C.validatePackage(record.draft);
    return record;
  }
  return {
    [scoped]: true,
    get: async organizer => checked(await backing.get(organizer), organizer),
    transact: (organizer, revision, update) => backing.transact(organizer, revision, previous => {
      checked(previous, organizer);
      const next = update(previous);
      return checked({...next,
        ...(next.archives === undefined && previous?.archives ? {archives:copy(previous.archives)} : {}),
        module:SCOPE, organizer}, organizer);
    })
  };
}

function privateIdentityFileStore({directory, key} = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('Angi en absolutt privat lagringsmappe.');
  return identityReviewStore({openNamespace: scope => privateFileStore({directory:path.join(directory, scope), key})});
}


function createIdentityReview({authenticate, loadContext, store, clock} = {}) {
  if (typeof authenticate !== 'function' || typeof loadContext !== 'function' || !store?.[scoped])
    fail('Sikker autentisering, kildegrunnlag og separat privat identitetslager er påkrevd.');
  const service = createReviewService({authenticate, store, clock,
    getTrustedBinding:async organizer => (await loadContext(organizer)).base});
  async function access(input, action) {
    authorize(await authenticate(input.session), input.organizer, action);
  }
  async function context(organizer) {
    const current = await loadContext(organizer);
    C.empty(current.base);
    if (await C.hash(current.history) !== current.base.snapshotSha256) fail('Historikken stemmer ikke med kildebindingen.');
    H.assertValid(current.history);
    return {...current, history:copy(current.history), base:copy(current.base)};
  }
  async function view(current, saved) {
    const draft = saved.draft || C.empty(current.base);
    // Read-only evidence matching is independent of result versions. Never rebase
    // before-values or carry mutation approvals: stale changes return to review.
    const applicable = copy(draft);
    if (saved.stale) for (const c of applicable.cases)
      if (c.change && c.status !== 'rejected') c.status = 'review';
    const worklist = await C.worklist(C.discover(current.history), applicable);
    const identities = worklist.identity;
    return {...saved, scope:SCOPE, persisted:saved.revision > 0,
      digest:saved.draft ? sha(saved.draft) : null, worklist,
      counts:{unprocessed:identities.filter(c => c.bucket === 'pending').length,
        followup:identities.filter(c => c.bucket === 'followup').length,
        processed:identities.filter(c => c.bucket === 'finished' && c.caseStatus !== 'rejected').length,
        rejected:identities.filter(c => c.caseStatus === 'rejected').length},
      requiresSourceReview:saved.stale,
      productionApplied:false, publicationAuthorized:false};
  }
  async function load(input) {
    await access(input, 'read');
    const saved = await service.load(input), current = await context(input.organizer);
    // Re-evaluate staleness after loading context, rather than mixing two snapshots.
    saved.stale = !!saved.draft && !equal(saved.draft.base, current.base);
    const record = await store.get(input.organizer);
    if ((record?.revision || 0) !== saved.revision) fail('Arbeidsgrunnlaget ble endret under lasting. Hent på nytt.');
    return {...await view(current, saved), archives:copy(record?.archives || [])};
  }
  async function checked(current, draft) {
    // The private command API is the only producer. Still downgrade all imported
    // handoff flags and recompute real consequences before any owner approval.
    const parsed = C.parse(C.serialize(draft));
    let normalized = C.importPackage(C.empty(current.base), parsed).package;
    normalized.cases.forEach((c,i) => { c.events = parsed.cases[i].events; });
    if (normalized.cases.some(c => c.change && !['merge','person','alias'].includes(c.change.kind) || c.registration))
      fail('Personkontroll kan ikke inneholde resultatendringer.');
    // A negative constraint also forbids an indirect A -> C <- B merge. Check
    // connectivity before the engine validates individual immutable snapshots.
    const joined = new Map();
    const representative = id => { while (joined.has(id)) id = joined.get(id); return id; };
    for (const c of normalized.cases) if (c.change?.kind === 'merge' && c.status === 'proposed') {
      const [a,b] = c.personIds.map(representative);
      if (a !== b) joined.set(a,b);
    }
    for (const c of normalized.cases) if (c.status === 'rejected' &&
        c.events.some(e => e.action === 'identity-different-people') &&
        representative(c.personIds[0]) === representative(c.personIds[1]))
      fail('Sammenslåingen strider mot en lagret beslutning om forskjellige personer.');
    await C.applyCandidate(current.history, normalized, current.base, {preview:true});
    const active = normalized.cases.filter(c => c.change && c.status === 'proposed');
    const review = {ready:true, uncertain:[], errors:[], impacts:[]};
    if (active.length && typeof current.project !== 'function') fail('Den etablerte konsekvensmotoren mangler.');
    const cache = new Map(), project = async h => {
      const key = await C.hash(h);
      if (!cache.has(key)) cache.set(key, Promise.resolve(current.project(h)));
      return cache.get(key);
    };
    const model = H.create(current.history);
    for (const c of active) {
      const impact = await C.consequences(current.history, normalized, c.id, current.base, project,
        {linkedRunnerIds:current.linkedRunnerIds || []});
      if (c.change.kind === 'merge') {
        const [a,b] = c.personIds, years = new Set(model.stats(a)?.years || []);
        if ((model.stats(b)?.years || []).some(y => years.has(y))) {
          impact.uncertain.push('Begge profilene har starter samme år. Dette må avklares før sammenslåing.');
          impact.ready = false;
        }
      }
      review.impacts.push(impact);
      review.uncertain.push(...impact.uncertain); review.errors.push(...impact.errors);
      if (!impact.ready) review.ready = false;
    }
    // Each impact binds the entire package; transitions only change local status.
    if (review.ready) for (const c of active)
      normalized = C.transition(normalized, c.id, 'handoff', c.reason, review.impacts.find(i => i.caseId === c.id));
    return {draft:normalized, review};
  }
  async function prepare(input, draftOverride = null, reviewCandidate = true) {
    await access(input, 'write');
    const intent = command(input.command), saved = await service.load(input), current = await context(input.organizer);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail('Ugyldig forventet revisjon.');
    if (!equal(intent.base, current.base) || saved.stale) fail('Foreldet identitetsgrunnlag krever ny kildekontroll.');
    const request = 'request-' + sha(intent), requestId = 'request-id-' + sha(intent.id),
      draft = draftOverride || saved.draft || C.empty(current.base);
    const previous = draft.cases.find(c => c.id === intent.id || c.events.some(e => e.action === requestId));
    if (previous) {
      if (!previous.events.some(e => e.action === request)) fail('Saks-ID er allerede brukt for en annen beslutning.');
      return {saved, current, repeated:true, requestId:intent.id};
    }
    if (saved.revision !== input.expectedRevision) fail('Arbeidsgrunnlaget er endret. Hent siste revisjon.');
    const model = H.create(current.history);
    if (intent.personIds.some(id => model.resolve(id) !== id || !model.person(id)))
      fail('Velg eksisterende kanoniske profiler.');
    const suggestions = C.discover(current.history);
    // A manually confirmed distinct pair may be absent from automatic suggestions
    // because of same-year times. Reuse the engine's name evidence, independently
    // of finishes, for this explicit command only; never add automatic proposals.
    const suggestion = suggestions.find(s => equal([...s.personIds].sort(), intent.personIds)) ||
      C.discover({...current.history, results:[]}).find(s => equal([...s.personIds].sort(), intent.personIds));
    const old = draft.cases.filter(c => equal([...c.personIds].sort(), intent.personIds));
    const followup = old.length === 1 && deferred(old[0]) ? old[0] : null;
    if (old.length && !followup) {
      const reviewed = suggestion && (await C.reviewSuggestions([suggestion], draft))[0];
      if (!reviewed || reviewed.caseId || old.some(c => c.status !== 'rejected') ||
          old.some(c => c.source === intent.source || c.reason === intent.reason))
        fail('Identiteten er allerede vurdert. Ny vurdering krever nytt dokumentert identitetsgrunnlag.');
    }
    const caseId = followup?.id || intent.id;
    let next = followup ? copy(draft) : suggestion ? (await C.openSuggestion(draft, suggestion, intent.id)).package :
      C.report(draft, {id:intent.id, category:'Mulige duplikater', personIds:intent.personIds,
        description:intent.reason, source:intent.source});
    if (followup) next.cases.find(c => c.id === caseId).events.push({
      at:new Date(clock ? clock() : Date.now()).toISOString(), action:'identity-followup-reviewed',
      reason:'Tidligere oppfølgingskilde: ' + followup.source
    });
    if (!followup && !suggestion && intent.personIds.length === 2) next.cases.at(-1).events.push({
      at:new Date(clock ? clock() : Date.now()).toISOString(), action:'identity-basis-' + sha({manualPair:intent.personIds}),
      reason:'Manuelt vurdert par uten automatisk navnetreff. Nye navnesignaler krever separat vurdering.'
    });
    next = C.updateNotes(next, caseId, {description:intent.reason, source:intent.source, reason:intent.reason});
    if (intent.kind === 'defer') next = C.transition(next, caseId, 'review', intent.reason);
    else if (intent.kind === 'different-people') next = C.transition(next, caseId, 'rejected', intent.reason);
    else {
      const kind = { 'same-person':'merge', rename:'person', alias:'alias' }[intent.kind];
      const personIds = kind === 'merge' ? [intent.personIds.find(id => id !== intent.mainPersonId), intent.mainPersonId] : intent.personIds;
      const after = kind === 'person' ? {n:intent.name} : kind === 'alias' ?
        [...new Set([...(current.history.aliases?.[personIds[0]] || []), intent.name])] : null;
      next = await C.propose(current.history, next, caseId, {kind, personIds, after, source:intent.source, reason:intent.reason});
    }
    next.cases.find(c => c.id === caseId).events.push({at:new Date(clock ? clock() : Date.now()).toISOString(),
      action:request, reason:'Serverbundet identitetsbeslutning. Ingen publisering.'});
    next.cases.find(c => c.id === caseId).events.push({at:new Date(clock ? clock() : Date.now()).toISOString(),
      action:requestId, reason:'Gjenbruk av kommando-ID med endret innhold er ikke tillatt.'});
    next.cases.find(c => c.id === caseId).events.push({at:new Date(clock ? clock() : Date.now()).toISOString(),
      action:'identity-' + intent.kind, reason:intent.reason});
    return {...(reviewCandidate ? await checked(current, next) : {draft:next}), saved, current, repeated:false, requestId:intent.id};
  }
  async function preview(input) {
    const result = await prepare(input);
    return {...result.repeated ? {repeated:true} : {draft:result.draft, review:result.review},
      persisted:false, productionApplied:false, publicationAuthorized:false};
  }
  async function decide(input) {
    const result = await prepare(input);
    await access(input, 'write'); // Authorization may have changed during calculation.
    if (!equal((await loadContext(input.organizer)).base, result.current.base)) fail('Historikken ble oppdatert under kontrollen.');
    if (result.repeated) return {...await view(result.current, result.saved), repeated:true, requestId:result.requestId};
    const saved = await service.save({...input, draft:result.draft});
    return {...saved, scope:SCOPE, persisted:true, repeated:false, requestId:result.requestId, review:result.review};
  }
  // A whole owner session is one private revision. Every command is checked
  // against the accumulated candidate before the first durable write.
  // If any command fails, not one pair is saved.
  async function decideBatch(input) {
    if(!Array.isArray(input.commands) || input.commands.length<1 || input.commands.length>50)
      fail('Velg mellom 1 og 50 identitetsavgjørelser.');
    const commands=input.commands.map(command),
      caseIds=new Set(),pairs=new Set();
    for(const c of commands) {
      const pair=[...c.personIds].sort().join(':');
      if(caseIds.has(c.id) || pairs.has(pair))
        fail('Samme sak eller par er valgt flere ganger i innsendingen.');
      caseIds.add(c.id);pairs.add(pair);
    }
    let accumulated=null, final=null;
    for(const c of commands) {
      final=await prepare({...input,command:c},accumulated,false);
      if(final.repeated)fail('En avgjørelse finnes allerede. Hent lagrede avgjørelser før ny innsending.');
      accumulated=final.draft;
    }
    // Keep every existing per-case consequence and conflict check, but run them
    // on the complete candidate once. Intermediate packages are never saved.
    const verified=await checked(final.current,accumulated);
    await access(input,'write');
    if(!equal((await loadContext(input.organizer)).base,final.current.base))
      fail('Historikkgrunnlaget endret seg under samlet kontroll.');
    const saved=await service.save({...input,draft:verified.draft});
    return {...saved,scope:SCOPE,persisted:true,batchCount:commands.length,
      productionApplied:false,publicationAuthorized:false,
      review:verified.review};
  }

  async function approve(input) {
    await access(input, 'approve');
    const saved = await service.load(input);
    if (saved.revision !== input.expectedRevision || !saved.draft || sha(saved.draft) !== input.expectedDigest)
      fail('Godkjenningen gjelder en annen revisjon eller kontrollsum.');
    const current = await context(input.organizer);
    if (!equal(saved.draft.base, current.base)) fail('Foreldet identitetsgrunnlag kan ikke godkjennes.');
    const result = await checked(current, saved.draft);
    if (!result.review.ready) fail('Identiteten krever avklaring før godkjenning.');
    await access(input, 'approve');
    return {...await service.approve(input), scope:SCOPE, persisted:true};
  }
  async function inspect(input) {
    await access(input,'read');
    const saved=await service.load(input),current=await context(input.organizer);
    if(!saved.draft||saved.stale||!equal(saved.draft.base,current.base))fail('Hent og kontroller oppdatert identitetsgrunnlag først.');
    if(input.expectedRevision!==undefined&&(saved.revision!==input.expectedRevision||sha(saved.draft)!==input.expectedDigest))
      fail('Arbeidsgrunnlaget er endret. Hent siste revisjon.');
    const result=await checked(current,saved.draft);
    if(!equal((await loadContext(input.organizer)).base,current.base))fail('Historikken ble oppdatert under kontrollen.');
    return {...result,digest:sha(saved.draft),
      productionApplied:false,publicationAuthorized:false};
  }
  async function revalidate(input) {
    await access(input,'approve');
    const current = await context(input.organizer), previous = await store.get(input.organizer);
    if (!previous || previous.revision !== input.expectedRevision || sha(previous.draft) !== input.expectedDigest)
      fail('Arbeidsgrunnlaget er endret. Hent siste revisjon.');
    if (equal(previous.base,current.base)) fail('Arbeidsgrunnlaget bruker allerede gjeldende historikk.');
    const suggestions = C.discover({...current.history,results:[]});
    let draft = C.empty(current.base);
    for (const old of previous.draft.cases) {
      const followup = deferred(old);
      if (!followup && (old.status !== 'rejected' || !old.events.some(e=>e.action === 'identity-different-people'))) continue;
      const suggestion = suggestions.find(s=>equal([...s.personIds].sort(),[...old.personIds].sort()));
      if (!suggestion || (await C.reviewSuggestions([suggestion],previous.draft))[0].caseId !== old.id) continue;
      draft = (await C.openSuggestion(draft,suggestion,old.id)).package;
      draft = C.updateNotes(draft,old.id,{description:old.description,source:old.source,reason:old.reason});
      draft = C.transition(draft,old.id,followup ? 'review' : 'rejected',old.reason);
      draft.cases.at(-1).events.push({at:new Date(clock ? clock() : Date.now()).toISOString(),
        action:followup ? 'identity-defer' : 'identity-different-people',
        reason:followup ? 'Tidligere utsatt sak med uendret identitetsgrunnlag.' : 'Tidligere bekreftet avvisning med uendret identitetsgrunnlag.'});
    }
    const actor = await authenticate(input.session); authorize(actor,input.organizer,'approve');
    if (!equal((await loadContext(input.organizer)).base,current.base)) fail('Historikken ble oppdatert under kontrollen.');
    const at = new Date(clock ? clock() : Date.now()).toISOString();
    await store.transact(input.organizer,input.expectedRevision,record=>{
      if (record.publicationLock || sha(record.draft) !== input.expectedDigest) fail('Arbeidsgrunnlaget er endret eller låst.');
      return {...record,revision:record.revision+1,status:'draft',base:current.base,draft,approval:null,
        archives:[...(record.archives || []),{base:record.base,draft:record.draft,approval:record.approval,
          digest:sha(record.draft),archivedBy:actor.subject,archivedAt:at}],
        events:[...record.events,{action:'identity-source-revalidated',actor:actor.subject,at,
          revision:record.revision+1,digest:sha(draft)}]};
    });
    return load(input);
  }
  return {load, preview, decide, decideBatch, approve, inspect, revalidate}; // No production writer.
}

module.exports = {createIdentityReview, identityReviewStore, privateIdentityFileStore, SCOPE,
  validateIdentityCommand:command};
