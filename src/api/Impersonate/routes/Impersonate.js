// src/api/user/routes/impersonation.js

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/users/impersonate/:id",
      handler: "impersonate.impersonate",
      config: {
        auth: {}
      },
    },
  ],
};