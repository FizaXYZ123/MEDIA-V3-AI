module.exports = {
  routes: [
    {
      method: "GET",
      path: "/my-payment-logs",
      handler: "custom-payment-log.findMyLogs",
      config: {
        auth:{}
      },
    },
  ],
};