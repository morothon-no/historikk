// Current approved public design only. Historical galleries remain available in full source review.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {review}=require('../scripts/review-public-export.cjs');
const {buildSite}=require('../scripts/build-site.cjs');
test('B1 current public A4/PDF review preserves both honor variants, embedded handwriting, one-page landscape and draft markings',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-current-pdf-'));
 try{
  const site=process.env.MOROTHON_TEST_SITE||path.join(tmp,'site');if(!process.env.MOROTHON_TEST_SITE)await buildSite(site);
  const out=process.env.MOROTHON_PUBLIC_REVIEW_DIR||path.join(tmp,'review');const result=await review(out,site);assert.equal(result.pdfs,8);assert.deepEqual(result.errors,[]);
  const report=JSON.parse(await fs.readFile(path.join(out,'kontroll.json')));
  for(const check of report.checks.filter(c=>c.id)){
   const file=path.join(out,check.id+'-'+check.display+'.pdf');
   const info=execFileSync('pdfinfo',[file],{encoding:'utf8'});assert.match(info,/Pages:\s+1\b/);
   const size=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);assert.ok(size);assert.ok(Math.abs(Number(size[1])-841.89)<1&&Math.abs(Number(size[2])-595.28)<1);
   const fonts=execFileSync('pdffonts',[file],{encoding:'utf8'});assert.match(fonts,/Caveat/);for(const line of fonts.split('\n').slice(2).filter(Boolean))assert.match(line,/\byes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+\s*$/,'Every font must be embedded');
   const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});assert.match(text,/Håkon Lohne/);assert.match(text,/Løpsleder/);
   if(check.mode==='draft')assert.match(text,/FORHÅNDSVISNING/);else assert.doesNotMatch(text,/FORHÅNDSVISNING/);
   if(check.id==='einar-danielsen')assert.match(text,/7\. november 2026/);
   if(check.id==='jon-fjeld')assert.match(text,/11\. november 2023/);
  }
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
