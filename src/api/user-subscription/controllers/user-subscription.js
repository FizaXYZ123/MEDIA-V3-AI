"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-subscription.user-subscription",
  ({ strapi }) => ({

    async find(ctx) {
      const { latest, search } = ctx.query;

      const filters = {};

      if (search) {
        filters.users_permissions_user = {
          username: {
            $containsi: search,
          },
        };
      }

      const subscriptions = await strapi.entityService.findMany(
        "api::user-subscription.user-subscription",
        {
          filters,
          populate: {
            users_permissions_user: {
              fields: [
                "id",
                "username"
              ],
            },
            plan: true,
            payment_log:true,
            
          },
          sort: { createdAt: "desc" },

          ...(latest === "true" && {
            limit: 10,
          }),
        }
      );

      return {
        data: subscriptions,
      };
    },

  })
);