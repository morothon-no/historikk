const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');const {createHarness}=require('../scripts/diploma-harness.cjs');
const root=path.resolve(__dirname,'..'),read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));const sha=b=>createHash('sha256').update(b).digest('hex');

test('cutouts preserve native source RGB exactly; transparent background and existing four approved files stay separate',async()=>{
 const manifest=await read('assets/medals/review/cutouts/manifest.json'),reg=await read('data/badges.json');
 assert.equal(manifest.cutouts.length,7);
 // Pillow is used here only for independent decoded-pixel verification, not to produce the cutout.
 const verified=JSON.parse(execFileSync('python',['-c',`from PIL import Image
from pathlib import Path
import json
r=Path.cwd();m=json.load(open('assets/medals/review/cutouts/manifest.json'));result=[]
for c in m['cutouts']:
 a=Image.open(r/c['source']).convert('RGB');b=Image.open(r/c['src']).convert('RGBA');alpha=b.getchannel('A');result.append({'id':c['id'],'sameSize':a.size==b.size,'sameRGB':a.tobytes()==b.convert('RGB').tobytes(),'alpha':alpha.getextrema(),'transparentCorners':all(b.getpixel(p)[3]==0 for p in [(0,0),(b.width-1,0),(0,b.height-1),(b.width-1,b.height-1)])})
print(json.dumps(result))`],{cwd:root,encoding:'utf8'}));
 for(const v of verified){assert.equal(v.sameSize,true);assert.equal(v.sameRGB,true);assert.deepEqual(v.alpha,[0,255]);assert.equal(v.transparentCorners,true);}
 for(const c of manifest.cutouts){
  const b=reg.badges.find(b=>b.id===c.id);assert.equal(sha(await fs.readFile(path.join(root,c.src))),c.sha256);
  assert.equal(b.controlledCutoutDraft.src,c.src);assert.equal(b.controlledCutoutDraft.sha256,c.sha256);assert.equal(b.printReady,true);assert.equal(c.printReady,false);assert.notEqual(b.src,c.src);assert.equal(sha(await fs.readFile(path.join(root,b.src))),c.sha256);assert.equal(b.printApproval.sha256,c.sha256);
 }
 assert.deepEqual(reg.badges.filter(b=>b.kind==='participation'&&b.printReady).map(b=>b.n),[5,10,15,20,25,30,35,40,45,50]);
});

test('native-motif DPI cannot be inflated by transparent padding or resolution of the surrounding photo',async()=>{
 const {medals}=await read('assets/medals/review/cutouts/proof-quality.json');assert.equal(medals.length,11);
 for(const r of medals){const span=Math.max(r.bounds[2]-r.bounds[0],r.bounds[3]-r.bounds[1]);assert.equal(span,r.longestVisiblePixels);assert.ok(Math.abs(r.effectiveDpiAt55-span/55*25.4)<1e-8);assert.equal(r.medalSizeMm,55);assert.equal(r.resized,false);assert.equal(r.generatedMotif,false);}
 for(const n of [5,10,15,20,25,30]){const r=medals.find(r=>r.id===`badge-${n}`);assert.ok(r.effectiveDpiAt55<200);assert.equal(r.printReady,false);}
 const record=medals.find(r=>r.id==='record');assert.ok(record.effectiveDpiAt55>295&&record.effectiveDpiAt55<300);assert.equal(record.printReady,false);
 for(const n of [35,40,45,50]){const r=medals.find(r=>r.id===`badge-${n}`);assert.equal(r.visibleEdgePixels,0);assert.ok(r.effectiveDpiAt55>=300);assert.equal(r.printReady,true);}
});

test('A4 proof is one physical A4 page; all 11 visible medal bounds are exactly 55 mm',async()=>{
 const tmp=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'morothon-proof-test-'));
 execFileSync(process.execPath,['scripts/review-medal-cutouts.cjs',tmp,'--no-save-project-report'],{cwd:root,maxBuffer:1024*1024});
 const h=await createHarness();try{
  const source=await fs.readFile(path.join(root,'scripts/review-medal-cutouts.cjs'),'utf8');assert.ok(source.includes('data-visible-mm="55"'));
  const report=await read('assets/medals/review/cutouts/proof-quality.json');const p=await h.browser.newPage();await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  const html=await fs.readFile(path.join(tmp,'A4-testark.html'),'utf8');
  await p.route(h.base+'/proof',route=>route.fulfill({contentType:'text/html',body:html}));await p.goto(h.base+'/proof');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const actual=await p.evaluate(rows=>{
   const page=document.querySelector('.sheet').getBoundingClientRect();
   return {page:[page.width,page.height],medals:rows.map(r=>{
    const stage=document.querySelector(`[data-id="${r.id}"]`),im=stage.querySelector('img'),rect=im.getBoundingClientRect(),box=stage.getBoundingClientRect();
    const long=Math.max((r.bounds[2]-r.bounds[0])*rect.width/r.width,(r.bounds[3]-r.bounds[1])*rect.height/r.height);
    return {long,stage:[box.width,box.height]};
   })};
  },report.medals);
  assert.ok(Math.abs(actual.page[0]-210*96/25.4)<.1);assert.ok(Math.abs(actual.page[1]-297*96/25.4)<.1);
  for(const r of actual.medals){assert.ok(Math.abs(r.long-55*96/25.4)<.1);assert.ok(Math.abs(r.stage[0]-55*96/25.4)<.1);}
  const pdf=await p.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
  const info=execFileSync('pdfinfo',['-'],{input:pdf}).toString();assert.match(info,/Pages:\s+1\b/);assert.match(info,/A4/);
 }finally{await h.close();await fs.rm(tmp,{recursive:true,force:true});}
});
