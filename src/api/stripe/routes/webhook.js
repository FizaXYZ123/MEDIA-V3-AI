module.exports = {
  routes: [
    {
      method: "POST",
      path: "/stripe/webhook",
      handler: "webhook.webhook",
      config: { auth: false }
    }
  ]
};