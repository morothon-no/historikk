'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const C=require('./common.cjs');
async function scaffold(out,publicCommit){
 if(!/^[a-f0-9]{40}$/.test(publicCommit||''))throw Error('Pin a reviewed public tools commit');
 const root=path.resolve(__dirname,'../..');C.separate(root,out);await C.empty(out);
 for(const folder of ['data','sources','internal-docs','archive','release-journal','tests','config'])await C.writeNew(path.join(out,folder,'.gitkeep'),Buffer.alloc(0));
 await C.writeNew(path.join(out,'toolchain-lock.json'),C.bytes({schemaVersion:1,publicRepository:C.PUBLIC,publicCommit,enabled:false}));
 await C.writeNew(path.join(out,'.gitignore'),Buffer.from('runtime/\n.env*\n*.key\n*.gpg\n*.zip\ngnupg/\n'));
 await C.writeNew(path.join(out,'README.md'),Buffer.from('# Morothon administrasjon\n\nPrivat repository. Ingen data er importert av denne malen.\n\nVerktøyversjon er låst i toolchain-lock.json. Drift og overtakelse beskrives i docs/a1d-privat-klargjoring.md i det offentlige kode-repositoryet. Bruk beskyttet main og godkjenningsmiljøer før aktivering. Ingen offentlig workflow skal få privat lesetilgang.\n'));
 for(const name of ['private-export.yml','private-backup.yml'])await C.writeNew(path.join(out,'.github/workflows',name),await C.read(root,'ops/admin-templates/'+name));
 return {files:(await C.files(out)).length,containsRegisters:false,enabled:false};
}
module.exports={scaffold};if(require.main===module)scaffold(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
