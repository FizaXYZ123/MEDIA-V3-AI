'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/ticket-raises',
      handler: 'ticket-raise.find',
      config: {
        auth: { scope: [] }
      }
    },
    {
      method: 'GET',
      path: '/ticket-raises/:id',
      handler: 'ticket-raise.findOne',
      config: {
        auth: { scope: [] }
      }
    },
    {
      method: 'POST',
      path: '/ticket-raises',
      handler: 'ticket-raise.create',
      config: {
        auth: { scope: [] }
      }
    },
    {
      method: 'PUT',
      path: '/ticket-raises/:id',
      handler: 'ticket-raise.update',
      config: {
        auth: { scope: [] }
      }
    },
    {
      method: 'DELETE',
      path: '/ticket-raises/:id',
      handler: 'ticket-raise.delete',
      config: {
        auth: { scope: [] }
      }
    }
  ]
};
