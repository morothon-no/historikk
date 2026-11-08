/* Annual milestones share the calendar's canonical person IDs and participation rules. */
(function () {
  'use strict';
  const state = { year: null, category: 'debut', limit: 10 };
  const safe = value => esc(String(value ?? ''));
  const byName = (a, b) => a.n.localeCompare(b.n, 'no') || a.i.localeCompare(b.i);

  function calculate(year) {
    const participants = [], debutants = [];
    const badges = PARTICIPATION_BADGES.map(badge => ({ badge, people: [] }));
    for (const p of S.people) {
      // Future results must never move a historical debut or badge to another year.
      const years = startedYears(p).filter(y => y <= year);
      if (years.at(-1) !== year) continue;
      participants.push(p);
      if (years.length === 1) debutants.push(p);
      const category = badges.find(item => item.badge.n === years.length);
      if (category) category.people.push(p);
    }
    participants.sort(byName);
    debutants.sort(byName);
    for (const item of badges) item.people.sort(byName);
    return { year, participants, debutants, badges: badges.filter(item => item.people.length),
      awardCount: badges.reduce((sum, item) => sum + item.people.length, 0) };
  }

  function renderHome() {
    const result = calculate(S.lastYear);
    document.getElementById('annualMilestones').innerHTML = `
      <div class="annual-top"><div class="annual-intro"><p class="kicker">${result.year} · MOROTHON-HISTORIEN VOKSER</p>
      <h2>Årets milepæler</h2><p>Første start og nye deltakelsesmerker i ${result.year}.</p></div>
      <div class="annual-stat"><strong>${result.debutants.length}</strong><span>debutanter</span></div>
      <div class="annual-stat"><strong>${result.awardCount}</strong><span>løpere med nytt merke</span></div></div>
      <div class="annual-categories">${result.badges.map(item => `<span class="annual-chip"><b>${item.people.length}</b>${safe(item.badge.name)}</span>`).join('')}</div>
      <div class="annual-footer"><p>${result.participants.length} individuelle deltakere · maks én deltakelse per år</p>
      <button class="btn" type="button" id="openYearMilestones">Se årets milepæler</button></div>`;
  }

  function renderYear(year) {
    const result = calculate(year);
    const categories = [
      { key: 'debut', label: 'Debutanter', people: result.debutants, count: 1 },
      ...result.badges.map(item => ({ key: String(item.badge.n), label: item.badge.name, people: item.people, count: item.badge.n }))
    ];
    if (state.year !== year) { state.year = year; state.category = 'debut'; state.limit = 10; }
    const chosen = categories.find(item => item.key === state.category) || categories[0];
    state.category = chosen.key;
    const shown = chosen.people.slice(0, state.limit);
    document.getElementById('yearMilestones').innerHTML = `
      <h3 id="yearMilestonesTitle">Årets milepæler · ${year}</h3>
      <p>${result.participants.length} individuelle deltakere · ${result.awardCount} nye deltakelsesmerker</p>
      <div class="annual-categories" role="group" aria-label="Velg milepæl for ${year}">${categories.map(item => `
        <button class="annual-chip" type="button" data-annual-category="${item.key}" aria-pressed="${item.key === chosen.key}" aria-controls="annualPeople"><b>${item.people.length}</b><span>${safe(item.label)}${item.count > 1 ? ` · ${item.count} deltakelser` : ''}</span></button>`).join('')}</div>
      <div id="annualPeople" aria-live="polite"><h4>${safe(chosen.label)} · ${chosen.people.length} løpere</h4>
      ${shown.length ? `<ul class="annual-people">${shown.map(p => `<li><button class="annual-person" type="button" data-annual-person="${safe(p.i)}">${safe(p.n)}<small>${chosen.count === 1 ? 'Debut' : `${chosen.count} deltakelser`} i ${year} · Se løperprofil ↗</small></button></li>`).join('')}</ul>` : '<p>Ingen løpere i denne kategorien dette året.</p>'}</div>
      ${shown.length < chosen.people.length ? `<button class="btn annual-more" type="button" data-annual-more>Vis flere (${shown.length} av ${chosen.people.length})</button>` : ''}`;
  }

  function openYear(year) {
    const disclosure = document.getElementById('yearDisclosure');
    disclosure.open = true;
    document.getElementById('yearSelect').value = String(year);
    S.yearRaceMode = 'main';
    S.yearLimit = 6;
    state.year = null;
    yearView();
    const section = document.getElementById('yearMilestones');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.querySelector('[data-annual-category]').focus({ preventScroll: true });
  }

  function init() {
    renderHome();
    document.getElementById('annualMilestones').addEventListener('click', event => {
      if (event.target.closest('#openYearMilestones')) openYear(S.lastYear);
    });
    document.getElementById('yearMilestones').addEventListener('click', event => {
      const personButton = event.target.closest('[data-annual-person]');
      if (personButton) { openProfile(personButton.dataset.annualPerson); return; }
      const category = event.target.closest('[data-annual-category]');
      if (category) {
        state.category = category.dataset.annualCategory;
        state.limit = 10;
        renderYear(state.year);
        document.querySelector('#yearMilestones [aria-pressed="true"]').focus({ preventScroll: true });
        return;
      }
      if (event.target.closest('[data-annual-more]')) { state.limit += 25; renderYear(state.year); }
    });
  }

  window.MorothonMilestones = { calculate, renderHome, renderYear, openYear, init };
})();
