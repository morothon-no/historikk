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

  async function serviceContent(member, badgeId, ids, contribution, illustrative=false) {
    const [badges,register]=await Promise.all([MorothonBadges.init(),eventDates()]);
    const assets=await Promise.all(ids.map(inspectAsset));
    const gratitude=badgeId==='thanks';
    const badge=gratitude?{id:'thanks',name:'Takk for innsatsen',color:'#A47A46'}:MorothonBadges.get(badgeId),asset=assets.find(a=>a.key===(gratitude?'debut':badgeId));
    if(!asset)throw new Error('Diplomet mangler et hovedmerke.');
    // Only documented volunteer editions count. For a numbered milestone the event
    // date belongs to the Nth confirmed edition, not to printing or awarding the diploma.
    // A special 35-edition tribute uses the last confirmed event, but no undated
    // honorary distinction receives an invented award date.
    const milestone=badge.series==='dugnad'?badge.milestoneEditions:null;
    const knownYears=contribution.years||[];
    const achievementYear=!illustrative&&milestone&&knownYears.length>=milestone
      ? knownYears[milestone-1]
      : !illustrative&&!milestone&&contribution.count===35&&knownYears.length===35
        ? knownYears.at(-1)
        : null;
    const eventDate=achievementYear?register.dates[String(achievementYear)]||null:null;
    const achievementDateLabel=eventDate?dateLabel(achievementYear,register):'';
    const earnedYears=!illustrative&&milestone&&knownYears.length>=milestone?knownYears.slice(0,milestone):null;
    return {name:member.name,honoreeId:member.id||null,type:'service',tier:'service',title:badge.name,
      roleLabel:gratitude?(member.roles||[]).filter(r=>r.confirmed).map(r=>r.title).join(' · '):badge.name,
      tribute:gratitude?'Morothon blir ikke til av seg selv. Bak hver eneste løper står mennesker som gir av sin tid, sitt engasjement og sitt gode humør. Takk for ditt bidrag til løpsglede, fellesskap og ekte Morothon-moro!':member.diplomaTribute||'',
      provisional:true,asset,assetKey:gratitude?'debut':badgeId,gratitude,printMode:'draft',
      secondaryAssets:[],memorial:badgeId==='service-memorial',
      contributionCount:gratitude?null:earnedYears?milestone:contribution.count||null,contributionFirst:gratitude?null:earnedYears?.[0]??contribution.first,contributionLast:gratitude?null:earnedYears?.at(-1)??contribution.last,
      achievementYear,eventDate,dateBasis:eventDate?'documented-race-date':'not-established',
      illustrative,imageReady:false,previewOnly:true,color:badge.color,firstEdition:1992,editionNumber:null,
      watermarkSrc:new URL(badges.watermark.src,document.baseURI).href,dateLabel:achievementDateLabel,
      filename:`${member.id||'fem-dugnadsaar'}-${badge.id}-${illustrative?'eksempel':'diplom'}`,description:'Et personlig diplom fra Morothon.',citation:''};
  }
  async function serviceDraft(id = 'oscar-lohne', requestedBadgeId) {
    const data=await MorothonHonorsData.load(),{member}=await MorothonHonorsData.find(id);
    let years=[];try{years=MorothonHonorsData.arrangedYears((await MorothonHistoryData.load()).data.results);}catch{}
    const main=MorothonHonorsData.mainBadge(data,member,years),options=MorothonHonorsData.diplomaChoices(data,member,years);
    const badgeId=requestedBadgeId||options[0]||'thanks';
    if(!options.includes(badgeId)||!MorothonHonorsData.isActiveBadge(data,badgeId))throw new Error('Ingen slik aktiv hedersutmerkelse har beregningsgrunnlag for denne profilen.');
    const milestone=badgeId!=='thanks'&&MorothonBadges.get(badgeId).series==='dugnad';
    const selectedText=milestone?data.diplomaExamples.find(e=>e.illustrative&&e.badgeId===badgeId)?.tribute:null;
    // A historical milestone is its own achievement, without later honorary proposals.
    const draft=await serviceContent(selectedText?{...member,diplomaTribute:selectedText}:member,badgeId,[badgeId==='thanks'?'debut':badgeId],MorothonHonorsData.contribution(member));
    if(milestone&&main.basis==='estimated')Object.assign(draft,{estimated:true,estimatedCount:main.count,estimatedFirst:main.fromYear,estimatedLast:main.toYear??years.at(-1),provisionalEnd:main.toYearStatus==='provisional',tribute:member.diplomaTribute||'Takk for at du gir av din tid og dine krefter til Morothon. Innsatsen og fellesskapet gjør løpet mulig.'});
    return withServiceApproval(data,draft);
  }
  async function serviceExample(id) {
    const data=await MorothonHonorsData.load(),example=data.diplomaExamples?.find(e=>e.id===id);
    if(!example)throw new Error('Diplomet finnes ikke.');
    if(example.personId)return serviceDraft(example.personId,example.badgeId);
    return withServiceApproval(data,await serviceContent({name:example.name,diplomaTribute:example.tribute},example.badgeId,[example.badgeId==='thanks'?'debut':example.badgeId],{count:example.contributionCount},true));
  }

  // A review fingerprint covers the final composition, graphics and CSS.
  // Deployment origin/cache URLs are deliberately excluded, so a reviewed
  // document remains valid when the identical files move from local QA to Pages.
  async function serviceProof(diploma, renderedDocument) {
    const registry=await MorothonBadges.init();
    const response=await fetch(new URL('css/diplomas.css',document.baseURI).href,{cache:'no-cache'});
    if(!response.ok)throw new Error('Diplomets stilark kunne ikke kontrolleres.');
    const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const cssSha256=await sha(await response.arrayBuffer());
    const dom=renderedDocument||new DOMParser().parseFromString(serviceDocumentHtml({...diploma,printMode:'final',finalApproval:{verified:true}}),'text/html');
    // A clone owned by a live iframe may fetch images even while detached.
    // Normalize URLs in inert template content so proof-only asset: identifiers
    // never become real browser requests. Preserve the actual rendered markup.
    const template=document.createElement('template');template.innerHTML=dom.querySelector('.diploma-sheet').outerHTML;
    const sheet=template.content.firstElementChild;
    const assetSha256=diploma.asset.digest,watermarkSha256=registry.watermark.sha256;
    sheet.querySelector('.diploma-medal').setAttribute('src','asset:'+diploma.assetKey+':'+assetSha256);
    sheet.querySelector('.diploma-watermark').setAttribute('src','watermark:'+watermarkSha256);
    const content={html:sheet.outerHTML,inlineStyles:[...dom.querySelectorAll('head style')].map(e=>e.textContent),cssSha256,assetSha256,watermarkSha256};
    return {...content,contentSha256:await sha(new TextEncoder().encode(JSON.stringify(content)))};
  }
  function approvedServiceRecord(data,d,proof){
    if(d.illustrative||!d.honoreeId)return null;
    return (data.diplomaApprovals||[]).find(a=>a.personId===d.honoreeId&&a.badgeId===(d.gratitude?'thanks':d.assetKey)&&a.status==='approved'&&a.approvedForFinal===true&&a.contentSha256===proof.contentSha256)||null;
  }
  function presentationRecord(data,d,proof){
    const member=MorothonHonorsData.findIn(data,d.honoreeId)?.member;
    if(d.illustrative||!member||!MorothonHonorsData.canPresent(data,member,d.gratitude?'thanks':d.assetKey))return null;
    return data.presentationPrintSet?.scope==='presentation-only'
      ? data.presentationPrintSet.entries.find(e=>e.personId===d.honoreeId&&e.badgeId===(d.gratitude?'thanks':d.assetKey)&&['contentSha256','cssSha256','assetSha256','watermarkSha256'].every(k=>e[k]===proof[k]))||null
      : null;
  }
  async function withServiceApproval(data,diploma){
    const proof=await serviceProof(diploma),record=approvedServiceRecord(data,diploma,proof),registry=await MorothonBadges.init();
    diploma.contentProof={contentSha256:proof.contentSha256,cssSha256:proof.cssSha256,assetSha256:proof.assetSha256,watermarkSha256:proof.watermarkSha256};
    if(record&&diploma.asset.ready&&registry.watermark.printReady===true){
      diploma.printMode='final';diploma.finalApproval={id:record.id,verified:true};
      diploma.imageReady=true;diploma.filename=diploma.filename.replace(/-diplomutkast$/,'-diplom');
    }else if(presentationRecord(data,diploma,proof)){
      diploma.printMode='presentation';diploma.presentationApproval={verified:true,setId:data.presentationPrintSet.id};
      diploma.filename=diploma.filename.replace(/-diplomutkast$/,'-diplom');
    }
    return diploma;
  }

  // Printable drafts are a separate permission from approved/issued diplomas.
  // Design/crop approval remains a warning; missing, corrupt, opaque, clipped or
  // insufficient raster graphics and actual layout failures still block output.
  async function checkServiceDraft(draft, doc) {
    const failures=[],warnings=[];
    let layout=null;
    if(draft?.type!=='service'||draft.previewOnly!==true||!['draft','final','presentation'].includes(draft.printMode))failures.push('Ugyldig utskriftsmodus for hedersdiplomet.');
    try {
      layout=await checkLayout(doc);failures.push(...layout.failures);
      const registry=await MorothonBadges.init(),asset=await inspectAsset(draft.assetKey),settings=MorothonBadges.get(draft.assetKey);
      const medal=doc.querySelector('.diploma-medal'),watermark=doc.querySelector('.diploma-watermark');
      if(doc.querySelector('link[rel="stylesheet"]')?.href!==new URL('css/diplomas.css',document.baseURI).href)failures.push('Diplomet bruker ikke det kontrollerte stilarket.');
      if(!medal||medal.src!==asset.src||!watermark||watermark.src!==new URL(registry.watermark.src,document.baseURI).href)failures.push('Grafikken samsvarer ikke med det felles bildebiblioteket.');
      if(settings.status==='missing-cutout'||!(asset.width>0&&asset.height>0))failures.push('Gyldig originalgrafikk mangler.');
      if(draft.gratitude?draft.assetKey!=='debut':settings.kind!=='service'||settings.active===false)failures.push('Ugyldig grafikk for denne diplomtypen.');
      if(draft.assetKey!=='debut'&&!asset.transparent)failures.push('Medaljen mangler gjennomsiktig bakgrunn.');
      if(asset.edgeContact)failures.push('Motivet berører bildekanten. Kontroller mulig avkutting før utskrift.');
      // The actual displayed size matters, not just the default registry size.
      const sheet=doc.querySelector('.diploma-sheet'),nativeWidth=parseFloat(doc.defaultView.getComputedStyle(sheet).width),scale=sheet.getBoundingClientRect().width/nativeWidth;
      const box=medal.getBoundingClientRect(),dpi=Math.min(asset.width/(box.width/scale),asset.height/(box.height/scale))*96;
      const response=await fetch(asset.src);if(!response.ok)throw new Error('Merkefilen kunne ikke lastes.');
      const bytes=await response.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==asset.digest)failures.push('Merkefilen er endret siden bildekontrollen. Last siden på nytt.');
      const vector=new URL(asset.src).pathname.endsWith('.svg');
      if(vector){
        const xml=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'image/svg+xml');
        if(xml.documentElement.localName!=='svg'||xml.querySelector('parsererror,image,script,foreignObject')||[...xml.querySelectorAll('use')].some(e=>{const ref=e.getAttribute('href')||e.getAttributeNS('http://www.w3.org/1999/xlink','href');return !ref?.startsWith('#')||!xml.getElementById(ref.slice(1));})||!xml.querySelector('path,polygon,circle,ellipse,rect'))failures.push('SVG-merket er ugyldig eller har usikre eksterne avhengigheter.');
      }else if(!Number.isFinite(dpi)||dpi<registry.minimumDpi)failures.push(`Grafikken gir ${Math.floor(dpi)} DPI i diplomet; minst ${registry.minimumDpi} DPI kreves.`);
      const watermarkResponse=await fetch(watermark.src);if(!watermarkResponse.ok)throw new Error('Vannmerket kunne ikke lastes.');
      const watermarkBytes=await watermarkResponse.arrayBuffer(),watermarkDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',watermarkBytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(watermarkDigest!==registry.watermark.sha256)failures.push('Vannmerket samsvarer ikke med den godkjente originalen.');
      warnings.push(...asset.issues,...asset.warnings);
      const stamp=doc.querySelector('.diploma-draft'),style=stamp&&doc.defaultView.getComputedStyle(stamp),r=stamp?.getBoundingClientRect();
      if(draft.printMode==='final'){
        const data=await MorothonHonorsData.load(),proof=await serviceProof(draft,doc);
        if(!approvedServiceRecord(data,draft,proof))failures.push('Diplomet mangler særskilt godkjenning av dette innholdet for endelig bruk.');
        if(!asset.ready||registry.watermark.printReady!==true)failures.push('Grafikken er ikke godkjent for endelig bruk.');
        if(stamp)failures.push('Diplomet samsvarer ikke med den godkjente endelige versjonen.');
      }else if(draft.printMode==='presentation'){
        const data=await MorothonHonorsData.load(),proof=await serviceProof(draft,doc);
        if(!presentationRecord(data,draft,proof))failures.push('Presentasjonsdiplomet samsvarer ikke med det kontrollerte utskriftssettet.');
        if(stamp)failures.push('Presentasjonsdiplomet samsvarer ikke med den kontrollerte versjonen.');
      }else if(stamp?.textContent.trim()!==(draft.illustrative?'EKSEMPEL':'FORHÅNDSVISNING')||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)!==1||!r?.width||!r?.height||parseFloat(style.fontSize)<10)failures.push('Synlig forhåndsvisningsmerking mangler i selve diplomet.');
    }catch(error){failures.push('Diplomet kan ikke skrives ut: '+error.message);}
    return {ready:failures.length===0,mode:draft.printMode,layout,failures:[...new Set(failures)],warnings:[...new Set(warnings)]};
  }
  async function printServiceDraft(draft, frame) {
    const doc=frame.contentDocument,result=await checkServiceDraft(draft,doc);
    if(doc!==frame.contentDocument||doc.title!==draft.filename)throw new Error('Diplomvalget ble endret. Vent til den nye forhåndsvisningen er kontrollert.');
    if(!result.ready)throw new Error(result.failures.join(' '));
    // These functions only open the browser dialog; no award or issued record is created.
    frame.contentWindow.focus();frame.contentWindow.print();return result;
  }

  function signoffHtml(date) {
    return `<div class="diploma-signoff" data-layout-check>
      <div class="diploma-date"><p class="diploma-handwritten">${safe(date)}</p><div class="diploma-signature-line" aria-hidden="true"></div></div>
      <div class="diploma-signature"><b class="diploma-handwritten">Håkon Lohne</b><div class="diploma-signature-line" aria-label="Signaturlinje"></div><span class="diploma-signature-role">Løpsleder Morothon</span></div>
    </div>`;
  }

  // Volunteer diplomas show the documented milestone YEAR only. The exact race
  // date stays in the model for provenance, and there is no invented award date.
  // Anonymous examples have neither a year placeholder nor a date underline.
  function serviceSignoffHtml(d) {
    const label=d.achievementYear
      ? d.assetKey.startsWith('service-dugnad-')
        ? 'MILEPÆL OPPNÅDD I '+d.achievementYear
        : d.contributionCount===35 ? '35 DUGNADSUTGAVER I '+d.achievementYear : ''
      : '';
    return signoffHtml(label)
      .replace('class="diploma-signoff"', 'class="diploma-signoff diploma-service-signoff"')
      .replace('<div class="diploma-signature-line" aria-hidden="true"></div>', '');
  }

  function serviceDocumentHtml(d) {
    const css=new URL('css/diplomas.css',document.baseURI).href;
    const founder=d.assetKey==='service-grunnlegger',highest=d.assetKey==='service-aeresmerke',memorial=d.memorial===true,gratitude=d.gratitude===true,lifelong=highest&&d.contributionCount===35;
    const heading=gratitude?'TAKK FOR INNSATSEN':memorial?'MINNEDIPLOM':founder?'GRUNNLEGGERDIPLOM':highest?'ÆRESDIPLOM':lifelong?'HEDERSDIPLOM':'DUGNADSDIPLOM';
    const tribute=d.tribute||(founder?'Med takk og heder til en av Morothons grunnleggere.':'Med takk for tid, krefter og fellesskap. Du er med på å gjøre Morothon mulig.');
    const secondary=[];
    const secondaryHtml=secondary.length?`<div class="diploma-service-secondary${secondary.length>2?' diploma-service-secondary-three':''}" data-layout-check>${secondary.map(a=>`<figure data-layout-check><img src="${safe(a.src)}" alt="${safe(a.name)}"><figcaption>${safe(a.name)}</figcaption></figure>`).join('')}</div>`:`<div class="diploma-service-words" data-layout-check><b>${d.contributionCount?'TAKK':'FELLESSKAP'}</b><span>${d.contributionCount?'FOR AT DU STILLER OPP':'MOROTHON BLIR TIL SAMMEN'}</span></div>`;
    const value=gratitude?'TAKK':memorial?'MINNE':d.estimated?d.estimatedCount:d.contributionCount|| (founder?'1992':'TAKK'),label=gratitude?'FOR DITT BIDRAG':memorial?'MED TAKKNEMLIGHET':d.estimated?'MULIGE DUGNADSUTGAVER':d.contributionCount?'UTGAVER MED INNSATS':founder?'DER HISTORIEN BEGYNTE':'FOR TID OG KREFTER';
    const period=gratitude?'':d.estimated?`${d.estimatedFirst}–${d.estimatedLast} · anslag${d.provisionalEnd?' · foreløpig sluttår':''}`:d.contributionFirst&&d.contributionLast?`${d.contributionFirst}–${d.contributionLast}`:d.illustrative?`${d.contributionCount||'?'} dugnadsutgaver · typeeksempel`:'';
    return `<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safe(d.filename)}</title><style>@page{size:A4 landscape;margin:0}</style><link rel="stylesheet" href="${safe(css)}"></head>
      <body class="diploma-document"><article class="diploma-sheet diploma-service diploma-service-v34${lifelong?' diploma-service-lifelong':''}" style="--diploma-metal:${d.color};--diploma-image-width:${d.asset.boxWidthMm}mm;--diploma-image-height:${d.asset.boxHeightMm}mm;--diploma-name-size:${d.name.length>38?8:d.name.length>26?9:12.3}mm" aria-label="Diplom til ${safe(d.name)}">
      <span class="diploma-corner corner-tl" aria-hidden="true"></span><span class="diploma-corner corner-tr" aria-hidden="true"></span><span class="diploma-corner corner-bl" aria-hidden="true"></span><span class="diploma-corner corner-br" aria-hidden="true"></span>
      <img class="diploma-watermark" src="${safe(d.watermarkSrc)}" alt="">
      <div class="diploma-brand" data-layout-check><b>SØGNE MOROTHON</b><span>SIDEN ${d.firstEdition}</span></div>
      <div class="diploma-heading" data-layout-check><p>${memorial?'MINNENE OG FELLESSKAPET LEVER VIDERE':lifelong?'35 UTGAVER MED TID OG KREFTER':'FOR LØPSGLEDE OG FELLESSKAP'}</p><h1>${heading}</h1></div>
      <div class="diploma-recipient" data-layout-check><p>${memorial?'TIL MINNE OM':gratitude?'EN VARM TAKK TIL':'MED TAKK TIL'}</p><h2>${safe(d.name)}</h2><h3>${safe(d.roleLabel)}</h3></div>
      <div class="diploma-main diploma-service-main"><div class="diploma-metric" data-layout-check><strong>${safe(value)}</strong><span>${label}</span><small>${safe(period)}</small></div><figure data-layout-check><img class="diploma-medal" src="${safe(d.asset.src)}" alt="${safe(d.roleLabel)}"></figure>${secondaryHtml}</div>
      <div class="diploma-citation" data-layout-check><p class="diploma-description">${safe(tribute)}</p>${d.tribute?'':'<strong>Et varig bidrag til Morothons historie.</strong>'}</div>
      ${serviceSignoffHtml(d)}
      ${d.printMode==='final'&&d.finalApproval?.verified===true||d.printMode==='presentation'&&d.presentationApproval?.verified===true?'':`<p class="diploma-draft" data-layout-check>${d.illustrative?'EKSEMPEL':'FORHÅNDSVISNING'}</p>`}
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
      ${signoffHtml(d.dateLabel)}
      </article></body></html>`;
  }

  async function checkLayout(doc) {
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(image => image.decode()));
    const sheet = doc.querySelector('.diploma-sheet'), page = sheet.getBoundingClientRect();
    const win = doc.defaultView, style = win.getComputedStyle(sheet);
    // One CSS px (0.265mm at 96dpi), only for fractional layout/font rounding.
    // scrollWidth/clientWidth are integers and are diagnostics, not proof of clipping.
    const tolerance = 1, width = parseFloat(style.width), height = parseFloat(style.height);
    const scale = page.width / width || 1;
    const rect = r => ({ left: (r.left-page.left)/scale, right: (r.right-page.left)/scale,
      top: (r.top-page.top)/scale, bottom: (r.bottom-page.top)/scale,
      width: r.width/scale, height: r.height/scale });
    const bounds = element => rect(element.getBoundingClientRect());
    const paper = rect(page), failures = [], measurements = [], cache = new WeakMap();
    const fail = message => { if (!failures.includes(message)) failures.push(message); };
    if (Math.abs(width-297*96/25.4)>tolerance || Math.abs(height-210*96/25.4)>tolerance ||
        !(page.width>0 && page.height>0) || Math.abs(page.width/page.height-297/210)>.001) fail('Siden har ikke korrekt liggende A4-format.');
    const rawCache = new WeakMap(), textCache = new WeakMap(), fragments = new WeakMap();
    const inkContext = doc.createElement('canvas').getContext('2d');
    function numericInk(node, raw) {
      const element = node.parentElement, cs = win.getComputedStyle(element);
      // Range rectangles enclose the font's ascent/descent, including unused space.
      // Only the plain, single-line numeric fields have a known shaping contract.
      if (!inkContext || !element.matches('.diploma-metric strong') || element.childNodes.length!==1 || raw.length!==1 ||
          !/^[\d\s:.,%]+$/.test(node.textContent) || cs.transform!=='none' || cs.fontStyle!=='normal' ||
          cs.textShadow!=='none' || parseFloat(cs.webkitTextStrokeWidth)>0 ||
          (cs.fontSizeAdjust && cs.fontSizeAdjust!=='none') || cs.fontFeatureSettings!=='normal' || cs.fontVariationSettings!=='normal')
        return { boxes: raw, method: 'range' };
      const before = bounds(element), marker = doc.createElement('i');
      marker.setAttribute('aria-hidden','true');
      marker.style.cssText='display:inline-block!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;vertical-align:baseline!important;position:static!important;transform:none!important';
      let baseline, during;
      try { element.appendChild(marker); baseline = (marker.getBoundingClientRect().top-page.top)/scale; during = bounds(element); }
      finally { marker.remove(); }
      const after = bounds(element);
      if (['left','right','top','bottom'].some(side=>Math.abs(before[side]-during[side])>.01 || Math.abs(before[side]-after[side])>.01)) return { boxes: raw, method: 'range' };
      inkContext.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      inkContext.fontKerning = cs.fontKerning;
      const ink = inkContext.measureText(node.textContent), ascent = ink.actualBoundingBoxAscent, descent = ink.actualBoundingBoxDescent;
      if (![baseline,ascent,descent].every(Number.isFinite) || ascent+descent<=0) return { boxes: raw, method: 'range' };
      // Keep Range's conservative horizontal extent. Correct only the unused vertical font space.
      const visible = { ...raw[0], top: baseline-ascent, bottom: baseline+descent, height: ascent+descent };
      return { boxes: [visible], method: 'numeric-ink', font: inkContext.font, baseline, ascent, descent };
    }
    function union(boxes, fallback) {
      return boxes.length ? { left: Math.min(...boxes.map(b=>b.left)), right: Math.max(...boxes.map(b=>b.right)),
        top: Math.min(...boxes.map(b=>b.top)), bottom: Math.max(...boxes.map(b=>b.bottom)) } : fallback;
    }
    function contentBounds(element) {
      if (cache.has(element)) return cache.get(element);
      const boxes = [...element.querySelectorAll('*')].filter(child => {
        const cs = win.getComputedStyle(child);
        return /^(IMG|SVG|CANVAS|VIDEO|IFRAME)$/.test(child.tagName) ||
          cs.backgroundColor!=='rgba(0, 0, 0, 0)' || ['Top','Right','Bottom','Left'].some(side=>parseFloat(cs[`border${side}Width`])>0);
      }).map(bounds).filter(b => b.width>0 && b.height>0);
      const rawBoxes = boxes.slice(), textFragments = [], walker = doc.createTreeWalker(element, 4), range = doc.createRange();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        if (!textCache.has(node)) {
          range.selectNodeContents(node);
          const raw = [...range.getClientRects()].filter(r=>r.width>0 && r.height>0).map(rect);
          textCache.set(node,{ raw, ...numericInk(node,raw) });
        }
        const measured = textCache.get(node);
        boxes.push(...measured.boxes); rawBoxes.push(...measured.raw);
        textFragments.push({ text: node.textContent, ...measured });
      }
      const fallback = bounds(element), result = union(boxes,fallback);
      rawCache.set(element,union(rawBoxes,fallback)); fragments.set(element,textFragments);
      cache.set(element,result); return result;
    }
    const overflow = (b, area) => ({ left: Math.max(0,area.left-b.left), right: Math.max(0,b.right-area.right),
      top: Math.max(0,area.top-b.top), bottom: Math.max(0,b.bottom-area.bottom) });
    const outside = sides => Object.values(sides).some(value=>value>tolerance);
    const selector = '[data-layout-check],.diploma-recipient h2,.diploma-metric strong,.diploma-description,.diploma-date p,.diploma-signature b,.diploma-signature span,.diploma-edition';
    for (const element of doc.querySelectorAll(selector)) {
      const box = bounds(element), content = contentBounds(element);
      // A font's line box may overhang the text element without leaving its allocated field.
      const field = element.closest('[data-layout-check]') || element;
      const fieldBox = bounds(field), outsideField = overflow(content,fieldBox);
      const outsidePage = overflow({ left: Math.min(box.left,content.left), right: Math.max(box.right,content.right),
        top: Math.min(box.top,content.top), bottom: Math.max(box.bottom,content.bottom) },paper);
      let clipped = false;
      for (const child of [element,...element.querySelectorAll('*')]) {
        const cs = win.getComputedStyle(child), spill = overflow(contentBounds(child),bounds(child));
        if (/hidden|clip|auto|scroll/.test(cs.overflowX) && (spill.left>tolerance || spill.right>tolerance) ||
            /hidden|clip|auto|scroll/.test(cs.overflowY) && (spill.top>tolerance || spill.bottom>tolerance)) clipped = true;
      }
      measurements.push({ element: element.className || element.tagName.toLowerCase(), field: field.className,
        bounds: box, contentBounds: content, rawContentBounds: rawCache.get(element), fieldBounds: fieldBox,
        outsideField, rawOutsideField: overflow(rawCache.get(element),fieldBox), outsidePage, clipped,
        failedChecks: [outside(outsideField)&&'outsideField',outside(outsidePage)&&'outsidePage',clipped&&'clipped'].filter(Boolean),
        textFragments: fragments.get(element),
        scrollOverflow: { x: Math.max(0,element.scrollWidth-element.clientWidth), y: Math.max(0,element.scrollHeight-element.clientHeight) } });
      if (outside(outsideField) || outside(outsidePage) || clipped) fail(`Innholdet passer ikke: ${element.className || element.tagName.toLowerCase()}`);
    }
    const image = doc.querySelector('.diploma-medal'), imageBox = bounds(image), figureBox = bounds(image.parentElement);
    if (outside(overflow(imageBox,figureBox))) fail('Medaljen passer ikke i det avsatte bildefeltet.');
    const main = bounds(doc.querySelector('.diploma-main')), recipient = bounds(doc.querySelector('.diploma-recipient'));
    if (recipient.bottom>main.top+tolerance) fail('Navnefeltet overlapper medalje- og nøkkeltallsfeltet.');
    const parts = [...doc.querySelectorAll('.diploma-main > *')].map(bounds);
    if (parts.some(b=>outside(overflow(b,main)))) fail('Medalje og nøkkeltall passer ikke i hovedfeltet.');
    if (parts.some((b,i)=>i>0 && parts[i-1].right>b.left+tolerance)) fail('Medalje og nøkkeltall overlapper hverandre.');
    const fields = ['.diploma-brand','.diploma-heading','.diploma-recipient','.diploma-main','.diploma-citation','.diploma-signoff'].map(selector=>doc.querySelector(selector));
    for (let i=1;i<fields.length;i++) if (bounds(fields[i-1]).bottom>bounds(fields[i]).top+tolerance)
      fail(`Diplomfeltene overlapper: ${fields[i-1].className} / ${fields[i].className}`);
    return { ready: failures.length===0, failures, width: paper.width, height: paper.height, tolerance, measurements };
  }

  function fitPreview(viewport, frame) {
    if (!viewport || !frame) return;
    const win = viewport.ownerDocument.defaultView, box = win.getComputedStyle(viewport), native = win.getComputedStyle(frame);
    const px = value => parseFloat(value)||0;
    const available = viewport.clientWidth-px(box.paddingLeft)-px(box.paddingRight);
    const width = px(native.width), height = px(native.height);
    if (!(available>0 && width>0 && height>0)) return;
    const scale = available/width;
    frame.style.transform = `scale(${scale})`;
    // Include the preview border: its former border-box height clipped the A4 bottom edge.
    const extra = px(box.paddingTop)+px(box.paddingBottom)+(box.boxSizing==='border-box' ? px(box.borderTopWidth)+px(box.borderBottomWidth) : 0);
    viewport.style.height = `${Math.ceil((height*scale+extra)*64)/64}px`;
  }

  function resizePreview() {
    fitPreview(ui.dialog?.querySelector('.diploma-preview'),ui.dialog?.querySelector('iframe'));
  }

  function closeDialog() {
    if (!ui.dialog?.open) return;
    // End the current render synchronously; the native close event may arrive later.
    ui.sequence++; ui.current = null; ui.dialog.close();
    ui.focus?.focus({ preventScroll: true });
  }

  function ensureDialog() {
    if (ui.dialog) return;
    const dialog = document.createElement('dialog'); dialog.id = 'diplomaDialog'; dialog.className = 'diploma-dialog'; dialog.setAttribute('aria-labelledby','diplomaDialogTitle'); dialog.setAttribute('aria-describedby','diplomaPrintHelp');
    dialog.innerHTML = `<div class="diploma-toolbar"><h2 id="diplomaDialogTitle">Lag diplom</h2><button type="button" data-diploma-close>Tilbake</button></div><label class="diploma-choice">Velg opptjent diplom<select id="diplomaChoice"></select></label>
      <div id="diplomaStatus" role="status" aria-live="polite"></div><div class="diploma-preview"><iframe title="Forhåndsvisning av diplom" sandbox="allow-same-origin allow-modals"></iframe></div>
      <div class="diploma-controls"><button type="button" data-diploma-print disabled>Skriv ut diplom</button><button type="button" data-diploma-pdf disabled>Lagre som PDF</button></div>
      <p class="diploma-print-help" id="diplomaPrintHelp">Liggende A4 · skala 100 % · ingen marger · bakgrunnsgrafikk på · topp- og bunntekst av. «Lagre som PDF» åpner utskriftsdialogen; velg PDF som skriver.</p>`;
    document.body.appendChild(dialog); ui.dialog = dialog;
    dialog.querySelector('[data-diploma-close]').addEventListener('click', closeDialog);
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(); } });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      ui.sequence++; ui.current = null;
      const active = document.activeElement;
      // Do not steal focus from a different control/dialog opened after this one closed.
      if (!active || active===document.body || dialog.contains(active)) ui.focus?.focus({ preventScroll: true });
    });
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
      frame.contentDocument.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(); } });
      const layout = await checkLayout(frame.contentDocument);
      if (token !== ui.sequence) return;
      const issues = [...diploma.asset.issues, ...layout.failures];
      ui.current = { ...diploma, layout, ready: diploma.imageReady && layout.ready };
      status.replaceChildren();
      const heading = document.createElement('strong'); heading.textContent = issues.length ? 'Forhåndsvisning – ikke utskriftsklar' : diploma.asset.warnings?.length ? 'Godkjent for utskrift – dokumenterte bildekvalitetsbegrensninger' : 'Bilde- og layoutkontroll bestått'; status.appendChild(heading);
      if (issues.length) { const list = document.createElement('ul'); for (const issue of issues) { const li = document.createElement('li'); li.textContent = issue; list.appendChild(li); } status.appendChild(list); }
      else if (diploma.asset.warnings?.length) {
        const details = document.createElement('details'); details.className = 'diploma-quality';
        const summary = document.createElement('summary'); summary.textContent = 'Vis bildekvalitet'; details.appendChild(summary);
        const resolution = document.createElement('p'); resolution.textContent = `Original: ${diploma.asset.width} × ${diploma.asset.height} piksler. Godkjenningen gjelder denne bildefilen.`; details.appendChild(resolution);
        const list = document.createElement('ul'); for (const warning of diploma.asset.warnings) { const li = document.createElement('li'); li.textContent = warning; list.appendChild(li); } details.appendChild(list); status.appendChild(details);
      }
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

  window.MorothonDiplomas = { choices, model, prepare, serviceDraft, serviceExample, serviceProof, checkServiceDraft, printServiceDraft, documentHtml, inspectAsset, checkLayout, fitPreview, dateLabel, eventDates, open, init,
    isOpen: () => !!ui.dialog?.open, current: () => ui.current };
})();
