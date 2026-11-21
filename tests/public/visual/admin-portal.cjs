const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { chromium } = require('playwright');
const { startAdmin } = require('../../../scripts/diploma-admin.cjs');
const { createPortalData } = require('../../../tools/diploma-admin/portal-data.cjs');
const root = path.resolve(__dirname, '../../..');
// Public-only CI deliberately omits internal Heder source modules.
const trustedHonorPresent = require('node:fs').existsSync(path.join(root,'data/honors.json'));

let app, browser, out, history, badges;
before(async () => {
  [history, badges] = await Promise.all(['history', 'badges'].map(n => fs.readFile(path.join(root, 'public-data/data', n + '.json'), 'utf8').then(JSON.parse)));
  app = await startAdmin(); browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  out = process.env.MOROTHON_C1_REVIEW_DIR ? path.join(process.env.MOROTHON_C1_REVIEW_DIR, 'portal-c11') : await fs.mkdtemp(path.join(os.tmpdir(), 'morothon-c11-'));
  await fs.mkdir(out, { recursive: true });
});
after(async () => { await browser?.close(); await app?.close(); if (!process.env.MOROTHON_C1_REVIEW_DIR && out) await fs.rm(out, { recursive: true, force: true }); });
const request = route => fetch(app.origin + '/api/' + route, { headers: { 'X-Morothon-Token': app.token } });

async function openHonorDetails(page,id){
 const ids=await page.locator('#'+id).evaluate(el=>{const found=[];for(let n=el;n;n=n.parentElement)if(n.tagName==='DETAILS')found.unshift(n.id);return found;});
 for(const key of ids){const section=page.locator('#'+key);if(!await section.evaluate(e=>e.open))await section.locator(':scope > summary').click();}
}
async function editHonorSection(page,id,label){await openHonorDetails(page,id);await page.locator('#'+id).getByRole('button',{name:label,exact:true}).click();}

test('C1.1 portal derives current edition, participation, milestones, canonical identities and historical badges from the shared data model', async () => {
  const baseline=require('../quick/fixtures/frozen-history.js')(root),p = createPortalData({ history:baseline, badges, honorCount: 43 }), overview = p.overview();
  assert.equal(overview.latestParticipants, 398); assert.equal(overview.debutants, 195); assert.equal(overview.newBadges, 22); assert.equal(overview.latestYear, 2026); assert.equal(overview.honorCount, 43);
  const inger = p.participants(new URLSearchParams({ q: 'Inger Katherin Dahl Frantzen' })); assert.equal(inger.total, 1);
  const profile = p.participant(inger.people[0].id); assert.equal(profile.count, 12); assert.equal(profile.highestBadge.level, 10); assert.equal(profile.highestBadge.year, 2024); assert.equal(profile.nextBadge.remaining, 3);
  assert.deepEqual(profile.earned.map(b => b.level), [5, 10]); assert.ok(profile.results.length >= 12);
  assert.equal(p.participants(new URLSearchParams({ q: 'Finn Gerhard Olsen' })).people[0].count, 31);
  for (const name of ['Gunnar Kåsa', 'Morten Borø']) assert.equal(p.participants(new URLSearchParams({ q: name })).people[0].count, 35);
  const upcoming = p.badgeList(new URLSearchParams({ q: 'Inger Katherin', view: 'upcoming', level: '15' })); assert.equal(upcoming.total, 1);
  assert.equal(p.badgeList(new URLSearchParams({ q: 'Inger Katherin', view: 'earned', level: '15' })).total, 0);
  const merged = Object.keys(history.redirects)[0]; if (merged) assert.throws(() => p.participant(merged), /finnes ikke/);
});
test('C1.1 future editions, DNS, DNF, duplicate starts, registered aliases and redirects keep separate and dynamic participation rules', () => {
  const sample = { schemaVersion: 1, people: [{ i: 'P1', n: 'Løper En', g: 'Herre' }, { i: 'P2', n: 'Bare DNS', g: 'Dame' }], redirects: { OLD: 'P1' }, aliases: { OLD: ['Tidligere Navn'] },
    yearStats: [[2026], [2027]], results: [[2026, 'P1', 'Langmoro', '20 km', 'DNF', 'DNF'], [2026, 'OLD', 'Kortmoro', '10 km', 'Fullført', '50:00'], [2027, 'P1', 'Kortmoro', '10 km', 'Fullført', '49:00'], [2027, 'P2', 'Langmoro', '20 km', 'DNS', 'DNS']] };
  const p = createPortalData({ history: sample, badges, honorCount: 0 });
  assert.equal(p.overview().latestYear, 2027); assert.equal(p.overview().latestParticipants, 1); assert.equal(p.overview().runnerCount, 1);
  assert.equal(p.participant('P1').count, 2); assert.deepEqual(p.participant('P1').years, [2026, 2027]); assert.equal(p.participant('P2').count, 0);
  assert.equal(p.participants(new URLSearchParams({ q: 'Tidligere Navn' })).people[0].id, 'P1');
  assert.ok(p.participant('P1').results.some(r => r.status === 'DNF')); assert.equal(p.participant('P2').nextBadge, null);
  assert.equal(p.participants(new URLSearchParams()).total, 2);
});
test('C1.1 all portal APIs share local session enforcement, reject invalid queries and remain read-only with no raw-register routes', async () => {
  for (const route of ['overview', 'participants', 'badges', 'participants/MOR-C788866']) {
    assert.equal((await fetch(app.origin + '/api/' + route)).status, 403);
    assert.equal((await request(route)).status, 200);
    assert.equal((await fetch(app.origin + '/api/' + route, { headers: { 'X-Morothon-Token': app.token, Origin: 'https://foreign.example' } })).status, 403);
  }
  for (const route of ['participants?limit=999', 'participants?offset=-1', 'participants?private=true', 'badges?view=guess', 'badges?level=13', 'participants?q=a&q=b']) assert.equal((await request(route)).status, 400);
  assert.equal((await request('participants/not-a-person')).status, 404);
  assert.equal((await fetch(app.origin + '/api/participants', { method: 'POST', headers: { 'X-Morothon-Token': app.token, Origin: app.origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  for (const route of ['/data/honors.json', '/tools/diploma-admin/api.cjs', '/api/volunteers', '/api/import', '/api/awards']) assert.notEqual((await fetch(app.origin + route, { headers: { 'X-Morothon-Token': app.token } })).status, 200);
  const overview = await (await request('overview')).json(); assert.equal(overview.latestParticipants,new Set(history.results.filter(r=>r[0]===Math.max(...history.yearStats.map(s=>s[0]))&&require('../../../js/history-data.js').countsAsParticipation(r)).map(r=>require('../../../js/history-data.js').resolveId(r[1],history.redirects))).size);
  const second = await (await request('participants?limit=2&offset=2')).json(); assert.equal(second.people.length, 2); assert.equal(second.offset, 2);
});
test('C1.1 desktop and tablet navigation, participant history, upcoming milestones and C2 placeholders work without changing the diploma selection', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }), p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await p.goto(app.origin); await p.locator('#overviewMetrics .metric-card').first().waitFor();
    await p.locator('#navCorrections').waitFor();
    if (trustedHonorPresent) await p.locator('#navHeder').waitFor();
    assert.equal(await p.locator('.sidebar nav a').count(), trustedHonorPresent ? 9 : 8);
    assert.equal(await p.locator('#pageTitle').innerText(), 'Oversikt');
    await p.getByRole('navigation').getByRole('link', { name: 'Deltakere' }).click();
    await p.fill('#participantSearch', 'Inger Katherin'); await p.waitForFunction(() => document.querySelectorAll('.participant-row').length === 1);
    await p.getByRole('button', { name: 'Se historikk', exact: true }).click(); await p.locator('#participantDialog[open]').waitFor();
    assert.match(await p.locator('#participantDetail').innerText(), /Sølvmerket/); assert.match(await p.locator('#participantDetail').innerText(), /2024/);
    await p.getByRole('button', { name: 'Velg diplom', exact: true }).click();
    await p.waitForFunction(() => location.hash === '#diplomer' && document.querySelector('#kind').value === 'runner');
    assert.equal(await p.inputValue('#search'), 'Inger Katherin Dahl Frantzen');
    await p.click('#demo'); assert.equal(await p.locator('.job-row').count(), 5);
    await p.getByRole('navigation').getByRole('link', { name: 'Merker', exact: true }).click();
    await p.selectOption('#badgeView', 'upcoming'); await p.fill('#badgeSearch', 'Inger Katherin'); await p.selectOption('#badgeLevel', '15');
    await p.waitForFunction(() => document.querySelectorAll('.runner-badge-card').length === 1);
    assert.match(await p.locator('#badgeList').innerText(), /3 deltakelser igjen/);
    for (const name of ['Premier']) { await p.getByRole('navigation').getByRole('link', { name: new RegExp(name) }).click(); await p.waitForFunction(name => document.querySelector('#pageTitle').textContent === name, name); assert.equal(await p.locator('[data-view]:visible input[type="file"]').count(), 0); }
    await p.getByRole('navigation').getByRole('link', { name: 'Årets arrangement' }).click(); await p.locator('#intakeFile').waitFor();
    for (const width of [1440, 768]) {
      await p.setViewportSize({ width, height: 1050 });
      await p.getByRole('navigation').getByRole('link', { name: 'Oversikt' }).click(); await p.locator('#overviewMetrics .metric-card').first().waitFor();
      await p.screenshot({ path: path.join(out, `oversikt-${width}.png`), fullPage: true });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await p.getByRole('navigation').getByRole('link', { name: /Diplomer/ }).click(); await p.locator('#view-diplomer').waitFor(); assert.equal(await p.locator('.job-row').count(), 5);
      assert.equal(await p.locator('#navDiplomaCount').innerText(), '5');
      await p.screenshot({ path: path.join(out, `diplomer-${width}.png`), fullPage: true });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await p.getByRole('navigation').getByRole('link', { name: 'Deltakere' }).click(); await p.locator('.participant-row').first().waitFor();
    await p.screenshot({ path: path.join(out, 'deltakere-768.png'), fullPage: true }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.getByRole('navigation').getByRole('link', { name: 'Merker', exact: true }).click(); await p.locator('.runner-badge-card').first().waitFor();
    await p.screenshot({ path: path.join(out, 'merker-768.png'), fullPage: true }); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.evaluate(() => document.querySelector('.skip-link').click()); assert.equal(await p.evaluate(() => document.activeElement.id), 'portalMain'); assert.equal(await p.evaluate(() => location.hash), '#merker');
    await p.getByRole('navigation').getByRole('link', { name: 'Oversikt' }).click(); await p.locator('#view-oversikt').waitFor();
    await p.getByRole('navigation').getByRole('link', { name: /Diplomer/ }).click(); await p.locator('#view-diplomer').waitFor();
    assert.equal(await p.locator('.sidebar nav a[aria-current="page"]').count(), 1);
    await p.goBack(); await p.waitForFunction(() => location.hash === '#oversikt');
    await p.goto(app.origin + '/#ukjent'); await p.waitForFunction(() => location.hash === '#oversikt');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('C1.1 participant loading failures show a clear error instead of stale results and allow a retry', async () => {
  const context = await browser.newContext(), p = await context.newPage();
  try {
    await p.goto(app.origin + '/#deltakere'); await p.locator('.participant-row').first().waitFor();
    await p.route('**/api/participants?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test: historikken kan ikke lastes.' }) }));
    await p.fill('#participantSearch', 'Inger'); await p.getByText('Test: historikken kan ikke lastes.').waitFor(); assert.equal(await p.locator('.participant-row').count(), 0);
    await p.unroute('**/api/participants?*'); await p.fill('#participantSearch', 'Inger Katherin'); await p.waitForFunction(() => document.querySelectorAll('.participant-row').length === 1);
    assert.equal(await p.locator('#portalStatus').innerText(), '');
    await p.route('**/api/participants?*', async route => {
      await p.evaluate(() => { location.hash = '#oversikt'; }); await p.locator('#view-oversikt').waitFor();
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Skal ikke vises på en annen side.' }) });
    });
    await p.fill('#participantSearch', 'Finn');
    await p.waitForFunction(() => document.querySelector('#participantList').textContent.includes('Kunne ikke laste listen'));
    assert.equal(await p.locator('#portalStatus').innerText(), ''); assert.equal(await p.locator('#pageTitle').innerText(), 'Oversikt');
  } finally { await context.close(); }
});

test('C1.2 local Heder admin previews all 43 approved persons, separate memorials and safe runner lookup',async()=>{
 const context=await browser.newContext({viewport:{width:1100,height:980}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  assert.equal((await fetch(app.origin+'/api/honors')).status,403);
  if (!trustedHonorPresent) {
    // Public-only CI exercises absence of privileged admin modules; the
    // entire Heder view is verified during trusted full source regression.
    assert.equal((await request('honors')).status,404);
    assert.equal((await request('honors/runner-candidates?q=Jon')).status,404);
    return;
  }
  assert.equal((await request('honors')).status,200);
  const roster=await (await request('honors')).json();
  assert.equal(roster.people.length,43);assert.equal(roster.canEdit,false);
  assert.equal(roster.publicationAuthorized,false);
  assert.equal(JSON.stringify(roster).includes('"sourceMember"'),false);
  assert.equal((await request('honors?unknown=1')).status,400);
  assert.equal((await request('honors/runner-candidates?q=a&q=b')).status,400);
  const candidates=await (await request('honors/runner-candidates?personId=jon-fjeld&q=Jon')).json();
  assert.equal(candidates.readOnly,true);assert.equal(candidates.identityLinkedAutomatically,false);
  await page.goto(app.origin+'/#heder');
  await page.waitForFunction(() => document.querySelector('#honorCount')?.textContent === '43 av 43 personer');
  assert.equal(await page.locator('#honorList .honor-row').count(),43);
  await page.selectOption('#honorFilter','memorial');
  await page.waitForFunction(()=>document.querySelectorAll('#honorList .honor-row').length===3);
  assert.deepEqual((await page.locator('#honorList .honor-row button').allTextContents()).sort(),
    ['Einar Danielsen','Floke Bredland','Leif Wiig']);
  await page.getByRole('button',{name:'Floke Bredland'}).click();
  assert.match(await page.locator('#honorDetail').innerText(),/Til minne om/);
  await page.selectOption('#honorFilter','all');
  await page.fill('#honorSearch','Jon Fjeld');
  await page.waitForFunction(()=>document.querySelectorAll('#honorList .honor-row').length===1);
  await page.locator('#honorList').getByRole('button',{name:'Jon Fjeld'}).click();
  await openHonorDetails(page,'honorReadLink');assert.match(await page.locator('#honorDetail').innerText(),/Eksisterende bekreftet løperkobling/);
  await openHonorDetails(page,'honorReadRunner');await page.getByRole('button',{name:'Finn løperkandidater'}).click();
  await page.locator('#honorRunnerCandidates .honor-candidate').first().locator(':scope > details > summary').click();await page.locator('#honorRunnerCandidates').getByText(/ID MOR-/).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test('Heder can be disabled per local organizer without exposing an admin menu or API',async()=>{
 const disabled=await startAdmin({honorEnabled:false}),context=await browser.newContext();
 try {
  const response=await fetch(disabled.origin+'/api/honors',{headers:{'X-Morothon-Token':disabled.token}});
  assert.equal(response.status,404);
  const search=await fetch(disabled.origin+'/api/honors/runner-candidates?q=Jon',{headers:{'X-Morothon-Token':disabled.token}});
  assert.equal(search.status,404);
  const page=await context.newPage();await page.goto(disabled.origin);
  await page.locator('#overviewMetrics .metric-card').first().waitFor();
  assert.equal(await page.locator('#navHeder').isHidden(),true);
  await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Klar.'));
  assert.equal(await page.locator('#kind option[value="honor"]').count(),0);
  assert.equal((await page.locator('#overviewMetrics').innerText()).includes('Menneskene bak løpet'),false);
  const localHeaders={'X-Morothon-Token':disabled.token};
  const catalog=await(await fetch(disabled.origin+'/api/catalog',{headers:localHeaders})).json();assert.ok(catalog.people.every(p=>p.kind==='runner'));
  assert.equal((await fetch(disabled.origin+'/site/heder.html')).status,404);
  for(const action of ['preview','check','export'])assert.equal((await fetch(disabled.origin+'/api/'+action,{method:'POST',headers:{...localHeaders,Origin:disabled.origin,'Content-Type':'application/json'},body:JSON.stringify({items:[{kind:'honor',personId:'synthetic-person',key:'thanks',display:'latest'}]})})).status,404);
 } finally {await context.close();await disabled.close();}
});

test('Heder drafts retain only reviewed session overlays and enforce token, origin, version and disabled boundaries',async()=>{
 const post=(action,body,extra={})=>fetch(app.origin+'/api/honors/drafts/'+action,{method:'POST',headers:{'X-Morothon-Token':app.token,Origin:app.origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 if(!trustedHonorPresent){for(const action of ['open','preview','keep','discard'])assert.equal((await post(action,{})).status,404);return;}
 const baseline=await(await request('honors')).json(),catalog=await(await request('catalog')).json();
 assert.equal((await post('open',{}, {'X-Morothon-Token':'wrong'})).status,403);
 assert.equal((await post('open',{}, {Origin:'https://foreign.example'})).status,403);
 const opened=await(await post('open',{})).json(),bind={draftId:opened.draftId,revision:opened.revision,baseVersion:opened.baseVersion};
 const fields=structuredClone(opened.fields);fields.name='Syntetisk Øktperson';fields.tenure.mode='documented';
 fields.tenure.selectedEditionIds=opened.editions.filter(e=>e.status==='held').slice(0,opened.rules[0].editions).map(e=>e.editionId);
 const response=await post('preview',{...bind,fields});assert.equal(response.status,200);const preview=await response.json();
 assert.equal(preview.profile.tenure.registeredEditions,opened.rules[0].editions);assert.equal(preview.publicationAuthorized,false);assert.equal(preview.persisted,false);
 for(const word of ['sourceMember','sourceDetails','sourceIds','internalNotes'])assert.equal(JSON.stringify([opened,preview]).includes('"'+word+'"'),false);
 assert.equal((await post('keep',{...bind,previewId:preview.previewId,editionsReviewed:false})).status,400);
 assert.equal((await post('preview',{...bind,baseVersion:'bad',fields})).status,400);
 const kept=await(await post('keep',{...bind,previewId:preview.previewId,editionsReviewed:true})).json();assert.equal(kept.revision,1);assert.equal(kept.productionApplied,false);
 assert.equal((await post('keep',{...bind,previewId:preview.previewId,editionsReviewed:true})).status,400);
 assert.deepEqual(await(await request('honors')).json(),baseline);assert.deepEqual(await(await request('catalog')).json(),catalog);
 assert.equal((await(await request('honors/drafts')).json()).items.length,1);
 assert.equal((await post('discard',{...bind,revision:kept.revision})).status,200);
 assert.equal((await(await request('honors/drafts')).json()).items.length,0);await app.assertSnapshot();
 const disabled=await startAdmin({honorEnabled:false});
 try{
  assert.equal((await fetch(disabled.origin+'/api/honors/drafts',{headers:{'X-Morothon-Token':disabled.token}})).status,404);
  for(const action of ['open','preview','keep','discard'])assert.equal((await fetch(disabled.origin+'/api/honors/drafts/'+action,{method:'POST',headers:{'X-Morothon-Token':disabled.token,Origin:disabled.origin,'Content-Type':'application/json'},body:'{}'})).status,404);
 }finally{await disabled.close();}
});

test('Heder editable drafts show year choices, safe text, explicit identity review and reversible previews on desktop/tablet/mobile',async()=>{
 if(!trustedHonorPresent){assert.equal((await request('honors/drafts')).status,404);return;}
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
 await context.addInitScript(()=>{window.__honorXss=0;});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const baseline=await(await request('honors')).json(),person=baseline.people.find(p=>!p.memorial&&p.tenure.basis==='documented');
 try{
  await page.goto(app.origin+'/#heder');await page.locator('#honorList').getByRole('button',{name:person.name,exact:true}).click();
  await page.getByRole('button',{name:'Rediger',exact:true}).click();await page.locator('#honorDraftName').waitFor();
  const payload='Syntetisk <img src=x onerror="window.__honorXss=1">';
  await page.fill('#honorDraftName',payload);await editHonorSection(page,'honorDraftDiploma','Rediger personlig diplomtekst');await page.fill('#honorDraftText','Syntetisk diplomtekst <svg onload="window.__honorXss=1">');
  await openHonorDetails(page,'honorDraftBasis');await page.selectOption('#honorDraftMode','period');await page.check('#honorDraftActive');
  const editions=await page.locator('#honorDraftFrom option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  await page.selectOption('#honorDraftFrom',editions.at(-5));
  await page.getByRole('button',{name:'Foreslå gjennomførte utgaver i perioden',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='5');
  await openHonorDetails(page,'honorDraftAbsences');await page.check('#honorAbsent-'+editions.at(-1));
  await page.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='4');
  assert.match(await page.locator('#honorDraftPreview').innerText(),/Foreslåtte utgaver/);
  assert.equal(await page.locator('#honorDraftKeep').isDisabled(),true);
  const linked=new Set(baseline.people.filter(p=>p.runnerLink).map(p=>p.runnerLink.runnerId));
  const runner=history.people.find(p=>!linked.has(p.i)&&!Object.hasOwn(history.redirects||{},p.i));
  await page.fill('#honorDraftRunnerSearch',runner.n);await page.getByRole('button',{name:'Finn løperkandidater for utkastet',exact:true}).click();
  await page.locator('#honorDraftRunnerResults .honor-candidate').filter({hasText:runner.i}).getByRole('button',{name:'Velg kandidat',exact:true}).click();
  assert.equal(await page.locator('#honorDraftIdentityConfirmed').isChecked(),false);assert.equal(await page.locator('#honorDraftKeep').isDisabled(),true);
  await page.check('#honorDraftIdentityConfirmed');
  await page.waitForFunction(id=>document.querySelector('#honorDraftPreview').textContent.includes(id),runner.i);
  await page.check('#honorDraftReviewed');await page.waitForFunction(()=>!document.querySelector('#honorDraftKeep').disabled);
  assert.equal(await page.locator('#honorDraftPreview img[src="x"]').count(),0);assert.equal(await page.evaluate(()=>window.__honorXss),0);
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(out,'heder-utkast-'+width+'.png'),fullPage:true});
  }
  await page.click('#honorDraftKeep');await page.waitForFunction(()=>document.querySelector('#honorDraftStatus').textContent.includes('kun i denne serverøkten'));
  await page.locator('#honorSessionDrafts button').waitFor();assert.equal(await page.locator('#honorSessionDrafts button').count(),1);assert.deepEqual(await(await request('honors')).json(),baseline);
  await page.getByRole('button',{name:'Lukk redigering',exact:true}).click();
  await page.locator('#honorSessionDrafts button').click();await page.locator('#honorDraftName').waitFor();assert.equal(await page.inputValue('#honorDraftName'),payload);
  await page.getByRole('button',{name:'Forkast øktutkast',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#honorSessionDrafts button').length===0);
  await page.click('#honorNewDraft');await page.fill('#honorDraftName','Syntetisk Ny Person');
  await page.waitForFunction(()=>document.querySelector('#honorDraftPreview h3')?.textContent==='Syntetisk Ny Person');
  assert.equal(await page.locator('#honorDraftPreview .metric-card strong').textContent(),'Ukjent');
  await page.getByRole('button',{name:'Forkast øktutkast',exact:true}).click();assert.deepEqual(await(await request('honors')).json(),baseline);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
