'use strict';
const {ADMIN,run}=require('./common.cjs');
function api(endpoint){
 try{return JSON.parse(run('gh',['api',endpoint,'--method','GET']));}
 catch(e){const message=String(e.stderr||e.message);throw Error(/Forbidden/.test(message)?'GitHub API Forbidden: visibility and permissions are not verified':'GitHub API unavailable or access denied');}
}
async function privateRepository({request=api,requirePush=true}={}){
 const repo=await request('repos/'+ADMIN);
 if(repo.full_name!==ADMIN||repo.private!==true||repo.visibility!=='private'||repo.archived||repo.disabled||requirePush&&repo.permissions?.push!==true)throw Error('Private repository identity, visibility and required access could not be verified');
 return {repository:ADMIN,private:true,permissions:repo.permissions||{}};
}
module.exports={api,privateRepository};
if(require.main===module)privateRepository({requirePush:false}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
