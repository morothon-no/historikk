// Fictional result exports only. Never replace with a real EQ export.
const ids=Array.from({length:10},(_,i)=>'MOR-R23'+String(i+1).padStart(4,'0'));
function history(){
 const names=['Syntetisk Asmund Steinvik','Syntetisk Bjarne Skogdal','Syntetisk Frida Bruddvik','Syntetisk Disa Startvik','Syntetisk Tora Tidlaus','Syntetisk Lik Person','Syntetisk Lik Person','Syntetisk Edda Tillegg','Syntetisk Disk Kilde','Syntetisk Runa Ute'];
 const people=names.map((n,i)=>({i:ids[i],n,g:'Herre',c:1,f:2026,l:2026,s:1,a:1,m:0,k:1,q:0,d:0,x:'',z:''}));
 const rows=[
  [2026,ids[0],'Kortmoro','10 km','Fullført','1:08:51',2,'Herrer','Syntetisk klubb A','301'],
  [2026,ids[1],'Kortmoro','10 km','Fullført','2:07:14',4,'Herrer','Syntetisk klubb B','318'],
  [2026,ids[2],'Morothon','20 km','Fullført','DNF','','Herrer','','401'],
  [2026,ids[3],'Morothon','20 km','DNS','DNS','','Herrer','','402'],
  [2026,ids[4],'Morothon','20 km','Fullført','','','Herrer','','403'],
  [2026,ids[5],'Kortmoro','10 km','Fullført','50:00',1,'Herrer','','501'],
  [2026,ids[6],'Kortmoro','10 km','Fullført','55:00',3,'Herrer','','502'],
  [2025,ids[7],'Kortmoro','10 km','Fullført','50:00',1,'Herrer','','601'],
  [2026,ids[8],'Kortmoro','10 km','Disket','DQ','DQ','Herrer','','602'],
  [2026,ids[9],'Kortmoro','10 km','Deltatt','','','Herrer','','603']
 ];
 return {schemaVersion:1,people,results:rows,yearStats:[2025,2026].map(y=>[y,0,0,0,0,0,0,0,0,0]),updated:'2026-11-07',range:'2025–2026',aliases:{[ids[0]]:['Syntetisk Asmund Gammelt']},redirects:{'MOR-R23OLD':ids[0]},teamResults:[{year:2026,event:'Langmoro stafett',team:'Syntetisk Lag',time:'2:20:00',status:'Fullført',place:1,legs:4}]};
}
const headers=['Navn','Startnummer','Øvelse','Distanse','Status','Tid','Plass','Klasse','Klubb','År'];
function csv(data=history(),rows=data.results.filter(r=>r[0]===2026)){
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [headers,...rows.map(r=>[data.people.find(p=>p.i===(data.redirects[r[1]]||r[1]))?.n||'Syntetisk ukjent',r[9],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[0]])].map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n';
}
function corrected(){const h=history();h.results[0][2]='Morothon';h.results[0][3]='20 km';h.results[0][5]='2:07:14';h.results[1][5]='1:08:51';return h;}
const meta={dataVersion:2,manifestSha256:'a'.repeat(64),historySha256:'b'.repeat(64)};
// Only the listed column names/positions reproduce the observed screenshot.
// Unknown columns and all values here are deliberately synthetic, not an EQ export specification.
function scenario454({combined=true,result=true}={}){
 const people=[],results=[],table=[['Rank','Syntetisk felt B','Firstname','Surname','Gender','Syntetisk felt F','Club','Race','Class',...(result?['Result']:[])]];
 for(let i=0;i<454;i++){
  const suffix=String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26),id='MOR-SYN'+String(i).padStart(4,'0'),first='Syntetisk Test',last='Eksempel'+suffix,event=i%2?'Morothon':'Kortmoro',distance=i%2?'20 km':'10 km',time=i%2?'2:10:00':'50:00',token=i===1?'DNS':i===2?'DNF':i===3?'DQ':time,status=token==='DQ'?'Disket':['DNS','DNF'].includes(token)?token:'Fullført';
  people.push({i:id,n:first+' '+last,g:'Herre'});results.push([2026,id,event,distance,status,token,status==='Fullført'?i+1:'','Herrer','Syntetisk klubb',String(i+1)]);
  table.push([status==='Fullført'?i+1:'',String(i+1),first,last,'M','Syntetisk verdi','Syntetisk klubb',(i%2?'Langmoro':'Kortmoro')+(combined?' '+distance:''),'Herrer',...(result?[token]:[])]);
 }
 return {history:{schemaVersion:1,people,results,yearStats:[[2026,0,0,0,0,0,0,0,0,0]],aliases:{},redirects:{}},text:table.map(r=>r.join(';')).join('\n')};
}
module.exports={ids,history,csv,corrected,meta,scenario454};
// Reproduce only the reported totals, not the contents of a real export.
function reconciliation454({ambiguous=false,dnsCount=52}={}){
 const people=[],results=[];for(let i=0;i<398;i++){const suffix=String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26),id='MOR-DNS'+String(i).padStart(4,'0'),status=i>=393?'DNF':'Fullført';people.push({i:id,n:'Syntetisk Historikkløper Historikk'+suffix,g:'Herre'});results.push([2026,id,'Kortmoro','10 km',status,status==='DNF'?'DNF':'50:00','','Herrer','Syntetisk klubb',String(i===0?301:i===1?318:1000+i)]);}
 results[0][5]='1:08:51';results[1][5]='2:07:14';const h={schemaVersion:1,people,results,yearStats:[[2026,450,398,398,393,5,52,398,0,0]],updated:'2026-11-07',range:'2026–2026',aliases:{},redirects:{},teamResults:[]},source=structuredClone(h);source.results[0][2]='Morothon';source.results[0][3]='20 km';source.results[0][5]='2:07:14';source.results[1][5]='1:08:51';if(ambiguous){source.people[2].n=source.people[2].n.replace('Historikkløper','Historikkløpar');source.results[2][9]='';}
 for(let i=0;i<dnsCount;i++){const id='MOR-ABS'+String(i).padStart(4,'0');source.people.push({i:id,n:'Syntetisk Ikkestartende Fravær'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26),g:'Herre'});source.results.push([2026,id,'Kortmoro','10 km','DNS','DNS','','Herrer','','9000'+i]);}
 for(let i=0;i<4;i++){const id='MOR-TEAM'+i;source.people.push({i:id,n:'Syntetisk Lag Lagbokstav'+i,g:''});source.results.push([2026,id,'Langmoro stafett','','Fullført','2:20:00','','Stafett','','']);}
 return {history:h,text:csv(source)};
}
module.exports.reconciliation454=reconciliation454;
