/* Morothon: sammenligning av løpere. Bruker eksisterende globale funksjoner/data i index.html. */
(function () {
  'use strict';
  const selected = { A: null, B: null };
  const $id = (id) => document.getElementById(id);
  const safe = (value) => esc(String(value ?? ''));

  function timeLabel(seconds) {
    if (!Number.isFinite(seconds)) return '–';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }

  function updateSuggestions(side) {
    const input = $id(`duelSearch${side}`);
    const list = $id(`duelSuggest${side}`);
    if (!input || !list) return;
    const q = input.value.trim();
    if (q.length < 2) {
      list.innerHTML = '';
      list.hidden = true;
      return;
    }
    const hits = S.people
      .map((p) => ({ p, score: personNameScore(p, q) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => a.score - b.score || a.p.n.localeCompare(b.p.n, 'no'))
      .slice(0, 9);
    list.innerHTML = hits.length ? hits.map(({ p }) =>
      `<button type="button" role="option" data-pick="${safe(p.i)}"><strong>${safe(p.n)}</strong><span>${p.f}–${p.l} · ${p.c} løp</span></button>`
    ).join('') : '<p class="duel-nohits">Ingen løpere funnet. Prøv et annet navn.</p>';
    list.hidden = false;
  }

  function choose(side, pid) {
    const p = person(pid);
    if (!p) return;
    selected[side] = resolvePid(pid);
    $id(`duelSearch${side}`).value = p.n;
    $id(`duelSuggest${side}`).hidden = true;
    $id(`duelSuggest${side}`).innerHTML = '';
    render();
  }

  function raceRows(pid) {
    const byKey = new Map();
    for (const r of resultsFor(pid)) {
      if (r[2] !== 'Morothon' && r[2] !== 'Kortmoro') continue;
      if (!isCompletedResult(r) || isRelayRace(r) || isJuniorRace(r)) continue;
      const seconds = timeSeconds(r[5]);
      if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) continue;
      const key = `${r[0]}|${r[2]}|${r[3]}`;
      const old = byKey.get(key);
      if (!old || seconds < old.seconds) {
        byKey.set(key, { year: r[0], event: r[2], distance: r[3], seconds });
      }
    }
    return byKey;
  }

  function mutualRuns(a, b) {
    const aa = raceRows(a), bb = raceRows(b);
    const shared = [];
    for (const [key, ar] of aa) {
      const br = bb.get(key);
      if (br) shared.push({ ...ar, tA: ar.seconds, tB: br.seconds });
    }
    return shared.sort((x, y) => y.year - x.year || x.event.localeCompare(y.event, 'no'));
  }

  function summaryRow(label, valueA, valueB) {
    return `<div class="duel-stat"><strong>${safe(valueA)}</strong><span>${safe(label)}</span><strong>${safe(valueB)}</strong></div>`;
  }

  function render() {
    const holder = $id('duelResults');
    if (!holder) return;
    if (!selected.A || !selected.B) {
      holder.innerHTML = '<p class="duel-hint">Velg to løpere for å sammenligne Morothon-historien deres.</p>';
      return;
    }
    if (selected.A === selected.B) {
      holder.innerHTML = '<p class="duel-hint">Velg to forskjellige løpere.</p>';
      return;
    }
    const a = person(selected.A), b = person(selected.B);
    if (!a || !b) return;
    const statsA = performanceStats(a.i), statsB = performanceStats(b.i);
    const match = mutualRuns(a.i, b.i);
    const winsA = match.filter((r) => r.tA < r.tB).length;
    const winsB = match.filter((r) => r.tB < r.tA).length;
    const ties = match.length - winsA - winsB;
    const rows = [
      ['Deltakelser', a.c, b.c], ['Debutår', a.f, b.f],
      ['Siste registrering', a.l, b.l], ['Lengste deltakelsesrekke', `${a.s} år`, `${b.s} år`],
      ['Klasseseire', statsA.wins, statsB.wins], ['Pallplasseringer', statsA.podiums, statsB.podiums]
    ];
    const head = `<div class="duel-names"><button type="button" data-duel-profile="${safe(a.i)}">${safe(a.n)} <span>Se profil ↗</span></button><span>VS</span><button type="button" data-duel-profile="${safe(b.i)}">${safe(b.n)} <span>Se profil ↗</span></button></div>`;
    const basics = `<div class="duel-stat-board">${rows.map((row) => summaryRow(...row)).join('')}</div>`;
    let direct = '<div class="duel-shared"><h3>Samme løp, samme år</h3>';
    if (!match.length) {
      direct += '<p>Disse to løperne har ingen registrerte fullføringer i samme løp, samme år og samme distanse.</p>';
    } else {
      direct += `<div class="duel-tally"><span>${safe(a.n)}: <b>${winsA}</b></span><span>Lik tid: <b>${ties}</b></span><span>${safe(b.n)}: <b>${winsB}</b></span></div>`;
      direct += `<div class="duel-run-table" role="table" aria-label="Felles løpsår">${match.slice(0, 12).map((r) => {
        const delta = Math.abs(r.tA - r.tB);
        const label = r.tA === r.tB ? 'Lik tid' : `Forskjell ${timeLabel(delta)}`;
        return `<div class="duel-run-row" role="row"><span><b>${r.year}</b><small>${safe(r.event)} · ${safe(r.distance)}</small></span><strong class="${r.tA < r.tB ? 'duel-faster' : ''}">${timeLabel(r.tA)}</strong><span class="duel-diff">${safe(label)}</span><strong class="${r.tB < r.tA ? 'duel-faster' : ''}">${timeLabel(r.tB)}</strong></div>`;
      }).join('')}</div>`;
      if (match.length > 12) direct += `<p class="duel-small">Viser de 12 nyeste av ${match.length} felles løp.</p>`;
    }
    direct += '<p class="duel-caution">Tider sammenlignes bare innen samme år, samme løp og samme registrerte distanse. Historiske løypeendringer og registreringsfeil kan forekomme.</p></div>';
    holder.innerHTML = head + basics + direct;
  }

  function init() {
    if (!$id('duelResults') || !S.data) return;
    for (const side of ['A', 'B']) {
      const input = $id(`duelSearch${side}`);
      input.addEventListener('input', () => {
        selected[side] = null;
        render();
        updateSuggestions(side);
      });
      input.addEventListener('focus', () => updateSuggestions(side));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') $id(`duelSuggest${side}`).hidden = true;
        if (e.key === 'Enter') {
          const first = $id(`duelSuggest${side}`).querySelector('[data-pick]');
          if (first) { e.preventDefault(); choose(side, first.dataset.pick); }
        }
      });
      $id(`duelSuggest${side}`).addEventListener('click', (e) => {
        const target = e.target.closest('[data-pick]');
        if (target) choose(side, target.dataset.pick);
      });
    }
    $id('duelSwap').addEventListener('click', () => {
      [selected.A, selected.B] = [selected.B, selected.A];
      for (const side of ['A', 'B']) $id(`duelSearch${side}`).value = selected[side] ? person(selected[side]).n : '';
      render();
    });
    $id('duelReset').addEventListener('click', () => {
      selected.A = selected.B = null;
      for (const side of ['A', 'B']) {
        $id(`duelSearch${side}`).value = '';
        $id(`duelSuggest${side}`).hidden = true;
      }
      render();
    });
    $id('duelResults').addEventListener('click', (e) => {
      const button = e.target.closest('[data-duel-profile]');
      if (button) openProfile(button.dataset.duelProfile);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.duel-field')) {
        for (const side of ['A', 'B']) $id(`duelSuggest${side}`).hidden = true;
      }
    });
    render();
  }

  function pick(pid) {
    const p = person(pid);
    if (!p || !$id('duelSearchA')) return;
    choose('A', p.i);
    if (selected.B === p.i) {
      selected.B = null;
      $id('duelSearchB').value = '';
    }
    render();
    closeProfile();
    $id('sammenlign').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $id('duelSearchB').focus({ preventScroll: true });
  }

  window.MorothonCompare = { init, pick };
})();
