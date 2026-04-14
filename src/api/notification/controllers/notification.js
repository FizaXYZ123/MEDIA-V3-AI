'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  
  async find(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in');
      }

      const { query } = ctx;

      const notifications = await strapi.entityService.findMany(
        'api::notification.notification',
        {
          ...query, 
          filters: {
            ...query.filters,
            users_permissions_user: {
              id: user.id,
            },
          },
          sort: { id: 'desc' },
        }
      );

      return this.transformResponse(notifications);

    } catch (error) {
      console.error(error);
      return ctx.internalServerError('Something went wrong');
    }
  },

}));