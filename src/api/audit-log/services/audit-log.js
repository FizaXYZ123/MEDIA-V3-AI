'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::audit-log.audit-log', () => ({
  /**
   * Convenience helper used by the global audit middleware. Persists the
   * entry without going through the controller layer so it can be called
   * from any context (lifecycles, custom controllers, etc).
   */
  async record(entry) {
    try {
      return await strapi.entityService.create('api::audit-log.audit-log', {
        data: entry,
      });
    } catch (err) {
      // Audit logging must never break the originating request.
      strapi.log.error('audit-log: failed to write entry', err);
      return null;
    }
  },
}));
