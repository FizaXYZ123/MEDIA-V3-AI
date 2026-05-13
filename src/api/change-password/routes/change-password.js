module.exports = {
  routes: [
    {
      method: "POST",
      path: "/change-password",
      handler: "change-password.changePassword",
      config: {
        policies: [],
      },
    },
  ],
};