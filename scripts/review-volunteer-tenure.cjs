// Reproducible source renders and CI review artifacts, never a public gallery.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHarness}=require('./diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),base='0d11b368b6ea2866613816903fe41d34e7bac4b1';
async function review(out=path.join(os.tmpdir(),'morothon-dugnadsmerker')){
 await fs.mkdir(out,{recursive:true});const h=await createHarness(),checks=[],errors=[];
 try{
  for(const version of ['before','after'])for(const width of [390,1440]){
   const p=await h.browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1.5});
   p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   try{
    if(version==='before')for(const file of ['js/honors.js','js/honors-data.js','css/honors.css','data/honors.json','data/volunteers.json'])await p.route('**/'+file,r=>r.fulfill({body:execFileSync('git',['show',base+':'+file],{cwd:root}),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/json'}));
    await p.goto(h.base+'/heder.html');await p.locator('[data-honoree="jon-fjeld"]').waitFor();
    await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
    await p.locator('#volunteers').screenshot({path:path.join(out,`dugnadsheltene-${version}-${width}.png`)});
    const state=await p.evaluate(()=>({people:document.querySelectorAll('[data-honoree]').length,overflow:document.documentElement.scrollWidth>innerWidth,robots:document.querySelector('meta[name="robots"]').content,order:[...document.querySelectorAll('#volunteers [data-honoree]')].map(e=>e.dataset.honoree),provisional:[...document.querySelectorAll('.honor-provisional')].map(e=>({id:e.closest('[data-honoree]').dataset.honoree,badge:e.dataset.provisionalBadge,basis:e.dataset.basis,text:e.textContent}))}));
    const expectedPeople=await p.evaluate(async()=>(await MorothonHonorsData.load()).groups.flatMap(g=>g.members).length);
    assert.equal(state.people,expectedPeople);assert.equal(state.overflow,false);assert.equal(state.robots,'noindex, nofollow');if(version==='before')assert.equal(state.provisional.length,0);checks.push({version,width,...state});
    if(version==='after'){
     for(const id of ['jon-fjeld','atle-aamodt'])await p.locator(`[data-honoree="${id}"]`).screenshot({path:path.join(out,`${id}-${width}.png`)});
     const amounts=await p.evaluate(async()=>{const d=await MorothonHonorsData.load(),h=await MorothonHistoryData.load(),years=[...new Set(h.data.results.filter(r=>MorothonHistoryData.isCompletedResult(r)||['DNF','Deltatt'].includes(MorothonHistoryData.effectiveStatus(r))).map(r=>r[0]))];return ['jon-fjeld','rune-bergjord','per-sangvik','tom-lohne','birgitte-aamodt','johannes-aamodt','atle-aamodt'].map(id=>({id,...MorothonHonorsData.provisionalMilestone(d,MorothonHonorsData.findIn(d,id).member,years)}));});
     checks.push({width,amounts});
    }
   }finally{await p.close();}
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'kontroll.json'),JSON.stringify({base,checks,errors},null,2)+'\n');
  const image=(file,label)=>`<figure><figcaption>${label}</figcaption><a href="${file}"><img src="${file}" alt="${label}"></a></figure>`;
  let body='<h1>Dugnadsheltene · fartstid og mulige merker</h1><p>Foreløpige anslag – ingen tildelinger eller aktiv diplomutstedelse. Faktiske skjermbilder fra kildekoden.</p>';
  for(const width of [390,1440])body+=`<h2>${width} px</h2><div class="grid">${image(`dugnadsheltene-before-${width}.png`,'Før')}${image(`dugnadsheltene-after-${width}.png`,'Etter')}</div>`;
  body+='<h2>Jon og Atle</h2><div class="grid">'+image('jon-fjeld-390.png','Jon · start 2014')+image('atle-aamodt-390.png','Atle · start 2021, fravær 2026')+'</div><p><a href="kontroll.json">Beregninger og kontrollmålinger</a></p>';
  await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dugnadsmerker · gjennomgang</title><style>body{max-width:1400px;margin:30px auto;padding:0 20px;background:#f6f3e9;color:#12343e;font:16px/1.6 Arial}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:auto}a{color:inherit}h1,h2,p{text-align:center}@media(max-width:650px){.grid{grid-template-columns:1fr}}</style>${body}</html>`);
  console.log(JSON.stringify({out,checks:checks.length,errors}));
 }finally{await h.close();}
}
module.exports={review};
if(require.main===module)review(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
