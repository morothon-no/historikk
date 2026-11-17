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
    honorData: null, honorSelected: null, honorRequest: 0, honorEditor: null };
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
  async function honorDraftApi(action,body){
    if(window.MorothonAdminTransport)return MorothonAdminTransport.request('honors/drafts/'+action,body);
    if(document.body.dataset.adminMode==='public-preview')throw Error('Nettadapteren kunne ikke lastes.');
    const r=await fetch('/api/honors/drafts/'+action,{method:'POST',headers:{'X-Morothon-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const value=await r.json();if(!r.ok)throw Error(value.error||'Utkastet kunne ikke kontrolleres.');return value;
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
      metric(data.latestYear?`Deltakere i ${data.latestYear}`:'Deltakere', data.latestParticipants, 'Individuelle deltakere'),
      metric('Løpere i historikken', data.runnerCount, data.firstYear?`${data.editionCount} utgaver · ${data.firstYear}–${data.latestYear}`:'Ingen registrerte resultater'),
      metric(data.latestYear?'Nye merker i '+data.latestYear:'Nye merker', data.newBadges, `${format(data.debutants)} debutanter samme år`),
      ...(data.honorEnabled===false?[]:[metric('Menneskene bak løpet', data.honorCount, 'Synlige Heder-profiler')]));
    $('milestoneTitle').textContent = data.latestYear?`Årets milepæler · ${data.latestYear}`:'Årets milepæler';
    $('milestoneSummary').textContent = data.latestYear?`${format(data.newBadges)} nye deltakelsesmerker. Her er noen av årets milepæler.`:'Ingen registrerte milepæler ennå.';
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
      if(window.MorothonReviewClient?.canEdit)actions.append(button('Rett et resultat',()=>{closePerson();location.hash='#rettelser';document.dispatchEvent(new CustomEvent('morothon:edit-existing-result',{detail:{id:p.id}}));}));
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
  // Shared Heder UI: token-protected local session or approved-data browser preview.
  // The web adapter has no HTTP writer, identity authority or persistent save capability.
  function initHeder() {
    const web=window.MorothonAdminTransport;
    if (!web && document.querySelector('[name="local-honor-enabled"]')?.content !== 'true') return;
    const nav = element('a', 'Heder'); nav.id = 'navHeder'; nav.href = '#heder'; nav.hidden = true;
    const following = document.querySelector('.sidebar nav a[href="#premier"]');
    following.after(nav);
    // The module is shown only after a successful local, token-protected
    // lookup. An organizer that disables Heder must not see the menu.
    api('honors').then(data => { if (data.enabled && data.readOnly && Array.isArray(data.people)) {
      state.honorData = data; nav.hidden = false;
    } }).catch(() => {});
    if(web){
      const settings=element('section',undefined,'panel honor-web-settings');settings.id='honorWebSettings';
      settings.append(element('h2','Heder i nettportalen'));
      const label=element('label'),toggle=element('input');toggle.type='checkbox';toggle.id='honorWebEnabled';toggle.checked=web.capabilities.honorEnabled;
      label.append(toggle,document.createTextNode('Vis Heder i denne fanen'));settings.append(label,
        element('p','Les registeret og prøv endringer direkte her. Permanent lagring er ikke tilgjengelig før en autentisert webtjeneste er tilkoblet.','hint'),
        element('p','Valget gjelder bare denne fanen og tilbakestilles ved ny lasting. Deaktivering tømmer Heder-forhåndsvisninger og Heder-diplomvalg her. Offentlig Heder-meny aktiveres aldri.','hint'));
      document.querySelector('#view-oversikt').append(settings);
      toggle.onchange=async()=>{
        if(state.honorEditor?.dirty&&!confirm('Deaktivere Heder og forkaste forhåndsvisningen i denne fanen?')){toggle.checked=!toggle.checked;return;}
        try{
          web.setHonorEnabled(toggle.checked);state.honorEditor=null;state.honorData=null;state.overview=null;
          nav.hidden=!toggle.checked;$('honorDetail').replaceChildren();$('honorSessionDrafts').replaceChildren();$('view-heder').hidden=true;
          if(toggle.checked)state.honorData=await api('honors');
          document.dispatchEvent(new CustomEvent('morothon:honor-module'));
          await overview();if(state.section==='heder')location.hash='#oversikt';
          status(toggle.checked?'Heder vises i denne fanen. Ingen innstillinger er lagret på server.':'Heder er deaktivert i denne fanen. Registrene er uendret.');
        }catch(error){toggle.checked=web.capabilities.honorEnabled;status(error.message);}
      };
    }
    const section = element('section'); section.id = 'view-heder'; section.dataset.view = 'heder'; section.hidden = true;
    section.setAttribute('aria-label', 'Heder');
    const panel = element('div', undefined, 'panel');
    const heading = element('div', undefined, 'section-heading'), title = element('h2', 'Heder – personregister');
    const counter = element('span', '', 'hint'); counter.id = 'honorCount';
    heading.append(title, counter);
    const description = element('p', web?'Gjeldende register beholdes uendret. Prøv og forhåndsvis endringer i denne fanen. Lagring i registeret krever en autentisert webtjeneste og er ikke tilgjengelig ennå. Ikke skriv inn private kildeopplysninger.':'Gjeldende register beholdes uendret. Rediger et separat øktutkast og gjennomgå forskjellene før du beholder det. Ingen endringer publiseres.', 'hint');
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
    const create=button('Ny person',()=>openHonorEditor(null).catch(e=>status(e.message)));create.id='honorNewDraft';
    controls.append(label, filterLabel, newPerson,create);
    const content = element('div', undefined, 'honor-layout');
    const list = element('div'); list.id = 'honorList'; list.className = 'honor-list';
    const detail = element('div'); detail.id = 'honorDetail'; detail.className = 'honor-detail';
    detail.append(element('p', 'Velg en person for å se registrert innsats, omtaler og mulig løperkobling.', 'hint'));
    const drafts=element('div');drafts.id='honorSessionDrafts';drafts.className='honor-session-drafts';
    content.append(list, detail); panel.append(heading, description, controls,drafts, content);
    section.append(panel); document.querySelector('#view-deltakere').after(section);
    search.addEventListener('input', () => renderHonorList());
    filter.addEventListener('change', () => renderHonorList());
  }
  function honorSection(title,parent,id){
    const container=element('details',undefined,'honor-section'),summary=element('summary',title),body=element('div',undefined,'honor-section-body');
    if(id)container.id=id;container.append(summary,body);parent.append(container);return {container,summary,body};
  }
  function honorAsset(b,main=false){return image({name:b.name,src:new URL(b.src,window.MorothonAdminTransport?.rootUrl||new URL('/site/',location.href)).href},main?'honor-draft-main':'honor-draft-badge');}
  function honorCandidateRow(c){
    const row=element('div',undefined,'honor-candidate');row.append(element('strong',c.name),element('small',c.participationCount+' løpsdeltakelser · '+(c.participationYears||[]).join(', ')));
    if(c.aliases?.length)row.append(element('small','Også registrert som: '+c.aliases.join(' · ')));
    row.append(element('small',c.linkedToOtherHonor?'Allerede koblet til en annen Heder-person':c.linkedToThisHonor?'Koblingen er allerede bekreftet':'Ingen bekreftet Heder-kobling'));
    const info=honorSection('Profil-ID',row);info.body.append(element('small','ID '+c.runnerId));return row;
  }
  function readHonorPerson(person) {
    const detail=$('honorDetail');detail.replaceChildren();
    if(!person){detail.append(element('h3','Finn en eksisterende løper'),element('p','Søk først hvis personen også har løpt. Du bekrefter identiteten selv før du bruker løpernavnet. Koblingen er bare et utkast.','hint'));}
    else{
      detail.append(element('h3',person.name));
      if(person.memorial)detail.append(element('p','Til minne om','hint'));
      if(person.shortDescription)detail.append(element('p',person.shortDescription));
      if(person.roles.length)detail.append(element('p',person.roles.map(r=>r.title).join(' · '),'honor-role-summary'));
      const assets=new Map((state.honorData.badgeAssets||[]).map(b=>[b.id,b])),main=assets.get(person.badges.highest),hero=element('div',undefined,'honor-card-achievement');
      if(main)hero.append(honorAsset(main,true));
      const years=person.tenure,brief=element('div');brief.append(element('strong',years.registeredEditions===null?'Antall utgaver uavklart':years.registeredEditions+' dugnadsutgaver'));
      const basis=years.basis==='documented'?'Dokumenterte utgaver':years.basis==='registered-period'?'Registrert periode – ikke bekreftede enkeltår':years.basis==='approved-total'?'Godkjent samlet antall':'Enkeltutgaver er ikke avklart';
      brief.append(element('p',basis,'hint'));if(years.openPeriod)brief.append(element('p','Fortsatt aktiv','hint'));
      if(person.badges.next)brief.append(element('p',years.registeredEditions===null?'Neste dugnadsmerke beregnes når utgavene er avklart.':person.badges.next.remaining+' utgaver til neste merke ('+person.badges.next.editions+').'));
      hero.append(brief);detail.append(hero);
      const edit=button('Rediger',()=>openHonorEditor(person.id).catch(e=>status(e.message)));edit.id='honorEdit';detail.append(edit);
      const more=honorSection('Flere opplysninger',detail,'honorReadMore');
      const medals=honorSection('Medaljer og utmerkelser',more.body),collection=element('div',undefined,'honor-draft-badges');
      for(const id of [...new Set([person.badges.highest,...person.badges.secondary||[],...person.badges.qualified].filter(Boolean))]){const b=assets.get(id);if(!b)continue;const item=element('span',b.name);item.prepend(honorAsset(b,id===person.badges.highest));collection.append(item);}medals.body.append(collection);
      const editions=honorSection('Dugnadsår og grunnlag',more.body),chips=element('div',undefined,'honor-years');
      for(const y of years.years)chips.append(element('span',String(y),'honor-year'));
      for(const y of years.excludedYears)chips.append(element('span',y+' · fravær','honor-year excluded'));
      editions.body.append(chips);if(years.fromYear)editions.body.append(element('p','Oppgitt startår: '+years.fromYear));if(years.toYear)editions.body.append(element('p','Siste registrerte år: '+years.toYear));
      if(years.approvedTotal)editions.body.append(element('p','Godkjent samlet antall: '+years.approvedTotal.editions+' utgaver'));
      if(person.roles.length){const roles=honorSection('Roller og oppgaver',more.body),list=element('ul');for(const r of person.roles)list.append(element('li',r.title+(r.fromYear?' · fra '+r.fromYear:'')+(r.countsForTenure===false?' · teller ikke som dugnadsår':'')));roles.body.append(list);}
      if(person.stories.length){const stories=honorSection('Historier',more.body);for(const story of person.stories){if(story.title)stories.body.append(element('h5',story.title));stories.body.append(element('p',story.text));}}
      if(person.honorDiplomaText){const diploma=honorSection('Personlig diplomtekst',more.body);diploma.body.append(element('p',person.honorDiplomaText));}
      if(person.memorial){const memorial=honorSection('Minneopplysninger',more.body,'honorReadMemorial');if(person.memorialInfo?.deathYear)memorial.body.append(element('p','Dødsår: '+person.memorialInfo.deathYear));if(person.memorialInfo?.tribute)memorial.body.append(element('p',person.memorialInfo.tribute));if(person.memorialInfo?.hasMemorialRecognition)memorial.body.append(element('p','Eget minnemerke registrert','hint'));}
      if(person.runnerLink){const link=honorSection('Registrert løperkobling',more.body,'honorReadLink');link.body.append(element('p','Eksisterende bekreftet løperkobling: '+person.runnerLink.runnerId,'hint'));}
    }
    const lookup=honorSection(person?'Finn eller endre løperkobling':'Søk i deltakerhistorikken',detail,'honorReadRunner');lookup.container.open=!person;
    const label=element('label','Søk i deltakerhistorikken'),search=element('input');search.id='honorRunnerSearch';search.type='search';search.maxLength=100;search.placeholder='Skriv navn eller alias';search.value=person?.name||'';label.append(search);
    const candidates=element('div');candidates.id='honorRunnerCandidates';candidates.className='honor-candidates';lookup.body.append(label,button('Finn løperkandidater',()=>lookupHonorRunner(person?.id,search.value),'secondary'),candidates);
    search.addEventListener('input',()=>{state.honorRequest++;candidates.replaceChildren();});
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupHonorRunner(person?.id,search.value);}});
  }
  async function selectHonor(person) {
    if(state.honorEditor?.dirty&&!confirm('Forhåndsvisningsendringene er ikke beholdt. Vil du forlate redigeringen?'))return;
    if(window.MorothonAdminTransport&&state.honorEditor){try{await honorDraftApi('discard',honorBinding(state.honorEditor));}catch(e){status(e.message);return;}}
    state.honorEditor=null;
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
    let group;
    for (const p of [...people.filter(p=>!p.memorial),...people.filter(p=>p.memorial)]) {
      if(group!==p.memorial){group=p.memorial;nodes.push(element('h3',p.memorial?'Til minne om':'Menneskene bak løpet','honor-list-heading'));}
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
    await loadHonorDrafts();
  }
  async function loadHonorDrafts(){
    const target=$('honorSessionDrafts');if(!target)return;
    const data=await api('honors/drafts');target.replaceChildren();
    if(!data.items.length)return;
    target.append(element('strong','Beholdte utkast i denne serverøkten'));
    for(const draft of data.items)target.append(button('Utkast · '+draft.name,()=>openHonorEditor(null,draft.draftId).catch(e=>status(e.message))));
    target.append(element('p','Disse er ikke skrevet til personregisteret. De forsvinner når serveren avsluttes.','hint'));
  }
  const honorBinding=editor=>({draftId:editor.session.draftId,revision:editor.session.revision,baseVersion:editor.session.baseVersion});
  async function openHonorEditor(personId,draftId,initialCandidate){
    if(state.honorEditor?.dirty&&!confirm('Forhåndsvisningsendringene er ikke beholdt. Vil du åpne et annet utkast?'))return;
    if(window.MorothonAdminTransport&&state.honorEditor)await honorDraftApi('discard',honorBinding(state.honorEditor));
    const e=await honorDraftApi('open',draftId?{draftId}:personId?{personId}:{});
    const editor={session:e,dirty:false,request:0,preview:null,identity:e.identityReview};state.honorEditor=editor;
    const detail=$('honorDetail');detail.replaceChildren();
    detail.append(element('h3',e.isNew?'Ny person · øktutkast':'Rediger · '+e.fields.name));
    const web=!!window.MorothonAdminTransport;
    const message=element('p',web?'Bare forhåndsvisning i denne fanens minne. Endringene forsvinner ved ny lasting. Ingen lagring i registeret, publisering eller utdeling.':'Kun midlertidig utkast i serverminnet. Ikke lagret varig, publisert eller godkjent for utdeling.','hint');message.id='honorDraftStatus';detail.append(message);
    const form=element('form');form.id='honorDraftForm';form.onsubmit=event=>{event.preventDefault();preview();};detail.append(form);
    const field=(label,id,value,type='text',parent=form)=>{
      const l=element('label',label),input=element(type==='textarea'?'textarea':'input');input.id=id;
      if(type!=='textarea')input.type=type;
      if(type==='checkbox')input.checked=value===true;else input.value=value??'';
      if(type==='number'){input.min='1900';input.max='2200';}
      if(type==='text')input.maxLength=500;
      l.append(input);parent.append(l);return input;
    };
    const name=field('Navn','honorDraftName',e.fields.name);name.maxLength=160;
    const description=field('Kort omtale','honorDraftDescription',e.fields.shortDescription,'textarea');description.maxLength=2000;
    description.rows=2;
    const rolesBrief=element('p',e.fields.roles.map(r=>r.title).join(' · ')||'Ingen roller oppgitt','honor-role-summary');form.append(rolesBrief);
    const advanced=honorSection('Flere opplysninger',form,'honorDraftMore');
    function editable(title,initial,id){
      const section=honorSection(title,advanced.body,id),read=element('p',initial||'Ikke oppgitt','honor-readable'),inputs=element('div');inputs.hidden=true;
      const edit=button('Rediger '+title.toLocaleLowerCase('nb-NO'),()=>{read.hidden=true;inputs.hidden=false;edit.hidden=true;inputs.querySelector('input:not([disabled]),textarea,select')?.focus();});
      section.body.append(read,edit,inputs);return {...section,read,inputs};
    }
    const diplomaSection=editable('Personlig diplomtekst',e.fields.honorDiplomaText,'honorDraftDiploma');
    const tribute=field('Personlig diplomtekst','honorDraftText',e.fields.honorDiplomaText,'textarea',diplomaSection.inputs);tribute.maxLength=5000;
    const roleSection=editable('Roller og oppgaver',e.fields.roles.map(r=>r.title).join(' · '),'honorDraftRoles'),roleBox=element('fieldset');roleBox.append(element('legend','Roller'));roleSection.inputs.append(roleBox);
    const roleRows=element('div');roleBox.append(roleRows);
    function addRole(row){
      const r=element('div',undefined,'honor-draft-role');r.dataset.key=row.key??'';
      for(const [key,label,type]of [['title','Rolle','text'],['fromYear','Fra år (valgfritt)','number'],['toYear','Til år (valgfritt)','number'],['countsForTenure','Dugnadsrolle (rollen alene gir ingen utgaver)','checkbox']]){
        const input=field(label,'honorRole-'+Math.random().toString(36).slice(2),row[key],type,r);input.dataset.field=key;
      }
      r.append(button('Fjern rolle',()=>{if(r.querySelector('[data-field="title"]').value.trim()&&!confirm('Fjerne denne rollen fra utkastet?'))return;r.remove();changed();}));roleRows.append(r);
    }
    for(const row of e.fields.roles)addRole(row);
    roleBox.append(button('Legg til rolle',()=>{addRole({key:null,title:'',fromYear:null,toYear:null,countsForTenure:false});changed();}));
    roleBox.append(element('p','Dugnadsutgaver velges separat. Styreverv og løpsstarter blir aldri automatisk til dugnadsår.','hint'));
    const storySection=editable('Historier og kilder',e.fields.stories.map(r=>(r.title?r.title+' · ':'')+r.text).join('\n\n'),'honorDraftStories'),storyBox=element('fieldset');storyBox.append(element('legend','Historier og kilder'));storySection.inputs.append(storyBox);
    const storyRows=element('div');storyBox.append(storyRows);
    function addStory(row){
      const r=element('div',undefined,'honor-draft-story');r.dataset.key=row.key??'';
      for(const [key,label,type]of [['title','Historietittel','text'],['text','Historietekst','textarea'],['sourceNote','Kilde/merknad for utkastet','text']]){
        const input=field(label,'honorStory-'+Math.random().toString(36).slice(2),row[key],type,r);input.dataset.field=key;if(key==='text')input.maxLength=5000;
      }
      if(row.key)r.append(element('small','Opprinnelige kildereferanser beholdes på serveren.'));
      r.append(button('Fjern historie',()=>{if(r.querySelector('[data-field="text"]').value.trim()&&!confirm('Fjerne denne historien fra utkastet?'))return;r.remove();changed();}));storyRows.append(r);
    }
    for(const row of e.fields.stories)addStory(row);
    storyBox.append(button('Legg til historie',()=>{addStory({key:null,title:'',text:'',sourceNote:''});changed();}));
    const memorialSection=honorSection('Minneopplysninger',advanced.body,'honorDraftMemorialSection');memorialSection.container.hidden=!e.fields.memorial.enabled;
    if(!e.fields.memorial.enabled)advanced.body.append(button('Åpne minneopplysninger',()=>{memorialSection.container.hidden=false;memorialSection.container.open=true;memorialSection.container.scrollIntoView({block:'nearest'});}));
    const memorial=field('Minneprofil i utkastet','honorDraftMemorial',e.fields.memorial.enabled,'checkbox',memorialSection.body);
    memorial.disabled=e.fields.memorial.enabled;
    const death=field('Dødsår (tomt når ukjent)','honorDraftDeathYear',e.fields.memorial.deathYear,'number',memorialSection.body);
    const memorialText=field('Minnetekst','honorDraftTribute',e.fields.memorial.tribute,'textarea',memorialSection.body);memorialText.maxLength=3000;
    const basisSection=honorSection('Periode og beregningsgrunnlag',advanced.body,'honorDraftBasis');
    const modeLabel=element('label','Grunnlag for dugnadsutgaver'),mode=element('select');mode.id='honorDraftMode';
    const modes=[['unknown','Ukjente enkeltutgaver'],['documented','Dokumenterte utgaver – eksplisitte valg'],['period','Registrert periode – foreslåtte utgaver']];
    if(e.evidence.approvedTotal)modes.push(['approved-total','Behold godkjent samlet antall: '+e.evidence.approvedTotal.editions]);
    for(const [value,label]of modes){const option=element('option',label);option.value=value;mode.append(option);}mode.value=e.fields.tenure.mode;modeLabel.append(mode);basisSection.body.append(modeLabel);
    const periodBox=element('div',undefined,'honor-draft-period');basisSection.body.append(periodBox);
    const held=e.editions.filter(x=>x.status==='held');
    const editionLabel=x=>x.label===String(x.year)?x.label:x.year+' · '+x.label;
    function editionSelect(label,id,value){const l=element('label',label),select=element('select');select.id=id;const blank=element('option','Velg utgave');blank.value='';select.append(blank);for(const x of held){const option=element('option',editionLabel(x));option.value=x.editionId;select.append(option);}select.value=value||'';l.append(select);periodBox.append(l);return select;}
    const from=editionSelect('Første utgave','honorDraftFrom',e.fields.tenure.fromEditionId),to=editionSelect('Siste utgave','honorDraftTo',e.fields.tenure.toEditionId);
    const yearArea=element('div');form.insertBefore(yearArea,advanced.container);
    const active=field('Fortsatt aktiv (periodeforslag)','honorDraftActive',e.fields.tenure.stillActive,'checkbox',yearArea);
    const yearSection=honorSection('Dugnadsutgaver',yearArea,'honorDraftYears'),yearBox=yearSection.body;
    const absences=honorSection('Registrer eller se fravær',yearBox,'honorDraftAbsences');
    yearBox.append(element('p','Innsats og bekreftet fravær er separate valg. Bare faktisk gjennomførte utgaver kan telles.','hint'));
    const yearRows=new Map(),yearScroll=element('div',undefined,'honor-draft-years');yearBox.insertBefore(yearScroll,absences.container);
    for(const x of held){
      const row=element('div',undefined,'honor-draft-edition'),absentRow=element('div');
      const selected=field(editionLabel(x),'honorEdition-'+x.editionId,e.fields.tenure.selectedEditionIds.includes(x.editionId),'checkbox',row);
      const excluded=field(editionLabel(x),'honorAbsent-'+x.editionId,e.fields.tenure.excludedEditionIds.includes(x.editionId),'checkbox',absentRow);absences.body.append(absentRow);
      selected.onchange=()=>{if(selected.checked)excluded.checked=false;};excluded.onchange=()=>{if(excluded.checked)selected.checked=false;};
      yearRows.set(x.editionId,{selected,excluded});yearScroll.append(row);
    }
    const propose=button('Foreslå gjennomførte utgaver i perioden',()=>{
      const a=held.findIndex(x=>x.editionId===from.value),b=active.checked?held.length-1:held.findIndex(x=>x.editionId===to.value);
      if(a<0||b<a){message.textContent='Velg start og enten fortsatt aktiv eller en sluttutgave først.';return;}
      held.forEach((x,i)=>{const row=yearRows.get(x.editionId);row.selected.checked=i>=a&&i<=b&&!row.excluded.checked;});changed();
    });periodBox.append(propose);yearBox.append(button('Endre periode eller grunnlag',()=>{advanced.container.open=true;basisSection.container.open=true;mode.focus();}));
    if(e.evidence.approvedTotal)basisSection.body.append(element('p','Eksisterende godkjent total bevares som kildegrunnlag. Den brukes ikke til å konstruere ukjente utgaver eller datoer.','hint'));
    const runnerBox=element('fieldset');runnerBox.append(element('legend','Løperprofil (valgfritt)'));form.insertBefore(runnerBox,advanced.container);
    if(e.existing?.runnerLink)runnerBox.append(element('p','Personen har en bekreftet løperkobling. Endringer her er bare et utkast.','hint'));
    const runnerSearch=field('Søk på navn eller alias','honorDraftRunnerSearch',e.fields.name,'search',runnerBox),runnerResults=element('div');runnerResults.id='honorDraftRunnerResults';runnerSearch.maxLength=100;
    let runnerChoice=editor.identity?{action:editor.identity.action,runnerId:editor.identity.runnerId}:null,selectedRunner=null,nameBeforeReuse=null,runnerTicket=0;
    const identityNote=element('p',runnerChoice?'Koblingsvalg fra øktutkastet må kontrolleres her.':'Koble bare hvis dette er samme person. Ingen løpsresultater slås sammen.','hint');
    const identityArea=element('div');identityArea.hidden=!runnerChoice;runnerBox.append(identityArea);
    const identityConfirmed=field('Jeg bekrefter at dette er samme person (bare i utkastet)','honorDraftIdentityConfirmed',!!editor.identity,'checkbox',identityArea);
    const nameChoice=element('div',undefined,'honor-name-choice');nameChoice.id='honorNameChoice';nameChoice.hidden=true;
    const beforeName=element('p'),afterName=element('p');beforeName.id='honorNameBefore';afterName.id='honorNameAfter';
    const useName=button('Bruk navn fra løperprofil',()=>{
      if(!selectedRunner||!sameIdentity())return;
      if(nameBeforeReuse===null)nameBeforeReuse=name.value;name.value=selectedRunner.name;changed();
    });useName.id='honorUseRunnerName';useName.disabled=true;
    const keepName=button('Behold Heder-navnet',()=>{if(nameBeforeReuse!==null){name.value=nameBeforeReuse;nameBeforeReuse=null;changed();}else identityNote.textContent='Heder-navnet beholdes. Koblingsvalget endres ikke.';});keepName.id='honorKeepDisplayName';
    nameChoice.append(beforeName,afterName,useName,keepName,element('small','Bare navnet kan kopieres. Omtaler, historier, roller og dugnadsutgaver beholdes.'));identityArea.append(identityNote,nameChoice);
    const sameIdentity=()=>!!selectedRunner&&(identityConfirmed.checked||selectedRunner.linkedToThisHonor===true&&!runnerChoice);
    function syncNameChoice(){
      useName.disabled=!sameIdentity();keepName.hidden=!((nameBeforeReuse??name.value).trim());
      if(selectedRunner){beforeName.textContent='Heder-navn: '+((nameBeforeReuse??name.value)||'Ikke oppgitt');afterName.textContent='Løpernavn: '+selectedRunner.name;}
    }
    function chooseRunner(c){
      selectedRunner=c;nameBeforeReuse=null;identityConfirmed.closest('label').firstChild.textContent='Jeg bekrefter at dette er samme person (bare i utkastet)';nameChoice.hidden=false;identityArea.hidden=false;
      if(c.linkedToThisHonor){runnerChoice=null;identityConfirmed.checked=true;identityConfirmed.disabled=true;identityNote.textContent='Koblingen er allerede bekreftet. Du velger selv om løpernavnet skal brukes.';}
      else{runnerChoice={action:'link',runnerId:c.runnerId};identityConfirmed.disabled=false;identityConfirmed.checked=false;identityNote.textContent='Valgt løper: '+c.name+'. Bekreft først at dette er samme person. Koblingen blir bare et utkast.';}
      changed();
    }
    async function searchRunners(){
      const ticket=++runnerTicket,query=runnerSearch.value.trim();runnerResults.replaceChildren(element('p','Søker …','hint'));
      try{
        const params=new URLSearchParams({q:query});if(!e.isNew)params.set('personId',e.personId);
        const result=await api('honors/runner-candidates?'+params);
        if(state.honorEditor!==editor||ticket!==runnerTicket||runnerSearch.value.trim()!==query)return;
        runnerResults.replaceChildren();
        for(const c of result.candidates){
          const row=honorCandidateRow(c),choose=button('Velg kandidat',()=>chooseRunner(c));choose.disabled=c.linkedToOtherHonor;row.append(choose);runnerResults.append(row);
        }
        if(!result.candidates.length)runnerResults.append(element('p','Ingen aktuelle løpere funnet. Personen kan registreres uten løperkobling.'));
      }catch(error){if(state.honorEditor===editor&&ticket===runnerTicket)runnerResults.replaceChildren(element('p',error.message));}
    }
    runnerBox.append(button('Finn løperkandidater for utkastet',searchRunners));
    runnerSearch.addEventListener('input',()=>{runnerTicket++;runnerResults.replaceChildren();});runnerSearch.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchRunners();}});
    if(e.existing?.runnerLink){const remove=honorSection('Endre eksisterende kobling',advanced.body);remove.body.append(element('p','Registrert profil-ID: '+e.existing.runnerLink.runnerId),button('Foreslå å fjerne løperkoblingen',()=>{runnerChoice={action:'remove',runnerId:null};selectedRunner=null;identityArea.hidden=false;nameChoice.hidden=true;identityConfirmed.disabled=false;identityConfirmed.checked=false;identityNote.textContent='Bekreft fjerningen separat. Gjeldende kobling er uendret.';identityConfirmed.closest('label').firstChild.textContent='Jeg bekrefter å fjerne koblingen i utkastet';changed();}));}
    runnerBox.append(runnerResults);
    const previewBox=element('div',undefined,'honor-draft-preview');previewBox.id='honorDraftPreview';detail.append(previewBox);
    const reviewLabel=element('label'),reviewed=element('input');reviewed.type='checkbox';reviewed.id='honorDraftReviewed';reviewLabel.append(reviewed,document.createTextNode('Jeg har gjennomgått de konkrete utgavene og fraværet i denne forhåndsvisningen.'));
    const checks=honorSection('Kontroller og lagring',advanced.body,'honorDraftChecks');if(web)checks.body.append(reviewLabel);else detail.append(reviewLabel);
    const keep=button(web?'Lagring krever innlogging':'Behold utkast i økten',async()=>{
      if(!editor.preview)return;
      try{
        const result=await honorDraftApi('keep',{...binding(),previewId:editor.preview.previewId,editionsReviewed:reviewed.checked});e.revision=result.revision;editor.dirty=false;editor.preview=null;keep.disabled=true;await loadHonorDrafts();message.textContent=result.message;
      }catch(error){message.textContent=error.message;}
    });keep.id='honorDraftKeep';keep.disabled=true;
    if(web){keep.title=e.storageBlocker;checks.body.append(element('p',e.storageBlocker,'hint'));}
    detail.append(button('Forhåndsvis endringene',preview),keep,button('Forkast øktutkast',async()=>{
      if(!confirm('Forkaste øktutkastet? Gjeldende personregister blir ikke endret.'))return;
      try{await honorDraftApi('discard',binding());state.honorEditor=null;selectHonor(e.existing);await loadHonorDrafts();status('Øktutkastet er forkastet. Gjeldende register er uendret.');}catch(error){message.textContent=error.message;}
    }),button('Lukk redigering',async()=>{if(editor.dirty&&!confirm('Forhåndsvisningsendringene er ikke beholdt. Vil du lukke?'))return;if(web)await honorDraftApi('discard',binding());state.honorEditor=null;selectHonor(e.existing);}));
    const binding=()=>({draftId:e.draftId,revision:e.revision,baseVersion:e.baseVersion});
    const number=input=>input.value===''?null:Number(input.value);
    function values(){
      return {name:name.value,shortDescription:description.value,honorDiplomaText:tribute.value,
        roles:[...roleRows.children].map(row=>({key:row.dataset.key||null,title:row.querySelector('[data-field="title"]').value,countsForTenure:row.querySelector('[data-field="countsForTenure"]').checked,fromYear:number(row.querySelector('[data-field="fromYear"]')),toYear:number(row.querySelector('[data-field="toYear"]'))})),
        stories:[...storyRows.children].map(row=>({key:row.dataset.key||null,title:row.querySelector('[data-field="title"]').value,text:row.querySelector('[data-field="text"]').value,sourceNote:row.querySelector('[data-field="sourceNote"]').value})),
        memorial:{enabled:memorial.checked,deathYear:number(death),tribute:memorialText.value},
        tenure:{mode:mode.value,selectedEditionIds:[...yearRows].filter(([,r])=>r.selected.checked).map(([id])=>id),
          excludedEditionIds:[...yearRows].filter(([,r])=>r.excluded.checked).map(([id])=>id),fromEditionId:from.value||null,toEditionId:to.value||null,stillActive:active.checked}};
    }
    function syncMode(){
      periodBox.hidden=mode.value!=='period';death.disabled=memorialText.disabled=!memorial.checked;
      active.disabled=memorial.checked;active.closest('label').hidden=mode.value!=='period';to.disabled=active.checked;
      for(const [id,row] of yearRows){row.selected.closest('.honor-draft-edition').classList.toggle('is-absent',row.excluded.checked);row.selected.closest('label').firstChild.textContent=editionLabel(held.find(x=>x.editionId===id))+(row.excluded.checked?' · fravær':'');}
      for(const row of yearRows.values())row.selected.disabled=row.excluded.disabled=!['period','documented'].includes(mode.value);
    }
    function syncKeep(){keep.disabled=web||!editor.preview||editor.preview.needsEditionReview&&!reviewed.checked||!!runnerChoice&&!identityConfirmed.checked;}
    let timer;
    function changed(){
      editor.dirty=true;editor.preview=null;editor.request++;reviewed.checked=false;keep.disabled=true;syncMode();syncNameChoice();
      rolesBrief.textContent=[...roleRows.querySelectorAll('[data-field="title"]')].map(n=>n.value).filter(Boolean).join(' · ')||'Ingen roller oppgitt';clearTimeout(timer);timer=setTimeout(preview,300);
    }
    async function preview(){
      clearTimeout(timer);const ticket=++editor.request;keep.disabled=true;
      try{
        const identityReview=runnerChoice&&identityConfirmed.checked?{...runnerChoice,confirmed:true}:null;
        const result=await honorDraftApi('preview',{...binding(),fields:values(),identityReview});
        if(state.honorEditor!==editor||ticket!==editor.request)return;
        editor.preview=result;previewBox.replaceChildren(element('h4','Forhåndsvisning · ikke publisert'));
        const profile=result.profile,achievement=element('div',undefined,'honor-card-achievement');previewBox.append(element('h3',profile.name));achievement.append(metric('Dugnadsutgaver',profile.tenure.registeredEditions??'Ukjent',profile.tenure.basis==='documented'?'Eksplisitte utgavevalg i utkastet':profile.tenure.basis==='registered-period'?'Foreslåtte utgaver – ikke dokumenterte enkeltår':profile.tenure.basis==='approved-total'?'Godkjent total uten konstruerte enkeltår':'Ingen sikker opptelling'));
        previewBox.append(achievement);
        previewBox.append(element('p','Gjeldende register: '+(result.consequences.beforeCount??'ukjent antall')+' · Øktutkast: '+(result.consequences.afterCount??'ukjent antall')+' utgaver.','hint'));
        if(result.mainBadge){const medal=image({src:new URL(result.mainBadge.src,window.MorothonAdminTransport?.rootUrl||new URL('/site/',location.href)).href,name:result.mainBadge.name},'honor-draft-main');achievement.prepend(medal);achievement.append(element('strong',result.mainBadge.name));}
        const collection=element('div',undefined,'honor-draft-badges');for(const b of [...(result.secondaryBadges||[]),...result.badges].filter((b,i,all)=>b.id!==result.mainBadge?.id&&all.findIndex(x=>x.id===b.id)===i)){const item=element('span',b.name);if(b.src)item.prepend(image({src:new URL(b.src,window.MorothonAdminTransport?.rootUrl||new URL('/site/',location.href)).href,name:b.name},'honor-draft-badge'));collection.append(item);}previewBox.append(collection);
        const extraPreview=honorSection('Flere opplysninger i forhåndsvisningen',previewBox,'honorPreviewMore');extraPreview.body.append(collection);
        if(profile.badges.next)previewBox.append(element('p',profile.tenure.registeredEditions===null?'Neste dugnadsmerke beregnes når utgavene er avklart.':profile.badges.next.remaining+' utgaver til neste nivå ('+profile.badges.next.editions+').'));
        extraPreview.body.append(element('p',result.qualifier,'hint'),element('p','Valgte utgaver: '+(result.selectedEditionIds.map(id=>editionLabel(held.find(x=>x.editionId===id))).join(', ')||'Ingen kjente enkeltutgaver')));
        if(profile.shortDescription)previewBox.append(element('p',profile.shortDescription));
        for(const story of profile.stories){if(story.title)extraPreview.body.append(element('h5',story.title));extraPreview.body.append(element('p',story.text));}
        if(profile.honorDiplomaText)extraPreview.body.append(element('p','Diplomtekst (kun tekstforhåndsvisning): '+profile.honorDiplomaText));
        const diff=element('details');diff.id='honorPreviewDiff';diff.append(element('summary','Endringer mot gjeldende register: '+result.diff.length));
        for(const change of result.diff){const row=element('div',undefined,'honor-draft-diff');row.append(element('h5',change.label),element('pre','Før: '+JSON.stringify(change.before,null,2)),element('pre','Utkast: '+JSON.stringify(change.after,null,2)));diff.append(row);}extraPreview.body.append(diff);
        if(runnerChoice&&!identityConfirmed.checked)previewBox.append(element('p','Kandidaten er ikke tatt med før du bekrefter identiteten separat.','hint'));
        if(!web)reviewLabel.hidden=!result.needsEditionReview;
        yearSection.summary.textContent='Dugnadsutgaver · '+(profile.tenure.registeredEditions??'uavklart antall')+(profile.tenure.basis==='registered-period'?' (periodeforslag)':'');
        message.textContent=web?'Forhåndsvisningen er kontrollert. Endringene finnes bare i denne fanen og er ikke lagret.':'Forhåndsvisningen er kontrollert. Ingen endringer er lagret varig.';syncKeep();
      }catch(error){if(state.honorEditor===editor&&ticket===editor.request){editor.preview=null;keep.disabled=true;previewBox.replaceChildren(element('p',error.message));message.textContent='Kontroller feltene før du beholder utkastet.';}}
    }
    let previousMode=mode.value;
    mode.addEventListener('change',()=>{if(mode.value!==previousMode){for(const row of yearRows.values())row.selected.checked=false;if(mode.value!=='period')active.checked=false;previousMode=mode.value;changed();}});
    memorial.addEventListener('change',()=>{if(memorial.checked)active.checked=false;else{if((death.value||memorialText.value)&&!confirm('Fjerne minneopplysningene fra utkastet?')){memorial.checked=true;return;}death.value='';memorialText.value='';}changed();});
    active.addEventListener('change',()=>{if(active.checked)to.value='';});
    form.addEventListener('input',event=>{if(event.target!==runnerSearch&&event.target!==reviewed)changed();});form.addEventListener('change',event=>{if(event.target!==runnerSearch&&event.target!==reviewed)changed();});reviewed.addEventListener('change',syncKeep);
    syncMode();if(initialCandidate)chooseRunner(initialCandidate);if(e.fields.name.trim())await preview();else previewBox.append(element('p','Fyll inn navn for å starte forhåndsvisningen.'));
  }
  window.addEventListener('beforeunload',event=>{if(state.honorEditor?.dirty){event.preventDefault();event.returnValue='';}});
  async function lookupHonorRunner(personId, query) {
    const ticket = ++state.honorRequest, target = $('honorRunnerCandidates');
    if (!target || query.trim().length < 2) { if (target) target.replaceChildren(element('p','Skriv minst to tegn.','hint')); return; }
    target.replaceChildren(element('p','Søker …','hint'));
    try {
      const params = new URLSearchParams({q:query}); if (personId) params.set('personId',personId);
      const result = await api('honors/runner-candidates?' + params);
      if (ticket !== state.honorRequest || state.section !== 'heder'||$('honorRunnerSearch')?.value.trim()!==query.trim()) return;
      target.replaceChildren(...(result.candidates.length ? result.candidates.map(c => {
        const item=honorCandidateRow(c),pick=button(personId?'Koble til denne løperen':'Opprett Heder-utkast',()=>openHonorEditor(personId,null,c).catch(e=>status(e.message)));
        pick.disabled=c.linkedToOtherHonor;item.append(pick);
        return item;
      }) : [element('p','Ingen aktuelle løpere funnet.','hint')]));
    } catch (e) {
      if (ticket === state.honorRequest) target.replaceChildren(element('p',e.message,'hint'));
    }
  }
  async function route() {
    const profile = window.MorothonAdminTransport ? await MorothonAdminTransport.ready : null;
    if (profile) for (const [key, value] of Object.entries(profile.texts.pages)) pages[key] = [value.title, value.description];
    let key = location.hash.slice(1);
    // Heder can be disabled for this organizer; direct #heder links must
    // not bypass the same token-protected module check as sidebar navigation.
    if (key === 'heder' && (window.MorothonAdminTransport?!MorothonAdminTransport.capabilities.honorEnabled:document.querySelector('[name="local-honor-enabled"]')?.content !== 'true')) key = 'oversikt';
    if (key === 'heder' && !state.honorData?.enabled) {
      try {
        const data = await api('honors');
        if (!data?.enabled || !data.readOnly || !Array.isArray(data.people)) key = 'oversikt';
        else { state.honorData = data; if ($('navHeder')) $('navHeder').hidden = false; }
      } catch { key = 'oversikt'; }
    }
    if (!pages[key] || profile && !['design','rettelser','heder'].includes(key) && !profile.modules[key]) { key = 'oversikt'; }
    if (location.hash.slice(1) !== key) history.replaceState(null, '', '#' + key);
    if(state.section==='heder'&&key!=='heder'&&state.honorEditor?.dirty&&!confirm('Forhåndsvisningen er ikke lagret. Vil du forlate redigeringen?')){history.replaceState(null,'','#heder');return;}
    if(window.MorothonAdminTransport&&state.section==='heder'&&key!=='heder'&&state.honorEditor){await honorDraftApi('discard',honorBinding(state.honorEditor));state.honorEditor=null;$('honorDetail').replaceChildren();}
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
  if(window.MorothonAdminTransport)MorothonAdminTransport.ready.then(initHeder).catch(e=>status(e.message));else initHeder();
  const navigate = () => route().catch(e => status(e.message));
  window.addEventListener('hashchange', navigate); navigate();
})();
