// The exact historical oracle remains frozen; later separately approved data
// releases must be checked as live data, not mistaken for historical damage.
const fs=require('node:fs'),path=require('node:path'),D=require('../../../../tools/diploma-admin/result-release-data.cjs');
module.exports=root=>JSON.parse(D.undoPublishedResults(fs.readFileSync(path.join(root,'public-data/data/history.json')),
 JSON.parse(fs.readFileSync(path.join(root,'tests/public/quick/fixtures/result-publications.json')))));
