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

  async markAsRead(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Authentication required");
      }

      const { id } = ctx.params;

      // Find notification belonging to logged in user
      const notification = await strapi.db
        .query("api::notification.notification")
        .findOne({
          where: {
            id,
            users_permissions_user: user.id,
          },
        });

      if (!notification) {
        return ctx.notFound("Notification not found");
      }

      // Update notification
      const updatedNotification = await strapi.db
        .query("api::notification.notification")
        .update({
          where: { id },
          data: {
            is_read: true,
          },
        });

      return ctx.send({
        success: true,
        message: "Notification marked as read",
        data: updatedNotification,
      });
    } catch (error) {
      console.error("notification mark read error:", error);
      return ctx.internalServerError("Something went wrong");
    }
  },

}));