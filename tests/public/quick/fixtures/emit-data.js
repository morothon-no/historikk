// Entirely fictional, format-faithful Emit 1.0 fixture. No real start-list data.
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function entries(count=449){return Array.from({length:count},(_,i)=>({
 fornavn:i===0?'Testløper':i===1?'Prøve':i===2?'Samme':'Syntetisk',
 etternavn:i===0?'Ni':i===1?'Gammelt Navn':i===2?'Testnavn':i===3?'Æ Ø Å & venner':'Person '+(i+1),
 team:'Syntetisk klubb & lag',startno:String(i+1).padStart(4,'0'),
 klasse:i>=count-15&&count===449?'Langmoro stafett':'Damer',nasjon:'NOR',starttid:'09:00:00',ecard:'',ecard2:''
}));}
function xml(rows=entries(),changedAt='2026-11-06 23:20:38'){return '<?xml version="1.0" encoding="UTF-8"?><startliste><changed date="'+escape(changedAt)+'"/><provider company="Emit as" versjon="Ver 1.0"/>'+rows.map(r=>'<start '+Object.entries(r).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'/>').join('')+'</startliste>';}
// Domain-only staging fixture; browser tests separately exercise real XML parsing.
function staged(rows=entries()){
 const fields=require('../../../../tools/diploma-admin/intake-model.js').fields,headers=Object.keys(fields);
 const keys={firstName:'fornavn',lastName:'etternavn',club:'team',bib:'startno',className:'klasse',nation:'nasjon',startTime:'starttid'};
 return {format:'emit-startliste-1.0',headers,mapping:Object.fromEntries(headers.map((k,i)=>[k,i])),records:rows.map((r,i)=>({line:i+1,entryKind:/stafett|relay/i.test(r.klasse)?'relay':'individual',cells:headers.map(k=>r[keys[k]]||'')}))};
}
module.exports={entries,xml,staged};
