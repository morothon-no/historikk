// Compatibility entry point: the shared portal model is used by trusted Node and web preview.
// Only the caller's allowlisted view may leave this boundary; no persistence or production writer.
'use strict';
const {createHonorAdminRoster}=require('../../tools/diploma-admin/portal-data.cjs').Honors;
module.exports={createHonorAdminRoster};
