// Reuses #86/#89 unchanged engines and gates. Called only after a trusted OIDC lease.
"use strict";
const { createResultReview } = require("../result-review.cjs"),
  {createIdentityReview, identityReviewStore, SCOPE} = require('../identity-review.cjs'),
  { createResultPublication } = require("../result-publication.cjs"),
  { sha } = require("./github-store.cjs");
const ORG = "sogne-morothon",
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function createDriver({
  lease,
  reviews,
  identities,
  stateStore,
  control,
  loadContext,
  adapter,
  directory,
  verifyLive,
  onPublished,
  checkBuild,
  clock = Date.now,
  pause = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const task = lease.task,
    actor = {
      subject: task.actor,
      organizers: { [ORG]: ["review", "approve"] },
      roles: { [ORG]: "owner" },
    },
    input = { session: "leased-job", organizer: ORG };
  if (
    task.actor !== lease.ownerUserId ||
    task.codeSha !== lease.codeSha ||
    task.organizer !== ORG
  )
    throw Error("Jobben gjelder feil eier eller kodeversjon.");
  const identityMode = ['identity-decide','identity-approve','identity-revalidate','identity-check'].includes(task.action);
  if (identityMode !== (task.scope === SCOPE)) throw Error('Feil modul for privat jobb.');
  const review = identityMode ? createIdentityReview({
      authenticate:async()=>actor, loadContext,
      store:identityReviewStore({openNamespace:()=>identities}), clock,
    }) : createResultReview({
      authenticate: async () => actor,
      loadContext,
      store: reviews,
    }),
    publication = identityMode ? null : createResultPublication({
      authenticate: async () => actor,
      authorizeActor: async (id) => {
        if (id !== task.actor) throw Error("Ugyldig publiseringsaktør.");
      },
      review,
      reviewStore: reviews,
      stateStore,
      loadContext,
      adapter,
      directory,
      verifyLive,
      onPublished,
      checkBuild,
      clock,
    });
  async function updateProjection(values) {
    const key = "projection-" + ORG,
      old = await control.get(key),
      next = { ...(old || { v: 1, revision: 0, history: [] }), ...values };
    if (old && same({ ...old, revision: 0 }, { ...next, revision: 0 })) return;
    await control.transact(key, old?.revision || 0, () => ({
      ...next,
      revision: (old?.revision || 0) + 1,
    }));
  }
  async function validation() {
    const r = await review.load(input),
      checked = await review.preview({ ...input, draft: r.draft });
    const value = {
      revision: r.revision,
      digest: r.digest,
      ready: checked.review.ready,
      review: checked.review,
    };
    await updateProjection({ validation: value });
    return value;
  }
  async function projectPublication() {
    if (!publication) return null;
    const { job } = await publication.status(input);
    if (!job) return null;
    const old = await control.get("projection-" + ORG),
      history = [...(old?.history || [])];
    if (job.stage === "published" && !history.some((h) => h.id === job.id)) {
      const ctx = await loadContext(ORG);
      history.unshift({
        ...job,
        reverses: task.reversalOf || null,
        names: [
          ...new Set(job.changes.flatMap((c) => [c.before[1], c.after[1]])),
        ].map((id) => ctx.history.people.find((p) => p.i === id)?.n || "Løper"),
      });
    }
    await updateProjection({ publication: job, history, validation: null });
    return job;
  }
  async function run() {
    let error;
    try {
      if (identityMode) {
        let result;
        if (task.action === 'identity-decide') result = await review.decide({...input,
          expectedRevision:task.expectedRevision,command:task.identityCommand});
        else result = await review[task.action === 'identity-revalidate' ? 'revalidate' : task.action === 'identity-check' ? 'inspect' : 'approve']({...input,
          expectedRevision:task.expectedRevision,expectedDigest:task.expectedDigest});
        if (task.action !== 'identity-approve') {
          if(result.repeated) result=await review.inspect(input);
          const saved = await review.load(input),key='identity-inspection-'+ORG,old=await control.get(key);
          if(saved.digest!==result.digest)throw Error('Arbeidsgrunnlaget er endret under kontrollen.');
          const profiles=(view,ids)=>Object.fromEntries(ids.map(id=>{
            const p=view?.[id];return [id,p?{name:p.name,count:p.count,years:p.years,totals:p.totals,badges:p.badges,best:p.best}:null];
          }));
          const report={ready:result.review?.ready ?? true,impacts:(result.review?.impacts || []).map(impact=>{
            const c=saved.draft.cases.find(c=>c.id===impact.caseId),area=impact.changes.find(a=>a.area==='people');
            return {caseId:impact.caseId,ready:impact.ready,changed:impact.changes.filter(a=>a.status==='changed').map(a=>a.area),
              before:profiles(area?.before,c.personIds),after:profiles(area?.after,c.personIds),
              uncertain:impact.uncertain,errors:impact.errors};
          })};
          await control.transact(key,old?.revision || 0,()=>({v:1,revision:(old?.revision||0)+1,
            base:saved.draft.base,digest:saved.digest,report}));
        }
      } else {
      let current = await review.load(input);
      if (
        current.revision !== task.expectedRevision ||
        (task.action !== "reverse" &&
          (current.digest !== task.expectedDigest ||
            (task.action !== "continue" && current.stale)))
      )
        throw Error(
          "Arbeidet er endret eller foreldet. Ingen endring publiseres.",
        );
      if (task.action === "validate") {
        await review.save({
          ...input,
          expectedRevision: current.revision,
          draft: current.draft,
        });
        await validation();
      } else if (task.action === "reverse") {
        await publication.reverse({ ...input, id: task.publicationId });
        current = await review.load(input);
        await reviews.transact(ORG, current.revision, (p) => ({
          ...p,
          revision: p.revision + 1,
          reversalOf: task.publicationId,
          events: [
            ...p.events,
            {
              action: "reversal-prepared",
              actor: task.actor,
              at: new Date(clock()).toISOString(),
            },
          ],
        }));
        await validation();
      } else if (task.action === "publish") {
        const approved = await review.approve({
            ...input,
            expectedRevision: current.revision,
            expectedDigest: current.digest,
          }),
          plan = await publication.prepare({
            ...input,
            expectedRevision: approved.revision,
            expectedDigest: current.digest,
          });
        await publication.publish({
          ...input,
          id: plan.id,
          confirmation: plan.manifestSha256,
        });
        await projectPublication();
      } else if (task.action === "continue") {
        const status = await publication.status(input);
        if (!status.job) throw Error("Ingen publisering å fortsette.");
        if (["failed", "needs-review"].includes(status.job.stage))
          await publication.retry({ ...input, id: status.job.id });
      } else throw Error("Ukjent jobb.");
      if (["publish", "continue"].includes(task.action)) {
        const deadline = clock() + 35 * 60000;
        for (;;) {
          await publication.progress(ORG);
          const job = await projectPublication();
          if (
            !job ||
            ["published", "failed", "needs-review", "cancelled"].includes(
              job.stage,
            )
          )
            break;
          if (clock() >= deadline)
            throw Error(
              "Kontrollen tar lengre tid. Lagret publiseringsstatus er bevart.",
            );
          await pause(60000);
        }
      }
      }
    } catch (e) {
      error = e;
      await projectPublication().catch(() => {});
    }
    const stored = await control.get("task-" + task.id);
    await control.transact("task-" + task.id, stored.revision, (p) => ({
      ...p,
      revision: p.revision + 1,
      state: error ? "failed" : "completed",
      completedAt: new Date(clock()).toISOString(),
      ...(error
        ? {
            error:
              "Kontrollen stoppet. " +
              (error.message.length < 300 && !/[<>]/.test(error.message)
                ? error.message
                : "Lagret arbeid er bevart."),
          }
        : {}),
    }));
    return { completed: !error };
  }
  return { run };
}
module.exports = { createDriver };
