// Fictional people, credentials and encrypted temporary files only.
'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const {randomBytes} = require('node:crypto');
const {createIdentityReview, identityReviewStore, privateIdentityFileStore, SCOPE} = require('../scripts/admin/identity-review.cjs');
const {privateFileStore} = require('../scripts/admin/review-workspace.cjs');
const {createResultReview} = require('../scripts/admin/result-review.cjs');
const {githubStore,sha} = require('../scripts/admin/serverless/github-store.cjs');
const {project} = require('./helpers/result-publication.cjs');
const C = require('../tools/diploma-admin/intake-model.js').Corrections;
const H = require('../js/history-data.js');
const sample = require('./public/quick/fixtures/corrections-data.js');
const org = 'synthetic-race', ids = ['MOR-C220001','MOR-C220002'];

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'identity-synthetic-'));
  t.after(() => fs.rm(directory,{recursive:true,force:true}));
  const key = randomBytes(32), history = sample.history();
  const context = {history, base:await C.binding(history,sample.meta), project, linkedRunnerIds:[]};
  const principal = (subject, role) => ({subject, roles:{[org]:role},
    organizers:{[org]:role === 'owner' ? ['review','approve'] : ['review']}});
  const sessions = new Map([['owner',principal('11111111-1111-4111-8111-111111111111','owner')],
    ['editor',principal('22222222-2222-4222-8222-222222222222','editor')],
    ['viewer',principal('33333333-3333-4333-8333-333333333333','viewer')]]);
  const store = privateIdentityFileStore({directory,key});
  const options = {authenticate:async s => sessions.get(s), loadContext:async () => context, store};
  const input = {session:'owner', organizer:org, expectedRevision:0};
  const command = (kind = 'same-person', overrides = {}) => ({format:'morothon-identity-decision-v1', version:1,
    id:'synthetic-decision', base:structuredClone(context.base), kind, personIds:ids.slice(),
    mainPersonId:kind === 'same-person' ? ids[1] : null, name:null,
    source:'Syntetisk arrangørbekreftelse 1', reason:'Testkilde og identitet er kontrollert.', ...overrides});
  return {directory,key,history,context,store,options,input,command,sessions,service:createIdentityReview(options)};
}

test('identity merge is previewed by the existing engine, encrypted, reopened in a fresh service and never published', async t => {
  const f = await setup(t), original = structuredClone(f.history), command = f.command();
  const preview = await f.service.preview({...f.input,command});
  assert.equal(preview.persisted,false); assert.equal((await f.service.load(f.input)).revision,0);
  const impact = preview.review.impacts[0], candidate = impact.candidate, model = H.create(candidate);
  assert.equal(preview.review.ready,true);
  assert.equal(model.person(ids[0]).i,ids[1]); assert.equal(model.person(ids[1]).n,f.history.people[1].n);
  assert.deepEqual(model.stats(ids[1]).years,[2020,2021,2022,2023,2024]);
  assert.ok(candidate.aliases[ids[1]].includes(f.history.people[0].n));
  assert.equal(model.resolve('MOR-OLD2201'),ids[1]);
  assert.deepEqual(candidate.results,original.results); assert.deepEqual(candidate.people,original.people);
  assert.deepEqual(impact.changes.map(c => c.area),['people','annual','records','placements','rankings','diplomas','loyalty','redirects','aliases']);
  const saved = await f.service.decide({...f.input,command});
  assert.equal(saved.persisted,true); assert.equal(saved.status,'draft'); assert.equal(saved.productionApplied,false);
  const filename = path.join(f.directory,SCOPE,org+'.review.aesgcm'), encrypted = await fs.readFile(filename);
  assert.equal(encrypted.includes(Buffer.from('Syntetisk')),false); assert.equal(encrypted.includes(Buffer.from(ids[0])),false);
  assert.equal((await fs.stat(filename)).mode & 0o077,0);
  const reopened = createIdentityReview({...f.options,store:privateIdentityFileStore({directory:f.directory,key:f.key})});
  const loaded = await reopened.load({...f.input,session:'editor'});
  assert.equal(loaded.revision,1); assert.equal(loaded.counts.processed,1); assert.equal(loaded.approval,null);
  assert.equal(loaded.draft.cases[0].change.kind,'merge');
  assert.equal(loaded.draft.cases[0].change.personIds[1],ids[1]);
  assert.equal(loaded.events[0].actor,f.sessions.get('owner').subject);
  assert.equal(loaded.publicationAuthorized,false); assert.equal('publish' in reopened,false); assert.equal('apply' in reopened,false);
  assert.deepEqual(f.history,original);
});

test('batch saves two distinct-person decisions in one atomic private revision', async t => {
  const f=await setup(t);
  const first=f.command('different-people',{id:'session-first'});
  const second=f.command('different-people',{
    id:'session-second',personIds:['MOR-C220003','MOR-C220004']});
  const result=await f.service.decideBatch({...f.input,commands:[first,second]});
  assert.equal(result.revision,1);
  assert.equal(result.batchCount,2);
  assert.equal(result.persisted,true);
  assert.equal(result.productionApplied,false);
  const fresh=createIdentityReview({...f.options,
    store:privateIdentityFileStore({directory:f.directory,key:f.key})});
  const loaded=await fresh.load(f.input);
  assert.equal(loaded.counts.rejected,2);
  assert.equal(loaded.counts.unprocessed,0);
  assert.equal(loaded.draft.cases.length,2);
  assert.equal(loaded.approval,null);
});

test('batch validation failure cannot write partial identity decisions', async t => {
  const f=await setup(t);
  const first=f.command('different-people',{id:'valid-first'});
  const conflict=f.command('same-person',{id:'conflicting-second',
    personIds:['MOR-C220003','MOR-C220004'],mainPersonId:'MOR-C220004'});
  await assert.rejects(()=>f.service.decideBatch({...f.input,commands:[first,conflict]}),/Overlapp/);
  assert.equal((await f.service.load(f.input)).revision,0);
  assert.equal(await f.store.get(org),null);
});

test('distinct identities suppress exactly the saved pair across reload; other candidates remain unprocessed', async t => {
  const f = await setup(t), before = await f.service.load(f.input);
  const saved = await f.service.decide({...f.input,command:f.command('different-people')});
  const loaded = await createIdentityReview(f.options).load(f.input);
  assert.equal(loaded.counts.rejected,1); assert.equal(loaded.counts.processed,0);
  assert.equal(loaded.counts.unprocessed,before.counts.unprocessed-1);
  const pair = loaded.worklist.identity.find(c => c.personIds.includes(ids[0]));
  assert.equal(pair.caseStatus,'rejected'); assert.equal(pair.bucket,'finished');
  assert.equal(loaded.draft.cases[0].change,null); assert.equal(saved.revision,1);
  assert.deepEqual((await C.applyCandidate(f.history,loaded.draft,f.context.base)).history,f.history);
});

test('identical repeated commands are idempotent, including reversed pair order; reused IDs and conflicting decisions fail closed', async t => {
  const f = await setup(t), command = f.command('different-people');
  await f.service.decide({...f.input,command});
  const again = await f.service.decide({...f.input,command:{...command,personIds:ids.slice().reverse()}});
  assert.equal(again.repeated,true); assert.equal(again.revision,1); assert.equal(again.events.length,1);
  await assert.rejects(() => f.service.decide({...f.input,command:{...command,reason:'Endret grunn.'}}),/Saks-ID/);
  await assert.rejects(() => f.service.decide({...f.input,expectedRevision:1,command:f.command('same-person',{id:'contradiction'})}),/allerede vurdert/);
  assert.equal((await f.service.load(f.input)).revision,1);
});

test('owner approval binds exact saved digest and revision; edits invalidate approval and editor/viewer cannot approve', async t => {
  const f = await setup(t), saved = await f.service.decide({...f.input,command:f.command()});
  const input = {...f.input,expectedRevision:1,expectedDigest:saved.digest};
  for (const session of ['editor','viewer']) await assert.rejects(() => f.service.approve({...input,session}),/Ingen tilgang/);
  await assert.rejects(() => f.service.approve({...input,expectedDigest:'f'.repeat(64)}),/annen revisjon/);
  const approved = await f.service.approve(input);
  assert.equal(approved.status,'review-approved'); assert.equal(approved.revision,2);
  assert.equal(approved.productionApplied,false); assert.equal(approved.publicationAuthorized,false);
  const repeated = await f.service.decide({...f.input,command:f.command()});
  assert.equal(repeated.revision,2); assert.equal(repeated.status,'review-approved');
  const saved2 = await f.service.decide({...f.input,expectedRevision:2,command:f.command('different-people',
    {id:'second-pair',personIds:['MOR-C220003','MOR-C220004']})});
  const loaded = await f.service.load(f.input);
  assert.equal(saved2.status,'draft'); assert.equal(loaded.approval,null);
  assert.deepEqual(loaded.events.map(e => e.action),['draft-saved','review-approved','draft-saved']);
  await assert.rejects(() => f.service.approve(input),/annen revisjon/);
});

test('authentication, server-side organizer roles and module separation are mandatory before context or storage access', async t => {
  const f = await setup(t); let reads = 0;
  const secure = createIdentityReview({...f.options,loadContext:async () => { reads++; return f.context; }});
  for (const session of ['missing',f.sessions.get('owner')])
    await assert.rejects(() => secure.load({...f.input,session}),/Ingen tilgang/);
  await assert.rejects(() => secure.load({...f.input,organizer:'another-race'}),/Ingen tilgang/);
  await assert.rejects(() => secure.decide({...f.input,session:'viewer',command:f.command()}),/Ingen tilgang/);
  assert.equal(reads,0);
  assert.throws(() => createIdentityReview({...f.options,store:privateFileStore({directory:f.directory,key:f.key})}),/separat privat/);
  assert.throws(() => identityReviewStore(),/navnerom/);
  const empty = await secure.load(f.input); assert.equal(empty.persisted,false); assert.equal(empty.status,'empty');
});

test('identity namespace cannot overwrite result drafts or another organizer; encrypted backup restores decisions', async t => {
  const f = await setup(t), raw = privateFileStore({directory:f.directory,key:f.key});
  const result = createResultReview({...f.options,store:raw});
  await f.service.decide({...f.input,command:f.command('different-people')});
  assert.equal((await result.load(f.input)).status,'empty');
  assert.equal(await raw.get(org),null); assert.equal(await f.store.get('another-race'),null);
  const backup = await fs.readFile(path.join(f.directory,SCOPE,org+'.review.aesgcm'));
  const restore = path.join(f.directory,'restore'); await fs.mkdir(path.join(restore,SCOPE),{recursive:true,mode:0o700});
  await fs.writeFile(path.join(restore,SCOPE,org+'.review.aesgcm'),backup,{mode:0o600});
  const restored = createIdentityReview({...f.options,store:privateIdentityFileStore({directory:restore,key:f.key})});
  assert.deepEqual((await restored.load(f.input)).draft,(await f.service.load(f.input)).draft);
  const wrongKey = createIdentityReview({...f.options,store:privateIdentityFileStore({directory:restore,key:randomBytes(32)})});
  await assert.rejects(() => wrongKey.load(f.input),/auth|authenticate|Unsupported state/i);
  // A wrong namespace mapping must refuse a result envelope, never overwrite it.
  const mixed = identityReviewStore({openNamespace:() => ({get:async () => ({module:'result-review'}),transact(){}})});
  await assert.rejects(() => mixed.get(org),/annen modul/);
});

test('concurrent writers use CAS; failed persistence never returns a saved receipt or drops previous decisions', async t => {
  const f = await setup(t), a = f.command('different-people'), b = f.command('different-people',
    {id:'other-case',personIds:['MOR-C220003','MOR-C220004']});
  const results = await Promise.allSettled([f.service.decide({...f.input,command:a}), f.service.decide({...f.input,command:b})]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(results.filter(r => r.status === 'rejected').length,1);
  const loaded = await f.service.load(f.input); assert.equal(loaded.revision,1); assert.equal(loaded.draft.cases.length,1);
  const missing = loaded.draft.cases[0].id === a.id ? b : a;
  f.store.transact = async () => { throw Error('Syntetisk lagringsbrudd'); };
  await assert.rejects(() => f.service.decide({...f.input,expectedRevision:1,command:missing}),/lagringsbrudd/);
  assert.equal((await f.service.load(f.input)).revision,1);
});

test('the existing encrypted GitHub adapter supports isolated identity namespaces without new services or network calls', async t => {
  const f = await setup(t), files = new Map(); let isPrivate = true;
  const api = {repository:'synthetic-org/private-state',request:async (route, options = {}) => {
    if (!route) return {private:isPrivate,full_name:'synthetic-org/private-state',default_branch:'main',id:123};
    const name = route.replace(/^contents\//,'').split('?')[0];
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body), before = files.get(name);
      assert.equal(body.branch,'admin-state'); assert.equal(before?.sha,body.sha);
      const bytes = Buffer.from(body.content,'base64');
      files.set(name,{type:'file',encoding:'base64',sha:sha(bytes).slice(0,40),size:bytes.length,content:body.content});
      return {};
    }
    assert.match(route,/\?ref=admin-state$/); return structuredClone(files.get(name) || null);
  }};
  const open = () => identityReviewStore({openNamespace:scope => {
    assert.equal(scope,SCOPE);
    return githubStore({api,key:f.key,prefix:'identity-reviews',repositoryId:123});
  }});
  await createIdentityReview({...f.options,store:open()}).decide({...f.input,command:f.command('different-people')});
  const loaded = await createIdentityReview({...f.options,store:open()}).load(f.input);
  assert.equal(loaded.counts.rejected,1);
  assert.deepEqual([...files.keys()],['.morothon-state/identity-reviews/'+org+'.aesgcm']);
  const ciphertext = Buffer.from([...files.values()][0].content,'base64');
  assert.equal(ciphertext.includes(Buffer.from(ids[0])),false);
  assert.equal(await githubStore({api,key:f.key,prefix:'reviews',repositoryId:123}).get(org),null);
  isPrivate = false;
  await assert.rejects(() => createIdentityReview({...f.options,store:open()}).load(f.input),/privat/);
});

test('changed result versions retain stable negative identity evidence, but never silently carry merge approval', async t => {
  const f = await setup(t); await f.service.decide({...f.input,command:f.command('different-people')});
  f.history.results[0][5] = '49:20';
  f.context.base = await C.binding(f.history,{...sample.meta,dataVersion:3});
  const loaded = await f.service.load(f.input);
  assert.equal(loaded.stale,true); assert.equal(loaded.requiresSourceReview,true);
  assert.equal(loaded.counts.rejected,1); assert.equal(loaded.revision,1);
  assert.equal(loaded.worklist.identity.find(c => c.personIds.includes(ids[0])).bucket,'finished');
  await assert.rejects(() => f.service.decide({...f.input,expectedRevision:1,command:f.command()}),/Foreldet/);
  await assert.rejects(() => f.service.approve({...f.input,expectedRevision:1,expectedDigest:loaded.digest}),/Foreldet/);
  assert.equal((await f.store.get(org)).draft.base.dataVersion,2);
  f.history.aliases[ids[0]].push(f.history.people[1].n);
  f.context.base = await C.binding(f.history,{...sample.meta,dataVersion:4});
  const changed = await f.service.load(f.input);
  assert.equal(changed.worklist.identity.find(c => c.personIds.includes(ids[0])).bucket,'pending');
  assert.equal((await f.store.get(org)).revision,1);
});

test('rename and alias commands preserve ID and original names without merging or changing results', async t => {
  for (const kind of ['rename','alias']) {
    const f = await setup(t), command = f.command(kind,{personIds:[ids[0]],name:'Syntetisk Kari Vestvik'});
    const saved = await f.service.decide({...f.input,command}); assert.equal(saved.review.ready,true);
    const loaded = await f.service.load(f.input), candidate = (await C.applyCandidate(f.history,loaded.draft,f.context.base,{preview:true})).history;
    assert.deepEqual(candidate.results,f.history.results); assert.deepEqual(candidate.redirects,f.history.redirects);
    assert.equal(candidate.people[0].i,ids[0]);
    if (kind === 'rename') { assert.equal(candidate.people[0].n,command.name); assert.ok(candidate.aliases[ids[0]].includes(f.history.people[0].n)); }
    else { assert.equal(candidate.people[0].n,f.history.people[0].n); assert.ok(candidate.aliases[ids[0]].includes(command.name)); }
  }
});

test('result changes, imported approval flags, unknown fields and non-canonical or missing people are rejected', async t => {
  const f = await setup(t);
  for (const bad of [f.command('result'), {...f.command(),approval:{by:'forged'}}, {...f.command(),draft:{}},
    f.command('same-person',{mainPersonId:'MOR-UNKNOWN'}), f.command('same-person',{personIds:[ids[0],'MOR-OLD2201'],mainPersonId:ids[0]}),
    f.command('different-people',{source:''}), f.command('different-people',{reason:'<script>'}),
    f.command('same-person',{id:'../bad'})])
    await assert.rejects(() => f.service.decide({...f.input,command:bad}));
  assert.equal((await f.service.load(f.input)).revision,0);
});

test('same-year collisions and contradictory identities cannot pass the established merge engine', async t => {
  const f = await setup(t);
  await assert.rejects(() => f.service.decide({...f.input,command:f.command('same-person',
    {personIds:['MOR-C220003','MOR-C220004'],mainPersonId:'MOR-C220004'})}),/Overlapp/);
  f.history.people[1].g = 'Dame'; f.context.base = await C.binding(f.history,sample.meta);
  await assert.rejects(() => f.service.decide({...f.input,command:f.command()}),/Motstridende/);
  assert.equal((await f.service.load(f.input)).revision,0);
});

test('same-year same-distance different times suppress automatic merge even with historical event label mismatch', async t => {
  const f = await setup(t);
  // Preserve a valid historical registration but emulate renamed event labels.
  f.history.results[3][0] = 2020;
  f.history.results[3][5] = '51:00';
  f.history.results[3][2] = 'Langmoro';
  // The other profile uses a source event label distinct from Langmoro.
  assert.notEqual(f.history.results[0][2], f.history.results[3][2]);
  assert.equal(C.discover(f.history).some(s=>s.personIds.includes(ids[0])&&s.personIds.includes(ids[1])), false);
});

test('explicit distinct decisions also persist when automatic suggestions were suppressed by same-year times', async t => {
  const f = await setup(t);
  f.history.results[3][0] = 2020; f.history.results[3][5] = '51:00';
  f.context.base = await C.binding(f.history,sample.meta);
  assert.equal(C.discover(f.history).some(s => s.personIds.includes(ids[0])),false);
  await f.service.decide({...f.input,command:f.command('different-people')});
  // A subsequent corrected time does not constitute new identity evidence.
  f.history.results[3][5] = '50:00'; f.context.base = await C.binding(f.history,{...sample.meta,dataVersion:3});
  assert.equal(C.discover(f.history).some(s => s.personIds.includes(ids[0])),true);
  const loaded = await createIdentityReview(f.options).load(f.input);
  assert.equal(loaded.worklist.identity.find(c => c.personIds.includes(ids[0])).bucket,'finished');
  assert.equal(loaded.counts.rejected,1); assert.equal(loaded.revision,1);
});

test('new relevant identity evidence reopens only that pair; a contrary decision needs a new documented reason', async t => {
  const f = await setup(t); await f.service.decide({...f.input,command:f.command('different-people')});
  // Reading current evidence does not silently rebase the stored workspace.
  const record = await f.store.get(org);
  f.history.aliases[ids[0]].push(f.history.people[1].n);
  f.context.base = await C.binding(f.history,sample.meta);
  const loaded = await f.service.load(f.input);
  assert.ok(loaded.worklist.identity.some(c => c.personIds.includes(ids[0]) && c.bucket === 'pending'));
  assert.deepEqual((await f.store.get(org)),record);
  await assert.rejects(() => f.service.decide({...f.input,expectedRevision:1,command:f.command('same-person',
    {id:'new-evidence',source:'Syntetisk ny kilde',reason:'Ny kontrollert identitetsopplysning.'})}),/Foreldet/);
});

test('a stale saved merge remains visible for revalidation, never finished or automatically approved on a newer source', async t => {
  const f = await setup(t), saved = await f.service.decide({...f.input,command:f.command()});
  await f.service.approve({...f.input,expectedRevision:1,expectedDigest:saved.digest});
  f.context.base = await C.binding(f.history,{...sample.meta,dataVersion:3});
  const loaded = await f.service.load(f.input);
  assert.equal(loaded.stale,true); assert.equal(loaded.counts.processed,0);
  assert.equal(loaded.worklist.identity.find(c => c.personIds.includes(ids[0])).bucket,'followup');
  assert.equal(loaded.revision,2); assert.equal(loaded.productionApplied,false);
  assert.equal(loaded.approval.base.dataVersion,2); assert.equal(loaded.draft.base.dataVersion,2);
});

test('same-year starts in different events and linked Heder profiles stay drafts requiring manual review', async t => {
  for (const condition of ['same-year','heder']) {
    const f = await setup(t);
    if (condition === 'same-year') { f.history.results[3][0] = 2020; f.history.results[3][2] = 'Morothon'; f.history.results[3][3] = '20 km'; }
    else f.context.linkedRunnerIds = [ids[0]];
    f.context.base = await C.binding(f.history,sample.meta);
    const saved = await f.service.decide({...f.input,command:f.command()});
    assert.equal(saved.review.ready,false); assert.equal(saved.status,'draft');
    assert.match(saved.review.impacts.flatMap(i => i.uncertain).join(' '),condition === 'heder' ? /Heder/ : /samme år/);
    await assert.rejects(() => f.service.approve({...f.input,expectedRevision:1,expectedDigest:saved.digest}),/avklaring/);
    assert.equal((await f.service.load(f.input)).approval,null);
  }
});

test('source or membership changes during computation stop persistence; source snapshot mismatch fails closed', async t => {
  for (const condition of ['source','access','snapshot']) {
    const f = await setup(t), original = f.context.project;
    if (condition === 'snapshot') f.context.base.snapshotSha256 = 'e'.repeat(64);
    else f.context.project = async history => { const value = await original(history);
      if (condition === 'source') f.context.base = {...f.context.base,dataVersion:3};
      else f.sessions.delete('owner'); return value; };
    await assert.rejects(() => f.service.decide({...f.input,command:f.command()}),/oppdatert|Ingen tilgang|kildebinding/);
    assert.equal(await f.store.get(org),null);
  }
});

test('distinct identities cannot be merged indirectly through a third profile', async t => {
  const f = await setup(t), third = 'MOR-C220003';
  await f.service.decide({...f.input,command:f.command('different-people')});
  await f.service.decide({...f.input,expectedRevision:1,command:f.command('same-person',
    {id:'intermediate-merge',personIds:[ids[0],third],mainPersonId:third})});
  const original = await f.service.load(f.input);
  await assert.rejects(() => f.service.decide({...f.input,expectedRevision:2,command:f.command('same-person',
    {id:'forbidden-transitive-merge',personIds:[ids[1],third],mainPersonId:third})}),/lagret beslutning/);
  assert.deepEqual((await f.service.load(f.input)).draft,original.draft);
  assert.equal((await f.service.load(f.input)).revision,2);
});

test('a new organizer starts with an empty worklist, without Morothon seeds or implicit decisions', async t => {
  const f = await setup(t);
  Object.assign(f.history,{people:[],results:[],aliases:{},redirects:{}});
  f.context.base = await C.binding(f.history,sample.meta);
  const loaded = await f.service.load(f.input);
  assert.equal(loaded.persisted,false); assert.equal(loaded.draft,null);
  assert.deepEqual(loaded.counts,{unprocessed:0,processed:0,rejected:0});
  assert.deepEqual(loaded.worklist,{identity:[],reports:[]});
  assert.equal(await f.store.get(org),null);
});

test('source revalidation requires exact owner approval, archives merges and approvals, and carries only unchanged distinct evidence', async t=>{
 const f=await setup(t);
 const first=await f.service.decide({...f.input,command:f.command()});
 const second=await f.service.decide({...f.input,expectedRevision:first.revision,command:f.command('different-people',
  {id:'different-secondary',personIds:['MOR-C220003','MOR-C220004']})});
 await f.service.approve({...f.input,expectedRevision:second.revision,expectedDigest:second.digest});
 const previous=await f.service.load(f.input);
 f.history.results[0][5]='49:20';f.context.base=await C.binding(f.history,{...sample.meta,dataVersion:3});
 const input={...f.input,expectedRevision:previous.revision,expectedDigest:previous.digest};
 await assert.rejects(()=>f.service.revalidate({...input,session:'editor'}),/Ingen tilgang/);
 await assert.rejects(()=>f.service.revalidate({...input,expectedDigest:'e'.repeat(64)}),/endret/);
 const rebased=await f.service.revalidate(input);
 assert.equal(rebased.stale,false);assert.equal(rebased.approval,null);assert.equal(rebased.status,'draft');
 assert.equal(rebased.draft.cases.length,1);assert.equal(rebased.draft.cases[0].status,'rejected');
 assert.equal(rebased.archives.length,1);assert.deepEqual(rebased.archives[0].draft,previous.draft);
 assert.deepEqual(rebased.archives[0].approval,previous.approval);
 assert.equal(rebased.events.at(-1).actor,f.sessions.get('owner').subject);
 await assert.rejects(()=>f.service.revalidate(input),/endret/);
});

test('new identity evidence is never silently carried into a refreshed source and inspection cannot authorize a stale revision', async t=>{
 const f=await setup(t);await f.service.decide({...f.input,command:f.command('different-people')});
 const previous=await f.service.load(f.input);
 f.history.aliases[ids[0]].push(f.history.people[1].n);f.context.base=await C.binding(f.history,{...sample.meta,dataVersion:3});
 const rebased=await f.service.revalidate({...f.input,expectedRevision:1,expectedDigest:previous.digest});
 assert.equal(rebased.draft.cases.length,0);assert.equal(rebased.archives[0].draft.cases[0].status,'rejected');
 assert.ok(rebased.worklist.identity.some(c=>c.personIds.includes(ids[0])&&c.bucket==='pending'));
 await assert.rejects(()=>f.service.inspect({...f.input,expectedRevision:1,expectedDigest:previous.digest}),/endret/);
 assert.equal(rebased.publicationAuthorized,false);assert.equal(rebased.productionApplied,false);
});
