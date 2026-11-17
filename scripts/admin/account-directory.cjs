// Private bootstrap account registry. No invitation, identity-link or public write API.
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function createAccountDirectory(input){
 const {users,externalIdentities,memberships}=JSON.parse(JSON.stringify(input));
 if(!Array.isArray(users)||!Array.isArray(externalIdentities)||!Array.isArray(memberships))throw Error('Interne brukere, eksterne identiteter og medlemskap må registreres separat.');
 const ids=new Set(),identities=new Map(),membershipIds=new Set();
 for(const user of users){if(!UUID.test(user.userId)||typeof user.active!=='boolean'||ids.has(user.userId))throw Error('Ugyldig eller duplisert intern bruker-ID.');ids.add(user.userId);}
 for(const identity of externalIdentities){
  if(!/^[a-z][a-z0-9-]{1,63}$/.test(identity.provider)||typeof identity.subject!=='string'||!identity.subject||identity.subject.length>200||!ids.has(identity.userId))throw Error('Ugyldig ekstern identitetskobling.');
  const key=JSON.stringify([identity.provider,identity.subject]);if(identities.has(key))throw Error('En ekstern identitet kan bare tilhøre én intern bruker.');identities.set(key,identity.userId);
 }
 for(const m of memberships){const key=JSON.stringify([m.userId,m.organizerId]);if(!ids.has(m.userId)||!['owner','editor','viewer'].includes(m.role)||!/^[a-z][a-z0-9-]{1,62}$/.test(m.organizerId)||typeof m.active!=='boolean'||membershipIds.has(key))throw Error('Ugyldig eller duplisert medlemskap.');membershipIds.add(key);}
 return {
  user(userId){const user=users.find(u=>u.userId===userId);return user?{...user}:null;},
  memberships(userId){return memberships.filter(m=>m.userId===userId).map(m=>({...m}));},
  resolveIdentity(provider,subject){const userId=identities.get(JSON.stringify([provider,subject]));return users.some(u=>u.userId===userId&&u.active)?userId:null;}
 };
}
module.exports={createAccountDirectory};
