/* Static Pages adapter: public reads, isolated previews, no HTTP API or writes. */
(() => {
  'use strict';
  const rootUrl = document.body.dataset.adminMode === 'protected' ? new URL('/site/', location.origin) : new URL('../', document.baseURI), adminUrl = new URL('./', document.baseURI);
  let enginePromise, busy = false, release, context, honorContext, honorInput, honorEnabled = true, ownsPackage = false;
  const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function json(url) { const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Kunne ikke laste offentlig fil: '+new URL(url).pathname);return r.json(); }
  const ready=(async()=>{
    const [manifest,info,profile]=await Promise.all([json(new URL('public-manifest.json',rootUrl)),json(new URL('build-info.json',rootUrl)),json(new URL('event-profile.json',adminUrl))]);
    if(manifest.schemaVersion!==1 || (document.body.dataset.adminMode === 'protected' ? new URL(info.siteUrl).href !== 'https://historikk.morothon.no/' : new URL(info.siteUrl).pathname !== rootUrl.pathname))throw Error('Nettversjonens publiseringsadresse eller datakontrakt er ugyldig.');
    const load=async name=>{const key='data/'+name+'.json',r=await fetch(new URL(key,rootUrl),{cache:'no-store'});if(!r.ok)throw Error('Kunne ikke laste '+key);const bytes=await r.arrayBuffer(),entry=manifest.files[key];if(!entry||entry.bytes!==bytes.byteLength||entry.sha256!==await sha(bytes))throw Error('Offentlige data er endret eller fra ulike versjoner. Last siden på nytt.');return JSON.parse(new TextDecoder().decode(bytes));};
    const [history,badges,honors,volunteers]=await Promise.all(['history','badges','honors','volunteers'].map(load));
    MorothonEventProfile.validate(profile,badges);MorothonEventProfile.apply(profile,badges,rootUrl);
    // This package is approved for Morothon's legacy adapter, not arbitrary new tenants.
    // A differently identified organizer gets empty models, never inherited persons/awards.
    ownsPackage=profile.id==='sogne-morothon'&&manifest.policyVersion==='morothon-public-v1';
    const publicHistory=ownsPackage?history:{schemaVersion:1,people:[],results:[],yearStats:[],aliases:{},redirects:{}};
    honorInput={organizerId:profile.id,enabled:true,history:publicHistory,badges:ownsPackage?badges.badges:[],
      honors:ownsPackage?honors:{schemaVersion:1,groups:[],personDetails:{}},...(ownsPackage?{volunteers}:{})};
    context=MorothonPortalData.createPortalData({history:publicHistory,badges:ownsPackage?badges:{...badges,badges:badges.badges.filter(b=>b.id===profile.logoAssetId)},honorCount:0,assetBase:rootUrl.href,profile});
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(info.assets[['js','honors-data.js'].join('/')],rootUrl).href;script.onload=resolve;script.onerror=()=>reject(Error('Heder-modellen kunne ikke lastes.'));document.head.append(script);});
    release={version:info.version,manifest:JSON.stringify(manifest),adapterUrl:new URL(info.assets['admin/diploma-adapter.js']||'./diploma-adapter.js',info.assets['admin/diploma-adapter.js']?rootUrl:adminUrl).href};
    $('webLimitations').hidden=false;$('webPrintControls').hidden=false;
    $('export').textContent='Samlet PDF krever C1-server';$('exportHeading').textContent='Kontroll og videre utskrift';
    document.querySelector('.export-panel>p.hint').textContent='Lagre en kontrollrapport her. Åpne «Vis» for enkeltutskrift via nettleseren. Samlet, kontrollert PDF-produksjon finnes bare i C1-serveren.';
    document.querySelector('[aria-labelledby="jobHeading"]>p.hint').textContent='Rekkefølgen beholdes i kontrollrapporten. Fjern eller flytt mottakere før kontroll.';
    document.querySelector('.shortcut-grid a[href="#diplomer"] p').textContent='Velg mottakere og forhåndsvis kontrollerte enkeltdiplomer.';
    document.querySelector('.local-tag').textContent='Offentlig testversjon · ingen innlogging';
    document.querySelector('.sidebar-note strong').textContent='Offentlig testversjon';
    document.querySelector('.sidebar-note p').textContent='Kun godkjente offentlige data. Ingen lagring eller formell utstedelse.';
    document.querySelector('.portal-footer>span:last-child').textContent='Testversjon uten innlogging · ingen administrative skrivefunksjoner';
    if(document.body.dataset.adminMode==='protected'){
      document.querySelector('.local-tag').textContent='Beskyttet administrasjon';
      document.querySelector('.sidebar-note strong').textContent='Innlogget arbeidsrom';
      document.querySelector('.sidebar-note p').textContent='Endringer krever særskilt kontroll og godkjenning før publisering.';
      document.querySelector('.portal-footer>span:last-child').textContent='Beskyttet arbeidsrom · publisering krever godkjenning';
    }
    return profile;
  })();
  function $(id){return document.getElementById(id);}
  async function unchanged(){await ready;const [m,i]=await Promise.all([json(new URL('public-manifest.json',rootUrl)),json(new URL('build-info.json',rootUrl))]);if(i.version!==release.version||JSON.stringify(m)!==release.manifest)throw Error('Publiseringsgrunnlaget er oppdatert. Last siden på nytt før videre diplomkontroll.');}
  async function engine(){
    if(!enginePromise)enginePromise=(async()=>{
      await ready;const frame=document.createElement('iframe');frame.className='web-engine';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
      frame.src=new URL('index.html',rootUrl).href;document.body.append(frame);
      await new Promise((resolve,reject)=>{const end=Date.now()+30000;const check=()=>{try{if(frame.contentWindow?.MorothonDiplomas&&!frame.contentDocument.querySelector('#loading'))return resolve();if(Date.now()>end)return reject(Error('Diplommotoren kunne ikke lastes. Last siden på nytt.'));setTimeout(check,40);}catch(e){reject(e);}};check();});
      await new Promise((resolve,reject)=>{const script=frame.contentDocument.createElement('script');script.src=release.adapterUrl;script.onload=resolve;script.onerror=()=>reject(Error('Diplomadapteren kunne ikke lastes.'));frame.contentDocument.head.append(script);});
      return frame.contentWindow;
    })().catch(e=>{enginePromise=null;throw e;});return enginePromise;
  }
  function items(input){if(!Array.isArray(input)||!input.length||input.length>100)throw Error('Velg mellom 1 og 100 diplomer.');const seen=new Set();return input.map(i=>{if(!i||Object.keys(i).sort().join(',')!=='display,key,kind,personId'||!['runner','honor'].includes(i.kind)||!['all','latest'].includes(i.display)||!(/^[A-Za-z0-9_-]{1,128}$/.test(i.personId))||!(/^[a-z0-9:-]{1,80}$/.test(i.key)))throw Error('Ugyldig diplomvalg.');return i;}).filter(i=>{const key=JSON.stringify([i.kind,i.personId,i.key,i.display]);if(seen.has(key))return false;seen.add(key);return true;});}
  async function render(item){
    const win=await engine(),catalog=await win.C1.catalog();
    if(!catalog.some(p=>p.kind===item.kind&&p.personId===item.personId&&p.options.some(o=>o.key===item.key)))throw Error('Diplomet er ikke tilgjengelig for denne personen.');
    const prepared=await win.C1.prepare(item),frame=document.createElement('iframe');frame.className='web-engine';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.sandbox='allow-same-origin';
    try{
      await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('Forhåndsvisningen kunne ikke lastes.'));frame.srcdoc=prepared.html;document.body.append(frame);});
      const checked=await win.C1.check(frame.contentDocument);
      return {html:prepared.html,entry:{...item,name:prepared.name,title:prepared.title,year:prepared.year,period:prepared.period,count:prepared.count,date:prepared.date,dateBasis:prepared.dateBasis,assetKey:prepared.assetKey,priorBadges:prepared.priorBadges,status:checked.ready?prepared.mode:'blocked',reasons:prepared.reasons,errors:checked.failures,warnings:checked.warnings,approval:prepared.approval,layout:{ready:checked.layout.ready,width:checked.layout.width,height:checked.layout.height}}};
    }finally{frame.remove();}
  }
  function unavailable(message,status=404){const error=Error(message);error.status=status;throw error;}
  const storageBlocker='Permanent lagring krever en autentisert webtjeneste med arrangørtilgang og privat lagring. Endringene er bare forhåndsvisning i denne fanen.';
  async function honors(){
    if(!honorEnabled)unavailable('Heder er deaktivert i denne fanen.');
    if(!honorContext)honorContext=(async()=>{
      const model=MorothonPortalData.Honors,editions=model.legacyEditionCatalog(honorInput.history,honorInput.organizerId);
      const roster=model.createHonorAdminRoster({...honorInput,editionYears:[...new Set(editions.map(e=>e.year))]}),view=model.publicHonorAdminView(roster,honorInput.badges);
      const drafts=await model.createHonorDrafts({...honorInput,editions});
      return {model,roster,view,drafts};
    })().catch(e=>{honorContext=null;throw e;});
    const value=await honorContext;if(!honorEnabled)unavailable('Heder er deaktivert i denne fanen.');return value;
  }
  function setHonorEnabled(value){
    if(busy)throw Error('Vent til diplomkontrollen er ferdig før du endrer modulvalget.');
    if(typeof value!=='boolean')throw Error('Velg om Heder skal vises i denne fanen.');
    honorEnabled=value;if(!value)honorContext=null;
    return {enabled:value,persisted:false,productionApplied:false,publicNavigationEnabled:false,scope:'browser-tab'};
  }
  async function honorRequest(key,params,body){
    const {view,drafts,roster,model}=await honors();
    const clone=value=>structuredClone(value);
    if(body===undefined&&key==='honors'&&!params.size)return clone(view);
    if(body===undefined&&key==='honors/runner-candidates'){
      if([...params.keys()].some(k=>!['personId','q'].includes(k))||[...params.keys()].some(k=>params.getAll(k).length>1))throw Error('Ukjente søkefelt.');
      return model.findHonorRunnerCandidates({roster,history:honorInput.history,personId:params.get('personId')??undefined,query:params.get('q')??undefined});
    }
    if(body===undefined&&key==='honors/drafts'&&!params.size)return {items:[],storage:'browser-memory',persisted:false,productionApplied:false,publicationAuthorized:false};
    const action=/^honors\/drafts\/(open|preview|discard)$/.exec(key);
    if(body!==undefined&&action&&!params.size){
      await unchanged();await honors();
      const value=await drafts[action[1]](clone(body));await unchanged();await honors();
      return {...value,storage:'browser-memory',canKeepDraft:false,canPersist:false,persisted:false,productionApplied:false,publicationAuthorized:false,storageBlocker};
    }
    if(body!==undefined&&key==='honors/drafts/keep')unavailable(storageBlocker,503);
    unavailable('Heder-handlingen finnes ikke i nettversjonen.');
  }
  async function request(route,body){
    await ready;const url=new URL(route,'https://adapter.invalid/'),key=url.pathname.slice(1);
    if(key==='honors'||key.startsWith('honors/'))return honorRequest(key,url.searchParams,body);
    if(body===undefined){
      if(key==='overview'){const h=honorEnabled?(await honors()).view:null;return {...context.overview(),honorCount:h?.summary.total||0,honorEnabled};}if(key==='participants')return context.participants(url.searchParams);if(key==='badges')return context.badgeList(url.searchParams);
      if(key.startsWith('participants/'))return context.participant(decodeURIComponent(key.slice(13)));
      if(key==='catalog'){if(!window.__eventProfile.modules.diplomer||!ownsPackage)return {people:[],maxItems:100,honorEnabled};const win=await engine();return {people:(await win.C1.catalog()).filter(p=>honorEnabled||p.kind!=='honor'),maxItems:100,honorEnabled};}
    }
    if(!window.__eventProfile.modules.diplomer)throw Error('Diplommodulen er deaktivert i arrangementsprofilen.');
    if(key==='export'||key.startsWith('jobs/'))throw Error('Kontrollert samlet PDF krever C1-serveren og er ikke tilgjengelig i Pages-testversjonen.');
    if(!['preview','check'].includes(key))throw Error('Denne funksjonen finnes ikke i den offentlige testversjonen.');
    if(busy)throw Error('En diplomkontroll pågår. Vent til den er ferdig.');
    const selected=items(body?.items);if(!ownsPackage)unavailable('Dette arrangementet har ennå ikke et godkjent diplomgrunnlag.');if(!honorEnabled&&selected.some(i=>i.kind==='honor'))unavailable('Heder er deaktivert i denne fanen.');if(key==='preview'&&selected.length!==1)throw Error('Velg ett diplom for forhåndsvisning.');
    busy=true;try{await unchanged();const entries=[];let html;
      for(const item of selected){try{const result=await render(item);entries.push(result.entry);html=result.html;}catch(e){entries.push({...item,name:item.personId,status:'blocked',errors:[e.message]});}}
      await unchanged();return {schemaVersion:1,checkedAt:new Date().toISOString(),pageCount:entries.length,entries,...(key==='preview'?{html}:{})};
    }finally{busy=false;}
  }
  async function printPreview(frame){
    if(busy)throw Error('Vent til diplomkontrollen er ferdig.');busy=true;
    try{await unchanged();const win=await engine(),checked=await win.C1.check(frame.contentDocument);
      if(!checked.ready)throw Error(checked.failures.join(' '));if(!ownsPackage)unavailable('Arrangementet har ikke et godkjent diplomgrunnlag.');if(!honorEnabled&&frame.contentDocument.querySelector('.diploma-service'))unavailable('Heder er deaktivert i denne fanen.');await unchanged();
      frame.contentWindow.focus();frame.contentWindow.print();return checked;
    }finally{busy=false;}
  }
  window.MorothonAdminTransport={ready,request,printPreview,rootUrl,setHonorEnabled,capabilities:{batchPdf:false,browserPrint:true,honorPreview:true,honorPersistence:false,get honorEnabled(){return honorEnabled;}},get profile(){return context&&window.__eventProfile;}};
  ready.then(p=>{window.__eventProfile=p;}).catch(()=>{});
})();

/* Optional authenticated result service. Same Pages portal; no secret in this file. */
(() => {
  "use strict";
  const protectedPortal = document.body.dataset.adminMode === "protected";
  const configured = document.querySelector(
    'meta[name="morothon-admin-service"]',
  )?.content;
  if (!configured) return;
  let origin;
  try {
    const u = new URL(configured);
    if (u.protocol !== "https:" || u.origin !== configured) throw Error();
    origin = u.origin;
  } catch {
    return;
  }
  const $ = (id) => document.getElementById(id),
    node = (tag, text) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      return e;
    };
  let sessionToken = null,
    principal = null,
    saved = null,
    localSaved = null,
    busy = false,
    edits = 0,
    polling = false,
    box,
    status,
    diff,
    historyBox,
    actions = {},
    home;
  const flowKey = "morothon-one-use-login-proof",
    workspace = () => window.MorothonCorrectionWorkspace;
  let identityContext, identityMounted = false;
  document.addEventListener('morothon:corrections-ready',event=>{
    identityContext = event.detail;
    mountIdentity().catch(error=>{const host=$('view-personkontroll');if(host)host.textContent=error.message;});
  });
  // Capture the one-use return before the existing portal router normalizes hashes.
  const loginReturn = new URLSearchParams(location.hash.slice(1));
  if (
    loginReturn.has("morothon-auth") ||
    loginReturn.has("morothon-auth-error")
  )
    history.replaceState(null, "", "#rettelser");
  const b64 = (bytes) =>
    btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  const digest = async (value) =>
    b64(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
      ),
    );
  async function api(path, value, signal) {
    const r = await fetch(origin + path, {
      method: value === undefined ? "GET" : "POST",
      cache: "no-store",
      credentials: "omit",
      ...(signal?{signal}:{}),
      headers: {
        ...(sessionToken ? { Authorization: "Bearer " + sessionToken } : {}),
        ...(value === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    if (r.status === 401) {
      sessionToken = null;
      principal = null;
      // Server authentication has expired. Never leave a private admin
      // workspace visible merely because its HTML was already rendered.
      if (protectedPortal) {
        location.replace("/admin/");
        throw Object.assign(Error("Innloggingen er utløpt. Lagret arbeid er bevart."),{status:401});
      }
      render();
      throw Object.assign(Error("Logg inn på nytt. Lagret arbeid er bevart."),{status:401});
    }
    // Authentication must also expire when a proxy returns an empty/HTML 401.
    let data;
    try{data=await r.json();}
    catch(error){
      // Preserve other modules' established unknown-response handling. Only
      // Personkontroll uses HTTP rejection status to release its local batch.
      if(!/^\/identity(?:\/|$)/.test(path))throw error;
      throw Object.assign(Error('Serveren returnerte et ugyldig svar (HTTP '+r.status+'). Hent status; lagring er ikke bekreftet.'),{status:r.status});
    }
    if (!r.ok)
      throw Object.assign(Error(
        data.error ||
          "Kunne ikke fullføre handlingen. Lagret arbeid er bevart.",
      ),{status:r.status,...(path==='/review/import'&&Array.isArray(data.conflicts)?{
        importConflict:{conflicts:data.conflicts,revision:data.revision,digest:data.digest,incomingDigest:data.incomingDigest}
      }:{})});
    return data;
  }
  async function annualRequest(action,value){
    if(!protectedPortal||!principal?.annualImportPersistence)throw Error('Privat årsimport er ikke aktivert i denne versjonen.');
    const paths={load:'/annual-import',preview:'/annual-import/preview',save:'/annual-import/save',retry:'/task/retry',cancel:'/task/cancel',...Object.fromEntries(['check','approve','publish','continue','reverse','cancel'].map(a=>['publication-'+a,'/annual-import/publication/'+a]))};
    if(!Object.hasOwn(paths,action))throw Error('Ukjent årsimporthandling.');
    if(action.startsWith('publication-')&&principal?.annualPublicationEnabled!==true)throw Error('Årspublisering er ikke aktivert.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000),
      path=paths[action]+(action==='load'&&value?.requestId?'?requestId='+encodeURIComponent(value.requestId):'');
    try{return await api(path,action==='load'?undefined:value,controller.signal);}
    catch(error){if(controller.signal.aborted||(!error.status&&principal))throw Error('Serverresultatet er ukjent. Hent status før du sender på nytt. Lagret arbeid er bevart.');throw error;}
    finally{clearTimeout(timer);}
  }
  // Separate UI, same authenticated transport and existing Corrections engine.
  // Only server-confirmed packages populate this list; no browser storage.
  async function mountIdentity() {
    if (identityMounted || !identityContext || !principal?.identityPersistence || !protectedPortal) return;
    // Do not permanently latch a broken Personkontroll mount if the initial
    // history binding fails (for example due to a transient load failure).
    identityMounted = true;
    let C,H,model,base,suggestions,host;
    try {
      C=window.MorothonCorrections;H=window.MorothonHistoryData;
      model=H.create(identityContext.history);
      base=await C.binding(identityContext.history,identityContext.meta);
      suggestions=C.discover(identityContext.history);
      host=$('view-personkontroll');
    } catch(error) {
      identityMounted = false;
      throw error;
    }
    const MAX_SESSION_DECISIONS=50,REQUEST_TIMEOUT_MS=20000,MONITOR_TIMEOUT_MS=120000;
    const s={saved:null,busy:true,notice:null,scope:'pending',query:'',selected:null,selectedCase:null,request:null,pending:new Map(),deferred:new Set(),version:0};
    const panel=node('section');panel.className='panel';panel.id='identityService';
    const status=node('p');status.id='identityServiceStatus';status.setAttribute('role','status');
    const counts=node('div');counts.id='identityServiceCounts';counts.className='identity-counts';
    const controls=node('div');controls.className='actions identity-recovery-actions';
    const actionHelp=node('p');actionHelp.id='identityActionHelp';
    const list=node('div');list.id='identityWorklist';
    const tray=node('section');tray.id='identityBatchTray';tray.setAttribute('aria-label','Valg i denne økten');
    const editor=node('section');editor.id='identityEditor';
    const archive=node('details');archive.id='identityArchive';
    const publicationHistory=node('details');publicationHistory.id='identityPublicationHistory';publicationHistory.hidden=true;
    const publicationPanel=node('section');publicationPanel.id='identityPublication';publicationPanel.className='panel';publicationPanel.hidden=true;
    const field=(label,input)=>{const e=node('label',label);e.append(input);return e;};
    const select=(options,value,id)=>{const e=node('select');e.id=id;
      for(const [key,label] of options){const o=node('option',label);o.value=key;e.append(o);}if(value!==undefined)e.value=value;return e;};
    const input=(id,value='')=>{const e=node('input');e.id=id;e.value=value;return e;};
    const btn=(label,id,fn,{readOnly=false}={})=>{const e=node('button',label);e.type='button';e.id=id;e.className='secondary';
      if(readOnly)e.dataset.readOnly='true';
      e.onclick=async()=>{if(s.busy&&id!=='identityLogout'&&!readOnly)return;if(!readOnly){s.busy=true;disable();}try{await fn();}catch(error){
        s.notice={text:error.message+' Siste serverbekreftede vurderinger er beholdt.',error:true};
      }finally{if(!readOnly)s.busy=false;renderStatus();disable();}};return e;};
    const active=()=>['queued','running'].includes(s.saved?.task?.state);
    const unknownTask=()=>s.saved?.task&&!['queued','running','completed','failed','blocked'].includes(s.saved.task.state);
    const blocked=()=>s.saved?.task?.state==='blocked'||unknownTask();
    const stale=()=>s.saved?.stale || s.saved?.draft && JSON.stringify(s.saved.draft.base)!==JSON.stringify(base);
    const publishing=()=>!!s.saved?.publication?.reversalOf || s.saved?.publication?.locked===true;
    const publicationRunning=()=>active()&&['identity-publication-publish','identity-publication-continue'].includes(s.saved.task.action);
    const name=id=>model.person(id)?.n || id;
    const deferredCase=c=>c?.status==='review'&&!c.change&&
      c.events.filter(e=>/^identity-(defer|same-person|different-people)$/.test(e.action)).at(-1)?.action==='identity-defer';
    const identityState=()=>s.saved?.status==='review-approved' ? 'Godkjent – ikke publisert' : s.saved?.persisted ? 'Lagret privat – ikke godkjent eller publisert' : 'Ingen lagrede avgjørelser';
    function renderStatus(){
      status.dataset.error=String(!!s.notice?.error);
      status.textContent=s.notice?.text || (!s.saved?'Henter privat status. Ingen ny lagring er bekreftet.':
        (s.request?'Lagring er ikke bekreftet. Hent status før du gjør flere valg.':identityState()+
          (s.pending.size?' · '+s.pending.size+' ulagrede avgjørelser.':''))+' · revisjon '+s.saved.revision+'.'+
        (stale()?' Historikken er oppdatert. Kontroller kildegrunnlaget før nye avgjørelser.':'')+
        (active()?' Privat kontroll pågår; ingen ny lagring er bekreftet ennå.':'')+
        (blocked()?' Privat jobb krever avklaring. Hent status; ingen ny innsending er startet.':''));
    }
    async function identityApi(path,value){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
      try{return await api(path,value,controller.signal);}
      catch(error){
        if(controller.signal.aborted)throw Error('Serveren svarte ikke innen 20 sekunder. Hent status; ikke send avgjørelsene på nytt.');
        throw error;
      }finally{clearTimeout(timer);}
    }
    const matchesRequest=(task,request)=>{
      if(!task||!request)return false;
      if(task.action!=='identity-batch')return false;
      if(request.taskId&&task.id!==request.taskId)return false;
      const ids=task.requestIds || (task.requestId?[task.requestId]:[]);
      return ids.length===request.commands.length&&request.commands.every(c=>ids.includes(c.id));
    };
    function disable(){
      for(const button of panel.querySelectorAll('button'))button.disabled=s.busy&&button.id!=='identityLogout'&&button.dataset.readOnly!=='true';
      submit.disabled=s.busy||!s.saved||active()||blocked()||stale()||publishing()||!s.pending.size||!!s.request;
      approve.disabled=s.busy||active()||blocked()||stale()||!s.saved?.draft?.cases.length||s.saved.status==='review-approved'||
        !s.saved.inspection?.ready||
        s.saved.draft.cases.some(c=>!['handoff','rejected'].includes(c.status));
      revalidate.hidden=!s.saved?.stale||s.saved?.publication?.locked===true;revalidate.disabled=s.busy||active()||blocked();
      reload.hidden=!(s.saved?.draft && JSON.stringify(s.saved.draft.base)!==JSON.stringify(base));
      check.disabled=s.busy||active()||blocked()||stale()||!s.saved?.draft?.cases.length;
      retry.hidden=!s.request&&!active()&&!blocked();
      for(const button of panel.querySelectorAll('#identityEditor button, .identity-quick-actions button, #identityBatchTray button'))
        button.disabled=s.busy||!s.saved||active()||blocked()||stale()||publishing()||!!s.request;
      for(const button of panel.querySelectorAll('#identityPublication button, #identityPublicationHistory button'))button.disabled=button.dataset.blocked==='true'||s.busy||active()||blocked()||!!s.request||!!s.pending.size;
      actionHelp.hidden=!!s.saved&&!s.request&&!active()&&!blocked()&&!stale()&&!publishing();
      actionHelp.textContent=!s.saved?'Hent privat status før du velger avgjørelser.':
        s.request?'Valgene er låst mens lagringen avklares. «Hent status» sender ikke avgjørelsene på nytt.':
        publicationRunning()?'Du kan sammenligne profiler og bruke resten av Admin mens publiseringen kjører. Nye avgjørelser kan lagres når publiseringen er avklart.':
        active()?'En privat kontrolljobb pågår. Vent eller hent status senere. Du kan logge ut.':
        blocked()?'Jobbstatus må avklares før nye avgjørelser kan sendes.':
        stale()?'Kildegrunnlaget må kontrolleres før du kan lagre nye avgjørelser.':
        publishing()?'En pågående publiseringskontroll sperrer nye avgjørelser.':
        s.pending.size?'Valgene er ulagret. Bruk «Lagre avgjørelser privat», eller angre.':'Velg en avgjørelse på et personkort eller sammenlign resultatene først.';
    }
    async function read(){
      const current=await identityApi('/identity');
      if(current.scope!=='person-control-v1'||current.productionApplied!==false||current.publicationAuthorized!==false||
        !Number.isSafeInteger(current.revision)||current.revision<0)
        throw Error('Uventet identitetsstatus. Ingen ny vurdering er bekreftet.');
      s.saved=current;
      const confirmations=s.request?.commands&&current.revision>s.request.expectedRevision ?
        await Promise.all(s.request.commands.map(async command=>{
          const marker='request-'+await C.hash({...command,personIds:[...command.personIds].sort()});
          return current.draft?.cases.some(c=>c.events.some(e=>e.action===marker));
        })) : null;
      if(confirmations?.length&&confirmations.every(Boolean)){
        for(const command of s.request.commands){const key=[...command.personIds].sort().join(':');s.pending.delete(key);s.deferred.delete(key);}
        s.request=null;
        s.notice=null;
      }
      await render();
    }
    async function monitor(duration=MONITOR_TIMEOUT_MS,interval=4000){
      const end=Date.now()+duration;
      while(panel.isConnected){await read();if(!active())break;
        if(Date.now()>=end)throw Error('Kontrollen pågår fortsatt. Hent status senere; ingen ny innsending er nødvendig.');
        await new Promise(resolve=>setTimeout(resolve,interval));}
      if(panel.isConnected)checkTask();
    }
    function checkTask(){
      if(unknownTask())throw Error('Serveren returnerte en ukjent jobbstatus. Hent status senere; ingen ny lagring er bekreftet.');
      if(s.saved.task?.state==='blocked')throw Error(s.saved.task.error||'Privat kontrolljobb er sperret. Avklar gammel jobbpeker i Resultatkontroll.');
      if(s.saved.task?.state==='failed'){
        // A different job (or a stale queue pointer) cannot reject this batch.
        if(matchesRequest(s.saved.task,s.request))s.request=null;
        throw Error(s.saved.task.error || 'Kontrollen stoppet. Ny avgjørelse er ikke bekreftet lagret.');
      }
    }
    function choose(kind,ids,mainPersonId=null,nameValue=null,source='Arrangørens private personkontroll.',reason='Personidentiteten er kontrollert av arrangøren.'){
      if(!s.saved||stale()||active()||blocked()||publishing()||s.request)throw Error('Fullfør eller avklar lagringen og publiseringen før du endrer økten.');
      const key=[...ids].sort().join(':');
      if(!s.pending.has(key)&&s.pending.size>=MAX_SESSION_DECISIONS)
        throw Error('En økt kan inneholde høyst '+MAX_SESSION_DECISIONS+' personavgjørelser. Send de valgte avgjørelsene samlet før du legger til flere.');
      s.pending.set(key,intent(kind,ids,mainPersonId,nameValue,source,reason));
      if(kind==='defer')s.deferred.add(key);else s.deferred.delete(key);
      s.notice=null;
      return render();
    }
    async function submitBatch(){
      if(!s.pending.size)throw Error('Velg minst én avgjørelse først.');
      if(s.pending.size>MAX_SESSION_DECISIONS)throw Error('Maksimalt '+MAX_SESSION_DECISIONS+' avgjørelser kan sendes i én økt.');
      if(stale()||active()||publishing()||s.request)throw Error('Kontroller forrige innsending eller publisering først.');
      const commands=[...s.pending.values()];
      s.request={commands,expectedRevision:s.saved.revision};
      s.notice={text:'Lagring pågår. Sender '+commands.length+' avgjørelser til felles privat kontroll. Ingen er bekreftet lagret ennå.'};renderStatus();
      try {
        const receipt=await identityApi('/identity/batch',s.request);
        if(receipt.queued!==true||!/^[a-z0-9]{20,32}$/.test(receipt.id))throw Error('Uventet jobbkvittering. Hent status før du sender på nytt.');
        s.request.taskId=receipt.id;
      }
      catch(error){
        if([400,403,404,409,413].includes(error.status))s.request=null;
        if(error.status===404)throw Error('Denne serverversjonen støtter ikke samlet personkontroll. Valgene er ulagret; utrulling må avklares.');
        throw error;
      }
      await monitor();
      if(s.request)throw Error('Ingen samlet lagringskvittering er mottatt. Hent ny status.');
      s.selected=null;s.selectedCase=null;editor.replaceChildren();
      await render();
      if(panel.isConnected&&commands.some(command=>command.kind==='same-person')&&
        principal?.identityPublicationEnabled===true&&s.saved.publication?.enabled===true&&!stale()&&!publishing()){
        s.notice={text:'Avgjørelsene er lagret privat. Kontrollerer før og etter.'};renderStatus();
        try{await publicationAction('check');s.notice=null;}
        catch(error){throw Error('Avgjørelsene er lagret privat. Før-/etter-kontrollen kunne ikke fullføres. '+error.message);}
      }
    }
    function intent(kind,ids,mainPersonId,nameValue,source,reason){return {
      format:'morothon-identity-decision-v1',version:1,id:'identity-'+crypto.randomUUID(),base,
      kind,personIds:ids,mainPersonId,name:nameValue,source,reason};}
    // Make the comparison visible immediately instead of rendering it below a long worklist.
    function openComparison(ids,stored){
      inspect(ids,stored);
      editor.setAttribute('tabindex','-1');
      editor.focus({preventScroll:true});
      editor.scrollIntoView({behavior:'auto',block:'start'});
    }
    function inspect(ids,stored){
      editor.replaceChildren();s.selected=ids;s.selectedCase=stored?.id || null;
      const title=node('h2',deferredCase(stored)?'Utsatt sak – lagret privat':stored?'Lagret identitetsavgjørelse':'Sammenlign og bekreft identitet');editor.append(title);
      const profiles=node('div');profiles.className='correction-profiles';
      const years=ids.map(id=>new Set(model.resultsFor(id).filter(H.countsAsParticipation).map(r=>r[0])));
      if(years.length===2){
        const shared=[...years[0]].filter(year=>years[1].has(year)).sort((a,b)=>a-b);
        if(shared.length)editor.append(node('p','Begge profilene har deltakelse i '+shared.join(', ')+'. Undersøk distanse, status og tid før du slår sammen.','identity-shared-years'));
      }
      for(const id of ids){const p=node('article');p.className='correction-profile';const stats=model.stats(id);
        p.append(node('h3',name(id)),node('p',(stats?.count||0)+' tellende deltakelsesår'),node('p',(stats?.years||[]).join(', ')));
        const aliases=identityContext.history.aliases?.[id]||[];
        if(aliases.length)p.append(node('p','Tidligere navn/alias: '+aliases.join(', ')));
        const results=node('details');results.open=true;results.append(node('summary','Alle registrerte resultater'));
        for(const row of model.resultsFor(id).slice().sort((a,b)=>b[0]-a[0]))
          results.append(node('p',[
            row[0],row[2],row[3],row[4],
            'Tid '+(row[5]||'ikke oppgitt'),
            'Plass '+(row[6]??'ikke oppgitt'),
            'Startnr '+(row[9]||'ikke oppgitt')].join(' · ')));
        p.append(results);profiles.append(p);}
      editor.append(profiles);
      if(stored){
        editor.append(node('p',stored.status==='rejected'?'Bekreftet forskjellige personer – lagret privat.':identityState()),
          node('p',stored.reason),node('p','Kilde: '+stored.source));
        if(stored.change){const diff=node('details');diff.append(node('summary','Eksakte før- og etterverdier'),
          node('pre',JSON.stringify({before:stored.change.before,after:stored.change.after},null,2)));editor.append(diff);}
        const report=s.saved.inspection?.impacts.find(i=>i.caseId===stored.id);
        if(report){const before=node('div');before.className='correction-diff';
          before.append(node('pre',JSON.stringify(report.before,null,2)),node('pre',JSON.stringify(report.after,null,2)));
          editor.append(node('h3','Serverkontrollerte konsekvenser – før og etter'),before,
            node('p','Berørte beregninger: '+(report.changed.join(' · ')||'Ingen')));
          for(const warning of [...report.uncertain,...report.errors])editor.append(node('p','Krever avklaring: '+(warning.code||warning)));}
        if(!deferredCase(stored)){
          editor.append(node('p','Ingen offentlig profil er endret. En ny vurdering av denne avgjørelsen krever særskilt kontroll.'));return;
        }
        editor.append(node('p','Lagret til oppfølging. Velg samme eller forskjellige personer når saken er avklart. Valget sendes med resten av økten.'));
      }
      const source=input('identitySource',stored?.source||'Arrangørbekreftelse i beskyttet personkontroll.'),reason=input('identityReason',stored?.reason||'Identiteten er kontrollert av arrangøren.');
      source.maxLength=1500;reason.maxLength=2000;
      editor.append(field('Kilde eller bekreftelse',source),field('Begrunnelse',reason));
      if(ids.length===2){
        const main=select([['','Velg hovednavn'],...ids.map(id=>[id,name(id)])],C.preferredMainProfile(model,ids)||'','identityMainPerson');
        editor.append(field('Hovednavn ved sammenslåing',main),node('p','Alle registreringer og gamle lenker bevares. Deltakelser, merker og øvrige konsekvenser kontrolleres på serveren.'));
        editor.append(btn('Samme person – legg i økten','identitySame',async()=>{
          if(!main.value)throw Error('Velg hvilket hovednavn som skal beholdes.');
          return choose('same-person',ids,main.value,null,source.value,reason.value);}),
        btn('Forskjellige personer – legg i økten','identityDifferent',async()=>{
          return choose('different-people',ids,null,null,source.value,reason.value);}),
        btn('Undersøk senere – legg i økten','identityLater',()=>{
          return choose('defer',ids,null,null,source.value,reason.value);}));
      }
      const other=node('details');other.append(node('summary','Hovednavn og alias uten sammenslåing'));
      const target=select(ids.map(id=>[id,name(id)]),ids[0],'identityNameTarget'),value=input('identityNewName');value.maxLength=200;
      other.append(field('Profil',target),field('Navn eller alias',value),
        btn('Legg navneendring i økten','identityRename',()=>choose('rename',[target.value],null,value.value,source.value,reason.value)),
        btn('Legg alias i økten','identityAlias',()=>choose('alias',[target.value],null,value.value,source.value,reason.value)));
      editor.append(other);disable();
    }
    async function render(){
      const version=++s.version;
      let draft=s.saved?.draft || C.empty(base);
      if(stale()){draft=structuredClone(draft);for(const c of draft.cases)if(c.change&&c.status!=='rejected')c.status='review';}
      const work=await C.worklist(suggestions,draft);if(version!==s.version)return;
      counts.replaceChildren();
      for(const [key,label,n] of [['pending','Ubehandlede',work.identity.filter(c=>c.bucket==='pending'&&!s.pending.has([...c.personIds].sort().join(':'))).length],
        ['unsaved','Ulagrede avgjørelser',s.pending.size],
        ['session-followup','Undersøk senere · ikke lagret',work.identity.filter(c=>s.deferred.has([...c.personIds].sort().join(':'))).length],
        ['finished','Behandlede',work.identity.filter(c=>c.bucket==='finished'&&c.caseStatus!=='rejected').length],
        ['rejected','Avviste par',work.identity.filter(c=>c.caseStatus==='rejected').length]]){
        const card=node('article');card.dataset.identityCount=key;card.append(node('strong',String(n)),node('span',label));counts.append(card);}
      const followups=node('article');followups.dataset.identityCount='followup';
      followups.append(node('strong',String(work.identity.filter(c=>deferredCase(s.saved?.draft?.cases.find(x=>x.id===c.caseId))).length)),
        node('span','Undersøk senere · lagret privat'));counts.append(followups);
      // Searching/filtering must not erase an unresolved server error.
      renderStatus();
      tray.hidden=!s.pending.size;
      tray.replaceChildren(node('h3',s.pending.size===1?'1 valgt avgjørelse':s.pending.size+' valgte avgjørelser'));
      const selections=node('div');selections.className='identity-selection-list';
      for(const [key,cmd] of s.pending){
        const entry=node('div');entry.className='identity-batch-entry';
        entry.append(node('span',cmd.personIds.map(name).join(' / ')+' · Ulagret avgjørelse · '+({ 'same-person':'Samme person – hovednavn: '+(cmd.kind==='same-person'?name(cmd.mainPersonId):''),'different-people':'Forskjellige personer',defer:'Undersøk senere',rename:'Hovednavn',alias:'Alias'}[cmd.kind]||cmd.kind)),
          btn('Angre','identityUndo-'+cmd.id,()=>{s.pending.delete(key);s.deferred.delete(key);s.notice=null;return render();}));selections.append(entry);
      }
      tray.append(selections,submit);
      list.replaceChildren();
      const rows=work.identity.filter(c=>{
        const key=[...c.personIds].sort().join(':'),deferred=s.deferred.has(key);
        const visible=s.scope==='all'||(s.scope==='followup'?deferred||c.bucket==='followup':
          s.scope==='pending'?c.bucket==='pending'&&!s.pending.has(key):
          s.scope==='rejected'?c.caseStatus==='rejected':
          c.bucket===s.scope&&(s.scope!=='finished'||c.caseStatus!=='rejected'));
        return visible&&[c.reason,...c.personIds.map(name)].join(' ').toLocaleLowerCase('nb-NO').includes(s.query.toLocaleLowerCase('nb-NO'));
      });
      for(const c of rows.slice(0,40)){const card=node('article');card.className='correction-case';
        card.append(node('h3',c.personIds.map(name).join(' / ')));
        // Surface source-backed participation years before any identity choice.
        // DNS is not participation, DNF remains participation by event rules.
        const allYears=c.personIds.map(id=>[...new Set(model.resultsFor(id)
          .filter(H.countsAsParticipation).map(row=>row[0]))].sort((a,b)=>a-b));
        const shared=allYears.length===2?allYears[0].filter(year=>allYears[1].includes(year)):[];
        for(let i=0;i<c.personIds.length;i++){
          const y=node('p',name(c.personIds[i])+': '+(allYears[i].length?allYears[i].join(', '):'ingen tellende deltakelser'));
          y.className='identity-participation-years';card.append(y);
        }
        if(shared.length){
          const evidence=node('p','Begge er registrert i '+shared.join(', ')+'. Kontroller løp, distanse og tider før eventuell sammenslåing.');
          evidence.className='identity-shared-years';card.append(evidence);
        }
        card.append(node('p',c.reason));
        const stored=s.saved?.draft?.cases.find(x=>x.id===c.caseId);
        const choice=s.pending.get([...c.personIds].sort().join(':'));
        if(choice){const label=node('p','Ulagret avgjørelse · '+({'same-person':'Samme person – hovednavn: '+(choice.kind==='same-person'?name(choice.mainPersonId):''),
          'different-people':'Forskjellige personer',defer:'Undersøk senere'}[choice.kind]||'Endring valgt'));
          label.className='identity-unsaved';card.append(label);}
        if(c.personIds.length===2 && ((!stored&&c.bucket==='pending')||deferredCase(stored))){
          // Restore the original quick workflow on each suggestion. Reuse the
          // same authenticated, versioned decision path as the detailed editor.
          const quick=node('div');quick.className='actions identity-quick-actions';
          const main=select(c.personIds.map(id=>[id,name(id)]),choice?.mainPersonId||C.preferredMainProfile(model,c.personIds)||c.personIds[0],
            'identityQuickMain-'+c.id);
          quick.append(field('Hovednavn ved sammenslåing',main),
            btn('Samme person','identityQuickSame-'+c.id,()=>{
              return choose('same-person',c.personIds,main.value,null,
                'Arrangørbekreftelse i beskyttet personkontroll.',
                'Arrangøren bekrefter at profilene gjelder samme person.');
            }),
            btn('Forskjellige personer','identityQuickDifferent-'+c.id,()=>{
              return choose('different-people',c.personIds,null,null,
                'Arrangørbekreftelse i beskyttet personkontroll.',
                'Arrangøren bekrefter at profilene gjelder forskjellige personer.');
            })
          );
          if(!stored)quick.append(btn(s.deferred.has([...c.personIds].sort().join(':'))?'Angre utsettelse':'Undersøk senere',
              'identityQuickLater-'+c.id,()=>{
                const key=[...c.personIds].sort().join(':');
                if(s.deferred.has(key)){s.pending.delete(key);s.deferred.delete(key);s.notice=null;return render();}
                return choose('defer',c.personIds,null,null,'Arrangørens private personkontroll.','Saken må undersøkes nærmere før identiteten avgjøres.');
              })
          );
          card.append(quick);
        }
        const compare=btn(stored&&!deferredCase(stored)?'Vis lagret avgjørelse':'Sammenlign profiler','identityOpen-'+(c.caseId||c.id),()=>openComparison(c.personIds,stored),{readOnly:true});
        compare.classList.add('identity-quick-compare');card.append(compare);list.append(card);}
      if(!rows.length)list.append(node('p',s.scope==='pending'&&s.pending.size?
        'Ingen ubehandlede saker i dette utvalget. Valgene i denne økten er fortsatt ulagret.':
        'Ingen saker i dette utvalget. Lagrede vurderinger finnes under Behandlede eller Avviste par.'));
      if(rows.length>40)list.append(node('p','Viser de første 40 treffene. Avgrens med navnesøket.'));
      archive.replaceChildren(node('summary','Tidligere kildegrunnlag · '+(s.saved?.archives||[]).length));
      for(const old of s.saved?.archives||[]){const group=node('details');group.append(node('summary','Dataversjon '+old.base.dataVersion+' · '+old.draft.cases.length+' bevarte saker'));
        for(const c of old.draft.cases)group.append(node('p',c.personIds.map(name).join(' / ')+' · '+c.reason));archive.append(group);}
      if(s.selectedCase){const stored=s.saved.draft?.cases.find(c=>c.id===s.selectedCase);if(stored)inspect(stored.personIds,stored);}
      renderPublication();disable();
    }
    async function publicationAction(action,extra={}){
      if(principal?.identityPublicationEnabled!==true||s.saved?.publication?.enabled!==true)
        throw Error('Identitetspublisering er ikke aktivert.');
      if(s.pending.size||s.request)throw Error('Lagre eller angre valgene i økten før publiseringskontroll.');
      await identityApi('/identity/publication/'+action,{expectedRevision:s.saved.revision,
        expectedDigest:s.saved.publication.digest,...extra});
      if(action==='publish'||action==='continue')await monitor(45*60*1000,12000);
      else await monitor();
      s.notice=null;
    }
    function renderPublication(){
      publicationPanel.replaceChildren();
      publicationHistory.replaceChildren();
      publicationHistory.hidden=true;
      publicationPanel.hidden=principal?.identityPublicationEnabled!==true||s.saved?.publication?.enabled!==true;
      if(publicationPanel.hidden)return;
      const p=s.saved.publication,r=p.review,job=p.job;
      const privateChanges=p.reversalOf || s.saved.draft?.cases.some(c=>c.change&&c.status!=='rejected');
      publicationPanel.hidden=!privateChanges&&!job;
      const label={prepared:'Godkjent – klar til publisering',submitting:'Sender godkjent endring',checking:'Tester endringen',
        deploying:'Oppdaterer nettsiden',verifying:'Kontrollerer offentlig profil og statistikk',published:'Publisert og etterkontrollert',
        failed:'Publisering stoppet', 'needs-review':'Publisering trenger en godkjenning eller avklaring',cancelled:'Publisering avbrutt'};
      publicationPanel.append(node('h3',p.reversalOf?'Tilbakeføring av identitet':'Publisering av identitet'));
      const unresolvedJob=job&&!['published','cancelled','prepared'].includes(job.stage);
      const message=node('p',unresolvedJob?label[job.stage]:s.saved.status==='review-approved'&&s.saved.approval?.scope==='identity-publication'?
        'Godkjent – ikke publisert. Bekreft publisering som en egen handling.':r?.ready?'Kontrollert – klar til publisering.':
        privateChanges?'Lagret privat. Kontroller før-/etter-visningen før publisering.':label[job?.stage]||
        'Lagret privat. Kontroller før-/etter-visningen før publisering.');
      message.id='identityPublicationStatus';message.setAttribute('role','status');publicationPanel.append(message);
      if(publicationRunning())publicationPanel.append(node('p','Beregn rundt 15 minutter til publisering og etterkontroll. Det kan ta lenger ved kø. Jobben fortsetter hvis du går til en annen side eller må logge inn igjen.'));
      if(job?.error)publicationPanel.append(node('p',job.error));
      if(r){
        publicationPanel.append(node('p',(r.operation==='reverse'?'Tilbakeføring':r.merges+' bekreftede sammenslåinger')+
          ' · '+r.retained.different+' avviste par og '+r.retained.deferred+' oppfølgingssaker beholdes privat.'));
        const table=node('table'),head=node('tr');table.className='identity-publication-table';for(const text of ['Profil','Før','Etter'])head.append(node('th',text));table.append(head);
        for(const id of r.personIds){const before=r.before.profiles[id],after=r.after.profiles[id],tr=node('tr');
          const description=v=>v?v.name+' · '+v.count+' deltakelser'+(v.years?.length?' · '+v.years.join(', '):''):'Tidligere lenke videreføres til hovedprofilen';
          tr.append(node('td',before?.name||after?.name||id),node('td',description(before)),node('td',description(after)));table.append(tr);}
        const wrap=node('div');wrap.className='table-wrap';wrap.style.overflowX='auto';wrap.append(table);publicationPanel.append(wrap);
        const detail=node('details');detail.append(node('summary','Resultater, hovednavn, alias og øvrige konsekvenser'));
        for(const side of ['before','after']){const v=r[side];detail.append(node('h4',side==='before'?'Før':'Etter'));
          for(const id of r.personIds){const profile=v.profiles[id];if(!profile)continue;
            detail.append(node('p',profile.name+' · alias: '+(v.aliases[id].join(', ')||'ingen')+
              ' · beste tider: '+((profile.best||[]).map(b=>[b.event,b.time,b.year].filter(Boolean).join(' ')).join('; ')||'ingen registrert')));
            const loyalty=v.loyalty[id];if(loyalty)detail.append(node('p','Lojalitet: '+loyalty.count+' av '+loyalty.poss+' utgaver'+
              (Number.isFinite(loyalty.pct)?' · '+Math.floor(loyalty.pct*1000)/10+' %':'')));
          }
          for(const row of v.placements)detail.append(node('p',[row.year,row.event,row.distance?row.distance+' km':'',row.time,
            row.rank?'plass '+row.rank:''].filter(Boolean).join(' · ')));
          detail.append(node('p','Rangeringer: '+Object.entries(v.rankings).map(([id,rank])=>(v.profiles[id]?.name||name(id))+': '+(rank??'samlet i hovedprofil')).join(' · ')));
          for(const record of v.records)detail.append(node('p','Løyperekord: '+[record.event,record.name,record.time,record.year].filter(Boolean).join(' · ')));
        }
        const labels={people:'personprofiler',annual:'årsstatistikk',loyalty:'lojalitet',diplomas:'diplomgrunnlag',rankings:'rangeringer',records:'løyperekorder',placements:'plasseringer',redirects:'gamle profillenker',aliases:'alias'};
        detail.append(node('p','Endrede beregninger: '+r.changed.map(key=>labels[key]||key).join(', ')+'. Resultatlinjer, tider, distanser og løypedefinisjoner bevares.'));
        publicationPanel.append(detail);
      }
      const actions=node('div');actions.className='actions';
      const control=(title,id,action,disabled,target=actions)=>{const b=btn(title,id,action);b.disabled=!!disabled;b.dataset.blocked=String(!!disabled);target.append(b);};
      if(privateChanges&&!r?.ready&&!unresolvedJob)control('Kontroller før / etter','identityPublicationCheck',()=>publicationAction('check'),stale()||publishing()&&!p.reversalOf);
      if(r?.ready&&!unresolvedJob)control(p.reversalOf?'Bekreft og publiser tilbakeføring':'Bekreft publisering','identityPublicationPublish',async()=>{
        const candidateDigest=r.candidateDigest;
        const revision=s.saved.revision;
        const approved=s.saved.status==='review-approved'&&s.saved.approval?.scope==='identity-publication';
        if(!approved)await publicationAction('approve',{candidateDigest});
        if(!panel.isConnected)return;
        if(stale()||s.saved.revision!==revision+(approved?0:1)||
          s.saved.status!=='review-approved'||s.saved.approval?.scope!=='identity-publication'||
          s.saved.approval?.candidateDigest!==candidateDigest||s.saved.publication?.review?.candidateDigest!==candidateDigest)
          throw Error('Godkjent før-/etter-grunnlag kunne ikke bekreftes. Hent status før publisering.');
        await publicationAction('publish',{confirmation:true});
      },stale()||p.locked||!r?.ready||!!job&&!['published','cancelled','failed','prepared'].includes(job.stage));
      if(job&&!['published','cancelled'].includes(job.stage)&&(job.stage!=='prepared'||p.locked)&&!active())control('Fortsett publiseringskontroll','identityPublicationContinue',()=>publicationAction('continue'),false);
      if(p.reversalOf||s.saved.approval?.scope==='identity-publication')control('Avbryt godkjenning / tilbakeføringsutkast','identityPublicationCancel',()=>publicationAction('cancel'),p.locked);
      if(actions.childElementCount)publicationPanel.append(actions);
      if((p.history||[]).length||job?.stage==='published'){
        publicationHistory.hidden=false;
        publicationHistory.append(node('summary','Tidligere publiseringer'));
        for(const entry of p.history||[])publicationHistory.append(node('p','Publisert og kontrollert · '+entry.publishedAt+(entry.reversalOf?' · tilbakeføring':'')));
      }
      if(job?.stage==='published'&&!p.reversalOf)control('Forbered tilbakeføring','identityPublicationReverse',()=>{
        if(confirm('Forberede tilbakeføring? Før-/etter-visning og en ny eksplisitt godkjenning kreves før noe publiseres.'))
          return publicationAction('reverse',{publicationId:job.id,confirmation:true});
      },stale(),publicationHistory);
    }
    const submit=btn('Lagre avgjørelser privat','identityBatchSubmit',submitBatch);
    const refresh=btn('Hent lagrede avgjørelser','identityRefresh',async()=>{
      s.notice={text:'Henter lagrede avgjørelser fra serveren. Dette lagrer ikke valgene dine.'};renderStatus();
      await monitor();
      s.notice={text:'Status hentet fra serveren. '+identityState()+' · revisjon '+s.saved.revision+'.'+
        (s.pending.size?' '+s.pending.size+' avgjørelse'+(s.pending.size===1?' er':'r er')+' fortsatt ulagret. Bruk «Lagre avgjørelser privat».':'')+
        (s.request?' Lagringen er fortsatt ikke bekreftet. Hent status før ny innsending.':'')};
    });
    const approve=btn('Godkjenn lagrede avgjørelser','identityApprove',async()=>{
      if(!confirm('Godkjenne nøyaktig denne lagrede revisjonen? Dette publiserer ikke identitetsendringer.'))return;
      s.notice=null;await identityApi('/identity/approve',{expectedRevision:s.saved.revision,expectedDigest:s.saved.digest});await monitor();});
    const revalidate=btn('Kontroller ny historikkversjon','identityRevalidate',async()=>{
      if(!confirm('Bevare alle gamle saker i historikken og kontrollere avviste par mot ny kilde? Sammenslåinger må vurderes på nytt. Ingen publisering.'))return;
      s.notice=null;await identityApi('/identity/revalidate',{expectedRevision:s.saved.revision,expectedDigest:s.saved.digest});await monitor();});
    const retry=btn('Hent status / fortsett lagring','identityRetry',async()=>{
      s.notice=null;await monitor();
      if(s.request)throw Error('Uavklart lagringsforsøk. Kontroller serverstatus før eventuell ny innsending.');
    });
    const reload=btn('Last inn oppdatert historikk','identityReload',()=>location.reload());
    const check=btn('Kontroller lagrede avgjørelser','identityCheck',async()=>{
      s.notice=null;await identityApi('/identity/check',{expectedRevision:s.saved.revision,expectedDigest:s.saved.digest});await monitor();});
    approve.hidden=true;check.hidden=true;
    controls.append(revalidate,retry,reload,approve,check);
    const search=input('identitySearch');search.type='search';search.oninput=()=>{s.query=search.value;render().catch(e=>{status.textContent=e.message;});};
    const filter=select([['pending','Ubehandlede'],['finished','Behandlede'],['rejected','Avviste par'],['followup','Undersøk senere'],['all','Alle saker']],'pending','identityFilter');
    filter.onchange=()=>{s.scope=filter.value;render().catch(e=>{status.textContent=e.message;});};
    const manual=node('details');manual.append(node('summary','Finn profiler manuelt'));
    const choices=[];
    for(let i=0;i<2;i++){const q=input('identityManualSearch'+i),selectPerson=select([['','Velg profil']],undefined,'identityManualPerson'+i);q.type='search';q.oninput=()=>{
      const folded=window.MorothonIntake.fold(q.value);selectPerson.replaceChildren(node('option','Velg profil'));selectPerson.firstChild.value='';
      if(folded.length<2)return;
      for(const p of [...identityContext.context.people.values()].filter(p=>p.names.some(n=>window.MorothonIntake.fold(n.name).includes(folded))).slice(0,30)){
        const o=node('option',p.name);o.value=p.id;selectPerson.append(o);}};
      manual.append(field(i?'Andre profil (ved sammenslåing)':'Søk etter profil',q),selectPerson);choices.push(selectPerson);}
    manual.append(btn('Sammenlign valgte profiler','identityManualOpen',()=>{
      const ids=choices.map(e=>e.value).filter(Boolean);if(!ids.length||new Set(ids).size!==ids.length)throw Error('Velg én eller to ulike profiler.');openComparison(ids,null);},{readOnly:true}));
    const filters=node('div');filters.className='identity-filters';
    filters.append(field('Søk etter navn',search),field('Vis saker',filter));
    const overview=node('details');overview.append(node('summary','Oversikt over saker'),counts);
    const footer=node('div');footer.className='actions identity-secondary-actions';
    footer.append(refresh,btn('Logg ut','identityLogout',()=>actions.logout.click()));
    panel.append(node('h2','Personkontroll'),filters,status,actionHelp,controls,tray,publicationPanel,
      list,editor,manual,overview,publicationHistory,archive,footer);host.replaceChildren(panel);
    const nav=node('a','Personkontroll');nav.id='navIdentity';nav.href='#personkontroll';document.querySelector('.sidebar nav').append(nav);
    workspace().usePrivateIdentities?.();
    // The shared session renderer owns authentication labels. Mounting a
    // module must not replace the already confirmed owner/session state.
    const annual=node('a','Rett og kontroller eksisterende resultater');annual.href='#rettelser';$('view-import').prepend(annual);
    renderStatus();disable();
    // Startup must not wait for a private workflow to finish before revealing
    // the authenticated shell. A queued job is readable state, not a login gate.
    try{await read();if(!active())checkTask();}catch(error){s.notice={text:error.message+' Ingen ny lagring er bekreftet.',error:true};}
    finally{s.busy=false;renderStatus();disable();}
    if(publicationRunning()){
      s.busy=true;disable();
      void monitor(45*60*1000,12000).catch(error=>{
        s.notice={text:error.message,error:true};
      }).finally(()=>{s.busy=false;renderStatus();disable();});
    }
  }
  async function login() {
    const verifier = b64(crypto.getRandomValues(new Uint8Array(32))),
      state = b64(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(
      flowKey,
      JSON.stringify({ verifier, state, expires: Date.now() + 5 * 60000 }),
    );
    const url = new URL("/auth/begin", origin);
    url.search = new URLSearchParams({
      challenge: await digest(verifier),
      state,
    });
    location.assign(url.href);
  }
  async function completeLogin() {
    const params = loginReturn;
    if (params.has("morothon-auth-error")) {
      history.replaceState(null, "", "#rettelser");
      sessionStorage.removeItem(flowKey);
      throw Error(
        "GitHub-innlogging ble avbrutt eller kontoen har ikke tilgang.",
      );
    }
    if (!params.has("morothon-auth")) return;
    const proof = JSON.parse(sessionStorage.getItem(flowKey) || "null");
    sessionStorage.removeItem(flowKey);
    history.replaceState(null, "", "#rettelser");
    if (
      !proof ||
      proof.expires < Date.now() ||
      proof.state !== params.get("state")
    )
      throw Error(
        "Innloggingen er utløpt eller gjelder en annen fane. Start på nytt.",
      );
    const result = await api("/auth/exchange", {
      code: params.get("morothon-auth"),
      verifier: proof.verifier,
    });
    sessionToken = result.sessionToken;
    principal = await api("/session");
  }
  const matches = () =>
    !!localSaved &&
    !!saved &&
    localSaved.snapshot === JSON.stringify(workspace()?.exportDraft()) &&
    localSaved.revision === saved.revision &&
    localSaved.digest === saved.digest;
  function button(label, id, action) {
    const b = node("button", label);
    b.type = "button";
    b.id = id;
    b.onclick = async () => {
      if (busy) return;
      busy = true;
      render();
      try {
        await action();
      } catch (e) {
        status.textContent = e.message;
        home.textContent = e.message;
      } finally {
        busy = false;
        showHistory();
        renderControls();
      }
    };
    return b;
  }
  function stage() {
    const p = saved?.publication,
      t = saved?.task;
    if (t?.state === "blocked") return t.error || "Tidligere privat kontrolljobb krever avklaring.";
    if (t && !["completed", "failed"].includes(t.state))
      return t.action === "validate"
        ? "Kontrollerer rettelsen …"
        : t.action === "reverse"
          ? "Forbereder tilbakeføring …"
          : "Behandler godkjent endring …";
    if (t?.state === "failed")
      return t.error || "Kontrollen stoppet. Lagret arbeid er bevart.";
    if (
      saved?.draft?.cases.length &&
      ["validate", "reverse"].includes(t?.action)
    )
      return "Lagret utkast. Ingen endring er publisert.";
    return (
      {
        prepared: "Rettelsen er klar til publisering.",
        submitting: "Sender godkjent endring …",
        checking: "Tester endringen …",
        deploying: "Oppdaterer nettsiden …",
        verifying: "Kontrollerer offentlig resultat …",
        published: "Publisert og kontrollert.",
        failed: "Publisering feilet. Se kontrollinformasjon.",
        "needs-review": "En godkjenning eller avklaring gjenstår.",
        cancelled: "Publisering avbrutt.",
      }[p?.stage] ||
      (saved?.draft?.cases.length
        ? "Lagret utkast. Ingen endring er publisert."
        : "Ingen lagret rettelse.")
    );
  }
  function renderControls() {
    if (!box) return;
    const pending =
        saved?.task && !["completed", "failed"].includes(saved.task.state),
      editable = !!principal && !pending;
    actions.login.hidden = protectedPortal || !!principal;
    actions.login.disabled = busy;
    actions.logout.hidden = !principal;
    actions.logout.disabled = busy;
    for (const k of ["save", "load", "discard"])
      actions[k].disabled = busy || !editable;
    actions.save.disabled ||=
      !!saved?.draft &&
      JSON.stringify(saved.draft.base) !==
        JSON.stringify(workspace()?.exportDraft().base);
    actions.load.disabled ||= !saved?.draft?.cases.length;
    actions.discard.disabled ||= !saved?.draft?.cases.length;
    actions.publish.disabled =
      busy ||
      !editable ||
      !matches() ||
      !saved?.validation?.ready ||
      saved.stale;
    actions.publish.textContent = saved?.reversalOf
      ? "Bekreft og publiser tilbakeføring"
      : "Godkjenn og publiser";
    actions.continue.hidden =
      !saved?.publication ||
      ["published", "cancelled"].includes(saved.publication.stage);
    actions.continue.disabled = busy || !editable;
    actions.recover.hidden = saved?.task?.state !== "blocked";
    actions.recover.disabled = busy || !principal || !Number.isSafeInteger(saved?.task?.queueRevision);
    actions.retry.hidden = saved?.task?.state !== "queued";
    actions.retry.disabled = busy || !principal;
    actions.cancel.hidden = actions.retry.hidden;
    actions.cancel.disabled = busy || !principal;
    actions.reload.hidden = saved?.publication?.stage !== "published";
    actions.reload.disabled = busy;
    window.MorothonReviewClient = {canEdit:!!principal,matchesSavedResult:matches,
      annualImportAvailable:protectedPortal && principal?.annualImportPersistence === true,annualRequest,
      resultImportAvailable:protectedPortal && principal?.resultImportPersistence === true,
      resultImportBusy:busy || !editable};
    document.dispatchEvent(new CustomEvent('morothon:result-service-state'));
  }
  function showReview() {
    diff.replaceChildren();
    const v = saved?.validation;
    if (!v) return;
    diff.append(
      node(
        "h3",
        v.ready ? "Kontrollert før og etter" : "Rettelsen krever avklaring",
      ),
    );
    for (const c of v.review?.changes || []) {
      const table = node("table"),
        row = node("tr");
      row.append(
        node("th", "Felt"),
        node("th", "Registrert"),
        node("th", "Forslag"),
      );
      table.append(row);
      const labels = [
        "År",
        "Løper",
        "Øvelse",
        "Distanse",
        "Status",
        "Tid",
        "Plassering",
        "Klasse",
        "Klubb",
        "Startnummer",
      ];
      c.before.forEach((value, i) => {
        if (JSON.stringify(value) === JSON.stringify(c.after[i])) return;
        const tr = node("tr");
        tr.append(
          node("th", labels[i]),
          node("td", String(value ?? "–")),
          node("td", String(c.after[i] ?? "–")),
        );
        table.append(tr);
      });
      diff.append(node("h4", c.name), table);
    }
    for (const warning of [
      ...(v.review?.uncertain || []),
      ...(v.review?.errors || []).map((e) => e.code || String(e)),
    ])
      diff.append(node("p", warning));
  }
  function showHistory() {
    historyBox.replaceChildren();
    const current = saved?.publication;
    if (current && current.stage !== "published") {
      const info = node("details"); info.id = "resultServicePublicationDetails";
      info.append(node("summary", "Kontrollinformasjon for pågående endring"));
      if (current.error) info.append(node("p", current.error));
      if (current.remote?.url) {
        const link = node("a", current.stage === "needs-review" ? "Åpne nødvendig godkjenning" : "Åpne endringen");
        link.href = current.remote.url; link.target = "_blank"; link.rel = "noopener"; info.append(link);
      }
      historyBox.append(info);
    }
    historyBox.append(node("h3", "Publiserte rettelser"));
    for (const entry of saved?.history || []) {
      const card = node("article");
      card.style.padding = "1rem 0";
      card.append(
        node("h4", (entry.names || ["Løper"]).join(", ")),
        node(
          "p",
          new Date(entry.publishedAt).toLocaleString("nb-NO") +
            " · Godkjent av " +
            (entry.actor === principal?.userId ? "deg" : "administrator"),
        ),
      );
      for (const c of entry.changes || []) {
        card.append(node("p", c.before[0] + " · " + c.before[2]));
        const labels = ["År", "Løper", "Øvelse", "Distanse", "Status", "Tid", "Plassering", "Klasse", "Klubb", "Startnummer"];
        c.before.forEach((value, i) => {
          if (JSON.stringify(value) !== JSON.stringify(c.after[i]))
            card.append(node("p", labels[i] + ": " + String(value ?? "–") + " → " + String(c.after[i] ?? "–")));
        });
      }
      const undo = button("Trekk tilbake", "withdraw-" + entry.id, async () => {
        if (saved?.draft?.cases.length)
          throw Error("Behandle eller forkast det lagrede utkastet først.");
        if (
          !confirm(
            "Forberede tilbakeføring? Du får se før/etter og må bekrefte før noe publiseres.",
          )
        )
          return;
        await api("/publication/reverse", {
          publicationId: entry.id,
          confirmation: true,
        });
        localSaved = null;
        await read();
        await monitor(true);
      });
      undo.disabled =
        busy ||
        !principal ||
        (saved?.task && !["completed", "failed"].includes(saved.task.state));
      card.append(undo);
      const detail = node("details");
      detail.append(node("summary", "Kontrollinformasjon"));
      if (entry.remote?.url) {
        const a = node("a", "Åpne GitHub-endringen");
        a.href = entry.remote.url;
        a.target = "_blank";
        a.rel = "noopener";
        detail.append(a);
      }
      for (const url of entry.profiles || []) {
        const a = node("a", "Åpne oppdatert løperprofil");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        card.append(a);
      }
      card.append(detail);
      historyBox.append(card);
    }
  }
  function render() {
    if (!box) return;
    const text = principal
      ? stage()
      : "Logg inn med GitHub for å lagre, kontrollere og publisere resultatkorrigeringer.";
    status.textContent = text;
    home.textContent = text;
    showReview();
    showHistory();
    renderControls();
    if (principal) {
      document.querySelector(".local-tag").textContent =
        "Innlogget · Hovedadministrator";
      document.querySelector(".sidebar-note strong").textContent =
        "Privat resultatkontroll";
      document.querySelector(".sidebar-note p").textContent =
        "Utkast og godkjenninger lagres privat. Publisering krever din bekreftelse.";
    } else {
      document.querySelector(".local-tag").textContent = "Ikke innlogget";
      document.querySelector(".sidebar-note strong").textContent =
        "Resultatadministrasjon";
      document.querySelector(".sidebar-note p").textContent =
        "Logg inn for privat lagring og kontrollert publisering.";
    }
  }
  async function read() {
    if (!principal) return;
    const old = saved;
    saved = await api("/review");
    if (localSaved && old?.revision !== saved.revision) localSaved = null;
    render();
  }
  async function restore() {
    if (!saved?.draft) return;
    // After a publication the open tab still has the old immutable public snapshot.
    // Show the server-checked inverse directly; never import it into that old engine.
    // Any local input still invalidates confirmation through the snapshot/dirty guard.
    const sameBase =
      JSON.stringify(saved.draft.base) ===
      JSON.stringify(workspace().exportDraft().base);
    if (sameBase) await workspace().restoreDraft(saved.draft);
    localSaved = {
      snapshot: JSON.stringify(workspace().exportDraft()),
      revision: saved.revision,
      digest: saved.digest,
    };
    renderControls();
  }
  async function monitor(restoreWhenDone = false, version = edits) {
    if (polling) return;
    polling = true;
    try {
      while (principal) {
        await read();
        if (
          !saved?.task ||
          ["completed", "failed", "blocked"].includes(saved.task.state)
        ) {
          if (
            restoreWhenDone &&
            edits === version &&
            saved?.task?.state === "completed" &&
            saved?.draft?.cases.length
          )
            await restore();
          break;
        }
        await new Promise((r) => setTimeout(r, 15000));
      }
    } finally {
      polling = false;
    }
  }
  // Same owner-authenticated CAS store and private validator as manual corrections.
  // The imported packet is never an authorization to approve or publish.
  document.addEventListener('morothon:save-result-import',event=>{
    (async()=>{
      if(!protectedPortal || !principal?.resultImportPersistence)
        throw Error('Privat importlagring er ikke tilgjengelig i denne versjonen.');
      if(busy || polling)throw Error('Vent til den pågående kontrollen er ferdig.');
      const detail=event.detail, snapshot=JSON.stringify(workspace().exportDraft()), version=edits;
      if(workspace().exportDraft().cases.length && !matches())
        throw Error('Du har annet ulagret arbeid i Resultatkontroll. Lagre eller avklar det først; importen er beholdt her.');
      busy=true;renderControls();let receipt;
      try{
        const previousRevision=saved?.revision||0;
        await read();
        if(previousRevision!==(saved?.revision||0) && workspace().exportDraft().cases.length)
          throw Error('Det private utkastet er oppdatert. Hent det på nytt før import.');
        if(saved?.task && !['completed','failed'].includes(saved.task.state))
          throw Error('En privat kontroll pågår. Vent til den er ferdig.');
        if(!detail.isCurrent() || snapshot!==JSON.stringify(workspace().exportDraft()))
          throw Error('Arbeidsgrunnlaget ble endret. Kontroller importen på nytt.');
        const basis=detail.replaceBasis;
        if(basis && (basis.revision!==(saved?.revision||0) || basis.digest!==(saved?.digest||null) ||
          basis.incomingDigest!==await MorothonCorrections.hash(detail.package)))
          throw Error('Et av forslagene er endret. Gjennomgå forskjellene på nytt.');
        const result=receipt=await api('/review/import',{draft:detail.package,
          expectedRevision:saved?.revision||0,expectedDigest:saved?.digest||null,replaceConflicts:!!basis});
        localSaved=null;
        await read();
        if(result.changed || !saved?.validation?.ready){
          await api('/review/validate',{expectedRevision:result.revision,expectedDigest:result.digest});
          await read();await monitor();
        }
        const restored=detail.isCurrent() && edits===version && snapshot===JSON.stringify(workspace().exportDraft()) &&
          saved?.task?.state!=='failed' && saved?.task?.state!=='blocked';
        if(restored)await restore();
        return {...result,ready:saved?.validation?.ready===true,restored,
          problem:saved?.task?.error||null};
      }catch(error){
        if(receipt?.saved)error.message='Rettingene er lagret privat, men videre kontroll kunne ikke bekreftes. Hent lagret utkast i Resultatkontroll. '+error.message;
        throw error;
      }finally{busy=false;render();}
    })().then(event.detail.resolve,event.detail.reject);
  });
  async function mount() {
    if (box || !workspace()) return;
    box = node("section");
    box.id = "resultService";
    box.className = "panel";
    box.style.marginBottom = "1rem";
    status = node("p");
    status.id = "resultServiceStatus";
    status.setAttribute("role", "status");
    diff = node("div");
    diff.className = "intake-table-wrap";
    historyBox = node("div");
    const controls = node("div");
    controls.className = "actions";
    actions.login = button("Logg inn med GitHub", "resultServiceLogin",
      protectedPortal ? () => location.reload() : login);
    actions.logout = button("Logg ut", "resultServiceLogout", async () => {
      if (protectedPortal) {
        const response = await fetch("/admin/_logout", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" }, body: "{}",
        });
        if (!response.ok)
          throw Error("Utlogging kunne ikke bekreftes. Prøv igjen.");
        sessionToken = null;
        principal = null;
        saved = null;
        localSaved = null;
        location.replace("/admin/");
        return;
      }
      await api("/logout", {});
      sessionToken = null;
      principal = null;
      saved = null;
      localSaved = null;
      render();
    });
    actions.save = button(
      "Lagre og kontroller utkast",
      "resultServiceSave",
      async () => {
        const version = edits,
          draft = await workspace().captureDraft(),
          result = await api("/review/save", {
            draft,
            expectedRevision: saved?.revision || 0,
          });
        localSaved = null;
        await api("/review/validate", {
          expectedRevision: result.revision,
          expectedDigest: result.digest,
        });
        await read();
        await monitor(true, version);
      },
    );
    actions.load = button(
      "Hent lagret utkast",
      "resultServiceLoad",
      async () => {
        if (
          workspace().exportDraft().cases.length &&
          !confirm("Erstatte arbeidet i fanen med lagret utkast?")
        )
          return;
        const version = edits;
        await read();
        if (edits !== version)
          throw Error(
            "Arbeidet i fanen ble endret mens utkastet ble hentet. Hent på nytt.",
          );
        await restore();
      },
    );
    actions.discard = button(
      "Forkast utkast",
      "resultServiceDiscard",
      async () => {
        if (
          !confirm(
            "Forkaste det lagrede utkastet? Ingen publiserte resultater endres.",
          )
        )
          return;
        await api("/review/discard", { expectedRevision: saved.revision });
        localSaved = null;
        await read();
        await restore();
      },
    );
    actions.publish = button(
      "Godkjenn og publiser",
      "resultServicePublish",
      async () => {
        if (!matches()) throw Error("Lagre og kontroller siste endring først.");
        if (
          !confirm(
            saved.reversalOf
              ? "Publisere denne tilbakeføringen som vist i før/etter?"
              : "Publisere den kontrollerte rettelsen som vises i før/etter?",
          )
        )
          return;
        await api("/publication/publish", {
          expectedRevision: saved.revision,
          expectedDigest: saved.digest,
          confirmation: true,
        });
        localSaved = null;
        await read();
        await monitor();
      },
    );
    actions.continue = button(
      "Kontroller og fortsett",
      "resultServiceContinue",
      async () => {
        await api("/publication/continue", {
          expectedRevision: saved.revision,
          expectedDigest: saved.digest,
        });
        await read();
        await monitor();
      },
    );
    actions.recover = button(
      "Avklar gammel ugyldig jobbpeker",
      "resultServiceRecover",
      async () => {
        if (!saved?.task || saved.task.state !== "blocked") return;
        if (!confirm("En eldre kontrolljobb har en ugyldig intern referanse. Bekrefter du å rydde KUN denne ugyldige jobbpekeren? Lagrede utkast og publiserte resultater beholdes.")) return;
        await api("/task/recover-invalid", {
          expectedRevision: saved.task.queueRevision,
          confirmation: true,
        });
        await read();
      },
    );
    actions.retry = button(
      "Kontroller oppstart på nytt",
      "resultServiceRetry",
      async () => {
        await api("/task/retry", { id: saved.task.id });
        await monitor();
      },
    );
    actions.cancel = button(
      "Avbryt uavklart oppstart",
      "resultServiceCancel",
      async () => {
        if (
          !confirm(
            "Avbryte oppstarten? En jobb som allerede er startet kan ikke avbrytes her.",
          )
        )
          return;
        await api("/task/cancel", { id: saved.task.id, confirmation: true });
        await read();
      },
    );
    actions.reload = button(
      "Last inn oppdaterte resultater",
      "resultServiceReload",
      () => location.reload(),
    );
    const notice = $("view-rettelser").querySelector(".intake-notice");
    if (notice)
      notice.textContent =
        "Bruk Lagre og kontroller utkast for å bevare resultatkorrigeringen privat. Ingen endring publiseres før du har sett før/etter og bekreftet. Andre typer saker behandles fortsatt lokalt.";
    const advanced = $("correctionAdvanced");
    if (advanced && $("correctionSave")) advanced.append($("correctionSave"));
    document.querySelector(".portal-footer span:last-child").textContent =
      "Resultatadministrasjon · innlogging og personlig godkjenning kreves.";
    controls.append(...Object.values(actions));
    box.append(
      node("h2", "Resultatretting og publisering"),
      node(
        "p",
        "Rett eksisterende resultater. Du får se før og etter, og må bekrefte før publisering. Personsammenslåing publiseres ikke her.",
      ),
      status,
      controls,
      diff,
      historyBox,
    );
    $("view-rettelser").prepend(box);
    const homeCard = node("section");
    homeCard.className = "panel";
    homeCard.style.marginBottom = "1rem";
    home = node("p");
    home.id = "resultServiceHomeStatus";
    const link = node("a", "Finn og rett et resultat");
    link.href = "#deltakere";
    const go = node("a", "Åpne resultatkontrollen");
    go.href = "#rettelser";
    homeCard.append(
      node("h2", "Din resultatadministrasjon"),
      home,
      link,
      node("span", " · "),
      go,
    );
    $("view-oversikt").prepend(homeCard);
    $("view-rettelser").addEventListener("input", (event) => {
      if (event.target.closest("#resultService")) return;
      edits++;
      localSaved = null;
      renderControls();
    });
    render();
    try {
      if (protectedPortal) {
        const response = await fetch("/admin/_session", {
          cache: "no-store", credentials: "same-origin",
        });
        if (!response.ok) { location.replace("/admin/"); return; }
        sessionToken = (await response.json()).sessionToken;
        principal = await api("/session");
      } else {
        await completeLogin();
      }
      if (principal) {
        await read();
        await mountIdentity();
        if (saved?.task && !["completed", "failed", "blocked"].includes(saved.task.state))
          await monitor();
      }
    } catch (e) {
      status.textContent = e.message;
      home.textContent = e.message;
      // This document is only for authenticated users; if its protected
      // session disappears during startup, do not reveal the admin shell.
      if (protectedPortal && !principal) {
        location.replace("/admin/");
        return;
      }
    } finally {
      // Reveal only after the protected session and initial admin state have
      // settled, not when the unhydrated legacy HTML first arrives.
      if (protectedPortal && principal) document.body.dataset.adminReady = "true";
    }
  }
  document.addEventListener("morothon:correction-workspace-ready", () =>
    mount(),
  );
  window.MorothonAdminTransport.ready.then(() => mount()).catch(() => {});
})();

/* Owner-only OAuth smoke test. No result reads, private storage or writes. */
(() => {
  'use strict';
  const configured = document.querySelector('meta[name="morothon-admin-auth-probe"]')?.content;
  if (configured !== 'https://morothon-admin.damofra75.workers.dev') return;
  const origin = configured, flowKey = 'morothon-one-use-login-proof';
  let token = null;
  const params = new URLSearchParams(location.hash.slice(1));
  const panel = document.createElement('section');
  panel.id = 'adminAuthProbe';
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = 'GitHub-innlogging – tilkoblingstest';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.textContent = 'Avslutt testøkten';
  const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const show = (message) => {
    status.textContent = message;
    button.hidden = !!token;
    logout.hidden = !token;
  };
  async function request(path, body, bearer) {
    const response = await fetch(origin + path, {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store',
      headers: {...(body ? {'Content-Type':'application/json'} : {}), ...(bearer ? {Authorization:'Bearer '+bearer} : {})},
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    const data = await response.json();
    if (!response.ok) throw Error(response.status === 403 ? 'GitHub-kontoen har ikke administratortilgang.' : 'Innlogging feilet (HTTP '+response.status+').');
    return data;
  }
  button.textContent = 'Logg inn med GitHub';
  button.onclick = async () => {
    button.disabled = true;
    try {
      const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
      const state = encode(crypto.getRandomValues(new Uint8Array(32)));
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
      sessionStorage.setItem(flowKey,JSON.stringify({verifier,state,expires:Date.now()+300000}));
      const url = new URL('/auth/begin',origin);
      url.search = new URLSearchParams({challenge:encode(digest),state});
      location.assign(url.href);
    } catch(e) { show(e.message); button.disabled = false; }
  };
  logout.onclick = () => { token = null; show('Testøkten avsluttet lokalt.'); };
  panel.append(title,document.createTextNode('Kun innlogging og lesing av egen økt testes. Ingen rettelser lagres eller publiseres.'),status,button,logout);
  function mount() {
    const target = document.getElementById('view-rettelser');
    if (!target || document.getElementById(panel.id)) return false;
    target.prepend(panel);
    show('Ikke innlogget i den nye administrasjonstjenesten.');
    return true;
  }
  async function complete() {
    if (!params.has('morothon-auth') && !params.has('morothon-auth-error')) return;
    const proof = JSON.parse(sessionStorage.getItem(flowKey) || 'null');
    sessionStorage.removeItem(flowKey);
    history.replaceState(null,'','#rettelser');
    if (params.has('morothon-auth-error')) throw Error('GitHub-innlogging ble avbrutt eller avvist.');
    if (!proof || proof.expires < Date.now() || proof.state !== params.get('state')) throw Error('Innloggingen er utløpt eller gjelder en annen fane.');
    const result = await request('/auth/exchange',{code:params.get('morothon-auth'),verifier:proof.verifier});
    token = result.sessionToken;
    const session = await request('/session',null,token);
    show('Innlogget og verifisert av Cloudflare. Bruker: '+String(session.userId || session.actor?.userId || 'godkjent administrator')+'. Ingen skrivefunksjoner er aktivert.');
  }
  const start = async () => { if(!mount())return;try{await complete();}catch(e){token=null;show(e.message);} };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
