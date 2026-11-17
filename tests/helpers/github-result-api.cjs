// An in-process GitHub API simulation backed by REAL isolated Git objects/refs.
// It never has a remote or a production token. CI outcomes are explicitly simulated.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {sourceFiles}=require('./result-publication.cjs');
const REPO='/repos/morothon-no/historikk/';
async function fakeGitHub(t,history){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'github-publication-synthetic-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const git=(args,input)=>execFileSync('git',args,{cwd:directory,input,stdio:['pipe','pipe','pipe']});
 git(['init','-q','-b','main']);git(['config','user.name','Synthetic publisher']);git(['config','user.email','synthetic@example.invalid']);
 const files=await sourceFiles(history);for(const [p,b]of files){await fs.mkdir(path.dirname(path.join(directory,p)),{recursive:true});await fs.writeFile(path.join(directory,p),b);}git(['add','.']);git(['commit','-qm','Synthetic initial source']);
 const codeSha=git(['rev-parse','HEAD']).toString().trim(),calls=[],variables={},prs=[],state={checks:'pending',deploy:'pending',strict:true,policyRace:false,runAttempt:1,reruns:0};
 const required=['Public-safe source regression','Trusted policy and test plan','Public package, policy and site build','Independent trusted artifact gate'];
 const sha=ref=>git(['rev-parse',ref]).toString().trim(),read=(file,ref='main')=>git(['show',ref+':'+file]);
 function commit(id){const s=git(['cat-file','-p',id]).toString();return {sha:id,tree:{sha:s.match(/^tree (\w+)/m)[1]},parents:[...s.matchAll(/^parent (\w+)/gm)].map(m=>({sha:m[1]}))};}
 async function api(url,options={}){
  if(!url.startsWith(REPO))throw Error('Unexpected repository');const route=url.slice(REPO.length),u=new URL('https://synthetic.invalid/'+route),p=u.pathname.slice(1),method=options.method||'GET',body=options.body;calls.push({path:p,method,body});
  if(method==='GET'&&p.startsWith('git/ref/heads/')){try{return {object:{sha:sha('refs/heads/'+p.slice(14))}};}catch{if(options.allow404)return null;throw Error('Missing synthetic ref');}}
  if(method==='GET'&&p.startsWith('git/commits/'))return commit(p.slice(12));
  if(method==='GET'&&p.startsWith('contents/')){const file=p.slice(9),ref=u.searchParams.get('ref'),bytes=read(file,ref);return {type:'file',encoding:'base64',size:bytes.length,content:bytes.toString('base64')};}
  if(method==='GET'&&p.startsWith('compare/')){const [a,b]=p.slice(8).split('...'),base=sha(a),head=sha(b),merge=git(['merge-base',a,b]).toString().trim();return {status:base===head?'identical':merge===base?'ahead':'diverged',merge_base_commit:{sha:merge},files:git(['diff','--name-status',a,b]).toString().trim().split('\n').filter(Boolean).map(line=>{const [status,filename]=line.split('\t');return {filename,status:status==='A'?'added':status==='M'?'modified':'removed'};})};}
  if(p==='branches/main/protection')return {required_status_checks:{strict:state.strict,contexts:required},enforce_admins:{enabled:true},required_pull_request_reviews:{required_approving_review_count:0}};
  if(p.startsWith('actions/variables')){const name=p.slice('actions/variables/'.length);if(method==='GET')return Object.hasOwn(variables,name)?{value:variables[name]}:null;variables[body.name]=body.value;return null;}
  if(method==='POST'&&p==='git/blobs')return {sha:git(['hash-object','-w','--stdin'],Buffer.from(body.content,'base64')).toString().trim()};
  if(method==='POST'&&p==='git/trees'){git(['read-tree',body.base_tree]);for(const e of body.tree)git(['update-index','--add','--cacheinfo',e.mode+','+e.sha+','+e.path]);return {sha:git(['write-tree']).toString().trim()};}
  if(method==='POST'&&p==='git/commits')return {sha:git(['commit-tree',body.tree,...body.parents.flatMap(p=>['-p',p])],body.message).toString().trim()};
  if(method==='POST'&&p==='git/refs'){git(['update-ref',body.ref,body.sha,'0'.repeat(40)]);return {};}
  if(p==='pulls'&&method==='GET')return prs.filter(pr=>'morothon-no:'+pr.branch===u.searchParams.get('head'));
  if(p==='pulls'&&method==='POST'){const pr={number:prs.length+1,state:'open',branch:body.head,head:{sha:sha(body.head)},base:{sha:sha('main')},html_url:'https://github.com/morothon-no/historikk/pull/'+(prs.length+1),merged:false};prs.push(pr);return pr;}
  if(/^pulls\/\d+$/.test(p))return prs[+p.split('/')[1]-1];
  if(/^pulls\/\d+\/merge$/.test(p)){
   const pr=prs[+p.split('/')[1]-1];if(state.checks!=='success'||body.sha!==pr.head.sha||pr.base.sha!==sha('main')||!state.strict)throw Error('Synthetic branch protection rejected merge');
   const head=commit(pr.head.sha),merged=git(['commit-tree',head.tree.sha,'-p',sha('main'),'-p',pr.head.sha],'Synthetic protected merge').toString().trim();git(['update-ref','refs/heads/main',merged,pr.base.sha]);pr.merged=true;pr.state='closed';pr.merge_commit_sha=merged;return {merged:true,sha:merged};
  }
  if(p==='actions/workflows/pages.yml/runs'){
   const ref=u.searchParams.get('head_sha'),event=u.searchParams.get('event'),initial=ref===codeSha,success=initial||event==='pull_request'?initial||state.checks==='success':state.deploy==='success';
   return {workflow_runs:[{id:event==='pull_request'?10:20,head_sha:ref,event,path:'.github/workflows/pages.yml',status:success||state.checks==='failed'||state.deploy==='failed'?'completed':'in_progress',conclusion:success?'success':state.checks==='failed'||state.deploy==='failed'?'failure':null,pull_requests:prs.map(p=>({number:p.number})),run_attempt:state.runAttempt}]};
  }
  if(/commits\/.*\/check-runs/.test(p))return {check_runs:required.map(name=>({name,status:'completed',conclusion:state.checks==='success'?'success':'failure',app:{slug:'github-actions'}}))};
  if(p==='actions/runs/20/jobs')return {jobs:[{name:state.policyRace?'Trusted policy and test plan':'Transitional trusted source regression',conclusion:'failure'}]};
  if(p==='actions/runs/20/rerun'){state.reruns++;state.runAttempt++;state.deploy='pending';return null;}
  throw Error('Unhandled synthetic GitHub API: '+method+' '+p);
 }
 return {api,directory,codeSha,state,calls,variables,prs,read,sha,git,required};
}
module.exports={fakeGitHub};
