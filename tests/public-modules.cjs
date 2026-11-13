const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHarness}=require('../scripts/diploma-harness.cjs');
test('B1 comparison, rankings and progression use finished exact-distance rows and preserve course periods and individual participation',async()=>{
 const h=await createHarness(),p=await h.browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const row=(year,id,time,status='Fullført',event='Morothon',distance='20 km')=>[year,id,event,distance,status,time,1,'','',''];
 const fixture={schemaVersion:1,people:[{i:'B1-A',n:'Testperson Alfa',g:'Herre'},{i:'B1-B',n:'Testperson Beta',g:'Herre'}],redirects:{},aliases:{},teamResults:[],yearStats:[2013,2014,2026].map(y=>[y,2]),results:[row(2013,'B1-A','1:50:00'),row(2013,'B1-B','1:55:00'),row(2014,'B1-A','2:00:00'),row(2014,'B1-B','2:10:00'),row(2026,'B1-A','1:00:00','Fullført','Morothon','21 km'),row(2026,'B1-A','1:30:00','DNF'),row(2026,'B1-B','1:20:00','Disket'),row(2026,'B1-A','0:30:00','Fullført','Langmoro stafett')]};
 try{
  await p.route('**/data/history.json',r=>r.fulfill({json:fixture}));await p.goto(h.base);await p.waitForFunction(()=>!document.querySelector('#loading'));
  const groups=await p.evaluate(()=>MorothonProgress.groups('B1-A').map(g=>({key:g.key,runs:g.runs})).sort((a,b)=>a.key.localeCompare(b.key)));
  assert.equal(groups.length,3);assert.deepEqual(groups.flatMap(g=>g.runs.map(r=>r.year)).sort(),[2013,2014,2026]);assert.ok(groups.every(g=>g.runs.length===1));
  const ranking=await p.locator('#rankingResults').textContent();assert.match(ranking,/Testperson Alfa/);assert.match(ranking,/2:00:00/);assert.match(ranking,/Testperson Beta/);assert.doesNotMatch(ranking,/1:30:00|1:20:00|0:30:00/);
  await p.evaluate(()=>MorothonCompare.pick('B1-A'));await p.locator('#duelSearchB').fill('Beta');await p.locator('#duelSuggestB [data-pick="B1-B"]').click();
  assert.equal(await p.locator('.duel-run-row').count(),2);assert.match(await p.locator('#duelResults').textContent(),/2014/);assert.match(await p.locator('#duelResults').textContent(),/2013/);assert.equal(await p.locator('.duel-run-row').filter({hasText:'2026'}).count(),0);
  assert.deepEqual(await p.evaluate(()=>S.people.map(p=>p.c)),[3,3]);assert.deepEqual(errors,[]);
 }finally{await p.close();await h.close();}
});
