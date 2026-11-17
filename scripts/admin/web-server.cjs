// Authenticated web boundary for the existing portal. Publishing is separately configured and owner-only.
'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
const {authorize,denied}=require('./access-control.cjs');
const own=(obj,names)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join('|')===names.slice().sort().join('|');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.ico':'image/x-icon'};
function createWebHandler({auth,review,runtime,publication,healthy=()=>true,clock=Date.now}){
 const limits=new Map();let working=false;
 const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";
 function rate(req){
  const now=clock();for(const [key,v]of limits)if(v.until<=now)limits.delete(key);
  const key=req.socket.remoteAddress||'unknown',old=limits.get(key);
  if(!old){if(limits.size>=1000)throw denied('For mange forespørsler. Prøv senere.',429);limits.set(key,{n:1,until:now+60000});}
  else if(++old.n>120)throw denied('For mange forespørsler. Prøv senere.',429);
 }
 async function body(req){
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw denied('Send JSON fra adminportalen.',415);
  let length=0;const chunks=[];
  for await(const chunk of req){length+=chunk.length;if(length>3*1024*1024)throw denied('Rettelsen er for stor.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw denied('Ugyldig JSON.',400);}
 }
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',csp);res.setHeader('Strict-Transport-Security','max-age=31536000');
  const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const redirect=(location,cookie)=>{res.writeHead(303,{Location:location,...(cookie?{'Set-Cookie':cookie}:{})});res.end();};
  try{
   if(req.headers.host!==new URL(auth.origin).host)throw denied('Ugyldig vertsadresse.');
   const url=new URL(req.url,auth.origin),route=url.pathname;
   if(route.startsWith('/auth/')||route.startsWith('/admin-api/')||route==='/admin-healthz')rate(req);
   if(route==='/admin-healthz'&&req.method==='GET'){const ready=await healthy();return json(ready?200:503,{status:ready?'ok':'unavailable'});}
   if(route==='/auth/github'&&req.method==='GET'){const out=auth.begin();return redirect(out.location,out.cookie);}
   if(route==='/auth/github/callback'&&req.method==='GET'){const out=await auth.complete(req,url.searchParams);return redirect(out.location,out.cookies);}
   if(route==='/admin/login'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Morothon · Logg inn</title><link rel="stylesheet" href="/admin/admin.css"><main class="panel" style="max-width:38rem;margin:10vh auto;padding:2rem"><h1>Morothon administrasjon</h1><p>Logg inn med arrangørens godkjente GitHub-konto.</p><p><a href="/auth/github">Logg inn med GitHub</a></p><p>Rettelser lagres privat. Publisering krever egen godkjenning og aktivert publiseringstjeneste.</p></main></html>');
   }
   if(route.startsWith('/admin-api/')){
    const actor=auth.authenticate(req);authorize(actor,auth.organizerId,'read');
    if(req.method==='GET'&&route==='/admin-api/client.js'){
     res.writeHead(200,{'Content-Type':types['.js']});return res.end(await fs.readFile(path.join(__dirname,'review-client.js')));
    }
    if(req.method==='GET'&&route==='/admin-api/session')return json(200,{userId:actor.subject,organizerId:auth.organizerId,role:actor.roles[auth.organizerId],csrf:actor.csrf,canPublish:!!publication&&actor.roles[auth.organizerId]==='owner'});
    if(req.method==='GET'&&route==='/admin-api/review')return json(200,await review.load({session:req,organizer:auth.organizerId}));
    if(req.method==='GET'&&route==='/admin-api/publication')return json(200,publication?await publication.status({session:req,organizer:auth.organizerId}):{enabled:false,job:null});
    if(req.method!=='POST')throw denied('Handlingen finnes ikke.',404);
    auth.csrf(req,actor);
    if(route==='/admin-api/logout')return redirect('/admin/login',auth.logout(req));
    authorize(actor,auth.organizerId,route.startsWith('/admin-api/publication/')?'publish':route==='/admin-api/review/approve'?'approve':'write');
    const input=await body(req),fixed={session:req,organizer:auth.organizerId};
    const pubAction=/^\/admin-api\/publication\/(prepare|publish|reverse|retry)$/.exec(route);
    if(pubAction){
     if(!publication)throw denied('Publisering krever konfigurert GitHub App og sikker serverdrift.',503);
     const action=pubAction[1],keys=action==='prepare'?['expectedRevision','expectedDigest']:action==='publish'?['id','confirmation']:['id'];
     if(!own(input,keys))throw denied('Uventede publiseringsfelt.',400);
     if(working)throw denied('En annen kontroll pågår.',409);working=true;
     try{return json(200,await publication[action]({...input,...fixed}));}finally{working=false;}
    }
    const action=route==='/admin-api/review/preview'&&own(input,['draft'])?'preview':route==='/admin-api/review/save'&&own(input,['draft','expectedRevision'])?'save':route==='/admin-api/review/approve'&&own(input,['expectedRevision','expectedDigest'])?'approve':null;
    if(action){if(working)throw denied('En annen resultatkontroll pågår. Prøv igjen når den er ferdig.',409);working=true;try{return json(200,await review[action]({...input,...fixed}));}finally{working=false;}}
    throw denied('Ukjent handling eller uventede felt.',400);
   }
   if(req.method!=='GET')throw denied('Handlingen finnes ikke.',404);
   if(route==='/admin')return redirect('/admin/');
   const name=route.slice(1)+(route.endsWith('/')?'index.html':'');let bytes=runtime.files.get(name);
   if(!bytes)throw denied('Siden finnes ikke.',404);
   // Only approved static bytes can ever be served. Source directories are absent.
   if(name==='admin/index.html'){
    try{const actor=auth.authenticate(req);authorize(actor,auth.organizerId,'read');}catch(e){if(e.status===401)return redirect('/admin/login');throw e;}
    bytes=Buffer.from(bytes.toString('utf8').replace('</head>','<script defer src="/admin-api/client.js"></script></head>'));
   }
   res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream'});res.end(bytes);
  }catch(error){
   // Never log OAuth codes, tokens, raw drafts or stack traces to public logs.
   const status=error.status||400;
   json(status,{error:status===500||status===502?'Tjenesten kunne ikke fullføre forespørselen. Prøv igjen.':error.message});
  }
 };
}
module.exports={createWebHandler};
