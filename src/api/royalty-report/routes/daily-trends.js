module.exports = {
  routes: [
    {
      method: "GET",
      path: "/daily-trends/best-performing-countries",
      handler: "daily-trends.top5Countries",
      config: {
        auth: {}
      },
    },
  ],
};