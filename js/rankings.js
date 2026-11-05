/* Morothon V24: historiske topptider etter løpsnavn, oppgitt distanse og kjønn.
   Ingen sluttider fra ulike distanser blandes, og lik kilometerlengde er ikke
   dokumentasjon på identisk løypetrasé. Datakilde: eksisterende history.json. */
(function () {
  'use strict';

  const MAIN = 'Morothon|20 km';
  const SHORT = 'Kortmoro|10 km';
  const state = { period: 'new', eventDistance: MAIN, gender: 'Herre', mode: 'unique', limit: 10 };
  const indexed = new Map();
  const byEventDistance = new Map();
  const periodOf = (year) => Number(year) >= 2014 ? 'new' : 'old';
  const periodLabel = (period) => period === 'new' ? '2014 og nyere' : 'Før 2014 (1992–2013)';
  const $id = (id) => document.getElementById(id);
  const safe = (v) => esc(String(v ?? ''));

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '–';
    const t = Math.round(seconds);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }

  // En ranking for damer og en for herrer per kombinasjon av distanse/løp.
  function indexResults() {
    indexed.clear();
    byEventDistance.clear();
    for (const r of S.results) {
      if (r[2] !== 'Morothon' && r[2] !== 'Kortmoro') continue;
      if (!isCompletedResult(r) || isRelayRace(r) || isJuniorRace(r)) continue;
      const distance = String(r[3] || '').trim();
      if (!/^\d+(?:[,.]\d+)?\s*km$/i.test(distance)) continue;
      const p = person(r[1]);
      if (!p || (p.g !== 'Dame' && p.g !== 'Herre')) continue;
      const seconds = timeSeconds(r[5]);
      if (!Number.isFinite(seconds) || seconds <= 0) continue;
      const eventDistance = `${r[2]}|${distance}`;
      const period = periodOf(r[0]);
      const groupKey = `${period}|${eventDistance}|${p.g}`;
      if (!indexed.has(groupKey)) indexed.set(groupKey, []);
      indexed.get(groupKey).push({ pid: p.i, name: p.n, year: r[0], seconds, eventDistance });
      const distPeriod = `${period}|${eventDistance}`;
      if (!byEventDistance.has(distPeriod)) byEventDistance.set(distPeriod, new Set());
      byEventDistance.get(distPeriod).add(r[0]);
    }
    for (const [key, rows] of indexed) {
      rows.sort((a, b) => a.seconds - b.seconds || a.year - b.year || a.name.localeCompare(b.name, 'no'));
      const fastestByPid = new Map();
      rows.forEach((r, i) => {
        r.allRank = i > 0 && r.seconds === rows[i - 1].seconds ? rows[i - 1].allRank : i + 1;
        if (!fastestByPid.has(r.pid)) fastestByPid.set(r.pid, r);
      });
      const unique = [...fastestByPid.values()];
      unique.forEach((r, i) => {
        r.uniqueRank = i > 0 && r.seconds === unique[i - 1].seconds ? unique[i - 1].uniqueRank : i + 1;
      });
      indexed.set(key, { all: rows, unique, byPid: fastestByPid });
    }
  }

  function eventLabel(eventDistance) {
    const [event, distance] = eventDistance.split('|');
    return `${event === 'Morothon' ? 'Langmoro' : 'Kortmoro'} · ${distance}`;
  }

  function yearsDescription(yearSet) {
    if (!yearSet || !yearSet.size) return 'Ingen registrerte løp';
    const years = [...yearSet].sort((a, b) => a - b);
    const sections = [];
    let first = years[0], last = first;
    for (const y of years.slice(1)) {
      if (y === last + 1) last = y;
      else { sections.push(first === last ? String(first) : `${first}–${last}`); first = last = y; }
    }
    sections.push(first === last ? String(first) : `${first}–${last}`);
    return sections.join(' · ');
  }

  function availableDistanceOptions() {
    const other = [...byEventDistance.keys()]
      .filter((k) => k.startsWith(`${state.period}|`))
      .map((k) => k.slice(state.period.length + 1))
      .filter((k) => k !== MAIN && k !== SHORT);
    const numericDistance = (k) => Number(k.split('|')[1].split(' ')[0].replace(',', '.'));
    other.sort((a, b) => {
      const aEvent = a.startsWith('Morothon|') ? 0 : 1;
      const bEvent = b.startsWith('Morothon|') ? 0 : 1;
      return aEvent - bEvent || numericDistance(b) - numericDistance(a) || a.localeCompare(b, 'no');
    });
    const el = $id('rankingOther');
    el.innerHTML = '<option value="">Andre distanser i perioden …</option>' + other.map((k) =>
      `<option value="${safe(k)}">${safe(eventLabel(k))}</option>`
    ).join('');
  }

  function render() {
    const target = $id('rankingResults');
    if (!target) return;
    for (const btn of document.querySelectorAll('[data-ranking-period]')) {
      const active = btn.dataset.rankingPeriod === state.period;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    for (const btn of document.querySelectorAll('[data-ranking-preset]')) {
      const active = btn.dataset.rankingPreset === state.eventDistance;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    for (const btn of document.querySelectorAll('[data-ranking-gender]')) {
      const active = btn.dataset.rankingGender === state.gender;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    const other = $id('rankingOther');
    other.value = [...other.options].some((o) => o.value === state.eventDistance) ? state.eventDistance : '';
    $id('rankingMode').value = state.mode;
    $id('rankingLimit').value = String(state.limit);

    const group = indexed.get(`${state.period}|${state.eventDistance}|${state.gender}`);
    if (!group || !group.all.length) {
      target.innerHTML = '<p class="moro-ranking-empty">Ingen fullførte løp med gyldig tid i denne kategorien.</p>';
      return;
    }
    const list = state.mode === 'unique' ? group.unique : group.all;
    const shown = state.limit === 'all' ? list : list.slice(0, Number(state.limit));
    const years = yearsDescription(byEventDistance.get(`${state.period}|${state.eventDistance}`));
    const descriptor = state.mode === 'unique' ? 'beste registrerte tid per løper' : 'alle fullførte løp';
    const title = eventLabel(state.eventDistance);
    const rows = shown.map((r) => {
      const place = state.mode === 'unique' ? r.uniqueRank : r.allRank;
      const medal = place <= 3 ? ` is-medal-${place}` : '';
      return `<div class="moro-ranking-row" role="row">
        <span class="moro-ranking-place${medal}" role="cell">${place}</span>
        <button class="moro-ranking-person" type="button" data-ranking-person="${safe(r.pid)}" role="cell"><strong>${safe(r.name)}</strong><span>Se løperprofil</span></button>
        <strong class="moro-ranking-time" role="cell">${formatTime(r.seconds)}</strong>
        <span class="moro-ranking-year" role="cell">${r.year}</span>
      </div>`;
    }).join('');

    target.innerHTML = `<div class="moro-ranking-summary"><div>
      <h3>${safe(title)} <span>· ${state.gender === 'Dame' ? 'Damer' : 'Herrer'}</span></h3>
      <p class="moro-ranking-era">${safe(periodLabel(state.period))}</p>
      <p>${group.unique.length.toLocaleString('no-NO')} løpere · ${group.all.length.toLocaleString('no-NO')} fullførte løp</p>
      <p class="moro-ranking-years">Registrerte år med denne distansen: ${safe(years)}</p>
      </div><span class="moro-ranking-modeinfo">${safe(descriptor)}</span></div>
      <div class="moro-ranking-table" role="table" aria-label="Topptider ${safe(title)}, ${state.gender}">
        <div class="moro-ranking-row moro-ranking-head" role="row"><span role="columnheader">#</span><span role="columnheader">Løper</span><span role="columnheader">Tid</span><span role="columnheader">År</span></div>
        ${rows}</div>
      <p class="moro-ranking-foot">Viser ${shown.length.toLocaleString('no-NO')} av ${list.length.toLocaleString('no-NO')} ${state.mode === 'unique' ? 'løpere' : 'resultater'} i valgt kategori. Ved like tider deles plasseringen.</p>
      <p class="moro-ranking-warning"><strong>Viktig om historiske tider:</strong> Løypeendringen i 2014 er et skille: resultater fra før og etter 2014 blandes aldri. Innen hver periode sorteres det etter registrert løpsnavn, antall kilometer og kjønn. Samme distanse kan likevel ha ulik trasé og ulike forhold mellom år. Dagens standarddistanser, 20 km Langmoro og 10 km Kortmoro, er registrert fra 2021. Listene er <strong>historiske topptider</strong>, ikke automatisk offisielle løyperekorder.</p>`;
  }

  function profileHtml(pid) {
    const p = person(pid);
    if (!p || (p.g !== 'Dame' && p.g !== 'Herre')) return '';
    const items = [];
    // Hold løpsperioder atskilt også i den personlige rangeringen.
    for (const period of ['new', 'old']) {
      const distances = [...byEventDistance.keys()]
        .filter((k) => k.startsWith(`${period}|`))
        .map((k) => k.slice(period.length + 1));
      const ordered = [MAIN, SHORT, ...distances.filter((d) => d !== MAIN && d !== SHORT)];
      for (const eventDistance of ordered) {
        const group = indexed.get(`${period}|${eventDistance}|${p.g}`);
        const r = group?.byPid.get(p.i);
        if (!r) continue;
        items.push(`<div class="moro-profile-ranking-item"><span>${safe(eventLabel(eventDistance))} · ${safe(periodLabel(period))}</span>
          <strong>Nr. ${r.uniqueRank} av ${group.unique.length.toLocaleString('no-NO')}</strong>
          <small>Beste registrerte tid ${formatTime(r.seconds)} (${r.year})</small></div>`);
      }
    }
    if (!items.length) return '';
    return `<section class="moro-profile-rankings"><h3>Min historiske plassering</h3>
      <p class="moro-profile-era-note">Historikken er delt ved løypeendringen i 2014. Rangeringer fra før og etter 2014 sammenlignes ikke.</p>
      <div class="moro-profile-ranking-grid">${items.join('')}</div>
      <p>Hver rangering gjelder samme registrerte distanse, kjønn og periode. Lik distanse betyr ikke nødvendigvis identisk løypetrasé.</p></section>`;
  }

  function init() {
    if (!$id('rankingResults') || !S?.data) return;
    indexResults();
    availableDistanceOptions();
    for (const btn of document.querySelectorAll('[data-ranking-period]')) {
      btn.addEventListener('click', () => {
        state.period = btn.dataset.rankingPeriod;
        availableDistanceOptions();
        render();
      });
    }
    for (const btn of document.querySelectorAll('[data-ranking-preset]')) {
      btn.addEventListener('click', () => { state.eventDistance = btn.dataset.rankingPreset; render(); });
    }
    for (const btn of document.querySelectorAll('[data-ranking-gender]')) {
      btn.addEventListener('click', () => { state.gender = btn.dataset.rankingGender; render(); });
    }
    $id('rankingOther').addEventListener('change', (e) => {
      if (!e.target.value) return;
      state.eventDistance = e.target.value;
      render();
    });
    $id('rankingMode').addEventListener('change', (e) => { state.mode = e.target.value; render(); });
    $id('rankingLimit').addEventListener('change', (e) => { state.limit = e.target.value; render(); });
    $id('rankingResults').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ranking-person]');
      if (btn) openProfile(btn.dataset.rankingPerson);
    });
    render();
  }

  window.MorothonRankings = { init, render, profileHtml, indexResults, getState: () => ({ ...state }) };
})();
