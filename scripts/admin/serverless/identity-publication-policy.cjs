"use strict";
// Activation requires a separately reviewed Worker/processor rollout. Never a
// browser flag, request field, token claim or automatic consequence of a merge.
const {sha}=require('./github-store.cjs');
const ENABLED=true;
const digest=record=>record?.identityReversal?sha({draft:record.draft,reversal:record.identityReversal}):record?.draft?sha(record.draft):null;
module.exports={ENABLED,digest};
