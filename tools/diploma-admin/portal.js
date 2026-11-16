/* Local portal shell. Server-side API boundary controls all data/production. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), token = document.querySelector('[name="local-session"]')?.content;
  const pages = {
    oversikt: ['Oversikt', 'Et godt utgangspunkt for neste Morothon.'],
    deltakere: ['Deltakere', 'Menneskene på startstreken. Historikken de har skapt.'],
    merker: ['Merker', 'Se oppnådde milepæler og veien til neste merke.'],
    heder: ['Heder', 'Menneskene bak arrangementet, deres roller og dugnadsår.'],
    diplomer: ['Diplomer', 'Velg mottakere, kontroller hvert diplom og lag én samlet A4-PDF.'],
    import: ['Årets arrangement', 'Startlister, merkeprognoser og kontroll av endelige resultater.'],
    premier: ['Premier', 'Grunnlaget for en enklere utdeling.'],
    rettelser: ['Rettelser og personkontroll', 'Lokale saker, før/etter-visning og kontrollert overlevering.'],
    design: ['Design og tilpasning', 'Ditt arrangement, dine merker og ditt diplom – i et separat utkast.']
  };
  const state = { overview: null, participantOffset: 0, badgeOffset: 0, section: null, sequence: {}, detailSequence: 0, returnFocus: null,
    honorData: null, honorSelected: null, honorRequest: 0 };
  const format = n => new Intl.NumberFormat('nb-NO').format(n);
  const element = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  function button(text, action, cls = 'secondary') { const e = element('button', text, cls); e.type = 'button'; e.onclick = action; return e; }
  function image(b, cls) { const img = element('img', undefined, cls); img.src = b.src; img.alt = b.name; img.loading = 'lazy'; return img; }
  async function api(route) {
    if (window.MorothonAdminTransport) return MorothonAdminTransport.request(route);
    if (document.body.dataset.adminMode === 'public-preview') throw Error('Nettadapteren kunne ikke lastes. Last siden på nytt.');
    const r = await fetch('/api/' + route, { headers: { 'X-Morothon-Token': token } });
    const data = await r.json(); if (!r.ok) throw Error(data.error || 'Kunne ikke hente historikken.'); return data;
  }
  function status(message = '') { $('portalStatus').textContent = message; }
  function metric(label, value, detail) { const card = element('article', undefined, 'metric-card'); card.append(element('span', label), element('strong', typeof value === 'number' ? format(value) : value), element('small', detail)); return card; }
  const period = p => p.firstYear ? `${p.firstYear}–${p.lastYear}` : 'Ingen tellende deltakelser';
  function chooseDiploma(p) {
    closePerson(); location.hash = '#diplomer';
    document.dispatchEvent(new CustomEvent('morothon:diploma-person', { detail: { id: p.id } }));
  }
  async function overview() {
    const data = state.overview || await api('overview'); state.overview = data;
    $('overviewRunner').src = data.watermarkSrc; $('overviewRunner').hidden = false;
    $('overviewMetrics').replaceChildren(
      metric(`Deltakere i ${data.latestYear}`, data.latestParticipants, 'Individuelle deltakere'),
      metric('Løpere i historikken', data.runnerCount, `${data.editionCount} utgaver · ${data.firstYear}–${data.latestYear}`),
      metric('Nye merker i ' + data.latestYear, data.newBadges, `${format(data.debutants)} debutanter samme år`),
      metric('Menneskene bak løpet', data.honorCount, 'Synlige Heder-profiler'));
    $('milestoneTitle').textContent = `Årets milepæler · ${data.latestYear}`;
    $('milestoneSummary').textContent = `${format(data.newBadges)} nye deltakelsesmerker. Her er noen av årets milepæler.`;
    $('overviewMilestones').replaceChildren(...data.milestones.map(p => {
      const row = element('div', undefined, 'milestone-row'), action = button(p.name, () => showPerson(p.id), '');
      action.append(element('small', `${p.badge.name} · ${p.badge.level} deltakelser`)); row.append(image(p.badge), action); return row;
    }));
    const max = Math.max(1, ...data.recentEditions.map(r => r.participants));
    $('overviewEditions').replaceChildren(...data.recentEditions.map(r => {
      const row = element('div', undefined, 'edition-row'), track = element('div', undefined, 'bar-track'), bar = element('i');
      bar.style.width = r.participants / max * 100 + '%'; track.append(bar); row.append(element('span', r.year), track, element('strong', format(r.participants))); return row;
    }));
    if ($('badgeLevel').options.length === 1) for (const b of data.levels) { const o = element('option', `${b.name} · ${b.level}`); o.value = b.level; $('badgeLevel').append(o); }
  }
  async function loadList(kind) {
    const participant = kind === 'participants', seq = state.sequence[kind] = (state.sequence[kind] || 0) + 1;
    const offset = participant ? state.participantOffset : state.badgeOffset, target = $(participant ? 'participantList' : 'badgeList');
    const params = new URLSearchParams({ q: $(participant ? 'participantSearch' : 'badgeSearch').value, offset, limit: 30 });
    if (!participant) { params.set('view', $('badgeView').value); params.set('level', $('badgeLevel').value); }
    target.setAttribute('aria-busy', 'true');
    try {
      const data = await api((participant ? 'participants' : 'badges') + '?' + params);
      if (seq !== state.sequence[kind]) return;
      const nodes = data.people.map(p => participant ? participantRow(p) : badgeCard(p, data.view));
      target.replaceChildren(...(nodes.length ? nodes : [element('p', 'Ingen løpere passer til dette utvalget.', 'empty-state')]));
      $(participant ? 'participantRange' : 'badgeRange').textContent = data.total ? `${format(offset + 1)}–${format(Math.min(offset + data.limit, data.total))} av ${format(data.total)}` : '0 treff';
      $(participant ? 'participantsPrevious' : 'badgesPrevious').disabled = offset === 0;
      $(participant ? 'participantsNext' : 'badgesNext').disabled = offset + data.limit >= data.total;
      if (participant) $('participantCount').textContent = `${format(data.total)} registrerte personer`;
      else $('badgeExplanation').textContent = data.view === 'upcoming' ? 'Viser antall nye deltakelser frem til neste merke, uten å forutsi år eller påmelding.' : 'Merkene beregnes fra registrerte deltakelsesår. Ingen formell tildeling registreres her.';
      if (state.section === (participant ? 'deltakere' : 'merker')) status();
    } catch (e) {
      if (seq === state.sequence[kind]) {
        target.replaceChildren(element('p', 'Kunne ikke laste listen. Prøv søket på nytt.', 'empty-state'));
        if (state.section === (participant ? 'deltakere' : 'merker')) status(e.message);
      }
    } finally { if (seq === state.sequence[kind]) target.removeAttribute('aria-busy'); }
  }
  function participantRow(p) {
    const row = element('article', undefined, 'participant-row'), name = element('div'); name.append(element('strong', p.name), element('small', `Debut ${p.firstYear || 'ikke registrert'}`));
    const count = element('div'); count.append(element('span', format(p.count), 'person-count'), element('small', 'deltakelser'));
    row.append(name, count, element('span', period(p), 'person-period hint'), element('span', p.highestBadge?.name || 'Første merke ved 5', 'badge-caption'), button('Se historikk', () => showPerson(p.id)));
    return row;
  }
  function badgeCard(p, view) {
    const card = element('article', undefined, 'runner-badge-card'), head = element('div', undefined, 'badge-card-heading'), text = element('div'), b = view === 'upcoming' ? p.nextBadge : p.highestBadge;
    text.append(element('strong', p.name), element('small', `${p.count} deltakelser · ${period(p)}`)); head.append(image(b), text); card.append(head);
    if (view === 'upcoming') {
      card.append(element('h3', `Neste: ${b.name}`), element('p', `${b.remaining} deltakelser igjen til ${b.level}`));
      const progress = element('div', undefined, 'bar-track'), fill = element('i'); fill.style.width = p.count / b.level * 100 + '%'; progress.append(fill); card.append(progress);
    } else {
      const collection = element('div', undefined, 'badge-collection');
      for (const badge of p.earned) { const figure = element('figure'); figure.append(image(badge), element('figcaption', String(badge.year))); collection.append(figure); }
      card.append(collection);
    }
    card.append(button('Se historikk', () => showPerson(p.id))); return card;
  }
  async function showPerson(id) {
    const seq = ++state.detailSequence; state.returnFocus = document.activeElement;
    status('Henter deltakerhistorikken …');
    try {
      const p = await api('participants/' + encodeURIComponent(id)); if (seq !== state.detailSequence) return;
      $('participantTitle').textContent = p.name;
      const main = $('participantDetail'), metrics = element('div', undefined, 'metric-grid');
      metrics.append(metric('Deltakelser', p.count, 'Unike deltakelsesår'), metric('Periode', period(p), 'DNS teller ikke · DNF teller'), metric('Høyeste merke', p.highestBadge?.name || 'Ikke opptjent', p.highestBadge?.year ? `Oppnådd ${p.highestBadge.year}` : 'Første merke ved 5 deltakelser'));
      const actions = element('div', undefined, 'actions'), pick = button('Velg diplom', () => chooseDiploma(p), ''); pick.disabled = !p.count;
      const profile = element('a', 'Åpne løperprofil', 'action-link'); profile.href = new URL('index.html#lop=' + encodeURIComponent(p.id), window.MorothonAdminTransport?.rootUrl || new URL('/site/', location.href)).href; profile.target = '_blank'; profile.rel = 'noopener'; actions.append(pick, profile);
      const collection = element('div', undefined, 'badge-collection');
      for (const b of p.earned) { const figure = element('figure'); figure.append(image(b), element('figcaption', `${b.level} · ${b.year}`)); collection.append(figure); }
      const wrapper = element('div', undefined, 'history-wrapper'), table = element('table', undefined, 'history-table'), caption = element('caption', 'Registrerte løpsresultater'); caption.className = 'hint';
      const head = element('thead'), hrow = element('tr'); for (const t of ['År', 'Løp', 'Tid', 'Status', 'Plass']) hrow.append(element('th', t)); head.append(hrow);
      const body = element('tbody'); for (const r of p.results) { const row = element('tr'); for (const value of [r.year, `${r.event} · ${r.distance}`, r.time || '–', r.status, r.place || '–']) row.append(element('td', String(value))); body.append(row); }
      table.append(caption, head, body); wrapper.append(table); main.replaceChildren(metrics, collection, actions, wrapper, element('p', 'Plasseringene er registrerte kildeplasseringer. Flere starter samme år gir maksimalt én deltakelse.', 'history-note'));
      if (!$('participantDialog').open) $('participantDialog').showModal(); status();
    } catch (e) { if (seq === state.detailSequence) status(e.message); }
  }
  function closePerson() { ++state.detailSequence; if ($('participantDialog').open) { $('participantDialog').close(); state.returnFocus?.focus(); } }
  // C1 Heder read-only preview: only the local loopback admin may display this.
  // The public Pages preview never adds the link or has an honors API route.
  function initHeder() {
    if (window.MorothonAdminTransport || document.body.dataset.adminMode === 'public-preview') return;
    const nav = element('a', 'Heder'); nav.id = 'navHeder'; nav.href = '#heder';
    const following = document.querySelector('.sidebar nav a[href="#premier"]');
    following.after(nav);
    const section = element('section'); section.id = 'view-heder'; section.dataset.view = 'heder'; section.hidden = true;
    section.setAttribute('aria-label', 'Heder');
    const panel = element('div', undefined, 'panel');
    const heading = element('div', undefined, 'section-heading'), title = element('h2', 'Heder – personregister');
    const counter = element('span', '', 'hint'); counter.id = 'honorCount';
    heading.append(title, counter);
    const description = element('p', 'Lesende forhåndsvisning fra godkjent datagrunnlag. Ingen personer, dugnadsår eller utmerkelser blir endret her.', 'hint');
    const controls = element('div', undefined, 'honor-controls');
    const label = element('label', 'Finn person, rolle eller navn');
    const search = element('input'); search.type = 'search'; search.id = 'honorSearch'; search.maxLength = 100;
    search.placeholder = 'Søk i Heder'; label.append(search);
    const filterLabel = element('label', 'Vis');
    const filter = element('select'); filter.id = 'honorFilter';
    for (const [key, text] of [['all','Alle'],['active','Fortsatt aktive'],['memorial','Til minne om']]) {
      const option = element('option', text); option.value = key; filter.append(option);
    }
    filterLabel.append(filter);
    const newPerson = button('Søk etter ny person', () => selectHonor(null), 'secondary');
    controls.append(label, filterLabel, newPerson);
    const content = element('div', undefined, 'honor-layout');
    const list = element('div'); list.id = 'honorList'; list.className = 'honor-list';
    const detail = element('div'); detail.id = 'honorDetail'; detail.className = 'honor-detail';
    detail.append(element('p', 'Velg en person for å se registrert innsats, omtaler og mulig løperkobling.', 'hint'));
    content.append(list, detail); panel.append(heading, description, controls, content);
    section.append(panel); document.querySelector('#view-deltakere').after(section);
    search.addEventListener('input', () => renderHonorList());
    filter.addEventListener('change', () => renderHonorList());
  }
  function readHonorPerson(person) {
    const detail = $('honorDetail'); detail.replaceChildren();
    if (!person) {
      const heading = element('h3', 'Søk etter løper før ny Heder-person');
      const note = element('p', 'Søket foreslår eksisterende løperprofiler, men oppretter eller kobler ingen personer. Selve registreringen åpnes når sikker lagring er klar.', 'hint');
      detail.append(heading, note);
    } else {
      detail.append(element('h3', person.name));
      const type = person.memorial ? 'Til minne om' : person.tenure.openPeriod ? 'Fortsatt aktiv · registrert periode' : 'Registrert dugnadsperson';
      detail.append(element('p', type, 'hint'));
      if (person.shortDescription) detail.append(element('p', person.shortDescription));
      if (person.roles.length) {
        detail.append(element('h4', 'Roller'));
        const roles = element('ul');
        for (const role of person.roles) roles.append(element('li', role.title + (role.fromYear ? ' · fra ' + role.fromYear : '') + (role.countsForTenure === false ? ' · teller ikke som dugnadsår' : '')));
        detail.append(roles);
      }
      if (person.memorial) {
        detail.append(element('h4', 'Til minne om'));
        if (person.memorialInfo?.deathYear) detail.append(element('p', 'Dødsår: ' + person.memorialInfo.deathYear));
        if (person.memorialInfo?.tribute) detail.append(element('p', person.memorialInfo.tribute));
        if (person.memorialInfo?.hasMemorialRecognition) detail.append(element('p', 'Eget minnemerke registrert', 'hint'));
      }
      const years = person.tenure;
      detail.append(element('h4', 'Dugnadsår'));
      const basis = years.basis === 'documented' ? 'Dokumenterte enkeltår' :
        years.basis === 'registered-period' ? 'Registrert periode, ikke individuelt dokumenterte år' :
        years.basis === 'approved-total' ? 'Arrangørgodkjent samlet antall' : 'Ikke tilstrekkelig grunnlag for opptelling';
      detail.append(element('p', basis + (years.registeredEditions === null ? '' : ' · ' + years.registeredEditions + ' utgaver'), 'hint'));
      const chips = element('div', undefined, 'honor-years');
      for (const y of years.years) chips.append(element('span', String(y), 'honor-year'));
      for (const y of years.excludedYears) chips.append(element('span', String(y) + ' · fravær', 'honor-year excluded'));
      if (chips.children.length) detail.append(chips);
      if (years.fromYear && !years.years.length) detail.append(element('p', 'Oppgitt startår: ' + years.fromYear, 'hint'));
      if (years.approvedTotal) detail.append(element('p', 'Godkjent samlet antall: ' + years.approvedTotal.editions + ' utgaver', 'hint'));
      if (person.badges.qualified.length) {
        detail.append(element('h4', 'Kvalifiserte merker'));
        const badges = element('p', person.badges.qualified.map(id => {
          const match = /-(\d+)$/.exec(id); return match ? match[1] + ' års dugnad' : id.replace(/^service-/,'').replaceAll('-', ' ');
        }).join(' · ')); detail.append(badges);
      }
      if (person.badges.next) detail.append(element('p', 'Neste nivå: ' + person.badges.next.editions + ' utgaver (' + person.badges.next.remaining + ' igjen)', 'hint'));
      detail.append(element('p', 'Kvalifisering er ikke en formell tildeling. År kan velges og korrigeres i en senere, sikker redigeringsfase.', 'hint'));
      if (person.stories?.length) {
        detail.append(element('h4', 'Historier'));
        for (const story of person.stories) detail.append(element('p', story.text));
      }
      if (person.runnerLink) detail.append(element('p', 'Eksisterende bekreftet løperkobling: ' + person.runnerLink.runnerId, 'hint'));
    }
    const label = element('label', 'Søk i deltakerhistorikken');
    const search = element('input'); search.id = 'honorRunnerSearch'; search.type = 'search';
    search.maxLength = 100; search.placeholder = 'Skriv navn'; search.value = person?.name || '';
    label.append(search);
    const action = button('Finn løperkandidater', () => lookupHonorRunner(person?.id, search.value), 'secondary');
    const candidates = element('div'); candidates.id = 'honorRunnerCandidates'; candidates.className = 'honor-candidates';
    detail.append(label, action, candidates);
  }
  function selectHonor(person) {
    state.honorSelected = person?.id || null;
    ++state.honorRequest;
    readHonorPerson(person);
  }
  function renderHonorList() {
    const data = state.honorData; if (!data) return;
    const term = $('honorSearch').value.toLocaleLowerCase('nb-NO').trim(), filter = $('honorFilter').value;
    const people = data.people.filter(p => (filter === 'all' || filter === 'memorial' && p.memorial ||
      filter === 'active' && p.tenure.openPeriod && !p.memorial) &&
      (!term || [p.name, ...p.roles.map(r => r.title)].some(v => v.toLocaleLowerCase('nb-NO').includes(term))));
    $('honorCount').textContent = people.length + ' av ' + data.people.length + ' personer';
    const list = $('honorList'), nodes = [];
    for (const p of people) {
      const item = element('div', undefined, 'honor-row'), kind = p.memorial ? 'Til minne om' : p.tenure.openPeriod ? 'Fortsatt aktiv' : p.tenure.registeredEditions === null ? 'Uavklart antall' : p.tenure.registeredEditions + ' utgaver';
      const name = button(p.name, () => selectHonor(p), 'secondary');
      if (p.id === state.honorSelected) name.setAttribute('aria-current','true');
      item.append(name, element('small', kind));
      nodes.push(item);
    }
    list.replaceChildren(...(nodes.length ? nodes : [element('p','Ingen personer i dette utvalget.','empty-state')]));
  }
  async function loadHeder() {
    if (!state.honorData) {
      const data = await api('honors');
      if (!data.readOnly || data.canEdit !== false || !Array.isArray(data.people)) throw Error('Ugyldig Heder-visning.');
      state.honorData = data;
    }
    renderHonorList();
  }
  async function lookupHonorRunner(personId, query) {
    const ticket = ++state.honorRequest, target = $('honorRunnerCandidates');
    if (!target || query.trim().length < 2) { if (target) target.replaceChildren(element('p','Skriv minst to tegn.','hint')); return; }
    target.replaceChildren(element('p','Søker …','hint'));
    try {
      const params = new URLSearchParams({q:query}); if (personId) params.set('personId',personId);
      const result = await api('honors/runner-candidates?' + params);
      if (ticket !== state.honorRequest || state.section !== 'heder') return;
      target.replaceChildren(...(result.candidates.length ? result.candidates.map(c => {
        const item = element('div',undefined,'honor-candidate');
        item.append(element('strong',c.name),element('small','ID ' + c.runnerId + ' · ' + c.participationCount + ' løpsdeltakelser'));
        if (c.linkedToOtherHonor) item.append(element('small','Allerede koblet til en annen Heder-person'));
        if (c.linkedToThisHonor) item.append(element('small','Kobling allerede bekreftet'));
        return item;
      }) : [element('p','Ingen aktuelle løpere funnet.','hint')]));
    } catch (e) {
      if (ticket === state.honorRequest) target.replaceChildren(element('p',e.message,'hint'));
    }
  }
  async function route() {
    const profile = window.MorothonAdminTransport ? await MorothonAdminTransport.ready : null;
    if (profile) for (const [key, value] of Object.entries(profile.texts.pages)) pages[key] = [value.title, value.description];
    let key = location.hash.slice(1); if (!pages[key] || profile && !['design','rettelser'].includes(key) && !profile.modules[key]) { key = 'oversikt'; history.replaceState(null, '', '#oversikt'); }
    state.section = key; closePerson(); if ($('preview').open) $('preview').close(); status();
    window.scrollTo({ top: 0, behavior: 'auto' });
    for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== key;
    for (const link of document.querySelectorAll('.sidebar nav a')) { if (link.hash === '#' + key) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    $('pageTitle').textContent = pages[key][0]; $('pageDescription').textContent = pages[key][1]; document.title = `${profile?.name || 'Morothon'} · ${pages[key][0]}`; $('pageTitle').focus({ preventScroll: true });
    try {
      if (key === 'oversikt' || key === 'merker') await overview();
      if (state.section !== key) return;
      if (key === 'deltakere') await loadList('participants');
      if (key === 'merker') await loadList('badges');
      if (key === 'heder') await loadHeder();
    } catch (e) { if (state.section === key) status(e.message); }
  }
  function search(id, kind) { let timer; $(id).addEventListener('input', () => { clearTimeout(timer); state[kind === 'participants' ? 'participantOffset' : 'badgeOffset'] = 0; timer = setTimeout(() => loadList(kind), 180); }); }
  search('participantSearch', 'participants'); search('badgeSearch', 'badges');
  for (const id of ['badgeView', 'badgeLevel']) $(id).onchange = () => { state.badgeOffset = 0; loadList('badges'); };
  for (const [id, kind, change] of [['participantsPrevious', 'participants', -30], ['participantsNext', 'participants', 30], ['badgesPrevious', 'badges', -30], ['badgesNext', 'badges', 30]]) $(id).onclick = () => { state[kind === 'participants' ? 'participantOffset' : 'badgeOffset'] += change; loadList(kind); };
  $('closeParticipant').onclick = closePerson; $('participantDialog').addEventListener('cancel', e => { e.preventDefault(); closePerson(); });
  document.addEventListener('morothon:diploma-count', e => { const count = e.detail.count; $('navDiplomaCount').textContent = count; $('navDiplomaCount').hidden = !count; });
  document.querySelector('.skip-link').addEventListener('click', e => { e.preventDefault(); $('portalMain').focus(); });
  initHeder();
  const navigate = () => route().catch(e => status(e.message));
  window.addEventListener('hashchange', navigate); navigate();
})();
