/* Local portal shell. Server-side API boundary controls all data/production. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), token = document.querySelector('[name="local-session"]').content;
  const pages = {
    oversikt: ['Oversikt', 'Et godt utgangspunkt for neste Morothon.'],
    deltakere: ['Deltakere', 'Menneskene på startstreken. Historikken de har skapt.'],
    merker: ['Merker', 'Se oppnådde milepæler og veien til neste merke.'],
    diplomer: ['Diplomer', 'Velg mottakere, kontroller hvert diplom og lag én samlet A4-PDF.'],
    import: ['Import', 'En plass for fremtidig EQ Timing-import.'],
    premier: ['Premier', 'Grunnlaget for en enklere utdeling.']
  };
  const state = { overview: null, participantOffset: 0, badgeOffset: 0, section: null, sequence: {}, detailSequence: 0, returnFocus: null };
  const format = n => new Intl.NumberFormat('nb-NO').format(n);
  const element = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  function button(text, action, cls = 'secondary') { const e = element('button', text, cls); e.type = 'button'; e.onclick = action; return e; }
  function image(b, cls) { const img = element('img', undefined, cls); img.src = b.src; img.alt = b.name; img.loading = 'lazy'; return img; }
  async function api(route) {
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
      const profile = element('a', 'Åpne løperprofil', 'action-link'); profile.href = '/site/index.html#lop=' + encodeURIComponent(p.id); profile.target = '_blank'; profile.rel = 'noopener'; actions.append(pick, profile);
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
  async function route() {
    let key = location.hash.slice(1); if (!pages[key]) { key = 'oversikt'; history.replaceState(null, '', '#oversikt'); }
    state.section = key; closePerson(); if ($('preview').open) $('preview').close(); status();
    window.scrollTo({ top: 0, behavior: 'auto' });
    for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== key;
    for (const link of document.querySelectorAll('.sidebar nav a')) { if (link.hash === '#' + key) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    $('pageTitle').textContent = pages[key][0]; $('pageDescription').textContent = pages[key][1]; document.title = `Morothon · ${pages[key][0]}`; $('pageTitle').focus({ preventScroll: true });
    try {
      if (key === 'oversikt' || key === 'merker') await overview();
      if (state.section !== key) return;
      if (key === 'deltakere') await loadList('participants');
      if (key === 'merker') await loadList('badges');
    } catch (e) { if (state.section === key) status(e.message); }
  }
  function search(id, kind) { let timer; $(id).addEventListener('input', () => { clearTimeout(timer); state[kind === 'participants' ? 'participantOffset' : 'badgeOffset'] = 0; timer = setTimeout(() => loadList(kind), 180); }); }
  search('participantSearch', 'participants'); search('badgeSearch', 'badges');
  for (const id of ['badgeView', 'badgeLevel']) $(id).onchange = () => { state.badgeOffset = 0; loadList('badges'); };
  for (const [id, kind, change] of [['participantsPrevious', 'participants', -30], ['participantsNext', 'participants', 30], ['badgesPrevious', 'badges', -30], ['badgesNext', 'badges', 30]]) $(id).onclick = () => { state[kind === 'participants' ? 'participantOffset' : 'badgeOffset'] += change; loadList(kind); };
  $('closeParticipant').onclick = closePerson; $('participantDialog').addEventListener('cancel', e => { e.preventDefault(); closePerson(); });
  document.addEventListener('morothon:diploma-count', e => { const count = e.detail.count; $('navDiplomaCount').textContent = count; $('navDiplomaCount').hidden = !count; });
  document.querySelector('.skip-link').addEventListener('click', e => { e.preventDefault(); $('portalMain').focus(); });
  window.addEventListener('hashchange', route); route();
})();
