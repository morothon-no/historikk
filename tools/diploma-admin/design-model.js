/* Portable draft contract. No result writes, approvals, network or browser storage. */
(function (factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else window.MorothonDesignDraft = factory();
})(function () {
  'use strict';
  const MAX_IMAGE = 4 * 1024 * 1024, MAX_PACKAGE = 24 * 1024 * 1024;
  const modules = ['oversikt', 'deltakere', 'merker', 'diplomer', 'import', 'premier'];
  const fonts = { sans: 'Arial,Helvetica,sans-serif', serif: 'Georgia,serif' };
  const templates = ['classic', 'modern', 'ceremonial', 'sport'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function fields(v, names, at) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== names.length || !names.every(name=>Object.hasOwn(v,name))) throw Error('Ukjente eller manglende felt: ' + at);
  }
  function text(v, label, max = 200, empty = false, multiline = false) {
    const unsafe = multiline ? /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[<>\u0000-\u001f]/;
    if (typeof v !== 'string' || (!empty && !v.trim()) || v.length > max || unsafe.test(v)) throw Error('Ugyldig tekst: ' + label);
  }
  function id(v) { if (typeof v !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(v)) throw Error('ID må starte med en bokstav og bruke små bokstaver, tall eller bindestrek.'); }
  function color(v) { if (typeof v !== 'string' || !/^#[a-f0-9]{6}$/i.test(v)) throw Error('Ugyldig farge.'); }
  function choice(v, values, label) { if (!values.includes(v)) throw Error('Ugyldig valg: ' + label); }
  function integer(v, min, max) { if (!Number.isSafeInteger(v) || v < min || v > max) throw Error('Ugyldig tall (' + min + '–' + max + ').'); }
  function sha(v) { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw Error('Ugyldig SHA-256.'); }
  function realDate(v) {
    if (v === '') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) !== v) throw Error('Ugyldig dato.');
  }
  function validate(d, builtinIds) {
    fields(d, ['schemaVersion','kind','status','id','base','profile','series','diploma','assets'], 'utkast');
    if (d.schemaVersion !== 2 || d.kind !== 'morothon-design-draft' || d.status !== 'draft') throw Error('Ukjent utkastversjon eller godkjenningsstatus.');
    id(d.id); fields(d.base, ['profileSha256','registrySha256','historySha256'], 'grunnlag'); Object.values(d.base).forEach(sha);
    const p = d.profile;
    fields(p, ['name','description','tagline','header','logoRef','colors','font','modules','distances'], 'profil');
    for (const k of ['name','tagline','header']) text(p[k], k, 100); text(p.description, 'beskrivelse', 300, true, true);
    fields(p.colors, ['primary','secondary','background','text'], 'farger'); Object.values(p.colors).forEach(color); choice(p.font, Object.keys(fonts), 'font');
    fields(p.modules, modules, 'moduler'); for (const v of Object.values(p.modules)) if (typeof v !== 'boolean') throw Error('Ugyldig modulvalg.');
    if (!Array.isArray(p.distances) || p.distances.length > 20) throw Error('For mange distanser.');
    const distanceIds = new Set();
    for (const row of p.distances) { fields(row, ['id','name','km'], 'distanse'); id(row.id); text(row.name, 'distansenavn', 80); if (!Number.isFinite(row.km) || row.km <= 0 || row.km > 1000 || distanceIds.has(row.id)) throw Error('Ugyldig eller gjentatt distanse.'); distanceIds.add(row.id); }
    if (!Array.isArray(d.assets) || d.assets.length > 12) throw Error('Maksimalt 12 egne bilder i et utkast.');
    const assetIds = new Set(); let total = 0;
    for (const a of d.assets) {
      fields(a, ['id','role','mediaType','bytes','width','height','sha256','base64','status','printReady'], 'bilde'); id(a.id);
      choice(a.role, ['logo','badge','background'], 'bilderolle'); choice(a.mediaType, ['image/png','image/webp'], 'bildeformat');
      integer(a.bytes, 1, MAX_IMAGE); integer(a.width, 1, 4096); integer(a.height, 1, 4096); sha(a.sha256);
      if (a.width * a.height > 16000000 || typeof a.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64) || a.base64.length !== 4 * Math.ceil(a.bytes / 3)) throw Error('Ugyldige bildedata.');
      if (a.status !== 'unreviewed' || a.printReady !== false || assetIds.has(a.id)) throw Error('Bildet er duplisert eller har en ugyldig trykkgodkjenning.');
      assetIds.add(a.id); total += a.bytes;
    }
    if (total > 12 * 1024 * 1024) throw Error('Bildene overskrider samlet grense på 12 MB.');
    function ref(value, role, optional = false) {
      if (optional && value === null) return;
      if (typeof value !== 'string') throw Error('Manglende bildereferanse.');
      if (value.startsWith('builtin:') && builtinIds.includes(value.slice(8))) return;
      if (!d.assets.some(a => a.id === value && a.role === role)) throw Error('Ukjent bilde eller feil bilderolle: ' + value);
    }
    ref(p.logoRef, 'logo');
    if (!Array.isArray(d.series) || !d.series.length || d.series.length > 8) throw Error('Velg mellom én og åtte merkeserier.');
    const ids = new Set(), badgeIds = new Set();
    for (const s of d.series) {
      fields(s, ['id','name','basis','unit','rule','badges'], 'merkeserie'); id(s.id); text(s.name, 'serienavn', 80);
      if (ids.has(s.id)) throw Error('Duplisert serie-ID.'); ids.add(s.id);
      choice(s.basis, ['participation','completion','service','special'], 'opptjeningsgrunnlag'); choice(s.unit, ['editions','starts','manual'], 'tellenhet');
      choice(s.rule, ['participated-year','finished-year','service-year','manual-approval'], 'regel');
      const rules = { participation: 'participated-year', completion: 'finished-year', service: 'service-year', special: 'manual-approval' };
      if (s.rule !== rules[s.basis] || s.basis === 'special' && s.unit !== 'manual' || s.basis !== 'special' && s.unit === 'manual') throw Error('Regelen passer ikke til valgt opptjeningsgrunnlag/tellenhet.');
      if (!Array.isArray(s.badges) || !s.badges.length || s.badges.length > 20) throw Error('En serie må ha 1–20 merker.');
      let previous = 0;
      for (const b of s.badges) {
        fields(b, ['id','name','description','threshold','color','assetRef','active','onDiploma'], 'merke'); id(b.id); text(b.name, 'merkenavn', 80); text(b.description, 'merkebeskrivelse', 300, true, true); color(b.color); integer(b.threshold, 1, 10000);
        if (badgeIds.has(b.id) || b.threshold <= previous) throw Error('Merker må ha unike ID-er og strengt stigende terskler innen hver serie.');
        if (typeof b.active !== 'boolean' || typeof b.onDiploma !== 'boolean') throw Error('Ugyldig merkestatus.');
        badgeIds.add(b.id); previous = b.threshold; ref(b.assetRef, 'badge');
      }
    }
    const t = d.diploma;
    fields(t, ['template','heading','body','sampleName','signatureName','signatureRole','place','dateMode','presentationDate','backgroundColor','textColor','accentColor','backgroundRef','frame','font','mainSizeMm','medalDisplay','secondaryPosition','seriesId','badgeId'], 'diplom');
    choice(t.template, templates, 'mal'); text(t.heading, 'overskrift', 70); text(t.body, 'diplomtekst', 340, true, true); text(t.sampleName, 'eksempelnavn', 90); text(t.signatureName, 'signaturnavn', 70); text(t.signatureRole, 'signaturrolle', 90); text(t.place, 'sted', 60, true);
    choice(t.dateMode, ['achievement','presentation','none'], 'datoformål'); text(t.presentationDate, 'utdelingsdato', 10, true); realDate(t.presentationDate);
    if (t.dateMode === 'presentation' && !t.presentationDate) throw Error('Velg eksplisitt utdelingsdato, eller et annet datoformål.');
    for (const k of ['backgroundColor','textColor','accentColor']) color(t[k]); ref(t.backgroundRef, 'background', true);
    choice(t.frame, ['single','double','corners'], 'ramme'); choice(t.font, Object.keys(fonts), 'diplomfont'); integer(t.mainSizeMm, 35, 62);
    choice(t.medalDisplay, ['latest','all'], 'medaljevisning'); choice(t.secondaryPosition, ['bottom','left'], 'sekundærmerker');
    if (!d.series.some(s => s.id === t.seriesId && s.badges.some(b => b.id === t.badgeId && b.active && b.onDiploma))) throw Error('Velg et aktivt merke tillatt på diplom.');
    return d;
  }
  const hash = async bytes => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
  const utf8 = value => new TextEncoder().encode(JSON.stringify(value));
  function encode(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s); }
  function decode(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
  function imageType(bytes) {
    if (bytes.length >= 33 && [...bytes.subarray(0,8)].join(',') === '137,80,78,71,13,10,26,10' && new TextDecoder().decode(bytes.subarray(12,16)) === 'IHDR') return 'image/png';
    if (bytes.length >= 30 && new TextDecoder().decode(bytes.subarray(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8,12)) === 'WEBP') return 'image/webp';
    throw Error('Velg en ekte PNG- eller WebP-fil. SVG, HTML og andre formater er ikke tillatt.');
  }
  async function inspectImage(bytes, declaredType, getDimensions) {
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE) throw Error('Bildet kan være maksimalt 4 MB.');
    const type = imageType(bytes); if (type !== declaredType) throw Error('Filtype og bildeinnhold stemmer ikke overens.');
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),le24=i=>bytes[i]+bytes[i+1]*256+bytes[i+2]*65536;
    let header;
    if(type==='image/png')header={width:view.getUint32(16),height:view.getUint32(20)};
    else {
      if(view.getUint32(4,true)+8!==bytes.length)throw Error('WebP-filen er ufullstendig.');
      const chunk=new TextDecoder().decode(bytes.subarray(12,16));
      if(chunk==='VP8X')header={width:1+le24(24),height:1+le24(27)};
      else if(chunk==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);header={width:(bits&16383)+1,height:((bits>>>14)&16383)+1};}
      else if(chunk==='VP8 ')header={width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
      else throw Error('WebP-varianten støttes ikke.');
    }
    integer(header.width,1,4096);integer(header.height,1,4096);
    if(header.width*header.height>16000000)throw Error('Bildet har for mange piksler.');
    const size = await getDimensions(new Blob([bytes], { type }));
    integer(size.width, 1, 4096); integer(size.height, 1, 4096);
    if (size.width !== header.width || size.height !== header.height) throw Error('Bildets dimensjoner stemmer ikke.');
    return { mediaType: type, bytes: bytes.length, width: size.width, height: size.height, sha256: await hash(bytes), base64: encode(bytes), status: 'unreviewed', printReady: false };
  }
  async function verifyAssets(d, getDimensions) {
    for (const a of d.assets) {
      const actual = await inspectImage(decode(a.base64), a.mediaType, getDimensions);
      for (const key of ['bytes','width','height','sha256','base64']) if (a[key] !== actual[key]) throw Error('Endret eller ødelagt bildefil: ' + a.id);
    }
  }
  async function exportPackage(d, builtinIds) { validate(d,builtinIds); const pack = {schemaVersion:1,kind:'morothon-design-package',draft:clone(d),sha256:await hash(utf8(d))}; return JSON.stringify(pack); }
  async function importPackage(raw, builtinIds, getDimensions) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_PACKAGE) throw Error('Utkastpakken er for stor (maks. 24 MB).');
    const p = JSON.parse(raw); fields(p,['schemaVersion','kind','draft','sha256'],'pakke');
    if (p.schemaVersion !== 1 || p.kind !== 'morothon-design-package') throw Error('Ukjent pakkeformat.'); sha(p.sha256);
    validate(p.draft,builtinIds); if (await hash(utf8(p.draft)) !== p.sha256) throw Error('Utkastets kontrollsum stemmer ikke.');
    await verifyAssets(p.draft,getDimensions); return clone(p.draft);
  }
  function seriesExample(other = false) {
    const levels = other ? [3,6,9,12] : [5,10,15,20,30,40], images = other ? [5,10,15,20] : [5,10,15,20,30,40];
    return {id:'deltakelse',name:'Deltakelsesmerker',basis:'participation',unit:'editions',rule:'participated-year',badges:levels.map((n,i)=>({id:'merke-'+n,name:(other?'Fjordmerke ':'Deltakelsesmerke ')+n,description:'Én kvalifisert utgave per deltakelsesår. DNS teller ikke; DNF teller.',threshold:n,color:['#a96b45','#687c87','#b48c35','#4d7d8b','#aa673b','#426e66'][i%6],assetRef:other?'builtin:debut':'builtin:badge-'+images[i],active:true,onDiploma:true}))};
  }
  function createDraft(profile, base, other = false) {
    const series = seriesExample(other);
    return {schemaVersion:2,kind:'morothon-design-draft',status:'draft',id:other?'fjordlopet-utkast':'morothon-utkast',base:clone(base),
      profile:{name:other?'Fjordløpet':profile.name,description:other?'Løpeglede mellom fjord og fjell.':profile.texts.welcomeDescription,tagline:other?'SAMMEN LANGS FJORDEN':profile.texts.tagline,header:other?'Ditt løp. Din historie.':'Historien fortsetter',logoRef:'builtin:'+profile.logoAssetId,colors:{primary:other?'#234f74':profile.colors.primary,secondary:other?'#357c82':profile.colors.secondary,background:profile.colors.background,text:profile.colors.text},font:'sans',modules:clone(profile.modules),distances:profile.distances.map((r,i)=>({id:'distanse-'+i,name:r.name,km:r.km}))},
      series:[series],diploma:{template:'classic',heading:'DIPLOM',body:'For innsatsen, løpegleden og minnene vi skaper sammen.',sampleName:'Eksempelperson med et langt etternavn',signatureName:other?'Arrangørens navn':'Håkon Lohne',signatureRole:other?'Løpsleder':'Løpsleder · Morothon',place:other?'':'Søgne',dateMode:'achievement',presentationDate:'',backgroundColor:'#fbfaf4',textColor:'#123b45',accentColor:'#b38d46',backgroundRef:null,frame:'double',font:'sans',mainSizeMm:55,medalDisplay:'all',secondaryPosition:'bottom',seriesId:series.id,badgeId:series.badges.at(-1).id},assets:[]};
  }
  function ruleStatus(s) { return s.unit === 'editions' && s.basis === 'participation' ? 'Kjent årsmodell · kun utkast, ikke aktivert' : 'Ikke operativ i dagens beregningsmotor · krever egen implementering og kontroll'; }
  function dpi(asset, mm) { return Math.floor(Math.min(asset.width,asset.height) / (mm / 25.4)); }
  return {validate,inspectImage,verifyAssets,exportPackage,importPackage,createDraft,seriesExample,ruleStatus,dpi,clone,hash,fonts,templates,modules,MAX_IMAGE,MAX_PACKAGE};
});
