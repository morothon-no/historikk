/* One source for official medal identity and files, on every surface. No awards are assigned here. */
(function () {
  'use strict';
  let registry, pending;
  async function init() {
    if (!pending) pending = fetch('data/badges.json', { cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw new Error('Merkeregisteret kunne ikke lastes.');
      const data = await response.json();
      if (data.schemaVersion !== 1 || !Array.isArray(data.badges) || data.minimumDpi < 300) throw new Error('Ugyldig merkeregister.');
      const ids = new Set(), thresholds = new Set();
      for (const b of data.badges) {
        if (!b.id || ids.has(b.id) || !b.name || !b.color || !/^assets\/[a-z0-9/._-]+(?:#[a-z0-9-]+)?$/.test(b.src)) throw new Error('Ugyldig eller duplisert merke.');
        ids.add(b.id);
        if (b.kind === 'participation') {
          if (!Number.isInteger(b.n) || b.n <= 0 || thresholds.has(b.n)) throw new Error('Ugyldig merketerskel.');
          thresholds.add(b.n);
        }
        Object.freeze(b);
      }
      Object.freeze(data.badges); registry = Object.freeze(data); return registry;
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  function get(id) {
    const badge = registry?.badges.find(b => b.id === id);
    if (!badge) throw new Error(`Ukjent merke: ${id}`);
    return badge;
  }
  function source(id) { return new URL(get(id).src, document.baseURI).href; }
  function list(kind) { return registry.badges.filter(b => !kind || b.kind === kind).slice().sort((a,b)=>(a.n||0)-(b.n||0)); }
  window.MorothonBadges = Object.freeze({ init, get, source, list, registry: () => registry });
})();
