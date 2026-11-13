// Generic preparation tools only. Never import administrative records at module load.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const ADMIN='morothon-no/historikk-admin',PUBLIC='morothon-no/historikk';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString());
const bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
function run(command,args,options={}){return execFileSync(command,args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:256*1024*1024,...options});}
function git(root,args){return run('git',['-c','core.hooksPath=/dev/null','-C',root,...args]).trim();}
function relative(p){if(typeof p!=='string'||!p||/[\\:\x00-\x1f\x7f]/.test(p)||path.posix.isAbsolute(p)||p.split('/').some(s=>!s||s==='.'||s==='..'||s==='.git'))throw Error('Unsafe relative path');return p;}
function separate(a,b){a=path.resolve(a);b=path.resolve(b);if(a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep))throw Error('Source and destination must be separate');}
async function directory(root){const s=await fs.lstat(root);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Expected a real directory');if(await fs.realpath(root)!==path.resolve(root))throw Error('Symlink ancestor is not allowed');}
async function read(root,file){relative(file);await directory(root);let current=root;for(const part of file.split('/')){current=path.join(current,part);if((await fs.lstat(current)).isSymbolicLink())throw Error('Symlink is not allowed');}const s=await fs.stat(current);if(!s.isFile())throw Error('Expected a regular file');return fs.readFile(current);}
async function files(root){await directory(root);const found=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(dir===root&&e.name==='.git')continue;const name=path.relative(root,path.join(dir,e.name)).split(path.sep).join('/');relative(name);if(e.isSymbolicLink())throw Error('Symlink is not allowed');if(e.isDirectory())await walk(path.join(dir,e.name));else if(e.isFile())found.push(name);else throw Error('Special file is not allowed');}}await walk(root);return found.sort();}
async function inventory(root){const result={};for(const file of await files(root)){const b=await read(root,file),s=await fs.stat(path.join(root,file));result[file]={sha256:sha(b),bytes:b.length,executable:!!(s.mode&0o111)};}return result;}
async function writeNew(file,b){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});await fs.writeFile(file,b,{flag:'wx',mode:0o600});}
async function empty(dir){await fs.mkdir(dir,{mode:0o700});await directory(dir);}
function approval(record,operation,binding){
 if(!record||record.schemaVersion!==1||record.status!=='approved'||typeof record.approvedBy!=='string'||!record.approvedBy.trim()||!/^\d{4}-\d{2}-\d{2}T/.test(record.approvedAt||'')||!Number.isFinite(Date.parse(record.approvedAt))||!Array.isArray(record.operations)||!record.operations.includes(operation)||!isDeepStrictEqual(record.binding,binding))throw Error('Explicit owner approval of this operation and exact binding is required');
}
function remote(root,repo){if(![`https://github.com/${repo}.git`,`https://github.com/${repo}`].includes(git(root,['remote','get-url','origin'])))throw Error('Unexpected repository origin');}
function pinned(root,commit){if(!/^[a-f0-9]{40}$/.test(commit||'')||git(root,['rev-parse','HEAD'])!==commit||git(root,['status','--porcelain','--untracked-files=all']))throw Error('A clean checkout at the approved exact commit is required');}
module.exports={ADMIN,PUBLIC,sha,json,bytes,run,git,relative,separate,directory,read,files,inventory,writeNew,empty,approval,remote,pinned,isDeepStrictEqual};
