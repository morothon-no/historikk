// Run from protected base before any PR code. Missing/unknown change information means full.
const fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {levels,requirements}=require('./catalog.cjs');
const functional=new Set(['js/compare.js','js/rankings.js','js/progress.js']);
const visual=new Set(['js/brag-card.js','js/honors.js','js/navigation.js','css/brag-card.css','css/honors.css','css/navigation.css']);
const documentation=p=>p==='README.md'||/^docs\/[a-zA-Z0-9/._-]+\.(md|json)$/.test(p);
const protectedTest=p=>p.startsWith('scripts/testing/')||p.startsWith('tests/')||p==='scripts/diploma-harness.cjs';
function classify(changes,{forceFull=false}={}){
 if(forceFull||!Array.isArray(changes)||!changes.length)return {level:'full',reason:forceFull?'explicit full control':'missing or empty change information'};
 let n=0;const reasons=[];
 for(const p of changes){
  if(typeof p!=='string'||p.includes('..')||p.includes('\\')||p.startsWith('/')||!p)return {level:'full',reason:'invalid change path'};
  const next=documentation(p)?0:functional.has(p)?1:visual.has(p)?2:3;
  n=Math.max(n,next);reasons.push(p+': '+levels[next]);
 }
 return {level:levels[n],reason:reasons.join('; ')};
}
async function gitChanges(root,base,head){
 if(!/^[a-f0-9]{40}$/.test(base||'')||!/[1-9a-f]/.test(base)||!/^[a-f0-9]{40}$/.test(head||''))return null;
 try{return execFileSync('git',['diff','--name-only','--no-renames','-z',base,head,'--'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).split('\0').filter(Boolean);}catch{return null;}
}
async function plan({root,base,head,forceFull=false,reviewedHead='',checkReview=false}){
 const changes=await gitChanges(root,base,head),selection=classify(changes,{forceFull});
 if(checkReview&&!changes&&reviewedHead!==head)throw Error('Cannot verify test changes; maintainer head review and full control required');
 if(checkReview&&changes?.some(protectedTest)&&reviewedHead!==head)throw Error('Test configuration/code changes require maintainer approval of this exact PR head');
 return {schemaVersion:1,base,head,...selection,changes,public:requirements(selection.level,'public'),source:requirements(selection.level,'source')};
}
module.exports={classify,gitChanges,plan,protectedTest};
if(require.main===module){
 const [root,base,head,out]=process.argv.slice(2);
 plan({root:path.resolve(root),base,head,forceFull:process.env.MOROTHON_FULL_CONTROL==='true',reviewedHead:process.env.MOROTHON_REVIEWED_POLICY_HEAD||'',checkReview:process.env.MOROTHON_REQUIRE_TEST_REVIEW==='true'}).then(async p=>{
  await fs.writeFile(out,JSON.stringify(p,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,[`level=${p.level}`,`public_browser=${p.public.browser}`,`public_pdf=${p.public.pdf}`,`source_browser=${p.source.browser}`,`source_pdf=${p.source.pdf}`,`source_python=${p.source.python}`].join('\n')+'\n');
  console.log(JSON.stringify({level:p.level,reason:p.reason,public:p.public,source:p.source}));
 }).catch(e=>{console.error(e.message);process.exitCode=1;});
}
