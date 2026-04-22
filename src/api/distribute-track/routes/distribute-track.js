'use strict';

module.exports = {
  routes: [
    /* -------- CRUD -------- */
    {
      method: 'GET', path: '/distribute-tracks', handler: 'distribute-track.find',
      config: {
        type: "content-api"
      }
    },
    {
      method: 'GET', path: '/distribute-tracks/:id', handler: 'distribute-track.findOne',
      config: {
        type: "content-api"
      }
    },
    {
      method: 'POST', path: '/distribute-tracks', handler: 'distribute-track.create',
      config: {
        type: "content-api"
      }
    },
    {
      method: 'PUT', path: '/distribute-tracks/:id', handler: 'distribute-track.update',
      config: {
        type: "content-api"
      }
    },
    {
      method: 'DELETE', path: '/distribute-tracks/:id', handler: 'distribute-track.delete',
      config: {
        type: "content-api"
      }
    },

    /* -------- Helpers -------- */
    {
      method: 'GET', path: '/distribute-tracks/by-draft/:draftId', handler: 'distribute-track.findByDraft',
      config: {
        type: "content-api"
      }
    },
    {
      method: 'GET', path: '/distribute-tracks/by-published/:pubId', handler: 'distribute-track.findByPublished',
      config: {
        type: "content-api"
      }
    },
  ],
};
