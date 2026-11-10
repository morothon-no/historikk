/* Historical honor profiles, explicit runner links and preview-only certificates. */
window.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async function(){
 'use strict';
 let sequence=0,cleanupProfile=()=>{};
 const status=document.querySelector('#honorStatus'),overview=document.querySelector('#honorOverview'),profile=document.querySelector('#honorProfile');
 const showStatus=e=>{status.textContent=`Kunne ikke laste utkastet: ${e.message}`;};
 try{
  const data=await MorothonHonorsData.load();
  let history=null;try{history=await MorothonHistoryData.load();}catch(e){status.textContent='Løpsstatistikken er ikke tilgjengelig nå. De dokumenterte hedersprofilene kan fortsatt leses.';}
  const sourceLinks=(ids=[],fallback='')=>{
   const sources=ids.map(id=>data.sources?.[id]).filter(Boolean);
   return `<small class="honor-source">Kilde: ${sources.length?sources.map(s=>s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.title)}${s.date?' · '+esc(s.date.slice(0,4)):''}</a>`:esc(s.title)).join(' · '):esc(fallback||data.source)}</small>`;
  };
  const linkedStats=m=>m.runnerId&&history?history.stats(m.runnerId):null;
  const runnerLink=m=>{const s=linkedStats(m);return s?`index.html#lop=${encodeURIComponent(s.id)}`:null;};
  const confirmedRoles=m=>(m.roles||[]).filter(r=>r.confirmed&&(r.sourceIds?.length||r.source));
  const roleTitle=(member,group)=>confirmedRoles(member)[0]?.title||(group.badgeId?MorothonBadges.get(group.badgeId).name:group.title);
  const founders=data.groups.find(g=>g.id==='founders')?.members.filter(m=>m.status==='confirmed')||[];
  const founderStats=founders.map(m=>({member:m,stats:linkedStats(m)})).filter(x=>x.stats);
  const largestCount=founderStats.length===founders.length?Math.max(0,...founderStats.map(x=>x.stats.count)):0;
  const historic21=s=>s.best.find(b=>b.event==='Morothon'&&b.km===21&&b.period==='historical');
  const fastest21=Math.min(Infinity,...founderStats.map(x=>historic21(x.stats)).filter(Boolean).map(b=>MorothonHistoryData.timeSeconds(b.row[5])));
  function distinctions(member,group,s){
   if(!s||group.id!=='founders')return [];
   const labels=[];if(s.count===largestCount&&largestCount>0)labels.push('Flest løpsdeltakelser blant grunnleggerne');
   const best=historic21(s);if(best&&MorothonHistoryData.timeSeconds(best.row[5])===fastest21)labels.push('Raskeste grunnlegger – historisk 21 km');
   return labels;
  }
  const medal=(group,member,cls='')=>group.badgeId?`<img class="${cls}" src="${esc(MorothonBadges.source(group.badgeId))}" alt="${esc(MorothonBadges.get(group.badgeId).name)}${member.status==='provisional'?' – foreløpig merkeforslag':''}">`:`<img class="${cls} honor-role-symbol" src="${esc(MorothonBadges.registry().watermark.src)}" alt="Morothon-løperen – symbol for arrangørrollen">`;
  function awardStatus(member,group){return group.badgeId?`<p class="honor-award-status${member.status==='provisional'?' provisional':''}">${member.status==='provisional'?'Merkeforslag · ikke endelig tildelt':`Bekreftet ${esc(MorothonBadges.get(group.badgeId).name.toLocaleLowerCase('nb-NO'))}`}</p>`:'<p class="honor-award-status">Bekreftet arrangørrolle · ingen hedersmedalje tildelt</p>';}
  function card(member){
   const {group}=MorothonHonorsData.findIn(data,member.id),s=linkedStats(member),link=runnerLink(member),labels=distinctions(member,group,s);
   return `<li data-honoree="${esc(member.id)}" class="honor-person-card${group.id==='founders'?' founder-card':''}"><a class="honor-person-main" href="#person/${esc(member.id)}">${medal(group,member,'honor-card-medal')}<div><strong>${esc(member.name)}</strong><span class="honor-card-role">${esc(roleTitle(member,group))}</span><p>${esc(member.reason||'')}</p>${labels.map(label=>`<span class="honor-distinction">${esc(label)}</span>`).join('')}<span class="honor-open">Åpne hedersprofil →</span></div></a>${awardStatus(member,group)}${s?`<div class="honor-card-racing"><span><b>${s.count}</b> registrerte løpsdeltakelser</span><span>${s.firstYear}–${s.lastYear}</span></div>`:''}${link?`<a class="runner-profile-link" href="${esc(link)}">Se ordinær løperprofil →</a>`:''}</li>`;
  }
  document.querySelector('#honorHeading').textContent=data.narrative?.title||'Menneskene bak Morothon';document.querySelector('#honorLead').textContent=data.narrative?.lead||'';
  document.querySelector('#honorTimeline').innerHTML=(data.narrative?.timeline||[]).map(item=>`<article class="timeline-chapter"><div class="timeline-year">${esc(item.year)}</div><div><h2>${esc(item.title)}</h2><p>${esc(item.text)}</p>${sourceLinks(item.sourceIds)}</div></article>`).join('');
  const ordered=(data.displayOrder||data.groups.map(g=>g.id)).map(id=>data.groups.find(g=>g.id===id)).filter(Boolean);
  document.querySelector('#honorPeople').innerHTML=ordered.map(group=>`<section class="honor-group" id="${esc(group.id)}" data-honor-group="${esc(group.id)}"><p class="eyebrow">${group.id==='founders'?'OPPSTARTEN · 1992':group.id==='organizers'?'ET NYTT KAPITTEL · 2014':'FRIVILLIGHETEN'}</p><h3>${esc(group.title)}</h3><p>${esc(group.description||'')}</p>${group.sourceIds?sourceLinks(group.sourceIds):''}<ul class="honor-names">${MorothonHonorsData.membersFor(data,group).map(card).join('')}</ul></section>`).join('');
  const shared=(data.narrative?.sharedStories||[]).filter(s=>s.confirmed&&s.source?.trim());document.querySelector('#honorSharedStories').innerHTML=shared.length?`<h2>Historiene rundt løpet</h2><div class="honor-story-grid">${shared.map(s=>`<article class="honor-story"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${sourceLinks(s.sourceIds,s.source)}</article>`).join('')}</div>`:'';
  document.querySelector('#honorClosing').textContent=data.narrative?.closing||'';
  document.querySelector('#serviceBadges').innerHTML=MorothonBadges.list('service').filter(b=>b.displayOnHonorPage!==false).map(b=>`<article style="--metal:${b.color}"><img src="${esc(MorothonBadges.source(b.id))}" alt="${esc(b.name)} – merkeutkast"><h3>${esc(b.name)}</h3><p>Felles hedersmerke · diplomene er kun forhåndsvisninger</p></article>`).join('');
  const registered1992=history?.data.yearStats.find(s=>s[0]===1992)?.[2];
  document.querySelector('#honorSourceContent').innerHTML=`<ul>${Object.entries(data.sources||{}).map(([id,s])=>`<li><b>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title)}</b><span>${esc([s.publisher,s.author,s.date].filter(Boolean).join(' · '))}</span><small>${esc(s.basis||'')}</small></li>`).join('')}</ul>${(data.narrative?.uncertainties||[]).map(item=>`<p>${esc(item.text)}</p>`).join('')}${registered1992!==undefined?`<p class="archive-count-note">Beregnet fra dagens resultatarkiv: ${registered1992} registrerte deltakere i 1992.</p>`:''}`;
  function racingHtml(member,group){
   if(!member.runnerId)return '<section class="honor-racing"><h3>Løpshistorikk</h3><p>Ingen sikker løper-ID er registrert. Hedersrollen vises uten løpsstatistikk.</p></section>';
   const s=linkedStats(member);if(!s)return '<section class="honor-racing"><h3>Løpshistorikk</h3><p>Den eksplisitte koblingen til løpshistorikken er ikke tilgjengelig nå. Ingen løpsstatistikk vises.</p></section>';
   const labels=distinctions(member,group,s),link=runnerLink(member),rows=s.sourcePodiums.slice().sort((a,b)=>a[0]-b[0]);
   return `<section class="honor-racing"><p class="eyebrow">DEN REGISTRERTE LØPERHISTORIEN</p><h3>Også på startstreken</h3><div class="honor-race-metrics"><div><b>${s.count}</b><span>registrerte løpsdeltakelser</span></div><div><b>${s.firstYear}–${s.lastYear}</b><span>første og siste registrerte løpsår</span></div></div><p class="racing-separation">Løpsdeltakelser er ikke antall år som frivillig. DNS teller ikke; DNF teller som deltakelse. Flere starter samme år teller én gang.</p>${labels.map(label=>`<p class="honor-distinction">${esc(label)}</p>`).join('')}<div class="honor-best-grid">${s.best.map(b=>`<article class="honor-best-result" data-distance="${b.km}" data-period="${b.period}"><span>${esc(b.eventLabel)} · ${esc(b.distance)}</span><strong>${esc(b.time)}</strong><small>${b.year} · ${b.period==='historical'?'historiske løyper før 2014':'løypeperioden fra 2014'}</small></article>`).join('')}</div><p class="racing-course-note">Beste registrerte tid vises separat for konkurranse, eksakt distanse og løypeperiode. Traseene har også variert innen periodene; tidene er ikke en påstand om identiske løyper.</p>${rows.length?`<h4>Plasseringer i kildelistene</h4><ul class="honor-podiums">${rows.map(r=>`<li><b>${MorothonHistoryData.sourcePlace(r)}. plass</b><span>${esc(MorothonHistoryData.eventLabel(r))} · ${esc(r[3])} · ${r[0]}</span><span>${esc(String(r[5]).replace(/^0:/,''))}</span></li>`).join('')}</ul><p class="muted">Vist fra resultatets registrerte kildeplassering, ikke en ny sammenligning av ulike løyper.</p>`:'<p class="muted">Ingen seire eller pallplasser er registrert i kildelistene for denne profilen.</p>'}<a class="runner-profile-link primary-runner-link" href="${esc(link)}">Åpne ${esc(member.name)} i Adelskalenderen →</a></section>`;
  }
  async function route(){
   const token=++sequence;cleanupProfile();status.textContent='';
   if(!location.hash.startsWith('#person/')){overview.hidden=false;profile.hidden=true;document.title='Menneskene bak Morothon';return;}
   let id;try{id=decodeURIComponent(location.hash.slice(8));}catch{id='';}overview.hidden=true;profile.hidden=false;
   const retired=(data.retiredProfiles||[]).find(p=>p.id===id);
   if(retired){profile.className='honor-profile';profile.innerHTML=`<a href="#oversikt">← Tilbake til oversikten</a><h2 id="profileName">${esc(retired.name)}</h2><p>${esc(retired.message)}</p>${sourceLinks(retired.sourceIds)}`;profile.focus({preventScroll:true});return;}
   try{
    const {member,group,stories,roles}=await MorothonHonorsData.find(id);if(token!==sequence)return;
    const badge=group.badgeId?MorothonBadges.get(group.badgeId):null;
    document.title=`${member.name} · Menneskene bak Morothon`;profile.className=group.id==='founders'?'honor-profile honor-profile-founder':'honor-profile';
    profile.innerHTML=`<a href="#oversikt" class="back">← Tilbake til alle navn</a><div class="honor-profile-header">${medal(group,member,'profile-medal')}<div><p class="eyebrow">${roles.length||member.status==='confirmed'?'BEKREFTET HISTORISK ROLLE':'FORELØPIG OPPFØRING'}</p><h2 id="profileName">${esc(member.name)}</h2><p class="profile-role">${esc(roleTitle(member,group))}</p><p>${esc(member.reason||'')}</p>${awardStatus(member,group)}${sourceLinks(member.sourceIds,member.roleSource||data.source)}</div></div>${roles.some(r=>r.note)?`<div class="honor-role-notes">${roles.filter(r=>r.note).map(r=>`<p>${esc(r.note)}</p>`).join('')}</div>`:''}<section aria-labelledby="storiesTitle"><h3 id="storiesTitle">Dokumenterte historier</h3>${stories.length?stories.map(s=>`<article class="honor-story">${s.title?`<h4>${esc(s.title)}</h4>`:''}<p>${esc(s.text)}</p>${sourceLinks(s.sourceIds,s.source)}</article>`).join(''):'<p>Ingen dokumentert historie er lagt til ennå.</p>'}</section>${racingHtml(member,group)}${badge?`<section aria-labelledby="honorDiplomaTitle"><h3 id="honorDiplomaTitle">Diplomforhåndsvisning</h3><p>${member.status==='provisional'?'Arrangørrollen er bekreftet. Merkeforslaget er fortsatt foreløpig og er ingen endelig tildeling.':'Personlig hedersdiplom som designforhåndsvisning; ikke et utstedt diplom.'}</p><details class="diploma-example"><summary>Vis ${group.id==='founders'?'grunnleggerdiplom':'dugnadsdiplom'} for ${esc(member.name)}</summary><label class="honor-choice">Diplomtype<select aria-label="Diplomtype"><option value="${esc(group.badgeId)}">${esc(badge.name)}${member.status==='provisional'?' – foreløpig':''}</option></select></label><p class="honor-draft-notice">Forhåndsvisning · diplomutkast, ikke utstedt. Utskrift og PDF er ikke tilgjengelig fra denne siden.</p><div class="honor-diploma"><iframe title="${esc(member.name)} – diplomutkast" sandbox="allow-same-origin"></iframe></div><p class="honor-diploma-status" role="status">Kontrollerer forhåndsvisningen …</p></details></section>`:'<p class="honor-no-award">Arrangørrollen er dokumentert. Det er ikke registrert noen hedersmedalje eller noe diplomvalg.</p>'}`;
    if(badge)await prepareDiploma(member,token);
    if(token!==sequence)return;profile.focus({preventScroll:true});profile.scrollIntoView({block:'start'});
   }catch(e){if(token!==sequence)return;profile.innerHTML='<a href="#oversikt">← Tilbake til alle navn</a><h2 id="profileName">Hedersprofilen finnes ikke</h2>';showStatus(e);}
  }
  async function prepareDiploma(member,token){
   const diploma=await MorothonDiplomas.serviceDraft(member.id);if(token!==sequence)return;
   const frame=profile.querySelector('iframe'),viewport=profile.querySelector('.honor-diploma'),details=profile.querySelector('.diploma-example');
   const resize=()=>{const scale=Math.min(1,viewport.clientWidth/(297*96/25.4));frame.style.transform=`scale(${scale})`;viewport.style.height=`${210*96/25.4*scale}px`;};
   const observer=new ResizeObserver(resize);observer.observe(viewport);cleanupProfile=()=>observer.disconnect();
   async function verify(){try{if(!frame.contentDocument?.querySelector('.diploma-sheet'))return;const layout=await MorothonDiplomas.checkLayout(frame.contentDocument);if(token!==sequence)return;profile.querySelector('.honor-diploma-status').textContent=layout.ready?'A4-utkast kontrollert. Kun forhåndsvisning – ikke utstedt. Utskrift er sperret.':layout.failures.join(' ');}catch(e){if(token===sequence)showStatus(e);}}
   frame.onload=async()=>{if(frame.contentDocument?.title!==diploma.filename||token!==sequence)return;await frame.contentDocument.fonts.ready;resize();if(details.open)await verify();};frame.srcdoc=MorothonDiplomas.documentHtml(diploma);details.addEventListener('toggle',()=>{resize();if(details.open)verify();});resize();
  }
  window.addEventListener('hashchange',route);await route();
 }catch(e){showStatus(e);}
})();
