/* Explicit honor profiles with source-backed roles, separate from individual runner identities. */
window.esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
(async function () {
  let sequence = 0;
  const status = document.querySelector('#honorStatus'), overview = document.querySelector('#honorOverview'), profile = document.querySelector('#honorProfile');
  const showStatus = error => { status.textContent = `Kunne ikke laste utkastet: ${error.message}`; };
  try {
    const data = await MorothonHonorsData.load();
    document.querySelector('#serviceBadges').innerHTML = MorothonBadges.list('service').filter(b => b.displayOnHonorPage !== false).map(b => `<article style="--metal:${b.color}"><img src="${esc(MorothonBadges.source(b.id))}" alt="${esc(b.name)} – merkeutkast"><h3>${esc(b.name)}</h3><p>Merkedesign til gjennomgang</p>${b.id === 'service-grunnlegger' ? '<small>Reservert for bekreftede grunnleggere.</small>' : ''}</article>`).join('');
    document.querySelector('#honorPeople').innerHTML = data.groups.map(group => `<section class="honor-group" data-honor-group="${esc(group.id)}"><h3>${esc(group.title)}</h3><p>${esc(group.description || '')}</p>${group.members.length ? `<ul class="honor-names">${group.members.map(member => `<li data-honoree="${esc(member.id)}"><a href="#person/${esc(member.id)}"><strong>${esc(member.name)}</strong><small>${member.status === 'provisional' ? 'Foreløpig oppført' : group.id === 'founders' ? 'Bekreftet grunnlegger' : 'Bekreftet oppføring'}</small><span>Åpne hedersprofil →</span></a>${member.reason ? `<p>${esc(member.reason)}</p>` : ''}</li>`).join('')}</ul>` : '<p>Ingen navn er lagt inn ennå.</p>'}</section>`).join('');

    async function route() {
      const token = ++sequence; status.textContent = '';
      if (!location.hash.startsWith('#person/')) { overview.hidden = false; profile.hidden = true; document.title = 'Menneskene bak Morothon'; return; }
      let id; try { id = decodeURIComponent(location.hash.slice(8)); } catch { id = ''; }
      overview.hidden = true; profile.hidden = false;
      try {
        const { member, group, stories } = await MorothonHonorsData.find(id);
        const diploma = await MorothonDiplomas.serviceDraft(id), badge = MorothonBadges.get(group.badgeId), provisional = member.status !== 'confirmed';
        if (token !== sequence) return;
        document.title = `${member.name} · Menneskene bak Morothon`;
        profile.className = group.id === 'founders' ? 'honor-profile honor-profile-founder' : 'honor-profile';
        profile.innerHTML = `<a href="#oversikt" class="back">← Tilbake til alle navn</a><div class="honor-profile-header"><img class="profile-medal" src="${esc(MorothonBadges.source(group.badgeId))}" alt="${esc(badge.name)}"><div><p class="eyebrow">${provisional ? 'FORELØPIG OPPFØRING' : 'BEKREFTET ROLLE'}</p><h2 id="profileName">${esc(member.name)}</h2><p class="profile-role">${esc(badge.name)}${provisional ? ' · foreløpig oppført' : ''}</p><p>${esc(member.reason || (provisional ? 'Navnet er foreløpig lagt til av arrangøren. Endelig begrunnelse er ikke registrert.' : 'Grunnleggerstatus er bekreftet av arrangøren.'))}</p><small>Kilde: ${esc(member.roleSource || data.source)}</small></div></div>
          <section aria-labelledby="storiesTitle"><h3 id="storiesTitle">Dokumenterte historier</h3>${stories.length ? stories.map(s => `<article class="honor-story">${s.title ? `<h4>${esc(s.title)}</h4>` : ''}<p>${esc(s.text)}</p><small>Kilde: ${esc(s.source)}</small></article>`).join('') : '<p>Ingen dokumentert historie er lagt til ennå.</p>'}</section>
          <section aria-labelledby="honorDiplomaTitle"><h3 id="honorDiplomaTitle">Diplomvalg</h3><p>${provisional ? 'Foreløpig oppføring: diplomet kan forhåndsvises, men ikke utstedes.' : 'Grunnleggerdiplom med bekreftet navn og rolle. Merkedesignet er fortsatt et utkast.'}</p><details class="diploma-example"><summary>Vis ${group.id === 'founders' ? 'grunnleggerdiplom' : 'dugnadsdiplom'} for ${esc(member.name)}</summary><label class="honor-choice">Diplomtype<select aria-label="Diplomtype"><option value="${esc(group.badgeId)}">${esc(badge.name)}${provisional ? ' – foreløpig' : ''}</option></select></label><div class="honor-diploma"><iframe title="${esc(member.name)} – diplomutkast" sandbox="allow-same-origin allow-modals"></iframe></div><p class="honor-diploma-status" role="status">Kontrollerer forhåndsvisningen …</p><div class="honor-print-controls"><button data-honor-print disabled>Skriv ut utkast</button><button data-honor-pdf disabled>Lagre utkast som PDF</button></div></details></section>`;
        const frame = profile.querySelector('iframe'), viewport = profile.querySelector('.honor-diploma'), details = profile.querySelector('details');
        const resize = () => { const scale = Math.min(1, viewport.clientWidth / (297 * 96 / 25.4)); frame.style.transform = `scale(${scale})`; viewport.style.height = `${210 * 96 / 25.4 * scale}px`; };
        let observer = new ResizeObserver(resize); observer.observe(viewport);
        const cleanup = () => { observer.disconnect(); window.removeEventListener('hashchange', cleanup); };
        window.addEventListener('hashchange', cleanup);
        frame.onload = async () => {
          if (frame.contentDocument?.title !== diploma.filename || token !== sequence) return;
          await frame.contentDocument.fonts.ready; resize();
          if (details.open) await verify();
        };
        frame.srcdoc = MorothonDiplomas.documentHtml(diploma);
        async function verify() {
          try {
            if (!frame.contentDocument?.querySelector('.diploma-sheet')) return;
            const layout = await MorothonDiplomas.checkLayout(frame.contentDocument);
            if (token !== sequence) return;
            const nativeQuality = diploma.asset.dpi >= diploma.asset.minimumDpi && diploma.asset.transparent && !diploma.asset.edgeContact;
            const ready = nativeQuality && layout.ready && !provisional;
            profile.querySelector('.honor-diploma-status').textContent = !layout.ready ? layout.failures.join(' ') : ready ? 'A4-utkast kontrollert. Utskrift/PDF beholder merkingen «Diplomutkast – ikke utstedt».' : provisional ? 'Foreløpig oppføring. Utskrift er sperret til tildelingen er bekreftet.' : 'Diplomutkast. Utskrift er sperret til merkefilen er godkjent.';
            for (const button of profile.querySelectorAll('button')) button.disabled = !ready;
          } catch (error) { showStatus(error); }
        }
        details.addEventListener('toggle', () => { resize(); if (details.open) verify(); });
        for (const button of profile.querySelectorAll('[data-honor-print],[data-honor-pdf]')) button.addEventListener('click', () => { if (!button.disabled) frame.contentWindow.print(); });
        resize(); profile.focus({ preventScroll: true }); profile.scrollIntoView({ block: 'start' });
      } catch (error) {
        if (token !== sequence) return;
        profile.innerHTML = '<a href="#oversikt">← Tilbake til alle navn</a><h2 id="profileName">Hedersprofilen finnes ikke</h2>';
        showStatus(error);
      }
    }
    window.addEventListener('hashchange', route); await route();
  } catch (error) { showStatus(error); }
})();
