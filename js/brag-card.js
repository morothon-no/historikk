/* Shared presentation model for the profile and the 1080 × 1350 share image. */
(function () {
  'use strict';
  const firstStartTheme = { metal: '#65d4d9', background: '#0a303c' };
  const safe = value => esc(String(value ?? ''));

  function model(pid) {
    const p = person(pid);
    if (!p) throw new Error('Løperen finnes ikke.');
    const earned = PARTICIPATION_BADGES.filter(b => p.c >= b.n);
    const highest = earned.at(-1) || null;
    const honorary = p.c >= 35;
    const tier = highest?.tier || 'none';
    const years = new Set(startedYears(p));
    const editions = [...new Set(S.stats.map(s => s[0]))];
    const allEditions = editions.length > 0 && editions.every(year => years.has(year));
    const loyaltyPct = Math.round(loyalty(p).pct * 100);
    return { p, earned, highest, previous: earned.slice(0, -1), honorary, tier, theme: highest?.shareTheme || firstStartTheme,
      records: recordMatchesFor(p), active: p.l === S.lastYear ? p.a : 0, longest: p.s, loyaltyPct,
      allEditions, editionCount: editions.length, firstEdition: Math.min(...editions),
      next: nextMilestoneInfo(p), best: bestShareTime(p.i), totals: runnerTotals(p.i) };
  }

  function honorText(m) {
    return m.allEditions
      ? `Deltatt i alle ${m.editionCount} utgaver siden ${m.firstEdition} · 100 % gjennom hele historien.`
      : 'En varig del av Morothon-historien. År etter år, gjennom heiene.';
  }

  function profileHtml(pid) {
    const m = model(pid), { p } = m;
    const record = m.records.length ? `<div class="profile-record-strip brag-record"><img src="${RECORD_BADGE_IMAGE}" alt="Regjerende rekordholder"><div><b>Regjerende rekordholder</b>${m.records.map(r => `<small>${safe(r.event)} · ${safe(r.gender)} · ${safe(r.time)} (${r.year})</small>`).join('')}</div></div>` : '';
    const medal = m.highest
      ? `<img class="brag-main-medal" src="${BADGE_IMAGES[String(m.highest.n)]}" alt="${safe(m.highest.name)}"><h3>${safe(m.highest.name)}</h3>`
      : `<img class="brag-first-runner" src="${RUNNER_IMAGE}" alt=""><h3>På vei mot Bronsemerket</h3><p>Første merke ved 5 deltakelser</p>`;
    const previous = m.previous.length ? `<div class="brag-previous"><h4>Min medaljesamling</h4><div class="brag-medal-row">${m.previous.map(b => `<figure><img src="${BADGE_IMAGES[String(b.n)]}" alt="${safe(b.name)}"></figure>`).join('')}</div></div>` : m.highest ? '<div class="brag-collection-spacer" aria-hidden="true"></div>' : '';
    const next = m.next ? `<div class="brag-next"><span>${m.highest ? 'Neste delmål' : 'På vei mot første merke'} · ${safe(m.next.next.name)}</span><strong>${p.c} / ${m.next.next.n}</strong><div role="progressbar" aria-label="Fremdrift mot ${safe(m.next.next.name)}" aria-valuenow="${p.c}" aria-valuemin="0" aria-valuemax="${m.next.next.n}"><i style="width:${p.c / m.next.next.n * 100}%"></i></div></div>` : '';
    return `<section class="brag-card brag-${m.tier}${!m.active ? ' brag-inactive' : ''}${m.records.length ? ' brag-recordholder' : ''}" style="--brag-metal:${m.theme.metal};--brag-background:${m.theme.background};--brag-stat-columns:${m.active ? 4 : 3}" aria-label="${safe(p.n)} sitt skrytekort">
      <img class="brag-watermark" src="${RUNNER_IMAGE}" alt=""><div class="brag-brand"><img src="${SHARE_LOGO_IMAGE}" alt="Søgne Morothon"><span>SØGNE MOROTHON<small>Min Morothon-historie</small></span></div>
      <div class="brag-identity"><h2>${safe(p.n)}</h2><p>${safe(p.g || 'Løper')} · ${p.f}–${p.l}</p></div>${record}
      ${m.honorary ? `<p class="brag-honor-title">${safe(m.highest.name.toLocaleUpperCase('nb-NO'))}</p>` : m.tier === 'legend' ? `<p class="brag-tier-title">MOROTHON-LEGENDE</p>` : ''}
      <div class="brag-earned"><div class="brag-medal">${medal}</div><div class="brag-count"><strong>${p.c}</strong><span>deltakelser</span></div></div>
      ${m.honorary ? `<p class="brag-honor-text">${safe(honorText(m))}</p>` : ''}
      <div class="profile-primary-stats brag-stats"><div><strong>${p.c}</strong><small>deltakelser</small></div>${m.active > 0 ? `<div><strong>${m.active} år</strong><small>aktiv rekke</small></div>` : ''}<div><strong>${m.longest} år</strong><small>lengste historiske rekke</small></div><div><strong>${m.loyaltyPct} %</strong><small>lojalitet siden debut</small></div><div><strong>${p.f}</strong><small>debutår</small></div></div>
      ${previous}${next}<div class="brag-support">${m.best ? `<div><span>${safe(m.best.label)}</span><strong>${safe(displayTime(m.best.row[5]))}</strong><small>${safe(m.best.row[3])} · ${m.best.row[0]}</small></div>` : ''}<div><span>Samlet registrert distanse</span><strong>${safe(formatKm(m.totals.km))}</strong></div></div></section>`;
  }

  // Wrap by words; split exceptionally long single words rather than clipping them.
  function linesFor(ctx, text, width) {
    const lines = []; let line = '';
    for (let word of String(text).trim().split(/\s+/)) {
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= width) { line = line ? `${line} ${word}` : word; continue; }
      if (line) { lines.push(line); line = ''; }
      while (ctx.measureText(word).width > width) {
        let end = 1;
        while (end < word.length && ctx.measureText(word.slice(0, end + 1)).width <= width) end++;
        lines.push(word.slice(0, end)); word = word.slice(end);
      }
      line = word;
    }
    if (line) lines.push(line);
    return lines;
  }

  // The export uses the browser's CSS Grid geometry too, rather than per-tier pixel offsets.
  function heroLayout(m) {
    const root = document.createElement('div');
    root.className = `brag-export-layout${m.honorary ? ' brag-export-honorary' : ''}`;
    root.style.setProperty('--export-title-size', `${m.honorary ? 28 : m.tier === 'legend' ? 30 : 18}px`);
    root.innerHTML = `<div data-part="title">${m.honorary ? m.highest.name.toLocaleUpperCase('nb-NO') : m.tier === 'legend' ? 'MOROTHON-LEGENDE' : m.highest ? 'HØYESTE OPPNÅDDE HOVEDMERKE' : 'MOROTHON-REISEN'}</div>
      <div data-part="medal"></div><div data-part="caption">${safe(m.highest?.name || 'På vei mot Bronsemerket')}</div>
      <div class="brag-export-count"><strong data-part="number">${m.p.c}</strong><span data-part="label">DELTAKELSER</span></div>
      ${m.honorary ? `<div data-part="note">${safe(honorText(m))}</div>` : ''}`;
    document.body.appendChild(root);
    try {
      const base = root.getBoundingClientRect(), parts = {};
      for (const element of root.querySelectorAll('[data-part]')) {
        const r = element.getBoundingClientRect(), style = getComputedStyle(element);
        parts[element.dataset.part] = { x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height,
          fontSize: parseFloat(style.fontSize), text: element.textContent };
      }
      return parts;
    } finally { root.remove(); }
  }

  async function build(pid) {
    const m = model(pid), { p } = m, c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const ctx = c.getContext('2d'), color = m.theme.metal;
    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#061820'); bg.addColorStop(.55, m.theme.background); bg.addColorStop(1, '#061820');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    const runner = await loadCanvasImage(RUNNER_IMAGE), logo = await loadCanvasImage(SHARE_LOGO_IMAGE);
    ctx.save(); ctx.globalAlpha = m.honorary ? .09 : .045; drawContain(ctx, runner, 600, 380, 460, 700); ctx.restore();
    if (['titanium', 'legend', 'honorary'].includes(m.tier)) {
      const frame = ctx.createLinearGradient(0, 0, 1080, 1350);
      frame.addColorStop(0, color); frame.addColorStop(.4, m.tier === 'titanium' ? '#506574' : '#a37732'); frame.addColorStop(.7, color); frame.addColorStop(1, color);
      ctx.strokeStyle = frame; ctx.lineWidth = m.honorary ? 9 : m.tier === 'legend' ? 6 : 5;
      roundRectPath(ctx, 22, 22, 1036, 1306, 30); ctx.stroke();
      if (m.honorary) {
        ctx.strokeStyle = '#e8c881'; ctx.lineWidth = 2;
        roundRectPath(ctx, 36, 36, 1008, 1278, 20); ctx.stroke();
      }
    }
    const text = (value, x, y, size = 24, fill = '#fff', maxWidth = 964, align = 'left') => {
      ctx.font = `700 ${size}px Arial, sans-serif`;
      const fitted = fitText(ctx, String(value), maxWidth, size, 12);
      ctx.font = `700 ${fitted}px Arial, sans-serif`; ctx.fillStyle = fill; ctx.textAlign = align;
      ctx.fillText(String(value), x, y);
    };
    const panel = (x, y, w, h, fill = 'rgba(255,255,255,.045)') => { ctx.fillStyle = fill; roundRectPath(ctx, x, y, w, h, 20); ctx.fill(); };
    panel(58, 48, 82, 82, '#fff'); drawContain(ctx, logo, 64, 54, 70, 70);
    text('SØGNE MOROTHON', 162, 80, 28, '#fff', 750);
    text('MIN MOROTHON-HISTORIE', 162, 113, 18, color, 750);
    let nameSize = 64, nameLines;
    do { ctx.font = `850 ${nameSize}px Arial, sans-serif`; nameLines = linesFor(ctx, p.n, 964); if (nameLines.length <= 2) break; nameSize -= 2; } while (nameSize >= 24);
    ctx.fillStyle = '#fff'; ctx.font = `850 ${nameSize}px Arial, sans-serif`; ctx.textAlign = 'center';
    nameLines.forEach((line, i) => ctx.fillText(line, 540, 202 + i * (nameSize + 8)));
    let y = 202 + (nameLines.length - 1) * (nameSize + 8) + 38;
    text(`${p.g || 'Løper'} · ${p.f}–${p.l}`, 540, y, 20, '#adc5cc', 964, 'center'); y += 22;
    if (m.records.length) {
      const height = 78 + m.records.length * 30;
      panel(58, y, 964, height, 'rgba(241,206,131,.11)');
      ctx.strokeStyle = '#e5bf70'; ctx.lineWidth = 2; roundRectPath(ctx, 58, y, 964, height, 20); ctx.stroke();
      drawContain(ctx, await loadCanvasImage(RECORD_BADGE_IMAGE), 70, y + 9, 94, height - 18);
      text('REGJERENDE REKORDHOLDER', 185, y + 35, 23, '#f1ce83', 810);
      m.records.forEach((r, i) => text(`${r.event} · ${r.gender} · ${r.time} (${r.year})`, 185, y + 69 + i * 30, 24, '#fff', 810));
      y += height + 18;
    }
    const heroFill = m.tier === 'platinum' ? 'rgba(215,246,255,.16)' : m.tier === 'titanium' ? 'rgba(1,9,15,.56)' : 'rgba(255,255,255,.045)';
    panel(58, y, 964, 370, heroFill);
    if (m.highest) {
      ctx.strokeStyle = color; ctx.lineWidth = m.tier === 'titanium' ? 3 : 1;
      if (['platinum', 'titanium'].includes(m.tier)) { roundRectPath(ctx, 58, y, 964, 370, 20); ctx.stroke(); }
      else if (!m.honorary && m.tier !== 'legend') { ctx.beginPath(); ctx.moveTo(440, y + 51); ctx.lineTo(640, y + 51); ctx.stroke(); }
    }
    const hero = heroLayout(m);
    // Centre visible glyphs, not just their advance widths (notably the narrow "1" in "15").
    const inBox = (value, box, size = box.fontSize, fill = '#fff') => {
      ctx.font = `700 ${size}px Arial, sans-serif`;
      const fitted = fitText(ctx, String(value), box.width, size, 12);
      ctx.font = `700 ${fitted}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText(String(value));
      const cx = 58 + box.x + box.width / 2, cy = y + box.y + box.height / 2;
      ctx.fillStyle = fill;
      ctx.fillText(String(value), cx + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2,
        cy + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
    };
    inBox(hero.title.text, hero.title, hero.title.fontSize, color);
    const medalBox = hero.medal;
    drawContain(ctx, m.highest ? await loadCanvasImage(BADGE_IMAGES[String(m.highest.n)]) : runner,
      58 + medalBox.x, y + medalBox.y, medalBox.width, medalBox.height);
    inBox(hero.caption.text, hero.caption, 28, color);
    inBox(String(p.c), hero.number);
    inBox('DELTAKELSER', hero.label, hero.label.fontSize, color);
    if (hero.note) {
      ctx.font = '700 19px Arial, sans-serif';
      const lines = linesFor(ctx, hero.note.text, hero.note.width), lineHeight = 26;
      lines.forEach((line, i) => inBox(line, { ...hero.note,
        y: hero.note.y + (hero.note.height - lines.length * lineHeight) / 2 + i * lineHeight, height: lineHeight }, 19, '#dfd3b5'));
    }
    y += 386;
    const stats = [...(m.active > 0 ? [['AKTIV REKKE', `${m.active} år`]] : []), ['LENGSTE HISTORISKE REKKE', `${m.longest} år`], ['LOJALITET SIDEN DEBUT', `${m.loyaltyPct} %`], ['DEBUTÅR', String(p.f)]];
    const statWidth = (964 - 12 * (stats.length - 1)) / stats.length;
    stats.forEach(([label, value], i) => { const x = 58 + i * (statWidth + 12), center = x + statWidth / 2; panel(x, y, statWidth, 91); text(label, center, y + 25, 13, '#adc5cc', statWidth - 24, 'center'); text(value, center, y + 65, 32, '#fff', statWidth - 24, 'center'); });
    y += 109;
    if (m.previous.length) {
      text('MIN MEDALJESAMLING', 540, y + 8, 16, color, 964, 'center');
      const width = Math.min(118, 964 / m.previous.length);
      for (const [i, badge] of m.previous.entries()) {
        const x = 540 - m.previous.length * width / 2 + i * width;
        drawContain(ctx, await loadCanvasImage(BADGE_IMAGES[String(badge.n)]), x + 4, y + 20, width - 12, 86);
      }
    }
    if (m.highest) y += 122;
    if (m.next) {
      text(`NESTE DELMÅL · ${m.next.next.name}`, 58, y + 18, 17, '#adc5cc', 760);
      text(`${p.c} / ${m.next.next.n}`, 905, y + 18, 17, color, 115);
      panel(58, y + 34, 964, 7, 'rgba(255,255,255,.12)');
      panel(58, y + 34, Math.max(7, 964 * p.c / m.next.next.n), 7, color);
      y += 66;
    }
    const supporting = [...(m.best ? [[m.best.label, displayTime(m.best.row[5]), `${m.best.row[3]} · ${m.best.row[0]}`]] : []), ['Samlet registrert distanse', formatKm(m.totals.km), 'fullførte resultater']];
    supporting.forEach(([label, value, sub], i) => {
      const w = (964 - 14 * (supporting.length - 1)) / supporting.length, x = 58 + i * (w + 14);
      panel(x, y, w, 92); text(label, x + w / 2, y + 23, 15, '#adc5cc', w - 32, 'center'); text(value, x + w / 2, y + 55, 27, '#fff', w - 32, 'center'); text(sub, x + w / 2, y + 79, 14, '#adc5cc', w - 32, 'center');
    });
    y += 116;
    const footerY = Math.max(y, 1250);
    text('Finn din egen Morothon-historie', 540, footerY, 25, '#fff', 964, 'center');
    text('morothon.no · Resultater, merker og minner', 540, footerY + 31, 18, color, 964, 'center');
    return new Promise((resolve, reject) => c.toBlob(blob => {
      if (!blob) { reject(new Error('Kunne ikke eksportere skrytekortet.')); return; }
      resolve({ blob, url: URL.createObjectURL(blob) });
    }, 'image/png'));
  }

  window.MorothonCard = { model, profileHtml, build, honorText, linesFor, heroLayout };
})();
