// Explicit QA fixture, never written to the personal/history registers.
const cases=[
 {key:'2023',id:'dag-morten-frantzen',name:'Dag Morten Frantzen',date:'Søgne, 11. november 2023'},
 {key:'historisk-2010',id:'dag-morten-frantzen',name:'Historisk kontrollprofil',date:'Søgne, november 2010',historical:true},
 {key:'einar',id:'einar-danielsen',name:'Einar Danielsen',date:''}
];
function historicalFixture(core){
 const data=structuredClone(core),m=data.groups.flatMap(g=>g.members).find(m=>m.id==='dag-morten-frantzen');
 m.name='Historisk kontrollprofil';
 m.contribution={confirmedYears:Array.from({length:15},(_,i)=>1996+i),sourceIds:m.contribution.sourceIds};
 // This synthetic 15-edition profile cannot inherit the real person's reviewed
 // 10-edition presentation permission. It remains a visibly marked QA draft.
 data.presentationPrintSet.entries=data.presentationPrintSet.entries.filter(e=>e.personId!==m.id);
 return data;
}
module.exports={cases,historicalFixture};
