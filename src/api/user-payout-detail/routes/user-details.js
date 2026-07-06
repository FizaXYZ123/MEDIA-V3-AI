module.exports = {
  routes: [
    {
      method: "GET",
      path: "/user-payout-details/my-accounts",
      handler: "user-details.myAccounts",
      config: {
        auth: {},
      },
    },
    {
      method: "DELETE",
      path: "/user-payout-details/:id",
      handler: "user-details.deleteMyAccount",
      config: {
        auth: {},
      },
    },
    {
      method: "POST",
      path: "/user-payout-details/:id/set-default",
      handler: "user-payout-detail.setDefaultBank",
      config: {
        auth: {},
      },
    }
  ],
};