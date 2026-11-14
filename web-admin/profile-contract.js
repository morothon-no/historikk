/* Public configuration contract: no code, remote URLs, private fields or rule changes. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else window.MorothonEventProfile=factory();})(function(){
  'use strict';
  const routes=['oversikt','deltakere','merker','diplomer','import','premier'];
  const fonts={'system-sans':'Arial,Helvetica,sans-serif','classic-serif':'Georgia,serif'};
  function keys(v,names,at){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join('|')!==names.slice().sort().join('|'))throw Error('Ukjente eller manglende profilfelt: '+at);}
  function text(v,at,max=300){if(typeof v!=='string'||!v.trim()||v.length>max||/[<>\u0000-\u0008]/.test(v))throw Error('Ugyldig profiltekst: '+at);}
  function validate(p,registry){
    keys(p,['schemaVersion','id','name','fullName','logoAssetId','colors','fonts','texts','modules','distances','references'],'profil');
    if(p.schemaVersion!==1||!/^[a-z0-9-]{1,64}$/.test(p.id))throw Error('Ukjent profilversjon eller ID.');
    text(p.name,'name',80);text(p.fullName,'fullName',120);text(p.logoAssetId,'logoAssetId',80);
    keys(p.colors,['primary','secondary','accent','background','surface','text'],'colors');for(const color of Object.values(p.colors))if(typeof color!=='string'||!/^#[a-f0-9]{6}$/i.test(color))throw Error('Ugyldig profilfarge.');
    keys(p.fonts,['ui','display'],'fonts');for(const f of Object.values(p.fonts))if(!Object.hasOwn(fonts,f))throw Error('Ukjent fontreferanse.');
    keys(p.texts,['tagline','welcomeTitle','welcomeDescription','footer','pages'],'texts');for(const k of ['tagline','welcomeTitle','welcomeDescription','footer'])text(p.texts[k],k);
    keys(p.texts.pages,routes,'pages');for(const key of routes){keys(p.texts.pages[key],['title','description'],key);text(p.texts.pages[key].title,key,80);text(p.texts.pages[key].description,key);}
    keys(p.modules,routes,'modules');for(const flag of Object.values(p.modules))if(typeof flag!=='boolean')throw Error('Ugyldig modulvalg.');if(!p.modules.oversikt)throw Error('Pilotens oversikt må være aktiv.');
    if(!Array.isArray(p.distances)||p.distances.length>30)throw Error('Ugyldig distanseregister.');const seen=new Set();
    for(const d of p.distances){keys(d,['competition','km','name'],'distance');text(d.competition,'competition',100);text(d.name,'distance name',100);if(!Number.isFinite(d.km)||d.km<=0||d.km>1000||seen.has(d.competition+'|'+d.km))throw Error('Ugyldig eller gjentatt distanse.');seen.add(d.competition+'|'+d.km);}
    keys(p.references,['badgeRegistry','participationPolicy','diplomaTemplate','diplomaTexts','medalDisplay'],'references');
    if(p.references.badgeRegistry!=='data/badges.json'||p.references.participationPolicy!=='morothon-annual-v1'||p.references.diplomaTemplate!=='morothon-landscape-v1'||p.references.diplomaTexts!=='registered-defaults'||!['all','latest'].includes(p.references.medalDisplay))throw Error('Ukjent eller ikke støttet policy-/malreferanse.');
    if(registry&&!registry.badges.some(b=>b.id===p.logoAssetId))throw Error('Logoen finnes ikke i godkjent asset-register.');return p;
  }
  function apply(p,registry,rootUrl){
    validate(p,registry);const style=document.documentElement.style;
    for(const [k,v]of Object.entries(p.colors))style.setProperty('--event-'+k,v);
    style.setProperty('--event-ui-font',fonts[p.fonts.ui]);style.setProperty('--event-display-font',fonts[p.fonts.display]);
    document.querySelector('.portal-brand>span:last-child').firstChild.textContent=p.name.toLocaleUpperCase('nb-NO');
    const logo=document.createElement('img');logo.src=new URL(registry.badges.find(b=>b.id===p.logoAssetId).src,rootUrl).href;logo.alt='';document.querySelector('.brand-mark').replaceChildren(logo);
    document.querySelector('.welcome-card .eyebrow').textContent=p.texts.tagline;document.querySelector('.welcome-card h2').textContent=p.texts.welcomeTitle;document.querySelector('.welcome-card h2').style.whiteSpace='pre-line';
    document.querySelector('.welcome-card p').textContent=p.texts.welcomeDescription;document.querySelector('.portal-footer>span').textContent=p.texts.footer;
    for(const a of document.querySelectorAll('.sidebar nav a')){const key=a.hash.slice(1);if(key==='design')continue;a.hidden=!p.modules[key];for(const n of [...a.childNodes])if(n.nodeType===3&&n.textContent.trim())n.textContent=p.texts.pages[key].title+' ';}
    document.querySelector('#display').value=p.references.medalDisplay;
  }
  return {validate,apply,routes};
});
