'use strict';

const { config } = require("node:process");

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/email-exists',
      handler: 'account.checkEmailExists',
      config: {
        // Leave auth unset so you can control it in Roles & Permissions
        policies: [],
        middlewares: [],
      },

    },
    {
      method: 'GET',
      path: '/admin/dashboardcounts',
      handler: 'account.getPublishedTrackCount',
      config: {
        auth: { scope: [] } // this makes it authenticated
      },
    },
    {
      method: 'POST',
      path: '/email-exists',
      handler: 'account.checkEmailExistsPost',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/publish-distributes/by-user/:userId',
      handler: 'account.findByUser',
      config: {
        auth: { scope: [] } // this makes it authenticated
      },
    },
    {
      method: 'GET',
      path: '/publish-distributes/my',
      handler: 'account.findMy',
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: 'GET',
      path: '/publish-distributes/my-calendar',
      handler: 'account.findMyCal',
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: "PATCH",
      path: "/users/me",
      handler: "account.updateMe",
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: 'POST',
      path: '/publish-distributes/draft/:id',   // <-- :id is required here
      handler: 'account.publishDraft',
      config: {
        type: "content-api"
      }
    }
    ,
    {
      method: 'GET',
      path: '/distribute-tracks/count/user/:userId',
      handler: 'account.countByUser',
      config: {
        auth: { scope: [] },
      },
    },
    {
      method: 'GET',
      path: '/distribute-tracks/count/me',
      handler: 'account.countMe',
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: 'GET',
      path: '/users/clients',      // URL for all clients
      handler: 'account.getAllWithCounts',
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: 'GET',
      path: '/users/clients/:id',  // URL for single client by ID
      handler: 'account.getOneWithCounts',
      config: {
        auth: { scope: [] }, // authenticated users only
      },
    },
    {
      method: 'GET',
      path: '/publish-distributes/priorities',
      handler: 'account.getOnlyPriority',
      config: {
        auth: false, // set to true if authentication needed
      },
    },
    {
      method: 'GET',
      path: '/publish-distributes/Standard',
      handler: 'account.getOnlyStandard',
      config: {
        auth: false, // set to true if authentication needed
      },
    },
  ],
};
