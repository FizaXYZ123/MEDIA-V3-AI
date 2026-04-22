'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/publish-distributes', handler: 'publish-distribute.find',
      config:{
        type: "content-api"
      }
     },
    { method: 'GET', path: '/publish-distributes/:id', handler: 'publish-distribute.findOne',
      config:{
        type: "content-api"
      }
     },
    { method: 'POST', path: '/publish-distributes', handler: 'publish-distribute.create',
      config:{
        type: "content-api"
      }
     },
    { method: 'PUT', path: '/publish-distributes/:id', handler: 'publish-distribute.update',
      config:{
        type: "content-api"
      }
     },
    { method: 'DELETE', path: '/publish-distributes/:id', handler: 'publish-distribute.delete',
      config:{
        type: "content-api"
      }
     },
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
      handler: 'publish-distribute.publishFromDraft',
      config:{
        type: "content-api"
      }
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
