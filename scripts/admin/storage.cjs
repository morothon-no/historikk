// Local storage is the default; GitHub verification is an optional hosting adapter.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const C=require('./common.cjs');
function destination(c){
 if(c.storage?.type==='local-directory')return 'local:'+path.resolve(c.adminRoot);
 if(c.storage?.type==='github'&&c.repository===C.ADMIN)return C.ADMIN;
 throw Error('Choose an explicit local-directory or verified GitHub storage adapter');
}
async function verifyStorage(c,{requirePush=false}={}){
 const id=destination(c);C.separate(c.publicRoot,c.adminRoot);await C.directory(c.adminRoot);
 if(c.storage.type==='github'){
  C.remote(c.adminRoot,C.ADMIN);await require('./repository.cjs').privateRepository({requirePush});return {destination:id,type:'github'};
 }
 if((await fs.stat(c.adminRoot)).mode&0o077)throw Error('Local administrative directory must be private (0700)');
 let top;try{top=C.git(c.adminRoot,['rev-parse','--show-toplevel']);}catch(e){
  try{await fs.lstat(path.join(c.adminRoot,'.git'));throw Error('Administrative Git metadata is invalid');}catch(s){if(s.code!=='ENOENT')throw s;}
 }
 if(top&&C.git(top,['remote']))throw Error('Local storage must not bypass hosting visibility checks for a Git remote');
 return {destination:id,type:'local-directory'};
}
async function privateWorkspace(root){
 await fs.mkdir(root,{recursive:true,mode:0o700});await C.directory(root);
 if((await fs.stat(root)).mode&0o077)throw Error('Runtime workspace must be private (0700)');
 let top;try{top=C.git(root,['rev-parse','--show-toplevel']);}catch{}
 if(top)throw Error('Runtime data must stay outside Git worktrees');
}
module.exports={destination,verifyStorage,privateWorkspace};
