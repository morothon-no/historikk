// Provider-independent authorization. Audit subjects are internal user IDs.
'use strict';
const denied=(message,status=403)=>Object.assign(Error(message),{status});
function membershipPrincipal(user,memberships){
 if(!user||user.active!==true||typeof user.userId!=='string')throw denied('Logg inn for å fortsette.',401);
 const permissions={owner:['review','approve'],editor:['review'],viewer:['review']},organizers={},roles={};
 for(const m of memberships.filter(m=>m.userId===user.userId&&m.active===true)){
  if(!Object.hasOwn(permissions,m.role)||!/^[a-z][a-z0-9-]{1,62}$/.test(m.organizerId)||Object.hasOwn(roles,m.organizerId))throw denied('Ugyldig arrangørtilgang.');
  organizers[m.organizerId]=permissions[m.role];roles[m.organizerId]=m.role;
 }
 return {subject:user.userId,organizers,roles};
}
function authorize(principal,organizer,action){
 const role=principal?.roles?.[organizer];
 if(!role||!({read:['owner','editor','viewer'],write:['owner','editor'],approve:['owner']}[action]||[]).includes(role))throw denied('Ingen tilgang til denne arrangørhandlingen.');
 return principal;
}
module.exports={membershipPrincipal,authorize,denied};
