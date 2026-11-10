/* Read-only participation periods, anchored historical awards and edition-based streaks. */
(function () {
  'use strict';
  const level = p => p.poss < 5 ? 0 : p.count === p.poss ? 100 : p.count * 10 >= p.poss * 9 ? 90 : p.count * 10 >= p.poss * 7 ? 70 : 0;
  const range = p => p.first == null ? 'ingen registrerte starter' : p.first === p.last ? String(p.first) : `${p.first}–${p.last}`;
  // Truncate to one decimal: a value below a threshold must never round up to that honour.
  const percent = p => (p.poss ? Math.floor(p.count * 1000 / p.poss) / 10 : 0).toLocaleString('nb-NO');
  function tier(p, latest) {
    const n = level(p); if (!n) return null;
    const name = n === 100 ? (p.last === latest ? 'Ubrutt siden debut' : 'Ubrutt deltakelse') : n === 90 ? 'Svært trofast' : 'Trofast Morothon-løper';
    return { ...p, level:n, name, cls:`loyal${n}`, mark:percent(p)+' %', short:name.toLocaleUpperCase('nb-NO'),
      desc:`${name} i perioden ${range(p)} · ${p.count} av ${p.poss} arrangerte utgaver.` };
  }
  function calculate(rows, editionYears) {
    const editions = [...new Set(editionYears)].sort((a,b)=>a-b), index = new Map(editions.map((y,i)=>[y,i]));
    const rules = window.MorothonHistoryData;
    const years = [...new Set(rows.filter(r=>rules.countsAsParticipation(r)&&!rules.isRelayRace(r)&&index.has(r[0])).map(r=>r[0]))].sort((a,b)=>a-b);
    const first = years[0] ?? null, last = years.at(-1) ?? null, count = years.length;
    const period = endIndex => { const poss=index.get(years[endIndex])-index.get(first)+1, count=endIndex+1;return {first,last:years[endIndex],count,poss,pct:count/poss,miss:poss-count}; };
    const total = count ? period(count-1) : {first,last,count:0,poss:0,pct:0,miss:0};
    let longest={first,last:first,count:count?1:0},ending={...longest};const awards=[],comebacks=[];
    for(let i=0;i<count;i++){
      if(i && index.get(years[i])-index.get(years[i-1])===1)ending={first:ending.first,last:years[i],count:ending.count+1};
      else {ending={first:years[i],last:years[i],count:1};if(i)comebacks.push({year:years[i],previous:years[i-1],missed:index.get(years[i])-index.get(years[i-1])-1});}
      // Equal-length runs retain the earliest complete documented run.
      if(ending.count>longest.count)longest={...ending};
      // Only debut-anchored prefixes ending in an actual participation qualify.
      // Extend a period only during uninterrupted participation at the same level.
      // A missed edition or changed level closes it; a comeback can never erase it.
      const p=period(i),n=level(p),previous=awards.at(-1);
      if(n){
        if(previous?.level===n && index.get(previous.last)===index.get(p.last)-1)awards.pop();
        awards.push({...p,level:n});
      }
    }
    const latest=editions.at(-1),current=tier(total,latest);
    const earned=awards.sort((a,b)=>b.level-a.level||b.poss-a.poss).map(p=>tier(p,p.last===last?latest:null));
    const recognition=earned[0]||null;
    return {...total,years,level:level(total),latest,active:last===latest?ending.count:0,longest,ending,comebacks,current,
      awards:earned,recognition,historical:earned.filter(p=>p.last!==last)};
  }
  window.MorothonLoyalty={calculate,level,tier,range,percent};
})();
