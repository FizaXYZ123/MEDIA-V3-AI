"use strict";

module.exports = {
  async myLogs(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Authentication required");
      }

      const logs = await strapi.entityService.findMany(
        "api::user-activity-log.user-activity-log",
        {
          filters: {
            users_permissions_user: {
              id: user.id,
            },
          },
          sort: {
            createdAt: "desc",
          },
          populate: {
            users_permissions_user: {
              fields: ["id", "username", "email"],
            },
          },
        }
      );

      return ctx.send({
        success: true,
        count: logs.length,
        data: logs,
      });
    } catch (error) {
      strapi.log.error(error);

      return ctx.internalServerError(
        "Failed to fetch activity logs"
      );
    }
  },
};