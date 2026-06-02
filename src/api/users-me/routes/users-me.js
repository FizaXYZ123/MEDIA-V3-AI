module.exports = {
  routes: [ 
     {
      method: "GET",
      path: "/get-user/:id",
      handler: "users-me.getUser",
      config: {
        auth: {},
      },
    },
    {
      method: "PUT",
      path: "/edit-user/:id",
      handler: "users-me.editUser",
      config: {
        auth: {},
      },
    },
]
};