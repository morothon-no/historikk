// Read-only portal projections of the approved public package. No source registers.
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../js/history-data.js'));else window.MorothonPortalData=factory(window.MorothonHistoryData);})(function(History){
const compareNames = (a, b) => a.name.localeCompare(b.name, 'nb-NO');
const fold = value => String(value).toLocaleLowerCase('nb-NO').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae');
function createPortalData({ history, badges, honorCount, assetBase = '/site/', profile }) {
  const model = History.create(history), levels = badges.badges.filter(b => b.kind === 'participation').sort((a, b) => a.n - b.n);
  const years = history.yearStats.map(r => r[0]).sort((a, b) => a - b), latestYear = years.at(-1), aliases = new Map();
  for (const [id, names] of Object.entries(history.aliases || {})) { const canonical = model.resolve(id); aliases.set(canonical, [...aliases.get(canonical) || [], ...names]); }
  for (const p of history.people) if (model.resolve(p.i) !== p.i) { const id = model.resolve(p.i); aliases.set(id, [...aliases.get(id) || [], p.n]); }
  const badge = (b, year) => b ? { id: b.id, name: b.name, level: b.n, src: assetBase + b.src, ...(year ? { year } : {}) } : null;
  const rows = [...model.people.values()].map(p => {
    const stats = model.stats(p.i) || { count: 0, years: [], firstYear: null, lastYear: null };
    const earned = levels.filter(b => b.n <= stats.count).map(b => badge(b, stats.years[b.n - 1]));
    const next = stats.count > 0 ? levels.find(b => b.n > stats.count) : null;
    return { id: p.i, name: p.n, gender: p.g, count: stats.count, firstYear: stats.firstYear, lastYear: stats.lastYear,
      years: stats.years, earned, highestBadge: earned.at(-1) || null,
      nextBadge: next ? { ...badge(next), remaining: next.n - stats.count } : null,
      search: fold([p.n, ...aliases.get(p.i) || []].join(' ')) };
  }).filter(Boolean).sort(compareNames), byId = new Map(rows.map(p => [p.id, p]));
  const summary = ({ years, search, earned, ...p }) => p;
  function query(params, extra = []) {
    for (const name of params.keys()) if (!['q', 'offset', 'limit', ...extra].includes(name) || params.getAll(name).length !== 1) throw Error('Ukjent eller gjentatt søkefelt.');
    const q = params.get('q') || ''; if (q.length > 100) throw Error('Søket kan være inntil 100 tegn.');
    const integer = (key, fallback, max) => { const v = params.get(key); if (v === null) return fallback; if (!/^\d+$/.test(v) || +v > max) throw Error('Ugyldig sideinndeling.'); return +v; };
    const offset = integer('offset', 0, 100000), limit = integer('limit', 40, 100); if (limit < 1) throw Error('Velg minst én rad.');
    const tokens = fold(q.trim()).split(/\s+/).filter(Boolean);
    return { offset, limit, matches: p => tokens.every(t => p.search.includes(t)) };
  }
  function participants(params) {
    const { offset, limit, matches } = query(params), found = rows.filter(matches);
    return { total: found.length, offset, limit, people: found.slice(offset, offset + limit).map(summary) };
  }
  function participant(id) {
    const p = byId.get(id); if (!p) throw Error('Deltakeren finnes ikke i den godkjente historikken.');
    return { ...summary(p), years: p.years, earned: p.earned,
      results: model.resultsFor(id).slice().sort((a, b) => b[0] - a[0]).map(r => ({ year: r[0], event: profile?.distances.find(d=>d.competition===r[2]&&d.km===History.parseDistanceKm(r[3]))?.name || History.eventLabel(r), distance: r[3], status: History.effectiveStatus(r), time: r[5], place: History.sourcePlace(r), club: r[8] || null })) };
  }
  function badgeList(params) {
    const { offset, limit, matches } = query(params, ['view', 'level']), view = params.get('view') || 'earned', level = params.get('level') || 'all';
    if (!['earned', 'upcoming'].includes(view) || level !== 'all' && !levels.some(b => String(b.n) === level)) throw Error('Ukjent merkeutvalg.');
    const found = rows.filter(matches).filter(p => view === 'earned' ? p.earned.some(b => level === 'all' || String(b.level) === level) : p.nextBadge && (level === 'all' || String(p.nextBadge.level) === level));
    found.sort((a, b) => view === 'upcoming' ? a.nextBadge.remaining - b.nextBadge.remaining || compareNames(a, b) : b.count - a.count || compareNames(a, b));
    return { total: found.length, offset, limit, view, people: found.slice(offset, offset + limit).map(p => ({ ...summary(p), earned: p.earned })) };
  }
  function overview() {
    const latest = rows.filter(p => p.years.includes(latestYear)), milestones = rows.flatMap(p => p.earned.filter(b => b.year === latestYear).map(b => ({ id: p.id, name: p.name, badge: b })));
    return { logoSrc: assetBase + badges.badges.find(b => b.id === 'debut').src, watermarkSrc: assetBase + badges.watermark.src, latestYear, firstYear: years[0], editionCount: years.length, runnerCount: rows.filter(p => p.count > 0).length, registeredPeople: rows.length, honorCount,
      latestParticipants: latest.length, debutants: latest.filter(p => p.firstYear === latestYear).length, newBadges: milestones.length,
      levels: levels.map(b => badge(b)), milestones: milestones.sort((a, b) => b.badge.level - a.badge.level || compareNames(a, b)).slice(0, 6),
      recentEditions: years.slice(-5).reverse().map(year => ({ year, participants: rows.filter(p => p.years.includes(year)).length })) };
  }
  return { overview, participants, participant, badgeList };
}
return { createPortalData };
});
