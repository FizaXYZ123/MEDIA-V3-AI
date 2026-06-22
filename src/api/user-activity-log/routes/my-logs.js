module.exports = {
  routes: [
    {
      method: "GET",
      path: "/user-activity-logs/my",
      handler: "my-logs.myLogs",
      config: {
        auth: {},
      },
    },
  ],
};