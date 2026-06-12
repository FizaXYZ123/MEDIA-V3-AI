"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
    "api::activity-log.activity-log",
    ({ strapi }) => ({

        // async find(ctx) {
        //     const { latest } = ctx.query;

        //     // Dashboard - latest 10 logs
        //     if (latest === "true") {
        //         const logs = await strapi.entityService.findMany(
        //             "api::activity-log.activity-log",
        //             {
        //                 populate: {
        //                     users_permissions_user: {
        //                         fields: ["username", "email"],
        //                     },
        //                 },
        //                 sort: { createdAt: "desc" },
        //                 limit: 10,
        //             }
        //         );

        //         return { data: logs };
        //     }

        //     // View All - return all logs in descending order
        //     const logs = await strapi.entityService.findMany(
        //         "api::activity-log.activity-log",
        //         {
        //             populate: {
        //                 users_permissions_user: {
        //                     fields: ["username", "email"],
        //                 },
        //             },
        //             sort: { createdAt: "desc" },
        //         }
        //     );

        //     return {
        //         data: {
        //             data: logs,
        //         },
        //     };
        // },
        async find(ctx) {
  const { latest, search } = ctx.query;

  if (latest === "true") {
    const logs = await strapi.entityService.findMany(
      "api::activity-log.activity-log",
      {
        populate: {
          users_permissions_user: {
            fields: ["username", "email"],
          },
        },
        sort: { createdAt: "desc" },
        limit: 10,
      }
    );

    return { data: logs };
  }

  const filters = {};

  if (search) {
    filters.users_permissions_user = {
      username: {
        $containsi: search,
      },
    };
  }

  const logs = await strapi.entityService.findMany(
    "api::activity-log.activity-log",
    {
      filters,
      populate: {
        users_permissions_user: {
          fields: ["username", "email"],
        },
      },
      sort: { createdAt: "desc" },
    }
  );

  return {
    data: {
      data: logs,
    },
  };
}
    })
);