// Build a data-only release from a server-verified correction candidate.
'use strict';
const {approvalFor,entry}=require('../lib/public-package.cjs');
const {validatePublicData}=require('../lib/public-schema.cjs');
const D=require('../../tools/diploma-admin/result-release-data.cjs');
const JOURNAL='tests/public/quick/fixtures/result-publications.json';
const PATHS=['data/history.json','public-data/data/history.json','public-data/manifest.json','.github/public-data-approval.json',JOURNAL];
function releaseFiles({files,after},append=D.appendPublication){
 const canonical=files.get('data/history.json'),publicHistory=files.get('public-data/data/history.json');
 if(!canonical?.equals(publicHistory))throw Error('Kanonisk kilde og offentlig historikk er ulike. Publisering er stoppet.');
 const oldManifest=JSON.parse(files.get('public-data/manifest.json')),oldApproval=JSON.parse(files.get('.github/public-data-approval.json'));
 if(D.hash(files.get('public-data/manifest.json'))!==oldApproval.manifestSha256||D.hash(canonical)!==oldManifest.historySha256)throw Error('Kildepakken stemmer ikke med godkjenningen.');
 validatePublicData('history',after);
 const bytes=D.encode(after),manifest={...oldManifest,dataVersion:oldManifest.dataVersion+1,historySha256:D.hash(bytes),files:{...oldManifest.files,'data/history.json':entry(bytes)}};
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),approval=approvalFor(manifestBytes),journal=JSON.parse(files.get(JOURNAL));
 const appended=append(canonical,after,journal,{manifestSha256:approval.manifestSha256,dataVersion:approval.dataVersion});
 const output=new Map([['data/history.json',appended.bytes],['public-data/data/history.json',appended.bytes],['public-data/manifest.json',manifestBytes],['.github/public-data-approval.json',Buffer.from(JSON.stringify(approval,null,2)+'\n')],[JOURNAL,Buffer.from(JSON.stringify(appended.journal,null,2)+'\n')]]);
 return {files:output,approval,changes:appended.changes,history:after};
}
function backupFiles(files){const backup=Object.fromEntries(PATHS.map(p=>{const bytes=files.get(p);if(!Buffer.isBuffer(bytes))throw Error('Mangler sikkerhetskopigrunnlag.');return [p,{sha256:D.hash(bytes),base64:bytes.toString('base64')}];}));return backup;}
function restoreFiles(backup){
 if(Object.keys(backup).sort().join('|')!==PATHS.slice().sort().join('|'))throw Error('Ufullstendig publiseringsbackup.');
 return new Map(PATHS.map(p=>{const b=Buffer.from(backup[p].base64,'base64');if(D.hash(b)!==backup[p].sha256)throw Error('Sikkerhetskopiens kontrollsum stemmer ikke.');return [p,b];}));
}
module.exports={JOURNAL,PATHS,releaseFiles,backupFiles,restoreFiles};
