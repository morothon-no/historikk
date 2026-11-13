// Public contract only: no administrative records, file reads or export processing.
const S='string',N='number',B='boolean',scalar={oneOf:[S,N]},nullableString={oneOf:[S,'null']};
const array=items=>({array:items}),dict=values=>({dict:values});
const strings=array(S),years=array(N),refs={sourceIds:strings};
const story={text:S,title:S,confirmed:B,source:S,...refs};
const role={title:S,confirmed:B,countsForTenure:B,fromYear:N,toYear:N,...refs};
const total={approved:B,editions:N,asOfYear:N,...refs};
const contribution={confirmedYears:years,excludedYears:years,fromYear:N,toYear:N,toYearStatus:S,allEditions:B,approvedTotal:total,exception:{confirmed:B,...refs},...refs};
const badgeProposal={status:S,primaryBadgeId:nullableString,badgeIds:strings,...refs};
const member={id:S,name:S,status:S,reason:nullableString,listingOnly:B,runnerId:S,aliases:strings,aliasIds:strings,roles:array(role),stories:array(story),contribution,badgeProposal,diplomaTribute:S,deceased:B,deathYear:N,
 plannedHonors:array({badgeId:S,status:S,year:N,...refs}),memorialRecognition:{badgeId:S,...refs},...refs};
const proof={personId:S,badgeId:S,medalDisplay:S,contentSha256:S,cssSha256:S,assetSha256:S,watermarkSha256:S,secondarySha256:array({key:S,sha256:S})};
const details={shortDescription:S,stories:array(story),honorDiplomaText:S,runnerLink:{runnerId:S,confirmed:B,...refs},diplomaDate:{date:S,...refs}};
const milestone={badgeId:S,minimumDocumentedEditions:N,rule:S};
const approval={id:S,personId:S,badgeId:S,status:S,approvedForFinal:B,approvedOn:S,contentSha256:S,...refs};
const publicSource={title:S};
const schemas={
 honors:{schemaVersion:N,publicDataVersion:N,contentVersion:scalar,previewOnly:B,sources:dict(publicSource),displayOrder:strings,featuredIds:strings,founderSpotlightIds:strings,
  groups:array({id:S,title:S,description:S,badgeId:nullableString,memberRefs:strings,members:array(member),...refs}),
  retiredProfiles:array({id:S,name:S,message:S}),
  narrative:{title:S,lead:S,intro:strings,emphasis:S,thanks:S,closing:S,timeline:array({year:scalar,title:S,text:S}),sharedStories:array({title:S,text:S,confirmed:B})},
  awardPolicy:{status:S,minimumDocumentedEditions:N,explicitExceptionPossible:B,roleDoesNotAward:B,diplomaRequiresFormalAward:B,retiredBadgeIds:strings,milestones:array(milestone),specialHonors:array({badgeId:S,rule:S})},
  diplomaExamples:array({id:S,label:S,badgeId:S,personId:S,illustrative:B,name:S,contributionCount:N}),volunteerList:S,
  diplomaApprovals:array(approval),
  presentationPrintSet:{id:S,scope:S,editionYears:years,entries:array(proof),...refs},
  diplomaTexts:{dugnad:dict(S),honorDefault:S},personDetails:dict(details)},
 volunteers:{schemaVersion:N,publicDataVersion:N,sourceIds:strings,sources:dict(publicSource),people:array({profileId:S,id:S,name:S,role:S,roleType:S,nameStatus:S,...contribution})},
 history:{schemaVersion:N,people:array({i:S,n:S,g:S,c:N,f:N,l:N,s:N,a:N,m:N,k:N,q:N,d:N,x:S,z:S}),results:array({tuple:[N,S,S,S,S,S,scalar,S,S,S]}),yearStats:array({tuple:[N,N,N,N,N,N,N,N,N,N]}),updated:S,range:S,aliases:dict(strings),redirects:dict(S),teamResults:array({year:N,event:S,team:S,place:{oneOf:[N,'null']},time:nullableString,status:S,legs:N})},
 badges:{schemaVersion:N,minimumDpi:N,watermark:{src:S,sha256:S,widthMm:N,heightMm:N,printReady:B,format:S,status:S,designApproved:B},badges:array({id:S,name:S,kind:S,n:N,cls:S,color:S,tier:S,desc:S,physical:B,src:S,vectorSource:S,widthMm:N,heightMm:N,nativeWidth:N,nativeHeight:N,printReady:B,cropReviewed:B,reviewedSha256:nullableString,status:S,active:B,legacyCompatibilityOnly:B,displayOnHonorPage:B,series:S,milestoneEditions:N,retainRedArc:B,shareTheme:{background:S,metal:S},printApproval:{sha256:S,acceptedBelow300Dpi:B,acceptedSourceBoundary:B,effectiveDpiAt55Mm:N}})},
 'event-dates':{schemaVersion:N,source:{name:S},dates:dict(S)},
 'build-info':{version:S,siteUrl:S,assets:dict(S)}
};
function shape(value,schema,strict=false,at='$'){
 if(typeof schema==='string'){
  if(schema==='null'?value!==null:typeof value!==schema||schema==='number'&&!Number.isFinite(value))throw Error(`Public data type mismatch at ${at}`);
  return value;
 }
 if(schema.oneOf){for(const type of schema.oneOf)try{return shape(value,type,strict,at);}catch{}throw Error(`Public data type mismatch at ${at}`);}
 if(schema.array||schema.tuple){
  if(!Array.isArray(value)||schema.tuple&&value.length!==schema.tuple.length)throw Error(`Public data array mismatch at ${at}`);
  return value.map((v,i)=>shape(v,schema.array||schema.tuple[i],strict,`${at}[${i}]`));
 }
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`Public data object mismatch at ${at}`);
 const out={};
 for(const [k,v]of Object.entries(value)){
  if(['__proto__','constructor','prototype'].includes(k))throw Error(`Unsafe public data key at ${at}`);
  const type=schema.dict||Object.hasOwn(schema,k)&&schema[k];
  if(!type){if(strict)throw Error(`Unapproved public field at ${at}.${k}`);continue;}
  Object.defineProperty(out,k,{value:shape(v,type,strict,`${at}.${k}`),enumerable:true,writable:true,configurable:true});
 }
 return out;
}
function validatePublicData(name,value){
 if(!schemas[name])throw Error('Unknown public data file');
 shape(value,schemas[name],true);
 if(name==='build-info'){
  if(!/^[a-f0-9]{16}$/.test(value.version)||typeof value.siteUrl!=='string'||!value.assets)throw Error('Invalid public build manifest');
 }else if(value.schemaVersion!==1)throw Error(`Unsupported public data schema: ${name}`);
 if(['honors','volunteers'].includes(name)&&value.publicDataVersion!==1)throw Error('Missing explicit public data version');
 return value;
}
module.exports={shape,validatePublicData,schemas};
