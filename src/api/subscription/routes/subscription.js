const auth = require("../../../extensions/users-permissions/controllers/auth");

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/subscription/create-session",
      handler: "subscription.createSession",
      config: { auth: {}}
    }
  ]
};