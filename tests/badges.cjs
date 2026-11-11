const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createHarness } = require('../scripts/diploma-harness.cjs');
let harness;
before(async () => { harness = await createHarness(); });
after(async () => { await harness?.close(); });

test('one registry: thresholds, names, colors and exact same source in profiles, share canvas and diplomas', async () => {
  const page = await harness.browser.newPage();
  try {
    await page.goto(harness.base); await page.waitForFunction(() => !document.querySelector('#loading'));
    const result = await page.evaluate(async () => {
      const entries = MorothonBadges.list('participation');
      openProfile('MOR-15AF3A3');
      const p = MorothonCard.model('MOR-15AF3A3');
      const d = await MorothonDiplomas.prepare(p.p.i, 'badge:35');
      const drawn = [], original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image,...args) { drawn.push(image.src); return original.call(this,image,...args); };
      try { const exported = await buildShareCard(p.p.i); URL.revokeObjectURL(exported.url); }
      finally { CanvasRenderingContext2D.prototype.drawImage = original; }
      const milestone = MorothonMilestones.calculate(2026).badges.find(b => b.badge.n === 35);
      return { thresholds: entries.map(b=>b.n), canonical: entries.every(b=>BADGE_IMAGES[b.n]===MorothonBadges.source(b.id)),
        profile: document.querySelector('.brag-main-medal').src, diploma: d.asset.src,
        exportUsesSame: drawn.includes(d.asset.src), source: MorothonBadges.source('badge-35'),
        title: [p.highest.name,d.title,milestone.badge.name], color: [p.highest.color,d.color,milestone.badge.color],
        previous: [...document.querySelectorAll('.brag-medal-row img')].map(i=>i.src),
        sourceStatus: MorothonBadges.get('badge-35').status,
        placeholders: entries.filter(b=>b.status==='missing-cutout').map(b=>b.n) };
    });
    assert.deepEqual(result.thresholds,[5,10,15,20,25,30,35,40,45,50]);
    assert.equal(result.canonical,true); assert.equal(result.profile,result.source); assert.equal(result.diploma,result.source); assert.equal(result.exportUsesSame,true);
    assert.equal(new Set(result.title).size,1); assert.equal(new Set(result.color).size,1);
    assert.equal(result.previous.includes(result.source),false);
    assert.deepEqual(result.placeholders,[]);
    assert.match(result.source,/assets\/medals\/approved\/participation-35.webp$/);
    assert.equal(result.sourceStatus,'quality-checked-original');
  } finally { await page.close(); }
});

test('service badges: native 2400px transparent draft assets, data-driven honoree lists, responsive honor page', async () => {
  for (const width of [320,390,1440]) {
    const page = await harness.browser.newPage({ viewport:{width,height:900} });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(harness.base+'/heder.html');
      await page.waitForFunction(()=>document.querySelectorAll('#serviceBadges img').length===9);
      await page.locator('[data-honoree="oscar-lohne"] .honor-person-main').click();
      await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('.diploma-sheet'));
      await page.locator('.diploma-example summary').click();
      const result=await page.evaluate(async()=>{
        await Promise.all([...document.images].map(i=>i.decode()));
        const quality=await Promise.all(MorothonBadges.list('service').map(b=>MorothonDiplomas.inspectAsset(b.id)));
        const d=await MorothonDiplomas.serviceDraft(), doc=document.querySelector('iframe').contentDocument;
        const layout=await MorothonDiplomas.checkLayout(doc);
        return { quality:quality.map(a=>({width:a.width,height:a.height,alpha:a.transparent,edges:a.edgeContact,ready:a.ready,dpi:a.dpi})),
          same:[...document.querySelectorAll('#serviceBadges img')].some(i=>i.src===d.asset.src) && doc.querySelector('.diploma-medal').src===d.asset.src,
          statuses:MorothonBadges.list('service').map(b=>b.status),
          fits:document.documentElement.scrollWidth<=innerWidth, layout,
          recipient:document.querySelector('#honorOverview').textContent,
          body:document.body.textContent, sample:{ name:d.name,type:d.type,imageReady:d.imageReady,date:d.dateLabel },
          text:doc.body.textContent, links:document.querySelectorAll('[data-diploma-person]').length };
      });
      assert.equal(result.same,true); assert.equal(result.fits,true); assert.equal(result.layout.ready,true);
      assert.ok(result.quality.every(a=>a.width===2400 && a.height===2400 && a.alpha && a.edges===0 && !a.ready && a.dpi>1000));
      assert.deepEqual(result.statuses,Array(11).fill('design-draft'));
      assert.match(result.recipient,/Oscar Lohne/); assert.match(result.recipient,/Dag Morten Frantzen/);
      assert.match(result.recipient,/Floke|Til minne om/i);
      assert.match(result.body,/Grunnleggerne – de som startet det hele/);
      assert.equal(result.sample.imageReady,false); assert.equal(result.sample.type,'service');
      assert.doesNotMatch(result.text,/BEKREFTET|ikke et utstedt diplom/i);assert.doesNotMatch(result.text,/UTKAST – IKKE UTDELT/); assert.equal(result.sample.date,'Søgne, 7. november 2026');
      assert.equal(result.links,0); assert.deepEqual(errors,[]);
    } finally { await page.close(); }
  }
});

test('verified native high-resolution fixtures enable the gated print/PDF path', async () => {
  const registry=JSON.parse(await fs.readFile(path.join(__dirname,'../data/badges.json'),'utf8'));
  // Test fixture only: exercise the print path with existing native high-resolution pixels.
  // This does not approve the volunteer motif as an honorary medal or alter production registry.
  const bytes=await fs.readFile(path.join(__dirname,'../assets/medals/service/dugnadshelt.png'));
  const source='assets/medals/service/dugnadshelt.png', digest=createHash('sha256').update(bytes).digest('hex');
  Object.assign(registry.badges.find(b=>b.id==='badge-35'),{src:source,status:'fixture-approved',cropReviewed:true,reviewedSha256:digest});
  registry.watermark.src=source;registry.watermark.printReady=true;
  const page=await harness.browser.newPage();
  try {
    await page.route('**/data/badges.json',route=>route.fulfill({json:registry}));
    await page.goto(harness.base); await page.waitForFunction(()=>!document.querySelector('#loading'));
    await page.evaluate(()=>MorothonDiplomas.open('MOR-15AF3A3'));
    assert.equal(await page.evaluate(()=>MorothonDiplomas.current().ready),true);
    await page.evaluate(()=>{window.__prints=0;document.querySelector('#diplomaDialog iframe').contentWindow.print=()=>window.__prints++;});
    await page.locator('[data-diploma-print]').click();await page.locator('[data-diploma-pdf]').click();
    assert.equal(await page.evaluate(()=>window.__prints),2);
    assert.equal(await page.locator('[data-diploma-print]').isEnabled(),true);
  } finally { await page.close(); }
});

test('future badge titles remain identical across registry and honorary share/profile headings', async () => {
  const page=await harness.browser.newPage();
  try {
    await page.goto(harness.base);await page.waitForFunction(()=>!document.querySelector('#loading'));
    const titles=await page.evaluate(()=>{
      // Presentation fixture only; the original participation total is restored immediately.
      const p=person('MOR-15AF3A3'), count=p.c;
      try { return [35,40,45,50].map(n=>{
        p.c=n;
        const m=MorothonCard.model(p.i), el=document.createElement('div'); el.innerHTML=MorothonCard.profileHtml(p.i);
        return { name:m.highest.name, heading:el.querySelector('.brag-honor-title').textContent, registry:MorothonBadges.get(`badge-${n}`).name };
      }); } finally { p.c=count; }
    });
    for(const t of titles){assert.equal(t.name,t.registry);assert.equal(t.heading,t.registry.toLocaleUpperCase('nb-NO'));}
  }finally{await page.close();}
});
