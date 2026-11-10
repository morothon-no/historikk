/* Shared read-only result rules. Honor roles never create or modify runner identities. */
(function () {
  'use strict';
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/å/g,'aa').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/[^a-z0-9]+/g,' ').trim();
  function effectiveStatus(r){const t=norm(r?.[5]||''),st=String(r?.[4]||'');if(t==='dnf'||norm(st)==='dnf')return 'DNF';if(t==='dns'||norm(st)==='dns')return 'DNS';if(norm(st).includes('disk'))return 'Disket';return st||'Ukjent';}
  const countsAsParticipation=r=>effectiveStatus(r)!=='DNS';
  const isCompletedResult=r=>{const s=norm(effectiveStatus(r));return s==='fullfort'||s.startsWith('fullfort ');};
  const isRelayRace=r=>{const e=norm(r?.[2]||'');return e.includes('stafett')||e.includes('relay');};
  const parseDistanceKm=v=>{const m=String(v||'').replace(',','.').match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):null;};
  const isJuniorRace=r=>{const e=norm(r?.[2]||'');return e.includes('junior')||(parseDistanceKm(r?.[3])===3&&e.includes('morothon'));};
  const juniorClass=r=>isJuniorRace(r)?String(r[7]||'').trim():'';
  function timeSeconds(t){let s=String(t||'').trim();if(/^\d{1,2}[.]\d{2}(?:[.]\d{2})?$/.test(s))s=s.replaceAll('.',':');if(!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s))return null;const p=s.split(':').map(Number);return p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];}
  function resolveId(pid,redirects={}){let id=pid;const seen=new Set();while(redirects[id]&&!seen.has(id)){seen.add(id);id=redirects[id];}return id;}
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
    if(data?.schemaVersion!==1||!Array.isArray(data.people)||!Array.isArray(data.results)||!Array.isArray(data.yearStats))throw new Error('Resultatfilen har feil format.');
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
  window.MorothonHistoryData={effectiveStatus,countsAsParticipation,isCompletedResult,isRelayRace,isJuniorRace,juniorClass,parseDistanceKm,timeSeconds,resolveId,participationYears,placements,eventLabel,periodFor,sourcePlace,create,load};
})();
