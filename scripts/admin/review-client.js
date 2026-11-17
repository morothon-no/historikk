/* Served only by authenticated admin backend; never included in the Pages build. */
(() => {
 'use strict';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let session,saved=null,localSaved=null,busy=false,ui,edits=0;
 const labels={empty:'Ingen lagret rettelse',draft:'Utkast', 'review-approved':'Godkjent · ikke publisert',published:'Publisert og verifisert'};
 async function api(route,body){
  const r=await fetch('/admin-api/'+route,{cache:'no-store',credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Morothon-CSRF':session.csrf},body:JSON.stringify(body)})});
  if(r.status===401)throw Error('Innloggingen er utløpt. Logg inn igjen; siste lagrede utkast er bevart.');
  const data=await r.json();if(!r.ok)throw Error(data.error||'Kunne ikke fullføre handlingen.');return data;
 }
 function button(label,id,action){const b=node('button',label);b.type='button';b.id=id;b.onclick=async()=>{if(busy)return;busy=true;controls();try{await action();}catch(e){ui.status.textContent=e.message;}finally{busy=false;controls();}};return b;}
 const workspace=()=>window.MorothonCorrectionWorkspace;
 function matchesSaved(){return !!localSaved&&localSaved.snapshot===JSON.stringify(workspace()?.exportDraft())&&localSaved.revision===saved?.revision&&localSaved.digest===saved?.digest;}
 function controls(){if(!ui)return;const current=workspace()?.exportDraft();ui.load.disabled=busy||!saved?.draft?.cases.length;ui.save.disabled=busy||session.role==='viewer'||saved?.status==='published'&&!current?.cases.length;ui.preview.disabled=busy||!current?.cases.length||session.role==='viewer';ui.approve.disabled=busy||session.role!=='owner'||!saved?.draft||saved.stale||!matchesSaved()||['review-approved','published'].includes(saved.status);ui.publicationControls?.();}
 function currentStatus(){ui.status.textContent=(labels[saved?.status]||'Utkast')+' · revisjon '+(saved?.revision||0)+(saved?.stale?' · Historikken er oppdatert. Krever ny gjennomgang.':'')+(saved?.status==='published'?'. Last inn det nye grunnlaget før flere rettelser.':'. Dette utkastet er ikke publisert.');}
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
   const version=edits,snapshot=JSON.stringify(workspace().exportDraft()),digest=saved.digest;
   await api('review/approve',{expectedRevision:saved.revision,expectedDigest:digest});await read();
   localSaved=version===edits&&saved.digest===digest&&JSON.stringify(workspace().exportDraft())===snapshot?{snapshot,revision:saved.revision,digest}:null;
  });
  actions.append(preview,save,load,approve);panel.append(node('h2','Lagrede resultatkorrigeringer'),node('p','Utkast lagres kryptert på serveren og kan hentes igjen etter ny innlogging. Godkjenning og publisering er separate handlinger.'+(session.canPublish?'':' Publisering er ikke aktivert.')),status,actions,diff);host.prepend(panel);
  ui={panel,status,diff,preview,save,load,approve};
  const notice=host.querySelector('.intake-notice');if(notice)notice.textContent='Resultatrettelser kan lagres privat med «Lagre utkast». Andre typer saker beholdes fortsatt bare i fanen eller en nedlastet arbeidskopi.';
  document.querySelector('#correctionSave').textContent='Last ned arbeidskopi';
  // Buttons reflect the server's role; the server enforces it independently.
  host.addEventListener('input',e=>{if(e.target.closest('#publicationPanel'))return;edits++;localSaved=null;currentStatus();ui.status.textContent+=' Skjemaendringer er ikke lagret.';controls();});
  new MutationObserver(()=>{const b=document.querySelector('#correctionApprove');if(b&&b.textContent==='Godkjenn og klargjør')b.textContent='Kontroller og klargjør rettelsen';controls();}).observe(document.querySelector('#correctionBody'),{childList:true,subtree:true});
  await read();
  if(session.canPublish)await mountPublication(panel);
 }
 async function mountPublication(parent){
  let job=null;const box=node('section');box.id='publicationPanel';const state=node('p');state.id='publicationStatus';state.setAttribute('role','status');const details=node('div'),actions=node('div');actions.className='actions';
  const names={prepared:'Klar til eksplisitt publisering',submitting:'Sender godkjent datapakke',checking:'Venter på PR-kontroller',deploying:'Venter på grønn main og Pages-deploy',verifying:'Kontrollerer offentlig løperprofil',published:'Publisert og verifisert',failed:'Publisering stoppet', 'needs-review':'Krever gjennomgang',cancelled:'Avbrutt'};
  const prepare=button('Klargjør publisering','publicationPrepare',async()=>{if(!matchesSaved())throw Error('Hent eller lagre nøyaktig godkjent utkast først.');job=await api('publication/prepare',{expectedRevision:saved.revision,expectedDigest:saved.digest});render();});
  const publish=button('Publiser godkjent rettelse','publicationPublish',async()=>{
   if(!job||!matchesSaved())throw Error('Kontroller det godkjente grunnlaget først.');
   if(!confirm('Publiser rettelsen som vises her? Offentlige resultater oppdateres først etter grønn kontroll og verifisert deploy.'))return;
   job=await api('publication/publish',{id:job.id,confirmation:job.manifestSha256});await read();render();
  });
  const refresh=button('Kontroller publiseringsstatus','publicationRefresh',async()=>{await poll();});
  const retry=button('Kontroller stoppet publisering på nytt','publicationRetry',async()=>{if(!confirm('Kontroller den samme, tidligere godkjente publiseringen på nytt? Ingen ny rettelse godkjennes.'))return;job=await api('publication/retry',{id:job.id});render();});
  const reverse=button('Foreslå tilbakeføring','publicationReverse',async()=>{if(!confirm('Opprett et nytt utkast som reverserer rettelsen? Ny godkjenning og publisering kreves.'))return;await api('publication/reverse',{id:job.id});location.reload();});
  const reload=button('Last inn nytt resultatgrunnlag','publicationReload',()=>location.reload());
  actions.append(prepare,publish,refresh,retry,reverse,reload);box.append(node('h3','Publisering til Adelskalenderen'),node('p','Kun hovedadministrator kan publisere. En kontrollert PR, grønn CI, sikkerhetskopi og verifisert offentlig visning kreves.'),state,details,actions);parent.append(box);
  function render(){
   state.textContent=job?(names[job.stage]||job.stage)+' · dataversjon '+job.dataVersion+(job.error?' · '+job.error:''):'Ingen publisering klargjort.';
   details.replaceChildren();if(job){for(const c of job.changes||[])details.append(node('p',c.before.filter(v=>v!==null&&v!=='').join(' · ')+' → '+c.after.filter(v=>v!==null&&v!=='').join(' · ')));if(job.remote?.url){const link=node('a','Se publiseringskontroll');link.href=job.remote.url;link.target='_blank';link.rel='noopener';details.append(link);}for(const url of job.profiles||[]){const link=node('a','Åpne oppdatert løperprofil');link.href=url;link.target='_blank';link.rel='noopener';details.append(link);}}
   controls();
  }
  ui.publicationControls=()=>{
   const active=job&&!['published','failed','needs-review','cancelled','prepared'].includes(job.stage);
   prepare.disabled=busy||active||saved?.status!=='review-approved'||!matchesSaved();publish.hidden=job?.stage!=='prepared';publish.disabled=busy||!matchesSaved();refresh.disabled=busy;
   retry.hidden=!job||!['failed','needs-review'].includes(job.stage);retry.disabled=busy;
   reverse.hidden=job?.stage!=='published';reverse.disabled=busy;reload.hidden=job?.stage!=='published';reload.disabled=busy;
  };
  async function poll(){const value=await api('publication');job=value.job;if(job?.stage==='published')await read();render();}
  await poll();setInterval(()=>{if(!busy)poll().catch(e=>{state.textContent=e.message;});},10000);
 }
 document.addEventListener('morothon:correction-workspace-ready',()=>mount().catch(e=>{if(ui)ui.status.textContent=e.message;}));
 (async()=>{
  session=await api('session');window.MorothonReviewClient={canEdit:['owner','editor'].includes(session.role)};
  await window.MorothonAdminTransport.ready;
  document.querySelector('.local-tag').textContent='Innlogget · '+({owner:'Hovedadministrator',editor:'Redaktør',viewer:'Lesetilgang'}[session.role]);
  document.querySelector('.sidebar-note strong').textContent='Privat arbeidsrom';
  document.querySelector('.sidebar-note p').textContent='Resultatutkast lagres privat. Heder og andre moduler beholder eksisterende forhåndsvisning.';
  document.querySelector('.portal-footer>span:last-child').textContent=session.canPublish?'Innlogget arbeidsrom · publisering krever eksplisitt godkjenning':'Innlogget arbeidsrom · ingen publisering';
  const logout=node('button','Logg ut');logout.type='button';logout.onclick=async()=>{await fetch('/admin-api/logout',{method:'POST',headers:{'X-Morothon-CSRF':session.csrf}});location.href='/admin/login';};document.querySelector('.portal-footer').append(logout);
  await mount();
 })().catch(error=>{const notice=node('p',error.message);notice.setAttribute('role','alert');document.querySelector('main').prepend(notice);});
})();
