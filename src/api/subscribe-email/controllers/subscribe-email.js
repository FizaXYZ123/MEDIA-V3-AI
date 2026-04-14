'use strict';

/**
 * subscribe-email controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::subscribe-email.subscribe-email',
  ({ strapi }) => ({
    async find(ctx) {
      const entries = await strapi.entityService.findMany(
        'api::subscribe-email.subscribe-email',
        {
          ...ctx.query,
          sort: ctx.query.sort || ['id:desc'], // ✅ descending
        }
      );

      return entries;
    },
  })
);