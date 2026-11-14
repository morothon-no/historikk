/* Plain local UI. Names, status and errors are always inserted as text. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), token = document.querySelector('[name="local-session"]')?.content;
  const state = { people: [], jobs: [], checked: null, busy: false, limit: 40, max: 100 };
  const words = { approved: 'Godkjent', control: 'Kontrollkopi', blocked: 'Sperret', pending: 'Ikke kontrollert' };
  const itemKey = i => [i.kind, i.personId, i.key, i.display].join('|');
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  function button(text, fn, cls = 'secondary') { const b = node('button', text, cls); b.type = 'button'; b.disabled = state.busy; b.onclick = fn; return b; }
  async function api(route, body) {
    if (window.MorothonAdminTransport) return MorothonAdminTransport.request(route, body);
    if (document.body.dataset.adminMode === 'public-preview') throw Error('Nettadapteren kunne ikke lastes. Last siden på nytt.');
    const response = await fetch('/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Morothon-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Handlingen kunne ikke fullføres.'); return data;
  }
  function message(text) { $('message').textContent = text; }
  function choice(p) {
    const value = $('achievement').value;
    if (p.kind === 'honor') return value === 'highest' ? p.options[0] : null;
    return p.options.find(o => o.key === (value === 'highest' ? p.defaultKey : value) && (value !== 'highest' || o.type === 'badge')) || (value === 'record' ? p.options.find(o => o.type === 'record') : null);
  }
  function filtered() {
    const query = $('search').value.toLocaleLowerCase('nb-NO').trim(), kind = $('kind').value, year = $('year').value;
    return state.people.filter(p => (kind === 'all' || p.kind === kind) && (!query || [p.name, ...p.aliases].some(n => n.toLocaleLowerCase('nb-NO').includes(query))))
      .map(p => ({ p, o: choice(p) })).filter(({ o }) => o && (year === 'all' || String(o.year) === year));
  }
  const selected = ({ p, o }) => ({ kind: p.kind, personId: p.personId, key: o.key, display: $('display').value });
  function invalidate() { state.checked = null; for (const j of state.jobs) delete j.checked; $('downloads').hidden = true; }
  function add(items) {
    const keys = new Set(state.jobs.map(j => itemKey(j.item))), additions = items.filter(i => !keys.has(itemKey(i)) && keys.add(itemKey(i)));
    if (state.jobs.length + additions.length > state.max) throw Error(`Piloten støtter inntil ${state.max} diplomer per jobb. Avgrens søket eller del utvalget.`);
    invalidate(); state.jobs.push(...additions.map(item => ({ item }))); render(); message(`${additions.length} nye diplomer lagt til. Kontroller utvalget før eksport.`);
  }
  function renderResults() {
    const list = filtered(); $('resultCount').textContent = `${list.length} mottakere i utvalget`;
    const results = $('results'); results.replaceChildren();
    for (const entry of list.slice(0, state.limit)) {
      const { p, o } = entry, row = node('article', undefined, 'recipient'), main = node('div'); main.append(node('h3', p.name), node('p', p.kind === 'runner' ? 'Løperdiplom' : 'Heder-diplom'));
      const label = node('label', 'Opptjent prestasjon', 'choice-label'), select = node('select'), controls = node('div', undefined, 'row-actions'), item = selected(entry);
      select.setAttribute('aria-label', 'Prestasjon for ' + p.name); select.disabled = state.busy;
      for (const option of p.options) { const e = node('option', option.label); e.value = option.key; select.append(e); }
      select.value = o.key; select.onchange = () => { item.key = select.value; }; label.append(select);
      controls.append(button('Vis', () => preview(item)), button('Velg', () => run(() => add([item])), ''));
      row.append(main, label, controls); results.append(row);
    }
    if (!list.length) results.append(node('p', 'Ingen mottakere passer til dette utvalget.'));
    $('more').hidden = list.length <= state.limit;
    const current = new Set(state.jobs.map(j => itemKey(j.item))), newCount = list.map(selected).filter(item => !current.has(itemKey(item))).length;
    $('addAll').disabled = state.busy || !list.length || newCount + state.jobs.length > state.max;
    $('addAll').title = newCount + state.jobs.length > state.max ? `Avgrens utvalget til inntil ${state.max} diplomer per jobb.` : 'Legg til alle kvalifiserte i det valgte utvalget';
  }
  function renderJobs() {
    const list = $('job'); list.replaceChildren();
    if (!state.jobs.length) list.append(node('p', 'Ingen mottakere valgt ennå.'));
    state.jobs.forEach((job, index) => {
      const { item, checked } = job, p = state.people.find(p => p.kind === item.kind && p.personId === item.personId), o = p.options.find(o => o.key === item.key);
      const row = node('article', undefined, 'job-row'), main = node('div');
      main.append(node('h3', p.name), node('p', `${p.kind === 'runner' ? 'Løper' : 'Heder'} · ${o.label} · ${item.display === 'all' ? 'Alle merker' : 'Kun siste merke'}`));
      main.append(node('span', words[checked?.status || 'pending'], 'status ' + (checked?.status || 'pending')));
      if (checked?.date || checked?.period) main.append(node('p', [checked.period, checked.date].filter(Boolean).join(' · ')));
      if (checked?.errors?.length) main.append(node('p', checked.errors.join(' '), 'job-errors'));
      const notes = [...checked?.reasons || [], ...checked?.warnings || []];
      if (notes.length) { const details = node('details'), summary = node('summary', 'Grunnlag og bildekvalitet'); details.append(summary, node('p', notes.join(' '))); main.append(details); }
      const controls = node('div', undefined, 'row-actions');
      controls.append(button('Vis', () => preview(item)), button('↑', () => move(index, -1)), button('↓', () => move(index, 1)), button('Fjern', () => { invalidate(); state.jobs.splice(index, 1); render(); }));
      controls.children[1].disabled ||= index === 0; controls.children[1].setAttribute('aria-label', 'Flytt ' + p.name + ' opp'); controls.children[2].disabled ||= index === state.jobs.length - 1; controls.children[2].setAttribute('aria-label', 'Flytt ' + p.name + ' ned');
      row.append(node('span', String(index + 1), 'job-index'), main, controls); list.append(row);
    });
    $('selectedCount').textContent = `${state.jobs.length} diplomer valgt`;
    document.dispatchEvent(new CustomEvent('morothon:diploma-count', { detail: { count: state.jobs.length } }));
    for (const id of ['demo', 'allowControl', 'search', 'kind', 'achievement', 'year', 'display']) $(id).disabled = state.busy;
    for (const b of $('downloads').querySelectorAll('button')) b.disabled = state.busy;
    for (const id of ['check', 'clear']) $(id).disabled = state.busy || !state.jobs.length;
    const blocked = state.jobs.filter(j => j.checked?.status === 'blocked').length, controls = state.jobs.filter(j => j.checked?.status === 'control').length;
    const ready = state.checked && !blocked && (!controls || $('allowControl').checked);
    $('export').disabled = state.busy || !ready || window.MorothonAdminTransport?.capabilities.batchPdf === false; $('report').disabled = state.busy || !state.checked;
    $('exportSummary').textContent = state.checked ? `${state.jobs.length} A4-sider · ${state.jobs.length - controls - blocked} godkjente · ${controls} kontrollkopier · ${blocked} sperrede.` : 'Kontroller utvalget for å se sideantall og eventuelle feil før eksport.';
  }
  function render() { renderResults(); renderJobs(); }
  function move(i, delta) { if (!state.jobs[i + delta]) return; invalidate(); [state.jobs[i], state.jobs[i + delta]] = [state.jobs[i + delta], state.jobs[i]]; render(); }
  async function run(fn) { try { await fn(); } catch (e) { message(e.message); } }
  async function operation(text, fn) {
    if (state.busy) return; state.busy = true; render(); message(text);
    try { await fn(); } catch (e) { message(e.message); } finally { state.busy = false; render(); }
  }
  async function preview(item) {
    await operation('Klargjør forhåndsvisning og kontrollerer diplom …', async () => {
      const result = await api('preview', { items: [item] }), checked = result.entries[0];
      $('previewTitle').textContent = checked.name; $('previewStatus').textContent = [words[checked.status], ...checked.errors || [], ...checked.reasons || []].join(' · ');
      for (const b of document.querySelectorAll('[data-web-print]')) b.disabled = checked.status === 'blocked' || !result.html;
      const frame = $('preview').querySelector('iframe'); frame.srcdoc = result.html || '<p>Diplomet kan ikke klargjøres.</p>';
      const job = state.jobs.find(j => itemKey(j.item) === itemKey(item)); if (job) job.checked = checked;
      if (location.hash === '#diplomer' && !$('preview').open) $('preview').showModal(); fit(); message('Forhåndsvisningen er kontrollert.');
    });
  }
  function fit() {
    const viewport = document.querySelector('.preview-viewport'), frame = viewport.querySelector('iframe'), scale = viewport.clientWidth / 1122.52;
    frame.style.transform = `scale(${scale})`; viewport.style.height = Math.ceil(793.7 * scale + 2) + 'px';
  }
  async function download(path, name) {
    const response = await fetch(path, { headers: { 'X-Morothon-Token': token } });
    if (!response.ok) throw Error((await response.json()).error);
    save(await response.blob(), name);
  }
  function save(blob, name) { const url = URL.createObjectURL(blob), a = node('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  for (const id of ['search', 'kind', 'achievement', 'year', 'display']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { state.limit = 40; renderResults(); });
  $('allowControl').onchange = renderJobs;
  $('more').onclick = () => { state.limit += 40; renderResults(); };
  $('addAll').onclick = () => run(() => add(filtered().map(selected)));
  $('demo').onclick = () => run(() => {
    const names = ['Inger Katherin Dahl Frantzen', 'Finn Gerhard Olsen', 'Gunnar Kåsa', 'Oscar Lohne', 'Einar Danielsen'];
    add(names.map(name => { const p = state.people.find(p => p.name === name && p.kind === (['Oscar Lohne', 'Einar Danielsen'].includes(name) ? 'honor' : 'runner')); if (!p) throw Error('Eksempelmottakeren finnes ikke i denne historikken: ' + name); return { kind: p.kind, personId: p.personId, key: p.defaultKey, display: 'latest' }; }));
  });
  $('clear').onclick = () => { invalidate(); state.jobs = []; render(); };
  $('check').onclick = () => operation(`Kontrollerer ${state.jobs.length} diplomer. Dette kan ta litt tid …`, async () => {
    const result = await api('check', { items: state.jobs.map(j => j.item) }); state.checked = result;
    state.jobs.forEach((j, i) => j.checked = result.entries[i]); message('Kontrollen er ferdig. Se status på hver mottaker.');
  });
  $('export').onclick = () => operation('Lager og kontrollerer samlet PDF. Alle sider, også den siste, kontrolleres …', async () => {
    const result = await api('export', { items: state.jobs.map(j => j.item), allowControlCopies: $('allowControl').checked });
    const downloads = $('downloads'); downloads.replaceChildren(); downloads.hidden = false;
    downloads.append(button(`Last ned PDF · ${result.report.pageCount} sider`, () => run(() => download(`/api/jobs/${result.id}/diplomer.pdf`, 'morothon-diplomer.pdf'))), button('Last ned produksjonsrapport', () => run(() => download(`/api/jobs/${result.id}/rapport.json`, 'morothon-diplomrapport.json'))));
    message(`PDF med ${result.report.pageCount} sider er ferdig og kontrollert. Last ned PDF og rapport nedenfor.`);
  });
  $('report').onclick = () => save(new Blob([JSON.stringify(state.checked, null, 2)], { type: 'application/json' }), 'morothon-kontrollrapport.json');
  for (const b of document.querySelectorAll('[data-web-print]')) b.onclick = async () => {
    const buttons = [...document.querySelectorAll('[data-web-print]')]; buttons.forEach(b => b.disabled = true);
    try { await MorothonAdminTransport.printPreview($('preview').querySelector('iframe')); buttons.forEach(b => b.disabled = false); }
    catch (e) { $('previewStatus').textContent = 'Sperret: ' + e.message; }
  };
  $('closePreview').onclick = () => $('preview').close(); new ResizeObserver(fit).observe(document.querySelector('.preview-viewport'));
  document.addEventListener('morothon:diploma-person', e => {
    const p = state.people.find(p => p.kind === 'runner' && p.personId === e.detail?.id);
    if (!p) { message('Løperens diplomvalg er ikke tilgjengelige ennå. Prøv igjen når historikken er lastet.'); return; }
    $('kind').value = 'runner'; $('search').value = p.name; $('year').value = 'all';
    $('achievement').value = p.defaultKey.startsWith('badge:') ? 'highest' : p.defaultKey.startsWith('record:') ? 'record' : 'debut';
    state.limit = 40; renderResults();
  });
  api('catalog').then(data => {
    state.people = data.people; state.max = data.maxItems;
    const years = [...new Set(data.people.flatMap(p => p.options.map(o => o.year)).filter(Number.isInteger))].sort((a, b) => b - a);
    for (const year of years) { const option = node('option', String(year)); option.value = year; $('year').append(option); }
    render(); message('Klar. Velg et utvalg eller prøv fem mottakere.');
  }).catch(e => message(e.message));
})();
