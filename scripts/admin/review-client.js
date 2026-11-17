/* Served only by authenticated admin backend; never included in the Pages build. */
(() => {
 'use strict';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let session,saved=null,localSaved=null,busy=false,ui,edits=0;
 const labels={empty:'Ingen lagret rettelse',draft:'Utkast', 'review-approved':'Godkjent · ikke publisert'};
 async function api(route,body){
  const r=await fetch('/admin-api/'+route,{cache:'no-store',credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Morothon-CSRF':session.csrf},body:JSON.stringify(body)})});
  if(r.status===401)throw Error('Innloggingen er utløpt. Logg inn igjen; siste lagrede utkast er bevart.');
  const data=await r.json();if(!r.ok)throw Error(data.error||'Kunne ikke fullføre handlingen.');return data;
 }
 function button(label,id,action){const b=node('button',label);b.type='button';b.id=id;b.onclick=async()=>{if(busy)return;busy=true;controls();try{await action();}catch(e){ui.status.textContent=e.message;}finally{busy=false;controls();}};return b;}
 const workspace=()=>window.MorothonCorrectionWorkspace;
 function matchesSaved(){return !!localSaved&&localSaved.snapshot===JSON.stringify(workspace()?.exportDraft())&&localSaved.revision===saved?.revision&&localSaved.digest===saved?.digest;}
 function controls(){if(!ui)return;const current=workspace()?.exportDraft();ui.load.disabled=busy||!saved?.draft;ui.save.disabled=busy||session.role==='viewer';ui.preview.disabled=busy||!current?.cases.length||session.role==='viewer';ui.approve.disabled=busy||session.role!=='owner'||!saved?.draft||saved.stale||!matchesSaved()||saved.status==='review-approved';}
 function currentStatus(){ui.status.textContent=(labels[saved?.status]||'Utkast')+' · revisjon '+(saved?.revision||0)+(saved?.stale?' · Historikken er oppdatert. Krever ny gjennomgang.':'')+'. Offentlige resultater er uendret.';}
 async function read(){saved=await api('review');currentStatus();controls();}
 function showReview(data){
  ui.diff.replaceChildren(node('h3','Kontrollert før og etter'));
  for(const change of data.review.changes){
   const section=node('section'),table=node('table'),head=node('tr');head.append(node('th','Felt'),node('th','Registrert'),node('th','Forslag'));table.append(head);
   const names=['År','Person-ID','Øvelse','Distanse','Status','Tid','Kildeplassering','Klasse','Klubb','Startnummer'];
   change.before.forEach((value,i)=>{if(JSON.stringify(value)===JSON.stringify(change.after[i]))return;const row=node('tr');row.append(node('th',names[i]),node('td',String(value??'–')),node('td',String(change.after[i]??'–')));table.append(row);});
   section.append(node('h4',change.name),table,node('p','Kilde: '+change.source),node('p',change.reason));ui.diff.append(section);
  }
  const areas={people:'Løperprofil og merker',annual:'Årsstatistikk',records:'Løyperekorder',placements:'Plasseringer',rankings:'Adelskalender',diplomas:'Diplomgrunnlag',loyalty:'Lojalitet',redirects:'Personkoblinger',aliases:'Navnealiaser'};
  ui.diff.append(node('p','Berørte beregninger: '+(data.review.changed.map(k=>areas[k]||k).join(' · ')||'Ingen endrede beregninger')));
  for(const warning of [...data.review.uncertain,...data.review.errors.map(e=>e.code||String(e))])ui.diff.append(node('p',warning));
  ui.diff.append(node('p',data.review.ready?'Kontrollen er bestått. Lagre utkastet før separat godkjenning.':'Utkast kan lagres, men må avklares før godkjenning.'));
 }
 async function mount(){
  if(ui||!session||!workspace())return;
  const host=document.querySelector('#view-rettelser'),panel=node('section');panel.id='serverReview';panel.className='panel';panel.style.marginBottom='1rem';
  const style=node('style');style.textContent='#serverReview table{width:100%;border-collapse:collapse}#serverReview th,#serverReview td{text-align:left;padding:.4rem;border-bottom:1px solid #d7dfda;overflow-wrap:anywhere}';panel.append(style);
  const status=node('p');status.id='serverReviewStatus';status.setAttribute('role','status');const diff=node('div');diff.id='serverReviewDiff';diff.style.overflowX='auto';const actions=node('div');actions.className='actions';
  const preview=button('Vis før/etter','serverReviewPreview',async()=>{const draft=await workspace().captureDraft(),data=await api('review/preview',{draft});showReview(data);});
  const save=button('Lagre utkast','serverReviewSave',async()=>{
   const version=edits;
   const draft=await workspace().captureDraft(),result=await api('review/save',{draft,expectedRevision:saved?.revision||0});
   showReview(result);await read();
   localSaved=version===edits&&JSON.stringify(workspace().exportDraft())===JSON.stringify(draft)&&result.revision===saved.revision&&result.digest===saved.digest?{snapshot:JSON.stringify(draft),revision:result.revision,digest:result.digest}:null;
   if(!localSaved)ui.status.textContent+=' Nyere lokale eller lagrede endringer må hentes/kontrolleres før godkjenning.';
  });
  const load=button('Hent lagret utkast','serverReviewLoad',async()=>{
   if(workspace().exportDraft().cases.length&&!confirm('Erstatt arbeidet i fanen med siste lagrede utkast?'))return;
   const version=edits,snapshot=JSON.stringify(workspace().exportDraft());
   await read();if(!saved.draft)return;
   if(version!==edits||snapshot!==JSON.stringify(workspace().exportDraft()))throw Error('Arbeidet i fanen ble endret mens utkastet ble hentet. Ingen lokale endringer er erstattet.');
   await workspace().restoreDraft(saved.draft);localSaved={snapshot:JSON.stringify(workspace().exportDraft()),revision:saved.revision,digest:saved.digest};currentStatus();
  });
  const approve=button('Godkjenn lagret utkast','serverReviewApprove',async()=>{
   if(!matchesSaved())throw Error('Arbeidet er endret. Lagre og kontroller på nytt før godkjenning.');
   if(!confirm('Godkjenn denne lagrede rettelsen? Dette publiserer ingenting.'))return;
   await api('review/approve',{expectedRevision:saved.revision,expectedDigest:saved.digest});await read();
  });
  actions.append(preview,save,load,approve);panel.append(node('h2','Lagrede resultatkorrigeringer'),node('p','Utkast lagres kryptert på serveren og kan hentes igjen etter ny innlogging. Godkjenning og publisering er separate handlinger. Publisering er ikke aktivert.'),status,actions,diff);host.prepend(panel);
  ui={panel,status,diff,preview,save,load,approve};
  const notice=host.querySelector('.intake-notice');if(notice)notice.textContent='Resultatrettelser kan lagres privat med «Lagre utkast». Andre typer saker beholdes fortsatt bare i fanen eller en nedlastet arbeidskopi.';
  document.querySelector('#correctionSave').textContent='Last ned arbeidskopi';
  // Buttons reflect the server's role; the server enforces it independently.
  host.addEventListener('input',()=>{edits++;localSaved=null;currentStatus();ui.status.textContent+=' Skjemaendringer er ikke lagret.';controls();});
  new MutationObserver(()=>{const b=document.querySelector('#correctionApprove');if(b&&b.textContent==='Godkjenn og klargjør')b.textContent='Kontroller og klargjør rettelsen';controls();}).observe(document.querySelector('#correctionBody'),{childList:true,subtree:true});
  await read();
 }
 document.addEventListener('morothon:correction-workspace-ready',()=>mount().catch(e=>{if(ui)ui.status.textContent=e.message;}));
 (async()=>{
  session=await api('session');window.MorothonReviewClient={canEdit:['owner','editor'].includes(session.role)};
  await window.MorothonAdminTransport.ready;
  document.querySelector('.local-tag').textContent='Innlogget · '+({owner:'Hovedadministrator',editor:'Redaktør',viewer:'Lesetilgang'}[session.role]);
  document.querySelector('.sidebar-note strong').textContent='Privat arbeidsrom';
  document.querySelector('.sidebar-note p').textContent='Resultatutkast lagres privat. Heder og andre moduler beholder eksisterende forhåndsvisning.';
  document.querySelector('.portal-footer>span:last-child').textContent='Innlogget arbeidsrom · ingen publisering';
  const logout=node('button','Logg ut');logout.type='button';logout.onclick=async()=>{await fetch('/admin-api/logout',{method:'POST',headers:{'X-Morothon-CSRF':session.csrf}});location.href='/admin/login';};document.querySelector('.portal-footer').append(logout);
  await mount();
 })().catch(error=>{const notice=node('p',error.message);notice.setAttribute('role','alert');document.querySelector('main').prepend(notice);});
})();
