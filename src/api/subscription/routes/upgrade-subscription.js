module.exports = {
  routes: [
    {
      method: "POST",
      path: "/subscription/create-upgrade-session",
      handler: "upgrade-subscription.createUpgradeSession",
      config: {
        auth: {},
      },
    },
  ],
};