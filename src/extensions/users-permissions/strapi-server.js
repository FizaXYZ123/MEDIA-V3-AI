'use strict';

module.exports = (plugin) => {

  // --- REGISTER OVERRIDE ---
  const originalRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    const body = ctx.request.body || {};

    // Normalize full name field
    if (body.fullName && !body.FulllName) {
      body.FulllName = body.fullName;
    }

    if (typeof body.FulllName === 'string') {
      body.FulllName = body.FulllName.trim();
    }

    // Prevent "invalid input syntax for type bigint: ''" error
    // Delete empty string values for numeric or potentially bigint DB fields
    const fieldsToClean = [
      'phoneNumber', 'phone_number',
      'availableBalance', 'available_balance',
      'pendingBalance', 'pending_balance',
      'platformFeeOverride', 'commissionOverride'
    ];
    fieldsToClean.forEach(field => {
      if (body[field] === "") {
        delete body[field];
      }
    });

    ctx.request.body = body;

    // Call original register
    await originalRegister(ctx);

    // If register succeeded, fetch user with role and profile image
    if (ctx.response.body && ctx.response.body.user) {
      const userWithDetails = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.response.body.user.id,
        {
          populate: ["role", "Profile_image"], // 👈 populate role + profile image
        }
      );

      ctx.response.body.user = {
        ...userWithDetails,
        profileImage: userWithDetails.Profile_image
          ? {
              id: userWithDetails.Profile_image.id,
              url: userWithDetails.Profile_image.url,
              name: userWithDetails.Profile_image.name,
              mime: userWithDetails.Profile_image.mime,
            }
          : null,
      };
    }
  };

// --- LOGIN OVERRIDE ---
  const originalLogin = plugin.controllers.auth.callback;

  plugin.controllers.auth.callback = async (ctx) => {
    try {
      await originalLogin(ctx);

      if (ctx.response.body && ctx.response.body.user) {
        const userId = ctx.response.body.user.id;

        const userWithDetails = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          {
            populate: ["role", "Profile_image"],
          }
        );

        // 🔥 ADD THIS BLOCK (DON’T REMOVE ANYTHING)
        const subscription = await strapi.db
          .query("api::user-subscription.user-subscription")
          .findMany({
            where: {
              users_permissions_user: userId,
            },
            orderBy: { createdAt: "desc" },
            limit: 1,
            populate: ["plan"],
          });

        const latest_subscription = subscription[0] || null;

        // existing logic + added field
        ctx.response.body.user = {
          ...userWithDetails,
          profileImage: userWithDetails.Profile_image
            ? {
                id: userWithDetails.Profile_image.id,
                url: userWithDetails.Profile_image.url,
                name: userWithDetails.Profile_image.name,
                mime: userWithDetails.Profile_image.mime,
              }
            : null,

          // ✅ ONLY ADD THIS LINE
          latest_subscription,
        };
      }

    } catch (error) {
      console.error("LOGIN ERROR:", error.message);
      return ctx.badRequest("Invalid email or password");
    }
  };

// /users/:id override to include latest subscription
plugin.controllers.user.findOne = async (ctx) => {

  const userId = ctx.params.id;

  if (!userId) {
    return ctx.badRequest("User ID is required");
  }

  const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: { id: userId },
      populate: ["role", "Profile_image"],
    });


  if (!user) {
    return ctx.notFound("User not found");
  }

  const subscription = await strapi.db
    .query("api::user-subscription.user-subscription")
    .findMany({
      where: {
        users_permissions_user: userId,
      },
      orderBy: { createdAt: "desc" },
      limit: 1,
      populate: ["plan"],
    });


  const latest_subscription = subscription[0] || null;

  return ctx.send({
    ...user,
    latest_subscription,
  });
};
  return plugin;
};
