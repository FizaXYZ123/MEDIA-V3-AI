'use strict';

// V3 — Priority 8: bulk admin actions
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/admin/bulk-update-users',
      handler: 'admin-bulk.bulkUpdateUsers',
      config: { auth: { scope: [] }, policies: [] },
    },
    {
      method: 'POST',
      path: '/admin/bulk-update-releases',
      handler: 'admin-bulk.bulkUpdateReleases',
      config: { auth: { scope: [] }, policies: [] },
    },
  ],
};
