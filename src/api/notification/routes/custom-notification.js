module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/notifications/:id/read",
      handler: "notification.markAsRead",
      config: {
       auth:{}
      },
    },
  ],
};