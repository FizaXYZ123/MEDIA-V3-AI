'use strict';

// V3 — Priority 7: only the read endpoint is exposed. Writes happen
// exclusively via the global audit middleware so callers cannot forge
// entries.
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/audit-logs',
      handler: 'audit-log.find',
      config: {
        auth: { scope: [] },
        policies: [],
      },
    },
  ],
};
