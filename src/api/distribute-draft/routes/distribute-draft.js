'use strict';

module.exports = {
  routes: [
    /* -------- CRUD -------- */
    { method: 'GET',    path: '/distribute-drafts',        handler: 'distribute-draft.find' },
    { method: 'GET',    path: '/distribute-drafts/:id',    handler: 'distribute-draft.findOne' },
    { method: 'POST',   path: '/distribute-drafts',        handler: 'distribute-draft.create' },
    { method: 'PUT',    path: '/distribute-drafts/:id',    handler: 'distribute-draft.update' },
    { method: 'DELETE', path: '/distribute-drafts/:id',    handler: 'distribute-draft.delete' },
    { method: 'POST',   path: '/distribute-drafts/bulk-delete', handler: 'distribute-draft.bulkDelete' },

    /* -------- Wizard Steps -------- */
    { method: 'POST',   path: '/distribute-drafts/step1',        handler: 'distribute-draft.step1' },
    { method: 'POST',   path: '/distribute-drafts/:id/step2',    handler: 'distribute-draft.step2' },
    { method: 'POST',   path: '/distribute-drafts/:id/step3',    handler: 'distribute-draft.step3' },
    { method: 'POST',   path: '/distribute-drafts/:id/step4',    handler: 'distribute-draft.step4' },
    { method: 'POST',   path: '/distribute-drafts/:id/finish',   handler: 'distribute-draft.finish' },

    /* -------- Build a draft from existing or inline tracks -------- */
    { method: 'POST',   path: '/distribute-drafts/create-from-tracks', handler: 'distribute-draft.createFromTracks' },
    // add this line to your routes array
{ method: 'GET', path: '/distribute-drafts/state/drafts', handler: 'distribute-draft.findDrafts' },
  {
      method: 'GET',
      path: '/distribute-drafts/user/:userId/drafts',
      handler: 'distribute-draft.findDraftsByUserId',
    },
     {
      method: "GET",
      path: "/distribute-drafts/user/:userId/onlydraft",
      handler: "distribute-draft.getStartedDraftsByUser",
      config: {
        auth: false, // set to true if you want only authenticated
      },
    },
{
      method: 'PUT',
      path: '/distribute-drafts/:id/step-1',
      handler: 'distribute-draft.updateStep1',
      config: { policies: [], middlewares: [] },
    },

  ],
};
