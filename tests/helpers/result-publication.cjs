'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomBytes}=require('node:crypto');
const C=require('../../tools/diploma-admin/intake-model.js').Corrections,H=require('../../js/history-data.js'),D=require('../../tools/diploma-admin/result-release-data.cjs');
const {createResultReview}=require('../../scripts/admin/result-review.cjs'),{createResultPublication}=require('../../scripts/admin/result-publication.cjs'),{privateFileStore}=require('../../scripts/admin/review-workspace.cjs'),{backupFiles,restoreFiles,JOURNAL}=require('../../scripts/admin/result-release.cjs');
const {approvalFor,entry}=require('../../scripts/lib/public-package.cjs');
const synthetic=require('../public/quick/fixtures/corrections-data.js');
const userId='11111111-1111-4111-8111-111111111111',organizer='sogne-morothon';
async function sourceFiles(history=synthetic.history()){
 const root=path.resolve(__dirname,'../..'),names=['history','honors','volunteers','badges','event-dates'];
 const files=new Map(await Promise.all(names.map(async n=>['public-data/data/'+n+'.json',n==='history'?D.encode(history):await fs.readFile(path.join(root,'public-data/data/'+n+'.json'))])));
 files.set('data/history.json',files.get('public-data/data/history.json'));
 const manifest=JSON.parse(await fs.readFile(path.join(root,'public-data/manifest.json')));manifest.historySha256=D.hash(files.get('data/history.json'));manifest.files['data/history.json']=entry(files.get('data/history.json'));
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');files.set('public-data/manifest.json',bytes);files.set('.github/public-data-approval.json',Buffer.from(JSON.stringify(approvalFor(bytes),null,2)+'\n'));
 files.set(JOURNAL,Buffer.from(JSON.stringify({schemaVersion:1,baselineSha256:D.hash(files.get('data/history.json')),entries:[]},null,2)+'\n'));return files;
}
async function project(history){const model=H.create(history);return {people:Object.fromEntries([...model.people].map(([id,p])=>[id,{name:p.n,count:model.stats(id)?.count||0,years:model.stats(id)?.years||[],times:model.resultsFor(id).map(r=>r[5])}])),annual:{},records:[],placements:history.results.map((r,index)=>({index,personId:model.resolve(r[1]),year:r[0],event:r[2],distance:r[3],className:r[7]||'',bib:r[9]||'',rank:model.classPlaces.get(r)??null,sourcePlace:H.sourcePlace(r),time:r[5]})),rankings:{},diplomas:{},loyalty:{},redirects:history.redirects||{},aliases:history.aliases||{}};}
async function setup(t,{history=synthetic.history(),projector=project,checkBuild,verifyLive,onPublished}={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'publication-synthetic-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const repository={sha:'a'.repeat(40),files:await sourceFiles(history),variables:{MOROTHON_PUBLIC_DATA_SHA256:null,MOROTHON_REVIEWED_POLICY_HEAD:null}},key=randomBytes(32),context={history,project:projector,linkedRunnerIds:[]};
 async function bind(files){const approval=JSON.parse(files.get('.github/public-data-approval.json'));return C.binding(JSON.parse(files.get('data/history.json')),{dataVersion:approval.dataVersion,manifestSha256:approval.manifestSha256,historySha256:approval.historySha256});}context.base=await bind(repository.files);
 const owner={subject:userId,roles:{[organizer]:'owner'},organizers:{[organizer]:['review','approve']}},editor={subject:'22222222-2222-4222-8222-222222222222',roles:{[organizer]:'editor'},organizers:{[organizer]:['review']}},viewer={...editor,roles:{[organizer]:'viewer'}},sessions=new Map([['owner',owner],['editor',editor],['viewer',viewer]]);
 const reviewStore=privateFileStore({directory:path.join(directory,'reviews'),key}),stateStore=privateFileStore({directory:path.join(directory,'publications'),key}),authenticate=async s=>sessions.get(s),input={session:'owner',organizer};
 const review=createResultReview({authenticate,loadContext:async()=>context,store:reviewStore});
 const remote={submitted:0,merged:0,checks:'pending',deploy:'pending',live:true};
 const adapter={snapshot:async()=>({...repository,files:new Map(repository.files),variables:{...repository.variables}}),submit:async job=>{remote.submitted++;if(remote.submitError)throw remote.submitError;return {head:'b'.repeat(40),pr:1,url:'https://github.com/morothon-no/historikk/pull/1'};},advance:async job=>{
  if(remote.error)throw remote.error;
  if(remote.checks!=='success')return {stage:remote.checks==='failed'?'failed':'checking',...(remote.checks==='failed'?{error:'Syntetisk CI-feil'}:{})};
  if(!job.mergeCommit){remote.merged++;repository.sha=D.hash(job.id).slice(0,40);for(const [p,b]of restoreFiles(job.after))repository.files.set(p,b);return {stage:'deploying',mergeCommit:repository.sha};}
  return remote.deploy==='success'?{stage:'verifying',mergeCommit:repository.sha}:{stage:'deploying',mergeCommit:repository.sha};
 }};
 const publication=createResultPublication({authenticate,authorizeActor:async id=>{if(id!==userId||!sessions.has('owner'))throw Error('Ingen publiseringstilgang.');},review,reviewStore,stateStore,loadContext:async()=>context,adapter,directory,checkBuild:checkBuild||(async()=>({version:'f'.repeat(16),siteUrl:'https://public.example.test/',files:{}})),verifyLive:verifyLive||(async()=>{if(!remote.live)throw Object.assign(Error('Syntetisk gammel offentlig side'),{pending:true});return true;}),onPublished:onPublished||(async job=>{context.history=JSON.parse(Buffer.from(job.after['data/history.json'].base64,'base64'));context.base=await bind(repository.files);return context.base;})});
 async function draft(afterRow){const index=history.results.findIndex(r=>r[0]===2022),before=history.results[index],after=afterRow||[...before];if(!afterRow)after[5]='49:58';let p=C.report(C.empty(context.base),{id:'confirmed-synthetic-result',category:'Innmeldt feil',personIds:[before[1]],description:'Syntetisk bekreftet resultatfeil',source:'synthetic-private-note'});p=await C.propose(context.history,p,'confirmed-synthetic-result',{kind:'result',personIds:[before[1]],selector:await C.resultSelector(context.history,index,context.base),after,source:'synthetic-private-note',reason:'Kontrollert testgrunnlag.'});return p;}
 async function approve(draftValue){const old=await review.load(input),saved=await review.save({...input,expectedRevision:old.revision,draft:draftValue||await draft()}),approved=await review.approve({...input,expectedRevision:saved.revision,expectedDigest:saved.digest});return {...input,expectedRevision:approved.revision,expectedDigest:saved.digest};}
 return {directory,key,repository,remote,context,publication,review,reviewStore,stateStore,input,draft,approve,sessions,bind};
}
module.exports={sourceFiles,project,setup,userId,organizer};
