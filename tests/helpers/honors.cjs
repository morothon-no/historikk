const fs=require('node:fs/promises'),path=require('node:path');
const {mergeVolunteers}=require('../../js/honors-data.js');
async function readHonors(){
 const root=path.resolve(__dirname,'../..'),data=JSON.parse(await fs.readFile(path.join(root,'data/honors.json'),'utf8'));
 return data.volunteerList?mergeVolunteers(data,JSON.parse(await fs.readFile(path.join(root,data.volunteerList),'utf8'))):data;
}
module.exports={readHonors};
