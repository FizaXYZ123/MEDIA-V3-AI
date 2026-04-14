/**
 * royalty-report controller
 */

'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::royalty-report.royalty-report',
  ({ strapi }) => ({
    async find(ctx) {
      const entries = await strapi.entityService.findMany(
        'api::royalty-report.royalty-report',
        {
          ...ctx.query,
          sort: ctx.query.sort || ['id:desc'],
        }
      );

      return entries;
    },
  })
);
