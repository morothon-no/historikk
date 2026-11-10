// Test/review only: reproduce the organizer's Chrome/Windows numeric font metrics.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function installMetricFont(page,{natural=false,extraCss='',scriptSource}={}){
 const [font,css]=await Promise.all([fs.readFile(path.join(root,'tests/fixtures/diploma-font/numeric-overhang.woff')),fs.readFile(path.join(root,'css/diplomas.css'),'utf8')]);
 await page.route('**/__morothon_numeric_font.woff',r=>r.fulfill({body:font,contentType:'font/woff',headers:{'Access-Control-Allow-Origin':'*'}}));
 const metrics=natural?'':'ascent-override:110%;descent-override:31%;line-gap-override:0%;';
 await page.route('**/css/diplomas.css',r=>r.fulfill({body:css+`\n@font-face{font-family:"Morothon Layout Regression";src:url("/__morothon_numeric_font.woff") format("woff");font-weight:800;${metrics}}.diploma-metric strong{font-family:"Morothon Layout Regression"}\n`+extraCss,contentType:'text/css'}));
 if(scriptSource)await page.route('**/js/diplomas.js',r=>r.fulfill({body:scriptSource,contentType:'text/javascript'}));
}
module.exports={installMetricFont};
