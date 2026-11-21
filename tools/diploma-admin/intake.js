/* Entire start-list session is in browser memory. No upload/API/storage endpoint. */
(() => {
 'use strict';
 const I=window.MorothonIntake,host=document.getElementById('view-import');if(!host)return;
 const root=window.MorothonAdminTransport?.rootUrl||new URL('/site/',location.href);
 const state={context:null,staged:null,analysis:null,previous:null,decisions:new Map(),distanceMap:Object.create(null),meta:null,tab:'start',page:0,rowDistances:new Map(),distanceUndo:[],distanceSelection:new Set(),distancePage:0,distanceQuery:'',distanceFilter:'missing',distancePreview:null};
 const labels={confirmed:'Bekreftet match',proposed:'Foreslått match',unknown:'Ukjent person',conflict:'Konflikt',new:'Bekreftet ny person',deferred:'Utsatt',team:'Stafettlag'};
 const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function button(text,fn,cls='secondary'){const b=node('button',text,cls);b.type='button';b.onclick=()=>Promise.resolve().then(fn).catch(error);return b;}
 function info(text){return node('p',text,'hint');}
 function error(e){$('intakeStatus').textContent=e.message||String(e);$('intakeStatus').dataset.error='true';}
 function status(text){$('intakeStatus').textContent=text;delete $('intakeStatus').dataset.error;}
 function field(title,input){const label=node('label',title);label.append(input);return label;}
 function save(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 function mapping(){return Object.fromEntries(Object.keys(I.fields).map(k=>[k,+$('intake-map-'+k).value]));}
 function year(){const y=+$('intakeYear').value;if(!Number.isInteger(y)||y<1900||y>9999)throw Error('Velg et gyldig arrangementsår.');return y;}
 function analyze(isNew=false){
  if(!state.staged)return;const selectedYear=year(),rows=I.rows(state.staged,mapping(),selectedYear);
  if(isNew||state.pendingImport){state.previous=state.analysis||state.previous;state.decisions=state.previous?I.carryDecisions(state.previous,rows,selectedYear):new Map();state.rowDistances=state.previous?I.carryDistances(state.previous,rows,state.rowDistances,selectedYear):new Map();state.distanceUndo=[];state.distanceSelection.clear();state.distancePreview=null;state.distancePage=0;state.pendingImport=false;state.page=0;}
  state.analysis=I.analyze(state.context,rows,{year:selectedYear,decisions:state.decisions,distanceMap:state.distanceMap,rowDistances:state.rowDistances,meta:state.meta,previous:state.previous});document.dispatchEvent(new CustomEvent('morothon:intake-analysis',{detail:state.analysis}));render();status('Startlisten er analysert. Kontroller personforslag og forbehold før prognosen brukes.');
 }
 async function loadFile(file){
  if(file.size>I.MAX_BYTES)throw Error('Filen kan være maksimalt 4 MB. Eksporter CSV eller XML fra EQ Timing.');
  if(!/\.(csv|tsv|xml|txt)$/i.test(file.name))throw Error('Velg CSV eller XML. XLSX støttes ikke; eksporter som CSV først.');
  const bytes=new Uint8Array(await file.arrayBuffer()),decoded=I.decode(bytes),staged=I.parse(decoded.text,{parseDocument:t=>new DOMParser().parseFromString(t,'application/xml')});
  state.staged=staged;state.pendingImport=true;state.meta={schemaVersion:1,profileId:state.context.profileId,manifestSha256:state.context.manifestSha256,sourceSha256:await sha(bytes),historySha256:state.context.historySha256,registrySha256:state.context.registrySha256,format:staged.format,source:staged.source,encoding:decoded.encoding,importedAt:new Date().toISOString(),completeSnapshot:$('intakeComplete').checked};
  $('intakeFileInfo').textContent=staged.records.length+' rader · '+(staged.source?'Emit XML · '+staged.source.provider+' '+staged.source.version+(staged.source.changedAt?' · endret '+staged.source.changedAt:''):staged.format)+' · '+decoded.encoding+'. Originalfilen finnes bare i denne fanens minne.'+(staged.source?' Velg riktig arrangementsår; kildens endringstidspunkt er ikke løpsdato.':'');state.distanceMap=Object.create(null);renderMapping();
  try{analyze(true);}catch(e){state.previous=state.analysis||state.previous;state.analysis=null;state.decisions.clear();render();error(e);}
 }
 function renderMapping(){const box=$('intakeMapping');box.replaceChildren();for(const [key,label]of Object.entries(I.fields)){const select=node('select');select.id='intake-map-'+key;const none=node('option','Ikke brukt');none.value=-1;select.append(none);state.staged.headers.forEach((h,i)=>{const o=node('option',(i+1)+': '+h);o.value=i;select.append(o);});select.value=state.staged.mapping[key];box.append(field(label,select));} $('intakeMappingDetails').hidden=false;$('intakeAnalyze').disabled=false;}
 function choose(row,action,runnerId){state.decisions.set(row.decisionKey,{action,...(runnerId?{runnerId}:{}),confirmedAt:new Date().toISOString(),sourceSha256:state.meta.sourceSha256});analyze();}
 function switchTab(tab){state.tab=tab;for(const n of host.querySelectorAll('[data-intake-view]'))n.hidden=n.dataset.intakeView!==tab;for(const b of host.querySelectorAll('[data-intake-tab]'))b.setAttribute('aria-pressed',String(b.dataset.intakeTab===tab));host.querySelector('.intake-filters').hidden=!['forecast','orders'].includes(tab);}
 function table(headers,rows){const wrap=node('div',undefined,'intake-table-wrap'),t=node('table'),head=node('thead'),tr=node('tr');headers.forEach(h=>tr.append(node('th',h)));head.append(tr);const body=node('tbody');for(const cells of rows){const row=node('tr');cells.forEach(v=>{const cell=node('td');if(v instanceof Node)cell.append(v);else cell.textContent=v??'';row.append(cell);});body.append(row);}t.append(head,body);wrap.append(t);return wrap;}
 function filtered(){const a=state.analysis;if(!a)return null;const badge=$('intakeBadgeFilter').value,distance=$('intakeDistanceFilter').value,forecast=a.forecast.filter(f=>(badge==='all'||f.badgeId===badge)&&(distance==='all'||f.distances.includes(distance)));
  return {...a,forecast,viewFilters:{badge,distance},orders:a.orders.map(o=>{const recipients=forecast.filter(f=>f.badgeId===o.badgeId);return {...o,recipients,confirmed:recipients.filter(f=>f.confirmed).length,uncertain:recipients.filter(f=>!f.confirmed).length,prepareMax:recipients.length};}).filter(o=>o.prepareMax)};
 }
 function renderForecasts(){const a=filtered(),box=$('intakeForecast'),orders=$('intakeOrders');box.replaceChildren();orders.replaceChildren();if(!a)return;
  box.append(info('Alle prognoser forutsetter at årets deltakelse faktisk blir tellende. Identitetsforslag er ikke tildelinger.'));
  box.append(table(['Mulig mottaker','Historikk → mulig','Merke','Identitet','Grunnlag'],a.forecast.map(f=>[f.name,f.historicalCount+' → '+f.possibleCount,f.badgeName,f.confirmed?'Bekreftet identitet':'USIKKER',f.reason+' '+f.caveats.join(' ')])));
  if(!a.forecast.length)box.append(info('Ingen nye merker i dette utvalget. En startliste kan også bestå av personer som ikke passerer en terskel.'));
  orders.append(info('Klargjøringsbehovet er et øvre anslag per merke blant vurderte kandidater. Ukjente personer, uavklarte distanser eller sperrede rader kan øke behovet. Tvetydige identiteter kan være alternativer for ulike merker; ikke summer ukritisk. Ingen bestilling eller utdeling utføres.'));
  for(const o of a.orders){const card=node('section',undefined,'intake-order-card'),head=node('div',undefined,'section-heading');head.append(node('h3',o.badgeName),node('strong',o.prepareMax+' mulig'));const details=node('details');details.append(node('summary','Se mulige mottakere ('+o.prepareMax+')'),table(['Navn','Identitet','Distanser'],o.recipients.map(f=>[f.name,f.confirmed?'Bekreftet':'Usikker',f.distances.join(' / ')])));card.append(head,info(o.confirmed+' bekreftede identiteter · '+o.uncertain+' usikre muligheter'),details);orders.append(card);}
  if(!a.orders.length)orders.append(info('Ingen merker å klargjøre i dette utvalget.'));
 }
 function candidateCard(row,p){const card=node('article',undefined,'intake-candidate');card.append(node('h4',p.name),info(p.id+' · '+p.reason));const before=p.years.filter(y=>y<=state.analysis.year);card.append(node('p',before.length+' tellende år · '+(before.length?before[0]+'–'+before.at(-1):'Ingen tellende år')));const recent=node('details');recent.append(node('summary','Siste registrerte løp'));for(const r of state.context.model.resultsFor(p.id).filter(r=>r[0]<=state.analysis.year).slice().sort((a,b)=>b[0]-a[0]).slice(0,3))recent.append(info(r[0]+' · '+state.context.rules.eventLabel(r)+' '+r[3]+' · '+(r[8]||'Klubb ikke oppgitt')+' · '+state.context.rules.effectiveStatus(r)));card.append(recent);const link=node('a','Se løperhistorikk');link.href=new URL('index.html#lop='+encodeURIComponent(p.id),root).href;link.target='_blank';link.rel='noopener';card.append(link,button('Bekreft samme person',()=>choose(row,'confirm',p.id)));return card;}
 function renderReview(){const box=$('intakeReview');box.replaceChildren();if(!state.analysis)return;const query=I.fold($('intakeSearch').value),statusFilter=$('intakeMatchFilter').value;
  const rows=state.analysis.rows.filter(r=>(statusFilter==='all'||r.match.status===statusFilter)&&(I.fold(r.name+' '+r.bib).includes(query))),pageSize=20;state.page=Math.min(state.page,Math.max(0,Math.ceil(rows.length/pageSize)-1));const start=state.page*pageSize;
  box.append(info(rows.length+' treff. Personvalg gjelder bare denne arbeidsøkten. Fødselsår blir ikke lagt i rapportene.'));
  for(const row of rows.slice(start,start+pageSize)){
   const card=node('article',undefined,'intake-review-row'),head=node('div',undefined,'section-heading');head.append(node('h3',row.name||'Navn mangler'),node('span',labels[row.match.status],'intake-pill '+row.match.status));card.append(head,info('Rad '+row.line+' · startnr. '+(row.bib||'ikke oppgitt')+' · '+row.event+' · '+row.className+' · '+row.club),node('p',row.match.reason));
   for(const e of row.errors)card.append(node('p','Avvist: '+e,'intake-error'));if(row.warnings.length){const notes=node('details');notes.append(node('summary','Forbehold ('+row.warnings.length+')'),...row.warnings.map(w=>info(w)));card.append(notes);}
   if(row.match.status!=='team'&&!row.errors.length){const candidates=node('div',undefined,'intake-candidates');for(const p of row.match.candidates)candidates.append(candidateCard(row,p));card.append(candidates);if(row.match.forecastBlocked)card.append(info('Flere kandidater finnes. Bruk søket under for å velge riktig person; denne raden er foreløpig utelatt fra merkeprognosen.'));
    const actions=node('div',undefined,'actions');actions.append(button('Dette er forskjellige personer',()=>choose(row,'different')),button('Marker som ny deltaker',()=>choose(row,'new')),button('Utsett avgjørelse',()=>choose(row,'defer')));card.append(actions);
    const details=node('details');details.append(node('summary','Velg en annen eksisterende profil'));const search=node('input');search.type='search';search.placeholder='Søk i godkjente navn og aliaser';search.setAttribute('aria-label','Finn eksisterende profil for rad '+row.line);const results=node('div');search.oninput=()=>{const q=I.fold(search.value);results.replaceChildren();if(q.length<2)return;for(const p of [...state.context.people.values()].filter(p=>p.names.some(n=>I.fold(n.name).includes(q))).slice(0,10))results.append(candidateCard(row,{...p,reason:'Manuelt valgt profil – kontroller identiteten.'}));};details.append(search,results);card.append(details);
   }box.append(card);
  }
  const pagination=node('div',undefined,'actions'),prev=button('Forrige',()=>{state.page--;renderReview();}),next=button('Neste',()=>{state.page++;renderReview();});prev.disabled=state.page===0;next.disabled=start+pageSize>=rows.length;pagination.append(prev,info((rows.length?start+1:0)+'–'+Math.min(start+pageSize,rows.length)+' av '+rows.length),next);box.append(pagination);
 }
 function renderDistanceRows(){
  const box=$('intakeDistanceRows');box.replaceChildren();const a=state.analysis;if(!a)return;
  const missing=a.rows.filter(r=>!r.race).length,relays=a.rows.filter(r=>r.race?.relay).length;
  box.append(node('h3','Velg distanser'),info(missing+' mangler distanse · '+relays+' stafettoppføringer. Ingen distanse utledes fra klasse, startnummer eller starttid.'));
  const controls=node('div',undefined,'intake-distance-controls'),search=node('input');search.type='search';search.value=state.distanceQuery;search.placeholder='Søk i navn, startnummer, klasse eller klubb';search.id='intakeDistanceSearch';
  // Keep typing focus: replace the panel only after a deliberate search action.
  const filter=node('select');filter.id='intakeDistanceState';for(const [v,text]of [['missing','Mangler distanse'],['individual','Individuelle oppføringer'],['relay','Stafett'],['all','Alle oppføringer']]){const o=node('option',text);o.value=v;filter.append(o);}filter.value=state.distanceFilter;
  const refresh=()=>{state.distanceQuery=search.value;state.distanceFilter=filter.value;state.distancePage=0;state.distancePreview=null;renderDistanceRows();};filter.onchange=refresh;search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();refresh();}};
  controls.append(field('Finn deltakere',search),field('Vis',filter),button('Søk i listen',refresh));box.append(controls);
  const q=I.fold(state.distanceQuery),rows=a.rows.filter(r=>(state.distanceFilter==='all'||state.distanceFilter==='missing'&&!r.race||state.distanceFilter==='relay'&&r.race?.relay||state.distanceFilter==='individual'&&!r.race?.relay)&&I.fold([r.name,r.bib,r.className,r.club].join(' ')).includes(q));
  const selectAll=button('Marker alle treff ('+rows.filter(r=>r.entryKind!=='relay').length+')',()=>{for(const r of rows)if(r.entryKind!=='relay')state.distanceSelection.add(r.id);state.distancePreview=null;renderDistanceRows();});selectAll.id='intakeDistanceSelectAll';
  const clear=button('Fjern markering',()=>{state.distanceSelection.clear();state.distancePreview=null;renderDistanceRows();});
  const selected=a.rows.filter(r=>state.distanceSelection.has(r.id)),select=node('select');select.id='intakeDistanceChoice';const none=node('option','Velg godkjent distanse');none.value='';select.append(none);
  for(const c of [...state.context.competitions,{id:'relay',label:'Stafett – separat fra individuelle løp'}]){const o=node('option',c.label);o.value=c.id;select.append(o);}
  const preview=button('Forhåndsvis distansevalg',()=>{if(!select.value)throw Error('Velg en godkjent distanse.');const next=I.assignDistances(state.context,a.rows,state.rowDistances,state.distanceSelection,select.value);state.distancePreview={next,ids:[...state.distanceSelection],label:select.selectedOptions[0].textContent};renderDistanceRows();});preview.id='intakeDistancePreview';preview.disabled=!selected.length;
  const undo=button('Angre siste distansevalg',()=>{if(state.distanceUndo.length){state.rowDistances=state.distanceUndo.pop();state.distancePreview=null;analyze();}});undo.id='intakeDistanceUndo';undo.disabled=!state.distanceUndo.length;
  const actions=node('div',undefined,'actions');actions.append(selectAll,clear,info(selected.length+' markerte deltakere'),field('Tilordne til markerte',select),preview,undo);box.append(actions);
  if(state.distancePreview){const pending=state.distancePreview,confirm=node('div',undefined,'intake-distance-confirm');confirm.id='intakeDistanceConfirmation';confirm.append(node('strong',pending.ids.length+' deltakere → '+pending.label),info('Gjelder bare markerte rader. Kontroller navnene før du bruker valget.'),info(a.rows.filter(r=>pending.ids.includes(r.id)).slice(0,12).map(r=>r.name+' (#'+r.bib+')').join(' · ')+(pending.ids.length>12?' · og '+(pending.ids.length-12)+' flere':'')),button('Bruk distansevalget',()=>{state.distanceUndo.push(new Map(state.rowDistances));state.rowDistances=pending.next;state.distanceSelection.clear();state.distancePreview=null;analyze();}),button('Avbryt',()=>{state.distancePreview=null;renderDistanceRows();}));box.append(confirm);}
  const size=50;state.distancePage=Math.min(state.distancePage,Math.max(0,Math.ceil(rows.length/size)-1));const offset=state.distancePage*size;
  box.append(table(['Velg','Navn / startnr.','Klasse / klubb','Starttid / nasjon','Distanse'],rows.slice(offset,offset+size).map(r=>{const check=node('input');check.type='checkbox';check.checked=state.distanceSelection.has(r.id);check.disabled=r.entryKind==='relay';check.setAttribute('aria-label','Marker rad '+r.line+' '+r.name);check.onchange=()=>{if(check.checked)state.distanceSelection.add(r.id);else state.distanceSelection.delete(r.id);state.distancePreview=null;renderDistanceRows();};return [check,r.name+' · '+(r.bib||'–'),r.className+' · '+r.club,[r.startTime,r.nation].filter(Boolean).join(' · '),r.race?.label||'Må velges'];})));
  const paging=node('div',undefined,'actions'),prev=button('Forrige 50',()=>{state.distancePage--;renderDistanceRows();}),next=button('Neste 50',()=>{state.distancePage++;renderDistanceRows();});prev.disabled=!state.distancePage;next.disabled=offset+size>=rows.length;paging.append(prev,info((rows.length?offset+1:0)+'–'+Math.min(offset+size,rows.length)+' av '+rows.length),next);box.append(paging);
 }
 function render(){
  const a=state.analysis;$('intakeSummary').replaceChildren();$('intakePreview').replaceChildren();$('intakeDiff').replaceChildren();$('intakeDistanceMap').replaceChildren();
  for(const b of host.querySelectorAll('[data-intake-report]'))b.disabled=!a;
  $('intakeBatchConfirm').disabled=!a||!a.rows.some(r=>!r.errors.length&&r.match.status==='proposed'&&r.match.candidates.length===1&&['Registrert navn','Godkjent historisk alias','Navn fra sammenslått person-ID','Bekreftet historisk løperkobling'].includes(r.match.candidates[0].reason));
  if(!a){$('intakeDistanceRows').replaceChildren();renderReview();renderForecasts();return;}
  for(const [label,value]of [['Innlesinger',a.summary.rows],['Godkjent grunnlag',a.summary.approved],['Må kontrolleres',a.summary.uncertain],['Duplikatrader',a.summary.duplicates],['Avviste rader',a.summary.rejected]]){const n=node('article');n.append(node('strong',String(value)),node('span',label));$('intakeSummary').append(n);}
  $('intakeProgress').textContent='1. Startliste lest · 2. '+a.summary.uncertain+' identiteter/distanser til kontroll · 3. '+a.forecast.length+' mulige merkevurderinger · Ingen resultater, merker eller koblinger er lagret.';
  if(state.staged.format!=='emit-startliste-1.0') $('intakePreview').append(table(['Rad','Navn','Startnr.','Distanse','Personstatus','Feil'],a.rows.slice(0,50).map(r=>[r.line,r.name,r.bib,r.race?.label||r.event||'Velg distanse',labels[r.match.status],r.errors.join(' ')])),info('Viser de første 50 radene. Full oversikt finnes i CSV-rapporten og Personkontroll.'));
  for(const raw of new Set(a.rows.filter(r=>!r.race&&r.event).map(r=>r.event))){const select=node('select'),none=node('option','Velg riktig, godkjent øvelse');none.value='';select.append(none);for(const c of state.context.competitions){const o=node('option',c.label);o.value=c.id;select.append(o);}select.onchange=()=>{if(select.value)state.distanceMap[raw]=select.value;else delete state.distanceMap[raw];analyze();};$('intakeDistanceMap').append(field('Ukjent distanse: '+(raw||'(tomt felt)'),select));}
  if(a.comparison){const d=a.comparison;$('intakeDiff').append(node('h3','Endringer siden forrige fil'),node('p',d.added+' nye · '+d.changed+' endrede · '+d.missing+' ikke med i denne fila · '+d.unchanged+' uendrede. Endret prognose: '+(d.forecastDelta>=0?'+':'')+d.forecastDelta+' vurderinger.'),info('Manglende oppføring betyr ikke automatisk avmelding. '+(state.meta.completeSnapshot?'Du har angitt komplett eksport; fravær må fortsatt kontrolleres.':'Eksporten er ikke bekreftet komplett. Ingen avmelding er utledet.')));const detail=node('details');detail.append(node('summary','Se endrede/nye/manglende oppføringer'),...d.links.filter(l=>!l.unchanged).slice(0,30).map(l=>info('Endret: '+l.before.name+' → '+l.after.name)),...(d.addedRows||[]).slice(0,30).map(r=>info('Ny i fila: '+r.name)),...(d.missingRows||[]).slice(0,30).map(r=>info('Ikke med: '+r.name+' (ikke en registrert avmelding)')));$('intakeDiff').append(detail);}
  const badge=$('intakeBadgeFilter').value,distance=$('intakeDistanceFilter').value;for(const [select,values]of [[$('intakeBadgeFilter'),state.context.levels.map(b=>[b.id,b.name])],[$('intakeDistanceFilter'),state.context.competitions.map(c=>[c.label,c.label])]]){select.replaceChildren();for(const [v,label]of [['all','Alle'],...values]){const o=node('option',label);o.value=v;select.append(o);}}$('intakeBadgeFilter').value=badge||'all';$('intakeDistanceFilter').value=distance||'all';renderDistanceRows();renderReview();renderForecasts();
 }
 async function init(){
  if(document.body.dataset.adminMode==='public-preview'&&!window.MorothonAdminTransport)throw Error('Nettadapteren mangler. Last siden på nytt.');
  if(window.MorothonAdminTransport)await MorothonAdminTransport.ready;
  if(!window.MorothonHistoryData)await new Promise((resolve,reject)=>{const script=node('script');script.src=new URL('js/history-data.js',root);script.onload=resolve;script.onerror=()=>reject(Error('Historikkreglene kunne ikke lastes.'));document.head.append(script);});
  const fetchJson=async file=>{const url=file==='admin/event-profile.json'&&document.body.dataset.adminMode!=='local'&&window.MorothonAdminTransport?new URL('event-profile.json',new URL('./',document.baseURI)):new URL(file,root);const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(file==='admin/event-profile.json'?'Kunne ikke lese arrangementsprofilen.':'Kunne ikke lese offentlig grunnlag.');return r.json();};
  const manifestResponse=await fetch(new URL('public-manifest.json',root),{cache:'no-store'});if(!manifestResponse.ok)throw Error('Datamanifestet mangler.');const manifestBytes=await manifestResponse.arrayBuffer(),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));const load=async name=>{const key='data/'+name+'.json',r=await fetch(new URL(key,root));if(!r.ok)throw Error('Offentlige data mangler.');const bytes=await r.arrayBuffer();if(manifest.files[key].sha256!==await sha(bytes)||manifest.files[key].bytes!==bytes.byteLength)throw Error('Data er oppdatert eller endret. Last portalen på nytt.');return JSON.parse(new TextDecoder().decode(bytes));};
  const [history,registry,profile,honors,volunteers]=await Promise.all([load('history'),load('badges'),fetchJson('admin/event-profile.json'),load('honors'),load('volunteers')]);state.context=I.createContext({history,registry,profile,honors,volunteers});Object.assign(state.context,{manifestSha256:await sha(manifestBytes),historySha256:manifest.historySha256,registrySha256:manifest.files['data/badges.json'].sha256});
  document.dispatchEvent(new CustomEvent('morothon:corrections-ready',{detail:{history,registry,profile,context:state.context,root,meta:{dataVersion:manifest.dataVersion,manifestSha256:state.context.manifestSha256,historySha256:manifest.historySha256},linkedRunnerIds:[...(honors.groups||[]).flatMap(g=>g.members).map(m=>honors.personDetails?.[m.id]?.runnerLink?.runnerId||m.runnerId),...(volunteers.people||[]).map(m=>m.runnerId)].filter(Boolean)}}));
  host.replaceChildren();const banner=node('div',undefined,'intake-banner');banner.append(node('span','FORELØPIG PROGNOSE','eyebrow'),node('h2','Årets arrangement'),node('p',profile.fullName+' · finn personene, kontroller forslagene og planlegg årets merker.'));
  const yearInput=node('input');yearInput.id='intakeYear';yearInput.type='number';yearInput.min=1900;yearInput.max=9999;yearInput.value=state.context.nextYear;yearInput.onchange=()=>{state.decisions.clear();state.previous=null;state.distanceMap=Object.create(null);state.rowDistances.clear();state.distanceUndo=[];state.distanceSelection.clear();state.distancePreview=null;try{analyze();}catch(e){error(e);}};
  const complete=node('input');complete.type='checkbox';complete.id='intakeComplete';complete.onchange=()=>{if(state.meta){state.meta={...state.meta,completeSnapshot:complete.checked};analyze();}};const setup=node('div',undefined,'intake-setup');setup.append(field('Arrangementsår (foreslått fra siste gjennomførte utgave)',yearInput),field('Eksporten er komplett for valgt utvalg',complete));
  const notice=node('p','Kun midlertidig analyse i denne fanen. Filer og personvalg sendes ikke til server eller eksterne tjenester. Eksporterte rapporter inneholder personopplysninger; oppbevar dem lokalt og sikkert. Dette er ikke skylagring.','intake-notice');
  const progress=node('p','1. Velg startliste · 2. Kontroller personer · 3. Se prognoser · 4. Last ned klargjøringsoversikt.','intake-progress');progress.id='intakeProgress';
  const statusNode=node('p');statusNode.id='intakeStatus';statusNode.setAttribute('role','status');const tabs=node('div',undefined,'intake-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Årets arbeidsflyt');for(const [key,label]of [['start','Startliste'],['review','Personkontroll'],['forecast','Merkeprognoser'],['orders','Bestillingsoversikt']]){const b=button(label,()=>switchTab(key));b.dataset.intakeTab=key;tabs.append(b);}
  const summary=node('div',undefined,'intake-summary');summary.id='intakeSummary';const start=node('section');start.dataset.intakeView='start';const file=node('input');file.type='file';file.id='intakeFile';file.accept='.csv,.tsv,.xml,.txt,text/csv,application/xml,text/xml';file.onchange=async()=>{const selected=file.files[0];if(!selected)return;file.disabled=true;try{await loadFile(selected);}catch(e){error(e);}finally{file.disabled=false;file.value='';}};
  const fileInfo=node('p');fileInfo.id='intakeFileInfo';const details=node('details');details.id='intakeMappingDetails';details.hidden=true;details.append(node('summary','Kontroller eller korriger kolonnekoblinger'));const mapping=node('div',undefined,'intake-mapping');mapping.id='intakeMapping';const analyzeButton=button('Analyser med disse kolonnene',()=>analyze());analyzeButton.id='intakeAnalyze';analyzeButton.disabled=true;details.append(mapping,analyzeButton);
  const preview=node('div');preview.id='intakePreview';const distances=node('div',undefined,'intake-mapping');distances.id='intakeDistanceMap';const rowDistances=node('section',undefined,'intake-distance-panel');rowDistances.id='intakeDistanceRows';const diff=node('section',undefined,'intake-diff');diff.id='intakeDiff';const demo=button('Last ned syntetisk CSV-eksempel',()=>save('Navn;Startnummer;Distanse;Klubb\r\nEksempel Person;1;Kortmoro;Eksempelklubben\r\n','syntetisk-startliste.csv'));
  start.append(field('Velg startliste (CSV, TSV eller XML)',file),demo,info('Støtter Emit-startliste, CSV/TSV, IOF 3.0 og Participant-XML. Emit-filer mangler distanser: marker deltakerne og velg godkjent øvelse nedenfor. XLSX støttes ikke.'),fileInfo,details,distances,rowDistances,diff,preview);
  const review=node('section');review.dataset.intakeView='review';const search=node('input');search.id='intakeSearch';search.type='search';search.oninput=()=>{state.page=0;renderReview();};const match=node('select');match.id='intakeMatchFilter';for(const [v,label]of [['all','Alle'],...Object.entries(labels)]){const o=node('option',label);o.value=v;match.append(o);}match.onchange=()=>{state.page=0;renderReview();};const confirm=button('Bekreft alle entydige navn-/aliasforslag',()=>{for(const r of state.analysis.rows)if(!r.errors.length&&r.match.status==='proposed'&&r.match.candidates.length===1&&['Registrert navn','Godkjent historisk alias','Navn fra sammenslått person-ID','Bekreftet historisk løperkobling'].includes(r.match.candidates[0].reason))state.decisions.set(r.decisionKey,{action:'confirm',runnerId:r.match.candidates[0].id,confirmedAt:new Date().toISOString(),sourceSha256:state.meta.sourceSha256});analyze();});confirm.id='intakeBatchConfirm';confirm.disabled=true;
  const reviewList=node('div');reviewList.id='intakeReview';review.append(field('Søk i importerte personer eller startnummer',search),field('Vis personstatus',match),info('Navnetreff blir aldri bekreftet automatisk. Samleknappen er din uttrykkelige bekreftelse etter kontroll. Tvetydige treff, feil og skriveforslag inngår ikke.'),confirm,reviewList);
  const filters=node('div',undefined,'intake-filters');for(const [id,label]of [['intakeBadgeFilter','Filtrer merke'],['intakeDistanceFilter','Filtrer distanse']]){const s=node('select');s.id=id;const all=node('option','Alle');all.value='all';s.append(all);s.onchange=renderForecasts;filters.append(field(label,s));}
  const forecast=node('section');forecast.dataset.intakeView='forecast';const forecastList=node('div');forecastList.id='intakeForecast';forecast.append(forecastList);const orders=node('section');orders.dataset.intakeView='orders';const orderList=node('div');orderList.id='intakeOrders';orders.append(orderList);
  const reports=node('div',undefined,'intake-reports');reports.append(node('h3','Last ned rapporter (lokale personopplysninger)'));for(const [key,label]of [['import','Importoversikt'],['review','Personkontroller'],['forecast','Merkeprognose – valgt filter'],['orders','Bestillingsoversikt – valgt filter']]){const b=button(label,()=>save(I.csvReport(['orders','forecast'].includes(key)?filtered():state.analysis,key),'morothon-'+year()+'-'+key+'-FORELOPIG.csv'));b.dataset.intakeReport=key;b.disabled=true;reports.append(b);}
  host.append(banner,setup,notice,progress,tabs,summary,statusNode,start,review,filters,forecast,orders,reports);switchTab('start');
  window.addEventListener('beforeunload',e=>{if(state.analysis){e.preventDefault();e.returnValue='';}});
 }
 init().catch(e=>host.replaceChildren(node('p','Årets arrangement kunne ikke starte: '+e.message)));
})();

/* C2.2 case workspace. Packages are explicit local downloads, never browser storage. */
(() => {
 'use strict';
 const C=window.MorothonCorrections,host=document.getElementById('view-rettelser');if(!host||!C)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const $=id=>document.getElementById(id),state={package:null,history:null,model:null,suggestions:[],tab:'suggestions',selected:null,picked:[],kind:'result',impact:null,intake:null,page:0,projection:null,query:'',suggestionScope:'pending',refreshVersion:0,candidate:null,editVersion:0,preparing:false,manualMode:false,batchReview:null,editorNotes:new Map()};
 const kindLabels={merge:'Samme person – foreslå sammenslåing',person:'Endre hovednavn eller kjønn',alias:'Registrer historisk alias',result:'Rett et registrert resultat',add:'Legg til manglende resultat',remove:'Fjern dokumentert dobbeltregistrering',reverse:'Reverser en tidligere kandidatendring'};
 const areaLabels={annual:'Årsstatistikk og årets milepæler',people:'Deltakelsesår, merker og personlige rekorder',records:'Løyperekorder',placements:'Klasseplasseringer og toppresultater',rankings:'Adelskalender',diplomas:'Historiske løperdiplomer',loyalty:'Lojalitet og rekker',redirects:'Profilkoblinger',aliases:'Historiske navn'};
 function message(text,bad=false){if(bad){if(text.includes('invalid-time'))text='Tiden er ugyldig. Bruk for eksempel 49:20 eller 1:31:24, med sekunder under 60.';else if(text.includes('invalid-distance'))text='Oppgi eksakt distanse i kilometer, for eksempel 10 km.';else if(text.includes('missing-person'))text='Resultatet må tilhøre en eksisterende, kontrollert løperprofil.';}$('correctionStatus').textContent=text;$('correctionStatus').dataset.error=String(bad);}
 function button(label,action,cls='secondary'){const b=node('button',label,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){message(e.message,true);}finally{if(b.isConnected)b.disabled=false;}};return b;}
 function field(label,input){const l=node('label',label);l.append(input);return l;}
 const hint=s=>node('p',s,'hint');
 function input(value='',type='text',id){const e=node('input');e.type=type;e.value=value;if(id)e.id=id;return e;}
 function textarea(value='',id){const e=node('textarea');e.value=value;e.rows=3;e.maxLength=2000;if(id)e.id=id;return e;}
 function select(options,value,id){const e=node('select');for(const [key,label]of options){const o=node('option',label);o.value=key;e.append(o);}if(value!==undefined)e.value=value;if(id)e.id=id;return e;}
 const caseId=()=> 'case-'+crypto.randomUUID();
 function save(){const blob=new Blob([C.serialize(state.package)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='morothon-rettelser-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Arbeidsgrunnlaget er klart for nedlasting. Oppbevar filen privat. Ingenting er publisert.');}
 function activate(tab){state.tab=tab;render();}
 function summary(work){const grid=node('div',undefined,'correction-summary');let total=0;for(const [key,label]of [['identity','Mulige duplikater'],['reports','Innmeldte feil']]){const count=work[key].filter(c=>c.bucket==='pending').length;total+=count;const card=node('article');card.append(node('strong',String(count)),node('span',label+' · ubehandlet'));grid.append(card);}grid.setAttribute('aria-label',total+' ubehandlede saker');return grid;}
 function profile(id){const p=state.model.person(id),card=node('article',undefined,'correction-profile');if(!p){card.append(hint('Velg en eksisterende løper.'));return card;}const stats=state.model.stats(id),aliases=[...(state.history.aliases?.[id]||[]),...Object.entries(state.history.aliases||{}).filter(([old])=>state.model.resolve(old)===id&&old!==id).flatMap(([,names])=>names)];card.append(node('h3',p.n),hint(p.g||'Kjønn ikke oppgitt'),node('p',(stats?.count||0)+' tellende deltakelsesår'),hint('Deltakelsesår: '+(stats?.years.join(', ')||'Ingen')));if(aliases.length)card.append(hint('Tidligere navn: '+aliases.join(' · ')));
  const years=stats?.years||[],badges=node('div',undefined,'badge-collection');for(const b of state.registry.badges.filter(b=>b.kind==='participation'&&b.n<=years.length)){const figure=node('figure'),img=node('img');img.src=new URL(b.src,state.root).href;img.alt=b.name;figure.append(img,node('figcaption',b.name+' · '+years[b.n-1]));badges.append(figure);}if(badges.childNodes.length){const earned=node('details');earned.append(node('summary','Opptjente merker'),badges);card.append(earned);}
  const details=node('details');details.append(node('summary','Se alle registrerte resultater'));for(const r of state.model.resultsFor(id))details.append(hint([r[0],r[2],r[3],r[5],r[7],r[8]].filter(v=>v!==null&&v!==undefined&&v!=='').join(' · ')));card.append(details);const a=node('a','Åpne løperprofil');a.href=new URL('index.html#lop='+encodeURIComponent(p.i),state.root).href;a.target='_blank';a.rel='noopener';card.append(a);return card;
 }
 function searchPeople(box){const query=input('','search','correctionPersonSearch'),choices=select([['','Søk og velg løper']],undefined,'correctionPersonChoice');query.placeholder='Søk i navn og godkjente aliaser';query.oninput=()=>{const q=MorothonIntake.fold(query.value);choices.replaceChildren(node('option','Velg løper'));choices.firstChild.value='';if(q.length<2)return;const hits=[...state.context.people.values()].filter(p=>p.names.some(n=>MorothonIntake.fold(n.name).includes(q))).slice(0,30);for(const p of hits){const o=node('option',p.name+' · '+(p.years?.join(', ')||'Ingen deltakelsesår'));o.value=p.id;choices.append(o);}};
  const actions=node('div',undefined,'actions');actions.append(button('Velg som hovedperson',()=>{if(!choices.value)throw Error('Velg en løper i søket.');state.picked[0]=choices.value;state.resultPersonId=choices.value;state.impact=null;renderEditor();}),button('Velg som andreprofil',()=>{if(!choices.value)throw Error('Velg en løper i søket.');state.picked[1]=choices.value;state.impact=null;renderEditor();}));box.append(field('Finn berørt løper',query),field('Søketreff',choices),actions);
 }
 function selectCase(c){state.selected=c.id;state.picked=[...c.personIds];state.resultIndex=c.change?.selector?.index??c.registration?.selector.index;state.resultPersonId=['result','add'].includes(c.change?.kind)?c.change.after?.[1]:undefined;state.kind=c.change?.kind==='reverse'?'merge':c.change?.kind||(C.caseType(c)==='identity'?'merge':'result');state.impact=null;activate('cases');}
 async function createCase(suggestion){
  if(suggestion){let opened;for(;;){const snapshot=state.package;opened=await C.openSuggestion(snapshot,suggestion,caseId());if(snapshot===state.package)break;}state.package=opened.package;const c=state.package.cases.find(c=>c.id===opened.caseId);selectCase(c);if(!c.change){state.resultIndex=suggestion.resultIndexes?.[0];state.kind=suggestion.resultIndexes?.length?'result':'merge';renderEditor();}return;}
  const id=caseId();state.package=C.report(state.package,{id,category:'Innmeldt feil',personIds:[],description:'Beskriv hva som er meldt som feil.',source:''});state.selected=id;state.picked=[];state.resultIndex=undefined;state.resultPersonId=undefined;state.kind='result';state.impact=null;activate('cases');
 }
 // Et hurtigvalg er en arrangørbeslutning, ikke et eksternt kildebevis.
 // Endringen klargjøres bare lokalt, og publiseres aldri her.
 const quickIdentitySource='Manuell arrangørbekreftelse i personkontroll (ingen ekstern dokumentasjon).';
 const decisionReason=identity=>identity?'Arrangøren bekrefter at profilene gjelder samme person.':'Rettelsen er bekreftet av arrangøren etter gjennomgang av registrering og kilde.';
 function quickMainProfile(ids){return C.preferredMainProfile(state.model,ids);}
 async function quickIdentity(s,action){
  if(state.preparing)throw Error('En annen vurdering behandles allerede.');
  if(s.personIds?.length!==2||!['pending','followup'].includes(s.bucket))throw Error('Åpne saken og kontroller identiteten før hurtigvalget brukes.');
  state.preparing=true;const snapshot=state.package;
  try{
   const opened=await C.openSuggestion(snapshot,s,caseId()),work=opened.package,c=work.cases.find(item=>item.id===opened.caseId);
   if(!c||c.change||['rejected','handoff'].includes(c.status))throw Error('Denne saken har allerede en vurdering. Åpne den for å endre avgjørelsen.');
   if(action==='different'){
    const reason='Arrangøren bekrefter via hurtigvalg at dette er forskjellige personer.';
    const next=C.transition(work,c.id,'rejected',reason);
    if(snapshot!==state.package)throw Error('Arbeidslisten ble endret under vurderingen. Prøv igjen.');
    state.package=next;state.candidate=null;state.impact=null;render();
    message('Profilene holdes adskilt. Beslutningen er dokumentert lokalt – lagre arbeidsgrunnlaget.');
    return;
   }
   if(action!=='same')throw Error('Ukjent vurdering.');
   const main=quickMainProfile(s.personIds);
   if(!main){
    if(snapshot!==state.package)throw Error('Arbeidslisten ble endret under vurderingen. Prøv igjen.');
    state.package=work;selectCase(c);
    message('Profilene har like mange deltakelsesår. Velg hovednavn i saken før sammenslåing.');
    return;
   }
   const from=s.personIds.find(id=>id!==main);
   const request={kind:'merge',personIds:[from,main],selector:null,after:null,
    source:c.source.trim()||quickIdentitySource,reason:decisionReason(true)};
   // Record the source-bound proposal now; defer the expensive full-page
   // projection and cross-profile checks until the organizer finishes review.
   const proposed=await C.propose(state.history,work,c.id,request);
   if(snapshot!==state.package)throw Error('Arbeidslisten ble endret under vurderingen. Prøv igjen.');
   state.package=proposed;state.candidate=null;state.impact=null;state.batchReview=null;
   state.selected=null;state.suggestionScope='pending';render();
   message('Samme person er registrert som forslag. Hovedprofil: '+state.model.person(main).n+
    '. Endringen er ikke ferdig kontrollert eller publisert. Gjennomfør samlet kontroll etter personvurderingene, og lagre arbeidsgrunnlaget.');
  }finally{state.preparing=false;}
 }
 async function checkStaged(){
  if(state.preparing)throw Error('En annen vurdering behandles allerede.');
  const original=state.package;
  const active=original.cases.filter(c=>c.change&&['proposed','handoff'].includes(c.status));
  if(!active.length)throw Error('Behandle minst ett personforslag før samlet kontroll.');
  state.preparing=true;
  try{
   message('Kjører én samlet konsekvensanalyse av '+active.length+' forslag. Andre endringer holdes tilbake …');
   const project=await projection();
   const report=await C.reviewStaged(state.history,original,state.base,project,{linkedRunnerIds:state.linkedRunnerIds});
   if(original!==state.package)throw Error('Arbeidslisten ble endret under kontrollen. Gjennomfør kontrollen på nytt.');
   state.batchReview={package:original,report};
   render();
   message(report.ready?
    report.proposed+' forslag er kontrollert samlet. Ingen profiler eller resultatlister er endret. Lagre arbeidsgrunnlaget; endelig godkjenning og publisering må skje i en egen sikker prosess.':
    'Samlet kontroll fant forhold som må avklares: '+report.uncertain.join(' '),!report.ready);
  }finally{state.preparing=false;}
 }
 async function refreshSuggestions(){
  const c=state.package.cases.find(c=>c.id===state.selected),tab=state.tab==='cases'&&(!c||C.caseType(c)==='report')?'cases':'suggestions';state.refreshVersion++;state.suggestions=C.discover(state.history);state.suggestionScope='pending';state.query='';state.page=0;state.selected=null;state.impact=null;activate(tab);message('Listen er oppdatert. Viser ubehandlede saker. Tidligere vurderinger er beholdt.');
 }
 function listSuggestions(box,work){
  const isReport=state.tab==='cases',rows=isReport?work.reports:work.identity;
  const toolbar=node('div',undefined,'correction-filters'),q=input(state.query,'search','correctionSuggestionSearch');q.placeholder='Navn eller beskrivelse';q.onchange=()=>{state.query=q.value;state.page=0;render();};
  const scope=select([['pending','Ubehandlede'],['followup','Til oppfølging'],['finished','Ferdig gjennomgått'],['all','Alle saker']],state.suggestionScope,'correctionSuggestionScope');scope.onchange=()=>{state.suggestionScope=scope.value;state.page=0;render();};
  toolbar.append(field('Søk',q),field('Vis saker',scope));
  box.append(node('h2',isReport?'Innmeldte feil':'Mulige duplikater'),toolbar,hint(rows.filter(s=>s.bucket==='pending').length+' ubehandlede · '+rows.filter(s=>s.bucket==='followup').length+' til oppfølging · '+rows.filter(s=>s.bucket==='finished').length+' ferdigbehandlet.'));
  if(isReport)box.append(button('Registrer innmeldt feil',()=>createCase()));
  const list=rows.filter(s=>(state.suggestionScope==='all'||s.bucket===state.suggestionScope)&&MorothonIntake.fold(s.reason+' '+s.personIds.map(id=>state.model.person(id)?.n||'').join(' ')).includes(MorothonIntake.fold(state.query))),size=15;state.page=Math.min(state.page,Math.max(0,Math.ceil(list.length/size)-1));
  for(const s of list.slice(state.page*size,(state.page+1)*size)){const card=node('article',undefined,'correction-case');card.append(node('h3',s.personIds.map(id=>state.model.person(id)?.n||'Ukjent løper').join(' / ')||'Innmeldt feil'),node('p',s.reason));if(!isReport){const years=node('div',undefined,'correction-pair-years');for(const id of s.personIds)years.append(hint((state.model.person(id)?.n||'Løper')+' · '+(state.model.stats(id)?.years.join(', ')||'Ingen registrerte deltakelsesår')));card.append(years);}if(s.caseId)card.append(hint(C.labels[s.caseStatus]));const actions=node('div',undefined,'actions');actions.append(button(s.caseId?'Fortsett saken':'Åpne og sammenlign',()=>s.caseId?selectCase(state.package.cases.find(c=>c.id===s.caseId)):createCase(s)));if(!isReport&&['pending','followup'].includes(s.bucket)&&!['rejected','handoff','proposed'].includes(s.caseStatus)){const main=quickMainProfile(s.personIds);if(main)actions.append(hint('Hovedprofil ved hurtigvalg: '+state.model.person(main).n));actions.append(button('Samme person – slå sammen',()=>quickIdentity(s,'same'),'secondary correction-fast-same'),button('Ikke samme person – hold adskilt',()=>quickIdentity(s,'different'),'secondary correction-fast-different'));}card.append(actions);box.append(card);}
  if(!list.length)box.append(hint('Ingen forslag i dette utvalget. Behandlede saker er bevart i de andre utvalgene.'));
  const paging=node('div',undefined,'actions'),prev=button('Forrige saker',()=>{state.page--;render();}),next=button('Neste saker',()=>{state.page++;render();});prev.disabled=!state.page;next.disabled=(state.page+1)*size>=list.length;paging.append(prev,hint(list.length+' saker · side '+(state.page+1)),next);box.append(paging);
 }
 async function projection(){if(state.projection)return state.projection;
  const frame=node('iframe');frame.className='correction-engine';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.src=new URL('index.html',state.root).href;document.body.append(frame);
  const pending=(async()=>{const end=Date.now()+30000;await new Promise((resolve,reject)=>{const check=()=>{try{if(frame.contentWindow?.MorothonDiplomas&&!frame.contentDocument.querySelector('#loading'))return resolve();if(Date.now()>end)return reject(Error('Den eksisterende beregningsmotoren kunne ikke lastes.'));setTimeout(check,40);}catch(e){reject(e);}};check();});
   const r=await fetch(new URL('build-info.json',state.root));if(!r.ok)throw Error('Bygginformasjonen mangler.');const info=await r.json(),asset=info.assets[['admin','diploma-adapter.js'].join('/')];
   // The calculation engine is admin-only after the migration. Only the
   // read-only public projection iframe stays on the public data origin.
   // Never restore the adapter to GitHub Pages to satisfy the old lookup.
   const protectedAdapter=window.MorothonAdminTransport&&document.body.dataset.adminMode!=='local';
   const adapterUrl=protectedAdapter
     ?new URL('diploma-adapter.js',new URL('./',document.baseURI))
     :new URL('diploma-adapter.js',document.baseURI);
   if(!protectedAdapter&&typeof asset==='string'&&/^admin\/diploma-adapter\.js\?v=[a-f0-9]+$/.test(asset))
     adapterUrl.href=new URL(asset,state.root).href;
   await new Promise((resolve,reject)=>{const script=frame.contentDocument.createElement('script');script.src=adapterUrl.href;script.onload=resolve;script.onerror=()=>reject(Error('Beregningsadapteren kunne ikke lastes.'));frame.contentDocument.head.append(script);});if(typeof frame.contentWindow.C2Project!=='function')throw Error('Konsekvensmotoren mangler.');return data=>frame.contentWindow.C2Project(data);
  })().catch(e=>{frame.remove();state.projection=null;throw e;});state.projection=pending;return pending;
 }
 function resultForm(box,c){const owners=new Set([...state.picked,...c.personIds,...(state.resultIndex!==undefined&&state.history.results[state.resultIndex]?[state.model.resolve(state.history.results[state.resultIndex][1])]:[])]),rows=state.history.results.map((r,index)=>({r,index})).filter(({r})=>owners.has(state.model.resolve(r[1]))),selected=select(rows.map(({r,index})=>[String(index),[r[0],r[2],r[3],r[5],r[7],r[8],'registrering '+(index+1)].filter(Boolean).join(' · ')]),state.resultIndex!==undefined?String(state.resultIndex):undefined,'correctionResultChoice');
  if(state.kind!=='add'){box.append(field('Velg nøyaktig resultat',selected));if(!rows.length){box.append(hint('Ingen resultater for valgt person.'));return;}if(selected.selectedIndex<0)selected.selectedIndex=0;state.resultIndex=+selected.value;selected.onchange=()=>{state.resultIndex=+selected.value;state.impact=null;renderEditor();};}
  const row=state.kind==='add'?[state.history.yearStats.at(-1)[0],state.picked[0]||'','Morothon','20 km','Fullført','',null,'','','']:state.history.results[state.resultIndex];if(!row)return;
  const proposed=c.change&&c.change.kind===state.kind&&(state.kind==='add'||c.change.selector?.index===state.resultIndex)?c.change.after:null,draftRow=proposed||row;
  const before=node('div',undefined,'correction-before');before.append(node('h4',state.kind==='add'?'Manglende resultat':'Opprinnelig registrering'),node('p',state.kind==='add'?'Ingen registrering finnes. Konkret kilde er påkrevd.':[row[0],state.model.person(row[1])?.n,...row.slice(2)].filter(v=>v!==null&&v!=='').join(' · ')));box.append(before);
  if(state.kind==='remove'){box.append(hint('Bare dokumentert feilregistrering skal foreslås fjernet. Ingen reelle starter dedupliseres automatisk.'));return;}
  const form=node('div',undefined,'correction-result-fields'),labels=['År','Registrert person-ID','Konkurranse','Eksakt distanse','Status','Tid','Kildeplassering','Klasse','Klubb','Startnummer'];
  draftRow.forEach((v,i)=>{const e=i===4?select([['Fullført','Fullført'],['DNF','DNF'],['DNS','DNS'],['Disket','DQ / disket'],['Deltatt','Deltatt']],v,'correctionField'+i):input(v??'','text','correctionField'+i);if(i===1){e.type='hidden';e.readOnly=true;e.value=state.resultPersonId||v||state.picked[0];form.append(e);}else form.append(field(labels[i],e));});for(let i=draftRow.length;i<10;i++)form.append(field(labels[i],input('','text','correctionField'+i)));box.append(node('h4','Foreslått registrering'),form,hint('Kjønn endres under personopplysninger. Klasse og status endres her. Velg riktig person i søket ved feil personkobling.'));
 }
 function downloadCandidate(){return (async()=>{
  const packet=state.candidate,work=state.package;if(!packet||JSON.stringify(packet.corrections)!==JSON.stringify(work))throw Error('Arbeidsgrunnlaget er endret. Godkjenn og klargjør rettelsen på nytt.');
  await C.verifyCandidate(state.history,packet,state.base,await projection(),{linkedRunnerIds:state.linkedRunnerIds});
  if(packet!==state.candidate||work!==state.package)throw Error('Arbeidsgrunnlaget er endret under kontrollen. Prøv igjen.');
  const url=URL.createObjectURL(new Blob([C.serializeCandidate(packet)],{type:'application/json'})),a=node('a');a.href=url;a.download='morothon-endringskandidat-'+packet.checksum.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Endringskandidaten er lastet ned. Den inneholder kontrollrapport og tilbakeføringsgrunnlag, men ingen publiseringsautorisasjon. Oppbevar filen privat.');
 })();}
 function candidateSummary(box,c){if(!state.candidate||!state.candidate.corrections.cases.some(x=>x.id===c.id)||JSON.stringify(state.candidate.corrections)!==JSON.stringify(state.package))return;
  const panel=node('section',undefined,'correction-candidate');panel.id='correctionCandidate';panel.append(node('h3','Oppdateringen er klargjort'),node('p','Resultater og tidligere navn er bevart. Beregninger og tilbakeføring er kontrollert.'),hint('Dette er en lokal endringskandidat. Autorisert kontroll, sikkerhetskopi og godkjent offentlig eksport kreves før publisering.'));
  const b=button('Last ned komplett endringskandidat',downloadCandidate);b.id='correctionCandidateDownload';panel.append(b);box.append(panel);
 }
 function renderImpact(box,c){if(!state.impact||state.impact.caseId!==c.id)return;const impact=state.impact,panel=node('section',undefined,'correction-impact');panel.id='correctionImpact';panel.append(node('h3','Konsekvenser før overlevering'),hint('Kun kandidatberegning i minnet. Ingen resultater, godkjenninger eller diplomer er endret.'));if(impact.changes.some(c=>c.area==='diplomas'&&c.status==='changed'))panel.append(hint('Endret diplomgrunnlag må godkjennes på nytt før ren utskrift. Overlevering godkjenner ingen diplomer.'));
  if(!state.manualMode){const id=state.model.resolve(c.change?.personIds.at(-1)||state.picked[0]),redirects=impact.candidate.redirects||{},target=MorothonHistoryData.resolveId(id,redirects),personChange=impact.changes.find(a=>a.area==='people'),personAfter=personChange?.after?.[target];
   if(personAfter){const facts=node('p',undefined,'correction-key-facts');facts.append(node('strong',personAfter.count+' unike deltakelsesår'));if(personAfter.totals)facts.append(document.createTextNode(' · '+personAfter.totals.completed+' fullføringer · '+personAfter.totals.km+' km'));panel.append(facts);}
   const changed=impact.changes.filter(a=>a.status==='changed');panel.append(node('p',changed.length?'Oppdateres: '+changed.map(a=>areaLabels[a.area]).join(' · '):'Ingen endring i beregnede nøkkeltall.'));
  }
  const technical=node('details');technical.id='correctionTechnicalImpact';technical.open=state.manualMode;technical.append(node('summary','Se alle beregninger og eksakte før- og etterverdier'));
  for(const area of impact.changes){const details=node('details');details.append(node('summary',areaLabels[area.area]+' · '+(area.status==='unchanged'?'Uendret':'Endres')));if(area.status==='changed'){
   if(!Array.isArray(area.before)&&area.before&&typeof area.before==='object'){const ids=[...new Set([...Object.keys(area.before),...Object.keys(area.after)])].filter(id=>JSON.stringify(area.before[id])!==JSON.stringify(area.after[id]));for(const id of ids.slice(0,40)){const row=node('div',undefined,'correction-diff'),a=node('pre',JSON.stringify(area.before[id]??null,null,2)),b=node('pre',JSON.stringify(area.after[id]??null,null,2));row.append(node('strong',state.model.person(id)?.n||id),a,b);details.append(row);}if(ids.length>40)details.append(hint('Viser 40 av '+ids.length+' endrede profiler. Alle er med i kontrollen.'));}
   else{const diff=node('div',undefined,'correction-diff');diff.append(node('pre',JSON.stringify(area.before,null,2)),node('pre',JSON.stringify(area.after,null,2)));details.append(diff);}
  }technical.append(details);}panel.append(technical);
  for(const issue of impact.uncertain)panel.append(node('p','Uavklart: '+issue,'intake-error'));panel.append(node('strong',impact.ready?(c.status==='handoff'?'Kontrollene er bestått. Endringen er lokalt klargjort.':'Konsekvensene er beregnet. Forslaget kan gjennomgås for lokal overlevering.'):'Overlevering er sperret til de uavklarte konsekvensene er kontrollert.'));box.append(panel);
 }
 function renderEditor(){const box=$('correctionEditor');if(!box)return;box.replaceChildren();box.oninput=box.onchange=()=>{if(box.dataset.caseId&&$('correctionDescription'))state.editorNotes.set(box.dataset.caseId,{description:$('correctionDescription').value,source:$('correctionSource').value,reason:$('correctionReason').value});state.editVersion++;state.candidate=null;const panel=$('correctionCandidate');if(panel)panel.remove();};const c=state.package.cases.find(c=>c.id===state.selected);if(!c){box.append(hint('Åpne en sak, eller registrer en ny.'));return;}
  const identity=C.caseType(c)==='identity',savedNotes=state.editorNotes.get(c.id)||c;box.dataset.caseId=c.id;box.append(node('h2',identity?'Mulig duplikat':'Innmeldt feil'),hint(C.labels[c.status]));const description=textarea(savedNotes.description,'correctionDescription'),source=textarea(savedNotes.source,'correctionSource'),reason=textarea(savedNotes.reason,'correctionReason');if(identity)box.append(hint(savedNotes.description));else box.append(field('Hva er meldt som feil?',description));
  const other=node('details');other.id='correctionOtherChoices';other.append(node('summary','Andre valg'),hint('Saksreferanse: '+c.id));searchPeople(identity?other:box);
  const profiles=node('div',undefined,'correction-profiles');for(const id of state.picked)if(id)profiles.append(profile(id));box.append(profiles);
  if(state.picked.length===2){const a=state.model.stats(state.picked[0])?.years||[],b=state.model.stats(state.picked[1])?.years||[];box.append(hint('Felles deltakelsesår: '+(a.filter(y=>b.includes(y)).join(', ')||'Ingen')+'. Flere reelle starter skal bevares.'));
  }
  const reversing=c.change?.kind==='reverse';if(reversing)box.append(hint('Egen reverseringshandling for '+c.change.reverses+'. Opprinnelige førverdier og resultattilhørighet må kunne rekonstrueres.'));
  const kind=select(Object.entries(kindLabels).filter(([k])=>k!=='reverse'),state.kind,'correctionKind');kind.onchange=()=>{state.kind=kind.value;state.impact=null;renderEditor();};if(!reversing)(identity?other:box).append(field('Hva vil du rette?',kind));
  if(state.kind==='person'&&state.picked[0]){const p=c.change?.kind==='person'&&c.change.personIds[0]===state.picked[0]?c.change.after.person:state.model.person(state.picked[0]);box.append(field('Foreslått hovednavn',input(p.n,'text','correctionName')),field('Registrert kjønn',select([['Herre','Herre'],['Dame','Dame'],['','Ikke oppgitt']],p.g,'correctionGender')));}
  if(state.kind==='alias'&&state.picked[0])box.append(field('Historiske navn, ett per linje',textarea((c.change?.kind==='alias'&&c.change.personIds[0]===state.picked[0]?c.change.after:state.history.aliases?.[state.picked[0]]||[]).join('\n'),'correctionAliases')));
  if(['result','add','remove'].includes(state.kind))resultForm(box,c);
  if(state.kind==='merge'&&!reversing){box.append(hint('Bekreft identiteten mot kilden. Begge profilene, gamle lenker og alle starter bevares.'));if(state.picked.filter(Boolean).length===2){const main=select(state.picked.map(id=>[id,state.model.person(id).n]),state.picked[1],'correctionMainPerson');box.append(field('Hovednavn etter sammenslåing',main));}}
  if(/SHA-256|[a-f0-9]{64}/.test(c.source)){box.append(hint('Kilde: '+c.source.split(' · ')[0]+'. Detaljene er bevart under Andre valg.'));other.append(field('Teknisk kildereferanse',source));}else if(identity)other.append(field('Valgfri ekstern dokumentasjon',source));else box.append(field('Kilde – hvor kommer opplysningen fra?',source));if(identity)other.append(field('Valgfri beskrivelse',description));other.append(field('Valgfri merknad',reason));
  const saveNotes=async()=>{let registration=c.registration;if(!registration&&state.kind==='result'&&state.resultIndex!==undefined)registration={selector:await C.resultSelector(state.history,state.resultIndex,state.base),before:state.history.results[state.resultIndex]};return C.updateNotes(state.package,c.id,{description:description.value,source:source.value,reason:reason.value.trim()||decisionReason(identity),personIds:c.change?c.personIds:state.picked.filter(Boolean),...(registration?{registration}:{})});};
  function requestChange(){if(!state.picked[0])throw Error('Velg en berørt person.');let after=null,selector=null,personIds=[state.picked[0]];
   if(state.kind==='merge'){if(!state.picked[1])throw Error('Velg to profiler.');const target=$('correctionMainPerson')?.value||state.picked[1];personIds=[state.picked.find(id=>id!==target),target];}
   if(state.kind==='person')after={n:$('correctionName').value,g:$('correctionGender').value};
   if(state.kind==='alias')after=$('correctionAliases').value.split('\n').map(v=>v.trim()).filter(Boolean);
   if(['result','add'].includes(state.kind)){after=Array.from({length:10},(_,i)=>$('correctionField'+i).value);after[0]=Number(after[0]);const original=state.kind==='result'?state.history.results[+$('correctionResultChoice').value]:null;after[6]=/^\d+$/.test(after[6])?+after[6]:after[6]||(original?.[6]===''?'':null);}
   return {kind:state.kind,personIds,after,source:source.value.trim()||(identity?quickIdentitySource:''),reason:reason.value.trim()||decisionReason(identity),selector:null};
  }
  async function completeRequest(){const request=requestChange();if(['result','remove'].includes(state.kind))request.selector=await C.resultSelector(state.history,+$('correctionResultChoice').value,state.base);return request;}
  function notesPackage(){const updated=C.parse(C.serialize(state.package)),record=updated.cases.find(x=>x.id===c.id);record.description=description.value;return updated;}
  state.captureEditor=async()=>{
   if(state.preparing)throw Error('Vent til den pågående kontrollen er ferdig.');
   if(state.kind!=='result')throw Error('Serverlagring støtter foreløpig bare rettelser av eksisterende resultater.');
   const previous=state.package,version=state.editVersion,request=await completeRequest(),shadow=notesPackage();
   const item=shadow.cases.find(x=>x.id===c.id);if(item.status==='handoff')item.status='proposed';
   const proposed=await C.propose(state.history,shadow,c.id,request);await C.applyCandidate(state.history,proposed,state.base,{preview:true});
   if(previous!==state.package||version!==state.editVersion)throw Error('Skjemaet er endret under kontrollen. Prøv igjen.');
   const next=proposed.cases.find(x=>x.id===c.id);
   if(JSON.stringify([c.change,c.description,c.source,c.reason])!==JSON.stringify([next.change,next.description,next.source,next.reason])){state.package=proposed;state.impact=null;state.candidate=null;render();}
  };
  const othersPending=state.kind==='merge'&&state.package.cases.some(item=>item.id!==c.id&&item.change&&['proposed','handoff'].includes(item.status));
  if(othersPending)box.append(hint('Du har allerede andre endringsforslag i arbeidslisten. Velg ønsket hovednavn og registrer denne sammenslåingen uten en ny tung kontroll. Kontroller alle forslagene samlet når gjennomgangen er ferdig.'));
  const actions=node('div',undefined,'actions'),approve=button(state.kind==='merge'?(othersPending?'Registrer sammenslåing – kontroller samlet':'Bekreft samme person og klargjør'):'Godkjenn og klargjør',async()=>{
   if(state.preparing)return;state.preparing=true;const version=state.editVersion,work=state.package,selected=state.selected;state.candidate=null;
   message(othersPending?'Registrerer valgt hovednavn og sammenslåing lokalt …':'Kontrollerer rettelsen og beregner alle konsekvensene …');
   try{
    const request=await completeRequest();
    if(othersPending){
     const next=await C.propose(state.history,notesPackage(),c.id,request);
     if(work!==state.package||selected!==state.selected||version!==state.editVersion)throw Error('Valgene ble endret under kontrollen. Kontroller innholdet og prøv igjen.');
     state.package=next;state.impact=null;state.batchReview=null;state.manualMode=false;
     state.picked=[...next.cases.find(x=>x.id===c.id).personIds];
     state.selected=null;state.suggestionScope='followup';activate('suggestions');
     message('Samme person er registrert med hovednavn «'+state.model.person(request.personIds[1]).n+'». Andre endringer er ikke kontrollert på nytt. Bruk samlet forhåndskontroll når du er ferdig, og lagre arbeidsgrunnlaget. Ingenting er publisert.');
     return;
    }
    const next=await C.prepareCase(state.history,notesPackage(),c.id,request,state.base,await projection(),{linkedRunnerIds:state.linkedRunnerIds});
    if(work!==state.package||selected!==state.selected||version!==state.editVersion)throw Error('Valgene ble endret under kontrollen. Kontroller innholdet og prøv igjen.');
    state.package=next.package;state.impact=next.impact;state.candidate=next.candidate;state.manualMode=false;state.picked=[...state.package.cases.find(x=>x.id===c.id).personIds];render();
    message(!next.ready?'Rettelsen trenger en avklaring: '+next.impact.uncertain.join(' '):next.pending.length?'Denne rettelsen er kontrollert. Bekreft '+next.pending.length+' øvrige forslag før den samlede kandidaten lastes ned.':'Oppdateringen er klargjort. Du kan laste ned én komplett endringskandidat. Ingenting er publisert.',!next.ready);
   }finally{state.preparing=false;}
  });approve.id='correctionApprove';approve.disabled=reversing;actions.append(approve);
  const manual=node('details');manual.id='correctionManualFlow';manual.append(node('summary','Trinnvis kontroll og tilbakeføring'));
  const draft=button(identity?'Samme person':'Foreslå retting',async()=>{const updated=notesPackage(),request=await completeRequest();
   const next=await C.propose(state.history,updated,c.id,request);await C.applyCandidate(state.history,next,state.base,{preview:true});state.package=next;state.impact=null;state.manualMode=true;render();message('Forslaget er registrert i fanens minne. Last ned rettingspakken for å bevare arbeidet.');});draft.id='correctionPropose';draft.disabled=c.status==='handoff'||reversing;
  const check=button('Kontroller konsekvenser',async()=>{message('Beregner med de eksisterende motorene …');state.manualMode=true;state.impact=await C.consequences(state.history,state.package,c.id,state.base,await projection(),{linkedRunnerIds:state.linkedRunnerIds});render();message(state.impact.ready?'Konsekvensanalysen er klar til gjennomgang.':'Konsekvensanalysen viser forhold som må avklares.',!state.impact.ready);});check.id='correctionCheck';check.disabled=!c.change;check.hidden=!c.change;
  const handoff=button('Klargjør for godkjenning',()=>{state.package=C.transition(state.package,c.id,'handoff',reason.value.trim()||decisionReason(identity),state.impact);render();message('Lokalt klargjort. Lagre arbeidsgrunnlaget for videre autorisert behandling. Ingenting er publisert.');});handoff.id='correctionHandoff';handoff.disabled=!state.impact?.ready||state.impact.caseId!==c.id;handoff.hidden=!c.change;
  const notes=button('Lagre saksnotat',async()=>{state.package=await saveNotes();state.impact=null;render();message('Saksnotatet er beholdt i fanen. Lagre arbeidsgrunnlaget før du lukker.');});
  const finish=async(status,defaultReason)=>{state.package=C.transition(await saveNotes(),c.id,status,reason.value||defaultReason);state.impact=null;state.selected=null;state.suggestionScope='pending';activate(identity?'suggestions':'cases');message(status==='rejected'?'Vurderingen er beholdt. Saken ligger under Ferdig gjennomgått.':'Saken ligger under Til oppfølging.');};
  if(!identity)actions.append(notes);else other.append(notes);manual.append(draft,check,handoff);other.append(manual);actions.append(button(identity?'Forskjellige personer':'Avvis feilmeldingen',()=>finish('rejected',identity?'Profilene er vurdert som forskjellige personer.':'Feilmeldingen er avvist etter kontroll.')),button(identity?'Undersøk senere':'Utsett saken',()=>finish('review','Avventer mer kildegrunnlag.')));other.append(button('Angre / trekk tilbake eget forslag',()=>{state.package=C.transition(state.package,c.id,'review','Forslaget er trukket tilbake fra kandidatbehandling; tidligere hendelser bevares.');state.impact=null;render();}));box.append(actions,other);renderImpact(box,c);candidateSummary(box,c);
  if(c.change){const comparison=node('details');comparison.append(node('summary','Kontrollgrunnlag: registrert og foreslått verdi'));const diff=node('div',undefined,'correction-diff');diff.append(node('pre',JSON.stringify(c.change.before,null,2)),node('pre',JSON.stringify(c.change.after,null,2)));comparison.append(diff);box.append(comparison);}
 }
 function render(){if(state.batchReview?.package!==state.package)state.batchReview=null;if(state.candidate&&JSON.stringify(state.candidate.corrections)!==JSON.stringify(state.package))state.candidate=null;const body=$('correctionBody');if(!body)return;const version=++state.refreshVersion;C.worklist(state.suggestions,state.package).then(work=>{if(version!==state.refreshVersion)return;renderWork(body,work);}).catch(e=>message(e.message,true));}
 function renderWork(body,work){if(state.privateIdentityMode&&state.tab==='suggestions')state.tab='cases';body.replaceChildren();const selected=state.package.cases.find(c=>c.id===state.selected),tab=state.tab==='cases'&&selected&&C.caseType(selected)==='identity'?'suggestions':state.tab;for(const b of host.querySelectorAll('[data-correction-tab]'))b.setAttribute('aria-pressed',String(b.dataset.correctionTab===tab));const panel=$('correctionSummary');panel.replaceChildren(summary(state.privateIdentityMode?{...work,identity:[]}:work));
  const proposed=state.package.cases.filter(c=>c.change&&['proposed','handoff'].includes(c.status));
  if(tab==='suggestions'&&proposed.length){
   const batch=node('section',undefined,'correction-batch-review');batch.id='correctionBatchReview';
   batch.append(node('h3','Felles gjennomgang av rettelser'),hint(proposed.length+' lokale endringsforslag registrert · '+work.identity.filter(s=>s.bucket==='pending').length+' personforslag fortsatt ubehandlet.'));
   const check=button('Gjennomgang ferdig – kontroller '+proposed.length+' forslag samlet',checkStaged,'secondary correction-batch-check');check.id='correctionBatchCheck';batch.append(check);
   const audit=state.batchReview?.package===state.package?state.batchReview.report:null;
   if(audit){batch.append(node('strong',audit.ready?'Samlet forhåndskontroll bestått':'Samlet forhåndskontroll trenger avklaring'));
    batch.append(hint('Berørte beregninger: '+(audit.changed.join(' · ')||'Ingen')+'. Kontrollresultatet gir ingen publiseringsrettigheter.'));
    for(const issue of audit.uncertain)batch.append(node('p',issue,'intake-error'));
    for(const issue of audit.errors)batch.append(node('p',String(issue.code||issue),'intake-error'));
   }else batch.append(hint('Sammenslåingene kontrolleres samlet først når du er ferdig med gjennomgangen. Ingen løperprofil endres før egen godkjent publisering.'));
   panel.append(batch);
  }
  if(state.tab==='suggestions'||state.tab==='cases'&&!state.selected)listSuggestions(body,work);
  else if(state.tab==='cases'){
   const type=selected?C.caseType(selected):'report',layout=node('div',undefined,'correction-workspace'),list=node('aside',undefined,'correction-case-list');list.append(button('Tilbake til arbeidslisten',()=>{state.selected=null;state.suggestionScope='pending';activate(type==='identity'?'suggestions':'cases');}));for(const c of state.package.cases.filter(c=>C.caseType(c)===type&&(!['rejected','handoff'].includes(c.status)||c.id===state.selected)))list.append(button((c.personIds.map(id=>state.model.person(id)?.n||'Ukjent løper').join(' / ')||'Innmeldt feil')+' · '+C.labels[c.status],()=>selectCase(c)));const editor=node('section');editor.id='correctionEditor';layout.append(list,editor);body.append(layout);renderEditor();
  }else{
   body.append(node('h2','Endringshistorikk – lokale beslutninger'),hint('Ingen av disse hendelsene er en bekreftelse på faktisk publisering. Importert historikk er ikke en verifisert signatur.'));
   for(const c of state.package.cases){const card=node('article',undefined,'correction-case');card.append(node('h3',c.personIds.map(id=>state.model.person(id)?.n||id).join(' / ')||c.category),hint(c.id+' · '+C.labels[c.status]));for(const e of c.events)card.append(hint(new Intl.DateTimeFormat('nb-NO',{dateStyle:'short',timeStyle:'short'}).format(new Date(e.at))+' · '+(C.labels[e.action]||e.action)+' · '+e.reason));if(c.change&&c.change.kind!=='reverse'&&['proposed','handoff'].includes(c.status))card.append(button('Opprett kontrollert reversering',async()=>{const id=caseId();let p=C.report(state.package,{id,category:'Reversering',personIds:c.personIds,description:'Reverser kandidatendringen i '+c.id,source:c.source});p=await C.propose(state.history,p,id,{kind:'reverse',personIds:c.personIds,reverses:c.id,source:c.source,reason:'Tilbakeføring av dokumentert forslag '+c.id+'. Originalhandlingen beholdes i journalen.'});await C.applyCandidate(state.history,p,state.base,{preview:true});state.package=p;state.selected=id;state.picked=[...c.personIds];state.impact=null;activate('cases');message('Reverseringen er et eget forslag. Beregn konsekvensene før overlevering.');}));body.append(card);}
  }
 }
 document.addEventListener('morothon:intake-analysis',e=>{state.intake=e.detail;});
 document.addEventListener('morothon:edit-existing-result',e=>{(async()=>{
  if(!state.package)throw Error('Vent til resultatkontrollen er klar.');
  const id=state.model.resolve(e.detail.id);if(!state.model.person(id))throw Error('Velg en eksisterende løper.');
  const index=state.history.results.findIndex(r=>state.model.resolve(r[1])===id);if(index<0)throw Error('Løperen har ingen registrerte resultater.');
  const key=caseId();state.package=C.report(state.package,{id:key,category:'Innmeldt feil',personIds:[id],description:'Rett et registrert resultat',source:''});
  state.selected=key;state.picked=[id];state.resultIndex=index;state.resultPersonId=id;state.kind='result';state.impact=null;activate('cases');
 })().catch(error=>message(error.message,true));});
 document.addEventListener('morothon:request-result-projection',e=>{projection().then(e.detail.resolve,e.detail.reject);});
 document.addEventListener('morothon:results-corrections',e=>{(async()=>{
  if(!state.package)throw Error('Kontrollsentralen er ikke klar.');const previous=state.package,reviewed=previous.cases.filter(c=>c.status==='handoff').map(c=>c.id),imported=C.importPackage(previous,e.detail.package);
  const prepareId=e.detail.prepareCaseId;if(prepareId&&!e.detail.package.cases.some(c=>c.id===prepareId&&['result','add'].includes(c.change?.kind)))throw Error('Velg et konkret resultatforslag før klargjøring.');
  if(e.detail.stayOnImport&&!prepareId){
   // One complete review, never an authorization to publish. The existing
   // detailed per-case path remains available only through advanced actions.
   const project=await projection(),report=await C.reviewStaged(state.history,imported.package,state.base,project,{linkedRunnerIds:state.linkedRunnerIds});
   if(previous!==state.package)throw Error('Arbeidsgrunnlaget ble endret under samlet gjennomgang. Prøv igjen.');
   state.package=imported.package;state.batchReview={package:state.package,report};state.candidate=null;state.impact=null;state.selected=null;state.tab='cases';state.suggestionScope='followup';
   render();message(report.ready?'Resultatendringene er samlet kontrollert. Ingen endringer er publisert. Lagre arbeidsgrunnlaget.':'Samlet gjennomgang fant forhold som må avklares. Endringene er beholdt lokalt; ingen publisering.',!report.ready);
   return {...imported,review:report};
  }
  await C.applyCandidate(state.history,imported.package,state.base,{preview:true});if(previous!==state.package)throw Error('Arbeidsgrunnlaget ble endret under overføringen. Prøv igjen.');state.package=imported.package;state.selected=null;state.impact=null;state.suggestionScope='followup';activate('cases');location.hash='#rettelser';
  if(prepareId){
   selectCase(state.package.cases.find(c=>c.id===prepareId));const snapshot=state.package,version=state.editVersion,project=await projection();let work=snapshot,prepared;
   // Only cases already prepared in this live workspace are rechecked. Imported
   // handoff statuses are still demoted and never become local approval evidence.
   for(const id of [...reviewed.filter(id=>id!==prepareId),prepareId]){const c=work.cases.find(c=>c.id===id);if(!c?.change)throw Error('Det lokale rettingsgrunnlaget er endret.');const change=c.change;
    prepared=await C.prepareCase(state.history,work,id,{kind:change.kind,personIds:change.personIds,selector:change.selector,after:change.kind==='person'?{n:change.after.person.n,g:change.after.person.g}:change.after,reverses:change.reverses,source:c.source,reason:c.reason},state.base,project,{linkedRunnerIds:state.linkedRunnerIds});work=prepared.package;if(!prepared.ready)break;
   }
   if(snapshot!==state.package||version!==state.editVersion||state.selected!==prepareId)throw Error('Arbeidsgrunnlaget ble endret under kontrollen. Forslagene er bevart og må vurderes på nytt.');
   state.package=work;state.impact=prepared.impact;state.candidate=prepared.candidate;state.manualMode=false;const selected=work.cases.find(c=>c.id===prepared.impact.caseId);state.selected=selected.id;state.picked=[...selected.personIds];state.kind=selected.change.kind;render();message(!prepared.ready?'Rettelsen trenger en avklaring: '+prepared.impact.uncertain.join(' '):prepared.pending.length?'Rettelsen er kontrollert. Bekreft de øvrige forslagene før samlet nedlasting.':'Oppdateringen er klargjort. Last ned komplett endringskandidat. Ingenting er publisert.',!prepared.ready);
  }else message(imported.added+' resultatsaker klargjort under Til oppfølging. Ingen retting er publisert.');return imported;
 })().then(e.detail.resolve,e.detail.reject);});
 document.addEventListener('morothon:result-source-changed',e=>{
  // A server-saved proposal still belongs to its original file. Reimport is a
  // separate comparison, not permission to demote or overwrite that proposal.
  if(window.MorothonReviewClient?.matchesSavedResult?.())return;
  if(!state.package)return;let next=state.package,count=0;for(const c of state.package.cases)if(['proposed','handoff'].includes(c.status)&&c.events.some(x=>x.action==='result-source-'+e.detail.previousSha)){next=C.transition(next,c.id,'review','Resultatfil eller tolkning er endret. Kontroller kildehash og avvik på nytt før overlevering.');count++;}if(count){state.package=next;state.impact=null;render();message(count+' tidligere resultatforslag krever ny gjennomgang etter endret kildegrunnlag.');}
 });
 document.addEventListener('morothon:corrections-ready',async e=>{
  try{
   if(state.package)return;Object.assign(state,e.detail);state.model=MorothonHistoryData.create(state.history);state.base=await C.binding(state.history,state.meta);state.package=C.empty(state.base);state.suggestions=C.discover(state.history);
   const a=node('a','Resultatkontroll');a.href='#rettelser';a.id='navCorrections';if(location.hash==='#rettelser')a.setAttribute('aria-current','page');const icon=node('span','◇');icon.setAttribute('aria-hidden','true');a.prepend(icon);document.querySelector('.sidebar nav').append(a);
   const banner=node('div',undefined,'intake-banner');banner.append(node('span','KONTROLL FØR ENDRING','eyebrow'),node('h2','Resultatkontroll'),node('p','Behandle innmeldte feil, kontroller rettinger og godkjenn publisering. Personkontroll ligger på egen side. Ingen historikk endres automatisk.'));
   const notice=node('p','Arbeidet beholdes bare i denne fanen. Lagre arbeidsgrunnlaget for å ta vare på vurderingene, og oppbevar filen privat. Ingen saker sendes eller lagres på server.','intake-notice');
   const tabs=node('div',undefined,'intake-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Sakstype');for(const [key,label]of [['suggestions','Mulige duplikater'],['cases','Innmeldte feil']]){const b=button(label,()=>{state.selected=null;state.suggestionScope='pending';state.page=0;activate(key);});b.dataset.correctionTab=key;tabs.append(b);}
   const tools=node('div',undefined,'actions'),file=node('input');file.type='file';file.accept='.json,application/json';file.id='correctionImport';file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>C.CANDIDATE_BYTES)throw Error('Endringskandidaten kan være maksimalt 16 MB.');const text=await f.text();let isCandidate=false;try{isCandidate=JSON.parse(text)?.format===C.CANDIDATE_FORMAT;}catch{}let incoming;if(isCandidate){const candidate=await C.parseCandidate(text);await C.verifyCandidate(state.history,candidate,state.base,await projection(),{linkedRunnerIds:state.linkedRunnerIds});incoming=candidate.corrections;}else incoming=C.parse(text);let result,carried=false;
    if(JSON.stringify(incoming.base)!==JSON.stringify(state.base)){
     result=await C.carryDecisions(state.history,state.package,incoming);if(!result.added&&!result.duplicates)throw Error('Arbeidsgrunnlaget gjelder en annen dataversjon. Ingen sammenlignbare, avviste personpar kan overføres. Behold originalfilen for manuell gjennomgang.');
     if(!window.confirm('Historikken er oppdatert. Vil du hente '+result.added+' tidligere avvisninger med samme navnegrunnlag? '+result.skipped+' øvrige saker blir bare i originalfilen og må gjennomgås på nytt. Ingen rettinger eller godkjenninger overføres.')){message('Importen er avbrutt. Arbeidsgrunnlaget er uendret.');return;}carried=true;
    }else result=C.importPackage(state.package,incoming);
    await C.applyCandidate(state.history,result.package,state.base,{preview:true});state.package=result.package;state.selected=null;state.impact=null;state.suggestionScope='pending';render();message(carried?result.added+' tidligere avvisninger beholdt · '+result.skipped+' øvrige saker ligger i originalfilen.':result.added+' saker importert · '+result.duplicates+' like saker beholdt. Importerte godkjenninger krever ny lokal gjennomgang.');}catch(e){message(e.message,true);}finally{file.value='';}};
   const refresh=button('Oppdater arbeidslisten',refreshSuggestions);refresh.id='correctionRefresh';const saveButton=button('Lagre arbeidsgrunnlag',save);saveButton.id='correctionSave';const advanced=node('details');advanced.id='correctionAdvanced';advanced.append(node('summary','Arbeidsfiler og tidligere behandling'),field('Åpne lagret arbeidsgrunnlag',file),button('Endringshistorikk',()=>activate('history')));tools.append(refresh,saveButton);const status=node('p');status.id='correctionStatus';status.setAttribute('role','status');const summaryNode=node('div');summaryNode.id='correctionSummary';const body=node('div');body.id='correctionBody';host.replaceChildren(banner,notice,tools,tabs,summaryNode,status,body,advanced);render();
   // A workspace bridge, never an authorization or storage adapter. The separately
   // hosted authenticated client may export/restore the same established contract.
   window.MorothonCorrectionWorkspace={
    usePrivateIdentities(){state.privateIdentityMode=true;state.selected=null;state.tab='cases';
     const tab=host.querySelector('[data-correction-tab="suggestions"]');if(tab)tab.hidden=true;
     const nav=$('navCorrections');if(nav)nav.textContent='Resultatkontroll';
     host.querySelector('.intake-banner h2').textContent='Resultatkontroll';
     const link=node('a','Åpne Personkontroll');link.href='#personkontroll';
     host.querySelector('.intake-notice').replaceChildren(document.createTextNode('Resultatimport og resultatkorrigeringer hører til Årets arrangement. Identiteter behandles separat. '),link);
     render();},
    exportDraft:()=>C.parse(C.serialize(state.package)),
    async captureDraft(){if(state.selected&&$('correctionEditor')&&state.captureEditor)await state.captureEditor();return C.parse(C.serialize(state.package));},
    async restoreDraft(draft){
     const previous=state.package,version=state.editVersion;
     const work=C.importPackage(C.empty(state.base),C.parse(C.serialize(draft))).package;
     await C.applyCandidate(state.history,work,state.base,{preview:true});
     if(previous!==state.package||version!==state.editVersion)throw Error('Arbeidet ble endret mens utkastet ble kontrollert. Ingen lokale endringer er erstattet.');
     state.package=work;state.selected=null;state.impact=null;state.candidate=null;state.editorNotes.clear();state.suggestionScope='followup';activate('cases');
    }
   };
   document.dispatchEvent(new CustomEvent('morothon:correction-workspace-ready'));
   window.addEventListener('beforeunload',e=>{if(state.package?.cases.length){e.preventDefault();e.returnValue='';}});
  }catch(error){host.replaceChildren(node('p','Rettelser kunne ikke starte: '+error.message));}
 });
})();

/* Final results are a distinct annual workflow, never a start-list forecast. */
(() => {
 'use strict';
 const R=window.MorothonResults,C=window.MorothonCorrections,I=window.MorothonIntake,host=document.getElementById('view-import');if(!R||!C||!host)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;},$=id=>document.getElementById(id);
 const state={context:null,staged:null,source:null,session:null,analysis:null,decisions:new Map(),profileChoices:{},confirmedFields:[],fixedCourse:null,nameMode:'auto',manual:false,editing:false,store:R.layouts.empty(),matches:[],filter:'pending',page:0,busy:false,revision:0,coverageConfirmed:false,coverageControl:null};
 const groups={unchanged:'Uendrede – ingen handling',changed:'Endrede resultater – godkjenning',new:'Nye tellende resultater – behandling',identity:'Mulige personkonflikter – kontroll',dns:'Ikke startet (DNS) – ingen handling',relay:'Stafett – separat',source:'Andre uavklarte kildedata – kontroll'};
 const identityCategories=['uncertain','conflict'],sourceCategories=['missing','registration','unassessable'];
 const inIdentity=i=>identityCategories.includes(i.category)&&i.conflictType!=='source',inSource=i=>sourceCategories.includes(i.category)||i.category==='conflict'&&i.conflictType==='source';
 const groupCount=(a,key)=>key==='identity'?a.items.filter(inIdentity).length:key==='source'?a.items.filter(inSource).length:a.counts[key];
 const actionNames={confirm:'Bekreftet resultatvalg',new:'Markert ny person',reject:'Avvist / beholdt',defer:'Utsatt'};
 function status(text,bad=false){$('resultStatus').textContent=text;$('resultStatus').dataset.error=String(bad);}
 function button(label,fn,id){const b=node('button',label,'secondary');b.type='button';if(id)b.id=id;b.onclick=async()=>{if(state.busy)return;state.busy=true;b.disabled=true;try{await fn();}catch(e){status(e.message,true);}finally{state.busy=false;if(b.isConnected)b.disabled=false;}};return b;}
 function field(text,input){const e=node('label',text);e.append(input);return e;}
 function hint(text){return node('p',text,'hint');}
 function input(type,id,value=''){const e=node('input');e.type=type;e.id=id;e.value=value;return e;}
 function select(options,id,value){const e=node('select');if(id)e.id=id;for(const [key,label]of options){const o=node('option',label);o.value=key;e.append(o);}if(value!==undefined)e.value=value;return e;}
 function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function request(name,detail={}){return new Promise((resolve,reject)=>document.dispatchEvent(new CustomEvent(name,{detail:{...detail,resolve,reject}})));}
 function sourceChanged(previousSha){if(previousSha)document.dispatchEvent(new CustomEvent('morothon:result-source-changed',{detail:{previousSha}}));}
 function clearAnalysis(){state.revision++;if(state.session)sourceChanged(state.session.source.sha256);state.session=null;state.analysis=null;state.decisions.clear();state.page=0;$('resultSummary').replaceChildren();$('resultCases').replaceChildren();$('resultImpact').replaceChildren();$('resultQuestions').replaceChildren();$('resultStages').replaceChildren();$('resultPrivateConflicts')?.replaceChildren();$('resultActions').hidden=true;}
 function mapping(){return Object.fromEntries(Object.keys(R.fields).map(key=>[key,Number($('result-map-'+key).value)]));}
 function showMapping(){const box=$('resultMapping');box.replaceChildren();for(const [key,label]of Object.entries(R.fields)){const s=select([['-1','Ikke i filen'],...state.staged.headers.map((v,i)=>[String(i),v+' (kolonne '+(i+1)+')'])],'result-map-'+key,String(state.staged.mapping[key]));s.onchange=()=>{state.manual=true;state.confirmedFields.push(key);if(['event','distance','year'].includes(key)){state.profileChoices={};state.fixedCourse=null;}clearAnalysis();status('Feltvalget er endret. Bruk «Analyser på nytt» for å fortsette.');};box.append(field(label,s));}$('resultMappingDetails').hidden=false;}
 function setField(key,value){const index=Number(value);for(const other of Object.keys(R.fields))if(other!==key&&index>=0&&Number($('result-map-'+other).value)===index)$('result-map-'+other).value=-1;$('result-map-'+key).value=index;state.confirmedFields=[...new Set([...state.confirmedFields,key])];if(['event','distance','year'].includes(key)){state.profileChoices={};state.fixedCourse=null;}state.manual=true;}
 const storageKey=()=> 'morothon-import-layouts-v1:'+state.context.profileId;
 async function restoreLayouts(){try{const text=localStorage.getItem(storageKey());if(text)state.store=await R.layouts.parse(text);}catch{state.storageUnavailable=true;state.storageMessage='Lagrede oppsett kunne ikke leses. De er ikke endret. Du kan fortsatt analysere filer og bruke nedlastbare filoppsett.';}}
 function applyMatch(match){for(const [key,index]of Object.entries(match.mapping))$('result-map-'+key).value=index;state.profileChoices={...match.profileChoices};state.fixedCourse=match.fixedCourse;state.confirmedFields=Object.keys(R.fields);state.match=match;state.manual=false;$('resultTemplateInfo').textContent=match.origin==='device'?'Lagret filoppsett gjenkjent på denne enheten.':'Gjenkjent standardoppsett for resultat-CSV.';$('resultTemplateProvider').value=match.template.provider;}
 async function automatic(){if(!state.staged)return;clearAnalysis();state.manual=false;state.editing=false;state.fixedCourse=null;state.needFixed=false;state.profileChoices={};state.confirmedFields=[];state.nameMode='auto';state.match=null;showMapping();const inferred=R.inspect(state.context,state.staged,Number($('resultYear').value));if(inferred.suggestedYear)$('resultYear').value=inferred.suggestedYear;const revision=state.revision;state.matches=await R.layouts.match(state.context,state.staged,state.store,Number($('resultYear').value));if(revision!==state.revision)return;if(!state.matches.length)for(const [key,index]of Object.entries(R.resolveFields(state.context,state.staged,Number($('resultYear').value))))$('result-map-'+key).value=index;if(state.matches.length===1){const m=state.matches[0].mapping,years=m.year<0?[]:[...new Set(state.staged.records.map(r=>I.yearValue(r.cells[m.year])))];if(years.length===1&&years[0]>=1900&&years[0]!==Number($('resultYear').value)){$('resultYear').value=years[0];state.matches=await R.layouts.match(state.context,state.staged,state.store,years[0]);if(revision!==state.revision)return;}if(state.matches.length===1)applyMatch(state.matches[0]);}else $('resultTemplateInfo').textContent=state.matches.length?'Flere lagrede oppsett passer. Velg hvilket du vil bruke.':'Nytt filoppsett. Sikre felt tolkes automatisk.';await compare();}
 async function remember(){if(!state.staged)throw Error('Velg en resultatfil først.');const revision=state.revision,template=await R.layouts.capture(state.context,state.staged,mapping(),{year:Number($('resultYear').value),profileChoices:state.profileChoices,fixedCourse:state.fixedCourse,provider:$('resultTemplateProvider').value,confirmedFields:state.confirmedFields,nameMode:state.nameMode}),store=await R.layouts.remember(state.context,state.store,template);if(revision!==state.revision)throw Error('Filen eller valgene er endret. Kontroller filoppsettet på nytt.');state.store=store;let persistent=false;try{if(!state.storageUnavailable){localStorage.setItem(storageKey(),JSON.stringify(store));persistent=true;}}catch{state.storageUnavailable=true;}status(persistent?'Filoppsettet huskes på denne enheten. Ingen deltaker- eller resultatdata er lagret.':'Oppsettet er beholdt i denne fanen. Nettleseren tillater ikke varig lagring; last ned filoppsettet for å bevare det.');$('resultTemplateInfo').textContent=persistent?'Lokalt bekreftet filoppsett er lagret. Det er ikke publisert som en felles arrangørmal.':'Oppsettet kan lastes ned og åpnes igjen senere.';}
 function stages(inspection){
  const box=$('resultStages');box.replaceChildren();if(!state.staged)return;const a=state.analysis,rows=state.session?.rows||inspection?.rows||[],valid=rows.filter(r=>!r.errors.length&&!r.relay).length,paired=a?.items.filter(i=>i.before&&!i.blocking&&i.row).length||0,reviewed=a?.items.filter(i=>i.decision).length||0;
  for(const [title,text]of [['1. Filen er lest',state.staged.records.length+' rader'],['2. Resultater tolket',inspection&&!inspection.ready?'Venter på opplysninger':valid+' gyldige individuelle rader'],['3. Resultatpar kontrollert',paired+' støttede par · usikre koblinger vises som avvik'],['4. Din gjennomgang',reviewed+' vurderinger · rettingsforslag krever manuell godkjenning']]){const section=node('div');section.append(node('strong',title),hint(text));box.append(section);}
 }
 function questions(inspection){
  const box=$('resultQuestions');box.replaceChildren();
  if(state.matches.length>1&&!state.match){const choice=select([['','Velg filoppsett'],...state.matches.map((m,i)=>[String(i),(m.template.provider==='eqtiming'?'EQtiming':'Generelt oppsett')+' · resultatfelt: '+(state.staged.headers[m.mapping.time]||state.staged.headers[m.mapping.status]||'ikke valgt')]),['fresh','Gjenkjenn feltene på nytt']]);choice.dataset.resultLayoutChoice='';box.append(field('Flere lagrede filoppsett passer. Hvilket vil du bruke?',choice));choice.onchange=async()=>{try{if(choice.value==='fresh'){state.matches=[];state.editing=true;await compare();}else if(choice.value!==''){applyMatch(state.matches[Number(choice.value)]);await compare();}}catch(e){status(e.message,true);}};return;}
  const choices=[...inspection.choices];if(state.editing){const m=mapping(),keys=m.name<0&&(m.firstName>=0||m.lastName>=0)||state.nameMode==='split'?['firstName','lastName','event','time']:['name','event','time'];if(m.distance>=0)keys.push('distance');if(m.status>=0)keys.push('status');for(const key of keys)if(!choices.some(c=>c.key===key))choices.push({key,label:R.fields[key],options:state.staged.headers.flatMap((label,i)=>['time','status'].includes(key)&&!R.canContainFinish(label)?[]:[{value:String(i),label,example:state.staged.records.slice(0,3).map(r=>String(r.cells[i]||'').slice(0,40)).join(' · ')}])});}
  if(inspection.ready&&!choices.length&&!inspection.groups.length&&!state.needFixed)return;
  box.append(node('h3',state.editing?'Feltvalg for denne filen':'Vi trenger en avklaring'));
  for(const message of inspection.issues)box.append(node('p',message));
  const inputs=[];
  const courses=R.annualCourses(state.context,Number($('resultYear').value));
  for(const c of choices){if(c.key==='event'&&state.needFixed)continue;if(c.key==='time'&&!c.options.length)box.append(hint('Ingen aktuell resultatkolonne ble funnet. Starttid og plassering er ikke sluttresultater. En startliste uten resultat kan ikke sammenlignes som sluttresultater.'));const extra=[['-1','Filen har ikke dette feltet']];if(c.key==='name')extra.push(['split','Fornavn og etternavn står i hver sin kolonne']);if(c.key==='firstName')extra.push(['full','Hele navnet står i ett felt']);if(c.key==='event'&&courses.length)extra.push(['fixed','Velg én øvelse for hele filen']);const selected=Number($('result-map-'+c.key).value);const s=select([['','Velg felt'],...c.options.map(o=>[o.value,o.label+(o.example?' – '+o.example:'')]),...extra],undefined,c.key==='event'&&state.fixedCourse?'fixed':selected>=0?String(selected):state.confirmedFields.includes(c.key)?'-1':'');s.dataset.resultFieldChoice=c.key;box.append(field(c.label,s));inputs.push({s,key:c.key,type:'field'});}
  for(const g of (state.editing?inspection.allGroups:inspection.groups)){const s=select([['','Velg øvelse / løypelengde'],...g.options.map(o=>[o.value,o.label])],undefined,state.profileChoices[g.id]||'');s.dataset.resultCourseChoice=g.id;box.append(field(g.label,s));inputs.push({s,key:g.id,type:'course'});}
  if(state.needFixed||state.editing&&state.fixedCourse){const s=select([['','Velg øvelse'],...courses.map((c,i)=>[String(i),c.event+' · '+c.distance+' · '+c.year])],undefined,state.fixedCourse?String(courses.findIndex(c=>c.event===state.fixedCourse.event&&c.distance===state.fixedCourse.distance)):'');s.dataset.resultFixedCourse='';box.append(field('Hvilken øvelse gjelder alle resultatene?',s));inputs.push({s,type:'fixed'});}
  if(!inspection.ready&&!choices.some(c=>c.key==='time')&&inspection.issues.some(s=>s.includes('sluttid')))box.append(hint('Filen inneholder ikke et brukbart resultatfelt. Eksporter sluttresultater som CSV eller TSV; en startliste er ikke tilstrekkelig.'));
  async function answer({s,key,type}){if(!s.value)return;if(type==='field'){if(s.value==='split'){state.nameMode='split';setField('name','-1');}else if(s.value==='full'){state.nameMode='full';setField('firstName','-1');setField('lastName','-1');setField('name','-1');}else if(s.value==='fixed'){setField('event','-1');state.needFixed=true;}else setField(key,s.value);}else if(type==='course'){state.profileChoices[key]=s.value;state.manual=true;}else{const c=courses[Number(s.value)];state.fixedCourse={year:c.year,event:c.event,distance:c.distance};state.needFixed=false;state.manual=true;}
   clearAnalysis();await compare();
  }
  for(const i of inputs)i.s.onchange=()=>answer(i).catch(e=>status(e.message,true));
  if(inputs.length)box.append(hint('Valget brukes med én gang. Du kan endre det igjen uten å laste opp filen på nytt.'));
 }
 function preview(inspection){const box=$('resultPreview');box.replaceChildren();if(!state.staged)return;box.append(node('h3','Slik tolkes feltvalgene'));const wrap=node('div',undefined,'intake-table-wrap'),table=node('table'),head=node('tr');for(const title of ['Navn','Øvelse','Resultat'])head.append(node('th',title));table.append(head);const m=mapping(),cell=(r,k)=>m[k]<0?'':r.cells[m[k]]||'';for(const [i,record]of state.staged.records.slice(0,3).entries()){const r=inspection.rows[i],tr=node('tr');for(const v of [r?.name||cell(record,'name')||[cell(record,'firstName'),cell(record,'lastName')].filter(Boolean).join(' ')||'Ikke valgt',r?[r.event,r.distance].filter(Boolean).join(' · '):state.fixedCourse?.event||cell(record,'event')||cell(record,'distance')||'Ikke valgt',r?(r.time||r.status||'Mangler resultat'):cell(record,'time')||cell(record,'status')||'Ikke valgt'])tr.append(node('td',String(v).slice(0,200)));table.append(tr);}wrap.append(table);box.append(wrap);if(inspection.ready){const invalid=inspection.rows.filter(r=>r.errors.length).length;if(invalid)box.append(hint(invalid+' rader har mangler og vises som uavklarte. Gyldige rader sammenlignes videre.'));}}
 async function loadFile(file){
  if(file.size>I.MAX_BYTES||!/\.(csv|tsv|txt)$/i.test(file.name))throw Error('Dette formatet kan ikke leses her. Eksporter resultatlisten som CSV eller TSV på maksimalt 4 MB. XML og XLSX krever en egen importadapter.');
  const bytes=new Uint8Array(await file.arrayBuffer()),decoded=I.decode(bytes),staged=R.parse(decoded.text),sourceSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(state.source?.sourceSha256===sourceSha256){state.source.name=file.name;$('resultFileInfo').textContent=file.name+' · '+staged.records.length+' resultatlinjer · samme fil. Valg og lokale vurderinger er beholdt.';await compare();return;}
  clearAnalysis();state.coverageConfirmed=false;if(state.coverageControl)state.coverageControl.checked=false;$('resultFileTools').hidden=false;state.staged=staged;state.needFixed=false;state.editing=false;state.source={sourceSha256,encoding:decoded.encoding,name:file.name};
  $('resultFileInfo').textContent=file.name+' · '+staged.records.length+' resultatlinjer lest';$('resultTechnical').textContent='Tegnsett: '+decoded.encoding+' · format: '+staged.format+' · SHA-256: '+sourceSha256;
  await automatic();
 }
 async function compare(){
  if(!state.staged)throw Error('Velg en resultatfil først.');status('Analyserer øvelser og sammenligner med godkjent historikk …');const revision=++state.revision,options={year:Number($('resultYear').value),sourceSha256:state.source.sourceSha256,sourceScope:$('resultScope').value,meta:state.meta,completeClaim:state.coverageConfirmed,profileChoices:state.profileChoices,confirmedFields:state.confirmedFields,fixedCourse:state.fixedCourse,nameMode:state.nameMode},inspection=R.inspect(state.context,state.staged,options.year,{...options,mapping:mapping()});
  questions(inspection);stages(inspection);preview(inspection);$('resultRemember').disabled=!inspection.ready||!inspection.rows.some(r=>!r.errors.length&&!r.relay);if(!inspection.ready||state.matches.length>1&&!state.match){status(inspection.issues[0]||'Bekreft valgene over. De gjelder samlet for filen.',!!inspection.issues.length);return;}
  const session=await R.createSession(state.context,state.staged,mapping(),options);if(revision!==state.revision)return;
  if(state.session?.key!==session.key){if(state.session)sourceChanged(state.session.source.sha256);state.decisions.clear();state.filter='pending';state.page=0;}state.session=session;state.analysis=R.review(state.context,session,state.decisions);render();status(session.rows.some(r=>!r.errors.length&&!r.relay)?'Sammenligningen er klar. Uendrede resultater krever ingen gjennomgang. Vurder avvik før forslag klargjøres.':'Filen er lest, men ingen individuelle rader har tilstrekkelige resultatopplysninger. Kontroller feltvalgene over. Ingen retting kan klargjøres fra disse radene.',!session.rows.some(r=>!r.errors.length&&!r.relay));
 }
 function resultBox(title,row){const box=node('section',undefined,'result-values');box.append(node('h4',title));if(!row){box.append(hint('Ingen koblet registrering.'));return box;}const list=node('dl');for(const [key,index]of Object.entries(R.columns)){list.append(node('dt',R.fields[key]),node('dd',row[index]===null||row[index]===''?'Ikke registrert':String(row[index])));}box.append(list);return box;}
 function change(item,action,personId,targetIndex,reason){
   const auditReason=action==='confirm'&&!String(reason||'').trim()?'Arrangøren har kontrollert endringen mot den opplastede resultatfilen.':'';
   state.decisions=R.decide(state.context,state.session,state.decisions,item.id,{action,runnerId:personId,targetIndex,reason:String(reason||'').trim()||auditReason});
   state.analysis=R.review(state.context,state.session,state.decisions);$('resultImpact').replaceChildren();render();
   status('Vurderingen er registrert lokalt. '+state.analysis.pending+' saker gjenstår. Når gjennomgangen er ferdig, bruk samlet sluttkontroll nederst. Ingenting er publisert.');
  }
 async function confirmAnnualBatch(){
  const session=state.session,revision=state.revision,original=state.decisions,plan=R.bulkPlan(state.context,session,state.analysis);
  if(!plan.ready)throw Error(plan.problem);
  const accepted=window.confirm('Godkjenn '+plan.total+' kontrollerte endringer i '+plan.year+' samlet? '+plan.timeChanged+' sluttider og '+plan.placeOnly+' rene plasseringsendringer.'+(plan.manual?' '+plan.manual+' mer sammensatte rettelser blir liggende til manuell kontroll.':'')+' Startnummer og rangering er kontrollert. Beslutningene lagres bare i denne fanen – ingen publisering.');
  if(!accepted)return;
  status('Kontrollerer kildefil, plasseringer og resultatkoblinger på nytt …');
  const out=await R.confirmSafeBatch(state.context,session,original);
  if(revision!==state.revision||session!==state.session||original!==state.decisions)throw Error('Kilden eller arbeidslisten er endret under godkjenningen. Prøv igjen.');
  state.decisions=out.decisions;state.analysis=R.review(state.context,session,state.decisions);
  state.filter=out.summary.manual?'pending':'processed';state.page=0;$('resultImpact').replaceChildren();render();
  status(out.summary.total+' rettelser er bekreftet i ett valg: '+out.summary.timeChanged+' tidsendringer og '+out.summary.placeOnly+' rene plasseringsendringer.'+(out.summary.manual?' '+out.summary.manual+' mer sammensatte endringer gjenstår i listen for manuell kontroll.':'')+' Ingen resultatdata er publisert. Last ned kontrollrapporten eller overfør rettelsene til kontrollsentralen.');
 }
 function caseCard(item){
  const card=node('article',undefined,'result-case');card.dataset.resultId=item.id;const name=item.row?.name||state.context.model.person(item.before?.[1])?.n||'Eksisterende kilderegistrering',bib=item.row?.bib||item.before?.[9]||'';
  card.append(node('h3',name),hint((item.conflictType==='source'?'Kildekonflikt':R.labels[item.category])+(bib?' · startnummer '+bib:'')),node('p',item.reason));if(item.decision)card.append(hint(actionNames[item.decision.action]+' · '+item.decision.reason));
  if(item.row?.errors.length)card.append(node('p',item.row.errors.join(' '),'intake-error'));for(const warning of item.row?.warnings||[])card.append(hint(warning));if(item.limitation)card.append(node('p',item.limitation,'intake-notice'));
  const values=node('div',undefined,'result-comparison'),sourceRow=item.row?[item.row.year,'','','','','',null,'','','']:null;if(sourceRow)for(const [key,index]of Object.entries(R.columns))sourceRow[index]=item.row.present[key]?item.row[key]:key==='status'&&item.row.status?item.row.status+' (fra resultat)':'Ikke i eksport';values.append(resultBox('Historikken',item.before),resultBox('Ny kilde',sourceRow));card.append(values,hint('Felter som mangler i eksporten beholdes fra historikken. Status kan tolkes fra en gyldig sluttid eller resultatstatus. Likeverdige formater omskrives ikke.'));
  if(item.differences.length)card.append(hint('Endrede felt: '+item.differences.map(x=>x.label).join(', ')));
  if(item.category==='dns'||item.category==='unlinked'){if(item.category==='unlinked')card.append(hint('Avklar resultatet fra kildefilens linje '+item.relatedItemIds.map(id=>state.analysis.items.find(i=>i.id===id)?.row?.line).join(', ')+'. Dette telles ikke som en ekstra kontrollsak.'));return card;}
  if(item.newType)card.append(hint(item.newType==='result'?'Forslag til eksisterende løper – nytt resultat. Identiteten må bekreftes.':'Ny deltaker eller uavklart identitet. Ingen profil opprettes automatisk.'));
  if(item.category==='relay'){card.append(hint('Lagresultater beholdes i kontrollrapporten. Individuelle rettingsforslag støtter ikke lag eller etapper.'));return card;}
  if(item.category==='unchanged'&&!item.decision)return card;
  const reason=node('textarea');reason.rows=2;reason.maxLength=1000;reason.placeholder='Hvorfor er dette riktig? Oppgi kildegrunnlaget kort.';reason.value=item.decision?.reason||'';reason.setAttribute('aria-label','Begrunnelse for '+name);card.append(field('Din vurdering',reason));
  let personSelect,targetSelect,manualOptions;
  if(item.row&&!item.blocking){
   const initial=item.before?state.context.model.resolve(item.before[1]):item.candidates.length===1?item.candidates[0].id:'';
   const search=input('search','', '');search.removeAttribute('id');search.placeholder='Finn en annen eksisterende person';search.setAttribute('aria-label','Finn person for '+name);
   personSelect=select([['','Velg eksisterende person'],...item.candidates.map(p=>[p.id,p.name])],undefined,initial);personSelect.setAttribute('aria-label','Person for '+name);
   targetSelect=select([],undefined);targetSelect.setAttribute('aria-label','Resultat for '+name);
   function targets(){const id=personSelect.value,rows=state.context.model.data.results.flatMap((r,index)=>r[0]===state.session.source.year&&state.context.model.resolve(r[1])===id&&!state.context.rules.isRelayRace(r)?[[String(index),[r[0],r[2],r[3],r[5]||'uten tid',r[9]?'startnr. '+r[9]:''].filter(Boolean).join(' · ')]]:[]);const options=[['','Velg registrering'],...rows,['add','Ny resultatregistrering for denne personen']];targetSelect.replaceChildren(...options.map(([v,label])=>{const o=node('option',label);o.value=v;return o;}));if(item.beforeIndex!==null&&rows.some(([index])=>index===String(item.beforeIndex)))targetSelect.value=String(item.beforeIndex);else if(!rows.length&&item.newType==='result'&&id)targetSelect.value='add';}
   search.oninput=()=>{const q=I.fold(search.value);personSelect.replaceChildren(node('option','Velg eksisterende person'));personSelect.firstChild.value='';if(q.length>=2)for(const p of [...state.context.people.values()].filter(p=>p.names.some(n=>I.fold(n.name).includes(q))).slice(0,30)){const o=node('option',p.name);o.value=p.id;personSelect.append(o);}targets();};personSelect.onchange=targets;targets();
   const options=node('details');manualOptions=options;options.open=!item.before;options.append(node('summary','Kontroller eller velg en annen person/registrering'),field('Søk etter eksisterende løper',search),field('Person',personSelect),field('Registrering i valgt år',targetSelect));card.append(options);
  }
  const actions=node('div',undefined,'actions');if(personSelect){const confirm=button('Bekreft resultatkoblingen',()=>{if(!personSelect.value||!targetSelect.value)throw Error('Velg person og nøyaktig resultat, eller Ny resultatregistrering.');change(item,'confirm',personSelect.value,targetSelect.value==='add'?null:Number(targetSelect.value),reason.value);});confirm.dataset.resultConfirm='';manualOptions.append(confirm);
   const selected=()=>{if(!personSelect.value||!targetSelect.value)throw Error('Velg person og nøyaktig resultat, eller Ny resultatregistrering.');return {person:personSelect.value,target:targetSelect.value==='add'?null:Number(targetSelect.value)};};
   const approve=button('Bekreft rettelsen',()=>{const choice=selected();change(item,'confirm',choice.person,choice.target,reason.value);});
   approve.dataset.resultApprove='';actions.append(approve);
   const advanced=node('details');advanced.className='result-single-advanced';
   advanced.append(node('summary','Avansert: klargjør bare denne rettelsen'),hint('Kun ved særskilt behov. Dette gjør en tung enkeltvis konsekvenskontroll og åpner Resultatkontroll. Normalt bekrefter du rettelsen over og bruker samlet sluttkontroll.'));
   advanced.append(button('Klargjør denne enkeltrettelsen nå',async()=>{
    const choice=selected(),session=state.session,revision=state.revision;
    change(item,'confirm',choice.person,choice.target,reason.value);
    const p=await packet(),prepareCaseId='result-'+await C.hash([session.key,item.id]),entry=p.cases.find(c=>c.id===prepareCaseId);
    if(!entry?.change)throw Error('Avviket krever separat kontroll før en endring kan klargjøres. Det er beholdt som sak.');
    if(revision!==state.revision||session!==state.session)throw Error('Kildegrunnlaget er endret. Gjennomgå resultatet på nytt.');
    await request('morothon:results-corrections',{package:p,prepareCaseId});
   }));
   card.append(advanced);}
  if(item.row&&!item.blocking)actions.append(button('Marker som ny person',()=>change(item,'new',null,null,reason.value)));
  actions.append(button(item.category==='missing'?'Behold eksisterende resultat':'Avvis forslaget',()=>change(item,'reject',null,null,reason.value)),button('Utsett saken',()=>change(item,'defer',null,null,reason.value)));card.append(actions);return card;
 }
 function render(){
  const a=state.analysis;if(!a)return;const summary=$('resultSummary');summary.replaceChildren();summary.append(node('h3',a.read+' leste resultater · '+a.existing+' eksisterende individuelle registreringer'));
  const completeness={partial:'Delvis / uavstemt eksport: historiske registreringer mangler kobling.',uncertain:'Usikkert utvalg: fullstendighet kan ikke bekreftes.', 'apparent-complete':'Fremstår som komplett for bekreftet utvalg. Dette er ingen garanti fra kilden.'};summary.append(hint(completeness[a.completeness]));
  stages();
  const needBatch=a.items.some(i=>i.category==='changed'&&!i.decision);
  if(needBatch){
   const plan=R.bulkPlan(state.context,state.session,a),box=node('section',undefined,'result-bulk-review');
   box.id='resultBulkReview';box.append(node('h4','Samlet kontroll av årsresultater'));
    const coverage=field('Jeg har kontrollert at denne resultatfilen omfatter alle individuelle øvelser i '+state.session.source.year+'.',state.coverageControl);
    coverage.className='result-coverage-confirm';box.append(coverage,hint('Bekreft dette én gang per resultatfil før trygg samlet godkjenning. Delvise resultatlister må behandles enkeltvis.'));
    if(!state.coverageConfirmed)box.append(node('p','For å aktivere samleknappen: Kryss av bekreftelsen rett over.','result-coverage-warning'));
   if(plan.ready){box.append(hint(plan.timeChanged+' endrede sluttider · '+plan.placeOnly+' rene plasseringsendringer · '+plan.total+' sikre resultatendringer.'+(plan.manual?' '+plan.manual+' mer sammensatte endringer må kontrolleres separat.':'')+' Kildens kjønns-/distanserangering og eksisterende startnummer er kontrollert.'));
    box.append(button('Godkjenn '+plan.total+' sikre endringer samlet',confirmAnnualBatch,'resultBulkApprove'));}
   else box.append(hint('Samlet godkjenning er foreløpig sperret: '+plan.problem));
   box.append(hint('Andre avvik og nye personer kan ikke godkjennes automatisk. Ingen historikk oppdateres før separat autorisert publisering.'));summary.append(box);
  }
  const grid=node('div',undefined,'result-summary-grid');for(const [key,label]of Object.entries(groups)){const box=node('article');box.dataset.resultGroup=key;box.append(node('strong',String(groupCount(a,key))),node('span',label));grid.append(box);}const attention=node('p');attention.id='resultAttentionCount';attention.append(node('strong',a.pending+' saker trenger vurdering'));summary.append(grid,attention,hint('Uendrede resultater og vanlige DNS-registreringer krever ingen handling.'));if(a.counts.unlinked)summary.append(hint(a.counts.unlinked+' historiske registreringer inngår i en tilknyttet avklaring. De telles ikke som ekstra kontrollsaker.'));
  const box=$('resultCases');box.replaceChildren();const f=select([['pending','Ubehandlede avvik'],['all','Alle avvik'],['processed','Behandlede avvik'],...Object.entries(groups),['unlinked','Tilknyttet historikk – informasjon'],['missing','Mangler i ny kilde']],'resultFilter',state.filter);f.onchange=()=>{state.filter=f.value;state.page=0;render();};box.append(field('Vis',f));
  const rows=a.items.filter(i=>state.filter==='pending'?R.needsAttention(i):state.filter==='all'?i.category!=='unchanged':state.filter==='processed'?!!i.decision:state.filter==='identity'?inIdentity(i):state.filter==='source'?inSource(i):i.category===state.filter),size=10;state.page=Math.min(state.page,Math.max(0,Math.ceil(rows.length/size)-1));
  for(const item of rows.slice(state.page*size,(state.page+1)*size))box.append(caseCard(item));if(!rows.length)box.append(hint('Ingen saker i dette utvalget.'));
  const paging=node('div',undefined,'actions'),prev=button('Forrige saker',()=>{state.page--;render();}),next=button('Neste saker',()=>{state.page++;render();});prev.disabled=state.page===0;next.disabled=(state.page+1)*size>=rows.length;paging.append(prev,hint(rows.length+' saker · side '+(state.page+1)),next);box.append(paging);$('resultActions').hidden=false;
 }
 async function packet(){if(!state.session)throw Error('Start sammenligning først.');return R.prepare(state.context,state.session,state.decisions);}
 function privateControls(){
  const available=window.MorothonReviewClient?.resultImportAvailable===true,b=$('resultPrivateSave');
  if(b){b.hidden=!available;b.disabled=state.busy||window.MorothonReviewClient?.resultImportBusy===true;}
  if($('resultTransfer'))$('resultTransfer').hidden=available;
 }
 document.addEventListener('morothon:result-service-state',privateControls);
 async function savePrivateImport(replaceBasis=null){
  if(state.analysis.pending)throw Error(state.analysis.pending+' saker trenger fortsatt behandling. Bekreft, avvis eller utsett dem først.');
  const revision=state.revision,session=state.session,decisions=state.decisions,p=await packet(),
    isCurrent=()=>revision===state.revision&&session===state.session&&decisions===state.decisions;
  if(!isCurrent())throw Error('Importgrunnlaget er endret. Kontroller det på nytt.');
  const conflicts=$('resultPrivateConflicts');conflicts.replaceChildren();
  status('Lagrer de gjennomgåtte rettelsene privat og kjører samlet kontroll …');
  try{
   const result=await request('morothon:save-result-import',{package:p,replaceBasis,isCurrent});
   if(!isCurrent())return;
   const link=node('a','Åpne lagret før/etter og godkjenn publisering');link.href='#rettelser';
   conflicts.append(hint('Lagret privat. Offentlige resultater er uendret.'),link);
   status(result.ready?(result.changed?'Rettingene er lagret privat og kontrollert.':'Samme rettelser er allerede lagret; ingen duplikater opprettet.')+
    (result.restored?' Åpne resultatkontrollen for særskilt godkjenning.':' Hent lagret utkast i Resultatkontroll; annet arbeid i fanen er beholdt.'):
    'Rettingene er lagret privat, men kontrollen krever avklaring. '+(result.problem||'Åpne Resultatkontroll for detaljer.'),!result.ready);
  }catch(error){
   if(isCurrent()&&error.importConflict){
    const basis=error.importConflict;
    conflicts.append(node('h4','Ny fil eller lagret forslag?'),hint('Ingenting er overskrevet. Du kan beholde det lagrede utkastet, eller erstatte bare forslagene nedenfor. Andre private saker beholdes.'));
    for(const c of basis.conflicts){
     const card=node('article',undefined,'correction-case');
     card.append(node('strong',(state.context.model.person(c.personIds[0])?.n||'Resultat')+' · '+c.before[0]+' · '+c.before[2]));
     for(const [label,row]of [['Lagret privat · '+(C.labels[c.privateStatus]||'Til vurdering'),c.privateAfter],['Fra ny fil',c.importedAfter]])
      card.append(hint(label+': '+(row?R.differences(c.before,row).map(d=>d.label+' '+d.before+' → '+d.after).join(' · '):'Ingen foreslått retting')));
     conflicts.append(card);
    }
    const choices=node('div',undefined,'actions');
    choices.append(button('Behold lagrede forslag',()=>{conflicts.replaceChildren();status('Det lagrede private utkastet er beholdt. Ingen publisering.');},'resultKeepPrivate'),
     button('Erstatt '+basis.conflicts.length+' private forslag med ny fil',()=>savePrivateImport(basis),'resultReplacePrivate'));conflicts.append(choices);
   }
   throw error;
  }
 }
 async function consequences(){
  const revision=state.revision,p=await packet(),cases=p.cases.filter(c=>c.change);if(!cases.length)throw Error('Bekreft minst ett konkret resultatavvik først. Nye personer, lag og ukjente årganger krever separat behandling.');
  status('Beregner med eksisterende resultat-, merke- og diplommotor …');const project=await request('morothon:request-result-projection'),out=$('resultImpact');out.replaceChildren();
  const names={people:'Deltakelser, fullføringer, distanser, beste tider og merker',annual:'Årsstatistikk, distansefordeling og milepæler',records:'Løyperekorder',placements:'Beregnede plasseringer',rankings:'Adelskalender',diplomas:'Historiske løperdiplomer',loyalty:'Lojalitet',redirects:'Personkoblinger',aliases:'Aliaser'};
  for(const c of cases){const impact=await C.consequences(state.context.model.data,p,c.id,state.session.base,project,{linkedRunnerIds:state.linkedRunnerIds});if(revision!==state.revision)return;const section=node('section',undefined,'correction-impact');section.append(node('h3',c.description));for(const x of impact.changes.filter(x=>x.status==='changed')){
    const details=node('details');details.append(node('summary',names[x.area]+' – endres'));
    if(x.area==='placements'){const changed=x.after.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(x.before[i]));details.append(hint(changed.length+' registreringer påvirkes. Kildeplasseringer beholdes med mindre en kildebasert retting er uttrykkelig foreslått.'));for(const row of changed.slice(0,25))details.append(hint((state.context.model.person(row.personId)?.n||'Kilderegistrering')+' · '+row.year+' · '+row.event+' '+row.distance+' · beregnet '+(x.before[row.index]?.rank??'–')+' → '+(row.rank??'–')+' · kilde '+(row.sourcePlace??'–')));}
    else if(x.area==='annual'){
     for(const year of Object.keys(x.after))if(JSON.stringify(x.before[year])!==JSON.stringify(x.after[year])){const before=x.before[year],after=x.after[year];details.append(node('h4',year));for(const [key,label]of [['participants','Deltakere'],['debutants','Debutanter']])if((before?.[key].length??0)!==after[key].length)details.append(hint(label+': '+(before?.[key].length??0)+' → '+after[key].length));for(const key of new Set([...Object.keys(before?.distribution||{}),...Object.keys(after.distribution||{})]))if((before?.distribution?.[key]||0)!==(after.distribution?.[key]||0))details.append(hint('Distansefordeling: '+key+' · '+(before?.distribution?.[key]||0)+' → '+(after.distribution?.[key]||0)+' registreringer'));if(JSON.stringify(before?.badges)!==JSON.stringify(after.badges))details.append(hint('Årets deltakelsesmerker: '+(before?.badges.reduce((n,g)=>n+g.people.length,0)||0)+' → '+after.badges.reduce((n,g)=>n+g.people.length,0)));}
    }else if(x.area==='people'){
     for(const [id,after]of Object.entries(x.after))if(JSON.stringify(after)!==JSON.stringify(x.before[id])){const before=x.before[id];details.append(node('h4',after.name));for(const [a,b,label]of [[before?.count||0,after.count,'Deltakelsesår'],[before?.totals?.completed||0,after.totals?.completed||0,'Fullføringer'],[before?.totals?.km||0,after.totals?.km||0,'Fullførte kilometer']])if(a!==b)details.append(hint(label+': '+a+' → '+b));if(JSON.stringify(before?.best)!==JSON.stringify(after.best))details.append(hint('Beste tider: '+(before?.best||[]).map(b=>b.event+' '+b.km+' km '+b.time).join(' / ')+' → '+after.best.map(b=>b.event+' '+b.km+' km '+b.time).join(' / ')));if(JSON.stringify(before?.badges)!==JSON.stringify(after.badges))details.append(hint('Deltakelsesmerker: '+(before?.badges||[]).map(b=>b.id.replace('badge-','')+' ('+b.year+')').join(', ')+' → '+after.badges.map(b=>b.id.replace('badge-','')+' ('+b.year+')').join(', ')));}
    }else if(x.area==='records'){
     const keys=new Set([...x.before,...x.after].map(r=>r.event+' · '+r.gender));for(const key of keys){const a=x.before.filter(r=>r.event+' · '+r.gender===key),b=x.after.filter(r=>r.event+' · '+r.gender===key);if(JSON.stringify(a)!==JSON.stringify(b))details.append(hint(key+': '+(a.map(r=>r.name+' '+r.time+' ('+r.year+')').join(' / ')||'Ingen registrert')+' → '+(b.map(r=>r.name+' '+r.time+' ('+r.year+')').join(' / ')||'Ingen registrert')));}
    }else details.append(hint(x.area==='diplomas'?'Endret diplomgrunnlag krever separat innholdsgodkjenning før ren utskrift.':'Dette området har reelle endringer. Se full før-/etter-kontroll i Resultatkontroll.'));
    section.append(details);
   }if(!impact.changes.some(x=>x.status==='changed'))section.append(hint('Ingen beregnede konsekvenser utover kildefeltene.'));for(const message of [...impact.uncertain,...impact.errors.map(e=>e.code)])section.append(node('p',message,'intake-notice'));out.append(section);
  }status('Konsekvenser er forhåndsvist. Ingen publisering eller diplomgodkjenning er utført.');
 }
 document.addEventListener('morothon:corrections-ready',async e=>{
  try{
   Object.assign(state,e.detail);await C.binding(state.history,state.meta);
   const start=node('div');start.id='annualStartlist';start.append(...host.childNodes);const mode=select([['startlist','Før konkurransen – startliste og merkeprognose'],['results','Etter konkurransen – importer endelige resultater'],['corrections','Historiske resultater – korriger uten ny fil']],'annualImportKind','startlist'),work=node('section');work.id='annualResults';work.hidden=true;
   const modeBox=node('div',undefined,'annual-mode');modeBox.append(field('Hva vil du gjøre?',mode));mode.onchange=()=>{start.hidden=mode.value!=='startlist';work.hidden=mode.value!=='results';corrections.hidden=mode.value!=='corrections';};document.querySelectorAll('a[data-annual-mode]').forEach(link=>link.addEventListener('click',()=>{const next=link.dataset.annualMode;if([...mode.options].some(o=>o.value===next)){mode.value=next;mode.dispatchEvent(new Event('change'));}}));const corrections=node('section');corrections.hidden=true;corrections.className='panel';corrections.append(node('h2','Korriger eksisterende resultater'),node('p','Søk opp registrerte personer og resultater i den eksisterende korrigeringsmotoren. Du trenger ikke laste opp en ny resultatfil. Lagre og godkjenn endringer separat; ingen resultater publiseres automatisk.'));const correctionLink=node('a','Åpne resultatkontroll og rettelser');correctionLink.href='#rettelser';corrections.append(correctionLink);host.append(modeBox,start,work,corrections);
   const banner=node('div',undefined,'intake-banner');banner.append(node('span','SAMMENLIGN FØR ENDRING','eyebrow'),node('h2','Endelige resultater'),node('p','Last opp resultatfilen, vurder avvik og klargjør rettingsforslag. Historikken endres ikke her.'));
   const reanalyze=async()=>{clearAnalysis();if(state.staged)try{await compare();}catch(error){status(error.message,true);}};
   const year=input('number','resultYear',state.context.latestYear);year.min=1900;year.max=9999;year.onchange=()=>{state.profileChoices={};state.fixedCourse=null;state.coverageConfirmed=false;if(state.coverageControl)state.coverageControl.checked=false;return reanalyze();};
   const complete=input('checkbox','resultComplete');state.coverageControl=complete;complete.onchange=()=>{state.coverageConfirmed=complete.checked;return reanalyze();};const scope=input('text','resultScope','delimited-results-v1');scope.maxLength=100;scope.onchange=reanalyze;
   const settings=node('div',undefined,'result-settings');settings.append(field('Arrangementsår',year));
   const advanced=node('details');advanced.id='resultAdvanced';const technical=hint('');technical.id='resultTechnical';advanced.append(node('summary','Avanserte valg'),field('Kildeområde for eventuelle dokumenterte eksterne ID-er',scope),technical,hint('Samme eksterne ID hos ulike leverandører betyr ikke samme person. Nye personer, lagrettinger og opprettelse av en ny årgang krever separat autorisert behandling.'));
   const file=input('file','resultFile');file.disabled=true;file.accept='.csv,.tsv,.txt,text/csv';file.onchange=async()=>{const selected=file.files[0];if(!selected)return;file.disabled=true;$('resultCompare').disabled=true;try{await loadFile(selected);}catch(error){status(error.message+(state.analysis?' Forrige gyldige analyse er beholdt.':' Ingen analyse er klargjort.'),true);}finally{file.disabled=false;file.value='';$('resultCompare').disabled=!state.staged;}};
   const fileInfo=node('p');fileInfo.id='resultFileInfo';const mapping=node('details');mapping.id='resultMappingDetails';mapping.hidden=true;mapping.append(node('summary','Kontroller eller korriger kolonnekoblinger'));const map=node('div',undefined,'intake-mapping');map.id='resultMapping';mapping.append(map);
   const compareButton=button('Analyser på nytt',compare,'resultCompare');compareButton.disabled=true;advanced.append(mapping);const statusNode=node('p');statusNode.id='resultStatus';statusNode.setAttribute('role','status');
   const questionsBox=node('section',undefined,'result-questions');questionsBox.id='resultQuestions';const stagesBox=node('section',undefined,'result-stages');stagesBox.id='resultStages';stagesBox.setAttribute('aria-label','Fra fil til manuell godkjenning');
   const previewBox=node('section',undefined,'result-preview');previewBox.id='resultPreview';const templateInfo=hint('');templateInfo.id='resultTemplateInfo';
   const fileTools=node('div',undefined,'actions result-file-tools');fileTools.id='resultFileTools';fileTools.hidden=true;fileTools.append(compareButton,button('Endre feltvalg',async()=>{if(!state.staged)throw Error('Velg en fil først.');state.matches=[];state.editing=true;await compare();},'resultEditFields'),button('Bruk automatisk gjenkjenning',automatic,'resultAutomatic'));
   const templatePanel=node('details');templatePanel.id='resultTemplates';templatePanel.append(node('summary','Filoppsett for senere bruk'),hint('Bekreftede oppsett huskes på denne enheten. Bare struktur og tolkningsregler lagres, aldri navn, tider eller andre deltakervalg. En lokal mal er ikke publisert som felles arrangørgodkjent oppsett.'));
   const provider=select([['generic','Generelt / ukjent leverandør'],['eqtiming','EQtiming']],'resultTemplateProvider','generic'),rememberButton=button('Husk dette filoppsettet',remember,'resultRemember');rememberButton.disabled=true;
   const layoutFile=input('file','resultLayoutImport');layoutFile.accept='.json,application/json';layoutFile.onchange=async()=>{try{const f=layoutFile.files[0];if(!f)return;if(f.size>R.layouts.MAX_BYTES)throw Error('Velg et filoppsett på maksimalt 128 KB.');const incoming=await R.layouts.parse(await f.text());let next=state.store;for(const template of incoming.templates)next=await R.layouts.remember(state.context,next,template);if(!window.confirm('Vil du bekrefte disse '+incoming.templates.length+' filoppsettene på denne enheten? Dette godkjenner bare feltvalg, ingen resultater eller personkoblinger.'))return;state.store=next;try{if(!state.storageUnavailable)localStorage.setItem(storageKey(),JSON.stringify(next));}catch{state.storageUnavailable=true;}if(state.staged)await automatic();status('Filoppsettene er åpnet som lokal konfigurasjon. Ingen resultater er lastet inn fra malfilen.');}catch(error){status(error.message,true);}finally{layoutFile.value='';}};
   fileTools.append(rememberButton);templatePanel.append(field('Leverandør for oppsettet',provider),button('Last ned filoppsett',async()=>{await R.layouts.validate(state.store);if(!state.store.templates.length)throw Error('Bekreft et oppsett med «Husk dette filoppsettet» først.');download(JSON.stringify(state.store,null,2)+'\n','morothon-filoppsett-v1.json');},'resultLayoutExport'),field('Åpne filoppsett fra en annen enhet',layoutFile));
   const summary=node('section');summary.id='resultSummary';const cases=node('section');cases.id='resultCases';const impact=node('section');impact.id='resultImpact';const actions=node('section',undefined,'result-actions');actions.id='resultActions';actions.hidden=true;
   actions.append(node('h3','Gjennomgang ferdig'),hint('Når alle avvik er behandlet, utfører vi én samlet kontroll. Du skal ikke måtte bekrefte de samme resultatendringene på nytt. Bare uttrykkelige beslutninger overføres; manglende rader slettes aldri.'),button('Forhåndsvis konsekvenser',consequences,'resultCheck'),button('Gjennomgang ferdig – kontroller alle rettelser samlet',async()=>{
     if(state.analysis.pending)throw Error(state.analysis.pending+' saker trenger fortsatt behandling. Bekreft eller avvis dem før samlet sluttkontroll.');
     const revision=state.revision,session=state.session,decisions=state.decisions;
     status('Kontrollerer alle godkjente rettelser samlet. Denne beregningen kan ta litt tid …');
     const p=await packet();if(!p.cases.some(c=>c.change))throw Error('Ingen konkrete resultatendringer er godkjent ennå.');
     if(revision!==state.revision||session!==state.session||decisions!==state.decisions)throw Error('Kilden eller vurderingene ble endret. Start samlet kontroll på nytt.');
     const result=await request('morothon:results-corrections',{package:p,stayOnImport:true});
     status(result.review?.ready?
      'Samlet forhåndskontroll bestått for '+result.review.proposed+' endringsforslag. Ingen ekstra bekreftelser per løper. Lagre arbeidsgrunnlaget i Resultatkontroll. Ingenting er publisert.':
      'Samlet kontroll har registrert forslagene, men krever nærmere avklaring: '+[...(result.review?.uncertain||[]),...(result.review?.errors||[]).map(e=>String(e.code||e))].join(' '),!result.review?.ready);
    },'resultTransfer'),button('Last ned rettingspakke',async()=>download(C.serialize(await packet()),'morothon-'+state.session.source.year+'-resultatrettinger.json'),'resultExport'),button('Last ned kontrollrapport',async()=>download(await R.report(state.context,state.session,state.decisions),'morothon-'+state.session.source.year+'-resultatkontroll.json'),'resultReport'));
   const privateSave=button('Lagre og kontroller rettelsene privat',()=>savePrivateImport(),'resultPrivateSave');privateSave.hidden=true;
   const privateConflicts=node('section');privateConflicts.id='resultPrivateConflicts';privateConflicts.setAttribute('aria-live','polite');actions.insertBefore(privateSave,$('resultCheck'));actions.append(privateConflicts);privateControls();
   work.append(banner,hint('CSV og TSV fra ulike resultatleverandører · selve filen behandles i nettleseren. I beskyttet admin kan gjennomgåtte rettingsforslag lagres privat. Ingen automatisk endring av historikken.'),settings,field('Velg endelig resultatfil',file),fileInfo,templateInfo,fileTools,statusNode,questionsBox,previewBox,stagesBox,summary,cases,templatePanel,advanced,actions,impact);
   await restoreLayouts();file.disabled=false;if(state.storageMessage)templateInfo.textContent=state.storageMessage;
   window.addEventListener('beforeunload',event=>{if(state.session){event.preventDefault();event.returnValue='';}});
  }catch(error){host.append(node('p','Resultatkontrollen kunne ikke starte: '+error.message));}
 });
})();
