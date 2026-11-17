// Verify the live release before any job can acquire the status "published".
'use strict';
const {hash}=require('../../tools/diploma-admin/result-release-data.cjs');
function createDeploymentVerifier({fetchImpl=fetch,verifyProfiles}){
 if(typeof verifyProfiles!=='function')throw Error('Faktisk løperprofil må kontrolleres i nettlesermotoren.');
 return async job=>{
  try{
   const base=new URL(job.build.siteUrl);if(base.protocol!=='https:'||!base.pathname.endsWith('/'))throw Error('Ugyldig publiseringsadresse.');
   const files=new Map(),names=Object.keys(job.build.files);
   // Bounded batches avoid flooding the public host with an entire gallery.
   for(let i=0;i<names.length;i+=6)await Promise.all(names.slice(i,i+6).map(async name=>{
    if(!/^[a-zA-Z0-9/._-]+$/.test(name)||name.split('/').includes('..'))throw Error('Uventet publisert fil.');
    const url=new URL(name,base);url.searchParams.set('publication',job.id);
    const r=await fetchImpl(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Publisert fil mangler.');
    const b=Buffer.from(await r.arrayBuffer());if(b.length>16*1024*1024||hash(b)!==job.build.files[name])throw Error('Publisert fil er gammel eller endret.');files.set(name,b);
   }));
   const info=JSON.parse(files.get('build-info.json'));if(info.version!==job.build.version||info.siteUrl!==job.build.siteUrl||hash(files.get('public-manifest.json'))!==job.approval.manifestSha256)throw Error('Publiseringsversjonen stemmer ikke.');
   const history=JSON.parse(files.get('data/history.json'));await verifyProfiles({siteUrl:job.build.siteUrl,files,history,personIds:job.personIds,changes:job.changes});return {files,history};
  }catch(error){throw Object.assign(Error('Offentlig løperprofil eller datapakke er ennå ikke verifisert.',{cause:error}),{pending:true});}
 };
}
module.exports={createDeploymentVerifier};
