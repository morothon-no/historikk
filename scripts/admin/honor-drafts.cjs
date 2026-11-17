// Compatibility entry point: the shared portal model is used by trusted Node and web preview.
// Only the caller's allowlisted view may leave this boundary; no persistence or production writer.
'use strict';
const {createHonorDrafts,legacyEditionCatalog}=require('../../tools/diploma-admin/portal-data.cjs').Honors;
module.exports={createHonorDrafts,legacyEditionCatalog};
