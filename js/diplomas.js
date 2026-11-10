/* Public, read-only diploma generator. Models can also serve a future protected batch tool. */
(function () {
  'use strict';
  const safe = value => esc(String(value ?? ''));
  const ui = { dialog: null, focus: null, pid: null, current: null, sequence: 0, observer: null };
  const imageCache = new Map();
  let eventDatesPromise;

  function choices(pid) {
    const p = person(pid);
    if (!p) return [];
    const years = startedYears(p);
    if (!years.length) return [];
    return [
      ...PARTICIPATION_BADGES.filter(b => years.length >= b.n).map(b => ({ key: `badge:${b.n}`, type: 'badge', badge: b, year: years[b.n - 1], label: `${b.name} · oppnådd ${years[b.n - 1]}` })),
      ...recordMatchesFor(p).map((record, i) => ({ key: `record:${i}`, type: 'record', record, year: record.year, label: `Gjeldende løyperekord · ${record.event} · ${record.year}` })),
      { key: 'debut', type: 'debut', year: years[0], label: `Min første Morothon · ${years[0]}` }
    ];
  }

  function model(pid, key) {
    const p = person(pid), choice = choices(pid).find(item => item.key === key);
    if (!p || !choice) throw new Error('Dette diplomet er ikke opptjent av løperen.');
    const years = startedYears(p);
    const awardedYears = choice.type === 'badge' ? years.slice(0, choice.badge.n) : years;
    const editions = [...new Set(S.stats.map(s => s[0]))].filter(y => choice.type !== 'badge' || y <= choice.year);
    const honorary = choice.type === 'badge' && choice.badge.n >= 35;
    const allEditions = editions.length > 0 && editions.every(y => awardedYears.includes(y));
    const orderedEditions = editions.slice().sort((a,b) => a-b);
    const tier = choice.type === 'badge' ? choice.badge.tier : choice.type;
    const title = choice.type === 'badge' ? choice.badge.name : choice.type === 'record' ? 'Regjerende rekordholder' : 'Min første Morothon';
    let achievement, description, citation;
    if (choice.type === 'badge') {
      achievement = `${choice.badge.n} deltakelser`;
      description = `${choice.badge.name} ble oppnådd i ${choice.year}, ved den ${choice.badge.n}. deltakelsen.`;
      const praise = { bronze: 'Den første store milepælen i Morothon-historien din.', silver: 'Ti deltakelser vitner om løpsglede og trofasthet.', gold: 'Femten deltakelser – en innsats det står respekt av.', platinum: 'To tiår med deltakelser og varige minner i heiene.', titanium: 'En kraftfull milepæl, båret av vilje og utholdenhet.', legend: 'Langvarig og ekstraordinær deltakelse – en del av Morothons historie.', honorary: 'Med stor respekt for en enestående og varig innsats gjennom årene.' };
      citation = honorary && allEditions ? `Alle ${editions.length} arrangerte utgaver siden ${Math.min(...editions)} – 100 % gjennom hele historien.` : praise[tier];
    } else if (choice.type === 'record') {
      achievement = choice.record.time;
      description = `${choice.record.event} · ${choice.record.gender} · satt i ${choice.record.year}`;
      citation = 'Gjeldende løyperekord i den registrerte konkurransen og distansen fra og med 2014.';
    } else {
      achievement = `Debut i ${choice.year}`;
      const events = [...new Set(resultsFor(p.i).filter(r => r[0] === choice.year && countsAsParticipation(r)).map(resultDescriptor))];
      description = events.join(' · ');
      citation = 'Hver historie begynner med en første start. Takk for at du ble en del av Morothon.';
    }
    return { pid: p.i, name: p.n, key, type: choice.type, year: choice.year, title, achievement, description, citation,
      honorary, allEditions, tier, color: MorothonBadges.get(choice.type === 'badge' ? `badge-${choice.badge.n}` : choice.type).color, count: awardedYears.length, careerCount: years.length, lastYear: awardedYears.at(-1),
      firstYear: years[0], editionCount: editions.length, firstEdition: orderedEditions[0],
      editionNumber: orderedEditions.indexOf(choice.year) >= 0 ? orderedEditions.indexOf(choice.year) + 1 : null,
      threshold: choice.badge?.n || null, assetKey: choice.type === 'badge' ? `badge-${choice.badge.n}` : choice.type,
      filename: `morothon-diplom-${norm(p.n).replaceAll(' ', '-')}-${key.replace(':', '-')}-${choice.year}` };
  }

  async function manifest() {
    const registry = await MorothonBadges.init();
    return { ...registry, assets: Object.fromEntries(registry.badges.map(b => [b.id, b])) };
  }

  function defaultSource(key) { return MorothonBadges.source(key); }

  async function inspectAsset(key) {
    const registry = await manifest(), settings = registry.assets[key];
    if (!settings) throw new Error(`Bildeoppsett mangler for ${key}.`);
    const src = settings.src ? new URL(settings.src, document.baseURI).href : defaultSource(key);
    const cacheKey = JSON.stringify([key, src, settings]);
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
    const pending = (async () => {
      if (!src || !(settings.widthMm > 0) || !(settings.heightMm > 0)) throw new Error('Bilde eller trykkstørrelse mangler.');
      const image = new Image(); image.src = src; await image.decode();
      const w = image.naturalWidth, h = image.naturalHeight;
      const factor = Math.min(settings.widthMm / w, settings.heightMm / h), widthMm = w * factor, heightMm = h * factor;
      const dpi = 25.4 / factor;
      const bytes = await (await fetch(src)).arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      let transparent = false, edgeContact = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) { transparent = true; break; }
      if (transparent) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && pixels[(y * w + x) * 4 + 3] > 32) edgeContact++;
      const issues = [], warnings = [];
      const approved = settings.printReady === true && settings.printApproval?.sha256 === digest;
      if (settings.printReady === false && !['missing-cutout','design-draft'].includes(settings.status)) issues.push('Denne merkefilen er ikke trykkgodkjent.');
      if (settings.status === 'missing-cutout') issues.push('Frilagt offisiell original mangler. Feltet viser en plassholder, ikke en medalje.');
      if (settings.status === 'design-draft') issues.push('Dugnadsmerket er et designutkast og er ikke godkjent for tildeling.');
      if (key !== 'debut' && !transparent) issues.push('Medaljen mangler gjennomsiktig bakgrunn.');
      if (dpi + .01 < registry.minimumDpi) (approved && settings.printApproval.acceptedBelow300Dpi ? warnings : issues).push(`Bildet gir ${Math.floor(dpi)} DPI ved ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm. En større original trengs for ${registry.minimumDpi} DPI.`);
      if (!settings.cropReviewed || settings.reviewedSha256 !== digest) issues.push('Fullstendig og ubeskåret original må kontrolleres og godkjennes.');
      if (approved && settings.printApproval.acceptedBelow300Dpi) warnings.push(`Brukeren har godkjent ${settings.printApproval.effectiveDpiAt55Mm} DPI i 55 mm-testarket. Dette er ikke en 300 DPI-original.`);
      if (edgeContact) (approved && settings.printApproval.acceptedSourceBoundary ? warnings : issues).push('Synlig motiv berører ytterkanten av den transparente bildekilden. Kontroller mulig kildebeskjæring.');
      return { key, src, width: w, height: h, widthMm, heightMm, boxWidthMm: settings.widthMm, boxHeightMm: settings.heightMm,
        dpi, minimumDpi: registry.minimumDpi, digest, transparent, edgeContact, cropReviewed: settings.cropReviewed && settings.reviewedSha256 === digest, issues, warnings, userApproved: approved, ready: issues.length === 0 };
    })();
    imageCache.set(cacheKey, pending);
    try { return await pending; } catch (error) { imageCache.delete(cacheKey); throw error; }
  }

  async function eventDates() {
    if (!eventDatesPromise) eventDatesPromise = fetch('data/event-dates.json', { cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw new Error('Registeret over arrangementsdatoer kunne ikke lastes.');
      const register = await response.json();
      if (register.schemaVersion !== 1 || !register.dates || !register.source?.name) throw new Error('Ugyldig register over arrangementsdatoer.');
      for (const [year, value] of Object.entries(register.dates)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) !== year) throw new Error('Ugyldig arrangementsdato.');
        const date = new Date(`${value}T12:00:00Z`);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Ugyldig arrangementsdato.');
      }
      return register;
    }).catch(error => { eventDatesPromise = null; throw error; });
    return eventDatesPromise;
  }

  function dateLabel(year, register) {
    const value = register.dates[String(year)];
    if (!value) return `Søgne, ${year}`;
    return `Søgne, ${new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))}`;
  }

  async function prepare(pid, key) {
    const content = model(pid, key);
    const [asset, register, badges] = await Promise.all([inspectAsset(content.assetKey), eventDates(), MorothonBadges.init()]);
    const watermark = new Image(); watermark.src = new URL(badges.watermark.src, document.baseURI).href; await watermark.decode();
    const isVector = new URL(watermark.src).pathname.endsWith('.svg');
    const watermarkDpi = isVector ? null : Math.max(watermark.naturalWidth / badges.watermark.widthMm, watermark.naturalHeight / badges.watermark.heightMm) * 25.4;
    let vectorVerified = false;
    if (isVector) {
      const bytes = await (await fetch(watermark.src)).arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml');
      vectorVerified = digest === badges.watermark.sha256 && xml.documentElement.localName === 'svg' && !!xml.querySelector('path') && !xml.querySelector('parsererror,image,script,foreignObject,use');
    }
    const watermarkIssue = isVector
      ? (badges.watermark.printReady === true && vectorVerified ? null : 'SVG-vannmerket avventer visuell godkjenning og kildekontroll. Det har ingen raster-DPI.')
      : badges.watermark.printReady === false ? 'Løpermotivet er godkjent. Trykkvaliteten avventer kontroll.' : watermarkDpi < badges.minimumDpi ? `Vannmerket gir ${Math.floor(watermarkDpi)} DPI ved masterens størrelse. Større original trengs for trykk.` : null;
    const checked = { ...asset, issues: [...asset.issues, ...(watermarkIssue ? [watermarkIssue] : [])] };
    return { ...content, asset: checked, watermarkSrc: watermark.src, watermarkDpi, dateLabel: dateLabel(content.year, register), eventDate: register.dates[String(content.year)] || null, imageReady: asset.ready && !watermarkIssue };
  }

  async function serviceDraft(id = 'oscar-lohne') {
    const { member, group } = await MorothonHonorsData.find(id);
    if (!group.badgeId) throw new Error('Ingen hedersutmerkelse er registrert for denne arrangørrollen.');
    const badges = await MorothonBadges.init(), asset = await inspectAsset(group.badgeId);
    const badge = MorothonBadges.get(group.badgeId), provisional = member.status !== 'confirmed';
    return { name: member.name, honoreeId: member.id, type: 'service', tier: 'service', title: `${badge.name} · diplomutkast`,
      roleLabel: badge.name, tribute: member.diplomaTribute || '', provisional, asset, assetKey: group.badgeId, imageReady: false, previewOnly: true,
      color: badge.color, firstEdition: 1992, editionNumber: null,
      watermarkSrc: new URL(badges.watermark.src, document.baseURI).href,
      dateLabel: 'Dato fastsettes ved utstedelse', filename: `${member.id}-${badge.id}-diplomutkast`,
      description: provisional ? `${member.name} er foreløpig oppført som dugnadshelt. Ingen endelig tildeling er registrert.`
        : `${member.name} er bekreftet i hederslisten som ${badge.name.toLocaleLowerCase('nb-NO')}. Diplomet er et designutkast.`, citation: '' };
  }

  function serviceDocumentHtml(d) {
    const css=new URL('css/diplomas.css',document.baseURI).href;
    const founder=d.assetKey==='service-grunnlegger';
    const heading=founder?'GRUNNLEGGERDIPLOM':'HEDERSDIPLOM';
    const tribute=d.tribute||(founder?'Med takk og heder til en av Morothons grunnleggere.':'Med takk for frivillig innsats og engasjement for Morothon.');
    return `<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safe(d.filename)}</title><style>@page{size:A4 landscape;margin:0}</style><link rel="stylesheet" href="${safe(css)}"></head>
      <body class="diploma-document"><article class="diploma-sheet diploma-service" style="--diploma-metal:${d.color};--diploma-image-width:${d.asset.boxWidthMm}mm;--diploma-image-height:${d.asset.boxHeightMm}mm;--diploma-name-size:${d.name.length>38?8:d.name.length>26?9:12.3}mm" aria-label="Diplom til ${safe(d.name)}">
      <span class="diploma-corner corner-tl" aria-hidden="true"></span><span class="diploma-corner corner-tr" aria-hidden="true"></span><span class="diploma-corner corner-bl" aria-hidden="true"></span><span class="diploma-corner corner-br" aria-hidden="true"></span>
      <img class="diploma-watermark" src="${safe(d.watermarkSrc)}" alt="">
      <div class="diploma-brand" data-layout-check><b>SØGNE MOROTHON</b><span>SIDEN ${d.firstEdition}</span></div>
      <div class="diploma-heading" data-layout-check><p>FOR LØPSGLEDE OG FELLESSKAP</p><h1>${heading}</h1></div>
      <div class="diploma-recipient" data-layout-check><p>TILDELES</p><h2>${safe(d.name)}</h2><h3>${safe(d.roleLabel)}</h3></div>
      <div class="diploma-main diploma-service-main"><figure data-layout-check><img class="diploma-medal" src="${safe(d.asset.src)}" alt="${safe(d.roleLabel)}"></figure></div>
      <div class="diploma-citation" data-layout-check><p class="diploma-description">${safe(tribute)}</p>${d.tribute?'':'<strong>Et varig bidrag til Morothons historie.</strong>'}</div>
      <div class="diploma-signoff" data-layout-check><div class="diploma-date"><p>Søgne, __________________</p></div><div class="diploma-signature"><div class="diploma-signature-line" aria-label="Plass for fysisk signatur"></div><b>Håkon Lohne</b><span>Løpsleder Søgne Morothon</span></div></div>
      </article></body></html>`;
  }

  function documentHtml(diploma) {
    if (diploma.type === 'service') return serviceDocumentHtml(diploma);
    const d = diploma, css = new URL('css/diplomas.css', document.baseURI).href;
    const badgeLabel = d.type === 'debut' ? 'Offisiell Morothon-logo' : d.title;
    const heading = d.type === 'service' ? (d.assetKey === 'service-grunnlegger' ? 'GRUNNLEGGERDIPLOM' : 'DUGNADSDIPLOM') : d.type === 'record' ? 'REKORDDIPLOM' : d.type === 'debut' ? 'MIN FØRSTE MOROTHON' : d.threshold >= 30 ? 'HEDERSDIPLOM' : 'MERKEDIPLOM';
    const normalTitle = value => String(value ?? '').normalize('NFKC').toLocaleUpperCase('nb-NO').replace(/[^\p{L}\p{N}]/gu, '');
    const subtitleCandidate = d.type === 'debut' ? 'Debutdiplom' : d.type === 'service' ? d.roleLabel : d.title;
    const subtitle = normalTitle(subtitleCandidate) === normalTitle(heading) ? '' : subtitleCandidate;
    const eyebrow = d.type === 'service' ? 'HEDER · DESIGNUTKAST' : d.honorary ? 'EN SÆRLIG HEDER' : d.tier === 'legend' ? 'EN EKSTRAORDINÆR INNSATS' : d.type === 'record' ? 'EN REKORDPRESTASJON' : d.type === 'debut' ? 'BEGYNNELSEN PÅ EN HISTORIE' : 'EN MILEPÆL Å VÆRE STOLT AV';
    const leftValue = d.type === 'service' ? (d.provisional ? 'FORELØPIG' : 'BEKREFTET') : d.type === 'badge' ? String(d.count) : d.type === 'record' ? d.achievement : String(d.year);
    const leftLabel = d.type === 'service' ? safe(d.roleLabel) : d.type === 'badge' ? 'DELTAKELSER' : d.type === 'record' ? 'REKORDTID' : 'DEBUTÅR';
    const leftDetail = d.type === 'service' ? (d.provisional ? 'Ingen endelig tildeling' : 'Bekreftet av arrangøren') : d.type === 'badge' ? `${d.firstYear}–${d.lastYear}` : d.description;
    const completeHistory = d.honorary && d.allEditions;
    const rightValue = d.type === 'service' ? 'UTKAST' : completeHistory ? '100 %' : d.type === 'debut' ? '1' : String(d.year);
    const rightLabel = d.type === 'service' ? 'IKKE UTSTEDT' : completeHistory ? 'GJENNOM HISTORIEN' : d.type === 'record' ? 'REKORDÅR' : d.type === 'debut' ? 'FØRSTE START' : 'MERKET OPPNÅDD';
    const rightDetail = d.type === 'service' ? 'Merket er ikke godkjent ennå' : completeHistory ? `${d.count} av ${d.editionCount} utgaver` : d.type === 'badge' ? `Ved den ${d.threshold}. deltakelsen` : d.type === 'record' ? 'Gjeldende løyperekord' : 'Velkommen i historien';
    const ceremony = d.type === 'service' ? 'Designutkast – ikke et utstedt diplom.' : d.honorary ? 'For en enestående innsats og et varig bidrag til Morothons historie.' : d.citation;
    return `<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safe(d.filename)}</title><style>@page{size:A4 landscape;margin:0}</style><link rel="stylesheet" href="${safe(css)}"></head>
      <body class="diploma-document"><article class="diploma-sheet diploma-${d.tier}" style="--diploma-metal:${d.color};--diploma-image-width:${d.asset.boxWidthMm}mm;--diploma-image-height:${d.asset.boxHeightMm}mm;--diploma-name-size:${d.name.length > 38 ? 8 : d.name.length > 26 ? 9 : 12.3}mm" aria-label="Diplom til ${safe(d.name)}">
      ${!d.imageReady ? `<p class="diploma-draft">${d.type === 'service' ? 'DIPLOMUTKAST · IKKE UTSTEDT' : 'FORHÅNDSVISNING · BILDEKVALITET IKKE GODKJENT FOR UTSKRIFT'}</p>` : ''}
      <span class="diploma-corner corner-tl" aria-hidden="true"></span><span class="diploma-corner corner-tr" aria-hidden="true"></span><span class="diploma-corner corner-bl" aria-hidden="true"></span><span class="diploma-corner corner-br" aria-hidden="true"></span>
      <img class="diploma-watermark" src="${safe(d.watermarkSrc)}" alt="">
      <div class="diploma-brand" data-layout-check><b>SØGNE MOROTHON</b><span>SIDEN ${d.firstEdition}</span></div>
      <div class="diploma-edition">${d.editionNumber ? `<b>${d.editionNumber}. UTGAVE</b>` : ''}<span>${safe(d.dateLabel.replace('Søgne, ', ''))}</span></div>
      <div class="diploma-heading" data-layout-check><p>${eyebrow}</p><h1>${heading}</h1></div>
      <div class="diploma-recipient" data-layout-check><p>TILDELES</p><h2>${safe(d.name)}</h2>${subtitle ? `<h3>${safe(subtitle)}</h3>` : ''}</div>
      <div class="diploma-main">
        <div class="diploma-metric diploma-left" data-layout-check><strong class="diploma-achievement">${safe(leftValue)}</strong><span>${leftLabel}</span><small>${safe(leftDetail)}</small></div>
        <figure data-layout-check><img class="diploma-medal" src="${safe(d.asset.src)}" alt="${safe(badgeLabel)}"></figure>
        <div class="diploma-metric diploma-right" data-layout-check><strong>${safe(rightValue)}</strong><span>${rightLabel}</span><small>${safe(rightDetail)}</small></div>
      </div>
      <div class="diploma-citation" data-layout-check><p>${safe(ceremony)}</p><strong class="diploma-description">${safe(d.honorary ? d.citation : d.description)}</strong>
</div>
      <div class="diploma-signoff" data-layout-check><div class="diploma-date"><p>${safe(d.dateLabel)}</p><small>${d.type === 'service' ? 'Designutkast' : d.type === 'badge' ? 'Merket oppnådd' : d.type === 'record' ? 'Rekorden satt' : 'Debut'}</small></div>
      <div class="diploma-signature"><div class="diploma-signature-line" aria-label="Plass for fysisk signatur"></div><b>Håkon Lohne</b><span>Løpsleder Søgne Morothon</span></div></div>
      </article></body></html>`;
  }

  async function checkLayout(doc) {
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(image => image.decode()));
    const sheet = doc.querySelector('.diploma-sheet'), r = sheet.getBoundingClientRect();
    const failures = [];
    if (Math.abs(r.width / r.height - 297 / 210) > .001) failures.push('Siden har ikke korrekt liggende A4-format.');
    for (const element of doc.querySelectorAll('[data-layout-check],.diploma-recipient h2,.diploma-achievement,.diploma-description')) {
      const b = element.getBoundingClientRect();
      if (b.left < r.left - .5 || b.right > r.right + .5 || b.top < r.top - .5 || b.bottom > r.bottom + .5 || element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) failures.push(`Innholdet passer ikke: ${element.className}`);
    }
    const image = doc.querySelector('.diploma-medal'), imageBox = image.getBoundingClientRect(), figureBox = image.parentElement.getBoundingClientRect();
    if (imageBox.left < figureBox.left - 1 || imageBox.right > figureBox.right + 1 || imageBox.top < figureBox.top - 1 || imageBox.bottom > figureBox.bottom + 1) failures.push('Medaljen passer ikke i det avsatte bildefeltet.');
    const main = doc.querySelector('.diploma-main').getBoundingClientRect(), recipient = doc.querySelector('.diploma-recipient').getBoundingClientRect();
    if (recipient.bottom > main.top + 1) failures.push('Navnefeltet overlapper medalje- og nøkkeltallsfeltet.');
    const parts = [...doc.querySelectorAll('.diploma-main > *')].map(el => el.getBoundingClientRect());
    if (parts.some(b => b.top < main.top - 1 || b.bottom > main.bottom + 1)) failures.push('Medalje og nøkkeltall passer ikke i hovedfeltet.');
    return { ready: failures.length === 0, failures, width: r.width, height: r.height };
  }

  function resizePreview() {
    const viewport = ui.dialog?.querySelector('.diploma-preview'), frame = ui.dialog?.querySelector('iframe');
    if (!viewport || !frame) return;
    const scale = Math.min(1, viewport.clientWidth / (297 * 96 / 25.4));
    frame.style.transform = `scale(${scale})`;
    viewport.style.height = `${210 * 96 / 25.4 * scale}px`;
  }

  function ensureDialog() {
    if (ui.dialog) return;
    const dialog = document.createElement('dialog'); dialog.id = 'diplomaDialog'; dialog.className = 'diploma-dialog';
    dialog.innerHTML = `<div class="diploma-toolbar"><h2>Lag diplom</h2><button type="button" data-diploma-close>Tilbake</button></div><label class="diploma-choice">Velg opptjent diplom<select id="diplomaChoice"></select></label>
      <div id="diplomaStatus" role="status" aria-live="polite"></div><div class="diploma-preview"><iframe title="Forhåndsvisning av diplom" sandbox="allow-same-origin allow-modals"></iframe></div>
      <div class="diploma-controls"><button type="button" data-diploma-print disabled>Skriv ut diplom</button><button type="button" data-diploma-pdf disabled>Lagre som PDF</button></div>
      <p class="diploma-print-help">Liggende A4 · skala 100 % · ingen marger · bakgrunnsgrafikk på · topp- og bunntekst av. «Lagre som PDF» åpner utskriftsdialogen; velg PDF som skriver.</p>`;
    document.body.appendChild(dialog); ui.dialog = dialog;
    dialog.querySelector('[data-diploma-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); } });
    dialog.addEventListener('close', () => { ui.sequence++; ui.current = null; ui.focus?.focus({ preventScroll: true }); });
    dialog.querySelector('select').addEventListener('change', () => renderSelected());
    for (const button of dialog.querySelectorAll('[data-diploma-print],[data-diploma-pdf]')) button.addEventListener('click', () => {
      if (!ui.current?.ready) return;
      const frame = dialog.querySelector('iframe'); frame.contentWindow.focus(); frame.contentWindow.print();
    });
    ui.observer = new ResizeObserver(resizePreview); ui.observer.observe(dialog.querySelector('.diploma-preview'));
  }

  async function renderSelected() {
    const token = ++ui.sequence, status = ui.dialog.querySelector('#diplomaStatus'), frame = ui.dialog.querySelector('iframe');
    ui.current = null;
    for (const button of ui.dialog.querySelectorAll('[data-diploma-print],[data-diploma-pdf]')) button.disabled = true;
    status.textContent = 'Lager forhåndsvisning og kontrollerer bilde og layout …'; frame.style.visibility = 'hidden';
    try {
      const diploma = await prepare(ui.pid, ui.dialog.querySelector('select').value);
      if (token !== ui.sequence) return;
      await new Promise(resolve => { frame.onload = () => { if (frame.contentDocument?.title === diploma.filename) resolve(); }; frame.srcdoc = documentHtml(diploma); });
      frame.contentDocument.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); ui.dialog.close(); } });
      const layout = await checkLayout(frame.contentDocument);
      if (token !== ui.sequence) return;
      const issues = [...diploma.asset.issues, ...layout.failures];
      ui.current = { ...diploma, layout, ready: diploma.imageReady && layout.ready };
      status.replaceChildren();
      const heading = document.createElement('strong'); heading.textContent = issues.length ? 'Forhåndsvisning – ikke utskriftsklar' : diploma.asset.warnings?.length ? 'Trykkfil godkjent med dokumenterte begrensninger' : 'Bilde- og layoutkontroll bestått'; status.appendChild(heading);
      if (issues.length) { const list = document.createElement('ul'); for (const issue of issues) { const li = document.createElement('li'); li.textContent = issue; list.appendChild(li); } status.appendChild(list); }
      else if (diploma.asset.warnings?.length) { const note = document.createElement('p'); note.textContent = 'Brukergodkjent fil. ' + diploma.asset.warnings.join(' '); status.appendChild(note); }
      else { const note = document.createElement('p'); note.textContent = 'Kontroller navn og innhold visuelt før du skriver ut eller lagrer PDF.'; status.appendChild(note); }
      for (const button of ui.dialog.querySelectorAll('[data-diploma-print],[data-diploma-pdf]')) button.disabled = !ui.current.ready;
      frame.style.visibility = 'visible';
      resizePreview();
    } catch (error) {
      if (token !== ui.sequence) return;
      status.textContent = `Kunne ikke lage diplomet: ${error.message}`;
    }
  }

  async function open(pid) {
    ensureDialog(); ui.focus = document.activeElement; ui.pid = resolvePid(pid);
    const options = choices(ui.pid), select = ui.dialog.querySelector('select');
    select.replaceChildren(...options.map(item => { const option = document.createElement('option'); option.value = item.key; option.textContent = item.label; return option; }));
    if (!options.length) return;
    select.value = options.filter(o => o.type === 'badge').at(-1)?.key || options.find(o => o.type === 'record')?.key || options[0].key;
    if (!ui.dialog.open) ui.dialog.showModal();
    await renderSelected();
  }

  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-diploma-person]');
      if (button) open(button.dataset.diplomaPerson);
    });
  }

  window.MorothonDiplomas = { choices, model, prepare, serviceDraft, documentHtml, inspectAsset, checkLayout, dateLabel, eventDates, open, init,
    isOpen: () => !!ui.dialog?.open, current: () => ui.current };
})();
