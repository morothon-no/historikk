// Fictional names/IDs only. Never import an actual organizer start list in tests.
function history(){
 const people=[['MOR-TEST001','Testløper Ni'],['MOR-TEST002','Prøve Løper'],['MOR-TEST003','Samme Testnavn'],['MOR-TEST004','Samme Testnavn'],['MOR-TEST005','DNS DNF Test']].map(([i,n])=>({i,n,g:'Herre',c:0,f:2017,l:2026,s:0,a:0,m:0,k:0,q:0,d:0,x:'',z:''}));
 const results=[];for(const [id,count]of [[people[0].i,9],[people[1].i,4],[people[2].i,9],[people[3].i,4]])for(let i=0;i<count;i++)results.push([2025-i,id,'Kortmoro','10 km','Fullført','50:00',1,'M','Syntetisk klubb','1']);
 results.push([2020,people[4].i,'Kortmoro','10 km','DNF','DNF','DNF','M','',''],[2021,people[4].i,'Kortmoro','10 km','DNS','DNS','DNS','M','',''],[2022,people[4].i,'Morothon','20 km','Fullført','2:00:00',1,'M','','']);
 for(const p of people){const years=[...new Set(results.filter(r=>r[1]===p.i&&r[4]!=='DNS').map(r=>r[0]))].sort();p.c=years.length;p.f=years[0];p.l=years.at(-1);}
 return {schemaVersion:1,people,results,yearStats:Array.from({length:10},(_,i)=>[2017+i,0,0,0,0,0,0,0,0,0]),updated:'2026-11-07',range:'2017–2026',aliases:{'MOR-TEST002':['Prøve Gammelt Navn'],'MOR-OLD0001':['Testløper Tidligere']},redirects:{'MOR-OLD0001':'MOR-TEST001'},teamResults:[]};
}
const csv='Navn;EQID;EntryID;Startnr;Distanse;Klasse;Klubb;År\r\n'+
 'Testløper Ni;EQ-1;REG-1;101;Kortmoro;M;Syntetisk klubb;2027\r\n'+
 'Prøve Gammelt Navn;EQ-2;REG-2;102;Langmoro;M;Prøveklubben;2027\r\n'+
 'Samme Testnavn;EQ-3;REG-3;103;Kortmoro;M;Prøveklubben;2027\r\n'+
 'Ny Eksempelperson;EQ-4;REG-4;104;Kortmoro;M;Eksempelklubben;2027\r\n'+
 'Testløper Ni;EQ-1;REG-5;105;Langmoro;M;Syntetisk klubb;2027\r\n';
module.exports={history,csv};
