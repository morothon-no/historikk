/* Browser-only design workspace. Saved packages are drafts, never authorizations. */
(() => {
  'use strict';
  const M = window.MorothonDesignDraft, host = document.getElementById('view-design');
  if (!host) return;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const $ = id => document.getElementById(id);
  const state = {draft:null,baseline:null,history:[],tab:'profile',series:0,source:'example',sequence:0,dirty:false};
  const root = window.MorothonAdminTransport?.rootUrl || new URL('/site/', location.href);
  let registry, activeProfile, builtinIds, base, motorPromise, timer;
  function button(label, action, cls='secondary') { const b=el('button',label,cls);b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(error);return b; }
  function note(text) { return el('p',text,'hint'); }
  function error(e) { $('studioStatus').textContent=e.message||String(e);$('studioStatus').dataset.error='true'; }
  function tell(message) { $('studioStatus').textContent=message;delete $('studioStatus').dataset.error; }
  function snap() { const d=M.clone({...state.draft,assets:[]});d.assets=state.draft.assets.slice();return d; }
  function checkpoint() { state.history.push(snap());if(state.history.length>15)state.history.shift();state.dirty=true; }
  function validate() { return M.validate(state.draft,builtinIds); }
  function changed(rebuild=false) {
    try { validate();$('studioExport').disabled=false;tell('Gyldig designutkast · ikke publisert eller godkjent for trykk.');if(rebuild)controls();previews(); }
    catch(e){clearTimeout(timer);++state.sequence;$('studioExport').disabled=true;error(e);$('studioLayout').textContent='Ugyldig utkast. Forhåndsvisningen viser siste gyldige innhold.';}
    $('studioUndo').disabled=!state.history.length;
  }
  function update(action,rebuild=false) { checkpoint();action();changed(rebuild); }
  function transaction(action) { const before=snap();checkpoint();try{action();validate();changed(true);}catch(e){state.draft=before;state.history.pop();error(e);} }
  function pathGet(path) { return path.split('.').reduce((o,k)=>o[k],state.draft); }
  function pathSet(path,value) { const parts=path.split('.'),key=parts.pop();parts.reduce((o,k)=>o[k],state.draft)[key]=value; }
  function field(path,label,type='text',options) {
    const wrap=el('label',label), input=el(options?'select':type==='textarea'?'textarea':'input');input.id='studio-'+path.replaceAll('.','-');input.dataset.path=path;
    if(options)for(const [value,text]of options){const o=el('option',text);o.value=value;input.append(o);}
    else if(type!=='textarea')input.type=type;
    if(type==='checkbox')input.checked=pathGet(path);else input.value=pathGet(path)??'';
    if(type==='text')input.maxLength=path.endsWith('body')?340:300;
    if(type==='number'){input.min='1';input.max='10000';}
    input.addEventListener(options||type==='checkbox'||type==='date'?'change':'input',()=>update(()=>{const previous=pathGet(path);pathSet(path,type==='checkbox'?input.checked:type==='number'?+input.value:path==='diploma.backgroundRef'&&!input.value?null:input.value);if(/^series\.\d+\.id$/.test(path)&&state.draft.diploma.seriesId===previous)state.draft.diploma.seriesId=input.value;if(/^series\.\d+\.badges\.\d+\.id$/.test(path)&&state.draft.diploma.badgeId===previous)state.draft.diploma.badgeId=input.value;if(path.endsWith('.active')||path.endsWith('.onDiploma'))fixSelection();}));
    wrap.append(input);return wrap;
  }
  const fonts=[['sans','Ren sans serif'],['serif','Klassisk serif']];
  function imageOptions(role) { return [...registry.badges.filter(b=>role==='badge'||b.id===activeProfile.logoAssetId).map(b=>['builtin:'+b.id,b.name+' · Morothon-original']),...state.draft.assets.filter(a=>a.role===role).map(a=>[a.id,a.id+' · eget bilde'])]; }
  function src(ref) { if(ref.startsWith('builtin:'))return new URL(registry.badges.find(b=>b.id===ref.slice(8)).src,root).href;const a=state.draft.assets.find(a=>a.id===ref);return 'data:'+a.mediaType+';base64,'+a.base64; }
  async function dimensions(blob) { const image=await createImageBitmap(blob);try{return {width:image.width,height:image.height};}finally{image.close();} }
  function upload(role,assign,label) {
    const wrap=el('label',label),input=el('input');input.type='file';input.accept='image/png,image/webp';input.dataset.upload=role;
    input.onchange=async()=>{const file=input.files[0];if(!file)return;input.disabled=true;
      try{if(file.size>M.MAX_IMAGE)throw Error('Bildet kan være maksimalt 4 MB.');const bytes=new Uint8Array(await file.arrayBuffer()),a=await M.inspectImage(bytes,file.type,dimensions);a.id=role+'-'+a.sha256.slice(0,16);a.role=role;
        transaction(()=>{if(!state.draft.assets.some(v=>v.id===a.id))state.draft.assets.push(a);assign(a.id);});
      }catch(e){error(e);}finally{input.disabled=false;input.value='';}
    };wrap.append(input);return wrap;
  }
  function group(title,children) { const s=el('fieldset'),l=el('legend',title);s.append(l,...children);return s; }
  function sectionHeading(title,detail) { const n=el('div',undefined,'studio-section-heading');n.append(el('h2',title),note(detail));return n; }
  function profileControls(box) {
    box.append(sectionHeading('Din arrangementsprofil','Bare utkastet til høyre endres. Den aktive Morothon-profilen er urørt.'));
    const presets=el('div',undefined,'actions');for(const [name,colors] of [['Morothon',['#123b41','#28554f','#f3f3ed','#143b43']],['Fjordblå',['#234f74','#357c82','#f0f6fa','#153746']],['Kveldsløp',['#412e56','#705072','#faf4ee','#30253d']]])presets.append(button(name,()=>update(()=>{Object.keys(state.draft.profile.colors).forEach((k,i)=>state.draft.profile.colors[k]=colors[i]);},true)));
    box.append(group('Ferdige fargeprofiler',[presets]));
    box.append(group('Navn og fortelling',[field('profile.name','Arrangementsnavn'),field('profile.tagline','Slagord'),field('profile.description','Kort beskrivelse','textarea'),field('profile.header','Topptekst')]));
    box.append(group('Visuell profil',[field('profile.logoRef','Logo','text',imageOptions('logo')),upload('logo',id=>state.draft.profile.logoRef=id,'Velg egen logo (PNG/WebP)'),...Object.keys(state.draft.profile.colors).map((k,i)=>field('profile.colors.'+k,['Hovedfarge','Sekundærfarge','Bakgrunnsfarge','Tekstfarge'][i],'color')),field('profile.font','Font','text',fonts)]));
    box.append(group('Distanser',state.draft.profile.distances.flatMap((r,i)=>[field('profile.distances.'+i+'.name','Distanse '+(i+1)+' – navn'),field('profile.distances.'+i+'.km','Kilometer','number')])));
    box.append(group('Moduler i illustrert offentlig løsning',M.modules.map((key,i)=>field('profile.modules.'+key,['Oversikt','Deltakere','Merker','Diplomer','Import','Premier'][i],'checkbox'))));
  }
  function selectSeries(box) {
    const label=el('label','Merkeserie'),select=el('select');select.id='studioSeries';state.draft.series.forEach((s,i)=>{const o=el('option',s.name);o.value=i;select.append(o);});select.value=state.series;select.onchange=()=>{state.series=+select.value;controls();previews();};label.append(select);box.append(label);
    const actions=el('div',undefined,'actions');actions.append(button('Ny merkeserie',()=>transaction(()=>{const id='serie-'+crypto.randomUUID().slice(0,8);state.draft.series.push({...M.seriesExample(true),id,name:'Ny merkeserie',badges:M.seriesExample(true).badges.map((b,i)=>({...b,id:id+'-'+i}))});state.series=state.draft.series.length-1;})),button('Fjern serie',()=>transaction(()=>{if(state.draft.series.length===1)throw Error('Behold minst én merkeserie.');state.draft.series.splice(state.series,1);state.series=0;fixSelection();})));
    box.append(actions);
  }
  function fixSelection() {
    const t=state.draft.diploma,s=state.draft.series.find(s=>s.id===t.seriesId),b=s?.badges.find(b=>b.id===t.badgeId&&b.active&&b.onDiploma);
    if(!b){const series=state.draft.series.find(s=>s.badges.some(b=>b.active&&b.onDiploma));if(series){t.seriesId=series.id;t.badgeId=series.badges.filter(b=>b.active&&b.onDiploma).at(-1).id;}}
  }
  function badgeControls(box) {
    box.append(sectionHeading('Mine merker','Egne terskler og motiver. Ingen merker tildeles eller aktiveres i resultatmotoren.'));selectSeries(box);
    const index=state.series,s=state.draft.series[index],prefix='series.'+index;
    box.append(group('Opptjeningsgrunnlag',[field(prefix+'.id','Serie-ID'),field(prefix+'.name','Serienavn')]));
    const basis=el('label','Hva belønnes?'),select=el('select');select.id='studioBasis';for(const [value,label]of [['participation','Løpsdeltakelse'],['completion','Fullføring'],['service','Dugnadsinnsats'],['special','Særutmerkelse']]){const o=el('option',label);o.value=value;select.append(o);}select.value=s.basis;select.onchange=()=>update(()=>{s.basis=select.value;s.rule={participation:'participated-year',completion:'finished-year',service:'service-year',special:'manual-approval'}[s.basis];s.unit=s.basis==='special'?'manual':'editions';},true);basis.append(select);box.append(basis);
    box.append(field(prefix+'.unit','Tellenhet','text',s.basis==='special'?[['manual','Manuell godkjenning']]:[['editions','Unike kvalifiserte utgaver'],['starts','Enkeltstarter (ikke operativ)']]));
    box.append(note('Eksplisitt regel: '+{ 'participated-year':'Ett år teller maksimalt én gang. DNS teller ikke, DNF teller.', 'finished-year':'Bare fullførte løp. DNS, DNF og diskvalifikasjon kvalifiserer ikke.', 'service-year':'Dugnadsutgaver holdes helt adskilt fra løpsdeltakelser.', 'manual-approval':'Krever en særskilt manuell avgjørelse; aldri automatisk tildeling.' }[s.rule]));
    const help=el('p',M.ruleStatus(s),'studio-notice');help.id='studioRuleStatus';box.append(help);
    for(let i=0;i<s.badges.length;i++){
      const b=s.badges[i],p=prefix+'.badges.'+i,controls=el('div',undefined,'actions');
      controls.append(button('Kopier '+b.name,()=>transaction(()=>{const next=s.badges[i+1];if(next&&next.threshold-b.threshold<2)throw Error('Lag plass mellom tersklene før kopiering.');const threshold=next?Math.floor((b.threshold+next.threshold)/2):b.threshold+1;s.badges.splice(i+1,0,{...b,id:b.id+'-'+crypto.randomUUID().slice(0,5),name:b.name+' kopi',threshold});})),button('Flytt tidligere',()=>transaction(()=>moveBadge(s,i,-1))),button('Flytt senere',()=>transaction(()=>moveBadge(s,i,1))),button('Fjern '+b.name,()=>transaction(()=>{if(s.badges.length===1)throw Error('Behold minst ett merke i serien.');s.badges.splice(i,1);fixSelection();})));
      const detail=el('details',undefined,'studio-badge-editor'),summary=el('summary',b.name+' · '+b.threshold);summary.dataset.badgeSummary=i;detail.open=i===0;detail.append(summary,group('Merke '+(i+1),[field(p+'.id','Merke-ID'),field(p+'.name','Merkenavn'),field(p+'.description','Beskrivelse','textarea'),field(p+'.threshold','Krav – antall kvalifiserte utgaver','number'),field(p+'.color','Merkefarge','color'),field(p+'.assetRef','Merkemotiv','text',imageOptions('badge')),upload('badge',id=>b.assetRef=id,'Velg eget merkebilde (PNG/WebP)'),field(p+'.active','Aktivt i utkastet','checkbox'),field(p+'.onDiploma','Kan vises på diplom','checkbox'),controls]));box.append(detail);
    }
    box.append(button('Legg til merke',()=>transaction(()=>{const n=s.badges.at(-1).threshold+1;s.badges.push({id:'nytt-'+crypto.randomUUID().slice(0,8),name:'Nytt merke',description:'',threshold:n,color:'#347a80',assetRef:'builtin:'+activeProfile.logoAssetId,active:true,onDiploma:true});})));
    box.append(note('Rekkefølgen er hierarkiet. Ved flytting bytter merkene terskelplass; tersklene forblir stigende. Dette påvirker bare utkastet.'));
  }
  function moveBadge(s,i,dir) { const j=i+dir;if(j<0||j>=s.badges.length)throw Error('Merket er allerede ytterst.');const a=s.badges[i].threshold,b=s.badges[j].threshold;[s.badges[i],s.badges[j]]=[s.badges[j],s.badges[i]];s.badges[i].threshold=a;s.badges[j].threshold=b; }
  function diplomaControls(box) {
    box.append(sectionHeading('Diplomdesigner','Samme A4-struktur og layoutkontroll. Eget design er alltid et nytt, ikke-godkjent utkast.'));
    const basis=el('label','Grunnlag for designprøven'),select=el('select');select.id='studioSource';
    for(const [value,label]of [['example','Illustrasjon uten registrert prestasjon'],['inger','Inger – historisk sølvdiplom 2024'],['oscar','Oscar – eksisterende æresdiplom'],['einar','Einar – eksisterende æresdiplom']]){const o=el('option',label);o.value=value;select.append(o);}select.value=state.source;select.onchange=()=>{state.source=select.value;controls();previews();};basis.append(select);box.append(basis);
    box.append(note(state.source==='example'?'Eksempelnavn og terskel illustrerer malen; ingen løpsresultater er opprettet. Ukjent oppnåelsesdato står tom.':'Registrert prestasjon, år/periode, hoved-/grunnleggermerker og særskilt dato beholdes. Egne merkedefinisjoner endrer ikke dette faktagrunnlaget.'));
    box.append(group('Mal og tekst',[field('diploma.template','Diplommal','text',[['classic','Klassisk'],['modern','Moderne'],['ceremonial','Høytidelig'],['sport','Sportslig']]),field('diploma.heading','Diplomoverskrift'),field('diploma.body','Diplomtekst','textarea'),field('diploma.sampleName','Eksempelnavn (kun illustrasjon)')]));
    const chosen=el('label','Hovedmerke i illustrasjonen'),badges=el('select');badges.id='studioMainBadge';for(const s of state.draft.series)for(const b of s.badges.filter(b=>b.active&&b.onDiploma)){const o=el('option',s.name+' · '+b.name+' · '+b.threshold);o.value=s.id+'|'+b.id;badges.append(o);}badges.value=state.draft.diploma.seriesId+'|'+state.draft.diploma.badgeId;badges.onchange=()=>update(()=>{const [s,b]=badges.value.split('|');Object.assign(state.draft.diploma,{seriesId:s,badgeId:b});});chosen.append(badges);box.append(chosen);
    box.append(group('Farger, ramme og bilder',[field('diploma.backgroundColor','Diplombakgrunn','color'),field('diploma.textColor','Diplomets tekstfarge','color'),field('diploma.accentColor','Ramme- og detaljfarge','color'),field('diploma.font','Diplomfont','text',fonts),field('diploma.frame','Rammestil','text',[['single','Enkel'],['double','Dobbel'],['corners','Hjørner']]),field('diploma.backgroundRef','Bakgrunnsbilde','text',[[null,'Ingen bakgrunn'],...state.draft.assets.filter(a=>a.role==='background').map(a=>[a.id,a.id])].map(([v,n])=>[v??'',n])),upload('background',id=>state.draft.diploma.backgroundRef=id,'Velg bakgrunn (PNG/WebP)'),field('diploma.mainSizeMm','Hovedmedalje (35–62 mm)','number'),field('diploma.medalDisplay','Medaljer på diplomet','text',[['latest','Kun siste merke'],['all','Alle opptjente merker']]),field('diploma.secondaryPosition','Mindre merker','text',[['bottom','Sentrert under hovedmerket'],['left','Under hovedmerket, mot venstre']])]));
    box.append(group('Sted, dato og typografisk navnesignatur',[field('diploma.place','Sted'),field('diploma.dateMode','Datoformål','text',[['achievement','Faktisk oppnåelsesdato fra prestasjonen'],['presentation','Eksplisitt utdelingsdato i utkastet'],['none','Uten datofelt']]),field('diploma.presentationDate','Utdelingsdato (kun ved eksplisitt valg)','date'),field('diploma.signatureName','Navnesignatur'),field('diploma.signatureRole','Signaturrolle')]));
    box.append(note('Trykkgodkjenning arves aldri. Utskrift, PDF-utstedelse og masseutstedelse av endrede design er sperret i denne versjonen.'));
  }
  function controls() {
    const box=$('studioFields');box.replaceChildren();state.series=Math.min(state.series,state.draft.series.length-1);
    ({profile:profileControls,badges:badgeControls,diploma:diplomaControls})[state.tab](box);
    if(state.draft.assets.length){const library=el('details',undefined,'studio-assets');library.append(el('summary','Mine bildefiler · '+state.draft.assets.length));for(const a of state.draft.assets){const row=el('div');row.append(note(a.id+' · '+a.width+' × '+a.height+' px · SHA-256 '+a.sha256.slice(0,12)+'… · ikke trykkgodkjent'),button('Fjern ubrukt '+a.id,()=>transaction(()=>{const used=state.draft.profile.logoRef===a.id||state.draft.diploma.backgroundRef===a.id||state.draft.series.some(s=>s.badges.some(b=>b.assetRef===a.id));if(used)throw Error('Bildet er i bruk. Velg et annet motiv før du fjerner det.');state.draft.assets=state.draft.assets.filter(v=>v.id!==a.id);})));library.append(row);}box.append(library);}
    for(const b of document.querySelectorAll('[data-studio-tab]')){b.setAttribute('aria-pressed',String(b.dataset.studioTab===state.tab));}
    $('studioDraftName').textContent=state.draft.profile.name+' · eget designutkast';
    $('studioProfilePanel').hidden=state.tab!=='profile';$('studioBadgePanel').hidden=state.tab!=='badges';$('studioDiplomaPanel').hidden=state.tab!=='diploma';
  }
  function profilePreview() {
    const d=state.draft,p=d.profile,card=$('studioProfilePreview');card.replaceChildren();card.style.background=p.colors.background;card.style.color=p.colors.text;card.style.fontFamily=M.fonts[p.font];
    const hero=el('div',undefined,'studio-demo-hero');hero.style.background='linear-gradient(110deg,'+p.colors.primary+','+p.colors.secondary+')';const logo=el('img');logo.src=src(p.logoRef);logo.alt='Utkastlogo';hero.append(logo,el('small',p.tagline),el('h2',p.name),el('h3',p.header),el('p',p.description));
    const nav=el('p',M.modules.filter(k=>p.modules[k]).join(' · '),'studio-demo-nav');card.append(hero,nav,el('h3','Distanser'),...p.distances.map(r=>el('p',r.name+' · '+r.km+' km')),note('Illustrert offentlig profil · ingen data eller moduler er publisert.'));
    $('studioDraftName').textContent=p.name+' · eget designutkast';
  }
  function badgePreview() {
    const box=$('studioBadgePreview');box.replaceChildren();for(const s of state.draft.series){box.append(el('h3',s.name),note(M.ruleStatus(s)));const grid=el('div',undefined,'studio-badge-grid');for(const b of s.badges){const card=el('article',undefined,'studio-badge-tile'),img=el('img');img.src=src(b.assetRef);img.alt=b.name;card.style.borderColor=b.color;card.append(img,el('strong',b.name),el('span',b.threshold+' · '+{editions:'kvalifiserte utgaver',starts:'starter',manual:'regelverdi'}[s.unit]),note(b.active?'Aktivt utkast · ikke tildelt':'Inaktivt utkast'));if(b.description)card.append(note(b.description));if(b.assetRef==='builtin:debut')card.append(note('Morothon-eksempelmotiv · velg eget merkebilde.'));if(!b.assetRef.startsWith('builtin:')){const a=state.draft.assets.find(a=>a.id===b.assetRef);card.append(note(a.width+' × '+a.height+' px · '+M.dpi(a,55)+' DPI ved 55 mm · ikke trykkgodkjent'));}grid.append(card);}box.append(grid);}
    document.querySelectorAll('[data-badge-summary]').forEach(n=>{const b=state.draft.series[state.series]?.badges[+n.dataset.badgeSummary];if(b)n.textContent=b.name+' · '+b.threshold;});
  }
  async function motor() {
    if(!motorPromise)motorPromise=(async()=>{const frame=el('iframe');frame.className='studio-engine';frame.title='Isolert diplommotor';frame.setAttribute('aria-hidden','true');frame.src=new URL('index.html',root).href;host.append(frame);await new Promise((resolve,reject)=>{const until=Date.now()+30000;const check=()=>{if(frame.contentWindow?.MorothonDiplomas&&!frame.contentDocument.querySelector('#loading'))return resolve();if(Date.now()>until)return reject(Error('Diplommotoren kunne ikke lastes.'));setTimeout(check,50);};check();});return frame.contentWindow.MorothonDiplomas;})();return motorPromise;
  }
  async function api(route,body) {
    if(window.MorothonAdminTransport)return MorothonAdminTransport.request(route,body);
    if(document.body.dataset.adminMode==='public-preview')throw Error('Nettadapteren mangler. Last siden på nytt.');
    const token=document.querySelector('[name="local-session"]').content,r=await fetch('/api/'+route,{method:'POST',headers:{'X-Morothon-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;
  }
  const samples={inger:{kind:'runner',personId:'MOR-C788866',key:'badge:10'},oscar:{kind:'honor',personId:'oscar-lohne',key:'service-aeresmerke'},einar:{kind:'honor',personId:'einar-danielsen',key:'service-aeresmerke'}};
  async function diplomaPreview(seq) {
    const d=M.clone(state.draft),t=d.diploma,s=d.series.find(s=>s.id===t.seriesId),b=s.badges.find(b=>b.id===t.badgeId),D=await motor();
    let html,entry;
    if(state.source!=='example'){const result=await api('preview',{items:[{...samples[state.source],display:t.medalDisplay}]});html=result.html;entry=result.entries[0];if(!html||entry.status==='blocked')throw Error('Kildediplomet er sperret: '+(entry.errors||[]).join(' '));}
    else html=D.documentHtml({type:'badge',tier:'gold',title:b.name,name:t.sampleName,filename:'designutkast',color:b.color,asset:{src:src(b.assetRef),boxWidthMm:55,boxHeightMm:55},watermarkSrc:new URL(registry.watermark.src,root).href,imageReady:false,firstEdition:'',editionNumber:null,dateLabel:'',firstYear:'',lastYear:'',count:b.threshold,threshold:b.threshold,year:'',citation:'Illustrert merkekrav – ingen dokumentert prestasjon.',description:''});
    if(seq!==state.sequence)return;
    const doc=new DOMParser().parseFromString(html,'text/html'),sheet=doc.querySelector('.diploma-sheet');sheet.classList.add('studio-draft-sheet');if(doc.querySelector('.diploma-service-founder'))sheet.classList.add('studio-with-founder');if(doc.querySelector('.c1-collection'))sheet.classList.add('studio-has-prior');
    // All edits are plain text or closed, validated tokens. No imported HTML/CSS.
    doc.querySelector('.diploma-brand b').textContent=d.profile.name;doc.querySelector('.diploma-brand span').textContent='DESIGNUTKAST';doc.querySelector('.diploma-heading h1').textContent=t.heading;doc.querySelector('.diploma-heading>p').textContent='PERSONLIG DESIGN · IKKE UTSTEDT';
    doc.querySelector('.diploma-citation').replaceChildren(el('p',t.body));
    if(state.source==='example'){
      doc.querySelector('.diploma-recipient h3')?.replaceChildren(doc.createTextNode(b.name));doc.querySelector('.diploma-left span').textContent='ILLUSTRERT KRAV';doc.querySelector('.diploma-left small').textContent='Ingen registrert prestasjon';doc.querySelector('.diploma-right strong').textContent='';doc.querySelector('.diploma-right span').textContent='DESIGNPRØVE';doc.querySelector('.diploma-right small').textContent='Oppnåelsesår ikke fastslått';
      if(t.medalDisplay==='all'){
        const row=doc.createElement('section');row.className='studio-prior';row.setAttribute('data-layout-check','');for(const prior of s.badges.filter(v=>v.active&&v.onDiploma&&v.threshold<b.threshold)){const img=doc.createElement('img');img.src=src(prior.assetRef);img.alt=prior.name;row.append(img);}if(row.childElementCount){sheet.classList.add('studio-has-prior');doc.querySelector('.diploma-signoff').before(row);}
      }
    }
    const logo=doc.createElement('img');logo.className='studio-logo';logo.src=src(d.profile.logoRef);logo.alt='Utkastlogo';doc.querySelector('.diploma-brand').prepend(logo);
    let date='';if(t.dateMode==='presentation')date=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(t.presentationDate+'T12:00:00Z'));
    else if(t.dateMode==='achievement'&&entry?.date){date=entry.date.replace(/^Søgne,\s*/,'');}
    // Einars registered presentation date stays a presentation date, never a guessed achievement.
    const isPresentation=t.dateMode==='presentation'||!!entry&&entry.dateBasis==='presentation-date';
    if(t.dateMode==='achievement'&&entry?.dateBasis==='presentation-date')date=entry.date.replace(/^Søgne,\s*/,'');
    const dateBox=doc.querySelector('.diploma-date');dateBox.querySelector('.diploma-handwritten').textContent=date?(t.place?t.place+', ':'')+date:'';
    let label=dateBox.querySelector('.diploma-date-label');if(date&&!label){label=doc.createElement('span');label.className='diploma-date-label';dateBox.prepend(label);}if(label)label.textContent=date?(isPresentation?'UTDELINGSDATO':'MERKET OPPNÅDD'):'';
    const line=dateBox.querySelector('.diploma-signature-line');if(!date)line?.remove();else if(!line){const rule=doc.createElement('div');rule.className='diploma-signature-line';rule.setAttribute('aria-hidden','true');dateBox.append(rule);}
    const signature=doc.querySelector('.diploma-signature');signature.querySelector('.diploma-handwritten').textContent=t.signatureName;signature.querySelector('.diploma-signature-role').textContent=t.signatureRole;
    doc.querySelectorAll('.diploma-draft,.c1-control-copy').forEach(n=>n.remove());const stamp=doc.createElement('p');stamp.className='studio-draft-stamp';stamp.setAttribute('data-layout-check','');stamp.textContent='DESIGNUTKAST · IKKE GODKJENT FOR UTSKRIFT ELLER UTDELING';sheet.append(stamp);
    if(t.backgroundRef){const img=doc.createElement('img');img.className='studio-background';img.src=src(t.backgroundRef);img.alt='';sheet.prepend(img);}
    const style=doc.createElement('style');style.dataset.studio='draft-only';
    const template={classic:'',modern:'.studio-draft-sheet .diploma-heading:before{width:110mm;height:.6mm}.studio-draft-sheet .diploma-corner{display:none}',ceremonial:'.studio-draft-sheet .diploma-heading h1{font-family:Georgia,serif;letter-spacing:1.2mm}.studio-draft-sheet:before{border-width:.7mm}',sport:'.studio-draft-sheet .diploma-heading h1{font-style:italic;letter-spacing:.3mm}.studio-draft-sheet .diploma-main{border-top-width:.8mm}'}[t.template];
    style.textContent=`.studio-draft-sheet{--diploma-metal:${t.accentColor};--diploma-image-width:${t.mainSizeMm}mm;--diploma-image-height:${t.mainSizeMm}mm;background:${t.backgroundColor};color:${t.textColor};font-family:${M.fonts[t.font]}}.studio-draft-sheet:not(.diploma-service){grid-template-rows:18mm 25mm 29mm 66mm 17mm 19.5mm}.studio-draft-sheet .diploma-main{padding-top:3mm}.studio-draft-sheet .diploma-heading{gap:1.5mm}.studio-draft-sheet .diploma-heading:before{margin-bottom:.5mm}.studio-draft-sheet .diploma-heading h1{font-size:9mm}.studio-draft-sheet .diploma-citation{max-width:225mm}.studio-draft-sheet .diploma-citation p{font-size:3.1mm;line-height:1.35;white-space:pre-line}.studio-draft-sheet .diploma-brand{position:relative}.studio-logo{position:absolute;left:0;width:13mm;height:13mm;object-fit:contain}.studio-with-founder .studio-logo{left:auto;right:0}.studio-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.12;z-index:-1}.studio-draft-stamp{position:absolute;bottom:7mm;left:20mm;right:20mm;text-align:center;margin:0;font:700 2.6mm/1.3 Arial,sans-serif;color:#784620;background:#fff8e9}.studio-prior{display:flex;justify-content:${t.secondaryPosition==='left'?'flex-start':'center'};align-items:center;gap:2mm}.studio-prior img{width:15mm;height:15mm;object-fit:contain}.studio-draft-sheet.studio-has-prior{grid-template-rows:13mm 18mm 27mm 66mm 13mm 18mm 19.5mm}.studio-draft-sheet .diploma-service-collection>div{justify-content:${t.secondaryPosition==='left'?'flex-start':'center'}}.studio-draft-sheet .diploma-date,.studio-draft-sheet .diploma-signature{grid-template-rows:2.5mm 8.4mm .15mm 3.5mm;row-gap:.6mm}.studio-draft-sheet .diploma-handwritten{grid-row:2;font:400 6mm/8.4mm 'Morothon Caveat',cursive;color:#233d69}.studio-draft-sheet .diploma-signature-line{grid-row:3}.studio-draft-sheet .diploma-signature-role{grid-row:4}.studio-draft-sheet .diploma-date-label{grid-row:1;font:400 2mm/2.5mm Arial,sans-serif}.studio-draft-sheet .diploma-edition{display:none}${t.frame==='single'?'.studio-draft-sheet:after{display:none}':t.frame==='corners'?'.studio-draft-sheet:before,.studio-draft-sheet:after{display:none}':''}${template}`;
    const font=await fetch(new URL('assets/fonts/caveat-regular-latin.woff',root)).then(r=>{if(!r.ok)throw Error('Håndskriftfonten mangler.');return r.arrayBuffer();});
    const dataUrl=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob([font],{type:'font/woff'}));});style.textContent+='@font-face{font-family:"Morothon Caveat";src:url("'+dataUrl+'") format("woff");font-weight:400;font-style:normal}';doc.head.append(style);
    if(seq!==state.sequence)return;
    const frame=$('studioDiplomaFrame');await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;});
    if(seq!==state.sequence)return;D.fitPreview($('studioA4'),frame);
    const layout=await D.checkLayout(frame.contentDocument);if(seq!==state.sequence)return;
    $('studioLayout').textContent=(layout.ready?'A4-layout kontrollert. ':'Layout må justeres: '+layout.failures.join(' ')+' ')+'Designet er uansett et utkast; utskrift/PDF er sperret.';
    $('studioLayout').dataset.ready=String(layout.ready);frame.dataset.layout=String(layout.ready);frame.dataset.pending='false';frame.dataset.template=t.template;frame.dataset.source=state.source;
    $('studioImageQuality').textContent=state.source==='example'&&!b.assetRef.startsWith('builtin:')?(()=>{const a=d.assets.find(a=>a.id===b.assetRef);return a.width+' × '+a.height+' px · '+M.dpi(a,t.mainSizeMm)+' DPI ved '+t.mainSizeMm+' mm. Nytt bilde er ikke trykkgodkjent; DPI alene dokumenterer ikke frilegging, motiv eller tekstkvalitet.';})():'Originale Morothon-motiver beholder sin dokumenterte bildekvalitet. Endret komposisjon er ikke trykkgodkjent.';
  }
  function previews() {
    profilePreview();badgePreview();clearTimeout(timer);const seq=++state.sequence;
    if(state.tab==='diploma'){$('studioDiplomaFrame').dataset.pending='true';timer=setTimeout(()=>diplomaPreview(seq).catch(e=>{if(seq===state.sequence){$('studioLayout').textContent='Kan ikke vise diplom: '+e.message;error(e);$('studioDiplomaFrame').dataset.pending='false';$('studioDiplomaFrame').dataset.layout='false';}}),180);}
  }
  async function exportDraft() {
    const json=await M.exportPackage(state.draft,builtinIds),url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=el('a');a.href=url;a.download=state.draft.id+'.morothon-design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);state.baseline=snap();state.dirty=false;tell('Komplett utkastpakke lastet ned. Oppbevar filen selv; dette er ikke skylagring.');
  }
  function replaceDraft(d) { state.draft=d;state.series=0;state.baseline=snap();state.history=[];state.dirty=false;changed(true); }
  async function init() {
    host.append(el('p','Laster designstudio …'));
    if(document.body.dataset.adminMode==='public-preview'&&!window.MorothonAdminTransport)throw Error('Nettadapteren mangler. Last siden på nytt.');
    if(window.MorothonAdminTransport)await MorothonAdminTransport.ready;
    const load=async name=>{const r=await fetch(new URL(name,root));if(!r.ok)throw Error('Kunne ikke laste '+name);return r.json();};
    [registry,activeProfile]=await Promise.all([load('data/badges.json'),load('admin/event-profile.json')]);
    const manifest=await load('public-manifest.json');builtinIds=registry.badges.map(b=>b.id);base={profileSha256:await M.hash(new TextEncoder().encode(JSON.stringify(activeProfile))),registrySha256:manifest.files['data/badges.json'].sha256,historySha256:manifest.historySha256};
    host.replaceChildren();const banner=el('div',undefined,'studio-banner');banner.append(el('span','DITT DESIGNVERKSTED','eyebrow'),el('h2','Gjør arrangementet til ditt'),el('p','Prøv uttrykk, bygg din merkeserie og finn formen på diplomet. Alt er et separat utkast i denne nettleserfanen.'));
    const tools=el('div',undefined,'studio-tools');for(const [name,fn,id]of [['Nytt utkast',()=>{checkpoint();state.draft=M.createDraft(activeProfile,base,true);state.series=0;changed(true);},'studioNew'],['Gjenopprett Morothon-standard',()=>{checkpoint();state.draft=M.createDraft(activeProfile,base);state.series=0;changed(true);},'studioDefault'],['Angre',()=>{if(state.history.length){state.draft=state.history.pop();state.dirty=true;changed(true);}},'studioUndo'],['Tilbakestill til lagret utkast',()=>{checkpoint();state.draft=M.clone(state.baseline);state.series=0;changed(true);},'studioReset'],['Eksporter komplett utkast',exportDraft,'studioExport']]){const b=button(name,fn);b.id=id;tools.append(b);}
    const importLabel=el('label','Importer utkastpakke'),input=el('input');input.id='studioImport';input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const f=input.files[0];if(!f)return;try{if(f.size>M.MAX_PACKAGE)throw Error('Utkastpakken er for stor.');const d=await M.importPackage(await f.text(),builtinIds,dimensions);checkpoint();const previous=state.history;state.draft=d;state.baseline=snap();state.series=0;state.dirty=false;state.history=previous;changed(true);tell('Utkast og bilder er kontrollert og importert. Ingen trykkgodkjenning eller publisering er gitt.');}catch(e){error(e);}finally{input.value='';}};importLabel.append(input);tools.append(importLabel);
    const storage=el('p','Utkastet huskes mens denne fanen er åpen, også ved navigasjon. Last ned utkastpakken for varig lagring. Ingen skylagring, serveropplasting eller automatisk publisering.','studio-notice');
    const tabs=el('div',undefined,'studio-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Designstudio');for(const [key,label]of [['profile','Arrangementsprofil'],['badges','Mine merker'],['diploma','Diplomdesigner']]){const b=button(label,()=>{state.tab=key;controls();previews();});b.dataset.studioTab=key;tabs.append(b);}
    const title=el('h3',undefined);title.id='studioDraftName';const status=el('p');status.id='studioStatus';status.setAttribute('role','status');
    const workspace=el('div',undefined,'studio-workspace'),fields=el('div',undefined,'studio-fields');fields.id='studioFields';const previewAside=el('aside',undefined,'studio-previews');
    for(const [key,titleText]of [['Profile','Profilforhåndsvisning'],['Badge','Hele merkeserien'],['Diploma','Liggende A4 · designutkast']]){const panel=el('section',undefined,'studio-preview-panel');panel.id='studio'+key+'Panel';panel.append(el('h3',titleText));if(key==='Diploma'){const a4=el('div',undefined,'studio-a4');a4.id='studioA4';const frame=el('iframe');frame.id='studioDiplomaFrame';frame.title='A4 designutkast';frame.sandbox='allow-same-origin';a4.append(frame);const quality=el('p');quality.id='studioImageQuality';const layout=el('p');layout.id='studioLayout';panel.append(a4,layout,quality,button('Utskrift/PDF sperret – designutkast',()=>{}));panel.querySelector('button').disabled=true;}else{const content=el('div');content.id=key==='Profile'?'studioProfilePreview':'studioBadgePreview';panel.append(content);}previewAside.append(panel);}
    workspace.append(fields,previewAside);host.append(banner,tools,storage,title,tabs,status,workspace);
    replaceDraft(M.createDraft(activeProfile,base));
    new ResizeObserver(()=>motorPromise?.then(D=>D.fitPreview($('studioA4'),$('studioDiplomaFrame')))).observe($('studioA4'));
    window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
    // Read-only debugging surface used by focused tests, never a publication API.
    window.MorothonStudio={current:()=>M.clone(state.draft),validate:()=>validate()};
  }
  init().catch(e=>{host.replaceChildren(el('p','Designstudioet kunne ikke starte: '+e.message));});
})();
