const auth = require("../../../extensions/users-permissions/controllers/auth");

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/subscription/create-session",
      handler: "subscription.createSession",
      config: { auth: {} }
    },
    {
      method: "POST",
      path: "/priority-payment",
      handler: "priority-session.createPrioritySession",
      config: {
        auth: {}, 
      },
    },
    {
      method: "POST",
      path: "/priority-payment/verify",
      handler: "priority-session.verifyPrioritySession",
      config: {
        auth: {}, 
      },
    },
  ]
};