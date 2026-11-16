/* Read-only start-list staging. A registration/forecast never becomes a result. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../js/history-data.js'));else window.MorothonIntake=factory();})(function(History){
 'use strict';
 const MAX_BYTES=4*1024*1024,MAX_ROWS=5000,MAX_COLUMNS=80;
 const fields={name:'Navn',firstName:'Fornavn',lastName:'Etternavn',athleteId:'EQ-utøver-ID',entryId:'Påmeldings-ID',runnerId:'Morothon-ID',bib:'Startnummer',event:'Distanse/øvelse',className:'Klasse',club:'Klubb',birthYear:'Fødselsår/dato',gender:'Kjønn',year:'Arrangementsår/dato',status:'Status',startTime:'Starttid',nation:'Nasjon'};
 const aliases={name:['navn','name','fullname','deltaker','deltakernavn'],firstName:['fornavn','firstname','givenname'],lastName:['etternavn','lastname','surname','familyname'],athleteId:['athleteid','eqid','eqtimingid','utoverid','personid','participantkey'],entryId:['entryid','registrationid','pameldingsid','registreringsid'],runnerId:['morothonid','morid','canonicalid'],bib:['startnummer','startnr','bib','bibnumber','startno'],event:['distanse','distance','ovelse','event','race','competition','course'],className:['klasse','class','classname'],club:['klubb','club','organisation','organization'],birthYear:['fodselsar','birthyear','yearofbirth','fodselsdato','birthdate','dateofbirth'],gender:['kjonn','gender','sex'],year:['ar','year','eventyear','arrangementsar','eventdate','dato'],status:['status','entrystatus','resultstatus'],startTime:['starttid','starttime'],nation:['nasjon','nation','nationality']};
 const normal=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim();
 const fold=v=>normal(v).normalize('NFD').replace(/\p{M}/gu,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/aa/g,'a').replace(/[.\-,]/g,' ').replace(/\s+/g,' ').trim();
 const header=v=>fold(v).replace(/[^a-z0-9]/g,'');
 const signature=r=>JSON.stringify([r.sourceScope,r.name,r.athleteId,r.entryId,r.runnerId,r.bib,r.event,r.className,r.club,r.birthYear,r.gender,r.year,r.status,r.startTime,r.nation,r.entryKind]);
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
  const root=doc.documentElement;if(!root||!['StartList','startliste'].includes(root.localName))throw Error('XML må være Emit startliste, IOF 3.0 StartList eller StartList/Participant.');
  const headers=Object.keys(fields),records=[],get=(node,name)=>[...node.children].find(n=>n.localName===name),value=(node,...names)=>{for(const name of names)node=node&&get(node,name);return node?.textContent?.trim()||'';};
  let format,source;
  if(root.localName==='startliste'){
   if(root.namespaceURI||[...root.attributes].some(a=>!['version','versjon'].includes(a.name)))throw Error('Ukjent Emit XML-struktur eller namespace.');
   const providers=[...root.children].filter(n=>n.localName==='provider'),changes=[...root.children].filter(n=>n.localName==='changed');
   if(providers.length!==1||changes.length>1||[...root.children].some(n=>n.namespaceURI||!['provider','changed','start'].includes(n.localName)))throw Error('Ukjent Emit XML-struktur. Forventet provider, changed og start.');
   if([...providers,...changes].some(n=>n.children.length||n.textContent.trim()))throw Error('Ukjent innhold i Emit kildeinformasjon.');
   const provider=providers[0],version=provider.getAttribute('versjon');
   if(normal(provider.getAttribute('company'))!=='emit as'||version!=='Ver 1.0'||[...root.attributes].some(a=>!['1.0','Ver 1.0'].includes(a.value)))throw Error('Ukjent Emit XML-versjon. Bare Emit as Ver 1.0 er støttet.');
   const changedAt=changes[0]?.getAttribute('date')||'';
   if(changedAt&&(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(changedAt)||!yearValue(changedAt.slice(0,10))||!validTime(changedAt.slice(11))))throw Error('Ugyldig endringstidspunkt i Emit XML.');
   source={provider:'Emit as',version,changedAt};format='emit-startliste-1.0';
   for(const row of [...root.children].filter(n=>n.localName==='start')){
    if(row.children.length||row.textContent.trim())throw Error('Ukjent innhold i Emit start-rad.');
    const attr=k=>row.getAttribute(k)||'',data={firstName:attr('fornavn'),lastName:attr('etternavn'),club:attr('team'),bib:attr('startno'),className:attr('klasse'),startTime:attr('starttid'),nation:attr('nasjon')};
    // The class may explicitly identify a relay. It never identifies a distance.
    records.push({line:records.length+1,entryKind:/stafett|relay/i.test(data.className)?'relay':'individual',cells:headers.map(k=>data[k]||'')});
   }
  }else if(root.namespaceURI==='http://www.orienteering.org/datastandard/3.0'&&root.getAttribute('iofVersion')==='3.0'){
   if(doc.getElementsByTagNameNS(root.namespaceURI,'TeamStart').length)throw Error('IOF TeamStart støttes ikke i dette minimumsformatet. Bruk CSV med stafett som øvelse.');
   format='iof-startlist-3.0';const date=value(root,'Event','StartTime','Date');
   for(const classStart of [...root.children].filter(n=>n.localName==='ClassStart'))for(const person of [...classStart.children].filter(n=>n.localName==='PersonStart')){
    const data={firstName:value(person,'Person','Name','Given'),lastName:value(person,'Person','Name','Family'),athleteId:value(person,'Person','Id'),bib:value(person,'Start','BibNumber'),event:value(classStart,'Course','Name')||value(classStart,'Class','Name'),className:value(classStart,'Class','Name'),club:value(person,'Organisation','Name'),birthYear:value(person,'Person','BirthDate'),gender:get(person,'Person')?.getAttribute('sex')||'',year:date,status:value(person,'Start','Status')||value(person,'Status')||get(person,'Start')?.getAttribute('status')||person.getAttribute('status')||''};
    records.push({line:records.length+1,cells:headers.map(k=>data[k]||'')});
   }
  }else if(!root.namespaceURI){if(root.attributes.length)throw Error('Ukjent XML-versjon i StartList/Participant.');format='xml-participant-v1';if([...root.children].some(n=>n.localName!=='Participant'))throw Error('Rad-XML v1 tillater bare Participant direkte under StartList.');for(const row of root.children){const values={};for(const n of row.children){const key=headers.find(k=>aliases[k].includes(header(n.localName))||k===n.localName);if(key){if(Object.hasOwn(values,key))throw Error('Gjentatt XML-felt i rad '+(records.length+1));values[key]=n.textContent.trim();}}records.push({line:records.length+1,cells:headers.map(k=>values[k]||'')});}}
  else throw Error('Ukjent XML-versjon eller namespace.');
  if(!records.length||records.length>MAX_ROWS)throw Error('XML må inneholde 1–5000 deltakere.');if(records.some(r=>r.cells.some(c=>c.length>1000)))throw Error('Et XML-felt er for langt.');
  return {schemaVersion:1,kind:'startlist-staging',format,source,delimiter:null,headers,records,mapping:Object.fromEntries(headers.map((k,i)=>[k,i]))};
 }
 function parse(text,{delimiter,parseDocument}={}){return text.trimStart().startsWith('<')?parseXml(text,parseDocument):parseCsv(text,delimiter);}
 function validTime(s){return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(s);}
 function yearValue(raw){const s=String(raw).trim();if(/^\d{4}$/.test(s))return +s;let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/),y,month,day;if(m)[,y,month,day]=m;else{m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(m)[,day,month,y]=m;}if(!m)return null;const date=new Date(Date.UTC(+y,+month-1,+day));return date.getUTCFullYear()===+y&&date.getUTCMonth()===+month-1&&date.getUTCDate()===+day?+y:null;}
 function rows(staged,mapping,year){
  if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Velg et gyldig arrangementsår.');
  for(const key of Object.keys(fields))if(!Number.isInteger(mapping[key])||mapping[key]<-1||mapping[key]>=staged.headers.length)throw Error('Ugyldig kolonnekobling: '+fields[key]);
  if(mapping.name<0&&(mapping.firstName<0||mapping.lastName<0))throw Error('Koble Navn, eller både Fornavn og Etternavn.');
  if(mapping.event<0&&staged.format!=='emit-startliste-1.0')throw Error('Koble kolonnen for distanse/øvelse.');
  const statusMap=new Map([['','Påmeldt'],['registered','Påmeldt'],['pameldt','Påmeldt'],['entered','Påmeldt'],['notstarted','Påmeldt'],['dns','DNS'],['did not start','DNS'],['dnf','DNF'],['did not finish','DNF'],['dq','Disket'],['dsq','Disket'],['disket','Disket'],['diskvalifisert','Disket'],['fullfort','Fullført'],['completed','Fullført'],['deltatt','Deltatt']]);
  return staged.records.map((record,i)=>{
   const data=Object.fromEntries(Object.keys(fields).map(k=>[k,mapping[k]<0?'':String(record.cells[mapping[k]]??'').trim()])),errors=[],warnings=[];
   data.sourceScope=staged.format;data.entryKind=record.entryKind||'individual';data.name=data.name||[data.firstName,data.lastName].filter(Boolean).join(' ');delete data.firstName;delete data.lastName;
   if(!data.name||data.name.length>200||!/[\p{L}]/u.test(data.name))errors.push('Navn mangler eller er ugyldig.');
   if(record.cells.length!==staged.headers.length)errors.push('Antall felt stemmer ikke med kolonneoverskriften.');
   for(const key of ['athleteId','entryId','runnerId'])if(data[key]&&!/^[A-Za-z0-9_.:-]{1,128}$/.test(data[key]))errors.push('Ugyldig '+fields[key]+'.');
   if(!data.athleteId&&!data.runnerId)warnings.push('Ingen stabil utøver-ID. Navn/startnummer er ikke identitetsbevis.');
   const birth=data.birthYear?yearValue(data.birthYear):null;if(data.birthYear&&(!birth||birth<1900||birth>year))errors.push('Ugyldig fødselsår/dato.');data.birthYear=birth;
   const importedYear=data.year?yearValue(data.year):year;if(importedYear!==year)errors.push('Filens arrangementsår er ugyldig eller forskjellig fra valgt år.');data.year=year;
   const g=fold(data.gender);data.gender=['m','mann','male','herre'].includes(g)?'Herre':['f','k','kvinne','female','dame'].includes(g)?'Dame':'';if(g&&!data.gender)warnings.push('Ukjent kjønnstoken; ikke brukt til matching.');
   data.status=statusMap.get(fold(data.status));if(!data.status)errors.push('Ukjent status. Kontroller mappingen; dette er kun en startlisteanalyse.');
   if(data.startTime&&!validTime(data.startTime))errors.push('Ugyldig starttid. Forventet HH:MM:SS.');
   if(!data.event&&data.entryKind!=='relay')warnings.push('Distanse mangler i filen; bruk manuelt distansevalg.');
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
  return {model,rules,people,levels,latestYear,nextYear:latestYear+1,competitions:[...competitions.values()],race,candidates,externalRunner:(scope,athleteId)=>stable.get(JSON.stringify([scope,athleteId]))||null,profileId:profile.id};
 }
 // Row choices are file-local. Never assign the entire blank-distance group.
 function assignedRace(context,id){
  if(id==='relay')return {relay:true,label:'Stafett (manuelt valgt)'};
  const race=context.competitions.find(c=>c.id===id);if(!race)throw Error('Velg en godkjent distanse.');return race;
 }
 function assignDistances(context,rows,current,ids,distance){
  assignedRace(context,distance);const next=new Map(current),selected=new Set(ids);
  if(!selected.size)throw Error('Marker minst én deltaker.');
  for(const id of selected){const row=rows.find(r=>r.id===id);if(!row||row.entryKind==='relay')throw Error('Utvalget inneholder en ukjent rad eller en eksplisitt stafettoppføring.');next.set(id,distance);}
  return next;
 }
 function carryDistances(previous,nextRows,assignments,year){
  const next=new Map();if(previous.year!==year)return next;
  // No stable person IDs in Emit. Only a unique, fully unchanged source row is safe.
  const before=pairs(previous.rows,r=>r.signature),after=pairs(nextRows,r=>r.signature);
  for(const [key,list]of after){const old=before.get(key);if(list.length===1&&old?.length===1&&assignments.has(old[0].id))next.set(list[0].id,assignments.get(old[0].id));}
  return next;
 }
 function analyze(context,input,{year,decisions=new Map(),distanceMap={},rowDistances=new Map(),meta={},previous=null}={}){
  if(!Number.isInteger(year)||input.some(r=>r.year!==year))throw Error('Analysen og radene må ha samme gyldige arrangementsår.');
  const H=context.rules,rows=input.map(r=>({...r,errors:[...r.errors],warnings:[...r.warnings],match:context.candidates(r),race:r.entryKind==='relay'?{relay:true,label:'Stafett'}:rowDistances.has(r.id)?assignedRace(context,rowDistances.get(r.id)):context.race(r.event,distanceMap)}));
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
  const common=['Radtype','Status','Arrangementsår','Regelmodell','Profil','Offentlig manifest SHA-256','Historikk SHA-256','Merkeregister SHA-256','Startliste SHA-256','Kildeformat','Kildeleverandør','Kildeversjon','Kilden endret','Forrige startliste SHA-256','Importtidspunkt','Merkeutvalg','Distanseutvalg'],prefix=[analysis.status,analysis.year,analysis.policy,analysis.meta.profileId||'',analysis.meta.manifestSha256||'',analysis.meta.historySha256||'',analysis.meta.registrySha256||'',analysis.meta.sourceSha256||'',analysis.meta.format||'',analysis.meta.source?.provider||'',analysis.meta.source?.version||'',analysis.meta.source?.changedAt||'',analysis.comparison?.previousSourceSha256||'',analysis.meta.importedAt||'',analysis.viewFilters?.badge||'all',analysis.viewFilters?.distance||'all'];let headers,rows;
  if(type==='orders'){headers=['Merke','Terskel','Bekreftede identiteter','Usikre muligheter','Øvre behov blant vurderte kandidater','Forbehold'];rows=analysis.orders.map(o=>[o.badgeName,o.threshold,o.confirmed,o.uncertain,o.prepareMax,'Ukjente eller sperrede rader kan øke behovet. Alle antall avhenger av faktisk tellende deltakelse.'+(o.ambiguous?' Alternative identiteter; ikke summer ukritisk på tvers av merker.':'')]);}
  else if(type==='forecast'){headers=['Navn','Kanonisk ID/forslag','Merke','Historiske år','Mulige år','Identitet','Distanser','Forbehold'];rows=analysis.forecast.map(f=>[f.name,f.candidateId,f.badgeName,f.historicalCount,f.possibleCount,f.confirmed?'Bekreftet i arbeidsgrunnlaget':'Usikker',f.distances.join(' / '),f.caveats.join(' ')]);}
  else if(type==='review'){headers=['Rad','Navn','Tilstand','Grunnlag','Kandidat-ID-er','Kandidatnavn'];rows=analysis.rows.filter(r=>!['confirmed','new'].includes(r.match.status)||r.errors.length||r.warnings.length).map(r=>[r.line,r.name,r.match.status,[...r.errors,...r.warnings,r.match.reason].join(' '),r.match.candidates.map(p=>p.id).join(' / '),r.match.candidates.map(p=>p.name).join(' / ')]);}
  else if(type==='import'){headers=['Rad','Navn','EQ-ID','Startnummer','Distanse i fil','Valgt distanse','Klasse','Klubb','Starttid','Nasjon','Innlesingsstatus','Personstatus','Endring','Feil/forbehold'];const changes=new Map((analysis.comparison?.links||[]).map(l=>[l.after.id,l.unchanged?'Uendret':'Endret']));rows=analysis.rows.map(r=>[r.line,r.name,r.athleteId,r.bib,r.event,r.race?.label||'Må velges',r.className,r.club,r.startTime,r.nation,r.errors.length?'Avvist':r.duplicate?'Duplikat':'Lest',r.match.status,analysis.comparison?changes.get(r.id)||'Ny i fila':'Første import',[...r.errors,...r.warnings].join(' ')]);for(const r of analysis.comparison?.missingRows||[])rows.push(['Forrige fil: '+r.line,r.name,r.athleteId,r.bib,r.event,r.race?.label||'Må velges',r.className,r.club,r.startTime,r.nation,'Ikke med i ny fil',r.match.status,'Ikke med – ingen avmelding registrert','Eksportens fullstendighet og utvalg må kontrolleres.']);}
  else throw Error('Ukjent rapporttype.');
  const escape=v=>{let s=String(v??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const records=rows.length?rows.map(r=>['Data',...prefix,...r]):[['Rapportmetadata – ingen datarader',...prefix,...headers.map(()=> '')]];return '\uFEFF'+[common.concat(headers),...records].map(r=>r.map(escape).join(';')).join('\r\n')+'\r\n';
 }
 return {MAX_BYTES,MAX_ROWS,fields,decode,parse,parseCsv,parseXml,detectMapping,rows,createContext,assignDistances,carryDistances,analyze,compare,carryDecisions,csvReport,normal,fold,identity,signature,weak,yearValue};
});

/* C2.2 portable correction proposals. This is not an issuer or production writer.
   Included in the existing approved intake bundle; no new publication surface. */
(function (factory) {
 if (typeof module==='object'&&module.exports) module.exports.Corrections=factory(require('../../js/history-data.js'),module.exports);
 else window.MorothonCorrections=factory(window.MorothonHistoryData,window.MorothonIntake);
})(function (initialRules,Intake) {
 'use strict';
 const FORMAT='morothon-corrections-v1',MAX_BYTES=2*1024*1024,MAX_CASES=500;
 const statuses=['reported','review','proposed','handoff','rejected'];
 const labels={reported:'Meldt inn',review:'Til vurdering',proposed:'Foreslått retting',handoff:'Lokalt klargjort',rejected:'Avvist'};
 const kinds=['merge','person','alias','result','add','remove','reverse'];
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const rules=()=>initialRules||globalThis.MorothonHistoryData;
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 function keys(v,names,at){if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).sort().join('|')!==names.slice().sort().join('|'))throw Error('Ukjente eller manglende felt: '+at);}
 function text(v,at,max=2000,empty=false){if(typeof v!=='string'||v.length>max||!empty&&!v.trim()||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Ugyldig tekst: '+at);}
 function safeTree(v,depth=0){if(depth>16)throw Error('For dyp rettingspakke.');if(typeof v==='string')text(v,'innhold',20000,true);else if(v&&typeof v==='object'){if(Array.isArray(v)&&v.length>50000)throw Error('For mange verdier.');for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Utrygt feltnavn.');safeTree(v[k],depth+1);}}else if(v!==null&&!['number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))throw Error('Ugyldig verdi.');}
 const now=()=>new Date().toISOString();
 const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 function validateBinding(b){keys(b,['dataVersion','manifestSha256','historySha256','snapshotSha256'],'datagrunnlag');if(!Number.isSafeInteger(b.dataVersion)||b.dataVersion<1||['manifestSha256','historySha256','snapshotSha256'].some(k=>!/^[a-f0-9]{64}$/.test(b[k])))throw Error('Ugyldig dataversjon eller kildehash.');}
 async function binding(history,meta){rules().assertValid(history);const b={dataVersion:meta.dataVersion,manifestSha256:meta.manifestSha256,historySha256:meta.historySha256,snapshotSha256:await hash(history)};validateBinding(b);return b;}
 function empty(base){validateBinding(base);return {format:FORMAT,version:1,base:clone(base),cases:[]};}
 function selectorValid(s){keys(s,['index','rowSha256','historySha256'],'resultatvalg');if(!Number.isSafeInteger(s.index)||s.index<0||!/^([a-f0-9]{64})$/.test(s.rowSha256)||!/^([a-f0-9]{64})$/.test(s.historySha256))throw Error('Velg ett entydig resultat.');}
 function validateChange(c){
  keys(c,['kind','personIds','selector','before','after','reverses'],'retting');if(!kinds.includes(c.kind)||!Array.isArray(c.personIds)||c.personIds.length<1||c.personIds.length>2||c.personIds.some(v=>!id(v))||new Set(c.personIds).size!==c.personIds.length)throw Error('Ugyldig retting eller personvalg.');
  if(c.selector!==null)selectorValid(c.selector);
  if(['person','alias','add','remove'].includes(c.kind)&&c.personIds.length!==1)throw Error('Rettelsen krever én entydig person.');
  if(['result','remove'].includes(c.kind)&&!c.selector||['merge','person','alias','add','reverse'].includes(c.kind)&&c.selector!==null)throw Error('Resultatvelgeren passer ikke til rettingen.');
  if(c.kind==='reverse'){if(!id(c.reverses)||c.before!==null||c.after!==null)throw Error('Reversering krever opprinnelig sak.');}else if(c.reverses!==null)throw Error('Uventet reverseringsreferanse.');
  if(c.kind==='result'&&(!Array.isArray(c.before)||!Array.isArray(c.after))||c.kind==='add'&&(c.before!==null||!Array.isArray(c.after))||c.kind==='remove'&&(!Array.isArray(c.before)||c.after!==null))throw Error('Ugyldige resultatverdier.');
  if(c.kind==='alias'&&(!Array.isArray(c.before)||!Array.isArray(c.after)||c.after.some(v=>typeof v!=='string'||!v.trim()||v.length>200)))throw Error('Ugyldige historiske aliaser.');
  if(c.kind==='person'){keys(c.before,['person','aliases'],'person før');keys(c.after,['person','aliases'],'person etter');if(!Array.isArray(c.before.aliases)||!Array.isArray(c.after.aliases))throw Error('Ugyldig personretting.');}
  if(c.kind==='merge'){keys(c.before,['people','redirects','aliases','ownership'],'sammenslåing før');keys(c.after,['redirects','aliases'],'sammenslåing etter');if(c.personIds.length!==2||!Array.isArray(c.before.people)||c.before.people.length!==2||!Array.isArray(c.before.ownership))throw Error('Sammenslåingen mangler rekonstruerbart grunnlag.');}
 }
 function validatePackage(p){
  keys(p,['format','version','base','cases'],'pakke');if(p.format!==FORMAT||p.version!==1)throw Error('Ukjent rettingsformat eller versjon.');validateBinding(p.base);
  if(!Array.isArray(p.cases)||p.cases.length>MAX_CASES)throw Error('Maksimalt 500 saker.');safeTree(p);const seen=new Set();
  for(const c of p.cases){keys(c,['id','category','personIds','description','source','createdAt','status','reason','change','events',...(Object.hasOwn(c,'registration')?['registration']:[])],'sak');if(!id(c.id)||seen.has(c.id))throw Error('Duplikat eller ugyldig saks-ID.');seen.add(c.id);text(c.category,'kategori',80);text(c.description,'beskrivelse');text(c.source,'kildereferanse',1500,true);text(c.reason,'begrunnelse',2000,true);if(!Array.isArray(c.personIds)||c.personIds.length>2||c.personIds.some(v=>!id(v)))throw Error('Ugyldige berørte personer.');if(!statuses.includes(c.status)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(c.createdAt)||!Number.isFinite(Date.parse(c.createdAt)))throw Error('Ugyldig saksstatus eller tidspunkt.');
   if(c.registration!==undefined&&c.registration!==null){keys(c.registration,['selector','before'],'innmeldt registrering');selectorValid(c.registration.selector);if(c.registration.selector.historySha256!==p.base.historySha256||!Array.isArray(c.registration.before)||c.registration.before.length<6||c.registration.before.length>10)throw Error('Ugyldig opprinnelig registrering.');}
   if(c.change){validateChange(c.change);if(!same(c.personIds,c.change.personIds))throw Error('Sak og retting gjelder ulike personer.');}
   if(['proposed','handoff'].includes(c.status)&&(!c.change||!c.source.trim()||!c.reason.trim()))throw Error('Rettelsen trenger kilde og begrunnelse.');
   if(!Array.isArray(c.events)||c.events.length>500)throw Error('Ugyldig revisjonshistorikk.');for(const e of c.events){keys(e,['at','action','reason'],'hendelse');text(e.action,'hendelse',80);text(e.reason,'hendelsesgrunn',2000,true);if(!Number.isFinite(Date.parse(e.at)))throw Error('Ugyldig hendelsestid.');}
  }return p;
 }
 function serialize(p){validatePackage(p);const s=JSON.stringify(p,null,2)+'\n';if(new TextEncoder().encode(s).length>MAX_BYTES)throw Error('Rettingspakken overstiger 2 MB.');return s;}
 function parse(s){if(typeof s!=='string'||new TextEncoder().encode(s).length>MAX_BYTES)throw Error('Velg en rettingspakke på maksimalt 2 MB.');let p;try{p=JSON.parse(s);}catch{throw Error('Rettingsfilen er ikke gyldig JSON.');}return clone(validatePackage(p));}
 function importPackage(current,incoming){
  validatePackage(current);validatePackage(incoming);if(!same(current.base,incoming.base))throw Error('Pakken gjelder en annen dataversjon eller kildehash.');
  const next=clone(current);let added=0,duplicates=0;
  for(const original of incoming.cases){const existing=next.cases.find(c=>c.id===original.id);if(existing){const comparable=c=>({id:c.id,category:c.category,personIds:c.personIds,description:c.description,source:c.source,createdAt:c.createdAt,reason:c.reason,change:c.change,registration:c.registration??null});if(!same(comparable(existing),comparable(original)))throw Error('Konflikt i saks-ID '+original.id+'. Ingen saker ble overskrevet.');duplicates++;continue;}
   const c=clone(original);if(c.status==='handoff')c.status='proposed';c.events.push({at:now(),action:'imported-untrusted',reason:'Import er et arbeidsgrunnlag. Ingen autentisert godkjenning eller publisering er overtatt.'});next.cases.push(c);added++;
  }if(added)invalidateHandoffs(next);validatePackage(next);return {package:next,added,duplicates};
 }
 function report(p,{id:caseId,category='Manuell sak',personIds=[],description,source=''}){
  const next=clone(p);if(next.cases.some(c=>c.id===caseId))throw Error('Saks-ID finnes allerede.');next.cases.push({id:caseId,category,personIds:[...personIds],description,source,createdAt:now(),status:'reported',reason:'',change:null,events:[{at:now(),action:'reported',reason:'Lokalt registrert; ikke sendt eller publisert.'}]});validatePackage(next);return next;
 }
 const fingerprint=p=>JSON.stringify(p.cases.map(c=>[c.id,c.change,c.source,c.reason,['proposed','handoff'].includes(c.status)]));
 function invalidateHandoffs(p){for(const c of p.cases)if(c.status==='handoff'){c.status='proposed';c.events.push({at:now(),action:'handoff-invalidated',reason:'Rettingsgrunnlaget er endret. Ny konsekvenskontroll kreves.'});}}
 function updateNotes(p,caseId,{description,source,reason,personIds,registration}){const next=clone(p),c=next.cases.find(c=>c.id===caseId);if(!c)throw Error('Saken finnes ikke.');invalidateHandoffs(next);c.description=description;c.source=source;c.reason=reason;if(personIds!==undefined)c.personIds=clone(personIds);if(registration!==undefined)c.registration=clone(registration);c.events.push({at:now(),action:'note-updated',reason:'Lokalt saksgrunnlag oppdatert. Ingen offentlig innsending.'});validatePackage(next);return next;}
 function transition(p,caseId,status,reason,impact){
  const next=clone(p),c=next.cases.find(c=>c.id===caseId);if(!c||!statuses.includes(status))throw Error('Ugyldig sak eller status.');text(reason,'beslutningsgrunn',2000);
  if(['proposed','handoff'].includes(status)&&!c.change)throw Error('Definer en retting først.');
  if(status==='handoff'&&(!impact||impact.ready!==true||impact.caseId!==c.id||impact.changeHash!==JSON.stringify(c.change)||impact.baseHash!==p.base.snapshotSha256||impact.packageFingerprint!==fingerprint(p)||impact.uncertain?.length||impact.errors?.length))throw Error('Beregn og avklar konsekvensene for dette forslaget først.');
  if(['proposed','handoff'].includes(c.status)&&!['proposed','handoff'].includes(status))invalidateHandoffs(next);
  c.status=status;c.reason=reason;c.events.push({at:now(),action:status,reason});validatePackage(next);return next;
 }
 async function resultSelector(history,index,base){if(!Number.isSafeInteger(index)||!history.results[index])throw Error('Velg et registrert resultat.');return {index,rowSha256:await hash(history.results[index]),historySha256:base.historySha256};}
 async function propose(history,p,caseId,{kind,personIds,selector=null,after=null,source,reason,reverses=null}){
  validatePackage(p);const model=rules().create(history);let before=null;
  if(kind==='merge'){
   const [from,to]=personIds;if(from===to||model.resolve(from)!==from||model.resolve(to)!==to||!model.person(from)||!model.person(to))throw Error('Velg to ulike kanoniske profiler.');
   before={people:personIds.map(id=>clone(model.person(id))),redirects:clone(history.redirects||{}),aliases:clone(history.aliases||{}),ownership:history.results.map((row,index)=>({index,row})).filter(({row})=>personIds.includes(model.resolve(row[1])))};
   const aliases=clone(history.aliases||{});aliases[to]=[...new Set([...(aliases[to]||[]),model.person(from).n,...Object.entries(aliases).filter(([id])=>model.resolve(id)===from).flatMap(([,names])=>names)])];
   after={redirects:{...history.redirects,[from]:to},aliases};
  }else if(kind==='alias'){before=clone(history.aliases?.[personIds[0]]||[]);}
  else if(kind==='person'){before={person:clone(model.person(personIds[0])),aliases:clone(history.aliases?.[personIds[0]]||[])};after={person:{...before.person,...after},aliases:[...new Set([...before.aliases,...(after.n&&after.n!==before.person.n?[before.person.n]:[])])]};}
  else if(['result','remove'].includes(kind)){if(!selector)throw Error('Velg ett entydig resultat.');before=clone(history.results[selector.index]);personIds=[...new Set([model.resolve(before[1]),...(after?[model.resolve(after[1])]:[])])];}
  else if(kind==='reverse'){if(!p.cases.some(c=>c.id===reverses&&c.change&&c.status!=='rejected'))throw Error('Opprinnelig forslag mangler.');}
  const change={kind,personIds,selector,before,after,reverses};validateChange(change);
  const next=clone(p),c=next.cases.find(c=>c.id===caseId);if(!c)throw Error('Saken finnes ikke.');if(c.status==='handoff')throw Error('Trekk tilbake overleveringen før forslaget endres.');
  invalidateHandoffs(next);c.personIds=[...personIds];c.change=clone(change);c.source=source;c.reason=reason;c.status='proposed';c.events.push({at:now(),action:'proposed',reason});validatePackage(next);return next;
 }
 async function applyCandidate(history,p,base,{preview=false}={}){
  validatePackage(p);validateBinding(base);if(!same(p.base,base)||await hash(history)!==base.snapshotSha256)throw Error('Foreldet dataversjon, kildehash eller grunnlag.');
  for(const c of p.cases)if(c.registration){const {selector,before}=c.registration;if(!same(history.results[selector.index],before)||await hash(before)!==selector.rowSha256)throw Error('Den innmeldte originalregistreringen stemmer ikke med historikken.');}
  const H=rules(),data=clone(history),rows=data.results.map((row,index)=>({index,row})),journal=[],applied=new Map();
  function mergeCompatible(c){const [from,to]=c.personIds,model=H.create(data),a=model.person(from),b=model.person(to);if(!a||!b||model.resolve(from)!==from||model.resolve(to)!==to||a.g&&b.g&&a.g!==b.g)throw Error('Motstridende eller endret identitet stopper sammenslåing.');
   const left=model.resultsFor(from),right=model.resultsFor(to);if(left.some(x=>right.some(y=>x[0]===y[0]&&x[2]===y[2]&&x[3]===y[3])))throw Error('Overlapp i samme år, konkurranse og distanse må avklares før sammenslåing. Ingen starter er slettet.');
  }
  async function apply(c,reverse=false){
   const ch=c.change,kind=ch.kind;if(kind==='reverse'){if(reverse)throw Error('En reversering kan ikke reversere en reversering.');const original=applied.get(ch.reverses)||p.cases.find(x=>x.id===ch.reverses&&x.change&&x.change.kind!=='reverse');if(!original)throw Error('Reversering mangler en rekonstruerbar originalhandling.');if(!same(ch.personIds,original.change.personIds))throw Error('Reverseringen gjelder andre personer enn originalhandlingen.');if(!applied.has(ch.reverses))await apply(original);await apply(original,true);applied.delete(ch.reverses);return;}
   const before=reverse?ch.after:ch.before,after=reverse?ch.before:ch.after;
   if(kind==='merge'){
    const model=H.create(data),[from,to]=ch.personIds;
    if(!reverse)mergeCompatible(ch);
    if(!same(data.redirects?.[from]??null,before.redirects[from]??null)||ch.personIds.some(id=>!same(data.aliases?.[id]||[],before.aliases[id]||[]))||reverse&&(model.resolve(from)!==to||model.resolve(to)!==to))throw Error('Forventede identitetsverdier er endret.');
    const originalPeople=ch.before.people;if(!same(ch.personIds.map(id=>data.people.find(p=>p.i===id)),originalPeople))throw Error('Forventede personverdier er endret.');
    const ownership=rows.filter(({row})=>row&&ch.personIds.includes(H.resolveId(row[1],ch.before.redirects)));
    if(!same(ownership,ch.before.ownership))throw Error('Opprinnelig resultattilhørighet kan ikke rekonstrueres uten gjetting.');
    const expectedAliases=clone(ch.before.aliases);expectedAliases[to]=[...new Set([...(expectedAliases[to]||[]),originalPeople[0].n,...Object.entries(expectedAliases).filter(([id])=>H.resolveId(id,ch.before.redirects)===from).flatMap(([,names])=>names)])];
    if(!same(ch.after.redirects,{...ch.before.redirects,[from]:to})||!same(ch.after.aliases,expectedAliases))throw Error('Sammenslåingen inneholder andre identitetsendringer.');
    data.redirects=data.redirects||{};data.aliases=data.aliases||{};if(Object.hasOwn(after.redirects,from))data.redirects[from]=after.redirects[from];else delete data.redirects[from];if(Object.hasOwn(after.aliases,to))data.aliases[to]=clone(after.aliases[to]);else delete data.aliases[to];
   }else if(kind==='alias'){
    const personId=ch.personIds[0];if(!H.create(data).person(personId)||!same(data.aliases?.[personId]||[],before))throw Error('Forventede aliaser er endret.');data.aliases=data.aliases||{};if(after.length)data.aliases[personId]=clone(after);else delete data.aliases[personId];
   }else if(kind==='person'){
    const index=data.people.findIndex(p=>p.i===ch.personIds[0]),old=before.person,next=after.person;
    if(index<0||!same(data.people[index],old)||!same(data.aliases?.[old.i]||[],before.aliases)||old.i!==next.i||Object.keys(next).sort().join('|')!==Object.keys(old).sort().join('|')||Object.keys(old).some(k=>!['n','g'].includes(k)&&!same(old[k],next[k])))throw Error('Forventet person eller tillatte navne-/kjønnsfelt stemmer ikke.');
    const expectedAliases=[...new Set([...ch.before.aliases,...(ch.after.person.n!==ch.before.person.n?[ch.before.person.n]:[])])];if(!same(ch.after.aliases,expectedAliases))throw Error('Tidligere navn må bevares.');
    text(next.n,'hovednavn',200);if(!['Herre','Dame',''].includes(next.g))throw Error('Ugyldig kjønn.');data.people[index]=clone(next);data.aliases=data.aliases||{};if(after.aliases.length)data.aliases[old.i]=clone(after.aliases);else delete data.aliases[old.i];
   }else if(kind==='add'){
    if(reverse){const found=rows.findIndex(r=>r.addedBy===c.id);if(found<0||!same(rows[found].row,ch.after))throw Error('Tillegget kan ikke reverseres trygt.');rows.splice(found,1);}else{if(rows.some(r=>same(r.row,ch.after)))throw Error('Resultatet finnes allerede.');rows.push({index:null,row:clone(ch.after),addedBy:c.id});}
   }else{
    if(ch.selector.historySha256!==base.historySha256||await hash(ch.before)!==ch.selector.rowSha256)throw Error('Resultatvelgerens kildehash stemmer ikke.');
    const matches=rows.filter(r=>r.index===ch.selector.index);if(matches.length!==1)throw Error('Resultatet er ikke entydig tilgjengelig.');const slot=matches[0];
    if(kind==='remove'){
     if(reverse){if(slot.row!==null)throw Error('Resultatet kan ikke gjenopprettes trygt.');slot.row=clone(ch.before);}else{if(!same(slot.row,ch.before))throw Error('Resultatets førverdier er endret.');slot.row=null;}
    }else{if(!same(slot.row,before))throw Error('Resultatets førverdier er endret.');slot.row=clone(after);}
   }
   data.results=rows.filter(r=>r.row!==null).map(r=>r.row);H.assertValid(data);
   if(['add','result'].includes(kind)&&!reverse){const r=ch.after;if(r.length!==10||![2,3,4,5,7,8,9].every(i=>typeof r[i]==='string'&&r[i].length<=200)||!(r[6]===null||Number.isInteger(r[6])&&r[6]>0||['','DNF','DNS','Disket','DQ'].includes(r[6])))throw Error('Ugyldige resultatfelt eller kildeplassering.');}
   if(['add','result'].includes(kind)&&!reverse&&!data.yearStats.some(r=>r[0]===ch.after[0]))throw Error('Resultatåret finnes ikke i arrangementsregisteret.');
   if(['add','result'].includes(kind)&&!reverse&&!ch.personIds.includes(H.resolveId(ch.after[1],data.redirects||{})))throw Error('Resultatet tilhører ikke sakens valgte person.');
  }
  for(const c of p.cases){if(!(c.status==='handoff'||preview&&c.status==='proposed'))continue;await apply(c);applied.set(c.id,c);journal.push({caseId:c.id,kind:c.change.kind,source:c.source,reason:c.reason,reverses:c.change.reverses});}
  return {history:data,journal,productionApplied:false};
 }
 // Names are compared by role and complete tokens. Years never create identity evidence.
 const identityCategories=new Set(['Navn eller alias','Mulige duplikater','Navnevariant','Mulig navnevariant','Mulig navneendring']);
 function nameParts(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/[‐‑‒–—-]/g,' ').replace(/’/g,"'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu)||[];}
 function oneNameEdit(a,b){
  if(Math.min(a.length,b.length)<5||Math.abs(a.length-b.length)>1)return false;
  if(a.length===b.length){let k=0;while(k<a.length&&a[k]===b[k])k++;if(k+1<a.length&&a[k]===b[k+1]&&a[k+1]===b[k]&&a.slice(k+2)===b.slice(k+2))return true;}
  let i=0,j=0,differences=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++differences>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  if(differences+(i<a.length||j<b.length?1:0)<=1)return true;return false;
 }
 function tokenRelation(a,b){
  if(a===b)return 'exact';
  if(a.length===1&&b.length>=3&&a===b[0]||b.length===1&&a.length>=3&&b===a[0])return 'initial';
  // Preserve ø/æ/å. Only explicit Norwegian transliterations are alternatives;
  // variants remain review signals, never identity confirmations.
  const norwegian=v=>v.replace(/aa/g,'å').replace(/ae/g,'æ').replace(/oe/g,'ø');
  if(Math.min(a.length,b.length)>=2&&Math.max(a.length,b.length)>=3&&norwegian(a)===norwegian(b))return 'variant';
  return oneNameEdit(a,b)?'typo':null;
 }
 function middleRelation(a,b){
  const short=a.length<=b.length?a:b,long=a.length<=b.length?b:a;
  let position=0,initial=false,typo=false;const used=new Set(),initialLetters=new Set();
  for(const token of short){let match=null;while(position<long.length){const r=tokenRelation(token,long[position++]);if(r&&(!typo||!['typo','variant'].includes(r))){match=r;break;}}if(!match)return null;used.add(position-1);if(match==='initial')initialLetters.add(token[0]);initial ||= match==='initial';typo ||= ['typo','variant'].includes(match);}
  if(initial&&long.some((token,i)=>!used.has(i)&&token.length===1&&initialLetters.has(token)))return null;
  return {extra:short.length!==long.length,initial,typo};
 }
 function compareNames(left,right){return compareNameParts(nameParts(left),nameParts(right));}
 function compareNameParts(a,b){
  if(a.length<2||b.length<2)return null;
  const signal=(category,strength,reason)=>({category,strength,reason:reason+' Det kan være forskjellige personer; identiteten må kontrolleres.'});
  if(same(a,b))return signal('Mulige duplikater','strong','Identisk normalisert fullt navn på ulike kanoniske profiler.');
  const given=tokenRelation(a[0],b[0]),family=tokenRelation(a.at(-1),b.at(-1));
  if(given&&family){
   const middle=middleRelation(a.slice(1,-1),b.slice(1,-1));if(!middle)return null;
   if(given==='exact'&&family==='exact'&&Math.min(a[0].length,a.at(-1).length)>=2&&a[0].length+a.at(-1).length>=7){
    if(middle.typo)return signal('Mulig navnevariant','moderate','Samme fornavn og etternavn; ett mellomnavn har en liten skrive- eller tegnvariant.');
    if(middle.initial)return signal('Navnevariant','moderate','Samme fornavn og etternavn; mellomnavn og initial samsvarer i riktig rekkefølge.');
    if(middle.extra)return signal('Navnevariant','moderate','Samme fornavn og etternavn; øvrige navneledd samsvarer, med ekstra eller manglende mellomnavn.');
   }
   if(given==='exact'&&family==='initial'||given==='initial'&&family==='initial')return null; // An abbreviated surname is insufficient.
   if(given==='initial'&&family==='exact'&&Math.min(a.at(-1).length,b.at(-1).length)>=5&&!middle.typo)return signal('Mulig navnevariant','weak','Samme fulle etternavn og samsvarende fornavnsinitial; eventuelle mellomnavn er forenlige.');
   const exactAnchor=given==='exact'&&a[0].length>=3||family==='exact'&&a.at(-1).length>=4;
   const differences=[given,family].filter(v=>v!=='exact');
   if(exactAnchor&&differences.length===1&&['typo','variant'].includes(differences[0]))return signal('Mulig navnevariant',middle.typo||middle.extra||middle.initial?'weak':'moderate',given==='exact'?'Samme fornavn; etternavnet har én liten skrivevariant, og mellomnavnene er forenlige.':'Samme etternavn; fornavnet har én liten skrivevariant, og mellomnavnene er forenlige.');
   if(['typo','variant'].includes(given)&&['typo','variant'].includes(family)&&Math.min(a[0].length,b[0].length,a.at(-1).length,b.at(-1).length)>=5&&!middle.extra&&!middle.initial&&!middle.typo)return signal('Mulig navnevariant','weak','Betydelig likhet i både fornavn og etternavn: hvert har ett lite avvik; mellomnavnene samsvarer.');
  }
  // A complete surname may be followed by another surname: never a substring.
  const short=a.length<b.length?a:b,long=a.length<b.length?b:a,particles=new Set(['van','von','de','del','den','der','da','di','la','le','af','av','al','el','bin','ibn']);
  if(short.length<long.length&&short[0]===long[0]&&short[0].length>=3&&short.at(-1).length>=4&&!particles.has(short.at(-1))&&short.every((v,i)=>v===long[i]))return signal('Navnevariant','moderate','Hele navnet samsvarer ledd for ledd; ett eller flere fulle etternavnsledd er lagt til.');
  return null;
 }
 function caseType(c){return identityCategories.has(c.category)||c.change?.kind==='merge'?'identity':'report';}
 const caseBucket=c=>c.status==='rejected'||c.status==='handoff'?'finished':c.status==='reported'&&!c.events.some(e=>e.action==='note-updated')?'pending':'followup';
 function suggestionKey(s){return JSON.stringify(identityCategories.has(s.category)?['identity',[...s.personIds].sort(),...(s.identityBasis?[s.identityBasis]:[])]:[s.category,[...s.personIds].sort(),s.resultIndexes||[],s.source||'']);}
 async function reviewSuggestions(suggestions,p){
  validatePackage(p);
  const pair=ids=>JSON.stringify([...ids].sort());
  return Promise.all(suggestions.map(async s=>{
   const origin='suggestion-'+await hash(suggestionKey(s)),basis=s.identityBasis?'identity-basis-'+await hash(s.identityBasis):null;
   const legacyOrigin=identityCategories.has(s.category)?'suggestion-'+await hash(JSON.stringify(['identity',[...s.personIds].sort()])):null;
   let cases=p.cases.filter(c=>c.events.some(e=>e.action===origin)||legacyOrigin&&!c.events.some(e=>e.action.startsWith('identity-basis-'))&&c.events.some(e=>e.action===legacyOrigin));
   if(!cases.length)cases=p.cases.filter(c=>{
    if(pair(c.personIds)!==pair(s.personIds))return false;
    const recordedBasis=c.events.filter(e=>e.action.startsWith('identity-basis-'));
    if(identityCategories.has(s.category)&&recordedBasis.length)return recordedBasis.some(e=>e.action===basis);
    if(identityCategories.has(s.category)&&c.change?.kind==='merge')return true;
    if(c.events.some(e=>/^suggestion-[a-f0-9]{64}$/.test(e.action)))return false;
    if(identityCategories.has(s.category))return identityCategories.has(c.category)||c.change?.kind==='merge';
    if(c.category!==s.category)return false;
    if(c.change?.selector)return s.resultIndexes?.includes(c.change.selector.index);
    return c.description===s.reason&&c.source===s.source;
   });
   // Preserve an explicitly open case if older packages contain multiple cases.
   const bucket=caseBucket;
   cases.sort((a,b)=>['pending','followup','finished'].indexOf(bucket(a))-['pending','followup','finished'].indexOf(bucket(b)));
   const c=cases[0];return {...s,origin,basis,caseId:c?.id||null,caseStatus:c?.status||null,bucket:c?bucket(c):'pending'};
  }));
 }
 async function openSuggestion(p,s,caseId){
  const [review]=await reviewSuggestions([s],p);if(review.caseId)return {package:clone(p),caseId:review.caseId,reused:true};
  const next=report(p,{id:caseId,category:s.category,personIds:s.personIds,description:s.reason,source:s.source||''});
  next.cases.at(-1).events.push({at:now(),action:review.origin,reason:'Åpnet fra et kontrollforslag. Forslagsreferansen inneholder ingen navn.'});
  if(review.basis)next.cases.at(-1).events.push({at:now(),action:review.basis,reason:'Navn, aliaser og kanoniske profiler ved denne vurderingen. Endrede løpstider gir ikke et nytt identitetsgrunnlag.'});
  validatePackage(next);return {package:next,caseId,reused:false};
 }
 async function worklist(suggestions,p){
  const reviewed=await reviewSuggestions(suggestions,p),linked=new Set(reviewed.map(s=>s.caseId).filter(Boolean));
  return {identity:[...reviewed,...p.cases.filter(c=>caseType(c)==='identity'&&!linked.has(c.id)).map(c=>({id:c.id,category:c.category,personIds:c.personIds,reason:c.description,caseId:c.id,caseStatus:c.status,bucket:caseBucket(c)}))],reports:p.cases.filter(c=>caseType(c)==='report').map(c=>({caseId:c.id,personIds:c.personIds,reason:c.description,caseStatus:c.status,bucket:caseBucket(c)}))};
 }
 async function carryDecisions(history,current,incoming){
  validatePackage(current);validatePackage(incoming);if(await hash(history)!==current.base.snapshotSha256)throw Error('Historikkgrunnlaget er endret.');
  // Strict importPackage still rejects old bases. Only non-mutating rejection
  // decisions with the same current identity evidence can be carried separately.
  let next=clone(current),added=0,duplicates=0,skipped=0;const suggestions=discover(history),pair=ids=>JSON.stringify([...ids].sort());
  for(const c of incoming.cases){
   const s=suggestions.find(s=>pair(s.personIds)===pair(c.personIds)),basis=s?'identity-basis-'+await hash(s.identityBasis):null;
   if(caseType(c)!=='identity'||c.status!=='rejected'||!basis||!c.events.some(e=>e.action===basis)){skipped++;continue;}
   const review=(await reviewSuggestions([s],next))[0];if(review.caseId){duplicates++;continue;}
   const caseId='carried-'+(await hash([incoming.base,c.id])).slice(0,56),opened=await openSuggestion(next,s,caseId);next=updateNotes(opened.package,caseId,{description:c.description,source:c.source,reason:c.reason});next=transition(next,caseId,'rejected',c.reason||'Tidligere vurdert som forskjellige personer.');next.cases.at(-1).events.push({at:now(),action:'decision-carried',reason:'Tidligere avvisning med samme navnegrunnlag. Kildegrunnlag '+incoming.base.snapshotSha256+'. Ingen retting eller godkjenning er overtatt.'});added++;
  }validatePackage(next);return {package:next,added,duplicates,skipped};
 }

 function discover(history){
  const H=rules(),model=H.create(history),people=[...model.people.values()],found=[],seen=new Set();
  function add(category,personIds,reason,strength='moderate',resultIndexes=[],source=''){const key=JSON.stringify([category,[...personIds].sort(),resultIndexes,reason]);if(seen.has(key))return;seen.add(key);found.push({id:'suggestion-'+(found.length+1),category,personIds,reason,strength,resultIndexes,source});}
  const namesById=new Map(people.map(p=>[p.i,new Set([p.n])])),parts=new Map(),indexById=new Map(people.map((p,i)=>[p.i,i]));
  const split=name=>{if(!parts.has(name))parts.set(name,nameParts(name));return parts.get(name);};
  for(const p of history.people)namesById.get(model.resolve(p.i))?.add(p.n);
  for(const [id,names]of Object.entries(history.aliases||{}))for(const name of names)namesById.get(model.resolve(id))?.add(name);
  const exactNames=new Map();for(const [id,names]of namesById)for(const name of names){const tokens=split(name),key=JSON.stringify(tokens);if(tokens.length<2)continue;if(!exactNames.has(key))exactNames.set(key,new Set());exactNames.get(key).add(id);}
  const documented=new Set(),candidatePairs=new Set(),pairKey=(i,j)=>i<j?i+':'+j:j+':'+i;
  for(const matches of exactNames.values()){const ids=[...matches];for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const key=pairKey(indexById.get(ids[a]),indexById.get(ids[b]));documented.add(key);candidatePairs.add(key);}}
  // Compare each given-name pair once, then only eligible profile pairs.
  // This is an index, not relaxed matching: compareNameParts is still decisive.
  const givenNames=new Map();for(let i=0;i<people.length;i++){const tokens=split(people[i].n);if(tokens.length<2)continue;const given=tokens[0];if(!givenNames.has(given))givenNames.set(given,[]);givenNames.get(given).push(i);}
  const groups=[...givenNames];for(let a=0;a<groups.length;a++)for(let b=a;b<groups.length;b++){
   if(!tokenRelation(groups[a][0],groups[b][0]))continue;
   for(const i of groups[a][1])for(const j of groups[b][1])if(i!==j)candidatePairs.add(pairKey(i,j));
  }
  const ordered=[...candidatePairs].map(key=>key.split(':').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const finishes=new Map();for(const row of history.results){const seconds=H.isCompletedResult(row)&&!H.isRelayRace(row)?H.timeSeconds(row[5]):null;if(seconds===null)continue;const id=model.resolve(row[1]),key=JSON.stringify([row[0],row[2],H.parseDistanceKm(row[3])]);if(!finishes.has(id))finishes.set(id,new Map());const events=finishes.get(id);if(!events.has(key))events.set(key,new Set());events.get(key).add(seconds);}
  for(const [i,j]of ordered){
   const a=people[i],b=people[j],aParts=split(a.n),bParts=split(b.n);
   // Different completed times in the same edition/course are independent
   // counterevidence. Suppress the automatic suggestion, never assign identity.
   const left=finishes.get(a.i),right=finishes.get(b.i);if(left&&right&&[...left].some(([key,times])=>right.has(key)&&[...times].some(x=>[...right.get(key)].some(y=>x!==y))))continue;
   if(documented.has(pairKey(i,j))){
    const match=same(aParts,bParts)?compareNameParts(aParts,bParts):{category:'Navn eller alias',strength:'strong',reason:'Et fullt registrert navn, godkjent alias eller en tidligere godkjent ID-kobling samsvarer på tvers av kanoniske profiler. Kontroller identiteten.'};
    if(match)add(match.category,[a.i,b.i],match.reason,match.strength);continue;
   }
   const match=compareNameParts(aParts,bParts);if(match&&match.strength!=='weak')add(match.category,[a.i,b.i],match.reason,match.strength);
  }
  // Result equality, missing historical times and start-list ambiguities stay
  // in their own validators/workflows. They are not identity evidence.
  for(const s of found){s.reason=s.reason.replace('Identisk normalisert fullt navn på ulike kanoniske profiler.','Begge profilene har samme fulle navn.').replace('Et fullt registrert navn, godkjent alias eller en tidligere godkjent ID-kobling samsvarer på tvers av kanoniske profiler. Kontroller identiteten.','Et registrert navn eller godkjent alias er felles for de to profilene. Kontroller om dette er samme person.');s.identityBasis=JSON.stringify([...s.personIds].sort().map(id=>{
   const other=s.personIds.find(x=>x!==id),relevant=[...namesById.get(id)].filter(name=>[...namesById.get(other)].some(n=>{const signal=compareNames(name,n);return signal&&signal.strength!=='weak';}));
   return {id,name:nameParts(model.person(id).n).join(' '),names:[...new Set(relevant.map(name=>nameParts(name).join(' ')))].sort(),gender:model.person(id)?.g||''};
  }));}
  return found;
 }
 async function consequences(history,p,caseId,base,project,{linkedRunnerIds=[]}={}){
  const c=p.cases.find(c=>c.id===caseId);if(!c?.change)throw Error('Definer et konkret rettingsforslag først.');
  const all=await applyCandidate(history,p,base,{preview:true}),beforePackage=clone(p);beforePackage.cases=beforePackage.cases.filter(x=>x.id!==caseId&&!(x.change?.kind==='reverse'&&x.change.reverses===caseId));
  const before=await applyCandidate(history,beforePackage,base,{preview:true});
  const beforeView=await project(before.history),afterView=await project(all.history),changes=[];
  for(const key of ['people','annual','records','placements','rankings','diplomas','loyalty','redirects','aliases']){if(!(key in beforeView)||!(key in afterView))throw Error('Konsekvensmotoren mangler '+key);changes.push({area:key,status:same(beforeView[key],afterView[key])?'unchanged':'changed',before:beforeView[key],after:afterView[key]});}
  const affected=new Set(c.change.personIds),uncertain=[];
  if(c.change.kind==='merge')for(const id of affected)if(linkedRunnerIds.includes(id))uncertain.push('Sammenslåingen berører en Heder-kobling. Privat kilde og Heder-diplomgrunnlag må gjennomgås av autorisert forvalter.');
  for(const id of new Set([...Object.keys(beforeView.people),...Object.keys(afterView.people)]))if((!same(beforeView.people[id],afterView.people[id])||!same(beforeView.diplomas[id],afterView.diplomas[id])||!same(beforeView.loyalty[id],afterView.loyalty[id]))&&linkedRunnerIds.includes(id))uncertain.push('Endret løpsgrunnlag for Heder-profil '+id+' krever kontroll av hederstekst og diplomgodkjenning.');

  // Source positions are historical evidence. Changed calculated order does not rewrite them.
  const place=changes.find(x=>x.area==='placements');if(place.status==='changed'){
   const key=r=>JSON.stringify([r.personId,r.year,r.event,r.distance,r.className,r.bib]),beforeRanks=new Map(beforeView.placements.map(r=>[key(r),r]));for(const r of afterView.placements){const old=beforeRanks.get(key(r));if(old&&old.rank!==r.rank&&!affected.has(r.personId)&&r.sourcePlace!==r.rank)uncertain.push('Andre løperes kildeplasseringer avviker fra ny beregning. Kontroller og foreslå kildebaserte rettelser før overlevering.');}
  }
  const candidateModel=rules().create(all.history);
  for(const row of all.history.results)if(rules().isJuniorRace(row)&&/^[KM]\d/.test(row[7]||'')&&c.change.personIds.includes(row[1])){const g=candidateModel.person(row[1])?.g;if(row[7].startsWith('K')&&g==='Herre'||row[7].startsWith('M')&&g==='Dame')uncertain.push('Juniorklasse og kjønn må avklares før overlevering.');}
  if(c.change.kind==='remove'&&history.results.filter(r=>same(r,c.change.before)).length<2)uncertain.push('Raden er ikke en identisk dobbeltregistrering. Ytterligere kildekontroll er nødvendig før overlevering.');
  if(['person','alias'].includes(c.change.kind))for(const id of c.change.personIds){const canonical=candidateModel.resolve(id),p=candidateModel.person(id);if(!p)continue;const names=[p.n,...Object.entries(all.history.aliases||{}).filter(([key])=>candidateModel.resolve(key)===canonical).flatMap(([,a])=>a)].map(Intake.normal);for(const other of candidateModel.people.values())if(other.i!==canonical&&names.includes(Intake.normal(other.n)))uncertain.push('Navn eller alias treffer en annen eksisterende profil. Identiteten må avklares.');}
  const errors=rules().validate(all.history).errors;
  return {caseId,baseHash:base.snapshotSha256,packageFingerprint:fingerprint(p),changeHash:JSON.stringify(c.change),ready:!uncertain.length&&!errors.length,changes,uncertain:[...new Set(uncertain)],errors,candidate:all.history,journal:all.journal,productionApplied:false};
 }
 // C2.4a coordinates the existing case contract. A candidate is a local review
 // artifact, never an authenticated approval or an A1C publication package.
 const CANDIDATE_FORMAT='morothon-correction-candidate-v1',CANDIDATE_BYTES=16*1024*1024;
 const candidateRequirements=()=>({authenticatedApproval:true,verifiedBackup:true,privateSourceReview:true,freshPublicExport:true});
 const projectionAreas=['people','annual','records','placements','rankings','diplomas','loyalty','redirects','aliases'];
 function cachedProjection(project){const cache=new Map();return async history=>{const key=await hash(history);if(!cache.has(key))cache.set(key,Promise.resolve().then(()=>project(clone(history))));return cache.get(key);};}
 function exactDelta(before,after){return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!same(before[k],after[k])).map(field=>({field,beforePresent:Object.hasOwn(before,field),afterPresent:Object.hasOwn(after,field),before:clone(before[field]??null),after:clone(after[field]??null)}));}
 function compactEffects(before,after){return projectionAreas.map(area=>{
  if(!(area in before)||!(area in after))throw Error('Konsekvensmotoren mangler '+area);
  const a=before[area],b=after[area];return {area,status:same(a,b)?'unchanged':'changed',entries:exactDelta(a,b)};
 });}
 const candidateBody=packet=>{const body={...packet};delete body.checksum;return body;};
 function candidateShape(packet){
  keys(packet,['format','version','base','corrections','result','delta','effects','audit','rollback','requirements','publicationAuthorized','productionApplied','checksum'],'endringskandidat');safeTree(packet);
  if(packet.format!==CANDIDATE_FORMAT||packet.version!==1||packet.publicationAuthorized!==false||packet.productionApplied!==false||!same(packet.requirements,candidateRequirements()))throw Error('Kandidaten gir ingen publiseringsautorisasjon.');
  validateBinding(packet.base);validatePackage(packet.corrections);keys(packet.result,['snapshotSha256','history'],'kandidatresultat');keys(packet.rollback,['fromSnapshotSha256','toSnapshotSha256','mode'],'tilbakeføring');
  if(!same(packet.base,packet.corrections.base)||!Array.isArray(packet.delta)||!Array.isArray(packet.effects)||!Array.isArray(packet.audit)||packet.rollback.mode!=='reverse-delta-v1'||packet.rollback.fromSnapshotSha256!==packet.result.snapshotSha256||packet.rollback.toSnapshotSha256!==packet.base.snapshotSha256||![packet.checksum,packet.result.snapshotSha256].every(v=>/^[a-f0-9]{64}$/.test(v)))throw Error('Ugyldig eller ubundet endringskandidat.');
  for(const d of packet.delta){keys(d,['field','beforePresent','afterPresent','before','after'],'eksakte verdier');if(typeof d.field!=='string'||['__proto__','prototype','constructor'].includes(d.field)||typeof d.beforePresent!=='boolean'||typeof d.afterPresent!=='boolean')throw Error('Ugyldig tilbakeføringsgrunnlag.');}
  if(new Set(packet.delta.map(d=>d.field)).size!==packet.delta.length)throw Error('Dupliserte felt i tilbakeføringsgrunnlaget.');
  if(!same(packet.effects.map(e=>e.area),projectionAreas))throw Error('Konsekvensrapporten mangler påkrevde beregninger.');for(const effect of packet.effects){keys(effect,['area','status','entries'],'konsekvensområde');if(!['changed','unchanged'].includes(effect.status)||!Array.isArray(effect.entries))throw Error('Ugyldig konsekvensrapport.');for(const entry of effect.entries)keys(entry,['field','beforePresent','afterPresent','before','after'],'beregnet før- og etterverdi');}
  for(const event of packet.audit)keys(event,['caseId','kind','source','reason','reverses'],'kandidatjournal');
  rules().assertValid(packet.result.history);if(new TextEncoder().encode(JSON.stringify(packet)).length>CANDIDATE_BYTES)throw Error('Endringskandidaten overstiger 16 MB. Avgrens rettingsutvalget.');return packet;
 }
 function serializeCandidate(packet){candidateShape(packet);const text=JSON.stringify(packet,null,2)+'\n';if(new TextEncoder().encode(text).length>CANDIDATE_BYTES)throw Error('Endringskandidaten overstiger 16 MB. Avgrens rettingsutvalget.');return text;}
 async function parseCandidate(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>CANDIDATE_BYTES)throw Error('Velg en endringskandidat på maksimalt 16 MB.');let packet;try{packet=JSON.parse(text);}catch{throw Error('Endringskandidaten er ikke gyldig JSON.');}candidateShape(packet);if(await hash(candidateBody(packet))!==packet.checksum||await hash(packet.result.history)!==packet.result.snapshotSha256)throw Error('Kontrollsummen for endringskandidaten stemmer ikke.');return clone(packet);}
 async function createCandidate(history,p,base,project,options={}){
  validatePackage(p);validateBinding(base);const active=p.cases.filter(c=>['proposed','handoff'].includes(c.status));
  if(!active.length)throw Error('Ingen konkrete rettelser er klargjort.');if(active.some(c=>c.status!=='handoff'))throw Error('Bekreft de øvrige rettingsforslagene før den samlede kandidaten kan lastes ned.');
  const view=cachedProjection(project);
  for(const c of active){const impact=await consequences(history,p,c.id,base,view,options);if(!impact.ready)throw Error([...impact.uncertain,...impact.errors.map(e=>e.code)].join(' '));}
  const out=await applyCandidate(history,p,base),snapshotSha256=await hash(out.history),before=await view(history),after=await view(out.history);
  const packet={format:CANDIDATE_FORMAT,version:1,base:clone(base),corrections:parse(serialize(p)),result:{snapshotSha256,history:out.history},delta:exactDelta(history,out.history),effects:compactEffects(before,after),audit:out.journal,rollback:{fromSnapshotSha256:snapshotSha256,toSnapshotSha256:base.snapshotSha256,mode:'reverse-delta-v1'},requirements:candidateRequirements(),publicationAuthorized:false,productionApplied:false};
  packet.checksum=await hash(packet);candidateShape(packet);return packet;
 }
 async function verifyCandidate(history,packet,base,project,options={}){
  candidateShape(packet);if(!same(packet.base,base)||await hash(candidateBody(packet))!==packet.checksum)throw Error('Endringskandidaten er foreldet eller endret.');
  const expected=await createCandidate(history,packet.corrections,base,project,options);if(!same(packet,expected))throw Error('Kandidat, konsekvenser eller tilbakeføringsgrunnlag stemmer ikke med en ny kontroll.');return {valid:true,publicationAuthorized:false,productionApplied:false};
 }
 async function restoreCandidate(history,packet){
  candidateShape(packet);if(await hash(candidateBody(packet))!==packet.checksum||await hash(history)!==packet.rollback.fromSnapshotSha256)throw Error('Tilbakeføring krever nøyaktig kandidatversjon. Senere endringer må gjennomgås på nytt.');
  const out=clone(history);for(const d of packet.delta){if(Object.hasOwn(out,d.field)!==d.afterPresent||!same(out[d.field]??null,d.after))throw Error('Tilbakeføringens forventede verdier er endret.');if(d.beforePresent)out[d.field]=clone(d.before);else delete out[d.field];}
  if(await hash(out)!==packet.rollback.toSnapshotSha256)throw Error('Tilbakeføringen gjenoppretter ikke det eksakte originalgrunnlaget.');rules().assertValid(out);return {history:out,publicationAuthorized:false,productionApplied:false};
 }
 async function prepareCase(history,p,caseId,request,base,project,options={}){
  validatePackage(p);const current=p.cases.find(c=>c.id===caseId);if(!current)throw Error('Saken finnes ikke.');
  // Reconfirming an unchanged proposal does not invalidate other reviewed cases.
  // An actual edit still uses the existing package-wide invalidation rule.
  const shadow=clone(p);if(current.status==='handoff')shadow.cases.find(c=>c.id===caseId).status='proposed';
  let proposed=await propose(history,shadow,caseId,request);const next=proposed.cases.find(c=>c.id===caseId);
  if(same(current.change,next.change)&&current.source===next.source&&current.reason===next.reason)proposed=clone(p);
  else if(current.status==='handoff')proposed=await propose(history,transition(p,caseId,'review','Klargjøringen trekkes tilbake fordi rettingsinnholdet er endret.'),caseId,request);
  const view=cachedProjection(project),impact=await consequences(history,proposed,caseId,base,view,options);
  if(!impact.ready)return {package:proposed,impact,candidate:null,ready:false,pending:[],productionApplied:false};
  const approved=transition(proposed,caseId,'handoff',request.reason,impact),pending=approved.cases.filter(c=>c.status==='proposed').map(c=>c.id);
  const candidate=pending.length?null:await createCandidate(history,approved,base,view,options);
  return {package:approved,impact,candidate,ready:true,pending,productionApplied:false};
 }
 return {FORMAT,MAX_BYTES,MAX_CASES,statuses,labels,kinds,CANDIDATE_FORMAT,CANDIDATE_BYTES,prepareCase,createCandidate,verifyCandidate,serializeCandidate,parseCandidate,restoreCandidate,caseType,worklist,carryDecisions,hash,binding,empty,validatePackage,serialize,parse,importPackage,report,updateNotes,transition,resultSelector,propose,applyCandidate,compareNames,suggestionKey,reviewSuggestions,openSuggestion,discover,consequences};
});

/* C2.3a annual result reconciliation. Uses the existing parser, identity signals
   and correction contract. No source files, identities or approvals are written. */
(function(factory){
 if(typeof module==='object'&&module.exports)module.exports.Results=factory(module.exports,module.exports.Corrections,require('../../js/history-data.js'));
 else window.MorothonResults=factory(window.MorothonIntake,window.MorothonCorrections);
})(function(I,C,initialRules){
 'use strict';
 const fields={name:'Navn',firstName:'Fornavn',lastName:'Etternavn',bib:'Startnummer',athleteId:'Ekstern utøver-ID',runnerId:'Morothon-ID (valgfritt)',year:'Arrangementsår/dato',event:'Øvelse',distance:'Eksakt distanse',className:'Klasse',gender:'Kjønn',club:'Klubb',time:'Sluttid',status:'Resultatstatus',place:'Kildeplassering'};
 const labels={unchanged:'Uendret',changed:'Endret resultat',new:'Nytt tellende resultat',missing:'Mangler i ny kilde',uncertain:'Mulig personkonflikt',conflict:'Person-/kildekonflikt',registration:'Resultat til avklaring',unassessable:'Kan ikke vurderes med tilgjengelige data',dns:'Ikke startet (DNS)',unlinked:'Historikk knyttet til en avklaring',relay:'Stafett – separat'};
 const needsAttention=item=>!['unchanged','dns','unlinked','relay'].includes(item.category)&&!item.decision;
 const columns={event:2,distance:3,status:4,time:5,place:6,className:7,club:8,bib:9};
 const aliases={
  name:['navn','name','fullname','participant','participantname','deltaker','deltakernavn','personnavn','athletename','competitor'],
  firstName:['fornavn','firstname','givenname','given'],lastName:['etternavn','lastname','surname','familyname','family'],
  event:['ovelse','event','race','competition','course','lop','contest','stage'],distance:['distanse','distance','km','kilometer','length','distancekm','distansekm','distancem','meters','meter'],
  time:['tid','time','sluttid','finishtime','finish','resulttime','elapsedtime','elapsed','resultat','result','nettime','duration','totaltime'],
  status:['status','resultstatus','resultatstatus','sluttstatus','state'],place:['plass','place','rank','rankgender','position','plassering','kildeplassering','overallrank'],
  bib:['startnummer','startnumber','startnr','bib','bibnumber','startno','number'],athleteId:['athleteid','eqid','eqtimingid','utoverid','personid','participantid'],
  runnerId:['morothonid','morid','canonicalid'],year:['ar','year','eventyear','raceyear','arrangementsar','eventdate','lopsar'],
  className:['klasse','class','classname','category'],gender:['kjonn','gender','sex'],club:['klubb','club','team','organisation','organization']
 };
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),H=()=>initialRules||globalThis.MorothonHistoryData;
 const clean=v=>String(v??'').trim(),header=v=>I.fold(v).replace(/[^a-z0-9]/g,''),validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const courseCode=v=>clean(v).normalize('NFKC').replace(/\s+/g,' ');
 // Adapters produce this bounded header/cell table; field interpretation and
 // reconciliation do not depend on the exporting timing service.
 const adapters=[{id:'delimited-text-v1',format:'csv-results-v1',read:(text,options)=>I.parseCsv(text,options.delimiter)}];
 function parse(text,{delimiter,adapter='delimited-text-v1'}={}){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>I.MAX_BYTES)throw Error('Resultatfilen må være tekst på maksimalt 4 MB.');
  if(text.trimStart().startsWith('<'))throw Error('Resultatimport støtter CSV/TSV. XML og XLSX krever en egen importadapter.');
  const reader=adapters.find(a=>a.id===adapter);if(!reader)throw Error('Filformatet er ikke støttet ennå. Velg CSV eller TSV.');
  const table=reader.read(text,{delimiter}),staged={...table,kind:'result-staging',format:reader.format,adapter:reader.id};
  const detection=detectFields(staged);return {...staged,mapping:detection.mapping,detection};
 }
 const resultToken=value=>H().effectiveStatus([0,'','','',clean(value),'']);
 const hasResult=value=>H().timeSeconds(clean(value))!==null||['DNS','DNF','Disket','Fullført','Deltatt'].includes(resultToken(value));
 const notFinish=v=>/^(?:start|lap|gun)|birth|fod|split|runde|mellom|passering|clock|rank|plass|position|bib|nummer|^(?:athlete|runner|person)?id$/i.test(header(v));
 const representative=values=>values.map(clean).filter(Boolean).filter((_,i,a)=>i<3||i===a.length-1).slice(0,4);
 const resultRate=values=>{const a=values.map(clean).filter(Boolean);return a.length?a.filter(hasResult).length/a.length:0;};
 function distanceValue(value,unit){
  const text=clean(value);if(/-\s*\d/.test(text))return null;
  if([...text.matchAll(/\d+(?:[.,]\d+)?\s*(?:km|kilometers?|kilometres?|kilometer|meters?|metres?|m)\b/gi)].length>1)return null;
  const matches=[...text.matchAll(/(?:^|\s|\()(\d+(?:[.,]\d+)?)\s*(km|kilometers?|kilometres?|kilometer|m|meters?|metres?)(?=\s|$|[)·])/gi)];
  if(matches.length===1){const m=matches[0],km=Number(m[1].replace(',','.'))*(/^m/i.test(m[2])?.001:1);return km>0&&km<=1000?{km,label:km+' km',name:clean(text.replace(m[0],' ').replace(/[()·]/g,' ')).replace(/^[:–—-]+\s*|\s*[:–—-]+$/g,'')}:null;}
  if(matches.length)return null;
  if(unit&&/^\d+(?:[.,]\d+)?$/.test(text)){const km=Number(text.replace(',','.'))*(unit==='m'?.001:1);return km>0&&km<=1000?{km,label:km+' km',name:''}:null;}return null;
 }
 function detectFields(staged){
  const mapping=Object.fromEntries(Object.keys(fields).map(k=>[k,-1])),candidates={},evidence={};
  for(const key of Object.keys(fields)){
   candidates[key]=staged.headers.flatMap((v,index)=>aliases[key].includes(header(v))?[index]:[]);
   if(candidates[key].length===1){mapping[key]=candidates[key][0];evidence[key]='header';}
  }
  const occupied=new Set(Object.values(mapping).filter(i=>i>=0));
  // Content is corroboration. Unknown numeric/rank columns and clock/start-time
  // columns must never be promoted to finish results just because they contain numbers.
  if(!candidates.time.length&&!candidates.status.length){
   const inferred=staged.headers.flatMap((v,index)=>{
    if(occupied.has(index)||notFinish(v))return [];
    const values=staged.records.map(r=>clean(r.cells[index])).filter(Boolean);
    return values.length&&resultRate(values)>=.6?[index]:[];
   });
   candidates.time=inferred;if(inferred.length)evidence.time='suggested-content';
  }
  if(mapping.event<0&&mapping.distance<0){
   const inferred=staged.headers.flatMap((v,index)=>{if(occupied.has(index))return [];const values=staged.records.map(r=>clean(r.cells[index])).filter(Boolean);return values.length&&values.every(v=>distanceValue(v))?[index]:[];});
   if(inferred.length){candidates.distance=inferred;if(inferred.length===1){mapping.distance=inferred[0];evidence.distance='content';}}
  }
  return {mapping,candidates,evidence};
 }
 function annualCourses(context,year){
  const courses=[];
  for(const r of context.model.data.results)if(r[0]===year&&!H().isRelayRace(r)){
   const distance=distanceValue(r[3]);if(distance&&!courses.some(c=>c.event===r[2]&&c.distance===distance.label)){
    const names=[r[2],...(context.competitions.filter(c=>c.event===r[2]).map(c=>c.label.split(' · ')[0]))];
    courses.push({event:r[2],distance:distance.label,km:distance.km,names:[...new Set(names)],year});
   }
  }return courses;
 }
 function resolveFields(context,staged,year){
  const mapping={...detectFields(staged).mapping};if(mapping.event<0&&mapping.distance<0){const names=new Set([...annualCourses(context,year).flatMap(c=>c.names),...context.competitions.flatMap(c=>[c.event,c.label.split(' · ')[0]])].map(I.fold)),used=new Set(Object.values(mapping));const candidates=staged.headers.flatMap((h,index)=>{if(used.has(index)||notFinish(h))return [];const values=staged.records.map(r=>clean(r.cells[index])).filter(Boolean);return values.length&&values.filter(v=>names.has(I.fold(v))).length/values.length>=.9?[index]:[];});if(candidates.length===1)mapping.event=candidates[0];}
  return mapping;
 }
 function inspect(context,staged,year,{mapping=staged.mapping,profileChoices={},manual=false,confirmedFields=[],fixedCourse=null,nameMode='auto'}={}){
  if(staged.kind!=='result-staging'||staged.format!=='csv-results-v1')throw Error('Velg en CSV/TSV-resultatfil, ikke en startliste.');
  if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Velg et gyldig arrangementsår.');
  for(const key of Object.keys(fields))if(!Number.isInteger(mapping[key])||mapping[key]<-1||mapping[key]>=staged.headers.length)throw Error('Ugyldig kolonnekobling: '+fields[key]);
  const used=Object.values(mapping).filter(i=>i>=0);if(new Set(used).size!==used.length)throw Error('Samme kolonne kan ikke brukes til flere resultatfelt.');
  const detection=detectFields(staged),issues=[],choices=[],groups=new Map(),courses=annualCourses(context,year);
  if(fixedCourse&&!courses.some(c=>c.year===fixedCourse.year&&c.year===year&&c.event===fixedCourse.event&&c.distance===fixedCourse.distance))throw Error('Den valgte øvelsen mangler dokumentert løypelengde for dette året.');
  const options=key=>staged.headers.flatMap((label,index)=>!used.includes(index)&&(!['time','status'].includes(key)||!notFinish(label))?[{value:String(index),label,example:representative(staged.records.map(r=>r.cells[index])).map(s=>s.slice(0,45)).join(' · ')}]:[]).sort((a,b)=>['time','status'].includes(key)?resultRate(staged.records.map(r=>r.cells[+b.value]))-resultRate(staged.records.map(r=>r.cells[+a.value])):0);
  const ask=(key,label)=>{if(choices.some(c=>c.key===key))return;choices.push({key,label,options:options(key)});};
  for(const key of Object.keys(fields))if(!manual&&!confirmedFields.includes(key)&&mapping[key]<0&&(detection.candidates[key].length>1||detection.evidence[key]==='suggested-content'))choices.push({key,label:'Hvilken kolonne inneholder '+fields[key].toLowerCase()+'?',options:detection.candidates[key].map(index=>({value:String(index),label:staged.headers[index],example:representative(staged.records.map(r=>r.cells[index])).map(s=>s.slice(0,45)).join(' · ')}))});
  if(mapping.name<0&&(mapping.firstName<0||mapping.lastName<0)){
   issues.push('Vi finner ikke deltakernavn. Velg navnefeltet nedenfor.');
   if(nameMode==='split'||nameMode==='auto'&&(mapping.firstName>=0||mapping.lastName>=0)){if(mapping.firstName<0)ask('firstName','Hvilket felt inneholder fornavnet?');if(mapping.lastName<0)ask('lastName','Hvilket felt inneholder etternavnet?');}
   else ask('name','Hvilket felt inneholder hele deltakernavnet?');
  }
  if(mapping.time<0&&mapping.status<0){issues.push('Vi finner ikke sluttid eller gyldig resultatstatus. Velg resultatfeltet nedenfor. En startliste uten resultat kan ikke brukes.');ask('time','Vi fant ikke sluttid. Hvilket felt inneholder resultatet?');}
  for(const key of ['time','status'])if(mapping[key]>=0&&notFinish(staged.headers[mapping[key]])){issues.push('Feltet ser ut som starttid, passering eller plassering. Det brukes ikke som sluttresultat.');choices.push({key,label:'Hvilket felt inneholder sluttresultatet?',options:options(key)});}
  if(mapping.event<0&&mapping.distance<0&&!fixedCourse){issues.push('Vi finner ikke øvelse. Velg feltet eller en felles øvelse nedenfor.');ask('event','Hvilket felt inneholder øvelsen?');}
  const group=(id,label,options)=>{if(!groups.has(id))groups.set(id,{id,label,options});const value=profileChoices[id];return options.some(o=>o.value===value)?value:null;};
  const canonical=Object.keys(fields),normalized=[],details=[],knownEvents=new Set([...context.model.data.results.map(r=>r[2]),...context.competitions.flatMap(c=>[c.event,c.label.split(' · ')[0]])].map(I.fold));
  const unknownEvents=new Set(mapping.event<0?[]:staged.records.map(r=>clean(r.cells[mapping.event])).filter(v=>v&&!knownEvents.has(I.fold(v))));
  for(const record of staged.records){
   const values=Object.fromEntries(canonical.map(k=>[k,mapping[k]<0?'':clean(record.cells[mapping[k]])])),present=Object.fromEntries(canonical.map(k=>[k,mapping[k]>=0])),errors=[],evidence=[];
   for(const [key,value]of Object.entries(values))if(value.length>200||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))errors.push('Ugyldig eller for langt felt: '+fields[key]);
   let rawEvent=values.event,rawDistance=values.distance,relay=/stafett|relay/i.test(rawEvent+' '+values.className),explicit=rawDistance?distanceValue(rawDistance):distanceValue(rawEvent);
   if(fixedCourse){if(rawEvent&&I.fold(rawEvent)!==I.fold(fixedCourse.event))errors.push('Øvelsesfeltet og valgt felles øvelse er motstridende.');rawEvent=fixedCourse.event;if(!rawDistance){rawDistance=fixedCourse.distance;explicit=distanceValue(rawDistance);}else if(explicit&&explicit.label!==fixedCourse.distance)errors.push('Kildens løypelengde stemmer ikke med den valgte øvelsen.');evidence.push({kind:'confirmed-fixed-course',...fixedCourse});}
   if(!explicit&&rawDistance&&/^\d+(?:[.,]\d+)?$/.test(rawDistance)){
    const h=header(staged.headers[mapping.distance]),unit=['km','kilometer','distancekm','distansekm'].includes(h)?'km':['distancem','meters','meter'].includes(h)?'m':group('unit-'+mapping.distance,'Hvilken enhet bruker distansekolonnen?', [{value:'km',label:'Kilometer'},{value:'m',label:'Meter'}]);
    explicit=distanceValue(rawDistance,unit);if(unit)evidence.push({kind:'distance-unit',unit,column:mapping.distance,confirmed:!['km','kilometer','distancekm','distansekm','distancem','meters','meter'].includes(h)});
   }
   const combinedEvent=distanceValue(rawEvent),combinedDistance=distanceValue(rawDistance),knownUntimed=rawDistance==='Ukjent'&&resultToken(values.status||values.time)==='Deltatt';
   if(rawDistance&&!explicit&&!knownUntimed&&!/^\d+(?:[.,]\d+)?$/.test(rawDistance))errors.push('Løypelengden i kilden kan ikke tolkes sikkert. Kontroller øvelsen og kilden.');
   if(rawEvent&&combinedEvent?.name)rawEvent=combinedEvent.name;
   if(!rawEvent&&combinedDistance?.name)rawEvent=combinedDistance.name;
   if(rawEvent&&combinedEvent&&!combinedEvent.name)rawEvent='';
   const aliases=context.competitions.filter(c=>I.fold(c.label.split(' · ')[0])===I.fold(rawEvent)).map(c=>c.event),eventNames=[...new Set(aliases)];
   if(eventNames.length===1)rawEvent=eventNames[0];
   let available=courses.filter(c=>rawEvent?c.names.some(n=>I.fold(n)===I.fold(rawEvent)):explicit&&c.km===explicit.km);
   if(!relay&&rawEvent&&!/\d+\s*(?:km|m)\b/i.test(rawEvent)&&!knownEvents.has(I.fold(rawEvent))&&courses.length&&unknownEvents.size<=30){
    const sourceField=values.event?'event':'distance',sourceValue=values[sourceField]||rawEvent,options=courses.filter(c=>!explicit||c.km===explicit.km).map(c=>({value:JSON.stringify([c.event,c.distance]),label:c.event+' · '+c.distance+' · '+year}));
    if(options.length){const id='alias-'+sourceField+'-'+encodeURIComponent(courseCode(sourceValue)),selected=group(id,'Hvilken øvelse betyr «'+rawEvent.slice(0,60)+'»?',options);
     if(selected){const [event,distance]=JSON.parse(selected);rawEvent=event;if(!explicit)explicit=distanceValue(distance);available=courses.filter(c=>c.event===event&&c.distance===distance);evidence.push({kind:'confirmed-event-alias',year,event,distance,sourceValue,sourceField});}
     else errors.push('Øvelseskoden er ikke avklart.');
    }
   }
   if(!relay&&rawDistance&&distanceValue(rawDistance)&&distanceValue(values.event)&&distanceValue(rawDistance).km!==distanceValue(values.event).km)errors.push('Øvelse og distanse angir ulike løypelengder. Kontroller kilden.');
   if(!rawEvent&&explicit&&available.length===1){rawEvent=available[0].event;evidence.push({kind:'year-course',year,event:rawEvent,distance:explicit.label,confirmed:false});}
   else if(!rawEvent&&explicit&&available.length>1){const id='event-'+explicit.label,selected=group(id,'Flere øvelser er '+explicit.label+' i '+year+'. Hvilken gjelder denne kolonnen?',available.map(c=>({value:c.event,label:c.event+' · '+c.distance})));if(selected){rawEvent=selected;evidence.push({kind:'confirmed-year-event',year,event:rawEvent,distance:explicit.label});}}
   if(!explicit&&!rawDistance&&!relay&&rawEvent&&available.length){
    const id='course-'+I.fold(rawEvent),selected=group(id,'Filen mangler distanse for '+rawEvent+'. Bekreft løypelengden i '+year+'.',available.map(c=>({value:c.distance,label:c.event+' · '+c.distance+' · godkjent historikk '+year})));
    if(selected){explicit=distanceValue(selected);evidence.push({kind:'confirmed-year-distance',year,event:rawEvent,distance:selected});}
   }
   if(explicit){values.distance=explicit.label;present.distance=true;}else if(!relay&&!knownUntimed)errors.push('Eksakt distanse mangler. Ingen sikker løypelengde er dokumentert for denne raden i '+year+'.');
   values.event=rawEvent;present.event=!!rawEvent;if(!rawEvent)errors.push('Øvelse kan ikke bestemmes entydig.');
   // Keep the original header presence mask: absent optional metadata must not
   // overwrite historical values just because normalization uses a fixed table.
   normalized.push({line:record.line,cells:canonical.map(k=>values[k])});details.push({present,errors,evidence,width:record.cells.length!==staged.headers.length});
  }
  const unresolved=[...groups.values()].filter(g=>!g.options.some(o=>o.value===profileChoices[g.id]));
  const structuralReady=!issues.length&&!choices.length;
  let rows=[];if(structuralReady){rows=validateRows(context,{...staged,headers:canonical,records:normalized},Object.fromEntries(canonical.map((k,i)=>[k,i])),year).map((r,i)=>({...r,present:details[i].present,inference:details[i].evidence,errors:[...r.errors,...details[i].errors,...(details[i].width?['Antall felt stemmer ikke med kolonnene.']:[])]}));}
  const ready=structuralReady&&(!unresolved.length||rows.some(r=>!r.errors.length&&!r.relay));
  const sourceYears=mapping.year<0?[]:[...new Set(staged.records.map(r=>I.yearValue(r.cells[mapping.year])))];
  return {ready,mapping,issues,choices,groups:unresolved,allGroups:[...groups.values()],rows,suggestedYear:sourceYears.length===1&&sourceYears[0]>=1900?sourceYears[0]:null,stages:{format:true,interpreted:ready&&rows.every(r=>!r.errors.length),paired:false,reviewed:false}};
 }
 // Versioned layout configuration. No rows, filenames, file hashes, examples or
 // free-form labels are serializable. Header digests allow unknown headings
 // without storing their literal text; course rules refer to public year profiles.
 const layoutRegistry=Object.freeze({version:1,providers:['generic','eqtiming'],builtins:[{id:'csv-results-v1',provider:'generic',headers:['Navn','Startnummer','Øvelse','Distanse','Status','Tid','Plass','Klasse','Klubb','År']}]});
 const LAYOUT_FORMAT='morothon-import-layouts-v1',LAYOUT_BYTES=128*1024;
 const layoutBody=t=>({version:t.version,organizer:t.organizer,provider:t.provider,columns:t.columns,mapping:Object.fromEntries(Object.keys(fields).map(k=>[k,t.mapping[k]])),rules:{result:t.rules.result,distanceUnit:t.rules.distanceUnit,courses:t.rules.courses}});
 function layoutKeys(v,names){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join('|')!==names.slice().sort().join('|'))throw Error('Filoppsettet inneholder ukjente eller manglende felt.');}
 const emptyLayouts=()=>({format:LAYOUT_FORMAT,version:1,templates:[]});
 async function validateLayouts(store){
  layoutKeys(store,['format','version','templates']);if(store.format!==LAYOUT_FORMAT||store.version!==1||!Array.isArray(store.templates)||store.templates.length>32)throw Error('Ukjent filoppsettversjon eller for mange maler.');
  for(const t of store.templates){
   layoutKeys(t,['version','organizer','provider','columns','mapping','rules','checksum']);
   if(t.version!==1||typeof t.organizer!=='string'||!/^[a-z0-9-]{1,64}$/.test(t.organizer)||!layoutRegistry.providers.includes(t.provider)||!Array.isArray(t.columns)||t.columns.length<2||t.columns.length>80||t.columns.some(c=>!validHash(c)))throw Error('Ugyldig struktur i filoppsettet.');
   layoutKeys(t.mapping,Object.keys(fields));const used=Object.values(t.mapping).filter(v=>v>=0);if(Object.values(t.mapping).some(v=>!Number.isInteger(v)||v< -1||v>=t.columns.length)||new Set(used).size!==used.length)throw Error('Ugyldige feltvalg i filoppsettet.');
   layoutKeys(t.rules,['result','distanceUnit','courses']);if(t.rules.result!=='history-duration-status-v1'||![null,'km','m'].includes(t.rules.distanceUnit)||!Array.isArray(t.rules.courses)||t.rules.courses.length>30)throw Error('Ukjente tolkningsregler i filoppsettet.');
   const seen=new Set();for(const c of t.rules.courses){layoutKeys(c,['year','event','distance','kind',...(c.kind==='alias'?['sourceCodeSha256','field']:[])]);const key=JSON.stringify([c.kind,c.year,c.kind==='fixed'?'all':c.kind==='named'?c.event:c.kind==='alias'?[c.field,c.sourceCodeSha256]:c.distance]);if(!Number.isInteger(c.year)||c.year<1900||c.year>9999||typeof c.event!=='string'||!c.event||c.event.length>100||/[<>\u0000-\u001f]/.test(c.event)||!distanceValue(c.distance)||distanceValue(c.distance).label!==c.distance||!['named','by-distance','fixed','alias'].includes(c.kind)||c.kind==='alias'&&(!validHash(c.sourceCodeSha256)||!['event','distance'].includes(c.field))||seen.has(key))throw Error('Ugyldig eller tvetydig øvelsesregel.');seen.add(key);}
   if(t.mapping.name<0&&(t.mapping.firstName<0||t.mapping.lastName<0)||t.mapping.time<0&&t.mapping.status<0||t.mapping.event<0&&t.mapping.distance<0&&!t.rules.courses.some(c=>c.kind==='fixed'))throw Error('Filoppsettet mangler nødvendige feltvalg.');
   if(!validHash(t.checksum)||t.checksum!==await C.hash(layoutBody(t)))throw Error('Kontrollsummen for filoppsettet stemmer ikke.');
  }
  const text=JSON.stringify(store);if(new TextEncoder().encode(text).length>LAYOUT_BYTES)throw Error('Filoppsettene overskrider 128 KB.');return clone(store);
 }
 async function parseLayouts(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LAYOUT_BYTES)throw Error('Velg en filoppsettfil på maksimalt 128 KB.');let store;try{store=JSON.parse(text);}catch{throw Error('Filoppsettet er ikke gyldig JSON.');}return validateLayouts(store);}
 async function layoutColumns(staged){return Promise.all(staged.headers.map(h=>C.hash(String(h).normalize('NFKC').trim().toLocaleLowerCase('nb-NO').replace(/\s+/g,' '))));}
 function verifyCourses(context,template){for(const c of template.rules.courses)if(!annualCourses(context,c.year).some(x=>x.event===c.event&&x.distance===c.distance))throw Error('Øvelsesregelen mangler dokumentert årsprofil. Ingen løypelengde gjettes.');}
 async function captureLayout(context,staged,mapping,{year,profileChoices={},fixedCourse=null,provider='generic',manual=false,confirmedFields=[],nameMode='auto'}={}){
  if(staged.headers.some(h=>hasResult(h)||/^\d+$/.test(clean(h))||/^MOR-|@/.test(clean(h))||distanceValue(h)||h.length>=100))throw Error('Første linje ser ut som resultatdata eller har for lange overskrifter. Filoppsett kan bare huskes for filer med entydige kolonneoverskrifter.');
  const inspection=inspect(context,staged,year,{mapping,profileChoices,fixedCourse,manual,confirmedFields,nameMode});if(!inspection.ready||!inspection.rows.some(r=>!r.errors.length&&!r.relay))throw Error('Avklar feltene og minst én gyldig resultatlinje før oppsettet kan huskes.');
  const courses=[],all=annualCourses(context,year);let distanceUnit=null;
  for(const [key,value]of Object.entries(profileChoices)){
   if(key==='unit-'+mapping.distance&&['km','m'].includes(value))distanceUnit=value;
   else for(const c of all)if(key==='course-'+I.fold(c.event)&&value===c.distance)courses.push({year,event:c.event,distance:c.distance,kind:'named'});else if(key==='event-'+c.distance&&value===c.event)courses.push({year,event:c.event,distance:c.distance,kind:'by-distance'});
  }
  if(fixedCourse)courses.push({...fixedCourse,kind:'fixed'});
  const personal=new Set([...context.people.values()].flatMap(p=>p.names.map(n=>I.fold(n.name))));for(const r of staged.records)for(const k of ['name','firstName','lastName'])if(mapping[k]>=0)personal.add(I.fold(r.cells[mapping[k]]));
  const originalRoles=detectFields(staged).mapping;
  for(const row of inspection.rows.filter(r=>!r.errors.length))for(const e of row.inference.filter(e=>e.kind==='confirmed-event-alias')){if(personal.has(I.fold(e.sourceValue))||hasResult(e.sourceValue)||['name','firstName','lastName','bib','athleteId','runnerId','time','status'].some(k=>originalRoles[k]>=0&&originalRoles[k]===mapping[e.sourceField]))throw Error('Øvelsesfeltet ser ut til å inneholde person- eller resultatdata. Kontroller feltvalget før malen lagres.');const sourceCodeSha256=await C.hash(courseCode(e.sourceValue));if(!courses.some(c=>c.kind==='alias'&&c.sourceCodeSha256===sourceCodeSha256))courses.push({year:e.year,event:e.event,distance:e.distance,kind:'alias',field:e.sourceField,sourceCodeSha256});}
  courses.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const template={version:1,organizer:context.profileId,provider,columns:await layoutColumns(staged),mapping:clone(mapping),rules:{result:'history-duration-status-v1',distanceUnit,courses}};template.checksum=await C.hash(layoutBody(template));await validateLayouts({...emptyLayouts(),templates:[template]});verifyCourses(context,template);return template;
 }
 async function rememberLayout(context,store,template){
  await validateLayouts(store);await validateLayouts({...emptyLayouts(),templates:[template]});if(template.organizer!==context.profileId)throw Error('Filoppsettet gjelder en annen arrangør.');verifyCourses(context,template);
  const shape=t=>new Set(t.columns).size===t.columns.length?JSON.stringify([...t.columns].sort()):JSON.stringify(t.columns),next=clone(store),previous=next.templates.find(t=>t.organizer===template.organizer&&t.provider===template.provider&&shape(t)===shape(template)),updated=clone(template);
  const semantic=t=>new Set(t.columns).size<t.columns.length?t.mapping:Object.fromEntries(Object.entries(t.mapping).map(([k,i])=>[k,i<0?-1:t.columns[i]]));if(previous&&same(semantic(previous),semantic(template))){const years=new Set(template.rules.courses.map(c=>c.year));updated.rules.courses=[...previous.rules.courses.filter(c=>!years.has(c.year)),...template.rules.courses];updated.checksum=await C.hash(layoutBody(updated));}
  next.templates=next.templates.filter(t=>t!==previous);next.templates.push(updated);return validateLayouts(next);
 }
 async function matchLayouts(context,staged,store,year){
  await validateLayouts(store);if(staged.headers.some(h=>h.length>=100))return [];const columns=await layoutColumns(staged),matches=[];
  const bundled=await Promise.all(layoutRegistry.builtins.map(async b=>{const table={...staged,headers:b.headers},mapping=detectFields(table).mapping,t={version:1,organizer:context.profileId,provider:b.provider,columns:await layoutColumns(table),mapping,rules:{result:'history-duration-status-v1',distanceUnit:null,courses:[]}};t.checksum=await C.hash(layoutBody(t));return t;}));
  const candidates=[...store.templates.map(t=>({template:t,origin:'device'})),...bundled.map(t=>({template:t,origin:'bundled'}))];
  for(const {template:t,origin}of candidates){
   if(origin==='bundled'&&matches.some(m=>m.origin==='device'))continue;
   if(t.organizer!==context.profileId||t.columns.length!==columns.length)continue;let order;
   if(same(columns,t.columns))order=t.columns.map((_,i)=>i);
   else if(new Set(columns).size===columns.length&&new Set(t.columns).size===t.columns.length&&same([...columns].sort(),[...t.columns].sort()))order=t.columns.map(h=>columns.indexOf(h));else continue;
   const mapping=Object.fromEntries(Object.entries(t.mapping).map(([k,i])=>[k,i<0?-1:order[i]]));
   if(['time','status'].some(k=>mapping[k]>=0&&notFinish(staged.headers[mapping[k]]))||mapping.time>=0&&resultRate(staged.records.map(r=>r.cells[mapping.time]))<.6&&mapping.status<0)continue;
   const names=staged.records.map(r=>mapping.name>=0?r.cells[mapping.name]:[r.cells[mapping.firstName],r.cells[mapping.lastName]].join(' ')).filter(Boolean);if(!names.length||names.filter(n=>/[\p{L}]/u.test(n)).length/names.length<.8)continue;
   const profileChoices={},courses=t.rules.courses.filter(c=>c.year===year&&annualCourses(context,year).some(a=>a.event===c.event&&a.distance===c.distance));let fixedCourse=null;
   for(const c of courses)if(c.kind==='named')profileChoices['course-'+I.fold(c.event)]=c.distance;else if(c.kind==='by-distance')profileChoices['event-'+c.distance]=c.event;else if(c.kind==='alias'){if(mapping[c.field]>=0)for(const raw of new Set(staged.records.map(r=>clean(r.cells[mapping[c.field]])))){if(await C.hash(courseCode(raw))===c.sourceCodeSha256)profileChoices['alias-'+c.field+'-'+encodeURIComponent(courseCode(raw))]=JSON.stringify([c.event,c.distance]);}}else fixedCourse={year,event:c.event,distance:c.distance};
   if(t.rules.distanceUnit&&mapping.distance>=0)profileChoices['unit-'+mapping.distance]=t.rules.distanceUnit;
   const match={template:t,origin,mapping,profileChoices,fixedCourse};if(!matches.some(m=>same({mapping:m.mapping,profileChoices:m.profileChoices,fixedCourse:m.fixedCourse},{mapping,profileChoices,fixedCourse})))matches.push(match);
  }return matches;
 }
 const layouts={registry:layoutRegistry,MAX_BYTES:LAYOUT_BYTES,empty:emptyLayouts,validate:validateLayouts,parse:parseLayouts,capture:captureLayout,remember:rememberLayout,match:matchLayouts};
 function importedRows(context,staged,mapping,year,options={}){
  const result=inspect(context,staged,year,{...options,mapping});if(!result.ready)throw Error([...result.issues,...result.choices.map(c=>c.label),...result.groups.map(g=>g.label)].join(' '));return result.rows;
 }
 function validateRows(context,staged,mapping,year){
  if(staged.kind!=='result-staging'||staged.format!=='csv-results-v1')throw Error('Velg Endelige resultater. En startliste kan ikke brukes som resultatgrunnlag.');
  if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Velg et gyldig arrangementsår.');
  for(const key of Object.keys(fields))if(!Number.isInteger(mapping[key])||mapping[key]<-1||mapping[key]>=staged.headers.length)throw Error('Ugyldig kolonnekobling: '+fields[key]);
  const used=Object.values(mapping).filter(i=>i>=0);if(new Set(used).size!==used.length)throw Error('Samme kolonne kan ikke brukes til flere resultatfelt.');
  if(mapping.name<0&&(mapping.firstName<0||mapping.lastName<0))throw Error('Koble Navn, eller både Fornavn og Etternavn.');
  if(mapping.event<0||mapping.distance<0)throw Error('Koble både øvelse og eksakt distanse.');
  if(mapping.time<0&&mapping.status<0)throw Error('Filen mangler sluttid og resultatstatus. Ikke bruk en startliste som resultatliste.');
  const rules=H(),token=v=>rules.effectiveStatus([year,'','','',v,'']),events=new Set([...context.model.data.results.map(r=>r[2]),...context.competitions.map(c=>c.event)]);
  return staged.records.map((record,i)=>{
   const r={id:'result-'+(i+1),line:record.line,year,present:{},errors:[],warnings:[]};
   for(const key of Object.keys(fields)){r[key]=mapping[key]<0?'':clean(record.cells[mapping[key]]);r.present[key]=mapping[key]>=0;if(r[key].length>200||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(r[key]))r.errors.push('Ugyldig eller for langt felt: '+fields[key]);}
   r.name=r.name||[r.firstName,r.lastName].filter(Boolean).join(' ');if(!r.name||r.name.length>200||!/[\p{L}]/u.test(r.name))r.errors.push('Navn mangler eller er for langt.');
   if(record.cells.length!==staged.headers.length)r.errors.push('Antall felt stemmer ikke med kolonnene.');
   const fileYear=r.year; // r.year still contains the mapped source string here.
   if(fileYear&&I.yearValue(fileYear)!==year)r.errors.push('Filens år stemmer ikke med valgt arrangementsår.');r.year=year;
   for(const key of ['athleteId','runnerId'])if(r[key]&&!/^[A-Za-z0-9_.:-]{1,128}$/.test(r[key]))r.errors.push('Ugyldig identifikator: '+fields[key]);
   const gender=I.fold(r.gender);r.gender=['m','mann','male','herre','herrer'].includes(gender)?'Herre':['k','f','kvinne','kvinner','female','dame','damer'].includes(gender)?'Dame':'';if(gender&&!r.gender)r.warnings.push('Ukjent kjønnstoken brukes ikke til identitetskontroll.');
   const rawStatus=r.status,timeStatus=token(r.time),seconds=rules.timeSeconds(r.time);
   if(!rawStatus)r.status=seconds!==null?'Fullført':['DNS','DNF','Disket','Fullført','Deltatt'].includes(timeStatus)?timeStatus:'';
   else r.status=token(rawStatus);
   if(!['Fullført','Deltatt','DNS','DNF','Disket'].includes(r.status))r.errors.push('Sluttstatus mangler eller er ikke en gyldig resultatstatus. Dette kan være en startliste.');
   if(r.time&&seconds===null&&!['DNS','DNF','Disket','Fullført','Deltatt'].includes(timeStatus)&&!(r.status==='DNS'&&/^0{1,2}:00(?::00)?$/.test(r.time)))r.errors.push('Ugyldig sluttid. Bruk mm:ss eller hh:mm:ss.');
   if(['DNS','DNF','Disket'].includes(r.status)&&['DNS','DNF','Disket'].includes(timeStatus)&&r.status!==timeStatus)r.errors.push('Motstridende sluttstatuser.');
   if(r.status==='DNF'&&seconds!==null){r.sourceTime=r.time;r.time='DNF';r.warnings.push('DNF har ingen sluttid. Kildens tidsfelt er bevart i kontrollrapporten og brukes ikke som fullføring.');}
   r.relay=/stafett|relay/i.test(r.event+' '+r.className);const km=rules.parseDistanceKm(r.distance);
   if(!r.relay&&(!/^\d+(?:[.,]\d+)?\s*km$/i.test(r.distance)||!km||km>1000)&&!(r.distance==='Ukjent'&&r.status==='Deltatt'))r.errors.push('Eksakt positiv distanse i km mangler. Ikke gjett distansen.');
   if(!r.event)r.errors.push('Øvelse mangler.');
   if(!events.has(r.event)){const aliases=context.competitions.filter(c=>I.fold(c.label.split(' · ')[0])===I.fold(r.event));const names=[...new Set(aliases.map(c=>c.event))],race=context.race(r.event);if(names.length===1)r.event=names[0];else if(race&&!race.relay&&race.km===km)r.event=race.event;else r.warnings.push('Øvelsesnavnet er ikke kjent i arrangementsprofilen. Kontroller råverdien og konsekvensene før overlevering.');}
   if(r.place&&!/^[1-9]\d{0,5}$/.test(r.place)&&!['DNS','DNF','Disket','DQ'].includes(r.place))r.errors.push('Ugyldig kildeplassering.');
   r.place=/^[1-9]\d*$/.test(r.place)?Number(r.place):r.place||'';
   return r;
  });
 }
 function semantics(r){return {status:H().effectiveStatus(r),time:H().isCompletedResult(r)?H().timeSeconds(r[5]):null};}
 function sameDistance(a,b){const x=distanceValue(a),y=distanceValue(b);return x&&y?x.km===y.km:clean(a)===clean(b);}
 function afterRow(row,personId,before,redirects={}){
  const out=before?[...before]:[row.year,personId,row.event,row.distance,row.status,row.time,row.place,row.className,row.club,row.bib];
  out[0]=row.year;out[1]=before&&H().resolveId(before[1],redirects)===personId?before[1]:personId;
  for(const [key,index]of Object.entries(columns))if(row.present[key])out[index]=row[key];
  if(!row.present.status)out[4]=row.status;
  if(before){const a=semantics(before),b=semantics(out);if(a.status===b.status){out[4]=before[4];if(a.time===b.time)out[5]=before[5];}}
  if(before&&sameDistance(before[3],out[3]))out[3]=before[3];
  // Missing columns preserve the source. Effective status/time comparisons below
  // avoid rewriting equivalent DNF or untimed historical representations.
  return out;
 }
 function differences(before,after){
  const a=semantics(before),b=semantics(after),diff=[];
  for(const [key,index]of Object.entries(columns)){
   const equal=key==='status'?a.status===b.status:key==='time'?a.time===b.time:key==='place'?(before[index]??'')===(after[index]??''):clean(before[index])===clean(after[index]);
   if(!equal)diff.push({field:key,label:fields[key],before:before[index]??'',after:after[index]??''});
  }
  if(before[1]!==after[1])diff.unshift({field:'runnerId',label:'Registrert person',before:before[1],after:after[1]});return diff;
 }
 function nameSignal(context,name,id){const p=context.people.get(id);if(!p)return null;return p.names.map(n=>C.compareNames(name,n.name)).filter(Boolean).sort((a,b)=>({strong:0,moderate:1,weak:2}[a.strength]-{strong:0,moderate:1,weak:2}[b.strength]))[0]||null;}
 const candidateCache=new WeakMap();
 function candidates(context,row){if(!candidateCache.has(context))candidateCache.set(context,new Map());const cache=candidateCache.get(context);if(!cache.has(row.name))cache.set(row.name,[...context.people.values()].flatMap(p=>{const signal=nameSignal(context,row.name,p.id);return signal?[{id:p.id,name:p.name,reason:signal.reason,strength:signal.strength}]:[];}).sort((a,b)=>({strong:0,moderate:1,weak:2}[a.strength]-{strong:0,moderate:1,weak:2}[b.strength])||a.name.localeCompare(b.name,'nb-NO')));return cache.get(row.name);}
 async function createSession(context,staged,mapping,{year,sourceSha256,sourceScope='delimited-results-v1',meta,completeClaim=false,profileChoices={},manual=false,fixedCourse=null,confirmedFields=[],nameMode='auto'}={}){
  if(!validHash(sourceSha256)||typeof sourceScope!=='string'||!sourceScope.trim()||sourceScope.length>100||/[<>\u0000-\u001f]/.test(sourceScope))throw Error('Resultatimporten mangler gyldig kildehash eller kildeområde.');
  const rows=importedRows(context,staged,mapping,year,{profileChoices,manual,fixedCourse,confirmedFields,nameMode}),base=await C.binding(context.model.data,meta),session={format:'morothon-result-session-v1',version:1,base,source:{sha256:sourceSha256,scope:sourceScope,format:staged.format,year,completeClaim:completeClaim===true},mapping:clone(mapping),rows,createdAt:new Date().toISOString()};
  session.key=await C.hash({base,source:session.source,mapping:session.mapping,rows});return session;
 }
 async function validateSession(context,session){
  if(session.format!=='morothon-result-session-v1'||session.version!==1||!same(session.base,await C.binding(context.model.data,session.base))||session.key!==await C.hash({base:session.base,source:session.source,mapping:session.mapping,rows:session.rows}))throw Error('Importgrunnlaget er endret. Last inn filen og vurder avvikene på nytt.');
 }
 function review(context,session,decisions=new Map()){
  const H=context.rules,year=session.source.year,history=context.model.data,old=history.results.flatMap((r,index)=>r[0]===year&&!H.isRelayRace(r)?[{index,row:r,id:context.model.resolve(r[1])}]:[]),items=[];
  for(const d of decisions.values())if(d.basis!==session.key||!['confirm','new','reject','defer'].includes(d.action)||typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>1000||/[<>\u0000-\u001f]/.test(d.reason)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(d.at)||!Number.isFinite(Date.parse(d.at)))throw Error('Registrer en gyldig beslutning og begrunnelse for gjeldende kildefil.');
  const duplicateBibs=new Set(),duplicateIds=new Set();
  for(const key of ['bib','athleteId']){const groups=new Map();for(const r of session.rows.filter(r=>!r.relay&&r[key])){if(!groups.has(r[key]))groups.set(r[key],[]);groups.get(r[key]).push(r);}for(const group of groups.values())if(group.length>1&&(key==='bib'&&new Set(group.map(r=>r.event+'|'+r.distance)).size<group.length||group.some((r,i)=>i&&C.compareNames(group[0].name,r.name)===null)))for(const r of group)(key==='bib'?duplicateBibs:duplicateIds).add(r.id);}
  for(const row of session.rows){
   const item={id:row.id,row,category:'uncertain',reason:'Navn alene bekrefter ikke identitet. Kontroller personen og resultatregistreringen.',candidates:[],beforeIndex:null,before:null,after:null,differences:[],decision:null,blocking:false,newType:null,relatedIndices:[],conflictType:null};
   const decision=decisions.get(row.id);if(decision&&decision.basis!==session.key)throw Error('Avgjørelsen gjelder en annen fil eller tolkning. Vurder på nytt.');
   if(row.relay){if(decision)throw Error('Stafett må behandles separat, ikke som individuell retting.');item.category='relay';item.reason='Stafett holdes separat. Ingen individuell deltakelse, personkobling eller automatisk lagretting opprettes.';items.push(item);continue;}
   const bibRows=row.bib?old.filter(x=>clean(x.row[9])===row.bib):[],local=new Map();
   // A supported bib/year pair is a result lookup, not a global identity link.
   // Most complete annual exports can use this small index instead of comparing
   // every row with the entire historical person register again.
   for(const x of bibRows){const signal=nameSignal(context,row.name,x.id),person=context.people.get(x.id);if(signal&&person)local.set(x.id,{id:x.id,name:person.name,reason:signal.reason,strength:signal.strength});}
   item.candidates=local.size?[...local.values()]:candidates(context,row);
   const strong=item.candidates.filter(p=>p.strength==='strong');
   let ids=(strong.length?strong:item.candidates).map(p=>p.id),explicit=null,invalidExplicit=false;try{explicit=row.runnerId?context.model.resolve(row.runnerId):null;}catch{invalidExplicit=true;}const external=context.externalRunner?.(session.source.scope,row.athleteId);
   if(row.errors.length||invalidExplicit||duplicateBibs.has(row.id)||duplicateIds.has(row.id)||explicit&&external&&explicit!==external||explicit&&(!context.people.has(explicit)||!nameSignal(context,row.name,explicit))||external&&!nameSignal(context,row.name,external)){
    item.category=row.errors.length?'unassessable':'conflict';item.blocking=true;item.reason=row.errors.join(' ')||'Motstridende startnummer, identifikator eller navn. Rett kilde/mapping før et forslag klargjøres.';
   }else{
    if(explicit||external)ids=[explicit||external];
    const supported=bibRows.filter(x=>ids.includes(x.id)),narrow=list=>list.length>1?list.filter(x=>x.row[2]===row.event&&sameDistance(x.row[3],row.distance)):list;
    let paired=narrow(supported),why='Samme arrangementsår og startnummer, med støttende navn eller godkjent alias. Kun et resultatpar, ingen permanent identitetsbekreftelse.';
    if(bibRows.length&&!supported.length){item.category='conflict';item.blocking=true;item.reason='Startnummeret tilhører et annet registrert navn. Startnummer kan ikke overstyre identitetskonflikten.';}
    else{
     if(!paired.length&&ids.length===1&&(explicit||external||item.candidates.find(p=>p.id===ids[0])?.strength==='strong')){paired=narrow(old.filter(x=>x.id===ids[0]&&x.row[2]===row.event&&sameDistance(x.row[3],row.distance)));why='Entydig fullt navn/alias og samme år, øvelse og distanse støtter resultatparet. Endringer krever din uttrykkelige bekreftelse.';}
     // A documented person ID plus a compatible name and one historical start
     // can identify the result even when its exercise/distance was corrected.
     if(!paired.length&&(explicit||external)&&ids.length===1&&H.effectiveStatus([year,'','','',row.status,row.time])!=='DNS'){const starts=old.filter(x=>x.id===ids[0]);if(starts.length===1){paired=starts;why='Dokumentert personreferanse, støttende navn og én registrering i året. Endret øvelse/distanse vurderes som resultatkorrigering.';}}
     if(paired.length===1){const x=paired[0];item.beforeIndex=x.index;item.before=x.row;item.after=afterRow(row,x.id,x.row,history.redirects);item.category=differences(x.row,item.after).length?'changed':'unchanged';item.reason=why;}
     else if(paired.length>1){item.category=new Set(paired.map(x=>x.id)).size===1?'registration':'uncertain';item.relatedIndices=paired.map(x=>x.index);item.reason='Flere historiske starter passer. Velg hvilken registrering dette gjelder. Ingen starter fjernes.';}
     else if(ids.length===0){item.category='new';item.newType='person';item.reason='Nytt tellende resultat uten støttet personkobling. En eventuell ny profil krever separat identitetskontroll; ingen person opprettes automatisk.';}
     else if(ids.length===1&&!old.some(x=>x.id===ids[0])&&(explicit||external||strong.length===1)){item.category='new';item.newType='result';item.reason='Forslag til nytt resultat for en eksisterende løper. Bekreft person og registrering før tillegget klargjøres; navnet alene gir ingen permanent kobling.';}
     else if(ids.length===1&&old.some(x=>x.id===ids[0])&&(explicit||external||strong.length===1)){item.category='registration';item.reason='Personreferansen eller navnet samsvarer, men resultatet passer ikke entydig med en tidligere start. Velg rett registrering eller bekreft at dette er en ekstra start.';}
    }
   }
   if(['uncertain','registration'].includes(item.category)&&!item.relatedIndices.length)item.relatedIndices=old.filter(x=>ids.includes(x.id)&&(item.category==='registration'||x.row[2]===row.event&&sameDistance(x.row[3],row.distance))).map(x=>x.index);
   const sourceStatus=H.effectiveStatus([year,'','','',row.status,row.time]);
   if(sourceStatus==='DNS'&&!item.blocking){
    const scoped=old.filter(x=>(ids.includes(x.id)&&x.row[2]===row.event&&sameDistance(x.row[3],row.distance))||bibRows.some(b=>b.index===x.index)),starts=scoped.filter(x=>H.countsAsParticipation(x.row));
    if(H.timeSeconds(row.time)>0){item.category='unassessable';item.blocking=true;item.reason='DNS er kombinert med en positiv sluttid. Kontroller resultatstatusen i kilden.';}
    else if(starts.length){item.category='conflict';item.conflictType='source';item.blocking=true;item.relatedIndices=starts.map(x=>x.index);if(starts.length===1){item.beforeIndex=starts[0].index;item.before=starts[0].row;}item.after=null;item.reason='DNS motsier en dokumentert start i historikken (fullføring, DNF eller annen tellende deltakelse). Avklar kilden før resultatet kan endres.';}
    else if(item.category!=='unchanged'){item.category='dns';item.newType=null;item.relatedIndices=[];item.after=null;item.reason='Ikke startet. Ingen personprofil, resultattillegg eller tellende deltakelse foreslås. Historikken beholdes.';}
   }
   if(decision){
    if(item.category==='dns')throw Error('DNS uten dokumentert start er informasjon og skal ikke klargjøres som en retting.');
    if(!['confirm','new','reject','defer'].includes(decision.action)||typeof decision.reason!=='string'||!decision.reason.trim()||decision.reason.length>1000||/[<>\u0000-\u001f]/.test(decision.reason)||!Number.isFinite(Date.parse(decision.at)))throw Error('Registrer en gyldig, uttrykkelig beslutning og begrunnelse.');
    item.decision=clone(decision);
    if(decision.action==='confirm'){
     if(item.blocking)throw Error('Kildekonflikten må rettes før bekreftelse.');const id=context.model.resolve(decision.runnerId);if(!context.people.has(id))throw Error('Velg en eksisterende person. Nye profiler opprettes ikke her.');
     const owners=old.filter(x=>row.bib&&clean(x.row[9])===row.bib);if(owners.length&&!owners.some(x=>x.id===id))throw Error('Startnummeret peker på en annen person i historikken. Avklar konflikten i kontrollsentralen først.');
     const matched=decision.targetIndex===null?null:old.find(x=>x.index===decision.targetIndex&&x.id===id);if(decision.targetIndex!==null&&!matched)throw Error('Velg et eksakt resultat for personen i valgt år.');
     if(row.gender&&context.people.get(id).gender&&row.gender!==context.people.get(id).gender)throw Error('Kjønn motsier valgt person. Avklar i personkontrollen først.');
     item.beforeIndex=matched?.index??null;item.before=matched?.row??null;item.after=afterRow(row,id,item.before,history.redirects);item.category=item.before?(differences(item.before,item.after).length?'changed':'unchanged'):'new';item.newType=item.before?null:'result';item.relatedIndices=[];item.reason='Arrangøren har uttrykkelig bekreftet dette resultatvalget. '+decision.reason;
    }
    else if(decision.action==='new'){item.beforeIndex=null;item.before=null;item.after=null;item.category='new';item.newType='person';item.relatedIndices=[];item.reason='Markert som ny person. Ingen profil eller permanent person-ID opprettes i C2.3a.';}
   }
   if(item.after){
    const id=context.model.resolve(item.after[1]),person=context.model.person(id),normalized=[...item.after];normalized[1]=id;
    // Validate just this row without importing unrelated redirects into a one-person fixture.
    const isolated=H.validate({schemaVersion:1,people:person?[person]:[],results:[normalized],yearStats:[[year,0]],aliases:{},redirects:{}});
    if(isolated.errors.length||row.gender&&person?.g&&row.gender!==person.g){item.category='conflict';item.blocking=true;item.reason='Status, resultatverdier eller kjønn motsier historikken. Avklar i kontrollsentralen.';}
    if(item.decision?.action==='confirm'&&old.some(x=>x.index!==item.beforeIndex&&same(x.row,item.after))){item.category='conflict';item.blocking=true;item.reason='Det foreslåtte resultatet finnes allerede på en annen registrering. Ingen dobbeltregistrering klargjøres.';}
    item.differences=item.before?differences(item.before,item.after):Object.entries(columns).map(([field,index])=>({field,label:fields[field],before:'',after:item.after[index]??''}));
    if(!history.yearStats.some(r=>r[0]===year))item.limitation='Ny årgang mangler godkjent arrangementsgrunnlag. Bare en kontrollsak kan klargjøres inntil årgangen støttes av rettingskontrakten.';
   }
   items.push(item);
  }
  const claims=new Map();for(const i of items)if(i.beforeIndex!==null&&i.decision?.action!=='new'){if(!claims.has(i.beforeIndex))claims.set(i.beforeIndex,[]);claims.get(i.beforeIndex).push(i);}
  for(const group of claims.values())if(group.length>1)for(const i of group){i.category='conflict';i.conflictType='source';i.blocking=true;i.reason='Flere importerte rader peker på samme historiske resultat. Ingen av dem kan klargjøres før dette er avklart.';}
  for(const x of old)if(!claims.has(x.index)){const related=items.filter(i=>!['reject','new','confirm'].includes(i.decision?.action)&&i.relatedIndices?.includes(x.index)).map(i=>i.id),category=related.length?'unlinked':'missing';if(category==='unlinked'&&decisions.has('missing-'+x.index))throw Error('Denne historiske registreringen inngår i en uavklart kobling. Vurder kildeavviket før en egen beslutning tas.');items.push({id:'missing-'+x.index,row:null,category,reason:related.length?'Kan være representert av et uavklart resultat i filen. Avklar den tilknyttede saken først; dette er ikke en egen bekreftet mangel.':'Ikke koblet til ny eksport. Kan skyldes filtrert eksport. Resultatet slettes aldri automatisk.',relatedItemIds:related,candidates:[],beforeIndex:x.index,before:x.row,after:null,differences:[],blocking:false,decision:decisions.get('missing-'+x.index)||null});}
  for(const key of decisions.keys())if(!items.some(i=>i.id===key))throw Error('Beslutningen gjelder en sak som ikke finnes i denne analysen.');
  const counts=Object.fromEntries(Object.keys(labels).map(key=>[key,items.filter(i=>i.category===key).length]));
  const completeness=counts.missing?'partial':counts.conflict||counts.uncertain||counts.registration||counts.unlinked||counts.unassessable||counts.new||counts.relay||!session.source.completeClaim||!old.length?'uncertain':'apparent-complete';
  return {items,counts,existing:old.length,read:session.rows.length,completeness,pending:items.filter(needsAttention).length};
 }
 function decide(context,session,decisions,itemId,{action,runnerId=null,targetIndex=null,reason}){
  const next=new Map(decisions);next.set(itemId,{basis:session.key,action,runnerId,targetIndex,reason:clean(reason),at:new Date().toISOString()});const analysis=review(context,session,next);if(!analysis.items.some(i=>i.id===itemId))throw Error('Kontrollsaken finnes ikke i dette grunnlaget.');return next;
 }
 async function prepare(context,session,decisions){
  await validateSession(context,session);const analysis=review(context,session,decisions);let packet=C.empty(session.base);
  for(const item of analysis.items.filter(i=>i.decision)){
   const d=item.decision;if(d.basis!==session.key)throw Error('Beslutningen gjelder ikke gjeldende kildefil.');
   const caseId='result-'+await C.hash([session.key,item.id]),source='Resultatimport '+session.source.year+' · SHA-256 '+session.source.sha256+' · kildeområde '+session.source.scope+' · tolkning '+session.key+' · '+item.id;
   const selected=d.runnerId&&context.people.has(context.model.resolve(d.runnerId))?context.model.resolve(d.runnerId):null,personIds=selected?[selected]:item.before?[context.model.resolve(item.before[1])]:[];
   packet=C.report(packet,{id:caseId,category:'Resultatavstemming',personIds,description:labels[item.category]+': '+(item.row?.name||context.model.person(item.before?.[1])?.n||'Kilderegistrering'),source});
   if(d.action==='confirm'&&item.category!=='unchanged'){
    if(item.blocking||!item.after||item.row?.relay||item.category==='missing')throw Error('Avviket kan ikke klargjøres som individuell retting.');
    if(item.limitation)packet=C.transition(packet,caseId,'review',d.reason+' '+item.limitation);
    else packet=await C.propose(context.model.data,packet,caseId,{kind:item.before?'result':'add',personIds,selector:item.before?await C.resultSelector(context.model.data,item.beforeIndex,session.base):null,after:item.after,source,reason:d.reason});
   }else packet=C.transition(packet,caseId,d.action==='reject'?'rejected':'review',d.reason);
   const c=packet.cases.at(-1);c.createdAt=d.at;for(const e of c.events)e.at=d.at;c.events.push({at:d.at,action:'result-source-'+session.source.sha256,reason:'Uttrykkelig lokal beslutning bundet til filhash, tolkning og godkjent historikk. Ingen produksjonsskriving.'});
  }
  await C.applyCandidate(context.model.data,packet,session.base,{preview:true});C.serialize(packet);return packet;
 }
 async function report(context,session,decisions){const packet=await prepare(context,session,decisions),analysis=review(context,session,decisions);const text=JSON.stringify({format:'morothon-results-review-v1',version:1,base:session.base,source:session.source,interpretationSha256:session.key,mapping:session.mapping,summary:{existing:analysis.existing,read:analysis.read,completeness:analysis.completeness,...analysis.counts},items:analysis.items,corrections:packet,productionApplied:false},null,2)+'\n';if(new TextEncoder().encode(text).length>8*1024*1024)throw Error('Kontrollrapporten overstiger 8 MB. Avgrens utvalget og gjennomgå på nytt. Ingen rader er utelatt stille.');return text;}
 return {fields,labels,needsAttention,columns,parse,detectFields,resolveFields,annualCourses,inspect,layouts,canContainFinish:v=>!notFinish(v),importedRows,createSession,validateSession,review,decide,prepare,report,differences};
});
