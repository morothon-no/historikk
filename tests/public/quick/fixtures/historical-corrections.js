// Organizer-approved result changes, November 2026. No identity changes.
// Full row values guard against selecting a different event/start by accident.
const assert=require('node:assert/strict');
const changes=[
 {before:[1994,'MOR-88334F0','Morothon','18 km','Fullført','02:09.52',45,'','',''],after:[1994,'MOR-88334F0','Morothon','18 km','Fullført','02:09:52',45,'','','']},
 {before:[1998,'MOR-98692D6','Kortmoro','13 km','Fullført','01:06.14',127,'','',''],after:[1998,'MOR-98692D6','Kortmoro','13 km','Fullført','01:06:14',127,'','','']},
 ...[2012,2013].map(year=>({before:[year,'MOR-15AF3A3','Historisk tillegg','Ukjent','Deltatt','','','','',''],after:[year,'MOR-15AF3A3','Kortmoro','13 km','Deltatt','','','','','']}))
];
function previousHistory(data){
 const previous=structuredClone(data);
 for(const change of changes){const indexes=previous.results.flatMap((r,i)=>JSON.stringify(r)===JSON.stringify(change.after)?[i]:[]);assert.equal(indexes.length,1,'Expected exactly one documented corrected row');previous.results[indexes[0]]=[...change.before];}
 return previous;
}
module.exports={changes,previousHistory,previousSha256:'dcf4518e6e20f5f2919cb501cd7ef02123329ce418be228eba8b36170c57fce7'};
