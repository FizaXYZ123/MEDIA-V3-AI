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
      const userWithDetails = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.response.body.user.id,
        {
          populate: ["role", "Profile_image"],
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

  } catch (error) {
    console.error("LOGIN ERROR:", error.message);

    // ✅ ALWAYS SAME MESSAGE FOR LOGIN FAILURE
    return ctx.badRequest("Invalid email or password");
  }
};

  return plugin;
};
