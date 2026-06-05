module.exports = {

  async impersonate(ctx) {
    try {
      // Logged-in requester
      const authUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: {
            role: true,
          },
        }
      );

      if (!authUser) {
        return ctx.unauthorized("Authentication required");
      }

      // Only Authenticated users can impersonate
      if (
        !authUser.role ||
        authUser.role.type !== "authenticated"
      ) {
        return ctx.forbidden(
          "Only Authenticated users can impersonate clients"
        );
      }

      const { id } = ctx.params;

      const targetUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id,
        {
          populate: ["role", "Profile_image"],
        }
      );

      if (!targetUser) {
        return ctx.notFound("User not found");
      }


      if (
        !targetUser.role ||
        targetUser.role.type !== "client"
      ) {
        return ctx.forbidden(
          "Only Client users can be impersonated"
        );
      }

      if (targetUser.blocked) {
        return ctx.badRequest("User is blocked");
      }

      const subscription = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findMany({
          where: {
            users_permissions_user: targetUser.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          limit: 1,
          populate: ["plan"],
        });

      const latest_subscription = subscription[0] || null;

      const jwt = strapi
        .plugin("users-permissions")
        .service("jwt")
        .issue({
          id: targetUser.id,
        });

      return ctx.send({
        jwt,
        user: {
          ...targetUser,

          profileImage: targetUser.Profile_image
            ? {
              id: targetUser.Profile_image.id,
              url: targetUser.Profile_image.url,
              name: targetUser.Profile_image.name,
              mime: targetUser.Profile_image.mime,
            }
            : null,

          latest_subscription,
        },
      });
    } catch (err) {
      console.error("IMPERSONATION ERROR:", err);

      return ctx.badRequest(
        err.message || "Impersonation failed"
      );
    }
  }

}