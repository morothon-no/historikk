/* V3.4: one identity per person, warm history and printable, clearly unissued service drafts. */
window.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async function(){
 'use strict';
 const $=s=>document.querySelector(s),status=$('#honorStatus'),overview=$('#honorOverview'),profile=$('#honorProfile');
 let sequence=0,cleanupProfile=()=>{},lastProfileId=null;
 const showStatus=e=>{status.textContent=`Kunne ikke laste forhåndsvisningen: ${e.message}`;};
 try{
  const data=await MorothonHonorsData.load(),all=data.groups.flatMap(g=>g.members);
  let history=null;try{history=await MorothonHistoryData.load();}catch{status.textContent='Løpshistorikken er ikke tilgjengelig akkurat nå.';}
  const editionYears=history?MorothonHonorsData.arrangedYears(history.data.results):[];
  const linkedStats=m=>m.runnerId&&history?history.stats(m.runnerId):null;
  const runnerLink=m=>{const s=linkedStats(m);return s?`index.html#lop=${encodeURIComponent(s.id)}`:null;};
  const roleTitle=m=>(m.roles||[]).filter(r=>r.confirmed)[0]?.title||'En del av Morothon-historien';
  const listingLabel=m=>[(m.roles||[]).filter(r=>r.confirmed).map(r=>r.title).join(' · '),m.contribution?.fromYear?'fra '+m.contribution.fromYear:''].filter(Boolean).join(' · ');
  const planFor=m=>MorothonHonorsData.badgePlan(data,m,MorothonHonorsData.findIn(data,m.id).group);
  const badgeImg=(id,cls='')=>`<img class="${cls}" src="${esc(MorothonBadges.source(id))}" alt="${esc(MorothonBadges.get(id).name)} – merkeutkast">`;
  const sourceLinks=(ids=[],fallback='')=>`<small class="honor-source">${ids.map(id=>data.sources?.[id]).filter(Boolean).map(s=>s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.title)}</a>`:esc(s.title)).join(' · ')||esc(fallback)}</small>`;
  const founders=data.groups.find(g=>g.id==='founders')?.members.filter(m=>m.status==='confirmed')||[];
  const founderStats=founders.map(member=>({member,stats:linkedStats(member)})).filter(x=>x.stats);
  const largestCount=founderStats.length===founders.length?Math.max(0,...founderStats.map(x=>x.stats.count)):0;
  const historic21=s=>s.best.find(b=>b.event==='Morothon'&&b.km===21&&b.period==='historical');
  const fastest21=Math.min(Infinity,...founderStats.map(x=>historic21(x.stats)).filter(Boolean).map(b=>MorothonHistoryData.timeSeconds(b.row[5])));
  function distinctions(member,group,s){
   if(!s||group.id!=='founders')return [];
   const labels=[];if(s.count===largestCount&&largestCount>0)labels.push('Flest løpsdeltakelser blant grunnleggerne');
   const best=historic21(s);if(best&&MorothonHistoryData.timeSeconds(best.row[5])===fastest21)labels.push('Raskeste grunnlegger – historisk 21 km');return labels;
  }
  const mainFor=m=>MorothonHonorsData.mainBadge(data,m,editionYears);
  const optionsFor=m=>MorothonHonorsData.diplomaChoices(data,m,editionYears);
  function mainCaption(member,main){
   if(!main.badgeId)return '';
   if(main.badgeId==='service-memorial')return `${main.qualifier==='at-least'?'Minst':'Om lag'} ${main.count} ${main.qualifier==='at-least'?'års innsats':'dugnadsutgaver'} · arrangørens anslag`;
   if(main.badgeId==='service-grunnlegger')return ''; // The role already says Grunnlegger.
   if(main.badgeId==='service-aeresmerke')return `${main.count} dokumenterte dugnadsutgaver · æresmerket er et forslag`;
   const period=main.toYear?`${main.fromYear}–${main.toYear}`:`siden ${main.fromYear}`;
   return `${main.count} ${main.basis==='documented'?'dokumenterte':'mulige'} dugnadsutgaver ${period} · Foreløpig ${main.editions}-årsmerke${main.toYearStatus==='provisional'?' · foreløpig sluttår':''}${main.excludedYears.length?' · kjente fravær fratrukket':''}`;
  }
  function card(member,featured=false){
   const main=mainFor(member),memorial=main.badgeId==='service-memorial',memorialLead=member.id==='erling-danielsen';
   const group=MorothonHonorsData.findIn(data,member.id).group,labels=distinctions(member,group,linkedStats(member));
   const caption=mainCaption(member,main),image=main.badgeId?badgeImg(main.badgeId,'honor-card-medal'):'';
   const mainNote=caption?`<span class="honor-main-caption" data-main-badge="${esc(main.badgeId)}" data-basis="${esc(main.basis)}">${esc(caption)}</span>`:'';
   const cls=`honor-person-card${featured?' honor-featured-card':''}${member.listingOnly?' honor-volunteer-card':''}${memorialLead?' honor-memorial-lead':''}`;
   const inner=`${image}<div><strong>${esc(member.name)}</strong><span class="honor-card-role">${esc(member.listingOnly?listingLabel(member):roleTitle(member))}</span>${featured?`<span class="honor-tenure">35 utgaver · 1992–2026</span><p>${esc(member.reason)}</p>`:!member.listingOnly?`<span class="honor-card-summary">${esc(member.reason||'')}</span>`:''}${mainNote}${labels.map(label=>`<span class="honor-distinction">${esc(label)}</span>`).join('')}</div><span class="honor-open" aria-hidden="true"></span>`;
   return `<li data-honoree="${esc(member.id)}" class="${cls}"><a class="honor-person-main" href="#person/${esc(member.id)}">${inner}</a></li>`;
  }
  $('#honorHeading').textContent=data.narrative?.title||'De som gjør Morothon mulig ❤️';$('#honorLead').textContent=data.narrative?.lead||'';
  $('#honorThanks').textContent=data.narrative?.thanks||'';$('#honorThanks').hidden=!data.narrative?.thanks;
  $('#honorIntroText').innerHTML=(data.narrative?.intro||[]).map(p=>`<p>${esc(p)}</p>`).join('');
  // The five founders form one historical group. Oscar and Erling are given
  // larger cards for 35 documented editions, not a different founder status.
  const featuredIds=data.featuredIds||[];
  const otherFounders=founders.filter(member=>!featuredIds.includes(member.id));
  const rendered=new Set(founders.map(member=>member.id));
  $('#honorFeatured').classList.add('honor-group','honor-founders');
  $('#honorFeatured').dataset.honorGroup='founders';
  $('#honorFeatured').innerHTML=`<div class="honor-founders-heading"><p class="eyebrow">DER HISTORIEN STARTET · 1992</p><h2>Grunnleggerne – de som startet det hele</h2><p>Fem mennesker sto bak starten på Morothon i 1992. Alle fem er grunnleggere. To av dem har i tillegg bidratt i samtlige 35 utgaver.</p></div><ul class="honor-names honor-featured">${featuredIds.map(id=>card(MorothonHonorsData.findIn(data,id).member,true)).join('')}</ul><div class="honor-founder-others"><h3>Også med fra starten</h3><ul class="honor-names honor-founder-names">${otherFounders.map(member=>card(member)).join('')}</ul></div>`;
  $('#honorPeople').innerHTML=(data.displayOrder||data.groups.map(g=>g.id)).map(id=>data.groups.find(g=>g.id===id)).filter(group=>group&&group.id!=='founders').map(group=>{
   let members=MorothonHonorsData.membersFor(data,group).filter(m=>!rendered.has(m.id));members.forEach(m=>rendered.add(m.id));
   if(group.id==='volunteers')members=MorothonHonorsData.sortVolunteers(members);
   const estimationNote=group.id==='volunteers'?`<p class="honor-estimate-note">Eldste registrerte startår først. Mulige merker er foreløpige og ikke tildelt.${editionYears.length?` Anslag regnes til og med ${editionYears.at(-1)}, eventuelt et oppgitt sluttår, med kjente fravær trukket fra. Innsats hvert mellomliggende år er ikke bekreftet.`:' Anslag vises når løpshistorikken er tilgjengelig.'}</p>`:'';
   return `<section class="honor-group${group.id==='memorial'?' honor-memorial':''}" id="${esc(group.id)}" data-honor-group="${esc(group.id)}"><h2>${esc(group.title)}</h2><p>${esc(group.description||'')}</p>${estimationNote}<ul class="honor-names">${members.map(m=>card(m,false,group.id==='volunteers')).join('')}</ul></section>`;
  }).join('');
  $('#honorTimeline').innerHTML=(data.narrative?.timeline||[]).map(item=>`<article class="timeline-chapter"><span class="timeline-year">${esc(item.year)}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></article>`).join('');
  $('#honorSharedStories').innerHTML=(data.narrative?.sharedStories||[]).filter(s=>s.confirmed).map(s=>`<article class="honor-story"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`).join('');
  $('#honorClosing').textContent=data.narrative?.closing||'';
  const serviceDrafts=MorothonBadges.list('service').filter(b=>b.active!==false&&b.displayOnHonorPage!==false);
  const tenureDrafts=serviceDrafts.filter(b=>b.series==='dugnad').sort((a,b)=>a.milestoneEditions-b.milestoneEditions);
  const specialDrafts=serviceDrafts.filter(b=>b.series!=='dugnad');
  const badgeMarkup=badges=>badges.map(b=>`<article>${badgeImg(b.id)}<h3>${esc(b.name)}</h3><p>${b.series==='dugnad'?'Kandidat etter '+b.milestoneEditions+' bekreftede dugnadsutgaver.':'Særskilt utmerkelse etter individuell vurdering.'} Designutkast – ikke tildelt.</p></article>`).join('');
  $('#serviceBadges').innerHTML='<h3 class="badge-group-heading">Dugnadsmerker · 5 – 10 – 15 – 20 – 30 – 40</h3>'+badgeMarkup(tenureDrafts)+'<h3 class="badge-group-heading">Særskilt heder og minne</h3>'+badgeMarkup(specialDrafts);
  $('#honorSourceContent').innerHTML=`<p>Historiske roller, dokumenterte dugnadsår, anslag, forslag til merker, formelle tildelinger og utstedte diplomer holdes adskilt. Løpsstarter blir aldri dugnadsår. Foreløpige merker kan anslås fra startår, med eventuelt sluttår og kjente fravær; dette bekrefter ikke aktivitet i mellomliggende år. Eksplisitt dokumenterte årsrekker brukes uten å fylle inn antatte år. Tersklene følger merkepolicyen. Slike beregninger betyr bare at et merke kan vurderes, ikke at det er tildelt. Morothons æresmerke er høyeste utmerkelse og krever egen beslutning, uavhengig av antall år. Grunnlegger er en egen historisk heder. Ingen nye tildelinger er gjennomført her.</p><p>Håkon Lohnes navn i diplomene er typografisk satt, ikke en håndskrevet originalsignatur. Dato og signatur må godkjennes ved en eventuell utdeling.</p><ul>${Object.values(data.sources||{}).map(s=>`<li><b>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title)}</b><span>${esc(s.basis||'')}</span></li>`).join('')}</ul>${(data.narrative?.uncertainties||[]).map(s=>`<p>${esc(s.text)}</p>`).join('')}<details><summary>Opplysninger om personer og roller</summary>${all.map(m=>`<article><h3>${esc(m.name)}</h3><p>${(m.internalNotes||[]).map(esc).join(' ')}</p>${(m.roles||[]).map(r=>`<p>${esc(r.title)}${r.fromYear?' · fra '+r.fromYear:''}${r.note?' · '+esc(r.note):''}</p>`).join('')}${sourceLinks(m.sourceIds)}</article>`).join('')}</details><p>Resultatarkivet viser 128 registrerte deltakere i 1992. Arrangementsdatoen for 2018 er 11. november.</p>`;
  const normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nb-NO');
  $('#honorSearch').addEventListener('input',()=>{const q=normalize($('#honorSearch').value);let count=0;for(const li of overview.querySelectorAll('[data-honoree]')){const m=MorothonHonorsData.findIn(data,li.dataset.honoree).member;li.hidden=!normalize([m.name,...m.aliases||[],m.listingOnly?listingLabel(m):roleTitle(m)].join(' ')).includes(q);if(!li.hidden)count++;}for(const group of overview.querySelectorAll('.honor-group,#honorFeatured'))group.hidden=![...group.querySelectorAll('[data-honoree]')].some(e=>!e.hidden);$('#honorSearchStatus').textContent=q?`${count} navn i oversikten`:'';});
  function previewMarkup(options,title,cls='diploma-example'){return `<details class="${cls}"><summary>${esc(title)}</summary>${options.length>1?`<label class="honor-choice">Hovedmerke i utkastet<select aria-label="Hovedmerke i diplomutkast">${options.map(id=>`<option value="${esc(id)}">${esc(id==='thanks'?'Takk for innsatsen':MorothonBadges.get(id).name)}</option>`).join('')}</select></label>`:''}<p class="honor-draft-notice">Diplomutkast – ikke utdelt. Dato og signatur må godkjennes før eventuell utdeling.</p><div class="honor-diploma" data-preview-title="${esc(title)} – diplomutkast"></div><p class="honor-diploma-status" role="status" aria-live="polite"></p><div class="honor-print-controls"><button type="button" data-honor-print disabled>Skriv ut diplom</button><button type="button" data-honor-pdf disabled>Lagre som PDF</button></div><p class="honor-print-help">Utskriften merkes «UTKAST – IKKE UTDELT». A4 liggende · skala 100 % · ingen marger · bakgrunnsgrafikk på · topp- og bunntekst av. «Lagre som PDF» åpner utskriftsdialogen; velg «Lagre som PDF» som skriver.</p></details><details class="honor-image-quality"><summary>Bildekvalitet i utkastet</summary><div></div></details>`;}
  function wirePreview(container,loader,isCurrent=()=>true,eager=true){
   const details=container.querySelector('.diploma-example,.honor-example-preview'),viewport=details.querySelector('.honor-diploma');let frame,draft,render=0,disposed=false;
   const active=()=>!disposed&&isCurrent(),resize=()=>{if(active()&&frame)MorothonDiplomas.fitPreview(viewport,frame);},observer=new ResizeObserver(resize);observer.observe(viewport);
   function showQuality(){
    if(!active()||!draft||!frame?.contentDocument?.querySelector('.diploma-sheet'))return;
    const doc=frame.contentDocument,images=[...doc.querySelectorAll('img')];
    container.querySelector('.honor-image-quality div').innerHTML=[draft.asset,...draft.secondaryAssets||[]].map(a=>{
     const image=images.find(i=>i.src===a.src),box=image?.getBoundingClientRect(),style=image&&doc.defaultView.getComputedStyle(image);
     const factor=image?Math.min((box.width||parseFloat(style.width))/a.width,(box.height||parseFloat(style.height))/a.height):0;
     const vector=new URL(a.src,document.baseURI).pathname.endsWith('.svg');
     const measurement=factor>0?`${vector?'Skalerbar vektor ved':Math.floor(96/factor)+' DPI ved'} ${(a.width*factor*25.4/96).toFixed(1)} mm i dette A4-utkastet.`:'Mål kontrolleres når utkastet åpnes.';
     return `<p><b>${esc(MorothonBadges.get(a.key).name)}</b>: ${vector?'SVG · ingen fast original-DPI':a.width+' × '+a.height+' px'} · ${measurement} ${esc([...a.issues,...a.warnings||[]].join(' '))}</p>`;
    }).join('');
   }
   const buttons=[...details.querySelectorAll('[data-honor-print],[data-honor-pdf]')],message=details.querySelector('.honor-diploma-status');
   const disable=()=>buttons.forEach(b=>b.disabled=true);
   async function verify(){
    if(!active()||!draft||!frame?.contentDocument?.querySelector('.diploma-sheet'))return;
    const token=render,current=draft,doc=frame.contentDocument;disable();
    const result=await MorothonDiplomas.checkServiceDraft(current,doc);
    if(!active()||token!==render||current!==draft||doc!==frame.contentDocument)return;
    showQuality();message.textContent=result.ready?'A4-utkast kontrollert. UTKAST – IKKE UTDELT. Kan skrives ut eller lagres som PDF.':result.failures.join(' ');
    for(const button of buttons)button.disabled=!result.ready;
   }
   async function prepare(){
    const token=++render;disable();draft=null;message.textContent='Kontrollerer diplom og bildekvalitet …';
    try{
     const next=await loader(details.querySelector('select')?.value);if(!active()||token!==render)return;draft=next;
     if(!frame){frame=document.createElement('iframe');frame.title=viewport.dataset.previewTitle;frame.setAttribute('sandbox','allow-same-origin allow-modals');viewport.appendChild(frame);}
     frame.onload=async()=>{if(!active()||token!==render||frame.contentDocument?.title!==next.filename)return;await frame.contentDocument.fonts.ready;resize();showQuality();if(details.open)await verify();};
     frame.srcdoc=MorothonDiplomas.documentHtml(next);container.querySelector('.honor-image-quality div').textContent='Bildekvaliteten kontrolleres når forhåndsvisningen er klar.';
    }catch(e){if(active()&&token===render){disable();message.textContent='Diplomet kan ikke klargjøres: '+e.message;}}
   }
   for(const button of buttons)button.addEventListener('click',async()=>{
    if(!active()||!draft||button.disabled)return;const current=draft,token=render;disable();
    try{await MorothonDiplomas.printServiceDraft(current,frame);if(active()&&token===render)await verify();}
    catch(e){if(active()&&token===render)message.textContent=e.message;}
   });
   details.querySelector('select')?.addEventListener('change',prepare);details.addEventListener('toggle',()=>{resize();if(details.open){if(!draft)prepare();else verify();}});if(eager)prepare();return ()=>{disposed=true;render++;disable();observer.disconnect();};
  }
  let exampleCleanup=[];
  function clearExamples(){exampleCleanup.forEach(dispose=>dispose());exampleCleanup=[];$('#honorExamples').replaceChildren();}
  function renderExamples(){clearExamples();
  $('#honorExamples').innerHTML=(data.diplomaExamples||[]).map(e=>`<article class="honor-example" data-example="${esc(e.id)}"><h3>${esc(e.label)}</h3>${e.illustrative?`<p>Typeeksempel uten navngitt mottaker. ${e.badgeId==='thanks'?'Uten påstand om antall dugnadsutgaver.':e.contributionCount+' dokumenterte dugnadsutgaver må avklares for den som eventuelt skal få diplomet.'}</p>`:''}${previewMarkup([],e.illustrative?e.badgeId==='thanks'?'Vis takkediplomet':'Vis utkastet for '+e.contributionCount+' dugnadsutgaver':'Vis diplomutkastet','honor-example-preview')}</article>`).join('');
  for(const e of data.diplomaExamples||[])exampleCleanup.push(wirePreview(overview.querySelector(`[data-example="${e.id}"]`),()=>MorothonDiplomas.serviceExample(e.id),()=>true,false));
  }
  function racingHtml(member,group){
   if(!member.runnerId)return '';
   const s=linkedStats(member);if(!s)return '';
   const labels=distinctions(member,group,s),link=runnerLink(member),rows=s.sourcePodiums.slice().sort((a,b)=>a[0]-b[0]);
   return `<section class="honor-racing"><p class="eyebrow">DEN REGISTRERTE LØPERHISTORIEN</p><h3>Også på startstreken</h3><div class="honor-race-metrics"><div><b>${s.count}</b><span>registrerte løpsdeltakelser</span></div><div><b>${s.firstYear}–${s.lastYear}</b><span>første og siste registrerte løpsår</span></div></div><p class="racing-separation">Løpsdeltakelser er ikke antall år som frivillig. DNS teller ikke; DNF teller som deltakelse. Flere starter samme år teller én gang.</p>${labels.map(label=>`<p class="honor-distinction">${esc(label)}</p>`).join('')}<div class="honor-best-grid">${s.best.map(b=>`<article class="honor-best-result" data-distance="${b.km}" data-period="${b.period}"><span>${esc(b.eventLabel)} · ${esc(b.distance)}</span><strong>${esc(b.time)}</strong><small>${b.year} · ${b.period==='historical'?'historiske løyper før 2014':'løypeperioden fra 2014'}</small></article>`).join('')}</div><p class="racing-course-note">Beste registrerte tid vises separat for konkurranse, eksakt distanse og løypeperiode. Traseene har også variert innen periodene; tidene er ikke en påstand om identiske løyper.</p>${rows.length?`<h4>Plasseringer i kildelistene</h4><ul class="honor-podiums">${rows.map(r=>`<li><b>${MorothonHistoryData.sourcePlace(r)}. plass</b><span>${esc(MorothonHistoryData.eventLabel(r))} · ${esc(r[3])} · ${r[0]}</span><span>${esc(String(r[5]).replace(/^0:/,''))}</span></li>`).join('')}</ul><p class="muted">Vist fra resultatets registrerte kildeplassering, ikke en ny sammenligning av ulike løyper.</p>`:'<p class="muted">Ingen seire eller pallplasser er registrert i kildelistene for denne profilen.</p>'}<a class="runner-profile-link primary-runner-link" href="${esc(link)}">Åpne ${esc(member.name)} i Adelskalenderen →</a></section>`;
  }
  async function route(){
   const token=++sequence;cleanupProfile();status.textContent='';const inProfile=location.hash.startsWith('#person/');overview.hidden=inProfile;profile.hidden=!inProfile;$('#honorIntro').hidden=inProfile;
   if(!inProfile){renderExamples();document.title='Menneskene bak Morothon · forhåndsvisning';if(lastProfileId){const card=overview.querySelector(`[data-honoree="${lastProfileId}"]`);(card?.querySelector('a')||card)?.focus({preventScroll:true});}return;}
   clearExamples();
   let id;try{id=decodeURIComponent(location.hash.slice(8));}catch{id='';}
   const retired=data.retiredProfiles?.find(p=>p.id===id);if(retired){profile.innerHTML=`<a href="#oversikt">← Tilbake til oversikten</a><h2 id="profileName">${esc(retired.name)}</h2><p>Denne hedersoppføringen er korrigert. Du finner menneskene bak Morothon i oversikten.</p><details><summary>Bakgrunn og kilder</summary><p>${esc(retired.message)}</p>${sourceLinks(retired.sourceIds)}</details>`;profile.focus({preventScroll:true});return;}
   try{
    const {member,group,stories,roles}=await MorothonHonorsData.find(id);if(token!==sequence)return;lastProfileId=member.id;
    if(id!==member.id)historyReplace(member.id);
    if(member.listingOnly&&!mainFor(member).badgeId){
     const label=listingLabel(member);document.title=`${member.name} · Menneskene bak Morothon`;profile.className='honor-profile honor-volunteer-detail';
     profile.innerHTML=`<a href="#oversikt" class="back">← Tilbake til alle navn</a><h2 id="profileName">${esc(member.name)}</h2>${label?`<p class="profile-role">${esc(label)}</p>`:''}<section class="honor-person-diploma"><h3>En takk på papir</h3>${previewMarkup(['thanks'],'Vis takkediplom for '+member.name)}</section>`;
     cleanupProfile=wirePreview(profile,()=>MorothonDiplomas.serviceDraft(member.id),()=>token===sequence,false);
     profile.focus({preventScroll:true});profile.scrollIntoView({block:'start'});return;
    }
    const plan=planFor(member),service=MorothonHonorsData.contribution(member),main=mainFor(member),options=optionsFor(member);
    const seniority=MorothonHonorsData.tenureMilestones(data,member);
    const seniorityNote=seniority.highestQualified?`<p class="honor-tenure-note">Dugnadsmilepæl til vurdering: ${seniority.highestQualified.editions} utgaver. ${seniority.next?'Neste nivå er '+seniority.next.editions+' utgaver.':''} Ikke automatisk tildelt.</p>`:'';
    document.title=`${member.name} · Menneskene bak Morothon`;profile.className=`honor-profile${service.count===35?' honor-profile-lifelong':group.id==='founders'?' honor-profile-founder':''}${main.badgeId==='service-memorial'?' honor-profile-memorial':''}${member.listingOnly?' honor-volunteer-detail':''}`;
    profile.innerHTML=`<a href="#oversikt" class="back">← Tilbake til alle navn</a><div class="honor-profile-header${main.badgeId?'':' honor-profile-text-only'}"><div class="honor-profile-medals">${main.badgeId?badgeImg(main.badgeId,'profile-medal'):''}</div><div><p class="eyebrow">EN DEL AV MOROTHON-HISTORIEN</p><h2 id="profileName">${esc(member.name)}</h2><p class="profile-role">${esc(member.listingOnly?listingLabel(member):roleTitle(member))}</p>${service.count===35?`<p class="honor-tenure">35 utgaver · 1992–2026</p>`:''}<p>${esc(member.reason||'')}</p>${main.badgeId?`<p class="honor-main-caption">${esc(mainCaption(member,main))}</p><small class="honor-preview-marker">Hovedmerke i forhåndsvisningen · ikke tildelt</small>`:''}</div></div>${stories.length?`<section aria-labelledby="storiesTitle"><h3 id="storiesTitle">Historier og minner</h3>${stories.map(s=>`<article class="honor-story">${s.title?`<h4>${esc(s.title)}</h4>`:''}<p>${esc(s.text)}</p></article>`).join('')}</section>`:''}${racingHtml(member,group)}${seniorityNote}${plan.badgeIds.includes('service-aeresmerke')?'<p class="honor-historical-label">Historisk grunnlegger. Tidligere dugnadsmilepæler er dokumentert som tekst og i diplomvalgene.</p>':''}${options.length?`<section class="honor-person-diploma"><h3>${main.badgeId==='service-memorial'?'Et minne i takknemlighet':'En takk på papir'}</h3>${previewMarkup(options,'Vis diplomutkast for '+member.name)}</section>`:''}<details class="honor-person-sources"><summary>Bakgrunn og kilder</summary>${sourceLinks(member.sourceIds)}${(member.internalNotes||[]).map(n=>`<p>${esc(n)}</p>`).join('')}${roles.filter(r=>r.note).map(r=>`<p>${esc(r.note)}</p>`).join('')}</details>`;
    cleanupProfile=options.length?wirePreview(profile,badgeId=>MorothonDiplomas.serviceDraft(member.id,badgeId),()=>token===sequence):()=>{};
    profile.focus({preventScroll:true});profile.scrollIntoView({block:'start'});
   }catch(e){if(token===sequence){profile.innerHTML='<a href="#oversikt">← Tilbake til alle navn</a><h2 id="profileName">Hedersprofilen finnes ikke</h2>';showStatus(e);}}
  }
  function historyReplace(id){window.history.replaceState(null,'','#person/'+id);}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!profile.hidden){e.preventDefault();location.hash='oversikt';}});
  window.addEventListener('hashchange',route);await route();
 }catch(e){showStatus(e);}
})();
