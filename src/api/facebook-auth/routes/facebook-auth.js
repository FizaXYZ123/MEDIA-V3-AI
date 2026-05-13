module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/facebook-login',
      handler:
        'facebook-auth.facebookLogin',
      config: {
        auth: false,
      },
    },
  ],
};