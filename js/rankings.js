/* Morothon V24: historiske topptider etter løpsnavn, oppgitt distanse og kjønn.
   Ingen sluttider fra ulike distanser blandes, og lik kilometerlengde er ikke
   dokumentasjon på identisk løypetrasé. Datakilde: eksisterende history.json. */
(function () {
  'use strict';

  const MAIN = 'Morothon|20 km';
  const SHORT = 'Kortmoro|10 km';
  const state = { period: 'new', eventDistance: MAIN, gender: 'Herre', mode: 'unique', limit: 5 };
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
    const main = [MAIN, SHORT];
    const other = [...byEventDistance.keys()]
      .filter((k) => k.startsWith(`${state.period}|`))
      .map((k) => k.slice(state.period.length + 1))
      .filter((k) => !main.includes(k));
    const numericDistance = (k) => Number(k.split('|')[1].split(' ')[0].replace(',', '.'));
    other.sort((a, b) => {
      const aEvent = a.startsWith('Morothon|') ? 0 : 1;
      const bEvent = b.startsWith('Morothon|') ? 0 : 1;
      return aEvent - bEvent || numericDistance(b) - numericDistance(a) || a.localeCompare(b, 'no');
    });
    const all = [...main, ...other];
    if (!byEventDistance.has(`${state.period}|${state.eventDistance}`)) {
      state.eventDistance = all.find((k) => byEventDistance.has(`${state.period}|${k}`)) || MAIN;
    }
    const el = $id('rankingDistance');
    if (el) {
      el.innerHTML = `<optgroup label="Hoveddistanser">${main.map((k) => `<option value="${safe(k)}">${safe(eventLabel(k))}</option>`).join('')}</optgroup>`
        + (other.length ? `<optgroup label="Andre distanser">${other.map((k) => `<option value="${safe(k)}">${safe(eventLabel(k))}</option>`).join('')}</optgroup>` : '');
      el.value = state.eventDistance;
    }
    // Older HTML may be cached while the updated JavaScript is already live.
    const legacyOther = $id('rankingOther');
    if (legacyOther) {
      legacyOther.innerHTML = '<option value="">Andre distanser i perioden …</option>' +
        other.map((k) => `<option value="${safe(k)}">${safe(eventLabel(k))}</option>`).join('');
    }
  }

  function nextLimit(n) {
    const stops = [5, 10, 25, 50, 'all'];
    if (n === 'all') return null;
    const pos = stops.indexOf(Number(n));
    return stops[pos + 1] || 'all';
  }

  function render() {
    const target = $id('rankingResults');
    if (!target) return;
    for (const btn of document.querySelectorAll('[data-ranking-period]')) {
      const active = btn.dataset.rankingPeriod === state.period;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    const distance = $id('rankingDistance');
    if (distance) distance.value = state.eventDistance;
    const genderSelect = $id('rankingGenderSelect');
    if (genderSelect) genderSelect.value = state.gender;
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
    const legacyOther = $id('rankingOther');
    if (legacyOther) legacyOther.value = [...legacyOther.options].some((o) => o.value === state.eventDistance) ? state.eventDistance : '';
    if ($id('rankingMode')) $id('rankingMode').value = state.mode;
    if ($id('rankingLimit')) $id('rankingLimit').value = String(state.limit);

    const group = indexed.get(`${state.period}|${state.eventDistance}|${state.gender}`);
    if (!group || !group.all.length) {
      target.innerHTML = `<p class="moro-ranking-empty">Ingen fullførte løp med gyldig tid for ${safe(eventLabel(state.eventDistance))} i valgt periode. Prøv en annen distanse.</p>`;
      return;
    }
    const list = state.mode === 'unique' ? group.unique : group.all;
    const shown = state.limit === 'all' ? list : list.slice(0, Number(state.limit));
    const years = yearsDescription(byEventDistance.get(`${state.period}|${state.eventDistance}`));
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
    const next = nextLimit(state.limit);
    const nextLabel = next === 'all' ? 'Vis alle' : `Vis topp ${next}`;
    const showMore = next !== null && shown.length < list.length;
        target.innerHTML = `<div class="moro-v27-rank-top"><strong>${state.limit === 'all' ? 'Alle' : 'Topp ' + state.limit} ${state.mode === 'all' ? 'tider' : 'løpere'}</strong><span class="moro-v27-rank-meta">${group.unique.length.toLocaleString('no-NO')} løpere · ${group.all.length.toLocaleString('no-NO')} fullføringer · ${safe(years)}</span></div>
      <div class="moro-ranking-table" role="table" aria-label="Topptider ${safe(eventLabel(state.eventDistance))}, ${state.gender}">
        <div class="moro-ranking-row moro-ranking-head" role="row"><span role="columnheader">#</span><span role="columnheader">Løper</span><span role="columnheader">Tid</span><span role="columnheader">År</span></div>
        ${rows}</div>
      ${showMore ? `<button type="button" class="moro-v27-more" data-ranking-show-next="${next}">${nextLabel}</button>` : ''}`;
  }

  function profileHtml(pid) {
    const p = person(pid);
    if (!p || (p.g !== 'Dame' && p.g !== 'Herre')) return '';
    const items = [];
    // All rankings use the person's BEST time, separately by period, distance and gender.
    for (const period of ['new', 'old']) {
      const distances = [...byEventDistance.keys()]
        .filter((k) => k.startsWith(`${period}|`))
        .map((k) => k.slice(period.length + 1));
      const ordered = [MAIN, SHORT, ...distances.filter((d) => d !== MAIN && d !== SHORT)];
      for (const eventDistance of ordered) {
        const group = indexed.get(`${period}|${eventDistance}|${p.g}`);
        const r = group?.byPid.get(p.i);
        if (!r) continue;
        items.push({
          period, eventDistance, rank: r.uniqueRank, total: group.unique.length,
          year: r.year, seconds: r.seconds,
          priority: period === 'new' ? (eventDistance === MAIN ? 0 : eventDistance === SHORT ? 1 : 2)
            : eventDistance === MAIN ? 3 : eventDistance === SHORT ? 4 : 5
        });
      }
    }
    if (!items.length) return '';
    const marks = items.filter((r) => r.rank <= 10)
      .sort((a, b) => a.priority - b.priority || a.rank - b.rank)
      .slice(0, 2);
    const awardHtml = marks.length ? `<div class="moro-rank-awards">${marks.map((r) => {
      const label = r.rank === 1 ? 'Historisk ener' : r.rank <= 3 ? 'Historisk pallplass' : 'Historisk topp 10';
      const cls = r.rank === 1 ? 'is-first' : r.rank === 2 ? 'is-second' : r.rank === 3 ? 'is-third' : '';
      return `<button class="moro-rank-award ${cls}" type="button" onclick="window.MorothonRankings.openProfileRankings()" aria-label="Åpne mine historiske plasseringer">
        <span class="moro-rank-award-icon" aria-hidden="true">${r.rank <= 3 ? '★' : '🏅'}</span>
        <span class="moro-rank-award-content"><strong>${label} · Nr. ${r.rank}</strong><small>${safe(eventLabel(r.eventDistance))} · ${safe(periodLabel(r.period))} · ${p.g === 'Herre' ? 'Herrer' : 'Damer'}</small></span>
        <span class="moro-rank-award-chevron" aria-hidden="true">⌄</span></button>`;
    }).join('')}</div>` : '';
    const rowHtml = items.map((r) => `<div class="moro-profile-ranking-item">
      <span>${safe(eventLabel(r.eventDistance))} · ${safe(periodLabel(r.period))}</span>
      <strong>Nr. ${r.rank} av ${r.total.toLocaleString('no-NO')}</strong>
      <small>Beste registrerte tid ${formatTime(r.seconds)} (${r.year})</small>
    </div>`).join('');
    const best = [...items].sort((a,b)=>a.rank-b.rank||a.priority-b.priority)[0];
    const summary = `${items.length} ${items.length===1?'rangering':'rangeringer'} · beste plassering: nr. ${best.rank}`;
    return `${awardHtml}<details class="moro-profile-disclosure" id="profileRankingDisclosure"><summary>
      <span><b>Mine historiske plasseringer</b><small>${safe(summary)} – trykk for alle distanser</small></span><span class="moro-disclosure-arrow" aria-hidden="true">⌄</span>
      </summary><section class="moro-profile-rankings"><div class="moro-profile-ranking-grid">${rowHtml}</div>
      <p>Resultater fra før og etter løypeendringen i 2014 sammenlignes ikke. Rangeringene gjelder samme oppgitte distanse og kjønn. Lik distanse betyr ikke nødvendigvis identisk trasé.</p></section></details>`;
  }

  function openProfileRankings() {
    const section = $id('profileRankingDisclosure');
    if (!section) return;
    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    // Support both V27 selectors and V26 buttons to avoid a fatal error
    // when Safari/CDN serves an older cached HTML with newer JavaScript.
    const distance = $id('rankingDistance');
    if (distance) distance.addEventListener('change', (e) => {
      state.eventDistance = e.target.value;
      render();
    });
    const genderSelect = $id('rankingGenderSelect');
    if (genderSelect) genderSelect.addEventListener('change', (e) => {
      state.gender = e.target.value;
      render();
    });
    for (const btn of document.querySelectorAll('[data-ranking-preset]')) {
      btn.addEventListener('click', () => { state.eventDistance = btn.dataset.rankingPreset; render(); });
    }
    for (const btn of document.querySelectorAll('[data-ranking-gender]')) {
      btn.addEventListener('click', () => { state.gender = btn.dataset.rankingGender; render(); });
    }
    const legacyOther = $id('rankingOther');
    if (legacyOther) legacyOther.addEventListener('change', (e) => {
      if (!e.target.value) return;
      state.eventDistance = e.target.value;
      render();
    });
    if ($id('rankingMode')) $id('rankingMode').addEventListener('change', (e) => { state.mode = e.target.value; render(); });
    if ($id('rankingLimit')) $id('rankingLimit').addEventListener('change', (e) => { state.limit = e.target.value; render(); });
    $id('rankingResults').addEventListener('click', (e) => {
      const profile = e.target.closest('[data-ranking-person]');
      if (profile) { openProfile(profile.dataset.rankingPerson); return; }
      const more = e.target.closest('[data-ranking-show-next]');
      if (more) { state.limit = more.dataset.rankingShowNext === 'all' ? 'all' : Number(more.dataset.rankingShowNext); render(); }
    });
    render();
  }

  window.MorothonRankings = { init, render, profileHtml, indexResults, openProfileRankings, getState: () => ({ ...state }) };
})();
