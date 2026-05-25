module.exports = {
  routes: [
    {
      method: "GET",
      path: "/daily-trends/streams-overview",
      handler:"daily-trends.streamsOverview",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/daily-trends/best-performing-countries",
      handler: "daily-trends.top5Countries",
      config: {
        auth: {}
      },
    },
    {
      method: "GET",
      path: "/daily-trends/best-performing-stores",
      handler: "daily-trends.bestPerformingChannels",
      config: {
        auth: {}
      },
    },
  ],
};