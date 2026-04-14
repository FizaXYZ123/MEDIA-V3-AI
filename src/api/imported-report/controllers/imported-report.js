'use strict';

/**
 * imported-report controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::imported-report.imported-report',
  ({ strapi }) => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        sort: ctx.query.sort || 'id:desc', 
      };

      const { data, meta } = await super.find(ctx);
      return { data, meta };
    },
  })
);
