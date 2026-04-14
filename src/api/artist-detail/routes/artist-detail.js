'use strict';

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
    },
    {
      method: 'GET',
      path: '/artist-details/:id',
      handler: 'artist-detail.findOne',
    },
    {
      method: 'PUT',
      path: '/artist-details/:id',
      handler: 'artist-detail.update',
    },
    {
      method: 'DELETE',
      path: '/artist-details/:id',
      handler: 'artist-detail.delete',
    },
  ],
};
