'use strict';

/**
 * distribute-track service
 */

// const { createCoreService } = require('@strapi/strapi').factories;

// module.exports = createCoreService('api::distribute-track.distribute-track');

'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::distribute-track.distribute-track', ({ strapi }) => ({

  async checkAndUpdatePublish(publishId) {

    if (!publishId) return;

    /* =============================
       FETCH ALL TRACK STATUSES
    ============================= */
    const tracks = await strapi.db
      .query('api::distribute-track.distribute-track')
      .findMany({
        where: {
          PublishedRelease: { id: publishId }
        },
        select: ['Status'],
      });

    if (!tracks.length) return;

    /* =============================
       NORMALIZE STATUS VALUES
    ============================= */
    const statuses = tracks.map(t =>
      String(t.Status || '').toLowerCase()
    );

    let newStatus = "In-Progress";

    /* ======================================
       ⭐ RULE 1: ONLY ONE TRACK
    ====================================== */
    if (statuses.length === 1) {

      if (statuses[0] === "completed") {
        newStatus = "Completed";
      }
      else if (statuses[0] === "cancelled") {
        newStatus = "Cancelled";
      }
      else {
        newStatus = "In-Progress";
      }

    }

    /* ======================================
       ⭐ RULE 2: MULTIPLE TRACKS
    ====================================== */
    else {

      if (statuses.every(s => s === "completed")) {
        newStatus = "Completed";
      }
      else if (statuses.every(s => s === "cancelled")) {
        newStatus = "Cancelled";
      }
      else {
        newStatus = "In-Progress";
      }

    }

    /* =============================
       UPDATE RELEASE STATUS
    ============================= */
    const release = await strapi.db
      .query('api::publish-distribute.publish-distribute')
      .findOne({
        where: { id: publishId },
        select: ['Status'],
      });

    if (!release) return;

    if (release.Status !== newStatus) {

      await strapi.db
        .query('api::publish-distribute.publish-distribute')
        .update({
          where: { id: publishId },
          data: { Status: newStatus },
        });

      strapi.log.info(
        `[Automation] PublishDistribute ${publishId} updated to ${newStatus}`
      );
    }

  }

}));
