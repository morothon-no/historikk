// Explicit public test inventory. Source tests are discovered only in the trusted source checkout.
const levels=['quick','functional','visual','full'];
const publicGroups={
 quick:['tests/data-quality.cjs','tests/public-build.cjs','tests/test-planning.cjs','tests/loyalty-v32.cjs'],
 functional:['tests/public-modules.cjs','tests/data-quality-browser.cjs','tests/regression.cjs'],
 visual:['tests/regression-visual.cjs','tests/loyalty-visual.cjs','tests/site-build.cjs','tests/public-browser.cjs','tests/public-pdf.cjs']
};
const sourceVisual=['tests/honor-card-collections.cjs','tests/honors-visibility.cjs','tests/quality-v32.cjs'];
function publicFiles(level){
 const n=levels.indexOf(level);if(n<0)throw Error('Unknown test level');
 return Object.entries(publicGroups).flatMap(([name,files])=>levels.indexOf(name)<=n?files:[]);
}
function sourceFiles(level,all){
 if(!levels.includes(level))throw Error('Unknown test level');
 if(level==='full'){const pub=new Set(publicFiles('full'));return all.filter(f=>!pub.has(f));}
 return level==='visual'?sourceVisual:[];
}
function requirements(level,scope){
 if(!levels.includes(level)||!['public','source'].includes(scope))throw Error('Unknown test requirements');
 const browser=scope==='public'?level!=='quick':['visual','full'].includes(level);
 return {browser,pdf:scope==='public'?['visual','full'].includes(level):level==='full',python:scope==='source'&&level==='full'};
}
module.exports={levels,publicGroups,publicFiles,sourceFiles,requirements};
