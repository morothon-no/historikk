const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../../../tools/diploma-admin/design-model.js'),root=path.resolve(__dirname,'../../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),profile=read('web-admin/event-profile.json'),registry=read('public-data/data/badges.json'),ids=registry.badges.map(b=>b.id),base={profileSha256:'1'.repeat(64),registrySha256:'2'.repeat(64),historySha256:'3'.repeat(64)};
test('C1.3 isolated default and other-event drafts preserve the active profile and separate explicit participation/completion/service rules',()=>{
 const before=JSON.stringify(profile),a=M.createDraft(profile,base),b=M.createDraft(profile,base,true);
 assert.equal(M.validate(a,ids),a);assert.equal(M.validate(b,ids),b);assert.deepEqual(a.series[0].badges.map(b=>b.threshold),[5,10,15,20,30,40]);assert.deepEqual(b.series[0].badges.map(b=>b.threshold),[3,6,9,12]);assert.equal(JSON.stringify(profile),before);
 b.diploma.body='For innsatsen.\nFor minnene.';b.profile.description='Første avsnitt.\nNeste avsnitt.';M.validate(b,ids);
 b.series[0].basis='completion';b.series[0].rule='finished-year';M.validate(b,ids);assert.match(M.ruleStatus(b.series[0]),/Ikke operativ/);
 b.series[0].basis='service';b.series[0].rule='service-year';M.validate(b,ids);assert.match(M.ruleStatus(b.series[0]),/Ikke operativ/);
 b.series[0].unit='starts';M.validate(b,ids);b.series[0].rule='participated-year';assert.throws(()=>M.validate(b,ids),/passer ikke/);
});
test('C1.3 draft contract rejects duplicate hierarchy, arbitrary code/assets, invalid dates and inherited print approvals',()=>{
 for(const alter of [d=>d.awards=[],d=>d.status='approved',d=>d.profile.colors.primary='url(https://bad.example)',d=>{d.profile.colors['background|primary']=d.profile.colors.primary;delete d.profile.colors.primary;delete d.profile.colors.background;},d=>d.profile.name='<script>x</script>',d=>d.profile.font='custom-css',d=>d.profile.logoRef='https://bad.example/logo',d=>d.series[0].badges[1].id=d.series[0].badges[0].id,d=>d.series[0].badges[1].threshold=5,d=>d.series[0].badges[0].threshold=-1,d=>d.diploma.template='free-html',d=>d.diploma.mainSizeMm=100,d=>d.diploma.approval={verified:true},d=>d.diploma.presentationDate='2026-02-31',d=>d.diploma.dateMode='presentation']){
  const d=M.createDraft(profile,base);alter(d);assert.throws(()=>M.validate(d,ids));
 }
});
test('C1.3 portable draft package verifies configuration and actual image hashes, sizes, dimensions and draft-only status',async()=>{
 const d=M.createDraft(profile,base,true),bytes=new Uint8Array(fs.readFileSync(path.join(root,'assets/icons/favicon-32.png'))),dimensions=async()=>({width:32,height:32});
 const image=await M.inspectImage(bytes,'image/png',dimensions);image.id='own-badge';image.role='badge';d.assets.push(image);d.series[0].badges[0].assetRef=image.id;
 const raw=await M.exportPackage(d,ids),restored=await M.importPackage(raw,ids,dimensions);assert.deepEqual(restored,d);assert.equal(restored.assets[0].printReady,false);assert.equal(restored.assets[0].status,'unreviewed');assert.equal(M.dpi(image,55),14);
 const changed=JSON.parse(raw);changed.draft.profile.name='Changed';await assert.rejects(()=>M.importPackage(JSON.stringify(changed),ids,dimensions),/kontrollsum/);
 const fake=M.clone(d);fake.assets[0].sha256='0'.repeat(64);const forged=JSON.stringify({schemaVersion:1,kind:'morothon-design-package',draft:fake,sha256:await M.hash(new TextEncoder().encode(JSON.stringify(fake)))});await assert.rejects(()=>M.importPackage(forged,ids,dimensions),/Endret eller ødelagt/);
 const approved=M.clone(d);approved.assets[0].printReady=true;assert.throws(()=>M.validate(approved,ids),/trykkgodkjenning/);
});
test('C1.3 raster inspection refuses spoofed, oversized, giant-dimension and corrupt images before decoding where possible',async()=>{
 const png=new Uint8Array(fs.readFileSync(path.join(root,'assets/icons/favicon-32.png'))),dimensions=async()=>({width:32,height:32});
 await assert.rejects(()=>M.inspectImage(new TextEncoder().encode('<svg onload="x"/>'),'image/png',dimensions),/ekte PNG/);
 await assert.rejects(()=>M.inspectImage(png,'image/webp',dimensions),/stemmer ikke/);
 await assert.rejects(()=>M.inspectImage(new Uint8Array(M.MAX_IMAGE+1),'image/png',dimensions),/maksimalt/);
 const huge=png.slice();new DataView(huge.buffer).setUint32(16,30000);let decoded=false;await assert.rejects(()=>M.inspectImage(huge,'image/png',async()=>{decoded=true;return {width:30000,height:32};}));assert.equal(decoded,false);
 await assert.rejects(()=>M.inspectImage(png,'image/png',async()=>{throw Error('decode failed');}),/decode failed/);
 await assert.rejects(()=>M.inspectImage(png,'image/png',async()=>({width:31,height:32})),/dimensjoner/);
});
