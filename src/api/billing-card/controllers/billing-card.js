'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const createUserActivityLog = require('../../../utils/user-activity-log');

module.exports = createCoreController(
  'api::billing-card.billing-card',
  ({ strapi }) => ({
    async create(ctx) {
      const response = await super.create(ctx);

      try {
        const user = ctx.state.user;

        if (user) {
          await createUserActivityLog({
            userId: user.id,
            action: 'Billing Card Added',
            description: 'Added a new billing card',
          });
        }
      } catch (error) {
        strapi.log.error(
          `Billing card activity log failed: ${error.message}`
        );
      }

      return response;
    },
  })
);