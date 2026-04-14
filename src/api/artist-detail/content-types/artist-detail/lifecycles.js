'use strict';

// V3 — Priority 10: enforce the artist's plan.maxPrimaryArtists limit when
// they create a new artist. Owner is read from the request body's `user`
// field (already required by the existing controllers).

module.exports = {
  async beforeCreate(event) {
    try {
      const data = event.params?.data || {};
      const userId = data.user;
      if (!userId) return;

      const user = await strapi
        .query('plugin::users-permissions.user')
        .findOne({
          where: { id: userId },
          populate: { plan: true },
        });

      // No plan attached → fall back to global default. Treat as unlimited so
      // we never block legacy users who haven't been migrated yet.
      if (!user?.plan?.maxPrimaryArtists) return;

      const max = Number(user.plan.maxPrimaryArtists);
      if (!Number.isFinite(max) || max <= 0) return;

      const existing = await strapi.db
        .query('api::artist-detail.artist-detail')
        .count({ where: { user: userId } });

      if (existing >= max) {
        throw new Error(
          `Plan limit reached: your "${user.plan.name}" plan allows ${max} primary artists. ` +
            `Upgrade your plan to add more.`
        );
      }
    } catch (err) {
      // Re-throw to short-circuit the create. Strapi turns this into a 500;
      // the message is preserved for the client.
      throw err;
    }
  },
};
