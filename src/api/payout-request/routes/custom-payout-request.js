'use strict';

module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/payout-requests/:id/approve',
      handler: 'payout-request.approve',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/payout-requests/:id/complete',
      handler: 'payout-request.complete',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/payout-requests/:id/reject',
      handler: 'payout-request.reject',
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/payout-requests/my-balance",
      handler: "custom-payout-request.getMyBalance",
      config: {
        auth: {},
      },
    },
  ],
};
