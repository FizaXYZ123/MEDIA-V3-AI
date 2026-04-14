'use strict';

module.exports = {
  register(/*{ strapi }*/) { },

  async bootstrap({ strapi }) {

    const releases = await strapi.db
      .query('api::publish-distribute.publish-distribute')
      .findMany({ select: ['id'] });

    for (const release of releases) {
      await strapi
        .service('api::distribute-track.distribute-track')
        .checkAndUpdatePublish(release.id);
    }

    strapi.log.info('✔ PublishDistribute statuses recalculated');


    // =========================================================
    //    SEND NOTIFICATION TO ADMINS ON NEW USER/ARTIST/SONGS
    // =========================================================

    let previousStatusMap = {};
    let previousArtistVerifyMap = {};

    const notification = require('./utils/notification');

    strapi.db.lifecycles.subscribe({
      models: [
        "plugin::users-permissions.user",
        "api::artist-detail.artist-detail",
        "api::publish-distribute.publish-distribute",
      ],

      async afterCreate(event) {
        const { result, model } = event;

        console.log("🔥 GLOBAL AFTER CREATE:", model.uid);

        try {
          // 👤 USER
          if (model.uid === "plugin::users-permissions.user") {
            await notification.sendToAuthenticatedUsers(
              "New User Joined ",
              `${result.username || result.email} has joined`
            );
          }

          // 🎤 ARTIST
          if (model.uid === "api::artist-detail.artist-detail") {
            await notification.sendToAuthenticatedUsers(
              "New Artist Added",
              `${result.artistName} has been added`
            );
          }

          // 🎶 RELEASE CREATED
          if (model.uid === "api::publish-distribute.publish-distribute") {
            await notification.sendToAuthenticatedUsers(
              "New song uploaded",
              `${result.ReleaseTitle} has been uploaded`
            );
          }

        } catch (err) {
          console.error("❌ Notification error:", err);
        }
      },

      async beforeUpdate(event) {
        const { where } = event.params;

        // 🎶 Track release status
        if (event.model.uid === "api::publish-distribute.publish-distribute") {
          const existing = await strapi.db
            .query("api::publish-distribute.publish-distribute")
            .findOne({
              where: { id: where.id },
              select: ["Status"],
            });

          previousStatusMap[where.id] = existing?.Status;
        }

        // 🎤 Track artist verification
        if (event.model.uid === "api::artist-detail.artist-detail") {
          const existing = await strapi.db
            .query("api::artist-detail.artist-detail")
            .findOne({
              where: { id: where.id },
              select: ["itsVerified"],
            });

          previousArtistVerifyMap[where.id] = existing?.itsVerified;
        }
      },
      async afterUpdate(event) {
        const { result, params, model } = event;
        const notification = require('./utils/notification');

        // =====================================================
        // 🎤 ARTIST VERIFIED → notify owner
        // =====================================================
if (model.uid === "api::artist-detail.artist-detail") {

  if (!Object.prototype.hasOwnProperty.call(params.data, "itsVerified")) return;

  const newStatus = result.itsVerified;

  const artist = await strapi.db
    .query("api::artist-detail.artist-detail")
    .findOne({
      where: { id: result.id },
      populate: ["owner"],
    });

  const userId = artist?.owner?.id;
  if (!userId) return;

  console.log("ARTIST STATUS UPDATED:", newStatus);

  if (newStatus === true) {
    await notification.sendToUser(
      userId,
      "Artist Verified",
      `${artist.artistName} is now verified `
    );
  }

  if (newStatus === false) {
    await notification.sendToUser(
      userId,
      "Artist Verification Rejected ❌",
      `${artist.artistName} verification was rejected`
    );
  }
}

        // =====================================================
        // 🎶 RELEASE STATUS CHANGE → notify owner
        // =====================================================
        if (model.uid === "api::publish-distribute.publish-distribute") {

          const oldStatus = previousStatusMap[result.id];
          const newStatus = result.Status;

          delete previousStatusMap[result.id];

          console.log("OLD:", oldStatus, "NEW:", newStatus);

          // ✅ only when status actually changed
          if (oldStatus === newStatus) return;

          if (newStatus === "Completed" || newStatus === "Cancelled") {

            const release = await strapi.db
              .query("api::publish-distribute.publish-distribute")
              .findOne({
                where: { id: result.id },
                populate: ["UserDetail"],
              });

            const userId = release?.UserDetail?.id;

            if (userId) {
              await notification.sendToUser(
                userId,
                `Release ${newStatus} `,
                `${release.ReleaseTitle} is ${newStatus}`
              );
            }
          }
        }

        // =====================================================
        // 🌍 EXISTING GLOBAL PUBLISH NOTIFICATION 
        // =====================================================
        if (model.uid === "api::publish-distribute.publish-distribute") {

          const isPublishing =
            params?.data?.publishedAt && !params?.where?.publishedAt;

          if (!isPublishing) return;

          try {
            await notification.sendToAuthenticatedUsers(
              "New Release Published ",
              `${result.ReleaseTitle} is now live`
            );
          } catch (err) {
            console.error("❌ Publish notification error:", err);
          }
        }
      }
    });

  },
};