// Fictional public test data only. No imported start lists or administrative notes.
function history(){
 const names=[['MOR-C220001','Syntetisk Kari Nord'],['MOR-C220002','Syntetisk Kari N. Nord'],['MOR-C220003','Syntetisk Samme Navn'],['MOR-C220004','Syntetisk Samme Navn'],['MOR-C220005','Syntetisk Statusløper']];
 const people=names.map(([i,n])=>({i,n,g:'Herre',c:0,f:2020,l:2026,s:0,a:0,m:0,k:0,q:0,d:0,x:'',z:''}));
 people.forEach((p,i)=>p.c=[3,2,1,1,2][i]);
 const results=[];for(const [p,years]of [[0,[2020,2021,2022]],[1,[2023,2024]],[2,[2025]],[3,[2025]]])for(const y of years)results.push([y,people[p].i,'Kortmoro','10 km','Fullført','50:00',p===3?2:1,'M','Syntetisk klubb',String(results.length+1)]);
 results.push([2024,people[4].i,'Morothon','20 km','DNF','DNF','DNF','M','',''],[2025,people[4].i,'Morothon','20 km','DNS','DNS','DNS','M','',''],[2026,people[4].i,'Kortmoro','10 km','Disket','DQ','DQ','M','','']);
 return {schemaVersion:1,people,results,yearStats:Array.from({length:8},(_,i)=>[2019+i,0,0,0,0,0,0,0,0,0]),updated:'2026-11-07',range:'2019–2026',aliases:{'MOR-C220001':['Syntetisk Gammelt Etternavn']},redirects:{'MOR-OLD2201':'MOR-C220001'},teamResults:[]};
}
const meta={dataVersion:2,manifestSha256:'a'.repeat(64),historySha256:'b'.repeat(64)};
module.exports={history,meta};
