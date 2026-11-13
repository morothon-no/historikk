const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');let rules,history;
before(async()=>{const context=vm.createContext({window:{}});for(const file of ['history-data','loyalty'])vm.runInContext(await fs.readFile(path.join(root,`js/${file}.js`),'utf8'),context);rules=context.window;history=JSON.parse(await fs.readFile(path.join(root,'public-data/data/history.json'),'utf8'));});
const years=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const row=(y,id='runner',status='Fullført',race='Morothon')=>[y,id,race,'20 km',status,status==='Fullført'?'2:00:00':status,1];
const plain=x=>JSON.parse(JSON.stringify(x));
const calc=(ys,editions)=>rules.MorothonLoyalty.calculate(ys.map(y=>row(y)),editions);
test('V3.2 loyalty thresholds require five arranged editions and use exact 70/90/100 boundaries',()=>{
 for(const [ys,editions,expected]of [[years(2000,2003),years(2000,2003),0],[years(2000,2004),years(2000,2004),100],[[2000,2001,2002,2003,2004,2005,2009],years(2000,2009),70],[[...years(2000,2007),2009],years(2000,2009),90],[[2000,2001,2002,2003,2004,2009],years(2000,2009),0]])assert.equal(calc(ys,editions).level,expected);
 const below=calc([...years(1900,1988),1999],years(1900,2000));assert.equal(below.level,90);assert.equal(below.current.name,'Svært trofast');
 const near=calc([...years(1900,1987),1999],years(1900,1999));assert.equal(near.level,70);assert.equal(rules.MorothonLoyalty.percent(near),'89');
 const ten=calc(years(2000,2009),years(2000,2026));assert.equal(ten.pct,1);assert.equal(ten.current.name,'Ubrutt deltakelse');assert.match(ten.current.desc,/2000–2009/);assert.doesNotMatch(ten.current.desc,/2026|siden debut/);
 assert.equal(calc(years(2017,2026),years(2000,2026)).current.name,'Ubrutt siden debut');
});
test('V3.2 historical honours use longest debut-anchored prefixes and survive a comeback, never arbitrary sliding windows',()=>{
 const prior=calc(years(2000,2009),years(2000,2026)),returned=calc([...years(2000,2009),2027],years(2000,2027));
 assert.equal(returned.count,11);assert.equal(returned.poss,28);assert.equal(returned.level,0);assert.deepEqual(plain(returned.recognition),plain(prior.recognition));assert.equal(returned.recognition.name,'Ubrutt deltakelse');
 assert.deepEqual(plain(returned.comebacks),[{year:2027,previous:2009,missed:17}]);assert.match(returned.recognition.desc,/2000–2009/);
 // Five consecutive starts late in a sparse career earn a streak, not a hand-picked 100% period.
 const sparse=calc([2000,...years(2010,2014),2026],years(2000,2026));assert.equal(sparse.longest.count,5);assert.equal(sparse.recognition,null);
 // Acquired 70/90 honours persist too; each stored endpoint is the longest prefix at that exact level.
 for(const [ys,n]of [[[2000,2002,2003,2004,2005,2006,2009],70],[[2000,...years(2002,2009)],90]]){
  const before=calc(ys,years(2000,2026)),after=calc([...ys,2027],years(2000,2027));assert.equal(after.level,0);assert.equal(after.recognition.level,n);assert.deepEqual(plain(after.recognition),plain(before.recognition));assert.equal(after.recognition.first,2000);
 }
 const ordinary=calc([...years(2000,2013),2019],years(2000,2026)),later=calc([...years(2000,2013),2019,2021],years(2000,2026));assert.equal(ordinary.level,70);assert.equal(later.level,70);for(const award of ordinary.awards)assert.ok(later.awards.some(a=>JSON.stringify(a)===JSON.stringify(award)),'an earlier honour is preserved even if the comeback still qualifies at the same level');
});
test('V3.2 cancelled years do not break edition streaks; DNS, DNF, relay teams, merged IDs and duplicate starts follow individual rules',()=>{
 const editions=[2000,2001,2003,2004,2005],data={schemaVersion:1,people:[{i:'canonical',n:'Runner'},{i:'old',n:'Old spelling'}],redirects:{old:'canonical'},aliases:{canonical:['Approved alias']},yearStats:editions.map(y=>[y]),results:[row(2000,'old'),row(2001,'canonical','DNF'),row(2003,'canonical'),row(2003,'old'),row(2004,'canonical'),row(2005,'canonical'),row(2006,'canonical','DNS'),row(2007,'canonical','Fullført','Langmoro stafett')]};
 const H=rules.MorothonHistoryData.create(data),L=rules.MorothonLoyalty.calculate(H.resultsFor('old'),[...editions,2006,2007]);assert.equal(H.resolve('old'),'canonical');assert.equal(L.count,5);assert.equal(L.poss,5);assert.equal(L.pct,1);assert.deepEqual(plain(L.longest),{first:2000,last:2005,count:5});assert.deepEqual(plain(L.comebacks),[]);assert.equal(L.active,0);
 const empty=rules.MorothonLoyalty.calculate([row(2000,'runner','DNS')],[2000]);assert.equal(empty.poss,0);assert.equal(empty.recognition,null);
});
test('V3.2 Kristen has 12/24, a documented 2005–2009 streak and stable historical counts after a future import',()=>{
 const H=rules.MorothonHistoryData.create(history),editions=history.yearStats.map(s=>s[0]),rows=H.resultsFor('MOR-0C5F6C9'),L=rules.MorothonLoyalty.calculate(rows,editions);
 assert.deepEqual([L.count,L.first,L.last,L.poss,L.pct],[12,1993,2016,24,.5]);assert.deepEqual(plain(L.longest),{first:2005,last:2009,count:5});assert.equal(L.recognition,null);
 assert.equal(rules.MorothonLoyalty.calculate(rows,[...editions,2027]).pct,.5);
 const next=rules.MorothonLoyalty.calculate([...rows,row(2027,'MOR-0C5F6C9')],[...editions,2027]);assert.equal(next.count,13);assert.equal(next.poss,35);assert.equal(next.longest.count,5);assert.equal(next.active,1);
 for(const [name,count]of [['Finn Gerhard Olsen',31],['Gunnar Kåsa',35],['Morten Borø',35]])assert.equal(rules.MorothonLoyalty.calculate(H.resultsFor(history.people.find(p=>p.n===name).i),editions).count,count);
});
