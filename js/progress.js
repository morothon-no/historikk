/* Morothon: grafisk tidsutvikling, alltid gruppert per løp og registrert distanse. */
(function () {
  'use strict';
  const safe = (value) => esc(String(value ?? ''));

  function clock(seconds) {
    if (!Number.isFinite(seconds)) return '–';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
  }

  function groups(pid) {
    const grouped = new Map();
    for (const r of resultsFor(pid)) {
      if (r[2] !== 'Morothon' && r[2] !== 'Kortmoro') continue;
      if (!isCompletedResult(r) || isRelayRace(r) || isJuniorRace(r)) continue;
      const seconds = timeSeconds(r[5]);
      if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) continue;
      const label = `${r[2] === 'Morothon' ? 'Langmoro' : 'Kortmoro'} · ${String(r[3] || '').trim()}`;
      const key = `${r[2]}|${r[3]}`;
      if (!grouped.has(key)) grouped.set(key, { key, label, rows: new Map(), lastYear: 0 });
      const group = grouped.get(key);
      group.lastYear = Math.max(group.lastYear, r[0]);
      const old = group.rows.get(r[0]);
      if (!old || seconds < old.seconds) group.rows.set(r[0], { year: r[0], seconds });
    }
    return [...grouped.values()].map((g) => ({
      key: g.key, label: g.label, lastYear: g.lastYear,
      runs: [...g.rows.values()].sort((a, b) => a.year - b.year)
    })).sort((a, b) => b.lastYear - a.lastYear || b.runs.length - a.runs.length || a.label.localeCompare(b.label, 'no'));
  }

  function svgChart(rows) {
    const width = 640, height = 234, left = 73, right = 22, top = 19, bottom = 45;
    const innerW = width - left - right, innerH = height - top - bottom;
    const years = rows.map((r) => r.year), values = rows.map((r) => r.seconds);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const minS = Math.min(...values), maxS = Math.max(...values);
    const pad = Math.max(45, (maxS - minS) * 0.12);
    const lo = Math.max(0, minS - pad), hi = maxS + pad;
    const px = (year) => left + (maxY === minY ? 0.5 : (year - minY) / (maxY - minY)) * innerW;
    // Raskere tid står høyere i grafen; ikke sammenlign ulike distanser i samme serie.
    const py = (sec) => top + (sec - lo) / (hi - lo) * innerH;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const time = lo + (hi - lo) * i / 4, y = top + i / 4 * innerH;
      grid += `<line x1="${left}" x2="${width - right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="progress-gridline"/>`;
      grid += `<text class="progress-tick" x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${clock(time)}</text>`;
    }
    const line = rows.map((r) => `${px(r.year).toFixed(1)},${py(r.seconds).toFixed(1)}`).join(' ');
    const step = Math.max(1, Math.ceil(rows.length / 7));
    const labels = rows.filter((r, i) => i === 0 || i === rows.length - 1 || i % step === 0)
      .map((r) => `<text class="progress-tick" x="${px(r.year).toFixed(1)}" y="${height - 15}" text-anchor="middle">${r.year}</text>`).join('');
    const dots = rows.map((r) => `<circle class="progress-dot" cx="${px(r.year).toFixed(1)}" cy="${py(r.seconds).toFixed(1)}" r="5.5" tabindex="0"><title>${r.year}: ${clock(r.seconds)}</title></circle>`).join('');
    return `<svg class="progress-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sluttider per år, samme løp og registrerte distanse. Raskere tider ligger høyere i grafen.">${grid}<polyline class="progress-line" points="${line}"/>${dots}${labels}</svg>`;
  }

  function render(pid, preferredGroup) {
    const options = groups(pid);
    if (!options.length) return '<section class="moro-progress"><h3>Min tidsutvikling</h3><p class="progress-note">Ingen registrerte fullførte løp med gyldig sluttid.</p></section>';
    // Velg den nyeste distansen med minst to resultater, ellers nyeste registrerte.
    const chosen = options.find((g) => g.key === preferredGroup) || options.find((g) => g.runs.length >= 2) || options[0];
    const rows = chosen.runs, first = rows[0], last = rows[rows.length - 1];
    const fastest = rows.reduce((best, item) => item.seconds < best.seconds ? item : best, rows[0]);
    const difference = rows.length >= 2 ? first.seconds - last.seconds : 0;
    const change = rows.length < 2 ? '–' : difference > 0 ? `${clock(difference)} raskere` : difference < 0 ? `${clock(-difference)} tregere` : 'Lik tid';
    const controls = options.map((g) => `<option value="${safe(g.key)}" ${g.key === chosen.key ? 'selected' : ''}>${safe(g.label)} (${g.runs.length} år)</option>`).join('');
    const plot = rows.length < 2
      ? '<p class="progress-note">Bare én tid er registrert for denne distansen. Graf vises når det finnes minst to fullføringer.</p>'
      : svgChart(rows);
    return `<section class="moro-progress" data-progression-pid="${safe(pid)}"><div class="progress-heading"><div><h3>Min tidsutvikling</h3><p>Sluttider år for år · raskere tid vises høyere</p></div><label>Velg løp og distanse<select data-moro-progression-select aria-label="Velg løp og distanse">${controls}</select></label></div>${plot}<div class="progress-numbers"><div><small>Første</small><strong>${clock(first.seconds)}</strong><span>${first.year}</span></div><div><small>Beste tid</small><strong>${clock(fastest.seconds)}</strong><span>${fastest.year}</span></div><div><small>Siste</small><strong>${clock(last.seconds)}</strong><span>${last.year}</span></div><div><small>Endring første–siste</small><strong>${safe(change)}</strong><span>${rows.length} registrerte år</span></div></div><p class="progress-warning">Resultater vises bare innen samme løpsnavn og oppgitte distanse. En like lang løype kan likevel ha hatt ulike traséer og forhold. Tidene er derfor ikke nødvendigvis direkte sammenlignbare mellom år.</p></section>`;
  }

  function init() {
    // Profilen genereres dynamisk av index.html, så endringer håndteres på dokumentnivå.
    document.addEventListener('change', (event) => {
      const select = event.target.closest('[data-moro-progression-select]');
      if (!select) return;
      const section = select.closest('[data-progression-pid]');
      if (!section) return;
      section.outerHTML = render(section.dataset.progressionPid, select.value);
    });
  }

  window.MorothonProgress = { init, render, groups };
})();
