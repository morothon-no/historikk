// Run again immediately before artifact upload/deploy; never changes source data.
const path=require('node:path');
const {validatePublicSite}=require('./build-site.cjs');
validatePublicSite(path.resolve(process.argv[2]||'_site')).then(result=>console.log(JSON.stringify({publicExport:'valid',...result}))).catch(error=>{console.error(error.message);process.exitCode=1;});
