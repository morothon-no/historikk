// Opaque server-side sessions. Authentication providers cannot grant roles.
'use strict';
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {membershipPrincipal,denied}=require('./access-control.cjs');
const token=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('base64url');
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(p=>p.length===2));
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookie=(name,value,seconds)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+seconds;
function createSessionAuth({origin,accounts,clock=Date.now}){
 if(new URL(origin).protocol!=='https:'||new URL(origin).origin!==origin||!accounts?.user||!accounts?.memberships)throw Error('HTTPS-adresse og internt kontoregister kreves.');
 const SID='__Host-morothon-admin',sessions=new Map(),idle=30*60*1000,lifetime=8*60*60*1000;
 function sweep(){for(const [key,s]of sessions)if(s.expires<=clock()||s.touched+idle<=clock())sessions.delete(key);}
 function issue(req,userId){
  sweep();const user=accounts.user(userId);if(!user?.active)throw denied('Ingen aktiv intern bruker.');
  if(sessions.size>=128)throw denied('For mange aktive økter. Prøv senere.',429);
  const raw=token();sessions.set(hash(raw),{userId,csrf:token(),touched:clock(),expires:clock()+lifetime});
  const old=cookies(req)[SID];if(old)sessions.delete(hash(old));return cookie(SID,raw,lifetime/1000);
 }
 function authenticate(req){
  sweep();const raw=cookies(req)[SID],session=raw&&sessions.get(hash(raw));if(!session)throw denied('Logg inn for å fortsette.',401);
  const principal=membershipPrincipal(accounts.user(session.userId),accounts.memberships(session.userId));session.touched=clock();return {...principal,csrf:session.csrf};
 }
 function csrf(req,principal){if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'||!same(req.headers['x-morothon-csrf'],principal.csrf))throw denied('Forespørselen må komme fra din innloggede adminøkt.');}
 function logout(req){const raw=cookies(req)[SID];if(raw)sessions.delete(hash(raw));return cookie(SID,'',0);}
 return {issue,authenticate,csrf,logout};
}
module.exports={createSessionAuth,cookie,cookies,hash,same,token};
