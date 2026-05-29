module.exports = {
  routes: [
    {
      method: "POST",
      path: "/artist-addon",
      handler: "artist-addon.createSession",
      config: {
        auth: {}
      },
    },
  ],
};