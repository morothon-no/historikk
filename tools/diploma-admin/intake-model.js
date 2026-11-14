/* Read-only start-list staging. A registration/forecast never becomes a result. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../js/history-data.js'));else window.MorothonIntake=factory();})(function(History){
 'use strict';
 const MAX_BYTES=4*1024*1024,MAX_ROWS=5000,MAX_COLUMNS=80;
 const fields={name:'Navn',firstName:'Fornavn',lastName:'Etternavn',athleteId:'EQ-utøver-ID',entryId:'Påmeldings-ID',runnerId:'Morothon-ID',bib:'Startnummer',event:'Distanse/øvelse',className:'Klasse',club:'Klubb',birthYear:'Fødselsår/dato',gender:'Kjønn',year:'Arrangementsår/dato',status:'Status'};
 const aliases={name:['navn','name','fullname','deltaker','deltakernavn'],firstName:['fornavn','firstname','givenname'],lastName:['etternavn','lastname','surname','familyname'],athleteId:['athleteid','eqid','eqtimingid','utoverid','personid','participantkey'],entryId:['entryid','registrationid','pameldingsid','registreringsid'],runnerId:['morothonid','morid','canonicalid'],bib:['startnummer','startnr','bib','bibnumber','startno'],event:['distanse','distance','ovelse','event','race','competition','course'],className:['klasse','class','classname'],club:['klubb','club','organisation','organization'],birthYear:['fodselsar','birthyear','yearofbirth','fodselsdato','birthdate','dateofbirth'],gender:['kjonn','gender','sex'],year:['ar','year','eventyear','arrangementsar','eventdate','dato'],status:['status','entrystatus','resultstatus']};
 const normal=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim();
 const fold=v=>normal(v).normalize('NFD').replace(/\p{M}/gu,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/aa/g,'a').replace(/[.\-,]/g,' ').replace(/\s+/g,' ').trim();
 const header=v=>fold(v).replace(/[^a-z0-9]/g,'');
 const signature=r=>JSON.stringify([r.sourceScope,r.name,r.athleteId,r.entryId,r.runnerId,r.bib,r.event,r.className,r.club,r.birthYear,r.gender,r.year,r.status]);
 const identity=r=>JSON.stringify([r.sourceScope,normal(r.name),r.athleteId,r.runnerId,r.birthYear,r.gender,r.year]);
 function decode(bytes){
  if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Velg en CSV/XML-fil på maksimalt 4 MB.');
  let encoding='utf-8',text;
  if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';else if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';
  else {const declaration=new TextDecoder('windows-1252').decode(bytes.subarray(0,160)).match(/encoding=["']([^"']+)/i)?.[1];if(declaration&&/^(windows-1252|iso-8859-1)$/i.test(declaration))encoding='windows-1252';}
  try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{if(encoding!=='utf-8')throw Error('Filens tegnsett kunne ikke leses.');encoding='windows-1252';text=new TextDecoder(encoding).decode(bytes);}
  if(text.includes('\u0000'))throw Error('Ugyldig tekstfil. XLSX, binærfiler og andre formater støttes ikke.');
  return {text:text.replace(/^\uFEFF/,''),encoding};
 }
 function csv(text,delimiter){
  const records=[];let cells=[],cell='',quoted=false,closed=false,line=1,start=1;
  function endCell(){if(cell.length>1000)throw Error('Rad '+start+': et felt er for langt.');cells.push(cell);if(cells.length>MAX_COLUMNS)throw Error('For mange kolonner.');cell='';closed=false;}
  function endRow(){endCell();if(cells.some(v=>v.trim()))records.push({line:start,cells});cells=[];if(records.length>MAX_ROWS+1)throw Error('Maksimalt 5000 deltakerrader.');}
  for(let i=0;i<text.length;i++){
   let c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=c;if(c==='\n')line++;}continue;}
   if(c==='"'){if(cell.trim()||closed)throw Error('Rad '+line+': ugyldig CSV-sitering.');quoted=true;cell='';}
   else if(c===delimiter)endCell();
   else if(c==='\r'||c==='\n'){endRow();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
   else if(closed&&!/\s/.test(c))throw Error('Rad '+line+': tekst etter avsluttende anførselstegn.');else if(!closed)cell+=c;
  }
  if(quoted)throw Error('Rad '+start+': uavsluttet CSV-felt.');if(cell||cells.length||closed)endRow();return records;
 }
 function detectMapping(headers){const map={};for(const key of Object.keys(fields)){const matches=headers.map((h,i)=>aliases[key].includes(header(h))?i:-1).filter(i=>i>=0);map[key]=matches.length===1?matches[0]:-1;}return map;}
 function parseCsv(text,delimiter){
  let offset=0;const directive=text.match(/^sep=([;,\t])\r?\n/i);if(directive){delimiter=delimiter||directive[1];text=text.slice(directive[0].length);offset=1;}
  if(!delimiter){const candidates=[';',',','\t'].map(d=>{try{const rows=csv(text,d);return {d,width:rows[0]?.cells.length||0,consistent:rows.slice(1,12).filter(r=>r.cells.length===rows[0]?.cells.length).length};}catch{return {d,width:0,consistent:0};}}).sort((a,b)=>b.width-a.width||b.consistent-a.consistent);delimiter=candidates[0].d;}
  if(![';',',','\t'].includes(delimiter))throw Error('Ukjent skilletegn.');
  const records=csv(text,delimiter);if(records.length<2||records[0].cells.length<2)throw Error('CSV må ha en kolonneoverskrift og minst én deltaker.');
  const headers=records.shift().cells.map(h=>h.trim().slice(0,100));for(const r of records)r.line+=offset;
  return {schemaVersion:1,kind:'startlist-staging',format:'csv-columns-v1',delimiter,headers,records,mapping:detectMapping(headers)};
 }
 function parseXml(text,parseDocument){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML med DTD eller entitetsdeklarasjoner er ikke tillatt.');
  if(typeof parseDocument!=='function')throw Error('XML må leses i nettleseren.');
  const doc=parseDocument(text);if(doc.querySelector('parsererror'))throw Error('XML-filen er ugyldig.');
  const root=doc.documentElement;if(!root||root.localName!=='StartList')throw Error('XML må være IOF 3.0 StartList eller det dokumenterte radformatet StartList/Participant.');
  const headers=Object.keys(fields),records=[],get=(node,name)=>[...node.children].find(n=>n.localName===name),value=(node,...names)=>{for(const name of names)node=node&&get(node,name);return node?.textContent?.trim()||'';};
  let format;
  if(root.namespaceURI==='http://www.orienteering.org/datastandard/3.0'&&root.getAttribute('iofVersion')==='3.0'){
   if(doc.getElementsByTagNameNS(root.namespaceURI,'TeamStart').length)throw Error('IOF TeamStart støttes ikke i dette minimumsformatet. Bruk CSV med stafett som øvelse.');
   format='iof-startlist-3.0';const date=value(root,'Event','StartTime','Date');
   for(const classStart of [...root.children].filter(n=>n.localName==='ClassStart'))for(const person of [...classStart.children].filter(n=>n.localName==='PersonStart')){
    const data={firstName:value(person,'Person','Name','Given'),lastName:value(person,'Person','Name','Family'),athleteId:value(person,'Person','Id'),bib:value(person,'Start','BibNumber'),event:value(classStart,'Course','Name')||value(classStart,'Class','Name'),className:value(classStart,'Class','Name'),club:value(person,'Organisation','Name'),birthYear:value(person,'Person','BirthDate'),gender:get(person,'Person')?.getAttribute('sex')||'',year:date,status:value(person,'Start','Status')||value(person,'Status')||get(person,'Start')?.getAttribute('status')||person.getAttribute('status')||''};
    records.push({line:records.length+1,cells:headers.map(k=>data[k]||'')});
   }
  }else if(!root.namespaceURI){format='xml-participant-v1';if([...root.children].some(n=>n.localName!=='Participant'))throw Error('Rad-XML v1 tillater bare Participant direkte under StartList.');for(const row of root.children){const values={};for(const n of row.children){const key=headers.find(k=>aliases[k].includes(header(n.localName))||k===n.localName);if(key){if(Object.hasOwn(values,key))throw Error('Gjentatt XML-felt i rad '+(records.length+1));values[key]=n.textContent.trim();}}records.push({line:records.length+1,cells:headers.map(k=>values[k]||'')});}}
  else throw Error('Ukjent XML-versjon eller namespace.');
  if(!records.length||records.length>MAX_ROWS)throw Error('XML må inneholde 1–5000 deltakere.');if(records.some(r=>r.cells.some(c=>c.length>1000)))throw Error('Et XML-felt er for langt.');
  return {schemaVersion:1,kind:'startlist-staging',format,delimiter:null,headers,records,mapping:Object.fromEntries(headers.map((k,i)=>[k,i]))};
 }
 function parse(text,{delimiter,parseDocument}={}){return text.trimStart().startsWith('<')?parseXml(text,parseDocument):parseCsv(text,delimiter);}
 function yearValue(raw){const s=String(raw).trim();if(/^\d{4}$/.test(s))return +s;let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/),y,month,day;if(m)[,y,month,day]=m;else{m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(m)[,day,month,y]=m;}if(!m)return null;const date=new Date(Date.UTC(+y,+month-1,+day));return date.getUTCFullYear()===+y&&date.getUTCMonth()===+month-1&&date.getUTCDate()===+day?+y:null;}
 function rows(staged,mapping,year){
  if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Velg et gyldig arrangementsår.');
  for(const key of Object.keys(fields))if(!Number.isInteger(mapping[key])||mapping[key]<-1||mapping[key]>=staged.headers.length)throw Error('Ugyldig kolonnekobling: '+fields[key]);
  if(mapping.name<0&&(mapping.firstName<0||mapping.lastName<0))throw Error('Koble Navn, eller både Fornavn og Etternavn.');
  if(mapping.event<0)throw Error('Koble kolonnen for distanse/øvelse.');
  const statusMap=new Map([['','Påmeldt'],['registered','Påmeldt'],['pameldt','Påmeldt'],['entered','Påmeldt'],['notstarted','Påmeldt'],['dns','DNS'],['did not start','DNS'],['dnf','DNF'],['did not finish','DNF'],['dq','Disket'],['dsq','Disket'],['disket','Disket'],['diskvalifisert','Disket'],['fullfort','Fullført'],['completed','Fullført'],['deltatt','Deltatt']]);
  return staged.records.map((record,i)=>{
   const data=Object.fromEntries(Object.keys(fields).map(k=>[k,mapping[k]<0?'':String(record.cells[mapping[k]]??'').trim()])),errors=[],warnings=[];
   data.sourceScope=staged.format;data.name=data.name||[data.firstName,data.lastName].filter(Boolean).join(' ');delete data.firstName;delete data.lastName;
   if(!data.name||data.name.length>200||!/[\p{L}]/u.test(data.name))errors.push('Navn mangler eller er ugyldig.');
   if(record.cells.length!==staged.headers.length)errors.push('Antall felt stemmer ikke med kolonneoverskriften.');
   for(const key of ['athleteId','entryId','runnerId'])if(data[key]&&!/^[A-Za-z0-9_.:-]{1,128}$/.test(data[key]))errors.push('Ugyldig '+fields[key]+'.');
   if(!data.athleteId&&!data.runnerId)warnings.push('Ingen stabil utøver-ID. Navn/startnummer er ikke identitetsbevis.');
   const birth=data.birthYear?yearValue(data.birthYear):null;if(data.birthYear&&(!birth||birth<1900||birth>year))errors.push('Ugyldig fødselsår/dato.');data.birthYear=birth;
   const importedYear=data.year?yearValue(data.year):year;if(importedYear!==year)errors.push('Filens arrangementsår er ugyldig eller forskjellig fra valgt år.');data.year=year;
   const g=fold(data.gender);data.gender=['m','mann','male','herre'].includes(g)?'Herre':['f','k','kvinne','female','dame'].includes(g)?'Dame':'';if(g&&!data.gender)warnings.push('Ukjent kjønnstoken; ikke brukt til matching.');
   data.status=statusMap.get(fold(data.status));if(!data.status)errors.push('Ukjent status. Kontroller mappingen; dette er kun en startlisteanalyse.');
   if(!data.event)warnings.push('Distanse mangler og må kobles manuelt.');
   return {id:'row-'+(i+1),line:record.line,...data,errors,warnings,identityKey:identity(data),signature:signature(data)};
  });
 }
 function oneEdit(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return n+(i<a.length||j<b.length?1:0)<=1;}
 function weak(a,b){a=fold(a);b=fold(b);if(a===b)return 'Tegnsetting eller navnevariant';const x=a.split(' '),y=b.split(' ');if(x.length>=2&&x.every(t=>y.some(v=>t===v||t.length===1&&v.startsWith(t))))return 'Ufullstendig navn eller initialer';if(a.length>=7&&(x[0]===y[0]||x.at(-1)===y.at(-1))&&oneEdit(a,b))return 'Mulig skrivefeil';return null;}
 function createContext({history,registry,profile,honors,volunteers,externalLinks=[]},rules=History||globalThis.MorothonHistoryData){
  if(!rules)throw Error('Historikkreglene mangler.');if(profile.references.participationPolicy!=='morothon-annual-v1')throw Error('Opptjeningsmodellen er ikke operativ i C2.1.');
  const model=rules.create(history),people=new Map(),exact=new Map(),tokens=new Map(),latestYear=Math.max(...history.yearStats.map(r=>r[0]));
  const levels=registry.badges.filter(b=>b.kind==='participation').sort((a,b)=>a.n-b.n);if(!levels.length||levels.some((b,i)=>!Number.isSafeInteger(b.n)||b.n<1||i&&levels[i-1].n>=b.n))throw Error('Ugyldige merketerskler.');
  function add(id,name,origin){const canonical=model.resolve(id);if(!model.person(canonical))return;if(!people.has(canonical)){const p=model.person(canonical);people.set(canonical,{id:canonical,name:p.n,gender:p.g,names:[],years:rules.participationYears(model.resultsFor(canonical))});}const p=people.get(canonical);if(p.names.some(n=>n.name===name))return;p.names.push({name,origin});const key=normal(name);if(!exact.has(key))exact.set(key,new Set());exact.get(key).add(canonical);for(const token of new Set(fold(name).split(' '))){if(!tokens.has(token))tokens.set(token,new Set());tokens.get(token).add(canonical);}}
  for(const p of history.people)add(p.i,p.n,model.resolve(p.i)===p.i?'Registrert navn':'Navn fra sammenslått person-ID');for(const [id,names]of Object.entries(history.aliases||{}))for(const n of names)add(id,n,'Godkjent historisk alias');
  for(const member of [...(honors?.groups||[]).flatMap(g=>g.members),...(volunteers?.people||[])]){
   const link=honors?.personDetails?.[member.id]?.runnerLink,id=link?.confirmed===true&&link.sourceIds?.length&&link.sourceIds.every(id=>Object.hasOwn(honors.sources,id))?link.runnerId:member.runnerId;
   if(id&&member.name&&model.person(id))for(const name of [member.name,...member.aliases||[]])add(id,name,'Bekreftet historisk løperkobling');
  }
  const stable=new Map();for(const link of externalLinks){const key=JSON.stringify([link.sourceScope,link.athleteId]);if(typeof link.sourceScope!=='string'||!link.sourceScope||link.confirmed!==true||typeof link.evidence!=='string'||!link.evidence||!model.person(link.runnerId)||stable.has(key))throw Error('Ugyldig dokumentert ekstern identitetskobling.');stable.set(key,model.resolve(link.runnerId));}
  const competitions=new Map();function competition(event,km,label){const id=JSON.stringify([event,km]);if(!competitions.has(id))competitions.set(id,{id,event,km,label:label+' · '+km+' km'});}
  for(const p of profile.distances)competition(p.competition,p.km,p.name);for(const r of history.results.filter(r=>r[0]===latestYear&&!rules.isRelayRace(r)))competition(r[2],rules.parseDistanceKm(r[3]),rules.eventLabel(r));
  function race(raw,overrides={}){if(/stafett|relay/i.test(raw))return {relay:true,label:raw};if(Object.hasOwn(overrides,raw)){const found=competitions.get(overrides[raw]);return found||null;}const q=fold(raw),matches=[...competitions.values()].filter(c=>{const label=fold(c.label),event=fold(c.event),display=fold(profile.distances.find(p=>p.competition===c.event&&p.km===c.km)?.name||c.event);return [label,event,display,fold(c.km+' km'),display+' '+fold(c.km+' km'),event+' '+fold(c.km+' km')].includes(q);});return matches.length===1?matches[0]:null;}
  function candidates(row){
   let status='unknown',reason='Ingen tilstrekkelige treff. Ukjent identitet er ikke en bekreftet debutant.',ids=new Set(),evidence=new Map();
   if(row.runnerId){let id;try{id=model.resolve(row.runnerId);}catch{}if(!id||!people.has(id))return {status:'conflict',reason:'Oppgitt Morothon-ID finnes ikke i historikken.',candidates:[]};ids.add(id);evidence.set(id,'MOR-ID oppgitt i filen – krever kontroll.');}
   const stableId=stable.get(JSON.stringify([row.sourceScope,row.athleteId]));if(stableId){if(ids.size&&!ids.has(stableId))return {status:'conflict',reason:'Stabil kilde-ID og oppgitt MOR-ID peker på forskjellige personer.',candidates:[]};ids.add(stableId);evidence.set(stableId,'Dokumentert, bekreftet kilde-ID.');}
   const nameHits=exact.get(normal(row.name))||new Set();
   if(ids.size){const id=[...ids][0],p=people.get(id),nameAgrees=nameHits.has(id),genderAgrees=!row.gender||!p.gender||row.gender===p.gender;if(!nameAgrees||!genderAgrees)return {status:'conflict',reason:'Oppgitt identitet motsies av navn eller kjønn. Må kontrolleres.',candidates:[{...p,reason:evidence.get(id)}]};return {status:stableId?'confirmed':'proposed',reason:evidence.get(id),candidates:[{...p,reason:evidence.get(id)}]};}
   if(nameHits.size){ids=new Set(nameHits);for(const id of ids)evidence.set(id,people.get(id).names.find(n=>normal(n.name)===normal(row.name)).origin);status=ids.size>1?'conflict':'proposed';reason=ids.size>1?'Flere kanoniske personer har dette navnet/aliaset.':'Entydig navn/alias er et forslag, ikke bekreftet identitet.';}
   else{const pool=new Set();for(const t of fold(row.name).split(' '))for(const id of tokens.get(t)||[])pool.add(id);for(const id of pool){const p=people.get(id),why=p.names.map(n=>weak(row.name,n.name)).find(Boolean);if(why){ids.add(id);evidence.set(id,why);}}status=ids.size>1?'conflict':ids.size?'proposed':'unknown';if(ids.size)reason='Kun navnelikhet; kontroller historikken før kobling.';}
   const found=[...ids].map(id=>({...people.get(id),reason:evidence.get(id)}));if(found.some(p=>row.gender&&p.gender&&p.gender!==row.gender)){status='conflict';reason='Navnetreff med motstridende kjønn; ingen automatisk kobling.';}
   return {status:found.length>12?'conflict':status,reason:found.length>12?'Flere enn 12 mulige identiteter. Velg riktig profil manuelt; merkeprognosen avventer.':reason,candidates:found.slice(0,12),candidateCount:found.length,forecastBlocked:found.length>12};
  }
  return {model,rules,people,levels,latestYear,nextYear:latestYear+1,competitions:[...competitions.values()],race,candidates,profileId:profile.id};
 }
 function analyze(context,input,{year,decisions=new Map(),distanceMap={},meta={},previous=null}={}){
  if(!Number.isInteger(year)||input.some(r=>r.year!==year))throw Error('Analysen og radene må ha samme gyldige arrangementsår.');
  const H=context.rules,rows=input.map(r=>({...r,errors:[...r.errors],warnings:[...r.warnings],match:context.candidates(r),race:context.race(r.event,distanceMap)}));
  const reviewCases=[];function issue(row,code,message,blocking=false){row.warnings.push(message);reviewCases.push({id:code+'-'+row.id,code,rowIds:[row.id],line:row.line,severity:blocking?'conflict':'review',message});if(blocking){row.match.status='conflict';row.match.reason=message;}}
  for(const r of rows)r.errors.forEach((message,i)=>reviewCases.push({id:'validation-'+r.id+'-'+i,code:'row-validation',rowIds:[r.id],line:r.line,severity:'conflict',message}));
  const keyed=(key)=>{const map=new Map();for(const r of rows){const k=key(r);if(k){if(!map.has(k))map.set(k,[]);map.get(k).push(r);}}return map;};
  for(const list of keyed(r=>r.race?.relay?'':r.athleteId).values())if(new Set(list.map(r=>normal(r.name))).size>1||new Set(list.map(r=>r.birthYear).filter(Boolean)).size>1||new Set(list.map(r=>r.gender).filter(Boolean)).size>1)for(const r of list)issue(r,'external-id-conflict','Samme EQ-utøver-ID har motstridende navn/personopplysninger. Kontroller mulige navnebytter eller dobbeltregistreringer.',true);
  for(const list of keyed(r=>r.entryId).values())if(list.length>1&&new Set(list.map(r=>r.signature)).size>1)for(const r of list)issue(r,'duplicate-entry-id','Samme påmeldings-ID er brukt på ulike oppføringer. Kontroller kilden.',true);
  for(const list of keyed(r=>r.bib&&JSON.stringify([r.race?.id||r.event,r.bib])).values())if(new Set(list.map(r=>r.identityKey)).size>1)for(const r of list)issue(r,'duplicate-bib','Startnummeret forekommer med flere identiteter i samme øvelse. Startnummer er ikke en person-ID.',true);
  for(const list of keyed(r=>r.signature).values())if(list.length>1)for(const r of list){r.duplicate=true;issue(r,'duplicate-row','Identisk oppføring finnes flere ganger. Gir ikke ekstra deltakelse eller merke.');}
  for(const list of keyed(r=>normal(r.name)).values())if(list.length>1&&new Set(list.map(r=>r.athleteId).filter(Boolean)).size>1)for(const r of list)issue(r,'name-multiple-ids','Samme navn har flere EQ-ID-er. Dette kan være ulike personer eller dobbeltprofiler.',true);
  const identityCounts=keyed(r=>r.identityKey);
  for(const r of rows){
   if(r.race?.relay)r.match={status:'team',reason:'Stafettlag holdes separat og teller ikke som individuelle deltakelser.',candidates:[]};
   if(!r.race)issue(r,'unknown-distance','Ukjent distanse. Koble den til en godkjent øvelse før prognosen brukes.');
   if(!r.athleteId&&!r.runnerId)reviewCases.push({id:'missing-id-'+r.id,code:'missing-id',rowIds:[r.id],line:r.line,severity:'info',message:'Stabil utøver-ID mangler; navn/startnummer er ikke identitetsbevis.'});
   const key=(r.athleteId||r.runnerId)?r.identityKey:r.signature,decision=r.race?.relay?null:decisions.get(key);r.decisionKey=key;r.decision=null;
   if(decision&&decision.action!=='defer'){
    if(decision.action==='confirm'&&context.people.has(decision.runnerId)&&(!decision.carried||r.match.status!=='conflict'&&r.match.candidates.some(p=>p.id===decision.runnerId))){r.decision=decision;r.match={status:'confirmed',reason:decision.carried?'Bekreftet valg beholdt for samme uendrede identitet i arbeidsøkten.':'Arrangøren bekreftet denne koblingen i arbeidsøkten.',candidates:[{...context.people.get(decision.runnerId),reason:'Manuell bekreftelse'}]};}
    else if(decision.action==='new'&&(!decision.carried||r.match.status!=='conflict')){r.decision=decision;r.match={status:'new',reason:'Arrangøren har markert en ny person for denne analysen.',candidates:[]};}
    else if(decision.action==='different'&&(!decision.carried||r.match.status!=='conflict')){r.decision=decision;r.match={status:'unknown',reason:'Forslaget er avvist. Velg riktig profil eller marker ny deltaker.',candidates:[]};}
   }else if(decision?.action==='defer'){r.match.status='deferred';r.match.reason='Utsatt av arrangøren; forslag regnes ikke som bekreftet.';}
   if(r.match.status==='confirmed'&&!r.decision)r.automaticStableConfirmation=true;
   if(['proposed','conflict','deferred','unknown'].includes(r.match.status))reviewCases.push({id:'identity-'+r.id,code:'identity-'+r.match.status,rowIds:[r.id],line:r.line,severity:r.match.status==='conflict'?'conflict':'review',message:r.match.reason});
  }
  const forecasts=new Map(),newIds=new Map();
  for(const r of rows){
   if(r.errors.length||!r.race||r.race.relay||r.match.forecastBlocked)continue;
   const effective=r.status==='Påmeldt'?'Fullført':r.status;if(!H.countsAsParticipation([year,'temporary',r.race.event,r.race.km+' km',effective,null]))continue;
   const confirmed=r.match.status==='confirmed',fresh=r.match.status==='new';if(fresh&&!newIds.has(r.decisionKey))newIds.set(r.decisionKey,'new-'+(newIds.size+1));let possible=confirmed?r.match.candidates:fresh?[{id:newIds.get(r.decisionKey),name:r.name,years:[]}]:r.match.candidates;
   if(!possible.length)continue;
   for(const p of possible){const years=p.years.filter(y=>y<=year),count=years.length,already=years.includes(year),after=count+(already?0:1);
    for(const b of context.levels.filter(b=>b.n>count&&b.n<=after)){
     const key=JSON.stringify([p.id,b.id]);if(!forecasts.has(key))forecasts.set(key,{candidateId:p.id,name:p.name,badgeId:b.id,badgeName:b.name,threshold:b.n,src:b.src,historicalCount:count,possibleCount:after,alreadyRegistered:already,confirmed:false,ambiguous:false,rowIds:[],distances:[],bibs:[],reason:count+' tellende år i historikken; årets kvalifiserende deltakelse kan gi '+after+'.',caveats:['FORELØPIG PROGNOSE – påmelding er ikke deltakelse.']});
     const f=forecasts.get(key);f.confirmed ||= confirmed||fresh;f.ambiguous ||= possible.length>1;f.rowIds.push(r.id);if(!f.distances.includes(r.race.label))f.distances.push(r.race.label);if(r.bib)f.bibs.push(r.bib);if(!(confirmed||fresh)&&!f.caveats.includes('Identiteten må avklares.'))f.caveats.push('Identiteten må avklares.');
    }
   }
  }
  for(const list of keyed(r=>r.match.status==='confirmed'?r.match.candidates[0]?.id:r.match.status==='new'?'new:'+r.decisionKey:null).values())if(list.length>1)for(const r of list)issue(r,'same-person-year','Flere registreringer for samme person i året. Prognosen teller høyst ett nytt deltakelsesår.');
  const forecast=[...forecasts.values()].sort((a,b)=>b.threshold-a.threshold||a.name.localeCompare(b.name,'nb-NO'));
  const orders=context.levels.map(b=>{const recipients=forecast.filter(f=>f.badgeId===b.id);return {badgeId:b.id,badgeName:b.name,threshold:b.n,confirmed:recipients.filter(f=>f.confirmed).length,uncertain:recipients.filter(f=>!f.confirmed).length,prepareMax:recipients.length,ambiguous:recipients.some(f=>f.ambiguous),recipients};}).filter(o=>o.prepareMax);
  const summary={rows:rows.length,approved:rows.filter(r=>!r.errors.length&&r.race&&['confirmed','new','team'].includes(r.match.status)).length,uncertain:rows.filter(r=>!r.errors.length&&(!r.race||!['confirmed','new','team'].includes(r.match.status))).length,duplicates:rows.filter(r=>r.duplicate).length,rejected:rows.filter(r=>r.errors.length).length,forecasts:forecast.length};
  return {schemaVersion:1,kind:'startlist-analysis',status:'FORELØPIG PROGNOSE',year,policy:'morothon-annual-v1',meta,rows,forecast,orders,summary,reviewCases,comparison:previous?compare(previous,{year,rows,forecast}):null};
 }
 function pairs(rows,key){const map=new Map();for(const r of rows){const k=key(r);if(k){if(!map.has(k))map.set(k,[]);map.get(k).push(r);}}return map;}
 function compare(previous,current){
  if(previous.year!==current.year)return {scopeChanged:true,added:current.rows.length,changed:0,missing:0,unchanged:0,forecastDelta:current.forecast.length,links:[]};
  const oldFree=new Set(previous.rows),newFree=new Set(current.rows),links=[];
  for(const key of [r=>r.entryId&&'entry:'+r.entryId,r=>r.athleteId&&'athlete:'+r.athleteId,r=>r.bib&&'bib:'+r.bib,r=>r.signature]){
   const old=pairs([...oldFree],key),next=pairs([...newFree],key);for(const [k,rows]of next){const before=old.get(k);if(rows.length===1&&before?.length===1){links.push({before:before[0],after:rows[0],unchanged:before[0].signature===rows[0].signature});oldFree.delete(before[0]);newFree.delete(rows[0]);}}
  }
  return {scopeChanged:false,previousSourceSha256:previous.meta?.sourceSha256||'',added:newFree.size,missing:oldFree.size,changed:links.filter(l=>!l.unchanged).length,unchanged:links.filter(l=>l.unchanged).length,forecastDelta:current.forecast.length-previous.forecast.length,links,addedRows:[...newFree],missingRows:[...oldFree]};
 }
 function carryDecisions(previous,nextRows,year){const decisions=new Map();const diff=compare(previous,{year,rows:nextRows,forecast:[]});for(const {before,after}of diff.links){if(before.decision&&before.identityKey===after.identityKey&&((before.athleteId||before.runnerId)||before.signature===after.signature))decisions.set((after.athleteId||after.runnerId)?after.identityKey:after.signature,{...before.decision,carried:true});}return decisions;}
 function csvReport(analysis,type){
  const common=['Radtype','Status','Arrangementsår','Regelmodell','Profil','Offentlig manifest SHA-256','Historikk SHA-256','Merkeregister SHA-256','Startliste SHA-256','Forrige startliste SHA-256','Importtidspunkt','Merkeutvalg','Distanseutvalg'],prefix=[analysis.status,analysis.year,analysis.policy,analysis.meta.profileId||'',analysis.meta.manifestSha256||'',analysis.meta.historySha256||'',analysis.meta.registrySha256||'',analysis.meta.sourceSha256||'',analysis.comparison?.previousSourceSha256||'',analysis.meta.importedAt||'',analysis.viewFilters?.badge||'all',analysis.viewFilters?.distance||'all'];let headers,rows;
  if(type==='orders'){headers=['Merke','Terskel','Bekreftede identiteter','Usikre muligheter','Øvre behov blant vurderte kandidater','Forbehold'];rows=analysis.orders.map(o=>[o.badgeName,o.threshold,o.confirmed,o.uncertain,o.prepareMax,'Ukjente eller sperrede rader kan øke behovet. Alle antall avhenger av faktisk tellende deltakelse.'+(o.ambiguous?' Alternative identiteter; ikke summer ukritisk på tvers av merker.':'')]);}
  else if(type==='forecast'){headers=['Navn','Kanonisk ID/forslag','Merke','Historiske år','Mulige år','Identitet','Distanser','Forbehold'];rows=analysis.forecast.map(f=>[f.name,f.candidateId,f.badgeName,f.historicalCount,f.possibleCount,f.confirmed?'Bekreftet i arbeidsgrunnlaget':'Usikker',f.distances.join(' / '),f.caveats.join(' ')]);}
  else if(type==='review'){headers=['Rad','Navn','Tilstand','Grunnlag','Kandidat-ID-er','Kandidatnavn'];rows=analysis.rows.filter(r=>!['confirmed','new'].includes(r.match.status)||r.errors.length||r.warnings.length).map(r=>[r.line,r.name,r.match.status,[...r.errors,...r.warnings,r.match.reason].join(' '),r.match.candidates.map(p=>p.id).join(' / '),r.match.candidates.map(p=>p.name).join(' / ')]);}
  else if(type==='import'){headers=['Rad','Navn','EQ-ID','Startnummer','Distanse','Klasse','Klubb','Innlesingsstatus','Personstatus','Endring','Feil/forbehold'];const changes=new Map((analysis.comparison?.links||[]).map(l=>[l.after.id,l.unchanged?'Uendret':'Endret']));rows=analysis.rows.map(r=>[r.line,r.name,r.athleteId,r.bib,r.event,r.className,r.club,r.errors.length?'Avvist':r.duplicate?'Duplikat':'Lest',r.match.status,analysis.comparison?changes.get(r.id)||'Ny i fila':'Første import',[...r.errors,...r.warnings].join(' ')]);for(const r of analysis.comparison?.missingRows||[])rows.push(['Forrige fil: '+r.line,r.name,r.athleteId,r.bib,r.event,r.className,r.club,'Ikke med i ny fil',r.match.status,'Ikke med – ingen avmelding registrert','Eksportens fullstendighet og utvalg må kontrolleres.']);}
  else throw Error('Ukjent rapporttype.');
  const escape=v=>{let s=String(v??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const records=rows.length?rows.map(r=>['Data',...prefix,...r]):[['Rapportmetadata – ingen datarader',...prefix,...headers.map(()=> '')]];return '\uFEFF'+[common.concat(headers),...records].map(r=>r.map(escape).join(';')).join('\r\n')+'\r\n';
 }
 return {MAX_BYTES,MAX_ROWS,fields,decode,parse,parseCsv,parseXml,detectMapping,rows,createContext,analyze,compare,carryDecisions,csvReport,normal,fold,identity,signature};
});
