'use strict';
const {ADMIN,PUBLIC,run}=require('./common.cjs');
function api(endpoint,method='GET',body){
 try{return JSON.parse(run('gh',['api',endpoint,'--method',method,...(body?['--input','-']:[])],{input:body?JSON.stringify(body):undefined}));}
 catch(e){const message=String(e.stderr||e.message);const error=Error(/Forbidden/.test(message)?'GitHub API Forbidden: visibility and permissions are not verified':'GitHub API unavailable or access denied');error.notFound=/HTTP 404/.test(message);throw error;}
}
async function privateRepository({create=false,request=api,requirePush=true}={}){
 let repo;try{repo=await request('repos/'+ADMIN);}catch(e){if(!create||!e.notFound)throw e;await request('orgs/morothon-no/repos','POST',{name:'historikk-admin',private:true,auto_init:false,description:'Private administrative registers and controlled Morothon exports'});repo=await request('repos/'+ADMIN);}
 if(repo.full_name!==ADMIN||repo.private!==true||repo.visibility!=='private'||repo.archived||repo.disabled||requirePush&&repo.permissions?.push!==true)throw Error('Private repository identity, visibility and required access could not be verified');
 return {repository:ADMIN,private:true,permissions:repo.permissions||{}};
}
async function inspect({create=false,request=api}={}){
 const result=await privateRepository({create,request,requirePush:false});result.settings={};
 for(const [label,endpoint]of Object.entries({mainRules:`repos/${ADMIN}/rulesets`,branchProtection:`repos/${ADMIN}/branches/main/protection`,actions:`repos/${ADMIN}/actions/permissions`,collaborators:`repos/${ADMIN}/collaborators`,publicRules:`repos/${PUBLIC}/rulesets`,publicProtection:`repos/${PUBLIC}/branches/main/protection`,organization:`orgs/morothon-no`})){
  try{const value=await request(endpoint);result.settings[label]={verified:true,...(Array.isArray(value)?{entries:value.length}:{enabled:!!value.enabled,enforceAdmins:!!value.enforce_admins?.enabled,defaultRepositoryPermission:value.default_repository_permission||null})};}catch{result.settings[label]={verified:false};}
 }
 return result; // Private report: never upload this to public CI or PR comments.
}
module.exports={api,privateRepository,inspect};
if(require.main===module)inspect({create:process.argv.includes('--create')}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
