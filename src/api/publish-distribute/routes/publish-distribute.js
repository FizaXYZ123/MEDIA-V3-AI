'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/publish-distributes', handler: 'publish-distribute.find' },
    { method: 'GET', path: '/publish-distributes/:id', handler: 'publish-distribute.findOne' },
    { method: 'POST', path: '/publish-distributes', handler: 'publish-distribute.create' },
    { method: 'PUT', path: '/publish-distributes/:id', handler: 'publish-distribute.update' },
    { method: 'DELETE', path: '/publish-distributes/:id', handler: 'publish-distribute.delete' },
    {
      method: 'GET',
      path: '/publish-distributes/priorities',
      handler: 'publish-distribute.getOnlyPriority',
      config: {
        auth: false, // set to true if authentication needed
      },
    },

    // ONE-CLICK: Draft -> Publish (no duplication)
    {
      method: 'POST',
      path: '/publish-distributes/from-draft/:id',   // <-- :id is required here
      handler: 'publish-distribute.publishFromDraft'
    },

    {
      method: "PUT",
      path: "/publish-distributes/:id/update-release",
      handler: "publish-distribute.updateRelease",
      config: {
        auth: {}
      }
    }

  ],
};
