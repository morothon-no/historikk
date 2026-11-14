const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {approvalFor}=require('../../scripts/lib/public-package.cjs');
const {runtimeFiles}=require('../../scripts/lib/runtime-files.cjs');
const {publicFiles,discoverTests}=require('../../scripts/testing/catalog.cjs');
const root=path.resolve(__dirname,'../..');
async function temp(){return fs.mkdtemp(path.join(os.tmpdir(),'morothon-public-only-'));}
async function copyPublic(out){
 const data=JSON.parse(await fs.readFile(path.join(root,'public-data/data/badges.json'),'utf8'));
 const {extras}=await discoverTests(root);
 const files=[...runtimeFiles(data).filter(f=>!f.startsWith('data/')&&!f.startsWith('admin/')),'package.json','package-lock.json','.github/public-data-approval.json','.github/workflows/pages.yml','scripts/build-site.cjs','scripts/check-public-site.cjs','scripts/check-public-policy.cjs','scripts/lib/public-schema.cjs','scripts/lib/public-package.cjs','scripts/lib/runtime-files.cjs','scripts/diploma-harness.cjs','scripts/review-public-export.cjs',...publicFiles('full',extras),'tests/helpers/public-package.cjs','scripts/testing/catalog.cjs','scripts/testing/plan.cjs','scripts/testing/run.cjs','scripts/check-history.cjs','tests/fixtures/a1c-public-reference.json','scripts/diploma-admin.cjs',...['index.html','admin.css','admin.js','engine.js','worker.cjs','portal.js','portal-data.cjs','api.cjs'].map(f=>'tools/diploma-admin/'+f),...['profile-contract.js','web-transport.js','event-profile.json'].map(f=>'web-admin/'+f)];
 for(const file of files){const dest=path.join(out,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,file),dest);}
 await fs.cp(path.join(root,'public-data'),path.join(out,'public-data'),{recursive:true});
}
async function rewriteManifest(folder,mutate){
 const m=JSON.parse(await fs.readFile(path.join(folder,'public-data/manifest.json'),'utf8'));await mutate(m);
 const b=Buffer.from(JSON.stringify(m,null,2)+'\n');await fs.writeFile(path.join(folder,'public-data/manifest.json'),b);const p=approvalFor(b);await fs.writeFile(path.join(folder,'.github/public-data-approval.json'),JSON.stringify(p,null,2)+'\n');return p;
}
module.exports={temp,copyPublic,rewriteManifest};
