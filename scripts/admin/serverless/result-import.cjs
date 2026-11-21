"use strict";
// Merge reviewed existing-result proposals, never raw CSV or publication authority.
const C = require("../../../tools/diploma-admin/intake-model.js").Corrections;
const {sha, fail} = require("./github-store.cjs");
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const copy = v => structuredClone(v);
function validateImport(draft) {
  try { C.validatePackage(draft); } catch { throw fail("Ugyldig rettingsgrunnlag."); }
  if (!draft.cases.length || draft.cases.length > 20 || !draft.cases.some(c => c.change))
    throw fail("Velg mellom 1 og 20 gjennomgåtte rettinger av eksisterende resultater.");
  const rows = new Set();
  for (const c of draft.cases) {
    if (c.registration) throw fail("Nye registreringer krever separat behandling.");
    if (!c.change) continue;
    const x = c.change;
    if (x.kind !== "result" || !["proposed","handoff"].includes(c.status) ||
        x.before.length < 6 || x.before.length > 10 || x.after.length !== x.before.length ||
        x.before[0] !== x.after[0] || x.before[1] !== x.after[1] ||
        x.selector.historySha256 !== draft.base.historySha256 || sha(x.before) !== x.selector.rowSha256)
      throw fail("Importen kan bare rette eksisterende resultater, uten nye årganger eller personkoblinger.");
    if (rows.has(x.selector.index)) throw fail("Flere importforslag gjelder samme resultat. Avklar dem først.");
    rows.add(x.selector.index);
  }
}
function mergeResultImport(current, incoming, {replaceConflicts = false, at} = {}) {
  validateImport(incoming);
  if (typeof replaceConflicts !== "boolean") throw fail("Velg om motstridende private forslag skal erstattes.");
  if (current) {
    C.validatePackage(current);
    if (!same(current.base, incoming.base)) throw fail("Det private utkastet gjelder en annen dataversjon. Avklar det før import.",409);
  }
  const draft = copy(current || C.empty(incoming.base)), conflicts = [], replaced = [];
  let added = 0, duplicates = 0;
  for (const original of incoming.cases) {
    const x = original.change;
    const matches = x ? draft.cases.filter(c => c.change?.kind === "result" && c.change.selector.index === x.selector.index || c.id === original.id)
      : draft.cases.filter(c => c.id === original.id);
    if (matches.length > 1) throw fail("Det private utkastet har flere forslag til samme resultat. Avklar dem før import.",409);
    const previous = matches[0];
    if (previous && (x ? same(previous.change, x) && ["proposed","handoff"].includes(previous.status) :
        same([previous.personIds,previous.source,previous.status,previous.reason,previous.description],
          [original.personIds,original.source,original.status,original.reason,original.description]))) { duplicates++; continue; }
    // A reused ID must never silently target a different row or report.
    if (draft.cases.some(c => c.id === original.id && c !== previous)) throw fail("Saksreferansen er allerede brukt. Ingenting er overskrevet.",409);
    if (previous) {
      const sameSourceReport = !previous.change && previous.source === original.source &&
        previous.description === original.description && previous.category === original.category && same(previous.personIds,original.personIds);
      if (!x || (previous.change ? !same(previous.change.before,x.before) || !same(previous.change.selector,x.selector) : !sameSourceReport))
        throw fail("Forslagene har ulikt kildegrunnlag. Avklar dem før import.",409);
      conflicts.push({caseId:previous.id,index:x.selector.index,personIds:copy(original.personIds),privateStatus:previous.status,
        before:copy(x.before),privateAfter:copy(previous.change?.after||null),importedAfter:copy(x.after)});
      if (!replaceConflicts) continue;
      replaced.push(copy(previous));
    }
    const next = copy(original);
    next.status = next.status === "handoff" ? "proposed" : next.status;
    next.events.push({at,action:"imported-untrusted",reason:"Gjennomgått import er et privat utkast. Ingen godkjenning eller publisering er overtatt."});
    if (previous) {
      next.id = previous.id;
      next.createdAt = previous.createdAt;
      next.events = [...previous.events,...next.events];
      draft.cases[draft.cases.indexOf(previous)] = next;
    } else { draft.cases.push(next); added++; }
  }
  if (conflicts.length && !replaceConflicts)
    throw Object.assign(fail("Den nye filen avviker fra lagrede private rettingsforslag. Velg hva som skal beholdes.",409),{importConflicts:conflicts});
  if (draft.cases.length > 20) throw fail("Samlet privat utkast overstiger 20 saker. Fullfør eller avklar det eksisterende utvalget først.");
  const changed = added > 0 || replaced.length > 0;
  if (changed) for (const c of draft.cases) if (c.status === "handoff") {
    c.status = "proposed";
    c.events.push({at,action:"handoff-invalidated",reason:"Rettingsgrunnlaget er endret. Ny serverkontroll kreves."});
  }
  C.validatePackage(draft);
  return {draft,added,duplicates,replaced,changed};
}
module.exports = {mergeResultImport};
