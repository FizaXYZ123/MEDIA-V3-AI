'use strict';

module.exports = {

  async afterCreate(event) {

    const trackId = event.result.id;

    const track = await strapi.entityService.findOne(
      'api::distribute-track.distribute-track',
      trackId,
      { populate: ['PublishedRelease'] }
    );

    const publishId = track?.PublishedRelease?.id;

    strapi.log.info(`[Lifecycle] afterCreate triggered. PublishId: ${publishId}`);

    if (!publishId) return;

    setTimeout(async () => {

      await strapi
        .service('api::distribute-track.distribute-track')
        .checkAndUpdatePublish(publishId);

    }, 300);
  },

  async afterUpdate(event) {

    const trackId = event.result.id;

    const track = await strapi.entityService.findOne(
      'api::distribute-track.distribute-track',
      trackId,
      { populate: ['PublishedRelease'] }
    );

    const publishId = track?.PublishedRelease?.id;

    strapi.log.info(`[Lifecycle] afterUpdate triggered. PublishId: ${publishId}`);

    if (!publishId) return;

    setTimeout(async () => {

      await strapi
        .service('api::distribute-track.distribute-track')
        .checkAndUpdatePublish(publishId);

    }, 300);
  },

  async afterDelete(event) {

    const publishId =
      event.params?.data?.PublishedRelease ||
      event.result?.PublishedRelease;

    // strapi.log.info(`[Lifecycle] afterDelete triggered. PublishId: ${publishId}`);

    if (!publishId) return;

    setTimeout(async () => {

      await strapi
        .service('api::distribute-track.distribute-track')
        .checkAndUpdatePublish(publishId);

    }, 300);
  },

};
