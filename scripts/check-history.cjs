// Read-only quality report; never changes a source or approves a correction.
const fs=require('node:fs'),path=require('node:path');
const {validate}=require('../js/history-data.js');
try{
 const data=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]||'public-data/data/history.json'),'utf8'));
 const report=validate(data);
 console.log(JSON.stringify({valid:report.errors.length===0,people:data.people?.length,results:data.results?.length,...report},null,2));
 if(report.errors.length)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
