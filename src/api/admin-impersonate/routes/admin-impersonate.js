'use strict';

// V3 — Priority 6: admin "view as artist" impersonation
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/admin/impersonate/:userId',
      handler: 'admin-impersonate.impersonate',
      config: {
        auth: { scope: [] },
        policies: [],
      },
    },
  ],
};
