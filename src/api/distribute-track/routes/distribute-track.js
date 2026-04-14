'use strict';

module.exports = {
  routes: [
    /* -------- CRUD -------- */
    { method: 'GET',    path: '/distribute-tracks',      handler: 'distribute-track.find' },
    { method: 'GET',    path: '/distribute-tracks/:id',  handler: 'distribute-track.findOne' },
    { method: 'POST',   path: '/distribute-tracks',      handler: 'distribute-track.create' },
    { method: 'PUT',    path: '/distribute-tracks/:id',  handler: 'distribute-track.update' },
    { method: 'DELETE', path: '/distribute-tracks/:id',  handler: 'distribute-track.delete' },

    /* -------- Helpers -------- */
    { method: 'GET',    path: '/distribute-tracks/by-draft/:draftId',     handler: 'distribute-track.findByDraft' },
    { method: 'GET',    path: '/distribute-tracks/by-published/:pubId',   handler: 'distribute-track.findByPublished' },
  ],
};
