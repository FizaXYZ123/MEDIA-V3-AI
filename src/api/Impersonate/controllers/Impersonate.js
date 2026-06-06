"use strict";

module.exports = {
  async impersonate(ctx) {
    try {
      console.log("🚀 IMPERSONATE API CALLED");

      // Logged-in user
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

      console.log("Auth User:", authUser.id);
      console.log("Role:", authUser.role);

      // Only authenticated users can impersonate
      if (
        !authUser.role ||
        authUser.role.type !== "authenticated"
      ) {
        return ctx.forbidden(
          "Only authenticated users can impersonate"
        );
      }

      const { id } = ctx.params;

      // Target user
      const targetUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id,
        {
          populate: {
            role: true,
          },
        }
      );

      if (!targetUser) {
        return ctx.notFound("User not found");
      }

      if (targetUser.blocked) {
        return ctx.badRequest("Target user is blocked");
      }

      // Create impersonation token
      const impersonationToken = strapi
        .plugin("users-permissions")
        .service("jwt")
        .issue({
          id: targetUser.id,
          isImpersonation: true,
          impersonatedBy: authUser.id,
          impersonatedByEmail: authUser.email,
        });

return ctx.send({
  jwt: impersonationToken,

  user: {
    id: targetUser.id,
    email: targetUser.email,
    username: targetUser.username,
    role: targetUser.role,
  },

  impersonation: {
    actorId: authUser.id,
    actorEmail: authUser.email,
    targetId: targetUser.id,
    targetEmail: targetUser.email,
    startedAt: new Date().toISOString(),
    expiresInSeconds: 2592000,
  },
});
    } catch (err) {
      console.error("========== IMPERSONATION ERROR ==========");
      console.error(err);

      return ctx.send({
        success: false,
        error: err.message,
        stack: err.stack,
      });
    }
  },
};