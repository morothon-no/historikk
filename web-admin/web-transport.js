/* Static Pages adapter: public reads, isolated previews, no HTTP API or writes. */
(() => {
  'use strict';
  const rootUrl = new URL('../', document.baseURI), adminUrl = new URL('./', document.baseURI);
  let enginePromise, busy = false, release, context;
  const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function json(url) { const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Kunne ikke laste offentlig fil: '+new URL(url).pathname);return r.json(); }
  const ready=(async()=>{
    const [manifest,info,profile]=await Promise.all([json(new URL('public-manifest.json',rootUrl)),json(new URL('build-info.json',rootUrl)),json(new URL('event-profile.json',adminUrl))]);
    if(manifest.schemaVersion!==1||new URL(info.siteUrl).pathname!==rootUrl.pathname)throw Error('Nettversjonens publiseringsadresse eller datakontrakt er ugyldig.');
    const load=async name=>{const key='data/'+name+'.json',r=await fetch(new URL(key,rootUrl),{cache:'no-store'});if(!r.ok)throw Error('Kunne ikke laste '+key);const bytes=await r.arrayBuffer(),entry=manifest.files[key];if(!entry||entry.bytes!==bytes.byteLength||entry.sha256!==await sha(bytes))throw Error('Offentlige data er endret eller fra ulike versjoner. Last siden på nytt.');return JSON.parse(new TextDecoder().decode(bytes));};
    const [history,badges,honors,volunteers]=await Promise.all(['history','badges','honors','volunteers'].map(load));
    MorothonEventProfile.validate(profile,badges);MorothonEventProfile.apply(profile,badges,rootUrl);
    context=MorothonPortalData.createPortalData({history,badges,honorCount:honors.groups.reduce((n,g)=>n+g.members.length,0)+volunteers.people.filter(p=>p.id).length,assetBase:rootUrl.href,profile});
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
  async function request(route,body){
    await ready;const url=new URL(route,'https://adapter.invalid/'),key=url.pathname.slice(1);
    if(body===undefined){
      if(key==='overview')return context.overview();if(key==='participants')return context.participants(url.searchParams);if(key==='badges')return context.badgeList(url.searchParams);
      if(key.startsWith('participants/'))return context.participant(decodeURIComponent(key.slice(13)));
      if(key==='catalog'){if(!window.__eventProfile.modules.diplomer)return {people:[],maxItems:100};const win=await engine();return {people:await win.C1.catalog(),maxItems:100};}
    }
    if(!window.__eventProfile.modules.diplomer)throw Error('Diplommodulen er deaktivert i arrangementsprofilen.');
    if(key==='export'||key.startsWith('jobs/'))throw Error('Kontrollert samlet PDF krever C1-serveren og er ikke tilgjengelig i Pages-testversjonen.');
    if(!['preview','check'].includes(key))throw Error('Denne funksjonen finnes ikke i den offentlige testversjonen.');
    if(busy)throw Error('En diplomkontroll pågår. Vent til den er ferdig.');
    const selected=items(body?.items);if(key==='preview'&&selected.length!==1)throw Error('Velg ett diplom for forhåndsvisning.');
    busy=true;try{await unchanged();const entries=[];let html;
      for(const item of selected){try{const result=await render(item);entries.push(result.entry);html=result.html;}catch(e){entries.push({...item,name:item.personId,status:'blocked',errors:[e.message]});}}
      await unchanged();return {schemaVersion:1,checkedAt:new Date().toISOString(),pageCount:entries.length,entries,...(key==='preview'?{html}:{})};
    }finally{busy=false;}
  }
  async function printPreview(frame){
    if(busy)throw Error('Vent til diplomkontrollen er ferdig.');busy=true;
    try{await unchanged();const win=await engine(),checked=await win.C1.check(frame.contentDocument);
      if(!checked.ready)throw Error(checked.failures.join(' '));await unchanged();
      frame.contentWindow.focus();frame.contentWindow.print();return checked;
    }finally{busy=false;}
  }
  window.MorothonAdminTransport={ready,request,printPreview,rootUrl,capabilities:{batchPdf:false,browserPrint:true},get profile(){return context&&window.__eventProfile;}};
  ready.then(p=>{window.__eventProfile=p;}).catch(()=>{});
})();
