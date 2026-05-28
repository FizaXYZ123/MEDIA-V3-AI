"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::payment-log.payment-log",
  ({ strapi }) => ({
    
    async findMyLogs(ctx) {
      const user = ctx.state.user;

      // User must be logged in
      if (!user) {
        return ctx.unauthorized("You must be logged in");
      }

      const paymentLogs = await strapi.entityService.findMany(
        "api::payment-log.payment-log",
        {
          filters: {
            users_permissions_user: {
              id: user.id,
            },
          },

          populate: {
            plan: true,
            publish_distribute: true,
          },

          sort: {
            createdAt: "desc",
          },
        }
      );

      return paymentLogs;
    },
  })
);