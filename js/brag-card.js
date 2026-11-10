/* Shared presentation model for the profile and the compact 1080px-wide share image. */
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
    const ceremonial = !!highest && highest.n >= 30;
    const tier = highest?.tier || 'none';
    const years = new Set(startedYears(p));
    const editions = [...new Set(S.stats.map(s => s[0]))];
    const allEditions = editions.length > 0 && editions.every(year => years.has(year));
    const participation = loyalty(p);
    return { p, earned, highest, previous: earned.slice(0, -1), honorary, ceremonial, tier, theme: highest?.shareTheme || firstStartTheme,
      records: recordMatchesFor(p), active: participation.active, longest: participation.longest.count, participation,
      allEditions, editionCount: editions.length, firstEdition: Math.min(...editions),
      next: nextMilestoneInfo(p), best: bestShareTime(p.i), totals: runnerTotals(p.i) };
  }

  function honorText(m) {
    return m.allEditions
      ? `Deltatt i samtlige utgaver siden ${m.firstEdition} · 100 % lojalitet`
      : 'En varig del av Morothon-historien. År etter år, gjennom heiene.';
  }

  function cardStats(m) {
    if (m.ceremonial && m.allEditions) return [];
    const stats = [],L=m.participation,R=MorothonLoyalty;
    if (m.active > 0) stats.push(['AKTIV REKKE', `${m.active} på rad`, R.range(L.ending)]);
    if (!m.active || m.longest !== m.active) stats.push(['LENGSTE HISTORISKE REKKE', `${m.longest} på rad`, R.range(L.longest)]);
    if (L.current) stats.push([L.current.name.toLocaleUpperCase('nb-NO'), `${R.percent(L)} %`, R.range(L)]);
    else if (L.recognition) stats.push(['HISTORISK HEDER', L.recognition.name, R.range(L.recognition)]);
    else if (!m.active) stats.push(['SISTE REGISTRERTE LØP', String(L.last)]);
    if (!m.ceremonial) stats.push(['DEBUTÅR', String(m.p.f)]);
    return stats;
  }

  function goalHtml(m) {
    return m.next ? `<div class="brag-next"><span>Neste delmål · ${safe(m.next.next.name)}</span><strong>${m.p.c} / ${m.next.next.n}</strong><div role="progressbar" aria-label="Fremdrift mot ${safe(m.next.next.name)}" aria-valuenow="${m.p.c}" aria-valuemin="0" aria-valuemax="${m.next.next.n}"><i style="width:${m.p.c / m.next.next.n * 100}%"></i></div></div>` : '';
  }

  function supportHtml(m) {
    return `<div class="brag-support">${m.best ? `<div><span>${safe(m.best.label)}</span><strong>${safe(displayTime(m.best.row[5]))}</strong><small>${safe(m.best.row[3])} · ${m.best.row[0]}</small></div>` : ''}<div><span>Samlet registrert distanse</span><strong>${safe(formatKm(m.totals.km))}</strong><small>Fullførte, registrerte resultater</small></div></div>`;
  }

  function profileHtml(pid) {
    const m = model(pid), { p } = m, stats = cardStats(m);
    const record = m.records.length ? `<div class="profile-record-strip brag-record"><img src="${RECORD_BADGE_IMAGE}" alt="Regjerende rekordholder"><div><b>Regjerende rekordholder</b>${m.records.map(r => `<small>${safe(r.event)} · ${safe(r.gender)} · ${safe(r.time)} (${r.year})</small>`).join('')}</div></div>` : '';
    const medal = m.highest
      ? `<img class="brag-main-medal" src="${BADGE_IMAGES[String(m.highest.n)]}" alt="${safe(m.highest.name)}">${m.ceremonial ? '' : `<h3>${safe(m.highest.name)}</h3>`}`
      : `<img class="brag-first-runner" src="${RUNNER_IMAGE}" alt=""><h3>På vei mot Bronsemerket</h3><p>Første merke ved 5 deltakelser</p>`;
    const previous = m.previous.length ? `<div class="brag-previous"><h4>Min medaljesamling</h4><div class="brag-medal-row" data-count="${m.previous.length}" style="--collection-edge:${collectionSize(m.previous.length)}px">${m.previous.map(b => `<figure><img src="${BADGE_IMAGES[String(b.n)]}" alt="${safe(b.name)}" title="${safe(b.name)}"></figure>`).join('')}</div></div>` : '';
    return `<section class="brag-card brag-${m.tier}${m.ceremonial ? ' brag-ceremonial' : ''}${!m.active ? ' brag-inactive' : ''}${m.records.length ? ' brag-recordholder' : ''}" style="--brag-metal:${m.theme.metal};--brag-background:${m.theme.background};--brag-stat-columns:${stats.length};--brag-mobile-stat-columns:${stats.length===4?2:stats.length}" aria-label="${safe(p.n)} sitt skrytekort">
      <img class="brag-watermark" src="${RUNNER_IMAGE}" alt=""><div class="brag-brand"><img src="${SHARE_LOGO_IMAGE}" alt="Søgne Morothon"><span>SØGNE MOROTHON<small>Min Morothon-historie</small></span></div>
      <div class="brag-identity"><h2>${safe(p.n)}</h2><p>${safe(p.g || 'Løper')} · ${p.f}–${p.l}</p></div>${record}
      ${m.ceremonial ? `<p class="brag-honor-title">${safe(m.highest.name.toLocaleUpperCase('nb-NO'))}</p>` : ''}
      <div class="brag-earned"><div class="brag-medal">${medal}</div><div class="brag-count"><strong>${p.c}</strong><span>deltakelser</span></div></div>
      ${m.honorary ? `<p class="brag-honor-text">${safe(honorText(m))}</p>` : ''}
      ${stats.length ? `<div class="profile-primary-stats brag-stats">${stats.map(([label,value,detail]) => `<div><strong>${safe(value)}</strong><small>${safe(label.toLocaleLowerCase('nb-NO'))}</small>${detail?`<em>${safe(detail)}</em>`:''}</div>`).join('')}</div>` : ''}
      ${previous}${!m.ceremonial ? goalHtml(m) : ''}${supportHtml(m)}</section>
      <details class="runner-full-details" style="--brag-metal:${m.theme.metal}"><summary>Alle nøkkeltall og personlige mål</summary><div class="profile-primary-stats"><div><strong>${p.c}</strong><small>deltakelser</small></div>${m.active > 0 ? `<div><strong>${m.active} år</strong><small>aktiv rekke</small></div>` : ''}<div><strong>${m.longest} på rad</strong><small>lengste historiske rekke · ${MorothonLoyalty.range(m.participation.longest)}</small></div><div><strong>${MorothonLoyalty.percent(m.participation)} %</strong><small>${m.participation.count} av ${m.participation.poss} arrangerte utgaver · ${MorothonLoyalty.range(m.participation)}</small></div><div><strong>${p.f}</strong><small>debutår</small></div></div>${goalHtml(m)}${supportHtml(m)}</details>`;
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
  const FORMATS = Object.freeze({ portrait: { width:1080, height:1350 }, square: { width:1080, height:1080 } });
  function heroLayout(m, format = 'portrait') {
    if (!FORMATS[format]) throw new Error('Ukjent kortformat.');
    const root = document.createElement('div');
    root.className = `brag-export-layout${m.ceremonial ? ' brag-export-ceremonial' : ''}${m.honorary ? ' brag-export-honorary' : ''} brag-export-${format}`;
    root.innerHTML = `<div data-part="title">${m.ceremonial ? safe(m.highest.name.toLocaleUpperCase('nb-NO')) : ''}</div>
      <div data-part="medal"></div><div data-part="caption">${m.ceremonial ? '' : safe(m.highest?.name || 'På vei mot Bronsemerket')}</div>
      <div class="brag-export-count"><strong data-part="number">${m.p.c}</strong><span data-part="label">DELTAKELSER</span></div>
      ${m.honorary ? `<div data-part="note">${safe(honorText(m))}</div>` : ''}`;
    document.body.appendChild(root);
    try {
      const base = root.getBoundingClientRect(), parts = { height: base.height };
      for (const element of root.querySelectorAll('[data-part]')) {
        const r = element.getBoundingClientRect(), style = getComputedStyle(element);
        parts[element.dataset.part] = { x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height,
          fontSize: parseFloat(style.fontSize), text: element.textContent };
      }
      return parts;
    } finally { root.remove(); }
  }

  const boundsCache = new WeakMap();
  function visibleBounds(image) {
    if (boundsCache.has(image)) return boundsCache.get(image);
    const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let x0=c.width,y0=c.height,x1=-1,y1=-1;
    for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) if(pixels[(y*c.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const bounds={x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};boundsCache.set(image,bounds);return bounds;
  }
  // Fit the visible motif, retaining the complete source and every transparent edge pixel.
  function drawCollectionMedal(ctx,image,x,y,edge) {
    const b=visibleBounds(image),scale=edge/Math.max(b.width,b.height);
    ctx.drawImage(image,x+(edge-b.width*scale)/2-b.x*scale,y+(edge-b.height*scale)/2-b.y*scale,image.naturalWidth*scale,image.naturalHeight*scale);
  }
  function collectionSize(count) {
    const preferred=count===1?180:count===2?150:count<=4?125:105;
    return Math.min(preferred,(964-Math.max(0,count-1)*16)/Math.max(1,count));
  }

  async function build(pid, options = {}) {
    const format=typeof options==='string'?options:options.format||'portrait';
    if (!FORMATS[format]) throw new Error('Ukjent kortformat.');
    const m=model(pid),{p}=m,c=document.createElement('canvas'),square=format==='square';
    c.width=FORMATS[format].width;c.height=FORMATS[format].height;
    const ctx=c.getContext('2d'),color=m.theme.metal;
    let nameSize=square?52:64,nameLines;
    do {ctx.font=`700 ${nameSize}px Arial, sans-serif`;nameLines=linesFor(ctx,p.n,964);if(nameLines.length<=2)break;nameSize-=2;}while(nameSize>20);
    const bg=ctx.createLinearGradient(0,0,1080,c.height);bg.addColorStop(0,'#061820');bg.addColorStop(.55,m.theme.background);bg.addColorStop(1,'#061820');
    ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
    const runner=await loadCanvasImage(RUNNER_IMAGE),logo=await loadCanvasImage(SHARE_LOGO_IMAGE);
    ctx.save();ctx.globalAlpha=m.honorary?.09:.045;drawContain(ctx,runner,600,380,460,c.height-420);ctx.restore();
    if(['titanium','legend','honorary'].includes(m.tier)){
      const frame=ctx.createLinearGradient(0,0,1080,c.height);frame.addColorStop(0,color);frame.addColorStop(.4,m.tier==='titanium'?'#506574':'#a37732');frame.addColorStop(.7,color);frame.addColorStop(1,color);
      ctx.strokeStyle=frame;ctx.lineWidth=m.honorary?9:m.tier==='legend'?6:5;roundRectPath(ctx,22,22,1036,c.height-44,30);ctx.stroke();
      if(m.honorary){ctx.strokeStyle='#e8c881';ctx.lineWidth=2;roundRectPath(ctx,36,36,1008,c.height-72,20);ctx.stroke();}
    }
    const text=(value,x,y,size=24,fill='#fff',maxWidth=964,align='center')=>{
      ctx.font=`700 ${size}px Arial, sans-serif`;const fitted=fitText(ctx,String(value),maxWidth,size,12);ctx.font=`700 ${fitted}px Arial, sans-serif`;ctx.fillStyle=fill;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(String(value),x,y);
    };
    const panel=(x,y,w,h,fill='rgba(255,255,255,.045)')=>{ctx.fillStyle=fill;roundRectPath(ctx,x,y,w,h,20);ctx.fill();};
    const logoY=square?34:48,logoSize=square?64:82;
    panel(58,logoY,logoSize,logoSize,'#fff');drawContain(ctx,logo,64,logoY+6,logoSize-12,logoSize-12);
    text('SØGNE MOROTHON',58+logoSize+22,logoY+29,square?25:28,'#fff',750,'left');text('MIN MOROTHON-HISTORIE',58+logoSize+22,logoY+58,18,color,750,'left');
    const nameY=square?144:202;
    nameLines.forEach((line,i)=>text(line,540,nameY+i*(nameSize+8),nameSize));
    let y=nameY+(nameLines.length-1)*(nameSize+8)+(square?32:38);
    text(`${p.g||'Løper'} · ${p.f}–${p.l}`,540,y,square?20:22,'#adc5cc');y+=square?18:28;
    const hero=heroLayout(m,format),heroHeight=hero.height;
    const stats=cardStats(m),goal=!m.ceremonial&&m.next;
    const recordHeight=m.records.length?78+m.records.length*30:0;
    const sections=[...(recordHeight?[['record',recordHeight]]:[]),['hero',heroHeight],...(stats.length?[['stats',square?90:110]]:[]),...(m.previous.length?[['collection',collectionSize(m.previous.length)+52]]:[]),...(goal?[['goal',square?70:84]]:[]),['support',square?90:112]];
    const footerTop=c.height-100,available=footerTop-y,content=sections.reduce((sum,s)=>sum+s[1],0),gap=(available-content)/(sections.length);
    // Exceptionally long names/record combinations still keep fixed output dimensions.
    // Scale the content uniformly only if its minimum rows cannot fit; never stretch a medal.
    const scale=Math.min(1,available/content),spacing=Math.max(0,gap);
    const contentStart=y,boxes=[];
    ctx.save();if(scale<1){ctx.translate(540,contentStart);ctx.scale(scale,scale);ctx.translate(-540,-contentStart);}
    const inBox=(value,box,size=box.fontSize,fill='#fff')=>{
      ctx.font=`700 ${size}px Arial, sans-serif`;const fitted=fitText(ctx,String(value),box.width,size,12);ctx.font=`700 ${fitted}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
      const metrics=ctx.measureText(String(value));ctx.fillStyle=fill;
      ctx.fillText(String(value),58+box.x+box.width/2+(metrics.actualBoundingBoxLeft-metrics.actualBoundingBoxRight)/2,y+box.y+box.height/2+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
    };
    for(const [section,height]of sections){
      boxes.push({section,top:contentStart+(y-contentStart)*scale,bottom:contentStart+(y+height-contentStart)*scale});
      if(section==='record'){
        panel(58,y,964,height,'rgba(241,206,131,.11)');drawContain(ctx,await loadCanvasImage(RECORD_BADGE_IMAGE),70,y+9,94,height-18);text('REGJERENDE REKORDHOLDER',185,y+32,23,'#f1ce83',810,'left');m.records.forEach((r,i)=>text(`${r.event} · ${r.gender} · ${r.time} (${r.year})`,185,y+65+i*30,22,'#fff',810,'left'));
      }else if(section==='hero'){
        panel(58,y,964,height,m.tier==='platinum'?'rgba(215,246,255,.16)':m.tier==='titanium'?'rgba(1,9,15,.56)':'rgba(255,255,255,.045)');
        if(['platinum','titanium'].includes(m.tier)){ctx.strokeStyle=color;ctx.lineWidth=m.tier==='titanium'?3:1;roundRectPath(ctx,58,y,964,height,20);ctx.stroke();}
        if(hero.title.text)inBox(hero.title.text,hero.title,hero.title.fontSize,color);
        drawContain(ctx,m.highest?await loadCanvasImage(BADGE_IMAGES[String(m.highest.n)]):runner,58+hero.medal.x,y+hero.medal.y,hero.medal.width,hero.medal.height);
        if(hero.caption.text)inBox(hero.caption.text,hero.caption,28,color);
        inBox(String(p.c),hero.number);inBox('DELTAKELSER',hero.label,hero.label.fontSize,color);
        if(hero.note){ctx.font='700 22px Arial';const lines=linesFor(ctx,hero.note.text,hero.note.width),lineHeight=26;lines.forEach((line,i)=>inBox(line,{...hero.note,y:hero.note.y+(hero.note.height-lines.length*lineHeight)/2+i*lineHeight,height:lineHeight},22,'#e4d6b3'));}
      }else if(section==='stats'){
        const w=(964-12*(stats.length-1))/stats.length;
        stats.forEach(([label,value,detail],i)=>{const x=58+i*(w+12);panel(x,y,w,height);text(label,x+w/2,y+(square?23:29),square?17:20,'#adc5cc',w-20);text(value,x+w/2,y+(square?53:68),square?30:38,'#fff',w-20);if(detail)text(detail,x+w/2,y+height-13,square?17:20,'#adc5cc',w-20);});
      }else if(section==='collection'){
        text('MIN MEDALJESAMLING',540,y+23,square?18:21,color);const edge=collectionSize(m.previous.length),rowWidth=m.previous.length*edge+(m.previous.length-1)*16;
        for(const [i,b]of m.previous.entries())drawCollectionMedal(ctx,await loadCanvasImage(BADGE_IMAGES[String(b.n)]),540-rowWidth/2+i*(edge+16),y+34,edge);
      }else if(section==='goal'){
        text(`Neste delmål · ${m.next.next.name}`,58,y+25,square?20:24,'#adc5cc',760,'left');text(`${p.c} / ${m.next.next.n}`,1022,y+25,square?23:28,color,190,'right');panel(58,y+height-22,964,8,'#28434f');panel(58,y+height-22,964*p.c/m.next.next.n,8,color);
      }else if(section==='support'){
        const values=[...(m.best?[[m.best.label,displayTime(m.best.row[5]),`${m.best.row[3]} · ${m.best.row[0]}`]]:[]),['Samlet registrert distanse',formatKm(m.totals.km),'Fullførte, registrerte resultater']];
        const w=(964-14*(values.length-1))/values.length;
        values.forEach(([label,value,detail],i)=>{const x=58+i*(w+14);panel(x,y,w,height);text(label,x+w/2,y+(square?22:29),square?19:23,'#adc5cc',w-22);text(value,x+w/2,y+(square?52:72),square?29:40,'#fff',w-22);text(detail,x+w/2,y+(square?76:101),square?16:18,'#adc5cc',w-22);});
      }
      y+=height+spacing;
    }
    ctx.restore();text('Finn din egen Morothon-historie',540,footerTop+20,square?23:27);text('morothon.no · Resultater, merker og minner',540,footerTop+49,18,color);
    return new Promise((resolve,reject)=>c.toBlob(blob=>{if(!blob)return reject(new Error('Kunne ikke eksportere skrytekortet.'));resolve({blob,url:URL.createObjectURL(blob),format,width:c.width,height:c.height,layout:{scale,spacing,sections:boxes,collectionEdge:collectionSize(m.previous.length)*scale}});},'image/png'));
  }

  window.MorothonCard = { model, profileHtml, build, honorText, linesFor, heroLayout, cardStats, collectionSize, visibleBounds, FORMATS };
})();
