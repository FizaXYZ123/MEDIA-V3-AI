'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::global-setting.global-setting', ({ strapi }) => ({
  /**
   * Returns the singleton record, creating it with defaults if missing.
   */
  async getOrCreate() {
    let entry = await strapi.db
      .query('api::global-setting.global-setting')
      .findOne({});

    if (!entry) {
      entry = await strapi.db
        .query('api::global-setting.global-setting')
        .create({
          data: {
            defaultSonosuiteCut: 15,
            defaultPlatformFee: 5,
            minimumPayoutThreshold: 50,
            fastReleaseFeePerTrack: 13,
            publishedAt: new Date(),
          },
        });
    }

    return entry;
  },
}));
