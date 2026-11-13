/* Shared read-only result rules. Honor roles never create or modify runner identities. */
(function () {
  'use strict';
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/å/g,'aa').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/[^a-z0-9]+/g,' ').trim();
  function statusToken(value){
    const s=norm(value);
    if(['dns','did not start'].includes(s))return 'DNS';
    if(['dnf','did not finish'].includes(s))return 'DNF';
    if(['dq','dsq','disket','diskvalifisert','disqualified'].includes(s))return 'Disket';
    if(s==='fullfort'||s.startsWith('fullfort ')||s==='completed')return 'Fullført';
    if(s==='deltatt')return 'Deltatt';
    if(s==='pameldt'||s==='registered')return 'Påmeldt';
    return null;
  }
  function effectiveStatus(r){
    const raw=statusToken(r?.[4]),time=statusToken(r?.[5]);
    // Preserve established DNS/DNF normalization. DQ in the time field alone
    // requires source review and must not silently remove a historical completion.
    for(const s of ['DNS','DNF'])if(raw===s||time===s)return s;
    return raw||'Ukjent';
  }
  const isRelayRace=r=>{const e=norm(r?.[2]||'');return e.includes('stafett')||e.includes('relay');};
  // Preserve the historical DQ participation rule; completion is a separate decision.
  const countsAsParticipation=r=>!isRelayRace(r)&&['Fullført','Deltatt','DNF','Disket'].includes(effectiveStatus(r));
  const isCompletedResult=r=>effectiveStatus(r)==='Fullført';
  const parseDistanceKm=v=>{const m=String(v||'').replace(',','.').match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):null;};
  const isJuniorRace=r=>{const e=norm(r?.[2]||'');return e.includes('junior')||(parseDistanceKm(r?.[3])===3&&e.includes('morothon'));};
  const juniorClass=r=>isJuniorRace(r)?String(r[7]||'').trim():'';
  function timeSeconds(t){
    let s=String(t??'').trim();
    if(/^\d{1,2}[.]\d{2}(?:[.]\d{2})?$/.test(s))s=s.replaceAll('.',':');
    if(!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s))return null;
    const p=s.split(':').map(Number);
    if(p.at(-1)>=60||p.length===3&&p[1]>=60)return null;
    const seconds=p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];
    return seconds>0?seconds:null;
  }
  const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
  function resolveId(pid,redirects={}){
    if(!validId(pid))throw new Error('Ugyldig person-ID.');
    let id=pid;const seen=new Set();
    while(Object.hasOwn(redirects,id)){
      if(seen.has(id))throw new Error('Syklus i person-ID-omdirigeringer.');
      seen.add(id);id=redirects[id];if(!validId(id))throw new Error('Ugyldig mål for person-ID.');
    }
    return id;
  }
  function validate(data){
    const errors=[],warnings=[],issue=(list,code,at)=>list.push({code,at});
    const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
    if(!object(data)||data.schemaVersion!==1||!Array.isArray(data.people)||!Array.isArray(data.results)||!Array.isArray(data.yearStats))return {errors:[{code:'format',at:'$'}],warnings};
    const redirects=data.redirects??{},aliases=data.aliases??{},people=new Set();
    if(!object(redirects)||!object(aliases))return {errors:[{code:'identity-map',at:'$'}],warnings};
    for(const [i,p]of data.people.entries()){
      if(!object(p)||!validId(p.i)||typeof p.n!=='string'||!p.n.trim()){issue(errors,'person',`people[${i}]`);continue;}
      if(people.has(p.i))issue(errors,'duplicate-person',`people[${i}]`);people.add(p.i);
    }
    const editions=new Set();
    for(const [i,r]of data.yearStats.entries()){
      if(!Array.isArray(r)||!Number.isInteger(r[0])||r[0]<1||r[0]>9999||r.slice(1).some(n=>!Number.isInteger(n)||n<0)||editions.has(r[0]))issue(errors,'year-statistics',`yearStats[${i}]`);
      else editions.add(r[0]);
    }
    const resolved=new Map();
    const resolve=(id,at)=>{try{if(!resolved.has(id))resolved.set(id,resolveId(id,redirects));return resolved.get(id);}catch{issue(errors,'invalid-identity',at);return null;}};
    for(const id of Object.keys(redirects)){
      const target=resolve(id,'redirects.'+id);if(target&&!people.has(target))issue(errors,'missing-redirect-target','redirects.'+id);
    }
    for(const [id,names]of Object.entries(aliases)){
      const target=resolve(id,'aliases.'+id);
      if(target&&!people.has(target)||!Array.isArray(names)||names.some(n=>typeof n!=='string'||!n.trim()))issue(errors,'alias','aliases.'+id);
    }
    const duplicates=new Set();
    for(const [i,r]of data.results.entries()){
      const at=`results[${i}]`;
      if(!Array.isArray(r)||r.length<6||r.length>10||!Number.isInteger(r[0])||r[0]<1||r[0]>9999||typeof r[2]!=='string'||!r[2].trim()||typeof r[3]!=='string'||typeof r[4]!=='string'||!(r[5]===null||typeof r[5]==='string')){issue(errors,'result',at);continue;}
      const id=resolve(r[1],at+'[1]'),s=effectiveStatus(r),raw=statusToken(r[4]),time=statusToken(r[5]);
      if(!raw)issue(errors,'unknown-status',at+'[4]');
      const nonfinish=new Set([raw,time].filter(s=>['DNS','DNF','Disket'].includes(s)));
      if(nonfinish.size>1)issue(errors,'conflicting-status',at);
      if(raw==='Fullført'&&time==='Disket'){
        // Organizer decision in A2: retain this existing completion and totals.
        const retained=r[0]===2007&&r[1]==='MOR-B1AC0FD'&&r[2]==='Kortmoro'&&r[3]==='14 km'&&r[4]==='Fullført'&&r[5]==='Disket'&&r[6]==='Disket';
        issue(retained?warnings:errors,retained?'legacy-disqualification-marker':'disqualification-needs-review',at);
      }
      if(id&&!people.has(id))issue(s==='DNS'?warnings:errors,s==='DNS'?'legacy-dns-without-person':'missing-person',at);
      if(raw&&raw!==s)issue(warnings,'normalized-status',at);
      // Two source strings already documented in R-06 remain uninterpreted.
      const legacyTime=(r[0]===1994&&r[1]==='MOR-88334F0'&&r[2]==='Morothon'&&r[3]==='18 km'&&r[4]==='Fullført'&&r[5]==='02:09.52'||r[0]===1998&&r[1]==='MOR-98692D6'&&r[2]==='Kortmoro'&&r[3]==='13 km'&&r[4]==='Fullført'&&r[5]==='01:06.14');
      const text=String(r[5]??'').trim();
      if(text&&!time&&timeSeconds(text)===null)issue(legacyTime?warnings:errors,legacyTime?'ambiguous-legacy-time':'invalid-time',at+'[5]');
      if(!/^\d+(?:[.,]\d+)?\s*km$/i.test(r[3])||!(parseDistanceKm(r[3])>0)){
        issue(r[3]==='Ukjent'&&s==='Deltatt'?warnings:errors,r[3]==='Ukjent'&&s==='Deltatt'?'legacy-unknown-distance':'invalid-distance',at+'[3]');
      }
      const signature=JSON.stringify(r);if(duplicates.has(signature))issue(warnings,'duplicate-result',at);duplicates.add(signature);
    }
    return {errors,warnings};
  }
  function assertValid(data){const report=validate(data);if(report.errors.length)throw new Error('Ugyldig løpshistorikk: '+report.errors.map(e=>e.code+' @ '+e.at).slice(0,8).join('; '));return report;}
  const participationYears=rows=>[...new Set(rows.filter(countsAsParticipation).map(r=>r[0]))].sort((a,b)=>a-b);
  function placements(rows,person){
    const map=new WeakMap(),groups=new Map();
    for(const r of rows){if(!isCompletedResult(r)||isRelayRace(r))continue;const t=timeSeconds(r[5]),p=person(r[1]);if(t===null||!p?.g)continue;const key=JSON.stringify([r[0],r[2],r[3],p.g,juniorClass(r)]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({r,t});}
    for(const group of groups.values()){group.sort((a,b)=>a.t-b.t);let previous=null,rank=0;group.forEach(({r,t},i)=>{if(t!==previous){rank=i+1;previous=t;}map.set(r,rank);});}
    return map;
  }
  const eventLabel=r=>r[2]==='Morothon'?'Langmoro':r[2];
  const periodFor=r=>r[0]<2014?'historical':'since-2014';
  const sourcePlace=r=>{const n=Number(r[6]);return Number.isInteger(n)&&n>0?n:null;};
  function create(data){
    assertValid(data);
    const resolve=pid=>resolveId(pid,data.redirects||{}),people=new Map(data.people.filter(p=>resolve(p.i)===p.i).map(p=>[p.i,p])),byPerson=new Map();
    for(const r of data.results){const id=resolve(r[1]);if(!byPerson.has(id))byPerson.set(id,[]);byPerson.get(id).push(r);}
    const person=pid=>people.get(resolve(pid))||null,resultsFor=pid=>byPerson.get(resolve(pid))||[],classPlaces=placements(data.results,person);
    function stats(pid){
      const p=person(pid);if(!p)return null;const rows=resultsFor(p.i),years=participationYears(rows);if(!years.length)return null;
      const finished=rows.filter(r=>isCompletedResult(r)&&!isRelayRace(r)),timed=finished.filter(r=>timeSeconds(r[5])!==null),groups=new Map();
      for(const r of timed){const km=parseDistanceKm(r[3]);if(km===null)continue;const period=periodFor(r),key=JSON.stringify([r[2],km,period]);if(!groups.has(key))groups.set(key,{event:r[2],eventLabel:eventLabel(r),km,distance:`${String(km).replace('.',',')} km`,period,rows:[]});groups.get(key).rows.push(r);}
      const best=[...groups.values()].map(g=>{g.rows.sort((a,b)=>timeSeconds(a[5])-timeSeconds(b[5])||a[0]-b[0]);return {...g,row:g.rows[0],time:String(g.rows[0][5]).replace(/^0:/,''),year:g.rows[0][0],count:g.rows.length};}).sort((a,b)=>b.count-a.count||a.event.localeCompare(b.event,'no')||b.km-a.km||a.year-b.year);
      // Honor achievements quote the recorded source position; computed gender/class ranks remain separate.
      const sourceResults=finished.filter(r=>sourcePlace(r)!==null),wins=sourceResults.filter(r=>sourcePlace(r)===1),podiums=sourceResults.filter(r=>sourcePlace(r)<=3);
      const calculated=timed.filter(r=>classPlaces.has(r));
      return {id:p.i,name:p.n,gender:p.g,count:years.length,firstYear:years[0],lastYear:years.at(-1),years,best,
        sourceWins:wins,sourcePodiums:podiums,sourceResults,calculatedWins:calculated.filter(r=>classPlaces.get(r)===1),calculatedPodiums:calculated.filter(r=>classPlaces.get(r)<=3),
        latestRows:rows.filter(countsAsParticipation).slice().sort((a,b)=>b[0]-a[0]),
        returns:years.slice(1).map((year,i)=>({year,previous:years[i],rows:rows.filter(r=>r[0]===year&&countsAsParticipation(r))})).filter(r=>r.year-r.previous>1)};
    }
    return {data,people,person,resolve,resultsFor,stats,classPlaces};
  }
  let pending;
  function load(){if(!pending)pending=fetch('data/history.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw new Error('Løpshistorikken kunne ikke lastes.');return create(await r.json());}).catch(e=>{pending=null;throw e;});return pending;}
  const api={effectiveStatus,countsAsParticipation,isCompletedResult,isRelayRace,isJuniorRace,juniorClass,parseDistanceKm,timeSeconds,resolveId,participationYears,placements,eventLabel,periodFor,sourcePlace,validate,assertValid,create,load};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.MorothonHistoryData=api;
})();
