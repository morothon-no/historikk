'use strict';
// Public exact patches, never CSV, private decisions or approval evidence.
const H=require('../../js/history-data.js'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=v=>structuredClone(v),fields=['people','results','yearStats','range'];
function validatePatch(p){
 if(!p||Object.keys(p).sort().join('|')!=='after|before|field|index'||!fields.includes(p.field)||same(p.before,p.after))throw Error('Ugyldig årsendring.');
 if(p.field==='range'){if(p.index!==null||[p.before,p.after].some(v=>typeof v!=='string'||v.length>100||/[<>\x00-\x1f]/.test(v)))throw Error('Ugyldig årsperiode.');return;}
 if(!Number.isSafeInteger(p.index)||p.index<0||p.index>1000000)throw Error('Ugyldig kildeindeks.');
 for(const v of [p.before,p.after]){if(v===null)continue;
  if(p.field==='people'){
   if(!v||Array.isArray(v)||Object.keys(v).some(k=>!['i','n','g','c','f','l','s','a','m','k','q','d','x','z'].includes(k))||typeof v.i!=='string'||!/^MOR-[A-Z0-9]+$/.test(v.i)||typeof v.n!=='string'||!v.n.trim()||/[<>\x00-\x1f]/.test(v.n))throw Error('Ugyldig offentlig løperprofil.');
  }else if(!Array.isArray(v)||v.length!==10||p.field==='yearStats'&&v.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Ugyldig offentlig resultat-/årsrad.');
 }
}
function apply(history,patches,reverse=false){
 const out=copy(history);
 for(const p of patches){validatePatch(p);const actual=p.field==='range'?out.range:out[p.field][p.index]??null;if(!same(actual,reverse?p.after:p.before))throw Error('Årsgrunnlaget har nyere eller motstridende verdier.');}
 for(const field of fields){const list=patches.filter(p=>p.field===field),target=p=>reverse?p.before:p.after,source=p=>reverse?p.after:p.before;
  if(field==='range'){if(list.length)out.range=target(list[0]);continue;}
  for(const p of list.filter(p=>source(p)!==null&&target(p)!==null))out[field][p.index]=copy(target(p));
  for(const p of list.filter(p=>target(p)===null).sort((a,b)=>b.index-a.index)){if(p.index!==out[field].length-1)throw Error('Nyere registreringer hindrer sikker tilbakeføring.');out[field].pop();}
  for(const p of list.filter(p=>source(p)===null).sort((a,b)=>a.index-b.index)){if(p.index!==out[field].length)throw Error('Nye registreringer må legges til uten å flytte kilderekkefølgen.');out[field].push(copy(target(p)));}
 }
 H.assertValid(out);return out;
}
function changes(before,after,{reverse=false}={}){
 H.assertValid(before);H.assertValid(after);const other=h=>Object.fromEntries(Object.entries(h).filter(([k])=>!fields.includes(k)));
 if(!same(other(before),other(after)))throw Error('Årspublisering må bevare identitetskoblinger og øvrige historiske kilder.');const patches=[];
 for(const field of fields){
  if(field==='range'){if(!same(before.range,after.range))patches.push({field,index:null,before:before.range,after:after.range});continue;}
  if(!reverse&&after[field].length<before[field].length)throw Error('Årsimport kan ikke slette kilderader.');
  for(let index=0;index<Math.max(before[field].length,after[field].length);index++){const a=before[field][index]??null,b=after[field][index]??null;if(same(a,b))continue;
   if(a&&b&&(field==='people'||field==='results'&&(a[0]!==b[0]||a[1]!==b[1])||field==='yearStats'&&a.some((n,i)=>i!==2&&n!==b[i])))throw Error('Uautorisert identitets-, kilde- eller årsstatistikkendring.');
   const p={field,index,before:copy(a),after:copy(b)};validatePatch(p);patches.push(p);
  }
 }
 if(!patches.length)throw Error('Ingen nye årsresultater å publisere.');if(!same(apply(before,patches),after))throw Error('Årsendringene kunne ikke rekonstrueres.');return patches;
}
module.exports={validatePatch,apply,changes};
