// Pure shared command validation. Safe in Worker; no private engines or filesystem.
'use strict';
const C=require('../../../tools/diploma-admin/intake-model.js').Corrections;
const copy=v=>structuredClone(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Error(message);};
const SCOPE='person-control-v1';
// Commands contain intent, not imported handoff/approval flags or client before-values.
function command(value) {
  const fields = ['format','version','id','base','kind','personIds','mainPersonId','name','source','reason'];
  if (!value || typeof value !== 'object' || !equal(Object.keys(value).sort(), fields.sort()) ||
      value.format !== 'morothon-identity-decision-v1' || value.version !== 1)
    fail('Ukjent identitetskommando eller felt.');
  C.empty(value.base);
  if (!['same-person','different-people','defer','rename','alias'].includes(value.kind))
    fail('Resultatimport og resultatkorrigering hører til Årets arrangement.');
  const paired = ['same-person','different-people','defer'].includes(value.kind);
  if (!Array.isArray(value.personIds) || value.personIds.length !== (paired ? 2 : 1) ||
      new Set(value.personIds).size !== value.personIds.length ||
      value.personIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)))
    fail('Velg entydige person-ID-er.');
  if (value.kind === 'same-person' ? !value.personIds.includes(value.mainPersonId) : value.mainPersonId !== null)
    fail('Velg hovedprofil bare ved sammenslåing.');
  if (paired ? value.name !== null : typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200)
    fail('Ugyldig hovednavn eller alias.');
  if (typeof value.source !== 'string' || !value.source.trim() || typeof value.reason !== 'string' || !value.reason.trim())
    fail('Beslutningen krever kilde og begrunnelse.');
  const next = copy(value);
  next.personIds.sort(); // Idempotency and distinct decisions concern an unordered pair.
  // Reuse the engine's strict text, ID and size validation as well.
  const validation = C.report(C.empty(next.base), {id:next.id, category:'Mulige duplikater', personIds:next.personIds,
    description:next.reason, source:next.source});
  C.transition(validation, next.id, 'review', next.reason);
  return next;
}

module.exports={validateIdentityCommand:command,SCOPE};
