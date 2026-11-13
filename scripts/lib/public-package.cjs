// Public package verification. This module never discovers or reads original registers.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {validatePublicData}=require('./public-schema.cjs');
const {DATA_NAMES,PUBLIC_CODE,runtimeFiles}=require('./runtime-files.cjs');
const POLICY='morothon-public-v1',DATA_FILES=DATA_NAMES.map(n=>'data/'+n+'.json').sort();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const entry=bytes=>({sha256:sha256(bytes),bytes:bytes.length});
function keys(value,expected,label){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...expected].sort().join('|'))throw Error('Unknown or missing '+label+' fields');}
function version(v){if(!Number.isSafeInteger(v)||v<1)throw Error('Invalid public data version');}
function validateApproval(a){
 keys(a,['schemaVersion','policyVersion','dataVersion','manifestSha256','historySha256'],'approval');
 if(a.schemaVersion!==1||a.policyVersion!==POLICY)throw Error('Unsupported public approval contract');version(a.dataVersion);
 for(const k of ['manifestSha256','historySha256'])if(!/^[a-f0-9]{64}$/.test(a[k]))throw Error('Invalid public approval hash');return a;
}
async function safeRead(root,relative){
 root=path.resolve(root);if(!/^[a-zA-Z0-9/._-]+$/.test(relative)||relative.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe public file path');
 let current=root;const first=await fs.lstat(root);if(first.isSymbolicLink()||!first.isDirectory())throw Error('Symlink or invalid public root');
 const parts=relative.split('/');for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);const s=await fs.lstat(current);if(s.isSymbolicLink())throw Error('Symlink in public package');if(i===parts.length-1?!s.isFile():!s.isDirectory())throw Error('Invalid public file');}
 return fs.readFile(current);
}
async function inventory(root){const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink in public package');if(e.isDirectory())await walk(full);else if(e.isFile())files.push(path.relative(root,full).split(path.sep).join('/'));else throw Error('Invalid public file');}}await walk(root);return files.sort();}
function manifestFor(dataBytes,assetBytes,dataVersion){
 version(dataVersion);return {schemaVersion:1,policyVersion:POLICY,dataVersion,historySha256:sha256(dataBytes.get('data/history.json')),
  files:Object.fromEntries([...dataBytes].sort(([a],[b])=>(a<b?-1:a>b?1:0)).map(([f,b])=>[f,entry(b)])),
  assets:Object.fromEntries([...assetBytes].sort(([a],[b])=>(a<b?-1:a>b?1:0)).map(([f,b])=>[f,entry(b)]))};
}
function approvalFor(manifestBytes){const m=JSON.parse(manifestBytes);return {schemaVersion:1,policyVersion:POLICY,dataVersion:m.dataVersion,manifestSha256:sha256(manifestBytes),historySha256:m.historySha256};}
async function readApprovedPackage(root,{approval,approvalFile,assetsRoot,site=false}={}){
 const trusted=validateApproval(approval||JSON.parse(await fs.readFile(approvalFile,'utf8')));
 const manifestBytes=await safeRead(root,site?'public-manifest.json':'manifest.json');
 if(sha256(manifestBytes)!==trusted.manifestSha256)throw Error('Public manifest is not approved or has changed');
 const manifest=JSON.parse(manifestBytes);
 keys(manifest,['schemaVersion','policyVersion','dataVersion','historySha256','files','assets'],'manifest');
 if(manifest.schemaVersion!==1||manifest.policyVersion!==POLICY)throw Error('Unsupported public package contract');version(manifest.dataVersion);
 if(manifest.dataVersion!==trusted.dataVersion||manifest.historySha256!==trusted.historySha256)throw Error('Public data version/history does not match approval');
 keys(manifest.files,DATA_FILES,'data file list');
 const data={},bytes=new Map();
 for(const file of DATA_FILES){
  const expected=manifest.files[file];keys(expected,['sha256','bytes'],'file digest');
  const actual=await safeRead(root,file);if(expected.sha256!==sha256(actual)||expected.bytes!==actual.length)throw Error('Changed public data file: '+file);
  const name=file.slice(5,-5);data[name]=validatePublicData(name,JSON.parse(actual));bytes.set(file,actual);
 }
 if(sha256(bytes.get('data/history.json'))!==manifest.historySha256)throw Error('Mismatched public history');
 const required=(value,fields,label)=>{for(const field of fields)if(value[field]===undefined)throw Error('Missing public data field: '+label+'.'+field);};
 for(const [name,fields]of Object.entries({honors:['contentVersion','groups','sources','awardPolicy','personDetails','presentationPrintSet','diplomaTexts','narrative','displayOrder','featuredIds','founderSpotlightIds','diplomaExamples','diplomaApprovals','retiredProfiles'],volunteers:['people','sources','sourceIds'],history:['people','results','yearStats','aliases','redirects','teamResults','updated','range'],badges:['minimumDpi','badges','watermark'], 'event-dates':['dates','source']}))required(data[name],fields,name);
 if(!data.honors.contentVersion||data.badges.minimumDpi<300)throw Error('Invalid public content or quality policy');
 required(data.honors.presentationPrintSet,['id','scope','sourceIds','editionYears','entries'],'presentationPrintSet');
 required(data.badges.watermark,['src','sha256','widthMm','heightMm','printReady'],'watermark');
 for(const badge of data.badges.badges){required(badge,['id','kind','name','color','src','status','widthMm','heightMm','cropReviewed','reviewedSha256'],'badge');if(badge.printApproval)required(badge,['printReady'],'badge approval');}
 if(data.honors.volunteerList!=='data/volunteers.json')throw Error('Unexpected public volunteer path');
 const assets=runtimeFiles(data.badges).filter(f=>f.startsWith('assets/'));keys(manifest.assets,assets,'asset list');
 const assetBytes=new Map();
 for(const file of assets){const digest=manifest.assets[file];keys(digest,['sha256','bytes'],'asset digest');if(!/^[a-f0-9]{64}$/.test(digest.sha256)||!Number.isSafeInteger(digest.bytes)||digest.bytes<1)throw Error('Invalid public asset digest');if(assetsRoot){const actual=await safeRead(assetsRoot,file);if(sha256(actual)!==digest.sha256||actual.length!==digest.bytes)throw Error('Changed public asset: '+file);assetBytes.set(file,actual);}}
 const found=await inventory(path.resolve(root)),expected=site?[...runtimeFiles(data.badges),'public-manifest.json','build-info.json'].sort():[...DATA_FILES,'manifest.json'].sort();
 if(found.join('|')!==expected.join('|'))throw Error('Unexpected or missing file in public package');
 if(site){
  const info=validatePublicData('build-info',JSON.parse(await safeRead(root,'build-info.json')));keys(info.assets,PUBLIC_CODE,'runtime URL list');
  for(const file of PUBLIC_CODE)if(info.assets[file]!==file+'?v='+info.version)throw Error('Invalid public runtime URL');
  const url=new URL(info.siteUrl);if(url.protocol!=='https:'||url.username||url.password||!url.pathname.endsWith('/'))throw Error('Invalid public site URL');
 }
 return {data,bytes,assetBytes,manifest,manifestBytes,approval:trusted,visiblePeople:data.honors.groups.reduce((n,g)=>n+g.members.length,0)+data.volunteers.people.filter(p=>p.id).length};
}
module.exports={POLICY,DATA_FILES,sha256,entry,validateApproval,safeRead,inventory,manifestFor,approvalFor,readApprovedPackage};
