'use strict';

module.exports = {

  async sendToAuthenticatedUsers(title, message) {
    try {
      const role = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({
          where: { type: "authenticated" },
        });

      if (!role) return;

      const users = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: { role: role.id },
          select: ["id"],
        });

      if (!users.length) return;

      for (const user of users) {
        await strapi.db
          .query("api::notification.notification")
          .create({
            data: {
              title,
              message,
              users_permissions_user: user.id, 
              publishedAt: new Date(),
            },
          });
      }

      console.log("✅ Notifications sent:", users.length);

    } catch (err) {
      console.error("❌ Notification error:", err);
    }
  },

  async sendToUser(userId, title, message) {
  try {
    if (!userId) return;

    await strapi.db
      .query("api::notification.notification")
      .create({
        data: {
          title,
          message,
          users_permissions_user: userId,
          publishedAt: new Date(),
        },
      });

    console.log("✅ Notification sent to user:", userId);
  } catch (err) {
    console.error("❌ User notification error:", err);
  }
}
};