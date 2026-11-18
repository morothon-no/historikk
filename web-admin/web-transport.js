/* Static Pages adapter: public reads, isolated previews, no HTTP API or writes. */
(() => {
  'use strict';
  const rootUrl = new URL('../', document.baseURI), adminUrl = new URL('./', document.baseURI);
  let enginePromise, busy = false, release, context, honorContext, honorInput, honorEnabled = true, ownsPackage = false;
  const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function json(url) { const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Kunne ikke laste offentlig fil: '+new URL(url).pathname);return r.json(); }
  const ready=(async()=>{
    const [manifest,info,profile]=await Promise.all([json(new URL('public-manifest.json',rootUrl)),json(new URL('build-info.json',rootUrl)),json(new URL('event-profile.json',adminUrl))]);
    if(manifest.schemaVersion!==1||new URL(info.siteUrl).pathname!==rootUrl.pathname)throw Error('Nettversjonens publiseringsadresse eller datakontrakt er ugyldig.');
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
    release={version:info.version,manifest:JSON.stringify(manifest),adapterUrl:new URL(info.assets[['admin','diploma-adapter.js'].join('/')],rootUrl).href};
    $('webLimitations').hidden=false;$('webPrintControls').hidden=false;
    $('export').textContent='Samlet PDF krever C1-server';$('exportHeading').textContent='Kontroll og videre utskrift';
    document.querySelector('.export-panel>p.hint').textContent='Lagre en kontrollrapport her. Åpne «Vis» for enkeltutskrift via nettleseren. Samlet, kontrollert PDF-produksjon finnes bare i C1-serveren.';
    document.querySelector('[aria-labelledby="jobHeading"]>p.hint').textContent='Rekkefølgen beholdes i kontrollrapporten. Fjern eller flytt mottakere før kontroll.';
    document.querySelector('.shortcut-grid a[href="#diplomer"] p').textContent='Velg mottakere og forhåndsvis kontrollerte enkeltdiplomer.';
    document.querySelector('.local-tag').textContent='Offentlig testversjon · ingen innlogging';
    document.querySelector('.sidebar-note strong').textContent='Offentlig testversjon';
    document.querySelector('.sidebar-note p').textContent='Kun godkjente offentlige data. Ingen lagring eller formell utstedelse.';
    document.querySelector('.portal-footer>span:last-child').textContent='Testversjon uten innlogging · ingen administrative skrivefunksjoner';
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
  async function api(path, value) {
    const r = await fetch(origin + path, {
      method: value === undefined ? "GET" : "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        ...(sessionToken ? { Authorization: "Bearer " + sessionToken } : {}),
        ...(value === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    const data = await r.json();
    if (r.status === 401) {
      sessionToken = null;
      principal = null;
      render();
      throw Error("Logg inn på nytt. Lagret arbeid er bevart.");
    }
    if (!r.ok)
      throw Error(
        data.error ||
          "Kunne ikke fullføre handlingen. Lagret arbeid er bevart.",
      );
    return data;
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
    actions.login.hidden = !!principal;
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
    actions.retry.hidden = saved?.task?.state !== "queued";
    actions.retry.disabled = busy || !principal;
    actions.cancel.hidden = actions.retry.hidden;
    actions.cancel.disabled = busy || !principal;
    actions.reload.hidden = saved?.publication?.stage !== "published";
    actions.reload.disabled = busy;
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
    window.MorothonReviewClient = { canEdit: !!principal };
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
          ["completed", "failed"].includes(saved.task.state)
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
    actions.login = button("Logg inn med GitHub", "resultServiceLogin", login);
    actions.logout = button("Logg ut", "resultServiceLogout", async () => {
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
      await completeLogin();
      if (principal) {
        await read();
        if (saved?.task && !["completed", "failed"].includes(saved.task.state))
          await monitor();
      }
    } catch (e) {
      status.textContent = e.message;
      home.textContent = e.message;
    }
  }
  document.addEventListener("morothon:correction-workspace-ready", () =>
    mount(),
  );
  window.MorothonAdminTransport.ready.then(() => mount()).catch(() => {});
})();
