'use strict';
// Separate reviewed rollout required. No request, browser or environment switch.
const {sha}=require('./github-store.cjs');
const ENABLED=false;
const digest=p=>p?.annualReversal?sha({base:p.base,reversal:p.annualReversal}):p?.digest||null;
module.exports={ENABLED,digest};
