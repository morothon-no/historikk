/* Local C1 adapter. Runs only inside the local Chromium worker, never on Pages. */
(() => {
  'use strict';
  const D = MorothonDiplomas, H = MorothonHonorsData;
  async function catalog() {
    const data = await H.load(), years = H.arrangedYears(S.results), entries = [];
    for (const p of S.people) {
      const options = D.choices(p.i);
      if (!options.length) continue;
      entries.push({ kind: 'runner', personId: p.i, name: p.n,
        aliases: S.aliasesByPid.get(p.i) || [],
        options: options.map(o => ({ key: o.key, label: o.label, year: o.year,
          level: o.badge?.n || null, type: o.type })),
        defaultKey: options.filter(o => o.type === 'badge').at(-1)?.key || options.find(o => o.type === 'record')?.key || options[0].key });
    }
    for (const group of data.groups) for (const member of group.members) {
      const options = H.diplomaChoices(data, member, years).filter(id => H.canPresent(data, member, id));
      if (!options.length) continue;
      entries.push({ kind: 'honor', personId: member.id, name: member.name, aliases: member.aliases || [],
        options: options.map(key => {
          const badge = key === 'thanks' ? null : MorothonBadges.get(key), tenure = H.serviceTenure(data, member, years);
          const year = badge?.series === 'dugnad' ? tenure.milestoneYears?.[badge.milestoneEditions] ?? null
            : member.diplomaDate?.date ? +member.diplomaDate.date.slice(0, 4)
            : key === 'service-aeresmerke' && tenure.basis === 'documented' && tenure.count === 35 ? tenure.last : null;
          return { key, label: (badge?.name || 'Takk for innsatsen') + (year ? ` · ${year}` : ''), type: 'service', year };
        }),
        defaultKey: options[0] });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name, 'nb-NO') || a.kind.localeCompare(b.kind));
  }
  async function prepare(item) {
    const d = item.kind === 'runner' ? await D.prepare(item.personId, item.key)
      : await D.serviceDraft(item.personId, item.key, item.display);
    const earnedAtYear = item.kind === 'runner' ? startedYears(person(item.personId)).filter(year => year <= d.year).length : 0;
    const extras = item.kind === 'runner' && item.display === 'all' && d.type !== 'debut'
      ? await Promise.all(MorothonBadges.list('participation').filter(b => d.type === 'badge' ? b.n < d.threshold : b.n <= earnedAtYear).map(b => D.inspectAsset(b.id))) : [];
    let html = D.documentHtml(d);
    // Ordinary single-diploma HTML is untouched. New runner collection layouts
    // have no content approval yet and deliberately remain control copies.
    const collectionNeedsReview = extras.length > 0;
    const mode = item.kind === 'honor' ? (['final', 'presentation'].includes(d.printMode) ? 'approved' : 'control')
      : d.imageReady && d.asset.userApproved && !collectionNeedsReview ? 'approved' : 'control';
    if (collectionNeedsReview) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const style = doc.createElement('style');
      style.textContent = '.diploma-sheet.c1-runner-collection{grid-template-rows:13mm 25mm 25mm 60mm 12mm 21mm 18.5mm}.c1-collection{display:flex;justify-content:center;align-items:center;gap:3mm;min-height:0;margin:0}.c1-collection img{width:18mm;height:18mm;object-fit:contain;display:block}';
      doc.head.appendChild(style); doc.querySelector('.diploma-sheet').classList.add('c1-runner-collection');
      const row = doc.createElement('section'); row.className = 'c1-collection'; row.setAttribute('data-layout-check', ''); row.setAttribute('aria-label', 'Tidligere opptjente merker');
      for (const asset of extras) { const img = doc.createElement('img'); img.src = asset.src; img.dataset.c1Badge = asset.key; img.alt = MorothonBadges.get(asset.key).name; row.appendChild(img); }
      doc.querySelector('.diploma-signoff').before(row); html = '<!doctype html>' + doc.documentElement.outerHTML;
    }
    if (mode === 'control') {
      const doc = new DOMParser().parseFromString(html, 'text/html'), mark = doc.createElement('p');
      mark.className = 'c1-control-copy'; mark.setAttribute('data-layout-check', '');
      mark.textContent = 'KONTROLLKOPI · IKKE GODKJENT FOR REN UTSKRIFT';
      mark.style.cssText = 'position:absolute;top:12mm;left:65mm;right:65mm;margin:0;padding:1mm;text-align:center;color:#875b20;font:700 2.5mm/1.4 Arial,sans-serif';
      doc.querySelector('.diploma-sheet').appendChild(mark); html = '<!doctype html>' + doc.documentElement.outerHTML;
    }
    window.__c1 = { item, d, extras, mode, collectionNeedsReview, expectedHtml: html };
    return { html, name: d.name, type: d.type, title: d.title, year: d.achievementYear ?? d.year ?? null,
      period: item.kind === 'runner' ? `${d.firstYear}–${d.lastYear}` : d.contributionFirst && d.contributionLast ? `${d.contributionFirst}–${d.contributionLast}` : null,
      count: d.threshold || d.contributionCount || null, date: d.dateLabel || null, dateBasis: d.presentationDate ? 'presentation-date' : d.dateBasis || 'achievement-date', mode,
      approval: d.contentProof || null, assetKey: d.assetKey, priorBadges: (d.type === 'service' ? d.collectionAssets || [] : extras).map(a => a.key),
      reasons: collectionNeedsReview ? ['Ny medaljesamling på løperdiplom krever visuell godkjenning.'] : mode === 'control' ? ['Innholdet mangler gjeldende godkjenning for ren utskrift.'] : [],
      expectedText: [d.name, d.dateLabel, 'Håkon Lohne'].filter(Boolean) };
  }
  async function check(doc = document) {
    const { d, extras, mode, expectedHtml } = window.__c1;
    const failures = [], warnings = [], layout = await D.checkLayout(doc);
    failures.push(...layout.failures);
    if (d.type === 'service') {
      // Adding a control-copy label would alter an approved proof. It is only
      // added to already unapproved drafts, whose existing stamp stays intact.
      const service = await D.checkServiceDraft(d, doc);
      failures.push(...service.failures); warnings.push(...service.warnings);
    } else {
      failures.push(...d.asset.issues);
      if (!d.imageReady) failures.push('Løperdiplomets bilde- eller vannmerkekontroll er ikke bestått.');
      for (const asset of extras) failures.push(...asset.issues);
      warnings.push(...d.asset.warnings, ...extras.flatMap(a => a.warnings));
      const images = [...doc.querySelectorAll('.c1-collection img')];
      if (images.length !== extras.length || extras.some(a => images.filter(i => i.dataset.c1Badge === a.key && i.src === a.src).length !== 1)) failures.push('Medaljesamlingen avviker fra den valgte historiske prestasjonen.');
    }
    if (mode === 'control') {
      const mark = doc.querySelector('.c1-control-copy'), cs = mark && getComputedStyle(mark);
      if (!mark || !mark.textContent.startsWith('KONTROLLKOPI') || cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity !== 1 || !mark.getBoundingClientRect().width) failures.push('Kontrollkopimerkingen mangler.');
    }
    const expected = new DOMParser().parseFromString(expectedHtml, 'text/html');
    if (expected.body.outerHTML !== doc.body.outerHTML) failures.push('Diplominnholdet er endret etter klargjøring.');
    if (expected.head.innerHTML !== doc.head.innerHTML) failures.push('Diplomets stil- eller fontgrunnlag er endret.');
    return { ready: !failures.length, failures: [...new Set(failures)], warnings: [...new Set(warnings)], layout };
  }
  window.C1 = { catalog, prepare, check };
})();
