/* Honor identities are explicit editorial records, never inferred from runner names or results. */
(function () {
  let pending;
  async function load() {
    if (!pending) pending = (async () => {
      await MorothonBadges.init();
      const response = await fetch('data/honors.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Navnelisten kunne ikke lastes.');
      const data = await response.json(), ids = new Set(), groups = new Set();
      if (data.schemaVersion !== 1 || !Array.isArray(data.groups)) throw new Error('Ugyldig navneliste.');
      for (const group of data.groups) {
        if (!/^[a-z0-9-]+$/.test(group.id) || groups.has(group.id) || !group.title || !Array.isArray(group.members) || MorothonBadges.get(group.badgeId).kind !== 'service') throw new Error('Ugyldig hederskategori.');
        groups.add(group.id);
        for (const member of group.members) {
          if (!/^[a-z0-9-]+$/.test(member.id) || ids.has(member.id) || typeof member.name !== 'string' || !member.name.trim() || !['confirmed','provisional'].includes(member.status) || !(member.reason == null || typeof member.reason === 'string')) throw new Error('Ugyldig eller duplisert person i navnelisten.');
          if (member.stories && (!Array.isArray(member.stories) || member.stories.some(s => typeof s.text !== 'string' || typeof s.source !== 'string' || typeof s.confirmed !== 'boolean'))) throw new Error('Ugyldig historiekilde.');
          if (group.badgeId === 'service-grunnlegger' && member.status !== 'confirmed') throw new Error('Grunnleggerstatus må være bekreftet.');
          ids.add(member.id);
        }
      }
      return data;
    })().catch(error => { pending = null; throw error; });
    return pending;
  }
  async function find(id) {
    const data = await load();
    for (const group of data.groups) {
      const member = group.members.find(m => m.id === id);
      if (member) return { member, group, stories: (member.stories || []).filter(s => s.confirmed && s.source.trim()) };
    }
    throw new Error('Hedersprofilen finnes ikke.');
  }
  window.MorothonHonorsData = { load, find };
})();
