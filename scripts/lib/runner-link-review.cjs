// Read-only proposals. Name evidence is never an identity confirmation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const H=require('../../js/honors-data.js');
const labels={confirmed:'Bekreftet kobling',unique:'Entydig navnetreff – må bekreftes',ambiguous:'Tvetydig – manuell kontroll',uncertain:'Usikker navnelikhet – manuell kontroll',unmatched:'Ingen treff','owner-conflict':'Løperen er allerede koblet – manuell kontroll','broken-link':'Bekreftet ID mangler i historikken','invalid-confirmation':'Ugyldig bekreftelse','duplicate-confirmation':'Samme løper koblet til flere hederspersoner'};
const normal=name=>String(name||'').normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/[‐‑‒–—]/g,'-').replace(/\s+/gu,' ').trim();
const folded=name=>normal(name).normalize('NFD').replace(/\p{M}/gu,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/aa/g,'a').replace(/[.\-]/g,' ').replace(/\s+/g,' ').trim();
const complete=name=>{const tokens=normal(name).replace(/[.\-]/g,' ').split(/\s+/).filter(Boolean);return tokens.length>=2&&tokens.every(t=>t.length>1);};
const compare=new Intl.Collator('nb-NO',{sensitivity:'base',numeric:true}).compare;
function oneEdit(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(i<a.length||j<b.length?1:0)<=1;}
function weakMatch(query,name){
 const a=folded(query),b=folded(name);if(!a||!b)return null;if(a===b)return 'stavemåte/tegnsetting';if(a.replaceAll(' ','')===b.replaceAll(' ',''))return 'mellomrom/sammenskriving';
 const qa=a.split(' '),nb=b.split(' ');
 // Additional names or initials are deliberately only weak evidence.
 if(qa.every(t=>nb.some(n=>n===t||t.length===1&&n.startsWith(t)))||qa.length>=2&&nb.length>=2&&qa[0]===nb[0]&&qa.at(-1)===nb.at(-1)&&nb.every(t=>qa.includes(t)))return 'ufullstendig navn/initialer';
 if(a.length>=7&&(qa.at(-1)===nb.at(-1)&&qa.at(-1).length>=4||qa[0]===nb[0])&&oneEdit(a,b))return 'mulig skrivefeil';
 return null;
}
function historyRules(){const context={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../js/history-data.js'),'utf8'),context,{filename:'history-data.js'});return context.window.MorothonHistoryData;}
function reviewLinks(data,history,{previous=null,profileBase='https://morothon-no.github.io/historikk/'}={}){
 if(new URL(profileBase).protocol!=='https:')throw new Error('Profillenker i rapporten må bruke HTTPS.');
 const people=data.groups?.flatMap(g=>g.members);if(!Array.isArray(people)||new Set(people.map(m=>m.id)).size!==people.length||people.some(m=>!m||typeof m.name!=='string'||!m.name.trim()||m.aliases!==undefined&&(!Array.isArray(m.aliases)||m.aliases.some(a=>typeof a!=='string'||!a.trim()))))throw new Error('Ugyldig eller duplisert person i navnekontrollen.');
 const historyRulesApi=historyRules(),rawPeople=new Map(history.people.map(p=>[p.i,p])),redirects=history.redirects||{},warnings=[];
 function canonical(id){const seen=new Set();while(Object.hasOwn(redirects,id)){if(seen.has(id))return null;seen.add(id);id=redirects[id];}return rawPeople.has(id)?id:null;}
 const model=historyRulesApi.create({...history,results:history.results.filter(r=>!historyRulesApi.isRelayRace(r))}),rowKinds=new Map();
 for(const r of history.results){const id=canonical(r[1]);if(id){if(!rowKinds.has(id))rowKinds.set(id,{relay:false,individual:false});rowKinds.get(id)[historyRulesApi.isRelayRace(r)?'relay':'individual']=true;}}
 const candidates=new Map(),exact=new Map();
 function addName(id,name,origin){const root=canonical(id);if(!root||typeof name!=='string'||!normal(name))return;
  const kind=rowKinds.get(root);if(kind?.relay&&!kind.individual)return;
  if(!candidates.has(root)){const stats=model.stats(root),person=rawPeople.get(root);candidates.set(root,{id:root,name:person.n,names:[],participations:stats?.count||0,firstYear:stats?.firstYear??null,lastYear:stats?.lastYear??null,url:new URL('index.html#lop='+encodeURIComponent(root),profileBase).href});}
  const entry=candidates.get(root);if(!entry.names.some(n=>n.name===name&&n.origin===origin))entry.names.push({name,origin});
  const key=normal(name);if(!exact.has(key))exact.set(key,new Set());exact.get(key).add(root);
 }
 for(const p of history.people)addName(p.i,p.n,canonical(p.i)===p.i?'registered-name':'redirected-name');
 for(const [id,names]of Object.entries(history.aliases||{})){if(!canonical(id)){warnings.push('Alias uten gyldig kanonisk person: '+id);continue;}if(!Array.isArray(names)){warnings.push('Ugyldig aliasliste: '+id);continue;}for(const name of names)addName(id,name,'registered-alias');}
 const owners=new Map();
 function recordedLink(member){const details=data.personDetails?.[member.id]||{};if(Object.hasOwn(details,'runnerLink')){const link=details.runnerLink;if(!link||link.confirmed!==true||!/^MOR-[A-Z0-9]{7}$/.test(link.runnerId||'')||!Array.isArray(link.sourceIds)||!link.sourceIds.length||link.sourceIds.some(id=>!Object.hasOwn(data.sources||{},id)))return {invalid:true,id:link?.runnerId||null};return {id:link.runnerId};}return member.runnerId?{id:member.runnerId,invalid:typeof member.runnerId!=='string'||!/^MOR-[A-Z0-9]{7}$/.test(member.runnerId)}:null;}
 for(const member of people){const link=recordedLink(member),id=link&&!link.invalid&&canonical(link.id);if(id){if(!owners.has(id))owners.set(id,[]);owners.get(id).push(member.id);}}
 function candidate(id,matches){const entry=candidates.get(id);return {candidateId:id,name:entry?.name||rawPeople.get(id)?.n,participations:entry?.participations??model.stats(id)?.count??0,firstYear:entry?.firstYear??model.stats(id)?.firstYear??null,lastYear:entry?.lastYear??model.stats(id)?.lastYear??null,url:entry?.url||new URL('index.html#lop='+encodeURIComponent(id),profileBase).href,matches,alreadyLinkedTo:owners.get(id)||[]};}
 for(const ids of owners.values())ids.sort(compare);
 const old=new Map((previous?.rows||[]).map(r=>[r.personId,r])),rows=[];
 for(const member of people){
  const names=[...new Set([member.name,...[...member.aliases||[]].sort(compare)])],link=recordedLink(member);let status,found=[],reason='';
  if(link){const root=!link.invalid&&canonical(link.id);status=link.invalid?'invalid-confirmation':!root||!candidates.has(root)?'broken-link':owners.get(root).length>1?'duplicate-confirmation':'confirmed';if(root)found=[candidate(root,[{basis:'organizer-confirmed',registeredId:link.id}])];reason=status==='confirmed'?'Eksisterende uttrykkelig kobling beholdes; navn brukes ikke som ny bekreftelse.':'Kontroller den lagrede koblingen manuelt.';
  }else{
   const hits=new Map();for(const query of names)for(const id of exact.get(normal(query))||[]){if(!hits.has(id))hits.set(id,[]);for(const n of candidates.get(id).names.filter(n=>normal(n.name)===normal(query)))hits.get(id).push({query,matchedName:n.name,basis:n.origin});}
   if(hits.size){found=[...hits].map(([id,matches])=>candidate(id,matches));status=found.length>1?'ambiguous':member.nameStatus==='partial'||!complete(member.name)?'uncertain':'unique';reason=status==='unique'?'Ett kanonisk navne-/aliastreff. Identiteten må bekreftes av arrangøren.':'Navnet er ufullstendig eller viser til flere kanoniske personer.';
   }else{
    for(const [id,entry]of candidates){const matches=[];for(const query of names)for(const n of entry.names){const basis=weakMatch(query,n.name);if(basis)matches.push({query,matchedName:n.name,basis});}if(matches.length)found.push(candidate(id,matches));}
    status=found.length>1?'ambiguous':found.length?'uncertain':'unmatched';reason=found.length?'Kun svak navnelikhet; dette er ikke en identitetsbekreftelse.':'Ingen tilstrekkelige navne- eller aliastreff.';
   }
   if(status==='unique'&&found[0].alreadyLinkedTo.length){status='owner-conflict';reason='Kandidaten er allerede koblet til en annen hedersperson. Kontroller mulig dobbeltoppføring eller navnelikhet.';}
  }
  found.sort((a,b)=>compare(a.name,b.name)||compare(a.candidateId,b.candidateId));for(const c of found)c.matches.sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)));
  const signature=createHash('sha256').update(JSON.stringify({names,status,recordedId:link?.id||null,candidates:found.map(c=>({id:c.candidateId,matches:c.matches,owners:c.alreadyLinkedTo}))})).digest('hex');
  const prior=old.get(member.id),change=!previous?'new':!prior?'new':prior.signature===signature?'unchanged':'changed';
  rows.push({personId:member.id,name:member.name,status,label:labels[status],reason,recordedId:link?.id||null,requiresConfirmation:!link&&found.length>0,candidates:found,signature,change});
 }
 rows.sort((a,b)=>compare(a.name,b.name)||compare(a.personId,b.personId));
 const summary=Object.fromEntries(Object.keys(labels).map(status=>[status,rows.filter(r=>r.status===status).length]));
 summary.newProposals=rows.filter(r=>r.change==='new'&&r.requiresConfirmation).length;summary.changedProposals=rows.filter(r=>r.change==='changed'&&r.requiresConfirmation).length;
 return {schemaVersion:1,confirmationPolicy:'proposals-only-no-registry-writes',comparedToPrevious:!!previous,summary,warnings,rows};
}
function markdown(report){
 const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()|])/g,'\\$1').replace(/[\r\n]/g,' '),lines=['# Kontroll av løperkoblinger','', 'Navne-/aliastreff er forslag, ikke bekreftet identitet. Verktøyet endrer aldri personregister, runnerId, historikk eller tildelinger.', '',report.comparedToPrevious?'Ny/endret er sammenlignet med forrige rapport.':'Førstegangsrapport: alle ubekreftede forslag regnes som nye.',''];
 for(const statuses of [['unique'],['uncertain','ambiguous','owner-conflict'],['broken-link','invalid-confirmation','duplicate-confirmation'],['unmatched'],['confirmed']]){
  const rows=report.rows.filter(r=>statuses.includes(r.status));if(!rows.length)continue;
  lines.push('## '+(statuses[0]==='unique'?'Entydige navnetreff – krever bekreftelse':statuses[0]==='uncertain'?'Usikre/tvetydige treff – manuell kontroll':statuses[0]==='broken-link'?'Feil i lagrede koblinger':statuses[0]==='unmatched'?'Uten treff':'Allerede bekreftede koblinger'),'','| Dugnadsnavn | Status | Ny/endret | Kandidat og løpsdeltakelser | Grunnlag |','| --- | --- | --- | --- | --- |');
  for(const row of rows){const evidence=[...new Set(row.candidates.flatMap(c=>c.matches).map(m=>m.basis==='registered-alias'?'Registrert alias: '+m.matchedName:m.basis==='redirected-name'?'Navn på sammenslått ID: '+m.matchedName:m.basis==='organizer-confirmed'?'Lagret bekreftelse: '+m.registeredId:m.matchedName||m.basis))].slice(0,4).join('; ');const found=row.candidates.slice(0,12).map(c=>`[${escape(c.name)}](${c.url}) (${escape(c.candidateId)}; ${c.participations} deltakelsesår${c.firstYear?'; '+escape(c.firstYear)+'–'+escape(c.lastYear):''})`).join('<br>')+(row.candidates.length>12?'<br>Flere kandidater i JSON-rapporten.':'');lines.push(`| ${escape(row.name)} | ${escape(row.label)} | ${!report.comparedToPrevious&&row.status==='confirmed'?'Eksisterende':({new:'Ny',changed:'Endret',unchanged:'Uendret'})[row.change]} | ${found||'–'} | ${escape(row.reason)} ${escape(evidence)} |`);}
  lines.push('');
 }
 if(report.warnings.length)lines.push('## Kildevarsler','',...report.warnings.map(w=>'- '+escape(w)),'');
 return lines.join('\n')+'\n';
}
module.exports={reviewLinks,markdown,normal,weakMatch};
