"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-subscription.user-subscription",
  ({ strapi }) => ({

  async find(ctx) {
  const {
    latest,
    search,
    plan,
    subscriptionType,
    status,
    from,
    to,
  } = ctx.query;

  const filters = {};

  // Search by username
  if (search) {
    filters.users_permissions_user = {
      username: {
        $containsi: search,
      },
    };
  }

  // Plan filter
  if (plan) {
    filters.plan = {
      name: {
        $eqi: plan,
      },
    };
  }

  // Subscription Type filter
  if (subscriptionType) {
    filters.subscriptionType = {
      $eqi: subscriptionType,
    };
  }

  // Status filter
  if (status) {
    filters.status = {
      $eqi: status,
    };
  }

  // Date range filter (startDate)
  if (from || to) {
    filters.startDate = {};

    if (from) {
      filters.startDate.$gte = from;
    }

    if (to) {
      filters.startDate.$lte = to;
    }
  }

  const subscriptions = await strapi.entityService.findMany(
    "api::user-subscription.user-subscription",
    {
      filters,
      populate: {
        users_permissions_user: {
          fields: ["id", "username"],
        },
        plan: true,
        payment_log: true,
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
}

  })
);