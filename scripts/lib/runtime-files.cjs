// Explicit public runtime files. No source-register discovery.
const BRAND_ASSETS=['assets/social/morothon-og.png','assets/icons/favicon-16.png','assets/icons/favicon-32.png','assets/icons/apple-touch-icon.png','assets/icons/favicon.ico'];
const DATA_NAMES=['history','badges','honors','volunteers','event-dates'];
const ADMIN_SOURCES={
 'admin/index.html':'tools/diploma-admin/index.html',
 'admin/admin.css':'tools/diploma-admin/admin.css',
 'admin/admin.js':'tools/diploma-admin/admin.js',
 'admin/portal.js':'tools/diploma-admin/portal.js',
 'admin/design-model.js':'tools/diploma-admin/design-model.js',
 'admin/design-studio.js':'tools/diploma-admin/design-studio.js',
 'admin/design-studio.css':'tools/diploma-admin/design-studio.css',
 'admin/intake-model.js':'tools/diploma-admin/intake-model.js',
 'admin/intake.js':'tools/diploma-admin/intake.js',
 'admin/intake.css':'tools/diploma-admin/intake.css',
 'admin/portal-data.js':'tools/diploma-admin/portal-data.cjs',
 'admin/diploma-adapter.js':'tools/diploma-admin/engine.js',
 'admin/profile-contract.js':'web-admin/profile-contract.js',
 'admin/web-transport.js':'web-admin/web-transport.js',
 'admin/event-profile.json':'web-admin/event-profile.json'
};
// New administrative code must not become public just by appearing in js/.
const PUBLIC_CODE=['css/diplomas.css','css/navigation.css','css/brag-card.css','css/honors.css',
 'js/compare.js','js/rankings.js','js/loyalty.js','js/brag-card.js','js/honors.js','js/history-data.js',
 'js/navigation.js','js/diplomas.js','js/badges.js','js/honors-data.js','js/progress.js','js/milestones.js',...Object.keys(ADMIN_SOURCES).filter(f=>/\.(css|js)$/.test(f))];
function runtimeFiles(registry){
 const files=['index.html','heder.html',...DATA_NAMES.map(n=>`data/${n}.json`),...BRAND_ASSETS,'assets/fonts/caveat-regular-latin.woff','assets/fonts/OFL-Caveat.txt',...PUBLIC_CODE,...Object.keys(ADMIN_SOURCES).filter(f=>!PUBLIC_CODE.includes(f))];
 const assets=new Set([registry.watermark.src]);
 for(const badge of registry.badges){assets.add(badge.src);if(badge.vectorSource)assets.add(badge.vectorSource);}
 for(const src of assets){
  if(!/^assets\/medals\/(approved|identity|service|watermarks)\/[a-z0-9._-]+$/.test(src))throw Error('Non-runtime asset in public register');
  files.push(src);
 }
 return files.sort();
}
module.exports={BRAND_ASSETS,DATA_NAMES,PUBLIC_CODE,ADMIN_SOURCES,runtimeFiles};
