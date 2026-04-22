'use strict';

const { config } = require("node:process");

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/artist-details/my',
      handler: 'artist-detail.findMy',
      config: {
        auth: {}, // ✅ correct format
      },
    },
    {
      method: 'POST',
      path: '/artist-details',
      handler: 'artist-detail.create',
      config: {
        auth: {
          // require authentication
          strategies: ['users-permissions'],
        },
      },
    },
    {
      method: 'GET',
      path: '/artist-details',
      handler: 'artist-detail.find',
      config:{
        type: "content-api"
      }
    },
    {
      method: 'GET',
      path: '/artist-details/:id',
      handler: 'artist-detail.findOne',
      config:{
        type: "content-api"
      }
    },
    {
      method: 'PUT',
      path: '/artist-details/:id',
      handler: 'artist-detail.update',
      config:{
        type: "content-api"
      }
    },
    {
      method: 'DELETE',
      path: '/artist-details/:id',
      handler: 'artist-detail.delete',
      config:{
        type: "content-api"
      }
    },
  ],
};
