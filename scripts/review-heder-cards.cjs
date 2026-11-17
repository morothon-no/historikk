// Review only: real static-admin screenshots from approved public inputs, never original registers.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function review(out=path.join(root,'.review/heder-personkort'),base='0e5e03dee71cb8c06725a1ce25ce7f04bb67c6db'){
 if(!/^[a-f0-9]{40}$/.test(base))throw Error('Velg en eksakt baseline-SHA.');
 out=path.resolve(out);if(out===root||root.startsWith(out+path.sep))throw Error('Ugyldig kontrollmappe.');await fs.mkdir(out,{recursive:true});
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'morothon-heder-cards-')),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const metrics={base,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain','--','tools/diploma-admin/portal.js','tools/diploma-admin/admin.css'],{cwd:root,encoding:'utf8'}).trim(),views:[]};
 try{
  const before=path.join(temp,'before');await fs.mkdir(before);await require('../tests/helpers/public-package.cjs').copyPublic(before);
  for(const file of ['tools/diploma-admin/portal.js','tools/diploma-admin/admin.css'])await fs.writeFile(path.join(before,file),execFileSync('git',['show',base+':'+file],{cwd:root}));
  for(const [version,folder]of [['before',before],['after',root]]){
   const build=await require(path.join(folder,'scripts/build-site.cjs')).buildSite(path.join(temp,version+'-site')),files=new Set(build.files);
   const server=http.createServer(async(req,res)=>{let file=new URL(req.url,'http://static').pathname.slice(1);if(!file||file.endsWith('/'))file+='index.html';if(req.method!=='GET'||!files.has(file))return res.writeHead(404).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(path.join(build.out,file)));}catch{res.writeHead(404).end();}});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   try{for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1050}}),page=await context.newPage();
    try{
     await page.goto('http://127.0.0.1:'+server.address().port+'/admin/#heder');await page.locator('#honorList').getByRole('button',{name:'Oscar Lohne',exact:true}).click();
     for(const mode of ['personkort','redigering']){
      if(mode==='redigering'){await page.click('#honorEdit');await page.waitForFunction(()=>document.querySelector('#honorDraftPreview .metric-card strong')?.textContent==='35');}
      await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return !i.closest('details:not([open])')&&r.width&&r.bottom>0&&r.top<innerHeight;}).map(i=>Promise.race([i.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Synlig bildefil ble ikke klar for kontrollbildet.')),5000))])));});
      await page.screenshot({path:path.join(out,version+'-'+mode+'-'+width+'.png'),animations:'disabled'});
      metrics.views.push({version,mode,width,height:Math.round((await page.locator('#honorDetail').boundingBox()).height),visibleTextFields:await page.locator('#honorDetail input[type=text]:visible,#honorDetail input[type=search]:visible,#honorDetail textarea:visible').count()});
     }
    }finally{await context.close();}
   }}finally{await new Promise(r=>server.close(r));}
  }
  // Contact sheets use exact screenshots; the only operation is placing them side by side.
  for(const [mode,width]of [['personkort',1440],['redigering',1440],['redigering',390]]){
   const context=await browser.newContext({viewport:{width:width*2+32,height:1114}}),page=await context.newPage();
   try{
    const before=(await fs.readFile(path.join(out,'before-'+mode+'-'+width+'.png'))).toString('base64'),after=(await fs.readFile(path.join(out,'after-'+mode+'-'+width+'.png'))).toString('base64');
    await page.setContent('<style>body{margin:0;padding:8px;background:#eee;font:18px Arial}.pair{display:flex;gap:16px}.view{width:'+width+'px}h2{font-size:18px;height:24px;margin:8px}img{display:block;width:100%}</style><div class="pair"><div class="view"><h2>Før · main / PR #81</h2><img src="data:image/png;base64,'+before+'"></div><div class="view"><h2>Etter · #83</h2><img src="data:image/png;base64,'+after+'"></div></div>');
    await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
    const png=await page.screenshot({fullPage:true});
    const webp=await page.evaluate(async b64=>{const image=new Image();image.src='data:image/png;base64,'+b64;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);return c.toDataURL('image/webp',.86).split(',')[1];},png.toString('base64'));
    await fs.writeFile(path.join(out,'sammenligning-'+mode+'-'+width+'.webp'),Buffer.from(webp,'base64'));
   }finally{await context.close();}
  }
  await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');return {out,metrics};
 }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
}
module.exports={review};
if(require.main===module)review(process.argv[2],process.argv[3]).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1;});
