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

    // Convert to array if multiple IDs are passed
    const ids = String(id)
      .split(",")
      .map((item) => Number(item.trim()));

    // Find notification(s) belonging to logged in user
    const notifications = await strapi.db
      .query("api::notification.notification")
      .findMany({
        where: {
          id: {
            $in: ids,
          },
          users_permissions_user: user.id,
        },
      });

    if (!notifications.length) {
      return ctx.notFound("Notification not found");
    }

    // Update notification(s)
    await strapi.db
      .query("api::notification.notification")
      .updateMany({
        where: {
          id: {
            $in: ids,
          },
        },
        data: {
          is_read: true,
        },
      });

    return ctx.send({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("notification mark read error:", error);
    return ctx.internalServerError("Something went wrong");
  }
}

}));